import { useState, useRef, useEffect } from 'react';

const PRESET_NAMES   = ['Mike', 'Carter'];
const NAME_KEY       = 'brainstorm-commit-name';
const CUSTOM_KEY     = 'brainstorm-custom-names';

const inputStyle = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
  color: '#f1f5f9', fontSize: 13, padding: '7px 10px', outline: 'none',
  fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box',
};

export default function CommitPanel({ onSave, onClose }) {
  const [customNames, setCustomNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; }
  });
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY) || PRESET_NAMES[0]
  );
  const [description, setDescription] = useState('');
  const [addingName,  setAddingName]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const descRef    = useRef(null);
  const newNameRef = useRef(null);

  useEffect(() => { descRef.current?.focus(); }, []);
  useEffect(() => { if (addingName) newNameRef.current?.focus(); }, [addingName]);

  const allNames = [...PRESET_NAMES, ...customNames];

  const handleAddName = () => {
    const n = newName.trim();
    if (n && !allNames.includes(n)) {
      const updated = [...customNames, n];
      setCustomNames(updated);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
      setName(n);
    }
    setAddingName(false);
    setNewName('');
  };

  const handleSave = () => {
    localStorage.setItem(NAME_KEY, name);
    onSave({ author: name, description: description.trim() });
  };

  const chip = (n) => (
    <button
      key={n}
      onClick={() => setName(n)}
      style={{
        padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
        border:      `1px solid ${name === n ? '#00ff00' : '#334155'}`,
        background:  name === n ? '#0f4c0f' : '#1e293b',
        color:       name === n ? '#00ff00' : '#94a3b8',
        transition: 'border-color 0.1s, background 0.1s, color 0.1s',
      }}
    >{n}</button>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, padding: '24px 28px', width: 400, maxWidth: '92vw', fontFamily: 'Inter, sans-serif' }}
      >
        <div style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Save version</div>

        {/* Name chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Who's editing?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {allNames.map(chip)}
            {!addingName && (
              <button
                onClick={() => setAddingName(true)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px dashed #334155', background: 'transparent', color: '#475569' }}
              >+ Add name</button>
            )}
          </div>

          {addingName && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input
                ref={newNameRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddName(); if (e.key === 'Escape') { setAddingName(false); setNewName(''); } }}
                placeholder="Name"
                style={{ ...inputStyle, width: 'auto', flex: 1 }}
              />
              <button onClick={handleAddName} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #00ff00', background: '#0f4c0f', color: '#00ff00', fontFamily: 'Inter, sans-serif' }}>Add</button>
              <button onClick={() => { setAddingName(false); setNewName(''); }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>✕</button>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
            What changed? <span style={{ color: '#334155' }}>(optional)</span>
          </div>
          <textarea
            ref={descRef}
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder="Added pricing flow, updated node colors…"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid #00ff00', background: '#0f4c0f', color: '#00ff00', fontFamily: 'Inter, sans-serif' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
