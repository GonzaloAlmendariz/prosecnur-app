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
| 10 | «Hay que tener la terminología clara en el estado de aplicación» — su taxonomía completa, abajo | `estadoDeAplicacion.ts` + motor | ☐ |
| 11 | «No entiendo lo de en cierre» | `estadoDeAplicacion.ts:85` | ☐ es un rótulo que inventamos aquí, no del operativo |
| 12 | «En el rendimiento por curso-horario tiene que considerar también que debe medirlo sólo aquellos que han sido aplicados» | `rendimientoPorFacultad.ts` | ☐ |
| 13 | «No estás tomando en cuenta mi artefacto donde dejé varios gráficos a utilizar, como el avance diario» | `<scratchpad>/resumen.html` | ☐ ver el cotejo abajo |

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

## 10 · La terminología del estado de aplicación, TEXTUAL

Dictado del 2026-09-10. Se transcribe literal porque parafrasearlo es
exactamente cómo se pierde una definición del operativo:

> «Tenemos **titulares sin agendar**, tenemos **titulares rechazados**, tenemos
> **titulares aplicados**, tenemos **reemplazos utilizados**, tenemos
> **reemplazos disponibles o reemplazos al aire**, ¿no?, que son los que nunca
> se utilizaron. Tenemos **reemplazos que están en cadena**, es decir, aquellos
> reemplazos que todavía pueden ser factibles o se pueden utilizar. No entiendo
> lo de **en cierre**, pero sí habría que ver ahí bien. Y también tenemos
> **reemplazos de refuerzo**, o reemplazos que sirven para reforzar un aula, o
> **reemplazos complementarios**, que son aulas extra que cogemos. Además de que
> algunas facultades tienen el término **aulas extra** también.»

**Lo que esto cambia de raíz.** Hoy «Estado de aplicación» es UN eje plano de
siete tramos —Sin agendar · Agendado · En aplicación · En cierre · Reemplazado ·
En reserva— que mezcla tres cosas distintas: el estado de agendamiento, el ROL
en el sorteo (una reserva no está «sin agendar»: es que no se agenda) y el
desenlace. Por eso las 1 169 caen todas en un solo cajón que no dice nada.

Él piensa en **rol × estado**, que es otra estructura:

| Su término | Rol del sorteo | Estado |
|---|---|---|
| titulares sin agendar | `titular` | sin fecha |
| titulares rechazados | `titular` | rechazado |
| titulares aplicados | `titular` | aplicado |
| reemplazos utilizados | `chain_reserve` | activado / aplicado |
| reemplazos en cadena | `chain_reserve` | vivo, todavía puede usarse |
| reemplazos disponibles o «al aire» | `chain_reserve` | ya no se usarán: su titular se resolvió |
| reemplazos de refuerzo | ¿? | refuerzan un aula ya aplicada |
| reemplazos complementarios / aulas extra | `extra_reserve_pool` | banco de extras |

**Dos huecos que hay que resolver antes de dibujar nada**, y son preguntas para
él, no decisiones mías:

1. **«Reemplazo de refuerzo»** no existe como rol en el motor. Los roles son
   `titular`, `chain_reserve` y `extra_reserve_pool`. Hay que saber si un
   refuerzo es un extra usado sobre un aula que YA se aplicó, o una figura
   nueva.
2. **«En cierre»** es un rótulo que se inventó aquí —sustituyó a «Cumple»— y él
   no lo reconoce. El motor define ese tramo como `aplicada|cerrada` **o**
   `validas >= meta`. O se renombra con una palabra del operativo, o el tramo se
   disuelve dentro de «titulares aplicados».

## 13 · Qué del artefacto de Resumen está y qué no

Cotejado contra `<scratchpad>/resumen.html`, que tiene CUATRO bloques:

| Bloque del artefacto | En la app | Estado |
|---|---|---|
| **Respuestas** | `AulasResumenRespuestas` | ☑ montado |
| **Avance diario** — barras de efectivas del día en su eje y **línea de acumulado en el suyo** | `AulasRitmoDiario` | ◐ el dato está (`{fecha, validas, acumulado}`) pero el acumulado se enseña como CIFRA en una celda, no como la línea del boceto |
| **Curso horario** — una barra de seis tramos | `AulasEstadoChart` | ◐ partido en dos barras por legibilidad; y el ítem 10 lo va a rehacer entero |
| **Rendimiento de los cursos-horario APLICADOS** — seis cortes | `AulasCoberturaChart` | ◐ el título del boceto ya decía «aplicados» y el panel no filtra por eso: es el ítem 12 |

O sea que tiene razón en los dos: el «avance diario» del boceto no está dibujado
como lo dibujó él, y el «sólo aplicados» estaba escrito en el título de su propio
boceto desde el 2026-09-09.
