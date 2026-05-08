import { useRef } from 'react';

function Btn({ children, onClick, title, danger, small }) {
  const base = {
    padding: small ? '5px 10px' : '6px 14px',
    borderRadius: 6,
    fontSize: small ? 12 : 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${danger ? '#7f1d1d' : '#334155'}`,
    background: '#1e293b',
    color: danger ? '#f87171' : '#94a3b8',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <button
      onClick={onClick}
      title={title}
      style={base}
      onMouseEnter={e => {
        e.currentTarget.style.background   = danger ? '#7f1d1d' : '#0f4c0f';
        e.currentTarget.style.color        = danger ? '#fca5a5' : '#00ff00';
        e.currentTarget.style.borderColor  = danger ? '#ef4444' : '#00ff00';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background   = base.background;
        e.currentTarget.style.color        = base.color;
        e.currentTarget.style.borderColor  = base.border;
      }}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ onClear, onExportJSON, onImportJSON, onExportPNG, darkMode, onToggleDark, isMobile }) {
  const importRef = useRef(null);

  const handleImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { onImportJSON(JSON.parse(ev.target.result)); }
      catch { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const linkStyle = {
    color: '#22c55e',
    fontSize: 13,
    textDecoration: 'none',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  };

  const titleStyle = {
    color: '#00ff00',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    fontSize: isMobile ? 13 : 14,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    textShadow: '0 0 10px rgba(0,255,0,0.4)',
    flexShrink: 0,
  };

  const darkBtn = (
    <button
      onClick={onToggleDark}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        padding: isMobile ? '5px 8px' : '4px 10px',
        borderRadius: 6,
        fontSize: 15,
        cursor: 'pointer',
        border: '1px solid #334155',
        background: '#1e293b',
        transition: 'background 0.15s, border-color 0.15s',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0f4c0f'; e.currentTarget.style.borderColor = '#00ff00'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; }}
    >
      {darkMode ? '☀️' : '🌙'}
    </button>
  );

  if (isMobile) {
    return (
      <div style={{
        background: '#020617',
        borderBottom: '1px solid #1e293b',
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Row 1: back + title + dark toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px' }}>
          <a href="/" style={linkStyle}>← Back</a>
          <span style={titleStyle}>Brainstorm</span>
          {darkBtn}
        </div>
        {/* Row 2: action buttons, scrollable */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '0 12px 8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}>
          <Btn onClick={onExportPNG}                       title="Export as PNG"  small>PNG</Btn>
          <Btn onClick={onExportJSON}                      title="Export JSON"    small>↓ JSON</Btn>
          <Btn onClick={() => importRef.current?.click()} title="Import JSON"    small>↑ JSON</Btn>
          <Btn onClick={onClear} danger                    title="Clear canvas"   small>Clear</Btn>
          <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: '#020617',
      borderBottom: '1px solid #1e293b',
      gap: 12,
      flexShrink: 0,
      zIndex: 10,
    }}>
      <a
        href="/"
        style={linkStyle}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
      >
        ← DaBingaBongo
      </a>

      <span style={titleStyle}>Brainstorm</span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn onClick={onExportPNG}                       title="Export canvas as PNG">PNG</Btn>
        <Btn onClick={onExportJSON}                      title="Export diagram as JSON">Export JSON</Btn>
        <Btn onClick={() => importRef.current?.click()} title="Import diagram from JSON">Import JSON</Btn>
        <Btn onClick={onClear} danger                    title="Clear entire canvas">Clear</Btn>
        <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
        {darkBtn}
      </div>
    </div>
  );
}
