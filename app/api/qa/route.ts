import { NextResponse } from "next/server";

import { answerQuestion, classifySme, type Answer, type CorpusChunk, type Profile } from "@/lib/grantpilot";
import { DEFAULT_MODELS, generateAnswer, type LlmProvider } from "@/lib/llmProviders";
import { hybridRetrieve } from "@/lib/retrieval";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý pháp lý AI của GrantPilot, giúp doanh nghiệp nhỏ và vừa/startup Việt Nam tra cứu chính sách hỗ trợ.

Quy tắc bắt buộc:
- CHỈ trả lời dựa trên các đoạn trích dẫn được cung cấp bên dưới. Không được bịa, không dùng kiến thức ngoài phạm vi các đoạn trích này.
- Nếu các đoạn trích không đủ căn cứ để trả lời chắc chắn câu hỏi, phải nói rõ "Không đủ thông tin trong dữ liệu hiện có để trả lời chắc chắn" thay vì suy đoán hoặc phỏng đoán.
- Trả lời ngắn gọn (3-6 câu), rõ ràng, bằng tiếng Việt, có thể nhắc số hiệu văn bản/điều khoản khi phù hợp.
- Đây là công cụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền — nếu câu hỏi mang tính kết luận cuối cùng (ví dụ miễn thuế hoàn toàn), nhắc người dùng cần đối chiếu văn bản gốc.
- Chỉ trả về văn bản câu trả lời thuần, không thêm tiêu đề, không lặp lại đoạn trích, không markdown.`;

const VALID_PROVIDERS: LlmProvider[] = ["google", "openai", "anthropic", "xai"];

function buildPrompt(question: string, profile: Profile | undefined, chunks: CorpusChunk[]) {
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

  return `${profileContext}Các đoạn trích từ dữ liệu pháp lý:\n\n${context}\n\nCâu hỏi: ${question}`;
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
  const { question, profile, llm } = (await request.json()) as {
    question?: string;
    profile?: Profile;
    llm?: { provider?: string; apiKey?: string; model?: string };
  };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
  }

  const { chunks, mode } = await hybridRetrieve(question, 5);
  console.log(`[/api/qa] retrieval mode=${mode} chunks=${chunks.length}`);

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
    return NextResponse.json(answerQuestion(question, profile));
  }

  try {
    const text = await generateAnswer(config, SYSTEM_INSTRUCTION, buildPrompt(question, profile, chunks));

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
