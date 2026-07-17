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
