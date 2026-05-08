import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { useFlowContext } from '../contexts/FlowContext';

export const NODE_COLORS = [
  { name: 'default', bg: '#1e293b', border: '#475569', text: '#f1f5f9' },
  { name: 'blue',    bg: '#1e3a8a', border: '#3b82f6', text: '#eff6ff' },
  { name: 'green',   bg: '#14532d', border: '#22c55e', text: '#dcfce7' },
  { name: 'purple',  bg: '#4a044e', border: '#c026d3', text: '#fdf4ff' },
  { name: 'amber',   bg: '#451a03', border: '#f59e0b', text: '#fef3c7' },
];

// Larger invisible hit area around small handles for easier touch targeting
const handleWrapStyle = {
  width: 28,
  height: 28,
  background: 'transparent',
  border: 'none',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const handleDotStyle = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: '#00ff00',
  border: '2px solid #0f172a',
  transition: 'opacity 0.15s, transform 0.15s',
  pointerEvents: 'none',
};

// Passthrough Handle wrapper with bigger touch target
function BigHandle({ type, position }) {
  const offset = { top: '-14px', bottom: '-14px', left: '-14px', right: '-14px' };
  return (
    <Handle
      type={type}
      position={position}
      style={{
        width: 28,
        height: 28,
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        // Override react-flow's default positioning so the dot centre aligns
        ...(position === Position.Top    && { top:    -14 }),
        ...(position === Position.Bottom && { bottom: -14 }),
        ...(position === Position.Left   && { left:   -14 }),
        ...(position === Position.Right  && { right:  -14 }),
      }}
    >
      <div style={handleDotStyle} />
    </Handle>
  );
}

export default function CustomNode({ id, data, selected }) {
  const { updateLabel, updateColor } = useFlowContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(data.label);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(data.label); }, [data.label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    updateLabel(id, draft || 'New Node');
  }, [id, draft, updateLabel]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  // Touch: long-press (300 ms) to open edit on mobile where double-tap is unreliable
  const pressTimer = useRef(null);
  const onTouchStart = useCallback((e) => {
    pressTimer.current = setTimeout(() => {
      e.preventDefault();
      setEditing(true);
    }, 400);
  }, []);
  const onTouchEnd = useCallback(() => {
    clearTimeout(pressTimer.current);
  }, []);

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setEditing(false); setDraft(data.label); }
  }, [commit, data.label]);

  const color = NODE_COLORS.find(c => c.name === data.color) ?? NODE_COLORS[0];

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={() => clearTimeout(pressTimer.current)}
      style={{
        background: color.bg,
        border: `${selected ? 2 : 1}px solid ${selected ? '#00ff00' : color.border}`,
        borderRadius: 8,
        padding: '10px 16px',
        minWidth: 130,
        maxWidth: 260,
        cursor: 'default',
        boxShadow: selected
          ? '0 0 0 3px rgba(0,255,0,0.25), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ width: 12, height: 12, background: '#00ff00', border: '2px solid #0f172a', top: -6 }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: '#00ff00', border: '2px solid #0f172a', bottom: -6 }} />
      <Handle type="target" position={Position.Left}   style={{ width: 12, height: 12, background: '#00ff00', border: '2px solid #0f172a', left: -6 }} />
      <Handle type="source" position={Position.Right}  style={{ width: 12, height: 12, background: '#00ff00', border: '2px solid #0f172a', right: -6 }} />

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
            minWidth: 80,
          }}
        />
      ) : (
        <span style={{ color: color.text, fontSize: 14, wordBreak: 'break-word', display: 'block' }}>
          {data.label || 'New Node'}
        </span>
      )}

      {selected && !editing && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => { e.stopPropagation(); clearTimeout(pressTimer.current); }}
          style={{
            position: 'absolute',
            bottom: -44,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            background: '#020617',
            padding: '7px 10px',
            borderRadius: 24,
            border: '1px solid #1e293b',
            zIndex: 100,
            whiteSpace: 'nowrap',
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
                outline: data.color === c.name || (!data.color && c.name === 'default')
                  ? '2px solid #ffffff' : 'none',
                outlineOffset: 2,
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
