# π de aulas en el wire — medición sobre hsvg2026 — 2026-09-24

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-09-24
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Tarea aparte del loop de Cálculo de muestra. El serializador global
(`plumber::serializer_unboxed_json(na = "null")`, `api/R/plumber_app.R`) deja
4 decimales: una π de 0.0000371 viaja como `0`. Muestra general ya sortea con
`digits = NA` (f2a0560c7). La pregunta era si las rutas de aulas deforman π o
pesos en un marco real.

**Veredicto: no hay daño. No se cambia ningún serializador.**

## Cómo

- Copia de `api/inst/reference_projects/hsvg2026/hsvg2026.pulso` (5.263
  cursos-horario), árbol en 7664c5f71 (incluye el reparto por mayor resto).
- Cada motor corrido directo con la config guardada; su salida serializada
  con `digits = 4` y con `digits = NA`, y comparada hoja numérica por hoja.
- Qué llega al cliente: a esta escala seleccionar, comparar y simular van
  por job y el resultado se lee de `GET /api/calc-muestra/state`
  (`aulas.selection`). La vía sync devuelve el mismo objeto. El cliente no
  reenvía `frame` ni `selection` (CalcMuestraPage.tsx:2060–2165), así que
  una π redondeada no vuelve al motor.

## Resultado

| Payload | π más chica publicada | Error máximo en el wire | ¿A 0 o a 1? |
|---|---|---|---|
| selección, cube (por defecto) | π_final 0.00456 | π: 0,94 % rel. (≤ 5·10⁻⁵ abs.) · peso: 3·10⁻⁶ rel. | no |
| selección, sistemático PPS | 0.00456 | ídem | no |
| selección, pivotal local | 0.00456 | ídem | no |
| selección, pool controlado (MC) | π_design 0.00456 · π_mc 0.0159 | π_design: 0,94 % · π_final: 0,17 % · peso: 4·10⁻⁵ | no |
| comparar-metodos | — | no publica π ni pesos | — |
| simular-reemplazos | — | no publica π ni pesos | — |
| certeza (15 estratos × 2 componentes) | — | ningún número cambia | — |

- Ninguna π entre 0 y 10⁻⁴; ninguna en [0.99995, 1), que es donde el
  redondeo convertiría una π en certeza (`esCerteza`, `pi >= 1 - 1e-9`).
- Las 2.013 `pi_final = 0` son la bolsa extra: cero por diseño, no por
  redondeo.
- El peso `weight_classroom = 1/π` se calcula en R y viaja con su precisión:
  el redondeo le quita a lo sumo 5·10⁻⁵ sobre valores de 13 a 219.

## El frontend no recalcula

`frontend/src/features/calcMuestra/universidad/aulas` sólo **muestra** π con
`fmtPct` (0,1 punto porcentual; la deformación del wire es 0,005 pp y no se
ve) y toma el peso de `weight_classroom`. La única derivación es
`fmtDec(1 / piEjemplo, 2)` en `AulasAuditoriaTab.tsx:145`, que sólo corre si
esa fila no trae peso — no pasa con π > 0.

## Cuándo reabrir

Una π de aulas cae bajo 5·10⁻⁵ sólo si un estrato tiene más de 20.000 veces
los elegibles de su aula más chica por aula sorteada; hsvg2026 queda a 219×.
Si aparece un marco así, o un motor que publique π cerca de 1 sin llegar,
aplicar a `GET /state` y a las rutas `aulas/*` el serializador con
`digits = NA`, midiendo antes el resto del `state` (el cambio lo afecta
entero).

De paso: en `profile_distributions`, una proporción de marco de 4.7·10⁻⁵
viaja como 0. No es π ni peso; sólo le quita a esa categoría el «<0.1%».
