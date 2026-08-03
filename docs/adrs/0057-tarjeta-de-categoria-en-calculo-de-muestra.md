# ADR 0057 — La tarjeta de categoría es la unidad de decisión de Cálculo de muestra

- **Estado**: aceptada
- **Fecha**: 2026-08-02
- **Contexto previo**: ADR 0043/0044 (gramática de navegación), `docs/ui-layout-grammar.md` (Contrato de Superficie), `docs/qa/goal-loop-calc-muestra-frontend-2026-08-02.md` (mediciones que motivan esta decisión)

## Contexto

La superficie de criterios de Cálculo de muestra creció por acumulación: un
selector de criterio, una consola de radiografía aparte, un embudo con su propio
lenguaje, tablas por facultad y una matriz de cierre. Cada pieza resolvía algo
real, pero ninguna se hablaba con las demás.

El síntoma medido en el instrumento sembrado: **637 elementos plegados** en una
sola pestaña, la mayoría sin título; la radiografía de las quince facultades
renderizada **dentro** del bloque de una sola (4.719 px repetidos por criterio);
y una decisión que se toma en una zona de la pantalla con la evidencia en otra.

El diagnóstico del usuario, tras varias rondas de ajustes: *«esto amerita un
repensamiento completo y no ajustes superficiales»*. Las correcciones puntuales
seguían encontrando el mismo defecto en sitios distintos porque el defecto era
la estructura, no sus piezas.

## Decisión

**La unidad de diseño de la superficie de criterios es la categoría de criterio,
no el criterio.**

Cada categoría con cursos-horario disponibles se presenta como **un solo
contenedor** que reúne, junto al control que la incluye o excluye:

| Contenido | Por qué está ahí |
|---|---|
| Cantidad de cursos-horario | tamaño de lo que se decide |
| Cantidad de alumnos | el otro grano, explícito, para no confundir matrículas con estudiantes |
| Promedio de alumnos elegibles **con boxplot** | la forma de la distribución, no sólo su centro |
| Cuantiles completos | decidir con P25 o con la mediana exige verlos |
| Efecto de la categoría en el embudo | qué recorta esta decisión, en su sitio |
| Tasa de asistencia | convierte elegibles en presentes esperados |

Cinco reglas que se derivan de esa unidad:

1. **Todos los criterios son por facultad.** No existe el criterio general. El
   mínimo de matriculados es el criterio 1; los criterios 7 y 8 son los
   penúltimos, antes del mayor detalle (los cursos-horario uno por uno).
2. **La matriz pertenece al Panorama por facultad**, en la cabecera. No es un
   cierre del recorrido.
3. **Los boxplots comparten eje y lo muestran.** Un boxplot sin eje visible, o
   normalizado contra su propio rango, no es comparable — y comparar es lo único
   para lo que existe.
4. **Radiografía y criterio son la misma cosa.** No hay una superficie que
   decide y otra que describe.
5. **Todo es dinámico a los criterios previos.** Cambiar un filtro anterior
   recalcula cifras y gráficos de los siguientes.

## Consecuencias

**A favor**

- La decisión y su evidencia ocupan el mismo espacio: se elige viendo.
- Desaparece la duplicación estructural (una consola que repite lo que la tarjeta
  ya muestra) y con ella la mayor parte del contenido plegado.
- El grano queda declarado en cada tarjeta, que es donde se confunden matrículas
  con estudiantes únicos.

**En contra, y asumido**

- La superficie es **más alta**. Con una facultad a la vez y nada oculto, un
  criterio de veinte categorías ocupa varias pantallas. Se acepta: el usuario
  elige una facultad y recorre su detalle. Si el alto resulta excesivo en uso
  real, la palanca es decidir qué categorías merecen gráfico propio — no volver
  a esconder.
- El dinamismo depende del preview del motor, que hoy exige contexto transitorio
  de sesión (ver «Pendiente»).

**Invalidado por esta decisión**

- Criterios generales en la pestaña de estudiante.
- La matriz como bloque de cierre.
- La separación entre la tarjeta de criterio y su radiografía.
- Cualquier ajuste futuro que toque una de estas piezas por separado.

## Lenguaje

Los rótulos nombran lo que el dato es, no la metáfora de la interfaz. «Cascada
viva», «embudo vivo» y similares describen la animación, no la función: se
sustituyen por lo que la pieza informa. Nada técnico del contrato interno —hash,
owner, grano, unidad— aparece en pantalla.

## Errores recurrentes y cómo se previenen

Esta sección existe porque las mismas correcciones se repitieron varias veces
antes de dar con la causa. No es una lista de anécdotas: cada patrón viene con el
mecanismo que hoy lo impide, y ese mecanismo es la parte vinculante.

### 1 · Una regla sin guard es una regla que se rompe

La radiografía se montó en la ruta de estudiante **después** de que la regla
estuviera escrita y dicha dos veces. El gate quedó verde porque los tests de cada
iteración confirman lo que se acaba de construir, nunca lo que está prohibido.

**Mecanismo**: `frontend/src/features/calcMuestra/universidad/__tests__/adr0057Reglas.contract.test.ts`
vigila cada regla sobre el fuente, con independencia de qué componente se toque,
y cita la instrucción que la origina. Una regla nueva de este ADR **no está
adoptada** hasta tener su caso ahí.

### 2 · Medir el efecto en vez del mecanismo

Se concluyó «el embudo no es activo» porque las cifras no cambiaban. Instrumentar
`fetch` mostró lo contrario: la UI pedía el recálculo siete veces por cambio y el
motor lo rechazaba. La conclusión era falsa y costó dos iteraciones.

**Mecanismo**: ante «no pasa nada», se comprueba primero que la acción salió
—petición, evento, estado— antes de afirmar nada sobre el resultado.

### 3 · Sondas recortadas que fabrican defectos

Tres veces una medición mía apuntó a un defecto inexistente: `config` parecía
faltar en un payload porque la captura leía 160 caracteres; «excepción» parecía
no existir porque se midió la pestaña equivocada; los desbordes de Entrega eran
nodos SVG donde `scrollWidth` no significa lo mismo. Las tres apuntaban en la
misma dirección —creer que falta algo que sí está—, que es la que produce trabajo
inútil.

**Mecanismo**: antes de declarar que algo falta, medir el documento y no el
panel, y revisar el alcance de la sonda antes que el código.

### 4 · Quitar ruido y quitar información se parecen en un diff

Al retirar «Procedencia y contrato» se fueron con él dos avisos metodológicos que
sí cambian una lectura: que un criterio es informativo y no altera el N, y que
unos segmentos se solapan y **no se suman**. Lo detectó un test, no la revisión.

**Mecanismo**: lo técnico que sale es el contrato interno —hash, owner, grano,
unidad—. Todo lo que altera cómo se lee una cifra se queda, y su test lo fija.

### 5 · Mover un control no es borrarlo

Un primer intento de retirar la sección «transversales» dejaba «Composición» sin
control en ninguna parte. Se revirtió antes de commitear.

**Mecanismo**: cuando un control cambia de sitio, la iteración no cierra sin
comprobar que su nuevo hogar existe y edita. Regla de la casa (borrados con doble
confirmación) aplicada también a los traslados.

### 6 · Un guard que se dispara con su propia documentación

La primera versión del vigilante de reglas falló contra los comentarios que
explican qué se retiró, empujando a borrar la explicación para pasar en verde.

**Mecanismo**: los guards leen el fuente sin comentarios. Las reglas se vigilan
sobre lo que se renderiza; las razones se conservan escritas.

### 7 · Lógica correcta con render incorrecto pasa todos los tests

El caso más difícil de detectar, y el que más tiempo estuvo verde sin estarlo.
`dominioCategorias()` calculaba bien el dominio compartido: los tests unitarios
pasaban y la regla 3 parecía cumplida. Medido en píxeles sobre la app:

- el eje medía **1.206 px** y las cajas **274, 263, 284 y 315** — ni entre sí;
- el eje estaba en **x = 159** y las cajas en **637–693**, cada una en su columna.

Es decir: dominio común correcto, proyectado sobre anchos distintos y con las
marcas fuera de los datos. **El mismo valor caía en un píxel diferente en cada
categoría**, y unas marcas desalineadas son decoración con aspecto de precisión —
peor que no tener eje, porque invitan a leer un valor que no corresponde.

**Mecanismo**: las reglas que hablan de *comparabilidad* se verifican midiendo
geometría en la app —anchos y posiciones—, no sólo el cálculo que las alimenta.
La escala es una constante compartida (`--cmv2-cat-escala`) vigilada por el
guard, y las marcas viajan pegadas a la caja, alineadas por construcción.

### 8 · Una animación no puede tocar la geometría que codifica un dato

La barra P25–P75 quedó clavada en el primer fotograma de su propia animación
—`matrix(0.02, 0, 0, 1, 0, -6)`—: el ancho computado era correcto (154,7 px) y se
renderizaba a **3 px**. El ancho de esa barra **es el dato**. Una animación que lo
escala puede mostrar un rango falso, así que deja de ser un defecto decorativo y
pasa a ser una **lectura corrupta**: el usuario ve un intercuartil que no existe.

Lo agrava que el fallo lo introdujo el propio intento de «animaciones elegantes».

**Mecanismo**: nada que codifique un valor —ancho, alto, posición— se anima con
`transform`. El movimiento entra por opacidad, que no puede mentir sobre una
magnitud. Vigilado en el guard de reglas, que además compara el porcentaje
declarado en el estilo con el ancho realmente renderizado.

*Nota de honestidad*: al escribir el guard de esta regla repetí el patrón 6 —se
disparó contra el comentario que cita el valor culpable—. Quedó corregido usando
el lector sin comentarios, pero conviene registrar que el error reaparece incluso
recién documentado.

### 9 · Medir números no sustituye a mirar la pantalla

Tras varias iteraciones de mediciones —altos, desbordes, conteos, alineaciones—
una sola captura mostró que **el mismo criterio aparecía tres veces**, con dos
escalas distintas para el mismo dato. Ninguna métrica lo revelaba: cada bloque,
por separado, estaba bien formado.

**Mecanismo**: toda iteración que cambie la composición de una superficie termina
con una captura mirada, no sólo con números verdes. Las métricas detectan
defectos dentro de una pieza; la vista detecta que sobran piezas.

### 10 · Repetir lo normal entierra lo excepcional

Tres casos medidos en la misma superficie: «global» **56 veces** en el Panorama,
«0 CH / 0 matrículas / 0 estudiantes únicos» en **90 celdas** de la matriz, y
cinco cuantiles en guiones por cada categoría sin cursos. En los tres, el texto
era **correcto**: esas facultades sí heredan, esos impactos sí son cero.

Pero una etiqueta que aparece en casi todas las celdas no informa, y sobre todo
**tapa las pocas que sí** —las dos facultades con criterio propio, las seis celdas
con impacto real—, que son exactamente lo que la superficie existe para mostrar.

**Mecanismo**: lo normal se marca (un punto) y se explica en `title`/`aria-label`;
lo excepcional se nombra. Quitar la repetición no puede quitar la información: el
guard exige que lo heredado siga siendo legible por título.

### 11 · Una tabla en ceros se verifica antes de rediseñarse

La matriz entera en cero parecía rota. Consultado el motor, los ceros eran
correctos (`action: "no_aplica"`). Rediseñar sin comprobarlo habría escondido un
dato válido o, peor, «arreglado» un cálculo que funcionaba.

**Mecanismo**: ante una superficie vacía o uniforme, primero se consulta el estado
del motor y sólo después se decide si el defecto es del dato o de su
presentación.

### 12 · Un símbolo, un significado por pantalla

`fmtDecimal` escribía «1,96» con la convención de España mientras el resto de la
app formatea en `es-PE`. En la misma pantalla, «21,362» eran millares y «1,96»
pretendía ser decimal: **la misma coma con dos sentidos**, y el segundo número se
puede leer como 196. Cada valor, por separado, se veía bien.

De paso: `fmtDecimal` reusaba el formateador de KaTeX —donde el separador de
miles no debe aparecer—, así que los decimales grandes salían sin agrupar junto a
enteros que sí agrupaban.

**Mecanismo**: un guard sobre el formateador, no sobre las vistas. Y la regla de
método que lo encontró: **comparar superficies hermanas**, porque ninguna de las
dos estaba mal por separado; lo que estaba mal es que no coincidían.

### 13 · Un guard que no distingue copy de identificador empuja a romper cosas

El vigilante de vocabulario falló tres veces contra código que **debía** contener
el término:

1. **Comentarios** que documentan el defecto —se disparaba contra su propia
   explicación, empujando a borrarla para pasar en verde—.
2. **Atributos `data-*`** como `data-surface-contract="matriz-marginal-criterios"`,
   que las herramientas de QA leen por nombre: cambiarlos habría roto esas
   herramientas sin mejorar una palabra de la pantalla.
3. **Códigos del motor** como `"marginales_no_combinables"`, valores que se
   comparan y no que alguien lee: traducirlos habría roto la comparación.

En los tres casos, la salida fácil —editar el código para que el guard calle—
era la peor. Y en los tres, el guard también encontró defectos **reales** que
ninguna captura alcanzó: un `title` con «gate composition», un aviso con
«downstream».

**Mecanismo**: los guards de lenguaje leen el fuente sin comentarios, sin
atributos `data-*` y sin literales en `snake_case`. Lo que queda es copy, y sobre
copy la regla es absoluta.

### 14 · Dos intentos fallidos seguidos significan que la medición está mal

Un detector marcó «10 desbordes» en una cinta con `overflow-x: auto` —contenido
alcanzable por diseño—. Antes de comprobarlo se hicieron **tres reparaciones de
CSS**, ninguna movió el número, y todas hubo que revertirlas.

**Mecanismo**: cuando dos intentos consecutivos no cambian la métrica, el
siguiente paso no es un tercer intento sino dudar del instrumento. Los detectores
de geometría ignoran lo que vive dentro de un contenedor deslizable.

### 15 · El copy de la superficie no termina en el frontend

Tras dos barridos de vocabulario sobre `frontend/src`, la pantalla seguía diciendo
«aulas» y «benchmark»: esos textos nacen en el motor
(`.cm_aulas_method_explanation` y los avisos de empate de catálogo en
`calc_muestra_aulas.R`). Los guards que sólo miran el frontend dan una falsa
sensación de barrido completo.

**Mecanismo**: las reglas de lenguaje se aplican a **todo texto que el usuario
lee**, nazca donde nazca. Al revisar vocabulario se incluye `api/R` en la
búsqueda, distinguiendo copy de códigos de error y de valores de contrato.

### 16 · El mismo término puede ser correcto en una frase e incorrecto en la de al lado

Al unificar «aula» → «curso-horario» en el motor, cuatro frases debían cambiar y
una no: «conglomerado (**aulas**, manzanas, EESS)» usa «aula» como **ejemplo** de
conglomerado junto a manzanas y establecimientos de salud, no como la unidad de
este módulo. Un find-replace la habría convertido en una frase falsa.

**Mecanismo**: los barridos de vocabulario se revisan frase por frase. Un guard
puede señalar candidatos; la sustitución es una decisión de significado y no se
automatiza.

### 17 · Traducir jerga mal es peor que no traducirla

`gate · aplicado` se tradujo por «recorta el marco». Pero «aplicado» significa
que el criterio se ejecutó, no que excluyera algo: en pantalla quedó «recorta el
marco» encima de «849 → 849 · quedan fuera: ninguno». **La etiqueta afirmaba lo
contrario de su propia fila.**

La jerga original era opaca pero no mentía. Una traducción que interpreta un
estado técnico sin comprobar qué implica introduce una afirmación falsa donde
antes sólo había una palabra difícil.

**Mecanismo**: al traducir un estado del motor, la etiqueta se deriva del **dato
que el usuario está viendo**, no del nombre del estado. Y el guard cubre los dos
casos —cuando pasa y cuando no—, porque la coherencia sólo se demuestra con
ambos.

### 18 · Verificar sin forzar el remontaje acusa al código sin razón

Seis veces en la sesión una verificación inicial dio por fallido un cambio que
estaba bien: HMR con módulos viejos, texto transformado a mayúsculas por CSS,
Plotly memoizado, un backend R vivo con el código anterior. En todos los casos el
código era correcto y la medición no.

**Mecanismo**: antes de dar por fallido un cambio, forzar el remontaje de la
superficie —navegar fuera y volver— y comprobar que lo que se mide es lo que se
acaba de escribir. Y cuando el cambio es de motor con el proceso vivo, se declara
comprobado por fuente y suite en vez de fingir verificación visual.

### 19 · Un valor de contrato no se renombra: se traduce al mostrarlo

`metodo_ic = "bootstrap_percentil"` y `suficiencia = "delgada"` llegaban crudos a
la pantalla. No se pueden renombrar en R —el motor los compara por nombre
(`identical(cell$metodo_ic, "bootstrap_percentil")`)—, así que la reparación es
traducirlos en el punto de render y dejar el valor intacto en el contrato.

Caso hermano con la solución opuesta: `"NA"` lo escribía el **frontend**. La
intención era correcta —declarar la ausencia en vez de fabricar un cero— y lo
equivocado era la notación, que es la de R. El guion largo conserva la honestidad
en el idioma del usuario.

**Mecanismo**: el guard vigila los campos conocidos por su nombre
(`{anchor.metodo_ic}`, `{cell.suficiencia}`) en las vistas que los usan, y
prohíbe el literal `"NA"` como notación de ausencia. Lo que no se reconoce pasa
tal cual: un código nuevo del motor en pantalla es preferible a una etiqueta
inventada que lo oculte.

### 20 · Los estados de error son donde la jerga más daño hace

Los avisos de estado —«Contrato inválido», «Resumen legacy», «R publicó el gate,
pero no hay un segmento estadístico visible»— eran los textos más crípticos del
módulo, y aparecen exactamente cuando algo falta: el momento en que el usuario
menos puede permitirse descifrar vocabulario. Un aviso en jerga deja a alguien
bloqueado sin saber si el problema es suyo, del dato o de la app.

**Mecanismo**: los estados se auditan como copy de primera clase, no como
mensajes técnicos de paso. El guard prohíbe vocabulario de implementación en
etiqueta y detalle, **y exige que la garantía metodológica sobreviva** —«no se
rellena con ceros»—, para que quitar jerga no se lleve la promesa que hace fiable
la cifra de al lado.

### 21 · Una lista larga se mide en píxeles **y** en paradas de teclado

La misma lista sin cota produjo dos defectos distintos: 39.899 px de contenido en
una ventana de 360 —invisible salvo desplazándose 110 pantallas— y, en otra lista
hermana, **646 paradas de tabulación** para pasarla con el teclado. Cada uno se
detecta con un instrumento distinto y ninguno de los dos ve al otro.

**Mecanismo**: toda lista que renderiza un control por fila se acota, declara su
profundidad y ofrece una salida (búsqueda o «ver todos»). Se verifica en los dos
ejes: alto del contenido frente a su ventana, y número de elementos enfocables de
la superficie.

### 22 · Ningún barrido cosmético prueba que la pantalla siga funcionando

Tras una serie larga de reparaciones de lenguaje, geometría y accesibilidad,
ningún instrumento usado —desbordes, vocabulario, contraste, paradas de teclado—
demuestra que un click siga haciendo algo. Todos miden el DOM en reposo.

**Mecanismo**: una serie de iteraciones sobre la misma superficie cierra con una
prueba funcional mínima en la app: accionar un control y comprobar que su estado
cambia, cambiar el foco de una vista y comprobar que rerenderiza, y contrastar
las cifras de cabecera con las pestañas que las reusan.

## Pendiente

- **Motor**: el preview de criterios exige un contexto transitorio de sesión, así
  que al abrir un `.pulso` guardado el recálculo dinámico se rechaza hasta
  reconstruir el marco. El índice de alumnos que ese contexto necesita se anula
  antes de persistir y `unique_student_ids` se retira por PII, de modo que la
  reconstrucción barata no es viable sin perder el conteo de estudiantes únicos.
- **Dato**: la lista de categorías de tipo de docente mezcla categorías con
  nombres de personas. Cada valor distinto se convierte en control sin
  distinguir qué es.

  Investigado: el motor **ya separa** los roles `teacher` (nombre) y
  `teacher_type` (categoría), con listas de alias distintas —«docente» a secas
  mapea al nombre—. La mezcla no la produce el mapeo: **viene en la columna de
  origen**. Y cuando el catálogo no publica distribución por facultad, no existe
  ninguna señal que distinga una categoría real de un valor intruso, así que
  filtrar exigiría una heurística que descartaría categorías legítimas.

  **Dirección acordada con Gonzalo (2026-08-02)**: hace falta una superficie que
  permita **mapear las categorías únicas** de las variables que conceptualmente
  lo necesitan —pestaña propia después de Datos › Variables—, y que además
  responda dónde vive mejor cada variable: en la base de estudiantes o en la de
  curso-horario. Hoy esa pregunta no tiene dónde formularse, así que un catálogo
  sucio sólo se descubre cuando ya se está decidiendo con él.
