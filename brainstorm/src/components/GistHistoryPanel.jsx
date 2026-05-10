import { useState, useEffect } from 'react';
import { fetchGistHistory } from '../utils/gistApi';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d <  7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function GistHistoryPanel({ gistId, currentSha, onLoad, onClose }) {
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('brainstorm-github-token');
    fetchGistHistory(gistId, token)
      .then(({ history }) => { setHistory(history); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [gistId]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, width: 380, maxWidth: '92vw', maxHeight: '72vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>Version History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 28, color: '#475569', textAlign: 'center', fontSize: 13 }}>Loading…</div>
          )}
          {error && (
            <div style={{ padding: 28, color: '#f87171', textAlign: 'center', fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && history.map((rev, i) => {
            const isCurrent = rev.version === currentSha;
            const isLatest  = i === 0;
            return (
              <div
                key={rev.version}
                onClick={() => onLoad(rev.version)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 20px',
                  borderBottom: '1px solid #0a0f1e',
                  cursor: 'pointer',
                  background: isCurrent ? '#0a1f10' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#0f172a'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ color: isCurrent ? '#22c55e' : '#cbd5e1', fontSize: 13, fontWeight: isCurrent ? 600 : 400 }}>
                      {relativeTime(rev.committed_at)}
                    </span>
                    {isLatest && (
                      <span style={{ fontSize: 10, color: '#22c55e', background: '#0f2d1a', border: '1px solid #166534', borderRadius: 3, padding: '1px 5px' }}>latest</span>
                    )}
                    {isCurrent && (
                      <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, padding: '1px 5px' }}>loaded</span>
                    )}
                  </div>
                  <div style={{ color: '#334155', fontSize: 11 }}>{rev.version.slice(0, 10)}…</div>
                </div>
                <span style={{ color: '#1e293b', fontSize: 14 }}>→</span>
              </div>
            );
          })}
          {!loading && !error && history.length === 0 && (
            <div style={{ padding: 28, color: '#475569', textAlign: 'center', fontSize: 13 }}>No history yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
