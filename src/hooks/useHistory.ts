// --- HISTORY / UNDO-REDO ---
// Stack serializzato + indice sincrono via ref: il ref evita la corruzione
// quando pushState viene chiamato più volte nello stesso tick (closure stantie).
// Gli updater risolvono le funzioni-updater sul valore corrente e spingono
// SEMPRE uno snapshot completo (nodi, archi, gruppi, note).

import { useState, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GenNode, RelationEdge, NodeGroup, StickyNoteData } from '../types';

interface HistoryDeps {
    nodes: GenNode[]; setNodes: Dispatch<SetStateAction<GenNode[]>>;
    edges: RelationEdge[]; setEdges: Dispatch<SetStateAction<RelationEdge[]>>;
    groups: NodeGroup[]; setGroups: Dispatch<SetStateAction<NodeGroup[]>>;
    stickyNotes: StickyNoteData[]; setStickyNotes: Dispatch<SetStateAction<StickyNoteData[]>>;
}

export const useGenogramHistory = ({ nodes, setNodes, edges, setEdges, groups, setGroups, stickyNotes, setStickyNotes }: HistoryDeps) => {
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const historyIndexRef = useRef(historyIndex);

    const pushState = useCallback((n: GenNode[], e: RelationEdge[], g: NodeGroup[], s: StickyNoteData[]) => {
        const stateStr = JSON.stringify({ nodes: n, edges: e, groups: g, stickyNotes: s });
        const newIndex = historyIndexRef.current + 1;
        setHistory(prev => [...prev.slice(0, newIndex), stateStr]);
        historyIndexRef.current = newIndex;
        setHistoryIndex(newIndex);
    }, []);

    const updateNodes = (newNodes: GenNode[] | ((prev: GenNode[]) => GenNode[])) => {
        const resolved = typeof newNodes === 'function' ? newNodes(nodes) : newNodes;
        setNodes(resolved);
        pushState(resolved, edges, groups, stickyNotes);
    };
    const updateEdges = (newEdges: RelationEdge[] | ((prev: RelationEdge[]) => RelationEdge[])) => {
        const resolved = typeof newEdges === 'function' ? newEdges(edges) : newEdges;
        setEdges(resolved);
        pushState(nodes, resolved, groups, stickyNotes);
    };
    const updateGroups = (newGroups: NodeGroup[] | ((prev: NodeGroup[]) => NodeGroup[])) => {
        const resolved = typeof newGroups === 'function' ? newGroups(groups) : newGroups;
        setGroups(resolved);
        pushState(nodes, edges, resolved, stickyNotes);
    };
    const updateAllWithNotes = (n: GenNode[], e: RelationEdge[], g: NodeGroup[], s: StickyNoteData[]) => {
        setNodes(n); setEdges(e); setGroups(g); setStickyNotes(s);
        pushState(n, e, g, s);
    };
    const updateAll = (n: GenNode[], e: RelationEdge[], g: NodeGroup[], s?: StickyNoteData[]) => {
        updateAllWithNotes(n, e, g, s || stickyNotes);
    };

    const applySnapshot = (stateStr: string, idx: number) => {
        const state = JSON.parse(stateStr);
        setNodes(state.nodes);
        setEdges(state.edges);
        setGroups(state.groups);
        setStickyNotes(state.stickyNotes || []);
        historyIndexRef.current = idx;
        setHistoryIndex(idx);
    };
    const handleUndo = () => {
        if (historyIndexRef.current > 0) applySnapshot(history[historyIndexRef.current - 1], historyIndexRef.current - 1);
    };
    const handleRedo = () => {
        if (historyIndexRef.current < history.length - 1) applySnapshot(history[historyIndexRef.current + 1], historyIndexRef.current + 1);
    };

    // Azzeramento pulito (cambio genogramma): lo stato iniziale entra come primo snapshot
    const resetHistory = (state: { nodes: GenNode[], edges: RelationEdge[], groups: NodeGroup[], stickyNotes: StickyNoteData[] }) => {
        setHistory([]);
        setHistoryIndex(-1);
        historyIndexRef.current = -1;
        setTimeout(() => {
            setHistory([JSON.stringify(state)]);
            setHistoryIndex(0);
            historyIndexRef.current = 0;
        }, 0);
    };

    return { history, historyIndex, pushState, updateNodes, updateEdges, updateGroups, updateAllWithNotes, updateAll, handleUndo, handleRedo, resetHistory };
};
