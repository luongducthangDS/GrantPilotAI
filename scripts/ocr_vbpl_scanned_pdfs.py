"""OCR the handful of vbpl attachment PDFs that have no usable text layer.

extract_vbpl_files.py flagged 14 PDFs as "possibly_scanned_needs_ocr", but 11
of those are redundant scans of a document that already has a clean .doc/
.docx extraction sitting right next to it in the same folder (or, for
document 158782 / Thông tư 06/2022/TT-BKHĐT, was already OCR'd earlier this
project via extract_legal_pdfs.py -> data/docs/tt06_2022.md). Only these 3
have no clean text anywhere:
  - 151048/VanBanGoc_64.signed.pdf        (Thông tư 64/2021/TT-BTC, 5p)
  - 163729/VanBanGoc_52_10082023_172756.pdf (Thông tư 52/2023/TT-BTC, 19p)
  - 177569/VanBanGoc_09.TT.pdf            (Thông tư 09/2025/TT-BTC, 6p)

Same OCR approach as extract_legal_pdfs.py (rapidocr-onnxruntime over
pdftoppm-rendered page images) but pointed at these already-downloaded local
files instead of fetching from chinhphu.vn.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
TMP_DIR = ROOT / "tmp" / "vbpl_ocr_pages"
EXTRACTED_DIR = ROOT / "data" / "raw" / "vbpl" / "extracted"

TARGETS = [
    {
        "document_id": "151048",
        "pdf": "data/raw/vbpl/files/151048/VanBanGoc_64.signed.pdf",
        "title": "Thông tư 64/2021/TT-BTC",
    },
    {
        "document_id": "163729",
        "pdf": "data/raw/vbpl/files/163729/VanBanGoc_52_10082023_172756.pdf",
        "title": "Thông tư 52/2023/TT-BTC",
    },
    {
        "document_id": "177569",
        "pdf": "data/raw/vbpl/files/177569/VanBanGoc_09.TT.pdf",
        "title": "Thông tư 09/2025/TT-BTC",
    },
]


def render_pdf(pdf_path: Path, work_dir: Path, dpi: int = 220) -> list[Path]:
    work_dir.mkdir(parents=True, exist_ok=True)
    prefix = work_dir / "page"
    subprocess.run(["pdftoppm", "-png", "-r", str(dpi), str(pdf_path), str(prefix)], check=True, cwd=ROOT)
    return sorted(work_dir.glob("page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))


def ocr_pages(ocr_engine, images: list[Path]) -> str:
    parts = []
    for index, image in enumerate(images, start=1):
        result, _elapsed = ocr_engine(str(image))
        rows = []
        for item in result or []:
            box, text, confidence = item
            y = min(point[1] for point in box)
            x = min(point[0] for point in box)
            rows.append((y, x, text.strip(), confidence))
        rows.sort(key=lambda row: (row[0], row[1]))
        lines = []
        for _y, _x, text, confidence in rows:
            if not text:
                continue
            if confidence < 0.68:
                lines.append(f"<!-- low_confidence={confidence:.2f} --> {text}")
            else:
                lines.append(text)
        parts.append(f"## Page {index}\n\n" + "\n\n".join(lines))
        print(f"  page {index}/{len(images)} ocr'd ({len(rows)} rows)", flush=True)
    return "\n\n".join(parts)


def main() -> None:
    from rapidocr_onnxruntime import RapidOCR

    ocr_engine = RapidOCR()
    for target in TARGETS:
        document_id = target["document_id"]
        pdf_path = ROOT / target["pdf"]
        print(f"--- {document_id}: {target['title']} ---", flush=True)
        if not pdf_path.exists():
            print(f"SKIP {document_id}: source PDF missing at {pdf_path}")
            continue

        work_dir = TMP_DIR / document_id
        images = render_pdf(pdf_path, work_dir)
        text = ocr_pages(ocr_engine, images)

        out_dir = EXTRACTED_DIR / document_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{pdf_path.stem}_ocr.txt"
        header = (
            f"# {target['title']} (OCR draft — mất dấu một phần, cần người review trước khi dùng làm căn cứ pháp lý)\n\n"
            f"Nguồn: {target['pdf']}\n"
            f"OCR engine: rapidocr-onnxruntime, {len(images)} trang\n\n"
        )
        out_path.write_text(header + text, encoding="utf-8")
        print(f"OK {document_id}: {len(images)} pages -> {out_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
