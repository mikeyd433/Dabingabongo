import { useEffect, useRef, useState } from 'react';

export default function NodeDetailsPanel({ nodeId, nodeLabel, details, onUpdate, onClose }) {
  const [draft, setDraft] = useState(details ?? '');
  const textareaRef = useRef(null);

  // Sync draft when switching to a different node
  useEffect(() => {
    setDraft(details ?? '');
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    textareaRef.current?.focus();
  }, [nodeId]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 300,
        minWidth: 200,
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        background: '#020617',
        border: '1px solid #334155',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        zIndex: 500,
        fontFamily: 'Inter, sans-serif',
        resize: 'both',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px 8px',
        borderBottom: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        <span style={{ color: '#00ff00', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
          Notes
        </span>
        <span style={{ color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {nodeLabel || 'Node'}
        </span>
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={e => { setDraft(e.target.value); onUpdate(nodeId, e.target.value); }}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Add notes or details for this node…"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#cbd5e1',
          fontSize: 13,
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.65,
          padding: '10px 14px',
          resize: 'none',
          minHeight: 140,
        }}
      />

      {/* Footer: char count hint */}
      {draft.length > 0 && (
        <div style={{ padding: '3px 14px 8px', color: '#1e293b', fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
          {draft.length}
        </div>
      )}
    </div>
  );
}
