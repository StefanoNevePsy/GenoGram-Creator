// Le esportazioni conservano i caratteri del tema: in PsyDiary nomi in
// Archivo, età in Gloock, nomi dei nuclei in La Belle Aurore. Un SVG esportato
// viaggia da solo (le regole CSS della pagina non lo seguono) e un SVG
// disegnato come immagine non può caricare font esterni: vanno incorporati.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   NODE_PATH=./node_modules node scripts/e2e-export-fonts.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

const C = 4000;
const N = (id, g, x, y, name, birthDate) => ({ id, x, y, gender: g, name, birthDate, deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] });
const DATA = {
    id: 'font1', title: 'Caratteri', category: 'family', lastModified: Date.now(),
    data: {
        nodes: [N('a', 'M', C, C, 'Àlvaro', '1960'), N('b', 'F', C + 160, C, 'Bea', '1962')],
        edges: [{ id: 'm', fromId: 'a', toId: 'b', type: 'marriage', label: '', notes: [] }],
        groups: [{ id: 'g', memberIds: ['a', 'b'], type: 'household', label: 'Nucleo', color: '#1d4ed8', notes: [] }],
        stickyNotes: [], structuralMaps: [], presets: [],
    },
};

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(d => {
        localStorage.clear();
        localStorage.setItem('genopro_theme_id', 'psydiary-chiaro');
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: d.id, title: d.title, category: d.category, lastModified: d.lastModified }]));
        localStorage.setItem('genopro_data_' + d.id, JSON.stringify(d));
    }, DATA);
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=Caratteri');
    await page.waitForTimeout(800);

    await page.click('[title="Esporta"]'); await page.waitForTimeout(300);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Scarica SVG")')]);
    const svg = fs.readFileSync(await dl.path(), 'utf8');

    ok(!/font-family:\s*sans-serif;?"?\s*(width|$)/.test(svg.slice(0, 400)), 'la radice non è più forzata a sans-serif');
    for (const fam of ['Archivo Variable', 'Gloock', 'La Belle Aurore']) {
        ok(new RegExp(`@font-face\\{font-family:"?${fam}"?;[^}]*src:url\\(data:`).test(svg), `${fam} incorporato come dati nell'SVG`);
    }
    // la À di Àlvaro sta nel sottoinsieme latin: niente sottoinsiemi inutili (vietnamita, cirillico)
    ok(!/U\+0102-0103/.test(svg), 'non incorpora sottoinsiemi di caratteri che il disegno non usa');
    const eta = String(new Date().getFullYear() - 1960);
    const etaTag = (svg.match(new RegExp(`<text[^>]*>${eta}</text>`)) || [''])[0];
    ok(/font-family:\s*Gloock/.test(etaTag), `l'età porta il carattere Gloock scritto sul testo (${etaTag.slice(0, 80)}…)`);

    // il PNG si genera senza errori anche con i font incorporati
    await page.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
    await page.click('[title="Esporta"]'); await page.waitForTimeout(300);
    const [png] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Scarica PNG")')]);
    const buf = fs.readFileSync(await png.path());
    ok(buf.slice(1, 4).toString() === 'PNG' && buf.length > 5000, `PNG valido (${buf.length} byte)`);

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
