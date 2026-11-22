import { describe, it, expect } from 'vitest';
import {
    clamp100, livelloCoesione, livelloFlessibilita, tipoSistema, descriviCircumplex,
    puntoNelGrafico, valoriDaPunto, VALORI_INIZIALI,
} from './circumplex';

describe('modello circumplesso di Olson', () => {
    it('i confini dei livelli di coesione: 25 è separata, 50 connessa, 75 invischiata', () => {
        const idx = (v: number) => livelloCoesione(v).index;
        expect([0, 24, 25, 49, 50, 74, 75, 100].map(idx)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
        expect(livelloCoesione(24).key).toBe('disimpegnata');
        expect(livelloCoesione(75).label).toBe('Invischiata');
    });

    it('i confini dei livelli di flessibilità e gli estremi', () => {
        const idx = (v: number) => livelloFlessibilita(v).index;
        expect([0, 24, 25, 49, 50, 74, 75, 100].map(idx)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
        expect(livelloFlessibilita(10)).toMatchObject({ key: 'rigida', label: 'Rigida', estremo: true });
        expect(livelloFlessibilita(30)).toMatchObject({ key: 'strutturata', estremo: false });
        expect(livelloFlessibilita(60)).toMatchObject({ key: 'flessibile', estremo: false });
        expect(livelloFlessibilita(90)).toMatchObject({ key: 'caotica', estremo: true });
    });

    it('clamp100 arrotonda, limita e manda NaN al centro', () => {
        expect(clamp100(NaN)).toBe(50);
        expect(clamp100(-5)).toBe(0);
        expect(clamp100(140)).toBe(100);
        expect(clamp100(33.6)).toBe(34);
    });

    it('il tipo di sistema: centro bilanciato, un estremo medio, due estremi sbilanciato', () => {
        expect(tipoSistema({ cohesion: 50, flexibility: 30 })).toEqual({ key: 'bilanciato', label: 'Bilanciato' });
        expect(tipoSistema({ cohesion: 62, flexibility: 88 })).toEqual({ key: 'medio', label: 'Medio (mid-range)' });
        expect(tipoSistema({ cohesion: 10, flexibility: 50 }).key).toBe('medio');
        expect(tipoSistema({ cohesion: 90, flexibility: 5 })).toEqual({ key: 'sbilanciato', label: 'Sbilanciato' });
        expect(tipoSistema({ cohesion: 0, flexibility: 100 }).key).toBe('sbilanciato');
    });

    it('la descrizione testuale riporta livelli, valori e tipo', () => {
        expect(descriviCircumplex({ cohesion: 62, flexibility: 88 }))
            .toBe('Coesione connessa (62) · Flessibilità caotica (88) — sistema medio (mid-range)');
        expect(descriviCircumplex(VALORI_INIZIALI))
            .toBe('Coesione connessa (50) · Flessibilità flessibile (50) — sistema bilanciato');
        expect(descriviCircumplex({ cohesion: 5, flexibility: 95 })).toContain('sistema sbilanciato');
    });

    it('il punto nel grafico: coesione verso destra, flessibilità verso l\'alto', () => {
        expect(puntoNelGrafico({ cohesion: 0, flexibility: 0 }, 220, 28)).toEqual({ x: 28, y: 192 });
        expect(puntoNelGrafico({ cohesion: 100, flexibility: 100 }, 220, 28)).toEqual({ x: 192, y: 28 });
        expect(puntoNelGrafico(VALORI_INIZIALI, 220, 28)).toEqual({ x: 110, y: 110 });
    });

    it('valoriDaPunto è l\'inverso di puntoNelGrafico', () => {
        const casi = [
            { cohesion: 0, flexibility: 0 }, { cohesion: 100, flexibility: 100 }, { cohesion: 50, flexibility: 50 },
            { cohesion: 24, flexibility: 76 }, { cohesion: 62, flexibility: 88 }, { cohesion: 7, flexibility: 33 },
        ];
        for (const v of casi) {
            for (const [size, pad] of [[220, 28], [32, 2], [301, 17]]) {
                const p = puntoNelGrafico(v, size, pad);
                expect(valoriDaPunto(p.x, p.y, size, pad)).toEqual(v);
            }
        }
    });

    it('valoriDaPunto limita i punti fuori dall\'area utile', () => {
        expect(valoriDaPunto(-50, 999, 220, 28)).toEqual({ cohesion: 0, flexibility: 0 });
        expect(valoriDaPunto(999, -50, 220, 28)).toEqual({ cohesion: 100, flexibility: 100 });
    });
});
