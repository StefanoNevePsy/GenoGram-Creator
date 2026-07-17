import { describe, it, expect } from 'vitest';
import { parseDate, calculateAge, calculateAgeAtDeath, extractYear } from './dates';

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
