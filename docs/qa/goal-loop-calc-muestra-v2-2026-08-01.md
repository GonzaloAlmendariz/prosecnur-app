# GOAL v2 — Cálculo de muestra: el módulo decide con evidencia y se entiende solo

Tipo: Goal operativo de producto + QA
Estado: En curso
Fecha: 2026-08-01
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado del módulo

**Estado:** loop permanente en curso. **Solo Gonzalo lo cierra.** Ninguna
iteración lo termina; cada iteración lo deja más cerca.

**Sucesión:** este doc sucede a `goal-loop-calc-muestra-2026-07-31.md`, que
queda como **archivo histórico** (I0–I15 cerradas allí con su evidencia; la
mecánica vieja de contratos de tamaño fijo está superada). La numeración de
iteraciones **continúa**: la primera iteración de este doc es la **16**, que
este loop hereda activa. **La referencia de calidad es I15**: un lote de
sección completa, contrato corto, evidencia proporcional. **El rumbo de
producto vive en `Obsidian_Prosecnur/Boceto_Calculo_de_Aulas_v2.canvas`**
(elaborado con Gonzalo el 2026-08-01); este doc lo operacionaliza.

## Objetivo

> El desk universitario de Cálculo de muestra (modo `opinion-universitaria`,
> secciones Datos → Marco → Cálculo → Aulas → Salidas) debe cumplir dos cosas
> a la vez: que el académico **pondere cada decisión con evidencia estadística
> a la vista** (todo criterio con su radiografía, todo valor con su dueño), y
> que **cualquier superficie se entienda sin haber diseñado el motor** — los
> métodos se narran, la selección se ve completa, cada curso-horario tiene un
> código que se puede decir en voz alta.
>
> Regla madre intacta: **primero el dato, después el gráfico, después el
> brillo.** Nunca se decora una cifra que no está reconciliada.

## Herencia — entregado en el loop v1, no se vuelve a pedir

| Qué | Dónde quedó |
|---|---|
| N9 cerrado: `aula_frame.included` es el dueño único del conteo ejecutado; la exploración se rotula previa (D1) | I1 |
| Radiografía `session_type × facultad` con cuantiles, medias elegible/total, denominadores estrictos y delta contrafactual, todo desde R | I11 |
| Referencia histórica de asistencia en Datos > Fuentes; τ descompuesto en 3 eslabones (0.698 × 0.753 × 0.893 = 0.469) con `k`, IC y degradación | I12 |
| `n_aulas` conectado al escenario persistido (E1/P1, E2/P2), falla cerrado sin vigencia | I13 |
| Aulas 6/6 renovadas como lote; estados vacíos honestos (el vacío nombra la pieza que falta y dirige); `selectionReady` intacto | I15 |
| `aulasParts.tsx` 1.612 → 51 líneas; 11 dueños extraídos | I15 |
| Orden de pestañas 24/24 justificado por la cadena metodológica | I2–I8 |
| Decisiones D1–D9 resueltas por Gonzalo (ver bandeja) | v1 + 2026-08-01 |

## Mandatos vigentes (Gonzalo, 2026-08-01)

**M1 — Cerrar la consola analítica de criterios (hereda I16, activa).**
El barrido de los 14 gates restantes bajo el contrato I11: 13 tarjetas
(11 de catálogo + mínimo + composición), 15 gates contando c7/c8/c8_facultad.
Todo estadístico nace en R con test (`calc_muestra_aulas_criterio_radiografia.R`);
la consola (`CriteriosRadiografiaConsola.tsx`) presenta dato → distribución →
impacto → acción. El scope lock congelado de I16 vive en el doc histórico y
sigue vigente tal cual. No se cierra por criterio: es un solo lote.

**M2 — La Selección se entiende sola (lote «Selección legible», F2/F4).**
El revamp I15 dejó las seis pestañas vivas y honestas, pero la sección sigue
siendo difícil de leer. Un solo lote de sección con cuatro capacidades:

1. **Métodos narrados.** Hoy Método cae de frente a 4 tarjetas comparativas y
   no se entiende qué hace cada método. Invertir la jerarquía: el recomendado
   primero con su porqué en una frase; cada método contado como historia
   visual (mini-demo animada: el sistemático salta la recta con paso k, el
   cube balancea facultad/sexo/tamaño, el pivotal separa vecinos parecidos,
   el pool sortea 500 candidatos y se queda el mejor); el comparador vive como
   **bloque colapsado al final** (D9), nunca como estado inicial.
2. **Descuento secuencial visible.** `sequential_discount`
   (`api/R/calc_muestra_aulas_descuento.R`) **ya existe** y está ON por
   defecto desde la UI: sortea CH por CH y descuenta a los alumnos ya
   cubiertos del peso de los siguientes. La UI lo muestra como paso del sorteo
   con su narrativa — los datos ya existen (`aporte_neto`, `ya_cubiertos`,
   `discount_step`). Matiz obligatorio: muerde **en el sorteo** con
   sistemático/estratificado/pool y solo **anota post-hoc** con cube/pivotal
   (no rompe su calibración). Deuda menor: el default del engine sigue OFF
   por goldens; alinear y documentar.
3. **Código operativo canónico `CH n` / `R n.k`** con sufijo explícito desde
   el primer reemplazo (D8): titular `CH 5`, reemplazos `R 5.1`, `R 5.2`,
   `R 5.3`. El engine ya emite `AULA 5` / `R5.1`; falta el espacio, **un solo
   helper compartido** (hoy el re-etiquetado `AULA→CH` está duplicado en 4
   archivos: `classroomLabels.ts`, `aulaInspectorModel.ts`,
   `ClassroomReplacementPanels.tsx`, `didactica/CadenasReemplazoVisual.tsx`) y
   presencia en toda superficie: tablas, inspector, cadenas, simulación,
   exports y pase a Monitoreo. Divergencia consciente con territorial (`R 12`
   sin sufijo): aulas no la copia.
4. **El mapa de la muestra.** Hoy no existe vista global de la selección: las
   cadenas cortan en 24 titulares × 6 slots y el único gráfico es un SVG de 8
   burbujas en grilla fija. Se construye la **matriz completa titulares ×
   reemplazos**, agrupada por facultad, sin truncar (virtualizada): cada fila
   `CH n` con su cadena `R n.1 → R n.2 → …`, color por nivel de equivalencia
   (misma celda / celda equivalente / misma facultad), profundidad de reserva
   de un vistazo, clic → inspector. Es el plano de UMPs de territorial,
   versión aulas.

**M3 — Marco decide (lote «Marco decide», F1/F3).**
El detalle viene de los nodos de Marco/Criterios del boceto v1 y es
**vinculante** (integrado explícitamente por indicación de Gonzalo,
2026-08-01): I16 entregó el contrato de datos; este lote entrega la
experiencia al nivel que el v1 exige — **el apartado más sólido de la app**.

- **La vara del v1, explícita:**
  - **Todos los criterios son por facultad.** Ninguna radiografía se queda en
    el agregado global: cada criterio muestra su corte por facultad (small
    multiples / strip), y el total es la suma visible de las facultades.
  - **Boxplot y media son el núcleo visual** — el patrón `BoxplotElegibles`
    generalizado a todas las tarjetas — con libertad creativa para más,
    siempre después del dato. Dinámico y animado sin sustituir cifras.
  - **Detalle total, no parcial**: CH elegibles, alumnos por CH (la
    distribución completa, no solo el promedio) y N de alumnos, por criterio ×
    facultad. El contrato I16 ya publica los seis estadísticos; aquí se
    presentan completos.
- **Matriz embudo facultad × criterio** (la foto): una fila por facultad +
  fila total, una columna por criterio; muestra cómo cada recorte lleva del N
  bruto a los CH elegibles y cómo suma al total. Se construye **sobre** el
  contrato M1 (los deltas contrafactuales son sus celdas), nunca aparte.
  Cierra el Carril 2 heredado.
- **Embudo vivo, la cascada dinámica** (la película): el v1 lo pide literal —
  para cada facultad, ver el **filtro dinámico que se va aplicando criterio a
  criterio** y cómo cambia los CH elegibles del siguiente. Al enfocar o
  activar un criterio, los conteos aguas abajo se recalculan a la vista, en el
  orden real de recorte, que debe ser visible.
- **Ancla histórica dentro de cada criterio**: la tasa de
  rendimiento/asistencia agregada **por facultad y característica común**
  (nunca por CH — D3 prohíbe el join CH a CH) se muestra junto al criterio,
  con `k` e IC del patrón I12. Matching 2025↔2025 exacto; si la celda 2026 no
  calza al 100 %, **se usa lo disponible** con degradación rotulada (celda más
  cercana o global), jamás en silencio.
- **Pestaña «Alumnos por CH»** después de Criterios: decide el valor de
  alumnos/CH por facultad (media, mediana, p25 u otro robusto — se elige con
  las distribuciones de M1 a la vista); Cálculo (CH requeridos) y Selección
  (Objetivo) la **consumen sin recalcular**. El poder de decisión vive aquí.
  D2 ya fijó el contraste elegible/total.
- **Mudanza Consistencia → Datos** (D7, revierte I2): mudanza única con rigor
  F3 — alias para la dirección publicada `marco/def-consistencia`,
  justificación escrita, regresiones de navegación actualizadas, bóveda
  renumerada.

**Mejoras adicionales propuestas para Marco/Criterios (creatividad gobernada;
F0 las gatea; entran en este lote si no lo diluyen, o a la cola 20+):**
hover-delta contrafactual antes de activar un criterio (el dato ya existe en
el contrato I16); semáforo de cobertura de señal por tarjeta
(`n_con_dato`/`n_total` — un criterio con señal incompleta se degrada honesto,
no desaparece); orden de recorte declarado y sensible (qué pasa si dos
criterios se aplican en otro orden); comparador de escenarios de criterios
(set A vs set B, por facultad); export de la radiografía como respaldo de
defensa metodológica.

**M4 — Cálculo consume (lote «Cálculo», F4).**
Renombrar «Cursos-horario por facultad» → **«Cursos-horario requeridos»** (la
decisión vive en Marco) y densificar Distribución (población × muestra por
unidad × sexo): bandas de precisión, sensibilidad de parámetros — densidad
informativa sin ruido.

**Fuera de este loop:** el export Monitoreo → Excel histórico (formato que
Datos > Fuentes consume, para que 2026 alimente 2027) se ejecuta cuando toque
el módulo Monitoreo; queda anotado aquí solo como destino.

## Invariante

**Ninguna iteración publica un número nuevo sin dueño validado, y ninguna
iteración deja un archivo del módulo más grande que como lo encontró cuando el
trabajo era extraíble.** Cada iteración deja al menos una fila del ledger
estrictamente mejor; igualar no cierra la iteración. F0 sigue siendo gate
transversal: si aparece una cifra sin reconciliar en la superficie a tocar, se
atiende primero en esa misma visita.

**Invariante añadida el 2026-08-02 (raíz de los ocho hallazgos abiertos): una
fila del ledger solo cierra si la capacidad se ve en el proyecto de referencia
abierto tal cual está.** I16, I18, I18b e I19 acreditaron 4 filas sobre
artefactos reconstruidos y anonimizados —declarados como tales en el registro—
y ninguna de las cuatro se sostiene al abrir
`api/inst/reference_projects/hsvg2026/hsvg2026.pulso`. Un artefacto
reconstruido sirve para medir rendimiento o probar un contrato; no acredita una
capacidad. Si la capacidad exige un estado que el proyecto de referencia no
tiene, el trabajo incluye llevarlo a ese estado o el lote no cierra.

## Mecánica de cada iteración (régimen nativo, heredado de I15)

Una iteración = **un lote entregable**: una sección completa, una capacidad
nueva o un barrido de defectos afines. Nunca un defecto suelto; los hallazgos
chicos se acumulan y cierran juntos.

1. **Auditar es el paso 1, no una iteración.** `/ver-ui` con `hsvg2026` sobre
   la dirección canónica, `ui-quick-check --require-geometry`, hallazgos con
   `archivo:línea`. Una visita que solo audita no se registra ni se commitea
   sola.
2. **Contrato proporcional al riesgo.** Superficie: 10–15 líneas (categoría,
   scope lock, riesgo principal, stopping rule). Engine, datos, metodología o
   persistencia: contrato largo con primera divergencia medida y revisión
   metodológica.
3. **Dos carriles con presupuesto propio.** Carril A = correctitud (F0,
   engine, whitelists). Carril B = superficie y claridad (M2–M4). Ninguna
   iteración excluye el carril B por defecto; si queda fuera, se dice por qué
   y se agenda.
4. **Peaje estructural de entrada.** Componente nuevo en archivo nuevo; lo
   tocado de un archivo grande se extrae primero, no como peaje por pestaña.
5. **Dejar guard.** `data-qa-geometry-group`, tokens, test de contrato del
   payload — la violación futura debe fallar sola.
6. **Gate proporcional, de verdad escalado.** Superficie: typecheck + vitest
   del feature + `ui-quick-check` en 1440×1000 y 1024×600. Engine/dato/
   contrato público: lo anterior + testthat de los `test-calc_muestra*`
   afectados + `verificador` serial. Verificar de más también es deuda.
7. **Registrar:** ledger y registro de iteraciones actualizados en este doc.
   **El estado vive aquí, no en la conversación.**

**Regla de no-bloqueo:** el loop nunca se detiene esperando una decisión. Lo
que exija criterio de Gonzalo va a la bandeja con opciones y recomendación, y
el loop sigue con lo desbloqueado. Máximo una decisión nueva presentada por
iteración; si la bandeja pasa de tres, se presentan juntas.

## Cola de lotes

| # | Lote | Mandato | Estado |
|---|---|---|---|
| 16 | Consola analítica de criterios (14 gates restantes) | M1 | **cerrada** — 15/15 gates bajo un contrato R→React único |
| 17 | «Selección legible» (métodos narrados + descuento visible + código `CH n`/`R n.k` + mapa de la muestra) | M2 | **cerrada** — 4/4 capacidades, contrato R→React fail-closed |
| 18 | «Marco decide» — núcleo ya congelado (matriz marginal + «Alumnos por CH» + mudanza Consistencia→Datos) | M3 | **cerrada** — foto marginal R-owned, decisión firmada consumida por Cálculo/Selección y D7 ejecutada; D10(b) provisional quedó supersedida el 2026-08-02 |
| 18b | «Marco decide» — vara v1 vinculante (distribución por facultad + embudo vivo + ancla histórica por criterio) | M3 | **cerrada** — 13/13 tarjetas y 15/15 gates, Total R-owned, cascada viva y ancla histórica honesta |
| 19 | «Cálculo» (renombre + Distribución densa) | M4 | **cerrada** — nombre canónico y lectura R-owned de población, cuota, precisión y sensibilidad |
| 20 | «P1 frente a P2» (alcance estadístico + carga operativa) | libertad gobernada F0/F4 | **suspendida tras implementación** — el revisor contractual vetó aritmética recreada en React e integridad insuficiente; se conserva el diff y se retoma después del gate F0/F1 |
| 21 | «Marco recuperable» (orden canónico + detección de frame legado + radiografía por facultad visible + **marco con elegibles, exclusiones justificadas y cifras reconciliadas**) | M3/F0/F1 | **activa; corte UI cerrado, carril A de motor pendiente** — el frame legado ya no finge vigencia, el orden es canónico y CH integra criterio × facultad × dato × decisión; el rebuild del proyecto de referencia todavía deja 0 elegibles de 136.284 filas |
| 21b | «Construir el marco no congela la app» (job `callr` + progreso real + sello honesto) | regla de la casa (jobs) | **candidata inmediata** — la ruta corre síncrona en el hilo único y bloqueó la app >9 min |
| 22 | «Consistencia autónoma» (pestaña propia después de Fuentes) | D10 | **en cola inmediata** — decisión cerrada por Gonzalo; ejecución completa de navegación/aliases/QA |
| 23+ | Libertad creativa gobernada: lo que la evidencia pida (simulador «qué pasa si», comparador de criterios, export de radiografía), colgado de las cinco dimensiones y gateado por F0 | — | abierto |

El orden 17→18→19 es el decidido en el boceto v2. Un hallazgo de correctitud
(carril A) puede intercalarse como barrido, nunca desordenar los lotes sin
anotarlo aquí.

## Ledger

| Métrica | Apertura (2026-08-01) | Hoy | Dirección |
|---|---:|---:|---|
| Gates analíticos de criterios con contrato R probado (M1) | 1 de 15 (`session_type`, I11) | **15 de 15** | = 15 |
| Capacidades del lote «Selección legible» (M2) | 0 de 4 | **4 de 4** | = 4 en un solo lote |
| Helper único de código operativo (`CH n` / `R n.k`) | re-etiquetado duplicado en 4 archivos | **1 helper compartido, 0 duplicados** | 1 helper compartido, 0 duplicados |
| Titulares visibles en la vista de cadenas sin truncar | 24 de 175 (slots ≤ 6 de 11) | **175 de 175** (virtualizado; profundidad 11) | 175 de 175 |
| Default de `sequential_discount` alineado engine↔UI y documentado | divergente (engine OFF, UI ON) | **alineado ON**; OFF legacy queda explícito en goldens | alineado con porqué escrito |
| Matriz embudo facultad × criterio (M3) | no existe | **existe** sobre M1; facultades dinámicas + Total recalculado por R | existe sobre el contrato M1 |
| Tarjetas de criterio presentadas por facultad con boxplot+media (vara v1) | **0 de 13 tarjetas / 0 de 15 gates** | **13 de 13 / 15 de 15**; inventario dinámico y Total recalculado por R | 13/13 tarjetas y 15/15 gates; inventario dinámico |
| Embudo vivo: cascada por facultad al enfocar/activar criterios, con orden de recorte visible | no existe | **existe**; preview no persistente y reconciliación por facultad + Total R | existe |
| Ancla histórica dentro de cada criterio (facultad × característica común, `k`/IC, degradación rotulada) | no existe | **existe**; matching directo, dimensiones de facultad explícitas y degradación honesta | existe, sin join CH a CH |
| Pestaña «Alumnos por CH» (M3) | no existe | **existe**; decisión por facultad firmada y consumida por R en Cálculo/Selección sin recalcular | existe y Cálculo/Selección la consumen sin recalcular |
| Hogar final de Consistencia en Datos (D7/D10) | pendiente | **provisional dentro de Fuentes**; D10 final exige separarla | pestaña propia inmediatamente después de Fuentes, con aliases y regresiones |
| Renombre «CH requeridos» + Distribución densa (M4) | pendiente | **hecho**; P1/P2 reconciliados, precisión y sensibilidad R-owned, CH con frame vigente | hecho |
| Comparador P1↔P2 de alcance estadístico + carga operativa (I20) | no existe; el selector oculta el otro escenario | pendiente | ambos diseños comparables sin memorizar ni recalcular en React |
| Recuperación de marcos persistidos anteriores al contrato F1 | no medida | **1 de 1** en `HSVG2026.pulso`: capacidad ausente reconocida, recuperación única y CTA explícito; la copia reconstruida conserva v2 y 17 facultades | = 1; sin migración ni guardado silencioso |
| Orden inicial de Marco | Criterios → Criterios CH → Alumnos/CH | **correcto** en catálogo, desk, direcciones y tests: Criterios del estudiante → Alumnos por CH → Criterios de curso-horario | = orden canónico |
| Unidad CH facultad → criterio → dato → decisión | consola F1 global antes de las facultades; selector separado del detalle | **8 de 8 tarjetas CH dentro de cada facultad**; 10 cifras R-owned visibles por segmento, detalle completo abrible y matriz transversal colapsada al final | = una unidad operable, sin consola preliminar |
| Elegibles tras reconstruir el marco del proyecto de referencia | 21.365 en el frame guardado | **0** de 29.083; `excluded_rows=136284` de `input_rows=136284` | elegibles > 0 y reconciliados con el frame anterior o con la razón del cambio |
| Exclusiones del marco que declaran su causa | no medida | **0 de 136.284** (`exclude_reason` vacío en todas) | 136.284 de 136.284 |
| Cifras del mismo concepto que divergen en una pantalla | 0 declaradas | **2**: CH elegibles `0` vs. `5.263` en Marco; «alumnos» `13.498/38.749` vs. `21.365/29.090` en Cobertura | 0, o denominador rotulado |
| Construcción del marco fuera del hilo único, con progreso real | no; síncrona | **no**; >9 min de app bloqueada, banner sin progreso, sello «al día» durante toda la corrida | job `callr` con progreso y cancelación |
| Facultades legibles en el fixture canónico (instrumento de QA) | no medida | **0**; el anonimizador las renombró como personas («Andres», «Elena Diego») | nombres de unidad académica propios, acreditables «por facultad» |
| Filas del ledger acreditadas sobre el `.pulso` de referencia abierto tal cual | no exigido | **0 de 4** en I16/I18/I18b/I19 (todas sobre reconstrucción anonimizada declarada) | toda fila nueva se acredita sobre el proyecto abierto |
| Hallazgos abiertos del loop | 0 | **8** (carril A de motor en I21: A1 elegibles, A2 razones, A3/A7 cifras divergentes, A6 vacío de Alumnos/CH; I21b bloqueo del hilo; instrumento de QA anonimizado; veto contractual I20; D10 final I22) | = 0 |
| Archivos del módulo que crecieron estando extraíbles | 0 | 0 | = 0 |

## Bandeja de decisiones (solo Gonzalo)

Vacía al abrir. Resueltas que este loop hereda y aplica:

| # | Decisión | Resolución (Gonzalo, 2026-08-01) |
|---|---|---|
| D1 | Instantánea que manda en Marco | El marco ejecutado; la exploración se rotula previa |
| D2 | Denominador del promedio alumnos/CH | Ambos: elegibles como cifra principal, total como contraste |
| D3 | Marco de la selección 2026 | Marco nuevo de DTI; sin join CH a CH, solo modelo por celda |
| D4 | Entrada del histórico | Fuente subible en Datos > Fuentes; solo agregado en el `.pulso`, sin PII |
| D5 | Qué se modela de la hoja de control | La asistencia como eje; τ descompuesto en 3 eslabones |
| D6 | Alcance de la primera referencia | Solo publicar; no cambia el número de aulas |
| D7 | Hogar de Consistencia | Se muda a Datos (revierte I2); mudanza única con rigor F3 |
| D8 | Código de reemplazos | Sufijo explícito: `R 5.1`, `R 5.2`, `R 5.3` |
| D9 | Comparador de métodos | Bloque colapsado al final de Método; decidir es el default |
| D10 | Hogar final de Consistencia | **Pestaña propia de Datos, inmediatamente después de Fuentes**. Sustituye la integración provisional dentro de Fuentes ejecutada en I18. |

No quedan decisiones abiertas. D10 fue resuelta por Gonzalo el 2026-08-02;
su ejecución vive en I22; el gate F0/F1 de I21 se intercaló delante porque
`HSVG2026.pulso` demostró que un frame legado podía parecer vigente sin la
radiografía por facultad exigida por M3.

## Auditoría de contraste con el boceto v2 (2026-08-02, medida en la app)

Corrida sobre el fixture canónico `api/inst/reference_projects/hsvg2026/hsvg2026.pulso`
(copia de trabajo), backend R propio recién arrancado con el código de hoy
(puerto 8801) y Vite propio (5180), 1440×1000. Se descartó la trampa 1: el
backend del árbol llevaba 18 h vivo contra ficheros R modificados hasta las
04:09 de hoy, y los hallazgos se reprodujeron igual con backend fresco.

| # | Hallazgo medido | Evidencia literal | Contradice |
|---|---|---|---|
| A1 | Reconstruir el marco del proyecto canónico con el motor de hoy deja **0 elegibles**: `eligible_student_rows=0`, `population_n=0`, `classroom_included_n=0`, `excluded_rows=136284` sobre `input_rows=136284`. El frame previo tenía 21.365/2.373. | `/api/calc-muestra/state` → `aulas.frame.audit` | F0 y el objetivo del módulo: el marco deja de existir |
| A2 | Las 136.284 exclusiones viajan con `exclude_reason: ""`. El motor excluye a todos y no puede decir por qué. | `aulas.frame.exclusions[1..n]` | «El vacío no miente» (I15-H13) |
| A3 | La misma pantalla publica dos cifras del mismo concepto: KPI `CURSOS-HORARIO ELEGIBLES 0` junto al aviso «marco construido: 0 de 29.083 estudiantes únicos elegibles y **5.263** cursos-horario elegibles». | Marco → Cursos-horario: criterios + radiografía, tras reconstruir | F0 / la historia N9 «que no se repite» |
| A4 | Antes de reconstruir, el proyecto canónico acredita **0 de 13 tarjetas en `Radiografía v2`**: 5/5 de estudiante en `Sin dato` y 8/8 de CH en 4 `Sin dato` + 4 `Resumen legacy` — con el sello verde «El marco está al día con los criterios confirmados». | selector «Enfocar criterio» de ambas pestañas | ledger «13 de 13 tarjetas / 15 de 15 gates» |
| A5 | `POST /api/calc-muestra/marco/construir` corre **síncrono en el hilo único de Plumber** (sin `job_submit`), bloqueó la app **más de 9 minutos** con un banner sin progreso ni tiempo, y durante todo ese rato el sello siguió diciendo «al día». | `api/R/router_calc_muestra.R:571`; medición por sondeo | regla de la casa sobre jobs pesados; C5 |
| A6 | «Alumnos por CH» sobre el estado canónico entrega una sola línea («Reconstruye el marco…») y deja ~60 % del viewport vacío. | Marco → Alumnos por CH, 1280×720 | C3 (la superficie contiene su propio vacío) |
| A7 | Cobertura publica «34,8 % · 13.498 / 38.749» bajo el rótulo «Alumnos por facultad», con la cabecera marcando 21.365 elegibles sobre 29.090. Tres denominadores distintos para «alumnos» en una pantalla. | Marco → Cobertura | F0 |
| A8 | Instrumento de QA: en el fixture canónico las **facultades se llaman «Andres», «Elena Diego», «Ricardo Ricardo Gabriela»** — el anonimizador sustituyó el nombre de facultad por nombres de persona. La radiografía por facultad no es legible en el único proyecto donde se puede QA a escala. | Cobertura y agrupación de `FacultadRadiografiaCard` | vara v1 «todos los criterios son por facultad» |

**Lectura.** El código de M1/M3 sí construye la estructura por facultad
(`CriteriosRadiografiaCardDetalle.tsx` agrupa por `faculty_key`, boxplot
percentilar, Total R, cascada y ancla). Lo que no existe es **un estado del
proyecto canónico en el que esa estructura muestre números**: con el frame
guardado sale `Sin dato`, y al reconstruirlo sale ceros. Las acreditaciones
13/13 y 15/15 se firmaron sobre artefactos reconstruidos y anonimizados
declarados en el propio registro, nunca sobre el `.pulso` que se abre. La
regla que falta no es una tarjeta más: **una fila del ledger no cierra si la
capacidad no se ve en el proyecto de referencia abierto tal cual está.**

## Registro de iteraciones

### Scope lock I17 — «Selección legible» (M2)

- **Categoría y fuente:** feature cross-layer F2/F4; mandan M2, D8, D9 y el contrato vigente de selección del engine R.
- **Módulo:** Cálculo de muestra > Aulas > Método/Selección, con pase compatible a Monitoreo y XLSX.
- **Carril A:** alinear `sequential_discount=TRUE`; emitir/canonizar `CH n`/`R n.k`; aceptar códigos históricos sin alterar selección, calibración ni goldens explícitamente legacy.
- **Carril B:** narrar los cuatro métodos, mostrar el descuento paso a paso y montar la matriz completa virtualizada con clic al inspector.
- **Owners R:** nuevos helpers extraídos + cambios mínimos en `calc_muestra_aulas.R`, `calc_muestra_engine.R`, descuento, Monitoreo y tests focales.
- **Owners React:** archivos nuevos para historias/mapa + cambios reductivos en Método, Selección, reemplazos, labels, didáctica y tests focales.
- **A preservar:** todos los cambios sucios ajenos ya inventariados; puertos 5173/8799; stash de seguridad; ningún proceso del usuario se toca.
- **Fuera:** M3/M4, migraciones `.pulso`, estadísticos nuevos, cambio de algoritmos de sorteo, export histórico Monitoreo→Excel y cualquier inferencia de equivalencia ausente.
- **Riesgo principal:** presentar una configuración como recomendación del engine, narrar `post_hoc` como descuento causal o romper matches históricos al canonizar solo la vista.
- **Peaje estructural:** `calc_muestra_aulas.R`, `AulasMetodoTab.tsx`, `AulasSeleccionTab.tsx`, `ClassroomReplacementPanels.tsx`, `aulas.css` y `aulasParts.tsx` no crecen; lo nuevo vive extraído.
- **Baseline:** auditoría agentic verde; typecheck I16 verde; focales de descuento, identidad, Monitoreo, labels, inspector y handoff antes de integrar.
- **Gate:** testthat focal R + Vitest focal + typecheck + `/ver-ui`/geometry en Método y Selección a 1440×1000 y 1024×600 + `verificador` serial.
- **Stopping rule:** 4/4 capacidades M2 visibles y probadas, 1 helper canónico/0 duplicados, 175/175 titulares sin truncar, defaults alineados, ledger/registro actualizados y commit atómico.
- **Orquestación:** dos writers disjuntos (backend R / frontend React); el lead integra contratos compartidos y un revisor metodológico/visual inspecciona antes del gate final.

### Scope lock I18 — «Marco decide» (M3)

**Addendum posterior al congelado (ajuste vinculante de Gonzalo, 2026-08-01):**
este scope conserva el núcleo ya lanzado de I18. La vara v1 añadida después
(13/13 tarjetas y 15/15 gates por facultad con boxplot+media, embudo vivo y
ancla histórica
por criterio) forma **I18b inmediato**, como fija la cola; no se difiere a I20
ni se salta a I19. D10 se prepara con su recomendación (b), Consistencia dentro
de Fuentes, si el gate real no produce scroll jail; (a) queda como fallback
reversible y debe justificarse con geometría.

- **Categoría y fuente:** feature cross-layer F0/F1/F3/F4; mandan M3, M1, D2 y D7. Las tres capacidades son un solo lote: matriz marginal, «Alumnos por CH» y Consistencia en Datos.
- **Primeras divergencias medidas:** M1 termina en `criterio×facultad×segmento` y no publica `facultad×criterio`; `estratosDesdeFrame()` pierde los estadísticos R y React los recalcula en Cálculo; el catálogo aún escribe Consistencia bajo Marco.
- **Contrato matriz:** `criterios_radiografia.matriz_embudo`, schema v1, mismo `frame_hash`/momento M1, solo gates con unidad CH y facultad efectiva. Cada celda es el contrafactual marginal de la regla completa; bruto/final y Total se recalculan en R. Nunca se suman segmentos, facultades ni deltas para fingir un embudo secuencial.
- **Contrato Alumnos/CH:** `frame.alumnos_por_ch`, schema v1, grano facultad efectiva + fila Total, métrica estricta `eligible_n`; elegible es titular y todos los CH son contraste D2. R publica `n_ch`, media, p25 y p50; una unidad sin dato invalida el snapshot, sin fallback React.
- **Decisión:** vive en `workspace.aulas_config.alumnos_por_ch_decision`, firma `frame_hash`, denominador elegible y método global/overrides por facultad. La pestaña recomienda p25 y exige confirmación explícita; Cálculo no conserva selector ni aritmética estadística.
- **Consumo:** el router/engine R resuelve decisión + frame y calcula `aulas_por_estrato`/`aulas_base_total`; una decisión stale o incompleta falla cerrada. Cálculo y Aulas > Objetivo consumen ese mismo resultado; las cuotas fijas históricas no pueden anular una decisión vigente.
- **Navegación D7/D10 provisional:** Consistencia se integra dentro de Datos > Fuentes; los aliases `marco/def-consistencia` y `marco/marco-validacion` aterrizan en ese hogar mediante el resolver único. Datos conserva Estudio → Fuentes → Variables; Marco agrega «Alumnos por CH» y pierde Consistencia; total público 23. Si el gate acredita scroll jail, se usa la alternativa (a) del addendum sin duplicar el contenido.
- **Owners R:** helpers nuevos de matriz y Alumnos/CH + integración mínima en radiografía, constructor, engine/router y tests focales. **Owners React:** normalizadores/componentes nuevos + cambios reductivos en Cálculo, catálogo, desk, tabs, navegación, bóveda y tests.
- **A preservar:** cambios sucios ajenos inventariados, stash de seguridad y puertos 5173/8799. No se toca parser/serializer global ni se duplica navegación.
- **Fuera:** M4, rediseño de Distribución, migración `.pulso`, cambios M2, Monitoreo→Excel, nuevos joins con `exploracion` y cualquier suma no aditiva.
- **Peaje estructural:** todo componente/contrato nuevo vive en archivo nuevo; `calc_muestra_aulas_criterio_radiografia.R`, `CalculoCursosHorarioFacultadTab.tsx`, `UniversidadDesk.tsx`, `CursosHorarioMarcoTab.tsx` y CSS grandes no crecen si la pieza es extraíble.
- **Baseline:** R radiografía 269 expectativas y focales de perfil/estadístico verdes; frontend 6 archivos/79 tests verdes; navegación 5/80 + guards 3/9; QA canónica 2 viewports por Radiografía, Consistencia y Cálculo con contadores duros en cero.
- **Gate proporcional:** testthat de matriz/Alumnos-CH/engine; Vitest de contratos, superficies, consumo y navegación; typecheck; vault check; `/ver-ui` + geometry en las tres direcciones a 1440×1000 y 1024×600; guardian metodológico y `verificador` serial.
- **Stopping rule:** matriz reconciliada visible, decisión por facultad confirmable y consumida sin recalcular, mudanza con aliases/bóveda completa, owners grandes sin crecimiento extraíble, ledger/registro actualizados y commit atómico.
- **Orquestación:** dos writers disjuntos (backend R / frontend+navegación); el lead congela este contrato, integra el seam público y ejecuta revisiones seriales.

### Scope lock I18b — «Marco decide: vara v1» (M3)

- **Categoría y fuente:** feature engine/dato/metodología + superficie F0/F1/F3; mandan M3, el boceto v1 vinculante, M1/I16, I12 y los contratos integrados por I18. I18b es el remanente inmediato de M3, no una mejora opcional 20+.
- **Primera divergencia medida:** M1 publica seis estadísticos por `criterio×facultad×segmento`, pero la UI acredita **0/13 tarjetas y 0/15 gates** con boxplot+media; no existe cascada por facultad ni preview vivo; I12 solo conserva márgenes 1-D `combinable=false` y no puede producir el cruce histórico conjunto.
- **Inventario congelado:** catálogo dinámico; el estado canónico tiene 13 tarjetas y 15 gates (composición agrupa `c7`, `c8_facultad`, `c8`). Ninguna lógica de producción hardcodea 13 o 15.
- **Distribución y Total:** cada gate muestra por facultad CH elegibles, N de alumnos, media y P10/P25/P50/P75/P90. El gráfico es **boxplot percentilar**: bigotes P10–P90, caja P25–P75, línea P50 y punto media; nunca se rotula Tukey ni min–max. Total se recalcula en R sobre uniones atómicas; React no suma estudiantes únicos, exposiciones ni deltas no aditivos.
- **Cascada R-owned:** schema `calc_muestra_aulas_criterios_cascada_v1`, grano paso×facultad efectiva, unidad CH único, orden único declarado por el motor. Publica gates activos/inactivos, before/after/excluded por facultad y Total R; el último paso ejecutado reconcilia con `aula_frame.included`.
- **Preview vivo:** `POST /api/calc-muestra/marco/criterios/preview` recibe `source_frame_hash`, borrador y `criteria_hash`; responde solo agregados, no persiste el borrador y falla 409 si el contexto transitorio está ausente/stale. No se simula sobre `population_pool` deduplicado ni se reconstruye el frame completo por interacción.
- **Ancla conjunta directa:** la calibración calcula y persiste `facultad×característica` desde la fuente histórica, sin multiplicar márgenes y sin IDs/joins CH. Las tarjetas derivan estados `exacta`, `tamano_cercano`, `facultad`, `global`, `incompatible` o `sin_publicacion`, siempre con `k`, tasa, IC, periodo y advertencia.
- **Matching gobernado:** cercano solo vale para bandas ordenadas de tamaño; categorías nominales degradan a facultad/global, nunca eligen un vecino arbitrario. Se preservan y rotulan las dimensiones distintas de facultad de alumno y de curso-horario efectiva.
- **Privacidad/persistencia:** el contexto estudiante×CH del preview es cache efímero `cache_stripped`; `.pulso` conserva únicamente agregados históricos publicables y nunca raw, IDs ni cache. Las anclas no influyen en τ, `n_aulas` ni la decisión Alumnos/CH.
- **Owners R nuevos:** `calc_muestra_aulas_criterios_cascada.R`, `calc_muestra_asistencia_criterios.R`, `router_calc_muestra_criterios.R` y tests R/HTTP. Seams mínimos en constructor/criterios/referencia/router/persistencia/schema.
- **Owners React nuevos:** `calcMuestraCriteriosI18b.ts`, `CriterioBoxplotPercentilar.tsx`, `CriteriosEmbudoVivo.tsx`, `CriterioAnclaHistorica.tsx`, extracción del detalle de tarjeta, CSS y tests focales. Seams reductivos en consola, tabs y payload.
- **A preservar:** cambios sucios ajenos inventariados, stash de seguridad, puertos 5173/8799 y 8787 del usuario; contratos I16/I18, dimensiones de facultad, `selectionReady` y navegación canónica.
- **Fuera:** M4/I19, comparador set A/B, export de radiografía, influencia del histórico sobre números, migración `.pulso`, joins CH históricos y cualquier suma React no aditiva.
- **Peaje estructural:** no crecen `calc_muestra_aulas.R`, `calcMuestra.ts`, `CalcMuestraPage.tsx`, `marco.css` ni `CriteriosRadiografiaConsola.tsx`; todo owner extraíble nace en archivo nuevo.
- **Baseline y presupuesto:** reutilizar matriz/Alumnos-CH/frescura I18; medir latencia de preview sin pagar rebuild completo de 128,03 s por interacción. No repetir suites ajenas al diff.
- **Gate proporcional:** focales R/HTTP de cascada, totals, anclas, privacidad y `.pulso`; Vitest de normalizadores/superficies/carreras; typecheck; QA visual de las dos rutas de criterios en 1440×1000 y 1024×600; revisión metodológica y `verificador` serial.
- **Stopping rule único:** 13/13 tarjetas y 15/15 gates acreditan distribución completa y Total R; cascada viva actualiza downstream por facultad sin persistir y reconcilia; cada gate muestra ancla/degradación honesta; privacidad, frescura, rendimiento, owners, QA y revisiones verdes; las tres filas del ledger cierran juntas en un commit atómico.
- **Orquestación:** dos writers disjuntos (backend R / frontend React); el lead integra el seam público, controla docs/QA y ejecuta revisiones seriales. No hay mini-iteraciones por criterio.

### Scope lock I19 — «Cálculo consume» (M4)

- **Categoría y fuente:** feature de consumo/lectura F0/F4; manda M4 y los contratos R-owned ya cerrados por I18/I18b. Es un lote de capacidad completo; la auditoría de entrada es el paso 1, no una iteración facturable.
- **Módulo:** Cálculo de muestra > Universidad > Cálculo, con foco en el hogar canónico actual de «Cursos-horario por facultad» y su Distribución.
- **Capacidad de salida:** renombrar el hogar a **«Cursos-horario requeridos»** y convertir Distribución en una lectura densa de población × muestra por unidad × sexo, con bandas de precisión y sensibilidad de parámetros explicables.
- **Primera divergencia medida:** una misma sesión asentada muestra tres resultados: resumen `N=29.083/n=2.304`, Distribución TS `N=29.043/n=2.780/304 CH` y resultado R `453 titulares + 230 reservas = 683 CH`. `TabDistribucion` consume `motor.e1`, Propuestas prefiere P2 y CH respeta el selector P1/P2; el baseline es **0 PASS / 4 FAIL** por C5, aunque el runner automático no detecta overflow.
- **Carril A — dato y contrato:** reconciliar primero cada cifra visible con el resultado vigente del engine R y con la decisión firmada de Alumnos/CH; si faltan bandas o sensibilidad, nacen en R con test y contrato explícito. React valida y formatea, nunca inventa estadísticos ni suma unidades no aditivas.
- **Contrato R congelado:** cada resultado P1/P2 publica `distribucion_universitaria`, schema `calc_muestra_distribucion_universitaria_v1`, `owner=engine_r`, actor/escenario/técnica, `source_frame_hash`, `population_hash`, `design_hash`, momento, grano `facultad_efectiva_x_sexo`, unidades `estudiante_unico_elegible`/`cuota_objetivo_estudiante`, etapa `planificada` y estado `ready|incompatible` con razones. Nunca se rotula como muestra observada.
- **Filas y reconciliación:** por facultad viajan población agregada del frame y del diseño, cuota, precisión y celdas de sexo con `N`/`n`, cuota cruda y delta de redondeo; los totales acreditan sumas por facultad/sexo y diferencias frame↔diseño. Una facultad/categoría extra, hash stale, duplicado, fracción o suma divergente invalida el bundle completo: no hay fallback al perfil de ejemplo, al otro escenario ni a etiquetas heurísticas.
- **Precisión R-owned:** banda numérica `≤3 pp | 3–5 pp | 5–7 pp | >7 pp`, objetivo y alcanzada. P1 declara precisión formal solo global y sus filas como diagnóstico; P2 declara precisión formal por facultad. Nunca se promete margen formal por sexo.
- **Sensibilidad R-owned:** one-factor-at-a-time sobre `p` (vigente/0,5), confianza (vigente/90/95/99), `deff` (vigente/1) y `e` (vigente/2,5/5/7/10 pp). Cada punto publica `n_required`, `delta_n` y `ch_required`, conserva fijo el divisor Alumnos/CH firmado y distingue fórmula de meta.
- **F0 cuadratura:** la fuente metodológica manda `round` facultad→sexo y ajuste determinístico; el helper heredado usa `ceiling` y sesga la celda mayor. El modo corregido se acota a la distribución universitaria y debe cerrar cada facultad y el total. La errata documental `1.232+1.267=2.500` se corrige a **1.232+1.268=2.500**; no es una decisión de dominio.
- **Carril B — superficie completa:** jerarquía dato → composición → precisión → sensibilidad; comparación población/muestra legible por unidad y sexo; estados vacío/stale/error honestos; densidad informativa sin scroll jail ni ruido decorativo.
- **Navegación congelada:** cambia solo la etiqueta pública a «Cursos-horario requeridos»; se conservan el ID `calculo-ch-facultad`, target `cmv2-local-calculo-ch-facultad` y deep link. Distribución y CH comparten el mismo selector P1/P2 y la misma procedencia R.
- **Owners previstos:** auditar antes de escribir el router/engine de cálculo y el owner React de Cálculo; cualquier estadístico o bloque extraíble nace en owner nuevo. El contrato compartido se congela antes de abrir dos writers.
- **A preservar:** decisión Alumnos/CH, P1/P2, selección y resultados vigentes de I18; M3/I18b, navegación canónica, `.pulso`, cambios sucios ajenos, stash de seguridad y puertos 5173/8787 del usuario.
- **Fuera:** recalcular decisiones en React, alterar el algoritmo de selección, rehacer Marco/Criterios, comparador set A/B, export de radiografía, export histórico de Monitoreo y migraciones `.pulso`.
- **Riesgo principal:** presentar precisión o sensibilidad sin dueño causal, mezclar población y muestra con denominadores distintos o duplicar en Cálculo una decisión que pertenece a Marco.
- **Peaje estructural:** ningún owner grande crece si la pieza es extraíble; `calc_muestra_aulas.R`, `calcMuestra.ts`, `CalcMuestraPage.tsx` y los owners existentes de Cálculo se miden antes y después. Se exige 0 archivos extraíbles que crezcan.
- **Baseline medido:** I18b deja sus gates verdes. I19 acredita sus dos direcciones en 1440×1000 y 1024×600: contradicción C5 anterior; CH tiene scroll anidado manual (panel + tabla) y Distribución no declara geometría en markup. Reportes en el scratchpad de la sesión (`prosecnur-i19-ch-baseline` y `prosecnur-i19-dist-geometry`); procesos propios cerrados.
- **Gate proporcional:** focales R solo si cambia dato/contrato; Vitest de normalizadores/superficie/estados; typecheck; `/ver-ui` en la dirección canónica de Cálculo a 1440×1000 y 1024×600; guard de crecimiento y `verificador` serial. No se repiten suites ajenas al diff.
- **Stopping rule único:** nombre canónico y aliases coherentes; población × muestra por unidad × sexo reconciliada; bandas y sensibilidad R-owned, probadas y comprensibles; dos viewports sin deuda geométrica; owners no crecen; ledger/registro actualizados y commit atómico. No se cierra por renombre, gráfico o defecto aislado.
- **Orquestación:** tras la auditoría del lead, hasta dos writers disjuntos (R/contrato y React/superficie) solo si el contrato queda congelado; revisión metodológica y `verificador` serial. I20+ empieza inmediatamente al cerrar.

### Scope lock I20 — «P1 frente a P2» (alcance estadístico + carga operativa)

- **Categoría y fuente:** capacidad nueva F0/F4 de creatividad gobernada; mandan el objetivo del goal, los dos contratos I19 ya reconciliados y la diferencia metodológica P1 global/P2 por facultad.
- **Módulo:** Cálculo de muestra > Universidad > Cálculo; el comparador vive junto a Distribución y no crea otra decisión ni otro hogar.
- **Primera divergencia medida:** la superficie ofrece P1/P2 como toggle, pero acredita **0 comparaciones simultáneas**; hay que memorizar P1 `n=2.372`, `465+236=701 CH` antes de abrir P2 `n=5.932`, `1.734+0=1.734 CH`.
- **Capacidad de salida:** una lectura lado a lado explica el cambio de alcance inferencial y separa cuota planificada, CH titulares, reserva por política y saldo operativo; permite saltar al detalle de cualquiera de los dos diseños.
- **Carril A — contrato R:** owner `calc_muestra_comparacion_escenarios_v1`, snapshot idéntico en ambos resultados; exige dos bundles `ready`, actores exactos y mismo `source_frame_hash`, `population_hash`, inventario, divisor firmado y `tau` por facultad. Publica `comparison_hash` y convención única `P2−P1`.
- **Deltas legítimos:** cuota planificada `+3.560`; CH titulares `+1.269` solo bajo la misma base firmada; reserva `−236` rotulada `policy_dependent`; saldo operativo `+1.033` rotulado bajo políticas vigentes. Ninguno se llama por sí solo “costo de precisión”.
- **Precisión:** P1 publica el objeto formal global que I19 conserva fuera del bundle y sus filas siguen diagnósticas; P2 publica alcance formal por las 18 facultades. No existe delta de margen, promedio P2 global, margen por sexo, ganador ni recomendación.
- **Carril B — superficie:** secuencia pregunta → alcance estadístico → carga base → política de reserva → saldo operativo; ambas columnas permanecen visibles en desktop y se apilan con orden explícito en 1024×600, sin doble scroll.
- **Frescura:** si falta un escenario, cambia el frame/base CH o cualquiera queda `legacy|stale|invalid|incompatible`, la comparación falla cerrada y dirige a recalcular; no cae al motor TS ni al único escenario disponible.
- **Owners previstos:** helper/contrato R y focales R/HTTP nuevos; normalizador/componente/CSS/tests React nuevos; seams reductivos en el adjuntador de distribución y `CalculoDistribucionTab` (el comparador absorbe el selector existente).
- **A preservar:** selector persistido P1/P2, cifras y jerarquía I19, decisión Alumnos/CH, navegación canónica, `.pulso`, cambios sucios ajenos y puertos 5173/8787/8799 del usuario.
- **Fuera:** simulador de parámetros, recomendación automática, comparador set A/B de criterios, export de radiografía, cambios a selección y migraciones `.pulso`.
- **Riesgo principal:** presentar una diferencia aritmética correcta sobre bases no comparables, atribuir la reserva a precisión o convertir “más muestra” en una recomendación implícita.
- **Peaje estructural:** piezas nuevas en owners nuevos; `calc_muestra_distribucion.R`, `calcMuestraDistribucionI19.ts`, `CalculoDistribucionTab.tsx` y su CSS no crecen si la comparación es extraíble.
- **Gate proporcional:** testthat del comparador/frescura, Vitest de normalizador/superficie, typecheck, dos viewports de Distribución con geometry y revisión metodológica; no se repiten suites de I19 ajenas al seam.
- **Stopping rule único:** P1 y P2 se comparan simultáneamente con cuatro lecturas R-owned y sus límites explícitos, semántica formal correcta, fail-closed, acceso al detalle, dos viewports limpios, owners sin crecimiento extraíble, ledger/registro actualizados y commit atómico.
- **Orquestación:** auditoría breve del lead, hasta dos writers disjuntos R/React tras congelar el schema, revisor metodológico/contratos y `verificador` serial.

### Scope lock I21 — «Marco recuperable» (barrido F0/F1 intercalado)

- **Categoría y fuente:** barrido de defectos afines de correctitud y superficie F0/F1 bajo M3; manda el proyecto real `HSVG2026.pulso`, no una fixture inventada.
- **Primera divergencia medida:** SHA-256 `1bfc803f…`; su frame fue generado el `2026-07-31T17:57:47Z`, tiene 22 campos, 5.263 CH y 11 variables de catálogo, pero no contiene `criterios_radiografia` ni siblings I18b. La UI lo rotula «El marco está al día», presenta 5 tarjetas de estudiante como «Sin dato» y ordena Criterios → Criterios CH → Alumnos/CH.
- **Capacidad de salida:** Marco empieza Criterios del estudiante → Alumnos por CH → Criterios de curso-horario; un frame anterior a F1 se reconoce como capacidad pendiente, explica que hay que actualizarlo y ofrece la acción en la misma superficie, sin fingir seis pasos analíticos vacíos. Tras reconstruir, la consola acredita filas criterio × facultad × segmento.
- **Carril A:** el frontend no calcula ni migra; valida presencia/schema/hash y conserva estados `invalido`/`sin_senal` cuando R sí publicó contrato. El engine y el round-trip quedan en solo lectura: el rebuild actual ya emite v2 con suite accionable y `.pulso` lo conserva.
- **Carril B:** una recuperación única y visible reemplaza el muro vacío en ambos hogares de Criterios; la acción nombra «Actualizar radiografía por facultad» y el orden del rail sigue la dependencia metodológica pedida por Gonzalo.
- **Owners previstos:** catálogo/tabs/desk y sus regresiones para el orden; componente de recuperación nuevo, seams reductivos en las dos pestañas y focales de consola/superficie. Ningún owner I20 se toca.
- **A preservar:** `HSVG2026.pulso` original, cifras, selección y frame guardados, `.pulso`, backend R, D10/I22, Aulas, cambios sucios ajenos y puertos 5173/8787/8799 del usuario.
- **Fuera:** auto-upgrade al cargar, migración o guardado silencioso, fabricar estadísticos en React, cambiar criterios confirmados, rediseñar la consola v2, tocar el comparador I20 o ejecutar D10.
- **Riesgo principal:** confundir contrato ausente con señal legítimamente insuficiente, ocultar evidencia v1/v2 inválida o reconstruir datos del usuario sin una acción explícita.
- **Gate proporcional:** fixture legacy roja→verde, orden público/desk/aliases, Vitest focal, typecheck, copia temporal de `HSVG2026` reconstruida con schema v2 y facultades visibles, dos viewports con geometry; SHA del original idéntico antes/después.
- **Stopping rule único:** el orden pedido es único en catálogo y UI, el frame real legado deja de declararse al día y dirige a actualización, la copia reconstruida muestra detalle por facultad, no se tocó el original, `verificador` aprueba, ledger/registro quedan actualizados y hay commit atómico.
- **Orquestación:** diagnóstico R en solo lectura + lead sobre el artefacto real; hasta dos writers React con ownership disjunto para navegación y recuperación; revisión visual/contractual y `verificador` serial.

#### Complemento I21 (2026-08-02, medido con backend fresco sobre el fixture canónico)

- **Premisa corregida.** El contrato de arriba supone que «el rebuild actual ya
  emite v2 con suite accionable» y por eso deja el engine en solo lectura. **Es
  falso y falsable:** reconstruir el marco de `hsvg2026` con el motor de hoy
  emite v2 **vacío**. `aulas.frame.audit` publica `eligible_student_rows=0`,
  `population_n=0`, `classroom_included_n=0` y `excluded_rows=136284` sobre
  `input_rows=136284`; el frame guardado traía 21.365/2.373. Cada tarjeta pasa
  a `Radiografía v2` con `CH elegibles 0`, `Alumnos únicos 0` y `Media NA` en
  todos los segmentos. Con esto, **la stopping rule original de I21 no puede
  cumplirse**: «la copia reconstruida muestra detalle por facultad» es
  inalcanzable mientras el rebuild deje el marco en cero. El carril A deja de
  ser de solo lectura: I21 no cierra sin reparar el motor.
- **Divergencia adicional A2 — el vacío miente por omisión.** Las 136.284
  exclusiones viajan con `exclude_reason: ""`. El motor excluye a todo el
  mundo y no declara la causa, así que ni la UI ni el diagnóstico pueden
  nombrar la pieza que falta. Reparar A1 sin poblar `exclude_reason` deja el
  mismo agujero para el próximo caso: la razón es parte del contrato, no del
  log.
- **Divergencia adicional A3 — dos cifras del mismo concepto en pantalla.**
  Tras reconstruir, el KPI publica `CURSOS-HORARIO ELEGIBLES 0` mientras el
  aviso de la misma vista dice «marco construido: 0 de 29.083 estudiantes
  únicos elegibles y **5.263** cursos-horario elegibles». Es F0 puro y entra
  en este barrido porque vive en la superficie que I21 ya toca.
- **Divergencia adicional A7 — «alumnos» con tres denominadores.** Cobertura
  publica «34,8 % · 13.498 / 38.749» bajo el rótulo «Alumnos por facultad»
  mientras la cabecera marca 21.365 elegibles sobre 29.090. Cada cifra puede
  tener su dueño legítimo (personas vs. matrículas), pero la superficie no lo
  dice y las tres se leen como lo mismo. Se reconcilia o se rotula; no se deja.
- **Divergencia adicional A6 — C3 en «Alumnos por CH».** Sobre el estado
  canónico la pestaña entrega una línea («Reconstruye el marco…») y deja ~60 %
  del viewport vacío. Es el mismo muro que I21 ya se comprometió a reemplazar
  en Criterios; la pestaña que M3 estrenó tiene que entrar en el mismo arreglo,
  no quedarse fuera por no estar nombrada.
- **Capacidad de salida ampliada:** además del orden y la recuperación, al
  terminar I21 **reconstruir el marco del proyecto de referencia devuelve un
  marco con elegibles**, cada exclusión dice por qué, y las cifras de una misma
  pantalla coinciden o declaran su denominador.
- **Owners que se suman:** el motor de construcción del marco y su suite
  focal (`api/R/calc_muestra_aulas*.R`, `test-calc_muestra_aulas*.R`) dejan de
  estar fuera de alcance; el aviso de construcción y el KPI de la cabecera
  entran como seams reductivos; Cobertura solo se toca para rotular
  denominadores, no para rediseñarse.
- **Causa de A1, medida el 2026-08-02: no es una regresión del motor, es el
  fixture que se contradice a sí mismo.** Reproducción headless con la config
  guardada y la base del `.pulso`: de los cinco criterios de alumno,
  `condition` deja pasar 124.167 filas, `formation` 125.003, `age` 123.360,
  `level` 136.284 y **`faculty` 0 de 136.284**. El motivo es literal: el
  anonimizador reemplazó la facultad del alumno en la base por nombres de
  persona («Andres», «Nestor DE Ricardo Diana», «Karina, Karina Y Karina»)
  y **dejó intactos en `criterios_seleccion` los quince slugs de las facultades
  reales** (`estudios_generales_letras`, `derecho`, …). Ningún valor puede
  casar. El manifiesto declara `anonimizacion.aplicada: true` con 13 tablas
  tocadas; la config de criterios y `criterios_catalogo` no estaban entre
  ellas. Prueba de cierre: liberando solo ese criterio, el marco vuelve a
  `eligible_student_rows = 106013`, **la cifra exacta del frame guardado**.
  Consecuencia para I21: el carril de motor se reduce a A2 (razón de
  exclusión) y el trabajo real es de **integridad del fixture** —
  `api/scripts/pulso_anonimizar.R` debe reescribir a la vez la base, la config
  de criterios y el catálogo, o negarse a anonimizar una dimensión que otra
  tabla referencia por slug.
- **Pista para el diagnóstico de A2 (no es el veredicto, es dónde mirar):**
  `api/R/calc_muestra_aulas.R:1138-1147` compone `eligible_student` como
  `sid_ok & age_ok & condition_ok & level_ok` y luego lo cruza con
  `alumno_sel$marco_ok` de `calc_muestra_aulas_criterios_alumno()`. Los filtros
  legacy de arriba están gateados por `!suite_activa`, así que con suite activa
  el único que puede anular a los 136.284 es `marco_ok`. Además `reason_rows`
  se arma con las siete banderas legacy y **no incluye `marco_ok`**: por eso
  `exclude_reason` sale vacío cuando quien excluye es la suite. A2 y A1 son el
  mismo defecto visto por dos lados.
- **Regresión que fija el rojo antes del fix:** una focal sobre la base madre
  del fixture que exija `eligible_student_rows > 0` y `exclude_reason != ""`
  en toda fila excluida. Hoy falla; es el contrato de I21, no una comprobación
  opcional.
- **Fuera, con motivo escrito:** migrar `/api/calc-muestra/marco/construir` a
  `callr` (ver I21b) y regenerar el fixture anonimizado (ver instrumento de
  QA). Ambos son afines pero no caben sin diluir el barrido.
- **Instrumento de QA — deuda que invalida la acreditación «por facultad»:**
  en `hsvg2026` las facultades se llaman «Andres», «Elena Diego», «Ricardo
  Ricardo Gabriela»: el anonimizador sustituyó nombre de facultad por nombre de
  persona. La vara v1 exige que todo se lea por facultad, y el único proyecto a
  escala donde eso se puede QA tiene el eje ilegible. Mientras siga así,
  ninguna captura de este módulo acredita «por facultad» — solo acredita que
  hay agrupación. Se arregla en `api/scripts/pulso_anonimizar.R` (diccionario
  propio para nombres de unidad académica) y se regenera el fixture.
- **Gate que se suma:** focal R roja→verde de A1/A2; reconciliación literal de
  las tres cifras de A3 y A7 en captura; `Alumnos por CH` sin muro en 1440×1000
  y 1024×600; y la regla nueva del loop — **la evidencia se toma sobre
  `api/inst/reference_projects/hsvg2026/hsvg2026.pulso` abierto tal cual está,
  no sobre una reconstrucción anonimizada.** Un artefacto reconstruido sirve
  para medir rendimiento; no acredita una fila del ledger.
- **Stopping rule que se suma:** reconstruir el marco del proyecto de
  referencia entrega elegibles > 0 con exclusiones justificadas; las tarjetas
  muestran números por facultad y no ceros; ninguna pantalla publica dos
  valores del mismo concepto; `Alumnos por CH` contiene su vacío.

#### Corte I21-UI — recuperación y unidad facultad → dato → decisión

- **Corrección de arquitectura (Gonzalo, 2026-08-02):** la radiografía de CH
  no es una consola previa. Cada facultad contiene sus ocho tarjetas de
  criterio; al abrir una, el resumen compacto publica directamente CH
  elegibles, CH con dato, alumnos únicos, matrículas, media y P10/P25/P50/P75/
  P90 de esa facultad, seguido por su control. La trazabilidad de seis pasos
  queda disponible bajo demanda y conserva owner, grano, hash, cascada, ancla
  e impacto.
- **Reglas comunes:** `enrolled_total` y `composition` también muestran su
  corte local dentro de cada facultad, pero se rotulan «Regla común» y enlazan
  al único control transversal; React no inventa overrides que el engine no
  admite.
- **Resultado al final:** la matriz marginal deja de abrir la pestaña y queda
  colapsada después de las facultades. El frame legado recibe una recuperación
  única; un v2 `sin_senal` sigue siendo analítico y un payload inválido falla
  cerrado.
- **Defecto visual reparado:** superficies estructurales dejaron de usar
  `--pulso-radius-chip=999px`; radios computados quedan en 10–14 px. En
  1024 px el compacto mide 205 px y el control comienza 252 px después del
  header (owner 394 px), frente a 4.473/4.519 px del estado vetado.
- **Límite explícito:** este corte no cierra I21 completo. A1/A2/A3/A6/A7 y
  el instrumento A8 siguen en el carril A de motor/superficie ya congelado
  arriba; la próxima intervención es A1+A2, no I20 ni D10.

### Scope lock I21b — «Construir el marco no congela la app» (candidato inmediato)

- **Categoría:** defecto de infraestructura medido, afín a I21 pero de owner
  distinto; se separa para no diluir el barrido F0/F1.
- **Divergencia medida:** `POST /api/calc-muestra/marco/construir`
  (`api/R/router_calc_muestra.R:571`) corre síncrono en el hilo único de
  Plumber, sin `job_submit`. Sobre el fixture canónico bloqueó la app **más de
  9 minutos** con un banner sin progreso ni tiempo estimado, y durante toda la
  corrida el sello siguió afirmando «El marco está al día con los criterios
  confirmados». La regla de la casa manda `callr::r_bg` con archivo de progreso
  para operaciones pesadas.
- **Capacidad de salida:** el marco se construye como job con progreso real y
  cancelable; el resto de la app sigue respondiendo; el sello de frescura dice
  la verdad mientras se reconstruye.
- **Riesgo principal:** los workers `callr` resuelven funciones contra el
  paquete **instalado** y necesitan el bootstrap de locale UTF-8 (`/jobs-asincronos`);
  un fix probado solo con `load_all` no prueba nada.
- **Por qué no va dentro de I21:** I21 es correctitud del dato y honestidad de
  la superficie; esto es contrato de ejecución y toca `jobs.R`. Van juntos en
  el tiempo, no en el mismo commit.

| # | Fecha | Lote | Qué se hizo | Evidencia | Ledger movido |
|---|---|---|---|---|---|
| 16 | 2026-08-01 | Consola analítica de criterios (M1) | El engine R convirtió el inventario dinámico en 13 tarjetas/15 gates/9 familias con snapshots, seis estadísticos, delta atómico y estados honestos; React solo valida, ordena y presenta dato → distribución → impacto → acción en los dos hogares de Marco. El owner R grande se partió por alumno/aula y el contrato API se extrajo. El gate real detectó y corrigió dos multiplicadores de rendimiento y un hueco de geometría antes del cierre. | R focal 23 bloques/269 expectativas; payload completo con SHA congelado y un índice alumno×CH por radiografía. Medición causal sobre 136.284 filas: >21 min → 347,09 s → **128,03 s**, 15/13/15 intactos. Typecheck y Vitest focales verdes. QA geometry-only sobre frame canónico `hsvg2026` 5.263/2.373: 4/4 capturas, 58 grupos, 0 misses/issues/overflow/scroll jail/errores, `ok=true`; la reconstrucción desde el Excel anonimizado se usa solo para rendimiento, nunca para acreditar cifras. | Gates M1 1/15 → **15/15**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I17 queda activa. |
| 17 | 2026-08-01 | Selección legible (M2) | Método invierte la jerarquía: recomendación acreditada, cuatro historias visuales y comparador colapsado al final. El descuento secuencial queda ON en R y UI, narrado como secuencial o `post_hoc` según engine. Un helper canónico R y otro espejo de presentación TS publican `CH n`/`R n.k` en selección, reemplazos, inspector, didáctica, XLSX y Monitoreo, aceptando históricos. Selección monta el mapa completo virtualizado por facultad, con todas las cadenas y clic al inspector. La frescura de la recomendación firma toda la configuración causal y falla cerrada; dos vetos de revisión (objetivo normalizado y default vacío) se reprodujeron, repararon y reaprobaron dentro del lote. | Cinco focales R verdes; Aulas 9 archivos/91 Vitest y handoff final 17/17; typecheck, 11/11 del guard visual y diff-check verdes. Método 2/2 y Selección 2/2 en 1440×1000/1024×600: 18 grupos, 0 issues/misses/overflow/scroll jail/errores. Estado C canónico: 163 titulares, 1.406 reemplazos, 15 facultades, profundidad 11; `CH 1` abre su inspector y el scroll alcanza el final. El modelo prueba además 175 × 11 sin truncar. `calc_muestra_aulas.R` 5.043→4.963 y `AulasMetodoTab.tsx` 409→141; ningún owner grande de entrada creció. Guardian y método: `APPROVED` tras sondas R→TS reales. | M2 0/4 → **4/4**; duplicados 4→**0** con 1 helper; titulares 24/175→**175/175**; default divergente→**ON alineado**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I18 «Marco decide» queda activa; sin decisiones nuevas. |
| 18 | 2026-08-01 | Marco decide — núcleo (M3) | R publica la matriz marginal facultad×criterio y la distribución estricta de alumnos/CH; Marco confirma P25/media/mediana por facultad con firma de `frame_hash`; Cálculo resuelve y calcula P1/P2 en R, y Objetivo/Selección solo consumen la corrida vigente. Cambiar la decisión invalida resultados, jobs, export y handoff; estados presentes malformados fallan cerrados. Consistencia se mudó una sola vez a Datos > Fuentes con foco y aliases históricos. El gate visual corrigió dentro del lote tres contratos geométricos inválidos, el falso overflow del haz animado y el wrapping de los métodos. | Seis focales R verdes; frontend 13 archivos/105 tests y typecheck verdes; bóveda 201/206 sin deriva, agentic OS y diff-check verdes. QA declarada sobre reconstrucción anonimizada `frame_hash=2cf87159bc…` (5.263 CH, 17 facultades, 10 columnas marginales + Total, 18 filas Alumnos/CH; no certifica cifras canónicas): 10/10 capturas finales en Radiografía, Alumnos/CH, Fuentes, Cálculo y alias, 218 grupos, 0 issues/misses/overflow/scroll jail/errores. `UniversidadDesk` 634→598 y Cálculo 447→125; router 962→965 tras extraer la lógica al owner nuevo; seams inevitables de config +7; 0 owners extraíbles crecieron. Método, contratos y `verificador`: **APPROVED**. | Matriz no existe→**existe**; Alumnos/CH no existe→**existe y se consume**; D7 pendiente→**hecha** con D10(b) provisional; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I18b queda **activa** antes de I19; sin decisiones nuevas. |
| 18b | 2026-08-01 | Marco decide — vara v1 (M3) | El engine R publica distribución completa por criterio×facultad, Total sobre uniones atómicas y una cascada secuencial que conserva el inventario exacto; el preview recalcula aguas abajo sin persistir borradores. La referencia histórica usa celdas conjuntas directas, conserva las dimensiones de facultad de alumno y CH y degrada explícitamente cuando no puede publicar. React acepta solo bundles completos y frescos, presenta boxplot percentilar P10–P90 con media, embudo vivo y ancla por cada gate, y falla cerrado ante mezclas o inventarios imposibles. | Seis focales R/HTTP verdes; frontend 4 archivos/44 tests y typecheck verdes. Artefacto QA declarado, reconstruido y anonimizado: 15/15 gates, 130/130 totales, 270/270 anclas, 0 faltantes/extras; 5.263 CH reconciliados y `manual_excluded` final. Cincuenta previews: mediana 0,007 s, p95 0,008 s, máximo 0,034 s. Privacidad literal: contexto de sesión/atributo privado ausentes y 0 claves prohibidas. QA final en las dos rutas y dos viewports: 4/4 capturas, 466 grupos, 0 issues/misses/overflow/scroll jail/errores, `ok=true`. Owners existentes grandes: 0 crecimientos; método y contratos: **APPROVED**. | Tarjetas 0/13 y gates 0/15→**13/13 y 15/15**; cascada no existe→**existe**; anclas no existen→**existen**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I19 queda **activa**; sin decisiones nuevas. |
| 19 | 2026-08-02 | Cálculo consume (M4) | El engine R publica para P1/P2 una distribución universitaria fail-closed por facultad×sexo, con población del frame/diseño, cuota planificada, bandas de precisión y sensibilidad OFAT; redondeo, inventario, divisor firmado y CH derivado cuadran por fila y total. React elimina la distribución TS, comparte escenario/frame entre cabecera, Distribución y CH, muestra estados honestos y renombra el hogar operativo a «Cursos-horario requeridos». Tres vetos reducidos —divisor firmado, delta OFAT e inventario/cuadratura CH— y dos bypasses de frescura del header/CH se reprodujeron y repararon dentro del lote. | R final **185 expectativas**; frontend independiente 5 focales/**36 tests** y typecheck verdes; guardian contractual/metodológico **APPROVED**. Artefacto QA explícitamente no canónico `SHA256=4ca1c70f…`, agregado y sin PII: P1 `N=29.083/n=2.372`, P2 `n=5.932`, hashes de diseño distintos y delta de población 0. QA final: Distribución + CH, 4/4 capturas, 14 grupos, 0 issues/misses/overflow/scroll jail/errores, `ok=true`; C5 visible y estático: `29.083/2.372/3.558` y `465+236=701`. Revisor visual: **PASS 4/4, DEBT 0**. Owners grandes solo reciben seams (`aulas` +3, engine +4, cliente +2, desk +5); pieza nueva extraída y CSS -5. | M4 pendiente→**hecho**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I20 «P1 frente a P2» queda **activa**; sin decisiones nuevas. |
| 21-UI | 2026-08-02 | Marco recuperable — corte UI (M3/F1) | El orden de Marco pasa a Criterios del estudiante → Alumnos por CH → Cursos-horario. El frame legado se reconoce y ofrece una recuperación única. En v2 desaparecen la consola y la matriz preliminares: cada facultad contiene 8/8 criterios con dato R compacto antes del control, detalle completo abrible y reglas comunes honestas; la matriz transversal cierra el recorrido. Se corrigieron el guard del CTA, el aislamiento estricto por `faculty_key` y los radios estructurales de 999 px. | SHA original `1bfc803f…` idéntico; copia reconstruida con 17 facultades y round-trip v2. Frontend **386 archivos/3.175 tests**, typecheck, bóvedas 201/206, agentic OS y diff-check verdes. QA exacta 1440×1000 + 1024×600: 2/2 `ok=true`, 7 grupos por captura, 0 issues/misses/overflow/scroll jail/errores; DOM: compacto 205 px, dato→control 252 px, 40 cifras visibles en Modalidad, 0 IDs duplicados, 2 reglas comunes sin inputs locales. Revisión contractual y `verificador`: **APPROVED**. | Recuperación 0/1→**1/1**; orden incorrecto→**correcto**; unidad CH separada→**8/8 integrada**. I21 sigue activa en A1+A2; sin decisiones nuevas. |

## Cómo se corre cada visita

```bash
make dev-pulso PULSO=api/inst/reference_projects/hsvg2026.pulso
```

- Navegar por dirección, no por click: `window.__pulsoNav.ir("calc-muestra/…")`
  o `--ir` en los runners; `?modo=opinion-universitaria&seccion=<datos|marco|calculo|aulas|salidas>&pestana=<id>`.
- QA visual: `make ui-quick-check` · matriz completa:
  `make reference-project-visual-matrix REFERENCE_PROJECT=hsvg2026`.
- Higiene: reusar servers (`preview_list`; el 8787 es del usuario y no se
  mata), cerrar lo propio, `make dev-status` / `make dev-prune` ante huérfanos.
- Tests R focalizados: `Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-calc_muestra_aulas.R")'`
  (y los `test-calc_muestra*` hermanos según el diff).

### Trampas de operación medidas (no volver a pagarlas)

1. **Un backend vivo no toma tus cambios de R**: `launch.R` hace `load_all` al
   arrancar; comparar el arranque del proceso contra el `mtime` de `api/R/*.R`
   antes de juzgar un motor. Los jobs `callr` corren contra el paquete
   **instalado**.
2. **El `?pulso=` se consume una sola vez**: no sondear
   `/api/system/bootstrap` a mano; abrir con el deep-link y esperar
   `window.__pulsoNav.listo()`.
3. **Ningún `.pulso` sirve para todo**: elegir el estado según lo que se juzga
   y declararlo en la evidencia (A sin marco / B selección sin objetivo / C
   cadena completa con objetivo). Un screenshot sin estado declarado no prueba
   nada.
4. **Vitest da falsos rojos con el dev server encendido** (comparten
   `node_modules/.vite`): un rojo aislado se relanza antes de diagnosticarse.
5. **Sesiones concurrentes sobre el mismo árbol**: verificar `git log` y
   `git status` justo antes de commitear; otra sesión puede haber movido el
   working tree a mitad del gate.
