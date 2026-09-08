// --- SHORTCUT TASTIERA GLOBALI ---
// Estratte da GenogramApp (Fase 5). Le dipendenze arrivano per oggetto: il
// chiamante DEVE definire tutte le funzioni referenziate prima della chiamata.
// NOTA: 'history' va passato esplicitamente — senza, l'identificatore
// risolverebbe in silenzio su window.history (bug di closure stantia).

import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GenNode, RelationEdge, NodeGroup, StickyNoteData } from '../types';

interface KeyboardDeps {
    addChildToSelection: any;
    addNodeAtPos: any;
    addParentsToSelection: any;
    addSpouseToSelection: any;
    addStickyNoteAtCursor: any;
    alignNodes: any;
    duplicateSelectedNodes: any;
    edgesRef: { current: RelationEdge[] };
    fitView: any;
    getCursorGraphPos: any;
    groupsRef: { current: NodeGroup[] };
    handleRedo: any;
    handleSave: any;
    handleUndo: any;
    history: any;
    historyIndex: any;
    nodesRef: { current: GenNode[] };
    selectedEdgeIds: string[];
    selectedGroupIds: string[];
    selectedNodeIds: string[];
    selectedNoteIds: string[];
    setIsPanMode: any;
    setQuickMenu: any;
    setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
    setSelectedGroupIds: Dispatch<SetStateAction<string[]>>;
    setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
    setSelectedNoteIds: Dispatch<SetStateAction<string[]>>;
    setSnapToGrid: Dispatch<SetStateAction<boolean>>;
    stickyNotesRef: { current: StickyNoteData[] };
    updateAll: any;
    updateNodes: (n: GenNode[] | ((prev: GenNode[]) => GenNode[])) => void;
    zoom: any;
}

export const useKeyboardShortcuts = (d: KeyboardDeps) => {
    const { addChildToSelection, addNodeAtPos, addParentsToSelection, addSpouseToSelection, addStickyNoteAtCursor, alignNodes, duplicateSelectedNodes, edgesRef, fitView, getCursorGraphPos, groupsRef, handleRedo, handleSave, handleUndo, history, historyIndex, nodesRef, selectedEdgeIds, selectedGroupIds, selectedNodeIds, selectedNoteIds, setIsPanMode, setQuickMenu, setSelectedEdgeIds, setSelectedGroupIds, setSelectedNodeIds, setSelectedNoteIds, setSnapToGrid, stickyNotesRef, updateAll, updateNodes, zoom } = d;
    // --- SHORTCUTS AGGIORNATE (Spawn, Allineamenti, Select All) ---
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignora se stiamo scrivendo in un input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

            // SHORTCUT PANNING
            if (e.code === 'Space') {
                e.preventDefault();
                setIsPanMode(true);
            }

            // CTRL/CMD + A : SELEZIONA TUTTO
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelectedNodeIds(nodesRef.current.map(n => n.id));
                return;
            }

            // UNDO / REDO / SAVE
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); return; }

            // CTRL/CMD + 0 : ADATTA CONTENUTO (Zoom to fit)
            if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fitView(); return; }

            // CTRL/CMD + D : DUPLICA NODI SELEZIONATI
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedNodeIds.length > 0) {
                e.preventDefault();
                duplicateSelectedNodes();
                return;
            }

            // ALLINEAMENTI E DISTRIBUZIONI (ALT + Tasto)
            // FIX MAC: Usiamo e.code invece di e.key perché su Mac Option+Lettera crea simboli speciali
            if (e.altKey && selectedNodeIds.length > 1) {
                switch (e.code) {
                    case 'KeyH': e.preventDefault(); alignNodes('h'); break;        // Horizontal
                    case 'KeyV': e.preventDefault(); alignNodes('v'); break;        // Vertical
                    case 'KeyC': e.preventDefault(); alignNodes('circle'); break;   // Cerchio
                    case 'KeyG': e.preventDefault(); alignNodes('grid'); break;     // Griglia
                    case 'KeyD': e.preventDefault(); alignNodes('diagonal'); break; // Diagonale
                }
            }

            // CANCELLAZIONE
            if ((e.key === 'Backspace' || e.key === 'Delete') && (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0 || selectedNoteIds.length > 0)) {
                if (confirm("Eliminare gli elementi selezionati?")) {
                    let newNodes = nodesRef.current.filter(n => !selectedNodeIds.includes(n.id));
                    let newEdges = edgesRef.current.filter(ed => !selectedNodeIds.includes(ed.fromId) && !selectedNodeIds.includes(ed.toId) && !selectedEdgeIds.includes(ed.id));
                    let newGroups = groupsRef.current.filter(g => !selectedGroupIds.includes(g.id));
                    let newNotes = stickyNotesRef.current.filter(n => !selectedNoteIds.includes(n.id)); // <--- Filtra Note
                    updateAll(newNodes, newEdges, newGroups, newNotes);
                    setSelectedNodeIds([]); setSelectedEdgeIds([]); setSelectedGroupIds([]); setSelectedNoteIds([]);
                }
            }

            if (e.key === 'Esc' || e.key === 'Escape') {
                setSelectedNodeIds([]); setSelectedEdgeIds([]); setSelectedGroupIds([]); setSelectedNoteIds([]); setQuickMenu(null);
            }

            // SPAWN RAPIDO SOTTO IL MOUSE (M/F) - FIX DEFINITIVO
            // NB: nessun guard sulla selezione. Prima era `selectedNodeIds.length === 0`,
            // ma il nodo appena creato si auto-seleziona: dalla seconda pressione in poi
            // M/F non facevano più nulla, in silenzio.
            if ((e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'f') && !e.altKey && !e.ctrlKey) {
                const { x, y } = getCursorGraphPos(); // <--- Usa la nuova funzione helper
                addNodeAtPos(e.key.toLowerCase() === 'm' ? 'M' : 'F', x, y);
            }

            // NUOVA SHORTCUT: N per Sticky Note
            if (e.key.toLowerCase() === 'n' && !e.altKey && !e.ctrlKey) {
                addStickyNoteAtCursor();
            }

            // SHORTCUT: G per Snap to Grid
            if (e.key.toLowerCase() === 'g' && !e.altKey && !e.ctrlKey && selectedNodeIds.length === 0) {
                setSnapToGrid(prev => !prev);
            }

            // RELAZIONI RAPIDE (S/C/P)
            if (selectedNodeIds.length === 1 && !e.altKey && !e.ctrlKey) {
                const srcId = selectedNodeIds[0];
                if (nodesRef.current.find(n => n.id === srcId)) {
                    if (e.key.toLowerCase() === 's') { addSpouseToSelection(); }
                    if (e.key.toLowerCase() === 'c') { addChildToSelection(); }
                    if (e.key.toLowerCase() === 'p') { addParentsToSelection(); }
                }
            }

            // MOVIMENTO FRECCE
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedNodeIds.length > 0) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
                const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
                updateNodes(prev => prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
            }
        };

        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsPanMode(false);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
        };
    }, [selectedNodeIds, selectedEdgeIds, selectedGroupIds, selectedNoteIds, historyIndex, history, zoom]);
};
