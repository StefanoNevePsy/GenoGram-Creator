// --- LAYOUT GENOGRAMMA (Carter & McGoldrick) ---
// Algoritmo deterministico a blocchi (tidy-tree esteso alle coppie), NON fisico.
// Regole implementate:
//  - Generazioni su righe orizzontali rigide
//  - Fratelli da sinistra a destra per età (primogenito a sinistra); gemelli adiacenti
//  - Nella coppia l'uomo sta a sinistra
//  - Matrimoni multipli: catena cronologica con la persona condivisa tra le unioni
//  - Genitori centrati sopra lo span dei figli
//  - Famiglie acquisite (genitori del coniuge) posizionate come alberi adiacenti,
//    traslate per avvicinare il coniuge alla sua famiglia d'origine
// Funzione pura: nessun accesso a stato React. Testabile con fixture.

import type { GenNode, RelationEdge } from '../types';
import { RELATION_CATEGORIES } from '../config/relationships';
import { parseDate } from '../utils/dates';

export interface LayoutOptions {
    levelH?: number;     // distanza verticale tra generazioni
    nodeW?: number;      // larghezza simbolo
    spouseDist?: number; // distanza orizzontale tra partner (tra le x)
    sibGap?: number;     // gap minimo tra sottoalberi fratelli
    treeGap?: number;    // gap tra alberi sconnessi
    centerX?: number;    // centro orizzontale del risultato
    centerY?: number;    // centro verticale del risultato
    snap?: number;       // arrotondamento alla griglia (0 = nessuno)
}

export interface LayoutResult {
    positions: Map<string, { x: number, y: number }>;
    warnings: string[];
}

interface Chain {          // blocco atomico: persona singola o catena di coniugi
    id: number;
    members: string[];     // ordinati sx->dx
    gen: number;
    claimed: boolean;      // già agganciato come figlio di un'unione
    childChains: Chain[];  // sottoalberi (riempito durante il DFS)
    stubs: string[];       // figli disegnati altrove (per centratura e hint)
    width: number;
    hintTargets: string[]; // membri-figli claimati altrove: usati per traslare l'albero
}

export const computeGenogramLayout = (
    nodes: GenNode[], edges: RelationEdge[], opts: LayoutOptions = {}
): LayoutResult => {
    const {
        levelH = 180, nodeW = 40, spouseDist = 120, sibGap = 60,
        treeGap = 160, centerX = 4000, centerY = 4000, snap = 40
    } = opts;

    const warnings: string[] = [];
    const positions = new Map<string, { x: number, y: number }>();
    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // --- 1. GRAFO FAMILIARE ---
    const structural = new Set(RELATION_CATEGORIES["Struttura / Coppia"]);
    const coupleEdges = edges.filter(e => structural.has(e.type) && nodeById.has(e.fromId) && nodeById.has(e.toId));
    const childEdges = edges.filter(e => e.type.startsWith('child') && nodeById.has(e.fromId) && nodeById.has(e.toId));
    const twinEdges = edges.filter(e => e.type.startsWith('twin') && nodeById.has(e.fromId) && nodeById.has(e.toId));

    const parentsOf = new Map<string, string[]>();
    childEdges.forEach(e => {
        const list = parentsOf.get(e.toId) || [];
        if (!list.includes(e.fromId)) list.push(e.fromId);
        parentsOf.set(e.toId, list);
    });

    // Considera solo nodi collegati alla struttura familiare (gli isolati restano dove sono)
    const involved = new Set<string>();
    coupleEdges.forEach(e => { involved.add(e.fromId); involved.add(e.toId); });
    childEdges.forEach(e => { involved.add(e.fromId); involved.add(e.toId); });
    if (involved.size === 0) return { positions, warnings };

    // --- 2. GENERAZIONI (longest-path sui legami genitore-figlio, con guardia cicli) ---
    const gen = new Map<string, number>();
    const visiting = new Set<string>();
    const depth = (id: string): number => {
        if (gen.has(id)) return gen.get(id)!;
        if (visiting.has(id)) { warnings.push(`Ciclo genitore-figlio rilevato (${nodeById.get(id)?.name || id})`); return 0; }
        visiting.add(id);
        const ps = parentsOf.get(id) || [];
        const d = ps.length ? Math.max(...ps.map(depth)) + 1 : 0;
        visiting.delete(id);
        gen.set(id, d);
        return d;
    };
    involved.forEach(id => depth(id));

    // Sincronizza coniugi (alza solo chi non ha genitori nel grafo), poi ri-stringi i figli
    for (let iter = 0; iter < 10; iter++) {
        let changed = false;
        coupleEdges.forEach(e => {
            const ga = gen.get(e.fromId)!; const gb = gen.get(e.toId)!;
            if (ga === gb) return;
            const lo = ga < gb ? e.fromId : e.toId;
            const hi = Math.max(ga, gb);
            if (!(parentsOf.get(lo) || []).length) { gen.set(lo, hi); changed = true; }
            else if (iter === 9) warnings.push(`Generazioni incompatibili tra coniugi (${nodeById.get(e.fromId)?.name} / ${nodeById.get(e.toId)?.name})`);
        });
        parentsOf.forEach((ps, c) => {
            if (!involved.has(c)) return;
            const need = Math.max(...ps.map(p => gen.get(p) || 0)) + 1;
            if ((gen.get(c) || 0) < need) { gen.set(c, need); changed = true; }
        });
        if (!changed) break;
    }

    // --- 3. CATENE CONIUGALI (blocchi atomici per generazione) ---
    // Adiacenza tra partner della stessa generazione, ordinata cronologicamente (indice edge)
    const partnerAdj = new Map<string, { partner: string, order: number }[]>();
    coupleEdges.forEach((e, i) => {
        if (gen.get(e.fromId) !== gen.get(e.toId)) return; // gen diverse: la linea resta, il blocco no
        const add = (a: string, b: string) => {
            const l = partnerAdj.get(a) || [];
            if (!l.some(x => x.partner === b)) l.push({ partner: b, order: i });
            partnerAdj.set(a, l);
        };
        add(e.fromId, e.toId); add(e.toId, e.fromId);
    });

    const chainOf = new Map<string, Chain>();
    const chains: Chain[] = [];
    let chainSeq = 0;
    const sortedIds = Array.from(involved).sort((a, b) => (nodeIndex.get(a)! - nodeIndex.get(b)!));
    sortedIds.forEach(id => {
        if (chainOf.has(id)) return;
        // Componente connessa via partner
        const comp = new Set<string>([id]);
        const stack = [id];
        while (stack.length) {
            const cur = stack.pop()!;
            (partnerAdj.get(cur) || []).forEach(({ partner }) => { if (!comp.has(partner)) { comp.add(partner); stack.push(partner); } });
        }
        // Linearizza: parti da un estremo (grado 1), cammina scegliendo il legame più vecchio
        let members: string[];
        if (comp.size === 1) members = [id];
        else {
            const degree = (x: string) => (partnerAdj.get(x) || []).filter(p => comp.has(p.partner)).length;
            const endpoints = Array.from(comp).filter(x => degree(x) === 1).sort((a, b) => nodeIndex.get(a)! - nodeIndex.get(b)!);
            const start = endpoints[0] || Array.from(comp).sort((a, b) => nodeIndex.get(a)! - nodeIndex.get(b)!)[0];
            members = [start];
            const used = new Set([start]);
            let cur = start;
            while (members.length < comp.size) {
                const next = (partnerAdj.get(cur) || [])
                    .filter(p => comp.has(p.partner) && !used.has(p.partner))
                    .sort((a, b) => a.order - b.order)[0];
                if (!next) break; // ciclo poligamico: interrompi
                members.push(next.partner); used.add(next.partner); cur = next.partner;
            }
            comp.forEach(m => { if (!used.has(m)) { members.push(m); warnings.push(`Struttura coniugale ciclica semplificata (${nodeById.get(m)?.name})`); } });
            // Convenzione: uomo a sinistra
            const g0 = nodeById.get(members[0])?.gender; const gL = nodeById.get(members[members.length - 1])?.gender;
            if (g0 === 'F' && gL === 'M') members.reverse();
        }
        const c: Chain = { id: chainSeq++, members, gen: gen.get(id) || 0, claimed: false, childChains: [], stubs: [], width: 0, hintTargets: [] };
        members.forEach(m => chainOf.set(m, c));
        chains.push(c);
    });

    // --- 4. FIGLI PER UNIONE, ordinati per età (gemelli adiacenti) ---
    // Gruppi gemellari (union-find semplice)
    const twinRoot = new Map<string, string>();
    const findTwin = (x: string): string => { const r = twinRoot.get(x); if (!r || r === x) return x; const f = findTwin(r); twinRoot.set(x, f); return f; };
    twinEdges.forEach(e => { const a = findTwin(e.fromId), b = findTwin(e.toId); if (a !== b) twinRoot.set(a, b); });

    const birthKey = (id: string): number => {
        const d = parseDate(nodeById.get(id)?.birthDate || '');
        return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
    };
    const sortSiblings = (ids: string[]): string[] => {
        const groupKey = new Map<string, number>();
        ids.forEach(id => {
            const r = findTwin(id);
            groupKey.set(r, Math.min(groupKey.get(r) ?? Infinity, birthKey(id)));
        });
        return [...ids].sort((a, b) => {
            const ka = groupKey.get(findTwin(a))!; const kb = groupKey.get(findTwin(b))!;
            if (ka !== kb) return ka - kb;
            const ba = birthKey(a), bb = birthKey(b);
            if (ba !== bb) return ba - bb;
            return nodeIndex.get(a)! - nodeIndex.get(b)!;
        });
    };

    // childrenOfUnion: chiave = id genitori ordinati
    const unionChildren = new Map<string, string[]>();
    parentsOf.forEach((ps, c) => {
        const key = [...ps].sort().join('|');
        const l = unionChildren.get(key) || [];
        l.push(c);
        unionChildren.set(key, l);
    });
    unionChildren.forEach((l, k) => unionChildren.set(k, sortSiblings(l)));

    // Unioni di una catena, in ordine sx->dx: coppie consecutive + monogenitoriali
    const chainUnionKeys = (c: Chain): string[] => {
        const keys: string[] = [];
        for (let i = 0; i < c.members.length - 1; i++) keys.push([c.members[i], c.members[i + 1]].sort().join('|'));
        c.members.forEach(m => keys.push(m)); // unioni monogenitoriali
        return keys.filter(k => unionChildren.has(k));
    };

    // --- 5. COSTRUZIONE ALBERI (DFS con claim) ---
    const buildTree = (c: Chain) => {
        c.claimed = true;
        chainUnionKeys(c).forEach(key => {
            unionChildren.get(key)!.forEach(childId => {
                const cc = chainOf.get(childId);
                if (!cc) return;
                if (cc.claimed) {
                    // Figlio già disegnato altrove (es. coniuge acquisito): resta uno stub
                    if (!c.stubs.includes(childId)) { c.stubs.push(childId); c.hintTargets.push(childId); }
                    return;
                }
                c.childChains.push(cc);
                buildTree(cc);
            });
        });
    };

    // Radici in ordine deterministico: prima generazioni alte, poi ordine di creazione
    const roots: Chain[] = [];
    [...chains].sort((a, b) => a.gen - b.gen || Math.min(...a.members.map(m => nodeIndex.get(m)!)) - Math.min(...b.members.map(m => nodeIndex.get(m)!)))
        .forEach(c => { if (!c.claimed) { roots.push(c); buildTree(c); } });

    // --- 6. LARGHEZZE (post-order) ---
    const ownWidth = (c: Chain) => nodeW + (c.members.length - 1) * spouseDist;
    const calcWidth = (c: Chain): number => {
        const kids = [...c.childChains.map(calcWidth), ...c.stubs.map(() => nodeW)];
        const kidsW = kids.length ? kids.reduce((s, w) => s + w, 0) + (kids.length - 1) * sibGap : 0;
        c.width = Math.max(ownWidth(c), kidsW);
        return c.width;
    };
    roots.forEach(calcWidth);

    // --- 7. POSIZIONAMENTO (pre-order): figli sx->dx, genitori centrati sullo span ---
    const stubPos = new Map<string, number>(); // posizione provvisoria degli stub (per gli hint)
    const place = (c: Chain, left: number) => {
        const y = c.gen * levelH;
        // Ordina i sottoalberi come i figli nelle unioni (età), stub inclusi
        const slots: { w: number, chain?: Chain, stub?: string }[] = [];
        const kidOrder: string[] = [];
        chainUnionKeys(c).forEach(key => unionChildren.get(key)!.forEach(k => kidOrder.push(k)));
        kidOrder.forEach(k => {
            const cc = chainOf.get(k);
            if (cc && c.childChains.includes(cc)) {
                if (!slots.some(s => s.chain === cc)) slots.push({ w: cc.width, chain: cc });
            } else if (c.stubs.includes(k)) {
                slots.push({ w: nodeW, stub: k });
            }
        });
        const kidsW = slots.length ? slots.reduce((s, x) => s + x.w, 0) + (slots.length - 1) * sibGap : 0;
        const span = Math.max(c.width, kidsW);
        let cursor = left + (span - kidsW) / 2;
        slots.forEach(s => {
            if (s.chain) place(s.chain, cursor);
            else stubPos.set(s.stub!, cursor);
            cursor += s.w + sibGap;
        });
        // Centro della catena: sui figli se esistono, altrimenti sul proprio blocco
        const center = left + span / 2;
        const first = center - ((c.members.length - 1) * spouseDist) / 2;
        c.members.forEach((m, i) => positions.set(m, { x: first + i * spouseDist, y }));
    };

    // Alberi senza hint: affiancati. Alberi con hint (famiglie acquisite): traslati
    // verso il coniuge già disegnato, con collisioni risolte PER RIGA (non per bbox
    // intero: le famiglie condividono poche generazioni, l'impaccamento è più stretto).
    const plain = roots.filter(r => r.hintTargets.length === 0);
    const hinted = roots.filter(r => r.hintTargets.length > 0);

    const treeExtents = (r: Chain) => {
        const ext = new Map<number, { min: number, max: number }>();
        const walk = (c: Chain) => {
            c.members.forEach(m => {
                const p = positions.get(m)!;
                const e = ext.get(p.y) || { min: Infinity, max: -Infinity };
                e.min = Math.min(e.min, p.x); e.max = Math.max(e.max, p.x);
                ext.set(p.y, e);
            });
            c.childChains.forEach(walk);
        };
        walk(r);
        return ext;
    };
    const rowMax = new Map<number, number>(); // massima x occupata per riga
    const commitExtents = (ext: Map<number, { min: number, max: number }>, dx: number) => {
        ext.forEach((e, row) => rowMax.set(row, Math.max(rowMax.get(row) ?? -Infinity, e.max + dx)));
    };

    let cursor = 0;
    plain.forEach(r => {
        place(r, cursor);
        commitExtents(treeExtents(r), 0);
        cursor += r.width + treeGap;
    });
    hinted.forEach(r => {
        place(r, 0); // layout provvisorio a origine 0
        const ext = treeExtents(r);
        const t = r.hintTargets.find(t => positions.has(t) && stubPos.has(t));
        const targetDx = t ? positions.get(t)!.x - stubPos.get(t)! : cursor;
        // Spostamento minimo a destra per non collidere su nessuna riga condivisa
        let dxMin = -Infinity;
        ext.forEach((e, row) => {
            if (rowMax.has(row)) dxMin = Math.max(dxMin, rowMax.get(row)! + nodeW + sibGap - e.min);
        });
        const dx = Math.max(targetDx, dxMin === -Infinity ? targetDx : dxMin);
        const shift = (c: Chain) => {
            c.members.forEach(m => { const p = positions.get(m)!; positions.set(m, { x: p.x + dx, y: p.y }); });
            c.childChains.forEach(shift);
        };
        shift(r);
        commitExtents(ext, dx);
        cursor = Math.max(cursor, dx + r.width + treeGap);
    });

    // --- 8. CENTRATURA E SNAP ---
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    positions.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const dx = centerX - (minX + maxX) / 2;
    const dy = centerY - (minY + maxY) / 2;
    const doSnap = (v: number) => snap > 0 ? Math.round(v / snap) * snap : v;
    positions.forEach((p, id) => positions.set(id, { x: doSnap(p.x + dx), y: doSnap(p.y + dy) }));

    return { positions, warnings };
};
