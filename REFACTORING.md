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
- [ ] **Minuchin v2 (idee)**: overlay Minuchin sul canvas del genogramma (toggle);
      mappe multiple T0/T1 con vista confronto; creazione da gruppo household;
      inclusione delle mappe nel report clinico stampabile.
- [x] **Fase 5 (prima parte)** — `hooks/useZoomPan.ts` (usePinchZoom: trackpad
      pinch + Ctrl/rotella, clamp condiviso) estratto e verificato live.
      Costruito l'harness per il resto: `scripts/e2e-smoke.cjs` (`npm run test:e2e`
      con dev server su :5199) — 7 check reali su Chromium: creazione nodo, drag,
      undo, zoom bottoni, pinch zoom, fit view, zero errori pagina.
- [ ] **Fase 5 (seconda parte)** — la macchina a stati del drag (dragRef,
      handleCanvasDown/Move/Up, getEventCoords) e le shortcut tastiera restano in
      App.tsx: estrarle in una sessione dedicata usando `npm run test:e2e` come
      regression gate dopo OGNI spostamento (aggiungendo check per box-select,
      pan con spazio, resize gruppi, drag note).
- [ ] **Simboli (seconda tranche, sforzo M)**: immigrazione/trasferimento con anno
      (freccia esterna), PMA/donatore/surrogata, distinzione alcol vs droghe
      (richiede scelta clinica: oggi `substanceAbuse` è generico — decidere se
      sdoppiare il flag o aggiungere un sottotipo).
- [ ] **Layout C&M v2 (rifiniture)**: centratura per-unione nelle catene multi-matrimonio
      (oggi la catena si centra sull'insieme dei figli); campo opzionale `birthOrder`
      su GenNode per ordinare fratelli senza data; campo `startDate` sugli edge di
      coppia per l'ordine cronologico esplicito dei matrimoni multipli.
- [ ] **Split cosmetico** dei cluster `components/*.tsx` in file singoli (bassa priorità).
- [x] **CI**: workflow GitHub Actions (`.github/workflows/ci.yml`) con i tre gate.

## Convenzioni
- Niente import circolari: `config/` e `utils/` non importano mai da `components/`.
- Tipi puri con `import type` (verbatimModuleSyntax attivo).
- Lo stato resta in GenogramApp e scende via props/hook dedicati.
- Nuovi campi su GenNode/RelationEdge sempre opzionali (retrocompatibilità dati).
