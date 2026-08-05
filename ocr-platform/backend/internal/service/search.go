package service

import (
	"context"

	"github.com/ocr-platform/backend/internal/domain"
)

type SearchService struct {
	searchRepo SearchRepository
}

func NewSearchService(searchRepo SearchRepository) *SearchService {
	return &SearchService{
		searchRepo: searchRepo,
	}
}

func (s *SearchService) Search(ctx context.Context, userID, query string, page, size int) (*domain.PaginatedSearchResults, error) {
	if query == "" {
		return &domain.PaginatedSearchResults{
			Items:      []domain.SearchResult{},
			TotalHits:  0,
			Page:       page,
			Size:       size,
			TotalPages: 0,
		}, nil
	}
	return s.searchRepo.Search(ctx, userID, query, page, size)
}
