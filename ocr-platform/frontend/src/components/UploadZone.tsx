import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, AlertTriangle, ArrowRight } from 'lucide-react';
import client from '../api/client';


interface FileProgress {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  docId?: string;
  jobId?: string;
}

export const UploadZone: React.FC = () => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileProgress[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll for active jobs
  useEffect(() => {
    const activeJobs = files.filter(f => f.status === 'uploading' || f.status === 'processing');
    if (activeJobs.length === 0) return;

    const timer = setInterval(async () => {
      const updatedFiles = [...files];
      let hasChanges = false;

      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        if ((file.status === 'uploading' || file.status === 'processing') && file.jobId) {
          try {
            const jobStatus = await client.getJobStatus(file.jobId);
            updatedFiles[i].status = jobStatus.status === 'completed' 
              ? 'completed' 
              : jobStatus.status === 'failed' 
                ? 'failed' 
                : 'processing';
            updatedFiles[i].progress = jobStatus.progress;
            if (jobStatus.error_message) {
              updatedFiles[i].error = jobStatus.error_message;
            }
            hasChanges = true;
          } catch (err: any) {
            console.error('Error polling job status:', err);
          }
        }
      }

      if (hasChanges) {
        setFiles(updatedFiles);
      }
    }, 1500);

    // Listen to custom mock-job-update event for instant UI feedback in demo mode
    const handleMockJobUpdate = (e: any) => {
      const { jobId } = e.detail;
      setFiles(prev => prev.map(f => {
        if (f.jobId === jobId) {
          // Fetch immediately to update
          client.getJobStatus(jobId).then(jobStatus => {
            setFiles(current => current.map(currFile => {
              if (currFile.jobId === jobId) {
                return {
                  ...currFile,
                  status: jobStatus.status === 'completed' 
                    ? 'completed' 
                    : jobStatus.status === 'failed' 
                      ? 'failed' 
                      : 'processing',
                  progress: jobStatus.progress,
                  error: jobStatus.error_message || undefined
                };
              }
              return currFile;
            }));
          });
        }
        return f;
      }));
    };

    window.addEventListener('mock-job-update', handleMockJobUpdate);

    return () => {
      clearInterval(timer);
      window.removeEventListener('mock-job-update', handleMockJobUpdate);
    };
  }, [files]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/bmp'
    ];
    const maxBytes = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type) && 
        !file.name.endsWith('.pdf') && 
        !file.name.endsWith('.png') && 
        !file.name.endsWith('.jpg') && 
        !file.name.endsWith('.jpeg') && 
        !file.name.endsWith('.tiff') && 
        !file.name.endsWith('.bmp')) {
      return `File type not supported. Please upload a PDF or image (PNG, JPEG, TIFF, BMP).`;
    }

    if (file.size > maxBytes) {
      return `File exceeds size limit of 50MB.`;
    }

    return null;
  };

  const handleFiles = async (fileList: FileList) => {
    setErrorMsg(null);
    const validFiles: File[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const error = validateFile(file);
      if (error) {
        setErrorMsg(error);
        return;
      }
      validFiles.push(file);
    }

    // Process files sequentially (or concurrently, but we'll show them)
    for (const file of validFiles) {
      const fileId = Math.random().toString(36).substr(2, 9);
      
      const newFileProgress: FileProgress = {
        id: fileId,
        name: file.name,
        size: file.size,
        progress: 10,
        status: 'uploading'
      };

      setFiles(prev => [newFileProgress, ...prev]);

      try {
        const { document, job } = await client.uploadDocument(file);
        
        setFiles(prev => prev.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'processing',
              progress: 20,
              docId: document.id,
              jobId: job.id
            };
          }
          return f;
        }));
      } catch (err: any) {
        setFiles(prev => prev.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'failed',
              error: err.message || 'Upload failed'
            };
          }
          return f;
        }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={containerStyle}>
      {/* Drag & Drop Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        style={{
          ...dropzoneStyle,
          ...(isDragging ? dropzoneActiveStyle : {})
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          style={{ display: 'none' }}
          accept=".pdf,image/png,image/jpeg,image/tiff,image/bmp"
          multiple
        />
        <div style={uploadIconContainerStyle}>
          <UploadCloud size={40} color={isDragging ? 'var(--primary-light)' : 'var(--text-secondary)'} />
        </div>
        <h3 style={dropzoneTitleStyle}>Drag &amp; drop document here</h3>
        <p style={dropzoneSubtitleStyle}>Supports PDF, PNG, JPEG, TIFF, BMP (up to 50MB)</p>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Browse Files
        </button>
      </div>

      {errorMsg && (
        <div style={errorBannerStyle} className="animate-fade-in">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* File List / Queue */}
      {files.length > 0 && (
        <div style={listContainerStyle}>
          <h4 style={listTitleStyle}>Processing Queue</h4>
          <div style={gridStyle}>
            {files.map(file => (
              <div key={file.id} className="glass-panel" style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={iconWrapperStyle}>
                    <FileText size={20} color="var(--primary-light)" />
                  </div>
                  <div style={cardInfoStyle}>
                    <div style={fileNameStyle} title={file.name}>{file.name}</div>
                    <div style={fileSizeStyle}>{formatSize(file.size)}</div>
                  </div>
                  
                  {/* Status Badge */}
                  <div>
                    {file.status === 'uploading' && (
                      <span className="badge badge-pending">Uploading</span>
                    )}
                    {file.status === 'processing' && (
                      <span className="badge badge-processing">OCR Processing</span>
                    )}
                    {file.status === 'completed' && (
                      <span className="badge badge-completed">Ready</span>
                    )}
                    {file.status === 'failed' && (
                      <span className="badge badge-failed">Failed</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {file.status !== 'completed' && file.status !== 'failed' && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={progressBarContainerStyle}>
                      <div 
                        style={{
                          ...progressBarFillStyle,
                          width: `${file.progress}%`
                        }}
                      />
                    </div>
                    <div style={progressLabelStyle}>{file.progress}% processed</div>
                  </div>
                )}

                {/* Completion CTA */}
                {file.status === 'completed' && file.docId && (
                  <div style={actionBlockStyle}>
                    <span style={completionTextStyle}>OCR successfully extracted bounding boxes.</span>
                    <button 
                      onClick={() => navigate(`/documents/${file.docId}`)}
                      className="btn btn-primary"
                      style={cardBtnStyle}
                    >
                      <span>Open Viewer</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Failure Banner */}
                {file.status === 'failed' && (
                  <div style={cardErrorBlockStyle}>
                    <AlertTriangle size={14} />
                    <span>{file.error || 'Failed during text extraction.'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Layout styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  width: '100%'
};

const dropzoneStyle: React.CSSProperties = {
  border: '2px dashed var(--border-color)',
  borderRadius: '16px',
  padding: '3rem 2rem',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '260px'
};

const dropzoneActiveStyle: React.CSSProperties = {
  borderColor: 'var(--primary)',
  backgroundColor: 'rgba(34, 197, 94, 0.05)',
  boxShadow: 'var(--shadow-glow)'
};

const uploadIconContainerStyle: React.CSSProperties = {
  width: '70px',
  height: '70px',
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '1rem'
};

const dropzoneTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  margin: '0 0 0.5rem 0'
};

const dropzoneSubtitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  margin: 0
};

const errorBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  borderRadius: '10px',
  color: 'var(--error)',
  fontSize: '0.9rem'
};

const listContainerStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  animation: 'fade-in 0.3s ease-out'
};

const listTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  marginBottom: '1rem',
  color: 'var(--text-secondary)'
};

const gridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1.25rem',
  backgroundColor: 'var(--bg-panel)'
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem'
};

const iconWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '42px',
  height: '42px',
  borderRadius: '10px',
  backgroundColor: 'rgba(34, 197, 94, 0.1)',
  flexShrink: 0
};

const cardInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0
};

const fileNameStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden'
};

const fileSizeStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-muted)'
};

const progressBarContainerStyle: React.CSSProperties = {
  height: '6px',
  width: '100%',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '3px',
  overflow: 'hidden'
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--primary)',
  backgroundImage: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
  borderRadius: '3px',
  transition: 'width 0.4s ease'
};

const progressLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  marginTop: '0.25rem',
  textAlign: 'right'
};

const actionBlockStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '1rem',
  paddingTop: '0.75rem',
  borderTop: '1px solid var(--border-color)',
  flexWrap: 'wrap',
  gap: '0.5rem'
};

const completionTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--success)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem'
};

const cardBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.8rem',
  borderRadius: '6px'
};

const cardErrorBlockStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginTop: '0.75rem',
  padding: '8px 12px',
  borderRadius: '6px',
  backgroundColor: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.15)',
  color: 'var(--error)',
  fontSize: '0.8rem'
};
