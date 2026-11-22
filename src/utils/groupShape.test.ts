import { describe, it, expect } from 'vitest';
import { groupContour, pointAtFraction, pointInPolygon, type Rect } from './groupShape';

const R = (x: number, y: number, w = 40, h = 40): Rect => ({ x0: x, y0: y, x1: x + w, y1: y + h });
const PAD = 23;
const distToRect = (p: { x: number, y: number }, r: Rect) =>
    Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.y0 - p.y, 0, p.y - r.y1));

describe('contorno di un gruppo', () => {
    it('da solo, un membro è circondato a distanza ~padding, senza toccarlo', () => {
        const m = R(0, 0, 80, 60);
        const c = groupContour([m], [], PAD)!;
        const ds = c.outline.map(p => distToRect(p, m));
        expect(Math.min(...ds)).toBeGreaterThan(PAD * 0.7);
        // gli angoli sono arrotondati: lì il contorno si allontana un po' di più
        expect(Math.max(...ds)).toBeLessThan(PAD * 1.8);
    });

    it('una fila di fratelli dà un bordo dritto, non ondulato', () => {
        const row = [0, 80, 160, 240].map(x => R(x, 0, 70, 60));
        const c = groupContour(row, [], PAD)!;
        // punti del bordo inferiore nella parte centrale della fila
        const bottom = c.outline.filter(p => p.x > 40 && p.x < 270 && p.y > 30);
        const ys = bottom.map(p => p.y);
        expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(3);
    });

    it('una disposizione a L non ingloba chi sta nell\'angolo vuoto', () => {
        // nonna in alto a destra, madre sotto, nipote in basso a sinistra
        const members = [R(300, 0), R(300, 180), R(0, 360)];
        const intruso = R(0, 0);   // nell'angolo che l'inviluppo convesso coprirebbe
        const c = groupContour(members, [intruso], PAD)!;
        expect(pointInPolygon({ x: 20, y: 20 }, c.outline)).toBe(false);
        members.forEach(m => expect(pointInPolygon({ x: m.x0 + 20, y: m.y0 + 20 }, c.outline)).toBe(true));
    });

    it('membri lontani restano UN\'area sola, collegata da un collo', () => {
        const c = groupContour([R(0, 0), R(600, 400)], [], PAD)!;
        expect(pointInPolygon({ x: 20, y: 20 }, c.outline)).toBe(true);
        expect(pointInPolygon({ x: 620, y: 420 }, c.outline)).toBe(true);
        // il collo è stretto: a metà strada la forma non è larga quanto un membro
        const mid = c.outline.filter(p => Math.abs(p.x - 320) < 6);
        expect(mid.length).toBeGreaterThan(0);
    });

    it('chi sta sulla linea fra due membri viene aggirato, non inglobato', () => {
        const members = [R(0, 0), R(400, 0)];
        const inMezzo = R(200, 0);
        const c = groupContour(members, [inMezzo], PAD)!;
        expect(pointInPolygon({ x: 220, y: 20 }, c.outline)).toBe(false);
        // ma il gruppo è ancora unico: entrambi i membri dentro lo stesso anello
        expect(pointInPolygon({ x: 20, y: 20 }, c.outline)).toBe(true);
        expect(pointInPolygon({ x: 420, y: 20 }, c.outline)).toBe(true);
    });

    it('chi si sovrappone a un membro non spezza il gruppo', () => {
        const m = R(0, 0);
        const c = groupContour([m], [R(10, 10)], PAD)!;
        expect(pointInPolygon({ x: 20, y: 20 }, c.outline)).toBe(true);
    });

    it('il perimetro parte dall\'alto e si percorre per frazioni', () => {
        const c = groupContour([R(0, 0, 100, 40)], [], PAD)!;
        const p0 = pointAtFraction(c.outline, 0);
        const minY = Math.min(...c.outline.map(p => p.y));
        expect(p0.y).toBeCloseTo(minY, 0);
        const half = pointAtFraction(c.outline, 0.5);
        expect(half.y).toBeGreaterThan(40);   // a metà giro si è dall'altra parte
        expect(c.top.x).toBeGreaterThan(30); expect(c.top.x).toBeLessThan(70);   // etichetta centrata
    });
});
