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
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

import CustomNode, { NODE_COLORS } from './components/CustomNode';
import WaypointEdge from './components/WaypointEdge';
import Toolbar from './components/Toolbar';
import { FlowContext } from './contexts/FlowContext';
import { isLucidChart, convertLucidChart, convertLucidChartSVG, applyLucidChartSVGPositions } from './utils/lucidchartConverter';
import dagre from 'dagre';
import LZString from 'lz-string';

const nodeTypes = { editableNode: CustomNode };
const edgeTypes = { default: WaypointEdge };
const STORAGE_KEY = 'brainstorm-v1';

function encodeShareState(nodes, edges) {
  return LZString.compressToEncodedURIComponent(JSON.stringify({ nodes, edges }));
}

function decodeShareState(encoded) {
  return JSON.parse(LZString.decompressFromEncodedURIComponent(encoded));
}

function loadSaved() {
  // URL-shared state takes priority over localStorage
  const hash = window.location.hash;
  if (hash.startsWith('#share=')) {
    try {
      const data = decodeShareState(hash.slice(7));
      if (Array.isArray(data?.nodes) && Array.isArray(data?.edges)) return data;
    } catch {}
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function stripCallbacks(nodes) {
  return nodes.map(n => ({ ...n, data: { label: n.data.label, color: n.data.color } }));
}

// Full hierarchical layout via dagre — used when importing Lucidchart-origin files.
function dagreLayout(nodes, edges) {
  const NODE_W = 200, NODE_H = 60;
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 130, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e, i) => {
    if (g.hasNode(e.source) && g.hasNode(e.target))
      g.setEdge(e.source, e.target, {}, `e${i}`);
  });

  dagre.layout(g);

  return nodes.map(n => {
    const p = g.node(n.id);
    return p ? {
      ...n,
      position: { x: Math.round(p.x - NODE_W / 2), y: Math.round(p.y - NODE_H / 2) },
      style: { width: NODE_W },
    } : n;
  });
}

// Lightweight deoverlap — used for native brainstorm files with already-good positions.
function deoverlapNodes(nodes) {
  const SNAP = 120, STEP_X = 280, STEP_Y = 110, COLS = 3;
  const groups = new Map();
  nodes.forEach(node => {
    const key = `${Math.round(node.position.x / SNAP)},${Math.round(node.position.y / SNAP)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node.id);
  });
  const offsets = new Map();
  groups.forEach(ids => {
    ids.forEach((id, i) => offsets.set(id, { dx: (i % COLS) * STEP_X, dy: Math.floor(i / COLS) * STEP_Y }));
  });
  return nodes.map(node => {
    const o = offsets.get(node.id) ?? { dx: 0, dy: 0 };
    return { ...node, position: { x: Math.round(node.position.x + o.dx), y: Math.round(node.position.y + o.dy) } };
  });
}

function makeEdgeOptions(darkMode) {
  const color = darkMode ? '#475569' : '#94a3b8';
  return {
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: 2 },
  };
}

// Inner component — must live inside ReactFlowProvider
function FlowCanvas({ darkMode, onToggleDark, isMobile }) {
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  const wrapper = useRef(null);
  const { screenToFlowPosition, getNodes, getEdges, setViewport } = useReactFlow();

  const saved = useMemo(() => loadSaved(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(saved?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved?.edges ?? []);

  useEffect(() => {
    if (saved?.viewport) setViewport(saved.viewport);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        nodes: stripCallbacks(nodes),
        edges,
      }));
    } catch {}
  }, [nodes, edges]);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const historyRef     = useRef([]);
  const historyIdxRef  = useRef(-1);
  const debounceRef    = useRef(null);
  const isRestoringRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Debounced snapshot — fires 400 ms after the last nodes/edges change
  useEffect(() => {
    if (isRestoringRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const snap = { nodes: stripCallbacks(getNodes()), edges: getEdges() };
      const cur  = historyRef.current[historyIdxRef.current];
      if (cur && JSON.stringify(snap) === JSON.stringify(cur)) return;
      historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
      historyRef.current.push(snap);
      if (historyRef.current.length > 50) historyRef.current.shift();
      historyIdxRef.current = historyRef.current.length - 1;
      setCanUndo(historyIdxRef.current > 0);
      setCanRedo(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [nodes, edges, getNodes, getEdges]);

  const restoreSnapshot = useCallback((snap) => {
    isRestoringRef.current = true;
    setNodes(snap.nodes.map(n => ({ ...n, type: 'editableNode', data: { label: n.data?.label ?? 'Node', color: n.data?.color ?? 'default' } })));
    setEdges(snap.edges.map(e => ({ ...e, type: 'default', ...makeEdgeOptions(darkMode) })));
    setTimeout(() => { isRestoringRef.current = false; }, 500);
  }, [setNodes, setEdges, darkMode]);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    restoreSnapshot(historyRef.current[historyIdxRef.current]);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    restoreSnapshot(historyRef.current[historyIdxRef.current]);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, [restoreSnapshot]);

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Copy / paste nodes (Ctrl+C / Ctrl+V)
  const clipboardRef  = useRef(null);
  const pasteCountRef = useRef(0);
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Don't intercept when user is typing inside an input or textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'c') {
        const selNodes = getNodes().filter(n => n.selected);
        if (!selNodes.length) return;
        e.preventDefault();
        const selIds = new Set(selNodes.map(n => n.id));
        clipboardRef.current = {
          nodes: stripCallbacks(selNodes),
          edges: getEdges().filter(ed => selIds.has(ed.source) && selIds.has(ed.target)),
        };
        pasteCountRef.current = 0;
      }

      if (e.key === 'v') {
        const cb = clipboardRef.current;
        if (!cb?.nodes.length) return;
        e.preventDefault();
        pasteCountRef.current++;
        const off = pasteCountRef.current * 30;
        const idMap = {};
        const newNodes = cb.nodes.map(n => {
          const newId = `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          idMap[n.id] = newId;
          return { ...n, id: newId, position: { x: n.position.x + off, y: n.position.y + off }, selected: true, type: 'editableNode' };
        });
        const newEdges = cb.edges
          .filter(ed => idMap[ed.source] && idMap[ed.target])
          .map(ed => ({ ...ed, id: `e${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: idMap[ed.source], target: idMap[ed.target], ...makeEdgeOptions(darkMode) }));
        setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), ...newNodes]);
        setEdges(es => [...es, ...newEdges]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [getNodes, getEdges, setNodes, setEdges, darkMode]);

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

  const ctx = useMemo(() => ({ updateLabel, updateColor, updateColorForAll }), [updateLabel, updateColor, updateColorForAll]);

  // ── Flow event handlers ────────────────────────────────────────────────────
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, ...makeEdgeOptions(darkMode) }, eds));
  }, [setEdges, darkMode]);

  // Desktop: double-click canvas to create node (tracked via timing in onPaneClick)
  const lastPaneClickRef = useRef(0);
  const onPaneClick = useCallback((event) => {
    if (isMobile) return;
    if (event.shiftKey) return;
    const now = Date.now();
    const elapsed = now - lastPaneClickRef.current;
    lastPaneClickRef.current = now;
    if (elapsed > 50 && elapsed < 350) {
      // Second click within double-click window — create node
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setNodes(ns => [...ns, {
        id: `n${now}`,
        type: 'editableNode',
        position: pos,
        data: { label: 'New Node', color: 'default' },
      }]);
    }
  }, [screenToFlowPosition, setNodes, isMobile]);

  // Mobile: FAB adds node at viewport centre
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
      position: { x: pos.x - 60, y: pos.y - 20 },
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
    // Auto-detect LucidChart format
    if (isLucidChart(data)) {
      try {
        const { nodes: lNodes, edges: lEdges, extraPages } = convertLucidChart(data);
        setNodes(lNodes);
        setEdges(lEdges.map(e => ({ ...e, ...makeEdgeOptions(darkMode) })));
        if (extraPages > 0) {
          alert(`Imported page 1 of ${extraPages + 1}. Only the first page is imported.`);
        }
      } catch (err) {
        alert(`LucidChart import failed: ${err.message}`);
      }
      return;
    }
    // Native brainstorm format
    if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) {
      alert('Invalid file. Expected a brainstorm JSON or a LucidChart JSON export.'); return;
    }
    const mappedNodes = data.nodes.map(n => ({
      ...n,
      type: 'editableNode',
      style: undefined,
      data: { label: n.data?.label ?? 'Node', color: n.data?.color ?? 'default' },
    }));
    const mappedEdges = data.edges.map(e => ({ ...e, type: 'default', ...makeEdgeOptions(darkMode) }));
    // If the source file used Lucidchart node/edge types, apply dagre for a clean hierarchy.
    // Otherwise keep the existing positions and just deoverlap.
    const isLucidchartOrigin = data.nodes.some(n => n.type === 'default' || n.type === 'smoothstep');
    setNodes(isLucidchartOrigin ? dagreLayout(mappedNodes, mappedEdges) : deoverlapNodes(mappedNodes));
    setEdges(mappedEdges);
  }, [setNodes, setEdges, darkMode]);

  const handleImportSVG = useCallback((svgText) => {
    const currentNodes = getNodes();
    if (currentNodes.length > 0) {
      // Nodes already loaded from JSON — apply SVG positions/colours on top.
      try {
        const updated = applyLucidChartSVGPositions(svgText, currentNodes);
        setNodes(updated);
      } catch (err) {
        alert(`SVG position import failed: ${err.message}`);
      }
    } else {
      // Empty canvas — fall back to standalone SVG converter.
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
  const canvasBg      = darkMode ? '#0f172a' : '#f1f5f9';
  const dotColor      = darkMode ? '#1e293b' : '#cbd5e1';
  const controlsBg    = darkMode ? '#020617' : '#ffffff';
  const controlsBorder = darkMode ? '#1e293b' : '#e2e8f0';
  const hintColor     = darkMode ? '#334155' : '#94a3b8';

  const hint = isMobile
    ? (mobileSelectMode ? 'Drag to select multiple nodes · Tap Select to exit' : 'Tap + to add · Long-press to edit · Select edge + Del to delete')
    : 'Double-click canvas to add · Double-click node to edit · Double-click edge to label · Ctrl+C/V to copy/paste';

  return (
    <FlowContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif' }}>
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
          mobileSelectMode={mobileSelectMode}
          onToggleMobileSelect={() => setMobileSelectMode(m => !m)}
          onDeleteSelected={handleDeleteSelected}
          onShare={handleShare}
        />

        <div ref={wrapper} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
            selectionKeyCode={isMobile ? null : 'Shift'}
            selectionOnDrag={isMobile && mobileSelectMode}
            panOnDrag={isMobile ? !mobileSelectMode : true}
            zoomOnDoubleClick={false}
            minZoom={0.05}
            fitView={!saved?.nodes?.length}
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: false }}
            style={{ background: canvasBg }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color={dotColor} />
            <Controls style={{ background: controlsBg, border: `1px solid ${controlsBorder}`, borderRadius: 8 }} />
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
                width:  isMobile ? 80 : 120,
                height: isMobile ? 60 : 80,
              }}
            />
          </ReactFlow>

          {/* Mobile FAB — add node at centre */}
          {isMobile && (
            <button
              onClick={addNodeAtCenter}
              aria-label="Add node"
              style={{
                position: 'absolute',
                bottom: 76,
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
        </div>
      </div>
    </FlowContext.Provider>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('brainstorm-dark') !== 'false'; } catch { return true; }
  });

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
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
      <FlowCanvas darkMode={darkMode} onToggleDark={toggleDark} isMobile={isMobile} />
    </ReactFlowProvider>
  );
}
