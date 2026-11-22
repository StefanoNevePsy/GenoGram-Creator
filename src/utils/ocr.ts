// --- LETTURA DELLE SCRITTE DI UN GENOGRAMMA ---
//
// Non si dà in pasto l'intera immagine al riconoscimento: si sa già dove
// guardare. L'analisi ha attribuito ogni etichetta alla sua persona, e la
// convenzione dei genogrammi dice cosa aspettarsi in ciascuna posizione —
// anno di nascita sopra il simbolo, nome sotto, età dentro. Leggere ritagli
// piccoli di contenuto noto, con l'alfabeto giusto per ciascuno, è molto più
// affidabile che leggere una pagina intera e poi indovinare chi è cosa.
//
// Il motore (tesseract.js) è caricato solo quando serve, e da file locali:
// un genogramma si importa anche in studio, senza rete.

import type { DetectedPerson, DetectedText } from './imageImport';

export interface PersonLabels { name?: string; birthYear?: string; age?: string }

const BASE = `${import.meta.env.BASE_URL || '/'}tesseract/`.replace(/\/{2,}/g, '/');

// Il riconoscimento vuole caratteri alti ~30px: le etichette di un genogramma
// stanno sui 12-15, e ingrandire prima di leggere cambia tutto.
const CROP_SCALE = 4;

const crop = (src: CanvasImageSource, x0: number, y0: number, x1: number, y1: number, padX: number, padY: number) => {
    const w = Math.max(1, x1 - x0 + 1 + padX * 2), h = Math.max(1, y1 - y0 + 1 + padY * 2);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * CROP_SCALE); cv.height = Math.round(h * CROP_SCALE);
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, x0 - padX, y0 - padY, w, h, 0, 0, cv.width, cv.height);
    return cv;
};

const cleanName = (s: string) => s
    .replace(/[^A-Za-zÀ-ÿ'\- ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());

/**
 * Legge nomi, anni di nascita ed età dall'immagine di partenza.
 * Restituisce un'etichetta per persona, nello stesso ordine di `people`.
 * I campi mancanti o letti male restano vuoti: meglio un campo vuoto che un
 * nome inventato, perché in cartella clinica il secondo non si distingue da
 * un dato vero.
 */
export const readPersonLabels = async (
    source: CanvasImageSource,
    people: DetectedPerson[],
    texts: DetectedText[],
    onProgress?: (done: number, total: number) => void,
): Promise<PersonLabels[]> => {
    const out: PersonLabels[] = people.map(() => ({}));
    if (people.length === 0) return out;

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('ita', 1, {
        workerPath: `${BASE}worker.min.js`,
        corePath: `${BASE}tesseract-core-lstm.wasm.js`,
        langPath: BASE,
        gzip: true,
        legacyCore: false,
        legacyLang: false,
    });

    // Due passate, una per alfabeto: cambiare la lista dei caratteri ammessi a
    // ogni ritaglio costa più del riconoscimento stesso.
    interface Job { cv: HTMLCanvasElement; person: number; field: keyof PersonLabels }
    const digits: Job[] = [];
    const words: Job[] = [];
    const fallback: Job[] = [];

    people.forEach((p, i) => {
        // l'età sta dentro al simbolo: il riquadro la delimita già, con un
        // margine che tiene fuori il contorno
        const inset = Math.round(Math.min(p.w, p.h) * 0.18);
        digits.push({
            cv: crop(source,
                Math.round(p.cx - p.w / 2) + inset, Math.round(p.cy - p.h / 2) + inset,
                Math.round(p.cx + p.w / 2) - inset, Math.round(p.cy + p.h / 2) - inset, 0, 0),
            person: i, field: 'age',
        });
    });

    // Il riquadro trovato contiene le lettere RICONOSCIUTE come tali: la prima
    // o l'ultima possono esserne rimaste fuori (una 'l' sottile, una lettera
    // attaccata a una linea). Si allarga il ritaglio fin dove si può senza
    // invadere l'etichetta accanto: meglio dare al riconoscimento un po' di
    // bianco in più che mezzo nome.
    texts.forEach(t => {
        const h = t.y1 - t.y0 + 1;
        let room = h * 2.5;
        texts.forEach(o => {
            if (o === t || Math.abs((o.y0 + o.y1) / 2 - (t.y0 + t.y1) / 2) > h) return;
            if (o.x1 < t.x0) room = Math.min(room, (t.x0 - o.x1) / 2);
            else if (o.x0 > t.x1) room = Math.min(room, (o.x0 - t.x1) / 2);
        });
        const cv = crop(source, t.x0, t.y0, t.x1, t.y1, Math.max(2, Math.round(room)), Math.max(2, Math.round(h * 0.35)));
        if (t.slot === 'above') digits.push({ cv, person: t.person, field: 'birthYear' });
        else words.push({ cv, person: t.person, field: 'name' });
    });

    // Dove l'analisi non ha isolato nessuna etichetta si guarda comunque, nelle
    // due fasce in cui la convenzione dice di scrivere. Succede spesso: se la
    // linea che scende dal simbolo passa dentro al nome, lettere e linea
    // diventano una cosa sola e il nome non si distingue più come scritta —
    // ma resta perfettamente leggibile.
    const sides = people.map(p => (p.w + p.h) / 2).sort((a, b) => a - b);
    const med = sides[sides.length >> 1] || 24;
    people.forEach((p, i) => {
        let half = med * 1.4;
        people.forEach((q, j) => {
            if (j === i || Math.abs(q.cy - p.cy) > med) return;
            half = Math.min(half, Math.abs(q.cx - p.cx) / 2 - 2);
        });
        if (half < med * 0.5) return;        // vicini troppo stretti: si rischia il nome del compagno
        const x0 = Math.round(p.cx - half), x1 = Math.round(p.cx + half);
        const band = Math.round(med * 0.75);
        const y0 = Math.round(p.cy + p.h / 2) + 2;
        fallback.push({ cv: crop(source, x0, y0, x1, y0 + band, 0, 0), person: i, field: 'name' });
        const y1 = Math.round(p.cy - p.h / 2) - 2;
        fallback.push({ cv: crop(source, x0, y1 - band, x1, y1, 0, 0), person: i, field: 'birthYear' });
    });

    // Le fasce di ripiego si leggono solo dove il riquadro isolato non ha
    // dato niente di buono: su un genogramma pulito è quasi sempre, e
    // risparmia metà del tempo senza togliere niente al risultato.
    const needsFallback = (j: Job) => j.field === 'name'
        ? (out[j.person].name?.length ?? 0) < 4
        : !out[j.person].birthYear;

    const total = digits.length + words.length + fallback.length;
    let done = 0;
    try {
        // Niente liste di caratteri ammessi: col motore LSTM peggiorano il
        // risultato invece di vincolarlo (è addestrato su parole intere, non
        // carattere per carattere). Si filtra dopo, sul testo letto.
        await worker.setParameters({ tessedit_pageseg_mode: '7' as never });   // una riga sola
        for (const pass of [0, 1]) {
            const jobs = pass === 0 ? [...digits, ...words] : fallback.filter(needsFallback);
            if (pass === 1) { done += fallback.length - jobs.length; onProgress?.(done, total); }
            for (const j of jobs) {
                const { data } = await worker.recognize(j.cv);
                const raw = (data.text || '').trim();
                if (data.confidence >= 55) {
                    if (j.field === 'name') {
                        // due letture per persona (il riquadro isolato e la
                        // fascia sotto il simbolo): vince la più lunga, perché
                        // l'errore tipico è il nome tagliato, non inventato
                        const v = cleanName(raw);
                        if (v.length >= 2 && v.length > (out[j.person].name?.length ?? 0)) out[j.person].name = v;
                    } else {
                        const v = raw.replace(/\D/g, '');
                        // un anno ha quattro cifre, un'età al massimo tre
                        if (j.field === 'birthYear' && /^(18|19|20)\d\d$/.test(v)) out[j.person].birthYear = v;
                        if (j.field === 'age' && v.length >= 1 && v.length <= 3 && +v <= 120) out[j.person].age = v;
                    }
                }
                onProgress?.(++done, total);
            }
        }
    } finally {
        await worker.terminate();
    }
    return out;
};

/**
 * Ricava la data di nascita da leggere nel campo del genogramma.
 * Se c'è l'anno scritto si usa quello; altrimenti lo si ricava dall'età,
 * che è però riferita al momento in cui il genogramma è stato disegnato e non
 * a oggi: è una stima, e va trattata come tale.
 */
export const birthDateFrom = (l: PersonLabels, today = new Date()): string => {
    if (l.birthYear) return l.birthYear;
    if (l.age) {
        const y = today.getFullYear() - Number(l.age);
        if (y > 1850 && y <= today.getFullYear()) return String(y);
    }
    return '';
};
