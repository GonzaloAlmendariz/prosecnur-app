
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

## Dos defectos de la certificación, hallados al medir el éxito en las aulas finales (2026-08-26)

Al intentar medir la probabilidad de Derecho con sus 19 aulas finales aparecieron
dos problemas independientes. **Ninguno invalida la certificación original**, que
se corrió en la sesión que tenía el mapa de estudiantes vivo.

### 1 · La búsqueda descendente etiqueta mal los candidatos

Pedir `aulas_formula` **por encima** del número certificado hace que el motor
busque hacia abajo, y en ese camino **reporta la probabilidad de un candidato con
la etiqueta de otro**. Con `{DERECHO, cuota 363, tau 0.5683, aulas_formula: 19}`
devolvió `aulas_certeza: 4` con `probabilidad 0,9902`, y una curva no monótona
(4→0,9902 · 5→1 · 6→0,9951 · 8→0,9951 · 15→0,9951 · 19→1). Una probabilidad de
cobertura sólo puede crecer con el número de aulas: la no monotonía es la firma
del defecto.

El delator numérico es el rendimiento: la fila reportó `rendimiento_medio 394,11`
para «4 aulas», cuando la certificación buena daba 376,3 con 18. Cuatro aulas de
Derecho no pueden producir 394 encuestas contra una cuota de 363; 41 × 4 × 0,5683
≈ 93.

**Regla de uso:** certificar siempre desde un `aulas_formula` **igual o menor** al
que se quiere evaluar, para forzar el camino ascendente, que sí produjo la curva
correcta (16→0 · 17→0,2829 · 18→0,9512).

### 2 · Un `.pulso` reabierto no reproduce la certificación

Reabrir `HSVG26ULT.pulso` en una sesión nueva y re-certificar Derecho con los
mismos parámetros y el mismo `frame_hash` (`87df265f50d247b1…`) da un rendimiento
por aula **16 % más alto**:

| | 16 aulas | únicos implícitos | por aula |
|---|---|---|---|
| certificación original | 340,1 | 598 | 37,4 |
| sesión reabierta | 394,6 | 694 | 43,4 |

El P25 de Derecho es 41 elegibles por aula. Un valor **por debajo** de él (37,4)
es lo que se espera cuando se descuentan estudiantes repetidos entre aulas; uno
**por encima** (43,4) indica que no se está descontando nada. La sesión reabierta
perdió el mapa estudiante→aula, coherente con `student_ids_policy =
subrogados_sin_mapa` en el marco.

Consecuencia: **la certificación no es reproducible desde el proyecto guardado**,
sólo desde la sesión que la produjo. El sorteo del cubo sí puede serlo —usa las
variables de equilibrio, no el mapa de estudiantes— pero eso **no se verificó**
en esta sesión y no debe darse por hecho.

Por eso el documento reporta el éxito de Derecho con 19 aulas como **≥ 95,1 %**,
la cota que da su certificación a 18, y no un valor medido.
