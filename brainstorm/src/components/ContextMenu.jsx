import { useEffect, useRef } from 'react';
import { NODE_COLORS } from './CustomNode';

function MenuItem({ children, onClick, danger }) {
  const base = { color: danger ? '#f87171' : '#94a3b8', background: 'transparent' };
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...base,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? '#3f1010' : '#1e293b';
        e.currentTarget.style.color = danger ? '#fca5a5' : '#e2e8f0';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = base.background;
        e.currentTarget.style.color = base.color;
      }}
    >
      {children}
    </div>
  );
}

const Divider = () => <div style={{ height: 1, background: '#1e293b', margin: '3px 0' }} />;

export default function ContextMenu({ menu, onClose, onDeleteNodes, onDuplicate, onColorNodes, onDeleteEdge, onResetEdge, onOpenDetails, onReconnectEdge }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Keep menu within viewport
  const menuW = 176;
  const menuH = menu.type === 'edge' ? 160 : 284;
  const x = Math.min(menu.x, window.innerWidth  - menuW - 8);
  const y = Math.min(menu.y, window.innerHeight - menuH - 8);

  const wrapStyle = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 1000,
    background: '#020617',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '4px 0',
    minWidth: menuW,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    userSelect: 'none',
  };

  if (menu.type === 'edge') {
    return (
      <div ref={ref} style={wrapStyle}>
        <MenuItem onClick={() => { onReconnectEdge(menu.id, 'source'); onClose(); }}>
          Move start →
        </MenuItem>
        <MenuItem onClick={() => { onReconnectEdge(menu.id, 'target'); onClose(); }}>
          Move end →
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onResetEdge(menu.id); onClose(); }}>
          Reset routing
        </MenuItem>
        <Divider />
        <MenuItem danger onClick={() => { onDeleteEdge(menu.id); onClose(); }}>
          Delete edge
        </MenuItem>
      </div>
    );
  }

  const count = menu.ids.length;

  return (
    <div ref={ref} style={wrapStyle}>
      <MenuItem onClick={() => { onDuplicate(menu.ids); onClose(); }}>
        Duplicate{count > 1 ? ` (${count})` : ''}
      </MenuItem>
      {menu.ids.length === 1 && (
        <MenuItem onClick={() => { onOpenDetails(menu.ids[0]); onClose(); }}>
          Details
        </MenuItem>
      )}
      <Divider />
      <div style={{ padding: '6px 14px 8px' }}>
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 18px)', gap: 4 }}>
          {NODE_COLORS.map(c => (
            <div
              key={c.name}
              title={c.name}
              onClick={() => { onColorNodes(menu.ids, c.name); onClose(); }}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: c.bg, border: `2px solid ${c.border}`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>
      <Divider />
      <MenuItem danger onClick={() => { onDeleteNodes(menu.ids); onClose(); }}>
        Delete{count > 1 ? ` ${count} nodes` : ' node'}
      </MenuItem>
    </div>
  );
}
