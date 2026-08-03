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

### 23 · Buscar un control y no encontrarlo delata código inalcanzable

Al accionar los controles uno por uno, «Ajustar» no aparecía. La causa no era un
fallo de render: la rama que lo monta es **inalcanzable por construcción** —el
bloque común filtra fuera exactamente los criterios para los que esa rama
existía—. Estuvo muerta desde que se escribió, con typecheck y suite en verde.

Efecto dominó: retirarla dejó `ExcepcionesFacultad` sin ningún punto de montaje,
y su test sigue pasando porque el componente funciona, no porque alguien lo use
—un **falso verde** exacto.

**Mecanismo**: la prueba funcional busca los controles **por su presencia en
pantalla**, no sólo comprueba los que encuentra. Un componente sin punto de
montaje se marca en el propio componente y en su test; **retirarlo es decisión de
producto**, no de un barrido, porque la casa exige doble confirmación para borrar
código.

### 24 · Un guard sólo vale si se comprueba que falla

Cuatro aserciones de este loop comprobaban lo correcto de una forma que **también
habría pasado con el código roto**: `toContain("10")` para verificar que un eje
muestra sus extremos, `toContain("CH")` en una superficie donde «CH» aparece
decenas de veces.

**Mecanismo**: las aserciones se anclan a su contenedor —`>10<` dentro de la
frase, `</strong> CH` en la cifra, el total dentro del pie— y, al menos una vez
por guard nuevo, se comprueba con una **mutación**: romper a propósito el
comportamiento y confirmar que el test falla con el mensaje correcto. Un guard
que nunca se ha visto fallar es una hipótesis, no una garantía.

### 25 · Verificar que la premisa existe antes de auditarla

Una auditoría de contraste en «modo oscuro» midió una paleta clara bajo una
suposición falsa: la app **no tiene modo oscuro** —el bloque
`:root[data-theme="dark"]` define cuatro tokens de repeats y nadie fija el
atributo—. Los valores parecían defectos graves (punto de media con contraste
1,29) y eran artefactos de la premisa.

Es el mismo error que dio «excepción: 0 veces» midiendo la pestaña equivocada y
«el servidor no tiene la corrida» leyendo el 404 de una ruta inexistente.

**Mecanismo**: antes de auditar un modo, un estado o una ruta, comprobar que
existe y está activo. Una medición sobre una premisa falsa no da un resultado
neutro: da un defecto inventado, que cuesta más que no medir.

### 26 · El instrumento tiene que funcionar en el entorno donde se mide

Una medición de rendimiento con `requestAnimationFrame` se colgó treinta
segundos. La app estaba bien: **rAF no dispara con el panel del navegador
oculto**. El síntoma —un timeout— se parece mucho a «la aplicación se colgó», y
llevaba a diagnosticar el sitio equivocado.

**Mecanismo**: antes de creer una medición, comprobar que el método funciona en
el entorno donde se está midiendo. Para superficies en un panel que puede estar
oculto: `MutationObserver` y marcas de `performance`, no rAF.

### 27 · Retirar un duplicado es el último paso, no el primero

El bloque compacto de radiografía duplicaba las categorías de los conmutadores
—482 nodos frente a 86, cada etiqueta dos veces en el mismo criterio—. Retirarlo
era obvio desde el principio y **habría costado tres datos**: matrículas y
cobertura del dato, la leyenda de las marcas de la caja, y el contraste contra
todos los cursos-horario.

La secuencia correcta fue inventariar qué vivía sólo ahí, moverlo pieza a pieza a
la tarjeta —tres iteraciones— y retirar el bloque cuando ya no aportaba nada.
Resultado: **−37 % de nodos y cero duplicación, sin perder un solo dato**.

**Mecanismo**: antes de retirar un bloque que parece redundante, se hace el
inventario de lo que contiene **en exclusiva** y se traslada primero. Un diff que
borra 482 nodos se ve igual haya o no información dentro.

### 28 · La deuda que ningún compilador cobra

El typecheck protege el TSX y **no mira el CSS**. Cuando un componente cambia de
elemento —`<details>` a `<section>`— o una pieza se retira, sus reglas siguen
ahí: válidas, muertas y sin que nada las señale. Medido en el módulo: **95
clases `cmv2-*` declaradas sin un solo uso en el marcado**, entre ellas tres
bloques de `> summary` para piezas que llevaban iteraciones sin ser `<details>`.

Un verde de typecheck sobre un cambio de marcado no dice nada sobre la hoja que
lo estilaba. Es el mismo falso verde de siempre con otra cara: el instrumento
mide un lenguaje y el defecto vive en el otro.

**Mecanismo**: línea base de clases huérfanas **por pestaña**, que sólo puede
bajar (`cssHuerfano.contract.test.ts`). No exige cero —la deuda vieja se paga en
el lote de su pestaña— sino que no entre deuda nueva. El mensaje de fallo trae
los nombres, porque un número a secas obliga a repetir el barrido a mano.

### 29 · El falso negativo es el mismo defecto que el falso positivo

Doce veces en esta sesión una medición más **estrecha** que la realidad inventó
un defecto: panel en vez de documento, `strong` en vez de la fila entera,
`aria-label` en vez del `<label>` envolvente. La decimotercera fue el reverso y
más peligrosa: una expresión que exigía la llave en la misma línea que la clase
**no vio** los selectores multilínea, y un `grep --include=*.tsx` sin comillas se
lo comió zsh y devolvió `0 <details>` cuando había quince.

Un falso positivo cuesta tiempo y se descubre al ir a repararlo. Un falso
negativo **cierra la iteración en verde** y no se descubre nunca.

**Mecanismo**: todo instrumento nuevo se prueba contra un caso que **debe**
encontrar antes de creer su cero. Y los guards se prueban por mutación — con la
condición de que la mutación **compile**: la primera mutación de `<details>` en
F101 rompió el JSX, el run murió antes de evaluar y el «no falló» resultante no
probaba nada sobre el guard.

### 30 · Un contador de pendientes detrás de un click

Particularidades del marco plegaba tres secciones cuya cabecera decía «N
detectados · M a excluir · **K sin decidir**», en un panel titulado «Casos
detectados para tu revisión manual». La cabecera pedía una acción y escondía el
único control que la ejecuta: plegada, la revisión manual no existe.

Es la regla de Gonzalo —«si algo está oculto es un error de diseño»— en su forma
más cara: no se esconde un detalle de apoyo, se esconde **el trabajo**.

**Mecanismo**: C4 comprobado sobre el marcado renderizado **sin interacción**,
que es justo la diferencia entre estar y estar alcanzable
(`ParticularidadesPanel.test.tsx`). Una captura lo probaría una vez; el guard lo
prueba en cada corrida.

### 31 · Un guard que mira el archivo no ve lo que el componente esconde

El guard de «nada plegado» buscaba `<details>` **literal** en cada archivo y daba
verde sobre Aulas. Pero `PanelAvanzado` renderiza un `<details>` cerrado por
dentro, y estaba montado ahí escondiendo **la semilla y los pesos del objetivo**
— lo que determina la muestra en un módulo cuyo propósito es que la selección
sea defendible.

El componente además justificaba el defecto en su propio docblock: «sin esconder
nada — un clic y está todo». Un clic **es** esconder; la frase describe el coste
y lo presenta como su ausencia.

**Mecanismo**: el guard resuelve la transitividad — localiza los componentes
locales que renderizan un `<details>` y exige que cada montaje suyo en área
cubierta declare `defaultOpen`. Y el criterio para plegar queda escrito en el
componente: se pliega lo que **no** es el trabajo ni la evidencia con la que se
decide. Renombrar hojas de salida, sí; nada de la cadena que hace defendible la
selección.

### 32 · El comentario JSX que no puede ir donde lo pongo

Cuarta vez en la sesión: `return ( {/* … */} <Componente …> )`. Un comentario JSX
como primer hijo de `return (` se parsea como objeto literal y rompe el archivo
entero — cinco errores de sintaxis que no señalan la causa.

El typecheck lo caza siempre, así que nunca ha llegado lejos. Lo que cuesta es el
ciclo: escribir, fallar, releer, mover.

**Mecanismo**: el comentario que explica un elemento raíz va **encima del
`return`**, como comentario de línea. Dentro del JSX sólo cuando ya hay un
elemento padre que lo contenga.

### 33 · Un cero puede llegar por dos caminos que no significan lo mismo

`ch` es el segmento **∩ lo que sigue incluido**
(`actual_idx <- segment_idx[included_actual[segment_idx]]`). Llega a 0 de dos
maneras: la facultad no tiene cursos de esa categoría, o **un criterio los dejó
fuera**. La tarjeta trataba ambos como «sin cursos-horario en esta facultad» y
además ocultaba el contraste en ese estado, así que una categoría con 200 CH en
el marco, excluida, **declaraba no tener ninguno** — y escondía justamente la
cifra que dice cuánto se está dejando fuera.

El defecto no se ve en la pantalla: los dos estados renderizan la misma frase, y
la frase es cierta en uno de los dos. Sólo aparece leyendo qué mide el número.

**Mecanismo**: cuando un valor puede ser 0 por más de una causa, la superficie
necesita el **segundo dato que las separa** — aquí `chContraste`, los CH totales
estén incluidos o no. Y cada camino se prueba por separado: el fixture heredaba
`chContraste: 200`, así que dos pruebas que creían cubrir «no existe» llevaban
tiempo cubriendo «excluida» sin que nadie lo notara.

### 34 · El contenido que faltaba estaba en la tabla del propio ADR

De los seis contenidos que este ADR exige de la tarjeta, cinco estaban. Faltaba
el **efecto de la categoría en el embudo**, que es además lo que Gonzalo pidió
integrar con otras palabras («la cascada viva, mejor integrada y menos lenguaje
AI slop»). No hacía falta dato nuevo: `ch` y `elegibles` ya viajaban, dichos
como cifras y no como consecuencia.

**Mecanismo**: la tabla de contenidos obligatorios se contrasta contra el
componente **campo por campo**, no de memoria. Un ADR que nadie confronta con su
implementación documenta una intención, no un contrato.

### 35 · Dos tratamientos del mismo dato enseñan a desconfiar de los dos

Los criterios categóricos dibujaban sus categorías con la tarjeta; los numéricos
y de rango, con un bloque propio —otro boxplot, otra escala, diez cifras en
lista—. **Ambos describen exactamente lo mismo**: cuántos cursos-horario, cuántos
alumnos y cómo se distribuyen. Quien recorre la pestaña ve dos gráficos que no se
parecen para el mismo hecho, y la conclusión razonable es que miden cosas
distintas — o que ninguno es de fiar.

El bloque además sólo mostraba **cuatro** categorías y ponía el resto en un
contador. Un contador es la forma más barata de esconder: parece que informa.

**Mecanismo**: `adr0057Reglas.contract.test.ts` enumera las superficies que
dibujan categorías y exige que **todas** monten `CategoriaEvidencia`, que ninguna
conserve un gráfico propio en paralelo y que ninguna recorte su lista. Probado
por mutación: volver a un tratamiento propio falla; recortar falla.

### 36 · Una regla se cumple donde se escribió y sigue rota donde nadie miró

La regla 3 —escala compartida— nació de un defecto en la tarjeta de categoría y
se reparó ahí. Mientras tanto `BoxplotElegibles`, en la misma pestaña, seguía
normalizando **cada caja contra su propio `[min…max]`**, y su docblock lo
presentaba como virtud: «así una distribución estrecha se lee con el mismo
detalle que una ancha». Medido: SEMINARIO (18–23) y TEÓRICO (15–156) salían del
mismo ancho, en una tabla que los apila uno debajo de otro para compararlos.

La intención era legítima —detalle de forma— y por eso sobrevivió: nadie la lee
como un defecto mientras la frase que la justifica siga en el archivo.

**Mecanismo**: cuando una regla se escribe a partir de un defecto, se busca ese
mismo defecto **por su forma, no por su archivo** — aquí, cualquier proyección
cuyo denominador sea el rango de la propia serie. El guard nombra las dos
superficies, no una.

### 37 · Un guard que exige que el defecto exista

`movimientoReducido` comprobaba que cada selector animado tuviera contrapartida
en `prefers-reduced-motion`, y abría con `expect(animados.length).toBeGreaterThan(0)`
— es decir, exigía que la hoja **tuviera** animaciones. Al retirar el conmutador,
el gráfico se quedó sin una sola: lo correcto, porque cada marca codifica un
valor y nada que codifique un valor se anima. El guard se puso rojo por hacer
bien las cosas.

Un guard que confunde «cubre todo lo que hay» con «tiene que haber algo» empuja a
añadir movimiento decorativo para pasar en verde. La corrección es de una línea y
el diagnóstico, de varios minutos.

**Mecanismo**: los guards de cobertura se escriben sobre el conjunto, no sobre su
tamaño. Cero elementos es cobertura total, no un fallo.

### 35 · Todos mis fixtures eran plurales

Medido en la app con datos reales: «sus **1 cursos-horario**», «+**1 estudiantes
únicos**». Seis concordancias rotas que ninguna prueba cazó, porque **todos los
fixtures del módulo traían valores plurales** —120 CH, 3.400 estudiantes, deltas
de −3, −72, −60—. La rama del singular no se ejecutaba en ningún sitio.

Los guards de render son fuertes contra la regresión y ciegos a lo que no se les
da. Un valor límite sin fixture es una rama sin cubrir por mucho que el contador
diga 900 pruebas.

**Mecanismo**: **1 es un caso límite como lo son 0 y `null`**, y lleva fixture
propio en toda superficie que cuente algo. Y la verificación en la app con datos
reales no es un lujo del final: es el único sitio donde aparecen los valores que
uno no pensó en inventar.

### 36 · Inventar una dirección en vez de preguntarla

Para verificar Definición navegué a
`calc-muestra/opinion-universitaria/datos/bases`. La sección se llama
`definicion`. `__pulsoNav.ir()` no falló: **no hizo nada**, y la comprobación
siguiente devolvió cero listas — que se lee exactamente igual que «la reparación
no está».

**Mecanismo**: la dirección se saca de `__pulsoNav.recorrido()`, que las publica
todas, en vez de deducirla del nombre de la carpeta. Y tras cada `ir()` se
comprueba `describir()` antes de medir nada: una navegación que no ocurrió
convierte cualquier medición posterior en un falso negativo.

### 37 · Copy dentro de un artefacto persistido

La superficie mostraba **«Regla efectiva» 48 veces**. Ese texto no estaba en
`frontend/src` ni en `api/R` —F71 lo había renombrado— y el proceso R vivo había
arrancado *después* de la reparación. Las tres comprobaciones obvias daban
limpio y el defecto seguía en pantalla.

Venía en el dato: `segment_label` se calcula al construir el marco y **se
persiste dentro de él**. La consecuencia es mayor que un rótulo: **cada `.pulso`
guardado lleva el vocabulario del día en que se construyó su marco**. Renombrar
en una versión no toca los proyectos existentes, y el usuario no tiene cómo
enterarse de que su pantalla muestra palabras retiradas.

Un barrido de vocabulario sobre el fuente —frontend y motor— da verde con el
defecto delante. Sólo aparece midiendo **la pantalla**.

**Mecanismo**: lo que el motor persiste son **llaves estables** (`segment_key`);
el rótulo se resuelve en la capa de presentación (`segmentoRotulo.ts`), con el
`segment_label` del payload como respaldo para llaves que el mapa aún no conoce.
Y la auditoría de vocabulario se hace sobre el texto renderizado, no sobre
`grep`: el fuente no es la única fuente de copy.

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

  **Medido en la app el 2026-08-02 (F109), y es peor de lo que el reporte
  original decía.** La contaminación no está sólo entre las categorías de tipo de
  docente: está **en la dimensión facultad**. El selector rotulado «Facultad» de
  la pestaña de criterios ofrece **17 opciones, de las cuales 16 son nombres de
  personas** — el valor activo al medir era la clave de un docente. Los rótulos
  llegan hasta los `aria-label`: «Condición del curso en ‹nombre de persona›».

  El alcance es la premisa entera de este ADR. La regla 1 dice que **todos los
  criterios son por facultad**; si la dimensión facultad son docentes, cada
  decisión por facultad de esta superficie se está tomando contra un docente.
  Ninguna reparación de presentación lo arregla: la superficie está dibujando
  fielmente lo que el marco le publica.

  Esto sube la prioridad de la pestaña de mapeo por encima de cualquier pulido
  restante de la superficie, y le añade una pregunta que antes no tenía:
  **cuál es la columna de facultad**, no sólo qué categorías tiene cada variable.

  **Causa parcial localizada (F110)**: el mapeo de la pestaña Variables es
  correcto —Facultad→«Facultad», confirmada— y ambas hojas traen su columna de
  facultad. El defecto está antes: `.pulso_pii_clasificar_columna` casaba
  `nombre` **por subcadena**, así que **«Nombre del curso» se clasificaba como
  nombre de persona** y sus valores se sustituían por nombres inventados. Los
  nombres que la superficie muestra son sintéticos —«Karina Y Elena DE LA
  Jimenez» es firma del anonimizador, no un dato de cliente—.

  La consecuencia excede a este módulo: **los proyectos de referencia son las
  fixtures con las que se reproducen bugs**, y una anonimización que ensucia
  columnas legítimas **fabrica bugs fantasma** — se diagnostica el motor por un
  defecto que puso la herramienta de anonimizar.

  Reparado el clasificador. Los fixtures ya publicados **siguen sucios**: se
  anonimizaron con el clasificador viejo y regenerarlos exige la sal, que no se
  persiste. Queda por comprobar si esto explica la dimensión facultad entera o
  sólo una parte.
