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
export const extractYear = (text: string): number => {
    if (!text) return 0;
    const match = text.match(/\d{4}/);
    if (match) return parseInt(match[0]);
    return 0;
};
