// Precomputes embeddings for every chunk in data/corpus.json and writes
// data/corpus_embeddings.json. Run after any change to corpus.json, before
// building the app, so lib/retrieval.ts has an up-to-date dense index.
//
// Usage: node scripts/build-embeddings.mjs
// Requires CUSTOM_LLM_API_KEY (reads .env / .env.local if present, like Next.js does).

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const MODEL = process.env.CUSTOM_EMBEDDING_MODEL || "Vietnamese_Embedding";
const BASE_URL = process.env.CUSTOM_LLM_BASE_URL || "https://mkp-api.fptcloud.com/v1";
const BATCH_SIZE = 20;

function loadEnvFile(name) {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function chunkHaystack(chunk) {
  return [chunk.title, chunk.clause, chunk.tags.join(" "), chunk.text].join(" ");
}

async function embedBatch(texts, apiKey) {
  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, input: texts })
  });
  if (!response.ok) {
    throw new Error(`Embeddings API trả về lỗi ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const data = await response.json();
  return data.data ?? [];
}

async function main() {
  // .env.local loaded after .env so any override there wins, matching Next.js's own precedence.
  loadEnvFile(".env");
  loadEnvFile(".env.local");
  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  if (!apiKey) throw new Error("Thiếu CUSTOM_LLM_API_KEY (đặt trong .env hoặc biến môi trường).");

  const corpus = JSON.parse(readFileSync(resolve(ROOT, "data/corpus.json"), "utf-8"));
  const results = [];

  for (let i = 0; i < corpus.length; i += BATCH_SIZE) {
    const batch = corpus.slice(i, i + BATCH_SIZE);
    const embeddingsData = await embedBatch(batch.map(chunkHaystack), apiKey);
    batch.forEach((chunk, index) => {
      const values = embeddingsData[index]?.embedding;
      if (!values) throw new Error(`Không nhận được embedding cho chunk ${chunk.id}`);
      results.push({ id: chunk.id, embedding: values });
    });
    console.log(`Embedded ${Math.min(i + BATCH_SIZE, corpus.length)}/${corpus.length}`);
  }

  const payload = {
    model: MODEL,
    dimensions: results[0]?.embedding.length ?? 0,
    generated_at: new Date().toISOString(),
    chunks: results
  };
  writeFileSync(resolve(ROOT, "data/corpus_embeddings.json"), JSON.stringify(payload));
  console.log(`Wrote data/corpus_embeddings.json (${results.length} chunks, dim=${payload.dimensions})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
