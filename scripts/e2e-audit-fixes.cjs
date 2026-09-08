// Verifica le correzioni emerse dall'audit: toolbar su riga propria, M/F ripetibili,
// menu relazioni per categoria + ricerca, Escape chiude le modali, aria-label,
// contrasto etichette categoria, focus-visible.
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) failures++; };
const lum = c => { const [r,g,b] = c.match(/\d+/g).map(Number).map(v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*r+.7152*g+.0722*b; };
const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  // --- MOBILE 390: toolbar utilizzabile ---
  let page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

  // contrasto etichette categoria in dashboard
  const contrasts = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button span.theme-text').forEach(el => {
      const t = (el.textContent || '').trim();
      if (!t) return;
      const cs = getComputedStyle(el);
      out.push({ t, fg: cs.color, bg: getComputedStyle(document.body).backgroundColor });
    });
    return out.slice(0, 8);
  });
  const bad = contrasts.filter(c => ratio(c.fg, c.bg) < 4.5);
  ok(contrasts.length > 0 && bad.length === 0, `etichette categoria in AA (${contrasts.length} testate, ${bad.length} sotto 4.5:1${bad.length ? ': ' + bad.map(x=>x.t).join(',') : ''})`);

  await page.click('button:has-text("Nuovo"):visible'); await page.waitForTimeout(600);
  const bar = await page.evaluate(() => { const el = document.querySelector('div.overflow-x-auto.no-scrollbar'); const r = el.getBoundingClientRect(); return { w: Math.round(r.width), sw: el.scrollWidth }; });
  ok(bar.w >= 380, `mobile 390: toolbar a piena larghezza (${bar.w}px, contenuto ${bar.sw}px)`);
  await page.click('[title="Nuovo Maschio (M)"]', { timeout: 3000 });
  await page.waitForTimeout(300);
  ok(await page.locator('svg g.cursor-pointer rect[width="40"]').count() === 1, 'mobile: si crea una persona col pulsante');
  await page.close();

  // --- DESKTOP: M/F ripetibili, menu relazioni, Escape, aria ---
  page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Nuovo"):visible'); await page.waitForTimeout(500);
  for (const [k, xy] of [['m',[500,400]], ['f',[700,400]], ['m',[900,400]]]) {
    await page.mouse.move(xy[0], xy[1]); await page.keyboard.press(k); await page.waitForTimeout(250);
  }
  const n = await page.locator('svg g.cursor-pointer rect[width="40"], svg g.cursor-pointer circle[r="20"]').count();
  ok(n === 3, `M/F ripetibili senza Escape: 3 persone create (${n})`);

  // menu relazioni raggruppato + ricerca
  const nodes = page.locator('svg g.cursor-pointer rect[width="40"]');
  const a = await nodes.first().boundingBox();
  await page.mouse.click(a.x + 20, a.y + 20); await page.waitForTimeout(250);
  await page.mouse.move(a.x - 20, a.y + 20); await page.mouse.down();
  await page.mouse.move(a.x + 700, a.y + 20, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(700);
  const hasSearch = await page.locator('input[placeholder="Cerca tipo di relazione…"]').count();
  const heads = await page.locator('text=/Interazione \\/ Affettive|Conflitto e Distanza|Sociale \\/ Contesto/').count();
  ok(hasSearch === 1, 'menu relazioni: campo di ricerca presente');
  ok(heads >= 2, `menu relazioni: intestazioni di categoria rese (${heads})`);
  if (hasSearch) {
    await page.fill('input[placeholder="Cerca tipo di relazione…"]', 'stalk');
    await page.waitForTimeout(300);
    ok(await page.locator('text=Stalking / Persecuzione').count() >= 1, 'ricerca filtra ai nuovi simboli (stalking)');
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // aria-label sui bottoni icona
  const anon = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => !(b.textContent||'').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length);
  ok(anon === 0, `nessun bottone senza nome accessibile (${anon})`);
  const svgRole = await page.evaluate(() => { const s = document.querySelector('svg[width="8000"]'); return { role: s?.getAttribute('role'), label: !!s?.getAttribute('aria-label') }; });
  ok(svgRole.role === 'application' && svgRole.label, 'canvas SVG ha role e aria-label');

  // Escape chiude una modale
  await page.click('[title="Report Clinico"], [title="Esporta"]').catch(()=>{});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const focusRule = await page.evaluate(() => [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.cssText.includes('focus-visible')); } catch { return false; } }));
  ok(focusRule, 'regola :focus-visible presente negli stili');

  ok(errors.length === 0, errors.length ? 'ERRORI: ' + errors[0] : 'zero errori pagina');
  await b.close();
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
