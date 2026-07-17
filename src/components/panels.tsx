import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Check, X, Trash2, ChevronDown, Edit3, Sun, Moon, StickyNote } from 'lucide-react';
import type { NoteItem, CustomPreset, StickyNoteData } from '../types';
import { BASE_REL_CONFIG, RELATION_CATEGORIES } from '../config/relationships';
import { PRESET_THEMES, NOTE_BG_PALETTES, NOTE_TEXT_PALETTES, NOTE_FONTS, PASTEL_PALETTE, VIVID_PALETTE, NEUTRAL_PALETTE } from '../config/themes';
import { generateId } from '../utils/genogram';
import { extractYear } from '../utils/dates';
import { LinePreview } from './canvas';

export const QuickRelMenu = ({ x, y, mode, customPresets, onSelect, onClose }: { x: number, y: number, mode: 'child' | 'spouse' | 'link' | 'parents', customPresets: CustomPreset[], onSelect: (type: string) => void, onClose: () => void }) => {
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
export const GROUP_PALETTES = {
    'Pastello': PASTEL_PALETTE,
    'Vividi': VIVID_PALETTE,
    'Neutri': NEUTRAL_PALETTE
};

export const PalettePicker = ({ value, onChange }: { value: string, onChange: (c: string) => void }) => {
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
export const NotesPanel = ({ notes, onChange }: { notes: NoteItem[], onChange: (n: NoteItem[]) => void }) => {
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
// --- COMPONENTE SELETTORE TEMA CON PREVIEW ---
export const ThemeSelector = ({ currentThemeId, onChange, placement = 'bottom' }: { currentThemeId: string, onChange: (id: string) => void, placement?: 'top' | 'bottom' }) => {
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
export const StickyNotePropertiesPanel = ({
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
    const [textPaletteType, setTextPaletteType] = useState<keyof typeof NOTE_TEXT_PALETTES>('Neutri');

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
                        {Object.keys(NOTE_TEXT_PALETTES).map(key => <option key={key} value={key} className="text-black">{key}</option>)}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 p-2 border theme-border rounded bg-white/30 dark:bg-black/10">
                    {NOTE_TEXT_PALETTES[textPaletteType].map(c => (
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
