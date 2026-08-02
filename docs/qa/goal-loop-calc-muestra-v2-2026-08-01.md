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
| 18 | «Marco decide» — núcleo ya congelado (matriz marginal + «Alumnos por CH» + mudanza Consistencia→Datos) | M3 | **cerrada** — foto marginal R-owned, decisión firmada consumida por Cálculo/Selección y D7 ejecutada con D10(b) provisional |
| 18b | «Marco decide» — vara v1 vinculante (distribución por facultad + embudo vivo + ancla histórica por criterio) | M3 | **activa** — 13 tarjetas/15 gates dinámicos; Total R-owned; un solo lote antes de I19 |
| 19 | «Cálculo» (renombre + Distribución densa) | M4 | pendiente |
| 20+ | Libertad creativa gobernada: lo que la evidencia pida (simulador «qué pasa si», comparador de escenarios, export de radiografía), colgado de las cinco dimensiones y gateado por F0 | — | abierto |

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
| Tarjetas de criterio presentadas por facultad con boxplot+media (vara v1) | **0 de 13 tarjetas / 0 de 15 gates** | **0 de 13 / 0 de 15** | 13/13 tarjetas y 15/15 gates; inventario dinámico |
| Embudo vivo: cascada por facultad al enfocar/activar criterios, con orden de recorte visible | no existe | no existe | existe |
| Ancla histórica dentro de cada criterio (facultad × característica común, `k`/IC, degradación rotulada) | no existe | no existe | existe, sin join CH a CH |
| Pestaña «Alumnos por CH» (M3) | no existe | **existe**; decisión por facultad firmada y consumida por R en Cálculo/Selección sin recalcular | existe y Cálculo/Selección la consumen sin recalcular |
| Mudanza Consistencia → Datos (D7) | pendiente | **hecha dentro de Datos > Fuentes**; aliases históricos, bóveda y 23 pestañas reconciliadas | hecha una vez, con alias y regresiones |
| Renombre «CH requeridos» + Distribución densa (M4) | pendiente | pendiente | hecho |
| Hallazgos abiertos del loop | 0 | 0 | = 0 |
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

Abierta (no bloquea, patrón de no-bloqueo):

| # | Decisión | Opciones | Recomendación | Estado |
|---|---|---|---|---|
| D10 | Al ejecutar la mudanza D7: ¿Consistencia como pestaña propia de Datos o como elemento dentro de Datos > Fuentes? El boceto v1 sugiere literalmente «un elemento dentro de datos/fuentes» | (a) pestaña propia; (b) elemento dentro de Fuentes | (b) si su contenido cabe sin scroll jail — es lo que el v1 pide; (a) si no cabe | pendiente de Gonzalo; **(b) ejecutada provisionalmente** y acreditada en 2 viewports con 0 scroll jail; sigue reversible |

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

| # | Fecha | Lote | Qué se hizo | Evidencia | Ledger movido |
|---|---|---|---|---|---|
| 16 | 2026-08-01 | Consola analítica de criterios (M1) | El engine R convirtió el inventario dinámico en 13 tarjetas/15 gates/9 familias con snapshots, seis estadísticos, delta atómico y estados honestos; React solo valida, ordena y presenta dato → distribución → impacto → acción en los dos hogares de Marco. El owner R grande se partió por alumno/aula y el contrato API se extrajo. El gate real detectó y corrigió dos multiplicadores de rendimiento y un hueco de geometría antes del cierre. | R focal 23 bloques/269 expectativas; payload completo con SHA congelado y un índice alumno×CH por radiografía. Medición causal sobre 136.284 filas: >21 min → 347,09 s → **128,03 s**, 15/13/15 intactos. Typecheck y Vitest focales verdes. QA geometry-only sobre frame canónico `hsvg2026` 5.263/2.373: 4/4 capturas, 58 grupos, 0 misses/issues/overflow/scroll jail/errores, `ok=true`; la reconstrucción desde el Excel anonimizado se usa solo para rendimiento, nunca para acreditar cifras. | Gates M1 1/15 → **15/15**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I17 queda activa. |
| 17 | 2026-08-01 | Selección legible (M2) | Método invierte la jerarquía: recomendación acreditada, cuatro historias visuales y comparador colapsado al final. El descuento secuencial queda ON en R y UI, narrado como secuencial o `post_hoc` según engine. Un helper canónico R y otro espejo de presentación TS publican `CH n`/`R n.k` en selección, reemplazos, inspector, didáctica, XLSX y Monitoreo, aceptando históricos. Selección monta el mapa completo virtualizado por facultad, con todas las cadenas y clic al inspector. La frescura de la recomendación firma toda la configuración causal y falla cerrada; dos vetos de revisión (objetivo normalizado y default vacío) se reprodujeron, repararon y reaprobaron dentro del lote. | Cinco focales R verdes; Aulas 9 archivos/91 Vitest y handoff final 17/17; typecheck, 11/11 del guard visual y diff-check verdes. Método 2/2 y Selección 2/2 en 1440×1000/1024×600: 18 grupos, 0 issues/misses/overflow/scroll jail/errores. Estado C canónico: 163 titulares, 1.406 reemplazos, 15 facultades, profundidad 11; `CH 1` abre su inspector y el scroll alcanza el final. El modelo prueba además 175 × 11 sin truncar. `calc_muestra_aulas.R` 5.043→4.963 y `AulasMetodoTab.tsx` 409→141; ningún owner grande de entrada creció. Guardian y método: `APPROVED` tras sondas R→TS reales. | M2 0/4 → **4/4**; duplicados 4→**0** con 1 helper; titulares 24/175→**175/175**; default divergente→**ON alineado**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I18 «Marco decide» queda activa; sin decisiones nuevas. |
| 18 | 2026-08-01 | Marco decide — núcleo (M3) | R publica la matriz marginal facultad×criterio y la distribución estricta de alumnos/CH; Marco confirma P25/media/mediana por facultad con firma de `frame_hash`; Cálculo resuelve y calcula P1/P2 en R, y Objetivo/Selección solo consumen la corrida vigente. Cambiar la decisión invalida resultados, jobs, export y handoff; estados presentes malformados fallan cerrados. Consistencia se mudó una sola vez a Datos > Fuentes con foco y aliases históricos. El gate visual corrigió dentro del lote tres contratos geométricos inválidos, el falso overflow del haz animado y el wrapping de los métodos. | Seis focales R verdes; frontend 13 archivos/105 tests y typecheck verdes; bóveda 201/206 sin deriva, agentic OS y diff-check verdes. QA declarada sobre reconstrucción anonimizada `frame_hash=2cf87159bc…` (5.263 CH, 17 facultades, 10 columnas marginales + Total, 18 filas Alumnos/CH; no certifica cifras canónicas): 10/10 capturas finales en Radiografía, Alumnos/CH, Fuentes, Cálculo y alias, 218 grupos, 0 issues/misses/overflow/scroll jail/errores. `UniversidadDesk` 634→598 y Cálculo 447→125; router 962→965 tras extraer la lógica al owner nuevo; seams inevitables de config +7; 0 owners extraíbles crecieron. Método, contratos y `verificador`: **APPROVED**. | Matriz no existe→**existe**; Alumnos/CH no existe→**existe y se consume**; D7 pendiente→**hecha** con D10(b) provisional; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I18b queda **activa** antes de I19; sin decisiones nuevas. |

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
