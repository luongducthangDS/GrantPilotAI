# Source Verification

Last checked: 2026-07-17.

This file records the sources used by the demo seed data. The goal is to avoid showing broken or misleading citations during the MVP demo.

| Item | Source | Verification result | Demo status |
|---|---|---|---|
| Nghị định 80/2021/NĐ-CP | https://vanban.chinhphu.vn/default.aspx?docid=203941&pageid=27160 | HTTP 200; page contains `80/2021` and `doanh nghiệp nhỏ và vừa`. | Còn hiệu lực |
| Luật Hỗ trợ DNNVV 2017 | https://vanban.chinhphu.vn/default.aspx?docid=190283&pageid=27160 | HTTP 200; page contains `04/2017` and `doanh nghiệp nhỏ và vừa`. CSDL VBPL was used separately to check `Hết hiệu lực một phần`. | Hết hiệu lực một phần |
| Thông tư 06/2022/TT-BKHĐT | https://vanban.chinhphu.vn/?docid=205807&pageid=27160 | HTTP 200; page contains `06/2022` and `doanh nghiệp nhỏ và vừa`. | Còn hiệu lực |
| Quyết định 844/QĐ-TTg | https://vanban.chinhphu.vn/default.aspx?docid=184702&pageid=27160 | HTTP 200; page contains `844/QĐ-TTg` and title states the scheme is to 2025. | Đề án đến năm 2025 - cần xác minh đợt mới |
| Thông tư 45/2019/TT-BTC | https://chinhphu.vn/default.aspx?docid=197478&pageid=27160 | HTTP 200; page contains `45/2019` and `khởi nghiệp đổi mới sáng tạo`. | Còn hiệu lực |
| SMEDF chương trình vay vốn | https://smedf.gov.vn/chuong-trinh-vay-von/ | HTTP 200; page contains `SMEDF` and `Chương trình vay vốn`. | Còn hiệu lực |
| Luật Đầu tư 2020 | https://vanban.chinhphu.vn/default.aspx?docid=200449&pageid=27160 | HTTP 200; page contains `61/2020` and `Luật Đầu tư`. CSDL VBPL/search indicates the 2020 law must be rechecked for 2026 because of the 2025 investment-law update. | Cần cập nhật theo Luật Đầu tư 2025/2026 |
| Nghị định 31/2021/NĐ-CP | https://vanban.chinhphu.vn/?docid=202988&pageid=27160 | HTTP 200; page contains `31/2021` and `Luật Đầu tư`. | Đã được sửa đổi/bổ sung - cần rà soát theo Luật Đầu tư 2025 |
| Hà Nội startup ecosystem | https://vienktxh.hanoi.gov.vn/nghien-cuu-trao-doi/thuc-tien-he-sinh-thai-khoi-nghiep-doi-moi-sang-tao-tren-dia-ban-thanh-pho-ha-noi-126761.html | HTTP 200; page contains `Hà Nội` and `khởi nghiệp đổi mới sáng tạo`; it is ecosystem context, not a direct application notice. | Seed demo - cần xác minh khi nộp thật |

Notes:

- Old `vbpl.vn/TW/Pages/vbpq-toanvan.aspx?...` URLs returned 404 and were removed.
- `dean844.most.gov.vn` and `startupcity.vn` were not reliable enough for live demo links, so the data now uses Cổng Thông tin điện tử Chính phủ and a Hanoi public-sector article instead.
- The investment-incentive policy is retained only as a roadmap/demo branch. It is explicitly marked as needing update before real submission in 2026.
- `data_v2.zip` was removed because its `vbpl.vn/pages/portal.aspx?q=...` links are not stable deep links, and `dean844.most.gov.vn` / `startupcity.vn` failed live checks.
- The current SQLite database can be refreshed with `npm run data:refresh`.
