package service

import (
	"context"

	"github.com/ocr-platform/backend/internal/domain"
)

type JobService struct {
	jobRepo JobRepository
	docRepo DocumentRepository
}

func NewJobService(jobRepo JobRepository, docRepo DocumentRepository) *JobService {
	return &JobService{
		jobRepo: jobRepo,
		docRepo: docRepo,
	}
}

func (s *JobService) GetJob(ctx context.Context, jobID, userID string) (*domain.ExtractionJob, error) {
	job, err := s.jobRepo.GetByID(ctx, jobID)
	if err != nil {
		return nil, err
	}

	// Authorize access by checking the document owner
	_, err = s.docRepo.GetByID(ctx, job.DocumentID, userID)
	if err != nil {
		return nil, err
	}

	return job, nil
}
