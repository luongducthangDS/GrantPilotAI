import "server-only";

import manifestData from "@/data/processed/vbpl_ho_tro_doanh_nghiep_manifest.json";

import type { VbplAttachment, VbplDocument } from "@/lib/vbplTypes";

type RawAttachment = {
  fileName: string;
  mediaType: string;
  category: number;
  sourceSize: number;
  downloadedSize: number;
  sha256: string;
  sourceUrl: string;
  localPath: string;
  duplicateOf: string | null;
};

type RawDocument = {
  documentId: string;
  detailUrl: string;
  source: Record<string, string>;
  attachments: RawAttachment[];
};

type RawManifest = {
  documentCount: number;
  attachmentCount: number;
  uniqueFileBytes: number;
  duplicateFileCount: number;
  documents: RawDocument[];
};

const manifest = manifestData as RawManifest;

const categoryLabels: Record<number, string> = {
  1: "Văn bản gốc",
  2: "Bản Word / phụ lục",
  4: "Nội dung HTML"
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAttachment(attachment: RawAttachment): VbplAttachment {
  return {
    fileName: attachment.fileName,
    mediaType: attachment.mediaType,
    category: attachment.category,
    categoryLabel: categoryLabels[attachment.category] ?? "Tệp đính kèm",
    size: attachment.downloadedSize || attachment.sourceSize || 0,
    sha256: attachment.sha256,
    sourceUrl: attachment.sourceUrl,
    duplicateOf: attachment.duplicateOf
  };
}

function mapDocument(document: RawDocument): VbplDocument {
  const source = document.source;
  return {
    id: document.documentId,
    detailUrl: document.detailUrl,
    number: source["Số ký hiệu"] ?? "",
    title: source["Tên văn bản"] ?? "",
    documentType: source["Loại văn bản"] ?? "",
    issuer: source["Cơ quan ban hành"] ?? "",
    industry: source["Ngành"] ?? "",
    field: source["Lĩnh vực"] ?? "",
    issuedAt: source["Ngày ban hành"] ?? "",
    effectiveAt: source["Ngày có hiệu lực"] ?? "",
    expiresAt: source["Ngày hết hiệu lực toàn bộ"] ?? "",
    status: source["Tình trạng hiệu lực"] ?? "",
    attachments: document.attachments.map(mapAttachment)
  };
}

export const vbplDocuments = manifest.documents.map(mapDocument);

export const vbplSummary = {
  documentCount: manifest.documentCount,
  attachmentCount: manifest.attachmentCount,
  uniqueFileBytes: manifest.uniqueFileBytes,
  duplicateFileCount: manifest.duplicateFileCount
};

export const vbplDocumentTypes = [...new Set(vbplDocuments.map((document) => document.documentType).filter(Boolean))].sort((a, b) =>
  a.localeCompare(b, "vi")
);

export function searchVbplDocuments(keyword = "", documentType = "") {
  const normalizedKeyword = normalize(keyword);
  return vbplDocuments.filter((document) => {
    if (documentType && document.documentType !== documentType) return false;
    if (!normalizedKeyword) return true;
    const haystack = normalize(
      [document.number, document.title, document.documentType, document.issuer, document.industry, document.field].join(" ")
    );
    return normalizedKeyword.split(" ").every((token) => haystack.includes(token));
  });
}

export const vbplCorpusChunks = vbplDocuments.map((document) => ({
  id: `vbpl-${document.id}`,
  title: document.title,
  clause: `Thông tin văn bản ${document.number || document.id}`,
  status: document.status,
  source: document.detailUrl,
  tags: [
    "hỗ trợ doanh nghiệp",
    document.number,
    document.documentType,
    document.issuer,
    document.industry,
    document.field
  ].filter(Boolean),
  text: [
    document.title,
    `Số ký hiệu: ${document.number || "chưa có"}.`,
    `Loại văn bản: ${document.documentType || "chưa xác định"}.`,
    `Cơ quan ban hành: ${document.issuer || "chưa xác định"}.`,
    `Tình trạng: ${document.status || "chưa xác định"}.`,
    document.effectiveAt ? `Ngày có hiệu lực: ${document.effectiveAt}.` : "",
    document.field ? `Lĩnh vực: ${document.field}.` : "",
    `Có ${document.attachments.length} tệp văn bản hoặc phụ lục trên nguồn VBPL.`
  ]
    .filter(Boolean)
    .join(" ")
}));
