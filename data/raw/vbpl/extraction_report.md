# VBPL file extraction report

Đã xử lý 99 tệp trong 47 thư mục văn bản dưới `data/raw/vbpl/files/`.
Trích xuất text thô vào `data/raw/vbpl/extracted/{document_id}/`. Chưa đưa vào `data/corpus.json` — bước gộp vào RAG corpus (chunk theo điều/khoản, gán metadata, review) là quyết định riêng, làm sau khi đã soát lỗi trích xuất.

## Tổng hợp theo trạng thái

| Trạng thái | Số tệp |
|---|---|
| ok | 78 |
| possibly_scanned_needs_ocr | 14 |
| legacy_font_encoding_unrecoverable | 4 |
| text_layer_unreliable_needs_ocr | 1 |
| empty_file | 1 |
| unrecognized_format | 1 |

## Theo dõi thủ công: 14 tệp `possibly_scanned_needs_ocr`

Đã rà lại từng thư mục văn bản của 14 tệp này để xem có bản `.doc`/`.docx`/`.html` sạch nào khác trong cùng thư mục đã bao phủ cùng nội dung không, trước khi quyết định có đáng OCR hay không:

- **11/14 tệp bỏ qua vì trùng lặp** — cùng thư mục đã có bản trích xuất "ok" từ file khác (chữ ký số/scan lại của cùng văn bản .doc/.docx gốc): `135973`, `138456`, `154004`, `159227`, `83314`, và cả 5 file PDF phụ lục của `183411` (đã có đủ 6 file .docx sạch `PL I`–`PL VI` + văn bản chính `268_2025_ND-CP_663962.docx`).
- **1/14 tệp đã có OCR sẵn từ trước** — `158782` (Thông tư 06/2022/TT-BKHĐT, 62 trang) trùng với `tt06_2022` đã được `extract_legal_pdfs.py` OCR trong một phiên làm việc trước đó → xem `data/docs/tt06_2022.md` (không OCR lại).
- **3/14 tệp không có bản sạch nào khác → đã chạy OCR riêng** (`scripts/ocr_vbpl_scanned_pdfs.py`, cùng cách làm với `extract_legal_pdfs.py`: `pdftoppm` render trang + `rapidocr-onnxruntime`):
  - `151048/VanBanGoc_64.signed.pdf` (Thông tư 64/2021/TT-BTC, 5 trang) → `data/raw/vbpl/extracted/151048/VanBanGoc_64.signed_ocr.txt`
  - `163729/VanBanGoc_52_10082023_172756.pdf` (Thông tư 52/2023/TT-BTC, 19 trang) → `data/raw/vbpl/extracted/163729/VanBanGoc_52_10082023_172756_ocr.txt`
  - `177569/VanBanGoc_09.TT.pdf` (Thông tư 09/2025/TT-BTC, 6 trang) → `data/raw/vbpl/extracted/177569/VanBanGoc_09.TT_ocr.txt`
  - Cùng chất lượng đã ghi nhận cho các file OCR trước đó trong dự án: `ocr_quality: draft_unaccented_needs_human_review` — rapidocr mất dấu tiếng Việt ở phần lớn dòng, chỉ dùng làm bản nháp để search/chunk hoặc đối chiếu, không dùng trực tiếp làm căn cứ pháp lý hiển thị cho người dùng mà chưa có người review.

## Chi tiết từng tệp

| document_id | tệp nguồn | loại phát hiện | phương pháp | trạng thái | số ký tự | ghi chú |
|---|---|---|---|---|---|---|
| 10598 | 77.TC-CÐKT.doc | ole_doc | antiword -m UTF-8.txt | ok | 4056 |  |
| 107366 | 107366_body_content.html | html | html-strip | ok | 15866 |  |
| 107366 | 170-2009-TT-BTC_170_2009_TT-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 13414 |  |
| 107366 | 170_2009_TT-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 13414 |  |
| 107366 | VanBanGoc_170-2009-TT-BTC.pdf | pdf | pypdf | ok | 8968 |  |
| 107366 | VanBanGoc_170-2009-TT-BTC_Phu luc.pdf | pdf | pypdf | ok | 1730 |  |
| 107883 | 06_2009_TTLT- BLĐTBXH-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 14810 |  |
| 107883 | 28057_1.doc | ole_doc | antiword -m UTF-8.txt | ok | 14004 |  |
| 108311 | 68-TC_TCDN.doc | rtf | striprtf | legacy_font_encoding_unrecoverable | 17648 | legacy_font_encoding_unrecoverable |
| 108352 | 05-TT_LB.doc | rtf | striprtf | legacy_font_encoding_unrecoverable | 6465 | legacy_font_encoding_unrecoverable |
| 108352 | 05_TT-LB.doc | rtf | striprtf | legacy_font_encoding_unrecoverable | 14809 | legacy_font_encoding_unrecoverable |
| 109653 | 1275_QĐ-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 3785 |  |
| 11005 | 05_TT-LB_41851.doc | ole_doc | antiword -m UTF-8.txt | ok | 12076 |  |
| 110875 | VanBanGoc_71-2015-TT-BTC_71-2015-TT-BTC.pdf | pdf | pypdf | ok | 11844 |  |
| 110952 | VanBanGoc_21-2016-TT-BTC_21-2016-TT-BTC.pdf | pdf | pypdf | ok | 8278 |  |
| 135973 | 32_2018_TT-BLDTBXH_409295 (1).doc | ole_doc | antiword -m UTF-8.txt | ok | 14810 |  |
| 135973 | VanBanGoc_409295 (1).pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 6 pages — likely a scanned PDF with no text layer |
| 13646 | 1213.QD.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 2281 |  |
| 138456 | PhuluckemtheoThongtu 02_2019.docx | docx | mammoth | ok | 5295 | Message(type='warning', message='An unrecognised element was ignored: v:line'); Message(type='warning', message='An unrecognised element was ignored: w:tblPrEx') |
| 138456 | Thongtu 02_2019.doc | ole_doc | antiword -m UTF-8.txt | ok | 4236 |  |
| 138456 | VanBanGoc_02_2019_tt-bkhcn.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 5 pages — likely a scanned PDF with no text layer |
| 143411 | 143411_body_content.html | html | html-strip | ok | 6612 |  |
| 143411 | PL.TT.19.2019.docx | docx | mammoth | ok | 2055 |  |
| 143411 | TT.49.2019.TT.BGTVT.docx | docx | mammoth | ok | 7098 | Message(type='warning', message='An unrecognised element was ignored: v:line'); Message(type='warning', message='An unrecognised element was ignored: w:moveFromRangeStart'); Message(type='warning', me |
| 14865 | 102.2006.TTLT.BTC.BKHCN.doc | ole_doc | antiword -m UTF-8.txt | ok | 23238 |  |
| 14865 | 14865_body_content.html | html | html-strip | ok | 19421 |  |
| 150955 | VanBanGoc_35.2021.TT.PDF | pdf | pypdf | text_layer_unreliable_needs_ocr | 24351 | low_diacritic_density_check_manually |
| 151048 | VanBanGoc_64.signed.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 5 pages — likely a scanned PDF with no text layer |
| 154003 | 154003_body_content.html | html | html-strip | ok | 13943 |  |
| 154003 | Phu luc kèm TT03-2022-TT-NHNN.docx | docx | mammoth | ok | 8483 | Message(type='warning', message='An unrecognised element was ignored: v:line') |
| 154003 | Thong tu 03-2022-TT-NHNN.docx | docx | mammoth | ok | 14928 | Message(type='warning', message='An unrecognised element was ignored: v:line') |
| 154003 | VanBanGoc_Thong tu 03.2022-TT-NHNN.PDF | pdf | pypdf | ok | 22949 |  |
| 154003 | VanBanGoc_Thong tu 03.2022.TT.NHNN.PDF | pdf | pypdf | ok | 23106 |  |
| 154004 | 154004_body_content.html | html | html-strip | ok | 25024 |  |
| 154004 | Nghị định 31-2022-NĐ-CP.doc | ole_doc | antiword -m UTF-8.txt | ok | 29535 |  |
| 154004 | Phụ lục đính kèm Nghị định 31-2022-NĐ-CP.docx | docx | mammoth | ok | 15672 | Message(type='warning', message='An unrecognised element was ignored: w:tblPrEx') |
| 154004 | VanBanGoc_Nghị định 31-2022-NĐ-CP.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 27 pages — likely a scanned PDF with no text layer |
| 15867 | 11.2006.QD.BKHCN.doc | ole_doc | antiword -m UTF-8.txt | ok | 2686 |  |
| 158782 | VanBanGoc_06.2022.TT.BKHĐT (PDF).pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 62 pages — likely a scanned PDF with no text layer |
| 158783 | Template.pdf | pdf | pypdf | ok | 27 |  |
| 158783 | VanBanGoc_80.2021.NĐ.CP (PDF).pdf | empty | - | empty_file | 0 |  |
| 159227 | 0.thong tu 07.2020.doc | ole_doc | antiword -m UTF-8.txt | ok | 22775 |  |
| 159227 | 159227_body_content.html | html | html-strip | ok | 12230 |  |
| 159227 | VanBanGoc_07-bkhcn.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 12 pages — likely a scanned PDF with no text layer |
| 16334 | 25.2006.TT.BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 15556 |  |
| 163729 | VanBanGoc_52_10082023_172756.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 19 pages — likely a scanned PDF with no text layer |
| 16776 | 68.2005.QD.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 9412 |  |
| 16777 | 16777_body_content.html | html | html-strip | ok | 1024 |  |
| 16777 | 36.2006.QD.TTg.zip -> 36.2006.QD.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 1886 |  |
| 16777 | Quy che.zip -> Quy che.doc | ole_doc | antiword -m UTF-8.txt | ok | 25415 |  |
| 177569 | VanBanGoc_09.TT.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 6 pages — likely a scanned PDF with no text layer |
| 183411 | 183411_body_content.html | html | html-strip | ok | 146754 |  |
| 183411 | 268_2025_ND-CP_663962.docx | docx | mammoth | ok | 148714 | Message(type='warning', message='An unrecognised element was ignored: w:tblPrEx') |
| 183411 | PL I - NV DMST-đã gộp.docx | docx | mammoth | ok | 64220 | Message(type='warning', message='An unrecognised element was ignored: v:stroke'); Message(type='warning', message='An unrecognised element was ignored: v:path'); Message(type='warning', message='An un |
| 183411 | PL II - NV HTLSV. đã gộp.docx | docx | mammoth | ok | 21383 | Message(type='warning', message='An unrecognised element was ignored: w:tblPrEx') |
| 183411 | PL III - Voucher-đã gộp.docx | docx | mammoth | ok | 17508 |  |
| 183411 | PL IV - Cong nhan DMST,KNST_đã gộp.docx | docx | mammoth | ok | 116932 | Message(type='warning', message='A w:sym element with an unsupported character was ignored: char F097 in font Symbol'); Message(type='warning', message='An unrecognised element was ignored: v:stroke') |
| 183411 | PL V - DN KHCN-đã gộp.docx | docx | mammoth | ok | 11926 | Message(type='warning', message='An unrecognised element was ignored: v:line'); Message(type='warning', message='Image of type image/x-emf is unlikely to display in web browsers'); Message(type='warni |
| 183411 | PL VI - Ho tro hoat dong-đã gộp.docx | docx | mammoth | ok | 32250 | Message(type='warning', message='An unrecognised element was ignored: w:tblPrEx') |
| 183411 | VanBanGoc_268-cp.signed.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 69 pages — likely a scanned PDF with no text layer |
| 183411 | VanBanGoc_pl1.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 56 pages — likely a scanned PDF with no text layer |
| 183411 | VanBanGoc_pl2.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 19 pages — likely a scanned PDF with no text layer |
| 183411 | VanBanGoc_pl3-4.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 106 pages — likely a scanned PDF with no text layer |
| 183411 | VanBanGoc_pl5-6.pdf | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 2 chars/page across 42 pages — likely a scanned PDF with no text layer |
| 18372 | 192.2004.QD.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 3509 |  |
| 21370 | 70.2003.QD.BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 3819 |  |
| 23967 | 113.2008.QD.TTg.doc | html_utf16 | html-strip | ok | 3997 |  |
| 23967 | Phu luc.113.2008.QD.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 8401 |  |
| 23967 | Quy che.113.2008.QD.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 32422 |  |
| 25984 | 06.2009.TTLT-BLĐTBXH-BTC.zip -> 06.2009.TTLT-BLĐTBXH-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 13619 |  |
| 25984 | 06_2009_TTLT-BLĐTBXH-BTC.doc | unknown | - | unrecognized_format | 0 |  |
| 25984 | Mau.zip -> Mau.doc | ole_doc | antiword -m UTF-8.txt | ok | 14348 |  |
| 27965 | 141_2012_TTLT-BTC-BQP-BCA.doc | ole_doc | antiword -m UTF-8.txt | ok | 22129 |  |
| 27965 | VanBanGoc_141-2012-TTLT-BTC-BQP-BCA_141-2012-TTLT-BTC-BQP-BCA.pdf | pdf | pypdf | ok | 18573 |  |
| 27965 | VanBanGoc_141_2012_TTLT-BTC-BQP-BCA.pdf | pdf | pypdf | legacy_font_encoding_unrecoverable | 18323 | legacy_font_encoding_unrecoverable |
| 30297 | 10.2013.TT.BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 33969 |  |
| 30297 | 10_2013_TT-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 36045 |  |
| 30297 | 41724_1.doc | ole_doc | antiword -m UTF-8.txt | ok | 7610 |  |
| 30297 | Phu luc.doc | ole_doc | antiword -m UTF-8.txt | ok | 7254 |  |
| 30297 | VanBanGoc_10-2013-TT-BTC_10-2013-TT-BTC.pdf | pdf | pypdf | ok | 31813 |  |
| 30297 | VanBanGoc_10-2013-TT-BTC_Phu luc.pdf | pdf | pypdf | ok | 4647 |  |
| 30297 | VanBanGoc_10_2013_TT-BTC.pdf | pdf | pypdf | ok | 36829 |  |
| 37690 | 49.2014.TTLT.BTC.BKHCN.doc | ole_doc | antiword -m UTF-8.txt | ok | 29355 |  |
| 37690 | VanBanGoc_49-2014-TTLT-BTC-BKHCN_49-2014-TTLT-BTC-BKHCN.pdf | pdf | pypdf | ok | 25827 |  |
| 37690 | VanBanGoc_49.2014.TTLT.BTC.BKHCN.pdf | pdf | pypdf | ok | 26550 |  |
| 40789 | 585.QĐ.TTg.doc | ole_doc | antiword -m UTF-8.txt | ok | 19379 |  |
| 40789 | 585.QĐ.TTg_Phuluc.doc | ole_doc | antiword -m UTF-8.txt | ok | 26561 |  |
| 5998 | 163.2000.QD.BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 5984 |  |
| 68173 | 71.2015.TT.BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 13703 |  |
| 68173 | VanBanGoc_71.2015.TT.BTC.pdf | pdf | pypdf | ok | 11813 |  |
| 8281 | 68.TT.TCDN.doc | ole_doc | antiword -m UTF-8.txt | ok | 19398 |  |
| 83279 | 170.2009.TT.BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 10494 |  |
| 83279 | 170.2009.TT.BTC.Phu luc.doc | ole_doc | antiword -m UTF-8.txt | ok | 2697 |  |
| 83314 | 104_2008_QĐ-BTC.doc | ole_doc | antiword -m UTF-8.txt | ok | 6214 |  |
| 83314 | VanBanGoc_104-2008-QĐ-BTC_104-2008-QĐ-BTC.pdf | pdf | pypdf | ok | 4601 |  |
| 83314 | VanBanGoc_27553_1.PDF | pdf | pypdf | possibly_scanned_needs_ocr | 0 | avg 1 chars/page across 3 pages — likely a scanned PDF with no text layer |
| 88186 | 263.2003.QD.UBDT.doc | ole_doc | antiword -m UTF-8.txt | ok | 3687 |  |
| 92617 | 13.2015.TT.BKHĐT.doc | ole_doc | antiword -m UTF-8.txt | ok | 16490 |  |
| 92617 | VanBanGoc_13.2015.TT.BKHĐT.pdf | pdf | pypdf | ok | 11523 |  |