import "server-only";

import { normalizeText } from "@/lib/grantpilot";

export type TextChunk = { heading: string; text: string };

const HEADING_PATTERN = /\n\s*((?:Đi[eề]u|Ph[aầ]n|Ch[uươ]ng|M[uụ]c)\s+\d+[a-zA-Z]?)[.:\s]/gi;
const MAX_CHUNK_CHARS = 1500;
const MIN_FALLBACK_CHUNK_CHARS = 200;

// Splits one extracted document into smaller labeled chunks so a long
// upload (20-30 page PDF/Word) can be narrowed down to only the parts
// relevant to each checklist item, instead of sending the whole document
// to the model on every request (see checklist-match/route.ts). Prefers
// legal/report-style headings (Điều/Chương/Mục/Phần) when the document has
// them; falls back to fixed-size paragraph windows for plain business
// documents (invoices, financial statements) that don't.
export function chunkText(source: string, text: string): TextChunk[] {
  const matches = [...text.matchAll(HEADING_PATTERN)];
  if (matches.length >= 2) {
    const chunks: TextChunk[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
      const heading = matches[i][1].trim();
      const body = text.slice(start, end).trim();
      if (body) chunks.push({ heading: `${source} — ${heading}`, text: body.slice(0, MAX_CHUNK_CHARS) });
    }
    return chunks;
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: TextChunk[] = [];
  let buffer = "";
  let part = 1;
  for (const para of paragraphs) {
    if (buffer.length + para.length > MAX_CHUNK_CHARS && buffer.length >= MIN_FALLBACK_CHUNK_CHARS) {
      chunks.push({ heading: `${source} — phần ${part}`, text: buffer.trim() });
      buffer = "";
      part += 1;
    }
    buffer += (buffer ? "\n\n" : "") + para;
  }
  if (buffer.trim()) chunks.push({ heading: `${source} — phần ${part}`, text: buffer.trim() });
  return chunks;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

// Lightweight BM25 (Okapi, k1=1.5, b=0.75) over an ad hoc, per-request set of
// chunks — distinct from the fixed policy-corpus BM25 in lib/retrieval.ts.
// Used to pick the handful of chunks most relevant to a single checklist
// item out of a long uploaded document, rather than always sending the
// entire document for every item.
export function rankChunks(chunks: TextChunk[], query: string, topN: number): TextChunk[] {
  const k1 = 1.5;
  const b = 0.75;
  const queryTokens = tokenize(query);
  const docs = chunks.map((chunk) => ({ chunk, tokens: tokenize(chunk.text) }));
  const N = docs.length;
  if (N === 0 || queryTokens.length === 0) return chunks.slice(0, topN);
  const avgdl = docs.reduce((sum, d) => sum + d.tokens.length, 0) / N;

  const df = new Map<string, number>();
  for (const term of new Set(queryTokens)) {
    df.set(term, docs.filter((d) => d.tokens.includes(term)).length);
  }

  const scored = docs.map((d) => {
    let score = 0;
    const dl = d.tokens.length || 1;
    for (const term of queryTokens) {
      const n = df.get(term) ?? 0;
      if (n === 0) continue;
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
      const f = d.tokens.filter((t) => t === term).length;
      if (f === 0) continue;
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl));
    }
    return { chunk: d.chunk, score };
  });

  const ranked = scored.sort((a, c) => c.score - a.score);
  // If nothing scored (no query-term overlap at all), fall back to the
  // document's natural order rather than returning nothing for this item.
  const withSignal = ranked.filter((s) => s.score > 0);
  return (withSignal.length > 0 ? withSignal : ranked).slice(0, topN).map((s) => s.chunk);
}
