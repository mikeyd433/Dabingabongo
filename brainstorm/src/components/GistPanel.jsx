import { useState, useRef, useEffect } from 'react';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 6,
  color: '#f1f5f9',
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  marginBottom: 16,
};

const btnBase = {
  padding: '7px 16px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#94a3b8',
};

const btnPrimary = {
  ...btnBase,
  border: '1px solid #00ff00',
  background: '#0f4c0f',
  color: '#00ff00',
};

const btnDanger = {
  ...btnBase,
  border: '1px solid #7f1d1d',
  color: '#f87171',
};

export default function GistPanel({ mode, onClose, onTokenSave, onLoad, hasToken, onClearToken, onUnlinkGist, hasGist }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const isToken = mode === 'token';

  const handleSubmit = () => {
    if (!value.trim()) return;
    if (isToken) onTokenSave(value.trim());
    else onLoad(value.trim());
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#020617',
          border: '1px solid #1e293b',
          borderRadius: 12,
          padding: '24px 28px',
          width: 380,
          maxWidth: '92vw',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          {isToken ? 'GitHub Token' : 'Load from Gist'}
        </div>

        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
          {isToken ? (
            <>
              Enter a personal access token with only the <code style={{ color: '#22c55e', background: '#0f2d1a', padding: '1px 5px', borderRadius: 3 }}>gist</code> scope.
              It's saved only in your browser — never sent anywhere except GitHub.
            </>
          ) : (
            'Paste a Gist ID or the full gist URL.'
          )}
        </div>

        <input
          ref={inputRef}
          type={isToken ? 'password' : 'text'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  handleSubmit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={isToken ? 'ghp_xxxxxxxxxxxx' : 'abc1def2... or gist.github.com/user/abc1def2'}
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          {isToken && hasToken && (
            <button onClick={onClearToken} style={btnDanger}>Clear token</button>
          )}
          {isToken && hasGist && (
            <button onClick={onUnlinkGist} style={btnDanger}>Unlink gist</button>
          )}
          <button onClick={onClose} style={btnBase}>Cancel</button>
          <button onClick={handleSubmit} style={btnPrimary} disabled={!value.trim()}>
            {isToken ? 'Save token' : 'Load'}
          </button>
        </div>
      </div>
    </div>
  );
}
