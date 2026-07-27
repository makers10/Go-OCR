export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  page_count: number | null;
  uploaded_at: string;
  expires_at: string | null;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExtractionJob {
  id: string;
  document_id: string;
  status: JobStatus;
  progress: number; // 0-100
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  page_number: number;
  text_content: string;
  bounding_boxes: BoundingBox[];
  extracted_at: string;
}

export interface SearchResultItem {
  document_id: string;
  user_id: string;
  filename: string;
  page_number: number;
  text_content: string;
  bounding_boxes: BoundingBox[];
  uploaded_at: string;
  snippets: string[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
