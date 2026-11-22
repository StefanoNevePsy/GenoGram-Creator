// --- MODELLO CIRCUMPLESSO DI OLSON ---
//
// Il modello descrive un sistema familiare o di coppia con due dimensioni:
//   - COESIONE (legame emotivo): disimpegnata, separata, connessa, invischiata;
//   - FLESSIBILITÀ (capacità di cambiare ruoli e regole): rigida, strutturata,
//     flessibile, caotica.
// Ogni dimensione ha 4 livelli, quindi una griglia 4×4. I due livelli centrali
// di entrambe le dimensioni formano la zona BILANCIATA (la più funzionale),
// gli angoli sono i sistemi SBILANCIATI (entrambe le dimensioni agli estremi),
// il resto è MEDIO (mid-range: un solo estremo).
//
// La scala 0–100 è una valutazione clinica (per esempio dai punteggi FACES o
// dal giudizio del terapeuta), NON una conversione validata di un punteggio:
// serve a collocare il sistema nel grafico e a derivarne il livello, niente di più.
//
// Funzioni pure, testabili.

export interface CircumplexValues { cohesion: number; flexibility: number }   // 0..100 ciascuno
export interface Livello { index: 0 | 1 | 2 | 3; key: string; label: string; estremo: boolean }
export type TipoSistema = 'bilanciato' | 'medio' | 'sbilanciato';

export const VALORI_INIZIALI: CircumplexValues = { cohesion: 50, flexibility: 50 };

/** Intero 0..100; un valore non numerico torna al centro, non a 0 che sarebbe un estremo clinico. */
export const clamp100 = (v: number): number => {
    if (typeof v !== 'number' || Number.isNaN(v)) return 50;
    return Math.max(0, Math.min(100, Math.round(v)));
};

const NOMI_COESIONE = ['disimpegnata', 'separata', 'connessa', 'invischiata'];
const NOMI_FLESSIBILITA = ['rigida', 'strutturata', 'flessibile', 'caotica'];

const livello = (v: number, nomi: string[]): Livello => {
    // Soglie a 25/50/75: il limite appartiene al livello superiore (25 → 1, 50 → 2, 75 → 3).
    const c = clamp100(v);
    const index = (c >= 75 ? 3 : c >= 50 ? 2 : c >= 25 ? 1 : 0) as 0 | 1 | 2 | 3;
    const key = nomi[index];
    return { index, key, label: key.charAt(0).toUpperCase() + key.slice(1), estremo: index === 0 || index === 3 };
};

export const livelloCoesione = (v: number): Livello => livello(v, NOMI_COESIONE);
export const livelloFlessibilita = (v: number): Livello => livello(v, NOMI_FLESSIBILITA);

export const tipoSistema = (v: CircumplexValues): { key: TipoSistema, label: string } => {
    const estremi = Number(livelloCoesione(v.cohesion).estremo) + Number(livelloFlessibilita(v.flexibility).estremo);
    if (estremi === 0) return { key: 'bilanciato', label: 'Bilanciato' };
    if (estremi === 1) return { key: 'medio', label: 'Medio (mid-range)' };
    return { key: 'sbilanciato', label: 'Sbilanciato' };
};

export const descriviCircumplex = (v: CircumplexValues): string =>
    `Coesione ${livelloCoesione(v.cohesion).key} (${clamp100(v.cohesion)}) · ` +
    `Flessibilità ${livelloFlessibilita(v.flexibility).key} (${clamp100(v.flexibility)}) — ` +
    `sistema ${tipoSistema(v).key === 'medio' ? 'medio (mid-range)' : tipoSistema(v).key}`;

// --- GEOMETRIA DEL GRAFICO ---
// Quadrato di lato `size`, area utile rientrata di `pad` su ogni lato.
// Coesione cresce da sinistra a destra; flessibilità dal basso verso l'alto
// (l'asse y dell'SVG va verso il basso, quindi si inverte).

export const puntoNelGrafico = (v: CircumplexValues, size: number, pad: number): { x: number, y: number } => {
    const inner = size - 2 * pad;
    return {
        x: pad + (clamp100(v.cohesion) / 100) * inner,
        y: pad + (1 - clamp100(v.flexibility) / 100) * inner,
    };
};

/** Inverso esatto di puntoNelGrafico, per trascinare il punto col puntatore. */
export const valoriDaPunto = (x: number, y: number, size: number, pad: number): CircumplexValues => {
    const inner = size - 2 * pad;
    return {
        cohesion: clamp100(((x - pad) / inner) * 100),
        flexibility: clamp100((1 - (y - pad) / inner) * 100),
    };
};
