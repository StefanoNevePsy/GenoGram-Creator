// Circonflesso di Olson: gruppo con contorno a puntini e icona accanto
// all'etichetta, grafico e badge nella sidebar, cursori salvati, gruppo
// nascondibile (e ritrovabile dal popover in barra) e icona nelle esportazioni.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   NODE_PATH=./node_modules node scripts/e2e-circumplex.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

const C = 4000;
const N = (id, g, x, y, name) => ({ id, x, y, gender: g, name, birthDate: '', deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] });
const DATA = {
    id: 'ol1', title: 'Olson', category: 'family', lastModified: Date.now(),
    data: {
        nodes: [N('a', 'M', C - 200, C, 'Aldo'), N('b', 'F', C + 200, C, 'Bice'), N('c', 'M', C, C + 200, 'Carlo')],
        edges: [],
        groups: [{ id: 'g1', memberIds: ['a', 'b', 'c'], type: 'circumplex', showLabel: false, label: 'Famiglia', color: '#2563eb', notes: [],
            circumplex: { cohesion: 80, flexibility: 20 } }],
        stickyNotes: [], structuralMaps: [], presets: [],
    },
};
const savedGroup = page => page.evaluate(() => {
    const k = Object.keys(localStorage).filter(x => x.startsWith('genopro_data_'));
    return JSON.parse(localStorage.getItem(k[k.length - 1])).data.groups[0];
});
const OUTLINE = 'path[stroke-dasharray="1.5 6"]';
const selectGroup = page => page.evaluate(sel => {
    const p = document.querySelector(sel);
    p.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    p.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, OUTLINE);

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(d => {
        localStorage.clear();
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: d.id, title: d.title, category: d.category, lastModified: d.lastModified }]));
        localStorage.setItem('genopro_data_' + d.id, JSON.stringify(d));
    }, DATA);
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=Olson');
    await page.waitForTimeout(800);

    ok(await page.locator(OUTLINE).count() === 1, 'contorno a puntini del gruppo circonflesso');
    ok(await page.locator('path[stroke-dasharray="10,5"]').count() === 0, 'nessun contorno tratteggiato standard');
    const glyphs = () => page.locator('svg g > title').evaluateAll(ts => ts.filter(t => t.textContent.startsWith('Coesione')).length);
    ok(await glyphs() === 1, 'icona del circonflesso accanto all\'etichetta');


    // --- icona movibile (etichetta nascosta: in automatico sta sopra il contorno, non sui membri) ---
    const glyphBox = () => page.evaluate(() => {
        const t = [...document.querySelectorAll('svg g > title')].find(x => x.textContent.startsWith('Coesione'));
        const r = t.parentElement.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const personBoxes = () => page.evaluate(() => ['Aldo', 'Bice', 'Carlo'].map(n => {
        const tx = [...document.querySelectorAll('svg text')].find(x => x.textContent.trim() === n);
        const r = tx.closest('g[style*="touch-action"]').getBoundingClientRect();
        return { n, x: r.x, y: r.y, w: r.width, h: r.height };
    }));
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    let gb = await glyphBox();
    const pers = await personBoxes();
    ok(pers.every(p => !overlap(gb, p)), 'etichetta nascosta: l\'icona non copre nessuna persona');
    const drag = async (dx) => {
        const b = await glyphBox();
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        await page.mouse.move(cx, cy); await page.mouse.down();
        await page.mouse.move(cx + dx / 2, cy, { steps: 5 }); await page.mouse.move(cx + dx, cy, { steps: 5 });
        await page.mouse.up();
    };
    await drag(120);
    await page.waitForTimeout(2200);
    const gb2 = await glyphBox();
    ok(Math.abs(gb2.x - gb.x - 120) < 4 && Math.abs(gb2.y - gb.y) < 4, `trascinando l'icona di 120px si sposta (${Math.round(gb2.x - gb.x)})`);
    let gX = await savedGroup(page);
    ok(gX.glyphPos && typeof gX.glyphPos.x === 'number', 'glyphPos salvato');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(2200);
    const gb3 = await glyphBox();
    ok(Math.abs(gb3.x - gb.x) < 4, 'Ctrl+Z ripristina la posizione precedente');
    gX = await savedGroup(page);
    ok(!gX.glyphPos, 'dopo Ctrl+Z glyphPos non è più salvato');
    await drag(120);
    await page.waitForTimeout(500);
    await page.click('text=Riposiziona icona');
    await page.waitForTimeout(2200);
    gX = await savedGroup(page);
    ok(!gX.glyphPos, '"Riposiziona icona" azzera glyphPos');
    ok(Math.abs((await glyphBox()).x - gb.x) < 4, 'l\'icona torna in posizione automatica');

    // selezione: grafico e badge nella sidebar
    await selectGroup(page);
    await page.waitForTimeout(300);
    ok(await page.locator('svg[role="group"][aria-label^="Coesione"]').count() === 1, 'grafico nella sidebar');
    ok(await page.locator('text=Sbilanciato').count() > 0, 'badge "Sbilanciato"');

    // cursore Coesione a 50 -> Medio, salvato
    const range = page.locator('input[type="range"]').first();
    await range.fill('50');
    await page.waitForTimeout(2200);
    ok(await page.locator('text=Medio (mid-range)').count() > 0, 'badge "Medio (mid-range)"');
    let g = await savedGroup(page);
    ok(g.circumplex && g.circumplex.cohesion === 50 && g.circumplex.flexibility === 20, `valori salvati (${JSON.stringify(g.circumplex)})`);

    // l'icona è nell'SVG esportato
    const esporta = async () => {
        await page.click('[title="Esporta"]'); await page.waitForTimeout(300);
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Scarica SVG")')]);
        const svg = fs.readFileSync(await dl.path(), 'utf8');
        await page.keyboard.press('Escape');
        return svg;
    };
    let svg = await esporta();
    ok(svg.includes('Coesione'), 'icona presente nell\'SVG esportato');

    // nascondi nel disegno
    await selectGroup(page);
    await page.waitForTimeout(200);
    await page.check('#circHidden');
    await page.waitForTimeout(2200);
    ok(await page.locator(OUTLINE).count() === 0, 'gruppo nascosto: niente contorno');
    ok(await glyphs() === 0, 'gruppo nascosto: niente icona');
    g = await savedGroup(page);
    ok(g.hidden === true, 'hidden salvato');

    // popover in barra
    await page.click('[aria-label="Valutazioni circonflesse (Olson)"]');
    await page.waitForTimeout(300);
    const row = page.locator('ul[role="list"] li');
    ok(await row.count() === 1 && (await row.innerText()).includes('Famiglia'), 'il popover elenca il gruppo');
    ok((await row.innerText()).includes('Medio'), 'il popover mostra il tipo di sistema');
    await page.click('[aria-label="Mostra Famiglia nel disegno"]');
    await page.waitForTimeout(300);
    ok(await page.locator(OUTLINE).count() === 1, 'l\'occhio rimostra il gruppo');
    // Esc chiude
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    ok(await page.locator('ul[role="list"]').count() === 0, 'Esc chiude il popover');
    svg = await esporta();
    ok(svg.includes('Coesione'), 'icona di nuovo nell\'esportazione');

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
