import React from 'react';

interface OcrLogoProps {
  size?: number;
}

/**
 * Custom SVG logo for DigitalOCR – a document page with a scan beam,
 * inspired by the reference image (scanner processing documents).
 */
export const OcrLogo: React.FC<OcrLogoProps> = ({ size = 24 }) => {
  const scale = size / 24;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Document page */}
      <rect x="4" y="2" width="12" height="16" rx="2" fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth="1.5" />
      {/* Text lines on document */}
      <line x1="7" y1="6" x2="13" y2="6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="9" x2="11" y2="9" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="13" y2="12" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Scan beam – green horizontal laser line */}
      <line x1="3" y1="14" x2="17" y2="14" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      {/* Scan glow */}
      <line x1="3" y1="14" x2="17" y2="14" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" opacity="0.25" />
      {/* Scanner bracket corners (bottom-right) */}
      <path d="M17 18 L21 18 L21 22" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 22 L21 22" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      {/* Scanner bracket corners (top-right) */}
      <path d="M21 8 L21 4 L17 4" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
};
