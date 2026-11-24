import { describe, it, expect } from 'vitest';
import { pseudonimi, anonimizzaSvg, testoLiberoVisibile } from './anonimizza';

const P = (...nomi: string[]) => nomi.map((name, i) => ({ id: 'p' + i, name }));
const lista = (...nomi: string[]) => { const m = pseudonimi(P(...nomi)); return nomi.map((_, i) => m.get('p' + i)); };

describe('pseudonimi', () => {
    it('nomi singoli: iniziale e punto sulla prima parola', () => {
        expect(lista('Maria Bianchi', 'Luca', '  giulia   verdi ')).toEqual(['M.', 'L.', 'G.']);
    });
    it('conflitti: si allunga solo per chi collide', () => {
        expect(lista('Maria', 'Marco', 'Matteo', 'Luca')).toEqual(['Mari.', 'Marc.', 'Mat.', 'L.']);
    });
    it('Maria e Mario servono cinque lettere', () => {
        expect(lista('Maria', 'Mario')).toEqual(['Maria.', 'Mario.']);
    });
    it('accenti e maiuscole non contano nel confronto, ma restano nell\'output', () => {
        expect(lista('Élise', 'Elena')).toEqual(['Éli.', 'Ele.']);
        expect(lista('ANNA', 'anna rossi')).not.toContain('A.');
    });
    it('prima parola identica: parola intera + iniziale del cognome', () => {
        expect(lista('Marco Rossi', 'Marco Verdi')).toEqual(['Marco R.', 'Marco V.']);
    });
    it('nomi del tutto identici: numero progressivo', () => {
        expect(lista('Marco Rossi', 'Marco Rossi')).toEqual(['M.1', 'M.2']);
        expect(lista('Marco', 'Marco')).toEqual(['M.1', 'M.2']);
    });
    it('senza seconda parola in un gruppo identico: numerato', () => {
        expect(lista('Marco Rossi', 'Marco')).toEqual(['Marco R.', 'M.1']);
    });
    it('vuoti restano vuoti, non-lettere restano come sono', () => {
        expect(lista('', '   ', '?', '3 figli')).toEqual(['', '', '?.', '3.']);
    });
    it('deterministico', () => {
        const n = ['Mara', 'Marta', 'Mario', 'Marco Rossi', 'Marco Rossi'];
        expect(lista(...n)).toEqual(lista(...n));
        expect(new Set(lista(...n)).size).toBe(n.length);
    });
});

describe('anonimizzaSvg', () => {
    // Niente DOM negli unit test (ambiente node): bastano finti elementi con
    // la sola superficie che la funzione usa. Il disegno vero lo copre l'e2e.
    const el = (tagName: string, attrs: Record<string, string> = {}, text = '') => {
        const o: any = { tagName, attrs: { ...attrs }, textContent: text, previousElementSibling: null,
            getAttribute: (k: string) => (k in o.attrs ? o.attrs[k] : null),
            setAttribute: (k: string, v: string) => { o.attrs[k] = v; } };
        return o;
    };
    const build = () => {
        const rect = el('rect', { x: '30', width: '40' });
        const testo = el('text', { 'data-nome': 'a' }, 'Maria Rossi');
        testo.previousElementSibling = rect;
        const titolo = el('title', {}, 'Maria Rossi');
        const svg: any = { querySelectorAll: (q: string) => q === '[data-nome]' ? [testo] : q === 'title' ? [titolo] : [] };
        return { svg: svg as SVGSVGElement, rect, testo, titolo };
    };
    it('sostituisce il testo e restringe il riquadro restando centrato', () => {
        const { svg, rect, testo, titolo } = build();
        anonimizzaSvg(svg, new Map([['a', 'Mari.']]), new Map([['a', 'Maria Rossi']]));
        expect(testo.textContent).toBe('Mari.');
        const w = parseFloat(rect.attrs.width);
        expect(w).toBeCloseTo(40 * 5 / 11);
        expect(parseFloat(rect.attrs.x) + w / 2).toBeCloseTo(50);
        expect(titolo.textContent).toBe('Mari.');
    });
    it('larghezza minima 16', () => {
        const { svg, rect } = build();
        anonimizzaSvg(svg, new Map([['a', 'M.']]));
        expect(parseFloat(rect.attrs.width)).toBe(16);
    });
});

describe('testoLiberoVisibile', () => {
    it('conta solo il non vuoto', () => {
        expect(testoLiberoVisibile({
            nodes: [{ label: 'x' }, { profession: ' ' }], edges: [{ label: '' }],
            groups: [{ label: 'a' }, { label: 'b' }], stickyNotes: [{ text: 'n' }],
        })).toEqual(['2 etichette di gruppo', '1 nota', '1 etichetta/professione']);
    });
});
