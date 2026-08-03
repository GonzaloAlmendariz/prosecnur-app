# ADR 0058 — La matriz de criterios cuenta cómo llegamos al marco

- **Estado**: aceptada
- **Fecha**: 2026-08-03
- **Contexto previo**: ADR 0057 (la tarjeta de categoría es la unidad de decisión), `docs/qa/goal-loop-matriz-criterios-2026-08-03.md`

## Contexto

Al cerrar el diseño de la tarjeta de categoría, Gonzalo pidió la superficie que
va **después** de los criterios:

> «La matriz de criterios tiene que hablar de la historia de forma al revés.
> Tiene que mostrarnos el detalle de cada facultad y hacia abajo con cuántos
> cursos-horario finalmente nos quedamos. Los criterios no hablan de cuántos
> casos agregamos, sino de cuántos quitamos.»

El módulo ya tenía **dos** piezas cerca de eso, y ninguna lo era:

- `calc_muestra_aulas_matriz_embudo` — matriz **marginal**: cada celda quita la
  regla completa sólo para su facultad y vuelve a medir. Su docblock lo dice:
  «no agrega deltas de filas ni de segmentos», así que su fila Total **no es la
  suma** de las facultades. Responde «¿qué recuperaría si quito esta regla?».
- `calc_muestra_aulas_criterios_cascada` — la cascada real, por **paso ×
  facultad**, con `before_ch`, `after_ch` y `excluded_ch`. El dato correcto,
  presentado como una lista de pasos filtrada a una facultad.

## Decisión

**La matriz de criterios es la transposición de la cascada: facultades en filas,
criterios en columnas, y cada celda lo que ese criterio quitó en esa facultad.**

No se calcula nada nuevo. El contrato
`calc_muestra_aulas_criterios_cascada_v1` ya publica exactamente lo que la
matriz necesita; lo que faltaba era la superficie.

Cuatro propiedades que la definen:

1. **Cada celda es una resta, no un aporte.** `excluded_ch` de ese paso en esa
   facultad. Un criterio no añade cursos-horario: los quita.
2. **La fila cierra en lo que queda.** Universo de la facultad menos todos sus
   recortes, con su porcentaje de supervivencia.
3. **La última fila suma las facultades**, y donde se cruza con la última
   columna están los **cursos-horario elegibles**. Es la diferencia con la
   matriz marginal, cuyo total se recalcula y no suma.
4. **El orden de las columnas es el del embudo**, fijado por ADR 0057
   (matriculados primero; mínimo y composición al final). No se reordena:
   reordenar cambia los recortes, porque dos criterios que se solapan quitan
   distinto según cuál va antes.

### El estado del embudo es de la celda

La regla 1 del ADR 0057 —**no existe el criterio general**— gobierna también
esta superficie. Un criterio en edición lo está **en una facultad**, así que:

- se resalta la **celda**, nunca la columna;
- «en espera» afecta sólo a los criterios **posteriores de esa misma fila**: el
  embudo de las demás facultades no se ha movido.

Repartir por columna pondría en duda las filas que nadie tocó.

### La confirmación abre la cascada

Confirmar un criterio es lo que permite recalcular los siguientes: mientras uno
está a medio ajustar, los posteriores no saben sobre qué marco actúan. Sus
cifras siguen en pantalla —son las de antes del cambio— y presentarlas con la
misma firmeza que las confirmadas sería mentir con un número viejo. Por eso el
estado no es «guardado / sin guardar» sino **hasta dónde llega lo que se puede
creer**.

El realce que marca lo recalculado entra **sólo por color y opacidad**. Nada que
codifique un valor se anima con `transform` (ADR 0057, patrón 12).

## Consecuencias

**A favor**

- La procedencia del marco queda visible: de dónde salieron los elegibles.
- Casos como «el mínimo se lleva 36 de los 45 cursos-horario de Gastronomía» se
  ven en una fila; ninguna tarjeta suelta los enseña, porque cada tarjeta mira
  un criterio y aquí lo que pesa es el acumulado.
- No hay dato nuevo que mantener: el contrato ya existía.

**En contra, y asumido**

- Con muchas facultades y muchos criterios la tabla es ancha. Se acepta con
  scroll horizontal propio (No Scroll Jail); la alternativa —recortar columnas—
  escondería criterios, que es lo que este módulo lleva un loop entero evitando.

**Invalidado**

- La matriz marginal como lectura principal. Sigue siendo válida para
  sensibilidad y se conserva, pero no es «la matriz de criterios».

## Pendiente

- **La celda en cero no distingue dos cosas**: un criterio que corrió y no quitó
  nada, y un criterio que esa facultad no aplica. Hoy se ven igual.


## Errores del goal, y cómo se previenen

Igual que en el ADR 0057, cada patrón trae el mecanismo que hoy lo impide, y ese
mecanismo es la parte vinculante.

### 1 · Un guard que se compara consigo mismo siempre cuadra

La matriz sumaba 2.806 cursos-horario cuando el KPI de la cabecera decía 2.799.
`cuadraConElMotor` existía justo para cazar eso y no lo cazó: comparaba el total
de la matriz contra el total de la **cascada ya filtrada por el mismo criterio**
que producía el error. Un guard que aplica la misma transformación que juzga no
juzga nada.

**Mecanismo**: la referencia de un guard viene de fuera de lo que valida. Aquí,
del último paso publicado sin filtrar; en la superficie, del KPI que el usuario
ya está viendo.

### 2 · Un filtro puede cortar la historia un paso antes del final

Descartar los pasos `gate = false` era defendible en abstracto —están fuera del
denominador— y rompía la única promesa de la superficie: contar **de dónde salen
los cursos-horario elegibles**. Las exclusiones manuales quitan cursos de verdad;
sin ellas la matriz aterrizaba en un número que no era el resultado.

**Mecanismo**: una superficie que promete explicar un total termina **en ese
total**. Lo que no encaje en su vocabulario se marca —aquí, columna operativa
con filete y rótulo en cursiva—, pero no se descarta.

### 3 · Replicar un orden que el motor ya decide fabrica un segundo orden

`ordenCriteriosEmbudo` era una lista escrita a mano con el orden del ADR. Los
criterios de estudiante, que en la cascada van **primero**, quedaban al final, y
el confirmador anunciaba «11 criterios quedan en espera» sobre un orden que no es
el que se aplica. Medido tras leerlo del motor: **5**.

**Mecanismo**: cuando el motor publica un orden (`order_source: "motor_r"`), se
lee. La lista del ADR queda de respaldo para cuando ese dato no está, no como
fuente paralela.

### 4 · Dos unidades en un mismo eje se ven iguales

Cinco de catorce columnas eran criterios de **estudiante**: filtran alumnos y
sólo quitan un curso-horario cuando lo vacían. Todas publican `excluded_ch`, así
que la celda medía lo mismo y nada delataba la mezcla.

**Mecanismo**: el eje declara **qué filtra** cada tramo con una fila de grupos.
No se resuelve escondiendo columnas — cinco ceros agrupados dicen algo («ninguno
vació un curso»); cinco ceros sueltos son ruido.

### 5 · El realce del embudo marca lo que cambió, no lo que se está tocando

Encender el realce en la celda en edición anunciaría un cambio que todavía no
ocurrió: confirmar un criterio no mueve ninguna cifra hasta que el marco se
reconstruye.

**Mecanismo**: el realce compara el valor con el del render anterior. El primer
render no cuenta —si contara, la matriz entera parpadearía al abrir y el realce
dejaría de significar «esto se movió»— y sólo entra por color y opacidad
(patrón 12 del ADR 0057).


### 6 · Un cambio pequeño en R no se siente como tocar lógica

La suite de R se rompió **dos veces en la misma sesión, por la misma causa**.
F71 renombró una etiqueta del motor; F114 añadió dos campos a una lista. Ninguno
de los dos se sintió como «tocar lógica», así que en ambos corrí sólo las
pruebas del frontend y ambos se subieron en rojo. El oráculo del payload avisó
puntualmente las dos veces.

Documentar el patrón después de F71 no evitó F114. El aviso existía y el hábito
no cambió, porque el disparador —«¿esto es lógica?»— depende de un juicio que se
toma justo cuando uno está pensando en otra cosa.

**Mecanismo**: el disparador deja de ser un juicio y pasa a ser un hecho
observable. **Si el diff toca `api/`, la suite del área se corre antes de
commitear**, cueste lo que cueste el ciclo. Seis líneas en R y sesenta cuestan lo
mismo de verificar, y el coste de no hacerlo ya se midió dos veces: ~40 commits
en rojo la primera, ~10 la segunda.


### 7 · Construido, probado, enseñado — y nunca cableado

Las cuatro variantes de tarjeta existían con sus guards, se probaron por
mutación y se enseñaron en una hoja de revisión. **Sólo `categoria` estaba
montada.** Gonzalo lo dijo dos veces —«no veo en la app los cuatro tipos de
tarjeta»— antes de que yo lo comprobara; hasta entonces lo estaba dando por
hecho porque el componente existía y sus pruebas pasaban.

Un guard verde sobre un componente prueba que **el componente funciona**, no que
alguien lo use. Y una hoja de revisión con el componente real renderizado prueba
todavía menos: enseña lo que la app *podría* mostrar.

**Mecanismo**: la variante la decide un mapa único (`varianteDeCriterio`) con un
caso que exige que **las cuatro estén cubiertas** — un mapa que nunca devuelve
una variante la deja sin montar. Y la comprobación de que están vivas se hace
**contando en el DOM de la app cargada**, no leyendo el fuente: medido tras
cablearlas, 18 categoría · 3 umbral · 3 proporción · 40 unidad.


### 8 · Un enlace roto no falla: no hace nada

La tarjeta de composición ofrecía «Ajustar la regla común» con un enlace a
`#cmv2-chfp-global-adjustments`, y **ese id no existía en ningún sitio del
módulo**. Era el único camino desde una regla que no se puede editar por
facultad hasta donde sí se edita.

Nada lo delataba: un `href` a un ancla inexistente no lanza error, no aparece en
consola y no rompe ninguna prueba. Simplemente el click no hace nada, y el
usuario concluye que la regla no se puede tocar.

**Mecanismo**: un guard recorre el módulo, junta todos los `href="#…"` y exige
que cada uno tenga su `id` en algún componente. Es barato y cubre la clase
entera, no este caso.


### 9 · Etiquetar el eje con la unidad del control, no con la del dato

Las tarjetas de composición mostraban «Q1 23 %, mediana 30 %, media 31,1 %» y un
eje que llegaba a **200 %**. Un porcentaje no puede pasar de 100 — eso eran
**alumnos elegibles por curso-horario**, la misma distribución que el motor
publica para todos los criterios.

El error fue mío y de una pieza: asumí que si el **umbral** de composición es un
porcentaje, su **distribución** también lo sería. Son cosas distintas. El control
fija una proporción; el gráfico describe un conteo.

Y no es cosmético: «mediana 30 %» se lee como «la mitad de los cursos tiene un
30 % de prevalencia» cuando significa «la mitad tiene 30 alumnos».

**Mecanismo**: la unidad del eje sale de **lo que el motor publica en la
distribución**, nunca de lo que el control edita. La variante `proporcion` se
conserva sin usar hasta que exista una distribución que de verdad lo sea —
usarla sobre un conteo es peor que no usarla— y un caso lo vigila.

### 10 · Una cola larga aplasta la escala compartida

La regla 3 del ADR 0057 exige escala común para poder comparar. Tomada de
`min`/`max`, una sola categoría con cola larga estiraba el dominio hasta 200:
medido en la app, **8 de 19 cajas quedaban por debajo del 5 % del ancho** y la
mediana de anchos era 8 %. Comparar dos rayitas de tres píxeles no es comparar,
así que la regla se cumplía en la letra y se incumplía en su propósito.

**Mecanismo**: el dominio se acota a los **bigotes de Tukey** — la convención
para «hasta dónde llega el grueso»—, no a los extremos. Conserva la escala
compartida y devuelve el ancho a las categorías que deciden. Lo que queda fuera
no se esconde: el motor publica cuántos atípicos hay de cada lado y la caja los
marca en su extremo. Medido tras el cambio: caja mediana del 8 % al **21 %**,
eje de 200 a 60, nada fuera del contenedor.


### 11 · Un boxplot de una observación no es un boxplot

Cinco tarjetas dibujaban una caja de menos del 5 % del ancho. Tres de ellas
tenían **uno o dos cursos-horario y los cuatro cuantiles idénticos** —
30/30/30/30, 24/24/24/24. Con una observación no hay distribución: la caja mide
cero por definición, la densidad es un pico y las cuatro etiquetas se apilan en
cuatro filas repitiendo el mismo número.

Lo grave no es que se vea mal. Es que **un punto disfrazado de resumen
estadístico se lee con la autoridad del segundo**: cuatro cuantiles y una caja
prometen una dispersión que no existe.

**Mecanismo**: por debajo de cuatro observaciones —el mínimo para que un cuartil
caiga sobre un punto distinto de la mediana— no se dibuja el gráfico. Se dice el
valor y se declara por qué no hay resumen. `nSostiene` ausente **no** es
«pocos», es «no lo sé»: callar el gráfico por un dato que no llegó escondería
distribuciones válidas.

Medido tras el cambio: 15 cajas dibujadas de 19, cajas por debajo del 5 % de
cinco a **una**.


### 12 · El mismo criterio con el mismo rótulo, dos veces

«Matriculados / población» y «Composición del curso-horario» aparecían **dos
veces cada uno** en el bloque de facultad: una como control y otra como sección
de evidencia con idéntico título. Leído de arriba abajo, el embudo tenía ocho
turnos donde hay seis, y dos criterios contaban doble.

Nadie lo detectó antes porque las dos tarjetas son legítimas por separado —una
edita, la otra informa— y sólo juntas mienten sobre cuántos criterios hay.

**Mecanismo**: un caso comprueba que **ningún rótulo de criterio se repite** en
la ruta. Es la clase entera, no el par: cualquier control que gane una tarjeta de
evidencia con su nombre volvería a duplicarlo.

### 13 · Dos cosas con nombre de mínimo, y sólo una decide

Convivían «Matriculados / población» y «Mínimo de elegibles por curso-horario».
El primero llegaba además **sin columna mapeada** en el proyecto abierto — un
criterio que no puede actuar ocupando un turno del embudo.

Gonzalo: «el criterio debe ser Mínimo de alumnos elegibles, y como ya
conversamos, es el primer criterio con su tarjeta estándar».

Y estaba **séptimo**: después de modalidad, condición, nivel y tipo de sesión.
Es el criterio que más recorta —en Gastronomía se lleva 36 de 45
cursos-horario— y llegaba cuando ya se habían tomado cuatro decisiones sobre un
marco que él iba a cambiar.

**Mecanismo**: el orden del embudo se declara en un solo sitio y el mínimo abre
la lista. Dos criterios que suenan igual se distinguen por lo que filtran, no
por su nombre.


### 14 · Dos órdenes que no coinciden, y sólo uno se aplica

Medido en la app: la superficie presentaba el mínimo **primero** y el motor lo
aplicaba **undécimo**. Importa porque la cifra de cada tarjeta —«quitarla deja
fuera N cursos-horario»— se calcula en el orden del motor, y dos criterios que
se solapan quitan distinto según cuál va antes. Leer la lista de arriba abajo
describía un embudo que no era el que corrió.

No se resolvía en el frontend: alinear la superficie al motor contradecía la
instrucción de Gonzalo, y alinear el motor a la superficie **cambia las cifras
del marco**. Era una decisión de producto, y la tomó él: «debe ser el orden de
la superficie el que tiene el orden correcto».

El mínimo abre ahora el embudo también en R. Los criterios de **estudiante**
siguen delante a propósito: filtran alumnos, y el mínimo cuenta los alumnos que
sobreviven a ellos — invertir eso cambiaría el significado del mínimo, no sólo
su cifra.

**Mecanismo**: `.cm_criterios_orden_motor` es el único sitio donde vive el
orden, y la superficie lo lee de la cascada publicada en vez de replicarlo
(patrón 3). Verificado ejecutando el motor: los cinco criterios de curso-horario
salen en el orden de la pantalla.

### 15 · El deslizador alineado con el eje que recorta

El nivelador vivía en su propia caja y el gráfico en otra, con anchos distintos.
Arrastrar la manija obligaba a traducir «un tercio de la barra» a «un tercio del
eje» — y las dos barras ni siquiera medían lo mismo.

**Mecanismo**: en modo `alineadoConEje` la pista comparte recorrido con la
escala del gráfico, así que **mover la manija es mover el corte sobre la
distribución**. El campo numérico baja de fila: quitarle ancho al deslizador es
quitarle resolución al gesto que sí recorre la escala.


### 16 · Auditar la lista entera, no reparar lo que se reporta

Gonzalo, tras varias rondas: «no veo que estés revisando esto a detalle, noto
muchos errores constantemente». Tenía razón, y el problema era **el método**:
reparaba cada defecto según llegaba, en vez de enumerar la superficie completa y
mirarla de una vez.

Al hacerlo bien —un solo barrido midiendo título, plegado, tarjeta, variante y
subtítulo de **cada** criterio— salieron cinco defectos a la vez que llevaban
varias rondas apareciendo de uno en uno:

| defecto | por qué no lo veía |
|---|---|
| «Matriculados / población» sin columna mapeada | el subtítulo lo decía y yo miraba el título |
| Mínimo global duplicado | vivía en otro componente que el grep del primero no tocaba |
| «criterio 7» y «criterio 8» obsoletos | el orden cambió (G30) y el ordinal está escrito a mano |
| Prevalencia legacy plegada | mi sonda leía el primer `aria-expanded`, que era otro |
| «Ver todas (42 sin cursos)» plegado | lo justificaba un comentario que yo mismo escribí |

**Mecanismo**: antes de dar por revisada una superficie, se enumera **cada**
elemento de su clase con **todas** las propiedades que la regla gobierna, en una
sola medición. Reparar lo reportado deja siempre el resto.

### 17 · Un número de orden escrito a mano sobrevive al orden que nombra

«criterio 7» y «criterio 8» estaban en los rótulos desde que ese era su puesto.
Al cambiar el embudo (G30) el mínimo pasó a ser el primero y su tarjeta seguía
diciendo «criterio 7».

**Mecanismo**: los rótulos nombran **qué** decide el criterio, nunca su posición.
El orden lo publica el motor y se lee de ahí (patrón 3); escribirlo en una cadena
crea una segunda fuente que nadie actualiza.

### 18 · Plegar no es la única salida al ruido

«Condición del curso» escondía 42 categorías tras «Ver todas (42 sin cursos en
esta facultad)». El motivo era real —42 tarjetas diciendo «sin cursos aquí» son
ruido— pero la salida elegida violaba la regla.

La tercera opción: esas categorías **no tienen distribución, ni cifras, ni
decisión que ofrecer**. Sólo su nombre. Se nombran en una línea y no reciben
tarjeta.

**Mecanismo**: ante contenido que sobra, la pregunta no es «¿lo pliego?» sino
«¿qué tiene esto que merezca espacio?». Si la respuesta es «sólo su nombre», se
escribe el nombre.


### 19 · Un control alineado «casi» no está alineado

Con el ancho ya resuelto, el deslizador medía 1.127 px y el gráfico 1.091: 18 px
de desfase a cada lado, que son el relleno y el borde de la tarjeta que envuelve
al gráfico. La manija señalaba un punto de la escala **desplazado**, y una guía
desviada es peor que ninguna porque se lee con la misma confianza.

Lo llamativo es que yo había declarado el control «alineado» y **no lo había
medido** — el mismo error que Gonzalo llevaba tres rondas corrigiéndome.

**Mecanismo**: la tarjeta **publica su sangrado** como variable y el control lo
compensa con `calc()`. Un `padding-inline: 18px` habría funcionado hoy y se
habría desalineado el día que alguien toque el relleno. Un caso comprueba que la
compensación referencia la variable y no un número.
