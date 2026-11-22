import { useId, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { tinta } from '../utils/tema';
import {
    descriviCircumplex, puntoNelGrafico, valoriDaPunto, clamp100,
} from '../utils/circumplex';
import type { CircumplexValues } from '../utils/circumplex';

export interface CircumplexColori { testo: string; tenue: string; bordo: string; sfondo: string; accento: string }

// Le tre zone usano le famiglie del tema (verde/arancio/rosso) così seguono i temi PsyDiary.
const VERDE = tinta('#16a34a');
const ARANCIO = tinta('#d97706');
const ROSSO_ZONA = tinta('#dc2626');

/** Zona della cella (colonna c = coesione, riga r dall'alto): centro bilanciato, angoli sbilanciati, resto medio. */
const zonaCella = (c: number, r: number) => {
    const lc = c, lf = 3 - r;   // la riga 0 sta in alto = flessibilità massima
    const estremi = Number(lc === 0 || lc === 3) + Number(lf === 0 || lf === 3);
    return estremi === 0 ? { fill: VERDE, op: 0.18 } : estremi === 1 ? { fill: ARANCIO, op: 0.14 } : { fill: ROSSO_ZONA, op: 0.16 };
};

/** Griglia 4×4 ritagliata nel cerchio, condivisa da icona e grafico grande. */
const Griglia = ({ size, pad, colori, spessore }: { size: number; pad: number; colori: CircumplexColori; spessore: number }) => {
    // useId contiene ':' che dentro url(#...) non è sicuro in tutti i contesti (esportazioni incluse).
    const clipId = 'circ-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const inner = size - 2 * pad, cell = inner / 4, cx = size / 2, cy = size / 2, r = inner / 2;
    const celle = [];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
        const z = zonaCella(col, row);
        celle.push(<rect key={row * 4 + col} x={pad + col * cell} y={pad + row * cell} width={cell} height={cell} fill={z.fill} fillOpacity={z.op} />);
    }
    const linee = [1, 2, 3].flatMap(i => [
        <line key={'v' + i} x1={pad + i * cell} y1={pad} x2={pad + i * cell} y2={pad + inner} />,
        <line key={'h' + i} x1={pad} y1={pad + i * cell} x2={pad + inner} y2={pad + i * cell} />,
    ]);
    return (
        <>
            <defs><clipPath id={clipId}><circle cx={cx} cy={cy} r={r} /></clipPath></defs>
            <g clipPath={`url(#${clipId})`}>
                {celle}
                <g stroke={colori.bordo} strokeWidth={spessore} fill="none">{linee}</g>
            </g>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={colori.tenue} strokeWidth={spessore * 1.5} />
        </>
    );
};

const Punto = ({ p, r, colori }: { p: { x: number; y: number }; r: number; colori: CircumplexColori }) => (
    <circle cx={p.x} cy={p.y} r={r} fill={colori.accento} stroke="#ffffff" strokeWidth={1.5} />
);

/** Icona: solo disegno (<g>), senza <svg> attorno, così sta dentro l'SVG del canvas e finisce nelle esportazioni. x,y è l'angolo in alto a sinistra. */
export const CircumplexGlyph = ({ valori, x, y, size, colori }: { valori: CircumplexValues; x: number; y: number; size: number; colori: CircumplexColori }) => {
    // A 24–32px il bordo vuoto mangerebbe spazio: pad minimo, giusto per non tagliare il punto.
    const pad = size * 0.08;
    const p = puntoNelGrafico(valori, size, pad);
    return (
        <g transform={`translate(${x} ${y})`}>
            <title>{descriviCircumplex(valori)}</title>
            <Griglia size={size} pad={pad} colori={colori} spessore={0.6} />
            <Punto p={p} r={size * 0.11} colori={colori} />
        </g>
    );
};

const LIV_COES = ['Disimp.', 'Separata', 'Connessa', 'Invisch.'];
const LIV_FLESS = ['Rigida', 'Strutt.', 'Flessib.', 'Caotica'];

/** Versione grande per la sidebar, con etichette; trascinabile e da tastiera se `onChange` è dato. */
export const CircumplexChart = ({ valori, size = 220, colori, onChange }: { valori: CircumplexValues; size?: number; colori: CircumplexColori; onChange?: (v: CircumplexValues) => void }) => {
    const pad = 28, inner = size - 2 * pad, cell = inner / 4;
    const ref = useRef<SVGSVGElement>(null);
    const p = puntoNelGrafico(valori, size, pad);
    const desc = descriviCircumplex(valori);
    const v = { cohesion: clamp100(valori.cohesion), flexibility: clamp100(valori.flexibility) };

    const daEvento = (e: PointerEvent) => {
        const svg = ref.current;
        if (!svg || !onChange) return;
        const rc = svg.getBoundingClientRect();
        if (!rc.width || !rc.height) return;
        // L'SVG può essere scalato dal CSS: si riporta il puntatore alle unità del viewBox.
        onChange(valoriDaPunto((e.clientX - rc.left) * size / rc.width, (e.clientY - rc.top) * size / rc.height, size, pad));
    };
    const giu = (e: PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); daEvento(e); };
    const muovi = (e: PointerEvent) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) daEvento(e); };

    const tasto = (e: KeyboardEvent) => {
        if (!onChange) return;
        const passo = e.shiftKey ? 1 : 5;
        let { cohesion, flexibility } = v;
        if (e.key === 'ArrowLeft') cohesion -= passo;
        else if (e.key === 'ArrowRight') cohesion += passo;
        else if (e.key === 'ArrowUp') flexibility += passo;
        else if (e.key === 'ArrowDown') flexibility -= passo;
        else return;
        e.preventDefault();
        onChange({ cohesion: clamp100(cohesion), flexibility: clamp100(flexibility) });
    };

    const interattivo = !!onChange;
    return (
        <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}
            role="group" aria-label={desc} tabIndex={0} onKeyDown={tasto}
            style={{ display: 'block', touchAction: interattivo ? 'none' : undefined, userSelect: 'none' }}>
            <title>{desc}</title>
            <Griglia size={size} pad={pad} colori={colori} spessore={0.6} />
            <g stroke={colori.tenue} strokeWidth={0.8} strokeDasharray="2 3" opacity={0.6}>
                <line x1={pad} y1={p.y} x2={pad + inner} y2={p.y} />
                <line x1={p.x} y1={pad} x2={p.x} y2={pad + inner} />
            </g>
            <Punto p={p} r={5} colori={colori} />
            <g fontSize={9} fill={colori.tenue} textAnchor="middle">
                {LIV_COES.map((t, i) => <text key={t} x={pad + (i + 0.5) * cell} y={size - pad + 11}>{t}</text>)}
                {LIV_FLESS.map((t, i) => {
                    // La riga 0 dall'alto è il livello più alto: l'etichetta di indice i sta in basso.
                    const cy = pad + (3 - i + 0.5) * cell, cx = pad - 6;
                    return <text key={t} x={cx} y={cy} transform={`rotate(-90 ${cx} ${cy})`}>{t}</text>;
                })}
            </g>
            <g fontSize={10} fill={colori.testo} textAnchor="middle">
                <text x={size / 2} y={size - 4}>Coesione →</text>
                <text x={9} y={size / 2} transform={`rotate(-90 9 ${size / 2})`}>Flessibilità →</text>
            </g>
            {interattivo && (
                <rect x={pad} y={pad} width={inner} height={inner} fill="transparent"
                    style={{ cursor: 'crosshair', touchAction: 'none' }}
                    onPointerDown={giu} onPointerMove={muovi} />
            )}
        </svg>
    );
};
