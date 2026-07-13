# Architectural Decision Records

## ADR-001: Switch from Tesseract to PaddleOCR

**Date:** 2026-07-11
**Status:** Accepted

### Context
The original architecture locked the OCR engine to Tesseract (via `gosseract`). However, we have observed that Tesseract struggles with complex document layouts, multi-language documents, and dense tables compared to modern deep-learning-based OCR engines. The product requirements have shifted to demand higher accuracy for these edge cases.

### Decision
We will replace Tesseract with **PaddleOCR**. 
Since PaddleOCR is a separate ecosystem (Python/C++ based), we will deploy it as a standalone independent Docker microservice. The Go OCR Worker will communicate with the PaddleOCR service via HTTP (or gRPC) to extract text and bounding boxes.

### Consequences
- **Pros:** Significantly improved OCR accuracy, better layout analysis, and better support for multi-language documents without retraining.
- **Cons:** Increases infrastructure complexity (requires an additional Docker service running Python/PaddlePaddle instead of a simple binary call).
- **Implementation:** The `BLUEPRINT.md` and `Architecture.md` have been updated to reflect this new service dependency. The Go OCR Worker will no longer use `gosseract` but will instead make a network call to the local PaddleOCR service.
