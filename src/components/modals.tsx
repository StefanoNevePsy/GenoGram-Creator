import { useState, useMemo } from 'react';
import { X, Search, Check, Download, Upload, Database, FileText, Users, AlignJustify, ArrowDownToLine, ArrowUpToLine, Circle, CircleDashed, Cloud, Edit3, GitBranch, Grid3X3, Grip, Heart, HelpCircle, Info, LayoutGrid, MousePointer2, Network, Plus, Settings, Square, Sun, TrendingUp, UserPlus, Waypoints } from 'lucide-react';
import type { GenNode, RelationEdge, NodeGroup, CustomPreset, ReportOptions } from '../types';
import { BASE_REL_CONFIG, RELATION_CATEGORIES } from '../config/relationships';
import { calculateAge } from '../utils/dates';
import { generateId } from '../utils/genogram';
import { LinePreview, RelationshipSelector } from './canvas';

export const ReportModal = ({ onClose, nodes, edges, groups }: { onClose: () => void, nodes: GenNode[], edges: RelationEdge[], groups: NodeGroup[] }) => {
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const personStats = useMemo(() => {
        if (!selectedPerson) return null;
        const person = nodes.find(n => n.id === selectedPerson);
        if (!person) return null;

        // Partner/Spouses
        const spouseEdges = edges.filter(e =>
            (e.fromId === selectedPerson || e.toId === selectedPerson) &&
            RELATION_CATEGORIES["Struttura / Coppia"].includes(e.type)
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
            if (RELATION_CATEGORIES["Struttura / Coppia"].includes(e.type)) return null;
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
export const SettingsModal = ({ onClose, onExport, onImport, setCustomUser, customUser, setFirebaseConfig, firebaseConfig }: any) => {
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
export const InstructionsModal = ({ onClose, firebaseConfig }: { onClose: () => void, firebaseConfig: string }) => {
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

export const StyleDesignerModal = ({ onClose, onSave }: { onClose: () => void, onSave: (preset: CustomPreset) => void }) => {
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
export const ReportConfigModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (opts: ReportOptions) => void }) => {
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
