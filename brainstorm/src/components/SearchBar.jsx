import { useEffect, useRef } from 'react';

const navBtn = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 5px',
  borderRadius: 4,
  lineHeight: 1,
  fontFamily: 'Inter, sans-serif',
};

export default function SearchBar({ query, onChange, matchCount, currentIndex, onNext, onPrev, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev(); else onNext();
    }
    // Escape bubbles to the document-level handler in App.jsx
  };

  const hasMatches = matchCount > 0;
  const countText = query.trim()
    ? (hasMatches ? `${currentIndex + 1} / ${matchCount}` : 'No matches')
    : '';

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#020617',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '7px 10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <span style={{ color: '#475569', fontSize: 13, lineHeight: 1, flexShrink: 0 }}>Find:</span>
      <input
        ref={inputRef}
        value={query}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search nodes…"
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#e2e8f0',
          fontSize: 13,
          fontFamily: 'Inter, sans-serif',
          width: 160,
        }}
      />
      {countText && (
        <span style={{
          color: hasMatches ? '#64748b' : '#ef4444',
          fontSize: 12,
          minWidth: 54,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {countText}
        </span>
      )}
      {hasMatches && (
        <>
          <button onClick={onPrev} title="Previous match (Shift+Enter)" style={navBtn}>▲</button>
          <button onClick={onNext} title="Next match (Enter)"           style={navBtn}>▼</button>
        </>
      )}
      <button
        onClick={onClose}
        title="Close (Esc)"
        style={{ ...navBtn, color: '#475569', marginLeft: 2 }}
      >
        ✕
      </button>
    </div>
  );
}
