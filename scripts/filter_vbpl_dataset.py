"""Stream and filter the vbpl-vn legal corpus for GrantPilotAI."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any

from data_pipeline_utils import (
    PROCESSED_DIR,
    RAW_DIR,
    configure_utf8_stdio,
    content_hash,
    ensure_data_dirs,
    write_json,
)


REPO_ID = "tmquan/vbpl-vn"
NUM_SHARDS = 32
BATCH_SIZE = 500
RELEVANT_DOC_TYPES = {
    "luat",
    "nghi_dinh",
    "thong_tu",
    "quyet_dinh",
    "nghi_quyet",
    "thong_tu_lien_tich",
}
KEYWORDS = [
    "doanh nghiệp",
    "khởi nghiệp",
    "đầu tư",
    "ưu đãi",
    "miễn thuế",
    "giảm thuế",
    "khoa học công nghệ",
    "đổi mới sáng tạo",
    "công nghệ cao",
    "FDI",
    "khu công nghiệp",
    "khu công nghệ cao",
    "hỗ trợ vốn",
    "quỹ phát triển",
]
KEYWORD_RE = re.compile("|".join(re.escape(keyword) for keyword in KEYWORDS), re.IGNORECASE)
MIN_YEAR = 2015

OUTPUT_PATH = PROCESSED_DIR / "vbpl_grantpilot_slice.jsonl"
PROGRESS_PATH = RAW_DIR / "vbpl_filter_progress.json"

configure_utf8_stdio()


def matches(row: dict[str, Any]) -> bool:
    if row["doc_type"] not in RELEVANT_DOC_TYPES:
        return False
    if row["year"] is not None and row["year"] < MIN_YEAR:
        return False
    title = row["title"] or ""
    body_snippet = (row["markdown"] or "")[:2000]
    return bool(KEYWORD_RE.search(title) or KEYWORD_RE.search(body_snippet))


def download_shard(filename: str, retries: int, timeout: int) -> str:
    os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", str(timeout))
    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", str(timeout))
    from huggingface_hub import hf_hub_download
    from huggingface_hub.utils import HfHubHTTPError

    for attempt in range(retries + 1):
        try:
            return hf_hub_download(repo_id=REPO_ID, filename=filename, repo_type="dataset")
        except (HfHubHTTPError, OSError, TimeoutError):
            if attempt >= retries:
                raise
            time.sleep(min(2**attempt, 8))
    raise RuntimeError("unreachable")


def load_resume_state() -> tuple[set[int], set[str], int, str]:
    if not PROGRESS_PATH.exists():
        return set(), set(), 0, "w"
    if not OUTPUT_PATH.exists():
        raise RuntimeError(f"Có progress nhưng thiếu output: {OUTPUT_PATH}")

    done_shards = set(json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))["done_shards"])
    seen_hashes: set[str] = set()
    existing_count = 0
    with OUTPUT_PATH.open("r", encoding="utf-8") as existing:
        for line in existing:
            if not line.strip():
                continue
            record = json.loads(line)
            digest = record.get("content_hash") or content_hash(
                record.get("markdown") or record.get("source_url") or record.get("title", "")
            )
            seen_hashes.add(digest)
            existing_count += 1
    return done_shards, seen_hashes, existing_count, "a"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lọc bộ dữ liệu pháp luật vbpl-vn.")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    return parser.parse_args()


def main() -> None:
    ensure_data_dirs()
    args = parse_args()
    import pyarrow.parquet as pq

    done_shards, seen_hashes, total_kept, mode = load_resume_state()
    if done_shards:
        print(f"Resuming: {len(done_shards)}/{NUM_SHARDS} shards already processed")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open(mode, encoding="utf-8", newline="\n") as output:
        for shard_index in range(NUM_SHARDS):
            if shard_index in done_shards:
                continue
            filename = f"documents-{shard_index:05d}-of-{NUM_SHARDS:05d}.parquet"
            print(f"Downloading {filename} ...", flush=True)
            local_path = download_shard(filename, retries=args.retries, timeout=args.timeout)

            parquet_file = pq.ParquetFile(local_path)
            shard_kept = 0
            shard_scanned = 0
            for batch in parquet_file.iter_batches(batch_size=args.batch_size):
                for row in batch.to_pylist():
                    shard_scanned += 1
                    if not matches(row):
                        continue
                    digest = content_hash(
                        row.get("markdown") or row.get("source_url") or row.get("title", "")
                    )
                    if digest in seen_hashes:
                        continue
                    seen_hashes.add(digest)
                    record = {
                        "doc_name": row["doc_name"],
                        "title": row["title"],
                        "doc_type": row["doc_type"],
                        "doc_number": row["doc_number"],
                        "issue_date": row["issue_date"],
                        "issuing_authority": row["issuing_authority"],
                        "legal_area": row["legal_area"],
                        "scope": row["scope"],
                        "source_url": row["source_url"],
                        "markdown": row["markdown"],
                        "content_hash": digest,
                    }
                    output.write(json.dumps(record, ensure_ascii=False) + "\n")
                    shard_kept += 1
                output.flush()

            total_kept += shard_kept
            done_shards.add(shard_index)
            write_json(PROGRESS_PATH, {"done_shards": sorted(done_shards)})
            print(
                f"  shard {shard_index}: scanned {shard_scanned}, kept {shard_kept} "
                f"(total unique: {total_kept})",
                flush=True,
            )

    print(f"Done. Kept {total_kept} unique documents across {NUM_SHARDS} shards.")
    print(f"Saved to {OUTPUT_PATH}")
    PROGRESS_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
