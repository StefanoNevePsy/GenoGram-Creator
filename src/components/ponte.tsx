// Interfaccia del ponte con PsyDiary: la scelta del genogramma da mandare
// quando PsyDiary lo chiede, e l'avviso con l'esito degli scambi.
import { useMemo, useState } from 'react';
import { Send, X, Users, Search } from 'lucide-react';
import type { GenogramMeta } from '../types';

export const ScegliPerPsyDiary = ({ genograms, avviso, onScegli, onAnnulla }: {
    genograms: GenogramMeta[], avviso?: string,
    onScegli: (g: GenogramMeta) => void, onAnnulla: () => void,
}) => {
    const [cerca, setCerca] = useState('');
    const elenco = useMemo(() => [...genograms]
        .filter(g => !cerca.trim() || g.title.toLowerCase().includes(cerca.trim().toLowerCase()))
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0)), [genograms, cerca]);
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ponte-titolo">
            <div className="theme-panel border theme-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
                <div className="p-5 border-b theme-border flex items-start justify-between gap-3">
                    <div>
                        <h2 id="ponte-titolo" className="gp-titolo text-lg font-bold">Quale genogramma mandare a PsyDiary?</h2>
                        <p className="text-xs theme-text-muted mt-1">{avviso || 'PsyDiary lo allega all\'anagrafica e lo cifra. Resta anche qui.'}</p>
                    </div>
                    <button onClick={onAnnulla} className="p-1.5 theme-hover rounded" aria-label="Annulla"><X size={18} /></button>
                </div>
                <div className="px-5 pt-4">
                    <label className="flex items-center gap-2 border theme-border rounded-lg px-3 py-2 text-sm">
                        <Search size={14} className="opacity-50" />
                        <input autoFocus value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca per titolo" className="bg-transparent outline-none flex-1" aria-label="Cerca per titolo" />
                    </label>
                </div>
                <ul className="flex-1 overflow-y-auto p-3">
                    {elenco.length === 0 && <li className="p-4 text-sm theme-text-muted">Nessun genogramma su questo dispositivo.</li>}
                    {elenco.map(g => (
                        <li key={g.id}>
                            <button onClick={() => onScegli(g)} className="w-full text-left p-3 rounded-lg theme-hover flex items-center justify-between gap-3">
                                <span className="min-w-0">
                                    <span className="block font-semibold truncate">{g.title}</span>
                                    <span className="text-xs theme-text-muted flex items-center gap-2">
                                        {new Date(g.lastModified).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        <span className="flex items-center gap-1"><Users size={11} /> {g.data?.nodes?.length || 0}</span>
                                    </span>
                                </span>
                                <Send size={16} style={{ color: 'var(--theme-accent)' }} />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export const AvvisoPonte = ({ testo, onChiudi }: { testo: string, onChiudi: () => void }) => (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[210] theme-panel border theme-border shadow-xl rounded-xl px-4 py-3 text-sm flex items-center gap-3 max-w-[92vw]" role="status" aria-live="polite">
        <Send size={15} style={{ color: 'var(--theme-accent)' }} />
        <span>{testo}</span>
        <button onClick={onChiudi} className="p-1 theme-hover rounded" aria-label="Chiudi avviso"><X size={14} /></button>
    </div>
);
