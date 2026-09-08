// --- VISTA A ELENCO DELLE PERSONE ---
// Il canvas SVG è opaco per uno screen reader e non navigabile da tastiera:
// questo pannello è la rappresentazione testuale equivalente del genogramma.
// Risolve in un colpo accessibilità, ricerca e selezione rapida su schermi
// piccoli, dove colpire un simbolo da 40px è scomodo.

import { useMemo, useRef, useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import type { GenNode, RelationEdge } from '../types';
import type { AppTheme } from '../config/themes';
import { BASE_REL_CONFIG } from '../config/relationships';
import { calculateAge, calculateAgeAtDeath } from '../utils/dates';
import { PersonSymbol } from './canvas';

// Descrizione parlata di una persona: è ciò che annuncia lo screen reader,
// quindi include i marcatori clinici, non solo il nome.
export const describePerson = (n: GenNode, edges: RelationEdge[]): string => {
    const parts: string[] = [n.name || 'Senza nome'];
    const genders: Record<string, string> = {
        M: 'maschio', F: 'femmina', TransWoman: 'donna trans', TransMan: 'uomo trans',
        NonBinary: 'non binario', Pet: 'animale', Pregnancy: 'gravidanza',
        Miscarriage: 'aborto spontaneo', Abortion: 'aborto volontario', Stillbirth: 'morto alla nascita',
    };
    if (genders[n.gender]) parts.push(genders[n.gender]);
    if (n.birthDate) {
        parts.push(n.deceased && n.deathDate
            ? `${calculateAgeAtDeath(n.birthDate, n.deathDate)} anni al decesso`
            : `${calculateAge(n.birthDate)} anni`);
    }
    if (n.deceased) parts.push('deceduta');
    if (n.indexPerson) parts.push('paziente designato');
    if (n.profession) parts.push(n.profession);
    const flags: [boolean | undefined, string][] = [
        [n.substanceAbuse, 'abuso droghe'], [n.alcoholAbuse, 'abuso alcol'],
        [n.mentalIssue, 'problema psicologico'], [n.physicalIssue, 'problema fisico'],
        [n.behavioralAddiction, 'dipendenza comportamentale'], [n.eatingDisorder, 'disturbo alimentare'],
        [n.institutionalized, 'istituzionalizzato'], [n.disability, 'disabilità'],
        [n.recovery, 'in recovery'], [n.donorConceived, 'concepito con donazione'],
    ];
    flags.forEach(([on, label]) => { if (on) parts.push(label); });
    const rel = edges.filter(e => e.fromId === n.id || e.toId === n.id).length;
    parts.push(rel === 1 ? '1 relazione' : `${rel} relazioni`);
    return parts.join(', ');
};

export const PeopleListPanel = ({ nodes, edges, selectedNodeIds, darkMode, theme, onSelect, onClose }: {
    nodes: GenNode[], edges: RelationEdge[], selectedNodeIds: string[],
    darkMode: boolean, theme: AppTheme,
    onSelect: (id: string, opts?: { additive?: boolean }) => void, onClose: () => void
}) => {
    const [query, setQuery] = useState('');
    const listRef = useRef<HTMLDivElement>(null);
    const c = theme.colors;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = q
            ? nodes.filter(n => describePerson(n, edges).toLowerCase().includes(q))
            : nodes;
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it'));
    }, [nodes, edges, query]);

    // Frecce su/giù per scorrere l'elenco senza uscire dalla tastiera
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-person]') || []);
        if (!items.length) return;
        e.preventDefault();
        const i = items.findIndex(el => el === document.activeElement);
        const next = e.key === 'ArrowDown'
            ? items[i < 0 ? 0 : Math.min(i + 1, items.length - 1)]
            : items[i <= 0 ? 0 : i - 1];
        next?.focus();
    };

    return (
        <aside aria-label="Elenco persone del genogramma"
            className="w-72 border-r flex flex-col h-full print:hidden shrink-0"
            style={{ backgroundColor: c.bgPanel, borderColor: c.border, color: c.text }}>
            <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2" style={{ borderColor: c.border }}>
                <h2 className="font-bold text-sm flex items-center gap-2"><Users size={16} /> Persone
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.accent + '22', color: c.accent }}>{nodes.length}</span>
                </h2>
                <button onClick={onClose} title="Chiudi elenco" aria-label="Chiudi elenco" className="p-1 rounded hover:opacity-70"><X size={16} /></button>
            </div>

            <div className="p-2 border-b" style={{ borderColor: c.border }}>
                <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
                    <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
                        placeholder="Cerca per nome, età, marcatore…" aria-label="Cerca persona"
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded border bg-transparent focus:outline-none focus:ring-1"
                        style={{ borderColor: c.border, color: c.text }} />
                </div>
            </div>

            <div ref={listRef} onKeyDown={onKeyDown} className="flex-1 overflow-y-auto custom-scrollbar" role="listbox" aria-label="Persone">
                {filtered.length === 0 && (
                    <p className="text-xs text-center py-6 px-3" style={{ color: c.textMuted }}>
                        {nodes.length === 0 ? 'Nessuna persona nel genogramma.' : `Nessun risultato per "${query}".`}
                    </p>
                )}
                {filtered.map(n => {
                    const sel = selectedNodeIds.includes(n.id);
                    return (
                        <button key={n.id} data-person={n.id} role="option" aria-selected={sel}
                            aria-label={describePerson(n, edges)}
                            onClick={e => onSelect(n.id, { additive: e.shiftKey })}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left border-b transition-colors"
                            style={{ borderColor: c.border, backgroundColor: sel ? c.accent + '1A' : undefined }}>
                            <svg width={26} height={26} viewBox="0 0 40 40" className="shrink-0" aria-hidden="true">
                                <PersonSymbol node={n} darkMode={darkMode} />
                            </svg>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold truncate">{n.name || 'Senza nome'}</span>
                                <span className="block text-[10px] truncate" style={{ color: c.textMuted }}>
                                    {describePerson(n, edges).split(', ').slice(1).join(' · ')}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Relazioni della persona selezionata: il canvas non le rende leggibili a voce */}
            {selectedNodeIds.length === 1 && (() => {
                const id = selectedNodeIds[0];
                const rels = edges.filter(e => e.fromId === id || e.toId === id);
                if (rels.length === 0) return null;
                return (
                    <div className="border-t p-2 max-h-40 overflow-y-auto custom-scrollbar" style={{ borderColor: c.border }}>
                        <div className="text-[9px] font-bold uppercase opacity-50 px-1 pb-1">Relazioni</div>
                        <ul className="space-y-0.5">
                            {rels.map(e => {
                                const other = nodes.find(n => n.id === (e.fromId === id ? e.toId : e.fromId));
                                const label = BASE_REL_CONFIG[e.type]?.label || e.type;
                                return (
                                    <li key={e.id} className="text-[11px] px-1 truncate">
                                        <span style={{ color: c.textMuted }}>{label}</span> — {other?.name || 'gruppo'}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })()}
        </aside>
    );
};
