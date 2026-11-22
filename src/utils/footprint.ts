// --- INGOMBRO REALE DI UNA PERSONA SUL CANVAS ---
// Il simbolo è 40×40, ma una persona occupa di più: il nome sta sopra, la
// croce con l'anno di morte, l'etichetta e la professione sotto. Chi deve
// evitare le sovrapposizioni (contorno dei gruppi, distribuzione automatica)
// deve ragionare su questo, non sul quadrato: due simboli distanti 80px con
// nomi di venti lettere si coprono i nomi a vicenda.
//
// Le misure ricalcano NodeShape (components/canvas.tsx): se cambia il disegno
// delle etichette, va aggiornato qui.

import type { GenNode } from '../types';
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';
import { annoMorte } from './dates';
import type { Rect } from './groupShape';

// TextLabel stima la larghezza a 0.65·corpo per carattere + 8 di margine
const labelWidth = (text: string, size: number) => text.length * size * 0.65 + 8;

export const nodeFootprint = (n: GenNode): Rect => {
    const cx = n.x + NODE_WIDTH / 2;
    let half = NODE_WIDTH / 2;
    if (n.name) half = Math.max(half, labelWidth(n.name, 11) / 2);
    if (n.label) half = Math.max(half, labelWidth(n.label, 9) / 2);
    if (n.profession) half = Math.max(half, labelWidth(n.profession, 8) / 2);

    const top = n.y + (n.name ? -18 : 0);
    let bottom = n.y + NODE_HEIGHT;
    if (n.deceased && annoMorte(n.deathDate)) bottom = n.y + NODE_HEIGHT + 19;
    if (n.label) bottom += 13;
    if (n.profession) bottom += 12;

    return { x0: cx - half, y0: top, x1: cx + half, y1: bottom + 2 };
};
