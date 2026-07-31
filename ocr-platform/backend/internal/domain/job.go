package domain

import "time"

// JobStatus represents the current state of an extraction job.
type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusProcessing JobStatus = "processing"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
)

// ExtractionJob represents a background task to run OCR on a Document.
type ExtractionJob struct {
	ID           string     `json:"id"`
	DocumentID   string     `json:"documentId"`
	Status       JobStatus  `json:"status"`
	Progress     int        `json:"progress"` // 0 to 100
	ErrorMessage *string    `json:"errorMessage,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	StartedAt    *time.Time `json:"startedAt,omitempty"`
	CompletedAt  *time.Time `json:"completedAt,omitempty"`
}
