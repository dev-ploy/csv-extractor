export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SessionPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface UploadResponse {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  preview: SessionPreview;
}

export interface MappingResponse {
  strategy: string;
  mapping: Record<string, string | null>;
}

export interface PreviewData {
  headers: string[];
  mapping: Record<string, string | null>;
  rows: { raw: Record<string, string>; mapped: Record<string, string> }[];
  totalRows: number;
}

export interface ImportResult {
  imported: number;
  skipped: { skipReason: string; email?: string }[];
  total: number;
  created: Record<string, string>[];
}

export interface SessionSummary {
  sessionId: string;
  filename: string;
  status: string;
  total: number;
  parsed: number;
  imported: number;
  skipped: number;
}

export interface Session {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  headerMapping: Record<string, string> | null;
  createdAt: string;
  expiresAt: string;
}

export interface AppError {
  error: string;
  details?: { field: string; message: string }[];
}

export interface ColumnAnalysis {
  name: string;
  type: string;
  completeness: number;
  uniqueness: number;
  mappingConfidence: string;
  issues: string | null;
}

export interface AiSummary {
  overallSummary: string;
  dataQualityScore: number;
  datasetQuality: string;
  columns: ColumnAnalysis[];
  recommendations: string[];
  totalRows: number;
  filename: string;
  sessionId: string;
}
