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
| 6 | «El estado de aplicación, no entiendo por qué en reserva hay 1 169» | `AulasEstadoPorRol` | ☑ `aef557e2` — el cajón se parte en «en cadena» y «al aire» |
| 7 | «En cada curso-horario contra su propio margen… mostrarlos por facultad, y poder escoger entre los aplicados, los titulares, o el reemplazo uno con el reemplazo dos» | `AulasSenalesPorAula` + `senalesPorAula.ts` | ☐ |
| 8 | «La pregunta principal es identificar qué tan bien o mal nos está yendo respecto a lo planeado… y cuándo sería necesario solicitar un aula adicional» | pestaña Efectividad | ☐ |
| 9 | «Con una o dos aulas eso no es suficiente base… pero cuando ya empezamos a tener una porción importante de las aulas aplicadas y vemos que no vamos a llegar, poder avisarte a tiempo» | ídem, es la condición de disparo de (8) | ☐ |
| 10 | «Hay que tener la terminología clara en el estado de aplicación» — su taxonomía y las situaciones A/B/C, abajo | `monitoreo_aulas_rol_y_estado.R` + `AulasEstadoPorRol` | ☑ `a69a0c42` motor + `aef557e2` pantalla · falta MIRARLO y falta A/B/C, que no está en el libro |
| 11 | «No entiendo lo de en cierre» → «disuélvelo dentro de titulares aplicados» | `estadoDeAplicacion.ts` | ☑ `46bf5693` |
| 12 | «En el rendimiento por curso-horario tiene que considerar también que debe medirlo sólo aquellos que han sido aplicados» | motor: `monitoreo_aulas_universitarias.R` | ☑ `158c56bc` — repartía 219 y sólo 45 se habían aplicado |
| 13 | «No estás tomando en cuenta mi artefacto donde dejé varios gráficos a utilizar, como el avance diario» | `AulasAvanceDiario` | ☑ `b3380cdd` + `b0839a50` (ancho y ejes) |
| 14 | «El avance diario tiene que verse mejor de manera horizontal» | `AulasAvanceDiario` | ☑ `b0839a50` |
| 15 | «Tiene que haber un hover por cada barra» | `AulasAvanceDiario` | ☐ |
| 16 | «Tiene que estar alineado con el gráfico de abajo, de cuándo se termina de aplicar el plan… los días del eje x tienen que alinearse con el ritmo de recolección» | `ejeDeDias` + los dos gráficos | ◐ el ritmo ya va del arranque al cierre previsto (`d326513a` + `7039aac6`); falta que el PRONÓSTICO use el mismo eje de fechas |
| 17 | «Los días en el eje x no se ven bien» | ambos | ◐ el ritmo ralea rótulos (`7039aac6`); falta el pronóstico |
| 18 | «Ahorita se ve vacío el ritmo de la recolección… hay días que todavía no hemos aplicado, pero pueden ponerse de todas formas para que se complete el gráfico» | `AulasAvanceDiario` | ☑ `7039aac6` — falta MIRARLO |
| 19 | «Verificar cuándo se termina de aplicar el plan: ¿estamos viendo cuándo se va a terminar de aplicar lo agendado, o cuándo vamos a llegar a la meta?» | `AulasPronosticoDeCierre` | ☐ son dos preguntas y hay que saber cuál contesta |
| 20 | «Utilicemos el archivo original… cargar las respuestas o actualizar la información a día de hoy y ver cómo se está viendo todo en el campo actual» | backend 8798 | ☑ hecho el 10/09 08:44 · 1 176 → **1 245** registros |
| 21 | «El selector de facultad del encabezado no hace que los gráficos actualicen… cuando yo selecciono una facultad, debería mostrarme sólo la de esa facultad… todos los demás gráficos se deben acomodar a ello» | los 9 paneles de Resumen | ☐ **contradice el contrato actual: hoy RESALTA y él quiere FILTRAR** |
| 22 | «En cursos por cobertura, no entiendo por qué la categoría sin respuesta sigue… si es necesario tenerla ahí, la dejamos» | `AulasCoberturaChart` | ☐ se queda, pero tiene que explicarse |
| 23 | «No entiendo lo del cumplimiento por aula, no entiendo por qué hay una meta de 3 233… no entiendo eso de cuántas cumplen meta, cuántas faltan» | `AulasAvanceEnRespuestas` | ☐ |
| 24 | «No está claro las que hay que agendar, por qué me estás diciendo que hay que agendarlas» | `AulasAlertaDeAnticipacion` | ☐ es el ítem 4, repetido |
| 25 | «No estás resumiendo la información ni de rendimiento ni de efectividad… si Resumen tiene que ser un resumen» | pestaña Resumen | ☐ **el grande de Resumen** |
| 27 | «El pronóstico no es lineal: no depende de que si hoy aplicamos treinta mañana serán treinta. Depende del RITMO DE LA AGENDA» | `pronosticoDeCierre` | ☐ **cambia el modelo, no el gráfico** |
| 28 | «Es muy importante tener en Resumen cómo va la agendación de aulas, porque es lo que nos permite decir a estas aulas vamos a ir a aplicar, y eso está en el Sheets» | Resumen | ☐ |
| 29 | «Ni la agendación ni las metas son lineales: dependen de las aulas agendadas y de los esperables de ellas, contrastando el rendimiento planificado con el que vamos encontrando, y ya podemos ir prediciendo para cada facultad cómo nos irá» | `proyeccionDeMetas` + pronóstico | ☐ |
| 30 | «El día nueve había sido el día con mayor cantidad de aplicaciones agendadas y aplicadas, y la tabla no está mostrando eso» | datos | ☑ **tenía razón** — con hoy: 07/09 329 · 08/09 313 · **09/09 466** · 10/09 23 |
| 31 | «Habría que ver Resumen cómo estaría mapeando esto: ¿por aulas, por cuotas, por ambas? Sería bueno tener eso bien definido» | Resumen | ☐ |
| 32 | El seguimiento desgranado POR FACULTAD en Resumen (ver abajo) | Resumen | ☐ **el panel que Resumen necesita** |
| 26 | «Poder hacer clic en un tramo de cobertura y que abajo se muestre, de forma profesional y minimalista, cuáles son esos CH, con el rendimiento del aula, el esperado, los elegibles esperados y los obtenidos» | `AulasCursosDeUnTramo` | ☑ `c17e8780` — falta MIRARLO, y «los que esperábamos ver» necesita reimportar el sorteo |

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

## 14-19 · Los dos gráficos temporales, dictado del 2026-09-10 ~07:40

> «El avance diario tiene que verse mejor de manera horizontal, y algo también
> muy importante es que tiene que haber un hover por cada barra que yo ponga mi
> mouse encima, y tiene que estar alineado con el gráfico de abajo, de cuándo se
> termina de aplicar el plan. Esa de cuándo se termina de aplicar el plan también
> creo que es importante verificar eso: ¿estamos viendo cuándo se va a terminar
> de aplicar lo que tenemos agendado, se está viendo cuándo vamos a llegar a la
> meta? Y además, los días en el eje x no se ven bien, y los días del eje x de
> cuándo se termina de aplicar el plan tienen que alinearse con el ritmo de
> recolección. Y ahorita se ve vacío el ritmo de la recolección: igual entiendo
> que hay días que todavía no hemos aplicado, pero pueden ponerse de todas formas
> para que se complete el gráfico. Pero ahí hay que ver cómo hacer ambos gráficos
> que se entiendan mejor y que se vean más sofisticados.»

**Lo que esto pide, en una frase**: los dos gráficos temporales de Resumen —«Ritmo
de la recolección» y «Cuándo se termina de aplicar el plan»— tienen que compartir
el MISMO eje de días, del arranque del operativo al cierre previsto, y leerse
como dos vistas de la misma línea de tiempo y no como dos dibujos sueltos.

De ahí sale que el ritmo se vea vacío: dibuja sólo los tres días CON respuestas,
mientras el de abajo va del 07/09 al 01/10. Un eje compartido resuelve el hueco
y la alineación a la vez.

## 20 · Trabajar sobre el proyecto original

> «Ahorita estás utilizando copias, que entiendo son copias de seguridad y está
> bien, pero creo que sería bueno que utilicemos el archivo original, porque si
> se supone que ya los botones de traer respuestas son robustos, podríamos
> utilizar el proyecto pulso original, y en ese proyecto pulso original cargar
> las respuestas o actualizar la información a día de hoy, con hora de hoy, y ver
> cómo efectivamente se está viendo todo en el campo actual.»

**Cambia una prohibición anterior.** Hasta ahora la regla era no tocar
`HSVG26ULT2.pulso`; él la levanta para poder ver el operativo de hoy. Sigue en
pie lo que NO cambió: **abrir y traer respuestas no escribe el archivo** —el
`.pulso` sólo cambia al guardar explícitamente— y **publicar a Sheets sigue
necesitando su palabra**.

## 21-25 · Resumen tiene que ser un resumen, dictado del 2026-09-10 ~08:00

> «El selector de facultad que está en el encabezado no hace que los gráficos
> actualicen. Por ejemplo, en respuestas por facultad, cuando yo selecciono una
> facultad, debería mostrarme sólo la de esa facultad. Luego, eso pasa lo mismo
> para todos los demás gráficos: todos los demás gráficos se deben acomodar a
> ello… todos los gráficos de respuestas o de resumen deberían ajustarse al
> selector.»

> «En cursos por cobertura, no entiendo por qué la categoría sin respuesta sigue,
> si se supone que estamos hablando de cursos-horario con respuestas… pero bueno,
> si es necesario tenerla ahí, la dejamos, no pasa nada.»

> «No entiendo lo del cumplimiento por aula, no entiendo por qué hay una meta de
> tres mil doscientos treinta y tres. Francamente, no entiendo eso de cumplimiento
> de cuántas cumplen meta, cuántas faltan. Y también no está claro las que hay que
> agendar, por qué me estás diciendo que hay que agendarlas.»

> «No estás resumiendo la información ni de rendimiento ni de efectividad. Hay
> mucho trabajo aquí: si Resumen tiene que ser un resumen. Nuevamente, la vara de
> comprobación visual y la vara conceptual, de que se esté entendiendo y se esté
> mostrando de forma fiel la información que se quiere mostrar, y resumir la
> información que se busca tanto en metas como en rendimiento como en efectividad.»

### El ítem 21 CONTRADICE un contrato vivo, y hay que decirlo

`focoQueCruzaLaSeccion.test.tsx` fija desde hace semanas que el foco **resalta y
NO filtra**, con este motivo escrito: «estas listas son rankings y dejarlas en una
sola fila destruiría lo único que aportan, que es dónde cae esa facultad entre
las otras».

**Los dos son ciertos, y no chocan si se separan por pestaña**: en las otras
pestañas los paneles SON rankings —quién rinde más, qué curso-horario se sale de
su margen— y ahí resaltar es lo correcto. En **Resumen** los paneles son
resúmenes, y ahí filtrar es lo correcto. Y desde `a8d903a8` el MANDO sólo existe
en Resumen, así que el cambio cabe sin tocar el contrato de las demás.

### El ítem 25 es el de fondo

Resumen tiene nueve paneles y **ninguno resume Rendimiento ni Efectividad**. Lo
que él pide de esta pestaña, de su propio dictado anterior: «un resumen de todas
las demás pestañas, pero sobre todo de las respuestas efectivas». Hoy hay
respuestas, avance, ritmo, pronóstico, dos alertas de agenda, estado y cobertura
— nada de rendimiento y nada de efectividad.

## 26 · Bajar de un tramo de cobertura a sus cursos-horario

> «En cursos-horario por cobertura ya me está diciendo quiénes están muy por
> debajo, quiénes se quedaron a medias, quién llegó a la mayor parte. Pero sería
> interesante y curioso que yo pudiera hacer clic en uno de ellos —"se quedó a
> medias"— y que abajo se mostrara de forma profesional y minimalista cuáles son
> esos CH que quedaron muy por debajo de la mitad, y que me muestren el
> rendimiento del aula, el rendimiento esperado, la cantidad de elegibles
> esperados, la cantidad de elegibles obtenidos, por cada CH o R que haga
> referencia. Ese nivel de profesionalidad, de creatividad, me parece que no lo
> estás teniendo.»

**Las cuatro columnas que pide, y de dónde sale cada una** —hay que confirmarlas
contra el payload antes de dibujar, porque tres de las cuatro tienen homónimos en
este perfil—:

| Lo que pide | Campo probable | A confirmar |
|---|---|---|
| rendimiento del aula | `respuestas_validas / expected_valid` | es la razón que ya reparte los tramos |
| rendimiento esperado | `expected_valid` o `tasa_efectividad_aula` | ¿la meta del aula o su τ prevista? |
| elegibles esperados | `eligible_n` | del plan |
| elegibles obtenidos | `observed_students` del parte | es ASISTENTES, no elegibles: hay que preguntarle o rotularlo con precisión |

**El tramo tiene que ser clicable y la lista es un PANEL DEBAJO**, no un popover:
él dice «abajo se mostrara». Y la dirección debería viajar en la URL como el
resto del perfil (`panel=` o `foco=`), no en un `useState` suelto.

## LA CADENA DE MATRICULADOS A EFECTIVAS — definición suya, y lo que el dato tiene

Me equivoqué al preguntar si «elegibles obtenidos» eran los asistentes. Su
corrección, textual:

> «Los **elegibles** son los estudiantes matriculados que cumplen los criterios
> de inclusión y exclusión. Y los **elegibles esperados** son aquellos que
> consideramos que van a ver, en base a la tasa de rendimiento o efectividad que
> establecimos por facultad y también por aula cuando hablamos de forma granular.
> Y eso se compara con las **efectivas** que tuvimos. Una cosa es decir que de
> cincuenta matriculados va a haber treinta por temas de asistencia, y de esos
> treinta van a haber veinte: esos veinte son la tasa de efectividad que
> habíamos calculado. Pero puede ser que en la realidad tengamos veinticinco o
> tengamos quince.»

**La cadena, entonces**: matriculados → elegibles (cumplen criterios) → los que
esperamos ver (asistencia) → los que esperamos que respondan (efectividad) → las
efectivas reales.

### Lo que el plan guarda de verdad, medido sobre CH 1

| Campo | Valor | Qué es |
|---|---|---|
| `enrolled_total` | 30 | matriculados |
| `eligible_n` | **28** | elegibles: cumplen criterios |
| `rendimiento_ref` | 0,56 | tasa de referencia |
| `factor_facultad` | 0,927 | ajuste de su facultad |
| `tasa_efectividad_aula` | **0,519** | = 0,56 × 0,927 |
| `expected_valid` | **14,5** | = 28 × 0,519 |
| `p_aplicada_ref` | 0,87 | probabilidad de que el aula llegue a aplicarse — otra cosa |

### CORRECCIÓN — el escalón SÍ existe, y yo lo di por ausente mirando donde no era

Escribí que «el escalón intermedio no está guardado en ninguna parte» después de
mirar sólo las filas del PLAN de monitoreo. Él respondió que el cálculo de muestra
lo tiene, «se han hecho hasta Excels hablando de cuáles son los esperables por
facultad y por aula específica». **Tenía razón.**

Medido en `calc_muestra_referencia_asistencia$embudos`, que trae el embudo
completo por SEIS dimensiones —facultad, rango horario, tipo de sesión, condición
del curso, nivel del curso y tipo de docente—. Cada fila:

```
elegibles · asistentes · asistentes_elegibles · ya_medidas · no_elegibles
elegibles_presentes · efectivas · no_efectivas
pct_ausencia · pct_ya_medidas · pct_rechazo · efectividad · rendimiento
asistencia_elegibles_min · asistencia_elegibles_max
```

ARQUITECTURA Y URBANISMO, por ejemplo: **237 elegibles → 215 asistentes → 203
elegibles presentes → 171 efectivas**, con 9,3 % de ausencia, 5,6 % ya medidas,
5,9 % de rechazo, efectividad 0,842 y rendimiento 0,722.

Y `calc_muestra_aulas_config$efectividad$por_facultad` trae la **τ por facultad**
con su `k` y su suficiencia —ARTE Y DISEÑO 0,863 sobre k=12 «delgada»; CIENCIAS E
INGENIERIA 0,927 sobre k=40 «sólida»—, que es el `factor_facultad` que aparece en
cada fila del plan.

**Lo que de verdad pasa** es otra cosa, y es un problema real: el plan de
monitoreo se queda con el PRODUCTO —`tasa_efectividad_aula` = `rendimiento_ref` ×
`factor_facultad`— y no arrastra los dos factores por separado, así que Monitoreo
no puede decir «de 28 elegibles esperábamos ver 25 y que respondieran 14,5»
aunque el estudio lo tenga calculado dos módulos más atrás. **El dato existe; lo
que falta es el puente.**

**Lección**: verificar dónde vive antes de declarar una ausencia. Miré el plan y
concluí sobre el estudio entero.

## 27-29 · El pronóstico depende de la AGENDA, no del ritmo diario

> «Cuando hablas de cuándo se termina de aplicar el plan, recuerda que no es que
> nosotros tengamos un pronóstico lineal de que si hoy aplicamos treinta, mañana
> treinta, entonces pasado mañana treinta. De eso no depende: depende del ritmo
> de la agenda. Por eso es muy importante también, en resumen, tener un poco cómo
> va la agendación de aulas, porque la agendación es lo que nos permite decir
> "ok, a estas aulas vamos a ir a aplicar", y eso está en el Sheets. Entonces, no
> entender la agendación ni entender las metas como cosas lineales, sino cosas
> que dependen de las aulas que se hayan agendado y de los esperables que
> esperamos allí, contrastando siempre que tenemos un rendimiento diferenciado
> entre el rendimiento planificado y el que vamos encontrando una vez que ya
> tenemos ciertas aulas aplicadas; y ya podemos ir prediciendo para cada facultad
> cómo nos irá.»

**Lo que esto invalida.** `pronosticoDeCierre` proyecta hoy «al ritmo observado
de N cursos-horario por día de campo» — una extrapolación lineal de la velocidad
pasada. Él dice que la velocidad futura **no es una propiedad del equipo, es una
propiedad de la agenda**: se aplicará lo que esté agendado, el día que esté
agendado. Un lunes con ocho aulas agendadas y un martes con dos no son el mismo
día, y el ritmo medio los promedia.

**El modelo que pide, en tres piezas:**

1. **Cuándo** — de la agenda: cada curso-horario agendado tiene su fecha. El
   cierre es cuando se acaben las fechas, no cuando la división lo diga.
2. **Cuánto** — de los esperables de esas aulas: elegibles × tasa, no un promedio
   de encuestas por día.
3. **Corregido por lo observado** — el rendimiento que estamos encontrando frente
   al planificado, **por facultad**, que es lo que permite «ir prediciendo para
   cada facultad cómo nos irá».

**Y de aquí sale el ítem 28**: Resumen necesita un panel de **cómo va la
agendación**, porque es la variable de la que depende todo lo demás y hoy no está
en ninguna parte de esa pestaña. El dato vive en el Sheets y ya llega al plan
(`scheduled_date`, `FECHA AGENDADA`).

**Consecuencia de orden**: alinear el eje del pronóstico es trabajo válido —el
eje de fechas sirve para cualquier curva— pero la CURVA que dibuja va a cambiar.
Conviene no pulir el abanico de tres rectas hasta decidir el modelo.

## 32 · El seguimiento desgranado por facultad — lo que Resumen tiene que contestar

> «Si estamos viendo una facultad en particular en el resumen, creo que sí sería
> interesante ver **cuántas aulas tienen agendadas, cuántas faltan, cuándo se van
> a llenar todas las aulas que tenemos planificadas, si es que hay alguna aula
> adicional que estamos planteando o debería plantearse, si se están llegando las
> cuotas con las aulas agendadas hasta ahora, si se está llegando a la cuota de
> hombres, si se está llegando a la cuota de mujeres**. Eso sería muy interesante
> tenerlo en resumen por facultad, y ya que tenemos el selector en el encabezado,
> sería interesante poder verlo de esa forma para poder tener el seguimiento
> desgranado de cada facultad y poder saber qué hacer en cada una de ellas.»

**Son siete preguntas y ya hay motor para casi todas:**

| Pregunta | De dónde sale | ¿Existe? |
|---|---|---|
| cuántas aulas agendadas | `cierrePorAgenda().dias` | ☑ `a9d34e55` |
| cuántas faltan (sin fecha) | `cierrePorAgenda().sinAgendar` | ☑ |
| cuándo se llenan las planificadas | `cierrePorAgenda().ultimaFecha` | ☑ pero sólo dice hasta dónde llega lo AGENDADO |
| si hace falta un aula adicional | reserva de cadena + banco, contra la brecha | ◐ hay `reserva_de_la_cadena` y `banco_extras` |
| si se llega a la cuota con lo agendado | `proyeccion_metas` | ☑ es «Metas y aulas», hoy sólo en Metas |
| cuota de hombres | ídem | ☑ |
| cuota de mujeres | ídem | ☑ |

**O sea que el panel es sobre todo de COMPOSICIÓN, no de motor nuevo**: junta en
una sola lectura por facultad lo que hoy está repartido entre tres pestañas. Y el
selector de la cabecera ya filtra Resumen desde `c5d92a02`.

**Y contesta de paso el ítem 31**: mapea por las DOS cosas —aulas y cuotas— porque
la pregunta operativa las cruza: «¿me alcanzan las aulas que tengo agendadas para
llegar a la cuota de mujeres de esta facultad?».

## 30 · El día 9 y la tabla que no lo muestra

> «En el día a día de rendimiento, yo tenía entendido que el día nueve había sido
> el día con mayor cantidad de aplicaciones agendadas y aplicadas. Sin embargo,
> veo que la tabla no está mostrando eso. Quizás tenga que ver porque la
> información no está actualizada a fecha de hoy.»

**Medido el 2026-09-10 sobre el `.pulso` armado el 09**: el ritmo dice 07/09 →
329, 08/09 → 313, 09/09 → 302, o sea que el 9 es el MENOR de los tres en
respuestas. Pero en el Sheets, las marcas `APLICADA` por fecha son 07/09 → 16,
08/09 → 17, **09/09 → 24**: el 9 SÍ es el día con más aplicaciones.

### Mi primera explicación estaba MAL, y él la desmontó en una línea

Dije que «una aplicación del 9 por la tarde deja respuestas que entran el 10». Él:
«si un aula se aplica el nueve y las respuestas de Kobo son del nueve, es un
resultado del nueve de septiembre, no del diez». Tiene razón, y además ese
desfase por huso ya está corregido en el motor desde antes: `monitoreo_aulas_ritmo.R`
prefiere `start`/`end` —que traen el huso del dispositivo— justo porque
`_submission_time` viene en UTC y «este operativo agenda hasta las 19:30 de Lima».
O sea que ofrecí como explicación un defecto que ya estaba arreglado.

### La causa real, medida

El snapshot del `.pulso` se sincronizó el **2026-09-09 a las 18:29 UTC = 13:29 de
Lima**, y la última respuesta que contiene es de las **13:16 de ese mismo día**.

**El día 9 está cortado por la mitad.** Sus 319 respuestas son sólo las de la
mañana; toda la tarde —que es cuando se concentran las aplicaciones, según los
horarios del plan— nunca entró en esta copia. Y el Sheets marca 24 aplicaciones
ese día, varias de ellas de tarde.

Así que su intuición era correcta y la explicación es la que él mismo apuntó:
**la información no está actualizada**. Es el ítem 20 —trabajar sobre el original
y traer las respuestas de hoy— y deja de ser una comodidad: sin eso, cualquier
lectura del último día del operativo está truncada.

## 30 · CONFIRMADO: el 9 era el mejor día, y la copia lo escondía

Traídas las respuestas de hoy sobre el ORIGINAL (10/09 08:44, de 1 176 a 1 245
registros), el ritmo dice:

| Día | Efectivas |
|---|---|
| 07/09 | 329 |
| 08/09 | 313 |
| **09/09** | **466** |
| 10/09 | 23 (en curso, son las 8:44) |

**El 9 es el mejor día con diferencia**, exactamente como él recordaba. Con la
copia cortada a las 13:29 del 9 salían 302 — la mitad de su jornada— y ésa era
toda la discrepancia. No había defecto en la tabla: había datos truncados.

**Regla que sale de aquí**: antes de dar por buena la lectura de la última
jornada, comprobar hasta qué hora llega el snapshot. `<scratchpad>/marcas.R`.

## Un defecto que introduje y que sólo se vio con datos frescos

Con el operativo de hoy el eje del ritmo llegaba a **noviembre**: dibujaba setenta
días con las cuatro jornadas reales aplastadas contra el borde izquierdo. La
causa era mía —puse el cierre PESIMISTA del pronóstico como final del eje y con
el ritmo lento de un arranque esa fecha se dispara—. Corregido en `8db45f22`: el
horizonte lo pone **la última fecha agendada**, que es finita y es la que manda.
