# Checklist — la certeza de cobertura simula con τ y no con la tasa del aula

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-08-28
Autoridad: Evidencia del análisis que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Doc vivo: se marca conforme se cierra cada ítem y **sólo Gonzalo lo da por
terminado**.

## El encargo, textual

> «Tarea: evaluar cambiar la simulación para que use la tasa por aula,
> cuantificar el impacto sobre el total de titulares del estudio HSVG2026 (hoy
> 174), y decidir si se adopta o si se documenta el conservadurismo como
> deliberado. Si se adopta, hace falta test de regresión en
> `api/tests/testthat/` que fije el comportamiento, y actualizar la sección 4
> del documento de diseño muestral, que hoy describe la simulación sin
> mencionar qué tasa usa.»

Y la restricción, también suya: **no se cambia sobre un estudio en curso**.

## El checklist

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Reproducir la medición de Ciencias Contables (45 parejas, p05, la pareja 14+16) | scratchpad `conta_pares.R` | ☑ **cerrado** — reproduce los seis números al decimal |
| 2 | Nombrar el mecanismo: por qué el sesgo es sistemático y de qué depende su signo | `calc_muestra_aulas_efectividad.R:388` | ☑ **cerrado** — τ **es** la media de la tasa del aula ponderada por elegibles; verificado sobre el proyecto vivo |
| 3 | Barrido de superficies: quién más contesta «¿alcanza la cuota?» y con qué tasa | `certificacion.R` · `certeza.R` · `monitoreo_aulas_metas_diseno.R` | ☑ **cerrado** — tres superficies, dos ya prefieren la tasa del aula |
| 4 | La forma del cambio con traslape presente | `.cm_certeza_evaluar` | ☑ **cerrado** — `netos × tasa ponderada de las sorteadas`; hay además `eligible_n_neto` por aula |
| 5 | Impacto sobre HSVG2026: certeza por facultad con las dos tasas, sorteos pareados | proyecto vivo `HSVG26ULT.pulso` | ☑ **cerrado** — 15 facultades, sorteos pareados, 1 000 corridas |
| 6 | Traducir el impacto a titulares | `Σ max(fórmula, certeza)` | ☑ **cerrado** — **174 → 175**, sube en vez de bajar |
| 7 | Decisión: adoptar o declarar el conservadurismo deliberado | `calc_muestra_aulas_certeza.R` (bloque sobre `.cm_certeza_evaluar`) | ◐ **recomendación puesta y motor documentado**; la ratifica Gonzalo |
| 8 | Si se adopta: test de regresión | `api/tests/testthat/test-calc-muestra-aulas-certeza.R` | 🔒 **bloqueado** — depende de la 7; el trabajo está especificado abajo |
| 9 | Si se adopta: sección del documento de diseño muestral | `~/Documents/Pulso/HSTVG2026/Diseno-muestral-HSVG2026_v2.html` | 🔒 **bloqueado** — depende de la 7; y el documento ya dice qué tasa usa (ver abajo) |
| 10 | *Nuevo*: reconciliar bruto/neto entre `certificacion.R` y `certeza.R` | `calc_muestra_aulas_certificacion.R` | ☐ **abierto** — 365 encuestas y el veredicto de EE.GG. Letras |
| 11 | *Nuevo*: el ADR 0082 describe tramos sellados que el proyecto vivo no tiene | `docs/adrs/0082-la-tau-del-diseno-…md` | ☐ **abierto** |

## Ítem 2 — el mecanismo, exacto

`calc_muestra_aulas_tasas_facultad()` define la τ de la facultad como

```
τ_F = Σ_F (elegibles_i · tasa_efectividad_aula_i) / Σ_F elegibles_i
```

es decir, **τ es la media de la tasa del aula ponderada por elegibles sobre el
marco entero de la facultad**. Verificado sobre `HSVG26ULT.pulso`: Ciencias
Contables tiene 10 aulas de 14, 16, 17, 17, 18, 19, 25, 27, 28 y 29 elegibles con
tasas 0,80 · 0,69×6 · 0,56×3, y su media ponderada da 0,6453 — exactamente el
`aulas_por_estrato$tau` que el estudio publica.

De ahí sale todo lo demás:

- Las dos tasas **coinciden exactamente** cuando la mezcla de tamaños de lo
  sorteado reproduce la mezcla de la facultad.
- τ **sobre-acredita** las aulas grandes y **sub-acredita** las chicas. No es un
  error de un signo: por sorteo tiene los dos. Se vuelve de un solo signo en la
  **decisión** porque la decisión mira un cuantil bajo.
- Que el cuantil bajo salga siempre a favor de la tasa por aula depende de que
  el rendimiento **caiga** con el tamaño. Los tramos son dato sellado del
  estudio (`cfg$efectividad$rendimiento_tramos`), no código: una calibración con
  la pendiente al revés invierte el signo. El colchón de hoy es un accidente de
  la calibración vigente, no una propiedad del método.

## Ítem 3 — tres superficies contestan «¿alcanza la cuota?», con dos tasas

| Superficie | Cuándo | Qué tasa usa |
|---|---|---|
| `calc_muestra_aulas_certeza.R:181` (Monte Carlo ex ante) | antes de sortear | **τ de la facultad** |
| `calc_muestra_aulas_certificacion.R:179` (certificación de lo sorteado) | después de sortear | **tasa del aula** — suma `efectivas_esperadas`; τ plana es el *fallback declarado* |
| `monitoreo_aulas_metas_diseno.R:155` (meta de campo) | durante el campo | **tasa del aula** cuando la fila la trae; τ plana como fallback |

Dos de las tres ya prefieren la tasa del aula y sólo caen a τ cuando el dato no
está. La certeza es la única que **no tiene camino** hacia la tasa del aula.

## Ítem 4 — cómo se aplica la tasa por aula cuando hay traslape

El motor no suma elegibles: cuenta **estudiantes únicos netos**, y ahí un
estudiante que está en dos aulas sorteadas cuenta una vez. La forma mínima que
conserva ese descuento es

```
rendimiento = netos × ( Σ_sorteadas elegibles_i · tasa_i / Σ_sorteadas elegibles_i )
```

que se reduce a `Σ elegibles_i · tasa_i` exactamente cuando no hay traslape —el
caso de la medición de Contabilidad—.

Pero hay una forma **mejor y ya disponible**. `.cm_descuento_annotate_post_hoc`
escribe `eligible_n_neto` en cada fila sorteada: los estudiantes que ningún aula
anterior de ese estrato cubrió. Verificado sobre el marco vivo con un sorteo de
3 aulas de Contabilidad, `Σ eligible_n_neto` = 71 y los estudiantes únicos que
cuenta la certeza = 71, **idénticos**. Así que la forma exacta es

```
rendimiento = Σ_sorteadas eligible_n_neto_i · tasa_efectividad_aula_i
```

sin promedios ni reconstrucciones: cada estudiante se atribuye al aula que
primero lo cubre y responde a la tasa de esa aula. Es también la única de las
dos que decide, en vez de promediar, qué le pasa a un estudiante que está en un
aula chica y en una grande a la vez.

## El documento (ítem 9)

Es `~/Documents/Pulso/HSTVG2026/Diseno-muestral-HSVG2026_v2.html` (y su PDF,
generados el 27-08), cuyas once secciones son las de
`salidas/sustentoSecciones.ts`. Dos precisiones sobre el encargo:

- La sección **4** es «τ: cuántas encuestas produce un aula». La simulación se
  describe en la **5.2**, «Por qué la cuenta directa se queda corta, y cómo lo
  resuelve la simulación de Monte Carlo».
- El documento **sí dice qué tasa usa**: el recuadro «Cuál se usa para qué» de
  la 4.5 declara que «τ de la facultad se usa en el dimensionamiento: cuántas
  aulas pedir (sección 5), cuántas encuestas esperar de una facultad **y la
  certificación por simulación**», y reserva la efectividad del aula para «la
  planificación operativa». Es decir: **el reparto ya está escrito como
  deliberado**, con τ de parámetro de diseño y la tasa del aula de parámetro de
  campo.

Lo que el documento no dice —y es lo que faltaría— es que la certificación *de
lo sorteado* (`certificacion.R`) usa la otra tasa, ni qué cuesta la elección.

## Lo que la medición sobre el proyecto vivo cambió del encargo

Todo lo de abajo está medido sobre `~/Documents/Pulso/HSTVG2026/HSVG26ULT.pulso`
(guardado el 26-08 09:33, el sorteo vigente de 174 titulares, run
`sel_aulas_20260826092810_dac38b6b`), leído en copia y sin tocar el archivo. Su
marco trae `unique_student_ids` parseables y su certeza guardada declara
`estratos_sin_ids = 0`, así que las cifras salen de estudiantes únicos y no de
la cota superior.

### Hallazgo 1 — la aritmética de Contabilidad es exacta; la extrapolación no llega

Las 45 parejas reproducen al decimal: media 27,1 con las dos tasas, p05 20,1
contra 22,8, la peor pareja 19,36 contra 22,24, una discordancia en un sentido y
cero en el otro. Pero **el motor no sortea parejas al azar uniforme**. Medido con
1 000 sorteos reales de 2 aulas sobre Ciencias Contables, con el
`cube_balanceado` y la config del estudio:

| | enumeración de las 45 parejas | 1 000 sorteos reales |
|---|---|---|
| parejas distintas | 45 | **21** |
| la peor (14+16) | aparece | **nunca aparece** |
| rendimiento medio con τ | 27,1 | 26,4 |
| rendimiento medio con tasa por aula | 27,1 | **25,6** |
| p05 con τ | 20,1 | **12,3** |
| p05 con tasa por aula | 22,8 | **13,8** |
| éxito (≥ 20) con τ | 44/45 | **78,9 %** |
| éxito (≥ 20) con tasa por aula | 45/45 | **76,0 %** |

Dos cosas lo explican, y las dos faltaban en la enumeración:

1. **El sorteo está balanceado por tamaño.** El cubo evita justamente la pareja
   de dos aulas chicas, que es la que sostiene el titular del hallazgo. De 45
   parejas posibles sólo 21 ocurren.
2. **El traslape es lo que mata la cola, y es ajeno a la tasa.** En los peores
   sorteos 31 elegibles se quedan en **19 estudiantes únicos** (39 %). El p05 de
   12,3 sale de ahí —19 × 0,6453 = 12,26—, no de la tasa. La enumeración de
   parejas sumó elegibles y por eso no lo vio.

Y el signo se invierte donde importa: la tasa media de lo sorteado (0,6370) queda
**por debajo** de la τ del marco (0,6453), porque el sorteo balanceado se lleva
más aulas grandes —de tasa baja— de las que pesa el marco. Con la tasa por aula
Contabilidad certifica **igual en 3**, y su probabilidad con 2 aulas **baja** de
78,9 % a 76,0 %.

### Hallazgo 2 — la inconsistencia grande no es la tasa: es el traslape

Sobre los 174 titulares realmente sorteados:

| | |
|---|---|
| elegibles (bruto) | 6 119 |
| estudiantes únicos | **5 422** (11,4 % de traslape) |
| Σ `efectivas_esperadas` — lo que certifica `certificacion.R` | **3 148,9** |
| únicos × τ — la vara de la certeza | **2 812,4** |
| esperada neta, atribuyendo cada único al primer aula que lo cubre | **2 784,3** |
| cuota total | 2 500 |

La distancia entre las dos varas es de **365 encuestas (11,6 %)**, y casi toda es
traslape: el efecto de la tasa es de 1–3 %. `certificacion.R` suma
`efectivas_esperadas` sobre elegibles **brutos** y no descuenta a nadie, mientras
la certeza cuenta únicos. Es la misma pregunta contestada con dos denominadores.

Y muerde donde el diseño está más ajustado. **Estudios Generales Letras** con sus
20 titulares:

| vara | resultado | contra su cuota de 397 |
|---|---|---|
| Σ `efectivas_esperadas` (certificación vigente) | 440,6 | **1,11 — certificada** |
| únicos × τ (vara de la certeza) | 379,2 | **0,955 — no llega** |
| esperada neta con tasa por aula | 389,1 | **0,980 — no llega** |

Lo mismo en las celdas por sexo, que es donde el documento dice que el margen es
más estrecho. EE.GG. Letras, 20 titulares, 1 023 elegibles brutos y 904 únicos
(11,6 % de traslape):

| celda | cuota | elegibles brutos × τ | cobertura | con el mismo descuento de repetidos | cobertura |
|---|---|---|---|---|---|
| mujeres | 240 | 260,5 | 1,085 | 230,2 | **0,959** |
| hombres | 157 | 168,6 | 1,074 | 149,0 | **0,949** |

(El descuento se reparte proporcional entre sexos: `sex_top_1/2_n` son
agregados por aula, así que el traslape exacto por sexo no es medible desde el
marco. La aproximación no cambia el signo.)

La sección 7.2 del documento de diseño publica «las treinta celdas cierran» con
EE.GG. Letras hombres en 1,081 como la más ajustada. Ese 1,08 está calculado
sobre elegibles brutos; con el descuento de repetidos que la propia certeza
aplica, la facultad queda por debajo de su cuota. **No es un defecto de campo**
—la cadena de reemplazos y la reserva del 50 % existen para eso— pero sí son dos
superficies del mismo estudio afirmando cosas opuestas sobre la misma facultad.

### Hallazgo 3 — adoptar la tasa por aula vacía el parámetro τ del endpoint

No es un cambio de una línea. Hoy `POST /api/calc-muestra/aulas/certeza` recibe
`estratos[].tau`, lo valida en `.cm_certeza_normalize_estratos`, lo publica en
cada fila y la pantalla lo muestra; el frontend lo arma en
`certezaEstratosDesdeResultado`. Si la simulación pasa a leer
`tasa_efectividad_aula` del marco, **τ deja de gobernar nada** y queda como
fallback para marcos sin la columna. Eso es una decisión de contrato, no una
corrección.

Y los fixtures de `test-calc-muestra-aulas-certeza.R` **sí traen la columna**:
verificado, un marco de aulas de 20 elegibles sale con
`rendimiento_ref = 0,69`, `factor_facultad = 1` y `tasa_efectividad_aula = 0,69`,
aunque el test declare `tau = 1`. Así que la mitad del archivo cambia de
resultado:

- «con aulas iguales y disjuntas el minimo es exactamente la division entera
  hacia arriba» pasa de **5 a 8** aulas. Medido, no deducido: sobre el fixture
  del propio test, hoy la certeza da 5 con p = 1,000, y con la tasa por aula la
  probabilidad es 0,000 en 5, 6 y 7 aulas y 1,000 en 8 (cada aula rinde
  20 × 0,69 = 13,8 y la cuota es 100).
- «tau mas bajo exige mas aulas para la misma cuota» **pierde su premisa**: con
  τ = 1 y τ = 0,5 el resultado sería el mismo, porque ninguna de las dos entra
  en la cuenta.
- «la brecha se mide contra la formula declarada», «el total agrega la brecha» y
  «los faculty_targets del diseno no fijan el candidato» mueven sus cifras.

Actualizar un contrato que cambió a propósito es normal, pero hay que contarlo
en el precio: son seis pruebas reescritas y un campo público del endpoint que pasa a
significar otra cosa.

### Al margen — el ADR 0082 describe unos tramos que el proyecto vivo no tiene

El [ADR 0082](../adrs/0082-la-tau-del-diseno-es-un-supuesto-fechado-y-el-campo-lo-contrasta.md)
dice: «En HSVG2026 los tramos sellados van de 0,809 (≤15 elegibles) a 0,409
(>50)». En `HSVG26ULT.pulso` **`cfg$efectividad$rendimiento_tramos` está vacío**:
lo único sellado son los seis residuales por facultad, con `tau_base = 1`. El
rendimiento sale de la calibración embebida y las tasas del marco guardado son
0,80 · 0,69 · 0,56 · 0,55 · 0,44 —las mismas que publica la sección 4.1 del
documento de diseño—, no las del plan 1b. Efecto colateral verificable: la
columna `tasa_asistencia_aula` existe en el marco y está en NA en las 5 269
filas, porque sin tramos sellados no hay descomposición en piernas.

No cambia ninguna conclusión de este checklist, pero el ADR describe una
calibración que el estudio no está usando.

### Hallazgo 4 — el sesgo de τ existe, pero apunta al otro lado del que se supuso

La τ de la facultad es la media de la tasa del aula **ponderada por elegibles
sobre el marco**:

```
τ_F = Σ_F e_i·r_i / Σ_F e_i
```

El sorteo, en cambio, toma las aulas con probabilidad proporcional a su tamaño
(PPS / MOS por rendimiento elegible). La tasa media de lo que ese sorteo se
lleva no es τ_F sino la media ponderada **por el cuadrado** del tamaño:

```
E[τ_sorteado] = Σ_F e_i²·r_i / Σ_F e_i²
```

y la diferencia entre las dos es la covarianza entre tamaño y tasa, que es
**negativa por construcción** —los tramos hacen que el rendimiento caiga con el
tamaño—. Es decir: **el sorteo se lleva sistemáticamente aulas más grandes que
la media del marco, que son las de tasa más baja, y τ_F no lo sabe.**

Medido sobre las 1 512 aulas elegibles del marco vivo (el marco trae 5 269 filas;
1 512 sobreviven a los criterios), facultad por facultad:

| Facultad | aulas | τ_F | E[τ sorteado] | razón |
|---|---|---|---|---|
| EDUCACION | 17 | 0,6452 | 0,6153 | 0,954 |
| ARTES ESCÉNICAS | 58 | 0,7525 | 0,7232 | 0,961 |
| ARQUITECTURA Y URBANISMO | 20 | 0,5485 | 0,5291 | 0,964 |
| ARTE Y DISEÑO | 110 | 0,6121 | 0,5907 | 0,965 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 21 | 0,7105 | 0,6867 | 0,967 |
| CIENCIAS CONTABLES | 10 | 0,6453 | 0,6294 | 0,975 |
| ESTUDIOS GENERALES CIENCIAS | 143 | 0,4087 | 0,4002 | 0,979 |
| CIENCIAS E INGENIERIA | 417 | 0,5299 | 0,5205 | 0,982 |
| CIENCIAS SOCIALES | 60 | 0,5529 | 0,5439 | 0,984 |
| ESTUDIOS GENERALES LETRAS | 148 | 0,4188 | 0,4140 | 0,989 |
| GESTIÓN Y ALTA DIRECCIÓN | 49 | 0,5659 | 0,5598 | 0,989 |
| CIENCIAS Y ARTES DE LA COMUN. | 98 | 0,6736 | 0,6663 | 0,989 |
| DERECHO | 293 | 0,5680 | 0,5631 | 0,991 |
| PSICOLOGÍA | 54 | 0,6767 | 0,6755 | 0,998 |
| LETRAS Y CIENCIAS HUMANAS | 14 | 0,8000 | 0,8000 | 1,000 |

**La razón es ≤ 1 en las quince.** Letras y CC.HH. da exactamente 1 porque sus
catorce aulas caben en un solo tramo: sin dispersión de tamaños no hay nada que
sesgar, que es la misma razón por la que las dos tasas coinciden.

Consecuencia: usar τ en la simulación **no es conservador en la media, es
optimista** —entre 0 % y 4,6 % según la facultad—. Lo que sí es conservador es la
**cola**, porque multiplicar por una constante conserva toda la dispersión de los
únicos netos, mientras que la tasa por aula la comprime (las aulas chicas rinden
más por elegible y compensan). Los dos efectos empujan en sentidos opuestos y
cuál gana en el umbral del 95 % es cuestión de medirlo, facultad por facultad.

### Cómo se midió, y cómo sé que el arnés no miente

La comparación es **pareada**: un solo evaluador sortea una vez por candidato y
publica los dos rendimientos sobre el MISMO conjunto sorteado. Las semillas del
motor dependen sólo de `(estrato, n)` —`semilla + i·15485863 + n·104729 + j·7919`—
así que los dos brazos ven exactamente los mismos sorteos y la diferencia no
puede venir del azar. Se corrió con la config, la semilla, el motor
(`cube_balanceado`) y las 1 000 corridas del estudio, y con la misma escala de
corridas por tamaño de marco que aplica `.cm_certeza_corridas`.

La guarda contra el verde falso es que el brazo τ tiene que reproducir la certeza
**guardada** en el `.pulso`, medida por la app el 26-08 a las 13:04 sobre el mismo
`frame_hash` (`87df265f…`). Reproduce en todas las facultades salvo **Derecho**,
donde el brazo τ pide 19 y la corrida guardada pidió 18. No es una discrepancia
del arnés: la corrida guardada certificó Derecho con **p = 0,951** sobre 205
sorteos, y el error de muestreo de una probabilidad ahí es de ±1,5 puntos —lo
dice la propia sección 5.2 del documento de diseño—. Derecho está exactamente en
la moneda al aire, y por eso importa que la comparación sea pareada: **los dos
brazos de esta medición dan 19**, así que la diferencia entre tasas en Derecho
es cero aunque el nivel absoluto baile.

## Ítems 5 y 6 — el impacto sobre HSVG2026, medido

Quince facultades, sorteos pareados, `cube_balanceado`, semilla y config del
estudio, 1 000 corridas escaladas por tamaño de marco:

| Facultad | disp. | cuota | τ | fórmula | p con la fórmula (τ → aula) | p05 (τ → aula) | certeza τ | certeza aula |
|---|---:|---:|---:|---:|---|---|---:|---:|
| ARQUITECTURA Y URBANISMO | 20 | 125 | 0,5461 | 8 | 1,000 → 1,000 | 148,0 → 152,6 | 7 | 7 |
| ARTE Y DISEÑO | 110 | 119 | 0,6041 | 15 | 1,000 → 1,000 | 138,9 → 140,2 | 13 | 13 |
| ARTES ESCÉNICAS | 58 | 64 | 0,7399 | 8 | 0,992 → 0,998 | 68,8 → 71,1 | 8 | 8 |
| CIENCIAS CONTABLES | 10 | 20 | 0,6453 | 2 | 0,789 → 0,760 | 12,3 → 13,8 | 3 | 3 |
| CIENCIAS E INGENIERIA | 417 | 528 | 0,5297 | 37 | 1,000 → 1,000 | 581,1 → 573,2 | 34 | **35** |
| CIENCIAS SOCIALES | 60 | 149 | 0,5482 | 12 | 0,969 → 0,960 | 151,3 → 150,8 | 12 | 12 |
| CIENCIAS Y ARTES DE LA COMUN. | 98 | 84 | 0,6689 | 7 | 0,990 → 0,990 | 88,3 → 88,3 | 7 | 7 |
| DERECHO | 293 | 363 | 0,5683 | 16 | 0,000 → 0,000 | 325,7 → 322,5 | 19 | 19 |
| EDUCACION | 17 | 24 | 0,6226 | 3 | 1,000 → 1,000 | 30,5 → 31,0 | 3 | 3 |
| ESTUDIOS GENERALES CIENCIAS | 143 | 403 | 0,4087 | 22 | 0,964 → **0,831** | 405,4 → 395,9 | 22 | **23** |
| ESTUDIOS GENERALES LETRAS | 148 | 397 | 0,4195 | 18 | 0,017 → 0,000 | 366,0 → 363,9 | 20 | 20 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 21 | 21 | 0,6819 | 3 | 0,999 → 1,000 | 25,9 → 27,2 | 3 | 3 |
| GESTIÓN Y ALTA DIRECCIÓN | 49 | 105 | 0,5684 | 6 | 0,806 → 0,746 | 98,9 → 99,1 | 7 | 7 |
| LETRAS Y CIENCIAS HUMANAS | 14 | 23 | 0,8000 | 3 | 0,908 → 0,908 | 21,6 → 21,6 | 4 | 4 |
| PSICOLOGÍA | 54 | 75 | 0,6760 | 5 | 0,655 → 0,613 | 69,6 → 69,1 | 6 | 6 |
| **TOTAL** | 1 512 | 2 500 | | **165** | | | **174** | **175** |

Donde el total es `Σ max(fórmula, certeza)`, que es la regla que el estudio
aplica (sección 5.3 del documento de diseño).

**El resultado, en una línea: la tasa por aula sube el total de 174 a 175, no lo
baja.**

Tres lecturas del cuadro:

1. **Trece de quince facultades no se mueven.** Sólo dos cambian su mínimo
   certificado, y las dos en el mismo sentido: **más aulas**. Ciencias e
   Ingeniería pasa de 34 a 35 —que no muerde, porque su fórmula pide 37— y
   Estudios Generales Ciencias de 22 a 23, que sí muerde y es el aula extra.
2. **Letras y CC.HH. sale idéntica en todas las cifras** —p 0,908 y 0,908,
   p05 21,6 y 21,6, certeza 4 y 4—, y tenía que salir así: sus catorce aulas
   caben en un solo tramo, con lo que la tasa del aula y τ son literalmente el
   mismo número. Es el control que prueba que el arnés compara dos cosas y no
   una consigo misma.
3. **Los dos efectos se ven separados en el cuadro.** Donde la facultad tiene
   aulas chicas (Gastronomía, Artes Escénicas, Arquitectura, Educación) el p05
   sube y la probabilidad mejora: ahí manda la compresión de la cola. Donde
   tiene aulas grandes y va ajustada (EE.GG. Ciencias, con mediana de 58
   elegibles y p = 0,964) manda la penalización de la media, y la probabilidad
   se desploma a 0,831.

### El ±1 de Derecho, que no es de este cambio

La corrida guardada certificó Derecho en **18** con p = 0,951; esta re-corrida,
con la misma config y el mismo motor, lo certifica en **19**. Es la misma
medición dando dos respuestas: con 205 sorteos el error de una probabilidad
cercana a 0,95 es de ±1,5 puntos y Derecho está justo encima de la raya. **Los
dos brazos de esta medición dan 19**, así que la diferencia entre tasas en
Derecho es cero; lo que baila es el nivel absoluto. Dicho de otro modo: el ruido
de la simulación en Derecho vale tanto como todo el efecto de cambiar de tasa en
las quince facultades juntas.

## Ítem 7 — la decisión

**Recomendación: no hacer el cambio como está planteado, y no ahora. Declararlo
explícito en el motor —hecho en esta tanda— y dejar la adopción como una
decisión de contrato para después de que HSVG2026 cierre campo.** Las razones,
en orden de peso:

1. **La premisa del encargo no sobrevive a la medición.** «El error va hacia el
   lado seguro (sobredimensiona, nunca subdimensiona)» es al revés en la media:
   τ es **optimista** entre 0 % y 4,6 % porque el sorteo se lleva aulas más
   grandes que la media del marco. Y en la decisión, adoptar la tasa por aula
   **sube** el total de 174 a 175. Ninguna facultad se abarata.
2. **El efecto es del tamaño del ruido.** Un aula de diferencia en quince
   facultades, contra un ±1 que la propia simulación tiene en Derecho por correr
   con 205 sorteos. Cambiar el contrato del endpoint por eso no se paga.
3. **Pero el sesgo es real y no debe quedar implícito.** Que hoy no cambie casi
   nada es una propiedad de la calibración vigente, no del método: los tramos
   son dato sellado del estudio y una curva con otra pendiente movería el signo.
   Por eso lo que sí corresponde ahora es dejarlo escrito donde se decide
   —hecho, en `.cm_certeza_evaluar`—.
4. **La inconsistencia que sí vale la pena está en otro lado.** El
   traslape entre `certificacion.R` (bruto) y `certeza.R` (únicos netos) vale
   **365 encuestas** sobre el sorteo vigente y da vuelta el veredicto de EE.GG.
   Letras: 1,11 en una superficie, 0,96 en la otra. Es un orden de magnitud más
   que el 1–3 % de la tasa, y es una contradicción entre dos pantallas del mismo
   estudio, no una elección de modelo.

Si Gonzalo decide adoptarla igual —es una decisión legítima: la tasa por aula
**es** el estimador correcto de un sorteo PPS y las otras dos superficies ya la
usan—, el trabajo es:

- `rendimiento = Σ eligible_n_neto_i × tasa_efectividad_aula_i`, con la τ
  declarada como fallback cuando el marco no traiga la columna (la misma forma
  que `suma_esperadas` / `tasa_plana` en `certificacion.R`).
- ADR: `estratos[].tau` deja de gobernar la simulación y pasa a fallback.
- Seis pruebas de `test-calc-muestra-aulas-certeza.R` reescritas, una de ellas
  —«tau mas bajo exige mas aulas»— sustituida, porque pierde su premisa.
- Regresión nueva que fije las tres cosas que este análisis midió: que con un
  marco de un solo tramo las dos tasas dan el MISMO mínimo (el control de Letras
  y CC.HH.), que con tramos mezclados la τ declarada deja de mover el resultado,
  y que sin la columna se cae a τ declarándolo.
- Documento de diseño: el recuadro «Cuál se usa para qué» de la 4.5 y el párrafo
  de la 5.2 que hoy dice «se multiplican por τ».

## Ítem 9 — el estado real del documento

El encargo dice que el documento «hoy describe la simulación sin mencionar qué
tasa usa». Eso era cierto en `Diseno-muestral-HSVG2026.pdf` (25-08), cuya
sección 4 llega hasta 4.3 y donde la palabra «simulación» no aparece en todo el
documento. **La versión vigente `Diseno-muestral-HSVG2026_v2` (27-08) ya lo
dice, en dos sitios**: la 5.2 —«se cuentan los estudiantes únicos obtenidos […]
y se multiplican por τ»— y el recuadro de la 4.5, que reparte «τ de la facultad
para el dimensionamiento y la certificación por simulación; efectividad del aula
para la planificación operativa».

Así que no falta la frase: falta el **porqué**, y falta decir que la
certificación de lo ya sorteado usa la otra tasa y además no descuenta
repetidos. Eso es lo que habría que agregar, se adopte o no el cambio.
