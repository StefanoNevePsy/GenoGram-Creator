// Test relazioni con gruppi: nodo→gruppo, gruppo→nodo, gruppo→gruppo,
// maniglia ancora scorrevole sul perimetro. Scenari ISOLATI (reload ciascuno).
// Prereq: dev server su :5199. Uso: NODE_PATH=./node_modules node scripts/e2e-groups.cjs
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) failures++; };

(async () => {
    const b = await chromium.launch({ executablePath: CHROME });
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));

    const dump = () => page.evaluate(() => {
        const k = Object.keys(localStorage).find(k => k.startsWith('genopro_data_'));
        const d = JSON.parse(localStorage.getItem(k) || '{}');
        return { edges: (d.data?.edges || []).map(e => ({ f: e.fromId, t: e.toId, fa: e.fromAnchor, ta: e.toAnchor })), groups: (d.data?.groups || []).map(g => g.id) };
    });
    const fresh = async () => {
        await page.evaluate(() => localStorage.clear());
        await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
        await page.click('button:has-text("Nuovo"):visible'); await page.waitForTimeout(300);
    };
    const makeGroup = async (x1, y1, x2, y2) => {
        await page.mouse.move(x1, y1); await page.keyboard.press('m'); await page.waitForTimeout(120);
        await page.keyboard.press('Escape'); // il nodo spawnnato resta selezionato e bloccherebbe lo spawn successivo
        await page.mouse.move(x2, y2); await page.keyboard.press('f'); await page.waitForTimeout(120);
        await page.keyboard.press('Escape');
        await page.mouse.move(x1 - 90, y1 - 90); await page.mouse.down();
        await page.mouse.move(x2 + 90, y2 + 90, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(150);
        await page.click('button[title="Gruppo"]'); await page.waitForTimeout(250);
        await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    };
    const blob = (i) => page.locator('svg path[stroke-dasharray="10,5"]').nth(i);
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

    // === 1. NODO → GRUPPO ===
    await fresh();
    await makeGroup(420, 300, 540, 300);
    await page.mouse.move(1000, 250); await page.keyboard.press('m'); await page.waitForTimeout(200);
    const ext = await page.locator('svg g.cursor-pointer rect[width="40"]').last().boundingBox();
    const gA = await blob(0).boundingBox();
    await page.mouse.click(ext.x + 20, ext.y + 20); await page.waitForTimeout(250);
    await page.mouse.move(ext.x - 20, ext.y + 20); await page.mouse.down();
    await page.mouse.move(gA.x + gA.width / 2, gA.y + gA.height - 4, { steps: 8 });
    await page.mouse.up(); await page.waitForTimeout(1800);
    let d = await dump();
    ok(d.edges.length === 1 && d.groups.includes(d.edges[0].t), `NODO→GRUPPO (${JSON.stringify(d.edges)} G=${JSON.stringify(d.groups)})`);

    // === 2. GRUPPO → NODO (maniglia gialla, ora fuori dal blob) ===
    await fresh();
    await makeGroup(420, 300, 540, 300);
    await page.mouse.move(1000, 250); await page.keyboard.press('m'); await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    const ext2 = await page.locator('svg g.cursor-pointer rect[width="40"]').last().boundingBox();
    const selectBlob = async (i) => { const bb = await blob(i).boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height - 3); await page.waitForTimeout(300); };
    await selectBlob(0);
    const y2 = await page.locator('svg rect[fill="#f59e0b"]').first().boundingBox();
    await page.mouse.move(y2.x + 10, y2.y + 10); await page.mouse.down();
    await page.mouse.move(ext2.x + 20, ext2.y + 20, { steps: 8 });
    await page.mouse.up(); await page.waitForTimeout(1800);
    d = await dump();
    ok(d.edges.length === 1 && d.groups.includes(d.edges[0].f), `GRUPPO→NODO (${JSON.stringify(d.edges)} G=${JSON.stringify(d.groups)})`);

    // === 3. GRUPPO → GRUPPO ===
    await fresh();
    await makeGroup(380, 280, 500, 280);
    await makeGroup(850, 600, 970, 600);
    const gB = await blob(1).boundingBox();
    const bbA = await blob(0).boundingBox();
    await page.mouse.click(bbA.x + bbA.width / 2, bbA.y + bbA.height - 3); await page.waitForTimeout(300);
    const y3 = await page.locator('svg rect[fill="#f59e0b"]').first().boundingBox();
    await page.mouse.move(y3.x + 10, y3.y + 10); await page.mouse.down();
    await page.mouse.move(gB.x + gB.width / 2, gB.y + gB.height - 4, { steps: 10 });
    await page.mouse.up(); await page.waitForTimeout(1800);
    d = await dump();
    ok(d.edges.length === 1 && d.groups.includes(d.edges[0].f) && d.groups.includes(d.edges[0].t), `GRUPPO→GRUPPO (${JSON.stringify(d.edges)} G=${JSON.stringify(d.groups)})`);

    // === 4. MANIGLIA ANCORA (edge auto-selezionata dopo il drop 3) ===
    const handles = page.locator('svg g.cursor-move circle[r="9"]');
    const hc = await handles.count();
    ok(hc === 2, `2 maniglie ancora visibili (${hc})`);
    if (hc === 2) {
        const gA3 = await blob(0).boundingBox();
        const hb = await handles.first().boundingBox();
        await page.mouse.move(hb.x + 9, hb.y + 9); await page.mouse.down();
        await page.mouse.move(gA3.x + gA3.width / 2, gA3.y + 2, { steps: 10 });
        await page.mouse.up(); await page.waitForTimeout(1800);
        d = await dump();
        const e0 = d.edges[0];
        ok(e0 && (e0.fa !== undefined || e0.ta !== undefined), `ancora scorrevole salvata (fa=${e0?.fa}, ta=${e0?.ta})`);
    }
    ok(errors.length === 0, errors.length ? 'ERRORI: ' + errors.slice(0, 3).join('|') : 'zero errori pagina');
    await b.close();
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
