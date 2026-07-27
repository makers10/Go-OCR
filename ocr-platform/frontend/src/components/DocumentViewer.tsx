import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, Sparkles } from 'lucide-react';
import type { Document, DocumentPage, BoundingBox } from '../types';

interface DocumentViewerProps {
  document: Document;
  pages: DocumentPage[];
  initialSearchQuery?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  pages,
  initialSearchQuery = ''
}) => {
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [hoveredBox, setHoveredBox] = useState<BoundingBox | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [flashingBoxText, setFlashingBoxText] = useState<string | null>(null);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageSheetRef = useRef<HTMLDivElement>(null);

  // Sync initial query
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  const currentPage = pages.find(p => p.page_number === currentPageNum) || pages[0];

  const handlePrevPage = () => {
    if (currentPageNum > 1) {
      setCurrentPageNum(currentPageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageNum < (document.page_count || pages.length)) {
      setCurrentPageNum(currentPageNum + 1);
    }
  };

  const handleZoomIn = () => {
    if (zoom < 200) setZoom(prev => prev + 25);
  };

  const handleZoomOut = () => {
    if (zoom > 50) setZoom(prev => prev - 25);
  };

  const handleBoxHover = (box: BoundingBox, e: React.MouseEvent) => {
    if (!pageSheetRef.current) return;
    const rect = pageSheetRef.current.getBoundingClientRect();
    
    // Relative position inside the page sheet
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 40 // shift slightly above the cursor
    });
    setHoveredBox(box);
  };

  const handleTextLineClick = (text: string) => {
    setFlashingBoxText(text);
    setTimeout(() => {
      setFlashingBoxText(null);
    }, 1500);
  };

  // Check if a box text matches the search query
  const isSearchMatch = (boxText: string): boolean => {
    if (!searchQuery.trim()) return false;
    const words = searchQuery.toLowerCase().trim().split(/\s+/);
    return words.some(w => boxText.toLowerCase().includes(w));
  };

  // Render mock visual lines on paper to represent original document content
  const renderMockDocumentContent = () => {
    if (!currentPage) return null;
    
    // Determine lines
    const boxes = currentPage.bounding_boxes || [];
    return (
      <div style={mockDocBackgroundStyle}>
        {/* Subtle grid pattern inside document sheet */}
        <div style={gridPatternStyle} />
        
        {/* Draw mock layout panels representing visual lines */}
        {boxes.map((box, idx) => (
          <div
            key={`content-${idx}`}
            style={{
              position: 'absolute',
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
              borderBottom: '1px dashed rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: '2px',
              fontFamily: 'sans-serif',
              fontSize: '11px',
              color: 'rgba(0, 0, 0, 0.4)',
              userSelect: 'none',
              overflow: 'hidden',
              pointerEvents: 'none'
            }}
          >
            {box.text}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={mainLayoutGridStyle}>
      {/* LEFT COLUMN: Viewer Frame */}
      <div className="glass-panel" style={viewerFrameStyle}>
        {/* Controls Toolbar */}
        <div style={toolbarStyle}>
          <div style={navControlsStyle}>
            <button 
              onClick={handlePrevPage} 
              className="btn btn-secondary" 
              style={controlBtnStyle}
              disabled={currentPageNum === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={pageIndicatorStyle}>
              Page {currentPageNum} of {document.page_count || pages.length || 1}
            </span>
            <button 
              onClick={handleNextPage} 
              className="btn btn-secondary" 
              style={controlBtnStyle}
              disabled={currentPageNum === (document.page_count || pages.length)}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={zoomControlsStyle}>
            <button onClick={handleZoomOut} className="btn btn-secondary" style={controlBtnStyle} disabled={zoom <= 50}>
              <ZoomOut size={14} />
            </button>
            <span style={zoomLevelStyle}>{zoom}%</span>
            <button onClick={handleZoomIn} className="btn btn-secondary" style={controlBtnStyle} disabled={zoom >= 200}>
              <ZoomIn size={14} />
            </button>
          </div>
        </div>

        {/* Viewport container */}
        <div ref={viewportRef} style={viewportStyle}>
          {currentPage ? (
            <div 
              ref={pageSheetRef}
              style={pageSheetStyle(zoom)}
            >
              {/* Mock PDF background representing scanned paper */}
              {renderMockDocumentContent()}

              {/* Bounding box overlays */}
              {(currentPage.bounding_boxes || []).map((box, idx) => {
                const matches = isSearchMatch(box.text);
                const isFlashing = flashingBoxText && box.text.includes(flashingBoxText);
                
                return (
                  <div
                    key={`overlay-${idx}`}
                    className={`ocr-overlay-box ${matches ? 'search-match' : ''}`}
                    onMouseEnter={(e) => handleBoxHover(box, e)}
                    onMouseMove={(e) => handleBoxHover(box, e)}
                    onMouseLeave={() => setHoveredBox(null)}
                    style={{
                      left: `${box.x}px`,
                      top: `${box.y}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                      ...(isFlashing ? flashOverlayStyle : {})
                    }}
                  />
                );
              })}

              {/* Hover Tooltip */}
              {hoveredBox && (
                <div 
                  className="ocr-tooltip"
                  style={{
                    left: `${tooltipPos.x}px`,
                    top: `${tooltipPos.y}px`
                  }}
                >
                  <div style={tooltipTextStyle}>"{hoveredBox.text}"</div>
                  <div style={tooltipMetaStyle}>Confidence: {hoveredBox.confidence}%</div>
                </div>
              )}
            </div>
          ) : (
            <div style={noDataStyle}>
              <span>Document is processing or has no pages.</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: OCR Text Content Inspector */}
      <div className="glass-panel" style={inspectorPanelStyle}>
        <h3 style={inspectorTitleStyle}>
          <Sparkles size={16} color="var(--primary-light)" />
          <span>Extracted Metadata &amp; OCR text</span>
        </h3>

        {/* Local Search input */}
        <div style={searchBoxStyle}>
          <Search size={16} color="var(--text-muted)" style={{ marginLeft: '10px' }} />
          <input 
            type="text" 
            placeholder="Filter text highlights..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchFieldStyle}
          />
        </div>

        {/* Scanned content readout */}
        {currentPage ? (
          <div style={textReadoutContainerStyle}>
            <div style={sectionLabelStyle}>Raw OCR Output (Page {currentPageNum})</div>
            <div style={textBoxStyle}>
              {currentPage.text_content.split('. ').map((sentence, sIdx) => {
                if (!sentence.trim()) return null;
                const matchesFilter = searchQuery.trim() !== '' && 
                  sentence.toLowerCase().includes(searchQuery.toLowerCase());
                
                return (
                  <span 
                    key={sIdx}
                    onClick={() => handleTextLineClick(sentence.substring(0, 15))}
                    style={{
                      ...sentenceStyle,
                      ...(matchesFilter ? sentenceHighlightStyle : {})
                    }}
                    title="Click to highlight on paper"
                  >
                    {sentence}.{' '}
                  </span>
                );
              })}
            </div>
            
            <div style={confidenceRatingContainerStyle}>
              <div style={confidenceHeaderStyle}>
                <span>OCR Accuracy index</span>
                <span>
                  {Math.round(
                    (currentPage.bounding_boxes || []).reduce((acc, curr) => acc + curr.confidence, 0) / 
                    ((currentPage.bounding_boxes || []).length || 1)
                  )}%
                </span>
              </div>
              <div style={accuracyBarContainerStyle}>
                <div 
                  style={{
                    ...accuracyBarFillStyle,
                    width: `${Math.round(
                      (currentPage.bounding_boxes || []).reduce((acc, curr) => acc + curr.confidence, 0) / 
                      ((currentPage.bounding_boxes || []).length || 1)
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={noDataStyle}>
            <span>No text loaded.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Styling components
const mainLayoutGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3fr 2fr',
  gap: '1.5rem',
  alignItems: 'stretch',
  minHeight: '620px',
  width: '100%'
};

const viewerFrameStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1.25rem',
  backgroundColor: 'var(--bg-panel)',
  minHeight: '600px'
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '0.75rem',
  borderBottom: '1px solid var(--border-color)',
  marginBottom: '1rem',
  flexWrap: 'wrap',
  gap: '0.5rem'
};

const navControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem'
};

const controlBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px'
};

const pageIndicatorStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  fontWeight: 500
};

const zoomControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const zoomLevelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  width: '40px',
  textAlign: 'center',
  fontWeight: 600
};

const viewportStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#0a0b10',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'auto',
  padding: '2rem',
  maxHeight: '650px',
  position: 'relative'
};

const pageSheetStyle = (zoom: number): React.CSSProperties => {
  const scale = zoom / 100;
  return {
    width: '600px',
    height: '800px',
    backgroundColor: '#ffffff',
    position: 'relative',
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    flexShrink: 0,
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '4px'
  };
};

const mockDocBackgroundStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  overflow: 'hidden'
};

const gridPatternStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: 0.03,
  backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
  backgroundSize: '24px 24px'
};

const flashOverlayStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.4)',
  borderColor: '#ef4444',
  animation: 'pulse-glow 0.5s infinite alternate',
  zIndex: 20
};

const tooltipTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600
};

const tooltipMetaStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#a5b4fc',
  marginTop: '2px'
};

const inspectorPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1.5rem',
  backgroundColor: 'var(--bg-panel)'
};

const inspectorTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '1.1rem',
  marginBottom: '1rem',
  marginTop: 0
};

const searchBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  marginBottom: '1.25rem',
  overflow: 'hidden'
};

const searchFieldStyle: React.CSSProperties = {
  border: 'none',
  backgroundColor: 'transparent',
  padding: '10px 12px 10px 8px',
  outline: 'none',
  fontSize: '0.85rem'
};

const textReadoutContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  flex: 1
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const textBoxStyle: React.CSSProperties = {
  padding: '1rem',
  borderRadius: '8px',
  backgroundColor: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid var(--border-color)',
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
  flex: 1,
  overflowY: 'auto',
  maxHeight: '380px',
  fontFamily: 'var(--font-sans)'
};

const sentenceStyle: React.CSSProperties = {
  cursor: 'pointer',
  borderRadius: '2px',
  padding: '1px 2px',
  transition: 'background-color 0.15s ease'
};

const sentenceHighlightStyle: React.CSSProperties = {
  backgroundColor: 'rgba(245, 158, 11, 0.2)',
  color: '#f59e0b',
  fontWeight: 500,
  borderBottom: '1px solid rgba(245, 158, 11, 0.4)'
};

const confidenceRatingContainerStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: '1rem',
  borderTop: '1px solid var(--border-color)'
};

const confidenceHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '0.5rem'
};

const accuracyBarContainerStyle: React.CSSProperties = {
  height: '6px',
  width: '100%',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '3px',
  overflow: 'hidden'
};

const accuracyBarFillStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--success)',
  borderRadius: '3px'
};

const noDataStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  textAlign: 'center'
};
