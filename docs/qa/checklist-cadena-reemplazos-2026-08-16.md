# Checklist — cadena de reemplazos, objetivo de profundidad y rendimiento P05

Pedido de Gonzalo (2026-08-16): «Haz todo esto» sobre las tres decisiones que el
GOAL A tenía bloqueadas esperándolo.

Doc vivo. Sólo Gonzalo lo da por terminado.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | **Candado por facultad** en la cadena de reemplazos, en vez del candado de celda | `api/R/calc_muestra_aulas.R` — `.cm_aulas_pick_chain_reserve_idx` y `.cm_aulas_candado_de_cadena` | ☑ hecho |
| C2 | **Profundidad variable por cupo**: la cadena llega hasta donde el cupo alcance, sin exigir la celda entera | mismo mecanismo que C1 | ☑ hecho |
| C3 | Cablear la estrategia nueva en el **contrato TS** y en el default de estudios nuevos | `frontend/src/api/calcMuestra.ts` (unión de tipos) · `.../shared/constants.ts` | ☑ hecho |
| C4 | **`reserve_depth_target`**: deja de valer 1 mientras el diseño arma cadenas largas | `.../shared/constants.ts` → **6** (estudios nuevos) · `api/R/calc_muestra_aulas.R:306` sigue en 1 a propósito | ☑ hecho |
| C5 | **Superficie de `rendimiento_p05`**: el motor lo calcula y ninguna pantalla lo muestra | columna «Alumnos por aula» en `CertezaCoberturaPanel.tsx`, con media arriba y P05 debajo | ☑ hecho |

## Verificación

- **R**: 26 expectativas nuevas en `test-calc-muestra-cadena-candado-facultad.R`; 1.831
  en las 24 suites del área de aulas, 0 fallos.
- **Frontend**: 8 tests nuevos (5 de defaults, 3 de la columna); 1.354 en
  `calcMuestra` sobre 161 archivos; `tsc` en 0.
- **Mutantes**: diez, todos muertos — cuatro sobre el candado en R, tres sobre
  los defaults y tres sobre la columna.

## Lo que hay que saber para usarlo

**El estudio de HSyVBG 2026 no cambia solo.** Medido por la ruta real: su
`aulas_config` trae las dos claves explícitas —`max_complete_chains_by_cell` y
`reserve_depth_target: 1`—, así que conserva sus valores. El cambio gobierna a
los estudios **nuevos**.

**Y no hay perilla en la app para cambiárselos.** Ninguna superficie escribe
`replacement_depth_strategy` ni `reserve_depth_target`: sólo se fijan al nacer
el estudio. Para que el proyecto vigente use el candado por facultad hace falta
o un control nuevo, o editar su config.

**Al mover estos dos defaults, una comparación de métodos ya calculada deja de
acreditarse.** `classroomComparisonMatchesConfig` compara la firma del selector
que R serializó contra la que la config actual produce, y ambos campos entran en
esa firma. Es el comportamiento correcto —una comparación hecha con otro
objetivo ya no describe la config vigente— pero significa que un estudio nuevo
que cambie de candado tendrá que volver a comparar.

## Lo medido que sostiene cada ítem

**C1 · C2 — el precedente de 2025.** De las 170 cadenas del operativo real, **0
mezclan facultades** y **148 mezclan tamaños**. El reemplazo tenía que ser de la
misma facultad y punto; el tamaño podía variar, y en el 87% de los casos varió.

Hoy el motor hace lo contrario: `max_complete_chains_by_cell` exige la **celda
entera** (facultad × sexo × tamaño) desde la segunda reserva. Por eso **44 de 84
celdas** no pueden sostener una cadena de 11 — no hay tantas aulas dentro de una
celda tan fina. Con el candado por facultad esas 44 dejan de ser cortas, porque
el pool pasa a ser la facultad completa.

| Reservas por titular | Celdas que no la sostienen (de 84) |
|---|---|
| 1 | 5 |
| 3 | 17 |
| 5 | 22 |
| 11 | 44 |

**C4 — el objetivo no mide lo que el diseño pretende.** `reserve_depth_target`
vale **1** de fábrica mientras el diseño construye cadenas de **11**. Con el
objetivo en 1, un titular con una sola reserva —y encima de otra celda— pasa por
conforme, y ni el motor ni la pantalla dicen nada. El aviso existe
(`08fb3c9e`) pero no puede disparar contra un objetivo que ya se cumple.

La profundidad del precedente 2025 es **3–12 con mediana 6**.

**C5 — capacidad sin consumidor.** `rendimiento_p05` es el percentil 5 del
rendimiento simulado: el peor escenario razonable de alumnos por aula. El motor
lo calcula en la búsqueda de certeza y lo publica en su payload; el frontend lo
declara en el tipo y no lo pinta en ninguna superficie.

## Lo que NO hace este lote, y por qué

- **No se toca el default del motor R** (`calc_muestra_aulas.R:306`). Igual que
  en L31: mover un default de R hace que un proyecto viejo sin la clave cambie
  de comportamiento al abrirse, y eso reescribe marcos ya firmados sin que nadie
  lo pida. Los estudios nuevos sí nacen con el valor nuevo.
- **No se sesga el sorteo** para evitar celdas chicas. Ésa era una de las tres
  opciones que planteé y la que cambia las probabilidades de inclusión —y con
  ellas los pesos—. El candado por facultad resuelve el problema sin tocarlas.
- **No se agrupan estratos**. Sigue siendo una decisión de diseño muestral
  abierta, y el candado por facultad la vuelve menos urgente.
