---
name: preparar-loop-indefinido
description: Arma, actualiza y rearma el encargo de un /loop indefinido - el prompt que se vuelve a disparar en cada tick y es la única memoria que sobrevive a la compactación. Usar cuando el usuario pida "déjalo en loop", "sigue sin detenerte", "prepara un loop indefinido", al armar el cron del loop, o al retomar un loop abierto en otra sesión.
---

# Loop indefinido — preparar el encargo

Un `/loop` indefinido no se detiene hasta que el usuario lo diga. Entre tick y
tick el contexto se compacta: **lo único que llega entero al turno siguiente es
el prompt que le pasas al cron que dispara el loop**. Ese prompt no es un recordatorio de
la tarea, es el estado del trabajo. Todo lo que cueste más de un minuto
reconstruir —una cifra ya medida, el motivo por el que una etapa está cerrada,
el nombre exacto de un helper— vive ahí o se pierde.

De ahí la regla que gobierna todo lo demás: **el encargo se reescribe cada
turno**, no se reenvía intacto. `/loop` es built-in y no se puede editar; estas
reglas viven acá.

## Cadencia y rearme

- **El disparador es `CronCreate({cron:"*/5 * * * *", recurring:true, prompt:…})`,
  NUNCA `ScheduleWakeup`.** Medido el 2026-08-17 en dos sesiones distintas:
  `ScheduleWakeup` responde «Next wakeup scheduled for HH:MM:SS» y **no ejecuta
  nada** —quince llamadas aceptadas, cero ticks—, porque lo que crea de verdad es
  un one-shot pinchado a una hora que sólo corre si la sesión está ociosa en ese
  instante. El recurrente sí dispara, y perder un tick por sesión ocupada no lo
  mata: el siguiente llega en cinco minutos. La avería es INVISIBLE desde dentro
  —el registro se ve sano turno tras turno— y sólo se detecta por el hueco de
  horas sin ticks, o porque el usuario escribe «nunca empezaste».
- Tres límites que hay que avisar siempre: el cron sólo dispara con la sesión
  ociosa, muere al cerrar la sesión y los recurrentes **caducan a los 7 días**.
- **Cinco minutos exactos**, y la cadencia la fija el usuario. No los
  1200–1800 s que sugiere la herramienta: esa guía razona sobre coste de tokens,
  y acá la cadencia la fija el usuario para poder seguir y redirigir el trabajo.
- **El encargo se reescribe al cerrar CADA turno** —`CronDelete` del anterior y
  `CronCreate` con el estado nuevo—, incluidos los turnos que sólo atendieron una
  interrupción suya. El cron recurrente sobrevive por sí solo, pero un encargo sin
  actualizar hace que el tick siguiente repita lo ya hecho y lo reporte como nuevo.
- **Sólo se borra el cron si el usuario lo pide.** «El trabajo terminó de verdad» no
  es motivo: igual que un GOAL, un loop indefinido lo cierra sólo él. Cerrar una
  etapa no cierra el loop.
- Un solo disparador: comprueba con `CronList` antes de crear, y si ya hay un
  `*/5` no crees otro. Si quedó un `ScheduleWakeup` vivo, ciérralo con `stop`.
- Los waits de shell del turno van **con tope** (`timeout N` o contador máximo);
  un `until … sleep` sin tope sobrevive al loop y gira en vacío durante horas.

## El rearme va ANTES del cierre

Ésta es la regla que mantiene vivo el loop, y sale de haber medido tres loops
muertos en los transcripts. En los tres, el rearme se aceptó decenas de veces
—40, 119 y 187 llamadas, todas con su `Next wakeup scheduled for …`— y el loop
murió igual. El turno que lo mató siempre tenía la misma forma:

> tick disparado → trabajo real (leer, editar, correr tests, commitear) →
> **un cierre largo y satisfactorio** (el tablero entero, el checklist, el
> resumen de lo avanzado) → fin del turno. Sin rearme.

Los turnos que sobrevivieron cerraban con una línea corta —«Loop rearmado.»—
**después** de la llamada. Los que murieron cerraron con 1.100 a 3.300
caracteres de resumen y ya no llamaron a nada. El texto de cierre es lo que hace
que el turno se sienta terminado; escribirlo primero se lleva puesto el rearme.

De ahí tres reglas mecánicas:

1. **La reescritura del encargo (`CronDelete` + `CronCreate`) es la última
   llamada a herramienta del turno y va antes de
   escribir el cierre.** Si ya estás redactando el tablero, te lo saltaste:
   detente, llama, y sigue redactando.
2. **El disparador es la forma del turno, no el reloj.** En cuanto vayas a
   escribir un tablero, un checklist entero o un resumen de lo avanzado, ése es
   el momento de rearmar. Son turnos con forma de final.
3. **El cierre termina con el sello del disparador**, con el id que devolvió la
   herramienta: `⟳ tick de 5 min activo (cron 4b640895)`. No se puede escribir el
   id sin haber llamado, así que la omisión deja de ser invisible — para ti
   mientras redactas y para el usuario al leer.

Los dos turnos con más riesgo son justo los que más se parecen a un final: el
que cierra una etapa con su tablero, y el que atiende una interrupción del
usuario y la resuelve bien. En los transcripts, los cierres sin rearme se
repartían exactamente entre esos dos.

## Abrir uno

1. **Fija la vara con el usuario y cítala textual.** «El cálculo es por facultad;
   si necesitamos X alumnos por facultad tenemos que tener aulas que respondan a
   ese X» es una vara: decide si cada etapa pasa. Un loop sin vara degenera en
   pulido infinito.
2. **Enumera el recorrido y numéralo** (E1…En, L1…Ln, M1…Mn). Los números son la
   dirección con la que el turno siguiente se ubica sin releer nada.
3. **Prepara el objeto real y editable**: copia de trabajo del proyecto
   (`<nombre>_trabajo.pulso`), nunca el original del cliente, nunca fuentes de
   cliente dentro del repo. Verificación activa: correr el motor, cambiar la
   config, regenerar — no leer código y opinar.
4. **Escribe el encargo completo** con los bloques de abajo, aunque la mitad
   estén vacíos, y rearma.

## Anatomía del encargo

| # | Bloque | Qué lleva | Por qué |
|---|---|---|---|
| 0 | **Cómo se mantiene vivo, en la PRIMERA línea** | «Lo dispara un cron recurrente `*/5 * * * *`. NO llames a `ScheduleWakeup`: acepta y nunca dispara. Comprueba con `CronList` y no crees un segundo cron» | Iba al final y los tres loops murieron igual: la última línea de un encargo largo es justo la que se hojea. Va arriba, donde se lee. |
| 1 | Encabezado | `/loop <MODO> sobre <objeto real>, encargo de <quién>` | El turno siguiente sabe en una línea qué hace y para quién. |
| 2 | Instrucciones acumuladas | Cada indicación vigente del usuario, **entre comillas y textual** | Parafrasear degrada: «por facultad» se vuelve «revisar facultades» y a los tres ticks ya no es una vara. |
| 3 | Vara | La afirmación comprobable que decide si el trabajo está bien | Es lo que distingue avanzar de moverse. |
| 4 | SIGUIENTE | **Una** etapa, con qué se mide (función, ruta, dato) y qué contaría como hallazgo | Con dos «siguientes», el turno elige el fácil. |
| 5 | Tablero | Todas las etapas con estado, **dibujado entero siempre** | Un «4 de 10» oculta justo lo que el tablero existe para hacer visible. |
| 6 | Lo cerrado | Commits, el defecto real en una frase, dónde quedó cada pieza y **NO LA REHAGAS** | Sin eso un turno reabre por sospecha lo que ya está medido y quema el tick. |
| 7 | Cifras medidas | Los números caros, con unidad y denominador | Recuperarlos corriendo el motor cuesta más que escribirlos. |
| 8 | Hallazgos abiertos | Cada uno con su cifra | Un hallazgo sin cifra es una impresión. |
| 9 | Preguntas al usuario | La pregunta y **qué hacer con cada respuesta** | El tick que llegue con la respuesta ya sabe qué hacer sin volver a preguntar. |
| 10 | Herramientas | Funciones con su firma, runners del scratchpad con cómo se invocan, copia de trabajo | Es lo primero que se pierde y lo más caro de reencontrar. |
| 11 | Zonas prohibidas e higiene | Archivos que no se tocan, congelados a crecimiento, `git status`/`git diff` antes de commitear porque otras sesiones commitean sin avisar | Evita pisar trabajo ajeno y reescribir historia. |
| 12 | Gate | Las suites del área tocada **con sus conteos esperados** | Un gate sin cifra previa no distingue «pasa» de «pasa menos que ayer». |
| 13 | Lecciones · evidencia falsa · trampas | Tres listas separadas | Lección metodológica ≠ cómo no engañarse ≠ trampa técnica del entorno. |
| 14 | Cierre | La misma orden de rearme del bloque 0, repetida | Redundancia barata: si el turno leyó el encargo de arriba abajo, lo ve dos veces. |

## Reglas de escritura

- **Literal donde importa**: ruta con línea aproximada (`~1177 de
  api/R/calc_muestra_aulas.R`), nombre de símbolo exacto, commit por hash corto.
  «una función del motor» no le sirve a nadie.
- **Escríbelo para alguien que no vio nada de esto**, porque literalmente es así.
- **MAYÚSCULAS sólo para prohibiciones** y para lo que un turno apurado saltaría.
- Lo decidido se enuncia como decisión cerrada, no como opción abierta.
- No metas lo que el repo dice mejor (estructura, historia de git, contenido de
  un ADR): mete el puntero.

## Qué se poda y qué nunca

- **Etapa cerrada → una línea**: estado, commits, el defecto en una frase y la
  prohibición de rehacerla. El detalle largo se muda al commit, al ADR o al doc
  vivo.
- **Nunca se poda**: la orden de rearme de la primera línea, la vara, las
  instrucciones textuales, las cifras que no guarda nadie más, las prohibiciones
  y las trampas.
- Cuando el encargo deje de poder releerse de un vistazo, el bloque duradero baja
  a `docs/qa/goal-<tema>-<fecha>.md` (skill `/goal`) y el prompt lleva el puntero
  **más el tablero**. El tablero nunca se sustituye por un puntero: se dibuja
  siempre en el prompt.

## Anti-patrones — cada uno costó un tick

- **Escribir el cierre y después acordarse del rearme.** Es el que mató los tres
  loops medidos, y no avisa: la última llamada aceptada dice «Next wakeup
  scheduled», así que el registro se ve sano hasta el turno en que ya no hay
  llamada. Se detecta sólo por el hueco —tres horas de silencio hasta que el
  usuario vuelve a escribir.
- Rearmar con el prompt del tick anterior sin actualizarlo: el turno repite lo
  ya hecho y lo reporta como nuevo.
- Cerrar el turno sin rearmar después de una interrupción del usuario.
- `stop: true` porque la etapa quedó cerrada y el turno «terminó bien».
- Un «siguiente» difuso («seguir revisando X»).
- **Cerrar una etapa con los datos cómodos**: la cadena era perfecta a `n=30` y a
  190 el 58 % recibía menos reemplazos de los pedidos. La etapa se cierra a la
  escala real, no a la de prueba.
- Declarar cobertura con tests que miran el helper y no la aplicación, o el
  markup y no el payload. Si el encargo dice «19 tests», que diga también qué
  mutante mató cada grupo.
- Dar por medido lo que no se midió: lo que quedó sin cubrir se dice en el
  commit y se cierra después.

## Plantilla

```text
TICK DEL LOOP — lo dispara un cron recurrente `*/5 * * * *` creado en esta
sesión. NO llames a `ScheduleWakeup`: acepta la llamada y NUNCA dispara. NO crees
un segundo cron: comprueba con `CronList`. Sólo <quién> detiene el loop.
<MODO> sobre <objeto real>, encargo de <quién>.
Instrucciones suyas acumuladas: «…»; «…»; **«<la vara, textual>»**.
SIGUIENTE: <E_n> — <qué medir, con qué función y sobre qué dato>. Si <X> no
existe como cifra, eso es el hallazgo.
PREGUNTA PENDIENTE: <…>; si contesta <sí>, <acción> ANTES de <E_n>.
TABLERO, DIBÚJALO ENTERO SIEMPRE: E1 <…> ☑ · E2 <…> ◐ <qué falta> · E3 <…> ☑
CERRADA commits <hashes>, NO LA REHAGAS: <defecto en una frase> · E4 ☐ SIGUIENTE
· … · En ☐ <vara numérica>
CIFRAS MEDIDAS: <…>
HALLAZGOS ABIERTOS: <con su número>
FUNCIONES: <firma(s)>  ·  RUNNERS: <ruta y cómo se invocan>  ·  COPIA: <…>
COMMITS DEL RECORRIDO: <hashes>
NO TOQUES: <archivos>. Otras sesiones commitean sin avisar: `git status` y
`git diff` antes de commitear.
GATE: <suite> <conteo>, <suite> <conteo>. Suites del área tocada, nunca la
completa.
LECCIONES: <…>  ·  EVIDENCIA FALSA: <…>  ·  TRAMPAS: <…>
Cierra sólo lo que tú levantes. Rearma ANTES del cierre y termina con
`⟳ próximo tick HH:MM:SS`.
```

Y el turno se cierra así:

```text
<el tablero / el resumen del turno>

⟳ próximo tick 03:24:00
```
