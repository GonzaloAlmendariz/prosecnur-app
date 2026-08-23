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
| D1 | Inventario | ☑ 47 componentes; la serie estaba mal planteada |  |
| D2 | Avance por facultad contra la cuota | ☑ **ya existe** |  |
| D3 | Aulas caídas y su reemplazo | ☑ **ya existe** |  |
| D4 | Ritmo y proyección | ☑ **ya existe** |  |

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


## D1 · El monitoreo de aulas ya tiene 47 bloques, y uno se llama como mi métrica

Inventario del perfil: **47 componentes**, entre ellos `AulasPronosticoDeCierre`,
`AulasLoQueFalta`, `AulasRitmoPorFacultad`, `AulasEmbudoDelAula`,
`AulasHistoriaCadena` y `AulasColchonPorFacultad`. Es bastante más rico de lo que
suponía al escribir la serie D.

### Y ahí estaba el choque de vocabulario, cometido por mí

| | Qué mide | Responde |
|---|---|---|
| `colchonPorFacultad` (Monitoreo, ya existía) | reservas **libres vs gastadas** durante el operativo | «¿me quedan reservas?» |
| Mi «colchón de caídas» (A1) | titulares que pueden caer **antes de bajar de la cuota** | «¿cuántas puedo perder sin usar reservas?» |

Dos métricas distintas con la misma palabra, en el mismo dominio. Es exactamente
la familia que este loop lleva todo el día persiguiendo —**una palabra para dos
cosas**— y esta vez la introduje yo, en la métrica que decide la serie A.

Renombrada a **«caídas que la cuota tolera»**, y el runner ahora imprime `DEFICIT
| SIN MARGEN`. Las cifras de A1–A6 no cambian: cambia cómo se llaman.

**La lección, otra vez**: antes de nombrar una métrica nueva, mirar si el dominio
ya usa esa palabra para otra cosa. Bastaron dos minutos de inventario para
encontrarlo, y llevaba seis ticks escribiéndolo mal.


## D2–D4 · lo que la serie daba por ausente ya estaba, y bien

| Lo que D pedía | Lo que ya existe |
|---|---|
| Avance por facultad contra la cuota | `AulasCuotasResumen` —«cuánta gente falta, en total, por facultad y por sexo»— y `AulasPiramideCuota`, con **cada sexo contra su propia meta** |
| Aulas caídas y su reemplazo efectivo | `AulasHistoriaCadena`: «si cumplimos con el titular, cómo fue su reemplazo, y **cuál de los dos cerró**» |
| Ritmo y proyección | `AulasPronosticoDeCierre`, con banda entre el ritmo más lento y el más rápido y una regla explícita: «**nunca un punto: una fecha sola se lee como una promesa**» |
| — | `AulasLoQueFalta`: convierte el veredicto en **cola de trabajo ordenada por esfuerzo** |

**La serie D estaba mal planteada por mí**: la escribí suponiendo que faltaba, sin
mirar. Es el mismo error que D1 destapó con «colchón», dos ticks seguidos.

### El límite real: no hay con qué probarlo

Para juzgar si el monitoreo «da información útil» hacen falta datos de campo, y
**no existen**:

| Proyecto | monitoreo | ¿de aulas? |
|---|---|---|
| `acnur_acg`, `acnur_pdm`, `acrconta` | **sí** | no —territorial, telefónico, multiactor— |
| **`hsvg2026`** | **no** | **sí** |
| `HSVG2026_*.pulso` de trabajo | sin plan ni respuestas | sí |

O sea: **los 47 componentes del perfil de aulas no tienen ningún proyecto de
referencia que los ejercite**. Es deuda de cobertura, no un defecto de esos
componentes, y explica por qué un «sin hallazgos» sobre ellos no valdría nada.

**Lo que desbloquearía la serie D** es un fixture de aulas con campo —plan de
monitoreo, partes, base de control y respuestas—, que es trabajo grande y decisión
de Gonzalo. Hasta entonces, D2–D4 se declaran **cubiertos por código existente y
no verificados con datos**, que no es lo mismo que verdes.


## Lo primero que ve Monitoreo con este proyecto: una pregunta desde cero

Abriendo `/monitoreo` con `HSVG2026_definitivo`, la pantalla es **«¿Qué tipo de
estudio vas a monitorear?»** con cuatro tarjetas —acreditación, territorial,
cursos-horario, telefónico— y ninguna marcada. El proyecto tiene **190 aulas
sorteadas y un cálculo de muestra universitario**, y la app pregunta como si no
supiera nada de él.

### Contradice el contrato de navegación, pero no del todo

CLAUDE.md, contrato v3: «**Modo** (opcional; reescribe el juego de secciones y
**lo determina el estudio, no un click** — Monitoreo y Cálculo de muestra)».

Aquí es un click. **Y sin embargo la elección explícita tiene razón de ser**: un
estudio de aulas puede monitorearse por teléfono, y la pantalla dice «Declara el
propósito de Monitoreo», que es una decisión legítima del analista, no una
deducción.

Así que el defecto no es que pregunte: es que **pregunta sin usar lo que ya
sabe**.

### La mejora que corresponde: sugerir, no imponer

Con una selección de aulas en el proyecto, la tarjeta «Monitoreo de
cursos-horario» debería llegar señalada —«tu proyecto tiene 190 cursos-horario
sorteados»— sin quitar las otras tres. Eso respeta la decisión y aprovecha el
dato.

**IMPLEMENTADO. Y la razón por la que casi no lo hago vale más que el cambio**:
escribí que sugerir «exige una señal nueva desde el backend», tras comprobar que
`MonitoreoShell` sólo recibe `MonitoreoState`. La comprobación era correcta y la
conclusión falsa: miré al consumidor y no al productor. `project_overview.R:259`
ya lee `calc_muestra_aulas_selection` y publica `facts.calc.mode = "aulas"` con
`aulas_titulares`, tipado desde hace tiempo en `api/overview.ts:80`. La señal
llevaba ahí todo el tiempo, a una llamada de distancia.

Es la tercera vez esta semana que declaro una limitación sin intentarla, y las
tres resultaron falsas. El patrón es siempre el mismo: **grep del consumidor,
conclusión sobre el productor**.

### Qué quedó

- `core/sugerenciaDeModo.ts` — helper puro. Con selección de aulas sugiere
  cursos-horario; con distritos, territorial; **con ambas señales no sugiere**,
  porque un proyecto con aulas y hojas de ruta es justo aquel donde la elección
  del analista importa. Sin señal, sin marca: una tarjeta marcada «por si acaso»
  enseña a ignorar la marca.
- `MonitoreoShell.tsx` — pide el overview aparte del estado de Monitoreo, a
  propósito: si falla, la pantalla sigue funcionando sin marca. Una sugerencia no
  puede bloquear la pantalla que sugiere.
- `MonitoreoModeChoice.tsx` — chip «Sugerido» y el motivo con su cifra en el lead.
- 9 tests, dos mutantes muertos (quitar la regla de las dos señales; quitar el
  filtro de modo visible), 1 rojo cada uno.

### Dónde va la marca, y por qué no donde la puse primero

La tarjeta tiene `height: 96px` fijo y el grupo declara
`data-qa-geometry-contract="equal"`, así que el motivo largo **no cabe dentro**:
vive en el lead. El chip lo colgué primero del label, y medido a 1024×600
envolvía a segunda línea y dejaba el contenido en **71 px de los 72
disponibles** — cabía por un píxel, que no es caber. Movido a la columna de
acción, sobre «Elegir».

**Hallazgo aparte, y no lo causé yo**: medido el baseline sin sugerencia, la
tarjeta de cursos-horario ya ocupaba **69 px de 72** a 1024×600 por su propio
summary, el más largo de los cuatro. Vive a 3 px del desborde desde antes de
este cambio.


## Serie E — el mapeo del campo: qué panel se apaga y cuál miente

El perfil de aulas de Monitoreo tiene **47 componentes**. La pregunta útil no es
cuál agregar sino **cuál se apaga en silencio**: un panel que no se renderiza es
un agujero que el coordinador no puede echar de menos, porque no sabe que existe.

### Censo de los que devuelven `null`

Diez componentes tienen `return null`. Revisados los cuatro que son top-level
—`AulasAgendaPorDia`, `AulasCambioDeAula`, `AulasMatrizUmbrales`,
`AulasAlcanceDelBanco`—, **ninguno es un agujero**:

- `AulasCambioDeAula` se retira sólo si no hay partes, y la tabla de al lado ya
  dice «Todavía no se ha registrado ningún parte de campo».
- `AulasAgendaPorDia` se retira sólo si no hay filas; con filas y sin fechas ya
  declara «Ninguno de los N cursos-horario tiene fecha de aplicación».

Iba a «reparar» los dos. Los dos estaban bien.

### El defecto real estaba un paso más allá: el rótulo

`AulasCambioDeAula` cruza el salón que anotó el equipo con el que decía el plan.
Cuando no puede comparar una fila, decía siempre lo mismo:

> N **sin salón reconocible en una de las dos hojas**

Con partes de campo y **sin plan agendado**, todas las filas caen ahí — y ese
texto manda a revisar el libro de campo, que está bien, en vez del plan, que es
el que falta. **Es exactamente el estado que encontró la serie B**: plan de
recolección desfasado del sorteo vigente. El panel que debía denunciar el
desfase acusaba a la hoja equivocada.

Es la misma familia que este perfil lleva corrigiendo: un rótulo que vale igual
para dos diagnósticos opuestos esconde el que decide.

### Reparado

`aulaRealVsAgendada` conserva la causa (`sinSalonReal`, `sinSalonAgendado`,
`planConSalon`) en vez de fundirlas en un solo contador, y el panel nombra la
hoja:

| Estado | Antes | Ahora |
|---|---|---|
| Partes, sin plan | «N sin salón reconocible en una de las dos hojas» | «el plan agendado no trae salón para ningún curso-horario, así que no hay contra qué comparar los N partes» |
| Plan completo, parte sin salón | idem | «sin salón anotado en el parte de campo» |
| Las dos causas mezcladas | idem | «una de las dos hojas» — ahí el genérico **es** el honesto |

7 tests nuevos, dos mutantes muertos (quitar la rama del plan ausente; dejar el
rótulo genérico siempre), 1 rojo cada uno.


## Serie E — el desnivel de grano del cruce parte↔plataforma

Segundo hallazgo del mismo censo, y éste no es de rótulo sino de cálculo.

`parteContraPlataforma` compara lo que el aplicador declaró con lo que llegó a
plataforma. **Los dos lados tenían grano distinto**: el de plataforma se
construía por `operational_code`; el del parte se recorría **fila a fila**.

Un curso-horario con dos partes —dos sesiones, o el libro partido en dos filas—
se comparaba dos veces contra el mismo total, así que **descuadraba dos veces
aunque la suma cuadrara exacta**: 20 y 18 contra 38 daba dos descuadres de un
cruce perfecto.

El daño no se queda en el conteo. El panel tiene un umbral —
`PROPORCION_QUE_DELATA_EL_MAPEO = 0.9` sobre al menos 20 casos— que acusa al
**mapeo de identificadores** de estar roto. Con 20 cursos-horario que cuadran,
cada uno partido en dos filas, el cruce fila a fila daba **40 comparables y 40
descuadres**: el panel habría declarado el mapeo roto en un operativo que cuadra
perfecto. Ese caso está ahora en un test.

El perfil ya sabía que esta trampa existía: el comentario de `AulasCambioDeAula`
dice literalmente que cuenta **210 partes** mientras el plan tiene **196 aulas**.
La palabra estaba corregida ahí y el grano seguía mal aquí.

### Reparado

- Los partes se agrupan por curso-horario y se suman antes de comparar.
- `comparables` pasa a ser cursos-horario de verdad, así que el rótulo se
  corrige a **«cursos-horario comparables»** — «aulas» era la palabra de otra
  población del mismo perfil.
- Campo `conVariosPartes` **consumido en el panel**: «los 20 cuadran» significa
  otra cosa si detrás hay 40 partes.

6 tests nuevos, mutante (pisar en vez de sumar) mata 3.


## Serie C — una columna borrada en el Sheets se llevaba la cadena de reservas

Desbloqueada con fixture propio en vez de esperar al proyecto: el repo ya tenía
`helper-libro-aulas.R` y `test-carga-aulas-desde-sheets.R`, así que declararla
«bloqueada hasta que exista `monitoreo_aulas_plan`» era de más.

El Sheets del libro lo edita el equipo mientras el operativo corre. La hoja
«Aulas Agendadas» es ancha —un bloque de 20 columnas por eslabón de la cadena— y
los bloques se contaban **por ancho**: `(ncol - 1) %/% 20`.

**Medido con el motor real**, no deducido:

| Edición del Sheets | Antes | Ahora |
|---|---|---|
| Una columna insertada en medio | 2 filas ✓ | 2 filas ✓ |
| Tres columnas en medio | 2 filas ✓ | 2 filas ✓ |
| Una columna al principio | 2 filas ✓ | 2 filas ✓ |
| **Una columna borrada** | **1 fila** ✗ | 2 filas ✓ |

41 columnas dan 2 bloques y 40 dan 1. Una sola columna borrada —el equipo
esconde la que le estorba— y la hoja se leía **sin la cadena de reservas**, sin
error y sin aviso. Y las reservas son justo lo que hay que vigilar para no
acabar usándolas, que es el encargo.

Mi primera hipótesis (la inserción corre los campos) resultó **falsa**: la
ventana del bloque tiene holgura de sobra. El defecto estaba en el otro sentido,
y sólo apareció probando los cuatro casos con el motor.

### Reparado de fondo

Los arranques de bloque se leen de los **títulos** —el título del curso-horario
aparece una vez por bloque— y no del ancho. Con la hoja intacta devuelve
exactamente los mismos índices que el cálculo viejo, y eso está fijado en un
test de compatibilidad. Sin títulos reconocibles se cae al ancho, como antes. La
ventana de cada bloque termina donde empieza el siguiente, para que un bloque
corrido no pesque columnas del vecino.

8 asertos nuevos; el mutante que vuelve al cálculo por ancho mata 2. Suites
`carga-aulas*` y `monitoreo-aulas*` sin fallos.


## Serie C — la hoja de agenda no decía qué columna dejó de reconocer

Paridad entre las tres hojas del libro. La de «Base de control» ya reportaba sus
columnas sin nombre —`sin_nombre`, consumido en Fuentes y en el aviso de libro
importado—. La de agenda **no reportaba nada**.

Consecuencia medida: renombrar «TELEFONO DE DOCENTE» a «CELULAR» en el Sheets
baja los campos reconocidos de 20 a 19 y `teacher_phone` se lee vacío **sin un
solo aviso**. El propio código dice de ese campo que es «EL dato con el que se
agenda».

La hoja que genera la app trae los 20 campos del bloque, así que **una ausencia
es señal de verdad y no ruido** de un libro incompleto. Eso está fijado en un
test: si el generador y el lector dejan de hablar el mismo idioma, el aviso se
volvería permanente y el test lo caza antes.

### Reparado

- `aulas_agendadas_campos_ausentes(titulos)` — pública y testeable.
- Viaja con el plan **como atributo**, así que ningún consumidor actual cambia
  de forma.
- Llega al recibo del libro (`agenda_campos_ausentes`) y a la config, por el
  mismo camino que `control_sin_nombre`.
- Se muestra en Fuentes **nombrando los campos, no contándolos**: «la hoja de
  agenda no trae el teléfono del docente: esas columnas se leen vacías». «Faltan
  2 campos» manda a buscarlos; nombrarlos permite arreglarlo.

De paso, la hoja de «aplicadas» ya detectaba sus bloques por títulos
(`aulas_aplicadas_inicios`): la reparación del tick anterior converge al patrón
que la casa ya tenía en la hoja hermana, no lo inventa.

6 asertos en R y 4 en el frontend. Un token huérfano evitado en el camino
(`--pulso-warning-strong` no existe; el real es `--pulso-warn-fg`).


## Serie C — la vuelta por Sheets sólo estaba probada para un tercio del libro

`test-carga-aulas-desde-sheets.R` cubría «Aulas Agendadas». Las otras dos hojas
llevan **dos** filas de cabecera en vez de una y se leen con funciones
distintas, así que el camino que el equipo usa de verdad —el libro vive en Drive
y llega por `spreadsheets.values.get`— estaba sin cubrir para dos tercios del
libro.

Cubierto ahora: partes con sus cifras (incluido `actual_room`, sin el cual el
cruce de cambio de aula se queda sin la mitad), filas de control, **filas
recortadas** en las hojas de dos cabeceras (la API corta las celdas vacías
finales, y ese caso sólo estaba probado en Agendadas) y el libro recién generado
sin partes, que no debe inventar partes fantasma.

10 asertos; el mutante que lee una sola fila de cabecera para las tres hojas
mata 5.

### Tres hipótesis de defecto, las tres falsas

Vale la pena anotarlas, porque las tres eran plausibles y las tres se cayeron al
medirlas:

1. **«`aplicadas` devuelve 0 partes por Sheets»** — cierto, pero correcto: la
   hoja recién generada aún no tiene partes, y las dos vías (Excel y Sheets) dan
   lo mismo. Descartar bloques sin datos reales es deliberado.
2. **«Sigue dando 0 con partes registrados»** — el fallo era mío: pasé
   `asistentes`/`encuestas_efectivas` y el generador espera `observed_students`/
   `effective_surveys`. Mi fixture no hablaba el idioma del generador, y la hoja
   salió sin datos.
3. **«"MATRICULADOS POBLACIÓN" aparece dos veces por bloque»** — es el
   **mecanismo de corte**: la segunda aparición de `MATRICULADOS TOTAL DTI`
   marca dónde empieza la parte de campo dentro del bloque, y el lector lo usa
   explícitamente. Está comentado en `carga_aulas_aplicadas.R:55`.

La tercera es la que más se parecía a un hallazgo —un título duplicado es
exactamente la forma de los defectos que este perfil ha tenido— y era diseño.


## Serie E — el atraso se medía contra un día que nadie nombraba

Dos defectos del mismo hecho: **el mapeo del campo no decía a qué fecha está
cortado**.

### 1. Un KPI llamado «Corte» cuyo valor era «Listo»

En Fuentes, la tarjeta «Corte» mostraba `"Listo"` / `"Pendiente"` y escondía la
fecha en la pista. Prometía una fecha y entregaba un estado — la misma familia
que este perfil lleva corrigiendo. El corte **es** la fecha: todo el atraso del
operativo se mide contra ella. Ahora la fecha va en el valor y la pista explica
para qué sirve.

### 2. El panel del frente del operativo no nombraba su día

«12 de 40 cursos-horario que ya pasaron su fecha siguen sin parte» — ¿pasaron su
fecha respecto de cuándo? El panel mide contra el sello del tablero
(`generated_at`) y **no contra el reloj del navegador**, que es la decisión
correcta y está comentada en el código. Pero ese día no aparecía en ninguna
parte: en un proyecto reabierto días después, la cifra es cierta al día del
sello y ya no al de hoy, y nada en pantalla permitía notarlo.

Ahora la frase termina en « · al 22 de agosto». Va en el flujo, con el mismo
separador que el resto del panel, porque califica todas las cifras de la frase.

4 asertos; el mutante que ignora el corte y usa una fecha propia mata 3.

**Nota de método**: el primer intento de ese mutante no llegó a aplicarse —el
`perl` no matcheó por el escapado— y el test dio verde igual. Un mutante que no
se aplica es un verde que no prueba nada; se detecta comprobando con `grep` que
el cambio está en el archivo antes de correr.


## Serie C1 — las fichas QR no decían de qué sorteo salieron

El defecto de la serie B **un eslabón más adelante, y con peores
consecuencias**: un plan desfasado se corrige con un botón; una ficha impresa
con los cursos-horario del sorteo anterior ya no avisa de nada cuando llega a
campo.

Cada recibo de artefacto guarda su `plan_fingerprint` **desde el principio**
(`collection_materials_job.R:215`). El motor incluso sabe declarar `stale` con
`plan_fingerprint_changed`… pero sólo para el *deployment*
(`collection_engine.R:527`). Los materiales ya generados se listaban con nombre,
tipo, páginas, bytes y checksum, y nada comparaba su huella con la del plan
vigente. El dato estaba entero; lo que faltaba era compararlo.

### Reparado

`juzgarMaterialesDelPlan(materiales, huellaVigente)` marca los que salieron de
otro plan, con **dos abstenciones deliberadas** —una marca falsa aquí
desprestigia todas las demás—:

- **Sin huella vigente no se juzga a nadie.** Un proyecto sin plan todavía no
  vuelve obsoletos sus materiales; no hay con qué comparar.
- **Un material sin huella tampoco se marca.** Un recibo anterior a que se
  guardara la procedencia es falta de dato, no prueba de desfase: marcarlo sería
  acusar por no saber.

En pantalla: aviso **encima** de la lista —se descarga desde cada fila, así que
enterarse después de bajar el archivo no sirve— más la marca en la fila
concreta.

6 asertos; el mutante que marca también por falta de dato mata 2.

### Búsquedas de este tick que no dieron nada

- **Censo de KPIs con valor de estado**: sólo el «Corte» ya reparado. Los dos
  que caen a «S/D» —«Cuota por recoger» y «Cierran con lo agendado»— **sí**
  dicen su causa en la pista («el plan no declara cuotas»). Sanos.
- **`artifact_receipts` parecía un campo huérfano** que nadie escribía. Lo
  escribe `collection_materials_job.R:271`; mi primer grep lo había filtrado yo
  mismo con un `grep -v` demasiado ancho. El campo estaba bien; el instrumento,
  mal.


## Serie E — importar el libro de otro sorteo no se distinguía de importar el bueno

`aulas_libro_fusionar_plan()` mete tal cual las aulas que el plan no tiene, y
está bien pensado: *«un aula que el libro trae y el plan no entra tal cual;
descartarla perdería una fila que alguien añadió a mano en campo»*. Pero trataba
igual **1 aula añadida a mano que 190 de otro sorteo**, y el plan quedaba con dos
sorteos mezclados mientras el aviso decía «Entraron 190 aulas».

Misma forma que el cruce parte↔plataforma, que esto ya resuelve bien con su
umbral: unos pocos casos son casos; casi todos son otro problema.

### Tercer caso del mismo patrón en el mismo camino

La cifra existía: `aulas_libro_importar_en_sesion()` calcula
`fusion = {actualizadas, nuevas, intactas}`. **El router no la devolvía**, así
que moría en el backend. Ya había pasado dos veces aquí mismo:

| Dato | Quién lo producía | Dónde moría |
|---|---|---|
| `reservas` | el backend lo contaba | el tipo del front no lo declaraba |
| `teacher_phone` | la spec y el generador | el registro del lector no lo emitía |
| **`fusion`** | `carga_aulas_libro.R` | **la respuesta del router no lo pasaba** |

De paso viajó también `agenda_campos_ausentes`, que tenía el mismo problema
desde el tick anterior.

### La regla que distingue

`intactas > 0` prueba que **había plan previo**. Sin eso, «ninguna coincidió» es
sólo un primer libro y acusarlo sería un falso positivo en el caso más común de
todos.

5 asertos; el mutante que quita esa condición —y acusa al primer libro— mata 1.


## El patrón que apareció tres veces ya tiene guardián

Las tres pérdidas de dato de esta serie se encontraron **de casualidad, mirando
otra cosa**. Eso es lo que había que arreglar de fondo, no cada caso.

| Eslabón | Caso | Cómo se perdía |
|---|---|---|
| motor → router | `fusion` | el importador la calculaba, la respuesta no la pasaba |
| router → tipo | `reservas` | el router lo emitía, el tipo del cliente no lo nombraba |
| spec → registro | `teacher_phone` | el generador lo escribía, el lector no lo emitía |

Dos guardianes cubren ahora la cadena entera:

- **`test-router-monitoreo-emite-lo-que-importa.R`** ejecuta
  `aulas_libro_importar()` de verdad —no lee su código— y exige que el endpoint
  nombre cada campo que devuelve. Los que no deben viajar se declaran en
  `.EMITE_APARTE` **con su motivo**: `plan`, `partes` y `control` viajan por
  `state` y mandarlos dos veces duplicaría el payload del plan en cada
  importación. Esa lista es la parte que hay que defender al crecer.
- **`monitoreoLibroFrontera.contract.test.ts`** lee el cuerpo del endpoint y
  exige que el tipo del cliente declare lo que emite.

### Verificado contra el defecto real, no contra sí mismos

Revertido el router al estado de ayer, el guardián de R falla nombrando
exactamente `agenda_campos_ausentes` y la `fusion`. Quitado `fusion` del tipo, el
del frontend dice «el router emite estos campos y el tipo del cliente no los
nombra: fusion».

Los dos llevan un aserto contra el verde vacío —`expect_gt(length(producidos), 0)`
y `emitidos.length >= 4`—: si el extractor deja de encontrar el `list(...)`, el
test falla en vez de aprobar por no haber mirado nada.


## Serie E — Monitoreo no sabía que su plan era de otro sorteo

Tercer consumidor del mismo dato, y el más importante de los tres.

`monitoreo_aulas_from_calc()` guarda el `selection_run_id` del sorteo en la
config de aulas, así que **Monitoreo siempre supo de dónde venía su plan**. Lo
que no había era la comparación con el sorteo vigente.

Recopiladores sí la tenía —la de la serie B, con su aviso y su botón de
rehacer—. Monitoreo no, **y es donde se mira el avance del campo**: se
re-sortea, Recopiladores avisa, y Monitoreo sigue enseñando el avance, las
cuotas y los atrasos de un plan que ya no existe, sin decir nada.

### Reparado

`monitoreo_aulas_origen_vigente(s)` en archivo propio, colgado del payload de
estado como `aulas_origen`, y `AulasOrigenDesfasado` entre el chrome de módulo y
la mesa de trabajo — ahí porque califica **todo** lo que hay debajo, no un panel.

Tres abstenciones, las mismas que en los otros dos sitios:

- Un plan **sin** `selection_run_id` no se acusa: el que viene por libro no trae
  ese campo, y marcarlo sería acusarlo por no tenerlo.
- Sin sorteo vigente tampoco hay con qué comparar.
- Una selección con **dos corridas mezcladas** dentro no decide: inventar cuál
  es la vigente produciría un desfase falso o taparía uno real.

Y acepta la corrida leída de las filas de la selección, que es la forma que usa
`.collection_source_vigente()`: si no la aceptara, las dos superficies
discreparían sobre cuál es el sorteo vigente, que es peor que no avisar.

El aviso **no lleva botón**, a diferencia del de Recopiladores: rehacer el plan
de Monitoreo es reimportarlo desde Cálculo de muestra y eso pisa lo que el libro
haya traído encima. Es una decisión con consecuencias, no un clic al paso.

11 asertos en R y 5 en el frontend.

### De paso: dos congelados ajenos siguen en rojo

`node agentic/sync-agentic-os.mjs --audit` falla por
`territorialProfile.css` (+7) y `HojasRutaPage.tsx` (+3). **No son de este
trabajo.** `router_monitoreo.R` sí está congelado y las líneas que le añadí no
lo acercan al límite: 5 345 contra una base de 6 046.


## Un 500 al pulsar «Elegir» en la pantalla de modo

Este apareció **mirando la pantalla**, no leyendo código, y es el defecto más
grave de la serie: elegir «Monitoreo de cursos-horario» sobre el proyecto real
devolvía `E_INTERNAL` y no guardaba nada.

### El ciclo se cerraba solo

1. El payload de estado **añade `plan_rows`** a la config de aulas, para que la
   UI tenga el conteo.
2. `chooseMode` reenvía **la config entera** que recibió, más el perfil.
3. En `monitoreo_aulas_normalize_config`, `config$plan` —con `$`, que
   **parcial-matchea**— no encontraba `plan`, encontraba `plan_rows`, y devolvía
   el entero.
4. `.monitoreo_aulas_df(0L, "plan")` → «El insumo 'plan' debe ser una tabla o
   lista de filas» → 500.

Reproducido con curl: **reenviar sin tocar nada la config que el propio backend
acababa de devolver** bastaba para el error. El backend emitía algo que él mismo
no aceptaba de vuelta.

El repo ya conocía esta trampa —`config$plan`/`plan_rows`— en otro punto. Aquí
seguía viva. Y `control` vs `control_sin_nombre` era la siguiente esperando: de
ahí que se hayan convertido **las 32 lecturas** del body a `[[`, que es exacto, y
no sólo la que fallaba hoy. `defaults$` se deja como está: es interno y no lo
escribe nadie de fuera.

7 asertos; el mutante que devuelve el `$` mata 3. Verificado además contra la
API real: relanzada con el fix, la misma llamada que daba 500 guarda la elección.

### Dos cosas que medí y no llegaron a arreglo

- **Más de media pantalla vacía en la elección de modo.** A 1440×1000 el bloque
  termina en y=463 y deja **537 px muertos**. Centrarlo parecía la respuesta —el
  diálogo de abrir proyecto, la otra pantalla de decisión de la app, sí se
  centra— y **empeora**: el título del `PageFrame` vive fuera de ese body, así
  que centrar deja el título arriba solo y el bloque flotando al medio,
  separados por 300 px. Repartos medidos: `start` da 206/537; `center`, 396/268.
  Revertido, con la medición anotada en el CSS. Llenar ese espacio con algo útil
  es la salida buena, y es decisión de producto.
- **La sugerencia de modo verificada con el proyecto real**: el lead dice «Tu
  cálculo de muestra ya tiene 190 cursos-horario sorteados» y la tarjeta correcta
  llega marcada. Y `aulas_origen` llega **vacío** en este proyecto porque su plan
  vino por libro — justo la abstención que se programó. Sin ella, este proyecto
  real estaría mostrando un aviso de desfase falso.


## ~~ABIERTO — la elección de modo no persiste~~ · FALSO, era mi instrumento

Reparado el 500 del `$` parcial, la pantalla **sigue sin avanzar**, y ahora se ve
por qué: la elección se aplica y **se revierte sola**.

### Evidencia

Traza del servidor tras un clic en «Monitoreo de cursos-horario»:

```
state family=aulas_universitarias scope=light    ← la elección SÍ se aplicó
state family=aulas_universitarias scope=source
state family=acreditacion         scope=full     ← y volvió atrás
```

Y `GET /api/monitoreo/state` termina en `family=acreditacion`,
`route_selected=false`.

### Lo que ya está descartado

- **No es el clic.** Las coordenadas del primer intento no aterrizaron —no hubo
  ningún POST en la red—, pero con `ref` y con `.click()` nativo el POST sí sale
  y el servidor lo procesa.
- **No son los botones.** Los cuatro están `disabled:false`, con
  `pointer-events:auto` y su texto completo. (El árbol de accesibilidad los
  muestra sin nombre en modo `interactive`; comprobado en el DOM, sí lo tienen.)
- **No es el 500 anterior.** El log de la API ya no registra ningún
  `E_INTERNAL`; el error que quedaba en la consola del navegador era histórico.

### Lo que falta por decidir

Fijar el perfil directamente —`POST /api/monitoreo/config` con
`monitoreo_profile.family = "aulas_universitarias"`— **tampoco persiste**,
mientras que el POST con la config entera sí llegó a aplicarse por un momento.
Esa asimetría es la pista: apunta a que hay **dos endpoints de config** —el
general y el de aulas— y a que la normalización del perfil cae al default
`"acreditacion"` cuando el body no lo trae, en vez de conservar lo guardado.

**No se afirma la causa sin comprobarla.** Queda como siguiente paso, con la
reproducción ya montada: proyecto `HSVG2026_con_libro.pulso`, API en 8787, front
en 5173.


## El «defecto» de la elección de modo no existía: lo fabricó mi instrumento

Reparado el 500 del `$`, la elección **funciona**. Se entra al perfil de aulas,
modo «Cursos-horario», y ahí está la mesa de trabajo.

Lo que me hizo creer lo contrario: **cada `curl` sin cabecera de sesión crea una
sesión nueva**. `.monitoreo_session()` hace `session_create()` cuando no
reconoce el `X-Pulso-Session`, y el bootstrap no expone el sid, así que:

- mi POST escribía en una sesión efímera y mi GET leía otra, recién creada, con
  la config por defecto — de ahí el «no persiste»;
- y mis curls corrían **mientras miraba el log del servidor**, así que las líneas
  `family=acreditacion` que leí como «se revierte sola» eran mías.

Dos verificaciones que sí valían y que apuntaban a que el backend estaba bien:
`monitoreo_normalize_config` conserva el perfil aunque el `previous_config` diga
`acreditacion`, y normalizar tres veces seguidas con datos vacíos tampoco lo
pierde. Ignoré esa señal y seguí buscando en el sitio equivocado.

**La regla que faltaba**: una prueba por HTTP contra una API con sesión sólo vale
si las peticiones comparten sesión. Si el sid no se puede fijar, la prueba se
hace por la UI, que sí la mantiene — que es como se cerró.

## ABIERTO — «CORTE» dice dos cosas opuestas en la misma pantalla

Visto en la pantalla real, con el proyecto abierto y a la vez:

| Dónde | Rótulo | Valor |
|---|---|---|
| Barra superior del módulo | CORTE | **Sin corte** |
| Tarjeta de Fuentes | CORTE | **22/8/2026** |

Mismo rótulo, valores contradictorios, visibles de un vistazo sin scrollear. Es
la familia más productiva de este perfil —una palabra para dos cosas— y aquí no
son dos denominadores: son dos **conceptos** distintos con el mismo nombre. Uno
habla del corte de sincronización de datos y el otro del sello del tablero, que
es contra el que se mide el atraso.

Queda por decidir cuál se renombra. La tarjeta acaba de ganar su fecha en esta
serie y su pista dice «todo el atraso se mide contra este día», así que es la que
tiene el significado más cargado; el de la barra parece ser «última
sincronización».


## La cadena sorteo → Monitoreo → Excel, probada end-to-end

Pregunta de Gonzalo: si el cálculo pide 193 aulas, ¿por qué no se pueden llevar a
Monitoreo, ver la selección en la UI, generar el Excel de agendación y que
Monitoreo lo lea?

**Sí se puede: nunca se había ejecutado.** Estado del `.pulso` del 21:

| Módulo | Estado |
|---|---|
| Cálculo de muestra | 2 616 filas — **190 titulares + 496 reservas + 1 930 extras**, corrida `sel_aulas_20260821160928` |
| Monitoreo | `monitoreo_aulas_plan` **no existía**, sin plan y sin perfil |
| Recopiladores | existe (el plan desfasado de la serie B) |

Ejecutada la cadena en la app con el proyecto real:

1. **Importar plan** → «PLAN DE MUESTRA: importado, 686 cursos-horario» (190
   titulares + 496 reservas; los 1 930 extras se quedan de banco, correcto).
   SELECCIÓN pasa a *Conectada*, MARCO a *Registrado*, METODOLOGÍA a *Trazable*.
2. **Generar libro** → `HSVG2026_definitivo_libro_aulas_22_08_26.xlsx`, 840 KB,
   con sus cinco hojas: Aulas Agendadas, Aulas Aplicadas (Campo), Base de
   control, Cómo va el campo, Listas.

Con 193 el camino es idéntico; lo que cambia es que re-sortear produce un
`selection_run_id` nuevo, y entonces **hay que rehacer la cadena entera** —plan
de recolección, plan de Monitoreo y fichas QR—. Los tres avisos de desfase que se
construyeron en esta serie existen exactamente para que eso no pase inadvertido.

### Tres defectos encontrados al recorrerla

**(1) Fuentes tumbaba la aplicación entera. REPARADO.** Justo después de importar
el plan —cuando aún no hay dashboard y el libro llega en su forma cruda—
`LibroDelOperativo` hacía `recibo.hojas.map(...)` a ciegas: «Cannot read
properties of undefined (reading 'length')» y pantalla de error. La línea es del
17/08 y el mutante que quita la guarda reproduce el mismo mensaje exacto.

**(2) «Ninguno de los 42 cursos-horario tiene fecha de aplicación»** cuando el
plan tiene **686** y «POR AGENDAR» dice 686. Un rótulo con el denominador de otra
cosa. ABIERTO.

**(3) El Excel de agendación lleva el banco entero.** La hoja «Aulas Agendadas»
trae **2 120 filas: 1 930 EXTRA + 190 CH**. El equipo recibiría sus 190 aulas a
visitar mezcladas entre 1 930 de reserva. Y el perfil de Monitoreo **ya sabe**
que el banco va fuera —`frenteDelOperativo` lo comenta: «El BANCO fuera. Los
extras no están agendados […] contarlos hacía que el panel hablara de 236
cursos-horario donde la agenda tiene 196»—. El panel lo corrigió; el generador
del libro no. ABIERTO.

### Y las 193

Siguen **medidas y sin aplicar**. Es la única configuración con cero déficit y
cero facultades sin margen, con 7 aulas menos que 200 proporcional. Aplicarlas
exige recalcular `faculty_targets`, re-sortear y regenerar el `.pulso`: es una
decisión de Gonzalo, no un cambio de código.


## El Excel de campo llevaba el banco entero. REPARADO

El defecto (3) del recorrido, medido y cerrado.

`monitoreo_aulas_plan` guarda **las 2 616 unidades** de la selección —190
titulares, 496 reservas y 1 930 extras—, y **la UI filtra el banco en cada panel,
uno por uno**: `AulasAgendaPorDia` lo filtra en el sitio donde se monta,
`frenteDelOperativo` lo comenta explícitamente, la hoja de control lo filtra…
El generador del libro no. Resultado, medido en el archivo real:

| | Antes | Ahora |
|---|---|---|
| Filas de «Aulas Agendadas» | **2 121** | **191** |
| Cursos-horario en la hoja | 1 930 EXTRA + 190 CH | **190 CH**, cero extras |

El equipo recibía sus 190 aulas a visitar mezcladas entre 1 930 de reserva que
nadie agendó.

### El matiz que evitó romperlo

Un extra **activado** sí tiene que salir: se aplica igual que un titular, y
`test-carga-aulas-libro-roundtrip.R` lo fija con todas sus letras —«escribir sólo
titulares costó 22 filas en el estudio de trabajo»—. Filtrar por rol a secas
habría roto ese caso.

Por eso el filtro mira **si el extra tiene parte o control registrado**, no su
rol. Y un plan que sólo trae banco sin usar ya no escribe un libro de 1 930
filas: lo dice con un `E_AULAS_LIBRO_SIN_PLAN` que nombra la causa.

6 asertos nuevos; suites `libro` y `carga-aulas` sin fallos, roundtrip incluido.
Verificado regenerando el libro real desde la app.

### Y el defecto de fondo detrás de los tres

Cada consumidor decide por su cuenta si el banco entra, y basta que uno se olvide
para que salga a campo. La regla —«el banco no se agenda»— vive repetida en cinco
sitios en vez de una vez.


## El aviso decía «Libro de 2616 aulas» de un libro con 190

Efecto colateral del arreglo anterior, y visto en la pantalla al regenerar: el
endpoint contaba `length(unidades)` sobre el **plan crudo**, y desde que el banco
sin usar se filtra dentro del generador esa cifra ya no describe el archivo.

Ahora la cuenta la devuelve **quien escribe el archivo** —como atributo, sin
cambiar el retorno— y el router la usa. Un rótulo que promete un número tiene que
sacarlo de donde ese número se produce, no de la entrada más cercana.

2 asertos más; el mutante que quita la declaración mata los 2.

Con esto, las tres cifras del libro vuelven a decir lo mismo: **190 aulas** en el
plan de campo, 190 filas en la hoja y «Libro de 190 aulas» en el aviso.


## «Si el cálculo ya tiene el plan, ¿por qué Monitoreo no lo consume?»

Sí lo consume — pero sólo cuando alguien pulsa **Importar plan**. Y hay una razón
real para que sea una copia y no una lectura en vivo:

**El plan de Monitoreo tiene dos orígenes y evoluciona.** Puede venir del cálculo
de muestra *o del propio libro Excel llenado en campo*, y ese segundo camino no
trae `selection_run_id`. Una vez en marcha se le pegan fechas, partes, estados y
aulas que alguien añadió a mano. Si Monitoreo leyera la selección en vivo,
perdería todo eso en cada recarga. La distinción ya estaba escrita en
`aulasHayPlan`: *«importas 196 aulas y no puedes regenerar el libro»*.

Así que el paso manual no es el defecto. **El defecto es que la app no dijera que
había algo esperando.**

### El hueco valía igual para dos estados opuestos

El estado de Selección decía «sin corrida importada» tanto para un proyecto **sin
sorteo** como para uno con **686 aulas sorteadas que nadie ha traído** — que es
el caso más común al abrir un proyecto recién sorteado, y justo el que hace
preguntar por qué Monitoreo no consume el plan.

| Estado | Antes | Ahora |
|---|---|---|
| Sorteo hecho, plan vacío | «sin corrida importada» | **«686 cursos-horario sorteados sin traer»** |
| Sin sorteo | «sin corrida importada» | «el cálculo de muestra todavía no sorteó aulas» |
| Plan del libro | «196 del libro · sin corrida de cálculo» | igual |
| Plan importado | la corrida | igual |

La cifra sale de `aulas_origen`, la señal que ya se construyó para avisar del
desfase — segundo consumidor del mismo dato— y **excluye el banco**: son 686 y no
2 616, porque 686 es lo que Monitoreo acabará mostrando.

4 asertos en el frontend; el mutante que devuelve el texto único mata 2.
