# Checklist — monitoreo de aulas, dictado de Gonzalo del 2026-09-10

Nueve indicaciones de un mismo dictado. Cada una con **dónde vive** y su estado.
Sólo Gonzalo lo da por terminado.

| # | Indicación (suya) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «No sé para qué sirven finalmente los botones rojos… ¿cuál es la diferencia entre ambos?» | `AulasMonitoreoPage.tsx` (`advanceTitle`, `refreshTitle`, `syncField`) | ◐ contestado abajo; falta decidir si la pantalla lo dice sin hover |
| 2 | «El selector de facultades del encabezado… debería ser un botón que sólo esté en Resumen, no en las demás pestañas» | `AulasSelectorDeFacultad` en la cabecera de `AulasMonitoreoPage.tsx` | ☐ |
| 3 | «Sigue saliendo fail page, lo cual me da a entender de que algo está fallando» | por diagnosticar | ☐ falta reproducirlo: no se sabe en qué pantalla ni con qué acción |
| 4 | «A quién hay que agendar… no entiendo en base a qué te basas» + «hay facultades que todavía no terminan de agendar los titulares» | `AulasAlertaDeAnticipacion` | ☐ |
| 5 | «Tampoco me estás diciendo cuántos reemplazos ya se aplicaron y qué tipo de reemplazos» | motor: `sample_role` + `replacement_reason` | ☐ |
| 6 | «El estado de aplicación, no entiendo por qué en reserva hay 1 169» | `AulasEstadoChart` | ◐ medido abajo; falta que la pantalla lo explique |
| 7 | «En cada curso-horario contra su propio margen… mostrarlos por facultad, y poder escoger entre los aplicados, los titulares, o el reemplazo uno con el reemplazo dos» | `AulasSenalesPorAula` + `senalesPorAula.ts` | ☐ |
| 8 | «La pregunta principal es identificar qué tan bien o mal nos está yendo respecto a lo planeado… y cuándo sería necesario solicitar un aula adicional» | pestaña Efectividad | ☐ |
| 9 | «Con una o dos aulas eso no es suficiente base… pero cuando ya empezamos a tener una porción importante de las aulas aplicadas y vemos que no vamos a llegar, poder avisarte a tiempo» | ídem, es la condición de disparo de (8) | ☐ |

## Lo ya contestado, con su medición

### 1 · Qué hace cada botón rojo

Leído en el código, no supuesto:

- **«Traer respuestas»** hace DOS cosas, en este orden: pide a la plataforma
  (Kobo) las respuestas nuevas —es un job, `/monitoreo/sync` con
  `syncMode: "advance"`— y después recalcula el corte de campo con
  `/aulas/sync`. Si la descarga falla, el recálculo se hace igual y el motivo
  sale como aviso. **No toca el Sheets.**
- **«Avance»** NO trae nada. Abre la sección Avance y la recalcula con lo que el
  proyecto ya tiene en memoria. Su propio `title` lo dice: «no pide nada a la
  plataforma».
- **El Sheets no está en ninguno de los dos.** Leer el libro y publicar en él
  viven en **Agenda** (leer del libro / publicar) y en **Salidas**. Son tres
  canales distintos con tres botones distintos, y ahora mismo la pantalla no
  dibuja esa separación en ningún sitio.

### 6 · Por qué hay ~1 169 en reserva

Medido sobre `HSVG26ULT2_armado_2026-09-09.pulso` (`<scratchpad>/reserva.R`):

```
filas del plan: 1 392
  titular              174
  chain_reserve      1 173
  extra_reserve_pool    45
```

O sea: **cada titular arrastra unas 6,7 reservas de cadena**, y las 1 173 están
en el plan aunque casi ninguna se vaya a usar nunca. El «1 169» de la pantalla
son esas mismas menos las que ya se activaron. No es un error de conteo: es el
tamaño del respaldo que dejó el sorteo, y lo que falta es que el panel lo diga
en vez de plantar la cifra.
