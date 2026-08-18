---
name: preparar-loop-indefinido
description: Arma, actualiza y rearma el encargo de un /loop indefinido - el archivo de encargo que cada tick vuelve a abrir y es la única memoria que sobrevive a la compactación. Usar cuando el usuario pida "déjalo en loop", "sigue sin detenerte", "prepara un loop indefinido", al armar el reloj del loop, o al retomar un loop abierto en otra sesión.
---

# Loop indefinido — preparar el encargo

Un `/loop` indefinido no se detiene hasta que el usuario lo diga. Entre tick y
tick el contexto se compacta: **lo único que llega entero al turno siguiente es
la notificación del reloj (que sólo trae una línea) y el archivo de encargo al
que esa línea apunta**. Ese archivo no es un recordatorio de la tarea, es el
estado del trabajo. Todo lo que cueste más de un minuto reconstruir —una cifra
ya medida, el motivo por el que una etapa está cerrada, el nombre exacto de un
helper— vive ahí o se pierde.

De ahí la regla que gobierna todo lo demás: **el encargo se reescribe cada
turno**, no se relee intacto. `/loop` es built-in y no se puede editar; estas
reglas viven acá.

## El reloj: una tarea de fondo, no un programador

- **El disparador es el fin de una tarea de fondo**:

  `Bash({run_in_background: true, command: "sleep 300", description: "TICK DEL LOOP <tema> — retoma <scratchpad>/ENCARGO_LOOP.md"})`

  Al terminar el `sleep` llega la `<task-notification>` y con ella el turno
  siguiente. Sólo el `sleep` en foreground está bloqueado; en background corre.
  **NO montes el reloj sobre `ScheduleWakeup` ni sobre `CronCreate`.**
- Por qué, con las cifras de las cinco sesiones con loop de agosto 2026 (auditoría
  del 2026-08-18 sobre los transcripts): **los dos programadores disparan a
  rachas y mueren a rachas, por sesión.** `ScheduleWakeup` disparó 446 de 569
  rearmes — un loop vivió 55 horas con él — pero los fallos no se reparten al
  azar: se concentran en **ventanas muertas de horas** (8 rearmes seguidos
  aceptados y cero ticks en una sesión, de 03:32 a 10:56, mientras OTRA sesión
  disparaba puntual a las mismas horas). `CronCreate` igual: ~21 ticks seguidos
  una tarde y esa misma noche un cron aceptado que pasó 103 minutos con la
  sesión ociosa sin disparar — ése es el «Te detuviste cuando te dije
  explícitamente que no lo hagas». La avería es invisible desde dentro: el
  resultado de la herramienta dice exactamente lo mismo («Next wakeup
  scheduled…») en la racha sana y en la muerta.
- El reloj de fondo no tiene esa avería medida: ~100 notificaciones en dos
  sesiones de 8–9 horas corridas, cero muertes silenciosas, y sobrevivió
  compactaciones. Además tiene la propiedad que a los programadores les falta:
  **un tick que cae con el turno ocupado se encola y llega al cerrar el turno;
  el del programador se descarta sin reintento.** Por eso los wakeups morían
  justo en las fases de turnos largos: el rearme se hacía a mitad del trabajo,
  la hora del tick caía dentro del turno y el tick se perdía sin dejar rastro.
- **Cinco minutos** (`sleep 300`), y la cadencia la fija el usuario, no el
  cálculo de eficiencia. La cadencia efectiva será 5 min + lo que dure el turno
  (mediana medida: ~7 min entre ticks); no compensarlo acortando el sleep.
- **El encargo vive en `<scratchpad>/ENCARGO_LOOP.md`** (o la ruta que el loop
  declare), no en el prompt del reloj: la notificación sólo trae el
  `description`. Cada turno reescribe el archivo y relanza el ticker.
- **Un solo reloj.** Antes de lanzar, mira las tareas de fondo activas
  (`TaskList`): si ya hay un TICK corriendo, no lances otro — dos relojes dan
  ticks dobles. Si quedó vivo un cron o un wakeup de una encarnación anterior
  del loop, elimínalos (`CronDelete`, `ScheduleWakeup({stop: true})`); no
  conviven dos disparadores.
- Dos límites que hay que avisar al usuario siempre: el ticker es un proceso
  hijo de la app — **cerrar la app mata el reloj** y nada dentro de la sesión
  sobrevive a eso; la **suspensión del equipo** lo pausa y el tick llega tarde,
  pero llega (el one-shot de un programador cuya hora pasa durante la
  suspensión, en cambio, no dispara nunca).
- Los waits de shell del turno van **con tope** (`timeout N` o contador
  máximo); un `until … sleep` sin tope sobrevive al loop y gira en vacío
  durante horas.

## El rearme va ANTES del cierre

Ésta es la regla que mantiene vivo el loop, y sale de haber medido los loops
muertos en los transcripts. El reloj puede ser perfecto y el loop muere igual si
un turno cierra sin relanzarlo. El turno que mata siempre tiene la misma forma:

> tick disparado → trabajo real (leer, editar, correr tests, commitear) →
> **un cierre largo y satisfactorio** (el tablero entero, el checklist, el
> resumen de lo avanzado) → fin del turno. Sin rearme.

Los turnos que sobrevivieron cerraban con una línea corta —«Reloj corriendo.»—
**después** de la llamada. Los que murieron cerraron con 1.100 a 3.300
caracteres de resumen y ya no llamaron a nada. El texto de cierre es lo que hace
que el turno se sienta terminado; escribirlo primero se lleva puesto el rearme.

De ahí tres reglas mecánicas:

1. **Reescribir `ENCARGO_LOOP.md` y relanzar el ticker es lo último que hace el
   turno, justo antes de redactar el cierre.** Si ya estás redactando el
   tablero, te lo saltaste: detente, llama, y sigue redactando. No relances el
   reloj al principio del turno «para no olvidarlo» y sigas trabajando: con el
   ticker eso sólo adelanta el tick, pero es la disciplina de rearme-al-final
   la que el turno siguiente va a imitar.
2. **El disparador es la forma del turno, no el reloj.** En cuanto vayas a
   escribir un tablero, un checklist entero o un resumen de lo avanzado, ése es
   el momento de rearmar. Son turnos con forma de final.
3. **El cierre termina con el sello del reloj**, con el task-id que devolvió la
   herramienta: `⟳ reloj bwyrim2w2 corriendo — notifica ~HH:MM:SS`. No se puede
   escribir el id sin haber llamado, así que la omisión deja de ser invisible —
   para ti mientras redactas y para el usuario al leer. Un cierre sellado con
   un mecanismo que nunca has visto disparar es una promesa, no evidencia.

Los dos turnos con más riesgo son justo los que más se parecen a un final: el
que cierra una etapa con su tablero, y el que atiende una interrupción del
usuario y la resuelve bien. En los transcripts, los cierres sin rearme se
repartían exactamente entre esos dos. **El rearme aplica a CADA turno**,
incluidos los que sólo contestaron una pregunta suya: si él interrumpe con una
tarea nueva y la resuelves sin relanzar el reloj, el loop se muere por omisión
y parece que el skill está roto.

Y la contracara: si un turno arranca (por el motivo que sea) y `TaskList` no
muestra ningún TICK corriendo, el reloj murió —app reiniciada, ticker olvidado—
y ese turno lo relanza de inmediato, antes de trabajar.

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
4. **Escribe `ENCARGO_LOOP.md` completo** con los bloques de abajo, aunque la
   mitad estén vacíos, lanza el ticker y avisa los dos límites (app cerrada,
   suspensión).

## Anatomía del encargo

| # | Bloque | Qué lleva | Por qué |
|---|---|---|---|
| 0 | **Cómo se mantiene vivo, en la PRIMERA línea** | «Lo dispara el fin de una tarea de fondo `sleep 300`. Al cerrar CADA turno: reescribe este archivo y relanza el ticker (`TaskList` primero: un solo TICK). NO montes el reloj en `ScheduleWakeup` ni `CronCreate`: se aceptan y tienen ventanas de horas sin disparar» | Iba al final y los loops murieron igual: la última línea de un encargo largo es justo la que se hojea. Va arriba, donde se lee. |
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
| 14 | Cierre | La misma orden de rearme del bloque 0, repetida | Redundancia barata: si el turno leyó el encargo de arriba abajo, la ve dos veces. |

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
  a `docs/qa/goal-<tema>-<fecha>.md` (skill `/goal`) y el encargo lleva el
  puntero **más el tablero**. El tablero nunca se sustituye por un puntero: se
  dibuja siempre en el encargo.

## Anti-patrones — cada uno costó un tick o mató un loop

- **Escribir el cierre y después acordarse del rearme.** Es el que mató los
  loops medidos, y no avisa: el registro se ve sano hasta el turno en que ya no
  hay llamada. Se detecta sólo por el hueco — horas de silencio hasta que el
  usuario vuelve a escribir «Nunca empezaste» o «Te detuviste».
- **Sellar el cierre con un mecanismo que nunca has visto disparar.** «⟳ cron
  activo» con 31 crons aceptados y 0 ticks entregados es lo que rompió la
  confianza del usuario. Una herramienta que responde «programado» no prueba
  que se ejecute: el único sello válido es el reloj cuyo disparo ya presenciaste
  en esta sesión.
- **Cambiar de mecanismo a mitad del loop porque un tick no llegó**, sin mirar
  primero `TaskList`: si el ticker sigue corriendo, el tick viene en camino
  (encolado tras un turno largo); si no está, se relanza el mismo mecanismo. El
  bandazo wakeup→cron→otro deja disparadores huérfanos conviviendo.
- Rearmar con el encargo del tick anterior sin actualizarlo: el turno repite lo
  ya hecho y lo reporta como nuevo.
- Cerrar el turno sin rearmar después de una interrupción del usuario.
- Declarar el loop terminado porque la etapa quedó cerrada y el turno «terminó
  bien». Igual que un GOAL, un loop indefinido lo cierra sólo el usuario;
  cerrar una etapa no cierra el loop.
- Un «siguiente» difuso («seguir revisando X»).
- **Cerrar una etapa con los datos cómodos**: la cadena era perfecta a `n=30` y a
  190 el 58 % recibía menos reemplazos de los pedidos. La etapa se cierra a la
  escala real, no a la de prueba.
- Declarar cobertura con tests que miran el helper y no la aplicación, o el
  markup y no el payload. Si el encargo dice «19 tests», que diga también qué
  mutante mató cada grupo.
- Dar por medido lo que no se midió: lo que quedó sin cubrir se dice en el
  commit y se cierra después.

## Plantilla de `ENCARGO_LOOP.md`

```text
TICK DEL LOOP — lo dispara el fin de una tarea de fondo `sleep 300` lanzada con
`run_in_background`. AL CERRAR CADA TURNO, y como última llamada antes del
cierre: reescribe este archivo y relanza el ticker con el description
«TICK DEL LOOP <tema> — retoma <esta ruta>». Antes de lanzar, `TaskList`: un
solo TICK corriendo. NO montes el reloj en `ScheduleWakeup` ni `CronCreate`
(se aceptan y tienen ventanas de horas sin disparar; medido). Si un turno
arranca y no hay TICK en `TaskList`, relanza el reloj ANTES de trabajar.
Sólo <quién> detiene el loop.
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
Reescribe este archivo y relanza el ticker ANTES de redactar el cierre; el
cierre termina con `⟳ reloj <task-id> corriendo — notifica ~HH:MM:SS`.
```

Y el turno se cierra así:

```text
<el tablero / el resumen del turno>

⟳ reloj bwyrim2w2 corriendo — notifica ~03:24:00
```
