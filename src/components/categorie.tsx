// Finestra per creare o modificare una categoria di genogrammi: nome,
// colore e icona. Le categorie di serie non si modificano; le nuove sì.
import { useState } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { ICON_MAP, CATEGORY_COLORS } from '../config/categories';
import type { CategoryDef } from '../config/categories';
import { generateId } from '../utils/genogram';

export const CategoryModal = ({ category, onSave, onDelete, onClose }: {
    category?: CategoryDef | null,
    onSave: (c: CategoryDef) => void,
    onDelete?: (c: CategoryDef) => void,
    onClose: () => void,
}) => {
    const [label, setLabel] = useState(category?.label || '');
    const [color, setColor] = useState(category?.color || CATEGORY_COLORS[0]);
    const [iconKey, setIconKey] = useState(category?.iconKey || 'tag');
    const salva = () => {
        if (!label.trim()) return;
        onSave({ id: category?.id || 'cat_' + generateId(), label: label.trim().slice(0, 40), color, iconKey, custom: true });
    };
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cat-titolo" onClick={onClose}>
            <div className="theme-panel border theme-border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 id="cat-titolo" className="gp-titolo text-lg font-bold">{category ? 'Modifica categoria' : 'Nuova categoria'}</h2>
                    <button onClick={onClose} className="p-1.5 theme-hover rounded" aria-label="Chiudi"><X size={18} /></button>
                </div>
                <label className="block text-xs font-bold uppercase opacity-60">Nome
                    <input autoFocus value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salva(); }}
                        placeholder="es. Affidi, Supervisione, Tirocinio" className="mt-1 w-full border theme-border rounded-lg px-3 py-2 bg-transparent text-sm font-normal normal-case outline-none theme-text" />
                </label>
                <div>
                    <div className="text-xs font-bold uppercase opacity-60 mb-1.5">Colore</div>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORY_COLORS.map(c => (
                            <button key={c} onClick={() => setColor(c)} aria-label={'Colore ' + c} aria-pressed={color === c}
                                className="w-7 h-7 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: c, borderColor: color === c ? 'var(--theme-text)' : 'transparent' }}>
                                {color === c && <Check size={14} color="#fff" />}
                            </button>
                        ))}
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Un altro colore" className="w-7 h-7 rounded-full cursor-pointer bg-transparent" />
                    </div>
                </div>
                <div>
                    <div className="text-xs font-bold uppercase opacity-60 mb-1.5">Icona</div>
                    <div className="grid grid-cols-6 gap-1.5">
                        {Object.entries(ICON_MAP).map(([k, Icon]) => (
                            <button key={k} onClick={() => setIconKey(k)} aria-label={'Icona ' + k} aria-pressed={iconKey === k}
                                className="h-9 rounded-lg flex items-center justify-center border theme-hover" style={{ borderColor: iconKey === k ? color : 'var(--theme-border)', backgroundColor: iconKey === k ? color + '22' : 'transparent' }}>
                                <Icon size={16} color={iconKey === k ? color : undefined} />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                    {category && onDelete ? (
                        <button onClick={() => onDelete(category)} className="text-xs flex items-center gap-1 text-red-500 hover:underline"><Trash2 size={13} /> Elimina</button>
                    ) : <span />}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg theme-hover">Annulla</button>
                        <button onClick={salva} disabled={!label.trim()} className="bg-blue-600 text-white px-4 py-2 text-sm rounded-lg font-semibold disabled:opacity-40">{category ? 'Salva' : 'Crea'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
