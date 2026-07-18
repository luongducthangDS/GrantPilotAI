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

import { classifySme } from "@/lib/grantpilot";
import type { MatchResult, Profile } from "@/lib/grantpilot";

// Real official application forms this route can fill directly, mirroring
// the exact structure/wording of the government template. Every id here
// needs its own build function below with the field layout worked out
// against the actual gazetted document — never a generic guess. Anything
// not in this set falls through to buildGenericSummary().
const REAL_FORM_POLICY_IDS = new Set(["p_nd268_recognition", "p_nd80_startup", "p_manufacturing_value_chain"]);

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

// "Tờ khai xác định doanh nghiệp siêu nhỏ, doanh nghiệp nhỏ, doanh nghiệp
// vừa và đề xuất nhu cầu hỗ trợ" — Phụ lục kèm theo Nghị định 80/2021/NĐ-CP
// (pages 28-29 of https://datafiles.chinhphu.vn/cpp/files/vbpq/2021/08/80.signed_01.pdf,
// verified against the signed original; vbpl.vn's crawled copy of this
// decree has no attachment uploaded yet, so this is the only working source).
// Shared by p_nd80_startup and p_manufacturing_value_chain — same decree,
// same form, only the ticked line in mục 5 differs by which support the
// company is asking for. Section 2 (nữ làm chủ) and the street-address /
// quận-huyện lines have no equivalent in Profile and are left blank exactly
// as the original form leaves them, never guessed.
function buildNd80SupportForm(profile: Profile, policy: MatchResult): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);
  const sme = classifySme(profile);

  const supportOptions: { label: string; match: boolean }[] = [
    { label: "Hỗ trợ công nghệ", match: false },
    { label: "Hỗ trợ tư vấn", match: false },
    { label: "Hỗ trợ phát triển nguồn nhân lực", match: false },
    { label: "Hỗ trợ doanh nghiệp nhỏ và vừa chuyển đổi từ hộ kinh doanh", match: false },
    { label: "Hỗ trợ doanh nghiệp nhỏ và vừa khởi nghiệp sáng tạo", match: policy.id === "p_nd80_startup" },
    { label: "Hỗ trợ doanh nghiệp nhỏ và vừa tham gia cụm liên kết ngành, chuỗi giá trị", match: policy.id === "p_manufacturing_value_chain" }
  ];

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Phụ lục", alignment: AlignmentType.CENTER }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "TỜ KHAI XÁC ĐỊNH DOANH NGHIỆP SIÊU NHỎ, DOANH NGHIỆP NHỎ, DOANH NGHIỆP VỪA VÀ ĐỀ XUẤT NHU CẦU HỖ TRỢ",
                bold: true
              })
            ]
          }),
          new Paragraph({
            text: "(Kèm theo Nghị định số 80/2021/NĐ-CP ngày 26 tháng 8 năm 2021 của Chính phủ)",
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ children: [new TextRun({ text: "1. Thông tin chung về doanh nghiệp:", bold: true })] }),
          field("- Tên doanh nghiệp:", profile.name),
          field("- Mã số doanh nghiệp/Mã số thuế:", profile.tax_code),
          field("- Loại hình doanh nghiệp:"),
          field("- Địa chỉ trụ sở chính:"),
          field("- Quận/huyện:"),
          field("- Tỉnh/thành phố:", profile.province !== "Khác" ? profile.province : undefined),
          field("- Điện thoại:", profile.phone),
          field("- Fax:"),
          field("- Email:", profile.email),
          new Paragraph({ text: "" }),

          new Paragraph({ children: [new TextRun({ text: "2. Thông tin xác định doanh nghiệp do phụ nữ làm chủ:", bold: true })] }),
          new Paragraph("- Có vốn điều lệ do một hoặc nhiều phụ nữ sở hữu từ 51% trở lên:"),
          new Paragraph(`  ${checkbox(false)} Có   ${checkbox(false)} Không`),
          field("- Tên người quản lý điều hành doanh nghiệp:"),
          new Paragraph({ text: "" }),

          new Paragraph({ children: [new TextRun({ text: "3. Thông tin về tiêu chí xác định quy mô doanh nghiệp:", bold: true })] }),
          field("- Lĩnh vực sản xuất, kinh doanh chính:", profile.business_line || profile.industry),
          field("- Số lao động tham gia bảo hiểm xã hội bình quân năm:", profile.employees != null ? String(profile.employees) : undefined),
          field("- Trong đó, số lao động nữ:"),
          field("- Tổng nguồn vốn:", profile.capital_bil != null ? `${profile.capital_bil} tỷ đồng` : undefined),
          field("- Tổng doanh thu năm trước liền kề:", profile.revenue_bil != null ? `${profile.revenue_bil} tỷ đồng` : undefined),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [new TextRun({ text: "4. Doanh nghiệp tự xác định thuộc quy mô (tích X vào ô tương ứng):", bold: true })]
          }),
          new Paragraph(
            `  ${checkbox(sme.size === "Siêu nhỏ")} Doanh nghiệp siêu nhỏ   ${checkbox(sme.size === "Nhỏ")} Doanh nghiệp nhỏ   ${checkbox(sme.size === "Vừa")} Doanh nghiệp vừa`
          ),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: "5. Các nội dung đề xuất hỗ trợ (Doanh nghiệp lựa chọn một hoặc nhiều nội dung hỗ trợ):", bold: true })
            ]
          }),
          ...supportOptions.map(
            (option) =>
              new Paragraph({
                children: [new TextRun({ text: `${checkbox(option.match)} ${option.label}: ${blank}`, bold: option.match })]
              })
          ),
          new Paragraph({ text: "" }),

          new Paragraph({ children: [new TextRun({ text: "DOANH NGHIỆP CAM KẾT", bold: true })], alignment: AlignmentType.CENTER }),
          new Paragraph("1. Về tính chính xác liên quan tới thông tin của doanh nghiệp."),
          new Paragraph("2. Chấp hành nghiêm chỉnh các quy định của pháp luật Việt Nam."),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: `${profile.province && profile.province !== "Khác" ? profile.province : blank}, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "ĐẠI DIỆN HỢP PHÁP DOANH NGHIỆP", bold: true })]
          }),
          new Paragraph({ text: "(Ký, ghi rõ họ tên; chức vụ và đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          field("Hồ sơ kèm theo:"),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Nguồn: Phụ lục kèm theo Nghị định 80/2021/NĐ-CP (bản gốc: datafiles.chinhphu.vn/cpp/files/vbpq/2021/08/80.signed_01.pdf, trang 28-29) — các trường không có trong hồ sơ (loại hình doanh nghiệp, địa chỉ trụ sở, quận/huyện, thông tin phụ nữ làm chủ...) để nguyên chỗ trống của mẫu gốc, không tự suy đoán. Mục 4 tích theo phân loại DNNVV tự động của hệ thống dựa trên Điều 5 NĐ 80/2021/NĐ-CP — vui lòng đối chiếu lại trước khi nộp hồ sơ thật.",
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
    let document: Document;
    if (policy.id === "p_nd268_recognition") {
      document = buildNd268RecognitionForm(profile);
    } else if (policy.id === "p_nd80_startup" || policy.id === "p_manufacturing_value_chain") {
      document = buildNd80SupportForm(profile, policy);
    } else {
      document = buildGenericSummary(profile, policy);
    }

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
