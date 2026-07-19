import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path("d:/GrantPilotAI")
DATA_DIR = ROOT / "data"
CORPUS_PATH = DATA_DIR / "corpus.json"
TXT_268 = DATA_DIR / "raw" / "vbpl" / "extracted" / "183411" / "268_2025_ND-CP_663962.txt"

def load_json(p):
    return json.loads(p.read_text(encoding="utf-8"))

def save_json(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def parse_nd268_articles(text: str):
    # Regex to capture Chapters, Sections, and Articles
    lines = text.splitlines()
    current_chapter = ""
    current_section = ""
    
    article_pattern = re.compile(r"^\s*(Điều\s+\d+)\.\s*(.*)")
    chapter_pattern = re.compile(r"^\s*(Chương\s+[IVXLCDM]+)\s*$", re.IGNORECASE)
    section_pattern = re.compile(r"^\s*(Mục\s+\d+)\.\s*(.*)", re.IGNORECASE)

    chunks = []
    current_article_id = None
    current_article_title = ""
    current_article_lines = []

    for line in lines:
        stripped = line.strip()
        
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
            # Save previous article
            if current_article_id:
                full_text = "\n".join(current_article_lines).strip()
                chunks.append({
                    "id": f"nd268-2025-dieu{current_article_id}",
                    "title": "Nghị định 268/2025/NĐ-CP",
                    "clause": f"{current_article_label}. {current_article_title}".strip(),
                    "chapter_section": f"{current_chapter} {current_section}".strip(),
                    "text": full_text
                })
            
            art_num_str = re.search(r"\d+", art_m.group(1)).group(0)
            current_article_id = art_num_str
            current_article_label = art_m.group(1)
            current_article_title = art_m.group(2)
            current_article_lines = [stripped]
        else:
            if current_article_id:
                current_article_lines.append(line)

    # Save last article
    if current_article_id:
        full_text = "\n".join(current_article_lines).strip()
        chunks.append({
            "id": f"nd268-2025-dieu{current_article_id}",
            "title": "Nghị định 268/2025/NĐ-CP",
            "clause": f"{current_article_label}. {current_article_title}".strip(),
            "chapter_section": f"{current_chapter} {current_section}".strip(),
            "text": full_text
        })

    return chunks

def main():
    text = TXT_268.read_text(encoding="utf-8")
    parsed_chunks = parse_nd268_articles(text)
    print(f"Parsed {len(parsed_chunks)} Articles from NĐ 268/2025!")

    corpus = load_json(CORPUS_PATH)
    # Filter out old 3 NĐ 268 entries to avoid duplicate IDs, then replace with complete parsed set
    corpus = [c for c in corpus if not c["id"].startswith("nd268-2025-")]
    
    new_entries = []
    for c in parsed_chunks:
        entry = {
            "id": c["id"],
            "title": c["title"],
            "clause": c["clause"],
            "status": "Còn hiệu lực (từ 14/10/2025)",
            "source": "https://vbpl.vn/van-ban/chi-tiet/nghi-dinh-so-268-2025-nd-cp-quy-dinh-chi-tiet-va-huong-dan-mot-so-dieu-cua-luat-khoa-hoc-cong-nghe-va-doi-moi-sang-tao-ve-doi-moi-sang-tao-khuyen-khich-hoat-dong-khoa-hoc-cong-nghe-va-doi-moi-sang-tao-trong-doanh-nghiep-cong-nhan-trung-tam-doi-moi-sang-tao-ho-tro-khoi-nghiep-sang-tao-cong-nhan-ca-nhan-doanh-nghiep-khoi-nghiep-sang-tao-ha-tang-mang-luoi-va-he-sinh-thai-khoi-nghiep-sang-tao--183411",
            "tags": ["Nghị định 268/2025/NĐ-CP", "đổi mới sáng tạo", "khởi nghiệp sáng tạo", c["clause"]],
            "text": f"{c['chapter_section']}\n\n{c['text']}" if c['chapter_section'] else c['text']
        }
        new_entries.append(entry)

    corpus.extend(new_entries)
    print(f"Total corpus size after adding NĐ 268: {len(corpus)} chunks.")
    save_json(CORPUS_PATH, corpus)

if __name__ == "__main__":
    main()
