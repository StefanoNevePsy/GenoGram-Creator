// --- IMPORT DI UN GENOGRAMMA DA IMMAGINE ---
// Ricostruisce struttura e persone da una foto o da una scansione, e la mostra
// sovrapposta all'originale PRIMA di importare: chi guarda deve poter vedere
// cosa è stato capito e cosa no, perché nessun riconoscimento è esatto e
// correggere dopo, su venti persone, costa più che rifare.
//
// I parametri di lettura si tarano da soli (vedi autoAnalyzeGenogramImage);
// i comandi manuali restano, sotto, per i casi che la taratura sbaglia.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, Loader2, Users, Link2, SlidersHorizontal, ScanLine, Type } from 'lucide-react';
import type { DetectOptions, AutoAnalyzeResult, DetectedPerson, DetectedLink } from '../utils/imageImport';
import { autoAnalyzeGenogramImage, analyzeGenogramImage, mapToCanvas } from '../utils/imageImport';
import type { PersonLabels } from '../utils/ocr';
import { birthDateFrom } from '../utils/ocr';
import type { Gender } from '../types';

// Oltre questa risoluzione non si guadagna niente e si paga in secondi: una
// foto da telefono porta simboli da 200px dove ne bastano 40.
const MAX_SIDE = 1600;

export interface ImportedPerson { x: number; y: number; gender: Gender; deceased: boolean; name: string; birthDate: string }
export interface ImportedLink { a: number; b: number; kind: DetectedLink['kind'] }

const GENDER_COLOR: Record<string, string> = { M: '#0ea5e9', F: '#ec4899', NonBinary: '#a855f7' };

export const ImageImportModal = ({ onClose, onImport }: {
    onClose: () => void,
    onImport: (people: ImportedPerson[], links: ImportedLink[]) => void,
}) => {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [result, setResult] = useState<AutoAnalyzeResult | null>(null);
    const [opts, setOpts] = useState<DetectOptions>({});
    const [advanced, setAdvanced] = useState(false);
    const [withLinks, setWithLinks] = useState(true);
    const [labels, setLabels] = useState<PersonLabels[] | null>(null);
    const [ocr, setOcr] = useState<{ done: number, total: number } | null>(null);
    const imgRef = useRef<ImageData | null>(null);
    const srcRef = useRef<HTMLCanvasElement | null>(null);
    const previewRef = useRef<HTMLCanvasElement>(null);

    // Disegna l'originale con sopra ciò che è stato riconosciuto.
    const paint = useCallback((res: AutoAnalyzeResult | null) => {
        const cv = previewRef.current, src = srcRef.current;
        if (!cv || !src) return;
        cv.width = src.width; cv.height = src.height;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(src, 0, 0);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(0, 0, cv.width, cv.height);
        if (!res) return;

        const s = Math.max(1, cv.width / 900);
        ctx.lineWidth = 2 * s;
        res.links.forEach(l => {
            const A = res.people[l.a], B = res.people[l.b];
            if (!A || !B) return;
            ctx.strokeStyle = l.kind === 'child' ? 'rgba(20,160,90,.75)' : 'rgba(220,60,60,.8)';
            ctx.setLineDash(l.kind === 'child' ? [5 * s, 4 * s] : []);
            ctx.beginPath();
            ctx.moveTo(A.cx, A.cy); ctx.lineTo(B.cx, B.cy);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        res.people.forEach((p, i) => {
            ctx.strokeStyle = GENDER_COLOR[p.gender] || '#f59e0b';
            ctx.lineWidth = (p.confidence >= 0.8 ? 3 : 1.5) * s;
            ctx.strokeRect(p.cx - p.w / 2, p.cy - p.h / 2, p.w, p.h);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = `bold ${11 * s}px system-ui, sans-serif`;
            ctx.fillText(String(i + 1), p.cx - p.w / 2, p.cy - p.h / 2 - 3 * s);
        });
    }, []);

    const run = useCallback((o: DetectOptions, auto: boolean) => {
        const data = imgRef.current;
        if (!data) return;
        setBusy(true); setErr('');
        // un frame di respiro, così lo spinner compare prima del blocco di calcolo
        setTimeout(() => {
            try {
                const res = auto
                    ? autoAnalyzeGenogramImage(data, o)
                    : { ...analyzeGenogramImage(data, o), options: o, score: 0, attempts: [] };
                setResult(res);
                setLabels(null);
                setOpts(res.options);
                paint(res);
                if (res.people.length === 0) setErr('Nessun simbolo riconosciuto. Prova a ritagliare l\'immagine attorno al genogramma, o regola i comandi avanzati.');
            } catch (e) {
                setErr('Lettura non riuscita: ' + (e as Error).message);
            } finally { setBusy(false); }
        }, 30);
    }, [paint]);

    const load = useCallback((file: File) => {
        setErr(''); setResult(null); setBusy(true);
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.naturalWidth * scale);
            cv.height = Math.round(img.naturalHeight * scale);
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            if (!ctx) { setErr('Canvas non disponibile.'); setBusy(false); return; }
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            srcRef.current = cv;
            imgRef.current = ctx.getImageData(0, 0, cv.width, cv.height);
            setBusy(false);
            run({}, true);
        };
        img.onerror = () => { URL.revokeObjectURL(url); setErr('Immagine non leggibile.'); setBusy(false); };
        img.src = url;
    }, [run]);

    useEffect(() => { if (result) paint(result); }, [result, paint]);

    // Il riconoscimento del testo è a richiesta: carica qualche megabyte di
    // motore e impiega secondi, e a molti basta la struttura.
    const readLabels = async () => {
        const src = srcRef.current;
        if (!result || !src) return;
        setErr(''); setOcr({ done: 0, total: 1 });
        try {
            const { readPersonLabels } = await import('../utils/ocr');
            const got = await readPersonLabels(src, result.people, result.texts,
                (done, total) => setOcr({ done, total }));
            setLabels(got);
            if (got.every(l => !l.name && !l.birthYear && !l.age)) {
                setErr('Nessuna scritta leggibile: le persone saranno importate senza nome.');
            }
        } catch (e) {
            setErr('Lettura delle scritte non riuscita: ' + (e as Error).message);
        } finally { setOcr(null); }
    };

    const confirm = () => {
        if (!result) return;
        const placed = mapToCanvas(result.people, { centerX: 0, centerY: 0, nodeSize: 40, snap: 0 });
        const people: ImportedPerson[] = placed.map((p, i) => {
            const l = labels?.[i];
            return {
                x: p.x, y: p.y,
                gender: (p.gender === 'NonBinary' ? 'NonBinary' : p.gender) as Gender,
                deceased: p.deceased,
                name: l?.name || `Persona ${i + 1}`,
                birthDate: l ? birthDateFrom(l) : '',
            };
        });
        const links: ImportedLink[] = withLinks
            ? result.links.map(l => ({ a: l.a, b: l.b, kind: l.kind }))
            : [];
        onImport(people, links);
    };

    const set = (patch: DetectOptions) => {
        const next = { ...opts, ...patch };
        setOpts(next);
        run(next, false);
    };

    const counts = result
        ? {
            people: result.people.length,
            partner: result.links.filter(l => l.kind !== 'child').length,
            child: result.links.filter(l => l.kind === 'child').length,
        }
        : null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-panel w-full max-w-4xl max-h-[92vh] rounded-xl shadow-2xl border theme-border overflow-hidden flex flex-col">
                <div className="p-4 border-b theme-border bg-black/5 dark:bg-white/5 flex justify-between items-center shrink-0">
                    <h3 className="font-bold flex items-center gap-2 theme-text"><ScanLine size={18} /> Importa da immagine</h3>
                    <button onClick={onClose} aria-label="Chiudi"><X size={18} className="theme-text opacity-50 hover:opacity-100" /></button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {!imgRef.current && (
                        <label className="block border-2 border-dashed theme-border rounded-xl p-8 text-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                            <input type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) load(f); }} />
                            <Upload size={28} className="mx-auto mb-2 opacity-50 theme-text" />
                            <div className="font-semibold text-sm theme-text">Scegli la foto o la scansione di un genogramma</div>
                            <div className="text-xs opacity-60 theme-text mt-1">
                                Funziona su genogrammi stampati e su quelli disegnati a mano. Vengono ricostruite le
                                persone e chi è legato a chi: il tipo di ogni relazione lo imposti tu dopo.
                            </div>
                        </label>
                    )}

                    {busy && (
                        <div className="flex items-center justify-center gap-2 py-6 theme-text">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">Lettura dell'immagine…</span>
                        </div>
                    )}

                    {err && <div className="text-xs p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">{err}</div>}

                    <canvas ref={previewRef} className={`w-full rounded-lg border theme-border ${imgRef.current ? '' : 'hidden'}`} />

                    {counts && (
                        <div className="flex flex-wrap items-center gap-3 text-xs theme-text">
                            <span className="flex items-center gap-1.5 font-semibold"><Users size={14} /> {counts.people} persone</span>
                            <span className="flex items-center gap-1.5"><Link2 size={14} /> {counts.partner} unioni · {counts.child} legami genitore-figlio</span>
                            <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                                <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600" checked={withLinks} onChange={e => setWithLinks(e.target.checked)} />
                                Importa anche i legami
                            </label>
                        </div>
                    )}

                    {result && result.people.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 text-xs theme-text">
                            {ocr ? (
                                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />
                                    Lettura delle scritte… {ocr.done}/{ocr.total}</span>
                            ) : (
                                <button onClick={readLabels} className="px-2.5 py-1.5 rounded-lg border theme-border hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1.5">
                                    <Type size={13} /> {labels ? 'Rileggi' : 'Recupera nomi ed età'}
                                </button>
                            )}
                            {labels && !ocr && (
                                <span className="opacity-70">
                                    {labels.filter(l => l.name).length} nomi · {labels.filter(l => l.birthYear || l.age).length} date
                                </span>
                            )}
                            {!labels && !ocr && <span className="opacity-60">Senza questo passaggio le persone arrivano come «Persona 1, 2, 3…».</span>}
                        </div>
                    )}

                    {labels && !ocr && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] theme-text">
                            {labels.map((l, i) => (
                                <div key={i} className="px-2 py-1 rounded border theme-border truncate" title={`${l.name || ''} ${l.birthYear || ''}`}>
                                    <span className="opacity-50">{i + 1}.</span>{' '}
                                    <span className={l.name ? 'font-semibold' : 'opacity-50 italic'}>{l.name || 'senza nome'}</span>
                                    {(l.birthYear || l.age) && <span className="opacity-60"> · {l.birthYear || `${l.age} anni`}</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {result && (
                        <div>
                            <button onClick={() => setAdvanced(a => !a)} className="text-xs flex items-center gap-1.5 opacity-70 hover:opacity-100 theme-text">
                                <SlidersHorizontal size={13} /> {advanced ? 'Nascondi' : 'Mostra'} comandi di lettura
                            </button>
                            {advanced && (
                                <div className="mt-3 p-3 rounded-lg bg-black/5 dark:bg-white/5 space-y-3 text-xs theme-text">
                                    <p className="opacity-70">
                                        Regolali solo se il riquadro sopra sbaglia. Più chiusura salda i tratti
                                        interrotti di un disegno a mano; la sigillatura recupera i contorni che non
                                        chiudono, ma su una stampa nitida può inventare simboli fra le lettere.
                                    </p>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600"
                                            checked={!!opts.adaptive} onChange={e => set({ adaptive: e.target.checked })} />
                                        Soglia locale (foto con luce non uniforme)
                                    </label>
                                    <label className="block">
                                        <span className="opacity-70">Chiusura dei tratti interrotti: {opts.closeGaps ?? 0}px</span>
                                        <input type="range" min={0} max={10} value={opts.closeGaps ?? 0}
                                            onChange={e => set({ closeGaps: +e.target.value })} className="w-full accent-blue-600" />
                                    </label>
                                    <label className="block">
                                        <span className="opacity-70">Sigillatura dei contorni aperti: {opts.leakSeal ?? 0}px</span>
                                        <input type="range" min={0} max={6} value={opts.leakSeal ?? 0}
                                            onChange={e => set({ leakSeal: +e.target.value })} className="w-full accent-blue-600" />
                                    </label>
                                    <button onClick={() => run({}, true)} className="px-2 py-1 rounded border theme-border hover:bg-black/5 dark:hover:bg-white/10">
                                        Ritara da capo
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t theme-border flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm theme-text hover:bg-black/5 dark:hover:bg-white/10">Annulla</button>
                    <button onClick={confirm} disabled={!result || result.people.length === 0 || busy}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700">
                        Importa {counts ? `${counts.people} persone` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export type { DetectedPerson };
