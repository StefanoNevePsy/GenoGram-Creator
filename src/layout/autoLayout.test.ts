import { describe, it, expect } from 'vitest';
import { computeGenogramLayout } from './autoLayout';
import type { GenNode, RelationEdge } from '../types';

const N = (id: string, gender: string, birthDate = ''): GenNode => ({
    id, gender, birthDate, x: 0, y: 0, name: id, deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false,
    gayLesbian: false, notes: []
} as any);
const E = (fromId: string, toId: string, type: string): RelationEdge =>
    ({ id: `${fromId}_${toId}_${type}`, fromId, toId, type, label: '', notes: [] } as any);

describe('layout C&M: famiglia a 3 generazioni con entrambe le linee di nonni', () => {
    const nodes = [
        N('nonnoP', 'M', '1940'), N('nonnaP', 'F', '1942'),
        N('nonnoM', 'M', '1945'), N('nonnaM', 'F', '1947'),
        N('padre', 'M', '1970'), N('zia', 'F', '1975'), N('madre', 'F', '1972'),
        N('fratello', 'M', '2008'), N('ip', 'F', '2010'), N('gemA', 'M', '2012'), N('gemB', 'M', '2012'),
    ];
    const edges = [
        E('nonnoP', 'nonnaP', 'marriage'), E('nonnoM', 'nonnaM', 'marriage'), E('padre', 'madre', 'marriage'),
        E('nonnoP', 'padre', 'child-bio'), E('nonnaP', 'padre', 'child-bio'),
        E('nonnoP', 'zia', 'child-bio'), E('nonnaP', 'zia', 'child-bio'),
        E('nonnoM', 'madre', 'child-bio'), E('nonnaM', 'madre', 'child-bio'),
        E('padre', 'fratello', 'child-bio'), E('madre', 'fratello', 'child-bio'),
        E('padre', 'ip', 'child-bio'), E('madre', 'ip', 'child-bio'),
        E('padre', 'gemA', 'child-bio'), E('madre', 'gemA', 'child-bio'),
        E('padre', 'gemB', 'child-bio'), E('madre', 'gemB', 'child-bio'),
        E('gemA', 'gemB', 'twin-monozygotic'),
    ];
    const { positions: P, warnings } = computeGenogramLayout(nodes, edges, { snap: 0 });
    const p = (id: string) => P.get(id)!;

    it('posiziona tutti i nodi senza warning', () => {
        expect(P.size).toBe(11);
        expect(warnings).toEqual([]);
    });
    it('righe generazionali rigide', () => {
        expect(p('nonnoP').y).toBe(p('nonnaP').y);
        expect(p('nonnoP').y).toBe(p('nonnoM').y);
        expect(p('padre').y).toBe(p('madre').y);
        expect(p('padre').y).toBeGreaterThan(p('nonnoP').y);
        expect(p('ip').y).toBeGreaterThan(p('padre').y);
    });
    it('uomo a sinistra nella coppia', () => {
        expect(p('nonnoP').x).toBeLessThan(p('nonnaP').x);
        expect(p('padre').x).toBeLessThan(p('madre').x);
    });
    it('fratelli per età, primogenito a sinistra, gemelli adiacenti', () => {
        expect(p('fratello').x).toBeLessThan(p('ip').x);
        expect(p('ip').x).toBeLessThan(p('gemA').x);
        expect(Math.abs(p('gemA').x - p('gemB').x)).toBeLessThanOrEqual(200);
    });
    it('genitori centrati sullo span dei figli', () => {
        const midG = (p('padre').x + p('madre').x) / 2;
        const kidsMid = (p('fratello').x + p('gemB').x) / 2;
        expect(Math.abs(midG - kidsMid)).toBeLessThan(60);
        const midNP = (p('nonnoP').x + p('nonnaP').x) / 2;
        const kidsP = (p('padre').x + p('zia').x) / 2;
        expect(Math.abs(midNP - kidsP)).toBeLessThan(60);
    });
    it('famiglia materna a destra dei nonni paterni, il più vicino possibile alla madre', () => {
        expect(p('nonnoM').x).toBeGreaterThan(p('nonnaP').x);
        // vincolo di non-collisione: delta minimo geometricamente possibile, non zero
        const midM = (p('nonnoM').x + p('nonnaM').x) / 2;
        expect(Math.abs(midM - p('madre').x)).toBeLessThan(300);
    });
    it('nessuna sovrapposizione per riga', () => {
        const rows = new Map<number, number[]>();
        P.forEach(v => { const r = rows.get(v.y) || []; r.push(v.x); rows.set(v.y, r); });
        rows.forEach(xs => {
            xs.sort((a, b) => a - b);
            for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(40);
        });
    });
});

describe('layout C&M: divorzio + risposato con figli di due letti', () => {
    const nodes = [
        N('ex', 'F', '1968'), N('marito', 'M', '1965'), N('moglie2', 'F', '1975'),
        N('f1', 'F', '1995'), N('f2', 'M', '2005'), N('f3', 'F', '2008'), N('single', 'M', '1990'),
    ];
    const edges = [
        E('marito', 'ex', 'divorce'), E('marito', 'moglie2', 'marriage'),
        E('marito', 'f1', 'child-bio'), E('ex', 'f1', 'child-bio'),
        E('marito', 'f2', 'child-bio'), E('moglie2', 'f2', 'child-bio'),
        E('marito', 'f3', 'child-bio'), E('moglie2', 'f3', 'child-bio'),
    ];
    const { positions: P, warnings } = computeGenogramLayout(nodes, edges, { snap: 0 });
    const p = (id: string) => P.get(id)!;

    it('esclude i nodi isolati e non genera warning', () => {
        expect(P.size).toBe(6);
        expect(P.has('single')).toBe(false);
        expect(warnings).toEqual([]);
    });
    it('catena coniugale cronologica: ex < marito < moglie2', () => {
        expect(p('ex').x).toBeLessThan(p('marito').x);
        expect(p('marito').x).toBeLessThan(p('moglie2').x);
    });
    it('figli del primo letto a sinistra di quelli del secondo', () => {
        expect(p('f1').x).toBeLessThan(p('f2').x);
        expect(p('f2').x).toBeLessThan(p('f3').x);
    });
    it('ogni figlio gravita sotto la propria unione', () => {
        const mid1 = (p('ex').x + p('marito').x) / 2;
        const mid2 = (p('marito').x + p('moglie2').x) / 2;
        expect(Math.abs(p('f1').x - mid1)).toBeLessThan(Math.abs(p('f1').x - mid2));
    });
});

describe('layout C&M: robustezza input degeneri', () => {
    it('grafo vuoto → nessuna posizione', () => {
        const { positions } = computeGenogramLayout([], [], { snap: 0 });
        expect(positions.size).toBe(0);
    });
    it('ciclo genitore-figlio → warning, niente NaN', () => {
        const nodes = [N('a', 'M'), N('b', 'F')];
        const edges = [E('a', 'b', 'child-bio'), E('b', 'a', 'child-bio')];
        const { positions, warnings } = computeGenogramLayout(nodes, edges, { snap: 0 });
        expect(warnings.length).toBeGreaterThan(0);
        positions.forEach(v => { expect(Number.isFinite(v.x)).toBe(true); expect(Number.isFinite(v.y)).toBe(true); });
    });
    it('coniugi di generazioni incompatibili → warning, layout comunque prodotto', () => {
        // c è figlio di a, ma sposa a stesso: generazioni inconciliabili
        const nodes = [N('a', 'M', '1950'), N('m', 'F', '1952'), N('c', 'F', '1980')];
        const edges = [E('a', 'c', 'child-bio'), E('m', 'c', 'child-bio'), E('a', 'c', 'marriage')];
        const { positions, warnings } = computeGenogramLayout(nodes, edges, { snap: 0 });
        expect(positions.size).toBe(3);
        expect(warnings.length).toBeGreaterThan(0);
        positions.forEach(v => expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true));
    });
});

describe('layout C&M v2: birthOrder e startDate', () => {
    it('birthOrder esplicito ordina i fratelli senza data', () => {
        const nodes = [
            N('p', 'M', '1960'), N('m', 'F', '1962'),
            { ...N('a', 'F'), birthOrder: 2 }, { ...N('b', 'M'), birthOrder: 1 }, { ...N('c', 'F'), birthOrder: 3 },
        ];
        const edges = [
            E('p', 'm', 'marriage'),
            E('p', 'a', 'child-bio'), E('m', 'a', 'child-bio'),
            E('p', 'b', 'child-bio'), E('m', 'b', 'child-bio'),
            E('p', 'c', 'child-bio'), E('m', 'c', 'child-bio'),
        ];
        const { positions: P } = computeGenogramLayout(nodes, edges, { snap: 0 });
        expect(P.get('b')!.x).toBeLessThan(P.get('a')!.x);
        expect(P.get('a')!.x).toBeLessThan(P.get('c')!.x);
    });
    it('startDate ordina cronologicamente i matrimoni multipli (vince sull\'ordine di creazione)', () => {
        const nodes = [N('marito', 'M', '1960'), N('recente', 'F', '1970'), N('prima', 'F', '1962')];
        // Edge "recente" creato PRIMA ma con startDate successiva: deve finire a destra
        const edges = [
            { ...E('marito', 'recente', 'marriage'), startDate: '2010' },
            { ...E('marito', 'prima', 'divorce'), startDate: '1985' },
        ];
        const { positions: P } = computeGenogramLayout(nodes, edges, { snap: 0 });
        expect(P.get('prima')!.x).toBeLessThan(P.get('marito')!.x);
        expect(P.get('marito')!.x).toBeLessThan(P.get('recente')!.x);
    });
});
