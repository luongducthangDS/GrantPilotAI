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

**Cập nhật 2026-07-18 (sau bản đầu của mục này):** M3 (RAG Q&A) đã được nâng cấp thành RAG thật — xem ghi chú "ĐÃ NÂNG CẤP" trong bảng 10.1 và 10.2. Các mục còn lại (backend cho matching, vector store/hybrid retrieval, OCR multimodal, agent router, RAGAS, deploy) **vẫn chưa triển khai**, giữ nguyên as-is bên dưới.

### 10.1 Theo tính năng (đối chiếu mục 3)

| # | Tính năng | Trạng thái | Thực tế đang chạy trong code |
|---|---|---|---|
| M1 | Data pipeline | **Một phần** | `data/corpus.json` có 27 chunk, gồm cả tóm tắt tay lẫn trích thật (SMEDF, Hà Nội, NĐ 268/2025...), nhưng **không có bước index** — không vector store, không BM25 index, chỉ là mảng JSON đọc thẳng vào bộ nhớ trình duyệt. 8/9 văn bản luật đã OCR ra `data/docs/*.md` làm lớp tham chiếu nhưng **chưa được chunk theo điều/khoản và nạp vào corpus** — vẫn là văn bản thô, chưa dùng được cho matching/Q&A. |
| M2 | Matching | **Chạy được, không có LLM** | `matchPolicies()` trong `lib/grantpilot.ts` là rule-based scoring thuần (cộng/trừ điểm theo điều kiện cứng: SME, startup, ngành, tỉnh). Không có bước "LLM giải thích" như kiến trúc mục 4 yêu cầu. Chạy 100% phía client, không gọi backend nào. |
| M3 | RAG Q&A | **ĐÃ NÂNG CẤP — RAG thật** | `app/api/qa/route.ts` (server-side): (1) retrieval vẫn là đếm token trùng khớp (`retrieveCorpusChunks`, chưa phải BM25/dense — xem mục 10.2), lấy top-5 chunk; (2) build prompt gồm system instruction (chỉ trả lời trong phạm vi đoạn trích, phải nói "không đủ thông tin" nếu thiếu căn cứ) + context chunk + hồ sơ doanh nghiệp (nếu có) + câu hỏi; (3) gọi **Gemini thật** (`@google/genai`, model `gemini-2.5-flash` mặc định, key qua env `GEMINI_API_KEY`) để sinh câu trả lời; (4) citations lấy từ chunk đã retrieve (không để LLM tự bịa nguồn) — nếu câu trả lời chứa "không đủ thông tin" thì tự động set `confidence: "Ngoài corpus"` và bỏ citations. Có fallback: nếu thiếu `GEMINI_API_KEY` hoặc gọi LLM lỗi (quota/network), tự động dùng lại `answerQuestion()` cũ (rule-based) để demo không chết — đúng tinh thần rủi ro đã nêu ở mục 8. Đã test thật: (a) câu hỏi diễn giải lại không nằm trong 10 câu vàng → tổng hợp đúng từ nhiều chunk, không hardcode; (b) câu hỏi ngoài phạm vi corpus (vd. "miễn toàn bộ thuế 10 năm", "thời tiết Hà Nội") → từ chối đúng, không bịa. **Còn thiếu để tính là RAGAS-verified:** chưa chạy bộ đo RAGAS faithfulness thật trên 10 câu hỏi vàng. |
| M4 | OCR pre-fill | **Không phải OCR** | `parseUploadedText()` chỉ regex-parse file `.txt` thuần theo format `key: value` cố định — không đọc ảnh/scan, không gọi multimodal LLM nào. RapidOCR đã dùng để OCR 8 file PDF luật (`data/docs/`) là **script offline chạy riêng** (`scripts/extract_legal_pdfs.py`), chưa nối vào luồng upload thật của app. |
| M5 | Grant assist (checklist + docx) | **Hoạt động thật** | Checklist tĩnh từ `policies.json` + API route `/api/grant-docx` dùng thư viện `docx` sinh file `.docx` thật — đã verify tải về và mở được. Đây là phần hoàn chỉnh nhất của sản phẩm hiện tại. |
| M6 | Policy watch | **Đúng tinh thần mock ban đầu** | 10 mục tĩnh trong `policy_watch.json` (đã mở rộng nội dung từ 5 lên 10 sau đợt crawl), không có backend theo dõi thật — khớp đúng "Non-goal" đã ghi ở mục 1. |

### 10.2 Theo kiến trúc kỹ thuật (đối chiếu mục 4)

| Lớp trong spec | Kế hoạch ban đầu | Thực tế | 
|---|---|---|
| Backend | FastAPI | **Một phần.** 2 Next.js API route thật: `/api/grant-docx` (xuất docx) và **`/api/qa` (RAG Q&A, mới)**. Matching (M2) vẫn chạy hoàn toàn phía client, chưa có route riêng. |
| Orchestration | LangGraph agent router 3 intent | **Không có.** Chuyển tab trên UI gọi thẳng hàm/route tương ứng theo view, không có agent framework hay tool-calling nào (router "thủ công" bằng if/route, không phải LangGraph). |
| Vector store | Chroma | **Không có.** Không embedding nào được sinh ra hay lưu trữ; `/api/qa` vẫn retrieve trên mảng JSON trong bộ nhớ. |
| Retrieval | BM25 + Dense + RRF + Reranker | **Không có — vẫn là đếm token trùng khớp** (set intersection) trên chuỗi đã chuẩn hoá/bỏ dấu, chạy server-side trong `/api/qa`. Đây là phần yếu nhất còn lại của pipeline RAG: retrieval "ngây thơ" có thể bỏ sót chunk liên quan nếu câu hỏi dùng từ đồng nghĩa/cách diễn đạt khác. |
| Embedding | BGE-M3 | Không dùng. |
| Reranker | bge-reranker-v2-m3 | Không dùng. |
| LLM generate + OCR | API multimodal thương mại (1 chính + 1 dự phòng) | **Generate: ĐÃ CÓ** — Gemini (`gemini-2.5-flash` qua `@google/genai`) sinh câu trả lời Q&A thật trong `/api/qa`, có fallback rule-based khi lỗi/thiếu key. Chưa có key dự phòng ở nhà cung cấp thứ 2 như spec yêu cầu (rủi ro mục 8 "API LLM quota/downtime"). **OCR: vẫn chưa có** — upload vẫn chỉ parse `.txt` thuần, chưa nối multimodal LLM. |
| Deploy | Railway (paid) — spec tự nhận định Render free có rủi ro cold-start "chết demo" | Đang cấu hình Render free (`render.yaml`) — **ngược với khuyến nghị chính spec đã tự đưa ra ở mục 4 và mục 8**; cần quyết định lại trước khi coi là "deploy xong". Nếu deploy lên Render, nhớ set biến môi trường `GEMINI_API_KEY` (và tuỳ chọn `GEMINI_MODEL`) trên dashboard — không có trong repo vì đã gitignore `.env*`. |

### 10.3 Ý nghĩa cho rubric chấm điểm (mục 6)

- **AI-Native Architecture (20%, trọng số cao nhất)** — đỡ hơn nhưng vẫn rủi ro: tiêu chí này chấm "agent router 3 intent, hybrid retrieval, LLM-assisted labeling, OCR multimodal". Q&A giờ có LLM generate thật, nhưng **agent router, hybrid retrieval (BM25+dense+RRF+reranker) và OCR multimodal vẫn chưa có** — 3/4 mục vẫn thiếu.
- **Technical Execution (15%)** — cần số RAGAS faithfulness; giờ đã có bước LLM generate nên **đo được**, nhưng chưa chạy đo thật (xem 10.4).
- **Feasibility (15%)** — điểm mạnh thật sự hiện tại: corpus đã có nhiều nội dung trích thật từ nguồn chính thống (chinhphu.vn, vbpl.vn, smedf.gov.vn) sau đợt crawl vừa qua, không còn chỉ là seed demo.
- **Deployment (15%)** — cần xác nhận lại Render free có đáp ứng "phản hồi <10s, demo live không cần setup" hay không, do rủi ro cold-start đã tự nhận diện trong chính spec này (mục 4, mục 8); gọi Gemini qua mạng cũng cộng thêm độ trễ cần đo lại.

### 10.4 Việc cần làm để thành sản phẩm hoàn chỉnh (đề xuất, chưa triển khai)

1. ~~Gọi LLM thật để sinh câu trả lời Q&A có citation, thay vì văn bản hardcode theo từ khóa.~~ **Đã xong** (`/api/qa`, Gemini).
2. Backend thật cho matching (M2) — hiện matching vẫn chạy client-side, nên chuyển vào route riêng để nhất quán với Q&A và dễ thêm "LLM giải thích" như spec mục 4 yêu cầu.
3. Vector store + embedding thật để search theo ngữ nghĩa thay vì đếm từ trùng khớp — retrieval hiện là điểm yếu nhất của pipeline RAG.
4. Chunk 8 file OCR trong `data/docs/` theo điều/khoản, nạp vào index thay vì để nguyên văn bản thô.
5. OCR ảnh/scan thật (multimodal LLM) cho luồng upload, không chỉ parse `.txt`.
6. Đo RAGAS faithfulness trên bộ câu hỏi vàng — giờ đã khả thi vì có LLM generate thật.
7. Key LLM dự phòng ở nhà cung cấp thứ 2 (theo đúng rủi ro mục 8 "API LLM quota/downtime").
8. Quyết định lại nền tảng deploy (Render free vs phương án trả phí) theo đúng rủi ro cold-start đã nêu ở mục 4 và mục 8.
