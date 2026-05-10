import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { useFlowContext } from '../contexts/FlowContext';

export const NODE_COLORS = [
  // Row 1
  { name: 'default', bg: '#1e293b', border: '#475569', text: '#f1f5f9' },
  { name: 'blue',    bg: '#1e3a8a', border: '#3b82f6', text: '#eff6ff' },
  { name: 'green',   bg: '#14532d', border: '#22c55e', text: '#dcfce7' },
  { name: 'purple',  bg: '#4a044e', border: '#c026d3', text: '#fdf4ff' },
  { name: 'amber',   bg: '#451a03', border: '#f59e0b', text: '#fef3c7' },
  // Row 2
  { name: 'rose',    bg: '#4c0519', border: '#f43f5e', text: '#ffe4e6' },
  { name: 'teal',    bg: '#042f2e', border: '#14b8a6', text: '#ccfbf1' },
  { name: 'pink',    bg: '#500724', border: '#ec4899', text: '#fce7f3' },
  { name: 'indigo',  bg: '#1e1b4b', border: '#6366f1', text: '#e0e7ff' },
  { name: 'orange',  bg: '#431407', border: '#f97316', text: '#ffedd5' },
];

export default function CustomNode({ id, data, selected }) {
  const { updateLabel, updateColor } = useFlowContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(data.label);
  const inputRef  = useRef(null);
  const pressTimer = useRef(null);

  useEffect(() => { setDraft(data.label); }, [data.label]);
  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    updateLabel(id, draft || 'New Node');
  }, [id, draft, updateLabel]);

  const handleDoubleClick = useCallback((e) => { e.stopPropagation(); setEditing(true); }, []);

  // Long-press to edit on touch (double-tap unreliable on mobile)
  const onTouchStart = useCallback((e) => {
    pressTimer.current = setTimeout(() => { e.preventDefault(); setEditing(true); }, 400);
  }, []);
  const cancelPress = useCallback(() => clearTimeout(pressTimer.current), []);

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setEditing(false); setDraft(data.label); }
  }, [commit, data.label]);

  const color = NODE_COLORS.find(c => c.name === data.color) ?? NODE_COLORS[0];

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
        isVisible={selected}
        minWidth={100}
        minHeight={40}
        lineStyle={{ stroke: '#00ff00', strokeWidth: 1, opacity: 0.6 }}
        handleStyle={{ width: 10, height: 10, background: '#00ff00', border: '2px solid #0f172a', borderRadius: 2 }}
      />

      <div
        onDoubleClick={handleDoubleClick}
        onTouchStart={onTouchStart}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
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
          border: `${selected ? 2 : 1}px solid ${selected ? '#00ff00' : color.border}`,
          borderRadius: 8,
          cursor: 'default',
          boxShadow: selected
            ? '0 0 0 3px rgba(0,255,0,0.2), 0 4px 16px rgba(0,0,0,0.5)'
            : '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <Handle type="target" position={Position.Top}    style={{ ...handleStyle, top:    -6 }} />
        <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, bottom: -6 }} />
        <Handle type="target" position={Position.Left}   style={{ ...handleStyle, left:   -6 }} />
        <Handle type="source" position={Position.Right}  style={{ ...handleStyle, right:  -6 }} />

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: color.text,
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              width: '100%',
              padding: 0,
            }}
          />
        ) : (
          <span style={{ color: color.text, fontSize: 14, wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'block', width: '100%' }}>
            {data.label || 'New Node'}
          </span>
        )}

        {/* Color picker — 2 rows of 5 */}
        {selected && !editing && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => { e.stopPropagation(); cancelPress(); }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 22px)',
              gap: 5,
              background: '#020617',
              padding: '7px 8px',
              borderRadius: 10,
              border: '1px solid #1e293b',
              zIndex: 100,
            }}
          >
            {NODE_COLORS.map(c => (
              <div
                key={c.name}
                title={c.name}
                onClick={e => { e.stopPropagation(); updateColor(id, c.name); }}
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
        )}
      </div>
    </>
  );
}
