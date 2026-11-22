// Campo nascita: un'età digitata al posto della data viene convertita
// nell'anno di nascita, così non resta congelata col passare del tempo.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   npm run dev -- --port 5199 &
//   NODE_PATH=./node_modules node scripts/e2e-age-field.cjs [path-chromium]
const { chromium } = require('playwright-core');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1300, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Nuovo"):visible');
    await page.waitForTimeout(400);
    await page.click('[title="Nuovo Maschio (M)"]');
    await page.waitForTimeout(400);

    const field = page.locator('label:has(span:text-is("Nascita")) input');
    ok(await field.count() === 1, 'il campo nascita è nel pannello della persona');

    const anno = new Date().getFullYear();

    await field.fill('45');
    await field.blur();
    await page.waitForTimeout(300);
    const conv = await field.inputValue();
    ok(conv === String(anno - 45), `l'età digitata diventa l'anno di nascita (${conv}, atteso ${anno - 45})`);

    const mostrata = await page.locator('text=/^Età: /').first().innerText();
    ok(mostrata.includes('45'), `l'età mostrata resta quella digitata (${mostrata})`);

    // una data vera non va toccata
    await field.fill('12/05/1981');
    await field.blur();
    await page.waitForTimeout(300);
    ok(await field.inputValue() === '12/05/1981', 'una data completa resta com\'è');

    // e nemmeno un anno
    await field.fill('1981');
    await field.blur();
    await page.waitForTimeout(300);
    ok(await field.inputValue() === '1981', 'un anno resta com\'è');

    // I gesti VERI con cui si finisce di scrivere. Il controllo qui sopra
    // toglie il fuoco via codice, cosa che nessuno fa: per questo non vedeva
    // che cliccando sul disegno, su un'altra persona o premendo Esc il pannello
    // si chiudeva senza conversione, e "45" restava salvato così com'era.
    const salvato = () => page.evaluate(() => {
        const k = Object.keys(localStorage).find(x => x.startsWith('genopro_data_'));
        return k ? JSON.parse(localStorage.getItem(k)).data.nodes.map(n => n.birthDate) : [];
    });
    const gesti = {
        'clic sul disegno vuoto': () => page.mouse.click(300, 760),
        'clic su un\'altra persona': async () => { const b = await page.locator('svg g.cursor-pointer rect[width="40"]').first().boundingBox(); await page.mouse.click(b.x + 20, b.y + 20); },
        'Esc': () => page.keyboard.press('Escape'),
        'Invio': () => page.keyboard.press('Enter'),
    };
    for (const [nome, gesto] of Object.entries(gesti)) {
        // due persone: la seconda (cerchio) è quella che si modifica
        await page.evaluate(() => localStorage.clear());
        await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
        await page.click('button:has-text("Nuovo"):visible'); await page.waitForTimeout(300);
        await page.mouse.move(500, 400); await page.keyboard.press('m'); await page.waitForTimeout(150); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
        await page.mouse.move(700, 400); await page.keyboard.press('f'); await page.waitForTimeout(150); await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        await field.click(); await field.fill('45');
        await gesto();
        await page.waitForTimeout(2300);   // autosalvataggio
        const valori = await salvato();
        ok(valori.includes(String(anno - 45)) && !valori.includes('45'), `${nome}: l'età salvata è diventata l'anno (${JSON.stringify(valori)})`);
    }

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
