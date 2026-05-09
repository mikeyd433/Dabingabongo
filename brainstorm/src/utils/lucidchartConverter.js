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

// ── LucidChart SVG: apply positions to existing nodes ────────────────────
// Used after importing Lucidchart JSON: takes the SVG export (which has real
// coordinates) and applies positions + colours to the already-imported nodes.
// Matching is order-based — Lucidchart emits shapes in the same sequence in
// both exports.

export function applyLucidChartSVGPositions(svgText, existingNodes) {
  if (!existingNodes.length) return existingNodes;

  const parser = new DOMParser();
  const doc    = parser.parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Could not parse SVG file.');
  const svg = doc.documentElement;

  // Global SVG translate (e.g. translate(9021 401))
  const rootGroup = svg.querySelector('g[transform]');
  const gtMatch = (rootGroup?.getAttribute('transform') ?? '')
    .match(/translate\s*\(\s*([\d.e+-]+)[,\s]+([\d.e+-]+)\s*\)/);
  const GLOBAL_TX = gtMatch ? parseFloat(gtMatch[1]) : 0;
  const GLOBAL_TY = gtMatch ? parseFloat(gtMatch[2]) : 0;

  // Only match Lucidchart's rounded-rect node paths — excludes arrowheads/lines
  const nodeRectPattern = /^M([\d.e+-]+) ([\d.e+-]+)a6 6 0 0 [01] 6-6h([\d.e+-]+)a6 6 0 0 [01] 6 6v/;

  const svgShapes = [];
  svg.querySelectorAll('path').forEach(path => {
    const d = path.getAttribute('d') ?? '';
    const m = nodeRectPattern.exec(d);
    if (!m) return;
    const fill = (path.getAttribute('fill') ?? '').trim().toLowerCase();
    if (!fill || fill === 'none' || fill === '#fff' || fill === '#ffffff' || fill === 'white') return;
    svgShapes.push({
      x:    parseFloat(m[1]) + GLOBAL_TX,
      y:    parseFloat(m[2]) + GLOBAL_TY,
      fill: path.getAttribute('fill') ?? '',
    });
  });

  if (svgShapes.length === 0)
    throw new Error('No shapes found in SVG. Make sure you exported from the LucidChart desktop/web app.');

  // Normalise: shift to origin, scale to React Flow canvas space
  const minX  = Math.min(...svgShapes.map(s => s.x));
  const minY  = Math.min(...svgShapes.map(s => s.y));
  const SCALE = 0.3;

  function svgFillToNodeColor(fill) {
    if (!fill || fill === 'none') return null;
    const f = fill.trim();
    let r, g, b;
    if (/^#[0-9a-f]{6}$/i.test(f)) {
      r = parseInt(f.slice(1,3),16); g = parseInt(f.slice(3,5),16); b = parseInt(f.slice(5,7),16);
    } else if (/^#[0-9a-f]{3}$/i.test(f)) {
      r = parseInt(f[1]+f[1],16); g = parseInt(f[2]+f[2],16); b = parseInt(f[3]+f[3],16);
    } else return null;
    if (f.toLowerCase() === '#ffffff' || f.toLowerCase() === '#fff') return null;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    if (max - min < 30) return null;
    if (g >= r && g >= b) return 'green';
    if (b >= r && b > g * 0.8) return 'blue';
    if (r >= g && r >= b) {
      if (b > g * 1.2) return 'purple';
      if (g > 150)     return 'amber';
      return 'rose';
    }
    return null;
  }

  return existingNodes.map((node, i) => {
    const shape = svgShapes[i];
    if (!shape) return node;
    const updated = {
      ...node,
      position: {
        x: Math.round((shape.x - minX) * SCALE),
        y: Math.round((shape.y - minY) * SCALE),
      },
    };
    const color = svgFillToNodeColor(shape.fill);
    if (color) updated.data = { ...node.data, color };
    return updated;
  });
}

// ── LucidChart SVG → React Flow ───────────────────────────────────────────
// SVG has real x/y coordinates; connections are reconstructed from path endpoints.

export function convertLucidChartSVG(svgText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(svgText, 'image/svg+xml');

  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Could not parse SVG file.');

  const svg = doc.documentElement;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function parseTranslate(transform) {
    const m = (transform ?? '').match(
      /translate\s*\(\s*([\d.e+-]+)(?:[,\s]+([\d.e+-]+))?\s*\)/
    );
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2] ?? 0) } : { x: 0, y: 0 };
  }

  // Walk up the DOM accumulating translate transforms (ignores scale/rotate for now)
  function accumulatedPos(el) {
    let x = 0, y = 0, cur = el;
    while (cur && cur !== svg) {
      const { x: dx, y: dy } = parseTranslate(cur.getAttribute('transform'));
      x += dx; y += dy;
      cur = cur.parentElement;
    }
    return { x, y };
  }

  function extractLabel(g) {
    const seen  = new Set();
    const parts = [];
    g.querySelectorAll('text').forEach(t => {
      const tspans  = t.querySelectorAll('tspan');
      const content = tspans.length
        ? [...tspans].map(ts => ts.textContent.trim()).filter(Boolean).join(' ')
        : t.textContent.trim();
      if (content && !seen.has(content)) { seen.add(content); parts.push(content); }
    });
    if (parts.length) return parts.join('\n');
    const fo = g.querySelector('foreignObject');
    return fo ? fo.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  // ── Parse shapes ───────────────────────────────────────────────────────────

  const nodes    = [];
  const shapeMap = new Map(); // id → { cx, cy, w, h }
  const SHAPE_TAGS = new Set(['rect', 'ellipse', 'circle', 'polygon', 'foreignobject']);

  svg.querySelectorAll('g').forEach(g => {
    const shapeEl = [...g.children].find(c => SHAPE_TAGS.has(c.tagName.toLowerCase()));
    if (!shapeEl) return;

    const id = g.getAttribute('id') || g.getAttribute('data-id') || `svg-node-${nodes.length}`;
    if (shapeMap.has(id)) return; // dedup nested groups

    const { x, y } = accumulatedPos(g);
    const w = parseFloat(
      shapeEl.getAttribute('width')  ?? String((parseFloat(shapeEl.getAttribute('rx') ?? 75)) * 2)
    ) || 150;
    const h = parseFloat(
      shapeEl.getAttribute('height') ?? String((parseFloat(shapeEl.getAttribute('ry') ?? 30)) * 2)
    ) || 60;

    const label = extractLabel(g);

    nodes.push({
      id,
      type: 'editableNode',
      position: { x: Math.round(x), y: Math.round(y) },
      data: { label: label || 'Node', color: 'default' },
    });
    shapeMap.set(id, { cx: x + w / 2, cy: y + h / 2, w, h });
  });

  if (nodes.length === 0) {
    throw new Error(
      'No shapes detected in this SVG.\n\n' +
      'Try: File → Export → SVG from the LucidChart desktop/web app.\n' +
      'The mobile app SVG export may not include editable shape data.'
    );
  }

  // ── Reconstruct edges from path endpoints ──────────────────────────────────

  const edgeColor = '#475569';
  const edges     = [];
  const shapeArr  = [...shapeMap.entries()];

  // Snap radius: generously sized so endpoints don't have to hit the centre exactly
  const maxSnap = Math.max(400, ...[...shapeMap.values()].map(b => Math.max(b.w, b.h) * 2));

  function closestShape(px, py) {
    let bestId = null, bestDist = Infinity;
    for (const [id, box] of shapeArr) {
      const d = Math.hypot(px - box.cx, py - box.cy);
      if (d < bestDist) { bestDist = d; bestId = id; }
    }
    return bestDist <= maxSnap ? bestId : null;
  }

  // Extract the first M-command point and the last explicit coordinate from a path
  function pathEndpoints(d) {
    const mMatch = d.match(/[Mm]\s*([\d.e+-]+)[,\s]+([\d.e+-]+)/);
    if (!mMatch) return null;

    // Cubic bezier: last endpoint is the 6th number of each C segment
    const cubics = [...d.matchAll(
      /[Cc]\s*[\d.e+-, ]+?[\d.e+-, ]+?\s*([\d.e+-]+)[,\s]+([\d.e+-]+)\s*(?=[MCLHVQSATZmclhvqsatz]|$)/g
    )];
    // Fallback: any L/Q/T command
    const lines = [...d.matchAll(/[LlQqTt]\s*([\d.e+-]+)[,\s]+([\d.e+-]+)/g)];

    const last = cubics.length ? cubics[cubics.length - 1] : lines.length ? lines[lines.length - 1] : null;
    if (!last) return null;

    return {
      start: { x: parseFloat(mMatch[1]), y: parseFloat(mMatch[2]) },
      end:   { x: parseFloat(last[1]),   y: parseFloat(last[2])   },
    };
  }

  const seenPairs = new Set();
  svg.querySelectorAll('path').forEach(path => {
    const d     = path.getAttribute('d') ?? '';
    if (!d) return;

    // Skip filled shapes (arrows / decorative fills are usually connectors or markers)
    const styleFill = (path.getAttribute('style') ?? '').match(/fill\s*:\s*([^;]+)/)?.[1]?.trim() ?? '';
    const attrFill  = path.getAttribute('fill') ?? '';
    const fill      = styleFill || attrFill;
    if (fill && fill !== 'none' && !fill.includes('none') && fill !== 'transparent') return;

    const pts = pathEndpoints(d);
    if (!pts) return;

    // Add parent offset so coordinates are in the same space as shape positions
    const { x: ox, y: oy } = accumulatedPos(path);
    const srcId = closestShape(pts.start.x + ox, pts.start.y + oy);
    const tgtId = closestShape(pts.end.x   + ox, pts.end.y   + oy);
    if (!srcId || !tgtId || srcId === tgtId) return;

    const key = `${srcId}→${tgtId}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);

    edges.push({
      id:        `e-${srcId}-${tgtId}`,
      source:    srcId,
      target:    tgtId,
      type:      'default',
      markerEnd: { type: 'arrowclosed', color: edgeColor },
      style:     { stroke: edgeColor, strokeWidth: 2 },
      data:      {},
    });
  });

  return { nodes, edges };
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
