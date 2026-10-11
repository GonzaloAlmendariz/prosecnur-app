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
| 10 | *Nuevo*: reconciliar bruto/neto entre `certificacion.R` y `certeza.R` | `calc_muestra_aulas_certificacion.R` | ☐ **abierto** — ~150 encuestas; **ni bruto ni neto**, ver la corrección |
| 11 | *Nuevo*: el ADR 0082 describe tramos sellados que el proyecto vivo no tiene | `docs/adrs/0082-la-tau-del-diseno-…md` | ☐ **abierto** |
| 12 | *Nuevo*: el `ya_medidas` por aula de 2025, para limpiar los tramos por TRAMO y no por facultad | base 2025 (no está en el sello) | ☐ **abierto** — es lo que falta para cerrar el 10 |

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

> **CORREGIDO el 2026-08-28.** Las cifras «neta» de abajo descuentan el
> traslape dos veces: el 7,2 % ya está dentro de la tasa de 2025. El
> veredicto «EE.GG. Letras no llega» **queda retirado** — con la tasa
> limpia da 1,056. Lee la sección «Corrección del Hallazgo 2» antes de
> usar cualquier número de aquí. La brecha real entre superficies no es
> de 365 encuestas sino de **~150** (3 148,9 contra 2 998,9).

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

## Corrección del Hallazgo 2 (2026-08-28, tras la revisión de la sesión par)

La sesión «Selección de 174 aulas» objetó el Hallazgo 2 con este argumento: τ se
midió con `unidad = "encuentro_en_curso_horario_aplicado"`, así que **el traslape
de 2025 ya estaría dentro de la tasa**, y `únicos × τ` lo descontaría dos veces.
Pidió verificar contra la base 2025 si un alumno ya encuestado contó como
efectiva en la segunda aula.

**No hace falta ir a la base: el sello lo publica.** `calc_muestra_referencia_asistencia$encuentros`
trae el embudo entero de las 194 aulas aplicadas de 2025:

```
elegibles (padrón)      6 232
asistentes              4 931
asistentes_elegibles    4 871
ya_medidas                446   <- los que YA habían respondido en otra aula
no_elegibles               60
elegibles_presentes     4 425   = 4 871 − 446
efectivas               3 303
```

Su premisa **queda confirmada**: en 2025 un repetido no volvía a contar como
efectiva; se registraba como `ya_medidas` y salía de la base que podía
responder. Y también tienen razón en que la tasa de los tramos es la de
denominador **padrón** —`rendimiento = efectivas/elegibles` = 3 303/6 232 =
0,530—, no la que el sello declara (`efectividad = efectivas/elegibles_presentes`
= 0,746). Acepto la corrección: **mi vara neta descontaba dos veces.**

**Pero su arreglo sobrecorrige, y la diferencia es medible.** El traslape
incrustado en la tasa de 2025 es `ya_medidas / elegibles` = 446/6 232 =
**7,16 %** → factor ×1,0771. Extrapolando los repetidos a los ausentes (los
repetidos son el 9,16 % de los asistentes elegibles) el techo es ×1,1008. El
traslape de 2026 es **11,4 %**. **No son el mismo número, y no hay razón para
que lo sean**: el traslape entre las 194 aulas aplicadas de 2025 y el traslape
entre las 174 sorteadas de 2026 son dos cantidades distintas.

Su prueba de consistencia —`brutos × τ_brutos` ≈ `únicos × τ_únicos`— es una
identidad: las dos valen `efectivas`, siempre, para la MISMA población. Que
3 232 y 3 231 coincidan no es evidencia de nada; el paso que hay que justificar
es que el traslape de 2025 iguale al de 2026, y medido no lo iguala.

Las tres varas sobre los 174 titulares de ULT1:

| | total | cobertura | EE.GG. Letras |
|---|---:|---:|---:|
| **bruta** (`certificacion.R`, sin descontar nada) | 3 148,9 | 1,260 | **1,110** |
| **neta** (mi Hallazgo 2 — doble descuento) | 2 784,3 | 1,114 | **0,980** |
| **corregida** (únicos × tasa limpia, factor global ×1,0771) | 2 998,9 | 1,200 | **1,056** |
| corregida con el techo ×1,1008 | 3 064,9 | 1,226 | 1,079 |

**EE.GG. Letras sí cierra** —queda entre 1,056 y 1,079—, así que retiro el
«no llega». Pero no cierra con 1,110: la vara bruta le sobra entre 3 % y 5 %, y
al total entre 3 % y 5 % también. Para una reunión de aprobación, «la celda más
ajustada tiene 8 % de margen» y «tiene 4 %» no son la misma frase.

### Por qué ninguna convención global es correcta

El traslape incrustado de 2025 **no es uniforme**. Por facultad, factor
`elegibles/(elegibles − ya_medidas)`:

| facultad | elegibles 2025 | ya_medidas | factor |
|---|---:|---:|---:|
| EDUCACION | 126 | 22 | 1,2115 |
| CIENCIAS Y ARTES DE LA COMUN. | 249 | 33 | 1,1528 |
| CIENCIAS E INGENIERIA | 1 212 | 147 | 1,1380 |
| PSICOLOGÍA | 145 | 14 | 1,1069 |
| CIENCIAS SOCIALES | 462 | 40 | 1,0948 |
| DERECHO | 637 | 38 | 1,0634 |
| ESTUDIOS GENERALES LETRAS | 1 035 | 61 | 1,0626 |
| ARQUITECTURA Y URBANISMO | 237 | 12 | 1,0533 |
| ESTUDIOS GENERALES CIENCIAS | 1 192 | 53 | 1,0465 |
| GESTIÓN Y ALTA DIRECCIÓN | 299 | 12 | 1,0418 |
| ARTES ESCÉNICAS | 183 | 6 | 1,0339 |
| ARTE Y DISEÑO | 295 | 8 | 1,0279 |
| CIENCIAS CONTABLES · GASTRONOMÍA · LETRAS Y CC.HH. | 54 · 53 · 53 | **0 · 0 · 0** | **1,0000** |

Tres facultades tuvieron **cero** repetidos en 2025. Para ellas la tasa no trae
nada incrustado, y la vara bruta las sobreacredita por el traslape entero de
2026: Contabilidad quedaría en 2,070 cuando la cuenta correcta da 1,518, y
Letras y CC.HH. en 1,670 contra 1,426. Adoptar la vara bruta «porque τ ya trae
el traslape» es cierto en Ciencias e Ingeniería (+13,8 %) y falso en tres
facultades.

### Lo que no se puede cerrar con lo sellado

El factor correcto no es por facultad: **es por tramo de tamaño**, porque la
tasa que se corrige es la del tramo, estimada sobre todas las facultades. El
sello no lo permite — sus embudos van por facultad, horario, tipo de sesión,
nivel, tipo de docente y modalidad, pero **no por tamaño de aula**, y los
escalones de las cadenas traen `efectivas` y `elegibles` por aula pero **no
`ya_medidas`**. Para el factor exacto hace falta el `ya_medidas` por aula de la
base 2025. Mientras tanto lo defendible es el escalar global (+7,7 % a +10,1 %),
con el aviso de que el traslape probablemente crece con el tamaño del aula, y
entonces EE.GG. Letras —todas sus aulas grandes— llevaría un factor mayor que
el global.

Aviso adicional: 43 de las 194 aulas de 2025 tienen `residual_negativo`
(efectivas > elegibles_presentes; la primera cadena registra 16 efectivas sobre
14 elegibles). Cualquier recálculo de los tramos tropieza con eso antes que con
el traslape.

### Sobre `eligible_n_neto` (aviso de la sesión par, aceptado)

Tienen razón en general: `eligible_n_neto` descuenta **sólo dentro del
estrato**, así que sobre las 174 titulares completas no da los únicos globales.
Mi verificación estaba acotada a la certeza —que simula **un estrato a la vez**,
con `rows$stratum` forzado a la facultad— y ahí sí es exacta: medida sobre un
sorteo de 3 aulas de Contabilidad, `Σ eligible_n_neto` = 71 y los únicos que
cuenta la certeza = 71. La fórmula `Σ eligible_n_neto × tasa` vale para la
certeza y **no** vale para evaluar una selección completa de varias facultades.

---

# Evaluación — tasa por aula contra τ de facultad, en los tres usos

Encargo de Gonzalo (2026-08-28): «evaluar las ventajas y desventajas de usar la
tasa de aulas vs τ de facultad en la simulación y en la fórmula para sacar los
esperados por aula a nivel sexo y a nivel facultad».

**Son tres decisiones distintas y hoy el motor contesta cada una de un modo
diferente.** Antes de opinar, qué usa cada superficie:

| Uso | Dónde vive | Qué usa hoy |
|---|---|---|
| 1 · Simulación de certeza | `.cm_certeza_evaluar` | **τ de facultad** — `netos × τ` |
| 2 · Esperado por aula, agregado a facultad | `efectivas_esperadas` + `certificacion.R` (`suma_esperadas`) | **tasa por aula** — `Σ eᵢ·rᵢ` |
| 3 · Esperado por celda de sexo | `certificacion.R`, rama `sexo_filas` | **tasa PLANA** — `Σ e_sexo × (Σeᵢrᵢ / Σeᵢ)` |

El uso 3 es el que nadie había mirado: aplana la tasa que el uso 2 acaba de
componer aula por aula.

## El hecho que ordena los tres

τ **es** la media de la tasa por aula ponderada por elegibles sobre el marco de
la facultad. De ahí sale todo:

- Sobre un conjunto cuya mezcla de tamaños reproduce la del marco, **las dos dan
  exactamente lo mismo**. No es aproximación: es identidad. Letras y CC.HH. lo
  demuestra en cada medición de este documento —sus 14 aulas caben en un tramo y
  los dos brazos coinciden dígito a dígito.
- Sobre un conjunto sesgado hacia aulas grandes —y el sorteo PPS lo está— τ
  sobreacredita, porque las grandes son las de tasa baja.
- Sobre **un aula suelta**, τ simplemente no responde la pregunta: le atribuye a
  un aula de 14 elegibles el mismo rendimiento por elegible que a una de 50.

## Uso 1 — la simulación

Medido con sorteos pareados sobre los 174 titulares: cambiar a la tasa por aula
mueve el mínimo certificado en 2 de 15 facultades, las dos hacia **más** aulas, y
el total de `Σ max(fórmula, certeza)` sube de **174 a 175**. Detalle en el cuadro
de los ítems 5 y 6.

- **A favor**: insesgada respecto de la mezcla del conjunto sorteado; alinea la
  simulación con lo que ya hacen la certificación y Monitoreo.
- **En contra**: el efecto es **más chico que el ruido de la propia simulación**
  —Derecho se re-certifica en 18 o en 19 según la corrida, con p = 0,951 sobre
  205 sorteos— y cuesta un cambio de contrato (`estratos[].tau` deja de
  gobernar) más seis pruebas reescritas.

## Uso 2 — el esperado por aula agregado a facultad

**Aquí no hay decisión pendiente: ya usa la tasa por aula, y está bien.** Lo que
τ cambiaría, medido sobre los 174 titulares realmente sorteados:

| Facultad | n | por aula | τ plana | dif |
|---|---:|---:|---:|---:|
| ARTE Y DISEÑO | 15 | 175,3 | 190,9 | **−8,15 %** |
| ARTES ESCÉNICAS | 8 | 102,8 | 108,8 | −5,49 % |
| EDUCACION | 3 | 48,3 | 50,4 | −4,17 % |
| CIENCIAS Y ARTES DE LA COMUN. | 7 | 105,6 | 109,0 | −3,16 % |
| CIENCIAS SOCIALES | 12 | 190,9 | 196,8 | −2,99 % |
| CIENCIAS E INGENIERIA | 37 | 671,3 | 683,8 | −1,84 % |
| ARQUITECTURA Y URBANISMO | 8 | 170,1 | 173,1 | −1,73 % |
| GESTIÓN Y ALTA DIRECCIÓN | 7 | 134,1 | 134,7 | −0,47 % |
| LETRAS Y CIENCIAS HUMANAS | 4 | 38,4 | 38,4 | **−0,00 %** |
| DERECHO | 19 | 424,2 | 422,8 | +0,34 % |
| GASTRONOMÍA | 3 | 41,4 | 40,9 | +1,19 % |
| ESTUDIOS GENERALES CIENCIAS | 22 | 469,2 | 463,9 | +1,16 % |
| PSICOLOGÍA | 6 | 95,2 | 93,3 | +2,07 % |
| ESTUDIOS GENERALES LETRAS | 20 | 440,6 | 429,1 | +2,67 % |
| CIENCIAS CONTABLES | 3 | 41,4 | 38,7 | **+6,93 %** |
| **TOTAL** | 174 | **3 148,9** | **3 174,8** | **−0,81 %** |

En agregado casi da igual (−0,81 %), pero **por facultad el rango es de −8,15 % a
+6,93 %**, y ahí es donde se decide el operativo de cada una. Un τ plano le
promete a Arte y Diseño 16 encuestas que no va a producir y le esconde a
Contabilidad 3 que sí. Como la cuota es por facultad y no se compensa entre
facultades (ADR 0079), la compensación global no consuela.

## Uso 3 — el esperado por celda de sexo

Hoy `certificacion.R` aplana: calcula `tasa = esperadas/elegibles` de la facultad
y la multiplica por los elegibles de cada sexo. Eso **borra la correlación entre
tamaño del aula y composición por sexo**, que existe y no es chica:

| Facultad | aulas | cor(elegibles, % mujeres) | % mujeres en el tercio chico → grande |
|---|---:|---:|---|
| EDUCACION | 17 | **−0,721** | 97,0 % → 86,0 % |
| ARQUITECTURA Y URBANISMO | 20 | **+0,377** | 64,7 % → 72,2 % |
| ARTES ESCÉNICAS | 58 | **−0,321** | 70,4 % → 52,9 % |
| CIENCIAS E INGENIERIA | 417 | +0,226 | 20,8 % → 28,8 % |
| ARTE Y DISEÑO | 110 | +0,153 | 76,4 % → 81,5 % |
| resto | | −0,10 a +0,05 | plano |
| GLOBAL | 1 512 | −0,181 | |

**Cambia de signo entre facultades**, así que no hay corrección global que lo
arregle: en Educación las aulas chicas son casi sólo de mujeres y en
Arquitectura es al revés.

Efecto medido sobre las 30 celdas de los 174 titulares (tasa por aula contra
tasa plana):

- rango: **−6,8 %** (Educación hombres) a **+3,6 %** (Arquitectura hombres);
- diez de las treinta celdas se mueven menos de 1 %;
- **0 de 30 celdas cambian de veredicto.**

Que hoy no cambie ningún veredicto es una propiedad de esta muestra, no una
garantía: el término que se está borrando es una covarianza real que en dos
facultades es fuerte, y la celda más castigada es una de cuota 4.

## Las desventajas de la tasa por aula, que también son reales

No es gratis, y conviene tenerlas escritas:

**1. Traslada al aula una tasa estimada sobre un BIN.** El escalón produce
inversiones: un aula más grande puede esperar MENOS encuestas que una más chica
de la misma facultad. Medido sobre el marco, **4 565 de 167 995 pares de aulas
de la misma facultad (2,7 %) están invertidos** — por ejemplo, en EE.GG. Letras
un aula de 42 elegibles espera 21,4 y una de 51 espera 20,8. Los saltos:

    25 elegibles × 0,69 = 17,25      26 elegibles × 0,56 = 14,56   (−16 %)
    50 elegibles × 0,55 = 27,50      51 elegibles × 0,44 = 22,44   (−18 %)

Y **206 aulas del marco (13,6 %) caen justo en un borde** (15/16, 25/26, 35/36,
50/51), donde un elegible de más o de menos mueve el esperado un 16 %. τ no
tiene este problema: es un número por facultad.

**2. Aparenta una precisión que no tiene.** Ninguna de las dos modela la
dispersión de un aula alrededor de la tasa de su tramo. τ, al multiplicar por una
constante, conserva toda la dispersión de los netos y deja un colchón —accidental,
pero colchón—; la tasa por aula lo comprime y el gate queda más flojo en la cola.

**3. Más superficie que auditar**: 27 valores distintos en el marco contra 15.

Y las de τ, para no idealizarla: es **optimista en la media** sobre cualquier
conjunto sorteado por PPS (razón medida 0,954–1,000 en las quince facultades),
**no sirve por aula** —y por tanto no puede alimentar hojas de ruta, dotación ni
Monitoreo—, y aplicada a celdas de sexo borra la covarianza de arriba.

## Recomendación, por uso

| Uso | Qué hacer | Por qué |
|---|---|---|
| **2 · facultad** | **Dejar como está** (tasa por aula) | Ya es correcto; τ le erraría a Arte y Diseño por 8 % y a Contabilidad por 7 % |
| **3 · sexo** | **Cambiar a tasa por aula** — el mejor candidato | Coste ≈ una línea, sin cambio de contrato, 0 de 30 veredictos se mueven hoy, y corrige un aplanamiento sin defensa sobre una covarianza que llega a −0,72 |
| **1 · simulación** | **No ahora**; si se hace, junto con el 3 y con un ADR | El efecto (174→175) es menor que el ruido de la propia simulación, y cuesta contrato + 6 pruebas |

El orden importa: el **3** se puede hacer solo, hoy, y deja las tres superficies
coherentes en la unidad «aula». El **1** es el único que toca contrato y es el
que menos paga.

---

# HALLAZGO MAYOR — la certeza no simula el sorteo del estudio (2026-08-28)

Apareció auditando con la sesión par por qué no coincidíamos en el efecto PPS.
Ellos midieron que sobre la muestra realizada τ no es optimista (razón 1,002) y
yo que en expectativa sí (0,954–1,000). **Los dos teníamos razón, sobre dos
sorteos distintos**, y la diferencia es un defecto.

## El defecto

`calc_muestra_aulas_certeza` hace, antes de simular:

```r
rows$stratum <- rep(estrato$key, nrow(rows))
```

y el motor sortea **por `stratum`** — `.cm_aulas_select_once_engine` recorre
`names(quotas)` y filtra `aula_frame$stratum == st`. El diseño de HSVG2026
declara `strata_cols = faculty, sex_top_1, size_group`. Al reescribir `stratum`
con la clave de facultad, **la simulación pierde dos de los tres ejes de
estratificación, entre ellos el de tamaño**.

Es deliberado —el comentario del motor lo justifica: sin colapsar, `n_aulas` se
repartiría entre estratos y dejaría de significar «el candidato»— pero su costo
no estaba medido.

## Lo que cuesta, medido con las mismas semillas

| Facultad | n | | media | p05 | sd | P(cumple) | tasa sorteada |
|---|---:|---|---:|---:|---:|---:|---:|
| EE.GG. Letras | 20 | colapsado (hoy) | **416,0** | 400,8 | 8,99 | **0,988** | 0,4141 |
| | | estratificado (diseño) | **369,5** | 358,9 | 6,56 | **0,000** | 0,4298 |
| Derecho | 19 | colapsado | 393,2 | 374,9 | 10,16 | 1,000 | 0,5632 |
| | | estratificado | 377,8 | 362,9 | 8,32 | 0,944 | 0,5686 |
| Contabilidad | 3 | colapsado | 39,0 | 27,7 | 6,38 | 1,000 | 0,6326 |
| | | estratificado | 32,5 | 27,1 | 4,30 | 1,000 | 0,6617 |

**El colapso infla el rendimiento medio y la dispersión** (sd ×1,22 a ×1,48),
porque deja al PPS concentrarse en aulas grandes — justo lo que el diseño le
prohíbe al estratificar por `size_group`.

**La prueba de que el estratificado es el modelo correcto**: la selección REAL de
esas 20 aulas de EE.GG. Letras rinde **378,6** (904 únicos × τ). El simulador
estratificado da 369,5; el colapsado, 416,0. El que reproduce la realidad es el
que la certeza no corre.

## Y esto invierte la evaluación de la tasa

Con la estratificación del diseño y la tasa limpia de traslape, EE.GG. Letras
contra su cuota de 397:

| n | τ limpia · media / p05 / P | tasa por aula limpia · media / p05 / P |
|---:|---|---|
| 20 | 392,7 / 380,9 / **0,286** | 419,4 / 409,1 / **0,998** |
| 21 | 412,5 / 400,1 / 0,984 | 439,3 / 429,2 / 1,000 |
| 22 | 432,8 / 421,0 / 1,000 | 465,0 / 454,3 / 1,000 |

**Con τ hacen falta 21 aulas; con la tasa por aula bastan 20.** Lo contrario de
lo que dio la medición sobre el simulador colapsado, donde las dos empataban en
20 y el total subía de 174 a 175.

El mecanismo es limpio: estratificar por `size_group` **fuerza aulas chicas**
dentro de la muestra, y las chicas rinden muy por encima de τ —hasta 0,80 contra
el τ de 0,4188 de esa facultad—. τ se las cobra a tasa de facultad; la tasa por
aula, no.

## Consecuencia para todo lo anterior de este documento

**El cuadro de los ítems 5 y 6 —«la tasa por aula sube el total de 174 a 175»—
está medido sobre un simulador que no reproduce el diseño, y por tanto no
decide nada.** No lo borro porque es la medición correcta de lo que el motor
hace hoy; pero la pregunta «¿τ o tasa por aula?» no se puede contestar hasta que
la simulación estratifique como el estudio. La evidencia de EE.GG. Letras apunta
a que con el diseño real la tasa por aula pide **menos** aulas, que es justo lo
que el encargo original esperaba y la medición sobre el simulador colapsado
negaba.

**Orden correcto**: primero la estratificación de la certeza, después la
elección de tasa. Elegir la tasa sobre este simulador es optimizar el modelo
equivocado.

---

# El sello de tramos que el ADR 0082 describe NUNCA EXISTIÓ (2026-08-28)

La sesión par preguntó lo correcto: «¿el ADR describe un sellado que nunca se
aplicó, o se aplicó y algo lo borró? No es lo mismo un documento que se adelantó
que un sello que se perdió». **Es lo primero, y se comprueba de dos maneras
independientes.**

## 1 · `rendimiento_tramos` tiene lector y no tiene escritor

Barrido del repositorio entero. Todas las apariciones fuera de docs y tests
están en `calc_muestra_aulas_efectividad.R`, y **todas son el LECTOR**
(`.cm_efectividad_normalize_config` parseando la clave desde la config). Los
tests la construyen a mano como fixture. **No hay ningún productor**: ni
endpoint, ni función de sello, ni acción del frontend.

`calc_muestra_aulas_efectividad_sello.R` —el módulo que sí sella— sella
**únicamente `por_facultad`**, el multiplicador residual que Gonzalo pidió el
2026-08-25. Esa mitad del plan 1b se construyó; la de los tramos, no.

## 2 · Ningún `.pulso` del estudio lo tiene, y los que sí tienen residual lo tienen

| proyecto | `fuente` | `rendimiento_tramos` | `por_facultad` |
|---|---|---:|---:|
| HSTVG26 (22-07) | NULL | 0 | 0 |
| HSVG2026 (24-08) | NULL | 0 | 0 |
| HSVG26DEF (26-08) | NULL | 0 | 0 |
| **HSVG26ULT (26-08)** | historico | **0** | **6** |
| **HSVG26ULT2 (27-08)** | historico | **0** | **6** |

Los dos proyectos posteriores al sello llevan los seis residuales y **cero
tramos**. Si el sello de tramos se hubiera perdido, habría al menos un `.pulso`
con tramos y sin residual, o con los dos. No lo hay: el residual aparece cuando
se construyó su escritor, y los tramos nunca aparecen porque el suyo no se
escribió.

**Conclusión: no es un sello perdido, es un contrato con lector y sin escritor.**
Corregirlo no es «re-aplicar» nada; es construir el escritor o cambiar la
calibración embebida.

## Por qué la embebida difiere de la base que dice usar

> **CORREGIDO tras la réplica de la sesión par.** Lo de abajo atribuía el 6 %
> entero al desalineamiento de bins. Medido, ese mecanismo explica **0,8 de los
> 6,4 puntos**. La procedencia real está más abajo, en «Lo que sí explica la
> diferencia».

Las dos declaran la misma fuente —las 194 aulas aplicadas de 2025— y dan números
distintos. La causa está escrita en el propio encabezado del motor
(`calc_muestra_aulas_efectividad.R:13`):

> `Bins sobre ELEGIBLES (v1; la base 2025 bineó sobre su tamaño de aula).`

Es decir: **los cortes se calcularon binando por tamaño de aula y se aplican
binando por elegibles.** Un aula de 40 matriculados con 28 elegibles entró al
tramo 36–50 al calibrar y cae en el 26–35 al aplicarse. Eso desplaza aulas entre
tramos y explica que el desvío se concentre justo en los tramos densos —16-25
+7,4 %, 36-50 +9,9 %, >50 +7,5 %— y sea nulo en los extremos, donde hay menos
aulas que cambien de bin.

Está declarado como limitación conocida de la v1. Lo que no está declarado es
que su efecto sobre el esperado del estudio vigente es **−6,0 % sobre ULT1**
(3 149,0 → 2 959,1) y **−6,4 % sobre ULT2** (3 157,3 → 2 954,0, medido por la
sesión par).

## Los tres escenarios acumulados (medición de la sesión par sobre ULT2)

| escenario | esperado | cobertura | peor celda | celdas < 1 |
|---|---:|---:|---:|---:|
| 1 · vigente (embebidos, vara bruta) | 3 157 | 1,263 | 1,111 | 0 |
| 2 · + calibración de su propia base 2025 | 2 954 | 1,182 | 1,039 | 0 |
| 3 · + descuento de repetidos | 2 814 | 1,126 | **0,972** | **2** |

En el escenario 3 caen **EE.GG. Letras (0,972)** y **EE.GG. Ciencias (0,992)**,
con Derecho al filo en 1,031. Coincide en dirección con lo que dio la simulación
estratificada por otro camino —P(cumple) = 0,286 para EE.GG. Letras con 20
aulas—: **los dos métodos, calibración y simulación, señalan la misma facultad.**

## Orden de urgencia, revisado

1. **La calibración** es la más urgente, y por una razón que no es su tamaño: es
   la única de las tres que **ya está dentro de un número publicado**. La sección
   7.2 del documento de diseño dice cuánto se espera de cada celda, y ese número
   lleva 6,4 % de optimismo que no viene de una decisión sino de un bin mal
   alineado.
2. **La estratificación de la certeza**, porque sin ella no se puede decidir la
   tasa.
3. **La tasa** (uso 1). El uso 3 —sexo— es independiente de los tres.

## Lo que sí explica la diferencia (2026-08-28, corrigiendo lo anterior)

Mi atribución al desalineamiento de bins estaba sobredimensionada. La sesión par
la midió sobre los 174 titulares, comparando binar por matriculados contra binar
por elegibles:

    aulas que cambian de tramo     11 de 174  (6 %)
    reciben una tasa MAYOR         11
    reciben una tasa MENOR          0
    efecto sobre el esperado       +0,8 %

**El signo confirma el mecanismo** —ninguna aula se mueve hacia el lado
conservador— pero la magnitud es 0,8 de los 6,4 puntos. En el marco 2026 la
razón elegibles/matriculados tiene mediana 1,000, así que casi ninguna aula cruza
un corte.

### La procedencia: el archivo se contradice a sí mismo

`calc_muestra_aulas_efectividad.R` dice dos cosas incompatibles sobre de dónde
salen los cinco valores embebidos:

- **Línea 7**: «Calibración 2025 (base ADR 0060, 230 intentadas / 194 aplicadas),
  medida el 2026-08-18 […] ≤15: 0.80 · 16–25: 0.69 · 26–35: 0.56 · 36–50: 0.55 ·
  >50: 0.44».
- **Línea 85**: «**La calibracion embebida es de otra ola** y su producto no sale
  de esta descomposicion; inventarle una seria publicar una lectura que nadie
  midio».

El encabezado los atribuye a la base 2025 del estudio; el bloque de las piernas
dice que son de otra ola. Las reconstrucciones le dan la razón al segundo.

### Tres pruebas de que no salen de esta base

**1 · Ninguna reagrupación los reproduce** (medición de la sesión par):

| | ≤15 | 16-25 | 26-35 | 36-50 | >50 |
|---|---:|---:|---:|---:|---:|
| **embebido** | 0,800 | **0,690** | 0,560 | **0,550** | **0,440** |
| aplicados (194) | 0,809 | 0,642 | 0,566 | 0,500 | 0,409 |
| todos los escalones | 0,809 | 0,642 | 0,566 | 0,500 | 0,409 |
| sin residual negativo | 0,786 | 0,635 | 0,564 | 0,500 | 0,409 |
| mediana por aula | 0,809 | 0,650 | 0,547 | 0,479 | 0,407 |
| promedio simple por aula | 0,808 | 0,648 | 0,564 | 0,506 | 0,414 |

Los tramos 1 y 3 caen cerca en todas; **2, 4 y 5 están sistemáticamente más altos
en lo embebido que en cualquier reconstrucción**, y no es redondeo: 0,6422 no
redondea a 0,690 ni 0,5005 a 0,550.

**2 · Ni siquiera con cortes libres.** Barrí todos los juegos de cuatro cortes
entre 10 y 58 elegibles buscando el que más se acerque a los cinco valores
embebidos sobre las 194 aulas. El mejor —cortes en 15, 20, 38 y 41— da
`0,8091 · 0,7026 · 0,5715 · 0,5625 · 0,4319`, con un **desvío máximo de 0,0126**.
Mejor que los cortes oficiales (0,0495), pero sigue sin reproducirlos: **no hay
binning de esta base que los produzca**.

**3 · La hipótesis de las 230 intentadas queda cerrada.** Sumar las 36 aulas no
aplicadas metería elegibles con cero efectivas: la razón bajaría de 0,5300 a
~0,4470. Sólo puede **bajar** el rendimiento, nunca subirlo, y lo embebido está
por encima.

### Cómo debe quedar dicho

**El efecto está medido y es −6,4 % de optimismo sobre el esperado del estudio.
La procedencia de los cinco valores embebidos NO está explicada**: no son los de
su base 2025 y el propio archivo dice que son de otra ola, sin decir cuál. El
desalineamiento de bins aporta 0,8 puntos; los otros 5,6 no se han explicado.

Eso importa para la decisión: **cambiar los valores embebidos sería reemplazar
una constante sin procedencia por otra**, mientras que construir el escritor de
`rendimiento_tramos` deja cada estudio calibrado contra su propio histórico y
hace la pregunta innecesaria.

---

# El barrido de 50 semillas: ¿cambia la ganadora al cambiar de vara? (2026-08-28)

Encargo de Gonzalo. Vocabulario acordado: **tasa de la facultad** y **tasa del
aula**; los pronósticos, **esperadas según la facultad** y **esperadas según el
aula**.

## Por qué esta pregunta es distinta de la del Monte Carlo

En la simulación la pregunta es **de nivel**: ¿cuántas aulas hacen falta? Ahí una
vara sesgada mueve la respuesta directamente.

En el barrido la pregunta es **de orden**: entre 50 candidatas, ¿cuál gana? Y
para eso el nivel no importa. **Si las dos varas desplazaran a todas las
candidatas en la misma cantidad, el ordenamiento se conservaría y daría igual con
cuál se eligió.** El barrido sería robusto a la vara y no habría nada que
corregir.

Así que lo que hay que medir no es cuánto cambia la cobertura de la 202 —eso ya
lo midió la sesión par: sube de 1,081 a 1,101— sino **cuánto varía ese
desplazamiento entre candidatas**, y compararlo contra lo que las separa.

> **SUPERSEDIDO el 2026-08-28.** Sí se pudo: un sorteo completo del pipeline
> tarda **29,6 s** y con la semilla 202 reproduce la corrida guardada **174 de
> 174**. Lo que fallaba era mi atajo de un `dispatch` suelto. El barrido real de
> 50 semillas está más abajo, en «El barrido de 50, corrido de verdad». Lo de
> esta sección queda como el proxy que se usó mientras tanto.

## Lo que no se pudo hacer

El barrido guardó las métricas de las 50 pero no las selecciones, así que
re-rankear exige volver a sortear. **Y no alcanza con un sorteo por semilla**:
verificado, un `.cm_aulas_select_once_dispatch` con la semilla 202 devuelve 174
aulas en 1 segundo pero **sólo 44 de las 174 titulares reales** (25,3 %), porque
la selección de producción elige entre `candidate_pool_size = 500` candidatas por
el objetivo. Reproducir el barrido exige 50 corridas completas del pipeline.

Lo que sí se puede, y contesta la pregunta: **generar 50 candidatas del mismo
diseño y medir si las dos varas las ordenan igual.** No son las mismas 50 del
barrido —sus identidades no se corresponden— pero el fenómeno que se pregunta es
el mismo y se mide sobre el mismo marco, las mismas cuotas y el mismo motor.

## El resultado

50 candidatas, criterio del barrido (mínima cobertura entre las 30 celdas):

| | tasa de la facultad | tasa del aula |
|---|---:|---:|
| candidatas que cierran las 30 celdas | **25 de 50** | **30 de 50** |
| rango de la cobertura mínima | 0,8000 – 1,0540 | 0,8000 – 1,0850 |
| ganadora | semilla 6451 | semilla 6135 |

*(el barrido real dio 24 de 50 con la vara de facultad; 25 de 50 aquí es una
señal de que la población de candidatas se comporta igual.)*

**El ordenamiento cambia:**

| puesto | por tasa de la facultad | su puesto con la tasa del aula |
|---|---|---|
| 1 | 6451 | 2 |
| 2 | 80 | 3 |
| 3 | 716 | 5 |
| 4 | 1372 | **15** |
| 5 | 4606 | **11** |

y la ganadora por tasa del aula, la 6135, **es la novena** por tasa de facultad.
Spearman entre los dos ordenamientos: **0,822** — alto, pero muy lejos de 1.

## El argumento que lo cierra, y es de magnitudes

    separacion entre la 1ª y la 2ª candidata (vara de facultad)   0,0039
    desplazamiento al cambiar de vara: media +0,0239  sd  0,0284
                                       rango  -0,0873 a +0,0663

**El desplazamiento típico es siete veces mayor que lo que separa a las dos
mejores candidatas, y no es constante: su desviación estándar (0,0284) es del
orden de su media (0,0239), y cambia de signo entre candidatas.** Ese es el punto:
si fuera un corrimiento parejo no importaría, pero varía tanto entre candidatas
como para reordenarlas.

Traducido: **el criterio discriminaba en milésimas y las dos varas difieren en
centésimas.** La semilla que gana la decide la vara, no la calidad del diseño.
Eso es coherente con lo que ya se sabía del barrido real: la 4444 ganaba con
1,0837 y la 202 quedaba en 1,0810 — **2,7 milésimas de diferencia**, y Gonzalo
eligió la 202 por el solape justamente porque esa diferencia caía bajo el error
del estimador. Tenía razón entonces por una razón, y ahora hay una segunda: a esa
resolución el criterio tampoco distingue entre varas.

## Qué significa para la 202, que es lo que ya está en campo

**Nada malo.** Su cobertura mínima *mejora* al medirla con la tasa del aula
(1,081 → 1,101), y con la vara correcta cierran más candidatas, no menos. La
selección que salió no está en riesgo por esto.

Lo que sí queda establecido para el próximo estudio:

1. **El criterio del barrido debe usar la tasa del aula**, porque compara
   selecciones concretas de aulas concretas y el tamaño de cada una ya se conoce.
2. **La tercera cifra decimal del criterio no es información.** Separar
   candidatas por 0,003 cuando la elección de vara mueve 0,028 es decidir por
   ruido. Conviene declarar un umbral de indiferencia —por ejemplo, tratar como
   empatadas las que estén dentro de una centésima— y desempatar por solape, que
   es lo que Gonzalo hizo a mano.

---

# El barrido de 50, corrido de verdad (2026-08-28)

50 semillas con el **pipeline completo** —`calc_muestra_aulas_seleccionar`, que
elige entre 500 candidatas por semilla—, 29,6 s cada una. **Validado: la semilla
202 reproduce la corrida guardada 174 de 174 titulares.** El criterio (mínima
cobertura entre las 30 celdas de sexo) se calculó con las dos varas sobre cada
selección.

| | tasa de la facultad | tasa del aula |
|---|---:|---:|
| candidatas que cierran las 30 celdas | **30 de 50** | **38 de 50** |
| ganadora | **202** (1,0741) | **202** (1,1053) |
| Spearman entre los dos ordenamientos | colspan | **0,906** |
| desplazamiento aula − facultad | media **+0,0235** · sd **0,0201** · rango −0,0300 a +0,0659 | |

## Las tres lecturas

**1 · La 202 gana con las dos varas.** Puesto 1 en los dos ordenamientos. La
decisión que se tomó era robusta a la elección de vara — no hay nada que
lamentar en la selección que salió a campo.

**2 · Pero el ordenamiento sí se mueve, y la 4444 es el ejemplo.** Con la tasa
de la facultad queda **4ª**; con la tasa del aula cae al **puesto 11**. Spearman
0,906: alto, no 1. Si la 202 no hubiera estado en el juego, la ganadora habría
dependido de la vara.

**3 · El filtro es lo que más cambia.** Pasan 30 candidatas con la vara vieja y
**38 con la nueva**. Ocho selecciones que el criterio descartaba por no cerrar
las 30 celdas sí las cierran cuando se mide con la tasa del aula. Ése es el
efecto grande, más que el reordenamiento del podio.

## Lo que este barrido NO dice

**No reproduce los niveles del barrido original y no sé por qué.** El barrido del
27-08 reportó la 4444 en 1,0837 y la 202 en 1,0810, con la 4444 ganando. Este da
1,0516 y 1,0741, con la 202 ganando cómodamente. Reproduzco la *selección* de la
202 al aula exacta, así que la diferencia no está en el sorteo: está en cómo se
calcula la cobertura, o en sobre qué marco corrió aquel barrido (ULT1 es del
26-08 y ULT2 del 27-08, el mismo día del barrido).

Por eso **de aquí no se sigue que el barrido original estuviera mal**. Lo que se
sostiene es la comparación entre varas dentro de una misma definición, que es la
pregunta que se hizo. Cuadrar los niveles es trabajo aparte y hay que hacerlo
antes de citar estas cifras absolutas en ningún lado.

## Recomendación para el próximo estudio

1. **El criterio del barrido debe usar la tasa del aula.** Compara selecciones de
   aulas concretas cuyo tamaño ya se conoce; promediarlo descarta información y,
   medido, descarta ocho candidatas válidas de cada cincuenta.
2. **Declarar un umbral de indiferencia.** El desplazamiento entre varas tiene
   sd 0,0201; separar candidatas por milésimas es decidir por ruido. Tratar como
   empatadas las que caen dentro de una centésima y desempatar por solape — que
   es exactamente lo que Gonzalo hizo a mano el 27-08.

---

# RESULTADO FINAL — las quince facultades con el simulador estratificado

Corrida pareada, 1 000 corridas escaladas, `cube_balanceado`, semilla y config
del estudio, **con la estratificación del diseño** (`faculty · sex_top_1 ·
size_group`) y con el brazo de la tasa del aula corregido (`netos × tasa
ponderada de lo sorteado`, no `Σ eligible_n_neto × tasa`, que sobrecontaba entre
2 % y 11 %).

Números con la **tasa limpia de traslape**, que es la convención correcta:

| Facultad | fórmula | asignadas hoy | **tasa de la facultad** | **tasa del aula** | P(cumple) con las asignadas |
|---|---:|---:|---:|---:|---|
| ARQUITECTURA Y URBANISMO | 8 | 8 | 7 | 7 | 1,000 / 1,000 |
| ARTE Y DISEÑO | 15 | 15 | **10** | **11** | 1,000 / 1,000 |
| ARTES ESCÉNICAS | 8 | 8 | 5 | 5 | 1,000 / 1,000 |
| CIENCIAS CONTABLES | 2 | 3 | 2 | 2 | 1,000 / 1,000 |
| CIENCIAS E INGENIERIA | 37 | 37 | 30 | 30 | 1,000 / 1,000 |
| CIENCIAS SOCIALES | 12 | 12 | 11 | 11 | 0,983 / 0,981 |
| CIENCIAS Y ARTES DE LA COMUN. | 7 | 7 | 6 | 6 | 0,990 / 0,977 |
| DERECHO | 16 | 19 | 18 | 18 | **0,000 / 0,000** (con 16) |
| EDUCACION | 3 | 3 | 2 | 2 | 1,000 / 1,000 |
| **ESTUDIOS GENERALES CIENCIAS** | 22 | **22** | **23** | **23** | **0,450 / 0,431** |
| **ESTUDIOS GENERALES LETRAS** | 18 | **20** | **21** | **21** | **0,000 / 0,000** (con 18) |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 3 | 3 | 3 | 3 | 1,000 / 1,000 |
| GESTIÓN Y ALTA DIRECCIÓN | 6 | 7 | 7 | 7 | 0,174 / 0,229 (con 6) |
| LETRAS Y CIENCIAS HUMANAS | 3 | 4 | 3 | 3 | 0,997 / 0,997 |
| PSICOLOGÍA | 5 | 6 | 5 | 5 | 0,601 / 0,550 (con 5) |
| **Σ certeza** | **165** | **174** | **153** | **154** | |
| **Σ max(fórmula, certeza)** | | | **172** | **172** | |
| **+ el aula operativa de Derecho** | | | **173** | **173** | |

> **Cuidado con la fila `Σ certeza`.** 153 y 154 son la suma de los mínimos
> certificados, y **el diseño nunca usa esa suma**: usa
> `Σ max(fórmula, certeza)`. El número comparable con el 174 vigente es el
> **173** de la última fila. La reconciliación completa está abajo.

## Conclusión 1 — entre varas, no hay diferencia

**Catorce de quince facultades dan el mismo número.** La única que difiere es
Arte y Diseño, por una aula. El total es 153 contra 154: **una aula en 174**, muy
por debajo del ruido de la propia simulación (Derecho se re-certifica en 18 o 19
según la corrida).

Aplicando la regla del diseño `max(fórmula, certeza)`, **las dos varas dan
exactamente 172**.

Esto **cierra la pregunta del encargo original y la contesta al revés de las dos
respuestas que di antes**:

| medición | resultado | por qué estaba mal |
|---|---|---|
| simulador colapsado | la tasa del aula sube 174 → 175 | el simulador no estratificaba como el diseño |
| estratificado, brazo con bug | la tasa del aula ahorra 9 aulas | `eligible_n_neto` sobrecontaba 2–11 % |
| **estratificado, corregido** | **empate: 153 contra 154** | — |

El control que lo garantiza: **Letras y CC.HH. da 28,2 y 28,2, P = 0,997 y
0,997, idénticas hasta el último decimal**, que es lo que tiene que pasar cuando
todas las aulas caben en un tramo y las dos tasas son el mismo número.

**Entonces el argumento para la tasa del aula no puede ser que dimensione mejor
—no lo hace— sino el estructural: responde la pregunta del aula, que la tasa de
la facultad no responde.** Para hojas de ruta, dotación de encuestadores y
Monitoreo hace falta el número del aula; para dimensionar, da igual cuál se use.

## Conclusión 2 — el hallazgo real es la estratificación, y deja dos facultades cortas

Lo que sí mueve el diseño, y con cualquier vara:

| Facultad | asignadas | necesarias | |
|---|---:|---:|---|
| ESTUDIOS GENERALES CIENCIAS | 22 | **23** | falta 1 |
| ESTUDIOS GENERALES LETRAS | 20 | **21** | falta 1 |
| CIENCIAS CONTABLES | 3 | 2 | sobra 1 |
| DERECHO | 19 | 18 | sobra 1 |
| LETRAS Y CIENCIAS HUMANAS | 4 | 3 | sobra 1 |
| PSICOLOGÍA | 6 | 5 | sobra 1 |

Con la regla del diseño el total pasa de **174 a 172**, pero **la composición
cambia**: cuatro facultades sobran una y las dos de Estudios Generales faltan
una. Y como la cuota no se compensa entre facultades (ADR 0079), el sobrante de
Derecho no cubre el faltante de EE.GG. Letras.

Las dos que faltan son, además, **las de τ más bajo del estudio** (0,409 y
0,419) y las de aulas más grandes. No es casualidad: son las que el simulador
colapsado más favorecía, porque las dejaba concentrarse en aulas grandes.

## Qué queda por hacer, en orden

1. **Estratificar la certeza** como el diseño. Es la reparación real y la única
   que cambia números.
2. **La calibración** (`rendimiento_tramos` sin escritor, −6,4 % de optimismo).
3. **La tasa**: para dimensionar da igual; cámbiese por coherencia con las otras
   dos superficies, no por precisión. El eje de sexo (`certificacion.R`) sigue
   siendo el cambio más barato y el único que hoy aplana sin defensa.

## Reconciliación con el 174, porque la fila `Σ certeza` se presta a confusión

`Σ certeza` (153/154) **no es un total de diseño**. El diseño aplica
`max(fórmula, certeza)` facultad por facultad y después suma. Las tres cifras
que hay que comparar:

| | fórmula | Σ certeza | Σ max(fórmula, certeza) | + operativa | **total** |
|---|---:|---:|---:|---:|---:|
| **vigente** — simulador colapsado, tasa de la facultad, sin limpiar traslape | 165 | **167** | 173 | +1 (Derecho) | **174** |
| **corregido** — estratificado + tasa limpia, tasa de la facultad | 165 | **153** | 172 | +1 | **173** |
| **corregido** — estratificado + tasa limpia, tasa del aula | 165 | **154** | 172 | +1 | **173** |

**El total baja de 174 a 173. Una aula, no veinte.**

Dos cosas explican por qué `Σ certeza` sí cae tanto (167 → 153) mientras el total
casi no se mueve:

1. **Casi todo el 167 → 153 es la tasa limpia**, no la estratificación. Con la
   estratificación y la tasa **sin** limpiar, la suma de certezas también da
   **167** — el mismo número que la corrida guardada, con composición distinta.
2. **`max` absorbe las bajas.** Cuando la certeza baja por debajo de la fórmula
   —Artes Escénicas de 8 a 5, Ciencias e Ingeniería de 34 a 30— el diseño se
   queda con la fórmula y la baja no llega al total. Sólo pasan al total las
   **subidas**.

## Lo que sí cambia: la composición

De las 174 vigentes a las 173 corregidas:

| Facultad | hoy | corregido | |
|---|---:|---:|---|
| ESTUDIOS GENERALES CIENCIAS | 22 | **23** | **+1** |
| ESTUDIOS GENERALES LETRAS | 20 | **21** | **+1** |
| CIENCIAS CONTABLES | 3 | 2 | −1 |
| LETRAS Y CIENCIAS HUMANAS | 4 | 3 | −1 |
| PSICOLOGÍA | 6 | 5 | −1 |
| DERECHO | 19 | 19 | = (18 certificadas + 1 operativa) |
| las otras nueve | | | sin cambio |

Neto −1. Pero **las dos subidas no se pagan con las tres bajas**: la cuota es por
facultad y no se compensa entre ellas (ADR 0079). Que sobre una en Psicología no
cubre que falte una en EE.GG. Letras.

---

# El τ del estudio es una foto de un marco que ya no existe (2026-08-28)

La sesión par encontró que el τ sellado en `aulas_por_estrato` no se reconstruye
con la fórmula que el documento describe: cinco facultades con factor 1,000
—donde τ **debería ser exactamente** la mezcla de tamaños de su marco— no
cuadran. Y dejó la dicotomía abierta: ¿el documento describe un cálculo que el
código no hace, o el código guardó el resultado de un cálculo anterior?

**Es lo segundo, y se comprueba exacto.**

## La prueba

`calc_muestra_aulas_tasas_facultad` sobre el marco de **`HSVG26DEF.pulso`**
(26-08) reproduce el τ sellado en **las quince facultades, a cuatro decimales,
diferencia 0,0000**. Ninguna otra lo hace:

| fuente probada | coincide |
|---|---:|
| marco de ULT1 (1 512 aulas) | 7 de 15 |
| marco de ULT2 (1 392 aulas) | 7 de 15 |
| marco de ULT2 sin filtrar `included` (5 269 filas) | 5 de 15 |
| media por aula sin ponderar | 1 de 15 |
| **marco de HSVG26DEF (1 632 aulas)** | **15 de 15** |

## Tres marcos, un τ congelado en el primero

| | aulas elegibles | elegibles |
|---|---:|---:|
| HSVG26DEF · 26-08 | **1 632** | 56 346 |
| HSVG26ULT · 26-08 09:33 | 1 512 | 52 399 |
| HSVG26ULT2 · 27-08 | 1 392 | — |

Entre DEF y ULT2 salieron **240 aulas** por depuración de criterios, y **el τ no
se recalculó**. El dimensionamiento entero —`cuota / (P25 × τ)`— corrió con la
tasa del marco viejo.

## Y el documento publica un τ distinto del que dimensionó

La sección 4.4 del documento de diseño recomputa desde el marco de **ULT1**, así
que su tabla es internamente coherente (Arquitectura: 20 aulas, 779 elegibles,
mezcla 0,5485, factor 1,000, τ 0,5485). Pero el estudio dimensionó con el τ de
**DEF**:

| Facultad | τ que publica el documento | τ que usó el diseño | dif |
|---|---:|---:|---:|
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 0,7105 | **0,6819** | −4,0 % |
| EDUCACION | 0,6452 | **0,6226** | −3,5 % |
| ARQUITECTURA Y URBANISMO | 0,5485 | **0,5461** | −0,4 % |
| ARTES ESCÉNICAS | 0,7525 | **0,7399** | −1,7 % |
| CIENCIAS SOCIALES | 0,5524 | **0,5482** | −0,8 % |

**Son dos números distintos con el mismo nombre en el mismo estudio**: el que la
tabla muestra y el que dividió la cuota.

## Dirección del error: conservadora

El τ sellado es **más bajo** que el del marco vigente en las que difieren, y una
τ más baja pide **más** aulas. Así que el estudio está sobredimensionado por este
motivo, no subdimensionado. No es urgente para el campo en curso.

## Por qué pasó, y qué lo evita

`aulas_por_estrato$tau` sale de `e$tau`, el τ **declarado en el estrato del
componente**, que el frontend escribe una vez. El marco se puede reconstruir
cuantas veces se quiera —y se reconstruyó dos— sin que nada vuelva a tocar ese
campo ni avise de que quedó viejo.

Es la segunda cifra de este mismo motor que no se reconstruye con la fórmula que
la describe; la otra es la calibración embebida. **Pero son de clases distintas y
conviene no juntarlas**: la calibración embebida no sale de ninguna base
conocida, y ésta sale exacta de un marco identificable. Una es de origen
desconocido; la otra es una foto fechada.

El invariante que lo habría cazado: **con `factor_facultad = 1,000`, τ tiene que
ser idéntica a la mezcla de tamaños del marco vigente.** Nueve de las quince
facultades cumplen esa condición por construcción, así que da un test barato y
sin falsos positivos.

---

# El cabo del barrido, cerrado: era la cuota, no la cobertura (2026-08-28)

Quedaba sin explicar por qué mis niveles no reproducían los del barrido del
27-08. Descartados ya el marco, la fuente de cuota de facultad y la fuente del τ,
**la diferencia está en la cuota de la celda de sexo**, y reproduce exacto.

## La verificación

Celdas más ajustadas de cada semilla, sobre ULT2:

| semilla | celda que manda | esperadas | cuota 157 | cuota 156 | barrido original |
|---|---|---:|---:|---:|---:|
| 202 | EE.GG. Letras · hombres | 168,6 | 1,0741 | **1,0810** | **1,0810** |
| 4444 | EE.GG. Letras · hombres | 169,1 | 1,0768 | **1,0837** | **1,0837** |

**Al cuarto decimal, las dos.** El barrido original usó **156** para EE.GG.
Letras hombres donde `distribucion_sub` publica **157** — el mismo 156 que cita
la sección 7.2 del documento de diseño.

Y hay una segunda: para que el mínimo de la 4444 sea EE.GG. Letras y no
Psicología, la cuota de **Psicología hombres** tiene que haber sido **≤ 17**
donde `distribucion_sub` publica **18** (con 18 su cobertura es 1,0516, por
debajo del 1,0837 que el barrido reportó como mínimo).

## De dónde NO sale ese 156

No es un redondeo del reparto por sexo. El reparto exacto sobre la cuota
publicada da:

    EE.GG. LETRAS  hombres   157,25  ->  round 157 · floor 157   (publicado 157)
    PSICOLOGÍA     hombres    18,01  ->  round  18 · floor  18   (publicado  18)

Ni redondeando ni truncando se llega a 156 y 17. Tendría que venir de una base de
cuota ~0,8 % más baja, o de otra fuente — la sesión par declaró que su barrido
leía las cuotas de la hoja `Resumen por facultad` de un Excel, que no tengo.

## Lo que esto sí demuestra, y no es menor

**El ganador del barrido lo decide el denominador.**

| | cuota del `distribucion_sub` | cuota del barrido original |
|---|---|---|
| 202 | 1,0741 | 1,0810 |
| 4444 | **1,0516** | **1,0837** |
| **gana** | **202** | **4444** |

Un ±1 en una cuota de sexo cambia qué celda manda —en la 4444, Psicología
hombres (cuota 18) o EE.GG. Letras hombres (cuota 156)— y con eso cambia el
ganador. Las celdas de cuota chica son las peligrosas: **Psicología hombres tiene
cuota 18, así que una unidad vale 5,6 % de su cobertura**, mientras que en
EE.GG. Letras hombres vale 0,6 %.

Es el mismo argumento de resolución que ya aplicaba a la elección de vara, pero
más agudo: el criterio discrimina en milésimas y **una unidad de cuota en una
celda chica vale decenas de milésimas**.

## Recomendación que se suma a las anteriores

Al criterio del barrido hay que fijarle la **procedencia de la cuota por celda**,
igual que la vara. Hoy hay al menos dos juegos de cuotas circulando —el de
`distribucion_sub` y el del Excel— y difieren en las celdas que deciden. Sin eso
declarado, dos barridos del mismo estudio pueden elegir semillas distintas sin
que ninguno esté mal.

---

# Las dos cuotas por sexo: no es el redondeo ni una foto vieja (2026-08-28)

La sesión par confirmó que su barrido usó 156 y 17, y propuso dos cosas que
**hay que corregir antes de que se den por buenas**.

## 1 · `distribucion_sub` NO viola el invariante

Su hipótesis era que el juego oficial publica 241 mujeres y 157 hombres para
EE.GG. Letras, sumando 398 contra una cuota de 397, y que eso sería «un hallazgo
aparte y probablemente más importante». **No lo es: publica 240 y 157.**

Verificado en las quince:

    facultades donde mujeres + hombres != cuota:  0 de 15
    TOTAL  cuota 2 500  ·  hombres 1 261  ·  mujeres 1 239  ·  suma 2 500

Los **dos** juegos cumplen el invariante. Por lo tanto el invariante es correcto
como regla pero **no discrimina entre ellos**: la regla «si un juego lo viola, no
es el que hay que usar» no aplica acá porque ninguno lo viola.

## 2 · El mecanismo tampoco los distingue

Aplicando su mecanismo —redondear las mujeres, los hombres por diferencia— a la
proporción **del motor**:

    EE.GG. Letras   397 × 0,6039 = 239,75 -> 240 mujeres, 157 hombres
    Psicología       75 × 0,7599 =  56,99 ->  57 mujeres,  18 hombres

que es **exactamente `distribucion_sub`**. El motor ya hace efectivamente eso. La
diferencia no está en cómo se redondea.

## 3 · Lo que sí los distingue: la proporción de sexo

| | EE.GG. Letras | Psicología |
|---|---:|---:|
| motor (`N_b / (N_a + N_b)`) | **0,6039** | **0,7599** |
| Excel del barrido | **0,606** | **0,775** |

Con 0,606 salen 241 y 156; con 0,775 salen 58 y 17. **Ahí está el ±1.**

## 4 · Y NO es el patrón de la foto vieja

Es la distinción que importa. La proporción del motor es **idéntica en los tres
estados del proyecto**:

    ESTUDIOS GENERALES LETRAS   DEF 0,6039 · ULT1 0,6039 · ULT2 0,6039
    PSICOLOGÍA                  DEF 0,7599 · ULT1 0,7599 · ULT2 0,7599

Así que **no se congeló en un marco anterior**, como sí pasó con τ. La proporción
del Excel viene de otra base de población —no del `N_a/N_b` de los estratos en
ningún estado conocido del estudio—, y en Psicología la diferencia es de 1,5
puntos, que no es redondeo.

Conviene no meterlo en la misma bolsa que la τ congelada: aquella se reconstruye
exacto desde un marco identificable y su arreglo es recalcular; ésta sale de una
fuente que todavía no está identificada.

## El invariante que sí discriminaría

Ya que `M + F = cuota` lo cumplen los dos, el que separa es sobre la
**procedencia**: la proporción de sexo usada para repartir la cuota tiene que ser
la misma que publica el estrato del componente (`N_a`, `N_b`). Es comprobable en
una línea y hoy el Excel no la cumple.

---

# La circularidad del reparto por sexo, medida (2026-08-28)

La sesión par rastreó la proporción del entregable a la **composición del marco
elegible** y argumentó que usarla es circular: el marco ya está filtrado por
criterios que pueden correlacionar con el sexo, así que la cuota heredaría el
sesgo del filtro. **Confirmo la procedencia y el argumento deja de ser teórico.**

## Procedencia, confirmada

| | componente (`N_a/N_b`) | marco elegible | entregable |
|---|---:|---:|---:|
| ESTUDIOS GENERALES LETRAS | 0,6039 | **0,6062** | 0,606 |
| PSICOLOGÍA | 0,7599 | **0,7752** | 0,775 |

## Cuánto mueve el filtro la composición por sexo

Diferencia entre la proporción de mujeres del **marco elegible** y la del marco
**sin filtrar**:

| Facultad | sin filtrar | elegible | desplazamiento |
|---|---:|---:|---:|
| **ARTES ESCÉNICAS** | 0,5301 | 0,6147 | **+8,5 pts** |
| **EDUCACION** | 0,8142 | 0,8865 | **+7,2 pts** |
| **LETRAS Y CIENCIAS HUMANAS** | 0,5699 | 0,6348 | **+6,5 pts** |
| CIENCIAS SOCIALES | 0,5338 | 0,5496 | +1,6 |
| GESTIÓN Y ALTA DIRECCIÓN | 0,5796 | 0,5938 | +1,4 |
| CIENCIAS E INGENIERIA | 0,2581 | 0,2440 | −1,4 |
| resto | | | < 1,4 pts |
| **GLOBAL** | 0,4982 | 0,4937 | −0,45 |

**El filtro no es neutral al sexo**, y en tres facultades mueve la composición
entre 6,5 y 8,5 puntos. En el agregado casi no se nota (−0,45), que es
justamente por qué se pasa por alto: **el sesgo es por facultad, y la cuota es
por facultad.**

## Y mueve las celdas que deciden

Traducido a cuotas, con la cuota de facultad vigente:

| Facultad | cuota | con el componente | con el marco | cambio en hombres |
|---|---:|---|---|---|
| ARTES ESCÉNICAS | 64 | 34 M · 30 H | 39 M · 25 H | **−17 %** |
| EDUCACION | 24 | 20 M · 4 H | 21 M · 3 H | **−25 %** |
| LETRAS Y CC.HH. | 23 | 13 M · 10 H | 15 M · 8 H | **−20 %** |

En las facultades chicas la elección de fuente mueve la cuota de hombres entre
un 17 % y un 25 %. Y son celdas de cuota 3, 8 y 10 — del mismo tamaño que
Psicología hombres (18), que es la que decidió el ganador del barrido.

## Conclusión

El argumento del par se sostiene y ahora tiene magnitud: **repartir por la
composición del marco importa el sesgo del filtro de criterios a la cuota**, y
ese sesgo llega a 8,5 puntos en una facultad. La proporción del componente se
calcula antes de filtrar y no lo tiene.

**El motor tiene razón; el entregable, no.** Y el invariante de procedencia —la
proporción del reparto tiene que ser la del estrato del componente, no la del
marco— queda como el criterio correcto, ahora con la razón medida detrás.

---

# IMPLEMENTADO — los tres arreglos (2026-08-28)

Gonzalo autorizó los tres. Cada uno con su regresión, y cada regresión
verificada revirtiendo el arreglo para verla en rojo.

## 1 · La certeza conserva la estratificación del diseño

`calc_muestra_aulas_certeza` ya no reescribe `rows$stratum`. Los tests viejos no
lo ejercitaban —usan `strata_cols` de un solo eje— así que hubo que construir el
fixture: dos estratos con la **misma masa de elegibles** (80 y 80) y tamaños
opuestos, ocho aulas de 10 contra dos de 40. Con la estratificación viva, un
sorteo de 2 toma una de cada estrato y rinde **siempre 50**; colapsado, el PPS se
lleva las dos grandes o dos chicas y la cola se hunde. La segunda regresión
comprueba justamente eso —que el fixture separa las dos conductas— para que el
verde no pueda ser coincidencia.

Verificado con el motor real sobre `HSVG26ULT2`:

| Facultad | asignadas | certeza vieja | **certeza estratificada** |
|---|---:|---:|---:|
| CIENCIAS CONTABLES | 3 | 3 | **2** |
| ESTUDIOS GENERALES CIENCIAS | 22 | 22 | **24** |
| ESTUDIOS GENERALES LETRAS | 20 | 20 | **23** |

Y `aulas_efectivas` sigue devolviendo exactamente lo pedido (22 → 22,00;
18 → 18,00), que es la guarda de que el reparto entre estratos no pierde aulas.

## 2 · El escritor de `rendimiento_tramos`

`calc_muestra_aulas_sello_tramos()` deriva la curva del histórico por razón de
sumas sobre los mismos cortes que el lector usa (15/25/35/50), y
`calc_muestra_aulas_sellar_efectividad()` la incorpora junto al multiplicador por
facultad. El router ya llamaba a esa función antes de construir el marco, así
que queda conectado sin tocar el endpoint.

Sobre el histórico de HSVG2026 produce **0,8091 · 0,6422 · 0,5657 · 0,5005 ·
0,4093** — exactamente los tramos que el ADR 0082 dice que el estudio tiene
sellados y no tenía.

Tres decisiones de diseño, con su regresión cada una:

- **Todo o nada.** Si a un tramo le falta respaldo (k < 12) no se sella ninguno:
  sellar cuatro de cinco correría los bordes del lector y reasignaría en
  silencio las aulas del tramo ausente al vecino.
- **Una tasa fuera de (0, 1] tampoco se sella**, ni capada. El lector la
  rechazaría y deformaría la curva; mejor quedarse en la embebida, que al menos
  se declara como tal.
- **Sin piernas.** Los escalones traen `efectivas` y `elegibles` y nada más, así
  que no hay con qué descomponer en asistencia × respuesta × validez.
  `tasa_asistencia_aula` sigue en NA, como ya estaba.

### CONSECUENCIA QUE HAY QUE DECIDIR: el estudio pasa de 165 a 175 aulas

El sello **no toca ningún `.pulso` existente** — actúa cuando se reconstruye el
marco. Pero en la próxima reconstrucción de HSVG2026, τ cae un 6,3 % y la
fórmula pide **diez aulas más**:

| Facultad | τ hoy | τ sellada | dif | fórmula hoy | nueva |
|---|---:|---:|---:|---:|---:|
| DERECHO | 0,5622 | 0,5136 | −8,6 % | 16 | **18** |
| ESTUDIOS GENERALES CIENCIAS | 0,4087 | 0,3795 | −7,2 % | 22 | **23** |
| ARQUITECTURA Y URBANISMO | 0,5629 | 0,5230 | −7,1 % | 8 | **9** |
| ESTUDIOS GENERALES LETRAS | 0,4192 | 0,3900 | −7,0 % | 18 | **19** |
| PSICOLOGÍA | 0,6767 | 0,6344 | −6,3 % | 5 | **6** |
| GESTIÓN Y ALTA DIRECCIÓN | 0,5659 | 0,5313 | −6,1 % | 6 | **7** |
| CIENCIAS Y ARTES DE LA COMUN. | 0,6702 | 0,6347 | −5,3 % | 7 | 7 |
| CIENCIAS E INGENIERIA | 0,5285 | 0,5014 | −5,1 % | 38 | **40** |
| resto | | | −4 % a +1 % | | sin cambio |
| **TOTAL** | | | **−6,3 %** | **165** | **175** |

Letras y CC.HH. es la única que **sube** (+1,1 %), porque sus catorce aulas caben
en el primer tramo y ahí la curva sellada es más alta que la embebida
(0,8091 contra 0,80).

No es un efecto colateral: es exactamente lo que significa dimensionar con la
calibración correcta en vez de con una que está 6 % alta. Pero es una decisión
del estudio, no una reparación, y por eso queda escrita acá antes de que aparezca
sola en una pantalla.

## 3 · El eje de sexo suma aula por aula

`.cm_certificacion_esperadas_sexo()` suma `sex_n × tasa_efectividad_aula` por
aula, con la tasa derivada de `efectivas_esperadas / eligible_n` si la columna no
viaja, y la tasa plana como fallback **declarado** en el nuevo campo `metodo` de
cada celda — la misma forma que ya tenía la rama de facultad.

Verificado sobre `HSVG26ULT2`: las 30 celdas pasan a `suma_esperadas` y **ninguna
cae**, como estaba previsto.

---

# Las tres decisiones, tomadas (2026-08-28)

Vara de Gonzalo, textual: «lo que yo no quiero es hardcodear nada, pero sí que
todo esté válido en el motor y que funcione correctamente. Sin alterar lo que ya
tenemos, porque es lo que tenemos y tiene que haber trazabilidad, pero sí
dejarlo como si es beneficioso para el motor en el siguiente sorteo».

## 1 · La calibración: sello automático, con procedencia

**Se deja automático**, porque ya cumple la restricción: actúa al reconstruir el
marco, así que ningún `.pulso` guardado cambia y el próximo sorteo sí lo recibe.

Y es lo contrario de hardcodear: hoy los cinco valores están **escritos en el
código** sin procedencia conocida; con el sello cada estudio los deriva de **su
propio histórico**. Se agregó `k` por tramo —cuántas aulas lo sostienen— y el
lector lo conserva: una curva sellada sin procedencia sería indistinguible de
una constante a mano, que es justo lo que este sello existe para no ser.

    hasta  15   tasa 0,8091   k=26        hasta  50   tasa 0,5005   k=50
    hasta  25   tasa 0,6422   k=53        hasta Inf   tasa 0,4093   k=27
    hasta  35   tasa 0,5657   k=38        respaldo total: 194 aulas aplicadas

Un sello viejo sin `k` publica NA, no un cero — tiene su regresión.

## 2 · El NAMESPACE: regenerado

Añade **26 exports y borra cero**, y se verificó uno por uno que los 26 tienen su
`@export` contiguo a su propia función —la trampa que exportaría otra—. Sin esto
esas funciones existen en dev y **no en el binario instalado**, que es donde
corren los jobs `callr`.

`calc_muestra_aulas_sello_tramos` NO se exporta: sólo la llama
`calc_muestra_aulas_sellar_efectividad`, en el mismo namespace, y la regla de la
casa reserva `@export` para lo alcanzable desde fuera.

## 3 · El τ del estrato: se refresca, y declara de dónde sale

La medición hace fácil la decisión, porque **separa las dos cosas**:

| escenario | fórmula |
|---|---:|
| A · τ congelada del marco DEF (lo que el estudio tiene hoy) | **165** |
| B · τ refrescada del marco vigente, tramos embebidos | **165** |
| C · τ refrescada + tramos sellados | **175** |

**El τ congelado no cambia el dimensionamiento.** Los diez aulas salen enteras de
la calibración. Así que refrescarlo no altera ninguna cifra del estudio: es
saneamiento puro.

El mecanismo del defecto: la función decía «un estrato que YA declara su τ
manda», pero **es el único escritor de ese campo** —verificado por barrido; el
frontend sólo lo lee— así que lo que frenaba el refresco era su propio valor de
la corrida anterior. Ahora recalcula siempre y sella `tau_origen = "marco"` más
el `tau_frame_hash`, con una puerta **explícita** `tau_origen = "manual"` para
una declaración humana. Antes esa puerta se deducía de que el campo estuviera
lleno, y eso es exactamente lo que fallaba.

Los dos campos entran también al tipo de TypeScript, para que la procedencia
sobreviva el viaje al frontend y vuelta.

### Contrato actualizado a propósito

`test-calc-muestra-aulas-efectividad-sello.R` fijaba el comportamiento aditivo
(«un estrato que ya declara su tau manda»). Se reescribió al contrato nuevo con
la nota de por qué cambió, en vez de borrarlo.

## Gate

    typecheck TS ............ limpio
    NAMESPACE ............... +26 / -0, contrato verde
    suites del area ......... 91 archivos · 2 792 PASS · 0 FAIL
