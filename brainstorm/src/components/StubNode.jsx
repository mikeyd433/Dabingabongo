import { memo } from 'react';
import { Handle, Position } from 'reactflow';

// Handles cover the full 44×44 touch area, centered on the visible dot
const h = {
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 44, height: 44,
  background: 'transparent',
  border: 'none',
  borderRadius: '50%',
  minWidth: 0, minHeight: 0,
};

export default memo(function StubNode({ selected }) {
  return (
    // 44×44 transparent touch target — large enough for fingers
    <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'grab' }}>
      {/* Visible 16×16 dot */}
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        background: selected ? '#00ff00' : '#64748b',
        border: `2px solid ${selected ? '#020617' : '#0f172a'}`,
        boxShadow: selected
          ? '0 0 0 3px rgba(0,255,0,0.2), 0 1px 4px rgba(0,0,0,0.5)'
          : '0 1px 4px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      }} />
      <Handle id="src" type="source" position={Position.Right} style={h} />
      <Handle id="tgt" type="target" position={Position.Left}  style={h} />
    </div>
  );
});
