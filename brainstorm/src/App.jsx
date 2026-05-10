import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

import CustomNode, { NODE_COLORS } from './components/CustomNode';
import WaypointEdge from './components/WaypointEdge';
import Toolbar from './components/Toolbar';
import SearchBar from './components/SearchBar';
import ContextMenu from './components/ContextMenu';
import GistPanel from './components/GistPanel';
import CommitPanel from './components/CommitPanel';
import GistHistoryPanel from './components/GistHistoryPanel';
import { FlowContext } from './contexts/FlowContext';
import { isLucidChart, convertLucidChart, convertLucidChartSVG, applyLucidChartSVGPositions } from './utils/lucidchartConverter';
import { useHistory } from './hooks/useHistory';
import { useClipboard } from './hooks/useClipboard';
import { useGist } from './hooks/useGist';
import {
  STORAGE_KEY,
  makeEdgeOptions,
  stripCallbacks,
  loadSaved,
  dagreLayout,
  deoverlapNodes,
  encodeShareState,
} from './utils/flowUtils';

const nodeTypes = { editableNode: CustomNode };
const edgeTypes = { default: WaypointEdge };

// Inner component — must live inside ReactFlowProvider
function FlowCanvas({ darkMode, onToggleDark, isMobile, isTablet }) {
  const isTouch = isMobile || isTablet;
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  const wrapper = useRef(null);

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ── Presentation mode ──────────────────────────────────────────────────────
  const [presentationMode, setPresentationMode] = useState(false);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  const { screenToFlowPosition, getNodes, getEdges, setViewport, setCenter } = useReactFlow();

  const saved = useMemo(() => loadSaved(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(saved?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved?.edges ?? []);

  useEffect(() => {
    if (saved?.viewport) setViewport(saved.viewport);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: stripCallbacks(nodes), edges }));
    } catch {}
  }, [nodes, edges]);

  // ── Custom hooks ───────────────────────────────────────────────────────────
  const { undo, redo, canUndo, canRedo } = useHistory({
    darkMode, getNodes, getEdges, setNodes, setEdges, nodes, edges,
  });

  useClipboard({ darkMode, getNodes, getEdges, setNodes, setEdges });

  const {
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
  } = useGist({ darkMode, getNodes, getEdges, setNodes, setEdges });

  // ── Context callbacks ──────────────────────────────────────────────────────
  const updateLabel = useCallback((id, label) =>
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n)),
  [setNodes]);

  const updateColor = useCallback((id, color) =>
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, color } } : n)),
  [setNodes]);

  const updateColorForAll = useCallback((ids, color) =>
    setNodes(ns => ns.map(n => ids.includes(n.id) ? { ...n, data: { ...n.data, color } } : n)),
  [setNodes]);

  // ── Context menu actions ───────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    const selectedIds = getNodes().filter(n => n.selected).map(n => n.id);
    const ids = selectedIds.includes(node.id) && selectedIds.length > 1
      ? selectedIds
      : [node.id];
    setContextMenu({ type: 'node', ids, x: event.clientX, y: event.clientY });
  }, [getNodes]);

  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setContextMenu({ type: 'edge', id: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const handleContextDeleteNodes = useCallback((ids) => {
    const idSet = new Set(ids);
    setNodes(ns => ns.filter(n => !idSet.has(n.id)));
    setEdges(es => es.filter(e => !idSet.has(e.source) && !idSet.has(e.target)));
  }, [setNodes, setEdges]);

  const handleContextDuplicate = useCallback((ids) => {
    const toBeCopied = getNodes().filter(n => ids.includes(n.id));
    const newNodes = toBeCopied.map((n, i) => ({
      ...n,
      id: `n${Date.now()}-${i}`,
      position: { x: n.position.x + 24, y: n.position.y + 24 },
      selected: false,
    }));
    setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), ...newNodes]);
  }, [getNodes, setNodes]);

  const handleContextColor = useCallback((ids, color) =>
    setNodes(ns => ns.map(n => ids.includes(n.id) ? { ...n, data: { ...n.data, color } } : n)),
  [setNodes]);

  const handleContextDeleteEdge = useCallback((id) =>
    setEdges(es => es.filter(e => e.id !== id)),
  [setEdges]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const searchMatches = useMemo(() => {
    if (!searchOpen || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => (n.data?.label ?? '').toLowerCase().includes(q));
  }, [searchOpen, searchQuery, nodes]);

  const panToMatch = useCallback((node) => {
    if (!node) return;
    const n = getNodes().find(gn => gn.id === node.id) ?? node;
    const x = n.position.x + (n.width  ?? 150) / 2;
    const y = n.position.y + (n.height ??  50) / 2;
    setCenter(x, y, { zoom: 1.2, duration: 500 });
  }, [getNodes, setCenter]);

  // Auto-navigate to first match whenever the query changes
  useEffect(() => {
    if (!searchOpen) return;
    setSearchIndex(0);
    if (searchMatches.length > 0) panToMatch(searchMatches[0]);
  }, [searchQuery, searchOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNextMatch = useCallback(() => {
    if (!searchMatches.length) return;
    const next = (searchIndex + 1) % searchMatches.length;
    setSearchIndex(next);
    panToMatch(searchMatches[next]);
  }, [searchMatches, searchIndex, panToMatch]);

  const goPrevMatch = useCallback(() => {
    if (!searchMatches.length) return;
    const prev = (searchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchIndex(prev);
    panToMatch(searchMatches[prev]);
  }, [searchMatches, searchIndex, panToMatch]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchIndex(0);
  }, []);

  // ── Presentation mode ──────────────────────────────────────────────────────
  const enterPresentation = useCallback(() => {
    closeSearch();
    setPresentationMode(true);
    document.documentElement.requestFullscreen?.().catch?.(() => {});
  }, [closeSearch]);

  const exitPresentation = useCallback(() => {
    setPresentationMode(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // Sync with browser fullscreen (e.g. user pressing F11 or browser Esc)
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setPresentationMode(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (contextMenu)      { closeContextMenu();  return; }
        if (presentationMode) { exitPresentation();  return; }
        if (searchOpen)       { closeSearch();        return; }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [contextMenu, presentationMode, searchOpen, closeContextMenu, exitPresentation, closeSearch]);

  // ── Context value ──────────────────────────────────────────────────────────
  const searchMatchIds  = useMemo(() => new Set(searchMatches.map(n => n.id)), [searchMatches]);
  const searchCurrentId = searchMatches[searchIndex]?.id ?? null;

  const ctx = useMemo(() => ({
    updateLabel, updateColor, updateColorForAll,
    presentationMode, searchMatchIds, searchCurrentId,
  }), [updateLabel, updateColor, updateColorForAll, presentationMode, searchMatchIds, searchCurrentId]);

  // ── Flow event handlers ────────────────────────────────────────────────────
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, ...makeEdgeOptions(darkMode) }, eds));
  }, [setEdges, darkMode]);

  // Desktop: double-click canvas to create node
  const lastPaneClickRef = useRef(0);
  const onPaneClick = useCallback((event) => {
    closeContextMenu();
    if (isTouch) return;
    if (event.shiftKey) return;
    const now = Date.now();
    const elapsed = now - lastPaneClickRef.current;
    lastPaneClickRef.current = now;
    if (elapsed > 50 && elapsed < 350) {
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setNodes(ns => [...ns, {
        id: `n${now}`,
        type: 'editableNode',
        position: pos,
        style: { width: 150 },
        data: { label: 'New Node', color: 'default' },
      }]);
    }
  }, [closeContextMenu, screenToFlowPosition, setNodes, isTouch]);

  // Touch: FAB adds node at viewport centre
  const addNodeAtCenter = useCallback(() => {
    const bounds = wrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    const pos = screenToFlowPosition({
      x: bounds.left + bounds.width  / 2,
      y: bounds.top  + bounds.height / 2,
    });
    const id = `n${Date.now()}`;
    setNodes(ns => [...ns, {
      id,
      type: 'editableNode',
      position: { x: pos.x - 75, y: pos.y - 20 },
      style: { width: 150 },
      data: { label: 'New Node', color: 'default' },
    }]);
  }, [screenToFlowPosition, setNodes]);

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    if (!getNodes().length && !getEdges().length) return;
    if (confirm('Clear the entire canvas?')) { setNodes([]); setEdges([]); }
  }, [getNodes, getEdges, setNodes, setEdges]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ nodes: stripCallbacks(getNodes()), edges: getEdges() }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `brainstorm-${Date.now()}.json` }).click();
    URL.revokeObjectURL(url);
  }, [getNodes, getEdges]);

  const handleImportJSON = useCallback((data) => {
    if (isLucidChart(data)) {
      try {
        const { nodes: lNodes, edges: lEdges, extraPages } = convertLucidChart(data);
        setNodes(lNodes);
        setEdges(lEdges.map(e => ({ ...e, ...makeEdgeOptions(darkMode) })));
        if (extraPages > 0) alert(`Imported page 1 of ${extraPages + 1}. Only the first page is imported.`);
      } catch (err) {
        alert(`LucidChart import failed: ${err.message}`);
      }
      return;
    }
    if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) {
      alert('Invalid file. Expected a brainstorm JSON or a LucidChart JSON export.'); return;
    }
    const mappedNodes = data.nodes.map(n => ({
      ...n,
      type: 'editableNode',
      data: { label: n.data?.label ?? 'Node', color: n.data?.color ?? 'default' },
    }));
    const mappedEdges = data.edges.map(e => ({ ...e, type: 'default', ...makeEdgeOptions(darkMode) }));
    const isLucidchartOrigin = data.nodes.some(n => n.type === 'default' || n.type === 'smoothstep');
    setNodes(isLucidchartOrigin ? dagreLayout(mappedNodes, mappedEdges) : deoverlapNodes(mappedNodes));
    setEdges(mappedEdges);
  }, [setNodes, setEdges, darkMode]);

  const handleImportSVG = useCallback((svgText) => {
    const currentNodes = getNodes();
    if (currentNodes.length > 0) {
      try {
        const updated = applyLucidChartSVGPositions(svgText, currentNodes);
        setNodes(updated);
      } catch (err) {
        alert(`SVG position import failed: ${err.message}`);
      }
    } else {
      try {
        const { nodes: sNodes, edges: sEdges } = convertLucidChartSVG(svgText);
        setNodes(sNodes);
        setEdges(sEdges.map(e => ({ ...e, ...makeEdgeOptions(darkMode) })));
      } catch (err) {
        alert(`SVG import failed: ${err.message}`);
      }
    }
  }, [getNodes, setNodes, setEdges, darkMode]);

  const handleDeleteSelected = useCallback(() => {
    const selNodeIds = new Set(getNodes().filter(n => n.selected).map(n => n.id));
    const selEdgeIds = new Set(getEdges().filter(e => e.selected).map(e => e.id));
    if (!selNodeIds.size && !selEdgeIds.size) return;
    setNodes(ns => ns.filter(n => !selNodeIds.has(n.id)));
    setEdges(es => es.filter(e => !selEdgeIds.has(e.id) && !selNodeIds.has(e.source) && !selNodeIds.has(e.target)));
  }, [getNodes, getEdges, setNodes, setEdges]);

  const handleShare = useCallback(() => {
    const encoded = encodeShareState(stripCallbacks(getNodes()), getEdges());
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    navigator.clipboard.writeText(url)
      .then(() => alert('Shareable link copied to clipboard!'))
      .catch(() => prompt('Copy this shareable link:', url));
  }, [getNodes, getEdges]);

  const handleExportPNG = useCallback(() => {
    const el = wrapper.current?.querySelector('.react-flow__viewport');
    if (!el) return;
    toPng(el, { backgroundColor: darkMode ? '#0f172a' : '#f1f5f9', pixelRatio: 2 })
      .then(url => Object.assign(document.createElement('a'), { href: url, download: `brainstorm-${Date.now()}.png` }).click())
      .catch(err => { console.error(err); alert('PNG export failed — try zooming to fit first.'); });
  }, [darkMode]);

  // ── Theme values ───────────────────────────────────────────────────────────
  const canvasBg       = darkMode ? '#0f172a' : '#f1f5f9';
  const dotColor       = darkMode ? '#1e293b' : '#cbd5e1';
  const controlsBg     = darkMode ? '#020617' : '#ffffff';
  const controlsBorder = darkMode ? '#1e293b' : '#e2e8f0';
  const hintColor      = darkMode ? '#334155' : '#94a3b8';

  const hint = isTouch
    ? (mobileSelectMode ? 'Drag to select multiple nodes · Tap Select to exit' : 'Tap + to add · Double-tap node to edit · Select edge + Del to delete')
    : 'Double-click canvas to add · Double-click node to edit · Ctrl+C/V copy/paste · Ctrl+F search';

  return (
    <FlowContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif' }}>
        {!presentationMode && (
          <Toolbar
            onClear={handleClear}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onImportSVG={handleImportSVG}
            onExportPNG={handleExportPNG}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            darkMode={darkMode}
            onToggleDark={onToggleDark}
            isMobile={isMobile}
            isTablet={isTablet}
            mobileSelectMode={mobileSelectMode}
            onToggleMobileSelect={() => setMobileSelectMode(m => !m)}
            onDeleteSelected={handleDeleteSelected}
            onShare={handleShare}
            onSaveGist={handleSaveGist}
            onLoadGist={() => setGistPanel('load')}
            onManageToken={() => setGistPanel('token')}
            onShowHistory={() => setShowHistory(true)}
            hasGistToken={hasToken}
            gistUrl={gistUrl}
            isSavingGist={isSavingGist}
            hasGist={Boolean(gistId)}
            onPresent={enterPresentation}
            onOpenSearch={() => setSearchOpen(true)}
          />
        )}

        <div ref={wrapper} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
            selectionKeyCode={isTouch ? null : 'Shift'}
            selectionOnDrag={isTouch && mobileSelectMode}
            panOnDrag={isTouch ? !mobileSelectMode : true}
            zoomOnDoubleClick={false}
            minZoom={0.05}
            fitView={!saved?.nodes?.length}
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: false }}
            style={{ background: canvasBg }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color={dotColor} />
            {!presentationMode && (
              <Controls style={{ background: controlsBg, border: `1px solid ${controlsBorder}`, borderRadius: 8 }} />
            )}
            {!presentationMode && (
              <MiniMap
                nodeColor={n => {
                  const c = NODE_COLORS.find(col => col.name === (n.data?.color ?? 'default')) ?? NODE_COLORS[NODE_COLORS.length - 1];
                  return c.border;
                }}
                nodeStrokeWidth={0}
                position={isMobile ? 'bottom-left' : 'bottom-right'}
                maskColor="rgba(2,6,23,0.65)"
                style={{
                  background: '#020617',
                  border: `1px solid ${controlsBorder}`,
                  borderRadius: 8,
                  width:  isMobile ? 80 : isTablet ? 100 : 120,
                  height: isMobile ? 60 : isTablet ? 70  : 80,
                }}
              />
            )}
          </ReactFlow>

          {/* FAB — add node at centre (touch devices) */}
          {isTouch && !presentationMode && (
            <button
              onClick={addNodeAtCenter}
              aria-label="Add node"
              style={{
                position: 'absolute',
                bottom: isTablet ? 92 : 76,
                right: 12,
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#006600',
                border: '2px solid #00ff00',
                color: '#00ff00',
                fontSize: 28,
                lineHeight: 1,
                cursor: 'pointer',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(0,255,0,0.2)',
                touchAction: 'manipulation',
              }}
            >
              +
            </button>
          )}

          {newVersionAvailable && (
            <div style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0f2d1a',
              border: '1px solid #166534',
              borderRadius: 8,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 20,
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ color: '#22c55e', fontSize: 13 }}>New version available</span>
              <button
                onClick={handleLoadLatest}
                style={{ padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', border: '1px solid #22c55e', background: '#0f4c0f', color: '#22c55e', fontFamily: 'Inter, sans-serif' }}
              >
                Load
              </button>
              <button
                onClick={() => setNewVersionAvailable(false)}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Bottom hint */}
          {!presentationMode && (
            <div style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              color: hintColor,
              fontSize: 11,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              maxWidth: '90vw',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
            }}>
              {hint}
            </div>
          )}

          {/* Presentation mode — subtle exit hint */}
          {presentationMode && (
            <div style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(100,116,139,0.4)',
              fontSize: 11,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              Press Esc to exit presentation
            </div>
          )}

          {/* Floating search bar */}
          {searchOpen && (
            <SearchBar
              query={searchQuery}
              onChange={setSearchQuery}
              matchCount={searchMatches.length}
              currentIndex={searchIndex}
              onNext={goNextMatch}
              onPrev={goPrevMatch}
              onClose={closeSearch}
            />
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={closeContextMenu}
          onDeleteNodes={handleContextDeleteNodes}
          onDuplicate={handleContextDuplicate}
          onColorNodes={handleContextColor}
          onDeleteEdge={handleContextDeleteEdge}
        />
      )}

      {gistPanel && (
        <GistPanel
          mode={gistPanel}
          onClose={() => { setGistPanel(null); pendingSaveRef.current = false; }}
          onTokenSave={handleTokenSave}
          onLoad={handleLoadGistId}
          hasToken={hasToken}
          onClearToken={handleClearToken}
          hasGist={Boolean(gistId)}
          onUnlinkGist={handleUnlinkGist}
        />
      )}
      {showCommitPanel && (
        <CommitPanel
          onSave={(meta) => { setShowCommitPanel(false); doSaveGist(meta); }}
          onClose={() => setShowCommitPanel(false)}
        />
      )}
      {showHistory && gistId && (
        <GistHistoryPanel
          gistId={gistId}
          currentSha={currentGistSha}
          onLoad={handleLoadRevision}
          onClose={() => setShowHistory(false)}
        />
      )}
    </FlowContext.Provider>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('brainstorm-dark') !== 'false'; } catch { return true; }
  });

  const getLayout = () => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const w = window.innerWidth;
    return { isMobile: coarse && w < 640, isTablet: coarse && w >= 640 };
  };
  const [{ isMobile, isTablet }, setLayout] = useState(getLayout);

  useEffect(() => {
    const check = () => setLayout(getLayout());
    const mql = window.matchMedia('(pointer: coarse)');
    window.addEventListener('resize', check);
    mql.addEventListener('change', check);
    return () => {
      window.removeEventListener('resize', check);
      mql.removeEventListener('change', check);
    };
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode(d => {
      const next = !d;
      try { localStorage.setItem('brainstorm-dark', String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <ReactFlowProvider>
      <FlowCanvas darkMode={darkMode} onToggleDark={toggleDark} isMobile={isMobile} isTablet={isTablet} />
    </ReactFlowProvider>
  );
}
