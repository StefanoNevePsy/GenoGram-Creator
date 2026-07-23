// --- MAPPE STRUTTURALI DI MINUCHIN ---
// Due stili di mappa:
//  - 'grid': fasce gerarchiche esplicite (4 livelli), confini di livello cliccabili
//  - 'minimal': schizzo compatto in stile terapeuta — canvas piccolo, posizionamento
//    libero (anche verticale), confini orizzontali E verticali trascinabili
// Tematizzazione: i colori arrivano CONCRETI via prop `theme` (servono anche
// all'export PNG e al report, dove le variabili CSS non esistono).
// In più: miniature read-only (manager), confronto T0/T1 affiancato, creazione
// da gruppo household, overlay delle relazioni sul canvas del genogramma,
// SVG stringa per il report clinico stampabile.

import { useState, useRef } from 'react';
import { X, Plus, Trash2, Download, SeparatorVertical, SeparatorHorizontal, UserPlus, Eye, EyeOff, Columns } from 'lucide-react';
import type { GenNode, RelationEdge, NodeGroup, Gender, StructuralMap, MinuchinRelation, MinuchinRelationType, BoundaryStyle } from '../types';
import type { AppTheme } from '../config/themes';
import { generateId } from '../utils/genogram';
import { extractYear } from '../utils/dates';
import { getZigZagPath } from '../utils/geometry';
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';
import { PersonSymbol } from './canvas';

const CONFLICT = '#dc2626';
const LEVELS = 4;

// Dimensioni per stile
const DIMS = {
    grid: { W: 880, H: 14 + LEVELS * 128 + 6, band: 128, sym: 40 },
    minimal: { W: 560, H: 400, band: 0, sym: 28 },
};
const mapStyle = (m: StructuralMap) => m.style ?? 'grid';
const dims = (m: StructuralMap) => DIMS[mapStyle(m)];
const bandTop = (level: number) => 14 + level * DIMS.grid.band;
const gridCY = (level: number) => bandTop(level) + DIMS.grid.band / 2 - 10;
// Centro y di un membro: y libera in minimal, fascia in grid
const memberCY = (m: StructuralMap, p: { level: number, y?: number }) =>
    mapStyle(m) === 'minimal' ? (p.y ?? DIMS.minimal.H / 2) : gridCY(p.level);

// --- SEGMENTAZIONE CONFINI ---
// Un confine si spezza dove lo attraversa un confine perpendicolare: ogni
// segmento (delimitato da due intersezioni consecutive o dal bordo) può avere
// uno stile proprio. Così: diffuso madre-figlio + rigido padre-figlio sulla
// stessa linea orizzontale, divisi dalla verticale tra i genitori.
export interface Segment { i: number; a: number; b: number; along: number; style: BoundaryStyle; }

const vbCrossings = (m: StructuralMap, W: number): number[] =>
    (m.vBoundaries || []).map(v => v.x).filter(x => x > 12 && x < W - 12).sort((p, q) => p - q);
// Attraversamenti orizzontali di una verticale: confini liberi + (in grid) le righe di livello
const hbCrossings = (m: StructuralMap, H: number): number[] => {
    const ys = (m.hBoundaries || []).map(h => h.y);
    if (mapStyle(m) === 'grid') for (let l = 0; l < LEVELS - 1; l++) if ((m.boundaries[l] ?? 'none') !== 'none') ys.push(bandTop(l + 1));
    return ys.filter(y => y > 10 && y < H - 10).sort((p, q) => p - q);
};
export const segmentsOf = (m: StructuralMap, kind: 'hb' | 'vb', b: { y?: number, x?: number, style: BoundaryStyle, segStyles?: Record<number, BoundaryStyle> }, W: number, H: number): Segment[] => {
    const cuts = kind === 'hb' ? vbCrossings(m, W) : hbCrossings(m, H);
    const lo = kind === 'hb' ? 10 : 8, hi = kind === 'hb' ? W - 10 : H - 8;
    const bounds = [lo, ...cuts, hi];
    const along = (kind === 'hb' ? b.y : b.x) ?? 0;
    return bounds.slice(0, -1).map((a, i) => ({ i, a, b: bounds[i + 1], along, style: b.segStyles?.[i] ?? b.style }));
};

const TOOLS: { key: MinuchinRelationType, label: string, needsThird: boolean }[] = [
    { key: 'alliance', label: 'Alleanza', needsThird: false },
    { key: 'overinvolvement', label: 'Invischiamento', needsThird: false },
    { key: 'conflict', label: 'Conflitto', needsThird: false },
    { key: 'coalition', label: 'Coalizione', needsThird: true },
    { key: 'detouring', label: 'Deviazione', needsThird: true },
];

const BOUNDARY_CYCLE: BoundaryStyle[] = ['clear', 'diffuse', 'rigid', 'none'];
const BOUNDARY_LABEL: Record<BoundaryStyle, string> = { clear: 'chiaro', diffuse: 'diffuso', rigid: 'rigido', none: 'nessuno' };
const boundaryDash = (b: BoundaryStyle) => b === 'clear' ? '12,7' : b === 'diffuse' ? '2,5' : undefined;

const RelPreview = ({ type, stroke }: { type: MinuchinRelationType, stroke: string }) => (
    <svg width={34} height={14} className="shrink-0">
        {type === 'alliance' && <line x1={2} y1={7} x2={32} y2={7} stroke={stroke} strokeWidth={1.5} />}
        {type === 'overinvolvement' && <g><line x1={2} y1={5} x2={32} y2={5} stroke={stroke} strokeWidth={1.5} /><line x1={2} y1={9} x2={32} y2={9} stroke={stroke} strokeWidth={1.5} /></g>}
        {type === 'conflict' && <path d={getZigZagPath(2, 7, 32, 7, 3, 7)} stroke={CONFLICT} strokeWidth={1.5} fill="none" />}
        {type === 'coalition' && <g><line x1={2} y1={4} x2={32} y2={4} stroke={stroke} strokeWidth={1.5} /><line x1={2} y1={8} x2={32} y2={8} stroke={stroke} strokeWidth={1.5} /><path d={getZigZagPath(17, 8, 17, 14, 2, 4)} stroke={CONFLICT} strokeWidth={1.2} fill="none" /></g>}
        {type === 'detouring' && <g><path d={getZigZagPath(2, 5, 32, 5, 3, 7)} stroke={CONFLICT} strokeWidth={1.5} fill="none" /><line x1={17} y1={5} x2={17} y2={11} stroke={CONFLICT} strokeWidth={1.2} /><polygon points="14,10 20,10 17,14" fill={CONFLICT} /></g>}
    </svg>
);

const REL_TO_MINUCHIN: Record<string, MinuchinRelationType> = {
    'fusion': 'overinvolvement', 'close': 'overinvolvement',
    'hostile': 'conflict', 'hate': 'conflict', 'close-hostile': 'conflict', 'fusion-hostile': 'conflict',
    'harmony': 'alliance', 'friendship': 'alliance', 'best-friend': 'alliance', 'in-love': 'alliance',
};

export const createMapFromSelection = (members: GenNode[], edges: RelationEdge[], label: string, style: 'grid' | 'minimal' = 'grid'): StructuralMap => {
    const years = members.map(m => extractYear(m.birthDate || ''));
    const known = years.filter(y => y > 0);
    const minYear = known.length ? Math.min(...known) : 0;
    const positions: StructuralMap['positions'] = {};
    const counters: Record<number, number> = {};
    const stepX = style === 'minimal' ? 100 : 150;
    members.forEach((m, i) => {
        const y = years[i];
        const level = (minYear && y > 0 && y - minYear > 16) ? 1 : 0;
        const idx = counters[level] || 0;
        counters[level] = idx + 1;
        positions[m.id] = {
            x: (style === 'minimal' ? 60 : 70) + idx * stepX,
            level,
            ...(style === 'minimal' ? { y: 90 + level * 160 } : {})
        };
    });
    const memberSet = new Set(members.map(m => m.id));
    const relations: MinuchinRelation[] = edges
        .filter(e => memberSet.has(e.fromId) && memberSet.has(e.toId) && REL_TO_MINUCHIN[e.type])
        .map(e => ({ id: generateId(), fromId: e.fromId, toId: e.toId, type: REL_TO_MINUCHIN[e.type] }));
    return {
        id: generateId(), label, style, memberIds: members.map(m => m.id), positions,
        boundaries: style === 'grid' ? { 0: 'clear' } : {},
        vBoundaries: [], hBoundaries: style === 'minimal' ? [{ id: generateId(), y: DIMS.minimal.H / 2, style: 'clear' }] : [],
        relations, notes: []
    };
};

const RelationGlyph = ({ rel, pt, stroke, onClick, selected, accent }: {
    rel: MinuchinRelation,
    pt: (id: string) => { x: number, y: number } | null,
    stroke: string, accent: string, onClick?: () => void, selected?: boolean
}) => {
    const a = pt(rel.fromId); const b = pt(rel.toId);
    if (!a || !b) return null;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const col = selected ? accent : (rel.type === 'conflict' || rel.type === 'detouring' ? CONFLICT : stroke);
    const hit = <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16} />;
    const dbl = (off: number) => {
        const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * off, ny = dx / len * off;
        return <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} stroke={col} strokeWidth={1.6} />;
    };
    let body = null;
    if (rel.type === 'alliance') body = <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={1.6} />;
    if (rel.type === 'overinvolvement') body = <g>{dbl(2.6)}{dbl(-2.6)}</g>;
    if (rel.type === 'conflict') body = <path d={getZigZagPath(a.x, a.y, b.x, b.y, 4, 10)} stroke={col} strokeWidth={1.6} fill="none" />;
    if (rel.type === 'coalition' || rel.type === 'detouring') {
        const c = rel.thirdId ? pt(rel.thirdId) : null;
        const toC = c ? (rel.type === 'coalition'
            ? <path d={getZigZagPath(mid.x, mid.y, c.x, c.y, 4, 10)} stroke={CONFLICT} strokeWidth={1.6} fill="none" />
            : <g>
                <line x1={mid.x} y1={mid.y} x2={c.x} y2={c.y} stroke={CONFLICT} strokeWidth={1.6} />
                <polygon points="-7,-4.5 4,0 -7,4.5" fill={CONFLICT} transform={`translate(${c.x},${c.y}) rotate(${Math.atan2(c.y - mid.y, c.x - mid.x) * 180 / Math.PI}) translate(-26,0)`} />
            </g>) : null;
        body = <g>
            {rel.type === 'coalition' ? <g>{dbl(2.6)}{dbl(-2.6)}</g> : <path d={getZigZagPath(a.x, a.y, b.x, b.y, 4, 10)} stroke={col} strokeWidth={1.6} fill="none" />}
            {toC}
        </g>;
    }
    return <g onClick={onClick} className={onClick ? 'cursor-pointer' : undefined}>{onClick && hit}{body}</g>;
};

// --- SCENA READ-ONLY (miniature e confronto) ---
export const MapThumb = ({ map, nodes, darkMode, theme, width = 220 }: {
    map: StructuralMap, nodes: GenNode[], darkMode: boolean, theme: AppTheme, width?: number
}) => {
    const c = theme.colors;
    const d = dims(map);
    const isMin = mapStyle(map) === 'minimal';
    const members = map.memberIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GenNode[];
    const pos = (id: string) => map.positions[id] || { x: 60, level: 0 };
    const center = (id: string) => map.positions[id] ? { x: pos(id).x, y: memberCY(map, pos(id)) } : null;
    const sc = d.sym / NODE_WIDTH;
    return (
        <svg viewBox={`0 0 ${d.W} ${d.H}`} width={width} className="rounded-lg border" style={{ backgroundColor: c.bgMain, borderColor: c.border }}>
            {!isMin && Array.from({ length: LEVELS }, (_, l) => l % 2 === 1 && <rect key={l} x={0} y={bandTop(l)} width={d.W} height={d.band} fill={c.text} opacity={0.035} />)}
            {!isMin && Array.from({ length: LEVELS - 1 }, (_, l) => {
                const st = map.boundaries[l] ?? 'none';
                if (st === 'none') return null;
                const y = bandTop(l + 1);
                return <line key={l} x1={14} y1={y} x2={d.W - 14} y2={y} stroke={c.text} strokeWidth={st === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(st)} strokeLinecap="round" />;
            })}
            {(map.hBoundaries || []).flatMap(hb => segmentsOf(map, 'hb', hb, d.W, d.H).filter(s => s.style !== 'none').map(s => <line key={hb.id + s.i} x1={s.a} y1={s.along} x2={s.b} y2={s.along} stroke={c.text} strokeWidth={s.style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(s.style)} strokeLinecap="round" />))}
            {(map.vBoundaries || []).flatMap(vb => segmentsOf(map, 'vb', vb, d.W, d.H).filter(s => s.style !== 'none').map(s => <line key={vb.id + s.i} x1={s.along} y1={s.a} x2={s.along} y2={s.b} stroke={c.text} strokeWidth={s.style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(s.style)} strokeLinecap="round" />))}
            {map.relations.map(r => <RelationGlyph key={r.id} rel={r} pt={center} stroke={c.text} accent={c.accent} />)}
            {members.map(n => {
                const p = pos(n.id); const cy = memberCY(map, p);
                return (
                    <g key={n.id} transform={`translate(${p.x},${cy})`}>
                        <g transform={`translate(${-d.sym / 2},${-d.sym / 2}) scale(${sc})`}><PersonSymbol node={n} darkMode={darkMode} /></g>
                        <text y={d.sym / 2 + 12} textAnchor="middle" fontSize={isMin ? 9 : 10.5} fontWeight={600} fill={c.text}>{n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name}</text>
                    </g>
                );
            })}
        </svg>
    );
};

// --- OVERLAY DELLE RELAZIONI SUL CANVAS DEL GENOGRAMMA ---
export const MinuchinOverlay = ({ map, nodes }: { map: StructuralMap, nodes: GenNode[] }) => {
    const center = (id: string) => {
        const n = nodes.find(x => x.id === id);
        return n ? { x: n.x + NODE_WIDTH / 2, y: n.y + NODE_HEIGHT / 2 } : null;
    };
    return (
        <g pointerEvents="none" opacity={0.85}>
            {map.relations.map(r => <RelationGlyph key={r.id} rel={r} pt={center} stroke="#7c3aed" accent="#7c3aed" />)}
        </g>
    );
};

// --- SVG STRINGA PER IL REPORT CLINICO (monocromo, autonomo) ---
export const mapToSvgString = (map: StructuralMap, nodes: GenNode[]): string => {
    const d = dims(map);
    const isMin = mapStyle(map) === 'minimal';
    const stroke = '#1f2937';
    const pos = (id: string) => map.positions[id] || { x: 60, level: 0 };
    const pt = (id: string) => map.positions[id] ? { x: pos(id).x, y: memberCY(map, pos(id)) } : null;
    const parts: string[] = [];
    const dash = (st: BoundaryStyle) => st === 'clear' ? ' stroke-dasharray="12,7"' : st === 'diffuse' ? ' stroke-dasharray="2,5"' : '';
    if (!isMin) for (let l = 0; l < LEVELS - 1; l++) {
        const st = map.boundaries[l] ?? 'none';
        if (st !== 'none') parts.push(`<line x1="14" y1="${bandTop(l + 1)}" x2="${d.W - 14}" y2="${bandTop(l + 1)}" stroke="${stroke}" stroke-width="${st === 'rigid' ? 2.6 : 1.6}"${dash(st)} stroke-linecap="round"/>`);
    }
    (map.hBoundaries || []).forEach(hb => segmentsOf(map, 'hb', hb, d.W, d.H).filter(s => s.style !== 'none').forEach(s => parts.push(`<line x1="${s.a}" y1="${s.along}" x2="${s.b}" y2="${s.along}" stroke="${stroke}" stroke-width="${s.style === 'rigid' ? 2.6 : 1.6}"${dash(s.style)} stroke-linecap="round"/>`)));
    (map.vBoundaries || []).forEach(vb => segmentsOf(map, 'vb', vb, d.W, d.H).filter(s => s.style !== 'none').forEach(s => parts.push(`<line x1="${s.along}" y1="${s.a}" x2="${s.along}" y2="${s.b}" stroke="${stroke}" stroke-width="${s.style === 'rigid' ? 2.6 : 1.6}"${dash(s.style)} stroke-linecap="round"/>`)));
    map.relations.forEach(r => {
        const a = pt(r.fromId); const b = pt(r.toId);
        if (!a || !b) return;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const col = (r.type === 'conflict' || r.type === 'detouring') ? CONFLICT : stroke;
        const dbl = (off: number) => {
            const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len * off, ny = dx / len * off;
            return `<line x1="${a.x + nx}" y1="${a.y + ny}" x2="${b.x + nx}" y2="${b.y + ny}" stroke="${col}" stroke-width="1.6"/>`;
        };
        if (r.type === 'alliance') parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="1.6"/>`);
        if (r.type === 'overinvolvement' || r.type === 'coalition') { parts.push(dbl(2.6)); parts.push(dbl(-2.6)); }
        if (r.type === 'conflict' || r.type === 'detouring') parts.push(`<path d="${getZigZagPath(a.x, a.y, b.x, b.y, 4, 10)}" stroke="${col}" stroke-width="1.6" fill="none"/>`);
        const c = r.thirdId ? pt(r.thirdId) : null;
        if (c && r.type === 'coalition') parts.push(`<path d="${getZigZagPath(mid.x, mid.y, c.x, c.y, 4, 10)}" stroke="${CONFLICT}" stroke-width="1.6" fill="none"/>`);
        if (c && r.type === 'detouring') parts.push(`<line x1="${mid.x}" y1="${mid.y}" x2="${c.x}" y2="${c.y}" stroke="${CONFLICT}" stroke-width="1.6"/>`);
    });
    map.memberIds.forEach(id => {
        const n = nodes.find(x => x.id === id); if (!n || !map.positions[id]) return;
        const p = pt(id)!; const s = d.sym;
        const half = s / 2;
        if (n.gender === 'F') parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${half}" stroke="${stroke}" stroke-width="1.5" fill="white"/>`);
        else if (n.gender === 'M') parts.push(`<rect x="${p.x - half}" y="${p.y - half}" width="${s}" height="${s}" stroke="${stroke}" stroke-width="1.5" fill="white"/>`);
        else parts.push(`<polygon points="${p.x},${p.y - half} ${p.x + half},${p.y} ${p.x},${p.y + half} ${p.x - half},${p.y}" stroke="${stroke}" stroke-width="1.5" fill="white"/>`);
        if (n.deceased) parts.push(`<path d="M ${p.x - half} ${p.y - half} L ${p.x + half} ${p.y + half} M ${p.x + half} ${p.y - half} L ${p.x - half} ${p.y + half}" stroke="${stroke}" stroke-width="1.2"/>`);
        parts.push(`<text x="${p.x}" y="${p.y + half + 12}" text-anchor="middle" font-size="10" font-weight="600" fill="${stroke}">${(n.name || '').slice(0, 14)}</text>`);
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.W} ${d.H}" width="${Math.min(d.W, 560)}" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px">${parts.join('')}</svg>`;
};

// --- EDITOR ---
export const MinuchinEditor = ({ map, nodes, darkMode, theme, onSave, onClose, onCreatePerson }: {
    map: StructuralMap, nodes: GenNode[], darkMode: boolean, theme: AppTheme,
    onSave: (m: StructuralMap) => void, onClose: () => void,
    onCreatePerson?: (name: string, gender: Gender) => string
}) => {
    const [m, setM] = useState<StructuralMap>(() => ({ vBoundaries: [], hBoundaries: [], ...JSON.parse(JSON.stringify(map)) }));
    const [tool, setTool] = useState<MinuchinRelationType | null>(null);
    const [pending, setPending] = useState<string[]>([]);
    const [selectedRel, setSelectedRel] = useState<string | null>(null);
    const [addingPerson, setAddingPerson] = useState(false);
    const [newName, setNewName] = useState('');
    const [newGender, setNewGender] = useState<Gender>('F');
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{ kind: 'member' | 'vb' | 'hb', id: string, offX: number, offY: number, moved: boolean } | null>(null);

    const c = theme.colors;
    const stroke = c.text, muted = c.textMuted, accent = c.accent;
    const isMin = mapStyle(m) === 'minimal';
    const d = dims(m);
    const members = m.memberIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GenNode[];
    const pos = (id: string) => m.positions[id] || { x: 60, level: 0 };
    const center = (id: string) => m.positions[id] ? { x: pos(id).x, y: memberCY(m, pos(id)) } : null;
    const HIT_W = d.sym + 36;

    const svgPoint = (e: React.PointerEvent) => {
        const r = svgRef.current!.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (d.W / r.width), y: (e.clientY - r.top) * (d.H / r.height) };
    };

    // Cambio stile con conversione delle coordinate (scala proporzionale)
    const switchStyle = (st: 'grid' | 'minimal') => {
        if (st === mapStyle(m)) return;
        const from = dims(m), to = DIMS[st];
        const rx = to.W / from.W, ry = to.H / from.H;
        setM(prev => {
            const positions: StructuralMap['positions'] = {};
            Object.entries(prev.positions).forEach(([id, p]) => {
                const cy = memberCY(prev, p);
                if (st === 'minimal') positions[id] = { x: p.x * rx, level: p.level, y: cy * ry };
                else {
                    const level = Math.max(0, Math.min(LEVELS - 1, Math.floor(((p.y ?? cy) / ry - 14) / DIMS.grid.band)));
                    positions[id] = { x: p.x * rx, level };
                }
            });
            // Confini di livello ⇄ confini liberi
            let boundaries = prev.boundaries, hBoundaries = prev.hBoundaries || [];
            if (st === 'minimal') {
                hBoundaries = [...hBoundaries, ...Object.entries(prev.boundaries).filter(([, s]) => s !== 'none').map(([l, s]) => ({ id: generateId(), y: bandTop(+l + 1) * ry, style: s }))];
                boundaries = {};
            } else {
                boundaries = {};
                hBoundaries.forEach(hb => {
                    const lvl = Math.max(0, Math.min(LEVELS - 2, Math.round((hb.y / ry - 14) / DIMS.grid.band) - 1));
                    boundaries = { ...boundaries, [lvl]: hb.style };
                });
                hBoundaries = [];
            }
            return {
                ...prev, style: st, positions, boundaries, hBoundaries,
                vBoundaries: (prev.vBoundaries || []).map(vb => ({ ...vb, x: vb.x * rx })),
            };
        });
    };

    const addMemberToMap = (id: string) => {
        const used = Object.values(m.positions).map(p => p.x);
        let x = isMin ? 60 : 70; while (used.some(u => Math.abs(u - x) < d.sym * 2)) x += d.sym * 2.6;
        setM(prev => ({ ...prev, memberIds: [...prev.memberIds, id], positions: { ...prev.positions, [id]: { x: Math.min(x, d.W - 50), level: 0, ...(isMin ? { y: 90 } : {}) } } }));
    };
    const submitNewPerson = () => {
        const name = newName.trim();
        if (!name || !onCreatePerson) return;
        addMemberToMap(onCreatePerson(name, newGender));
        setNewName(''); setAddingPerson(false);
    };

    const onMemberDown = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        if (tool) {
            const next = [...pending, id];
            const needsThird = TOOLS.find(t => t.key === tool)!.needsThird;
            if (next.length >= (needsThird ? 3 : 2)) {
                setM(prev => ({ ...prev, relations: [...prev.relations, { id: generateId(), fromId: next[0], toId: next[1], type: tool, thirdId: needsThird ? next[2] : undefined }] }));
                setPending([]); setTool(null);
            } else setPending(next);
            return;
        }
        const p = svgPoint(e);
        const cur = pos(id);
        dragRef.current = { kind: 'member', id, offX: p.x - cur.x, offY: p.y - memberCY(m, cur), moved: false };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onBoundaryDown = (e: React.PointerEvent, kind: 'vb' | 'hb', id: string) => {
        e.stopPropagation();
        const p = svgPoint(e);
        const list: any[] = (kind === 'vb' ? m.vBoundaries : m.hBoundaries) || [];
        const b = list.find(v => v.id === id)!;
        dragRef.current = { kind, id, offX: p.x - (b.x ?? 0), offY: p.y - (b.y ?? 0), moved: false };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: React.PointerEvent) => {
        const dr = dragRef.current;
        if (!dr) return;
        const p = svgPoint(e);
        dr.moved = true;
        if (dr.kind === 'member') {
            const x = Math.max(d.sym, Math.min(d.W - d.sym, p.x - dr.offX));
            if (isMin) {
                const y = Math.max(d.sym, Math.min(d.H - d.sym, p.y - dr.offY));
                setM(prev => ({ ...prev, positions: { ...prev.positions, [dr.id]: { ...prev.positions[dr.id], x, y } } }));
            } else {
                const level = Math.max(0, Math.min(LEVELS - 1, Math.floor((p.y - 14) / DIMS.grid.band)));
                setM(prev => ({ ...prev, positions: { ...prev.positions, [dr.id]: { x, level } } }));
            }
        } else if (dr.kind === 'vb') {
            const x = Math.max(20, Math.min(d.W - 20, p.x - dr.offX));
            setM(prev => ({ ...prev, vBoundaries: (prev.vBoundaries || []).map(v => v.id === dr.id ? { ...v, x } : v) }));
        } else {
            const y = Math.max(20, Math.min(d.H - 20, p.y - dr.offY));
            setM(prev => ({ ...prev, hBoundaries: (prev.hBoundaries || []).map(v => v.id === dr.id ? { ...v, y } : v) }));
        }
    };
    const onUp = () => { setTimeout(() => { dragRef.current = null; }, 0); };

    const cycleGridBoundary = (level: number) => setM(prev => {
        const cur = prev.boundaries[level] ?? 'none';
        return { ...prev, boundaries: { ...prev.boundaries, [level]: BOUNDARY_CYCLE[(BOUNDARY_CYCLE.indexOf(cur) + 1) % BOUNDARY_CYCLE.length] } };
    });
    // Ciclo dello stile di UN SEGMENTO (clear→diffuse→rigid→none): none lo lascia
    // vuoto, così si può "accorciare" un confine spegnendo i segmenti indesiderati.
    const cycleSegment = (kind: 'vb' | 'hb', id: string, segIdx: number) => {
        if (dragRef.current?.moved) return;
        const bump = <T extends { style: BoundaryStyle, segStyles?: Record<number, BoundaryStyle> }>(v: T): T => {
            const cur = v.segStyles?.[segIdx] ?? v.style;
            const next = BOUNDARY_CYCLE[(BOUNDARY_CYCLE.indexOf(cur) + 1) % BOUNDARY_CYCLE.length];
            return { ...v, segStyles: { ...(v.segStyles || {}), [segIdx]: next } };
        };
        setM(prev => kind === 'vb'
            ? { ...prev, vBoundaries: (prev.vBoundaries || []).map(v => v.id === id ? bump(v) : v) }
            : { ...prev, hBoundaries: (prev.hBoundaries || []).map(v => v.id === id ? bump(v) : v) });
    };
    const removeFree = (kind: 'vb' | 'hb', id: string) => setM(prev => kind === 'vb'
        ? { ...prev, vBoundaries: (prev.vBoundaries || []).filter(v => v.id !== id) }
        : { ...prev, hBoundaries: (prev.hBoundaries || []).filter(v => v.id !== id) });

    const exportPng = () => {
        if (!svgRef.current) return;
        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
        clone.querySelectorAll('[data-ui="1"]').forEach(el => el.remove());
        clone.setAttribute('width', String(d.W * 2)); clone.setAttribute('height', String(d.H * 2));
        const data = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = d.W * 2; cv.height = d.H * 2;
            const ctx = cv.getContext('2d')!;
            ctx.fillStyle = c.bgMain; ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(url);
            const a = document.createElement('a');
            a.href = cv.toDataURL('image/png'); a.download = `${m.label || 'mappa-strutturale'}.png`; a.click();
        };
        img.src = url;
    };

    const toolBtn = (active: boolean) => active
        ? { backgroundColor: accent, color: '#ffffff', borderColor: accent }
        : { color: c.text, borderColor: c.border };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className={`rounded-2xl shadow-2xl w-full ${isMin ? 'max-w-2xl' : 'max-w-5xl'} max-h-[94vh] flex flex-col overflow-hidden border`}
                style={{ backgroundColor: c.bgPanel, borderColor: c.border, color: c.text }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-3 flex justify-between items-center gap-3 border-b" style={{ borderColor: c.border, backgroundColor: c.bgMain }}>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: muted }}>Mappa strutturale · Minuchin</span>
                        <input className="font-bold bg-transparent focus:outline-none truncate" style={{ color: c.text }} value={m.label}
                            onChange={e => setM(prev => ({ ...prev, label: e.target.value }))} placeholder="Titolo (es. Struttura attuale)" />
                    </div>
                    {/* Toggle stile */}
                    <div className="flex rounded-lg border overflow-hidden text-[11px] font-semibold" style={{ borderColor: c.border }}>
                        <button onClick={() => switchStyle('minimal')} className="px-2.5 py-1.5" style={isMin ? { backgroundColor: accent, color: '#fff' } : { color: c.text }}>Minimale</button>
                        <button onClick={() => switchStyle('grid')} className="px-2.5 py-1.5" style={!isMin ? { backgroundColor: accent, color: '#fff' } : { color: c.text }}>Griglia</button>
                    </div>
                    <button onClick={exportPng} className="px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 hover:opacity-70" style={{ borderColor: c.border, color: c.text }} title="Esporta PNG"><Download size={14} /> PNG</button>
                    <button onClick={() => { onSave(m); onClose(); }} className="text-xs font-semibold text-white px-3.5 py-2 rounded-lg hover:opacity-90 shadow-sm" style={{ backgroundColor: accent }}>Salva e chiudi</button>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: c.text }}><X size={18} /></button>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 flex flex-wrap items-center gap-1.5 border-b text-xs" style={{ borderColor: c.border }}>
                    {TOOLS.map(t => (
                        <button key={t.key} onClick={() => { setTool(tool === t.key ? null : t.key); setPending([]); setSelectedRel(null); }}
                            className="pl-2 pr-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all hover:opacity-80" style={toolBtn(tool === t.key)}>
                            <RelPreview type={t.key} stroke={tool === t.key ? '#ffffff' : stroke} />{t.label}
                        </button>
                    ))}
                    <div className="w-px h-6 mx-1" style={{ backgroundColor: c.border }} />
                    <button onClick={() => setM(prev => ({ ...prev, vBoundaries: [...(prev.vBoundaries || []), { id: generateId(), x: d.W / 2, style: 'clear' }] }))}
                        className="px-2 py-1.5 rounded-lg border flex items-center gap-1.5 hover:opacity-80" style={{ color: c.text, borderColor: c.border }} title="Confine verticale">
                        <SeparatorVertical size={14} />{!isMin && ' Confine vert.'}
                    </button>
                    {isMin && (
                        <button onClick={() => setM(prev => ({ ...prev, hBoundaries: [...(prev.hBoundaries || []), { id: generateId(), y: d.H / 2, style: 'clear' }] }))}
                            className="px-2 py-1.5 rounded-lg border flex items-center gap-1.5 hover:opacity-80" style={{ color: c.text, borderColor: c.border }} title="Confine orizzontale">
                            <SeparatorHorizontal size={14} />
                        </button>
                    )}
                    {onCreatePerson && (
                        <button onClick={() => setAddingPerson(!addingPerson)} className="px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 hover:opacity-80" style={toolBtn(addingPerson)}>
                            <UserPlus size={14} /> Persona
                        </button>
                    )}
                    {selectedRel && (
                        <button onClick={() => { setM(prev => ({ ...prev, relations: prev.relations.filter(r => r.id !== selectedRel) })); setSelectedRel(null); }}
                            className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border" style={{ color: CONFLICT, borderColor: CONFLICT + '55', backgroundColor: CONFLICT + '11' }}><Trash2 size={13} /> Elimina relazione</button>
                    )}
                    {tool && <span className="opacity-70 animate-pulse ml-1" style={{ color: c.text }}>clicca {pending.length === 0 ? 'il primo membro' : pending.length === 1 ? 'il secondo membro' : 'il terzo (bersaglio)'}…</span>}
                </div>

                {/* Form nuova persona */}
                {addingPerson && (
                    <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b text-xs" style={{ borderColor: c.border, backgroundColor: c.bgMain }}>
                        <input autoFocus className="border rounded-lg px-2.5 py-1.5 bg-transparent focus:outline-none w-48" style={{ borderColor: c.border, color: c.text }}
                            placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submitNewPerson(); }} />
                        {(['M', 'F', 'NonBinary', 'Unknown'] as Gender[]).map(g => (
                            <button key={g} onClick={() => setNewGender(g)} className="px-2.5 py-1.5 rounded-lg border hover:opacity-80" style={toolBtn(newGender === g)}>
                                {g === 'M' ? 'Maschio' : g === 'F' ? 'Femmina' : g === 'NonBinary' ? 'Non-binary' : '?'}
                            </button>
                        ))}
                        <button onClick={submitNewPerson} disabled={!newName.trim()} className="px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40" style={{ backgroundColor: accent }}>Aggiungi</button>
                        <span style={{ color: muted }}>La persona entra nel genogramma dentro il <b>cartiglio</b>.</span>
                    </div>
                )}

                <div className="flex-1 overflow-auto p-4">
                    <svg ref={svgRef} viewBox={`0 0 ${d.W} ${d.H}`} className="w-full rounded-xl border"
                        style={{ backgroundColor: c.bgMain, borderColor: c.border }}
                        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>

                        {/* GRIGLIA: fasce + confini di livello */}
                        {!isMin && Array.from({ length: LEVELS }, (_, l) => (
                            <g key={l}>
                                {l % 2 === 1 && <rect x={0} y={bandTop(l)} width={d.W} height={d.band} fill={stroke} opacity={0.035} />}
                                <g data-ui="1">
                                    <rect x={10} y={bandTop(l) + 8} rx={7} width={58} height={15} fill={accent} opacity={0.1} />
                                    <text x={39} y={bandTop(l) + 19} fontSize={8.5} fill={muted} textAnchor="middle" fontWeight={600} letterSpacing={0.5}>LIVELLO {l + 1}</text>
                                </g>
                            </g>
                        ))}
                        {!isMin && Array.from({ length: LEVELS - 1 }, (_, l) => {
                            const style = m.boundaries[l] ?? 'none';
                            const y = bandTop(l + 1);
                            return (
                                <g key={l} onClick={() => cycleGridBoundary(l)} className="cursor-pointer">
                                    <line x1={0} y1={y} x2={d.W} y2={y} stroke="transparent" strokeWidth={16} />
                                    {style !== 'none'
                                        ? <line x1={14} y1={y} x2={d.W - 14} y2={y} stroke={stroke} strokeWidth={style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(style)} strokeLinecap="round" />
                                        : <line data-ui="1" x1={14} y1={y} x2={d.W - 14} y2={y} stroke={muted} strokeWidth={1} strokeDasharray="1,7" opacity={0.35} strokeLinecap="round" />}
                                    <g data-ui="1">
                                        <rect x={d.W - 82} y={y - 8} rx={8} width={70} height={16} fill={stroke} opacity={0.07} />
                                        <text x={d.W - 47} y={y + 3.5} fontSize={8.5} fill={muted} textAnchor="middle" fontWeight={600}>{BOUNDARY_LABEL[style]}</text>
                                    </g>
                                </g>
                            );
                        })}

                        {/* Confini liberi orizzontali — un segmento per intersezione */}
                        {(m.hBoundaries || []).map(hb => (
                            <g key={hb.id}>
                                {segmentsOf(m, 'hb', hb, d.W, d.H).map(seg => (
                                    <g key={seg.i} onPointerDown={e => onBoundaryDown(e, 'hb', hb.id)} onClick={() => cycleSegment('hb', hb.id, seg.i)} className="cursor-ns-resize">
                                        <line x1={seg.a} y1={seg.along} x2={seg.b} y2={seg.along} stroke="transparent" strokeWidth={16} />
                                        {seg.style !== 'none' && <line x1={seg.a} y1={seg.along} x2={seg.b} y2={seg.along} stroke={stroke} strokeWidth={seg.style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(seg.style)} strokeLinecap="round" />}
                                    </g>
                                ))}
                                <g data-ui="1" onClick={() => removeFree('hb', hb.id)} className="cursor-pointer">
                                    <circle cx={14} cy={hb.y} r={7} fill={c.bgPanel} stroke={muted} strokeWidth={0.8} />
                                    <path d={`M ${14 - 2.6} ${hb.y - 2.6} L ${14 + 2.6} ${hb.y + 2.6} M ${14 + 2.6} ${hb.y - 2.6} L ${14 - 2.6} ${hb.y + 2.6}`} stroke={c.text} strokeWidth={1.3} />
                                </g>
                            </g>
                        ))}

                        {/* Confini verticali — un segmento per intersezione */}
                        {(m.vBoundaries || []).map(vb => (
                            <g key={vb.id}>
                                {segmentsOf(m, 'vb', vb, d.W, d.H).map(seg => (
                                    <g key={seg.i} onPointerDown={e => onBoundaryDown(e, 'vb', vb.id)} onClick={() => cycleSegment('vb', vb.id, seg.i)} className="cursor-ew-resize">
                                        <line x1={seg.along} y1={seg.a} x2={seg.along} y2={seg.b} stroke="transparent" strokeWidth={16} />
                                        {seg.style !== 'none' && <line x1={seg.along} y1={seg.a} x2={seg.along} y2={seg.b} stroke={stroke} strokeWidth={seg.style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(seg.style)} strokeLinecap="round" />}
                                    </g>
                                ))}
                                <g data-ui="1" onClick={() => removeFree('vb', vb.id)} className="cursor-pointer">
                                    <circle cx={vb.x} cy={14} r={7} fill={c.bgPanel} stroke={muted} strokeWidth={0.8} />
                                    <path d={`M ${vb.x - 2.6} ${14 - 2.6} L ${vb.x + 2.6} ${14 + 2.6} M ${vb.x + 2.6} ${14 - 2.6} L ${vb.x - 2.6} ${14 + 2.6}`} stroke={c.text} strokeWidth={1.3} />
                                </g>
                            </g>
                        ))}

                        {/* Relazioni */}
                        {m.relations.map(r => (
                            <RelationGlyph key={r.id} rel={r} pt={center} stroke={stroke} accent={accent} selected={selectedRel === r.id}
                                onClick={() => { setSelectedRel(selectedRel === r.id ? null : r.id); setTool(null); setPending([]); }} />
                        ))}

                        {/* Membri */}
                        {members.map(n => {
                            const p = pos(n.id);
                            const cy = memberCY(m, p);
                            const isPending = pending.includes(n.id);
                            const sc = d.sym / NODE_WIDTH;
                            return (
                                <g key={n.id} transform={`translate(${p.x},${cy})`}
                                    onPointerDown={e => onMemberDown(e, n.id)}
                                    className={tool ? 'cursor-crosshair' : 'cursor-grab'} data-member="1">
                                    <rect x={-HIT_W / 2} y={-d.sym / 2 - 8} width={HIT_W} height={d.sym + 30} fill="transparent" />
                                    {isPending && <circle r={d.sym * 0.85} fill={accent} opacity={0.15} />}
                                    {isPending && <circle r={d.sym * 0.85} fill="none" stroke={accent} strokeWidth={1.5} strokeDasharray="4,3" />}
                                    <g transform={`translate(${-d.sym / 2},${-d.sym / 2}) scale(${sc})`}>
                                        <PersonSymbol node={n} darkMode={darkMode} />
                                    </g>
                                    <text y={d.sym / 2 + 13} textAnchor="middle" fontSize={isMin ? 9.5 : 10.5} fontWeight={600} fill={stroke}>
                                        {n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name}
                                    </text>
                                    {!isMin && n.profession && <text y={d.sym / 2 + 24} textAnchor="middle" fontSize={8} fill={muted}>{n.profession}</text>}
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legenda */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px]" style={{ color: muted }}>
                        {TOOLS.map(t => <span key={t.key} className="flex items-center gap-1.5"><RelPreview type={t.key} stroke={muted} />{t.label}</span>)}
                        <span className="flex items-center gap-1.5"><svg width={34} height={14}><line x1={2} y1={7} x2={32} y2={7} stroke={muted} strokeWidth={1.5} strokeDasharray="8,5" /></svg>Confine chiaro</span>
                        <span className="flex items-center gap-1.5"><svg width={34} height={14}><line x1={2} y1={7} x2={32} y2={7} stroke={muted} strokeWidth={1.5} strokeDasharray="2,4" /></svg>Diffuso</span>
                        <span className="flex items-center gap-1.5"><svg width={34} height={14}><line x1={2} y1={7} x2={32} y2={7} stroke={muted} strokeWidth={2.4} /></svg>Rigido</span>
                        <span className="italic">Clicca un tratto di confine (tra due incroci) per cambiarne stile — spegnendolo lo accorci.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MANAGER: miniature, confronto T0/T1, creazione (vuota/minimale/selezione/household), overlay ---
export const MinuchinManager = ({ maps, nodes, edges, groups, selectedNodeIds, darkMode, theme, onChange, onClose, onCreatePerson, overlayMapId, onOverlayChange }: {
    maps: StructuralMap[], nodes: GenNode[], edges: RelationEdge[], groups: NodeGroup[], selectedNodeIds: string[],
    darkMode: boolean, theme: AppTheme, onChange: (maps: StructuralMap[]) => void, onClose: () => void,
    onCreatePerson?: (name: string, gender: Gender) => string,
    overlayMapId?: string | null, onOverlayChange?: (id: string | null) => void
}) => {
    const [editing, setEditing] = useState<StructuralMap | null>(null);
    const [compare, setCompare] = useState<string[]>([]);
    const c = theme.colors;

    const createFrom = (members: GenNode[], style: 'grid' | 'minimal', label?: string) =>
        setEditing(createMapFromSelection(members, edges, label || `Mappa ${maps.length + 1}`, style));
    const saveMap = (m: StructuralMap) => {
        onChange(maps.some(x => x.id === m.id) ? maps.map(x => x.id === m.id ? m : x) : [...maps, m]);
    };
    const toggleCompare = (id: string) => setCompare(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev.slice(-1), id]);
    const households = groups.filter(g => g.memberIds.length >= 2);

    if (editing) return <MinuchinEditor map={editing} nodes={nodes} darkMode={darkMode} theme={theme} onSave={saveMap} onClose={() => setEditing(null)} onCreatePerson={onCreatePerson} />;

    const compareMaps = compare.map(id => maps.find(m => m.id === id)).filter(Boolean) as StructuralMap[];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className={`rounded-2xl shadow-2xl w-full ${compareMaps.length === 2 ? 'max-w-4xl' : 'max-w-xl'} flex flex-col overflow-hidden border max-h-[92vh]`}
                style={{ backgroundColor: c.bgPanel, borderColor: c.border, color: c.text }} onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 flex justify-between items-center border-b" style={{ borderColor: c.border, backgroundColor: c.bgMain }}>
                    <div>
                        <h3 className="font-bold leading-tight">Mappe Strutturali</h3>
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: c.textMuted }}>Minuchin · terapia strutturale</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70"><X size={18} /></button>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto">
                    {/* CONFRONTO T0/T1 */}
                    {compareMaps.length === 2 && (
                        <div className="border rounded-xl p-3" style={{ borderColor: c.accent + '66', backgroundColor: c.accent + '0A' }}>
                            <div className="text-[10px] uppercase font-bold mb-2 flex items-center gap-1.5" style={{ color: c.accent }}><Columns size={12} /> Confronto</div>
                            <div className="flex gap-3 items-start">
                                {compareMaps.map(mp => (
                                    <div key={mp.id} className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold mb-1 truncate">{mp.label}</div>
                                        <MapThumb map={mp} nodes={nodes} darkMode={darkMode} theme={theme} width={999} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {maps.length === 0 && <div className="text-xs text-center py-6" style={{ color: c.textMuted }}>Nessuna mappa ancora.<br />Creane una minimale, vuota o dalla selezione.</div>}
                    {maps.map(mp => (
                        <div key={mp.id} className="flex items-center gap-3 border rounded-xl p-2.5" style={{ borderColor: compare.includes(mp.id) ? c.accent : c.border }}>
                            <button onClick={() => setEditing(mp)} className="shrink-0"><MapThumb map={mp} nodes={nodes} darkMode={darkMode} theme={theme} width={110} /></button>
                            <button onClick={() => setEditing(mp)} className="flex-1 text-left min-w-0">
                                <div className="text-sm font-semibold truncate">{mp.label} {mapStyle(mp) === 'minimal' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: c.accent + '22', color: c.accent }}>minimale</span>}</div>
                                <div className="text-[10px]" style={{ color: c.textMuted }}>{mp.memberIds.length} membri · {mp.relations.length} relazioni</div>
                            </button>
                            <button title="Confronta (scegli 2)" onClick={() => toggleCompare(mp.id)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: compare.includes(mp.id) ? c.accent : c.textMuted }}><Columns size={15} /></button>
                            {onOverlayChange && (
                                <button title={overlayMapId === mp.id ? "Nascondi dal genogramma" : "Mostra sul genogramma (overlay)"} onClick={() => { onOverlayChange(overlayMapId === mp.id ? null : mp.id); onClose(); }}
                                    className="p-1.5 rounded-lg hover:opacity-80" style={{ color: overlayMapId === mp.id ? c.accent : c.textMuted }}>
                                    {overlayMapId === mp.id ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            )}
                            <button onClick={() => { if (confirm("Eliminare la mappa?")) { onChange(maps.filter(x => x.id !== mp.id)); if (overlayMapId === mp.id) onOverlayChange?.(null); } }}
                                className="p-1.5 opacity-50 hover:opacity-100" style={{ color: CONFLICT }}><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t space-y-2" style={{ borderColor: c.border }}>
                    <div className="flex gap-2">
                        <button onClick={() => createFrom([], 'minimal')}
                            className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-sm" style={{ backgroundColor: c.accent }}>
                            <Plus size={16} /> Nuova minimale
                        </button>
                        <button onClick={() => createFrom([], 'grid')}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 hover:opacity-80" style={{ borderColor: c.border, color: c.text }}>
                            <Plus size={16} /> Nuova a griglia
                        </button>
                    </div>
                    <button onClick={() => createFrom(nodes.filter(n => selectedNodeIds.includes(n.id)), 'minimal')} disabled={selectedNodeIds.length < 2}
                        className="w-full py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-80" style={{ borderColor: c.border, color: c.text }}>
                        Dalla selezione ({selectedNodeIds.length} selezionati)
                    </button>
                    {households.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {households.slice(0, 4).map(g => (
                                <button key={g.id} onClick={() => createFrom(nodes.filter(n => g.memberIds.includes(n.id)), 'minimal', g.label)}
                                    className="text-[10px] px-2 py-1 rounded-lg border hover:opacity-80" style={{ borderColor: c.border, color: c.textMuted }}>
                                    Da gruppo: {g.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
