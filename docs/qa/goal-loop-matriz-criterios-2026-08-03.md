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
