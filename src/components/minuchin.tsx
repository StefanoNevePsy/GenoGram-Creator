// --- MAPPE STRUTTURALI DI MINUCHIN ---
// Editor a livelli gerarchici: i membri (resi con il simbolo del genogramma:
// sesso, deceduto, marcatori clinici) si trascinano tra le fasce; i confini
// orizzontali tra livelli si ciclano cliccandoli; i confini VERTICALI tra
// sottosistemi si aggiungono dalla toolbar, si trascinano e si ciclano.
// Notazione (Minuchin, 1974): confine chiaro = tratteggiato, diffuso = puntinato,
// rigido = continuo; invischiamento = doppia linea; conflitto = zigzag;
// coalizione = doppia linea + zigzag verso il terzo; deviazione = zigzag + freccia.

import { useState, useRef } from 'react';
import { X, Plus, Trash2, Download, SeparatorVertical } from 'lucide-react';
import type { GenNode, RelationEdge, StructuralMap, MinuchinRelation, MinuchinRelationType, BoundaryStyle, VerticalBoundary } from '../types';
import { generateId } from '../utils/genogram';
import { extractYear } from '../utils/dates';
import { getZigZagPath } from '../utils/geometry';
import { PersonSymbol } from './canvas';

const MAP_W = 880, BAND_H = 128, LEVELS = 4, SYM = 40, HIT_W = 76;
const bandTop = (level: number) => 14 + level * BAND_H;
const memberCY = (level: number) => bandTop(level) + BAND_H / 2 - 10;
const MAP_H = bandTop(LEVELS) + 6;

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

// Anteprima in miniatura di una relazione (toolbar + legenda)
const RelPreview = ({ type, stroke }: { type: MinuchinRelationType, stroke: string }) => {
    const red = '#dc2626';
    return (
        <svg width={34} height={14} className="shrink-0">
            {type === 'alliance' && <line x1={2} y1={7} x2={32} y2={7} stroke={stroke} strokeWidth={1.5} />}
            {type === 'overinvolvement' && <g><line x1={2} y1={5} x2={32} y2={5} stroke={stroke} strokeWidth={1.5} /><line x1={2} y1={9} x2={32} y2={9} stroke={stroke} strokeWidth={1.5} /></g>}
            {type === 'conflict' && <path d={getZigZagPath(2, 7, 32, 7, 3, 7)} stroke={red} strokeWidth={1.5} fill="none" />}
            {type === 'coalition' && <g><line x1={2} y1={4} x2={32} y2={4} stroke={stroke} strokeWidth={1.5} /><line x1={2} y1={8} x2={32} y2={8} stroke={stroke} strokeWidth={1.5} /><path d={getZigZagPath(17, 8, 17, 14, 2, 4)} stroke={red} strokeWidth={1.2} fill="none" /></g>}
            {type === 'detouring' && <g><path d={getZigZagPath(2, 5, 32, 5, 3, 7)} stroke={red} strokeWidth={1.5} fill="none" /><line x1={17} y1={5} x2={17} y2={11} stroke={red} strokeWidth={1.2} /><polygon points="14,10 20,10 17,14" fill={red} /></g>}
        </svg>
    );
};

// Traduzione automatica delle relazioni del genogramma in notazione Minuchin
const REL_TO_MINUCHIN: Record<string, MinuchinRelationType> = {
    'fusion': 'overinvolvement', 'close': 'overinvolvement',
    'hostile': 'conflict', 'hate': 'conflict', 'close-hostile': 'conflict', 'fusion-hostile': 'conflict',
    'harmony': 'alliance', 'friendship': 'alliance', 'best-friend': 'alliance', 'in-love': 'alliance',
};

export const createMapFromSelection = (members: GenNode[], edges: RelationEdge[], label: string): StructuralMap => {
    const years = members.map(m => extractYear(m.birthDate || ''));
    const known = years.filter(y => y > 0);
    const minYear = known.length ? Math.min(...known) : 0;
    const positions: StructuralMap['positions'] = {};
    const counters: Record<number, number> = {};
    members.forEach((m, i) => {
        const y = years[i];
        const level = (minYear && y > 0 && y - minYear > 16) ? 1 : 0;
        const idx = counters[level] || 0;
        counters[level] = idx + 1;
        positions[m.id] = { x: 70 + idx * 150, level };
    });
    const memberSet = new Set(members.map(m => m.id));
    const relations: MinuchinRelation[] = edges
        .filter(e => memberSet.has(e.fromId) && memberSet.has(e.toId) && REL_TO_MINUCHIN[e.type])
        .map(e => ({ id: generateId(), fromId: e.fromId, toId: e.toId, type: REL_TO_MINUCHIN[e.type] }));
    return { id: generateId(), label, memberIds: members.map(m => m.id), positions, boundaries: { 0: 'clear' }, vBoundaries: [], relations, notes: [] };
};

const RelationGlyph = ({ rel, pt, stroke, onClick, selected }: {
    rel: MinuchinRelation,
    pt: (id: string) => { x: number, y: number } | null,
    stroke: string, onClick: () => void, selected: boolean
}) => {
    const a = pt(rel.fromId); const b = pt(rel.toId);
    if (!a || !b) return null;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const red = '#dc2626';
    const col = selected ? '#3b82f6' : (rel.type === 'conflict' || rel.type === 'detouring' ? red : stroke);
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
            ? <path d={getZigZagPath(mid.x, mid.y, c.x, c.y, 4, 10)} stroke={red} strokeWidth={1.6} fill="none" />
            : <g>
                <line x1={mid.x} y1={mid.y} x2={c.x} y2={c.y} stroke={red} strokeWidth={1.6} />
                <polygon points="-7,-4.5 4,0 -7,4.5" fill={red} transform={`translate(${c.x},${c.y}) rotate(${Math.atan2(c.y - mid.y, c.x - mid.x) * 180 / Math.PI}) translate(-26,0)`} />
            </g>) : null;
        body = <g>
            {rel.type === 'coalition' ? <g>{dbl(2.6)}{dbl(-2.6)}</g> : <path d={getZigZagPath(a.x, a.y, b.x, b.y, 4, 10)} stroke={col} strokeWidth={1.6} fill="none" />}
            {toC}
        </g>;
    }
    return <g onClick={onClick} className="cursor-pointer">{hit}{body}</g>;
};

// --- EDITOR DI UNA MAPPA ---
export const MinuchinEditor = ({ map, nodes, darkMode, onSave, onClose }: {
    map: StructuralMap, nodes: GenNode[], darkMode: boolean,
    onSave: (m: StructuralMap) => void, onClose: () => void
}) => {
    const [m, setM] = useState<StructuralMap>(() => ({ vBoundaries: [], ...JSON.parse(JSON.stringify(map)) }));
    const [tool, setTool] = useState<MinuchinRelationType | null>(null);
    const [pending, setPending] = useState<string[]>([]);
    const [selectedRel, setSelectedRel] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{ kind: 'member' | 'vb', id: string, offX: number, moved: boolean } | null>(null);

    const stroke = darkMode ? '#e5e7eb' : '#334155';
    const bandFill = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)';
    const members = m.memberIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GenNode[];
    const pos = (id: string) => m.positions[id] || { x: 60, level: 0 };
    const center = (id: string) => m.positions[id] ? { x: pos(id).x, y: memberCY(pos(id).level) } : null;

    const svgPoint = (e: React.PointerEvent) => {
        const r = svgRef.current!.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (MAP_W / r.width), y: (e.clientY - r.top) * (MAP_H / r.height) };
    };

    const onMemberDown = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        if (tool) {
            const next = [...pending, id];
            const needsThird = TOOLS.find(t => t.key === tool)!.needsThird;
            if (next.length >= (needsThird ? 3 : 2)) {
                setM(prev => ({
                    ...prev,
                    relations: [...prev.relations, { id: generateId(), fromId: next[0], toId: next[1], type: tool, thirdId: needsThird ? next[2] : undefined }]
                }));
                setPending([]); setTool(null);
            } else setPending(next);
            return;
        }
        const p = svgPoint(e);
        dragRef.current = { kind: 'member', id, offX: p.x - pos(id).x, moved: false };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };

    const onVbDown = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        const p = svgPoint(e);
        const vb = (m.vBoundaries || []).find(v => v.id === id)!;
        dragRef.current = { kind: 'vb', id, offX: p.x - vb.x, moved: false };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const p = svgPoint(e);
        d.moved = true;
        if (d.kind === 'member') {
            const level = Math.max(0, Math.min(LEVELS - 1, Math.floor((p.y - 14) / BAND_H)));
            const x = Math.max(SYM, Math.min(MAP_W - SYM, p.x - d.offX));
            setM(prev => ({ ...prev, positions: { ...prev.positions, [d.id]: { x, level } } }));
        } else {
            const x = Math.max(20, Math.min(MAP_W - 20, p.x - d.offX));
            setM(prev => ({ ...prev, vBoundaries: (prev.vBoundaries || []).map(v => v.id === d.id ? { ...v, x } : v) }));
        }
    };
    const onUp = () => { setTimeout(() => { dragRef.current = null; }, 0); };

    const cycleHBoundary = (level: number) => {
        setM(prev => {
            const cur = prev.boundaries[level] ?? 'none';
            const next = BOUNDARY_CYCLE[(BOUNDARY_CYCLE.indexOf(cur) + 1) % BOUNDARY_CYCLE.length];
            return { ...prev, boundaries: { ...prev.boundaries, [level]: next } };
        });
    };
    const cycleVBoundary = (id: string) => {
        if (dragRef.current?.moved) return; // era un drag, non un click
        setM(prev => ({
            ...prev,
            vBoundaries: (prev.vBoundaries || []).map(v => v.id === id ? { ...v, style: BOUNDARY_CYCLE[(BOUNDARY_CYCLE.indexOf(v.style) + 1) % 3] as BoundaryStyle } : v)
        }));
    };
    const addVBoundary = () => setM(prev => ({ ...prev, vBoundaries: [...(prev.vBoundaries || []), { id: generateId(), x: MAP_W / 2, style: 'clear' } as VerticalBoundary] }));
    const removeVBoundary = (id: string) => setM(prev => ({ ...prev, vBoundaries: (prev.vBoundaries || []).filter(v => v.id !== id) }));

    const exportPng = () => {
        if (!svgRef.current) return;
        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
        clone.querySelectorAll('[data-ui="1"]').forEach(el => el.remove()); // niente affordance nel file
        clone.setAttribute('width', String(MAP_W * 2)); clone.setAttribute('height', String(MAP_H * 2));
        const data = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = MAP_W * 2; cv.height = MAP_H * 2;
            const ctx = cv.getContext('2d')!;
            ctx.fillStyle = darkMode ? '#111827' : '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(url);
            const a = document.createElement('a');
            a.href = cv.toDataURL('image/png'); a.download = `${m.label || 'mappa-strutturale'}.png`; a.click();
        };
        img.src = url;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="theme-panel rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border theme-border" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-3 flex justify-between items-center border-b theme-border gap-3 bg-black/5 dark:bg-white/5">
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider opacity-50 theme-text font-bold">Mappa strutturale · Minuchin</span>
                        <input className="font-bold bg-transparent theme-text focus:outline-none focus:border-b focus:border-[var(--theme-accent)] truncate" value={m.label}
                            onChange={e => setM(prev => ({ ...prev, label: e.target.value }))} placeholder="Titolo (es. Struttura attuale)" />
                    </div>
                    <button onClick={exportPng} className="theme-text theme-hover px-2.5 py-1.5 rounded-lg border theme-border text-xs flex items-center gap-1.5" title="Esporta PNG"><Download size={14} /> PNG</button>
                    <button onClick={() => { onSave(m); onClose(); }} className="text-xs font-semibold text-white px-3.5 py-2 rounded-lg hover:opacity-90 shadow-sm" style={{ backgroundColor: 'var(--theme-accent)' }}>Salva e chiudi</button>
                    <button onClick={onClose} className="theme-text theme-hover p-1.5 rounded-lg"><X size={18} /></button>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 flex flex-wrap items-center gap-1.5 border-b theme-border text-xs">
                    {TOOLS.map(t => (
                        <button key={t.key} onClick={() => { setTool(tool === t.key ? null : t.key); setPending([]); setSelectedRel(null); }}
                            className={`pl-2 pr-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all ${tool === t.key ? 'text-white border-transparent shadow-sm' : 'theme-border theme-text theme-hover'}`}
                            style={tool === t.key ? { backgroundColor: 'var(--theme-accent)' } : {}}>
                            <RelPreview type={t.key} stroke={tool === t.key ? '#ffffff' : stroke} />{t.label}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-current opacity-10 mx-1" />
                    <button onClick={addVBoundary} className="px-2.5 py-1.5 rounded-lg border theme-border theme-text theme-hover flex items-center gap-1.5">
                        <SeparatorVertical size={14} /> Confine verticale
                    </button>
                    {selectedRel && (
                        <button onClick={() => { setM(prev => ({ ...prev, relations: prev.relations.filter(r => r.id !== selectedRel) })); setSelectedRel(null); }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center gap-1.5 border border-red-500/30"><Trash2 size={13} /> Elimina relazione</button>
                    )}
                    {tool && <span className="theme-text opacity-70 animate-pulse ml-1">clicca {pending.length === 0 ? 'il primo membro' : pending.length === 1 ? 'il secondo membro' : 'il terzo (bersaglio)'}…</span>}
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full rounded-xl border theme-border"
                        style={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff' }}
                        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                        {/* Fasce alternate + etichette livello */}
                        {Array.from({ length: LEVELS }, (_, l) => (
                            <g key={l}>
                                {l % 2 === 1 && <rect x={0} y={bandTop(l)} width={MAP_W} height={BAND_H} fill={bandFill} />}
                                <g data-ui="1">
                                    <rect x={10} y={bandTop(l) + 8} rx={7} width={58} height={15} fill={stroke} opacity={0.07} />
                                    <text x={39} y={bandTop(l) + 19} fontSize={8.5} fill={stroke} opacity={0.55} textAnchor="middle" fontWeight={600} letterSpacing={0.5}>LIVELLO {l + 1}</text>
                                </g>
                            </g>
                        ))}

                        {/* Confini orizzontali tra livelli */}
                        {Array.from({ length: LEVELS - 1 }, (_, l) => {
                            const style = m.boundaries[l] ?? 'none';
                            const y = bandTop(l + 1);
                            return (
                                <g key={l} onClick={() => cycleHBoundary(l)} className="cursor-pointer">
                                    <line x1={0} y1={y} x2={MAP_W} y2={y} stroke="transparent" strokeWidth={16} />
                                    {style !== 'none'
                                        ? <line x1={14} y1={y} x2={MAP_W - 14} y2={y} stroke={stroke} strokeWidth={style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(style)} strokeLinecap="round" />
                                        : <line data-ui="1" x1={14} y1={y} x2={MAP_W - 14} y2={y} stroke={stroke} strokeWidth={1} strokeDasharray="1,7" opacity={0.25} strokeLinecap="round" />}
                                    <g data-ui="1">
                                        <rect x={MAP_W - 82} y={y - 8} rx={8} width={70} height={16} fill={stroke} opacity={0.08} />
                                        <text x={MAP_W - 47} y={y + 3.5} fontSize={8.5} fill={stroke} opacity={0.6} textAnchor="middle" fontWeight={600}>{BOUNDARY_LABEL[style]}</text>
                                    </g>
                                </g>
                            );
                        })}

                        {/* Confini verticali (drag per spostare, click per ciclare, × per eliminare) */}
                        {(m.vBoundaries || []).map(vb => (
                            <g key={vb.id}>
                                <g onPointerDown={e => onVbDown(e, vb.id)} onClick={() => cycleVBoundary(vb.id)} className="cursor-ew-resize">
                                    <line x1={vb.x} y1={8} x2={vb.x} y2={MAP_H - 8} stroke="transparent" strokeWidth={16} />
                                    <line x1={vb.x} y1={8} x2={vb.x} y2={MAP_H - 8} stroke={stroke} strokeWidth={vb.style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(vb.style)} strokeLinecap="round" />
                                </g>
                                <g data-ui="1" onClick={() => removeVBoundary(vb.id)} className="cursor-pointer">
                                    <circle cx={vb.x} cy={14} r={7} fill={darkMode ? '#1e293b' : '#f1f5f9'} stroke={stroke} strokeWidth={0.8} opacity={0.9} />
                                    <path d={`M ${vb.x - 2.6} ${14 - 2.6} L ${vb.x + 2.6} ${14 + 2.6} M ${vb.x + 2.6} ${14 - 2.6} L ${vb.x - 2.6} ${14 + 2.6}`} stroke={stroke} strokeWidth={1.3} />
                                </g>
                            </g>
                        ))}

                        {/* Relazioni (sotto i membri) */}
                        {m.relations.map(r => (
                            <RelationGlyph key={r.id} rel={r} pt={center} stroke={stroke} selected={selectedRel === r.id}
                                onClick={() => { setSelectedRel(selectedRel === r.id ? null : r.id); setTool(null); setPending([]); }} />
                        ))}

                        {/* Membri: simbolo del genogramma + nome */}
                        {members.map(n => {
                            const p = pos(n.id);
                            const cy = memberCY(p.level);
                            const isPending = pending.includes(n.id);
                            return (
                                <g key={n.id} transform={`translate(${p.x},${cy})`}
                                    onPointerDown={e => onMemberDown(e, n.id)}
                                    className={tool ? 'cursor-crosshair' : 'cursor-grab'} data-member="1">
                                    <rect x={-HIT_W / 2} y={-SYM / 2 - 8} width={HIT_W} height={SYM + 34} fill="transparent" />
                                    {isPending && <circle r={SYM * 0.78} fill="var(--theme-accent)" opacity={0.15} />}
                                    {isPending && <circle r={SYM * 0.78} fill="none" stroke="var(--theme-accent)" strokeWidth={1.5} strokeDasharray="4,3" />}
                                    <g transform={`translate(${-SYM / 2},${-SYM / 2})`}>
                                        <PersonSymbol node={n} darkMode={darkMode} />
                                    </g>
                                    <text y={SYM / 2 + 14} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={stroke}>
                                        {n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name}
                                    </text>
                                    {n.profession && <text y={SYM / 2 + 25} textAnchor="middle" fontSize={8} fill={stroke} opacity={0.55}>{n.profession}</text>}
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legenda */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] theme-text opacity-70">
                        {TOOLS.map(t => <span key={t.key} className="flex items-center gap-1.5"><RelPreview type={t.key} stroke={stroke} />{t.label}</span>)}
                        <span className="flex items-center gap-1.5"><svg width={34} height={14}><line x1={2} y1={7} x2={32} y2={7} stroke={stroke} strokeWidth={1.5} strokeDasharray="8,5" /></svg>Confine chiaro</span>
                        <span className="flex items-center gap-1.5"><svg width={34} height={14}><line x1={2} y1={7} x2={32} y2={7} stroke={stroke} strokeWidth={1.5} strokeDasharray="2,4" /></svg>Diffuso</span>
                        <span className="flex items-center gap-1.5"><svg width={34} height={14}><line x1={2} y1={7} x2={32} y2={7} stroke={stroke} strokeWidth={2.4} /></svg>Rigido</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MANAGER: lista mappe + creazione da selezione ---
export const MinuchinManager = ({ maps, nodes, edges, selectedNodeIds, darkMode, onChange, onClose }: {
    maps: StructuralMap[], nodes: GenNode[], edges: RelationEdge[], selectedNodeIds: string[],
    darkMode: boolean, onChange: (maps: StructuralMap[]) => void, onClose: () => void
}) => {
    const [editing, setEditing] = useState<StructuralMap | null>(null);

    const createFromSelection = () => {
        const members = nodes.filter(n => selectedNodeIds.includes(n.id));
        if (members.length < 2) { alert("Seleziona almeno 2 persone nel genogramma, poi riapri questo pannello."); return; }
        setEditing(createMapFromSelection(members, edges, `Mappa ${maps.length + 1}`));
    };
    const saveMap = (m: StructuralMap) => {
        onChange(maps.some(x => x.id === m.id) ? maps.map(x => x.id === m.id ? m : x) : [...maps, m]);
    };

    if (editing) return <MinuchinEditor map={editing} nodes={nodes} darkMode={darkMode} onSave={saveMap} onClose={() => setEditing(null)} />;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="theme-panel rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border theme-border" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 flex justify-between items-center border-b theme-border bg-black/5 dark:bg-white/5">
                    <div>
                        <h3 className="font-bold theme-text leading-tight">Mappe Strutturali</h3>
                        <span className="text-[10px] uppercase tracking-wider opacity-50 theme-text font-bold">Minuchin · terapia strutturale</span>
                    </div>
                    <button onClick={onClose} className="theme-text theme-hover p-1.5 rounded-lg"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    {maps.length === 0 && <div className="text-xs opacity-50 theme-text text-center py-6">Nessuna mappa ancora.<br />Seleziona i membri nel genogramma e creane una.</div>}
                    {maps.map(mp => (
                        <div key={mp.id} className="flex items-center gap-2 border theme-border rounded-xl p-2.5 theme-hover transition-colors">
                            <button onClick={() => setEditing(mp)} className="flex-1 text-left">
                                <div className="text-sm font-semibold theme-text">{mp.label}</div>
                                <div className="text-[10px] opacity-50 theme-text">{mp.memberIds.length} membri · {mp.relations.length} relazioni · {(mp.vBoundaries || []).length + Object.values(mp.boundaries).filter(b => b !== 'none').length} confini</div>
                            </button>
                            <button onClick={() => { if (confirm("Eliminare la mappa?")) onChange(maps.filter(x => x.id !== mp.id)); }}
                                className="text-gray-400 hover:text-red-500 p-1.5"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t theme-border">
                    <button onClick={createFromSelection}
                        className="w-full text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-sm" style={{ backgroundColor: 'var(--theme-accent)' }}>
                        <Plus size={16} /> Nuova dalla selezione ({selectedNodeIds.length} selezionati)
                    </button>
                    <div className="text-[10px] opacity-50 theme-text mt-2 text-center">
                        Le relazioni già tracciate (fusione, ostilità, armonia…) vengono tradotte in notazione Minuchin.
                    </div>
                </div>
            </div>
        </div>
    );
};
