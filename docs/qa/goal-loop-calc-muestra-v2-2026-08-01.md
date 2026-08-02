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
- **Matriz embudo facultad × criterio**: una fila por facultad + fila total,
  una columna por criterio; muestra cómo cada recorte lleva del N bruto a los
  CH elegibles y cómo suma al total. Se construye **sobre** el contrato M1
  (los deltas contrafactuales son sus celdas), nunca aparte. Cierra el Carril
  2 heredado.
- **Pestaña «Alumnos por CH»** después de Criterios: decide el valor de
  alumnos/CH por facultad (media, mediana, p25 u otro robusto — se elige con
  las distribuciones de M1 a la vista); Cálculo (CH requeridos) y Selección
  (Objetivo) la **consumen sin recalcular**. El poder de decisión vive aquí.
  D2 ya fijó el contraste elegible/total.
- **Mudanza Consistencia → Datos** (D7, revierte I2): mudanza única con rigor
  F3 — alias para la dirección publicada `marco/def-consistencia`,
  justificación escrita, regresiones de navegación actualizadas, bóveda
  renumerada.

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
| 17 | «Selección legible» (métodos narrados + descuento visible + código `CH n`/`R n.k` + mapa de la muestra) | M2 | **activa** |
| 18 | «Marco decide» (matriz embudo + «Alumnos por CH» + mudanza Consistencia→Datos) | M3 | pendiente |
| 19 | «Cálculo» (renombre + Distribución densa) | M4 | pendiente |
| 20+ | Libertad creativa gobernada: lo que la evidencia pida (simulador «qué pasa si», comparador de escenarios, export de radiografía), colgado de las cinco dimensiones y gateado por F0 | — | abierto |

El orden 17→18→19 es el decidido en el boceto v2. Un hallazgo de correctitud
(carril A) puede intercalarse como barrido, nunca desordenar los lotes sin
anotarlo aquí.

## Ledger

| Métrica | Apertura (2026-08-01) | Hoy | Dirección |
|---|---:|---:|---|
| Gates analíticos de criterios con contrato R probado (M1) | 1 de 15 (`session_type`, I11) | **15 de 15** | = 15 |
| Capacidades del lote «Selección legible» (M2) | 0 de 4 | 0 de 4 | = 4 en un solo lote |
| Helper único de código operativo (`CH n` / `R n.k`) | re-etiquetado duplicado en 4 archivos | 4 duplicados | 1 helper compartido, 0 duplicados |
| Titulares visibles en la vista de cadenas sin truncar | 24 de 175 (slots ≤ 6 de 11) | 24 de 175 | 175 de 175 |
| Default de `sequential_discount` alineado engine↔UI y documentado | divergente (engine OFF, UI ON) | divergente | alineado con porqué escrito |
| Matriz embudo facultad × criterio (M3) | no existe | no existe | existe sobre el contrato M1 |
| Pestaña «Alumnos por CH» (M3) | no existe | no existe | existe y Cálculo/Selección la consumen sin recalcular |
| Mudanza Consistencia → Datos (D7) | pendiente | pendiente | hecha una vez, con alias y regresiones |
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

## Registro de iteraciones

| # | Fecha | Lote | Qué se hizo | Evidencia | Ledger movido |
|---|---|---|---|---|---|
| 16 | 2026-08-01 | Consola analítica de criterios (M1) | El engine R convirtió el inventario dinámico en 13 tarjetas/15 gates/9 familias con snapshots, seis estadísticos, delta atómico y estados honestos; React solo valida, ordena y presenta dato → distribución → impacto → acción en los dos hogares de Marco. El owner R grande se partió por alumno/aula y el contrato API se extrajo. El gate real detectó y corrigió dos multiplicadores de rendimiento y un hueco de geometría antes del cierre. | R focal 23 bloques/269 expectativas; payload completo con SHA congelado y un índice alumno×CH por radiografía. Medición causal sobre 136.284 filas: >21 min → 347,09 s → **128,03 s**, 15/13/15 intactos. Typecheck y Vitest focales verdes. QA geometry-only sobre frame canónico `hsvg2026` 5.263/2.373: 4/4 capturas, 58 grupos, 0 misses/issues/overflow/scroll jail/errores, `ok=true`; la reconstrucción desde el Excel anonimizado se usa solo para rendimiento, nunca para acreditar cifras. | Gates M1 1/15 → **15/15**; hallazgos vuelve a 0; archivos extraíbles que crecieron = 0. I17 queda activa. |

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
