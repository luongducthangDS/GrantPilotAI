"""Process raw legal files using FPT.AI Marketplace models concurrently with page-level caching.

1. Vision OCR for scanned PDFs using Qwen2.5-VL-7B-Instruct.
2. Text restoration for legacy font encoded files using GLM-5.2 / DeepSeek-V4-Flash.

Usage: python scripts/process_raw_with_fpt_ai.py
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
TMP_DIR = ROOT / "tmp" / "fpt_ai_ocr_pages"
EXTRACTED_DIR = ROOT / "data" / "raw" / "vbpl" / "extracted"

def load_env(env_path: Path):
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())

load_env(ROOT / ".env")
load_env(ROOT / ".env.local")

BASE_URL = os.environ.get("CUSTOM_LLM_BASE_URL", "https://mkp-api.fptcloud.com/v1")
API_KEY = os.environ.get("CUSTOM_LLM_API_KEY", "")

VISION_MODEL = "Qwen2.5-VL-7B-Instruct"
TEXT_MODEL = "DeepSeek-V4-Flash"

if not API_KEY:
    print("ERROR: CUSTOM_LLM_API_KEY is not set in environment or .env file.")
    sys.exit(1)

OCR_TARGETS = [
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
    {
        "document_id": "150955",
        "pdf": "data/raw/vbpl/files/150955/VanBanGoc_35.2021.TT.PDF",
        "title": "Thông tư 35/2021/TT-BTC",
    },
]

TEXT_RESTORE_TARGETS = [
    {
        "document_id": "108311",
        "file": "data/raw/vbpl/extracted/108311/68-TC_TCDN.txt",
        "title": "Thông tư 68/TC-TCDN",
    },
    {
        "document_id": "108352",
        "file": "data/raw/vbpl/extracted/108352/05-TT_LB.txt",
        "title": "Thông tư 05-TT/LB",
    },
    {
        "document_id": "27965",
        "file": "data/raw/vbpl/extracted/27965/VanBanGoc_141_2012_TTLT-BTC-BQP-BCA.txt",
        "title": "Thông tư liên tịch 141/2012/TTLT-BTC-BQP-BCA",
    },
]


def call_fpt_chat(payload: dict) -> str:
    url = f"{BASE_URL.rstrip('/')}/chat/completions"
    req_body = json.dumps(payload).encode("utf-8")
    max_retries = 3
    for attempt in range(max_retries):
        try:
            request = urllib.request.Request(
                url,
                data=req_body,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=35) as response:
                res_body = response.read().decode("utf-8")
                data = json.loads(res_body)
                message = data["choices"][0]["message"]
                content = message.get("content")
                if not content and "reasoning_content" in message:
                    content = message["reasoning_content"]
                return content or ""
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(1 + attempt * 2)
    return ""


def render_pdf_to_images(pdf_path: Path, work_dir: Path, dpi: int = 180) -> list[Path]:
    work_dir.mkdir(parents=True, exist_ok=True)
    prefix = work_dir / "page"
    existing = sorted(work_dir.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    if existing:
        return existing
    subprocess.run(["pdftoppm", "-png", "-r", str(dpi), str(pdf_path), str(prefix)], check=True, cwd=ROOT)
    return sorted(work_dir.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))


def ocr_image_with_fpt(image_path: Path) -> str:
    img_bytes = image_path.read_bytes()
    b64_str = base64.b64encode(img_bytes).decode("utf-8")
    payload = {
        "model": VISION_MODEL,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Hãy trích xuất toàn bộ văn bản từ hình ảnh trang tài liệu này. "
                            "Yêu cầu: Đảm bảo đúng tiếng Việt có dấu, đúng chính tả, đúng cấu trúc tiêu đề, "
                            "điều khoản và bảng biểu (nếu có). Không thêm bớt ý kiến hay nhận xét ngoài văn bản."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64_str}"},
                    },
                ],
            }
        ],
    }
    return call_fpt_chat(payload)


def restore_text_with_fpt(text_content: str) -> str:
    payload = {
        "model": TEXT_MODEL,
        "temperature": 0.1,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Bạn là chuyên gia khôi phục văn bản pháp luật Việt Nam. Văn bản dưới đây bị lỗi mã hóa font cũ (như TCVN3/VNI) "
                    "khiến ký tự tiếng Việt bị lệch (ví dụ: ð/Ð thành đ/Đ, ý thành ư/y, õ thành ơ, ã thành ă, nãm -> năm, hýớng dẫn -> hướng dẫn, nýớc -> nước). "
                    "Hãy sửa lại toàn bộ văn bản về tiếng Việt chuẩn có dấu, đúng từ ngữ pháp lý, giữ nguyên bố cục Điều/Khoản và số hiệu văn bản. "
                    "Chỉ trả về nội dung văn bản hoàn chỉnh đã sửa, không thêm lời chào hay giải thích."
                ),
            },
            {
                "role": "user",
                "content": text_content,
            },
        ],
    }
    return call_fpt_chat(payload)


def process_single_page(args):
    page_num, img_path, cache_file = args
    if cache_file.exists() and cache_file.stat().st_size > 20:
        print(f"  Page {page_num} CACHED", flush=True)
        return page_num, cache_file.read_text(encoding="utf-8")
    try:
        txt = ocr_image_with_fpt(img_path)
        formatted_txt = f"## Page {page_num}\n\n{txt}"
        cache_file.write_text(formatted_txt, encoding="utf-8")
        print(f"  Page {page_num} OK", flush=True)
        return page_num, formatted_txt
    except Exception as e:
        print(f"  Page {page_num} FAILED: {e}", flush=True)
        return page_num, f"## Page {page_num}\n\n[Lỗi OCR trang {page_num}: {e}]"


def process_ocr_targets():
    print("=== STARTING VISION OCR WITH FPT.AI (CACHED & CONCURRENT) ===")
    for target in OCR_TARGETS:
        doc_id = target["document_id"]
        pdf_path = ROOT / target["pdf"]
        title = target["title"]
        out_dir = EXTRACTED_DIR / doc_id
        out_file = out_dir / f"{pdf_path.stem}_fpt_ocr.txt"

        if out_file.exists() and out_file.stat().st_size > 1000:
            print(f"SKIP {doc_id}: {out_file.relative_to(ROOT)} already exists ({out_file.stat().st_size} bytes)")
            continue

        print(f"\n--- Processing OCR for {doc_id}: {title} ---")
        if not pdf_path.exists():
            print(f"File missing: {pdf_path}")
            continue

        work_dir = TMP_DIR / doc_id
        images = render_pdf_to_images(pdf_path, work_dir)
        print(f"Rendered {len(images)} pages. Processing with FPT {VISION_MODEL}...")

        task_args = []
        for i, img in enumerate(images, start=1):
            cache_file = work_dir / f"page_{i}.txt"
            task_args.append((i, img, cache_file))

        results = {}
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_single_page, arg) for arg in task_args]
            for future in as_completed(futures):
                p_num, p_text = future.result()
                results[p_num] = p_text

        page_texts = [results[i] for i in sorted(results.keys())]
        full_doc_text = f"# {title}\n\nNguồn: {target['pdf']}\nOCR Model: FPT.AI {VISION_MODEL}\n\n" + "\n\n".join(page_texts)

        out_dir.mkdir(parents=True, exist_ok=True)
        out_file.write_text(full_doc_text, encoding="utf-8")
        print(f"--> Saved OCR output to {out_file.relative_to(ROOT)}")


def process_single_chunk(args):
    chunk_num, chunk_text = args
    try:
        res = restore_text_with_fpt(chunk_text)
        print(f"  Chunk {chunk_num} OK", flush=True)
        return chunk_num, res
    except Exception as e:
        print(f"  Chunk {chunk_num} FAILED: {e}", flush=True)
        return chunk_num, chunk_text


def process_text_restore_targets():
    print("\n=== STARTING TEXT RESTORATION WITH FPT.AI (CONCURRENT) ===")
    for target in TEXT_RESTORE_TARGETS:
        doc_id = target["document_id"]
        file_path = ROOT / target["file"]
        title = target["title"]
        out_file = file_path.parent / f"{file_path.stem}_restored.txt"

        if out_file.exists() and out_file.stat().st_size > 1000:
            print(f"SKIP {doc_id}: {out_file.relative_to(ROOT)} already exists")
            continue

        print(f"\n--- Processing Text Restoration for {doc_id}: {title} ---")
        if not file_path.exists():
            print(f"File missing: {file_path}")
            continue

        raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
        print(f"File size: {len(raw_text)} chars. Restoring with FPT.AI {TEXT_MODEL}...")

        chunk_size = 4000
        paragraphs = raw_text.split("\n\n")
        chunks = []
        current_chunk = []
        current_len = 0
        for p in paragraphs:
            if current_len + len(p) > chunk_size and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [p]
                current_len = len(p)
            else:
                current_chunk.append(p)
                current_len += len(p)
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        results = {}
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_single_chunk, (i, chunk)) for i, chunk in enumerate(chunks, start=1)]
            for future in as_completed(futures):
                c_num, c_text = future.result()
                results[c_num] = c_text

        restored_parts = [results[i] for i in sorted(results.keys())]
        full_restored = f"# {title} (Đã khôi phục font chuẩn qua FPT.AI {TEXT_MODEL})\n\n" + "\n\n".join(restored_parts)
        out_file.write_text(full_restored, encoding="utf-8")
        print(f"--> Saved restored text to {out_file.relative_to(ROOT)}")


def main():
    process_ocr_targets()
    process_text_restore_targets()
    print("\n=== FPT.AI PROCESSING COMPLETE ===")


if __name__ == "__main__":
    main()
