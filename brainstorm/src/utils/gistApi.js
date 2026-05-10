const FILENAME = 'brainstorm-diagram.json';
const API      = 'https://api.github.com';

export function extractGistId(input) {
  const m = input.trim().match(/([a-f0-9]{20,})/i);
  return m ? m[1] : input.trim();
}

export async function saveGist(token, data, existingId = null) {
  const body = {
    description: 'Brainstorm diagram',
    files: { [FILENAME]: { content: JSON.stringify(data, null, 2) } },
  };
  if (!existingId) body.public = false;

  const res = await fetch(
    existingId ? `${API}/gists/${existingId}` : `${API}/gists`,
    {
      method: existingId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const gist = await res.json();
  return { id: gist.id, htmlUrl: gist.html_url, sha: gist.history?.[0]?.version ?? null };
}

export async function loadGist(gistId, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}/gists/${gistId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} — check the gist ID`);
  const gist = await res.json();
  const file = gist.files[FILENAME];
  if (!file) throw new Error(`No "${FILENAME}" file found in this gist`);
  return {
    data:    JSON.parse(file.content),
    htmlUrl: gist.html_url,
    id:      gist.id,
    sha:     gist.history?.[0]?.version ?? null,
  };
}

// Returns the full history array + latest sha (lightweight — same endpoint as loadGist)
export async function fetchGistHistory(gistId, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}/gists/${gistId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const gist = await res.json();
  return {
    history:   gist.history ?? [],          // [{ version, committed_at, user }]
    latestSha: gist.history?.[0]?.version ?? null,
  };
}

// Load the diagram content at a specific revision sha
export async function loadGistRevision(gistId, sha, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}/gists/${gistId}/${sha}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const gist = await res.json();
  const file = gist.files[FILENAME];
  if (!file) throw new Error(`No "${FILENAME}" found in this revision`);
  return { data: JSON.parse(file.content) };
}
