"""
Monitoring Pipeline: refresh data/policy_watch.json.

This is a *scheduled batch* pipeline, not a real-time one — the app's
deployment target (Next.js API routes on Render) has no persistent
process/scheduler, and the crawlers below need Python + (for the sweep)
a real browser via Playwright, neither of which run inside a Node.js
serverless route. So "monitoring" here means: run this script on a
schedule (see .github/workflows/refresh-data.yml) or manually
(`npm run data:watch`), and let it update the JSON files the app already
reads at build/runtime.

What it does, each run:
1. Re-fetches all 23 sources in data/verified_sources.json (via
   crawl_verified_sources.crawl(), which overwrites data/crawled_sources.json)
   and compares each source's text against its *previous* crawled_sources.json
   snapshot using a similarity ratio (difflib), not an exact hash — gov
   pages embed small dynamic bits (view counters, "related articles"
   widgets) that make exact-hash diffing flag "changed" on every run even
   when nothing meaningful moved. A source is flagged only if similarity
   drops below SIMILARITY_THRESHOLD. This does NOT auto-edit corpus.json —
   citation text changes need a human to read the diff and decide how to
   update the chunk — it just tells you where to look.
2. Does a narrow sweep of the chinhphu.vn policy category page (reusing
   crawl_chinhphu_policy.py, capped to the first few "load more" pages
   since the feed is reverse-chronological), then applies a *stricter*
   relevance filter than the manual-curation script uses (legal-document
   number pattern, or >=2 distinct keyword hits) — this path has no human
   review step before writing to policy_watch.json, so it must not let
   single-keyword-match opinion/editorial pieces through. New matches are
   appended with today's date and status "Tự động phát hiện - cần xác minh".
3. Writes data/policy_watch_refresh_report.md summarizing both.

Usage:
    python scripts/refresh_policy_watch.py [--skip-sweep]

--skip-sweep skips the Playwright-based chinhphu.vn sweep (e.g. if
Playwright/chromium isn't installed) and only re-checks existing sources.
"""

from __future__ import annotations

import datetime as dt
import difflib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from crawl_verified_sources import OUTPUT_PATH as CRAWLED_SOURCES_PATH  # noqa: E402
from crawl_verified_sources import crawl as crawl_verified_sources  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
POLICY_WATCH_PATH = DATA_DIR / "policy_watch.json"
REPORT_PATH = DATA_DIR / "policy_watch_refresh_report.md"

CHINHPHU_SWEEP_MAX_CLICKS = 5
SIMILARITY_THRESHOLD = 0.97

LEGAL_DOC_RE = re.compile(
    r"(nghị định|luật|quyết định|thông tư|nghị quyết)\s*(số\s*)?\d", re.IGNORECASE
)

# vanban.chinhphu.vn / chinhphu.vn "docid=" viewer pages embed a "văn bản
# liên quan" sidebar widget that shows a different random subset of related
# documents on every load — confirmed empirically by re-crawling the same
# URL twice within minutes and seeing a *different* set of pages "change"
# each time, with a ~8-12% text drop unrelated to any real edit. Diffing
# these reliably would need the real content container's selector (not
# available), so skip change-flagging for this pattern rather than emit a
# signal that's wrong often enough to be ignored.
NOISY_DIFF_URL_RE = re.compile(r"(vanban\.chinhphu\.vn|^https://chinhphu\.vn)/.*docid=", re.IGNORECASE)


def check_source_changes() -> list[dict]:
    previous_rows = json.loads(CRAWLED_SOURCES_PATH.read_text(encoding="utf-8")) if CRAWLED_SOURCES_PATH.exists() else []
    previous_by_id = {row["id"]: row for row in previous_rows}

    new_rows = crawl_verified_sources()

    changes: list[dict] = []
    for row in new_rows:
        entry = {"id": row["id"], "url": row["url"], "title": row.get("title", "")}
        if row.get("error"):
            entry["status"] = "error"
            entry["error"] = row["error"]
            changes.append(entry)
            continue

        if NOISY_DIFF_URL_RE.search(row["url"]):
            entry["status"] = "not_diffed"
            changes.append(entry)
            continue

        previous = previous_by_id.get(row["id"])
        if previous is None or not previous.get("text") or previous.get("error"):
            entry["status"] = "baseline"
        else:
            ratio = difflib.SequenceMatcher(None, previous.get("text", ""), row.get("text", "")).ratio()
            entry["similarity"] = round(ratio, 4)
            entry["status"] = "changed" if ratio < SIMILARITY_THRESHOLD else "unchanged"
        changes.append(entry)

    return changes


def has_strong_signal(title: str, sapo: str, keyword_hits: int) -> bool:
    text = f"{title} {sapo}"
    if LEGAL_DOC_RE.search(text):
        return True
    return keyword_hits >= 2


def sweep_chinhphu_for_new_articles() -> list[dict]:
    from crawl_chinhphu_policy import CATEGORY_URL, KEYWORDS, crawl_all_urls, fetch_and_filter  # noqa: E402

    watch = json.loads(POLICY_WATCH_PATH.read_text(encoding="utf-8"))
    known_urls = {item["source"] for item in watch}

    all_urls = crawl_all_urls(CATEGORY_URL, max_clicks=CHINHPHU_SWEEP_MAX_CLICKS)
    candidate_urls = {u for u in all_urls if u not in known_urls}
    if not candidate_urls:
        return []

    relevant = fetch_and_filter(candidate_urls)
    today = dt.date.today().isoformat()
    new_items = []
    for article in relevant:
        text = f"{article['title']} {article['sapo']}".lower()
        keyword_hits = sum(1 for kw in KEYWORDS if kw.lower() in text)
        if not has_strong_signal(article["title"], article["sapo"], keyword_hits):
            continue
        new_items.append(
            {
                "date": today,
                "title": article["title"] or article["url"],
                "impact": article["sapo"] or "Phát hiện tự động qua từ khoá liên quan chính sách/doanh nghiệp — cần đọc và xác minh nội dung trước khi đưa vào tư vấn.",
                "status": "Tự động phát hiện - cần xác minh",
                "source": article["url"],
            }
        )
    return new_items


def main() -> int:
    skip_sweep = "--skip-sweep" in sys.argv
    report_lines = [
        "# Policy watch refresh report",
        "",
        f"Run at: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## 1. Verified source changes",
        "",
    ]

    changes = check_source_changes()
    changed = [c for c in changes if c["status"] == "changed"]
    errored = [c for c in changes if c["status"] == "error"]
    baseline = [c for c in changes if c["status"] == "baseline"]
    unchanged = [c for c in changes if c["status"] == "unchanged"]
    not_diffed = [c for c in changes if c["status"] == "not_diffed"]

    report_lines.append(
        f"Checked {len(changes)} sources — {len(unchanged)} unchanged, {len(changed)} changed, "
        f"{len(baseline)} new baseline, {len(not_diffed)} not diffed (noisy docid-viewer page), "
        f"{len(errored)} errored. (similarity threshold={SIMILARITY_THRESHOLD})"
    )
    report_lines.append("")
    if changed:
        report_lines.append("### Changed (needs manual review — corpus.json citation text may be stale)")
        for c in changed:
            report_lines.append(f"- `{c['id']}` — {c['title']} (similarity={c['similarity']}) — {c['url']}")
        report_lines.append("")
    if errored:
        report_lines.append("### Errors")
        for c in errored:
            report_lines.append(f"- `{c['id']}` — {c['error']} — {c['url']}")
        report_lines.append("")

    new_watch_items: list[dict] = []
    report_lines.append("## 2. chinhphu.vn new-article sweep")
    report_lines.append("")
    if skip_sweep:
        report_lines.append("Skipped (`--skip-sweep`).")
    else:
        try:
            new_watch_items = sweep_chinhphu_for_new_articles()
            if new_watch_items:
                report_lines.append(f"Found {len(new_watch_items)} new relevant article(s), appended to policy_watch.json:")
                for item in new_watch_items:
                    report_lines.append(f"- {item['title']} — {item['source']}")
            else:
                report_lines.append("No new relevant articles found beyond what's already tracked.")
        except Exception as exc:  # noqa: BLE001
            report_lines.append(f"Sweep failed: {exc}")
            report_lines.append("(Playwright/chromium may not be installed — run `playwright install chromium`, or pass --skip-sweep.)")

    if new_watch_items:
        watch = json.loads(POLICY_WATCH_PATH.read_text(encoding="utf-8"))
        watch.extend(new_watch_items)
        POLICY_WATCH_PATH.write_text(json.dumps(watch, ensure_ascii=False, indent=2), encoding="utf-8")

    REPORT_PATH.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    summary = (
        f"Refresh done: {len(changed)} source(s) changed, {len(errored)} error(s), "
        f"{len(new_watch_items)} new policy_watch item(s). Report: {REPORT_PATH}"
    )
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
