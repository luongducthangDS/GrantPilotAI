import {
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

export async function POST(request: Request) {
  const { profile, policy } = (await request.json()) as { profile?: Profile; policy?: MatchResult };

  if (!profile || !policy) {
    return NextResponse.json({ error: "Thiếu hồ sơ doanh nghiệp hoặc chính sách để xuất đơn." }, { status: 400 });
  }

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

  try {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: `Đơn đăng ký tham gia: ${policy.title}`,
              heading: HeadingLevel.HEADING_1
            }),
            new Paragraph(`Chương trình: ${policy.program}`),
            new Paragraph("Tài liệu được điền tự động từ hồ sơ doanh nghiệp trong GrantPilot AI — vui lòng kiểm tra lại thông tin trước khi nộp."),
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
