// Uploads data/corpus.json + data/corpus_embeddings.json into a Qdrant Cloud
// collection, so lib/retrieval.ts can query dense vectors from Qdrant at
// request time instead of loading every chunk's vector into memory from a
// static JSON file. Re-run after `npm run data:embed` whenever corpus.json
// changes (this recreates the collection from scratch each time — the corpus
// is small enough, ~35 chunks, that a full rebuild is cheap and avoids
// leftover stale points from renamed/removed chunk ids).
//
// Usage: node scripts/upload-to-qdrant.mjs
// Requires QDRANT_URL and QDRANT_API_KEY (reads .env / .env.local like Next.js does).

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { QdrantClient } from "@qdrant/js-client-rest";

const ROOT = resolve(import.meta.dirname, "..");
const COLLECTION = process.env.QDRANT_COLLECTION || "grantpilot_corpus";
const BATCH_SIZE = 50;

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

async function main() {
  // .env.local loaded after .env so any override there wins, matching Next.js's own precedence.
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url) throw new Error("Thiếu QDRANT_URL (đặt trong .env hoặc biến môi trường).");

  const corpus = JSON.parse(readFileSync(resolve(ROOT, "data/corpus.json"), "utf-8"));

  const embeddingsPath = resolve(ROOT, "data/corpus_embeddings.json");
  if (!existsSync(embeddingsPath)) {
    throw new Error("Thiếu data/corpus_embeddings.json — chạy `npm run data:embed` trước.");
  }
  const embeddingsFile = JSON.parse(readFileSync(embeddingsPath, "utf-8"));
  const embeddingById = new Map(embeddingsFile.chunks.map((chunk) => [chunk.id, chunk.embedding]));

  const missing = corpus.filter((chunk) => !embeddingById.has(chunk.id));
  if (missing.length > 0) {
    throw new Error(
      `Thiếu embedding cho ${missing.length} chunk (${missing.map((chunk) => chunk.id).join(", ")}) — chạy lại \`npm run data:embed\`.`
    );
  }

  const client = new QdrantClient({ url, apiKey });

  await client.recreateCollection(COLLECTION, {
    vectors: { size: embeddingsFile.dimensions, distance: "Cosine" }
  });

  // Qdrant point ids must be an unsigned integer or a UUID — our chunk ids
  // are slugs like "nd80-dieu5", so use the array index as the point id and
  // carry the real chunk id in the payload for lookback to the local corpus.
  const points = corpus.map((chunk, index) => ({
    id: index,
    vector: embeddingById.get(chunk.id),
    payload: {
      chunk_id: chunk.id,
      title: chunk.title,
      clause: chunk.clause
    }
  }));

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await client.upsert(COLLECTION, { wait: true, points: batch });
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, points.length)}/${points.length}`);
  }

  console.log(
    `Đã đưa ${points.length} chunk vào Qdrant collection "${COLLECTION}" (model=${embeddingsFile.model}, dim=${embeddingsFile.dimensions}).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
