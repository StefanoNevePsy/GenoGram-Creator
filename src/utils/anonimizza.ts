// --- NOMI ANONIMI NELLE ESPORTAZIONI ---
//
// Un genogramma esce dallo studio per supervisioni, presentazioni di caso e
// tesi: i nomi dei pazienti non devono viaggiare con lui. Con l'opzione
// "Nomi anonimi" ogni nome diventa un'iniziale. Cambia SOLO la copia
// esportata: il canvas e i dati salvati restano quelli di prima.
//
// Regole dello pseudonimo (funzione `pseudonimi`):
//   1. Si lavora sulla PRIMA parola del nome (spazi tolti e compressi).
//      "Maria Bianchi" → "M."
//   2. Se due o più persone avrebbero lo stesso pseudonimo, SOLO per loro si
//      allunga il prefisso una lettera alla volta ("Ma.", "Mi."; poi "Mar.",
//      "Mat.") finché diventa unico. Il confronto ignora maiuscole e accenti
//      (NFD senza segni diacritici: "Élise" ed "Elena" restano in conflitto
//      finché il prefisso non le distingue davvero), ma si scrivono le lettere
//      originali: la prima maiuscola, le altre minuscole.
//   3. Se la prima parola è identica (due "Marco") e non c'è più nulla da
//      allungare, si scrive la parola intera e l'iniziale della seconda:
//      "Marco R.", "Marco V.". Chi non ha una seconda parola, o resta uguale
//      anche così, prende un numero progressivo nell'ordine dei dati:
//      "M.1", "M.2" (prima lettera, punto, numero).
//   4. Nome vuoto o di soli spazi → "" (resta vuoto, niente da nascondere).
//      Nome che inizia con un non-lettera ("?", cifre) → quel carattere così com'è.
//   5. Deterministico: stesso ordine in ingresso, stessi pseudonimi.
//
// La mappa si costruisce su TUTTE le persone del genogramma, non su quelle
// che finiscono nel file: disegno, report e mappe di Minuchin usano gli stessi
// pseudonimi, così "M." è sempre la stessa persona in ogni esportazione.

const senzaAccenti = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const maiuscola = (c: string) => c.toLocaleUpperCase('it');

/** Chiave di localStorage della scelta "Nomi anonimi". */
export const CHIAVE_ANONIMO = 'genopro_export_anonimo';

/** Legge la scelta salvata; localStorage può mancare o lanciare (finestra privata). */
export const leggiAnonimo = (): boolean => {
    try { return localStorage.getItem(CHIAVE_ANONIMO) === 'true'; } catch { return false; }
};

interface Voce {
    id: string;
    parole: string[];     // lettere (punti di codice) della prima parola
    seconda: string;      // seconda parola, se c'è
    lung: number;         // lunghezza del prefisso in uso
}

export const pseudonimi = (persone: { id: string, name: string }[]): Map<string, string> => {
    const out = new Map<string, string>();
    const voci: Voce[] = [];
    for (const p of persone) {
        const parti = (p.name || '').trim().split(/\s+/).filter(Boolean);
        if (parti.length === 0) { out.set(p.id, ''); continue; }
        voci.push({ id: p.id, parole: Array.from(parti[0]), seconda: parti[1] || '', lung: 1 });
    }

    // L'ordine in cui compaiono i dati decide solo i numeri finali: il resto
    // dipende dai nomi.
    const prefisso = (v: Voce) => v.parole.slice(0, v.lung).join('');
    for (;;) {
        const gruppi = new Map<string, Voce[]>();
        voci.forEach(v => {
            const k = senzaAccenti(prefisso(v));
            gruppi.set(k, [...(gruppi.get(k) || []), v]);
        });
        let cambiato = false;
        gruppi.forEach(g => {
            if (g.length < 2) return;
            g.forEach(v => { if (v.lung < v.parole.length) { v.lung++; cambiato = true; } });
        });
        // chi ha esaurito la parola non si allunga: se nessuno può, si passa al punto 3
        if (!cambiato) break;
    }

    const forma = (v: Voce) => {
        const p = v.parole;
        return maiuscola(p[0]) + p.slice(1, v.lung).join('').toLowerCase();
    };

    // persone con la stessa prima parola intera (dopo l'allungamento)
    const perParola = new Map<string, Voce[]>();
    voci.forEach(v => {
        const k = senzaAccenti(prefisso(v));
        perParola.set(k, [...(perParola.get(k) || []), v]);
    });
    perParola.forEach(g => {
        if (g.length === 1) { out.set(g[0].id, forma(g[0]) + '.'); return; }
        // sono identiche (o una è prefisso intero dell'altra, ma già distinte
        // dal prefisso più lungo dell'altra): parola intera + iniziale del cognome
        const cand = g.map(v => v.seconda ? `${forma(v)} ${maiuscola(Array.from(v.seconda)[0])}.` : null);
        const conta = new Map<string, number>();
        cand.forEach(c => { if (c) conta.set(senzaAccenti(c), (conta.get(senzaAccenti(c)) || 0) + 1); });
        let n = 0;
        g.forEach((v, i) => {
            const c = cand[i];
            if (c && conta.get(senzaAccenti(c)) === 1) out.set(v.id, c);
            else out.set(v.id, `${maiuscola(v.parole[0])}.${++n}`);
        });
    });
    return out;
};

/**
 * Sostituisce i nomi nella COPIA di un SVG. Va chiamata dopo inlineTextStyles,
 * che accoppia i testi per posizione e quindi vuole la struttura intatta.
 * I nomi sono marcati con data-nome="id"; il riquadro di sfondo (fratello
 * precedente del testo) si restringe in proporzione, restando centrato.
 * `nomi` (id → nome intero) serve a ripulire anche i <title>, che sono
 * visibili al passaggio del mouse in un SVG aperto nel browser.
 */
export const anonimizzaSvg = (clone: SVGSVGElement, mappa: Map<string, string>, nomi?: Map<string, string>) => {
    clone.querySelectorAll('[data-nome]').forEach(t => {
        const nuovo = mappa.get(t.getAttribute('data-nome') || '');
        if (nuovo === undefined) return;
        const vecchio = t.textContent || '';
        t.textContent = nuovo;
        const r = t.previousElementSibling;
        if (!r || r.tagName.toLowerCase() !== 'rect' || !vecchio.length) return;
        const w = parseFloat(r.getAttribute('width') || '');
        const x = parseFloat(r.getAttribute('x') || '');
        if (!isFinite(w) || !isFinite(x)) return;
        const nw = Math.max(16, w * nuovo.length / vecchio.length);
        r.setAttribute('width', String(nw));
        r.setAttribute('x', String(x + w / 2 - nw / 2));
    });
    if (!nomi) return;
    const interi = Array.from(nomi.entries()).filter(([, n]) => n.trim()).sort((a, b) => b[1].length - a[1].length);
    clone.querySelectorAll('title').forEach(t => {
        let s = t.textContent || '';
        interi.forEach(([id, n]) => { if (s.includes(n)) s = s.split(n).join(mappa.get(id) || ''); });
        if (s !== t.textContent) t.textContent = s;
    });
};

/** Quante cose di testo libero restano leggibili in un'esportazione anonima. */
export const testoLiberoVisibile = (d: {
    nodes: { label?: string, profession?: string }[],
    edges: { label?: string }[],
    groups: { label?: string }[],
    stickyNotes: { text?: string }[],
}): string[] => {
    const piu = (n: number, uno: string, molti: string) => n ? [`${n} ${n === 1 ? uno : molti}`] : [];
    const campi = d.nodes.filter(n => n.label?.trim()).length + d.nodes.filter(n => n.profession?.trim()).length;
    return [
        ...piu(d.groups.filter(g => g.label?.trim()).length, 'etichetta di gruppo', 'etichette di gruppo'),
        ...piu(d.edges.filter(e => e.label?.trim()).length, 'etichetta di relazione', 'etichette di relazione'),
        ...piu(d.stickyNotes.filter(s => s.text?.trim()).length, 'nota', 'note'),
        ...piu(campi, 'etichetta/professione', 'etichette/professioni'),
    ];
};
