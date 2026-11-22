import { describe, it, expect } from 'vitest';
import { declutterLayout } from './declutter';
import { nodeFootprint } from '../utils/footprint';
import { groupContour, pointInPolygon } from '../utils/groupShape';
import type { GenNode, RelationEdge, StickyNoteData } from '../types';

const N = (id: string, x: number, y: number, name = id): GenNode => ({
    id, x, y, name, gender: 'M', birthDate: '', deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [],
} as GenNode);
const E = (f: string, t: string, type: string): RelationEdge => ({ id: `${f}-${t}`, fromId: f, toId: t, type, label: '', notes: [] } as RelationEdge);

const fpAt = (n: GenNode, p: { x: number, y: number }) => nodeFootprint({ ...n, ...p });
const overlap = (a: ReturnType<typeof nodeFootprint>, b: ReturnType<typeof nodeFootprint>) =>
    a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const noOverlaps = (nodes: GenNode[], pos: Map<string, { x: number, y: number }>) => {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        if (overlap(fpAt(nodes[i], pos.get(nodes[i].id)!), fpAt(nodes[j], pos.get(nodes[j].id)!))) return `${nodes[i].id}/${nodes[j].id}`;
    }
    return null;
};

describe('distribuzione senza sovrapposizioni', () => {
    it('fa spazio ai nomi lunghi di una coppia senza invertirne l\'ordine', () => {
        const nodes = [N('nonno', 0, 0, 'Giuseppe Bartolomeo Rossi'), N('nonna', 120, 0, 'Maria Antonietta Bianchi')];
        const r = declutterLayout(nodes, [E('nonno', 'nonna', 'marriage')]);
        expect(noOverlaps(nodes, r.positions)).toBeNull();
        expect(r.positions.get('nonno')!.x).toBeLessThan(r.positions.get('nonna')!.x);
        expect(r.positions.get('nonna')!.y).toBe(0);   // la riga generazionale resta quella
    });

    it('lo spazio fra i nonni non apre un buco nella fila dei nipoti', () => {
        // nonni con nomi lunghi; figlio unico; quattro nipoti a passo regolare
        const nodes = [
            N('gp', 0, 0, 'Giuseppe Bartolomeo Rossi'), N('gm', 120, 0, 'Maria Antonietta Bianchi'),
            N('pa', 60, 180, 'Paolo'),
            ...[0, 1, 2, 3].map(i => N('k' + i, -60 + i * 80, 360, 'K' + i)),
        ];
        const edges = [E('gp', 'gm', 'marriage'), E('gp', 'pa', 'child-bio'), E('gm', 'pa', 'child-bio'),
            ...[0, 1, 2, 3].map(i => E('pa', 'k' + i, 'child-bio'))];
        const r = declutterLayout(nodes, edges, [], { recenter: true });
        const ks = [0, 1, 2, 3].map(i => r.positions.get('k' + i)!.x);
        const gaps = ks.slice(1).map((x, i) => x - ks[i]);
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);   // passo ancora regolare
        expect(noOverlaps(nodes, r.positions)).toBeNull();
    });

    it('ricentra i genitori sullo span dei figli', () => {
        const nodes = [N('p', 0, 0, 'Padre con un nome lungo'), N('m', 120, 0, 'Madre con un nome lungo'),
            N('a', 0, 180), N('b', 80, 180), N('c', 160, 180)];
        const edges = [E('p', 'm', 'marriage'), ...['a', 'b', 'c'].flatMap(k => [E('p', k, 'child-bio'), E('m', k, 'child-bio')])];
        const r = declutterLayout(nodes, edges, [], { recenter: true });
        const P = (id: string) => r.positions.get(id)!.x;
        expect(Math.abs((P('p') + P('m')) / 2 - (P('a') + P('c')) / 2)).toBeLessThan(1);
    });

    it('chi non ha legami di parentela non deforma l\'albero: si sposta lui', () => {
        const nodes = [N('p', 0, 0), N('m', 120, 0), N('ter', 10, 5, 'Terapeuta')];
        const edges = [E('p', 'm', 'marriage'), E('ter', 'm', 'therapeutic')];
        const r = declutterLayout(nodes, edges);
        expect(r.positions.get('p')).toEqual({ x: 0, y: 0 });
        expect(r.positions.get('m')).toEqual({ x: 120, y: 0 });
        expect(noOverlaps(nodes, r.positions)).toBeNull();
        // e resta vicino a chi è collegato
        const t = r.positions.get('ter')!;
        expect(Math.hypot(t.x - 120, t.y)).toBeLessThan(220);
    });

    it('un satellite non finisce dentro un gruppo di cui non fa parte', () => {
        const nodes = [N('a', 0, 0), N('b', 80, 0), N('x', 40, 0, 'Estraneo')];
        const edges = [E('a', 'b', 'marriage'), E('x', 'a', 'friendship')];
        const groups = [{ id: 'g', memberIds: ['a', 'b'], type: 'household', label: 'N', color: '#000', notes: [] }] as never;
        const r = declutterLayout(nodes, edges, [], { groups });
        const f = fpAt(nodes[2], r.positions.get('x')!);
        const c = groupContour([fpAt(nodes[0], { x: 0, y: 0 }), fpAt(nodes[1], { x: 80, y: 0 })], [], 23)!;
        const corners = [{ x: f.x0, y: f.y0 }, { x: f.x1, y: f.y0 }, { x: f.x0, y: f.y1 }, { x: f.x1, y: f.y1 }];
        corners.forEach(p => expect(pointInPolygon(p, c.outline)).toBe(false));
        // e non a filo del bordo tratteggiato
        const gap = Math.min(...c.outline.map(p => Math.hypot(Math.max(f.x0 - p.x, 0, p.x - f.x1), Math.max(f.y0 - p.y, 0, p.y - f.y1))));
        expect(gap).toBeGreaterThan(10);
    });

    it('una nota che copre una persona si sposta, una nota nel vuoto no', () => {
        const nodes = [N('a', 0, 0)];
        const note = (id: string, x: number, y: number) => ({ id, x, y, width: 120, height: 80, text: '', color: '#fde68a', fontFamily: 'sans-serif', opacity: 1, textColor: '#000' }) as StickyNoteData;
        const r = declutterLayout(nodes, [], [note('sopra', -20, -10), note('vuoto', 400, 400)]);
        const s = r.notes.get('sopra')!;
        expect(overlap({ x0: s.x, y0: s.y, x1: s.x + 120, y1: s.y + 80 }, fpAt(nodes[0], { x: 0, y: 0 }))).toBe(false);
        expect(r.notes.get('vuoto')).toEqual({ x: 400, y: 400 });
    });

    it('senza sovrapposizioni non sposta niente', () => {
        const nodes = [N('a', 0, 0), N('b', 200, 0)];
        const r = declutterLayout(nodes, [E('a', 'b', 'marriage')]);
        expect(r.moved).toBe(0);
    });

    it('dopo un layout completo, chi non ha legami segue la persona che aveva vicino', () => {
        const before = [N('a', 0, 0), N('b', 120, 0), N('amico', 400, 0, 'Amico')];
        // il layout ha spostato la coppia di +1000; l'amico non è stato toccato
        const after = [N('a', 1000, 0), N('b', 1120, 0), N('amico', 400, 0, 'Amico')];
        const r = declutterLayout(after, [E('a', 'b', 'marriage')], [], { satellites: 'all', previous: before });
        expect(r.positions.get('amico')!.x).toBeGreaterThan(1200);
    });
});
