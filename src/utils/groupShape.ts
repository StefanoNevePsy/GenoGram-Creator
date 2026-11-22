// --- CONTORNO DEI GRUPPI ---
//
// Prima il gruppo era l'inviluppo convesso dei membri, gonfiato spingendo ogni
// vertice lontano dal baricentro. Due difetti, entrambi visibili: il margine
// non era uniforme (sui gruppi allungati i lati lunghi restavano quasi a filo e
// le estremità si gonfiavano), e una disposizione a L — nonna, madre, nipote —
// diventava un'ellisse storta che inglobava chi nel gruppo non c'è.
//
// Qui il contorno è la curva di livello di un campo:
//   - ogni membro attrae, con un'influenza che si spegne a distanza 2·padding:
//     da solo produce un contorno esattamente a `padding` dal suo ingombro;
//   - i membri lontani sono legati da un albero di connessione minimo, i cui
//     tratti attraggono più debolmente: il gruppo resta UN'area sola, con un
//     collo stretto fra membri distanti invece di un'ellisse che li abbraccia;
//   - chi non è membro respinge, e i tratti di connessione lo aggirano, così
//     il contorno gli gira attorno invece di passarci sopra.
// La curva si estrae con marching squares e si liscia con Catmull-Rom.
//
// Funzioni pure, senza DOM: testabili.

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Pt { x: number; y: number }

export interface GroupContour {
    /** path SVG (tutti gli anelli, da disegnare con fill-rule evenodd) */
    d: string;
    /** anello esterno campionato fitto, in senso orario, partendo dall'alto */
    outline: Pt[];
    cx: number; cy: number;
    /** punto più alto del contorno: lì va l'etichetta del gruppo */
    top: Pt;
    bounds: Rect;
}

const distToRect = (px: number, py: number, r: Rect) => {
    const dx = Math.max(r.x0 - px, 0, px - r.x1);
    const dy = Math.max(r.y0 - py, 0, py - r.y1);
    return Math.hypot(dx, dy);
};

const distToSeg = (px: number, py: number, a: Pt, b: Pt) => {
    const vx = b.x - a.x, vy = b.y - a.y;
    const l2 = vx * vx + vy * vy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / l2));
    return Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy));
};

const center = (r: Rect): Pt => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
const grow = (r: Rect, m: number): Rect => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m });
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// Il segmento attraversa l'interno del rettangolo? (Liang-Barsky)
const segHitsRect = (a: Pt, b: Pt, r: Rect) => {
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] <= 0) return false; continue; }
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t1 - t0 > 1e-6;
};

const pathLen = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

// Tratto di connessione che aggira gli ostacoli: per ogni rettangolo che
// taglia, prova a passare da uno o due suoi angoli (gonfiati del margine) e
// tiene il giro più corto che resta libero da quell'ostacolo.
const routeAround = (a: Pt, b: Pt, blocks: Rect[]): Pt[] => {
    let path = [a, b];
    for (let pass = 0; pass < 3; pass++) {
        let changed = false;
        for (const r of blocks) {
            const out: Pt[] = [path[0]];
            for (let i = 1; i < path.length; i++) {
                const p = path[i - 1], q = path[i];
                if (!segHitsRect(p, q, r)) { out.push(q); continue; }
                const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
                const cands: Pt[][] = [];
                c.forEach(k => cands.push([p, k, q]));
                for (let k = 0; k < 4; k++) {
                    cands.push([p, c[k], c[(k + 1) % 4], q]);
                    cands.push([p, c[(k + 1) % 4], c[k], q]);
                }
                const inner = grow(r, -0.5);
                const ok = cands.filter(cd => cd.every((pt, j) => j === 0 || !segHitsRect(cd[j - 1], pt, inner)));
                if (!ok.length) { out.push(q); continue; }
                ok.sort((x, y) => pathLen(x) - pathLen(y));
                out.push(...ok[0].slice(1));
                changed = true;
            }
            path = out;
        }
        if (!changed) break;
    }
    return path;
};

// Albero di connessione minimo (Prim) sui rettangoli dei membri, con la
// distanza fra i bordi e non fra i centri: due membri affiancati sono "vicini"
// anche se i loro nomi sono lunghi.
const rectGap = (a: Rect, b: Rect) => {
    const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
    const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
    return Math.hypot(dx, dy);
};
const spanningTree = (rs: Rect[]): [number, number][] => {
    const n = rs.length, inTree = new Array(n).fill(false), best = new Array(n).fill(Infinity), from = new Array(n).fill(-1);
    const out: [number, number][] = [];
    if (!n) return out;
    best[0] = 0;
    for (let it = 0; it < n; it++) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
        inTree[u] = true;
        if (from[u] >= 0) out.push([from[u], u]);
        for (let v = 0; v < n; v++) {
            if (inTree[v]) continue;
            const d = rectGap(rs[u], rs[v]);
            if (d < best[v]) { best[v] = d; from[v] = u; }
        }
    }
    return out;
};

// Catmull-Rom chiusa → curve cubiche: passa per tutti i punti, senza spigoli.
const smoothClosedPath = (pts: Pt[]) => {
    const n = pts.length;
    if (n < 3) return '';
    const f = (v: number) => Math.round(v * 10) / 10;
    let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
        const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
        d += ` C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return d + ' Z';
};

// Ricampiona un anello a passo costante: i punti del marching squares sono
// fitti dove la curva gira poco e radi dove gira molto, e una spline su punti
// irregolari ondeggia.
const resampleLoop = (pts: Pt[], step: number): Pt[] => {
    const n = pts.length;
    const cum = [0];
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        cum.push(cum[i] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    const total = cum[n];
    const count = Math.max(8, Math.round(total / step));
    const out: Pt[] = [];
    let seg = 0;
    for (let k = 0; k < count; k++) {
        const target = (k * total) / count;
        while (seg < n - 1 && cum[seg + 1] < target) seg++;
        const a = pts[seg], b = pts[(seg + 1) % n];
        const len = cum[seg + 1] - cum[seg];
        const t = len > 0 ? (target - cum[seg]) / len : 0;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
};

const signedArea = (pts: Pt[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
};

export const pointInPolygon = (p: Pt, poly: Pt[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
};

/**
 * Contorno di un gruppo.
 * @param members  ingombri dei membri (simbolo + etichette)
 * @param others   ingombri di chi NON è nel gruppo: il contorno li evita
 * @param pad      distanza del contorno dai membri
 */
export const groupContour = (members: Rect[], others: Rect[], pad: number): GroupContour | null => {
    if (!members.length) return null;
    // Raggio d'influenza ampio: i campi di membri vicini si fondono in una
    // superficie piatta invece di lasciare un'ondulazione fra l'uno e l'altro.
    const R = pad * 3;
    const T = (1 - pad / R) ** 2;               // soglia: da solo → contorno a `pad`
    const Re = R * 0.85;                        // tratti di connessione: collo più stretto
    const neck = Re * (1 - Math.sqrt(T));       // mezza larghezza del collo
    const Rn = pad * 1.2, Wn = 1.2;             // repulsione dei non membri
    const clear = neck + Rn * 0.6;

    // Ingombri arrotondati: un'etichetta lunga è un rettangolo, e un contorno
    // a distanza costante da un rettangolo è un rettangolo con gli angoli
    // appena smussati. Si misura la distanza da un rettangolo rimpicciolito e
    // la si riduce dello stesso tanto: è un rettangolo con angoli di raggio k.
    const roundOf = (m: Rect) => {
        // negli angoli il margine scende a pad − k·(√2−1): con k ≤ 0.72·pad
        // non va mai sotto il 70% del padding
        const k = Math.min(Math.min(m.x1 - m.x0, m.y1 - m.y0) * 0.38, pad * 0.72);
        return { r: grow(m, -k), k };
    };

    // Respinge solo chi non si sovrappone a un membro: se due persone sono una
    // sopra l'altra non c'è contorno che possa separarle, e scavarlo spezzerebbe
    // il gruppo. (Le sovrapposizioni le risolve la distribuzione automatica.)
    const obstacles = others.filter(o => !members.some(m => overlaps(grow(m, pad * 0.25), o)));

    // Membri sulla stessa riga, vicini e senza estranei in mezzo, diventano un
    // unico ingombro: sommando i campi di rettangoli separati il bordo
    // ondeggia fra l'uno e l'altro, e una fila di fratelli deve dare una
    // capsula pulita. Se fra due di loro c'è qualcuno che nel gruppo non è,
    // restano separati e il contorno gli gira attorno.
    const blobs: Rect[] = [];
    {
        const sorted = [...members].sort((a, b) => center(a).y - center(b).y || a.x0 - b.x0);
        const rows: Rect[][] = [];
        sorted.forEach(m => {
            const row = rows.find(r => Math.abs(center(r[0]).y - center(m).y) < 25);
            if (row) row.push(m); else rows.push([m]);
        });
        rows.forEach(row => {
            row.sort((a, b) => a.x0 - b.x0);
            let cur = { ...row[0] };
            for (let i = 1; i < row.length; i++) {
                const m = row[i];
                const bridge: Rect = { x0: cur.x1, y0: Math.min(cur.y0, m.y0), x1: m.x0, y1: Math.max(cur.y1, m.y1) };
                const free = m.x0 - cur.x1 <= pad * 6 && !obstacles.some(o => overlaps(o, grow(bridge, 1)));
                if (free) cur = { x0: Math.min(cur.x0, m.x0), y0: Math.min(cur.y0, m.y0), x1: Math.max(cur.x1, m.x1), y1: Math.max(cur.y1, m.y1) };
                else { blobs.push(cur); cur = { ...m }; }
            }
            blobs.push(cur);
        });
    }

    const rounded = blobs.map(roundOf);
    const blobDist = (x: number, y: number, i: number) => Math.max(0, distToRect(x, y, rounded[i].r) - rounded[i].k);

    const links: Pt[][] = spanningTree(blobs).map(([i, j]) =>
        routeAround(center(blobs[i]), center(blobs[j]), obstacles.map(o => grow(o, clear))));

    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    const take = (x: number, y: number) => { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); };
    blobs.forEach(m => { take(m.x0, m.y0); take(m.x1, m.y1); });
    links.forEach(l => l.forEach(p => take(p.x, p.y)));
    const step = Math.max(3, Math.min(8, pad / 4));
    const margin = R + step * 2;
    bx0 -= margin; by0 -= margin; bx1 += margin; by1 += margin;

    const nearObs = obstacles.filter(o => o.x1 > bx0 - Rn && o.x0 < bx1 + Rn && o.y1 > by0 - Rn && o.y0 < by1 + Rn);
    const segs: [Pt, Pt][] = [];
    links.forEach(l => { for (let i = 1; i < l.length; i++) segs.push([l[i - 1], l[i]]); });

    const nx = Math.ceil((bx1 - bx0) / step) + 1, ny = Math.ceil((by1 - by0) / step) + 1;
    const F = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
        const y = by0 + j * step;
        for (let i = 0; i < nx; i++) {
            const x = bx0 + i * step;
            let f = 0, insideMember = false;
            for (let bi = 0; bi < blobs.length; bi++) {
                const d = blobDist(x, y, bi);
                if (d < R) f += (1 - d / R) ** 2;
            }
            for (const m of members) if (distToRect(x, y, m) === 0) { insideMember = true; break; }
            for (const [a, b] of segs) {
                const d = distToSeg(x, y, a, b);
                if (d < Re) f += (1 - d / Re) ** 2;
            }
            for (const o of nearObs) {
                const d = distToRect(x, y, o);
                if (d < Rn) f -= Wn * (1 - d / Rn) ** 2;
            }
            // un membro è sempre dentro il suo gruppo, qualunque cosa abbia attorno
            if (insideMember) f = Math.max(f, 1);
            F[j * nx + i] = f;
        }
    }

    // --- marching squares ---
    // Ogni punto del contorno sta su un lato della griglia: lo si identifica
    // col lato, così i segmenti delle celle vicine si cuciono senza tolleranze.
    const val = (i: number, j: number) => F[j * nx + i];
    const pos = new Map<string, Pt>();
    const adj = new Map<string, string[]>();
    const edgePt = (key: string, ax: number, ay: number, av: number, bxx: number, byy: number, bv: number) => {
        if (!pos.has(key)) {
            const t = (T - av) / (bv - av);
            pos.set(key, { x: ax + (bxx - ax) * t, y: ay + (byy - ay) * t });
        }
        return key;
    };
    const link = (a: string, b: string) => {
        (adj.get(a) || adj.set(a, []).get(a)!).push(b);
        (adj.get(b) || adj.set(b, []).get(b)!).push(a);
    };
    for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
            const v0 = val(i, j), v1 = val(i + 1, j), v2 = val(i + 1, j + 1), v3 = val(i, j + 1);
            const c = (v0 >= T ? 1 : 0) | (v1 >= T ? 2 : 0) | (v2 >= T ? 4 : 0) | (v3 >= T ? 8 : 0);
            if (c === 0 || c === 15) continue;
            const x0 = bx0 + i * step, y0 = by0 + j * step, x1 = x0 + step, y1 = y0 + step;
            const top = () => edgePt(`h${i},${j}`, x0, y0, v0, x1, y0, v1);
            const right = () => edgePt(`v${i + 1},${j}`, x1, y0, v1, x1, y1, v2);
            const bottom = () => edgePt(`h${i},${j + 1}`, x0, y1, v3, x1, y1, v2);
            const left = () => edgePt(`v${i},${j}`, x0, y0, v0, x0, y1, v3);
            const centerIn = (v0 + v1 + v2 + v3) / 4 >= T;
            switch (c) {
                case 1: case 14: link(left(), top()); break;
                case 2: case 13: link(top(), right()); break;
                case 3: case 12: link(left(), right()); break;
                case 4: case 11: link(right(), bottom()); break;
                case 6: case 9: link(top(), bottom()); break;
                case 7: case 8: link(left(), bottom()); break;
                case 5: if (centerIn) { link(left(), bottom()); link(top(), right()); } else { link(left(), top()); link(right(), bottom()); } break;
                case 10: if (centerIn) { link(left(), top()); link(right(), bottom()); } else { link(left(), bottom()); link(top(), right()); } break;
            }
        }
    }

    const seen = new Set<string>();
    const loops: Pt[][] = [];
    adj.forEach((_, startKey) => {
        if (seen.has(startKey)) return;
        const loop: Pt[] = [];
        let prev = '', cur = startKey;
        while (cur && !seen.has(cur)) {
            seen.add(cur);
            loop.push(pos.get(cur)!);
            const nb = (adj.get(cur) || []).filter(k => k !== prev && !seen.has(k));
            prev = cur; cur = nb[0];
        }
        if (loop.length >= 4) loops.push(loop);
    });
    if (!loops.length) return null;

    // anelli lisciati, l'esterno è quello di area maggiore
    const smooth = loops.map(l => resampleLoop(l, step * 1.6));
    smooth.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
    let outline = smooth[0];
    if (signedArea(outline) < 0) outline = [...outline].reverse();   // orario sullo schermo (y in giù)
    // parte dal punto più alto: l'ancora di una relazione salvata come
    // frazione del perimetro resta stabile finché il gruppo non cambia forma
    let topIdx = 0;
    outline.forEach((p, i) => { if (p.y < outline[topIdx].y) topIdx = i; });
    outline = [...outline.slice(topIdx), ...outline.slice(0, topIdx)];

    let ox0 = Infinity, oy0 = Infinity, ox1 = -Infinity, oy1 = -Infinity, sx = 0, sy = 0;
    outline.forEach(p => { ox0 = Math.min(ox0, p.x); oy0 = Math.min(oy0, p.y); ox1 = Math.max(ox1, p.x); oy1 = Math.max(oy1, p.y); sx += p.x; sy += p.y; });

    // l'etichetta va al centro del tratto più alto: su un bordo piatto il
    // singolo punto più alto è uno qualsiasi, e l'etichetta scivolava in un angolo
    const flat = outline.filter(p => p.y <= oy0 + 3);
    const top = { x: (Math.min(...flat.map(p => p.x)) + Math.max(...flat.map(p => p.x))) / 2, y: oy0 };

    return {
        d: [outline, ...smooth.slice(1)].map(smoothClosedPath).join(' '),
        outline,
        cx: sx / outline.length, cy: sy / outline.length,
        top,
        bounds: { x0: ox0, y0: oy0, x1: ox1, y1: oy1 },
    };
};

/** Punto sul perimetro a frazione t (0..1) della sua lunghezza, partendo da outline[0]. */
export const pointAtFraction = (outline: Pt[], t: number): Pt => {
    const n = outline.length;
    if (!n) return { x: 0, y: 0 };
    if (n === 1) return outline[0];
    const lens: number[] = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
        const a = outline[i], b = outline[(i + 1) % n];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        lens.push(l); total += l;
    }
    let target = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < n; i++) {
        if (target <= lens[i] || i === n - 1) {
            const a = outline[i], b = outline[(i + 1) % n];
            const k = lens[i] > 0 ? Math.min(1, target / lens[i]) : 0;
            return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        }
        target -= lens[i];
    }
    return outline[0];
};
