import { NextResponse } from "next/server";

import { answerQuestion, classifySme, type Answer, type CorpusChunk, type Profile } from "@/lib/grantpilot";
import { DEFAULT_LIGHT_MODELS, DEFAULT_MODELS, generateAnswer, type LlmConfig } from "@/lib/llmProviders";
import { hybridRetrieve } from "@/lib/retrieval";

// Runs before retrieval/generation so an obviously off-topic question (the
// weather, general chit-chat, unrelated coding help) gets a short, honest
// rejection instead of retrieval running on nothing relevant and the main
// model rambling around chunks that don't actually answer it. Uses the
// light/cheap model — this is a fast in/out classification, not reasoning.
const SCOPE_GUARD_INSTRUCTION = `Bạn là bộ lọc phạm vi câu hỏi cho GrantPilot — công cụ tra cứu chính sách, ưu đãi và thủ tục pháp lý dành cho doanh nghiệp nhỏ và vừa (DNNVV) / startup tại Việt Nam (ví dụ: phân loại DNNVV, ưu đãi đầu tư, thuế doanh nghiệp, Đề án 844, quỹ hỗ trợ vốn, thủ tục đăng ký).

Nhiệm vụ: Đọc câu hỏi hiện tại của người dùng (và lịch sử hội thoại nếu có, để hiểu các câu hỏi nối tiếp dùng đại từ/ngữ cảnh) rồi xác định câu hỏi có thuộc phạm vi trên không.

QUY TẮC BẮT BUỘC:
1. CHỈ trả lời đúng một từ, không giải thích, không markdown, không dấu câu thừa: "IN_SCOPE" hoặc "OUT_OF_SCOPE".
2. "OUT_OF_SCOPE" CHỈ khi câu hỏi rõ ràng không liên quan gì đến doanh nghiệp/pháp luật/chính sách Việt Nam — ví dụ thời tiết, giải trí, chuyện phiếm, hỏi về bản thân AI, lập trình không liên quan, kiến thức phổ thông không liên quan đến doanh nghiệp.
3. Nếu không chắc chắn, hoặc câu hỏi là một câu nối tiếp hợp lý của hội thoại đang bàn về chủ đề trong phạm vi, LUÔN trả lời "IN_SCOPE" — thà xử lý nhầm một câu hỏi biên còn hơn từ chối nhầm một câu hỏi hợp lệ.`;

const SYSTEM_INSTRUCTION = `Bạn là trợ lý pháp lý AI của GrantPilot, giúp doanh nghiệp nhỏ và vừa/startup Việt Nam tra cứu chính sách hỗ trợ, qua một cuộc hội thoại nhiều lượt (không phải từng câu hỏi độc lập).

Quy tắc bắt buộc:
- CHỈ trả lời dựa trên các đoạn trích dẫn được cung cấp bên dưới. Không được bịa, không dùng kiến thức ngoài phạm vi các đoạn trích này.
- Nếu các đoạn trích không đủ căn cứ để trả lời chắc chắn câu hỏi, phải nói rõ "Không đủ thông tin trong dữ liệu hiện có để trả lời chắc chắn" thay vì suy đoán hoặc phỏng đoán.
- Dùng lịch sử hội thoại (nếu có) để hiểu ngữ cảnh và các câu hỏi nối tiếp (ví dụ dùng "còn", "vậy", "cái đó", đại từ thay thế) — nhưng KHÔNG dùng lịch sử hội thoại làm căn cứ pháp lý; căn cứ vẫn chỉ lấy từ các đoạn trích của LƯỢT HIỆN TẠI.
- Trả lời ngắn gọn (3-6 câu), rõ ràng, bằng tiếng Việt, có thể nhắc số hiệu văn bản/điều khoản khi phù hợp.
- Đây là công cụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền — nếu câu hỏi mang tính kết luận cuối cùng (ví dụ miễn thuế hoàn toàn), nhắc người dùng cần đối chiếu văn bản gốc.
- Chỉ trả về văn bản câu trả lời thuần, không thêm tiêu đề, không lặp lại đoạn trích, không markdown.`;

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

// Single server-side key/model for everyone — no more per-user BYOK.
function resolveConfig(model: string): LlmConfig | null {
  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  if (!apiKey) return null;
  return { provider: "fptai", apiKey, model };
}

async function isOutOfScope(question: string, history: HistoryTurn[], config: LlmConfig): Promise<boolean> {
  const historyText = history.length ? `Lịch sử hội thoại: ${history.map((turn) => turn.text).join(" | ")}\n` : "";
  try {
    const result = await generateAnswer(config, SCOPE_GUARD_INSTRUCTION, `${historyText}Câu hỏi hiện tại: ${question}`);
    return result.trim().toUpperCase().startsWith("OUT_OF_SCOPE");
  } catch (error) {
    // Fail open: a guard failure shouldn't block a legitimate question —
    // worst case it falls through to normal retrieval/generation below.
    console.error("Scope guard thất bại, bỏ qua và xử lý bình thường:", error);
    return false;
  }
}

export async function POST(request: Request) {
  const { question, history: rawHistory, profile } = (await request.json()) as {
    question?: string;
    history?: HistoryTurn[];
    profile?: Profile;
  };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
  }

  // Cap defensively even though the client already caps what it sends —
  // an unbounded history would grow the prompt (and cost) without limit.
  const history = (rawHistory ?? [])
    .filter((turn) => (turn?.role === "user" || turn?.role === "assistant") && typeof turn.text === "string" && turn.text.trim())
    .slice(-MAX_HISTORY_TURNS);

  const lightConfig = resolveConfig(DEFAULT_LIGHT_MODELS.fptai);
  if (lightConfig && (await isOutOfScope(question, history, lightConfig))) {
    const outOfScope: Answer = {
      text: "Câu hỏi này nằm ngoài phạm vi hỗ trợ của GrantPilot — công cụ chỉ tra cứu chính sách, ưu đãi và thủ tục pháp lý cho doanh nghiệp nhỏ và vừa/startup Việt Nam. Vui lòng đặt câu hỏi trong phạm vi này (ví dụ DNNVV, Đề án 844, SMEDF, ưu đãi đầu tư, thuế doanh nghiệp).",
      citations: [],
      confidence: "Ngoài phạm vi dữ liệu"
    };
    return NextResponse.json(outOfScope);
  }

  // A short follow-up ("còn tiêu chí nhóm Nhỏ thì sao?") often doesn't carry
  // enough keywords on its own for retrieval to find the right chunks.
  // Folding in only the previous *question* isn't reliable either — a short
  // follow-up's own words can accidentally overlap more strongly with an
  // unrelated chunk (e.g. "tiêu chí" alone term-matches NĐ 268's "tiêu chí
  // công nhận startup" chunk even when the conversation's actual topic is
  // NĐ 80 Điều 5 SME classification). The previous *answer* is a much
  // stronger topic anchor — it already names the specific document/article
  // that turned out to be right (e.g. "Nghị định 80/2021", "Điều 5") — so
  // fold that in too, without changing what's shown as "the question" to
  // the model/UI.
  const lastUserTurn = [...history].reverse().find((turn) => turn.role === "user")?.text;
  const lastAssistantTurn = [...history].reverse().find((turn) => turn.role === "assistant")?.text;
  const retrievalQuery = [lastAssistantTurn, lastUserTurn === question ? undefined : lastUserTurn, question]
    .filter((part): part is string => Boolean(part))
    .join(" ");

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

  const config = resolveConfig(DEFAULT_MODELS.fptai);
  if (!config) {
    console.error("Chưa cấu hình CUSTOM_LLM_API_KEY — dùng câu trả lời soạn sẵn (fallback).");
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
