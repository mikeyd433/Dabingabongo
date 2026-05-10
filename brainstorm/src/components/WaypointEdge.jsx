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

// Draggable green dot for an existing waypoint corner
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
      title="Drag to move corner · Double-click to remove"
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); startDrag(e.clientX, e.clientY); }}
      onTouchStart={e => { e.stopPropagation(); e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
      onDoubleClick={e => { e.stopPropagation(); onUpdateRef.current(index, null); }}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width: 14, height: 14,
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

// Gray circle at segment midpoint — drag to insert a new corner there
function MidpointHandle({ x, y, insertAt, edgeId, onHoverChange }) {
  const { setEdges, getViewport } = useReactFlow();

  const onMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setEdges(eds => eds.map(edge => {
      if (edge.id !== edgeId) return edge;
      const wps = [...(edge.data?.waypoints ?? [])];
      wps.splice(insertAt, 0, { x, y });
      return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
    }));
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
      title="Drag to add corner"
      onMouseDown={onMouseDown}
      onMouseEnter={e => { onHoverChange(true);  e.currentTarget.style.background = '#00ff00'; e.currentTarget.style.borderColor = '#020617'; }}
      onMouseLeave={e => { onHoverChange(false); e.currentTarget.style.background = '#475569'; e.currentTarget.style.borderColor = '#1e293b'; }}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width: 12, height: 12,
        borderRadius: '50%',
        background: '#475569',
        border: '2px solid #1e293b',
        cursor: 'grab',
        zIndex: 8,
        pointerEvents: 'all',
        touchAction: 'none',
      }}
    />
  );
}

// Pill-shaped handle on an actual H/V segment — drags the segment without adding a new corner.
// axis='y': horizontal segment, drag moves it up/down → updates waypoints[wpIdx].y
// axis='x': vertical segment,   drag moves it left/right → updates waypoints[wpIdx].x
function SegmentHandle({ x, y, axis, wpIdx, edgeId, onHoverChange }) {
  const { setEdges, getViewport } = useReactFlow();

  const onMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    let last = { x: e.clientX, y: e.clientY };
    const onMove = (me) => {
      const { zoom } = getViewport();
      const delta = axis === 'y'
        ? (me.clientY - last.y) / zoom
        : (me.clientX - last.x) / zoom;
      last = { x: me.clientX, y: me.clientY };
      setEdges(eds => eds.map(edge => {
        if (edge.id !== edgeId) return edge;
        const wps = [...(edge.data?.waypoints ?? [])];
        if (wpIdx < wps.length) {
          wps[wpIdx] = { ...wps[wpIdx], [axis]: wps[wpIdx][axis] + delta };
        }
        return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [axis, wpIdx, edgeId, setEdges, getViewport]);

  const isH = axis === 'y'; // horizontal segment → drag vertically
  return (
    <div
      className="nodrag nopan"
      title={isH ? 'Drag to slide segment up/down' : 'Drag to slide segment left/right'}
      onMouseDown={onMouseDown}
      onMouseEnter={e => { onHoverChange(true);  e.currentTarget.style.background = '#64748b'; e.currentTarget.style.borderColor = '#94a3b8'; }}
      onMouseLeave={e => { onHoverChange(false); e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; }}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width:  isH ? 20 : 8,
        height: isH ? 8  : 20,
        borderRadius: 4,
        background: '#1e293b',
        border: '1px solid #334155',
        cursor: isH ? 'ns-resize' : 'ew-resize',
        zIndex: 7,
        pointerEvents: 'all',
        touchAction: 'none',
      }}
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

  const setHover = useCallback((val) => {
    clearTimeout(hoverTimer.current);
    if (val) {
      setIsHovered(true);
    } else {
      hoverTimer.current = setTimeout(() => setIsHovered(false), 150);
    }
  }, []);

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

  // Midpoint handles (one per allPts segment) — insert a new corner
  const midpointHandles = allPts.slice(0, -1).map((pt, i) => ({
    key: `mid-${i}`,
    x: (pt.x + allPts[i + 1].x) / 2,
    y: (pt.y + allPts[i + 1].y) / 2,
    insertAt: i,
  }));

  // Segment handles — slide existing H/V segments without adding corners.
  // The orthogonalPath from pts[i-1] → pts[i] creates:
  //   H segment: y = pts[i-1].y  → controlled by waypoints[i-2].y (i ≥ 2)
  //   V segment: x = pts[i].x   → controlled by waypoints[i-1].x  (i < allPts.length-1)
  const segmentHandles = [];
  if (waypoints.length > 0) {
    for (let i = 1; i < allPts.length; i++) {
      const prev = allPts[i - 1], cur = allPts[i];
      // H segment: only slidable if it's not the very first (source.y fixed)
      if (i >= 2) {
        segmentHandles.push({
          key: `sh-h-${i}`,
          x: (prev.x + cur.x) / 2,
          y: prev.y,
          axis: 'y',
          wpIdx: i - 2,
        });
      }
      // V segment: only slidable if it's not the very last (target.x fixed)
      if (i < allPts.length - 1) {
        segmentHandles.push({
          key: `sh-v-${i}`,
          x: cur.x,
          y: (prev.y + cur.y) / 2,
          axis: 'x',
          wpIdx: i - 1,
        });
      }
    }
  }

  const showHandles = isHovered || selected;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Wide transparent stroke for hover detection */}
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
        {/* Existing corner handles (green dots) */}
        {waypoints.map((wp, i) => (
          <WaypointHandle
            key={`wp-${i}`}
            x={wp.x} y={wp.y}
            index={i}
            onUpdate={handleWaypointUpdate}
          />
        ))}
        {/* Midpoint handles — add a new corner (gray circle → green on hover) */}
        {showHandles && midpointHandles.map(({ key, x, y, insertAt }) => (
          <MidpointHandle
            key={key}
            x={x} y={y}
            insertAt={insertAt}
            edgeId={id}
            onHoverChange={setHover}
          />
        ))}
        {/* Segment slide handles — slide H/V segments (pill shape, ns/ew cursor) */}
        {showHandles && segmentHandles.map(({ key, x, y, axis, wpIdx }) => (
          <SegmentHandle
            key={key}
            x={x} y={y}
            axis={axis}
            wpIdx={wpIdx}
            edgeId={id}
            onHoverChange={setHover}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
});
