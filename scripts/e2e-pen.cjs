// Test interattivo maniglie-relazione + tasto destro + S-Pen (barrel, evento nativo, rifiuto del palmo).
// Prerequisiti: dev server su :5199. Uso: NODE_PATH=./node_modules node scripts/e2e-pen.cjs
const { chromium } = require('playwright-core');
(async () => {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const ok = (c, m) => console.log((c ? 'PASS' : 'FAIL') + ' ' + m);

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Nuovo"):visible');
    await page.waitForTimeout(400);

    // Setup: un nodo maschio selezionato (le maniglie appaiono su selezione)
    await page.click('[title="Nuovo Maschio (M)"]');
    await page.waitForTimeout(300);
    const node = await page.locator('svg g.cursor-pointer rect[width="40"]').first().boundingBox();

    // 1. MANIGLIA SPOUSE → drop su spazio vuoto = crea partner + matrimonio
    // La maniglia spouse è il cerchietto a destra del nodo (translate(w+20, r))
    const hx = node.x + node.width + 20, hy = node.y + node.height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx + 150, hy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const nodesAfterSpouse = await page.locator('svg g.cursor-pointer').count();
    ok(nodesAfterSpouse >= 2, `maniglia spouse su vuoto crea il partner (${nodesAfterSpouse} nodi)`);
    // linea matrimonio: path con barra sotto i nodi
    ok(await page.locator('svg path[stroke-width="2"]').count() >= 1, 'linea di relazione disegnata');

    // 2. MANIGLIA CHILD → drop su vuoto = crea figlio
    await page.locator('svg g.cursor-pointer rect[width="40"]').first().click({ force: true });
    await page.waitForTimeout(200);
    const n2 = await page.locator('svg g.cursor-pointer rect[width="40"]').first().boundingBox();
    await page.mouse.move(n2.x + n2.width / 2, n2.y + n2.height + 20);
    await page.mouse.down();
    await page.mouse.move(n2.x + n2.width / 2, n2.y + 160, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const nodesAfterChild = await page.locator('svg g.cursor-pointer').count();
    ok(nodesAfterChild > nodesAfterSpouse, `maniglia child su vuoto crea il figlio (${nodesAfterChild} nodi)`);

    // 4. TASTO DESTRO sul canvas → menu contestuale, NIENTE box select
    await page.mouse.move(300, 750);
    await page.mouse.click(300, 750, { button: 'right' });
    await page.waitForTimeout(300);
    const ctxMenu = await page.locator('div.fixed:has-text("Aggiungi")').count();
    ok(ctxMenu >= 1, `tasto destro apre il menu contestuale (${ctxMenu} voci trovate)`);
    // nessuna box select fantasma attiva: muovi il mouse e verifica niente rettangolo di selezione
    await page.mouse.move(900, 700);
    await page.waitForTimeout(150);
    ok(await page.locator('svg rect[stroke-dasharray="4"]').count() === 0, 'nessuna box-select fantasma dopo tasto destro');
    await page.keyboard.press('Escape');
    await page.mouse.click(400, 300); // chiudi menu
    await page.waitForTimeout(200);

    // 5. POINTERDOWN pointerType=pen con barrel (buttons=2) → menu, niente drag
    await page.locator('svg[width="8000"]').dispatchEvent('pointerdown', { pointerType: 'pen', button: 2, buttons: 2, clientX: 750, clientY: 500, isPrimary: true, pointerId: 9, bubbles: true });
    await page.waitForTimeout(300);
    const penMenu = await page.locator('div.fixed:has-text("Aggiungi")').count();
    ok(penMenu >= 1, `barrel S-Pen (web) apre il menu contestuale (${penMenu})`);
    await page.keyboard.press('Escape');
    await page.mouse.click(400, 300);
    await page.waitForTimeout(200);

    // 6. EVENTO NATIVO sPenNativeEvent (percorso Android/Java) → menu alla posizione cursore
    await page.mouse.move(800, 450); // aggiorna cursorRef via pointermove
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sPenNativeEvent', { detail: '{"action":"down"}' })));
    await page.waitForTimeout(300);
    const nativeMenu = await page.locator('div.fixed:has-text("Aggiungi")').count();
    ok(nativeMenu >= 1, `evento nativo S-Pen apre il menu (cursorRef via pointermove) (${nativeMenu})`);

    // 7. EVENTO NATIVO con coordinate (come lo manda MainActivity.java): il menu
    // compare nel punto della penna, non nell'ultima posizione del puntatore
    await page.keyboard.press('Escape');
    await page.mouse.click(400, 300);
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const ev = document.createEvent('Events'); ev.initEvent('sPenNativeEvent', false, false);
        Object.assign(ev, { action: 'down', x: 1000, y: 600 }); window.dispatchEvent(ev);
    });
    await page.waitForTimeout(300);
    const box = await page.locator('div.fixed:has-text("Aggiungi")').first().boundingBox();
    ok(box && Math.abs(box.x - (1000 - 75)) < 4 && Math.abs(box.y - (600 - 100)) < 4, `evento nativo con x/y: menu nel punto della penna (${box && Math.round(box.x)},${box && Math.round(box.y)})`);
    await page.keyboard.press('Escape');
    await page.mouse.click(400, 300);
    await page.waitForTimeout(200);

    // 8. RIFIUTO DEL PALMO: subito dopo la penna, un tocco del dito sul disegno
    // non parte (niente pan); passato un attimo, il dito torna a funzionare
    const svgSel = 'svg[width="8000"]';
    await page.locator(svgSel).dispatchEvent('pointermove', { pointerType: 'pen', clientX: 700, clientY: 400, pointerId: 21, bubbles: true });
    const palmo = await page.evaluate(() => {
        const svg = document.querySelector('svg[width="8000"]');
        let arrivato = false;
        const spia = () => { arrivato = true; };
        svg.addEventListener('pointerdown', spia);
        svg.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 600, clientY: 500, pointerId: 22, isPrimary: true, bubbles: true }));
        svg.removeEventListener('pointerdown', spia);
        return arrivato;
    });
    ok(!palmo, 'palmo vicino alla penna: il tocco sul disegno viene ignorato');
    await page.waitForTimeout(800);
    const dito = await page.evaluate(() => {
        const svg = document.querySelector('svg[width="8000"]');
        let arrivato = false;
        const spia = () => { arrivato = true; };
        svg.addEventListener('pointerdown', spia);
        svg.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 600, clientY: 500, pointerId: 23, isPrimary: true, bubbles: true }));
        svg.removeEventListener('pointerdown', spia);
        svg.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', clientX: 600, clientY: 500, pointerId: 23, isPrimary: true, bubbles: true }));
        return arrivato;
    });
    ok(dito, 'lontano dalla penna il dito funziona di nuovo');

    ok(errors.length === 0, `zero errori pagina (${errors.length ? errors[0].slice(0, 90) : 'ok'})`);
    await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
