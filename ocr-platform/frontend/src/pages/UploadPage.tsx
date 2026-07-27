import React from 'react';
import { Header } from '../components/Header';
import { UploadZone } from '../components/UploadZone';

export const UploadPage: React.FC = () => {
  return (
    <div className="main-content animate-fade-in">
      <Header title="Upload Document" />
      
      <div style={contentLayoutStyle}>
        <div style={infoBoxStyle} className="glass-panel">
          <h3 style={infoTitleStyle}>OCR Engine Details</h3>
          <p style={infoDescStyle}>
            Uploaded files are dispatched to the background job worker. PDFs are rendered to page images, then analyzed via the PaddleOCR service to map bounding coordinates for each word. Results are saved to SQL and indexed inside OpenSearch for rapid querying.
          </p>
        </div>

        <UploadZone />
      </div>
    </div>
  );
};

const contentLayoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  width: '100%'
};

const infoBoxStyle: React.CSSProperties = {
  padding: '1.25rem',
  backgroundColor: 'rgba(34, 197, 94, 0.03)',
  borderColor: 'rgba(34, 197, 94, 0.15)'
};

const infoTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  margin: '0 0 0.5rem 0',
  color: 'var(--primary-light)'
};

const infoDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  margin: 0,
  lineHeight: 1.5
};
