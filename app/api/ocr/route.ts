import { NextResponse } from "next/server";

import {
  DOCX_MIME,
  MIN_PDF_TEXT_CHARS,
  PDF_MIME,
  XLSX_MIME,
  extractDocxText,
  extractPdfText,
  extractXlsxText
} from "@/lib/documentText";
import { normalizeIndustry, normalizeProvince } from "@/lib/grantpilot";
import { DEFAULT_LIGHT_MODELS, DEFAULT_VISION_MODELS, generateJsonAnswer, type LlmConfig } from "@/lib/llmProviders";

const SYSTEM_INSTRUCTION = `Bạn là công cụ trích xuất dữ liệu hồ sơ doanh nghiệp cho GrantPilot. Bạn nhận MỘT trong hai dạng đầu vào: (a) ảnh chụp/scan giấy tờ doanh nghiệp Việt Nam — thường là Giấy chứng nhận đăng ký doanh nghiệp (ĐKKD) hoặc trang báo cáo kết quả kinh doanh (KQKD); hoặc (b) văn bản dạng tự do (hồ sơ năng lực, giới thiệu công ty, báo cáo thường niên, v.v. — không nhất thiết theo mẫu key:value).

Nhiệm vụ: đọc nội dung và trích xuất đúng các trường sau nếu xuất hiện rõ ràng (bỏ trống nếu không thấy, KHÔNG bịa, KHÔNG suy diễn quá xa từ ngữ cảnh):
- name: tên doanh nghiệp đầy đủ
- tax_code: mã số thuế / mã số doanh nghiệp (chỉ chữ số)
- province: tỉnh/thành phố trụ sở chính — PHẢI viết đúng một trong các giá trị sau nếu khớp: "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Bình Dương", "Bắc Ninh"; nếu là tỉnh/thành khác, ghi "Khác"; nếu không xác định được, để trống
- industry: một trong các nhóm sau nếu suy ra được từ ngành nghề kinh doanh chính: "Phần mềm / AI", "Sản xuất", "Công nghệ cao", "Dịch vụ đổi mới sáng tạo", "Thương mại" — nếu không rõ, để trống
- business_line: mô tả ngành nghề kinh doanh chính (nguyên văn hoặc tóm tắt ngắn)
- employees: số lao động (số nguyên, nếu ảnh có nêu)
- revenue_bil: doanh thu (đơn vị TỶ ĐỒNG, số thập phân, quy đổi nếu ảnh ghi đơn vị khác)
- capital_bil: vốn điều lệ/vốn (đơn vị TỶ ĐỒNG, số thập phân, quy đổi nếu ảnh ghi đơn vị khác)
- representative: tên người đại diện pháp luật
- founded_year: năm thành lập/đăng ký lần đầu (số nguyên 4 chữ số, lấy từ ngày "Đăng ký lần đầu" hoặc ngày cấp ĐKKD nếu có, không suy đoán nếu ảnh không ghi rõ)

Quy tắc bắt buộc:
- CHỈ điền trường nào đọc được rõ ràng từ nội dung. Nếu không chắc hoặc không thấy, bỏ trường đó ra khỏi JSON (đừng đoán mò, đừng điền giá trị mặc định).
- Số liệu tiền tệ phải quy đổi đúng đơn vị tỷ đồng (ví dụ "8.000.000.000 đồng" -> 8; "500 triệu đồng" -> 0.5).
- CHỈ trả về JSON hợp lệ, không kèm markdown/giải thích. Định dạng:
{"name": "...", "tax_code": "...", "province": "...", "industry": "...", "business_line": "...", "employees": 0, "revenue_bil": 0, "capital_bil": 0, "representative": "...", "founded_year": 0}
Chỉ đưa các trường đọc được vào JSON — bỏ hẳn key nếu không đọc được, không dùng null/"".`;

function resolveConfig(hasImage: boolean): LlmConfig | null {
  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  if (!apiKey) return null;
  // Image path needs the vision model (Qwen2.5-VL); the text-only path
  // (parsing free-form .txt into fields) is a mechanical extraction task,
  // not the reasoning-heavy "answer chính" case — use the lighter model.
  const model = hasImage ? DEFAULT_VISION_MODELS.fptai : DEFAULT_LIGHT_MODELS.fptai;
  return { provider: "fptai", apiKey, model };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    image?: string;
    mimeType?: string;
    text?: string;
  };
  let image = body.image;
  let mimeType = body.mimeType;
  let rawText = body.text;

  if ((!image || !mimeType) && !rawText?.trim()) {
    return NextResponse.json({ error: "Thiếu dữ liệu ảnh hoặc văn bản." }, { status: 400 });
  }

  // Word/Excel aren't image formats a vision model can read, and they aren't
  // plain text either — extract the text server-side first, then fall
  // through to the exact same text path used for .txt/AI-fallback (any
  // provider works, no vision model needed for these two formats).
  if (image && (mimeType === DOCX_MIME || mimeType === XLSX_MIME)) {
    try {
      const buffer = Buffer.from(image, "base64");
      rawText = mimeType === DOCX_MIME ? await extractDocxText(buffer) : await extractXlsxText(buffer);
      if (!rawText) throw new Error("Tài liệu không có nội dung văn bản đọc được.");
      image = undefined;
      mimeType = undefined;
    } catch (error) {
      console.error("Trích xuất văn bản Word/Excel thất bại:", error);
      return NextResponse.json(
        { error: "Không đọc được nội dung file Word/Excel này. File có thể bị hỏng hoặc ở định dạng cũ (.doc/.xls) chưa được hỗ trợ — chỉ hỗ trợ .docx/.xlsx." },
        { status: 400 }
      );
    }
  }

  // Qwen2.5-VL-7B-Instruct (the only vision model in the account's catalog)
  // is called through an OpenAI-style image_url content block, which needs
  // an actual raster image — unlike Gemini's inlineData part, it can't take
  // raw PDF bytes directly. Almost every real ĐKKD/KQKD PDF is digitally
  // generated (not scanned) though, so pull its embedded text layer instead —
  // same text-extraction path as Word/Excel, reads the whole document, no
  // vision model or image conversion needed for the common case.
  if (image && mimeType === PDF_MIME) {
    try {
      const buffer = Buffer.from(image, "base64");
      rawText = await extractPdfText(buffer);
      if (rawText.length < MIN_PDF_TEXT_CHARS) {
        throw new Error("PDF không có lớp văn bản đọc được (có thể là bản scan ảnh).");
      }
      image = undefined;
      mimeType = undefined;
    } catch (error) {
      console.error("Trích xuất văn bản PDF thất bại:", error);
      return NextResponse.json(
        {
          error:
            "Không đọc được nội dung PDF này — có thể là bản scan ảnh (không có lớp văn bản), model hiện tại chưa đọc trực tiếp được PDF dạng ảnh. Vui lòng thử ảnh chụp rõ nét (JPG/PNG) hoặc file Word/Excel/TXT thay thế."
        },
        { status: 400 }
      );
    }
  }

  const config = resolveConfig(Boolean(image));
  if (!config) {
    return NextResponse.json({ error: "Chưa cấu hình AI trên máy chủ để đọc nội dung này." }, { status: 400 });
  }

  try {
    const text = image
      ? await generateJsonAnswer(
          config,
          SYSTEM_INSTRUCTION,
          "Trích xuất thông tin doanh nghiệp từ ảnh này theo đúng định dạng JSON đã quy định.",
          { data: image, mimeType: mimeType! }
        )
      : await generateJsonAnswer(
          config,
          SYSTEM_INSTRUCTION,
          `Trích xuất thông tin doanh nghiệp từ văn bản sau theo đúng định dạng JSON đã quy định.\n\n---\n${rawText}\n---`
        );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Coerce numeric fields defensively — models occasionally return
    // "8" as a string or add stray formatting despite the prompt's instruction.
    for (const key of ["employees", "revenue_bil", "capital_bil", "founded_year"]) {
      if (typeof parsed[key] === "string") {
        const num = Number(String(parsed[key]).replace(",", "."));
        if (!Number.isNaN(num)) parsed[key] = num;
        else delete parsed[key];
      }
    }

    // The prompt says "leave it out if unsure" but nothing stops a model from
    // emitting "" for a field it isn't sure about — treat that the same as omitted.
    for (const key of Object.keys(parsed)) {
      if (parsed[key] === "") delete parsed[key];
    }

    // founded_year: 0 observed live (Qwen2.5-VL-7B-Instruct) on a document
    // with no founding-year field at all — the model emitted a placeholder
    // instead of omitting the key as instructed. No real company was founded
    // in year 0, so this is always a "didn't find it" sentinel, not data.
    if (parsed.founded_year === 0) delete parsed.founded_year;

    // Defense against a real failure mode observed live: a smaller vision
    // model (gemini-2.5-flash-lite, back when Gemini was still in use here)
    // entered a repetition loop on a numeric-looking string field and emitted
    // thousands of trailing "0" characters instead of stopping — sometimes
    // truncated by the token limit into invalid JSON (caught below by the
    // JSON.parse failure), but sometimes landing on syntactically valid JSON
    // with a garbage value that would otherwise sail through untouched.
    // Keeping this validation regardless of provider since nothing here
    // structurally prevents the same failure mode on a different model.
    for (const key of Object.keys(parsed)) {
      const value = parsed[key];
      if (typeof value === "string" && value.length > 300) delete parsed[key];
    }
    if (typeof parsed.tax_code === "string" && !/^\d{10}(-\d{3})?$|^\d{13}$/.test(parsed.tax_code)) {
      delete parsed.tax_code;
    }

    // The UI's province/industry <select> only recognizes exact label strings.
    // The model can be accurate but phrase it differently (e.g. "Thành phố Hồ
    // Chí Minh" instead of "TP. Hồ Chí Minh") — normalize known aliases, drop
    // the field otherwise so an unmatched value doesn't silently render as
    // whatever the <select>'s first option happens to be.
    if (typeof parsed.province === "string") {
      const mapped = normalizeProvince(parsed.province);
      if (mapped) parsed.province = mapped;
      else delete parsed.province;
    }
    if (typeof parsed.industry === "string") {
      const mapped = normalizeIndustry(parsed.industry);
      if (mapped) parsed.industry = mapped;
      else delete parsed.industry;
    }

    return NextResponse.json({ profile: parsed });
  } catch (error) {
    console.error(`${config.provider} trích xuất hồ sơ thất bại:`, error);
    return NextResponse.json(
      { error: image ? "Không đọc được tài liệu. Thử ảnh rõ nét hơn." : "Không đọc được nội dung văn bản." },
      { status: 502 }
    );
  }
}
