# GOAL — Cálculo de muestra: el selector decide con evidencia, no con etiquetas

Tipo: Goal operativo de producto + QA
Estado: En curso
Fecha: 2026-07-31
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
| Pestañas de Aulas repasadas por el revamp F2 | 0 de 7 | 0 de 6 vivas; la séptima era la dirección redundante retirada en I5 | ↑ a 6 |
| Pestañas de Aulas/Salidas con capacidad y alcance C3–C4 auditados | por medir; I0-O2 no tenía rectángulos propios | 10 de 10 × 3 viewports: 30/30 alcanzables, 0 problemas de capacidad; 5 oportunidades solo exteriores | = 100 %; no acredita revamp F2 |
| `aulasParts.tsx` | 1.612 | 1.612 | ↓ |
| Pestañas con hogar/orden justificado por la cadena metodológica (F3) | por auditar en iteración 0 | 24 de 24 históricas justificadas (100 %); cobertura viva 23 de 23 | = 100 % |
| Alias muertos que ya nadie escribe y pueden documentarse como históricos | 12 | 12 | = (no crecen sin porqué) |
| Declaraciones `data-qa-geometry-group` en el desk universitario | por medir en iteración 0 | 16 grupos conformes en los cuatro destinos de I7; Radiografía de CH aporta 5 por viewport y el guard final suma 15 auditorías, 0 misses/issues | ↑ con cobertura conforme |
| Navegaciones canónicas Marco/Aulas que aterrizan arriba tras forzar el owner origen | por medir; I0-O1 sin secuencia reproducible | 13 de 13 navegaciones nuevas + 1 de 1 POP en 1710×1107; reset desde primer frame y estable | = 100 % |
| Captura e inspección del runner sobre el mismo estado de motion finito | sin contrato; I9-H9 | 1 contrato probado: screenshot lleva finitas al final, DOM reutiliza ese estado y opacidad efectiva 0 queda fuera | = 100 % del caso causal |
| Hallazgos abiertos del loop | 1 (N9 heredado) | 0 confirmados + 0 observaciones; N9, I0-O1, I0-O2, I0-H1, I0-H2, I0-H3, I0-H4, I0-H5, I0-H6, I2-H7, I3-H8, I7-O3 e I9-H9 cerrados | = 0 |

La **iteración 0** completa las celdas «por medir» con el instrumento, no a
ojo, y toma el baseline visual de las cinco secciones con `qa-visual-desktop`.

## Cola medida de hallazgos

| ID | Frente | Hallazgo | Estado / evidencia |
|---|---|---|---|
| N9 | F0 | Marco publica dos instantáneas no reconciliadas de CH elegibles (2.265 y 2.373 en `hsvg2026`) | **resuelto I1 + decisión D1**: owner, perfil, audit y exploración del fixture vigente cuadran en 2.373; un payload legacy contradictorio queda en S/D + reconstrucción; Gonzalo fijó que manda el marco ejecutado y la exploración se rotula previa |
| I0-H1 | F1 / guard | Marco incumple C1: `cmv2-uni-cifra` y tres listas `cmv2-crit-item` no declaran contrato geométrico | **cerrado I1 en su alcance de Criterios**: 30 auditorías en cinco viewports, 0 misses/issues; el hueco distinto de Radiografía quedó separado como I7-O3 y cerrado I8 |
| I0-H2 | F1 / visual | Etiquetas de criterios se parten dentro de la palabra en 1366×768 | **cerrado I6**: piso de 240 px, tier 1100 y wrap normal eliminan cortes; el compuesto conserva texto/ARIA y solo admite quiebres tras sus comas |
| I0-H3 | F3 | `def-consistencia` vive en Datos aunque el contrato la ubica al final de Marco | **cerrado I2**: Datos queda con 3 pestañas y Marco con 6; Consistencia tiene un único hogar, el sexto de Marco |
| I0-H4 | F3 | Selección conserva «Marco de cursos-horario», duplicado que la spec manda retirar | **cerrado I5**: Selección conserva seis hogares vivos, la dirección publicada reemplaza a `marco/marco-aulas` y Sustento recibe guard, fecha y respaldo sin mezclar versiones |
| I0-H5 | F3 | Entrega ordena Entregables antes de Tablas | **cerrado I4**: Cierre → Tablas → Entregables → Pase coincide en catálogo, sidebar, render, bóveda y manifiesto; ids, direcciones, paneles, contenido y estados permanecen unidos a su identidad |
| I0-H6 | F3 / navegación | El alias cross-section `marco-validacion → def-consistencia` cae en la primera pestaña de Marco | **cerrado I2**: alias y URL publicada anterior canonicalizan con `replace` a `marco/def-consistencia`; 3/3 visitas reales |
| I2-H7 | F3 / guard metodológico | Consistencia puede publicar «Listo» con dos bases aunque `relation_audit.status` sea `revisar` o `critico` | **cerrado I3**: sidebar y panel comparten una decisión fail-closed; dos bases solo acreditan `used===true/status=ok` sin incidencias |
| I3-H8 | F3 / C5 | El gauge conserva umbrales React 70 %/90 % y una zona «sólido» ajenos al `status` de R | **cerrado I3**: barra puramente descriptiva, tono del audit y regresión que prohíbe ticks, escala y zonas semánticas locales |
| I0-O1 | F2 / navegación | Marco y Aulas pueden conservar scroll inicial al navegar por `--ir` en 1710×1107 | **cerrado I7**: el baseline confirmó 661 px heredados en Marco; el owner real se resetea pre-paint y el guard final pasa 13/13 navegaciones nuevas + POP |
| I0-O2 | F2 / C3 | Aulas y Salidas dejan capacidad exterior amplia en escritorio grande | **cerrado I9 como no defecto**: 30/30 celdas alcanzables, gap interior 0–1 px y 0 `CAPACITY_ISSUE`; cinco celdas solo ofrecen densidad exterior. La impresión de I0 mezcló stagger sin asentar con margen legítimo |
| I7-O3 | F1 / guard C1 | Radiografía de CH expone siete candidatos geométricos sin `data-qa-geometry-group` | **cerrado I8**: 4 colecciones reales declaran contrato `intrinsic`; controles envueltos, badges y leyenda quedan excluidos por semántica, no por opt-out; 3 viewports, 15 auditorías, 0 misses/issues |
| I9-H9 | guard visual transversal | `ui-quick-check` puede capturar después de dos RAF mientras siguen animaciones escalonadas y contar como visibles nodos con `opacity: 0` | **cerrado I10**: ambos screenshots usan el fast-forward finito de Playwright antes de `inspectDom`; un único predicado excluye opacidad computada 0 propia/ancestral en overflow y geometría, conserva `.35` y no espera infinitas. Regresión causal 5/6 roja → 6/6; suite del runner 21/21 |

## Bandeja de decisiones (solo Gonzalo)

| # | Decisión | Opciones | Recomendación | Estado |
|---|---|---|---|---|
| D1 | N9: ¿qué instantánea de «CH elegibles» manda en Marco? | (a) manda el marco ejecutado y la exploración se rotula «exploración previa»; (b) manda la exploración; (c) ambas visibles con rótulo de momento | (a): el marco ejecutado es el que produce la muestra; la exploración es borrador | **resuelta por Gonzalo 2026-08-01: (a)** |
| D2 | Denominador del promedio de alumnos por CH en la radiografía | (a) CH elegibles bajo los criterios activos; (b) todos los CH del marco; (c) ambos, elegibles como cifra principal | (c): el contraste elegible/total es información de ponderación | **resuelta por Gonzalo 2026-08-01: (c)** |

## Registro de iteraciones

| # | Fecha | Frente | Qué se hizo | Evidencia | Ledger movido |
|---|---|---|---|---|---|
| 0 | 2026-07-31 | F0–F4 · baseline | Se midieron estructura, contratos parciales, orden de las 24 pestañas y las cinco secciones reales de `hsvg2026`; no se tocó producto | `wc`/`rg` con `archivo:línea`; revisión metodológica 24/24; `ui-quick-check --require-geometry` 25/25 en el bundle `prosecnur-visual-iter0` (PASS 20, FAIL 5 por C1 en Marco, demás contadores duros en 0) | F3: por auditar → 20/24 justificadas; geometría: por medir → 4 locales; contratos: se reconoció 1 parcial probado; hallazgos: 1 → 7 + 2 observaciones |
| 1 | 2026-08-01 | F0/N9 + I0-H1 | Se congeló `aula_frame.included` como owner del conteo ejecutado; perfil, audit y exploración se validan como proyecciones; los cuatro consumidores fallan cerrado en mismatch/ausencia, conservan reconstrucción y rotulan `elegibles_total` como matrículas; se retiró el promedio React sin denominador decidido y se declaró C1 | test R 191/191; Vitest afectado 29/29 y suite completa 2.797/2.797; typecheck y diff-check 0; contrato compatible y revisión metodológica aprobada; `prosecnur-visual-iter1-final-r3/marco/report.json` acreditó Criterios 5/5, 30 auditorías y 0 misses/issues; la revisión I8 dejó explícito que el reporte hermano de Radiografía seguía rojo con 35 misses | N9: 1 → 0 cifras sin dueño; geometría de Criterios: 20 → 0 misses; N9 e I0-H1 cerrados en ese alcance. El hueco de Radiografía no se contabilizó entonces y queda cerrado aparte en I8 |
| 2 | 2026-08-01 | F3/I0-H3 + I0-H6 | Se devolvió `def-consistencia` al final de Marco en catálogo, sidebar, render y bóveda; la URL antes publicada y el alias histórico se leen como parejas explícitas y se reemplazan por `marco/def-consistencia`, sin inferir sección desde un tab suelto | regresión 10 rojas/20 verdes → 30/30; suite 2.805/2.805 y typecheck verdes; bóveda sin V1/V3; contrato aprobado y método aprobado con I2-H7 separado; bundle `prosecnur-visual-iter2-final/runtime-probe/report.json` 3/3 PASS, 3 grupos, 0 misses/issues/errores/scroll/overflow | F3: 20/24 → 21/24; H3 y H6 cerrados; hallazgos 5 + 2 → 4 + 2 al incorporar H7 |
| 3 | 2026-08-01 | F3/guard I2-H7 + C5/I3-H8 | Se tipó el audit existente y se congeló una decisión compartida por sidebar/panel: sin frame `pending`, dos bases solo `ready` con `used===true/status=ok` sin incidencias y toda contradicción falla cerrada; el panel dirige a Datos → Marco → Diseño, la bóveda replica el contrato y el gauge quedó descriptivo, sin umbrales React | regresión principal 31 rojas/29 verdes → 60/60; guard C5 1 roja/17 verdes → 23/23; suite 2.839/2.839, typecheck, 118/118 R, bóveda y diff-check verdes; método y contrato aprobados; bundle `prosecnur-visual-iter3-final-delta/runtime-probe/report.json` 2/2 PASS, 2 grupos y todos los contadores duros en 0 | I2-H7 e I3-H8 cerrados; hallazgos abiertos 4 + 2 → 3 + 2; F3 se mantiene 21/24 porque el guard no mueve pestañas |
| 4 | 2026-08-01 | F3/I0-H5 | Se ordenó Salida como Cierre → Tablas → Entregables → Pase en catálogo, estados y render, sin cambiar identidades ni deep-links; se alinearon inventario, bóveda e índice generado con los movimientos Tablas `03→02` y Entregables `02→03` | regresión causal 2 fallos/7 pruebas → foco de navegación 34/34; suite 339 archivos y 2.840/2.840 pruebas, typecheck, bóveda y diff-check verdes; método y contrato aprobados; bundle `prosecnur-visual-iter4-final/runtime-probe/report.json` 8/8 PASS, C1–C5, 16 grupos y todos los contadores duros en 0 | F3: 21/24 → 23/24; I0-H5 cerrado; hallazgos abiertos 3 + 2 → 2 + 2 |
| 5 | 2026-08-01 | F3/I0-H4 | Se retiró el hogar duplicado `aulas/marco`; la pareja histórica reemplaza a `marco/marco-aulas`; Selección abre en Objetivo y conserva seis gates; fecha, respaldo y firmas histórica/vigente quedaron separados en Sustento; bóveda y manifiesto se renumeraron sin cambiar ids vivos | regresión de retiro 9 fallos/61 pruebas → 61/61; veto metodológico del sello 2 fallos/8 → 8/8; veto visual C1 1 fallo/9 → 9/9; veto del verificador a CSS posicional 1 fallo/10 → 10/10; foco final 65/65, suite 340 archivos y 2.857/2.857, typecheck, bóveda (201 nodos/206 notas) y diff-check verdes; método, contrato y verificador serial aprobados; A/B 4/4 PASS en el bundle `prosecnur-visual-iter5-final/runtime-probe/report.json` y C final 2/2 PASS en `prosecnur-visual-iter5-final-typography/report.json`, 14 grupos finales y todos los contadores duros en 0 | F3 histórico: 23/24 → 24/24 y vivo 23/23; Aulas F2 cambia denominador 7 → 6 vivas; I0-H4 cerrado; hallazgos 2 + 2 → 1 + 2 |
| 6 | 2026-08-01 | F1/F2/I0-H2 | Se amplió la capacidad de las categorías planas, se congeló la cascada 1350→1100→620 y se retiró `anywhere` solo de sus rótulos; el rótulo compuesto conserva texto y nombre accesible e incorpora oportunidades de corte únicamente después de sus seis comas | guard CSS 3 fallos/3 verdes → 6/6; veto visual C3 → regresión semántica 1 fallo/6 verdes → 7/7; foco 108/108, suite 340 archivos y 2.861/2.861, typecheck, bóveda (201 nodos/206 notas) y diff-check verdes; contrato aprobado; bundle `prosecnur-visual-iter6-final-wbr/report.json` 7/7 PASS, columnas 6/5/4/4/3/3/2, 0/217 rótulos partidos, 42 grupos y todos los contadores duros en 0; el veto documental posterior corrigió índice, `Fecha` y portabilidad: 21/21 tests y árbol propuesto 196/196, 0 errores | I0-H2 cerrado; hallazgos abiertos 1 + 2 → 0 + 2; F1/F2 conservan sus denominadores porque la iteración cierra un defecto, no acredita una radiografía ni un revamp completo |
| 7 | 2026-08-01 | F2/I0-O1 | Se identificó `.cmv2-tab-panel` como owner único, se le dio un ref local y se resetea pre-paint al cambiar sección o pestaña; se retiraron los dos RAF muertos sobre `.cmv2-main`, sin mover foco ni alterar navegación/historial | runtime rojo Marco 661→661; guard fuente 3 fallos→3/3; foco estructural 9/9; suite 341 archivos y 2.864/2.864, typecheck, bóveda (201/206) y diff-check verdes; contrato aprobado; bundle `prosecnur-visual-iter7-final/report.json`: 13/13 navegaciones nuevas + POP PASS, owner en 0 desde rAF, sin salto a +600 ms ni errores duros | Navegación pasa de observación sin denominador a 13/13 + POP; I0-O1 cerrado. I7-O3 entra como observación separada, por lo que hallazgos agregados quedan 0 + 2; geometría expone 7 misses de cobertura sin promoverlos a FAIL |
| 8 | 2026-08-01 | F1/I7-O3 | Se auditó la Radiografía de CH 7×3: cuatro colecciones reales recibieron C1 `intrinsic`; el detector aprendió a excluir controles envueltos y átomos `span` inline, incluida su blockification como flex-item, sin opt-out ni clases locales. Pasos poseen su capacidad; decisiones solo declaran membresía | historia causal: I1 ya tenía 35 misses; detector 7→4 y fuente 3/3 rojos → detector 5/5, fuente 3/3 y foco 21/21 verdes; suite 342 archivos y 2.867/2.867, typecheck, bóveda 201/206 y diff-check verdes. Un veto visual capturó blockification (6 misses) y un veto contractual impidió ocultar `span-flex+input`; ambos ganaron regresión. Bundle final `prosecnur-visual-iter8-final-r3`: 3/3, 15 auditorías, 0 misses/issues/errores, 51/51 headers y 12/12 últimos miembros | I7-O3 cerrado; geometría pasa de 12 grupos + 7 candidatos a 16 grupos conformes y 0 misses en el alcance; hallazgos abiertos 0 + 2 → 0 + 1. I0-O2 queda como única observación; D1/D2 intactas |
| 9 | 2026-08-01 | F2/I0-O2 + guard I9-H9 | Se separó capacidad interior de margen exterior en las diez pestañas vivas; ninguna retiene vacío ni corta el final. La captura de apertura se explicó por stagger no asentado y margen fuera de la ficha; no se tocó producto | baseline funcional 17/17; guard visual 10/10 direcciones, 30/30 capturas, 45 grupos y todos los duros en 0. Probe causal v2: 25 `NO_DEFECT`, 5 `DENSITY_OPPORTUNITY`, 0 `CAPACITY_ISSUE`, 0 `REACHABILITY_ISSUE`, gap raíz 0 y terminal 0–1 px. El v1 fue vetado por elegir descendientes de `details` cerrados y confundir padding con capacidad | Capacidad/alcance: por medir → 10/10 × 3; I0-O2 cerrado; observaciones 1 → 0. Entra I9-H9 como único hallazgo confirmado del guard; revamp F2 y D1/D2 no cambian |
| 10 | 2026-08-01 | guard transversal/I9-H9 | Se asentaron animaciones finitas en los screenshots antes de inspeccionar y se unificó la visibilidad por opacidad efectiva para el barrido de overflow y la geometría; las infinitas no se esperan y motion normal no se sustituye por reduced motion | detector baseline 5/5; fixture causal 5 verdes + 1 roja por tres miembros desplazados y `opacity:0` incluida → 6/6. Un veto contractual detectó que overflow aún ignoraba opacidad; el fixture ganó controles equivalentes bajo ancestros 0/.35 y volvió a 6/6. Suite runner 21/21, `node --check`, help y diff-check verdes; contrato final aprobado | I9-H9 cerrado; guard motion sin contrato → 1 contrato probado; hallazgos 1 + 0 → 0 + 0. F1 sigue 0 completos, F2 0/6 y `aulasParts.tsx` 1.612. Durante el cierre Gonzalo resolvió D1=(a) y D2=(c); su implementación entra en I11 |

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

**Siguiente iteración programada:** **11 — F0/F1, convertir el contrato parcial
`session_type × facultad` en el primer contrato estadístico completo del
selector**. D1=(a) y D2=(c) fueron congeladas por Gonzalo: manda el marco
ejecutado, la exploración se rotula previa y el promedio elegible será principal
con el total como contraste. Se trazará primero el owner R y el grano
CH×facultad; el engine añadirá con tests p10/p90, ambos promedios y el delta
marginal activar/desactivar. React solo formateará el payload probado. F2 queda
expresamente después de acreditar este primer contrato F1 completo.

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
  diff-check verdes; revisiones contractual y metodológica aprobadas. El r3
  citado para el cierre fue `marco/report.json`, Criterios del estudiante: 5/5
  PASS con 30 auditorías, 0 misses/issues y contadores duros en cero. La revisión
  histórica de I8 deja explícito que `radiografia/report.json`, generado en la
  misma corrida, conservaba 35 misses y `ok=false`; era otro alcance C1.
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
  el bundle `prosecnur-visual-iter2-baseline`: las parejas
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
  el bundle `prosecnur-visual-iter3-baseline` reproduce «Listo» con
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

### Contrato de iteración 4 (scope lock cerrado)

- **Categoría / fuente de verdad:** F3/I0-H5. La spec vigente
  `docs/calc-muestra-recorrido-spec.md:102-109` fija Salida como Cierre →
  Tablas → Entregables → Pase a Monitoreo: primero se leen cuotas, totales
  y procedencia; después se configura audiencia, privacidad y publicación.
- **Primera divergencia medida:**
  `frontend/src/lib/navegacion/catalogos/calcMuestra.ts` publica Cierre →
  Entregables → Tablas → Pase. `modules.ts` y el generador preservan ese
  array por referencia; `universidadTabs.ts` además lo destructura por posición,
  de modo que intercambiar solo el catálogo cruzaría los estados de Tablas y
  Entregables. `UniversidadDesk.tsx`, la bóveda y el inventario metodológico
  repiten el orden heredado.
- **Historia causal:** `41bbd5054` introdujo el orden en el desk; `08dc6a81d`
  publicó después la spec contraria sin alinear la UI, primera divergencia
  contractual; `4a5a16d07` extrajo el orden heredado a catálogo, test, bóveda e
  índice generado.
- **Matriz congelada por identidad:** `salidas-guia` conserva el gate de
  cierre; `salidas-resultados` conserva `guideStatus(hasResult)`;
  `salidas-entregables` conserva el gate de resultado + selección +
  publicación; `salidas-monitoreo` conserva selección + reemplazos. Solo cambian
  las posiciones 2/3; ids, `targetId`, URL, contenido y estados viajan con su
  identidad. No se añade bloqueo por visita.
- **Archivos previstos de producto/prueba:**
  `frontend/src/lib/navegacion/catalogos/calcMuestra.ts`;
  `frontend/src/lib/navegacion/catalogos/catalogos.test.ts`;
  `frontend/src/features/calcMuestra/universidad/universidadTabs.ts`;
  la regresión nueva
  `frontend/src/features/calcMuestra/universidad/universidadTabs.test.ts`; y
  `frontend/src/features/calcMuestra/universidad/UniversidadDesk.tsx`.
- **Costura documental prevista:**
  `docs/calc-muestra-copys-metodologicos.md`; la dirección generada
  `docs/sistema/direcciones/calc-muestra.md`; `Entrega.md` y las notas Cierre,
  Tablas y Entregables bajo `Secciones/05 Entrega`, moviendo carpetas/notas
  `Tablas 03→02` y `Entregables 02→03` con `orden` y siguiente paso; y este
  ledger. `ruta_app`, `nodo` e ids se conservan.
- **Exclusiones explícitas:** la spec autoritativa, `modules.ts`,
  `CalcMuestraPage.tsx`, aliases/resolvers y memoria de pestaña, componentes
  internos de Salidas, API/R, cálculo/payload, CSS, `.pulso`, `aulasParts.tsx`,
  H2/H4/O1/O2, D1/D2, Consistencia ya cerrada y el prompt no versionado.
- **Cambio enfocado:** intercambiar Tablas/Entregables en catálogo, retorno del
  sidebar y orden declarativo de render; actualizar contrato documental sin
  renombrar ni teletransportar direcciones. No hay dato nuevo, gráfico ni
  peaje de extracción.
- **Riesgo principal:** asociar `deliverablesReady` a Tablas o `hasResult` a
  Entregables por destructuring posicional, o romper un deep-link/tab guardado
  aunque los ids no cambien. La regresión comprobará orden y estado juntos por
  id.
- **Baseline disponible:** catálogo 6/6 y focal de navegación 33/33 verdes en
  el estado defectuoso; bóvedas verdes con 202 nodos/207 notas (ese check no
  valida orden). `hsvg2026` en
  el bundle `prosecnur-visual-iter4-baseline/runtime-probe/report.json`
  reproduce el orden viejo de manera idéntica en DOM/runtime/manifiesto; las
  ocho visitas por dirección son alcanzables y geométricamente sanas, con una
  falla conceptual de orden, 16 grupos y todos los contadores duros en cero.
- **Regresión causal:** el nuevo contrato de orden y estado por id produjo 2
  fallos en 7 pruebas sobre la implementación previa; tras la reparación, el
  foco ampliado de catálogo, manifiesto, navegación y sidebar cerró 34/34.
- **Cambio ejecutado:** se intercambiaron Tablas/Entregables en el catálogo,
  el destructuring/retorno del sidebar y el render declarativo. El inventario
  metodológico, la bóveda y su índice generado reflejan la misma cadena; las
  notas se movieron completas y conservaron `ruta_app` y `nodo`.
- **Peaje estructural:** no aparece un concepto, payload ni componente nuevo;
  la corrección usa el catálogo existente como owner. `modules.ts`, aliases,
  memoria, componentes internos, API/R, CSS y `aulasParts.tsx` permanecen fuera
  del diff.
- **Validación ejecutada:** suite frontend 339 archivos y 2.840/2.840 pruebas,
  `typecheck`, `vaults-check --check` (202 nodos/207 notas) y
  `git diff --check` verdes. Revisión metodológica y contractual aprobadas sin
  migración ni ADR. QA `hsvg2026` 8/8 PASS en 1440×1000 y 1024×600:
  DOM/runtime/manifiesto coinciden; URL, panel, contenido, estado y clase C5 se
  preservan por id; C1–C5, 16 grupos y todos los contadores duros quedan en 0;
  el 8787 no se tocó.
- **Resultado:** mejor. I0-H5 queda cerrado y F3 avanza 21/24 → 23/24 sin
  teletransportar direcciones ni cruzar estados.
- **Siguiente acción:** iteración 5, F3/I0-H4 — auditar la dirección
  redundante «Marco de cursos-horario» en Selección, fijar la compatibilidad de
  su URL publicada y retirar el hogar duplicado sin perder contenido único.

### Contrato de iteración 5 (scope lock cerrado)

- **Categoría / fuente de verdad:** F3/I0-H4. La spec vigente
  `docs/calc-muestra-recorrido-spec.md:87-98` fija seis pestañas en Selección:
  Objetivo → Método → Simulación → Titulares → Reemplazos → Sustento, y
  ordena retirar «Marco de aulas» porque duplica Marco/Aulas.
- **Primera divergencia e historia causal:** `41bbd5054` creó el tab
  `aulas/marco` junto con su hogar canónico; `08dc6a81d` publicó después la
  spec que lo elimina pero no alineó la UI, primera divergencia contractual.
  `4a5a16d` consolidó el estado heredado en catálogo, manifiesto, bóveda y
  tests. Hoy el flujo es catálogo → `modules.ts`/manifiesto → sidebar →
  `UniversidadDesk` → `AulasMarcoTab`.
- **Baseline medido por dirección:**
  el bundle `prosecnur-visual-iter5-baseline/report.json` reproduce
  `aulas/marco` como primer tab en DOM, runtime y manifiesto, y visita también
  `aulas/objetivo` y `marco/marco-aulas` en 1440×1000 y 1024×600. Las seis
  superficies pasan C1–C4, 10 grupos, cero misses/issues/scroll/overflow o
  errores; C5 falla solo por la duplicación conceptual. La URL vieja resuelve
  exactamente al tab redundante y no existe migración.
- **Clasificación de contenido:** la cadena general, conteos y cuatro reglas
  tienen hogares funcionales en Marco, Objetivo, Método, Titulares,
  Reemplazos y Entrega. No se conservará el overview duplicado. Sí se reubican
  en Sustento técnico tres piezas únicas: el guard que compara
  `frame.frame_hash` con `selection.frame_hash`, la fecha del marco y el único
  `<RespaldoMetodologico paso="aulas" />`. Hashes distintos deben invalidar la
  selección visible; hashes iguales o ausentes no producen falso positivo.
- **Contrato de compatibilidad:** la pareja histórica exacta
  `seccion=aulas&pestana=marco` canonicaliza con `replace` a
  `seccion=marco&pestana=marco-aulas`, preservando modo y parámetros ajenos.
  Una pestaña `marco` suelta u otra sección no permiten inferir hogar. Selección
  sin tab, con memoria vieja o con tab desconocido cae en su primera dirección
  viva, `objetivo`. La recuperación cross-section usa explícitamente
  `marco/marco-aulas`; no reutiliza el id retirado por accidente de tipos.
- **Archivos previstos de producto:**
  `frontend/src/lib/navegacion/catalogos/calcMuestra.ts`;
  `frontend/src/features/calcMuestra/navegacion.ts`;
  `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`;
  `frontend/src/features/calcMuestra/universidad/universidadTabs.ts`;
  `frontend/src/features/calcMuestra/universidad/UniversidadDesk.tsx`;
  `frontend/src/features/calcMuestra/universidad/aulas/index.ts`;
  `frontend/src/features/calcMuestra/universidad/aulas/AulasAuditoriaTab.tsx`;
  `frontend/src/features/calcMuestra/universidad/aulas/aulas.css`; y retirar
  `frontend/src/features/calcMuestra/universidad/aulas/AulasMarcoTab.tsx`.
- **Regresiones previstas:**
  `frontend/src/lib/navegacion/catalogos/catalogos.test.ts`;
  `frontend/src/lib/modulesNavigation.test.ts`;
  `frontend/src/lib/navegacion/manifiesto.test.ts`;
  `frontend/src/features/calcMuestra/navegacion.test.ts`;
  `frontend/src/features/calcMuestra/universidad/universidadTabs.test.ts`; y
  una prueba nueva
  `frontend/src/features/calcMuestra/universidad/aulas/__tests__/AulasAuditoriaTab.test.tsx`
  para mismatch/igualdad/ausencia de firmas y respaldo conservado.
- **Costura documental prevista:** actualizar
  `docs/calc-muestra-copys-metodologicos.md`; regenerar solo
  `docs/sistema/direcciones/calc-muestra.md`; retirar la nota duplicada
  `Selección/Pestañas/01 Marco de cursos-horario`; renumerar Objetivo `02→01`,
  Método `03→02`, Simulación `04→03`, Titulares `05→04`, Reemplazos
  `06→05` y Sustento `07→06`; actualizar el padre Selección, el siguiente
  paso de Distribución y el guard/respaldo en la nota Sustento; y cerrar este
  ledger. `ruta_app`, `nodo`, ids y contenido de los seis tabs sobreviven.
- **Peaje estructural:** retirar export, render, tipo/status y CSS exclusivos
  del tab muerto; no dejar un componente de 240 líneas inalcanzable ni hacer
  crecer `aulasParts.tsx`. El catálogo vivo pasa de 24 a 23 tabs y el manifiesto
  de 43 a 42 direcciones; el denominador histórico F3 cierra 23/24 → 24/24 y
  se acompaña con cobertura viva 23/23.
- **Exclusiones explícitas:** la spec autoritativa, `modules.ts`, el motor R y
  payloads, cálculo/selección/reemplazos, `aulasParts.tsx`, CSS no exclusivo,
  `.pulso`, H2/O1/O2, D1/D2, I4 ya cerrada y el prompt no versionado.
- **Riesgo principal:** perder el guard de obsolescencia de la selección o
  hacer que un deep-link publicado aterrice silenciosamente en Objetivo sin
  reemplazar su URL. El test y QA final deben probar ambos contratos por
  dirección, no solo por orden del array.
- **Baseline de checks:** foco de catálogo/manifiesto/navegación/sidebar 34/34
  verde en el estado defectuoso; bóveda verde con 202 nodos/207 notas. Las
  expectativas actuales consolidan 24 tabs y la dirección redundante.
- **Validación mínima:** regresiones rojas de conteo/orden, pareja histórica,
  default y guard de firmas; foco ampliado, suite frontend y `typecheck`;
  `vaults-check --generar` seguido de `--check`; `git diff --check`; QA final
  `hsvg2026` en ambos viewports que pruebe URL vieja → Marco/Cursos-horario,
  Selección → Objetivo, seis tabs vivos y Sustento, con C1–C5; revisión
  metodológica/contractual y `verificador` serial.
- **Rojo y reparación enfocada:** el retiro produjo 9 fallos causales en 61
  pruebas y cerró 61/61. La primera revisión metodológica vetó que una firma de
  selección histórica compartiera sello con `frame.generated_at`: dos
  regresiones fallaron, se separaron `Firma usada por la selección`, `Firma del
  marco actual` y `Marco actual generado`, y quedaron 8/8. El primer guard
  visual detectó que cinco cifras en una sola `CifraFila` se partían 3+2 con
  alturas 80/92 px; una regresión estructural falló 1/9 y se recompuso el sello
  en filas semánticas de 2, 3 y 3 cifras, hasta 9/9. El primer `verificador`
  vetó después el CSS heredado por `nth-of-type`: ya no aplicaba tipografía de
  evidencia a la firma usada ni a la corrida. Una regresión falló 1/10; se
  declaró `monospace` por significado en cuatro cifras y cerró 10/10.
- **Cambio y peaje estructural:** catálogo, tipo, sidebar, render y export
  conservan solo seis ids vivos; `AulasMarcoTab.tsx` (240 líneas) y su CSS
  exclusivo desaparecen; `aulasParts.tsx` permanece en 1.612 líneas. El
  manifiesto baja 43 → 42 direcciones y la bóveda 207 → 206 notas; seis notas
  supervivientes cambian solo de ordinal. El overview repetido no se
  teletransporta y las tres evidencias únicas quedan en Sustento.
- **Delta de scope exigido por el verificador:** se incorporó únicamente
  `frontend/src/features/calcMuestra/universidad/ui/CifraMotor.tsx` para exponer
  el marcador booleano `data-monospace`. Sustento lo activa en Semilla, ambas
  firmas y Corrida de selección; `aulas.css` selecciona ese marcador y deja de
  depender de fila o posición. No cambian otras instancias ni la geometría del
  componente compartido.
- **Guard y contrato:** la pareja histórica exacta usa un único `replace` a
  `marco/marco-aulas` y no autoriza inferencia desde un id suelto. Sin tab, con
  memoria `marco` o con id desconocido, Selección abre `objetivo`. Las firmas
  solo invalidan si ambas existen y difieren; una ausencia legacy no inventa
  obsolescencia ni atribuye la fecha actual a la selección.
- **Validación ejecutada:** foco final 65/65, suite frontend 340 archivos y
  2.857/2.857 pruebas, `typecheck`, `vaults-check --check` (201 nodos, 206
  notas) y `git diff --check` verdes. Método aprobó tras levantar el veto y
  contrato aprobó compatibilidad sin migración ni ADR. En `hsvg2026`, A/B
  pasan 4/4 en 1440×1000 y 1024×600; el Sustento final pasa 2/2 tras las
  reparaciones C1 y tipográfica. El compuesto cubre seis superficies, 14 grupos, C1–C5
  y cero issues/misses/scroll/overflow o errores de consola, página, API,
  recursos, proyecto y readiness; los servers propios se cerraron y el 8787
  no se tocó. El `verificador` serial aprobó 65/65, typecheck, bóveda, diff,
  screenshots y alcance final; no quedó un veto de I5.
- **Resultado:** mejor. I0-H4 queda cerrado; F3 histórico completa 23/24 →
  24/24 con cobertura viva 23/23. El denominador F2 de Aulas pasa de siete a
  seis pestañas vivas sin acreditar todavía el revamp de ninguna. Hallazgos
  abiertos bajan 2 + 2 → 1 + 2 y D1/D2 no cambian.
- **Siguiente acción:** iteración 6, F1/F2/I0-H2 — reproducir por dirección y
  rectángulo el corte intrapalabra en 1366×768, congelar el breakpoint/contrato
  tipográfico mínimo y repararlo con guard visual escalado.

### Contrato de iteración 6 (scope lock cerrado)

- **Categoría / fuente de verdad:** F1/F2/I0-H2. La fuente es la etiqueta
  completa del catálogo R→React y el contrato C5 de legibilidad: una categoría
  puede envolver entre palabras o separadores, pero no cortar un token por falta
  de capacidad. C1–C4 siguen gateando geometría, adaptación, capacidad y acceso.
- **Dirección y baseline medidos:**
  `calc-muestra/opinion-universitaria/marco/marco-criterios-alumno` sobre
  `hsvg2026` en 1440×1000, 1366×768, 1280×720 y 1024×600. El reporte
  el bundle `prosecnur-visual-iter6-baseline/report.json` da `hardPass` 4/4
  y `typographyPass` 0/4: 7 etiquetas y 9 cortes intrapalabra. C1–C4 pasan con
  24 grupos, 0 issues/misses/overflow/scroll-jails o errores; C5 falla. Se
  inspeccionaron las ocho capturas. La transición primaria exacta es 1351 FAIL
  → 1350 PASS, pero el corte reaparece en rangos inferiores por el rótulo largo
  y la capacidad variable.
- **Primera divergencia causal e historia:** `6df7c5fb` introdujo en un mismo
  cambio `auto-fit/minmax(220px)`, `overflow-wrap:anywhere` y el breakpoint
  `max-width:1350px`. En 1366 Formación conserva cinco tracks de ~230,4 px;
  switch y conteo `nowrap` dejan 60–77 px al label y cortan `PREGRA|DO`,
  `DOCTORAD|O` y `ESPECIALID|AD`. En 1024 tres tracks de 282 px dejan 118 px y
  cortan `REINCORPORACIO|N`. Los demás cortes afectan tokens del rótulo
  compuesto de ingreso en 1440/1280/1024.
- **Contrato responsive congelado:** en
  `frontend/src/features/calcMuestra/universidad/criterios/criterios.css`, la
  lista plana usa `repeat(auto-fit,minmax(240px,1fr))`; solo sus labels directos
  declaran `overflow-wrap:normal`, `word-break:normal`, `hyphens:none` y
  `white-space:normal`; un tier independiente `max-width:1100px`, ubicado entre
  los de 1350 y 620, lleva tanto la lista plana como `data-long=true` a dos
  columnas. Resultado exigido: 1440→5, 1366→4, 1280→3, 1024→2 y ≤620→1,
  sin cortes, elipsis, ocultamiento ni overflow.
- **Archivos previstos:** producto únicamente
  `frontend/src/features/calcMuestra/universidad/criterios/criterios.css` y,
  por el veto visual descrito abajo,
  `frontend/src/features/calcMuestra/universidad/criterios/controles.tsx`;
  regresión únicamente
  `frontend/src/features/calcMuestra/universidad/criterios/__tests__/CriteriosGeometry.contract.test.ts`;
  y este ledger. Un writer posee el test y otro el CSS, sin globs solapados.
- **Guard previsto:** ampliar el contrato estático para fallar con el piso
  220, la política `anywhere`, la ausencia del tier 1100 o una cascada donde
  620 no gane. El guard visual final repite las cuatro celdas, mide columnas y
  cada palabra por `Range`, y añade 1710×1107 como extremo ancho; exige C1–C5,
  cero cortes y todos los contadores duros en 0.
- **Peaje estructural:** una regla CSS y un helper presentacional local; no se
  crea un componente público, no crece `aulasParts.tsx`, no se cambia el contrato
  `intrinsic/owned` de listas e ítems y no se toca la lista jerárquica, toggles
  por facultad, variantes ni cabeceras del media query de 900 px.
- **Exclusiones explícitas:** componentes TSX distintos de `controles.tsx`,
  catálogo/contenido/datos, estadísticas, engine/API R, payloads, persistencia,
  `.pulso`, navegación, Aulas/F3 ya cerrada, O1/O2, D1/D2 y el prompt no
  versionado del usuario.
- **Riesgo principal:** arreglar 1366 y trasladar el desborde a 1024 o a códigos
  sin espacios. Por eso el wrap se acota a la lista plana, el tier 2 columnas
  se prueba en 1024 y el detector recorre todos los labels, no solo los tres
  ejemplos originales.
- **Baseline de checks:** el contrato estructural vigente pasa 3/3 aunque el
  defecto existe; esa insuficiencia debe producir la roja. En la apertura no
  había cambios de producto y el árbol conservaba únicamente el prompt no
  rastreado.
- **Primer guard y delta de scope:** la regresión CSS falló 3/6 y cerró 6/6;
  el foco de Criterios pasó 107/107. El primer guard final confirmó columnas
  7/7 y cero cortes en 217 labels, pero vetó C3: el rótulo compuesto
  `INGRESO(EV.TAL,1OP,CEPR,ITS,PAEE,BACH,EX.ING)` no tiene espacios y desborda
  en las siete celdas con `overflow-wrap:normal`. La reparación autorizada
  mantiene ese texto y su `aria-label`, e inserta oportunidades `<wbr>` solo
  después de sus comas en el render plano; no reabre `anywhere` ni cambia el
  catálogo. Debe probarse roja antes de tocar `controles.tsx`.
- **Validación mínima:** roja/verde focal; foco de criterios; suite frontend y
  `typecheck`; `vaults-check --check`; `git diff --check`; guard visual
  `hsvg2026` 1710/1440/1366/1280/1024; revisión contractual y `verificador`
  serial antes del commit.
- **Roja y reparación enfocada:** el guard estructural nuevo falló 3/6 por el
  piso de 220 px, `anywhere` y la ausencia del tier 1100; la cascada congelada
  cerró 6/6. El primer guard Chromium eliminó los nueve cortes originales,
  pero vetó C3 en 7/7 celdas: el token compuesto sin espacios medía 315 px,
  desbordaba su label y se superponía con el conteo. Una regresión de render
  falló 1/7; el helper local insertó seis `<wbr>` después de las comas y cerró
  7/7 sin cambiar texto concatenado, `aria-label`, catálogo ni labels simples.
- **Cambio y peaje estructural:** el piso de la lista plana pasa 220 → 240 px;
  solo sus labels directos usan wrap normal; el tier 1100 impone dos columnas y
  el de 620 conserva una. `ControlFlat` suma un helper presentacional local;
  listas jerárquicas, toggles, variantes, API, engine, persistencia y
  navegación quedan intactos. `aulasParts.tsx` permanece en 1.612 líneas.
- **Validación ejecutada:** guard fuente 6/6 y render 7/7; foco de Criterios
  108/108; suite frontend 340 archivos y 2.861/2.861 pruebas; `typecheck`,
  `vaults-check --check` (201 nodos/206 notas) y `git diff --check` verdes. El
  revisor contractual aprobó compatibilidad, accesibilidad y alcance, sin ADR ni
  migración. El guard final
  el bundle `prosecnur-visual-iter6-final-wbr/report.json` pasa 7/7 en
  1710/1440/1366/1351/1350/1280/1024: columnas 6/5/4/4/3/3/2, 217 labels,
  cero cortes, desbordes o colisiones, 42 grupos, 0 issues/misses y todos los
  contadores de scroll/error/readiness en 0. Las 21 capturas se inspeccionaron,
  el SHA de la copia canónica permaneció estable y los puertos propios se
  cerraron sin tocar 8787.
- **Resultado:** mejor. I0-H2 queda cerrado y los hallazgos bajan 1 + 2 →
  0 + 2; no se acredita una radiografía F1 completa ni una pestaña F2 porque
  esta iteración corrige legibilidad/capacidad, no completa esos contratos.
  D1/D2 siguen abiertas y la bandeja no recibe decisiones nuevas.
- **Siguiente acción:** iteración 7, F2/I0-O1 — medir por dirección canónica
  entrada, cambio de pestaña y retorno en Marco/Aulas a 1710×1107, localizar el
  owner de scroll y confirmar o cerrar la observación antes de tocar producto.
- **Veto documental y delta de scope:** el primer `verificador` aprobó producto,
  pruebas y las 21 capturas, pero vetó `check-docs-governance`: este goal nació
  fuera del índice QA, usa `Fecha de apertura` en vez del campo canónico `Fecha`
  y conserva identificadores de evidencia con raíz efímera. Además, el preflight
  incluye deliberadamente Markdown no rastreado y permitió que el prompt privado
  del usuario vetara un commit que lo excluye. Se conserva esa política; el
  contrato se amplía únicamente a `docs/qa/README.md`: el índice enlaza el goal,
  sus evidencias se expresan mediante IDs portátiles y el campo `Fecha` vuelve a
  ser canónico. No se edita, enlaza, stagea ni versiona el prompt del usuario.
  El comando sobre el árbol compartido debe quedar con ese único error ajeno y
  el mismo gate sobre un espejo del árbol propuesto —sin untracked excluidos del
  commit— debe dar cero errores. La reparación exige ambas evidencias y un
  segundo `verificador` serial; no cambia checker ni política documental.
- **Levantamiento del veto documental:** `docs/qa/README.md` alcanza ahora este
  goal, el encabezado declara `Fecha: 2026-07-31` y las trece referencias a
  bundles visuales conservan su identificador sin raíz local. Los 21 tests del
  checker pasan. El preflight del working tree informa 196/197 alcanzables y un
  único error, exactamente el prompt no rastreado; `git ls-files
  --error-unmatch` confirma que no pertenece al índice. El espejo del árbol
  propuesto `prosecnur-i6-proposed.0Jpf4M`, construido desde `HEAD` y solo los
  cinco archivos previstos, pasa 196/196, 648 enlaces y `Errores: 0`. Bóveda
  201/206 y `git diff --check` permanecen verdes. Este resultado justifica el
  baseline ajeno sin ocultarlo y deja el commit verificable en aislamiento.

### Contrato de iteración 7 (scope lock cerrado)

- **Categoría / fuente de verdad:** F2/I0-O1. La dirección canónica debe
  identificar sección y pestaña, y el panel activo es el único owner del scroll
  vertical del contenido. Esta iteración no presupone el fallo: una navegación
  programática nueva debe mostrar la cabecera del destino; la restauración de
  una entrada de historial se mide aparte y no se confunde con `ir`.
- **Fallo o cuello por confirmar:** en el baseline I0, Marco y Aulas parecían
  conservar un `scrollTop` previo al navegar por dirección a 1710×1107. La
  observación no sumó FAIL porque no se capturaron owner, tiempo de lectura,
  foco ni secuencia reproducible.
- **Matriz de auditoría congelada:** sobre una copia de `hsvg2026`, registrar
  entrada fría por URL canónica; entrada por `window.__pulsoNav.ir`; cambio entre
  dos pestañas de Marco; cambio entre Objetivo y Sustento de Aulas; cruce
  Marco→Aulas→Marco; y retorno de historial. Para cada paso medir en llamada,
  siguiente frame y readiness estable: URL/dirección activa, panel visible,
  `scrollTop/maxScroll`, rectángulo de cabecera, `document.activeElement` y todos
  los owners desplazables. Antes de cada cambio se fuerza el owner origen al
  fondo para que un falso reset sea observable.
- **Criterio de clasificación:** O1 se cierra si toda entrada fría y todo `ir`
  nuevo dejan el owner destino en 0, cabecera visible y sección/pestaña correctas,
  sin saltos tardíos. Se promueve a hallazgo confirmado si cualquiera conserva
  offset, enfoca contenido oculto o desplaza después de readiness. El historial
  puede restaurar posición solo si su semántica es explícita, estable y no
  contamina una navegación nueva.
- **Archivos previstos:** la auditoría confirmó el defecto y el delta autoriza
  únicamente `frontend/src/features/calcMuestra/universidad/UniversidadDesk.tsx`,
  `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, una regresión nueva
  `frontend/src/features/calcMuestra/universidad/UniversidadDeskScroll.contract.test.ts`
  y este ledger. No se toca CSS ni navegación global.
- **Peaje estructural:** localizar un owner único y el límite URL→estado→panel;
  no introducir listeners globales, timers compensatorios ni reset por selector
  DOM desde fuera del módulo. Cualquier reparación debe vivir en el dueño de la
  transición y cubrir teclado/foco además del offset.
- **Exclusiones explícitas:** cálculo/estadísticos y engine R, datos/payloads,
  persistencia y `.pulso`, catálogos/orden ya cerrados por F3, revamp visual de
  Aulas, O2, D1/D2, `aulasParts.tsx`, puerto 8787 y el prompt no rastreado del
  usuario.
- **Riesgo principal:** declarar un bug por medir demasiado pronto, o arreglar
  `ir` destruyendo la restauración legítima de historial. Por eso la prueba
  observa tres momentos y separa ambas clases de navegación.
- **Baseline de checks:** post-I6 `741dbe30`; working tree sin cambios rastreados
  y solo el prompt ajeno como `??`. No se abre server ni se toca producto antes
  de este scope lock.
- **Validación mínima:** navegación real por dirección en 1710×1107 con owner,
  foco y cabecera; tests de navegación relevantes; C1–C5 y contadores duros del
  guard si se toca producto; `typecheck`, bóveda, gobernanza del árbol propuesto,
  `git diff --check`, revisor contractual y `verificador` serial. La iteración
  termina con O1 cerrado o promovido/reparado, ledger actualizado y commit
  atómico en español.
- **Runtime rojo y primera divergencia:** Marco
  `marco-criterios-alumno → marco-ch-radiografia` comparte el owner
  `#cmv2-section-university-marco.cmv2-tab-panel`. Forzado a 661/661, `ir`
  devuelve `true` y cambia URL/dirección en llamada y siguiente frame, pero en
  estable y +600 ms conserva 661/1820; el título `Ajustes del marco` queda en
  `top=-273.64/bottom=-256.64`. No hay salto tardío: el panel persistente nunca
  se resetea. El caso está registrado en el bundle
  `prosecnur-visual-iter7-baseline/quick-first.mjs`; la matriz ampliada sigue
  midiendo Aulas, cruce e historial.
- **Historia causal y baseline de tests:** `94904e47` introdujo pestañas dentro
  de un panel persistente sin reset; `6df7c5fb` intentó corregirlo sobre
  `.cmv2-main`; `b3469206` formalizó `.cmv2-tab-panel` como owner único y dejó
  el main oculto; `27afc0c3` publicó sección/pestaña en URL y expuso el defecto
  por `__pulsoNav.ir`. Ocho archivos de navegación/geometría/ARIA pasan 73/73,
  pero ninguno fuerza scroll antes de un PUSH/POP.
- **Contrato de reparación congelado:** `UniversidadDesk` posee un ref al panel
  activo y un `useLayoutEffect` dependiente de sección + pestaña lo lleva a
  `{top:0,left:0,behavior:"auto"}` antes de pintar una superficie nueva. La
  misma superficie no dispara el efecto; PUSH, cambio de sección y POP sí,
  porque todavía no existe restauración explícita por entrada. No se mueve foco:
  el tab/control superviviente lo conserva y la cabecera solo debe ser visible.
  Los dos RAF de `CalcMuestraPage` que escriben sobre `.cmv2-main` se retiran;
  sus ramas universitarias quedan como retorno, sin selector compensatorio.
- **Guard previsto:** roja estructural/conductual que exija ref sobre cada panel
  universitario, reset pre-paint ligado a `selectedSection` y
  `activeContextTabKey`, y ausencia de `scrollTo` sobre `.cmv2-main`. Después:
  foco relevante, suite completa/typecheck y el mismo probe runtime con owner
  origen forzado; destino debe quedar en 0 desde el siguiente frame hasta
  readiness, con URL/tab/cabecera/foco coherentes.
- **Reparación y peaje estructural:** el guard nuevo falló 3/3 por ausencia de
  efecto, cinco paneles sin ref y dos resets sobre el no-owner. `UniversidadDesk`
  incorpora un único `activePanelRef` y un `useLayoutEffect` dependiente de
  `selectedSection` + `activeContextTabKey`; los cinco paneles condicionales
  comparten el ref. `CalcMuestraPage` conserva sus retornos universitarios y
  elimina solo los dos RAF inertes. No hay selector DOM nuevo, timer, foco,
  cambio CSS ni clasificación global de PUSH/POP.
- **Validación ejecutada:** guard 3/3, foco estructural adicional 9/9, suite
  frontend 341 archivos y 2.864/2.864 pruebas, `typecheck`, bóveda 201/206 y
  `git diff --check` verdes. El contrato aprobó owner/foco, compatibilidad sin
  ADR/migración y semántica reset-top para POP mientras no exista restauración
  explícita por entrada. El guard final fresco del bundle
  `prosecnur-visual-iter7-final/report.json` pasa cuatro cold URLs, 13/13
  navegaciones nuevas y 1/1 POP: Marco 661↔1820 y Aulas 382↔164 llegan a 0 en
  el primer frame, quedan en 0 en readiness y +600 ms, con URL/tab/cabecera/foco
  coherentes y cero errores duros. Las 18 capturas se inspeccionaron; SHA de
  copia/canónico estable, proyecto limpio y puertos propios cerrados sin tocar
  8787. Gobernanza pasa 196/196 y 648 enlaces con 0 errores en el árbol
  propuesto `prosecnur-i7-proposed.qPqLhO`; el working tree compartido conserva
  como único error el prompt ajeno no rastreado.
- **Límites separados del guard:** C2/C3/C5 pasan 4/4 y los contadores duros C4
  son 0. El selector suplementario de última hoja da dos falsos negativos sobre
  descendientes dentro de contenido colapsable, aunque el owner único recorre
  0/medio/máximo; no entra a la cola. Radiografía de CH sí deja una observación
  reproducible distinta: 1 grupo C1 conforme y 7 candidatos sin declaración,
  registrada como I7-O3 sin atribuirle todavía un defecto geométrico.
- **Resultado:** mejor. I0-O1 queda cerrado y la navegación pasa de una
  observación sin secuencia a 13/13 nuevas + POP conformes. Entra I7-O3, de modo
  que el agregado permanece 0 confirmados + 2 observaciones (O2/O3), pero el
  ledger gana un denominador de navegación al 100 %. F1/F2 y D1/D2 no cambian.
- **Siguiente acción:** iteración 8, F1/I7-O3 — medir los siete candidatos de
  Radiografía de CH por rectángulo, cardinalidad, owner y capacidad, contrastar
  el cierre I0-H1 y decidir cuáles son colecciones C1 reales antes de editar.

### Contrato de iteración 8 (scope lock cerrado)

- **Categoría / fuente de verdad:** F1/I7-O3, gobernada por C1 del Contrato de
  Superficie y por la geometría real de `hsvg2026` en dirección canónica
  `calc-muestra/marco/marco-ch-radiografia`. Una colección semántica repetida
  debe declarar grupo, columnas y cardinalidad; un wrapper, una composición
  narrativa o un único bloque no se convierte en grupo solo para subir cobertura.
- **Pregunta causal congelada:** determinar si los siete candidatos reportados
  por el probe de I7 son colecciones C1 sin contrato, o falsos positivos del
  detector por descendientes/estructuras internas. La observación no se promueve
  a defecto antes de identificar cada nodo, sus hermanos, su layout y su dueño.
- **Matriz de auditoría:** para cada candidato registrar selector estable y
  componente fuente; rectángulos de todos sus hijos visibles; cardinalidad;
  `display`, columnas efectivas, gap, wrap y overflow; owner de capacidad;
  etiqueta/rol semántico; relación con el grupo declarado existente; y estado
  en 1710×1107, 1280×800 y 390×844. Contrastar además las reglas y el cierre de
  I0-H1 para no reabrir una geometría ya acreditada con otro denominador.
- **Criterio de clasificación:** `MISS_REAL` solo si hay al menos dos ítems
  semánticamente pares que comparten layout/capacidad y carecen de contrato C1;
  `NO_GRUPO` si es wrapper, bloque singular, pareja etiqueta-valor, composición
  anidada o detector duplicado; `ISSUE` solo si la medición demuestra además
  corte, colisión, overflow o capacidad injustificada. Cada caso debe tener
  evidencia fuente + runtime, no inferencia por nombre de clase.
- **Archivos previstos en la fase de auditoría:** únicamente este ledger. Los
  runners, reportes y capturas viven en un bundle temporal portable. Si aparece
  un `MISS_REAL`, se cerrará primero un delta de scope con el componente dueño y
  una regresión C1 exacta; no se toca producto con esta lista todavía abierta.
- **Peaje estructural:** localizar la frontera componente→colección→layout antes
  de proponer anotaciones. Está prohibido declarar wrappers para satisfacer el
  contador, duplicar ownership, mover cálculo estadístico a React o agrandar
  `aulasParts.tsx`. Si un candidato contiene datos/estadísticos, F0 gatea cualquier
  cambio funcional: esta iteración solo puede contratar su geometría existente.
- **Exclusiones explícitas:** I0-O2/revamp de capacidad exterior, D1/D2,
  navegación y scroll ya cerrados, engine R y payloads, persistencia/.pulso,
  catálogos F3, CSS global, `aulasParts.tsx`, puerto 8787 y el prompt no rastreado
  del usuario.
- **Riesgo principal:** gamificar C1 agregando metadatos a falsos grupos, o
  concluir ausencia de defecto con una sola captura grande. La auditoría exige
  tres viewports, fuente, rectángulos de hijos y dueño de capacidad.
- **Baseline de checks:** `5c6d82c1`; post-I7 no hay cambios rastreados y el
  único path ajeno es `docs/qa/prompt-goal-loop-calc-muestra.md` como `??`.
  I7 dejó 1 grupo declarado conforme y 7 candidatos sin declaración, sin issue
  geométrico demostrado.
- **Primera divergencia:** no nació en I7. El bundle contemporáneo de I1
  `prosecnur-visual-iter1-final-r3/radiografia/report.json` ya tenía 35 misses
  —los mismos siete por cinco viewports— y `ok=false`; I1 cerró citando solo el
  reporte vecino verde `marco/report.json` de Criterios del estudiante y
  generalizó el resultado a todo Marco. Ninguno de los cinco componentes ni el
  detector cambió entre `09fb8560` y este baseline. I7 hizo visible un hueco de
  integración del gate, no una regresión reciente del producto.
- **Clasificación 7/7 congelada:** son `MISS_REAL` la pareja de tarjetas
  `.cmv2-chfp-global-grid`, los dos pasos `.cmv2-crit-pasos`, los 17 acordeones
  `.cmv2-chfp-bloques` y las seis superficies `.cmv2-chfp-decision > section`.
  Son `NO_GRUPO` los dos `label` que envuelven inputs, los badges inline y la
  leyenda de condición. El detector sobreincluye esos tres porque solo excluye
  controles interactivos directos y firma cualquier par `tag + clases`.
- **Baseline visual:** el bundle `prosecnur-visual-iter8-c1` reproduce siete
  misses en cada uno de 1710×1107, 1280×800 y 390×844 (21 total), con tres
  grupos declarados, 0 issues geométricos/visuales, 0 scroll-jails, 0 overflow
  global y 0 errores. El probe 3×7 confirma los cuatro contratos `intrinsic`,
  últimos miembros alcanzables y 0 cortes/overflow/colisiones. El aparente
  solape móvil del header de facultad quedó falsado: 0/17 intersecciones y
  0/17 overflow en los tres viewports.
- **Contrato de reparación:** declarar únicamente cuatro grupos:
  `calc-muestra/criterios-ch-globales`,
  `calc-muestra/composicion-ch-pasos`, `calc-muestra/facultades-ch` y
  `calc-muestra/decision-ch-facultad`, todos `intrinsic`. Los pasos llevan
  miembro explícito y `capacity="owned"`; el grupo mixto de decisión audita solo
  sus `section` mediante miembros explícitos. El detector excluye un `label`
  únicamente cuando envuelve un control interactivo y excluye conjuntos de
  átomos `span` con display inline/inline-block/inline-flex sin descendientes
  estructurales; un `li` o una tarjeta con controles descendientes sigue siendo
  candidato. No se añade opt-out al markup ni se anota un falso grupo.
- **Delta exacto autorizado:** `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-geometry.test.mjs`,
  `frontend/src/features/calcMuestra/universidad/marco/CursosHorarioBaseGlobal.tsx`,
  `frontend/src/features/calcMuestra/universidad/criterios/CriterioComposicionCard.tsx`,
  `frontend/src/features/calcMuestra/universidad/marco/CursosHorarioMarcoTab.tsx`,
  `frontend/src/features/calcMuestra/universidad/marco/FacultadDecisionBloque.tsx`,
  `frontend/src/features/calcMuestra/universidad/marco/AulasFinalesCard.tsx`, una
  regresión nueva
  `frontend/src/features/calcMuestra/universidad/marco/__tests__/CursosHorarioGeometry.contract.test.ts`
  y este ledger. CSS permanece excluido porque la auditoría no encontró issue.
- **Guard rojo previsto:** el fixture del detector debe pasar de siete
  candidatos a cuatro sin ocultar un `li` con controles; hoy sobrecuenta tres.
  La regresión fuente debe exigir los cuatro nombres/contratos, ownership de
  los pasos y cuatro definiciones que producen seis `section` runtime; hoy no
  existe ninguna declaración.
  El baseline existente pasa 5/5 en el detector y 21/21 en cuatro tests de CH.
- **Guard rojo y reparación:** la regresión fuente falló 3/3 por cuatro
  fronteras ausentes, dos pasos sin ownership y cuatro definiciones de decisión
  sin membresía; el fixture del detector pasó 4/5 y devolvió siete candidatos
  frente a cuatro. La reparación añade solo metadatos C1 a los cinco componentes
  y corrige la inferencia general: `label` con control descendiente y grupos de
  átomos `span` inline no son superficies. Un veto contractual retiró de la
  prueba `capacity="owned"` para decisiones: sus 50 px son contenido + padding +
  borde, sin reserva; la ausencia física del atributo queda guardada.
- **Veto visual y segunda iteración interna:** el primer guard final midió
  15 grupos y 0 issues, pero dejó seis misses —badges y leyenda, dos por
  viewport— porque el navegador blockifica `inline-flex` a `flex` dentro de un
  padre flex. El fixture se corrigió para reproducirlo y volvió a rojo 4/5,
  seis candidatos frente a cuatro. El detector ahora reconoce esa blockification
  solo para `span` sin descendientes estructurales bajo padre flex/inline-flex;
  `article`, `li`, `section` y `span` grid siguen siendo candidatos. El detector
  vuelve a 5/5 y la regresión fuente a 3/3.
- **Veto contractual y tercera iteración interna:** la regla blockified todavía
  podía ocultar una tarjeta real `span` con `display:flex` e input bajo padre
  flex. El fixture incorporó ese quinto positivo y volvió a rojo 4/5 porque el
  detector devolvía cuatro frente a cinco. `isInlineSpanAtom` rechaza ahora
  cualquier descendiente interactivo además del estructural: la tarjeta flex
  permanece candidata y badges/leyenda siguen fuera. Detector 5/5; contrato
  final aprobado sin cambio público, ADR ni migración.
- **Guard visual final:** el bundle `prosecnur-visual-iter8-final-r3` pasa 3/3
  en 1710×1107, 1280×800 y 390×844, con 15 auditorías (5 por viewport), 0
  misses/issues/overflow/errores y badges, leyenda y controles presentes pero
  correctamente fuera de cobertura. El probe focal confirma 51/51 headers sin
  colisión/overflow y 12/12 últimos miembros alcanzables; URL, cabecera, foco y
  readiness pasan 3/3; el detector contractual conserva cinco positivos,
  incluido `span-flex+input`. SHA de copia/canónico permanece estable, proyecto
  `dirty=false`, 5188 cerrado y 8787/procesos ajenos intactos.
- **Validación escalada ejecutada:** detector 5/5, regresión fuente
  3/3, foco existente 21/21, suite frontend 342 archivos y 2.867/2.867,
  `typecheck`, bóveda 201/206 y `git diff --check` verdes; contrato final
  aprobado y guard r3 conforme. Gobernanza del árbol propuesto: 196/196
  documentos, 648 enlaces y 0 errores; verificador serial aprobado.
- **Resultado:** mejor. I7-O3 queda cerrado: cuatro colecciones reales tienen
  contrato y tres falsos grupos salen por semántica reproducible, no por opt-out.
  Radiografía de CH pasa de 1 grupo + 7 candidatos a 5 grupos por viewport y
  0 misses; el agregado queda 0 confirmados + 1 observación (I0-O2). F0, F2,
  D1 y D2 no cambian.
- **Siguiente acción:** iteración 9, F2/I0-O2 — medir capacidad exterior de
  Aulas y Salidas por rectángulo, contenido alcanzable y owner en tres viewports
  de escritorio antes de decidir si existe defecto o vacío legítimo.

### Contrato de iteración 9 (scope lock cerrado)

- **Categoría / fuente de verdad:** F2/I0-O2, gobernada por C3 (pertenencia),
  C4 (alcance) y la gramática local de layout. El vacío exterior de una página
  corta no es capacidad propia; sí lo es el espacio reservado dentro de un
  panel, tarjeta o miembro que declara/impone altura, crecimiento o stretch.
- **Pregunta causal congelada:** confirmar si la amplitud observada en Aulas y
  Salidas a escritorio grande pertenece al viewport después del último contenido
  —oportunidad de densidad, no defecto— o si algún componente posee capacidad
  interior injustificada, corta el recorrido o hace parecer incompleta la
  superficie. No se propone revamp antes de localizar el owner exacto.
- **Matriz de auditoría:** las seis pestañas vivas de Aulas (`objetivo`,
  `metodo`, `laboratorio`, `seleccion`, `reemplazos`, `auditoria`) y las cuatro
  de Salidas (`salidas-guia`, `salidas-resultados`, `salidas-entregables`,
  `salidas-monitoreo`) por dirección canónica en 1710×1107, 1440×1000 y
  1280×800: 30 celdas. Registrar panel/owner, primer y último contenido visible,
  rectángulos, `client/scroll` width/height, gaps interior/exterior, reglas
  `min-height`/height/flex/grid, scroll 0/medio/máximo, foco, readiness y C1–C5.
- **Criterio de clasificación:** `NO_DEFECT` si el último contenido termina
  antes del viewport sin caja que reclame el resto y toda la superficie es
  alcanzable; `DENSITY_OPPORTUNITY` si solo cabe más información sin violar
  pertenencia/capacidad; `CAPACITY_ISSUE` si un owner visible retiene vacío
  interior > tolerancia por height/min-height/grow/stretch sin propósito;
  `REACHABILITY_ISSUE` si contenido final no se alcanza, se corta o queda bajo
  otro owner. Solo los dos últimos promueven O2 a defecto.
- **Archivos previstos en la fase de auditoría:** únicamente este ledger. Los
  probes, reportes y capturas viven en un bundle temporal portable. Si aparece
  un defecto, se congela antes un delta exacto con componente/CSS dueño y una
  regresión roja; no se toca producto mientras la matriz esté abierta.
- **Peaje estructural:** trazar PageFrame→workbench→panel→último miembro y
  distinguir espacio exterior, capacidad del panel y capacidad de colección.
  Está prohibido reducir alturas globales, añadir scroll interno, llenar huecos
  con copy o mover datos solo para compactar una captura.
- **Exclusiones explícitas:** I7-O3 y navegación ya cerrados, F0/estadísticos y
  engine R, payloads, persistencia/.pulso, orden F3, D1/D2, CSS global,
  `aulasParts.tsx`, puerto 8787 y el prompt no rastreado del usuario.
- **Riesgo principal:** convertir un margen exterior legítimo en densidad
  artificial o medir solo el primer viewport y perder contenido inferior. Por
  eso cada celda registra owner, último contenido y posiciones de scroll.
- **Baseline de checks:** `53290ed1`; post-I8 no hay cambios rastreados y el
  único path ajeno es `docs/qa/prompt-goal-loop-calc-muestra.md` como `??`.
  O2 sigue siendo observación: no suma FAIL ni autoriza CSS todavía.
- **Validación mínima:** inventario 30/30 con rectángulos y owner falsables,
  evidencia visual comparable y clasificación por pestaña; C1–C5 y contadores
  duros, foco/readiness/URL, SHA/dirty y limpieza de procesos. Si hay reparación:
  regresión roja, foco afectado, suite/typecheck, bóveda, gobernanza propuesta,
  revisión contractual y `verificador` serial. Ledger/registro deben cerrar o
  promover O2 y programar I10 antes del commit.
- **Diagnóstico causal:** I0 no auditó capacidad de las diez pestañas. Sus dos
  defaults se fotografiaron después de solo dos RAF mientras seguía un stagger
  de hasta 240 ms: Aulas normal muestra 3/7 etapas y la captura inmediata
  `-full` 5/7; Salidas también gana contenido entre ambas. El cero geométrico
  de aquellos reports pertenecía a otro grupo. La vista histórica de Aulas fue
  retirada en I5 por duplicación metodológica, no por este supuesto hueco.
- **Peaje estructural pagado:** PageFrame y workbench llenan el shell; el owner
  C4 es `.cmv2-tab-panel` (`flex: 1`, `overflow: auto`). Sus hijos
  `.cmv2-aulas-stack` y `.cmv2-sal-stack` son grids intrínsecos con
  `align-content: start`, sin altura, crecimiento ni overflow. En runtime el
  borde de cada raíz coincide con su último hijo de flujo: 0 px de capacidad
  raíz y 0–1 px terminal en las 30 celdas.
- **Veto interno del instrumento focal:** el probe v1 produjo 18 falsos
  `CAPACITY_ISSUE` y 6 falsos `REACHABILITY_ISSUE` porque tomó descendientes de
  `details` cerrados fuera de la caja, exigió que una colección más alta que el
  viewport cupiera completa y llamó capacidad al padding hasta un nodo de texto.
  La v2 usa último hijo de flujo, borde inferior alcanzable y padding descontado;
  conserva el v1 como evidencia rechazada, no como resultado.
- **Evidencia visual final:** el bundle `prosecnur-visual-iter9-capacity`
  contiene `summary.md`, `matrix.md`, `report.json`, `capacity-report.json` y
  `guard-index.json`. Son 10/10 direcciones, 30/30 capturas y 45 grupos, con
  misses/issues/scroll-jails/overflow/errores en 0. La matriz causal queda
  25 `NO_DEFECT` + 5 `DENSITY_OPPORTUNITY` exteriores —Laboratorio 1710,
  Guía 1710/1440 y Resultados 1710/1440—, 0 `CAPACITY_ISSUE` y 0
  `REACHABILITY_ISSUE`; URL, foco, readiness, máximo de scroll y borde final
  pasan 30/30. SHA copia/canónico coincide, proyecto `dirty=false`, 5188 quedó
  cerrado y 8787/procesos ajenos no se tocaron.
- **Guard nuevo separado:** la explicación de O2 confirma I9-H9: el runner
  general puede inspeccionar/capturar un estado animado intermedio y considera
  visible `opacity: 0`. No se mezcla esa reparación transversal con el cierre
  documental de O2; I10 empieza por una regresión mínima del runner.
- **Validación antes del verificador:** foco funcional existente 17/17 y
  `git diff --check` verdes. La gobernanza literal del árbol reporta únicamente
  el prompt privado ajeno sin índice; el árbol propuesto sin ese `??` pasa
  196/196 documentos, 648 enlaces y 0 errores. El diff rastreado sigue limitado
  a este goal y el prompt no fue leído, editado, enlazado ni preparado.
- **Verificador serial:** `APPROVED`; recalculó 30/30, 25/5/0/0, gaps 0–1,
  navegación/alcance 30/30, guards 10/10 y 17/17 pruebas, confirmó SHA/limpieza,
  el único error literal externo y la coherencia ledger→cola→registro→I10.
- **Resultado:** mejor. I0-O2 queda cerrado como no defecto, la capacidad y el
  alcance pasan de sin denominador a 10/10 × 3 y no se acredita un revamp F2.
  El agregado cambia de 0 confirmados + 1 observación a 1 confirmado + 0
  observaciones por I9-H9. F0, D1 y D2 no cambian.
- **Siguiente acción:** iteración 10, guard transversal/I9-H9 — reproducir con
  un fixture `intrinsic` escalonado el estado intermedio de dos RAF y estabilizar
  `ui-quick-check` antes de inspección y screenshot, preservando la capacidad
  de auditar motion y sin convertir una espera abierta en flakiness.

### Contrato de iteración 10 (scope lock cerrado)

- **Categoría / fuente de verdad:** guard visual transversal/I9-H9. La captura
  y la inspección geométrica deben observar el mismo estado final determinista;
  readiness de la app y dos RAF no equivalen al fin de una animación CSS. El
  contrato público vigente de `ui-quick-check` y la semántica de Playwright
  controlan la estabilización; no el timing casual de una máquina.
- **Pregunta causal congelada:** demostrar con un fixture mínimo que una
  colección `intrinsic` escalonada puede seguir en su estado inicial después de
  dos RAF y que un nodo `opacity: 0` puede entrar hoy al conjunto visible. La
  reparación debe estabilizar antes de screenshot e inspección, o excluir lo
  realmente invisible, sin sleeps arbitrarios ni espera indefinida.
- **Archivos previstos:** `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-geometry.test.mjs` y este goal. La prueba posee
  el fixture; el runner posee la solución. Evidencia efímera, si hace falta,
  vive en una corrida temporal de I10.
- **Peaje estructural:** congelar una única función/límite de “vista asentada”
  reutilizada en la captura final; no dispersar esperas alrededor de navegación,
  clicks y screenshots. La detección de visibilidad debe considerar `details`
  cerrados y opacidad efectiva sin convertir elementos translúcidos en ausentes.
- **Exclusiones explícitas:** todo `frontend/src/**`, `api/**`, CSS y motion de
  producto, payloads/estadísticos/F0, proyectos `.pulso`, navegación, detectores
  C1 ajenos a visibilidad, D1/D2, puertos/procesos del usuario, publicación y el
  prompt privado no rastreado. No se añade un flag CLI ni se cambia una captura
  visual existente salvo que el contrato independiente pruebe que es necesario.
- **Riesgo principal:** obtener screenshots “verdes” desactivando más de lo que
  el inspector mide, ocultar una animación infinita legítima o introducir una
  espera flaky. El fixture exige estado final y consistencia captura→DOM; los
  tests existentes protegen geometría, scroll, terminales y candidatos.
- **Baseline de checks:** `5b98c087`; post-I9 solo queda
  `docs/qa/prompt-goal-loop-calc-muestra.md` como `??`. Antes de reparar se corre
  el test del detector existente y luego la nueva regresión debe fallar por el
  estado intermedio, no por timeout, puerto o matcher.
- **Validación mínima:** rojo/verde del fixture causal; suite completa de tests
  de `ui-quick-check`; `node --check`, help/CLI si el contrato cambia,
  `git diff --check`, gobernanza propuesta, revisión de contrato y
  `verificador` serial. I9-H9 solo cierra con evidencia de que captura e
  inspección ven el mismo estado asentado y el ledger programa I11.
- **Regresión causal:** el detector existente abrió con 5/5. El fixture nuevo,
  con stagger finito de 30/31/32 s, spinner infinito y ancestros con opacidad
  0/.35, falló 1 de 6 porque tres miembros seguían desplazados y el oculto se
  auditaba. Tras reparar pasa 6/6; el caso positivo conserva como hallazgo el
  overflow bajo `.35` y excluye únicamente su equivalente bajo opacidad 0.
- **Implementación y peaje estructural:** una sola función captura viewport y
  full-page con `animations: "disabled"`; ambas ocurren antes de `inspectDom`,
  por lo que Playwright lleva las animaciones finitas a su final sin esperar las
  infinitas. Un único predicado recorre ancestros y shadow host para excluir
  opacidad computada exactamente 0 tanto en overflow como en geometría; no se
  altera `prefers-reduced-motion` ni se añaden sleeps o flags.
- **Veto contractual pagado:** la primera revisión detectó que el predicado de
  opacidad solo gobernaba geometría y dejaba falsos overflow. Se movió al límite
  común y la regresión ganó dos controles equivalentes bajo ancestros 0/.35. La
  segunda revisión quedó `APPROVED`, sin bloqueos.
- **Gate final:** suite focal del runner 21/21, test del checker documental
  21/21, `node --check`, help y `git diff --check` verdes. El checker literal
  conserva 196/197 alcanzables y un único error —el prompt privado `??`—; el
  espejo del árbol propuesto pasa 196/196, 648 enlaces y 0 errores.
- **Verificador serial:** `APROBADO`; repitió 21/21 y los gates de sintaxis/CLI,
  confirmó orden screenshot→DOM, opacidad simétrica incluida a través de shadow
  host, alcance exacto de tres archivos y ausencia de stage. Confirmó también
  que I10 no acredita F1/F2 y que el prompt privado sigue fuera del diff.
- **Resultado:** mejor. I9-H9 queda cerrado y el runner gana un contrato
  reproducible para que captura e inspección compartan estado finito asentado.
  F1 permanece 0 componentes completos, F2 0/6 y `aulasParts.tsx` 1.612 líneas;
  D1=(a) y D2=(c), resueltas durante el cierre, no se implementan en este diff.
- **Siguiente acción:** iteración 11, F0/F1 — convertir
  `session_type × facultad` en el primer contrato estadístico completo desde el
  engine R: p10/p90, promedio elegible principal frente al total y delta
  marginal, con tests antes de que React formatee o publique esos datos.

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
