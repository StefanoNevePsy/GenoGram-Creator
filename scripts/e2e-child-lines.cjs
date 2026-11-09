// Connettori genitore-figlio: stile della relazione sulla discesa, barra dei
// fratelli neutra, e un solo connettore per figlio anche quando i genitori
// sono due.
// Prerequisiti: app in dev su :5199 e Chromium Playwright.
//   npm run dev -- --port 5199 &
//   NODE_PATH=./node_modules node scripts/e2e-child-lines.cjs [path-chromium]
const { chromium } = require('playwright-core');

const CHROME = process.argv[2] || process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures++; };

const C = 4000;
const N = (id, g, x, y, name) => ({
    id, x, y, gender: g, name, birthDate: '', deceased: false, indexPerson: false,
    substanceAbuse: false, mentalIssue: false, physicalIssue: false, recovery: false, gayLesbian: false, notes: [],
});
const E = (id, f, t, type) => ({ id, fromId: f, toId: t, type, label: '', notes: [] });

// "Adottata" ha un genitore biologico e uno adottivo: è quel che si ottiene
// cambiando il tipo da un lato solo, ed è il caso in cui la linea continua
// copriva quella punteggiata.
const DATA = {
    id: 'lines1', title: 'LineeFigli', category: 'family', lastModified: Date.now(),
    data: {
        nodes: [N('p', 'M', C - 120, C - 200, 'Padre'), N('m', 'F', C + 80, C - 200, 'Madre'),
        N('c1', 'M', C - 140, C + 40, 'Bio'), N('c2', 'F', C + 20, C + 40, 'Adottata'), N('c3', 'M', C + 180, C + 40, 'Affido')],
        edges: [E('e0', 'p', 'm', 'marriage'),
        E('e1', 'p', 'c1', 'child-bio'), E('e2', 'm', 'c1', 'child-bio'),
        E('e3', 'p', 'c2', 'child-bio'), E('e4', 'm', 'c2', 'child-adopted'),
        E('e5', 'p', 'c3', 'child-foster'), E('e6', 'm', 'c3', 'child-foster')],
        groups: [], stickyNotes: [], structuralMaps: [], presets: [],
    },
};

const readEdges = page => page.evaluate(() => {
    const k = Object.keys(localStorage).filter(x => x.startsWith('genopro_data_'));
    const d = JSON.parse(localStorage.getItem(k[k.length - 1])).data;
    return d.edges.map(e => ({ id: e.id, type: e.type }));
});

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(d => {
        localStorage.setItem('genopro_local_index', JSON.stringify([{ id: d.id, title: d.title, category: d.category, lastModified: d.lastModified }]));
        localStorage.setItem('genopro_data_' + d.id, JSON.stringify(d));
    }, DATA);
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('text=LineeFigli');
    await page.waitForTimeout(800);

    const drawn = () => page.evaluate(() => [...document.querySelectorAll('svg path')]
        .filter(p => p.getAttribute('stroke') && p.getAttribute('stroke') !== 'transparent')
        .map(p => ({ d: p.getAttribute('d') || '', stroke: p.getAttribute('stroke'), dash: p.getAttribute('stroke-dasharray') })));

    const paths = await drawn();
    const drops = paths.filter(p => /^M \d+ 3860 L \d+ 4060$/.test(p.d));
    ok(drops.length === 3, `una sola discesa per figlio, non una per genitore (${drops.length})`);

    const adopted = drops.find(p => p.d.startsWith('M 4040'));
    ok(!!adopted && adopted.dash === '2,2', `l'adozione è punteggiata senza doverla selezionare (${adopted && adopted.dash})`);
    ok(!!adopted && adopted.stroke === '#0000FF', `e conserva il colore dell'adozione (${adopted && adopted.stroke})`);

    const foster = drops.find(p => p.d.startsWith('M 4200'));
    ok(!!foster && foster.dash === '8,4', `l'affido resta tratteggiato (${foster && foster.dash})`);
    const bio = drops.find(p => p.d.startsWith('M 3880'));
    ok(!!bio && (bio.dash === '0' || !bio.dash), `il figlio biologico resta continuo (${bio && bio.dash})`);

    // la barra dei fratelli è struttura: nessun figlio deve imporle il proprio stile
    const bars = paths.filter(p => /^M 4000 3860 L \d+ 3860$/.test(p.d));
    ok(bars.length === 3 && bars.every(b => !b.dash || b.dash === '0'),
        `il tratto lungo la barra dei fratelli resta continuo per tutti (${bars.map(b => b.dash).join('/')})`);

    // --- il connettore vale per entrambi gli archi ---
    await page.evaluate(() => {
        const p = [...document.querySelectorAll('svg path')].find(x => (x.getAttribute('d') || '').startsWith('M 4040 3860 L 4040 4060'));
        p.parentElement.closest('g[class]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    ok(await page.locator('text=Tipo Relazione').count() > 0, 'il click sulla linea apre il pannello della relazione');

    // cambiare tipo deve agire su tutti e due gli archi, non solo sul disegnato
    await page.click('button[aria-expanded]:has-text("Figlio Biologico")');
    await page.waitForTimeout(300);
    await page.click('[title="Affido"]');
    await page.waitForTimeout(2200);   // l'autosalvataggio è ritardato di 1.5s

    let eds = await readEdges(page);
    const c2 = eds.filter(e => ['e3', 'e4'].includes(e.id));
    ok(c2.every(e => e.type === 'child-foster'),
        `il tipo cambia su entrambi gli archi della relazione (${c2.map(e => e.type).join(',')})`);

    // e cancellarla deve toglierli tutti e due: un arco invisibile e orfano
    // riapparirebbe come linea senza spiegazione
    await page.click('button:has-text("Elimina Relazione")');
    await page.waitForTimeout(2200);
    eds = await readEdges(page);
    ok(!eds.some(e => ['e3', 'e4'].includes(e.id)), `l'eliminazione toglie entrambi gli archi (${eds.length} archi rimasti)`);

    ok(errors.length === 0, 'nessun errore JavaScript: ' + errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? '\nTUTTO OK' : `\n${failures} FALLITI`);
    process.exit(failures === 0 ? 0 : 1);
})();
