# Plan Prosecnur UI v3 — renovación completa con identidad visual evolucionada

Revamp y reformulación estética completa — módulo · sección · pestaña.

| Campo | Valor |
| --- | --- |
| Versión | 3.0 (re-editada 2026-07-24 por la indicación 5) |
| Fecha | 2026-07-23 · re-edición 2026-07-24 |
| Estado | Vigente, en ejecución por el bucle (§12) |
| Meta | **UI v3**: tercera generación de la interfaz (las superficies actuales son la generación v2), completamente renovada, con una **identidad visual v3 evolucionada y mejorada** dirigida por Claude y revisada por el usuario. El isotipo y la marca canónica (ADR 0038) se conservan; todo lo demás evoluciona. |
| Alcance | Toda la app: shell, homepage, 8 módulos, sus secciones y pestañas |
| Modo | **Bucle de convergencia** (§12): el plan itera auditar→ejecutar→verificar y solo se cierra cuando el usuario lo declara |
| Decisión estructural | **Top bar ratificada + uniformidad** (2026-07-24, indicación 5, ADR 0042): el concepto vigente — top bar de secciones + rail icon-compressed de pestañas — se conserva como canon; el foco del revamp es **uniformarlo en los 8 módulos y pulirlo a nivel macOS-like**. Revierte la decisión sidebar del 2026-07-23 (ADR 0041 → Reemplazado). |
| Normas | `branding/direccion-creativa.md` v1.2 (ADR 0038) · guía general de UI de escritorio (`Art_app/docs/guia-general-ui-alto-sidebar-secciones-pestanas.md`) · `docs/ui-layout-grammar.md` |
| Diagnóstico | Tres líneas independientes ejecutadas el 2026-07-23: inventario de navegación (código), auditoría de código contra la guía (file:line), QA visual en vivo con `prosecnur_audit_reference.pulso` (40+ capturas, 1280×800 y 1100×600, botones/popovers/teclado reales) |

---

## 0. Tesis del plan

La app tiene **una arquitectura de layout ejemplar y una marca canónica sólida** (isotipo «ecualizador del pulso», ADR 0038), pero la dirección de identidad v1.2 **no gobierna la superficie** — cada módulo habla su propio dialecto visual (botones, empty states, spinners, popovers, paletas hex, lenguajes de sección distintos), la semántica de navegación está sistemáticamente mal tipada (`role="tab"` sobre rutas), los tokens carecen de roles completos (sin espaciado, sin tipografía, sin z), y el homepage/chrome contradice la propia dirección («silencioso en el chrome») con gradientes apilados, blur y fondo decorativo — **y la propia dirección v1.2 quedó corta**: canonizó patrones que la guía y el uso real desmienten (pillbar centrado como selector de secciones, rails icon-only en expandido) y nunca resolvió espaciado, tipografía tokenizada, capas z ni el tema oscuro.

Por eso la meta no es «aplicar la v1.2»: es **UI v3** — la tercera generación de la interfaz, con una **identidad visual v3 evolucionada** que Claude dirige y el usuario aprueba. Qué se conserva y qué evoluciona:

- **Se conserva (canónico, intocable)**: el isotipo y las 10 variantes de `branding/logo/`, la marca en dos tintas (navy + blanco), la jerarquía de emisión (Prosecnur · PULSO PUCP), la arquitectura de scroll (No Scroll Jail), el warm start, **y el concepto del shell** — top bar superior con las secciones del módulo + sidebar de íconos (rail icon-compressed) con las pestañas — ratificado por el usuario el 2026-07-24 (indicación 5, ADR 0042): «funciona muy bien a nivel conceptual».
- **Evoluciona bajo dirección v3**: la **ejecución visual de ese chrome** (uniformidad total entre los 8 módulos + pulido macOS-like: hoy conviven cuatro lenguajes de sección y hay módulos que no usan el chrome o lo usan diferente), la economía del chrome (silencio real: fuera gradientes apilados y fondos decorativos), el sistema de tokens (roles completos: espaciado, tipografía, z, navegación), los materiales y la elevación, los patrones maestros (los #1–#3 se re-ratifican y refinan; overlays artesanales y decoración del shell se retiran), el espectro modular (se conserva) y la voz verbal en superficie (saldar el texto crudo del dominio).

El trabajo avanza con fundaciones compartidas primero y luego módulo por módulo, sección por sección, pestaña por pestaña, **en loops explícitos** (§12): cada fase es un loop interno de auditar→ejecutar→verificar→iterar, y el plan entero es un loop global que **solo el usuario cierra** cuando declare que la v3 está completa.

### Fortalezas verificadas que el revamp NO debe romper

- **Geometría**: cero scroll de `body` en TODAS las rutas y viewports medidos (incluido 1100×600); cada vista con 1–3 scrollers internos con dueño claro. `.pulso-shell` con cadena `100dvh + min-height:0` correcta; 2,402 usos de `minmax(0, …)`. La regla **No Scroll Jail** se cumple en toda la app.
- **Teclado**: `GlidingTabList` con roving tabindex completo (flechas/Home/End).
- **Motion**: 105 bloques `prefers-reduced-motion` en 43 archivos; tokens de motion completos.
- **Marca**: isotipo canónico fiel al ADR 0038 en `Layout.tsx` (BrandMark) y `BootGate.tsx` (BootBrandMark).
- **Datos limpios**: labels en sentence case en la fuente; mayúsculas solo por CSS (894 `text-transform`).
- **Manifiesto de módulos** real en `frontend/src/lib/modules.ts` (slug, title, icon, tone, ruta), consumido por Home, ModuleSwitcher y picker.
- **Accesibilidad de nombre**: 2,200 `aria-label`; tooltips del rail responden a hover **y** `:focus-visible`.

---

## 1. Mapa canónico actual (base del plan)

Jerarquía oficial: **Módulo/Familia** (homepage) → **Sección** (top bar del módulo) → **Pestaña/subtab** (tercer nivel). Gráficos y Analítica son **secciones de Procesamiento**, no módulos.

| Módulo (slug) | Ruta | Secciones | Pestañas/tercer nivel | Page principal (líneas) |
| --- | --- | --- | --- | --- |
| Bitácora (`diseno-estudio`) | `/bitacora` | Bitácora · Cronograma · Calendario (`?tab=`) | — | `BitacoraPage.tsx` (172) |
| Cálculo de muestra (`calc-muestra`) | `/calc-muestra` | «Mesas» por tipo (`?mesa=`): Acreditación (3 pasos), Aulas/universidad… | universidad: grupos Definición/Marco/Cálculo/Salidas (`universidadTabs.ts`) | `CalcMuestraPage.tsx` (3,614) |
| Editor de formularios (`editor-xlsform`) | `/editor-xlsform` | Modos builder/sheets + workspace focus | Breadcrumb propio de canvas, RuleWizard | `XlsformEditorPage.tsx` (4,690) |
| Hojas de ruta (`hojas-ruta`) | `/hojas-ruta` | Stepper: Territorio · Población · Muestra · Manzanas · Entrega | Entrega: Cuotas/Titulares/Reemplazos | `HojasRutaPage.tsx` (9,002) |
| Fichas QR (`recopiladores`) | `/recopiladores` | Preparación · Fichas · Paquete | (Agenda, Enlaces) / (Vista previa, Lista) / (PDF final, Monitoreo) | `RecopiladoresPage.tsx` (2,482) |
| Monitoreo (`monitoreo`) | `/monitoreo` | Perfiles: territorial · acreditación · aulas · telefónico | Sidebar icon-compressed agrupado (fuentes/modelo/calidad/consultas/avance…) | `MonitoreoShell.tsx` → perfiles (legacy 44,232 **congelado**; telefónico 21,195; acreditación 19,071) |
| Procesamiento (`procesamiento`) | `/procesamiento` | **Carga · Validación · Codificación · Analítica · Gráficos** (ProcessingPhaseDock) | Por sección (ver §6) | Carga 2,844 · Validación 358 · Codificación 330 · Analítica 334 · Gráficos 355 |
| Dashboard (`dashboard`) | `/tablero` | Tabs configurables: resumen/relaciones/base_datos/dimensiones | — | `DashboardPage.tsx` (419) |

Fuera de la jerarquía: `/enciclopedia` (layout legacy, ruta huérfana, no aparece en Home ni en el dock) y `/muestra` (alias de `/calc-muestra`). Slug `plan-trabajo` y token `--pulso-module-workplan` huérfanos tras la fusión en Bitácora.

---

## 2. Diagnóstico consolidado (con evidencia)

### D1 — El chrome contradice la identidad (severidad: alta; foco del revamp)

- Header con 2 gradientes + inset shadows + `blur(18px)` + `::after` de gradiente (`app/theme.css:797-826`); nav-cluster con 3 gradientes más (`:846-870`); **fondo de papel cuadriculado decorativo en todo el shell** (`:789-794`). La dirección creativa manda «silencioso en el chrome, protagonista en el dato» y proporción 60/30/10.
- Cuatro lenguajes de «sección» conviven en vivo: pills numeradas verdes (Procesamiento), pills numeradas rojas con toolbar densa (Monitoreo), pills centradas sin número (Bitácora/Tablero), texto plano (toolbar del Tablero) y steppers ad-hoc (calc-muestra, hojas-ruta, fichas QR). El patrón maestro #2 (pillbar centrado) existe, pero no es ley.
- **Tablero**: paleta default saturada tipo Plotly en los charts (choca frontalmente con el secuencial navy normativo) y lenguaje de UI propio (links subrayados, segmented azul, toolbar de texto). **Enciclopedia**: layout legacy sin banda de módulo ni paleta.

### D2 — Tokens sin roles completos y 4,376 hex fuera del sistema (severidad: crítica)

- `theme.css` define 146 tokens, pero **faltan roles enteros** (guía §21): cero `--space-*` (todo padding/gap es valor mágico), cero tokens tipográficos (8 trackings distintos para la misma voz: 121× `0.04em`, 109× `0.06em`, 95× `0.05em`, 73× `0.08em`…), cero tokens de capa z, sin `--nav-item-height`/`--sidebar-width` genéricos.
- **4,376 hex hardcodeados** en CSS de features (+288 inline en TSX): `monitoreo.css` 2,140 · `hojasRuta.css` 323 · `profilePage.css` 300 · `xlsform-v2.css` 212 · `outputsWorkbench.css` 190 · `carga-v2.css` 189. Monitoreo define paletas paralelas completas (`monitoreo.css:349-367,440`). Rompe la regla de la casa y hace inviable el tema oscuro (hoy vestigial: 4 tokens en `data-theme="dark"`).
- Deriva z-index: convención 1400 confirmada como intención, pero Gráficos v2 escala 1200/1300/1400/1500/5000/**10000** (`editor-v2.css:6277,20050,22031,24901,30685`).
- ~30 alturas mágicas `calc(100dvh - Npx)` acopladas al alto del chrome (`theme.css:3616,4051,5549,6349,14042,25977`; `calcMuestra.css:985,1105`; `monitoreo.css:1396`; `processingSheetViewer.css:29`). 143 usos de `100vh` conviviendo con `100dvh`.

### D3 — No existen primitivos compartidos de superficie (severidad: crítica)

- **Cero botón compartido**: cada módulo inventa su familia (`dash-*`, `cmv2-*`, `plan-*`, `pulso-gv2-*`, `pulso-xf-*`…). Los tokens `--pulso-control-height-*` existen pero solo se usan 21 veces en `features/`.
- `components/PageHeader.tsx` tiene **cero importadores**; `PageFrame` no se usa en Dashboard, Recopiladores ni Home.
- 194 familias de empty-state custom frente a `components/States.tsx`; 4 linajes de spinner con 7 `@keyframes` de spin propios.
- Overlays en tres linajes: Radix (7 archivos, correcto), `components/Popover.tsx` (Escape sin trap), y ~50 `role="dialog"` artesanales **sin focus trap ni restauración de foco** pese a `aria-modal="true"` (`ModulePickerDialog.tsx:20-27`, `ConfigurarPdfDialog.tsx:156-165`, popovers de `GraficosHeader.tsx:878,1121,1274`). Escape gestionado en 72 archivos, cada uno con su listener.

### D4 — Semántica de navegación mal tipada (severidad: crítica)

- **76 `role="tab"` vs 22 `role="tabpanel"`**: la mayoría son navegación con rutas reales — el antipatrón 23.3 literal. Ancla: `Layout.tsx:189-193` (secciones de Procesamiento como NavLink+`role="tab"`+`aria-selected`) y `MonitoreoModuleChrome.tsx:180`.
- Tablist inválido: `role="tablist" > ol > li > tab` (`Layout.tsx:169-179`); botones con `role="tab"` + `aria-selected` + `aria-current` a la vez (`MonitoreoWorkbenchRail.tsx`); **`NavLink role="listitem"` en el ModuleSwitcher suprime la semántica de enlace** (`Layout.tsx:267`).
- `aria-current` subutilizado (19 ocurrencias en toda la app).
- Pestañas icon-only en estado **expandido** en Telefónico (`TelefonicoMonitoreoPage.tsx:20524`) y Acreditación (`AcreditacionMonitoreoPage.tsx:18434`) — viola MUST 5.4 (atenuante: aria-label + tooltip por hover y foco).

### D5 — Manifiesto de navegación fragmentado (severidad: alta)

- El manifiesto único existe **solo a nivel módulo**. Las 5 secciones de Procesamiento viven en ≥6 fuentes: `useNavItems` (`Layout.tsx:95-125`), `PROCESAMIENTO_PATHS` (`:30-37`), `VIEWPORT_PATHS` (`:63-79`), rutas de `App.tsx:149-179`, labels abreviados duplicados 2× dentro del mismo Layout (`:408-414`, `:487-493`) y `HomePage.tsx:37-43`.
- `VIEWPORT_PATHS` es una allowlist manual: **una ruta nueva no registrada cae en scroll de página por defecto** — inversión del MUST de la guía.
- Sin breadcrumb global; subtabs definidos en arrays locales por página sin registro central.

### D6 — Bugs visuales y de interacción observados en vivo (recorrido real)

| # | Hallazgo | Severidad | Dónde |
| --- | --- | --- | --- |
| 1 | **«NaN%» crudo** en columna PRECISIÓN (componentes no probabilísticos) | Alta | Calc-muestra Acreditación, paso Resultados |
| 2 | Chips de readiness **partidos a mitad de palabra** («Territori o: 2 distritos», «Poblaci ón: lista») — label constreñido a ~44px | Alta | Hojas de ruta, header, todos los pasos |
| 3 | «···» de las cards del Home salta **directo al confirm destructivo** «¿Quitar X?» sin menú | Alta | Home / MissionControl |
| 4 | Ese confirm **no cierra con Escape** (los demás diálogos sí) | Alta | Home / MissionControl |
| 5 | Paleta default saturada de charts rompe la identidad | Alta | Tablero |
| 6 | Mini-KPIs de «PDF FINAL» recortados a media altura por la card siguiente | Media | Fichas QR, paso Paquete |
| 7 | Colisión fecha/valor «20 jun. 20260» en card Monitoreo | Media | Home |
| 8 | Checks snake_case en inglés («anonymous_responses»), headers «WAVE», «TITULAR OPERATIONAL CODE», hashes de 64 chars expuestos, «6 alertas» cuando las 6 están ok | Media | Monitoreo |
| 9 | Rails icon-only sobrecargados (~11 íconos en Analítica, ~7 en Aulas) + dots verdes sin leyenda | Media | Analítica, calc-muestra Aulas |
| 10 | Stepper «ESTADO 1/2/3» duplicado en la misma pantalla | Media | Carga |
| 11 | Deep-link `/?agregar=1` inerte en carga directa | Media | Home |
| 12 | Copy: «Poblacion», «caidas», «Si» sin tilde; «1 grupos»; «RESPUESTAS VALIDAS»; chips crípticos «2/18», «9/9» | Media/Baja | Hojas de ruta, Fichas QR, Monitoreo, Gráficos |
| 13 | Footer del Home con targets de ícono 11px; 1 botón sin nombre accesible en header | Baja | Home |
| 14 | BootGate: aire vertical sin estructura a 1280×800; doble borde punteado; `svg role="img"` dentro de `aria-hidden` | Baja | BootGate |
| 15 | `data-audit-ready` ausente en Validación, Codificación, Bitácora (×3), Fichas QR y Enciclopedia | Media | Contrato de QA |

### D7 — Masa crítica de archivos (afecta la viabilidad del revamp)

`monitoreo.css` **59,676** líneas · `editor-v2.css` 33,033 · `theme.css` 30,354 · `profilePage.css` 10,866 · page-files de 21k/19k líneas en perfiles de Monitoreo. El congelamiento de `MonitoreoPage.tsx` se está drenando hacia el CSS. Todo cambio de estos módulos va en **archivos nuevos** (regla de la casa).

---

## 3. Dirección v3

**Norte**: una identidad v3 evolucionada — heredera de «La señal ordenada» pero corregida por la evidencia — gobernando el 100% de la superficie, con la guía de UI de escritorio como contrato geométrico/semántico. Seis decisiones rectoras:

1. **Chrome de módulo uniforme como columna vertebral** (indicación 5, ADR 0042). El shell canónico es el concepto vigente, ejecutado con disciplina: **command bar superior de tres zonas** — contexto | rail de secciones (pillbar) | acciones — y **rail icon-compressed de pestañas** con burbuja hover/foco + título compacto de pestaña activa en el workbench (patrones maestros #1–#3 re-ratificados). Los 8 módulos usan LOS MISMOS componentes (`ModuleCommandBar`, `SectionPillbar`, rail canónico) alimentados por el manifiesto; las variaciones (densidad, numeración solo con pipeline real, progreso) se declaran, no se improvisan. **Overflow con dignidad**: la command bar define su degradación (envolver → compactar → menú) verificada a 1024×600 — los chips de estado nunca desaparecen sin alternativa (salda la colisión KPIs↔recorrido documentada en la indicación 2).
2. **Chrome silencioso, dato protagonista.** El header y la command bar pierden los gradientes apilados y el fondo decorativo; el material (blur/translúcido) queda SOLO en las capas de navegación y comando. Separación estricta **navegar** (secciones/pestañas) / **operar** (KPIs, fase, acciones de la command surface) / **identidad** (proyecto, guardado, Home en el header global). Proporción 60/30/10 real, factura macOS-like.
3. **Un solo lenguaje por nivel de jerarquía.** Módulo = homepage + dock del header (pulido). Sección = pill de la command bar (número SOLO donde hay pipeline real, como progreso). Pestaña = ítem del rail icon-compressed (con identificación persistente vía título compacto). Stepper compartido solo para flujos secuenciales internos a una sección, con labels visibles en todos los pasos.
4. **Primitivos antes que páginas.** Botón, diálogo/popover, empty state, spinner, command bar: primero el primitivo compartido, después la migración módulo a módulo. Nada del revamp se implementa con una familia nueva por módulo.
5. **Manifiesto de navegación total.** `lib/modules.ts` se extiende a secciones y pestañas: labels (sentence case en datos, mayúsculas por CSS), rutas, íconos, política de layout (`viewport` por defecto; `legacy-scroll` como excepción declarada) y estado de bloqueo derivan de UNA fuente que alimenta la command bar, el rail, el router y el homepage.
6. **Semántica honesta.** Links para rutas (`aria-current="page"`), tabs ARIA solo con tabpanel real, selector segmentado para modos de vista. Teclado completo en command bar y rail de pestañas (el rail comprimido cumple los requisitos de icon-only de la guía §10.6: nombre accesible, burbuja por hover **y** foco, Escape). Se corrige de raíz, no cosméticamente.

---

## 4. Fase 0 — Fundaciones (bloqueante para todo lo demás)

**Objetivo**: que el revamp de cada módulo sea aplicar un sistema, no reinventarlo. Todo en archivos nuevos o `theme.css` aditivo; sin tocar comportamiento de dominio.

### 4.0 Congelar la dirección v3 (primer entregable de la fase)

Claude mantiene **`branding/direccion-creativa-v3.md`**: la evolución de la dirección v1.2 con las decisiones de §3 aterrizadas — anatomía exacta del **chrome de módulo horizontal** (command bar de 3 zonas: medidas, densidades, material, overflow; rail de pestañas: ancho, burbuja, título compacto), patrones maestros v3 (los #1–#3 refinados como norma; qué se retira: overlays artesanales, decoración del shell), roles de token nuevos, voz de secciones/pestañas, y mocks estáticos del chrome (HTML de referencia). La ejecución avanza y el usuario la revisa/veta por el bucle (gobierno por revisión, INDICE). Se acompaña de los ADRs de §4.5.

### 4.1 Tokens (theme.css + docs)

- **Espaciado**: `--space-1..8` (escala base 4 de la dirección creativa). Nuevas superficies la usan; las migradas la adoptan.
- **Tipografía**: tokens de la escala «Voz nativa» (display/título/sección/cuerpo/nota/pie/micro) + **un solo tracking de voz micro** (`--pulso-tracking-micro: 0.06em`) que reemplaza los 8 valores actuales al migrar.
- **Capas**: `--z-toolbar: 1000`, `--z-flyout: 1400` (popovers/menús/tooltips), `--z-modal: 1500`, `--z-boot: …`. Gráficos v2 (5000/10000) se reencaja en la escala.
- **Navegación**: `--nav-item-height`, `--subnav-item-height`, `--rail-compressed-width` (56px canónico), `--active-rail-width`.
- Barrido `100vh → 100dvh` (excepto print) y **eliminación de los ~30 `calc(100dvh - Npx)`** en favor de cadenas `min-height:0` (uno por uno, con QA de la vista afectada).

### 4.2 Primitivos compartidos (`frontend/src/components/`)

- **`PulsoButton`**: variantes primary/secondary/ghost/danger/icon, alturas por `--pulso-control-height-*`, presión `scale(.98)` (Física Pulso). Es el único botón permitido en superficies nuevas o migradas.
- **`PulsoDialog` / `PulsoPopover`** (sobre Radix, ya en deps): focus trap, foco inicial, restauración de foco, Escape, `--z-*`, motion `panel`. Los ~50 diálogos artesanales migran por oleada; **prohibido** crear overlays a mano desde la Fase 0.
- **`EmptyState` y spinner únicos** (evolución de `States.tsx`): geometría que conserva la región (guía §22), un solo `@keyframes`.
- **`PageHeader` real o su eliminación formal**: dado que la identidad manda «sin franjas de título» (`headerMode="sr-only"`), se decide: PageHeader muere como componente visual y se documenta el patrón «identidad en el chrome» como norma (recomendado), o se adopta. No puede seguir como letra muerta.
- **`ModuleCommandBar` + `SectionPillbar` + rail de pestañas canónico**: el primitivo central de la v3, alimentado por el manifiesto (§4.3). Command bar de 3 zonas (contexto | secciones | acciones) con material contenido, acento por `--module-accent`, degradación de overflow declarada (envolver → compactar → menú) y semántica de links con `aria-current="page"`; pillbar con numeración solo-pipeline; rail icon-compressed con `aria-label` completo, burbuja hover+foco y **título compacto de pestaña activa** en el workbench (la identificación persistente que legitima el rail comprimido). Se construye UNA vez y los 8 módulos lo consumen; hoy cada módulo trae su versión o ninguna.
- **`StageStepper` compartido**: stepper canónico para flujos secuenciales internos a una sección (labels visibles en TODOS los pasos — corrige el paso 4 icon-only de Hojas de ruta).

### 4.3 Manifiesto de navegación

- `lib/modules.ts` gana `sections[]` por módulo: id, label, shortLabel, icon, path, `layoutPolicy` (`viewport` | `legacy-scroll`), `lockedReason?`. De ahí derivan: rutas de `App.tsx`, `ProcessingPhaseDock`, `PROCESAMIENTO_PATHS`, `VIEWPORT_PATHS` (que se invierte: **viewport por defecto**), labels abreviados del `SiblingWorkbenchSelector` y `useProcesamientoState` del Home.
- Se salda la deuda huérfana: eliminar (o documentar) slug `plan-trabajo` y token `--pulso-module-workplan`; **decidir el hogar de Enciclopedia** (recomendado: utilidad global accesible desde el footer/ajustes del Home, no módulo del proyecto) — merece ADR-lite.

### 4.4 Semántica y accesibilidad de navegación

- `role="tab"` solo donde hay tabpanel: las secciones (Layout, MonitoreoModuleChrome) pasan a `<nav>` + links con `aria-current="page"`; `GlidingTabList` gana un modo `nav` que conserva el roving keyboard sin roles de tab.
- ModuleSwitcher: fuera `role="listitem"` de los NavLink; estructura `nav > ul > li > a`.
- `MonitoreoWorkbenchRail`: una sola semántica (link con `aria-current`), nunca tab+link a la vez.
- Política de foco post-navegación única para toda la app (guía §13.3) documentada en la gramática de layout.

### 4.5 ADRs de la v3

- **ADR 0042 «Chrome de módulo uniforme»** (aceptado 2026-07-24): ratifica el top bar de secciones + rail de pestañas como canon, ordena la uniformidad en los 8 módulos y el pulido macOS-like; reemplaza al ADR 0041 (sidebar), que queda como registro histórico.
- **ADR-lite** por: manifiesto de navegación extendido, hogar de Enciclopedia, política de tema oscuro, dirección v3 (`direccion-creativa-v3.md`), y retiro del código sidebar tras flag (borrado con confirmación explícita del usuario).

**Gate Fase 0**: typecheck + vitest + test de contrato de navegación nuevo (rutas únicas, labels no vacíos, icono en toda pestaña, cero labels con numeración ornamental — pseudotests de la guía §25.2) + `make ui-quick-check` en matriz.

---

## 5. Fase 1 — Chrome canónico del shell, Homepage y BootGate (revamp mayor)

El capítulo prioritario: aquí nace visualmente la v3. Hoy el Home funciona pero su chrome grita: gradientes apilados, papel cuadriculado, cards con micro-roturas, footer con targets de 11px, picker sin disciplina modal, «···» que solo destruye — y la command bar existe pero no es uniforme ni pulida.

### 5.0 El chrome canónico del shell (indicación 5 / ADR 0042)

- **Se construye `ModuleCommandBar` (§4.2)** y Procesamiento se re-viste primero como referencia viva del canon; el resto de módulos adopta en las fases 2–6 según el orden de la indicación 5 §6.
- **Header global pulido, no eliminado**: conserva marca (isotipo canónico), dock de módulos, indicador de proyecto y estado de sesión — pero pierde los gradientes apilados, el blur duplicado y el fondo cuadriculado; superficie fría con hairline, factura macOS-like. La banda multibase de Procesamiento (`SiblingWorkbenchSelector` + `MultibaseReportMenu`) se re-viste como toolbar contextual con los primitivos.
- **Separación navegar/operar/identidad** aplicada al shell completo: las secciones navegan (command bar), los KPIs/fase/acciones operan (command surface del módulo), el proyecto/guardado/Home identifican (header). Es la norma que salda la colisión de Hojas de ruta.
- **Disposición del código sidebar** (flag `shellV3`, `AppSidebar.tsx`, `sidebar-v3.css`): no se promociona; se retira en oleada de limpieza con confirmación explícita del usuario (§4.5). Hasta entonces el flag queda inerte.

### 5.1 BootGate / chooser

- **Composición**: a 1280×800 el chooser deja aire vertical sin estructura; se rediseña como composición de dos regiones con ritmo (marca+acción arriba, recientes abajo ocupando la región completa — guía §4.4), una sola voz de borde (fuera el doble punteado).
- **Momento de marca**: la firma de arranque (stagger de pastillas del isotipo, 60ms, `slow`+productivo) se conserva como el único momento «alto» del boot; el resto del chrome se aquieta.
- Fix menor: `svg role="img"` dentro de `aria-hidden` (BootGate.tsx:1063) — decorativo o nombrado, no ambos.
- `RecentProjectCard`: alinear a la card canónica del sistema (radios/sombra fría de la escala, hover-lift `med`).

### 5.2 Homepage del proyecto (MissionControl) — reestructuración

- **Chrome**: fondo cuadriculado decorativo fuera; superficie Hielo/Niebla lisa; el header pulido de §5.0 con material contenido solo en la capa de navegación. El acento del módulo activo tiñe la selección vía `--module-accent` (ya existe), jamás el contenido.
- **Cards de módulo**: rediseño sobre el patrón KPI discreto — tile de ícono con acento del módulo, título, facts reales en mini-grid **con gaps corregidos** (fix colisión «20 jun. 20260»), hairline de acento de 2px al pie; hover-lift `med`; skeleton que conserva geometría (ya existe, se mantiene).
- **Menú «···» real**: Abrir · Ver avance/facts · (separador) · Quitar del proyecto. El confirm destructivo pasa a `PulsoDialog` (cierra con Escape, foco inicial en «Cancelar»).
- **Picker de módulos**: conserva el overlay «cinema» (está pulido) pero migra a `PulsoDialog` full-screen: focus trap, foco inicial, restauración; fix del deep-link `/?agregar=1`.
- **Footer**: targets ≥ 28px de alto de control, íconos 16px, labels visibles; acceso a Enciclopedia si se decide como utilidad global.
- **Modo setup (carrusel)**: misma dirección de quietud; el carrusel hereda las cards nuevas.

### 5.3 Selector de módulos (dock del header, pulido)

- **El dock icon-only se conserva y se pule** (es el estado colapsado legítimo de la guía §10.6): semántica de links correcta (fuera `role="listitem"`), tooltip por hover+foco, **label visible del módulo activo junto al dock** (identificación persistente), tile «Agregar» diferenciado como acción, y estrategia de overflow para cuando el catálogo supere el ancho (hoy 8 íconos + «+» están al límite, evidencia de la indicación 2 §1.4).
- **Gestor de módulos («+») rediseñado como modal** sobre la vista actual (indicación 5 §3.3): nunca expulsa a otra ruta; al cerrar, se vuelve exactamente a donde se estaba; el dock del carrusel muestra los 8+ módulos completos; fix del deep-link `/?agregar=1`.
- Botón sin nombre accesible del header: nombrar.

**Gate Fase 1**: QA visual before/after del Home, BootGate y header en 1280×800 / 1440×1000 / 1100×600, claro (y oscuro cuando exista), teclado completo (tab por cards, menú «···», picker, Escape en todo), consola limpia.

---

## 6. Fase 2 — Procesamiento (sección por sección)

Procesamiento ya es el ejemplar del concepto (ProcessingPhaseDock con las 5 fases numeradas — numeración legítima: pipeline real) y en la Fase 1 se re-viste como **referencia viva del canon** (`ModuleCommandBar` + `SectionPillbar` desde el manifiesto). Sus rails icon-compressed de pestañas se conservan y se elevan al patrón canónico (burbuja + título compacto + `data-audit-ready`). El `SiblingWorkbenchSelector` (multibase) y `MultibaseReportMenu` viven como toolbar contextual del área de trabajo (§5.0), re-vestidos con los primitivos sin cambiar su contrato.

### 6.1 Carga (`/carga`, subtabs insumos/base + segmented de origen)

- **Deduplicar el stepper «ESTADO 1/2/3»** (hoy en toolbar Y en la card «Mesa multibase activa»): una sola instancia, en la toolbar.
- Badge «0» del tab «Ver base» con 2 bases cargadas: mostrar el dato real o quitarlo (badge = dato real, guía §10.5).
- Migrar botones/empty states a primitivos; `carga-v2.css` (8,108 líneas) congela crecimiento: ajustes en archivo nuevo `carga-revamp.css`.
- El visor de base (doble header, filtros, Códigos/Etiquetas) es un punto alto: se conserva y se documenta como patrón DataSurface de referencia.

### 6.2 Validación (subtabs Explorar/Reglas del formulario/Criterios/Cierre)

- Diseño sólido: cambios mínimos. Nombrar accesiblemente los ítems del picker de campos (hoy botones sin nombre expuesto).
- Añadir `data-audit-ready`.

### 6.3 Codificación (+ detalle de pregunta)

- Patrón limpio («← Volver al listado»): conservar. Migración a primitivos + `data-audit-ready`.

### 6.4 Analítica (12 sub-vistas en 3 grupos)

- **El rail más denso de la app (~11 íconos icon-only)**: se reorganiza con el patrón canónico — separadores de grupo (Formulario / Base de datos / Reportes) visibles en el rail comprimido, burbuja hover/foco con título+subtítulo, **título compacto de la pestaña activa** en el workbench, y **leyenda de los dots de estado** (tooltip y/o badge con dato real).
- Si la agrupación no basta para el reconocimiento (gate visual de la fase), se evalúa promover grupos a secciones de la command bar — decisión de diseño en la oleada, con QA before/after; nunca se ocultan destinos.

### 6.5 Gráficos (prep → editor v2 → exportar)

- **Toolbar**: chips numéricos crípticos («2/18», «9/9») ganan label o tooltip inmediato; «Lámina 3/4» y «4 slides» se unifican en una sola voz.
- A 1100×600 el botón Exportar no puede quedar icon-only sin nombre visible: overflow a menú con label (guía: acciones secundarias a menú).
- **Z-index**: reencajar 1500/5000/10000 en la escala `--z-*`.
- Popovers de `GraficosHeader` (role="dialog" sin modal ni trap) migran a `PulsoPopover`.
- `editor-v2.css` (33k) congela crecimiento: cambios en archivo nuevo.

**Gate Fase 2**: QA visual de las 5 secciones y sus pestañas (cada pestaña visitada y capturada), matriz de viewports con 1024×600 incluido (chips y pills sin recortes), teclado completo de command bar y rail, consola limpia, `data-audit-ready` completo en las 5.

---

## 7. Fase 3 — Monitoreo (por perfil; todo en archivos nuevos)

Restricción dura: `MonitoreoPage.tsx` y `monitoreo.css` congelados; los perfiles telefónico/acreditación ya nacieron gigantes — **cero crecimiento de esos archivos**; todo cambio en `monitoreo_revamp_*.css` / componentes nuevos.

- **Chrome canónico**: la command bar de Monitoreo se descarga separando navegar de operar (indicación 5): las secciones/grupos de cada perfil van al rail de secciones canónico y la toolbar operativa densa (Modo, Avance, Regenerado, corte) queda en la command surface — hoy ambas cosas compiten en una sola banda apretada. Los rails de pestañas de Telefónico y Acreditación adoptan el patrón #3 completo: rail comprimido + burbuja + **título compacto de la pestaña activa al inicio del workbench** (la identificación persistente que hoy falta y que legitima el icon-only).
- **Voz del dominio**: mapa de labels es-PE para checks y headers (fuera «anonymous_responses», «WAVE», «TITULAR OPERATIONAL CODE», «RESPUESTAS VALIDAS» sin tilde, «PCT»); hashes truncados con copy-al-click; «6 alertas» → «6 checks al día» cuando todo está ok (estado ok con señal visual, no texto plano).
- **Paletas paralelas hex** (`monitoreo.css:349-367,440`): los accents por fuente se re-declaran como tokens (`--pulso-source-*`) en theme.css y los nuevos archivos los consumen; el CSS congelado se migra oportunísticamente (solo donde ya se toque).
- Toolbar única muy cargada: sostiene 1100×600, pero al migrar al command bar canónico (patrón #1: contexto | rail | acciones) se descarga con overflow a menú.
- Re-testear `/monitoreo/comparar-territorial` (quedó fuera del baseline por edición concurrente).

**Gate Fase 3**: QA visual por perfil (los 4) y por grupo de pestañas, con proyecto de referencia; diff de `wc -l` de los archivos congelados = 0.

---

## 8. Fase 4 — Cálculo de muestra y Hojas de ruta

### 8.1 Cálculo de muestra (mesas; universidad con 4 grupos de tabs)

- **Fix inmediato (oleada 0): «NaN%»** → «—» con nota «No aplica (componente no probabilístico)».
- Mesas: el selector de mesa (`?mesa=`) se presenta con el lenguaje de sección canónico; el stepper de Acreditación migra al `StageStepper` compartido.
- Tabs de Aulas (grupos Definición/Marco/Cálculo/Salidas de `universidadTabs.ts`): adoptan el rail de pestañas canónico con separadores de grupo, burbuja, título compacto y leyenda para los dots de estado.
- El subsistema visual `universidad/` (aulas.css, criterios.css, marco.css, didáctica) se alinea a tokens en las superficies que se toquen; no se reescribe entero (es la vista más densa y funciona).
- «Desplaza para ver más»: sustituir el chip por affordance de scroll estándar (sombra de borde/gutter estable).

### 8.2 Hojas de ruta (stepper 5 etapas; Entrega con 3 subtabs)

- **Fix inmediato (oleada 0): chips de readiness partidos a mitad de palabra** (`.hojas-ruta-readiness-item`, label a ~44px) — min-width real o layout de chip nuevo.
- Stepper: paso 4 icon-only gana label; «Poblacion» → «Población»; migra a `StageStepper`.
- Tabla de distritos: affordance visible del x-scroll (header sticky ya existe).
- `HojasRutaPage.tsx` (9,002 líneas) **se declara congelado a crecimiento** como los grandes de Monitoreo: componentes nuevos en archivos propios; los 323 hex de `hojasRuta.css` + mapas de color inline en TSX (`HojasRutaPage.tsx:215-220,2170-2183`) migran a tokens (los colores NSE/cartografía se tokenizan como paleta semántica de dominio).

**Gate Fase 4**: QA visual por mesa y por etapa del stepper; capturas de los fixes; teclado en steppers.

---

## 9. Fase 5 — Fichas QR, Bitácora y Editor de formularios

### 9.1 Fichas QR (Preparación/Fichas/Paquete con subtabs)

- **Fix del clipping** de mini-KPIs en «PDF FINAL» (paso Paquete).
- Copy: «1 grupos» → concordancia; «caidas» → «caídas».
- Adoptar `PageFrame` (hoy fuera del arquetipo) + secciones Preparación/Fichas/Paquete en la command bar canónica (con progreso real si se decide tratarlas como pipeline) + `data-audit-ready`.

### 9.2 Bitácora (Bitácora/Cronograma/Calendario)

- **Vista Bitácora**: el formulario «Nueva entrada» flota como tarjeta pequeña sobre lienzo cuadriculado vacío (antipatrón §4.4 exacto). Rediseño: composición de dos regiones (entrada + timeline de entradas) donde el vacío pertenece a la región del timeline con empty state canónico y CTA.
- Cronograma/Calendario ya tienen empty states correctos: solo migración a primitivos.
- `data-audit-ready` en las tres vistas.

### 9.3 Editor de formularios (builder/sheets)

- Toolbar de 2 filas con jerarquía plana: aplicar jerarquía de acciones (primaria con peso, secundarias ghost, terciarias a menú «Más»).
- Tour de primer uso y layout de 3 paneles: puntos altos, se conservan.
- Overlays del editor ya usan z 1400: solo tokenizar.

**Gate Fase 5**: QA visual por sección/subtab de los tres módulos.

---

## 10. Fase 6 — Dashboard y Enciclopedia (los dos fuera de identidad)

### 10.1 Dashboard (`/tablero`)

- **Charts a la fuente cromática única**: default = secuencial navy + semánticos del sistema (`pulso_plotly_palette` ya existe como ancla en R); la personalización de paletas del entregable sigue disponible, pero **el default es Pulso** (regla: «si un número aparece en pantalla, en un PDF y en un PPT, cuenta la misma historia con la misma paleta»).
- Lenguaje de UI propio (links subrayados, segmented azul, toolbar de texto): migrar chrome a los primitivos y sus tabs configurables a la command bar canónica; `dash-*` deja de crecer. Adoptar `PageFrame` (gramática `dash-*` tiene migración dedicada pendiente en la gramática de layout — este es el momento).
- Cuidar el contrato de deploy público (`PublicArtifactApp`): la identidad por defecto viaja también al artefacto exportado.

### 10.2 Enciclopedia

- Ejecutar la decisión del ADR-lite de Fase 0: si queda como utilidad global, se re-viste con el arquetipo Documento (guía §6.7) y acceso desde Home/ajustes; si se integra a Bitácora, se fusiona como pestaña. En cualquier caso deja de ser ruta huérfana con layout legacy.

**Gate Fase 6**: QA visual de los 4 tabs del Tablero (paleta default nueva capturada) y de Enciclopedia en su hogar final; verificación del artefacto público.

---

## 11. Fase 7 — Cierre: oscuro, auditoría final y contrato de QA

- **Tema oscuro**: decisión formal (ADR-lite). Recomendación: comprometerse DESPUÉS de que la remediación de hex baje del umbral (< 500 en features), porque hoy es inviable; mientras tanto, `data-theme="dark"` vestigial se retira o se completa para el shell.
- **Auditoría canónica completa**: `make audit-project-visual-matrix` + pasada de `prosecnur-ux-evaluator` sobre la app entera con el mismo proyecto de referencia del baseline, comparando contra las 40+ capturas del diagnóstico (before/after).
- **Contrato de QA**: `data-audit-ready` al 100% de las vistas del contrato; tests automatizables de la guía §25 añadidos a vitest (contrato de navegación, geometría del shell, scroll).

---

## 12. Modo de operación: bucle de convergencia (no termina hasta que el usuario lo cierre)

Este plan **no es una lista lineal que se agota**: es un **sistema de loops explícitos en dos niveles**, y la meta es la **UI v3 completa**. Solo el usuario declara la v3 cerrada; ninguna fase completada, métrica alcanzada ni auditoría en verde autoriza a declarar el plan terminado.

**Loop interno (por fase)**: cada fase §4–§11 es en sí misma un loop — se implementa, se hace QA visual con evidencia, los hallazgos del QA vuelven como trabajo de la MISMA fase, y la fase solo se declara lista cuando una pasada de QA sale limpia Y el usuario valida lo visto (capturas o app en vivo). Si el usuario observa algo, la fase re-entra al loop.

**Loop global (el plan)**: las fases §4–§11 son el contenido de la primera vuelta; cada vuelta completa re-audita TODO contra la dirección v3.

### Mecánica de cada iteración

```
┌─▶ 1. AUDITAR    re-diagnóstico real (qa-visual-desktop + auditor-deuda +
│                 métricas de éxito de §13) sobre el MISMO proyecto de referencia
│  2. PRIORIZAR   backlog vivo: hallazgos nuevos + pendientes, ordenados por
│                 severidad × visibilidad; el usuario puede reordenar
│  3. EJECUTAR    oleadas (máx. 2 writers, globs disjuntos) sobre el top
│                 del backlog
│  4. VERIFICAR   QA visual con evidencia before/after + verificador + gates
│  5. REPORTAR    informe de vuelta al usuario: qué cambió, qué queda,
│                 métricas vs baseline
└──6. ¿El usuario declara el cierre? ──NO──▶ volver a 1
                                      SÍ──▶ auditoría final §11 + /cerrar-trabajo
```

- **Stopping rule**: SOLO el usuario cierra el loop. Si una vuelta completa no produce hallazgos nuevos (convergencia), se informa «vuelta en seco» y se pregunta si se cierra — pero no se asume.
- **Backlog vivo**: los hallazgos de cada vuelta (incluidos los que el usuario reporte al usar la app) entran al backlog con la misma disciplina de evidencia del diagnóstico inicial. Nada se pierde por caps de oleada: lo que no entra queda `pending` para la siguiente.
- **Re-baseline**: tras cada vuelta, las capturas nuevas reemplazan al baseline de comparación; el baseline original de 2026-07-23 se conserva como punto cero.
- **El diagnóstico también itera**: cada vuelta puede apretar superficies que la anterior no cubrió (más viewports, más popovers, teclado más profundo, Electron empaquetado, Windows) — el estándar de exhaustividad sube con cada iteración, no baja.

## 13. Orden de ejecución, oleadas y reglas (primera vuelta del loop)

### Oleada 0 (inmediata, previa a todo): quick fixes de alta visibilidad

Los bugs D6 #1–#7 + copy (#12) + Escape del confirm (#4) + `svg role` del BootGate. Son acotados, no dependen de fundaciones y elevan la percepción de calidad de inmediato. 1–2 writers, QA visual focalizado por fix.

### Secuencia de fases

```
Oleada 0  Quick fixes (bugs visibles)                    ~sin dependencias
Fase 0    Dirección v3 congelada + fundaciones (tokens,  bloqueante
          primitivos, AppSidebar, manifiesto, semántica)
Fase 1    Chrome canónico + Home + BootGate              requiere F0
Fase 2    Procesamiento (5 secciones)                    requiere F0
Fase 3    Monitoreo (4 perfiles, archivos nuevos)        requiere F0
Fase 4    Calc-muestra + Hojas de ruta                   requiere F0
Fase 5    Fichas QR + Bitácora + Editor                  requiere F0
Fase 6    Dashboard + Enciclopedia                       requiere F0 (+ADR)
Fase 7    Oscuro (decisión) + auditoría final + QA        última
```

Las fases 2–6 son paralelizables entre sí por oleadas de máx. 2 writers con globs disjuntos (reglas del agentic OS); cada una termina en `qa-visual-desktop` independiente + `verificador`. Rama 2 del enrutamiento (`/revamp-visual`) por módulo.

### Reglas duras durante todo el plan

1. Nada se declara terminado sin QA visual con evidencia (capturas before/after) + typecheck + tests afectados.
2. Archivos congelados no crecen: `MonitoreoPage.tsx`, `monitoreo.css` (se añade a la lista), `HojasRutaPage.tsx` (nuevo), `editor-v2.css` y `carga-v2.css` (nuevos). Verificación por `wc -l` en el gate.
3. Cero hex nuevos en CSS de features; cero overlays artesanales nuevos; cero `role="tab"` sin tabpanel nuevos. El `auditor-deuda` mide estos contadores en cada cierre de fase.
4. No romper las fortalezas: No Scroll Jail, roving keyboard, reduced-motion, warm start del `.pulso`, Windows-safe (pesos 500/600, vibrancy simulada).
5. Commits por unidad coherente (`/cerrar-trabajo`); los ADRs de §4.5 se redactan en su fase, no después.
6. La dirección v3 congelada (§4.0) es el contrato visual: cualquier desviación durante la implementación vuelve a la dirección primero (se actualiza el doc y se re-aprueba), nunca se improvisa en el código.

### Métricas de éxito (medibles, contra el baseline de hoy)

| Métrica | Hoy | Meta |
| --- | --- | --- |
| Hex hardcodeados en `features/*.css` | 4,376 | < 500 (solo dominio tokenizado) |
| `role="tab"` sin tabpanel | ~54 | 0 |
| Diálogos sin focus trap | ~50 | 0 |
| Fuentes de verdad de las secciones de Procesamiento | ≥6 | 1 |
| `calc(100dvh - Npx)` | ~30 | 0 |
| Valores z-index fuera de tokens | ≥8 valores | 0 |
| `data-audit-ready` en vistas del contrato | ~60% | 100% |
| Módulos con el chrome canónico (command bar + pillbar + rail) | 1/8 parcial | 8/8 |
| Rails de pestañas sin identificación persistente (título compacto) | mayoría | 0 |
| Checklist MUST de la guía (§5, §26) | parcial | 100% |
| Familias de botón por módulo | ≥7 | 1 (`PulsoButton`) |
| Familias de empty-state | 194 | 1 |
| Scroll de `body` en workbenches | 0 | 0 (se conserva) |

---

## 14. Evidencia del diagnóstico

- Capturas del baseline (40+): scratchpad de la sesión de diagnóstico (`qa-baseline/`), a re-generar como referencia versionable solo si se decide (regla: no versionar artefactos generados).
- Auditoría de código: hallazgos con file:line citados en §2 (verificables por grep).
- Proyecto de referencia: `api/inst/audit_reference/prosecnur_audit_reference.pulso` (8 módulos, 2 bases) — el mismo para todos los before/after del plan.
