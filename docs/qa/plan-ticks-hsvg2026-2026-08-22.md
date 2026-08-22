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
| B1 | Export de aulas → Monitoreo | que las 190 llegan con su código operativo y su estrato | ☐ |
| B2 | Export → fichas QR | que cada ficha lleva el identificador que el campo va a escanear | ☐ |
| B3 | Ida y vuelta | sortear, exportar, leer: ¿coincide el conteo? | ☐ |
| B4 | Reemplazos en el export | ¿viajan las reservas y su orden de uso? | ☐ |

### Serie C — El sheets de monitoreo

| # | Tick | Qué verifica | Cerrado |
|---|---|---|---|
| C1 | Generación del sheets | qué columnas produce y si bastan para el control | ☐ |
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
