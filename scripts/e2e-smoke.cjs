// Smoke test interattivo delle gesture del canvas (Fase 5).
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   npm run dev -- --port 5199 &
//   NODE_PATH=./node_modules node scripts/e2e-smoke.cjs [path-chromium]
const { chromium } = require('playwright-core');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.click('text=Nuovo');
    await page.waitForTimeout(400);

    // 1. Creazione nodo
    await page.click('[title="Nuovo Maschio (M)"]');
    await page.waitForTimeout(200);
    const node = page.locator('svg g.cursor-pointer rect[width="40"]').first();
    ok(await node.count() >= 1, 'nodo creato e visibile');

    // 2. Drag del nodo (+120px a destra)
    const before = await node.boundingBox();
    await page.mouse.move(before.x + 20, before.y + 20);
    await page.mouse.down();
    await page.mouse.move(before.x + 140, before.y + 20, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await node.boundingBox();
    ok(after.x - before.x > 60, `drag nodo funziona (dx=${Math.round(after.x - before.x)})`);

    // 3. Undo riporta il nodo indietro
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const undone = await node.boundingBox();
    ok(Math.abs(undone.x - before.x) < 10, `undo ripristina la posizione (x=${Math.round(undone.x)})`);

    // 4. Zoom con bottoni (+ e -)
    const zoomLabel = page.locator('span.text-xs.w-8');
    const z0 = await zoomLabel.textContent();
    await page.click('button:has(svg.lucide-zoom-in)');
    await page.waitForTimeout(150);
    ok(await zoomLabel.textContent() !== z0, `zoom-in bottone (${z0} → ${await zoomLabel.textContent()})`);

    // 5. Pinch zoom (Ctrl + wheel) — hook usePinchZoom
    const z1 = await zoomLabel.textContent();
    await page.mouse.move(700, 450);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -240);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);
    ok(await zoomLabel.textContent() !== z1, `pinch/ctrl+wheel zoom (${z1} → ${await zoomLabel.textContent()})`);

    // 6. Adatta contenuto (Ctrl+0)
    await page.keyboard.press('Control+0');
    await page.waitForTimeout(400);
    ok(true, 'fit view eseguito senza crash');

    // 7. Spawn rapido con tasto M (useKeyboardShortcuts)
    await page.keyboard.press('Escape');
    const countBefore = await page.locator('svg g.cursor-pointer rect[width="40"]').count();
    await page.mouse.move(500, 400);
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    const countAfter = await page.locator('svg g.cursor-pointer rect[width="40"]').count();
    ok(countAfter === countBefore + 1, `spawn con tasto M (${countBefore} → ${countAfter})`);

    // 8. Box select (useCanvasInteraction): trascina su area vuota includendo un nodo
    await page.keyboard.press('Escape');
    const target = await page.locator('svg g.cursor-pointer rect[width="40"]').last().boundingBox();
    await page.mouse.move(target.x - 80, target.y - 80);
    await page.mouse.down();
    await page.mouse.move(target.x + 120, target.y + 120, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    // La prova che la box-select ha selezionato è che Canc elimina i nodi
    page.once('dialog', d => d.accept());
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    const countFinal = await page.locator('svg g.cursor-pointer rect[width="40"]').count();
    ok(countFinal < countAfter, `box-select + Canc eliminano la selezione (${countAfter} → ${countFinal})`);

    ok(errors.length === 0, `zero errori pagina (${errors.length ? errors[0].slice(0, 80) : 'ok'})`);
    await browser.close();
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
