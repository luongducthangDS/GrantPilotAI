import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from "docx";
import { NextResponse } from "next/server";

import { classifySme } from "@/lib/grantpilot";
import type { MatchResult, Profile } from "@/lib/grantpilot";

function checkbox(checked: boolean) {
  return checked ? "☑" : "☐";
}

// 1. Mẫu số IV.1.1 (Phụ lục IV, Nghị định 268/2025/NĐ-CP) — "Yêu cầu công nhận doanh nghiệp khởi nghiệp sáng tạo"
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
                text: "Nguồn: Mẫu số IV.1.1, Phụ lục IV kèm theo Nghị định 268/2025/NĐ-CP — các trường không có trong hồ sơ (website, chức vụ, CCCD/hộ chiếu) để nguyên chỗ trống của mẫu gốc.",
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

// 2. Tờ khai xác định DNNVV & Đề xuất nhu cầu hỗ trợ (Phụ lục kèm theo Nghị định 80/2021/NĐ-CP)
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
          field("- Tỉnh/thành phố:", profile.province !== "Khác" ? profile.province : undefined),
          field("- Điện thoại:", profile.phone),
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
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Nguồn: Phụ lục kèm theo Nghị định 80/2021/NĐ-CP — tự khai báo quy mô DNNVV và nhu cầu hỗ trợ.",
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

// 3. Mẫu B1-TMNV — Thuyết minh nhiệm vụ thuộc Đề án 844 (QĐ 844/QĐ-TTg & Thông tư 01/2018/TT-BKHCN)
function buildDean844ProposalForm(profile: Profile): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Mẫu B1-TMNV", alignment: AlignmentType.RIGHT }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "THUYẾT MINH NHIỆM VỤ THUỘC ĐỀ ÁN HỖ TRỢ HỆ SINH THÁI KHỞI NGHIỆP ĐỔI MỚI SÁNG TẠO QUỐC GIA ĐẾN NĂM 2025 (ĐỀ ÁN 844)",
                bold: true
              })
            ]
          }),
          new Paragraph({
            text: "(Kèm theo Thông tư số 01/2018/TT-BKHCN và Quyết định số 844/QĐ-TTg của Thủ tướng Chính phủ)",
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "A. THÔNG TIN CHUNG VỀ NHIỆM VỤ VÀ TỔ CHỨC CHỦ TRÌ", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên nhiệm vụ đề xuất: Hỗ trợ phát triển hệ sinh thái khởi nghiệp đổi mới sáng tạo cho doanh nghiệp: ", profile.name),
          field("2. Tổ chức chủ trì thực hiện nhiệm vụ: ", profile.name),
          field("- Mã số thuế/Số ĐKKD: ", profile.tax_code),
          field("- Địa chỉ trụ sở: ", profile.province !== "Khác" ? profile.province : undefined),
          field("- Điện thoại: ", profile.phone),
          field("- Email: ", profile.email),
          field("3. Người chủ nhiệm nhiệm vụ (Người đại diện): ", profile.representative),
          field("4. Lĩnh vực công nghệ/Đổi mới sáng tạo: ", profile.business_line || profile.industry),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "B. MỤC TIÊU VÀ NỘI DUNG HOẠT ĐỘNG ĐỀ XUẤT", heading: HeadingLevel.HEADING_3 }),
          new Paragraph("1. Mục tiêu tổng quát: Nâng cao năng lực khởi nghiệp đổi mới sáng tạo, hỗ trợ kết nối chuyên gia, cố vấn, nhà đầu tư và hoàn thiện sản phẩm."),
          new Paragraph("2. Nội dung hoạt động đề xuất (chọn các hạng mục đăng ký):"),
          new Paragraph(`  ${checkbox(true)} Đào tạo, bồi dưỡng kiến thức về khởi nghiệp đổi mới sáng tạo`),
          new Paragraph(`  ${checkbox(true)} Kết nối mạng lưới cố vấn, chuyên gia và nhà đầu tư khởi nghiệp`),
          new Paragraph(`  ${checkbox(false)} Tổ chức sự kiện Ngày hội khởi nghiệp đổi mới sáng tạo (Techfest)`),
          new Paragraph(`  ${checkbox(true)} Truyền thông, quảng bá sản phẩm/dịch vụ khởi nghiệp đổi mới sáng tạo`),
          new Paragraph("3. Sản phẩm dự kiến đạt được: Số lượng doanh nghiệp/cá nhân được hỗ trợ, mạng lưới cố vấn được kết nối, sản phẩm công nghệ hoàn thiện."),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "C. KẾ HOẠCH TÀI CHÍNH VÀ DỰ TOÁN KINH PHÍ", heading: HeadingLevel.HEADING_3 }),
          field("1. Tổng kinh phí dự kiến thực hiện nhiệm vụ: ", profile.capital_bil ? `${profile.capital_bil} tỷ đồng` : undefined),
          new Paragraph("2. Nhu cầu kinh phí đề nghị Ngân sách nhà nước (Đề án 844) hỗ trợ: Theo định mức chi quy định tại Thông tư 45/2019/TT-BTC."),
          new Paragraph("3. Kinh phí đối ứng của tổ chức chủ trì: Tối thiểu theo tỷ lệ quy định tại Thông tư 45/2019/TT-BTC."),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "CAM KẾT CỦA TỔ CHỨC CHỦ TRÌ", heading: HeadingLevel.HEADING_3 }),
          new Paragraph("Tổ chức chủ trì cam kết chịu trách nhiệm hoàn toàn về tính trung thực của hồ sơ và thực hiện đúng mục tiêu nhiệm vụ."),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: `${profile.province && profile.province !== "Khác" ? profile.province : blank}, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐẠI DIỆN TỔ CHỨC CHỦ TRÌ", bold: true })] }),
          new Paragraph({ text: "(Ký tên, đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER })
        ]
      }
    ]
  });
}

// 4. Đơn đề nghị vay vốn & Phương án vay vốn Quỹ SMEDF (Nghị định 39/2019/NĐ-CP & NĐ 45/2024/NĐ-CP)
function buildSmedfLoanApplicationForm(profile: Profile): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);
  const sme = classifySme(profile);

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true })] }),
          new Paragraph({ text: "Độc lập - Tự do - Hạnh phúc", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "_____________________________________", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "ĐƠN ĐỀ NGHỊ VAY VỐN QUỸ PHÁT TRIỂN DOANH NGHIỆP NHỎ VÀ VỪA (SMEDF)", bold: true })]
          }),
          new Paragraph({ text: "Kính gửi: HỘI ĐỒNG QUẢN LÝ QUỸ PHÁT TRIỂN DOANH NGHIỆP NHỎ VÀ VỪA", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "I. THÔNG TIN DOANH NGHIỆP ĐỀ NGHỊ VAY VỐN", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên doanh nghiệp: ", profile.name),
          field("2. Mã số thuế/Số ĐKKD: ", profile.tax_code),
          field("3. Trụ sở chính: ", profile.province !== "Khác" ? profile.province : undefined),
          field("4. Điện thoại: ", profile.phone),
          field("5. Email: ", profile.email),
          field("6. Ngành nghề sản xuất kinh doanh chính: ", profile.business_line || profile.industry),
          field("7. Quy mô doanh nghiệp theo Luật Hỗ trợ DNNVV: ", `Doanh nghiệp ${sme.size}`),
          field("- Số lao động bình quân: ", profile.employees != null ? `${profile.employees} người` : undefined),
          field("- Tổng nguồn vốn: ", profile.capital_bil != null ? `${profile.capital_bil} tỷ đồng` : undefined),
          field("- Doanh thu năm trước liền kề: ", profile.revenue_bil != null ? `${profile.revenue_bil} tỷ đồng` : undefined),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "II. NỘI DUNG PHƯƠNG ÁN SẢN XUẤT KINH DOANH VÀ NHU CẦU VAY VỐN", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên phương án/dự án sản xuất kinh doanh: Đầu tư phát triển sản xuất kinh doanh ", profile.business_line || profile.industry),
          field("2. Tổng mức đầu tư dự kiến: ", profile.capital_bil ? `${profile.capital_bil} tỷ đồng` : undefined),
          new Paragraph("3. Nhu cầu vốn đề nghị Quỹ SMEDF cho vay: Đề xuất mức vay ưu đãi theo quy định Nghị định 39/2019/NĐ-CP và NĐ 45/2024/NĐ-CP."),
          new Paragraph("4. Thời hạn vay đề nghị: Tối đa 7 năm theo quy định cho vay của Quỹ SMEDF."),
          new Paragraph("5. Phương án tài sản bảo đảm: Thế chấp tài sản hình thành từ vốn vay hoặc tài sản hợp pháp khác của doanh nghiệp."),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "III. HỒ SƠ KÈM THEO", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: "- Báo cáo tài chính 02 năm gần nhất (hoặc từ khi thành lập);", bullet: { level: 0 } }),
          new Paragraph({ text: "- Phương án sản xuất kinh doanh khả thi;", bullet: { level: 0 } }),
          new Paragraph({ text: "- Giấy chứng nhận đăng ký doanh nghiệp và tài liệu chứng minh tiêu chí DNNVV.", bullet: { level: 0 } }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: `${profile.province && profile.province !== "Khác" ? profile.province : blank}, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐẠI DIỆN HỢP PHÁP DOANH NGHIỆP", bold: true })] }),
          new Paragraph({ text: "(Ký tên, đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER })
        ]
      }
    ]
  });
}

// 5. Mẫu A.I.1 — Văn bản đề nghị thực hiện dự án đầu tư & hưởng ưu đãi (Luật Đầu tư 2025 & NĐ 31/2021/NĐ-CP)
function buildInvestmentIncentiveForm(profile: Profile): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Mẫu A.I.1", alignment: AlignmentType.RIGHT }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true })] }),
          new Paragraph({ text: "Độc lập - Tự do - Hạnh phúc", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "_____________________________________", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "VĂN BẢN ĐỀ NGHỊ THỰC HIỆN DỰ ÁN ĐẦU TƯ VÀ ƯU ĐÃI ĐẦU TƯ TẠI NGÀNH NGHỀ PHẦN MỀM / CNTT / CÔNG NGHỆ CAO",
                bold: true
              })
            ]
          }),
          new Paragraph({ text: "Kính gửi: SỞ KẾ HOẠCH VÀ ĐẦU TƯ / BAN QUẢN LÝ KHU CÔNG NGHỆ CAO", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "I. THÔNG TIN NHÀ ĐẦU TƯ", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên nhà đầu tư (Doanh nghiệp): ", profile.name),
          field("2. Mã số doanh nghiệp/MST: ", profile.tax_code),
          field("3. Trụ sở chính: ", profile.province !== "Khác" ? profile.province : undefined),
          field("4. Người đại diện theo pháp luật: ", profile.representative),
          field("5. Điện thoại: ", profile.phone),
          field("6. Email: ", profile.email),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "II. THÔNG TIN DỰ ÁN ĐẦU TƯ ĐỀ NGHỊ HƯỞNG ƯU ĐÃI", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên dự án đầu tư: Dự án phát triển sản phẩm phần mềm và công nghệ thông tin ", profile.name),
          field("2. Lĩnh vực đầu tư: ", profile.business_line || profile.industry),
          new Paragraph("3. Căn cứ ưu đãi đầu tư: Ngành, nghề Sản xuất sản phẩm phần mềm, công nghệ thông tin và công nghệ cao thuộc Phụ lục II ban hành kèm theo Nghị định 31/2021/NĐ-CP (sửa đổi bởi NĐ 239/2025/NĐ-CP) và Luật Đầu tư 2025 (143/2025/QH15)."),
          field("4. Tổng vốn đầu tư dự kiến: ", profile.capital_bil ? `${profile.capital_bil} tỷ đồng` : undefined),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "III. CÁC NỘI DUNG ƯU ĐÃI ĐẦU TƯ ĐỀ NGHỊ HƯỞNG", heading: HeadingLevel.HEADING_3 }),
          new Paragraph(`${checkbox(true)} Ưu đãi thuế thu nhập doanh nghiệp (áp dụng thuế suất ưu đãi, miễn/giảm thuế TNDN theo quy định pháp luật về thuế).`),
          new Paragraph(`${checkbox(true)} Miễn, giảm tiền thuê đất, tiền sử dụng đất, thuế sử dụng đất (nếu có).`),
          new Paragraph(`${checkbox(true)} Miễn thuế nhập khẩu đối với hàng hóa nhập khẩu để tạo tài sản cố định, vật tư phục vụ sản xuất phần mềm/CNTT.`),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: `${profile.province && profile.province !== "Khác" ? profile.province : blank}, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NHÀ ĐẦU TƯ / ĐẠI DIỆN DOANH NGHIỆP", bold: true })] }),
          new Paragraph({ text: "(Ký tên, đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER })
        ]
      }
    ]
  });
}

// 6. Bản đăng ký tham gia chương trình hỗ trợ khởi nghiệp đổi mới sáng tạo TP Hà Nội
function buildHanoiStartupForm(profile: Profile): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true })] }),
          new Paragraph({ text: "Độc lập - Tự do - Hạnh phúc", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "_____________________________________", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "BẢN ĐĂNG KÝ THAM GIA CHƯƠNG TRÌNH HỖ TRỢ KHỞI NGHIỆP ĐỔI MỚI SÁNG TẠO THÀNH PHỐ HÀ NỘI",
                bold: true
              })
            ]
          }),
          new Paragraph({ text: "Kính gửi: SỞ KHOA HỌC VÀ CÔNG NGHỆ THÀNH PHỐ HÀ NỘI", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "I. THÔNG TIN DOANH NGHIỆP / DỰ ÁN KHỞI NGHIỆP", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên doanh nghiệp/Dự án: ", profile.name),
          field("2. Mã số thuế: ", profile.tax_code),
          field("3. Địa chỉ trên địa bàn TP Hà Nội: ", profile.province === "Hà Nội" ? "Hà Nội" : undefined),
          field("4. Người đại diện: ", profile.representative),
          field("5. Điện thoại: ", profile.phone),
          field("6. Email: ", profile.email),
          field("7. Lĩnh vực khởi nghiệp đổi mới sáng tạo: ", profile.business_line || profile.industry),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "II. ĐỀ XUẤT NHU CẦU HỖ TRỢ NĂNG LỰC HỆ SINH THÁI HÀ NỘI", heading: HeadingLevel.HEADING_3 }),
          new Paragraph(`${checkbox(true)} Đào tạo, tập huấn chuyên sâu về quản trị và khởi nghiệp sáng tạo.`),
          new Paragraph(`${checkbox(true)} Kết nối mạng lưới cố vấn (mentor), chuyên gia và các quỹ đầu tư mạo hiểm.`),
          new Paragraph(`${checkbox(true)} Hỗ trợ sử dụng không gian làm việc chung, cơ sở kỹ thuật ươm tạo tại Hà Nội.`),
          new Paragraph(`${checkbox(true)} Tham gia các sự kiện triển lãm, Ngày hội Khởi nghiệp Đổi mới sáng tạo Thủ đô.`),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: `Hà Nội, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐẠI DIỆN DOANH NGHIỆP / DỰ ÁN", bold: true })] }),
          new Paragraph({ text: "(Ký tên, đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER })
        ]
      }
    ]
  });
}

// 7. Tờ khai thông báo đáp ứng điều kiện nhận vốn Quỹ đầu tư khởi nghiệp sáng tạo (NĐ 38/2018/NĐ-CP & NĐ 210/2025/NĐ-CP)
function buildNd38FundForm(profile: Profile): Document {
  const blank = "……………………………………………………";
  const field = (label: string, value?: string) => new Paragraph(`${label} ${value?.trim() || blank}`);
  const sme = classifySme(profile);

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true })] }),
          new Paragraph({ text: "Độc lập - Tự do - Hạnh phúc", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "_____________________________________", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "TỜ KHAI THÔNG BÁO DOANH NGHIỆP ĐỦ ĐIỀU KIỆN NHẬN VỐN TỪ QUỸ ĐẦU TƯ KHỞI NGHIỆP SÁNG TẠO",
                bold: true
              })
            ]
          }),
          new Paragraph({
            text: "(Kèm theo Nghị định số 38/2018/NĐ-CP và Nghị định số 210/2025/NĐ-CP của Chính phủ)",
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "I. THÔNG TIN DOANH NGHIỆP NHẬN ĐẦU TƯ", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên doanh nghiệp khởi nghiệp sáng tạo: ", profile.name),
          field("2. Mã số doanh nghiệp/MST: ", profile.tax_code),
          field("3. Trụ sở chính: ", profile.province !== "Khác" ? profile.province : undefined),
          field("4. Ngành, nghề đầu tư khởi nghiệp sáng tạo đã đăng ký trong GCN ĐKKD: ", profile.business_line || profile.industry),
          field("5. Xác định quy mô DNNVV: ", `Doanh nghiệp ${sme.size}`),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "II. THÔNG TIN VỀ THỎA THUẬN NHẬN VỐN ĐẦU TƯ", heading: HeadingLevel.HEADING_3 }),
          field("1. Tên Quỹ đầu tư / Nhà đầu tư khởi nghiệp sáng tạo tham gia góp vốn: "),
          new Paragraph("2. Tỷ lệ phần vốn góp của Quỹ sau khi nhận đầu tư: Tối đa không quá 50% vốn điều lệ doanh nghiệp theo quy định tại Điều 5 Nghị định 210/2025/NĐ-CP."),
          new Paragraph("3. Hình thức và tài sản góp vốn: Bằng tiền mặt, quyền sở hữu trí tuệ, công nghệ hoặc bí quyết kỹ thuật theo thỏa thuận đầu tư."),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "CAM KẾT CỦA DOANH NGHIỆP", heading: HeadingLevel.HEADING_3 }),
          new Paragraph("Doanh nghiệp cam kết đáp ứng đầy đủ các tiêu chí doanh nghiệp nhỏ và vừa khởi nghiệp sáng tạo theo quy định pháp luật."),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: `${profile.province && profile.province !== "Khác" ? profile.province : blank}, ngày … tháng … năm …`,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐẠI DIỆN HỢP PHÁP DOANH NGHIỆP", bold: true })] }),
          new Paragraph({ text: "(Ký tên, đóng dấu)", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: profile.representative || blank, alignment: AlignmentType.CENTER })
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
    } else if (policy.id === "p_dean844") {
      document = buildDean844ProposalForm(profile);
    } else if (policy.id === "p_smedf") {
      document = buildSmedfLoanApplicationForm(profile);
    } else if (policy.id === "p_investment_software") {
      document = buildInvestmentIncentiveForm(profile);
    } else if (policy.id === "p_hanoi_startup") {
      document = buildHanoiStartupForm(profile);
    } else if (policy.id === "p_nd38_investment_fund") {
      document = buildNd38FundForm(profile);
    } else {
      document = buildNd80SupportForm(profile, policy);
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
