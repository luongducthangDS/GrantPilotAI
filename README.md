# GrantPilot AI MVP

Demo Next.js cho bài toán Policy & Grant Navigator: nhập hồ sơ doanh nghiệp (kể cả OCR từ ảnh ĐKKD/KQKD), match chính sách/quỹ có giải thích bằng AI, hỏi đáp pháp lý có citation (RAG thật), tạo checklist, xuất đơn `.docx` cho Đề án 844, và theo dõi chính sách mới qua pipeline crawl theo lịch.

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

### Biến môi trường (RAG Q&A hội thoại)

`Hỏi đáp pháp lý` là một **hội thoại nhiều lượt** (không phải hỏi-đáp từng câu rời rạc) — mỗi câu hỏi tiếp theo trong cùng cuộc trò chuyện được hiểu theo ngữ cảnh các lượt trước (không cần lặp lại thông tin), bấm "Cuộc trò chuyện mới" để bắt đầu lại. Gọi Gemini thật qua route `/api/qa`. Tạo file `.env.local` (đã gitignore, không commit) ở gốc repo:

```
GEMINI_API_KEY=<api-key-cua-ban>
GEMINI_MODEL=gemini-2.5-flash
```

Lấy API key tại [Google AI Studio](https://aistudio.google.com/apikey). Retrieval là hybrid thật (BM25 + dense embedding + RRF, xem `lib/retrieval.ts`) — nếu thiếu `GEMINI_API_KEY`, retrieval tự rơi về BM25-only; nếu gọi LLM lỗi (quota/network), route tự rơi về câu trả lời soạn sẵn (rule-based, không có nhận thức hội thoại) thay vì lỗi trắng trang — nhưng khi đó Q&A không còn là RAG thật, chỉ là phương án dự phòng cuối cùng.

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

Key được lưu trong `localStorage` của trình duyệt (client-side), **không lưu trên máy chủ** — chỉ gửi kèm theo mỗi lần gọi route (`/api/qa`, `/api/recommend`, `/api/ocr`) để route dùng cho đúng lần gọi đó rồi bỏ qua. Bỏ trống API key rồi lưu để xoá cấu hình riêng và quay lại dùng `GEMINI_API_KEY` mặc định của máy chủ (nếu có). Retrieval (BM25 + dense) không đổi theo lựa chọn này — vẫn luôn dùng embedding Gemini đã precompute trong `data/corpus_embeddings.json`, chỉ có bước sinh câu trả lời/giải thích/đọc ảnh cuối cùng là đổi theo nhà cung cấp bạn chọn.

Xem `lib/llmProviders.ts` để biết chi tiết cách gọi từng nhà cung cấp (kể cả `generateVisionAnswer` cho OCR).

### Giải thích AI cho kết quả match

Ở modal chi tiết một chính sách (sau khi bấm "Xem chi tiết"), nút **"✦ Phân tích sâu hơn bằng AI"** gọi `app/api/recommend/route.ts`: lấy kết quả `matchPolicies()` (điểm số/lý do/khoảng thiếu — vẫn rule-based, không đổi) rồi nhờ LLM viết một đoạn giải thích ngắn, chỉ dựa trên dữ kiện đã có (không tự thêm căn cứ pháp lý mới). Gọi on-demand, không tự động chạy khi phân tích hồ sơ, để không tốn quota cho thao tác lọc/sắp xếp chính.

### Tra cứu hồ sơ bằng mã số thuế

Ô "Nhập mã số thuế" ở Bước 01 của "Tìm chính sách" gọi `app/api/tax-lookup/route.ts`, tra cứu tên + địa chỉ + tình trạng hoạt động thật qua API công khai VietQR (nguồn: Cục Thuế, không cần API key riêng). Điền tên và tỉnh/thành từ dữ liệu đăng ký thuế thật (không phải AI đoán) — các trường còn lại (lĩnh vực, lao động, doanh thu, vốn) vẫn cần nhập tay vì VietQR không cung cấp. Cùng một `profile` này cũng được dùng để cá nhân hoá câu trả lời ở "Hỏi đáp pháp lý" (xem dòng gợi ý trên ô hỏi).

### Đọc hồ sơ từ TXT / Word / Excel / ảnh / PDF (thật, không mock)

Ô upload hồ sơ nhận: `.txt` (parse trực tiếp theo mẫu `key: value`, tự chuyển sang AI nếu không khớp mẫu), `.docx`/`.xlsx`, ảnh JPG/PNG/WebP, hoặc PDF.

- **Word/Excel**: server trích xuất văn bản trước bằng `mammoth` (.docx) hoặc `exceljs` (.xlsx) — không dùng gói `xlsx`/SheetJS vì bản trên npm có lỗ hổng bảo mật mức cao (prototype pollution + ReDoS) chưa có bản vá, không phù hợp để parse file người dùng tải lên. Sau khi trích xuất, văn bản đi qua đúng luồng AI như đường `.txt` fallback (không cần model có khả năng đọc ảnh). **Chỉ hỗ trợ `.docx`/`.xlsx`** — định dạng cũ `.doc`/`.xls` (Word/Excel 2003 trở về trước) chưa hỗ trợ được, cần lưu lại thành định dạng mới trước khi tải lên.
- **Ảnh/PDF**: `app/api/ocr/route.ts` gọi vision LLM để đọc và điền các trường hồ sơ, kể cả năm thành lập nếu đọc được. Với nhà cung cấp Google Gemini, route dùng structured output (`responseSchema`) thay vì tự dò JSON trong text tự do, đáng tin cậy hơn. **PDF chỉ đọc trực tiếp được qua Gemini** (OpenAI/Anthropic không nhận PDF qua content block ảnh) — nếu bạn chọn nhà cung cấp khác mà tải PDF lên, server tự chuyển sang `GEMINI_API_KEY` của máy chủ nếu có, không thì báo lỗi rõ ràng để bạn đổi sang ảnh hoặc đổi nhà cung cấp.

Luôn kiểm tra lại kết quả trước khi dùng, vì đây là đọc thật bằng AI (có thể sai/thiếu), không phải rule cố định.

### Document Checklist — đối chiếu hồ sơ đã có/thiếu

Trong modal chi tiết một chính sách, mục "Checklist hồ sơ" có nút **"⇪ Tải tài liệu để AI đối chiếu"** — chọn nhiều ảnh tài liệu (JPG/PNG/WebP) cùng lúc, `app/api/checklist-match/route.ts` gọi vision LLM đọc từng ảnh và so khớp với từng mục trong checklist của chính sách đó, trả về ✓ đã có / ✗ thiếu / ? chưa rõ kèm giải thích ngắn — đúng luồng "AI Document Assistant" cho việc chuẩn bị hồ sơ, không chỉ dừng ở đọc PDF trả lời câu hỏi. Giới hạn hiện tại: chỉ nhận ảnh (chưa nhận PDF nhiều trang trực tiếp), và đây chỉ là gợi ý sơ bộ — không thay thế thẩm định hồ sơ thật.

### Monitoring Pipeline (theo dõi chính sách theo lịch, không phải real-time)

Kiến trúc hiện tại (Next.js API route trên Render) không có process/scheduler thường trú, và việc crawl cần Python + trình duyệt thật (Playwright) — không chạy được trong route Node.js. Vì vậy phần "theo dõi chính sách" chạy như một pipeline theo lịch, không phải stream real-time:

```powershell
npm run data:watch
```

`scripts/refresh_policy_watch.py` sẽ: (1) crawl lại 23 nguồn đã xác thực và so khớp độ tương đồng nội dung với lần crawl trước (không phải so hash tuyệt đối — một số trang `vanban.chinhphu.vn/?docid=` có widget "văn bản liên quan" xoay ngẫu nhiên, khiến hash tuyệt đối báo sai "đổi" ở gần như mọi lần); (2) quét chuyên mục chinhphu.vn tìm bài mới liên quan chính sách/doanh nghiệp (yêu cầu tín hiệu mạnh — có số hiệu văn bản pháp luật hoặc ≥2 từ khoá — vì bước này ghi thẳng vào `policy_watch.json` không qua người duyệt); (3) ghi báo cáo `data/policy_watch_refresh_report.md`. Thêm `--skip-sweep` để chỉ kiểm tra 23 nguồn, bỏ qua bước quét bài mới (không cần Playwright).

Để chạy tự động theo lịch, dùng `.github/workflows/refresh-data.yml` (cron hằng ngày + có thể bấm chạy tay qua tab Actions) — workflow **mở Pull Request** thay vì tự đẩy thẳng vào `main`, để có bước người duyệt trước khi merge (cần bật "Allow GitHub Actions to create and approve pull requests" trong Settings > Actions của repo). UI đọc trạng thái lần chạy gần nhất qua `GET /api/policy-watch/status` (chỉ đọc file báo cáo, không tự crawl) và hiển thị ở đầu tab "Theo dõi cập nhật".

## Deploy Render

Repo đã có `render.yaml` cho Render Web Service:

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Node version: `22`

Trên Render, tạo Blueprint hoặc Web Service từ GitHub repo này, rồi vào **Environment** thêm biến `GEMINI_API_KEY` (và tuỳ chọn `GEMINI_MODEL`) — nếu bỏ qua bước này, Q&A trên bản deploy sẽ luôn dùng fallback rule-based thay vì gọi LLM thật. Sau khi build xong, Render sẽ cấp URL dạng `https://<service-name>.onrender.com`.

Lưu ý: `render.yaml` hiện dùng gói free — có rủi ro cold-start đã ghi trong `grantpilot-ai-spec.md` mục 10.2/10.3, chưa phù hợp để demo trước giám khảo nếu chưa xử lý.

## Cần bạn quyết định trước khi dùng thật

Hai việc dưới đây **không thể tự sửa bằng code** vì phát sinh chi phí/cần quyền truy cập tài khoản thanh toán — cần bạn tự quyết định và thực hiện:

1. **Nâng cấp `GEMINI_API_KEY` khỏi free tier.** Free tier chỉ cho **20 request/ngày** cho `gemini-2.5-flash` — đã cạn nhiều lần chỉ trong lúc phát triển/test, với người dùng thật con số này sẽ hết trong vài phút. Nâng cấp gói trả phí tại [Google AI Studio](https://aistudio.google.com/apikey) hoặc Google Cloud Console. Trong lúc chưa nâng cấp, người dùng có thể tự nhập API key riêng của họ qua "⚙ AI mặc định" để không dùng chung quota với server.
2. **Cân nhắc đổi `render.yaml` khỏi gói free.** Gói free của Render bị cold-start (dịch vụ ngủ sau ~15 phút không hoạt động, lần gọi kế tiếp mất 30-60+ giây để thức dậy) — trải nghiệm xấu cho người dùng thật ghé lần đầu. Nếu chuyển sang gói trả phí, chỉ cần đổi `plan: free` → `plan: starter` (hoặc gói tương ứng) trong `render.yaml` rồi deploy lại.

## Luồng sử dụng nhanh

1. Ở `Tìm chính sách`, chọn hồ sơ mẫu `NovaMind AI`, bấm "Phân tích và tìm chính sách".
2. Bấm "Xem chi tiết" một chính sách để thấy citation, checklist, nút "✦ Phân tích sâu hơn bằng AI" (giải thích LLM) và nút "Xuất đơn .docx" (dùng được cho mọi chính sách có checklist, không chỉ Đề án 844).
3. Mở `Hỏi đáp pháp lý`, thử 1 câu hỏi vàng rồi hỏi tiếp một câu ngắn tham chiếu tới câu trả lời trước ("Trong số đó, mục nào bắt buộc nhất?") để thấy hội thoại giữ ngữ cảnh.
4. Chuyển hồ sơ mẫu sang `Cơ khí An Phát` để thấy kết quả ưu tiên SMEDF và chuỗi giá trị.
5. Thử upload `data/synthetic_dkkd_novamind.txt`/`data/synthetic_dkkd_anphat.txt` (parse `.txt` trực tiếp), hoặc một ảnh chụp/scan ĐKKD thật (JPG/PNG) để thử OCR bằng AI thật.
6. Mở `Theo dõi cập nhật` để xem policy watch (nay có 23 tín hiệu) và trạng thái Monitoring Pipeline (lần quét gần nhất, số tin mới phát hiện) ở đầu trang.

## Dữ liệu seed

- `data/sample_profiles.json`: 2 hồ sơ demo.
- `data/policies.json`: rule matching, citation, checklist (8 chương trình — bao gồm 2 chương trình mới nhất cho khởi nghiệp sáng tạo: NĐ 268/2025 công nhận + hệ sinh thái, NĐ 38/2018 sửa đổi bởi NĐ 210/2025 về quỹ đầu tư khởi nghiệp sáng tạo).
- `data/corpus.json`: corpus Q&A theo điều/khoản (35 chunk).
- `data/corpus_embeddings.json`: embedding từng chunk (`gemini-embedding-001`), dùng cho dense retrieval — build lại bằng `npm run data:embed` sau khi sửa corpus.
- `data/policy_watch.json`: policy watch (23 mục — mock ban đầu, văn bản crawl thủ công, và tin phát hiện qua Monitoring Pipeline).
- `data/policy_watch_refresh_report.md`: báo cáo lần chạy `scripts/refresh_policy_watch.py` gần nhất (nguồn nào đổi/lỗi, tin mới nào được thêm).
- `data/vbpl_expansion_candidates.json`: ~400 văn bản từ vbpl.vn đã lọc theo domain nhưng chưa đưa vào corpus — pool mở rộng cho vòng sau.
- `data/raw/chinhphu_all_urls.json`: URL thô đã loại trùng từ xaydungchinhsach.chinhphu.vn.
- `data/processed/chinhphu_relevant_articles.json`: bài liên quan đã chuẩn hóa, gắn content hash và loại trùng.
- `data/source_verification.md`: nhật ký kiểm chứng URL/source dùng trong demo.
- `data/verified_sources.json`: danh sách nguồn đã xác thực để crawl.
- `data/raw/verified_source_pages.json`: nội dung thô từ các nguồn xác thực.
- `data/processed/crawled_sources.json`: snapshot đã làm sạch, gắn content hash và loại trùng.
- `data/processed/grantpilot.db`: SQLite database build từ seed + crawl.
- `data/processed/database_manifest.json`: số lượng bản ghi và trạng thái coverage.
- `data/processed/coverage_report.md`: các mảng dữ liệu còn thiếu/cần xác minh.

`Hỏi đáp pháp lý` gọi Gemini thật (xem "Biến môi trường" ở trên); matching và các phần còn lại vẫn chạy rule-based phía client. Xem `grantpilot-ai-spec.md` mục 10 để biết chi tiết phần nào đã thật, phần nào còn giả lập/thiếu.

Refresh database:

```powershell
pip install -r requirements.txt
playwright install chromium
npm run data:refresh
```

Các crawler hỗ trợ retry và timeout qua tham số `--retries`, `--timeout`. Chạy
`npm run data:crawl-policy` cho nguồn Chính phủ, `npm run data:filter-vbpl` cho
VBPL (ghi vào `data/processed/vbpl_grantpilot_slice.jsonl`, được gitignore vì có
thể rất lớn) và `npm run data:test` để kiểm tra các hàm chuẩn hóa/khử trùng mà
không gọi mạng.

## Bản Streamlit dự phòng

Các file Python cũ vẫn được giữ để dự phòng:

```powershell
pip install -r requirements.txt
streamlit run app.py
```

## Bộ 47 văn bản VBPL về hỗ trợ doanh nghiệp

File xuất chính thức từ `vbpl.vn` được lưu tại
`data/raw/vbpl/vbpl_ho_tro_doanh_nghiep_trung_uong_con_hieu_luc.xlsx`. Bộ lọc nguồn
là từ khóa `hỗ trợ doanh nghiệp`, tìm trong `Tiêu đề`, phạm vi `Trung ương` và tình
trạng `Còn hiệu lực`.

Tải lại toàn bộ văn bản gốc và phụ lục bằng:

```powershell
npm run data:crawl-vbpl-official
```

Crawler tự dò giao diện tải hiện hành của VBPL, có retry/timeout, tiếp tục từ file
đã tải, kiểm tra kích thước, tạo SHA-256 và đánh dấu tệp trùng. File nhị phân nằm
trong `data/raw/vbpl/files/` (không đưa vào Git); inventory thô và manifest đã xử lý
được lưu lần lượt trong `data/raw/vbpl/attachment_inventory.json` và
`data/processed/vbpl_ho_tro_doanh_nghiep_manifest.json`.

Ứng dụng Next.js đọc manifest qua `GET /api/vbpl` để cung cấp tab **Thư viện
VBPL**. Tab này cho phép tìm theo tiêu đề/số hiệu, lọc loại văn bản và tải đủ các
tệp/phụ lục trực tiếp từ máy chủ VBPL. Metadata của 47 văn bản cũng được bổ sung
vào BM25 của phần hỏi đáp pháp lý; nội dung toàn văn vẫn phải được kiểm tra tại
nguồn chính thức trước khi kết luận điều kiện áp dụng.
