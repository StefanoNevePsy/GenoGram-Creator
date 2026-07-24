// Verifica che i decoratori di taglio (cutoff, oblique, x-cross...) restino
// PERPENDICOLARI alla linea anche su relazioni diagonali.
// Stato iniettato in localStorage per determinismo.
// Prereq: dev server su :5199. Uso: NODE_PATH=./node_modules node scripts/e2e-decorator-angle.cjs
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) failures++; };

const mkNode = (id, x, y, gender) => ({ id, x, y, gender, name: id, birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] });

(async () => {
    const b = await chromium.launch({ executablePath: CHROME });
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

    // Genogramma con relazioni 'cutoff': una ORIZZONTALE e una DIAGONALE a 45°
    await page.evaluate(([mk]) => {
        const N = eval('(' + mk + ')');
        const C = 4000;
        const data = {
            id: 'testgen', title: 'test', category: 'family', lastModified: Date.now(),
            data: {
                nodes: [N('A', C, C, 'M'), N('B', C + 300, C, 'F'), N('C', C, C + 300, 'M'), N('D', C + 300, C + 300, 'F')],
                edges: [
                    { id: 'e-horiz', fromId: 'A', toId: 'B', type: 'cutoff', label: '', notes: [] },
                    { id: 'e-diag', fromId: 'C', toId: 'B', type: 'cutoff', label: '', notes: [] },
                ],
                groups: [], stickyNotes: [], presets: [], structuralMaps: []
            }
        };
        localStorage.setItem('genopro_data_testgen', JSON.stringify(data));
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: 'testgen', title: 'test', category: 'family', lastModified: Date.now() }]));
    }, [mkNode.toString()]);

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.click('text=test'); await page.waitForTimeout(800);

    // Estrai i transform dei decoratori cutoff (gruppi che contengono una line spessa 3)
    const rots = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('svg g[transform]').forEach(g => {
            const t = g.getAttribute('transform') || '';
            if (!t.includes('rotate')) return;
            const ln = g.querySelector(':scope > line[stroke-width="3"]');
            if (ln) { const m = t.match(/rotate\(([-\d.]+)\)/); if (m) out.push(parseFloat(m[1])); }
        });
        return out;
    });
    console.log('   rotazioni decoratori cutoff:', JSON.stringify(rots));
    ok(rots.length === 2, `due decoratori cutoff renderizzati (${rots.length})`);
    const near = (v, t) => Math.abs(((v - t + 540) % 360) - 180) < 3;
    ok(rots.some(r => near(r, 0)), `relazione ORIZZONTALE: decoratore a 0° (${rots.join(', ')})`);
    ok(rots.some(r => near(r, -45) || near(r, 315)), `relazione DIAGONALE: decoratore ruotato a -45° → perpendicolare (${rots.join(', ')})`);
    ok(errors.length === 0, errors.length ? 'ERRORI: ' + errors[0] : 'zero errori pagina');
    await page.screenshot({ path: (process.env.SP || '/tmp') + '/perp.png' });
    await b.close();
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
