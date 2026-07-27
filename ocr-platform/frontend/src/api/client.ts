import type { 
  User, 
  Document, 
  ExtractionJob, 
  DocumentPage, 
  SearchResultItem, 
  PaginatedResult,
  AuthResponse,
  BoundingBox
} from '../types';

// Storage Keys
const MOCK_STORAGE_KEY = 'ocr_mock_db';
const AUTH_TOKEN_KEY = 'ocr_jwt_token';
const AUTH_USER_KEY = 'ocr_user';
const API_MODE_KEY = 'ocr_api_mode'; // 'live' | 'demo'

// Seed Mock Database
const SEED_USER: User = {
  id: 'u-1',
  email: 'demo@example.com',
  created_at: new Date('2026-07-01').toISOString()
};

const SEED_DOCUMENTS: Document[] = [
  {
    id: 'd-1',
    user_id: 'u-1',
    filename: 'retail_invoice_89.png',
    mime_type: 'image/png',
    file_size: 1258291, // 1.2 MB
    storage_path: 'uploads/d-1.png',
    page_count: 1,
    uploaded_at: new Date('2026-07-26T14:32:00Z').toISOString(),
    expires_at: null
  },
  {
    id: 'd-2',
    user_id: 'u-1',
    filename: 'ocr_system_architecture.pdf',
    mime_type: 'application/pdf',
    file_size: 5033164, // 4.8 MB
    storage_path: 'uploads/d-2.pdf',
    page_count: 2,
    uploaded_at: new Date('2026-07-25T09:15:00Z').toISOString(),
    expires_at: null
  },
  {
    id: 'd-3',
    user_id: 'u-1',
    filename: 'coffee_receipt.jpg',
    mime_type: 'image/jpeg',
    file_size: 460800, // 450 KB
    storage_path: 'uploads/d-3.jpg',
    page_count: 1,
    uploaded_at: new Date('2026-07-27T08:05:00Z').toISOString(),
    expires_at: null
  }
];

const SEED_PAGES: Record<string, DocumentPage[]> = {
  'd-1': [
    {
      id: 'p-1',
      document_id: 'd-1',
      page_number: 1,
      text_content: 'INVOICE INV-2026-89 Date: July 26, 2026 Bill To: Acme Corporation Description: Standard OCR Services Amount: $450.00 Support Package Amount: $50.00 Total Due: $500.00 Thank you!',
      extracted_at: new Date('2026-07-26T14:32:15Z').toISOString(),
      bounding_boxes: [
        { x: 50, y: 50, width: 140, height: 28, text: 'INVOICE', confidence: 99.5 },
        { x: 50, y: 90, width: 120, height: 16, text: 'INV-2026-89', confidence: 98.2 },
        { x: 400, y: 50, width: 150, height: 16, text: 'Date: July 26, 2026', confidence: 99.1 },
        { x: 50, y: 140, width: 65, height: 14, text: 'Bill To:', confidence: 97.4 },
        { x: 50, y: 165, width: 160, height: 20, text: 'Acme Corporation', confidence: 99.9 },
        { x: 50, y: 220, width: 110, height: 14, text: 'Description:', confidence: 96.5 },
        { x: 50, y: 250, width: 200, height: 16, text: 'Standard OCR Services', confidence: 98.8 },
        { x: 450, y: 250, width: 80, height: 16, text: '$450.00', confidence: 99.4 },
        { x: 50, y: 280, width: 150, height: 16, text: 'Support Package', confidence: 98.7 },
        { x: 450, y: 280, width: 80, height: 16, text: '$50.00', confidence: 99.2 },
        { x: 340, y: 340, width: 90, height: 18, text: 'Total Due:', confidence: 99.0 },
        { x: 450, y: 340, width: 80, height: 18, text: '$500.00', confidence: 99.7 },
        { x: 50, y: 400, width: 110, height: 16, text: 'Thank you!', confidence: 95.0 }
      ]
    }
  ],
  'd-2': [
    {
      id: 'p-2-1',
      document_id: 'd-2',
      page_number: 1,
      text_content: 'SYSTEM ARCHITECTURE FOR ENTERPRISE OCR PLATFORM Abstract: This document details the single-tenant OCR system utilizing Go, Gin, PostgreSQL, Redis, and OpenSearch. The goal is to provide a secure and rapid document scanning framework.',
      extracted_at: new Date('2026-07-25T09:15:20Z').toISOString(),
      bounding_boxes: [
        { x: 80, y: 60, width: 440, height: 24, text: 'SYSTEM ARCHITECTURE FOR ENTERPRISE OCR PLATFORM', confidence: 99.2 },
        { x: 80, y: 120, width: 90, height: 16, text: 'Abstract:', confidence: 98.0 },
        { x: 80, y: 145, width: 440, height: 16, text: 'This document details the single-tenant OCR system utilizing Go,', confidence: 97.8 },
        { x: 80, y: 170, width: 440, height: 16, text: 'Gin, PostgreSQL, Redis, and OpenSearch. The goal is to provide', confidence: 98.5 },
        { x: 80, y: 195, width: 380, height: 16, text: 'a secure and rapid document scanning framework.', confidence: 98.9 }
      ]
    },
    {
      id: 'p-2-2',
      document_id: 'd-2',
      page_number: 2,
      text_content: 'DATA PIPELINE AND WORKER SCALING RULES The background worker consumes jobs from Redis queues. Images are converted using pdfcpu, then parsed via the PaddleOCR Docker service. Scalability is achieved by spinning up independent worker processes.',
      extracted_at: new Date('2026-07-25T09:15:25Z').toISOString(),
      bounding_boxes: [
        { x: 80, y: 60, width: 380, height: 22, text: 'DATA PIPELINE AND WORKER SCALING RULES', confidence: 99.1 },
        { x: 80, y: 110, width: 440, height: 16, text: 'The background worker consumes jobs from Redis queues. Images are', confidence: 98.3 },
        { x: 80, y: 135, width: 440, height: 16, text: 'converted using pdfcpu, then parsed via the PaddleOCR Docker', confidence: 97.4 },
        { x: 80, y: 160, width: 440, height: 16, text: 'service. Scalability is achieved by spinning up independent', confidence: 98.7 },
        { x: 80, y: 185, width: 220, height: 16, text: 'worker processes.', confidence: 99.0 }
      ]
    }
  ],
  'd-3': [
    {
      id: 'p-3',
      document_id: 'd-3',
      page_number: 1,
      text_content: 'COFFEE & BITES 1x Espresso $3.50 1x Croissant $4.20 Subtotal: $7.70 Tax: $0.62 Total: $8.32 Cash Payment Thank you for visiting us!',
      extracted_at: new Date('2026-07-27T08:05:10Z').toISOString(),
      bounding_boxes: [
        { x: 120, y: 40, width: 160, height: 22, text: 'COFFEE & BITES', confidence: 99.8 },
        { x: 60, y: 90, width: 100, height: 14, text: '1x Espresso', confidence: 98.5 },
        { x: 260, y: 90, width: 50, height: 14, text: '$3.50', confidence: 99.0 },
        { x: 60, y: 115, width: 110, height: 14, text: '1x Croissant', confidence: 97.9 },
        { x: 260, y: 115, width: 50, height: 14, text: '$4.20', confidence: 99.2 },
        { x: 60, y: 150, width: 80, height: 14, text: 'Subtotal:', confidence: 96.0 },
        { x: 260, y: 150, width: 50, height: 14, text: '$7.70', confidence: 98.8 },
        { x: 60, y: 175, width: 40, height: 14, text: 'Tax:', confidence: 99.1 },
        { x: 260, y: 175, width: 50, height: 14, text: '$0.62', confidence: 99.4 },
        { x: 60, y: 210, width: 60, height: 16, text: 'Total:', confidence: 99.7 },
        { x: 250, y: 210, width: 60, height: 16, text: '$8.32', confidence: 99.9 },
        { x: 60, y: 250, width: 110, height: 14, text: 'Cash Payment', confidence: 95.5 },
        { x: 60, y: 290, width: 200, height: 14, text: 'Thank you for visiting us!', confidence: 98.4 }
      ]
    }
  ]
};

const SEED_JOBS: ExtractionJob[] = [
  {
    id: 'j-1',
    document_id: 'd-1',
    status: 'completed',
    progress: 100,
    error_message: null,
    created_at: new Date('2026-07-26T14:32:00Z').toISOString(),
    started_at: new Date('2026-07-26T14:32:05Z').toISOString(),
    completed_at: new Date('2026-07-26T14:32:15Z').toISOString()
  },
  {
    id: 'j-2',
    document_id: 'd-2',
    status: 'completed',
    progress: 100,
    error_message: null,
    created_at: new Date('2026-07-25T09:15:00Z').toISOString(),
    started_at: new Date('2026-07-25T09:15:05Z').toISOString(),
    completed_at: new Date('2026-07-25T09:15:25Z').toISOString()
  },
  {
    id: 'j-3',
    document_id: 'd-3',
    status: 'completed',
    progress: 100,
    error_message: null,
    created_at: new Date('2026-07-27T08:05:00Z').toISOString(),
    started_at: new Date('2026-07-27T08:05:03Z').toISOString(),
    completed_at: new Date('2026-07-27T08:05:10Z').toISOString()
  }
];

interface MockDB {
  documents: Document[];
  pages: Record<string, DocumentPage[]>;
  jobs: ExtractionJob[];
}

function getMockDB(): MockDB {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!stored) {
    const db: MockDB = {
      documents: SEED_DOCUMENTS,
      pages: SEED_PAGES,
      jobs: SEED_JOBS
    };
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  return JSON.parse(stored);
}

function saveMockDB(db: MockDB) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

// Client Class Implementation
class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  get mode(): 'live' | 'demo' {
    return (localStorage.getItem(API_MODE_KEY) as 'live' | 'demo') || 'demo';
  }

  set mode(val: 'live' | 'demo') {
    localStorage.setItem(API_MODE_KEY, val);
    window.dispatchEvent(new Event('api-mode-change'));
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (this.mode === 'demo') {
      throw new Error("Cannot run raw requests in demo mode");
    }
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    if (response.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      window.dispatchEvent(new Event('auth-logout'));
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: 'Unknown API error' }));
      throw new Error(errBody.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // --- AUTH ENDPOINTS ---
  async login(email: string, password: string): Promise<AuthResponse> {
    if (this.mode === 'demo') {
      // Dummy validation for demo
      if (email && password) {
        const authData: AuthResponse = {
          token: 'demo-jwt-token-xyz',
          user: SEED_USER
        };
        localStorage.setItem(AUTH_TOKEN_KEY, authData.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authData.user));
        return authData;
      }
      throw new Error('Invalid email or password');
    }

    const res = await this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
    return res;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    window.dispatchEvent(new Event('auth-logout'));
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // --- DOCUMENTS ---
  async getDocuments(page = 1, size = 10): Promise<PaginatedResult<Document>> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      // Reverse chronological order
      const sorted = [...db.documents].sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );
      const start = (page - 1) * size;
      const end = start + size;
      return {
        items: sorted.slice(start, end),
        total: sorted.length,
        page,
        size
      };
    }

    return this.request<PaginatedResult<Document>>(`/api/v1/documents?page=${page}&size=${size}`);
  }

  async getDocument(id: string): Promise<Document> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      const doc = db.documents.find(d => d.id === id);
      if (!doc) throw new Error('Document not found');
      return doc;
    }
    return this.request<Document>(`/api/v1/documents/${id}`);
  }

  async getDocumentPages(id: string): Promise<DocumentPage[]> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      const pages = db.pages[id] || [];
      return pages;
    }
    const res = await this.request<{ pages: DocumentPage[] }>(`/api/v1/documents/${id}`);
    // The blueprint notes: GET /api/v1/documents/:id returns metadata + text.
    // Let's assume pages are embedded or returned. Adjust as needed.
    // If it's metadata + page list, return pages array.
    return (res as any).pages || [];
  }

  async deleteDocument(id: string): Promise<void> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      db.documents = db.documents.filter(d => d.id !== id);
      delete db.pages[id];
      db.jobs = db.jobs.filter(j => j.document_id !== id);
      saveMockDB(db);
      return;
    }
    return this.request<void>(`/api/v1/documents/${id}`, { method: 'DELETE' });
  }

  async reprocessDocument(id: string): Promise<ExtractionJob> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      const doc = db.documents.find(d => d.id === id);
      if (!doc) throw new Error('Document not found');

      // Create new job
      const jobId = 'j-' + Math.random().toString(36).substr(2, 9);
      const job: ExtractionJob = {
        id: jobId,
        document_id: id,
        status: 'pending',
        progress: 0,
        error_message: null,
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null
      };

      db.jobs.push(job);
      saveMockDB(db);

      // Start mock processor thread
      this.runMockProcessor(jobId, id);

      return job;
    }
    return this.request<ExtractionJob>(`/api/v1/documents/${id}/reprocess`, { method: 'POST' });
  }

  async uploadDocument(file: File): Promise<{ document: Document; job: ExtractionJob }> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      const docId = 'd-' + Math.random().toString(36).substr(2, 9);
      const jobId = 'j-' + Math.random().toString(36).substr(2, 9);

      const document: Document = {
        id: docId,
        user_id: 'u-1',
        filename: file.name,
        mime_type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
        file_size: file.size,
        storage_path: `uploads/${docId}_${file.name}`,
        page_count: null,
        uploaded_at: new Date().toISOString(),
        expires_at: null
      };

      const job: ExtractionJob = {
        id: jobId,
        document_id: docId,
        status: 'pending',
        progress: 0,
        error_message: null,
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null
      };

      db.documents.push(document);
      db.jobs.push(job);
      saveMockDB(db);

      // Start mock background processing
      this.runMockProcessor(jobId, docId, file.name);

      return { document, job };
    }

    // Live mode file upload
    const formData = new FormData();
    formData.append('file', file);

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const response = await fetch(`${baseUrl}/api/v1/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ''}`
        // Do NOT set Content-Type header; fetch sets it automatically with the boundary for FormData
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }

    return response.json() as Promise<{ document: Document; job: ExtractionJob }>;
  }

  // --- JOBS ---
  async getJobStatus(id: string): Promise<ExtractionJob> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      const job = db.jobs.find(j => j.id === id);
      if (!job) throw new Error('Job not found');
      return job;
    }
    return this.request<ExtractionJob>(`/api/v1/jobs/${id}`);
  }

  // --- SEARCH ---
  async search(query: string, page = 1, size = 20): Promise<PaginatedResult<SearchResultItem>> {
    if (this.mode === 'demo') {
      const db = getMockDB();
      const lowerQuery = query.toLowerCase().trim();
      const results: SearchResultItem[] = [];

      if (lowerQuery) {
        // Look through page content in mock DB
        Object.entries(db.pages).forEach(([docId, docPages]) => {
          const doc = db.documents.find(d => d.id === docId);
          if (!doc) return;

          docPages.forEach(p => {
            if (p.text_content.toLowerCase().includes(lowerQuery)) {
              // Find bounding boxes that match words in the query
              const words = lowerQuery.split(/\s+/);
              const matchingBoxes = p.bounding_boxes.filter(box => 
                words.some(word => box.text.toLowerCase().includes(word))
              );

              // Generate snippet
              const text = p.text_content;
              const idx = text.toLowerCase().indexOf(lowerQuery);
              const startIdx = Math.max(0, idx - 40);
              const endIdx = Math.min(text.length, idx + lowerQuery.length + 40);
              let snippet = text.substring(startIdx, endIdx);
              if (startIdx > 0) snippet = '...' + snippet;
              if (endIdx < text.length) snippet = snippet + '...';

              results.push({
                document_id: docId,
                user_id: doc.user_id,
                filename: doc.filename,
                page_number: p.page_number,
                text_content: p.text_content,
                bounding_boxes: matchingBoxes.length > 0 ? matchingBoxes : p.bounding_boxes,
                uploaded_at: doc.uploaded_at,
                snippets: [snippet]
              });
            }
          });
        });
      }

      // Pagination
      const start = (page - 1) * size;
      const end = start + size;
      return {
        items: results.slice(start, end),
        total: results.length,
        page,
        size
      };
    }

    return this.request<PaginatedResult<SearchResultItem>>(`/api/v1/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`);
  }

  // --- PRIVATE MOCK PROCESSOR ---
  private runMockProcessor(jobId: string, docId: string, filename?: string) {
    let currentStep = 0;
    const interval = setInterval(() => {
      const db = getMockDB();
      const jobIdx = db.jobs.findIndex(j => j.id === jobId);
      const docIdx = db.documents.findIndex(d => d.id === docId);

      if (jobIdx === -1) {
        clearInterval(interval);
        return;
      }

      currentStep++;

      if (currentStep === 1) {
        // Switch job status to 'processing'
        db.jobs[jobIdx].status = 'processing';
        db.jobs[jobIdx].progress = 10;
        db.jobs[jobIdx].started_at = new Date().toISOString();
      } else if (currentStep === 2) {
        db.jobs[jobIdx].progress = 40;
      } else if (currentStep === 3) {
        db.jobs[jobIdx].progress = 75;
      } else if (currentStep >= 4) {
        // Complete job!
        clearInterval(interval);
        db.jobs[jobIdx].status = 'completed';
        db.jobs[jobIdx].progress = 100;
        db.jobs[jobIdx].completed_at = new Date().toISOString();

        if (docIdx !== -1) {
          const isPdf = filename?.toLowerCase().endsWith('.pdf') || db.documents[docIdx].mime_type === 'application/pdf';
          const pageCount = isPdf ? 2 : 1;
          db.documents[docIdx].page_count = pageCount;

          // Generate dynamic pages based on the filename
          const mockPages: DocumentPage[] = [];
          for (let pNum = 1; pNum <= pageCount; pNum++) {
            const pageText = isPdf 
              ? `Report Page ${pNum} parsed successfully. This mock document represents: ${filename || 'Uploaded Document'}. It holds custom coordinate information and OCR analysis details for demonstrating high speed text extraction.`
              : `Image OCR text output: ${filename || 'Scan Image'}. Processed invoice/receipt. Found key elements and paragraphs in the snapshot. Verified with 98% confidence.`;

            // Bounding box generation
            const words = pageText.split(' ');
            const boxes: BoundingBox[] = words.map((w, idx) => {
              const cleanedWord = w.replace(/[^\w\s]/gi, '');
              const row = Math.floor(idx / 6);
              const col = idx % 6;
              return {
                x: 60 + col * 85,
                y: 80 + row * 35,
                width: Math.max(40, cleanedWord.length * 8 + 10),
                height: 16,
                text: cleanedWord,
                confidence: Math.round(90 + Math.random() * 9)
              };
            });

            mockPages.push({
              id: `p-${docId}-${pNum}`,
              document_id: docId,
              page_number: pNum,
              text_content: pageText,
              bounding_boxes: boxes,
              extracted_at: new Date().toISOString()
            });
          }
          db.pages[docId] = mockPages;
        }
      }

      saveMockDB(db);
      // Dispatch an event so components can update dynamically if they listen
      window.dispatchEvent(new CustomEvent('mock-job-update', { detail: { jobId, docId } }));
    }, 1200);
  }
}

export const client = new ApiClient();
export default client;
