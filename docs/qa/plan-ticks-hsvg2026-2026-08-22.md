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
| A1 | Sortear con **190** aulas | línea base: score, celdas sin reserva de perfil, reservas por titular | ☐ |
| A2 | Sortear con **195** | lo mismo, y cuánto cambia por 5 aulas más | ☐ |
| A3 | Sortear con **200** | ídem; ¿la cuota por facultad mejora o sólo sube el costo? | ☐ |
| A4 | **190 con ajustes** (profundidad, tolerancia) | qué ajuste mejora sin subir n | ☐ |
| A5 | **192 con ajustes** | el punto intermedio que Gonzalo señaló | ☐ |
| A6 | Tabla comparada de las cinco corridas | **cuál minimiza el uso esperado de reemplazos** | ☐ |
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
