import { NextResponse } from "next/server";

import { DEFAULT_VISION_MODELS, generateVisionAnswer, type LlmProvider } from "@/lib/llmProviders";

const SYSTEM_INSTRUCTION = `Bạn là công cụ OCR + trích xuất dữ liệu cho GrantPilot. Bạn nhận một ảnh chụp/scan giấy tờ doanh nghiệp Việt Nam — thường là Giấy chứng nhận đăng ký doanh nghiệp (ĐKKD) hoặc trang báo cáo kết quả kinh doanh (KQKD).

Nhiệm vụ: đọc ảnh và trích xuất đúng các trường sau nếu xuất hiện trong ảnh (bỏ trống nếu không thấy, KHÔNG bịa):
- name: tên doanh nghiệp đầy đủ
- tax_code: mã số thuế / mã số doanh nghiệp (chỉ chữ số)
- province: tỉnh/thành phố trụ sở chính
- industry: một trong các nhóm sau nếu suy ra được từ ngành nghề kinh doanh chính: "Phần mềm / AI", "Sản xuất", "Công nghệ cao", "Dịch vụ đổi mới sáng tạo", "Thương mại" — nếu không rõ, để trống
- business_line: mô tả ngành nghề kinh doanh chính (nguyên văn hoặc tóm tắt ngắn)
- employees: số lao động (số nguyên, nếu ảnh có nêu)
- revenue_bil: doanh thu (đơn vị TỶ ĐỒNG, số thập phân, quy đổi nếu ảnh ghi đơn vị khác)
- capital_bil: vốn điều lệ/vốn (đơn vị TỶ ĐỒNG, số thập phân, quy đổi nếu ảnh ghi đơn vị khác)
- representative: tên người đại diện pháp luật
- founded_year: năm thành lập/đăng ký lần đầu (số nguyên 4 chữ số, lấy từ ngày "Đăng ký lần đầu" hoặc ngày cấp ĐKKD nếu có, không suy đoán nếu ảnh không ghi rõ)

Quy tắc bắt buộc:
- CHỈ điền trường nào đọc được rõ ràng từ ảnh. Nếu không chắc hoặc không thấy, bỏ trường đó ra khỏi JSON (đừng đoán mò, đừng điền giá trị mặc định).
- Số liệu tiền tệ phải quy đổi đúng đơn vị tỷ đồng (ví dụ "8.000.000.000 đồng" -> 8; "500 triệu đồng" -> 0.5).
- CHỈ trả về JSON hợp lệ, không kèm markdown/giải thích. Định dạng:
{"name": "...", "tax_code": "...", "province": "...", "industry": "...", "business_line": "...", "employees": 0, "revenue_bil": 0, "capital_bil": 0, "representative": "...", "founded_year": 0}
Chỉ đưa các trường đọc được vào JSON — bỏ hẳn key nếu không đọc được, không dùng null/"".`;

const VALID_PROVIDERS: LlmProvider[] = ["google", "openai", "anthropic", "xai"];

export async function POST(request: Request) {
  const { image, mimeType, llm } = (await request.json()) as {
    image?: string;
    mimeType?: string;
    llm?: { provider?: string; apiKey?: string; model?: string };
  };

  if (!image || !mimeType) {
    return NextResponse.json({ error: "Thiếu dữ liệu ảnh." }, { status: 400 });
  }

  const config = (() => {
    if (llm?.apiKey && llm.provider && VALID_PROVIDERS.includes(llm.provider as LlmProvider)) {
      const provider = llm.provider as LlmProvider;
      return { provider, apiKey: llm.apiKey, model: llm.model?.trim() || DEFAULT_VISION_MODELS[provider] };
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return { provider: "google" as LlmProvider, apiKey, model: process.env.GEMINI_VISION_MODEL || DEFAULT_VISION_MODELS.google };
  })();

  if (!config) {
    return NextResponse.json(
      { error: "Chưa cấu hình AI (server hoặc cá nhân) để đọc ảnh. Vào Cài đặt AI để nhập API key, hoặc dùng upload file .txt thay thế." },
      { status: 400 }
    );
  }

  try {
    const text = await generateVisionAnswer(
      config,
      SYSTEM_INSTRUCTION,
      "Trích xuất thông tin doanh nghiệp từ ảnh này theo đúng định dạng JSON đã quy định.",
      { data: image, mimeType }
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Coerce numeric fields defensively — vision models occasionally return
    // "8" as a string or add stray formatting despite the schema instruction.
    for (const key of ["employees", "revenue_bil", "capital_bil", "founded_year"]) {
      if (typeof parsed[key] === "string") {
        const num = Number(String(parsed[key]).replace(",", "."));
        if (!Number.isNaN(num)) parsed[key] = num;
        else delete parsed[key];
      }
    }

    return NextResponse.json({ profile: parsed });
  } catch (error) {
    console.error(`${config.provider} OCR thất bại:`, error);
    return NextResponse.json({ error: "Không đọc được ảnh. Thử ảnh rõ nét hơn hoặc dùng upload file .txt thay thế." }, { status: 502 });
  }
}
