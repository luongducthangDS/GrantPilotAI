# GrantPilot AI MVP

Demo Next.js cho bài toán Policy & Grant Navigator: nhập hồ sơ doanh nghiệp, match chính sách/quỹ, hỏi đáp pháp lý có citation, tạo checklist và xuất đơn `.docx` cho Đề án 844.

## Chạy local bằng Next.js

```powershell
npm install
npm run dev
```

Mở `http://localhost:3000`.

Build production:

```powershell
npm run build
npm run start -- -p 3000
```

### Biến môi trường (RAG Q&A)

`Hỏi đáp pháp lý` gọi Gemini thật qua route `/api/qa`. Tạo file `.env.local` (đã gitignore, không commit) ở gốc repo:

```
GEMINI_API_KEY=<api-key-cua-ban>
GEMINI_MODEL=gemini-2.5-flash
```

Lấy API key tại [Google AI Studio](https://aistudio.google.com/apikey). Nếu thiếu `GEMINI_API_KEY` hoặc lỗi gọi API (quota/network), route tự động rơi về câu trả lời soạn sẵn (rule-based) thay vì lỗi trắng trang — nhưng khi đó Q&A không còn là RAG thật, chỉ là fallback demo.

## Deploy Render

Repo đã có `render.yaml` cho Render Web Service:

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Node version: `22`

Trên Render, tạo Blueprint hoặc Web Service từ GitHub repo này, rồi vào **Environment** thêm biến `GEMINI_API_KEY` (và tuỳ chọn `GEMINI_MODEL`) — nếu bỏ qua bước này, Q&A trên bản deploy sẽ luôn dùng fallback rule-based thay vì gọi LLM thật. Sau khi build xong, Render sẽ cấp URL dạng `https://<service-name>.onrender.com`.

Lưu ý: `render.yaml` hiện dùng gói free — có rủi ro cold-start đã ghi trong `grantpilot-ai-spec.md` mục 10.2/10.3, chưa phù hợp để demo trước giám khảo nếu chưa xử lý.

## Luồng demo nhanh

1. Ở `Tìm chính sách`, chọn hồ sơ mẫu `NovaMind AI`, bấm "Phân tích và tìm chính sách".
2. Bấm "Xem chi tiết" một chính sách để thấy citation, checklist và nút "Xuất đơn .docx" (dùng được cho mọi chính sách có checklist, không chỉ Đề án 844).
3. Mở `Hỏi đáp pháp lý`, thử 10 câu hỏi vàng.
4. Chuyển hồ sơ mẫu sang `Cơ khí An Phát` để thấy kết quả ưu tiên SMEDF và chuỗi giá trị.
5. Thử upload `data/synthetic_dkkd_novamind.txt` hoặc `data/synthetic_dkkd_anphat.txt` vào ô "Thả hồ sơ TXT" (OCR mock).
6. Mở `Theo dõi cập nhật` để xem policy watch (nay có 10 tín hiệu, gồm cả các văn bản mới phát hiện qua crawl vbpl.vn/chinhphu.vn).

## Dữ liệu seed

- `data/sample_profiles.json`: 2 hồ sơ demo.
- `data/policies.json`: rule matching, citation, checklist.
- `data/corpus.json`: corpus Q&A theo điều/khoản.
- `data/policy_watch.json`: policy watch mock.
- `data/source_verification.md`: nhật ký kiểm chứng URL/source dùng trong demo.
- `data/verified_sources.json`: danh sách nguồn đã xác thực để crawl.
- `data/crawled_sources.json`: snapshot crawl đã làm sạch từ nguồn xác thực.
- `data/grantpilot.db`: SQLite database build từ seed + crawl.
- `data/database_manifest.json`: số lượng bản ghi và trạng thái coverage.
- `data/coverage_report.md`: các mảng dữ liệu còn thiếu/cần xác minh.

`Hỏi đáp pháp lý` gọi Gemini thật (xem "Biến môi trường" ở trên); matching và các phần còn lại vẫn chạy rule-based phía client. Xem `grantpilot-ai-spec.md` mục 10 để biết chi tiết phần nào đã thật, phần nào còn giả lập/thiếu.

Refresh database:

```powershell
npm run data:refresh
```

## Bản Streamlit dự phòng

Các file Python cũ vẫn được giữ để dự phòng:

```powershell
pip install -r requirements.txt
streamlit run app.py
```
