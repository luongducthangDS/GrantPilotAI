import { NextRequest, NextResponse } from "next/server";

import { searchVbplDocuments, vbplDocumentTypes, vbplSummary } from "@/lib/vbpl";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const documentType = request.nextUrl.searchParams.get("type")?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(25, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10) || 8));

  const matches = searchVbplDocuments(keyword, documentType);
  const start = (page - 1) * limit;

  return NextResponse.json({
    query: { keyword, type: documentType, page, limit },
    summary: { ...vbplSummary, matchedDocuments: matches.length },
    documentTypes: vbplDocumentTypes,
    documents: matches.slice(start, start + limit)
  });
}
