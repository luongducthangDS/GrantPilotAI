# GrantPilot AI — Nội dung Pitch Deck

*Dùng để dựng slide nhanh trong 3h. Copy trực tiếp từng mục vào slide, không cần viết lại.*

---

## 1. Vấn đề (Problem)

- DNNVV/startup Việt Nam khó tiếp cận các chương trình hỗ trợ (Đề án 844, SMEDF, ưu đãi đầu tư, chương trình địa phương) vì: văn bản pháp lý phân tán, thường xuyên sửa đổi/bổ sung qua nhiều năm, khó biết văn bản nào còn hiệu lực.
- Không biết mình có thuộc diện DNNVV hay không (Điều 5 NĐ 80/2021 có ngưỡng phân loại phức tạp theo ngành, dễ tự đánh giá sai).
- Chuẩn bị hồ sơ (checklist giấy tờ, đơn đăng ký) tốn thời gian, dễ thiếu tài liệu, không có ai đối chiếu trước khi nộp.

## 2. Giải pháp (Solution)

**GrantPilot AI — Policy & Grant Navigator**: trợ lý AI giúp doanh nghiệp (1) tự động phân loại DNNVV đúng quy định, (2) đối chiếu hồ sơ với chính sách phù hợp có xếp hạng + giải thích AI, (3) hỏi đáp pháp lý nhiều lượt có trích dẫn nguồn, (4) đối chiếu tài liệu đã có với checklist bằng AI, (5) xuất đơn đăng ký .docx điền sẵn thông tin.

Khác biệt cốt lõi: **mọi câu trả lời đều gắn nguồn pháp lý cụ thể + trạng thái hiệu lực**, không suy đoán ngoài dữ liệu đã xác minh — không phải chatbot pháp lý chung chung.

## 3. Demo (luồng trình diễn)

1. Nhập hồ sơ doanh nghiệp (mẫu có sẵn, hoặc tra cứu bằng mã số thuế, hoặc upload TXT/Word/Excel/ảnh/PDF — AI tự trích xuất).
2. Bấm "Phân tích" → xếp hạng chính sách theo rule-based + AI giải thích sâu hơn theo từng chính sách.
3. Mở chi tiết 1 chính sách → xem checklist hồ sơ, upload ảnh giấy tờ → AI đối chiếu tự động (có/thiếu/chưa rõ).
4. Xuất đơn đăng ký .docx điền sẵn thông tin doanh nghiệp.
5. Tab Hỏi đáp: hỏi nhiều lượt liên tiếp ("Công ty tôi có phải DNNVV không?" → "còn tiêu chí nhóm Nhỏ thì sao?") — AI hiểu ngữ cảnh, luôn kèm trích dẫn nguồn hoặc báo rõ "ngoài phạm vi dữ liệu" thay vì bịa.

## 4. Kiến trúc (Architecture)

- **Retrieval**: hybrid BM25 + dense embedding (RRF fusion) trên corpus 35 đoạn văn bản pháp lý đã chunk theo điều/khoản.
- **Trích xuất hồ sơ**: vision AI đọc ảnh/PDF/Word/Excel (ĐKKD, KQKD) → JSON có schema ràng buộc, validate chặt (mã số thuế, tỉnh/ngành theo enum cố định) để tránh AI bịa/lệch trường.
- **Chấm điểm chính sách**: rule-based (minh bạch, không phụ thuộc AI) + lớp phân tích AI bổ sung phía trên, có prompt chống bịa rõ ràng.
- **Hỏi đáp**: RAG có lịch sử hội thoại multi-turn, retrieval fold cả câu hỏi lẫn câu trả lời trước để giữ đúng ngữ cảnh.
- **Dữ liệu nguồn**: 23 nguồn pháp lý đã xác minh (22 kiểm tra HTTP 200 thành công), 6 chính sách, 13 trích dẫn có căn cứ, 23 tín hiệu Policy Watch theo dõi thay đổi pháp lý theo thời gian thực.

## 5. An toàn AI & Độ tin cậy (nhấn mạnh mục này — đây là USP)

- Mọi câu trả lời AI chỉ dựa trên đoạn trích đã truy hồi — có rule bắt buộc "không đủ thông tin thì phải nói rõ", không suy đoán.
- Mỗi chính sách/trích dẫn đều gắn trạng thái hiệu lực (còn hiệu lực / hết hiệu lực một phần / cần xác minh) + link nguồn gốc để người dùng tự đối chiếu.
- Badge "Ngoài phạm vi dữ liệu" hiển thị rõ khi câu hỏi vượt ngoài corpus, không giả vờ trả lời chắc chắn.
- Disclaimer pháp lý rõ ràng: đây là công cụ sàng lọc ban đầu, không thay thế tư vấn pháp lý hoặc xác nhận của cơ quan có thẩm quyền.
- Minh bạch quyền riêng tư: nêu rõ dữ liệu nào xử lý tại chỗ (TXT đúng mẫu) và dữ liệu nào gửi qua AI máy chủ (ảnh/Word/Excel/PDF/checklist).

## 6. Lộ trình Pilot & Khả thi kinh doanh

**Khách hàng mục tiêu (giai đoạn pilot):** startup/DNNVV lĩnh vực phần mềm/AI, công nghệ cao tại Hà Nội đang tìm hiểu Đề án 844, SMEDF, ưu đãi đầu tư — nhóm này có nhu cầu tra cứu chính sách cao và đã có đủ dữ liệu pháp lý xác minh trong hệ thống.

**Mô hình pilot đề xuất:**
- Hợp tác với NIC (National Innovation Center) hoặc trung tâm hỗ trợ DNNVV địa phương làm kênh phân phối — tích hợp GrantPilot AI như công cụ sàng lọc hồ sơ trước khi doanh nghiệp nộp hồ sơ thật tới các chương trình họ quản lý.
- Giai đoạn 1 (0-3 tháng): pilot miễn phí với 20-30 doanh nghiệp qua NIC/vườn ươm, thu thập phản hồi độ chính xác phân loại DNNVV và mức độ hữu ích của checklist.
- Giai đoạn 2 (3-6 tháng): mở rộng corpus sang các chương trình khác (thuế, chuyển đổi số, xuất khẩu), thêm địa phương ngoài Hà Nội.

**Hướng thu phí sau pilot:**
- B2B2C: thu phí từ tổ chức hỗ trợ (NIC, vườn ươm, sở KH&CN địa phương) theo gói SaaS/lượt hồ sơ, thay vì thu trực tiếp từ doanh nghiệp nhỏ (giảm rào cản tiếp cận).
- Gói nâng cao cho đơn vị tư vấn pháp lý/kế toán: bulk xử lý nhiều hồ sơ khách hàng, xuất báo cáo.

**Vì sao khả thi:** hạ tầng dữ liệu (23 nguồn xác minh, quy trình theo dõi Policy Watch tự động) và kỹ thuật (RAG có kiểm soát, multi-provider LLM) đã sẵn sàng để mở rộng corpus sang lĩnh vực/địa phương khác mà không cần đổi kiến trúc.
