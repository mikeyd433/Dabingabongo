import { useRef, useEffect } from 'react';
import { makeEdgeOptions, stripCallbacks } from '../utils/flowUtils';

export function useClipboard({ darkMode, getNodes, getEdges, setNodes, setEdges }) {
  const clipboardRef  = useRef(null);
  const pasteCountRef = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'c') {
        const selNodes = getNodes().filter(n => n.selected);
        if (!selNodes.length) return;
        e.preventDefault();
        const selIds = new Set(selNodes.map(n => n.id));
        clipboardRef.current = {
          nodes: stripCallbacks(selNodes),
          edges: getEdges().filter(ed => selIds.has(ed.source) && selIds.has(ed.target)),
        };
        pasteCountRef.current = 0;
      }

      if (e.key === 'v') {
        const cb = clipboardRef.current;
        if (!cb?.nodes.length) return;
        e.preventDefault();
        pasteCountRef.current++;
        const off = pasteCountRef.current * 30;
        const idMap = {};
        const newNodes = cb.nodes.map(n => {
          const newId = `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          idMap[n.id] = newId;
          return { ...n, id: newId, position: { x: n.position.x + off, y: n.position.y + off }, selected: true, type: 'editableNode' };
        });
        const newEdges = cb.edges
          .filter(ed => idMap[ed.source] && idMap[ed.target])
          .map(ed => ({ ...ed, id: `e${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: idMap[ed.source], target: idMap[ed.target], ...makeEdgeOptions(darkMode) }));
        setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), ...newNodes]);
        setEdges(es => [...es, ...newEdges]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [getNodes, getEdges, setNodes, setEdges, darkMode]);
}
