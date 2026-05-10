import { useRef } from 'react';

function Btn({ children, onClick, title, danger, small, disabled, active }) {
  const base = {
    padding: small ? '5px 10px' : '6px 14px',
    borderRadius: 6,
    fontSize: small ? 12 : 13,
    fontWeight: 500,
    cursor: disabled ? 'default' : 'pointer',
    border: `1px solid ${active ? '#00ff00' : danger ? '#7f1d1d' : '#334155'}`,
    background: active ? '#0f4c0f' : '#1e293b',
    color: disabled ? '#334155' : active ? '#00ff00' : danger ? '#f87171' : '#94a3b8',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    opacity: disabled ? 0.45 : 1,
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={base}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background  = danger ? '#7f1d1d' : '#0f4c0f';
        e.currentTarget.style.color       = danger ? '#fca5a5' : '#00ff00';
        e.currentTarget.style.borderColor = danger ? '#ef4444' : '#00ff00';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background  = base.background;
        e.currentTarget.style.color       = base.color;
        e.currentTarget.style.borderColor = base.border;
      }}
    >
      {children}
    </button>
  );
}

// Small token-status dot + manage-token button
function TokenBtn({ hasToken, onManageToken, small }) {
  return (
    <button
      onClick={onManageToken}
      title={hasToken ? 'GitHub token set · click to manage' : 'No GitHub token — click to add one'}
      style={{
        padding: small ? '5px 8px' : '5px 10px',
        borderRadius: 6,
        fontSize: small ? 11 : 12,
        cursor: 'pointer',
        border: `1px solid ${hasToken ? '#166534' : '#334155'}`,
        background: hasToken ? '#0f2d1a' : '#1e293b',
        color: hasToken ? '#22c55e' : '#64748b',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
        touchAction: 'manipulation',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff00'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = hasToken ? '#166534' : '#334155'; }}
    >
      <span style={{ fontSize: 9, lineHeight: 1, borderRadius: '50%', width: 7, height: 7, background: hasToken ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
      🔑
    </button>
  );
}

export default function Toolbar({
  onClear, onExportJSON, onImportJSON, onImportSVG, onExportPNG,
  onUndo, onRedo, canUndo, canRedo,
  darkMode, onToggleDark, isMobile,
  mobileSelectMode, onToggleMobileSelect,
  onDeleteSelected, onShare,
  onSaveGist, onLoadGist, onManageToken, hasGistToken, gistUrl, isSavingGist,
}) {
  const importJsonRef = useRef(null);
  const importSvgRef  = useRef(null);

  const handleImportJson = e => {
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

  const handleImportSvg = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { onImportSVG(ev.target.result); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const linkStyle = {
    color: '#22c55e', fontSize: 13, textDecoration: 'none',
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
  };

  const titleStyle = {
    color: '#00ff00', fontFamily: 'Inter, sans-serif', fontWeight: 600,
    fontSize: isMobile ? 13 : 14, letterSpacing: '0.15em', textTransform: 'uppercase',
    textShadow: '0 0 10px rgba(0,255,0,0.4)', flexShrink: 0,
  };

  const darkBtn = (
    <button
      onClick={onToggleDark}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        padding: isMobile ? '5px 8px' : '4px 10px', borderRadius: 6, fontSize: 15,
        cursor: 'pointer', border: '1px solid #334155', background: '#1e293b',
        transition: 'background 0.15s, border-color 0.15s',
        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0f4c0f'; e.currentTarget.style.borderColor = '#00ff00'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; }}
    >
      {darkMode ? '☀️' : '🌙'}
    </button>
  );

  if (isMobile) {
    return (
      <div style={{ background: '#020617', borderBottom: '1px solid #1e293b', flexShrink: 0, zIndex: 10 }}>
        {/* Row 1: back + title + dark toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px' }}>
          <a href="/" style={linkStyle}>← Back</a>
          <span style={titleStyle}>Brainstorm</span>
          {darkBtn}
        </div>
        {/* Row 2: action buttons, scrollable */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <Btn onClick={onUndo} title="Undo (Ctrl+Z)" small disabled={!canUndo}>↩</Btn>
          <Btn onClick={onRedo} title="Redo (Ctrl+Y)" small disabled={!canRedo}>↪</Btn>
          <button
            onClick={onToggleMobileSelect}
            title={mobileSelectMode ? 'Exit select mode' : 'Enter select mode to drag-select nodes'}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${mobileSelectMode ? '#00ff00' : '#334155'}`,
              background: mobileSelectMode ? '#0f4c0f' : '#1e293b',
              color: mobileSelectMode ? '#00ff00' : '#94a3b8',
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mobileSelectMode ? '✓ Select' : 'Select'}
          </button>
          <Btn onClick={onSaveGist} title={gistUrl ? 'Update saved Gist' : 'Save to GitHub Gist'} small disabled={isSavingGist}>
            {isSavingGist ? '…' : gistUrl ? '☁ Update' : '☁ Save'}
          </Btn>
          <Btn onClick={onLoadGist} title="Load from GitHub Gist ID or URL" small>☁ Load</Btn>
          <TokenBtn hasToken={hasGistToken} onManageToken={onManageToken} small />
          <Btn onClick={onShare}          title="Copy shareable link to clipboard" small>Share</Btn>
          <Btn onClick={onDeleteSelected} title="Delete selected nodes / edges"    small danger>Delete</Btn>
          <Btn onClick={onExportPNG}      title="Export as PNG"                    small>PNG</Btn>
          <Btn onClick={onExportJSON}     title="Export JSON"                      small>↓ JSON</Btn>
          <Btn onClick={() => importJsonRef.current?.click()} title="Import JSON" small>↑ JSON</Btn>
          <Btn onClick={() => importSvgRef.current?.click()}  title="Import SVG positions" small>↑ SVG</Btn>
          <Btn onClick={onClear} danger   title="Clear canvas"                    small>Clear</Btn>
          <input ref={importJsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />
          <input ref={importSvgRef}  type="file" accept=".svg,image/svg+xml"     style={{ display: 'none' }} onChange={handleImportSvg} />
        </div>
      </div>
    );
  }

  // Shorten gist URL for display
  const gistShort = gistUrl ? gistUrl.replace('https://gist.github.com/', '') : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', background: '#020617', borderBottom: '1px solid #1e293b',
      gap: 10, flexShrink: 0, zIndex: 10,
    }}>
      <a href="/" style={linkStyle}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
      >← DaBingaBongo</a>

      <span style={titleStyle}>Brainstorm</span>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
        <Btn onClick={onUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}>↩ Undo</Btn>
        <Btn onClick={onRedo} title="Redo (Ctrl+Y)" disabled={!canRedo}>↪ Redo</Btn>

        {/* Gist section */}
        <Btn onClick={onSaveGist} title={gistUrl ? 'Update saved Gist' : 'Save diagram to GitHub Gist'} disabled={isSavingGist}>
          {isSavingGist ? '☁ Saving…' : gistUrl ? '☁ Update Gist' : '☁ Save Gist'}
        </Btn>
        <Btn onClick={onLoadGist} title="Load diagram from a GitHub Gist">☁ Load Gist</Btn>
        <TokenBtn hasToken={hasGistToken} onManageToken={onManageToken} />
        {gistShort && (
          <a
            href={gistUrl}
            target="_blank"
            rel="noreferrer"
            title="Open this gist on GitHub"
            style={{ color: '#334155', fontSize: 11, fontFamily: 'Inter, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}
            onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
            onMouseLeave={e => e.currentTarget.style.color = '#334155'}
          >
            {gistShort}
          </a>
        )}

        <Btn onClick={onShare}                               title="Copy shareable link to clipboard">Share</Btn>
        <Btn onClick={onExportPNG}                           title="Export canvas as PNG">PNG</Btn>
        <Btn onClick={onExportJSON}                          title="Export diagram as JSON">Export JSON</Btn>
        <Btn onClick={() => importJsonRef.current?.click()}  title="Import Lucidchart JSON or native JSON">↑ JSON</Btn>
        <Btn onClick={() => importSvgRef.current?.click()}   title="Import SVG positions">↑ SVG pos</Btn>
        <Btn onClick={onClear} danger                        title="Clear entire canvas">Clear</Btn>
        <input ref={importJsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />
        <input ref={importSvgRef}  type="file" accept=".svg,image/svg+xml"     style={{ display: 'none' }} onChange={handleImportSvg} />
        {darkBtn}
      </div>
    </div>
  );
}
