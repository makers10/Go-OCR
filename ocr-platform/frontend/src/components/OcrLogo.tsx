import React from 'react';

interface OcrLogoProps {
  size?: number;
}

/**
 * Custom SVG logo for DigitalOCR — a document page with a scan beam
 * and focus-bracket corners. Uses refined blue tones for a premium feel.
 */
export const OcrLogo: React.FC<OcrLogoProps> = ({ size = 24 }) => {
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
      <rect x="4" y="2" width="12" height="16" rx="2" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
      {/* Text lines on document */}
      <line x1="7" y1="6" x2="13" y2="6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="9" x2="11" y2="9" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="13" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Scan beam — soft blue horizontal laser */}
      <line x1="3" y1="14" x2="17" y2="14" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      <line x1="3" y1="14" x2="17" y2="14" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" opacity="0.15" />
      {/* Focus bracket — bottom-right corner */}
      <path d="M17 18 L21 18 L21 22" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Focus bracket — top-right corner */}
      <path d="M21 8 L21 4 L17 4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
