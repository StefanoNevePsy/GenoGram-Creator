// --- MACCHINA A STATI DEL DRAG (canvas) ---
// Estratta da GenogramApp (Fase 5): normalizzazione coordinate touch/mouse,
// pan, box-select, long-press (context menu), drag di nodi/note/gruppi,
// resize del padding gruppi, trasformazioni della selezione multipla,
// movimento/rilascio globale via listener window. dragRef/dragState restano
// nel chiamante (servono al rendering delle anteprime di trascinamento).

import { useEffect } from 'react';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { RelationEdge, NodeGroup, StickyNoteData } from '../types';
import type { GenNode } from '../types';
import { CANVAS_SIZE, NODE_WIDTH, SNAP_SIZE } from '../config/constants';
import { generateId } from '../utils/genogram';
import { getGroupBounds, getGroupGeometry, getPointOnOrganicPerimeter } from '../utils/geometry';

interface CanvasDeps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    contextMenu: any;
    cursorRef: any;
    dragRef: any;
    edges: RelationEdge[];
    edgesRef: { current: RelationEdge[] };
    editingGroupId: string | null;
    getGraphCoordinates: any;
    groupsRef: { current: NodeGroup[] };
    isPanMode: boolean;
    isZoomingRef: any;
    longPressTimerRef: any;
    nodes: GenNode[];
    nodesRef: { current: GenNode[] };
    pushState: any;
    selectedNodeIds: string[];
    selectedNoteIds: string[];
    selectionMode: boolean | string | null;
    setContextMenu: any;
    setDragState: any;
    setEdges: Dispatch<SetStateAction<RelationEdge[]>>;
    setEditingGroupId: any;
    setGroups: Dispatch<SetStateAction<NodeGroup[]>>;
    setNodes: Dispatch<SetStateAction<GenNode[]>>;
    setQuickMenu: any;
    setSelectedEdgeIds: Dispatch<SetStateAction<string[]>>;
    setSelectedGroupIds: Dispatch<SetStateAction<string[]>>;
    setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
    setSelectedNoteIds: Dispatch<SetStateAction<string[]>>;
    setStickyNotes: Dispatch<SetStateAction<StickyNoteData[]>>;
    snapToGrid: boolean;
    stickyNotes: StickyNoteData[];
    stickyNotesRef: { current: StickyNoteData[] };
    updateAll: any;
    updateGroups: (g: NodeGroup[] | ((prev: NodeGroup[]) => NodeGroup[])) => void;
}

export const useCanvasInteraction = (d: CanvasDeps) => {
    const { containerRef, contextMenu, cursorRef, dragRef, edges, edgesRef, editingGroupId, getGraphCoordinates, groupsRef, isPanMode, isZoomingRef, longPressTimerRef, nodes, nodesRef, pushState, selectedNodeIds, selectedNoteIds, selectionMode, setContextMenu, setDragState, setEdges, setEditingGroupId, setGroups, setNodes, setQuickMenu, setSelectedEdgeIds, setSelectedGroupIds, setSelectedNodeIds, setSelectedNoteIds, setStickyNotes, snapToGrid, stickyNotes, stickyNotesRef, updateAll, updateGroups } = d;
    const getEventCoords = (e: any) => {
        let clientX, clientY;
        // Normalizzazione Touch/Mouse
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX; clientY = e.clientY;
        }

        // Usa il nuovo calcolo matematico
        const graphPoint = getGraphCoordinates(clientX, clientY);

        return {
            x: graphPoint.x,
            y: graphPoint.y,
            cx: clientX,
            cy: clientY
        };
    };

    const handleHandleDown = (e: any, action: any, sourceId: string) => { const { x, y } = getEventCoords(e); dragRef.current = { active: true, type: action, sourceId, startX: x, startY: y, currX: x, currY: y, pointerId: e.pointerId }; setDragState({ ...dragRef.current }); setQuickMenu(null); };
    // 1. GESTORE SPOSTAMENTO GRUPPO (Deve stare fuori da solo!)
    const handleSelectionDrag = (e: any) => {
        e.stopPropagation();
        e.preventDefault();

        const { x, y } = getEventCoords(e);

        // Calcola le posizioni iniziali di TUTTI i nodi selezionati
        const initialPos: any = {};
        nodesRef.current.forEach(n => {
            if (selectedNodeIds.includes(n.id)) {
                initialPos[n.id] = { x: n.x, y: n.y };
            }
        });

        // Avvia il drag di tipo 'move' (usiamo lo stesso tipo dello spostamento singolo)
        dragRef.current = {
            active: true,
            type: 'move',
            sourceId: 'selection-group',
            startX: x, startY: y,
            currX: x, currY: y,
            initialNodePositions: initialPos,
            pointerId: e.pointerId
        };
        setDragState({ ...dragRef.current });
    };

    // 2. GESTORE TRASFORMAZIONE (Rotazione/Scala)
    const handleTransformStart = (e: any, type: 'rotate' | 'scale') => {
        e.stopPropagation();
        e.preventDefault();
        const { x, y } = getEventCoords(e);

        // Calcola centroide del gruppo
        const selected = nodes.filter(n => selectedNodeIds.includes(n.id));
        const cx = selected.reduce((acc, n) => acc + n.x, 0) / selected.length;
        const cy = selected.reduce((acc, n) => acc + n.y, 0) / selected.length;

        // Salva posizioni iniziali
        const initialPos: any = {};
        selected.forEach(n => initialPos[n.id] = { x: n.x, y: n.y });

        dragRef.current = {
            active: true,
            type: `transform-${type}`,
            sourceId: 'group',
            startX: x, startY: y,
            currX: x, currY: y,
            initialNodePositions: initialPos,
            // Dati extra per calcoli
            centerX: cx, centerY: cy,
            startAngle: Math.atan2(y - cy, x - cx),
            startDist: Math.hypot(x - cx, y - cy),
            pointerId: e.pointerId
        } as any;

        setDragState({ ...dragRef.current });
    };
    const handleEdgeAction = (e: any, edgeId: string) => { const { x, y } = getEventCoords(e); const edge = edgesRef.current.find(ed => ed.id === edgeId); if (edge) { const nId = generateId(); const dropX = x - NODE_WIDTH / 2; const dropY = y + 50; const newN = { id: nId, x: dropX, y: dropY, gender: 'Unknown', name: 'Nuovo', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] }; const e1 = { id: generateId(), fromId: edge.fromId, toId: nId, type: 'child-bio', label: '', notes: [] }; const e2 = { id: generateId(), fromId: edge.toId, toId: nId, type: 'child-bio', label: '', notes: [] }; updateAll([...nodesRef.current, newN as GenNode], [...edgesRef.current, e1, e2], groupsRef.current); setQuickMenu({ x: e.clientX, y: e.clientY, edgeId: nId, mode: 'child' }); } };
    // --- NUOVO HANDLER UNIFICATO (MOUSE / TOUCH / PENNA) ---
    const handleCanvasDown = (e: React.PointerEvent | any) => {
        // 1. PROTEZIONE BASE
        if ((e.target as Element).tagName !== 'svg') return;

        // Reset timer precedenti
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

        // TASTO DESTRO / BARREL S-PEN (web): menu contestuale, MAI drag/box-select.
        // Senza questo guard partiva una box-select fantasma in conflitto col menu
        // (su Android il tasto arriva anche via evento nativo "sPenNativeEvent").
        if (e.button === 2 || e.button === 5 || (e.buttons & 2) === 2) {
            e.preventDefault();
            const { x: gx, y: gy } = getGraphCoordinates(e.clientX, e.clientY);
            setContextMenu({ x: e.clientX, y: e.clientY, gx, gy });
            return;
        }

        // 2. LOGICA DITO (Long Press Timer)
        if (e.pointerType === 'touch' && e.isPrimary) {
            const clientX = e.clientX;
            const clientY = e.clientY;

            longPressTimerRef.current = setTimeout(() => {
                // Ferma il drag
                if (dragRef.current) dragRef.current = { ...dragRef.current, active: false };
                setDragState(null);
                // Apri menu
                const { x, y } = getGraphCoordinates(clientX, clientY);
                setContextMenu({ x: clientX, y: clientY, gx: x, gy: y });
            }, 500);
        }

        if (e.isPrimary) e.preventDefault(); // Blocca scroll nativo
        if (editingGroupId) { setEditingGroupId(null); return; }
        if (contextMenu) setContextMenu(null);

        // Deseleziona se click vuoto
        if (!e.shiftKey && !selectionMode) {
            setSelectedNodeIds([]); setSelectedEdgeIds([]); setSelectedGroupIds([]); setSelectedNoteIds([]);
        }

        const { x, y, cx, cy } = getEventCoords(e);
        let mode = 'pan';
        if (!isPanMode && (e.pointerType === 'mouse' || e.pointerType === 'pen' || selectionMode)) mode = 'box';

        const initialScrollLeft = containerRef.current?.scrollLeft || 0;
        const initialScrollTop = containerRef.current?.scrollTop || 0;

        dragRef.current = {
            active: true, type: mode, sourceId: '',
            startX: x, startY: y, currX: x, currY: y,
            clientStartX: cx, clientStartY: cy,
            initialScrollLeft, initialScrollTop,
            pointerId: e.pointerId
        };
        setDragState({ ...dragRef.current });
        setQuickMenu(null);
    };

    const handleNoteDown = (e: any, noteId: string) => {
        e.stopPropagation(); // Impedisce alla canvas di rubare l'evento
        e.preventDefault();  // Blocca scroll/zoom nativo
        const { x, y } = getEventCoords(e);
        const isShift = e.shiftKey || selectionMode;

        // Gestione Selezione
        let newSelectedNotes = [...selectedNoteIds];
        if (isShift) {
            if (newSelectedNotes.includes(noteId)) {
                newSelectedNotes = newSelectedNotes.filter(id => id !== noteId);
            } else {
                newSelectedNotes.push(noteId);
            }
            setSelectedNoteIds(newSelectedNotes);
        } else {
            // Deseleziona tutto il resto
            setSelectedNodeIds([]);
            setSelectedEdgeIds([]);
            setSelectedGroupIds([]);
            newSelectedNotes = [noteId];
            setSelectedNoteIds(newSelectedNotes);
        }

        const initialPos: any = {};
        newSelectedNotes.forEach(id => {
            const n = stickyNotes.find(nod => nod.id === id);
            if (n) initialPos[id] = { x: n.x, y: n.y };
        });

        // Avvia drag
        dragRef.current = {
            active: true,
            type: 'move-note',
            sourceId: noteId,
            startX: x, startY: y, currX: x, currY: y,
            initialNodePositions: initialPos,
            pointerId: e.pointerId
        };
        setDragState({ ...dragRef.current });
    };

    const handleNodeDown = (e: any, id: string) => {
        e.stopPropagation(); // FONDAMENTALE PER LA SPEN
        e.preventDefault();

        // LOGICA MODIFICA GRUPPO
        if (editingGroupId) {
            updateGroups(prev => prev.map(g => {
                if (g.id !== editingGroupId) return g;
                const isMember = g.memberIds.includes(id);
                // Toggle membro
                return {
                    ...g,
                    memberIds: isMember
                        ? g.memberIds.filter(mid => mid !== id)
                        : [...g.memberIds, id]
                };
            }));
            return; // Stop qui, non selezionare il nodo
        }

        // LOGICA NORMALE SELEZIONE
        const { x, y } = getEventCoords(e);
        const isShift = e.shiftKey || selectionMode;
        let newSelection = selectedNodeIds;
        if (isShift) {
            newSelection = selectedNodeIds.includes(id) ? selectedNodeIds.filter(k => k !== id) : [...selectedNodeIds, id];
        } else if (!selectedNodeIds.includes(id)) {
            newSelection = [id];
            setSelectedEdgeIds([]); setSelectedGroupIds([]); setSelectedNoteIds([]);
        }
        setSelectedNodeIds(newSelection);

        const initialPos: Record<string, { x: number, y: number }> = {};
        nodesRef.current.forEach(n => { if (newSelection.includes(n.id)) initialPos[n.id] = { x: n.x, y: n.y }; });

        dragRef.current = { active: true, type: 'move', sourceId: id, startX: x, startY: y, currX: x, currY: y, initialNodePositions: initialPos, pointerId: e.pointerId };
        setDragState({ ...dragRef.current });
        setQuickMenu(null);
    };
    const handleGroupDown = (e: any, id: string) => { e.stopPropagation(); e.preventDefault(); const { x, y } = getEventCoords(e); dragRef.current = { active: true, type: 'link', sourceId: id, startX: x, startY: y, currX: x, currY: y, pointerId: e.pointerId }; setDragState({ ...dragRef.current }); setQuickMenu(null); };
    const handleEdgeClick = (edgeId: string, e: React.MouseEvent) => { e.stopPropagation(); setSelectedEdgeIds([edgeId]); setSelectedNodeIds([]); const edge = edges.find(ed => ed.id === edgeId); if (edge && ['marriage', 'cohabitation', 'separation', 'divorce'].includes(edge.type)) { setSelectedNodeIds([edge.fromId, edge.toId]); } };

    // --- GESTIONE MOVIMENTO GLOBALE E RILASCIO ---
    useEffect(() => {
        const onPointerMove = (e: PointerEvent) => {
            // 0. FIX ZOOM: Se stiamo zoomando (2 dita), blocca tutto il resto
            if (isZoomingRef.current) return;

            cursorRef.current = { clientX: e.clientX, clientY: e.clientY };

            // 1. FIX LONG PRESS: Se ti muovi, annulla il timer del menu
            if (longPressTimerRef.current && dragRef.current && dragRef.current.active) {
                const dist = Math.hypot(
                    e.clientX - (dragRef.current.clientStartX || 0),
                    e.clientY - (dragRef.current.clientStartY || 0)
                );

                // Se ci siamo mossi di più di 10px, annulla la long press
                if (dist > 10) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                }
            }

            // 2. FIX TRASCINAMENTO FANTASMA E MULTI-TOUCH JUMPING
            // Ignora eventuali altre dita per prevenire salti
            if (dragRef.current && dragRef.current.active && dragRef.current.pointerId !== undefined && e.pointerId !== undefined) {
                if (e.pointerId !== dragRef.current.pointerId) return;
            }

            if (!dragRef.current || !dragRef.current.active) return;

            e.preventDefault(); // Evita scroll pagina durante drag attivo

            const { startX, startY, clientStartX, clientStartY, initialScrollLeft, initialScrollTop } = dragRef.current;
            const { x, y, cx, cy } = getEventCoords(e);

            // Aggiorna posizione corrente nel ref
            dragRef.current.currX = x;
            dragRef.current.currY = y;

            // --- LOGICA TIPI DI TRASCINAMENTO ---

            // A. SPOSTAMENTO CANVAS (PAN)
            if (dragRef.current.type === 'pan' && containerRef.current) {
                const dx = cx - (clientStartX || 0);
                const dy = cy - (clientStartY || 0);
                containerRef.current.scrollLeft = (initialScrollLeft || 0) - dx;
                containerRef.current.scrollTop = (initialScrollTop || 0) - dy;
            }

            // B. SELEZIONE RETTANGOLARE (BOX)
            else if (dragRef.current.type === 'box') {
                setDragState({ ...dragRef.current, currX: x, currY: y });
            }

            // C. SPOSTAMENTO NODI (MOVE)
            else if (dragRef.current.type === 'move') {
                const dx = (x - startX);
                const dy = (y - startY);
                // Cattura initialNodePositions PRIMA del callback per evitare race condition
                // con onPointerUp che resetta dragRef.current
                const savedPositions = dragRef.current.initialNodePositions;

                setNodes(prevNodes => prevNodes.map(node => {
                    if (selectedNodeIds.includes(node.id)) {
                        const initial = savedPositions?.[node.id] || { x: node.x, y: node.y };
                        let nx = initial.x + dx;
                        let ny = initial.y + dy;
                        if (snapToGrid) {
                            nx = Math.round(nx / SNAP_SIZE) * SNAP_SIZE;
                            ny = Math.round(ny / SNAP_SIZE) * SNAP_SIZE;
                        }
                        return { ...node, x: nx, y: ny };
                    }
                    return node;
                }));
            }

            // D. SPOSTAMENTO NOTE ADESIVE (MOVE-NOTE)
            else if (dragRef.current.type === 'move-note') {
                const dx = (x - startX);
                const dy = (y - startY);
                // Cattura initialNodePositions PRIMA del callback per evitare race condition
                // con onPointerUp che resetta dragRef.current
                const savedPositions = dragRef.current.initialNodePositions;

                setStickyNotes(prev => prev.map(note => {
                    if (selectedNoteIds.includes(note.id)) {
                        const initial = savedPositions?.[note.id] || { x: note.x, y: note.y };
                        // Clamp posizione entro i limiti della canvas
                        const nx = Math.max(0, Math.min(CANVAS_SIZE - note.width, initial.x + dx));
                        const ny = Math.max(0, Math.min(CANVAS_SIZE - note.height, initial.y + dy));
                        return { ...note, x: nx, y: ny };
                    }
                    return note;
                }));
            }

            // E. TRASFORMAZIONE HANDLE (SPOUSE, CHILD, PARENTS, LINK) E GROUP
            else if (dragRef.current.type === 'edge-anchor') {
                // Scorri l'ancora della relazione lungo il perimetro del gruppo:
                // campiona la curva organica e scegli la t più vicina al cursore
                const g = groupsRef.current.find(gr => gr.id === dragRef.current!.anchorGroupId);
                const geom = g ? getGroupGeometry(g, nodesRef.current) : null;
                if (geom) {
                    let bestT = 0, bestD = Infinity;
                    for (let i = 0; i <= 200; i++) {
                        const t = i / 200;
                        const p = getPointOnOrganicPerimeter(geom.controlPoints, t);
                        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
                        if (d2 < bestD) { bestD = d2; bestT = t; }
                    }
                    const key = dragRef.current.anchorEnd === 'from' ? 'fromAnchor' : 'toAnchor';
                    const edgeId = dragRef.current.sourceId;
                    setEdges(prev => prev.map(ed => ed.id === edgeId ? { ...ed, [key]: bestT } : ed));
                }
            }
            else if (['spouse', 'child', 'parents', 'link', 'group-label', 'group-padding', 'transform-scale', 'transform-rotate'].includes(dragRef.current.type)) {
                if (dragRef.current.type === 'group-padding') {
                    const dx = x - startX;
                    const dy = y - startY;
                    const initialPad = dragRef.current!.initialPadding || 20;
                    const newPad = Math.max(10, initialPad + Math.max(dx, dy));
                    setGroups(prev => prev.map(g => g.id === dragRef.current!.sourceId ? { ...g, customPadding: newPad } : g));
                } else if (dragRef.current.type === 'group-label') {
                    const dx = x - startX;
                    const dy = y - startY;
                    const initial = dragRef.current!.initialNodePositions?.[dragRef.current!.sourceId];
                    if (initial) {
                        setGroups(prev => prev.map(g => g.id === dragRef.current!.sourceId ? { ...g, labelPos: { x: initial.x + dx, y: initial.y + dy } } : g));
                    }
                }
                setDragState({ ...dragRef.current, currX: x, currY: y });
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (dragRef.current && dragRef.current.active && dragRef.current.pointerId !== undefined && e.pointerId !== undefined) {
                if (e.pointerId !== dragRef.current.pointerId) return;
            }

            // 1. FIX LONG PRESS: Cancella timer al rilascio
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            if (!dragRef.current || !dragRef.current.active) return;

            const wasMoving = dragRef.current.type === 'move' || dragRef.current.type === 'move-note' || dragRef.current.type === 'group-label' || dragRef.current.type === 'group-padding' || dragRef.current.type === 'transform-scale' || dragRef.current.type === 'transform-rotate' || dragRef.current.type === 'selection-group' || dragRef.current.type === 'edge-anchor';
            if (wasMoving) {
                // Salva storia alla fine del drag
                pushState(nodesRef.current, edgesRef.current, groupsRef.current, stickyNotesRef.current);
            }

            // Se stavamo facendo una SELEZIONE BOX
            if (dragRef.current.type === 'box') {
                const x1 = Math.min(dragRef.current.startX, dragRef.current.currX);
                const x2 = Math.max(dragRef.current.startX, dragRef.current.currX);
                const y1 = Math.min(dragRef.current.startY, dragRef.current.currY);
                const y2 = Math.max(dragRef.current.startY, dragRef.current.currY);

                // Tolleranza minima per considerare una selezione (evita click singoli)
                if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
                    const selectedIds: string[] = [];
                    const selectedNoteIdsInBox: string[] = [];

                    nodesRef.current.forEach(n => {
                        if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) {
                            selectedIds.push(n.id);
                        }
                    });

                    // Sticky Notes
                    stickyNotesRef.current.forEach(note => {
                        if (note.x >= x1 && note.x <= x2 && note.y >= y1 && note.y <= y2) {
                            selectedNoteIdsInBox.push(note.id);
                        }
                    });

                    if (e.shiftKey) {
                        setSelectedNodeIds(prev => [...new Set([...prev, ...selectedIds])]);
                        setSelectedNoteIds(prev => [...new Set([...prev, ...selectedNoteIdsInBox])]);
                    } else {
                        setSelectedNodeIds(selectedIds);
                        setSelectedNoteIds(selectedNoteIdsInBox);
                        setSelectedEdgeIds([]);
                        setSelectedGroupIds([]);
                    }
                }
            }

            // E. DROP RELATIONSHIPS E MANIGLIE
            if (['spouse', 'child', 'parents', 'link'].includes(dragRef.current.type)) {
                const { currX, currY, sourceId, type } = dragRef.current;
                // Per 'link' la hit-box è stretta (solo il simbolo): così droppando
                // sul blob di un gruppo vince il gruppo, non il membro vicino
                const pad = type === 'link' ? 5 : 20;
                const padBelow = type === 'link' ? 45 : 80;
                const targetNode = nodesRef.current.find(n =>
                    currX >= n.x - pad && currX <= n.x + padBelow &&
                    currY >= n.y - pad && currY <= n.y + padBelow &&
                    n.id !== sourceId
                );
                // Bersaglio GRUPPO (solo per relazioni generiche 'link'):
                // hit-test sul bounding box del blob
                const targetGroup = (!targetNode && type === 'link')
                    ? groupsRef.current.find(g => {
                        if (g.id === sourceId) return false;
                        const b = getGroupBounds(g, nodesRef.current);
                        return !!b && currX >= b.x && currX <= b.x + b.w && currY >= b.y && currY <= b.y + b.h;
                    })
                    : undefined;

                const srcNode = nodesRef.current.find(n => n.id === sourceId);
                // Sorgente GRUPPO: la maniglia gialla dei gruppi avvia drag 'link'
                const srcGroup = !srcNode ? groupsRef.current.find(g => g.id === sourceId) : undefined;
                const target = targetNode || targetGroup;

                if (target && (srcNode || srcGroup)) {
                    let fromId = sourceId;
                    let toId = target.id;
                    let relType = 'friendship';
                    const involvesGroup = !!srcGroup || !!targetGroup;

                    if (!involvesGroup) {
                        if (type === 'spouse') relType = 'marriage';
                        else if (type === 'child') { relType = 'child-bio'; }
                        else if (type === 'parents') { fromId = target.id; toId = sourceId; relType = 'child-bio'; }
                    }

                    const newE = { id: generateId(), fromId, toId, type: relType, label: '', notes: [] };
                    const newEdges = [...edgesRef.current, newE];
                    setEdges(newEdges);
                    pushState(nodesRef.current, newEdges, groupsRef.current, stickyNotes);
                    setSelectedEdgeIds([newE.id]);
                    setQuickMenu({ x: e.clientX, y: e.clientY, edgeId: newE.id, mode: involvesGroup ? 'link' : type as any });
                } else if (srcNode) {
                    // Click in vuoto o drag brevissimo < 10px -> SPAWN
                    const isClick = Math.hypot(currX - dragRef.current.startX, currY - dragRef.current.startY) < 10;

                    let dropX = currX - 30;
                    let dropY = currY - 30;

                    // Parents handle: always create father + mother pair (click or drag)
                    if (type === 'parents') {
                        const srcId = sourceId;
                        const fId = generateId(); const mId = generateId();
                        // If click, use default position above source node; if drag, center parents around drop position
                        const parentY = isClick ? srcNode.y - 120 : currY - 20;
                        const parentCenterX = isClick ? srcNode.x : currX - 20;
                        const f = { id: fId, x: parentCenterX - 80, y: parentY, gender: 'M', name: 'Padre', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
                        const m = { id: mId, x: parentCenterX + 80, y: parentY, gender: 'F', name: 'Madre', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
                        const newEs = [{ id: generateId(), fromId: fId, toId: mId, type: 'marriage', label: '', notes: [] }, { id: generateId(), fromId: fId, toId: srcId, type: 'child-bio', label: '', notes: [] }, { id: generateId(), fromId: mId, toId: srcId, type: 'child-bio', label: '', notes: [] }];

                        const newNodes = [...nodesRef.current, f as GenNode, m as GenNode];
                        const newEdges = [...edgesRef.current, ...newEs];
                        setNodes(newNodes);
                        setEdges(newEdges);
                        pushState(newNodes, newEdges, groupsRef.current, stickyNotes);
                        setSelectedNodeIds([fId, mId]);

                        dragRef.current = { ...dragRef.current, active: false };
                        setDragState(null);
                        return;
                    } else if (isClick) {
                        if (type === 'child') { dropX = srcNode.x; dropY = srcNode.y + 120; }
                        else if (type === 'spouse') { dropX = srcNode.x + 120; dropY = srcNode.y; }
                    }

                    const nId = generateId();
                    // By default, a Spouse drop usually is opposite gender. A child could be unknown or we just supply male base. Let's use Male or Female
                    const newGender = type === 'spouse' ? (srcNode.gender === 'M' ? 'F' : 'M') : 'Unknown';
                    const newN = { id: nId, x: dropX, y: dropY, gender: newGender, name: 'Nuovo', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };

                    let fromId = sourceId;
                    let toId = nId;
                    let relType = 'friendship';

                    if (type === 'spouse') relType = 'marriage';
                    else if (type === 'child') { relType = 'child-bio'; }

                    const newE = { id: generateId(), fromId, toId, type: relType, label: '', notes: [] };
                    const newEdges = [...edgesRef.current, newE];
                    const newNodes = [...nodesRef.current, newN as GenNode];

                    setNodes(newNodes);
                    setEdges(newEdges);
                    pushState(newNodes, newEdges, groupsRef.current, stickyNotes);
                    setQuickMenu({ x: e.clientX, y: e.clientY, edgeId: newE.id, mode: type as any });
                }
            }

            // Reset stato drag
            dragRef.current = {
                active: false, type: 'pan', sourceId: '',
                startX: 0, startY: 0, currX: 0, currY: 0,
                clientStartX: 0, clientStartY: 0
            };
            setDragState(null);
        };

        const handleResize = () => { };

        // Listener globali su window
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            window.removeEventListener('resize', handleResize);
        };
    }, [selectedNodeIds, selectedNoteIds, selectionMode]);
    return { getEventCoords, handleSelectionDrag, handleCanvasDown, handleNoteDown, handleNodeDown, handleEdgeClick, handleGroupDown, handleHandleDown, handleTransformStart, handleEdgeAction };
};
