import { MarkerType } from 'reactflow';
import LZString from 'lz-string';
import dagre from 'dagre';

export const STORAGE_KEY = 'brainstorm-v1';

export function makeEdgeOptions(darkMode) {
  const color = darkMode ? '#475569' : '#94a3b8';
  return {
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: 2 },
  };
}

export function stripCallbacks(nodes) {
  return nodes.map(n => ({ ...n, data: { label: n.data.label, color: n.data.color } }));
}

export function encodeShareState(nodes, edges) {
  return LZString.compressToEncodedURIComponent(JSON.stringify({ nodes, edges }));
}

export function decodeShareState(encoded) {
  return JSON.parse(LZString.decompressFromEncodedURIComponent(encoded));
}

export function loadSaved() {
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

// Full hierarchical layout via dagre — for Lucidchart-origin files.
export function dagreLayout(nodes, edges) {
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

// Lightweight deoverlap — for native brainstorm files with already-good positions.
export function deoverlapNodes(nodes) {
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
