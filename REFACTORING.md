# Piano di refactoring — stato di avanzamento

Obiettivo: spezzare `src/App.tsx` in moduli, layout automatico Carter & McGoldrick,
nuovi simboli clinici.

**Gate di qualità (tutti verdi, da mantenere tali):**
- `npx tsc -p tsconfig.app.json --noEmit` → 0 errori (strict, noUnusedLocals)
- `npm test` → vitest, 23 test
- `npm run build` → produzione
Nota storica: `npx tsc --noEmit` alla radice è un NO-OP (tsconfig con files:[] +
references) — non usarlo come verifica.

## Fatto
- [x] **Fase 1** — Moduli puri: `types.ts`, `config/{relationships,categories,themes,constants}.ts`,
      `utils/{dates,genogram,geometry}.ts`.
- [x] **Layout C&M** (`src/layout/autoLayout.ts`): motore deterministico a blocchi,
      bottone GitBranch in toolbar accanto al layout fisico V33. Regole: generazioni
      su righe; fratelli per età (primogenito a sx, gemelli adiacenti); M a sx;
      matrimoni multipli in catena cronologica; genitori centrati sui figli;
      famiglie acquisite traslate verso il coniuge con collisioni per riga;
      warning (mai NaN) su cicli/generazioni incompatibili; isolati non toccati.
- [x] **Fase 2** — `services/firebase.ts` (parseFirebaseConfig) e
      `services/storage.ts` (readLocalIndex, readFullGenogram, saveDraftAndIndex,
      removeLocalGenogram, persistImportedLocally, downloadJsonFile).
- [x] **Fase 3** — `components/canvas.tsx` (Legend, LinePreview, RelationshipSelector,
      ConnectionLine, NodeShape, SelectionTransformer, StickyNoteShape),
      `components/panels.tsx` (QuickRelMenu, PalettePicker, NotesPanel, ThemeSelector,
      StickyNotePropertiesPanel), `components/modals.tsx` (ReportModal, SettingsModal,
      InstructionsModal, StyleDesignerModal, ReportConfigModal).
- [x] **Fase 4** — `hooks/useHistory.ts` (stack+indice sincrono via ref, undo/redo
      con sticky notes, updateNodes/Edges/Groups/All, resetHistory) e
      `hooks/useAutosave.ts` (debounce, sanificazione undefined per Firestore,
      salvataggio locale quota-safe). App.tsx: 5.695 → ~3.040 righe.
- [x] **Strict debt** — bonificati tutti i 28 errori pre-esistenti.
- [x] **Vitest** — 23 test: 14 sul layout C&M (3 generazioni, divorzio+risposato,
      gemelli, grafo vuoto, ciclo genitore-figlio, coniugi su generazioni
      incompatibili) + 9 su utils/dates.
- [x] **Simboli (prima tranche)** — Nodo: dipendenza comportamentale (righe teal),
      disturbo alimentare (contorno interno tratteggiato), istituzionalizzazione
      (parentesi quadre), campo professione (pannello + rendering + report).
      Relazioni: violenza reciproca (renderType `arrow-open-both`), fidanzati
      conviventi. Tutti i flag nuovi sono opzionali → retrocompatibili coi dati salvati.
- [x] **Pulizia** — eliminati `genogramConfig.ts`, `fix*.cjs`, `events.txt`.

- [x] **Minuchin v3**: tema completo dell'app (colori concreti via prop, necessari
      anche all'export PNG); mappe utilizzabili a genogramma vuoto ("Nuova mappa
      vuota"); creazione persone dall'editor → entrano nel genogramma dentro il
      CARTIGLIO (cornice tratteggiata color accento, griglia 3 colonne vicino al
      centro canvas), si assegnano trascinandole fuori.
- [x] **Minuchin v2**: membri resi con i simboli reali del genogramma tramite
      `PersonSymbol` (estratto da NodeShape, unica fonte per canvas e mappe);
      confini VERTICALI tra sottosistemi (aggiunta da toolbar, drag, ciclo stile,
      eliminazione); restyling completo (fasce alternate, pill, anteprime di
      notazione in toolbar, legenda a glifi SVG, export PNG senza affordance).
- [x] **Mappe strutturali Minuchin** (`components/minuchin.tsx` + tipi in `types.ts`):
      manager (bottone LayoutGrid in toolbar) + editor a livelli gerarchici con
      confini cliccabili (chiaro/diffuso/rigido), relazioni (alleanza, invischiamento,
      conflitto, coalizione A+B vs C, deviazione), seed automatico dalla selezione
      (traduzione fusione→invischiamento, ostilità→conflitto, armonia→alleanza),
      export PNG. Le mappe vivono in `data.structuralMaps` → autosave/sync/backup
      inclusi. Verificato end-to-end con Playwright (8 passi, 0 errori console).

## Da fare (sessioni future)
- [x] **Minuchin v4 — stile "minimale" + idee future TUTTE implementate**:
      - Stile 'minimal' (default per le nuove mappe): canvas compatto 560x400 senza
        fasce, posizionamento LIBERO anche verticale, confini orizzontali e
        verticali trascinabili/ciclabili/eliminabili; toggle Minimale⇄Griglia in
        editor con conversione proporzionale di posizioni e confini.
      - Miniature read-only (MapThumb) nel manager, badge "minimale".
      - Confronto T0/T1: seleziona 2 mappe (icona colonne) → vista affiancata.
      - Creazione da gruppo household (bottoni "Da gruppo: ...").
      - Overlay sul genogramma: icona occhio nel manager → le relazioni Minuchin
        della mappa si disegnano sopra i nodi del canvas (viola, non interattive).
      - Report clinico: checkbox "Mappe Strutturali" → ogni mappa entra nel PDF
        come SVG monocromo autonomo (mapToSvgString).
      Verificato e2e: 10 check (canvas compatto, niente fasce, persone al volo,
      conversione stile, miniature, confronto, overlay), zero errori.
- [x] **Fase 5 (prima parte)** — `hooks/useZoomPan.ts` (usePinchZoom: trackpad
      pinch + Ctrl/rotella, clamp condiviso) estratto e verificato live.
      Costruito l'harness per il resto: `scripts/e2e-smoke.cjs` (`npm run test:e2e`
      con dev server su :5199) — 7 check reali su Chromium: creazione nodo, drag,
      undo, zoom bottoni, pinch zoom, fit view, zero errori pagina.
- [x] **Fase 5 COMPLETATA** — estratti `hooks/useKeyboardShortcuts.ts` (tutte le
      shortcut globali; NOTA: `history` va passato esplicitamente nelle deps,
      altrimenti risolve in silenzio su window.history) e
      `hooks/useCanvasInteraction.ts` (macchina a stati del drag: coordinate
      touch/mouse, pan, box-select, long-press, drag nodi/note/gruppi, resize
      padding, transformer, listener globali). dragRef/dragState restano in App
      (servono al rendering delle anteprime). App.tsx: ~2.430 righe.
      Verificato con `npm run test:e2e` esteso a 9 check (aggiunti: spawn con M,
      box-select + Canc). Gli hook vanno chiamati DOPO la definizione di tutte le
      funzioni referenziate (prima del return dashboard).
- [x] **Simboli (seconda tranche)**: immigrazione con anno (freccetta + anno in
      alto a dx del simbolo, campo `immigrationYear`), PMA/donazione (triangolo
      con D in alto a sx, flag `donorConceived`) — pannello + PersonSymbol +
      report.
- [x] **Alcol vs droghe separati** (decisione utente: sdoppiare): `substanceAbuse`
      resta col significato di droghe/sostanze (dati salvati invariati, etichetta
      "Abuso Droghe"), nuovo flag opzionale `alcoholAbuse` ("Abuso Alcol", ambra
      scuro). Rendering a bande clippate sulla forma del genere: se entrambi
      presenti si dividono la metà inferiore in due bande. Pannello + report +
      istruzioni aggiornati.
- [x] **Layout C&M v2**: `birthOrder` su GenNode (ordina i fratelli senza data,
      vince sulla data; input nel pannello) e `startDate` sugli edge di coppia
      (ordine cronologico esplicito dei matrimoni multipli; la catena parte
      dall'estremo col legame più antico — fix scoperto dal test). 25 test verdi.
- [x] **Centratura per-unione** nelle catene multi-matrimonio: la traslazione
      rigida della catena si calcola ai minimi quadrati sui punti medi delle
      singole unioni rispetto ai rispettivi figli (con clamp nello span), invece
      di centrarsi sull'insieme indistinto dei figli.
- [x] **Split cosmetico** — CHIUSO senza intervento (decisione): i cluster
      canvas/panels/modals sono coesi, non impattano tree-shaking né i gate, e
      lo split aggiungerebbe solo churn di import. Riaprire solo se un cluster
      supera ~1.500 righe o va condiviso fuori dall'app.
- [x] **Confini a segmenti (Minuchin)**: un confine si spezza dove lo attraversa
      un confine perpendicolare; ogni segmento (tra due incroci o il bordo) ha uno
      stile proprio (clear→diffuse→rigid→none, con none per accorciarlo). Permette
      es. diffuso madre-figlio + rigido padre-figlio sulla stessa linea, o rigido
      genitori/figli attraversato da un verticale coppia. `segmentsOf` esportata e
      coperta da 5 unit test (30 totali); rendering condiviso da editor/miniature/
      overlay/SVG report. Verificato e2e sulla build di produzione.
- [x] **CI**: workflow GitHub Actions (`.github/workflows/ci.yml`) con i tre gate.
- [x] **Fix S-Pen / tasto destro** (conflitti storici): guard su e.button in
      handleCanvasDown (barrel/destro → menu contestuale, MAI box-select fantasma);
      cursorRef via pointermove (penna in hover e touch, non solo mouse);
      handleNativeSPen annulla drag/long-press in corso. Verificato con
      `npm run test:e2e:pen` (8 check: maniglie spouse/child, tasto destro,
      barrel web, evento nativo sPenNativeEvent simulato).

- [x] **Relazioni con i GRUPPI + ancore scorrevoli**: il drop delle maniglie-relazione
      ora riconosce i gruppi come bersaglio (hit-test sul bounding del blob) e come
      sorgente (maniglia gialla) → nodo↔gruppo e gruppo↔gruppo funzionano; per i
      drop 'link' la hit-box dei nodi è stretta al simbolo (il gruppo vince sul
      bordo del blob). Le maniglie dei gruppi sono ancorate ai bordi REALI del blob
      (prima usavano customPadding e finivano DENTRO, coperte dai membri — causa
      storica del "non riesco a creare relazioni"). Edge selezionata con estremo su
      gruppo → maniglia ancora trascinabile che scorre l'aggancio sul perimetro
      organico (campionamento bestT, live + una entry di history al rilascio).
      Test permanente scripts/e2e-groups.cjs (6 check, scenari isolati).
- [x] **Legenda condizioni cliniche**: la legenda auto-generata ora include i
      marcatori clinici usati (droghe, alcol, psicologico, omosessualità, dip.
      comportamentale, dist. alimentare, istituzionalizzato, PMA, immigrazione)
      con mini-glifi fedeli; stima altezza export aggiornata.

- [x] **Export bounds con sticky notes**: `getContentBounds` considerava solo
      nodi e gruppi → le note lontane venivano TAGLIATE in PNG/SVG/PDF e ignorate
      dal fit-view (Ctrl+0). Ora includono anche `stickyNotes` (x,y,width,height);
      il fallback "canvas vuoto" scatta solo senza nodi E senza note.
      Test: scripts/e2e-export-bounds.cjs (legge il viewBox reale dell'SVG esportato).
- [x] **Decoratori perpendicolari alla linea**: cutoff, cutoff-double,
      cutoff-repaired-circle, oblique, oblique-double, x-cross,
      oblique-double-crossed e triangle-up-center usavano coordinate assolute
      (decX/decY) senza rotazione → restavano verticali su relazioni diagonali.
      Ora sono disegnati nel sistema di riferimento della linea (centerArrowTrans,
      che ruota di `angle`). Le linee strutturali hanno angle=0 → invariate.
      Test: scripts/e2e-decorator-angle.cjs (stato iniettato: 0° su orizzontale,
      -45° su diagonale). In LinePreview restano fissi: la legenda è orizzontale.

- [x] **Espansione simboli (+30 relazioni, 53 → 83)** e nuovi dati persona.
      Bug trovati dall'audit e corretti: `two-circles-center` (Innamorati) e
      `twin-link-bar` (Gemelli Monozigoti) erano configurati ma NON resi — la prima
      appariva identica ad Armonia, i monozigoti identici ai dizigoti;
      `triple-zigzag-center` mancava in LinePreview (legenda). Inoltre
      `physicalIssue` e `recovery` erano nel tipo e nel report ma senza toggle né
      simbolo: dati irraggiungibili, ora attivati.
      Nuovi renderType: bars-center, triangle-center, dot-center, zigzag-overlay
      (+ i due corretti). Nuova categoria "Sociale / Contesto".
      Nuovi dati persona: disability, causeOfDeath, education, religion, ethnicity.
      Test: scripts/e2e-symbols.cjs (stato iniettato, 7 check).

- [x] **Audit (codice + Impeccable critique) e correzioni**. Metodo: due assessment
      isolati (design review; detector + evidenze browser misurate) + audit di codice.
      Difetti REALI corretti:
      - **P0 toolbar a larghezza 0 sotto i 1024px**: nell'header stava tra due blocchi
        `shrink-0`, il contenitore `flex-1 min-w-0` collassava e TUTTI gli strumenti
        erano inaccessibili (a 390px e 768px il click falliva: zero persone creabili,
        app inutilizzabile sull'APK Android). Ora la barra ha una riga propria a piena
        larghezza + sfumatura di scorrimento quando il contenuto trabocca.
      - **P0 M/F non spawnavano dopo la prima persona**: guard `selectedNodeIds.length === 0`
        mentre il nodo creato si auto-seleziona → no-op silenzioso (lo avevo perfino
        aggirato con un Escape nei miei stessi test). Guard rimosso.
      - **Menu relazioni**: 83 tipi in lista piatta (le categorie c'erano ma venivano
        appiattite con un reduce) → intestazioni di categoria + campo di ricerca.
      - **Conferme distruttive incoerenti**: "Elimina Persona" non chiedeva nulla
        mentre Canc sì. Ora conferme che NOMINANO persona e relazioni travolte;
        eliminazione genogramma nomina titolo e numero di persone.
      - **Ctrl+S**: `alert()` sostituito da conferma effimera "SALVATO" nel pill di sync.
      - **A11y**: 0 → tutti i bottoni con nome accessibile; `role="application"` +
        aria-label sul canvas; prima regola `:focus-visible` del progetto (diversi
        campi usavano `outline-none` senza sostituto); Escape chiude le modali.
      - **Contrasto**: 7 etichette di categoria su 8 erano sotto AA (fino a 2.15:1);
        il colore-categoria resta sull'icona, il testo torna leggibile.
      Test: scripts/e2e-audit-fixes.cjs (11 check, misura il contrasto reale).
      NON risolti (nel backlog): vista a lista/navigazione da tastiera tra i nodi,
      raggruppamento del pannello persona, onboarding ed empty state, deduplica
      icone, target touch < 44px, sidebar dashboard non collassabile a 390px.

## Convenzioni
- Niente import circolari: `config/` e `utils/` non importano mai da `components/`.
- Tipi puri con `import type` (verbatimModuleSyntax attivo).
- Lo stato resta in GenogramApp e scende via props/hook dedicati.
- Nuovi campi su GenNode/RelationEdge sempre opzionali (retrocompatibilità dati).
