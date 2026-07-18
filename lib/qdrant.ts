import "server-only";

import { QdrantClient } from "@qdrant/js-client-rest";

// Collection name is configurable so the same code can point at a different
// collection per environment (e.g. a scratch collection while iterating on
// the corpus) without a code change — defaults to a fixed name so local dev
// works out of the box once QDRANT_URL/QDRANT_API_KEY are set.
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "grantpilot_corpus";

let cached: QdrantClient | null = null;

// Returns null (not a thrown error) when QDRANT_URL isn't configured — callers
// treat "no Qdrant configured" the same as "dense retrieval unavailable" and
// fall back to BM25-only, exactly like a missing embeddings API key already
// does elsewhere in lib/retrieval.ts.
export function getQdrantClient(): QdrantClient | null {
  const url = process.env.QDRANT_URL;
  if (!url) return null;
  if (cached) return cached;
  cached = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
  return cached;
}
