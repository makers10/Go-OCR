import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { DocumentViewer } from '../components/DocumentViewer';
import client from '../api/client';
import type { Document, DocumentPage } from '../types';
import { ArrowLeft, Loader2, Calendar, HardDrive, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { apiMode } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialSearchQuery = searchParams.get('q') || '';

  const fetchDocumentDetail = async () => {
    if (!id) return;
    try {
      setError(null);
      
      const docData = await client.getDocument(id);
      setDocument(docData);
      
      const pagesData = await client.getDocumentPages(id);
      setPages(pagesData || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load document metadata');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDocumentDetail();
  }, [id, apiMode]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="main-content animate-fade-in">
      {/* Header breadcrumb row */}
      <div style={breadcrumbsRowStyle}>
        <button 
          onClick={() => navigate('/documents')} 
          style={backBtnStyle}
          className="btn btn-secondary"
        >
          <ArrowLeft size={16} />
          <span>Back to Library</span>
        </button>

        {document && (
          <div style={quickStatsRowStyle}>
            <div style={statTagStyle}>
              <Calendar size={14} color="var(--text-muted)" />
              <span>Uploaded: {formatDate(document.uploaded_at)}</span>
            </div>
            <div style={statTagStyle}>
              <HardDrive size={14} color="var(--text-muted)" />
              <span>Size: {formatSize(document.file_size)}</span>
            </div>
            <div style={{ ...statTagStyle, color: 'var(--success)' }}>
              <CheckCircle size={14} color="var(--success)" />
              <span>OCR Complete</span>
            </div>
          </div>
        )}
      </div>

      <Header title={document ? document.filename : 'Document Detail'} />

      {/* Main content viewport */}
      {loading ? (
        <div style={loaderStyle}>
          <Loader2 size={36} className="spinner" color="var(--primary)" />
          <span style={loaderTextStyle}>Reconstructing text overlays...</span>
        </div>
      ) : error ? (
        <div className="glass-panel" style={errorContainerStyle}>
          <h3>Unable to open viewer</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/documents')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Return to Library
          </button>
        </div>
      ) : document && pages.length > 0 ? (
        <DocumentViewer 
          document={document} 
          pages={pages} 
          initialSearchQuery={initialSearchQuery}
        />
      ) : (
        <div className="glass-panel" style={errorContainerStyle}>
          <h3>No layout records found</h3>
          <p>The document exists, but no OCR page overlays are available. Try reprocessing the document.</p>
        </div>
      )}
    </div>
  );
};

// Aesthetics page detailing
const breadcrumbsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1rem',
  flexWrap: 'wrap',
  gap: '1rem'
};

const backBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '6px 12px',
  fontSize: '0.8rem',
  borderRadius: '6px'
};

const quickStatsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap'
};

const statTagStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  padding: '4px 8px',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px'
};

const loaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8rem 2rem',
  gap: '1rem'
};

const loaderTextStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)'
};

const errorContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3rem 2rem',
  textAlign: 'center',
  backgroundColor: 'var(--bg-panel)'
};
