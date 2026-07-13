# Architecture Overview

## System Overview

The OCR Platform is a full-stack document processing system that enables users to upload, extract, search, and view text from PDF and image documents. The system is designed for horizontal scalability, fault tolerance, and operational observability.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                           │
│                  React SPA (PDF.js + Canvas)                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS / REST
┌─────────────────────────▼───────────────────────────────────────┐
│                        API Layer                                │
│                  Go / Gin HTTP Server                           │
│         (Auth Middleware, Rate Limiting, Logging)               │
└──────┬────────────┬─────────────┬──────────────┬───────────────┘
       │            │             │              │
┌──────▼──────┐ ┌───▼────┐ ┌─────▼──────┐ ┌────▼──────────────┐
│ PostgreSQL  │ │ Redis  │ │ OpenSearch │ │  OCR Worker Pool  │
│  (Metadata  │ │(Cache/ │ │  (Search   │ │  (Calls PaddleOCR │
│  + Results) │ │ Queue) │ │   Index)   │ │   API / pdfcpu)   │
└─────────────┘ └────────┘ └────────────┘ └────────┬──────────┘
                                                   │
                                          ┌────────▼──────────┐
                                          │ PaddleOCR Service │
                                          │ (Python / Docker) │
                                          └────────┬──────────┘
                                                   │
                                          ┌────────▼──────────┐
                                          │   File Storage    │
                                          │ (Local FS / S3)   │
                                          └───────────────────┘
```

---

## Component Responsibilities

### API Server (Go + Gin)
- Handles all inbound HTTP requests
- Enforces authentication and authorization via JWT Bearer tokens
- Validates incoming documents (MIME type, file size)
- Persists document metadata to PostgreSQL
- Enqueues OCR extraction jobs via Redis
- Proxies search queries to OpenSearch
- Serves document metadata and extraction results from cache or DB
- Exposes `/health` and `/metrics` endpoints

### OCR Worker Pool
- Consumes jobs from the Redis job queue
- Processes PDFs using `pdfcpu` or `poppler` for page rendering
- Processes images and rendered PDF pages by calling the local PaddleOCR service
- Writes extracted text, bounding boxes, and confidence scores to PostgreSQL
- Triggers indexing by notifying the API server or writing directly to OpenSearch
- Updates `Job_Status` on completion or failure

### PostgreSQL (Document Store)
- Stores document metadata (filename, MIME type, size, upload timestamp, owner)
- Stores extraction results (text, bounding boxes, confidence scores, page count)
- Tracks `Extraction_Job` state and error messages
- Does not store binary file content

### OpenSearch (Search Index)
- Stores per-page extracted text records with document and page references
- Serves full-text search with relevance ranking and snippet highlighting
- Stores bounding box data alongside page records for result navigation

### Redis (Cache + Job Queue)
- Caches search results (TTL: 60s)
- Caches document metadata (TTL: 300s)
- Caches job status responses (TTL: 5s)
- Acts as the job queue for OCR extraction tasks

### File Storage
- Stores raw uploaded document files
- Configurable: local filesystem or S3-compatible object storage
- Referenced by path/key in PostgreSQL; binary content never stored in DB

### React Frontend
- Single-page application built with React
- Renders PDFs using PDF.js on an HTML Canvas element
- Overlays bounding box highlights on the Canvas for OCR results
- Provides search UI, document list, upload interface, and real-time job status polling

---

## Data Flow

### Upload Flow
```
User → Upload File → API Server → Validate → Store Metadata (PG)
                                           → Store File (FS/S3)
                                           → Enqueue Job (Redis)
                                           → Return 202 + Job ID
```

### OCR Processing Flow
```
OCR Worker → Dequeue Job (Redis) → Fetch File (FS/S3)
           → Call PaddleOCR API → Extract Text + Bounding Boxes
           → Persist Results (PG)
           → Index Page Records (OpenSearch)
           → Update Job Status → completed / failed
```

### Search Flow
```
User → Search Query → API Server → Check Cache (Redis)
                                 → Query OpenSearch (on miss)
                                 → Cache Result (Redis, 60s TTL)
                                 → Return Ranked Results
```

### View Flow
```
User → Open Document → API Server → Fetch Metadata + Bounding Boxes (PG/Cache)
                    → Frontend → Render PDF Pages (PDF.js + Canvas)
                              → Overlay Bounding Boxes
```

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│                  Docker Compose / Kubernetes      │
│                                                  │
│  ┌─────────────┐  ┌─────────────────────────┐   │
│  │  nginx      │  │  Go API Server (x N)    │   │
│  │  (Reverse   │  │  replicas               │   │
│  │   Proxy /   │  └─────────────────────────┘   │
│  │   TLS)      │  ┌─────────────────────────┐   │
│  └─────────────┘  │  OCR Worker (x M)       │   │
│                   │  replicas               │   │
│  ┌─────────────┐  └─────────────────────────┘   │
│  │  PostgreSQL │  ┌─────────────────────────┐   │
│  │  (primary + │  │  React Frontend         │   │
│  │   replica)  │  │  (served via nginx)     │   │
│  └─────────────┘  └─────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────────────────┐   │
│  │  Redis      │  │  PaddleOCR Service      │   │
│  │  Sentinel   │  │  (1+ nodes)             │   │
│  └─────────────┘  └─────────────────────────┘   │
│                   ┌─────────────────────────┐   │
│                   │  OpenSearch Cluster     │   │
│                   │  (1+ nodes)             │   │
│                   └─────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend language | Go + Gin | High concurrency, low memory footprint, fast startup |
| OCR engine | PaddleOCR | Significantly higher accuracy on complex layouts compared to Tesseract (ADR-001) |
| PDF processing | pdfcpu / poppler | Go-native or system library for page rendering |
| Job queue | Redis List | Simple, low-latency, already in stack for caching |
| Search engine | OpenSearch | Full-text search, relevance ranking, open source |
| Auth | JWT (self-signed) | No external IdP dependency at runtime |
| File storage | Pluggable (FS/S3) | Operator choice between local dev and cloud prod |

See [Decisions.md](./Decisions.md) for full ADR log.

---

## Cross-Cutting Concerns

- **Observability**: Structured JSON logs on every request; Prometheus metrics at `/metrics`; dependency health at `/health`
- **Security**: JWT auth on all endpoints except `/health`; per-user document isolation; see [Security.md](./Security.md)
- **Scalability**: Stateless API and worker pods; horizontal scaling via Kubernetes; see [Scaling.md](./Scaling.md)
- **Testing**: Unit, integration, property-based, and E2E test strategy; see [Testing.md](./Testing.md)
