import { memo } from 'react';
import { Handle, Position } from 'reactflow';

// Centered handle style — the whole dot is the connection point
const h = {
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 14, height: 14,
  background: 'transparent',
  border: 'none',
  borderRadius: '50%',
  minWidth: 0, minHeight: 0,
};

export default memo(function StubNode({ selected }) {
  return (
    <div
      style={{
        width: 14, height: 14, borderRadius: '50%',
        background: selected ? '#00ff00' : '#64748b',
        border: `2px solid ${selected ? '#020617' : '#0f172a'}`,
        boxShadow: selected
          ? '0 0 0 3px rgba(0,255,0,0.2), 0 1px 4px rgba(0,0,0,0.5)'
          : '0 1px 4px rgba(0,0,0,0.5)',
        cursor: 'grab',
      }}
    >
      <Handle id="src" type="source" position={Position.Right} style={h} />
      <Handle id="tgt" type="target" position={Position.Left}  style={h} />
    </div>
  );
});
