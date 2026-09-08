// Vista a elenco accessibile, annunci live, empty state, target touch, sezioni pannello.
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + m); if (!c) failures++; };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

  // 1. Empty state guidato (primo avvio, non "nessun risultato")
  ok(await page.locator('text=Crea il tuo primo genogramma').count() === 1, 'dashboard vuota: empty state guidato con CTA');

  await page.click('button:has-text("Nuovo"):visible'); await page.waitForTimeout(600);
  // 2. Hint sul canvas vuoto
  ok(await page.locator('svg text:has-text("Inizia il genogramma")').count() === 1, 'canvas vuoto: suggerimento su come iniziare');

  // Crea due persone
  await page.mouse.move(600, 420); await page.keyboard.press('m'); await page.waitForTimeout(250);
  await page.mouse.move(900, 420); await page.keyboard.press('f'); await page.waitForTimeout(250);
  ok(await page.locator('svg text:has-text("Inizia il genogramma")').count() === 0, 'il suggerimento sparisce alla prima persona');

  // 3. Vista a elenco
  await page.click('[title="Elenco persone (accessibile da tastiera)"]'); await page.waitForTimeout(400);
  const aside = page.locator('aside[aria-label="Elenco persone del genogramma"]');
  ok(await aside.count() === 1, 'pannello elenco persone aperto');
  const opts = page.locator('button[data-person]');
  ok(await opts.count() === 2, `elenco mostra le 2 persone (${await opts.count()})`);
  const label = await opts.first().getAttribute('aria-label');
  ok(!!label && /maschio|femmina/.test(label), `ogni voce ha descrizione parlata ("${label}")`);

  // 4. Selezione da elenco + annuncio live
  await opts.first().click(); await page.waitForTimeout(600);
  const live = await page.locator('[role="status"]').textContent();
  ok(!!live && live.includes('Selezionata'), `regione live annuncia la selezione ("${(live||'').slice(0,45)}…")`);
  ok(await page.locator('button:has-text("Elimina Persona")').count() === 1, 'selezione dall\'elenco apre il pannello proprietà');
  ok(await opts.first().getAttribute('aria-selected') === 'true', 'voce selezionata marcata aria-selected');

  // 5. Navigazione da tastiera nell'elenco
  await opts.first().focus();
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-person'));
  const second = await opts.nth(1).getAttribute('data-person');
  ok(focused === second, 'freccia giù sposta il fuoco alla persona successiva');

  // 6. Ricerca nell'elenco (anche per marcatore)
  await page.fill('input[aria-label="Cerca persona"]', 'femmina'); await page.waitForTimeout(300);
  ok(await page.locator('button[data-person]').count() === 1, 'ricerca filtra per attributo, non solo per nome');

  // 7. Sezioni nel pannello persona
  await page.fill('input[aria-label="Cerca persona"]', ''); await page.waitForTimeout(200);
  for (const sec of ['Anagrafica', 'Marcatori clinici', 'Diario clinico']) {
    ok(await page.locator(`text=${sec}`).count() >= 1, `pannello persona: sezione "${sec}"`);
  }

  // 8. Target touch su dispositivo a puntatore grosso
  const touch = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await touch.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await touch.click('button:has-text("Nuovo"):visible'); await touch.waitForTimeout(600);
  const small = await touch.evaluate(() => [...document.querySelectorAll('.toolbar-strip button')]
    .map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length);
  ok(small === 0, `touch: nessun pulsante toolbar sotto 44px (${small} sotto soglia)`);

  ok(errs.length === 0, errs.length ? 'ERRORI: ' + errs[0] : 'zero errori pagina');
  await page.screenshot({ path: (process.env.SP || '/tmp') + '/elenco.png' });
  await b.close();
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
