import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';

// Elbow path with rounded corners
function roundedOrthogonalPath(pts, r = 8) {
  if (pts.length < 2) return '';

  const corners = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    corners.push({ x: q.x, y: p.y });
    if (i < pts.length - 1) corners.push({ x: q.x, y: q.y });
  }

  const all = [pts[0], ...corners, pts[pts.length - 1]];

  let d = `M ${all[0].x} ${all[0].y}`;
  for (let i = 1; i < all.length - 1; i++) {
    const prev = all[i - 1], curr = all[i], next = all[i + 1];
    const dx1 = prev.x - curr.x, dy1 = prev.y - curr.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
    if (len1 < 0.5 || len2 < 0.5) { d += ` L ${curr.x} ${curr.y}`; continue; }
    const cr = Math.min(r, len1 / 2, len2 / 2);
    const bx = curr.x + (dx1 / len1) * cr, by = curr.y + (dy1 / len1) * cr;
    const cx = curr.x + (dx2 / len2) * cr, cy = curr.y + (dy2 / len2) * cr;
    d += ` L ${bx} ${by} Q ${curr.x} ${curr.y} ${cx} ${cy}`;
  }
  d += ` L ${all[all.length - 1].x} ${all[all.length - 1].y}`;
  return d;
}

// Draggable waypoint dot — hover reveals × to delete it
function WaypointDot({ x, y, index, onUpdate, onDelete }) {
  const { getViewport } = useReactFlow();
  const [hov, setHov] = useState(false);

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
      onUpdate(index, { ...cur });
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
  }, [x, y, index, onUpdate, getViewport]);

  return (
    <div
      className="nodrag nopan"
      style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${x}px,${y}px)`, zIndex: 15 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        onMouseDown={e => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={e => { e.stopPropagation(); e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
        title="Drag to move bend"
        style={{
          width: 12, height: 12, borderRadius: '50%',
          background: '#00ff00', border: '2px solid #020617',
          cursor: 'grab', pointerEvents: 'all',
        }}
      />
      {hov && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(index); }}
          title="Remove bend"
          style={{
            position: 'absolute', top: -9, right: -9,
            width: 14, height: 14, borderRadius: '50%',
            background: '#1e293b', border: '1px solid #64748b',
            color: '#94a3b8', fontSize: 11, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'all', userSelect: 'none',
          }}
        >
          ×
        </div>
      )}
    </div>
  );
}

// Ghost handle at path midpoint — drag to introduce a bend
function BendHandle({ x, y, edgeId }) {
  const { setEdges, getViewport } = useReactFlow();
  const [hov, setHov] = useState(false);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    let last = { x: e.clientX, y: e.clientY };
    let cur  = { x, y };
    const onMove = (me) => {
      const { zoom } = getViewport();
      cur = { x: cur.x + (me.clientX - last.x) / zoom, y: cur.y + (me.clientY - last.y) / zoom };
      last = { x: me.clientX, y: me.clientY };
      setEdges(eds => eds.map(edge =>
        edge.id !== edgeId ? edge
          : { ...edge, data: { ...(edge.data ?? {}), waypoints: [{ ...cur }] } }
      ));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [x, y, edgeId, setEdges, getViewport]);

  return (
    <div
      className="nodrag nopan"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onMouseDown={onMouseDown}
      title="Drag to bend edge"
      style={{
        position: 'absolute',
        transform: `translate(-50%,-50%) translate(${x}px,${y}px)`,
        width: 14, height: 14, borderRadius: '50%',
        background: hov ? '#1e293b' : 'transparent',
        border: `1.5px solid ${hov ? '#475569' : 'transparent'}`,
        cursor: 'grab', zIndex: 8, pointerEvents: 'all',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    />
  );
}

export default memo(function WaypointEdge({
  id, sourceX, sourceY, targetX, targetY,
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
    if (val) setIsHovered(true);
    else hoverTimer.current = setTimeout(() => setIsHovered(false), 150);
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
    edgePath = roundedOrthogonalPath([{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]);
  }

  const handleUpdate = useCallback((index, newPos) => {
    setEdges(eds => eds.map(edge => {
      if (edge.id !== id) return edge;
      const wps = [...(edge.data?.waypoints ?? [])];
      return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps.map((wp, i) => i === index ? newPos : wp) } };
    }));
  }, [setEdges, id]);

  const handleDelete = useCallback((index) => {
    setEdges(eds => eds.map(edge => {
      if (edge.id !== id) return edge;
      const wps = (edge.data?.waypoints ?? []).filter((_, i) => i !== index);
      return { ...edge, data: { ...(edge.data ?? {}), waypoints: wps } };
    }));
  }, [setEdges, id]);

  const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const labelX = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
  const labelY = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
  const hasLabel = Boolean(data?.label);
  const showHandles = isHovered || selected;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <path
        d={edgePath} stroke="transparent" strokeWidth={20} fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'default' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDoubleClick={openEditor}
      />
      <EdgeLabelRenderer>
        {(hasLabel || editing) && (
          <div
            className="nodrag nopan"
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', zIndex: 20 }}
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
                  background: '#020617', border: '1px solid #475569', borderRadius: 4,
                  color: '#e2e8f0', fontSize: 11, padding: '2px 7px', outline: 'none',
                  minWidth: 64, fontFamily: 'Inter, sans-serif', textAlign: 'center',
                }}
              />
            ) : (
              <div
                onDoubleClick={openEditor}
                style={{
                  background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
                  color: '#94a3b8', fontSize: 11, padding: '2px 7px',
                  fontFamily: 'Inter, sans-serif', cursor: 'text', whiteSpace: 'nowrap', userSelect: 'none',
                }}
              >
                {data.label}
              </div>
            )}
          </div>
        )}

        {/* Draggable bend points */}
        {waypoints.map((wp, i) => (
          <WaypointDot key={`wp-${i}`} x={wp.x} y={wp.y} index={i} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}

        {/* Ghost bend handle — shown at midpoint when edge has no custom bends yet */}
        {showHandles && waypoints.length === 0 && (
          <BendHandle x={(sourceX + targetX) / 2} y={(sourceY + targetY) / 2} edgeId={id} />
        )}
      </EdgeLabelRenderer>
    </>
  );
});
