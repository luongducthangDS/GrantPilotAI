"""Extract plain text from every file under data/raw/vbpl/files/.

The directory holds 99 attachments across 46 VBPL documents, downloaded as-is
by crawl_vbpl_official.py: real .docx, real legacy .doc (OLE/CFB, several
different declared codepages), .doc files that are actually RTF or HTML in
disguise, PDFs (some with a real text layer, a couple scanned/empty), plain
.html body dumps, and .zip wrappers around a single .doc. File extensions are
not trustworthy here — type is detected from magic bytes, not from the name.

This only extracts text (data/raw/vbpl/extracted/) and writes a per-file
quality report (data/raw/vbpl/extraction_report.md) for a human to triage.
It does NOT touch data/corpus.json — folding any of this into the reviewed
RAG corpus is a separate, deliberate curation step (see grantpilot-ai-spec.md
section 4: corpus is hand-curated, not bulk-ingested).
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import mammoth
from pypdf import PdfReader
from striprtf.striprtf import rtf_to_text

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "data" / "raw" / "vbpl" / "files"
OUT_DIR = ROOT / "data" / "raw" / "vbpl" / "extracted"
REPORT_PATH = ROOT / "data" / "raw" / "vbpl" / "extraction_report.md"
MANIFEST_PATH = ROOT / "data" / "processed" / "vbpl_extraction_manifest.json"

OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
PDF_SIGNATURE = b"%PDF"
ZIP_SIGNATURE = b"PK\x03\x04"
RTF_SIGNATURE = b"{\\rtf"
UTF16LE_BOM = b"\xff\xfe"
UTF16BE_BOM = b"\xfe\xff"

# Vietnamese-specific letters (base + combining tone marks) — real Vietnamese
# legal prose uses these constantly, so their near-total absence in a
# long extraction is a strong signal of a mis-decoded legacy encoding rather
# than a genuinely accent-free document.
VIETNAMESE_CHARS_RE = re.compile(
    "[àáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ]", re.IGNORECASE
)
REPLACEMENT_CHARS_RE = re.compile("[�?]")

# Some legacy Vietnamese documents (mostly the .doc-as-RTF files here) were
# authored with a pre-Unicode 8-bit font that hijacked ordinary Latin-1 byte
# positions to draw Vietnamese glyphs — e.g. the byte position for "đ"/"Đ" was
# reused to draw what the intended font rendered as "đ" but a standards-correct
# decoder reads back as the Icelandic letters "ð"/"Ð". Neither letter has any
# legitimate reason to appear in a Vietnamese government document, so their
# presence is a reliable, specific signal of this exact unrecoverable-without-
# the-original-font problem (distinct from the more general low-diacritic check).
LEGACY_FONT_ARTIFACT_RE = re.compile("[ðÐþÞ]")


@dataclass
class ExtractionResult:
    text: str
    method: str
    status: str
    notes: str = ""


@dataclass
class FileReport:
    document_id: str
    relative_path: str
    detected_type: str
    method: str
    status: str
    char_count: int
    notes: str
    output_path: str | None


def sniff_type(data: bytes) -> str:
    if not data:
        return "empty"
    if data.startswith(PDF_SIGNATURE):
        return "pdf"
    if data.startswith(OLE_SIGNATURE):
        return "ole_doc"
    if data.startswith(RTF_SIGNATURE):
        return "rtf"
    if data.startswith(ZIP_SIGNATURE):
        try:
            with zipfile.ZipFile(__import__("io").BytesIO(data)) as archive:
                names = archive.namelist()
                if "[Content_Types].xml" in names or any(n.startswith("word/") for n in names):
                    return "docx"
                return "zip"
        except zipfile.BadZipFile:
            return "unknown"
    if data.startswith(UTF16LE_BOM) or data.startswith(UTF16BE_BOM):
        decoded = data.decode("utf-16", errors="ignore")[:200].lower()
        if "<html" in decoded or "<!doctype" in decoded or "<w:worddocument" in decoded:
            return "html_utf16"
        return "unknown"
    head = data[:400].lstrip().lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html") or b"<html" in head[:200]:
        return "html"
    return "unknown"


def quality_flags(text: str) -> str:
    flags = []
    stripped = text.strip()
    if len(stripped) > 200:
        letters = sum(1 for ch in stripped if ch.isalpha())
        viet = len(VIETNAMESE_CHARS_RE.findall(stripped))
        if letters and viet / letters < 0.01:
            flags.append("low_diacritic_density_check_manually")
        replacement = len(REPLACEMENT_CHARS_RE.findall(stripped))
        if replacement / max(len(stripped), 1) > 0.01:
            flags.append("possible_encoding_issue")
        if LEGACY_FONT_ARTIFACT_RE.search(stripped):
            flags.append("legacy_font_encoding_unrecoverable")
    return ";".join(flags)


def extract_pdf(path: Path) -> ExtractionResult:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult("", "pypdf", "failed", str(exc))
    parts = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(parts)
    page_count = max(len(reader.pages), 1)
    avg_chars = len(text) / page_count
    status = "ok"
    notes = ""
    if avg_chars < 30:
        status = "possibly_scanned_needs_ocr"
        notes = f"avg {avg_chars:.0f} chars/page across {page_count} pages — likely a scanned PDF with no text layer"
    return ExtractionResult(text, "pypdf", status, notes)


def extract_ole_doc(path: Path) -> ExtractionResult:
    # antiword.exe is a legacy ANSI (non-wide) console app: Windows transcodes
    # argv to the console codepage (cp1252 here) before the process ever sees
    # it, so a filename containing "Đ" or other non-cp1252 characters arrives
    # already corrupted (e.g. "585.QĐ.TTg.doc" -> "585.Q?.TTg.doc", which then
    # doesn't exist on disk). Route through an ASCII-only temp filename so the
    # path handed to antiword never depends on the console codepage.
    with tempfile.TemporaryDirectory() as tmp:
        ascii_path = Path(tmp) / "input.doc"
        ascii_path.write_bytes(path.read_bytes())
        try:
            proc = subprocess.run(
                ["antiword", "-m", "UTF-8.txt", str(ascii_path)],
                capture_output=True,
                timeout=60,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            return ExtractionResult("", "antiword", "failed", str(exc))
    if proc.returncode != 0:
        return ExtractionResult("", "antiword", "failed", proc.stderr.decode("utf-8", errors="replace")[:300])
    text = proc.stdout.decode("utf-8", errors="replace")
    return ExtractionResult(text, "antiword -m UTF-8.txt", "ok")


def extract_docx(path: Path) -> ExtractionResult:
    try:
        with path.open("rb") as handle:
            result = mammoth.extract_raw_text(handle)
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult("", "mammoth", "failed", str(exc))
    notes = "; ".join(str(m) for m in result.messages) if result.messages else ""
    return ExtractionResult(result.value, "mammoth", "ok", notes)


def extract_rtf(path: Path) -> ExtractionResult:
    try:
        raw = path.read_text(encoding="cp1252", errors="replace")
        text = rtf_to_text(raw, errors="ignore")
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult("", "striprtf", "failed", str(exc))
    return ExtractionResult(text, "striprtf", "ok")


def strip_html(raw: str) -> str:
    raw = re.sub(r"(?is)<(style|script)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    raw = html.unescape(raw)
    return re.sub(r"[ \t]+", " ", raw).strip()


def extract_html(path: Path, data: bytes, utf16: bool) -> ExtractionResult:
    try:
        raw = data.decode("utf-16" if utf16 else "utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        return ExtractionResult("", "html-strip", "failed", str(exc))
    return ExtractionResult(strip_html(raw), "html-strip", "ok")


def extract_one(path: Path, data: bytes) -> tuple[str, ExtractionResult]:
    detected = sniff_type(data)
    if detected == "empty":
        return detected, ExtractionResult("", "-", "empty_file")
    if detected == "pdf":
        return detected, extract_pdf(path)
    if detected == "ole_doc":
        return detected, extract_ole_doc(path)
    if detected == "docx":
        return detected, extract_docx(path)
    if detected == "rtf":
        return detected, extract_rtf(path)
    if detected == "html":
        return detected, extract_html(path, data, utf16=False)
    if detected == "html_utf16":
        return detected, extract_html(path, data, utf16=True)
    if detected == "zip":
        return detected, ExtractionResult("", "-", "unexpected_nested_zip")
    return detected, ExtractionResult("", "-", "unrecognized_format")


def process_file(path: Path, document_id: str, source_zip: str | None = None) -> FileReport:
    data = path.read_bytes()
    detected, result = extract_one(path, data)

    output_path: str | None = None
    text = result.text.strip()
    if text:
        out_dir = OUT_DIR / document_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out_name = path.stem + ".txt"
        destination = out_dir / out_name
        # A .zip's inner .doc and a same-named sibling could collide; make the
        # name unique instead of silently overwriting one extraction with another.
        counter = 2
        while destination.exists():
            destination = out_dir / f"{path.stem}_{counter}.txt"
            counter += 1
        destination.write_text(text, encoding="utf-8")
        output_path = str(destination.relative_to(ROOT)).replace("\\", "/")

    notes = result.notes
    status = result.status
    if text and status == "ok":
        flags = quality_flags(text)
        if flags:
            notes = f"{notes}; {flags}" if notes else flags
            # "low_diacritic_density" means the extracted text technically isn't
            # empty but is unusable prose (a broken font cmap, not a real
            # accent-free document) — surface that in status, not just a buried
            # note, so it isn't mistaken for good text by anything downstream.
            if "low_diacritic_density_check_manually" in flags:
                status = "text_layer_unreliable_needs_ocr"
            elif "legacy_font_encoding_unrecoverable" in flags:
                status = "legacy_font_encoding_unrecoverable"

    rel_source = (f"{source_zip} -> " if source_zip else "") + str(path.name)
    return FileReport(
        document_id=document_id,
        relative_path=rel_source,
        detected_type=detected,
        method=result.method,
        status=status,
        char_count=len(text),
        notes=notes,
        output_path=output_path,
    )


def process_zip(path: Path, document_id: str) -> list[FileReport]:
    reports = []
    try:
        with zipfile.ZipFile(path) as archive, tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            for name in archive.namelist():
                if name.endswith("/"):
                    continue
                extracted_path = archive.extract(name, tmp_dir)
                reports.append(process_file(Path(extracted_path), document_id, source_zip=path.name))
    except zipfile.BadZipFile as exc:
        reports.append(
            FileReport(document_id, path.name, "zip", "-", "failed", 0, str(exc), None)
        )
    return reports


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reports: list[FileReport] = []

    document_dirs = sorted((p for p in SRC_DIR.iterdir() if p.is_dir()), key=lambda p: p.name)
    for doc_dir in document_dirs:
        document_id = doc_dir.name
        for file_path in sorted(doc_dir.iterdir()):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() == ".zip":
                reports.extend(process_zip(file_path, document_id))
            else:
                reports.append(process_file(file_path, document_id))

    status_counts: dict[str, int] = {}
    for report in reports:
        status_counts[report.status] = status_counts.get(report.status, 0) + 1

    lines = [
        "# VBPL file extraction report",
        "",
        f"Đã xử lý {len(reports)} tệp trong {len(document_dirs)} thư mục văn bản dưới `data/raw/vbpl/files/`.",
        "Trích xuất text thô vào `data/raw/vbpl/extracted/{document_id}/`. Chưa đưa vào `data/corpus.json` — bước gộp vào RAG corpus (chunk theo điều/khoản, gán metadata, review) là quyết định riêng, làm sau khi đã soát lỗi trích xuất.",
        "",
        "## Tổng hợp theo trạng thái",
        "",
        "| Trạng thái | Số tệp |",
        "|---|---|",
    ]
    for status, count in sorted(status_counts.items(), key=lambda kv: -kv[1]):
        lines.append(f"| {status} | {count} |")

    lines += ["", "## Chi tiết từng tệp", "", "| document_id | tệp nguồn | loại phát hiện | phương pháp | trạng thái | số ký tự | ghi chú |", "|---|---|---|---|---|---|---|"]
    for report in reports:
        note = report.notes.replace("|", "/").replace("\n", " ")[:200]
        lines.append(
            f"| {report.document_id} | {report.relative_path} | {report.detected_type} | {report.method} | "
            f"{report.status} | {report.char_count} | {note} |"
        )

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps([report.__dict__ for report in reports], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Processed {len(reports)} files across {len(document_dirs)} document folders.")
    for status, count in sorted(status_counts.items(), key=lambda kv: -kv[1]):
        print(f"  {status}: {count}")
    print(f"Report: {REPORT_PATH.relative_to(ROOT)}")
    print(f"Manifest: {MANIFEST_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
