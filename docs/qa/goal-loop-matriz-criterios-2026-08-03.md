# GOAL · La matriz de criterios cuenta cómo llegamos al marco

- **Abierto**: 2026-08-03 · **Cierra**: sólo Gonzalo
- **Alcance**: 12–15 iteraciones (G1…), no una lista lineal
- **Contexto**: ADR 0057 (la tarjeta de categoría), hojas de revisión F111–F122

## Qué se pide

> «La matriz de criterios tiene que hablar de la historia de forma al revés.
> Tiene que mostrarnos el detalle de cada facultad y hacia abajo con cuántos
> cursos-horario finalmente nos quedamos. Los criterios no hablan de cuántos
> casos agregamos, sino de cuántos quitamos: cómo pasamos de un corte universal
> de cursos-horario y, conformando cada criterio, vamos quitando más. Al final,
> con cuántos nos quedamos por facultad. Eso se suma la columna final con la
> fila final y nos da los cursos-horario elegibles.»

Y con ella: el nivelador en umbral y rango, la **confirmación por criterio**, y
el **embudo vivo animado** — al confirmar, los siguientes recalculan.

## El hallazgo que ordena el goal

**La matriz ya existe y responde otra pregunta.**
`calc_muestra_aulas_matriz_embudo` es **marginal**: cada celda quita la regla
completa sólo para su facultad y vuelve a medir. Su propio docblock lo dice —
«no agrega deltas de filas ni de segmentos»—, así que su fila Total **no es la
suma** de las facultades.

| | marginal (hoy) | cascada (lo pedido) |
|---|---|---|
| pregunta | ¿qué recuperaría si quito esta regla? | ¿cómo llegamos hasta aquí? |
| celda | CH que volverían | CH que este criterio quita |
| fila Total | se recalcula sobre todo el marco | **suma de las facultades** |
| uso | sensibilidad | procedencia |

Las dos son legítimas. La que Gonzalo pide es la segunda, y es la que falta.

## Reglas del goal

1. **Cada iteración cierra con gate.** Typecheck si hay TS, testthat si hay R,
   comprobación visual si hay UI. Nada se declara sin evidencia.
2. **Cada regla nueva nace con guard**, y el guard se prueba por mutación.
3. **La regla 1 del ADR 0057 manda**: no existe el criterio general. Todo estado
   del embudo es de una celda (facultad × criterio), nunca de una columna.
4. **Nada que codifique un valor se anima con `transform`** (patrón 12).
5. La estética es la que ya acordamos en F111–F122. Mejorar, no reinventar.

## Bitácora


### G4 — El componente, con la estética acordada

Facultades en filas, criterios en columnas, cada celda una **resta**. La última
fila suma y es la respuesta. El nombre de la facultad es `sticky`: al llegar a la
última columna hay que seguir sabiendo de qué fila es la cifra.

Resuelta la duda que quedaba abierta del mockup: **la celda en cero distingue
dos cosas** que sin marca se ven igual — un criterio que corrió y no quitó nada
(punto medio) y uno que esa facultad no aplica (guion).

### G5 — Montada después de los criterios

Va tras los bloques de facultad, como pediste: primero se decide en una facultad,
luego se mira el acumulado. **No duplica el Panorama de arriba**: aquél es
marginal —qué recuperaría si quito una regla— y sirve para elegir en qué facultad
entrar; ésta es la procedencia.

### G6 — La matriz destapó una inconsistencia de 7 cursos-horario

Medido en la app con datos reales: la matriz sumaba **2.806** y el KPI de la
cabecera decía **2.799**.

No era el motor: era **mi filtro**. Las exclusiones manuales viajan en la cascada
con `gate = false` porque no son un criterio metodológico, y al descartarlas la
matriz **aterrizaba en un número que no eran los elegibles** — prometía contar de
dónde salen y paraba un paso antes, dejando siete sin explicar.

`cuadraConElMotor` tampoco lo cazó, porque comparaba contra el total de la propia
cascada filtrada. Un guard que se compara consigo mismo siempre cuadra.

### G7 — Los pasos operativos entran, marcados

Siguen sin ser criterios, así que no se mezclan: filete de separación y rótulo en
cursiva. Lo que no pueden es faltar.

| medida | antes | después |
|---|---:|---:|
| Total de la matriz | 2.806 | **2.799** |
| Coincide con el KPI de elegibles | no | **sí** |
| Columnas operativas declaradas | 0 | **1** |

**Pendiente detectado**: de 14 columnas, **12 no recortan nada en ninguna
facultad**, y cinco de ellas son criterios de estudiante —Formación, Condición de
matrícula, Edad, Facultad, Ciclo— que filtran alumnos, no cursos-horario. Su
`excluded_ch` sólo deja de ser cero cuando vacían un curso entero. Doce columnas
de puntos son ruido, y mezclar dos unidades en un mismo eje es un problema de
fondo, no de densidad.

### G8 — Dos unidades mezcladas en un mismo eje

De 14 columnas, 12 no recortaban nada, y cinco eran criterios de **estudiante**.
Todas publican `excluded_ch`, así que la celda mide lo mismo; lo que cambia es
**qué filtra el criterio**. La solución no fue esconder columnas —eso es lo que
este módulo lleva un loop evitando— sino **nombrar el grupo**: un criterio de
estudiante sólo quita un curso-horario cuando lo vacía, y el rótulo lo dice.
Agrupadas, cinco columnas en cero pasan a decir algo.

Verificado: 5 de estudiante · 9 de curso-horario · 1 operativo.

### G9 — Confirmar y descartar por criterio

Era global —el docblock lo declaraba— y sin confirmación por criterio el embudo
vivo no puede existir. El gesto global se conserva; deja de ser el único.

`descartarCriterio` restaura **su** rama del borrador, no el borrador entero:
descartar uno no puede llevarse por delante los cambios de los otros.

### G10 — El confirmador dentro de la tarjeta, y el orden que lo cuenta

Montado en las cuatro tarjetas con una sola prop. Verificado en la app: aparece
dentro de «Matriculados / población», y al confirmar sólo ése desaparece y la
barra global pasa a «Los criterios cambiaron».

**Dos defectos míos en el camino.** El primero: pasé la prop al bloque pero
**no al montaje** —el reemplazo no casó por indentación— y el confirmador no
salía aunque hubiera un pendiente. El segundo importa más: **reimplementé el
orden del embudo en una lista** y los criterios de estudiante, que en la cascada
van primero, me quedaban al final. El confirmador anunciaba «11 criterios quedan
en espera» sobre un orden que no es el que se aplica.

El motor ya publica el suyo (`order_source: "motor_r"`). Ahora se lee de ahí y
la lista del ADR queda de respaldo para cuando la cascada no está publicada.
Medido: de **11** a **5** criterios en espera.

### G11 — La matriz reacciona a la celda, no a la columna

Verificado en la app: **1 celda en edición**, **5 en espera sólo en esa fila**, 1
fila marcada, y la celda resaltada es el cruce de la facultad abierta con
«Matriculados / población». La regla 1 del ADR 0057 funcionando de punta a punta.

### G12 — El realce marca lo que cambió, no lo que se está tocando

Se enciende cuando la cifra se movió respecto del render anterior. Encenderlo en
la celda en edición anunciaría un cambio que todavía no ocurrió: confirmar no
mueve nada hasta reconstruir el marco.

Sólo color y opacidad. Con `prefers-reduced-motion` el realce se queda **fijo**
en vez de desaparecer: quien apaga el movimiento sigue necesitando saber qué
cambió.

### G13 — Los cinco viewports

| viewport | página desborda | scroll propio | columna fija |
|---|---|---|---|
| 1710×1107 · 1440×1000 · 1366×768 · 1280×720 | no | sí | sí |
| **1024×600**, medido con redimensionado real | **no** | **sí** | **sí** |

**Falso positivo del detector**: seis elementos daban `scrollWidth > clientWidth`
sin scroll propio. Son `text-overflow: ellipsis` — el recorte intencional produce
exactamente esa señal. Contar una decisión de diseño como defecto es el mismo
patrón que llevo toda la sesión cazando, esta vez en mi instrumento de QA.

Mi primera medición fue peor: cambiar `documentElement.style.width` no
redimensiona el viewport. Rehecha con `resize_window`.

### G14 — Consistencia del motor R

Las etiquetas que llegan a la matriz salen del registro de criterios y de las
entradas de la radiografía — las mismas que muestra la UI. **No queda «aula»
donde la superficie dice «curso-horario»**, que era el riesgo tras los barridos
de vocabulario de F66–F71.

### G15 — Repaso de los loops recientes

- CSS huérfano: **sin deuda nueva**; la línea base por pestaña se mantiene.
- Contenido plegado: los **tres** `<details>` vivos son los declarados por nombre
  (mensaje del motor, ejemplo didáctico, renombrado de hojas).
- ADR 0058 recoge los **cinco errores del goal** con su mecanismo.

## Estado del goal

| | |
|---|---|
| Iteraciones | **G1–G15** |
| Inconsistencias de motor encontradas | **1** (descuadre de 7 CH) — reparada |
| Defectos propios encontrados por mutación o medición | **6** |
| Gate | typecheck 0 · 1.032 pruebas en 120 archivos · **50 archivos de R sin fallos** |

**Abierto**, para decidir contigo:

- La matriz marginal (`MatrizEmbudoCriterios`) sigue arriba como Panorama. Son
  dos matrices en la misma pestaña con preguntas distintas; funciona, pero
  conviene revisar si el rótulo de cada una deja claro cuál responde qué.
- Los niveladores de umbral y rango están construidos y probados, pero **todavía
  no montados** en los criterios reales: hoy el mínimo se edita con el control
  anterior.

### G16 — El nivelador en el mínimo, y la suite de R rota otra vez

Montado el nivelador en el mínimo por facultad — el caso que Gonzalo describió.
Su tope sale de la mediana de la facultad, no de una constante: un rango fijo
deja media barra en una zona donde no hay nada que decidir en las facultades
pequeñas y se queda corto en las grandes.

**Y al correr R apareció el mismo fallo que en F71.** F114 —el commit del eje—
tocó `calc_muestra_aulas_criterio_radiografia.R` para añadir `n_atipicos_inf` y
`n_atipicos_sup`, y volví a correr sólo el frontend. Ese commit dejó la suite en
rojo y se subió así.

Es el patrón que documenté hace ochenta commits, repetido con la misma causa: un
cambio de seis líneas en R **no se siente como tocar lógica**. Documentarlo una
vez no lo evitó, porque el disparador dependía de un juicio que se toma justo
cuando uno está pensando en otra cosa. Ahora el disparador es un hecho: **si el
diff toca `api/`, se corre la suite del área antes de commitear**.

Mi guard de CSS huérfano cazó en la misma corrida las dos clases que el nivelador
dejó sin uso. Para eso existe.

**Cierre**: suite de R relanzada entera — **50 archivos, sin fallos**.

### G35 — El rango de niveles vuelve a ser un rango, y lo que se llevó un checkout

Cuatro defectos en un solo criterio. Los cuatro salieron **midiendo la pantalla
cargada**; ninguno era legible en el fuente.

1. **El control era una lista de 852 opciones.** El criterio de nivel del curso
   se editaba con dos `<select>` que en este proyecto desplegaban 852 entradas
   cada uno —está mapeado al código de curso, no al nivel— y volcaban la lista
   completa en la página. Sustituidos por el control de dos manijas ya acordado.
2. **La pista quedaba 395 px más corta que su gráfico.** `alineadoConEje`
   compensaba con precisión el sangrado de la tarjeta pero nunca reclamaba el
   ancho, así que corregía un desfase sobre una escala que no era la del eje
   (ADR 0057, patrón 42).
3. **Su contenedor seguía dimensionado para los selects retirados** (patrón 43).
4. **La tarjeta pedía el confirmador de su vecina.** Mover una manija marcaba
   pendiente el rango, la tarjeta preguntaba por `condicion_curso`, y no
   aparecía confirmador: el cambio se quedaba fuera de la cascada **sin ningún
   síntoma visible**. Tres de los cuatro montajes eran correctos, lo que vuelve
   al defecto invisible por lectura. Reparado por construcción — la tarjeta
   recibe la función y pregunta por su propio criterio (patrón 44).

**Lo que más pesa de esta iteración no es ninguno de los cuatro.** El punto 1 ya
se había reparado en G17 y había desaparecido: para salir de un empalme roto
restauré el archivo entero con `git checkout --`, y con el empalme se fue el
trabajo bueno de las mismas líneas. Lo rediagnostiqué de cero, midiendo otra vez
lo mismo. Un defecto que ya se reparó y vuelve **exacto** no es una regresión del
producto: es trabajo perdido, y conviene buscarlo en el historial antes de
volver a diagnosticarlo (patrón 45).

**Método.** Al empezar busqué «el control de rango» y reparé el primero que
apareció — el mismo error que Gonzalo ya había corregido («noto muchos errores
constantemente, revísalo bien todo»). La reparación buena vino de **enumerar la
clase entera**: `grep` de las tres clases sobre todo `*.tsx` dio exactamente dos
usuarios, y con los dos a la vista el CSS muerto (dos reglas completas) se retiró
en la misma pasada.

**Verificado en la app**: 0 selects (de 854 opciones) → 2 manijas · pista y
gráfico 1.091 px con delta 0 por ambos lados · mover una manija despierta «7
criterios quedan en espera» dentro de la tarjeta · confirmar lleva la barra
global a «Los criterios cambiaron».

**Guards**: tres casos nuevos, cada uno probado en rojo reintroduciendo su
defecto exacto y verde al restaurar. **Gate**: typecheck 0 · 3.444 tests en 419
archivos. **Commit**: `0bb4b705`.

**Higiene del ADR**: los patrones 35, 36 y 37 estaban **duplicados** —dos series
con los mismos números en la misma sección—. Como los patrones se citan por
número, la cola se renumeró a 39–41 y se corrigieron las dos citas del doc del
goal de frontend.

**Siguiente (G36)**: Composición es el último criterio sin tarjeta estándar. Es
«regla común» y su control vive en el área global, así que la pregunta previa no
es cosmética — es si le corresponde tarjeta propia o si su sitio es justamente
ése. Se decide midiendo, no eligiendo.

### G36 — La tarjeta categórica no declaraba qué era

Barrido sistemático de la superficie: 6 criterios, 0 duplicados, 0 colapsados,
todos a ancho completo, el mínimo primero y el orden coincidiendo con el del
motor. La matriz cuadra — 5.263 − 2.320 − 137 − 7 = 2.799, que es el KPI; mi
lectura anterior de «5.263 ≠ 2.799» era mía, no de la matriz: 5.263 es la
apertura, no el total.

Lo que sí salió del barrido: de las cuatro variantes de tarjeta, umbral y unidad
declaraban su `data-variante` y **las tres categóricas no declaraban nada**. Era
el `return` por defecto del componente, y un caso por defecto no se siente como
una rama que haya que declarar. Sin declaración no se puede distinguir
«categórica» de «se rompió y cayó al caso por defecto» (ADR 0057, patrón 46).

Medido tras el arreglo: `{umbral 2, unidad 40}` → `{umbral 2, categoria 15,
unidad 40}`.

### G37 — Tres cosas que Gonzalo vio de un vistazo

**El deslizador roto.** La manija «desde» salía como un disco partido por una
banda blanca. La banda es el carril nativo del segundo input pintándose sobre el
thumb del primero — pero la causa real está un paso antes: `theme.css` estiliza
`input[type="range"]` con especificidad (0,1,1), que **le gana** a
`.cmv2-rango-manija` (0,1,0). Todo el estilo de manija de este control llevaba
perdiendo en silencio desde F121; lo que se veía era el thumb del tema.

Lo que hace duradero al defecto es que un CSS que no se aplica **no deja hueco**:
pinta otra cosa parecida. Sobrevivió a tres iteraciones de ajuste fino sobre esas
mismas líneas, cada una midiendo el efecto de una regla que no estaba en juego
(patrón 47). El mismo defecto vive en el simulador XLSForm; queda como tarea
aparte.

Diagnosticado ocultando riel y banda por separado y ampliando la manija 5× con un
`zoom` temporal — a escala real las tres hipótesis se veían iguales.

**Las categorías con más CH primero.** Salían en el orden de la columna de
origen. La decisión interesante fue **por cuál cifra ordenar**: `chContraste` (los
que la categoría tiene) y no `ch` (los que siguen dentro), porque con `ch` la
lista se reordena a cada conmutador y la siguiente que querías tocar ya no está
donde la dejaste (patrón 48). El caso que lo prueba necesitó fixture propio: el
compartido daba el mismo orden por ambas cifras y no distinguía nada.

### G38 — Composición habla en su propia unidad

El pedido de Gonzalo obligó a revisar una decisión mía de hace catorce
iteraciones. G25 midió un defecto real —«mediana 30 %» con eje hasta 200 %— y lo
reparó **cambiando la etiqueta** en vez del dato. Cambiar la etiqueta siempre
funciona: el rótulo deja de mentir y el caso se cierra. Lo que quedó detrás fue
composición decidiéndose con un corte en porcentaje mientras su gráfico contaba
alumnos (patrón 50).

El dato correcto ya existía en el motor. Le faltaba contrato y unidad:

- `signal_distribution` sube a v2 (bigotes, histograma, escala).
- La señal viaja **en la unidad del control**: porcentaje 0–100, no razón 0–1.
- La **escala la fija el dominio**, no los datos: 0–100 para una proporción.
- **`n_fuera` lo cuenta el motor** — la pregunta literal de Gonzalo.
- Cada paso de composición monta por fin su tarjeta estándar; era el último
  criterio del embudo sin ella.

**Un defecto que introduje y cazó la suite**: validé los tres campos opcionales
con el helper de los obligatorios, para el que faltar ES estar mal. Toda señal sin
esos campos quedaba rechazada, y con ella la radiografía entera —frente a un
backend anterior o cualquier fixture previo—. El compilador no podía verlo: los
campos existían en el tipo (patrón 49).

El oráculo de hash se re-bendijo tras probar el cambio **confinado**: podando los
doce campos y devolviendo los momentos a la escala 0–1 reaparece exactamente el
hash de F114. Y la suite de R se corrió **antes** de commitear — la regla que
salió de F71 y F114 — y atrapó tanto el oráculo como la lista exacta de campos.
Esta vez el aviso tuvo a alguien mirándolo.

Al revertir, el guard y el comentario de G25 se reescribieron contando el arco
entero en vez de sustituirse: su diagnóstico sigue siendo válido y borrarlo dejaría
la decisión actual sin la razón por la que no es la obvia (patrón 51).

**Gate**: R del área 8 archivos / 78 tests / 0 fallos · typecheck 0 · 1.265 tests
en 134 archivos. **Commits**: `566a5b3d`, `8b434cf8`, `1abe3586`, `3c4787c2`,
`cd94eb88`, `aff4f50a`.

**Pendiente de ver con datos**: el backend R vivo lleva encendido desde el 1 de
agosto y **no toma cambios de R**, así que el contrato v2 no está sirviéndose
todavía. La tarjeta de composición está montada y probada, pero no se ha visto con
cifras reales en pantalla.

### G39 — Seis peticiones de Gonzalo en una sola pasada

Todas salieron de mirar la superficie con el proyecto cargado, y cinco de las
seis eran defectos que el fuente no delataba.

**1 · El orden por CH totales faltaba en dos superficies más.** G37 lo aplicó en
la lista de conmutadores y ahí se quedó. La radiografía de tipo de sesión
ordenaba por **alumnos elegibles** —otra cifra: contesta «dónde hay más gente»,
no «qué pesa en el marco», y como `maxRows` recorta por arriba decidía además qué
filas sobrevivían— y la tarjeta genérica no ordenaba. Tercer aviso del mismo
error de método, así que la regla se mudó a un módulo propio (patrón 52).

**2 · «Descartar» no descartaba.** Restauraba a mano `byVariable[id]`, y el
rango, el mínimo, la tasa y las exclusiones no viven ahí: apagaba el aviso y
dejaba el cambio puesto. El bloque de pruebas del descarte estaba verde porque
**replicaba la implementación** — definía su propio `descartarUno` con las mismas
cuatro líneas (patrón 53).

**3 · La barra del recorrido, antes de cada criterio.** Había una sola, a media
lista, diciendo el estado final del recorrido en mitad del camino. Ahora precede
a los seis, con el `before_ch` del motor. Y sin vocabulario interno: «ese nombre
es solo interno».

**4 · El corte entre las dos mitades.** Panorama entraba como si fuera el
criterio siguiente. Un borde no bastaba —la regla base de Panorama declara los
suyos en atajo, así que un `border-top` propio ni siquiera ganaba—: el corte dice
en voz alta qué empieza.

**5 · Qué cuesta cada posición del deslizador.** Sumar los cubos del histograma
falla justo en el umbral: son cerrados por la derecha y el curso-horario que está
exactamente en el corte cae del lado equivocado. Medido: 5 contra 4. Invertir la
convención arregló catorce cortes de quince y dejó el extremo. El motor publica
los 21 descartes exactos y la superficie consulta (patrón 54).

**6 · Todo se pliega, y hay un control para todos.** Composición era el único sin
plegado, retirado en G33 por buenas razones que no eran ésta: **plegado por
defecto** esconde, **plegable** es una herramienta del lector (patrón 55). La
orden viaja por contexto y sellada con versión; sin sello, plegar → abrir una →
plegar no haría nada (patrón 56).

**Lo que más enseña de esta iteración**: migré cinco tarjetas de seis. La sexta
vivía en otro archivo y mi `grep` estaba acotado al directorio de las otras.
**Medirlo en la app —5 de 6— fue lo que lo encontró.** Y cuando escribí el guard
para que no volviera a pasar, su primera versión señaló dos falsos positivos: un
botón de preset y un detalle, que arrancan cerrados porque no son parte de la
superficie sino cosas que el usuario abre. El guard bueno distingue por el valor
inicial, no por el nombre.

**Gate**: R del área con la tabla exacta en los 21 cortes · typecheck 0 · 3.465
tests en 420 archivos. **Commits**: `ac563d96`, `28f53031`, `d22913b9`,
`d13f6b83`.

**Sigue sin poder verse con datos**: el backend R lleva encendido desde el 1 de
agosto y no toma cambios de R. El contrato v2 de composición —eje 0–100,
«quedan fuera» y la tabla por corte— está en el motor y en la superficie, pero
no se está sirviendo hasta reiniciarlo.

### G39 (cont.) — El botón grande era overkill, y la alternativa ya estaba escrita

Gonzalo: «¿la actualización no debería también poder ser solo por criterio cuando
lo confirmamos, y este botón solo si quiero un cambio que involucre a ambas
dimensiones?».

Tenía razón, y el hallazgo fue que **el mecanismo existía entero** —motor de
preview, endpoint, cliente, normalizador, coordinador con debounce y cancelación,
y un hook— con un solo montaje: la consola de detalle que G20 retiró. Al quitar
el host, el mecanismo no dio error ni dejó hueco; simplemente la única forma de
ver el efecto de un criterio volvió a ser reconstruir las dos dimensiones
(patrón 57).

Subido al nivel de la pestaña, la cascada que alimenta las barras, la matriz y el
cierre es la viva. Y salieron dos defectos que dentro de una sola tarjeta no se
notaban: el recorrido **parpadeaba** de vuelta a la ejecutada entre pulsaciones, y
el aviso que explica por qué el preview no está disponible desaparecía antes de
poder leerse. Ese aviso lo había escrito F47 con cuidado y llevaba invisible desde
G20 (patrón 58).

**Un intento descartado, escrito para que no se repita.** Quise rehidratar el
contexto transitorio desde el marco guardado para que el recálculo por criterio
funcionara también al abrir un `.pulso`. Todo parecía encajar hasta que apareció
lo que no viaja: los valores por curso-horario de cada criterio se derivan del
catálogo de curso-horario, una tabla de origen. Sin ellos el evaluador recibe
cadenas vacías y devuelve un recorrido **plausible y falso** — no lanza, no
avisa, admite lo que no debía. Retiré el código a medias entero (patrón 59).

**El reparto que queda**, medido y nombrado en el aviso: el preview recalcula los
cursos-horario de cada paso sobre el marco ya construido; la población de
estudiantes exige releer la base, y para eso está el botón.

**Precondición viva**: el motor exige que el marco se haya construido en esta
sesión. Al abrir un `.pulso` guardado el preview responde `STALE` hasta la
primera reconstrucción; después, los criterios ya se actualizan uno a uno.

**Commits**: `b8eba383`, `dba0fef4`. **Gate**: typecheck 0 · 3.465 tests en 420
archivos.

### G39 (cierre) — Por qué el contrato de composición sigue sin verse

El backend R **sí** tiene el motor nuevo: el proceso del 8787 arrancó a las 11:04
y el último cambio de R es de las 10:47. El bloqueo que arrastraba este doc —«un
backend vivo no toma cambios de R»— dejó de existir.

Lo que impide verlo es otra cosa, y es del fixture. Reconstruir el marco de
`f111-seed` desde el proyecto guardado da, de forma reproducible:

> Base leída y marco construido: **0 de 29.083 estudiantes únicos elegibles** y
> 5.263 cursos-horario elegibles.

Cinco mil cursos-horario sobreviven y ningún estudiante. Sin población elegible
no hay distribución de composición que dibujar, así que las tarjetas de los tres
pasos salen sin evidencia — correctamente: la superficie no fabrica lo que el
motor no publicó.

**Atribución**: encaja con el daño del anonimizador documentado en la sección
Pendiente de este ADR (F110) — `.pulso_pii_clasificar_columna` casaba `nombre`
por subcadena y sustituyó valores de columnas legítimas por nombres inventados.
Los rótulos de facultad de este proyecto son exactamente esa firma («Karina E
Karina», «Andres»), y si los criterios de alumno filtran por facultad contra
valores que ya no existen, el resultado es cero.

El clasificador está reparado; **los fixtures publicados siguen sucios** porque
regenerarlos exige la sal, que no se persiste. Así que la verificación visual del
contrato de composición necesita un proyecto cuyo marco reconstruya con población
— no un arreglo de código.

**Lo que sí está verificado del contrato**: los 7 casos de R (escala 0–100,
`n_fuera`, tabla exacta en los 21 cortes, whitelist), los guards de superficie
con mutación, y el montaje de la tarjeta en los tres pasos. Lo único pendiente es
verlo con cifras en pantalla.
