# Chuẩn bị hỏi đáp với giám khảo

## Emergent Judge — "Giải pháp có phù hợp & khả thi xây trong 48h không?"

**Q: Sản phẩm này thực sự demo được hay chỉ mockup?**
A: Toàn bộ luồng chạy thật — nhập hồ sơ, phân tích, checklist AI, xuất docx, hỏi đáp — không có màn hình giả lập. Video demo quay trực tiếp trên bản chạy thật.

**Q: Phạm vi có hợp lý với 48h không?**
A: Có — tận dụng hạ tầng RAG + multi-format extraction đã xây trước, 48h tập trung vào: mở rộng corpus (23 nguồn), sửa các lỗi phát hiện qua kiểm thử (phân loại DNNVV, trộn dữ liệu hồ sơ, retrieval multi-turn), và hoàn thiện demo/pitch.

## BA Judge — "Có khách hàng thật, luồng cốt lõi hoàn thiện, giao diện AI-native chưa?"

**Q: Khách hàng mục tiêu là ai, cụ thể thế nào?**
A: Startup/DNNVV lĩnh vực phần mềm-AI, công nghệ cao tại Hà Nội đang cần tra cứu Đề án 844, SMEDF, ưu đãi đầu tư — nhóm đã có dữ liệu pháp lý xác minh đầy đủ nhất trong hệ thống hiện tại (xem `pitch-content.md` mục 6).

**Q: Luồng sử dụng cốt lõi đã hoàn thiện chưa?**
A: Đã hoàn thiện end-to-end: nhập hồ sơ (4 cách: mẫu / tra MST / upload / gõ tay) → phân tích xếp hạng → xem chi tiết + checklist đối chiếu AI → xuất đơn → hỏi đáp multi-turn.

**Q: Giao diện thể hiện tính AI-native ở đâu, cụ thể?**
A: Nguồn trích dẫn gắn trạng thái hiệu lực trên từng câu trả lời; badge "Ngoài phạm vi dữ liệu" khi AI không đủ căn cứ thay vì im lặng hoặc bịa; checklist có 3 trạng thái AI đối chiếu (có/thiếu/chưa rõ) kèm giải thích; ghi chú AI phân tích sâu xuất hiện dạng streaming ngay dưới từng kết quả rule-based.

## Senior Judge — "Khả năng triển khai thực tế, đổi mới/USP, tiềm năng thương mại?"

**Q: Khác gì một chatbot pháp lý thông thường (VD: ChatGPT + đọc luật)?**
A: 3 điểm khác: (1) retrieval được kiểm soát trên corpus đã xác minh nguồn + trạng thái hiệu lực, không phải kiến thức chung của LLM; (2) rule-based scoring minh bạch, AI chỉ là lớp giải thích bổ sung phía trên chứ không tự quyết điểm; (3) pipeline theo dõi cập nhật pháp lý tự động (Policy Watch) để corpus không bị lỗi thời.

**Q: Tiềm năng thương mại ra sao, ai trả tiền?**
A: Mô hình B2B2C — thu phí từ tổ chức trung gian (NIC, vườn ươm, sở KH&CN, đơn vị tư vấn) theo gói SaaS/lượt hồ sơ thay vì thu trực tiếp từ DNNVV nhỏ lẻ (giảm rào cản áp dụng, đúng đối tượng có ngân sách).

**Q: Rủi ro lớn nhất của giải pháp là gì?**
A: Rủi ro dữ liệu lỗi thời/thiếu văn bản sửa đổi — đã giảm thiểu bằng Policy Watch tự động quét nguồn chính thống + log xác minh (`source_verification.md`) minh bạch cho từng nguồn. Rủi ro thứ hai là độ chính xác của AI trích xuất hồ sơ từ ảnh/PDF — đã giảm bằng schema ràng buộc + validate chặt (mã số thuế, enum tỉnh/ngành) và luôn yêu cầu người dùng xác nhận lại trước khi dùng.

**Q: Vì sao tin tưởng AI này không bịa thông tin pháp lý?**
A: System prompt bắt buộc "chỉ trả lời dựa trên đoạn trích được cung cấp", có quy tắc nói rõ "không đủ thông tin" thay vì suy đoán, và test thực tế cho thấy khi hỏi câu ngoài phạm vi (VD: miễn thuế hoàn toàn) hệ thống từ chối kết luận thay vì bịa — sẽ demo trực tiếp phần này trong video.

## Điểm cần tránh khi trả lời
- Không nói "AI tự động hoàn toàn" — luôn nhấn "AI hỗ trợ sàng lọc ban đầu, người dùng/luật sư vẫn cần xác nhận trước khi nộp hồ sơ thật" — đúng tinh thần disclaimer đã có trong sản phẩm, tránh bị hỏi xoáy về trách nhiệm pháp lý.
- Không claim phủ toàn bộ chính sách hỗ trợ DNNVV Việt Nam — nói rõ phạm vi hiện tại (6 chính sách, tập trung Hà Nội + toàn quốc cho 1 số chương trình) và lộ trình mở rộng.
