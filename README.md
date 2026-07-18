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

### Biến môi trường (AI + Retrieval)

Toàn bộ tính năng AI trong app (đọc file/ảnh, đối chiếu checklist, phân tích chính sách, hỏi đáp pháp lý) và cả embedding cho retrieval đều đi qua **một API key duy nhất** — FPT.AI Marketplace (OpenAI-compatible: `POST {base_url}/chat/completions`, `/embeddings`, `/rerank`). Không còn BYOK (bring-your-own-key) — trước đây có nút "⚙ AI mặc định" cho người dùng tự nhập key/nhà cung cấp riêng, đã bỏ vì giờ chỉ dùng một API key chung.

Tạo file `.env` hoặc `.env.local` (đã gitignore, không commit) ở gốc repo:

```
CUSTOM_LLM_BASE_URL=https://mkp-api.fptcloud.com/v1
CUSTOM_LLM_API_KEY=<api-key-cua-ban>

QDRANT_URL=<qdrant-cluster-url>
QDRANT_API_KEY=<qdrant-api-key>
QDRANT_COLLECTION=grantpilot_corpus
```

Model được gán theo tác vụ (xem `lib/llmProviders.ts`), không phải một model chung cho tất cả:

| Tác vụ | Model | Dùng ở |
|---|---|---|
| OCR/đọc ảnh | `Qwen2.5-VL-7B-Instruct` (vision) | `app/api/ocr/route.ts`, `app/api/checklist-match/route.ts` |
| Trả lời chính (Q&A, phân tích chính sách) | `GLM-5.2` (reasoning model) | `app/api/qa/route.ts`, `app/api/recommend/route.ts` |
| Tác vụ nhẹ (trích xuất text tự do, lọc phạm vi câu hỏi) | `DeepSeek-V4-Flash` | nhánh AI-fallback của `.txt` trong `app/api/ocr/route.ts`, scope guard trong `app/api/qa/route.ts` |
| Embedding | `Vietnamese_Embedding` | `lib/retrieval.ts`, `scripts/build-embeddings.mjs` |
| Rerank | `bge-reranker-v2-m3` | `lib/retrieval.ts` |

`Hỏi đáp pháp lý` là một **hội thoại nhiều lượt** (không phải hỏi-đáp từng câu rời rạc) — mỗi câu hỏi tiếp theo trong cùng cuộc trò chuyện được hiểu theo ngữ cảnh các lượt trước, bấm "Cuộc trò chuyện mới" để bắt đầu lại. Trước khi truy hồi/sinh câu trả lời, một bước lọc phạm vi (model nhẹ, prompt chặt chẽ — xem `SCOPE_GUARD_INSTRUCTION` trong `app/api/qa/route.ts`) kiểm tra câu hỏi có thuộc phạm vi chính sách/pháp luật doanh nghiệp không; nếu rõ ràng ngoài phạm vi (thời tiết, chuyện phiếm...), trả lời từ chối ngắn ngay mà không chạy retrieval/model chính — tránh tốn tài nguyên và trả lời lan man cho câu hỏi không liên quan. Retrieval là hybrid thật (BM25 + dense embedding qua Qdrant Cloud + RRF + rerank, xem `lib/retrieval.ts`) — nếu thiếu `CUSTOM_LLM_API_KEY`/`QDRANT_URL`, retrieval tự rơi xuống nấc thấp hơn (BM25-only); nếu gọi LLM lỗi, route tự rơi về câu trả lời soạn sẵn (rule-based, không có nhận thức hội thoại) thay vì lỗi trắng trang.

Sau khi sửa `data/corpus.json`, phải chạy lại embedding + đẩy lại Qdrant trước khi build/deploy:

```powershell
npm run data:embed
npm run data:qdrant-upload
```

### Giải thích AI cho kết quả match

Bước 3 ("Kết quả đề xuất") tự động gọi `app/api/recommend/route.ts` ngay sau khi có kết quả rule-based — không cần bấm nút riêng. Route lấy kết quả `matchPolicies()` (điểm số/lý do/khoảng thiếu — vẫn rule-based, không đổi) rồi nhờ LLM (`GLM-5.2`) viết một đoạn giải thích ngắn cho từng chính sách theo prompt chặt chẽ (7 quy tắc đánh số: chỉ dùng dữ kiện đã cho, không tự kết luận đủ điều kiện khi rule-based ghi "Cần rà soát", phải nêu rõ các điểm ranh giới/mơ hồ cần người dùng tự xác minh — ví dụ năm thành lập gần ngưỡng ưu tiên). Kết quả hiện trực tiếp trên từng thẻ chính sách (badge "AI") song song với lý do rule-based, không thay thế. Parse JSON bằng regex tìm khối `[...]` trong text trả về — không có structured-output/schema-enforced JSON thật (API hiện dùng không hỗ trợ), nên mọi trường đều được validate/sanitize lại phía server trước khi dùng (ví dụ `policy_id` không khớp danh sách đã gửi sẽ bị lọc bỏ).

### Tra cứu hồ sơ bằng mã số thuế

Ô "Nhập mã số thuế" ở Bước 01 của "Tìm chính sách" gọi `app/api/tax-lookup/route.ts`, tra cứu tên + địa chỉ + tình trạng hoạt động thật qua API công khai VietQR (nguồn: Cục Thuế, không cần API key riêng). Điền tên và tỉnh/thành từ dữ liệu đăng ký thuế thật (không phải AI đoán) — các trường còn lại (lĩnh vực, lao động, doanh thu, vốn) vẫn cần nhập tay vì VietQR không cung cấp. Cùng một `profile` này cũng được dùng để cá nhân hoá câu trả lời ở "Hỏi đáp pháp lý" (xem dòng gợi ý trên ô hỏi).

### Đọc hồ sơ từ TXT / Word / Excel / ảnh (thật, không mock)

Ô upload hồ sơ nhận: `.txt` (parse trực tiếp theo mẫu `key: value`, tự chuyển sang AI nếu không khớp mẫu), `.docx`/`.xlsx`, hoặc ảnh JPG/PNG/WebP.

- **Word/Excel**: server trích xuất văn bản trước bằng `mammoth` (.docx) hoặc `exceljs` (.xlsx) — không dùng gói `xlsx`/SheetJS vì bản trên npm có lỗ hổng bảo mật mức cao (prototype pollution + ReDoS) chưa có bản vá, không phù hợp để parse file người dùng tải lên. Sau khi trích xuất, văn bản đi qua model nhẹ (`DeepSeek-V4-Flash`) — tác vụ trích xuất trường từ text, không cần model vision. **Chỉ hỗ trợ `.docx`/`.xlsx`** — định dạng cũ `.doc`/`.xls` (Word/Excel 2003 trở về trước) chưa hỗ trợ được, cần lưu lại thành định dạng mới trước khi tải lên.
- **Ảnh**: `app/api/ocr/route.ts` gọi vision LLM (`Qwen2.5-VL-7B-Instruct`) để đọc và điền các trường hồ sơ, kể cả năm thành lập nếu đọc được.
- **PDF chưa hỗ trợ trực tiếp** — model vision hiện dùng chỉ nhận ảnh raster qua `image_url` (khác Gemini trước đây, vốn nhận thẳng PDF qua `inlineData`). Tải PDF lên sẽ bị chặn ngay ở client kèm thông báo rõ ràng; cần chụp/xuất PDF thành ảnh (JPG/PNG) trước, hoặc dùng Word/Excel/TXT.

Mỗi lần tải file mới, hồ sơ ở Bước 2 được **reset về rỗng rồi mới điền** những trường đọc được — không merge lên hồ sơ đang có (tránh trường hợp trường không đọc được từ file mới vẫn giữ giá trị cũ từ hồ sơ mẫu/file trước, trông như thể đến từ file mới). Luôn kiểm tra lại kết quả trước khi dùng, vì đây là đọc thật bằng AI (có thể sai/thiếu), không phải rule cố định.

### Document Checklist — đối chiếu hồ sơ đã có/thiếu

Trong modal chi tiết một chính sách, mục "Checklist hồ sơ" có nút **"⇪ Tải tài liệu để AI đối chiếu"** — chọn nhiều ảnh tài liệu (JPG/PNG/WebP) cùng lúc, `app/api/checklist-match/route.ts` gọi vision LLM (`Qwen2.5-VL-7B-Instruct`) đọc từng ảnh và so khớp với từng mục trong checklist của chính sách đó, trả về ✓ đã có / ✗ thiếu / ? chưa rõ kèm giải thích ngắn. Giới hạn hiện tại: chỉ nhận ảnh (không nhận PDF, cùng lý do như phần đọc hồ sơ ở trên), và đây chỉ là gợi ý sơ bộ — không thay thế thẩm định hồ sơ thật.

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

Trên Render, tạo Blueprint hoặc Web Service từ GitHub repo này, rồi vào **Environment** thêm các biến sau (đã khai trong `render.yaml` với `sync: false` — nghĩa là bắt buộc set tay trong dashboard Render, không lưu giá trị thật vào file):

```
CUSTOM_LLM_API_KEY=<api-key-cua-ban>
QDRANT_URL=<qdrant-cluster-url>
QDRANT_API_KEY=<qdrant-api-key>
```

Nếu bỏ qua bước này, Q&A trên bản deploy sẽ luôn dùng fallback rule-based thay vì gọi LLM thật, và retrieval sẽ chỉ chạy BM25-only (không có dense/rerank). Sau khi build xong, Render sẽ cấp URL dạng `https://<service-name>.onrender.com`.

Lưu ý: `render.yaml` hiện dùng gói free — có rủi ro cold-start (xem mục dưới), chưa phù hợp để demo trước giám khảo nếu chưa xử lý.

## Cần bạn quyết định trước khi dùng thật

Việc dưới đây **không thể tự sửa bằng code** vì phát sinh chi phí — cần bạn tự quyết định và thực hiện:

**Cân nhắc đổi `render.yaml` khỏi gói free.** Gói free của Render bị cold-start (dịch vụ ngủ sau ~15 phút không hoạt động, lần gọi kế tiếp mất 30-60+ giây để thức dậy) — trải nghiệm xấu cho người dùng thật ghé lần đầu. Nếu chuyển sang gói trả phí, chỉ cần đổi `plan: free` → `plan: starter` (hoặc gói tương ứng) trong `render.yaml` rồi deploy lại.

## Luồng sử dụng nhanh

1. Ở `Tìm chính sách`, chọn hồ sơ mẫu `NovaMind AI`, bấm "Phân tích và tìm chính sách" — Bước 3 tự động chạy cả rule-based lẫn phân tích AI, không cần bấm thêm nút nào.
2. Bấm "Xem chi tiết" một chính sách để thấy citation, checklist, và nút "Xuất đơn .docx" (dùng được cho mọi chính sách có checklist, không chỉ Đề án 844).
3. Mở `Hỏi đáp pháp lý`, thử 1 câu hỏi vàng rồi hỏi tiếp một câu ngắn tham chiếu tới câu trả lời trước ("Trong số đó, mục nào bắt buộc nhất?") để thấy hội thoại giữ ngữ cảnh. Thử thêm một câu hỏi rõ ràng ngoài phạm vi (ví dụ "thời tiết hôm nay thế nào?") để thấy scope guard từ chối ngay, không chạy retrieval.
4. Chuyển hồ sơ mẫu sang `Cơ khí An Phát` để thấy kết quả ưu tiên SMEDF và chuỗi giá trị.
5. Thử upload `data/synthetic_dkkd_novamind.txt`/`data/synthetic_dkkd_anphat.txt` (parse `.txt` trực tiếp), hoặc một ảnh chụp/scan ĐKKD thật (JPG/PNG) để thử OCR bằng AI thật (PDF chưa hỗ trợ trực tiếp, xem mục "Đọc hồ sơ" ở trên).
6. Mở `Theo dõi cập nhật` để xem policy watch (nay có 23 tín hiệu) và trạng thái Monitoring Pipeline (lần quét gần nhất, số tin mới phát hiện) ở đầu trang.

## Dữ liệu seed

- `data/sample_profiles.json`: 2 hồ sơ demo.
- `data/policies.json`: rule matching, citation, checklist (8 chương trình — bao gồm 2 chương trình mới nhất cho khởi nghiệp sáng tạo: NĐ 268/2025 công nhận + hệ sinh thái, NĐ 38/2018 sửa đổi bởi NĐ 210/2025 về quỹ đầu tư khởi nghiệp sáng tạo).
- `data/corpus.json`: corpus Q&A theo điều/khoản (52 chunk — phần lớn curate tay từ đầu dự án, cộng thêm một số chunk merge tự động từ `scripts/merge_vbpl_extracted.py` đã qua soát lỗi thủ công trước khi giữ lại; xem `data/raw/vbpl/extraction_report.md` cho toàn bộ 99 file đã trích xuất, phần lớn chưa được merge vào corpus vì cần soát thêm).
- `data/corpus_embeddings.json`: embedding từng chunk — build lại bằng `npm run data:embed` sau khi sửa corpus, sau đó đẩy lên Qdrant Cloud bằng `npm run data:qdrant-upload` (`lib/retrieval.ts` query dense vector qua Qdrant, không load toàn bộ embedding vào bộ nhớ nữa — cần `QDRANT_URL`/`QDRANT_API_KEY`).
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

`Hỏi đáp pháp lý` gọi LLM thật qua FPT.AI Marketplace (xem "Biến môi trường" ở trên); matching cơ bản vẫn chạy rule-based phía client, phân tích sâu hơn ở Bước 3 mới gọi AI. Xem `grantpilot-ai-spec.md` mục 10 để biết chi tiết phần nào đã thật, phần nào còn giả lập/thiếu.

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
