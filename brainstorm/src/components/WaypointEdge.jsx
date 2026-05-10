import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';

function orthogonalPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    d += ` L ${q.x} ${p.y} L ${q.x} ${q.y}`;
  }
  return d;
}

// Draggable green dot for an existing waypoint
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

// Gray dot shown at segment midpoints on hover — drag to bend the edge there
function MidpointHandle({ x, y, insertAt, edgeId, onHoverChange }) {
  const { setEdges, getViewport } = useReactFlow();

  const onMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    // Insert waypoint at this midpoint
    setEdges(eds => eds.map(edge => {
      if (edge.id !== edgeId) return edge;
      const wps = [...(edge.data?.waypoints ?? [])];
      wps.splice(insertAt, 0, { x, y });
      return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
    }));

    // Immediately start dragging the newly inserted waypoint
    let last = { x: e.clientX, y: e.clientY };
    let cur  = { x, y };

    const onMove = (me) => {
      const { zoom } = getViewport();
      cur = { x: cur.x + (me.clientX - last.x) / zoom, y: cur.y + (me.clientY - last.y) / zoom };
      last = { x: me.clientX, y: me.clientY };
      setEdges(eds => eds.map(edge => {
        if (edge.id !== edgeId) return edge;
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
  }, [x, y, insertAt, edgeId, setEdges, getViewport]);

  return (
    <div
      className="nodrag nopan"
      title="Drag to bend edge"
      onMouseDown={onMouseDown}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#475569',
        border: '2px solid #1e293b',
        cursor: 'grab',
        zIndex: 8,
        pointerEvents: 'all',
        touchAction: 'none',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseOver={e => { e.currentTarget.style.background = '#00ff00'; e.currentTarget.style.borderColor = '#020617'; }}
      onMouseOut={e => { e.currentTarget.style.background = '#475569'; e.currentTarget.style.borderColor = '#1e293b'; }}
    />
  );
}

export default memo(function WaypointEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, markerEnd, style, selected,
}) {
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimer = useRef(null);
  const waypoints = data?.waypoints ?? [];

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Delayed hover state so mouse can travel from the path to a handle dot
  const setHover = useCallback((val) => {
    clearTimeout(hoverTimer.current);
    if (val) {
      setIsHovered(true);
    } else {
      hoverTimer.current = setTimeout(() => setIsHovered(false), 150);
    }
  }, []);

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

  const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const segmentMids = allPts.slice(0, -1).map((pt, i) => ({
    x: (pt.x + allPts[i + 1].x) / 2,
    y: (pt.y + allPts[i + 1].y) / 2,
    insertAt: i,
  }));

  const showHandles = isHovered || selected;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Wide transparent stroke — hover detection */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'default' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
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
        {/* Midpoint bend handles — visible on hover or selection */}
        {showHandles && segmentMids.map(({ x, y, insertAt }) => (
          <MidpointHandle
            key={`mid-${insertAt}`}
            x={x}
            y={y}
            insertAt={insertAt}
            edgeId={id}
            onHoverChange={setHover}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
});
