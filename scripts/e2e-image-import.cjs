// Import di un genogramma da immagine, dall'apertura della modale ai nodi sul
// canvas. Usa il genogramma di riferimento stampato (20 persone, 3
// generazioni) generato qui sotto in modo deterministico, così il test non
// dipende da un file binario nel repository.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   npm run dev -- --port 5199 &
//   NODE_PATH=./node_modules node scripts/e2e-image-import.cjs [path-chromium]
const { chromium } = require('playwright-core');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

// Tre generazioni: due nonni, tre figli, due nipoti. Disegnato come lo
// disegnerebbe un software: quadrati, cerchi, barre di coppia ortogonali.
const makeImage = `(() => {
    const W = 760, H = 460, R = 16;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#111'; x.lineWidth = 3; x.lineJoin = 'miter';
    const sq = (cx, cy) => x.strokeRect(cx - R, cy - R, 2 * R, 2 * R);
    const ci = (cx, cy) => { x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke(); };
    const seg = (x0, y0, x1, y1) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };

    const P = {
        nonno: [160, 70], nonna: [340, 70],
        zio: [90, 230], padre: [250, 230], zia: [410, 230], madre: [560, 230],
        n1: [330, 390], n2: [470, 390],
    };
    sq(...P.nonno); ci(...P.nonna);
    sq(...P.zio); sq(...P.padre); ci(...P.zia); ci(...P.madre);
    sq(...P.n1); ci(...P.n2);

    // nonni: barra di coppia e discendenza
    seg(P.nonno[0], P.nonno[1] + R, P.nonno[0], 130);
    seg(P.nonna[0], P.nonna[1] + R, P.nonna[0], 130);
    seg(P.nonno[0], 130, P.nonna[0], 130);
    const midG = (P.nonno[0] + P.nonna[0]) / 2;
    seg(midG, 130, midG, 165);
    seg(P.zio[0], 165, P.zia[0], 165);
    [P.zio, P.padre, P.zia].forEach(p => seg(p[0], 165, p[0], p[1] - R));

    // padre + madre e i loro due figli
    seg(P.padre[0], P.padre[1] + R, P.padre[0], 290);
    seg(P.madre[0], P.madre[1] + R, P.madre[0], 290);
    seg(P.padre[0], 290, P.madre[0], 290);
    const midP = (P.padre[0] + P.madre[0]) / 2;
    seg(midP, 290, midP, 330);
    seg(P.n1[0], 330, P.n2[0], 330);
    [P.n1, P.n2].forEach(p => seg(p[0], 330, p[0], p[1] - R));
    return c.toDataURL('image/png');
})()`;

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Nuovo"):visible');
    await page.waitForTimeout(400);

    await page.click('[title="Importa da immagine (foto o scansione)"]');
    await page.waitForTimeout(200);
    ok(await page.locator('text=Importa da immagine').count() > 0, 'modale di import aperta');

    // consegna l'immagine all'input file senza toccare il disco
    const dataUrl = await page.evaluate(makeImage);
    await page.evaluate(async url => {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'genogramma.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector('input[type="file"][accept="image/*"]');
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, dataUrl);

    await page.waitForSelector('text=persone', { timeout: 30000 });
    await page.waitForTimeout(500);

    const summary = await page.locator('span:has-text("persone")').first().innerText();
    const found = parseInt(summary, 10);
    ok(found === 8, `riconosciute 8 persone (trovate ${found})`);

    const linkText = await page.locator('span:has-text("unioni")').first().innerText();
    const [, unions, children] = linkText.match(/(\d+) unioni · (\d+) legami/) || [];
    ok(+unions === 2, `2 unioni riconosciute (trovate ${unions})`);
    ok(+children === 10, `10 legami genitore-figlio (trovati ${children})`);

    await page.click('button:has-text("Importa 8 persone")');
    await page.waitForTimeout(2200);   // l'autosalvataggio è ritardato di 1.5s

    ok(await page.locator('text=Importa da immagine').count() === 0, 'modale chiusa dopo l\'import');

    const shapes = await page.evaluate(() => ({
        squares: document.querySelectorAll('svg g.cursor-pointer rect[width="40"]').length,
        circles: document.querySelectorAll('svg g.cursor-pointer circle[r="20"]').length,
    }));
    ok(shapes.squares === 4, `4 quadrati sul canvas (${shapes.squares})`);
    ok(shapes.circles === 4, `4 cerchi sul canvas (${shapes.circles})`);

    // le relazioni devono esistere davvero, non solo i nodi
    const rel = await page.evaluate(() => {
        const raw = Object.keys(localStorage).filter(k => k.startsWith('genopro_data_'));
        if (!raw.length) return null;
        const d = JSON.parse(localStorage.getItem(raw[raw.length - 1])).data;
        return { nodes: d.nodes.length, edges: d.edges.length, types: [...new Set(d.edges.map(e => e.type))].sort() };
    });
    ok(rel && rel.nodes === 8, `8 persone salvate (${rel && rel.nodes})`);
    ok(rel && rel.edges === 12, `12 relazioni salvate (${rel && rel.edges})`);
    ok(rel && rel.types.join(',') === 'child-bio,marriage', `tipi neutri attesi (${rel && rel.types.join(',')})`);

    // annullare deve riportare indietro l'import intero, non una persona
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => document.querySelectorAll('svg g.cursor-pointer rect[width="40"]').length
        + document.querySelectorAll('svg g.cursor-pointer circle[r="20"]').length);
    ok(after === 0, `annulla rimuove tutte le persone importate (ne restano ${after})`);

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
