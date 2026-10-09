# Checklist — las siete decisiones de Gonzalo y la cola del loop de cobertura

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-08-27
Autoridad: Evidencia de las decisiones que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Doc vivo: se marca conforme se cierra cada ítem y **sólo Gonzalo lo da por
terminado**.

## La vara

Gonzalo, textual (2026-08-27):

> «cada uno de ellos no sólo es una comprobación e implementación en el backend,
> también lo es en el frontend»

Un ítem se cierra cuando el usuario **puede ver el efecto o tomar la decisión
desde la pantalla**, no cuando el motor está reparado y el test verde. Todo ítem
cerrado en backend se reabre con su mitad front hasta que esa mitad exista.

Y la regla de evidencia, también suya:

> «valida todo, no solo des por confirmar las cosas, porque sí, y validalas
> siempre desde la aplicación misma»

## Las siete decisiones

| # | Decisión (textual de Gonzalo) | Dónde vive | Backend | Frontend | Estado |
|---|---|---|---|---|---|
| 1 | «Lo segundo» — la comparación de métodos no es prerrequisito para **leer** una selección ya hecha, sólo para ejecutar una nueva | `aulas/aulasSurfaceState.tsx` | — | `eae20369` | ☑ **cerrada** |
| 2 | «Si ratifica» — ADR 0080, el workspace se resella entero | `docs/adrs/0080-…md` | — | — | ☑ **cerrada** `f233cc8c` (Ratificado + mordidas 6 y 7) |
| 3 | «Verificar como se hizo en el archivo ULT, entiendo que allí cada una fue 1000 corridas» | `calc_muestra_aulas_certeza.R` · `CertezaCoberturaPanel.tsx` | medido | `10ef2c7e` | 🔒 **RECOMENDACIÓN CORREGIDA: opción A** — el veredicto es estable aunque la probabilidad sea ruidosa. ~~Queda un arreglo aparte: el rótulo «en el ruido» mide el estadístico equivocado~~ — **RETIRADO el 2026-08-28: era afirmación mía y es falsa.** El rótulo mide bien. `precisionVeredicto` juzga el margen del candidato ANTERIOR al mínimo, que es lo que decide el veredicto: si ése alcanzara el nivel, el mínimo sería él. Medirlo como margen sobre el umbral —lo que yo proponía— ya se probó y se descartó con evidencia, y el comentario del código lo dice: marcaba tres facultades de HSVG2026 como ambiguas cuando sus veredictos aguantaban 21, 13 y 3 errores estándar. Mi ejemplo de Derecho (95,12 % y 96,10 % en dos corridas) tampoco lo sostiene: los dos valores superan el 95 %, asi que el veredicto NO cambió — lo que se movió fue el margen, no la decisión |
| 4a | «se muda a cálculo» — el editor de afijación | `calculo/TitularesFacultadEditor.tsx` | `a3b8918b` | `b98f9635` | ☑ **cerrada y vista en pantalla** — el stepper bajó a la columna Titulares de «Cursos-horario requeridos» y ya no exige certificación corrida |
| 4b | «certeza completo se va a cálculo y tiene su propia pestaña bien explicada al final de las demás pestañas» | `calculo/CalculoCertezaTab.tsx` | — | `d93e9bd5` + `e34ee2b3` | ☑ **cerrada y vista en pantalla** |
| 4c | «y selección ya sabes de los cambios de aulas hechos en certeza» | `aulas/classroomLabModel.ts` · `aulas/FijasPendientesAviso.tsx` | — | `d13e624c` | ☑ **cerrada y vista en pantalla** — el aviso existía pero no se encendía nunca para el componente de facultad, y además decía «fijaste 15» cuando el analista tocó una |
| 5 | «Cambiémoslo, sí» — renombrar `promedio_conglomerado`, que guarda el P25 | `calc_muestra_engine.R:1231` · `calc_muestra_alumnos_por_ch.R:569` | — | — | ☑ **CERRADA** — se hizo la **separación**, que es la opción que Gonzalo eligió el 2026-08-27 («la separación para el 5»). El divisor sellado vive en `divisor_conglomerado` con `divisor_estadistico` al lado (`calc_muestra_alumnos_por_ch.R:582`) y el motor lo prefiere (`calc_muestra_engine.R:1271`). `promedio_`/`mediana_conglomerado` vuelven a ser lo que dicen: **cero sitios** ponen ya la mediana a cero al sellar, y `estadistico_conglomerado` dejó de forzarse a «media» sobre un P25. **El renombre ya no aplica**: el nombre dejó de mentir, así que cambiarlo tocaría 38 sitios y un campo persistido del `.pulso` sin arreglar nada |
| 6 | «Necesita su ADR, necesita su propia pestaña al final de las pestañas actuales de selección porque es la última decisión» — rerandomización | [ADR 0082](../adrs/0082-rerandomizar-no-es-optimizar-entre-candidatas.md) · `calc_muestra_aulas_rerandomizacion.R` · `aulas/AulasRerandomizacionTab.tsx` | `598a9a94` `785929fc` `133c537b` | `689ee0ca` `8227aef6` `ff2b2cf9` | ☑ **cerrada entera y vista en pantalla** |
| 7 | «El sustento metodológico que creamos fue específico… el que crea la app debe ser más general pero considerar a detalle todo lo que escribimos en el de las 23 páginas» | `salidas/sustentoSecciones.ts` · `salidas/SustentoCoberturaCard.tsx` | — | `f0b3507a` `e01a5410` | ◐ **espina hecha y vista en pantalla** — los 11 capítulos declarados y la cobertura visible en Entregables; falta el render del documento |
| 8 | «esa agregación se puede llamar agregación operativa, ya que no sigue un criterio estadístico como tal» | `calc_muestra_engine.R` · `calculo/TitularesFacultadEditor.tsx` | `1b37a151` | `1b37a151` | ☑ **cerrada y vista en pantalla** — el nombre entra como VALOR del origen, no como campo, así que no choca con `aulas_extra_operativas` |

## Decisión 3, evaluada — tiempos medidos, no estimados

**Qué hace hoy.** `.cm_certeza_corridas` reproduce las 15 facultades exactas:
`disponibles ≤ 60` → las 1.000 pedidas; si no, `⌈1.000 × 60 / disponibles⌉`.
Es un presupuesto de **tiempo**: mantiene `corridas × disponibles ≈ 60.000`.

**Calibración medida el 2026-08-27** sobre el backend con el código actual:
Derecho solo, 3 evaluaciones × 205 sorteos sobre 293 filas = **64 segundos**,
o sea **355 µs por (sorteo × fila de marco)**. Con eso, la certificación
completa de las 15 cuesta **10,5 min**.

**Tres veredictos quedan dentro de su propio error de muestreo** (margen sobre
el 95% menor que 2 EE): CIENCIAS E INGENIERÍA (m/EE 1,62), EE.GG. CIENCIAS
(0,99) y DERECHO (0,08). Son las tres de marco más grande, es decir las de
mayor cuota: **el reparto da menos evidencia justo donde el veredicto está más
apretado**.

**La prueba directa de que es ruido**: la misma medición de Derecho con 18
aulas, repetida con la misma configuración y los mismos 205 sorteos, dio
**95,12 %** la primera vez y **96,10 %** la segunda. La diferencia (0,98pp) es
0,68 EE, perfectamente normal — pero el umbral está en 95,00 %, así que una
corrida deja margen 0,12pp y la otra 1,10pp. **El veredicto de Derecho se
decide por dónde cayó el ruido.**

| Opción | Tiempo | Qué resuelve |
|---|---:|---|
| **A** · dejar la fórmula | 10,5 min | nada nuevo; tres veredictos en el ruido |
| **B** · 1.000 para todas | **29,3 min** (2,80×) | sólo C&I |
| **C** · segunda pasada dirigida a lo que su margen pide, tope 1.000 | **13,6 min** (1,30×) | C&I y EE.GG. Ciencias |
| **D** · resolver también Derecho (~4.500 sorteos) | **36,0 min** (3,43×) | las tres |

Sorteos que cada una necesita para que su margen valga 2 EE: C&I **219** (tiene
144), EE.GG. Ciencias **1.722** (tiene 420), Derecho **~4.500** juntando las dos
corridas (tiene 205).

**Recomendación: C.** El tope se queda en 1.000; una segunda pasada vuelve a
correr sólo las facultades cuyo margen esté dentro de 2 EE, con los sorteos que
su margen pide (`4·p(1−p)/margen²`); lo que ni así se resuelve se declara
empate en vez de seguir gastando. B cuesta 16 minutos más que C y resuelve
menos.

**Corrección de una cifra que di antes**: estimé que Derecho necesitaba
~129.000 sorteos. Ese número salía de un solo punto ruidoso (margen 0,12pp).
Con las dos corridas juntas el margen es 0,61pp y hacen falta ~4.500 — caro,
pero no absurdo. La decisión sobre Derecho es real y no está cerrada de
antemano.


### Corrección: mi recomendación medía el estadístico equivocado

Gonzalo, 2026-08-27: «¿qué fue lo que utilizó en hostigamiento último? porque
siento que allí se hizo muy bien». Al medirlo, tiene razón, y el porqué obliga
a retirar la recomendación anterior.

**Qué se usó en HSVG26ULT: exactamente la fórmula de hoy.** Se pidieron 1.000
sorteos y el motor los escaló por facultad a 144–1.000. Nada más.

**Lo que lo hizo robusto no fue la precisión, fueron dos mecanismos:**

**1 · La regla `max(fórmula, certeza)`.** Verificada contra el archivo: explica
**14 de 15** facultades exactas; la única excepción es Derecho, que recibió +1 a
mano (18 → 19). Sumas: fórmula **165** · certeza **167** · max **173** ·
final **174**. Como la certificación sólo puede *añadir* aulas, un veredicto
ruidoso a la baja no hace daño: la cuenta directa lo pisa.

**2 · La curva es empinada justo en el punto de decisión.** Lo que decide no es
la probabilidad sino qué entero es el mínimo, y cada aula extra mueve la
probabilidad decenas de puntos:

| Facultad | p(n−1) | p(n) | salto | pp que faltan para voltear | en errores estándar |
|---|---:|---:|---:|---:|---:|
| DERECHO (18) | 28,29 % | 95,12 % | 66,8 | 66,7pp | **21,2 EE** |
| EE.GG. CIENCIAS (22) | 63,33 % | 95,95 % | 32,6 | 31,7pp | **13,5 EE** |
| CIENCIAS E INGENIERÍA (34) | 87,50 % | 97,22 % | 9,7 | 7,5pp | **2,7 EE** |

Y aunque C&I —la única con alguna chance— volteara de 34 a 33, la fórmula pedía
37 y `max` deja 37: **efecto cero sobre el número final**.

**La prueba empírica**: la corrida limpia de Derecho del 2026-08-27 dio
p(17) = 29,27 % y p(18) = 96,10 % contra los 28,29 % y 95,12 % originales.
La probabilidad se movió casi un punto y **el veredicto fue idéntico: 18**.

**Conclusión: la opción es A, dejar la fórmula.** Mi recomendación de C se
apoyaba en `margen / EE`, que mide cuán seguro es afirmar «este número alcanza
el 95 %». Pero la decisión no es esa: es cuál entero es el mínimo, y eso lo
gobierna el hueco entre candidatos consecutivos, que es enorme.

**Lo que sí queda por arreglar, y es barato**: el veredicto «en el ruido» de la
pestaña ¿Alcanza? mide el estadístico equivocado —`precisionVeredicto()` en
`certezaCoberturaModel.ts` compara el margen sobre el 95 % contra el error
binomial— y por eso marca como ambiguas tres facultades cuyo veredicto no lo es.
Debe medir la **estabilidad del mínimo**: la distancia de `p(n−1)` al umbral.
Es una falsa alarma que yo mismo introduje.


## Decisión 5 — RESUELTA por separación (2026-08-28)

> **Desenlace**: se implementó la separación recomendada abajo. `promedio_` y
> `mediana_conglomerado` ya no se pisan al sellar y el divisor sellado tiene
> campo propio. Lo que sigue es el análisis que llevó a esa elección; se
> conserva porque explica **por qué** el renombre no era la salida.

## Decisión 5, analizada — no es un renombre

`promedio_conglomerado` aparece en **38 sitios de 15 archivos** (3 en R, 12 en
frontend) y **viaja dentro del `.pulso`**. Pero el problema no es el nombre:
**el campo tiene dos significados vivos y uno destruye al otro.**

**Significado 1, el que dice el nombre.** `.cm_estadistico_conglomerado_estrato`
(`calc_muestra_engine.R:1231`) usa el par `promedio_conglomerado` /
`mediana_conglomerado` para resolver el divisor según
`parametros.estadistico_conglomerado`: con `mediana` toma la mediana, con
`min_media_mediana` toma el mínimo de las dos —la regla del diseño de 2025—, y
sin mediana degrada a la media. Ese camino **está vivo**: `divisorDelMarco.ts`
existe precisamente para poblar los dos divisores desde el perfil del marco, y
su comentario documenta que antes sólo llegaba la media y por eso
`min_media_mediana` no podía dispararse nunca.

**Significado 2, el que Gonzalo detectó.** Al sellar la decisión de alumnos por
CH, `calc_muestra_alumnos_por_ch.R:569` escribe en ese mismo campo **el valor
del estadístico elegido, sea cual sea** —P25 incluido—, pone
`mediana_conglomerado <- 0` y deja `estadistico_conglomerado <- "media"`. No es
un descuido: es una materialización deliberada del divisor, y el comentario lo
declara.

**El costo que nadie declaró.** Sellar la decisión **borra la mediana medida del
marco**, y `divisorDelMarco` sólo repuebla cuando el marco todavía no está
validado (`marco_validado > 0` corta la sincronización). O sea: después de
sellar, un estudio que quisiera volver a `min_media_mediana` ya no tiene con qué.

**El rótulo del usuario NO está roto**: `criteriosGeneralesModel.ts:113` ya lee
la decisión sellada por encima del parámetro, con historia documentada de
haberlo reparado —«la tarjeta decía media mientras el estudio dimensionaba con
p25, medido en HSVG2026».

### Las dos formas de arreglarlo

| | Qué se hace | Riesgo |
|---|---|---|
| **Renombre con alias** | `promedio_conglomerado` → nombre nuevo; leer los dos, escribir el nuevo | Mecánico, 38 sitios. **Pero no arregla nada**: el campo sigue teniendo los dos significados, sólo que con otro nombre |
| **Separación** (recomendada) | Campo nuevo `divisor_conglomerado` para el divisor sellado; `promedio_` y `mediana_` vuelven a ser lo que dicen y dejan de borrarse; el motor prefiere el sellado cuando existe | Es aditivo —ningún `.pulso` viejo cambia de significado— pero **cambia el comportamiento del divisor de todo estudio** y hay que mover los 38 consumidores a preferir el campo nuevo, o las pantallas pasarían a mostrar la media cruda |

**Por qué está bloqueada y no pendiente**: «cambiémoslo, sí» autoriza el cambio
pero no cuál de los dos, y el segundo toca el divisor del que cuelga toda la
muestra. Además la separación recupera una capacidad que hoy se pierde en
silencio (`min_media_mediana` después de sellar), lo cual la hace más que un
saneamiento de nombres y probablemente merezca ADR.


## Decisión 8 — la agregación operativa

Gonzalo, 2026-08-27, textual: «aun con la certeza yo puedo agregar aulas
adicionales al sorteo si lo veo conveniente, es decir si veo por ejemplo que
derecho va muy justo le puedo agregar una más a pesar de que la certeza me diga
que sólo le agregue 3 y yo le agrego 4 porque sí; esa agregación se puede llamar
**agregación operativa**, ya que no sigue un criterio estadístico como tal».

**Ya ocurrió, y está medido.** En HSVG26ULT, `max(fórmula, certeza)` explica 14
de las 15 facultades exactas. La quincuagésima —Derecho, 18 → 19— es
precisamente eso: una agregación operativa. Las sumas lo dicen solas:
fórmula 165 · certeza 167 · max **173** · final **174**. **Ese aula de
diferencia es la decisión de Gonzalo, y hoy el proyecto no la distingue de las
otras 173.**

**Lo que falta.** `aulas_base_fijas` es un entero pelado: el motor lo lee y lo
usa como `aulas_base` si es mayor que 0 (`calc_muestra_engine.R:1366`), sin
registrar de dónde salió. Los tres orígenes posibles —lo que calculó la
fórmula, lo que certificó la simulación y lo que decidió el analista— viven en
el mismo campo y producen números idénticos a la vista. Es la misma familia que
el punto 6 del [ADR 0082](../adrs/0082-rerandomizar-no-es-optimizar-entre-candidatas.md):
un artefacto que no declara cuál mecanismo produjo su número no permite
reconstruir el diseño.

**Trampa de nombre, y hay que resolverla antes de adoptarlo.**
`aulas_extra_operativas` **ya existe y significa otra cosa**: es el cupo de
reserva por facultad (`aulas_reemplazo`, `calc_muestra_engine.R:1371`), lo que
se suma a los titulares para dar `aulas_total`. Llamar «agregación operativa» a
lo que suma **titulares** dejaría dos cosas distintas con casi el mismo nombre
en el mismo estrato — exactamente el defecto que más veces ha mordido en este
proyecto. O el concepto se llama distinto, o el campo viejo se renombra.

**Forma propuesta**: `aulas_base_fijas` gana un hermano que declare el origen
—`formula` · `certificacion` · `operativa`— y, para el tercero, una nota breve.
El stepper de Cálculo escribe `operativa`; «Llevar a N» escribe
`certificacion`. Con eso el sustento puede decir «Derecho: 16 por fórmula, 18
certificado, 19 por decisión operativa» en vez de un 19 sin padre. Es aditivo:
ningún `.pulso` viejo cambia de significado, y los que no traen el campo se
leen como origen desconocido.

**Estado**: ☑ **cerrada** (`1b37a151`). Gonzalo: «Hazlo». La nota quedó
obligatoria pero sin bloquear el clic: el ajuste se aplica en el momento y la
celda declara el vacío en ámbar hasta que se escribe. El nombre entra como
**valor** del origen (`origen: "operativa"`) y no como nombre de campo, así que
no compite con `aulas_extra_operativas`.

**Y al verificarlo apareció el defecto más grave del día**, reparado en
`aa0f8671`: **«Recalcular muestra» borraba las quince fijaciones**.
`prepareUniversityStudyForCalculation` pasa por `universityComponents`, que
reparte un solo marco a los dos componentes, y persistía el resultado. Medido en
la app: 15 fijaciones que sumaban 175 → **cero**, objetivo de 175 a **294**. Es
la misma raíz que `a3b8918b`, donde se había contenido sólo en los cuatro
handlers del stepper; ahora está reparada en el repartidor. Explica además el
294 que se había atribuido a un `state.rds` viejo.


## La cola del loop de cobertura

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| D1 | El agregador de aulas de certeza | `calculo/TitularesFacultadEditor.tsx` | ☑ `b98f9635` — el editor salió de la tarjeta de certificación, que lo escondía hasta haber sorteado |
| D2 | La certeza no limpiaba `faculty_targets` y sorteaba la selección, no el marco | `calc_muestra_aulas_certeza.R` | ☑ los dos lados: `8ed2f0a3` + `042be9d8` |
| D3 | La búsqueda no evaluaba el candidato que nombra | — | ☑ es D2, no era defecto aparte |
| D4 | `promedio_conglomerado` guarda el P25 | workspace | 🔒 más suave de lo dicho: sólo el nombre engaña — es la decisión 5 |
| D5 | `.cm_certeza_corridas` escala por marco, no por precisión | `calc_muestra_aulas_certeza.R` | ◐ front cerrado (`10ef2c7e`: se ven las corridas y el ruido); **cuántas correr decide Gonzalo** — es la decisión 3 |
| D6 | El landing del cubo se colgaba con muchas columnas de balance | `calc_muestra_aulas_balance_saneo.R` | ☑ `a288a0d5`, `dadf4547`, `569905b9` |
| D7 | `program` en `balance_vars` degeneraba el cubo | idem | ☑ neutralizado y declarado en pantalla con su cifra |
| D8 | Las cuatro rutas de aulas resolvían el config distinto | `calc_muestra_aulas_config_fusion.R` | ☑ `17ac55d9` — era la raíz de D2 vista desde el config |
| F1 | `seed` sin control en la UI | `aulas/AulasObjetivoTab.tsx:329` | ☑ **falso** — el control existe como `semilla`. NO construirlo |
| F2 | `balance_vars` sin control | `aulas/VariablesBalanceControl.tsx` | ☑ `fa500edd` — falta verlo en pantalla |
| F3 | `coverage_weight` y `pps_weight` sin control | `calc_muestra_aulas_cube_determinista.R` | ☑ medido (`84727850`): con el motor vigente sólo anotan un score; sólo deciden con `pool_controlado`. Construir el control es decisión de producto, no defecto |
| B1 | Rerandomización: falta el bucle y el criterio | — | ☐ es la decisión 6 |
| B2 | Matriz por CH y facultad con sexo | `calc_muestra_aulas_export_workbook.R` | ☑ `e3330224` — hoja «Sexo por facultad» |
| B3 | Base de contactos de docentes titulares | — | ☐ pendiente |
| B4 | Sustento metodológico como documento, no hoja de Excel | — | 🔒 **bloqueado** — es la decisión 7 |
| B5 | El libro de tres dimensiones | — | ☑ ya existía; cerrado por la sesión de Monitoreo |

## Fuera de la lista, por pedido urgente suyo

| Ítem | Estado |
|---|---|
| «Necesito que lo repares porque la otra sesión está validando monitoreo y necesita tener las 174 aulas reales del sorteo» — la corrida no se publicaba por diferir en cantidad | ☑ `bcb33dff` + `0bfe6d27`: ahora decide la identidad y la cantidad se declara |

## Decisión 6 — cerrada de punta a punta

ADR **aceptado** por Gonzalo (`d9c10507`), y las cinco piezas construidas:

| Pieza | Dónde | Commit |
|---|---|---|
| El motor: aceptar/rechazar contra criterio | `calc_muestra_aulas_rerandomizacion.R` | `598a9a94` |
| Cableado al sorteo de titulares y al resultado | `calc_muestra_aulas.R` | `785929fc` |
| El criterio sobrevive el round-trip del workspace | `calc_muestra_engine.R` | `133c537b` |
| El criterio se deriva del estudio | `aulas/criterioRerandomizacion.ts` | `689ee0ca` `8227aef6` |
| La pestaña, última de Selección | `aulas/AulasRerandomizacionTab.tsx` | `ff2b2cf9` |

**Verificado en la app** con HSVG26ULT: la pestaña aparece la décima y última de
Selección, el criterio se declara como «toda celda facultad × sexo alcanza al
menos el 100 % de su cuota · **30 celdas de 15 facultades**», y al encender el
interruptor la decisión **persiste con cifras que cuadran**: ARQUITECTURA sale
con `cuota_f 86,4875 + cuota_m 38,5125 = 125` —su cuota exacta— y
`tau 0,5461`, el mismo 54,6 % que muestra la tabla de cursos-horario.

**Tres defectos aparecieron construyéndola y ninguno era del diseño:**

1. El criterio **moría en la whitelist del workspace** —`.cm_normalize_workspace_aulas_config`
   es estricta y no lo declaraba—, así que el `.pulso` lo habría perdido en cada
   guardado. Cuarta vez en el día que un dato muere entre capas.
2. El motor tiene **dos constructores** de `aulas_por_estrato`, uno por técnica,
   y el del reparto por facultad se quedó sin los campos nuevos en la primera
   pasada.
3. Al verificar el interruptor, el dato **no aparecía en el estado**: no era un
   defecto de persistencia sino que el backend llevaba corriendo desde 86
   minutos antes del cambio. Lo cazó comparar `ps -o lstart=` contra la hora del
   commit antes de concluir.


## Decisión 7 — el inventario dice que falta el ensamblador, no el contenido

Gonzalo: «el que crea la app debe ser más general pero de todas formas
considerar a detalle todo lo que escribimos en el de las 23 páginas y nuestro
motor tiene esa información». Mapeados los once capítulos contra la app,
comprobando cada uno en el código en vez de suponerlo:

| Cap. | Contenido | Dónde vive hoy |
|---|---|---|
| 1 | Quiénes entran al estudio | Marco › Criterios · el embudo (`EmbudoComparadoFacultades`) |
| 2 | Qué aulas pueden usarse | Marco › Aulas · criterios del marco |
| 3 | Cuántas encuestas necesita | Cálculo › Diseño (`CalculoDisenoTab`, la fórmula con sus supuestos) |
| 4 | **τ: cuántas encuestas produce un aula** | **SÍ existe descompuesto**: el motor publica `rendimiento_mix` y `factor_residual` (`calc_muestra_aulas_efectividad.R:316`) y la pantalla los muestra con una guarda que sólo desglosa si el producto cuadra (`tasaFacultadModel.ts:115`) |
| 5 | Cuántas aulas hacen falta | Cálculo › Cursos-horario requeridos · `CadenaFormulaFacultad` |
| 6 | Cuáles aulas y por qué esas | Selección › Relato, siete escenas (ADR 0067) |
| 7 | Las cuotas por sexo | `sexo_por_facultad` · hoja del libro (`e3330224`) |
| 8 | Qué hacer cuando un aula no se aplica | Selección › Reemplazos |
| 9 | Criterios para el campo y su monitoreo | **En Monitoreo, no en Cálculo**: `AulasCriterioDeAula`, `AulasPronosticoDeCierre`, `alcanceDelBanco`, `agendamiento`, `tiemposDeRespuesta` |
| 10 | Contraste con la propuesta técnica | `SalidasCoincidenciaTab` |
| 11 | Cómo reproducir la selección | Relato › cierre (motor, semilla, hash) |

**El contenido de los once capítulos ya existe en la app.** Lo que no existe es
el **documento**: el relato vive en pantalla y no se exporta, y el contenido del
capítulo 9 vive en otro módulo. `paqueteDefensa.ts` empaqueta artefactos con su
huella, pero no redacta.

**Eso reencuadra la decisión 7**: no es escribir un motor de contenido, es
escribir un **ensamblador** que recorra las once secciones leyendo lo que cada
superficie ya calcula, y que cruce el límite Cálculo ↔ Monitoreo para el
capítulo 9. Dos consecuencias que conviene decidir antes de construir:

1. **Un sustento que cruza módulos necesita que Monitoreo publique sus criterios
   como dato**, no sólo como pantalla. Hoy `AulasCriterioDeAula` los pinta.
2. **El documento hereda el problema de los artefactos**: si se genera desde un
   estado que ya cambió, afirma un diseño que no es el ejecutado. El
   fingerprint de `paqueteDefensa.ts` es la pieza que lo resuelve y hay que
   reusarla, no reinventarla.


### Corrección al inventario: hay más construido de lo que dije

Al ir a construir el ensamblador encontré tres cosas que mi inventario no
recogía, y las tres reducen el trabajo:

1. **Selección ya tiene una pestaña «Sustento técnico»** (`AulasAuditoriaTab`,
   266 líneas) que renderiza las **fórmulas del diseño con los valores reales
   del estudio** —en LaTeX, con sus términos— y un bloque de
   **reproducibilidad**. Yo había atribuido la reproducibilidad al cierre del
   relato; está en los dos.
2. **El export ya lleva una hoja «Bitácora metodológica»**: 20 campos con
   `selection_run_id`, `frame_hash`, semilla, motor solicitado y usado, fuente
   de probabilidades y de pesos, políticas de no respuesta y reemplazo,
   advertencias y las tres referencias. Es el antecesor directo del documento y
   explica por qué el ítem original de la cola se llamaba **«sustento
   metodológico como documento, no hoja de Excel»**.
3. **El motor ya redacta prosa**: `selection_result$methodology` trae siete
   campos escritos —diseño, selector, probabilidades, Monte Carlo, pesos,
   representatividad y advertencia—. Terso y en registro de bitácora, pero
   redactado.

**Lo que sigue faltando, y ahora está mejor delimitado**: nada produce un
**documento** con los once capítulos en el registro del PDF de 23 páginas. Las
piezas están repartidas entre cuatro superficies —el sustento técnico, el
relato, la bitácora del export y la prosa del motor— y ninguna las reúne.

El ensamblador, entonces, no escribe contenido nuevo: **recoge, ordena y sube de
registro** lo que ya existe, y sólo tiene que redactar de cero los enlaces entre
capítulos. Sigue en pie que el capítulo 9 vive en Monitoreo y que eso exige la
decisión de Gonzalo.


### La espina, vista en pantalla

Verificado con HSVG26ULT en Salidas › Entregables, debajo de donde se genera el
reporte: **«10 de 11 capítulos se pueden escribir con lo que el estudio tiene
ahora. Uno depende de otro módulo y no se resuelve trabajando acá.»** Diez
listos, uno externo, cero pendientes.

El capítulo externo se lee entero y sin eufemismo: «Este capítulo vive en
Monitoreo, que hoy lo muestra en pantalla pero no lo publica como dato. El
documento puede citarlo pero no reconstruirlo.» Y los disponibles muestran su
fuente literal — el de τ dice `aulas_por_estrato[].tau`, con su descomposición
en `rendimiento_mix × factor_residual`.

**Lo que falta de la 7**: el render del documento. La espina ya dice qué
recoger y de dónde.


## Una hoja llamada «Validaciones» que no validaba nada

Lo destapó otra sesión el 2026-08-27: en
`HSVG2026_matriz_seleccion_202.xlsx` la fila 1 de **Validaciones** decía
«Cobertura minima 1.14 (Derecho)» cuando el mínimo real es **1,081 en
EE.GG. Letras** —Derecho está en 1,165— y el 1,14 **no existe** en esa columna.

**No era un caché ni un número envejecido.** El libro no lo genera Prosecnur:
lo genera el runner `matriz2.R` del scratchpad de este loop, y su hoja
Validaciones era un `read.csv(text="...")` con **36 filas literales y cero
interpolación**. Ninguna fila se calculaba, así que la columna Estado decía
«OK» porque alguien tecleó «OK». **La hoja no podía fallar por construcción**,
y la fila 2 —que parecía sana— tampoco verificaba nada: sólo no se había
desactualizado. Otra fila citaba un «ADR 0082» que no existía.

**Reparado**: las 17 filas se calculan de los datos del propio libro y el Estado
se deriva. Cuatro estados con significados distintos: **OK** (comprobado y
pasa), **AVISO** (comprobado, no es defecto, campo debe saberlo), **REVISAR**
(exige decisión) y **DATO** —nuevo— para las constancias del diseño, que dejan
de decir OK porque nunca fueron comprobaciones.

**Tres defectos míos aparecieron al escribirlo**, y valen como aviso de que
sustituir prosa por cálculo sólo sirve si el cálculo es correcto: filtré los
reemplazos por un `sample_role` que no existe (el real es `chain_reserve`, y
daban 0 de 1.259), comparé el techo operativo contra el pool de candidatas en
vez del cupo de reserva, y busqué las marcas DAA por cadenas equivocadas.

**Comprobado contra la versión tecleada**: la fila del traslape reproduce
exactamente los **CH 34 42 54 90 124 155** que estaban escritos a mano, y el
reparto 174 + 1.259 + 79 = 1.512 cuadra. **Y comprobado que puede fallar**:
subiendo el umbral de cobertura a 1,20 la fila pasa a REVISAR y el conteo baja
de 11 OK a 10.

El libro corregido queda al lado del original, sin pisarlo, como
`HSVG2026_matriz_seleccion_202_validado.xlsx`.


## Hallazgos abiertos por otras sesiones

| Hallazgo | Quién lo mide | Qué implica de mi lado |
|---|---|---|
| El 25 % de los titulares de 2025 no se sostuvo (24 reemplazadas, 19 a reserva, 8 reagendadas de 170), y se cae en las facultades **pequeñas**: Artes Escénicas 4 de 7, Gestión 3 de 6, Educación 2 de 4, Gastronomía 1 de 2 | `infallible-mayer-024785-cb` | Son las mismas que la simulación dice que no llegan a su cuota. La holgura ahí no es refinamiento: es condición para que la facultad exista en el resultado. **Insumo de la decisión de afijación** |
| `aplicada` es canónico para `operational_status` y NO existe para `sample_status`; las seis palabras reales caen a `sin_contactar` | idem, `monitoreo_aulas_estados_no_reconocidos.R` | Una reserva marcada «aplicada» se cuenta como reserva **libre** y la cola de contacto la vuelve a llamar. No tocar `sample_status` sin avisarles |

## El 165 contra 174, resuelto

No era una cifra desfasada: **es el otro escenario**. `cmp-cine0qk8`
(universidad) tiene cero fijaciones y `aulas_base_total = 165`;
`cmp-cine0qk8-fac` (facultad) tiene las **15 `aulas_base_fijas` que suman 174**.
La app abre en `P1 · Universidad` y el sorteo real se hizo con `P2 · Facultades`.
Cualquier superficie que lea `currentAulasTarget` sin fijar el escenario dirá
165 con datos vigentes.

## Lo aprendido en los que aún no se tocan

- **4a**: el mecanismo existe entero (`estratosConAulaExtra`, `estratosConAjusteAula`,
  `fijasPendientes`) y el stepper ±1 está en `CertificacionFacultadCard.tsx:252-261`.
  **La causa** de que no se pueda usar es la línea 130: `if (!certificacion) return null`.
  Sin certificación corrida no hay forma de subir aulas desde la pantalla. En
  `AulasObjetivoTab.tsx:87-95` el número se muestra pero es de sólo lectura.
- **5**: `alumnos_por_ch_decision.estadistico = p25` sí está registrado y confirmado
  por el usuario. El P25 coincide exacto en las 15 facultades; la media difiere
  hasta 12 puntos (EGC 52,9 real contra 46,5 declarado).
- **6**: de 50 sorteos sólo **25** cerraban las 30 celdas; cobertura mínima mediana
  **0,998**; la elegida fue semilla **202** con cobertura mínima **1,079**.

## Trampas que costaron un ciclo

- **Un objeto compartido arrastra decisiones que no son suyas.** El marco se
  reparte a los dos componentes por diseño, pero `aulas_base_fijas` viajaba
  dentro y el componente de facultad llegaba sin las suyas. Escribir de vuelta
  las borraba: un clic pasó de **15 fijaciones que suman 174** a **1 que suma 9**.
  Reparado en `a3b8918b`. El tell fue mirar el estado real cuando la pantalla
  decía cero fijaciones y la API decía quince.
- **Declarar una pestaña en el catálogo no la hace visible.** El strip la consume
  desestructurando por posición y descarta el resto en silencio. Cerrado con test
  de paridad en `universidadTabs.test.ts`, para las cuatro secciones.
- **Tres contadores separados** cuentan las pestañas: `catalogos.test.ts`,
  `manifiesto.test.ts` y `modulesNavigation.test.ts`. Los tres suben juntos.
- **Vitest da rojos falsos con el dev server arriba**: tres contratos que leen
  disco se pasan de los 5 s. Corridos solos, verdes.
- **Un `state.rds` extraído es una foto y el `.pulso` sigue vivo.** Comparar
  timestamps antes de medir.
