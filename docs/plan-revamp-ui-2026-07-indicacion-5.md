# UI v3 — Indicación 5 del dueño: se conserva el top bar; el foco es uniformidad y pulido

Fecha: 2026-07-24. Origen: decisión verbal directa del dueño. Esta indicación
**revierte la decisión estructural del 2026-07-23** (sidebar de navegación
unificado) y redefine el foco del revamp. Por la regla de precedencia del
índice, manda sobre todos los documentos anteriores del contrato.

## 1. La decisión

1. **NO se migra la navegación a un sidebar lateral unificado.** El dueño
   cambió de opinión: el concepto actual del shell «está perfecto y funciona
   muy bien a nivel conceptual».
2. **El concepto canónico del shell se ratifica como está**:
   - **Top bar superior** del módulo con **las secciones** (el toolbar de
     fases/secciones que hoy existe);
   - **Sidebar de íconos (rail icon-compressed)** como hogar de **las
     pestañas** (tercer nivel).
3. **El foco del revamp cambia a dos cosas**:
   - **Uniformidad**: hoy ese top bar no es uniforme entre módulos — hay
     módulos que no lo usan o lo usan de forma diferente (cuatro lenguajes de
     sección documentados en el baseline). TODOS los módulos deben adoptar el
     mismo chrome de módulo, con las adaptaciones mínimas declaradas (no
     improvisadas).
   - **Pulido visual completo**: el top bar debe verse «más profesional, más
     macOS-like». Las buenas ideas que ya tiene se conservan y se elevan;
     lo que se corrige es la ejecución visual y la consistencia.

## 2. Qué significa en términos de los patrones de identidad

- Los patrones maestros #1 (command bar de 3 zonas), #2 (pillbar de secciones)
  y #3 (rail icon-compressed de pestañas con burbuja + título compacto) del
  ADR 0038 **vuelven a ser la columna vertebral** — la v3 los refina y los
  hace **obligatorios en los 8 módulos**, en vez de reemplazarlos.
- El ADR 0041 (shell sidebar) queda **Reemplazado** (ver ADR 0042). El código
  del shell v3 sidebar (detrás de flag `shellV3`) deja de ser el destino.
- La dirección `branding/direccion-creativa-v3.md` se re-redacta en su
  capítulo de shell: la evolución v3 sigue vigente (tokens, primitivos,
  semántica, voz, motion, economía del chrome) pero su anatomía es el
  **chrome de módulo horizontal**, no el sidebar.

## 3. Qué sobrevive del trabajo sidebar (no se pierde nada útil)

1. **La evidencia de la indicación 2 sigue siendo real** y ahora se resuelve
   DENTRO del concepto top bar: la colisión KPIs↔recorrido (~1360px), los
   chips que desaparecen a 1024×600 y el strip de módulos al límite son
   defectos del top bar actual que el pulido debe corregir con reglas de
   overflow explícitas (envolver → compactar → menú), no ocultando estado.
2. **La norma «navegar vs operar vs identidad»** (indicación 2 §4.1) queda
   vigente adaptada: top bar de secciones = navegación; banda/command surface
   del módulo = KPIs + estado + toolbar de contexto; la esquina de identidad
   (proyecto, guardado, Home) vive en el header global. Nada cruza de
   categoría.
3. **El rediseño del gestor de módulos («+»)** queda vigente: modal/overlay
   sobre la vista actual, nunca navegación que expulsa; al cerrar se vuelve
   exactamente a donde se estaba; el dock del carrusel muestra los 8+ módulos
   completos.
4. **Fundaciones de la Fase 0** intactas: tokens (`--space-*`, tipografía,
   `--z-*`), `PulsoButton`, `PulsoDialog`/`PulsoPopover`, empty
   state/spinner únicos, manifiesto de navegación total, semántica de links
   con `aria-current` (cero `role="tab"` sobre rutas), quick fixes de la
   Oleada 0.
5. **Indicaciones 3 y 4** (workbench robusto, mapa como superficie primaria,
   Lima en vertical): siguen vigentes en todo lo que gobierna la composición
   del canvas/mapa. Sus referencias al «rail del sidebar» se reinterpretan
   al rail de pestañas icon-compressed ya canónico.
6. **El manifiesto y `moduleNavigationRuntime`**: la fuente única de
   módulos/secciones/pestañas sirve igual al top bar; el trabajo de
   manifiesto no se descarta.

## 4. Disposición del código sidebar ya escrito

`AppSidebar.tsx`, `sidebar-v3.css` y la integración `shellV3` en `Layout.tsx`
existen detrás de flag de dev (no son default). Decisión pendiente del dueño
(borrado = doble confirmación, regla de la casa):

- **Recomendación**: retirarlos en una oleada de limpieza una vez que el
  chrome uniforme esté en marcha, para no mantener dos shells. Hasta entonces
  el flag no se promociona ni se documenta como feature.
- El trabajo v3 de Hojas de ruta (cartográfico, navegación propia) se evalúa
  pieza por pieza: lo que implementa indicaciones 3/4 (composición del mapa)
  se conserva; lo que asume sidebar lateral se re-apunta al chrome canónico.

## 5. El programa de uniformidad (qué debe pasar módulo por módulo)

Estado actual del chrome por módulo (baseline 2026-07-23) y destino:

| Módulo | Chrome hoy | Destino |
| --- | --- | --- |
| Procesamiento | Pills numeradas verdes (ProcessingPhaseDock) — el ejemplar del concepto | Command bar canónica; es la referencia a elevar |
| Monitoreo | Pills rojas + toolbar operativa densa mezcladas | Command bar canónica: secciones en el rail, operación en la command surface (respira) |
| Bitácora | Pills centradas sin número (`?tab=`) | Command bar canónica (secciones sin número: no hay pipeline) |
| Dashboard | Toolbar de texto plano, lenguaje propio | Command bar canónica + tabs configurables como secciones |
| Calc-muestra | Mesas (`?mesa=`) + steppers ad-hoc | Command bar canónica: mesa como contexto, pasos como secciones con progreso real |
| Hojas de ruta | Stepper propio en banda con KPIs (colisiona) | Command bar canónica + command surface separada (fix de la colisión) |
| Fichas QR | Secciones + subtabs con sistema propio | Command bar canónica |
| Editor XLSForm | Toolbar de 2 filas, jerarquía plana | Command bar canónica con jerarquía de acciones |
| Enciclopedia | Sin chrome de módulo (legacy) | Según su ADR-lite de hogar |

Reglas del programa:

1. **Un solo componente**: `ModuleCommandBar` compartido (3 zonas: contexto |
   secciones | acciones) + `SectionPillbar` + rail de pestañas canónico.
   Ningún módulo re-implementa el suyo.
2. **Adaptaciones solo declaradas**: si un módulo necesita variar (densidad,
   sin números, con progreso), lo declara en el manifiesto; nada ad-hoc en el
   page-file.
3. **Overflow con dignidad**: la command bar define su degradación (envolver
   controles → compactar labels → overflow a menú) y se verifica a 1024×600;
   los chips de estado nunca desaparecen sin alternativa.
4. **Pulido macOS-like**: material contenido según identidad (translúcido solo
   en la capa de navegación), alturas/radios/tipografía por token, acento del
   módulo por variable, foco visible, animaciones Física Pulso.
5. **El gate visual es por módulo**: cada módulo migrado pasa QA visual
   before/after en la matriz de viewports antes de declarar su chrome
   uniforme.

## 6. Efecto sobre el orden de migración

El orden de la indicación 2 §5 (pensado para el sidebar) se reemplaza:

1. **`ModuleCommandBar` + manifiesto** (sin mover módulos), con Procesamiento
   como referencia viva.
2. **Hojas de ruta** (la banda más rota: colisión demostrada) — resuelve
   clase A con la separación navegar/operar.
3. **Monitoreo** (descarga su toolbar densa).
4. **Bitácora, Dashboard, Fichas QR, Calc-muestra** (adopción).
5. **Editor XLSForm y Enciclopedia** al final.
6. Gestor de módulos («+») como modal: puede ir en paralelo desde el paso 1.

El loop del plan (§12) no cambia: cada paso cierra con auditar → ejecutar →
verificar → evidencia al dueño; solo el dueño declara el cierre.
