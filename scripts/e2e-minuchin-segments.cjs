// Test segmentazione confini mappe Minuchin. Prereq: preview/dev su :5177.
// Uso: NODE_PATH=./node_modules node scripts/e2e-minuchin-segments.cjs
const { chromium } = require('playwright-core');
(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const ok=(c,m)=>console.log((c?'PASS':'FAIL')+' '+m);
    await page.goto('http://localhost:5177/', { waitUntil: 'networkidle' });
    await page.click('text=Nuovo'); await page.waitForTimeout(300);
    await page.click('[title="Mappe Strutturali (Minuchin)"]');
    await page.click('text=Nuova minimale'); await page.waitForTimeout(300);
    const svg = page.locator('svg[viewBox="0 0 560 400"]');
    // click in coordinate viewBox → CSS reali
    const clickVB = async (vx, vy) => { const bb = await svg.boundingBox(); await page.mouse.click(bb.x + vx/560*bb.width, bb.y + vy/400*bb.height); await page.waitForTimeout(200); };
    // solo segmenti ORIZZONTALI: y1==y2 (linea orizzontale visibile), stroke non trasparente
    const hsegs = async () => svg.evaluate(el => Array.from(el.querySelectorAll('line')).filter(l=>l.getAttribute('stroke')!=='transparent' && l.getAttribute('y1')===l.getAttribute('y2') && Math.abs(+l.getAttribute('y1')-200)<1).map(l=>`${l.getAttribute('x1')}-${l.getAttribute('x2')}:${l.getAttribute('stroke-dasharray')||'solid'}`).sort());
    await page.click('button[title="Confine verticale"]'); await page.waitForTimeout(300);
    const B = await hsegs(); console.log('segmenti orizzontali:', JSON.stringify(B));
    ok(B.length===2 && B.includes('10-280:12,7') && B.includes('280-550:12,7'), 'orizzontale spezzata in ESATTAMENTE 2 segmenti (10-280, 280-550)');
    // click segmento sinistro (viewBox ~145,200) 2 volte → rigido (solid)
    await clickVB(145,200); await clickVB(145,200);
    const C = await hsegs(); console.log('dopo 2 click sx:', JSON.stringify(C));
    ok(C.includes('10-280:solid') && C.includes('280-550:12,7'), 'segmento SX rigido (solid), DX resta diffuso (12,7) — stili indipendenti');
    // spegni segmento destro (viewBox ~415,200): clear->diffuse->rigid->none = 3 click
    await clickVB(415,200); await clickVB(415,200); await clickVB(415,200);
    const D = await hsegs(); console.log('dopo spegnimento dx:', JSON.stringify(D));
    ok(!D.some(x=>x.startsWith('280-550')), 'segmento DX spento → confine accorciato (nessun tratto 280-550)');
    ok(D.includes('10-280:solid'), 'il segmento SX rigido resta invariato');
    await page.screenshot({ path: process.env.SP + '/segmenti.png' });
    ok(errors.length===0, 'zero errori pagina');
    await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
