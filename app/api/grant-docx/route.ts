import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import { NextResponse } from "next/server";

import type { MatchResult, Profile } from "@/lib/grantpilot";

// Real official application forms this route can fill directly, mirroring
// the exact structure/wording of the government template (extracted from
// the real .docx at data/raw/vbpl/files/183411/PL IV - Cong nhan
// DMST,KNST_đã gộp.docx — the same file linked in policies.json's `forms`
// field for this policy). Only p_nd268_recognition has a verified real
// template right now; every other policy still falls through to the
// generic summary below. Add a new branch here (not the generic summary)
// once another policy's real form has been located and its field layout
// worked out the same way.
const REAL_FORM_POLICY_IDS = new Set(["p_nd268_recognition"]);

function checkbox(checked: boolean) {
  return checked ? "☑" : "☐";
}

// Mẫu số IV.1.1 (Phụ lục IV, Nghị định 268/2025/NĐ-CP) — "Yêu cầu công nhận
// tổ chức, cá nhân đổi mới sáng tạo, khởi nghiệp sáng tạo". The compound
// source file bundles many sibling forms for other applicant types (trung
// tâm ĐMST, chuyên gia, nhà đầu tư...); GrantPilot's persona is always a
// business, so this generator fills specifically the "Doanh nghiệp khởi
// nghiệp sáng tạo" checkbox in PHẦN 2 — not a generic "pick one" prompt.
// Fields with no equivalent in Profile (website, người đại diện's chức vụ,
// CCCD/passport number, full street address beyond province) are left as
// the original form's blank underscore/tab, exactly as a human filling the
// real form by hand would leave them for now — never guessed.
function buildNd268RecognitionForm(profile: Profile): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: (profile.name || "TÊN TỔ CHỨC, DOANH NGHIỆP").toUpperCase(), alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "___________", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: `Số: ${blank}`, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true })] }),
          new Paragraph({ text: "Độc lập - Tự do - Hạnh phúc", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "_____________________________________", alignment: AlignmentType.CENTER }),
          new Paragraph({
            text: `${profile.province && profile.province !== "Khác" ? profile.province : blank}, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "YÊU CẦU CÔNG NHẬN DOANH NGHIỆP KHỞI NGHIỆP SÁNG TẠO", bold: true })]
          }),
          new Paragraph({ text: `Kính gửi: ${blank}`, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "PHẦN 1: THÔNG TIN ĐỐI TƯỢNG ĐỀ NGHỊ", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ children: [new TextRun({ text: "I. Loại đối tượng đề nghị:", bold: true })] }),
          new Paragraph(`${checkbox(true)} Tổ chức, doanh nghiệp`),
          new Paragraph(`${checkbox(false)} Cá nhân, nhóm cá nhân`),
          new Paragraph({ children: [new TextRun({ text: "II.1. Thông tin của tổ chức, doanh nghiệp", bold: true })] }),
          field("- Tên tổ chức, doanh nghiệp đề nghị:", profile.name),
          field("- Tên tổ chức, doanh nghiệp viết bằng tiếng nước ngoài (nếu có):"),
          field("- Tên tổ chức, doanh nghiệp viết tắt (nếu có):"),
          field("- Trụ sở chính của tổ chức, doanh nghiệp:", profile.province !== "Khác" ? profile.province : undefined),
          field("- Quyết định thành lập tổ chức/Mã số thuế/Giấy chứng nhận đăng ký doanh nghiệp:", profile.tax_code),
          field("- Số điện thoại:", profile.phone),
          field("- Email:", profile.email),
          field("- Website:"),
          new Paragraph({ children: [new TextRun({ text: "II.2. Thông tin người đại diện theo pháp luật của tổ chức, doanh nghiệp", bold: true })] }),
          field("- Họ và tên:", profile.representative),
          field("- Chức vụ:"),
          field("- Căn cước công dân/Căn cước/Hộ chiếu và các giấy tờ chứng thực cá nhân khác:"),
          field("- Điện thoại:"),
          field("- Email:"),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "PHẦN 2: NỘI DUNG ĐỀ NGHỊ CÔNG NHẬN", heading: HeadingLevel.HEADING_3 }),
          new Paragraph("Chọn 01 nội dung đề nghị công nhận sau:"),
          new Paragraph(`${checkbox(false)} Trung tâm đổi mới sáng tạo cấp quốc gia`),
          new Paragraph(`${checkbox(false)} Trung tâm đổi mới sáng tạo cấp tỉnh`),
          new Paragraph(`${checkbox(false)} Trung tâm đổi mới sáng tạo`),
          new Paragraph(`${checkbox(false)} Trung tâm hỗ trợ khởi nghiệp sáng tạo cấp quốc gia`),
          new Paragraph(`${checkbox(false)} Trung tâm hỗ trợ khởi nghiệp sáng tạo cấp tỉnh`),
          new Paragraph(`${checkbox(false)} Trung tâm hỗ trợ khởi nghiệp sáng tạo`),
          new Paragraph(`${checkbox(false)} Cá nhân, nhóm cá nhân khởi nghiệp sáng tạo`),
          new Paragraph({ children: [new TextRun({ text: `${checkbox(true)} Doanh nghiệp khởi nghiệp sáng tạo`, bold: true })] }),
          new Paragraph(`${checkbox(false)} Chuyên gia hỗ trợ khởi nghiệp sáng tạo`),
          new Paragraph(`${checkbox(false)} Nhà đầu tư cá nhân khởi nghiệp sáng tạo`),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "PHẦN 3: HỒ SƠ KÈM THEO (đối với doanh nghiệp khởi nghiệp sáng tạo)", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: "- Bản sao:", bullet: { level: 0 } }),
          new Paragraph({
            text: "+ Giấy tờ pháp lý của tổ chức, doanh nghiệp (Quyết định thành lập tổ chức/Mã số thuế/Giấy chứng nhận đăng ký doanh nghiệp);",
            bullet: { level: 1 }
          }),
          new Paragraph({
            text: "+ Văn bản đầu tư, cam kết đầu tư; Giấy chứng nhận tham gia các chương trình ươm tạo, tăng tốc; Chứng nhận Giải thưởng cấp quốc gia, quốc tế về khởi nghiệp sáng tạo; hoặc văn bằng bảo hộ đối với sáng chế;... (nếu có);",
            bullet: { level: 1 }
          }),
          new Paragraph({ text: "- Thuyết minh doanh nghiệp khởi nghiệp sáng tạo;", bullet: { level: 0 } }),
          new Paragraph({ text: "- Tài liệu chứng minh đáp ứng tiêu chí theo quy định.", bullet: { level: 0 } }),
          new Paragraph({ text: "" }),

          new Paragraph(
            "Chúng tôi cam kết về tính chính xác, trung thực và hoàn toàn chịu trách nhiệm về các nội dung kê khai trong hồ sơ."
          ),
          new Paragraph("Kính đề nghị quý cơ quan xem xét và cấp Giấy công nhận doanh nghiệp khởi nghiệp sáng tạo."),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT CỦA TỔ CHỨC, DOANH NGHIỆP",
                bold: true
              })
            ]
          }),
          new Paragraph({ text: "(Ký, ghi rõ họ tên; đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Nguồn: Mẫu số IV.1.1, Phụ lục IV kèm theo Nghị định 268/2025/NĐ-CP — các trường không có trong hồ sơ (website, chức vụ, CCCD/hộ chiếu, ngày cấp...) để nguyên chỗ trống của mẫu gốc, không tự suy đoán. Vui lòng kiểm tra lại toàn bộ nội dung, bổ sung các trường còn thiếu và đối chiếu văn bản gốc trước khi nộp hồ sơ thật.",
                italics: true,
                size: 18
              })
            ]
          })
        ]
      }
    ]
  });
}

// Fallback for every policy without a verified real form template yet — an
// app-generated summary of the profile + rule-based match, explicitly
// labeled as such so it's never mistaken for an official government form.
function buildGenericSummary(profile: Profile, policy: MatchResult): Document {
  const rows: [string, string][] = [
    ["Tên doanh nghiệp", profile.name ?? ""],
    ["Mã số thuế", profile.tax_code ?? ""],
    ["Địa phương", profile.province ?? ""],
    ["Lĩnh vực", profile.industry ?? ""],
    ["Ngành nghề/mô tả", profile.business_line ?? ""],
    ["Người đại diện", profile.representative ?? ""],
    ["Email", profile.email ?? ""],
    ["Điện thoại", profile.phone ?? ""],
    ["Số lao động", profile.employees != null ? String(profile.employees) : ""],
    ["Doanh thu năm gần nhất", profile.revenue_bil != null ? `${profile.revenue_bil} tỷ đồng` : ""],
    ["Vốn", profile.capital_bil != null ? `${profile.capital_bil} tỷ đồng` : ""],
    ["Giai đoạn", profile.stage ?? ""]
  ];

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `TÓM TẮT HỒ SƠ — KHÔNG PHẢI MẪU ĐƠN CHÍNH THỨC`,
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Chương trình chưa có mẫu đơn gốc từ cơ quan nhà nước được xác minh trong hệ thống — đây là bản tóm tắt hồ sơ do GrantPilot AI tự tạo, không phải biểu mẫu chính thức. Vui lòng tìm mẫu đơn đúng của "${policy.title}" từ nguồn ban hành trước khi nộp hồ sơ thật.`,
                italics: true
              })
            ]
          }),
          new Paragraph({
            text: `Đơn đăng ký tham gia: ${policy.title}`,
            heading: HeadingLevel.HEADING_1
          }),
          new Paragraph(`Chương trình: ${policy.program}`),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map(
              ([label, value]) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })] }),
                    new TableCell({ children: [new Paragraph(value)] })
                  ]
                })
            )
          }),
          new Paragraph({ text: "Nội dung đề xuất hỗ trợ", heading: HeadingLevel.HEADING_2 }),
          new Paragraph(policy.summary ?? ""),
          new Paragraph({ text: "Checklist hồ sơ", heading: HeadingLevel.HEADING_2 }),
          ...(policy.checklist ?? []).map((item) => new Paragraph({ text: item, bullet: { level: 0 } })),
          new Paragraph({ text: "Căn cứ pháp lý", heading: HeadingLevel.HEADING_2 }),
          ...(policy.citations ?? []).map(
            (citation) =>
              new Paragraph({
                text: `${citation.document} - ${citation.clause} - ${citation.status} - ${citation.source}`,
                bullet: { level: 0 }
              })
          )
        ]
      }
    ]
  });
}

export async function POST(request: Request) {
  const { profile, policy } = (await request.json()) as { profile?: Profile; policy?: MatchResult };

  if (!profile || !policy) {
    return NextResponse.json({ error: "Thiếu hồ sơ doanh nghiệp hoặc chính sách để xuất đơn." }, { status: 400 });
  }

  try {
    const document = REAL_FORM_POLICY_IDS.has(policy.id)
      ? buildNd268RecognitionForm(profile)
      : buildGenericSummary(profile, policy);

    const buffer = await Packer.toBuffer(document);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="grantpilot-${policy.id ?? "chinh-sach"}.docx"`
      }
    });
  } catch (error) {
    console.error("Xuất đơn .docx thất bại:", error);
    return NextResponse.json({ error: "Không tạo được file .docx. Vui lòng thử lại." }, { status: 500 });
  }
}
