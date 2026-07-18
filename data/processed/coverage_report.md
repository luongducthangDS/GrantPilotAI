# Data Coverage Report

Generated at: 2026-07-18T15:02:27.412625+00:00

## Counts

- sources: 23
- source_checks_ok: 22
- corpus_chunks: 52 (2026-07-19: +17 từ TT 02/2019/TT-BKHCN + TTLT 49/2014/TTLT-BTC-BKHCN, merge có lọc từ batch 47 văn bản vbpl.vn — xem `data/source_verification.md`)
- policies: 8
- policy_citations: 17
- sample_profiles: 2
- policy_watch: 23

## Remaining Gaps

- **FDI / doanh nghiệp công nghệ cao** (`roadmap`): Có schema mở rộng nhưng chưa có corpus thật trong MVP.
- **Thuế TNDN cho startup** (`missing`): Chưa đưa vào matching vì chưa xác minh văn bản chuyên ngành còn hiệu lực rõ ràng.
- **Biểu mẫu nộp Đề án 844 năm 2026** (`needs_verification`): QĐ 844 phê duyệt đến năm 2025; cần kiểm tra chương trình/đợt tuyển chọn kế tiếp.
- **Chương trình Hà Nội** (`seed_only`): Nguồn hiện là bối cảnh hệ sinh thái, chưa phải thông báo nhận hồ sơ.
- **Luật Đầu tư** (`needs_update`): Policy ưu đãi đầu tư được giữ để demo/roadmap, cần cập nhật theo Luật Đầu tư 2025/2026.
- **Chương trình 68 (hỗ trợ tài sản trí tuệ DN)** (`needs_verification`): 4 văn bản 2005-2006 (68/2005, 36/2006, 102/2006, 11/2006) nghi đã bị thay thế bởi QĐ 2205/QĐ-TTg (Chương trình đến 2030) — không đưa vào corpus, cần người có thẩm quyền xác minh trực tiếp trước khi cân nhắc lại.
- **`data/raw/vbpl/` batch — phần còn lại** (`out_of_scope`): 27 văn bản khác trong batch 47 văn bản đã trích xuất sạch nhưng lạc đề (Quỹ sắp xếp DNNN, lao động, quốc phòng, giao thông...) — cố ý không đưa vào. 9 văn bản còn cần OCR riêng.
- **`data/vbpl_expansion_candidates.json`** (`not_fetched`): 409 văn bản mới có metadata (tên, số hiệu, nguồn) từ lọc từ khóa vbpl.vn, chưa tải nội dung — pool mở rộng cho vòng sau.

## Citation Sources Not In Successful Crawl

- https://thuvienphapluat.vn/van-ban/Dau-tu/Luat-Dau-tu-2025-so-143-2025-QH15-681550.aspx
