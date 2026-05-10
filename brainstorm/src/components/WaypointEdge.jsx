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

// Existing corner (waypoint) — green draggable dot, double-click removes
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

// Gray circle at segment midpoint — drag to insert a new corner
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
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
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

// Pill handle on an actual H/V segment — slides the segment without adding corners
// axis='y': horizontal segment, drag up/down → updates waypoints[wpIdx].y
// axis='x': vertical segment, drag left/right → updates waypoints[wpIdx].x
function SegmentHandle({ x, y, axis, wpIdx, edgeId, onHoverChange }) {
  const { setEdges, getViewport } = useReactFlow();

  const onMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    let last = { x: e.clientX, y: e.clientY };
    const onMove = (me) => {
      const { zoom } = getViewport();
      const delta = axis === 'y' ? (me.clientY - last.y) / zoom : (me.clientX - last.x) / zoom;
      last = { x: me.clientX, y: me.clientY };
      setEdges(eds => eds.map(edge => {
        if (edge.id !== edgeId) return edge;
        const wps = [...(edge.data?.waypoints ?? [])];
        if (wpIdx < wps.length) wps[wpIdx] = { ...wps[wpIdx], [axis]: wps[wpIdx][axis] + delta };
        return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
      }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [axis, wpIdx, edgeId, setEdges, getViewport]);

  const isH = axis === 'y';
  return (
    <div
      className="nodrag nopan"
      title={isH ? 'Drag to slide up/down' : 'Drag to slide left/right'}
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
  const [editing,   setEditing]   = useState(false);
  const [labelDraft, setLabelDraft] = useState(data?.label ?? '');
  const hoverTimer = useRef(null);
  const inputRef   = useRef(null);
  const waypoints  = data?.waypoints ?? [];

  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => { setLabelDraft(data?.label ?? ''); }, [data?.label]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const setHover = useCallback((val) => {
    clearTimeout(hoverTimer.current);
    if (val) { setIsHovered(true); }
    else { hoverTimer.current = setTimeout(() => setIsHovered(false), 150); }
  }, []);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const trimmed = labelDraft.trim();
    setEdges(eds => eds.map(e => e.id !== id ? e : { ...e, data: { ...(e.data ?? {}), label: trimmed } }));
  }, [id, labelDraft, setEdges]);

  const openEditor = useCallback((e) => {
    e.stopPropagation();
    setLabelDraft(data?.label ?? '');
    setEditing(true);
  }, [data?.label]);

  // Build path
  let edgePath;
  if (waypoints.length === 0) {
    [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  } else {
    edgePath = orthogonalPath([{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]);
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

  // Midpoint handles — add a new corner
  const midpointHandles = allPts.slice(0, -1).map((pt, i) => ({
    key: `mid-${i}`,
    x: (pt.x + allPts[i + 1].x) / 2,
    y: (pt.y + allPts[i + 1].y) / 2,
    insertAt: i,
  }));

  // Segment slide handles — slide existing H/V segments
  // orthogonalPath transition i: H seg y=allPts[i-1].y (slidable if i≥2), V seg x=allPts[i].x (slidable if i<n-1)
  const segmentHandles = [];
  if (waypoints.length > 0) {
    for (let i = 1; i < allPts.length; i++) {
      const prev = allPts[i - 1], cur = allPts[i];
      if (i >= 2)                     segmentHandles.push({ key: `sh-h-${i}`, x: (prev.x + cur.x) / 2, y: prev.y,               axis: 'y', wpIdx: i - 2 });
      if (i < allPts.length - 1)      segmentHandles.push({ key: `sh-v-${i}`, x: cur.x,               y: (prev.y + cur.y) / 2,  axis: 'x', wpIdx: i - 1 });
    }
  }

  // Label position: centroid of all path points
  const labelX = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
  const labelY = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
  const hasLabel = Boolean(data?.label);

  const showHandles = isHovered || selected;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Wide transparent stroke — hover detection + double-click to label */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'default' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDoubleClick={openEditor}
      />
      <EdgeLabelRenderer>
        {/* Edge label — always visible if set, or when editing */}
        {(hasLabel || editing) && (
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 20,
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={labelDraft}
                onChange={e => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter')  commitLabel();
                  if (e.key === 'Escape') { setEditing(false); setLabelDraft(data?.label ?? ''); }
                }}
                placeholder="Label…"
                style={{
                  background: '#020617',
                  border: '1px solid #475569',
                  borderRadius: 4,
                  color: '#e2e8f0',
                  fontSize: 11,
                  padding: '2px 7px',
                  outline: 'none',
                  minWidth: 64,
                  fontFamily: 'Inter, sans-serif',
                  textAlign: 'center',
                }}
              />
            ) : (
              <div
                onDoubleClick={openEditor}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  color: '#94a3b8',
                  fontSize: 11,
                  padding: '2px 7px',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'text',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {data.label}
              </div>
            )}
          </div>
        )}

        {/* Existing corner handles */}
        {waypoints.map((wp, i) => (
          <WaypointHandle key={`wp-${i}`} x={wp.x} y={wp.y} index={i} onUpdate={handleWaypointUpdate} />
        ))}

        {/* Midpoint handles — add new corner (gray circle) */}
        {showHandles && midpointHandles.map(({ key, x, y, insertAt }) => (
          <MidpointHandle key={key} x={x} y={y} insertAt={insertAt} edgeId={id} onHoverChange={setHover} />
        ))}

        {/* Segment slide handles — pill shape, constrained drag */}
        {showHandles && segmentHandles.map(({ key, x, y, axis, wpIdx }) => (
          <SegmentHandle key={key} x={x} y={y} axis={axis} wpIdx={wpIdx} edgeId={id} onHoverChange={setHover} />
        ))}
      </EdgeLabelRenderer>
    </>
  );
});
