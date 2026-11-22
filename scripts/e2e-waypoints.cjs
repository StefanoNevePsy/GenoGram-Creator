// Punti intermedi sulle relazioni: si piega una linea trascinando il "+" a
// metà, si sposta il punto, lo si toglie con doppio clic o con "Raddrizza",
// le maniglie non finiscono nelle esportazioni e l'annulla funziona.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   NODE_PATH=./node_modules node scripts/e2e-waypoints.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

const C = 4000;
const N = (id, g, x, y, name) => ({ id, x, y, gender: g, name, birthDate: '', deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] });
const E = (id, f, t, type) => ({ id, fromId: f, toId: t, type, label: '', notes: [] });
const DATA = {
    id: 'wp1', title: 'Percorsi', category: 'family', lastModified: Date.now(),
    data: {
        nodes: [N('a', 'M', C - 200, C, 'Aldo'), N('b', 'F', C + 200, C, 'Bice'), N('m', 'M', C, C, 'In mezzo')],
        edges: [E('h', 'a', 'b', 'hostile'), E('f', 'a', 'm', 'fusion')],
        groups: [], stickyNotes: [], structuralMaps: [], presets: [],
    },
};
const saved = page => page.evaluate(() => {
    const k = Object.keys(localStorage).filter(x => x.startsWith('genopro_data_'));
    return JSON.parse(localStorage.getItem(k[k.length - 1])).data.edges;
});

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(d => {
        localStorage.clear();
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: d.id, title: d.title, category: d.category, lastModified: d.lastModified }]));
        localStorage.setItem('genopro_data_' + d.id, JSON.stringify(d));
    }, DATA);
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=Percorsi');
    await page.waitForTimeout(800);

    // la linea ostile passa sopra "In mezzo": la si seleziona
    await page.evaluate(() => document.querySelector('[data-edge="h"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    const plus = page.locator('[data-ui="1"] g.cursor-copy');
    ok(await plus.count() === 1, `un "+" a metà della linea selezionata (${await plus.count()})`);
    ok(await page.locator('text=trascina uno dei').count() > 0, 'il pannello spiega come piegare la linea');

    // si trascina il "+" 150px più in basso: la linea ora aggira "In mezzo"
    const bb = await plus.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + 160, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(2200);
    let eds = await saved(page);
    const h = eds.find(e => e.id === 'h');
    ok(h.waypoints && h.waypoints.length === 1 && h.waypoints[0].y > C + 100, `punto intermedio salvato sotto la persona (${JSON.stringify(h.waypoints)})`);

    // il tracciato disegnato passa davvero di lì (lo zigzag segue il percorso)
    const passes = await page.evaluate(wy => {
        const p = document.querySelector('[data-edge="h"] path[stroke-width="3"], [data-edge="h"] path[stroke-width="2"]');
        const nums = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
        const ys = nums.filter((_, i) => i % 2 === 1);
        return Math.max(...ys) > wy - 10;
    }, h.waypoints[0].y);
    ok(passes, 'il tracciato scende fino al punto intermedio');

    // ora i "+" sono due (uno per tratto) e c'è un pallino da trascinare
    ok(await page.locator('[data-ui="1"] g.cursor-copy').count() === 2, 'un "+" per ciascuno dei due tratti');
    ok(await page.locator('[data-ui="1"] g.cursor-move').count() === 1, 'un pallino per il punto intermedio');

    // le maniglie non finiscono nell'SVG esportato
    await page.click('[title="Esporta"]'); await page.waitForTimeout(300);
    if (process.env.DBG) await page.screenshot({ path: process.env.DBG });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Scarica SVG")')]);
    const svg = fs.readFileSync(await dl.path(), 'utf8');
    ok(!svg.includes('data-ui="1"') && !svg.includes('piegare la linea'), 'nessuna maniglia nell\'esportazione');
    ok(/data-edge="h"/.test(svg), 'la relazione è nell\'esportazione');
    await page.keyboard.press('Escape');

    // doppio clic sul pallino: il punto sparisce
    await page.evaluate(() => document.querySelector('[data-edge="h"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    const dot = await page.locator('[data-ui="1"] g.cursor-move').boundingBox();
    await page.mouse.dblclick(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.waitForTimeout(2200);
    eds = await saved(page);
    ok(!(eds.find(e => e.id === 'h').waypoints || []).length, 'doppio clic toglie il punto');

    // annulla: il punto torna
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(2200);
    eds = await saved(page);
    ok((eds.find(e => e.id === 'h').waypoints || []).length === 1, 'annulla riporta il punto');

    // "Raddrizza" dal pannello
    await page.evaluate(() => document.querySelector('[data-edge="h"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    await page.click('button:has-text("Raddrizza")');
    await page.waitForTimeout(2200);
    eds = await saved(page);
    ok(!(eds.find(e => e.id === 'h').waypoints || []).length, '"Raddrizza" toglie tutti i punti');

    // coppia, figli e gemelli non si reinstradano
    await page.evaluate(() => {
        const k = Object.keys(localStorage).filter(x => x.startsWith('genopro_data_'))[0];
        const d = JSON.parse(localStorage.getItem(k));
        d.data.edges.push({ id: 'mm', fromId: 'a', toId: 'b', type: 'marriage', label: '', notes: [] });
        localStorage.setItem(k, JSON.stringify(d));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=Percorsi'); await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('[data-edge="mm"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    ok(await page.locator('[data-ui="1"] g.cursor-copy').count() === 0, 'una relazione di coppia non offre punti intermedi');

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
