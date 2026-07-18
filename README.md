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

Lấy API key tại [Google AI Studio](https://aistudio.google.com/apikey). Retrieval là hybrid thật (BM25 + dense embedding + RRF, xem `lib/retrieval.ts`) — nếu thiếu `GEMINI_API_KEY`, retrieval tự rơi về BM25-only; nếu gọi LLM lỗi (quota/network), route tự rơi về câu trả lời soạn sẵn (rule-based) thay vì lỗi trắng trang — nhưng khi đó Q&A không còn là RAG thật, chỉ là fallback demo.

Sau khi sửa `data/corpus.json`, phải chạy lại embedding trước khi build/deploy, nếu không dense retrieval sẽ dùng embedding cũ (id không khớp sẽ tự bị bỏ qua, không lỗi, nhưng chunk mới sẽ chỉ được tìm thấy qua BM25):

```powershell
npm run data:embed
```

### Chọn nhà cung cấp AI khác (bring-your-own-key)

Ngoài cấu hình mặc định của máy chủ (`GEMINI_API_KEY` ở trên), người dùng có thể tự chọn nhà cung cấp và nhập API key riêng ngay trên giao diện — bấm nút **⚙ AI mặc định** ở góc trên bên phải (hoặc "Đổi AI →" trong màn `Hỏi đáp pháp lý`). Hỗ trợ 4 nhà cung cấp:

- **Google Gemini** — `@google/genai`, model mặc định `gemini-2.5-flash`.
- **OpenAI** — Chat Completions API (`https://api.openai.com/v1/chat/completions`), model mặc định `gpt-4o-mini`.
- **Anthropic Claude** — Messages API (`https://api.anthropic.com/v1/messages`), model mặc định `claude-sonnet-4-5`.
- **xAI Grok** — API tương thích OpenAI (`https://api.x.ai/v1/chat/completions`), model mặc định `grok-4-fast`.

Key được lưu trong `localStorage` của trình duyệt (client-side), **không lưu trên máy chủ** — chỉ gửi kèm theo mỗi lần gọi `/api/qa` để route dùng cho đúng lần gọi đó rồi bỏ qua. Bỏ trống API key rồi lưu để xoá cấu hình riêng và quay lại dùng `GEMINI_API_KEY` mặc định của máy chủ (nếu có). Retrieval (BM25 + dense) không đổi theo lựa chọn này — vẫn luôn dùng embedding Gemini đã precompute trong `data/corpus_embeddings.json`, chỉ có bước sinh câu trả lời cuối cùng là đổi theo nhà cung cấp bạn chọn.

Xem `lib/llmProviders.ts` để biết chi tiết cách gọi từng nhà cung cấp.

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
6. Mở `Theo dõi cập nhật` để xem policy watch (nay có 14 tín hiệu, gồm cả các văn bản mới phát hiện qua crawl vbpl.vn/chinhphu.vn).

## Dữ liệu seed

- `data/sample_profiles.json`: 2 hồ sơ demo.
- `data/policies.json`: rule matching, citation, checklist.
- `data/corpus.json`: corpus Q&A theo điều/khoản (35 chunk).
- `data/corpus_embeddings.json`: embedding từng chunk (`gemini-embedding-001`), dùng cho dense retrieval — build lại bằng `npm run data:embed` sau khi sửa corpus.
- `data/policy_watch.json`: policy watch (14 mục, có cả mock lẫn văn bản thật đã crawl).
- `data/vbpl_expansion_candidates.json`: ~400 văn bản từ vbpl.vn đã lọc theo domain nhưng chưa đưa vào corpus — pool mở rộng cho vòng sau.
- `data/chinhphu_all_urls.json`, `data/chinhphu_relevant_articles.json`: snapshot crawl từ xaydungchinhsach.chinhphu.vn.
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
