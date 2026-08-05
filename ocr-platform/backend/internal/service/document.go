package service

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/ocr-platform/backend/internal/domain"
)

var (
	ErrDocumentNotFound = errors.New("document not found")
	ErrUnauthorized     = errors.New("unauthorized access to document")
)

type DocumentService struct {
	docRepo DocumentRepository
	jobRepo JobRepository
	storage Storage
	queue   Queue
}

func NewDocumentService(docRepo DocumentRepository, jobRepo JobRepository, storage Storage, queue Queue) *DocumentService {
	return &DocumentService{
		docRepo: docRepo,
		jobRepo: jobRepo,
		storage: storage,
		queue:   queue,
	}
}

func (s *DocumentService) Upload(ctx context.Context, userID, filename, mimeType string, size int64, file io.Reader) (*domain.Document, error) {
	// 1. Save file to storage
	path, err := s.storage.Save(ctx, filename, file)
	if err != nil {
		return nil, err
	}

	// 2. Create document metadata
	doc := &domain.Document{
		UserID:      userID,
		Filename:    filename,
		MimeType:    mimeType,
		FileSize:    size,
		StoragePath: path,
		UploadedAt:  time.Now(),
	}
	if err := s.docRepo.Create(ctx, doc); err != nil {
		// Attempt to cleanup file if db insert fails
		_ = s.storage.Delete(ctx, path)
		return nil, err
	}

	// 3. Create extraction job
	job := &domain.ExtractionJob{
		DocumentID: doc.ID,
		Status:     domain.JobStatusPending,
		CreatedAt:  time.Now(),
	}
	if err := s.jobRepo.Create(ctx, job); err != nil {
		return nil, err
	}

	// 4. Enqueue job
	if err := s.queue.EnqueueOCRJob(ctx, job.ID); err != nil {
		// Log error, but don't fail upload. Can be reprocessed.
	}

	return doc, nil
}

func (s *DocumentService) GetByID(ctx context.Context, id, userID string) (*domain.Document, error) {
	return s.docRepo.GetByID(ctx, id, userID)
}

func (s *DocumentService) List(ctx context.Context, userID string, page, size int) ([]domain.Document, int, error) {
	return s.docRepo.ListByUserID(ctx, userID, page, size)
}

func (s *DocumentService) Delete(ctx context.Context, id, userID string) error {
	doc, err := s.docRepo.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}

	// 1. Delete from storage
	if err := s.storage.Delete(ctx, doc.StoragePath); err != nil {
		// Log error, continue with DB deletion
	}

	// 2. Delete from DB (cascades to pages and jobs)
	return s.docRepo.Delete(ctx, id, userID)
}

func (s *DocumentService) Reprocess(ctx context.Context, id, userID string) error {
	doc, err := s.docRepo.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}

	job, err := s.jobRepo.GetByDocumentID(ctx, doc.ID)
	if err != nil {
		return err
	}

	if job.Status == domain.JobStatusProcessing {
		return errors.New("job is already processing")
	}

	// Reset job status
	if err := s.jobRepo.UpdateStatus(ctx, job.ID, domain.JobStatusPending, 0, nil); err != nil {
		return err
	}

	// Re-enqueue
	return s.queue.EnqueueOCRJob(ctx, job.ID)
}
