from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import ssl
import sys
from typing import Any

import requests

from data_pipeline_utils import (
    DATA_DIR,
    PROCESSED_DIR,
    RAW_DIR,
    build_retry_session,
    canonical_url,
    configure_utf8_stdio,
    content_hash,
    decode_response,
    deduplicate,
    ensure_data_dirs,
    normalize_for_match,
    write_json,
)


SOURCES_PATH = DATA_DIR / "verified_sources.json"
RAW_OUTPUT_PATH = RAW_DIR / "verified_source_pages.json"
PROCESSED_OUTPUT_PATH = PROCESSED_DIR / "crawled_sources.json"

configure_utf8_stdio()


def html_to_text(markup: str) -> tuple[str, str]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", markup, flags=re.IGNORECASE | re.DOTALL)
    title = html.unescape(re.sub(r"\s+", " ", title_match.group(1)).strip()) if title_match else ""

    cleaned = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", markup, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<!--.*?-->", " ", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return title, cleaned


def fetch_url(
    url: str,
    session: requests.Session,
    timeout: float = 35.0,
) -> dict[str, Any]:
    response = session.get(
        url,
        headers={
            "User-Agent": "GrantPilotAI/0.3 data-pipeline",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout=(min(timeout, 10.0), timeout),
    )
    response.raise_for_status()
    markup = decode_response(response)
    title, clean_text = html_to_text(markup)
    return {
        "http_status": response.status_code,
        "final_url": response.url,
        "content_type": response.headers.get("content-type", ""),
        "bytes": len(response.content),
        "title": title,
        "text": clean_text,
        "content_hash": content_hash(clean_text),
    }


def crawl(timeout: float = 35.0, retries: int = 3) -> list[dict[str, Any]]:
    ensure_data_dirs()
    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    sources, duplicate_sources = deduplicate(sources, key=lambda source: canonical_url(source["url"]))
    if duplicate_sources:
        print(f"Bỏ qua {len(duplicate_sources)} nguồn trùng URL.")

    now = dt.datetime.now(dt.timezone.utc).isoformat()
    raw_rows: list[dict[str, Any]] = []
    processed_rows: list[dict[str, Any]] = []
    seen_content: dict[str, str] = {}
    session = build_retry_session(retries=retries)

    for source in sources:
        row = dict(source)
        row["fetched_at"] = now
        try:
            fetched = fetch_url(source["url"], session=session, timeout=timeout)
            text_norm = normalize_for_match(fetched["text"])
            hits = [
                keyword
                for keyword in source["expected_keywords"]
                if normalize_for_match(keyword) in text_norm
            ]
            row.update(fetched)
            row["ok"] = fetched["http_status"] == 200 and len(hits) == len(source["expected_keywords"])
            row["keyword_hits"] = hits
            row["keyword_misses"] = [
                keyword for keyword in source["expected_keywords"] if keyword not in hits
            ]
            row["text_excerpt"] = fetched["text"][:1200]
        except (requests.RequestException, TimeoutError, ssl.SSLError, OSError) as exc:
            row.update(
                {
                    "ok": False,
                    "http_status": None,
                    "final_url": source["url"],
                    "content_type": "",
                    "bytes": 0,
                    "title": source["title"],
                    "text": "",
                    "content_hash": "",
                    "text_excerpt": "",
                    "keyword_hits": [],
                    "keyword_misses": source["expected_keywords"],
                    "error": str(exc),
                }
            )

        raw_rows.append(row)
        digest = row.get("content_hash", "")
        if digest and digest in seen_content:
            row["duplicate_of"] = seen_content[digest]
            continue
        if digest:
            seen_content[digest] = row["id"]
        processed_rows.append({key: value for key, value in row.items() if key != "text"})

    write_json(RAW_OUTPUT_PATH, raw_rows)
    write_json(PROCESSED_OUTPUT_PATH, processed_rows)
    print(
        f"Đã ghi {len(raw_rows)} bản thô vào {RAW_OUTPUT_PATH.relative_to(DATA_DIR.parent)}; "
        f"{len(processed_rows)} bản đã loại trùng vào {PROCESSED_OUTPUT_PATH.relative_to(DATA_DIR.parent)}."
    )
    return processed_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl và xác minh các nguồn GrantPilotAI.")
    parser.add_argument("--timeout", type=float, default=35.0, help="Read timeout cho mỗi request (giây).")
    parser.add_argument("--retries", type=int, default=3, help="Số lần retry cho lỗi tạm thời.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    results = crawl(timeout=args.timeout, retries=args.retries)
    ok = sum(1 for row in results if row["ok"])
    print(f"Crawled {len(results)} sources; ok={ok}; failed={len(results) - ok}")
    for row in results:
        status = "OK" if row["ok"] else "FAIL"
        print(
            f"{status} {row['id']} status={row.get('http_status')} "
            f"hits={len(row.get('keyword_hits', []))}/{len(row['expected_keywords'])}"
        )
    sys.exit(0 if ok == len(results) else 1)
