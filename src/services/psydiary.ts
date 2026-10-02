// --- PONTE CON PSYDIARY ---
// I genogrammi passano tra GenoGram Creator e PsyDiary con postMessage, da una
// finestra all'altra dello stesso dispositivo e solo su richiesta esplicita:
// nessun server in mezzo, PsyDiary poi li cifra come allegati.
//
// Un messaggio è accettato solo se arriva dall'indirizzo esatto di PsyDiary
// (VITE_PSYDIARY_URL), dalla finestra aperta da noi o che ci ha aperto, e porta
// il codice monouso (nonce) di quello scambio. Stesso protocollo di
// PsyDiary (src/lib/ponte-geno.js):
//   { protocollo: 'psydiary-genogram', v: 1, nonce, tipo, ... }
//   'pronto' · 'genogramma' { genogramma } · 'ricevuto' · 'annulla'

import type { GenogramMeta } from '../types';

export const PROTOCOLLO = 'psydiary-genogram';
const PREDEFINITO = 'https://stefanonevepsy.github.io/psydiary/';
export const URL_PSYDIARY = ((import.meta.env.VITE_PSYDIARY_URL as string | undefined) || PREDEFINITO).replace(/\/?$/, '/');
export const ORIGINE_PSYDIARY = new URL(URL_PSYDIARY).origin;
const MAX_BYTE = 4 * 1024 * 1024;

type Messaggio = { protocollo: string, v: number, nonce: string, tipo: string, genogramma?: unknown };
export type RichiestaPsyDiary = { codice: string, modo: 'scegli' | 'aggiorna' | 'apri', id: string, finestra: Window };

export const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const busta = (codice: string, tipo: string, extra: Record<string, unknown> = {}): Messaggio => ({ protocollo: PROTOCOLLO, v: 1, nonce: codice, tipo, ...extra });

/** Il ponte funziona solo nella versione web (non nelle app Android e desktop). */
export const pontePossibile = () => {
    if (typeof window === 'undefined') return false;
    if ((window as any).Capacitor?.isNativePlatform?.()) return false;
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
};

export function messaggioValido(e: MessageEvent, finestra: Window | null, codice: string): Messaggio | null {
    if (e.origin !== ORIGINE_PSYDIARY) return null;
    if (finestra && e.source !== finestra) return null;
    const m = e.data as Messaggio;
    if (!m || typeof m !== 'object' || m.protocollo !== PROTOCOLLO || m.v !== 1 || m.nonce !== codice) return null;
    return m;
}

/** Un genogramma ricevuto, controllato come un file importato. */
export function genogrammaDa(m: Messaggio | null): GenogramMeta | null {
    if (!m || m.tipo !== 'genogramma') return null;
    const g = m.genogramma as any;
    if (!g || typeof g !== 'object' || typeof g.id !== 'string' || !/^[\w-]{1,80}$/.test(g.id)) return null;
    if (!g.data || !Array.isArray(g.data.nodes) || !Array.isArray(g.data.edges)) return null;
    try { if (JSON.stringify(g).length > MAX_BYTE) return null; } catch { return null; }
    return {
        ...g,
        title: String(g.title || 'Genogramma').slice(0, 200),
        category: typeof g.category === 'string' ? g.category : 'family',
        lastModified: typeof g.lastModified === 'number' ? g.lastModified : Date.now(),
    } as GenogramMeta;
}

/**
 * "Invia a PsyDiary": apre PsyDiary, aspetta che sia pronto (anche dopo
 * l'accesso), gli manda il genogramma e attende la conferma.
 * Esito: 'ricevuto' | 'annullato' | 'chiuso' | 'bloccato'.
 */
export function inviaAPsyDiary(g: GenogramMeta): Promise<'ricevuto' | 'annullato' | 'chiuso' | 'bloccato'> {
    const codice = nonce();
    const w = window.open(URL_PSYDIARY + '#/ricevi-genogramma?n=' + codice, 'psydiary');
    if (!w) return Promise.resolve('bloccato');
    const dati = { id: g.id, title: g.title, category: g.category, lastModified: g.lastModified, data: g.data };
    return new Promise(ok => {
        let mandato = false;
        const fine = (x: 'ricevuto' | 'annullato' | 'chiuso') => { clearInterval(guarda); clearTimeout(scade); window.removeEventListener('message', ascolta); ok(x); };
        const ascolta = (e: MessageEvent) => {
            const m = messaggioValido(e, w, codice);
            if (!m) return;
            if (m.tipo === 'pronto' && !mandato) { mandato = true; w.postMessage(busta(codice, 'genogramma', { genogramma: dati }), ORIGINE_PSYDIARY); }
            else if (m.tipo === 'ricevuto') fine('ricevuto');
            else if (m.tipo === 'annulla') fine('annullato');
        };
        window.addEventListener('message', ascolta);
        const guarda = setInterval(() => { if (w.closed) fine('chiuso'); }, 800);
        const scade = setTimeout(() => fine('chiuso'), 15 * 60000);
    });
}

/** GenoGram Creator aperto da PsyDiary: #psydiary?da=<origine>&n=<nonce>&modo=…&id=… */
export function richiestaDaPsyDiary(hash = location.hash): RichiestaPsyDiary | null {
    const m = /^#psydiary\?(.*)$/.exec(hash);
    if (!m || !window.opener) return null;
    const q = new URLSearchParams(m[1]);
    const codice = q.get('n') || '', modo = q.get('modo') || 'scegli';
    if (q.get('da') !== ORIGINE_PSYDIARY || !/^[0-9a-f]{32}$/.test(codice)) return null;
    if (!['scegli', 'aggiorna', 'apri'].includes(modo)) return null;
    return { codice, modo: modo as RichiestaPsyDiary['modo'], id: q.get('id') || '', finestra: window.opener };
}

/** Manda a PsyDiary il genogramma richiesto e aspetta (poco) la conferma. */
export function rispondi(r: RichiestaPsyDiary, g: GenogramMeta): Promise<boolean> {
    const dati = { id: g.id, title: g.title, category: g.category, lastModified: g.lastModified, data: g.data };
    return new Promise(ok => {
        const fine = (x: boolean) => { clearTimeout(scade); window.removeEventListener('message', ascolta); ok(x); };
        const ascolta = (e: MessageEvent) => { const m = messaggioValido(e, r.finestra, r.codice); if (m?.tipo === 'ricevuto') fine(true); };
        window.addEventListener('message', ascolta);
        const scade = setTimeout(() => fine(false), 5000);
        try { r.finestra.postMessage(busta(r.codice, 'genogramma', { genogramma: dati }), ORIGINE_PSYDIARY); } catch { fine(false); }
    });
}
export function rinuncia(r: RichiestaPsyDiary) {
    try { r.finestra.postMessage(busta(r.codice, 'annulla'), ORIGINE_PSYDIARY); } catch { /* chiusa */ }
}

/** Modo 'apri': si annuncia a PsyDiary e riceve il genogramma da modificare. */
export function riceviDaPsyDiary(r: RichiestaPsyDiary): Promise<GenogramMeta | null> {
    return new Promise(ok => {
        const fine = (x: GenogramMeta | null) => { clearTimeout(scade); window.removeEventListener('message', ascolta); ok(x); };
        const ascolta = (e: MessageEvent) => { const g = genogrammaDa(messaggioValido(e, r.finestra, r.codice)); if (g) fine(g); };
        window.addEventListener('message', ascolta);
        const scade = setTimeout(() => fine(null), 60000);
        try { r.finestra.postMessage(busta(r.codice, 'pronto'), ORIGINE_PSYDIARY); } catch { fine(null); }
    });
}
