# Checklist — monitoreo de aulas, dictado de Gonzalo del 2026-09-10

Nueve indicaciones de un mismo dictado. Cada una con **dónde vive** y su estado.
Sólo Gonzalo lo da por terminado.

| # | Indicación (suya) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «No sé para qué sirven finalmente los botones rojos… ¿cuál es la diferencia entre ambos?» | `AulasMonitoreoPage.tsx` (`advanceTitle`, `refreshTitle`, `syncField`) | ◐ contestado abajo; falta decidir si la pantalla lo dice sin hover |
| 2 | «El selector de facultades del encabezado… debería ser un botón que sólo esté en Resumen, no en las demás pestañas» | `mandoDeFacultad.ts` | ☑ `a8d903a8` |
| 3 | «Sigue saliendo fail page, lo cual me da a entender de que algo está fallando» | por diagnosticar | ☐ falta reproducirlo: no se sabe en qué pantalla ni con qué acción |
| 4 | «A quién hay que agendar… no entiendo en base a qué te basas» + «hay facultades que todavía no terminan de agendar los titulares» | `AulasAlertaDeAnticipacion` | ☐ |
| 5 | «Tampoco me estás diciendo cuántos reemplazos ya se aplicaron y qué tipo de reemplazos» | motor: `sample_role` + `replacement_reason` | ☐ |
| 6 | «El estado de aplicación, no entiendo por qué en reserva hay 1 169» | `AulasEstadoChart` | ◐ medido abajo; falta que la pantalla lo explique |
| 7 | «En cada curso-horario contra su propio margen… mostrarlos por facultad, y poder escoger entre los aplicados, los titulares, o el reemplazo uno con el reemplazo dos» | `AulasSenalesPorAula` + `senalesPorAula.ts` | ☐ |
| 8 | «La pregunta principal es identificar qué tan bien o mal nos está yendo respecto a lo planeado… y cuándo sería necesario solicitar un aula adicional» | pestaña Efectividad | ☐ |
| 9 | «Con una o dos aulas eso no es suficiente base… pero cuando ya empezamos a tener una porción importante de las aulas aplicadas y vemos que no vamos a llegar, poder avisarte a tiempo» | ídem, es la condición de disparo de (8) | ☐ |
| 10 | «Hay que tener la terminología clara en el estado de aplicación» — su taxonomía y las situaciones A/B/C, abajo | `monitoreo_aulas_rol_y_estado.R` + `AulasEstadoChart` | ◐ motor hecho (`a69a0c42`, 23 tests); falta la pantalla |
| 11 | «No entiendo lo de en cierre» → «disuélvelo dentro de titulares aplicados» | `estadoDeAplicacion.ts` | ☑ `46bf5693` |
| 12 | «En el rendimiento por curso-horario tiene que considerar también que debe medirlo sólo aquellos que han sido aplicados» | motor: `monitoreo_aulas_universitarias.R` | ☑ `158c56bc` — repartía 219 y sólo 45 se habían aplicado |
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

### Las tres situaciones de reemplazo, A · B · C (textual, 2026-09-10)

Contestó el hueco 1 sin que hiciera falta preguntarlo dos veces:

> «La situación **a** era **el reemplazo literal**. **b** era una situación donde
> un aula no llegaba a donde se requería y se necesitaba su reemplazo para
> **complementar**. Y **c**, que en general necesitábamos más aulas y llamábamos
> a **cualquier reemplazo disponible, que estuviera al aire**.»

> «Yo pensaba que ya había un mecanismo dentro de la aplicación que te permitía
> reconocer eso. E incluso, si te das cuenta, **en el Sheets hay una columna con
> estados de aplicación** que también te permite identificar eso —entre efectiva,
> efectiva de refuerzo, no estoy seguro—, pero **ahí en el Sheets te recomiendo
> que también te guíes de los estados del Sheets, porque la idea es que ambos
> hablen el mismo idioma** de alguna u otra forma.»

O sea que las tres NO son tres roles del sorteo: son tres **motivos de
activación** de un reemplazo, y el rol (`chain_reserve` / `extra_reserve_pool`)
es otra dimensión:

| | Qué pasó | Qué se activa |
|---|---|---|
| **A** | el titular cayó | su reserva de cadena, en orden |
| **B** | el aula se aplicó y **no llegó** a lo que se le pedía | un reemplazo que **complementa** — es el «refuerzo» |
| **C** | falta volumen en general | **cualquiera** que esté disponible «al aire» |

**Y el idioma manda desde el Sheets, no desde aquí.** Su instrucción es explícita:
la columna de estados de aplicación del libro ya distingue estos casos («efectiva»,
«efectiva de refuerzo»…) y la app tiene que hablar ese idioma. **Antes de dibujar
nada del ítem 10 hay que LEER los valores reales de esa columna** —los distintos,
con su frecuencia— y construir el vocabulario sobre ellos. Inventar aquí una
taxonomía paralela es exactamente lo que él está pidiendo que no pase.

### La regla de fondo: AL CURSO-HORARIO SE VA UNA SOLA VEZ

Contestó lo de «en cierre» —«disuélvelo dentro de titulares aplicados»— y luego
dio el porqué, que vale más que la decisión:

> «Al aula no se puede ir dos veces. Por más que un aula esté incompleta, hay que
> avisar que no se llegó —para eso tenemos el rendimiento de los cursos
> aplicados—, pero no vamos a volver a ir. Aula que se aplica es un aula que se
> aplica, no es que está en proceso, no es que está poco a poco, que vamos a ir
> una vez y luego otra vez, y por eso está como en constante aplicación. No. Al
> curso-horario se va una sola vez.»

**Esto tiene consecuencias más allá del rótulo, y hay que revisarlas una por
una:**

- Cualquier estado que sugiera «en curso», «parcial» o «poco a poco» sobre un
  curso-horario está describiendo algo que no pasa. Ya cayó «En cierre» /
  «En aplicación» (`46bf5693`); **queda por revisar `STATUS_LABELS`**, que
  todavía tiene `cerrando: "Cierre en curso"`, `en_aplicacion: "En aplicación"`
  y `parcial: "Parcial"`. OJO: esos rótulos también traducen valores de
  `operational_status` que vienen del SHEETS, así que no se tocan hasta leer la
  columna real (ítem 10).
- Un aula aplicada que se quedó corta **no se reintenta**: se avisa. Eso es
  exactamente lo que el ítem 12 acaba de arreglar y lo que el ítem 8 tiene que
  convertir en «pide un aula adicional».

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

## 10 · LEÍDO EL SHEETS: qué dice de verdad la columna de estados

Medido el 2026-09-10 sobre el libro `11HV4…VtRPc` (`<scratchpad>/estados3.R`).
**Sólo lectura**: no se escribió nada en ninguna pestaña del equipo.

La hoja **«Aulas Aplicadas (Campo)»** está partida en **bloques por rol**, y cada
bloque repite sus ~38 columnas:

```
TITULAR | REEMPLAZO 1 | REEMPLAZO 2 | … | REEMPLAZO 11
```

Cada bloque trae su propia columna **`STATUS DE APLICACIÓN`**, y esto es lo que
hay hoy:

| Bloque | Valores |
|---|---|
| TITULAR | **APLICADA 58** · **NO APLICADA 1** |
| REEMPLAZO 1 | **APLICADA 1** |
| REEMPLAZO 2 … 11 | vacías |

Y en «Aulas Agendadas», los otros dos ejes de estado:

| Columna | Valores |
|---|---|
| `STATUS MUESTRA` | AGENDADA 141 · EN CONTACTO 25 · REAGENDADA 4 · RECHAZO 4 |
| `STATUS DE LLAMADA` | Efectiva 64 · Contactado por WhatsApp 45 · No contesta 13 · Número no existe 10 · Apagado 9 · Contactar después 8 · Número fuera de servicio 7 · Rechazo 4 |

### Tres conclusiones, y una hay que decírsela

1. **La estructura que él quiere ES la del Sheets.** «Rol × estado» no hay que
   inventarlo: el libro ya lo tiene como BLOQUE (titular / reemplazo n) ×
   `STATUS DE APLICACIÓN`. El panel tiene que copiar esa forma.
2. **«Efectiva de refuerzo» NO existe todavía en esa columna.** Hoy sólo hay
   `APLICADA` y `NO APLICADA`. Él lo dijo con duda —«no estoy seguro»— y tenía
   razón en dudar. Las tres situaciones A/B/C **no están registradas en ningún
   sitio del libro**: si el operativo quiere distinguirlas, hay que añadir la
   distinción a la hoja, y eso es decisión suya y del equipo. La app no puede
   inferir un motivo de activación que nadie escribió.
3. **«Efectiva» sí existe, pero en `STATUS DE LLAMADA`** y significa otra cosa:
   que la llamada al docente salió bien. Si el panel usara esa palabra para
   aplicaciones estaría cogiendo el vocabulario del eje equivocado.

### TRES cifras distintas para «aplicados» — SIN RESOLVER

- El Sheets dice **59** (58 titulares + 1 reemplazo con `APLICADA`).
- La banda de KPIs de la app dice **52**.
- Los partes de campo del `.pulso` son **46**.

Tres números con el mismo nombre. Medido el 2026-09-10 con
`<scratchpad>/tres_cifras.R`, que cruza la hoja con el `.pulso` código a código:

**De dónde sale cada uno**

- **46** son los partes de campo del `.pulso` armado el 09/09. Es una FOTO: el
  equipo siguió escribiendo en la hoja después.
- **52** es el KPI del motor, y no cuenta partes: cuenta la UNIÓN de
  `operational_status ∈ {aplicada, cerrada}`, `application_status = aplicada` y
  «tiene respuestas válidas». Está declarado así a propósito —«el parte lo rinde
  el encargado de campo cuando puede y en la primera semana llega tarde; las
  respuestas llegan solas»— y por eso es mayor que 46 sobre la misma foto.
- **59** son las marcas `APLICADA` de la hoja HOY, sobre **58 códigos
  distintos**.

O sea que las tres no son tres definiciones en conflicto: son **una foto, una
unión y un dato vivo**. Lo que sí hay que arreglar es que la pantalla no dice
cuál de las tres está enseñando.

**Y el cruce destapó cuatro cosas de la hoja, que son operativas y suyas:**

1. **CH 14 está DUPLICADO** en el bloque TITULAR: dos filas, las dos marcadas
   `APLICADA` con fecha 09/09/2026. Como al curso-horario se va una sola vez, es
   un duplicado, no dos visitas — y cuenta dos veces.
2. **Una marca `APLICADA` sin FECHA DE APLICACIÓN.**
3. **Una con fecha `09/08/2026`** — agosto. Casi seguro un 09/09 mal tecleado;
   el operativo empezó el 07/09.
4. **Quince cursos-horario están `APLICADA` en la hoja y no tienen parte en el
   `.pulso`**: CH 4, 8, 11, 14, 30, 37, 52, 80, 95, 121, 125, 135, 149, 170,
   171. Es el desfase esperable entre la hoja viva y la copia del 09/09.
5. **Y tres al revés: tienen parte en el `.pulso` y NO están marcados `APLICADA`
   en la hoja: CH 82, CH 111 y CH 131.** Dos de esos tres —CH 82 y CH 111— son
   exactamente los que tienen la hora de madrugada que no cuadra ni leída como
   tarde. Que los mismos dos aparezcan en los dos hallazgos no parece
   casualidad: hay algo raro en cómo se registraron esos partes.
