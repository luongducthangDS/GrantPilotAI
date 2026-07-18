from __future__ import annotations

import sys
import unittest
from pathlib import Path

import requests


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from crawl_chinhphu_policy import is_relevant  # noqa: E402
from crawl_vbpl_official import (  # noqa: E402
    parse_rsc_file_list,
    safe_filename,
    stable_download_url,
)
from crawl_verified_sources import html_to_text  # noqa: E402
from data_pipeline_utils import (  # noqa: E402
    build_retry_session,
    canonical_url,
    content_hash,
    decode_response,
    deduplicate,
    normalize_for_match,
)


class DataPipelineUtilsTests(unittest.TestCase):
    def test_vietnamese_normalization(self) -> None:
        self.assertEqual(normalize_for_match("Đổi mới sáng tạo"), "doi moi sang tao")

    def test_content_hash_normalizes_unicode(self) -> None:
        self.assertEqual(content_hash("Café"), content_hash("Cafe\u0301"))

    def test_decode_response_prefers_valid_utf8_over_wrong_header(self) -> None:
        response = requests.Response()
        response.status_code = 200
        response.headers["content-type"] = "text/html; charset=iso-8859-1"
        response._content = "Hỗ trợ doanh nghiệp".encode("utf-8")
        self.assertEqual(decode_response(response), "Hỗ trợ doanh nghiệp")

    def test_deduplicate_uses_canonical_urls(self) -> None:
        urls = [
            "HTTPS://Example.com/path/?b=2&a=1#top",
            "https://example.com/path?a=1&b=2",
        ]
        unique, duplicates = deduplicate(urls, key=canonical_url)
        self.assertEqual(len(unique), 1)
        self.assertEqual(len(duplicates), 1)

    def test_retry_session_covers_transient_statuses(self) -> None:
        session = build_retry_session(retries=4)
        retry = session.get_adapter("https://").max_retries
        self.assertEqual(retry.total, 4)
        self.assertIn(429, retry.status_forcelist)
        self.assertIn(503, retry.status_forcelist)


class CrawlerTextTests(unittest.TestCase):
    def test_html_cleanup_preserves_vietnamese(self) -> None:
        title, text = html_to_text(
            "<html><title>Ưu đãi đầu tư</title><style>ẩn</style><body>Hỗ trợ vốn</body></html>"
        )
        self.assertEqual(title, "Ưu đãi đầu tư")
        self.assertEqual(text, "Ưu đãi đầu tư Hỗ trợ vốn")

    def test_policy_relevance_is_diacritic_insensitive(self) -> None:
        self.assertTrue(is_relevant("Ho tro doanh nghiep khoi nghiep", ""))
        self.assertFalse(is_relevant("Kết quả bóng đá", "Lịch thi đấu cuối tuần"))


class VbplOfficialCrawlerTests(unittest.TestCase):
    def test_parse_rsc_file_list(self) -> None:
        payload = '0:["$@1"]\n1:[{"fileName":"Phụ lục I.docx","size":123}]\n'
        self.assertEqual(parse_rsc_file_list(payload)[0]["fileName"], "Phụ lục I.docx")

    def test_safe_filename_preserves_vietnamese(self) -> None:
        self.assertEqual(safe_filename('Phụ lục: hỗ trợ?.docx'), "Phụ lục_ hỗ trợ_.docx")

    def test_stable_download_url_quotes_unicode(self) -> None:
        url = stable_download_url("123/Phụ lục I.docx")
        self.assertIn("Ph%E1%BB%A5%20l%E1%BB%A5c%20I.docx", url)
        self.assertTrue(url.endswith("/download"))


if __name__ == "__main__":
    unittest.main()
