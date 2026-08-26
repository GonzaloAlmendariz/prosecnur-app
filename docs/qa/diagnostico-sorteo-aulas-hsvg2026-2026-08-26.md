
## La cadena completa de τ, medida contra el motor (2026-08-26)

Reconstruida entera desde `state.rds` porque el documento metodológico afirmaba
la fórmula sin derivarla. Las tres verificaciones son exactas.

**τ se descompone en dos factores**, en `calc_muestra_aulas_frame$tasas_efectividad_facultad`:

```
τ_facultad = rendimiento_mix × factor_residual
rendimiento_mix = Σ(elegibles_tramo × tasa_tramo) / Σ elegibles_tramo
```

Reproduce τ en **15 de 15** facultades con diferencia < 0,0002.

**Los tramos de efectividad tienen cortes fijos** sobre `eligible_n`, y **no son**
los `size_group` G1–G4 (que cortan en 20/30/40):

| Tramo | ≤15 | 16–25 | 26–35 | 36–50 | 51+ |
|---|---|---|---|---|---|
| tasa | 0,80 | 0,69 | 0,56 | 0,55 | 0,44 |

Aplicar estos cortes reproduce `rendimiento_ref` en **1 512 de 1 512** aulas.
`rendimiento_ref × factor_facultad = tasa_efectividad_aula` con diferencia
máxima 0,0006, y `eligible_n × tasa_efectividad_aula = efectivas_esperadas` en
1 512 de 1 512.

**La fórmula de aulas** (`calc_muestra_engine.R:1355–1395`):

```
aulas_base = ⌈ cuota / (avg × τ) ⌉        avg = e$promedio_conglomerado
aulas_reemplazo = ⌈ aulas_base × 0,5 ⌉
```

Reproduce las 15 facultades y suma **165**.

> **`promedio_conglomerado` guarda el P25, no la media.** El campo se llama
> promedio y el modo del componente es `estadistico_conglomerado = "media"`,
> pero el valor almacenado coincide con el **primer cuartil** de `eligible_n`
> sobre las aulas `included` de esa facultad, exacto a 0,00 en las quince. La
> media real difiere hasta en 12 puntos (EGC: 52,9 vs 46,5 declarado). Quien
> lea el nombre del campo y asuma la media reproduce mal el dimensionamiento.

**El reparto por sexo es conteo, no estimación**: `sex_top_1_n + sex_top_2_n =
eligible_n` exacto en **174 de 174** aulas titulares. Total de la selección:
6 119 elegibles (3 015 mujeres, 3 104 hombres, 49,3 % mujeres) → 3 150 encuestas
esperadas (1 593 mujeres, 1 557 hombres).
