# GOAL — Cálculo de muestra: el selector decide con evidencia, no con etiquetas

Tipo: Goal operativo de producto + QA
Estado: En curso
Fecha de apertura: 2026-07-31
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado del módulo

**Estado:** loop permanente en curso. **Solo Gonzalo lo cierra.** Ninguna
iteración lo termina; cada iteración lo deja más cerca.
**Antecedentes:** `docs/calc-muestra-recorrido-spec.md` (recorrido IA trazable),
overhaul según sistematización de Ramiro (memorias 2026-07-16/17: Carril 1
cerrado, Carril 2 —embudo por facultad— en curso), hallazgos N9 y N10 del
goal-loop visual (`goal-loop-visual-app-2026-07-30.md`). Este goal **absorbe el
Carril 2** y lo extiende: no es solo terminar el embudo, es convertir el módulo
en un instrumento de decisión.

## Objetivo

> El desk universitario de Cálculo de muestra (modo `opinion-universitaria`,
> secciones Datos → Marco → Cálculo → Aulas → Salidas) debe permitir que el
> académico **pondere cada decisión con evidencia estadística a la vista**:
> cada criterio de inclusión muestra su distribución, sus cuantiles, su media y
> su impacto por facultad **antes** de que el usuario lo active; el selector de
> cursos-horario se ve y se navega como el mejor cuarto del módulo; y toda
> cifra graficada tiene un dueño único y validado.
>
> Regla madre del loop: **primero el dato, después el gráfico, después el
> brillo.** Nunca se decora una cifra que no está reconciliada.

## Los cuatro mandatos (indicación de Gonzalo, 2026-07-31)

1. **Secciones 1–3 (Datos, Marco, Cálculo): de "bastante bien" a instrumento.**
   Ajuste visual + mejoras de implementación, y sobre todo **mucha más
   información precisa**: el selector de criterios debe dar, por criterio y por
   facultad, la cantidad de alumnos por curso-horario en cuantiles, media,
   mediana, promedio de alumnos por CH, boxplots y distribuciones. Hoy solo un
   par de criterios finales tiene gráficos; la meta es que **elegir un criterio
   sea leer su radiografía**. Antes de graficar: validar que los datos sean
   correctos (ver F0).
2. **Sección Aulas (selector de cursos-horario): revamp visual profundo** y un
   sistema de pestañas mejor que el actual.
3. **Revisión conceptual del orden**: dónde vive cada pestaña y en qué orden;
   corregir todo hogar u orden que no sea metodológicamente válido.
4. **Libertad creativa gobernada**: agregar funcionalidades y visualizaciones
   nuevas que ayuden a ponderar la decisión, siempre dentro del contrato del
   repo (cinco dimensiones de navegación, tokens, Contrato de Superficie).

## Estado medido de apertura (2026-07-31)

| Hecho medido | Consecuencia |
|---|---|
| El selector de criterios (13 archivos en `universidad/criterios/` + `CursosHorarioMarcoTab.tsx`) tiene **un solo gráfico estadístico**: `BoxplotElegibles.tsx`, y solo dentro de `FacultadRadiografiaCard.tsx` | Los criterios se activan a ciegas; la radiografía existe para la facultad, no para el criterio |
| Cuantiles, mediana y promedio de alumnos por CH **no se publican** en el selector; el backend ya tiene motores de exploración (`calc_muestra_aulas_exploracion.R`, `_catalogo.R`, `_criterios.R`, `_perfil.R`) | La información existe o es calculable en el engine; falta el contrato que la exponga por criterio × facultad |
| **N9 abierto**: dos instantáneas de «CH elegibles» conviven en Marco y no coinciden (`frameProfile.marco_aulas` = 2.265 vs `totales.ch_elegibles` = 2.373 en `hsvg2026`) | Exactamente el riesgo del mandato 1: graficar sobre esa base publicaría la contradicción con más brillo |
| Sección Aulas: 7 pestañas (Marco, Objetivo, Método, Laboratorio, Selección, Reemplazos, Auditoría) con `aulasParts.tsx` en **1.612 líneas** | El revamp visual no puede pagarse engordando el monolito de partes |
| La tabla `UNIVERSITY_LOCAL_TAB_ALIASES` acumula **12 alias** de pestañas movidas o fusionadas | El orden conceptual ya se reescribió varias veces; este loop lo cierra con criterio metodológico explícito, no con otra mudanza ad hoc |
| Carril 2 del rediseño «todo por facultad» quedó **en curso** (embudo por facultad, domar 52 categorías) | Trabajo heredado que este goal absorbe como parte de F1 |
| Proyecto de referencia a escala: `hsvg2026` (marco de aulas real anonimizado) | Toda medición y todo QA visual se hace ahí, no con demos sintéticos chicos |

## Invariante

**Ninguna iteración publica un número nuevo sin dueño validado, y ninguna
iteración deja `aulasParts.tsx` (ni ningún archivo del módulo) más grande que
como lo encontró cuando el trabajo era extraíble.** Cada iteración deja al
menos una fila del ledger estrictamente mejor; igualar no cierra la iteración.

## Frentes

El loop rota por cinco frentes. F0 es transversal y gatea a los demás: si al
auditar aparece una cifra sin reconciliar en la superficie que se va a tocar,
F0 se atiende primero en esa misma visita.

### F0 — Verdad del dato (gate transversal)

Toda cifra que el selector muestre o vaya a mostrar tiene **un** origen
declarado (marco ejecutado o exploración, nunca ambos sin rótulo), y los
estadísticos nuevos (cuantiles, media, mediana, promedio de alumnos por CH) se
calculan **en el engine R con test** — el frontend no promedia, formatea.
Arranca con N9: decidir cuál instantánea manda o rotular ambas con su momento.
El revisor metodológico valida denominadores y grano (¿promedio sobre CH
elegibles o ejecutados? ¿alumnos únicos o matrículas?) antes de que el gráfico
exista.

### F1 — El selector de criterios como consola analítica (Datos · Marco · Cálculo)

La evolución del mandato 1. Dirección de diseño:

- **Cada criterio con su radiografía.** Al enfocar un criterio (antes de
  activarlo): distribución de alumnos por CH bajo ese criterio, cuantiles
  (p10/p25/p50/p75/p90), media, N de CH y de alumnos, y **delta contra el
  estado actual** (qué agrega o quita activarlo). El patrón visual de
  `BoxplotElegibles` se generaliza; deja de ser un caso único.
- **Impacto por facultad, no solo global.** Small multiples o strip por
  facultad para ver dónde muerde el criterio; es la información que hoy falta
  para «ajustar esos valores por facultad».
- **El embudo del marco** (Carril 2): de N bruto a elegibles, criterio por
  criterio, con las 52 categorías domadas — el usuario ve el orden en que los
  criterios recortan y cuánto recorta cada uno.
- Pulido visual de Datos y Cálculo con la misma vara: la fórmula y las
  propuestas ya existen; ganan densidad informativa (bandas de precisión,
  sensibilidad de parámetros) sin ganar ruido.

### F2 — El selector de cursos-horario (sección Aulas)

Revamp visual completo de las 7 pestañas + un sistema de pestañas a la altura
del estándar de rail del repo (el sidebar de Procesamiento es el canon). El
inspector de aula (`AulaInspectorPanel`) y la cadena (`CadenaAulas`) entran al
mismo pulido. Peaje estructural: lo que se toque de `aulasParts.tsx` sale a
archivo propio.

### F3 — Orden conceptual de pestañas

Auditoría única + correcciones incrementales. La vara es el orden metodológico
que ya gobierna Marco (reunión 2026-07-15): **quién es elegible → dónde están
→ cuántos necesito → cuáles elijo → qué entrego.** Toda pestaña cuya posición
u hogar contradiga esa cadena se reubica **una vez**, con su alias en
`UNIVERSITY_LOCAL_TAB_ALIASES` y su porqué escrito. Ninguna mudanza sin
justificación metodológica citable.

### F4 — Creatividad gobernada

Funcionalidades nuevas bienvenidas (simulador de «qué pasa si», comparador de
escenarios de criterios, export de la radiografía) con tres condiciones: se
cuelgan de una de las cinco dimensiones de navegación (nunca navegación
paralela), declaran su Contrato de Superficie al construirse, y sus números
pasan por F0. Regla de la casa: no sobreexplicar — el hueco es para el dato.

## Mecánica de cada iteración

Una iteración = una visita a un frente, orquestada según la rama que toque:

1. **Auditar (medido, no leído).** `/ver-ui` con `hsvg2026` sobre la dirección
   canónica (`/calc-muestra?modo=opinion-universitaria&seccion=…&pestana=…`),
   matriz de viewports, `ui-quick-check` con `--require-geometry`. Los
   hallazgos se anotan con `archivo:línea`. Auditar produce combustible;
   reparar lo consume — por eso el loop nunca se queda sin trabajo.
2. **Clasificar y orquestar.**
   - Visual puro → Rama 2: `/revamp-visual` + `govern-visual-harmony` congelan
     dirección; `qa-visual-desktop` toma baseline; `frontend-react` implementa;
     QA independiente + `guardian-contratos` revisan.
   - Estadísticos o datos nuevos → Rama 1 con `/scope-lock`: contrato del
     payload congelado primero; `backend-r` (engine + test testthat) y
     `frontend-react` (normalizador defensivo + render) en paralelo;
     `revisor-metodologico` valida grano y denominadores;
     `dominio-prosecnur`/`/nucleo-metodologico` cargados si cambia lógica de
     encuesta.
   - Máximo tres trabajadores, dos writers, globs sin solape; el lead
     sintetiza, no concatena.
3. **Pagar el peaje estructural.** Componente nuevo en archivo nuevo; lo tocado
   de un archivo grande se extrae primero.
4. **Dejar guard.** `data-qa-geometry-group`, tokens, test de contrato del
   payload — la violación futura debe fallar sola.
5. **Gate escalado al diff** (typecheck + vitest del feature + testthat de los
   `test-calc_muestra*` afectados + chequeo visual) → **`verificador`** →
   commit atómico en español.
6. **Registrar**: ledger actualizado y fila en el registro de iteraciones.
   **El estado vive en este doc, no en la conversación.**

## Regla de no-bloqueo

**El loop nunca se detiene esperando una decisión.** Si un hallazgo exige
criterio de dominio (p. ej. qué instantánea manda en N9, o el denominador del
promedio), se anota en la bandeja con opciones y recomendación, y el loop pasa
al siguiente hallazgo o frente. Máximo una decisión nueva presentada por
iteración; si la bandeja pasa de tres, se presentan juntas y se sigue
trabajando en lo desbloqueado.

## Ledger

| Métrica | Apertura (31 jul) | Hoy | Dirección |
|---|---:|---:|---|
| Cifras de CH sin dueño reconciliado en pantalla (N9) | 1 | 0; toda radiografía publicable cuadra con `aula_frame.included` y las discrepancias fallan cerrado | = 0 |
| Componentes de criterio con radiografía estadística propia | 1 (`BoxplotElegibles` vía `FacultadRadiografiaCard`) | 0 completas según la meta F1; 1 robusta parcial (`session_type`); 4 superficies con evidencia contextual | ↑ hasta cubrir el selector |
| Estadísticos por criterio × facultad expuestos por el engine (cuantiles, media, mediana, promedio alumnos/CH) | 0 contratos | 0 contratos completos; 1 parcial probado para `session_type × facultad` (p25/p50/p75, media, min/max; faltan p10/p90 y delta) | ↑ con test por estadístico |
| Criterios con impacto marginal (delta activar/desactivar) visible | 0 | 0 | ↑ |
| Embudo por facultad (Carril 2) | en curso, sin cerrar | en curso; no cerrado | cerrar |
| Pestañas de Aulas repasadas por el revamp F2 | 0 de 7 | 0 de 7 | ↑ a 7 |
| `aulasParts.tsx` | 1.612 | 1.612 | ↓ |
| Pestañas con hogar/orden justificado por la cadena metodológica (F3) | por auditar en iteración 0 | 21 de 24 (87,5 %); 24 de 24 auditadas | 100 % |
| Alias muertos que ya nadie escribe y pueden documentarse como históricos | 12 | 12 | = (no crecen sin porqué) |
| Declaraciones `data-qa-geometry-group` en el desk universitario | por medir en iteración 0 | 7 locales en fuente; 6 grupos renderizados por viewport de Marco, 0 misses y 0 issues | ↑ con cobertura conforme |
| Hallazgos abiertos del loop | 1 (N9 heredado) | 3 confirmados + 2 observaciones por confirmar; N9, I0-H1, I0-H3, I0-H6, I2-H7 e I3-H8 cerrados | ↓ |

La **iteración 0** completa las celdas «por medir» con el instrumento, no a
ojo, y toma el baseline visual de las cinco secciones con `qa-visual-desktop`.

## Cola medida de hallazgos

| ID | Frente | Hallazgo | Estado / evidencia |
|---|---|---|---|
| N9 | F0 | Marco publica dos instantáneas no reconciliadas de CH elegibles (2.265 y 2.373 en `hsvg2026`) | **resuelto I1**: owner, perfil, audit y exploración del fixture vigente cuadran en 2.373; un payload legacy contradictorio queda en S/D + reconstrucción; D1 sigue abierta |
| I0-H1 | F1 / guard | Marco incumple C1: `cmv2-uni-cifra` y tres listas `cmv2-crit-item` no declaran contrato geométrico | **cerrado I1**: 30 grupos medidos en cinco viewports, 0 misses y 0 issues |
| I0-H2 | F1 / visual | Etiquetas de criterios se parten dentro de la palabra en 1366×768 | confirmado; breakpoint mantiene cinco columnas y `overflow-wrap:anywhere` |
| I0-H3 | F3 | `def-consistencia` vive en Datos aunque el contrato la ubica al final de Marco | **cerrado I2**: Datos queda con 3 pestañas y Marco con 6; Consistencia tiene un único hogar, el sexto de Marco |
| I0-H4 | F3 | Selección conserva «Marco de cursos-horario», duplicado que la spec manda retirar | confirmado; `calcMuestra.ts:107` y spec líneas 87-98 |
| I0-H5 | F3 | Entrega ordena Entregables antes de Tablas | confirmado; afecta dos pestañas del denominador F3 |
| I0-H6 | F3 / navegación | El alias cross-section `marco-validacion → def-consistencia` cae en la primera pestaña de Marco | **cerrado I2**: alias y URL publicada anterior canonicalizan con `replace` a `marco/def-consistencia`; 3/3 visitas reales |
| I2-H7 | F3 / guard metodológico | Consistencia puede publicar «Listo» con dos bases aunque `relation_audit.status` sea `revisar` o `critico` | **cerrado I3**: sidebar y panel comparten una decisión fail-closed; dos bases solo acreditan `used===true/status=ok` sin incidencias |
| I3-H8 | F3 / C5 | El gauge conserva umbrales React 70 %/90 % y una zona «sólido» ajenos al `status` de R | **cerrado I3**: barra puramente descriptiva, tono del audit y regresión que prohíbe ticks, escala y zonas semánticas locales |
| I0-O1 | F2 / navegación | Marco y Aulas pueden conservar scroll inicial al navegar por `--ir` en 1710×1107 | por confirmar; no suma FAIL en iteración 0 |
| I0-O2 | F2 / C3 | Aulas y Salidas dejan capacidad exterior amplia en escritorio grande | por medir con rectángulos; no suma FAIL en iteración 0 |

## Bandeja de decisiones (solo Gonzalo)

| # | Decisión | Opciones | Recomendación | Estado |
|---|---|---|---|---|
| D1 | N9: ¿qué instantánea de «CH elegibles» manda en Marco? | (a) manda el marco ejecutado y la exploración se rotula «exploración previa»; (b) manda la exploración; (c) ambas visibles con rótulo de momento | (a): el marco ejecutado es el que produce la muestra; la exploración es borrador | abierta |
| D2 | Denominador del promedio de alumnos por CH en la radiografía | (a) CH elegibles bajo los criterios activos; (b) todos los CH del marco; (c) ambos, elegibles como cifra principal | (c): el contraste elegible/total es información de ponderación | abierta |

## Registro de iteraciones

| # | Fecha | Frente | Qué se hizo | Evidencia | Ledger movido |
|---|---|---|---|---|---|
| 0 | 2026-07-31 | F0–F4 · baseline | Se midieron estructura, contratos parciales, orden de las 24 pestañas y las cinco secciones reales de `hsvg2026`; no se tocó producto | `wc`/`rg` con `archivo:línea`; revisión metodológica 24/24; `ui-quick-check --require-geometry` 25/25 en `/private/tmp/prosecnur-visual-iter0` (PASS 20, FAIL 5 por C1 en Marco, demás contadores duros en 0) | F3: por auditar → 20/24 justificadas; geometría: por medir → 4 locales; contratos: se reconoció 1 parcial probado; hallazgos: 1 → 7 + 2 observaciones |
| 1 | 2026-08-01 | F0/N9 + I0-H1 | Se congeló `aula_frame.included` como owner del conteo ejecutado; perfil, audit y exploración se validan como proyecciones; los cuatro consumidores fallan cerrado en mismatch/ausencia, conservan reconstrucción y rotulan `elegibles_total` como matrículas; se retiró el promedio React sin denominador decidido y se declaró C1 en cifras/listas | test R 191/191; Vitest afectado 29/29 y suite completa 2.797/2.797; typecheck y diff-check 0; contrato compatible y revisión metodológica aprobada; matriz final `/private/tmp/prosecnur-visual-iter1-final-r3/marco/report.json` 5/5 PASS, 30 grupos, 0 misses/issues/errores | N9: 1 → 0 cifras sin dueño; geometría Marco: 20 → 0 misses; hallazgos abiertos: 7 + 2 → 5 + 2, con N9 e I0-H1 cerrados |
| 2 | 2026-08-01 | F3/I0-H3 + I0-H6 | Se devolvió `def-consistencia` al final de Marco en catálogo, sidebar, render y bóveda; la URL antes publicada y el alias histórico se leen como parejas explícitas y se reemplazan por `marco/def-consistencia`, sin inferir sección desde un tab suelto | regresión 10 rojas/20 verdes → 30/30; suite 2.805/2.805 y typecheck verdes; bóveda sin V1/V3; contrato aprobado y método aprobado con I2-H7 separado; `/private/tmp/prosecnur-visual-iter2-final/runtime-probe/report.json` 3/3 PASS, 3 grupos, 0 misses/issues/errores/scroll/overflow | F3: 20/24 → 21/24; H3 y H6 cerrados; hallazgos 5 + 2 → 4 + 2 al incorporar H7 |
| 3 | 2026-08-01 | F3/guard I2-H7 + C5/I3-H8 | Se tipó el audit existente y se congeló una decisión compartida por sidebar/panel: sin frame `pending`, dos bases solo `ready` con `used===true/status=ok` sin incidencias y toda contradicción falla cerrada; el panel dirige a Datos → Marco → Diseño, la bóveda replica el contrato y el gauge quedó descriptivo, sin umbrales React | regresión principal 31 rojas/29 verdes → 60/60; guard C5 1 roja/17 verdes → 23/23; suite 2.839/2.839, typecheck, 118/118 R, bóveda y diff-check verdes; método y contrato aprobados; `/private/tmp/prosecnur-visual-iter3-final-delta/runtime-probe/report.json` 2/2 PASS, 2 grupos y todos los contadores duros en 0 | I2-H7 e I3-H8 cerrados; hallazgos abiertos 4 + 2 → 3 + 2; F3 se mantiene 21/24 porque el guard no mueve pestañas |

### Contrato de iteración 0

- **Fallo o cuello:** el ledger no tenía denominadores para F3/geometría ni
  baseline visual comparable de las cinco secciones.
- **Cambio enfocado:** medición de solo lectura y registro del estado; ningún
  componente React, engine R, fixture `.pulso` ni contrato de persistencia fue
  modificado.
- **Archivo cambiado:** `docs/qa/goal-loop-calc-muestra-2026-07-31.md`.
- **Validación:** matriz `hsvg2026` en 1710×1107, 1440×1000, 1366×768,
  1280×720 y 1024×600; 25/25 direcciones listas, `visualIssues=0`,
  `geometryIssues=0`, `scrollJails=0`, `globalOverflow=0`, errores de
  página/consola/API/recursos/proyecto/readiness = 0; `geometryCoverageMisses=20`
  concentrados en Marco. Auditoría metodológica: 24/24 cubiertas, 20
  justificadas, 4 divergentes.
- **Resultado:** mejor. Las dos celdas «por medir» tienen denominador y la cola
  separa defectos confirmados de observaciones aún no promovidas.
- **Siguiente acción:** iteración 1, F0/N9 — trazar la primera divergencia entre
  marco ejecutado y exploración previa, congelar el dueño/momento de cada cifra
  en el payload y dejar un guard que impida mezclarlas sin resolver D1 por
  sustitución. Si la visita toca Marco, paga I0-H1 en la misma iteración.

**Siguiente iteración programada:** **4 — F3/I0-H5, Tablas antes de
Entregables en Salida**. Es el hallazgo conceptual abierto de mayor radio:
afecta dos posiciones del denominador F3 y contradice la cadena citable
Cierre → Tablas → Entregables → Pase a Monitoreo. Se medirá primero la
dirección canónica y la compatibilidad de tabs guardados; después se alinearán
catálogo, sidebar, render y bóveda sin renombrar ids. D1 y D2 permanecen
abiertas; no se añadió una decisión nueva.

### Contrato de iteración 1 (scope lock cerrado)

- **Categoría / fuente de verdad:** F0/N9. `aula_frame.included` es el dueño
  del conteo del marco ejecutado; `perfil.marco_aulas`,
  `audit[classroom_included_n]` y `exploracion.totales.ch_elegibles` son
  proyecciones del mismo frame y momento. I0-H1 se paga como guard estructural
  porque la visita toca Marco.
- **Módulos afectados:** integridad legacy R→React, consumidores de la
  radiografía de Marco, resumen persistente, contratos geométricos C1 y sus
  regresiones focales.
- **Archivos previstos:**
  `api/tests/testthat/test-calc-muestra-aulas-exploracion.R`;
  `frontend/src/features/calcMuestra/motor/ResumenDiseno.tsx`;
  `frontend/src/features/calcMuestra/universidad/shared/frameIntegrity.ts`;
  `frontend/src/features/calcMuestra/universidad/criterios/CriteriosMarcoTab.tsx`;
  `frontend/src/features/calcMuestra/universidad/criterios/controles.tsx`;
  `frontend/src/features/calcMuestra/universidad/ui/CifraMotor.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/CursosHorarioMarcoTab.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/ExploradorAulasTab.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/FacultadDecisionBloque.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/FacultadRadiografiaCard.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/__tests__/CursosHorarioMarcoTab.test.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/__tests__/ExploradorAulasTab.test.tsx`;
  y las regresiones nuevas
  `CriteriosMarcoConsistency.test.tsx` y
  `CriteriosGeometry.contract.test.ts` bajo `criterios/__tests__/`.
- **Exclusiones explícitas:** `api/R/**`, routers, schemas y forma del payload,
  persistencia o migraciones `.pulso`, navegación, `aulasParts.tsx`, otros
  frentes F1–F4 y el prompt de arranque no versionado.
- **Riesgo principal:** acreditar como vigente una radiografía incoherente o
  degradar un frame legacy por su representación columnar/singleton; en C1,
  declarar capacidad en un contenedor equivocado para ocultar un hueco real.
- **Validación mínima:** regresiones Vitest focales + `typecheck`; test R de
  exploración; `ui-quick-check --require-geometry` en los cinco viewports de
  Marco; revisión metodológica y de contrato; `verificador` serial.
- **Fallo o cuello:** un payload contradictorio podía publicar como vigentes
  dos conteos de CH; además cuatro colecciones visibles de Marco no declaraban
  C1 y producían 20 misses en la matriz.
- **Cambio enfocado:** guard de integridad y rotulado sobre el contrato
  existente, más instrumentación C1. No se eligió una cifra histórica, no se
  añadió estadístico y no cambió el engine ni el payload.
- **Resultado:** mejor. El frame vigente coherente conserva su radiografía; un
  frame contradictorio o no verificable muestra S/D y reconstrucción. N9 e
  I0-H1 quedan cerrados con regresión y evidencia visual comparable.
- **Validación ejecutada:** 191/191 R; 2.797/2.797 frontend; typecheck y
  diff-check verdes; revisiones contractual y metodológica aprobadas; r3 5/5
  PASS con 30 grupos, 0 misses/issues y todos los contadores duros en cero.
- **Siguiente acción:** iteración 2, F3/I0-H6 — diagnosticar por qué el alias
  cross-section resuelve el id pero conserva la sección equivocada, fijar una
  regresión de dirección y reparar la primera divergencia sin bundlear las
  demás mudanzas conceptuales.

### Contrato de iteración 2 (scope lock cerrado)

- **Categoría / fuente de verdad:** F3/I0-H3 + I0-H6. La spec vigente
  `docs/calc-muestra-recorrido-spec.md:51-69` fija Datos como Estudio → Fuentes
  → Variables y Marco como Criterios → Radiografía → Población →
  Cursos-horario → Cobertura → Consistencia. ADR 0044 exige que la dirección
  canónica conserve juntos sección y pestaña.
- **Primera divergencia medida:** `UNIVERSITY_LOCAL_TAB_ALIASES` traduce
  `marco-validacion` a `def-consistencia`, pero no puede traducir su sección;
  después `CalcMuestraPage` descarta esa pareja inválida y cae en la primera
  pestaña de Marco. El parser global y `useSeccion` son coherentes con su
  contrato. I0-H3 e I0-H6 son por ello una sola reparación causal: no se puede
  corregir el alias sin devolver Consistencia al hogar que manda la spec.
- **Módulos afectados:** catálogo canónico del desk universitario, sidebar y
  render de Consistencia, compatibilidad de direcciones históricas y sus
  regresiones focales.
- **Archivos previstos:**
  `frontend/src/lib/navegacion/catalogos/calcMuestra.ts`;
  `frontend/src/lib/navegacion/catalogos/catalogos.test.ts`;
  `frontend/src/features/calcMuestra/navegacion.ts`;
  `frontend/src/features/calcMuestra/navegacion.test.ts`;
  `frontend/src/features/calcMuestra/universidad/universidadTabs.ts`;
  `frontend/src/features/calcMuestra/universidad/UniversidadDesk.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/MarcoConsistenciaTab.tsx`
  (solo corregir el comentario de identidad del id público);
  `frontend/src/features/calcMuestra/universidad/marco/__tests__/marcoConsistencia.test.tsx`;
  la dirección generada `docs/sistema/direcciones/calc-muestra.md`; las notas
  de bóveda `Datos.md`, `Fuentes para la muestra universitaria.md`,
  `Variables universitarias.md`, `Marco.md`, `Cobertura universitaria.md` y
  `Consistencia de fuentes.md` y `Diseño universitario.md` bajo el modo
  universitario (incluidas las
  mudanzas ordinales `Variables 04→03` y `Consistencia Datos/03→Marco/06`); y
  este ledger.
- **Exclusiones explícitas:** parser y hook globales de dirección, manifiesto
  de módulos fuera del catálogo compartido, API/R, schemas, persistencia o
  migraciones `.pulso`, CSS y copy del panel, `aulasParts.tsx`, F0–F2, F4,
  I0-H2/H4/H5/O1/O2 y el prompt de arranque no versionado.
- **Cambio enfocado:** mover el id público `def-consistencia` al final de
  Marco; mantenerlo sin renombrar; leer y normalizar con `replace` solo las dos
  parejas históricas aprobadas (`definicion/def-consistencia` y
  `marco/marco-validacion`) hacia `marco/def-consistencia`, preservando modo,
  proyecto y parámetros ajenos. No se impondrá una regla genérica de
  precedencia de pestaña sobre sección ni se inventarán aliases adicionales.
- **Riesgo principal:** romper un deep-link publicado, producir un bucle de
  normalización o teletransportar una pareja desconocida a otra sección.
- **Baseline disponible:** 22/22 pruebas focales verdes en el estado defectuoso;
  reproducción `hsvg2026` 1440×1000 en
  `/private/tmp/prosecnur-visual-iter2-baseline`: las parejas
  `marco/marco-validacion` y `marco/def-consistencia` renderizan por error
  Criterios del estudiante, mientras `definicion/def-consistencia` sí muestra
  Consistencia; 0 errores, overflow, scroll o fallos geométricos.
- **Validación mínima:** regresión roja de catálogo, hogar de render y matriz
  explícita de direcciones; Vitest focal + suite frontend completa +
  `typecheck`; `vaults-check --generar` y `--check`; visita `hsvg2026` por las
  tres direcciones con `--require-geometry`; revisiones contractual y
  metodológica; `verificador` serial.
- **Ampliación medida del peaje estructural:** al regenerar la dirección,
  `vaults-check --check` detectó V1 para la nota aún anclada en
  `definicion/def-consistencia` y V3 para el nuevo nodo
  `marco/def-consistencia`. La mudanza de esa nota y la actualización de sus
  dos índices padre, vecinos anterior/siguiente y ordinal de Variables forman
  parte del mismo contrato documental; no amplían la lógica de producto.
- **Fallo o cuello:** el alias histórico solo traducía el id y conservaba la
  sección, por lo que Marco descartaba `def-consistencia` y caía en Criterios.
  A la vez, el catálogo había congelado en Datos un hogar contrario a la spec.
- **Cambio enfocado:** catálogo, estado y render trasladan el mismo panel sin
  cambiar su cálculo; un resolver local de parejas reconoce exclusivamente las
  dos direcciones históricas aprobadas y el efecto de publicación hace un solo
  `replace`. La bóveda replica la misma cadena y conserva los ids públicos.
- **Resultado:** mejor. Datos lista Estudio → Fuentes → Variables; Marco termina
  en Consistencia. Las entradas canónica, publicada anterior y legacy terminan
  en la misma URL y panel, sin fallback ni teletransporte de combinaciones no
  publicadas. I0-H3 e I0-H6 quedan cerrados.
- **Validación ejecutada:** rojo causal 10/30 y verde focal 30/30; suite
  frontend completa 2.805/2.805; `typecheck`, `git diff --check` y
  `vaults-check --check` verdes. Contrato aprobado; metodología aprobada para
  H3/H6 con un hallazgo nuevo no bloqueante. QA `hsvg2026` 3/3 PASS en
  1440×1000, URL final canónica en los tres ingresos, 3 grupos, 0 misses,
  issues, errores, scroll u overflow; el 8787 permaneció intacto.
- **Hallazgo producido por la auditoría:** I2-H7. El gate preservado acredita
  Consistencia por existencia de frame, no por `relation_audit`; se separa de
  H3/H6 porque es preexistente y el scope congeló contenido/gate, pero queda
  primero en la cola por riesgo de falso verde antes de Diseño.
- **Siguiente acción:** iteración 3, F3/guard I2-H7 — parametrizar el estado
  para base única y dos bases, demostrar el falso «Listo» con una regresión y
  consumir el `status` ya calculado por el engine sin crear un estadístico en
  React. Después alinear el copy de acción con el paso a Diseño.

### Contrato de iteración 3 (scope lock cerrado)

- **Categoría / fuente de verdad:** F3/guard I2-H7. El owner es
  `frame.relation_audit`, calculado por `api/R/calc_muestra_aulas.R`: `used`
  declara si entró catálogo y `status` acredita `ok`, `revisar`, `critico` o
  `sin_catalogo`. React solo interpreta ese estado; no calcula un umbral ni un
  estadístico nuevo.
- **Primera divergencia medida:** el engine entrega correctamente el audit y el
  panel lo muestra, pero `universitySidebarTabs` reduce Consistencia a
  `guideStatus(hasDescriptiveFrame)`. En `hsvg2026`, dos bases +
  `used=true/status=revisar` + dos issues se publica por ello como «Listo».
  El defecto nació en `41bbd505`; no está en R, router ni serialización.
- **Matriz congelada:** sin frame siempre `pending`; una fuente acredita
  `ready` solo cuando la conciliación no aplica de forma coherente (audit
  legacy ausente sin evidencia de catálogo, o `used=false/sin_catalogo` sin
  issues); dos bases acreditan `ready` únicamente con audit presente,
  `used=true` y `status=ok`. Todo status desconocido, `revisar`, `critico`,
  mismatch modo/`used`, audit ausente con dos bases o issue contradictorio
  falla cerrado como `working`. `catalog_audit` legacy puede mostrar evidencia,
  nunca acreditar por sí solo.
- **Módulos afectados:** tipo del contrato de audit, helper de frame compartido,
  estado del sidebar, presentación/copy del panel, contrato R ya existente,
  regresiones y nota de bóveda de Consistencia.
- **Archivos previstos:**
  `api/tests/testthat/test-calc-muestra-aulas.R`;
  `frontend/src/api/calcMuestra.ts`;
  `frontend/src/features/calcMuestra/universidad/shared/frame.ts`;
  `frontend/src/features/calcMuestra/universidad/shared/__tests__/frame.test.ts`;
  `frontend/src/features/calcMuestra/universidad/universidadTabs.ts`;
  `frontend/src/features/calcMuestra/universidad/marco/MarcoConsistenciaTab.tsx`;
  `frontend/src/features/calcMuestra/universidad/marco/__tests__/marcoConsistencia.test.tsx`;
  la nota `Consistencia de fuentes.md` bajo Marco/06; y este ledger.
- **Exclusiones explícitas:** `api/R/**`, routers y forma del payload,
  navegación H3/H6, `CalcMuestraPage.tsx`, bloqueo o disabled de Diseño,
  estadísticas/umbrales React, CSS, migraciones `.pulso`, `aulasParts.tsx`,
  I0-H2/H4/H5/O1/O2, D1/D2 y el prompt no versionado.
- **Ampliación medida por el gate completo:**
  `frontend/src/features/calcMuestra/universidad/marco/__tests__/marcoMotion.test.tsx`
  pertenece al alcance de pruebas: su fixture de dos bases declaraba un
  `relation_audit` sin ninguna unidad ni N auditado, pero esperaba evidencia de
  un marco construido. Se añadirá una unidad mínima al fixture; no se relaja el
  guard de frame utilizable ni se cambia producto por ese estado imposible.
- **Hallazgo del gate contractual:** aunque el tono ya obedecía al `status` de
  R, el gauge conservaba marcas y zonas semánticas React en 70 %/90 %. Un 95 %
  con `status=revisar` quedaba visualmente dentro de «sólido» y contradecía el
  veredicto. Se congeló retirar ticks/escala y dejar solo una barra descriptiva,
  con regresión negativa; no cambia ningún cálculo ni payload.
- **Cambio enfocado:** tipar y normalizar defensivamente el audit existente en
  un helper único; usar su veredicto tanto en sidebar como en el panel; sustituir
  copy que posterga la revisión hasta el sorteo o nombra la antigua
  «Definición» por acciones Datos → Fuentes/Variables y Diseño. No se bloqueará
  navegación ni se cambiará cálculo.
- **Riesgo principal:** convertir un frame legacy de fuente única en falso
  pendiente, o acreditar un audit contradictorio por coerción de `used`; por
  eso solo el booleano `true` acredita catálogo y las combinaciones no
  reconocidas fallan cerradas.
- **Baseline disponible:** test R focal 80/80 y Vitest Marco 10/10 verdes en el
  estado defectuoso; baseline visual
  `/private/tmp/prosecnur-visual-iter3-baseline` reproduce «Listo» con
  `source_mode=dos_bases`, `status=revisar`, match 0,9998, 2 issues y 1 warning;
  C1–C4 pasan y C5 falla, sin errores/misses/overflow/scroll.
- **Validación mínima:** regresiones rojas para la matriz del helper/sidebar,
  SSR de estados/copy y contratos R `sin_catalogo/revisar`; Vitest focal y
  suite completa + `typecheck`; test R focal; `vaults-check --check` y
  `git diff --check`; QA `hsvg2026` en 1440×1000 y 1024×600 con
  `--require-geometry`; revisión metodológica/contractual y `verificador`
  serial.
- **Fallo o cuello:** React recibía el audit correcto pero reducía el rail a
  existencia de frame y el panel confundía audit ausente/`used=false` con
  fuente única. El primer gate contractual encontró además un segundo falso
  significado: marcas 70 %/90 % que podían rotular «sólido» un `revisar`.
- **Cambio enfocado:** tipo retrocompatible del audit, decisión única
  `source_mode × relation_audit`, consumo común en rail/panel, copy causal y
  nota de bóveda. El porcentaje queda como evidencia formateada; no acredita ni
  define bandas. No se bloqueó Diseño ni se cambió R, router o payload.
- **Resultado:** mejor. El caso real `hsvg2026` con 5.262/5.263 coincidencias,
  dos incidencias y `status=revisar` publica «Siguiente paso» y reconstrucción,
  no «Listo» ni fuente única. Una fuente única legacy coherente conserva el
  no-aplica; malformados y contradicciones fallan cerrados. I2-H7 e I3-H8
  quedan cerrados.
- **Validación ejecutada:** rojo causal 31/60 y verde focal 60/60; guard C5
  rojo 1/18 y verde combinado 23/23; suite frontend 338 archivos y
  2.839/2.839 pruebas; `typecheck`, `git diff --check` y bóvedas verdes; test R
  118/118. Revisión metodológica aprobada y revisor contractual aprobó el
  delta tras levantar su veto C5. QA final delta 2/2 PASS en 1440×1000 y
  1024×600, con porcentaje accesible, cero ticks/escala locales, 2 grupos y
  cero misses, issues, errores, scroll-jails u overflow; 8787 intacto.
- **Hallazgo producido y consumido:** I3-H8 se detectó en el primer gate de
  contrato, recibió regresión roja y se cerró en la misma iteración; por eso no
  aumenta el contador abierto.
- **Siguiente acción:** iteración 4, F3/I0-H5 — medir por dirección la sección
  Salida, congelar Cierre → Tablas → Entregables → Pase a Monitoreo y
  demostrar el orden incorrecto antes de cambiar catálogo/sidebar/render/bóveda.

## Cómo se corre cada visita

```bash
make dev-pulso PULSO=api/inst/reference_projects/hsvg2026.pulso
```

- Navegar por dirección, no por click: `window.__pulsoNav.ir("calc-muestra/…")`
  o `--ir` en los runners; `?modo=opinion-universitaria&seccion=<datos|marco|calculo|aulas|salidas>&pestana=<id>`.
- QA visual: `make ui-quick-check` · matriz completa:
  `make reference-project-visual-matrix REFERENCE_PROJECT=hsvg2026`.
- Higiene: reusar servers (`preview_list`, el 8787 es del usuario), cerrar lo
  propio, `make dev-status` / `make dev-prune` ante huérfanos.
- Tests R focalizados: `Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-calc_muestra_aulas.R")'`
  (y los `test-calc_muestra*` hermanos según el diff).
