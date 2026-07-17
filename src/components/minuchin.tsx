// --- MAPPE STRUTTURALI DI MINUCHIN ---
// Editor a livelli gerarchici, completamente tematizzato col tema dell'app
// (i colori arrivano CONCRETI via prop `theme`: servono anche all'export PNG,
// dove le variabili CSS non esistono). I membri usano il simbolo reale del
// genogramma (PersonSymbol). Confini orizzontali tra livelli e VERTICALI tra
// sottosistemi. Si possono creare persone direttamente dall'editor: vengono
// aggiunte al genogramma nel "cartiglio" (area di parcheggio) per l'assegnazione.
// Notazione (Minuchin, 1974): confine chiaro = tratteggiato, diffuso = puntinato,
// rigido = continuo; invischiamento = doppia linea; conflitto = zigzag;
// coalizione = doppia linea + zigzag verso il terzo; deviazione = zigzag + freccia.

import { useState, useRef } from 'react';
import { X, Plus, Trash2, Download, SeparatorVertical, UserPlus } from 'lucide-react';
import type { GenNode, RelationEdge, Gender, StructuralMap, MinuchinRelation, MinuchinRelationType, BoundaryStyle, VerticalBoundary } from '../types';
import type { AppTheme } from '../config/themes';
import { generateId } from '../utils/genogram';
import { extractYear } from '../utils/dates';
import { getZigZagPath } from '../utils/geometry';
import { PersonSymbol } from './canvas';

const MAP_W = 880, BAND_H = 128, LEVELS = 4, SYM = 40, HIT_W = 76;
const bandTop = (level: number) => 14 + level * BAND_H;
const memberCY = (level: number) => bandTop(level) + BAND_H / 2 - 10;
const MAP_H = bandTop(LEVELS) + 6;
const CONFLICT = '#dc2626';

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

const RelationGlyph = ({ rel, pt, stroke, onClick, selected, accent }: {
    rel: MinuchinRelation,
    pt: (id: string) => { x: number, y: number } | null,
    stroke: string, accent: string, onClick: () => void, selected: boolean
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
    return <g onClick={onClick} className="cursor-pointer">{hit}{body}</g>;
};

// --- EDITOR DI UNA MAPPA ---
export const MinuchinEditor = ({ map, nodes, darkMode, theme, onSave, onClose, onCreatePerson }: {
    map: StructuralMap, nodes: GenNode[], darkMode: boolean, theme: AppTheme,
    onSave: (m: StructuralMap) => void, onClose: () => void,
    onCreatePerson?: (name: string, gender: Gender) => string
}) => {
    const [m, setM] = useState<StructuralMap>(() => ({ vBoundaries: [], ...JSON.parse(JSON.stringify(map)) }));
    const [tool, setTool] = useState<MinuchinRelationType | null>(null);
    const [pending, setPending] = useState<string[]>([]);
    const [selectedRel, setSelectedRel] = useState<string | null>(null);
    const [addingPerson, setAddingPerson] = useState(false);
    const [newName, setNewName] = useState('');
    const [newGender, setNewGender] = useState<Gender>('F');
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{ kind: 'member' | 'vb', id: string, offX: number, moved: boolean } | null>(null);

    const c = theme.colors;
    const stroke = c.text;
    const muted = c.textMuted;
    const accent = c.accent;
    const members = m.memberIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GenNode[];
    const pos = (id: string) => m.positions[id] || { x: 60, level: 0 };
    const center = (id: string) => m.positions[id] ? { x: pos(id).x, y: memberCY(pos(id).level) } : null;

    const svgPoint = (e: React.PointerEvent) => {
        const r = svgRef.current!.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (MAP_W / r.width), y: (e.clientY - r.top) * (MAP_H / r.height) };
    };

    const addMemberToMap = (id: string) => {
        const used = Object.values(m.positions).filter(p => p.level === 0).map(p => p.x);
        let x = 70; while (used.some(u => Math.abs(u - x) < 90)) x += 130;
        setM(prev => ({ ...prev, memberIds: [...prev.memberIds, id], positions: { ...prev.positions, [id]: { x: Math.min(x, MAP_W - 60), level: 0 } } }));
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
        if (dragRef.current?.moved) return;
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
        clone.querySelectorAll('[data-ui="1"]').forEach(el => el.remove());
        clone.setAttribute('width', String(MAP_W * 2)); clone.setAttribute('height', String(MAP_H * 2));
        const data = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = MAP_W * 2; cv.height = MAP_H * 2;
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
            <div className="rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border"
                style={{ backgroundColor: c.bgPanel, borderColor: c.border, color: c.text }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-3 flex justify-between items-center gap-3 border-b" style={{ borderColor: c.border, backgroundColor: c.bgMain }}>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: muted }}>Mappa strutturale · Minuchin</span>
                        <input className="font-bold bg-transparent focus:outline-none truncate" style={{ color: c.text }} value={m.label}
                            onChange={e => setM(prev => ({ ...prev, label: e.target.value }))} placeholder="Titolo (es. Struttura attuale)" />
                    </div>
                    <button onClick={exportPng} className="px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 hover:opacity-70" style={{ borderColor: c.border, color: c.text }} title="Esporta PNG"><Download size={14} /> PNG</button>
                    <button onClick={() => { onSave(m); onClose(); }} className="text-xs font-semibold text-white px-3.5 py-2 rounded-lg hover:opacity-90 shadow-sm" style={{ backgroundColor: accent }}>Salva e chiudi</button>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: c.text }}><X size={18} /></button>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 flex flex-wrap items-center gap-1.5 border-b text-xs" style={{ borderColor: c.border }}>
                    {TOOLS.map(t => (
                        <button key={t.key} onClick={() => { setTool(tool === t.key ? null : t.key); setPending([]); setSelectedRel(null); }}
                            className="pl-2 pr-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all hover:opacity-80"
                            style={toolBtn(tool === t.key)}>
                            <RelPreview type={t.key} stroke={tool === t.key ? '#ffffff' : stroke} />{t.label}
                        </button>
                    ))}
                    <div className="w-px h-6 mx-1" style={{ backgroundColor: c.border }} />
                    <button onClick={addVBoundary} className="px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 hover:opacity-80" style={{ color: c.text, borderColor: c.border }}>
                        <SeparatorVertical size={14} /> Confine verticale
                    </button>
                    {onCreatePerson && (
                        <button onClick={() => setAddingPerson(!addingPerson)} className="px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 hover:opacity-80"
                            style={toolBtn(addingPerson)}>
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
                            <button key={g} onClick={() => setNewGender(g)} className="px-2.5 py-1.5 rounded-lg border hover:opacity-80"
                                style={toolBtn(newGender === g)}>{g === 'M' ? 'Maschio' : g === 'F' ? 'Femmina' : g === 'NonBinary' ? 'Non-binary' : '?'}</button>
                        ))}
                        <button onClick={submitNewPerson} disabled={!newName.trim()} className="px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40" style={{ backgroundColor: accent }}>Aggiungi</button>
                        <span style={{ color: muted }}>La persona entra nel genogramma dentro il <b>cartiglio</b>, pronta per essere assegnata.</span>
                    </div>
                )}

                <div className="flex-1 overflow-auto p-4">
                    <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full rounded-xl border"
                        style={{ backgroundColor: c.bgMain, borderColor: c.border }}
                        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                        {/* Fasce alternate + etichette livello */}
                        {Array.from({ length: LEVELS }, (_, l) => (
                            <g key={l}>
                                {l % 2 === 1 && <rect x={0} y={bandTop(l)} width={MAP_W} height={BAND_H} fill={stroke} opacity={0.035} />}
                                <g data-ui="1">
                                    <rect x={10} y={bandTop(l) + 8} rx={7} width={58} height={15} fill={accent} opacity={0.1} />
                                    <text x={39} y={bandTop(l) + 19} fontSize={8.5} fill={muted} textAnchor="middle" fontWeight={600} letterSpacing={0.5}>LIVELLO {l + 1}</text>
                                </g>
                            </g>
                        ))}

                        {/* Confini orizzontali */}
                        {Array.from({ length: LEVELS - 1 }, (_, l) => {
                            const style = m.boundaries[l] ?? 'none';
                            const y = bandTop(l + 1);
                            return (
                                <g key={l} onClick={() => cycleHBoundary(l)} className="cursor-pointer">
                                    <line x1={0} y1={y} x2={MAP_W} y2={y} stroke="transparent" strokeWidth={16} />
                                    {style !== 'none'
                                        ? <line x1={14} y1={y} x2={MAP_W - 14} y2={y} stroke={stroke} strokeWidth={style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(style)} strokeLinecap="round" />
                                        : <line data-ui="1" x1={14} y1={y} x2={MAP_W - 14} y2={y} stroke={muted} strokeWidth={1} strokeDasharray="1,7" opacity={0.35} strokeLinecap="round" />}
                                    <g data-ui="1">
                                        <rect x={MAP_W - 82} y={y - 8} rx={8} width={70} height={16} fill={stroke} opacity={0.07} />
                                        <text x={MAP_W - 47} y={y + 3.5} fontSize={8.5} fill={muted} textAnchor="middle" fontWeight={600}>{BOUNDARY_LABEL[style]}</text>
                                    </g>
                                </g>
                            );
                        })}

                        {/* Confini verticali */}
                        {(m.vBoundaries || []).map(vb => (
                            <g key={vb.id}>
                                <g onPointerDown={e => onVbDown(e, vb.id)} onClick={() => cycleVBoundary(vb.id)} className="cursor-ew-resize">
                                    <line x1={vb.x} y1={8} x2={vb.x} y2={MAP_H - 8} stroke="transparent" strokeWidth={16} />
                                    <line x1={vb.x} y1={8} x2={vb.x} y2={MAP_H - 8} stroke={stroke} strokeWidth={vb.style === 'rigid' ? 2.6 : 1.6} strokeDasharray={boundaryDash(vb.style)} strokeLinecap="round" />
                                </g>
                                <g data-ui="1" onClick={() => removeVBoundary(vb.id)} className="cursor-pointer">
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
                                    {isPending && <circle r={SYM * 0.78} fill={accent} opacity={0.15} />}
                                    {isPending && <circle r={SYM * 0.78} fill="none" stroke={accent} strokeWidth={1.5} strokeDasharray="4,3" />}
                                    <g transform={`translate(${-SYM / 2},${-SYM / 2})`}>
                                        <PersonSymbol node={n} darkMode={darkMode} />
                                    </g>
                                    <text y={SYM / 2 + 14} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={stroke}>
                                        {n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name}
                                    </text>
                                    {n.profession && <text y={SYM / 2 + 25} textAnchor="middle" fontSize={8} fill={muted}>{n.profession}</text>}
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
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MANAGER: lista mappe + creazione (da selezione o vuota) ---
export const MinuchinManager = ({ maps, nodes, edges, selectedNodeIds, darkMode, theme, onChange, onClose, onCreatePerson }: {
    maps: StructuralMap[], nodes: GenNode[], edges: RelationEdge[], selectedNodeIds: string[],
    darkMode: boolean, theme: AppTheme, onChange: (maps: StructuralMap[]) => void, onClose: () => void,
    onCreatePerson?: (name: string, gender: Gender) => string
}) => {
    const [editing, setEditing] = useState<StructuralMap | null>(null);
    const c = theme.colors;

    const createFromSelection = () => {
        const members = nodes.filter(n => selectedNodeIds.includes(n.id));
        setEditing(createMapFromSelection(members, edges, `Mappa ${maps.length + 1}`));
    };
    const createEmpty = () => setEditing(createMapFromSelection([], [], `Mappa ${maps.length + 1}`));
    const saveMap = (m: StructuralMap) => {
        onChange(maps.some(x => x.id === m.id) ? maps.map(x => x.id === m.id ? m : x) : [...maps, m]);
    };

    if (editing) return <MinuchinEditor map={editing} nodes={nodes} darkMode={darkMode} theme={theme} onSave={saveMap} onClose={() => setEditing(null)} onCreatePerson={onCreatePerson} />;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border" style={{ backgroundColor: c.bgPanel, borderColor: c.border, color: c.text }} onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 flex justify-between items-center border-b" style={{ borderColor: c.border, backgroundColor: c.bgMain }}>
                    <div>
                        <h3 className="font-bold leading-tight">Mappe Strutturali</h3>
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: c.textMuted }}>Minuchin · terapia strutturale</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    {maps.length === 0 && <div className="text-xs text-center py-6" style={{ color: c.textMuted }}>Nessuna mappa ancora.<br />Creane una vuota o dalla selezione del genogramma.</div>}
                    {maps.map(mp => (
                        <div key={mp.id} className="flex items-center gap-2 border rounded-xl p-2.5 transition-colors hover:opacity-80" style={{ borderColor: c.border }}>
                            <button onClick={() => setEditing(mp)} className="flex-1 text-left">
                                <div className="text-sm font-semibold">{mp.label}</div>
                                <div className="text-[10px]" style={{ color: c.textMuted }}>{mp.memberIds.length} membri · {mp.relations.length} relazioni · {(mp.vBoundaries || []).length + Object.values(mp.boundaries).filter(b => b !== 'none').length} confini</div>
                            </button>
                            <button onClick={() => { if (confirm("Eliminare la mappa?")) onChange(maps.filter(x => x.id !== mp.id)); }}
                                className="p-1.5 opacity-50 hover:opacity-100" style={{ color: CONFLICT }}><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t space-y-2" style={{ borderColor: c.border }}>
                    <button onClick={createEmpty}
                        className="w-full text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-sm" style={{ backgroundColor: c.accent }}>
                        <Plus size={16} /> Nuova mappa vuota
                    </button>
                    <button onClick={createFromSelection} disabled={selectedNodeIds.length < 2}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-80" style={{ borderColor: c.border, color: c.text }}>
                        <Plus size={16} /> Dalla selezione ({selectedNodeIds.length} selezionati)
                    </button>
                    <div className="text-[10px] text-center" style={{ color: c.textMuted }}>
                        Nella mappa vuota puoi creare persone al volo: entrano nel genogramma dentro il <b>cartiglio</b>.
                    </div>
                </div>
            </div>
        </div>
    );
};
