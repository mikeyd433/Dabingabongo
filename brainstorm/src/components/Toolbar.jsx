import { useRef } from 'react';

const btnBase = {
  padding: '6px 14px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#94a3b8',
  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  fontFamily: 'Inter, sans-serif',
  whiteSpace: 'nowrap',
};

const btnHover = {
  background: '#0f4c0f',
  color: '#00ff00',
  borderColor: '#00ff00',
};

function Btn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...btnBase,
        ...(danger ? { borderColor: '#7f1d1d', color: '#f87171' } : {}),
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? '#7f1d1d' : '#0f4c0f';
        e.currentTarget.style.color      = danger ? '#fca5a5' : '#00ff00';
        e.currentTarget.style.borderColor = danger ? '#ef4444' : '#00ff00';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background  = btnBase.background;
        e.currentTarget.style.color       = danger ? '#f87171' : btnBase.color;
        e.currentTarget.style.borderColor  = danger ? '#7f1d1d' : btnBase.border;
      }}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ onClear, onExportJSON, onImportJSON, onExportPNG, darkMode, onToggleDark }) {
  const importRef = useRef(null);

  const handleImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        onImportJSON(data);
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
        style={{ color: '#22c55e', fontSize: 13, textDecoration: 'none', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
      >
        ← DaBingaBongo
      </a>

      <span style={{
        color: '#00ff00',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: 14,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        textShadow: '0 0 10px rgba(0,255,0,0.4)',
      }}>
        Brainstorm
      </span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={onExportPNG}  title="Export canvas as PNG">PNG</Btn>
        <Btn onClick={onExportJSON} title="Export diagram as JSON">Export JSON</Btn>
        <Btn onClick={() => importRef.current?.click()} title="Import diagram from JSON">Import JSON</Btn>
        <Btn onClick={onClear} danger title="Clear entire canvas">Clear</Btn>
        <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />

        <button
          onClick={onToggleDark}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ ...btnBase, fontSize: 15, padding: '4px 10px' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#0f4c0f'; e.currentTarget.style.borderColor = '#00ff00'; }}
          onMouseLeave={e => { e.currentTarget.style.background = btnBase.background; e.currentTarget.style.borderColor = btnBase.border; }}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
