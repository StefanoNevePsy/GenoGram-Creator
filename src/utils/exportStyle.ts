// --- STILE DEL TESTO NELLE ESPORTAZIONI ---
//
// Un SVG esportato viaggia da solo. Sul canvas il testo prende carattere,
// corpo, peso e opacità da regole CSS della pagina (i temi PsyDiary usano
// Archivo, Gloock per le età, La Belle Aurore per i nomi dei nuclei; le età
// hanno corpo e opacità da classi Tailwind): nella copia esportata quelle
// regole non ci sono più, e il testo ricadeva nel carattere di sistema.
//
// Per il PNG/JPEG c'è un vincolo in più: un SVG disegnato come immagine non
// può caricare file esterni, nemmeno dallo stesso sito. I font devono essere
// DENTRO l'SVG, come @font-face con i dati in base64.
//
// Quindi, nella sola copia esportata:
//   1. si scrive su ogni <text> lo stile calcolato dal browser;
//   2. si incorporano i file dei font effettivamente usati, solo per gli
//      intervalli di caratteri che compaiono davvero nel disegno.

const TEXT_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
    'font-variation-settings', 'letter-spacing', 'text-transform'];

/**
 * Copia sul clone lo stile calcolato di ogni testo dell'originale. Va chiamata
 * subito dopo cloneNode, prima di qualsiasi modifica alla struttura del clone:
 * i testi si accoppiano per posizione.
 */
export const inlineTextStyles = (clone: SVGSVGElement, original: SVGSVGElement) => {
    const src = original.querySelectorAll('text, tspan');
    const dst = clone.querySelectorAll('text, tspan');
    const n = Math.min(src.length, dst.length);
    for (let i = 0; i < n; i++) {
        const cs = getComputedStyle(src[i]);
        const el = dst[i] as SVGElement;
        TEXT_PROPS.forEach(p => {
            const v = cs.getPropertyValue(p);
            if (v && v !== 'normal' && v !== 'none') el.style.setProperty(p, v);
        });
        // colore e opacità solo se arrivano da una regola CSS: un attributo
        // esplicito (anche con var() del tema) resta com'è
        if (!src[i].hasAttribute('fill')) el.style.setProperty('fill', cs.getPropertyValue('fill'));
        const op = cs.getPropertyValue('opacity');
        if (op && op !== '1' && !src[i].hasAttribute('opacity')) el.style.setProperty('opacity', op);
    }
    const rootFont = getComputedStyle(original).getPropertyValue('font-family');
    if (rootFont) clone.style.fontFamily = rootFont;
};

const familiesOf = (value: string) => value.split(',')
    .map(f => f.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);

// "U+0000-00FF, U+0131, U+0152-0153" → [[0,255],[305,305],[338,339]]
const parseRange = (r: string): [number, number][] => {
    if (!r) return [[0, 0x10ffff]];
    return r.split(',').map(part => {
        const m = part.trim().replace(/^U\+/i, '');
        if (m.includes('?')) return [parseInt(m.replace(/\?/g, '0'), 16), parseInt(m.replace(/\?/g, 'F'), 16)] as [number, number];
        const [a, b] = m.split('-');
        return [parseInt(a, 16), parseInt(b || a, 16)] as [number, number];
    }).filter(([a, b]) => !isNaN(a) && !isNaN(b));
};

const dataUrlCache = new Map<string, Promise<string | null>>();

const toDataUrl = (url: string): Promise<string | null> => {
    if (url.startsWith('data:')) return Promise.resolve(url);
    if (!dataUrlCache.has(url)) {
        const read = (blob: Blob) => new Promise<string | null>(res => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.onerror = () => res(null);
            fr.readAsDataURL(blob);
        });
        // fetch prima; XHR come ripiego per l'app desktop, che carica i file
        // dal disco (file://) dove fetch non è ammesso
        const viaXhr = () => new Promise<Blob | null>(res => {
            try {
                const x = new XMLHttpRequest();
                x.open('GET', url); x.responseType = 'blob';
                x.onload = () => res(x.status === 0 || (x.status >= 200 && x.status < 300) ? x.response : null);
                x.onerror = () => res(null);
                x.send();
            } catch { res(null); }
        });
        dataUrlCache.set(url, fetch(url)
            .then(r => (r.ok ? r.blob() : null))
            .catch(() => null)
            .then(b => b || viaXhr())
            .then(b => (b ? read(b) : null)));
    }
    return dataUrlCache.get(url)!;
};

const collectFontFaces = (sheets: StyleSheetList): { rule: CSSFontFaceRule, base: string }[] => {
    const out: { rule: CSSFontFaceRule, base: string }[] = [];
    const walk = (rules: CSSRuleList, base: string) => {
        for (const r of Array.from(rules)) {
            if (r instanceof CSSFontFaceRule) out.push({ rule: r, base });
            else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules, base);
            else if (r instanceof CSSImportRule && r.styleSheet) {
                try { walk(r.styleSheet.cssRules, r.styleSheet.href || base); } catch { /* foglio esterno non leggibile */ }
            }
        }
    };
    for (const sh of Array.from(sheets)) {
        try { walk(sh.cssRules, sh.href || document.baseURI); } catch { /* foglio di un altro dominio: non leggibile */ }
    }
    return out;
};

/**
 * Incorpora nel clone i font usati dal suo testo. Restituisce quanti file sono
 * stati incorporati (0 = nessun font web in uso, si resta sui caratteri di sistema).
 */
export const embedFonts = async (clone: SVGSVGElement): Promise<number> => {
    const used = new Set<string>();
    const codes = new Set<number>();
    const consider = (el: Element) => {
        const fam = (el as SVGElement).style?.fontFamily || el.getAttribute('font-family') || '';
        familiesOf(fam).forEach(f => used.add(f));
        for (const ch of el.textContent || '') codes.add(ch.codePointAt(0)!);
    };
    consider(clone);
    clone.querySelectorAll('text, tspan').forEach(consider);
    if (!used.size) return 0;

    const faces = collectFontFaces(document.styleSheets).filter(({ rule }) => {
        const fam = familiesOf(rule.style.getPropertyValue('font-family'))[0];
        if (!fam || !used.has(fam)) return false;
        // solo i sottoinsiemi che contengono caratteri davvero presenti:
        // @fontsource spezza ogni carattere in latin, latin-ext, vietnamita...
        const ranges = parseRange(rule.style.getPropertyValue('unicode-range'));
        for (const c of codes) if (ranges.some(([a, b]) => c >= a && c <= b)) return true;
        return false;
    });

    const css = await Promise.all(faces.map(async ({ rule, base }) => {
        const src = rule.style.getPropertyValue('src');
        // il primo url(): @fontsource mette il woff2 prima del woff
        const m = /url\(\s*["']?([^"')]+)["']?\s*\)\s*(format\(\s*["']?([^"')]+)["']?\s*\))?/i.exec(src);
        if (!m) return '';
        let abs: string;
        try { abs = new URL(m[1], base).href; } catch { return ''; }
        const data = await toDataUrl(abs);
        if (!data) return '';
        const decl = ['font-family', 'font-style', 'font-weight', 'font-stretch', 'unicode-range']
            .map(p => { const v = rule.style.getPropertyValue(p); return v ? `${p}:${v};` : ''; })
            .join('');
        return `@font-face{${decl}src:url(${data})${m[3] ? ` format("${m[3]}")` : ''};}`;
    }));

    const text = css.filter(Boolean).join('\n');
    if (!text) return 0;
    const NS = 'http://www.w3.org/2000/svg';
    const style = document.createElementNS(NS, 'style');
    style.textContent = text;
    let defs = clone.querySelector('defs');
    if (!defs) { defs = document.createElementNS(NS, 'defs'); clone.insertBefore(defs, clone.firstChild); }
    defs.insertBefore(style, defs.firstChild);
    return css.filter(Boolean).length;
};

/** Tutto insieme: stile calcolato sul testo + font incorporati. */
export const portaStileTesto = async (clone: SVGSVGElement, original: SVGSVGElement) => {
    inlineTextStyles(clone, original);
    return embedFonts(clone);
};
