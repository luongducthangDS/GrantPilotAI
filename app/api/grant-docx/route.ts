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
  const { profile, policy } = (await request.json()) as { profile: Profile; policy: MatchResult };

  const rows = [
    ["Tên doanh nghiệp", profile.name],
    ["Mã số thuế", profile.tax_code],
    ["Địa phương", profile.province],
    ["Lĩnh vực", profile.industry],
    ["Ngành nghề/mô tả", profile.business_line ?? ""],
    ["Người đại diện", profile.representative ?? ""],
    ["Email", profile.email ?? ""],
    ["Điện thoại", profile.phone ?? ""],
    ["Số lao động", String(profile.employees)],
    ["Doanh thu năm gần nhất", `${profile.revenue_bil} tỷ đồng`],
    ["Vốn", `${profile.capital_bil} tỷ đồng`],
    ["Giai đoạn", profile.stage ?? ""]
  ];

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Đơn đăng ký tham gia nhiệm vụ Đề án 844",
            heading: HeadingLevel.HEADING_1
          }),
          new Paragraph("Bản demo được điền tự động từ hồ sơ doanh nghiệp trong GrantPilot AI."),
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
          new Paragraph(
            "Doanh nghiệp đề xuất được hỗ trợ cố vấn, kết nối hệ sinh thái, hoàn thiện sản phẩm, rà soát sở hữu trí tuệ và chuẩn hóa hồ sơ tham gia chương trình khởi nghiệp đổi mới sáng tạo."
          ),
          new Paragraph({ text: "Checklist hồ sơ", heading: HeadingLevel.HEADING_2 }),
          ...policy.checklist.map((item) => new Paragraph({ text: item, bullet: { level: 0 } })),
          new Paragraph({ text: "Căn cứ demo", heading: HeadingLevel.HEADING_2 }),
          ...policy.citations.map(
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
      "Content-Disposition": 'attachment; filename="grantpilot-de-an-844.docx"'
    }
  });
}
