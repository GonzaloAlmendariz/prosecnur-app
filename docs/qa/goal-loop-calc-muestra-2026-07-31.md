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

> **Régimen vigente desde I15 (decisión de Gonzalo, 2026-08-01).** Las catorce
> primeras iteraciones se midieron y el resultado obligó a cambiar la mecánica:
> tres entregaron producto cero y cuatro menos de 50 líneas, todas con
> contratos de 110–169 líneas — hasta **7 líneas de contrato por línea de
> código**. El 73 % del producto salió en 2 de 13 commits. La ceremonia era de
> tamaño fijo y el producto no, así que una iteración de 20 líneas pagaba el
> mismo peaje que una de 2.879 y cada visita costaba de 2 a 4 horas. Eso no
> compraba seguridad: compraba lentitud, y ahogaba los mandatos 2 y 4.

Una iteración = **un lote entregable**, orquestado según la rama que toque:

1. **Lote mínimo.** Una iteración cubre una **sección completa**, una
   **capacidad nueva** o un **barrido de defectos afines**. Nunca un defecto
   suelto: los hallazgos chicos se acumulan y se cierran juntos bajo un solo
   contrato. Si el producto previsto no llega a una superficie entera, no es
   una iteración — es una entrada de la bandeja.
2. **Auditar es el paso 1, no una iteración.** `/ver-ui` con `hsvg2026` sobre
   la dirección canónica, matriz de viewports, `ui-quick-check` con
   `--require-geometry`; hallazgos con `archivo:línea`. Una visita que solo
   audita **no se registra como iteración ni se commitea sola**.
3. **Contrato proporcional al riesgo.**
   - Superficie (visual, informativo, layout): **contrato corto**, 10–15
     líneas — categoría, scope lock, riesgo principal, stopping rule. Basta.
   - Engine, datos, metodología o persistencia: contrato largo, con primera
     divergencia medida y revisión metodológica, como hasta ahora.
4. **Dos carriles con presupuesto propio.** Carril A = correctitud (F0, N9,
   engine, whitelist). Carril B = superficie y creatividad (mandatos 1, 2 y 4).
   **Ninguna iteración puede excluir el carril B por defecto**: si B queda
   fuera, se dice por qué y se agenda. El histórico de exclusiones fue lo que
   dejó el mandato 2 sin ejecutar durante catorce visitas.
5. **Pagar el peaje estructural.** Componente nuevo en archivo nuevo; lo tocado
   de un archivo grande se extrae primero. En un lote grande la extracción se
   hace **de entrada**, no como peaje por pestaña.
6. **Dejar guard.** `data-qa-geometry-group`, tokens, test de contrato del
   payload — la violación futura debe fallar sola.
7. **Gate proporcional, de verdad escalado.**
   - Superficie: typecheck + vitest del feature + `ui-quick-check` en
     `1440x1000` y `1024x600`. Sin cadena completa de revisión independiente.
   - Engine, datos o contrato público: lo anterior + testthat de los
     `test-calc_muestra*` afectados + **`verificador`** serial.
   - Regla heredada de `CLAUDE.md` que este loop había dejado de aplicar:
     **verificar de más también es deuda**.
   - Trampa medida: correr vitest con el dev server encendido produce falsos
     rojos — Vite y vitest comparten `node_modules/.vite`. Ante un rojo
     aislado, reproducirlo antes de diagnosticarlo.
8. **Registrar**: ledger actualizado y fila en el registro de iteraciones.
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
| Componentes de criterio con radiografía estadística propia | 1 (`BoxplotElegibles` vía `FacultadRadiografiaCard`) | 1 completa (`session_type`); el resumen legacy queda solo como fallback explícito para frames anteriores | ↑ hasta cubrir el selector |
| Estadísticos por criterio × facultad expuestos por el engine (cuantiles, media, mediana, promedio alumnos/CH) | 0 contratos | 1 contrato completo y probado para `session_type × facultad`: p10/p25/p50/p75/p90, media elegible principal, media total de contraste y denominadores estrictos | ↑ con test por estadístico |
| Criterios con impacto marginal (delta activar/desactivar) visible | 0 | 1 (`session_type × facultad`, acción y delta CH/matrículas firmados contra el marco ejecutado) | ↑ |
| Embudo por facultad (Carril 2) | en curso, sin cerrar | en curso; no cerrado | cerrar |
| Pestañas de Aulas repasadas por el revamp F2 | 0 de 7 | 0 de 6 vivas; la séptima era la dirección redundante retirada en I5 | ↑ a 6 |
| Pestañas de Aulas/Salidas con capacidad y alcance C3–C4 auditados | por medir; I0-O2 no tenía rectángulos propios | 10 de 10 × 3 viewports: 30/30 alcanzables, 0 problemas de capacidad; 5 oportunidades solo exteriores | = 100 %; no acredita revamp F2 |
| `aulasParts.tsx` | 1.612 | 1.551; la lista de riesgo salió a `ClassroomRiskList.tsx` y el handoff a `classroomHandoff.ts` | ↓ |
| Pestañas con hogar/orden justificado por la cadena metodológica (F3) | por auditar en iteración 0 | 24 de 24 históricas justificadas (100 %); cobertura viva 23 de 23 | = 100 % |
| Alias muertos que ya nadie escribe y pueden documentarse como históricos | 12 | 12 | = (no crecen sin porqué) |
| Declaraciones `data-qa-geometry-group` en el desk universitario | por medir en iteración 0 | 19 grupos conformes: I12 añade los owners `referencia-asistencia-fuente` y `referencia-asistencia-tau`; sus cuatro capturas finales tienen 0 misses/issues | ↑ con cobertura conforme |
| Navegaciones canónicas Marco/Aulas que aterrizan arriba tras forzar el owner origen | por medir; I0-O1 sin secuencia reproducible | 13 de 13 navegaciones nuevas + 1 de 1 POP en 1710×1107; reset desde primer frame y estable | = 100 % |
| Captura e inspección del runner sobre el mismo estado de motion finito | sin contrato; I9-H9 | 1 contrato probado: screenshot lleva finitas al final, DOM reutiliza ese estado y opacidad efectiva 0 queda fuera | = 100 % del caso causal |
| Eslabones de τ con ancla histórica publicada (asistencia · completitud · validez) | 0 de 3; τ es un escalar sin dato detrás | 3 de 3 publicados con dueño, `k`, IC y producto, sin escribir τ | = 3 |
| Referencia histórica de asistencia calibrable desde el desk | no existe | disponible desde Datos > Fuentes y visible en Cálculo > Diseño, con `k`, IC y degradación global solo para `k=1…11` | disponible, con `k` e intervalo por celda y degradación visible |
| Hallazgos abiertos del loop | 1 (N9 heredado) | 0 confirmados + 0 observaciones; I12-H11 queda cerrado en I13 y todos los hallazgos anteriores permanecen cerrados | = 0 |

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
| I11-H10 | F0/F1 | La radiografía parcial agrupa `aula_frame$session_type`/`faculty` modales, pero el selector y su gate usan las señales efectivas catálogo→fallback de `.cm_criterios_valores_aula`; el gráfico puede describir otra categoría/facultad | **cerrado I11**: el sibling v1 nace exclusivamente de `criterios$seleccion_aula$valores`, reconstruye el marco ejecutado antes de publicar deltas y React falla cerrado sin fabricar el contrato desde el bloque legacy. Engine, normalizador, UI, revisión metodológica/contractual y matriz visual quedaron verdes |
| I12-H11 | F2 / dimensionamiento | El sorteo real corre siempre con 30 aulas fijas: `selector$n_aulas` tiene default `30L`, no está en ninguna whitelist y el frontend nunca lo envía, así que el `aulas_base_total` que calcula el engine es decorativo | **cerrado I13**: el entero positivo engine-owned sobrevive la whitelist y se materializa según el escenario persistido —E1 usa P1/universidad y E2 usa P2/facultad, sin máximo ni fallback cruzado— hasta `selector$n_aulas`. Comparación, selección, reemplazos, historia y salidas validan target, frame y corrida propios; perder/cambiar escenario o target invalida el plan. M1 queda probado como `min(n_aulas, marco elegible)` sin truncar el target persistido |
| I12-H12 | F0 / supuesto | τ es un escalar sin dato detrás y su default contradice su propia definición: vale `0.7` en el engine y `0.53` en el espejo del frontend, pero el contrato lo declara «producto de asistencia × aceptación × validez histórica» | **cerrado I12**: la referencia histórica publica los tres eslabones y el producto 0.698 × 0.753 × 0.893 = **0.469**, con dueño, momento, `k`, IC, suficiencia y degradación explícitos; no escribe τ, no pega CH a CH y no combina marginales |

## Bandeja de decisiones (solo Gonzalo)

| # | Decisión | Opciones | Recomendación | Estado |
|---|---|---|---|---|
| D1 | N9: ¿qué instantánea de «CH elegibles» manda en Marco? | (a) manda el marco ejecutado y la exploración se rotula «exploración previa»; (b) manda la exploración; (c) ambas visibles con rótulo de momento | (a): el marco ejecutado es el que produce la muestra; la exploración es borrador | **resuelta por Gonzalo 2026-08-01: (a)** |
| D2 | Denominador del promedio de alumnos por CH en la radiografía | (a) CH elegibles bajo los criterios activos; (b) todos los CH del marco; (c) ambos, elegibles como cifra principal | (c): el contraste elegible/total es información de ponderación | **resuelta por Gonzalo 2026-08-01: (c)** |
| D3 | ¿Sobre qué marco corre la selección 2026? | (a) marco nuevo de DTI; (b) el 2025-2 ya cargado, donde los 194 CH del histórico empatan uno a uno; (c) sin definir | (a): es el supuesto robusto y degrada bien | **resuelta por Gonzalo 2026-08-01: (a)**. No habrá join CH a CH; solo transfiere el modelo por celda |
| D4 | ¿Cómo entra el histórico de aplicación a la app? | (a) fuente subible en Datos > Fuentes; (b) tabla de referencia versionada en el paquete; (c) ambas | (a): generaliza a 2027 y a otros clientes, y mantiene el dato de cliente fuera del repo | **resuelta por Gonzalo 2026-08-01: (a)**. En el `.pulso` se persiste solo la tabla agregada, sin PII ni filas por CH |
| D5 | ¿Qué se modela de la hoja de control? | (a) encuestas largas; (b) enviadas; (c) la asistencia como eje | (c) | **resuelta por Gonzalo 2026-08-01: (c)**. Se modela cuántos asisten el día de aplicación y, condicional a eso, cuántos completan; τ queda descompuesto en sus tres eslabones |
| D6 | Alcance de la primera entrega de la referencia | (a) solo publicar la referencia; (b) + corregir el divisor de la Cadena B; (c) + conectar `n_aulas` | (a): reversible y no mueve el presupuesto de campo | **resuelta por Gonzalo 2026-08-01: (a)**. No cambia el número de aulas |

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
| 11 | 2026-08-01 | F0/F1/I11-H10 | Se publicó desde R el sibling opcional `criterios_radiografia` sobre tipo y facultad efectivos, con cuantiles type 7, medias elegible/total, denominadores estrictos y contrafactual causal por categoría; React lo normaliza atómicamente y presenta dentro del embudo por facultad, con fallback legacy explícito | R 119 + 191 + 70 expectativas; normalizador contractual 41/41; Marco 12 archivos/113 tests; typecheck, diff-check, auditoría agentic y bóveda verdes; gobernanza propuesta 196/196 y 0 errores. Método, contrato y `verificador` serial aprobados. Matriz final `prosecnur-visual-iter11-radiografia-final-approved`: 3/3 PASS, 21 grupos, 0 issues/misses/overflow/scroll/errors; QA visual independiente C1–C5 aprobado | Componentes F1 0→1; contratos estadísticos 0→1; criterios con delta visible 0→1; I11-H10 cerrado; hallazgos 3→2. F2 sigue 0/6 y `aulasParts.tsx` permanece 1.612 |
| 12 | 2026-08-01 | F0/F4/I12-H12 | Se incorporó una fuente histórica opcional con engine R propio, contrato agregado y persistencia `.pulso` sin raw/PII; el endpoint publica estudio, reporte y referencia atómicamente; Datos muestra cobertura, cadena y celdas, y Cálculo contrasta τ sin escribirlo. `k=0` queda vacío, `k=1…11` publica global, `k=12…29` es delgada y `k≥30` sólida | Tres regresiones de arranque rojas y vetos de atomicidad, normalización, IC y rótulo `k=0` reparados con guard. Gate final: 10 archivos R/841 expectativas, feature 63 archivos/634 tests, typecheck, diff-check y auditoría agentic verdes; E2E HTTP/UI con la hoja real reproduce 194/192/190, cadena 0.698/0.753/0.893=0.469 y T1–T5; round-trip `.pulso` conserva solo agregado. Matriz visual 4/4 PASS, cero contadores duros; método, contrato y `verificador` serial aprobados | Anclas de τ 0→3; referencia de asistencia inexistente→disponible; geometría 17→19; I12-H12 cerrado y hallazgos 2→1. F2 sigue 0/6 y `aulasParts.tsx` permanece 1.612 |
| 13 | 2026-08-01 | F2/I12-H11, gobernada por F0 | Se conectó `aulas_base_total` desde el resultado R al workspace y a `selector$n_aulas` según el escenario persistido; E1/P1 y E2/P2 fallan cerrado sin actor, target o marco vigentes. Comparación, sorteo, reemplazos, historia, paquete de defensa y Salidas exigen artefactos propios de target/frame/run. El riesgo de aula salió del monolito a componente propio | Whitelist R 42 expectativas; `test-calc-muestra-aulas.R` completo y focal `M1=min(target, marco)` verdes; feature React 70 archivos/673 pruebas, focos 11/84 y corridas 16/16, typecheck, diff-check y auditoría agentic verdes. El primer verificador vetó una carrera del paquete; la promesa diferida quedó 1 roja/3 verdes → 4/4 y el feature volvió a 673/673; el segundo verificador aprobó el límite post-`await` sin ventana restante. Método y contrato aprobaron. QA real 14/14 en 1440×1000 y 1024×600: P2 4.157/4.989/268, scroll final alcanzable, 36 popovers y todos los contadores duros en 0; 8787 intacto | I12-H11 cerrado; hallazgos 1→0; `aulasParts.tsx` 1.612→1.551. F2 permanece 0/6 porque I13 corrige el handoff y sus guards, no completa un revamp de pestaña |

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

**Siguiente iteración programada:** **14 — F2/Aulas · Objetivo**, primera visita
completa del revamp a una de las seis pestañas vivas. Audita y pule por
dirección la jerarquía de Objetivo sobre el contrato de target ya congelado en
I13, sin recalcular cifras en React ni reabrir el handoff.

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

### Contrato de iteración 11 (scope lock cerrado)

- **Categoría / fuente de verdad:** F0/F1, rama de estadísticos nuevos. El dueño
  es el engine R y su `aula_frame` ejecutado; el grano es un curso-horario único
  × facultad efectiva × categoría `session_type`. `eligible_n` es alumnado
  elegible por CH, no matrícula administrativa. React solo normaliza y formatea.
- **Decisiones de dominio congeladas:** D1=(a): manda el marco ejecutado y toda
  exploración se rotula como previa. D2=(c): el promedio sobre CH elegibles es
  principal y el promedio sobre todos los CH del mismo tipo/facultad es el
  contraste. Ambos comparten grano, variable y semántica de NA.
- **Pregunta causal congelada:** localizar la salida del evaluador que permita
  calcular el contrafactual exacto de alternar una categoría de tipo de sesión
  manteniendo constantes todos los demás criterios. Está prohibido llamar
  “marginal” a `ch_total - ch_elegibles`: ese resto puede mezclar exclusiones de
  docente, nivel, sede, umbral, manuales u otros criterios.
- **Contrato objetivo:** para cada `session_type × facultad`, publicar desde R
  N de CH total/elegible, N de alumnado elegible, p10/p25/p50/p75/p90 `type=7`,
  media elegible principal, media total de contraste y el delta CH/alumnado de
  alternar esa categoría contra la selección ejecutada. El payload debe declarar
  schema, grano, owner y acción del delta, fallar honesto a NA y conservar los
  campos v1 que ya consumen proyectos anteriores.
- **Archivos previstos del engine:** nuevo
  `api/R/calc_muestra_aulas_criterio_radiografia.R`, integración mínima en
  `api/R/calc_muestra_aulas_exploracion.R` y regresión propia
  `api/tests/testthat/test-calc-muestra-criterio-radiografia.R`; el test hermano
  de exploración solo cambia si debe congelar la forma integrada. El diagnóstico
  autorizó un único cambio de cableado en `api/R/calc_muestra_aulas.R`: pasar
  `criterios` al adjuntador; no crece con lógica.
- **Archivos previstos de superficie:** `frontend/src/api/calcMuestra.ts`,
  `frontend/src/features/calcMuestra/universidad/marco/exploradorModel.ts`, su
  test, `FacultadRadiografiaCard.tsx`, `CursosHorarioMarcoTab.tsx`,
  `FacultadDecisionBloque.tsx`, `ExploradorAulasTab.tsx` y el componente nuevo
  `TipoSesionRadiografia.tsx` con test/CSS local si hace falta. Este goal es el
  único archivo compartido y lo posee el lead.
- **Peaje estructural:** contrato estadístico nuevo en archivo R propio; ningún
  cálculo de cuantiles, medias o deltas en TypeScript. Si la tabla de tipos gana
  más presentación, se extrae a un componente nuevo y
  `FacultadRadiografiaCard.tsx` no crece neto. C1–C5 se declaran en la nueva
  colección sin aumentar `aulasParts.tsx`.
- **Exclusiones explícitas:** otros criterios F1, revamp F2 y sus seis pestañas,
  `aulasParts.tsx`, orden F3, engine general congelado
  `api/R/calc_muestra_aulas.R` salvo el argumento autorizado del call-site,
  persistencia/proyectos `.pulso`, migraciones, CSS global, puertos/procesos del
  usuario, publicación y el prompt privado no rastreado. No se cambia un
  denominador para hacer cuadrar una captura.
- **Riesgo principal:** atribuir a `session_type` pérdidas causadas por otro
  gate, mezclar el borrador React con el frame ejecutado o convertir ausencia de
  datos en cero. El test debe incluir exclusiones solapadas y una categoría que
  cambia de acción según la selección efectiva por facultad.
- **Baseline de checks:** `dee04408`; después de I10 solo queda
  `docs/qa/prompt-goal-loop-calc-muestra.md` como `??`. Antes de escribir se
  corren los tests R de exploración/session-facultad y los tests TS del
  normalizador/modelo; los writers parten solo tras congelar schema y delta con
  diagnóstico, revisión metodológica y revisión de contrato.
- **Validación mínima:** rojo/verde testthat por estadístico y contrafactual;
  tests R hermanos, normalizador/modelo/componente en Vitest, typecheck, suite
  escalada al diff, `git diff --check`, gobernanza propuesta, revisión
  metodológica/contractual, `/ver-ui` por dirección canónica con `hsvg2026` y
  `verificador` serial. Cierra solo si el ledger pasa de 0 a 1 contrato F1
  completo y de 0 a 1 componente de criterio completo sin acreditar F2.
- **Baseline medido:** TS `exploradorModel` 32/32; R exploración 191/191 y
  session-facultad 70/70. El primer intento R fue bloqueado por `processx` en el
  sandbox y el mismo comando fuera de él quedó verde. En el estado anonimizado
  de `hsvg2026`, el owner trae 5.263 CH, 2.373 incluidos, 17 facultades y 11
  categorías del catálogo; el agrupador legacy mezcla categorías con valores
  modales ajenos. Esto confirma I11-H10 y el radio F0 del cambio.
- **Diagnóstico causal:** `criterios$seleccion_aula$valores` posee tipo y
  facultad efectivos; sus `pasos` conservan un flag por criterio y
  `criterios$flags` los gates previos. Las decisiones manuales completas viven
  en `out$particularidades$decisiones`. El contrafactual conjuga todos esos
  flags menos `session_type`, aplica el toggle solo a su set efectivo y exige
  que el resultado ejecutado reconstruido sea idéntico a
  `aula_frame$included`; si no, delta `NA`, nunca un resto agregado.
- **Contrato congelado:** sibling opcional
  `frame.criterios_radiografia` con schema
  `calc_muestra_aulas_criterios_radiografia_v1`, `owner`, `frame_hash`,
  `momento=marco_ejecutado`, grano efectivo y unidad CH única. Cada fila trae
  claves/labels de facultad y categoría, `n_ch_total`, `n_ch_elegibles`,
  `n_matriculas_elegibles`, p10/p25/p50/p75/p90 `type=7`, media elegible
  principal, media total de contraste y delta CH/matrículas firmado contra la
  selección ejecutada. React no reconstruye el sibling desde v1.
- **Semántica de acción:** el engine distingue `restringir_a_categoria`,
  `agregar_categoria`, `quitar_categoria`, `quitar_restriccion` y `no_aplica`.
  Un set efectivo vacío significa sin restricción, no “ninguna”: el último
  toggle puede agregar CH y jamás se rotula como simple desactivación. Tipos sin
  dato no son accionables. Una categoría real con 0 CH conserva su acción
  contrafactual y puede producir delta distinto de 0 al cruzar set
  vacío↔singleton; solo el bucket sintético de ausencia garantiza
  `no_aplica`, delta 0/0 y estadísticos `NA`.
- **NA e identidad:** `eligible_n` cuenta estudiantes únicos dentro de cada CH;
  su suma entre CH son matrículas/exposiciones elegibles, no personas únicas ni
  `enrolled_total`. Si cualquier CH del denominador carece de `eligible_n`, la
  suma/media/cuantiles correspondientes degradan a `NA`; el delta de matrículas
  también lo hace si cambia una fila sin dato.
- **Revisiones previas a escritura:** metodología `APPROVED` bajo los
  denominadores/NA anteriores; contrato `COMPATIBLE/APPROVED`, sin ADR ni
  migración porque el sibling es opcional, agregado, sin PII y proyectos viejos
  degradan a `null` hasta reconstruir. C1 usa grupo `intrinsic` propio; C4 exige
  alcanzar todas las métricas en 1024×600 sin tabla horizontal cortada.

- **Implementación ejecutada:** R publica
  `calc_muestra_aulas_criterios_radiografia_v1` desde los valores efectivos del
  evaluador, no desde las columnas modales de `aula_frame`. Por cada cruce
  completo tipo × facultad entrega N total/elegible, matrículas elegibles,
  p10/p25/p50/p75/p90 type 7, media elegible, media total y el toggle marginal
  firmado. La reconstrucción causal mantiene constantes los flags previos, los
  pasos distintos de `session_type` y las exclusiones manuales; si no reproduce
  exactamente `included`, degrada el delta a `NA`.
- **Contrato R→React:** el normalizador exige literales exactos de schema,
  owner, momento, grano y unidad; rechaza atómicamente cualquier fila inválida,
  claves duplicadas, denominadores incompletos o conteos no enteros. El `"NA"`
  que emite jsonlite se conserva como `null`; React solo une por clave, ordena y
  formatea. Frames anteriores muestran el resumen legacy rotulado, nunca una
  radiografía completa inventada.
- **Peaje estructural:** la lógica nueva quedó en
  `calc_muestra_aulas_criterio_radiografia.R`; el engine general solo pasa el
  argumento al adjuntador. La presentación vive en
  `TipoSesionRadiografia.tsx`/CSS/test propios;
  `FacultadRadiografiaCard.tsx` bajó a 205 líneas y `aulasParts.tsx` permanece
  en 1.612. El grupo C1 se declara en el wrapper de datos, no en la sección, y
  sus tarjetas conservan altura intrínseca sin stretch.
- **Validación ejecutada:** testthat 119/119 del contrato nuevo, 191/191 de
  exploración y 70/70 de session-facultad; normalizador contractual 41/41;
  Vitest de Marco 12 archivos/113 pruebas; `typecheck` y `git diff --check`
  verdes. El test incluye exclusiones solapadas, modo include/exclude,
  excepciones por facultad, NA estricto, colisión entre valor real «Sin dato» y
  bucket sintético, reconstrucción divergente y categoría real con 0 CH cuyo
  delta puede ser ±.
- **Límite del fixture y evidencia visual:** ADR 0043 impide reconstruir
  cuantitativamente `hsvg2026` desde su Excel embebido sin los originales. El
  intento de reconstrucción fue vetado: la anonimización dejó intersección 0
  entre 15 claves seleccionadas y 18 efectivas, por lo que produjo 0 estudiantes
  y 0/5.263 CH incluidos; sus deltas 0/0 no acreditan I11. La matriz válida usa
  una copia que conserva el frame canónico (5.263 CH, 2.373 incluidos, 17
  facultades) y siembra **solo para render** un sibling generado por el mismo
  engine sobre las 11 categorías del catálogo efectivo: 187 filas y 180 deltas
  no cero. Es evidencia de geometría/presentación, no de cifras metodológicas.
- **QA visual final:** dirección canónica
  `marco/marco-ch-radiografia`, control «Tipo de sesión» expandido y viewports
  1710×1107, 1366×768 y 1024×600. El bundle
  `prosecnur-visual-iter11-radiografia-final-approved/report.json`
  pasa 3/3, 21 grupos, 0 issues, 0 `geometryIssues`, 0 misses, 0 overflow,
  0 scroll jail y 0 errores de página/API/recursos/readiness. QA independiente
  aprobó C1–C5: 11 tarjetas en 4/3/2 columnas, owner/momento/grano/unidad,
  ambas medias, P10–P90, deltas y último contenido alcanzables. Un veto humano
  detectó y corrigió antes del bundle final el chip de procedencia comprimido
  en 1024.
- **Revisiones finales:** metodología `APPROVED` y contrato
  `COMPATIBLE/APPROVED`; ambas descartaron que el frame anonimizado degenerado
  fuera un defecto del algoritmo marginal. La auditoría agentic y la bóveda
  quedaron verdes; la gobernanza del árbol propuesto pasó 196/196 documentos,
  648 enlaces y 0 errores, mientras el árbol compartido conservó como único
  error el prompt privado ajeno no rastreado. El `verificador` serial aprobó
  los 15 archivos de I11, los reruns R/React, la matriz visual y la coherencia
  ledger→registro→I12. No hay decisión nueva en bandeja.
- **Resultado:** mejor. I11-H10 queda cerrado y F1 acredita su primer componente
  completo, su primer contrato estadístico y su primer delta marginal visible.
  F2 sigue 0/6: esta iteración no acredita el revamp de Aulas.
- **Siguiente acción:** iteración 12, F4 gobernada por F0 — ejecutar el contrato
  ya congelado de referencia histórica de asistencia, con D3–D6 resueltas y sin
  tocar τ, `n_aulas` ni el divisor de la Cadena B.

### Contrato de iteración 12 (scope lock cerrado)

I11 cerró limpia en `cf05c845`; I12 puede escribir en
`api/R/calc_muestra_aulas.R` y en `frontend/src/api/calcMuestra.ts` sin mezclar
las dos unidades.

- **Origen.** Gonzalo aportó la hoja «Base de control» de
  `Historico 2025/Hostigamiento PUCP 2025_BD Aulas Agendadas-6.xlsx` y pidió
  usarla como marco de referencia para la selección de aulas. La medición de esa
  hoja y las decisiones D3–D6 son el insumo de esta iteración.
- **Categoría / fuente de verdad:** F4 gobernada por F0. Es funcionalidad nueva
  para ponderar la decisión, y por eso debe cumplir las tres condiciones de F4:
  colgarse de una de las cinco dimensiones de navegación, declarar su Contrato
  de Superficie al construirse y pasar sus números por F0. La fuente de verdad
  es la hoja de control del estudio PUCP 2025: 194 CH agendados, 192 con status
  `APLICADA`, 190 con asistencia observada.
- **Fallo o cuello medido (I12-H12).** El motor trata los matriculados como si
  fueran la medida útil del aula. El único descuento operativo es el escalar
  `tau`, con default `0.7` (`calc_muestra_engine.R:176`) y `0.53` en el espejo
  del frontend (`universidad/shared/constants.ts:323`). El contrato ya declara
  que τ es «producto de asistencia × aceptación × validez histórica»
  (`calc_muestra_engine.R:2334-2338`), pero no hay dato detrás: el `0.7`
  equivale aproximadamente a la asistencia sola. La cadena real, sobre 190 CH y
  con denominador matriculados totales, es asistencia **0.698** (4.792/6.861) ×
  completitud **0.753** (3.610/4.792) × validez **0.893** (3.223/3.610) =
  **0.469**. La asistencia es el eslabón que más varía y el único que no puede
  conocerse sin histórico: su gradiente por tamaño de CH es monótono —0.826
  (<15) · 0.767 (15-24) · 0.769 (25-39) · 0.701 (40-59) · 0.609 (60+)— y por
  rango horario cae a 0.460 en «mañana especial» (k=9) frente a 0.719 en regular
  (k=162). Por facultad va de 0.614 a 0.858 con k entre 4 y 40. La desviación
  estándar intra-celda es ≈ **0.15** en todas: la predicción de un CH individual
  es muy incierta y el valor está en el agregado. La hoja es internamente
  consistente: `asistentes = enviadas + no_respondieron` se cumple 142/142.
- **Encuadre congelado (D5).** El dato es *post hoc*: no se conoce hasta
  aplicar, así que **no se pega CH a CH** a un marco futuro. Por D3 el marco
  2026 será nuevo, de modo que lo único que transfiere es el **modelo por
  celda**: dadas las características ex-ante de un CH —tamaño, rango horario,
  facultad, tipo de sesión—, estimar cuántos alumnos asistirían. Cualquier
  presentación que sugiera que la cifra es una medición del CH vigente incumple
  F0.
- **Peaje estructural.** La lógica vive en archivo nuevo
  `api/R/calc_muestra_asistencia_referencia.R`: `calc_muestra_aulas.R` pasa de
  4.600 líneas y la regla de archivos congelados prohíbe crecerlo con lógica. La
  referencia recibe **clave de sesión propia**,
  `calc_muestra_referencia_asistencia`, no un campo de `aulas_config`: es un
  artefacto derivado con dueño y schema propios, hermano de `frame`. Meterla en
  el workspace obligaría a tocar dos whitelists R más tres espejos TS y la haría
  entrar en `frame_hash`, invalidando el marco al calibrar —justo lo que D6
  prohíbe—. Las bandas de tamaño se definen aparte
  (`.cm_asist_banda_tamano`, T1..T5) porque `aula_frame$size_group` corta en
  20/30/40 sobre `eligible_n` (`calc_muestra_aulas.R:1257`) y es variable de
  estratificación del selector: reusarlo movería el sorteo.
- **Contrato congelado.** `calc_muestra_referencia_asistencia_v1`, siguiendo el
  rotulado de `calc_muestra_aulas_criterios_radiografia_v1` que congela I11:
  `owner = "estudio_historico_externo"`, `momento = "post_hoc_estudio_previo"`,
  `transferible = "modelo_por_celda"`, `modelo = "marginales_independientes"`,
  `combinable = false`, `unidad = "curso_horario_aplicado"`,
  `denominador = "matriculados_totales"`, más `estudio`, `cobertura`,
  `identidad`, `umbrales`, `cadena` (los tres eslabones y su producto, cada uno
  con `k` e IC), `global`, `dimensiones[]` y `advertencias[]`. Cada celda trae
  `celda_key`, `celda_label`, `orden`, `k`, `matriculados`, `asistentes`,
  `tasa`, `estimador`, `media_ch`, `sd_ch`, `ic_low`, `ic_high`, `metodo_ic`,
  `suficiencia`, `tasa_publicada`, `k_publicada` y `fuente_publicada`. Las
  cuatro dimensiones son marginales independientes y el contrato lo declara para
  que nadie las multiplique; la celda cruzada tamaño × facultad queda fuera.
- **Degradación (la cláusula que hace cumplir F0).** `k = 0` ⇒ `tasa` en `NA` y
  `suficiencia = "vacia"`; `k` de 1 a 11 ⇒ tasa observada rotulada, sin IC,
  `insuficiente`, publica el global; `k` de 12 a 29 ⇒ `delgada` con bootstrap;
  `k ≥ 30` ⇒ `solida`. Los umbrales salen de la dispersión medida: con
  sd ≈ 0.15, `SE ≈ 0.15/√k` da ±0.085 en k=12 y ±0.054 en k=30. Así «mañana
  especial» (k=9) y las facultades delgadas (k=4) degradan de forma **visible**
  al global en vez de publicar ruido como si fuera dato. El bootstrap remuestrea
  CH dentro de la celda y guarda/restaura `.Random.seed` con el patrón de
  `calc_muestra_perfil.R:189-201`, para no perturbar la semilla del sorteo.
- **Cómo entra la fuente (D4).** Rol nuevo `referencia_asistencia`. El
  clasificador `.cm_asist_sheet_role_hint()` se llama desde
  `.cm_aulas_sheet_role()` (`calc_muestra_aulas.R:529-559`) **después** de la
  rama `agenda` —cuyo `grepl` ya captura «aplicacion»— y **antes** de
  `base_madre`/`catalogo_curso_horario`, que hoy se la llevarían por
  `has_classroom && has_schedule`. Resuelve columnas con
  `.cm_criterios_col_exacta()`, nunca con el resolver fuzzy. El endpoint
  `POST /api/calc-muestra/asistencia/referencia` reusa
  `.cm_table_from_payload(sid, body, "referencia_asistencia")` sin modificar el
  helper —ya es genérico por clave, `router_calc_muestra.R:57-66`—, es router
  delgado y no toca ninguna clave del marco.
- **Tres correcciones al mapa, verificadas antes de congelar el scope:**
  `CalculoSupuestosTab.tsx` es superficie muerta —se exporta en
  `universidad/calculo/index.ts:5` pero `UniversidadDesk.tsx:512` solo monta
  `CalculoDisenoTab`—, así que el bloque aterriza en
  `CalculoDisenoTab.tsx:260-297`, en el `SupuestoFila id="rendimiento"` vivo;
  `ensureUniversitySourceBindings` dropea roles desconocidos
  (`categorias.ts:26`, hace `defaults.map`), gemelo frontend del gotcha
  whitelist-only, y exige su propia regresión roja; y el helper de tablas del
  router ya es genérico, no hay que extenderlo.
- **Archivos previstos.** Nuevos:
  `api/R/calc_muestra_asistencia_referencia.R`,
  `api/tests/testthat/test-calc-muestra-asistencia-referencia.R`,
  `api/tests/testthat/test-calc-muestra-asistencia-fuente.R`,
  `api/tests/testthat/test-http-contract-calc-muestra-asistencia.R`,
  `universidad/definicion/ReferenciaAsistenciaCard.tsx` con su CSS,
  `universidad/calculo/ReferenciaAsistenciaTau.tsx` y los dos Vitest. Backend
  modificado: `api/R/calc_muestra_aulas.R` (solo el clasificador de hoja y su
  `role_rank`; no crece con lógica), `api/R/router_calc_muestra.R` (endpoint y
  `.cm_state_payload`), `api/R/session_schema.R`, `api/R/errors_registry.R`,
  `api/R/project_pulso.R`, `api/R/session_store.R` (publicación multi-clave
  atómica). Frontend modificado:
  `frontend/src/api/calcMuestra.ts`, `universidad/shared/constants.ts`,
  `universidad/shared/categorias.ts`,
  `universidad/definicion/DefBasesTab.tsx`, `CalcMuestraPage.tsx`,
  `frontend/src/features/calcMuestra/calcMuestra.css`,
  `universidad/UniversidadDesk.tsx`,
  `universidad/definicion/DefEstudioTab.tsx`,
  `universidad/marco/MarcoConsistenciaTab.tsx`,
  `universidad/universidadTabs.ts`,
  `universidad/calculo/CalculoDisenoTab.tsx`. Este goal es el único archivo
  compartido y lo posee el lead. Los cuatro archivos adicionales de transporte
  y readiness entraron por el censo posterior descrito abajo; no agregan una
  superficie ni una regla metodológica.
- **Ampliación medida del scope frontend.** El rojo de whitelist exige que
  `ensureUniversitySourceBindings()` materialice siempre el binding opcional.
  El barrido de sus consumidores encontró cuatro gates que reducían cualquier
  `file_id` a «hay base»: el recorrido de `DefEstudioTab`, el rail en
  `universidadTabs`, la reconstrucción en `UniversidadDesk` y las tarjetas de
  relación en `MarcoConsistenciaTab`. La referencia histórica no es insumo del
  marco; por eso todos consumen un único filtro central
  `role != referencia_asistencia`. `UniversidadDesk` además es el passthrough
  mínimo de la clave top-level hacia Datos y Cálculo: evitarlo requeriría dos
  fetches o un contexto nuevo. La ampliación solo evita falsos verdes y no
  cambia ningún gate para las fuentes existentes.
- **Ampliaciones medidas durante el cierre.** El Excel real trae encabezado
  agrupado en dos filas, 40.578 filas físicas por formato contra 194 unidades
  materiales, `tipo_sesion` ausente y aliases históricos exactos; el engine
  promueve el encabezado, descarta solo colas completamente vacías y agrupa el
  tipo ausente como «Sin dato», sin fuzzy matching. La revisión contractual
  demostró que «subir archivo» + `PUT estudio` era una escritura partida: el
  endpoint ganó `workspace` opcional y `session_set_many()` publica estudio,
  reporte y referencia en una sola asignación, conservando el cliente v1 sin
  `workspace`. La primera revisión final vetó además publicaciones TS
  incompatibles con `k` y la ausencia del IC por celda; tres regresiones
  causales quedaron rojas y el normalizador ahora cruza conteos, tasas, cadena,
  intervalo, suficiencia y fuente publicada antes de exponer el bloque. C5
  muestra `IC 95%` para T1–T5 y «Sin IC» cuando `k < 12`.
- **Ampliaciones medidas por el guard real.** La matriz vacía detectó capacidad
  propia sin dueño en el estado vacío de τ y seis inputs file nativos de 18×14;
  se declaró la capacidad y se anuló borde/padding/margen nativos sin cambiar la
  interacción. La matriz poblada detectó lo mismo en la alerta de degradación.
  Finalmente la carga real reveló encabezados repetidos en la vista de columnas
  con claves React duplicadas; la identidad de render pasó a posición+texto.
  Cada hallazgo se reprodujo antes de reparar y volvió a cero en el mismo
  viewport/dirección.
- **Orden obligatorio de censos y whitelists, todo en el mismo commit.** Primero
  `session_schema.R` —o `test-session-schema` queda rojo entre pasos—, con la
  nota «solo tabla agregada calibrada (celda/k/tasa/IC); sin filas por CH ni
  PII». Después `errors_registry.R` con los tres `E_*`, antes de escribir sus
  `stop_api`. Luego engine y router; `project_pulso.R` con el strip defensivo;
  `.cm_state_payload()`, sin el cual el frontend nunca ve el bloque aunque
  persista; `calcMuestra.ts` con tipos, normalizador defensivo y función de API;
  `constants.ts` con el binding —**sin este paso el binding se borra en el
  próximo render**—; `categorias.ts` con labels, hojas esperadas y la exclusión
  de los gates de construcción; y al final el resto de UI.
- **Dónde aterriza, sin navegación nueva.** Cero pestañas y cero rutas nuevas.
  En **Datos > Fuentes** (`seccion=definicion&pestana=def-bases`) una tarjeta de
  carga opcional, separada de las obligatorias, que reusa `BaseUploadCard`; tras
  subir, la calibración es inmediata y la tarjeta publica estudio, cobertura, la
  cadena con sus tres eslabones y su `k`, y el resultado de la verificación de
  identidad. En **Cálculo > Diseño** (`seccion=calculo&pestana=calculo-diseno`),
  dentro del `visual` del `SupuestoFila id="rendimiento"` ya existente, τ
  descompuesto contra la referencia con su `k`, su intervalo y el rótulo de
  dueño. **Read-only**: no escribe τ, no agrega un tercer preset y no bloquea
  nada. El detalle por celda, si hiciera falta, va como overlay direccionable
  `panel=referencia-asistencia` con `usePanelDireccionable`, nunca `useState`
  suelto. Ambas superficies declaran `data-qa-geometry-group`
  (`calc-muestra/referencia-asistencia-fuente` y `.../-tau`) y contienen su
  propio vacío por C3.
- **Exclusiones explícitas.** El divisor de la Cadena B, la aplicación de la
  referencia a τ, `n_aulas` y el hallazgo I12-H11, la celda cruzada
  tamaño × facultad, un estimador público `calc_muestra_asistencia_estimar()`
  —que quedaría como código muerto—,
  `.cm_normalize_workspace_aulas_config`, `calc_muestra_aulas_normalize_config`,
  `DEFAULT_UNIVERSITY_AULAS_CONFIG`, `normalizeUniversityAulasConfig`,
  `frame_hash`, el sorteo y sus goldens, `aulasParts.tsx`, el contrato F1 de
  I11, los frentes F2 y F3, D1 y D2, puertos y procesos del usuario, la
  publicación y el prompt privado no rastreado.
- **PII y datos de cliente.** La hoja de 194 CH es dato de cliente y **no entra
  al repo** en ninguna forma. Los tests usan un fixture sintético calibrado a
  las tasas agregadas medidas. Lo único que se persiste en el `.pulso` es la
  tabla de celdas: sin `classroom_id`, sin nombres de docente, sin
  `unique_student_ids`, sin filas por CH. El engine nunca construye un bloque
  `filas`; la tabla cruda vive en el file store de la sesión y muere ahí.
- **Riesgo principal.** Publicar como dato duro una celda de k=4, o que la
  iteración siguiente aplique la tasa sobre `eligible_n` en vez de
  `enrolled_total` y subestime ~30 %. Contra lo primero, la matriz de
  degradación y la `sd_ch` publicada en cada celda; contra lo segundo, el campo
  `denominador` en el contrato y un test que lo fija. Riesgos secundarios: que
  el clasificador secuestre la hoja hacia `agenda` o `catalogo_curso_horario`
  (orden de ramas fijado por test, con no-regresión para ambas); que el binding
  nuevo entre a `readyToBuild` y bloquee «Construir marco» (exclusión explícita
  más test de que ese gate no cambia); que el bootstrap mueva `.Random.seed` y
  rompa los goldens del sorteo (scoping con test de invariancia); y que las
  etiquetas de facultad no sean comparables entre 2025 y el marco nuevo
  (normalización con `.cm_criterios_fac_key()` y advertencia cuando el marco
  vigente tenga facultades ausentes de la referencia).
- **Baseline de checks.** El árbol debe estar limpio tras el cierre de I11.
  Antes de reparar deben quedar en rojo, verificadas, las tres regresiones
  causales: (1) `"calc_muestra_referencia_asistencia"` no está en
  `session_schema()$clave`; (2) una hoja con
  `curso_horario / matriculados / asistieron / enviadas` clasifica hoy como
  `catalogo_curso_horario` —o `agenda` si el nombre contiene «aplicación»—,
  nunca como `referencia_asistencia`, y el test documenta cuál rama la
  secuestra; (3) `ensureUniversitySourceBindings("base_madre", [...rol
  nuevo...])` devuelve hoy un array sin ese binding, demostrando la pérdida
  silenciosa.
- **Arranque medido.** En la rama `codex/goal-loop-calculo-muestra`, el test R
  nuevo falla solo en dos aserciones: la clave no existe en `session_schema()`
  y «Base de control» cae como `catalogo_curso_horario`; el Vitest nuevo falla
  solo porque `ensureUniversitySourceBindings` elimina
  `referencia_asistencia`. Son 3/3 rojos causales, sin datos de cliente ni
  fallos incidentales. En ese punto I12 permanecía activa y el ledger aún no se
  movía.
- **Validación mínima.** Sobre el fixture sintético: la cadena reproduce
  0.698 / 0.753 / 0.893 con producto 0.469 (tolerancia 0.002); monotonía T1..T5;
  una celda k=9 da `suficiencia == "insuficiente"`,
  `fuente_publicada == "global"`, `ic_low` en `NA` y tasa observada presente;
  una celda k=0 da `tasa` en `NA_real_` y **no** 0; un `matriculados` faltante
  deja la celda entera en `NA` por suma estricta; una fila que rompe la
  identidad deja `identidad$verificada == FALSE` sin error; dos llamadas dan IC
  idénticos y `.Random.seed` global queda igual; columnas ausentes producen
  `stop_api` con el mensaje que lista lo encontrado. Del lado de la fuente:
  clasificador en verde con no-regresión de agenda y catálogo, round-trip sin
  `filas` ni PII, y un `.pulso` viejo sin la clave que carga con `NULL`. Se
  amplía `test-calc-muestra-workspace-whitelist.R` con un binding del rol nuevo
  que sobrevive el round-trip. Vitest: el normalizador falla cerrado ante schema
  desconocido y un `null` de jsonlite no se vuelve `0`; ambas tarjetas declaran
  su grupo geométrico literal, contienen su vacío y rotulan la degradación
  cuando `fuente_publicada !== "celda"`. Gate escalado: `typecheck`, Vitest del
  feature, los `test-calc-muestra-asistencia-*` más
  `test-calc-muestra-workspace-whitelist`, `test-session-schema` y
  `test-calc-muestra-aulas`, `ui-quick-check --require-geometry` sobre las dos
  superficies, `node agentic/sync-agentic-os.mjs --audit`, revisión metodológica
  y de contrato, y `verificador` serial.
- **Verificación end-to-end, la que importa.** Con la app abierta sobre el
  proyecto real, subir la hoja en Datos > Fuentes y comprobar en pantalla que la
  cadena reproduce 0.698 / 0.753 / 0.893, que el gradiente por tamaño baja de
  0.826 a 0.609 y que «mañana especial» aparece degradada a global por k=9.
- **Orden de ejecución.** Serial y bloqueante: las tres regresiones rojas, luego
  censo y registro de errores, luego el engine, que es el nudo del que dependen
  router y frontend. Desde ahí, tres carriles con globs sin solape: backend
  (router, `.cm_state_payload`, `project_pulso`, los dos tests R y la ampliación
  del whitelist test); frontend de datos (tipos, normalizador, API, constants,
  categorias, `DefBasesTab`, la tarjeta); y frontend de cálculo (el bloque de τ
  y su montaje, que solo depende del tipo TS del carril anterior). Serial al
  cierre: integración end-to-end, gate, QA visual y ledger. Máximo tres
  trabajadores y dos writers.
- **Historia causal y peaje estructural.** Los tres rojos de arranque quedaron
  verdes sin cargar datos de cliente al repo. La lógica estadística vive en
  `calc_muestra_asistencia_referencia.R`; `calc_muestra_aulas.R` solo ganó la
  clasificación/orden del rol y `aulasParts.tsx` permanece en 1.612 líneas. La
  publicación multi-clave es atómica y el normalizador React falla cerrado ante
  conteos, cadena, IC, suficiencia o fuente incoherentes. Dos vetos finales
  ganaron regresión literal: `sin_publicacion` ya no puede ocultar un global
  publicable y una celda `k=0` no se rotula como degradada al global.
- **E2E con la fuente real, sin persistirla.** En API aislada, la subida y el
  POST con workspace produjeron 194 agendados, 192 aplicados, 190 observados,
  identidad 142/142 y cadena 0.69844046 × 0.75333890 × 0.89279778 =
  0.46975660; directo, estado y estudio quedaron iguales. En dirección canónica
  sobre una copia aislada de `hsvg2026`, la UI mostró T1–T5 con k
  14/39/56/47/34 e IC, y «mañana especial» k=9 publicó el global. El round-trip
  `.pulso` conservó schema y 190 observados, sin filas, raw ni PII. Los puertos
  aislados se cerraron y el 8787 no se tocó.
- **Gate escalado.** Diez archivos R suman 841 expectativas verdes; el feature
  React pasa 63 archivos/634 pruebas y `tsc -b`; `git diff --check` y
  `node agentic/sync-agentic-os.mjs --audit` pasan con 0 huérfanos y 0 rutas
  rotas. Las matrices pobladas de Datos y Cálculo pasan 4/4 capturas en
  1440×1000 y 1024×600, con 0 issues, misses, overflow, scroll jail o errores.
  La revisión contractual aprobó los cinco casos de publicación y la revisión
  metodológica aprobó grano, denominadores, identidad, bootstrap, umbrales y la
  separación vacío/degradación. El `verificador` serial repitió 10/10 archivos
  R, 63/63 archivos y 634/634 pruebas React, typecheck, diff-check y auditoría;
  aprobó el diff, la persistencia, los guards y la coherencia ledger→I13.
- **Resultado:** mejor. I12-H12 queda cerrado; el ledger pasa de 0 a
  3 anclas de τ, de referencia inexistente a disponible, de 17 a 19 owners
  geométricos y de 2 a 1 hallazgos. No se acredita F2, no se escribe τ ni
  `n_aulas`, y no hay decisión nueva en bandeja.
- **Siguiente acción.** Iteración 13, F2/I12-H11 — medir por dirección qué aulas
  sortea realmente el motor frente a las que calcula, conectar `n_aulas` con su
  whitelist y su espejo TS, y recién entonces evaluar si el divisor de la
  Cadena B debe pasar de matriculados a asistentes esperados, con D6 reabierta
  de forma explícita.

### Contrato de iteración 13 (scope lock cerrado)

I12 cerró en `b2a5f538`; I13 se desarrolló en
`codex/goal-loop-calculo-muestra`. Los cambios ajenos del catálogo visual y el
prompt privado quedaron explícitamente fuera de su stage y commit.

- **Categoría / fuente de verdad:** F2/I12-H11, gobernada por F0. El número de
  cursos-horario titulares nace en el engine R como `resultado$aulas_base_total`
  y el selector debe consumir exactamente ese resultado materializado como
  `selector$n_aulas`; React puede transportar/elegir entre resultados ya
  publicados, pero no recalcular el tamaño.
- **Fallo causal medido.** `calc_muestra_aulas_default_config()` fija
  `selector$n_aulas = 30L` y todos los engines de selección consumen esa clave.
  Sin embargo `.cm_normalize_workspace_aulas_config(list(n_aulas = 47L))`
  devuelve un workspace sin `n_aulas`, mientras
  `calc_muestra_aulas_normalize_config(list(n_aulas = 47L))$selector$n_aulas`
  sí devuelve 47. El frontend expone y muestra `aulas_base_total`, pero su tipo
  de workspace no declara `n_aulas` y las acciones envían `model.config` tal
  cual. La primera divergencia observable es, por tanto, el handoff/whitelist,
  no el algoritmo de sorteo. La reproducción completa sobre la misma copia de
  `hsvg2026` da `aulas_base_total = 163/478`, config 30 y M1=30 sobre 5.263 CH.
- **Scope lock.** Producto candidato:
  `api/R/calc_muestra_engine.R` (whitelist),
  `frontend/src/api/calcMuestra.ts` (tipo),
  `universidad/shared/study.ts` (normalización/handoff puro),
  `CalcMuestraPage.tsx` (materialización post-cálculo) y
  `universidad/aulas/aulasParts.tsx` solo si puede conservar exactamente 1.612
  líneas. Tests candidatos: `test-calc-muestra-workspace-whitelist.R` y
  Vitest hermanos de `study`/modelo Aulas. Este goal sigue siendo del lead.
- **Exclusiones explícitas.** Fórmula y divisor de la Cadena B, τ y la
  referencia I12, algoritmos/goldens del sorteo, `frame_hash`, revamp visual
  completo de las seis pestañas, migración `.pulso`, datos reales, outputs,
  procesos/puertos del usuario y el prompt privado.
- **Riesgo principal.** Materializar una cifra stale o escoger sin contrato
  entre las propuestas universidad/facultad, haciendo que la UI muestre un
  objetivo y M1 sortee otro. Sin resultado vigente no se fabrica una nueva
  cifra; el fallback 30 queda únicamente para clientes legacy del engine.
- **Validación mínima / stopping rule.** Regresión R de round-trip; regresión
  TS del resultado→workspace→payload; focal de selección que pruebe M1 igual a
  `min(n_aulas, marco)`; feature React, typecheck, dirección canónica y
  `verificador` serial. I13 solo cierra cuando el objetivo engine-owned
  sobrevive guardar/reabrir y llega idéntico a compare/select, sin cambiar el
  cálculo estadístico ni hacer crecer `aulasParts.tsx`.
- **Orquestación.** Descubrimiento paralelo de backend y frontend, ambos de
  solo lectura y con globs disjuntos. El carril metodológico se ejecutará en
  serie al liberar un hilo (`FALLBACK: sequential (agent thread limit)`). No
  hay writers hasta congelar cuál propuesta gobierna el selector y dejar las
  regresiones rojas.
- **Diagnóstico integrado.** Backend localizó la primera pérdida en la
  whitelist de `.cm_normalize_workspace_aulas_config()`: una configuración
  explícita de 38 llega a M1=38, mientras el mismo valor tras el round-trip
  desaparece y cae a 30; sync y worker job repiten la misma divergencia. El
  frontend confirmó que el `useState` P1/P2 local duplica una decisión que ya
  existe y se persiste como `motor_recorrido.decisiones.escenario`, y que el
  eco `aulasState.config` hoy pisa al workspace en las acciones. El máximo
  163/478 que se usa para mostrar no representa una elección de campo.
- **Contrato metodológico congelado (revisión: `APPROVE`).** Opción (b):
  `e1`/P1 elige el `resultado$aulas_base_total` de
  `estudiantes_universidad`; `e2`/P2 elige el de
  `estudiantes_facultad`. Ese entero positivo se materializa sin recalcularlo
  como `aulas_config$n_aulas` y llega idéntico a `selector$n_aulas`. Nunca se
  toma el máximo entre propuestas. `cursosHorarioFinal` queda como
  confirmación operativa separada: contiene extras y nace de una derivación
  React, por lo que jamás alimenta M1 titular. Cambiar de propuesta invalida
  la confirmación previa y deja stale cualquier comparación/selección hecha
  con el target anterior. Si el escenario elegido no tiene resultado completo,
  si el marco está stale o si la cifra es inválida, no hay fallback a la otra
  propuesta: comparar/seleccionar queda bloqueado. La ausencia de resultado
  elimina una cifra stale del workspace; no materializa 30. El 30 queda solo
  como fallback interno de clientes legacy del selector y M1 conserva
  `min(n_aulas, marco elegible)` sin recortar el target persistido.
  No hace falta una decisión nueva de Gonzalo: el goal ya congeló al engine R
  como dueño y el dominio persistido ya distingue E1/E2; D6 acotó I12, no
  veta este handoff de I13.
- **Regresión causal y reparación.** La whitelist abrió con tres fallos
  (`47 → NULL → 30`) y React con 4/4 rojos: elegía eco 7/máximo 29 en vez de
  P1=13, no tenía selector E1/E2 e ignoraba la invalidez de la confirmación al
  cambiar escenario. El workspace preserva ahora solo enteros positivos; los
  resultados real y demo publican su target en `selector`, y el handoff central
  materializa o elimina `n_aulas` según el actor exacto del escenario.
- **Delta medido de alcance.** La auditoría de consumidores encontró que no
  bastaba con el puente inicial: comparación, selección, reemplazos, historial,
  resumen, distribución, salud, sidebar, recuperación y paquete de defensa
  podían acreditar ecos de otro escenario o artefactos stale. Todos consumen
  ahora el componente seleccionado y firman target, `frame_hash` y corrida
  propia. La propuesta P2 llega a Cálculo, Aulas y Salidas sin fallback P1.
- **Invalidación fail-closed.** Cambiar escenario, recalcular, perder el actor o
  reconciliar un target distinto elimina el plan confirmado. Método y Selección
  bloquean acciones sin marco/target vigentes; historia no conserva una selección
  sin corrida; el paquete vuelve a comprobar sus firmas entre reporte, export y
  memoria, y aborta si el estado cambia durante la operación.
- **Peaje estructural.** `ClassroomRiskList.tsx` y `classroomHandoff.ts` poseen
  la lógica extraída; `aulasParts.tsx` baja 1.612 → 1.551 líneas. El frontend no
  calcula el target ni modifica la fórmula: R conserva `aulas_base_total` y M1
  usa `min(n_aulas, marco elegible)` sin truncar la configuración persistida.
- **Veto del primer verificador y reparación.** El gate reprodujo una carrera:
  `leerContextoPaquete()` capturaba E2 antes de esperar el refresco y podía
  publicar su memoria aunque el store ya hubiera cambiado a E1. La regresión
  con promesa diferida abrió 1 roja/3 verdes. El límite async refresca ahora
  Aulas primero, relee estudio/workspace después del `await` y usa un ref para
  el fallback local; E2 remoto + E1 local produce fingerprint nulo. La focal
  cierra 4/4 y no se bloquean controles para simular consistencia.
- **Gate escalado.** Whitelist R 42 expectativas; test completo de Aulas y
  focal literal `m1-min-target-ok`; focos React 11 archivos/84 pruebas,
  corridas 16/16 y feature completo 70 archivos/673 pruebas; `tsc -b`,
  `git diff --check` y auditoría agentic verdes. Las revisiones metodológica y
  contractual terminaron `APPROVE`; el segundo `verificador` levantó el veto
  tras repetir focal 4/4, typecheck y diff-check. Sin decisión nueva de Gonzalo.
- **QA real.** Matriz congelada 14/14 PASS en 1440×1000 y 1024×600. La copia
  `hsvg2026` persistió P2 con objetivo 4.157, sobremuestra 4.989 y 268
  cursos-horario. Método, Selección y Salidas rechazaron artefactos anteriores;
  cuatro superficies llegaron literalmente de scrollTop 0 a su final. En 36
  popovers y las siete direcciones hubo 0 issues, misses, overflow, scroll jail
  y errores de consola, página, API, recursos, proyecto o readiness. El stack
  aislado 5174/8788 quedó cerrado y el 8787 no se tocó.
- **Resultado:** mejor. I12-H11 queda cerrado; los hallazgos pasan 1 → 0 y
  `aulasParts.tsx` 1.612 → 1.551. F2 sigue 0/6: el handoff y sus guards son el
  piso del revamp, no acreditan por sí solos una pestaña repasada.
- **Siguiente acción.** Iteración 14, F2/Aulas · Objetivo — primera visita
  completa del revamp a una pestaña viva, con baseline por dirección en ambos
  viewports y el contrato engine-owned de I13 congelado.

### Contrato de iteración 14 (scope lock activo, auditoría)

- **Categoría / fuente de verdad:** F2/Aulas · Objetivo, gobernada por F0 y por
  el handoff cerrado en I13. El objetivo publicado es el entero positivo del
  actor seleccionado por el escenario; React puede explicar y formatear esa
  cifra, nunca recalcularla ni reemplazarla con extras operativos.
- **Dirección y medición:**
  `calc-muestra/opinion-universitaria/aulas/objetivo` sobre `hsvg2026` en
  1440×1000 y 1024×600, entrando por dirección canónica y aterrizando arriba.
  La auditoría registra jerarquía, orden de lectura, comparación P1/P2, target
  vigente, cadena hasta Método, inspector/rail, owner de scroll, C1–C5 y último
  contenido alcanzable. El baseline final de I13 es la referencia previa.
- **Cambio enfocado previsto:** completar el revamp visual e informativo de
  `AulasObjetivoTab.tsx` con la gramática local de Aulas, haciendo inequívocos
  escenario, cifra titular, sobremuestra y procedencia antes de pasar a Método.
  Cualquier pieza extraíble nace en archivo propio; la tab y el rail conservan
  su dirección e identidad.
- **Archivos previstos:**
  `frontend/src/features/calcMuestra/universidad/aulas/AulasObjetivoTab.tsx`,
  `frontend/src/features/calcMuestra/universidad/aulas/aulas.css`, componentes
  presentacionales nuevos bajo `universidad/aulas/`, sus Vitest focales y este
  goal. Los helpers compartidos de solo lectura se incorporan únicamente si la
  auditoría demuestra que ya son dueños del estado mostrado.
- **Exclusiones explícitas:** las otras cinco pestañas vivas, fórmulas y engine
  R, selector/sorteo, target/handoff I13, persistencia `.pulso`, navegación y
  aliases, CSS global, datos reales, outputs, puertos/procesos del usuario,
  catálogo visual ajeno y el prompt privado.
- **Peaje estructural:** `aulasParts.tsx` no puede crecer sobre 1.551 líneas;
  cualquier fragmento que Objetivo todavía consuma desde allí se extrae antes
  de ampliarlo. No se crea navegación paralela ni un estado de escenario local.
- **Riesgo principal:** que el pulido visual vuelva a mezclar P1/P2, presente
  sobremuestra o extras como target titular, o esconda el estado stale que I13
  hizo fallar cerrado. El guard debe probar procedencia y actor además de
  geometría.
- **Validación mínima / stopping rule:** baseline y final con `/ver-ui` y
  `ui-quick-check --require-geometry` en ambos viewports; Vitest focal y feature,
  typecheck, diff-check, Contrato de Superficie, revisión independiente y
  `verificador` serial. I14 solo acredita 1/6 cuando Objetivo complete C1–C5,
  mantenga el target R intacto, reduzca o conserve 1.551 líneas y el ledger se
  actualice. Estado actual: auditoría activa, sin cambios de producto I14.
- **Superada por I15.** Su auditoría se conserva como insumo; su alcance de una
  pestaña queda absorbido por el lote de la sección completa.

### Contrato de iteración 15 (lote — primera bajo el régimen nuevo)

- **Categoría:** F2/Aulas, carril B (superficie), mandato 2. Lote = **las seis
  pestañas vivas**, no una.
- **Baseline medido (2026-08-01, `hsvg2026-i12-populated`, 1440×1000).**
  Recorrido por dirección canónica sobre las seis:
  - `objetivo`: columna `EST./CURSO-HORARIO` entera en `—`; `RESERVAS` repite
    `R1-R11` en las 14 filas; `EXTRA` todo `0`; Muestra objetivo y Sobremuestra
    en «falta calcular» pese a haber cuotas por facultad.
  - `metodo`: cuatro cards con «fórmula» como único affordance; el peso de la
    pantalla está en párrafos explicativos, no en métricas comparables.
  - `laboratorio`, `seleccion`, `reemplazos`: **las tres en estado
    «pendiente»**, con tarjetas que repiten el mismo botón y media pantalla
    vacía. Ninguna muestra datos porque no hay selección ejecutada — tampoco en
    el `.pulso` llamado «poblado».
  - `auditoria`: la única con densidad real (fórmulas, semilla, reproducibilidad).
  - Estructura: `aulasParts.tsx` 1.551 líneas, `aulas.css` 1.679 líneas.
- **Scope lock.** `universidad/aulas/**` (las seis tabs, componentes nuevos en
  archivo propio, `aulas.css`) y sus Vitest focales. Fuera: engine R, fórmulas,
  selector/sorteo, target/handoff de I13, navegación y aliases, persistencia
  `.pulso`, datos reales, la unidad ajena del catálogo visual y el prompt privado.
- **Peaje estructural, de entrada.** `aulasParts.tsx` se descompone **antes** de
  tocar las pestañas, no como peaje por cada una. Ninguna tab crece sobre el
  monolito.
- **Estado de prueba requerido.** Cuatro de las seis pestañas solo son
  juzgables con selección ejecutada: sembrarla con
  `make reference-project-seed-aulas REFERENCE_PROJECT=hsvg2026` y auditar el
  par **vacío / lleno** (C2 y C5 exigen ambos).
- **Riesgo principal.** Que el revamp maquille los estados «pendiente» en vez
  de resolver qué informa cada pestaña cuando no hay selección — convertir C3
  en decoración. El vacío se clasifica, no se rellena.
- **Stopping rule.** I15 cierra cuando las seis cumplan C1–C5 en ambos
  viewports con estado vacío y lleno, `aulasParts.tsx` haya bajado de 1.551
  líneas, y el gate de superficie esté verde. Sin `verificador` serial salvo
  que el lote termine tocando engine o contrato público.

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
