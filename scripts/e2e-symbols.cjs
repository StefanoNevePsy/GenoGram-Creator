// Verifica che ogni renderType nuovo/corretto produca il proprio decoratore.
// Stato iniettato per determinismo. Prereq: dev server su :5199.
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) failures++; };
const mkNode = (id, x, y, g) => ({ id, x, y, gender: g, name: id, birthDate: '', deceased: false, indexPerson: false, substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [] });

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

  const TYPES = ['in-love','twin-monozygotic','civil-union','ambivalent','parentified','confidant','annulment','rivalry','stalking','therapeutic'];
  await page.evaluate(([mk, types]) => {
    const N = eval('(' + mk + ')'); const C = 4000;
    const nodes = [], edges = [];
    types.forEach((t, i) => {
      const y = C + i * 120;
      nodes.push(N('a' + i, C, y, 'M'), N('b' + i, C + 320, y, 'F'));
      edges.push({ id: 'e' + i, fromId: 'a' + i, toId: 'b' + i, type: t, label: '', notes: [] });
    });
    const data = { id: 'symgen', title: 'symbols', category: 'family', lastModified: Date.now(),
      data: { nodes, edges, groups: [], stickyNotes: [], presets: [], structuralMaps: [] } };
    localStorage.setItem('genopro_data_symgen', JSON.stringify(data));
    localStorage.setItem('genopro_local_index', JSON.stringify([{ id: 'symgen', title: 'symbols', category: 'family', lastModified: Date.now() }]));
  }, [mkNode.toString(), TYPES]);

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.click('text=symbols'); await page.waitForTimeout(900);

  // Ogni edge <g> deve contenere, oltre ai 2 path della linea, almeno un elemento decoratore
  const res = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('svg g > g').forEach(g => {
      const paths = g.querySelectorAll(':scope > path').length;
      const deco = g.querySelectorAll('circle, polygon, line, path[stroke="#dc2626"]').length;
      if (paths >= 2) out.push({ paths, deco });
    });
    return out;
  });
  const withDeco = res.filter(r => r.deco > 0).length;
  ok(res.length >= 10, `10 relazioni renderizzate (${res.length})`);
  ok(withDeco >= 10, `tutte hanno un decoratore visibile (${withDeco}/${res.length})`);
  // controlli mirati sui due bug corretti
  ok(await page.locator('svg circle[r="6"]').count() >= 2, 'in-love: due anelli intrecciati resi');
  ok(await page.locator('svg line[stroke-width="2.5"]').count() >= 1, 'twin-monozygotic / unione civile: barre perpendicolari rese');
  ok(await page.locator('svg polygon[points="-7,-6 7,-6 0,7"]').count() >= 1, 'parentified: triangolo centrale reso');
  ok(await page.locator('svg circle[r="5"]').count() >= 1, 'dot-center reso (confidente/terapeutico)');
  ok(errors.length === 0, errors.length ? 'ERRORI: ' + errors[0] : 'zero errori pagina');
  await page.screenshot({ path: (process.env.SP || '/tmp') + '/simboli.png' });
  await b.close();
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
