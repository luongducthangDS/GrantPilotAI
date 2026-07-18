"""Merges cleanly-extracted text from data/raw/vbpl/extracted/ into data/corpus.json.

Source: the 47-document batch crawled from vbpl.vn (query: keyword="ho tro
doanh nghiep", scope=Trung uong, status=Con hieu luc — see
data/raw/vbpl/attachment_inventory.json) and already run through
scripts/extract_vbpl_files.py (see data/processed/vbpl_extraction_manifest.json
for per-file extraction status).

What this script does, per document:
  1. Skip if a corpus.json entry already covers the same document number
     (avoids duplicating documents already curated via data/docs/).
  2. Pick the best "ok"-status extracted text file (highest char_count).
  3. Split on "Dieu N" (Vietnamese "Điều N") boundaries into clause-level chunks,
     matching the granularity already used elsewhere in corpus.json.
  4. Emit a corpus entry per clause, with "status" taken directly from vbpl.vn's
     own "Tình trạng hiệu lực" field (the crawl query already filtered for
     "Còn hiệu lực" at crawl time) and "source" set to the vbpl.vn detail URL.

This is a bulk, automated merge — the "status" field reflects vbpl.vn's
crawl-time value, not a fresh per-document re-check, and the regex-based
Điều-splitter can misfire on messy OCR/antiword output. Treat this the same
way the rest of the corpus treats anything not hand-verified: fine for
matching/screening, needs a human spot-check before being relied on for a
real submission.

Usage: python scripts/merge_vbpl_extracted.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
VBPL_DIR = DATA_DIR / "raw" / "vbpl"
CORPUS_PATH = DATA_DIR / "corpus.json"

MAX_CHUNK_CHARS = 2500  # keep individual chunks retrieval-sized, not whole-document dumps
MIN_CHUNKS_TO_ACCEPT_DOC = 1

DIEU_PATTERN = re.compile(r"\n\s*(Đi[eề]u\s+\d+[a-z]?)[\.\:\s]", re.IGNORECASE)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def slugify(value: str) -> str:
    value = value.lower()
    replacements = {
        "à": "a", "á": "a", "ạ": "a", "ả": "a", "ã": "a", "â": "a", "ầ": "a", "ấ": "a", "ậ": "a", "ẩ": "a", "ẫ": "a",
        "ă": "a", "ằ": "a", "ắ": "a", "ặ": "a", "ẳ": "a", "ẵ": "a",
        "è": "e", "é": "e", "ẹ": "e", "ẻ": "e", "ẽ": "e", "ê": "e", "ề": "e", "ế": "e", "ệ": "e", "ể": "e", "ễ": "e",
        "ì": "i", "í": "i", "ị": "i", "ỉ": "i", "ĩ": "i",
        "ò": "o", "ó": "o", "ọ": "o", "ỏ": "o", "õ": "o", "ô": "o", "ồ": "o", "ố": "o", "ộ": "o", "ổ": "o", "ỗ": "o",
        "ơ": "o", "ờ": "o", "ớ": "o", "ợ": "o", "ở": "o", "ỡ": "o",
        "ù": "u", "ú": "u", "ụ": "u", "ủ": "u", "ũ": "u", "ư": "u", "ừ": "u", "ứ": "u", "ự": "u", "ử": "u", "ữ": "u",
        "ỳ": "y", "ý": "y", "ỵ": "y", "ỷ": "y", "ỹ": "y",
        "đ": "d",
    }
    for src, dst in replacements.items():
        value = value.replace(src, dst)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def already_covered(doc_number: str, covered_numbers: set[str]) -> bool:
    return doc_number in covered_numbers


def covered_numbers_from_corpus(corpus: list[dict]) -> set[str]:
    covered: set[str] = set()
    for entry in corpus:
        covered.update(re.findall(r"\d{1,4}/\d{4}", entry["title"]))
    return covered


def split_into_chunks(text: str) -> list[tuple[str, str]]:
    """Returns [(clause_label, chunk_text), ...]. Falls back to a single
    "Toàn văn" chunk (truncated) if no "Điều N" boundary is found."""
    matches = list(DIEU_PATTERN.finditer(text))
    if len(matches) < 2:
        return [("Toàn văn (chưa tách điều)", text[:MAX_CHUNK_CHARS].strip())]

    chunks: list[tuple[str, str]] = []
    for i, match in enumerate(matches):
        start = match.start(1)
        end = matches[i + 1].start(1) if i + 1 < len(matches) else len(text)
        label = re.sub(r"\s+", " ", match.group(1)).strip()
        body = text[start:end].strip()
        if len(body) < 30:  # heading-only fragment, not worth a chunk
            continue
        chunks.append((label, body[:MAX_CHUNK_CHARS]))
    return chunks


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Report what would be added without writing corpus.json")
    parser.add_argument(
        "--doc-ids",
        type=str,
        default="",
        help="Comma-separated vbpl.vn documentId allowlist. If set, only these documents are considered "
        "(everything else in the 47-document batch is skipped) — used to merge a hand-reviewed, on-topic "
        "subset instead of the whole crawl, since the crawl's keyword filter ('hỗ trợ doanh nghiệp') is far "
        "broader than GrantPilot's actual DNNVV/startup scope and pulls in unrelated content (SOE "
        "restructuring funds, severance policy, price-stabilization accounting, etc.).",
    )
    args = parser.parse_args()
    doc_id_allowlist = {d.strip() for d in args.doc_ids.split(",") if d.strip()} or None

    inventory = load_json(VBPL_DIR / "attachment_inventory.json")["documents"]
    inventory_by_id = {doc["documentId"]: doc["source"] for doc in inventory}

    manifest = load_json(DATA_DIR / "processed" / "vbpl_extraction_manifest.json")
    best_file_by_doc: dict[str, dict] = {}
    for entry in manifest:
        if entry["status"] != "ok":
            continue
        doc_id = entry["document_id"]
        current = best_file_by_doc.get(doc_id)
        if current is None or entry["char_count"] > current["char_count"]:
            best_file_by_doc[doc_id] = entry

    corpus = load_json(CORPUS_PATH)
    covered_numbers = covered_numbers_from_corpus(corpus)
    existing_ids = {entry["id"] for entry in corpus}

    added_entries: list[dict] = []
    skipped_already_covered: list[str] = []
    skipped_no_clean_text: list[str] = []

    for doc_id, meta in inventory_by_id.items():
        if doc_id_allowlist is not None and doc_id not in doc_id_allowlist:
            continue
        so_ky_hieu = meta.get("Số ký hiệu", "").strip()
        number_match = re.search(r"\d{1,4}/\d{4}", so_ky_hieu)
        doc_number = number_match.group(0) if number_match else so_ky_hieu

        if already_covered(doc_number, covered_numbers):
            skipped_already_covered.append(f"{doc_id} ({so_ky_hieu})")
            continue

        best_file = best_file_by_doc.get(doc_id)
        if not best_file:
            skipped_no_clean_text.append(f"{doc_id} ({so_ky_hieu})")
            continue

        text_path = ROOT / best_file["output_path"]
        if not text_path.exists():
            skipped_no_clean_text.append(f"{doc_id} ({so_ky_hieu}) — output file missing")
            continue

        text = text_path.read_text(encoding="utf-8", errors="ignore")
        chunks = split_into_chunks(text)
        if len(chunks) < MIN_CHUNKS_TO_ACCEPT_DOC:
            skipped_no_clean_text.append(f"{doc_id} ({so_ky_hieu}) — no usable chunks after split")
            continue

        status = meta.get("Tình trạng hiệu lực") or "Chưa xác định — cần xác minh"
        title = so_ky_hieu or meta.get("Tên văn bản", f"Văn bản {doc_id}")
        source = f"https://vbpl.vn/van-ban/chi-tiet/x--{doc_id}?tabs=tai-ve"
        base_slug = slugify(f"vbpl{doc_id}-{title}")
        tags = [slugify(meta.get("Loại văn bản", "")), slugify(meta.get("Lĩnh vực", ""))]
        tags = [t for t in tags if t]

        for i, (clause_label, body) in enumerate(chunks):
            chunk_id = f"{base_slug}-{i+1}"
            if chunk_id in existing_ids:
                continue
            added_entries.append({
                "id": chunk_id,
                "title": title,
                "clause": clause_label,
                "status": f"{status} (nguồn: crawl vbpl.vn, cần xác minh lại trước khi dùng nộp hồ sơ thật)",
                "source": source,
                "tags": tags,
                "text": body
            })
            existing_ids.add(chunk_id)

    print(f"Văn bản đã có trong corpus (bỏ qua trùng): {len(skipped_already_covered)}")
    for item in skipped_already_covered:
        print(f"  - {item}")
    print(f"\nVăn bản không có bản text sạch để dùng: {len(skipped_no_clean_text)}")
    for item in skipped_no_clean_text:
        print(f"  - {item}")
    print(f"\nChunk mới sẽ thêm: {len(added_entries)} (từ {len(set(e['title'] for e in added_entries))} văn bản)")

    if args.dry_run:
        print("\n--dry-run: chưa ghi file.")
        return

    corpus.extend(added_entries)
    CORPUS_PATH.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nĐã ghi data/corpus.json — tổng {len(corpus)} chunk.")


if __name__ == "__main__":
    main()
