import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { answerQuestion, classifySme, type Answer, type CorpusChunk, type Profile } from "@/lib/grantpilot";
import { hybridRetrieve } from "@/lib/retrieval";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý pháp lý AI của GrantPilot, giúp doanh nghiệp nhỏ và vừa/startup Việt Nam tra cứu chính sách hỗ trợ.

Quy tắc bắt buộc:
- CHỈ trả lời dựa trên các đoạn trích dẫn corpus được cung cấp bên dưới. Không được bịa, không dùng kiến thức ngoài corpus.
- Nếu các đoạn trích không đủ căn cứ để trả lời chắc chắn câu hỏi, phải nói rõ "Không đủ thông tin trong corpus demo để trả lời chắc chắn" thay vì suy đoán hoặc phỏng đoán.
- Trả lời ngắn gọn (3-6 câu), rõ ràng, bằng tiếng Việt, có thể nhắc số hiệu văn bản/điều khoản khi phù hợp.
- Đây là công cụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền — nếu câu hỏi mang tính kết luận cuối cùng (ví dụ miễn thuế hoàn toàn), nhắc người dùng cần đối chiếu văn bản gốc.
- Chỉ trả về văn bản câu trả lời thuần, không thêm tiêu đề, không lặp lại đoạn trích, không markdown.`;

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

  return `${profileContext}Các đoạn trích từ corpus pháp lý:\n\n${context}\n\nCâu hỏi: ${question}`;
}

export async function POST(request: Request) {
  const { question, profile } = (await request.json()) as { question?: string; profile?: Profile };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
  }

  const { chunks, mode } = await hybridRetrieve(question, 5);
  console.log(`[/api/qa] retrieval mode=${mode} chunks=${chunks.length}`);

  if (chunks.length === 0) {
    const fallback: Answer = {
      text: "Không đủ thông tin trong corpus demo để trả lời chắc chắn. Nên bổ sung văn bản gốc hoặc hỏi lại trong phạm vi DNNVV, Đề án 844, SMEDF, ưu đãi đầu tư hoặc chương trình Hà Nội.",
      citations: [],
      confidence: "Ngoài corpus"
    };
    return NextResponse.json(fallback);
  }

  const citations = chunks.map((chunk) => ({
    document: chunk.title,
    clause: chunk.clause,
    status: chunk.status,
    source: chunk.source
  }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY chưa được cấu hình — dùng câu trả lời soạn sẵn (fallback).");
    return NextResponse.json(answerQuestion(question, profile));
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: buildPrompt(question, profile, chunks),
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.2 }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Phản hồi rỗng từ LLM.");

    const insufficient = /không đủ thông tin/i.test(text);
    const result: Answer = {
      text,
      citations: insufficient ? [] : citations,
      confidence: insufficient ? "Ngoài corpus" : "Có căn cứ trong corpus"
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Gemini generate thất bại, dùng câu trả lời soạn sẵn (fallback):", error);
    return NextResponse.json(answerQuestion(question, profile));
  }
}
