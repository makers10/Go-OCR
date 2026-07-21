# Implementation Plan: OCR Platform

## Overview

Implement the full-stack OCR platform in Go 1.22 + Gin, PostgreSQL 15, OpenSearch 2.x,
Redis 7, and React 18 + TypeScript. Tasks follow the layered architecture defined in the
design document: infrastructure → domain → data layer → service layer → HTTP layer →
worker → frontend → integration. Each task builds on the previous, with no orphaned code.

Tech stack: Go 1.22 + Gin | PostgreSQL 15 | OpenSearch 2.x | Redis 7 | React 18 +
TypeScript | PDF.js 3.x | PaddleOCR (Docker service)

Module path: `github.com/ocr-platform/backend`

---

## Tasks

- [ ] 1. Project scaffolding and Docker Compose infrastructure
  - [ ] 1.1 Create Docker Compose full-stack configuration
    - Write `docker/docker-compose.yml` with services: postgres:15-alpine, redis:7-alpine,
      opensearch:2.11.0, paddleocr, api, worker, frontend, nginx
    - Wire all environment variables per design §17 and blueprint §11 key schema
    - Add named volumes for postgres data and shared file storage (`/data/uploads`)
    - Write `docker/nginx.conf` as reverse proxy routing `/api` → api:8080, `/` → frontend:3000
    - _Requirements: 1.7, 9.1, 10.3_
  - [ ] 1.2 Create backend Dockerfile (multi-stage)
    - Stage 1 (`builder`): `golang:1.22-alpine`, copy `go.mod`/`go.sum`, `go mod download`,
      copy source, `go build -o /app/api ./cmd/api` and `go build -o /app/worker ./cmd/worker`
    - Stage 2 (`runtime`): `alpine:3.19`, copy both binaries, expose 8080
    - _Requirements: 9.1_
  - [ ] 1.3 Create frontend Dockerfile (multi-stage)
    - Stage 1: `node:20-alpine`, `npm ci`, `npm run build`
    - Stage 2: `nginx:alpine`, copy `dist/` to `/usr/share/nginx/html`
    - _Requirements: 6.1_
  - [ ] 1.4 Create database migration files
    - `migrations/001_create_users.up.sql` / `.down.sql` — users table per blueprint §9
    - `migrations/002_create_documents.up.sql` / `.down.sql` — documents table with MIME CHECK constraint
    - `migrations/003_create_extraction_jobs.up.sql` / `.down.sql` — extraction_jobs with status CHECK
    - `migrations/004_create_document_pages.up.sql` / `.down.sql` — document_pages with JSONB bounding_boxes
    - `migrations/005_create_indexes.up.sql` / `.down.sql` — all indexes per blueprint §9
    - _Requirements: 1.5, 2.3, 2.8, 5.1, 7.1_


- [ ] 2. Configuration and domain types
  - [ ] 2.1 Implement `internal/config/config.go`
    - Define `Config` struct with all fields per design §2: Port, JWTSecret, JWTExpiry,
      DatabaseURL, RedisAddr, RedisPassword, OpenSearchURL, StorageType, StoragePath,
      S3Bucket, S3Region, WorkerConcurrency, OCRServiceURL, RetentionDays
    - Implement `Load() (*Config, error)` reading from environment variables with defaults
    - Return error if required vars (JWT_SECRET, DATABASE_URL) are missing
    - _Requirements: 8.5, 10.1_
  - [ ] 2.2 Implement domain types in `internal/domain/`
    - `user.go`: `User` struct (ID uuid, Email, Password, CreatedAt)
    - `document.go`: `Document` struct (ID, UserID, Filename, MimeType, FileSize,
      StoragePath, PageCount *int, UploadedAt, ExpiresAt *time.Time)
    - `job.go`: `JobStatus` type + constants (pending/processing/completed/failed),
      `ExtractionJob` struct (ID, DocumentID, Status, Progress, ErrorMessage *string,
      CreatedAt, StartedAt *time.Time, CompletedAt *time.Time)
    - `page.go`: `BoundingBox` struct (X, Y, Width, Height float64; Text string;
      Confidence float64) with json tags; `DocumentPage` struct
    - _Requirements: 1.5, 2.3, 2.8, 5.2, 6.2_


- [ ] 3. Repository layer — PostgreSQL
  - [ ] 3.1 Implement `internal/repository/postgres/user.go`
    - Define `UserRepository` interface: `Create`, `GetByEmail`, `GetByID`
    - Implement `pgUserRepository` backed by `pgx/v5` pool
    - `Create`: INSERT with uuid generation; return `pgconn.PgError` code 23505 as domain error
    - `GetByEmail` / `GetByID`: SELECT with `pgx.ErrNoRows` → typed not-found error
    - _Requirements: 8.1, 8.5_
  - [ ] 3.2 Implement `internal/repository/postgres/document.go`
    - Define `DocumentRepository` interface per design §4
    - Implement: `Create`, `GetByID`, `ListByUser` (with LIMIT/OFFSET + COUNT),
      `UpdatePageCount`, `Delete`, `ListExpired`
    - `ListExpired`: `WHERE expires_at IS NOT NULL AND expires_at <= $1`
    - _Requirements: 1.5, 1.6, 5.1, 5.2, 5.3, 5.4, 10.1, 10.2_
  - [ ] 3.3 Implement `internal/repository/postgres/job.go`
    - Define `JobRepository` interface per design §4
    - Implement: `Create`, `GetByID`, `GetLatestByDocument`, `UpdateStatus`,
      `SetStarted`, `SetCompleted` (also sets progress=100, completed_at=now()),
      `SetFailed` (sets error_message)
    - _Requirements: 1.6, 2.1, 2.2, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3_
  - [ ] 3.4 Implement `internal/repository/postgres/page.go`
    - Define `PageRepository` interface per design §4
    - Implement: `Upsert` (INSERT … ON CONFLICT (document_id, page_number) DO UPDATE),
      `GetByDocument`, `GetByDocumentAndPage`, `DeleteByDocument`
    - Marshal/unmarshal `BoundingBoxes` as JSONB
    - _Requirements: 2.3, 2.8, 3.1, 3.2, 5.2, 6.2_
  - [ ]* 3.5 Write integration tests for PostgreSQL repositories
    - Use `testcontainers-go` to spin up postgres:15-alpine
    - Run all migration files before tests
    - Cover: user CRUD, document CRUD + pagination, job state transitions, page upsert idempotency
    - _Requirements: 1.5, 2.1, 5.1, 7.1_


- [ ] 4. Repository layer — OpenSearch
  - [ ] 4.1 Implement `internal/repository/opensearch/index.go`
    - Define `SearchRepository` interface: `IndexPage`, `DeleteByDocument`, `Search`
    - Define `SearchResult` and `SearchHit` structs per design §4
    - Implement `EnsureIndex`: create `ocr_documents` index with mapping from blueprint §10
      if it does not already exist (check with `indices.exists`)
    - Implement `IndexPage`: PUT document with fields: document_id, user_id, filename,
      page_number, text_content, bounding_boxes (disabled object), uploaded_at
    - Implement `DeleteByDocument`: `deleteByQuery` filtering on `document_id` keyword
    - Implement `Search`: bool query with `match` on text_content + `term` filter on user_id,
      highlight fragment_size=150, map `<em>` tags in snippet per design §13
    - Return wrapped 503 error when OpenSearch is unreachable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.6_
  - [ ]* 4.2 Write integration tests for OpenSearch repository
    - Use `testcontainers-go` with opensearchproject/opensearch:2.11.0
    - Cover: index creation, page indexing, search with highlight, delete by document
    - Verify user_id filter isolates results between users
    - _Requirements: 3.1, 4.1, 4.4_


- [ ] 5. Cache layer and file storage abstractions
  - [ ] 5.1 Implement `internal/cache/redis.go`
    - Define `Cache` interface: `Get`, `Set`, `Delete`, `Enqueue`, `Dequeue`
    - Implement `redisCache` using `go-redis/v9`
    - `Get`: `client.Get` + `json.Unmarshal` into `dest`; return `(false, nil)` on `redis.Nil`
    - `Set`: `json.Marshal` + `client.Set` with TTL
    - `Enqueue`: `client.LPush` with JSON-marshalled payload
    - `Dequeue`: `client.BRPop` blocking; returns raw string payload
    - Implement key-builder functions: `DocMetaKey`, `JobStatusKey`, `SearchKey` (sha256)
      and const `OCRQueue = "ocr:queue"` per design §8
    - _Requirements: 4.7, 5.5, 7.6_
  - [ ] 5.2 Implement `internal/storage/interface.go`, `local.go`, and `s3.go`
    - Define `Storage` interface: `Save(ctx, key, r io.Reader)`, `Open(ctx, key)`, `Delete(ctx, key)`
    - Key format: `documents/{userID}/{documentID}/{filename}`
    - `LocalStorage`: `Save` uses `os.MkdirAll` + `io.Copy`; `Open` uses `os.Open`;
      `Delete` uses `os.Remove`
    - `S3Storage`: uses AWS SDK v2 (`PutObject`, `GetObject`, `DeleteObject`)
    - Factory function `NewStorage(cfg *config.Config) Storage` selects impl from `STORAGE_TYPE`
    - _Requirements: 1.3, 10.3, 10.4_


- [ ] 6. PaddleOCR client
  - [ ] 6.1 Implement `internal/ocr/paddleocr.go`
    - Define `OCRClient` interface: `ExtractText(ctx, imageData []byte) ([]domain.BoundingBox, error)`
    - Implement `paddleOCRClient` with `http.Client` (timeout 30s per design §10)
    - `ExtractText`: base64-encode `imageData`, POST JSON `{"image": "<base64>"}` to
      `OCR_SERVICE_URL/ocr`, parse response `results[].{text, confidence, box:[x,y,w,h]}`
      into `[]domain.BoundingBox`
    - Return wrapped error with original message on non-200 or network failure
    - _Requirements: 2.3, 2.4, 2.8_
  - [ ]* 6.2 Write unit tests for PaddleOCR client
    - Use `net/http/httptest` mock server returning fixture JSON responses
    - Cover: successful extraction, non-200 response, malformed JSON, context cancellation
    - _Requirements: 2.3, 2.5_


- [ ] 7. Service layer
  - [ ] 7.1 Implement `internal/service/document.go`
    - Define `DocumentService` interface: `Upload`, `GetByID`, `List`, `Delete`, `Reprocess`
    - `Upload`:
      - Validate MIME type ∈ {application/pdf, image/png, image/jpeg, image/tiff, image/bmp}
        → return 415-class error on mismatch
      - Validate size ≤ 52_428_800 bytes → return 413-class error on breach
      - `storage.Save` with key `documents/{userID}/{docID}/{filename}`
      - `docRepo.Create` to persist metadata with `ExpiresAt` set from `RetentionDays`
      - `jobRepo.Create` with status `pending`
      - `cache.Enqueue(OCRQueue, jobID.String())`
      - Return created `*Document` + `*ExtractionJob`
    - `GetByID`: ownership check (userID == doc.UserID) → 403; cache read-through on
      `doc:meta:{id}` (TTL 300s); call `pageRepo.GetByDocument`
    - `List`: `docRepo.ListByUser` with pagination; return docs + total
    - `Delete`: ownership check → storage.Delete → docRepo.Delete (cascades to jobs+pages
      via FK) → searchRepo.DeleteByDocument → cache.Delete(`doc:meta:{id}`)
    - `Reprocess`: ownership check → jobRepo.Create(pending) → cache.Enqueue
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.7, 3.3, 5.1, 5.2, 5.3, 5.4, 5.5, 8.3, 8.4_
  - [ ] 7.2 Implement `internal/service/job.go`
    - Define `JobService` interface: `GetStatus`
    - `GetStatus`: ownership check via `docRepo.GetByID(job.DocumentID)` → 403 if mismatch;
      cache read-through on `job:status:{id}` (TTL 5s)
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 8.3_
  - [ ] 7.3 Implement `internal/service/search.go`
    - Define `SearchService` interface: `Search`
    - Validate query is non-empty and ≤ 1000 chars → return 400-class error
    - Cache read-through on `search:{sha256(q:page:size)}` (TTL 60s)
    - On cache miss: `searchRepo.Search(ctx, userID, query, page, size)`
    - Propagate 503-class error from repository unchanged
    - Write result to cache before returning
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 3.5_
  - [ ] 7.4 Implement `internal/service/retention.go`
    - Define `RetentionService` interface: `RunOnce(ctx) (int, error)`
    - `RunOnce`: `docRepo.ListExpired(ctx, time.Now())` → for each: call `documentService.Delete`
    - Background ticker goroutine in API server (every 1 hour) calls `RunOnce`
    - Skip ticker entirely when `RetentionDays == 0`
    - _Requirements: 10.1, 10.2_
  - [ ]* 7.5 Write unit tests for service layer
    - Mock all repository and cache interfaces with `testify/mock`
    - `DocumentService`: test MIME validation, size validation, ownership enforcement,
      cache invalidation on delete, reprocess creates new job
    - `JobService`: test cache read-through, ownership check
    - `SearchService`: test empty query rejection, cache hit/miss paths, 503 propagation
    - `RetentionService`: test expired docs are deleted, zero RETENTION_DAYS skips ticker
    - _Requirements: 1.2, 1.3, 4.5, 5.3, 5.4, 7.6, 8.3, 10.1_


- [ ] 8. Authentication service and middleware
  - [ ] 8.1 Implement auth handler `internal/api/handler/auth.go`
    - `POST /api/v1/auth/login`: bind `{email, password}` JSON → `userRepo.GetByEmail` →
      `bcrypt.CompareHashAndPassword` (cost 12) → sign HS256 JWT with claims
      `{sub, email, exp, iat}` → return `{token, expires_at}`
    - `POST /api/v1/auth/refresh`: validate existing token (not expired) → issue new token
    - Return 400 on missing fields, 401 on invalid credentials
    - _Requirements: 8.1, 8.2, 8.5_
  - [ ] 8.2 Implement `internal/api/middleware/auth.go`
    - Parse `Authorization: Bearer <token>` header → `jwt.ParseWithClaims`
    - Validate signature (HS256), expiry, and required claims (`sub`)
    - `c.Set("userID", uuid)` on success; `c.AbortWithStatusJSON(401, ...)` on failure
    - _Requirements: 8.1, 8.2_
  - [ ] 8.3 Implement `internal/api/middleware/logger.go`
    - zerolog middleware: capture method, path, status, duration_ms, request_id (uuid)
    - Log JSON on response write per design §7
    - _Requirements: 9.3_
  - [ ] 8.4 Implement `internal/api/middleware/ratelimit.go`
    - Per-IP token bucket (100 req/min) using `golang.org/x/time/rate`
    - Return 429 with `Retry-After` header on breach
    - _Requirements: 1.7_
  - [ ]* 8.5 Write unit tests for auth middleware and handler
    - Test valid JWT → userID extracted; expired JWT → 401; missing header → 401;
      tampered signature → 401
    - Test login: correct credentials → 200 + token; wrong password → 401; unknown email → 401
    - _Requirements: 8.1, 8.2, 8.5_


- [ ] 9. HTTP handlers and router
  - [ ] 9.1 Implement `internal/api/handler/document.go`
    - `Upload` handler: parse multipart form (32 MB memory limit), read file header MIME,
      call `documentService.Upload`, return 202 `{document_id, job_id, status}`
    - `List` handler: parse `?page=&size=` query params (default page=1, size=20, max=100),
      call `documentService.List`, return paginated envelope
    - `GetByID` handler: call `documentService.GetByID`, return `{document, pages}` per design §6
    - `Delete` handler: call `documentService.Delete`, return 200 `{message}`
    - `Reprocess` handler: call `documentService.Reprocess`, return 202 `{job_id, status}`
    - Wire 413/415/403/404 error types from service layer to correct HTTP status codes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.7, 5.1, 5.2, 5.3, 5.4, 6.2_
  - [ ] 9.2 Implement `internal/api/handler/job.go`
    - `GetStatus` handler: parse `:id`, call `jobService.GetStatus`,
      return `{job_id, document_id, status, progress, error_message, page_count, completed_at}`
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 9.3 Implement `internal/api/handler/search.go`
    - `Search` handler: parse `?q=&page=&size=` → validate non-empty q → `searchService.Search`
    - Return `{query, total, page, size, results}` per design §6
    - Return 400 on empty/whitespace query; 503 on search service unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ] 9.4 Implement `internal/api/handler/health.go`
    - Ping postgres, opensearch, redis in parallel with 2s timeout each
    - Return 200 `{status: "ok", dependencies: {...}}` if all healthy
    - Return 503 `{status: "degraded", dependencies: {...}}` if any fail
    - Expose `GET /metrics` via `promhttp.Handler()` (request count, error rate, queue depth)
    - _Requirements: 9.1, 9.2, 9.4_
  - [ ] 9.5 Implement `internal/api/router.go` and `cmd/api/main.go`
    - Register all routes per design §6: public (`/health`, `/metrics`, auth endpoints)
      and auth-protected group
    - Apply middleware chain: Logger → RateLimit → Auth (on protected group)
    - `main.go`: load config, initialize all dependencies (pgx pool, redis, opensearch client,
      storage, cache, repositories, services), call `EnsureIndex`, start retention ticker,
      start Gin server on `cfg.Port`
    - _Requirements: 1.7, 8.1, 9.1, 9.3, 9.4_
  - [ ]* 9.6 Write HTTP integration tests for all handlers
    - Use `net/http/httptest` + real service mocks (`testify/mock`)
    - Cover: upload 202 + 413 + 415; list pagination; get 200/403/404; delete 200/403;
      search 200/400/503; job status; health 200/503; 401 on missing token
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 4.5, 5.3, 8.1, 8.2, 9.1, 9.2_


- [ ] 10. Checkpoint — backend core complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `docker compose up postgres redis opensearch` + `go test ./...` exits 0

- [ ] 11. OCR Worker
  - [ ] 11.1 Implement `internal/worker/consumer.go`
    - `StartWorker(cfg, deps WorkerDeps)`: launch `cfg.WorkerConcurrency` goroutines
    - Each goroutine: infinite loop calling `cache.Dequeue(ctx, cache.OCRQueue)` (BRPOP)
    - On received `jobID`: call `processor.Process(ctx, deps, jobID)`
    - Handle graceful shutdown via context cancellation
    - `WorkerDeps`: holds JobRepo, DocRepo, PageRepo, SearchRepo, Storage, OCRClient, Cache
    - _Requirements: 2.1_
  - [ ] 11.2 Implement `internal/worker/processor.go`
    - `Process(ctx, deps, jobIDStr)`:
      1. `jobRepo.SetStarted(ctx, jobID)`
      2. Fetch job → fetch document
      3. `storage.Open(doc.StoragePath)` → read all bytes
      4. `renderPages(fileBytes, mimeType)` → `[][]byte` (one PNG per page)
         - PDF: use `pdfcpu` API to render each page at 150 DPI to in-memory PNG
         - Image: single-element slice with raw bytes
      5. For each page `i`: `ocrClient.ExtractText(ctx, pageBytes)` →
         `pageRepo.Upsert(page)` → `searchRepo.IndexPage(doc, page)` →
         `jobRepo.UpdateStatus(processing, progress=(i+1)*100/total, nil)`
      6. `docRepo.UpdatePageCount(doc.ID, len(pages))`
      7. `jobRepo.SetCompleted(jobID, len(pages))`
      8. On unrecoverable error: `jobRepo.SetFailed(jobID, err.Error())` + structured log
         (if >50% pages failed, mark whole job failed per design §19)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2_
  - [ ] 11.3 Implement `cmd/worker/main.go`
    - Load config, initialize deps (pgx, redis, opensearch, storage, ocrClient)
    - Call `worker.StartWorker(cfg, deps)`
    - Block on OS signal (SIGINT/SIGTERM) for graceful shutdown
    - _Requirements: 2.1_
  - [ ]* 11.4 Write integration tests for worker processor
    - Use `testcontainers-go` for postgres + redis + opensearch
    - Mock `OCRClient` returning fixture bounding boxes
    - Verify: job transitions pending→processing→completed, page rows inserted,
      OpenSearch indexed, page_count updated
    - Verify: OCR error on all pages → job transitions to failed with error_message
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 3.1, 3.2_


- [ ] 12. Frontend — TypeScript types and API client
  - [ ] 12.1 Implement `src/types/index.ts`
    - Define all TypeScript interfaces matching backend DTOs per design §16:
      `JobStatus`, `DocumentSummary`, `BoundingBox`, `DocumentPage`, `DocumentDetail`,
      `JobStatusResponse`, `SearchResult`, `SearchResponse`
    - Define `ApiError` class with `status: number` and `message: string`
    - _Requirements: 1.6, 4.3, 5.1, 5.2, 6.2, 7.1_
  - [ ] 12.2 Implement `src/api/client.ts`
    - Typed fetch wrapper reading JWT from `AuthContext`
    - Implement: `auth.login(email, password)`, `auth.refresh()`
    - `documents.upload(file: File)` — multipart form POST, returns `{document_id, job_id}`
    - `documents.list(page, size)`, `documents.get(id)`, `documents.delete(id)`,
      `documents.reprocess(id)`
    - `jobs.getStatus(id)` returning `JobStatusResponse`
    - `search.query(q, page, size)` returning `SearchResponse`
    - Throw `ApiError` on non-2xx; attach `Authorization: Bearer <token>` header to all requests
    - _Requirements: 1.1, 4.1, 5.1, 5.4, 7.1, 8.1_


- [ ] 13. Frontend — Auth, state management, and routing
  - [ ] 13.1 Implement `src/store/auth.tsx` — `AuthProvider` and `useAuth` hook
    - Store JWT in `localStorage`; expose `{ user, token, login, logout, refresh }`
    - `login`: call `api.auth.login`, store token, decode claims for user info
    - `logout`: clear token, redirect to `/login`
    - Auto-refresh token 5 minutes before expiry via `setTimeout`
    - _Requirements: 8.1, 8.2_
  - [ ] 13.2 Implement `src/App.tsx` router and `ProtectedRoute` component
    - Use React Router v6: `/login`, `/documents`, `/documents/:id`, `/upload`, `/search`
    - `ProtectedRoute`: redirect to `/login` if no valid token in `AuthContext`
    - Lazy-load page components for code splitting
    - _Requirements: 8.1_
  - [ ] 13.3 Implement `src/pages/LoginPage.tsx`
    - Email + password form; call `auth.login`; redirect to `/documents` on success
    - Display 401 error as inline validation message
    - _Requirements: 8.1, 8.2_


- [ ] 14. Frontend — Document upload and job status polling
  - [ ] 14.1 Implement `src/hooks/useJobStatus.ts`
    - Custom hook `useJobStatus(jobId: string | null)` returning `{status, progress, error}`
    - Poll `api.jobs.getStatus(jobId)` every 3000ms via `setInterval`
    - Stop polling when status is `completed` or `failed` (clear interval)
    - Return `null` state when `jobId` is null
    - _Requirements: 7.1, 7.4, 7.5_
  - [ ] 14.2 Implement `src/components/Upload/UploadForm.tsx`
    - File input accepting MIME types: application/pdf, image/png, image/jpeg, image/tiff, image/bmp
    - Client-side size check ≤ 50 MB before sending
    - Call `api.documents.upload(file)` on submit → receive `{document_id, job_id}`
    - Render `JobStatusDisplay` component using `useJobStatus(job_id)`
    - Show progress bar during `processing` state; success/error message on terminal state
    - _Requirements: 1.1, 1.2, 1.3, 7.4, 7.5_
  - [ ] 14.3 Implement `src/pages/UploadPage.tsx`
    - Wrap `UploadForm` with page layout
    - On job completion: show link to `/documents/:id` to view the processed document
    - _Requirements: 1.1, 7.5_
  - [ ]* 14.4 Write unit tests for `useJobStatus` hook and `UploadForm`
    - Use Vitest + React Testing Library
    - Mock `api.jobs.getStatus` responses cycling through pending→processing→completed
    - Verify polling stops on terminal state; verify 50 MB client-side guard
    - _Requirements: 7.4, 7.5_


- [ ] 15. Frontend — Document list and detail pages
  - [ ] 15.1 Implement `src/components/DocumentList/DocumentCard.tsx`
    - Display: filename, MIME type badge, file size (human-readable), uploaded_at, job_status chip
    - Action buttons: "View" → `/documents/:id`, "Delete" (with confirmation dialog)
    - Call `api.documents.delete(id)` on confirm → remove from list optimistically
    - _Requirements: 5.1, 5.4_
  - [ ] 15.2 Implement `src/components/DocumentList/DocumentList.tsx`
    - Fetch `api.documents.list(page, size)` via React Query (or SWR)
    - Render paginated list of `DocumentCard` components with prev/next pagination controls
    - Show empty state when no documents
    - _Requirements: 5.1_
  - [ ] 15.3 Implement `src/pages/DocumentListPage.tsx`
    - Wrap `DocumentList` with page layout and "Upload New" button linking to `/upload`
    - _Requirements: 5.1_
  - [ ] 15.4 Implement `src/pages/DocumentDetailPage.tsx`
    - Fetch `api.documents.get(id)` — show metadata header (filename, size, date, status)
    - Render extracted text per page in a collapsible accordion below the viewer
    - Handle 404 (redirect to list) and 403 (show access denied)
    - _Requirements: 5.2, 5.3, 6.6_
  - [ ]* 15.5 Write unit tests for DocumentList and DocumentCard
    - Mock `api.documents.list` and `api.documents.delete`
    - Verify pagination controls, delete confirmation, optimistic removal
    - _Requirements: 5.1, 5.4_


- [ ] 16. Frontend — PDF viewer and bounding box overlay
  - [ ] 16.1 Implement `src/components/DocumentViewer/PDFRenderer.tsx`
    - Load `pdfjs-dist` worker from CDN or bundled asset
    - Accept props: `documentUrl: string`, `currentPage: number`, `onPageRendered` callback
    - Use `pdfjsLib.getDocument(documentUrl)` → `pdf.getPage(n)` →
      `page.render({ canvasContext, viewport })` at native resolution
    - Expose `{ totalPages, navigateTo(page) }` via ref or callback
    - Show loading spinner while page renders; show error state on PDF load failure
    - _Requirements: 6.1, 6.5_
  - [ ] 16.2 Implement `src/components/DocumentViewer/BoundingBoxOverlay.tsx`
    - Accept props: `boxes: BoundingBox[]`, `viewport: PageViewport`,
      `matchingBoxIndices?: number[]`
    - Render a `<canvas>` absolutely positioned over PDFRenderer canvas (same dimensions)
    - Scale box coords using `viewport.scale`
    - Draw normal boxes: `rgba(255,255,0,0.25)`; matching boxes: `rgba(255,140,0,0.5)`
    - `onMouseMove`: hit-test all boxes, show `TextTooltip` at cursor for hovered box
    - Re-draw on prop changes via `useEffect` + `clearRect` + redraw loop
    - _Requirements: 6.2, 6.3, 6.4_
  - [ ] 16.3 Implement `src/components/DocumentViewer/TextTooltip.tsx`
    - Small floating div positioned at cursor coordinates, showing `box.text`
    - Invisible when `hoveredBox` is null
    - _Requirements: 6.3_
  - [ ] 16.4 Implement `src/components/DocumentViewer/DocumentViewer.tsx`
    - Compose `PDFRenderer` + `BoundingBoxOverlay` + `TextTooltip`
    - Accept optional `highlightPageNumber?: number` and `highlightBoxIndices?: number[]`
      (populated when navigating from search results)
    - Fetch page bounding boxes from `documentDetail.pages[currentPage-1].bounding_boxes`
    - Show "OCR processing in progress" status indicator when pages array is empty (Req 6.6)
    - Page navigation controls: prev/next and page number input
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 16.5 Write unit tests for BoundingBoxOverlay and DocumentViewer
    - Mock `pdfjsLib` and Canvas 2D context
    - Verify bounding boxes drawn at correct scaled positions, correct colors for match vs normal
    - Verify tooltip appears on hover and hides on mouse-out
    - _Requirements: 6.2, 6.3, 6.4_


- [ ] 17. Frontend — Search page and result navigation
  - [ ] 17.1 Implement `src/components/Search/SearchBar.tsx`
    - Controlled text input, submit on Enter or button click
    - Debounce input 300ms before triggering search
    - Clear button; show spinner while fetching
    - _Requirements: 4.5_
  - [ ] 17.2 Implement `src/components/Search/SearchResultCard.tsx`
    - Display: filename, page number, snippet with `<em>` rendered as `<mark>`, relevance score
    - "Open" button: navigate to `/documents/:id` passing `?page=N&highlight=true`
    - _Requirements: 4.3_
  - [ ] 17.3 Implement `src/components/Search/SearchResults.tsx`
    - Accept `SearchResponse`; render list of `SearchResultCard` + pagination controls
    - Show "No results found" on total=0; show total count
    - _Requirements: 4.2, 4.4_
  - [ ] 17.4 Implement `src/pages/SearchPage.tsx`
    - Compose `SearchBar` + `SearchResults`
    - Call `api.search.query(q, page, size)` on search submit via React Query
    - Read `?q=` from URL query string to support shareable search URLs
    - On result click: navigate to `DocumentDetailPage` at the matched page with highlights
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.4_
  - [ ]* 17.5 Write unit tests for SearchBar and SearchResults
    - Mock `api.search.query`; verify debounce, empty-query guard, snippet HTML rendered safely
    - _Requirements: 4.3, 4.5_


- [ ] 18. Checkpoint — frontend complete
  - Ensure all frontend tests pass: `npm test -- --run` exits 0
  - Verify Vite build produces `dist/` without type errors: `npm run build`
  - Ask the user if questions arise.

- [ ] 19. End-to-end tests covering all 5 core flows
  - [ ] 19.1 Write E2E test — Flow A: Upload and process
    - Use Playwright; start full stack via `docker compose -f docker-compose.test.yml up -d`
    - Log in → navigate to Upload → upload a small test PDF → verify "Processing..." status
      displayed → poll until status "Ready" → verify document appears in list
    - _Requirements: 1.1, 1.5, 1.6, 2.1, 7.4, 7.5_
  - [ ] 19.2 Write E2E test — Flow B: Search
    - Prerequisite: at least one processed document from Flow A fixture
    - Navigate to Search → type a word known to be in the test PDF → verify results list
      contains the document with snippet → click result → verify viewer opens at correct page
    - _Requirements: 4.1, 4.2, 4.3, 6.4_
  - [ ] 19.3 Write E2E test — Flow C: View document with bounding box overlay
    - Navigate to document viewer → verify PDF page rendered → verify bounding box highlights
      visible on canvas → hover a highlight → verify tooltip text is non-empty
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ] 19.4 Write E2E test — Flow D: Manage documents
    - List page shows uploaded document → click document → verify detail page with metadata
    - Delete document → verify removed from list and 404 on direct URL access
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 19.5 Write E2E test — Flow E: Auth
    - Unauthenticated request to `/api/v1/documents` → HTTP 401
    - Valid login → token stored → all protected pages accessible
    - Expired/tampered token → redirect to `/login`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 20. Final checkpoint — all tests pass
  - Run `go test ./... -count=1` in `backend/` — all pass
  - Run `npm test -- --run` in `frontend/` — all pass
  - Run `npx playwright test` — all 5 E2E flows pass
  - Ensure all tests pass, ask the user if questions arise.


---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; core behavior is fully
  covered without them but test coverage will be reduced.
- All Go code lives under module `github.com/ocr-platform/backend`; all SQL lives in
  `repository/postgres/`; handlers call services, services call repositories — never shortcut.
- No SQL in handlers or services (blueprint rule §16.4).
- All configuration is environment-variable–driven; no hardcoded secrets or connection strings.
- Binary file content is never stored in PostgreSQL (blueprint §14).
- The frontend never calls the database or OpenSearch directly — all access via API server.
- Redis is ephemeral cache + queue only — never source of truth.
- Checkpoints at tasks 10 and 18 and 20 are gates before proceeding to the next phase.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "4.1", "5.1", "5.2"] },
    { "id": 3, "tasks": ["6.1", "7.1", "7.2", "7.3", "7.4", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["3.5", "4.2", "6.2", "7.5", "8.5"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "11.1", "11.2", "11.3"] },
    { "id": 6, "tasks": ["9.6", "11.4", "12.1", "12.2"] },
    { "id": 7, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 8, "tasks": ["14.1", "14.2", "14.3", "15.1", "15.2", "15.3", "15.4", "16.1"] },
    { "id": 9, "tasks": ["14.4", "15.5", "16.2", "16.3", "16.4", "17.1", "17.2", "17.3", "17.4"] },
    { "id": 10, "tasks": ["16.5", "17.5"] },
    { "id": 11, "tasks": ["19.1", "19.2", "19.3", "19.4", "19.5"] }
  ]
}
```
