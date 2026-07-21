# Requirements Document

## Introduction

This document defines the requirements for an OCR (Optical Character Recognition) system built on a full-stack architecture comprising a Go/Gin backend, PostgreSQL database, OpenSearch search engine, Redis cache, and a React/PDF.js/Canvas frontend. The system enables users to upload documents (PDFs and images), extract text via OCR processing, store and index the extracted content, and search and display results through an interactive web interface.

## Glossary

- **OCR_Engine**: The server-side component responsible for extracting text from uploaded documents using optical character recognition.
- **Document**: A file uploaded by a user, which may be a PDF or image (PNG, JPEG, TIFF, BMP).
- **Extraction_Job**: An asynchronous task that processes a Document through the OCR_Engine to produce extracted text.
- **API_Server**: The Go/Gin HTTP server that handles all client requests and coordinates system components.
- **Document_Store**: The PostgreSQL database that persists document metadata, extraction results, and job status.
- **Search_Index**: The OpenSearch index that stores and serves full-text search over extracted document content.
- **Cache**: The Redis instance used to store frequently accessed data and session state.
- **Frontend**: The React single-page application that renders the user interface.
- **PDF_Viewer**: The PDF.js-based component within the Frontend that renders PDF pages on a Canvas element.
- **Bounding_Box**: A rectangular region on a document page that identifies the location of a recognized text segment.
- **User**: An authenticated human interacting with the system through the Frontend.
- **Job_Status**: The current state of an Extraction_Job, one of: `pending`, `processing`, `completed`, or `failed`.

---

## Requirements

### Requirement 1: Document Upload

**User Story:** As a User, I want to upload PDF and image files, so that the system can extract and index their text content.

#### Acceptance Criteria

1. THE API_Server SHALL accept multipart/form-data upload requests containing a single Document file.
2. WHEN a Document is uploaded, THE API_Server SHALL validate that the file's MIME type is one of: `application/pdf`, `image/png`, `image/jpeg`, `image/tiff`, or `image/bmp`.
3. WHEN a Document's file size exceeds 50 MB, THE API_Server SHALL reject the upload and return an HTTP 413 response with a descriptive error message.
4. IF a Document fails MIME type validation, THEN THE API_Server SHALL return an HTTP 415 response with a descriptive error message.
5. WHEN a valid Document is received, THE API_Server SHALL assign a unique identifier to the Document and persist its metadata (filename, size, MIME type, upload timestamp, uploader identity) to the Document_Store.
6. WHEN a Document is successfully stored, THE API_Server SHALL enqueue an Extraction_Job with status `pending` and return an HTTP 202 response containing the Document identifier and Job_Status.
7. THE API_Server SHALL support concurrent uploads of up to 50 Documents without degrading response times beyond 2 seconds per upload acknowledgement.

---

### Requirement 2: OCR Text Extraction

**User Story:** As a User, I want uploaded documents to be processed automatically, so that their text content becomes available for search and display without manual intervention.

#### Acceptance Criteria

1. WHEN an Extraction_Job enters the `pending` state, THE OCR_Engine SHALL begin processing the associated Document within 30 seconds.
2. WHILE an Extraction_Job is processing, THE API_Server SHALL report Job_Status as `processing` to any polling client.
3. WHEN the OCR_Engine processes a PDF Document, THE OCR_Engine SHALL extract text and Bounding_Box coordinates for each recognized text segment on every page.
4. WHEN the OCR_Engine processes an image Document, THE OCR_Engine SHALL extract text and Bounding_Box coordinates for each recognized text segment.
26. IF the OCR_Engine encounters an unrecoverable error during extraction, THEN THE OCR_Engine SHALL update Job_Status to `failed`, persist a human-readable error description to the Document_Store, and emit a structured error log entry.
7. WHEN an Extraction_Job fails, THE API_Server SHALL allow the User to resubmit the Document for a new Extraction_Job.
8. THE OCR_Engine SHALL extract text with a character-level confidence score for each recognized segment and persist that score alongside the extracted text.

---

### Requirement 3: Search Indexing

**User Story:** As a User, I want extracted document text to be indexed automatically, so that I can find documents by searching for words or phrases they contain.

#### Acceptance Criteria

1. WHEN an Extraction_Job transitions to `completed`, THE API_Server SHALL index the extracted text, Document identifier, filename, page numbers, and Bounding_Box coordinates into the Search_Index.
2. THE Search_Index SHALL store one record per page, associating page-level extracted text with the corresponding Document identifier and page number.
3. WHEN a Document is deleted, THE API_Server SHALL remove all corresponding records from the Search_Index within 5 seconds of deletion.
4. THE API_Server SHALL support full-text search queries of up to 1,000 characters against the Search_Index.
5. WHEN the Search_Index is unavailable, THE API_Server SHALL return an HTTP 503 response and SHALL NOT silently return empty results.

---

### Requirement 4: Full-Text Search

**User Story:** As a User, I want to search for documents by their text content, so that I can quickly locate relevant documents in a large collection.

#### Acceptance Criteria

1. WHEN a User submits a search query, THE API_Server SHALL query the Search_Index and return matching Documents ranked by relevance score.
2. THE API_Server SHALL return search results as a paginated list, with a default page size of 20 and a maximum page size of 100.
3. WHEN a search query matches text within a Document, THE API_Server SHALL include in each result: Document identifier, filename, upload timestamp, a text snippet with the matched term highlighted, the page number of the match, and the relevance score.
4. WHEN a search query produces no matches, THE API_Server SHALL return an HTTP 200 response with an empty results list and a total count of zero.
5. IF a search query is empty or contains only whitespace, THEN THE API_Server SHALL return an HTTP 400 response with a descriptive error message.
6. THE API_Server SHALL return search results within 1 second for indexes containing up to 100,000 pages.
7. THE Cache SHALL store the results of identical search queries for 60 seconds to reduce repeated Search_Index load.

---

### Requirement 5: Document Management

**User Story:** As a User, I want to list, view, and delete my uploaded documents, so that I can manage the document collection over time.

#### Acceptance Criteria

1. THE API_Server SHALL provide an endpoint that returns a paginated list of all Documents, including identifier, filename, MIME type, file size, upload timestamp, and current Job_Status.
2. THE API_Server SHALL provide an endpoint that returns the full metadata and extracted text for a single Document identified by its unique identifier.
3. WHEN a requested Document identifier does not exist, THE API_Server SHALL return an HTTP 404 response.
4. WHEN a User requests deletion of a Document, THE API_Server SHALL remove the Document's file, metadata, extraction results, and Search_Index records, and return an HTTP 200 response confirming deletion.
5. THE Cache SHALL store Document metadata responses for 300 seconds and SHALL invalidate the cached entry immediately upon Document update or deletion.

---

### Requirement 6: Document Viewer with OCR Overlay

**User Story:** As a User, I want to view a document with its recognized text highlighted on the page, so that I can verify OCR accuracy and locate specific content visually.

#### Acceptance Criteria

1. WHEN a User opens a Document in the PDF_Viewer, THE PDF_Viewer SHALL render each page using PDF.js on a Canvas element at the document's native resolution.
2. WHEN extracted Bounding_Box data is available for a page, THE Frontend SHALL overlay semi-transparent highlight regions on the Canvas corresponding to each recognized text segment.
3. WHEN a User hovers over a Bounding_Box highlight, THE Frontend SHALL display the recognized text for that segment in a tooltip.
4. WHEN a User performs a search and selects a result, THE PDF_Viewer SHALL navigate to the page containing the matched text and visually distinguish the matching Bounding_Box highlights from non-matching ones.
5. THE Frontend SHALL render PDF pages and Bounding_Box overlays within 2 seconds of the User navigating to a page, for documents up to 200 pages.
6. WHEN Bounding_Box data is not yet available for a page, THE Frontend SHALL display the page without overlays and show a status indicator communicating that OCR processing is in progress.

---

### Requirement 7: Job Status Polling

**User Story:** As a User, I want to see the processing status of my uploaded document in real time, so that I know when the document is ready to search and view.

#### Acceptance Criteria

1. THE API_Server SHALL provide an endpoint that returns the current Job_Status, progress percentage (where calculable), and any error message for a given Extraction_Job identifier.
2. WHEN Job_Status is `completed`, THE API_Server SHALL include the total page count and extraction timestamp in the status response.
3. WHEN Job_Status is `failed`, THE API_Server SHALL include a human-readable error description in the status response.
4. THE Frontend SHALL poll the job status endpoint at intervals of no less than 3 seconds while Job_Status is `pending` or `processing`.
5. WHEN Job_Status transitions to `completed` or `failed`, THE Frontend SHALL cease polling and update the UI to reflect the final state.
6. THE Cache SHALL store Job_Status responses for 5 seconds to reduce redundant Document_Store queries during active polling.

---

### Requirement 8: API Authentication and Authorization

**User Story:** As a system operator, I want all API endpoints to require authentication, so that only authorized users can upload, search, and delete documents.

#### Acceptance Criteria

1. THE API_Server SHALL require a valid Bearer token in the `Authorization` header for all endpoints except the health check endpoint.
2. IF a request is received without a valid Bearer token, THEN THE API_Server SHALL return an HTTP 401 response.
3. THE API_Server SHALL enforce that a User may only delete or retrieve extraction results for Documents that the User uploaded.
4. IF a User attempts to access a Document uploaded by a different User, THEN THE API_Server SHALL return an HTTP 403 response.
5. THE API_Server SHALL validate Bearer tokens against a configurable signing secret without requiring an external identity service dependency at runtime.

---

### Requirement 9: Health and Observability

**User Story:** As a system operator, I want health check and metrics endpoints, so that I can monitor system availability and diagnose issues in production.

#### Acceptance Criteria

1. THE API_Server SHALL expose a `/health` endpoint that returns an HTTP 200 response and the operational status of each dependency: Document_Store, Search_Index, and Cache.
2. IF any dependency is unreachable, THEN THE API_Server SHALL report that dependency's status as `degraded` in the `/health` response and return an HTTP 503 status code.
3. THE API_Server SHALL emit structured JSON log entries for every inbound request, including: HTTP method, path, response status code, and request duration in milliseconds.
4. THE API_Server SHALL expose a `/metrics` endpoint providing request count, error rate, and extraction job queue depth in Prometheus exposition format.

---

### Requirement 10: Data Retention and Storage

**User Story:** As a system operator, I want document files and extracted data to be managed according to a configurable retention policy, so that storage costs remain predictable.

#### Acceptance Criteria

1. THE API_Server SHALL support a configurable retention period (in days) after which Documents and their associated extraction results are automatically deleted.
2. WHEN a Document reaches its retention expiry, THE API_Server SHALL delete the Document file, its metadata, extraction results, and Search_Index records within 24 hours of expiry.
3. THE API_Server SHALL store uploaded Document files in a configurable filesystem path or object storage location, not in the Document_Store directly.
4. THE Document_Store SHALL store only Document metadata, Job_Status, and extracted text; binary file content SHALL be stored separately per Requirement 10.3.
