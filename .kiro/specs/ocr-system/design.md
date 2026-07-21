# Design Document — OCR Platform

## Overview

This document translates the requirements and blueprint into a concrete technical implementation plan. It defines every interface, data structure, service contract, and component interaction that developers must implement.

Stack: Go 1.22 + Gin v1.9 | PostgreSQL 15 | OpenSearch 2.x | Redis 7 | React 18 + TypeScript | PDF.js 3.x | PaddleOCR (Docker service)

---

## 1. Repository / Module Layout

```
ocr-platform/
├── backend/
│   ├── cmd/api/main.go
│   ├── cmd/worker/main.go
│   ├── internal/
│   │   ├── config/         config.go
│   │   ├── domain/         document.go  job.go  page.go  user.go
│   │   ├── api/
│   │   │   ├── handler/    auth.go  document.go  job.go  search.go  health.go
│   │   │   ├── middleware/  auth.go  logger.go  ratelimit.go
│   │   │   └── router.go
│   │   ├── service/        document.go  job.go  search.go  retention.go
│   │   ├── repository/
│   │   │   ├── postgres/   user.go  document.go  job.go  page.go
│   │   │   └── opensearch/ index.go
│   │   ├── worker/         consumer.go  processor.go
│   │   ├── ocr/            paddleocr.go  (HTTP client to PaddleOCR service)
│   │   ├── cache/          redis.go
│   │   └── storage/        local.go  s3.go  interface.go
│   ├── migrations/
│   └── go.mod
├── frontend/
│   └── src/
│       ├── api/            client.ts
│       ├── types/          index.ts
│       ├── components/     ...
│       ├── pages/          ...
│       ├── hooks/          ...
│       └── store/          auth.tsx
└── docker/
    ├── docker-compose.yml
    └── nginx.conf
```


---

## 2. Configuration

All config loaded from environment variables at startup. No config files at runtime.

```go
// internal/config/config.go
type Config struct {
    // Server
    Port            string // HTTP_PORT, default "8080"
    JWTSecret       string // JWT_SECRET (required)
    JWTExpiry       int    // JWT_EXPIRY_HOURS, default 24

    // PostgreSQL
    DatabaseURL     string // DATABASE_URL (required)

    // Redis
    RedisAddr       string // REDIS_ADDR, default "localhost:6379"
    RedisPassword   string // REDIS_PASSWORD

    // OpenSearch
    OpenSearchURL   string // OPENSEARCH_URL, default "http://localhost:9200"

    // Storage
    StorageType     string // STORAGE_TYPE: "local" | "s3"
    StoragePath     string // STORAGE_PATH (local)
    S3Bucket        string // S3_BUCKET
    S3Region        string // S3_REGION

    // Worker
    WorkerConcurrency int   // WORKER_CONCURRENCY, default 4
    OCRServiceURL     string // OCR_SERVICE_URL (PaddleOCR REST endpoint)

    // Retention
    RetentionDays   int    // RETENTION_DAYS, 0 = disabled
}
```


---

## 3. Domain Types

```go
// internal/domain/user.go
type User struct {
    ID        uuid.UUID
    Email     string
    Password  string    // bcrypt hash
    CreatedAt time.Time
}

// internal/domain/document.go
type Document struct {
    ID          uuid.UUID
    UserID      uuid.UUID
    Filename    string
    MimeType    string
    FileSize    int64
    StoragePath string
    PageCount   *int
    UploadedAt  time.Time
    ExpiresAt   *time.Time
}

// internal/domain/job.go
type JobStatus string
const (
    JobPending    JobStatus = "pending"
    JobProcessing JobStatus = "processing"
    JobCompleted  JobStatus = "completed"
    JobFailed     JobStatus = "failed"
)

type ExtractionJob struct {
    ID           uuid.UUID
    DocumentID   uuid.UUID
    Status       JobStatus
    Progress     int
    ErrorMessage *string
    CreatedAt    time.Time
    StartedAt    *time.Time
    CompletedAt  *time.Time
}

// internal/domain/page.go
type BoundingBox struct {
    X          float64 `json:"x"`
    Y          float64 `json:"y"`
    Width      float64 `json:"width"`
    Height     float64 `json:"height"`
    Text       string  `json:"text"`
    Confidence float64 `json:"confidence"`
}

type DocumentPage struct {
    ID           uuid.UUID
    DocumentID   uuid.UUID
    PageNumber   int
    TextContent  string
    BoundingBoxes []BoundingBox
    ExtractedAt  time.Time
}
```


---

## 4. Repository Interfaces

```go
// internal/repository/postgres/user.go
type UserRepository interface {
    Create(ctx context.Context, u *domain.User) error
    GetByEmail(ctx context.Context, email string) (*domain.User, error)
    GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
}

// internal/repository/postgres/document.go
type DocumentRepository interface {
    Create(ctx context.Context, d *domain.Document) error
    GetByID(ctx context.Context, id uuid.UUID) (*domain.Document, error)
    ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.Document, int, error)
    UpdatePageCount(ctx context.Context, id uuid.UUID, count int) error
    Delete(ctx context.Context, id uuid.UUID) error
    ListExpired(ctx context.Context, before time.Time) ([]*domain.Document, error)
}

// internal/repository/postgres/job.go
type JobRepository interface {
    Create(ctx context.Context, j *domain.ExtractionJob) error
    GetByID(ctx context.Context, id uuid.UUID) (*domain.ExtractionJob, error)
    GetLatestByDocument(ctx context.Context, docID uuid.UUID) (*domain.ExtractionJob, error)
    UpdateStatus(ctx context.Context, id uuid.UUID, status domain.JobStatus, progress int, errMsg *string) error
    SetStarted(ctx context.Context, id uuid.UUID) error
    SetCompleted(ctx context.Context, id uuid.UUID, pageCount int) error
    SetFailed(ctx context.Context, id uuid.UUID, errMsg string) error
}

// internal/repository/postgres/page.go
type PageRepository interface {
    Upsert(ctx context.Context, p *domain.DocumentPage) error
    GetByDocument(ctx context.Context, docID uuid.UUID) ([]*domain.DocumentPage, error)
    GetByDocumentAndPage(ctx context.Context, docID uuid.UUID, page int) (*domain.DocumentPage, error)
    DeleteByDocument(ctx context.Context, docID uuid.UUID) error
}

// internal/repository/opensearch/index.go
type SearchRepository interface {
    IndexPage(ctx context.Context, doc *domain.Document, page *domain.DocumentPage) error
    DeleteByDocument(ctx context.Context, docID uuid.UUID) error
    Search(ctx context.Context, userID uuid.UUID, query string, page, size int) (*SearchResult, error)
}

type SearchResult struct {
    Total   int
    Hits    []SearchHit
}
type SearchHit struct {
    DocumentID  uuid.UUID
    Filename    string
    PageNumber  int
    Snippet     string   // highlighted excerpt
    Score       float64
    UploadedAt  time.Time
}
```


---

## 5. Service Layer

```go
// internal/service/document.go
type DocumentService interface {
    Upload(ctx context.Context, userID uuid.UUID, file io.Reader, filename, mimeType string, size int64) (*domain.Document, *domain.ExtractionJob, error)
    GetByID(ctx context.Context, userID, docID uuid.UUID) (*domain.Document, []*domain.DocumentPage, error)
    List(ctx context.Context, userID uuid.UUID, page, size int) ([]*domain.Document, int, error)
    Delete(ctx context.Context, userID, docID uuid.UUID) error
    Reprocess(ctx context.Context, userID, docID uuid.UUID) (*domain.ExtractionJob, error)
}

// internal/service/job.go
type JobService interface {
    GetStatus(ctx context.Context, userID, jobID uuid.UUID) (*domain.ExtractionJob, error)
}

// internal/service/search.go
type SearchService interface {
    Search(ctx context.Context, userID uuid.UUID, query string, page, size int) (*repository.SearchResult, error)
}

// internal/service/retention.go
type RetentionService interface {
    RunOnce(ctx context.Context) (int, error) // returns deleted count
}
```

**Rules:**
- Services validate ownership (userID checks) before calling repositories
- Services handle cache read-through/invalidation via the cache layer
- Services never call `database/sql` directly — only repository interfaces


---

## 6. HTTP Handler Design

### Gin Router Registration (`internal/api/router.go`)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

[AuthMiddleware]
POST   /api/v1/documents
GET    /api/v1/documents
GET    /api/v1/documents/:id
DELETE /api/v1/documents/:id
POST   /api/v1/documents/:id/reprocess
GET    /api/v1/jobs/:id
GET    /api/v1/search

GET    /health    (no auth)
GET    /metrics   (no auth, promhttp.Handler())
```

### Request / Response DTOs

**POST /api/v1/auth/login**
```
Request:  { "email": "string", "password": "string" }
Response: { "token": "string", "expires_at": "RFC3339" }
```

**POST /api/v1/documents** (multipart/form-data)
```
Form field: file (binary)
Response 202: {
  "document_id": "uuid",
  "job_id": "uuid",
  "status": "pending"
}
Error 413: { "error": "file exceeds 50MB limit" }
Error 415: { "error": "unsupported file type: <mime>" }
```

**GET /api/v1/documents** (paginated)
```
Query: ?page=1&size=20
Response 200: {
  "data": [ DocumentSummary ],
  "total": 42,
  "page": 1,
  "size": 20
}
DocumentSummary: { id, filename, mime_type, file_size, uploaded_at, job_status, page_count }
```

**GET /api/v1/documents/:id**
```
Response 200: {
  "document": DocumentSummary,
  "pages": [ { "page_number": 1, "text_content": "...", "bounding_boxes": [...] } ]
}
Error 404: { "error": "document not found" }
Error 403: { "error": "forbidden" }
```

**DELETE /api/v1/documents/:id**
```
Response 200: { "message": "document deleted" }
```

**GET /api/v1/jobs/:id**
```
Response 200: {
  "job_id": "uuid",
  "document_id": "uuid",
  "status": "pending|processing|completed|failed",
  "progress": 0-100,
  "error_message": null | "string",
  "page_count": null | int,
  "completed_at": null | "RFC3339"
}
```

**GET /api/v1/search**
```
Query: ?q=invoice&page=1&size=20
Response 200: {
  "query": "invoice",
  "total": 5,
  "page": 1,
  "size": 20,
  "results": [
    {
      "document_id": "uuid",
      "filename": "report.pdf",
      "page_number": 3,
      "snippet": "...total <em>invoice</em> amount...",
      "score": 1.85,
      "uploaded_at": "RFC3339"
    }
  ]
}
Error 400: { "error": "query is required" }
Error 503: { "error": "search service unavailable" }
```

**GET /health**
```
Response 200: {
  "status": "ok",
  "dependencies": {
    "postgres": "ok",
    "opensearch": "ok",
    "redis": "ok"
  }
}
Response 503 (any dep down): {
  "status": "degraded",
  "dependencies": { "postgres": "ok", "opensearch": "degraded", "redis": "ok" }
}
```


---

## 7. Middleware Design

### Auth Middleware (`internal/api/middleware/auth.go`)
```
1. Read Authorization header
2. Strip "Bearer " prefix
3. Parse + validate JWT (exp, signature, algorithm)
4. Extract claims: { sub: userID, email }
5. Set userID in Gin context: c.Set("userID", uuid)
6. On failure: abort with 401 JSON response
```

JWT claims structure:
```json
{ "sub": "user-uuid", "email": "user@example.com", "exp": 1234567890, "iat": 1234567890 }
```

### Logger Middleware (`internal/api/middleware/logger.go`)
```
Uses zerolog. Logs on response:
{ "method": "GET", "path": "/api/v1/documents", "status": 200, "duration_ms": 12, "request_id": "uuid" }
```

### Rate Limit Middleware
- 100 requests/minute per IP using token bucket (golang.org/x/time/rate)
- Returns 429 with `Retry-After` header on breach

---

## 8. Cache Layer Design (`internal/cache/redis.go`)

```go
type Cache interface {
    Get(ctx context.Context, key string, dest interface{}) (bool, error)  // false = miss
    Set(ctx context.Context, key string, val interface{}, ttl time.Duration) error
    Delete(ctx context.Context, key string) error
    Enqueue(ctx context.Context, queue string, payload interface{}) error
    Dequeue(ctx context.Context, queue string) (string, error) // blocking
}
```

Key builders (canonical — must match blueprint Section 11):
```go
func DocMetaKey(id uuid.UUID) string        { return "doc:meta:" + id.String() }
func JobStatusKey(id uuid.UUID) string      { return "job:status:" + id.String() }
func SearchKey(q string, page, size int) string {
    h := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%d", q, page, size)))
    return "search:" + hex.EncodeToString(h[:])
}
const OCRQueue = "ocr:queue"
```


---

## 9. File Storage Design (`internal/storage/`)

```go
type Storage interface {
    Save(ctx context.Context, key string, r io.Reader) error
    Open(ctx context.Context, key string) (io.ReadCloser, error)
    Delete(ctx context.Context, key string) error
}
```

Storage key format: `documents/{userID}/{documentID}/{filename}`

Two implementations:
- `LocalStorage` — writes to `STORAGE_PATH` directory on disk
- `S3Storage` — uses AWS SDK v2, bucket from `S3_BUCKET` env var

Selected at startup based on `STORAGE_TYPE` env var.

---

## 10. OCR Service Client (`internal/ocr/paddleocr.go`)

PaddleOCR runs as a separate Docker container exposing a REST API.

```go
type OCRClient interface {
    ExtractText(ctx context.Context, imageData []byte) ([]BoundingBox, error)
}

// HTTP call to OCR_SERVICE_URL
// POST /ocr  body: { "image": "<base64>" }
// Response:  { "results": [ { "text": "...", "confidence": 0.98, "box": [x,y,w,h] } ] }
```

PaddleOCR Docker service: `registry.baidubce.com/paddlepaddle/paddle` or community image.
The Go worker calls this service per page image. Timeout: 30s per page.

---

## 11. Worker Design (`internal/worker/`)

### consumer.go
```go
func StartWorker(cfg *config.Config, deps WorkerDeps) {
    for i := 0; i < cfg.WorkerConcurrency; i++ {
        go runLoop(deps)
    }
}

func runLoop(deps WorkerDeps) {
    for {
        jobID := deps.Cache.Dequeue(ctx, cache.OCRQueue) // BRPOP blocks
        process(deps, jobID)
    }
}
```

### processor.go — step-by-step
```
1. Parse job_id from queue payload
2. deps.JobRepo.SetStarted(ctx, jobID)
3. job = deps.JobRepo.GetByID(ctx, jobID)
4. doc = deps.DocRepo.GetByID(ctx, job.DocumentID)
5. file = deps.Storage.Open(ctx, doc.StoragePath)
6. pages = renderPages(file, doc.MimeType)  // pdfcpu for PDF, pass-through for images
7. for each page:
   a. boxes = deps.OCR.ExtractText(ctx, pageImageBytes)
   b. textContent = join(box.Text for box in boxes)
   c. deps.PageRepo.Upsert(ctx, &domain.DocumentPage{...})
   d. deps.SearchRepo.IndexPage(ctx, doc, page)
   e. deps.JobRepo.UpdateStatus(ctx, jobID, processing, progress%)
8. deps.DocRepo.UpdatePageCount(ctx, doc.ID, len(pages))
9. deps.JobRepo.SetCompleted(ctx, jobID, len(pages))
10. On error at any step:
    deps.JobRepo.SetFailed(ctx, jobID, err.Error())
    log structured error
```

### PDF Page Rendering
- Use `pdfcpu` Go library to extract each page as a PNG image at 150 DPI
- For image documents: pass the raw bytes directly to OCR client
- Each rendered page image is held in memory (not written to disk)


---

## 12. Database Migrations

Migration files in `backend/migrations/` using `golang-migrate` naming: `{version}_{name}.up.sql` / `{version}_{name}.down.sql`

```
001_create_users.up.sql
002_create_documents.up.sql
003_create_extraction_jobs.up.sql
004_create_document_pages.up.sql
005_create_indexes.up.sql
```

Full DDL matches blueprint Section 9 exactly. No deviations permitted without a new migration.

---

## 13. OpenSearch Index Setup

Index name: `ocr_documents` (from blueprint Section 10).

Created at API server startup if not exists:
```go
// internal/repository/opensearch/index.go
func EnsureIndex(ctx context.Context, client *opensearch.Client) error { ... }
```

Search query design (OpenSearch DSL):
```json
{
  "query": {
    "bool": {
      "must": { "match": { "text_content": "<query>" } },
      "filter": { "term": { "user_id": "<userID>" } }
    }
  },
  "highlight": {
    "fields": { "text_content": { "fragment_size": 150, "number_of_fragments": 1 } },
    "pre_tags": ["<em>"], "post_tags": ["</em>"]
  },
  "from": <offset>, "size": <size>
}
```

---

## 14. Authentication Design

**Algorithm:** HS256 (configurable to RS256 via `JWT_ALGORITHM` env)
**Library:** `github.com/golang-jwt/jwt/v5`
**Token expiry:** configurable via `JWT_EXPIRY_HOURS` (default 24h)
**Refresh:** new token issued on `POST /api/v1/auth/refresh` with valid non-expired token

Password hashing: `golang.org/x/crypto/bcrypt` cost factor 12.

Login flow:
```
1. Validate email + password fields (non-empty)
2. UserRepo.GetByEmail(email)
3. bcrypt.CompareHashAndPassword(user.Password, inputPassword)
4. On match: sign JWT with { sub, email, exp, iat }
5. Return token + expires_at
```

---

## 15. Retention Service Design

Runs as a background goroutine in the API server process, triggered by a ticker.

```go
// Runs every 1 hour
func (s *RetentionService) RunOnce(ctx context.Context) (int, error) {
    expired, _ := docRepo.ListExpired(ctx, time.Now())
    for _, doc := range expired {
        documentService.Delete(ctx, doc.UserID, doc.ID) // reuses deletion logic
    }
    return len(expired), nil
}
```

`RETENTION_DAYS=0` disables the retention ticker entirely.


---

## 16. Frontend Design

### TypeScript Types (`src/types/index.ts`)

```typescript
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentSummary {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  job_status: JobStatus;
  page_count: number | null;
}

export interface BoundingBox {
  x: number; y: number; width: number; height: number;
  text: string; confidence: number;
}

export interface DocumentPage {
  page_number: number;
  text_content: string;
  bounding_boxes: BoundingBox[];
}

export interface DocumentDetail {
  document: DocumentSummary;
  pages: DocumentPage[];
}

export interface JobStatusResponse {
  job_id: string;
  document_id: string;
  status: JobStatus;
  progress: number;
  error_message: string | null;
  page_count: number | null;
  completed_at: string | null;
}

export interface SearchResult {
  document_id: string;
  filename: string;
  page_number: number;
  snippet: string;    // contains <em> tags
  score: number;
  uploaded_at: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  page: number;
  size: number;
  results: SearchResult[];
}
```

### API Client (`src/api/client.ts`)

```typescript
// Typed wrapper around fetch. Attaches Bearer token from AuthContext.
// All functions throw ApiError on non-2xx responses.
export const api = {
  auth: { login, refresh },
  documents: { upload, list, get, delete: del, reprocess },
  jobs: { getStatus },
  search: { query },
}
```

### Key Components

**PDFRenderer** (`src/components/DocumentViewer/PDFRenderer.tsx`)
- Loads PDF.js worker
- Renders one page at a time via `pdfPage.render({ canvasContext, viewport })`
- Exposes `onPageRendered(canvas: HTMLCanvasElement, viewport: PageViewport)` callback
- Manages page navigation state

**BoundingBoxOverlay** (`src/components/DocumentViewer/BoundingBoxOverlay.tsx`)
- Receives `boxes: BoundingBox[]`, `viewport: PageViewport`, `highlightIDs?: string[]`
- Draws on a transparent Canvas layer positioned absolutely over PDFRenderer canvas
- Scale factor: `viewport.scale` to map stored coords → rendered pixel coords
- Normal boxes: `rgba(255, 255, 0, 0.25)` | Match boxes: `rgba(255, 140, 0, 0.5)`
- On mousemove: hit-test boxes, show TextTooltip at cursor position

**JobStatusPoller** (`src/hooks/useJobStatus.ts`)
- React custom hook
- Polls `GET /api/v1/jobs/:id` every 3000ms using `setInterval`
- Stops automatically when status is `completed` or `failed`
- Returns `{ status, progress, error }`


---

## 17. Docker Compose (Local Dev)

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment: { POSTGRES_DB: ocrdb, POSTGRES_USER: ocr, POSTGRES_PASSWORD: secret }
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  opensearch:
    image: opensearchproject/opensearch:2.11.0
    environment: { discovery.type: single-node, DISABLE_SECURITY_PLUGIN: "true" }
    ports: ["9200:9200"]

  paddleocr:
    image: paddlepaddle/paddle:latest-cpu  # or community OCR image
    ports: ["8866:8866"]
    command: ["paddleocr", "--use_angle_cls=true", "--lang=en", "--serve"]

  api:
    build: { context: ../backend, dockerfile: Dockerfile }
    command: ["/app/api"]
    environment:
      DATABASE_URL: postgres://ocr:secret@postgres:5432/ocrdb?sslmode=disable
      REDIS_ADDR: redis:6379
      OPENSEARCH_URL: http://opensearch:9200
      JWT_SECRET: dev-secret-change-in-prod
      STORAGE_TYPE: local
      STORAGE_PATH: /data/uploads
      OCR_SERVICE_URL: http://paddleocr:8866
    ports: ["8080:8080"]
    depends_on: [postgres, redis, opensearch, paddleocr]

  worker:
    build: { context: ../backend, dockerfile: Dockerfile }
    command: ["/app/worker"]
    environment:
      DATABASE_URL: postgres://ocr:secret@postgres:5432/ocrdb?sslmode=disable
      REDIS_ADDR: redis:6379
      OPENSEARCH_URL: http://opensearch:9200
      STORAGE_TYPE: local
      STORAGE_PATH: /data/uploads
      OCR_SERVICE_URL: http://paddleocr:8866
      WORKER_CONCURRENCY: "4"
    depends_on: [postgres, redis, opensearch, paddleocr, api]

  frontend:
    build: { context: ../frontend, dockerfile: Dockerfile }
    ports: ["3000:80"]
    depends_on: [api]

  nginx:
    image: nginx:alpine
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro"]
    ports: ["80:80"]
    depends_on: [api, frontend]
```

---

## 18. Requirement → Component Traceability

| Requirement | Backend Component | Frontend Component |
|---|---|---|
| Req 1: Upload | `handler/document.go` Upload + `service/document.go` Upload | `UploadPage`, `UploadForm` |
| Req 2: OCR Extraction | `worker/processor.go`, `ocr/paddleocr.go` | `JobStatusPoller` hook |
| Req 3: Search Indexing | `worker/processor.go` IndexPage, `repository/opensearch` | — |
| Req 4: Full-Text Search | `handler/search.go`, `service/search.go`, `repository/opensearch` | `SearchPage`, `SearchBar`, `SearchResults` |
| Req 5: Doc Management | `handler/document.go` List/Get/Delete | `DocumentListPage`, `DocumentDetailPage` |
| Req 6: Doc Viewer | `handler/document.go` GetByID (pages + boxes) | `DocumentViewer`, `PDFRenderer`, `BoundingBoxOverlay` |
| Req 7: Job Status | `handler/job.go`, `service/job.go` | `useJobStatus` hook, `JobStatus` component |
| Req 8: Auth | `middleware/auth.go`, `handler/auth.go` | `AuthProvider`, login flow |
| Req 9: Health/Metrics | `handler/health.go`, `promhttp` | — |
| Req 10: Retention | `service/retention.go` background ticker | — |


---

## 19. Error Handling Strategy

All HTTP error responses use a consistent envelope:
```json
{ "error": "human-readable message" }
```

Backend errors follow this pattern:
- Validation errors → 400
- Unauthenticated → 401
- Forbidden (wrong user) → 403
- Not found → 404
- File too large → 413
- Unsupported MIME → 415
- Service unavailable (OpenSearch down) → 503
- Unexpected internal error → 500 + structured log (never leak stack traces to client)

Worker errors are caught per-page: if one page fails, the job continues. If > 50% of pages fail, the entire job is marked `failed`.

---

## 20. Testing Strategy

| Layer | Type | Tool |
|---|---|---|
| Repository | Integration (real DB/Redis/OS) | `testcontainers-go` |
| Service | Unit (mocked repos) | `testify/mock` |
| Handler | HTTP integration | `net/http/httptest` + `testify` |
| Worker | Integration | `testcontainers-go` + mock OCR client |
| Frontend components | Unit | Vitest + React Testing Library |
| E2E (5 core flows) | End-to-end | Playwright |

Test coverage target: 80% line coverage on `internal/` packages.
All 5 core flows from BLUEPRINT.md Section 2 must have E2E tests before any release.

See `docs/Testing.md` for full test plan.
