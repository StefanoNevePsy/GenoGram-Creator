import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
    Square, Circle, ZoomIn, ZoomOut, Trash2, Grip, Sun, Moon,
    Activity, Users, Plus, Settings,
    LayoutGrid, Heart,
    Scan, MousePointer2, Edit3, X, Download, Waypoints, ChevronDown,
    AlignJustify, CircleDashed, FileText, Search, RotateCcw, RotateCw,
    Filter, SortAsc, Tag, HelpCircle,
    Target, Grid3X3, TrendingUp, Image as ImageIcon, FileImage, Check, Info,
    Cloud, CloudOff, RefreshCw, Network, UserPlus, GitBranch, ArrowDownToLine, ArrowUpToLine, StickyNote, Maximize, Minimize, Copy // <--- Network aggiunto qui
} from 'lucide-react';
import { StatusBar } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, query, onSnapshot } from 'firebase/firestore';

// --- MODULI ESTRATTI (refactoring) ---
import { BASE_REL_CONFIG, RELATION_CATEGORIES } from './config/relationships';
import type { CategoryDef } from './config/categories';
import { ICON_MAP, DEFAULT_CATEGORIES } from './config/categories';
import { NOTE_BG_PALETTES, NOTE_TEXT_COLORS, NOTE_FONTS, PRESET_THEMES } from './config/themes';
import { GRID_SIZE, SNAP_SIZE, CANVAS_SIZE, CENTER_POS, NODE_WIDTH, NODE_HEIGHT, MARRIAGE_BAR_Y } from './config/constants';
import type { Gender, GenNode, RelationEdge, NodeGroup, CustomPreset, GenogramMeta, StickyNoteData, ReportOptions } from './types';
import { calculateAge, calculateAgeAtDeath, extractYear } from './utils/dates';
import { generateId, findMarriageEdge } from './utils/genogram';
import { computeGenogramLayout } from './layout/autoLayout';
import { getGroupBounds, getEntityCenter, getClosestPointOnPolygon, getPointOnOrganicPerimeter, getGroupGeometry, getZigZagPath } from './utils/geometry';
import { Legend, RelationshipSelector, ConnectionLine, NodeShape, SelectionTransformer, StickyNoteShape } from './components/canvas';
import { QuickRelMenu, PalettePicker, NotesPanel, ThemeSelector, StickyNotePropertiesPanel } from './components/panels';
import { ReportModal, SettingsModal, InstructionsModal, StyleDesignerModal, ReportConfigModal } from './components/modals';
import { parseFirebaseConfig } from './services/firebase';




export default function GenogramApp() {
    // --- 1. DEFINIZIONE RIFERIMENTI (Tutti in alto, PRIMA di usarli) ---
    const svgRef = useRef<SVGSVGElement>(null);
    const groupRef = useRef<SVGGElement>(null); // <--- Fondamentale per le coordinate
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef({ clientX: 0, clientY: 0 }); // Posizione mouse grezza
    const isZoomingRef = useRef(false); // <--- NUOVO REF
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [stickyNotes, setStickyNotes] = useState<StickyNoteData[]>([]);
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [showReportConfig, setShowReportConfig] = useState(false);

    // --- GESTIONE TOUCH (PINCH TO ZOOM) ---
    const lastTouchRef = useRef<{ dist: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Se ci sono 2 dita, inizia la logica ZOOM e BLOCCA il Pan
        if (e.touches.length === 2) {
            isZoomingRef.current = true; // <--- BLOCCA PAN
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            lastTouchRef.current = { dist };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && lastTouchRef.current) {
            isZoomingRef.current = true; // Assicurati che resti bloccato

            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

            const scaleFactor = dist / lastTouchRef.current.dist;
            const newZoom = Math.min(Math.max(zoom * scaleFactor, 0.1), 5);
            setZoom(newZoom);

            lastTouchRef.current = { dist };
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // Se rimaniamo con meno di 2 dita, fine zoom
        if (e.touches.length < 2) {
            lastTouchRef.current = null;
            // Ritardiamo lo sblocco per evitare "salti" finali
            setTimeout(() => { isZoomingRef.current = false; }, 100);
        }
    };

    // --- AUTO FULLSCREEN PER ANDROID/CAPACITOR ---
    // --- FULLSCREEN TOGGLE (manuale, non automatico) ---
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    useEffect(() => {
        const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                } else if ((document.documentElement as any).webkitRequestFullscreen) {
                    await (document.documentElement as any).webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen();
                }
            }
        } catch (e) {
            console.log("Fullscreen toggle failed:", e);
        }
    };

    useEffect(() => {
        const hideBar = async () => {
            try {
                await StatusBar.hide();
            } catch (e) {
                console.log("Status bar hide not supported on web");
            }
        };
        hideBar();
    }, []);

    // --- FIX S PEN NATIVO (Tramite Capacitor Bridge) ---
    useEffect(() => {
        // Funzione che riceve il segnale da Java
        const handleNativeSPen = (e: any) => {
            // L'evento arriva come CustomEvent
            // Verifica se è un'azione "down" o un click
            console.log("S PEN NATIVE:", e);

            // Esegui la tua logica (Apri Menu)
            // Poiché questo evento non ha coordinate del mouse (arriva da Java),
            // usiamo l'ultima posizione nota del cursore (cursorRef)
            const { clientX, clientY } = cursorRef.current;
            const { x, y } = getGraphCoordinates(clientX, clientY);

            setContextMenu({ x: clientX, y: clientY, gx: x, gy: y });
        };

        // Ascolta l'evento custom che abbiamo definito in Java "sPenNativeEvent"
        window.addEventListener('sPenNativeEvent', handleNativeSPen);

        return () => {
            window.removeEventListener('sPenNativeEvent', handleNativeSPen);
        };
    }, []);

    // 1. Hook per tracciare il mouse ovunque nella finestra
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            cursorRef.current = { clientX: e.clientX, clientY: e.clientY };
        };
        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, []);

    // 2. Funzione Helper per calcolare la posizione nel grafico
    const getCursorGraphPos = () => {
        const { clientX, clientY } = cursorRef.current;

        // Se il mouse è "invalido" (0,0), usa il centro
        if (clientX === 0 && clientY === 0) return { x: CENTER_POS, y: CENTER_POS };

        if (svgRef.current && groupRef.current) {
            const pt = svgRef.current.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            // Trasformazione magica da schermo a coordinate interne (gestisce zoom/pan)
            const globalPoint = pt.matrixTransform(groupRef.current.getScreenCTM()?.inverse());

            if (snapToGrid) {
                return {
                    x: Math.round(globalPoint.x / SNAP_SIZE) * SNAP_SIZE,
                    y: Math.round(globalPoint.y / SNAP_SIZE) * SNAP_SIZE
                };
            }
            return { x: globalPoint.x, y: globalPoint.y };
        }
        return { x: CENTER_POS, y: CENTER_POS };
    };

    // 3. Funzione per aggiungere la nota (Aggiornata per supportare coordinate custom)
    const addStickyNoteAtCursor = (overrideX?: number, overrideY?: number) => {
        let x, y;

        // Se vengono passate coordinate (dal context menu), usa quelle
        if (overrideX !== undefined && overrideY !== undefined) {
            x = overrideX;
            y = overrideY;
        } else {
            // Altrimenti usa la posizione attuale del cursore/ultimo tocco
            const pos = getCursorGraphPos();
            x = pos.x;
            y = pos.y;
        }

        const newNote: StickyNoteData = {
            id: generateId(),
            x, y,
            width: 160, height: 140,
            text: "Nuova nota...",
            color: NOTE_BG_PALETTES['Classico'][0],
            fontFamily: NOTE_FONTS[0].value,
            opacity: 1.0,
            textColor: NOTE_TEXT_COLORS[0],
            variant: 'classic'
        };

        const newNotesList = [...stickyNotes, newNote];
        setStickyNotes(newNotesList);
        pushState(nodes, edges, groups, newNotesList);
    };

    // Ref per il Drag (lo definiamo qui per pulizia)
    const dragRef = useRef<{
        active: boolean, type: string, sourceId: string,
        startX: number, startY: number, currX: number, currY: number,
        initialNodePositions?: any,
        clientStartX?: number, clientStartY?: number,
        initialScrollLeft?: number, initialScrollTop?: number,
        initialPadding?: number,
        pointerId?: number
    } | null>(null);

    // --- 2. HELPER COORDINATE (Ora funziona perché i ref esistono) ---
    // Helper Matematico: Usa la matrice nativa del browser per precisione assoluta
    const getGraphCoordinates = (clientX: number, clientY: number) => {
        if (svgRef.current && groupRef.current) {
            const pt = svgRef.current.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            // Trasforma il punto dallo schermo al sistema di coordinate interno del gruppo
            // (gestisce automaticamente zoom, pan, scroll e posizione finestra)
            return pt.matrixTransform(groupRef.current.getScreenCTM()?.inverse());
        }
        return { x: 0, y: 0 };
    };

    // --- 3. STATI (useState) ---
    const [user, setUser] = useState<any | null>(null);
    const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
    const [customUser, setCustomUser] = useState(localStorage.getItem('genopro_custom_user') || '');
    const [firebaseConfig, setFirebaseConfig] = useState(localStorage.getItem('genopro_firebase_config') || '');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, gx: number, gy: number } | null>(null);
    const [showHelp, setShowHelp] = useState(false);


    // --- 2. STATO SINCRONIZZAZIONE ---
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
    const isRemoteUpdate = useRef(false);

    // --- 3. DATI DASHBOARD (Quelli che mancavano) ---
    const [genograms, setGenograms] = useState<GenogramMeta[]>([]);
    const [categories] = useState<CategoryDef[]>(() => {
        const saved = localStorage.getItem('genopro_categories');
        return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    });
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc');
    const [searchTerm, setSearchTerm] = useState("");
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);

    // --- 4. INIZIALIZZAZIONE FIREBASE (Robusta) ---
    const { auth, db } = useMemo(() => {
        try {
            let conf = null;
            if (firebaseConfig) {
                conf = parseFirebaseConfig(firebaseConfig);
            }
            else if (typeof (window as any).__firebase_config !== 'undefined') {
                conf = JSON.parse((window as any).__firebase_config);
            }

            if (!conf || !conf.apiKey) return { auth: null, db: null };

            const app = !getApps().length ? initializeApp(conf) : getApp();
            return { auth: getAuth(app), db: getFirestore(app) };
        } catch (e) {
            console.error("Firebase Init Error:", e);
            return { auth: null, db: null };
        }
    }, [firebaseConfig]);

    // --- 5. LOGICA FILTRI DASHBOARD ---
    const filteredGenograms = useMemo(() => {
        return genograms.filter(g => {
            const matchesSearch = g.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = filterCategory === 'ALL' || (g.category === filterCategory) || (filterCategory === 'other' && !categories.some(c => c.id === g.category));
            return matchesSearch && matchesCat;
        }).sort((a, b) => {
            if (sortBy === 'date_desc') return b.lastModified - a.lastModified;
            if (sortBy === 'date_asc') return a.lastModified - b.lastModified;
            if (sortBy === 'name_asc') return a.title.localeCompare(b.title);
            return 0;
        });
    }, [genograms, filterCategory, sortBy, searchTerm, categories]);

    // Persistenza impostazioni locali
    useEffect(() => { localStorage.setItem('genopro_categories', JSON.stringify(categories)); }, [categories]);
    useEffect(() => { localStorage.setItem('genopro_custom_user', customUser); }, [customUser]);
    useEffect(() => { localStorage.setItem('genopro_firebase_config', firebaseConfig); }, [firebaseConfig]);


    const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';

    const [currentGenId, setCurrentGenId] = useState<string | null>(null);
    const [metaTitle, setMetaTitle] = useState("Nuovo Genogramma");
    const [metaCategory, setMetaCategory] = useState("family");

    const [nodes, setNodes] = useState<GenNode[]>([]);
    const [edges, setEdges] = useState<RelationEdge[]>([]);
    const [groups, setGroups] = useState<NodeGroup[]>([]);
    const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);

    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    // Indice sincrono: evita la corruzione della history quando pushState
    // viene chiamato più volte nello stesso tick (closure stantia su historyIndex)
    const historyIndexRef = useRef(historyIndex);

    const pushState = useCallback((n: GenNode[], e: RelationEdge[], g: NodeGroup[], s: any[]) => {
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
    // Helper rapido per aggiornare tutto (inclusi post-it)
    const updateAllWithNotes = (n: GenNode[], e: RelationEdge[], g: NodeGroup[], s: any[]) => {
        setNodes(n); setEdges(e); setGroups(g); setStickyNotes(s);
        pushState(n, e, g, s);
    };

    // --- AGGIUNGI QUESTO BLOCCO MANCANTE ---
    // Serve perché molte funzioni (come addSpouse, delete) chiamano updateAll
    const updateAll = (n: GenNode[], e: RelationEdge[], g: NodeGroup[], s?: any[]) => {
        // Se vengono passate nuove note usale, altrimenti mantieni quelle attuali
        const notesToUse = s || stickyNotes;
        updateAllWithNotes(n, e, g, notesToUse);
    };
    // ---------------------------------------

    const handleUndo = () => {
        if (historyIndexRef.current > 0) {
            const prevIdx = historyIndexRef.current - 1;
            const state = JSON.parse(history[prevIdx]);
            setNodes(state.nodes);
            setEdges(state.edges);
            setGroups(state.groups);
            setStickyNotes(state.stickyNotes || []);
            historyIndexRef.current = prevIdx;
            setHistoryIndex(prevIdx);
        }
    };

    const handleRedo = () => {
        if (historyIndexRef.current < history.length - 1) {
            const nextIdx = historyIndexRef.current + 1;
            const state = JSON.parse(history[nextIdx]);
            setNodes(state.nodes);
            setEdges(state.edges);
            setGroups(state.groups);
            setStickyNotes(state.stickyNotes || []);
            historyIndexRef.current = nextIdx;
            setHistoryIndex(nextIdx);
        }
    };

    useEffect(() => {
        if (history.length === 0 && view === 'editor') {
            pushState(nodes, edges, groups, stickyNotes);
        }
    }, [view]);

    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    // STATI CON PERSISTENZA LOCAL STORAGE
    // --- GESTIONE TEMI (AGGIORNATA) ---
    const [themeId, setThemeId] = useState<string>(() => localStorage.getItem('genopro_theme_id') || 'light');
    const currentTheme = useMemo(() => PRESET_THEMES.find(t => t.id === themeId) || PRESET_THEMES[0], [themeId]);

    // Manteniamo 'darkMode' derivato per non rompere la logica esistente dei nodi
    const darkMode = currentTheme.type === 'dark';

    useEffect(() => { localStorage.setItem('genopro_theme_id', themeId); }, [themeId]);

    const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem('genopro_snap') !== 'false');
    const [showLabels, setShowLabels] = useState<'age' | 'year' | 'date' | 'none'>(() => (localStorage.getItem('genopro_labels') as any) || 'age');
    const [showLegend, setShowLegend] = useState(() => localStorage.getItem('genopro_legend') === 'true');

    // Effetti per salvare le preferenze
    useEffect(() => { localStorage.setItem('genopro_snap', String(snapToGrid)); }, [snapToGrid]);
    useEffect(() => { localStorage.setItem('genopro_labels', showLabels); }, [showLabels]);
    useEffect(() => { localStorage.setItem('genopro_legend', String(showLegend)); }, [showLegend]);

    const [showSettings, setShowSettings] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [showDesigner, setShowDesigner] = useState(false);
    const [isPanMode, setIsPanMode] = useState(false);

    const [dragState, setDragState] = useState<any>(null);
    const [quickMenu, setQuickMenu] = useState<{ x: number, y: number, edgeId: string, mode: 'child' | 'spouse' | 'link' | 'parents' } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [exportScale, setExportScale] = useState(4);

    // --- GESTIONE TASTO INDIETRO (Hardware / Browser) ---
    const latestStateRef = useRef({
        view, showSettings, showReport, showReportConfig, showDesigner, showHelp,
        showCategoryMenu, editingGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds, selectedNoteIds
    });
    useEffect(() => {
        latestStateRef.current = {
            view, showSettings, showReport, showReportConfig, showDesigner, showHelp,
            showCategoryMenu, editingGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds, selectedNoteIds
        };
    });

    const goBack = useCallback(async () => {
        const state = latestStateRef.current;
        let handled = false;

        if (state.showSettings) { setShowSettings(false); handled = true; }
        else if (state.showReport) { setShowReport(false); handled = true; }
        else if (state.showReportConfig) { setShowReportConfig(false); handled = true; }
        else if (state.showDesigner) { setShowDesigner(false); handled = true; }
        else if (state.showHelp) { setShowHelp(false); handled = true; }
        else if (state.showCategoryMenu) { setShowCategoryMenu(false); handled = true; }
        else if (state.editingGroupId !== null) { setEditingGroupId(null); handled = true; }
        else if (state.selectedNodeIds.length > 0) { setSelectedNodeIds([]); handled = true; }
        else if (state.selectedEdgeIds.length > 0) { setSelectedEdgeIds([]); handled = true; }
        else if (state.selectedGroupIds.length > 0) { setSelectedGroupIds([]); handled = true; }
        else if (state.selectedNoteIds.length > 0) { setSelectedNoteIds([]); handled = true; }
        else if (state.view === 'editor') { setView('dashboard'); handled = true; }

        return handled;
    }, []);

    useEffect(() => {
        let capHandle: any = null;

        const initBackListener = async () => {
            // Capacitor Listener per Android
            try {
                capHandle = await CapacitorApp.addListener('backButton', async () => {
                    const handled = await goBack();
                    if (!handled) {
                        CapacitorApp.exitApp();
                    }
                });
            } catch (err) {
                console.log("Capacitor backButton non supportato", err);
            }
        };
        initBackListener();

        // Listener per Web Browser
        const handlePopState = async () => {
            const handled = await goBack();
            if (handled) {
                // Ripristiniamo la history in modo da poter intercettare nuovamente il back
                window.history.pushState(null, '', window.location.href);
            }
        };
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            if (capHandle) capHandle.remove();
            window.removeEventListener('popstate', handlePopState);
        };
    }, [goBack]);


    // 2. AUTOSAVE INTELLIGENTE (Unico effect unificato: localStorage + Firebase)
    useEffect(() => {
        if (view !== 'editor' || !currentGenId) return;

        // Non salvare grafi vuoti al primo avvio
        if (nodes.length === 0 && edges.length === 0 && historyIndex <= 0) return;

        // Se è un aggiornamento remoto, non ri-salvare (evita loop)
        if (isRemoteUpdate.current) {
            isRemoteUpdate.current = false;
            return;
        }

        const timer = setTimeout(async () => {
            const dataToSave = {
                id: currentGenId,
                title: metaTitle,
                category: metaCategory,
                lastModified: Date.now(),
                data: { nodes, edges, groups, presets: customPresets, stickyNotes }
            };
            // Il round-trip JSON rimuove le chiavi con valore undefined (Firestore le rifiuta)
            const serialized = JSON.stringify(dataToSave);
            const sanitized = JSON.parse(serialized);

            // 1-2. Salvataggio locale protetto: un QuotaExceededError non deve bloccare il sync cloud
            try {
                // Draft locale (persistenza offline)
                localStorage.setItem(`genopro_data_${currentGenId}`, serialized);

                // Indice locale (per la dashboard offline): solo metadati, i dati completi
                // sono già in genopro_data_<id> — evita di raddoppiare l'occupazione
                const localIndexStr = localStorage.getItem('genopro_local_index');
                let localList: GenogramMeta[] = localIndexStr ? JSON.parse(localIndexStr) : [];
                const metaEntry = { id: currentGenId, title: metaTitle, category: metaCategory, lastModified: dataToSave.lastModified } as GenogramMeta;
                const existingIdx = localList.findIndex((x) => x.id === currentGenId);
                if (existingIdx >= 0) {
                    localList[existingIdx] = metaEntry;
                } else {
                    localList.push(metaEntry);
                }
                localStorage.setItem('genopro_local_index', JSON.stringify(localList));
            } catch (err) {
                console.error("Errore salvataggio locale (quota?):", err);
            }

            // 3. Salva su Firebase se online
            if (user && db) {
                const pathPart = customUser ? customUser : user.uid;
                if (!pathPart) { setSyncStatus('error'); return; }

                setSyncStatus('syncing');
                try {
                    const docRef = doc(db, 'artifacts', appId, 'users', pathPart, 'genograms', currentGenId);
                    await setDoc(docRef, sanitized, { merge: true });
                    setSyncStatus('synced');
                } catch (err) {
                    console.error("Errore Salvataggio:", err);
                    setSyncStatus('error');
                }
            } else {
                setSyncStatus('offline');
            }
        }, 1500);

        return () => clearTimeout(timer);

    }, [nodes, edges, groups, stickyNotes, metaTitle, metaCategory, customPresets, customUser, user, db, view, currentGenId]);

    // Shortcut "i" per legenda
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'i' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                setShowLegend(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- NUOVO: SUPPORTO TRACKPAD PINCH-TO-ZOOM GLOBALE (Zen/Firefox/Safari/Chrome) ---
    useEffect(() => {
        // Funzione unificata per prevenire lo zoom nativo e gestire quello interno
        const handleWheel = (e: WheelEvent) => {
            // Firefox/Chrome usano Ctrl + Wheel per il pinch
            if (e.ctrlKey) {
                e.preventDefault(); // Blocca lo zoom della pagina intera

                // Sensibilità ridotta per il trackpad
                const sensitivity = 0.008;
                const delta = -e.deltaY * sensitivity;

                setZoom(prev => {
                    const newZoom = prev + delta;
                    return Math.min(3, Math.max(0.2, newZoom));
                });
            }
        };

        // Gestione specifica Safari (Gesture Events)
        const handleGestureStart = (e: any) => {
            e.preventDefault(); // Blocca zoom nativo Safari
        };

        const handleGestureChange = (e: any) => {
            e.preventDefault();
            const sensitivity = 0.05;
            const delta = (e.scale - 1) * sensitivity;
            setZoom(prev => Math.min(3, Math.max(0.2, prev + delta)));
        };

        const handleGestureEnd = (e: any) => e.preventDefault();

        // NOTA: Agganciamo i listener a 'document' (non container) per intercettare l'evento
        // prima che il browser esegua lo zoom della pagina.
        const options = { passive: false };

        document.addEventListener('wheel', handleWheel, options);
        document.addEventListener('gesturestart', handleGestureStart, options);
        document.addEventListener('gesturechange', handleGestureChange, options);
        document.addEventListener('gestureend', handleGestureEnd, options);

        return () => {
            document.removeEventListener('wheel', handleWheel);
            document.removeEventListener('gesturestart', handleGestureStart);
            document.removeEventListener('gesturechange', handleGestureChange);
            document.removeEventListener('gestureend', handleGestureEnd);
        };
    }, []);

    const nodesRef = useRef(nodes);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    const edgesRef = useRef(edges);
    useEffect(() => { edgesRef.current = edges; }, [edges]);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds; }, [selectedNodeIds]);
    const groupsRef = useRef(groups);
    useEffect(() => { groupsRef.current = groups; }, [groups]);
    const stickyNotesRef = useRef(stickyNotes);
    useEffect(() => { stickyNotesRef.current = stickyNotes; }, [stickyNotes]);
    // --- ALIGNMENT TOOLS (Aggiornato: Raggio Custom e Rotazione) ---
    const alignNodes = (type: 'h' | 'v' | 'circle' | 'grid' | 'diagonal') => {
        if (selectedNodeIds.length === 0) return;

        const selected = nodes.filter(n => selectedNodeIds.includes(n.id));

        // 1. Calcola il Centroide
        const avgX = selected.reduce((acc, n) => acc + n.x, 0) / selected.length;
        const avgY = selected.reduce((acc, n) => acc + n.y, 0) / selected.length;

        // 2. Ordinamento "Visivo"
        const sortedSelection = [...selected];

        if (type === 'circle') {
            // Ordina in senso orario
            sortedSelection.sort((a, b) => {
                const angA = Math.atan2(a.y - avgY, a.x - avgX);
                const angB = Math.atan2(b.y - avgY, b.x - avgX);
                return angA - angB;
            });
        } else if (type === 'h') {
            sortedSelection.sort((a, b) => a.x - b.x);
        } else if (type === 'v') {
            sortedSelection.sort((a, b) => a.y - b.y);
        } else if (type === 'diagonal') {
            sortedSelection.sort((a, b) => (a.x + a.y) - (b.x + b.y));
        } else if (type === 'grid') {
            sortedSelection.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
                return a.x - b.x;
            });
        }

        // 3. Calcolo Raggio (Con Prompt Utente)
        let radius = 150;
        if (type === 'circle') {
            const currentAvgRadius = selected.reduce((acc, n) => acc + Math.hypot(n.x - avgX, n.y - avgY), 0) / selected.length;
            const userRadius = prompt("Inserisci raggio cerchio (px):", Math.round(currentAvgRadius).toString());
            if (userRadius !== null) radius = parseInt(userRadius) || 150;
            else return; // Annulla se utente preme Esc
        }

        updateNodes(prev => prev.map((n) => {
            if (!selectedNodeIds.includes(n.id)) return n;

            const idx = sortedSelection.findIndex(s => s.id === n.id);

            if (type === 'h') return { ...n, y: Math.round(avgY / SNAP_SIZE) * SNAP_SIZE };
            if (type === 'v') return { ...n, x: Math.round(avgX / SNAP_SIZE) * SNAP_SIZE };

            // Disposizione a Cerchio (FIX ROTAZIONE)
            if (type === 'circle') {
                if (selected.length < 2) return n;
                const step = (2 * Math.PI) / selected.length;

                // FIX: Invece di forzare -PI/2 (ore 12), prendiamo l'angolo del PRIMO nodo ordinato
                // Questo mantiene la rotazione relativa del gruppo che hai disegnato
                const firstNode = sortedSelection[0];
                const currentStartAngle = Math.atan2(firstNode.y - avgY, firstNode.x - avgX);

                const angle = currentStartAngle + (step * idx);

                return {
                    ...n,
                    x: Math.round((avgX + radius * Math.cos(angle)) / SNAP_SIZE) * SNAP_SIZE,
                    y: Math.round((avgY + radius * Math.sin(angle)) / SNAP_SIZE) * SNAP_SIZE
                };
            }

            if (type === 'grid') {
                const cols = Math.ceil(Math.sqrt(selected.length));
                const row = Math.floor(idx / cols);
                const col = idx % cols;
                const gridW = (cols - 1) * 120;
                const gridH = (Math.ceil(selected.length / cols) - 1) * 120;
                const startX = avgX - gridW / 2;
                const startY = avgY - gridH / 2;
                return { ...n, x: Math.round((startX + col * 120) / SNAP_SIZE) * SNAP_SIZE, y: Math.round((startY + row * 120) / SNAP_SIZE) * SNAP_SIZE };
            }

            if (type === 'diagonal') {
                const offset = (idx - (selected.length - 1) / 2) * 80;
                return { ...n, x: Math.round((avgX + offset) / SNAP_SIZE) * SNAP_SIZE, y: Math.round((avgY + offset) / SNAP_SIZE) * SNAP_SIZE };
            }
            return n;
        }));
    };

    // --- BILANCIAMENTO SEMI-AUTOMATICO (GENITORI <-> FIGLI) ---
    const balanceGenerations = (mode: 'align-children' | 'align-parents') => {
        const selected = nodes.filter(n => selectedNodeIds.includes(n.id));
        if (selected.length < 2) return;

        const sortedByY = [...selected].sort((a, b) => a.y - b.y);
        const rows: GenNode[][] = [];

        let currentRow: GenNode[] = [sortedByY[0]];
        for (let i = 1; i < sortedByY.length; i++) {
            const curr = sortedByY[i];
            const prev = sortedByY[i - 1];
            if (Math.abs(curr.y - prev.y) < 50) {
                currentRow.push(curr);
            } else {
                rows.push(currentRow);
                currentRow = [curr];
            }
        }
        rows.push(currentRow);

        if (rows.length < 2) return alert("Seleziona persone di almeno due generazioni diverse");

        const topRow = rows[0];
        const bottomRow = rows[rows.length - 1];

        topRow.sort((a, b) => a.x - b.x);
        bottomRow.sort((a, b) => a.x - b.x);

        const GAP = 40;
        const NODE_FULL_W = NODE_WIDTH + GAP;

        updateNodes(prev => prev.map(n => {
            if (!selectedNodeIds.includes(n.id)) return n;

            if (mode === 'align-children') {
                if (bottomRow.some(bn => bn.id === n.id)) {
                    const parentsMin = topRow[0].x;
                    const parentsMax = topRow[topRow.length - 1].x + NODE_WIDTH;
                    const parentsCenter = (parentsMin + parentsMax) / 2;
                    const childrenTotalWidth = (bottomRow.length * NODE_WIDTH) + ((bottomRow.length - 1) * GAP);
                    const startX = parentsCenter - (childrenTotalWidth / 2);
                    const idx = bottomRow.findIndex(bn => bn.id === n.id);
                    return { ...n, x: startX + (idx * NODE_FULL_W), y: topRow[0].y + 180 }; // Allinea anche Y
                }
            }

            if (mode === 'align-parents') {
                if (topRow.some(pn => pn.id === n.id)) {
                    const childrenMin = bottomRow[0].x;
                    const childrenMax = bottomRow[bottomRow.length - 1].x + NODE_WIDTH;
                    const childrenCenter = (childrenMin + childrenMax) / 2;
                    const parentsTotalWidth = (topRow.length * NODE_WIDTH) + ((topRow.length - 1) * GAP);
                    const startX = childrenCenter - (parentsTotalWidth / 2);
                    const idx = topRow.findIndex(pn => pn.id === n.id);
                    return { ...n, x: startX + (idx * NODE_FULL_W) };
                }
            }
            return n;
        }));
    };
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
            if ((e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'f') && selectedNodeIds.length === 0 && !e.altKey && !e.ctrlKey) {
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

        // NOTA: La logica del tasto S Pen ora è gestita globalmente dal useEffect "handleGlobalPenButton".
        // Qui gestiamo solo l'interazione standard (Pan, Selezione) e il Long Press col dito.

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

            const wasMoving = dragRef.current.type === 'move' || dragRef.current.type === 'move-note' || dragRef.current.type === 'group-label' || dragRef.current.type === 'group-padding' || dragRef.current.type === 'transform-scale' || dragRef.current.type === 'transform-rotate' || dragRef.current.type === 'selection-group';
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
                const targetNode = nodesRef.current.find(n =>
                    currX >= n.x - 20 && currX <= n.x + 80 &&
                    currY >= n.y - 20 && currY <= n.y + 80 &&
                    n.id !== sourceId
                );

                const srcNode = nodesRef.current.find(n => n.id === sourceId);

                if (targetNode && srcNode) {
                    let fromId = sourceId;
                    let toId = targetNode.id;
                    let relType = 'friendship';

                    if (type === 'spouse') relType = 'marriage';
                    else if (type === 'child') { relType = 'child-bio'; }
                    else if (type === 'parents') { fromId = targetNode.id; toId = sourceId; relType = 'child-bio'; }

                    const newE = { id: generateId(), fromId, toId, type: relType, label: '', notes: [] };
                    const newEdges = [...edgesRef.current, newE];
                    setEdges(newEdges);
                    pushState(nodesRef.current, newEdges, groupsRef.current, stickyNotes);
                    setQuickMenu({ x: e.clientX, y: e.clientY, edgeId: newE.id, mode: type as any });
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

    // --- AUTH & INIT ---
    useEffect(() => {
        if (!auth) return;
        const ia = async () => {
            // 1. Tenta login con token custom (se fornito dall'ambiente)
            const t = (window as any).__initial_auth_token;
            if (t) {
                await signInWithCustomToken(auth, t).catch(e => console.error("Token Auth Error:", e));
            } else {
                // 2. Fallback su login anonimo
                await signInAnonymously(auth).catch(e => console.error("Anon Auth Error:", e));
            }
        };
        ia();
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            // Se non c'è un customUser impostato, usa l'UID di Firebase come default per evitare percorsi vuoti
            if (!customUser && u) {
                // Opzionale: decommenta se vuoi forzare l'UID come default visibile
                // setCustomUser(u.uid); 
            }
        });
    }, [auth]);
    // Caricamento Lista Genogrammi (Ibrido)
    useEffect(() => {
        // 1. Carica sempre indice locale arricchito
        const localIndexStr = localStorage.getItem('genopro_local_index');
        const localList: GenogramMeta[] = localIndexStr ? JSON.parse(localIndexStr) : [];
        const enrichedLocalList = localList.map(g => {
            try { return JSON.parse(localStorage.getItem(`genopro_data_${g.id}`) || JSON.stringify(g)); }
            catch { return g; }
        });

        // Se offline, mostra solo locali
        if (!user || !db) {
            setGenograms(enrichedLocalList);
            return;
        }

        const pathPart = customUser ? customUser : user.uid;
        if (!pathPart) { setGenograms(enrichedLocalList); return; }

        try {
            const q = query(collection(db, 'artifacts', appId, 'users', pathPart, 'genograms'));
            const u = onSnapshot(q, (s) => {
                const remoteList: GenogramMeta[] = [];
                s.forEach(d => remoteList.push({ id: d.id, ...d.data() } as GenogramMeta));

                // MERGE LISTE: Priorità al record PIU' RECENTE (locale o online)
                const mergedMap = new Map();
                enrichedLocalList.forEach(g => mergedMap.set(g.id, g));

                remoteList.forEach(g => {
                    const local = mergedMap.get(g.id);
                    if (!local || g.lastModified >= local.lastModified) {
                        mergedMap.set(g.id, g);
                        // Inoltre, se online è più recente, aggiorniamo il draft locale per performance future!
                        localStorage.setItem(`genopro_data_${g.id}`, JSON.stringify(g));
                    }
                });

                setGenograms(Array.from(mergedMap.values()));
            }, () => {
                console.error("Dashboard offline, uso cache locale");
                setGenograms(enrichedLocalList);
            });
            return () => u();
        } catch (e) {
            setGenograms(enrichedLocalList);
        }
    }, [user, db, customUser]);

    useLayoutEffect(() => { if (view === 'editor' && containerRef.current) setTimeout(() => { if (containerRef.current) containerRef.current.scrollTo(CENTER_POS - containerRef.current.clientWidth / 2, CENTER_POS - containerRef.current.clientHeight / 2); }, 100); }, [view]);
    const handleSave = () => { alert("I tuoi salvataggi sono gestiti in modo completamente automatico e avvengono ogni volta che compi un'azione!"); };
    // --- 1. GESTIONE STATO CORRETTA (FIX PER DATI FANTASMA) ---

    // Funzione helper per resettare pulito lo stato e la storia
    const resetEditorState = (newNodes: GenNode[], newEdges: RelationEdge[], newGroups: NodeGroup[], newNotes: StickyNoteData[] = []) => {
        setNodes(newNodes);
        setEdges(newEdges);
        setGroups(newGroups);
        setStickyNotes(newNotes); // <--- NUOVO

        setHistory([]);
        setHistoryIndex(-1);
        historyIndexRef.current = -1;
        setTimeout(() => {
            // Includi le note nello stato iniziale della storia
            const initialState = JSON.stringify({ nodes: newNodes, edges: newEdges, groups: newGroups, stickyNotes: newNotes });
            setHistory([initialState]);
            setHistoryIndex(0);
            historyIndexRef.current = 0;
        }, 0);
    };

    const handleNewGenogram = () => {
        setCurrentGenId(generateId());
        setMetaTitle("Nuovo Genogramma");
        setMetaCategory('family');
        // Resetta tutto usando l'helper sicuro
        resetEditorState([], [], []);
        setView('editor');
    };
    const addNodeAtCenter = (gender: Gender) => { const n = { id: generateId(), x: CENTER_POS, y: CENTER_POS, gender, name: 'Nuovo', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] }; updateNodes(prev => [...prev, n]); setSelectedNodeIds([n.id]); };

    const addNodeAtPos = (gender: Gender, x: number, y: number) => {
        // Snap to grid se attivo
        if (snapToGrid) {
            x = Math.round(x / SNAP_SIZE) * SNAP_SIZE;
            y = Math.round(y / SNAP_SIZE) * SNAP_SIZE;
        }
        const n = { id: generateId(), x, y, gender, name: 'Nuovo', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
        updateNodes(prev => [...prev, n]);
        setSelectedNodeIds([n.id]);
    };

    const createGroup = () => { if (selectedNodeIds.length === 0) return alert("Seleziona nodi"); const g = { id: generateId(), memberIds: [...selectedNodeIds], type: 'household', label: 'Nuovo Gruppo', color: '#000000', notes: [] } as NodeGroup; updateGroups(prev => [...prev, g]); setSelectedGroupIds([g.id]); setSelectedNodeIds([]); };

    // --- HELPERS AGGIUNTA RAPIDA ---
    // Helper per arrotondare alla griglia quando snap è attivo
    const snap = (v: number) => snapToGrid ? Math.round(v / SNAP_SIZE) * SNAP_SIZE : v;

    // Duplica i nodi selezionati (Ctrl+D), incluse le relazioni interne alla selezione
    const duplicateSelectedNodes = () => {
        if (selectedNodeIds.length === 0) return;
        const idMap = new Map<string, string>();
        const clones = nodesRef.current.filter(n => selectedNodeIds.includes(n.id)).map(n => {
            const newId = generateId();
            idMap.set(n.id, newId);
            // indexPerson resta unico: la copia non deve creare un secondo paziente indice
            return { ...n, id: newId, x: snap(n.x + 40), y: snap(n.y + 40), indexPerson: false };
        });
        const cloneEdges = edgesRef.current
            .filter(e => idMap.has(e.fromId) && idMap.has(e.toId))
            .map(e => ({ ...e, id: generateId(), fromId: idMap.get(e.fromId)!, toId: idMap.get(e.toId)! }));
        updateAll([...nodesRef.current, ...clones], [...edgesRef.current, ...cloneEdges], groupsRef.current);
        setSelectedNodeIds(clones.map(c => c.id));
        setSelectedEdgeIds([]);
    };

    const addParentsToSelection = () => {
        if (selectedNodeIds.length !== 1) return alert("Seleziona una persona");
        const srcId = selectedNodeIds[0];
        const srcNode = nodes.find(n => n.id === srcId);
        if (!srcNode) return;
        const fId = generateId(); const mId = generateId();
        const parentY = snap(srcNode.y - 150);
        const f = { id: fId, x: snap(srcNode.x - 80), y: parentY, gender: 'M', name: 'Padre', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
        const m = { id: mId, x: snap(srcNode.x + 80), y: parentY, gender: 'F', name: 'Madre', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
        const newEs = [{ id: generateId(), fromId: fId, toId: mId, type: 'marriage', label: '', notes: [] }, { id: generateId(), fromId: fId, toId: srcId, type: 'child-bio', label: '', notes: [] }, { id: generateId(), fromId: mId, toId: srcId, type: 'child-bio', label: '', notes: [] }];
        updateAll([...nodes, f as GenNode, m as GenNode], [...edges, ...newEs], groups);
        setSelectedNodeIds([fId, mId]);
    };
    const addSpouseToSelection = () => {
        if (selectedNodeIds.length !== 1) return alert("Seleziona una persona");
        const srcId = selectedNodeIds[0];
        const srcNode = nodes.find(n => n.id === srcId);
        if (!srcNode) return;
        const nId = generateId();
        const newN = { id: nId, x: snap(srcNode.x + 120), y: snap(srcNode.y), gender: srcNode.gender === 'M' ? 'F' : 'M', name: 'Partner', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
        const newE = { id: generateId(), fromId: srcId, toId: nId, type: 'marriage', label: '', notes: [] };
        updateAll([...nodes, newN as GenNode], [...edges, newE], groups);
        setSelectedNodeIds([nId]);
    };
    const addChildToSelection = () => {
        if (selectedEdgeIds.length === 1) {
            const edge = edges.find(e => e.id === selectedEdgeIds[0]);
            if (edge && RELATION_CATEGORIES["Struttura / Coppia"].includes(edge.type)) {
                const p1 = nodes.find(n => n.id === edge.fromId); const p2 = nodes.find(n => n.id === edge.toId);
                if (!p1 || !p2) return;
                const nId = generateId();
                const newN = { id: nId, x: snap((p1.x + p2.x) / 2), y: snap(Math.max(p1.y, p2.y) + 150), gender: 'Unknown', name: 'Figlio', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
                const e1 = { id: generateId(), fromId: edge.fromId, toId: nId, type: 'child-bio', label: '', notes: [] }; const e2 = { id: generateId(), fromId: edge.toId, toId: nId, type: 'child-bio', label: '', notes: [] };
                updateAll([...nodes, newN as GenNode], [...edges, e1, e2], groups); setSelectedNodeIds([nId]); setSelectedEdgeIds([]); return;
            }
        }
        if (selectedNodeIds.length === 1) {
            const srcId = selectedNodeIds[0]; const srcNode = nodes.find(n => n.id === srcId); if (!srcNode) return;
            const marriage = findMarriageEdge(srcId, edges); const nId = generateId();
            const newN = { id: nId, x: snap(srcNode.x), y: snap(srcNode.y + 150), gender: 'Unknown', name: 'Figlio', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
            const newEdgesList = [{ id: generateId(), fromId: srcId, toId: nId, type: 'child-bio', label: '', notes: [] }];
            if (marriage) { const spouseId = marriage.fromId === srcId ? marriage.toId : marriage.fromId; newEdgesList.push({ id: generateId(), fromId: spouseId, toId: nId, type: 'child-bio', label: '', notes: [] }); }
            updateAll([...nodes, newN as GenNode], [...edges, ...newEdgesList], groups); setSelectedNodeIds([nId]);
        } else { alert("Seleziona una coppia o un genitore"); }
    };


    // --- FINE NUOVO CODICE ---



    // --- AUTO LAYOUT V33 (Physics Relaxation & Constraint Solver) ---
    const autoLayout = () => {
        // Lavora SEMPRE sulle copie: mutare gli oggetti dello stato React è vietato
        // e le posizioni calcolate finirebbero perse (updateNodes applica allNodes)
        const allNodes = JSON.parse(JSON.stringify(nodes)) as GenNode[];
        const scopeNodes = selectedNodeIds.length > 0 ? allNodes.filter(n => selectedNodeIds.includes(n.id)) : allNodes;
        if (scopeNodes.length === 0) return;

        const nodeMap = new Map(allNodes.map(n => [n.id, n]));

        // Costanti
        const LEVEL_H = 180;
        const NODE_W = 60;
        const SPOUSE_GAP = 80;     // Distanza fissa tra partner
        const MIN_NODE_GAP = 100;  // Distanza minima tra persone diverse
        const ITERATIONS = 250;    // Numero cicli di simulazione

        // --- HELPERS ---
        const getSpouses = (id: string) => edges
            .filter(e => (e.fromId === id || e.toId === id) && RELATION_CATEGORIES["Struttura / Coppia"].includes(e.type))
            .map(e => e.fromId === id ? e.toId : e.fromId);

        const getParents = (cId: string) => {
            const pEdges = edges.filter(e => e.toId === cId && e.type.startsWith('child'));
            return [...new Set(pEdges.map(e => e.fromId))];
        };

        const getChildren = (pIds: string[]) => {
            const cEdges = edges.filter(e => pIds.includes(e.fromId) && e.type.startsWith('child'));
            const cIds = [...new Set(cEdges.map(e => e.toId))];
            return cIds; // Non ordiniamo qui, lasciamo che la fisica decida
        };

        // 1. LIVELLI RIGIDI (Bottom-Up)
        const generations = new Map<string, number>();
        scopeNodes.forEach(n => generations.set(n.id, -1));

        const calcHeight = (id: string, visited = new Set<string>()): number => {
            if (visited.has(id)) return 0;
            const g = generations.get(id);
            if (g === undefined) return 0; // Nodo fuori dallo scope selezionato: evita NaN
            if (g !== -1) return g;
            visited.add(id);

            const children = getChildren([id]);
            const spouses = getSpouses(id);

            let maxChildH = -1;
            const allChildren = new Set(children);
            spouses.forEach(s => getChildren([s]).forEach(c => allChildren.add(c)));

            if (allChildren.size > 0) {
                const chHeights = Array.from(allChildren).map(c => calcHeight(c, new Set(visited)));
                maxChildH = Math.max(...chHeights);
            }

            const myHeight = maxChildH + 1;
            generations.set(id, myHeight);
            return myHeight;
        };

        scopeNodes.forEach(n => calcHeight(n.id));

        // Sincronizza livelli coniugi (Devono essere identici)
        let changed = true;
        while (changed) {
            changed = false;
            scopeNodes.forEach(n => {
                const h1 = generations.get(n.id) || 0;
                getSpouses(n.id).forEach(s => {
                    const h2 = generations.get(s) || 0;
                    if (h1 !== h2) {
                        const max = Math.max(h1, h2);
                        generations.set(n.id, max);
                        generations.set(s, max);
                        changed = true;
                    }
                });
            });
        }

        const maxGen = Math.max(...Array.from(generations.values()));
        const levels = new Map<string, number>();
        generations.forEach((g, id) => levels.set(id, maxGen - g));

        // 2. INIZIALIZZAZIONE X
        // Partiamo da una posizione sparsa per evitare collisioni immediate
        // Ordiniamo un po' per data di nascita per aiutare la convergenza
        const sortedByAge = [...scopeNodes].sort((a, b) => extractYear(a.birthDate || '') - extractYear(b.birthDate || ''));
        sortedByAge.forEach((n, i) => {
            n.x = i * (NODE_W + 20); // Spread iniziale
        });

        // 3. SIMULAZIONE FISICA (Relaxation Loop)
        for (let iter = 0; iter < ITERATIONS; iter++) {

            // A. FORZE DI ATTRAZIONE (Elastici)
            // Ogni nodo vuole stare vicino ai suoi parenti
            const moves = new Map<string, number>();

            scopeNodes.forEach(n => {
                let targetX = 0;
                let count = 0;

                // 1. Attrazione verso Genitori
                const parents = getParents(n.id);
                parents.forEach(pId => {
                    const p = nodeMap.get(pId);
                    if (p) { targetX += p.x; count++; }
                });

                // 2. Attrazione verso Figli
                const children = getChildren([n.id]);
                children.forEach(cId => {
                    const c = nodeMap.get(cId);
                    if (c) { targetX += c.x; count++; }
                });

                // 3. Attrazione verso Coniugi (Soft - il vincolo Hard è dopo)
                const spouses = getSpouses(n.id);
                spouses.forEach(sId => {
                    const s = nodeMap.get(sId);
                    if (s) { targetX += s.x; count++; }
                });

                if (count > 0) {
                    const avg = targetX / count;
                    // Smorzamento (Damping): ci muoviamo solo di una percentuale verso il target
                    // per evitare oscillazioni. Alpha diminuisce col tempo.
                    const alpha = 0.5 * (1 - iter / ITERATIONS);
                    moves.set(n.id, (avg - n.x) * alpha);
                }
            });

            // Applica movimenti
            scopeNodes.forEach(n => {
                if (moves.has(n.id)) n.x += moves.get(n.id)!;
            });

            // B. VINCOLI RIGIDI CONIUGI (Hard Constraints)
            // Marito e Moglie devono stare a distanza fissa SPOUSE_GAP
            // E il maschio preferibilmente a sinistra
            const processedSpouses = new Set<string>();
            scopeNodes.forEach(n => {
                if (processedSpouses.has(n.id)) return;

                const spouses = getSpouses(n.id);
                if (spouses.length > 0) {
                    // Prendi il nucleo familiare
                    const group = [n.id, ...spouses];
                    group.forEach(g => processedSpouses.add(g));

                    // Ordina: M a sinistra
                    group.sort((a, b) => {
                        const gA = nodeMap.get(a)?.gender; const gB = nodeMap.get(b)?.gender;
                        if (gA === 'M' && gB !== 'M') return -1;
                        if (gA !== 'M' && gB === 'M') return 1;
                        return 0;
                    });

                    // Calcola il centro attuale del gruppo
                    const avgX = group.reduce((sum, id) => sum + nodeMap.get(id)!.x, 0) / group.length;

                    // Riposiziona rigidamente attorno al centro
                    const totalW = (group.length - 1) * SPOUSE_GAP;
                    let startX = avgX - totalW / 2;

                    group.forEach((id, idx) => {
                        const node = nodeMap.get(id)!;
                        node.x = startX + (idx * SPOUSE_GAP);
                    });
                }
            });

            // C. RISOLUZIONE COLLISIONI (Repulsion)
            // Nodi sullo stesso livello non devono sovrapporsi
            // Raggruppa per livello
            const nodesByLevel = new Map<number, GenNode[]>();
            scopeNodes.forEach(n => {
                const lvl = levels.get(n.id) || 0;
                if (!nodesByLevel.has(lvl)) nodesByLevel.set(lvl, []);
                nodesByLevel.get(lvl)!.push(n);
            });

            nodesByLevel.forEach((levelNodes) => {
                // Ordina per X corrente
                levelNodes.sort((a, b) => a.x - b.x);

                // Spingi via i vicini
                for (let i = 0; i < levelNodes.length - 1; i++) {
                    const n1 = levelNodes[i];
                    const n2 = levelNodes[i + 1];

                    const dist = n2.x - n1.x;
                    if (dist < MIN_NODE_GAP) {
                        // Troppo vicini! Spingi
                        const push = (MIN_NODE_GAP - dist) / 2;
                        n1.x -= push;
                        n2.x += push;
                    }
                }
            });
        }

        // 4. APPLICAZIONE FINALE
        // Centra tutto nello schermo
        const finalXs = scopeNodes.map(n => n.x);
        const minX = Math.min(...finalXs);
        const maxX = Math.max(...finalXs);
        const centerShift = CENTER_POS - (minX + maxX) / 2;

        scopeNodes.forEach(n => {
            n.x = Math.round((n.x + centerShift) / SNAP_SIZE) * SNAP_SIZE;
            const lvl = levels.get(n.id) || 0;
            n.y = Math.round((CENTER_POS + lvl * LEVEL_H) / SNAP_SIZE) * SNAP_SIZE;
        });

        updateNodes(allNodes);
    };

    // Layout Genogramma secondo Carter & McGoldrick (deterministico)
    const autoLayoutCM = () => {
        const { positions, warnings } = computeGenogramLayout(nodes, edges, { centerX: CENTER_POS, centerY: CENTER_POS, snap: SNAP_SIZE });
        if (positions.size === 0) { alert("Nessuna struttura familiare da disporre (servono relazioni di coppia o figli)."); return; }
        updateNodes(nodes.map(n => { const p = positions.get(n.id); return p ? { ...n, x: p.x, y: p.y } : n; }));
        if (warnings.length) console.warn('Layout C&M:', warnings);
        setTimeout(fitView, 60);
    };

    const centerView = () => { setZoom(1); if (containerRef.current) { containerRef.current.scrollTo({ left: CENTER_POS - containerRef.current.clientWidth / 2, top: CENTER_POS - containerRef.current.clientHeight / 2, behavior: 'smooth' }); } };

    // Zoom-to-fit: inquadra tutto il contenuto con un click
    const fitView = () => {
        const c = containerRef.current; if (!c) return;
        const b = getContentBounds();
        const pad = 100;
        const w = (b.maxX - b.minX) + pad * 2;
        const h = (b.maxY - b.minY) + pad * 2;
        const newZoom = Math.min(3, Math.max(0.2, Math.min(c.clientWidth / w, c.clientHeight / h)));
        setZoom(newZoom);
        // Lo scale ha origine in CENTER_POS: un punto grafo (x,y) appare a CENTER_POS + (x - CENTER_POS) * zoom
        const cx = CENTER_POS + ((b.minX + b.maxX) / 2 - CENTER_POS) * newZoom;
        const cy = CENTER_POS + ((b.minY + b.maxY) / 2 - CENTER_POS) * newZoom;
        c.scrollTo({ left: cx - c.clientWidth / 2, top: cy - c.clientHeight / 2, behavior: 'smooth' });
    };

    // Helper: Calcola i confini esatti del contenuto (Nodi + Gruppi)
    const getContentBounds = useCallback(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (nodes.length === 0) {
            return { minX: CENTER_POS - 400, minY: CENTER_POS - 300, maxX: CENTER_POS + 400, maxY: CENTER_POS + 300 };
        }

        nodes.forEach(n => {
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + NODE_WIDTH); maxY = Math.max(maxY, n.y + NODE_HEIGHT);
        });

        groups.forEach(g => {
            const b = getGroupBounds(g, nodes);
            if (b) {
                minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
            }
        });
        return { minX, minY, maxX, maxY };
    }, [nodes, groups]);

    const getGraphBounds = () => {
        let { minX, minY, maxX, maxY } = getContentBounds();

        // FIX: Legenda in alto a sinistra (Top-Left Corner)
        if (showLegend) {
            // Stima altezza legenda
            const usedGenders = new Set(nodes.map(n => n.gender)).size + (nodes.some(n => n.deceased) ? 1 : 0) + (nodes.some(n => n.indexPerson) ? 1 : 0);
            const usedRels = new Set(edges.map(e => e.type)).size;
            const estimatedH = 80 + (Math.max(usedGenders, usedRels) * 24) + 20;

            // Stessa X usata nel rendering della <Legend> (b.minX - 350),
            // altrimenti negli export la legenda risulta tagliata
            const legX = minX - 350;
            const legY = minY;

            minX = Math.min(minX, legX);
            minY = Math.min(minY, legY);
            maxY = Math.max(maxY, legY + estimatedH);
        }

        const padding = 100;
        return { x: minX - padding, y: minY - padding, w: (maxX - minX) + padding * 2, h: (maxY - minY) + padding * 2 };
    };

    // Export SVG vettoriale: ideale per tesi/articoli, nessuna perdita di qualità
    const downloadSVG = () => {
        if (!svgRef.current) return;
        const bounds = getGraphBounds();
        const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
        const gElement = svgClone.querySelector('g');
        if (gElement) {
            gElement.setAttribute('transform', '');
            gElement.style.transform = '';
        }
        svgClone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
        svgClone.setAttribute('width', `${bounds.w}`);
        svgClone.setAttribute('height', `${bounds.h}`);
        svgClone.style.fontFamily = 'sans-serif';

        const svgData = new XMLSerializer().serializeToString(svgClone);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${metaTitle || 'genogramma'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadImage = async (format: 'png' | 'jpeg') => {
        if (!svgRef.current) return;
        const bounds = getGraphBounds();
        const scaleFactor = exportScale;

        const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
        const gElement = svgClone.querySelector('g');
        if (gElement) {
            gElement.setAttribute('transform', '');
            gElement.style.transform = '';
        }

        svgClone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
        svgClone.setAttribute('width', `${bounds.w * scaleFactor}`);
        svgClone.setAttribute('height', `${bounds.h * scaleFactor}`);
        svgClone.style.fontFamily = 'sans-serif';

        const svgData = new XMLSerializer().serializeToString(svgClone);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        // Nome file
        const now = new Date();
        const fileName = `${metaTitle.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.${format}`;

        img.onload = () => {
            canvas.width = bounds.w * scaleFactor;
            canvas.height = bounds.h * scaleFactor;

            if (ctx) {
                ctx.font = '12px sans-serif';
                if (format === 'jpeg') {
                    ctx.fillStyle = darkMode ? '#111827' : '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(async (blob) => {
                    if (!blob) return;

                    // FIX IPAD/MOBILE: Usa Web Share API se disponibile
                    if (navigator.canShare && navigator.share) {
                        try {
                            const file = new File([blob], fileName, { type: `image/${format}` });
                            if (navigator.canShare({ files: [file] })) {
                                await navigator.share({
                                    files: [file],
                                    title: metaTitle,
                                    text: 'Esportazione Genogramma'
                                });
                                URL.revokeObjectURL(url);
                                return; // Stop qui se condivisione riuscita
                            }
                        } catch (err) {
                            console.warn("Share fallito, provo download classico", err);
                        }
                    }

                    // Fallback Download Classico (PC Desktop)
                    const imgUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = imgUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(imgUrl);
                    URL.revokeObjectURL(url);

                }, `image/${format}`, 1.0);
            }
        };
        img.src = url;
    };

    const printVectorPDF = () => {
        const w = window.open('', '_blank');
        if (w && svgRef.current) {
            const bounds = getGraphBounds();

            // Clona l'SVG
            const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;

            // 1. Determina il colore di sfondo attuale
            const bgColor = darkMode ? '#111827' : '#ffffff'; // gray-900 vs white

            // 2. Crea un rettangolo di sfondo
            const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bgRect.setAttribute('x', String(bounds.x));
            bgRect.setAttribute('y', String(bounds.y));
            bgRect.setAttribute('width', String(bounds.w));
            bgRect.setAttribute('height', String(bounds.h));
            bgRect.setAttribute('fill', bgColor);

            // 3. Inseriscilo come PRIMO elemento (sotto a tutto)
            if (svgClone.firstChild) {
                svgClone.insertBefore(bgRect, svgClone.firstChild);
            } else {
                svgClone.appendChild(bgRect);
            }

            svgClone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
            svgClone.setAttribute('width', `${bounds.w}px`);
            svgClone.setAttribute('height', `${bounds.h}px`);

            const gElement = svgClone.querySelector('g');
            if (gElement) {
                gElement.setAttribute('transform', '');
                gElement.style.transform = '';
            }

            svgClone.style.display = 'block';
            svgClone.style.overflow = 'visible';

            const svgHtml = new XMLSerializer().serializeToString(svgClone);

            w.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${metaTitle} - Vettoriale</title>
                    <style>
                        @page { 
                            size: ${bounds.w}px ${bounds.h}px; 
                            margin: 0; 
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            width: ${bounds.w}px;
                            height: ${bounds.h}px;
                            overflow: hidden;
                            background-color: ${bgColor};
                            /* FORZA STAMPA COLORI SFONDO */
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact;
                        }
                        svg { 
                            width: 100%; 
                            height: 100%; 
                            display: block;
                        }
                        /* FIX FONT */
                        text { 
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important; 
                        }
                    </style>
                </head>
                <body>
                    ${svgHtml}
                </body>
                </html>
            `);

            w.document.close();
            w.onload = () => {
                setTimeout(() => {
                    w.focus();
                    w.print();
                }, 500);
            };
        }
    };

    // --- FUNZIONE GENERAZIONE HTML AGGIORNATA ---
    const generateReportHTML = (nodes: GenNode[], edges: RelationEdge[], groups: NodeGroup[], options: ReportOptions) => {
        // 1. Filtra le persone
        const peopleToInclude = nodes.filter(n => {
            if (options.onlyPeopleWithNotes) {
                return n.notes && n.notes.length > 0;
            }
            return true;
        });

        if (peopleToInclude.length === 0) return '<div style="padding:20px; text-align:center; color:#666;">Nessuna persona corrisponde ai criteri selezionati.</div>';

        return peopleToInclude.map(n => {
            // --- CALCOLO RELAZIONI (Rimane invariato) ---
            const spouses = edges.filter(e => (e.fromId === n.id || e.toId === n.id) && RELATION_CATEGORIES["Struttura / Coppia"].includes(e.type))
                .map(e => { const partnerId = e.fromId === n.id ? e.toId : e.fromId; const p = nodes.find(x => x.id === partnerId); const conf = BASE_REL_CONFIG[e.type]; return p ? `<b>${p.name}</b> (${conf.label})` : null; }).filter(Boolean).join(', ');

            const children = edges.filter(e => e.fromId === n.id && e.type.startsWith('child'))
                .map(e => { const c = nodes.find(x => x.id === e.toId); return c ? c.name : null; }).filter(Boolean).join(', ');

            const others = edges.filter(e => (e.fromId === n.id || e.toId === n.id) && !RELATION_CATEGORIES["Struttura / Coppia"].includes(e.type) && !e.type.startsWith('child'))
                .map(e => { const otherId = e.fromId === n.id ? e.toId : e.fromId; const otherNode = nodes.find(x => x.id === otherId); const otherGroup = !otherNode ? groups.find(g => g.id === otherId) : null; const name = otherNode ? otherNode.name : (otherGroup ? `Gruppo: ${otherGroup.label}` : 'Sconosciuto'); const conf = BASE_REL_CONFIG[e.type] || { label: e.type }; return `<li>${conf.label} con <b>${name}</b>${e.notes.length ? ` (Note: ${e.notes.map(x => x.text).join('; ')})` : ''}</li>`; }).join('');

            const userGroups = groups.filter(g => g.memberIds.includes(n.id)).map(g => g.label).join(', ');

            // --- NUOVA LOGICA DETTAGLI ANAGRAFICI ---
            let detailsParts = [];
            if (options.showGender) detailsParts.push(n.gender);
            if (options.showBirthDate && n.birthDate) detailsParts.push(n.birthDate);
            if (options.showBirthDate && n.deceased && n.deathDate) detailsParts.push(`† ${n.deathDate}`);
            if (n.profession) detailsParts.push(n.profession);
            if (options.showAge && n.birthDate) detailsParts.push(n.deceased && n.deathDate ? `${calculateAgeAtDeath(n.birthDate, n.deathDate)} anni (al decesso)` : `${calculateAge(n.birthDate)} anni`);

            const detailsString = detailsParts.length > 0 ? `<small style="font-weight:normal; color:#666;">(${detailsParts.join(', ')})</small>` : '';

            // --- COSTUZIONE HTML ---
            let clinicalInfo = [];
            if (n.deceased) clinicalInfo.push("Deceduto");
            if (n.indexPerson) clinicalInfo.push("Paziente Designato");
            if (n.substanceAbuse) clinicalInfo.push("Abuso Sostanze");
            if (n.mentalIssue) clinicalInfo.push("Problema Psicologico");
            if (n.physicalIssue) clinicalInfo.push("Problema Fisico");
            if (n.gayLesbian) clinicalInfo.push("Omosessuale");
            if (n.behavioralAddiction) clinicalInfo.push("Dipendenza Comportamentale");
            if (n.eatingDisorder) clinicalInfo.push("Disturbo Alimentare");
            if (n.institutionalized) clinicalInfo.push("Istituzionalizzato");

            return `
            <div class="person-card">
                <h3>${n.name} ${detailsString}</h3>
                
                ${options.showClinical && clinicalInfo.length > 0 ? `<p class="clinical-tags"><strong>Clinica:</strong> ${clinicalInfo.join(', ')}</p>` : ''}

                ${options.showGroups && userGroups ? `<p><strong>Gruppi:</strong> ${userGroups}</p>` : ''}
                
                ${options.showFamily && (spouses || children) ? `
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
                        ${spouses ? `<p><strong>Partner:</strong> ${spouses}</p>` : ''}
                        ${children ? `<p><strong>Figli:</strong> ${children}</p>` : ''}
                    </div>
                ` : ''}

                ${options.showRelations && others ? `<p><strong>Altre Relazioni:</strong></p><ul>${others}</ul>` : ''}
                
                ${options.showNotes && n.notes.length > 0 ? `<div class="notes-section"><strong>Diario Clinico:</strong><ul>${n.notes.map(note => `<li><span class="note-date">${note.date}</span>: ${note.text}</li>`).join('')}</ul></div>` : ''}
            </div>
          `;
        }).join('');
    };

    // --- FUNZIONE STAMPA PDF (CORRETTA E VISIBILE) ---
    // Sostituisci tutto il blocco errato "const printPDF..." con questo:

    const executePrintPDF = (options: ReportOptions) => {
        const w = window.open('', '_blank');
        if (w && svgRef.current) {
            const bounds = getGraphBounds();
            const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;

            // Reset trasformazioni per la stampa
            const gElement = svgClone.querySelector('g');
            if (gElement) {
                gElement.setAttribute('transform', '');
                gElement.style.transform = '';
            }

            svgClone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
            svgClone.setAttribute('width', '100%');
            // Altezza fissa per la prima pagina, il resto scorre
            svgClone.setAttribute('height', '50vh');

            const svgHtml = new XMLSerializer().serializeToString(svgClone);

            // Genera il contenuto testuale usando le opzioni
            const reportHtml = generateReportHTML(nodes, edges, groups, options);

            // Genera Legenda (Recuperata dai dati attuali)
            const usedRelTypes = Array.from(new Set(edges.map(e => e.type)));
            const usedGenders = Array.from(new Set(nodes.map(n => n.gender)));

            const renderLegendLine = (type: string) => {
                // Generazione SVG raw per PDF
                const config = BASE_REL_CONFIG[type] || BASE_REL_CONFIG['custom'];
                if (!config) return '';
                let color = config.color;
                if (config.renderType.includes('hostile') || config.renderType.includes('triple-zigzag') || config.lineStyle === 'zigzag-thick') color = '#ef4444';

                let actualEndX = 30;

                const hasEndArrow = (config.renderType.includes('arrow') && !config.renderType.includes('center') && config.renderType !== 'double-arrow-inward') || config.renderType === 'triple-zigzag-center-arrow';
                if (hasEndArrow) actualEndX -= 6;

                let pathD = `M 0 7 L ${actualEndX} 7`;
                if (config.lineStyle.startsWith('zigzag')) pathD = getZigZagPath(0, 7, actualEndX, 7, 3, 8);

                const strokeDash = config.lineStyle === 'dashed' ? 'stroke-dasharray="4,2"' : (config.lineStyle === 'dotted' ? 'stroke-dasharray="1,2"' : '');
                const strokeW = config.lineStyle.startsWith('zigzag') ? "1.5" : "2";

                let baseHtml = `<path d="${pathD}" stroke="${color}" stroke-width="${strokeW}" ${strokeDash} fill="none" />`;

                if (type === 'best-friend') baseHtml += `<g><path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, 3)" fill="none"/><path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, -3)" fill="none"/></g>`;
                else if (config.renderType === 'fusion' || config.renderType === 'triple') baseHtml += `<g><path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, 3)" fill="none"/><path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, -3)" fill="none"/></g>`;
                else if (config.renderType === 'double' || config.renderType === 'double-zigzag') baseHtml += `<path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, 3)" fill="none" ${strokeDash}/>`;

                if (config.renderType === 'double-arrow-inward') {
                    const x1 = actualEndX * 0.3; const x2 = actualEndX * 0.7;
                    baseHtml += `<polygon points="4,-4 -4,0 4,4" fill="${color}" transform="translate(${x1}, 7)" />`;
                    baseHtml += `<polygon points="-4,-4 4,0 -4,4" fill="${color}" transform="translate(${x2}, 7)" />`;
                } else if (hasEndArrow) {
                    baseHtml += `<polygon points="-5,-4 5,0 -5,4" fill="${color}" transform="translate(${actualEndX}, 7)" />`;
                }

                return `<svg width="30" height="14" style="vertical-align:middle; margin-right:5px; overflow:visible">${baseHtml}</svg>`;
            };

            const renderGenderIcon = (g: string) => {
                let s = g === 'M' ? `<rect x="2" y="2" width="12" height="12" stroke="black" fill="white"/>` : `<circle cx="8" cy="8" r="6" stroke="black" fill="white"/>`;
                return `<svg width="16" height="16" style="vertical-align:middle; margin-right:5px">${s}</svg>`;
            };

            const legendHTML = `
              <div style="margin-top: 20px; border: 1px solid #eee; padding: 10px; border-radius: 8px; background: #fcfcfc; page-break-inside: avoid; font-size: 0.8em;">
                  <h4 style="margin:0 0 10px 0;">Legenda Rapida</h4>
                  <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                      <div>${usedGenders.map(g => `<span style="margin-right:10px">${renderGenderIcon(g)} ${g}</span>`).join('')}</div>
                      <div>${usedRelTypes.map(t => `<span style="margin-right:10px">${renderLegendLine(t)} ${BASE_REL_CONFIG[t]?.label || t}</span>`).join('')}</div>
                  </div>
              </div>
          `;

            w.document.write(`
              <html>
              <head>
                  <title>${metaTitle} - Report</title>
                  <style>
                      body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 1000px; margin: 0 auto; background: white; }
                      h1 { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; color: #111; }
                      .diagram-container { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; page-break-inside: avoid; margin-bottom: 30px; text-align: center; background: white; }
                      .person-card { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6; page-break-inside: avoid; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                      .person-card h3 { margin: 0 0 5px 0; font-size: 1.1em; color: #1e293b; }
                      .clinical-tags { font-size: 0.85em; color: #e11d48; margin-bottom: 5px; }
                      .notes-section { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 0.9em; background: #fffbeb; padding: 10px; border-radius: 4px; }
                      .note-date { font-weight: bold; color: #b45309; }
                      ul { margin: 5px 0 0 20px; padding: 0; }
                      @media print { body { padding: 0; } }
                  </style>
              </head>
              <body>
                  <h1>${metaTitle}</h1>
                  <p style="color:#666; font-size:0.9em">Generato il ${new Date().toLocaleDateString()}</p>
                  
                  <div class="diagram-container">
                      ${svgHtml}
                  </div>
                  ${legendHTML}
                  
                  <h2 style="margin-top:30px; border-bottom:1px solid #eee;">Dettaglio Clinico</h2>
                  ${reportHtml}
              </body>
              </html>
          `);
            w.document.close();
            setTimeout(() => { w.focus(); w.print(); }, 500);
        }
    };

    // Persiste i genogrammi importati (localStorage + indice + cloud best-effort):
    // senza questo, l'import spariva al primo reload o refresh remoto
    const persistImportedGenograms = async (items: GenogramMeta[]) => {
        const existingIds = new Set(genograms.map(g => g.id));
        const imported: GenogramMeta[] = items
            .filter(it => it && it.id && it.data)
            .map(it => existingIds.has(it.id) ? { ...it, id: generateId(), title: `${it.title} (importato)` } : it);
        if (imported.length === 0) return 0;

        try {
            const idxStr = localStorage.getItem('genopro_local_index');
            const idx: GenogramMeta[] = idxStr ? JSON.parse(idxStr) : [];
            imported.forEach(g => {
                localStorage.setItem(`genopro_data_${g.id}`, JSON.stringify(g));
                idx.push({ id: g.id, title: g.title, category: g.category, lastModified: g.lastModified || Date.now() } as GenogramMeta);
            });
            localStorage.setItem('genopro_local_index', JSON.stringify(idx));
        } catch (err) { console.error("Errore persistenza import:", err); }

        if (user && db) {
            const pathPart = customUser ? customUser : user.uid;
            if (pathPart) {
                for (const g of imported) {
                    try { await setDoc(doc(db, 'artifacts', appId, 'users', pathPart, 'genograms', g.id), JSON.parse(JSON.stringify(g)), { merge: true }); } catch { /* offline: resta il salvataggio locale */ }
                }
            }
        }

        setGenograms(prev => [...prev, ...imported]);
        return imported.length;
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                // Supporta sia il backup completo (array) che il singolo genogramma (oggetto)
                const items = Array.isArray(data) ? data : [data];
                const count = await persistImportedGenograms(items);
                alert(count > 0 ? `Importazione completata! (${count} genogrammi)` : "Nessun genogramma valido nel file");
            } catch (err) { alert("Errore file"); }
        };
        reader.readAsText(file);
        e.target.value = ''; // permette di reimportare lo stesso file
    };
    const handleExportBackup = () => { const blob = new Blob([JSON.stringify(genograms)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_genopro.json`; a.click(); };

    // Recupera il genogramma completo: l'indice locale contiene solo metadati
    const getFullGenogram = (g: GenogramMeta): GenogramMeta => {
        try {
            const s = localStorage.getItem(`genopro_data_${g.id}`);
            if (s) return JSON.parse(s);
        } catch { /* usa la versione in stato */ }
        return g;
    };

    // Esporta un singolo genogramma come file JSON (condivisibile con colleghi)
    const exportSingleGenogram = (g: GenogramMeta) => {
        const full = getFullGenogram(g);
        const blob = new Blob([JSON.stringify(full)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(full.title || 'genogramma').replace(/[^\w\s-]/g, '')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Duplica un genogramma (es. snapshot per confronto tra sedute)
    const duplicateGenogram = (g: GenogramMeta) => {
        const full = getFullGenogram(g);
        const copy: GenogramMeta = { ...full, id: generateId(), title: `${full.title} (copia)`, lastModified: Date.now() };
        persistImportedGenograms([copy]);
    };

    const selectedNode = selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null;
    const selectedEdge = edges.find(e => e.id === selectedEdgeIds[0]);
    const selectedGroup = groups.find(g => g.id === selectedGroupIds[0]);

    if (view === 'dashboard') {
        return (
            <div
                className="h-screen flex flex-col transition-colors duration-300"
                // APPLICHIAMO LE VARIABILI CSS ANCHE QUI
                style={{
                    backgroundColor: currentTheme.colors.bgMain,
                    color: currentTheme.colors.text,
                    '--theme-bg-main': currentTheme.colors.bgMain,
                    '--theme-bg-panel': currentTheme.colors.bgPanel,
                    '--theme-border': currentTheme.colors.border,
                    '--theme-text': currentTheme.colors.text,
                    '--theme-text-muted': currentTheme.colors.textMuted,
                    '--theme-accent': currentTheme.colors.accent,
                } as React.CSSProperties}
            >
                {/* STILI UTILITY (Necessari anche qui) */}
                <style>{`
                .theme-panel { background-color: var(--theme-bg-panel); border-color: var(--theme-border); color: var(--theme-text); }
                .theme-border { border-color: var(--theme-border); }
                .theme-text { color: var(--theme-text); }
                .theme-text-muted { color: var(--theme-text-muted); }
                .theme-hover:hover { background-color: rgba(127,127,127, 0.1); }
              `}</style>

                {showHelp && <InstructionsModal onClose={() => setShowHelp(false)} firebaseConfig={firebaseConfig} />}

                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onExport={handleExportBackup} onImport={handleImport} setCustomUser={setCustomUser} customUser={customUser} setFirebaseConfig={setFirebaseConfig} firebaseConfig={firebaseConfig} />}

                <div className="flex h-full">
                    {/* --- Sidebar Filters --- */}
                    <div className="w-64 border-r p-4 flex flex-col gap-4 theme-panel theme-border">
                        <div className="flex items-center gap-2 font-bold text-xl mb-2" style={{ color: 'var(--theme-accent)' }}><Activity /> GenoPro</div>
                        <button onClick={handleNewGenogram} className="text-white px-4 py-2 rounded flex items-center justify-center gap-2 font-medium transition-colors shadow-sm hover:opacity-90" style={{ backgroundColor: 'var(--theme-accent)' }}><Plus size={18} /> Nuovo</button>

                        <div className="space-y-1">
                            <h3 className="text-xs font-bold uppercase opacity-50 mb-2 mt-4 px-2 theme-text">Categorie</h3>
                            <button onClick={() => setFilterCategory('ALL')} className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${filterCategory === 'ALL' ? 'theme-border border bg-black/5 dark:bg-white/5 font-bold' : 'theme-hover'}`} style={filterCategory === 'ALL' ? { color: 'var(--theme-accent)' } : {}}>
                                <span className="flex items-center gap-2"><LayoutGrid size={16} /> Tutti</span>
                                <span className="opacity-50 px-1.5 py-0.5 rounded text-[10px] border theme-border">{genograms.length}</span>
                            </button>
                            {categories.map(cat => {
                                const Icon = ICON_MAP[cat.iconKey] || Tag;
                                const count = genograms.filter(g => g.category === cat.id).length;
                                const isActive = filterCategory === cat.id;
                                return (
                                    <button key={cat.id} onClick={() => setFilterCategory(cat.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${isActive ? 'theme-border border bg-black/5 dark:bg-white/5 font-bold' : 'theme-hover'}`}>
                                        <span className="flex items-center gap-2" style={{ color: isActive ? undefined : cat.color }}>
                                            <Icon size={16} color={cat.color} /> {cat.label}
                                        </span>
                                        {count > 0 && <span className="opacity-50 px-1.5 py-0.5 rounded text-[10px] border theme-border">{count}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-auto border-t theme-border pt-4 space-y-2">
                            <ThemeSelector currentThemeId={themeId} onChange={setThemeId} placement="top" />
                            {/* AGGIUNGI QUI SOTTO */}
                            <button onClick={() => setShowHelp(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm theme-hover transition-colors theme-text">
                                <HelpCircle size={16} /> Istruzioni
                            </button>
                            {/* FINE AGGIUNTA */}
                            <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm theme-hover transition-colors theme-text">
                                <Settings size={16} /> Impostazioni
                            </button>
                        </div>
                    </div>

                    {/* --- Main Content --- */}
                    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: currentTheme.colors.bgMain }}>
                        {/* Top Bar Dashboard */}
                        <div className="h-16 border-b flex items-center justify-between px-8 theme-panel theme-border">
                            <div className="flex items-center gap-4 flex-1 max-w-2xl">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={18} />
                                    <input
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border theme-border bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 theme-text placeholder-opacity-50 placeholder-current"
                                        placeholder="Cerca genogramma..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2 border-l pl-4 theme-border">
                                    <span className="text-xs uppercase font-bold opacity-50 theme-text">Ordina</span>
                                    <button onClick={() => setSortBy('date_desc')} className={`p-1.5 rounded ${sortBy === 'date_desc' ? 'bg-black/10 dark:bg-white/10 text-[var(--theme-accent)]' : 'theme-hover'}`} title="Più Recenti"><SortAsc className="rotate-180" size={18} /></button>
                                    <button onClick={() => setSortBy('date_asc')} className={`p-1.5 rounded ${sortBy === 'date_asc' ? 'bg-black/10 dark:bg-white/10 text-[var(--theme-accent)]' : 'theme-hover'}`} title="Più Vecchi"><SortAsc size={18} /></button>
                                    <button onClick={() => setSortBy('name_asc')} className={`p-1.5 rounded ${sortBy === 'name_asc' ? 'bg-black/10 dark:bg-white/10 text-[var(--theme-accent)]' : 'theme-hover'}`} title="Alfabetico"><Filter size={18} /></button>
                                </div>
                            </div>
                            <button onClick={toggleFullscreen} className="p-2 rounded-lg theme-hover transition-colors" title={isFullscreen ? "Esci da Schermo Intero" : "Schermo Intero"}>
                                {isFullscreen ? <Minimize size={18} className="theme-text" /> : <Maximize size={18} className="theme-text" />}
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredGenograms.map(g => {
                                    const catDef = categories.find(c => c.id === g.category) || categories[categories.length - 1];
                                    const Icon = ICON_MAP[catDef.iconKey] || Tag;
                                    return (
                                        <div key={g.id} onClick={() => {
                                            setCurrentGenId(g.id);
                                            setMetaTitle(g.title);
                                            setMetaCategory(g.category);
                                            setCustomPresets(g.data?.presets || []);
                                            resetEditorState(g.data?.nodes || [], g.data?.edges || [], g.data?.groups || [], g.data?.stickyNotes || []);
                                            setView('editor');
                                        }} className="group relative theme-panel rounded-xl shadow-sm hover:shadow-md transition-all border theme-border cursor-pointer overflow-hidden flex flex-col h-48">
                                            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: catDef.color }} />
                                            <div className="p-5 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: catDef.color }}>
                                                        <Icon size={12} /> {catDef.label}
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button title="Esporta file" onClick={(e) => { e.stopPropagation(); exportSingleGenogram(g); }} className="text-gray-400 hover:text-blue-500"><Download size={16} /></button>
                                                        <button title="Duplica" onClick={(e) => { e.stopPropagation(); duplicateGenogram(g); }} className="text-gray-400 hover:text-green-600"><Copy size={16} /></button>
                                                        <button title="Elimina" onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm("Eliminare?")) {
                                                                if (db) deleteDoc(doc(db, 'artifacts', appId, 'users', customUser || user?.uid || 'anon', 'genograms', g.id));
                                                                localStorage.removeItem(`genopro_data_${g.id}`);
                                                                const idxStr = localStorage.getItem('genopro_local_index');
                                                                if (idxStr) {
                                                                    const lst = JSON.parse(idxStr).filter((x: any) => x.id !== g.id);
                                                                    localStorage.setItem('genopro_local_index', JSON.stringify(lst));
                                                                }
                                                                setGenograms(prev => prev.filter(x => x.id !== g.id));
                                                            }
                                                        }} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                                <h3 className="text-lg font-bold mb-1 line-clamp-2 theme-text">{g.title}</h3>
                                                <div className="mt-auto pt-4 flex items-center justify-between text-xs opacity-60 border-t theme-border">
                                                    <span>{new Date(g.lastModified).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1"><Users size={12} /> {g.data?.nodes?.length || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Empty State */}
                                {filteredGenograms.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center h-64 opacity-40 border-2 border-dashed theme-border rounded-xl">
                                        <Search size={48} className="mb-4" />
                                        <p>Nessun genogramma trovato</p>
                                        {searchTerm && <button onClick={() => setSearchTerm('')} className="hover:underline mt-2 text-sm" style={{ color: 'var(--theme-accent)' }}>Pulisci ricerca</button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    // ... prima del return di GenogramApp ...


    return (
        <div
            className="h-screen flex flex-col overflow-hidden transition-colors duration-300 relative"
            style={{
                backgroundColor: currentTheme.colors.bgMain,
                color: currentTheme.colors.text,
                '--theme-bg-main': currentTheme.colors.bgMain,
                '--theme-bg-panel': currentTheme.colors.bgPanel,
                '--theme-border': currentTheme.colors.border,
                '--theme-text': currentTheme.colors.text,
                '--theme-text-muted': currentTheme.colors.textMuted,
                '--theme-accent': currentTheme.colors.accent,
                touchAction: 'none'
            } as React.CSSProperties}
        >
            <style>{`
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         
         /* Classi di utilità per i temi */
         .theme-panel { background-color: var(--theme-bg-panel); border-color: var(--theme-border); color: var(--theme-text); }
         .theme-border { border-color: var(--theme-border); }
         .theme-text { color: var(--theme-text); }
         .theme-text-muted { color: var(--theme-text-muted); }
         .theme-hover:hover { background-color: rgba(128,128,128, 0.1); }
       `}</style>

            {showDesigner && <StyleDesignerModal onClose={() => setShowDesigner(false)} onSave={(p) => setCustomPresets(prev => [...prev, p])} />}
            {showReport && <ReportModal onClose={() => setShowReport(false)} nodes={nodes} edges={edges} groups={groups} />}
            {/* --- INCOLLA QUI IL BLOCCO SPOSTATO --- */}
            {showReportConfig && (
                <ReportConfigModal
                    onClose={() => setShowReportConfig(false)}
                    onConfirm={(opts) => {
                        setShowReportConfig(false);
                        executePrintPDF(opts);
                    }}
                />
            )}
            {/* -------------------------------------- */}
            {quickMenu && <QuickRelMenu x={quickMenu.x} y={quickMenu.y} mode={quickMenu.mode} customPresets={customPresets} onClose={() => setQuickMenu(null)} onSelect={(t) => { updateEdges(prev => prev.map(e => e.id === quickMenu.edgeId ? { ...e, type: t } : e)); setQuickMenu(null); }} />}
            {showCategoryMenu && <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />}

            {/* --- HEADER --- */}
            <div className="h-14 border-b flex items-center px-2 md:px-4 justify-between shrink-0 gap-2 relative z-50 overflow-visible theme-panel border-b theme-border">

                {/* SINISTRA: Titolo e Categorie (Fissi) */}
                <div className="flex gap-2 md:gap-3 items-center shrink-0">
                    <button onClick={() => setView('dashboard')} className="p-2 theme-hover rounded"><LayoutGrid size={20} /></button>
                    <div className="flex flex-col ml-1">
                        <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="bg-transparent font-bold text-sm w-24 md:w-40 outline-none theme-text truncate" placeholder="Titolo" />
                        <div className="relative">
                            <button onClick={() => setShowCategoryMenu(!showCategoryMenu)} className="flex items-center gap-1 text-[10px] uppercase font-bold theme-text-muted hover:text-[var(--theme-accent)]">
                                {categories.find(c => c.id === metaCategory)?.label} <ChevronDown size={10} />
                            </button>
                            {showCategoryMenu && (
                                <div className="absolute top-full left-0 mt-1 shadow-lg rounded-lg p-1 w-40 z-50 theme-panel border theme-border">
                                    {categories.map(c => (
                                        <button key={c.id} onClick={() => { setMetaCategory(c.id); setShowCategoryMenu(false); }} className={`w-full text-left px-2 py-1.5 text-xs rounded theme-hover flex items-center gap-2`}>
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-6 w-px bg-gray-300 opacity-30 mx-1 hidden md:block" />
                </div>

                {/* CENTRO: Toolbar (Scrollabile e Comprimibile) */}
                {/* 'flex-1 min-w-0' forza questo div a restringersi invece di spingere fuori gli altri */}
                <div className="flex-1 min-w-0 flex justify-start md:justify-center px-2">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto md:max-w-full">
                        <button onClick={() => addNodeAtCenter('M')} title="Nuovo Maschio (M)" className="p-1.5 theme-hover rounded shrink-0"><Square style={{ color: 'var(--theme-accent)' }} size={20} /></button>
                        <button onClick={() => addNodeAtCenter('F')} title="Nuova Femmina (F)" className="p-1.5 theme-hover rounded shrink-0"><Circle className="text-pink-600" size={20} /></button>

                        <div className="h-4 w-px bg-gray-300 opacity-30 mx-1 shrink-0" />

                        <button onClick={addParentsToSelection} className="p-1.5 theme-hover rounded shrink-0" title="Aggiungi Genitori"><UserPlus size={18} /></button>
                        <button onClick={addSpouseToSelection} className="p-1.5 theme-hover rounded shrink-0" title="Aggiungi Partner"><Heart size={18} /></button>
                        <button onClick={addChildToSelection} className="p-1.5 theme-hover rounded shrink-0" title="Aggiungi Figlio"><GitBranch size={18} /></button>
                        <button onClick={createGroup} title="Gruppo" className="p-1.5 theme-hover rounded shrink-0"><Users size={20} /></button>

                        {/* --- CORREZIONE QUI (Rimosso il doppio <<) --- */}
                        <button onClick={() => addStickyNoteAtCursor()} title="Aggiungi Nota (N)" className="p-1.5 theme-hover rounded shrink-0" style={{ color: '#f59e0b' }}>
                            <StickyNote size={20} />
                        </button>

                        <div className="h-4 w-px bg-gray-300 opacity-30 mx-1 shrink-0" />
                        <button onClick={autoLayout} className="p-1.5 theme-hover rounded shrink-0" style={{ color: 'var(--theme-accent)' }} title="Auto-Layout"><Network size={18} /></button>
                        <button onClick={autoLayoutCM} className="p-1.5 theme-hover rounded shrink-0" style={{ color: 'var(--theme-accent)' }} title="Layout Genogramma (Carter & McGoldrick)"><GitBranch size={18} /></button>
                        <div className="h-4 w-px bg-gray-300 opacity-30 mx-1 shrink-0" />

                        <button onClick={() => alignNodes('h')} className="p-1.5 theme-hover rounded shrink-0" title="Allinea Orizzontale"><AlignJustify size={18} /></button>
                        <button onClick={() => alignNodes('v')} className="p-1.5 theme-hover rounded shrink-0" title="Allinea Verticale"><AlignJustify className="rotate-90" size={18} /></button>
                        <button onClick={() => balanceGenerations('align-children')} className="p-1.5 theme-hover rounded shrink-0" title="Centra Figli"><ArrowDownToLine size={18} style={{ color: 'var(--theme-accent)' }} /></button>
                        <button onClick={() => balanceGenerations('align-parents')} className="p-1.5 theme-hover rounded shrink-0" title="Centra Genitori"><ArrowUpToLine size={18} style={{ color: 'var(--theme-accent)' }} /></button>

                        <div className="h-4 w-px bg-gray-300 opacity-30 mx-1 shrink-0" />
                        <button onClick={() => alignNodes('circle')} className="p-1.5 theme-hover rounded shrink-0" title="Cerchio"><CircleDashed size={18} /></button>
                        <button onClick={() => alignNodes('grid')} className="p-1.5 theme-hover rounded shrink-0" title="Griglia"><Grid3X3 size={18} /></button>
                        <button onClick={() => alignNodes('diagonal')} className="p-1.5 theme-hover rounded shrink-0" title="Diagonale"><TrendingUp size={18} /></button>

                        <div className="h-4 w-px bg-gray-300 opacity-30 mx-1 shrink-0" />
                        <button onClick={() => setSnapToGrid(!snapToGrid)} className={`p-1.5 rounded shrink-0 ${snapToGrid ? 'bg-black/10 dark:bg-white/10' : 'theme-hover'}`} title="Snap Griglia"><Grip size={18} /></button>
                        <button onClick={() => setSelectionMode(!selectionMode)} className={`p-1.5 rounded shrink-0 ${selectionMode ? 'bg-black/10 dark:bg-white/10' : 'theme-hover'}`} title="Mod. Selezione"><MousePointer2 size={18} /></button>
                        <button onClick={() => setShowDesigner(true)} className="p-1.5 theme-hover rounded shrink-0" title="Stili"><Edit3 size={18} /></button>
                        <div className="flex items-center gap-1 border-l pl-2 dark:border-gray-700">
                            <label className="text-xs text-gray-500 whitespace-nowrap ml-1">Testo Nodo:</label>
                            <select
                                value={showLabels}
                                onChange={(e) => setShowLabels(e.target.value as any)}
                                className="bg-transparent text-xs p-1 rounded border hover:bg-black/5 dark:border-gray-600 dark:hover:bg-white/5 outline-none"
                            >
                                <option value="age" className="text-black">Età</option>
                                <option value="year" className="text-black">Anno</option>
                                <option value="date" className="text-black">Data</option>
                                <option value="none" className="text-black">Nessuno</option>
                            </select>
                        </div>
                        <button onClick={() => setShowLegend(!showLegend)} className={`p-1.5 rounded shrink-0 ${showLegend ? 'bg-black/10 dark:bg-white/10' : 'theme-hover'}`} title="Mostra Legenda"><Info size={18} /></button>
                    </div>
                </div>

                {/* DESTRA: Sync, Undo, Theme, Export (Fissi) */}
                <div className="flex gap-2 items-center shrink-0">
                    {/* Sync Status - Nascosto su mobile stretto */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm mr-2 theme-border theme-panel" title="Stato Sync">
                        {syncStatus === 'synced' && <Cloud className="text-green-500" size={16} />}
                        {syncStatus === 'syncing' && <RefreshCw className="text-orange-500 animate-spin" size={16} />}
                        {syncStatus === 'error' && <CloudOff className="text-red-500" size={16} />}
                        {syncStatus === 'offline' && <CloudOff className="opacity-50" size={16} />}
                        <span className={`text-[10px] font-bold uppercase ${syncStatus === 'synced' ? 'text-green-600' : 'opacity-50'}`}>
                            {syncStatus === 'synced' ? 'SYNC' : syncStatus === 'syncing' ? 'SAVING' : 'OFFLINE'}
                        </span>
                    </div>

                    <button onClick={handleUndo} disabled={historyIndex <= 0} className={`p-1.5 rounded ${historyIndex <= 0 ? 'opacity-30' : 'theme-hover'}`} title="Annulla"><RotateCcw size={18} /></button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={`p-1.5 rounded ${historyIndex >= history.length - 1 ? 'opacity-30' : 'theme-hover'}`} title="Ripristina"><RotateCw size={18} /></button>

                    <div className="h-6 w-px bg-gray-300 opacity-30 mx-1 hidden md:block" />

                    <button onClick={centerView} className="p-1.5 theme-hover rounded hidden md:block" title="Ricentra"><Target size={18} /></button>
                    <button onClick={fitView} className="p-1.5 theme-hover rounded" title="Adatta contenuto (Ctrl+0)"><Scan size={18} /></button>
                    <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1.5 theme-hover rounded hidden sm:block"><ZoomOut size={18} /></button>
                    <span className="text-xs w-8 text-center hidden md:block">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1.5 theme-hover rounded hidden sm:block"><ZoomIn size={18} /></button>

                    <div className="h-6 w-px bg-gray-300 opacity-30 mx-1" />

                    {/* TASTO TEMA DROPDOWN (Compatto per Header) */}
                    <div className="w-10 md:w-32">
                        {/* Su mobile mostra solo icona o versione ridotta, su desktop menu completo */}
                        <div className="hidden md:block">
                            <ThemeSelector currentThemeId={themeId} onChange={setThemeId} placement="bottom" />
                        </div>
                        <div className="md:hidden">
                            <button
                                onClick={() => {
                                    const idx = PRESET_THEMES.findIndex(t => t.id === themeId);
                                    const next = PRESET_THEMES[(idx + 1) % PRESET_THEMES.length];
                                    setThemeId(next.id);
                                }}
                                className="p-1.5 theme-hover rounded"
                            >
                                {currentTheme.type === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            </button>
                        </div>
                    </div>

                    <button onClick={() => setShowReport(true)} className="p-1.5 theme-hover rounded hidden sm:block" style={{ color: 'var(--theme-accent)' }} title="Report"><FileText size={20} /></button>

                    <div className="relative group z-50">
                        <button className="p-1.5 theme-hover rounded font-bold" style={{ color: 'var(--theme-accent)' }} title="Esporta"><Download size={20} /></button>
                        <div className="absolute right-0 top-full theme-panel border theme-border shadow-lg rounded p-3 hidden group-hover:block w-64 z-[70]">
                            <div className="mb-3 pb-3 border-b theme-border">
                                <div className="text-[10px] uppercase font-bold opacity-50 mb-2">Qualità Immagine</div>
                                <div className="flex bg-black/5 dark:bg-white/5 rounded p-1 gap-1 items-center">
                                    {[1, 2, 4, 6].map(s => (<button key={s} onClick={(e) => { e.stopPropagation(); setExportScale(s); }} className={`flex-1 text-[10px] py-1.5 rounded transition-all font-medium ${exportScale === s ? 'theme-panel shadow text-[var(--theme-accent)]' : 'opacity-50'}`}>{s}x</button>))}
                                    <div className="w-px h-4 bg-gray-300 opacity-30 mx-0.5"></div>
                                    <div className="relative group/input"><input type="number" min="1" max="12" value={exportScale} onClick={(e) => e.stopPropagation()} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setExportScale(Math.max(1, Math.min(12, val))); }} className="w-10 text-[10px] py-1 rounded border-none bg-transparent text-center outline-none font-bold text-[var(--theme-accent)]" placeholder="#" /></div>
                                </div>
                            </div>

                            <div className="text-[10px] uppercase font-bold opacity-50 mb-1 px-2">Immagini</div>
                            <button onClick={() => downloadImage('png')} className="block w-full text-left p-2 theme-hover text-xs rounded flex items-center gap-2"><ImageIcon size={14} /> Scarica PNG</button>
                            <button onClick={() => downloadImage('jpeg')} className="block w-full text-left p-2 theme-hover text-xs rounded flex items-center gap-2"><FileImage size={14} /> Scarica JPEG</button>
                            <button onClick={downloadSVG} className="block w-full text-left p-2 theme-hover text-xs rounded flex items-center gap-2"><GitBranch size={14} /> Scarica SVG (Vettoriale)</button>

                            <div className="h-px bg-gray-200 dark:bg-gray-600 my-2 opacity-30" />

                            <div className="text-[10px] uppercase font-bold opacity-50 mb-1 px-2">Documenti</div>
                            <button onClick={printVectorPDF} className="block w-full text-left p-2 theme-hover text-xs rounded flex items-center gap-2"><FileText size={14} /> PDF Vettoriale (Solo Grafico)</button>
                            <button onClick={() => setShowReportConfig(true)} className="block w-full text-left p-2 theme-hover text-xs rounded flex items-center gap-2"><FileText size={14} /> Report Clinico (Completo)</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MAIN AREA --- */}
            <div className="flex-1 flex overflow-hidden relative print:overflow-visible">
                <div
                    ref={containerRef}
                    className="flex-1 overflow-auto relative"
                    style={{ touchAction: 'none' }}
                >
                    <div style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }} className="relative print:w-full print:h-full">
                        {/* Background Grid */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none print:hidden" style={{ backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`, backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`, color: 'var(--theme-text-muted)' }} />
                        {/* Snap Grid overlay: stronger dots at SNAP_SIZE intervals */}
                        {snapToGrid && <div className="absolute inset-0 opacity-20 pointer-events-none print:hidden" style={{ backgroundImage: `radial-gradient(currentColor 1.5px, transparent 1.5px)`, backgroundSize: `${SNAP_SIZE}px ${SNAP_SIZE}px`, color: 'var(--theme-text-muted)' }} />}

                        <svg
                            ref={svgRef}
                            width={CANVAS_SIZE} height={CANVAS_SIZE}
                            className={`block touch-none ${isPanMode ? (dragState?.active ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                            style={{ touchAction: 'none' }}

                            // 1. Gestione Menu Contestuale
                            onContextMenu={(e) => {
                                e.preventDefault(); // Uccidi il menu nativo di Android SEMPRE
                                e.stopPropagation();
                                // Nota: non chiamiamo handleContextMenu qui perché usiamo handleCanvasDown (bottone) 
                                // o il timer (dito) per aprirlo.
                            }}

                            // 2. Gestione Logica Principale (Click, Penna, Long Press Dito)
                            onPointerDown={handleCanvasDown}

                            // 3. Gestione Zoom (Pinch)
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <g
                                ref={groupRef}
                                transform={`scale(${zoom})`} style={{ transformOrigin: `${CENTER_POS}px ${CENTER_POS}px` }}>
                                {/* GRUPPI (Sfondo e Label) */}
                                {groups.map(g => {
                                    const geom = getGroupGeometry(g, nodes);
                                    if (!geom) return null;
                                    const { d: pathD, cx } = geom;

                                    const isSel = selectedGroupIds.includes(g.id);
                                    const gColor = (g.color === '#000000' && darkMode) ? '#ffffff' : g.color;

                                    // Label Pos logic
                                    const labelX = g.labelPos ? g.labelPos.x : cx;
                                    // Posiziona label sopra il punto più alto del gruppo se non custom
                                    const labelY = g.labelPos ? g.labelPos.y : (Math.min(...geom.expandedPoints.map(p => p.y)) - 20);

                                    return (
                                        <g key={g.id} onClick={(e) => { e.stopPropagation(); setSelectedGroupIds([g.id]); setSelectedNodeIds([]); }}>
                                            <path
                                                d={pathD}
                                                fill={gColor}
                                                fillOpacity={0.05}
                                                stroke={gColor}
                                                strokeDasharray="10,5"
                                                strokeWidth={isSel ? 3 : 2}
                                                strokeLinejoin="round"
                                                className={isSel ? 'stroke-blue-500 cursor-move' : 'cursor-pointer'}
                                                onPointerDown={(e) => { e.stopPropagation(); setSelectedGroupIds([g.id]); setSelectedNodeIds([]); }}
                                            />
                                            {g.showLabel !== false && (
                                                <g
                                                    transform={`translate(${labelX}, ${labelY})`}
                                                    className="cursor-move"
                                                    onPointerDown={(e) => {
                                                        e.stopPropagation(); e.preventDefault();
                                                        const { x, y } = getEventCoords(e);
                                                        dragRef.current = {
                                                            active: true, type: 'group-label', sourceId: g.id,
                                                            startX: x, startY: y, currX: x, currY: y,
                                                            initialNodePositions: { [g.id]: { x: labelX, y: labelY } },
                                                            pointerId: e.pointerId
                                                        };
                                                        setDragState({ ...dragRef.current });
                                                    }}
                                                >
                                                    <rect x={-(g.label.length * 4) - 10} y="-12" width={(g.label.length * 8) + 20} height="24" fill={currentTheme.colors.bgPanel} fillOpacity="0.8" rx="4" stroke={isSel ? 'blue' : 'transparent'} />
                                                    <text textAnchor="middle" dy="5" fill={gColor} className="text-xs font-bold uppercase select-none pointer-events-none">{g.label}</text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* ARCHI AGGIORNATI (V7 - Bezier Perfect Match) */}
                                {edges.map(e => {
                                    let start = getEntityCenter(e.fromId, nodes, groups);
                                    let end = getEntityCenter(e.toId, nodes, groups);
                                    if (!start || !end) return null;

                                    // 2. Intersezione TARGET
                                    const tGroup = groups.find(g => g.id === e.toId);
                                    if (tGroup) {
                                        const geom = getGroupGeometry(tGroup, nodes);
                                        if (geom) {
                                            if (e.toAnchor !== undefined) {
                                                // Usa Math Bezier preciso con i punti di controllo
                                                end = getPointOnOrganicPerimeter(geom.controlPoints, e.toAnchor);
                                            } else {
                                                // Auto (Closest Point su perimetro approssimato va bene per l'auto)
                                                end = getClosestPointOnPolygon(geom.expandedPoints, start);
                                            }
                                        }
                                    }

                                    // 3. Intersezione SOURCE
                                    const sGroup = groups.find(g => g.id === e.fromId);
                                    if (sGroup) {
                                        const geom = getGroupGeometry(sGroup, nodes);
                                        if (geom) {
                                            if (e.fromAnchor !== undefined) {
                                                start = getPointOnOrganicPerimeter(geom.controlPoints, e.fromAnchor);
                                            } else {
                                                start = getClosestPointOnPolygon(geom.expandedPoints, end);
                                            }
                                        }
                                    }

                                    // ... Logica Nodi (child/marriage) rimane invariata ...
                                    const fNode = nodes.find(n => n.id === e.fromId);
                                    const tNode = nodes.find(n => n.id === e.toId);
                                    const isTwin = e.type.startsWith('twin');
                                    if ((e.type.startsWith('child') || isTwin) && fNode && tNode) {
                                        const marriage = findMarriageEdge(e.fromId, edges);
                                        if (marriage) {
                                            const p1 = nodes.find(n => n.id === marriage.fromId); const p2 = nodes.find(n => n.id === marriage.toId);
                                            if (p1 && p2) start = { x: (p1.x + p2.x + NODE_WIDTH) / 2, y: Math.max(p1.y, p2.y) + MARRIAGE_BAR_Y };
                                        } else start = { x: fNode.x + NODE_WIDTH / 2, y: fNode.y + NODE_HEIGHT };
                                    }

                                    const customConf = customPresets.find(p => p.id === e.type);
                                    return <g key={e.id} onClick={(ev) => { ev.stopPropagation(); handleEdgeClick(e.id, ev); }}><ConnectionLine edge={e} start={start} end={end} isSelected={selectedEdgeIds.includes(e.id)} darkMode={darkMode} customConfig={customConf} onAddChild={(ev: any, eid: string) => handleEdgeAction(ev, eid)} isTargetGroup={groups.some(g => g.id === e.toId)} tNode={tNode} /></g>
                                })}

                                {/* DRAG LINES */}
                                {dragState && dragState.type !== 'move' && dragState.type !== 'box' && dragState.type !== 'pan' && (<line x1={dragState.startX} y1={dragState.startY} x2={dragState.currX} y2={dragState.currY} stroke="gray" strokeDasharray="5,5" />)}
                                {dragState && dragState.type === 'move' && selectedNodeIds.map(nid => {
                                    const n = nodes.find(no => no.id === nid); if (!n) return null;
                                    const init = dragRef.current?.initialNodePositions?.[nid]; if (!init) return null;
                                    const dx = dragState.currX - dragState.startX; const dy = dragState.currY - dragState.startY;
                                    let nx = init.x + dx; let ny = init.y + dy;
                                    if (snapToGrid) { nx = Math.round(nx / SNAP_SIZE) * SNAP_SIZE; ny = Math.round(ny / SNAP_SIZE) * SNAP_SIZE; }
                                    return <rect key={nid} x={nx} y={ny} width={NODE_WIDTH} height={NODE_HEIGHT} fill="none" stroke="gray" strokeDasharray="2,2" />
                                })}

                                {/* NODI */}
                                {nodes.map(n => {
                                    // Feedback visivo durante modifica gruppo
                                    const isMemberOfEditing = editingGroupId
                                        ? groups.find(g => g.id === editingGroupId)?.memberIds.includes(n.id)
                                        : false;

                                    return (
                                        <g key={n.id}
                                            // CAMBIATO DA onMouseDown/TouchStart A onPointerDown
                                            onPointerDown={(e) => handleNodeDown(e, n.id)}
                                            style={{ touchAction: 'none' }} // Importante per la penna
                                        >
                                            {/* Highlight se membro durante editing */}
                                            {editingGroupId && (
                                                <circle
                                                    cx={n.x + NODE_WIDTH / 2} cy={n.y + NODE_HEIGHT / 2}
                                                    r={NODE_WIDTH}
                                                    fill="none"
                                                    stroke={isMemberOfEditing ? "#22c55e" : "transparent"}
                                                    strokeWidth={3}
                                                    strokeDasharray={isMemberOfEditing ? "" : "4,2"}
                                                    className="pointer-events-none transition-all duration-300"
                                                    opacity={isMemberOfEditing ? 1 : 0.3}
                                                />
                                            )}

                                            <NodeShape node={n} isSelected={selectedNodeIds.includes(n.id)} showLabelType={showLabels} darkMode={darkMode} onHandleDown={handleHandleDown} selectionMode={selectionMode} onRename={(id: string, name: string) => updateNodes(prev => prev.map(no => no.id === id ? { ...no, name } : no))} />
                                        </g>
                                    );
                                })}

                                {/* LEGENDA */}
                                {(() => { if (!showLegend) return null; const b = getContentBounds(); return <Legend x={b.minX - 350} y={b.minY} darkMode={darkMode} nodes={nodes} edges={edges} />; })()}

                                {dragState && dragState.type === 'box' && (<rect x={Math.min(dragState.startX, dragState.currX)} y={Math.min(dragState.startY, dragState.currY)} width={Math.abs(dragState.currX - dragState.startX)} height={Math.abs(dragState.currY - dragState.startY)} fill="rgba(0,0,255,0.1)" stroke="blue" />)}
                                {/* LAYER MANIGLIE GRUPPI (Sincronizzato) */}
                                {groups.map(g => {
                                    if (!selectedGroupIds.includes(g.id)) return null;

                                    const geom = getGroupGeometry(g, nodes);
                                    if (!geom) return null;
                                    const { cx, cy } = geom;
                                    const currentPadding = g.customPadding || 50;

                                    return (
                                        <g key={`handles-${g.id}`}>
                                            {/* 1. Maniglia LINK (Gialla - Sinistra) */}
                                            <g transform={`translate(${cx - currentPadding - 20}, ${cy})`}
                                                className="cursor-crosshair"
                                                style={{ touchAction: 'none' }}
                                                onPointerDown={(e) => {
                                                    e.stopPropagation(); e.preventDefault();

                                                    handleGroupDown(e, g.id);
                                                }}
                                            >
                                                <rect x={-10} y={-10} width={20} height={20} rx={4} fill="#f59e0b" stroke="white" strokeWidth={2} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                                                <Waypoints size={12} x={-6} y={-6} color="white" />
                                                <title>Crea Relazione</title>
                                            </g>

                                            {/* 2. Maniglia PADDING (Viola - Basso) */}
                                            <g transform={`translate(${cx}, ${cy + currentPadding + 10})`}
                                                className="cursor-ns-resize"
                                                style={{ touchAction: 'none' }}
                                                onPointerDown={(e) => {
                                                    e.stopPropagation(); e.preventDefault();

                                                    const { x, y } = getEventCoords(e);
                                                    dragRef.current = {
                                                        active: true, type: 'group-padding', sourceId: g.id,
                                                        startX: x, startY: y, currX: x, currY: y,
                                                        initialPadding: currentPadding,
                                                        pointerId: e.pointerId
                                                    } as any;
                                                    setDragState({ ...dragRef.current });
                                                }}
                                            >
                                                <path d="M0 -8 L8 0 L0 8 L-8 0 Z" fill="#8b5cf6" stroke="white" strokeWidth={2} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                                                <title>Regola Grandezza</title>
                                            </g>
                                        </g>
                                    );
                                })}
                                {/* --- STICKY NOTES LAYER --- */}
                                {stickyNotes.map(note => (
                                    <StickyNoteShape
                                        key={note.id}
                                        note={note}
                                        zoom={zoom}
                                        isSelected={selectedNoteIds.includes(note.id)}
                                        // CAMBIATO DA onMouseDown A onPointerDown
                                        onPointerDown={(e) => handleNoteDown(e, note.id)}
                                        onUpdate={(updatedNote) => {
                                            setStickyNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
                                        }}
                                    />
                                ))}
                                {/* WIDGET TRASFORMAZIONE */}
                                <SelectionTransformer
                                    nodes={nodes}
                                    selectedIds={selectedNodeIds}
                                    onHandleDown={handleTransformStart}
                                    onMove={handleSelectionDrag}
                                />
                            </g>
                        </svg>
                    </div>
                </div>

                {/* --- SIDEBAR PROPRIETÀ UNIFICATA --- */}
                {(selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0 || selectedNoteIds.length > 0) && (
                    <div className="w-80 border-l p-4 overflow-y-auto theme-panel theme-border print:hidden flex flex-col h-full shadow-xl z-50">

                        {/* Header Sidebar con Deselezione Totale */}
                        <h3 className="font-bold mb-4 flex justify-between items-center shrink-0">
                            Proprietà
                            <button
                                onClick={() => {
                                    setSelectedNodeIds([]);
                                    setSelectedEdgeIds([]);
                                    setSelectedGroupIds([]);
                                    setSelectedNoteIds([]); // <--- Reset Note
                                }}
                                className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </h3>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">

                            {/* 1. PROPRIETÀ NODO (PERSONA) */}
                            {selectedNode && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <input className="w-full border p-1 rounded bg-transparent theme-border font-bold" value={selectedNode.name} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, name: e.target.value } : n))} placeholder="Nome" />
                                    <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedNode.label || ''} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))} placeholder="Etichetta (es. Padre)" />
                                    <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedNode.profession || ''} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, profession: e.target.value } : n))} placeholder="Professione" />
                                    <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedNode.birthDate} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, birthDate: e.target.value } : n))} placeholder="Nascita (Data, Anno o inserisci direttamente un'Età)" />
                                    {selectedNode.deceased && (
                                        <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedNode.deathDate || ''} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, deathDate: e.target.value } : n))} placeholder="Morte (Data o Anno)" />
                                    )}

                                    <div className="flex items-center gap-2 mb-1">
                                        <input
                                            type="checkbox"
                                            id="showAge"
                                            checked={selectedNode.showAge !== false}
                                            onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, showAge: e.target.checked } : n))}
                                        />
                                        <label htmlFor="showAge" className="text-xs opacity-70">Mostra Età</label>
                                    </div>
                                    <div className="text-xs opacity-50">
                                        Età: {selectedNode.deceased && selectedNode.deathDate ? `${calculateAgeAtDeath(selectedNode.birthDate, selectedNode.deathDate)} (al decesso)` : calculateAge(selectedNode.birthDate)}
                                    </div>

                                    <select className="w-full border p-1 rounded bg-transparent theme-border" value={selectedNode.gender} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, gender: e.target.value as Gender } : n))}>
                                        <option value="M" className="text-black">Maschio</option><option value="F" className="text-black">Femmina</option>
                                        <option value="TransWoman" className="text-black">Donna Trans (MTF)</option>
                                        <option value="TransMan" className="text-black">Uomo Trans (FTM)</option>
                                        <option value="NonBinary" className="text-black">Non-Binary/Genderqueer</option>
                                        <option value="Pet" className="text-black">Animale</option><option value="Pregnancy" className="text-black">Gravidanza</option><option value="Miscarriage" className="text-black">Aborto Spontaneo</option><option value="Abortion" className="text-black">Aborto Volontario</option><option value="Stillbirth" className="text-black">Morto alla nascita</option>
                                    </select>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.deceased ? 'bg-black text-white dark:bg-white dark:text-black' : 'theme-border hover:bg-black/5'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, deceased: !n.deceased } : n))}>Deceduto</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.indexPerson ? 'bg-blue-600 text-white' : 'theme-border hover:bg-blue-50'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, indexPerson: !n.indexPerson } : n))}>Pz. Designato</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.substanceAbuse ? 'bg-orange-500 text-white' : 'theme-border hover:bg-orange-50'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, substanceAbuse: !n.substanceAbuse } : n))}>Abuso Sost.</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.mentalIssue ? 'bg-purple-500 text-white' : 'theme-border hover:bg-purple-50'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, mentalIssue: !n.mentalIssue } : n))}>Problema Psi.</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.gayLesbian ? 'bg-pink-500 text-white' : 'theme-border hover:bg-pink-50'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, gayLesbian: !n.gayLesbian } : n))}>Omosessuale</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.behavioralAddiction ? 'bg-teal-500 text-white' : 'theme-border hover:bg-teal-50'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, behavioralAddiction: !n.behavioralAddiction } : n))}>Dip. Comport.</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.eatingDisorder ? 'bg-rose-600 text-white' : 'theme-border hover:bg-rose-50'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, eatingDisorder: !n.eatingDisorder } : n))}>Dist. Alimentare</button>
                                        <button className={`border px-2 py-1 text-xs rounded transition-colors ${selectedNode.institutionalized ? 'bg-slate-600 text-white' : 'theme-border hover:bg-slate-100'}`} onClick={() => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, institutionalized: !n.institutionalized } : n))}>Istituzionaliz.</button>
                                    </div>

                                    <NotesPanel notes={selectedNode.notes} onChange={newNotes => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, notes: newNotes } : n))} />

                                    <button onClick={() => { updateAll(nodes.filter(n => !selectedNodeIds.includes(n.id)), edges.filter(e => !selectedNodeIds.includes(e.fromId) && !selectedNodeIds.includes(e.toId)), groups); setSelectedNodeIds([]); }} className="w-full bg-red-100 text-red-600 py-2 rounded text-xs hover:bg-red-200 mt-4 flex items-center justify-center gap-2"><Trash2 size={14} /> Elimina Persona</button>
                                </div>
                            )}

                            {/* 2. PROPRIETÀ ARCO (RELAZIONE) */}
                            {selectedEdge && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                                    {/* SLIDER ANCORAGGIO */}
                                    {groups.some(g => g.id === selectedEdge.fromId) && (
                                        <div className="pt-2 border-t theme-border">
                                            <div className="flex justify-between text-xs mb-1 opacity-70"><span>Punto di Partenza</span><span>{Math.round((selectedEdge.fromAnchor ?? 0) * 100)}%</span></div>
                                            <input
                                                type="range" min="0" max="100" step="1"
                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent)]"
                                                value={(selectedEdge.fromAnchor ?? -1) === -1 ? 0 : (selectedEdge.fromAnchor! * 100)}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) / 100;
                                                    updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, fromAnchor: val } : ed));
                                                }}
                                            />
                                            <button onClick={() => updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, fromAnchor: undefined } : ed))} className="text-[10px] text-blue-500 hover:underline mt-1">Reset Automatico</button>
                                        </div>
                                    )}

                                    {groups.some(g => g.id === selectedEdge.toId) && (
                                        <div className="pt-2 border-t theme-border">
                                            <div className="flex justify-between text-xs mb-1 opacity-70"><span>Punto di Arrivo</span><span>{Math.round((selectedEdge.toAnchor ?? 0) * 100)}%</span></div>
                                            <input
                                                type="range" min="0" max="100" step="1"
                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent)]"
                                                value={(selectedEdge.toAnchor ?? -1) === -1 ? 0 : (selectedEdge.toAnchor! * 100)}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) / 100;
                                                    updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, toAnchor: val } : ed));
                                                }}
                                            />
                                            <button onClick={() => updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, toAnchor: undefined } : ed))} className="text-[10px] text-blue-500 hover:underline mt-1">Reset Automatico</button>
                                        </div>
                                    )}

                                    <label className="text-xs opacity-50 font-bold block">Tipo Relazione</label>
                                    <RelationshipSelector value={selectedEdge.type} onChange={(t: string) => {
                                        const conf = BASE_REL_CONFIG[t] || {};
                                        updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, type: t, color: conf.color, lineStyle: conf.lineStyle } : ed));
                                    }} className="text-black" />

                                    <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedEdge.label} onChange={e => updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, label: e.target.value } : ed))} placeholder="Etichetta" />

                                    <NotesPanel notes={selectedEdge.notes} onChange={newNotes => updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, notes: newNotes } : ed))} />

                                    <button onClick={() => { updateEdges(edges.filter(e => e.id !== selectedEdge.id)); setSelectedEdgeIds([]); }} className="w-full bg-red-100 text-red-600 py-2 rounded text-xs hover:bg-red-200 mt-4 flex items-center justify-center gap-2"><Trash2 size={14} /> Elimina Relazione</button>
                                </div>
                            )}

                            {/* 3. PROPRIETÀ GRUPPO */}
                            {selectedGroup && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <label className="text-xs opacity-50 font-bold">Tipo Gruppo</label>
                                    <select className="w-full p-2 rounded border bg-transparent theme-border" value={selectedGroup.type} onChange={e => updateGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, type: e.target.value as any } : g))}>
                                        <option value="household" className="text-black">Household</option><option value="subsystem" className="text-black">Sottosistema</option>
                                    </select>

                                    <button
                                        onClick={() => setEditingGroupId(selectedGroup.id)}
                                        className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors border ${editingGroupId === selectedGroup.id ? 'bg-green-100 text-green-700 border-green-300' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}
                                    >
                                        {editingGroupId === selectedGroup.id ? <Check size={14} /> : <Edit3 size={14} />}
                                        {editingGroupId === selectedGroup.id ? 'Fine Modifica Membri' : 'Modifica Membri'}
                                    </button>
                                    {editingGroupId === selectedGroup.id && (
                                        <div className="text-[10px] opacity-70 text-center bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800">
                                            <Info size={10} className="inline mr-1" /> Clicca sulle persone nel grafico per aggiungerle o rimuoverle dal gruppo.
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mb-2 pt-2 border-t theme-border">
                                        <input
                                            type="checkbox"
                                            id="showLabel"
                                            checked={selectedGroup.showLabel !== false}
                                            onChange={e => updateGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, showLabel: e.target.checked } : g))}
                                        />
                                        <label htmlFor="showLabel" className="text-xs">Mostra Etichetta</label>
                                    </div>
                                    <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedGroup.label} onChange={e => updateGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, label: e.target.value } : g))} placeholder="Etichetta Gruppo" />

                                    <div className="border theme-border rounded p-2 bg-black/5 dark:bg-white/5">
                                        <PalettePicker
                                            value={selectedGroup.color}
                                            onChange={(c) => updateGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, color: c } : g))}
                                        />
                                    </div>

                                    <NotesPanel notes={selectedGroup.notes} onChange={newNotes => updateGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, notes: newNotes } : g))} />

                                    <button onClick={() => { updateGroups(groups.filter(g => g.id !== selectedGroup.id)); setSelectedGroupIds([]); }} className="w-full bg-red-100 text-red-600 py-2 rounded text-xs hover:bg-red-200 mt-4 flex items-center justify-center gap-2"><Trash2 size={14} /> Elimina Gruppo</button>
                                </div>
                            )}

                            {/* 4. PROPRIETÀ STICKY NOTE (ORA NELLA SIDEBAR!) */}
                            {selectedNoteIds.length === 1 && (() => {
                                const note = stickyNotes.find(n => n.id === selectedNoteIds[0]);
                                if (!note) return null;

                                return (
                                    <StickyNotePropertiesPanel
                                        note={note}
                                        onUpdate={(updates) => {
                                            setStickyNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...updates } : n));
                                        }}
                                        onDelete={() => {
                                            if (confirm("Eliminare questa nota?")) {
                                                const newNotes = stickyNotes.filter(n => n.id !== note.id);
                                                updateAllWithNotes(nodes, edges, groups, newNotes);
                                                setSelectedNoteIds([]);
                                            }
                                        }}
                                    />
                                );
                            })()}

                        </div>
                    </div>
                )}
                {contextMenu && (
                    <div
                        className="fixed z-[9999] flex flex-col gap-2 p-3 rounded-xl shadow-2xl theme-panel theme-border border animate-in fade-in zoom-in duration-200"
                        style={{
                            left: contextMenu.x - 75, // Centraggio ricalcolato per 3 bottoni
                            top: contextMenu.y - 100
                        }}
                    >
                        <div className="text-[10px] font-bold opacity-50 text-center uppercase mb-1">Aggiungi</div>

                        <div className="flex gap-3 justify-center">
                            {/* Maschio */}
                            <button
                                onClick={() => { addNodeAtPos('M', contextMenu.gx, contextMenu.gy); setContextMenu(null); }}
                                className="flex flex-col items-center gap-1 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            >
                                <div className="w-10 h-10 rounded shadow-sm border theme-border bg-white dark:bg-gray-800 flex items-center justify-center">
                                    <Square size={20} className="text-black dark:text-white" />
                                </div>
                                <span className="text-xs font-bold">M</span>
                            </button>

                            {/* Femmina */}
                            <button
                                onClick={() => { addNodeAtPos('F', contextMenu.gx, contextMenu.gy); setContextMenu(null); }}
                                className="flex flex-col items-center gap-1 p-2 rounded hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full shadow-sm border theme-border bg-white dark:bg-gray-800 flex items-center justify-center">
                                    <Circle size={20} className="text-black dark:text-white" />
                                </div>
                                <span className="text-xs font-bold">F</span>
                            </button>

                            {/* --- NUOVO: STICKY NOTE --- */}
                            <button
                                onClick={() => { addStickyNoteAtCursor(contextMenu.gx, contextMenu.gy); setContextMenu(null); }}
                                className="flex flex-col items-center gap-1 p-2 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors"
                            >
                                <div className="w-10 h-10 rounded shadow-sm border theme-border bg-white dark:bg-gray-800 flex items-center justify-center">
                                    <StickyNote size={20} className="text-yellow-500" />
                                </div>
                                <span className="text-xs font-bold">Nota</span>
                            </button>
                        </div>

                        {/* Freccina decorativa sotto */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-3 h-3 bg-inherit border-b border-r theme-border rotate-45 transform"></div>

                        {/* Overlay trasparente per chiudere cliccando fuori */}
                        <div className="fixed inset-0 z-[-1]" onClick={() => setContextMenu(null)}></div>
                    </div>
                )}
            </div> {/* Chiusura Main Flex Container */}

        </div> /* Chiusura Root App Container */
    );
}
