# Piano di refactoring — stato di avanzamento

Obiettivo: spezzare `src/App.tsx` (~5.100 righe) in moduli, aggiungere il layout
automatico Carter & McGoldrick e nuovi simboli clinici.
Gate di qualità: `npm run build` sempre verde + `tsc -p tsconfig.app.json --noEmit`
senza NUOVI errori (vedi nota sotto).

## Fatto
- [x] **Fase 1** — Estratti moduli puri:
  - `src/types.ts` (Gender, GenNode, RelationEdge, NodeGroup, GenogramMeta, StickyNoteData, ReportOptions…)
  - `src/config/relationships.ts` (BASE_REL_CONFIG, RELATION_CATEGORIES)
  - `src/config/categories.ts`, `src/config/themes.ts`, `src/config/constants.ts`
  - `src/utils/dates.ts` (parseDate, calculateAge, calculateAgeAtDeath, extractYear)
  - `src/utils/genogram.ts` (generateId, findMarriageEdge, getMarriageBarY)
  - `src/utils/geometry.ts` (hull, intersezioni, blob organico, zigzag…)

- [x] **Layout C&M** (`src/layout/autoLayout.ts`): motore deterministico a blocchi,
      integrato come bottone GitBranch accanto al layout fisico V33. Collaudato su
      fixture (3 generazioni con nonni entrambi i lati; divorzio+risposato con figli
      di due letti; gemelli; nodo isolato ignorato). Le famiglie acquisite si
      agganciano per riga con spostamento minimo verso il coniuge.

## Da fare (in ordine)
- [x] **Fase 2 (parziale)** — `services/firebase.ts` (parseFirebaseConfig).
      Resta: `services/storage.ts` (indice locale, draft, persistImportedGenograms,
      getFullGenogram, export/import — oggi closure dentro GenogramApp).
- [x] **Fase 3** — Componenti estratti: `components/canvas.tsx` (Legend, LinePreview,
      RelationshipSelector, ConnectionLine, NodeShape, SelectionTransformer,
      StickyNoteShape), `components/panels.tsx` (QuickRelMenu, PalettePicker,
      NotesPanel, ThemeSelector, StickyNotePropertiesPanel), `components/modals.tsx`
      (ReportModal, SettingsModal, InstructionsModal, StyleDesignerModal,
      ReportConfigModal). App.tsx: 5695 → ~3230 righe. Eventuale split per-file
      dei cluster è cosmetico, bassa priorità.
- [ ] **Fase 4** — `hooks/useHistory.ts` (stack+index+historyIndexRef INSIEME),
      `hooks/useAutosave.ts`. Delicato: closure e ref condivisi.
- [ ] **Fase 5** — `GenogramCanvas` + gesture (drag/pan/zoom). Ultimo, rischio alto.
- [ ] **Simboli nuovi**: alcol vs droghe distinti, dipendenza comportamentale,
      disturbo alimentare, istituzionalizzazione, immigrazione, PMA/donatore,
      campo professione; relazione "violenza reciproca" (zigzag doppia freccia),
      "fidanzati conviventi".
- [ ] **Pulizia**: `src/genogramConfig.ts` è legacy morto (nessuno lo importa) → eliminare.
      `fix.cjs`, `fix2.cjs`, `fix_syntax.cjs`, `events.txt` in src/ → eliminare.
- [ ] **Debito strict**: `tsc -p tsconfig.app.json` ha ~25 errori PRE-esistenti
      (TS6133 variabili inutilizzate, `NodeJS` namespace, null-check dragRef,
      handler onClick con firma sbagliata a r.~4494). Il vecchio `npx tsc --noEmit`
      alla radice era un NO-OP (tsconfig con files:[] + references). Da bonificare
      in una fase dedicata, poi usare `tsc -b` come gate.
- [ ] **Vitest**: aggiungere per `utils/*` e soprattutto `layout/autoLayout.ts`
      (fixture: famiglia nucleare, 3 generazioni, divorzio+risposato, gemelli,
      monogenitore; proprietà: no sovrapposizioni, primogenito.x < fratelli.x,
      M.x < F.x nella coppia, genitori centrati sui figli).

## Convenzioni
- Niente import circolari: `config/` e `utils/` non importano mai da `components/`.
- Tipi puri con `import type` (verbatimModuleSyntax attivo).
- Lo stato resta in GenogramApp e scende via props (niente context nuovi per ora).
