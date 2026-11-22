import { describe, it, expect } from 'vitest';
import { pointAlong, endAngles, offsetPolyline, zigzagAlong, trimEnd, roundedPath, nearestSegment, polylineLength } from './edgeRoute';
import { getZigZagPath } from './geometry';

const distToSegment = (p: { x: number, y: number }, a: { x: number, y: number }, b: { x: number, y: number }) => {
    const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
};

describe('percorso di una relazione', () => {
    it('senza punti intermedi lo zigzag è identico al vecchio: le relazioni esistenti non cambiano', () => {
        const nums = (d: string) => (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number);
        const nuovo = nums(zigzagAlong([{ x: 10, y: 20 }, { x: 250, y: 140 }], 4, 12));
        const vecchio = nums(getZigZagPath(10, 20, 250, 140, 4, 12));
        expect(nuovo.length).toBe(vecchio.length);
        nuovo.forEach((v, i) => expect(v).toBeCloseTo(vecchio[i], 6));
    });

    it('il punto medio sta a metà della LUNGHEZZA, con l\'angolo del tratto in cui cade', () => {
        // L: 100 in orizzontale, poi 300 in verticale → metà (200) è a 100 lungo il tratto verticale
        const m = pointAlong([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }], 0.5);
        expect(m.x).toBeCloseTo(100); expect(m.y).toBeCloseTo(100); expect(m.angle).toBeCloseTo(90);
    });

    it('la freccia d\'arrivo prende la direzione dell\'ultimo tratto, non della retta fra gli estremi', () => {
        const a = endAngles([{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 300, y: 200 }]);
        expect(a.start).toBeCloseTo(90); expect(a.end).toBeCloseTo(0);
    });

    it('la copia parallela resta a distanza costante, anche in diagonale', () => {
        // prima le linee doppie erano copie spostate di (3,3): su questa diagonale
        // cadevano esattamente sopra l'originale
        const line = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
        const off = offsetPolyline(line, 3);
        off.forEach(p => expect(distToSegment(p, line[0], line[1])).toBeCloseTo(3, 5));
        // e sugli angoli di un percorso spezzato
        const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
        const o = offsetPolyline(path, 5);
        expect(distToSegment(o[1], path[0], path[1])).toBeCloseTo(5, 5);
        expect(distToSegment(o[1], path[1], path[2])).toBeCloseTo(5, 5);
    });

    it('accorcia l\'ultimo tratto per lasciare posto alla punta', () => {
        const t = trimEnd([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }], 20);
        expect(t[2]).toEqual({ x: 80, y: 100 });
        expect(polylineLength(t)).toBeCloseTo(180);
    });

    it('gli angoli dei punti intermedi sono raccordati, gli estremi no', () => {
        const d = roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 14);
        expect(d.startsWith('M 0 0')).toBe(true);
        expect(d).toContain('Q 100 0');
        expect(d.endsWith('L 100 100')).toBe(true);
        expect(roundedPath([{ x: 0, y: 0 }, { x: 50, y: 50 }])).toBe('M 0 0 L 50 50');
    });

    it('trova il tratto più vicino a un punto', () => {
        const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
        expect(nearestSegment(pts, { x: 50, y: 5 })).toBe(0);
        expect(nearestSegment(pts, { x: 95, y: 60 })).toBe(1);
    });
});
