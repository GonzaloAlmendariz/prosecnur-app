# Plan de ticks — de la selección de aulas al control de campo

Doc vivo. Abierto el 2026-08-22 por encargo de Gonzalo. Sólo él lo da por
terminado. Cadencia: **5 minutos entre tick y tick**.

## El encargo, textual

> «Creo que necesitas crear un plan de ticks para mejorar toda la UI, su sustento
> técnico, probar sorteos con 190, 195 y 200 aulas. Así como 190, 192 con ajustes
> específicos. Aliando la calidad del sorteo y garantizando que tengamos éxito en
> la aplicación y no vayamos a los reemplazos lo menos posible. Además debe
> seguir sin detenerse evaluando siempre nuevos puntos de mejora sin asumir que
> ya se cerró. Puedes revisar que las aulas seleccionadas se exporten bien al
> monitoreo y a las fichas QR, que el monitoreo permita un buen control y lectura
> del sheets de monitoreo y una buena inscripción y generación del sheets. Un
> correcto mapeo del desarrollo del campo, con información útil a día de hoy pero
> puede ser muchísimo mejor con mayor detalle aún. Debemos seguir perfeccionando
> todo. El loop puede ser de 5 minutos entre tick y tick y siempre crea algo
> nuevo.»

## La vara

1. **La selección llega entera hasta el campo.** Lo que se sortea se exporta al
   monitoreo y a las fichas QR sin pérdida ni renombre.
2. **Ir a reemplazos lo menos posible.** Cada configuración se juzga por cuántas
   aulas titulares se espera que caigan, no por su puntaje.
3. **El monitoreo se lee y se controla.** El sheets se genera, se inscribe y se
   lee sin que nadie tenga que interpretarlo.
4. **Nunca se asume cerrado.** Cada tick busca algo nuevo aunque el tablero esté
   verde.

## Las cinco series

### Serie A — Calidad del sorteo, medida en el marco real

| # | Tick | Qué mide | Cerrado |
|---|---|---|---|
| A1 | Línea base con **190** aulas | ☑ ver abajo |  |
| A2 | Sortear con **195** proporcional | ☑ ver abajo |  |
| A3 | Sortear con **200** proporcional | ☑ ver abajo |  |
| A4 | **190 con reparto dirigido** | ☑ **el mejor resultado de la serie** |  |
| A5 | **192 y 193 dirigidos** | ☑ 193 cierra déficit y colchón |  |
| A6 | Tabla comparada de las seis corridas | ☑ **recomendación: 193 dirigido** |  |
| A7 | Efectividad esperada por configuración | entrevistas logradas / aulas visitadas | ☐ |

**Criterio de A6, que es el que decide**: no gana el score más alto, gana la
configuración con menos aulas titulares que se espera que caigan — porque cada
caída es una visita perdida y un reemplazo que hay que coordinar.

### Serie B — La selección llega al campo

| # | Tick | Qué verifica | Cerrado |
|---|---|---|---|
| B1 | Export de aulas → Monitoreo | ☑ identificadores completos y únicos |  |
| B2 | Export → fichas QR | ☑ **la cadena está sana; el plan guardado NO** |  |
| B3 | Ida y vuelta | ☑ el desfase se detecta y se avisa |  |
| B4 | Reemplazos en el export | ☑ el código sí; el plan guardado no |  |

### Serie C — El sheets de monitoreo

| # | Tick | Qué verifica | Cerrado |
|---|---|---|---|
| C1 | Generación del libro | ☑ **la cadena está cortada** |  |
| C2 | Inscripción | alta de encuestadores/aulas sin edición manual | ☐ |
| C3 | Lectura | qué entiende el motor de lo que el campo escribe | ☐ |
| C4 | Vuelta al monitoreo | el sheets leído se ve como avance real | ☐ |

### Serie D — Mapeo del desarrollo del campo

| # | Tick | Qué añade | Cerrado |
|---|---|---|---|
| D1 | Inventario de lo que hoy se ve | qué preguntas responde el monitoreo y cuáles no | ☐ |
| D2 | Avance por facultad contra la cuota | no sólo total | ☐ |
| D3 | Aulas caídas y su reemplazo efectivo | la cadena, no el conteo | ☐ |
| D4 | Ritmo y proyección | ¿llegamos con las visitas que quedan? | ☐ |

### Serie E — UI con sustento técnico (transversal, siempre abierta)

Cada tick de las series A–D deja al menos un hallazgo de UI. Aquí se anotan y se
cierran. **No se asume cerrado ningún módulo**: el loop anterior encontró ocho
casos de la misma familia después de dar el tablero por completo.

## Estado

Ninguna serie empezada. El loop anterior (Método y Simulación) queda cerrado en
`docs/qa/goal-metodo-simulacion-2026-08-22.md` con su tablero M1–M9 completo, 34
commits y 1.772 tests del área.

## Cómo se mide cada corrida de la serie A

Sobre `HSVG2026_definitivo.pulso`, con el motor cargado desde el fuente:

- titulares, reservas encadenadas y ratio por celda
- celdas sin reserva del mismo perfil
- score de representatividad y sus siete balances
- efectividad esperada (elegibles netos × tasa por facultad)
- **aulas titulares esperadas que caen**, que es la vara 2


---

## A1 · Línea base con 190 aulas

Medido sobre la selección vigente de `HSVG2026_definitivo` (no hizo falta
re-sortear: ya son 190).

| | |
|---|---|
| Titulares | 190 |
| Elegibles netos | 6.440 |
| Tasa media ponderada | 0,513 |
| **Entrevistas esperadas** | **3.302** |
| Objetivo | 2.500 |
| Margen global | **+802** |

### La métrica que decide la serie: colchón de caídas

**Cuántas aulas titulares pueden caer antes de que haga falta un reemplazo.** Se
calcula en el peor caso —que caigan las que más rinden— porque es el único que
garantiza.

- Global: **34 aulas** (17,9 % de las titulares). En el mejor caso, 64.

Pero el margen global esconde el reparto, así que **por facultad**:

| Facultad | aulas | espera | cuota | colchón |
|---|---|---|---|---|
| ESTUDIOS GENERALES CIENCIAS | 30 | 603 | 393 | 8 |
| CIENCIAS E INGENIERIA | 40 | 709 | 528 | 8 |
| ESTUDIOS GENERALES LETRAS | 26 | 517 | 389 | 5 |
| ARTE Y DISEÑO | 14 | 179 | 120 | 3 |
| ARQUITECTURA Y URBANISMO | 11 | 183 | 126 | 2 |
| ARTES ESCÉNICAS | 9 | 121 | 69 | 2 |
| CIENCIAS SOCIALES | 12 | 202 | 151 | 2 |
| EDUCACION | 3 | 46 | 23 | 1 |
| GASTRONOMÍA, HOTELERÍA Y TURISMO | 3 | 48 | 15 | 1 |
| **CIENCIAS CONTABLES** | 2 | 26 | 21 | **0** |
| **GESTIÓN Y ALTA DIRECCIÓN** | 7 | 121 | 115 | **0** |
| **LETRAS Y CIENCIAS HUMANAS** | 3 | 45 | 26 | **0** |
| **PSICOLOGÍA** | 6 | 87 | 79 | **0** |
| **DERECHO** | 16 | 309 | **347** | **DÉFICIT 38** |

**Cuatro facultades sin colchón** —cualquier caída obliga a reemplazo— y
**Derecho en déficit: no llega a su cuota ni aunque no caiga ninguna aula.**

Ese es el número que las series A2–A5 tienen que mover. Subir de 190 a 195 o 200
sólo sirve si las aulas nuevas van donde el colchón es cero.

### Un error de medición, corregido antes de reportarlo

El primer cálculo por facultad emparejaba por los **12 primeros caracteres** del
nombre, y «ESTUDIOS GENERALES CIENCIAS» y «ESTUDIOS GENERALES LETRAS» comparten
«ESTUDIOS GENE»: las dos salían con 56 aulas y un colchón de 32. Se cazó porque
56 no cuadraba con las 30 y 26 del desglose anterior. **Cuarto error de medición
de la jornada**; los cuatro se cazaron por contradecir una cifra previa, nunca
por revisar el método.

El runner queda en `scripts/qa/colchon-caidas.R` para reusarlo en A2–A5.


---

## A2 · 195 aulas con reparto proporcional

| | 190 (A1) | 195 (A2) |
|---|---|---|
| Titulares / reservas | 190 / 496 | 195 / 509 |
| Entrevistas esperadas | 3.302 | 3.386 |
| Score de representatividad | 51,1 | **53,6** |
| Colchón global | 34 (17,9 %) | 38 (19,5 %) |
| **Derecho** | déficit 38 | **déficit 19** |
| **Facultades sin colchón** | **4** | **4** |

Las cinco aulas fueron a C&I (+1), EE.GG. Ciencias (+1), EE.GG. Letras (+1), Arte
y Diseño (+1) y Derecho (+1): **cuatro de las cinco cayeron donde ya había
colchón**. Las cuatro facultades en cero —Contables, Gestión, Letras y CC.HH.,
Psicología— **no recibieron ninguna y siguen en cero**.

**Confirma la predicción de A1**: subir el total con reparto proporcional no
mueve el problema, porque el problema está en las facultades pequeñas y el
reparto proporcional, por definición, da a las grandes.

Corrida: 22,5 s.

## Hallazgo de producto: `n_aulas` se acepta y no manda

El primer intento de A2 puso `selector$n_aulas = 195` y el sorteo devolvió **190
titulares, mismo score, mismo colchón, todo idéntico**. `normalize_config`
conserva el 195 —comprobado— pero el reparto real vive en
**`selector$faculty_targets`**, una lista `facultad → aulas` que suma el total. Si
está fijada, `n_aulas` no hace nada **y nadie avisa**.

Es la misma familia que `profundidad_por_facultad`, que también se aceptaba sin
surtir efecto: **un parámetro que se ignora en silencio**. Queda para la serie E:
si la UI deja cambiar el objetivo de aulas sin recalcular `faculty_targets`, el
analista cree haber cambiado el tamaño de su muestra y no ha cambiado nada.


---

## A3 y A4 · subir el total no era la respuesta; repartir bien, sí

| | 190 (A1) | 195 (A2) | 200 (A3) | **190 dirigido (A4)** |
|---|---|---|---|---|
| Titulares | 190 | 195 | 200 | **190** |
| Reservas | 496 | 509 | 522 | 499 |
| Entrevistas esperadas | 3.302 | 3.386 | 3.437 | 3.290 |
| **Score** | 51,1 | 53,6 | 54,5 | **62,7** |
| Colchón global | 34 | 38 | 40 | 33 |
| **Derecho** | déficit 38 | déficit 19 | déficit 19 | **déficit 5** |
| **Facultades sin colchón** | 4 | 4 | 4 | **1** |

**Con las mismas 190 aulas, el reparto dirigido gana al proporcional de 200 en
todo lo que importa**: score 62,7 contra 54,5, una facultad sin colchón en vez de
cuatro, y el déficit de Derecho de 38 a 5 en vez de a 19.

El reparto de A4, sobre los `faculty_targets` de la línea base:

```
ciencias_e_ingenieria        -3      derecho                    +2
estudios_generales_ciencias  -3      ciencias_contables         +1
                                     gestion_y_alta_direccion   +1
                                     letras_y_ciencias_humanas  +1
                                     psicologia                 +1
```

Se quita de las dos facultades con más colchón (8 cada una, quedan en 5) y se da
a las cuatro que estaban en cero y a Derecho.

### Por qué 200 no arreglaba nada

El reparto proporcional **da a las grandes por definición**. De 190 a 200, ocho
de las diez aulas fueron a facultades que ya tenían colchón; Contables, Gestión,
Letras y CC.HH. y Psicología no recibieron **ninguna** en los dos escalones.
Diez aulas más de campo —diez visitas, diez coordinaciones— para mover el score
3,4 puntos y dejar el problema operativo intacto.

### Lo que queda por afinar

Gestión sigue en colchón 0 (recibió +1 y necesita más) y Derecho en déficit 5.
Un segundo ajuste sobre A4 debería cerrarlos: es el A5.

### Otro error del runner, cazado por la cifra repetida

La primera corrida de A4 salió **idéntica a la línea base**. La guarda del
reparto era `if (extra != 0)`, y un reparto dirigido que mantiene el total da
`extra = 0`: nunca entraba. Se cazó porque 3.302 y score 51,1 son exactamente los
de A1. **Quinto error de medición de la jornada, y el quinto cazado por
contradecir una cifra previa.**


---

## A5 y A6 · la tabla comparada y la recomendación

Seis corridas sobre el mismo marco, 22–23 s cada una:

| | 190 | 195 | 200 | 190 dir | 192 dir | **193 dir** |
|---|---|---|---|---|---|---|
| Titulares | 190 | 195 | 200 | 190 | 192 | **193** |
| Reservas | 496 | 509 | 522 | 499 | 505 | 507 |
| Entrevistas esperadas | 3.302 | 3.386 | 3.437 | 3.290 | 3.336 | **3.352** |
| Score | 51,1 | 53,6 | 54,5 | **62,7** | 62,3 | 61,3 |
| Colchón global | 34 | 38 | 40 | 33 | 35 | 35 |
| **Facultades en déficit** | 1 | 1 | 1 | 1 | **0** | **0** |
| **Facultades sin colchón** | 4 | 4 | 4 | 1 | 1 | **0** |

### Recomendación: 193 aulas con reparto dirigido

Es la **única configuración donde todas las facultades cumplen su cuota y todas
tienen margen para al menos una caída**. Comparada con la alternativa obvia —subir
a 200 con reparto proporcional— usa **siete aulas menos** y resuelve lo que
aquélla dejaba intacto: cuatro facultades sin colchón y Derecho en déficit.

El reparto, sobre los `faculty_targets` de la línea base:

```
ciencias_e_ingenieria        -3      derecho                    +4
estudios_generales_ciencias  -3      gestion_y_alta_direccion   +2
                                     ciencias_contables         +1
                                     letras_y_ciencias_humanas  +1
                                     psicologia                 +1
```

### Lo que muestra la tabla

**El score no es la vara.** A4 tiene el score más alto (62,7) y deja una facultad
sin colchón; 193 tiene 61,3 y no deja ninguna. Optimizar el score habría elegido
la peor de las dos para el campo.

**Subir el total con reparto proporcional es la peor relación coste-beneficio**:
de 190 a 200 son diez visitas más para +3,4 de score, cero facultades rescatadas
y el déficit de Derecho a medias.

**Y las tres corridas dirigidas cuestan lo mismo que la línea base o casi**: 190,
192 y 193 aulas contra las 190 de partida.

### Pendiente de decisión

Aplicar el reparto de 193 exige **recalcular `faculty_targets` en el proyecto**, y
eso es una decisión de Gonzalo: cambia el número de aulas de seis facultades y
obliga a re-sortear. La corrida ya está medida; falta el visto bueno.


---

## B1 · Los identificadores del export

El puente entre el sorteo y el campo es **`operational_code`**, con
`classroom_id` de respaldo: así lo casan `monitoreo_aulas_control_facultad.R:33`
y `monitoreo_aulas_cruce_hojas.R:88`.

Medido sobre la selección definitiva:

| Rol | filas | `operational_code` lleno | únicos | `classroom_id` lleno | únicos |
|---|---|---|---|---|---|
| titular | 190 | 190 | **190** | 190 | 190 |
| reserva encadenada | 496 | 496 | **496** | 496 | 496 |
| pool extra | 1.930 | 1.930 | **1.930** | 1.930 | 1.930 |

**Cero códigos repetidos** en los 2.616 registros. Los titulares van de **CH 1 a
CH 190 sin huecos**, y las reservas usan **`R <titular>.<orden>`** —`R 1.2` es la
segunda opción del titular CH 1—, que es trazable a simple vista.

*(Un falso positivo propio: las primeras filas mostraban «CH 4 · CH 6» y parecía
faltar el 5; era el orden del data frame, no la numeración. Comprobado antes de
reportarlo.)*

## B2 · La cadena hasta la ficha QR, leída

`.collection_legacy_unit` (`collection_engine.R:228`) toma como clave el primer
campo disponible de:

```
operational_code → classroom_id → curso_horario → course_schedule_id → selection_slot_id → id_match → id
```

y de ahí saca `unit_id = stable_id("unit-aulas", source_key)`, conservando el
código original en `dimensions$legacy_ref`. La ficha lleva `unit_id`, `access_id`
y `qr_payload` (`collection_materials_job.R:58`).

**La cadena usa el campo correcto y el orden de respaldo es sensato.** Falta
comprobarlo con datos —generar las unidades desde la selección real y verificar
que las 190 llegan con su código—, que es el siguiente tick.


---

## B2 · El plan de recolección viene de un sorteo de hace veinte días

La cadena de código está bien —B1 lo midió— pero **el plan congelado en el
proyecto no corresponde a la selección vigente**:

| | |
|---|---|
| Plan de recolección · corrida de origen | `sel_aulas_2026**0801**211224_e32c240d` |
| Selección vigente | `sel_aulas_2026**0821**160928_bf10d14c` |
| Unidades del plan | **2.468** |
| Filas de la selección | 2.616 |
| Códigos del plan | **«AULA 1», «AULA 2»…** |
| Unidades con código «CH n» | **0 de 2.468** |

Veinte días de diferencia, 148 unidades menos y **otra nomenclatura de código**.
Si se generan materiales ahora, las fichas salen con las aulas de agosto 1.

### Por qué nadie lo ve

`.collection_seed_source` da prioridad al `monitoreo_aulas_plan` y, si no existe
—no existe aquí—, cae a `calc_muestra_aulas_selection`. Pero **el plan sólo se
siembra una vez**: una vez sembrado, re-sortear no lo regenera.

El plan **sí guarda de dónde vino** (`source_ref.run_id`, línea 366 de
`collection_engine.R`), y la pantalla mostraba únicamente
`plan.source_ref.module` — «calc-muestra», que es el módulo y **nunca cambia**.
El dato que distingue una corrida de otra estaba en el payload y no se pintaba.

### Lo reparado en este tick

«Origen» pasa a decir **«calc-muestra · sorteo del 1 ago 2026, 21:12»**. La fecha
sale del propio `run_id` (`sel_aulas_AAAAMMDDHHMMSS_hash`), que la llevaba dentro
pero ilegible. 4 tests, incluido que un `run_id` sin fecha —`legacy-monitoreo-aulas`—
no inventa ninguna.

### Lo que falta, y es lo importante

**Comparar automáticamente** el `run_id` del plan con el de la selección vigente y
avisar cuando difieren. El front no recibe hoy el `selection_run_id`, así que
exige ampliar el payload de recopiladores. Con eso, la pantalla podría decir «este
plan es de otro sorteo» en vez de dejar que el analista compare fechas a ojo.


---

## B3 · El desfase ahora se detecta solo

B2 dejó el diagnóstico y una mejora a medias: la pantalla mostraba la fecha del
sorteo de origen, pero **comparar seguía siendo cosa del analista**. Ahora lo hace
el backend, que es quien tiene los dos datos.

`.collection_source_vigente(s, state)` compara el `run_id` del plan con el
`selection_run_id` de la selección vigente y devuelve
`{ plan_run_id, selection_run_id, desfasado }`. **Devuelve `NULL` cuando no hay con
qué comparar** —un proyecto que aún no ha sorteado— en vez de declarar un desfase
que nadie puede evaluar.

En la pantalla, cuando difieren:

> Este plan se armó con el **sorteo del 1 ago 2026, 21:12**, y la selección
> vigente es **otra** (del 21 ago 2026, 16:09). Los materiales que se generen
> ahora llevarán las aulas del plan, no las del sorteo actual.

**No dice «error»**: el plan está congelado a propósito, y congelarlo es correcto
para un artefacto que ya fue a imprenta. Lo que no puede es no decirse.

Verificación: 5 tests en R —incluido que sin selección vigente **no inventa un
veredicto**, y que sin plan ni selección devuelve `NULL` en vez de un objeto
vacío— y 2 en el front, renderizando el aviso con datos de las dos corridas
reales.


---

## B4 · La cadena de reemplazos viaja, pero el plan guardado es de otro diseño

`.collection_legacy_unit` conserva **`replacement_for`** entre las dimensiones de
la unidad, con un comentario que dice exactamente por qué: «sin esto la ficha de
un reemplazo no puede decir de quién lo es, que es justo lo que necesita saber
quien la lleva al aula». El código está bien.

El plan congelado en el proyecto, no:

| | Plan guardado (1 ago) | Selección vigente (21 ago) |
|---|---|---|
| Titulares | **175** | 190 |
| Reservas encadenadas | 1.547 | 496 |
| Pool extra | 746 | 1.930 |
| Olas | **M1 … M12** | M1 … M5 |
| Dimensión `replacement_for` | **ausente** | disponible |

No es sólo otra corrida: es **otro diseño**. Doce olas de reemplazo contra cinco
—la reducción vino de la reparación de profundidad por facultad, que bajó las
reservas pedidas de 2.090 a 496— y sin la cadena, que se añadió al código después
de sembrar ese plan.

### Cierre de la serie B

| # | Resultado |
|---|---|
| B1 | Identificadores completos, únicos y trazables: CH 1…CH 190, R 1.2 |
| B2 | El plan viene de un sorteo de hace veinte días, y la UI no lo decía |
| B3 | Ahora el backend lo compara y la pantalla lo avisa |
| B4 | La cadena viaja en el código; el plan guardado es de otro diseño |

**Recomendación: regenerar el plan de recolección.** Hoy produciría fichas con
175 aulas de agosto 1, códigos «AULA n», doce olas y sin cadena de reemplazos.
Con la selección vigente daría 190 titulares, «CH n», cinco olas y cada reserva
sabiendo a quién sustituye.

Si además se aplica el reparto de 193 de la serie A, el orden es: **recalcular
`faculty_targets` → re-sortear → regenerar el plan → generar materiales**. Saltarse
el tercer paso es lo que produjo este desfase.


---

## C1 · El libro operativo no se puede generar, y no por falta de datos

El libro tiene tres hojas —`Aulas Agendadas`, `Aulas Aplicadas (Campo)` y `Base
de control`— y su cabecera explica el ciclo: la app genera el libro con lo que
sabe y **deja vacías las columnas de la persona**, quien agenda llama a los
docentes, quien supervisa llena el parte, y la app relee el libro para decidir.

Pero se genera desde `s$monitoreo_aulas_plan`
(`router_monitoreo.R:4855`), y **ese plan no existe en el proyecto**. Hoy el
endpoint devolvería `E_AULAS_LIBRO_SIN_PLAN`.

### La cadena y dónde se corta

| Paso | Qué lo produce | Estado en HSVG2026 |
|---|---|---|
| 1. Sorteo | `calc_muestra_aulas_selection` | ✓ 190 titulares, 21 ago |
| 2. Plan de recolección | `collection_state_seed` | ⚠ existe, del **1 ago**, 175 titulares |
| 3. `monitoreo_aulas_plan` | `collection_handoff` | ✗ **no se ha hecho** |
| 4. Libro operativo | `aulas_libro_generar` | ✗ imposible sin el 3 |

### El defecto de fondo: el plan se siembra una vez y no hay vuelta

`collection_state_seed` empieza así:

```r
if (!is.null(s$collection_state)) return(.collection_payload(..., seeded = FALSE))
```

Sembrar dos veces **no hace nada**, y entre los diez endpoints de recopiladores
**no hay ninguno de reset ni de re-siembra**. La única vía para cambiar el plan es
`PUT /api/recopiladores/plan` con un plan construido a mano y su
`expected_revision`.

Por eso el proyecto tiene un plan de hace veinte días: **se sembró entonces y no
hay botón para rehacerlo**. El aviso de B3 dice que está desfasado; lo que falta
es poder hacer algo al respecto.

### Capacidad que falta

**«Regenerar el plan desde el sorteo vigente»**, con las cautelas que el propio
diseño impone: el plan está congelado a propósito, así que regenerarlo debe ser
explícito, avisar de lo que se pierde —despliegue, materiales ya generados— y
quedar registrado. Es el siguiente tick.


---

## C1b · La capacidad que faltaba, y su coste dicho antes

`POST /api/recopiladores/reseed` rehace el plan desde el sorteo vigente. Exige
`expected_revision` como toda escritura del módulo.

En la pantalla, el aviso de desfase deja de ser sólo diagnóstico:

> Este plan se armó con el **sorteo del 1 ago 2026, 21:12**, y la selección
> vigente es **otra** (del 21 ago 2026, 16:09). Los materiales que se generen
> ahora llevarán las aulas del plan, no las del sorteo actual.
>
> Rehacerlo lo reemplaza por las aulas del sorteo vigente y **descarta el
> despliegue preparado**, incluida su **entrega a campo**. Las fichas ya impresas
> dejan de corresponder al plan.
>
> [ Rehacer el plan con el sorteo vigente ]

**El coste va antes del botón, no en un aviso posterior.** El plan está congelado
a propósito —es lo que fue a imprenta— así que rehacerlo es una decisión, no una
corrección automática; y la frase sobre la entrega a campo **sólo aparece si de
verdad se entregó**, no siempre por si acaso.

Verificado: 12 tests en R y 9 en el front, incluido que sin desfase no ofrece
rehacer nada y que la advertencia de entrega no sale con un despliegue en
borrador.

### El camino completo, ya sin cortes

```
sortear → (aviso de desfase) → rehacer el plan → handoff → libro operativo
```

Antes, el tercer paso no existía y el proyecto se quedaba con el plan de la
primera corrida para siempre.


## Verificación en la app: hasta dónde llega y qué queda sin ver

**Confirmado en la app real** (captura de `/recopiladores` con el proyecto
cargado): el resumen del plan dice **«Origen: calc-muestra · sorteo del 1 ago
2026, 21:12»**. La reparación de B2 se ve.

**No confirmado en la app**: el aviso de desfase y su botón. La captura no los
muestra.

Lo verificado por partes, para no confundir «no lo vi» con «no funciona»:

| Pieza | Estado |
|---|---|
| `.collection_source_vigente` con el estado real del `.pulso` | ✓ `desfasado: TRUE` con los dos `run_id` correctos |
| `collection_state_get` sobre una sesión poblada | ✓ el payload lleva `source_vigente` |
| El JSON que sale al front | ✓ `{"plan_run_id":"…0801…","selection_run_id":"…0821…","desfasado":true}` |
| `PlanSection` con ese payload | ✓ 9 tests, renderizado |
| La cadena entera dentro de la app | **sin observar** |

La hipótesis más probable es que la sesión que crea el runner al abrir el `.pulso`
no restaure `calc_muestra_aulas_selection` igual que la lectura directa del RDS
—las pruebas de arriba la poblaron a mano— y entonces no habría con qué comparar.
**Es una hipótesis, no un diagnóstico**: queda para el siguiente tick, y hasta
comprobarlo el aviso no puede declararse funcionando de extremo a extremo.


## Por qué el aviso no aparecía: lo añadí a una salida y hay dieciséis

La hipótesis del tick anterior era falsa —el `.pulso` **sí** restaura la
selección; ese código sólo subroga identificadores—. Al descartarla apareció la
causa, y es mía: **`source_vigente` se calculaba únicamente en
`collection_state_get`**. Las otras quince salidas del módulo —`seed`, `plan`,
`deployment`, `prepare`, `reconcile`, `handoff`— devolvían el payload sin él, así
que el aviso desaparecía en cuanto el front hacía cualquier cosa.

Es **exactamente** el defecto que este loop lleva corrigiendo todo el día, ahora
cometido por mí: se añade el dato donde se mira, no en todas las salidas.

Reparado con `.collection_con_vigencia(payload, sid)` envolviendo las trece
salidas de las seis funciones públicas, y un contrato que **cuenta**: cada
`.collection_payload(` del cuerpo tiene que ir envuelto, o el test falla nombrando
la función.

### El script de reparación introdujo seis errores de paréntesis

Al envolver automáticamente, el `, sid)` quedó **fuera** del helper en seis
sitios: `return(.collection_con_vigencia(.collection_payload(…)), sid)` le pasa
`sid` a `return()`, no al helper. **R lo carga sin quejarse** porque no evalúa el
cuerpo, así que `load_all` decía «OK» con seis llamadas rotas dentro.

Lo cazó el contrato en un sitio y el resto salió de buscar el patrón `)), sid)` a
mano. **Un `load_all` limpio no dice que el código esté bien: dice que se puede
parsear.**

### Y una de R que conviene recordar

`payload$source_vigente <- NULL` **elimina la clave**, no la deja vacía. El primer
test afirmaba que la clave seguía presente y fallaba con razón. Para el cliente da
igual —ausente y `null` se leen igual en JS— pero el test tenía que afirmarlo como
es, no como me convenía.


## El aviso, por fin en pantalla — y el eslabón que lo comía

**Verificado en la app**: el resumen del plan muestra el aviso completo, con las
dos fechas, el coste de rehacer y el botón.

Llegar ahí costó tres diagnósticos, y sólo el tercero era correcto:

| Hipótesis | Veredicto |
|---|---|
| El `.pulso` no restaura la selección | **falsa** — ese código sólo subroga identificadores |
| El veredicto sólo viajaba en una de dieciséis salidas | **cierta pero insuficiente** — reparado, y el aviso seguía sin salir |
| **El normalizador del front se lo comía** | **la causa** |

`normalizeCollectionStatePayload` reconstruye el payload **campo por campo**, así
que cualquier campo nuevo del backend se pierde en silencio si no se añade ahí.
El JSON llegaba correcto —comprobado con `curl` contra la API, con
`"desfasado":true`— y la pantalla no lo veía, con el backend, el endpoint y el
componente los tres bien.

Es el patrón conocido de la casa: **una lista cerrada se traga lo que no
reconoce**. Y su rasgo peor es que no falla: no hay error, no hay aviso, el campo
simplemente no está.

Contrato: 4 tests en el normalizador, incluido que un `desfasado: "true"` de
cadena **no** se lee como alarma —una alarma que dice que el plan está viejo sin
saberlo es peor que ninguna—.

### La lección de método

Los tests del componente pasaban porque le pasaban el payload **a mano**. Los del
backend pasaban porque miraban el backend. **Ningún test cruzaba la frontera**, y
el defecto vivía exactamente ahí. Lo cazó `curl` contra la API real comparado con
lo que la pantalla mostraba: la única prueba que atravesaba las dos capas.


## El contrato que faltaba: uno que cruce la frontera

Barrido tras el hallazgo: **hoy no hay más campos perdidos**. Los once que emite
`.collection_payload` están cubiertos por el normalizador. Pero el riesgo seguía
vivo para el siguiente.

`recopiladoresFrontera.contract.test.ts` lee la lista de campos del **fuente R**
y comprueba que el normalizador de TS los nombra. Mutante: añadir
`campo_nuevo_sin_cubrir = TRUE` al payload de R hace fallar el test con el
mensaje que hacía falta —

> el normalizador no menciona «campo_nuevo_sin_cubrir»: se perderá en silencio

— y sin él, el campo habría llegado a producción invisible.

El test se protege a sí mismo: si la lista de campos leída del R quedara vacía,
el contrato pasaría sin comprobar nada, así que exige al menos ocho campos y dos
concretos.

**Por qué hacía falta un test de este tipo**: los del componente pasan porque les
pasan el payload a mano; los del backend, porque miran el backend. Entre las dos
capas no había nada, y ahí es donde vivía el defecto.


## Censo de normalizadores: 23 pueden comerse un campo

Barrido del front tras el hallazgo de `source_vigente`:

| Tipo | Cuántos |
|---|---|
| **Reconstructores** — arman el objeto campo por campo y pierden lo que no nombran | **23** |
| Permisivos — hacen spread del original | 5 |

No todos son un defecto: sólo lo son cuando el backend emite algo que ellos no
nombran. Comprobado uno del área, y sí lo era.

### `sexo_por_facultad` perdía la referencia

El motor emite nueve campos —`schema`, `owner`, `grain`, `unit`, **`referencia`**,
`base`, `tolerancia`, `veredicto`, `filas`— y el normalizador conservaba cuatro.
Entre los perdidos, **`referencia = "marco_incluido"`**: contra qué se comparan
las proporciones.

Y la tarjeta rotulaba esa columna **«Su cuota pide»**. La cifra es la proporción
del marco, que coincide con la cuota **sólo porque este diseño usa afijación
proporcional**; con otra referencia el rótulo prometería un número que la columna
no trae. Es la familia dominante del módulo, otra vez.

Ahora el rótulo sale de lo que el motor declare: **«El marco tiene»** con
`marco_incluido`, el nombre de la referencia si es otra, y **«Su cuota pide»** sólo
cuando el campo no viene —un `.pulso` viejo no lo trae y cambiarle el rótulo sería
inventar—. 3 tests.

Es el mismo defecto que se reparó ayer para el balance de facultad («declara
contra qué referencia se midió»): **el dato existía en el motor y no llegaba a la
pantalla**, esta vez porque un normalizador lo descartaba por el camino.


## Muestreo de los 23 reconstructores: 1 de 3 perdía algo

No todo normalizador que reconstruye pierde datos. Revisados tres del área,
comparando campo a campo con lo que emite su función en R:

| Normalizador | Emite el motor | Conserva | Veredicto |
|---|---|---|---|
| `sexo_por_facultad` | 9 campos | 4 | **perdía `referencia`** — reparado |
| `docente_unico` | activo, ajustes{docente, stratum, saliente, entrante, intercambiado_con_ola}, no_reparables{docente, stratum, classroom_id} | todos | **sin pérdida** |
| `session_type_impacto` | schema, tipos_excluidos{tipo, label, facultades{facultad, ch, elegibles, exceptuada}} | transforma a raw/facultades/exceptuado_en/perdido_en | **transforma, no filtra** |

El tercero enseña algo: `raw` es el nombre de su parámetro de entrada, no un campo
guardado. **Comparar por nombre de campo no basta** cuando el normalizador
transforma la forma; hay que leerlo.

### Lo que queda como recomendación, no como trabajo hecho

Un censo completo de los 23 exige comparar cada uno con su emisor en R, y **no
cabe en un tick**. Lo que sí queda es el patrón para hacerlo:
`recopiladoresFrontera.contract.test.ts` demuestra que un contrato puede leer el
fuente R y comprobar que el normalizador nombra lo que el backend emite. Aplicarlo
a los normalizadores críticos del área es trabajo acotado y verificable, uno por
uno.

**Y una cautela sobre este muestreo**: tres de veintitrés no autoriza a decir que
el resto está bien. Autoriza a decir que el patrón existe y que se detecta
comparando con el emisor.
