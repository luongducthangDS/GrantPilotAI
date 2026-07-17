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

## Deploy Render

Repo đã có `render.yaml` cho Render Web Service:

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Node version: `22`

Trên Render, tạo Blueprint hoặc Web Service từ GitHub repo này. Sau khi build xong, Render sẽ cấp URL dạng `https://<service-name>.onrender.com`.

## Luồng demo nhanh

1. Chọn hồ sơ mẫu `NovaMind AI`, chạy matching.
2. Mở `Q&A pháp lý`, thử 10 câu hỏi vàng.
3. Mở `Hồ sơ 844`, tải đơn `.docx`.
4. Chuyển hồ sơ mẫu sang `Cơ khí An Phát` để thấy kết quả ưu tiên SMEDF và chuỗi giá trị.
5. Thử upload `data/synthetic_dkkd_novamind.txt` hoặc `data/synthetic_dkkd_anphat.txt` ở ô OCR mock.

## Dữ liệu seed

- `data/sample_profiles.json`: 2 hồ sơ demo.
- `data/policies.json`: rule matching, citation, checklist.
- `data/corpus.json`: corpus Q&A theo điều/khoản.
- `data/policy_watch.json`: policy watch mock.

MVP này không gọi API LLM để tránh rủi ro quota trong demo. Kiến trúc dữ liệu giữ citation, trạng thái hiệu lực và nguồn để thay bằng RAG/LLM thật ở vòng tiếp theo.

## Bản Streamlit dự phòng

Các file Python cũ vẫn được giữ để dự phòng:

```powershell
pip install -r requirements.txt
streamlit run app.py
```
