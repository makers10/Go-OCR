import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { StatCards } from '../components/StatCards';
import { DocumentCard } from '../components/DocumentCard';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import type { Document, ExtractionJob } from '../types';
import { Search, FileText, PlusCircle, AlertCircle } from 'lucide-react';

export const DocumentListPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiMode } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<Record<string, ExtractionJob>>({});
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const res = await client.getDocuments(1, 100);
      setDocuments(res.items || []);

      // Pull jobs matching active documents to track their progress
      const fetchedJobs: Record<string, ExtractionJob> = {};
      
      for (const doc of res.items || []) {
        if (doc.page_count === null) {
          try {
            // Find job for this doc. In demo/live, we check latest jobs
            // To keep it simple, we poll job statuses if the doc has no pages
            if (apiMode === 'demo') {
              const activeJob = (client as any).getMockDB?.().jobs.find((j: any) => j.document_id === doc.id);
              if (activeJob) {
                fetchedJobs[doc.id] = activeJob;
              }
            } else {
              // In live mode, we check jobs endpoint or documents details
              // Let's assume job details are populated dynamically
            }
          } catch (e) {
            console.error('Error fetching job for doc:', doc.id, e);
          }
        }
      }
      setJobs(prev => ({ ...prev, ...fetchedJobs }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch documents. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();

    // Listen to mode switch to re-fetch
    const handleModeSwitch = () => {
      setLoading(true);
      fetchDashboardData();
    };

    window.addEventListener('api-mode-change', handleModeSwitch);
    return () => {
      window.removeEventListener('api-mode-change', handleModeSwitch);
    };
  }, [apiMode]);

  // Periodic polling if there are any processing documents
  useEffect(() => {
    const incompleteDocs = documents.filter(d => d.page_count === null);
    if (incompleteDocs.length === 0) return;

    const timer = setInterval(() => {
      // Refresh list to update page counts
      fetchDashboardData();
    }, 3000);

    return () => clearInterval(timer);
  }, [documents]);

  const handleDelete = async (id: string) => {
    try {
      await client.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setJobs(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      const newJob = await client.reprocessDocument(id);
      setJobs(prev => ({
        ...prev,
        [id]: newJob
      }));
      // Instantly trigger list update
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger reprocessing');
    }
  };

  // Filtered documents list
  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Compute metrics
  const totalDocs = documents.length;
  const totalPages = documents.reduce((sum, doc) => sum + (doc.page_count || 0), 0);
  const processingCount = Object.values(jobs).filter(
    j => j.status === 'processing' || j.status === 'pending'
  ).length;

  return (
    <div className="main-content animate-fade-in">
      <Header title="My Documents" />

      {error && (
        <div style={errorContainerStyle}>
          <AlertCircle size={20} />
          <div style={errorTextContainerStyle}>
            <div style={errorTitleStyle}>Failed Connection State</div>
            <div style={errorDescStyle}>{error}</div>
          </div>
          <button onClick={fetchDashboardData} className="btn btn-secondary" style={retryBtnStyle}>
            Retry Link
          </button>
        </div>
      )}

      {/* Stats Counters */}
      <StatCards 
        totalDocs={totalDocs}
        totalPages={totalPages}
        processingCount={processingCount}
      />

      {/* Dashboard Sub-Header / Search Filters */}
      <div style={filterBarContainerStyle}>
        <div style={searchWrapperStyle}>
          <Search size={18} color="var(--text-muted)" style={searchIconStyle} />
          <input 
            type="text" 
            placeholder="Search filenames..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={searchFieldStyle}
          />
        </div>
        
        <button 
          onClick={() => navigate('/upload')} 
          className="btn btn-primary"
          style={addBtnStyle}
        >
          <PlusCircle size={16} />
          <span>Upload File</span>
        </button>
      </div>

      {/* Loading Overlay */}
      {loading ? (
        <div style={loaderContainerStyle}>
          <div className="spinner" style={spinnerStyle} />
          <span style={loaderTextStyle}>Reading OCR indexes...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        /* Empty State */
        <div className="glass-panel" style={emptyStateStyle}>
          <div style={emptyIconWrapperStyle}>
            <FileText size={32} color="var(--text-muted)" />
          </div>
          <h3 style={emptyTitleStyle}>Your library is empty</h3>
          <p style={emptyDescStyle}>
            {searchFilter 
              ? `No document matching "${searchFilter}" was found.` 
              : `Upload a PDF file or document scans to extract text structure.`}
          </p>
          {!searchFilter && (
            <button 
              onClick={() => navigate('/upload')} 
              className="btn btn-primary"
              style={{ marginTop: '1.25rem' }}
            >
              <span>Add First Document</span>
            </button>
          )}
        </div>
      ) : (
        /* Documents Grid */
        <div style={gridStyle}>
          {filteredDocs.map(doc => (
            <DocumentCard 
              key={doc.id}
              document={doc}
              job={jobs[doc.id]}
              onDelete={handleDelete}
              onReprocess={handleReprocess}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Styling components
const filterBarContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1.5rem',
  gap: '1rem',
  flexWrap: 'wrap'
};

const searchWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  maxWidth: '350px',
  width: '100%'
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  pointerEvents: 'none'
};

const searchFieldStyle: React.CSSProperties = {
  paddingLeft: '38px',
  fontSize: '0.85rem'
};

const addBtnStyle: React.CSSProperties = {
  gap: '0.5rem',
  padding: '0.65rem 1.25rem',
  fontSize: '0.85rem'
};

const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  gap: '1rem'
};

const spinnerStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  border: '3px solid rgba(34, 197, 94, 0.1)',
  borderTopColor: 'var(--primary)',
  borderRadius: '50%'
};

const loaderTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)'
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  textAlign: 'center',
  backgroundColor: 'var(--bg-panel)'
};

const emptyIconWrapperStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '16px',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '1.25rem'
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  margin: '0 0 0.5rem 0'
};

const emptyDescStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  maxWidth: '380px',
  margin: 0
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '1.25rem'
};

const errorContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem 1.25rem',
  backgroundColor: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.15)',
  borderRadius: '12px',
  color: 'var(--error)',
  marginBottom: '1.5rem',
  flexWrap: 'wrap'
};

const errorTextContainerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0
};

const errorTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.9rem'
};

const errorDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginTop: '2px'
};

const retryBtnStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '6px 12px',
  borderColor: 'rgba(239, 68, 68, 0.2)',
  color: 'var(--error)'
};
