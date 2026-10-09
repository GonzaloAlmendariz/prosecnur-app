# Diagnóstico — el sorteo de aulas de HSVG 2026, medido contra el motor

Tipo: Diagnóstico QA fechado
Estado: En curso
Fecha: 2026-08-26
Autoridad: Evidencia de las mediciones que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Doc vivo del loop de cobertura: cada medición se anexa con su cifra y su
denominador, y lo que se descarta se anota como descartado para no
reinvestigarlo.


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

### Corrección: el `.pulso` NO pierde el mapa de estudiantes

La sección anterior atribuyó la diferencia de rendimiento a que «la sesión
reabierta perdió el mapa estudiante→aula». **Es falso, y se midió.**

El `.pulso` conserva `unique_student_ids` en el marco. Sobre las 293 aulas
seleccionables de Derecho: **11 596 ids en total, 2 550 distintos, 78 % de
traslape**. El motor puede ver el solape y lo ve.

El motor además tiene un degradado honesto para marcos sin ids
(`.cm_certeza_estudiantes_netos`, `calc_muestra_aulas_certeza.R:97`): cae a la
suma de elegibles y lo declara como `base_conteo = "suma_elegibles"`, con un
comentario que dice que es la cota superior «para que nadie lea un optimismo
estructural como si fuera una medición». Ese camino no se activó: ambas corridas
declararon `estudiantes_unicos`.

**Lo que sí está medido**, simulando 400 sorteos uniformes de Derecho:

| aulas | únicos | suma elegibles | rend. únicos | rend. suma |
|---|---|---|---|---|
| 16 | 568 | 635 | 322,7 | 360,6 |
| 18 | 629 | 713 | 357,6 | 405,4 |
| 19 | 660 | 753 | 375,1 | 428,1 |

La certificación original da 16→340,1 · 17→357,6 · 18→376,3, coherente con
conteo de únicos bajo un sorteo equilibrado por tamaño, que toma aulas algo más
grandes que el uniforme.

La sesión reabierta reporta **~394 para todo candidato que evalúa**, en las dos
direcciones de búsqueda: con `aulas_formula: 19` dio 394,11 etiquetado «4
aulas», y con `aulas_formula: 16` dio 393,7 y 394,6 etiquetados 15 y 16. Un
rendimiento constante ante candidatos distintos no es ruido: es que no está
evaluando el candidato que nombra. 394 corresponde a unas 19–20 aulas.

**Hipótesis, no medición:** en un proyecto reabierto con la selección ya
aplicada, el config de sesión lleva el reparto final (Derecho 19) y la ruta de
certeza lo toma por encima del candidato. Esto uniría D2, D3 y la precedencia
distinta de `router_calc_muestra.R` (~1052 contra ~1106). **Falta probarlo**:
certificar sobre un `.pulso` con marco y sin selección aplicada, y ver si la
curva vuelve a moverse con el candidato.

Consecuencia práctica para el documento metodológico: la nota que reporta el
éxito de Derecho con 19 aulas como «≥ 95,1 %» sigue siendo correcta, porque se
apoya en la certificación original y en la monotonía, no en estas corridas.

### La causa, medida: con la selección aplicada, la certeza sortea la selección

Experimento decisivo. Sobre el proyecto reabierto, certificar Derecho con
`aulas_formula: 40` y cuota 900, para forzar la búsqueda a barrer hacia arriba:

| aulas | rendimiento | Δ |
|---|---|---|
| 40 | 392,7 | |
| 45 | 393,3 | +0,6 en 5 aulas |
| 50 | 394,8 | |
| 55 | 394,6 | **−0,2 en 15 aulas** |

`disponibles: 293`, así que el marco está ahí. Pero el rendimiento es **plano**:
quince aulas más no mueven nada. En la certificación original cada aula sumaba
~18 (16→340,1 · 17→357,6 · 18→376,3).

El valor constante lo identifica: 394 ⁄ 0,5683 = **693 estudiantes únicos**. Los
**19 titulares de Derecho ya seleccionados** reúnen **675 únicos**, rendimiento
383,6. Coincide dentro del 3 %.

**Conclusión: en un proyecto con la selección aplicada, la certificación sortea
sobre las aulas ya seleccionadas en vez de sobre el marco.** Por eso su curva es
plana, por eso ignora el candidato, y por eso da números que no se parecen a los
de la certificación que produjo ese mismo diseño.

Lo que descarta el experimento:
- No es pérdida del mapa de estudiantes: está entero, 78 % de traslape.
- No es el degradado a `suma_elegibles`: nunca se activó.
- No es `faculty_targets`: viene **vacío** en el config de sesión y en el del
  marco de este proyecto.
- No es `.cm_certeza_evaluar`: fija `sim_selector$n_aulas <- aulas` y
  `replacement_waves <- 0L` correctamente antes de despachar el sorteo.

**Dónde seguir:** el `rows` que llega a `.cm_certeza_evaluar` y el despacho
`.cm_aulas_select_once_dispatch`. Algo entre la ruta y esa llamada sustituye el
marco por la selección cuando `s$calc_muestra_aulas_selection` existe.

**Impacto para el usuario:** quien reabre su proyecto y vuelve a certificar
obtiene una curva plana. Con una cuota alcanzable leería que cualquier número de
aulas sirve; con una alta, que ninguno sirve. En los dos casos el número que ve
no responde a la pregunta que hizo.

### El defecto, localizado: la certeza no limpia `faculty_targets` del selector

Comparando el selector de las dos sesiones, sólo tres claves difieren, y una lo
explica todo:

| clave | corrida que certificó | sesión reabierta |
|---|---|---|
| `faculty_targets` | vacío | **15 facultades** |
| `n_aulas` | 30 | 174 |
| `seed` | 20260619 | 202 |

La comprobación anterior, que dio «vacío» en las dos, miró el `state.rds` del
`.pulso`. El config **vivo** de la sesión, el que la ruta lee primero, sí los
lleva: `afijacionTargets.ts` los inyecta en cada selección, por diseño.

**La cadena:**

1. `.cm_certeza_evaluar` (`calc_muestra_aulas_certeza.R:112`) clona el selector y
   fija `sim_selector$n_aulas <- aulas` y `sim_selector$replacement_waves <- 0L`.
   **No limpia `faculty_targets`.**
2. `.cm_aulas_select_once_engine` (`calc_muestra_aulas.R:2127`) calcula
   `n_total` desde `selector$n_aulas`, correcto, y llama a
   `.cm_aulas_quota_estratos(aula_frame, n_total, selector)`.
3. `.cm_aulas_quota_estratos` (`calc_muestra_aulas_afijacion.R`) dice en su
   propio comentario: *«Nivel 1 — facultades con target: su n manda, capado a lo
   disponible»*. Con `DERECHO = 19` en los targets, el sorteo toma **19 aulas
   pase lo que pase**, y `n_total` sólo reparte el remanente entre las
   facultades **sin** target.

Por eso la curva es plana: el candidato de la certificación nunca llega al
sorteo. Y por eso el valor constante era ~394, que son las 19 aulas del reparto
aplicado a Derecho (675 únicos medidos, 693 observados).

**La reparación es una línea** en `.cm_certeza_evaluar`, junto a las dos que ya
están: `sim_selector$faculty_targets <- NULL`. En una certificación el candidato
tiene que mandar; es la pregunta que la certificación hace.

**La regresión que lo fija**: certificar un estrato con `faculty_targets`
poblados y exigir que `rendimiento_medio` crezca con el candidato. Hoy da
392,7 con 40 aulas y 394,6 con 55; con la reparación debe subir de forma
monótona.

**Ironía a registrar**: `faculty_targets` se introdujo para reparar que el
sorteo ignorara el reparto por facultad (`afijacionTargets.ts` documenta
«DERECHO diseño 18 → sorteo 36»). Esa reparación rompió la certificación, que
reusa el mismo selector. Es el patrón de un fix que corrige la superficie
vecina: el 33 % de los fixes de este repo tocan archivos que un feat tocó uno a
tres commits antes.

Queda descartado, y no debe re-investigarse: pérdida del mapa de estudiantes,
degradado a `suma_elegibles`, `docente_unico` (246 docentes distintos en
Derecho, no topa en 20), el descuento secuencial (su greedy daría 1 694 únicos
con 40 aulas, no 693) y la asignación por estrato (con un solo estrato devuelve
`n_total` correctamente).

## El costo del landing del cubo, medido (2026-08-27)

El encargo traía la hipótesis de que el landing «desborda el entero de R en
q≥31 y produce NA en silencio». **No es eso.** Medido sobre
`.cm_aulas_samplecube_estable` con 60 aulas y cuota 20, variando el número de
columnas de balance:

| columnas | resultado | segundos |
|---|---|---|
| 4 | 20 índices | 0,1 |
| 12 | 20 índices | 0,2 |
| 16 | 20 índices | 1,4 |
| 20 | 20 índices | **29,2** |
| 24 | no terminó | **930,3** |

El costo crece como 2^q, como corresponde a la enumeración del aterrizaje. Dos
consecuencias que no estaban anotadas:

1. **No falla: se cuelga.** El `tryCatch` de `.cm_aulas_samplecube_estable` sólo
   atrapa `error`, y acá no hay error.
2. **Un timeout no lo rescata.** `R.utils::withTimeout(..., timeout = 45)` no
   pudo interrumpirlo y el caso corrió 930 s, porque el trabajo ocurre en código
   compilado que no atiende interrupciones. Cualquier guarda tiene que ir
   **antes** de entrar al landing.

### Cuántas columnas tiene el caso real

`balance_vars` del proyecto guardado: `faculty, sex_top_1, size_group, program,
level`. Los niveles distintos sobre las 1 512 aulas del marco:

| variable | niveles | columnas |
|---|---|---|
| faculty | 15 | 14 |
| sex_top_1 | 2 | 1 |
| size_group | 4 | 3 |
| **program** | **1 049** | **1 048** |
| level | 11 | 10 |

El saneo por columna (`.cm_aulas_balance_matrix_saneada`) descarta las variables
**sin variación** dentro del estrato, que es lo que documenta su cabecera, pero
**no acota por cardinalidad**. Aplicándolo de verdad sobre los 76 estratos del
marco:

- mediana **9** columnas, máximo **146** (DERECHO | F | G4, 220 aulas)
- **18 de 76 estratos superan las 20 columnas**, y 24 ya no termina

Los diez peores van de 38 a 146 columnas. Con la curva medida arriba, esos
estratos no completan un sorteo.

**Es el síntoma con el que abrió esta sesión**: el sorteo colgado en Gestión y
Psicología. Se resolvió sacando `program` de `balance_vars`, pero **el proyecto
guardado sigue declarándolo**, así que quien reabra `HSVG26ULT.pulso` y vuelva a
sortear se encuentra el mismo cuelgue.

**La reparación** es una cota previa sobre el número de columnas de balance por
estrato, que falle con `stop_api` y nombre la variable culpable antes de entrar
al landing. El umbral sale de la medición: 16 columnas es instantáneo, 20 cuesta
29 s por sorteo, y la certificación hace 205 sorteos por candidato. La norma ya
está escrita en el propio repo, en `.cm_aulas_quota_estratos`: «Config
contradictoria -> se falla FUERTE, no se traga en silencio».

**No medido:** no se re-corrió el sorteo con el config guardado, porque por
construcción no terminaría. La afirmación de que colgaría es inferencia sobre
la curva, no observación.

## Qué del sorteo se puede tocar desde la pantalla, y qué no (2026-08-27)

Gonzalo, textual: *«todo lo relacionado a las simulaciones Monte Carlo, los
múltiples sorteos de cubo y selección del mejor y los criterios de selección,
hay muchísimas cosas que terminamos haciendo en el backend pero que finalmente
no hicimos en el frontend; el agregador de aulas específicamente en certeza»*.

Medido sobre `frontend/src/features/calcMuestra/universidad/`, distinguiendo
entre un parámetro **tipado con default** (aparece en `constants.ts` o
`study.ts`) y uno con **control editable** (un `.tsx` que lo toca con
`NumberCell`, `<input>` o `updateConfig`):

| parámetro del selector | control editable | dónde |
|---|---|---|
| `monte_carlo_n` | sí | Aulas · Objetivo |
| `simulation_runs` | sí | Aulas · Objetivo |
| `candidate_pool_size` | sí | Aulas · Objetivo |
| `selector_engine` | sí | Aulas · Método |
| `sequential_discount` | sí | Aulas · Método |
| `docente_unico` | sí | Aulas · Objetivo |
| **`seed`** | **no** | — |
| **`balance_vars`** | **no** | — |
| **`spread_vars`** | **no** | — |
| **`coverage_weight`** | **no** | `ObjectiveWeightsPanel` sólo los muestra |
| **`pps_weight`** | **no** | idem |
| **`duplicate_penalty`** | **no** | — |

Dos consecuencias concretas, no generales:

1. **`balance_vars` sin control es el defecto de arriba, visto desde la
   pantalla.** `program` con 1 049 niveles colgaba el sorteo y el usuario no
   tiene forma de sacarlo del balanceo: hubo que hacerlo por API. La cota del
   commit `a288a0d5` evita el cuelgue, pero elegir qué se balancea sigue sin
   superficie.
2. **`seed` sin control es lo que impide la rerandomización.** Correr N sorteos
   con semillas declaradas y elegir por criterio previo necesita fijar la
   semilla desde la UI; hoy sólo la escribe el motor. Es la pieza que falta para
   B1, y la única brecha con consecuencia metodológica del audit de cobertura.

El agregador de aulas que Gonzalo nombra vive en
`aulas/CertificacionFacultadCard.tsx:252-261` como un stepper −1/+1, y la
tarjeta entera devuelve `null` sin certificación corrida (línea 130), así que
sin certificar no existe en pantalla.

### Corrección: la semilla SÍ tiene control, y la penalización también

La tabla anterior está mal en dos filas, y el error de método es el mismo de
siempre: **se grepearon los nombres del backend y se concluyó sobre el frontend,
que usa los suyos en español.**

`AulasObjetivoTab.tsx:321-345`, dentro del PanelAvanzado «Auditoría y
reproducibilidad», tiene los dos controles que declaré ausentes:

```tsx
<span>Semilla</span>
<NumberCell value={config.semilla} min={1} step={1}
            onChange={(v) => updateConfig({ semilla: Math.round(v) })} />
…
<span>Evitar repetidos</span>
<NumberCell value={config.penalizacion_repetidos} min={0} step={0.05}
            onChange={(v) => updateConfig({ penalizacion_repetidos: v })} />
```

`semilla` es `seed` y `penalizacion_repetidos` es `duplicate_penalty`.

**Lo editable de verdad**, listado desde los `updateConfig` de los componentes:
`semilla`, `penalizacion_repetidos`, `candidate_pool_size`, `simulation_runs`,
`monte_carlo_n`, `docente_unico`, `selector_engine`, `sequential_discount`,
`grupos_tamano`, `usar_grupos_tamano`, `min_elegibles_aula`, `bolsas_reemplazo`,
`techo_aulas_visitadas`, `aulas_extra_operativas_default`, `criterios_seleccion`,
`modalidad`, `alumnos_por_ch_decision` y `particularidades_decisiones`.

**Lo que sigue sin control, verificado con los dos vocabularios:**
`balance_vars`, `spread_vars`, `coverage_weight` y `pps_weight`. Se leen desde
`config.*` pero no aparecen en ningún `updateConfig`; el único que coincide por
nombre es `spreadsheet_id`, que es de Sheets.

Cuatro, no seis. Y la consecuencia cambia:

- **La afirmación «sin `seed` no hay rerandomización» era falsa.** La semilla se
  fija desde la pantalla. Lo que falta para la rerandomización es el **bucle**
  sobre N semillas y el **criterio de aceptación declarado**, no el control.
- **`balance_vars` sin control se sostiene, y es la que importa**: es la que
  metió `program` con 1 049 niveles y colgó el sorteo. La cota del commit
  `a288a0d5` evita el cuelgue; elegir qué se balancea sigue sin superficie.

## Cada reparación tiene dos lados (2026-08-27)

Gonzalo, textual: *«cada uno de ellos no sólo es una comprobación e
implementación en el backend, también lo es en el frontend»*. Aplicado a las dos
reparaciones ya commiteadas, las dos quedan a medias.

### D2 · la certeza muestra la respuesta, no la evidencia

`CertezaCoberturaPanel` está bien hecho: publica `disponibles`,
`probabilidad_formula`, `aulas_certeza` y el rendimiento, y marca como **cota
superior** el caso `base_conteo == "suma_elegibles"`, que es justo la
degradación honesta del motor.

Lo que **no** muestra es la **curva**: los puntos candidato a candidato. Y la
curva era todo el hallazgo. Con el defecto activo, la certificación devolvía
392,7 con 40 aulas y 394,6 con 55, y **nada en pantalla lo habría delatado**,
porque el panel enseña una sola cifra final. El defecto se cazó leyendo la curva
cruda del API.

Falta, entonces: la curva en pantalla, y un aviso cuando sea plana. Una curva de
cobertura que no crece con el candidato es imposible, así que es un invariante
que la propia UI puede vigilar.

### D6 · el motor declara las variables descartadas y nadie las pinta

La cota del commit `a288a0d5` descarta variables de balance por cardinalidad y
las declara, reusando `balance_vars_descartadas` y
`.cm_aulas_balance_descartadas_warning`. Ese aviso viaja en el campo `warnings`
del resultado de la selección.

- R lo produce en cinco sitios (`calc_muestra_aulas.R:1552, 3307, 3926, 4739, 5032`)
- El front lo **tipa**: `frontend/src/api/calcMuestra.ts:195, 209, 1440, 2393, 2455`
- **Ningún `.tsx` de producción lo renderiza.** Las únicas coincidencias en el
  feature son archivos de test.

Es el patrón de descartar en silencio, y ahora lo agrava mi propia reparación:
sobre el marco de HSVG2026 la cota descarta `program` en los 18 estratos que
pasaban de 20 columnas, y el usuario no se entera. La cota evita el cuelgue a
cambio de cambiarle el diseño sin decírselo.

**Regla que queda para el resto del tablero**: un ítem no se cierra con el
motor reparado. Se cierra cuando el usuario puede ver el efecto o tomar la
decisión desde la pantalla.

### D6-front, localizado: el aviso llega y se filtra por accidente

Rastreado el camino entero. El aviso **sí** sale del motor y **sí** llega tipado
al frontend, pero muere en un filtro:

1. R lo emite en `.cm_aulas_balance_descartadas_warning` y viaja en el campo
   **`methodological_warning`** de la selección, no en `warnings`. Verificado
   sobre el estado real: la lista trae los mensajes de balance.
2. El front lo tipa: `api/calcMuestra.ts:2344`.
3. `aulas/relato/relatoModel.ts:918` lo lee y arma `advertencias`… y acto
   seguido se queda solo con las que casan `/tama|size/`, bajo el nombre
   `ajustesTamano`. **`advertencias` no se devuelve**: el modelo retorna
   `ajustesTamano` y el resto de la lista se descarta.

El aviso de balance sobrevive **por accidente**, porque su texto contiene
`size_group`, y entonces se muestra bajo la etiqueta equivocada: aparece como
un ajuste de tamaño cuando es un descarte de variables de equilibrio.

Lo que falta en el front, entonces, no es «pintar los warnings» sino dejar de
filtrarlos por una expresión regular sobre el texto. Un aviso que el motor
declara y que la UI clasifica adivinando por su redacción se pierde en cuanto
alguien cambia una palabra del mensaje.

**Corrección de método, tercera vez hoy.** Dije que ningún `.tsx` pintaba los
avisos porque busqué `warnings`, y el campo se llama `methodological_warning`.
Antes había dicho que `seed` no tenía control porque la UI lo llama `semilla`.
El patrón es siempre el mismo: **auditar el frontend con el vocabulario del
backend**. La regla que queda: buscar el dato por su valor o por su ruta en el
payload real, no por el nombre que uno espera.

### D6-front cerrado, y la premisa era falsa otra vez

`EscenaCierre.tsx:25-27` **ya publica la lista entera** de
`methodological_warning`. Los avisos del motor se ven; lo que estaba roto era
sólo el etiquetado.

El relato separa los «ajustes de tamaño» del resto filtrando `/tama|size/` sobre
el texto completo. El aviso del saneo del balance nombra las variables
descartadas, y entre ellas suele estar `size_group`, así que entraba en esa
lista y se mostraba bajo «Ajustes de tamaño divulgados por la corrida» siendo un
descarte de variables de equilibrio. Reparado en `569905b9` reconociendo la
familia por su **prefijo**, que es lo que el motor declara.

Se evaluó añadir una segunda lista en la escena del sorteo y **se descartó por
duplicar** lo que E6 ya muestra.

**Cuarta premisa falsa de la sesión.** Las cuatro son la misma: afirmar que al
frontend le falta algo sin haber mirado el frontend con su propio vocabulario ni
seguido el dato hasta su render. `seed` existía como `semilla`; el aviso existía
como `methodological_warning`; y la lista existía, en otra escena. Lo único real
de las cuatro era el etiquetado, y se encontró al ir a construir lo que ya
estaba.

## Verificado: de dónde sale el 174, contra los dos componentes (2026-08-27)

Otra sesión reportó que el estudio tiene dos componentes y que el 174 es el
número del de **facultad**, con coincidencia 15 de 15. Medido sobre
`HSVG26ULT.pulso`, comparando `resultado$aulas_por_estrato[].aulas_base` de cada
componente contra los titulares sorteados, **no reproduce**:

| | suma | coincide con el sorteo |
|---|---|---|
| `cmp-cine0qk8` · universidad · conglomerado multietápico | **165** | 9 de 15 |
| `cmp-cine0qk8-fac` · facultad · estratificado independiente | **294** | **0 de 15** |
| sorteo real | **174** | |

Y esto lo cierra: **`max(comp1, certificado)` reproduce el sorteo en 14 de 15
facultades exactas.** La única excepción es Derecho, `max(16, 18) = 18` contra
19 sorteadas, que es el aula añadida a mano porque a 18 la certificación daba
0,9512. Las seis facultades donde comp1 y el sorteo difieren son exactamente las
seis que la certificación subió.

**El documento metodológico queda confirmado**, secciones 5.2 y 5.3 incluidas.

**Lo que sí cambia**, y es un hallazgo para la otra sesión: el 174 **no** es el
número del componente de facultad. Es el 165 del componente de universidad
subido facultad por facultad por la certificación. Por tanto el
`aulas_config.n_aulas = 165` del workspace no es «el escenario equivocado», es
el objetivo **pre-certificación del escenario correcto**. El hueco no se cierra
declarando el escenario: hay que leer el objetivo vigente de los estratos
(`aulas_base_fijas` cuando existe), que es lo que el sorteo obedece.

**Sobre la advertencia de que la certeza está corrida sobre el componente de
universidad**: es cierto y no es un riesgo, porque ése es el componente que
gobierna el sorteo de aulas.

### Corrección: el 294 salía de un `state.rds` de seis horas antes

La sección anterior afirmó que el componente de facultad suma 294 y no coincide
con el sorteo. **Es falso, y la causa es de método.**

El `state.rds` con el que se midió estaba extraído el 26 de agosto a las **03:10**;
el del `.pulso` actual es de las **09:33**. Se extrajo una vez y se reusó durante
horas mientras el proyecto se volvía a guardar.

Extraído del archivo actual:

| | viejo 03:10 | actual 09:33 |
|---|---|---|
| comp1 `aulas_base` | 165 | **165** |
| comp2 `aulas_base` | 294 | **174** |
| `frame_hash` | 87df265f… | idéntico |
| aulas `included` | 1 512 | idéntico |

**Sólo comp2 cambió.** El componente de facultad del archivo actual **es la
afijación posterior a la certificación ya persistida**, con sus 174 y con el aula
extra de Derecho incluida.

**Alcance del error, acotado campo por campo**: no toca el documento
metodológico ni las reparaciones de este loop, porque todo eso cuelga del marco y
de comp1. Verificado entre las dos versiones: los 15 P25 idénticos a 0,0000, los
15 τ idénticos a 0,000000, `eligible_n` de las 5 269 filas idéntico, y
`tasas_efectividad_facultad` idéntica objeto por objeto.

**La regla que queda**: un `state.rds` extraído es una foto y el `.pulso` sigue
vivo. Comparar el timestamp del extraído contra el del `.pulso` antes de medir.
En la misma carpeta existe además un `HSVG26ULT` **sin extensión** de las 03:10
que no es un zip válido; el archivo bueno es `HSVG26ULT.pulso`, 12 158 921 bytes,
sha256 `73963fc8…`.

## D8 medido: los dos configs difieren justo en `faculty_targets` (2026-08-27)

`/aulas/certeza` lee `s$calc_muestra_aulas_config %||% frame$config`
(`router_calc_muestra.R` ~1052) y `/aulas/seleccionar` lo lee al revés (~1106).
Comparados los dos configs del proyecto real, clave a clave: **715 comparadas,
24 difieren**, y la divergencia es exactamente la que más pesa.

| clave | config de sesión | config del marco |
|---|---|---|
| `selector.faculty_targets` | **15 facultades** (Derecho 19, Arte y Diseño 15, …) | **ausente** |
| `alumnos_por_ch_decision.*` | poblado | vacío |

Cada ruta recibe justo el que no le sirve:

- **certeza** toma el de sesión y hereda unos `faculty_targets` que debe ignorar,
  porque el candidato es lo que está midiendo. Es la causa de D2, reparada en el
  motor con `8ed2f0a3`.
- **seleccionar** toma el del marco y **no** ve unos targets que sí debe
  respetar. De ahí que `afijacionTargets.ts` los inyecte en el body de cada
  petición: es un rodeo del front a una precedencia invertida en el backend.

La precedencia está al revés en las dos rutas, y ninguna lo declara.

**Reparación propuesta, que no inventa contrato**: que las dos lean lo mismo,
fusionado con `calc_muestra_aulas_config_fusionar(frame$config, s$config)`. Ese
archivo ya declara el contrato —«lo ausente hereda de la vigente; un `null`
explícito borra»— y está probado. Hoy resuelve sólo el POST parcial de
`/marco/config`; aplicarlo a las lecturas cierra la divergencia sin decidir un
ganador arbitrario.

### De paso, D4 queda más suave de lo que se dijo

El config de sesión trae `alumnos_por_ch_decision.estadistico = **p25**`, con su
`frame_hash` y su `confirmado_at`. O sea que **la app sí registra que el
estadístico es el primer cuartil**, y es una decisión confirmada por el usuario,
no un accidente. Lo que engaña es sólo el nombre del campo donde se guarda el
valor, `promedio_conglomerado`. Eso baja D4 de «el valor no es lo que dice» a «el
campo se llama mal», que es otra reparación y bastante menor.

## Verificación en pantalla de lo construido en el loop (2026-08-27)

Siete ítems se habían cerrado tocando UI sin abrir la app ni una vez. Hecho con
`/ver-ui` sobre una copia de `HSVG26ULT.pulso`, Vite en 5201 contra el backend
propio de :8791, navegando con `window.__pulsoNav.ir(...)`.

### Cálculo · Cursos-horario requeridos — el panel «¿Alcanza?»

| qué | resultado |
|---|---|
| columna de curva | **15 de 15** filas |
| curvas planas | 0, correcto: la certificación guardada es la buena |
| celda de corridas | 15 de 15 |
| marcadas «en el ruido» | **DERECHO y ESTUDIOS GENERALES CIENCIAS** |
| botones «Llevar a N» | **6**, las seis facultades con brecha positiva |

La fila de Derecho se lee: `363 · 293 · 16 · 0% · 18 · 205 sorteos · en el ruido
· +2 · Llevar a 18 · 340.1 P05 326.3 · Faltan aulas`, con el title completo:
«el margen sobre el nivel exigido (0.12 puntos) es menor que el error de
muestreo (±1.50). Con esta evidencia no se distingue si cumple».

### Aulas · Método — el control de variables de balance

Las seis variables con sus niveles reales: `faculty` 15, `sex_top_1` 2,
`size_group` 4, **`program` 1 049**, `level` 11 y **`schedule` 381**. Las dos de
cardinalidad alta salen marcadas «se descartará en los estratos grandes».

**El toggle funciona de punta a punta**: destildar `program` lo pasó a
desmarcado, las marcadas bajaron de 5 a 4 y el proyecto quedó «sin guardar», o
sea que el cambio llegó al workspace.

### Aulas · Relato — pendiente

No se pudo verificar: destildar `program` invalidó los artefactos de selección
—que es el comportamiento correcto y prueba que el control se engancha a la
cadena de invalidación—, y sin selección el relato no tiene qué narrar. El
`.pulso` sí trae los cuatro avisos de balance en `methodological_warning`, así
que el dato está; falta ver su etiquetado con una selección vigente.

**Trampa en la que se cayó de paso**: un `fetch("/api/...")` escrito a mano
dentro de la página no lleva la cabecera de sesión y devolvió `selection: null`
sobre un proyecto que sí la tiene. Es la misma trampa del `curl` sin sesión, en
el navegador. Para leer estado desde la página hay que usar el cliente de la
app, no un `fetch` crudo.

### El relato está inalcanzable, y por la misma familia del `n_aulas`

Abierta una copia limpia de `HSVG26ULT.pulso` —con su selección intacta— la
pestaña Aulas · Relato **no muestra el relato**. En su lugar:

> «La evidencia almacenada no acredita la comparación vigente. Existe una corrida
> previa, pero difiere de la firma vigente en: `monte_carlo_n` (corrida 20 ·
> vigente 500); **`n_aulas` (corrida 30 · vigente 165)**; `simulation_runs`
> (corrida 20 · vigente 500). Vuelve a comparar sin publicar esa evidencia como
> actual.»

O sea que la superficie está guardada tras un chequeo de frescura que compara la
firma de la corrida contra el config vigente, y falla en tres claves. Es la
misma familia que la otra sesión persigue en `classroomHandoff.ts`: **el
workspace guarda un `n_aulas` que no es el de la corrida**, y de ahí se apagan
superficies enteras sobre artefactos correctos.

Consecuencia para la verificación: el etiquetado del aviso de balance
(`569905b9`) **no se pudo comprobar en pantalla sobre este proyecto**. Queda
cubierto por su vitest, que fija el comportamiento con fixture —el aviso con
`size_group` ya no entra en `ajustesTamano` y E6 sigue publicando la lista
entera—, pero no por observación. Se declara como tal.

Y hay un dato nuevo para esa reparación: el desajuste **no es sólo de `n_aulas`**.
`monte_carlo_n` y `simulation_runs` también difieren (20 en la corrida contra 500
vigentes), así que arreglar sólo el objetivo dejaría la superficie apagada igual.

## Inventario de la firma que apaga superficies (2026-08-27)

El chequeo que deja el Relato inalcanzable no compara campo a campo escrito a
mano: compara un **snapshot** completo,
`classroomComparisonSelectorSnapshot(config)` en
`frontend/src/features/calcMuestra/universidad/aulas/classroomHandoff.ts`, contra
el `selector` que la corrida guardó. **Cualquier clave que entre en ese snapshot
bloquea.** Hoy entran unas veinte.

Su propio comentario registra que ésta es «la quinta mordida de la familia de
copias».

### De dónde sale el `n_aulas = 30`

```ts
n_aulas: Math.max(1, Math.round(safeNumber(config.n_aulas, 30))),
```

**30 es el default de esa línea.** El «corrida 30» del aviso no fue una decisión
de nadie: es lo que el snapshot escribe cuando `config.n_aulas` no está. El
chequeo de frescura compara, entonces, contra un valor que nunca se eligió.

### Las claves no prueban lo mismo, y por eso no deberían bloquear igual

| grupo | claves | ¿debe bloquear? |
|---|---|---|
| **Identidad** | `schema` | sí |
| **Parámetros que cambian el sorteo** | `seed`, `n_aulas`, `strata_cols`, `balance_vars`, `spread_vars`, `mos_strategy`, `coordination_mode`, `duplicate_penalty`, `sequential_discount`, `replacement_*` | sí: con otro valor, la muestra sería otra |
| **Parámetros que sólo cambian el diagnóstico** | `simulation_runs`, `candidate_pool_size`, `monte_carlo_n` | **no**: la muestra guardada sigue siendo la correcta; sólo cambia cuánta simulación la acompaña |

Ese tercer grupo es el que sobra. Que `simulation_runs` pase de 20 a 500 no
vuelve incorrecta la comparación guardada, y sin embargo la apaga.

Dos observaciones más del inventario:

- **`frame_hash` y `run_id` NO están en el snapshot.** Lo único que prueba
  identidad ahí es `schema`. Se bloquea por parámetros y no se comprueba la
  procedencia, que es al revés de lo que uno esperaría.
- **`pps_weight` y `coverage_weight` están en la firma y no tienen control en la
  UI** (es la brecha F3). No pueden divergir por acción del usuario: sólo si
  cambia un default del código. Están bloqueando algo que nadie puede provocar.

`candidate_pool_size` además sólo tiene efecto con el motor `pool_controlado`;
con `cube_balanceado` bloquea por un parámetro que el sorteo ni mira.

## F3 medido: qué hacen de verdad `pps_weight` y `coverage_weight` (2026-08-27)

Antes de darles control había que saber si el motor vigente los respeta. Los usa
en **dos sitios distintos**, y sólo uno decide la muestra:

| función | qué hace | ¿corre con `cube_balanceado`? |
|---|---|---|
| `.cm_aulas_candidate_score` (`calc_muestra_aulas.R:2200`) | puntúa candidatas y **decide cuáles entran** | **no**: sólo la llama `.cm_aulas_select_once_pool`, que corre con `pool_controlado` |
| `.cm_aulas_annotate_selection_metrics` (`:2103`) | calcula una columna `score` por aula, **después** del sorteo | sí, para todos los motores |

**Con el motor de este estudio, esos pesos no cambian qué aulas salen.** Sólo
alimentan una métrica anotada que se reporta por aula.

Tres consecuencias:

1. **Un control sin más sería un rótulo que promete otro número.** Puesto junto a
   las decisiones de método, parecería que mueve el sorteo, y con
   `cube_balanceado` no lo mueve. Si se construye, tiene que decir bajo qué motor
   surte efecto, o aparecer sólo con `pool_controlado`.
2. **Su presencia en la firma que bloquea es incorrecta** para este motor. No
   pueden cambiar la muestra, así que no deberían invalidar una corrida
   guardada. Se suman a `simulation_runs`, `candidate_pool_size` y
   `monte_carlo_n` en el grupo que sobra.
3. Es una **decisión de producto**, no un defecto: construir el control con su
   etiqueta correcta, o dejarlos como parámetro de motor y sacarlos de la firma.
   Queda para Gonzalo.

### Corrección al inventario, y el ADR que ya cubre la familia

Dos precisiones sobre lo anterior.

**«Bloquea por parámetros y no comprueba procedencia» es demasiado amplio.** Es
cierto de `classroomComparisonMatchesConfig()` **por sí sola**, pero no del
sistema: sus llamadores en `resolveClassroomArtifactStatus` añaden
`matchesFrame(...)` con el `frame_hash`, y `selectionReady` exige además
`selection_run_id`. Por la vía del handoff **sí** se comprueba identidad. Lo que
falta es donde esa función se use suelta.

**La familia entera ya tiene ADR, y está sin implementar.** `docs/adrs/0080-el-
workspace-se-resella-entero-no-campo-a-campo.md`, estado **Propuesto** desde el
18 de agosto, con la decisión esperando a Gonzalo. Sus cinco mordidas medidas
incluyen literalmente las dos que aparecieron aquí: `n_aulas` desfasado entre
workspace y corrida, y `simulation_runs`/`monte_carlo_n` en 500 contra 0. **Lo
de este loop es la sexta mordida de la misma familia.**

Y el ADR ya evaluó y descartó tratar la divergencia campo a campo: lo llama «el
statu quo, cinco mordidas en dos meses». Su decisión propuesta es no producir la
divergencia, resellando el workspace entero al aceptar una corrida.

**Consecuencia para este loop**: reclasificar las 22 claves en bloqueantes y no
bloqueantes **no se hace ahora**. Encendería el Relato, pero afinaría el detector
de un problema cuya dirección ya está decidida y dejaría viva la familia. El
inventario queda como insumo de la implementación del 0080, que es justo la
lista que esa implementación necesita.

Lo que **sí** se toma, porque no es arquitectura: el default `30`.

## Cuatro de las seis pestañas de Aulas están apagadas sobre una selección válida

Medido en pantalla sobre `HSVG26ULT.pulso`, que tiene su selección de 174 aulas
completa y verificada:

| pestaña | estado |
|---|---|
| Selección | **bloqueada** |
| Reemplazos | **bloqueada** |
| Auditoría | **bloqueada** |
| Relato | **bloqueada** |
| Solidez | pasa |
| Perfil | pasa |

El motivo es una sola línea de `aulas/aulasSurfaceState.tsx:117`:

```ts
if (!model.comparisonReady) { …aviso «falta comparar»… }
```

Está **antes** que todo lo demás y se aplica a cada etapa salvo `objetivo`. O
sea que **la comparación de métodos gobierna superficies que no narran la
comparación, sino la selección**.

### Por qué la comparación está vieja

Las claves desfasadas entre la corrida guardada y el config vigente:

| clave | en la corrida | en el config | ¿cambia la muestra? |
|---|---|---|---|
| `seed` | 20260619 | **202** | sí |
| `n_aulas` | 30 | **174** | sí |
| `monte_carlo_n` | 20 | 500 | **no** |
| `simulation_runs` | 20 | 500 | **no** |

La comparación es genuinamente vieja: se corrió con la semilla por defecto y con
el `n_aulas` fabricado. Pero **dos de las cuatro claves que la invalidan no
cambian qué aulas salen**, y ninguna de las cuatro dice nada sobre si la
selección guardada es correcta.

### Lo que esto significa para el usuario

Un analista que abre su proyecto terminado no puede ver **su propia selección**,
ni los reemplazos, ni la auditoría, ni el relato. Ve cuatro veces «vuelve a
comparar métodos». Y re-comparar no arregla el desfase, porque el campo
desactualizado vive en el workspace: es exactamente el callejón que el ADR 0080
documenta como su mordida 1.

**Es una decisión de contrato, no un bug de una línea**: ¿debe la comparación
ser prerrequisito de ver la selección? Se puede argumentar que sí para
*ejecutar* un sorteo nuevo, pero no para *leer* uno hecho. Queda para Gonzalo, y
es más urgente que el resto del tablero porque afecta el uso normal de un
proyecto terminado.

## B3 no es una brecha: el contacto ya está en el libro (2026-08-27)

La hoja `Selección` del libro exportado lleva `teacher`, `teacher_email` y
`teacher_type`, **poblados en las 1 512 filas** —los 174 titulares, las 1 259 de
cadena y las 79 del banco de extras—. El dato de contacto está entero en el
entregable.

Lo que se armó aparte para OIGD fue una **vista reordenada**: un docente por
fila, sin repetir, con los cursos que dicta. Eso es presentación, no dato que
falte. Si conviene que la app la produzca es una decisión de producto, no un
defecto que reparar.

**Con esto el tablero queda sin nada construible sin decisión de Gonzalo.** De
los tres ítems que el audit listaba como «hechos fuera», dos resultaron existir
—el libro de las tres dimensiones y esta base de contactos— y el tercero, la
matriz por facultad con sexo, se cerró exportando lo que ya se calculaba
(`e3330224`).

Vale la pena anotar el patrón, porque se repitió cinco veces en este loop: **de
lo que el audit dio por faltante, la mayoría existía.** El audit se hizo leyendo
código y buscando por el vocabulario equivocado; cada vez que se fue a construir
y primero se verificó, apareció la capacidad ya hecha. La regla que queda es la
que ya estaba escrita en el repo y no se aplicó al hacer el audit: verificar
dónde vive algo antes de declarar que no existe.

### La hoja de sexo, verificada con datos reales

Generado el libro completo desde el estado del proyecto: 26 hojas, con «Sexo por
facultad» en sexto lugar, tras las de selección y antes de la auditoría.

Las 15 facultades salen con `estado = medido`, las ocho columnas numéricas son
numéricas, y **la brecha publicada coincide con la resta de las dos proporciones
en 15 de 15**. Lo que la hoja hace visible:

| facultad | marco | seleccionado | brecha |
|---|---|---|---|
| CIENCIAS CONTABLES | 51,9 % | 40,0 % | **−11,9 pp** |
| ARTES ESCÉNICAS | 61,5 % | 53,7 % | −7,7 pp |
| CIENCIAS E INGENIERIA | 25,0 % | 27,7 % | +2,7 pp |

Es exactamente lo que el agregado global esconde: el eje sexo cuadra en el total
y Ciencias Contables ofrece doce puntos menos de mujeres que su propio marco.

**Aviso de método**: al leer la salida por primera vez pareció que la brecha no
cuadraba —Artes Escénicas con marco 0,6147 y titulares 0,4000 contra una brecha
de −11,9—. Era una lectura mal alineada: la tabla impresa se partió y se
emparejó el marco de una facultad con los titulares de la siguiente. Medido
columna contra columna, las quince cuadran. Antes de reportar un número que no
cuadra, comprobar que se están leyendo las dos celdas de la misma fila.

**Queda una opción de legibilidad, no un defecto**: las proporciones van en
crudo (0,6147) y la brecha en puntos porcentuales. Es consistente con el nombre
de cada columna, pero obliga a convertir mentalmente para cotejarlas. Si conviene
publicarlas como porcentaje es decisión de Gonzalo.

## El 174 es el criterio de universidad más certeza, alojado en el componente apagado

Medido el 2026-08-27 sobre el estado vivo (`/api/calc-muestra/state`), a raíz de
que el KPI «Aulas que pide el cálculo» seguía diciendo 165.

**Lo que dice cada superficie, y son tres respuestas distintas:**

| superficie | dice | de dónde sale |
|---|---|---|
| KPI de la tira (`ResumenDiseno.tsx:174`) | 165 | componente del escenario activo |
| `aulas_config.n_aulas` | 165 | `materializeUniversityAulasTarget`, mismo escenario |
| sorteo sellado 2026-08-26 14:28:33Z | **174** | componente `estudiantes_facultad` |

**El escenario nunca se eligió.** `motor_recorrido.decisiones` está literalmente
vacío (`clavesDecisiones: []`, `tocado: false`, `actualizado_at: ""`), y
`universityAulasScenario()` (`shared/study.ts:227`) cae por defecto en `e1`
→ componente Universidad → 165. R **no** es el culpable: el normalizador
`.cm_normalize_workspace_motor_recorrido` (`calc_muestra_engine.R:346`) pasa
`decisiones` entero sin filtrar. El campo nunca se escribió.

**El sorteo siguió al componente Facultades exacto**, facultad por facultad, en
las 15: `coincideConFac: true`, `discrepanciasVsFac: []`, `coincideConUni: false`.

**Pero el 174 no es el número del criterio de facultad.** El bloque
`certificacion_facultad` de la corrida lo delata:

- se computa contra las cuotas de **Universidad** (125, 119, 64, 20, 528, 149,
  84, 363, 24, 403, 397, 21, 105, 23, 75) — idénticas a la columna `cuota` del
  componente `estudiantes_universidad`, no a las del de facultad (336, 372,
  193, 48, 665, …);
- certifica los **174** titulares sorteados y las 15 salen `certificada`,
  `ok: true`, con márgenes 1,11–2,06;
- el criterio de facultad, por su cuenta, pide **294** aulas (declara 174).

Es decir: **el 174 = fórmula de universidad (165) + certeza**, guardado en el
componente que la app tiene por inactivo.

**Las +9 aulas, por facultad** (Universidad → Facultades):

| facultad | uni | fac | dif |
|---|---|---|---|
| CIENCIAS CONTABLES | 2 | 3 | +1 |
| DERECHO | 16 | 19 | +3 |
| ESTUDIOS GENERALES LETRAS | 18 | 20 | +2 |
| GESTIÓN Y ALTA DIRECCIÓN | 6 | 7 | +1 |
| LETRAS Y CIENCIAS HUMANAS | 3 | 4 | +1 |
| PSICOLOGÍA | 5 | 6 | +1 |

Las otras nueve facultades son idénticas en ambos componentes, igual que
`avg_conglomerado`, `tau`, `estadistico_usado` y el bloque `margen` entero
(`aulas_requeridas` 8, 15, 8… = la columna de **universidad**): la maquinaria de
cobertura se computó una vez y se pegó en los dos componentes.

**Lo que NO se puede afirmar todavía.** Este estado lo computó el paquete
instalado ANTES de los cambios de motor de esta sesión: `aulas_formula`,
`aulas_base_origen` y `aulas_base_nota` vienen vacíos (`origenes: []`), y
`estratos` está en cero en ambos componentes (`nEstratosDecl: 0`), o sea **no
hay ninguna `aulas_base_fijas` guardada**. Por eso el motor no dice hoy *por
qué* cada facultad recibió más, y la atribución fórmula/certeza/operativa por
facultad no está medida — es exactamente lo que `.CM_AULAS_BASE_ORIGENES`
publica y falta recomputar con el paquete nuevo.

Las `aulas_extra_operativas` sí son un dato aparte y ya existen:
`aulas_extra_operativas_default: 1`, **+1 por facultad, 15 en total** e
idénticas en ambos componentes (165 → 180 titulares+extras; 174 → 189).
No son las +9.

**Qué hay que reparar, en orden:**

1. El escenario en vigor tiene que **declararse y ser uno solo**: hoy el sorteo
   lee un componente y el KPI otro, y nada avisa de la discrepancia. Cuando el
   sorteo ya está sellado, el escenario debe inferirse de la corrida ejecutada
   en vez de caer en `e1` por defecto.
2. El criterio de universidad debe cargar **él mismo** el 165 + certeza = 174,
   en vez de que ese número viva en el componente de facultad.
3. El KPI debe mostrar 174 **descompuesto por origen** (fórmula / certeza /
   operativa), que es lo que pidió Gonzalo. No inventar el desglose: recomputar
   con el motor nuevo para que `aulas_base_origen` lo diga.
