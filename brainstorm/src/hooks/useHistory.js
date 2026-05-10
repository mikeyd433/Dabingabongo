import { useState, useRef, useCallback, useEffect } from 'react';
import { makeEdgeOptions, stripCallbacks } from '../utils/flowUtils';

export function useHistory({ darkMode, getNodes, getEdges, setNodes, setEdges, nodes, edges }) {
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

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return { undo, redo, canUndo, canRedo, isRestoringRef };
}
