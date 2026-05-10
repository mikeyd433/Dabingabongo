import { useRef, useState, useEffect } from 'react';

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

const Sep = () => (
  <div style={{ width: 1, height: 20, background: '#1e293b', flexShrink: 0, alignSelf: 'center' }} />
);

export default function Toolbar({
  onClear, onExportJSON, onImportJSON, onImportSVG, onExportPNG,
  onUndo, onRedo, canUndo, canRedo,
  darkMode, onToggleDark, isMobile, isTablet,
  mobileSelectMode, onToggleMobileSelect,
  onDeleteSelected, onShare,
  onSaveGist, onLoadGist, onManageToken, onShowHistory, hasGistToken, gistUrl, isSavingGist, hasGist,
  onPresent, onOpenSearch,
}) {
  const isCompact = isMobile || isTablet;
  const importJsonRef = useRef(null);
  const importSvgRef  = useRef(null);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!showMore) return;
    const handle = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMore]);

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
        padding: isCompact ? '5px 8px' : '4px 10px', borderRadius: 6, fontSize: 15,
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

  // ── Shared dropdown primitives (used in both layouts) ─────────────────────
  const DropItem = ({ children, onClick, danger }) => {
    const baseColor = danger ? '#f87171' : '#94a3b8';
    return (
      <div
        onClick={() => { setShowMore(false); onClick?.(); }}
        style={{
          padding: '8px 14px',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: baseColor,
          background: 'transparent',
          touchAction: 'manipulation',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = danger ? '#3f1010' : '#1e293b';
          e.currentTarget.style.color = danger ? '#fca5a5' : '#e2e8f0';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = baseColor;
        }}
      >
        {children}
      </div>
    );
  };

  const DropDivider = () => (
    <div style={{ height: 1, background: '#1e293b', margin: '3px 0' }} />
  );

  const dropdownStyle = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    zIndex: 200,
    background: '#020617',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '4px 0',
    minWidth: 180,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  };

  // ── Compact (mobile / tablet) layout ──────────────────────────────────────
  if (isCompact) {
    const sm = isMobile;
    return (
      // moreRef covers the whole toolbar so click-outside closes the dropdown
      // position:relative lets the dropdown escape the overflow-x:auto scroll row
      <div ref={moreRef} style={{ background: '#020617', borderBottom: '1px solid #1e293b', flexShrink: 0, zIndex: 10, position: 'relative' }}>
        {/* Row 1: back + title + dark toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px' }}>
          <a href="/" style={linkStyle}>← Back</a>
          <span style={titleStyle}>Brainstorm</span>
          {darkBtn}
        </div>

        {/* Row 2: primary actions, scrollable */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <Btn onClick={onOpenSearch} title="Search nodes" small={sm}>Find</Btn>
          <Btn onClick={onUndo} title="Undo (Ctrl+Z)" small={sm} disabled={!canUndo}>↩</Btn>
          <Btn onClick={onRedo} title="Redo (Ctrl+Y)" small={sm} disabled={!canRedo}>↪</Btn>
          <button
            onClick={onToggleMobileSelect}
            title={mobileSelectMode ? 'Exit select mode' : 'Enter select mode to drag-select nodes'}
            style={{
              padding: sm ? '5px 10px' : '6px 14px', borderRadius: 6,
              fontSize: sm ? 12 : 13, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${mobileSelectMode ? '#00ff00' : '#334155'}`,
              background: mobileSelectMode ? '#0f4c0f' : '#1e293b',
              color: mobileSelectMode ? '#00ff00' : '#94a3b8',
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mobileSelectMode ? '✓ Select' : 'Select'}
          </button>
          <Btn onClick={onSaveGist} title={gistUrl ? 'Update saved Gist' : 'Save to GitHub Gist'} small={sm} disabled={isSavingGist}>
            {isSavingGist ? '…' : gistUrl ? '☁ Update' : '☁ Save'}
          </Btn>
          <Btn onClick={onLoadGist} title="Load from GitHub Gist ID or URL" small={sm}>☁ Load</Btn>
          {hasGist && <Btn onClick={onShowHistory} title="Browse version history" small={sm}>History</Btn>}
          <Btn onClick={onShare}   title="Copy shareable link to clipboard" small={sm}>Share</Btn>
          <Btn onClick={onPresent} title="Fullscreen presentation mode" small={sm}>Present</Btn>
          <Btn onClick={() => setShowMore(m => !m)} active={showMore} small={sm}>⋯ More</Btn>
          <input ref={importJsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />
          <input ref={importSvgRef}  type="file" accept=".svg,image/svg+xml"     style={{ display: 'none' }} onChange={handleImportSvg} />
        </div>

        {/* Dropdown — sibling to the scroll row so it isn't clipped by overflow-x */}
        {showMore && (
          <div style={dropdownStyle}>
            <DropItem onClick={onManageToken}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: hasGistToken ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
              GitHub Token
            </DropItem>
            <DropDivider />
            <DropItem onClick={onDeleteSelected} danger>Delete selected</DropItem>
            <DropDivider />
            <DropItem onClick={onExportPNG}>Export PNG</DropItem>
            <DropItem onClick={onExportJSON}>Export JSON</DropItem>
            <DropItem onClick={() => importJsonRef.current?.click()}>Import JSON</DropItem>
            <DropItem onClick={() => importSvgRef.current?.click()}>Import SVG</DropItem>
            <DropDivider />
            <DropItem onClick={onClear} danger>Clear canvas</DropItem>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
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

        {/* Edit group */}
        <Btn onClick={onUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}>↩ Undo</Btn>
        <Btn onClick={onRedo} title="Redo (Ctrl+Y)" disabled={!canRedo}>↪ Redo</Btn>

        <Sep />

        {/* Cloud group */}
        <Btn onClick={onSaveGist} title={gistUrl ? 'Update saved Gist' : 'Save diagram to GitHub Gist'} disabled={isSavingGist}>
          {isSavingGist ? '☁ Saving…' : gistUrl ? '☁ Update Gist' : '☁ Save Gist'}
        </Btn>
        <Btn onClick={onLoadGist} title="Load diagram from a GitHub Gist">☁ Load Gist</Btn>
        {hasGist && <Btn onClick={onShowHistory} title="Browse version history">History</Btn>}
        {gistShort && (
          <a
            href={gistUrl}
            target="_blank"
            rel="noreferrer"
            title="Open this gist on GitHub"
            style={{ color: '#334155', fontSize: 11, fontFamily: 'Inter, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}
            onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
            onMouseLeave={e => e.currentTarget.style.color = '#334155'}
          >
            {gistShort}
          </a>
        )}

        <Sep />

        {/* Actions group */}
        <Btn onClick={onShare}   title="Copy shareable link to clipboard">Share</Btn>
        <Btn onClick={onPresent} title="Fullscreen presentation mode (Esc to exit)">Present</Btn>

        <Sep />

        {/* More dropdown */}
        <div ref={moreRef} style={{ position: 'relative' }}>
          <Btn onClick={() => setShowMore(m => !m)} active={showMore} title="More actions">
            ⋯ More
          </Btn>
          {showMore && (
            <div style={dropdownStyle}>
              <DropItem onClick={onManageToken}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: hasGistToken ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
                GitHub Token
              </DropItem>
              <DropDivider />
              <DropItem onClick={onExportPNG}>Export PNG</DropItem>
              <DropItem onClick={onExportJSON}>Export JSON</DropItem>
              <DropItem onClick={() => importJsonRef.current?.click()}>Import JSON</DropItem>
              <DropItem onClick={() => importSvgRef.current?.click()}>Import SVG</DropItem>
              <DropDivider />
              <DropItem onClick={onClear} danger>Clear canvas</DropItem>
            </div>
          )}
        </div>

        <input ref={importJsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />
        <input ref={importSvgRef}  type="file" accept=".svg,image/svg+xml"     style={{ display: 'none' }} onChange={handleImportSvg} />
        {darkBtn}
      </div>
    </div>
  );
}
