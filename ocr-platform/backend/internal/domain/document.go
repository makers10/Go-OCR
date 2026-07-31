package domain

import "time"

// Document represents an uploaded file in the OCR platform.
type Document struct {
	ID          string     `json:"id"`
	UserID      string     `json:"userId"`
	Filename    string     `json:"filename"`
	MimeType    string     `json:"mimeType"`
	FileSize    int64      `json:"fileSize"`
	StoragePath string     `json:"-"` // Internal use only
	PageCount   *int       `json:"pageCount,omitempty"`
	UploadedAt  time.Time  `json:"uploadedAt"`
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`
}
