import { describe, it, expect } from 'vitest';
import { parseDate, calculateAge, calculateAgeAtDeath, extractYear, ageToBirthYear } from './dates';

describe('parseDate', () => {
    it('formato italiano gg/mm/aaaa', () => {
        const d = parseDate('15/03/1980')!;
        expect(d.getFullYear()).toBe(1980);
        expect(d.getMonth()).toBe(2);
        expect(d.getDate()).toBe(15);
    });
    it('anno secco e separatori alternativi', () => {
        expect(parseDate('1975')!.getFullYear()).toBe(1975);
        expect(parseDate('01-02-1990')!.getFullYear()).toBe(1990);
        expect(parseDate('01.02.1990')!.getFullYear()).toBe(1990);
    });
    it('anno a due cifre: >30 → 1900, <=30 → 2000', () => {
        expect(parseDate('01/01/85')!.getFullYear()).toBe(1985);
        expect(parseDate('01/01/12')!.getFullYear()).toBe(2012);
    });
    it('input invalido → null', () => {
        expect(parseDate('')).toBeNull();
        expect(parseDate('abc')).toBeNull();
    });
});

describe('calculateAge / calculateAgeAtDeath', () => {
    it('età diretta a cifre passa invariata', () => {
        expect(calculateAge('42')).toBe('42');
    });
    it('input vuoto → ?', () => {
        expect(calculateAge('')).toBe('?');
    });
    it('età al decesso da intervallo date', () => {
        expect(calculateAgeAtDeath('15/03/1950', '10/01/2010')).toBe('59'); // compleanno non ancora raggiunto
        expect(calculateAgeAtDeath('15/03/1950', '20/03/2010')).toBe('60');
        expect(calculateAgeAtDeath('1950', '2010')).toBe('60');
    });
    it('date invalide o incoerenti → ?', () => {
        expect(calculateAgeAtDeath('', '2010')).toBe('?');
        expect(calculateAgeAtDeath('2010', '1950')).toBe('?');
    });
});

describe('extractYear', () => {
    it('estrae il primo anno a 4 cifre dal testo libero', () => {
        expect(extractYear('nato nel 1987 a Roma')).toBe(1987);
        expect(extractYear('')).toBe(0);
        expect(extractYear('nessun anno')).toBe(0);
    });
});

describe('ageToBirthYear: un\'età digitata diventa un anno', () => {
    const oggi = new Date(2026, 10, 9);   // 9 novembre 2026

    it('converte l\'età nuda nell\'anno di nascita', () => {
        expect(ageToBirthYear('45', undefined, oggi)).toBe('1981');
        expect(ageToBirthYear('0', undefined, oggi)).toBe('2026');
        expect(ageToBirthYear(' 7 ', undefined, oggi)).toBe('2019');
    });
    it('per un deceduto l\'età è quella al decesso, non a oggi', () => {
        expect(ageToBirthYear('80', '2010', oggi)).toBe('1930');
        expect(ageToBirthYear('80', '15/06/2010', oggi)).toBe('1930');
    });
    it('lascia stare tutto ciò che non è un\'età nuda', () => {
        expect(ageToBirthYear('1981', undefined, oggi)).toBe('1981');
        expect(ageToBirthYear('12/05/1981', undefined, oggi)).toBe('12/05/1981');
        expect(ageToBirthYear('', undefined, oggi)).toBe('');
        expect(ageToBirthYear('primavera', undefined, oggi)).toBe('primavera');
        expect(ageToBirthYear('200', undefined, oggi)).toBe('200');   // oltre i 150 anni
    });
    it('l\'anno convertito regge il passare del tempo, l\'età scritta no', () => {
        const anno = ageToBirthYear('45', undefined, oggi);
        // due anni dopo la stessa persona ne ha 47, e l'anno salvato lo dice
        expect(2028 - Number(anno)).toBe(47);
    });
});

describe('extractYear con un\'età al posto della data', () => {
    const oggi = new Date(2026, 10, 9);
    it('ricava l\'anno, così l\'ordinamento per età non li manda in fondo', () => {
        expect(extractYear('45', oggi)).toBe(1981);
        expect(extractYear('150', oggi)).toBe(1876);
        expect(extractYear('200', oggi)).toBe(0);
    });
});
