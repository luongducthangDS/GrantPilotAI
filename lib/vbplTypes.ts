export type VbplAttachment = {
  fileName: string;
  mediaType: string;
  category: number;
  categoryLabel: string;
  size: number;
  sha256: string;
  sourceUrl: string;
  duplicateOf: string | null;
};

export type VbplDocument = {
  id: string;
  detailUrl: string;
  number: string;
  title: string;
  documentType: string;
  issuer: string;
  industry: string;
  field: string;
  issuedAt: string;
  effectiveAt: string;
  expiresAt: string;
  status: string;
  attachments: VbplAttachment[];
};

export type VbplSearchResponse = {
  query: {
    keyword: string;
    type: string;
    page: number;
    limit: number;
  };
  summary: {
    documentCount: number;
    attachmentCount: number;
    uniqueFileBytes: number;
    duplicateFileCount: number;
    matchedDocuments: number;
  };
  documentTypes: string[];
  documents: VbplDocument[];
};
