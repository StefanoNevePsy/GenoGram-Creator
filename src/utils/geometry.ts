import type { GenNode, NodeGroup } from '../types';
import { NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS, GROUP_PADDING } from '../config/constants';


export const getGroupBounds = (group: NodeGroup, nodes: GenNode[]) => {
    const mems = nodes.filter(n => group.memberIds.includes(n.id));
    if (!mems.length) return null;
    const minX = Math.min(...mems.map(n => n.x));
    const maxX = Math.max(...mems.map(n => n.x + NODE_WIDTH));
    const minY = Math.min(...mems.map(n => n.y));
    const maxY = Math.max(...mems.map(n => n.y + NODE_HEIGHT));
    return { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING, w: (maxX - minX) + (GROUP_PADDING * 2), h: (maxY - minY) + (GROUP_PADDING * 2), cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};

export const getEntityCenter = (id: string, nodes: GenNode[], groups: NodeGroup[]): { x: number, y: number } | null => {
    const node = nodes.find(n => n.id === id);
    if (node) return { x: node.x + NODE_RADIUS, y: node.y + NODE_RADIUS };
    const group = groups.find(g => g.id === id);
    if (group) { const bounds = getGroupBounds(group, nodes); if (bounds) return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }; }
    return null;
};

export const getRectIntersection = (bounds: { x: number, y: number, w: number, h: number }, start: { x: number, y: number }) => {
    const cx = bounds.x + bounds.w / 2; const cy = bounds.y + bounds.h / 2;
    const dx = start.x - cx; const dy = start.y - cy;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return { x: cx, y: cy };
    const scaleX = (bounds.w / 2) / Math.abs(dx); const scaleY = (bounds.h / 2) / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);
    return { x: cx + dx * scale, y: cy + dy * scale };
};

// --- MATH HELPERS AGGIORNATI (Blob organici) ---

export const cross = (a: { x: number, y: number }, b: { x: number, y: number }, o: { x: number, y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export const getConvexHull = (points: { x: number, y: number }[]) => {
    points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const lower = [];
    for (let i = 0; i < points.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
        lower.push(points[i]);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) upper.pop();
        upper.push(points[i]);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

// --- MATH: INTERSEZIONE LINEA-POLIGONO ---
export const getLineIntersection = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }, p4: { x: number, y: number }) => {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    }
    return null;
};

export const getPolygonIntersection = (polyPoints: { x: number, y: number }[], lineStart: { x: number, y: number }, lineEnd: { x: number, y: number }) => {
    let bestHit: { x: number, y: number } | null = null;
    let minDistance = Infinity;

    // 1. Prova intersezioni sui segmenti
    for (let i = 0; i < polyPoints.length; i++) {
        const p1 = polyPoints[i];
        const p2 = polyPoints[(i + 1) % polyPoints.length];
        const hit = getLineIntersection(p1, p2, lineStart, lineEnd);

        if (hit) {
            // Se troviamo più intersezioni, prendiamo quella più vicina al punto di partenza
            // (o quella più vicina al target, dipende dalla direzione. Qui cerchiamo l'uscita dal gruppo)
            const dist = Math.hypot(hit.x - lineEnd.x, hit.y - lineEnd.y);
            if (dist < minDistance) {
                minDistance = dist;
                bestHit = hit;
            }
        }
    }

    // 2. Fallback: Se la linea non interseca (es. centri interni complessi), 
    // prendiamo il punto del perimetro più vicino al target.
    if (!bestHit) {
        let minV = Infinity;
        polyPoints.forEach(p => {
            const d = Math.hypot(p.x - lineEnd.x, p.y - lineEnd.y);
            if (d < minV) {
                minV = d;
                bestHit = p;
            }
        });
    }

    return bestHit || lineEnd;
};

// Aggiornata per restituire anche i Control Points (necessari per il calcolo Bezier preciso)
export const getOrganicBlobPath = (points: { x: number, y: number }[], padding: number) => {
    if (points.length < 3) return { d: "", cx: 0, cy: 0, expandedPoints: [], controlPoints: [] };

    const cx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const cy = points.reduce((acc, p) => acc + p.y, 0) / points.length;

    // 1. Control Points (Gli spigoli esterni del poligono)
    const controlPoints = points.map(p => {
        const angle = Math.atan2(p.y - cy, p.x - cx);
        const dist = Math.hypot(p.x - cx, p.y - cy);
        return {
            x: cx + Math.cos(angle) * (dist + padding),
            y: cy + Math.sin(angle) * (dist + padding)
        };
    });

    // 2. Mid Points (Dove passa la curva)
    const len = controlPoints.length;
    const midPoints = controlPoints.map((p, i) => {
        const next = controlPoints[(i + 1) % len];
        return { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
    });

    let d = `M ${midPoints[0].x} ${midPoints[0].y}`;
    for (let i = 0; i < len; i++) {
        const p = controlPoints[(i + 1) % len]; // Punto di controllo (Vertex)
        const nextMid = midPoints[(i + 1) % len]; // Punto finale segmento
        d += ` Q ${p.x} ${p.y} ${nextMid.x} ${nextMid.y}`;
    }
    d += " Z";

    // Restituiamo expandedPoints (midPoints) per collisioni auto, e controlPoints per Bezier manuale
    return { d, cx, cy, expandedPoints: midPoints, controlPoints };
};

// --- MATH: PROIEZIONE PUNTO SU POLIGONO (Per Linee Verdi) ---
export const getClosestPointOnPolygon = (polyPoints: { x: number, y: number }[], target: { x: number, y: number }) => {
    let minDist = Infinity;
    let closest = target;

    for (let i = 0; i < polyPoints.length; i++) {
        const p1 = polyPoints[i];
        const p2 = polyPoints[(i + 1) % polyPoints.length];

        // Calcola punto più vicino sul segmento p1-p2
        const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
        if (l2 === 0) continue;
        let t = ((target.x - p1.x) * (p2.x - p1.x) + (target.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = p1.x + t * (p2.x - p1.x);
        const projY = p1.y + t * (p2.y - p1.y);

        const d = (target.x - projX) ** 2 + (target.y - projY) ** 2;
        if (d < minDist) {
            minDist = d;
            closest = { x: projX, y: projY };
        }
    }
    return closest;
};

// --- MATH: PUNTO ESATTO SU CURVA BEZIER (Per Slider preciso) ---
export const getPointOnOrganicPerimeter = (controlPoints: { x: number, y: number }[], t: number) => {
    // t va da 0.0 a 1.0
    const len = controlPoints.length;
    if (len < 3) return controlPoints[0];

    // Normalizziamo t per trovare su quale segmento siamo
    // Il perimetro è composto da 'len' segmenti curvi
    const totalSegments = len;
    const exactIndex = t * totalSegments;
    const segmentIndex = Math.floor(exactIndex) % len;
    const localT = exactIndex - Math.floor(exactIndex); // t locale (0-1) dentro il singolo segmento curvo

    // Parametri della curva Quadratica Bezier per questo segmento
    // Start: Midpoint tra corrente e precedente (o meglio, come definito nel path SVG)
    // Nel loop SVG: Start = MidPoint[i], Control = ControlPoint[i+1], End = MidPoint[i+1]

    const currControl = controlPoints[(segmentIndex + 1) % len];
    const prevControl = controlPoints[segmentIndex];
    const nextControl = controlPoints[(segmentIndex + 2) % len];

    // Calcoliamo i punti medi (Start ed End della curva Q)
    const start = { x: (prevControl.x + currControl.x) / 2, y: (prevControl.y + currControl.y) / 2 };
    const end = { x: (currControl.x + nextControl.x) / 2, y: (currControl.y + nextControl.y) / 2 };
    const control = currControl;

    // Formula Quadratica Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    const mt = 1 - localT;
    const x = (mt * mt * start.x) + (2 * mt * localT * control.x) + (localT * localT * end.x);
    const y = (mt * mt * start.y) + (2 * mt * localT * control.y) + (localT * localT * end.y);

    return { x, y };
};

// --- GEOMETRIA CONDIVISA (FIX DEFINITIVO: NOMI SOPRA, ETA SOTTO) ---
// --- GEOMETRIA CONDIVISA (FIX: Padding +3px e Etichette) ---
export const getGroupGeometry = (g: NodeGroup, nodes: GenNode[]) => {
    const mems = nodes.filter(n => g.memberIds.includes(n.id));
    if (mems.length === 0) return null;

    let points: { x: number, y: number }[] = [];
    mems.forEach(n => {
        const nameWidth = Math.max(80, n.name.length * 8);
        const halfW = nameWidth / 2;
        const cx = n.x + NODE_WIDTH / 2;

        // Punti Sopra
        const topY = n.y - 25;
        points.push({ x: cx - halfW, y: topY });
        points.push({ x: cx + halfW, y: topY });

        // Punti Sotto
        const bottomY = n.y + NODE_HEIGHT + 10;
        points.push({ x: cx - halfW, y: bottomY });
        points.push({ x: cx + halfW, y: bottomY });

        // Punti Laterali
        points.push({ x: n.x - 5, y: n.y + NODE_HEIGHT / 2 });
        points.push({ x: n.x + NODE_WIDTH + 5, y: n.y + NODE_HEIGHT / 2 });
    });

    const hullPoints = getConvexHull(points);
    // Padding aumentato leggermente come richiesto (era 20, ora 23)
    const padding = g.customPadding ?? 23;

    return getOrganicBlobPath(hullPoints, padding);
};

export const getZigZagPath = (x1: number, y1: number, x2: number, y2: number, amplitude = 4, frequency = 12) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return `M ${x1} ${y1}`;

    const ux = dx / len; const uy = dy / len;
    const px = -uy; const py = ux;

    const steps = Math.max(1, Math.round(len / frequency));
    const stepLen = len / steps;

    let path = `M ${x1} ${y1}`;
    for (let i = 1; i < steps; i++) {
        const d = i * stepLen;
        const cx = x1 + ux * d;
        const cy = y1 + uy * d;
        const offset = (i % 2 !== 0) ? amplitude : -amplitude;
        path += ` L ${cx + px * offset} ${cy + py * offset}`;
    }
    path += ` L ${x2} ${y2}`;
    return path;
};

