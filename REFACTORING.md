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

## Da fare (sessioni future)
- [ ] **Fase 5 — GenogramCanvas + gesture** (drag/pan/zoom/box-select in un hook o
      componente). DECISIONE: rimandata deliberatamente — il codice è fortemente
      accoppiato (~40 tra stati e ref condivisi) e il rischio di regressioni sulle
      interazioni non è verificabile senza test manuali sull'app. Farla in una
      sessione dedicata con verifica interattiva (npm run dev) passo-passo.
- [ ] **Simboli (seconda tranche, sforzo M)**: immigrazione/trasferimento con anno
      (freccia esterna), PMA/donatore/surrogata, distinzione alcol vs droghe
      (richiede scelta clinica: oggi `substanceAbuse` è generico — decidere se
      sdoppiare il flag o aggiungere un sottotipo).
- [ ] **Layout C&M v2 (rifiniture)**: centratura per-unione nelle catene multi-matrimonio
      (oggi la catena si centra sull'insieme dei figli); campo opzionale `birthOrder`
      su GenNode per ordinare fratelli senza data; campo `startDate` sugli edge di
      coppia per l'ordine cronologico esplicito dei matrimoni multipli.
- [ ] **Split cosmetico** dei cluster `components/*.tsx` in file singoli (bassa priorità).
- [ ] **CI**: aggiungere un workflow GitHub Actions che esegua i tre gate.

## Convenzioni
- Niente import circolari: `config/` e `utils/` non importano mai da `components/`.
- Tipi puri con `import type` (verbatimModuleSyntax attivo).
- Lo stato resta in GenogramApp e scende via props/hook dedicati.
- Nuovi campi su GenNode/RelationEdge sempre opzionali (retrocompatibilità dati).
