// Correzioni dell'audit UI/UX: menu di esportazione raggiungibile col pannello
// aperto, maniglie che non coprono il nome, riquadri dei nomi aderenti al
// testo, genogramma inquadrato all'apertura, azioni delle schede visibili su
// touch, scheda apribile da tastiera, campi del pannello con il loro titolo.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   NODE_PATH=./node_modules node scripts/e2e-ui-fixes.cjs
const { chromium } = require('playwright-core');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

const C = 4000;
const N = (id, g, x, y, name, extra = {}) => ({ id, x, y, gender: g, name, birthDate: '', deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [], ...extra });
// volutamente lontano dal centro del foglio e più largo di un telefono
const DATA = {
    id: 'ui1', title: 'Lontano', category: 'family', lastModified: Date.now(),
    data: {
        nodes: [N('a', 'M', C + 900, C + 700, 'Bartolomeo', { birthDate: '1950' }), N('b', 'F', C + 1500, C + 700, 'Ludovica'),
            N('c', 'M', C + 1200, C + 900, 'Nipote')],
        edges: [{ id: 'm', fromId: 'a', toId: 'b', type: 'marriage', label: '', notes: [] }],
        groups: [], stickyNotes: [], structuralMaps: [], presets: [],
    },
};
const seed = async page => {
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(d => {
        localStorage.clear();
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: d.id, title: d.title, category: d.category, lastModified: d.lastModified }]));
        localStorage.setItem('genopro_data_' + d.id, JSON.stringify(d));
    }, DATA);
    await page.reload({ waitUntil: 'networkidle' });
};
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const errors = [];

    // --- desktop ---
    let page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
    page.on('pageerror', e => errors.push(e.message));
    await seed(page);

    // la scheda si apre da tastiera
    await page.focus('[role="button"][aria-label="Apri Lontano"]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    ok(await page.locator('svg g.cursor-pointer rect[width="40"]').count() >= 2, 'la scheda si apre con Invio');

    // all'apertura il disegno è inquadrato anche se sta lontano dal centro del foglio
    const inView = await page.evaluate(() => {
        const c = document.querySelector('svg g.cursor-pointer').closest('div[class*="overflow"]') || document.body;
        const vb = c.getBoundingClientRect();
        return [...document.querySelectorAll('svg g.cursor-pointer rect[width="40"], svg g.cursor-pointer circle[r="20"]')]
            .every(el => { const r = el.getBoundingClientRect(); return r.left >= vb.left && r.right <= vb.right && r.top >= vb.top && r.bottom <= vb.bottom; });
    });
    ok(inView, 'all\'apertura tutte le persone sono nell\'inquadratura');

    // riquadro del nome aderente al testo
    const fit = await page.evaluate(() => {
        const t = [...document.querySelectorAll('svg text.geno-testo')].find(x => x.textContent === 'Bartolomeo');
        const r = t.previousElementSibling;
        return { text: t.getComputedTextLength(), rect: parseFloat(r.getAttribute('width')) };
    });
    ok(Math.abs(fit.rect - (fit.text + 8)) < 1.5, `il riquadro del nome aderisce al testo (testo ${fit.text.toFixed(1)}, riquadro ${fit.rect.toFixed(1)})`);

    // selezione: la maniglia "genitori" non copre il nome
    const sq = await page.locator('svg g.cursor-pointer rect[width="40"]').first().boundingBox();
    await page.mouse.click(sq.x + 20, sq.y + 20);
    await page.waitForTimeout(400);
    const nome = await page.locator('svg text.geno-testo', { hasText: 'Bartolomeo' }).boundingBox();
    const genitori = await page.locator('svg g[data-ui="1"] g:has(title:text-is("Genitori")) > circle[r="14"]').boundingBox();
    ok(nome && genitori && !overlap(nome, genitori), 'la maniglia "genitori" non copre il nome');

    // il pannello dà un titolo ai campi: compilati restano riconoscibili
    ok(await page.locator('label:has(span:text-is("Nascita")) input').inputValue() === '1950', 'il campo "Nascita" ha il suo titolo');

    // col pannello aperto il menu di esportazione resta cliccabile
    await page.hover('[title="Esporta"]');
    await page.waitForTimeout(300);
    const topEl = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Scarica PNG'));
        const r = b.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return b.contains(el);
    });
    ok(topEl, 'col pannello aperto "Scarica PNG" non è coperto');
    await page.close();

    // --- telefono ---
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(e.message));
    await seed(page);
    const op = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Duplica"]');
        return btn ? getComputedStyle(btn.parentElement).opacity : 'assente';
    });
    ok(op === '1', `su touch le azioni della scheda sono visibili (opacità ${op})`);
    const cerca = await page.locator('input[placeholder^="Cerca"]').boundingBox();
    ok(cerca && cerca.width > 240, `su telefono la ricerca ha una riga sua (${cerca && Math.round(cerca.width)}px)`);
    await page.close();

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
