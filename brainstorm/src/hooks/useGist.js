import { useState, useRef, useCallback, useEffect } from 'react';
import { saveGist, loadGist, extractGistId, fetchGistHistory, loadGistRevision } from '../utils/gistApi';
import { makeEdgeOptions, stripCallbacks, deoverlapNodes, dagreLayout } from '../utils/flowUtils';

const mapNode = n => n.type === 'stub'
  ? { ...n, type: 'stub', data: {} }
  : { ...n, type: 'editableNode', data: { label: n.data?.label ?? 'Node', color: n.data?.color ?? 'default', details: n.data?.details } };

export function useGist({ darkMode, getNodes, getEdges, setNodes, setEdges }) {
  const [gistPanel,           setGistPanel]           = useState(null);
  const [gistId,              setGistId]              = useState(() => { try { return localStorage.getItem('brainstorm-gist-id') || null; } catch { return null; } });
  const [gistUrl,             setGistUrl]             = useState(() => { try { return localStorage.getItem('brainstorm-gist-url') || null; } catch { return null; } });
  const [hasToken,            setHasToken]            = useState(() => { try { return Boolean(localStorage.getItem('brainstorm-github-token')); } catch { return false; } });
  const [isSavingGist,        setIsSavingGist]        = useState(false);
  const [showCommitPanel,     setShowCommitPanel]     = useState(false);
  const [currentGistSha,      setCurrentGistSha]      = useState(null);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [showHistory,         setShowHistory]         = useState(false);
  const currentGistShaRef = useRef(null);
  const pendingSaveRef    = useRef(false);

  const updateCurrentSha = useCallback((sha) => {
    currentGistShaRef.current = sha;
    setCurrentGistSha(sha);
    setNewVersionAvailable(false);
  }, []);

  // Poll every 15 s for new gist versions (only when a gist is loaded)
  useEffect(() => {
    if (!gistId) return;
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      const token = localStorage.getItem('brainstorm-github-token');
      try {
        const { latestSha } = await fetchGistHistory(gistId, token);
        if (latestSha && latestSha !== currentGistShaRef.current && currentGistShaRef.current !== null) {
          setNewVersionAvailable(true);
        }
      } catch {}
    };
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [gistId]);

  const doSaveGist = useCallback(async (meta = null) => {
    const token = localStorage.getItem('brainstorm-github-token');
    if (!token) return;
    const curId = localStorage.getItem('brainstorm-gist-id');
    setIsSavingGist(true);
    try {
      const result = await saveGist(token, { nodes: stripCallbacks(getNodes()), edges: getEdges() }, curId, meta);
      localStorage.setItem('brainstorm-gist-id',  result.id);
      localStorage.setItem('brainstorm-gist-url', result.htmlUrl);
      setGistId(result.id);
      setGistUrl(result.htmlUrl);
      if (result.sha) updateCurrentSha(result.sha);
    } catch (err) {
      alert(`Gist save failed: ${err.message}`);
    } finally {
      setIsSavingGist(false);
    }
  }, [getNodes, getEdges, updateCurrentSha]);

  const handleSaveGist = useCallback(() => {
    if (!localStorage.getItem('brainstorm-github-token')) {
      pendingSaveRef.current = true;
      setGistPanel('token');
      return;
    }
    setShowCommitPanel(true);
  }, []);

  const handleTokenSave = useCallback((token) => {
    localStorage.setItem('brainstorm-github-token', token);
    setHasToken(true);
    setGistPanel(null);
    if (pendingSaveRef.current) { pendingSaveRef.current = false; setShowCommitPanel(true); }
  }, []);

  const handleClearToken = useCallback(() => {
    localStorage.removeItem('brainstorm-github-token');
    setHasToken(false);
    setGistPanel(null);
  }, []);

  const handleUnlinkGist = useCallback(() => {
    localStorage.removeItem('brainstorm-gist-id');
    localStorage.removeItem('brainstorm-gist-url');
    setGistId(null);
    setGistUrl(null);
    setGistPanel(null);
  }, []);

  const handleLoadGistId = useCallback(async (input) => {
    setGistPanel(null);
    try {
      const id = extractGistId(input);
      const { data, htmlUrl, id: resolvedId, sha } = await loadGist(id);
      if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) {
        alert('Invalid gist content — expected a brainstorm JSON.'); return;
      }
      const mappedNodes = data.nodes.map(mapNode);
      const mappedEdges = data.edges.map(e => ({ ...e, type: 'default', ...makeEdgeOptions(darkMode) }));
      const isLC = data.nodes.some(n => n.type === 'default' || n.type === 'smoothstep');
      setNodes(isLC ? dagreLayout(mappedNodes, mappedEdges) : deoverlapNodes(mappedNodes));
      setEdges(mappedEdges);
      localStorage.setItem('brainstorm-gist-id',  resolvedId);
      localStorage.setItem('brainstorm-gist-url', htmlUrl);
      setGistId(resolvedId);
      setGistUrl(htmlUrl);
      if (sha) updateCurrentSha(sha);
    } catch (err) {
      alert(`Gist load failed: ${err.message}`);
    }
  }, [setNodes, setEdges, darkMode, updateCurrentSha]);

  const handleLoadRevision = useCallback(async (sha) => {
    if (!gistId) return;
    setShowHistory(false);
    try {
      const token = localStorage.getItem('brainstorm-github-token');
      const { data } = await loadGistRevision(gistId, sha, token);
      if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) {
        alert('Invalid revision content.'); return;
      }
      const mappedNodes = data.nodes.map(mapNode);
      const mappedEdges = data.edges.map(e => ({ ...e, type: 'default', ...makeEdgeOptions(darkMode) }));
      setNodes(deoverlapNodes(mappedNodes));
      setEdges(mappedEdges);
      updateCurrentSha(sha);
    } catch (err) {
      alert(`Failed to load revision: ${err.message}`);
    }
  }, [gistId, darkMode, setNodes, setEdges, updateCurrentSha]);

  const handleLoadLatest = useCallback(async () => {
    if (!gistId) return;
    const token = localStorage.getItem('brainstorm-github-token');
    try {
      const { data, sha } = await loadGist(gistId, token);
      if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) return;
      const mappedNodes = data.nodes.map(mapNode);
      const mappedEdges = data.edges.map(e => ({ ...e, type: 'default', ...makeEdgeOptions(darkMode) }));
      setNodes(deoverlapNodes(mappedNodes));
      setEdges(mappedEdges);
      if (sha) updateCurrentSha(sha);
    } catch (err) {
      alert(`Load failed: ${err.message}`);
    }
  }, [gistId, darkMode, setNodes, setEdges, updateCurrentSha]);

  return {
    gistPanel, setGistPanel,
    gistId, gistUrl,
    hasToken,
    isSavingGist,
    showCommitPanel, setShowCommitPanel,
    currentGistSha,
    newVersionAvailable, setNewVersionAvailable,
    showHistory, setShowHistory,
    pendingSaveRef,
    doSaveGist,
    handleSaveGist,
    handleTokenSave,
    handleClearToken,
    handleUnlinkGist,
    handleLoadGistId,
    handleLoadRevision,
    handleLoadLatest,
  };
}
