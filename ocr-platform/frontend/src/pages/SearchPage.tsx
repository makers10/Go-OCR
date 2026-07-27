import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import client from '../api/client';
import type { SearchResultItem } from '../types';
import { Search, FileText, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiMode } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Re-trigger search when mode switches if query is present
    if (query) {
      handleSearch();
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [apiMode]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await client.search(query, 1, 50);
      setResults(res.items || []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResultItem) => {
    navigate(`/documents/${result.document_id}?q=${encodeURIComponent(query)}`);
  };

  const highlightMatchText = (text: string, match: string) => {
    if (!match) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${match.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === match.toLowerCase() 
            ? <mark key={i} style={matchHighlightStyle}>{part}</mark> 
            : part
        )}
      </span>
    );
  };

  return (
    <div className="main-content animate-fade-in">
      <Header title="OCR Search" />

      {/* Global Search Bar */}
      <form onSubmit={handleSearch} style={searchBarFormStyle}>
        <div style={inputWrapperStyle} className="glass-panel">
          <Search size={22} color="var(--text-secondary)" style={searchIconStyle} />
          <input 
            type="text" 
            placeholder="Type query words (e.g. 'invoice', 'architecture', 'subtotal')..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={searchFieldStyle}
          />
          <button type="submit" className="btn btn-primary" style={submitBtnStyle}>
            Search Index
          </button>
        </div>
      </form>

      {/* Search results content */}
      {loading ? (
        <div style={loaderStyle}>
          <Loader2 size={32} className="spinner" color="var(--primary)" />
          <span style={loaderTextStyle}>Scanning OCR OpenSearch indexes...</span>
        </div>
      ) : hasSearched ? (
        <div style={resultsContainerStyle}>
          <div style={resultsHeaderStyle}>
            <Sparkles size={16} color="var(--primary-light)" />
            <span>
              Found {results.length} hit{results.length !== 1 ? 's' : ''} for "{query}"
            </span>
          </div>

          {results.length === 0 ? (
            <div className="glass-panel" style={noResultsStyle}>
              <h3>No matching text found</h3>
              <p>Try searching for words like "invoice", "architecture", "espresso" or "worker".</p>
            </div>
          ) : (
            <div style={resultsGridStyle}>
              {results.map((res, idx) => (
                <div 
                  key={idx} 
                  className="glass-panel glass-panel-interactive" 
                  style={resultCardStyle}
                  onClick={() => handleResultClick(res)}
                >
                  <div style={resultHeaderStyle}>
                    <div style={docIconWrapperStyle}>
                      <FileText size={18} color="var(--primary-light)" />
                    </div>
                    <div style={docInfoStyle}>
                      <h4 style={docTitleStyle}>{res.filename}</h4>
                      <span style={docMetaStyle}>Page {res.page_number}</span>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={jumpBtnStyle}
                    >
                      <span>Overlay Viewer</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <div style={snippetContainerStyle}>
                    <div style={snippetLabelStyle}>Matched context:</div>
                    <div style={snippetStyle}>
                      {res.snippets.map((snip, sIdx) => (
                        <p key={sIdx} style={snippetParagraphStyle}>
                          {highlightMatchText(snip, query)}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Empty Initial State Panel */
        <div className="glass-panel" style={placeholderStyle}>
          <div style={placeholderIconWrapperStyle}>
            <Search size={36} color="var(--text-muted)" />
          </div>
          <h3 style={placeholderTitleStyle}>Search Inside Scanned Text</h3>
          <p style={placeholderDescStyle}>
            Enter terms in the query box above to seek matching words across all OCR results. Bounding box regions on original files will highlight matching items.
          </p>
        </div>
      )}
    </div>
  );
};

// Aesthetics page query styling
const searchBarFormStyle: React.CSSProperties = {
  marginBottom: '2rem',
  width: '100%'
};

const inputWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px 6px 16px',
  backgroundColor: 'var(--bg-panel)',
  gap: '12px',
  borderRadius: '16px',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--shadow-lg)'
};

const searchIconStyle: React.CSSProperties = {
  flexShrink: 0
};

const searchFieldStyle: React.CSSProperties = {
  border: 'none',
  backgroundColor: 'transparent',
  padding: '12px 6px',
  fontSize: '1rem',
  outline: 'none',
  flex: 1,
  color: '#fff'
};

const submitBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: '0.9rem',
  borderRadius: '10px'
};

const loaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6rem 2rem',
  gap: '1rem'
};

const loaderTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)'
};

const resultsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem'
};

const resultsHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const noResultsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  textAlign: 'center',
  backgroundColor: 'var(--bg-panel)'
};

const resultsGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem'
};

const resultCardStyle: React.CSSProperties = {
  cursor: 'pointer',
  backgroundColor: 'var(--bg-panel)',
  padding: '1.25rem',
  transition: 'all 0.2s ease-in-out'
};

const resultHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '0.75rem',
  marginBottom: '0.75rem'
};

const docIconWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  backgroundColor: 'rgba(34, 197, 94, 0.08)'
};

const docInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0
};

const docTitleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  margin: '0 0 2px 0',
  color: 'var(--text-primary)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden'
};

const docMetaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  fontWeight: 500
};

const jumpBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.75rem',
  borderRadius: '6px',
  gap: '0.35rem',
  flexShrink: 0
};

const snippetContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem'
};

const snippetLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const snippetStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0,0,0,0.2)',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)'
};

const snippetParagraphStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  lineHeight: 1.5,
  color: 'var(--text-secondary)',
  margin: 0
};

const matchHighlightStyle: React.CSSProperties = {
  backgroundColor: 'rgba(245, 158, 11, 0.25)',
  color: '#f59e0b',
  fontWeight: 600,
  padding: '2px 4px',
  borderRadius: '4px',
  borderBottom: '1px solid rgba(245, 158, 11, 0.5)'
};

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  textAlign: 'center',
  backgroundColor: 'var(--bg-panel)'
};

const placeholderIconWrapperStyle: React.CSSProperties = {
  width: '72px',
  height: '72px',
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '1.25rem'
};

const placeholderTitleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  margin: '0 0 0.5rem 0'
};

const placeholderDescStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  maxWidth: '420px',
  margin: 0
};
