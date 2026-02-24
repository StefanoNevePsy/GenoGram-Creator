import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
    Square, Circle, ZoomIn, ZoomOut, Save, Trash2, Grip, Sun, Moon,
    Activity, Users, Plus, Settings,
    LayoutGrid, Heart,
    Scan, MousePointer2, Edit3, Minus, X, Download, Waypoints, ChevronDown,
    AlignJustify, CircleDashed, Upload, FileText, Search, RotateCcw, RotateCw,
    Home, GraduationCap, BookOpen, User, Filter, SortAsc, Tag, Folder, Briefcase, HelpCircle,
    Target, Grid3X3, TrendingUp, Image as ImageIcon, FileImage, Calendar, Check, Info,
    Cloud, CloudOff, RefreshCw, CheckCircle2, Network, UserPlus, GitBranch, ArrowDownToLine, ArrowUpToLine, Type, StickyNote, Database, Maximize, Minimize // <--- Network aggiunto qui
} from 'lucide-react';
import { StatusBar } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, query, onSnapshot } from 'firebase/firestore';

// --- CONFIGURAZIONE AVANZATA ---

export type RelationshipConfig = {
    label: string;
    color: string;
    lineStyle: 'solid' | 'dashed' | 'dotted' | 'zigzag' | 'zigzag-thick';
    renderType:
    | 'standard' | 'double' | 'triple' | 'triple-zigzag' | 'arrow' | 'arrow-open' | 'arrow-thick'
    | 'arrow-x-center' | 'arrow-box-center' | 'arrow-diamond-center' | 'arrow-double-bar-center'
    | 'arrow-end' | 'arrow-open-end' | 'arrow-open-center'
    | 'cutoff' | 'cutoff-double' | 'cutoff-circle' | 'cutoff-repaired-circle'
    | 'fusion' | 'best-friend' | 'fusion-hostile' | 'double-zigzag' | 'triple-zigzag-center' | 'triple-zigzag-center-arrow'
    | 'zigzag-overlay' | 'twin-link' | 'twin-link-bar' | 'two-circles-center' | 'double-arrow-inward'
    | 'oblique' | 'oblique-double' | 'x-cross' | 'oblique-double-crossed'
    | 'triangle-up-center' | 'dashed-inner';
    decorator?: string;
};

const BASE_REL_CONFIG: Record<string, RelationshipConfig> = {
    // 1. STRUTTURALI (Coppia e Relazioni)
    'marriage': { label: 'Matrimonio', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'secret': { label: 'Relazione Segreta', color: '#000000', lineStyle: 'solid', renderType: 'triangle-up-center' },
    'cohabitation': { label: 'Convivenza', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'couple': { label: 'Relazione di Coppia', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'divorce-commit': { label: 'Divorzio Impegno Emot.', color: '#000000', lineStyle: 'solid', renderType: 'dashed-inner' },
    'separation': { label: 'Separazione', color: '#000000', lineStyle: 'solid', renderType: 'oblique' },
    'separation-repaired': { label: 'Separazione Riparata', color: '#000000', lineStyle: 'solid', renderType: 'x-cross' },
    'separation-cohab': { label: 'Separazione (Conv.)', color: '#000000', lineStyle: 'dashed', renderType: 'oblique' },
    'divorce': { label: 'Divorzio (2 Tagli)', color: '#000000', lineStyle: 'solid', renderType: 'oblique-double' },
    'divorce-repaired': { label: 'Divorzio Riparato', color: '#000000', lineStyle: 'solid', renderType: 'oblique-double-crossed' },
    're-marriage': { label: 'Risposati', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'affair': { label: 'Relazione Extra/Amante', color: '#FFD700', lineStyle: 'dotted', renderType: 'standard' },
    'one-night': { label: 'Avventura', color: '#FFD700', lineStyle: 'dotted', renderType: 'standard' },
    'engagement': { label: 'Fidanzamento', color: '#0000FF', lineStyle: 'dashed', renderType: 'standard' },

    // 2. FIGLI
    'child-bio': { label: 'Figlio Biologico', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'child-adopted': { label: 'Adozione', color: '#0000FF', lineStyle: 'dotted', renderType: 'standard' },
    'child-foster': { label: 'Affido', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'twin-dizygotic': { label: 'Gemelli Dizigoti', color: '#000000', lineStyle: 'solid', renderType: 'twin-link' },
    'twin-monozygotic': { label: 'Gemelli Monozigoti', color: '#000000', lineStyle: 'solid', renderType: 'twin-link-bar' },
    'pregnancy': { label: 'Gravidanza', color: '#000000', lineStyle: 'solid', renderType: 'standard' },

    // 3. AFFETTI E INTERAZIONI
    'correlated': { label: 'Correlato/Collegamento', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'harmony': { label: 'Armonia', color: '#008000', lineStyle: 'solid', renderType: 'standard' },
    'friendship': { label: 'Amicizia', color: '#008000', lineStyle: 'dashed', renderType: 'standard' },
    'best-friend': { label: 'Migliore Amico', color: '#008000', lineStyle: 'dotted', renderType: 'double' },
    'close': { label: 'Invischiamento/Molto Uniti', color: '#008000', lineStyle: 'solid', renderType: 'double' },
    'fusion': { label: 'Fusione', color: '#008000', lineStyle: 'solid', renderType: 'triple' },
    'in-love': { label: 'Innamorati', color: '#008000', lineStyle: 'solid', renderType: 'two-circles-center' },
    'fan': { label: 'Ammiratore', color: '#008000', lineStyle: 'dashed', renderType: 'arrow' },
    'spiritual': { label: 'Conn. Spirituale', color: '#800080', lineStyle: 'dashed', renderType: 'standard' },

    // 4. CONFLITTO E DISTANZA
    'distance': { label: 'Distanza', color: '#808080', lineStyle: 'dashed', renderType: 'standard' },
    'poor': { label: 'Povera', color: '#808080', lineStyle: 'dotted', renderType: 'standard' },
    'hostile': { label: 'Ostile', color: '#FF0000', lineStyle: 'zigzag', renderType: 'standard' },
    'close-hostile': { label: 'Vicini-Ostile', color: '#FF0000', lineStyle: 'solid', renderType: 'triple-zigzag-center' },
    'fusion-hostile': { label: 'Fusione & Conflitto', color: '#000000', lineStyle: 'solid', renderType: 'fusion-hostile' },
    'hate': { label: 'Odio', color: '#FF0000', lineStyle: 'solid', renderType: 'triple-zigzag' },
    'cutoff': { label: 'Rottura/Taglio (//)', color: '#FF0000', lineStyle: 'solid', renderType: 'cutoff' },
    'restored': { label: 'Relazione Ristabilita', color: '#008000', lineStyle: 'solid', renderType: 'cutoff-repaired-circle' },

    // 5. VIOLENZA, ABUSO E POTERE
    'violence-psychological': { label: 'Violenza Psicologica', color: '#FF0000', lineStyle: 'zigzag', renderType: 'arrow-open-end' },
    'violence-physical': { label: 'Violenza Fisica', color: '#FF0000', lineStyle: 'zigzag-thick', renderType: 'arrow-open-end' },
    'violence-sexual': { label: 'Violenza Sessuale', color: '#FF0080', lineStyle: 'solid', renderType: 'triple-zigzag-center-arrow' },
    'abuse-physical': { label: 'Abuso Fisico', color: '#800000', lineStyle: 'solid', renderType: 'arrow-thick' },
    'abuse-emotional': { label: 'Abuso Emotivo', color: '#800000', lineStyle: 'dashed', renderType: 'arrow' },
    'abuse-sexual': { label: 'Abuso Sessuale', color: '#FF0080', lineStyle: 'solid', renderType: 'arrow-double-bar-center' },
    'focused': { label: 'Focalizzato sul', color: '#0000FF', lineStyle: 'solid', renderType: 'arrow-end' },
    'focused-negative': { label: 'Focalizzato Negativamente', color: '#FF0000', lineStyle: 'zigzag', renderType: 'arrow-end' },
    'companions': { label: 'Accompagnatori', color: '#000000', lineStyle: 'solid', renderType: 'arrow-open-end' },
    'manipulative': { label: 'Manipolativo', color: '#FF0000', lineStyle: 'solid', renderType: 'arrow-x-center' },
    'controlling': { label: 'Controllante', color: '#800080', lineStyle: 'solid', renderType: 'arrow-box-center' },
    'keeper': { label: 'Custode/Caregiver', color: '#008080', lineStyle: 'solid', renderType: 'arrow-diamond-center' },
    'neglect': { label: 'Trascuratezza', color: '#808080', lineStyle: 'dashed', renderType: 'double-arrow-inward' },

    'custom': { label: 'Personalizzata', color: '#000000', lineStyle: 'solid', renderType: 'standard' }
};

const RELATION_CATEGORIES: Record<string, string[]> = {
    "Struttura / Coppia": [
        'marriage', 'secret', 'cohabitation', 'couple', 'divorce-commit',
        'separation', 'separation-repaired', 'separation-cohab',
        'divorce', 'divorce-repaired', 're-marriage',
        'engagement', 'affair', 'one-night'
    ],
    "Figli": ['child-bio', 'child-adopted', 'child-foster', 'twin-dizygotic', 'twin-monozygotic', 'pregnancy'],
    "Interazione / Affettive": ['correlated', 'harmony', 'friendship', 'best-friend', 'close', 'fusion', 'in-love', 'fan', 'spiritual'],
    "Conflitto e Distanza": ['distance', 'poor', 'hostile', 'close-hostile', 'fusion-hostile', 'hate', 'cutoff', 'restored'],
    "Violenza, Abuso e Potere": [
        'violence-psychological', 'violence-physical', 'violence-sexual',
        'abuse-physical', 'abuse-emotional', 'abuse-sexual', 'neglect',
        'focused', 'focused-negative', 'companions', 'manipulative', 'controlling', 'keeper'
    ],
    "Altro": ['custom']
};

// --- CATEGORIE DI GENOGRAMMI ---
interface CategoryDef { id: string; label: string; color: string; iconKey: string; }

const ICON_MAP: Record<string, any> = {
    'home': Home, 'heart': Heart, 'user': User, 'users': Users, 'grad': GraduationCap, 'book': BookOpen,
    'briefcase': Briefcase, 'folder': Folder, 'help': HelpCircle, 'tag': Tag
};

const DEFAULT_CATEGORIES: CategoryDef[] = [
    { id: 'family', label: 'Famiglie', color: '#3b82f6', iconKey: 'home' },
    { id: 'couple', label: 'Coppie', color: '#ec4899', iconKey: 'heart' },
    { id: 'individual', label: 'Individuali', color: '#10b981', iconKey: 'user' },
    { id: 'school', label: 'Scolastico', color: '#f59e0b', iconKey: 'grad' },
    { id: 'exercise', label: 'Esercitazioni', color: '#6366f1', iconKey: 'book' },
    { id: 'work', label: 'Lavoro/Org', color: '#64748b', iconKey: 'briefcase' },
    { id: 'other', label: 'Altro', color: '#94a3b8', iconKey: 'folder' }
];

// --- GESTIONE TEMI DEFINITIVA ---
export type AppTheme = {
    id: string;
    label: string;
    type: 'light' | 'dark';
    colors: {
        bgMain: string;      // Sfondo Canvas
        bgPanel: string;     // Sfondo Pannelli (Sidebar, Header, Modal)
        border: string;      // Colore Bordi
        text: string;        // Testo Principale
        textMuted: string;   // Testo Secondario
        accent: string;      // Colore Accento (Blu, Viola, ecc)
    }
};

// --- DEFINIZIONE PALETTE GLOBALI ---
// Inserisci questo blocco PRIMA di NOTE_BG_PALETTES

const PASTEL_PALETTE = ['#bfdbfe', '#bbf7d0', '#fbcfe8', '#fde68a', '#ddd6fe', '#fed7aa', '#e2e8f0'];
const VIVID_PALETTE = ['#3b82f6', '#22c55e', '#ec4899', '#f59e0b', '#8b5cf6', '#f97316', '#64748b'];
const NEUTRAL_PALETTE = ['#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#4b5563', '#1f2937', '#000000'];
const EARTH_PALETTE = ['#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#fcd34d', '#fffbeb'];
const MONOCHROME_PALETTE = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#1e293b'];

// --- COSTANTI PER LE NOTE ---

// Raggruppo le palette esistenti (Ora le variabili sopra esistono!)
const NOTE_BG_PALETTES = {
    'Classico': ['#fef3c7', '#d1fae5', '#dbeafe', '#fce7f3', '#f3f4f6', '#ffedd5', '#e0e7ff'],
    'Pastello': PASTEL_PALETTE,
    'Vivido': VIVID_PALETTE,
    'Terra': EARTH_PALETTE,
    'Monocromo': MONOCHROME_PALETTE
};

const NOTE_TEXT_COLORS = [
    '#1f2937', // Default Gray 800
    '#000000', // Black
    '#ffffff', // White
    '#dc2626', // Red
    '#2563eb', // Blue
    '#16a34a', // Green
    '#d97706', // Amber
    '#57534e', // Warm Gray
];

const NOTE_FONTS = [
    { label: 'App Default', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }, // Font standard dell'app
    { label: 'Handwriting', value: '"Comic Sans MS", "Chalkboard SE", sans-serif' },
    { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
    { label: 'Serif', value: 'ui-serif, Georgia, serif' },
    { label: 'Monospace', value: 'ui-monospace, monospace' },
];
// ----------------------------------------------------------
const PRESET_THEMES: AppTheme[] = [
    // LIGHT THEMES
    {
        id: 'light', label: 'Light (Default)', type: 'light',
        colors: { bgMain: '#f9fafb', bgPanel: '#ffffff', border: '#e5e7eb', text: '#111827', textMuted: '#6b7280', accent: '#2563eb' }
    },
    {
        id: 'sepia', label: 'Vintage Sepia', type: 'light',
        colors: { bgMain: '#fdf6e3', bgPanel: '#eee8d5', border: '#d2b48c', text: '#433422', textMuted: '#93a1a1', accent: '#b58900' }
    },
    {
        id: 'nordic', label: 'Nordic Snow', type: 'light',
        colors: { bgMain: '#eceff4', bgPanel: '#e5e9f0', border: '#d8dee9', text: '#2e3440', textMuted: '#4c566a', accent: '#5e81ac' }
    },
    // DARK THEMES
    {
        id: 'dark', label: 'Dark (Classic)', type: 'dark',
        colors: { bgMain: '#111827', bgPanel: '#1f2937', border: '#374151', text: '#f9fafb', textMuted: '#9ca3af', accent: '#3b82f6' }
    },
    {
        id: 'onedark', label: 'One Dark Pro', type: 'dark',
        colors: { bgMain: '#282c34', bgPanel: '#21252b', border: '#3e4451', text: '#abb2bf', textMuted: '#5c6370', accent: '#61afef' }
    },
    {
        id: 'dracula', label: 'Dracula', type: 'dark',
        colors: { bgMain: '#282a36', bgPanel: '#44475a', border: '#6272a4', text: '#f8f8f2', textMuted: '#bd93f9', accent: '#ff79c6' }
    },
    {
        id: 'nightowl', label: 'Night Owl', type: 'dark',
        colors: { bgMain: '#011627', bgPanel: '#0b2942', border: '#5f7e97', text: '#d6deeb', textMuted: '#7e57c2', accent: '#82aaff' }
    },
    {
        id: 'forest', label: 'Forest Night', type: 'dark',
        colors: { bgMain: '#0d1117', bgPanel: '#161b22', border: '#30363d', text: '#c9d1d9', textMuted: '#8b949e', accent: '#238636' }
    }
];


const GRID_SIZE = 20;
const SNAP_SIZE = 40; // Snap increment: matches NODE_WIDTH for easy alignment
const CANVAS_SIZE = 8000;
const CENTER_POS = CANVAS_SIZE / 2;

const NODE_WIDTH = 40;
const NODE_HEIGHT = 40;
const NODE_RADIUS = 20;
const MARRIAGE_DROP_Y = 40;
const MARRIAGE_BAR_Y = NODE_RADIUS + MARRIAGE_DROP_Y;
const GROUP_PADDING = 40;
const GROUP_RADIUS = 10;

type Gender = 'M' | 'F' | 'Pet' | 'Unknown' | 'Pregnancy' | 'Miscarriage' | 'Abortion' | 'Stillbirth' | 'TransWoman' | 'TransMan' | 'NonBinary';

interface NoteItem { id: string; text: string; date: string; }
interface GenNode {
    id: string; x: number; y: number; gender: Gender; name: string; label?: string;
    birthDate: string; deceased: boolean; indexPerson: boolean;
    substanceAbuse: boolean; mentalIssue: boolean; physicalIssue: boolean; recovery: boolean;
    gayLesbian: boolean;
    showAge?: boolean;
    notes: NoteItem[];
}
interface RelationEdge { id: string; fromId: string; toId: string; type: string; color?: string; lineStyle?: string; decorator?: string; label: string; notes: NoteItem[]; fromAnchor?: number; toAnchor?: number; }
interface NodeGroup { id: string; memberIds: string[]; type: 'household' | 'subsystem'; label: string; color: string; notes: NoteItem[]; labelPos?: { x: number, y: number }; customPadding?: number; showLabel?: boolean; }
interface CustomPreset { id: string; name: string; type: 'relationship'; config: { color: string; lineStyle: string; renderType: string; decorator: string; } }
interface GenogramMeta { id: string; title: string; category: string; lastModified: number; data: { nodes: GenNode[]; edges: RelationEdge[]; groups: NodeGroup[]; presets?: CustomPreset[]; stickyNotes?: any[]; } }
// --- AGGIUNGI SOTTO GLI ALTRI INTERFACE ---
// Modifica l'interfaccia esistente
interface StickyNoteData {
    id: string;
    x: number;
    y: number;
    text: string;
    width: number;
    height: number;
    color: string;
    fontFamily: string;
    // NUOVE PROPRIETÀ
    opacity: number;    // 0.1 a 1.0
    textColor: string;
    variant?: 'classic' | 'label';
}

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const parseDate = (str: string): Date | null => {
    if (!str) return null;
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
        const d = parseInt(parts[0]); const m = parseInt(parts[1]) - 1; const y = parseInt(parts[2]);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) { const fullYear = y < 100 ? (y > 30 ? 1900 + y : 2000 + y) : y; return new Date(fullYear, m, d); }
    }
    if (/^\d{4}$/.test(str)) return new Date(parseInt(str), 0, 1);

    // Supporto per input "Età" (es. 35, 45, 12)
    if (/^\d{1,3}$/.test(str)) {
        const val = parseInt(str);
        if (val <= 150) {
            return new Date(new Date().getFullYear() - val, 0, 1);
        }
    }
    return null;
}
const calculateAge = (birthDateStr: string): string => {
    if (!birthDateStr) return '?';

    // Se è stata inserita direttamente un'età a due cifre o tre cifre
    const str = birthDateStr.trim();
    if (/^\d{1,3}$/.test(str)) {
        const val = parseInt(str);
        if (val <= 150) return str;
    }

    const birth = parseDate(birthDateStr);
    if (!birth) return '?';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age.toString();
};
const findMarriageEdge = (nodeId: string, edges: RelationEdge[]) => edges.find(e => (e.fromId === nodeId || e.toId === nodeId) && ['marriage', 'cohabitation', 'separation', 'divorce', 'affair', 're-marriage'].includes(e.type));
const getMarriageBarY = (startY: number, endY: number) => Math.max(startY, endY) + MARRIAGE_DROP_Y;

const getGroupBounds = (group: NodeGroup, nodes: GenNode[]) => {
    const mems = nodes.filter(n => group.memberIds.includes(n.id));
    if (!mems.length) return null;
    const minX = Math.min(...mems.map(n => n.x));
    const maxX = Math.max(...mems.map(n => n.x + NODE_WIDTH));
    const minY = Math.min(...mems.map(n => n.y));
    const maxY = Math.max(...mems.map(n => n.y + NODE_HEIGHT));
    return { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING, w: (maxX - minX) + (GROUP_PADDING * 2), h: (maxY - minY) + (GROUP_PADDING * 2), cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};

const getEntityCenter = (id: string, nodes: GenNode[], groups: NodeGroup[]): { x: number, y: number } | null => {
    const node = nodes.find(n => n.id === id);
    if (node) return { x: node.x + NODE_RADIUS, y: node.y + NODE_RADIUS };
    const group = groups.find(g => g.id === id);
    if (group) { const bounds = getGroupBounds(group, nodes); if (bounds) return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }; }
    return null;
};

const getRectIntersection = (bounds: { x: number, y: number, w: number, h: number }, start: { x: number, y: number }) => {
    const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
    const dx = start.x - cx; const dy = start.y - cy;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return { x: cx, y: cy };
    const scaleX = (bounds.w / 2) / Math.abs(dx); const scaleY = (bounds.h / 2) / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);
    return { x: cx + dx * scale, y: cy + dy * scale };
};

// --- MATH HELPERS AGGIORNATI (Blob organici) ---

const cross = (a: { x: number, y: number }, b: { x: number, y: number }, o: { x: number, y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const getConvexHull = (points: { x: number, y: number }[]) => {
    points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const lower = [];
    for (let i = 0; i < points.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
        lower.push(points[i]);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) upper.pop();
        upper.push(points[i]);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

// --- MATH: INTERSEZIONE LINEA-POLIGONO ---
const getLineIntersection = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }, p4: { x: number, y: number }) => {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { x: p1.x + t * (p1.x - p2.x), y: p1.y + t * (p1.y - p2.y) };
    }
    return null;
};

const getPolygonIntersection = (polyPoints: { x: number, y: number }[], lineStart: { x: number, y: number }, lineEnd: { x: number, y: number }) => {
    let bestHit: { x: number, y: number } | null = null;
    let minDistance = Infinity;

    // 1. Prova intersezioni sui segmenti
    for (let i = 0; i < polyPoints.length; i++) {
        const p1 = polyPoints[i];
        const p2 = polyPoints[(i + 1) % polyPoints.length];
        const hit = getLineIntersection(p1, p2, lineStart, lineEnd);

        if (hit) {
            // Se troviamo più intersezioni, prendiamo quella più vicina al punto di partenza
            // (o quella più vicina al target, dipende dalla direzione. Qui cerchiamo l'uscita dal gruppo)
            const dist = Math.hypot(hit.x - lineEnd.x, hit.y - lineEnd.y);
            if (dist < minDistance) {
                minDistance = dist;
                bestHit = hit;
            }
        }
    }

    // 2. Fallback: Se la linea non interseca (es. centri interni complessi), 
    // prendiamo il punto del perimetro più vicino al target.
    if (!bestHit) {
        let minV = Infinity;
        polyPoints.forEach(p => {
            const d = Math.hypot(p.x - lineEnd.x, p.y - lineEnd.y);
            if (d < minV) {
                minV = d;
                bestHit = p;
            }
        });
    }

    return bestHit || lineEnd;
};

// Aggiornata per restituire anche i Control Points (necessari per il calcolo Bezier preciso)
const getOrganicBlobPath = (points: { x: number, y: number }[], padding: number) => {
    if (points.length < 3) return { d: "", cx: 0, cy: 0, expandedPoints: [], controlPoints: [] };

    const cx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const cy = points.reduce((acc, p) => acc + p.y, 0) / points.length;

    // 1. Control Points (Gli spigoli esterni del poligono)
    const controlPoints = points.map(p => {
        const angle = Math.atan2(p.y - cy, p.x - cx);
        const dist = Math.hypot(p.x - cx, p.y - cy);
        return {
            x: cx + Math.cos(angle) * (dist + padding),
            y: cy + Math.sin(angle) * (dist + padding)
        };
    });

    // 2. Mid Points (Dove passa la curva)
    const len = controlPoints.length;
    const midPoints = controlPoints.map((p, i) => {
        const next = controlPoints[(i + 1) % len];
        return { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
    });

    let d = `M ${midPoints[0].x} ${midPoints[0].y}`;
    for (let i = 0; i < len; i++) {
        const p = controlPoints[(i + 1) % len]; // Punto di controllo (Vertex)
        const nextMid = midPoints[(i + 1) % len]; // Punto finale segmento
        d += ` Q ${p.x} ${p.y} ${nextMid.x} ${nextMid.y}`;
    }
    d += " Z";

    // Restituiamo expandedPoints (midPoints) per collisioni auto, e controlPoints per Bezier manuale
    return { d, cx, cy, expandedPoints: midPoints, controlPoints };
};

// --- MATH: PROIEZIONE PUNTO SU POLIGONO (Per Linee Verdi) ---
const getClosestPointOnPolygon = (polyPoints: { x: number, y: number }[], target: { x: number, y: number }) => {
    let minDist = Infinity;
    let closest = target;

    for (let i = 0; i < polyPoints.length; i++) {
        const p1 = polyPoints[i];
        const p2 = polyPoints[(i + 1) % polyPoints.length];

        // Calcola punto più vicino sul segmento p1-p2
        const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
        if (l2 === 0) continue;
        let t = ((target.x - p1.x) * (p2.x - p1.x) + (target.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = p1.x + t * (p2.x - p1.x);
        const projY = p1.y + t * (p2.y - p1.y);

        const d = (target.x - projX) ** 2 + (target.y - projY) ** 2;
        if (d < minDist) {
            minDist = d;
            closest = { x: projX, y: projY };
        }
    }
    return closest;
};

// --- MATH: PUNTO ESATTO SU CURVA BEZIER (Per Slider preciso) ---
const getPointOnOrganicPerimeter = (controlPoints: { x: number, y: number }[], t: number) => {
    // t va da 0.0 a 1.0
    const len = controlPoints.length;
    if (len < 3) return controlPoints[0];

    // Normalizziamo t per trovare su quale segmento siamo
    // Il perimetro è composto da 'len' segmenti curvi
    const totalSegments = len;
    const exactIndex = t * totalSegments;
    const segmentIndex = Math.floor(exactIndex) % len;
    const localT = exactIndex - Math.floor(exactIndex); // t locale (0-1) dentro il singolo segmento curvo

    // Parametri della curva Quadratica Bezier per questo segmento
    // Start: Midpoint tra corrente e precedente (o meglio, come definito nel path SVG)
    // Nel loop SVG: Start = MidPoint[i], Control = ControlPoint[i+1], End = MidPoint[i+1]

    const currControl = controlPoints[(segmentIndex + 1) % len];
    const prevControl = controlPoints[segmentIndex];
    const nextControl = controlPoints[(segmentIndex + 2) % len];

    // Calcoliamo i punti medi (Start ed End della curva Q)
    const start = { x: (prevControl.x + currControl.x) / 2, y: (prevControl.y + currControl.y) / 2 };
    const end = { x: (currControl.x + nextControl.x) / 2, y: (currControl.y + nextControl.y) / 2 };
    const control = currControl;

    // Formula Quadratica Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    const mt = 1 - localT;
    const x = (mt * mt * start.x) + (2 * mt * localT * control.x) + (localT * localT * end.x);
    const y = (mt * mt * start.y) + (2 * mt * localT * control.y) + (localT * localT * end.y);

    return { x, y };
};

// --- GEOMETRIA CONDIVISA (FIX DEFINITIVO: NOMI SOPRA, ETA SOTTO) ---
// --- GEOMETRIA CONDIVISA (FIX: Padding +3px e Etichette) ---
const getGroupGeometry = (g: NodeGroup, nodes: GenNode[]) => {
    const mems = nodes.filter(n => g.memberIds.includes(n.id));
    if (mems.length === 0) return null;

    let points: { x: number, y: number }[] = [];
    mems.forEach(n => {
        const nameWidth = Math.max(80, n.name.length * 8);
        const halfW = nameWidth / 2;
        const cx = n.x + NODE_WIDTH / 2;

        // Punti Sopra
        const topY = n.y - 25;
        points.push({ x: cx - halfW, y: topY });
        points.push({ x: cx + halfW, y: topY });

        // Punti Sotto
        const bottomY = n.y + NODE_HEIGHT + 10;
        points.push({ x: cx - halfW, y: bottomY });
        points.push({ x: cx + halfW, y: bottomY });

        // Punti Laterali
        points.push({ x: n.x - 5, y: n.y + NODE_HEIGHT / 2 });
        points.push({ x: n.x + NODE_WIDTH + 5, y: n.y + NODE_HEIGHT / 2 });
    });

    const hullPoints = getConvexHull(points);
    // Padding aumentato leggermente come richiesto (era 20, ora 23)
    const padding = g.customPadding || 23;

    return getOrganicBlobPath(hullPoints, padding);
};

const getZigZagPath = (x1: number, y1: number, x2: number, y2: number, amplitude = 4, frequency = 12) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return `M ${x1} ${y1}`;

    const ux = dx / len; const uy = dy / len;
    const px = -uy; const py = ux;

    const steps = Math.max(1, Math.round(len / frequency));
    const stepLen = len / steps;

    let path = `M ${x1} ${y1}`;
    for (let i = 1; i < steps; i++) {
        const d = i * stepLen;
        const cx = x1 + ux * d;
        const cy = y1 + uy * d;
        const offset = (i % 2 !== 0) ? amplitude : -amplitude;
        path += ` L ${cx + px * offset} ${cy + py * offset}`;
    }
    path += ` L ${x2} ${y2}`;
    return path;
};

// Parser per estrarre l'anno da testo libero
const extractYear = (text: string): number => {
    if (!text) return 0;
    const match = text.match(/\d{4}/);
    if (match) return parseInt(match[0]);
    return 0;
};

// --- COMPONENTS ---

const Legend = ({ x, y, darkMode, nodes, edges }: { x: number, y: number, darkMode: boolean, nodes: GenNode[], edges: RelationEdge[] }) => {
    const bg = darkMode ? '#1f2937' : '#ffffff';
    const text = darkMode ? '#f3f4f6' : '#1f2937';
    const border = darkMode ? '#374151' : '#e5e7eb';
    const subText = darkMode ? '#9ca3af' : '#6b7280';

    // 1. Calcola elementi unici
    const usedGenders = Array.from(new Set(nodes.map(n => n.gender))).sort();
    const hasDeceased = nodes.some(n => n.deceased);
    const hasIndex = nodes.some(n => n.indexPerson);
    const usedRelTypes = Array.from(new Set(edges.map(e => e.type))).sort();

    // 2. Layout Costanti
    const PADDING = 15;
    const ITEM_H = 24;
    const COL_WIDTH = 140; // Colonna più larga per leggibilità
    const TITLE_H = 30;

    // Calcola altezza necessaria
    const peopleCount = usedGenders.length + (hasDeceased ? 1 : 0) + (hasIndex ? 1 : 0);
    const relCount = usedRelTypes.length;

    // Logica layout: se tante relazioni, usa 2 colonne (Persone | Relazioni)
    // Se poche relazioni, usa una colonna unica verticale
    const useTwoCols = (peopleCount + relCount) > 8;
    const width = useTwoCols ? (COL_WIDTH * 2) + (PADDING * 3) : COL_WIDTH + (PADDING * 2);
    const height = TITLE_H + PADDING + (Math.max(peopleCount, useTwoCols ? relCount : peopleCount + relCount) * ITEM_H) + (useTwoCols ? 0 : 20);

    const renderGenderIcon = (g: string) => {
        const s = text; const f = 'none'; const w = 1.5;
        if (g === 'M') return <rect x="2" y="2" width="12" height="12" stroke={s} fill={f} strokeWidth={w} />;
        if (g === 'F') return <circle cx="8" cy="8" r="6" stroke={s} fill={f} strokeWidth={w} />;
        if (g === 'Pet') return <path d="M8 2 L14 8 L8 14 L2 8 Z" stroke={s} fill={f} strokeWidth={w} />;
        if (g === 'Pregnancy') return <path d="M8 2 L14 14 L2 14 Z" stroke={s} fill={f} strokeWidth={w} />;
        return <text x="8" y="12" textAnchor="middle" fontSize="10" fill={s} fontFamily="sans-serif">?</text>;
    };

    const renderRelLine = (type: string) => {
        return <LinePreview type={type} width={30} darkMode={darkMode} transparent={true} />;
    };

    return (
        <g transform={`translate(${x}, ${y})`}>
            {/* Box Sfondo */}
            <rect width={width} height={height} rx="8" fill={bg} stroke={border} strokeWidth="1" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))" />

            {/* Header */}
            <text x={PADDING} y={22} fontWeight="bold" fill={text} fontSize="12" letterSpacing="0.5px" fontFamily="sans-serif">LEGENDA</text>
            <line x1={PADDING} y1={TITLE_H} x2={width - PADDING} y2={TITLE_H} stroke={border} strokeWidth="1" />

            {/* Contenuto */}
            <g transform={`translate(${PADDING}, ${TITLE_H + 15})`}>
                {/* Colonna Persone */}
                <g>
                    {peopleCount > 0 && <text x="0" y="-5" fontSize="9" fontWeight="bold" fill={subText} style={{ textTransform: 'uppercase' }} fontFamily="sans-serif">Persone</text>}
                    {usedGenders.map((g, i) => (
                        <g key={g} transform={`translate(0, ${i * ITEM_H})`}>
                            {renderGenderIcon(g)}
                            <text x="25" y="11" fill={text} fontSize="11" fontFamily="sans-serif">{g === 'M' ? 'Maschio' : g === 'F' ? 'Femmina' : g}</text>
                        </g>
                    ))}
                    {/* Index & Deceased sotto i generi */}
                    {hasDeceased && (
                        <g transform={`translate(0, ${usedGenders.length * ITEM_H})`}>
                            <rect x="2" y="2" width="12" height="12" stroke={text} fill="none" />
                            <line x1="2" y1="2" x2="14" y2="14" stroke={text} /><line x1="14" y1="2" x2="2" y2="14" stroke={text} />
                            <text x="25" y="11" fill={text} fontSize="11" fontFamily="sans-serif">Deceduto</text>
                        </g>
                    )}
                    {hasIndex && (
                        <g transform={`translate(0, ${(usedGenders.length + (hasDeceased ? 1 : 0)) * ITEM_H})`}>
                            <rect x="2" y="2" width="12" height="12" stroke={text} fill="none" />
                            <rect x="4" y="4" width="8" height="8" stroke={text} fill="none" />
                            <text x="25" y="11" fill={text} fontSize="11" fontFamily="sans-serif">Paz. Designato</text>
                        </g>
                    )}
                </g>

                {/* Colonna Relazioni (spostata a destra se useTwoCols) */}
                {usedRelTypes.length > 0 && (
                    <g transform={`translate(${useTwoCols ? COL_WIDTH + PADDING : 0}, ${useTwoCols ? 0 : (peopleCount * ITEM_H) + 15})`}>
                        <text x="0" y="-5" fontSize="9" fontWeight="bold" fill={subText} style={{ textTransform: 'uppercase' }} fontFamily="sans-serif">Relazioni</text>
                        {usedRelTypes.map((t, i) => {
                            const label = BASE_REL_CONFIG[t]?.label || 'Custom';
                            return (
                                <g key={t} transform={`translate(0, ${i * ITEM_H})`}>
                                    {renderRelLine(t)}
                                    <text x="35" y="11" fill={text} fontSize="11" fontFamily="sans-serif">{label}</text>
                                </g>
                            );
                        })}
                    </g>
                )}
            </g>
        </g>
    );
};

const LinePreview = ({ type, width = 50, darkMode = false, transparent = false }: { type: string, width?: number, darkMode?: boolean, transparent?: boolean }) => {
    const config = BASE_REL_CONFIG[type] || BASE_REL_CONFIG['custom'];
    if (!config) return null;

    let color = config.color;
    if (color === '#000000' && darkMode) color = '#ffffff';
    if (config.renderType.includes('hostile') || config.renderType.includes('triple-zigzag') || config.lineStyle === 'zigzag-thick') color = '#ef4444';

    let actualEndX = width;
    const midX = width / 2;
    const midY = 7;

    const hasEndArrow = (config.renderType.includes('arrow') && !config.renderType.includes('center') && config.renderType !== 'double-arrow-inward') || config.renderType === 'triple-zigzag-center-arrow';
    let arrowOffset = 6;
    if (config.renderType === 'arrow-thick') arrowOffset = 8;
    if (hasEndArrow) actualEndX -= arrowOffset;

    let pathD = `M 0 ${midY} L ${actualEndX} ${midY}`;
    let strokeW = "2";
    if (config.lineStyle.startsWith('zigzag')) {
        let amp = width > 30 ? 3 : 2; let freq = width > 30 ? 8 : 6;
        if (config.lineStyle === 'zigzag-thick') { amp = width > 30 ? 4 : 3; freq = width > 30 ? 6 : 4; }
        pathD = getZigZagPath(0, midY, actualEndX, midY, amp, freq);
        strokeW = "1.5";
    }
    const strokeDash = config.lineStyle === 'dashed' ? '6,3' : (config.lineStyle === 'dotted' ? '2,2' : '');

    const decX = midX;
    const decY = midY;
    const stroke = color;
    const arrowTrans = `translate(${actualEndX}, ${midY})`;
    const centerArrowTrans = `translate(${midX}, ${midY})`;

    const Decorator = () => {
        if (config.renderType === 'fusion' || config.renderType === 'triple') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /></g>;
        if (config.renderType === 'fusion-hostile') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /><path d={getZigZagPath(0, midY, actualEndX, midY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (config.renderType === 'triple-zigzag') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /><path d={getZigZagPath(0, midY, actualEndX, midY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (config.renderType === 'double' || config.renderType === 'double-zigzag' || config.renderType === 'best-friend') return <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" strokeDasharray={strokeDash} />;

        if (config.renderType === 'oblique') return <line x1={decX + 3} y1={decY - 6} x2={decX - 3} y2={decY + 6} stroke={stroke} strokeWidth={2} />;
        if (config.renderType === 'oblique-double') return <g><line x1={decX + 1} y1={decY - 6} x2={decX - 5} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX + 5} y1={decY - 6} x2={decX - 1} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'x-cross') return <g><line x1={decX + 4} y1={decY - 6} x2={decX - 4} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX - 4} y1={decY - 6} x2={decX + 4} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'oblique-double-crossed') return <g><line x1={decX - 1} y1={decY - 6} x2={decX - 7} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX + 7} y1={decY - 6} x2={decX + 1} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX - 7} y1={decY - 6} x2={decX + 7} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;

        if (config.renderType === 'cutoff-double') return <g><line x1={decX - 3} y1={decY - 6} x2={decX - 3} y2={decY + 6} stroke={stroke} strokeWidth={2} /><line x1={decX + 3} y1={decY - 6} x2={decX + 3} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'cutoff') return <line x1={decX} y1={decY - 6} x2={decX} y2={decY + 6} stroke={stroke} strokeWidth={3} />;

        if (config.renderType === 'cutoff-repaired-circle') return <g><line x1={decX - 3} y1={decY - 6} x2={decX - 9} y2={decY + 6} stroke={stroke} strokeWidth={2} /><circle cx={decX} cy={decY} r={4} fill="none" stroke={stroke} strokeWidth={1.5} /><line x1={decX + 9} y1={decY - 6} x2={decX + 3} y2={decY + 6} stroke={stroke} strokeWidth={2} /></g>;
        if (config.renderType === 'dashed-inner') return <g><path d={pathD} stroke={stroke} strokeWidth={1.5} strokeDasharray="3,3" fill="none" transform={`translate(0, 4)`} /></g>;

        if (config.renderType === 'triple-zigzag-center-arrow') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, 3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(0, -3)" fill="none" /><path d={getZigZagPath(0, midY, actualEndX, midY, 3, 8)} stroke="red" strokeWidth={1.5} fill="none" /><polygon points="-5,-4 5,0 -5,4" fill="red" transform={arrowTrans} /></g>;

        if (config.renderType === 'triangle-up-center') return <polygon points="-5,0 5,0 0,-8" fill={stroke} transform={centerArrowTrans} />;

        if (config.renderType === 'arrow-thick') return <polygon points="-6,-6 4,0 -6,6" fill={stroke} transform={arrowTrans} />;
        if (config.renderType === 'double-arrow-inward') {
            const x1 = actualEndX * 0.3; const x2 = actualEndX * 0.7;
            return <g>
                <polygon points="4,-4 -4,0 4,4" fill={stroke} transform={`translate(${x1}, ${midY})`} />
                <polygon points="-4,-4 4,0 -4,4" fill={stroke} transform={`translate(${x2}, ${midY})`} />
            </g>;
        }
        if (config.renderType.includes('arrow') && !config.renderType.includes('center')) return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /></g>;

        if (config.renderType === 'arrow-x-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-4" y1="-4" x2="4" y2="4" stroke={stroke} strokeWidth={2} /><line x1="-4" y1="4" x2="4" y2="-4" stroke={stroke} strokeWidth={2} /></g></g>;
        if (config.renderType === 'arrow-box-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><rect x="-4" y="-4" width="8" height="8" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (config.renderType === 'arrow-diamond-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><polygon points="0,-4 4,0 0,4 -4,0" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (config.renderType === 'arrow-double-bar-center') return <g><polygon points="-5,-4 5,0 -5,4" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-2" y1="-6" x2="-2" y2="6" stroke={stroke} strokeWidth={2} /><line x1="2" y1="-6" x2="2" y2="6" stroke={stroke} strokeWidth={2} /></g></g>;

        return null;
    };

    const containerStyles = transparent ? "shrink-0 mr-2 overflow-visible" : "shrink-0 mr-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-100 dark:border-gray-600 overflow-visible";

    return (
        <svg width={width} height="14" className={containerStyles}>
            {config.type !== 'best-friend' && (
                <path d={pathD} stroke={stroke} strokeWidth={strokeW} strokeDasharray={strokeDash} fill="none" />
            )}
            <Decorator />
        </svg>
    );
};


// ... RelationshipSelector (kept identical) ...
const RelationshipSelector = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedConfig = BASE_REL_CONFIG[value] || BASE_REL_CONFIG['custom'] || { label: value, color: '#000', lineStyle: 'solid', renderType: 'standard' };
    return (
        <div className={`relative ${className}`}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-2 border rounded bg-white text-gray-900 dark:text-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <div className="flex items-center overflow-hidden"><LinePreview type={value} /><span className="truncate">{selectedConfig.label}</span></div><ChevronDown size={14} className="opacity-50 shrink-0 ml-1" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow-xl max-h-60 overflow-y-auto z-50 text-gray-900 dark:text-gray-100 text-left">
                    {Object.entries(RELATION_CATEGORIES).map(([category, keys]) => (
                        <div key={category}>
                            <div className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-[9px] font-bold uppercase text-gray-500 sticky top-0 border-b border-gray-200 dark:border-gray-700">{category}</div>
                            {keys.map((key: string) => {
                                const conf = BASE_REL_CONFIG[key];
                                if (!conf) return null;
                                return (
                                    <button key={key} onClick={() => { onChange(key); setIsOpen(false); }} className={`w-full flex items-center p-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 text-left border-b border-gray-50 dark:border-gray-700 ${value === key ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <LinePreview type={key} /><span>{conf.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <div className="p-1 sticky bottom-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
                        <button onClick={() => setIsOpen(false)} className="w-full py-1 text-center text-gray-400 hover:text-red-500 text-[10px]">Chiudi</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ... ConnectionLine, NodeShape, QuickRelMenu (Standard components) ...
const ConnectionLine = ({ edge, start, end, isSelected, darkMode, customConfig, onSelect, onAddChild, isTargetGroup, tNode }: any) => {
    // Same content as previous, keeping logic for decorators
    let baseConfig = BASE_REL_CONFIG[edge.type];
    if (!baseConfig && customConfig) baseConfig = customConfig.config;
    if (!baseConfig) baseConfig = { color: '#000', lineStyle: 'solid', renderType: 'standard' };

    const finalColor = edge.color || baseConfig.color;
    const renderType = baseConfig.renderType;
    const stroke = isSelected ? '#3b82f6' : (darkMode && finalColor === '#000000' ? '#ffffff' : finalColor);
    const isStructural = ['marriage', 'secret', 'couple', 'divorce-commit', 'separation', 'separation-repaired', 'separation-cohab', 'divorce', 'divorce-repaired', 'cohabitation', 'affair', 're-marriage', 'engagement', 'one-night'].includes(edge.type);
    const marriageBarY = getMarriageBarY(start.y, end.y);
    let midX = (start.x + end.x) / 2;
    let midY = (start.y + end.y) / 2;
    if (isStructural) midY = marriageBarY;

    let pathD = '';

    const angle = isStructural ? 0 : Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;

    let borderDist = 20;
    if (tNode && !isTargetGroup) {
        const dx = start.x - end.x;
        const dy = start.y - end.y;
        let radius = 20;
        if (!['M', 'F', 'TransWoman', 'TransMan', 'NonBinary'].includes(tNode.gender)) radius = 15;

        if (tNode.gender !== 'F') {
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                const theta = Math.atan2(dy, dx);
                const absCos = Math.abs(Math.cos(theta));
                const absSin = Math.abs(Math.sin(theta));
                radius = Math.min(radius / (absCos || 1), radius / (absSin || 1));
                if (radius > 30) radius = 30;
            }
        }
        borderDist = radius;
    }

    const tipOffset = renderType.includes('arrow-thick') ? 4 : 6;
    const arrowOffset = (isTargetGroup ? 0 : borderDist) + tipOffset;
    const arrowTrans = `translate(${end.x},${end.y}) rotate(${angle}) translate(-${arrowOffset},0)`;
    const centerArrowTrans = `translate(${midX},${midY}) rotate(${angle})`;

    let actualEndX = end.x;
    let actualEndY = end.y;

    const hasEndArrow = (renderType.includes('arrow') && !renderType.includes('center') && renderType !== 'double-arrow-inward') || renderType === 'triple-zigzag-center-arrow';
    if (hasEndArrow && !isStructural) {
        const baseOffset = arrowOffset + 4; // Use slightly smaller offset to avoid gap
        const rad = Math.atan2(end.y - start.y, end.x - start.x);
        actualEndX = end.x - Math.cos(rad) * baseOffset;
        actualEndY = end.y - Math.sin(rad) * baseOffset;
    }

    if (isStructural) pathD = `M ${start.x} ${start.y + NODE_RADIUS} L ${start.x} ${marriageBarY} L ${end.x} ${marriageBarY} L ${end.x} ${end.y + NODE_RADIUS}`;
    else if (edge.type.startsWith('child') || edge.type.startsWith('twin')) {
        if (edge.type.startsWith('twin')) pathD = `M ${start.x} ${start.y} L ${actualEndX} ${actualEndY}`;
        else pathD = `M ${start.x} ${start.y} L ${actualEndX} ${start.y} L ${actualEndX} ${actualEndY}`;
    } else if (baseConfig.lineStyle.startsWith('zigzag')) {
        let amp = 4; let freq = 12;
        if (baseConfig.lineStyle === 'zigzag-thick') { amp = 6; freq = 10; }
        pathD = getZigZagPath(start.x, start.y, actualEndX, actualEndY, amp, freq);
    }
    else pathD = `M ${start.x} ${start.y} Q ${midX} ${midY} ${actualEndX} ${actualEndY}`;

    const strokeDash = baseConfig.lineStyle === 'dashed' ? '8,4' : (baseConfig.lineStyle === 'dotted' ? '2,2' : '0');

    const Decorator = () => {
        let decX = midX; let decY = midY;

        // FIX: Rendering specifico per Migliore Amico (Dotted centrale + 2 Solide esterne)
        // Disegniamo le due linee esterne SENZA strokeDasharray così rimangono solide
        if (edge.type === 'best-friend') {
            return <g>
                <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" />
                <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" />
            </g>;
        }

        if (renderType === 'fusion' || renderType === 'triple') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" /></g>;

        // ... il resto del componente Decorator rimane uguale ...
        if (renderType === 'fusion-hostile') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (renderType === 'triple-zigzag') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-3,-3)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY)} stroke="red" strokeWidth={1.5} fill="none" /></g>;
        if (renderType === 'double' || renderType === 'double-zigzag' || renderType === 'best-friend') return <path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(3,3)" fill="none" strokeDasharray={strokeDash} />;

        // NUOVI SIMBOLI (CORREZIONE ANGOLO /)
        if (renderType === 'oblique') return <line x1={decX + 5} y1={decY - 10} x2={decX - 5} y2={decY + 10} stroke={stroke} strokeWidth={2} />;
        if (renderType === 'oblique-double') return <g><line x1={decX + 2} y1={decY - 10} x2={decX - 8} y2={decY + 10} stroke={stroke} strokeWidth={2} /><line x1={decX + 8} y1={decY - 10} x2={decX - 2} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;
        if (renderType === 'x-cross') return <g><line x1={decX + 5} y1={decY - 10} x2={decX - 5} y2={decY + 10} stroke={stroke} strokeWidth={2} /><line x1={decX - 5} y1={decY - 10} x2={decX + 5} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;
        if (renderType === 'oblique-double-crossed') return <g>
            <line x1={decX + 2} y1={decY - 10} x2={decX - 8} y2={decY + 10} stroke={stroke} strokeWidth={2} />
            <line x1={decX + 8} y1={decY - 10} x2={decX - 2} y2={decY + 10} stroke={stroke} strokeWidth={2} />
            <line x1={decX - 8} y1={decY - 10} x2={decX + 8} y2={decY + 10} stroke={stroke} strokeWidth={2} />
        </g>;

        if (renderType === 'cutoff-double') return <g><line x1={decX - 3} y1={decY - 10} x2={decX - 3} y2={decY + 10} stroke={stroke} strokeWidth={2} /><line x1={decX + 3} y1={decY - 10} x2={decX + 3} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;
        if (renderType === 'cutoff') return <line x1={decX} y1={decY - 10} x2={decX} y2={decY + 10} stroke={stroke} strokeWidth={3} />;
        if (renderType === 'cutoff-repaired-circle') return <g><line x1={decX - 4} y1={decY - 10} x2={decX - 14} y2={decY + 10} stroke={stroke} strokeWidth={2} /><circle cx={decX} cy={decY} r={5} fill="none" stroke={stroke} strokeWidth={1.5} /><line x1={decX + 14} y1={decY - 10} x2={decX + 4} y2={decY + 10} stroke={stroke} strokeWidth={2} /></g>;

        if (renderType === 'dashed-inner') return <g><path d={pathD} stroke={stroke} strokeWidth={1.5} strokeDasharray="4,4" fill="none" transform={`translate(0, 6)`} /></g>;

        if (renderType === 'triple-zigzag-center') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(6,6)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-6,-6)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY, 4, 12)} stroke="red" strokeWidth={1.5} fill="none" /></g>;

        if (renderType === 'triangle-up-center') return <polygon points="-6,0 6,0 0,-10" fill={stroke} transform={`translate(${midX},${midY})`} />;

        if (renderType === 'double-arrow-inward') {
            const dx = actualEndX - start.x; const dy = actualEndY - start.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = len > 0 ? dx / len : 1; const uy = len > 0 ? dy / len : 0;
            const ang = Math.atan2(dy, dx) * 180 / Math.PI;
            const x1 = start.x + dx * 0.33; const y1 = start.y + dy * 0.33;
            const x2 = start.x + dx * 0.67; const y2 = start.y + dy * 0.67;
            return <g>
                <polygon points="6,-6 -6,0 6,6" fill={stroke} transform={`translate(${x1},${y1}) rotate(${ang})`} />
                <polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={`translate(${x2},${y2}) rotate(${ang})`} />
            </g>;
        }

        if (renderType === 'arrow-x-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-6" y1="-6" x2="6" y2="6" stroke={stroke} strokeWidth={2} /><line x1="-6" y1="6" x2="6" y2="-6" stroke={stroke} strokeWidth={2} /></g></g>;
        if (renderType === 'arrow-box-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><rect x="-6" y="-6" width="12" height="12" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (renderType === 'arrow-diamond-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><polygon points="0,-6 6,0 0,6 -6,0" stroke={stroke} strokeWidth={2} fill="white" transform={centerArrowTrans} /></g>;
        if (renderType === 'arrow-double-bar-center') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /><g transform={centerArrowTrans}><line x1="-3" y1="-8" x2="-3" y2="8" stroke={stroke} strokeWidth={2} /><line x1="3" y1="-8" x2="3" y2="8" stroke={stroke} strokeWidth={2} /></g></g>;

        if (renderType.includes('arrow') && !renderType.includes('center') && !renderType.includes('thick')) return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /></g>;
        if (renderType === 'arrow-thick') return <polygon points="-8,-8 4,0 -8,8" fill={stroke} transform={arrowTrans} />;

        if (renderType === 'arrow-end') return <g><polygon points="-6,-6 6,0 -6,6" fill={stroke} transform={arrowTrans} /></g>;
        if (renderType === 'arrow-open-end') return <g><polyline points="-6,-6 6,0 -6,6" stroke={stroke} strokeWidth={2} fill="none" transform={arrowTrans} /></g>;
        if (renderType === 'arrow-open-center') return <g><polyline points="-6,-6 6,0 -6,6" stroke={stroke} strokeWidth={2} fill="none" transform={centerArrowTrans} /></g>;
        if (renderType === 'triple-zigzag-center-arrow') return <g><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(6,6)" fill="none" /><path d={pathD} stroke={stroke} strokeWidth={1} transform="translate(-6,-6)" fill="none" /><path d={getZigZagPath(start.x, start.y, actualEndX, actualEndY, 4, 12)} stroke="red" strokeWidth={1.5} fill="none" /><polygon points="-6,-6 6,0 -6,6" fill="red" transform={arrowTrans} /></g>;

        return null;
    };
    const onAddChildH = (e: any) => {
        e.stopPropagation(); e.preventDefault();

        onAddChild(e, edge.id);
    };
    return <g className="group hover:opacity-80 cursor-pointer" onClick={onSelect}><path d={pathD} stroke="transparent" strokeWidth={20} fill="none" /><path d={pathD} stroke={stroke} strokeWidth={isSelected ? 3 : (baseConfig.lineStyle === 'zigzag-thick' ? 3 : 2)} strokeDasharray={strokeDash} fill="none" /><Decorator />{edge.label && <text x={midX} y={midY - 15} textAnchor="middle" fill={stroke} className="text-[10px] bg-white dark:bg-gray-800 px-1">{edge.label}</text>}{isSelected && isStructural && (<g transform={`translate(${midX}, ${marriageBarY})`} onPointerDown={onAddChildH} style={{ touchAction: 'none' }}><circle r={12} fill="#10b981" stroke="white" /><Plus size={12} x={-6} y={-6} stroke="white" strokeWidth={3} /><title>Aggiungi Figlio alla Coppia</title></g>)}</g>;
};

// --- COMPONENTE NODE SHAPE CON RINOMINA E COLORI ---
const NodeShape = ({ node, isSelected, showLabelType, darkMode, onHandleDown, selectionMode, onRename }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditName(node.name);
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (editName.trim() !== "" && editName !== node.name) {
            onRename(node.id, editName);
        }
    };



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') setIsEditing(false);
    };

    const strokeColor = darkMode ? '#ffffff' : '#000000';
    const strokeWidth = isSelected ? 3 : (node.indexPerson ? 3 : 1.5);
    const fill = isSelected ? (darkMode ? '#374151' : '#e0f2fe') : (darkMode ? '#1f2937' : '#ffffff');
    const textColor = darkMode ? '#ffffff' : '#000000';
    const textBg = darkMode ? '#111827' : '#ffffff';
    const w = NODE_WIDTH, h = NODE_HEIGHT;
    const r = NODE_RADIUS;

    let Shape;
    switch (node.gender) {
        case 'M': Shape = <rect x={0} y={0} width={w} height={h} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'F': Shape = <circle cx={w / 2} cy={h / 2} r={w / 2} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'TransWoman': Shape = <g><rect x={0} y={0} width={w} height={h} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} /><circle cx={w / 2} cy={h / 2} r={w / 3} stroke={strokeColor} strokeWidth={1} fill="none" /></g>; break;
        case 'TransMan': Shape = <g><circle cx={w / 2} cy={h / 2} r={w / 2} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} /><rect x={10} y={10} width={w - 20} height={h - 20} stroke={strokeColor} strokeWidth={1} fill="none" /></g>; break;
        case 'NonBinary': Shape = <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'Pet': Shape = <path d={`M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'Pregnancy': Shape = <path d={`M${w / 2} 0 L${w} ${h} L0 ${h} Z`} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} />; break;
        case 'Miscarriage': Shape = <circle cx={w / 2} cy={h / 2} r={8} fill={strokeColor} />; break;
        case 'Abortion': Shape = <g><path d={`M5 5 L${w - 5} ${h - 5} M${w - 5} 5 L5 ${h - 5}`} stroke={strokeColor} strokeWidth={2} /></g>; break;
        case 'Stillbirth': Shape = <g><rect x={0} y={0} width={w} height={h} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} /><path d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`} stroke={strokeColor} strokeWidth={1} /></g>; break;
        default: Shape = <rect x={5} y={5} width={w - 10} height={h - 10} stroke={strokeColor} strokeWidth={strokeWidth} fill={fill} strokeDasharray="4 2" />; break;
    }

    // FIX COLORI SIMBOLI CLINICI
    // Usiamo colori specifici e rimuoviamo l'opacity globale per renderli vividi
    const Issues = () => (
        <g className="pointer-events-none">
            {/* Abuso Sostanze: Arancione (Bottom Half) */}
            {node.substanceAbuse && (
                node.gender === 'M'
                    ? <rect x={0} y={h / 2} width={w} height={h / 2} fill="#f97316" fillOpacity="0.8" stroke="none" />
                    : <path d={`M 0 ${h / 2} A ${r} ${r} 0 0 0 ${w} ${h / 2} Z`} fill="#f97316" fillOpacity="0.8" stroke="none" />
            )}

            {/* Problema Psi: Viola (Left Half) */}
            {node.mentalIssue && (
                node.gender === 'M'
                    ? <rect x={0} y={0} width={w / 3} height={h} fill="#8b5cf6" fillOpacity="0.8" stroke="none" />
                    : <path d={`M ${r} 0 A ${r} ${r} 0 0 0 ${r} ${h} Z`} fill="#8b5cf6" fillOpacity="0.8" stroke="none" />
            )}

            {/* Omosessualità: Rosa (Triangolo Inverso) */}
            {/* Aggiungiamo un stroke bianco/scuro per farlo risaltare se sovrapposto all'arancione */}
            {node.gayLesbian && (
                <path
                    d={`M ${w / 2 - 7} ${h - 12} L ${w / 2 + 7} ${h - 12} L ${w / 2} ${h} Z`}
                    fill="#ec4899"
                    stroke={fill}
                    strokeWidth={1}
                />
            )}
        </g>
    );

    const DeceasedMark = node.deceased ? <g stroke={strokeColor} strokeWidth={1.5}><line x1={0} y1={0} x2={w} y2={h} /><line x1={w} y1={0} x2={0} y2={h} /></g> : null;
    const IndexMark = node.indexPerson ? (node.gender === 'M' ? <rect x={6} y={6} width={w - 12} height={h - 12} stroke={strokeColor} strokeWidth={1.5} fill="none" /> : <circle cx={w / 2} cy={h / 2} r={w / 2 - 6} stroke={strokeColor} strokeWidth={1.5} fill="none" />) : null;

    const hasBirthDate = node.birthDate && node.birthDate.trim() !== '';
    const showAge = node.showAge !== false; // Default true

    let internalLabel = '';
    if (hasBirthDate && showAge) {
        if (showLabelType === 'age') internalLabel = calculateAge(node.birthDate);
        else if (showLabelType === 'year') {
            const d = parseDate(node.birthDate);
            if (d) internalLabel = d.getFullYear().toString();
        } else if (showLabelType === 'date') {
            internalLabel = node.birthDate;
        }
    }

    const onH = (e: any, action: string) => {
        e.stopPropagation(); e.preventDefault();

        onHandleDown(e, action, node.id);
    };

    // FIX ALLINEAMENTO TESTO
    // Centriamo il testo verticalmente nel rect usando dominantBaseline="middle"
    const TextLabel = ({ y, text, size, bold }: { y: number, text: string, size: number, bold?: boolean }) => {
        if (!text) return null;
        // Stima larghezza basata su font size medio
        const charW = size * 0.65;
        const width = (text.length * charW) + 8;
        const height = size + 4; // Altezza box proporzionale

        return (
            <g pointerEvents="none">
                {/* Il rect è centrato verticalmente attorno a Y */}
                <rect x={w / 2 - width / 2} y={y - height / 2} width={width} height={height} fill={textBg} fillOpacity="0.9" rx="3" />
                {/* Il testo è centrato verticalmente su Y */}
                <text
                    x={w / 2}
                    y={y}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill={textColor}
                    className={`text-[${size}px] font-sans ${bold ? 'font-bold' : ''} select-none`}
                    style={{ fontSize: size }} // Fallback style
                >
                    {text}
                </text>
            </g>
        )
    };

    return (
        <g transform={`translate(${node.x},${node.y})`} className="cursor-pointer group" onDoubleClick={handleDoubleClick}>
            {Shape} <Issues /> {IndexMark} {DeceasedMark}

            {isEditing ? (
                <foreignObject x={-40} y={-30} width={120} height={30}>
                    <input
                        ref={inputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '100%', height: '100%', border: '1px solid #3b82f6',
                            borderRadius: '4px', padding: '2px', fontSize: '12px',
                            textAlign: 'center', background: textBg, color: textColor,
                            outline: 'none'
                        }}
                    />
                </foreignObject>
            ) : (
                <TextLabel y={-10} text={node.name} size={11} bold />
            )}

            {/* Testo (Età, Data, Anno) posizionato all'interno del simbolo! */}
            {internalLabel && (
                <text
                    x={w / 2}
                    y={h / 2}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill={textColor}
                    className="text-[11px] font-bold select-none pointer-events-none opacity-80"
                >
                    {internalLabel}
                </text>
            )}

            {node.label && <TextLabel y={h + 14} text={node.label} size={9} />}

            {node.notes && node.notes.length > 0 && <circle cx={w + 5} cy={0} r={4} fill="#ef4444" stroke="white" strokeWidth={1} />}

            {isSelected && !selectionMode && !isEditing && (
                <g>
                    <g transform={`translate(${w + 20}, ${r})`} onPointerDown={(e) => onH(e, 'spouse')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: 'none' }}>
                        <circle r={14} fill={darkMode ? '#333' : 'white'} stroke="#db2777" strokeWidth={2} />
                        <Heart size={14} x={-7} y={-7} fill="#db2777" stroke="#db2777" />
                        <title>Coniuge</title>
                    </g>
                    <g transform={`translate(${r}, ${h + 25})`} onPointerDown={(e) => onH(e, 'child')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: 'none' }}>
                        <circle r={14} fill={darkMode ? '#333' : 'white'} stroke="#10b981" strokeWidth={2} />
                        <Plus size={14} x={-7} y={-7} color="#10b981" strokeWidth={3} />
                        <title>Figlio</title>
                    </g>
                    <g transform={`translate(${r}, -25)`} onPointerDown={(e) => onH(e, 'parents')} className="cursor-crosshair hover:opacity-80" style={{ touchAction: 'none' }}>
                        <circle r={14} fill={darkMode ? '#333' : 'white'} stroke="#8b5cf6" strokeWidth={2} />
                        <Users size={14} x={-7} y={-7} color="#8b5cf6" />
                        <title>Genitori</title>
                    </g>
                    <g transform={`translate(-20, ${r})`} onPointerDown={(e) => onH(e, 'link')} className="cursor-alias hover:opacity-80" style={{ touchAction: 'none' }}>
                        <rect x={-10} y={-10} width={20} height={20} rx={4} fill="#f59e0b" stroke="white" strokeWidth={1} />
                        <Waypoints size={12} x={-6} y={-6} color="white" />
                        <title>Relazione</title>
                    </g>
                </g>
            )}
        </g>
    );
};

const QuickRelMenu = ({ x, y, mode, customPresets, onSelect, onClose }: { x: number, y: number, mode: 'child' | 'spouse' | 'link' | 'parents', customPresets: CustomPreset[], onSelect: (type: string) => void, onClose: () => void }) => {
    let relevantKeys: string[] = [];
    if (mode === 'child' || mode === 'parents') relevantKeys = RELATION_CATEGORIES["Figli"] || [];
    else if (mode === 'spouse') relevantKeys = RELATION_CATEGORIES["Struttura / Coppia"] || [];
    else {
        const cats = ['Interazione / Affettive', 'Conflitto e Distanza', 'Violenza, Abuso e Potere', 'Simboli (Immagini)'];
        relevantKeys = cats.reduce((acc, cat) => acc.concat(RELATION_CATEGORIES[cat] || []), [] as string[]);
    }

    const options = [
        ...relevantKeys.map(key => { const conf = BASE_REL_CONFIG[key]; return conf ? { type: key, label: conf.label } : null; }).filter(Boolean),
        ...customPresets.map(p => ({ type: p.id, label: p.name }))
    ];

    const style: React.CSSProperties = { left: x, top: y };
    if (x > window.innerWidth - 260) style.left = x - 260;
    if (y > window.innerHeight - 300) style.top = y - 300;

    return (
        <div className="fixed theme-panel shadow-2xl rounded-lg p-2 w-64 border theme-border z-[9999] flex flex-col max-h-80" style={style}>
            <div className="text-[10px] font-bold opacity-50 uppercase px-2 py-1 rounded sticky top-0 flex justify-between items-center z-10 mb-1" style={{ backgroundColor: 'rgba(127,127,127,0.1)' }}>
                <span>Seleziona Tipo</span>
                <button onClick={onClose} className="hover:text-red-500"><X size={12} /></button>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {options.map(opt => opt && (
                    <button key={opt.type} onClick={() => onSelect(opt.type)} className={`w-full flex items-center gap-2 p-2 text-xs theme-hover text-left border-b theme-border last:border-0`}>
                        <div className="shrink-0"><LinePreview type={opt.type} /></div>
                        <span className="truncate">{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- COMPONENTE PALETTE PICKER ---
const GROUP_PALETTES = {
    'Pastello': PASTEL_PALETTE,
    'Vividi': VIVID_PALETTE,
    'Neutri': NEUTRAL_PALETTE
};

const PalettePicker = ({ value, onChange }: { value: string, onChange: (c: string) => void }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-2">
            {Object.entries(GROUP_PALETTES).map(([name, colors]) => (
                <div key={name}>
                    <div className="text-[10px] uppercase font-bold opacity-50 mb-1">{name}</div>
                    <div className="flex flex-wrap gap-1.5">
                        {colors.map(c => (
                            <button
                                key={c}
                                onClick={() => onChange(c)}
                                className={`w-6 h-6 rounded-full border border-black/10 dark:border-white/10 transition-transform hover:scale-110 flex items-center justify-center relative`}
                                style={{ backgroundColor: c }}
                                title={c}
                            >
                                {value.toLowerCase() === c.toLowerCase() && (
                                    <div className={`w-2 h-2 rounded-full ${['#ffffff', '#f3f4f6', '#fbcfe8', '#fde68a'].includes(c) ? 'bg-black' : 'bg-white'}`} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {/* Tasto Colore Custom */}
            <div className="pt-2 border-t theme-border mt-2">
                <button
                    onClick={() => inputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-1.5 text-xs rounded border theme-border theme-hover opacity-70 hover:opacity-100"
                >
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: value }} />
                    <span>Colore Personalizzato...</span>
                </button>
                <input
                    ref={inputRef}
                    type="color"
                    className="hidden"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Enhanced Notes Panel with Dates and Editing ---
const NotesPanel = ({ notes, onChange }: { notes: NoteItem[], onChange: (n: NoteItem[]) => void }) => {
    const [text, setText] = useState("");
    const [date, setDate] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    // Initial load, sort notes
    const sortedNotes = useMemo(() => {
        return [...notes].sort((a, b) => {
            const ya = extractYear(a.date);
            const yb = extractYear(b.date);
            return yb - ya; // Descending
        });
    }, [notes]);

    const handleSave = () => {
        if (!text.trim()) return;
        const noteDate = date ? date : new Date().toLocaleDateString();

        if (editingId) {
            onChange(notes.map(n => n.id === editingId ? { ...n, text, date: noteDate } : n));
            setEditingId(null);
        } else {
            onChange([...notes, { id: generateId(), text, date: noteDate }]);
        }
        setText("");
        setDate("");
    };

    const startEdit = (note: NoteItem) => {
        setEditingId(note.id);
        setText(note.text);
        setDate(note.date);
    };

    return (
        <div className="border-t theme-border pt-2 mt-2">
            <label className="text-xs font-bold opacity-50 block mb-1 theme-text">Diario Clinico / Note</label>
            <div className="space-y-1 mb-2 max-h-32 overflow-y-auto custom-scrollbar">
                {sortedNotes.map(n => (
                    <div key={n.id} className="p-2 rounded text-xs relative group border theme-border bg-yellow-50/10 border-yellow-200/50 dark:border-yellow-900/30">
                        {/* Sfondo stile post-it leggero adattivo */}
                        <div className="absolute inset-0 bg-yellow-500 opacity-10 rounded pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-1">
                                <div className="font-bold opacity-50 text-[10px] theme-text">{n.date || 'Senza data'}</div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(n)} className="theme-text hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5"><Edit3 size={10} /></button>
                                    <button onClick={() => onChange(notes.filter(x => x.id !== n.id))} className="text-red-500 hover:bg-red-100 rounded p-0.5"><X size={10} /></button>
                                </div>
                            </div>
                            <div className="whitespace-pre-wrap theme-text">{n.text}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-1 border theme-border p-1 rounded bg-black/5 dark:bg-white/5">
                <input
                    type="text"
                    className="w-full text-[10px] border-b theme-border bg-transparent p-1 outline-none theme-text placeholder-opacity-50 placeholder-current"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    placeholder="Data (es. Gennaio 2025, 12/05/98)"
                />
                <div className="flex gap-1">
                    <textarea
                        className="flex-1 border-none bg-transparent text-xs p-1 outline-none resize-none h-12 theme-text placeholder-opacity-50 placeholder-current"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder={editingId ? "Modifica nota..." : "Nuova nota..."}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
                    />
                    <button onClick={handleSave} className="bg-blue-600 text-white p-1 rounded self-end hover:bg-blue-700">
                        {editingId ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                    {editingId && <button onClick={() => { setEditingId(null); setText(""); setDate(""); }} className="bg-gray-200 text-gray-600 p-1 rounded self-end hover:bg-gray-300"><X size={14} /></button>}
                </div>
            </div>
        </div>
    );
};

const ReportModal = ({ onClose, nodes, edges, groups }: { onClose: () => void, nodes: GenNode[], edges: RelationEdge[], groups: NodeGroup[] }) => {
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const personStats = useMemo(() => {
        if (!selectedPerson) return null;
        const person = nodes.find(n => n.id === selectedPerson);
        if (!person) return null;

        // Partner/Spouses
        const spouseEdges = edges.filter(e =>
            (e.fromId === selectedPerson || e.toId === selectedPerson) &&
            RELATION_CATEGORIES["Struttura"].includes(e.type)
        );
        const spouses = spouseEdges.map(e => {
            const partnerId = e.fromId === selectedPerson ? e.toId : e.fromId;
            const partner = nodes.find(n => n.id === partnerId);
            const conf = BASE_REL_CONFIG[e.type];
            return {
                name: partner ? partner.name : 'Sconosciuto',
                type: conf ? conf.label : e.type
            };
        });

        const myEdges = edges.filter(e => e.fromId === selectedPerson || e.toId === selectedPerson);
        const relations = myEdges.map(e => {
            if (RELATION_CATEGORIES["Struttura"].includes(e.type)) return null;
            const otherId = e.fromId === selectedPerson ? e.toId : e.fromId;
            let otherName = 'Sconosciuto';
            const otherNode = nodes.find(n => n.id === otherId);

            if (otherNode) {
                otherName = otherNode.name;
            } else {
                const group = groups.find(g => g.id === otherId);
                if (group) {
                    const memberNames = nodes.filter(n => group.memberIds.includes(n.id)).map(n => n.name).join(', ');
                    otherName = `Gruppo: ${group.label} (Membri: ${memberNames})`;
                }
            }

            const conf = BASE_REL_CONFIG[e.type];
            return {
                id: e.id,
                with: otherName,
                type: conf ? conf.label : e.type,
                notes: e.notes
            };
        }).filter(Boolean);

        const parentEdges = edges.filter(e => e.toId === selectedPerson && e.type.startsWith('child'));
        const parents = parentEdges.map(e => {
            const p = nodes.find(n => n.id === e.fromId);
            return p ? p.name : 'Ignoto';
        });

        const childrenEdges = edges.filter(e => e.fromId === selectedPerson && e.type.startsWith('child'));
        const children = childrenEdges.map(e => {
            const c = nodes.find(n => n.id === e.toId);
            return c ? c.name : 'Ignoto';
        });

        return { person, relations, parents, children, spouses };
    }, [selectedPerson, nodes, edges, groups]);

    const filteredNodes = nodes.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
            {/* Main Box con variabili tema */}
            <div className="theme-panel border theme-border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex overflow-hidden">

                {/* Sidebar Sinistra */}
                <div className="w-1/3 border-r theme-border flex flex-col">
                    <div className="p-4 border-b theme-border bg-black/5 dark:bg-white/5">
                        <h2 className="font-bold flex items-center gap-2 theme-text"><FileText /> Report</h2>
                        <div className="relative mt-2">
                            <Search className="absolute left-2 top-2.5 opacity-50 theme-text" size={14} />
                            <input
                                className="w-full pl-8 p-2 text-sm border rounded bg-transparent theme-border theme-text placeholder-opacity-50 placeholder-current focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                                placeholder="Cerca persona..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredNodes.map(n => (
                            <button
                                key={n.id}
                                onClick={() => setSelectedPerson(n.id)}
                                className={`w-full text-left p-3 border-b theme-border theme-hover transition-colors ${selectedPerson === n.id ? 'bg-black/10 dark:bg-white/10 border-l-4 border-l-[var(--theme-accent)]' : ''}`}
                            >
                                <div className="font-bold text-sm theme-text">{n.name}</div>
                                <div className="text-xs opacity-50 theme-text">{n.gender} • {calculateAge(n.birthDate)} anni</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area Destra */}
                <div className="flex-1 flex flex-col bg-black/5 dark:bg-white/5">
                    <div className="p-4 flex justify-between items-center theme-panel border-b theme-border">
                        <h3 className="font-bold theme-text">Dettagli Scheda</h3>
                        <button onClick={onClose} className="theme-text theme-hover p-1 rounded"><X /></button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {!personStats ? (
                            <div className="opacity-50 text-center mt-20 theme-text">Seleziona una persona per vedere il report</div>
                        ) : (
                            <div className="space-y-6">
                                {/* Header Persona */}
                                <div className="flex gap-4 items-center">
                                    <div className={`w-16 h-16 flex items-center justify-center rounded-full text-2xl font-bold shadow-sm border theme-border ${['M', 'TransMan'].includes(personStats.person.gender) ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200' : (['F', 'TransWoman'].includes(personStats.person.gender) ? 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-200' : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200')}`}>
                                        {personStats.person.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold theme-text">{personStats.person.name}</h2>
                                        <div className="text-sm opacity-70 theme-text">Nato/a: {personStats.person.birthDate || '?'} • Età: {calculateAge(personStats.person.birthDate)}</div>
                                    </div>
                                </div>

                                {/* Sezione Partner */}
                                {personStats.spouses.length > 0 && (
                                    <div className="p-4 rounded shadow-sm border theme-border bg-black/5 dark:bg-white/5">
                                        <h4 className="font-bold mb-2 text-sm uppercase opacity-70 theme-text flex items-center gap-2"><Heart size={12} /> Partner / Coniugi</h4>
                                        {personStats.spouses.map((s, i) => (
                                            <div key={i} className="font-medium theme-text">• {s.name} <span className="opacity-60 text-xs">({s.type})</span></div>
                                        ))}
                                    </div>
                                )}

                                {/* Genitori e Figli */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="theme-panel border theme-border p-4 rounded shadow-sm">
                                        <h4 className="font-bold mb-2 text-sm uppercase opacity-50 theme-text">Genitori</h4>
                                        {personStats.parents.length ? personStats.parents.map((p, i) => <div key={i} className="theme-text">• {p}</div>) : <span className="theme-text opacity-50">-</span>}
                                    </div>
                                    <div className="theme-panel border theme-border p-4 rounded shadow-sm">
                                        <h4 className="font-bold mb-2 text-sm uppercase opacity-50 theme-text">Figli</h4>
                                        {personStats.children.length ? personStats.children.map((c, i) => <div key={i} className="theme-text">• {c}</div>) : <span className="theme-text opacity-50">-</span>}
                                    </div>
                                </div>

                                {/* Altre Relazioni */}
                                <div className="theme-panel border theme-border p-4 rounded shadow-sm">
                                    <h4 className="font-bold mb-3 text-sm uppercase opacity-50 theme-text">Altre Relazioni ({personStats.relations.length})</h4>
                                    <div className="space-y-2">
                                        {personStats.relations.map((r: any) => (
                                            <div key={r.id} className="flex justify-between items-center p-2 border theme-border rounded theme-hover">
                                                <span className="font-medium theme-text">
                                                    {r.type} <span className="font-normal opacity-70">con</span> {r.with}
                                                </span>
                                                {r.notes.length > 0 && (
                                                    <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-700">Note</span>
                                                )}
                                            </div>
                                        ))}
                                        {personStats.relations.length === 0 && <div className="text-sm opacity-50 theme-text">Nessuna altra relazione registrata</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... SettingsModal, StyleDesignerModal (Same as before) ...
const SettingsModal = ({ onClose, onExport, onImport, setCustomUser, customUser, setFirebaseConfig, firebaseConfig }: any) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
            <div className="theme-panel p-6 rounded-lg shadow-xl w-96 space-y-4 border theme-border">
                <h2 className="font-bold text-lg flex justify-between items-center">
                    Impostazioni <button onClick={onClose}><X size={20} /></button>
                </h2>
                <div>
                    <label className="text-xs font-bold opacity-50 block mb-1">ID Utente (Opzionale)</label>
                    <input className="w-full border theme-border p-2 rounded bg-transparent text-sm" value={customUser} onChange={e => setCustomUser(e.target.value)} placeholder="Tuo ID univoco per sync" />
                </div>
                <div>
                    <label className="text-xs font-bold opacity-50 block mb-1">Configurazione Firebase (JSON)</label>
                    <textarea className="w-full border theme-border p-2 rounded bg-transparent text-[10px] h-24 font-mono" value={firebaseConfig} onChange={e => setFirebaseConfig(e.target.value)} placeholder='{"apiKey": "...", ...}' />
                </div>
                <div className="pt-4 border-t theme-border flex flex-col gap-2">
                    <button onClick={onExport} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm flex items-center justify-center gap-2"><Download size={14} /> Backup Dati (JSON)</button>
                    <label className="w-full border theme-border py-2 rounded text-sm flex items-center justify-center gap-2 cursor-pointer theme-hover">
                        <Upload size={14} /> Ripristina Backup
                        <input type="file" onChange={onImport} className="hidden" accept=".json" />
                    </label>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE MANUALE ISTRUZIONI COMPLETO (FIX SCROLL) ---
const InstructionsModal = ({ onClose, firebaseConfig }: { onClose: () => void, firebaseConfig: string }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
            {/* Box Principale con variabili tema */}
            <div className="theme-panel w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border theme-border">

                {/* Header */}
                <div className="p-4 border-b theme-border flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
                    <h2 className="font-bold text-lg flex items-center gap-2 theme-text">
                        <HelpCircle className="text-[var(--theme-accent)]" /> Manuale Utente
                    </h2>
                    <button onClick={onClose} className="p-1 theme-hover rounded theme-text"><X /></button>
                </div>

                {/* Contenuto Scrollabile - APERTURA */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar leading-relaxed">
                    {/* Stili Locali per il Manuale */}
                    <style>{`
                        .manual-section { margin-bottom: 40px; }
                        .manual-h2 { font-size: 1.4rem; font-weight: 700; color: var(--theme-accent); border-left: 4px solid var(--theme-accent); padding-left: 12px; margin-bottom: 1.5rem; margin-top: 1rem; background: rgba(125,125,125,0.05); padding-top:8px; padding-bottom:8px; border-radius: 0 8px 8px 0; }
                        .manual-h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.8rem; opacity: 0.9; color: var(--theme-text); border-bottom: 1px dashed var(--theme-border); padding-bottom: 4px; }
                        .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-top: 15px; }
                        .tool-card { border: 1px solid var(--theme-border); border-radius: 8px; padding: 16px; display: flex; gap: 16px; background: rgba(125,125,125,0.03); align-items: flex-start; transition: transform 0.2s; }
                        .tool-card:hover { background: rgba(125,125,125,0.06); }
                        .key-badge { background: rgba(125,125,125,0.1); border: 1px solid var(--theme-border); padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: bold; font-size: 0.9em; color: var(--theme-text); display: inline-block; min-width: 24px; text-align: center; }
                        .theme-text-desc { color: var(--theme-text); opacity: 0.7; font-size: 0.9rem; margin-top: 4px; line-height: 1.4; }
                        .icon-box { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(125,125,125,0.1); }
                        ul.manual-list { list-style: disc; margin-left: 20px; color: var(--theme-text); opacity: 0.9; }
                        ul.manual-list li { margin-bottom: 6px; }
                        strong { color: var(--theme-text); opacity: 1; }
                    `}</style>

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold theme-text mb-2">GenoPro Web</h1>
                        <p className="opacity-60 theme-text text-lg">Guida completa alle funzionalità, strumenti e simbologia.</p>
                    </div>

                    {/* SEZIONE 1: DASHBOARD */}
                    <div className="manual-section">
                        <h2 className="manual-h2">1. Dashboard e Temi</h2>
                        <div className="tool-grid">
                            <div className="tool-card">
                                <div className="icon-box"><LayoutGrid className="text-blue-500" /></div>
                                <div><strong className="theme-text">Categorie</strong><div className="theme-text-desc">Filtra per Famiglie, Coppie, Individuali, Lavoro, ecc.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Sun className="text-orange-500" /></div>
                                <div><strong className="theme-text">Temi Grafici</strong><div className="theme-text-desc">Scegli tra vari stili: <b>Light</b>, <b>Dark</b>, <b>Sepia</b>, <b>Dracula</b>, <b>Nordic</b> e altri.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Search className="text-purple-500" /></div>
                                <div><strong className="theme-text">Ricerca</strong><div className="theme-text-desc">Cerca genogrammi velocemente per titolo.</div></div>
                            </div>
                        </div>
                    </div>

                    {/* SEZIONE 2: TOUCH */}
                    <div className="manual-section">
                        <h2 className="manual-h2">2. Navigazione Touch (Tablet & iPad)</h2>
                        <p className="theme-text mb-4 opacity-80">L'interfaccia è ottimizzata per l'uso con le dita e supporta gesture avanzate.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded border theme-border bg-blue-500/5 flex gap-4 items-start">
                                <div className="text-2xl">👆</div>
                                <div>
                                    <strong className="theme-text">Scorrimento (Pan)</strong>
                                    <p className="theme-text-desc">Trascina un dito su un'area vuota per spostarti nel grafico.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded border theme-border bg-green-500/5 flex gap-4 items-start">
                                <div className="text-2xl">👌</div>
                                <div>
                                    <strong className="theme-text">Zoom (Pinch)</strong>
                                    <p className="theme-text-desc">Usa due dita (pizzico) per ingrandire o rimpicciolire la vista.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded border theme-border bg-purple-500/5 flex gap-4 items-start">
                                <div className="text-2xl">⏱️</div>
                                <div>
                                    <strong className="theme-text">Aggiunta Rapida (Long Press)</strong>
                                    <p className="theme-text-desc">Tocca e <b>tieni premuto</b> un dito su un punto vuoto per aprire il menu rapido (M/F).</p>
                                </div>
                            </div>
                            <div className="p-4 rounded border theme-border bg-orange-500/5 flex gap-4 items-start">
                                <div className="text-2xl">✨</div>
                                <div>
                                    <strong className="theme-text">Selezione Multipla</strong>
                                    <p className="theme-text-desc">Attiva <strong>Mod. Selezione</strong> nella toolbar, poi trascina per creare un rettangolo.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEZIONE 3: COSTRUZIONE RAPIDA */}
                    <div className="manual-section">
                        <h2 className="manual-h2">3. Costruzione Rapida</h2>
                        <p className="mb-4 theme-text opacity-80">Seleziona una persona per vedere le 4 maniglie colorate:</p>
                        <div className="tool-grid">
                            <div className="tool-card">
                                <div className="icon-box bg-pink-100 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800"><Heart size={20} className="text-pink-600 dark:text-pink-400" /></div>
                                <div><strong className="theme-text">Destra: Partner</strong><div className="theme-text-desc">Aggiunge un coniuge/partner a destra.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800"><Plus size={20} className="text-green-600 dark:text-green-400" /></div>
                                <div><strong className="theme-text">Basso: Figlio</strong><div className="theme-text-desc">Crea un figlio (collegato alla coppia se presente).</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800"><Users size={20} className="text-purple-600 dark:text-purple-400" /></div>
                                <div><strong className="theme-text">Alto: Genitori</strong><div className="theme-text-desc">Genera automaticamente la coppia di genitori sopra il soggetto.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800"><Waypoints size={20} className="text-orange-600 dark:text-orange-400" /></div>
                                <div><strong className="theme-text">Sinistra: Link</strong><div className="theme-text-desc">Trascina verso un'altra persona <b>o un Gruppo</b> per creare una relazione manuale.</div></div>
                            </div>
                        </div>
                    </div>

                    {/* SEZIONE 4: PROPRIETÀ AVANZATE */}
                    <div className="manual-section">
                        <h2 className="manual-h2">4. Proprietà e Simbologia</h2>

                        <h3 className="manual-h3">👤 Proprietà Persona</h3>
                        <ul className="manual-list">
                            <li><strong>Dati Anagrafici:</strong> Nome, Data (es. "1980" o "12/05/1980").</li>
                            <li><strong>Mostra Età:</strong> Checkbox per nascondere/mostrare l'età calcolata.</li>
                            <li><strong>Marcatori Clinici:</strong> Deceduto (X), Pz. Designato (Doppio bordo), Abuso Sostanze (Arancio), Problema Psi (Viola), Omosessualità (Triangolo Rosa).</li>
                        </ul>

                        <h3 className="manual-h3">🔗 Proprietà Relazione</h3>
                        <ul className="manual-list">
                            <li><strong>Tipo Relazione:</strong> Scegli tra decine di stili (Conflitto, Armonia, Abuso, Distanza, ecc.).</li>
                            <li><strong>Ancoraggio Gruppi:</strong> Se colleghi un gruppo, usa lo <strong>Slider (0-100%)</strong> nella sidebar per spostare la freccia lungo il bordo curvo.</li>
                        </ul>

                        <h3 className="manual-h3">👥 Proprietà Gruppo</h3>
                        <ul className="manual-list">
                            <li><strong>Palette Colori:</strong> Selettore rapido (Pastello, Vividi, Neutri).</li>
                            <li><strong>Forma Organica:</strong> Si adatta automaticamente al contenuto.</li>
                            <li><strong>Maniglia Viola (Basso):</strong> Trascina per regolare la grandezza (padding).</li>
                            <li><strong>Maniglia Gialla (Sinistra):</strong> Trascina per creare relazioni dal gruppo.</li>
                        </ul>
                    </div>

                    {/* SEZIONE 5: STRUMENTI TOOLBAR */}
                    <div className="manual-section">
                        <h2 className="manual-h2">5. Strumenti della Toolbar</h2>
                        <p className="theme-text opacity-80 mb-4">Ecco la spiegazione di tutti i pulsanti presenti nella barra in alto, da sinistra a destra.</p>

                        <div className="tool-grid">
                            {/* Aggiunta Nodi */}
                            <div className="tool-card">
                                <div className="icon-box"><Square size={20} className="text-[var(--theme-accent)]" /></div>
                                <div><strong className="theme-text">Nuovo Maschio</strong><div className="theme-text-desc">Aggiunge un soggetto maschio al centro del grafico.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Circle size={20} className="text-pink-600" /></div>
                                <div><strong className="theme-text">Nuova Femmina</strong><div className="theme-text-desc">Aggiunge un soggetto femmina al centro del grafico.</div></div>
                            </div>

                            {/* Relazioni Rapide */}
                            <div className="tool-card">
                                <div className="icon-box"><UserPlus size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Aggiungi Genitori</strong><div className="theme-text-desc">Crea i genitori sopra la persona selezionata.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Heart size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Aggiungi Partner</strong><div className="theme-text-desc">Crea un coniuge a fianco della persona selezionata.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><GitBranch size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Aggiungi Figlio</strong><div className="theme-text-desc">Crea un figlio sotto la selezione (se coppia, collega a entrambi).</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Users size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Nuovo Gruppo</strong><div className="theme-text-desc">Raggruppa le persone selezionate in una "Household" o sottosistema.</div></div>
                            </div>

                            {/* Layout Automatici */}
                            <div className="tool-card">
                                <div className="icon-box"><Network size={20} style={{ color: 'var(--theme-accent)' }} /></div>
                                <div><strong className="theme-text">Auto-Layout</strong><div className="theme-text-desc">Riorganizza automaticamente l'intero albero genealogico.</div></div>
                            </div>

                            {/* Allineamenti */}
                            <div className="tool-card">
                                <div className="icon-box"><AlignJustify size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Allinea Orizzontale</strong><div className="theme-text-desc">Allinea i nodi selezionati sulla stessa riga (Y).</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><AlignJustify size={20} className="theme-text rotate-90" /></div>
                                <div><strong className="theme-text">Allinea Verticale</strong><div className="theme-text-desc">Allinea i nodi selezionati sulla stessa colonna (X).</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><ArrowDownToLine size={20} style={{ color: 'var(--theme-accent)' }} /></div>
                                <div><strong className="theme-text">Centra Figli</strong><div className="theme-text-desc">Sposta i figli selezionati esattamente sotto al centro dei genitori.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><ArrowUpToLine size={20} style={{ color: 'var(--theme-accent)' }} /></div>
                                <div><strong className="theme-text">Centra Genitori</strong><div className="theme-text-desc">Sposta i genitori selezionati esattamente sopra al centro dei figli.</div></div>
                            </div>

                            {/* Disposizioni Speciali */}
                            <div className="tool-card">
                                <div className="icon-box"><CircleDashed size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Cerchio</strong><div className="theme-text-desc">Dispone i nodi selezionati in cerchio (utile per sociogrammi).</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Grid3X3 size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Griglia</strong><div className="theme-text-desc">Ordina i nodi selezionati in una griglia compatta.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><TrendingUp size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Scala / Diagonale</strong><div className="theme-text-desc">Dispone i nodi in diagonale (utile per linee temporali).</div></div>
                            </div>

                            {/* Strumenti Vari */}
                            <div className="tool-card">
                                <div className="icon-box"><Grip size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Snap Griglia</strong><div className="theme-text-desc">Attiva/Disattiva l'aggancio magnetico dei nodi alla griglia.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><MousePointer2 size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Mod. Selezione</strong><div className="theme-text-desc">Permette di selezionare più elementi trascinando un rettangolo blu.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Edit3 size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Designer Stili</strong><div className="theme-text-desc">Editor per creare nuovi tipi di linee o simboli relazionali.</div></div>
                            </div>
                            <div className="tool-card">
                                <div className="icon-box"><Info size={20} className="theme-text" /></div>
                                <div><strong className="theme-text">Legenda</strong><div className="theme-text-desc">Mostra o nasconde la legenda automatica sul grafico.</div></div>
                            </div>
                        </div>
                    </div>

                    {/* SEZIONE 6: ESPORTAZIONE */}
                    <div className="manual-section">
                        <h2 className="manual-h2">6. Esportazione</h2>
                        <div className="p-4 rounded border theme-border bg-yellow-500/10 mb-4 flex gap-3 items-center">
                            <Info size={24} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
                            <p className="theme-text text-sm">
                                <strong>Nota Importante:</strong> L'esportazione mantiene i colori del <strong>Tema Attuale</strong>.
                                Se sei in "Dark Mode", il PDF/Immagine avrà sfondo scuro. Passa a "Light Mode" prima di esportare se desideri uno sfondo bianco per la stampa.
                            </p>
                        </div>
                        <ul className="manual-list">
                            <li><strong>PNG / JPEG:</strong> Immagine raster ad alta risoluzione (supporta zoom impostabile da 1x a 6x).</li>
                            <li><strong>PDF Vettoriale:</strong> Scarica solo il grafico in vettoriale. Perfetto per stampe professionali o tesi (non sgrana mai).</li>
                            <li><strong>Report Clinico:</strong> Genera un documento PDF multipagina con grafico, legenda simboli e scheda testuale dettagliata per ogni persona.</li>
                        </ul>
                    </div>

                    {/* SEZIONE 7: IMPOSTAZIONI E BACKUP */}
                    <div className="manual-section">
                        <h2 className="manual-h2">7. Impostazioni, Backup e Cloud</h2>
                        <p className="theme-text opacity-80 mb-6">Gestisci i tuoi dati, salvali al sicuro o sincronizzali tra più dispositivi.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* BACKUP LOCALE */}
                            <div className="theme-panel border theme-border p-5 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600"><Download size={20} /></div>
                                    <h3 className="font-bold text-lg theme-text m-0 border-none">Backup Locale</h3>
                                </div>
                                <p className="theme-text-desc mb-4">
                                    Salva tutti i tuoi genogrammi in un unico file (JSON) sul tuo computer. Utile per creare copie di sicurezza o trasferire i dati manualmente.
                                </p>
                                <ul className="manual-list text-sm">
                                    <li>Clicca su <Settings size={12} className="inline" /> <strong>Impostazioni</strong>.</li>
                                    <li>Premi <strong>Backup Dati</strong> per scaricare il file.</li>
                                    <li>Usa <strong>Ripristina</strong> per caricare un backup salvato.</li>
                                </ul>
                            </div>

                            {/* CLOUD SYNC */}
                            <div className="theme-panel border theme-border p-5 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600"><Cloud size={20} /></div>
                                    <h3 className="font-bold text-lg theme-text m-0 border-none">Sincronizzazione Cloud</h3>
                                </div>
                                <p className="theme-text-desc mb-4">
                                    Collega un database personale per salvare i dati online e accedervi da PC, iPad e Tablet contemporaneamente.
                                </p>
                                <div className="p-3 rounded bg-green-500/10 border border-green-500/20 text-xs theme-text">
                                    <strong className="text-green-600 dark:text-green-400">Stato:</strong> {firebaseConfig ? "🟢 Connesso" : "⚪ Non configurato (Salvataggio solo locale)"}
                                </div>
                            </div>
                        </div>

                        {/* GUIDA FIREBASE */}
                        <div className="p-5 rounded-xl border theme-border bg-black/5 dark:bg-white/5">
                            <h3 className="text-base font-bold theme-text mb-4 flex items-center gap-2">
                                <Database size={18} className="text-[var(--theme-accent)]" />
                                Guida: Come creare il tuo Cloud Personale (Gratis)
                            </h3>

                            <div className="space-y-4 text-sm theme-text opacity-90">
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">1</span>
                                    <div>
                                        Vai su <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Firebase Console</a> e accedi con il tuo account Google.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">2</span>
                                    <div>
                                        Clicca <strong>"Crea un progetto"</strong> (chiamalo es. "GenoPro-Mio"). Disabilita Google Analytics per fare prima.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">3</span>
                                    <div>
                                        Nel menu a sinistra, vai su <strong>"Build" &gt; "Firestore Database"</strong> e clicca su <strong>"Crea Database"</strong>.
                                        <br /><span className="opacity-70 text-xs">(Seleziona una località vicina, es. eur3, e scegli avvia in <strong>Modalità Test</strong>).</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">4</span>
                                    <div>
                                        Torna alla <strong>Home del Progetto</strong> (icona ingranaggio in alto a sx &gt; Impostazioni progetto).
                                        Scorri in basso fino a "Le tue app" e clicca sull'icona <strong>Web (&lt;/&gt;)</strong>.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">5</span>
                                    <div>
                                        Dai un nome all'app e registrala. Ti verrà mostrato un codice. Copia tutto il contenuto tra le parentesi graffe:
                                        <div className="mt-2 p-2 bg-gray-200 dark:bg-gray-800 rounded font-mono text-[10px] opacity-70">
                                            apiKey: "AIzaSy...",<br />
                                            authDomain: "...",<br />
                                            projectId: "...",<br />
                                            ...
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold text-xs">6</span>
                                    <div>
                                        Torna qui in GenoPro, apri <strong>Impostazioni</strong> e incolla il codice nel box "Configurazione Firebase".
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABELLA SHORTCUTS (FIXED STYLE ERROR) */}
                    <div className="manual-section">
                        <h2 className="manual-h2">Scorciatoie da Tastiera</h2>
                        <div className="border theme-border rounded overflow-hidden text-sm mt-4">
                            {/* Generali */}
                            <div className="flex justify-between border-b theme-border p-2 bg-black/5 dark:bg-white/5 font-bold theme-text">
                                <span>Azione</span> <span>Tasti</span>
                            </div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Maschio / Femmina</span> <span><span className="key-badge">M</span> / <span className="key-badge">F</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Partner</span> <span><span className="key-badge">S</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Figlio</span> <span><span className="key-badge">C</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Genitori</span> <span><span className="key-badge">P</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text">
                                <span>Seleziona Tutto</span>
                                <span><span className="key-badge">Ctrl</span> + <span className="key-badge">A</span></span>
                            </div>

                            {/* Allineamenti (Nuovi) */}
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Disponi a Cerchio</span> <span><span className="key-badge">Alt</span> + <span className="key-badge">C</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Disponi a Griglia</span> <span><span className="key-badge">Alt</span> + <span className="key-badge">G</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Disponi a Scala</span> <span><span className="key-badge">Alt</span> + <span className="key-badge">D</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Allinea Orizz./Vert.</span> <span><span className="key-badge">Alt</span> + <span className="key-badge">H</span> / <span className="key-badge">V</span></span></div>

                            {/* Altri */}
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Legenda</span> <span><span className="key-badge">I</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Elimina</span> <span><span className="key-badge">Canc</span></span></div>
                            <div className="flex justify-between border-b theme-border p-2 theme-text"><span>Salva</span> <span><span className="key-badge">Ctrl</span> + <span className="key-badge">S</span></span></div>
                        </div>
                    </div>
                </div> {/* <--- CHIUSURA SCROLL CORRETTA QUI (DOPO TUTTE LE SEZIONI) */}

                {/* Footer Modal */}
                <div className="p-4 border-t theme-border bg-black/5 dark:bg-white/5 text-center shrink-0">
                    <button onClick={onClose} className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-all font-medium">Chiudi Manuale</button>
                </div>
            </div>
        </div>
    );
};

const StyleDesignerModal = ({ onClose, onSave }: { onClose: () => void, onSave: (preset: CustomPreset) => void }) => {
    const [name, setName] = useState("Nuovo Stile");
    const [color, setColor] = useState("#000000");
    const [lineStyle, setLineStyle] = useState("solid");
    const [renderType, setRenderType] = useState("standard");
    const handleSave = () => { onSave({ id: `custom-${generateId()}`, name, type: 'relationship', config: { color, lineStyle, renderType, decorator: '' } }); onClose(); };
    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96 space-y-4 text-black dark:text-white">
                <h3 className="font-bold text-lg">Designer Relazioni</h3>
                <input className="w-full border p-2 rounded dark:bg-gray-700" value={name} onChange={e => setName(e.target.value)} placeholder="Nome stile" />
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs block mb-1">Colore</label><input type="color" className="w-full h-8" value={color} onChange={e => setColor(e.target.value)} /></div>
                    <div><label className="text-xs block mb-1">Tratteggio</label><select className="w-full border p-1 rounded dark:bg-gray-700" value={lineStyle} onChange={e => setLineStyle(e.target.value)}><option value="solid">Solido</option><option value="dashed">Tratteggiato</option><option value="dotted">Puntinato</option><option value="zigzag">ZigZag</option></select></div>
                </div>
                <div><label className="text-xs block mb-1">Decorazione</label><select className="w-full border p-1 rounded dark:bg-gray-700" value={renderType} onChange={e => setRenderType(e.target.value)}><option value="standard">Nessuna</option><option value="arrow">Freccia Singola</option><option value="arrow-double">Freccia Doppia</option><option value="fusion">Fusione</option><option value="cutoff">Taglio</option></select></div>
                <div className="p-4 border rounded bg-gray-50 dark:bg-gray-900 flex justify-center items-center h-20"><svg width="200" height="20"><line x1="0" y1="10" x2="200" y2="10" stroke={color} strokeWidth="2" strokeDasharray={lineStyle === 'dashed' ? '5,5' : (lineStyle === 'dotted' ? '2,2' : '')} /></svg></div>
                <div className="flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 text-gray-500">Annulla</button><button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">Salva Preset</button></div>
            </div>
        </div>
    );
};

// Funzione helper per pulire la configurazione Firebase incollata male
const parseFirebaseConfig = (input: string) => {
    try {
        if (!input) return null;
        let cleaned = input.trim();

        // 1. Rimuove tutto ciò che precede la prima parentesi graffa aperta '{'
        // Questo elimina 'const firebaseConfig = ', 'export const config = ', ecc.
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            // Se non ci sono graffe, forse è già JSON puro o invalido
            return JSON.parse(cleaned);
        }

        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        // 2. Correzioni specifiche per trasformare JS Object in JSON

        // Aggiunge virgolette alle chiavi (es. apiKey: -> "apiKey":)
        // Regex: trova parole seguite da due punti, ignorando se sono già tra virgolette
        cleaned = cleaned.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');

        // Sostituisce apici singoli con doppi per i valori stringa (es. 'valore' -> "valore")
        cleaned = cleaned.replace(/'/g, '"');

        // Rimuove virgole finali (trailing commas) prima di chiusure } o ]
        // Es. "key": "value", } -> "key": "value" }
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Errore parsing config string:", e);
        // Fallback: prova a parsare direttamente se l'utente ha incollato JSON puro
        try { return JSON.parse(input); } catch (e2) { return null; }
    }
};

// --- COMPONENTE TRANSFORMER AGGIORNATO (Spostamento Abilitato) ---
const SelectionTransformer = ({ nodes, selectedIds, onHandleDown, onMove }: { nodes: GenNode[], selectedIds: string[], onHandleDown: (e: any, type: 'rotate' | 'scale') => void, onMove: (e: any) => void }) => {
    if (selectedIds.length < 2) return null;

    const selected = nodes.filter(n => selectedIds.includes(n.id));
    if (selected.length === 0) return null;

    const minX = Math.min(...selected.map(n => n.x));
    const maxX = Math.max(...selected.map(n => n.x + NODE_WIDTH));
    const minY = Math.min(...selected.map(n => n.y));
    const maxY = Math.max(...selected.map(n => n.y + NODE_HEIGHT));

    const padding = 20;
    const x = minX - padding;
    const y = minY - padding;
    const w = (maxX - minX) + padding * 2;
    const h = (maxY - minY) + padding * 2;

    return (
        <g pointerEvents="visible">
            {/* Box Tratteggiato: Ora ha fill quasi invisibile per catturare il click ovunque e permettere lo spostamento */}
            <rect
                x={x} y={y} width={w} height={h}
                fill="black" fillOpacity="0.01"
                stroke="#3b82f6" strokeWidth={1} strokeDasharray="5,5"
                className="cursor-move"
                style={{ touchAction: 'none' }}
                onPointerDown={onMove}
            />

            {/* Maniglia Rotazione (In alto al centro) */}
            <g transform={`translate(${x + w / 2}, ${y})`} className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => {

                onHandleDown(e, 'rotate');
            }} style={{ touchAction: 'none' }}>
                <line x1={0} y1={0} x2={0} y2={-25} stroke="#3b82f6" strokeWidth={1} />
                <circle cx={0} cy={-25} r={5} fill="white" stroke="#3b82f6" strokeWidth={2} />
            </g>

            {/* Maniglia Scala (In basso a destra) */}
            <g transform={`translate(${x + w}, ${y + h})`} className="cursor-nwse-resize" onPointerDown={(e) => {

                onHandleDown(e, 'scale');
            }} style={{ touchAction: 'none' }}>
                <rect x={-6} y={-6} width={12} height={12} fill="white" stroke="#3b82f6" strokeWidth={2} />
            </g>
        </g>
    );
};

// --- COMPONENTE SELETTORE TEMA CON PREVIEW ---
// --- COMPONENTE SELETTORE TEMA CON PREVIEW ---
const ThemeSelector = ({ currentThemeId, onChange, placement = 'bottom' }: { currentThemeId: string, onChange: (id: string) => void, placement?: 'top' | 'bottom' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const current = PRESET_THEMES.find(t => t.id === currentThemeId) || PRESET_THEMES[0];
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                // FIX: Aggiunto overflow-hidden per evitare sbordi dei pallini
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors border theme-border theme-panel hover:brightness-95 overflow-hidden`}
            >
                <span className="flex items-center gap-2 truncate min-w-0">
                    {current.type === 'dark' ? <Moon size={14} className="shrink-0" /> : <Sun size={14} className="shrink-0" />}
                    <span className="truncate">{current.label}</span>
                </span>
                {/* FIX: shrink-0 per evitare che i pallini vengano schiacciati o spinti fuori */}
                <div className="flex gap-1 ml-2 shrink-0">
                    <div className="w-3 h-3 rounded-full border border-gray-500/20" style={{ background: current.colors.bgMain }} />
                    <div className="w-3 h-3 rounded-full border border-gray-500/20" style={{ background: current.colors.accent }} />
                </div>
            </button>

            {isOpen && (
                <div className={`absolute left-0 w-64 max-h-80 overflow-y-auto theme-panel border theme-border shadow-xl rounded-lg p-1 z-[100] ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                    <div className="text-[10px] font-bold opacity-50 px-2 py-1 uppercase theme-text">Seleziona Tema</div>
                    {PRESET_THEMES.map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => { onChange(theme.id); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between p-2 rounded text-xs theme-hover mb-1 ${currentThemeId === theme.id ? 'border theme-border bg-black/5 dark:bg-white/5' : ''}`}
                        >
                            <span className="font-medium theme-text">{theme.label}</span>
                            <div className="flex gap-1 shrink-0">
                                {/* Palette Preview */}
                                <div className="w-4 h-4 rounded border border-gray-500/20" style={{ background: theme.colors.bgMain }} title="Sfondo" />
                                <div className="w-4 h-4 rounded border border-gray-500/20" style={{ background: theme.colors.bgPanel }} title="Pannelli" />
                                <div className="w-4 h-4 rounded border border-gray-500/20" style={{ background: theme.colors.accent }} title="Accento" />
                                <div className="w-4 h-4 rounded border border-gray-500/20 flex items-center justify-center" style={{ background: theme.colors.bgMain }}>
                                    <span style={{ color: theme.colors.text, fontSize: '8px' }}>A</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- COMPONENTE PANNELLO PROPRIETÀ NOTA (AGGIORNATO CON PALETTE TESTO) ---
const StickyNotePropertiesPanel = ({
    note,
    onUpdate,
    onDelete
}: {
    note: StickyNoteData,
    onUpdate: (updates: Partial<StickyNoteData>) => void,
    onDelete: () => void
}) => {
    const [bgPaletteType, setBgPaletteType] = useState<keyof typeof NOTE_BG_PALETTES>('Classico');
    // Default su 'Neutri' per il testo perché contiene nero/bianco che sono i più usati
    const [textPaletteType, setTextPaletteType] = useState<keyof typeof NOTE_BG_PALETTES>('Classico');

    return (

        <div
            onPointerDown={(e) => e.stopPropagation()}
            className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b theme-border">
                <StickyNote className="text-yellow-500" />
                <span className="font-bold">Nota Adesiva</span>
            </div>

            {/* SELETTORE STILE */}
            <div className="bg-black/5 dark:bg-white/5 p-1 rounded flex text-xs font-bold mb-2">
                <button
                    onClick={() => onUpdate({ variant: 'classic' })}
                    className={`flex-1 py-1.5 rounded transition-all ${(!note.variant || note.variant === 'classic') ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'opacity-50 hover:opacity-100'}`}
                >
                    Post-it
                </button>
                <button
                    onClick={() => onUpdate({ variant: 'label' })}
                    className={`flex-1 py-1.5 rounded transition-all ${(note.variant === 'label') ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'opacity-50 hover:opacity-100'}`}
                >
                    Etichetta
                </button>
            </div>

            {/* Edit Testo */}
            <div>
                <label className="text-xs font-bold opacity-50 block mb-1">Contenuto</label>
                <textarea
                    className="w-full h-24 p-2 rounded border bg-white/50 dark:bg-black/20 theme-border text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                    style={{ fontFamily: note.fontFamily, color: note.textColor }}
                    value={note.text}
                    onChange={(e) => onUpdate({ text: e.target.value })}
                    placeholder="Scrivi qui..."
                />
            </div>

            {/* Colore Sfondo */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold opacity-50">Colore Sfondo</label>
                    <select
                        className="text-xs p-1 rounded border bg-transparent theme-border"
                        value={bgPaletteType}
                        onChange={(e) => setBgPaletteType(e.target.value as any)}
                    >
                        {Object.keys(NOTE_BG_PALETTES).map(key => <option key={key} value={key} className="text-black">{key}</option>)}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 p-2 border theme-border rounded bg-white/30 dark:bg-black/10">
                    {NOTE_BG_PALETTES[bgPaletteType].map(c => (
                        <button
                            key={c}
                            onClick={() => onUpdate({ color: c })}
                            className={`w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 transition-transform hover:scale-110 ${note.color === c ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800 scale-110' : ''}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <button
                        onClick={() => onUpdate({ color: 'transparent', opacity: 0 })}
                        className="w-6 h-6 rounded-full border border-dashed border-gray-400 flex items-center justify-center text-[8px] opacity-70 hover:opacity-100"
                        title="Trasparente"
                    >
                        /
                    </button>
                </div>
            </div>

            {/* Opacità */}
            <div>
                <label className="text-xs font-bold opacity-50 block mb-1 flex justify-between">
                    Opacità <span>{Math.round(note.opacity * 100)}%</span>
                </label>
                <input
                    type="range" min="0" max="1" step="0.05"
                    className="w-full accent-blue-500"
                    value={note.opacity}
                    onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
                />
            </div>

            <div className="h-px bg-gray-200 dark:bg-gray-700 my-2"></div>

            {/* Selezione Font */}
            <div>
                <label className="text-xs font-bold opacity-50 block mb-1">Font</label>
                <select
                    className="w-full p-2 rounded border bg-transparent theme-border text-sm"
                    value={note.fontFamily}
                    onChange={(e) => onUpdate({ fontFamily: e.target.value })}
                >
                    {NOTE_FONTS.map(f => (
                        <option key={f.value} value={f.value} className="text-black" style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                </select>
            </div>

            {/* Colore Testo (AGGIORNATO CON PALETTE) */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold opacity-50">Colore Testo</label>
                    <select
                        className="text-xs p-1 rounded border bg-transparent theme-border"
                        value={textPaletteType}
                        onChange={(e) => setTextPaletteType(e.target.value as any)}
                    >
                        {Object.keys(NOTE_BG_PALETTES).map(key => <option key={key} value={key} className="text-black">{key}</option>)}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 p-2 border theme-border rounded bg-white/30 dark:bg-black/10">
                    {NOTE_BG_PALETTES[textPaletteType].map(c => (
                        <button
                            key={c}
                            onClick={() => onUpdate({ textColor: c })}
                            className={`w-6 h-6 rounded-md border border-gray-200 dark:border-gray-600 transition-transform hover:scale-110 ${note.textColor === c ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : ''}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>

            {/* Dimensioni */}
            <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                    <label className="text-[10px] font-bold opacity-50 block">W</label>
                    <input type="number" className="w-full p-1 border rounded bg-transparent theme-border text-xs" value={note.width} readOnly />
                </div>
                <div>
                    <label className="text-[10px] font-bold opacity-50 block">H</label>
                    <input type="number" className="w-full p-1 border rounded bg-transparent theme-border text-xs" value={note.height} readOnly />
                </div>
            </div>

            <div className="pt-4 border-t theme-border mt-auto">
                <button onClick={onDelete} className="w-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 py-2 rounded text-xs hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2">
                    <Trash2 size={14} /> Elimina Nota
                </button>
            </div>
        </div>
    );
};

const StickyNoteShape = ({ note, isSelected, onPointerDown, onUpdate, zoom = 1 }: { note: StickyNoteData, isSelected: boolean, onPointerDown: (e: React.PointerEvent) => void, onUpdate: (n: StickyNoteData) => void, zoom?: number }) => {
    // Stato locale per gestire il resize
    const [resizing, setResizing] = useState<{ active: boolean, handle: string, startX: number, startY: number, startW: number, startH: number, pointerId?: number } | null>(null);

    // Gestori eventi resize globali
    useEffect(() => {
        if (!resizing || !resizing.active) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (resizing.pointerId !== undefined && e.pointerId !== undefined && resizing.pointerId !== e.pointerId) return;

            // RIMOSSO: if (e.buttons === 0) { setResizing(null); return; } // Su touch e.buttons è sempre 0!
            const dx = (e.clientX - resizing.startX) / zoom;
            const dy = (e.clientY - resizing.startY) / zoom;
            let newW = resizing.startW;
            let newH = resizing.startH;

            // Calcolo dimensioni
            if (resizing.handle.includes('e')) newW = Math.max(30, resizing.startW + dx);
            if (resizing.handle.includes('s')) newH = Math.max(30, resizing.startH + dy);

            // Scaling visivo (zoom)
            // Nota: Se usi lo zoom nella canvas, dovresti dividere dx/dy per lo zoom level qui.
            // Per ora lasciamo raw pixel movement.

            onUpdate({ ...note, width: Math.round(newW), height: Math.round(newH) });
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (resizing.pointerId !== undefined && e.pointerId !== undefined && resizing.pointerId !== e.pointerId) return;
            setResizing(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [resizing, note, onUpdate]);

    const startResize = (e: React.PointerEvent, handle: string) => {
        e.stopPropagation(); // FONDAMENTALE: Ferma il pan/box della canvas
        e.preventDefault();
        // Cattura il puntatore per fluidità (opzionale ma consigliato su touch)
        try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) { }

        setResizing({
            active: true, handle,
            startX: e.clientX, startY: e.clientY,
            startW: note.width, startH: note.height,
            pointerId: e.pointerId
        });
    };

    const ResizeHandle = ({ x, y, cursor, handle }: { x: number, y: number, cursor: string, handle: string }) => (
        <rect
            x={x - 8} y={y - 8} width={16} height={16} // Area di tocco aumentata per le dita
            fill="white" stroke="#3b82f6" strokeWidth={1}
            style={{ cursor, touchAction: 'none' }}
            onPointerDown={(e) => startResize(e, handle)} // Ura PointerDown
        />
    );

    const isLabel = note.variant === 'label';
    const borderRadius = isLabel ? 8 : 1;
    const showHelperBorder = isLabel && note.opacity === 0 && (isSelected || resizing?.active);

    return (
        <g
            transform={`translate(${note.x}, ${note.y})`}
            // Usa PointerDown invece di MouseDown
            onPointerDown={onPointerDown}
            className="cursor-move group"
        >
            {/* ... (Il resto del rendering SVG rimane identico: Ombra, Sfondo, Nastro) ... */}
            {!isLabel && (
                <rect x={3} y={3} width={note.width} height={note.height} fill="black" fillOpacity={0.15 * note.opacity} rx={2} pointerEvents="none" />
            )}

            <rect
                width={note.width} height={note.height}
                fill={note.color}
                fillOpacity={note.opacity}
                stroke={isSelected ? "#3b82f6" : (showHelperBorder ? "#ccc" : "rgba(0,0,0,0.05)")}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={showHelperBorder ? "4,2" : ""}
                rx={borderRadius}
                style={!isLabel ? { filter: `drop-shadow(0 1px 2px rgba(0,0,0,${0.1 * note.opacity}))` } : {}}
            />

            {!isLabel && (
                <rect x={0} y={0} width={note.width} height={20} fill="black" fillOpacity={0.05 * note.opacity} pointerEvents="none" />
            )}

            <foreignObject x={5} y={5} width={note.width - 10} height={note.height - 10} style={{ pointerEvents: 'none' }}>
                <div
                    className="w-full h-full text-sm whitespace-pre-wrap overflow-hidden leading-snug flex items-center justify-center"
                    style={{
                        fontFamily: note.fontFamily || 'sans-serif',
                        fontSize: '13px',
                        color: note.textColor || '#000',
                        opacity: note.opacity < 0.3 && note.textColor === '#000000' ? 1 : 0.9,
                        textAlign: isLabel ? 'center' : 'left',
                        alignItems: isLabel ? 'center' : 'flex-start',
                        display: 'flex'
                    }}
                >
                    <span className="w-full">{note.text || (isLabel ? "Etichetta" : "Nuova nota...")}</span>
                </div>
            </foreignObject>

            {isSelected && (
                <>
                    <ResizeHandle x={note.width} y={note.height / 2} cursor="ew-resize" handle="e" />
                    <ResizeHandle x={note.width / 2} y={note.height} cursor="ns-resize" handle="s" />
                    <ResizeHandle x={note.width} y={note.height} cursor="nwse-resize" handle="se" />
                </>
            )}
        </g>
    );
};

// --- AGGIORNAMENTO INTERFACCIA ---
interface ReportOptions {
    onlyPeopleWithNotes: boolean;
    // Sostituiamo showPersonalDetails con le singole voci
    showGender: boolean;          // Genere (M/F)
    showBirthDate: boolean;       // Data di nascita
    showAge: boolean;             // Età calcolata

    showClinical: boolean;
    showGroups: boolean;
    showFamily: boolean;
    showRelations: boolean;
    showNotes: boolean;
}

const ReportConfigModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (opts: ReportOptions) => void }) => {
    // Stato locale aggiornato con le nuove opzioni separate
    const [options, setOptions] = useState<ReportOptions>({
        onlyPeopleWithNotes: false,
        showGender: true,      // Default: Sì
        showBirthDate: true,   // Default: Sì
        showAge: true,         // Default: Sì
        showClinical: true,
        showGroups: true,
        showFamily: true,
        showRelations: true,
        showNotes: true
    });

    const toggle = (key: keyof ReportOptions) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-panel w-full max-w-md rounded-xl shadow-2xl border theme-border overflow-hidden">
                <div className="p-4 border-b theme-border bg-black/5 dark:bg-white/5 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 theme-text"><FileText size={18} /> Configura Report</h3>
                    <button onClick={onClose}><X size={18} className="theme-text opacity-50 hover:opacity-100" /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* SEZIONE FILTRI PERSONE (FIX COLORI DARK MODE) */}
                    {/* Usiamo classi specifiche per il testo dentro il box colorato per garantire contrasto */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 accent-blue-600 shrink-0"
                                checked={options.onlyPeopleWithNotes}
                                onChange={() => toggle('onlyPeopleWithNotes')}
                            />
                            <div>
                                <div className="font-bold text-sm text-blue-900 dark:text-blue-100">Includi solo persone con note</div>
                                <div className="text-xs text-blue-700 dark:text-blue-300 opacity-80">Esclude dal report chi non ha voci nel diario clinico.</div>
                            </div>
                        </label>
                    </div>

                    {/* SEZIONE CONTENUTI */}
                    <div>
                        <div className="text-xs font-bold uppercase opacity-50 mb-3 theme-text">Dati Anagrafici</div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showGender} onChange={() => toggle('showGender')} className="accent-[var(--theme-accent)]" />
                                <span>Genere</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showBirthDate} onChange={() => toggle('showBirthDate')} className="accent-[var(--theme-accent)]" />
                                <span>Data Nascita</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showAge} onChange={() => toggle('showAge')} className="accent-[var(--theme-accent)]" />
                                <span>Età</span>
                            </label>
                        </div>

                        <div className="text-xs font-bold uppercase opacity-50 mb-3 theme-text">Altri Contenuti</div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showClinical} onChange={() => toggle('showClinical')} className="accent-[var(--theme-accent)]" />
                                <span>Marcatori Clinici (Simboli, Deceduto, ecc)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showGroups} onChange={() => toggle('showGroups')} className="accent-[var(--theme-accent)]" />
                                <span>Appartenenza a Gruppi</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showFamily} onChange={() => toggle('showFamily')} className="accent-[var(--theme-accent)]" />
                                <span>Legami Familiari (Partner, Genitori, Figli)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showRelations} onChange={() => toggle('showRelations')} className="accent-[var(--theme-accent)]" />
                                <span>Altre Relazioni (Amicizie, Conflitti, ecc.)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer theme-text text-sm">
                                <input type="checkbox" checked={options.showNotes} onChange={() => toggle('showNotes')} className="accent-[var(--theme-accent)]" />
                                <span>Diario Clinico / Note</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t theme-border bg-black/5 dark:bg-white/5 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded hover:bg-black/10 dark:hover:bg-white/10 theme-text">Annulla</button>
                    <button onClick={() => onConfirm(options)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow-sm flex items-center gap-2">
                        <FileText size={16} /> Genera PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- APP COMPONENT ---

export default function GenogramApp() {
    // --- 1. DEFINIZIONE RIFERIMENTI (Tutti in alto, PRIMA di usarli) ---
    const svgRef = useRef<SVGSVGElement>(null);
    const groupRef = useRef<SVGGElement>(null); // <--- Fondamentale per le coordinate
    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef({ clientX: 0, clientY: 0 }); // Posizione mouse grezza
    const isZoomingRef = useRef(false); // <--- NUOVO REF
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    const [touchDist, setTouchDist] = useState<number | null>(null);
    const longPressTimer = useRef<any>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, gx: number, gy: number } | null>(null);
    const [showHelp, setShowHelp] = useState(false);


    // --- 2. STATO SINCRONIZZAZIONE ---
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
    const isRemoteUpdate = useRef(false);

    // --- 3. DATI DASHBOARD (Quelli che mancavano) ---
    const [genograms, setGenograms] = useState<GenogramMeta[]>([]);
    const [categories, setCategories] = useState<CategoryDef[]>(() => {
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

    const pushState = useCallback((n: GenNode[], e: RelationEdge[], g: NodeGroup[], s: any[]) => {
        const stateStr = JSON.stringify({ nodes: n, edges: e, groups: g, stickyNotes: s });
        setHistory(prev => {
            const upToCurrent = prev.slice(0, historyIndex + 1);
            return [...upToCurrent, stateStr];
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const updateNodes = (newNodes: GenNode[] | ((prev: GenNode[]) => GenNode[])) => {
        const resolved = typeof newNodes === 'function' ? newNodes(nodes) : newNodes;
        setNodes(resolved);
        pushState(resolved, edges, groups);
    };
    const updateEdges = (newEdges: RelationEdge[] | ((prev: RelationEdge[]) => RelationEdge[])) => {
        const resolved = typeof newEdges === 'function' ? newEdges(edges) : newEdges;
        setEdges(resolved);
        pushState(nodes, resolved, groups);
    };
    const updateGroups = (newGroups: NodeGroup[] | ((prev: NodeGroup[]) => NodeGroup[])) => {
        const resolved = typeof newGroups === 'function' ? newGroups(groups) : newGroups;
        setGroups(resolved);
        pushState(nodes, edges, resolved);
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
        if (historyIndex > 0) {
            const prevIdx = historyIndex - 1;
            const state = JSON.parse(history[prevIdx]);
            setNodes(state.nodes);
            setEdges(state.edges);
            setGroups(state.groups);
            setHistoryIndex(prevIdx);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const nextIdx = historyIndex + 1;
            const state = JSON.parse(history[nextIdx]);
            setNodes(state.nodes);
            setEdges(state.edges);
            setGroups(state.groups);
            setHistoryIndex(nextIdx);
        }
    };

    useEffect(() => {
        if (history.length === 0 && view === 'editor') {
            pushState(nodes, edges, groups);
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
    const [boxSelection, setBoxSelection] = useState<any>(null);
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
                capHandle = await CapacitorApp.addListener('backButton', async (info) => {
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
        const handlePopState = async (e: PopStateEvent) => {
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


    // 2. AUTOSAVE INTELLIGENTE
    useEffect(() => {
        if (view !== 'editor') return;

        // Se manca auth o db, siamo OFFLINE
        if (!user || !db || !currentGenId) {
            setSyncStatus('offline');
            return;
        }

        if (isRemoteUpdate.current) {
            isRemoteUpdate.current = false;
            return;
        }

        const pathPart = customUser ? customUser : user.uid;
        // Se non c'è un percorso valido, errore
        if (!pathPart) { setSyncStatus('error'); return; }

        setSyncStatus('syncing');

        const saveData = async () => {
            try {
                const docRef = doc(db, 'artifacts', appId, 'users', pathPart, 'genograms', currentGenId);
                await setDoc(docRef, {
                    id: currentGenId,
                    title: metaTitle,
                    category: metaCategory,
                    lastModified: Date.now(),
                    data: { nodes, edges, groups, presets: customPresets, stickyNotes }
                }, { merge: true });

                setSyncStatus('synced');
            } catch (err) {
                console.error("Errore Salvataggio:", err);
                setSyncStatus('error');
            }
        };

        const timeoutId = setTimeout(saveData, 1500);
        return () => clearTimeout(timeoutId);

    }, [nodes, edges, groups, metaTitle, metaCategory, customPresets, customUser, user, db, view, currentGenId]);

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
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); return; }

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
            if ((e.key === 'Backspace' || e.key === 'Delete') && (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0)) {
                if (confirm("Eliminare gli elementi selezionati?")) {
                    let newNodes = nodesRef.current.filter(n => !selectedNodeIds.includes(n.id));
                    let newEdges = edgesRef.current.filter(ed => !selectedNodeIds.includes(ed.fromId) && !selectedNodeIds.includes(ed.toId) && !selectedEdgeIds.includes(ed.id));
                    let newGroups = groupsRef.current.filter(g => !selectedGroupIds.includes(g.id));
                    let newNotes = stickyNotes.filter(n => !selectedNoteIds.includes(n.id)); // <--- Filtra Note
                    updateAll(newNodes, newEdges, newGroups, newNotes);
                    setSelectedNodeIds([]); setSelectedEdgeIds([]); setSelectedGroupIds([]); setSelectedNoteIds([]);
                }
            }

            if (e.key === 'Esc' || e.key === 'Escape') {
                setSelectedNodeIds([]); setSelectedEdgeIds([]); setSelectedGroupIds([]); setQuickMenu(null);
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
    }, [selectedNodeIds, selectedEdgeIds, selectedGroupIds, historyIndex, history, zoom]);

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
                dragRef.current = { active: false, ...dragRef.current };
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

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); // Blocca menu nativo Android

        // Ferma qualsiasi drag iniziato erroneamente al "down"
        if (dragRef.current) {
            dragRef.current.active = false;
            setDragState(null);
        }

        const { x, y } = getGraphCoordinates(e.clientX, e.clientY);
        setContextMenu({ x: e.clientX, y: e.clientY, gx: x, gy: y });
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

            const { currX, currY, startX, startY, clientStartX, clientStartY, initialScrollLeft, initialScrollTop } = dragRef.current;
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
                    const initialPad = dragRef.current.initialPadding || 20;
                    const newPad = Math.max(10, initialPad + Math.max(dx, dy));
                    setGroups(prev => prev.map(g => g.id === dragRef.current.sourceId ? { ...g, customPadding: newPad } : g));
                } else if (dragRef.current.type === 'group-label') {
                    const dx = x - startX;
                    const dy = y - startY;
                    const initial = dragRef.current.initialNodePositions?.[dragRef.current.sourceId];
                    if (initial) {
                        setGroups(prev => prev.map(g => g.id === dragRef.current.sourceId ? { ...g, labelPos: { x: initial.x + dx, y: initial.y + dy } } : g));
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
            }, (err) => {
                console.error("Dashboard offline, uso cache locale");
                setGenograms(enrichedLocalList);
            });
            return () => u();
        } catch (e) {
            setGenograms(enrichedLocalList);
        }
    }, [user, db, customUser]);

    // Auto-Save Effect Multi-Platform (Sostituisce HandleSave Base)
    useEffect(() => {
        if (!currentGenId) return;

        // Non avviamo il salvataggio al primo avvio se il grafico è vuoto
        if (nodes.length === 0 && edges.length === 0 && historyIndex <= 0) return;

        const timer = setTimeout(() => {
            const dataToSave = {
                id: currentGenId,
                title: metaTitle,
                category: metaCategory,
                lastModified: Date.now(),
                data: { nodes, edges, groups, presets: customPresets, stickyNotes }
            };

            // 1. Salva draft locale (Real-Time persistenza invisibile per non perdere nulla offline)
            localStorage.setItem(`genopro_data_${currentGenId}`, JSON.stringify(dataToSave));

            // 2. Aggiorna indice locale (necessario per visualizzarlo nella dashboard offiline)
            const localIndexStr = localStorage.getItem('genopro_local_index');
            let localList: GenogramMeta[] = localIndexStr ? JSON.parse(localIndexStr) : [];
            const existingIdx = localList.findIndex((x) => x.id === currentGenId);
            if (existingIdx >= 0) {
                localList[existingIdx] = dataToSave;
            } else {
                localList.push(dataToSave);
            }
            localStorage.setItem('genopro_local_index', JSON.stringify(localList));

            // 3. Salva su Firebase se online
            if (user && db && syncStatus !== 'offline') {
                const pathPart = customUser ? customUser : user.uid;
                setSyncStatus('syncing');
                setDoc(doc(db, 'artifacts', appId, 'users', pathPart, 'genograms', currentGenId), dataToSave)
                    .then(() => setSyncStatus('synced'))
                    .catch(() => setSyncStatus('error'));
            } else {
                setSyncStatus('offline');
            }
        }, 1500); // Debounce 1.5s

        return () => clearTimeout(timer);
    }, [nodes, edges, groups, stickyNotes, currentGenId, metaTitle, metaCategory, customPresets, user, db, customUser]);

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
        setTimeout(() => {
            // Includi le note nello stato iniziale della storia
            const initialState = JSON.stringify({ nodes: newNodes, edges: newEdges, groups: newGroups, stickyNotes: newNotes });
            setHistory([initialState]);
            setHistoryIndex(0);
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
    const addParentsToSelection = () => {
        if (selectedNodeIds.length !== 1) return alert("Seleziona una persona");
        const srcId = selectedNodeIds[0];
        const srcNode = nodes.find(n => n.id === srcId);
        if (!srcNode) return;
        const fId = generateId(); const mId = generateId();
        const f = { id: fId, x: srcNode.x - 80, y: srcNode.y - 150, gender: 'M', name: 'Padre', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
        const m = { id: mId, x: srcNode.x + 80, y: srcNode.y - 150, gender: 'F', name: 'Madre', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
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
        const newN = { id: nId, x: srcNode.x + 120, y: srcNode.y, gender: srcNode.gender === 'M' ? 'F' : 'M', name: 'Partner', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
        const newE = { id: generateId(), fromId: srcId, toId: nId, type: 'marriage', label: '', notes: [] };
        updateAll([...nodes, newN as GenNode], [...edges, newE], groups);
        setSelectedNodeIds([nId]);
    };
    const addChildToSelection = () => {
        if (selectedEdgeIds.length === 1) {
            const edge = edges.find(e => e.id === selectedEdgeIds[0]);
            if (edge && RELATION_CATEGORIES["Struttura"].includes(edge.type)) {
                const p1 = nodes.find(n => n.id === edge.fromId); const p2 = nodes.find(n => n.id === edge.toId);
                if (!p1 || !p2) return;
                const nId = generateId();
                const newN = { id: nId, x: (p1.x + p2.x) / 2, y: Math.max(p1.y, p2.y) + 150, gender: 'Unknown', name: 'Figlio', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
                const e1 = { id: generateId(), fromId: edge.fromId, toId: nId, type: 'child-bio', label: '', notes: [] }; const e2 = { id: generateId(), fromId: edge.toId, toId: nId, type: 'child-bio', label: '', notes: [] };
                updateAll([...nodes, newN as GenNode], [...edges, e1, e2], groups); setSelectedNodeIds([nId]); setSelectedEdgeIds([]); return;
            }
        }
        if (selectedNodeIds.length === 1) {
            const srcId = selectedNodeIds[0]; const srcNode = nodes.find(n => n.id === srcId); if (!srcNode) return;
            const marriage = findMarriageEdge(srcId, edges); const nId = generateId();
            const newN = { id: nId, x: srcNode.x, y: srcNode.y + 150, gender: 'Unknown', name: 'Figlio', birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] };
            const newEdgesList = [{ id: generateId(), fromId: srcId, toId: nId, type: 'child-bio', label: '', notes: [] }];
            if (marriage) { const spouseId = marriage.fromId === srcId ? marriage.toId : marriage.fromId; newEdgesList.push({ id: generateId(), fromId: spouseId, toId: nId, type: 'child-bio', label: '', notes: [] }); }
            updateAll([...nodes, newN as GenNode], [...edges, ...newEdgesList], groups); setSelectedNodeIds([nId]);
        } else { alert("Seleziona una coppia o un genitore"); }
    };


    // --- FINE NUOVO CODICE ---



    // --- AUTO LAYOUT V33 (Physics Relaxation & Constraint Solver) ---
    const autoLayout = () => {
        const scopeNodes = selectedNodeIds.length > 0 ? nodes.filter(n => selectedNodeIds.includes(n.id)) : nodes;
        if (scopeNodes.length === 0) return;

        const allNodes = JSON.parse(JSON.stringify(nodes)) as GenNode[];
        const nodeMap = new Map(allNodes.map(n => [n.id, n]));

        // Costanti
        const LEVEL_H = 180;
        const NODE_W = 60;
        const SPOUSE_GAP = 80;     // Distanza fissa tra partner
        const MIN_NODE_GAP = 100;  // Distanza minima tra persone diverse
        const ITERATIONS = 250;    // Numero cicli di simulazione

        // --- HELPERS ---
        const getSpouses = (id: string) => edges
            .filter(e => (e.fromId === id || e.toId === id) && RELATION_CATEGORIES["Struttura"].includes(e.type))
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
            if (generations.get(id)! !== -1) return generations.get(id)!;
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

    const centerView = () => { setZoom(1); if (containerRef.current) { containerRef.current.scrollTo({ left: CENTER_POS - containerRef.current.clientWidth / 2, top: CENTER_POS - containerRef.current.clientHeight / 2, behavior: 'smooth' }); } };

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
            const legWidth = 220; // Larghezza fissa legenda

            // Stima altezza legenda
            const usedGenders = new Set(nodes.map(n => n.gender)).size + (nodes.some(n => n.deceased) ? 1 : 0) + (nodes.some(n => n.indexPerson) ? 1 : 0);
            const usedRels = new Set(edges.map(e => e.type)).size;
            const estimatedH = 80 + (Math.max(usedGenders, usedRels) * 24) + 20;

            // Posiziona legenda: a sinistra del contenuto, allineata in alto
            // Aggiungiamo un margine di 50px tra la legenda e il grafico
            const legX = minX - legWidth - 50;
            const legY = minY;

            minX = Math.min(minX, legX);
            minY = Math.min(minY, legY);
            maxX = Math.max(maxX, minX + legWidth + (maxX - minX)); // Estendi a destra se serve (raro)
            maxY = Math.max(maxY, legY + estimatedH);
        }

        const padding = 100;
        return { x: minX - padding, y: minY - padding, w: (maxX - minX) + padding * 2, h: (maxY - minY) + padding * 2 };
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
            const spouses = edges.filter(e => (e.fromId === n.id || e.toId === n.id) && RELATION_CATEGORIES["Struttura"].includes(e.type))
                .map(e => { const partnerId = e.fromId === n.id ? e.toId : e.fromId; const p = nodes.find(x => x.id === partnerId); const conf = BASE_REL_CONFIG[e.type]; return p ? `<b>${p.name}</b> (${conf.label})` : null; }).filter(Boolean).join(', ');

            const children = edges.filter(e => e.fromId === n.id && e.type.startsWith('child'))
                .map(e => { const c = nodes.find(x => x.id === e.toId); return c ? c.name : null; }).filter(Boolean).join(', ');

            const others = edges.filter(e => (e.fromId === n.id || e.toId === n.id) && !RELATION_CATEGORIES["Struttura"].includes(e.type) && !e.type.startsWith('child'))
                .map(e => { const otherId = e.fromId === n.id ? e.toId : e.fromId; const otherNode = nodes.find(x => x.id === otherId); const otherGroup = !otherNode ? groups.find(g => g.id === otherId) : null; const name = otherNode ? otherNode.name : (otherGroup ? `Gruppo: ${otherGroup.label}` : 'Sconosciuto'); const conf = BASE_REL_CONFIG[e.type] || { label: e.type }; return `<li>${conf.label} con <b>${name}</b>${e.notes.length ? ` (Note: ${e.notes.map(x => x.text).join('; ')})` : ''}</li>`; }).join('');

            const userGroups = groups.filter(g => g.memberIds.includes(n.id)).map(g => g.label).join(', ');

            // --- NUOVA LOGICA DETTAGLI ANAGRAFICI ---
            let detailsParts = [];
            if (options.showGender) detailsParts.push(n.gender);
            if (options.showBirthDate && n.birthDate) detailsParts.push(n.birthDate);
            if (options.showAge && n.birthDate) detailsParts.push(`${calculateAge(n.birthDate)} anni`);

            const detailsString = detailsParts.length > 0 ? `<small style="font-weight:normal; color:#666;">(${detailsParts.join(', ')})</small>` : '';

            // --- COSTUZIONE HTML ---
            let clinicalInfo = [];
            if (n.deceased) clinicalInfo.push("Deceduto");
            if (n.indexPerson) clinicalInfo.push("Paziente Designato");
            if (n.substanceAbuse) clinicalInfo.push("Abuso Sostanze");
            if (n.mentalIssue) clinicalInfo.push("Problema Psicologico");
            if (n.physicalIssue) clinicalInfo.push("Problema Fisico");
            if (n.gayLesbian) clinicalInfo.push("Omosessuale");

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
                let midX = 15;
                let midY = 7;

                const hasEndArrow = (config.renderType.includes('arrow') && !config.renderType.includes('center') && config.renderType !== 'double-arrow-inward') || config.renderType === 'triple-zigzag-center-arrow';
                if (hasEndArrow) actualEndX -= 6;

                let pathD = `M 0 7 L ${actualEndX} 7`;
                if (config.lineStyle.startsWith('zigzag')) pathD = getZigZagPath(0, 7, actualEndX, 7, 3, 8);

                const strokeDash = config.lineStyle === 'dashed' ? 'stroke-dasharray="4,2"' : (config.lineStyle === 'dotted' ? 'stroke-dasharray="1,2"' : '');
                const strokeW = config.lineStyle.startsWith('zigzag') ? "1.5" : "2";

                let baseHtml = '';
                if (config.type !== 'best-friend') {
                    baseHtml = `<path d="${pathD}" stroke="${color}" stroke-width="${strokeW}" ${strokeDash} fill="none" />`;
                }

                if (config.renderType === 'fusion' || config.renderType === 'triple') baseHtml += `<g><path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, 3)" fill="none"/><path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, -3)" fill="none"/></g>`;
                if (config.renderType === 'double' || config.renderType === 'double-zigzag' || config.renderType === 'best-friend') baseHtml += `<path d="${pathD}" stroke="${color}" stroke-width="1" transform="translate(0, 3)" fill="none" ${strokeDash}/>`;

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

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (Array.isArray(data)) { setGenograms(prev => [...prev, ...data]); alert("Importazione completata!"); } } catch (err) { alert("Errore file"); } }; reader.readAsText(file); };
    const handleExportBackup = () => { const blob = new Blob([JSON.stringify(genograms)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_genopro.json`; a.click(); };

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
                                            setCustomPresets(g.data.presets || []);
                                            resetEditorState(g.data.nodes || [], g.data.edges || [], g.data.groups || [], g.data.stickyNotes || []);
                                            setView('editor');
                                        }} className="group relative theme-panel rounded-xl shadow-sm hover:shadow-md transition-all border theme-border cursor-pointer overflow-hidden flex flex-col h-48">
                                            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: catDef.color }} />
                                            <div className="p-5 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: catDef.color }}>
                                                        <Icon size={12} /> {catDef.label}
                                                    </div>
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm("Eliminare?")) {
                                                            if (db) deleteDoc(doc(db, 'artifacts', appId, 'users', customUser || user?.uid || 'anon', 'genograms', g.id));
                                                            localStorage.removeItem(`genopro_data_${g.id}`);
                                                            const idxStr = localStorage.getItem('genopro_local_index');
                                                            if (idxStr) {
                                                                const lst = JSON.parse(idxStr).filter((x: any) => x.id !== g.id);
                                                                localStorage.setItem('genopro_local_index', JSON.stringify(lst));
                                                                setGenograms(prev => prev.filter(x => x.id !== g.id));
                                                            }
                                                        }
                                                    }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                                </div>
                                                <h3 className="text-lg font-bold mb-1 line-clamp-2 theme-text">{g.title}</h3>
                                                <div className="mt-auto pt-4 flex items-center justify-between text-xs opacity-60 border-t theme-border">
                                                    <span>{new Date(g.lastModified).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1"><Users size={12} /> {g.data.nodes?.length || 0}</span>
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
                        <button onClick={addStickyNoteAtCursor} title="Aggiungi Nota (N)" className="p-1.5 theme-hover rounded shrink-0" style={{ color: '#f59e0b' }}>
                            <StickyNote size={20} />
                        </button>

                        <div className="h-4 w-px bg-gray-300 opacity-30 mx-1 shrink-0" />
                        <button onClick={autoLayout} className="p-1.5 theme-hover rounded shrink-0" style={{ color: 'var(--theme-accent)' }} title="Auto-Layout"><Network size={18} /></button>
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
                                    const { d: pathD, cx, cy } = geom;

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
                                    <input className="w-full border p-1 rounded bg-transparent theme-border" value={selectedNode.birthDate} onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, birthDate: e.target.value } : n))} placeholder="Nascita (Data, Anno o inserisci direttamente un'Età)" />

                                    <div className="flex items-center gap-2 mb-1">
                                        <input
                                            type="checkbox"
                                            id="showAge"
                                            checked={selectedNode.showAge !== false}
                                            onChange={e => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, showAge: e.target.checked } : n))}
                                        />
                                        <label htmlFor="showAge" className="text-xs opacity-70">Mostra Età</label>
                                    </div>
                                    <div className="text-xs opacity-50">Età: {calculateAge(selectedNode.birthDate)}</div>

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
                                    </div>

                                    <NotesPanel notes={selectedNode.notes} onChange={newNotes => updateNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, notes: newNotes } : n))} />

                                    <button onClick={() => { updateNodes(nodes.filter(n => !selectedNodeIds.includes(n.id))); updateEdges(edges.filter(e => !selectedNodeIds.includes(e.fromId) && !selectedNodeIds.includes(e.toId))); setSelectedNodeIds([]); }} className="w-full bg-red-100 text-red-600 py-2 rounded text-xs hover:bg-red-200 mt-4 flex items-center justify-center gap-2"><Trash2 size={14} /> Elimina Persona</button>
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
                                        updateEdges(prev => prev.map(ed => ed.id === selectedEdge.id ? { ...ed, type: t, color: conf.color, lineStyle: conf.lineStyle, decorator: conf.decorator } : ed));
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
