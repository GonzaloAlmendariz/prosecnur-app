# Plan de trabajo — remasterización de la UI (2026-10-10)

Tipo: Plan de trabajo
Estado: En curso
Fecha: 2026-10-10
Autoridad: Secuencia ejecutable del GOAL `goal-modernizacion-ui-2026-10-10.md`, sobre las decisiones del dueño y las 27 maquetas aprobadas para revisión; el GOAL sigue siendo la cola y la vara, este plan dice en qué orden, quién y con qué gate

Base: el [censo de la UI](censo-ui-2026-10-10.md) (qué hay y qué falta), el
[GOAL](goal-modernizacion-ui-2026-10-10.md) (vara V1–V11 y cola L1–L36) y la
maqueta de remasterización (una página «hoy → después» por unidad, servida en
el puerto 8933 desde la carpeta no versionada `remaster-ui/maqueta` bajo el
directorio temporal del repo; sus miniaturas se regeneran con el script
`capturar.mjs` que vive junto a ella; receta completa en la memoria de la
sesión y en `launch.json`, entrada «Maqueta remasterización UI (8933)»).

## 1. Lo que ya está decidido y este plan asume

| Decisión | Estado | Efecto en el plan |
|---|---|---|
| Tema oscuro | **descartado** (D6) | no hay unidad ni prerrequisito de hex para él |
| Todo booleano es un switch; el checkbox no existe en el kit | decidido | `PulsoSwitch` entra en la vuelta 0; la migración de inputs lo usa |
| Botón de ícono con caja en reposo; botón de texto sin subrayado; acción de navegación que nombra el destino con la flecha de lucide | decidido | reglas del kit de la vuelta 0, con contrato de test |
| Formularios tiene dos secciones: Editor y **Documento**, y Documento es un editor **fiel** como el de láminas (estándar, visor de páginas reales, bloques seleccionables, versiones), no una exportación con opciones | decidido (L36, 2026-10-10) | vuelta 3, en seis fases DOC.0–DOC.5 con dirección aprobada antes de construir, como F6 |
| D1 Formularios con `ModuleCommandBar` (rangos, menú de overflow, excepción retirada) | recomendación aplicada, salvo veto | vuelta 3 |
| D2 Dashboard: chrome canónico en la administración; el artefacto conserva su capa | recomendación aplicada, salvo veto | vuelta 3 |
| D3 contrato `banda`, D4 el marco es de la superficie, D7 Plotly acotada, D8 extraer primitivas puras Tel↔Acr | recomendación aplicada, salvo veto | vueltas 2, 0, 5 y 6 |

## 2. Cómo se ejecuta

- **Una vuelta = una unidad coherente de valor visible**, con su gate y sus
  commits por unidad (`/cerrar-trabajo`). Las vueltas van en orden porque
  cada una consume lo que construyó la anterior; dentro de una vuelta las
  unidades marcadas ∥ pueden correr en paralelo con escritores de archivos
  disjuntos (máximo dos escritores por oleada).
- **El kit primero.** Nada se migra sobre componentes que no existen: la
  vuelta 0 construye `Dialog`, `TabHeading`, `Switch/Input/Select/Field` y
  `Skeleton` con tests y contratos; las siguientes los adoptan.
- **Congelados por extracción**: en `TelefonicoMonitoreoPage.tsx`,
  `AcreditacionMonitoreoPage.tsx`, `BasesPanel.tsx` y `monitoreo.css` no se
  edita hacia arriba; se extrae a archivo nuevo (`node agentic/sync-agentic-os.mjs --audit` en verde al cerrar cada vuelta).
- **Gate escalado al diff** (`make gate-front AREA=…`, `make gate-area`
  cuando toca R) más captura con proyecto real de las superficies tocadas,
  comparada con su maqueta. `verificador` cierra cada vuelta en serie.
- **Revisión, no permiso**: lo decidido se ejecuta y se entrega con evidencia;
  el dueño corrige por el loop. Solo se pausa ante conflicto entre documentos.
- **Esfuerzo** en sesiones de trabajo con agentes (S = 1, M = 2, L = 4). Es
  orientación para ordenar, no compromiso de calendario.

## 3. Las siete vueltas

### Vuelta 0 — Fundaciones del kit (9 sesiones)

Sin pantalla nueva para el usuario, pero todo lo demás depende de aquí.

| Unidad | Maqueta | Qué se construye | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L1 ∥ | L1 | `components/Dialog.tsx` + `Sideover.tsx` sobre Radix Dialog con `usePanelDireccionable`, re-inyección de `moduleChromeVars` en el portal, stepper opcional | `frontend/src/components/`, `lib/navegacion/paneles.ts` | frontend-react | vitest de trap/Escape/foco; contrato que falla con `role="dialog"` fuera de la primitiva |
| L14 ∥ | L14 | `components/TabHeading.tsx` (estándar, compacta, con control de sección) | `components/` | frontend-react | render test; captura en dos páginas reales |
| L26 | L26, L27 | `PulsoSwitch` (maestro y chica), `PulsoInput`, `PulsoSelect` (Radix), `PulsoField`; reglas de botón (ícono con caja, texto sin subrayado, navegación con destino) | `components/`, `theme.css` (solo tokens nuevos de tipo) | frontend-react | contrato que prohíbe `<input` crudo y `type="checkbox"` en archivos migrados |
| L24 | L4, L23 | `Skeleton` en el kit, con variantes fila/card/kpi/gráfico; cerrar D4 (el marco es de la superficie, variante renombrada) | `components/states.css`, `States.tsx` | frontend-react | el skeleton no declara `data-audit-ready` (test) |
| L2 | — | Declarar en `PANELES_POR_MODULO` los ~50 overlays existentes; `ui-quick-check --panel` | `lib/navegacion/manifiesto.ts`, `scripts/ui-quick-check.mjs` | frontend-react + autor-regresiones | `panelesMontados()` = manifiesto |
| L35 | — | El dock del header mide lo que sus módulos; overflow a partir de nueve | `theme.css:757`, `Layout.tsx` | frontend-react | captura con ocho módulos a 1440 y 1024 |

Ledger que debe bajar: `role="dialog"` fuera de la primitiva (61 → las que aún no migraron), paneles direccionables (10 → ≥ 50).

### Vuelta 1 — Carga: lo que abre ventanas (16 sesiones)

| Unidad | Maqueta | Qué cambia | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L3 ∥ | L3 | Disparador de SurveyMonkey/Kobo en «bases separadas» con catálogo, perfil y última importación recordada por proyecto | `carga/CargaPage.tsx:1280`, nuevo `carga/plataforma/` | frontend-react | captura con `acnur_acg` en «separadas» |
| L4 ∥ | L4 | Readiness de Fuentes solo con la base hidratada; skeleton mientras llega | `carga/CargaPage.tsx` | frontend-react | 0 capturas con «Pendiente · 0/1» en tres corridas |
| L5 | L3 | Un solo importador de plataforma (base única y multibase) con `JobProgress` y cancelar; unificar los dos handlers de Kobo | `carga/plataforma/`, `CargaPage.tsx:436,508`, `BasesPanel.tsx:4034` | frontend-react + backend-r (cancelación del job) | los tres flujos pasan por `JobProgress`; cancel probado con test HTTP |
| L9 | — | Integrado y SAV como jobs (hoy `await` bloqueante) | `IntegratedInstrumentsWizard.tsx`, `SavBundleImportPanel.tsx`, `api/R/jobs.R` | backend-r + frontend-react | job con progreso en ambos; testthat del job |
| L7 | L7 | Credenciales en el sitio del error: sideover `?panel=configuracion&foco=conexiones` con vuelta al paso; último perfil y encuesta en el `.pulso` | `BasesPanel.tsx:5265`, `IntegratedInstrumentsWizard.tsx:955`, `CargaPage.tsx:387`, `project_pulso.R` | frontend-react + backend-r | ida y vuelta capturada; reapertura recuerda |
| L8 | L1 | Diálogo de SurveyMonkey del editor sin conectar al abrir, estado inicial reproducible, foco al disparador; coachmarks con `aria-modal` | `xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx`, `Coachmarks.tsx` | frontend-react | captura sin error; test de foco |
| L6 | L6 | Wizard independiente fuera de `BasesPanel` con stepper, estado en el store, confirmaciones con popover; borrar `SurveyMonkeyMultibaseWizard.tsx` | `BasesPanel.tsx:3676-5935` → `carga/independiente/` | frontend-react + autor-regresiones | `BasesPanel.tsx` baja ≥ 2.000 líneas; audit verde |

Entregable visible: importar desde SurveyMonkey o Kobo con catálogo, progreso, cancelar y credenciales a un clic. Ledger: flujos con `JobProgress` 0/7 → 7/7; `BasesPanel.tsx` 6.719 → < 4.700.

### Vuelta 2 — Verde por conformidad (7 sesiones)

| Unidad | Maqueta | Qué cambia | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L10 ∥ | L10 | Readiness por pestaña en Acreditación, Telefónico, Territorial y Analítica (`<modulo>/<seccion>/<pestana>`) | `profiles/*/…MonitoreoPage.tsx` (por extracción), `AnaliticaPage.tsx:119` | frontend-react | md5 distinto por pestaña en la matriz |
| L11 ∥ | L10 | Readiness de render: marca tras `onReady` de Plotly, mapas y fetch propio; el runner falla si captura spinner | `PlotlyChart`, `ModuleWarmupBoundary.tsx`, Hojas de ruta, Bitácora, Explorador de Cálculo, `ui-quick-check.mjs` | frontend-react + autor-regresiones | 0 INVALID al repetir la matriz del censo |
| L12 | — | El detector ve el jail del Home a 1024×600; contrato geométrico `banda` (D3) | `ui-quick-check.mjs`, `home-v2.css` | autor-regresiones | `scrollJails=1` antes, 0 tras el fix |
| L13 | L13 | Formularios enlazable: Constructor/Hojas/vistas por `?pestana=`; resolver N8 (importar no saca de Hojas) | `XlsformEditorPage.tsx:624-657`, `FocusedWorkspace.tsx:531`, `SheetsView.tsx:194` | frontend-react | matriz de Formularios con ≥ 6 direcciones únicas |

Ledger: capturas INVALID 7 → 0; `useState` de navegación 42 → < 30.

### Vuelta 3 — Un solo chrome en los ocho módulos (19 sesiones)

| Unidad | Maqueta | Qué cambia | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L15 ∥ | L15 | `SectionPillbar` en las cinco copias; Recopiladores sin numeración | `Layout.tsx:170`, `MonitoreoModuleChrome.tsx:220`, `CalcMuestraPage.tsx:2532`, `RecopiladoresShell.tsx:222`, `HojasRutaPage.tsx:7748` | frontend-react | `pulso-phase-pill` bespoke = 0 |
| L16 ∥ | L15, L16, D2 | Rail de 56 px en Recopiladores, Dashboard (administración) y Hojas de ruta › Entrega; retirar el rail bespoke de Cálculo | `RecopiladoresShell.tsx:327`, `DashboardPage.tsx:390`, `HojasRutaPage.tsx:8527`, `CalcMuestraPage.tsx:2590` | frontend-react | tres capturas con rail |
| L14b | L14 | Montar `TabHeading` en toda página con rail; retirar `MonitoreoWorkbenchHead` y `CargaWorkspaceHeader` | páginas de Procesamiento, Monitoreo, Cálculo | frontend-react | patrones de cabecera 12 → 1 |
| L17 | L17 | Formularios con `ModuleCommandBar` (D1); Cálculo y Gráficos sin `toolbar=`; `PageFrame` con `layout`/`scrollOwner` en Dashboard, Aulas, Gráficos, Formularios | `XlsformEditorPage.tsx:3109`, `CalcMuestraPage.tsx:2290`, `GraficosPage.tsx:281`, `DashboardPage.tsx`, `AulasMonitoreoPage.tsx` | frontend-react | `toolbar=` = 0; excepción retirada del manifiesto |
| L18 | L18 | Monitoreo territorial sin bandas repetidas; Cálculo colapsa los KPIs en «—» | `TerritorialMonitoreoPage.tsx`, `profilePage.css` (extracción), `motor/ResumenDiseno.tsx` | frontend-react | contenido propio antes de 300 px en todas las pestañas |
| L19 | L19 | Sub-barras sin dirección enlazadas o retiradas (consultas y reportes de Acr/Tel, manzanas y fase de Hojas, estructura de Carga, mes/semana de Bitácora) | ver censo §10 hallazgo 10 | frontend-react | `useState` de navegación = 0 |
| L36 | L36 | **Formularios › Documento como editor fiel** (arquitectura del editor de láminas F6): DOC.0 dirección y recetario del cuestionario → DOC.1 estándar `cuestionario` leído por el motor (`reporte_formulario_word.R` deja sus hex propios) → DOC.2 visor de páginas reales por job (reutiliza `reporte_word_visor.R`) con estados «regenerando» y «desactualizada» → DOC.3 bloques seleccionables con inspector contextual → DOC.4 opciones en el `.pulso` y versiones por instrumento → DOC.5 golden del `.docx` y comparación visual | `features/xlsformEditor/documento/` (calcado de `graficos/laminas/`), `lib/modules.ts`, `estandar_pulso.json`, `cuestionario_word_*.R`, `router_xlsform_editor.R:1607` | especialista-entregables (motor y estándar) + frontend-react (sección) + revisor-metodologico (qué lógica se imprime) + qa-visual-desktop | dirección DOC.0 aprobada por el dueño; seis pestañas capturadas con `acnur_pdm`; golden del `.docx`; páginas PNG contra la maqueta; XL = 8 sesiones |

Entregable visible: los ocho módulos con el mismo chrome; Formularios con Editor y Documento. Ledger: copias de `SectionPillbar` 5 → 0; módulos sin rail 3 → 0; `toolbar=` 3 → 0.

### Vuelta 4 — Cifras honestas y feedback (7 sesiones)

| Unidad | Maqueta | Qué cambia | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L20 ∥ | L20 | Una sola lectura de avance con su base en Home, header, badge y Cobertura; la card del Home lee el corte guardado | `moduleCardModel.ts`, `MonitoreoModuleChrome.tsx`, Avance territorial | frontend-react + revisor-metodologico | captura de las cinco superficies con la misma cifra o rótulo distinto |
| L21 ∥ | L21 | Criterios de revisión con cifra y base; la heurística de continuidad se apaga sola | motor R de criterios, `validacion/tabs/ReglasCustomTab.tsx` | backend-r + frontend-react | test con `acnur_acg` que falla antes |
| L22 | L22 | «Sin guardar» solo tras mutación; el chip lista qué cambió (`?panel=guardado`) | `CargaPage.tsx`, `AnaliticaPage.tsx`, `project_dirty` en R | backend-r + frontend-react | recorrido de lectura deja el chip limpio |
| L23 | L23 | Tiempo en las esperas: transcurrido y estimación aprendida del `.pulso`; `JobProgress` con tiempo; fallback de ruta con skeleton | `ModuleWarmupBoundary.tsx`, `BootGate.tsx`, `JobProgress.tsx`, `project_warmup_plan` | backend-r + frontend-react | captura del warm start con «m:ss transcurridos · ~restante» |
| L25 | L25 | `<Alert>` de resultado → `toast()` con acción | 49 usos de `Alert.tsx` | frontend-react | ≥ 20 migrados |

Ledger: lecturas de avance sin denominador 5 → 0.

### Vuelta 5 — Datos y densidad (12 sesiones)

| Unidad | Maqueta | Qué cambia | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L27 ∥ | L27 | Kit de inputs en configuración global, Cálculo de muestra y Carga; cada criterio dice cuánto resta | `GlobalSettingsDialog.tsx`, `calcMuestra/**`, `carga/**` | frontend-react | `<input` crudos bajan ≥ 300 |
| L28 ∥ | L28 | `PulsoTable` (react-table + react-virtual) con sticky, anchos declarados, densidad e inspector; primero las tres tablas territoriales y el Reporte UMP | `components/`, `TerritorialModelWorkbench.tsx`, `TerritorialFieldOccurrencesWorkbench.tsx` | frontend-react | 0 datos recortados en esas tablas |
| L29 | L29 | `--pulso-type-*` por rol con piso de 10 px; `data-density`; `--cmv2-ease` aliasado; hex de Monitoreo por lotes 1:1; paleta de Plotly acotada (D7) | `tokens.css`, `monitoreo.css` (extracción), `profilePage.css`, `plotlyTheme.ts` | frontend-react + qa-visual-desktop | `font-size` < 10 px = 0; hex de Monitoreo < 2.000; tokens sin definir = 0 |

### Vuelta 6 — Lo que se nota sin abrir un módulo (9 sesiones)

| Unidad | Maqueta | Qué cambia | Dónde vive | Agente | Gate |
|---|---|---|---|---|---|
| L30 ∥ | L30 | `CommandPalette` ⌘K sobre el manifiesto y las acciones de la command bar; atajos globales con overlay «?»; tooltips del dock por foco | `components/`, `lib/atajos.ts`, `Layout.tsx` | frontend-react | saltar a cualquier pestaña por teclado |
| L31 ∥ | L31 | Home vivo: cards suscritas a sesión y jobs, «hoy», siguiente acción, sin gradientes, sin jail a 1024 | `ProjectModulesContext.tsx`, `MissionControl.tsx`, `home-v2.css` | frontend-react | card de Procesamiento con barra de job en vivo |
| L32 | L32 | Materiales: un solo blur; header opaco con hairline; ventana en `--pulso-bg`; sombras a tokens | `theme.css:633-651`, `desktop/main.cjs:1866` | frontend-react + desktop-packaging | `backdrop-filter` en el header = 0 |
| L37 ∥ | L37 | Sistema de movimiento: las 22 coreografías del catálogo (navegación, paneles, física, listas, carga, toast, scroll, barras), contrato de movimiento, reduced-motion global, `motion` fuera; las 27 transiciones de `width` de Cálculo a `scaleX` | `tokens.css`, `theme.css`, `nav-states.css`, `components/*`, `calcMuestra/**`, `scripts/` | frontend-react + autor-regresiones + qa-visual-desktop | contrato verde; 0 frames > 16 ms en sección y diálogo; captura con reduced-motion |
| L33 | — | Desduplicar Telefónico ↔ Acreditación: primitivas puras a `monitoreo/core/`, chrome una sola vez (D8) | `profiles/telefonico/`, `profiles/acreditacion/` | frontend-react + autor-regresiones | duplicados 28 → 0 |

## 4. Dependencias que fijan el orden

```
V0 kit ─┬─► V1 Carga (Dialog, Skeleton, Switch/Field, JobProgress)
        ├─► V2 instrumento (paneles declarados → --panel; Skeleton → readiness)
        ├─► V3 chrome (TabHeading, SectionPillbar; L36 necesita Dialog y Field)
        ├─► V4 cifras (Skeleton y Sideover para L22/L23)
        ├─► V5 datos (Field para el inspector de PulsoTable)
        └─► V6 shell (Dialog para la paleta)
V2 ──► V3 (readiness por pestaña antes de mover cabeceras: el gate las compara)
V3 ──► V5 (las tablas territoriales se migran con el chrome ya estable)
```

## 5. Gates de cada vuelta

1. `pnpm -C frontend typecheck` y `make gate-front AREA=<área>` (incluye los contratos transversales).
2. `make gate-area AREA=<área>` cuando la vuelta toca R (vueltas 1, 3, 4).
3. Captura con proyecto real de cada superficie tocada, comparada con su maqueta (`--require-geometry`, `--timeout-ms 420000` en Monitoreo, `--post-click-wait-selector ".js-plotly-plot"` con gráficos, md5 distinto por pestaña).
4. `node agentic/sync-agentic-os.mjs --audit` en verde.
5. El ledger del GOAL re-medido; al menos un número baja.
6. `verificador` en serie; después `/cerrar-trabajo`.

## 6. Riesgos y cómo se manejan

| Riesgo | Mitigación |
|---|---|
| Los page-files congelados no pueden crecer | toda migración ahí es extracción; el audit lo vigila |
| Otra sesión trabaja en Gráficos (láminas) a la vez | no tocar `features/graficos/` sin coordinar; las unidades de Gráficos no están en este plan |
| La readiness nueva aprueba skeletons | L11 antes que cualquier skeleton en producción; test de que `Skeleton` no publica la marca |
| Migrar 696 inputs rompe formularios que nadie ve | contrato por archivo migrado + captura por pestaña, nunca migración masiva sin matriz |
| El Word de L36 diverge del Kobo | un solo modelo: el motor lee el XLSForm vivo; revisor-metodologico decide qué lógica se imprime y cómo |
| El visor de L36 muestra lo que LibreOffice pinta, no lo que Word pinta | misma trampa documentada en el PPT (`vert`/`vert270`, placeholders): el golden del `.docx` manda sobre el PNG; QA abre el `.docx` real en Word en los cortes |
| Documento se construye «superficial» por prisa | DOC.0 (dirección y recetario) se aprueba antes de tocar código, como se hizo con F6 (tres rondas contra el recetario) |
| Fixtures que no cubren Recopiladores, Bitácora ni Dashboard | `--sembrar` donde exista; fixture nuevo para Recopiladores (plan entregado) antes de la vuelta 3 |

## 7. Estado

El checklist vivo es la cola del GOAL (L1–L36, con sus estados). Este plan se
actualiza al cerrar cada vuelta con la fecha, los commits y el ledger movido.

| Vuelta | Unidades | Sesiones | Estado |
|---|---|---:|---|
| 0 Fundaciones del kit | L1, L14, L26, L24, L2, L35 | 9 | ☐ |
| 1 Carga | L3, L4, L5, L9, L7, L8, L6 | 16 | ☐ |
| 2 Verde por conformidad | L10, L11, L12, L13 | 7 | ☐ |
| 3 Un solo chrome | L15, L16, L14b, L17, L18, L19, L36 (XL) | 19 | ☐ |
| 4 Cifras y feedback | L20, L21, L22, L23, L25 | 7 | ☐ |
| 5 Datos y densidad | L27, L28, L29 | 12 | ☐ |
| 6 Shell | L30, L31, L32, L33, L37 | 9 | ☐ |
| **Total** | 37 unidades | **79** | |
