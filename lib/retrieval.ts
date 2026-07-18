import "server-only";

import corpusData from "@/data/corpus.json";
import { getQdrantClient, QDRANT_COLLECTION } from "@/lib/qdrant";
import { normalizeText, type CorpusChunk } from "@/lib/grantpilot";

const corpus = corpusData as CorpusChunk[];

const FPT_AI_BASE_URL = process.env.CUSTOM_LLM_BASE_URL || "https://mkp-api.fptcloud.com/v1";
const EMBEDDING_MODEL = process.env.CUSTOM_EMBEDDING_MODEL || "Vietnamese_Embedding";
const RERANK_MODEL = process.env.CUSTOM_RERANK_MODEL || "bge-reranker-v2-m3";
// How many RRF candidates the reranker gets to re-score before truncating to
// the caller's requested `limit` — wider than `limit` so reranking can
// actually reorder things, not just re-confirm whatever RRF already picked.
const RERANK_CANDIDATE_POOL = 15;

const STOPWORDS = new Set([
  "toi",
  "cong",
  "ty",
  "doanh",
  "nghiep",
  "co",
  "la",
  "duoc",
  "khong",
  "can",
  "gi",
  "nao",
  "ve",
  "cho",
  "the",
  "hay",
  "neu",
  "mot",
  "cac"
]);

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function chunkHaystack(chunk: CorpusChunk): string {
  return [chunk.title, chunk.clause, chunk.tags.join(" "), chunk.text].join(" ");
}

// BM25 (Okapi), k1=1.5, b=0.75 — standard defaults, tuned for short legal-clause chunks.
function bm25Rank(query: string): Map<string, number> {
  const k1 = 1.5;
  const b = 0.75;
  const queryTokens = tokenize(query);
  const docs = corpus.map((chunk) => ({ id: chunk.id, tokens: tokenize(chunkHaystack(chunk)) }));
  const N = docs.length;
  const avgdl = docs.reduce((sum, d) => sum + d.tokens.length, 0) / Math.max(N, 1);

  const df = new Map<string, number>();
  for (const term of new Set(queryTokens)) {
    let count = 0;
    for (const doc of docs) if (doc.tokens.includes(term)) count += 1;
    df.set(term, count);
  }

  const scores = new Map<string, number>();
  for (const doc of docs) {
    let score = 0;
    const dl = doc.tokens.length || 1;
    for (const term of queryTokens) {
      const n = df.get(term) ?? 0;
      if (n === 0) continue;
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
      const f = doc.tokens.filter((t) => t === term).length;
      if (f === 0) continue;
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl));
    }
    if (score > 0) scores.set(doc.id, score);
  }
  return scores;
}

async function embedQuery(query: string, apiKey: string): Promise<number[] | null> {
  const response = await fetch(`${FPT_AI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: query })
  });
  if (!response.ok) throw new Error(`Embeddings API trả về lỗi ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as { data?: { embedding?: number[] }[] };
  return data.data?.[0]?.embedding ?? null;
}

// Dense side of retrieval: embed the query, then search Qdrant Cloud for the
// nearest corpus vectors (uploaded via scripts/upload-to-qdrant.mjs). Corpus
// vectors themselves no longer live in this process — Qdrant is now the
// vector store, replacing the earlier approach of loading every chunk's
// embedding into memory from data/corpus_embeddings.json and computing
// cosine similarity by hand. Returns an empty map (not a throw) when Qdrant
// isn't configured, so the caller's existing "no dense scores -> BM25-only"
// fallback keeps working unchanged.
async function denseRank(query: string, apiKey: string): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  const client = getQdrantClient();
  if (!client) return scores;

  const queryVector = await embedQuery(query, apiKey);
  if (!queryVector) return scores;

  const results = await client.search(QDRANT_COLLECTION, {
    vector: queryVector,
    limit: 20,
    with_payload: true
  });

  for (const point of results) {
    const chunkId = point.payload?.chunk_id;
    if (typeof chunkId === "string") scores.set(chunkId, point.score);
  }
  return scores;
}

// Cross-encoder rerank of a candidate shortlist (via the "Infinity"-style
// /rerank endpoint this deployment exposes — {model, query, documents} ->
// {results: [{index, relevance_score}]}). More accurate than the
// bag-of-vectors similarity RRF already used to build the shortlist, since
// it scores query+document together instead of comparing two independently
// embedded vectors — worth the extra call for the final top-N ordering.
async function rerank(query: string, candidates: CorpusChunk[], apiKey: string): Promise<CorpusChunk[]> {
  if (candidates.length <= 1) return candidates;
  const response = await fetch(`${FPT_AI_BASE_URL}/rerank`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: RERANK_MODEL, query, documents: candidates.map((chunk) => chunkHaystack(chunk)) })
  });
  if (!response.ok) throw new Error(`Rerank API trả về lỗi ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as { results?: { index: number; relevance_score: number }[] };
  if (!data.results?.length) return candidates;
  return [...data.results]
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .map((item) => candidates[item.index])
    .filter((chunk): chunk is CorpusChunk => Boolean(chunk));
}

// Reciprocal Rank Fusion: combines multiple ranked lists into one, robust to
// each ranker's score scale being incomparable (BM25 scores and cosine
// similarity are not on the same scale, so we fuse by rank position, not score).
function reciprocalRankFusion(rankLists: Map<string, number>[], k = 60): Map<string, number> {
  const fused = new Map<string, number>();
  for (const ranks of rankLists) {
    const sorted = [...ranks.entries()].sort((a, b) => b[1] - a[1]);
    sorted.forEach(([id], index) => {
      fused.set(id, (fused.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return fused;
}

export type RetrievalResult = {
  chunks: CorpusChunk[];
  mode: "hybrid_reranked" | "hybrid" | "bm25_only";
};

// Hybrid retrieval: BM25 (exact/keyword match — strong for legal doc numbers
// like "NĐ 80/2021", "khoản 2 điều 12") + dense embedding similarity via
// Qdrant Cloud (semantic match — catches paraphrases/synonyms BM25 misses),
// fused with RRF, then a cross-encoder reranks the fused shortlist for the
// final ordering. Each stage falls back gracefully if its dependency is
// unavailable (missing API key, QDRANT_URL not configured, stale collection,
// or a network error): dense failure -> BM25-only; rerank failure -> keep
// the RRF order as-is.
export async function hybridRetrieve(query: string, limit = 5): Promise<RetrievalResult> {
  const bm25Scores = bm25Rank(query);
  const apiKey = process.env.CUSTOM_LLM_API_KEY;

  let fused = bm25Scores;
  let mode: RetrievalResult["mode"] = "bm25_only";

  if (apiKey) {
    try {
      const dense = await denseRank(query, apiKey);
      if (dense.size > 0) {
        fused = reciprocalRankFusion([bm25Scores, dense]);
        mode = "hybrid";
      }
    } catch (error) {
      console.error("Dense retrieval thất bại, dùng BM25-only:", error);
    }
  }

  const byId = new Map(corpus.map((chunk) => [chunk.id, chunk]));
  const rankedIds = [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const shortlist = rankedIds.slice(0, RERANK_CANDIDATE_POOL).map((id) => byId.get(id)!).filter(Boolean);

  if (mode === "hybrid" && apiKey && shortlist.length > 1) {
    try {
      const reranked = await rerank(query, shortlist, apiKey);
      return { chunks: reranked.slice(0, limit), mode: "hybrid_reranked" };
    } catch (error) {
      console.error("Rerank thất bại, dùng thứ tự RRF:", error);
    }
  }

  return { chunks: shortlist.slice(0, limit), mode };
}
