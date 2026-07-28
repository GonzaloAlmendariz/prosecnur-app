# Limpieza visual profunda: Territorial y Telefónico (2026-07-26)

## Contrato y alcance

- Categoría: reparación visual del workbench de Monitoreo.
- Fuentes de verdad: `docs/loops-reparacion.md`, `docs/ui-layout-grammar.md`, los QA históricos de `docs/qa/monitoreo/`, el DOM real de cada perfil y los tokens existentes.
- Incluye: contenido interior, pestañas locales, paneles, estados de carga/vacío, densidad, scroll, foco y semántica de acciones de Territorial y Telefónico.
- Excluye: topbar y sidebar globales, `MonitoreoShell.tsx`, el monolito congelado `MonitoreoPage.tsx`, backend, Electron, `.pulso`, secretos, Acreditación y Aulas salvo verificación de regresión.
- Riesgo principal: cascadas compartidas que vuelvan a introducir alturas fijas, scroll anidado o recortes en el otro perfil.
- Validación mínima: typecheck, Vitest de `src/features/monitoreo`, `git diff --check` y barrido DOM real de todas las pestañas en 1440×1000 y 1024×600, con inicio/medio/final del dueño de scroll.

Baseline previo a cambios: `pnpm --dir frontend typecheck` pasó; `pnpm --dir frontend exec vitest run src/features/monitoreo` pasó 22 archivos y 227 pruebas. Se preservó el working tree sucio preexistente.

## Observaciones históricas incorporadas

- Las cinco vistas históricas de Ocurrencias debían seguir accesibles; el inventario final se obtuvo del DOM y no de matrices antiguas con deriva.
- Se evitó repetir configuración, explicación y estado en hero, banda y tarjeta cuando respondían lo mismo.
- Alertas, UMP, ritmo y vacíos no debían inflar el canvas ni ocultar trabajo debajo del pliegue.
- Los rieles locales necesitaban nombres accesibles; GPS y filas accionables no podían depender sólo del ratón.
- Los mapas, cuotas y cronogramas requerían un dueño de scroll claro y altura negociable.

## Iteraciones de reparación

| # | Falla o cuello de botella | Cambio enfocado | Resultado |
|---:|---|---|---|
| 1 | Inventarios históricos en conflicto | Derivar secciones y pestañas del DOM vivo | 15 pestañas telefónicas y 28 territoriales identificadas |
| 2 | Sin contrato de alcance | Scope lock de archivos, exclusiones, riesgo y gate | Alcance congelado |
| 3 | Cabecera contextual telefónica construida pero no montada | Montar el head del workbench | Contexto operativo visible sin tocar topbar |
| 4 | Región principal completa anunciaba cada cambio | `aria-live` por defecto a `off` | Menos ruido para lector de pantalla |
| 5 | Territorial no declaraba layout workbench/panels | Configurar `PageFrame` y reset de scroll | Contrato de layout uniforme |
| 6 | Clase de layout contextual duplicada | Retirar duplicación y actualizar prueba semántica | Una sola fuente de geometría |
| 7 | Cargas y vacíos ocupaban alturas de panel lleno | Alturas naturales y padding compacto | Estados honestos y densos |
| 8 | Mapa imponía mínimos rígidos | `clamp` con token de viewport | Mapa legible sin inflar página |
| 9 | Filas accionables eran sólo clicables | Botón y semántica de acción | Teclado y foco explícitos |
| 10 | Nodos GPS dependían del puntero | `role`, `tabIndex`, nombre y teclado | Navegación por teclado disponible |
| 11 | Modal geográfico no restauraba foco | Escape, foco inicial y restauración | Ciclo de foco predecible |
| 12 | Panel telefónico standalone heredaba `fill` | Separar clase standalone | El workbench recupera el scroll único |
| 13 | Stage telefónico se encogía al viewport | Liberar flex/height/overflow | Contenido largo alcanzable |
| 14 | Cronograma conservaba cápsula de Acreditación | Altura natural y filas automáticas | Sin recorte en Estrategias |
| 15 | Cuotas y ritmo tenían máximos heredados | Liberar máximos y rejillas | Tarjetas completas y scroll estable |
| 16 | Grids telefónicos exigían columnas rígidas | `auto-fit` y apilado compacto | Cero overflow horizontal |
| 17 | Etiquetas operativas se truncaban | Wrap controlado sin siglas artificiales | Mejor lectura y accesibilidad |
| 18 | Avance compacto comprimía el gráfico a 123 px | Apilado específico de cuatro bloques | Gráfico a ancho completo |
| 19 | Plotly forzaba 27 px fuera de la banda temporal | Retirar el mínimo heredado del canvas | Cero recorte del eje |
| 20 | Tarjeta diaria medía 320 px para 408 px reales | Filas y altura intrínsecas | Sin superposición con Contexto |
| 21 | Contexto, Base y Sede colapsaban a 20–26 px | Mínimos naturales por bloque | Scroll medio/final sin solapamientos |
| 22 | Fuente/Formulario ocultaba 212 px | Consola y tabpanel naturales | Formulario completo alcanzable |
| 23 | Roster dejaba la tabla en 0 px | Tabla con altura útil y panel natural | Tabla visible en compacto |
| 24 | Atlas UMP cortaba 40 px | Altura natural y workbench desplazable | Cierre del atlas accesible |
| 25 | Cuotas recortaba su viewport de 620–762 px | Liberar stage, tabbody y panel de cuota | Lista larga conserva su scroll |
| 26 | Ocurrencias ocultaba hasta 13.768 px | Stage natural y scroll del workbench | Todas sus pestañas alcanzables |
| 27 | Consultas perdía 79 px de la tabla a 1280 | Altura útil estable y stage natural | Tabla y scroll completos en viewport intermedio |

Cada iteración se comparó con el mismo proyecto y viewport. Los cambios que empeoraron la geometría —por ejemplo liberar sólo el hijo de Ocurrencias o sólo el gráfico de Avance— no se aceptaron: el diagnóstico se movió al primer ancestro que seguía contrayendo el contenido y se repitió el barrido.

## Evidencia final

- Telefónico grande: `/tmp/prosecnur-phone-tabs-1440-r4/report.json`.
- Telefónico compacto: `/tmp/prosecnur-phone-tabs-1024-r10/report.json`.
- Telefónico intermedio y ancho: `/tmp/prosecnur-phone-tabs-1280-final/report.json` y `/tmp/prosecnur-phone-tabs-1710-final/report.json`.
- Territorial grande y compacto: `/tmp/prosecnur-territorial-tabs-1440-r5/report.json` y `/tmp/prosecnur-territorial-tabs-1024-r5/report.json`.
- Territorial intermedio y ancho: `/tmp/prosecnur-territorial-tabs-1280-r2/report.json` y `/tmp/prosecnur-territorial-tabs-1710-final/report.json`.
- Los reportes contienen ruta solicitada/real, pestaña activa, overflow horizontal, recortes, errores de consola/página y capturas `top`, `middle` y `bottom` cuando existe desplazamiento.

La prueba visual usa copias temporales de proyectos reales en `tmp/visual-qa/baseline-monitoreo-20260726/projects/`; no modifica el `.pulso` original ni persiste secretos.

## Reapertura: vacío en Estado de fuentes (2026-07-26)

La captura posterior del usuario mostró una variante que la matriz inicial no
había cubierto: ACRDCONTA en `Fuentes > Fuentes activas`, con 13/13 fuentes,
1.277 registros, cuatro actores, siete encuestas y seis bases Sheets. El QA
histórico de esa pestaña había llegado al ancla seleccionada, pero su primer
viewport todavía enseñaba la arquitectura de Sheets; por eso el contador
automático podía quedar verde sin inspeccionar el cuerpo real de Estado.

### Scope lock de la reapertura

- Módulo: interior de `Fuentes activas` compartido por el perfil de
  Acreditación y sus componentes de fuentes.
- Archivos de producto: `frontend/src/features/monitoreo/profiles/profilePage.css`.
- Fuera: topbar, sidebar, shell, backend, Electron, `.pulso`, persistencia y
  archivos congelados.
- Riesgo: quitar el estiramiento ancho sin comprimir las tres listas a 1280 px.
- Gate: test de contrato CSS, pruebas enfocadas, typecheck, `git diff --check`
  y capturas del proyecto ACRDCONTA a 1710×1107 y 1280×800.
- Stopping rule: las tarjetas de actores empiezan bajo su encabezado, conservan
  altura natural y no aparece overflow ni scroll jail en grande o compacto.

### Iteración 28

- Falla: `.mon-acr-active-grid` tenía dos columnas y el primer panel abarcaba
  dos filas. Con Recopiladores y Sheets apilados a la derecha, el panel de
  Actores heredaba la suma de ambas alturas y distribuía el espacio libre entre
  cuatro tarjetas.
- Cambio enfocado: tres superficies naturales en escritorio ancho,
  `align-items: start`, sin `grid-row: span 2`; se conserva la proporción de
  tres columnas intermedias y el apilado bajo 980 px.
- Archivos: `profilePage.css` y
  `AcreditacionActiveSourcesLayout.test.ts`.
- Validación roja: la prueba nueva falló por `repeat(2, ...)`, `span 2` y falta
  de alineación natural.
- Validación verde: 3 archivos / 65 pruebas enfocadas.
- Comparación: mejor. El vacío interior y las tarjetas infladas desaparecen;
  las tres listas quedan alineadas arriba.
- Gate serial independiente: aprobado; typecheck, 23 archivos / 230 pruebas de
  Monitoreo y `git diff --check` en verde.

### Evidencia de la reapertura

- Pre-cambio probable, capturado segundos antes de editar:
  `tmp/visual-qa/reopen-dead-space-baseline-20260726/`.
- ACRDCONTA después: `tmp/visual-qa/reopen-dead-space-after-acrconta-v2/`;
  dos viewports, cuerpo real de Estado, `ok=true`, 0 overflow, 0 scroll jails y
  0 errores de página/API.
- Telefónico `Fuentes activas`: su cuerpo real es el contrato
  Base–Barrido–Kobo, no el grid de actores. Se comprobó por separado en
  `tmp/visual-qa/reopen-dead-space-after-telefonico-final/`, con 0 incidencias
  a 1710×1107 y 1280×800. En compacto, el dueño de scroll recorrió de 0 a
  779 px y dejó capturas `top`, `middle` y `bottom`.

## Reapertura: vacío entre UMP exacta y Cola UMP (2026-07-26)

La segunda captura del usuario expuso otro caso de baja cardinalidad del mismo
proyecto territorial: dos UMP por revisar (`UMP 285` y `01900`). Las dos
superficies son funcionalmente distintas y se conservan: `UMP exacta` es la
mesa detallada, buscable y seleccionable para lote; `Cola UMP` es el resumen
por causa con lentes `Manual`, `Sin ruta`, `Sin UMP` y `Sugeridas` y un estado
vacío explícito. El defecto era geométrico, no una duplicación que autorizara
eliminar alguna de ellas.

### Iteración 29

- Falla: el grid de Reconciliación estiraba ambos paneles a la altura del panel
  Código. Los dos tracks flexibles de UMP repartían ese sobrante y la lista,
  alineada arriba, dejaba cientos de píxeles vacíos antes de `Cola UMP`.
- Cambio enfocado: `.mon-territorial-reconciliation-panel.is-ump` usa
  `align-self: start`. Se conservan los cinco tracks, sus mínimos, los estados
  vacíos y el scroll previsto para ocho filas detalladas y cuatro de vista
  previa.
- Archivos: `territorialProfile.css` y
  `TerritorialReconciliationLayout.test.ts`.
- Validación roja: la prueba nueva confirmó las cinco zonas en orden, pero
  reportó `heightIsIndependent: false`.
- Validación verde: 24 archivos / 231 pruebas de Monitoreo, typecheck y
  `git diff --check` en verde.
- Gate serial independiente: aprobado con los mismos cuatro checks y revisión
  comparada de las capturas anterior/posterior.
- Comparación: mejor. A 1710×1107, `Cola UMP` sigue inmediatamente a las dos
  tarjetas de detalle y ambas tarjetas de la cola quedan visibles dentro de su
  propio contenedor; no se modificaron datos, filtros ni acciones.

### Evidencia de la iteración 29

- Antes, reproducción exacta del proyecto y los dos casos:
  `tmp/visual-qa/territorial-reconciliation-dead-space-before-20260726/`.
- Después, proyecto real a 1710×1107, 1280×720 y 1024×600:
  `tmp/visual-qa/territorial-reconciliation-dead-space-after-20260726/`.
- El reporte posterior registra `ok=true`, 3/3 capturas, 0 overflow, 0 scroll
  jails, 0 errores de consola/página/API y 0 selectores ausentes.

## Reapertura: alto desperdiciado en Consultas/Registro (2026-07-26)

La captura siguiente mostró que `Consultas > Registro` conservaba unas 265
filas dentro de una mesa fijada en 320 px, mientras el resto del alto útil
quedaba blanco debajo. En este caso no correspondía acortar el canvas: el
espacio debía ampliar el viewport tabular y exponer más datos.

### Iteración 30

- Falla: un override tardío convertía el stage de Consultas en `max-content` y
  fijaba tanto workbench como table-shell en 320 px. El track flexible del panel
  no podía estirar la tabla.
- Cambio enfocado: en escritorio y sólo cuando existe
  `.mon-territorial-review-table-shell`, el stage recupera el alto disponible y
  workbench/shell ocupan el 100%; 320 px queda como mínimo, no como máximo.
- Aislamiento: `:has(.mon-territorial-review-table-shell)` cubre Registro, GPS,
  Duración y Cruce responsable, pero no Subsanaciones ni los estados vacíos.
- Archivos: `territorialProfile.css` y
  `TerritorialConsultasHeightLayout.test.ts`.
- Validación roja: faltaban las tres reglas aisladas de crecimiento; el contrato
  existente de `overflow:auto` y mínimo de 240 px sí estaba presente.
- Validación verde focal: 2/2 pruebas y typecheck en verde.
- Comparación: mejor. A 1710×1107 el antiguo lienzo blanco muestra filas
  adicionales; a 1280×720 la tabla llega al borde útil y a 1024×600 continúa
  montada y alcanzable por el dueño de scroll.

### Evidencia de la iteración 30

- Después, proyecto ACNUR real a 1710×1107, 1280×720 y 1024×600:
  `tmp/visual-qa/territorial-consultas-registro-height-after-20260726/`.
- El reporte registra `ok=true`, 3/3 capturas, 0 overflow, 0 scroll jails, 0
  errores de consola/página/API y 0 selectores ausentes.
- Guard de aislamiento en Subsanaciones:
  `tmp/visual-qa/territorial-consultas-subsanaciones-guard-after-20260726/`.
  La vista queda fuera del selector y conserva su geometría; el runner señala
  dos tarjetas de sugerencia con contenido vertical recortado preexistente, que
  no pertenece a esta iteración.
- QA visual independiente: aprobado. Confirmó que el lienzo blanco se convierte
  en filas visibles a 1710×1107 y 1280×720, y que a 1024×600 la tabla sigue
  alcanzable mediante el scroll de página, sin solapamientos ni scroll jail.
- Gate serial independiente: aprobado; 2/2 pruebas focales, 25 archivos y
  233/233 pruebas de Monitoreo, typecheck y `git diff --check` en verde. No
  quedan pendientes dentro de esta reparación.

## Reapertura: Consultas/Subsanaciones recortada (2026-07-26)

La captura del usuario confirmó el P1 que la auditoría histórica ya medía: el
encabezado podía abrir bajo `Formato territorial` y cada sugerencia reservaba
116 px para 149 px de contenido. La fila inferior —celda, movimientos, ID de
fuente, selección y seguridad del origen— quedaba dentro del botón pero era
irrecuperable.

### Iteración 31

- Falla causal: `.mon-operational-adjustments` volvía a calcular su alto con
  `100dvh - 238px` dentro de un shell que ya había descontado el chrome. La rama
  general de Consultas la convertía además en `max-content`, creando un scroll
  exterior innecesario. Las filas implícitas de la lista comprimían cada botón
  hasta su mínimo de 118 px en vez de respetar su contenido.
- Cambio enfocado: una rama exclusiva
  `:has(.mon-operational-adjustments)` usa el alto real del padre en ventanas
  amplias, reduce el scroll exterior a cero, entrega más espacio a la revisión
  activa y mantiene sugerencias, inspector e historial como colecciones
  desplazables. En ventanas bajas el exterior queda como respaldo alcanzable.
- Integridad de tarjeta: la lista usa `grid-auto-rows: max-content` y las
  sugerencias `height: max-content`. A 1024 px origen, traslado y destino se
  apilan en una columna para no desbordar los ~480 px disponibles.
- Llegada: al entrar en Subsanaciones se restablece a cero el scroll del
  contenedor de Consultas; el encabezado ya no hereda la posición de otra
  pestaña.
- Archivos: `territorialProfile.css`,
  `TerritorialReviewCasesWorkbench.tsx` y
  `TerritorialOperationalAdjustmentsLayout.test.ts`.
- Validación roja: primero 4/4 pruebas fallaron por ausencia de rama operacional,
  altura intrínseca, fallback y reinicio de scroll. Tras el primer arreglo, una
  quinta regresión reprodujo el overflow horizontal de 1024 px.
- Validación verde: 5/5 pruebas focales, 26 archivos y 238/238 pruebas de
  Monitoreo, typecheck y `git diff --check`.
- Comparación: mejor. El reporte anterior tenía dos recortes verticales de
  33 px por tarjeta. El posterior registra cuatro viewports sin incidencias.

### Evidencia de la iteración 31

- Antes: `tmp/visual-qa/territorial-consultas-subsanaciones-guard-after-20260726/`
  (`ok=false`, 2 recortes verticales, 149/116 px).
- Después: `tmp/visual-qa/territorial-consultas-subsanaciones-layout-after-v2-20260726/`.
- Reporte posterior: `ok=true`, 4/4 capturas (1710×1107, 1440×1000,
  1280×800 y 1024×600), 0 problemas visuales, 0 scroll jails, 0 overflow global,
  0 errores de página/consola/API/recursos y 0 selectores ausentes.

## Reapertura: Avance completo, especialmente Mapa y UMP (2026-07-26)

Las capturas posteriores mostraron que la limpieza general no había resuelto
la composición de `Avance`. `Resumen` todavía estiraba una categoría vacía;
`Mapa y UMP` repetía la selección en cuatro superficies, recortaba el mapa en
compacto y, tras la primera corrección, desplazaba el SVG fuera de la ventana
en escritorio ancho. `Salidas` mantenía además un overflow interno de 17 px a
1024.

### Iteración 32.1 — arquitectura y primera corrección

- Contrato: cinco pestañas (`Resumen`, `Distritos`, `Mapa y UMP`, `Ritmo
  diario`, `Salidas`) en cuatro viewports, con estados reales de ACNUR.
- Cambio: `Resumen` usa áreas independientes; Mapa y UMP pasa a
  `mapa | lista maestra | inspector`; se elimina el miniinspector duplicado y
  la tabla completa queda bajo un `<details>` accesible. Ritmo adopta altura
  adaptable y Salidas permite wrap compacto.
- Resultado de pruebas: los cinco contratos inicialmente rojos quedaron
  verdes, pero el QA visual rechazó el candidato.
- Rechazo: la tarjeta interna del mapa necesitaba 398 px y recibía 348 px a
  1280 y 252 px a 1024; el recorte era de 50 y 146 px. El grupo vacío de
  prioridades también seguía estirado.

### Iteración 32.2 — integridad de tarjeta

- Cambio: tarjetas de prioridades con altura intrínseca y mapa sin
  `height: 100%` dentro del viewport comprimido.
- Resultado: desaparecieron recorte y estiramiento, pero el QA volvió a
  rechazar el candidato porque el mapa quedaba blanco a 1710 y 1440 aunque
  lista e inspector sí mostraban los 150 UMP y los puntos GPS.
- Causa: no era ausencia de datos ni timing. La lista real agrandaba una fila
  `auto` miles de píxeles y desplazaba el SVG fuera de la región visible. Una
  regresión estática también prohibía erróneamente la fila flexible necesaria.

### Iteración 32.3 — regímenes ancho y compacto

- Cambio: en escritorio ancho el workspace queda gobernado, solo el viewport
  del mapa absorbe alto y lista/inspector son dueños de scroll. En compacto las
  filas crecen intrínsecamente, la navegación se vuelve horizontal y el scroll
  exterior conserva el recorrido.
- Resultado: mapa, SVG y rutas visibles en 1710×1107, 1440×1000, 1280×800 y
  1024×600; sin recorte, overflow ni scroll jail. `Resumen`, `Distritos`,
  `Ritmo` y `Salidas` conservaron sus resultados aprobados.
- Gate: 21/21 pruebas focales, 245/245 pruebas de Monitoreo, typecheck y
  `git diff --check` en verde. La estructura final contiene un navegador, un
  inspector y una tabla secundaria plegable.

### Evidencia y límite del runner

- Baseline: `tmp/visual-qa/territorial-avance-baseline-20260726/`.
- Primer candidato rechazado:
  `tmp/visual-qa/territorial-avance-after-20260726/`.
- Segundo candidato rechazado:
  `tmp/visual-qa/territorial-avance-after-v2-20260726/`.
- Candidato final:
  `tmp/visual-qa/territorial-avance-after-v3-20260726/`.

La captura fría final de 1710 ocurrió antes de hidratar el proyecto y registró
cero válidas. Se sustituyó en la revisión independiente por una captura
caliente con mapa y rutas visibles. Los reportes v3 retienen, por ello, un
`waitSelectorMiss` y `ok=false`: sirven para reconstruir la iteración, pero no
son un artefacto automático canónico verde. El protocolo general nuevo exige
repetir una corrida limpia en vez de producir un “verde compuesto”:
`docs/qa/revamps-visuales-lecciones-operativas-2026-07-26.md`.

## Continuidad: pulido cosmético profundo de todo Monitoreo (2026-07-27)

El objetivo deja de ser una reparación aislada de Territorial/Telefónico y se
mantiene como un ciclo continuo sobre Territorial, Telefónico, Acreditación y
Aulas. El criterio de prioridad es comprensible para una persona usuaria: cada
primer viewport debe mostrar trabajo útil, los bloques equivalentes deben
parecer parte del mismo sistema, las secciones independientes no deben heredar
alturas ajenas y ninguna mejora puede añadir texto ornamental o “AI slop”.

### Iteración 33 — Aulas: altura productiva sin sacrificar marcos

- Baseline: en `1024×600`, KPI y flujo repetido consumían unos 221 px, más de
  la mitad del alto útil; Agenda, Validación y Consultas mostraban apenas dos o
  tres filas aunque el contenedor de datos tenía capacidad disponible.
- Decisión: el flujo completo pertenece a `Fuentes`; las demás secciones no lo
  repiten. En altura corta conserva las cuatro etapas y las dos acciones, pero
  omite la introducción y los detalles secundarios ya expresados por la
  navegación. No se añadió copy.
- Agenda: los cuatro estados de traspaso se convierten en una banda completa y
  equivalente; la tabla ocupa la capacidad de su panel en vez de quedar
  limitada a 128 px.
- Fuentes: los tres estados operativos y sus dos acciones conservan un marco
  propio y completo; identificadores extensos no desplazan la tabla en altura
  corta.
- Contratos de QA: KPI, traspaso y estado operativo declaran grupos `equal`;
  la tolerancia del runner es 2 px. El estado con poca información mantiene
  vacío interior dentro de la tabla, no un hueco exterior entre secciones.
- Regresión: `AulasCompactWorkbenchLayout.test.ts` fija contextualidad del
  flujo, bandas compactas, tabla al 100% de su región y los tres contratos
  geométricos.

Evidencia incremental:

- baseline: `/tmp/qa-cosmetic-aulas-current/`;
- compactación del flujo: `/tmp/qa-cosmetic-aulas-iteration1/`;
- integridad del traspaso: `/tmp/qa-cosmetic-aulas-iteration2/`;
- flujo contextual: `/tmp/qa-cosmetic-aulas-iteration3/`;
- tabla con cinco filas visibles: `/tmp/qa-cosmetic-aulas-iteration4/`;
- estado operativo de Fuentes: `/tmp/qa-cosmetic-aulas-iteration5/`.

Las cinco secciones se recorrieron a `1440×1000` y `1024×600`; los reportes
aceptados registran cero overflow, scroll jail, error geométrico, error de
página, API o recurso. La alta cardinalidad real de Aulas sigue limitada por
el fixture disponible y permanece declarada como deuda de evidencia, no como
aprobación implícita.

### Iteración 34 — encabezado interno sin “tarjeta dentro de tarjeta”

- Falla: `.mon-profile-panel` ya aportaba superficie, borde, radio y padding,
  pero su `.mon-profile-panel-head` recibía otra vez fondo material, borde,
  radio, sombra y desenfoque. El patrón aparecía decenas de veces en
  Acreditación y Telefónico y debilitaba la diferencia entre contenedor,
  toolbar y título.
- Cambio: el hijo directo conserva un marco estable de 36 px —32 px en
  ventana corta—, alineación, espacio y un separador inferior. Se retiran la
  segunda superficie, sombra, blur y radio; no cambian título, contador ni
  acciones.
- Regresión roja/verde: `ProfilePanelHeaderLayout.test.ts` falló con las tres
  materializaciones previas y luego pasó junto a los contratos de Aulas,
  Acreditación y Telefónico (18/18 pruebas focales). Typecheck en verde.
- QA real: Aulas Agenda pasó en ambos viewports con cuatro grupos geométricos,
  cero incidencias y cinco filas visibles en compacto:
  `/tmp/qa-shared-panel-head-aulas/`. Los fixtures canónicos de Telefónico no
  mostraron overflow, scroll jail ni errores atribuibles en
  `/tmp/qa-shared-panel-head-phone-fixture/` y
  `/tmp/qa-shared-panel-head-phone-fuentes/`, pero esas vistas usan cabeceras
  especializadas y son guards vecinos, no evidencia directa del selector.
- Intento inválido de Acreditación:
  `/tmp/qa-shared-panel-head-acreditacion-modelo/report.json` conserva
  `ok=false` y `waitSelectorMisses=1` porque la vista tampoco renderiza
  `.mon-profile-panel-head`. Se retiene únicamente como diagnóstico sin
  overflow ni errores atribuibles; no aprueba el encabezado compartido. Falta
  una corrida verde de Acreditación en una vista que sí consuma ese selector.

### Iteración 35 — Consultas: eliminar la fila invisible, no el contenedor

- Falla causal: `.mon-clarity-strip.is-consultas` estaba en `display: none`,
  aunque Acreditación contaba `clarity + content` y Telefónico contaba
  `head + clarity + content` en sus filas explícitas. Al desaparecer clarity,
  el contenido caía en una fila `auto` y la última fila flexible quedaba vacía
  fuera de toda superficie visible.
- Cambio: Consultas vuelve a renderizar la franja ya existente. No se añade
  texto ni otra caja: se recuperan la orientación, tres métricas compactas y,
  en Acreditación, la pestaña/readiness que ya producían los componentes.
- Regresión roja/verde: `ConsultasWorkbenchGeometryLayout.test.ts` fija la
  visibilidad del hijo contado y los contratos de dos y tres filas. Falló antes
  por `display:none` y luego pasó junto a los guards de Telefónico,
  Subsanaciones territorial y encabezados compartidos (16/16).
- Baja cardinalidad Telefónico: el estado sin efectivas conserva un panel
  visible que posee su capacidad interior; ya no existe una fila exterior
  vacía. Evidencia a `1440×1000` y `1024×600`:
  `/tmp/qa-consultas-row-contract-phone/`, `ok=true`.
- Cardinalidad real Acreditación: 17 casos ocupan la región flexible; se ven
  unas diez filas a 1440 y el recorrido compacto sigue alcanzable. Evidencia:
  `/tmp/qa-consultas-row-contract-acreditacion/`, `ok=true`.
- Ambos reportes: dos grupos geométricos medidos, cero drift, overflow, scroll
  jail, error de página/API/recurso o miss de readiness.

### Refuerzo del agente de revamps

El contrato de `revamp-visual` ya exige grupos equivalentes, matriz
`0/1/pocos/muchos`, capacidad interior, hueco exterior y dueño de overflow.
Durante esta continuidad se corrigió además una referencia inexistente de
métricas: el skill ahora remite únicamente a documentos reales del sistema de
diseño y obliga a derivar dimensiones de tokens `--pulso-*` y componentes
comparables. Se regeneraron y verificaron los adaptadores con
`agentic/sync-agentic-os.mjs`; las dos advertencias por skills externos no
instalados son preexistentes y no afectan este contrato.

### Gate de la unidad continua 33–35

- `pnpm --dir frontend exec vitest run src/features/monitoreo`: 37 archivos,
  270/270 pruebas en verde.
- `pnpm --dir frontend typecheck`: verde.
- `node agentic/sync-agentic-os.mjs --check`: verde, con las dos advertencias
  externas preexistentes documentadas.
- `git diff --check`: verde.
- Verificador independiente: `APROBADO CON PENDIENTES`. Aprobó Aulas y
  Consultas en grande/compacto y exigió conservar como deuda explícita la alta
  cardinalidad real de Aulas, una corrida verde específica del encabezado en
  Acreditación y el alcance del último contenido telefónico compacto.

Este gate cierra solo la unidad 33–35. El objetivo de pulido cosmético de todo
Monitoreo permanece activo y continúa con truncamientos de controles/categorías
en compacto y con los pendientes de evidencia anteriores.

### Iteración 36 — Telefónico: el estado gana ancho, no alto

- Falla medida en `Modelo > Cuotas`, `1024×600`: cada categoría reservaba
  120 px al carril gráfico y dejaba 86 px a `47 base · sin meta` y 37,33 px a
  `sin base`. Ambos estados se elidían aunque la tarjeta medía 41,64 px y no
  registraba overflow global.
- Cambio: el régimen compacto redistribuye las tres columnas a
  `minmax(102px, .85fr) minmax(72px, 1fr) minmax(44px, auto)`. No cambia la
  altura, el número de tarjetas ni elipsis deliberada de nombres extensos.
- Resultado: 102 / 97,33 / 44 px; `sin meta` y `sin base` se leen completos,
  el marco conserva 41,64 px y `1440×1000` permanece sin cambios.
- Regresión: `TelefonicoWorkbenchGeometryLayout.test.ts` falló antes del
  override y quedó verde después.
- Evidencia: baseline `/tmp/qa-phone-truncation-baseline/`; candidato verde
  `/tmp/qa-iter36-phone-model-after/` (`ok=true`, dos viewports, cero issues).

### Iteración 37 — Telefónico: cinco decisiones, cinco marcos legibles

- Falla: la mitad izquierda del gobernador repetía una explicación ya visible
  en el encabezado, mientras cinco decisiones y cuatro conectores compartían
  menos de 500 px. Etiquetas, valores y detalles operativos aparecían como
  `VARIA…`, `4 categ…`, `sin obje…` y `mínimo…`.
- Cambio: solo en compacto, el resumen cede ancho al camino operativo; se
  omite el párrafo redundante, se retiran conectores decorativos y las cinco
  decisiones pasan a una grilla de columnas equivalentes. No se añade copy ni
  una segunda fila.
- Resultado visual: `Filtro`, `Variable`, `Meta`, `Kobo` y `Brecha` conservan
  valor y detalle completos en `1024×600`; la vista grande mantiene el camino
  conectado original.
- Regresión: el contrato exige el reparto `0.56fr / 1.44fr`, cinco tracks
  iguales, conectores ausentes y explicación secundaria ausente en compacto.
- Evidencia: `/tmp/qa-iter37-phone-model-after/`, `ok=true`, dos viewports,
  cero overflow, jail, error geométrico, error de página, API o recurso.

### Iteración 38 — Acreditación: una tabla con contenido no puede medir 0 px

- Falla causal en `Consultas > Cruces efectivos`, `1024×600`: el explorador
  consumía su alto con lectura, filtros y alerta; `.mon-case-explorer-body`
  quedaba en 91 px y `.mon-query-table-wrap` en **0 px** pese a contener
  1.987 px de filas. La primera fila completa quedaba fuera del marco.
- Contrato: el workbench exterior conserva su alto y revela el explorador; el
  explorador posee una ventana de datos deliberada de 260 px. El vacío que
  pueda existir es capacidad interior del contenedor, nunca hueco exterior.
- Cambio: en escritorio con alto `<=700px`, Consultas pasa a flujo intrínseco
  dentro del scroll exterior y fija la cuarta fila del explorador en 260 px.
  La tabla conserva su desplazamiento propio para los 17 casos.
- Regresión: `ConsultasWorkbenchGeometryLayout.test.ts` fija el dueño exterior,
  la independencia intrínseca del escenario y la capacidad de 260 px.
- Evidencia real: baseline `/tmp/qa-acreditacion-trunc-current/`; candidato
  `/tmp/qa-iter38-acreditacion-cruces-after-real/`, `ok=true` en grande y
  compacto. La corrida `/tmp/qa-iter38-acreditacion-cruces-after/` usó por
  error un fixture aún no configurado y no constituye evidencia de la vista.

### Iteración 39 — el QA ya no acepta scroll sin ventana visible

- Falso verde detectado: `ui-quick-check` consideraba dueño válido a cualquier
  descendiente con `overflow:auto` y contenido excedente, incluso cuando su
  `clientHeight` era 0. Así omitía el jail exterior de Cruces efectivos.
- Cambio: `isScrollableY` exige que el dueño sea visible y tenga al menos
  40 px de alto útil antes de delegarle el recorrido.
- Regresión sintética: una `.mon-page` recortada con un supuesto scroll owner
  de 0 px pasó de `scrollJails=0` a un `scroll-jail` explícito; el fixture
  geométrico válido sigue aprobado.
- Guard real endurecido: `/tmp/qa-iter39-acreditacion-scroll-owner-guard/`
  conserva `ok=true`, `scrollJails=0` y una región de tabla utilizable en
  `1024×600` después de la reparación.

### Gate de la unidad continua 36–39

- `pnpm --dir frontend exec vitest run src/features/monitoreo`: 37 archivos,
  273/273 pruebas en verde.
- `pnpm --dir frontend typecheck`: verde.
- `node --test scripts/tests/ui-quick-check-geometry.test.mjs
  scripts/tests/ui-quick-check-readiness-contract.test.mjs`: 4/4 en verde.
- `git diff --check`: verde.
- Verificador independiente: `APROBADO`, sin hallazgos bloqueantes. Confirmó
  los dos viewports telefónicos, el fixture real de Cruces, el guard compacto
  con el inspector endurecido y la separación explícita de evidencias
  inválidas.

El gate cierra solo las iteraciones 36–39. El objetivo general permanece
activo: la siguiente unidad continuará el recorrido de Monitoreo y priorizará
el primer defecto visual medido que todavía degrade claridad, geometría o
accesibilidad sin agregar copy ornamental.

### Iteración 40 — Telefónico/Fuentes: el paquete compacto deja de comprimir tres decisiones

- Falla medida en “Fuentes > Activas”, 1024×600: el paquete mantenía tres
  columnas dentro de 912 px útiles. Cada fuente recibía apenas 298,66–298,67 px
  y truncaba títulos y valores operativos como “Base telefónica / universo”,
  “Sin fuente vinculada” y “Enlace pendiente”. El dueño exterior
  “#monitoreo-fuentes-panel” sí desplazaba (clientHeight=377,
  scrollHeight=1336); por tanto, no era un jail sino una composición que
  ocultaba información aun después de alcanzarla.
- Dirección: se conserva el conjunto de tres fuentes, su jerarquía, sus
  etiquetas y el scroll existente. En <=1200px las tres variantes pasan a
  una columna equivalente; en escritorio continúan como tres tarjetas
  paralelas. No se añadió texto, superficie, altura mínima ni navegación.
- Regresión roja/verde:
  “TelefonicoWorkbenchGeometryLayout.test.ts” exige la columna única
  específicamente para “.mon-phone-source-tab.is-package”; falló antes del
  override y luego dejó 8/8 pruebas focales en verde.
- Medición posterior: a 1440×1000 las tarjetas conservan tres columnas de
  437,33–437,34 × 187,28 px; a 1024×600 forman una columna de 912 px y tres
  marcos iguales de 178,75 px. La capacidad no usada dentro de cada tarjeta es
  1 px y el último ítem del grupo cierra sin hueco exterior.
- QA real: el mismo proyecto y ruta pasaron en ambos viewports con
  ok=true, cuatro grupos geométricos, diferencia de alto 0, cero overflow,
  scroll jail, error geométrico, error de página, API, recurso o readiness.
  Baseline:
  “tmp/visual-qa/audit-territorial-phone-iter40-phone-measure/”. Resultado:
  “tmp/visual-qa/iter40-phone-source-package-after/”.
- Gate proporcional: 37 archivos y 274/274 pruebas de Monitoreo en verde;
  typecheck, git diff --check y
  node agentic/sync-agentic-os.mjs --check también en verde. Las dos
  advertencias del sincronizador corresponden a skills externos no
  disponibles ya documentados.
- Cierre del recorrido compacto: el navegador integrado confirmó el dueño
  exterior con clientHeight=377, scrollHeight=1632 y maxScroll=1255. En el
  inicio, Base quedó completa; en scrollTop=363, Barrido y Kobo quedaron
  simultáneamente completos; en scrollTop=1255 se alcanzó el último contenido
  del panel. Los 21 títulos y valores operativos medidos registraron
  scrollWidth<=clientWidth, sin recorte silencioso.

La iteración cierra esta falla focal, no el objetivo continuo. El siguiente
recorrido retoma las secciones pendientes de Territorial, Acreditación y Aulas
y vuelve a seleccionar únicamente el primer defecto reproducible.

### Iteración 41 — Acreditación/Fuentes activas: nombres distintos vuelven a ser distinguibles

- Falla medida con acrconta real, 13/13 fuentes y 1.277 registros: los tres
  paneles ya conservaban un marco correcto de 444×420 px y diferencia 0, pero
  Recopiladores forzaba todos los nombres a una línea junto a su insignia.
  Textos como “Acreditación Contabilidad PUCP Estudiantes” y sus variantes de
  Egresados quedaban reducidos a fragmentos visualmente casi idénticos incluso
  a 1440×1000. La lista sí tenía scroll propio; la causa era truncación interna,
  no jail ni capacidad exterior.
- Contrato: cada tarjeta repetida conserva un alto definido, independiente de
  la longitud del nombre. En escritorio el marco mide 64 px y admite dos
  líneas. Entre 981 y 1200 px mide 84 px; título, metadato y detalle ocupan
  filas explícitas, de modo que la insignia no compite con el nombre. El alto
  de los tres paneles exteriores no cambia.
- Regresión roja/verde: la primera prueba exigió dos líneas dentro de tarjetas
  iguales y falló antes del cambio. La inspección compacta mostró que dos
  líneas no bastaban mientras título e insignia compartieran fila; una segunda
  prueba roja fijó el contrato intermedio de 84 px y tres filas. El archivo
  focal terminó con 5/5 pruebas en verde.
- QA grande hidratado:
  “tmp/visual-qa/iter41-acreditacion-active-sources-after-1440/”,
  ok=true. Las tres superficies mantienen 444×420 px y delta 0. Las listas de
  7 y 6 fuentes poseen su exceso dentro de ventanas 357/496 y 357/424 px,
  respectivamente; cada superficie conserva 1 px de capacidad interior y
  cero hueco exterior.
- QA compacto hidratado:
  “tmp/visual-qa/iter41-acreditacion-active-sources-after-1024-v2/”,
  ok=true. Las superficies conservan 300 px de alto y delta 0; las listas
  internas son dueñas de 209/360, 237/636 y 237/544 px. El workbench exterior
  también conserva recorrido 417/552. Los nombres principales quedan completos
  y las insignias pasan a su propia fila.
- Las corridas
  “tmp/visual-qa/iter41-acreditacion-active-sources-after/” y
  “tmp/visual-qa/iter41-acreditacion-active-sources-after-ready/” mostraron
  loaders o no alcanzaron el puente de navegación. Se conservan solo como
  diagnóstico y no forman parte de la aprobación.
- Gate proporcional: 37 archivos y 276/276 pruebas de Monitoreo, typecheck y
  git diff --check en verde.
- Recorrido automático definitivo:
  “tmp/visual-qa/iter42-acreditacion-scroll-audit/” confirmó el workbench
  exterior en 0/67/135 y las listas Actores en 0/75/151, Recopiladores en
  0/199/399 y Sheets en 0/153/307. Los cuatro dueños alcanzaron exactamente
  maxScroll, dejaron visible el último elemento y restauraron su posición
  inicial. Ninguno de los 17 nombres de esas tres listas registró recorte
  horizontal o vertical.

La iteración 41 tampoco cierra el objetivo general. La próxima pasada continúa
desde Territorial y Aulas, que se detuvieron al aparecer primero esta falla de
Acreditación.

### Iteración 42 — el comprobador recorre el scroll, no solo declara que existe

- Deuda del gate: ui-quick-check ya rechazaba dueños colapsados y registraba
  clientHeight/scrollHeight, pero no desplazaba cada dueño a inicio, medio y
  final. Cuando el navegador integrado no estaba disponible, el gate debía
  quedar pendiente aunque la geometría estructural fuese correcta.
- Cambio: cada dueño de overflow descubierto por un grupo geométrico conserva
  ahora scrollTop original, visita 0, maxScroll/2 y maxScroll, confirma atEnd,
  mide el borde inferior del último hijo visible y restaura la posición. El
  reporte también incorpora client/scroll width y height de hasta 60 títulos
  strong por dueño, distinguiendo recorte horizontal y vertical.
- Fallo nuevo: “scroll-unreachable” entra en geometryIssues si el dueño no
  alcanza su máximo o el final del último contenido no queda visible. Por
  tanto, fail-on-issues ya no puede aprobar un overflow meramente declarado.
- Regresión roja/verde: el fixture válido añadió un dueño 92/156 con tres
  elementos. La prueba falló al faltar scrollAudit, luego confirmó atEnd,
  lastContentReachable, end=maxScroll y títulos sin recorte. Los cuatro tests
  del runner —geometría, dueño colapsado, readiness y details cerrado— quedaron
  en verde.
- Primera aplicación real: el recorrido compacto de la iteración 41 quedó
  aprobado sin interacción manual. El mismo reporte detectó además un recorte
  fuera de ese alcance: el timestamp del KPI “Último sync” usa 125 px para
  132 px. Se registra como candidato de la siguiente pasada, no se oculta ni se
  mezcla con la reparación ya cerrada.

El verificador independiente reabrió su único pendiente con esta evidencia y
emitió `APROBADO`: los cuatro dueños llegan a inicio, medio y final, el último
contenido es alcanzable y los 17 títulos del alcance no se recortan. Este gate
cierra únicamente las iteraciones 41–42; el objetivo continuo sigue activo.

### Scope lock — iteración 43

- Módulo: `Monitoreo > Acreditación > Fuentes > Fuentes activas`, resumen de
  cuatro KPI.
- Fuente de verdad: geometría real del proyecto `acrconta` en `1440×1000` y
  `1024×600`, más el contrato de tarjetas repetidas con marco estable y texto
  operativo completo.
- Archivos previstos: `profilePage.css`,
  `AcreditacionActiveSourcesLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX y modelo de datos, chrome compartido, topbar,
  sidebar, API, persistencia y cualquier superficie ajena a Fuentes activas.
- Riesgo principal: resolver el recorte haciendo crecer de forma desigual los
  KPI o inflando el resumen hasta quitar altura útil a las tres listas.
- Cambio permitido: una sola composición interior común para los cuatro KPI;
  no se añade copy, no se cambia su cardinalidad y no se altera el alto de una
  tarjeta según el valor.
- Gate mínimo: regresión focal roja/verde, inspección real en ambos viewports,
  métricas de texto sin recorte, recorrido completo del dueño exterior,
  typecheck y `git diff --check`.

### Iteración 43 — Acreditación/Fuentes: los KPI dejan de competir por una línea

- Falla de entrada, `1024×600`: las cuatro tarjetas conservaban ancho y alto
  comunes, pero dividían cada una en dos columnas internas. “Último sync” daba
  al timestamp 125 px para 132 px y lo truncaba; “Recop. incluidos” y la propia
  etiqueta de sincronización también aparecían abreviadas.
- Contrato: continúan siendo cuatro marcos equivalentes en la misma grilla. En
  cada uno, etiqueta y valor ocupan dos filas intrínsecas comunes, centradas en
  la tarjeta; ningún contenido decide un alto distinto y no se reduce la fuente
  para esconder el problema.
- Regresión roja/verde: la sexta prueba de
  `AcreditacionActiveSourcesLayout.test.ts` exigió una columna y dos filas
  internas; falló ante el reparto `0.6fr / 1fr` y terminó 6/6 en verde después
  del cambio focal.
- Evidencia compacta válida:
  `tmp/visual-qa/iter43-acreditacion-active-kpis-ready-1024/`, con
  `data-audit-ready=monitoreo-acreditacion` y `ok=true`. El timestamp mide ahora
  207/207 px, sin recorte horizontal ni vertical. Las tres superficies siguen
  en 300 px, delta 0, capacidad interior de 1 px y hueco exterior 0.
- Recorrido compacto: el dueño exterior conserva 417 px visibles, visita
  0/72/145 y deja alcanzable el último contenido. Actores, Recopiladores y
  Sheets alcanzan respectivamente 0/75/151, 0/199/399 y 0/153/307.
- Evidencia grande válida:
  `tmp/visual-qa/iter43-acreditacion-active-kpis-ready-1440/`, también
  `ok=true` y audit-ready. Los paneles preservan 444×420 px, delta 0, y las
  cuatro etiquetas y valores se leen completos.
- Costo controlado: separar etiqueta y valor añade cerca de 10 px al resumen;
  no modifica el alto de las superficies de datos. En compacto el exceso queda
  dentro del único dueño exterior y aumenta su máximo de 135 a 145 px, todavía
  completamente recorrible.
- Evidencia rechazada:
  `iter43-acreditacion-active-kpis-after/`,
  `iter43-acreditacion-active-kpis-warmup/` e
  `iter43-acreditacion-active-kpis-after-1024/` capturaron datos fríos o el
  loader antes de exigir audit-ready. No participan del veredicto visual.
- Gate proporcional: 37 archivos y 277/277 pruebas de Monitoreo, typecheck,
  `git diff --check` y sincronización del agentic OS en verde. Los cuatro tests
  del comprobador también quedaron verdes al ejecutarse con permiso para su
  servidor efímero; la primera corrida sin ese permiso falló exclusivamente
  con `listen EPERM 127.0.0.1` y no fue un fallo de producto.

Esta reparación focal queda lista para verificación independiente. Su cierre
no detiene el objetivo: la siguiente pasada vuelve al recorrido pendiente de
Territorial y Aulas y selecciona el primer defecto visual literal.

El verificador independiente emitió `APROBADO` para la iteración 43: confirmó
los cuatro KPI equivalentes, el timestamp 207/207 px sin recorte, el recorrido
0/72/145 con final alcanzable, delta 0 en ambos viewports y todos los gates
verdes. Se cierra solo esta unidad; el objetivo general permanece activo.

### Scope lock — iteración 44

- Módulo: `Monitoreo > Territorial > Avance > Mapa y UMP`, toolbar de seis
  filtros.
- Fuente de verdad: proyecto territorial hidratado `acnur_acg-ump`, captura
  `1024×600` frente a `1440×1000` y el placeholder operativo completo definido
  en el componente.
- Archivos previstos: `monitoreo.css`, `TerritorialAdvanceLayout.test.ts` y
  este registro QA.
- Exclusiones explícitas: TSX, datos y mapa, tabs y chrome compartidos, topbar,
  sidebar, API, persistencia y `.mon-query-search` fuera de este toolbar.
- Falla literal: en 1024 el buscador muestra “Buscar UMP, manzana, distrito o
  responsa…”; “responsable” solo aparece completo en grande. No es un overflow
  global y por eso el comprobador anterior lo dejó pasar.
- Causa: entre 981 y 1360 px el toolbar conserva tres columnas iguales; el
  buscador recibe un tercio del ancho y no ocupa una fila de orientación.
- Cambio permitido: en el régimen que ya apila el workspace (`<=1180px`), el
  buscador específico ocupa `1 / -1`; los cinco selects conservan la grilla de
  tres columnas. No se cambia copy ni tipografía.
- Riesgo principal: la fila adicional baja el mapa en el primer pliegue.
- Gate mínimo: prueba focal roja/verde, QA real audit-ready en ambos viewports,
  placeholder completo, top/medio/final del dueño exterior, suite Monitoreo,
  typecheck y `git diff --check`.

### Iteración 44 — Territorial/Avance: búsqueda completa y toolbar sin celda muerta

- Auditoría paralela: Territorial aportó una falla literal en Mapa y UMP;
  Aulas no tenía evidencia contemporánea suficiente y conserva como siguiente
  deuda una corrida real de sus cinco secciones. No se convirtió esa ausencia
  de evidencia en aprobación ni en un defecto inventado.
- Baseline hidratado:
  `tmp/visual-qa/territorial-avance-after-v3-20260726/ump/`. A `1024×600` el
  buscador recibía una de tres columnas y cortaba el placeholder después de
  “responsa”; a `1440×1000` el texto aparecía completo.
- Primera reparación: el buscador específico ocupó `1 / -1` bajo 1180 px. La
  captura mostró el texto completo, pero también una tercera celda vacía en la
  última fila de cinco selects; se rechazó esa composición intermedia en lugar
  de aceptar un nuevo hueco sin dueño.
- Contrato final entre 981 y 1180 px: retícula de seis unidades; búsqueda en
  seis, Distrito/Estado/Cuota en dos cada uno y Zona/Responsable en tres cada
  uno. Bajo 980 px se conservan dos columnas y Responsable ocupa la última fila
  completa. Todos los controles mantienen el mismo alto y no se añade copy.
- Regresión roja/verde: `TerritorialAdvanceLayout.test.ts` falló primero al no
  existir el span de búsqueda y una segunda vez al no existir la retícula
  balanceada. Terminó con 7/7 pruebas en verde.
- Evidencia compacta válida:
  `tmp/visual-qa/iter44-territorial-ump-toolbar-ready-1024-v2/`, audit-ready y
  `ok=true`. El placeholder se lee completo; las dos filas de selects llenan
  todo el ancho sin celda muerta. El dueño exterior mide 343,84 px, visita
  0/503/1007, llega a `maxScroll` y deja visible el último panel.
- Evidencia grande válida:
  `tmp/visual-qa/iter44-territorial-ump-toolbar-ready-1440/`, audit-ready y
  `ok=true`. La regla compacta no altera el toolbar ancho; el dueño exterior
  visita 0/35/70 y también alcanza su último contenido.
- Ambos reportes: cero overflow global, scroll jail, error geométrico, de
  página, consola, API, recurso, proyecto o readiness.
- Evidencia rechazada: `iter44-territorial-ump-toolbar-warmup/` agotó el primer
  plazo antes de audit-ready, y
  `iter44-territorial-ump-toolbar-ready-1024/` corresponde a la composición
  intermedia con una celda vacía. Ninguna participa del veredicto.
- Gate proporcional: 37 archivos y 278/278 pruebas de Monitoreo, typecheck,
  cuatro pruebas del comprobador, `git diff --check` y sincronización del
  agentic OS en verde. Las dos advertencias del sincronizador siguen siendo los
  skills externos ausentes ya documentados.

La iteración 44 queda lista para verificación independiente. El objetivo
continuo permanece activo y, después del gate, retomará la deuda real de Aulas
o el siguiente defecto literal que aparezca antes.

El verificador independiente emitió `APROBADO`: confirmó los tres regímenes
del toolbar, el placeholder íntegro sin celda muerta, ambos recorridos de
scroll y todos los gates verdes. Se cierra únicamente la iteración 44.

### Scope lock — iteración 45

- Módulo: comprobador local `ui-quick-check`, detección de texto operativo en
  controles; no es una modificación de producto.
- Fuente de verdad: el falso verde de la iteración 44, donde un input vacío
  recortaba su placeholder aunque `visualIssues=0`.
- Archivos previstos: `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-geometry.test.mjs` y este registro.
- Exclusiones explícitas: frontend, API, Electron, skills/agentes y cualquier
  control con valor escrito por la persona usuaria.
- Cambio permitido: medir placeholders no vacíos de inputs visibles cuyo valor
  actual esté vacío, usando la fuente computada y el ancho útil del control;
  registrar métricas y emitir `placeholder-clipped` si no caben.
- Riesgo principal: falsos positivos por medir padding o tipografía de forma
  distinta al navegador.
- Gate mínimo: fixture sintético rojo/verde con input estrecho, cuatro pruebas
  del runner, reaplicación real al toolbar reparado y `git diff --check`.

### Iteración 45 — el QA mide placeholders, no solo cajas

- Regresión roja: el fixture geométrico incorporó un input de 112 px con
  “Buscar UMP, manzana, distrito o responsable...”. La prueba falló porque el
  reporte ni siquiera exponía `controlTextMetrics`; era el mismo falso verde de
  la iteración 44 reducido a un caso mínimo.
- Cambio: para cada input visible, vacío y con placeholder, el runner compone la
  fuente computada en canvas, incorpora `letter-spacing`, resta el padding del
  ancho útil y registra `textWidth`, `availableWidth` y `clippedX`.
- Fallo efectivo: cuando el texto supera el ancho útil por más de 1 px, entra un
  issue `placeholder-clipped`; por tanto `--fail-on-issues` ya no aprueba el
  recorte silencioso. Inputs con valor escrito no se auditan como placeholder.
- Regresión verde: el fixture estrecho ahora se rechaza y confirma tanto la
  métrica como el issue; las dos pruebas geométricas quedaron 2/2 en verde.
- Aplicación real:
  `tmp/visual-qa/iter45-territorial-placeholder-guard/`, audit-ready y
  `ok=true`. En el toolbar reparado el placeholder mide 284,96 px dentro de
  854 px útiles (`clippedX=false`), no produce issues y el dueño exterior sigue
  recorriendo 0/503/1007 con último contenido alcanzable.
- La ayuda del comando declara ahora explícitamente esta comprobación, de modo
  que un `visualIssues=0` ya incluye el contrato tipográfico de placeholders.
- Gate proporcional: cuatro pruebas del runner, `node --check` y
  `git diff --check` en verde. No se repitió la suite de producto 278/278 porque
  esta unidad no modificó frontend; ese gate pertenece a la iteración 44 ya
  aprobada.

La iteración 45 queda lista para verificación independiente y no cierra el
objetivo general.

El verificador independiente emitió `APROBADO`: confirmó la medición
tipográfica, el umbral, la exclusión de inputs con valor, la aplicación real y
todos los gates. Se cierra únicamente la iteración 45.

### Iteración 46 — Aulas: vacío real y cardinalidad poblada sin falsos arreglos

- Proyecto real vacío: se trabajó únicamente sobre una copia temporal de
  `hsvg2026.pulso`; el original canónico permaneció intacto. La matriz válida
  `tmp/visual-qa/iter46-aulas-real-ready-1024-v2/` recorrió Fuentes, Agenda,
  Avance, Validación y Consultas a `1024×600` con
  `data-audit-ready=monitoreo-aulas`.
- Resultado vacío: cinco capturas, siete grupos geométricos y delta de alto 0;
  cero overflow global, scroll jail, recorte, error geométrico, de página, API,
  recurso, proyecto o readiness. Los seis KPI conservaron 153,33–153,34 px de
  ancho y 68,38 px de alto; los tres estados operativos y los cuatro estados de
  traspaso también mantuvieron marcos equivalentes.
- Lectura del blanco: en Agenda, Avance, Validación y Consultas el espacio no
  usado quedó dentro del borde de la superficie de datos. No existe un hermano
  estirado ni un hueco exterior entre secciones. Es capacidad legítima del
  contenedor y se conserva, conforme a la distinción pedida por el usuario.
- Intento real de cardinalidad alta: el botón normal `Importar plan`, ejecutado
  sobre la copia temporal, respondió literalmente `409
  E_NO_CALC_MUESTRA_AULAS`. El reporte
  `tmp/visual-qa/iter46-aulas-import-plan-1024-v3/` se rechaza como evidencia
  visual porque contiene un error API y un selector post-click ausente; sí
  demuestra que el proyecto no conserva una selección de aulas importable. No
  se fabricó una selección ni se atribuyó el 409 a Monitoreo.
- Complemento poblado: la semilla canónica
  `api/inst/audit_reference/prosecnur_audit_reference.pulso`, copiada a `/tmp`,
  aporta 8 cursos-horario, 1 fila de avance, 6 controles de validación y 16
  filas de consultas. La matriz
  `tmp/visual-qa/iter46-aulas-populated-matrix/` recorrió las cinco secciones en
  `1024×600` y `1440×1000`: 10 capturas, 14 grupos, delta 0 y todos los
  contadores de overflow, scroll jail, errores y misses en cero.
- Comparación 0/1/muchos: el marco exterior y la banda de KPI permanecieron
  estables; la cardinalidad cambió únicamente dentro de la tabla propietaria.
  Una fila de Avance dejó capacidad interior visible, mientras Agenda,
  Validación y Consultas la ocuparon progresivamente sin inflar otras
  secciones. No apareció un defecto cosmético literal P1–P3 y por eso no se
  modificó CSS ni composición.
- Evidencia rechazada adicional: las corridas iniciales
  `iter46-aulas-real-audit-1024/` y `iter46-aulas-real-ready-1024/` no tenían el
  modo persistido; `iter46-aulas-mode-configuration/` solo confirmó la elección
  de modo, y `iter46-aulas-import-plan-1024/` no alcanzó una API viva. Ninguna
  forma parte del veredicto.
- Deuda precisa: las tablas aún no declaran en markup que poseen su capacidad
  interior. Por eso el runner solo las ve de forma indirecta y no puede
  demostrar inicio/medio/final de sus filas en una auditoría intrínseca. Esa es
  la siguiente unidad; no invalida las matrices visuales aprobadas.

Esta iteración cierra exclusivamente la matriz Aulas 0/1/muchos. El objetivo
general sigue activo.

### Scope lock — iteración 47

- Módulo: `Monitoreo > Aulas`, contrato QA de las superficies de tabla en sus
  cinco secciones.
- Fuente de verdad: las matrices válidas de la iteración 46 y el contrato que
  diferencia capacidad interior deliberada de hueco exterior por estiramiento.
- Archivos previstos: `AulasMonitoreoPage.tsx`, `aulasMonitoreo.css`,
  `AulasCompactWorkbenchLayout.test.ts` y este registro QA.
- Exclusiones explícitas: CSS, datos, API, persistencia, topbar, sidebar, otras
  familias de Monitoreo y el comportamiento visual de la tabla.
- Cambio permitido: declarar `.mon-profile-table-wrap` como dueño de capacidad
  geométrica y conservar ese mismo viewport visible cuando la tabla no tiene
  filas, con su mensaje actual centrado dentro. No cambiar copy, alto exterior,
  ancho, cardinalidad ni scroll.
- Riesgo principal: una marca demasiado amplia podría ocultar capacidad
  exterior inválida. El ownership queda limitado al wrapper visible que
  contiene la tabla, nunca al panel ni al workbench.
- Gate mínimo: regresión focal roja/verde, matriz real vacía y poblada con grupo
  intrínseco sobre el panel de tabla, recorrido 0/medio/final cuando exista
  overflow, suite Monitoreo, typecheck y `git diff --check`.

### Iteración 47 — Aulas: el vacío conserva su contenedor y el QA conoce al dueño

- Falla precisa: con cero filas, `DataTable` devolvía solo un párrafo. El panel
  exterior mantenía la altura, pero no existía un viewport de datos visible que
  fuese propietario de la capacidad vacía. El estado poblado sí renderizaba
  `.mon-profile-table-wrap`; la estructura cambiaba según cardinalidad.
- Reparación: vacío y poblado usan ahora el mismo wrapper visible, con alto y
  borde estables. El mensaje operativo existente queda centrado dentro; no se
  añadió copy ni una explicación ornamental. La capacidad se declara
  `data-qa-geometry-capacity=owned`, limitada al wrapper, y nunca al panel o al
  workbench.
- Contrato automático: los cinco paneles de tabla declaran
  `monitoring-aulas-table` con contrato `intrinsic`; el wrapper es el único
  `data-qa-geometry-member`. Esto evita confundir los 3–4 px normales del
  padding del encabezado con capacidad inflada y conserva la tolerancia estricta
  de 2 px.
- Regresión roja/verde: la prueba focal falló primero al faltar ownership,
  después al conservar el retorno directo del párrafo y finalmente al faltar
  el grupo de markup. Terminó 8/8 en verde, comprobando dos ramas del wrapper,
  cinco paneles intrínsecos y que ningún `section` reclame capacidad.
- Evidencia vacía válida:
  `tmp/visual-qa/iter47-aulas-owned-empty-matrix-v3/`. Diez capturas —cinco
  secciones por dos viewports—, 24 grupos, cero error geométrico, overflow,
  scroll jail, error o miss. En Avance, Validación y Consultas el mensaje queda
  centrado dentro de una superficie claramente delimitada de 952×256,63 px en
  compacto y 1.348×631 px en grande.
- Evidencia poblada válida:
  `tmp/visual-qa/iter47-aulas-owned-populated-matrix/`, con los mismos diez
  estados y 24 grupos en verde. Fuentes recorre 0/14/29, Agenda 0/81/162 y
  Consultas 0/185/370 a `1024×600`; los tres llegan a `maxScroll` y dejan
  alcanzable su último contenido. Avance con una fila conserva 163,63 px de
  capacidad dentro del wrapper; Validación con seis controles deja 20,63 px;
  ningún hermano cambia de marco.
- Evidencia rechazada: `iter47-aulas-owned-empty-matrix/` demostró que faltaba
  el ownership en vacío; `-v2` y la corrida con grupo CLI expusieron un falso
  positivo del encabezado antes de declarar el grupo en markup. Se conservan
  como secuencia roja, no como aprobación.
- Gate proporcional: 37 archivos y 279/279 pruebas de Monitoreo, typecheck,
  cuatro regresiones del comprobador, sincronización del agentic OS y
  `git diff --check` en verde. El sincronizador repite únicamente las dos
  advertencias históricas de skills externos ausentes.

Esta unidad queda lista para verificación independiente. Su cierre no detiene
el objetivo general; la próxima pasada continúa en la siguiente superficie de
Monitoreo con deuda visual literal.

El primer gate independiente emitió `RECHAZADO`: comparó las dos matrices —no
solo cada una consigo misma— y encontró que Agenda a `1024×600` medía 196 px
vacía y 260,63 px poblada, delta 64,63 px. La causa es la fila `auto auto` del
stack compacto: la cantidad de filas decidía el alto exterior. La unidad se
reabre; el contrato correcto es handoff intrínseco + panel de datos en la fila
restante estable, con cardinalidad resuelta por el scroll del wrapper.

- Reparación del rechazo: en altura corta el stack de Agenda usa ahora
  `auto minmax(0, 1fr)`, `align-content: stretch` y `overflow: hidden`. El
  handoff conserva su alto intrínseco; el panel recibe exactamente la fila
  restante y las filas adicionales ya no agrandan el marco.
- Evidencia comparativa definitiva:
  `tmp/visual-qa/iter47-aulas-owned-empty-stable-matrix/` y
  `tmp/visual-qa/iter47-aulas-owned-populated-stable-matrix/`. Agenda mide en
  ambos estados 978×260,63 px y su wrapper 952×192,63 px a `1024×600`; delta
  literal 0. A `1440×1000` ambos conservan 1.374×539 px y wrapper 1.348×467 px.
- En el estado poblado compacto, la tabla recorre 0/81/162, alcanza
  `maxScroll` y deja visible “Mostrando 8 de 60 columnas”. En vacío, el mismo
  marco muestra el mensaje centrado dentro de su owner, sin scroll artificial.
- Las dos matrices definitivas mantienen 10 capturas, 24 grupos y todos los
  contadores de overflow, scroll jail, geometría, errores y misses en cero.
  La suite posterior a esta reparación vuelve a cerrar 37 archivos y 279/279
  pruebas, typecheck y `git diff --check` en verde.

La unidad vuelve al verificador independiente con la divergencia anterior
corregida de forma falsable. El objetivo general continúa activo.

El verificador independiente reabrió su rechazo y emitió `APROBADO`: confirmó
delta 0 en 1024 y 1440, ownership limitado al wrapper, recorrido 0/81/162 con
final alcanzable, ambas matrices `ok=true` y todos los gates verdes. Se cierra
únicamente la iteración 47.

### Scope lock — iteración 48

- Módulo: `Monitoreo > Telefónico > Consultas > Efectivas Kobo`, resumen y
  filtros en `1024×600`.
- Fuente de verdad: copia temporal del proyecto canónico `acnur_pdm.pulso`,
  reporte `tmp/visual-qa/iter48-telefonico-sections-baseline-1024/` y el
  placeholder completo definido en producto.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX y modelo de datos, otras pestañas de Consultas,
  Fuentes/Modelo/Llamadas/Avance, topbar, sidebar, API, persistencia y `.pulso`.
- Fallas literales: a 1024 el resumen de tres métricas se apila en tres filas y
  compite verticalmente con seis filtros; las métricas, filtros y tabla se
  solapan dentro del panel. El buscador recibe 225 px útiles para un placeholder
  de 252,92 px y lo recorta.
- Causa: el breakpoint `<=1180px` fuerza una columna para el resumen pese a
  disponer de casi 900 px, mientras el filtro continúa como flex-wrap con bases
  variables. El panel conserva su alto, pero los controles no tienen una
  retícula compacta estable.
- Cambio permitido: conservar las tres métricas en tres columnas equivalentes;
  convertir filtros compactos en dos filas explícitas —búsqueda + limpiar,
  luego cuatro selects equivalentes—. No cambiar copy, datos, alto exterior ni
  cardinalidad.
- Riesgo principal: devolver altura a la tabla a costa de estrechar selects.
  Cada select debe conservar un cuarto del ancho útil y elipsis interna; el
  buscador debe mostrar el placeholder completo.
- Gate mínimo: regresión focal roja/verde, QA real audit-ready en 1024 y 1440,
  placeholder sin recorte, rectángulos sin intersección, tabla visible y dueño
  de scroll alcanzable, suite Monitoreo, typecheck y `git diff --check`.

La matriz inicial también registró un `scroll-unreachable` en Avance y dos
capturas frías de Modelo/Llamadas; quedan fuera de este scope y deberán
reproducirse después. El inventario vigente suma 5 secciones y 15 pestañas
base, más Salvedades condicional; los QA históricos de cuatro pestañas no son
el contrato actual.

### Iteración 48 — Telefónico Consultas: dos filas legibles sin solapamiento

- Falla reproducida: en
  `tmp/visual-qa/iter48-telefonico-sections-baseline-1024/`, la regla
  combinada del breakpoint convertía las tres métricas en tres filas mientras
  los filtros seguían resolviéndose por `flex-wrap`. Resumen, filtros y tabla
  ocupaban el mismo espacio visual; además, el placeholder de 252,92 px solo
  recibía 225 px útiles.
- Reparación estructural: a `<=1180px` el resumen conserva tres columnas
  equivalentes. Los filtros usan dos filas explícitas: búsqueda y limpiar
  arriba; cuatro cápsulas equivalentes abajo. El cambio no modifica datos,
  copy, orden funcional, panel exterior, topbar ni sidebar.
- Segunda inspección visual: el primer arreglo eliminó el solapamiento, pero
  todavía elidía “Todas las fechas” y “Todas las encuestas”. Las cuatro
  cápsulas compactas pasaron a un marco vertical común de etiqueta + valor; no
  se añadieron explicaciones ni texto ornamental. A `1024×600` miden
  194,98–195 × 50 px y muestran completos “Todas las sedes”, “Todas las
  fechas”, “Todas las encuestas” y “Todos”.
- Evidencia definitiva:
  `tmp/visual-qa/iter48-telefonico-consultas-final-valid/`. Dos capturas
  audit-ready en `1024×600` y `1440×900`, cuatro grupos geométricos, cero
  issue visual, scroll jail, error geométrico, miss, overflow global, error de
  página, consola, API, recurso o proyecto; `ok=true`.
- Geometría: en compacto las métricas miden
  292,66–292,67 × 33,75 px; en grande,
  431,33–431,34 × 33,75 px. El delta de alto es 0 en ambos viewports. La
  búsqueda dispone de 740 px útiles en compacto para su placeholder de
  252,92 px; en grande dispone de 252 px y queda dentro de la tolerancia
  tipográfica de 1 px, con `clippedX=false`.
- Scroll y alcance: el contenido de Consultas conserva un único dueño de
  desplazamiento. En `1024×600` el recorrido comprobado es 0/98/196; llega a
  `maxScroll` y el último contenido queda alcanzable. La tabla comienza
  debajo de los filtros y no intersecta sus rectángulos.
- Evidencia rechazada:
  `iter48-telefonico-consultas-ready-after/` capturó “Preparando consultas”
  en 1024 y por tanto no cuenta, aunque 1440 sí estuviera hidratado.
  `iter48-telefonico-consultas-final-matrix/` mostró correctamente ambos
  viewports, pero se rechazó como gate porque aplicó `equal` al grupo
  heterogéneo completo: comparó búsqueda/limpiar de 32 px contra las cápsulas
  de 50 px. El contrato válido exige igualdad entre las cuatro cápsulas, no
  entre controles de filas y funciones diferentes.
- Regresión: la prueba focal protege la ausencia de la antigua regla combinada,
  las tres columnas del resumen, la retícula de dos filas, el ancho del
  buscador, las cuatro cápsulas verticales y la posición de limpiar. Quedó 9/9
  en verde.
- Gate proporcional: 37 archivos y 280/280 pruebas de Monitoreo, typecheck y
  `git diff --check` en verde.

Esta unidad queda lista para verificación independiente. Su cierre no detiene
el objetivo general: la siguiente pasada retoma el `scroll-unreachable`
observado en Telefónico Avance y continúa después por las pestañas restantes.

El verificador independiente emitió `APROBADO`: confirmó las dos capturas
audit-ready, métricas y cápsulas equivalentes, textos completos, ausencia de
solapamiento, un solo dueño de scroll con inicio/medio/final alcanzable y los
gates focal 9/9, Monitoreo 280/280, typecheck y diff-check. Se cierra
únicamente la iteración 48; el objetivo general permanece activo.

### Scope lock — iteración 49

- Módulo: `Monitoreo > Telefónico > Avance > Resumen`, ownership de altura y
  scroll en compacto y ancho.
- Fuente de verdad: proyecto real temporal `acnur_pdm.pulso`, baseline
  `tmp/visual-qa/iter49-telefonico-avance-baseline/`, recorrido
  `iter49-telefonico-avance-scroll/scroll-report.json` y recorrido anidado
  `nested-focus-report.json`.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, modelo de datos, otras pestañas/secciones,
  runner visual, topbar, sidebar, API, persistencia y archivos `.pulso`.
- Falla literal: a `1024×600` el contenido final es alcanzable, pero el panel
  intermedio se convierte en owner mientras su grid único conserva una caja
  corta y deja que los hijos desborden. A `1440×900` el grid exterior añade
  13 px de scroll sobre el scroll real de 154 px de `Sedes y pendientes`;
  obliga a agotar dos superficies anidadas.
- Cambio permitido: hasta 1200 px, resumen y grid crecen de forma intrínseca y
  delegan el scroll a `.mon-workbench-content--avance`. Desde 1201 px, el
  grid mantiene la composición fija de tres columnas sin scroll propio; cada
  superficie interna conserva su scroll solo cuando su contenido excede su
  marco. No cambiar alturas, copy, datos ni cardinalidad.
- Riesgo principal: recortar la banda 1181–1200 o impedir el acceso al último
  artículo del foco ancho. La matriz incluye `1024×600`, `1200×600` y
  `1440×900`, con inicio/medio/final del owner efectivo y bounds del último
  hijo real.
- Gate mínimo: regresión CSS roja/verde, QA real audit-ready en los tres
  anchos, cero scroll anidado, último contenido alcanzable, suite Monitoreo,
  typecheck y `git diff --check`.

El falso positivo genérico del runner —medir la caja del wrapper corto en lugar
de su último descendiente desbordado— queda separado para la iteración 50. No
se mezclará con esta reparación de producto.

### Iteración 49 — Telefónico Avance: ownership continuo y sin doble scroll

- Diagnóstico real previo: a `1024×600` el owner intermedio medía 361/1.235 px
  y recorría 0/437/874. El runner marcaba el grid corto como inalcanzable, pero
  el último bloque real y “Chorrillos” quedaban completos, con 14,39 px de
  margen. Era un falso positivo de la sonda sobre una estructura de ownership
  ambigua, no un recorte del usuario.
- Defecto ancho confirmado: a `1440×900` el grid exterior añadía 13 px de
  scroll y `.mon-advance-focus` otros 154 px. El último artículo era
  accesible solo después de agotar ambas superficies. No había pérdida
  permanente, pero sí fricción P3 por scroll anidado.
- Reparación: hasta 1200 px el resumen usa altura intrínseca, una fila
  `auto`, `overflow:visible` y no encoge; el owner pasa al workbench. Desde
  1201 px el grid conserva sus tres columnas y dos filas, pero deja de
  desplazarse; `Sedes y pendientes` mantiene su scroll interno porque es la
  superficie que realmente contiene más elementos.
- Regresión roja/verde: el test falló primero en dos contratos —grid ancho aún
  `overflow:auto` y resumen compacto sin `max-content`— y terminó 10/10 en
  verde. La prueba cubre además la banda 1181–1200 que antes mezclaba reglas de
  ambos breakpoints.
- Evidencia definitiva:
  `tmp/visual-qa/iter49-telefonico-avance-final-valid/`. Tres capturas
  audit-ready en `1024×600`, `1200×600` y `1440×900`; tres grupos
  geométricos y todos los contadores de issues, jails, geometría, misses,
  overflow y errores en cero; `ok=true`.
- Owners definitivos:
  - 1024: workbench 377/1.259, recorrido 0/441/882, panel final bottom 583,70
    frente a owner bottom 591.
  - 1200: workbench 377/1.246, recorrido 0/434/869, panel final bottom 584,52.
  - 1440: el grid exterior no tiene scroll; el owner útil es
    `.mon-advance-focus` 298/452, recorrido 0/77/154 y último contenido bottom
    875,91 frente a owner bottom 888,50.
- Evidencia rechazada:
  `iter49-telefonico-avance-final-matrix/` aplicó un contrato `intrinsic`
  CLI a cuatro paneles heterogéneos y trató 11 px normales de aire interior en
  la tarjeta del gráfico como `capacity-drift`. Las imágenes y el ownership
  eran correctos, pero ese contrato comparativo no representa la composición y
  no se usa como aprobación.
- Gate proporcional: 37 archivos y 281/281 pruebas de Monitoreo, typecheck y
  `git diff --check` en verde.

Esta unidad queda lista para verificación independiente. Su cierre no detiene
el objetivo general; la siguiente unidad corrige el criterio genérico del
runner que originó el falso positivo compacto.

El verificador independiente emitió `APROBADO`: confirmó los tres viewports,
los owners 377/1.259, 377/1.246 y 298/452, todos los finales alcanzables, el
grid ancho sin scroll y los gates 10/10, 281/281, typecheck y diff-check. Se
cierra únicamente la iteración 49; el objetivo general continúa activo.

### Scope lock — iteración 50

- Módulo: comprobador `ui-quick-check`, alcance terminal de un owner vertical
  dentro de la auditoría geométrica.
- Fuente de verdad: falso positivo reproducido en la iteración 49 —wrapper
  `.mon-phone-advance-grid` bottom -299 frente a último bloque real bottom
  582,70— y fixture mínimo nuevo.
- Archivos previstos: `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-geometry.test.mjs` y este registro QA.
- Exclusiones explícitas: frontend producto, CSS/TSX de Monitoreo, API, datos,
  topbar, sidebar, persistencia y `.pulso`.
- Falla literal: `auditScrollOwner` usa
  `visibleChildren(owner).at(-1)`; confunde el último wrapper DOM con el
  extremo pintado real, da falso rojo ante `overflow:visible` y puede dar
  falso verde cuando un terminal está recortado dentro de
  `overflow:hidden|clip`.
- Cambio permitido: resolver el terminal después de llegar a `maxScroll`;
  atravesar wrappers visibles, tratar un scroller descendiente como superficie
  atómica y conservar como fallo un descendiente que cruce una frontera de
  clip. Mantener `atEnd`, tolerancia 2 px, restauración de `scrollTop` y
  campos actuales; los metadatos nuevos serán aditivos.
- Riesgo principal: cruzar accidentalmente un owner anidado o convertir clips
  deliberados en falsos fallos. El fixture cubre wrapper visible, clip real y
  scroller anidado; no se desplaza el owner interno desde la auditoría exterior.
- Gate mínimo: regresión roja/verde, 3/3 tests geométricos, 2/2 readiness,
  `node --check`, reaplicación al baseline de Avance y
  `git diff --check`.

### Iteración 50 — el runner sigue el contenido pintado, no la caja equivocada

- Regresión roja válida: las dos pruebas históricas permanecieron verdes y el
  fixture nuevo falló porque el runner emitía dos issues incorrectos en vez de
  uno. Marcaba como inalcanzables el wrapper visible y el owner exterior
  anidado, mientras dejaba verde el terminal realmente recortado.
- Fixture: tres owners de 96 px prueban un wrapper corto con
  `overflow:visible`, un terminal que cruza `overflow:hidden` y un scroller
  descendiente. Los asserts comprueban owner, terminal, clase de terminal,
  frontera de clip, `atEnd`, `maxScroll` y resultado alcanzable; no se
  limitan a contar issues.
- Reparación: la sonda resuelve el terminal después de llevar el owner a
  `maxScroll`. Recorre wrappers visibles, selecciona el mayor extremo vertical
  con desempate DOM, excluye elementos `fixed`, trata un scroller descendiente
  como superficie atómica y conserva rojo cualquier terminal que exceda más de
  2 px una frontera `hidden|clip`.
- Compatibilidad: se preservan `atEnd`, `lastContent`,
  `lastContentReachable`, `ownerBottom` y `lastContentBottom`. Se añaden
  únicamente `lastContentKind` y `clippedBy` para explicar el veredicto. El
  `scrollTop` original se restaura como antes.
- Regresión verde: `ui-quick-check-geometry.test.mjs` quedó 3/3. El caso
  visible termina en `.visible-terminal` (`leaf`) y pasa; el clip termina en
  `.clip-terminal` (`clipped`) y falla; el exterior anidado termina en
  `.nested-inner-owner` (`nested-scroll`) y pasa sin desplazarlo.
- No regresiones: readiness 2/2, `node --check` del runner y del test, y
  `git diff --check` en verde.
- Reaplicación real:
  `tmp/visual-qa/iter50-runner-real-avance-final/`. Tres capturas en 1024,
  1200 y 1440; tres grupos; cero issue, jail, error geométrico, miss, overflow
  o error de ejecución; `ok=true`. La mejora del runner no altera screenshots
  ni ownership de producto.
- Proporcionalidad: no se repitió la suite React 281/281 ni typecheck porque
  esta unidad no modifica frontend; esos gates ya aprobaron la iteración 49
  inmediatamente anterior.

Esta unidad queda lista para verificación independiente. Su cierre no detiene
el objetivo general; después continúa la matriz vigente de pestañas de
Telefónico y las demás familias de Monitoreo.

El verificador independiente emitió `APROBADO`: confirmó el recorrido de
wrappers visibles, el fallo conservado ante clips, el owner anidado atómico,
compatibilidad aditiva del JSON y todos los gates. Se cierra únicamente la
iteración 50; el objetivo general continúa activo.

### Scope lock — iteración 51

- Módulo: `Monitoreo > Telefónico > Avance > Actores`, proporción entre el
  resumen de cada sede y su gráfico diario en escritorio ancho.
- Fuente de verdad: proyecto real temporal `acnur_pdm.pulso`, evidencia válida
  de Actores en
  `tmp/visual-qa/iter51-telefonico-avance-actores-run2/` para `1024×600` y
  `tmp/visual-qa/iter51-telefonico-avance-actores-1440/` para `1440×900`.
  La captura 1440 del primer lote perdió la sesión y queda explícitamente
  descartada.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, datos y cardinalidad, Salidas, las demás
  pestañas de Avance, otras secciones o perfiles, topbar, sidebar, API,
  persistencia, runner visual y archivos `.pulso`.
- Falla literal: a 1440 cada fila de sede resuelve dos columnas casi 50/50. El
  resumen izquierdo se estira hasta el alto del gráfico y repite un gran vacío
  interior entre métricas y pie; no bloquea contenido ni crea hueco exterior,
  pero degrada la jerarquía y densidad de las cinco filas repetidas.
- Causa: la regla específica
  `minmax(300px, 0.28fr) minmax(0, 1fr)` queda sobrescrita por una agrupación
  tardía que incluye `.mon-phone-quota-rhythm-row` y aplica
  `repeat(auto-fit, minmax(260px, 1fr))`. El breakpoint `<=1200px` apila la
  fila correctamente y debe permanecer intacto.
- Cambio permitido: impedir que la regla genérica tardía sustituya el reparto
  específico de escritorio; conservar la columna única compacta, las alturas
  intrínsecas, los cinco actores, el contenido y el único dueño de scroll.
- Riesgo principal: que el resumen pierda ancho útil o que una regla con mayor
  especificidad impida el apilado a 1024. La verificación debe comprobar
  columnas calculadas, texto completo y recorrido top/medio/final en ambos
  viewports.
- Gate mínimo: regresión CSS roja/verde, QA real audit-ready en 1024 y 1440,
  proporción de escritorio cercana a 28/72, compacto en una columna, cero
  recorte o scroll anidado, suite Monitoreo, typecheck y `git diff --check`.

La auditoría paralela de `Avance > Salidas` queda `APTO` sin cambio de
producto. En `1024×600`, `#monitoreo-avance-panel` mide 377/1.246 px y recorre
0/434/869; en `1440×900`, 627/831 px y recorre 0/102/204. El último bloque
queda alcanzable con 6–7 px de margen, sin scroll anidado ni overflow
documental. Los 107 px libres de la tarjeta Sheets ancha están dentro de su
contenedor propietario y no constituyen hueco exterior. La evidencia completa
está en `tmp/visual-qa/iter51-telefonico-avance-salidas-audit/`.

### Iteración 51 — Actores recupera una jerarquía 28/72 estable

- Regresión roja: la nueva prueba encontró la colisión literal; 10 casos
  existentes pasaron y el undécimo falló porque la agrupación `auto-fit`
  todavía contenía `.mon-phone-quota-rhythm-row`.
- Reparación: se retiró solo ese selector de la regla genérica tardía. La fila
  conserva su contrato específico de escritorio
  `minmax(300px, 0.28fr) minmax(0, 1fr)` y la regla compacta posterior continúa
  apilándola en una columna. No se modificaron alturas, contenido, TSX, datos,
  cardinalidad ni ownership de scroll.
- Evidencia definitiva compacta:
  `tmp/visual-qa/iter51-telefonico-avance-actores-final/`, captura válida de
  `1024×600`. El owner mide 361/2.507 px y recorre 0/1.073/2.146; llega al
  final, sin clip ni scroll anidado. Resumen y gráfico se apilan y sus títulos
  disponen de 858 y 760 px útiles, sin truncamiento.
- Evidencia definitiva ancha:
  `tmp/visual-qa/iter51-telefonico-avance-actores-final-1440/`, `ok=true` en
  `1440×900`, cero issue, jail, error geométrico, miss, overflow o error de
  página/API/recurso/proyecto. El resumen dispone de 300 px y el gráfico de
  864 px; ambos textos completos, frente al reparto casi simétrico previo. El
  owner conserva 611/1.703 px, recorrido 0/546/1.092 y último contenido
  alcanzable a 9,75 px de su borde inferior.
- Cardinalidad y estabilidad: siguen visibles las cinco sedes y los KPI Sede
  5, Meta 400, Faltan 0 y Fechadas 423. El cambio no altera Salidas, cuyo gate
  paralelo permanece apto en ambos viewports.
- Evidencia rechazada: la celda 1440 del primer lote posterior perdió la
  sesión y mostró el selector de proyecto; produjo `waitSelectorMiss=1` y no
  cuenta. Fue sustituida por una ejecución fresca de 1440 completamente
  hidratada.
- Gates: regresión focal 11/11, suite de Monitoreo 37 archivos y 282/282
  pruebas, typecheck y `git diff --check` en verde.

La unidad queda lista para verificación independiente. Su cierre no detiene el
objetivo general; después continúa la matriz vigente de pestañas y estados de
Monitoreo.

El verificador independiente emitió `APROBADO`: confirmó el selector retirado,
el rojo 10/11, los gates 11/11 y 282/282, los owners y finales alcanzables en
ambos viewports, el reparto útil 300/864 y el apilado compacto sin
truncamiento. También ratificó que la celda 1440 fría no cuenta y que las dos
elipsis compactas de Salidas no son recorte irreversible porque su información
reaparece completa en readiness y tarjetas. Se cierra únicamente la iteración
51; el objetivo general continúa activo.

### Scope lock — iteración 52

- Módulo: `Monitoreo > Telefónico > Llamadas > Sin efectiva`, estabilidad de
  las trece tarjetas repetidas por responsable.
- Fuente de verdad: proyecto real temporal `acnur_pdm.pulso`, auditoría 10/10
  de Llamadas en
  `tmp/visual-qa/iter52-telefonico-llamadas-audit/`, con treinta capturas
  top/medio/final y `report.json` hidratado.
- Archivos previstos: `TelefonicoMonitoreoPage.tsx`, `profilePage.css`, una
  regresión focal de geometría/estructura y este registro QA.
- Exclusiones explícitas: Resumen, Tiempos, Responsables, Alertas, Modelo,
  Fuentes, Consultas, Avance, otros perfiles, topbar, sidebar, API, datos,
  persistencia, runner visual y archivos `.pulso`.
- Falla literal: las trece `.mon-phone-pending-person` dependen del número de
  casos de cada responsable. En `1024×600` miden 185,80–2.507,28 px
  (`Δ=2.321,48`); en `1440×900`, 143,80–1.332,41 px (`Δ=1.188,61`). El
  recorrido total crece a 15.681/9.093 px y convierte una colección repetida
  en un mosaico de marcos impredecibles.
- Causa: la lista completa `.mon-phone-noanswer-list` participa siempre del
  flujo exterior. Una regla tardía elimina su límite anterior para evitar
  scrolls anidados, pero deja que cada registro aumente el alto de la tarjeta.
- Cambio permitido: conservar encabezado, métricas, conteo y resumen de cada
  responsable; convertir el detalle de casos en una divulgación nativa,
  cerrada por defecto y expandible por teclado. El detalle sigue completo al
  abrirse y continúa usando el único scroll exterior; no se añade copy,
  paginación, scroll interno ni datos nuevos.
- Riesgo principal: esconder información sin affordance o romper el orden de
  tabulación. La región debe ser un `details/summary` semántico, mostrar el
  conteo aun cerrada, admitir foco/teclado y revelar todos los casos al abrir.
- Gate mínimo: regresión roja/verde, QA real de la pestaña en 1024 y 1440,
  trece marcos compactos con delta acotado, divulgación visible y operable,
  prueba de estado abierto con último caso alcanzable, un solo owner vertical,
  suite Monitoreo, typecheck y `git diff --check`.

La auditoría completa de Llamadas confirmó en las diez celdas readiness
canónico, un solo owner `#monitoreo-telefonico-panel`, `atEnd=true`, último
contenido alcanzable, cero scroll vertical anidado y cero overflow global.
`Tiempos` conserva capacidad interior válida; `Responsables` tiene solo el
scroll horizontal deliberado de su tabla; `Alertas` usa catorce marcos
estables. El alargamiento del panel izquierdo de Resumen queda diferido: una
corrección simplista con `align-items:start` rompería el requisito de marcos
adyacentes equivalentes y requiere una decisión compositiva separada.

### Iteración 52 — Sin efectiva: marco estable y detalle bajo demanda

- Regresión roja: 11/12 casos pasaron; el nuevo contrato falló únicamente
  porque el detalle todavía era una lista siempre abierta y condicional que
  participaba del alto exterior.
- Reparación estructural: las trece tarjetas conservan siempre el contenedor
  “Casos que no contestan”. Doce responsables con casos usan un
  `details/summary` nativo, cerrado por defecto; el responsable sin casos
  conserva el mismo resumen como superficie no interactiva. No se añadió copy
  ni se ocultó cardinalidad: el conteo permanece visible y los registros
  completos aparecen al abrir.
- Accesibilidad: el `summary` tiene nombre derivado del rótulo y conteo, foco
  visible y affordance gráfico. La prueba real abrió por teclado la lista
  máxima de Karina, mantuvo el foco antes/después de Enter y encontró 36/36
  casos.
- Evidencia definitiva:
  `tmp/visual-qa/iter52-telefonico-incidencia-disclosure-final/`, con reporte,
  diez capturas cerradas/abiertas y QA `APROBADO VISUAL`. En ambos viewports
  hubo readiness exacto, trece tarjetas, trece contenedores, cero indicador
  frío, error de página/consola u overflow global.
- Geometría cerrada: en `1024×600` el owner pasa de 377/15.681 a 377/3.560 px
  (−77,3 %) y las tarjetas miden 231,80–255,89 px (`Δ=24,09`). En
  `1440×900` pasa de 624/9.093 a 624/3.014 px (−66,9 %) y las tarjetas miden
  189,80–213,89 px (`Δ=24,09`). El delta residual responde a metadatos/chips
  opcionales, no a los 0–36 casos; el detalle ya no altera el marco cerrado.
- Estado abierto: la lista de 36 casos mide 2.260/2.260 px en compacto y
  1.127/1.127 px en amplio, `overflow:visible`. No aparece un owner vertical
  interno; el único scroll exterior crece y deja el último caso completamente
  alcanzable a 1,55/1,92 px de su borde inferior.
- Evidencia rechazada:
  `iter52-telefonico-incidencia-final-1024/` y
  `iter52-telefonico-incidencia-final-1440/` devolvieron `ok=true`, pero las
  imágenes mostraban “Preparando llamadas” y cero fuentes. Son falsos verdes
  de warm start y no cuentan.
- Gates: focal 12/12, suite de Monitoreo 37 archivos y 283/283 pruebas,
  typecheck y `git diff --check` en verde.

La auditoría paralela de Modelo produjo tres celdas válidas de cuatro. Cuotas
`1440×900` confirmó un P2: los cinco renglones recortan nombre, base/meta y
“% requerido”; el último campo recibe 8 px para textos de 77–88 px.
Cronograma confirmó un P3 de una métrica diaria elidida en ambos viewports.
Cuotas `1024×600` queda `BLOCKED` como deuda de evidencia: una captura fue fría
y la única repetición permitida no instaló `window.__pulsoNav`. No se infieren
defectos desde esa celda. Evidencia:
`tmp/visual-qa/iter52-telefonico-modelo-stack/`.

La unidad queda lista para verificación independiente. Su cierre no detiene el
objetivo general; la siguiente reparación priorizará el P2 demostrado de
Cuotas sin dar por cubierta la celda compacta bloqueada.

El verificador independiente emitió `APROBADO`: confirmó trece contenedores,
doce divulgaciones cerradas y una variante vacía no interactiva; apertura con
Enter y foco conservado; 36/36 casos y último registro alcanzable; reducciones
de 77,3 %/66,9 %; cero owner anidado, overflow o error; y gates 12/12 y
283/283. Rechazó expresamente los dos falsos verdes fríos. Se cierra únicamente
la iteración 52; el objetivo general continúa activo.

### Scope lock — iteración 53

- Módulo: `Monitoreo > Telefónico > Modelo > Cuotas`, lectura íntegra de las
  cinco categorías repetidas en el resumen del modelo.
- Fuente de verdad: proyecto real temporal `acnur_pdm.pulso`; baseline amplio
  válido de la iteración 52 y baseline compacto hidratado en
  `tmp/visual-qa/iter53-telefonico-modelo-cuotas-1024-baseline/`.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, datos, cardinalidad y orden de las categorías,
  editor detallado de cuotas, Cronograma, Fuentes, Llamadas, Consultas, Avance,
  otros perfiles, topbar, sidebar, API, persistencia, runner visual y archivos
  `.pulso`.
- Falla literal: los cinco marcos son iguales, pero su distribución interna
  recorta información real. A `1024×600`, dos nombres pierden 64–78 px y las
  cinco tasas “requerido” pierden 8–19 px; a `1440×900`, el último campo llega
  a disponer de solo 8 px frente a 77–88 px necesarios. No existe overflow
  horizontal del artículo porque el contenido se oculta con elipsis.
- Causa: el artículo reparte en una sola fila texto, barra y tasa mediante
  `minmax(86px, .72fr) minmax(120px, 1fr) auto`; al presentar cinco categorías
  en el ancho disponible, esos mínimos consumen el marco y hacen colapsar o
  comprimir sus extremos. El override compacto aumenta el primer mínimo, pero
  conserva la misma competencia horizontal.
- Cambio permitido: mantener las cinco tarjetas, sus dimensiones exteriores,
  tonos, datos y orden; organizar cada tarjeta en dos bandas internas —texto
  descriptivo arriba y barra/tasa debajo— para que nombre, base/meta y tasa
  dispongan del ancho útil del mismo contenedor. No se añade copy, tooltip,
  scroll, expansión ni otro elemento visual.
- Riesgo principal: aumentar de forma variable el alto según el nombre o
  alterar el número de columnas entre viewports. Los cinco marcos deben seguir
  dentro de 2 px de tolerancia, sin texto recortado, overflow documental ni
  owner vertical adicional.
- Gate mínimo: regresión CSS roja/verde; QA audit-ready en 1024 y 1440 con
  cinco categorías, medición de `clientWidth/scrollWidth`, top/medio/final y
  último contenido alcanzable; suite Monitoreo, typecheck y
  `git diff --check`.

### Iteración 53 — Cuotas legibles dentro de cinco marcos iguales

- Regresión roja: 11/12 casos pasaron; el nuevo contrato falló porque las
  categorías aún competían en una sola fila interna. Después del cambio, la
  prueba focal cierra 12/12.
- Reparación: cada tarjeta conserva su marco y pasa a dos bandas internas. La
  descripción ocupa todo el primer renglón; barra y tasa comparten el segundo.
  No se modificaron TSX, textos, datos, orden, cardinalidad, colores, owner de
  scroll ni número de columnas del tablero.
- Baseline compacto válido:
  `tmp/visual-qa/iter53-telefonico-modelo-cuotas-1024-baseline/`. Readiness real,
  cinco categorías y geometría uniforme de 41,64 px; fue rechazado por 7/15
  campos elididos: dos nombres y las cinco tasas “requerido”.
- Evidencia definitiva:
  `tmp/visual-qa/iter53-telefonico-modelo-cuotas-final/`, con seis capturas y
  `APROBADO VISUAL`. En `1024×600`, las tarjetas miden aproximadamente
  275,33×59,64 px; en `1440×900`, 246×59,64 px. En ambos anchos el delta de
  altura es 0 px y los 15/15 campos tienen `scrollWidth-clientWidth=0`.
- La distribución exterior se conserva: dos filas en compacto y una fila de
  cinco en escritorio. La capacidad junto a la quinta tarjeta editable queda
  dentro del owner visible, sin estirar la tarjeta impar ni crear hueco
  exterior.
- Ownership: un solo scroll vertical en
  `section.pulso-panel.mon-fill-panel.mon-acr-model-panel`; cero owners
  anidados y cero overflow documental. El recorrido es 0/406/812 en compacto
  y 0/152/304 en amplio; el contenido final queda alcanzable en ambos.
- Gates: focal 12/12, suite Monitoreo 37 archivos y 283/283 pruebas, typecheck,
  sincronización del agentic OS y `git diff --check` en verde.

La unidad queda lista para verificación independiente. Su cierre no detiene el
objetivo general; después continúa el P3 ya demostrado de Cronograma y la
matriz pendiente de Monitoreo.

El verificador independiente emitió `APROBADO`: confirmó la composición en dos
bandas, el baseline hidratado con 7/15 recortes, los finales hidratados con
0/15 recortes y cinco alturas idénticas de 59,64 px, los recorridos completos,
el owner único y todos los gates declarados. También ratificó que la capacidad
de la tarjeta impar queda dentro del owner y no constituye un hueco exterior.
Se cierra únicamente la iteración 53; el objetivo general continúa activo.

### Scope lock — iteración 54

- Módulo: `Monitoreo > Telefónico > Modelo > Cronograma`, lectura completa de
  la métrica diaria Kobo/teléfono/barrido.
- Fuente de verdad: proyecto real temporal `acnur_pdm.pulso` y baseline
  hidratado de ambos viewports en
  `tmp/visual-qa/iter52-telefonico-modelo-stack/manual-audit-strategias.json`.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, datos, fechas, formularios y acciones del
  cronograma, Cuotas, Fuentes, Llamadas, Consultas, Avance, otros perfiles,
  topbar, sidebar, API, persistencia, runner visual y archivos `.pulso`.
- Falla literal: una fila válida muestra
  “109 Kobo · 108 tel. efectivas · 356 barridos”, pero su celda dispone de 220
  px frente a 236 px de contenido en `1024×600` y `1440×900`; la elipsis
  oculta el final de una métrica operativa. Las demás filas y el owner son
  estables y alcanzables.
- Causa: la tercera columna de
  `.mon-field-schedule-evidence-days article` usa
  `minmax(220px, .34fr)`. En ambos anchos el algoritmo resuelve exactamente su
  mínimo de 220 px aun cuando el renglón tiene espacio global suficiente.
- Cambio permitido: reservar un mínimo suficiente para la métrica diaria,
  cediéndolo desde la barra central flexible. Conservar las tres columnas, el
  alto de 58 px, todas las filas, datos, jerarquía y el único owner vertical.
- Riesgo principal: estrechar demasiado la barra o crear overflow horizontal
  en compacto. La métrica debe quedar completa sin variar el alto de las filas
  ni producir un segundo scroll.
- Gate mínimo: regresión CSS roja/verde; QA audit-ready en 1024 y 1440 con
  medición del texto máximo, alturas repetidas, top/medio/final y alcance del
  último control; suite Monitoreo, typecheck y `git diff --check`.

### Iteración 54 — Cronograma conserva completa su métrica diaria

- Regresión roja: 12/13 casos pasaron; falló solo la nueva reserva de ancho.
  Después del cambio, la prueba focal cierra 13/13.
- Reparación: la tercera columna de cada día pasa de 220 a 240 px; los 20 px
  proceden de la barra central flexible. No se tocaron TSX, texto, datos,
  fechas, formularios, acciones ni ownership de scroll.
- Evidencia definitiva:
  `tmp/visual-qa/iter54-telefonico-modelo-cronograma-final/`, seis capturas y
  `APROBADO VISUAL`. Ambos viewports muestran nueve filas hidratadas. La
  métrica máxima pasa de 220/236 px y `clipped=true` a 240/240 px, sin
  elipsis; ninguna de las nueve métricas queda recortada.
- Estabilidad: las filas miden 59,109–59,125 px (`Δ=0,016`), muy por debajo de
  la tolerancia de 2 px. Las nueve barras conservan ancho positivo: 171 px en
  compacto y 541,22 px en amplio.
- Ownership: un solo owner
  `section.pulso-panel.mon-fill-panel.mon-acr-model-panel.is-phone-model-schedule`,
  cero owners anidados y cero overflow documental. Los recorridos permanecen
  0/515/1.030 en `1024×600` y 0/282/565 en `1440×900`; el último selector es
  alcanzable.
- Gates: focal 13/13, suite Monitoreo 37 archivos y 284/284 pruebas,
  typecheck y `git diff --check` en verde.

La unidad queda lista para verificación independiente. Su cierre no detiene el
objetivo general ni la revisión pendiente de las demás familias de Monitoreo.

El verificador independiente emitió `APROBADO`: confirmó el cambio focal de
220 a 240 px, 0/9 métricas recortadas, nueve alturas dentro de 0,016 px, nueve
barras positivas, un único owner, ambos recorridos completos y los gates
13/13 y 284/284. Se cierra únicamente la iteración 54; el objetivo general
continúa activo.

### Backlog visual confirmado antes de la iteración 55

- `Telefónico > Fuentes > Paquete`, en `1440×900`: tres tarjetas de unos 437
  px fuerzan campos de 118 px y recortan nombres/rangos hasta 227 px. En
  `1024×600` el apilado es legible. Evidencia:
  `tmp/visual-qa/iter55-telefonico-fuentes-audit/`.
- `Telefónico > Consultas > Cruces`, en `1440×900`: aparecen dos owners
  verticales en tabla y detalle por colisión de especificidad. `Plataforma`
  amplio es apto; `Subsanación` no aparece con cero salvedades; los estados
  compactos no hidrataron. Evidencia:
  `tmp/visual-qa/iter55-telefonico-consultas-audit/`.
- Estos defectos quedan preservados como siguientes unidades; no se mezclan
  con la reparación solicitada ahora para Acreditación.

### Scope lock — iteración 55

- Módulo: `Monitoreo > Acreditación > Modelo`, tarjetas repetidas de actor.
- Fuente de verdad: captura real del usuario del proyecto `ACRDCONTA.pulso`,
  estructura React de `AcreditacionMonitoreoPage.tsx` y reglas computables de
  `profilePage.css`. La sesión visual automatizada quedó rechazada: tras 180 s
  no alcanzó `data-audit-ready="monitoreo-acreditacion"`; no se usa una
  captura fría como evidencia. Bloqueo conservado en
  `tmp/visual-qa/iter55-acreditacion-modelo-actores-baseline/`.
- Archivos previstos: `profilePage.css`,
  `AcreditacionActiveSourcesLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, datos, metas, formularios, acciones, fuentes y
  mecanismos, `Teléfono`, otros perfiles, topbar, sidebar, API, persistencia,
  runner visual y archivos `.pulso`.
- Falla literal: los cuatro actores usan marcos exteriores distintos según la
  cantidad de bases, barridos y fuentes de respuesta. En la captura,
  `Egresados` y `Docentes` crecen mientras `Estudiantes` y `Administrativos`
  dejan hueco exterior debajo. El contrato actual ordena exactamente esa
  variación con `grid-auto-rows: max-content`, `align-items: start`,
  `align-self: start` y `height: auto`.
- Cambio permitido: igualar las filas implícitas de la colección, estirar cada
  tarjeta a su marco asignado y mantener la capacidad sobrante dentro de la
  tarjeta visible. Las listas internas conservan su límite y su scroll; no se
  fabrican filas ni textos para llenar el espacio.
- Riesgo principal: convertir la capacidad interior en una tarjeta
  innecesariamente alta en el apilado compacto o perder acceso a una fuente.
  La colección debe conservar un solo owner vertical exterior y las listas
  internas deben seguir alcanzando su último registro.
- Gate mínimo: regresión CSS roja/verde del contrato de filas y tarjetas;
  prueba focal; suite Monitoreo; typecheck; `git diff --check`; QA visual real
  cuando el proyecto vuelva a hidratar, con cuatro alturas dentro de 2 px y
  scroll superior/medio/inferior.

### Scope lock — iteración 56

- Módulo: `Monitoreo > Acreditación > Teléfono > Resumen`, pareja superior
  `Barra de barrido` / `Estados telefónicos`.
- Fuente de verdad: proyecto real `ACRDCONTA.pulso` hidratado en `1024×600` y
  `1440×900`; evidencia baseline en
  `tmp/visual-qa/iter55-acreditacion-telefono-resumen-baseline/`.
- Archivos previstos: `profilePage.css`,
  `AcreditacionActiveSourcesLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, datos telefónicos, estados, cuotas, botones,
  contenido colapsable, otros perfiles, topbar, sidebar, API, persistencia,
  runner visual y archivos `.pulso`.
- Falla literal: en amplio los dos paneles de la misma fila miden 171,94 y
  382,09 px (`Δ=210,15`). La regla base de `.mon-phone-overview-grid` usa
  `align-items: start`; el contrato correcto `stretch` existe sólo en el
  perfil Telefónico y no alcanza Acreditación. En compacto se apilan y no se
  exige igualdad entre filas distintas.
- Cambio permitido: estirar exclusivamente los marcos hermanos de la fila
  superior bajo `.mon-profile-canonical-shell`; el contenido del panel corto
  conserva su ritmo en la parte superior y la capacidad vacía queda dentro de
  su borde visible. No se expande el contenido ni se crea un owner adicional.
- Riesgo principal: heredar altura en el breakpoint apilado o convertir la
  barra en scroll. Deben conservarse las 11 tarjetas de estado, el owner único
  compacto y el último contenido alcanzable.
- Gate mínimo: regresión CSS roja/verde; QA real en ambos viewports con
  `Δ<=2` en amplio, apilado natural en compacto, top/medio/final, owner y
  alcance; suite Monitoreo, typecheck y `git diff --check`.

### Iteración 56 — la pareja superior de Teléfono comparte marco

- Regresión roja: la regla canónica de Acreditación no tenía contrato de
  alineación para `.mon-phone-overview-grid`; la prueba focal falló 1/9. Tras
  el override acotado, cierra 9/9.
- Reparación: el grid canónico usa `align-items: stretch`. Los paneles
  conservan `align-content: start`, por lo que sólo se iguala el borde exterior
  y no se inflan sus métricas internas.
- Evidencia definitiva:
  `tmp/visual-qa/iter56-acreditacion-telefono-resumen-final/`, seis capturas y
  `APROBADO`. En `1440×900` las dos superficies pasan de 171,94/382,09 px
  (`Δ=210,15`) a 382,09/382,09 px (`Δ=0`).
- Compacto: en `1024×600` se conserva el apilado natural 171,94/310,28 px, un
  único owner `.mon-phone-panel` (319/606, máximo 287), cero owners internos
  nuevos y alcance final.
- Integridad: 11 tarjetas de estado, cero clipping, cero overflow horizontal,
  readiness 2/2 y cero errores runtime.

### Scope lock — iteración 57

- Módulo: `Monitoreo > Acreditación > Teléfono > Resumen`, reparto vertical
  del grid amplio y superficie `Cuotas telefónicas`.
- Fuente de verdad: matriz real de Iteración 56 y baseline hidratado. En
  `1440×900`, `.mon-phone-overview-grid` ya mide 592,66 px pero su contenido
  termina 105,11 px antes: el remanente no pertenece a una superficie visible.
- Archivos previstos: `profilePage.css`,
  `AcreditacionActiveSourcesLayout.test.ts` y este registro QA.
- Exclusiones explícitas: TSX, apertura de `Ver detalle`, datos y filas de
  cuotas, estados, acciones, compacto, otros perfiles, topbar, sidebar, API,
  persistencia, runner y `.pulso`.
- Cambio permitido: sólo en ancho amplio, definir la primera fila por su alto
  intrínseco y entregar el remanente a la fila visible de Cuotas. Esa fila
  debe respetar un mínimo `max-content` para no colapsar en viewports bajos;
  sus hijos mantienen alineación superior.
- Riesgo principal: ocultar Cuotas al reducir el alto o introducir scroll
  anidado. La capacidad debe quedar dentro del borde de Cuotas, con contenido
  sin estirar y el mismo owner exterior.
- Gate mínimo: regresión CSS roja/verde; QA real `1440×900` con remanente del
  grid <=2 px y capacidad poseída por Cuotas; `1024×600` sin cambio; seis
  capturas, owner/alcance; suite Monitoreo, typecheck y `git diff --check`.

### Iteración 55 — cuatro actores, un solo alto operativo

- La primera reparación flexible fue rechazada dos veces por QA: tanto
  `minmax(0, 1fr)` como `1fr` igualaban el borde pero comprimían el contenido.
  El caso extremo fue `48,75 px` de marco frente a `301 px` de contenido en
  compacto. Esa evidencia negativa evitó aprobar una simetría puramente
  ornamental.
- Reparación definitiva: las cuatro filas usan un alto explícito de 304 px;
  las tarjetas estiran al marco y las listas internas, acotadas a 76–160 px,
  conservan su propio scroll para la cardinalidad. No se agregaron filas,
  textos ni contenido de relleno.
- Evidencia definitiva:
  `tmp/visual-qa/iter55-acreditacion-modelo-actores-final/`. En ambos
  viewports los cuatro marcos miden 304 px (`Δ=0`) y cada tarjeta tiene 302 px
  de `clientHeight` / 302 px de `scrollHeight`: déficit cero.
- Acceso: las cuatro listas alcanzan su último registro dentro de la
  intersección lista/tarjeta/panel. El owner exterior recorre 0/medio/1005 en
  compacto y 0/medio/65 en amplio; `Administrativos` queda alcanzable.
- Cardinalidades comprobadas: Egresados 6 fuentes/3 canales, Estudiantes 2/1,
  Docentes 3/2 y Administrativos 2/1. La diferencia queda dentro del
  contenedor visible, nunca como hueco exterior.

### Iteración 57 — el remanente amplio pertenece a Cuotas

- Regresión roja: no existía una regla amplia para las dos filas del overview;
  la prueba focal falló 1/10. Después del cambio, cierra 10/10.
- Reparación: desde 1181 px, el overview usa
  `auto minmax(max-content, 1fr)` y Cuotas ocupa el 100% de la segunda fila con
  `align-content: start`. `max-content` impide que el contenedor se colapse en
  pantallas bajas.
- Evidencia definitiva:
  `tmp/visual-qa/iter57-acreditacion-telefono-cuotas-final/`, seis capturas y
  `APROBADO`. En `1440×900`, el remanente exterior del overview baja de 105,11
  a 0 px; Cuotas crece de 95,8 a 200,56 px y conserva 114,77 px como capacidad
  interna visible y deliberada.
- Integridad: la pareja superior permanece 382,09/382,09 (`Δ=0`), sin owner
  efectivo o anidado en amplio. En compacto la geometría queda idéntica a la
  Iteración 56: Cuotas 95,8 px, owner único 319/606 y final alcanzable.
- Gates finales de la unidad: focal 10/10; suite Monitoreo 37 archivos y
  288/288 pruebas; typecheck y `git diff --check` en verde.

El verificador independiente emitió `APROBADO` para las Iteraciones 55–57:
ratificó 4×304 px sin recorte y alcance 4/4 en Modelo; `Δ=0` en la pareja
telefónica; remanente amplio 0 px con 114,77 px de capacidad dentro de Cuotas;
compacto sin cambios; 18 capturas sin solapes, clipping, scroll jail u overflow
horizontal; focal 10/10, Monitoreo 288/288, typecheck y diff en verde. La
discrepancia instrumental de campos opcionales entre matrices no altera la
geometría. Se cierran sólo estas tres iteraciones; el objetivo general sigue
activo.

### Scope lock — iteración 58

- Módulo: `Monitoreo > Telefónico > Fuentes > Paquete`, valores repetidos de
  las tres tarjetas Base/Barrido/Kobo.
- Fuente de verdad: auditoría real hidratada en
  `tmp/visual-qa/iter55-telefonico-fuentes-audit/`.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones: TSX, datos, enlaces, acciones, editores, pestañas Kobo y
  Base/Barrido, otros perfiles, topbar, sidebar, API, persistencia y `.pulso`.
- Falla literal: los tres marcos son iguales, pero el valor interno sigue una
  línea rígida. En `1440×900`, seis valores de las tarjetas se recortan (hasta
  227 px de déficit) dentro de celdas de 118 px; en `1024×600`, el nombre Kobo
  aún pierde 68 px. Una elipsis no es válida para nombre de fuente, rango o
  asset operativo.
- Cambio permitido: reservar el mismo alto estable en todas las celdas de
  datos del Paquete y permitir que sus valores se envuelvan por palabras o por
  identificador. La capacidad no usada queda dentro de cada celda visible.
- Riesgo: alturas variables entre las tres tarjetas o crecimiento excesivo.
  Las seis celdas por tarjeta deben compartir el mismo mínimo; las tarjetas
  deben conservar `Δ<=2`, un solo owner exterior y alcance final.
- Gate mínimo: regresión CSS roja/verde; QA real 1024/1440 top/medio/final con
  cero `strong/a` operativos recortados en las tres tarjetas, alturas estables,
  owner y alcance; suite Monitoreo, typecheck y `git diff --check`.

### Iteración 58 — Paquete muestra completos nombres, rangos e IDs

- Regresión roja: 13/14; faltaba el contrato de celda estable y valor
  multilínea. Tras la reparación, focal 14/14.
- Reparación: las 18 celdas de datos reservan un mínimo común de 54 px; sus
  valores usan `white-space: normal`, `overflow-wrap: anywhere` y ya no
  emplean elipsis. La capacidad sobrante vive dentro de la celda visible.
- Evidencia: `tmp/visual-qa/iter58-telefonico-fuentes-paquete-final/`, seis
  capturas y `APROBADO`. En compacto las tres tarjetas miden 206 px y 912 px
  de ancho (`Δ=0`); en amplio miden 238,03 px y 437,33–437,34 px
  (`Δ alto=0`, `Δ ancho=0,01`).
- Texto: 18/18 celdas cumplen el mínimo, 0 clipping X/Y y 0 valores fuera de
  su tarjeta. El wrap real aparece en 3 valores compactos y 8 amplios, entre
  2 y 4 líneas.
- Ownership: un solo `#monitoreo-fuentes-panel`, cero owners anidados, último
  control alcanzable, overflow horizontal y errores runtime en cero.
- Gates: Monitoreo 37 archivos y 289/289 pruebas, typecheck y
  `git diff --check` en verde.

El verificador independiente emitió `APROBADO`: confirmó el scope exclusivo
de Paquete, 18/18 celdas y valores completos, déficit máximo 68→0 px en
compacto y 227→0 px en amplio, tres marcos iguales, un owner por viewport,
alcance final, seis capturas sin solapes ni scroll jail y gates 14/14 y
289/289. Se cierra sólo la Iteración 58; el objetivo general continúa activo.

### Scope lock — iteración 59

- Módulo: `Monitoreo > Telefónico > Consultas > Cruces`, resumen repetido de
  alineación entre Kobo y barrido.
- Fuente de verdad: auditoría real hidratada en
  `tmp/visual-qa/iter55-telefonico-consultas-audit/` y reauditoría compacta de
  Iteración 59. La tabla y la ficha son owners verticales hermanos, no un owner
  anidado; se preservan salvo evidencia interactiva contraria.
- Archivos previstos: `telefonicoProfile.css`,
  `TelefonicoWorkbenchGeometryLayout.test.ts` y este registro QA.
- Exclusiones: TSX, datos, decisiones, filtros, tabla, ficha, Salvedades,
  Plataforma, otros perfiles, topbar, sidebar, API, persistencia y `.pulso`.
- Falla literal: la tarjeta `Tel. pendiente` recorta la explicación operativa
  `Kobo cuenta; barrido aun no declara efectiva` (220/230 px, déficit 10 px)
  mientras las cuatro tarjetas repetidas aparentan tener capacidad. La elipsis
  no es válida para explicar por qué un registro cuenta para el avance.
- Cambio permitido: reservar una altura mínima común en las cuatro tarjetas y
  permitir wrap real sólo en su línea explicativa. La capacidad no usada debe
  quedar dentro de cada tarjeta visible; no se agregan textos ni controles.
- Riesgo: variar el alto entre tarjetas, inflar la cabecera o reducir la región
  útil de tabla. Las cuatro tarjetas deben conservar `Δ<=2`, explicación
  completa, owners paralelos alcanzables y cero overflow horizontal.
- Gate mínimo: regresión CSS roja/verde; QA real 1024/1440 arriba/medio/final
  con geometría, clipping, parent chains, rueda/teclado y alcance; suite
  Monitoreo, typecheck y `git diff --check`.

### Iteración 59 — Cruces conserva marcos iguales y explicación completa

- Regresión roja: 14/15; faltaba el contrato explícito de altura común y wrap
  de la explicación. Tras la reparación, focal 15/15.
- Reparación: las cuatro tarjetas del resumen reservan 52 px, distribuyen título
  y detalle en dos filas y permiten wrap real sólo en el detalle. No se cambió
  texto, cardinalidad, tabla, ficha ni ownership.
- Primer cierre rechazado: aunque `final/` declaraba clipping cero, una regla
  compacta aplicaba `display:none` a los cuatro detalles. El verificador detectó
  el falso verde; ocultar contenido no equivale a mostrarlo sin recorte.
- Corrección del gate: la regresión pasó 15/15 sólo después de prohibir
  `display:none`. Se retiró el ocultamiento y se repitió toda la matriz.
- Evidencia definitiva:
  `tmp/visual-qa/iter59-telefonico-consultas-cruces-final2/`, seis capturas y
  `APTO` 2/2. Los cuatro detalles están presentes, visibles y completos
  (`display:block`): 139/139 px en compacto y 220/220 px en amplio, sin déficit
  horizontal o vertical. Las tarjetas empatan en alto (`Δ=0`); el ancho difiere
  0 px en 1024 y 0,016 px en 1440.
- Ownership: tabla y ficha son regiones hermanas, no owners anidados. En
  1024×600 miden 127/10.527 y 258/1.347; en 1440×900, 263/8.911 y
  423/1.259. Rueda y PageDown desplazan sólo la región enfocada; ambas llegan
  a su última fila o último dato. Se preservan ambos owners paralelos.
- Impacto de la corrección compacta: las tarjetas crecen sólo 1 px (52→53) y
  la tabla cede sólo 1 px útil (128→127); en 1440 no cambia la capacidad.
- Salvedades: en Telefónico, la ruta histórica `subsanacion` monta
  `TelefonicoCaveatsView` (`Salvedades CodPulso`), no la Subsanación de
  Acreditación. La copia real auditada tiene 0 casos bajo el predicado actual y
  redirige por diseño; no se inventaron datos. El caso positivo existente sigue
  cubierto por el fixture unitario de `TelefonicoMonitoreoPage.test.ts`.
- Gates de la unidad: Monitoreo 37 archivos y 290/290 pruebas, typecheck y
  `git diff --check` en verde. Falta únicamente repetir el dictamen
  independiente sobre `final2`; el rechazo anterior queda conservado como
  evidencia del defecto y de la mejora del gate.

El segundo dictamen independiente emitió `APROBADO`: confirmó 4/4 detalles
visibles y completos en ambos viewports, `Δ alto=0`, pérdida compacta limitada
a 1 px útil de tabla, owners hermanos con interacción aislada, extremos
alcanzables, seis capturas sin solapes y gates 15/15 y 290/290. Se cierra sólo
la Iteración 59; el objetivo general permanece activo. A partir de la siguiente
vuelta rige el goal `Monitoreo: geometría gobernada, no vigilada a mano`, con
barrido obligatorio de los cuatro modos y prioridad del carril A.
