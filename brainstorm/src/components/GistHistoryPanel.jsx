import { useState, useEffect } from 'react';
import { fetchGistHistory, loadGistRevision } from '../utils/gistApi';

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
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  // commit metadata per SHA: { [sha]: { author, description, ts } | null }
  // undefined = not yet fetched, null = fetched but no _commit in that revision
  const [commitMeta, setCommitMeta] = useState({});
  const [expandedSha, setExpandedSha] = useState(null);

  // Phase 1: fetch the history list
  useEffect(() => {
    const token = localStorage.getItem('brainstorm-github-token');
    fetchGistHistory(gistId, token)
      .then(({ history: h }) => { setHistory(h); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [gistId]);

  // Phase 2: once history is loaded, fetch commit metadata for each revision in parallel
  useEffect(() => {
    if (!history.length) return;
    const token = localStorage.getItem('brainstorm-github-token');
    Promise.all(
      history.map(rev =>
        loadGistRevision(gistId, rev.version, token)
          .then(({ commit }) => [rev.version, commit])
          .catch(() => [rev.version, null])
      )
    ).then(results => {
      const meta = {};
      results.forEach(([sha, commit]) => { meta[sha] = commit; });
      setCommitMeta(meta);
    });
  }, [history, gistId]);

  const toggleExpand = (e, sha) => {
    e.stopPropagation();
    setExpandedSha(prev => prev === sha ? null : sha);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, width: 420, maxWidth: '92vw', maxHeight: '72vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>Version History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 28, color: '#475569', textAlign: 'center', fontSize: 13 }}>Loading…</div>}
          {error   && <div style={{ padding: 28, color: '#f87171', textAlign: 'center', fontSize: 13 }}>{error}</div>}

          {!loading && !error && history.map((rev, i) => {
            const isCurrent = rev.version === currentSha;
            const isLatest  = i === 0;
            const meta      = commitMeta[rev.version]; // undefined = loading, null = no commit info
            const author    = meta === undefined ? null : (meta?.author ?? null);
            const desc      = meta?.description ?? '';
            const isExpanded = expandedSha === rev.version;

            return (
              <div key={rev.version} style={{ borderBottom: '1px solid #0a0f1e' }}>
                {/* Main row */}
                <div
                  onClick={() => onLoad(rev.version)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 20px',
                    cursor: 'pointer',
                    background: isCurrent ? '#0a1f10' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#0f172a'; }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: time + badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ color: isCurrent ? '#22c55e' : '#cbd5e1', fontSize: 13, fontWeight: isCurrent ? 600 : 400 }}>
                        {relativeTime(rev.committed_at)}
                      </span>
                      {isLatest && <span style={{ fontSize: 10, color: '#22c55e', background: '#0f2d1a', border: '1px solid #166534', borderRadius: 3, padding: '1px 5px' }}>latest</span>}
                      {isCurrent && <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, padding: '1px 5px' }}>loaded</span>}
                    </div>
                    {/* Row 2: author + sha */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {author !== null ? (
                        <span style={{ color: '#475569', fontSize: 11, fontWeight: 500 }}>{author}</span>
                      ) : (
                        <span style={{ color: '#1e293b', fontSize: 11 }}>···</span>
                      )}
                      <span style={{ color: '#1e293b', fontSize: 11 }}>{rev.version.slice(0, 8)}…</span>
                    </div>
                  </div>

                  {/* Right side: description button + load arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                    {desc && (
                      <button
                        onClick={e => toggleExpand(e, rev.version)}
                        title={isExpanded ? 'Hide description' : 'View description'}
                        style={{
                          background: isExpanded ? '#1e293b' : 'none',
                          border: `1px solid ${isExpanded ? '#334155' : 'transparent'}`,
                          borderRadius: 4, color: '#475569', cursor: 'pointer',
                          fontSize: 13, lineHeight: 1, padding: '3px 6px',
                          transition: 'background 0.1s, border-color 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; }}
                        onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; } }}
                      >ℹ</button>
                    )}
                    <span style={{ color: '#1e293b', fontSize: 14 }}>→</span>
                  </div>
                </div>

                {/* Inline description expansion */}
                {isExpanded && desc && (
                  <div style={{ padding: '10px 20px 12px', background: '#050d18', borderTop: '1px solid #0a0f1e' }}>
                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>
                      {author && <span style={{ color: '#475569', fontWeight: 500 }}>{author} · </span>}
                      {new Date(rev.committed_at).toLocaleString()}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{desc}</div>
                  </div>
                )}
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
