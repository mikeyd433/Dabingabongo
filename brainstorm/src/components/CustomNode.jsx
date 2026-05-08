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

const handleStyle = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#00ff00',
  border: '2px solid #0f172a',
  transition: 'opacity 0.15s',
};

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

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setEditing(false); setDraft(data.label); }
  }, [commit, data.label]);

  const color = NODE_COLORS.find(c => c.name === data.color) ?? NODE_COLORS[0];

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        background: color.bg,
        border: `${selected ? 2 : 1}px solid ${selected ? '#00ff00' : color.border}`,
        borderRadius: 8,
        padding: '10px 16px',
        minWidth: 120,
        maxWidth: 260,
        cursor: 'default',
        boxShadow: selected
          ? '0 0 0 3px rgba(0,255,0,0.25), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="source" position={Position.Right}  style={handleStyle} />

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
        <span style={{ color: color.text, fontSize: 14, wordBreak: 'break-word', display: 'block' }}>
          {data.label || 'New Node'}
        </span>
      )}

      {selected && !editing && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: -36,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 5,
            background: '#020617',
            padding: '5px 8px',
            borderRadius: 20,
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
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: c.bg,
                border: `2px solid ${c.border}`,
                cursor: 'pointer',
                outline: data.color === c.name || (!data.color && c.name === 'default')
                  ? '2px solid #ffffff' : 'none',
                outlineOffset: 1,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
