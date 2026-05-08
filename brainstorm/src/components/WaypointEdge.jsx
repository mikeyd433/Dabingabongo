import { memo, useCallback, useRef, useEffect } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';

// Build an orthogonal (right-angle) SVG path through a list of {x,y} points
function orthogonalPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    // Horizontal segment to q.x, then vertical to q.y
    d += ` L ${q.x} ${p.y} L ${q.x} ${q.y}`;
  }
  return d;
}

// A draggable waypoint dot rendered via EdgeLabelRenderer (flow coords)
function WaypointHandle({ x, y, index, onUpdate }) {
  const { getViewport } = useReactFlow();
  // Keep a ref to onUpdate so the drag closure always sees the latest version
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  const startDrag = useCallback((clientX, clientY) => {
    let last = { x: clientX, y: clientY };
    let cur  = { x, y }; // start in flow-space

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

// Button that appears at the midpoint of a segment to add a new waypoint there
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
  const { setEdges } = useReactFlow();
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

  // Stable update handler — reads latest waypoints from state
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

  // Midpoints of each segment — for "add waypoint" buttons
  const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const segmentMids = allPts.slice(0, -1).map((pt, i) => ({
    x: (pt.x + allPts[i + 1].x) / 2,
    y: (pt.y + allPts[i + 1].y) / 2,
    insertAt: i,
  }));

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {/* Existing waypoint handles */}
        {waypoints.map((wp, i) => (
          <WaypointHandle
            key={`wp-${i}`}
            x={wp.x}
            y={wp.y}
            index={i}
            onUpdate={handleWaypointUpdate}
          />
        ))}
        {/* "Add waypoint" buttons shown on each segment when selected */}
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
