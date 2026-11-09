export const parseDate = (str: string): Date | null => {
    if (!str) return null;
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
        const d = parseInt(parts[0]); const m = parseInt(parts[1]) - 1; const y = parseInt(parts[2]);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) { const fullYear = y < 100 ? (y > 30 ? 1900 + y : 2000 + y) : y; return new Date(fullYear, m, d); }
    }
    if (/^\d{4}$/.test(str)) return new Date(parseInt(str), 0, 1);

    // Supporto per input "Età" (es. 35, 45, 12)
    if (/^\d{1,3}$/.test(str)) {
        const val = parseInt(str);
        if (val <= 150) {
            return new Date(new Date().getFullYear() - val, 0, 1);
        }
    }
    return null;
}
export const calculateAge = (birthDateStr: string): string => {
    if (!birthDateStr) return '?';

    // Se è stata inserita direttamente un'età a due cifre o tre cifre
    const str = birthDateStr.trim();
    if (/^\d{1,3}$/.test(str)) {
        const val = parseInt(str);
        if (val <= 150) return str;
    }

    const birth = parseDate(birthDateStr);
    if (!birth) return '?';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age.toString();
};
// Età al decesso (per persone decedute con data di morte)
export const calculateAgeAtDeath = (birthDateStr: string, deathDateStr: string): string => {
    const birth = parseDate(birthDateStr); const death = parseDate(deathDateStr);
    if (!birth || !death) return '?';
    let age = death.getFullYear() - birth.getFullYear();
    const m = death.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && death.getDate() < birth.getDate())) age--;
    return age >= 0 ? age.toString() : '?';
};

// Parser per estrarre l'anno da testo libero
export const extractYear = (text: string, today = new Date()): number => {
    if (!text) return 0;
    const match = text.match(/\d{4}/);
    if (match) return parseInt(match[0]);
    // Un valore di una-tre cifre è un'età digitata al posto della data (stessa
    // convenzione di parseDate e calculateAge): senza questo, chi è stato
    // inserito per età finisce in fondo a ogni ordinamento, come nato nell'anno 0.
    const bare = text.trim();
    if (/^\d{1,3}$/.test(bare)) {
        const age = parseInt(bare, 10);
        if (age <= 150) return today.getFullYear() - age;
    }
    return 0;
};

/** L'anno di morte da mostrare accanto alla croce: da "2010", "3/5/2010", "3-5-10". */
export const annoMorte = (str?: string): string => {
    if (!str) return '';
    const quattro = str.match(/(\d{4})(?!.*\d{4})/);
    if (quattro) return quattro[1];
    if (str.split(/[\/\-\.]/).length === 3) { const d = parseDate(str); if (d && !isNaN(d.getTime())) return String(d.getFullYear()); }
    return '';
};

/**
 * Converte un'età digitata al posto della data nell'anno di nascita.
 *
 * Un'età scritta così resta congelata: "45" continua a dire 45 anche fra dieci
 * anni, perché è salvata alla lettera. Convertendola quando si conferma il
 * campo, da lì in poi si aggiorna da sé. Per una persona deceduta l'età è
 * quella al decesso, quindi il conto parte dall'anno di morte e non da oggi.
 *
 * Tutto ciò che non è un'età nuda (una data, un anno, testo libero) torna
 * indietro immutato.
 */
export const ageToBirthYear = (value: string, deathDate?: string, today = new Date()): string => {
    const s = (value || '').trim();
    if (!/^\d{1,3}$/.test(s)) return value;
    const age = parseInt(s, 10);
    if (age > 150) return value;
    const ref = Number(annoMorte(deathDate)) || today.getFullYear();
    const year = ref - age;
    return year > 1700 && year <= today.getFullYear() ? String(year) : value;
};
