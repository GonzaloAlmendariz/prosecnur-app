# GOAL — La app se siente de una sola generación (modernización de la UI)

Tipo: GOAL (loop de convergencia)
Estado: En curso
Fecha: 2026-10-10
Autoridad: Plan de acción derivado de `censo-ui-2026-10-10.md`; ejecuta la dirección v3 ya aprobada (ADR 0042/0044, `branding/direccion-creativa-v3.md`); solo el dueño lo cierra

Origen: el [censo de la UI](censo-ui-2026-10-10.md) midió 8 módulos, 44
secciones, ~186 pestañas y ~50 overlays, y dejó una nota de modernidad de
3,1 sobre 5 con un techo alto. Este GOAL es la vara y la cola para subir esa
nota sin tocar la marca congelada. Absorbe la bandeja de decisiones y el
ledger del [goal loop visual](goal-loop-visual-app-2026-07-30.md), que queda
como histórico de la primera órbita.

## Modo de operación

- **Loop, no lista.** Cada vuelta: medir el ledger → tomar el siguiente
  ítem de la cola (no el más fácil) → implementar con gate escalado al diff →
  commit por unidad (`/cerrar-trabajo`) → redibujar este doc entero con lo
  movido y lo que espera al dueño.
- **Revisión, no permiso.** Lo que la dirección v3 y los ADR ya decidieron se
  ejecuta y se entrega con evidencia; el dueño corrige por el loop. Solo se
  pausa ante una decisión de producto sin arbitrar (tabla «Espera al dueño»)
  o un conflicto entre documentos.
- **Verde por conformidad.** Ningún ítem se marca ☑ sin su medición de
  después y una captura con proyecto real donde aplique. «Implementado sin
  ver» y «implementado pero inalcanzable con este fixture» se anotan como
  tales, nunca como ☑.
- **Arreglar no puede seguir agrandando.** Cada vuelta termina con
  `node agentic/sync-agentic-os.mjs --audit` en verde y al menos un número
  del ledger estrictamente más bajo.
- **Solo el dueño cierra el GOAL.**

## Vara — cómo se ve cuando está bien

| # | Afirmación comprobable | Cómo se mide | Hoy |
|---|---|---|---|
| V1 | Todo overlay es un panel declarado y enlazable | `grep -rc 'role="dialog"'` fuera de `components/Dialog.tsx` = 0; paneles en el manifiesto ≥ overlays reales | 61 `role="dialog"` en 56 archivos; 10 paneles declarados |
| V2 | Hay una sola primitiva de diálogo, con focus trap, Escape y restauración de foco | `Dialog.tsx`/`Sideover.tsx` sobre Radix; test de contrato que falla con un `role="dialog"` fuera de ellas | 0 primitiva; 3 mecanismos; ~30 wrappers |
| V3 | Carga importa con progreso real y cancelable, y ofrece plataforma en toda estrategia | los 7 flujos usan `JobProgress`; disparador SM/Kobo visible con «bases separadas»; sin «Pendiente · 0/1» tras readiness | 0 de 7 con `JobProgress`; sin disparador en «separadas»; 8 s de estado falso |
| V4 | Toda pestaña publica su propia readiness y solo cuando terminó de pintar | `data-audit-ready` único por pestaña en Monitoreo y Analítica; 0 capturas con spinner y `ok=true` en la matriz | una marca por página en Acr/Tel/Terr/Analítica; 7 INVALID en el censo |
| V5 | Una sola cabecera de pestaña y un solo rail de secciones en los ocho módulos | `SectionPillbar` = única implementación; componente `TabHeading` en todas las páginas con rail; 0 `toolbar=` | 1 + 5 copias; 12 patrones de cabecera; 3 `toolbar=` |
| V6 | Las pestañas viven en el rail de 56 px donde hay pestañas, y toda vista interior es enlazable | Recopiladores, Dashboard, Hojas › Entrega con `ContextTabRail`; Formularios con `?pestana=` para Constructor/Hojas/vistas; 0 `useState<…Tab\|View\|Mode>` que gobierne navegación | 3 módulos sin rail; 42 `useState` de navegación |
| V7 | Toda cifra de avance dice su base | 0 lecturas de avance sin denominador rotulado en Home y Monitoreo; Criterios de revisión sin cifras absurdas; el indicador «sin guardar» solo tras una edición | 5 lecturas distintas; «1.970.691 envíos»; dirty por lectura |
| V8 | Formularios e inputs salen del kit | `PulsoInput/Select/Field` existen; `<input` crudo = 0 en archivos migrados; contador global baja cada vuelta | 696 `<input`, 227 `<select`, 0 primitiva |
| V9 | Las esperas largas dicen cuánto falta | warm start y jobs muestran transcurrido + estimación; skeleton de la vista destino en vez de un 8 % fijo | 0 mensajes de tiempo; `RouteLoadingFallback` a 8 % |
| V10 | Cualquier vista se alcanza desde el teclado | `CommandPalette` sobre `__pulsoNav.manifiesto`; registro global de atajos con overlay «?» | 0 paleta; 5 registros locales |
| V12 | El movimiento es un sistema: 22 coreografías con token, solo transform y opacity, continuidad al navegar, press en lo presionable, scroll con dueño y suave | contrato de movimiento verde; 0 transiciones de layout; 0 literales de ms/bezier en migrados; medición de frames largos | 233 keyframes, 34 layout, 1.112 ms literales, 13 presses |
| V13 | Las acciones de datos de Monitoreo son un diccionario: un control de actualización en el chrome, siete verbos, nada en la barra escribe fuera, todo lo que escribe fuera ensaya primero, rojo sólo para lo que borra | contrato de acciones verde; 0 disparadores de `/sync` fuera del chrome y las filas de fuente; 0 endpoints de escritura externa sin preflight desde la UI | «Avance»/«Todo» ×4 perfiles, 2 «Todo» en tel/acr, 4 rótulos para una descarga en territorial, 0 ensayos salvo Asignación |
| V11 | La deuda de piel baja y no sube | hex en CSS de features, `font-size` literal, `style={{`, tokens sin definir, líneas de los congelados | 4.468 hex (Monitoreo 3.115 ↑); 8.188 `font-size`; 2.699 inline; 23 tokens; congelados creciendo |

## Cola — en el orden en que se toma

Severidad y cláusula vienen del censo (§10). «Dónde vive» es el archivo que
cambia; «gate» es la evidencia mínima para marcar ☑. Estados: ☐ sin empezar ·
◐ a medias · ☑ hecho · ⛔ bloqueado (dice qué lo desbloquea).

### Oleada 1 — la quinta dimensión y Carga (lo que abre ventanas)

| # | Ítem | Vara | Dónde vive | Gate | Esf. | Estado |
|---|---|---|---|---|---|---|
| L1 | `components/Dialog.tsx` + `Sideover.tsx` sobre `@radix-ui/react-dialog` con `usePanelDireccionable` integrado (id, clase `dialogo\|sideover\|popover`, re-inyección de `moduleChromeVars` en el portal) | V1, V2 | `frontend/src/components/`, `lib/navegacion/paneles.ts` | test de contrato: `role="dialog"` fuera de la primitiva falla; Escape, trap y foco probados con vitest | M | ☐ |
| L2 | Declarar en `PANELES_POR_MODULO` los ~50 overlays existentes aunque sigan bespoke; `ui-quick-check --panel` los abre | V1, V4 | `lib/navegacion/manifiesto.ts`, `scripts/ui-quick-check.mjs` | `panelesMontados()` = manifiesto; una corrida con `--panel` por módulo | M | ☐ |
| L3 | Carga › Fuentes: disparador de SurveyMonkey/Kobo en la estrategia «bases separadas» (hoy solo el marco `CargaPlatformImportPanel`) | V3 | `features/carga/CargaPage.tsx:1280`, `CargaPlatformImportPanel.tsx` | captura con `acnur_acg` mostrando catálogo e importación en «separadas» | M | ☐ |
| L4 | Carga › Fuentes: readiness solo con la base hidratada (adiós al «Pendiente · 0/1 base» de 8 s) y skeleton mientras llega | V3, V4 | `CargaPage.tsx` (`carga-fuentes`) | 0 capturas con estado falso en tres corridas | S | ☐ |
| L5 | Un solo importador de plataforma (base única y multibase) con catálogo, perfil, `JobProgress` y cancelar; unificar los dos handlers de Kobo | V3 | `CargaPage.tsx:436,508`, `BasesPanel.tsx:4034`, nuevo `carga/plataforma/` | los 3 flujos de plataforma pasan por `JobProgress`; cancel probado | L | ☐ |
| L6 | Wizard independiente fuera de `BasesPanel` (`carga/independiente/`) con `StageStepper` y estado de auditoría/plan en el store; borrar `SurveyMonkeyMultibaseWizard.tsx` muerto | V3, V11 | `BasesPanel.tsx:3676-5935` → carpeta nueva | `BasesPanel.tsx` baja ≥ 2.000 líneas; stepper visible; audit del OS verde | L | ☐ |
| L7 | Credenciales en el sitio del error: del strip de token a `?panel=configuracion&foco=conexiones` y vuelta al mismo paso; último perfil y encuesta recordados por proyecto en el `.pulso` | V3 | `BasesPanel.tsx:5265`, `IntegratedInstrumentsWizard.tsx:955`, `CargaPage.tsx:387`, `project_pulso.R` | ida y vuelta capturada; reapertura del proyecto recuerda perfil | M | ☐ |
| L8 | Importar SurveyMonkey del editor: no intentar conectar al abrir; estado inicial vacío y reproducible; foco al disparador al cerrar; coachmarks con `aria-modal` y foco | V2 | `xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx`, `shell/Coachmarks.tsx` | captura del estado inicial sin error; test de foco | S | ☐ |
| L9 | Integrado y SAV como jobs con `JobProgress` (hoy `await` bloqueante) | V3 | `IntegratedInstrumentsWizard.tsx`, `SavBundleImportPanel.tsx`, `jobs.R` | job con progreso y cancel en ambos | M | ☐ |

### Oleada 2 — verde por conformidad (el instrumento deja de aprobar lo que no vio)

| # | Ítem | Vara | Dónde vive | Gate | Esf. | Estado |
|---|---|---|---|---|---|---|
| L10 | Readiness por pestaña en Acreditación, Telefónico, Territorial y Analítica (patrón `recopiladores/<seccion>/<pestana>`) | V4 | `profiles/*/…MonitoreoPage.tsx`, `AnaliticaPage.tsx:119` | `md5` distinto por pestaña en la matriz; 0 duplicados | M | ☐ |
| L11 | Readiness de render, no de montaje: la marca se publica tras `onReady` de Plotly, mapas y fetch propio (N7/N12); `ModuleWarmupBoundary` espera la marca compuesta | V4 | `PlotlyChart`, `ModuleWarmupBoundary.tsx`, Hojas de ruta, Bitácora, Explorador de Cálculo | 0 INVALID en la matriz del censo repetida | M | ☐ |
| L12 | El detector ve el scroll jail del Home a 1024×600 (contenedor sin dueño de scroll) | V4 | `scripts/ui-quick-check.mjs`, `home-v2.css` | `scrollJails=1` antes, `0` después con el fix de Home | S | ☐ |
| L13 | Formularios enlazable: Constructor/Hojas y las vistas de «Más vistas» por `?pestana=`/`?panel=` (resolver primero N8: importar un formulario no debe sacar de Hojas) | V6 | `XlsformEditorPage.tsx:624-657`, `FocusedWorkspace.tsx:531`, `SheetsView.tsx:194` | matriz de Formularios con ≥ 6 direcciones únicas | M | ☐ |

### Oleada 3 — un solo chrome en los ocho módulos

| # | Ítem | Vara | Dónde vive | Gate | Esf. | Estado |
|---|---|---|---|---|---|---|
| L14 | `TabHeading` compartido (elegir entre la cabecera de Cálculo, la de aulas y la de acreditación) y montarlo en toda página con rail; retirar las 12 variantes | V5 | `components/`, `MonitoreoWorkbenchHead.tsx`, `CargaWorkspaceHeader.tsx`, `ValidacionPage.tsx`, `AnaliticaPage.tsx`, `CalcMuestraPage.tsx` | 1 implementación; captura por módulo | M | ☐ |
| L15 | `SectionPillbar` en las cinco copias (Procesamiento en el shell, Monitoreo, Cálculo, Recopiladores, Hojas de ruta) como links con `aria-current="page"`; Recopiladores sin numeración | V5 | `Layout.tsx:170`, `MonitoreoModuleChrome.tsx:220`, `CalcMuestraPage.tsx:2532`, `RecopiladoresShell.tsx:222`, `HojasRutaPage.tsx:7748` | `grep` de `pulso-phase-pill` bespoke = 0 | M | ☐ |
| L16 | Rail de 56 px en Recopiladores, Dashboard (admin) y Hojas de ruta › Entrega; retirar `CalcMuestraContextSidebar` duplicado | V6 | `RecopiladoresShell.tsx:327`, `DashboardPage.tsx:390`, `HojasRutaPage.tsx:8527`, `CalcMuestraPage.tsx:2590` | tres capturas con rail; 0 rails duplicados | M | ⛔ Dashboard espera D2 |
| L17 | Formularios monta `ModuleCommandBar` (overflow por `rank`, lo que no cabe al menú); Cálculo y Gráficos dejan `toolbar=`; `PageFrame` con `layout`/`scrollOwner` en Dashboard, Aulas, Gráficos, Formularios | V5 | `XlsformEditorPage.tsx:3109`, `CalcMuestraPage.tsx:2290`, `GraficosPage.tsx:281`, `DashboardPage.tsx`, `AulasMonitoreoPage.tsx` | `toolbar=` = 0; `chromeExcepcion` de Formularios retirada del manifiesto | M | ⛔ Formularios espera D1 |
| L18 | Bandas fijas de contexto a un solo costo: Monitoreo territorial deja la banda Piloto/Campo y la card de fuente solo en Fuente; Cálculo colapsa los KPIs en «—» | V5 | `TerritorialMonitoreoPage.tsx`, `profilePage.css`, `calcMuestra/motor/ResumenDiseno.tsx` | contenido propio antes de 300 px a 1440 en todas las pestañas | S | ☐ |
| L19 | Sub-barras sin dirección enlazadas o retiradas (consultas y reportes de Acr/Tel, manzanas y fase de Hojas, estructura de Carga, mes/semana de Bitácora) | V6 | ver censo §10 hallazgo 10 | `useState<…Tab\|View\|Mode>` de navegación = 0 | M | ☐ |

### Oleada 4 — cifras honestas y feedback

| # | Ítem | Vara | Dónde vive | Gate | Esf. | Estado |
|---|---|---|---|---|---|---|
| L20 | Una sola lectura de avance con su base rotulada en Home, header de Monitoreo, badge de sección y Cobertura; la card del Home no cambia con el warm start | V7 | `moduleCardModel.ts`, `MonitoreoModuleChrome.tsx`, Avance territorial | captura de Home y de las cinco superficies con la misma cifra o rótulos distintos | M | ☐ |
| L21 | Criterios de revisión: la heurística de continuidad no lee ids de servidor como secuencia | V7 | `validacion/…`, motor R de criterios | test con `acnur_acg` que falla antes | S | ☐ |
| L22 | «Sin guardar» solo tras una mutación (hoy se marca al leer Fuentes, Codificar, Base final) | V7 | `CargaPage.tsx`, `AnaliticaPage.tsx`, `project_dirty` | recorrido de lectura deja el indicador limpio | S | ☐ |
| L23 | Tiempo en las esperas: `BootGate` y `ModuleWarmupBoundary` con transcurrido y estimación aprendida del `.pulso` anterior; `JobProgress` con tiempo; `RouteLoadingFallback` con skeleton en vez de 8 % | V9 | `ModuleWarmupBoundary.tsx:252,390-430`, `BootGate.tsx:260-278`, `JobProgress.tsx`, backend `project_warmup_plan` | captura del warm start de Monitoreo con «m:ss transcurridos · ~restante» | M | ☐ |
| L24 | `Skeleton` en el kit con la silueta de la vista destino; cerrar decisión D4 (marco del vacío) | V9 | `components/states.css`, `States.tsx` | skeleton en Analítica y Monitoreo; `--panel` con marco o renombrada | M | ☐ |
| L25 | `<Alert>` de resultado → `toast()` con acción («Deshacer», «Ver») | V9 | 49 usos de `Alert.tsx` | ≥ 20 migrados en la primera vuelta | S | ☐ |

### Oleada 5 — el kit por debajo del chrome

| # | Ítem | Vara | Dónde vive | Gate | Esf. | Estado |
|---|---|---|---|---|---|---|
| L26 | `PulsoInput`, `PulsoSelect` (Radix Select), `PulsoField` (label + hint + error), `PulsoTabs` local, `PulsoSwitch` (maestro 44×24 y variante chica para filas); contrato que prohíbe `<input` crudo en archivos migrados. **Regla del dueño (2026-10-10): todo booleano es un switch; el checkbox no existe en el kit.** Radios solo para elección excluyente; de dos a cuatro opciones, segmented. **Acciones de navegación (2026-10-10): botón de texto que nombra el destino («Abrir en Analítica», «Ver la pregunta») con la flecha de lucide; «Ir» y «→» tipeado no existen.** Botón de ícono con caja en reposo; botón de texto sin subrayado | V8 | `components/` | primitivas con tests; contrato verde | M | ☐ |
| L27 | Migrar configuración global, Cálculo de muestra (324 familias de input) y Carga | V8 | `GlobalSettingsDialog.tsx`, `calcMuestra/**`, `carga/**` | contador global de `<input` baja ≥ 300 | L | ☐ |
| L28 | `PulsoTable` sobre react-table + react-virtual (instalados) con sticky, anchos declarados, `tabular-nums` e inspector compartido; primero las tres tablas territoriales y el Reporte UMP (cierra decisión 3 del loop anterior) | V8 | `components/`, `TerritorialModelWorkbench.tsx`, `TerritorialFieldOccurrencesWorkbench.tsx` | 0 datos recortados en esas cuatro tablas | L | ☐ |
| L29 | `--pulso-type-*` por rol con piso de 10 px; `data-density` en `:root`; `--cmv2-ease` aliasado; barrido de hex 1:1 en Monitoreo por lotes con QA por perfil | V11 | `tokens.css`, `monitoreo.css`, `profilePage.css`, `universidad/ui/ui.css` | `font-size` bajo 10 px = 0; hex de Monitoreo < 2.000; tokens sin definir = 0 | L | ☐ |

### Oleada 6 — lo que se nota sin abrir un módulo

| # | Ítem | Vara | Dónde vive | Gate | Esf. | Estado |
|---|---|---|---|---|---|---|
| L30 | `CommandPalette` ⌘K sobre `__pulsoNav.manifiesto` + acciones de la command bar activa; registro global de atajos con overlay «?»; `⌘1..8` módulos; tooltips del dock por foco | V10 | `components/`, `lib/atajos.ts`, `Layout.tsx:288` | saltar a `monitoreo/territorial/avance/ump` desde cualquier vista por teclado | M | ☐ |
| L31 | Home vivo: cards suscritas a `pulso:session-changed` y jobs; «siguiente acción» por módulo; bloque «hoy»; sin gradientes decorativos; sin scroll jail a 1024×600 | V7, V9 | `ProjectModulesContext.tsx`, `MissionControl.tsx`, `home-v2.css` | card de Procesamiento con barra de job en vivo; matriz 1024 limpia | M | ☐ |
| L32 | Materiales: un solo blur en el chrome, header opaco con hairline, `backgroundColor` de la ventana a `--pulso-bg`, sombras literales a los seis tokens (el movimiento es L37) | V11 | `theme.css:633-651`, `nav-states.css`, `desktop/main.cjs:1866` | `backdrop-filter` en el header = 0; `motion` fuera | S | ☐ |
| L33 | Desduplicar Telefónico ↔ Acreditación: formateadores puros a `monitoreo/core/`, chrome `AcreditacionModuleChromeConSync` una sola vez (sin fusionar semántica de familia) | V11 | `profiles/telefonico/`, `profiles/acreditacion/` | 28 duplicados → 0; los dos page-files bajan | M | ☐ |
| L35 | El dock del header capa su ancho a `min(328px, 32vw)`: con los 8 módulos agregados más «Agregar» (9 tiles de 39 px = 351 px) el «+» se sale del borde (visto por el dueño en la maqueta, 2026-10-10; el CSS real tiene el mismo tope y `overflow: visible`). Propuesta: el dock mide lo que sus módulos y, a partir de 9+, recoge con la estrategia de overflow que la v3 ya pide para catálogos largos | V5 | `theme.css:757` (`.pulso-module-dock`), `Layout.tsx:264-305` | captura con los 8 módulos agregados a 1440 y 1024 sin que ningún tile cruce el borde | S | ☐ |
| L36 | **Formularios › Documento, un editor fiel del cuestionario en Word**, con la misma arquitectura que el editor de láminas F6 (no un «exportar con opciones»). Pedido del dueño (2026-10-10): «ya tenemos officer y el editor de láminas trabajando en una versión fiel; aquí podemos hacer lo mismo, avanzado, elegante y sofisticado, no superficial». Lo que ya existe y se reutiliza: `reporte_formulario_word.R` (segundo renderer del modelo del PDF, officer + flextable, 380 l., con colores propios fuera del estándar), `reporte_word_visor.R` (DOCX → PDF → PNG por LibreOffice y pdftools, mapa de capítulos por página), `estandar_pulso.json` (`ppt` y `word`) y el patrón visor + inspector + estructura de `features/graficos/laminas/`. Fases: **DOC.0** dirección de diseño y recetario del cuestionario (qué patrón impreso tiene cada tipo: casillas, cajas de dígitos, matrices Likert con extremos, abiertas con líneas, saltos y filtros como instrucciones, notas al encuestador; portada, identidad, numeración, pie), aprobada como F6 · **DOC.1** clave `cuestionario` en `estandar_pulso.json` y el motor leyendo el estándar (sin hex propios; `ranurasEstandar.generated.ts` equivalente) · **DOC.2** visor fiel: páginas reales rasterizadas por job con mapa sección → pregunta → página, estados «regenerando» y «desactualizada» por hash del instrumento · **DOC.3** bloques seleccionables sobre la página (`foco=p-02:P5`) con inspector contextual del bloque (formato de opciones, columnas, código visible, texto de la instrucción de salto, nota) y del documento (plantilla, numeración, idioma, ocultas) · **DOC.4** opciones persistidas en el `.pulso` y versiones ligadas a la versión del instrumento, generación como job cancelable · **DOC.5** QA: contrato de artefactos, golden de estructura del `.docx` y comparación visual sabiendo que LibreOffice y Word difieren (trampa documentada del PPT). Secciones del módulo: Editor y Documento; pestañas de Documento: Portada e identidad, Preguntas, Lógica impresa, Estilos, Vista previa, Versiones | V5, V6 | `features/xlsformEditor/documento/` (nuevo, calcado de `graficos/laminas/`), `lib/modules.ts`, `api/inst/estandar/estandar_pulso.json`, `api/R/reporte_formulario_word.R` → `cuestionario_word_*.R`, `reporte_word_visor.R` reutilizado, `router_xlsform_editor.R:1607` | maqueta L36; dirección DOC.0 aprobada; capturas de las seis pestañas con `acnur_pdm`; `expect_report_artifacts_registered` + golden del `.docx` + páginas PNG comparadas con la maqueta | XL (8) | ☐ |
| L37 | **Sistema de movimiento y pulido de fluidez** (pedido del dueño, 2026-10-10: «un censo de animaciones elegante y profesional y un pulimiento de animaciones, desplazamiento, deslizamientos y fluidez»). Censo medido en `censo-animaciones-2026-10-10.md`: 233 keyframes únicos, 54 loops, 34 transiciones de layout, 1.112 ms y 119 beziers literales, 13 presses frente a 1.476 hovers de color, 0 transición de sección y de pestaña, 9 de 14 «ir a» sin suavidad, 78 de 250 hojas con reduced-motion. Qué se construye: el vocabulario de 22 coreografías (M1–M22) con token y uso; transición de módulo/sección (firma de 6 px) y de pestaña (fade 120, nada por teclado); `Dialog`/`Sideover`/popover con scale .96 y origen en el disparador; press .97 y elevación en todo lo presionable; insertar/quitar con `grid-template-rows`, reordenar con FLIP a 220; skeleton → contenido por crossfade; toast por transición con `@starting-style`; scroll: `overscroll-behavior`, «ir a» suave con `block: nearest` y reserva de 16 px (instantáneo por teclado), sombra en cabeceras pegajosas, `scroll-snap` en tiras; barras con `scaleX`; loops solo en spinner y skeleton; stagger ≤ 4 × 30 ms; reduced-motion global; `motion` fuera. Contrato de movimiento (vitest): cero `transition` sobre layout, cero literales de ms y bezier fuera de `tokens.css` en archivos migrados, cero `infinite` fuera de spinner/skeleton; medición de frames largos con Playwright | V11, **V12** | `tokens.css`, `theme.css` (61 keyframes → catálogo), `nav-states.css`, `components/*` (Dialog, Sideover, Popover, Toaster, Switch, PulsoButton, Table), `calcMuestra/**` (27 transiciones de `width`), `scripts/` (medición), `package.json` (`motion`) | maqueta L37 (laboratorio interactivo); contrato verde; captura con `prefers-reduced-motion` emulado; 0 frames > 16 ms en cambio de sección y apertura de diálogo | M | ☐ |
| L38 | **Monitoreo: un verbo por dirección** (pedido del dueño, 2026-10-10: «los botones para actualizar la data tienen bastantes funciones distintas, algo confuso con botones blancos y rojos; entender en profundidad qué hace cada uno y una forma natural y orgánica de ordenarlo»). Censo en `censo-acciones-datos-monitoreo-2026-10-10.md`: «Avance»/«Todo» hacen cosas distintas por perfil (en aulas «Avance» no trae nada y «Traer respuestas» trae, publica y borra filas de un Sheets sin confirmación; en territorial cuatro rótulos hacen la misma descarga y «Todo» es una fuente de una fase; en telefónico/acreditación hay dos «Todo»); el rojo es el tono del módulo como relleno; lo destructivo va sin tono ni confirmación. Qué se construye: un solo control `Actualizar ▾` en el chrome de los cuatro perfiles (cuerpo = incremental + recalcular; menú = una fila por fuente con «Traer nuevas»/«Traer todo de nuevo», «Traer todo de nuevo», «Recalcular», «Conectar otra fuente») y píldora de estado (Al día / Pendiente de recalcular / Parcial / Falló); diccionario de siete verbos (Actualizar, Traer todo de nuevo, Recalcular, Conectar, Leer, Publicar, Generar) y `--danger` sólo para Anular/Retirar/Quitar/Marcar cierre/Aplicar con poda; Publicar nunca en el chrome y siempre con ensayo Revisar → Aplicar que enseña filas añadidas, cambiadas, borradas y hojas que encogen; un sync a la vez (dedupe de `job_submit`) y recibo visible; retiro de la franja «Sheets · Kobo · Todo», de los tres duplicados territoriales y del segundo «Traer respuestas»; contrato vitest (§5.5 del censo) | V3, V5, **V13** | `shell/MonitoreoModuleChrome.tsx` (+ `shell/ControlActualizar.tsx` nuevo), `components/SourceSyncActions.tsx` (retiro), `profiles/*/sync/*`, `profiles/territorial/TerritorialSourceConsole.tsx`, `profiles/aulas/AulasOperationsPanel.tsx`, `AulasMonitoreoPage.tsx`, `api/R/router_monitoreo.R` (ensayo `aplicar:false` en `/aulas/publicar-libro`, dedupe en `jobs.R`), tests | maqueta L38; contrato verde; capturas de las cuatro pantallas de §4.4 del censo con un solo control; testthat del ensayo sin red | L | ☐ |
| L34 | Tema oscuro | — | — | — | — | **descartado** por el dueño (2026-10-10): la app es de tema único; no se vuelve a proponer |

## Espera al dueño

Las que no puedo tomar yo, con su material. Todo lo demás se ejecuta y se
revisa por el loop.

| # | Decisión | Material | Por qué no la tomo | Mi recomendación |
|---|---|---|---|---|
| D1 | **Formularios**: qué se recoge de su banda (selector, tres métricas, dos chips, toggle, «Más vistas», avisos, seis acciones) para entrar a `ModuleCommandBar` | `lib/modules.ts:356-365` declara la excepción como «decisión de producto, no de layout»; `ModuleCommandBar` ya degrada por `rank` y recoge chips al menú sin perderlos | la excepción está amparada en un ADR y la propia nota dice que decidir qué se recoge es de producto | A: command bar con rangos (métricas rank 2, acciones secundarias rank 3 al menú); la excepción se retira |
| D2 | **Dashboard** (P7 del plan de rebranding): capa `dash-*`, rail `dash-tab-nav`, donut arcoíris | `docs/ui-layout-grammar.md:310` y `plan-rebranding.md` P7 dicen «decide el usuario»; es superficie que ve el cliente | está marcada como gate humano en dos documentos | el chrome de administración migra (rail + command bar); el artefacto publicado conserva su capa `dash-*` y pasa a secuencial navy |
| D6 | **Tema oscuro** | — | **Resuelta (2026-10-10): descartado.** Prosecnur es de tema único; no se promete ni se maqueta | — |
| D3 | Contrato geométrico «mismo alto, ancho intrínseco» | decisión 8 del loop anterior, reevaluada en su iteración 18 | la recomendación ya cambió una vez (B → A) | A: tercer contrato `banda`; lo ejecuto en L12 salvo veto |
| D4 | Marco del vacío del kit | decisión 9 del loop anterior; `states.css:107-111` | es vocabulario del kit | B: el marco es de la superficie; renombrar la variante; lo ejecuto en L24 salvo veto |
| D5 | Nombre de la cifra hero del Marco | decisión 10; ya rotulada «Elegibles por curso-horario» | es vocabulario metodológico | A: conservar hero con ese nombre; nada que ejecutar |
| D7 | Paleta categórica de Plotly (10 tonos) | `plotlyTheme.ts:50-61` | el espíritu de la dirección es «un acento por gráfico» pero la letra no lo prohíbe | acotar a navy + un acento + grises; lo ejecuto en L29 salvo veto |
| D9 | ¿Actualizar en aulas sigue publicando el libro y retirando filas en el mismo clic? | censo de acciones §6 | recomendación: no; Actualizar lee, Publicar escribe con ensayo; el ciclo de un clic va como ítem explícito «Actualizar y publicar» con el mismo ensayo | ☐ |
| D10 | ¿«Marcar cierre» debe poder deshacerse desde la UI? | censo de acciones §6 | recomendación: sí, «Reabrir campo» con motivo | ☐ |
| D11 | ¿«Actualizar» en territorial incluye la Hoja de ruta por defecto? | censo de acciones §6 | recomendación: sí, excluible por fuente en el menú | ☐ |
| D12 | ¿Se retiran las tarjetas de fase de la consola territorial? | censo de acciones §6 | recomendación: sí, hoy no cambian la fase de la UI | ☐ |
| D13 | El carmesí de Monitoreo choca con el color de peligro: ¿tono o pieza `--danger`? | censo de acciones §6 | recomendación: cambiar la pieza `--danger` para que se distinga del tono a simple vista | ☐ |
| D8 | Desduplicar Telefónico ↔ Acreditación | decisión de independencia vigente (no fusionar) | la independencia es decisión del dueño | extraer solo primitivas puras (L33); la semántica de familia no se toca |

## Ledger

Se vuelve a medir al cierre de cada vuelta. Baja o no cierra la vuelta.

| Métrica | 2026-10-10 | Vuelta 1 | Vuelta 2 |
|---|---:|---:|---:|
| `role="dialog"` fuera de la primitiva | 61 | | |
| Paneles direccionables / overlays reales | 10 / ~50 | | |
| Flujos de Carga con `JobProgress` | 0 / 7 | | |
| Capturas INVALID (spinner con `ok=true`) en la matriz del censo | 7 | | |
| Patrones de cabecera de pestaña | 12 | | |
| Copias bespoke de `SectionPillbar` | 5 | | |
| Módulos con pestañas sin rail de 56 px | 3 | | |
| `useState` que gobiernan navegación | 42 | | |
| `toolbar=` deprecado | 3 | | |
| Lecturas de avance sin denominador (Home + Monitoreo) | 5 | | |
| `<input` crudos | 696 | | |
| `<button` crudos / `PulsoButton` | 1.960 / 39 | | |
| Hex en CSS de features (Monitoreo) | 4.468 (3.115) | | |
| `font-size` literal (bajo 10 px) | 8.188 (108) | | |
| Tokens `--pulso-*` sin definir (contrato) | 23 | | |
| `TelefonicoMonitoreoPage.tsx` / `AcreditacionMonitoreoPage.tsx` / `BasesPanel.tsx` | 20.397 / 18.487 / 6.719 | | |
| Audit del agentic OS | verde | | |

## Trampas (lo que ya costó una conclusión falsa)

- **Readiness ≠ render.** Siete capturas con spinner salieron `ok=true`; sin
  `--post-click-wait-selector ".js-plotly-plot"` los paneles de ritmo salen en
  blanco y aprobados. Un skeleton nuevo no puede declarar readiness.
- **`scrollJails=0` no prueba ausencia de jail.** Home a 1024×600 corta la
  primera fila sin dueño de scroll y el detector no lo ve; la captura
  full-page de 600 px sí.
- **Una `?pestana=` que no resuelve aterriza muda** y produce N capturas
  idénticas aprobadas; `md5 -q | sort -u | wc -l` antes de juzgar.
- **Los fixtures no cubren los módulos aguas abajo**: Recopiladores y Gráficos
  solo se ven vacíos; Dashboard exige doble siembra; aulas no tiene fixture
  (copia de un estudio real, nunca commiteada).
- **Los page-files congelados no pueden crecer**: todo lo de Monitoreo y
  `BasesPanel` se hace por extracción a archivo nuevo, nunca editando hacia
  arriba.
- **Los portales salen del alcance de los tokens del módulo**: `Dialog.tsx`
  debe re-inyectar `moduleChromeVars`.
- **Un grep crudo de tokens sin definir da 56; el contrato da 23**: el
  contrato es la autoridad, el grep incluye nombres con fallback.
- **Otra sesión trabaja en Gráficos a la vez** (láminas, sin commitear al
  momento del censo): no tocar `features/graficos/` sin coordinar.

## Bitácora de vueltas

| Vuelta | Fecha | Ítems | Números movidos | Commits |
|---|---|---|---|---|
| 0 | 2026-10-10 | apertura: censo + vara + cola | — | `c98206e35`, `480b7f369`, `56905391e` |
