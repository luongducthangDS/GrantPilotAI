import { NextResponse } from "next/server";

import { answerQuestion, classifySme, type Answer, type CorpusChunk, type Profile } from "@/lib/grantpilot";
import { DEFAULT_MODELS, generateAnswer, type LlmProvider } from "@/lib/llmProviders";
import { hybridRetrieve } from "@/lib/retrieval";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý pháp lý AI của GrantPilot, giúp doanh nghiệp nhỏ và vừa/startup Việt Nam tra cứu chính sách hỗ trợ, qua một cuộc hội thoại nhiều lượt (không phải từng câu hỏi độc lập).

Quy tắc bắt buộc:
- CHỈ trả lời dựa trên các đoạn trích dẫn được cung cấp bên dưới. Không được bịa, không dùng kiến thức ngoài phạm vi các đoạn trích này.
- Nếu các đoạn trích không đủ căn cứ để trả lời chắc chắn câu hỏi, phải nói rõ "Không đủ thông tin trong dữ liệu hiện có để trả lời chắc chắn" thay vì suy đoán hoặc phỏng đoán.
- Dùng lịch sử hội thoại (nếu có) để hiểu ngữ cảnh và các câu hỏi nối tiếp (ví dụ dùng "còn", "vậy", "cái đó", đại từ thay thế) — nhưng KHÔNG dùng lịch sử hội thoại làm căn cứ pháp lý; căn cứ vẫn chỉ lấy từ các đoạn trích của LƯỢT HIỆN TẠI.
- Trả lời ngắn gọn (3-6 câu), rõ ràng, bằng tiếng Việt, có thể nhắc số hiệu văn bản/điều khoản khi phù hợp.
- Đây là công cụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền — nếu câu hỏi mang tính kết luận cuối cùng (ví dụ miễn thuế hoàn toàn), nhắc người dùng cần đối chiếu văn bản gốc.
- Chỉ trả về văn bản câu trả lời thuần, không thêm tiêu đề, không lặp lại đoạn trích, không markdown.`;

const VALID_PROVIDERS: LlmProvider[] = ["google", "openai", "anthropic", "xai"];
const MAX_HISTORY_TURNS = 12;

type HistoryTurn = { role: "user" | "assistant"; text: string };

function buildPrompt(question: string, profile: Profile | undefined, chunks: CorpusChunk[], history: HistoryTurn[]) {
  const context = chunks
    .map(
      (chunk, index) =>
        `[Đoạn ${index + 1}] ${chunk.title} - ${chunk.clause} (${chunk.status})\n${chunk.text}`
    )
    .join("\n\n");

  const profileContext = profile
    ? (() => {
        const sme = classifySme(profile);
        return `Hồ sơ doanh nghiệp đang xét: ${profile.name || "chưa đặt tên"}, lĩnh vực ${profile.industry}, tỉnh/thành ${profile.province}, lao động ${profile.employees}, doanh thu ${profile.revenue_bil} tỷ, vốn ${profile.capital_bil} tỷ, startup đổi mới sáng tạo: ${profile.startup_innovation ? "có" : "không"}. Phân loại DNNVV theo Nghị định 80/2021: ${sme.size} (${sme.is_sme ? "thuộc DNNVV" : "không thuộc DNNVV"}).\n\n`;
      })()
    : "";

  const historyText = history.length
    ? `Lịch sử hội thoại trước đó (từ cũ đến mới, chỉ để hiểu ngữ cảnh, không phải căn cứ pháp lý):\n${history
        .map((turn) => `${turn.role === "user" ? "Người dùng" : "Trợ lý"}: ${turn.text}`)
        .join("\n")}\n\n`
    : "";

  return `${profileContext}${historyText}Các đoạn trích từ dữ liệu pháp lý cho lượt hỏi hiện tại:\n\n${context}\n\nCâu hỏi hiện tại: ${question}`;
}

// Resolves which provider/key/model to use for this request: a client-
// supplied override (bring-your-own-key from the Settings modal) takes
// priority; otherwise falls back to the server's own GEMINI_API_KEY, if
// configured. Returns null if neither is available.
function resolveLlmConfig(llm: { provider?: string; apiKey?: string; model?: string } | undefined) {
  if (llm?.apiKey && llm.provider && VALID_PROVIDERS.includes(llm.provider as LlmProvider)) {
    const provider = llm.provider as LlmProvider;
    return { provider, apiKey: llm.apiKey, model: llm.model?.trim() || DEFAULT_MODELS[provider] };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return { provider: "google" as LlmProvider, apiKey, model: process.env.GEMINI_MODEL || DEFAULT_MODELS.google };
  }

  return null;
}

export async function POST(request: Request) {
  const { question, history: rawHistory, profile, llm } = (await request.json()) as {
    question?: string;
    history?: HistoryTurn[];
    profile?: Profile;
    llm?: { provider?: string; apiKey?: string; model?: string };
  };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
  }

  // Cap defensively even though the client already caps what it sends —
  // an unbounded history would grow the prompt (and cost) without limit.
  const history = (rawHistory ?? [])
    .filter((turn) => (turn?.role === "user" || turn?.role === "assistant") && typeof turn.text === "string" && turn.text.trim())
    .slice(-MAX_HISTORY_TURNS);

  // A short follow-up ("còn về thuế thì sao?") often doesn't carry enough
  // keywords on its own for retrieval to find the right chunks — fold in
  // the last user turn (if any) as extra retrieval signal, without
  // changing what's shown as "the question" to the model/UI.
  const lastUserTurn = [...history].reverse().find((turn) => turn.role === "user")?.text;
  const retrievalQuery = lastUserTurn && lastUserTurn !== question ? `${lastUserTurn} ${question}` : question;

  const { chunks, mode } = await hybridRetrieve(retrievalQuery, 5);
  console.log(`[/api/qa] retrieval mode=${mode} chunks=${chunks.length} historyTurns=${history.length}`);

  if (chunks.length === 0) {
    const fallback: Answer = {
      text: "Không đủ thông tin trong dữ liệu hiện có để trả lời chắc chắn. Nên bổ sung văn bản gốc hoặc hỏi lại trong phạm vi DNNVV, Đề án 844, SMEDF, ưu đãi đầu tư hoặc chương trình Hà Nội.",
      citations: [],
      confidence: "Ngoài phạm vi dữ liệu"
    };
    return NextResponse.json(fallback);
  }

  const citations = chunks.map((chunk) => ({
    document: chunk.title,
    clause: chunk.clause,
    status: chunk.status,
    source: chunk.source
  }));

  const config = resolveLlmConfig(llm);
  if (!config) {
    console.error("Chưa có LLM nào được cấu hình (thiếu key server lẫn key người dùng) — dùng câu trả lời soạn sẵn (fallback).");
    const vbplMatches = chunks.filter((chunk) => chunk.id.startsWith("vbpl-"));
    if (vbplMatches.length > 0) {
      const titles = vbplMatches.slice(0, 3).map((chunk) => `${chunk.title} (${chunk.status})`);
      return NextResponse.json({
        text: `Tìm thấy ${vbplMatches.length} văn bản VBPL phù hợp nhất trong kết quả truy hồi: ${titles.join("; ")}. Đây mới là thông tin metadata; hãy mở nguồn VBPL trong phần trích dẫn để đọc toàn văn và tải phụ lục trước khi kết luận điều kiện áp dụng.`,
        citations,
        confidence: "Có căn cứ"
      } satisfies Answer);
    }
    return NextResponse.json(answerQuestion(question, profile));
  }

  try {
    const text = await generateAnswer(config, SYSTEM_INSTRUCTION, buildPrompt(question, profile, chunks, history));

    const insufficient = /không đủ thông tin/i.test(text);
    const result: Answer = {
      text,
      citations: insufficient ? [] : citations,
      confidence: insufficient ? "Ngoài phạm vi dữ liệu" : "Có căn cứ"
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error(`${config.provider} generate thất bại, dùng câu trả lời soạn sẵn (fallback):`, error);
    return NextResponse.json(answerQuestion(question, profile));
  }
}
