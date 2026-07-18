"""Crawl and filter policy articles from xaydungchinhsach.chinhphu.vn."""

from __future__ import annotations

import argparse
import re
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from data_pipeline_utils import (
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


CATEGORY_URL = "https://xaydungchinhsach.chinhphu.vn/phat-trien-kinh-te-tu-nhan-va-doanh-nghiep-dan-toc.htm"
ARTICLE_URL_RE = re.compile(r"-\d{10,}\.htm$")
KEYWORDS = [
    "doanh nghiệp",
    "khởi nghiệp",
    "đầu tư",
    "ưu đãi",
    "miễn thuế",
    "giảm thuế",
    "khoa học công nghệ",
    "đổi mới sáng tạo",
    "startup",
    "FDI",
    "hỗ trợ vốn",
    "quỹ phát triển",
    "chuyển đổi số",
    "công nghệ cao",
]

RAW_OUTPUT_PATH = RAW_DIR / "chinhphu_all_urls.json"
PROCESSED_OUTPUT_PATH = PROCESSED_DIR / "chinhphu_relevant_articles.json"

configure_utf8_stdio()


def crawl_all_urls(
    category_url: str,
    max_clicks: int = 200,
    wait_after_click: float = 1.2,
    timeout: float = 35.0,
    retries: int = 3,
) -> list[str]:
    """Click “Xem thêm” repeatedly and collect unique article URLs."""
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright

    urls: set[str] = set()
    timeout_ms = int(timeout * 1000)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        for attempt in range(retries + 1):
            try:
                page.goto(category_url, wait_until="networkidle", timeout=timeout_ms)
                break
            except (PlaywrightTimeoutError, PlaywrightError):
                if attempt >= retries:
                    browser.close()
                    raise
                time.sleep(min(2**attempt, 8))

        stale_rounds = 0
        for _ in range(max_clicks):
            links = page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
            before = len(urls)
            urls.update(canonical_url(url) for url in links if ARTICLE_URL_RE.search(url))
            stale_rounds = stale_rounds + 1 if len(urls) == before else 0
            if stale_rounds >= 3:
                break

            button = page.get_by_text("Xem thêm", exact=False).first
            if button.count() == 0 or not button.is_visible():
                break
            try:
                button.click(timeout=min(timeout_ms, 5000))
            except (PlaywrightTimeoutError, PlaywrightError):
                break
            page.wait_for_timeout(int(wait_after_click * 1000))

        browser.close()
    return sorted(urls)


def is_relevant(title: str, summary: str) -> bool:
    text = normalize_for_match(f"{title} {summary}")
    return any(normalize_for_match(keyword) in text for keyword in KEYWORDS)


def fetch_and_filter(
    urls: list[str],
    delay: float = 1.0,
    timeout: float = 20.0,
    retries: int = 3,
    session: requests.Session | None = None,
) -> list[dict[str, Any]]:
    """Fetch articles and retain relevant, content-deduplicated records."""
    unique_urls, duplicate_urls = deduplicate(urls, key=canonical_url)
    if duplicate_urls:
        print(f"Bỏ qua {len(duplicate_urls)} URL trùng.")

    session = session or build_retry_session(retries=retries)
    headers = {"User-Agent": "GrantPilotAI/0.3 policy-crawler"}
    relevant: list[dict[str, Any]] = []
    seen_hashes: set[str] = set()

    for index, url in enumerate(sorted(unique_urls), 1):
        try:
            response = session.get(
                url,
                headers=headers,
                timeout=(min(timeout, 10.0), timeout),
            )
            response.raise_for_status()
            markup = decode_response(response)
            soup = BeautifulSoup(markup, "html.parser")

            title_tag = soup.find("h1")
            title = title_tag.get_text(" ", strip=True) if title_tag else ""
            summary_tag = (
                soup.find("h2", class_="sapo")
                or soup.find("div", class_="sapo")
                or soup.find(attrs={"class": re.compile("sapo|summary|desc", re.I)})
            )
            summary = summary_tag.get_text(" ", strip=True) if summary_tag else ""
            digest = content_hash(soup.get_text(" ", strip=True))

            if is_relevant(title, summary) and digest not in seen_hashes:
                seen_hashes.add(digest)
                relevant.append(
                    {
                        "url": canonical_url(response.url),
                        "title": title,
                        "sapo": summary,
                        "content_hash": digest,
                    }
                )
                print(f"[{index}/{len(unique_urls)}] MATCH: {title}")
            else:
                print(f"[{index}/{len(unique_urls)}] skip:  {title[:60]}")
        except requests.RequestException as exc:
            print(f"[{index}/{len(unique_urls)}] ERROR {url}: {exc}")
        if delay > 0:
            time.sleep(delay)
    return relevant


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl bài chính sách từ Cổng Chính phủ.")
    parser.add_argument("--category-url", default=CATEGORY_URL)
    parser.add_argument("--max-clicks", type=int, default=200)
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--timeout", type=float, default=35.0)
    parser.add_argument("--retries", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    ensure_data_dirs()
    args = parse_args()
    print(f"Crawling {args.category_url} ...")
    all_urls = crawl_all_urls(
        args.category_url,
        max_clicks=args.max_clicks,
        timeout=args.timeout,
        retries=args.retries,
    )
    write_json(RAW_OUTPUT_PATH, all_urls)
    print(f"Collected {len(all_urls)} unique article URLs")

    print("Filtering for relevance ...")
    relevant = fetch_and_filter(
        all_urls,
        delay=args.delay,
        timeout=args.timeout,
        retries=args.retries,
    )
    write_json(PROCESSED_OUTPUT_PATH, relevant)
    print(f"Done. {len(relevant)}/{len(all_urls)} articles matched the keyword filter.")
    print(f"See {RAW_OUTPUT_PATH} and {PROCESSED_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
