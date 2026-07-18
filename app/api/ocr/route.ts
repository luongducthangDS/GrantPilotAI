import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { NextResponse } from "next/server";

import { OCR_INDUSTRIES, OCR_PROVINCES, validateOcrExtraction } from "@/lib/ocr";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

const nullableString = (description: string, maxLength = "500"): Schema => ({
  type: Type.STRING,
  nullable: true,
  description,
  maxLength
});

const confidenceProperties = Object.fromEntries(
  ["name", "tax_code", "province", "industry", "business_line", "representative", "capital_bil", "email", "phone"].map(
    (field) => [field, { type: Type.NUMBER, minimum: 0, maximum: 1, description: `Độ tin cậy cho trường ${field}, từ 0 đến 1.` }]
  )
) as Record<string, Schema>;

const OCR_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["document_type", "profile", "confidence", "warnings"],
  properties: {
    document_type: {
      type: Type.STRING,
      format: "enum",
      enum: ["business_registration", "unknown"],
      description: "Loại tài liệu; dùng unknown nếu không chắc chắn."
    },
    profile: {
      type: Type.OBJECT,
      required: ["name", "tax_code", "province", "industry", "business_line", "representative", "capital_bil", "email", "phone"],
      properties: {
        name: nullableString("Tên doanh nghiệp đúng như trong tài liệu.", "240"),
        tax_code: nullableString("Mã số thuế chỉ gồm chữ số.", "20"),
        province: {
          type: Type.STRING,
          nullable: true,
          format: "enum",
          enum: [...OCR_PROVINCES],
          description: "Tỉnh hoặc thành phố nơi doanh nghiệp đặt trụ sở."
        },
        industry: {
          type: Type.STRING,
          nullable: true,
          format: "enum",
          enum: [...OCR_INDUSTRIES],
          description: "Nhóm lĩnh vực tổng quát nếu có đủ căn cứ."
        },
        business_line: nullableString("Ngành nghề hoặc mô tả hoạt động nhìn thấy trong tài liệu.", "1000"),
        representative: nullableString("Người đại diện theo pháp luật.", "160"),
        capital_bil: {
          type: Type.NUMBER,
          nullable: true,
          minimum: 0,
          description: "Vốn điều lệ quy đổi sang đơn vị tỷ đồng; null nếu không thấy rõ."
        },
        email: nullableString("Email xuất hiện trong tài liệu.", "160"),
        phone: nullableString("Số điện thoại xuất hiện trong tài liệu.", "40")
      }
    },
    confidence: {
      type: Type.OBJECT,
      required: Object.keys(confidenceProperties),
      properties: confidenceProperties
    },
    warnings: {
      type: Type.ARRAY,
      maxItems: "10",
      description: "Cảnh báo về ảnh mờ, trường thiếu hoặc thông tin không chắc chắn.",
      items: { type: Type.STRING, maxLength: "240" }
    }
  }
};

const OCR_PROMPT = `Trích xuất thông tin từ ảnh giấy đăng ký doanh nghiệp Việt Nam.

Quy tắc bắt buộc:
- Chỉ ghi giá trị nhìn thấy rõ trong ảnh; không suy đoán hoặc tự bổ sung.
- Nếu không tìm thấy hoặc không chắc chắn, trả về null và confidence thấp.
- Không suy đoán doanh thu, số lao động hoặc trạng thái startup vì các trường đó không thuộc schema này.
- Giữ nguyên tên doanh nghiệp; mã số thuế chỉ gồm chữ số.
- Quy đổi vốn điều lệ sang đơn vị tỷ đồng (ví dụ 5.000.000.000 đồng thành 5).
- province nên là một trong: Hà Nội, TP. Hồ Chí Minh, Đà Nẵng, Bình Dương, Bắc Ninh, Khác.
- industry nên là một trong: Phần mềm / AI, Sản xuất, Công nghệ cao, Dịch vụ đổi mới sáng tạo, Thương mại, Khác.
- Nếu ảnh không phải giấy đăng ký doanh nghiệp, đặt document_type là unknown.
- Trả về đúng schema JSON được cung cấp.`;

function sniffMimeType(bytes: Uint8Array): string | null {
  const isPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (isPng) return "image/png";
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return isJpeg ? "image/jpeg" : null;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Yêu cầu upload không hợp lệ.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("Thiếu tệp ảnh cần đọc.", 400);
  if (file.size === 0) return errorResponse("Tệp ảnh đang trống.", 400);
  if (file.size > MAX_FILE_SIZE) return errorResponse("Tệp ảnh vượt quá giới hạn 10 MB.", 413);
  if (!ALLOWED_MIME_TYPES.has(file.type)) return errorResponse("Chỉ hỗ trợ ảnh JPG, JPEG hoặc PNG.", 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMimeType = sniffMimeType(bytes);
  if (!detectedMimeType || detectedMimeType !== file.type) {
    return errorResponse("Nội dung tệp không khớp định dạng JPG hoặc PNG hợp lệ.", 415);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse("OCR chưa được cấu hình GEMINI_API_KEY trên máy chủ.", 503);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        { inlineData: { mimeType: detectedMimeType, data: Buffer.from(bytes).toString("base64") } },
        { text: OCR_PROMPT }
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: OCR_SCHEMA
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("empty_response");
    const extraction = validateOcrExtraction(JSON.parse(text));
    return NextResponse.json(extraction, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[/api/ocr] OCR failed:", error instanceof Error ? error.name : "unknown_error");
    return errorResponse("Không thể đọc ảnh lúc này. Vui lòng thử ảnh rõ hơn hoặc nhập thông tin thủ công.", 502);
  }
}
