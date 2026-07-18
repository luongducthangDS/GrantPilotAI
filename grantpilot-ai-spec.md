# GrantPilot AI — Bản đặc tả dự án (VAIC 2026, 48h)

**Đề bài:** Policy & Grant Navigator — National Innovation Center (NIC), track Đổi mới Sáng tạo.
**Ngày:** 17–19/07/2026 · **Trạng thái:** Đã chốt scope, sẵn sàng thực thi.

---

## 1. Vấn đề & Mục tiêu bài toán

### Vấn đề
Doanh nghiệp nhỏ và khởi nghiệp tại Việt Nam muốn biết mình được hưởng chính sách hỗ trợ, ưu đãi hay nguồn tài trợ nào phải tự đọc hàng chục luật, nghị định, thông tư phân tán trên nhiều cổng thông tin — với ngôn ngữ pháp lý khó tiếp cận và không có cách nào biết văn bản còn hiệu lực hay đã bị thay thế. Hệ quả: phần lớn doanh nghiệp bỏ lỡ hỗ trợ mà họ đủ điều kiện hưởng, hoặc phải trả phí tư vấn cao.

### Mục tiêu (định nghĩa thành công của demo)
1. **Match đúng:** Từ hồ sơ doanh nghiệp (nhập tay hoặc bóc từ giấy tờ), hệ thống trả về danh sách chính sách/quỹ phù hợp **kèm căn cứ pháp lý cụ thể (điều, khoản) và trạng thái hiệu lực** — đúng 2/2 profile demo.
2. **Trả lời chắc:** Q&A pháp lý đạt **10/10 câu hỏi vàng** trả lời đúng có trích dẫn; RAGAS faithfulness ≥ 0.85 trên bộ test nội bộ.
3. **Đi đến hồ sơ:** Với ít nhất 1 quỹ (Đề án 844), sinh được checklist giấy tờ + đơn đăng ký điền sẵn từ profile, xuất `.docx`.
4. **Chạy public:** URL triển khai hoạt động ổn định suốt thời gian chấm, phản hồi Q&A < 10s.

### Non-goals (v1 hackathon — chống scope creep)
- **Không** phủ FDI và doanh nghiệp CNC bằng dữ liệu thật — chỉ thể hiện qua schema và roadmap (lý do: sâu > rộng trong 48h).
- **Không** build crawler tự động tổng quát — corpus curate tay (lý do: chất lượng metadata quyết định chất lượng matching).
- **Không** làm policy watch backend thật — mock màn hình với dữ liệu seed (lý do: nhường giờ cho OCR pre-fill và grant assist).
- **Không** tư vấn pháp lý thay luật sư — mọi câu trả lời kèm disclaimer và link văn bản gốc.

---

## 2. Đối tượng hướng tới

| Persona | Vai trò trong demo | Ghi chú |
|---|---|---|
| **Startup công nghệ / DNNVV khởi nghiệp sáng tạo** (VD: công ty phần mềm Hà Nội, 25 nhân sự, DT 8 tỷ) | **Persona chính** — chạy trọn demo script | Khớp hệ sinh thái của NIC; có quỹ thật để demo phần hồ sơ |
| DNNVV sản xuất | Persona dự phòng khi giám khảo test case khác | Bộ giấy tờ synthetic thứ 2 |
| FDI, doanh nghiệp công nghệ cao | Roadmap — thể hiện qua field `doi_tuong` trong schema | Nói thẳng trong pitch: mở rộng = nạp thêm corpus, kiến trúc không đổi |

**User stories chính (theo thứ tự ưu tiên):**
- Là chủ startup, tôi muốn nhập thông tin công ty (hoặc up giấy ĐKKD) và nhận ngay danh sách ưu đãi mình đủ điều kiện, để không phải tự đọc nghị định.
- Là kế toán DNNVV, tôi muốn hỏi bằng ngôn ngữ thường ("công ty tôi có phải DNNVV không?") và nhận câu trả lời có căn cứ điều khoản, để tự tin làm việc với cơ quan nhà nước.
- Là founder chuẩn bị nộp Đề án 844, tôi muốn có checklist giấy tờ và đơn điền sẵn, để rút thời gian chuẩn bị hồ sơ từ vài ngày xuống vài phút.

---

## 3. Phạm vi tính năng

| # | Tính năng | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| M2 | **Form profile + Matching**: form enum (lĩnh vực, tỉnh, quy mô, loại hình) → danh sách ưu đãi kèm căn cứ. Backend tự phân loại DNNVV theo NĐ 80/2021 từ vốn/DT/lao động | P0 | 2 profile mẫu ra kết quả đúng, khác nhau; mỗi kết quả có ≥1 citation điều khoản |
| M3 | **RAG Q&A** có trích dẫn + badge hiệu lực | P0 | 10/10 câu hỏi vàng; câu ngoài corpus phải nói "không đủ thông tin" thay vì bịa |
| M1 | **Data pipeline**: 15 văn bản + 2 quỹ, chunk theo điều/khoản, metadata 4 trục | P0 | Index xong, spot-check 10 truy vấn trả đúng văn bản |
| M4 | **OCR pre-fill**: up ĐKKD/trang KQKD → multimodal LLM (JSON schema) → điền sẵn form → user review. *Form nhập tay là luồng chính, OCR là hỗ trợ* | P1 | 3 bộ giấy tờ synthetic pre-fill đúng ≥80% field |
| M5 | **Grant assist**: checklist + auto-fill đơn Đề án 844, xuất docx | P1 | 1 quỹ chạy trọn; SMEDF ở mức checklist tĩnh |
| M6 | **Policy watch** (mock) | P2 | 1 màn hình với 2–3 văn bản seed |

---

## 4. Kỹ thuật & cân nhắc framework

### Kiến trúc
```
Frontend (form + upload + chat)
   → FastAPI
   → LangGraph Agent Router (3 intent: matching / Q&A / grant)
       ├─ Matching: structured filter trên metadata + VSIC map → LLM giải thích
       ├─ Q&A: Hybrid retrieval (BM25 + Dense + RRF + Reranker) → generate có citation
       └─ Grant: template biểu mẫu + profile → docx
   → Vector store + corpus (metadata hiệu lực)
```

### Bảng cân nhắc framework

| Lớp | Chọn | Phương án khác | Lý do chọn |
|---|---|---|---|
| Orchestration | **LangGraph** | LlamaIndex, code thuần | Tái sử dụng trực tiếp pipeline DocuMindAI đã có LangSmith tracing + RAGAS harness — tiết kiệm ~8h, và "agent router có tool" ăn điểm AI-Native hơn RAG một tầng |
| Backend | **FastAPI** | Flask | Async, đã quen, docs tự sinh cho giám khảo kỹ thuật xem |
| Vector store | **Chroma (embedded)** | Qdrant | Zero-ops, chạy trong process — với 15 văn bản (~vài nghìn chunk) không cần server riêng; Qdrant chỉ đáng nếu scale, và đây là điểm nói được trong roadmap |
| Retrieval | **BM25 + Dense + RRF + Reranker** | Dense-only | Văn bản pháp luật nhiều số hiệu, thuật ngữ chính xác ("NĐ 80/2021", "khoản 2 điều 12") — BM25 bắt exact match tốt hơn hẳn dense; đã chứng minh trong DocuMindAI |
| Embedding | **BGE-M3** (hoặc multilingual-e5-large) | Embedding API trả phí | Hỗ trợ tiếng Việt tốt, chạy local miễn phí, không phụ thuộc quota API giữa đêm hackathon |
| Reranker | **bge-reranker-v2-m3** | Cohere Rerank | Nhất quán với embedding, local, đã dùng trong DocuMindAI |
| LLM generate + OCR | **API multimodal thương mại** (chọn 1 chính + 1 dự phòng khác nhà cung cấp) | Model local | Chất lượng tiếng Việt + structured output + đọc ảnh trong 1 model; rủi ro quota → bắt buộc có key dự phòng |
| Frontend | **Streamlit** nếu team ≤3 hoặc yếu FE; **React + Tailwind** nếu có người FE chuyên | — | Quyết định tại H0 theo nhân sự thực tế; Streamlit đổi lấy tốc độ, React đổi lấy điểm UX (điểm yếu đã tự nhận diện từ trước) |
| Deploy | **Railway (paid)** | Render free | Render cold start đã phân tích là rủi ro chết demo; vài đô cho 48h là rẻ nhất giải đấu |
| Xuất docx | **python-docx** | — | Điền template biểu mẫu 844 |

### Nguyên tắc kỹ thuật
- Chunk theo cấu trúc điều/khoản, không chunk theo token đều.
- Trạng thái hiệu lực lấy nguyên từ vbpl.vn, không tự suy luận; thiếu thì flag `chua_xac_minh`.
- Gán nhãn metadata: LLM gán trước theo enum, người review (~1h cho 15 văn bản).
- Mọi citation hiển thị: số hiệu văn bản + điều/khoản + badge hiệu lực + link nguồn.

---

## 5. Dữ liệu

**Lát cắt duy nhất: Hỗ trợ DNNVV khởi nghiệp sáng tạo** (sâu, khép kín, có quỹ thật để demo phần hồ sơ).

**Khung pháp lý (tải từ vbpl.vn):**
1. Luật Hỗ trợ DNNVV 2017
2. Nghị định 80/2021/NĐ-CP — văn bản trung tâm
3. Thông tư 06/2022/TT-BKHĐT
4. Văn bản về Quỹ Phát triển DNNVV (SMEDF)
5. Luật Đầu tư 2020 — Chương ưu đãi đầu tư (Điều 15–20)
6. Nghị định 31/2021 — danh mục ngành nghề ưu đãi
7. Văn bản thuế TNDN với DN khởi nghiệp sáng tạo (nếu xác minh được hiệu lực rõ ràng)

**Chương trình/quỹ (crawl sâu kèm biểu mẫu .doc/.pdf):**
8. Đề án 844: QĐ 844/QĐ-TTg + QĐ 188/QĐ-TTg + TT 45/2019/TT-BTC + biểu mẫu từ dean844.most.gov.vn
9. SMEDF: điều kiện vay, chương trình đang mở, mẫu hồ sơ

**Bổ trợ:** 1–2 chương trình của NIC đang chạy; nghị quyết hỗ trợ khởi nghiệp của Hà Nội (thể hiện phân biệt trung ương/địa phương).

**Dữ liệu tự tạo:** bảng mapping VSIC (~20 mã startup phổ biến → 10 nhóm lĩnh vực); 2 bộ giấy tờ synthetic (ĐKKD + trang KQKD); 10 câu hỏi vàng làm bộ test M3.

Tổng: ~15 văn bản + 2 quỹ. Tải tay + clean: ~3h/2 người. **Không build crawler.**

---

## 6. Yêu cầu Ban tổ chức & rubric

### URL triển khai (yêu cầu bắt buộc)
- Deploy Railway paid tier ngay từ **H20–H24** (không để phút chót), domain public, HTTPS.
- Health-check endpoint + auto-restart; seed sẵn dữ liệu demo trong DB để URL vào là dùng được ngay, không cần setup.
- Freeze code + deploy tại **H40**; sau đó chỉ hotfix lỗi chặn demo.
- Backup: video quay demo đầy đủ tại H40 phòng sự cố mạng/API khi trình bày.

### Mapping rubric → bằng chứng trong sản phẩm
| Tiêu chí | Trọng số | Bằng chứng |
|---|---|---|
| Problem Relevance | 20% | Persona thật, pain point định lượng trong pitch; demo giải đúng đề NIC |
| AI-Native Architecture | 20% | Agent router 3 intent, hybrid retrieval, LLM-assisted labeling có human review, OCR bằng multimodal LLM |
| Technical Execution | 15% | Số RAGAS faithfulness, 10/10 câu hỏi vàng, citation kèm hiệu lực |
| Deployment | 15% | URL public ổn định, phản hồi <10s, demo live không cần setup |
| Feasibility | 15% | Corpus thật từ nguồn chính thống miễn phí; schema mở rộng sẵn cho FDI/CNC |
| Startup Potential | 15% | Business model: freemium startup / subscription hãng tư vấn & FDI advisory; policy watch là hook retention |

---

## 7. Timeline tóm tắt

| Mốc | Nội dung |
|---|---|
| H0–H3 | Chốt schema metadata (đã có bản đề xuất), chia việc, skeleton |
| H3–H10 | Corpus + index (M1), form UI |
| H10–H20 | Matching (M2) + RAG Q&A (M3), nối end-to-end |
| H20–H24 | **Deploy Railway — Checkpoint 24h: demo chạy trên URL public** |
| H24–H30 | OCR pre-fill (M4) + RAGAS eval lấy số |
| H30–H36 | Grant assist (M5) + mock policy watch (M6) + polish |
| H36–H40 | Hardening, freeze H40, quay video backup |
| H40–H48 | Slide theo rubric, tập pitch 2 lượt, Q&A drill |

**Quy tắc vận hành:** sau H34 không thêm tính năng; mọi merge phải chạy được demo script; mỗi 6h cả team chạy lại demo script từ đầu.

---

## 8. Rủi ro & phương án

| Rủi ro | Phương án |
|---|---|
| vbpl.vn chặn/chậm | H6 chưa ổn → chuyển tải thủ công (100% khả thi với 15 văn bản) |
| Trạng thái hiệu lực sai trước giám khảo | Metadata lấy nguyên từ nguồn + badge + disclaimer + link gốc |
| API LLM quota/downtime giữa demo | 2 key ở 2 nhà cung cấp khác nhau, switch bằng config |
| Deploy lỗi phút chót | Deploy sớm H20, freeze H40, video backup |
| Scope creep sau khi demo chạy | Non-goals ở mục 1 + quy tắc H34 |

---

## 9. Câu hỏi mở (chốt tại H0)

1. **[Team]** Mấy người, ai làm frontend → quyết Streamlit vs React và có cắt M6/M4 không (≤2 người: cắt M6 và phần auto-fill M5).
2. **[Data]** Văn bản thuế TNDN cho startup (mục 5.7) có bản còn hiệu lực rõ ràng không → không rõ thì bỏ, không mạo hiểm.
3. **[Pitch]** Tên hiển thị "GrantPilot AI" giữ nguyên hay thêm tên tiếng Việt phụ đề cho giám khảo trong nước.

---

## 10. Tình trạng triển khai thực tế (theo dõi tiến độ)

Cập nhật: 2026-07-18. Đối chiếu code thật trong repo với đặc tả gốc (mục 3, 4).

**Cập nhật 2026-07-18 (lần 2):** M3 (RAG Q&A) đã được nâng cấp thành RAG thật — xem ghi chú "ĐÃ NÂNG CẤP" trong bảng 10.1 và 10.2. **Tiếp đó đã bổ sung hybrid retrieval (BM25 + dense embedding + RRF)** thay cho đếm token trùng khớp, và mở rộng corpus từ 27 lên **35 chunk** (thêm 8 văn bản luật cấp trung ương từ vbpl.vn: NĐ 55/2019, 38/2018, 34/2018, TT 07/2020, 13/2015, 01/2018, 52/2023) + `policy_watch.json` từ 10 lên **14 mục**.

**Cập nhật 2026-07-18 (lần 3):** Thêm **bring-your-own-key đa nhà cung cấp** cho Q&A — người dùng tự chọn Google Gemini / OpenAI / Anthropic Claude / xAI Grok và nhập API key riêng trên UI (modal "Cài đặt AI"), lưu ở `localStorage`, không lưu server. `lib/llmProviders.ts` gọi đúng API của từng nhà cung cấp (đã validate request schema với cả 4 API thật bằng key giả — nhận đúng lỗi 401 "invalid key", không phải lỗi schema). Server vẫn dùng `GEMINI_API_KEY` làm mặc định nếu người dùng không cấu hình riêng. Đây **chính là phần "1 chính + 1 dự phòng khác nhà cung cấp"** mà mục 4 và rủi ro mục 8 yêu cầu, mở rộng thành 4 lựa chọn thay vì 2. Các mục còn lại (backend cho matching, OCR multimodal, agent router, reranker, RAGAS, deploy) **vẫn chưa triển khai**.

**Cập nhật 2026-07-18 (lần 4):** Hoàn thiện 3 "tool" còn thiếu đối chiếu với 5 năng lực AI đã đặt tên (Legal RAG, Recommendation System, Reasoning Engine, Document Automation, Monitoring Pipeline):
- **Reasoning Engine** (M2): `app/api/recommend/route.ts` — route mới, nhận `matchPolicies()` (rule-based, không đổi) rồi gọi LLM để sinh **giải thích lập luận 2-4 câu cho từng chính sách** (system instruction cấm bịa căn cứ pháp lý, chỉ dùng dữ kiện đã có: điểm số, lý do, khoảng thiếu). UI: nút "✦ Phân tích sâu hơn bằng AI" trong modal chi tiết chính sách, gọi on-demand (không tự động, tiết kiệm quota). Đã test thật với hồ sơ NovaMind AI — output đúng nghiệp vụ (nhận diện đúng 2 chính sách phù hợp nhất, đúng cảnh báo chính sách không phù hợp). Matching lõi (`matchPolicies`) vẫn 100% rule-based/client-side — LLM chỉ thêm lớp giải thích, không thay quyết định điểm số.
- **Document Automation / OCR** (M4): `lib/llmProviders.ts` mở rộng hỗ trợ ảnh (multimodal) cho cả 4 nhà cung cấp (`generateVisionAnswer()`, schema ảnh riêng theo từng API: Gemini `inlineData`, OpenAI/xAI `image_url`, Anthropic `source.type=base64`). `app/api/ocr/route.ts` nhận ảnh ĐKKD/KQKD (base64), trả JSON hồ sơ doanh nghiệp có cấu trúc, ép kiểu số phòng thủ, quy đổi đơn vị tiền tệ về tỷ đồng. Dropzone UI nhận cả `.txt` lẫn ảnh (JPG/PNG/WebP), tự OCR khi upload ảnh. Đã test với ảnh ĐKKD giả lập tự tạo (PIL) — trích xuất đúng 100% trường (kể cả quy đổi "5.000.000.000 đồng" → 5 tỷ đúng). Đây là OCR thật lần đầu tiên trong sản phẩm — trước đó `parseUploadedText()` chỉ đọc `.txt`.
- **Monitoring Pipeline** (M6): `scripts/refresh_policy_watch.py` — **không phải real-time** (kiến trúc Next.js API route trên Render không có scheduler/process thường trú, và crawler cần Python + Playwright, không chạy được trong route Node.js) mà là **batch theo lịch**: (1) crawl lại 23 nguồn, so khớp độ tương đồng văn bản (`difflib`, ngưỡng 0.97) với lần crawl trước để phát hiện nội dung đổi — đã phát hiện và xử lý một lỗi dữ liệu thật: các trang `vanban.chinhphu.vn/?docid=` nhúng widget "văn bản liên quan" xoay vòng ngẫu nhiên, khiến so khớp hash tuyệt đối báo "đổi" ở gần như mọi lần chạy dù nội dung không đổi — đã loại các URL dạng này khỏi bước gắn cờ "đổi" thay vì phát tín hiệu sai; (2) quét từ khoá hẹp trên chuyên mục chinhphu.vn để tìm bài mới, lọc chặt hơn script thủ công cũ (yêu cầu có số hiệu văn bản pháp luật hoặc ≥2 từ khoá trùng, vì bước này không có người duyệt trước khi ghi vào `policy_watch.json`) — chạy thật đã bổ sung 9 mục mới (10→14→**23**). Kích hoạt qua: `npm run data:watch` (thủ công), `.github/workflows/refresh-data.yml` (lịch hằng ngày + trigger tay qua `workflow_dispatch`, mở Pull Request thay vì tự đẩy thẳng vào `main` — cần cấu hình "Allow GitHub Actions to create and approve pull requests" trong Settings), và `GET /api/policy-watch/status` (route Next.js chỉ đọc báo cáo lần chạy gần nhất, không tự crawl — hiển thị trên tab "Theo dõi cập nhật" trong UI).

Sau lần 4, cả 5 năng lực AI đã đặt tên đều có triển khai thật (không còn "0 dòng code"): Legal RAG (M3, lần 2), Recommendation System (M2 rule-based, có từ đầu), Reasoning Engine (M2, lần 4), Document Automation (M4, lần 4), Monitoring Pipeline (M6, lần 4 — dạng batch/scheduled, không phải real-time đúng nghĩa đen). Phần còn thiếu lớn nhất: reranker, RAGAS đo thật, agent router (LangGraph), quyết định nền tảng deploy — xem 10.4.

**Cập nhật 2026-07-18 (lần 5, checkpoint 2):** Audit lại theo khung 6 lớp dữ liệu do người dùng đề ra (văn bản pháp luật, chương trình hỗ trợ, điều kiện tham gia, hồ sơ yêu cầu, biểu mẫu, quy trình) và thứ tự ưu tiên 5 tính năng (Legal RAG → Eligibility Checker → Document Checklist → Auto Form Filling → Policy Monitoring). Phát hiện + xử lý trong đêm chuẩn bị checkpoint:
- **Bug thật, đã sửa:** `/api/grant-docx` hardcode tiêu đề `"Đơn đăng ký tham gia nhiệm vụ Đề án 844"` và nội dung "Nội dung đề xuất hỗ trợ" cho **mọi** policy — export docx cho SMEDF/Hà Nội/... trước đó vẫn hiện sai là Đề án 844. Đã sửa: tiêu đề/nội dung lấy động từ `policy.title`/`policy.program`/`policy.summary`, tên file theo `policy.id`. Verify bằng cách export docx cho SMEDF và unzip kiểm tra `word/document.xml` — không còn chuỗi "Đề án 844", có đúng "Quỹ Phát triển".
- **`founded_year` (Eligibility Checker):** trường đã có trong `Profile` type và dữ liệu mẫu nhưng chưa từng được dùng ở đâu — nay có ô nhập "Năm thành lập" trên form hồ sơ, `/api/ocr` thử đọc từ ngày "Đăng ký lần đầu" trên ảnh ĐKKD, và `/api/recommend` đưa số năm hoạt động vào ngữ cảnh cho LLM giải thích. **Chủ động không** thêm ngưỡng cứng kiểu "startup dưới N năm" vào `matchPolicies()` vì chưa có căn cứ pháp lý xác thực riêng cho từng chương trình trong corpus — thêm ẩu sẽ vi phạm đúng nguyên tắc "không bịa căn cứ" mà hệ thống này theo suốt từ đầu.
- **Document Checklist matching (tính năng trọng tâm, đúng ví dụ "✓ Đã có / Thiếu" người dùng mô tả):** route mới `app/api/checklist-match/route.ts` + `generateVisionAnswer()` được nâng cấp để nhận **nhiều ảnh cùng lúc** (trước đó chỉ nhận 1 ảnh cho OCR). Người dùng tải lên nhiều tài liệu (ảnh) trong modal chi tiết chính sách, LLM đọc từng ảnh và đối chiếu với từng mục trong `policy.checklist`, trả về `co`/`thieu`/`chua_ro` kèm giải thích 1 câu. UI hiện ✓/✗/? màu xanh/đỏ/vàng ngay trong danh sách checklist. Đã test thật: upload 1 ảnh ĐKKD giả lập — hệ thống đúng: đánh dấu "có" cho mục Giấy chứng nhận ĐKKD, suy luận hợp lý rằng ảnh đó cũng đủ để chứng minh mục "quy mô DNNVV" (vì có vốn/lao động/doanh thu trên giấy), và đánh dấu "thiếu" cho 2 mục còn lại (mô tả sản phẩm, đề xuất nội dung) — không có false positive.
- **Không làm trong đêm (rủi ro cao hơn giá trị nếu làm vội):** thêm chương trình mới (NIC, NAFOSTED, Quỹ Đổi mới công nghệ quốc gia) và thu thập biểu mẫu gốc thật (Word/PDF mẫu do chương trình công bố) — cả hai cần crawl + xác minh nguồn kỹ trước khi đưa vào, giống cách 23 nguồn hiện tại đã được làm; làm vội trong vài giờ dễ đưa sai thông tin chương trình/điều kiện, rủi ro hơn nhiều so với việc để trống và ghi rõ đây là gap đã biết cho checkpoint tiếp theo.

Sau lần 5: 2/5 tính năng theo đúng nghĩa hoàn chỉnh (Legal RAG, Policy Monitoring), Eligibility Checker và Document Checklist đã lên mức "thật, có test, nhưng còn nông" (thiếu ngưỡng riêng theo từng chương trình cho Eligibility; Document Checklist mới hoạt động tốt với ảnh, chưa hỗ trợ PDF nhiều trang), Auto Form Filling vẫn chưa đúng nghĩa "điền vào biểu mẫu gốc" vì chưa có biểu mẫu gốc nào trong dữ liệu.

**Cập nhật 2026-07-18 (lần 6):** Yêu cầu thu hẹp phạm vi về "tập trung startup trước" → soát lại corpus và phát hiện: 3 văn bản pháp lý mới nhất, trực tiếp nhất cho khởi nghiệp sáng tạo (NĐ 268/2025/NĐ-CP, NĐ 210/2025/NĐ-CP, NĐ 38/2018/NĐ-CP) **đã có sẵn trong `corpus.json`** (dùng được cho RAG Q&A) nhưng **chưa từng được dựng thành policy card** trong `data/policies.json` — nên Recommendation Engine, Eligibility Checker và Document Checklist chưa bao giờ đề xuất chúng dù đây là khung pháp lý mà chính `policy_watch.json` tự mô tả là "hiện đại nhất cho mảng khởi nghiệp sáng tạo". Đây là việc rẻ để làm (không cần crawl mới, chỉ cần đọc lại nguồn đã xác thực và dựng policy card đúng schema) nên đã thực hiện ngay:
- **`p_nd268_recognition`** (Công nhận khởi nghiệp sáng tạo & tiếp cận hệ sinh thái) — dựng từ Điều 35 (tiêu chí công nhận cá nhân/nhóm cá nhân/doanh nghiệp khởi nghiệp sáng tạo) + Điều 63 (hạ tầng, mạng lưới, hệ sinh thái) của NĐ 268/2025. **Cố ý không** gộp Điều 56 (ưu đãi thuế/tín dụng/đất đai cho DN KH&CN) vào cùng policy này — Điều 56 áp dụng cho chủ thể có Giấy chứng nhận DN KH&CN, một chứng nhận riêng với tiêu chí xin cấp không có trong corpus hiện tại, gộp vào sẽ ngầm khẳng định một điều kiện chưa xác minh được; thay vào đó chỉ nhắc tới trong `summary` như một lưu ý, không đưa vào `eligibility`/`checklist`.
- **`p_nd38_investment_fund`** (Điều kiện nhận vốn từ Quỹ đầu tư khởi nghiệp sáng tạo) — dựng từ NĐ 210/2025 Điều 5 (sửa NĐ 38/2018) + NĐ 38/2018 Điều 4, mô tả cơ chế quỹ đầu tư khởi nghiệp sáng tạo (tối đa 30 nhà đầu tư, đầu tư không quá 50% vốn điều lệ sau đầu tư) và yêu cầu đăng ký bổ sung ngành nghề để đủ điều kiện nhận vốn dạng này.
- Không thêm field mới vào `Profile`/`Policy` type — cả hai policy dùng đúng schema `eligibility` hiện có (`requires_sme`, `requires_startup_innovation`, `industries`, `provinces`); các tiêu chí đặc thù hơn của NĐ 268/2025 (đã có cam kết đầu tư/hỗ trợ, tăng trưởng doanh thu ≥20%/năm trong 2 năm) được đưa vào `checklist` (thứ người dùng cần chuẩn bị) thay vì vào `eligibility` (thứ quyết định điểm số) — vì rule-based scoring hiện chưa có dữ liệu hồ sơ (lịch sử doanh thu nhiều năm, xác nhận cam kết đầu tư) để chấm tự động, đưa vào eligibility sẽ tạo cảm giác chính xác giả.
- Đã test end-to-end: `data:build` chạy lại (`policies: 6→8`, `policy_citations: 13→17`), `npm run build` sạch, UI hiển thị đủ 8/8 policy và xếp hạng hợp lý (NovaMind AI: `p_nd38_investment_fund` 100đ, `p_nd268_recognition` 78đ — vì NĐ268 không gate theo `requires_sme` nên thiếu 22đ bonus so với NĐ38, đúng logic scoring hiện có, không phải bug), `/api/recommend` sinh giải thích đúng nghiệp vụ (kể cả tự nhắc kiểm tra lại `founded_year` cho `p_nd268_recognition` dù không có ngưỡng cứng), `/api/grant-docx` xuất đúng tiêu đề "NĐ 268/2025" cho policy mới.
- **Vẫn chưa làm** (đúng như đã nêu ở lần 5, không đổi): NIC, NAFOSTED, Quỹ Đổi mới công nghệ quốc gia — đây là các chương trình *chưa* có sẵn nguồn đã crawl/xác thực trong corpus, khác với 2 policy vừa thêm; muốn làm cần crawl + xác minh nguồn mới, đặc biệt quan trọng vì đề bài gốc (mục 3, dòng 1: *"Đề bài: Policy & Grant Navigator — National Innovation Center (NIC), track Đổi mới Sáng tạo"*) và rubric "Problem Relevance" (20%) đòi hỏi demo có chương trình NIC thật.

Sau lần 6: 8 policy trong `data/policies.json`, 5/8 gắn cờ `requires_startup_innovation: true` (NĐ80, Đề án 844, Hà Nội, NĐ268, NĐ38) — coverage cho riêng nhóm startup đã bám sát khung pháp lý hiện hành hơn (2025) thay vì chỉ dựa vào NĐ80/2021 và Đề án 844 (đến 2025) như trước lần 6.

**Cập nhật 2026-07-18 (lần 7):** Người dùng cung cấp một bản triển khai song song (`GrantPilot-Core-System.zip`, không commit — đã gitignore theo `*.zip`) có 2 mảng logic đáng học: (1) route `tax-lookup` tra cứu doanh nghiệp thật qua API công khai VietQR bằng mã số thuế; (2) cách đọc OCR khác — nhận PDF trực tiếp + dùng Gemini structured output (`responseSchema`) thay vì tự parse JSON từ text tự do. Đã học và tích hợp cả hai, không copy nguyên văn vì bản gốc có vài vấn đề chất lượng cần sửa khi mang sang:
- **`app/api/tax-lookup/route.ts`** (mới) — gọi `https://api.vietqr.io/v2/business/{taxCode}` (public, không cần key, nguồn dữ liệu là Cục Thuế qua gdt.gov.vn), trả về tên + địa chỉ + trạng thái hoạt động thật. Suy ra tỉnh/thành từ địa chỉ bằng `guessProvinceFromAddress()` (tái dùng bảng alias đã có, không viết lại logic so khớp thô như bản gốc). Verify thật với MST 0300741143 (REE Corp) — đúng tên, đúng địa chỉ, đúng tỉnh; MST không tồn tại và sai định dạng đều báo lỗi rõ ràng.
- **Wire vào "Tìm chính sách":** ô nhập MST + nút "Tra cứu" trong Bước 01 (cạnh dropzone), điền tên + tỉnh (dữ liệu đăng ký thuế thật, không phải AI đoán), các trường còn lại (lĩnh vực, lao động, doanh thu, vốn) vẫn cần bổ sung tay vì VietQR không cung cấp — đã test bằng Playwright, dropdown tỉnh chọn đúng.
- **Wire vào "Hỏi đáp pháp lý":** không xây lại form tra cứu riêng — `profile` vốn đã là state dùng chung toàn app và `/api/qa` vốn đã nhận `profile` làm ngữ cảnh (`ask()` gọi `/api/qa` với `{question, profile, llm}` từ trước). Chỉ thêm dòng hiển thị "Câu trả lời được cá nhân hoá theo hồ sơ: {tên} · {tỉnh}" ngay trên ô hỏi, để người dùng thấy rõ việc tra cứu MST ở tab kia có tác dụng ở đây — tránh xây trùng logic ở 2 nơi.
- **OCR: thêm PDF trực tiếp + structured output cho nhánh Google.** `lib/llmProviders.ts` thêm `generateGoogleJson()` (Gemini-only, dùng `responseMimeType: "application/json"` + `responseSchema`), `generateGoogle()` giờ nhận `responseSchema` tùy chọn. `/api/ocr` dùng nhánh này khi provider là Google (bỏ qua bước tự dò `{...}` trong text tự do — hết hẳn kiểu lỗi "không tìm thấy JSON hợp lệ"); các nhà cung cấp khác vẫn theo đường cũ (regex). PDF: dropzone nhận thêm `application/pdf`; nếu người dùng chọn OpenAI/Anthropic/xAI mà tải PDF lên, server tự chuyển sang Gemini nếu có `GEMINI_API_KEY` trên server, không thì báo lỗi rõ ràng (giống bản gốc, vì OpenAI/Anthropic không nhận PDF thẳng qua content block ảnh). **Khác bản gốc ở 2 điểm cố ý:** (a) schema KHÔNG đánh dấu field nào `required` — bản gốc đánh dấu required toàn bộ, ép model phải bịa giá trị cho trường không chắc, ngược nguyên tắc "không bịa" của app này; (b) vẫn chạy `normalizeProvince`/`normalizeIndustry` sau khi nhận JSON có cấu trúc — structured output chỉ đảm bảo đúng *kiểu dữ liệu* (STRING/NUMBER), không đảm bảo đúng *giá trị* (vẫn có thể trả "Thành phố Hồ Chí Minh" thay vì "TP. Hồ Chí Minh").
- **Chưa verify được bằng test thật:** đường PDF bị chặn bởi quota Gemini free-tier của key mặc định trên server đã cạn (20 request/ngày, đã cạn nhiều lần trong phiên làm việc này) — logic đã review kỹ và tái dùng đúng pattern của đường ảnh (đã test), nhưng chưa có lần gọi thật thành công để xác nhận structured output từ Gemini khớp đúng schema khi có PDF đính kèm. Cần test lại khi quota reset hoặc dùng key riêng.
- Phát hiện phụ: `tsconfig.json` thiếu `tmp` trong `exclude`, khiến file `.ts` tạm thời trong `tmp/` (dùng để đối chiếu logic file zip) làm `next build` type-check lỗi — đã thêm `"tmp"` vào exclude.

**Cập nhật 2026-07-18 (lần 8):** Merge nhánh `feature/data-pipeline` của cộng sự vào `main` (crawler hardening + tái cấu trúc `data/` thành `raw/`/`processed/` + tải về 127 tệp đính kèm thật từ vbpl.vn cho 47 văn bản "hỗ trợ doanh nghiệp"). Merge sạch (2 nhánh sửa các file tách biệt kể từ điểm rẽ), nhưng phát hiện 1 chỗ vỡ tích hợp thật: `refresh_policy_watch.py` import `OUTPUT_PATH` — tên hằng số đã bị đổi thành `RAW_OUTPUT_PATH`/`PROCESSED_OUTPUT_PATH` trong bản crawler mới, và `crawl()` giờ trả về bản đã lọc trùng (không còn field `text` cần cho việc so khớp độ tương đồng) — đã sửa, test lại full pipeline (kể cả sweep Playwright) chạy đúng.

Sau đó rà lại 127 tệp đính kèm vừa tải: **đa số không dùng được** — nhiều văn bản (~2000-2009) chỉ có placeholder "Đang cập nhật file đính kèm" từ chính vbpl.vn (không phải form thật), số còn lại phần lớn là thông tư/quyết định hỗ trợ lao động mất việc/thuế cũ, không liên quan khởi nghiệp. Nhưng phát hiện đúng thứ giá trị nhất: **văn bản NĐ 268/2025/NĐ-CP (đã có policy card `p_nd268_recognition`) có đủ 6 phụ lục dạng .docx thật**, trong đó Phụ lục IV chứa **Mẫu số IV.1.1 — đơn đăng ký gốc thật** cho đúng yêu cầu công nhận "Doanh nghiệp khởi nghiệp sáng tạo" mà policy này đại diện, và Phụ lục V chứa Mẫu số V.1 (đơn xin cấp Giấy chứng nhận DN KH&CN, liên quan tới Điều 56 đã nhắc ở `summary`). Đây chính là "biểu mẫu gốc" đã liệt vào mục 10.4 #18 là gap lớn nhất cho Auto Form Filling.

Đã tích hợp phần giá trị nhất (Mẫu IV.1.1), không tích hợp phần còn lại (rủi ro cao hơn giá trị nếu vội):
- Thêm field `forms?: PolicyForm[]` vào `Policy` type (`lib/grantpilot.ts`) — trỏ thẳng URL công khai trên hạ tầng chính phủ (`vbpl-bientap-gateway.moj.gov.vn`, đã verify HTTP 200, không cần auth), không host lại file — không tốn hạ tầng lưu trữ, luôn là bản mới nhất từ nguồn.
- `p_nd268_recognition.forms` giờ có Mẫu IV.1.1 thật; `checklist` được viết lại theo đúng Phần 3 (hồ sơ kèm theo) của mẫu thật thay vì suy đoán như trước — đối chiếu cho thấy checklist cũ tương đối đúng nhưng không khớp chính xác (ví dụ mẫu thật gộp "tăng trưởng doanh thu ≥20%/năm" vào "tài liệu chứng minh đáp ứng tiêu chí Điều 35" thay vì để riêng một dòng).
- UI: modal chi tiết chính sách có thêm mục "Biểu mẫu gốc" (giữa Checklist và Nguồn pháp lý), hiện thẻ liên kết tải mẫu thật — đã test bằng Playwright, render đúng.
- **Không làm:** chưa dựng policy card riêng cho Giấy chứng nhận DN KH&CN (dù có Mẫu V.1 thật) vì chưa có đủ văn bản gốc quy định tiêu chí cấp chứng nhận (mẫu chỉ tham chiếu "khoản 2 Điều 50" — điều khoản này chưa có trong corpus) — dựng eligibility mà thiếu căn cứ đầy đủ sẽ vi phạm nguyên tắc "không bịa". 46/47 văn bản còn lại trong đợt tải này không dùng vì không liên quan (thông tư cũ 2000s) hoặc không có file thật (placeholder).
- 127 tệp tải về (~57MB, thư mục `data/raw/vbpl/files/`) đã có sẵn trong `.gitignore`, không commit vào repo.

**Cập nhật 2026-07-18 (lần 9):** Chẩn đoán 2 việc người dùng báo:
1. **"Tại sao không tải file lên được"** — không phải bug, dropzone trước đó chỉ chấp nhận `.txt`/ảnh/PDF, chưa hỗ trợ `.docx`/`.xlsx` (định dạng phổ biến nhất cho "hồ sơ công ty" thật ngoài đời). Đã bổ sung.
2. **"Thêm txt vào nhưng chưa auto-fill"** — chẩn đoán bằng cách gọi thẳng vào server người dùng đang chạy (cổng 3000): **mọi route `/api/*` đều 404**, kể cả `/api/qa` đã ổn định từ đầu phiên. Tra tiến trình (PID, `StartTime`) cho thấy server khởi động **17/7 21:30** — tức là trước gần như toàn bộ code build hôm nay (OCR, tax-lookup, checklist-match, fix txt-fallback). Không phải bug code — server đang chạy build cũ, cần khởi động lại (`npm run dev`/`npm run start`) để nhận code mới. Đã báo người dùng, không tự ý tắt tiến trình của họ.

Sau đó bổ sung hỗ trợ Word/Excel như yêu cầu "hoàn thiện đi":
- `app/api/ocr/route.ts` thêm `extractDocxText()` (dùng `mammoth`) và `extractXlsxText()` (dùng `exceljs`) — trích xuất văn bản thô trước, rồi cho đi qua đúng luồng AI dạng text đã có sẵn (không cần model có khả năng đọc ảnh, mọi nhà cung cấp đều dùng được, khác với ảnh/PDF).
- **Quyết định bảo mật quan trọng:** thử cài `xlsx` (SheetJS) trước — `npm audit` báo lỗ hổng mức **HIGH** chưa có bản vá (prototype pollution + ReDoS), rủi ro thật vì đây là thư viện parse file người dùng tải lên (input không tin cậy). Đã gỡ, chuyển sang `exceljs` (chỉ còn lỗ hổng mức moderate qua dependency `uuid`, chấp nhận được).
- Client (`app/page.tsx`): nhận diện `.docx`/`.xlsx` theo cả mimeType lẫn đuôi file (mimeType từ trình duyệt không đáng tin cho định dạng Office trên một số hệ điều hành), tự chuẩn hoá mimeType gửi lên server thay vì tin `file.type`. Từ chối rõ ràng `.doc`/`.xls` cũ (chưa hỗ trợ, khác định dạng XML-based mới). Xoá dòng "tối đa 1 MB" khỏi UI vì không có kiểm tra `file.size` nào thực sự tồn tại trong code — chữ đó gây hiểu lầm.
- **Verify được:** `mammoth`/`exceljs` test độc lập (không qua mạng) — trích xuất đúng 100% nội dung tiếng Việt từ file `.docx`/`.xlsx` thật tự tạo, tức thời (<100ms). **Chưa verify được đầu-cuối qua AI thật:** cùng vướng quota Gemini free-tier (20 request/ngày) của server đã cạn nhiều lần trong phiên — 1 request còn trả về "Gemini trả về phản hồi rỗng" trước khi quota báo 429 hẳn, có thể là hệ quả của việc gần chạm giới hạn quota chứ không phải lỗi logic (đường dẫn structured-JSON-từ-text-thuần đã test thành công y hệt ở lần 7 khi quota còn đủ).

**Cập nhật 2026-07-18 (lần 10):** Yêu cầu "sản phẩm hoàn thiện, không còn demo nữa" — rà toàn bộ codebase tìm khung "demo"/dữ liệu-mẫu và lỗ hổng UX thật, không chỉ đổi chữ:
- **Gỡ "demo"/"MVP" khỏi mọi văn bản người dùng thấy được** (~20 chỗ): sidebar ("Dữ liệu demo an toàn" → "Bảo mật dữ liệu", bỏ nhãn "Vietnam AI Innovation Challenge 2026"), thống kê tổng quan ("Chính sách mẫu" → "Chương trình hỗ trợ" — dữ liệu này là thật, có citation, gọi "mẫu" là sai), eyebrow "RAG DEMO" → "CÂU HỎI GỢI Ý", các câu fallback rule-based trong `answerQuestion()` (`lib/grantpilot.ts`) và `SYSTEM_INSTRUCTION` của `/api/qa` — **quan trọng nhất trong nhóm này**: system instruction cũ ra lệnh cho LLM tự nói "Không đủ thông tin trong **corpus demo**..." — nghĩa là câu trả lời AI thật cho người dùng thật có thể chứa nguyên văn "corpus demo". Đã sửa tận gốc, không chỉ sửa chỗ hiển thị.
- **Gỡ từ "corpus" (thuật ngữ kỹ thuật) khỏi toàn bộ text/badge người dùng thấy**, kể cả type `Answer.confidence` (`"Có căn cứ trong corpus"` → `"Có căn cứ"`, `"Ngoài corpus"` → `"Ngoài phạm vi dữ liệu"`) và 1 câu hỏi vàng có chữ "corpus" trong Q&A ("Công ty ngoài corpus có được miễn toàn bộ thuế không?" → viết lại tự nhiên, vẫn kích hoạt đúng nhánh test cũ vì giữ cụm "miễn toàn bộ thuế").
- **Bug thật tìm thấy khi rà, không liên quan "demo":**
  - `/api/grant-docx` không validate `profile`/`policy` trước khi dùng — thiếu 1 trong 2 sẽ crash 500 không rõ ràng thay vì lỗi 400 sạch. Đã thêm validate + try/catch quanh toàn bộ việc dựng file + ép các field hồ sơ về `""` nếu `undefined` (trước đó thiếu field sẽ hiện literal "undefined" trong file .docx tải về).
  - Ô loading khi hỏi AI luôn ghi cứng "...gọi Gemini..." bất kể người dùng đã chọn nhà cung cấp khác qua BYOK — sai thông tin khi dùng OpenAI/Anthropic/xAI. Đã sửa để hiện đúng tên nhà cung cấp đang cấu hình.
  - **Hồ sơ doanh nghiệp đang nhập chỉ tồn tại trong React state, mất trắng nếu lỡ tay F5 hoặc app crash** — không có persistence nào. Thêm `sessionStorage` cho `profile` (không dùng `localStorage` vì đây là dữ liệu doanh nghiệp, không nên lưu vĩnh viễn trên máy — tự xoá khi đóng tab). Verify bằng Playwright: nhập tên công ty → reload trang → giá trị vẫn còn.
  - Không có `app/error.tsx` — bất kỳ lỗi React runtime nào cũng rơi về màn lỗi mặc định xấu của Next.js, không có cách phục hồi. Đã thêm error boundary theo đúng convention Next.js App Router (chưa live-test bằng cách cố tình gây lỗi, nhưng file đơn giản, build qua type-check).
  - 2 chỗ copy tham chiếu bố cục cứng ("Hoàn thiện hồ sơ **bên trái**...", "Chọn câu hỏi vàng **bên trái**...") — sai trên mobile vì layout dồn thành 1 cột dọc, không còn khái niệm "trái/phải". Đã bỏ tham chiếu vị trí.
- **Đã kiểm tra, không phải bug:** thanh điều hướng bị tràn ngang ở màn hình <700px — đây là `overflow-x: auto` có chủ đích (pattern tab-bar cuộn ngang phổ biến trên mobile), không phải lỗi.
- **Test bằng Playwright ở 3 kích thước** (desktop 1280px, mobile 390px iPhone, modal chi tiết chính sách) — layout co giãn đúng, không vỡ chữ, không tràn ngang trang.
- **2 việc KHÔNG tự sửa vì cần quyết định của người dùng (chi phí/hạ tầng), xem README mục "Cần bạn quyết định trước khi dùng thật":**
  1. `GEMINI_API_KEY` mặc định của server đang ở free tier (20 request/ngày) — đã cạn nhiều lần trong chính phiên làm việc này. Với người dùng thật, ngưỡng này sẽ hết trong vài phút đầu tiên của NGÀY ĐẦU TIÊN. Cần nâng cấp gói trả phí trên Google AI Studio/Cloud Console (tôi không có quyền/thông tin thanh toán để tự làm).
  2. `render.yaml` vẫn `plan: free` — Render free tier có cold-start (dịch vụ ngủ sau ~15 phút không hoạt động, lần gọi đầu tiên sau đó mất 30-60+ giây) — trải nghiệm tệ cho người dùng thật lần đầu ghé thăm. Cần đổi sang gói trả phí của Render. Không tự đổi `plan:` trong `render.yaml` vì đó là quyết định phát sinh chi phí thật.

**Cập nhật 2026-07-18 (lần 11):** Hai việc từ người dùng:
1. **Mở rộng danh sách model Gemini** — người dùng chỉ vào `check_api_gemini.ipynb` (notebook cá nhân, chứa API key riêng — không đọc/dùng lại key đó, chỉ xem danh sách model đã gọi thử thành công). Notebook xác nhận gọi được: `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-2.5-flash-lite`. Đã bổ sung 3 model còn thiếu (`gemini-2.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview`) vào `MODEL_SUGGESTIONS.google` (`lib/llmSettings.ts`) — `gemini-3.5-flash` đã có sẵn từ trước. **Không đổi default** (`DEFAULT_MODELS.google` vẫn `gemini-2.5-flash`) — đây là model duy nhất trong nhóm đã được test kỹ toàn bộ pipeline (RAG, recommend, OCR structured-output) trong phiên này; các model 3.x tuy notebook xác nhận gọi được nhưng chưa qua test thật trong app, và `gemini-3-flash-preview` là bản preview (có thể đổi/rút bất kỳ lúc nào) — chỉ đưa vào như lựa chọn opt-in, không mặc định.
2. **Chuyển "Hỏi đáp pháp lý" từ hỏi-đáp từng câu độc lập sang hội thoại nhiều lượt:**
   - Backend `/api/qa`: nhận thêm `history` (mảng lượt hỏi/đáp trước đó, giới hạn 12 lượt gần nhất kể cả khi client gửi nhiều hơn — phòng thủ phía server). `buildPrompt()` đưa lịch sử vào prompt (rõ ràng ghi "chỉ để hiểu ngữ cảnh, không phải căn cứ pháp lý" để tránh model lấy hội thoại cũ làm nguồn). `SYSTEM_INSTRUCTION` cập nhật để model biết đây là hội thoại nhiều lượt, được dùng ngữ cảnh để hiểu câu hỏi nối tiếp (đại từ, "còn...", "vậy...").
   - **Retrieval cho câu hỏi nối tiếp ngắn** (ví dụ "Trong số đó, mục nào bắt buộc nhất?" — tự nó không đủ từ khoá để BM25/dense tìm đúng chunk): query truy hồi được ghép thêm text của lượt hỏi gần nhất trước đó, không đổi câu hỏi hiển thị cho model/UI.
   - Frontend: thay `answer: Answer | null` bằng `messages: ChatMessage[]`, giao diện chat-thread thật (bong bóng hội thoại, người dùng bên phải/AI bên trái, tự cuộn xuống tin mới nhất), nút "Cuộc trò chuyện mới" để xoá lịch sử. Route rule-based fallback (`answerQuestion()`) **không** có nhận thức hội thoại (chấp nhận được vì chỉ là phương án dự phòng cuối khi LLM lỗi/hết quota).
   - **Verify:** gọi thật 2 lượt liên tiếp qua API — log server xác nhận `historyTurns=2` được nhận đúng và retrieval vẫn tìm được chunk cho câu hỏi nối tiếp mơ hồ; lượt 2 rơi về fallback vì lại cạn đúng quota Gemini free-tier đã nêu nhiều lần — không kiểm chứng được văn phong hội thoại thật của LLM (cần key riêng hoặc chờ quota reset). Giao diện đã test bằng Playwright: 2 lượt hỏi tạo đúng 4 bong bóng, tự cuộn xuống bong bóng mới nhất, nút "Cuộc trò chuyện mới" xoá sạch về 0 bong bóng.

**Cập nhật 2026-07-18 (lần 12):** Yêu cầu người dùng: "trong phần tìm chính sách không được để cố định nữa, tất cả đều được fill vào các ô khi phân tích các nội dung được nạp vào từ file, bước 3 dùng llm để phân tích, có prompt chặt chẽ."
1. **Fix lỗi merge hồ sơ cũ khi nạp file mới** — trước đây `handleFile()` luôn `setProfile((current) => ({ ...current, ...parsed }))`, nghĩa là nếu file mới không có (hoặc AI không đọc được) một trường nào đó, giá trị của hồ sơ TRƯỚC ĐÓ (mẫu demo hoặc file khác) vẫn còn nguyên và trông như thể đến từ file mới — sai lệch dữ liệu im lặng. Thêm hằng `EMPTY_PROFILE` (`app/page.tsx`) và đổi cả 3 điểm merge (regex nhanh cho .txt chuẩn, fallback AI cho .txt tự do, OCR ảnh/PDF/Word/Excel) sang `setProfile({ ...EMPTY_PROFILE, ...parsed })` — mỗi lần nạp file là một hồ sơ mới hoàn toàn, trường nào file không có thì về mặc định rỗng/0, không kế thừa từ trước.
2. **Bước 3 tự động phân tích bằng AI, không còn phải bấm nút riêng** — `analyze()` giờ gọi `fetchAiExplanations()` ngay sau khi có kết quả rule-based (fire-and-forget, không chờ, để bảng xếp hạng rule-based hiện ngay còn lớp AI load chồng lên sau). Kết quả AI hiện trực tiếp trên từng thẻ chính sách ở Bước 3 (trước đây chỉ hiện trong modal chi tiết khi bấm vào từng chính sách) kèm badge "AI" và spinner khi đang tải.
3. **Viết lại `SYSTEM_INSTRUCTION` của `/api/recommend`** thành prompt chặt chẽ với 7 quy tắc đánh số rõ ràng: chỉ dùng dữ kiện đã cho (không tự suy diễn luật/số liệu ngoài dữ liệu), không tự kết luận "chắc chắn đủ điều kiện" khi rule-based ghi "Cần rà soát", không lặp lại nguyên văn reasons/gaps, phải nêu rõ các dữ kiện ở ranh giới (ví dụ năm thành lập gần ngưỡng) là điểm cần người dùng tự xác minh, nhắc đối chiếu văn bản gốc trước khi nộp hồ sơ thật. Thêm `EXPLANATIONS_SCHEMA` (Gemini structured output) cho nhánh Google — parse JSON trực tiếp từ `responseSchema` thay vì regex tìm `[...]` trong text tự do (regex vẫn giữ làm fallback cho OpenAI/Anthropic/xAI, các provider chưa có structured-output helper). Thêm lọc `policy_id` không khớp danh sách đã gửi (chặn trường hợp model bịa/gõ sai id, tránh giải thích bị "mồ côi" không có chỗ hiển thị).
4. **Fix một bug thật phát hiện được trong lúc verify tính năng trên** — `parseUploadedText()` (regex fast-path cho .txt) có nhánh fallback: nếu văn bản chứa cụm "đổi mới sáng tạo"/"startup" ở BẤT KỲ ĐÂU trong toàn bộ nội dung thì gán `startup_innovation = true`. Test với hồ sơ năng lực thật của một công ty cơ điện lạnh (không phải startup, thành lập 1977) cho thấy nhánh này bị false-positive vì công ty liệt kê "Đổi mới sáng tạo" như một giá trị cốt lõi trong phần sứ mệnh/tầm nhìn — một cụm từ phổ biến trong văn bản doanh nghiệp bất kỳ, không phải tín hiệu đáng tin về việc đủ điều kiện chương trình khởi nghiệp. Đã bỏ nhánh fallback lỏng lẻo này, chỉ còn giữ lại việc trích xuất theo dòng có nhãn rõ ràng ("Startup: ..." / "Đổi mới sáng tạo: ..."), giống cách các trường khác trong cùng hàm đã làm (bỏ qua nếu không có nhãn rõ, không đoán). Trường này ảnh hưởng trực tiếp đến điểm chấm chính sách nên đây là lỗi đáng sửa ngay, không chỉ là vấn đề UI.
5. **Verify:** `npm run build` sạch sau mỗi thay đổi. Test bằng Playwright trên server thật (port 3100): (a) chọn hồ sơ mẫu "An Phát" (employees=80) rồi nạp file .txt khác — xác nhận employees/revenue/capital reset về 0, tỉnh/ngành reset về "Khác" thay vì giữ 80 cũ (fix #1 hoạt động đúng); (b) sau khi sửa fix #4, `startup_innovation` không còn bị bật sai cho hồ sơ REE Corp. (c) chọn hồ sơ mẫu đầy đủ, bấm "Phân tích và tìm chính sách" — xác nhận cả 8 thẻ chính sách tự động có đoạn phân tích AI (badge "AI") mà không cần bấm nút riêng, đã đọc nội dung thật: model đúng là chỉ dùng dữ kiện đã cho (phân loại DNNVV, năm thành lập, ngành), nêu rõ năm thành lập 2024 là điểm cần tự xác minh, không tự tin quá mức khi match_level là "Cần rà soát" — đúng như 7 quy tắc trong prompt. (d) Nhánh OCR (upload .txt tự do → AI fallback) vẫn bị chặn bởi quota free-tier 20 req/ngày đã cạn (lỗi 429 `RESOURCE_EXHAUSTED`, đã ghi nhận nhiều lần trong tài liệu này) — xác minh được cấu trúc lỗi được xử lý đúng (không crash, hiện thông báo rõ ràng, giữ lại phần dữ liệu regex đã đọc được thay vì xoá sạch), nhưng KHÔNG kiểm chứng được chất lượng văn phong AI của chính nhánh OCR này trong phiên — đã kiểm chứng được nhánh `/api/recommend` (Bước 3) bằng cách đổi `GEMINI_MODEL` sang `gemini-2.5-flash-lite` khi khởi động server test, né được quota đã cạn riêng của `gemini-2.5-flash`.

### 10.1 Theo tính năng (đối chiếu mục 3)

| # | Tính năng | Trạng thái | Thực tế đang chạy trong code |
|---|---|---|---|
| M1 | Data pipeline | **Một phần, đã tốt hơn** | `data/corpus.json` có **35 chunk** (từ 27), gồm tóm tắt tay + trích thật (SMEDF, Hà Nội, NĐ 268/2025, và 8 văn bản luật trung ương mới thêm: NĐ 55/2019, 38/2018, 34/2018, TT 07/2020, 13/2015, 01/2018, 52/2023). **Đã có bước index thật**: `data/corpus_embeddings.json` (embedding từng chunk, `gemini-embedding-001`, 3072 chiều) + BM25 trong `lib/retrieval.ts` — không còn "đọc thẳng mảng JSON" như trước. `data/vbpl_expansion_candidates.json` còn ~400 văn bản (chủ yếu cấp tỉnh, trùng lặp giữa các tỉnh) chưa đưa vào — coi là pool mở rộng cho vòng sau. 8/9 văn bản OCR trong `data/docs/*.md` **vẫn chưa** được chunk theo điều/khoản và nạp vào corpus. |
| M2 | Matching + giải thích | **Điểm số vẫn rule-based, ĐÃ CÓ lớp giải thích LLM** | `matchPolicies()` trong `lib/grantpilot.ts` vẫn là rule-based scoring thuần (không đổi — quyết định điểm số không do LLM). `app/api/recommend/route.ts` gọi LLM sinh giải thích 2-4 câu/chính sách dựa trên điểm+lý do+khoảng thiếu đã có (không tự bịa căn cứ pháp lý), gọi on-demand qua nút "✦ Phân tích sâu hơn bằng AI" trong UI. Đã test thật, output đúng nghiệp vụ. **Mới:** thêm `founded_year` vào form hồ sơ + OCR + ngữ cảnh cho LLM giải thích (trước đó field có trong type nhưng không dùng ở đâu cả); vẫn cố ý **không** thêm ngưỡng cứng theo năm thành lập vào `matchPolicies()` vì thiếu căn cứ pháp lý riêng theo từng chương trình. |
| M3 | RAG Q&A | **ĐÃ NÂNG CẤP — RAG thật + hybrid retrieval** | `app/api/qa/route.ts` (server-side): (1) **retrieval giờ là hybrid thật** — `lib/retrieval.ts` chạy BM25 (Okapi, k1=1.5/b=0.75) song song với dense (cosine similarity trên embedding `gemini-embedding-001`, precompute qua `scripts/build-embeddings.mjs`), fuse bằng Reciprocal Rank Fusion (k=60), lấy top-5; tự rơi về BM25-only nếu thiếu `GEMINI_API_KEY` hoặc embedding lỗi; (2) build prompt gồm system instruction (chỉ trả lời trong phạm vi đoạn trích, phải nói "không đủ thông tin" nếu thiếu căn cứ) + context chunk + hồ sơ doanh nghiệp (nếu có) + câu hỏi; (3) gọi **Gemini thật** (`gemini-2.5-flash` mặc định) để sinh câu trả lời; (4) citations lấy từ chunk đã retrieve (không để LLM tự bịa nguồn) — nếu câu trả lời chứa "không đủ thông tin" thì tự động set `confidence: "Ngoài corpus"` và bỏ citations. Có fallback 2 lớp: mất embedding → BM25-only; mất LLM/API key → `answerQuestion()` rule-based cũ, demo không bao giờ chết. Đã test thật: (a) câu hỏi diễn giải lại (từ đồng nghĩa, không trùng từ khóa với corpus) → hybrid vẫn retrieve đúng chunk nhờ dense, tổng hợp đúng, không hardcode; (b) câu hỏi phân biệt SMEDF vs Quỹ bảo lãnh tín dụng (2 chunk gần nghĩa) → trả lời đúng, không lẫn; (c) câu hỏi ngoài phạm vi corpus → từ chối đúng, không bịa. **Còn thiếu:** reranker (bge-reranker-v2-m3 hoặc tương đương) chưa có; chưa đo RAGAS faithfulness thật. |
| M4 | OCR pre-fill | **ĐÃ CÓ OCR thật (multimodal LLM)** | `app/api/ocr/route.ts` + `generateVisionAnswer()` trong `lib/llmProviders.ts` — nhận ảnh ĐKKD/KQKD (JPG/PNG/WebP), gọi vision LLM (4 nhà cung cấp), trả JSON hồ sơ có cấu trúc. `parseUploadedText()` vẫn giữ nguyên cho luồng `.txt`. Đã test với ảnh giả lập tự tạo — trích xuất đúng 100% trường. RapidOCR/MinerU cho 8 file PDF luật (`data/docs/`) vẫn là script offline riêng (`scripts/extract_legal_pdfs.py`), chưa nối vào luồng upload — đây là 2 luồng OCR khác nhau, không trùng nhau. |
| M5 | Grant assist (checklist + docx + đối chiếu hồ sơ) | **Hoạt động thật, đã thêm bước đối chiếu** | Checklist từ `policies.json` + `/api/grant-docx` (đã sửa bug hardcode "Đề án 844" ở mọi policy — nay động theo `policy.title/program/summary`). **Mới:** `app/api/checklist-match/route.ts` — upload nhiều ảnh tài liệu, vision LLM đối chiếu từng ảnh với từng mục checklist, trả `co/thieu/chua_ro` + giải thích, hiện trực tiếp trong modal (✓/✗/? có màu). Đây là bước "so sánh Đã có/Thiếu" mà trước đó (10.1 bản cũ) chưa có — checklist giờ không còn thuần tĩnh. Giới hạn: chỉ nhận ảnh (không phải PDF nhiều trang), chưa tự sinh biểu mẫu còn thiếu. |
| M6 | Policy watch | **ĐÃ CÓ pipeline theo lịch (batch, không phải real-time)** | `scripts/refresh_policy_watch.py` re-crawl 23 nguồn (so khớp độ tương đồng, không phải hash tuyệt đối) + quét bài mới trên chinhphu.vn (lọc chặt hơn — cần số hiệu văn bản hoặc ≥2 từ khoá). 23 mục trong `policy_watch.json` (10→14→23). Lịch chạy: `.github/workflows/refresh-data.yml` (cron hằng ngày + trigger tay, mở PR để người duyệt trước khi merge — không tự đẩy thẳng `main`). `GET /api/policy-watch/status` đọc báo cáo lần chạy gần nhất cho UI, không tự crawl (Python/Playwright không chạy được trong route Node.js trên Render). |

### 10.2 Theo kiến trúc kỹ thuật (đối chiếu mục 4)

| Lớp trong spec | Kế hoạch ban đầu | Thực tế | 
|---|---|---|
| Backend | FastAPI | **Một phần, nhiều route hơn.** Next.js API route thật: `/api/grant-docx` (xuất docx), `/api/qa` (RAG Q&A), `/api/recommend` (giải thích LLM cho matching), `/api/ocr` (OCR multimodal), `/api/policy-watch/status` (đọc trạng thái Monitoring Pipeline). Matching gốc (M2, tính điểm) vẫn chạy hoàn toàn phía client — chỉ lớp giải thích mới qua route riêng. |
| Orchestration | LangGraph agent router 3 intent | **Không có.** Chuyển tab trên UI gọi thẳng hàm/route tương ứng theo view, không có agent framework hay tool-calling nào (router "thủ công" bằng if/route, không phải LangGraph). |
| Vector store | Chroma | **Không dùng Chroma** — thay bằng `data/corpus_embeddings.json` tĩnh (precompute, load vào bộ nhớ ở request time), đủ dùng ở quy mô 35 chunk nhưng không scale/không cập nhật động như Chroma; chấp nhận được cho quy mô hiện tại, cần Chroma/Qdrant thật nếu corpus lớn hơn nhiều trăm chunk. |
| Retrieval | BM25 + Dense + RRF + Reranker | **ĐÃ CÓ BM25 + Dense + RRF** trong `lib/retrieval.ts` (`hybridRetrieve()`): BM25 Okapi tự viết + dense cosine similarity trên embedding Gemini + fuse bằng RRF, có fallback BM25-only. **Còn thiếu Reranker** — chưa có bước rerank cross-encoder sau khi fuse. |
| Embedding | BGE-M3 (local, miễn phí) | **Dùng Gemini `gemini-embedding-001`** (API, 3072 chiều) thay vì BGE-M3 local — đổi lại "miễn phí, không phụ thuộc quota" lấy "không cần host model riêng"; đánh đổi ngược lại lý do chọn BGE-M3 ban đầu trong spec, cần lưu ý nếu quota Gemini là rủi ro (mục 8). |
| Reranker | bge-reranker-v2-m3 | **Chưa có.** Sau RRF fuse, top-5 được đưa thẳng vào LLM generate, không qua bước rerank cross-encoder riêng. |
| LLM generate + OCR | API multimodal thương mại (1 chính + 1 dự phòng khác nhà cung cấp) | **Cả generate lẫn OCR: ĐÃ CÓ, vượt yêu cầu ban đầu** — `lib/llmProviders.ts` hỗ trợ **4 nhà cung cấp** (Google Gemini, OpenAI, Anthropic Claude, xAI Grok) cho cả sinh văn bản (`generateAnswer`) lẫn ảnh (`generateVisionAnswer`), người dùng tự chọn + nhập key qua modal "Cài đặt AI" (lưu `localStorage`, không lưu server); mặc định dùng `GEMINI_API_KEY` phía server nếu không cấu hình riêng. Có fallback rule-based khi mọi nhà cung cấp đều lỗi/không cấu hình (matching/giải thích), báo lỗi rõ ràng khi OCR thất bại (không có fallback rule-based cho OCR vì bản chất cần đọc ảnh). |
| Deploy | Railway (paid) — spec tự nhận định Render free có rủi ro cold-start "chết demo" | Đang cấu hình Render free (`render.yaml`) — **ngược với khuyến nghị chính spec đã tự đưa ra ở mục 4 và mục 8**; cần quyết định lại trước khi coi là "deploy xong". Nếu deploy lên Render, nhớ set biến môi trường `GEMINI_API_KEY` (và tuỳ chọn `GEMINI_MODEL`) trên dashboard — không có trong repo vì đã gitignore `.env*`. |

### 10.3 Ý nghĩa cho rubric chấm điểm (mục 6)

- **AI-Native Architecture (20%, trọng số cao nhất)** — cải thiện rõ rệt: Q&A có LLM generate thật + hybrid retrieval (BM25+dense+RRF) thật; matching có lớp giải thích LLM (`/api/recommend`); upload có OCR multimodal thật (`/api/ocr`); policy watch có pipeline cập nhật theo lịch. Còn thiếu: agent router (LangGraph — vẫn if/route thủ công), reranker sau RRF. 2 mục con còn thiếu thay vì 4, và phần lõi "RAG" (retrieval + generate có căn cứ) đã chứng minh được bằng test thật, không chỉ tuyên bố.
- **Technical Execution (15%)** — cần số RAGAS faithfulness; đã có đủ pipeline (retrieval + generate) để đo, nhưng chưa chạy đo thật (xem 10.4).
- **Feasibility (15%)** — điểm mạnh thật sự hiện tại: corpus 35 chunk có nhiều nội dung trích thật từ nguồn chính thống (chinhphu.vn, vbpl.vn, smedf.gov.vn), còn ~400 văn bản trung ương/địa phương khác đã lọc sẵn trong `data/vbpl_expansion_candidates.json` làm pool mở rộng cho vòng sau.
- **Deployment (15%)** — cần xác nhận lại Render free có đáp ứng "phản hồi <10s, demo live không cần setup" hay không, do rủi ro cold-start đã tự nhận diện trong chính spec này (mục 4, mục 8); mỗi câu hỏi giờ tốn thêm 1 lần gọi embedding + 1 lần gọi generate qua mạng, cần đo lại độ trễ thực tế.

### 10.4 Việc cần làm để thành sản phẩm hoàn chỉnh (đề xuất, chưa triển khai)

1. ~~Gọi LLM thật để sinh câu trả lời Q&A có citation, thay vì văn bản hardcode theo từ khóa.~~ **Đã xong** (`/api/qa`, Gemini).
2. ~~Vector store + embedding thật để search theo ngữ nghĩa (dense) + BM25 + RRF.~~ **Đã xong** (`lib/retrieval.ts`, `data/corpus_embeddings.json`).
3. ~~Mở rộng corpus từ nguồn thật ngoài 27 chunk ban đầu.~~ **Đã xong một phần** — thêm 8 văn bản luật trung ương (27→35 chunk); còn ~400 văn bản trong `data/vbpl_expansion_candidates.json` (chủ yếu cấp tỉnh, trùng lặp cao) chưa xử lý, giá trị biên thấp hơn nên tạm dừng ở đây.
4. Reranker (bge-reranker-v2-m3 hoặc gọi LLM rerank top-N) sau bước RRF fuse — chưa có, là phần cuối còn thiếu của "BM25+Dense+RRF+Reranker".
5. ~~Backend thật cho matching (M2), thêm "LLM giải thích" như spec mục 4 yêu cầu.~~ **Đã xong** — `/api/recommend`, xem 10.1/10.2. Lưu ý: chỉ lớp giải thích chạy qua backend; điểm số (`matchPolicies`) vẫn cố ý giữ rule-based/client-side (nhanh, không tốn quota cho thao tác lọc/sắp xếp chính).
6. Chunk 8 file OCR trong `data/docs/` theo điều/khoản, nạp vào index thay vì để nguyên văn bản thô.
7. ~~OCR ảnh/scan thật (multimodal LLM) cho luồng upload, không chỉ parse `.txt`.~~ **Đã xong** — `/api/ocr` + `generateVisionAnswer()`, xem 10.1/10.2.
8. Đo RAGAS faithfulness trên bộ câu hỏi vàng — đã khả thi vì có pipeline retrieval+generate thật.
9. ~~Key LLM dự phòng ở nhà cung cấp thứ 2 (rủi ro mục 8 "API LLM quota/downtime").~~ **Đã xong, vượt yêu cầu** — `lib/llmProviders.ts` + modal "Cài đặt AI" hỗ trợ Gemini/OpenAI/Anthropic/xAI, người dùng tự chọn key dự phòng khi cần thay vì chỉ 1 key thứ 2 cấu hình cứng.
10. Quyết định lại nền tảng deploy (Render free vs phương án trả phí) theo đúng rủi ro cold-start đã nêu ở mục 4 và mục 8; nhớ set `GEMINI_API_KEY` trên môi trường deploy (dùng làm mặc định — người dùng vẫn có thể tự nhập key riêng qua UI bất kể server có cấu hình hay không).
11. MinerU (thay cho pdftoppm+RapidOCR) cho OCR văn bản luật — cài đặt được trên máy dev (pipeline backend, CPU-only, xem log cài đặt), chưa test lại trên 8 file PDF hiện có.
12. ~~Monitoring pipeline cho policy watch (M6).~~ **Đã xong ở dạng batch/scheduled** — `scripts/refresh_policy_watch.py` + `.github/workflows/refresh-data.yml` + `GET /api/policy-watch/status`, xem 10.1/10.2. Còn thiếu nếu muốn thật sự real-time: cần một process/server thường trú (ngoài phạm vi Next.js-trên-Render hiện tại) — chưa triển khai, chưa có kế hoạch cụ thể.
13. Bật "Allow GitHub Actions to create and approve pull requests" trong Settings > Actions của repo — cần thao tác tay trên GitHub, không thể làm qua code; nếu chưa bật, job `refresh-data.yml` sẽ chạy xong việc crawl nhưng lỗi ở bước mở PR.
14. Sửa bug `/api/grant-docx` hardcode "Đề án 844" cho mọi policy. ~~Đã xong~~ — tiêu đề/nội dung/tên file nay lấy động theo policy đang chọn.
15. Wire `founded_year` vào form hồ sơ, OCR, và ngữ cảnh LLM giải thích. ~~Đã xong~~ — cố ý chưa thêm ngưỡng cứng theo năm thành lập vào rule-based matching vì thiếu căn cứ pháp lý riêng theo từng chương trình trong corpus hiện có; nếu sau này có căn cứ, thêm vào `matchPolicies()` ở `lib/grantpilot.ts`.
16. Document Checklist — so khớp "đã có/thiếu" giữa tài liệu người dùng tải lên và checklist mỗi policy. ~~Đã xong (bản ảnh)~~ — `app/api/checklist-match/route.ts`, UI trong modal chi tiết policy. Còn thiếu: chỉ nhận ảnh, chưa nhận PDF nhiều trang; chưa tự động sinh biểu mẫu cho các mục "thiếu" (Auto Form Filling thật).
17. Thêm chương trình hỗ trợ mới ngoài 8 policy hiện có (đã thêm `p_nd268_recognition`, `p_nd38_investment_fund` ở lần 6, xem đoạn "Cập nhật 2026-07-18 (lần 6)" đầu mục 10) — cụ thể **NIC, NAFOSTED, Quỹ Đổi mới công nghệ quốc gia** vẫn còn thiếu, cần crawl + xác minh nguồn mới (chưa có sẵn trong corpus như 2 policy vừa thêm) trước khi đưa vào `data/policies.json`. Quan trọng hơn các mục khác vì đúng track thi (NIC) và rubric "Problem Relevance" 20%.
18. Thu thập biểu mẫu gốc thật (Word/PDF/Excel do từng chương trình công bố) + metadata. ~~Bắt đầu có~~ (lần 8) — `p_nd268_recognition` đã có 1 mẫu đơn thật (Mẫu IV.1.1) qua field `forms` mới trên `Policy` type, link thẳng vbpl.vn. Còn 7/8 policy khác chưa có biểu mẫu gốc nào; `/api/grant-docx` vẫn chỉ soạn văn bản tóm tắt, chưa thật sự điền vào mẫu IV.1.1 (đó vẫn là bước "Auto Form Filling" thật sự, chưa làm — hiện chỉ mới có link tải mẫu, người dùng tự điền tay).
19. Quy trình nộp hồ sơ (nộp ở đâu, hạn cuối, các bước xét duyệt) — `Policy` type chưa có field nào cho việc này; cần bổ sung sau khi có nguồn xác thực cho từng chương trình.
