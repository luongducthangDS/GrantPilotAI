import { NextResponse } from "next/server";

import { DEFAULT_VISION_MODELS, generateVisionAnswer, type LlmConfig } from "@/lib/llmProviders";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý đối chiếu hồ sơ xin tài trợ/ưu đãi của GrantPilot. Bạn nhận một danh sách các mục cần có trong checklist hồ sơ, và một hoặc nhiều ảnh tài liệu người dùng đã tải lên (có thể là nhiều loại giấy tờ khác nhau trong cùng một lượt upload).

Nhiệm vụ: với MỖI mục trong checklist, xác định xem các ảnh đã cung cấp có thể hiện tài liệu đó hay không.

Quy tắc bắt buộc:
- CHỈ đánh giá dựa trên nội dung thực sự đọc được trong ảnh. Không suy đoán hay giả định tài liệu tồn tại nếu không thấy trong ảnh.
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

  const prompt = `Checklist cần đối chiếu (${checklist.length} mục):\n${checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n\nSố tài liệu đã tải lên: ${documents.length} (${documents.map((d) => d.name).join(", ")}).`;

  try {
    const text = await generateVisionAnswer(
      config,
      SYSTEM_INSTRUCTION,
      prompt,
      documents.map((d) => ({ data: d.data, mimeType: d.mimeType }))
    );
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
    const parsed = JSON.parse(jsonMatch[0]) as { item: string; status: string; note: string }[];
    return NextResponse.json({ results: parsed });
  } catch (error) {
    console.error(`${config.provider} checklist-match thất bại:`, error);
    return NextResponse.json({ error: "Không đối chiếu được tài liệu. Thử lại với ảnh rõ nét hơn." }, { status: 502 });
  }
}
