// --- MAPPE STRUTTURALI DI MINUCHIN ---
// Editor a livelli gerarchici: i membri si trascinano tra le fasce (livelli),
// i confini tra livelli si ciclano cliccandoli (chiaro/diffuso/rigido/nessuno),
// le relazioni si tracciano scegliendo uno strumento e cliccando i membri.
// Notazione (Minuchin, 1974): confine chiaro = tratteggiato, diffuso = puntinato,
// rigido = continuo; invischiamento = doppia linea; conflitto = zigzag;
// coalizione = doppia linea + zigzag verso il terzo; deviazione = zigzag + freccia.

import { useState, useRef } from 'react';
import { X, Plus, Trash2, Download } from 'lucide-react';
import type { GenNode, RelationEdge, StructuralMap, MinuchinRelation, MinuchinRelationType, BoundaryStyle } from '../types';
import { generateId } from '../utils/genogram';
import { extractYear } from '../utils/dates';
import { getZigZagPath } from '../utils/geometry';

const MAP_W = 860, BAND_H = 110, LEVELS = 4, BOX_W = 96, BOX_H = 34;
const bandTop = (level: number) => 16 + level * BAND_H;
const memberCY = (level: number) => bandTop(level) + BAND_H / 2;

const TOOLS: { key: MinuchinRelationType, label: string, needsThird: boolean }[] = [
    { key: 'alliance', label: 'Alleanza', needsThird: false },
    { key: 'overinvolvement', label: 'Invischiamento', needsThird: false },
    { key: 'conflict', label: 'Conflitto', needsThird: false },
    { key: 'coalition', label: 'Coalizione (A+B vs C)', needsThird: true },
    { key: 'detouring', label: 'Deviazione (A-B su C)', needsThird: true },
];

const BOUNDARY_CYCLE: BoundaryStyle[] = ['clear', 'diffuse', 'rigid', 'none'];
const BOUNDARY_LABEL: Record<BoundaryStyle, string> = { clear: 'Confine chiaro', diffuse: 'Confine diffuso', rigid: 'Confine rigido', none: '(nessun confine)' };
const boundaryDash = (b: BoundaryStyle) => b === 'clear' ? '10,6' : b === 'diffuse' ? '2,4' : undefined;

// Traduzione automatica delle relazioni del genogramma in notazione Minuchin
const REL_TO_MINUCHIN: Record<string, MinuchinRelationType> = {
    'fusion': 'overinvolvement', 'close': 'overinvolvement',
    'hostile': 'conflict', 'hate': 'conflict', 'close-hostile': 'conflict', 'fusion-hostile': 'conflict',
    'harmony': 'alliance', 'friendship': 'alliance', 'best-friend': 'alliance', 'in-love': 'alliance',
};

// Crea una mappa da una selezione di nodi: livelli per generazione anagrafica
// (euristica: >16 anni di distanza dal più anziano → livello inferiore) e
// relazioni pre-compilate traducendo quelle già tracciate nel genogramma.
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
        positions[m.id] = { x: 40 + idx * (BOX_W + 40), level };
    });
    const memberSet = new Set(members.map(m => m.id));
    const relations: MinuchinRelation[] = edges
        .filter(e => memberSet.has(e.fromId) && memberSet.has(e.toId) && REL_TO_MINUCHIN[e.type])
        .map(e => ({ id: generateId(), fromId: e.fromId, toId: e.toId, type: REL_TO_MINUCHIN[e.type] }));
    return { id: generateId(), label, memberIds: members.map(m => m.id), positions, boundaries: { 0: 'clear' }, relations, notes: [] };
};

// --- RENDERING DI UNA SINGOLA RELAZIONE ---
const RelationGlyph = ({ rel, pt, stroke, onClick, selected }: {
    rel: MinuchinRelation,
    pt: (id: string) => { x: number, y: number } | null,
    stroke: string, onClick: () => void, selected: boolean
}) => {
    const a = pt(rel.fromId); const b = pt(rel.toId);
    if (!a || !b) return null;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const col = selected ? '#3b82f6' : (rel.type === 'conflict' || rel.type === 'detouring' ? '#dc2626' : stroke);
    const hit = <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />;
    const dbl = (off: number) => {
        const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * off, ny = dx / len * off;
        return <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} stroke={col} strokeWidth={1.5} />;
    };
    let body = null;
    if (rel.type === 'alliance') body = <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={1.5} />;
    if (rel.type === 'overinvolvement') body = <g>{dbl(2.5)}{dbl(-2.5)}</g>;
    if (rel.type === 'conflict') body = <path d={getZigZagPath(a.x, a.y, b.x, b.y, 4, 10)} stroke={col} strokeWidth={1.5} fill="none" />;
    if (rel.type === 'coalition' || rel.type === 'detouring') {
        const c = rel.thirdId ? pt(rel.thirdId) : null;
        const toC = c ? (rel.type === 'coalition'
            ? <path d={getZigZagPath(mid.x, mid.y, c.x, c.y, 4, 10)} stroke="#dc2626" strokeWidth={1.5} fill="none" />
            : <g>
                <line x1={mid.x} y1={mid.y} x2={c.x} y2={c.y} stroke="#dc2626" strokeWidth={1.5} />
                <polygon points="-6,-4 4,0 -6,4" fill="#dc2626" transform={`translate(${c.x},${c.y}) rotate(${Math.atan2(c.y - mid.y, c.x - mid.x) * 180 / Math.PI}) translate(-10,0)`} />
            </g>) : null;
        body = <g>
            {rel.type === 'coalition' ? <g>{dbl(2.5)}{dbl(-2.5)}</g> : <path d={getZigZagPath(a.x, a.y, b.x, b.y, 4, 10)} stroke={col} strokeWidth={1.5} fill="none" />}
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
    const [m, setM] = useState<StructuralMap>(() => JSON.parse(JSON.stringify(map)));
    const [tool, setTool] = useState<MinuchinRelationType | null>(null);
    const [pending, setPending] = useState<string[]>([]); // membri cliccati in attesa
    const [selectedRel, setSelectedRel] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{ id: string, offX: number } | null>(null);

    const stroke = darkMode ? '#e5e7eb' : '#1f2937';
    const members = m.memberIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GenNode[];
    const pos = (id: string) => m.positions[id] || { x: 40, level: 0 };
    const center = (id: string) => m.positions[id] ? { x: pos(id).x + BOX_W / 2, y: memberCY(pos(id).level) } : null;
    const mapH = bandTop(LEVELS) + 8;

    const svgPoint = (e: React.PointerEvent) => {
        const r = svgRef.current!.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (MAP_W / r.width), y: (e.clientY - r.top) * (mapH / r.height) };
    };

    const onMemberDown = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        if (tool) {
            // Modalità tracciamento relazione
            const next = [...pending, id];
            const needsThird = TOOLS.find(t => t.key === tool)!.needsThird;
            const needed = needsThird ? 3 : 2;
            if (next.length >= needed) {
                setM(prev => ({
                    ...prev,
                    relations: [...prev.relations, { id: generateId(), fromId: next[0], toId: next[1], type: tool, thirdId: needsThird ? next[2] : undefined }]
                }));
                setPending([]); setTool(null);
            } else setPending(next);
            return;
        }
        const p = svgPoint(e);
        dragRef.current = { id, offX: p.x - pos(id).x };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: React.PointerEvent) => {
        if (!dragRef.current) return;
        const p = svgPoint(e);
        const level = Math.max(0, Math.min(LEVELS - 1, Math.floor((p.y - 16) / BAND_H)));
        const x = Math.max(4, Math.min(MAP_W - BOX_W - 4, p.x - dragRef.current.offX));
        const id = dragRef.current.id;
        setM(prev => ({ ...prev, positions: { ...prev.positions, [id]: { x, level } } }));
    };
    const onUp = () => { dragRef.current = null; };

    const cycleBoundary = (level: number) => {
        setM(prev => {
            const cur = prev.boundaries[level] ?? 'none';
            const next = BOUNDARY_CYCLE[(BOUNDARY_CYCLE.indexOf(cur) + 1) % BOUNDARY_CYCLE.length];
            return { ...prev, boundaries: { ...prev.boundaries, [level]: next } };
        });
    };

    const exportPng = () => {
        if (!svgRef.current) return;
        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('width', String(MAP_W * 2)); clone.setAttribute('height', String(mapH * 2));
        const data = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = MAP_W * 2; cv.height = mapH * 2;
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
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="theme-panel rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-3 flex justify-between items-center border-b theme-border gap-3">
                    <input className="font-bold text-sm bg-transparent border-b theme-border flex-1 theme-text focus:outline-none" value={m.label}
                        onChange={e => setM(prev => ({ ...prev, label: e.target.value }))} placeholder="Titolo mappa (es. Struttura attuale)" />
                    <button onClick={exportPng} className="theme-text theme-hover p-1.5 rounded" title="Esporta PNG"><Download size={16} /></button>
                    <button onClick={() => { onSave(m); onClose(); }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Salva e chiudi</button>
                    <button onClick={onClose} className="theme-text theme-hover p-1 rounded"><X size={18} /></button>
                </div>

                {/* Strumenti relazione */}
                <div className="px-3 py-2 flex flex-wrap items-center gap-2 border-b theme-border text-xs">
                    <span className="opacity-50 theme-text">Relazioni:</span>
                    {TOOLS.map(t => (
                        <button key={t.key} onClick={() => { setTool(tool === t.key ? null : t.key); setPending([]); setSelectedRel(null); }}
                            className={`px-2 py-1 rounded border transition-colors ${tool === t.key ? 'bg-blue-600 text-white border-blue-600' : 'theme-border theme-text theme-hover'}`}>
                            {t.label}
                        </button>
                    ))}
                    {tool && <span className="theme-text opacity-70 animate-pulse">→ clicca {pending.length === 0 ? 'il primo membro' : pending.length === 1 ? 'il secondo membro' : 'il terzo membro (bersaglio)'}</span>}
                    {selectedRel && (
                        <button onClick={() => { setM(prev => ({ ...prev, relations: prev.relations.filter(r => r.id !== selectedRel) })); setSelectedRel(null); }}
                            className="px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 flex items-center gap-1"><Trash2 size={12} /> Elimina relazione</button>
                    )}
                    <span className="ml-auto opacity-50 theme-text hidden md:inline">Trascina i membri tra i livelli • clicca le linee orizzontali per cambiare il confine</span>
                </div>

                <div className="flex-1 overflow-auto p-3">
                    <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${mapH}`} className="w-full border theme-border rounded bg-white dark:bg-gray-900"
                        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                        {/* Fasce livelli */}
                        {Array.from({ length: LEVELS }, (_, l) => (
                            <text key={l} x={8} y={bandTop(l) + 14} fontSize={9} fill={stroke} opacity={0.35}>Livello {l + 1}</text>
                        ))}
                        {/* Confini tra livelli (cliccabili) */}
                        {Array.from({ length: LEVELS - 1 }, (_, l) => {
                            const style = m.boundaries[l] ?? 'none';
                            const y = bandTop(l + 1);
                            return (
                                <g key={l} onClick={() => cycleBoundary(l)} className="cursor-pointer">
                                    <line x1={0} y1={y} x2={MAP_W} y2={y} stroke="transparent" strokeWidth={14} />
                                    {style !== 'none' && <line x1={12} y1={y} x2={MAP_W - 12} y2={y} stroke={stroke} strokeWidth={style === 'rigid' ? 2.5 : 1.5} strokeDasharray={boundaryDash(style)} />}
                                    <text x={MAP_W - 14} y={y - 5} fontSize={9} fill={stroke} opacity={0.45} textAnchor="end">{BOUNDARY_LABEL[style]}</text>
                                </g>
                            );
                        })}
                        {/* Relazioni sotto i membri */}
                        {m.relations.map(r => (
                            <RelationGlyph key={r.id} rel={r} pt={center} stroke={stroke} selected={selectedRel === r.id}
                                onClick={() => { setSelectedRel(selectedRel === r.id ? null : r.id); setTool(null); setPending([]); }} />
                        ))}
                        {/* Membri */}
                        {members.map(n => {
                            const p = pos(n.id);
                            const isPending = pending.includes(n.id);
                            return (
                                <g key={n.id} transform={`translate(${p.x},${memberCY(p.level) - BOX_H / 2})`}
                                    onPointerDown={e => onMemberDown(e, n.id)}
                                    className={tool ? 'cursor-crosshair' : 'cursor-grab'}>
                                    <rect width={BOX_W} height={BOX_H} rx={6} fill={darkMode ? '#1f2937' : '#f9fafb'}
                                        stroke={isPending ? '#3b82f6' : stroke} strokeWidth={isPending ? 2.5 : 1.2} />
                                    <text x={BOX_W / 2} y={BOX_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={stroke}>
                                        {n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legenda notazione */}
                    <div className="mt-2 text-[10px] theme-text opacity-60 flex flex-wrap gap-x-4 gap-y-1">
                        <span>— — Confine chiaro</span><span>···· Confine diffuso</span><span>—— Confine rigido</span>
                        <span>═ Invischiamento</span><span>⌇ Conflitto</span><span>═+⌇ Coalizione</span><span>⌇→ Deviazione</span>
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
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="theme-panel rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center border-b theme-border">
                    <h3 className="font-bold theme-text">Mappe Strutturali (Minuchin)</h3>
                    <button onClick={onClose} className="theme-text theme-hover p-1 rounded"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    {maps.length === 0 && <div className="text-xs opacity-50 theme-text text-center py-4">Nessuna mappa. Seleziona i membri nel genogramma e creane una.</div>}
                    {maps.map(mp => (
                        <div key={mp.id} className="flex items-center gap-2 border theme-border rounded p-2">
                            <button onClick={() => setEditing(mp)} className="flex-1 text-left text-sm theme-text hover:underline">
                                {mp.label} <span className="opacity-50 text-xs">({mp.memberIds.length} membri, {mp.relations.length} relazioni)</span>
                            </button>
                            <button onClick={() => { if (confirm("Eliminare la mappa?")) onChange(maps.filter(x => x.id !== mp.id)); }}
                                className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t theme-border">
                    <button onClick={createFromSelection}
                        className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
                        <Plus size={16} /> Nuova dalla selezione ({selectedNodeIds.length} selezionati)
                    </button>
                    <div className="text-[10px] opacity-50 theme-text mt-2 text-center">
                        Le relazioni già tracciate nel genogramma (fusione, ostilità, armonia…) vengono tradotte automaticamente in notazione Minuchin.
                    </div>
                </div>
            </div>
        </div>
    );
};
