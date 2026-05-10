import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { useFlowContext } from '../contexts/FlowContext';

// Rainbow order: red → orange → yellow → green → cyan → blue → purple → pink → neutrals
export const NODE_COLORS = [
  { name: 'red',     bg: '#450a0a', border: '#ef4444', text: '#fee2e2' },
  { name: 'rose',    bg: '#4c0519', border: '#f43f5e', text: '#ffe4e6' },
  { name: 'orange',  bg: '#431407', border: '#f97316', text: '#ffedd5' },
  { name: 'amber',   bg: '#451a03', border: '#f59e0b', text: '#fef3c7' },
  { name: 'yellow',  bg: '#422006', border: '#eab308', text: '#fef9c3' },
  { name: 'lime',    bg: '#1a2e05', border: '#84cc16', text: '#ecfccb' },
  { name: 'green',   bg: '#14532d', border: '#22c55e', text: '#dcfce7' },
  { name: 'emerald', bg: '#022c22', border: '#10b981', text: '#d1fae5' },
  { name: 'teal',    bg: '#042f2e', border: '#14b8a6', text: '#ccfbf1' },
  { name: 'cyan',    bg: '#083344', border: '#06b6d4', text: '#cffafe' },
  { name: 'sky',     bg: '#082f49', border: '#0ea5e9', text: '#e0f2fe' },
  { name: 'blue',    bg: '#1e3a8a', border: '#3b82f6', text: '#eff6ff' },
  { name: 'indigo',  bg: '#1e1b4b', border: '#6366f1', text: '#e0e7ff' },
  { name: 'violet',  bg: '#2e1065', border: '#8b5cf6', text: '#ede9fe' },
  { name: 'purple',  bg: '#4a044e', border: '#c026d3', text: '#fdf4ff' },
  { name: 'fuchsia', bg: '#3b0764', border: '#d946ef', text: '#fae8ff' },
  { name: 'pink',    bg: '#500724', border: '#ec4899', text: '#fce7f3' },
  { name: 'slate',   bg: '#0f172a', border: '#64748b', text: '#e2e8f0' },
  { name: 'stone',   bg: '#1c1917', border: '#78716c', text: '#f5f5f4' },
  { name: 'default', bg: '#1e293b', border: '#475569', text: '#f1f5f9' },
];

// Light-mode palette: bg ↔ text swapped so nodes read naturally on a light canvas.
// Borders stay identical so MiniMap colours and colour identity remain consistent.
export const NODE_COLORS_LIGHT = [
  { name: 'red',     bg: '#fee2e2', border: '#ef4444', text: '#450a0a' },
  { name: 'rose',    bg: '#ffe4e6', border: '#f43f5e', text: '#4c0519' },
  { name: 'orange',  bg: '#ffedd5', border: '#f97316', text: '#431407' },
  { name: 'amber',   bg: '#fef3c7', border: '#f59e0b', text: '#451a03' },
  { name: 'yellow',  bg: '#fef9c3', border: '#eab308', text: '#422006' },
  { name: 'lime',    bg: '#ecfccb', border: '#84cc16', text: '#1a2e05' },
  { name: 'green',   bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
  { name: 'emerald', bg: '#d1fae5', border: '#10b981', text: '#022c22' },
  { name: 'teal',    bg: '#ccfbf1', border: '#14b8a6', text: '#042f2e' },
  { name: 'cyan',    bg: '#cffafe', border: '#06b6d4', text: '#083344' },
  { name: 'sky',     bg: '#e0f2fe', border: '#0ea5e9', text: '#082f49' },
  { name: 'blue',    bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },
  { name: 'indigo',  bg: '#e0e7ff', border: '#6366f1', text: '#1e1b4b' },
  { name: 'violet',  bg: '#ede9fe', border: '#8b5cf6', text: '#2e1065' },
  { name: 'purple',  bg: '#fdf4ff', border: '#c026d3', text: '#4a044e' },
  { name: 'fuchsia', bg: '#fae8ff', border: '#d946ef', text: '#3b0764' },
  { name: 'pink',    bg: '#fce7f3', border: '#ec4899', text: '#500724' },
  { name: 'slate',   bg: '#e2e8f0', border: '#64748b', text: '#0f172a' },
  { name: 'stone',   bg: '#f5f5f4', border: '#78716c', text: '#1c1917' },
  { name: 'default', bg: '#ffffff', border: '#94a3b8', text: '#1e293b' },
];

function CustomNode({ id, data, selected }) {
  const { updateLabel, updateColor, updateColorForAll, presentationMode, searchMatchIds, searchCurrentId, openNodeMenu, openDetailsPanel, isTouch, darkMode } = useFlowContext();
  const { getNodes } = useReactFlow();
  const [editing, setEditing]           = useState(false);
  const [draft, setDraft]               = useState(data.label);
  const [paletteExpanded, setPaletteExpanded] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(data.label); }, [data.label]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      // size the textarea to its content on open
      const el = inputRef.current;
      if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
    }
  }, [editing]);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    updateLabel(id, draft || 'New Node');
  }, [id, draft, updateLabel]);

  // onDoubleClick fires for both mouse double-click and touch double-tap
  const handleDoubleClick = useCallback((e) => { e.stopPropagation(); setEditing(true); }, []);

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(data.label); }
  }, [commit, data.label]);

  const handleColorPick = useCallback((colorName) => {
    const selectedIds = getNodes().filter(n => n.selected).map(n => n.id);
    if (selectedIds.length > 1) {
      updateColorForAll(selectedIds, colorName);
    } else {
      updateColor(id, colorName);
    }
  }, [id, getNodes, updateColor, updateColorForAll]);

  const palette = darkMode ? NODE_COLORS : NODE_COLORS_LIGHT;
  const color = palette.find(c => c.name === data.color) ?? palette[palette.length - 1];

  const isSearchMatch  = searchMatchIds?.has(id)  ?? false;
  const isCurrentMatch = searchCurrentId === id;

  const borderColor = isCurrentMatch ? '#facc15'
    : isSearchMatch  ? '#f59e0b'
    : selected       ? '#00ff00'
    : color.border;
  const borderWidth = (isCurrentMatch || selected) ? 2 : 1;
  const boxShadow = isCurrentMatch
    ? '0 0 0 3px rgba(250,204,21,0.4), 0 4px 16px rgba(0,0,0,0.5)'
    : isSearchMatch
    ? '0 0 0 2px rgba(245,158,11,0.25), 0 4px 16px rgba(0,0,0,0.5)'
    : selected
    ? '0 0 0 3px rgba(0,255,0,0.2), 0 4px 16px rgba(0,0,0,0.5)'
    : '0 2px 8px rgba(0,0,0,0.4)';

  const handleStyle = {
    width: 12,
    height: 12,
    background: '#00ff00',
    border: '2px solid #0f172a',
    borderRadius: '50%',
  };

  return (
    <>
      <NodeResizer
        isVisible={selected && !presentationMode}
        minWidth={100}
        minHeight={40}
        lineStyle={{ stroke: '#00ff00', strokeWidth: 1, opacity: 0.6 }}
        handleStyle={{ width: 10, height: 10, background: '#00ff00', border: '2px solid #0f172a', borderRadius: 2 }}
      />

      <div
        onDoubleClick={handleDoubleClick}
        style={{
          width: '100%',
          height: '100%',
          minWidth: 120,
          minHeight: 40,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          background: color.bg,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 8,
          cursor: 'default',
          boxShadow,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <Handle type="target" position={Position.Top}    style={{ ...handleStyle, top:    -6, ...(presentationMode && { opacity: 0, pointerEvents: 'none' }) }} />
        <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, bottom: -6, ...(presentationMode && { opacity: 0, pointerEvents: 'none' }) }} />
        <Handle type="target" position={Position.Left}   style={{ ...handleStyle, left:   -6, ...(presentationMode && { opacity: 0, pointerEvents: 'none' }) }} />
        <Handle type="source" position={Position.Right}  style={{ ...handleStyle, right:  -6, ...(presentationMode && { opacity: 0, pointerEvents: 'none' }) }} />

        {/* Notes indicator — visible when the node has details */}
        {data.details && !editing && (
          <button
            className="nodrag nopan"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); openDetailsPanel(id); }}
            title="This node has notes — click to view"
            style={{
              position: 'absolute',
              top: 3,
              left: 4,
              width: 18,
              height: 18,
              borderRadius: 3,
              background: 'transparent',
              border: 'none',
              color: color.text,
              opacity: 0.45,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              lineHeight: 1,
              padding: 0,
              zIndex: 1,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ≡
          </button>
        )}

        {/* 3-dot menu button — touch devices only */}
        {isTouch && !presentationMode && !editing && (
          <button
            className="nodrag nopan"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              openNodeMenu(id, rect.left, rect.bottom + 4);
            }}
            style={{
              position: 'absolute',
              top: 3,
              right: 4,
              width: 22,
              height: 22,
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              lineHeight: 1,
              padding: 0,
              zIndex: 1,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ⋮
          </button>
        )}

        {editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); autoResize(); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: color.text,
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              width: '100%',
              padding: 0,
              margin: 0,
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.4,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              display: 'block',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <span style={{ color: color.text, fontSize: 14, wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'block', width: '100%' }}>
            {data.label || 'New Node'}
          </span>
        )}

        {/* Color picker — expandable rainbow palette */}
        {selected && !editing && !presentationMode && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#020617',
              padding: '7px 8px',
              borderRadius: 10,
              border: '1px solid #1e293b',
              zIndex: 100,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 22px)', gap: 5 }}>
              {(paletteExpanded ? NODE_COLORS : NODE_COLORS.slice(0, 10)).map(c => (
                <div
                  key={c.name}
                  title={c.name}
                  onClick={e => { e.stopPropagation(); handleColorPick(c.name); }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c.bg,
                    border: `2px solid ${c.border}`,
                    cursor: 'pointer',
                    outline: (data.color === c.name || (!data.color && c.name === 'default'))
                      ? '2px solid #fff' : 'none',
                    outlineOffset: 2,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                />
              ))}
            </div>
            <div
              onClick={e => { e.stopPropagation(); setPaletteExpanded(x => !x); }}
              title={paletteExpanded ? 'Show fewer colors' : 'Show more colors'}
              style={{
                marginTop: 5,
                textAlign: 'center',
                color: '#475569',
                fontSize: 11,
                cursor: 'pointer',
                userSelect: 'none',
                letterSpacing: '0.05em',
              }}
            >
              {paletteExpanded ? '▲ less' : '▼ more'}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(CustomNode);
