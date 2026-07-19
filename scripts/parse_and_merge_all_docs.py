import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path("d:/GrantPilotAI")
DATA_DIR = ROOT / "data"
CORPUS_PATH = DATA_DIR / "corpus.json"
EXTRACTED_DIR = DATA_DIR / "raw" / "vbpl" / "extracted"

def load_json(p):
    return json.loads(p.read_text(encoding="utf-8"))

def save_json(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

# Regex to split on "Điều N" boundaries
DIEU_PATTERN = re.compile(r"\n\s*(Điều\s+\d+[a-z]?)\b[\.\:]?\s*(.*)", re.IGNORECASE)

def parse_document_text(doc_title: str, text: str, doc_id: str, source_url: str):
    lines = text.splitlines()
    current_chapter = ""
    current_section = ""

    article_pattern = re.compile(r"^\s*(Điều\s+\d+[a-z]?)\.\s*(.*)", re.IGNORECASE)
    chapter_pattern = re.compile(r"^\s*(Chương\s+[IVXLCDM\d]+)\s*.*", re.IGNORECASE)
    section_pattern = re.compile(r"^\s*(Mục\s+\d+)\.\s*.*", re.IGNORECASE)

    chunks = []
    current_article_label = ""
    current_article_num = ""
    current_article_title = ""
    current_article_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        ch_m = chapter_pattern.match(stripped)
        if ch_m:
            current_chapter = stripped
            continue

        sec_m = section_pattern.match(stripped)
        if sec_m:
            current_section = stripped
            continue

        art_m = article_pattern.match(stripped)
        if art_m:
            if current_article_num:
                full_body = "\n".join(current_article_lines).strip()
                if len(full_body) > 30:
                    prefix = f"{current_chapter} {current_section}".strip()
                    chunks.append({
                        "id": f"{doc_id}-dieu{current_article_num}".lower(),
                        "title": doc_title,
                        "clause": f"{current_article_label}. {current_article_title}".strip(),
                        "status": "Còn hiệu lực",
                        "source": source_url,
                        "tags": [doc_title, current_article_label],
                        "text": f"{prefix}\n\n{full_body}" if prefix else full_body
                    })

            current_article_label = art_m.group(1)
            num_m = re.search(r"\d+[a-z]?", current_article_label, re.IGNORECASE)
            current_article_num = num_m.group(0) if num_m else "1"
            current_article_title = art_m.group(2)
            current_article_lines = [stripped]
        else:
            if current_article_num:
                current_article_lines.append(line)

    if current_article_num:
        full_body = "\n".join(current_article_lines).strip()
        if len(full_body) > 30:
            prefix = f"{current_chapter} {current_section}".strip()
            chunks.append({
                "id": f"{doc_id}-dieu{current_article_num}".lower(),
                "title": doc_title,
                "clause": f"{current_article_label}. {current_article_title}".strip(),
                "status": "Còn hiệu lực",
                "source": source_url,
                "tags": [doc_title, current_article_label],
                "text": f"{prefix}\n\n{full_body}" if prefix else full_body
            })

    return chunks

def main():
    inventory_path = DATA_DIR / "raw" / "vbpl" / "attachment_inventory.json"
    inventory = load_json(inventory_path)["documents"] if inventory_path.exists() else []
    inventory_by_id = {doc["documentId"]: doc for doc in inventory}

    existing_corpus = load_json(CORPUS_PATH)
    existing_ids = {c["id"] for c in existing_corpus}
    
    total_added = 0
    all_new_chunks = []

    for d_path in EXTRACTED_DIR.iterdir():
        if not d_path.is_dir():
            continue

        doc_id = d_path.name
        meta = inventory_by_id.get(doc_id, {})
        so_ky_hieu = meta.get("Số ký hiệu", doc_id).strip()
        trich_yeu = meta.get("Trích yếu", "").strip()
        doc_title = so_ky_hieu if so_ky_hieu else f"Văn bản {doc_id}"
        if trich_yeu and len(doc_title) < 50:
            doc_title = f"{doc_title} - {trich_yeu[:60]}"
        
        source_url = meta.get("source", f"https://vbpl.vn/van-ban/chi-tiet/{doc_id}")

        # Pick best text file in folder
        txt_files = list(d_path.glob("*.txt"))
        if not txt_files:
            continue

        # Sort by size descending
        txt_files.sort(key=lambda f: f.stat().st_size, reverse=True)
        best_file = txt_files[0]
        text = best_file.read_text(encoding="utf-8", errors="ignore")

        parsed = parse_document_text(doc_title, text, f"doc-{doc_id}", source_url)
        for c in parsed:
            if c["id"] not in existing_ids:
                existing_ids.add(c["id"])
                all_new_chunks.append(c)
                total_added += 1

    print(f"Parsed and added {total_added} new clause chunks across all 42 documents!")
    
    final_corpus = existing_corpus + all_new_chunks
    print(f"Total corpus size: {len(final_corpus)} chunks.")
    save_json(CORPUS_PATH, final_corpus)

if __name__ == "__main__":
    main()
