
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
