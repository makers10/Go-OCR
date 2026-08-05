package service

import (
	"context"
	"io"

	"github.com/ocr-platform/backend/internal/domain"
)

// UserRepository handles user persistence
type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByID(ctx context.Context, id string) (*domain.User, error)
}

// DocumentRepository handles document metadata persistence
type DocumentRepository interface {
	Create(ctx context.Context, doc *domain.Document) error
	GetByID(ctx context.Context, id, userID string) (*domain.Document, error)
	ListByUserID(ctx context.Context, userID string, page, size int) ([]domain.Document, int, error)
	Delete(ctx context.Context, id, userID string) error
	UpdatePageCount(ctx context.Context, id string, count int) error
}

// JobRepository handles background job state
type JobRepository interface {
	Create(ctx context.Context, job *domain.ExtractionJob) error
	GetByID(ctx context.Context, id string) (*domain.ExtractionJob, error)
	GetByDocumentID(ctx context.Context, docID string) (*domain.ExtractionJob, error)
	UpdateStatus(ctx context.Context, id string, status domain.JobStatus, progress int, errMsg *string) error
}

// SearchRepository handles full-text search interactions
type SearchRepository interface {
	Search(ctx context.Context, userID, query string, page, size int) (*domain.PaginatedSearchResults, error)
	DeleteByDocumentID(ctx context.Context, documentID string) error
}

// Storage handles physical file persistence
type Storage interface {
	Save(ctx context.Context, filename string, r io.Reader) (string, error)
	Get(ctx context.Context, path string) (io.ReadCloser, error)
	Delete(ctx context.Context, path string) error
}

// Queue handles background task enqueuing
type Queue interface {
	EnqueueOCRJob(ctx context.Context, jobID string) error
}
