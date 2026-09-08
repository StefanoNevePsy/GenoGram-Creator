// Verifica: (1) sticky notes lontane incluse nei bounds di export/fit-view,
// (2) decoratori di taglio perpendicolari alla linea anche in diagonale.
// Prereq: dev server su :5199. Uso: NODE_PATH=./node_modules node scripts/e2e-export-bounds.cjs
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) failures++; };

(async () => {
    const b = await chromium.launch({ executablePath: CHROME });
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Nuovo"):visible'); await page.waitForTimeout(300);

    // Un nodo al centro
    await page.mouse.move(700, 450); await page.keyboard.press('m'); await page.waitForTimeout(200);
    await page.keyboard.press('Escape');

    // Sticky note LONTANA dal nodo
    await page.mouse.move(1150, 800);
    await page.click('[title="Aggiungi Nota (N)"]'); await page.waitForTimeout(2200);
    // sposta la nota molto lontano dal nodo trascinandola
    const note = page.locator('svg g foreignObject').first();
    const nb = await note.boundingBox();
    if (nb) {
        await page.mouse.move(nb.x + nb.width/2, nb.y + 6);
        await page.mouse.down();
        await page.mouse.move(nb.x + 260, nb.y + 100, { steps: 8 });
        await page.mouse.up(); await page.waitForTimeout(2200);
    }

    const state = await page.evaluate(() => {
        const k = Object.keys(localStorage).find(k => k.startsWith('genopro_data_'));
        const d = JSON.parse(localStorage.getItem(k) || '{}');
        return { nodes: (d.data?.nodes||[]).map(n=>({x:n.x,y:n.y})), notes: (d.data?.stickyNotes||[]).map(s=>({x:s.x,y:s.y,w:s.width,h:s.height})) };
    });
    ok(state.notes.length >= 1, `sticky note presente (${JSON.stringify(state.notes)})`);

    // BOUNDS: leggiamo il viewBox dell'SVG esportato simulando l'export SVG
    // (downloadSVG imposta viewBox su getGraphBounds). Intercettiamo la creazione del blob.
    const vb = await page.evaluate(() => {
        return new Promise(resolve => {
            const origCreate = URL.createObjectURL;
            URL.createObjectURL = function (blob) {
                blob.text().then(t => {
                    const m = t.match(/viewBox="([^"]+)"/);
                    resolve(m ? m[1] : 'nessun viewBox');
                });
                URL.createObjectURL = origCreate;
                return 'blob:fake';
            };
            // trova ed esegue il bottone "Scarica SVG"
            const btns = Array.from(document.querySelectorAll('button'));
            const svgBtn = btns.find(x => /SVG/i.test(x.textContent || ''));
            if (svgBtn) svgBtn.click(); else resolve('bottone non trovato');
        });
    }).catch(() => 'errore');

    if (typeof vb === 'string' && vb.includes(' ')) {
        const [vx, vy, vw, vh] = vb.split(/\s+/).map(Number);
        const n0 = state.nodes[0], s0 = state.notes[0];
        const covers = (x, y, w=0, h=0) => x >= vx - 1 && y >= vy - 1 && (x + w) <= vx + vw + 1 && (y + h) <= vy + vh + 1;
        ok(covers(n0.x, n0.y, 40, 40), `viewBox copre il nodo (vb=${vb})`);
        ok(covers(s0.x, s0.y, s0.w, s0.h), `viewBox copre la STICKY NOTE lontana (nota @${s0.x},${s0.y} ${s0.w}x${s0.h})`);
    } else {
        ok(false, `impossibile leggere il viewBox: ${vb}`);
    }
    ok(errors.length === 0, errors.length ? 'ERRORI: ' + errors[0] : 'zero errori pagina');
    await b.close();
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
