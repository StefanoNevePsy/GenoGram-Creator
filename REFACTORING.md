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
- [x] **Simboli nuovi (prima tranche)**: dipendenza comportamentale (righe teal),
      disturbo alimentare (contorno interno tratteggiato), istituzionalizzazione
      (parentesi quadre), campo professione (input + rendering + report);
      relazioni "violenza reciproca" (renderType arrow-open-both) e "fidanzati
      conviventi". Restano (M, opzionali): immigrazione con anno, PMA/donatore,
      distinzione alcol/droghe.
- [x] **Pulizia**: eliminati `genogramConfig.ts`, `fix*.cjs`, `events.txt`.
- [x] **Debito strict**: bonificati tutti i 28 errori. Ora il gate è
      `npx tsc -p tsconfig.app.json --noEmit` (verde) + `npm test` + `npm run build`.
- [x] **Vitest**: installato; `npm test` esegue 14 test su `layout/autoLayout.ts`
      (3 generazioni, divorzio+risposato, gemelli, grafo vuoto, ciclo, coniugi
      su generazioni incompatibili).

## Convenzioni
- Niente import circolari: `config/` e `utils/` non importano mai da `components/`.
- Tipi puri con `import type` (verbatimModuleSyntax attivo).
- Lo stato resta in GenogramApp e scende via props (niente context nuovi per ora).
