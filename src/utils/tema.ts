// --- TEMI CON STILE COMPLETO (PsyDiary) ---
// I colori dei legami e dei segni clinici hanno un significato (verde affetto,
// rosso conflitto, arancio sostanze...): i temi PsyDiary non li cambiano a
// caso, ridefiniscono le famiglie di colore (variabili CSS --geno-*) con toni
// accordati alla carta chiara o scura. Negli altri temi le variabili non
// esistono e restano i colori originali (secondo argomento di var()).
import type { AppTheme } from '../config/themes';

export const famigliaColore = (hex: string): string => {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return String(hex || '').toLowerCase() === 'red' ? 'rosso' : 'nero';
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (sat < 0.2 || d < 0.08) return l < 0.35 ? 'nero' : 'grigio';
    let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    if (hue < 15 || hue >= 345) return l < 0.33 ? 'bordeaux' : 'rosso';
    if (hue < 45) return l < 0.35 ? 'marrone' : 'arancio';
    if (hue < 70) return 'oro';
    if (hue < 170) return 'verde';
    if (hue < 200) return 'ottanio';
    if (hue < 270) return 'blu';
    if (hue < 320) return 'viola';
    return 'rosa';
};
/** Colore che segue il tema PsyDiary se attivo, altrimenti resta `fallback` (o il colore stesso). */
export const tinta = (hex: string, fallback?: string) => `var(--geno-${famigliaColore(hex)}, ${fallback || hex})`;
export const ROSSO = tinta('#FF0000', 'red');

const GENO_VARS = ['nero', 'carta', 'carta2', 'grigio', 'bordo', 'verde', 'rosso', 'bordeaux', 'marrone', 'arancio', 'oro', 'ottanio', 'blu', 'viola', 'rosa'].map(n => '--geno-' + n);
export const varsTema = (t: AppTheme): Record<string, string> =>
    (t.geno ? Object.fromEntries(Object.entries(t.geno).map(([k, v]) => ['--geno-' + k, v])) : {});

/** Nelle esportazioni l'SVG viaggia da solo: i colori del tema vanno copiati dentro. */
export const copiaTemaInSvg = (clone: SVGSVGElement, origine: Element | null) => {
    if (!origine) return;
    const cs = getComputedStyle(origine);
    GENO_VARS.forEach(n => { const v = cs.getPropertyValue(n).trim(); if (v) clone.style.setProperty(n, v); });
};

/**
 * Le note adesive sono HTML dentro l'SVG (foreignObject): il browser non
 * permette di trasformare in PNG/JPEG un'immagine che ne contiene ("tainted
 * canvas") e il download falliva senza messaggio. Nella sola copia esportata
 * ogni foreignObject diventa testo SVG con lo stesso carattere, colore,
 * allineamento e ritorni a capo.
 */
export const notaInTestoSvg = (clone: SVGSVGElement) => {
    const NS = 'http://www.w3.org/2000/svg';
    clone.querySelectorAll('foreignObject').forEach(fo => {
        const x = parseFloat(fo.getAttribute('x') || '0'), y = parseFloat(fo.getAttribute('y') || '0');
        const w = parseFloat(fo.getAttribute('width') || '0'), h = parseFloat(fo.getAttribute('height') || '0');
        const div = fo.querySelector('div') as HTMLElement | null;
        const st = div ? div.style : null;
        const testo = (fo.textContent || '').replace(/\r/g, '');
        const dim = parseFloat((st && st.fontSize) || '13') || 13;
        const centrato = !!st && st.textAlign === 'center';
        const riga = dim * 1.3;
        const perRiga = Math.max(4, Math.floor(w / (dim * 0.55)));
        const righe: string[] = [];
        testo.split('\n').forEach(par => {
            let cur = '';
            par.split(/\s+/).forEach(p0 => {
                let parola = p0;
                while (parola.length > perRiga) { if (cur) { righe.push(cur); cur = ''; } righe.push(parola.slice(0, perRiga)); parola = parola.slice(perRiga); }
                const prova = cur ? cur + ' ' + parola : parola;
                if (prova.length > perRiga) { righe.push(cur); cur = parola; } else cur = prova;
            });
            righe.push(cur);
        });
        const visibili = righe.slice(0, Math.max(1, Math.floor(h / riga)));
        const t = document.createElementNS(NS, 'text');
        const cx = centrato ? x + w / 2 : x;
        t.setAttribute('x', String(cx));
        t.setAttribute('y', String(centrato ? y + (h - visibili.length * riga) / 2 + dim : y + dim));
        if (centrato) t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', String(dim));
        t.setAttribute('font-family', (st && st.fontFamily) || 'sans-serif');
        t.setAttribute('fill', (st && st.color) || '#000');
        if (st && st.opacity) t.setAttribute('opacity', st.opacity);
        visibili.forEach((r, i) => {
            const ts = document.createElementNS(NS, 'tspan');
            ts.setAttribute('x', String(cx));
            if (i > 0) ts.setAttribute('dy', String(riga));
            ts.textContent = r || ' ';
            t.appendChild(ts);
        });
        fo.replaceWith(t);
    });
};
