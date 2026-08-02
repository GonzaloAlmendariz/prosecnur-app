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
