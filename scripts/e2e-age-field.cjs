// Campo nascita: un'età digitata al posto della data viene convertita
// nell'anno di nascita, così non resta congelata col passare del tempo.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   npm run dev -- --port 5199 &
//   NODE_PATH=./node_modules node scripts/e2e-age-field.cjs [path-chromium]
const { chromium } = require('playwright-core');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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

    const field = page.locator('input[placeholder^="Nascita"]');
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

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
