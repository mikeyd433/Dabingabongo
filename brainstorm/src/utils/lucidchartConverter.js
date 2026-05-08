// Converts a LucidChart JSON export into React Flow { nodes, edges }
// LucidChart JSON has no position data, so we auto-layout hierarchically.

export function isLucidChart(data) {
  return data?.product === 'lucidchart' && Array.isArray(data?.pages);
}

export function convertLucidChart(data) {
  const pages = data.pages ?? [];
  if (pages.length === 0) throw new Error('No pages found in LucidChart file.');

  // Import the first page; surface a warning if there are more
  const page = pages[0];
  const shapes = page.items?.shapes ?? [];
  const lines  = page.items?.lines  ?? [];
  const extraPages = pages.length - 1;

  if (shapes.length === 0) throw new Error('No shapes found on page 1.');

  // Build shape id set so we can skip line→line connections
  const shapeIds = new Set(shapes.map(s => s.id));

  // Nodes — label comes from the first textArea tagged "Text"
  const rawNodes = shapes.map(shape => {
    const area  = shape.textAreas?.find(t => t.label === 'Text') ?? shape.textAreas?.[0];
    const label = (area?.text ?? '').trim();
    return {
      id:   shape.id,
      type: 'editableNode',
      position: { x: 0, y: 0 },          // filled in by layout below
      data: { label: label || 'Node', color: 'default' },
    };
  });

  // Edges — endpoint1 = source (no arrowhead), endpoint2 = target (arrowhead)
  const edgeColor = '#475569';
  const edges = [];
  lines.forEach(line => {
    const src = line.endpoint1?.connectedTo;
    const tgt = line.endpoint2?.connectedTo;
    if (!src || !tgt) return;
    if (!shapeIds.has(src) || !shapeIds.has(tgt)) return; // skip line-to-line
    if (src === tgt) return;                               // skip self-loops
    edges.push({
      id:        line.id,
      source:    src,
      target:    tgt,
      type:      'default',
      markerEnd: { type: 'arrowclosed', color: edgeColor },
      style:     { stroke: edgeColor, strokeWidth: 2 },
      data:      {},
    });
  });

  // Auto-layout: hierarchical (top-down) based on graph depth
  const nodes = hierarchicalLayout(rawNodes, edges);

  return { nodes, edges, extraPages };
}

// ── Hierarchical top-down layout ───────────────────────────────────────────

function hierarchicalLayout(nodes, edges) {
  const COL_W = 280;   // node cell width  (includes gap)
  const ROW_H = 130;   // node cell height (includes gap)

  // Build forward adjacency and in-degree maps
  const children  = new Map(nodes.map(n => [n.id, []]));
  const inDegree  = new Map(nodes.map(n => [n.id, 0]));

  edges.forEach(({ source, target }) => {
    if (children.has(source) && inDegree.has(target)) {
      children.get(source).push(target);
      inDegree.set(target, inDegree.get(target) + 1);
    }
  });

  // BFS from root nodes (in-degree 0) to assign depth levels
  const levelOf = new Map();
  const queue   = [];

  nodes.forEach(n => {
    if (inDegree.get(n.id) === 0) {
      levelOf.set(n.id, 0);
      queue.push(n.id);
    }
  });

  // If the whole graph is cyclic, start from every node at level 0
  if (queue.length === 0) {
    nodes.forEach(n => { levelOf.set(n.id, 0); queue.push(n.id); });
  }

  const visited = new Set();
  while (queue.length > 0) {
    const id  = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const cur = levelOf.get(id) ?? 0;
    children.get(id)?.forEach(child => {
      // Push child down if we find a longer path (gives correct depth in DAGs)
      if (!levelOf.has(child) || levelOf.get(child) < cur + 1) {
        levelOf.set(child, cur + 1);
      }
      if (!visited.has(child)) queue.push(child);
    });
  }

  // Any disconnected nodes default to level 0
  nodes.forEach(n => { if (!levelOf.has(n.id)) levelOf.set(n.id, 0); });

  // Collect nodes per level
  const byLevel = new Map();
  nodes.forEach(n => {
    const l = levelOf.get(n.id);
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l).push(n.id);
  });

  // Centre each level row horizontally
  const maxCount    = Math.max(...[...byLevel.values()].map(a => a.length));
  const totalWidth  = maxCount * COL_W;

  const posMap = new Map();
  byLevel.forEach((ids, level) => {
    const rowWidth = ids.length * COL_W;
    const offsetX  = (totalWidth - rowWidth) / 2;
    ids.forEach((id, i) => {
      posMap.set(id, { x: offsetX + i * COL_W, y: level * ROW_H });
    });
  });

  return nodes.map(n => ({ ...n, position: posMap.get(n.id) ?? { x: 0, y: 0 } }));
}
