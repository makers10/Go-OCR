package domain

import "time"

// SearchResult represents a single hit from the OpenSearch full-text search.
type SearchResult struct {
	DocumentID string    `json:"documentId"`
	UserID     string    `json:"userId"`
	Filename   string    `json:"filename"`
	PageNumber int       `json:"pageNumber"`
	Snippet    string    `json:"snippet"` // Highlighted text matching the query
	UploadedAt time.Time `json:"uploadedAt"`
}

// PaginatedSearchResults represents a page of search results.
type PaginatedSearchResults struct {
	Items      []SearchResult `json:"items"`
	TotalHits  int            `json:"totalHits"`
	Page       int            `json:"page"`
	Size       int            `json:"size"`
	TotalPages int            `json:"totalPages"`
}
