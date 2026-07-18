from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any, TypeVar
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from requests.adapters import HTTPAdapter
from requests.utils import get_encoding_from_headers
from urllib3.util.retry import Retry


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

T = TypeVar("T")


def configure_utf8_stdio() -> None:
    """Keep Vietnamese output readable on Windows and redirected consoles."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")


def ensure_data_dirs() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def normalize_unicode(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def normalize_for_match(value: str) -> str:
    value = unicodedata.normalize("NFD", value.casefold())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = value.replace("đ", "d")
    return re.sub(r"\s+", " ", value).strip()


def content_hash(value: bytes | str | Any) -> str:
    if isinstance(value, bytes):
        payload = value
    elif isinstance(value, str):
        payload = normalize_unicode(value).encode("utf-8")
    else:
        payload = json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    query = urlencode(sorted(parse_qsl(parts.query, keep_blank_values=True)))
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, query, ""))


def deduplicate(items: Iterable[T], key: Callable[[T], str]) -> tuple[list[T], list[T]]:
    unique: list[T] = []
    duplicates: list[T] = []
    seen: set[str] = set()
    for item in items:
        marker = key(item)
        if marker in seen:
            duplicates.append(item)
            continue
        seen.add(marker)
        unique.append(item)
    return unique, duplicates


def build_retry_session(retries: int = 3, backoff_factor: float = 0.8) -> requests.Session:
    retry = Retry(
        total=retries,
        connect=retries,
        read=retries,
        status=retries,
        allowed_methods=frozenset({"GET", "HEAD"}),
        status_forcelist=(408, 429, 500, 502, 503, 504),
        backoff_factor=backoff_factor,
        respect_retry_after_header=True,
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def decode_response(response: requests.Response) -> str:
    """Decode HTTP bytes without silently discarding Vietnamese characters."""
    declared = get_encoding_from_headers(response.headers)
    candidates = ["utf-8-sig", declared, response.apparent_encoding, "cp1258"]
    tried: set[str] = set()
    for encoding in candidates:
        if not encoding:
            continue
        normalized = encoding.strip().strip('"').casefold()
        if normalized in tried:
            continue
        tried.add(normalized)
        try:
            return normalize_unicode(response.content.decode(encoding, errors="strict"))
        except (LookupError, UnicodeDecodeError):
            continue
    return normalize_unicode(response.content.decode("utf-8", errors="replace"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
