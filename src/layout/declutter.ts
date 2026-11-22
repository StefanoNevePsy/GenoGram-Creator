// --- DISTRIBUZIONE SENZA SOVRAPPOSIZIONI ---
//
// Il layout Carter & McGoldrick usa distanze uniformi (coniugi a 120px,
// fratelli a 60px di scarto): con nomi lunghi le etichette si coprono. E chi
// non fa parte della struttura familiare — la terapeuta, un amico — resta
// dov'era, spesso sopra l'albero. Questo passo rende "visibile tutto" su
// qualunque disposizione, automatica o fatta a mano, ragionando sull'ingombro
// reale di ogni persona (nome, croce, etichette), non sul quadrato di 40px.
//
// Tre trattamenti diversi, perché i tre casi sono diversi:
//
// 1. Persone della STRUTTURA (coppie, figli). Dove due ingombri si toccano si
//    inserisce spazio con una deformazione monotona dell'asse x: tutto ciò che
//    sta a destra del punto di taglio si sposta insieme, su TUTTE le righe.
//    Così l'ordine sinistra→destra di ogni generazione resta quello (il
//    primogenito resta a sinistra) e i figli restano sotto ai genitori. Poi,
//    se richiesto, ogni coppia si ricentra sullo span dei propri figli.
// 2. Persone SATELLITE (nessun legame di coppia o di filiazione): non hanno
//    titolo a deformare l'albero. Si spostano nel posto libero più vicino alle
//    persone con cui sono collegate, evitando anche le linee di parentela.
// 3. NOTE ADESIVE che coprono qualcuno: nel posto libero più vicino.
//
// Funzione pura: riceve dati, restituisce posizioni. Testabile.

import type { GenNode, RelationEdge, StickyNoteData, NodeGroup } from '../types';
import { RELATION_CATEGORIES } from '../config/relationships';
import { NODE_WIDTH, MARRIAGE_BAR_Y } from '../config/constants';
import { nodeFootprint } from '../utils/footprint';
import { groupContour, pointInPolygon, type Rect, type Pt } from '../utils/groupShape';

export interface DeclutterOptions {
    /** spazio libero minimo fra due ingombri */
    margin?: number;
    /** griglia: gli spazi inseriti sono multipli di questo valore (0 = nessuna) */
    snap?: number;
    /** ricentra le coppie sui figli dopo aver fatto spazio (layout C&M) */
    recenter?: boolean;
    /** 'all': colloca ogni satellite accanto a chi è collegato; 'overlapping': solo chi copre qualcosa */
    satellites?: 'all' | 'overlapping';
    /** gruppi: satelliti e note non vanno messi dentro un gruppo di cui non fanno parte */
    groups?: NodeGroup[];
    /**
     * Le posizioni PRIMA di un layout completo. Se date, chi non ha legami e
     * le note seguono la persona che avevano più vicina: una nota accanto al
     * nonno resta accanto al nonno, invece di restare dov'era mentre l'albero
     * si sposta altrove.
     */
    previous?: GenNode[];
}

export interface DeclutterResult {
    positions: Map<string, Pt>;
    notes: Map<string, Pt>;
    /** quante persone e note sono state spostate */
    moved: number;
}

const overlaps = (a: Rect, b: Rect, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const shiftRect = (r: Rect, dx: number, dy: number): Rect => ({ x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy });

// segmento (orizzontale o verticale) che attraversa un rettangolo
const segHits = (a: Pt, b: Pt, r: Rect) => {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    return x0 <= r.x1 && x1 >= r.x0 && y0 <= r.y1 && y1 >= r.y0;
};

export const declutterLayout = (
    nodes: GenNode[], edges: RelationEdge[], notes: StickyNoteData[] = [], opts: DeclutterOptions = {}
): DeclutterResult => {
    const { margin = 14, snap = 0, recenter = false, satellites = 'overlapping', groups = [], previous } = opts;
    const pos = new Map<string, Pt>(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const fp = (id: string) => { const n = byId.get(id)!, p = pos.get(id)!; return nodeFootprint({ ...n, x: p.x, y: p.y }); };

    const coupleTypes = new Set(RELATION_CATEGORIES['Struttura / Coppia']);
    const structuralEdges = edges.filter(e => byId.has(e.fromId) && byId.has(e.toId)
        && (coupleTypes.has(e.type) || e.type.startsWith('child') || e.type.startsWith('twin')));
    const structural = new Set<string>();
    structuralEdges.forEach(e => { structural.add(e.fromId); structural.add(e.toId); });
    const core = nodes.filter(n => structural.has(n.id)).map(n => n.id);
    const sats = nodes.filter(n => !structural.has(n.id)).map(n => n.id);

    // due persone esattamente sovrapposte non hanno un "sinistra" e un "destra":
    // si scostano di un pixel nell'ordine dei dati, così il taglio le separa
    {
        const seen = new Set<string>();
        core.forEach(id => {
            const p = pos.get(id)!;
            let k = `${Math.round(p.x)},${Math.round(p.y)}`;
            while (seen.has(k)) { p.x += 1; k = `${Math.round(p.x)},${Math.round(p.y)}`; }
            seen.add(k);
        });
    }

    // unioni (insieme dei genitori) → figli, per la ricentratura
    const unions = new Map<string, { parents: string[], kids: string[] }>();
    if (recenter) {
        const parentsOf = new Map<string, Set<string>>();
        structuralEdges.filter(e => e.type.startsWith('child')).forEach(e => {
            const s = parentsOf.get(e.toId) || new Set<string>();
            s.add(e.fromId); parentsOf.set(e.toId, s);
        });
        parentsOf.forEach((ps, kid) => {
            const parents = [...ps].sort();
            const key = parents.join('|');
            const u = unions.get(key) || { parents, kids: [] };
            u.kids.push(kid); unions.set(key, u);
        });
    }
    // chi è genitore in più unioni (secondi matrimoni) non si ricentra: le
    // unioni lo tirerebbero in direzioni diverse e la catena coniugale è già
    // ordinata cronologicamente dal layout
    const unionCount = new Map<string, number>();
    unions.forEach(u => u.parents.forEach(p => unionCount.set(p, (unionCount.get(p) || 0) + 1)));

    const cx = (id: string) => pos.get(id)!.x + NODE_WIDTH / 2;
    const roundUp = (v: number) => (snap > 0 ? Math.ceil(v / snap) * snap : Math.ceil(v));

    // --- 1. struttura: fare spazio senza rompere l'ordine ---
    // Un taglio sposta a destra chi sta sulla SUA riga oltre il punto di
    // taglio, e con loro i discendenti (i figli seguono i genitori). Le altre
    // righe non si toccano: un taglio globale, necessario fra i nomi di due
    // nonni, aprirebbe un buco anche nella fila dei nipoti sotto di loro.
    const rowOf = new Map<string, number>();
    {
        const ys = [...new Set(core.map(id => Math.round(pos.get(id)!.y)))].sort((a, b) => a - b);
        const rowY: number[] = [];
        ys.forEach(y => { if (!rowY.length || y - rowY[rowY.length - 1] > 30) rowY.push(y); });
        core.forEach(id => {
            const y = pos.get(id)!.y;
            let best = 0;
            rowY.forEach((ry, i) => { if (Math.abs(ry - y) < Math.abs(rowY[best] - y)) best = i; });
            rowOf.set(id, best);
        });
    }
    // Chi segue chi quando una persona si sposta: i figli seguono i genitori;
    // il coniuge "acquisito" di un figlio (senza genitori nel disegno) segue
    // il partner, ma solo per spostamenti EREDITATI dall'alto — quando il
    // taglio passa proprio fra i due, è lì per separarli.
    const kidsOf = new Map<string, string[]>();
    structuralEdges.filter(e => e.type.startsWith('child')).forEach(e => {
        kidsOf.set(e.fromId, [...(kidsOf.get(e.fromId) || []), e.toId]);
    });
    const hasParents = new Set(structuralEdges.filter(e => e.type.startsWith('child')).map(e => e.toId));
    const inLaws = new Map<string, string[]>();
    structuralEdges.filter(e => coupleTypes.has(e.type)).forEach(e => {
        [[e.fromId, e.toId], [e.toId, e.fromId]].forEach(([a, b]) => {
            if (hasParents.has(a) && !hasParents.has(b)) inLaws.set(a, [...(inLaws.get(a) || []), b]);
        });
    });

    for (let iter = 0; iter < 25; iter++) {
        const rects = core.map(id => ({ id, r: fp(id) }));
        const cuts: { row: number, x: number, extra: number }[] = [];
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const a = rects[i], b = rects[j];
                if (!overlaps(a.r, b.r, margin)) continue;
                const [L, R] = cx(a.id) <= cx(b.id) ? [a, b] : [b, a];
                const need = L.r.x1 + margin - R.r.x0;
                if (need <= 0) continue;
                cuts.push({ row: rowOf.get(R.id)!, x: (cx(L.id) + cx(R.id)) / 2, extra: roundUp(need) });
            }
        }
        let changed = cuts.length > 0;
        if (cuts.length) {
            // per riga, allo stesso punto di taglio basta lo spazio più grande richiesto
            const perRow = new Map<number, Map<number, number>>();
            cuts.forEach(c => {
                const m = perRow.get(c.row) || new Map<number, number>();
                const k = Math.round(c.x * 2) / 2;
                m.set(k, Math.max(m.get(k) || 0, c.extra));
                perRow.set(c.row, m);
            });
            const own = new Map<string, number>();
            core.forEach(id => {
                const m = perRow.get(rowOf.get(id)!);
                if (!m) return;
                const x = cx(id);
                let add = 0;
                m.forEach((extra, cut) => { if (x > cut) add += extra; });
                if (add) own.set(id, add);
            });
            // propagazione ai discendenti: ognuno si sposta del massimo fra
            // il proprio taglio e quello ereditato da chi segue
            const total = new Map<string, number>();
            const visit = (id: string, inherited: number, depth: number) => {
                if (depth > 64) return;
                const t = inherited + (own.get(id) || 0);
                if (total.has(id) && total.get(id)! >= t) return;
                total.set(id, t);
                (kidsOf.get(id) || []).forEach(k => visit(k, t, depth + 1));
                if (inherited > 0) (inLaws.get(id) || []).forEach(sp => visit(sp, inherited, depth + 1));
            };
            own.forEach((_, id) => visit(id, 0, 0));
            total.forEach((t, id) => { if (t) pos.get(id)!.x += t; });
        }

        if (recenter) {
            // dal basso verso l'alto: i genitori si centrano sui figli già sistemati
            const ordered = [...unions.values()].sort((a, b) =>
                Math.max(...b.parents.map(p => pos.get(p)!.y)) - Math.max(...a.parents.map(p => pos.get(p)!.y)));
            ordered.forEach(u => {
                if (u.parents.some(p => (unionCount.get(p) || 0) > 1)) return;
                const kx = u.kids.map(cx);
                const target = (Math.min(...kx) + Math.max(...kx)) / 2;
                const px = u.parents.map(cx);
                const current = (Math.min(...px) + Math.max(...px)) / 2;
                let d = target - current;
                if (snap > 0) d = Math.round(d / snap) * snap;
                if (Math.abs(d) < 1) return;
                u.parents.forEach(p => { pos.get(p)!.x += d; });
                changed = true;
            });
        }
        if (!changed) break;
    }

    // --- linee di parentela, da non coprire con satelliti e note ---
    const lines: [Pt, Pt][] = [];
    structuralEdges.forEach(e => {
        const a = pos.get(e.fromId)!, b = pos.get(e.toId)!;
        if (coupleTypes.has(e.type)) {
            const bar = Math.max(a.y, b.y) + MARRIAGE_BAR_Y;
            lines.push([{ x: a.x + NODE_WIDTH / 2, y: bar }, { x: b.x + NODE_WIDTH / 2, y: bar }]);
        } else if (e.type.startsWith('child')) {
            lines.push([{ x: b.x + NODE_WIDTH / 2, y: a.y + MARRIAGE_BAR_Y }, { x: b.x + NODE_WIDTH / 2, y: b.y }]);
        }
    });

    // --- 2. satelliti: posto libero vicino a chi sono collegati ---
    const placed: Rect[] = core.map(fp);
    let moved = 0;
    const startPos = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));

    // Aree dei gruppi, con le posizioni già sistemate. Un satellite messo
    // dentro un gruppo di cui non fa parte sembrerebbe un membro: per un
    // genogramma è un errore di lettura, non un dettaglio grafico.
    const groupAreas = groups.map(g => {
        const mem = new Set(g.memberIds);
        const c = groupContour(nodes.filter(n => mem.has(n.id)).map(n => fp(n.id)), [], g.customPadding ?? 23);
        return c ? { members: mem, poly: c.outline, box: c.bounds } : null;
    }).filter(Boolean) as { members: Set<string>, poly: Pt[], box: Rect }[];
    const inGroupArea = (r0: Rect, who?: string) => groupAreas.some(a => {
        if (who && a.members.has(who)) return false;
        const r = { x0: r0.x0 - margin, y0: r0.y0 - margin, x1: r0.x1 + margin, y1: r0.y1 + margin };   // non a filo del bordo
        if (!overlaps(r, a.box)) return false;
        const probes = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x0, y: r.y1 }, { x: r.x1, y: r.y1 }, { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }];
        return probes.some(p => pointInPolygon(p, a.poly)) || a.poly.some(p => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
    });

    let current: string | undefined;   // chi si sta collocando (per escludere i suoi gruppi)
    const isFree = (r: Rect) => !placed.some(o => overlaps(r, o, margin))
        && !lines.some(([a, b]) => segHits(a, b, r))
        && !inGroupArea(r, current);

    // Spirale quadrata di posizioni candidate attorno al punto voluto, già
    // sulla griglia: arrotondare DOPO aver trovato il posto libero potrebbe
    // rimettere l'oggetto sopra qualcuno. `rel` è l'ingombro relativo
    // all'àncora (l'angolo in alto a sinistra del simbolo o della nota).
    const step = snap > 0 ? snap : 20;
    const findSpot = (rel: Rect, want: Pt): Pt | null => {
        const g = (v: number) => Math.round(v / step) * step;
        const base = { x: g(want.x), y: g(want.y) };
        const at = (a: Pt) => shiftRect(rel, a.x, a.y);
        if (isFree(at(base))) return base;
        for (let ring = 1; ring < 60; ring++) {
            let best: Pt | null = null, bestD = Infinity;
            for (let i = -ring; i <= ring; i++) {
                for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
                    const a = { x: base.x + dx * step, y: base.y + dy * step };
                    const d = Math.hypot(dx, dy * 1.4);   // preferisce restare sulla stessa riga
                    if (d < bestD && isFree(at(a))) { best = a; bestD = d; }
                }
            }
            if (best) return best;
        }
        return null;
    };

    const prevPos = previous ? new Map(previous.map(n => [n.id, { x: n.x, y: n.y }])) : null;
    // spostamento subito dalla persona della struttura più vicina a `pt` (prima del layout)
    const anchorDelta = (pt: Pt): Pt => {
        if (!prevPos) return { x: 0, y: 0 };
        let best: string | null = null, bd = Infinity;
        core.forEach(id => {
            const q = prevPos.get(id);
            if (!q) return;
            const d = Math.hypot(q.x - pt.x, q.y - pt.y);
            if (d < bd) { bd = d; best = id; }
        });
        if (!best) return { x: 0, y: 0 };
        const a = prevPos.get(best)!, b = pos.get(best)!;
        return { x: b.x - a.x, y: b.y - a.y };
    };

    const relatedOf = (id: string) => edges
        .filter(e => (e.fromId === id || e.toId === id) && byId.has(e.fromId) && byId.has(e.toId))
        .map(e => (e.fromId === id ? e.toId : e.fromId))
        .filter(o => o !== id);

    sats.forEach(id => {
        current = id;
        const p = pos.get(id)!;
        const r = fp(id);
        if (satellites === 'all' || !isFree(r)) {
            const rel = shiftRect(r, -p.x, -p.y);
            const others = relatedOf(id);
            // si punta al centro dei collegati; chi non ne ha segue la persona
            // che aveva più vicina (o resta dov'è, se non c'è stato un layout)
            const dl = anchorDelta(prevPos?.get(id) || p);
            let want = { x: p.x + dl.x, y: p.y + dl.y };
            if (others.length) {
                want = {
                    x: others.reduce((s, o) => s + pos.get(o)!.x, 0) / others.length,
                    y: others.reduce((s, o) => s + pos.get(o)!.y, 0) / others.length,
                };
            }
            const spot = findSpot(rel, want);
            if (spot) { p.x = spot.x; p.y = spot.y; }
        }
        placed.push(fp(id));
    });

    nodes.forEach(n => {
        const a = startPos.get(n.id)!, b = pos.get(n.id)!;
        if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5) moved++;
    });

    // --- 3. note adesive che coprono qualcuno ---
    const notePos = new Map<string, Pt>();
    current = undefined;
    notes.forEach(sn => {
        const dl = anchorDelta({ x: sn.x + (sn.width || 0) / 2, y: sn.y + (sn.height || 0) / 2 });
        const nx = sn.x + dl.x, ny = sn.y + dl.y;
        const r: Rect = { x0: nx, y0: ny, x1: nx + (sn.width || 0), y1: ny + (sn.height || 0) };
        let out = { x: nx, y: ny };
        if (dl.x || dl.y) moved++;
        // si sposta solo se copre una persona o una linea di parentela: una
        // nota appoggiata su un gruppo spesso ne è la didascalia, voluta
        const covers = placed.some(o => overlaps(r, o, margin)) || lines.some(([a, b]) => segHits(a, b, r));
        if (covers) {
            const spot = findSpot(shiftRect(r, -nx, -ny), { x: nx, y: ny });
            if (spot) { out = spot; if (!(dl.x || dl.y)) moved++; }
        }
        notePos.set(sn.id, out);
        placed.push(shiftRect(r, out.x - nx, out.y - ny));
    });

    return { positions: pos, notes: notePos, moved };
};
