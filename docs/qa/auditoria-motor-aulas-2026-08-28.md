# Auditoría del motor de selección de aulas

Tipo: Auditoría QA del motor
Estado: Vigente
Fecha: 2026-08-28
Autoridad: Evidencia de QA; no reemplaza un ADR

Proyecto medido: `HSVG26ULT2.pulso` (segundo sorteo, semilla
202, 174 titulares sobre un marco de 1.392 cursos-horario).

Esta auditoría empezó por una pregunta sobre la matriz de selección: por qué
aparecían dos columnas de encuestas esperadas con nombres casi idénticos. Al seguir el hilo se destapó que el entregable y el motor calculan
cosas distintas, y de ahí en adelante cada verificación abrió otra. Se hizo en
paralelo con la sesión `claude/gallant-pike-78dba6`, que trabajó el mismo motor
desde el lado de la simulación de certeza; los hallazgos de una y otra se
verificaron cruzados y varios se corrigieron mutuamente.

Nada de lo que sigue invalida la selección de 174 aulas. Lo que cambia es qué
se puede afirmar sobre ella y qué número se promete.

## 1. El entregable y el motor no calculan lo mismo

Es el hallazgo que originó todo lo demás.

```
el MOTOR    efectivas_esperadas = elegibles × tasa del aula     157 de 174
MI EXCEL    Esperados           = elegibles × τ de facultad     174 de 174
```

La matriz de selección entregada al estudio usa la tasa de la facultad. El
motor usa la tasa del aula, que ajusta por el tamaño del salón. Sobre el
agregado la diferencia es de 7 encuestas (3.164 contra 3.157), pero **120 de
las 174 aulas cambian su pronóstico** y en los extremos la diferencia llega a
12 encuestas en una sola aula: un curso-horario de 53 elegibles en Arte y
Diseño espera 32 con la tasa de facultad y 20 con la suya propia.

Estado: **pendiente de reparar**. La decisión tomada es alinear el Excel con el
motor y mostrar los dos pronósticos con nombres que digan de qué depende cada
uno.

## 2. La calibración vigente es 6,4 % optimista y no se sabe de dónde sale

Las cinco tasas por tramo de tamaño que usa el motor son 0,80, 0,69, 0,56,
0,55 y 0,44. Recalculadas desde los 194 escalones aplicados de 2025, que es la
base que el propio archivo declara, dan 0,8091, 0,6422, 0,5657, 0,5005 y
0,4093.

El desvío se concentra donde hay más aulas: 16 a 25 elegibles con 7,4 % de
optimismo, 36 a 50 con 9,9 %, más de 50 con 7,5 %. Los tramos extremos casi no
se mueven.

Efecto sobre los 174 titulares: **3.157 encuestas esperadas contra 2.954 con la
calibración de su propia base**, un 6,4 % menos.

La procedencia no está explicada, y el archivo se contradice a sí mismo.
`calc_muestra_aulas_efectividad.R` línea 11 atribuye los valores a la
calibración 2025; la línea 85 dice que «la calibración embebida es de otra ola
y su producto no sale de esta descomposición». Seis reconstrucciones distintas
de la base 2025 (por escalón, por cadena, con y sin residual negativo, mediana
y promedio simple) le dan la razón a la segunda: ninguna produce esos números.

Dos hipótesis quedaron descartadas con evidencia. El desalineamiento de bins
(calibrar agrupando por matriculados y aplicar agrupando por elegibles, que el
encabezado declara como limitación de la v1) explica 0,8 de los 6,4 puntos: de
las 174 aulas solo 11 cambian de tramo, aunque las once en dirección optimista.
Y la idea de que los valores vinieran de las 230 aulas intentadas en vez de las
194 aplicadas se cae por el signo, porque sumar las 36 caídas bajaría el
rendimiento a 0,447 y lo embebido está por encima.

Estado: **abierto**. El efecto está medido; el origen no.

## 3. `rendimiento_tramos` tiene lector y no tiene escritor

El ADR 0082 describe unos tramos sellados por estudio. Ese sello nunca se
construyó: la clave aparece en un solo archivo de producción,
`calc_muestra_aulas_efectividad.R`, y sus seis apariciones son de lectura.
Ningún endpoint, función ni acción del frontend la escribe.

El contraste con la otra mitad del mismo plan es limpio: `por_facultad` sí
tiene su escritor en `calc_muestra_aulas_efectividad_sello.R`. Los cinco
proyectos del estudio muestran la huella: todos con cero tramos sellados y los
dos posteriores al sello con los seis residuales por facultad.

Consecuencia: corregir la calibración no es re-aplicar un sello perdido, es
construir el escritor que falta. Cambiar las constantes embebidas sería
reemplazar una cifra sin origen por otra, y afectaría a todos los proyectos.

Estado: **abierto**, pendiente de decisión.

## 4. La simulación de certeza colapsa los estratos

Hallazgo de la sesión paralela, verificado cruzado.

`calc_muestra_aulas_certeza.R` fuerza `rows$stratum <- rep(estrato$key, ...)`
antes de simular, con lo que los tres ejes de `strata_cols` se reducen a uno
solo, la facultad. La simulación pierde `sex_top_1` y `size_group`.

O sea: **la simulación que decide cuántas aulas hacen falta no sortea como
sortea el estudio**. Deja al PPS concentrarse en aulas grandes, que es
exactamente lo que la estratificación por tamaño le prohíbe.

Medido sobre Estudios Generales Letras con sus 20 aulas: el simulador colapsado
da media 416,0 y probabilidad de cumplir 0,988; el estratificado da 369,5 y
0,000. La selección real de esas mismas 20 aulas rinde 378,6. El que reproduce
la realidad es el que la certeza no corre.

Estado: **abierto**. Es el problema de primer orden en la cadena de
dimensionamiento.

## 5. El tamaño es eje de estratificación, no solo variable de balance

`strata_cols = faculty, sex_top_1, size_group` produce 76 estratos en el marco
de ULT2. El PPS opera dentro de cada estrato, con `π = n × elegibles ÷ Σ
elegibles` y el bucle estándar de unidades de certeza. Verificado: correlación
de 0,998 entre elegibles y probabilidad dentro del estrato, y proporcionalidad
exacta en 35 de 51 estratos evaluados.

La consecuencia es que el sesgo del PPS hacia aulas grandes no se materializa,
porque el PPS solo compite entre aulas que ya están en el mismo grupo de
tamaño:

```
marco, ponderado por elegibles                0,5503
PPS puro, ponderado por elegibles²            0,5214   razón 0,9475
PPS winsorizado, el que corre                 0,5231   razón 0,9505
realizado en las 174 titulares                0,5514   razón 1,0020
```

De paso: `mos_strategy = eligible_yield_winsorized` capea la medida de tamaño
al percentil 90, de modo que 136 de las 1.392 aulas entran al sorteo pesando
menos de lo que su tamaño indicaría. El aula más grande, de 72 elegibles, pesa
como si tuviera 58.

Estado: **verificado, sin acción**. Es el diseño funcionando como corresponde.

## 6. Tres parámetros del selector están inertes

`pps_weight = 0,25`, `coverage_weight = 1` y `duplicate_penalty = 1,35`
pertenecen al score heurístico de `.cm_aulas_candidate_score`, que es un
fallback. La rama que corre es la del objetivo de representatividad, y esa
penaliza el solape con un factor 2 fijo que ignora el `duplicate_penalty`
configurado. Como en ULT2 el objetivo dio 72,4, los tres nunca se evaluaron.

Siguen apareciendo en la configuración y en el snapshot de comparación, así que
se leen como parámetros vivos.

Estado: **verificado**. Conviene que la superficie declare que son del
fallback.

## 7. El objetivo de representatividad casi no mira el tamaño

```
faculty 0,76   program 0,10   level 0,06
schedule 0,05   modality 0,02   size_group 0,01
```

El criterio que elige entre los 500 candidatos pesa tres cuartas partes
facultad. Al tamaño le da un uno por ciento. Eso reencuadra la mejora de
representatividad entre los dos sorteos, de 64,5 a 72,4: es casi enteramente
mejora de composición por facultad.

Estado: **verificado, sin acción**.

## 8. La comparación de métodos no comparó

El motor tiene cuatro métodos: `cube_balanceado`, `sistematico_pps`,
`local_pivotal_balanceado` y `estratificado_aleatorio`.

En ULT2 la comparación no existe: la clave no está en el proyecto porque el
marco cambió y no se regeneró. La de ULT1, que sí está, evaluó **un solo
método** con `n_aulas = 30` cuando el sorteo real fue de 174, y recomendó el
único que evaluó.

`cube_balanceado` está elegido por fundamento metodológico y está declarado, con
referencias a PISA 2022, TIMSS/PIRLS y Statistics Canada. Eso es legítimo. Lo
que no se puede afirmar es que ganó una comparación.

Estado: **pendiente de corregir en el documento**. La sección 6 del diseño
muestral debería decir «elegido por fundamento metodológico».

## 9. Dos columnas de elegibles netos que miden cosas distintas

Sobre las 174 titulares:

```
eligible_n         6.098    brutos
eligible_n_neto    5.760    descuenta repetidos solo DENTRO del estrato
unique_added       5.395    descuenta repetidos globalmente
```

`eligible_n_neto` es exacto dentro del alcance de la certeza, que simula un
estrato a la vez, y deja de serlo al evaluar una selección completa de varias
facultades. Las dos sesiones tropezamos con esto: yo usando la columna
equivocada para calcular cobertura, ella acotando su validación.

Estado: **verificado**. Conviene que el nombre declare el alcance.

## 10. La vara de únicos por τ es un doble descuento

τ se midió en 2025 con `denominador = elegibles_presentes` y `unidad =
encuentro_en_curso_horario_aplicado`, una fila por aula. Un alumno presente en
dos aulas aplicadas está dos veces en el denominador de 6.232 pero solo puede
aportar una encuesta al numerador de 3.303. El campo `ya_medidas = 446` lo
publica: en 2025 un alumno ya encuestado no volvía a contar.

Es decir, **el traslape de 2025 ya está dentro de la tasa**. Multiplicar los
estudiantes únicos de 2026 por esa tasa lo descuenta por segunda vez y produce
un déficit falso de unas 370 encuestas.

La corrección no es volver a la vara bruta, porque el traslape incrustado
(7,2 %) no es el de 2026 (11,5 %) y además no es uniforme: va de 1,000 en tres
facultades a 1,2115 en Educación. La vara correcta limpia la tasa de su
traslape 2025 y recién entonces la aplica a los únicos de 2026.

Y las tres facultades con factor 1,000 son las tres con menos aulas aplicadas
en 2025 (k = 2, 3 y 4). Ese cero no es una propiedad de la facultad, es falta
de oportunidad de observarlo, y merece la misma guarda de k mínimo que ya tiene
el factor residual.

Estado: **verificado**. Cambio de contrato, necesita ADR.

## 11. Los tramos no son monótonos

Con las tasas por tramo, un aula con un elegible más puede esperar menos
encuestas:

```
25 elegibles × 0,69 = 17,25   →   26 × 0,56 = 14,56   (−16 %)
50 elegibles × 0,55 = 27,50   →   51 × 0,44 = 22,44   (−18 %)
```

Sobre el marco de ULT2, 3.796 de 133.728 pares de aulas de la misma facultad
están invertidos (2,8 %), y 190 de las 1.392 aulas están a un elegible de un
borde de tramo (13,6 %).

La sesión paralela evaluó reemplazar los cinco escalones por una curva
continua. En validación cruzada la curva no mejora la precisión (empata con los
tramos, p = 0,47) salvo una variante quasibinomial que gana 0,150 encuestas
(p = 0,012), pero sí **elimina las inversiones de raíz** por ser monótona
creciente. El argumento para la curva es la monotonicidad, no la precisión.

Estado: **decidido** el 2026-08-28 por el [ADR 0083](../adrs/0083-la-calibracion-de-rendimiento-se-sella-y-es-monotona.md), implementación pendiente. Se eligió la curva por su monotonicidad, y al medir para
decidir se confirmó sobre el `.pulso` vigente el hallazgo del lector sin escritor:
`rendimiento_tramos` es NULL y las tres piernas están vacías en las 1.392 aulas, así
que HSVG2026 corre sobre la calibración embebida (0,80 · 0,69 · 0,56 · 0,55 · 0,44) y
no sobre los tramos de la tabla de piernas. Sellar el respaldo va antes que curvar.

## Implicancias para HSVG2026

Acumulando las correcciones que están medidas, sobre los 174 titulares:

| Escenario | Total | Cobertura | Peor facultad | Bajo 1 |
|---|---:|---:|---:|---:|
| Publicado, calibración vigente y bruto | 3.157 | 1,263 | 1,111 | 0 de 15 |
| Con la calibración de su base 2025 | 2.954 | 1,182 | 1,039 | 0 de 15 |
| Además con el descuento de repetidos | 2.814 | 1,126 | 0,972 | 2 de 15 |

En el escenario más completo quedan por debajo de su cuota **Estudios
Generales Letras (0,972) y Estudios Generales Ciencias (0,992)**, con Derecho
al filo en 1,031. El total sigue sobrando un 12,6 %.

Por dos caminos independientes se llega a la misma facultad: esta auditoría por
calibración y traslape, y la sesión paralela por la simulación estratificada,
que le da a Estudios Generales Letras probabilidad 0,286 de cumplir con sus 20
aulas. Esa coincidencia vale más que cualquiera de los dos cálculos por
separado.

Ninguna de estas correcciones cambia qué aulas se sortearon. Cambian el número
que el estudio promete obtener de ellas.

## Cómo se verificó

Todo se midió sobre el `state.rds` extraído de `HSVG26ULT2.pulso` (27-08 16:10)
y contra la matriz de selección entregada. Los scripts quedaron en el
scratchpad de la sesión. Las verificaciones cruzadas con
`claude/gallant-pike-78dba6` corrigieron cuatro afirmaciones que habrían
quedado en firme siendo falsas:

- La mía de que τ era conservador. Es al revés en la esperanza, aunque el
  efecto no se materializa por la estratificación.
- La mía de que la diferencia entre tasas no era significativa. Estaba medida
  sobre cadenas en vez de escalones.
- La suya de que τ era optimista hasta un 4,6 %. Vale para un PPS global, que
  no es el diseño.
- La suya de que el binning explicaba el 6 % de la calibración. Explica 0,8.

Ninguna de las cuatro se habría detectado sin la otra sesión midiendo lo mismo
por otro camino.
