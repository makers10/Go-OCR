# OCR Platform — Product Blueprint

> **This is the single source of truth for what we are building.**
> Every developer, every PR, every design decision must align with this document.
> When in doubt, come back here first.

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [Core User Flows](#2-core-user-flows)
3. [System Boundaries](#3-system-boundaries)
4. [Technology Stack (Locked)](#4-technology-stack-locked)
5. [Project Structure](#5-project-structure)
6. [Component Contract Map](#6-component-contract-map)
7. [Data Lifecycle](#7-data-lifecycle)
8. [API Surface (Canonical)](#8-api-surface-canonical)
9. [Database Schema (Canonical)](#9-database-schema-canonical)
10. [OpenSearch Index (Canonical)](#10-opensearch-index-canonical)
11. [Redis Key Schema (Canonical)](#11-redis-key-schema-canonical)
12. [Worker Contract](#12-worker-contract)
13. [Frontend Component Tree](#13-frontend-component-tree)
14. [Non-Negotiable Constraints](#14-non-negotiable-constraints)
15. [What Is Out of Scope](#15-what-is-out-of-scope)
16. [Developer Rules of Engagement](#16-developer-rules-of-engagement)

---

## 1. What We Are Building

A **web-based OCR document platform** that allows authenticated users to:

1. **Upload** PDF and image files (PNG, JPEG, TIFF, BMP)
2. **Extract** text automatically via OCR, with bounding box coordinates per word/line
3. **Search** the extracted text across all their documents using full-text search
4. **View** documents in-browser with OCR text overlaid visually on the original pages
5. **Manage** their document library (list, view detail, delete)

The product is a **self-hosted, operator-deployed** system. There is no SaaS multi-tenancy. A single deployment serves one organization. Authentication is JWT-based with no external identity provider dependency.

---

## 2. Core User Flows

These are the **immutable product flows**. No developer change should break any of these paths.

### Flow A — Upload & Process
```
User opens Upload UI
  → Selects file (PDF or image, max 50MB)
  → Clicks Upload
  → API validates file (MIME type + size)
  → File saved to storage
  → Document metadata saved to PostgreSQL
  → OCR job enqueued in Redis
  → User sees "Processing..." status
  → Worker picks up job within 30 seconds
  → Worker extracts text + bounding boxes
  → Results saved to PostgreSQL
  → Page records indexed in OpenSearch
  → Job status updated to "completed"
  → User sees "Ready" status
  → Document becomes searchable and viewable
```

### Flow B — Search
```
User types search query in Search UI
  → API checks Redis cache (60s TTL)
  → On cache miss: queries OpenSearch
  → Returns paginated results (default 20/page)
  → Each result shows: filename, snippet with highlighted match, page number
  → User clicks a result
  → PDF Viewer opens to the matching page
  → Matching bounding boxes are visually highlighted
```

### Flow C — View Document
```
User opens Document Viewer
  → PDF.js renders pages on Canvas
  → API returns bounding box data for current page
  → Frontend overlays semi-transparent highlights on Canvas
  → Hovering a highlight shows the recognized text in a tooltip
  → Non-search-match highlights are shown in a neutral color
  → Search-match highlights are shown in a distinct highlight color
```

### Flow D — Manage Documents
```
User opens Document List
  → Sees paginated list of their uploads (filename, type, size, date, status)
  → Clicks a document → sees full metadata + extracted text
  → Clicks Delete → document file, metadata, results, and search index records are removed
```

### Flow E — Auth
```
User provides credentials
  → Receives JWT Bearer token
  → All subsequent requests include Authorization: Bearer <token>
  → Token validated server-side against configurable signing secret
  → Expired/invalid token → HTTP 401
  → Accessing another user's document → HTTP 403
```

---

## 3. System Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OCR PLATFORM SYSTEM                          │
│                                                                     │
│  ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐  │
│  │   React SPA  │────▶│  Go/Gin API      │────▶│  PostgreSQL    │  │
│  │  (Frontend)  │     │  (API Server)    │     │  (Doc Store)   │  │
│  └──────────────┘     └────────┬─────────┘     └────────────────┘  │
│                                │                                    │
│                    ┌───────────┼───────────┐                        │
│                    │           │           │                        │
│             ┌──────▼──┐  ┌────▼────┐  ┌───▼──────────┐           │
│             │  Redis  │  │OpenSrch │  │  File Storage│           │
│             │ (Cache/ │  │(Search) │  │  (FS / S3)   │           │
│             │  Queue) │  └─────────┘  └──────────────┘           │
│             └────┬────┘                                            │
│                  │                                                  │
│          ┌───────▼────────┐                                        │
│          │  OCR Worker    │─────▶┌────────────────┐                │
│          │  (Go process)  │      │ PaddleOCR Svc  │                │
│          └────────────────┘      └────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘

EXTERNAL DEPENDENCIES (outside system boundary):
  - pdfcpu or poppler (system-level, for PDF page rendering)
  - SMTP (optional, for future notifications — out of scope v1)
```

**The system has NO external service calls at runtime** except to its own infrastructure components. No third-party cloud OCR APIs. No cloud-specific SDKs in core logic.

---

## 4. Technology Stack (Locked)

> These choices are **fixed**. Do not introduce alternatives without an ADR in `Decisions.md`.

| Layer | Technology | Version Target | Notes |
|---|---|---|---|
| Backend language | Go | 1.22+ | Modules enabled |
| HTTP framework | Gin | v1.9+ | No switching to Echo/Fiber |
| Database | PostgreSQL | 15+ | With `pgx` driver |
| Search | OpenSearch | 2.x | opensearch-go client |
| Cache / Queue | Redis | 7.x | go-redis/v9 client |
| OCR engine | PaddleOCR | latest | via independent Python Docker service (REST/gRPC) |
| PDF rendering | pdfcpu / poppler | latest stable | pdfcpu preferred (pure Go) |
| Frontend framework | React | 18+ | TypeScript |
| PDF viewer | PDF.js | 3.x+ | Mozilla maintained |
| Canvas drawing | HTML5 Canvas API | native | No canvas libraries |
| Auth | JWT | RS256 or HS256 | `golang-jwt/jwt` |
| Containerization | Docker + Compose | latest | Kubernetes-ready |
| Migrations | golang-migrate | v4 | SQL migrations in `migrations/` |
| Metrics | Prometheus | - | `promhttp` handler |
| Logging | zerolog | - | Structured JSON logs |

---

## 5. Project Structure

```
ocr-platform/
│
├── backend/                        # Go API Server
│   ├── cmd/
│   │   ├── api/                    # main.go — starts HTTP server
│   │   └── worker/                 # main.go — starts OCR worker
│   ├── internal/
│   │   ├── api/
│   │   │   ├── handler/            # HTTP handlers (one file per resource)
│   │   │   ├── middleware/         # auth, logging, rate-limit
│   │   │   └── router.go           # route registration
│   │   ├── domain/                 # pure domain types (Document, Job, Page, User)
│   │   ├── service/                # business logic layer
│   │   │   ├── document.go
│   │   │   ├── ocr.go
│   │   │   ├── search.go
│   │   │   └── job.go
│   │   ├── repository/             # data access layer
│   │   │   ├── postgres/           # PG implementations
│   │   │   └── opensearch/         # OS implementations
│   │   ├── worker/                 # OCR job consumer
│   │   │   ├── consumer.go
│   │   │   └── processor.go
│   │   ├── cache/                  # Redis wrapper
│   │   ├── storage/                # file storage abstraction (local + S3)
│   │   └── config/                 # config loading (env vars)
│   ├── migrations/                 # SQL migration files
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload/
│   │   │   ├── DocumentList/
│   │   │   ├── DocumentViewer/     # PDF.js + Canvas + overlay
│   │   │   ├── Search/
│   │   │   └── JobStatus/
│   │   ├── pages/
│   │   ├── api/                    # API client (typed fetch wrappers)
│   │   ├── hooks/                  # custom React hooks
│   │   ├── store/                  # state management
│   │   └── types/                  # TypeScript types matching backend DTOs
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── docs/                           # All documentation
│   ├── Architecture.md
│   ├── API.md
│   ├── Database.md
│   ├── Search.md
│   ├── OCR.md
│   ├── Queue.md
│   ├── Security.md
│   ├── Deployment.md
│   ├── Scaling.md
│   ├── Testing.md
│   ├── CodingStandards.md
│   ├── Decisions.md
│   └── Roadmap.md
│
├── docker/
│   ├── docker-compose.yml          # Full local dev stack
│   ├── docker-compose.test.yml     # Test environment
│   └── nginx.conf                  # Reverse proxy config
│
├── scripts/
│   ├── migrate.sh                  # Run DB migrations
│   ├── seed.sh                     # Dev seed data
│   └── test.sh                     # Run all tests
│
├── BLUEPRINT.md                    # ← THIS FILE
└── README.md
```

---

## 6. Component Contract Map

This defines what each component **owns** and what it **must not touch**.

| Component | Owns | Must NOT touch |
|---|---|---|
| API Server | HTTP routing, request validation, auth enforcement, response shaping | OCR logic, direct file I/O in handlers |
| OCR Worker | Job consumption, text extraction, bounding box generation | HTTP request handling, search queries |
| PostgreSQL | Document metadata, job state, extraction results, user records | Binary file content |
| OpenSearch | Full-text index, per-page text, bounding box refs | Auth, file storage, raw OCR processing |
| Redis | Cache (search, metadata, job status), job queue | Persistent data, source of truth for any record |
| File Storage | Raw uploaded files (PDF, images) | Metadata, structured data |
| Frontend | UI rendering, PDF page display, bounding box overlay | OCR processing, direct DB/search access |

**Interface rules:**
- Frontend communicates **only** with the API Server (never directly to DB, Redis, or OpenSearch)
- OCR Worker communicates **only** with Redis (queue), PostgreSQL (results), OpenSearch (indexing), and File Storage (file reads)
- API Server is the **only** component the frontend talks to

---

## 7. Data Lifecycle

```
UPLOAD
  Document file ──────────────────────────────▶ File Storage (permanent until deleted)
  Document metadata ──────────────────────────▶ PostgreSQL.documents (permanent until deleted)
  Extraction job ─────────────────────────────▶ PostgreSQL.extraction_jobs (permanent until deleted)
  Job enqueue ────────────────────────────────▶ Redis queue (ephemeral, consumed by worker)

OCR PROCESSING
  Extracted pages ────────────────────────────▶ PostgreSQL.document_pages (permanent until deleted)
  Search records ─────────────────────────────▶ OpenSearch.documents index (permanent until deleted)
  Job status update ──────────────────────────▶ PostgreSQL.extraction_jobs.status

CACHING (all ephemeral — never source of truth)
  Search results ─────────────────────────────▶ Redis (TTL: 60s)
  Document metadata ──────────────────────────▶ Redis (TTL: 300s)
  Job status ─────────────────────────────────▶ Redis (TTL: 5s)

DELETION (cascading — all must complete atomically)
  DELETE document ────────────────────────────▶ File Storage: delete file
                  ────────────────────────────▶ PostgreSQL: delete document + pages + jobs
                  ────────────────────────────▶ OpenSearch: delete page records (within 5s)
                  ────────────────────────────▶ Redis: invalidate cached metadata

RETENTION (automated)
  Configurable TTL (days) ────────────────────▶ Background job cascades same as manual deletion
```

---

## 8. API Surface (Canonical)

> Full details in `docs/API.md`. This is the authoritative route list.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Exchange credentials for JWT |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |

### Documents
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/documents` | ✓ | Upload document |
| GET | `/api/v1/documents` | ✓ | List documents (paginated) |
| GET | `/api/v1/documents/:id` | ✓ | Get document metadata + text |
| DELETE | `/api/v1/documents/:id` | ✓ | Delete document |
| POST | `/api/v1/documents/:id/reprocess` | ✓ | Resubmit failed job |

### Jobs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/jobs/:id` | ✓ | Get job status + progress |

### Search
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/search?q=...&page=1&size=20` | ✓ | Full-text search |

### System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | ✗ | Dependency health check |
| GET | `/metrics` | ✗ | Prometheus metrics |

**All authenticated endpoints return HTTP 401 on missing/invalid token.**
**All resource endpoints return HTTP 403 if accessing another user's resource.**

---

## 9. Database Schema (Canonical)

> Full DDL in `migrations/`. This is the canonical table structure.

```sql
-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,           -- bcrypt hash
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    file_size       BIGINT NOT NULL,
    storage_path    TEXT NOT NULL,       -- path/key in file storage
    page_count      INT,                 -- filled after OCR
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,         -- retention expiry
    CONSTRAINT chk_mime CHECK (mime_type IN (
        'application/pdf','image/png','image/jpeg','image/tiff','image/bmp'
    ))
);

-- Extraction Jobs
CREATE TABLE extraction_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',   -- pending|processing|completed|failed
    progress        INT NOT NULL DEFAULT 0,            -- 0-100
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    CONSTRAINT chk_status CHECK (status IN ('pending','processing','completed','failed'))
);

-- Document Pages (OCR Results)
CREATE TABLE document_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number     INT NOT NULL,
    text_content    TEXT NOT NULL,
    bounding_boxes  JSONB NOT NULL,      -- array of {x,y,w,h,text,confidence}
    extracted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, page_number)
);

-- Indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at DESC);
CREATE INDEX idx_extraction_jobs_document_id ON extraction_jobs(document_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_document_pages_document_id ON document_pages(document_id);
```

**Bounding box JSON structure:**
```json
[
  {
    "x": 120, "y": 45, "width": 200, "height": 18,
    "text": "Invoice", "confidence": 98.5
  }
]
```

---

## 10. OpenSearch Index (Canonical)

**Index name:** `ocr_documents`

```json
{
  "mappings": {
    "properties": {
      "document_id":   { "type": "keyword" },
      "user_id":       { "type": "keyword" },
      "filename":      { "type": "text" },
      "page_number":   { "type": "integer" },
      "text_content":  { "type": "text", "analyzer": "standard" },
      "bounding_boxes":{ "type": "object", "enabled": false },
      "uploaded_at":   { "type": "date" }
    }
  }
}
```

**One document per page.** Search returns page-level hits with `document_id` for grouping.

---

## 11. Redis Key Schema (Canonical)

> All keys are prefixed. Never use raw keys without these prefixes.

| Key Pattern | Value | TTL | Purpose |
|---|---|---|---|
| `doc:meta:{document_id}` | JSON — document metadata | 300s | Cache GET /documents/:id |
| `job:status:{job_id}` | JSON — job status response | 5s | Cache GET /jobs/:id |
| `search:{sha256(query+page+size)}` | JSON — search results | 60s | Cache GET /search |
| `ocr:queue` | Redis List (LPUSH/BRPOP) | — | Job queue |

**Invalidation rules:**
- `doc:meta:{id}` → deleted on document update or delete
- `search:*` → NOT proactively invalidated (TTL expiry only)
- `job:status:{id}` → TTL expiry only (5s is safe for polling)

---

## 12. Worker Contract

The OCR worker is a **separate process** (separate binary: `cmd/worker/main.go`).

### Startup
- Connects to Redis, PostgreSQL, OpenSearch, File Storage
- Starts N goroutines (configurable via `WORKER_CONCURRENCY` env var)
- Each goroutine runs `BRPOP ocr:queue 0` (blocking pop, no timeout)

### Job Processing Steps (per job)
```
1. BRPOP ocr:queue → receive job_id
2. UPDATE extraction_jobs SET status='processing', started_at=now() WHERE id=job_id
3. SELECT document FROM documents WHERE id=document.id
4. Fetch file from File Storage
5. If PDF: render each page to image (pdfcpu)
6. For each page: send image to PaddleOCR service → get text + bounding boxes + confidence
7. INSERT document_pages (one row per page)
8. UPDATE documents SET page_count=N
9. Index page records into OpenSearch
10. UPDATE extraction_jobs SET status='completed', progress=100, completed_at=now()
11. On any unrecoverable error:
    UPDATE extraction_jobs SET status='failed', error_message=<msg>
    Log structured error entry
```

### Worker Guarantees
- Idempotent: reprocessing a document replaces existing page records
- No message acknowledgement loss: job is re-queued on worker crash via at-least-once delivery pattern
- Worker does NOT handle HTTP requests — zero Gin dependency

---

## 13. Frontend Component Tree

```
App
├── AuthProvider (JWT context)
├── Router
│   ├── /login           → LoginPage
│   ├── /documents       → DocumentListPage
│   │   └── DocumentList
│   │       └── DocumentCard (filename, status, date, actions)
│   ├── /documents/:id   → DocumentDetailPage
│   │   ├── DocumentMetadata
│   │   └── DocumentViewer
│   │       ├── PDFRenderer (PDF.js → Canvas)
│   │       └── BoundingBoxOverlay (Canvas layer)
│   │           └── TextTooltip (on hover)
│   ├── /upload          → UploadPage
│   │   └── UploadForm
│   │       └── JobStatusPoller (polls /jobs/:id every 3s)
│   └── /search          → SearchPage
│       ├── SearchBar
│       ├── SearchResults
│       │   └── SearchResultCard (snippet, highlight, page nav)
│       └── → opens DocumentViewer at matched page
```

### State Management Rules
- Global state: auth token, current user — in React Context
- Server state: documents, search results, job status — via React Query (or SWR)
- Local UI state: hover, modal open/close — in component state
- **No Redux.** Keep it simple.

### API Client Rules
- All API calls go through `src/api/client.ts` — a typed fetch wrapper
- Never call `fetch()` directly in components
- All response types must have matching TypeScript interfaces in `src/types/`

---

## 14. Non-Negotiable Constraints

These constraints **cannot be changed** without a product decision and an ADR entry.

| Constraint | Value | Reason |
|---|---|---|
| Max upload size | 50 MB | Protects server memory during processing |
| Supported MIME types | PDF, PNG, JPEG, TIFF, BMP | Tesseract + pdfcpu input support |
| Job pickup SLA | 30 seconds | User experience requirement |
| Search response SLA | 1 second (up to 100k pages) | User experience requirement |
| Page render SLA | 2 seconds (up to 200 pages) | User experience requirement |
| Poll interval (min) | 3 seconds | Prevent Redis/DB flood |
| Search cache TTL | 60 seconds | Balance freshness vs load |
| Doc metadata cache TTL | 300 seconds | Stable data, low volatility |
| Job status cache TTL | 5 seconds | Fast polling without DB flood |
| Auth scope | User can only access their own documents | Data isolation |
| No external IdP | JWT validated locally | Operational simplicity |
| Binary files in DB | NEVER | PostgreSQL is not a blob store |
| Frontend → direct DB | NEVER | All access through API Server |

---

## 15. What Is Out of Scope (v1)

Do not implement these. If requested, create an ADR and update the Roadmap.

- Multi-organization / SaaS tenancy
- Real-time push notifications (WebSocket or SSE) — v1 uses polling
- Email notifications on job completion
- OCR language selection per document (v1 uses Tesseract default)
- Document versioning (re-upload creates new document)
- Role-based access control (RBAC) — v1 is owner-only
- Admin dashboard
- Bulk upload (v1 is one file per request)
- Document editing or annotation
- Mobile native app
- Third-party OCR API integration (Google Vision, AWS Textract)
- Billing or usage quotas

---

## 16. Developer Rules of Engagement

> Follow these rules on every PR. Reviewers will check against this document.

### Code Rules
1. **Read this blueprint before writing any code.** If your implementation contradicts this document, update the blueprint (with review) or change your code.
2. **No new dependencies** without a comment in the PR and an entry in `Decisions.md`.
3. **Handlers must not contain business logic.** Handlers call services. Services call repositories.
4. **No SQL in handlers or services.** All SQL lives in `repository/postgres/`.
5. **All configuration comes from environment variables.** No hardcoded connection strings, secrets, or ports.
6. **Every new endpoint must have an integration test.**
7. **Every new database table or column requires a migration file.** Never ALTER tables manually.

### Git Rules
1. Branch naming: `feature/`, `fix/`, `chore/`, `docs/`
2. PR titles must reference a requirement (e.g., `feat: document upload (Req 1)`)
3. Never push directly to `main`
4. PRs require at least one review

### The Golden Rule
> **If a developer change breaks any of the 5 core user flows in Section 2, it does not ship.**
> Automated tests must cover all 5 flows end-to-end before any release.

---

*Blueprint version: 1.0 — Last updated: 2026-07-10*
*Owner: Platform Team*
*Next review: Before v1 release*
