package domain

import "time"

// BoundingBox represents the coordinates and text recognized by the OCR engine.
type BoundingBox struct {
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
}

// DocumentPage represents the OCR results for a single page of a Document.
type DocumentPage struct {
	ID            string        `json:"id"`
	DocumentID    string        `json:"documentId"`
	PageNumber    int           `json:"pageNumber"`
	TextContent   string        `json:"textContent"`
	BoundingBoxes []BoundingBox `json:"boundingBoxes"`
	ExtractedAt   time.Time     `json:"extractedAt"`
}
