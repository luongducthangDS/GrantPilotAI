import type { Profile } from "./grantpilot";

export const OCR_FIELD_NAMES = [
  "name",
  "tax_code",
  "province",
  "industry",
  "business_line",
  "representative",
  "capital_bil",
  "email",
  "phone"
] as const;

export const OCR_PROVINCES = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Bình Dương", "Bắc Ninh", "Khác"] as const;
export const OCR_INDUSTRIES = ["Phần mềm / AI", "Sản xuất", "Công nghệ cao", "Dịch vụ đổi mới sáng tạo", "Thương mại", "Khác"] as const;

export type OcrFieldName = (typeof OCR_FIELD_NAMES)[number];

export type OcrProfile = {
  name: string | null;
  tax_code: string | null;
  province: string | null;
  industry: string | null;
  business_line: string | null;
  representative: string | null;
  capital_bil: number | null;
  email: string | null;
  phone: string | null;
};

export type OcrExtraction = {
  document_type: "business_registration" | "unknown";
  profile: OcrProfile;
  confidence: Record<OcrFieldName, number>;
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function confidenceValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function validateOcrExtraction(value: unknown): OcrExtraction {
  if (!isRecord(value)) throw new Error("Kết quả OCR không phải là một đối tượng JSON hợp lệ.");

  const rawProfile = isRecord(value.profile) ? value.profile : {};
  const rawConfidence = isRecord(value.confidence) ? value.confidence : {};
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.map((item) => optionalText(item, 240)).filter((item): item is string => Boolean(item)).slice(0, 10)
    : [];

  const taxCodeText = optionalText(rawProfile.tax_code, 20);
  const taxCode = taxCodeText?.replace(/\D/g, "") || null;
  if (taxCode && (taxCode.length < 8 || taxCode.length > 14)) {
    warnings.push("Mã số thuế nhận diện được không có độ dài hợp lệ và đã được bỏ qua.");
  }

  const provinceText = optionalText(rawProfile.province, 80);
  const industryText = optionalText(rawProfile.industry, 120);

  const profile: OcrProfile = {
    name: optionalText(rawProfile.name, 240),
    tax_code: taxCode && taxCode.length >= 8 && taxCode.length <= 14 ? taxCode : null,
    province: provinceText ? (OCR_PROVINCES.includes(provinceText as (typeof OCR_PROVINCES)[number]) ? provinceText : "Khác") : null,
    industry: industryText ? (OCR_INDUSTRIES.includes(industryText as (typeof OCR_INDUSTRIES)[number]) ? industryText : "Khác") : null,
    business_line: optionalText(rawProfile.business_line, 1000),
    representative: optionalText(rawProfile.representative, 160),
    capital_bil: optionalNumber(rawProfile.capital_bil),
    email: optionalText(rawProfile.email, 160),
    phone: optionalText(rawProfile.phone, 40)
  };

  const confidence = Object.fromEntries(
    OCR_FIELD_NAMES.map((field) => [field, confidenceValue(rawConfidence[field])])
  ) as Record<OcrFieldName, number>;

  const documentType = value.document_type === "business_registration" ? "business_registration" : "unknown";
  if (documentType === "unknown") warnings.unshift("Không xác định chắc chắn đây là giấy đăng ký doanh nghiệp.");

  return {
    document_type: documentType,
    profile,
    confidence,
    warnings: [...new Set(warnings)]
  };
}

export function ocrProfilePatch(extraction: OcrExtraction): Partial<Profile> {
  const patch: Partial<Profile> = {};
  const { profile } = extraction;

  if (profile.name) patch.name = profile.name;
  if (profile.tax_code) patch.tax_code = profile.tax_code;
  if (profile.province) patch.province = profile.province;
  if (profile.industry) patch.industry = profile.industry;
  if (profile.business_line) patch.business_line = profile.business_line;
  if (profile.representative) patch.representative = profile.representative;
  if (profile.capital_bil !== null) patch.capital_bil = profile.capital_bil;
  if (profile.email) patch.email = profile.email;
  if (profile.phone) patch.phone = profile.phone;

  return patch;
}
