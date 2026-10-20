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
    corners: number;               // diagnostica: angoli del bbox dentro il buco
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
    debug?: boolean;         // restituisce le maschere intermedie (solo per i test)
}

export interface AnalyzeResult {
    people: DetectedPerson[];
    links: DetectedLink[];
    threshold: number;
    /** buchi scartati perché troppo piccoli/grandi: utile per tarare la soglia */
    rejected: number;
    width: number; height: number;
    debug?: { compId: Int32Array; owner: Int32Array; line: Uint8Array; frames: Blob[] };
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

// Chiusura morfologica (dilata poi erode): salda i tratti interrotti.
const closeMask = (src: Uint8Array, W: number, H: number, r: number): Uint8Array => {
    if (r <= 0) return src;
    const N = W * H;
    const dil = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let on = 0;
        for (let dy = -r; dy <= r && !on; dy++) for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (src[ny * W + nx]) { on = 1; break; }
        }
        dil[y * W + x] = on;
    }
    const ero = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let all = 1;
        for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            // fuori immagine = considerato pieno, così non si erode il bordo
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (!dil[ny * W + nx]) { all = 0; break; }
        }
        ero[y * W + x] = all;
    }
    return ero;
};

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
    line: Uint8Array, W: number, H: number, owner: Int32Array,
    medSide: number, strokeW: number
): Blob[] => {
    const N = W * H;
    const { id, count } = labelComponents(line, W, H);
    const bb: (Blob | undefined)[] = new Array(count + 1);
    const area = new Int32Array(count + 1);
    const anchored = new Uint8Array(count + 1);   // tocca l'alone di un simbolo
    for (let i = 0; i < N; i++) {
        const c = id[i];
        if (!c) continue;
        const x = i % W, y = (i / W) | 0;
        const e = bb[c];
        if (!e) bb[c] = { x0: x, y0: y, x1: x, y1: y };
        else { if (x < e.x0) e.x0 = x; if (x > e.x1) e.x1 = x; if (y < e.y0) e.y0 = y; if (y > e.y1) e.y1 = y; }
        area[c]++;
        if (owner[i]) anchored[c] = 1;
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
        if (density < 0.22 || Math.min(w, h) < strokeW * 2.2) continue;
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
const estimateStrokeWidth = (mask: Uint8Array, W: number, H: number, fallback: number): number => {
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
    for (let x = 0; x < W; x++) {
        let s = -1;
        for (let y = 0; y <= H; y++) {
            const on = y < H && mask[y * W + x] === 1;
            if (on && s < 0) s = y;
            else if (!on && s >= 0) { for (let k = s; k < y; k++) vRun[k * W + x] = y - s; s = -1; }
        }
    }
    const hist = new Int32Array(64);
    let n = 0;
    for (let i = 0; i < N; i++) {
        if (!mask[i]) continue;
        const v = Math.min(hRun[i], vRun[i], 63);
        hist[v]++; n++;
    }
    if (n === 0) return fallback;
    let acc = 0;
    for (let v = 1; v < 64; v++) { acc += hist[v]; if (acc >= n / 2) return Math.max(1, v); }
    return fallback;
};

interface Prepared { ink: Uint8Array; threshold: number; }

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
    for (let i = 0; i < N; i++) ink[i] = lum[i] < threshold ? 1 : 0;
    ink = closeMask(ink, W, H, opts.closeGaps ?? 0);
    return { ink, threshold };
};

interface Hole { x0: number; y0: number; x1: number; y1: number; area: number; px: number[]; }

const findPeople = (
    ink: Uint8Array, W: number, H: number, opts: DetectOptions
): { people: DetectedPerson[], rejected: number, frames: Blob[] } => {
    const N = W * H;

    // sfondo esterno: flood fill a 4 vicini dai bordi (stack esplicito, niente ricorsione)
    const outside = new Uint8Array(N);
    const stack: number[] = [];
    const pushIfBg = (i: number) => { if (!ink[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { pushIfBg(x); pushIfBg((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { pushIfBg(y * W); pushIfBg(y * W + W - 1); }
    while (stack.length) {
        const i = stack.pop()!;
        const x = i % W, y = (i / W) | 0;
        if (x > 0) pushIfBg(i - 1);
        if (x < W - 1) pushIfBg(i + 1);
        if (y > 0) pushIfBg(i - W);
        if (y < H - 1) pushIfBg(i + W);
    }

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
    const parent = holes.map((_, i) => i);
    const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    const near = (a: Hole, b: Hole, pad: number) =>
        a.x0 - pad <= b.x1 && b.x0 - pad <= a.x1 && a.y0 - pad <= b.y1 && b.y0 - pad <= a.y1;
    for (let i = 0; i < holes.length; i++) {
        for (let j = i + 1; j < holes.length; j++) {
            if (!near(holes[i], holes[j], 6)) continue;
            // uniamo solo se il risultato resta compatto (no catene lungo le linee)
            const ux0 = Math.min(holes[i].x0, holes[j].x0), ux1 = Math.max(holes[i].x1, holes[j].x1);
            const uy0 = Math.min(holes[i].y0, holes[j].y0), uy1 = Math.max(holes[i].y1, holes[j].y1);
            const uw = ux1 - ux0 + 1, uh = uy1 - uy0 + 1;
            const ar = uw / uh;
            if (uw > maxSide || uh > maxSide || ar < 0.55 || ar > 1.8) continue;
            if (Math.max(uw, uh) > 3 * Math.min(side(holes[i]), side(holes[j]))) continue;
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

        // test degli angoli: l'interno di un quadrato arriva negli angoli del
        // proprio bbox, quello di un cerchio o di un rombo no. L'inset 0.10
        // cade fuori da un cerchio inscritto e dentro un quadrato.
        const ins = (fx: number, fy: number) => {
            const x = Math.round(fx * (w - 1)), y = Math.round(fy * (h - 1));
            return mask[y * w + x] ? 1 : 0;
        };
        const corners = ins(0.10, 0.10) + ins(0.90, 0.10) + ins(0.10, 0.90) + ins(0.90, 0.90);

        // area del buco rispetto al bbox: quadrato ~1, cerchio ~0.79, rombo ~0.5
        // (il testo interno la abbassa un po', per questo le soglie sono larghe)
        const fillRatio = area / (w * h);

        // Due indizi indipendenti; concordi → alta confidenza, discordi → bassa.
        const squareByCorners = corners >= 3;
        const squareByArea = fillRatio >= 0.85;
        let gender: DetectedGender;
        if (fillRatio < 0.60 && corners <= 1) gender = 'NonBinary';          // rombo
        else if (squareByCorners || squareByArea) gender = 'M';
        else gender = 'F';
        const confidence = gender === 'NonBinary'
            ? Math.min(1, (0.60 - fillRatio) * 4 + 0.5)
            : (squareByCorners === squareByArea ? 0.95 : 0.55);

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
            return s >= med * 0.45 && s <= med * 2.2;
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
    people: DetectedPerson[], frames: Blob[], opts: DetectOptions
): { links: DetectedLink[]; debug?: { compId: Int32Array; owner: Int32Array; line: Uint8Array; frames: Blob[] } } => {
    if (people.length < 2) return { links: [] };
    const N = W * H;
    const medSide = medianSide(people) || 20;
    const strokeW = estimateStrokeWidth(ink, W, H, Math.max(2, medSide * 0.12));
    // w/h sono le misure del BUCO: per cancellare anche il contorno del simbolo
    // serve allargare di un tratto abbondante, altrimenti i suoi due fianchi
    // restano in maschera e fanno da ponte attorno al simbolo, ricucendo la
    // linea che scende da sopra con quella che riparte da sotto.
    const clearPad = Math.max(2, Math.ceil(strokeW * 1.8));
    const reach = Math.max(3, Math.round(medSide * 0.22));

    // owner[i] = indice persona + 1, nell'alone attorno al simbolo.
    // Il simbolo viene tolto dalla maschera: le linee restano tronche sul suo
    // bordo, quindi "toccare l'alone" significa "arrivare al simbolo".
    const owner = new Int32Array(N);
    const line = new Uint8Array(ink);
    people.forEach((p, i) => {
        const x0 = Math.round(p.cx - p.w / 2), y0 = Math.round(p.cy - p.h / 2);
        const x1 = Math.round(p.cx + p.w / 2), y1 = Math.round(p.cy + p.h / 2);
        for (let y = y0 - clearPad - reach; y <= y1 + clearPad + reach; y++) {
            if (y < 0 || y >= H) continue;
            for (let x = x0 - clearPad - reach; x <= x1 + clearPad + reach; x++) {
                if (x < 0 || x >= W) continue;
                const k = y * W + x;
                if (x >= x0 - clearPad && x <= x1 + clearPad && y >= y0 - clearPad && y <= y1 + clearPad) line[k] = 0;
                else if (!owner[k]) owner[k] = i + 1;
            }
        }
    });

    stripFrames(line, W, H, frames, medSide, strokeW);
    stripTextLabels(line, W, H, owner, medSide, strokeW);

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
            const dashed = shortN >= 3 && shortPx >= c.px * 0.25;
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

    return { links, debug: opts.debug ? { compId: comp.id, owner, line, frames } : undefined };
};

export const analyzeGenogramImage = (img: ImageLike, opts: DetectOptions = {}): AnalyzeResult => {
    const { width, height } = img;
    const { ink, threshold } = prepare(img, opts);
    const { people, rejected, frames } = findPeople(ink, width, height, opts);
    const { links, debug } = findLinks(ink, img.data, width, height, people, frames, opts);
    return { people, links, threshold, rejected, width, height, debug };
};

/** Solo i simboli, senza la rete delle relazioni. */
export const detectGenogramPeople = (img: ImageLike, opts: DetectOptions = {}) => {
    const { width, height } = img;
    const { ink, threshold } = prepare(img, opts);
    const { people, rejected } = findPeople(ink, width, height, opts);
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
