import { describe, it, expect } from 'vitest';
import { segmentsOf } from './minuchin';
import type { StructuralMap } from '../types';

const baseMap = (over: Partial<StructuralMap>): StructuralMap => ({
    id: 'm', label: 'x', style: 'minimal', memberIds: [], positions: {},
    boundaries: {}, vBoundaries: [], hBoundaries: [], relations: [], notes: [], ...over,
} as StructuralMap);
const W = 560, H = 400;

describe('segmentazione confini Minuchin', () => {
    it('senza confini perpendicolari un orizzontale è un unico segmento a tutta larghezza', () => {
        const m = baseMap({ hBoundaries: [{ id: 'h', y: 200, style: 'clear' }] });
        const segs = segmentsOf(m, 'hb', m.hBoundaries![0], W, H);
        expect(segs.length).toBe(1);
        expect(segs[0].a).toBe(10); expect(segs[0].b).toBe(W - 10);
    });
    it('una verticale spezza l orizzontale in 2 segmenti all intersezione', () => {
        const m = baseMap({
            hBoundaries: [{ id: 'h', y: 200, style: 'clear' }],
            vBoundaries: [{ id: 'v', x: 280, style: 'clear' }],
        });
        const segs = segmentsOf(m, 'hb', m.hBoundaries![0], W, H);
        expect(segs.map(s => [s.a, s.b])).toEqual([[10, 280], [280, W - 10]]);
    });
    it('segStyles applica stili indipendenti per segmento (rigido sx, diffuso dx)', () => {
        const m = baseMap({
            hBoundaries: [{ id: 'h', y: 200, style: 'diffuse', segStyles: { 0: 'rigid' } }],
            vBoundaries: [{ id: 'v', x: 280, style: 'clear' }],
        });
        const segs = segmentsOf(m, 'hb', m.hBoundaries![0], W, H);
        expect(segs[0].style).toBe('rigid');   // override
        expect(segs[1].style).toBe('diffuse'); // base
    });
    it('due verticali producono 3 segmenti ordinati sx→dx', () => {
        const m = baseMap({
            hBoundaries: [{ id: 'h', y: 200, style: 'clear' }],
            vBoundaries: [{ id: 'v2', x: 400, style: 'clear' }, { id: 'v1', x: 180, style: 'clear' }],
        });
        const segs = segmentsOf(m, 'hb', m.hBoundaries![0], W, H);
        expect(segs.map(s => [s.a, s.b])).toEqual([[10, 180], [180, 400], [400, W - 10]]);
    });
    it('una verticale è a sua volta spezzata dall orizzontale (alto/basso)', () => {
        const m = baseMap({
            hBoundaries: [{ id: 'h', y: 200, style: 'clear' }],
            vBoundaries: [{ id: 'v', x: 280, style: 'clear' }],
        });
        const segs = segmentsOf(m, 'vb', m.vBoundaries![0], W, H);
        expect(segs.map(s => [s.a, s.b])).toEqual([[8, 200], [200, H - 8]]);
    });
});
