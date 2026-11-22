// --- PERCORSO DI UNA RELAZIONE ---
//
// Una relazione può passare per punti intermedi (waypoint) messi dall'utente
// per farla girare attorno all'albero invece di attraversarlo. Tutto ciò che
// si disegna sopra la linea deve allora seguire il percorso, non la retta
// fra i due estremi:
//   - la freccia d'arrivo prende la direzione dell'ULTIMO tratto;
//   - i simboli al centro (tagli, cerchi, triangoli) stanno a metà della
//     lunghezza, perpendicolari al tratto in cui cadono;
//   - le linee doppie e triple sono copie PARALLELE del percorso. Prima erano
//     copie spostate di (3,3), cioè in diagonale: su una linea inclinata nella
//     direzione sbagliata le due copie finivano una sopra l'altra;
//   - lo zigzag continua da un tratto all'altro senza ricominciare.
//
// Funzioni pure, testabili.

export interface P { x: number; y: number }

const segLen = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);

export const polylineLength = (pts: P[]) => {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += segLen(pts[i - 1], pts[i]);
    return s;
};

/** Punto a frazione t (0..1) della lunghezza, con l'angolo (gradi) del tratto in cui cade. */
export const pointAlong = (pts: P[], t: number): P & { angle: number } => {
    if (pts.length < 2) return { ...(pts[0] || { x: 0, y: 0 }), angle: 0 };
    const total = polylineLength(pts);
    let target = Math.max(0, Math.min(1, t)) * total;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], l = segLen(a, b);
        if (target <= l || i === pts.length - 1) {
            const k = l > 0 ? Math.min(1, target / l) : 0;
            return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
        }
        target -= l;
    }
    return { ...pts[pts.length - 1], angle: 0 };
};

/** Angolo (gradi) del primo e dell'ultimo tratto non nulli. */
export const endAngles = (pts: P[]) => {
    const ang = (a: P, b: P) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    let s = 0, e = 0;
    for (let i = 1; i < pts.length; i++) if (segLen(pts[i - 1], pts[i]) > 0.01) { s = ang(pts[i - 1], pts[i]); break; }
    for (let i = pts.length - 1; i > 0; i--) if (segLen(pts[i - 1], pts[i]) > 0.01) { e = ang(pts[i - 1], pts[i]); break; }
    return { start: s, end: e };
};

/** Accorcia l'ultimo tratto di `d` (per lasciare spazio alla punta della freccia). */
export const trimEnd = (pts: P[], d: number): P[] => {
    if (pts.length < 2 || d <= 0) return pts;
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const l = segLen(a, b);
    if (l < 0.01) return pts;
    const k = Math.max(0, (l - d) / l);
    return [...pts.slice(0, -1), { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }];
};

/**
 * Copia parallela del percorso a distanza d (positiva = a sinistra nel verso
 * di percorrenza). Agli angoli i tratti si raccordano allungandosi fino a
 * incontrarsi, con un limite per gli angoli molto acuti.
 */
export const offsetPolyline = (pts: P[], d: number): P[] => {
    if (pts.length < 2 || d === 0) return pts;
    const normals: P[] = [];
    for (let i = 1; i < pts.length; i++) {
        const l = segLen(pts[i - 1], pts[i]) || 1;
        normals.push({ x: -(pts[i].y - pts[i - 1].y) / l, y: (pts[i].x - pts[i - 1].x) / l });
    }
    return pts.map((p, i) => {
        if (i === 0) return { x: p.x + normals[0].x * d, y: p.y + normals[0].y * d };
        if (i === pts.length - 1) { const n = normals[i - 1]; return { x: p.x + n.x * d, y: p.y + n.y * d }; }
        const n1 = normals[i - 1], n2 = normals[i];
        const m = { x: n1.x + n2.x, y: n1.y + n2.y };
        const ml = Math.hypot(m.x, m.y);
        if (ml < 1e-6) return { x: p.x + n1.x * d, y: p.y + n1.y * d };
        const u = { x: m.x / ml, y: m.y / ml };
        const k = Math.min(3, 1 / Math.max(0.2, u.x * n1.x + u.y * n1.y));
        return { x: p.x + u.x * d * k, y: p.y + u.y * d * k };
    });
};

const f = (v: number) => Math.round(v * 100) / 100;

/** Spezzata con gli angoli smussati da un raccordo di raggio r (r = 0: spigoli vivi). */
export const roundedPath = (pts: P[], r = 0): string => {
    if (!pts.length) return '';
    let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (r > 0 && i < pts.length - 1) {
            const prev = pts[i - 1], next = pts[i + 1];
            const l1 = segLen(prev, p), l2 = segLen(p, next);
            const rr = Math.min(r, l1 / 2, l2 / 2);
            if (rr > 0.5) {
                const a = { x: p.x + (prev.x - p.x) * rr / l1, y: p.y + (prev.y - p.y) * rr / l1 };
                const b = { x: p.x + (next.x - p.x) * rr / l2, y: p.y + (next.y - p.y) * rr / l2 };
                d += ` L ${f(a.x)} ${f(a.y)} Q ${f(p.x)} ${f(p.y)} ${f(b.x)} ${f(b.y)}`;
                continue;
            }
        }
        d += ` L ${f(p.x)} ${f(p.y)}`;
    }
    return d;
};

/**
 * Zigzag lungo tutto il percorso, con fase continua agli angoli. Su un
 * percorso di due soli punti coincide con il vecchio getZigZagPath, così le
 * relazioni esistenti non cambiano aspetto.
 */
export const zigzagAlong = (pts: P[], amplitude = 4, frequency = 12): string => {
    if (pts.length < 2) return '';
    const len = polylineLength(pts);
    if (len === 0) return `M ${pts[0].x} ${pts[0].y}`;
    const steps = Math.max(1, Math.round(len / frequency));
    const stepLen = len / steps;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < steps; i++) {
        const q = pointAlong(pts, (i * stepLen) / len);
        const rad = q.angle * Math.PI / 180;
        const px = -Math.sin(rad), py = Math.cos(rad);
        const o = (i % 2 !== 0) ? amplitude : -amplitude;
        path += ` L ${q.x + px * o} ${q.y + py * o}`;
    }
    const last = pts[pts.length - 1];
    return path + ` L ${last.x} ${last.y}`;
};

/** Indice del tratto più vicino a un punto (per inserire un waypoint lì). */
export const nearestSegment = (pts: P[], q: P): number => {
    let best = 0, bd = Infinity;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
        const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)) : 0;
        const d = Math.hypot(q.x - (a.x + t * vx), q.y - (a.y + t * vy));
        if (d < bd) { bd = d; best = i - 1; }
    }
    return best;
};
