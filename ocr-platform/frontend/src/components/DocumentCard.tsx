import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, RefreshCw, Eye } from 'lucide-react';
import type { Document, ExtractionJob } from '../types';

interface DocumentCardProps {
  document: Document;
  job?: ExtractionJob;
  onDelete: (id: string) => Promise<void>;
  onReprocess: (id: string) => Promise<void>;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  job,
  onDelete,
  onReprocess
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Status mapping
  const status = job ? job.status : (document.page_count !== null ? 'completed' : 'pending');
  const progress = job ? job.progress : (status === 'completed' ? 100 : 0);

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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(document.id);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      await onReprocess(document.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <div className="glass-panel glass-panel-interactive" style={cardStyle}>
      {/* File Header */}
      <div style={headerStyle}>
        <div style={iconContainerStyle}>
          <FileText size={20} color="var(--primary-light)" />
        </div>
        <div style={titleSectionStyle}>
          <h4 style={filenameStyle} title={document.filename}>
            {document.filename}
          </h4>
          <span style={dateStyle}>{formatDate(document.uploaded_at)}</span>
        </div>
      </div>

      {/* Metadata Detail Row */}
      <div style={metadataStyle}>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>File Size</span>
          <span style={metaValStyle}>{formatSize(document.file_size)}</span>
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Format</span>
          <span style={metaValStyle}>{document.mime_type.split('/')[1]?.toUpperCase() || 'RAW'}</span>
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Pages</span>
          <span style={metaValStyle}>
            {document.page_count !== null ? document.page_count : '—'}
          </span>
        </div>
      </div>

      {/* Status Bar */}
      <div style={statusSectionStyle}>
        <div style={statusLabelStyle}>
          <span>Extraction Status</span>
          
          {/* Progress Bar Label */}
          {status === 'processing' && (
            <span style={progressLabelStyle}>{progress}%</span>
          )}
        </div>

        <div style={badgeContainerStyle}>
          {status === 'pending' && (
            <span className="badge badge-pending">Pending</span>
          )}
          {status === 'processing' && (
            <span className="badge badge-processing">Processing</span>
          )}
          {status === 'completed' && (
            <span className="badge badge-completed">Ready</span>
          )}
          {status === 'failed' && (
            <span className="badge badge-failed">Failed</span>
          )}
        </div>

        {/* Inline Progress Bar */}
        {(status === 'processing' || status === 'pending') && (
          <div style={progressContainerStyle}>
            <div 
              style={{
                ...progressFillStyle,
                width: `${progress}%`
              }}
            />
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={footerStyle}>
        {showConfirmDelete ? (
          <div style={confirmContainerStyle}>
            <span style={confirmTextStyle}>Delete file permanently?</span>
            <div style={confirmActionsStyle}>
              <button 
                onClick={() => setShowConfirmDelete(false)} 
                className="btn btn-secondary" 
                style={confirmBtnStyle}
                disabled={isDeleting}
              >
                No
              </button>
              <button 
                onClick={handleDelete} 
                className="btn btn-danger" 
                style={{ ...confirmBtnStyle, background: 'var(--error)' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={leftActionsStyle}>
              {status === 'failed' && (
                <button 
                  onClick={handleReprocess} 
                  className="btn btn-secondary" 
                  style={actionBtnStyle}
                  title="Reprocess OCR job"
                  disabled={isReprocessing}
                >
                  <RefreshCw size={14} className={isReprocessing ? 'spinner' : ''} />
                  <span>Reprocess</span>
                </button>
              )}

              {status === 'completed' && (
                <button 
                  onClick={() => navigate(`/documents/${document.id}`)} 
                  className="btn btn-primary" 
                  style={{ ...actionBtnStyle, padding: '0.5rem 1rem' }}
                >
                  <Eye size={14} />
                  <span>Open</span>
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowConfirmDelete(true)} 
              className="btn btn-secondary" 
              style={deleteBtnStyle}
              title="Delete Document"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  justifyContent: 'space-between',
  minHeight: '220px',
  padding: '1.25rem',
  backgroundColor: 'var(--bg-panel)'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  marginBottom: '1rem'
};

const iconContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '38px',
  height: '38px',
  borderRadius: '8px',
  backgroundColor: 'rgba(59, 130, 246, 0.08)',
  flexShrink: 0
};

const titleSectionStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1
};

const filenameStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  margin: '0 0 2px 0',
  color: 'var(--text-primary)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden'
};

const dateStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)'
};

const metadataStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.5rem',
  padding: '0.75rem',
  borderRadius: '8px',
  backgroundColor: 'rgba(0, 0, 0, 0.15)',
  marginBottom: '1rem'
};

const metaItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center'
};

const metaLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.02em'
};

const metaValStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginTop: '2px'
};

const statusSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  marginBottom: '1.25rem'
};

const statusLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.75rem',
  color: 'var(--text-secondary)'
};

const progressLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--primary-light)'
};

const badgeContainerStyle: React.CSSProperties = {
  display: 'flex'
};

const progressContainerStyle: React.CSSProperties = {
  height: '4px',
  width: '100%',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '2px',
  marginTop: '0.25rem',
  overflow: 'hidden'
};

const progressFillStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--primary)',
  borderRadius: '2px',
  transition: 'width 0.3s ease'
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '0.75rem',
  marginTop: 'auto',
  minHeight: '45px'
};

const leftActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.8rem',
  borderRadius: '6px',
  gap: '0.35rem'
};

const deleteBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  color: 'var(--text-muted)',
  backgroundColor: 'transparent',
  border: '1px solid transparent',
  transition: 'all 0.15s ease'
};

const confirmContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  gap: '0.5rem',
  flexWrap: 'wrap'
};

const confirmTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--error)',
  fontWeight: 500
};

const confirmActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem'
};

const confirmBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '0.7rem',
  borderRadius: '4px'
};
