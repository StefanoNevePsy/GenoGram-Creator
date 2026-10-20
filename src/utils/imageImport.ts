// --- IMPORT DI UN GENOGRAMMA DA IMMAGINE ---
//
// Idea di fondo: non cercare i simboli, cercare i BUCHI.
// Ogni persona è un contorno chiuso (quadrato, cerchio, rombo) che racchiude
// un'area di sfondo; le linee di relazione invece non racchiudono nulla.
// Quindi: riempiamo lo sfondo partendo dai bordi dell'immagine, e ciò che
// resta di non-inchiostro sono esattamente gli interni dei simboli.
//
// Trovate le persone, le si cancella dalla maschera: quello che resta è la
// rete delle linee. Ogni sua componente connessa tocca un insieme di simboli,
// e la disposizione per righe generazionali dice se è una coppia o una
// discendenza. Il tipo preciso di relazione lo mette il clinico: qui si
// ricostruisce solo CHI è legato a CHI.
//
// Funzioni pure: ricevono pixel grezzi, non toccano il DOM. Testabili.

export interface ImageLike { data: Uint8ClampedArray; width: number; height: number; }

export type DetectedGender = 'M' | 'F' | 'NonBinary';

export interface DetectedPerson {
    cx: number; cy: number;        // centro, in pixel immagine
    w: number; h: number;          // dimensioni del simbolo
    gender: DetectedGender;
    deceased: boolean;
    indexPerson: boolean;          // doppio contorno = paziente designato
    confidence: number;            // 0-1: quanto è netta la forma
    fillRatio: number;             // diagnostica: area buco / area bbox
    corners: number;               // diagnostica: raggio diagonale / raggio assiale
    parts: number;                 // frammenti uniti (4 ≈ croce del deceduto)
}

export type LinkKind = 'partner' | 'child' | 'emotional';

export interface DetectedLink {
    a: number; b: number;          // indici in people; per 'child' a = genitore
    kind: LinkKind;
    dashed: boolean;
    colored: boolean;              // tratto a colori: tipicamente relazione emotiva
}

export interface DetectOptions {
    threshold?: number;      // soglia inchiostro 0-255; se assente → Otsu
    closeGaps?: number;      // raggio chiusura morfologica (tratti a mano aperti)
    minArea?: number;        // area minima di un buco, in pixel
    maxSizeRatio?: number;   // lato massimo come frazione del lato immagine
    dashGap?: number;        // raggio con cui si saldano i tratteggi (0 = mai)
    leakSeal?: number;       // tappa le fughe più strette di 2k nei contorni aperti
    adaptive?: boolean;      // soglia locale: foto di un disegno, luce non uniforme
    localContrast?: number;  // quanto più scuro del vicinato (default 0.12)
    debug?: boolean;         // restituisce le maschere intermedie (solo per i test)
}

/** Un'etichetta scritta, già attribuita alla persona a cui appartiene. */
export interface DetectedText {
    x0: number; y0: number; x1: number; y1: number;
    /** indice in people, -1 se non è vicina a nessuno */
    person: number;
    /** sopra il simbolo = anno di nascita, sotto = nome (convenzione diffusa) */
    slot: 'above' | 'below';
}

export interface AnalyzeResult {
    people: DetectedPerson[];
    links: DetectedLink[];
    /** riquadri delle scritte: servono a leggerle, non a disegnarle */
    texts: DetectedText[];
    threshold: number;
    /** buchi scartati perché troppo piccoli/grandi: utile per tarare la soglia */
    rejected: number;
    width: number; height: number;
    debug?: { compId: Int32Array; owner: Int32Array; line: Uint8Array; frames: Blob[]; words: Blob[] };
}

// --- soglia automatica di Otsu sul canale di luminanza ---
const otsu = (hist: number[], total: number): number => {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB, mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) { best = between; thr = t; }
    }
    return thr;
};

// Dilatazione/erosione con elemento quadrato, separabile: una passata per
// righe e una per colonne, con finestra scorrevole. Costa O(N) invece di
// O(N·r²), e su una foto da telefono è la differenza tra un secondo e un
// minuto. Fuori immagine conta come pieno in erosione, così il bordo non si
// consuma, e come vuoto in dilatazione.
const morph = (src: Uint8Array, W: number, H: number, r: number, dilate: boolean): Uint8Array => {
    const N = W * H, span = 2 * r + 1;
    const tmp = new Uint8Array(N), out = new Uint8Array(N);
    const pass = (from: Uint8Array, to: Uint8Array, outer: number, inner: number, step: number, base: (o: number) => number) => {
        for (let o = 0; o < outer; o++) {
            const b = base(o);
            let cnt = 0, oob = 0;
            for (let k = -r; k <= r; k++) {
                if (k < 0 || k >= inner) oob++;
                else if (from[b + k * step]) cnt++;
            }
            for (let i = 0; i < inner; i++) {
                to[b + i * step] = dilate
                    ? (cnt > 0 ? 1 : 0)
                    : (cnt + oob === span ? 1 : 0);
                const rem = i - r, add = i + r + 1;
                if (rem < 0 || rem >= inner) oob--; else if (from[b + rem * step]) cnt--;
                if (add < 0 || add >= inner) oob++; else if (from[b + add * step]) cnt++;
            }
        }
    };
    pass(src, tmp, H, W, 1, y => y * W);
    pass(tmp, out, W, H, W, x => x);
    return out;
};

// Chiusura morfologica (dilata poi erode): salda i tratti interrotti.
const closeMask = (src: Uint8Array, W: number, H: number, r: number): Uint8Array =>
    r <= 0 ? src : morph(morph(src, W, H, r, true), W, H, r, false);

// Etichettatura delle componenti connesse (8 vicini): bridging dei tratti
// leggermente sfalsati senza dover ingrassare la maschera.
const labelComponents = (mask: Uint8Array, W: number, H: number): { id: Int32Array, count: number } => {
    const N = W * H;
    const id = new Int32Array(N);    // 0 = non assegnato
    const stack: number[] = [];
    let next = 0;
    for (let s = 0; s < N; s++) {
        if (!mask[s] || id[s]) continue;
        next++;
        id[s] = next; stack.push(s);
        while (stack.length) {
            const j = stack.pop()!;
            const x = j % W, y = (j / W) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                const k = ny * W + nx;
                if (!mask[k] || id[k]) continue;
                id[k] = next; stack.push(k);
            }
        }
    }
    return { id, count: next };
};

// --- RIMOZIONE DELLE ETICHETTE DI TESTO ---
// Non è un dettaglio estetico: un nome scritto sotto un simbolo sta esattamente
// tra la linea che scende dall'alto e la barra di coppia sottostante, e la
// chiusura morfologica lo salda a entrambe, fondendo due generazioni in
// un'unica componente.
//
// Riconoscerle carattere per carattere non basta (le lettere che si toccano
// formano blob grandi quanto un connettore). Si usa invece il criterio
// tipografico: tre o più blob compatti, allineati sulla stessa riga e vicini
// tra loro, sono una parola. Un tratteggio sfugge al test perché i suoi
// segmenti sono sottili quanto il tratto.
//
// Cancellare una parola però può troncare la linea che la attraversa (l'anno
// di nascita è scritto proprio sopra il simbolo, sulla linea che vi scende):
// per questo i punti di attraversamento vengono ricuciti.
interface Blob { x0: number; y0: number; x1: number; y1: number; }

// Cancella dalla maschera i pixel marcati e ricuce i tratti che li
// attraversavano. Un'etichetta (o la cornice di evidenziazione di un simbolo)
// ha quasi sempre uno sfondo opaco che interrompe già la linea su cui è
// appoggiata, quindi non basta guardare il pixel adiacente al riquadro: si
// cerca il primo tratto uscendo verso l'esterno e si ricollegano i capi
// allineati sui lati opposti.
const eraseAndBridge = (
    line: Uint8Array, W: number, H: number,
    erased: Uint8Array, boxes: Blob[], medSide: number, strokeW: number
) => {
    if (!boxes.length) return;
    const N = W * H;
    interface Cross { pos: number; at: number; }
    const scanOut = (
        from: number, to: number, start: number, dir: 1 | -1, reachOut: number,
        ix: (pos: number, d: number) => number
    ): Cross[] => {
        const hit: number[] = [];
        for (let pos = from; pos <= to; pos++) {
            let found = -1;
            for (let d = 1; d <= reachOut; d++) {
                const k = ix(pos, start + dir * d);
                if (k < 0) break;
                if (line[k] && !erased[k]) { found = start + dir * d; break; }
            }
            hit.push(found);
        }
        const out: Cross[] = [];
        let s = -1;
        for (let i = 0; i <= hit.length; i++) {
            const on = i < hit.length && hit[i] >= 0 && (s < 0 || Math.abs(hit[i] - hit[i - 1]) <= 2);
            if (on && s < 0) s = i;
            else if (!on && s >= 0) {
                out.push({ pos: from + (s + i - 1) / 2, at: hit[(s + i - 1) >> 1] });
                s = i < hit.length && hit[i] >= 0 ? i : -1;
            }
        }
        return out;
    };
    const bridges: [number, number, number, number][] = [];
    const reachOut = Math.max(4, Math.round(medSide));
    const align = medSide * 0.6;
    const pair = (a: Cross[], b: Cross[], make: (p: Cross, q: Cross) => [number, number, number, number]) => {
        a.forEach(p => {
            let best: Cross | null = null;
            b.forEach(q => { if (!best || Math.abs(q.pos - p.pos) < Math.abs(best.pos - p.pos)) best = q; });
            const q = best as Cross | null;
            if (q && Math.abs(q.pos - p.pos) <= align) bridges.push(make(p, q));
        });
    };
    const ix = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x);
    boxes.forEach(wd => {
        const up = scanOut(wd.x0, wd.x1, wd.y0, -1, reachOut, (x, y) => ix(x, y));
        const down = scanOut(wd.x0, wd.x1, wd.y1, 1, reachOut, (x, y) => ix(x, y));
        pair(up, down, (p, q) => [p.pos, p.at, q.pos, q.at]);
        const left = scanOut(wd.y0, wd.y1, wd.x0, -1, reachOut, (y, x) => ix(x, y));
        const right = scanOut(wd.y0, wd.y1, wd.x1, 1, reachOut, (y, x) => ix(x, y));
        pair(left, right, (p, q) => [p.at, p.pos, q.at, q.pos]);
    });

    for (let i = 0; i < N; i++) if (erased[i]) line[i] = 0;

    const r = Math.max(1, Math.round(strokeW / 2));
    bridges.forEach(([x0, y0, x1, y1]) => {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; s++) {
            const px = Math.round(x0 + (x1 - x0) * s / steps), py = Math.round(y0 + (y1 - y0) * s / steps);
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                const nx = px + dx, ny = py + dy;
                if (nx >= 0 && ny >= 0 && nx < W && ny < H) line[ny * W + nx] = 1;
            }
        }
    });
};

// Le cornici di evidenziazione (il riquadro colorato che molti software
// disegnano attorno al paziente designato) tagliano fuori chi racchiudono:
// si cancella il loro perimetro e si ricuce ciò che lo attraversava.
const stripFrames = (
    line: Uint8Array, W: number, H: number, frames: Blob[], medSide: number, strokeW: number
) => {
    if (!frames.length) return;
    const erased = new Uint8Array(W * H);
    const boxes: Blob[] = [];
    const band = Math.max(2, Math.ceil(strokeW * 1.6));
    frames.forEach(f => {
        const edges: Blob[] = [
            { x0: f.x0 - band, y0: f.y0 - band, x1: f.x1 + band, y1: f.y0 + band },
            { x0: f.x0 - band, y0: f.y1 - band, x1: f.x1 + band, y1: f.y1 + band },
            { x0: f.x0 - band, y0: f.y0 - band, x1: f.x0 + band, y1: f.y1 + band },
            { x0: f.x1 - band, y0: f.y0 - band, x1: f.x1 + band, y1: f.y1 + band },
        ];
        edges.forEach(e => {
            const b = { x0: Math.max(0, e.x0), y0: Math.max(0, e.y0), x1: Math.min(W - 1, e.x1), y1: Math.min(H - 1, e.y1) };
            for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) erased[y * W + x] = 1;
            boxes.push(b);
        });
    });
    eraseAndBridge(line, W, H, erased, boxes, medSide, strokeW);
};

const stripTextLabels = (
    line: Uint8Array, W: number, H: number, touching: Uint8Array,
    medSide: number, strokeW: number
): Blob[] => {
    const N = W * H;
    const { id, count } = labelComponents(line, W, H);
    const sm = strokeMap(line, W, H);
    const bb: (Blob | undefined)[] = new Array(count + 1);
    const area = new Int32Array(count + 1);
    const thickSum = new Float64Array(count + 1);
    const anchored = new Uint8Array(count + 1);   // tocca l'alone di un simbolo
    for (let i = 0; i < N; i++) {
        const c = id[i];
        if (!c) continue;
        const x = i % W, y = (i / W) | 0;
        const e = bb[c];
        if (!e) bb[c] = { x0: x, y0: y, x1: x, y1: y };
        else { if (x < e.x0) e.x0 = x; if (x > e.x1) e.x1 = x; if (y < e.y0) e.y0 = y; if (y > e.y1) e.y1 = y; }
        area[c]++;
        thickSum[c] += sm[i];
        if (touching[i]) anchored[c] = 1;
    }

    // Un connettore parte da un simbolo ed è sottile quanto il tratto lungo
    // tutto il suo percorso; un glifo è compatto, denso e non tocca nessuno.
    // Contare i caratteri non funziona: a corpo piccolo le lettere si saldano
    // e una parola intera diventa un blob solo.
    const isText = new Uint8Array(count + 1);
    const textIds: number[] = [];
    for (let c = 1; c <= count; c++) {
        const b = bb[c];
        if (!b || anchored[c]) continue;
        const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
        const density = area[c] / (w * h);
        const aspect = Math.max(w, h) / Math.min(w, h);
        // Lo spessore di confronto è quello del blob STESSO, non del disegno:
        // in molti genogrammi le linee di parentela sono molto più marcate
        // delle scritte, e una soglia unica o scarta tutte le etichette o
        // scambia per etichetta i segmenti di un tratteggio. Una parola è
        // alta parecchie volte l'asta delle sue lettere; un pezzo di linea è
        // spesso quanto la penna che l'ha tracciata.
        const thick = Math.max(1, thickSum[c] / area[c]);
        if (density < 0.20 || Math.min(w, h) < thick * 2.2) continue;
        const glyph = Math.max(w, h) <= medSide * 1.6;
        const textLine = aspect >= 2.2 && Math.min(w, h) <= medSide;
        if (glyph || textLine) { isText[c] = 1; textIds.push(c); }
    }
    if (!textIds.length) return [];

    // raggruppa i blob di testo contigui in parole, per poter ricucire gli
    // attraversamenti una volta sola per etichetta
    const parent = new Map<number, number>(textIds.map(c => [c, c]));
    const find = (a: number): number => { const p = parent.get(a)!; if (p === a) return a; const r = find(p); parent.set(a, r); return r; };
    for (let i = 0; i < textIds.length; i++) for (let j = i + 1; j < textIds.length; j++) {
        const a = bb[textIds[i]]!, b = bb[textIds[j]]!;
        const dy = Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
        const gap = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
        if (dy > medSide * 0.35 || gap > medSide * 0.5) continue;
        const ra = find(textIds[i]), rb = find(textIds[j]);
        if (ra !== rb) parent.set(ra, rb);
    }
    const byRoot = new Map<number, Blob>();
    textIds.forEach(c => {
        const b = bb[c]!, r = find(c), e = byRoot.get(r);
        if (!e) byRoot.set(r, { ...b });
        else { e.x0 = Math.min(e.x0, b.x0); e.y0 = Math.min(e.y0, b.y0); e.x1 = Math.max(e.x1, b.x1); e.y1 = Math.max(e.y1, b.y1); }
    });
    const words = [...byRoot.values()];

    // i blob sottili dentro il riquadro della parola sono le sue 'l', 'i', '1'
    for (let c = 1; c <= count; c++) {
        const b = bb[c];
        if (!b || isText[c] || anchored[c]) continue;
        if (Math.max(b.x1 - b.x0, b.y1 - b.y0) + 1 > medSide * 0.9) continue;
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        if (words.some(wd => cx >= wd.x0 - 1 && cx <= wd.x1 + 1 && cy >= wd.y0 - 1 && cy <= wd.y1 + 1)) isText[c] = 1;
    }

    const erased = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (id[i] && isText[id[i]]) erased[i] = 1;
    eraseAndBridge(line, W, H, erased, words, medSide, strokeW);
    return words;
};

// Spessore del tratto, misurato invece che indovinato: per ogni pixel di
// inchiostro il minimo tra la lunghezza della sua corsa orizzontale e quella
// verticale è lo spessore locale; la mediana è quello del disegno. Vale sia
// per una stampa a 1px sia per un pennarello su carta, e tutte le soglie che
// separano un tratto da un glifo ne dipendono.
// Spessore locale del tratto, pixel per pixel: il minimo fra la lunghezza
// della corsa orizzontale e quella verticale. Su una linea dà la larghezza
// della penna, su un glifo quella dell'asta.
const strokeMap = (mask: Uint8Array, W: number, H: number): Int32Array => {
    const N = W * H;
    const hRun = new Int32Array(N), vRun = new Int32Array(N);
    for (let y = 0; y < H; y++) {
        let s = -1;
        for (let x = 0; x <= W; x++) {
            const on = x < W && mask[y * W + x] === 1;
            if (on && s < 0) s = x;
            else if (!on && s >= 0) { for (let k = s; k < x; k++) hRun[y * W + k] = x - s; s = -1; }
        }
    }
    const out = new Int32Array(N);
    for (let x = 0; x < W; x++) {
        let s = -1;
        for (let y = 0; y <= H; y++) {
            const on = y < H && mask[y * W + x] === 1;
            if (on && s < 0) s = y;
            else if (!on && s >= 0) { for (let k = s; k < y; k++) vRun[k * W + x] = y - s; s = -1; }
        }
    }
    for (let i = 0; i < N; i++) if (mask[i]) out[i] = Math.min(hRun[i], vRun[i]);
    return out;
};

// Spessore del disegno nel suo complesso: mediana degli spessori locali.
// Misurato invece che indovinato, vale sia per una stampa a 1px sia per un
// pennarello su carta.
const estimateStrokeWidth = (mask: Uint8Array, W: number, H: number, fallback: number): number => {
    const sm = strokeMap(mask, W, H);
    const hist = new Int32Array(64);
    let n = 0;
    for (let i = 0; i < sm.length; i++) {
        if (!mask[i]) continue;
        hist[Math.min(sm[i], 63)]++; n++;
    }
    if (n === 0) return fallback;
    let acc = 0;
    for (let v = 1; v < 64; v++) { acc += hist[v]; if (acc >= n / 2) return Math.max(1, v); }
    return fallback;
};

// Lo sfondo esterno, con le fughe sottili tappate.
//
// Un contorno disegnato a mano spesso non chiude: fra il lato sinistro e
// quello inferiore resta un varco di un pixel, e il riempimento dello sfondo
// ci cola dentro facendo sparire la persona. La chiusura morfologica non
// basta — un tratto sottile, una volta eroso di nuovo, lascia il varco com'era
// — e allargare l'inchiostro falserebbe le misure dei simboli e salderebbe le
// etichette.
//
// Si lavora invece sullo SFONDO: lo si erode di k, così i canali più stretti
// di 2k si strozzano e spariscono; si riempie dai bordi dell'immagine; si
// ridilata il risultato e lo si interseca con lo sfondo di partenza. Il
// bordino tolto viene restituito solo dove comunicava davvero con l'esterno.
// L'inchiostro non viene toccato: i riquadri dei simboli restano esatti.
const outsideBackground = (ink: Uint8Array, W: number, H: number, k: number): Uint8Array => {
    const N = W * H;
    const bg = new Uint8Array(N);
    for (let i = 0; i < N; i++) bg[i] = ink[i] ? 0 : 1;
    const open = k > 0 ? morph(bg, W, H, k, false) : bg;

    const seed = new Uint8Array(N);
    const stack: number[] = [];
    const push = (i: number) => { if (open[i] && !seed[i]) { seed[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (stack.length) {
        const i = stack.pop()!;
        const x = i % W, y = (i / W) | 0;
        if (x > 0) push(i - 1);
        if (x < W - 1) push(i + 1);
        if (y > 0) push(i - W);
        if (y < H - 1) push(i + W);
    }

    const out = k > 0 ? morph(seed, W, H, k, true) : seed;
    for (let i = 0; i < N; i++) out[i] = out[i] && bg[i] ? 1 : 0;
    return out;
};

interface Prepared { ink: Uint8Array; threshold: number; strokeW: number }

const prepare = (img: ImageLike, opts: DetectOptions): Prepared => {
    const { width: W, height: H, data } = img;
    const N = W * H;
    const lum = new Uint8Array(N);
    const hist = new Array(256).fill(0);
    for (let i = 0; i < N; i++) {
        const o = i * 4;
        // pixel trasparenti = sfondo
        const a = data[o + 3];
        const v = a < 128 ? 255 : (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) | 0;
        lum[i] = v; hist[v]++;
    }
    const threshold = opts.threshold ?? Math.min(otsu(hist, N), 200);
    let ink: Uint8Array = new Uint8Array(N);

    if (opts.adaptive) {
        // Soglia locale (Bradley): un pixel è inchiostro se è più scuro della
        // media del suo vicinato. Una soglia globale non sopravvive alla foto
        // di un foglio, dove l'ombra di un lato è più scura dell'inchiostro
        // dell'altro; qui conta solo il contrasto locale.
        const sum = new Float64Array(N);
        for (let y = 0; y < H; y++) {
            let row = 0;
            for (let x = 0; x < W; x++) {
                row += lum[y * W + x];
                sum[y * W + x] = row + (y > 0 ? sum[(y - 1) * W + x] : 0);
            }
        }
        const s = Math.max(7, Math.round(Math.min(W, H) / 12));
        const t = 1 - (opts.localContrast ?? 0.12);
        const at = (x: number, y: number) => sum[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const x0 = Math.max(0, x - s), y0 = Math.max(0, y - s);
            const x1 = Math.min(W - 1, x + s), y1 = Math.min(H - 1, y + s);
            const n = (x1 - x0 + 1) * (y1 - y0 + 1);
            const tot = at(x1, y1) - (x0 > 0 ? at(x0 - 1, y1) : 0) - (y0 > 0 ? at(x1, y0 - 1) : 0)
                + (x0 > 0 && y0 > 0 ? at(x0 - 1, y0 - 1) : 0);
            ink[y * W + x] = lum[y * W + x] < (tot / n) * t ? 1 : 0;
        }
    } else {
        for (let i = 0; i < N; i++) ink[i] = lum[i] < threshold ? 1 : 0;
    }

    const strokeW = estimateStrokeWidth(ink, W, H, 2);
    ink = closeMask(ink, W, H, opts.closeGaps ?? 0);
    return { ink, threshold, strokeW };
};

interface Hole { x0: number; y0: number; x1: number; y1: number; area: number; px: number[]; }

const findPeople = (
    ink: Uint8Array, W: number, H: number, opts: DetectOptions, strokeW: number
): { people: DetectedPerson[], rejected: number, frames: Blob[] } => {
    const N = W * H;
    const stack: number[] = [];
    const outside = outsideBackground(ink, W, H, opts.leakSeal ?? Math.max(1, Math.round(strokeW * 0.6)));

    // buchi = non-inchiostro non raggiunto dall'esterno
    const minArea = opts.minArea ?? 60;
    const maxSide = (opts.maxSizeRatio ?? 0.25) * Math.min(W, H);
    const seen = new Uint8Array(N);
    const holes: Hole[] = [];
    let rejected = 0;

    for (let i = 0; i < N; i++) {
        if (ink[i] || outside[i] || seen[i]) continue;
        const px: number[] = [];
        let x0 = W, y0 = H, x1 = 0, y1 = 0;
        seen[i] = 1; stack.push(i);
        while (stack.length) {
            const j = stack.pop()!;
            px.push(j);
            const x = j % W, y = (j / W) | 0;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
            const nb = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1];
            for (const k of nb) {
                if (k < 0 || seen[k] || ink[k] || outside[k]) continue;
                seen[k] = 1; stack.push(k);
            }
        }
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        if (px.length < minArea || w > maxSide || h > maxSide) { rejected++; continue; }
        holes.push({ x0, y0, x1, y1, area: px.length, px });
    }

    // unione dei frammenti: la croce del deceduto spezza l'interno in 4 spicchi,
    // il doppio contorno del paziente designato in anello + disco.
    // Il vincolo sul lato MINIMO evita il caso opposto: un riquadro di
    // evidenziazione che inghiotte il simbolo che contiene.
    const side = (hl: Hole) => Math.max(hl.x1 - hl.x0 + 1, hl.y1 - hl.y0 + 1);
    const mergePad = Math.max(2, Math.ceil(strokeW * 1.4));
    const parent = holes.map((_, i) => i);
    const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    const near = (a: Hole, b: Hole, pad: number) =>
        a.x0 - pad <= b.x1 && b.x0 - pad <= a.x1 && a.y0 - pad <= b.y1 && b.y0 - pad <= a.y1;
    for (let i = 0; i < holes.length; i++) {
        for (let j = i + 1; j < holes.length; j++) {
            // la distanza ammessa è quella del tratto che separa gli spicchi
            // della croce, non una costante: più in là c'è già l'etichetta
            if (!near(holes[i], holes[j], mergePad)) continue;
            // uniamo solo se il risultato resta compatto (no catene lungo le linee)
            const ux0 = Math.min(holes[i].x0, holes[j].x0), ux1 = Math.max(holes[i].x1, holes[j].x1);
            const uy0 = Math.min(holes[i].y0, holes[j].y0), uy1 = Math.max(holes[i].y1, holes[j].y1);
            const uw = ux1 - ux0 + 1, uh = uy1 - uy0 + 1;
            const ar = uw / uh;
            if (uw > maxSide || uh > maxSide || ar < 0.55 || ar > 1.8) continue;
            if (Math.max(uw, uh) > 3 * Math.min(side(holes[i]), side(holes[j]))) continue;
            // Non assorbire le schegge: chiudendo i tratti aperti si salda il
            // simbolo all'etichetta sottostante e lo spazio rimasto tra i due
            // diventa un buco lungo e piatto, che gonfierebbe il riquadro.
            // Gli spicchi della croce del deceduto invece sono compatti.
            const sliver = (a: Hole, b: Hole) => {
                const aw = a.x1 - a.x0 + 1, ah = a.y1 - a.y0 + 1;
                return Math.max(aw, ah) / Math.min(aw, ah) > 3 && a.area > b.area * 0.15;
            };
            if (sliver(holes[i], holes[j]) || sliver(holes[j], holes[i])) continue;
            const a = find(i), b = find(j);
            if (a !== b) parent[a] = b;
        }
    }
    const groups = new Map<number, number[]>();
    holes.forEach((_, i) => {
        const r0 = find(i);
        if (!groups.has(r0)) groups.set(r0, []);
        groups.get(r0)!.push(i);
    });

    const people: DetectedPerson[] = [];
    groups.forEach(idxs => {
        let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
        idxs.forEach(i => {
            const hl = holes[i];
            x0 = Math.min(x0, hl.x0); y0 = Math.min(y0, hl.y0);
            x1 = Math.max(x1, hl.x1); y1 = Math.max(y1, hl.y1);
            area += hl.area;
        });
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const ar = w / h;
        if (ar < 0.55 || ar > 1.8) return;           // non è un simbolo persona
        if (w < 8 || h < 8) return;

        // maschera del gruppo, per i test geometrici
        const mask = new Uint8Array(w * h);
        idxs.forEach(i => holes[i].px.forEach(p => {
            const x = p % W, y = (p / W) | 0;
            mask[(y - y0) * w + (x - x0)] = 1;
        }));

        // Profilo radiale: quanto lontano arriva il buco lungo le diagonali
        // rispetto agli assi, in coordinate normalizzate sul bbox.
        // Quadrato ≈ 1.41, cerchio ≈ 1, rombo ≈ 0.71.
        // Si misura il punto più lontano, non il primo vuoto incontrato, così
        // né il testo scritto dentro né la croce del deceduto — che toglie una
        // striscia sottile ma lascia le punte negli angoli — falsano la forma.
        const cxL = (w - 1) / 2, cyL = (h - 1) / 2;
        const reach = (dx: number, dy: number) => {
            let best = 0;
            for (let t = 0.2; t <= 1.45; t += 0.03) {
                const x = Math.round(cxL + dx * t * cxL), y = Math.round(cyL + dy * t * cyL);
                if (x < 0 || y < 0 || x >= w || y >= h) break;
                if (mask[y * w + x]) best = t;
            }
            return best;
        };
        const d = Math.SQRT1_2;
        const mid = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return (s[1] + s[2]) / 2; };
        const axis = mid([reach(1, 0), reach(-1, 0), reach(0, 1), reach(0, -1)]);
        const diag = mid([reach(d, d), reach(-d, d), reach(d, -d), reach(-d, -d)]);
        const corners = axis > 0 ? diag / axis : 1;
        // Nessuna forma convessa supera √2 (il quadrato) né scende sotto il
        // rombo: quello che ci sta fuori è un falso buco — lo spazio fra due
        // lettere, una fuga tappata — non un simbolo.
        if (corners > 1.52 || corners < 0.62) return;

        // area del buco rispetto al bbox: quadrato ~1, cerchio ~0.79, rombo ~0.5
        // (il testo interno la abbassa un po', per questo le soglie sono larghe)
        const fillRatio = area / (w * h);

        // Due indizi indipendenti; concordi → alta confidenza, discordi → bassa.
        const squareByShape = corners >= 1.18;
        const squareByArea = fillRatio >= 0.85;
        let gender: DetectedGender;
        if (corners <= 0.92 && fillRatio < 0.62) gender = 'NonBinary';       // rombo
        else if (squareByShape || squareByArea) gender = 'M';
        else gender = 'F';
        const confidence = gender === 'NonBinary'
            ? Math.min(1, (0.92 - corners) * 3 + 0.5)
            : (squareByShape === squareByArea ? 0.95 : 0.6);

        // doppio contorno concentrico = paziente designato
        const indexPerson = idxs.length === 2 && (() => {
            const [p, q] = idxs.map(i => holes[i]);
            const inner = side(p) < side(q) ? p : q, outer = side(p) < side(q) ? q : p;
            const cxI = (inner.x0 + inner.x1) / 2, cyI = (inner.y0 + inner.y1) / 2;
            const cxO = (outer.x0 + outer.x1) / 2, cyO = (outer.y0 + outer.y1) / 2;
            const sO = side(outer);
            return Math.abs(cxI - cxO) < sO * 0.18 && Math.abs(cyI - cyO) < sO * 0.18
                && side(inner) < sO * 0.85;
        })();

        people.push({
            cx: x0 + w / 2, cy: y0 + h / 2, w, h,
            gender,
            deceased: idxs.length >= 4,   // la X del deceduto produce 4 spicchi
            indexPerson, confidence,
            fillRatio, corners, parts: idxs.length,
        });
    });

    // Scarta gli isolati anomali: tieni i simboli di dimensione confrontabile.
    // Gli scartati per eccesso sono quasi sempre cornici di evidenziazione, e
    // vanno restituiti: racchiudono un simbolo e ne isolerebbero le linee.
    const frames: Blob[] = [];
    if (people.length >= 4) {
        const sides = people.map(p => (p.w + p.h) / 2).sort((a, b) => a - b);
        const med = sides[sides.length >> 1];
        const kept = people.filter(p => {
            const s = (p.w + p.h) / 2;
            if (s > med * 2.2) frames.push({
                x0: Math.round(p.cx - p.w / 2), y0: Math.round(p.cy - p.h / 2),
                x1: Math.round(p.cx + p.w / 2), y1: Math.round(p.cy + p.h / 2),
            });
            return s >= med * 0.55 && s <= med * 2.2;
        });
        rejected += people.length - kept.length;
        people.length = 0; people.push(...kept);
    }

    people.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
    return { people, rejected, frames };
};

const medianSide = (people: DetectedPerson[]): number => {
    if (!people.length) return 0;
    const s = people.map(p => (p.w + p.h) / 2).sort((a, b) => a - b);
    return s[s.length >> 1];
};

const findLinks = (
    ink: Uint8Array, data: Uint8ClampedArray, W: number, H: number,
    people: DetectedPerson[], frames: Blob[], opts: DetectOptions, strokeW: number
): { links: DetectedLink[]; texts: DetectedText[]; debug?: { compId: Int32Array; owner: Int32Array; line: Uint8Array; frames: Blob[]; words: Blob[] } } => {
    if (people.length < 2) return { links: [], texts: [] };
    const N = W * H;
    const medSide = medianSide(people) || 20;
    // w/h sono le misure del BUCO: per cancellare anche il contorno del simbolo
    // serve allargare di un tratto abbondante, altrimenti i suoi due fianchi
    // restano in maschera e fanno da ponte attorno al simbolo, ricucendo la
    // linea che scende da sopra con quella che riparte da sotto.
    // ...ma non oltre una frazione del simbolo: dove le linee di parentela
    // sono molto più marcate del contorno, un margine proporzionale a quelle
    // inghiottirebbe le etichette scritte appena sotto.
    const reach = Math.max(3, Math.round(medSide * 0.22));

    // Quanto è spesso il contorno di QUESTO simbolo: si esce dal buco in
    // quattro direzioni e si conta per quanti pixel l'inchiostro continua.
    // w/h del rilevamento sono le misure dell'INTERNO: se si cancella solo
    // quello, i fianchi del contorno restano in maschera e fanno da ponte
    // attorno al simbolo, ricucendo la linea che scende da sopra con quella
    // che riparte da sotto — e tre generazioni diventano una famiglia sola.
    // Misurarlo, invece di dedurlo dal tratto medio del disegno, evita sia di
    // lasciarne un pezzo sia di allargarsi tanto da inghiottire le etichette.
    const outlineOf = (p: DetectedPerson): number => {
        const x0 = Math.round(p.cx - p.w / 2), y0 = Math.round(p.cy - p.h / 2);
        const x1 = Math.round(p.cx + p.w / 2), y1 = Math.round(p.cy + p.h / 2);
        const cap = Math.max(3, Math.round(medSide * 0.4));
        const run = (sx: number, sy: number, dx: number, dy: number) => {
            let t = 0, x = sx, y = sy;
            while (t < cap) {
                x += dx; y += dy;
                if (x < 0 || y < 0 || x >= W || y >= H || !ink[y * W + x]) break;
                t++;
            }
            return t;
        };
        const got: number[] = [];
        for (const f of [0.3, 0.5, 0.7]) {
            const mx = Math.round(x0 + (x1 - x0) * f), my = Math.round(y0 + (y1 - y0) * f);
            [run(mx, y0, 0, -1), run(mx, y1, 0, 1), run(x0, my, -1, 0), run(x1, my, 1, 0)]
                .forEach(t => { if (t > 0) got.push(t); });
        }
        if (!got.length) return 2;
        got.sort((a, b) => a - b);
        return got[got.length >> 1];
    };
    const pads = people.map(p => Math.max(2, Math.min(outlineOf(p) + 1, Math.round(medSide * 0.45))));

    // owner[i] = indice persona + 1, nell'alone attorno al simbolo.
    // Il simbolo viene tolto dalla maschera: le linee restano tronche sul suo
    // bordo, quindi "toccare l'alone" significa "arrivare al simbolo".
    // `touching` è l'anello stretto appena fuori dal simbolo: una linea che vi
    // arriva lo tocca davvero, mentre l'alone largo di `owner` — che serve ad
    // agganciare i connettori — arriverebbe a coprire anche il nome scritto
    // sotto, e proteggerlo dalla rimozione del testo significa non trovarlo
    // più quando si va a leggerlo.
    const owner = new Int32Array(N);
    const touching = new Uint8Array(N);
    const inner = Math.max(2, Math.round(medSide * 0.08));
    const line = new Uint8Array(ink);
    people.forEach((p, i) => {
        const pad = pads[i];
        const x0 = Math.round(p.cx - p.w / 2), y0 = Math.round(p.cy - p.h / 2);
        const x1 = Math.round(p.cx + p.w / 2), y1 = Math.round(p.cy + p.h / 2);
        for (let y = y0 - pad - reach; y <= y1 + pad + reach; y++) {
            if (y < 0 || y >= H) continue;
            for (let x = x0 - pad - reach; x <= x1 + pad + reach; x++) {
                if (x < 0 || x >= W) continue;
                const k = y * W + x;
                if (x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad) line[k] = 0;
                else {
                    if (!owner[k]) owner[k] = i + 1;
                    if (x >= x0 - pad - inner && x <= x1 + pad + inner
                        && y >= y0 - pad - inner && y <= y1 + pad + inner) touching[k] = 1;
                }
            }
        }
    });

    stripFrames(line, W, H, frames, medSide, strokeW);
    const words = stripTextLabels(line, W, H, touching, medSide, strokeW);

    // Attribuisci ogni scritta alla persona cui si riferisce. La convenzione
    // dei genogrammi è costante: l'anno di nascita sopra il simbolo, il nome
    // sotto. L'età, quando c'è, sta DENTRO — e lì non serve cercarla: il
    // riquadro del simbolo la delimita già.
    const texts: DetectedText[] = words.map(wd => {
        const cx = (wd.x0 + wd.x1) / 2, cy = (wd.y0 + wd.y1) / 2;
        let person = -1, bestD = Infinity, slot: 'above' | 'below' = 'below';
        people.forEach((p, i) => {
            // dev'essere allineata in orizzontale e abbastanza vicina in verticale
            if (Math.abs(cx - p.cx) > Math.max(p.w, wd.x1 - wd.x0) * 1.1) return;
            const above = cy < p.cy;
            const d = above ? p.cy - p.h / 2 - wd.y1 : wd.y0 - (p.cy + p.h / 2);
            if (d < 0 || d > medSide * 1.4 || d >= bestD) return;
            bestD = d; person = i; slot = above ? 'above' : 'below';
        });
        return { ...wd, person, slot };
    }).filter(t => t.person >= 0);

    // Le componenti grezze servono a riconoscere i tratteggi: un tratteggio è
    // una sola componente dopo la chiusura, ma molti frammenti corti prima.
    const raw = labelComponents(line, W, H);
    const rawSpan = new Float64Array(raw.count + 1);
    const rawPx = new Float64Array(raw.count + 1);
    {
        const bx = new Int32Array((raw.count + 1) * 4).fill(-1);
        for (let i = 0; i < N; i++) {
            const c = raw.id[i];
            if (!c) continue;
            const x = i % W, y = (i / W) | 0, o = c * 4;
            if (bx[o] < 0) { bx[o] = x; bx[o + 1] = y; bx[o + 2] = x; bx[o + 3] = y; }
            else {
                if (x < bx[o]) bx[o] = x; if (y < bx[o + 1]) bx[o + 1] = y;
                if (x > bx[o + 2]) bx[o + 2] = x; if (y > bx[o + 3]) bx[o + 3] = y;
            }
            rawPx[c]++;
        }
        for (let c = 1; c <= raw.count; c++) {
            const o = c * 4;
            rawSpan[c] = bx[o] < 0 ? 0 : Math.max(bx[o + 2] - bx[o] + 1, bx[o + 3] - bx[o + 1] + 1);
        }
    }
    // Il colore e il tratteggio non cambiano la topologia, ma dicono di che
    // natura è il legame: una linea emotiva si disegna quasi sempre a colori o
    // a tratti. Si misurano per componente, a maggioranza — una linea emotiva
    // che sfiora una linea di parentela non deve tingerla tutta.
    const sat = (i: number) => {
        const o = i * 4;
        return Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]);
    };

    const links: DetectedLink[] = [];
    const pushed = new Set<string>();
    const add = (a: number, b: number, kind: LinkKind, dashed: boolean, colored: boolean) => {
        if (a === b) return;
        const key = kind === 'child' ? `c${a}-${b}` : `${kind}${Math.min(a, b)}-${Math.max(a, b)}`;
        if (pushed.has(key)) return;
        pushed.add(key);
        links.push(kind === 'child' ? { a, b, kind, dashed, colored } : { a: Math.min(a, b), b: Math.max(a, b), kind, dashed, colored });
    };

    const dashGap = opts.dashGap ?? Math.max(2, Math.round(medSide * 0.14));
    const closed = closeMask(line, W, H, dashGap);
    const comp = labelComponents(closed, W, H);

    interface Comp { members: Set<number>; rawIds: Set<number>; px: number; colPx: number; }
    const comps = new Map<number, Comp>();
    for (let i = 0; i < N; i++) {
        const c = comp.id[i];
        if (!c || !line[i]) continue;     // solo pixel reali, non quelli aggiunti dalla chiusura
        let e = comps.get(c);
        if (!e) { e = { members: new Set(), rawIds: new Set(), px: 0, colPx: 0 }; comps.set(c, e); }
        e.px++;
        e.rawIds.add(raw.id[i]);
        if (owner[i]) e.members.add(owner[i] - 1);
        if (ink[i] && sat(i) > 40) e.colPx++;
    }

    comps.forEach(c => {
        {
            if (c.members.size < 2) return;
            // Tratteggio: almeno tre frammenti corti che pesano quanto la linea.
            // Contare i frammenti e basta non basta: anche una linea continua
            // si spezza, dove attraversa un'etichetta cancellata.
            let shortPx = 0, shortN = 0;
            c.rawIds.forEach(r => {
                if (rawSpan[r] > 0 && rawSpan[r] <= medSide * 0.6) { shortN++; shortPx += rawPx[r]; }
            });
            // una linea tratteggiata è fatta quasi SOLO di frammenti corti;
            // una linea continua a mano se ne guadagna qualcuno dove la penna
            // ha saltato, ma resta per lo più un tratto unico
            const dashed = shortN >= 3 && shortPx >= c.px * 0.5;
            const colored = c.px > 0 && c.colPx > c.px * 0.5;

            // righe generazionali: raggruppa i membri per ordinata
            const mem = [...c.members].sort((x, y) => people[x].cy - people[y].cy);
            const rows: number[][] = [];
            mem.forEach(i => {
                const last = rows[rows.length - 1];
                if (last && Math.abs(people[i].cy - people[last[0]].cy) < medSide * 0.8) last.push(i);
                else rows.push([i]);
            });
            rows.forEach(r => r.sort((x, y) => people[x].cx - people[y].cx));

            // la riga più alta sono i partner; tutto il resto, la discendenza
            const parents = rows[0];
            const kids = rows.slice(1).flat();

            for (let i = 1; i < parents.length; i++) {
                const kind: LinkKind = (dashed || colored) && kids.length === 0 ? 'emotional' : 'partner';
                add(parents[i - 1], parents[i], kind, dashed, colored);
            }
            parents.forEach(p => kids.forEach(k => add(p, k, 'child', dashed, colored)));
        }
    });

    return { links, texts, debug: opts.debug ? { compId: comp.id, owner, line, frames, words } : undefined };
};

export const analyzeGenogramImage = (img: ImageLike, opts: DetectOptions = {}): AnalyzeResult => {
    const { width, height } = img;
    const { ink, threshold, strokeW } = prepare(img, opts);
    const { people, rejected, frames } = findPeople(ink, width, height, opts, strokeW);
    const { links, texts, debug } = findLinks(ink, img.data, width, height, people, frames, opts, strokeW);
    return { people, links, texts, threshold, rejected, width, height, debug };
};

// --- TARATURA AUTOMATICA ---
// Un genogramma stampato e la foto di uno disegnato a mano non si leggono con
// gli stessi parametri, e chiedere all'utente di regolare soglia e chiusura a
// tentativi è chiedergli di fare il lavoro al posto nostro. Si prova una
// manciata di combinazioni e si tiene la migliore.
//
// Il punteggio non premia solo "quante persone ho trovato": un genogramma
// vero è fatto di simboli di taglia simile, disposti su poche righe
// generazionali e quasi tutti collegati a qualcun altro. Il rumore di una
// foto non ha nessuna di queste proprietà.
const scoreResult = (r: AnalyzeResult): number => {
    const n = r.people.length;
    if (n < 2) return n * 0.2;
    const linked = new Set<number>();
    r.links.forEach(l => { linked.add(l.a); linked.add(l.b); });

    // Conta solo chi è davvero una persona: forma netta, almeno un legame e
    // nessun altro simbolo addosso. Contare le teste e basta premierebbe i
    // parametri che inventano buchi — fra una lettera e l'altra ce ne sono
    // tanti, e si piazzano a ridosso del simbolo che l'etichetta descrive,
    // mentre in un genogramma vero due simboli non si toccano mai.
    const med = medianSide(r.people) || 1;
    const crowded = (i: number) => r.people.some((q, j) =>
        j !== i && Math.hypot(q.cx - r.people[i].cx, q.cy - r.people[i].cy) < med * 0.85);
    // La soglia di confidenza è alta apposta: un simbolo vero ha i due
    // indizi di forma concordi, uno spazio fra due lettere quasi mai.
    const good = r.people.filter((p, i) => p.confidence >= 0.8 && linked.has(i) && !crowded(i)).length;

    const sides = r.people.map(p => (p.w + p.h) / 2);
    const mean = sides.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(sides.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    const consistency = mean > 0 ? Math.max(0, 1 - sd / mean) : 0;
    const conf = r.people.reduce((a, p) => a + p.confidence, 0) / n;

    return (good + 0.15 * (n - good)) * (0.55 + 0.25 * consistency + 0.20 * conf);
};

export interface AutoAnalyzeResult extends AnalyzeResult {
    /** i parametri che hanno vinto: utili da mostrare e da ritoccare a mano */
    options: DetectOptions;
    score: number;
    attempts: { options: DetectOptions; people: number; links: number; score: number }[];
}

export const autoAnalyzeGenogramImage = (img: ImageLike, base: DetectOptions = {}): AutoAnalyzeResult => {
    // Quanto va chiuso un tratto interrotto non dipende dalla risoluzione ma
    // dallo spessore della penna: a mano il buco in un angolo è largo quanto
    // il tratto. Lo si misura su una passata senza chiusura e si costruiscono
    // i tentativi attorno a quel valore.
    const probe = prepare(img, { ...base, closeGaps: 0 });
    const sw = estimateStrokeWidth(probe.ink, img.width, img.height, 2);
    const cap = Math.max(1, Math.round(Math.min(img.width, img.height) / 40));
    const gaps = [...new Set([0, Math.min(Math.round(sw * 0.8), cap)])];
    // Tappare le fughe recupera i contorni aperti di un disegno a mano, ma su
    // una stampa nitida inventa buchi fra una lettera e l'altra: si provano
    // entrambe e decide il punteggio.
    const seals = [...new Set([0, Math.max(1, Math.round(sw * 0.6))])];

    const combos: DetectOptions[] = [];
    [false, true].forEach(adaptive => gaps.forEach(closeGaps => seals.forEach(leakSeal => {
        combos.push({
            ...base, adaptive,
            closeGaps: base.closeGaps ?? closeGaps,
            leakSeal: base.leakSeal ?? leakSeal,
        });
    })));

    let best: AnalyzeResult | null = null, bestOpts = combos[0], bestScore = -1;
    const attempts: AutoAnalyzeResult['attempts'] = [];
    const seen = new Set<string>();
    combos.forEach(o => {
        const key = `${o.adaptive}|${o.closeGaps}|${o.leakSeal}`;
        if (seen.has(key)) return;
        seen.add(key);
        const r = analyzeGenogramImage(img, o);
        const score = scoreResult(r);
        attempts.push({ options: o, people: r.people.length, links: r.links.length, score: Math.round(score * 10) / 10 });
        if (score > bestScore) { bestScore = score; best = r; bestOpts = o; }
    });

    const result = best as AnalyzeResult | null;
    if (!result) {
        return { people: [], links: [], texts: [], threshold: 0, rejected: 0, width: img.width, height: img.height, options: bestOpts, score: 0, attempts };
    }
    return { ...result, options: bestOpts, score: Math.round(bestScore * 10) / 10, attempts };
};

/** Solo i simboli, senza la rete delle relazioni. */
export const detectGenogramPeople = (img: ImageLike, opts: DetectOptions = {}) => {
    const { width, height } = img;
    const { ink, threshold, strokeW } = prepare(img, opts);
    const { people, rejected } = findPeople(ink, width, height, opts, strokeW);
    return { people, threshold, rejected };
};

/**
 * Converte i rilevamenti in coordinate del canvas dell'app, conservando le
 * proporzioni del disegno originale e portando i simboli alla dimensione
 * nativa dei nodi.
 */
export const mapToCanvas = (
    people: DetectedPerson[],
    opts: { centerX: number; centerY: number; nodeSize: number; snap?: number }
): { cx: number; cy: number; x: number; y: number; gender: DetectedGender; deceased: boolean }[] => {
    if (people.length === 0) return [];
    const medSide = medianSide(people) || opts.nodeSize;
    // il simbolo mediano diventa grande quanto un nodo dell'app
    const scale = opts.nodeSize / medSide;

    const xs = people.map(p => p.cx), ys = people.map(p => p.cy);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const snap = opts.snap ?? 0;
    const q = (v: number) => snap > 0 ? Math.round(v / snap) * snap : Math.round(v);

    return people.map(p => {
        const x = q(opts.centerX + (p.cx - midX) * scale - opts.nodeSize / 2);
        const y = q(opts.centerY + (p.cy - midY) * scale - opts.nodeSize / 2);
        return { cx: p.cx, cy: p.cy, x, y, gender: p.gender, deceased: p.deceased };
    });
};
