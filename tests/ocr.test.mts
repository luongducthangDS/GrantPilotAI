import assert from "node:assert/strict";
import test from "node:test";

import { ocrProfilePatch, validateOcrExtraction } from "../lib/ocr.ts";

function validPayload() {
  return {
    document_type: "business_registration",
    profile: {
      name: "  Công ty Cổ phần NovaMind AI  ",
      tax_code: "010-999-8888",
      province: "Hà Nội",
      industry: "Phần mềm / AI",
      business_line: "Phát triển phần mềm",
      representative: "Nguyễn Văn A",
      capital_bil: 5,
      email: null,
      phone: null
    },
    confidence: {
      name: 0.98,
      tax_code: 1.2,
      province: 0.9,
      industry: 0.7,
      business_line: 0.8,
      representative: 0.75,
      capital_bil: 0.88,
      email: 0,
      phone: 0
    },
    warnings: ["  Không tìm thấy email.  "]
  };
}

test("chuẩn hoá kết quả OCR và giới hạn confidence", () => {
  const extraction = validateOcrExtraction(validPayload());

  assert.equal(extraction.profile.name, "Công ty Cổ phần NovaMind AI");
  assert.equal(extraction.profile.tax_code, "0109998888");
  assert.equal(extraction.confidence.tax_code, 1);
  assert.deepEqual(extraction.warnings, ["Không tìm thấy email."]);
});

test("bỏ mã số thuế không hợp lệ và không tự tạo trường còn thiếu", () => {
  const payload = validPayload();
  payload.profile.tax_code = "123";
  const extraction = validateOcrExtraction(payload);
  const patch = ocrProfilePatch(extraction);

  assert.equal(extraction.profile.tax_code, null);
  assert.equal("tax_code" in patch, false);
  assert.equal("employees" in patch, false);
  assert.equal("revenue_bil" in patch, false);
  assert.equal("startup_innovation" in patch, false);
  assert.ok(extraction.warnings.some((warning) => warning.includes("Mã số thuế")));
});

test("đánh dấu tài liệu không xác định", () => {
  const payload = validPayload();
  payload.document_type = "invoice";
  const extraction = validateOcrExtraction(payload);

  assert.equal(extraction.document_type, "unknown");
  assert.match(extraction.warnings[0], /Không xác định/);
});
