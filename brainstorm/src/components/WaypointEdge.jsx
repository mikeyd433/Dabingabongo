import { memo, useCallback, useRef, useEffect } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';

// Orthogonal (right-angle) SVG path through a list of {x,y} points
function orthogonalPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    d += ` L ${q.x} ${p.y} L ${q.x} ${q.y}`;
  }
  return d;
}

// Shortest distance from point p to line segment a→b (in flow space)
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// Draggable waypoint dot (rendered in flow-space via EdgeLabelRenderer)
function WaypointHandle({ x, y, index, onUpdate }) {
  const { getViewport } = useReactFlow();
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  const startDrag = useCallback((clientX, clientY) => {
    let last = { x: clientX, y: clientY };
    let cur  = { x, y };

    const onMove = (e) => {
      const mx = e.clientX ?? e.touches?.[0]?.clientX;
      const my = e.clientY ?? e.touches?.[0]?.clientY;
      if (mx == null) return;
      const { zoom } = getViewport();
      cur = { x: cur.x + (mx - last.x) / zoom, y: cur.y + (my - last.y) / zoom };
      last = { x: mx, y: my };
      onUpdateRef.current(index, cur);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onUp);
  }, [x, y, index, getViewport]);

  return (
    <div
      className="nodrag nopan"
      title="Drag to move · Double-click to remove"
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); startDrag(e.clientX, e.clientY); }}
      onTouchStart={e => { e.stopPropagation(); e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
      onDoubleClick={e => { e.stopPropagation(); onUpdateRef.current(index, null); }}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#00ff00',
        border: '2px solid #020617',
        cursor: 'grab',
        zIndex: 10,
        pointerEvents: 'all',
        touchAction: 'none',
      }}
    />
  );
}

// "+" button at segment midpoints when the edge is selected
function AddWaypointBtn({ x, y, insertAt, edgeId }) {
  const { setEdges } = useReactFlow();

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    setEdges(eds => eds.map(edge => {
      if (edge.id !== edgeId) return edge;
      const wps = [...(edge.data?.waypoints ?? [])];
      wps.splice(insertAt, 0, { x, y });
      return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
    }));
  }, [edgeId, insertAt, x, y, setEdges]);

  return (
    <div
      className="nodrag nopan"
      title="Click to add waypoint"
      onClick={handleClick}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#0f172a',
        border: '2px solid #475569',
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: '14px',
        textAlign: 'center',
        cursor: 'pointer',
        zIndex: 5,
        pointerEvents: 'all',
        userSelect: 'none',
      }}
    >
      +
    </div>
  );
}

export default memo(function WaypointEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, markerEnd, style, selected,
}) {
  const { setEdges, screenToFlowPosition, getViewport } = useReactFlow();
  const waypoints = data?.waypoints ?? [];

  // Build SVG path
  let edgePath;
  if (waypoints.length === 0) {
    [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  } else {
    edgePath = orthogonalPath([
      { x: sourceX, y: sourceY },
      ...waypoints,
      { x: targetX, y: targetY },
    ]);
  }

  // Stable waypoint update handler
  const handleWaypointUpdate = useCallback((index, newPos) => {
    setEdges(eds => eds.map(edge => {
      if (edge.id !== id) return edge;
      const wps = edge.data?.waypoints ?? [];
      return {
        ...edge,
        data: {
          ...(edge.data ?? {}),
          waypoints: newPos === null
            ? wps.filter((_, i) => i !== index)
            : wps.map((wp, i) => i === index ? newPos : wp),
        },
      };
    }));
  }, [setEdges, id]);

  // Drag the edge path itself to insert a waypoint and immediately move it
  const handleEdgePathDrag = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    // Find which segment the drag started on
    const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    let minDist = Infinity, insertAt = 0;
    for (let i = 0; i < allPts.length - 1; i++) {
      const d = distToSegment(flowPos, allPts[i], allPts[i + 1]);
      if (d < minDist) { minDist = d; insertAt = i; }
    }

    // Insert the new waypoint
    setEdges(eds => eds.map(edge => {
      if (edge.id !== id) return edge;
      const wps = [...(edge.data?.waypoints ?? [])];
      wps.splice(insertAt, 0, { ...flowPos });
      return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
    }));

    // Continue dragging the newly inserted waypoint
    let last = { x: e.clientX, y: e.clientY };
    let cur  = { ...flowPos };

    const onMove = (me) => {
      const { zoom } = getViewport();
      cur = { x: cur.x + (me.clientX - last.x) / zoom, y: cur.y + (me.clientY - last.y) / zoom };
      last = { x: me.clientX, y: me.clientY };
      setEdges(eds => eds.map(edge => {
        if (edge.id !== id) return edge;
        const wps = [...(edge.data?.waypoints ?? [])];
        if (insertAt < wps.length) wps[insertAt] = { ...cur };
        return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [id, sourceX, sourceY, targetX, targetY, waypoints, setEdges, screenToFlowPosition, getViewport]);

  // Segment midpoints for the "+" add-waypoint buttons
  const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const segmentMids = allPts.slice(0, -1).map((pt, i) => ({
    x: (pt.x + allPts[i + 1].x) / 2,
    y: (pt.y + allPts[i + 1].y) / 2,
    insertAt: i,
  }));

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Transparent wide path — drag anywhere on the line to bend it */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ cursor: 'crosshair', pointerEvents: 'stroke' }}
        onMouseDown={handleEdgePathDrag}
      />
      <EdgeLabelRenderer>
        {waypoints.map((wp, i) => (
          <WaypointHandle
            key={`wp-${i}`}
            x={wp.x}
            y={wp.y}
            index={i}
            onUpdate={handleWaypointUpdate}
          />
        ))}
        {selected && segmentMids.map(({ x, y, insertAt }) => (
          <AddWaypointBtn
            key={`add-${insertAt}`}
            x={x}
            y={y}
            insertAt={insertAt}
            edgeId={id}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
});
