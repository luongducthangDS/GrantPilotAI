import { NextResponse } from "next/server";

import { chunkText, rankChunks } from "@/lib/chunkRetrieve";
import { extractDocumentText, MIN_PDF_TEXT_CHARS, PDF_MIME } from "@/lib/documentText";
import { DEFAULT_VISION_MODELS, generateVisionAnswer, type LlmConfig } from "@/lib/llmProviders";

// Above this combined character budget, extracted text is no longer sent to
// the model in full — a 20-30 page upload can easily run 15k-30k+ chars,
// risking a blown context window (truncated/invalid JSON output — the exact
// failure mode already documented in /api/ocr/route.ts) and "lost in the
// middle" misses even when it doesn't outright fail. Below the budget,
// behavior is unchanged: full text, no quality loss for normal-sized docs.
const SAFE_TEXT_BUDGET_CHARS = 12000;
// When over budget, only the top N chunks per checklist item (by BM25
// relevance) are kept, deduped across items.
const TOP_CHUNKS_PER_ITEM = 3;

const SYSTEM_INSTRUCTION = `Bạn là trợ lý đối chiếu hồ sơ xin tài trợ/ưu đãi của GrantPilot. Bạn nhận một danh sách các mục cần có trong checklist hồ sơ, và một hoặc nhiều tài liệu người dùng đã tải lên (có thể là ảnh, hoặc văn bản trích từ PDF/Word — nhiều loại giấy tờ khác nhau trong cùng một lượt upload).

Nhiệm vụ: với MỖI mục trong checklist, xác định xem các tài liệu đã cung cấp (ảnh hoặc văn bản trích xuất) có thể hiện tài liệu đó hay không.

Quy tắc bắt buộc:
- CHỈ đánh giá dựa trên nội dung thực sự đọc được (trong ảnh hoặc trong văn bản trích xuất). Không suy đoán hay giả định tài liệu tồn tại nếu không thấy.
- status phải là một trong 3 giá trị: "co" (ảnh thể hiện rõ tài liệu này), "thieu" (không có ảnh nào khớp mục này), "chua_ro" (có ảnh có thể liên quan nhưng không đủ rõ ràng/đầy đủ để kết luận chắc chắn — ví dụ ảnh mờ, thiếu trang, hoặc chỉ đề cập một phần).
- note: giải thích ngắn (1 câu) — nếu "co" thì nói rõ dựa vào ảnh nào/nội dung gì; nếu "thieu" hoặc "chua_ro" thì nói cần bổ sung gì.
- Không thay thế thẩm định hồ sơ thật — đây chỉ là gợi ý sơ bộ.
- CHỈ trả về JSON hợp lệ, không kèm markdown/giải thích thêm, đúng thứ tự các mục checklist đã cho. Định dạng:
[{"item": "...", "status": "co", "note": "..."}, ...]`;

export async function POST(request: Request) {
  const { checklist, documents } = (await request.json()) as {
    checklist?: string[];
    documents?: { name: string; mimeType: string; data: string }[];
  };

  if (!checklist?.length) {
    return NextResponse.json({ error: "Thiếu checklist." }, { status: 400 });
  }
  if (!documents?.length) {
    return NextResponse.json({ error: "Chưa có tài liệu nào được tải lên." }, { status: 400 });
  }

  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  const config: LlmConfig | null = apiKey ? { provider: "fptai", apiKey, model: DEFAULT_VISION_MODELS.fptai } : null;

  if (!config) {
    return NextResponse.json({ error: "Chưa cấu hình AI trên máy chủ để đọc tài liệu." }, { status: 400 });
  }

  // PDF/Word aren't image formats the vision model can read directly — pull
  // their text server-side (same extractors as /api/ocr) and fold it into
  // the prompt as labeled text instead of an image_url block. A PDF whose
  // text can't be extracted (e.g. a scanned PDF with no text layer) has NO
  // fallback path — generateVisionAnswer's image_url block only accepts
  // raster images, not raw PDF bytes (see lib/llmProviders.ts) — so unlike
  // non-PDF files, an unreadable PDF is dropped from the AI call entirely
  // and reported back instead of being silently (and uselessly) sent as an
  // "image". This mirrors the check /api/ocr/route.ts already does.
  const images: { data: string; mimeType: string }[] = [];
  const docTexts: { name: string; text: string }[] = [];
  const unreadableDocs: string[] = [];
  for (const doc of documents) {
    const buffer = Buffer.from(doc.data, "base64");
    let extracted: string | null = null;
    try {
      extracted = await extractDocumentText(buffer, doc.mimeType);
    } catch (error) {
      console.error(`Trích xuất văn bản thất bại cho ${doc.name}:`, error);
    }
    if (doc.mimeType === PDF_MIME) {
      if (extracted && extracted.length >= MIN_PDF_TEXT_CHARS) {
        docTexts.push({ name: doc.name, text: extracted });
      } else {
        unreadableDocs.push(doc.name);
      }
    } else if (extracted) {
      docTexts.push({ name: doc.name, text: extracted });
    } else {
      images.push({ data: doc.data, mimeType: doc.mimeType });
    }
  }

  if (!docTexts.length && !images.length) {
    return NextResponse.json(
      {
        error: `Không đọc được tài liệu nào (PDF dạng scan ảnh, không có lớp văn bản: ${unreadableDocs.join(", ")}). Vui lòng thử ảnh chụp rõ nét (JPG/PNG) hoặc file Word thay thế.`
      },
      { status: 400 }
    );
  }

  const totalTextChars = docTexts.reduce((sum, d) => sum + d.text.length, 0);
  let extractedSections: string[];
  let selectiveRetrievalUsed = false;

  if (totalTextChars <= SAFE_TEXT_BUDGET_CHARS) {
    extractedSections = docTexts.map((d) => `--- Tài liệu: ${d.name} ---\n${d.text}`);
  } else {
    // Over budget: chunk every document (by Điều/Chương/Mục headings when
    // present, else fixed-size paragraph windows — see lib/chunkRetrieve.ts)
    // and, for each checklist item, keep only the top-N most relevant
    // chunks (BM25 over this request's chunks, not the policy corpus).
    // Chunks are deduped across items so overlap doesn't inflate the prompt.
    const allChunks = docTexts.flatMap((d) => chunkText(d.name, d.text));
    const selected = new Map<string, { heading: string; text: string }>();
    for (const item of checklist) {
      for (const chunk of rankChunks(allChunks, item, TOP_CHUNKS_PER_ITEM)) {
        selected.set(`${chunk.heading}::${chunk.text.slice(0, 50)}`, chunk);
      }
    }
    extractedSections = [...selected.values()].map((c) => `--- ${c.heading} ---\n${c.text}`);
    selectiveRetrievalUsed = true;
  }

  const prompt = [
    `Checklist cần đối chiếu (${checklist.length} mục):`,
    checklist.map((item, i) => `${i + 1}. ${item}`).join("\n"),
    `\nSố tài liệu đã tải lên: ${documents.length} (${documents.map((d) => d.name).join(", ")}).`,
    extractedSections.length ? `\nVăn bản trích xuất từ PDF/Word:\n\n${extractedSections.join("\n\n")}` : "",
    selectiveRetrievalUsed
      ? `\nLưu ý: tài liệu khá dài, hệ thống chỉ trích các đoạn liên quan nhất tới từng mục checklist (không phải toàn văn). Nếu không thấy đoạn nào khớp một mục, đừng suy đoán — đánh giá "thieu" hoặc "chua_ro" tùy trường hợp.`
      : "",
    unreadableDocs.length
      ? `\nLưu ý: các tài liệu sau KHÔNG đọc được (PDF scan ảnh, không có lớp văn bản, không thể xử lý): ${unreadableDocs.join(", ")}. Với các mục checklist mà chỉ có tài liệu không đọc được liên quan, hãy đánh giá là "thieu" và ghi chú rõ lý do.`
      : ""
  ].join("\n");

  try {
    const text = await generateVisionAnswer(config, SYSTEM_INSTRUCTION, prompt, images);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
    const parsed = JSON.parse(jsonMatch[0]) as { item: string; status: string; note: string }[];
    return NextResponse.json({ results: parsed, unreadableDocs, selectiveRetrievalUsed });
  } catch (error) {
    console.error(`${config.provider} checklist-match thất bại:`, error);
    return NextResponse.json({ error: "Không đối chiếu được tài liệu. Thử lại với ảnh rõ nét hơn." }, { status: 502 });
  }
}
