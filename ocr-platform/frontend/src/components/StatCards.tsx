import React from 'react';
import { Files, BookOpen, Activity } from 'lucide-react';

interface StatCardsProps {
  totalDocs: number;
  totalPages: number;
  processingCount: number;
}

export const StatCards: React.FC<StatCardsProps> = ({ totalDocs, totalPages, processingCount }) => {
  return (
    <div style={containerStyle}>
      {/* Total Documents Card */}
      <div className="glass-panel" style={cardStyle}>
        <div style={cardHeaderStyle}>
          <span style={titleStyle}>Total Library</span>
          <div style={{ ...iconWrapperStyle, backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
            <Files size={18} color="var(--primary-light)" />
          </div>
        </div>
        <div style={valueStyle}>{totalDocs}</div>
        <span style={labelStyle}>Documents stored</span>
      </div>

      {/* Total Extracted Pages Card */}
      <div className="glass-panel" style={cardStyle}>
        <div style={cardHeaderStyle}>
          <span style={titleStyle}>Extracted Pages</span>
          <div style={{ ...iconWrapperStyle, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <BookOpen size={18} color="var(--success)" />
          </div>
        </div>
        <div style={valueStyle}>{totalPages}</div>
        <span style={labelStyle}>Total scanned pages</span>
      </div>

      {/* Processing Status Card */}
      <div className="glass-panel" style={cardStyle}>
        <div style={cardHeaderStyle}>
          <span style={titleStyle}>Queue Status</span>
          <div style={{ 
            ...iconWrapperStyle, 
            backgroundColor: processingCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)' 
          }}>
            <Activity 
              size={18} 
              color={processingCount > 0 ? 'var(--warning)' : 'var(--text-secondary)'} 
              className={processingCount > 0 ? 'spinner' : ''}
            />
          </div>
        </div>
        <div style={valueStyle}>{processingCount}</div>
        <span style={labelStyle}>
          {processingCount > 0 ? 'Jobs in worker pipeline' : 'All jobs finished'}
        </span>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1.25rem',
  marginBottom: '2rem',
  width: '100%'
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1.25rem',
  position: 'relative',
  overflow: 'hidden'
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.75rem'
};

const titleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const iconWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '34px',
  borderRadius: '8px'
};

const valueStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  lineHeight: 1.1,
  color: '#fff',
  fontFamily: 'var(--font-heading)'
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginTop: '0.35rem'
};
