// "Nomi anonimi" nelle esportazioni: SVG, PNG e report escono con le iniziali,
// mentre il canvas e i dati salvati restano com'erano. L'opzione sopravvive al
// ricaricamento e il titolo del genogramma (spesso il cognome) non finisce nei
// nomi dei file.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   NODE_PATH=./node_modules node scripts/e2e-export-anonimo.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

const C = 4000;
const N = (id, g, x, y, name) => ({ id, x, y, gender: g, name, birthDate: '1960', deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] });
const DATA = {
    id: 'anon1', title: 'Famiglia Rossi', category: 'family', lastModified: Date.now(),
    data: {
        nodes: [N('a', 'F', C, C, 'Maria Rossi'), N('b', 'M', C + 160, C, 'Marco Rossi'), N('c', 'M', C + 320, C, 'Luca'), N('d', 'F', C + 480, C, '')],
        edges: [{ id: 'm', fromId: 'a', toId: 'b', type: 'marriage', label: '', notes: [] }],
        groups: [], stickyNotes: [], structuralMaps: [], presets: [],
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
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: d.id, title: d.title, category: d.category, lastModified: d.lastModified }]));
        localStorage.setItem('genopro_data_' + d.id, JSON.stringify(d));
    }, DATA);
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=Famiglia Rossi');
    await page.waitForTimeout(800);

    const scaricaSvg = async () => {
        await page.hover('[title="Esporta"]'); await page.waitForTimeout(300);
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Scarica SVG")')]);
        return { svg: fs.readFileSync(await dl.path(), 'utf8'), nome: dl.suggestedFilename() };
    };

    // 1. opzione spenta: nomi veri
    const off = await scaricaSvg();
    ok(off.svg.includes('Maria Rossi'), 'opzione spenta: l\'SVG contiene "Maria Rossi"');
    ok(off.nome.includes('Famiglia Rossi'), 'opzione spenta: il nome file usa il titolo');

    // 2. opzione accesa
    await page.hover('[title="Esporta"]'); await page.waitForTimeout(300);
    await page.check('text=Nomi anonimi (iniziali)');
    const on = await scaricaSvg();
    ok(on.svg.includes('>Mari.<') && on.svg.includes('>Marc.<') && on.svg.includes('>L.<'), 'SVG anonimo: "Mari." "Marc." "L."');
    for (const n of ['Rossi', 'Maria', 'Marco', 'Luca']) ok(!on.svg.includes(n), `SVG anonimo: nessun "${n}"`);
    ok(!on.nome.includes('Famiglia') && !on.nome.includes('Rossi') && on.nome.startsWith('genogramma'), `nome file senza titolo (${on.nome})`);

    // 3. il canvas non cambia
    const testi = await page.$$eval('svg text[data-nome]', els => els.map(e => e.textContent));
    ok(testi.includes('Maria Rossi') && testi.includes('Marco Rossi'), 'il canvas mostra ancora "Maria Rossi"');
    const salvato = await page.evaluate(() => localStorage.getItem('genopro_data_anon1'));
    ok(salvato.includes('Maria Rossi'), 'i dati salvati hanno ancora i nomi veri');

    // 4. PNG valido e nome senza titolo
    await page.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
    await page.hover('[title="Esporta"]'); await page.waitForTimeout(300);
    const [png] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('button:has-text("Scarica PNG")')]);
    const buf = fs.readFileSync(await png.path());
    ok(buf.slice(1, 4).toString() === 'PNG' && buf.length > 5000, `PNG valido (${buf.length} byte)`);
    ok(!png.suggestedFilename().includes('Famiglia') && png.suggestedFilename().startsWith('genogramma_'), `nome PNG senza titolo (${png.suggestedFilename()})`);

    // 5. report PDF: finestra con le iniziali, senza i nomi veri
    await page.hover('[title="Esporta"]'); await page.waitForTimeout(300);
    await page.click('button:has-text("Report Clinico")');
    await page.waitForTimeout(300);
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 10000 }), page.click('button:has-text("Genera PDF")')]);
    await page.waitForTimeout(800);
    const html = await popup.content();
    ok(html.includes('Mari.') && !/Rossi|Maria|Marco|Luca/.test(html), 'report: iniziali e nessun nome vero');
    ok(!html.includes('Famiglia'), 'report: il titolo non compare');
    await popup.close().catch(() => {});

    // 6. la scelta sopravvive al ricaricamento
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=Famiglia Rossi');
    await page.waitForTimeout(800);
    await page.hover('[title="Esporta"]'); await page.waitForTimeout(300);
    ok(await page.isChecked('text=Nomi anonimi (iniziali)'), 'la scelta resta dopo il ricaricamento');
    ok(await page.evaluate(() => localStorage.getItem('genopro_export_anonimo')) === 'true', 'chiave genopro_export_anonimo = true');

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
