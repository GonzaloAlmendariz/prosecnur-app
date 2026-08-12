# Checklist — nueve arreglos al motor, los presets y el proyecto

Pedido de Gonzalo, 2026-08-11. Documento vivo: se marca sobre él y sólo él lo
cierra. Cada ítem lleva **dónde vive** (motor / preset / proyecto), porque eso
decide quién lo puede tocar y con qué gate.

Proyecto de referencia: `~/Documents/Pulso/ACRD CONTA/V3_Conta 11-08 equivalencias.pulso`.

## Decisiones tomadas

| Pregunta | Respuesta |
|---|---|
| Reparto de colores | **Naranja `#CA5651`**: título de lámina, separadores de sección y Objetivo. **Azul `#081F5C`**: título del gráfico, ejes, etiquetas y leyenda. |
| A qué se aproxima `<1%` | A **0 %**, y que el switcher de ceros sea el que revele que hay algo detrás. |
| Sobre qué actúa el 0,5 % artificial | Sobre el **ancho de la barra**. La etiqueta sigue diciendo el valor real y el resto se recalcula para sumar 100 %. |

## Estado

| # | Arreglo | Dónde | Estado |
|---|---|---|---|
| 1 | Dicotómicos **sin Top 2 Box por defecto** | preset + registro | ☐ sin empezar |
| 2 | Paleta Sí/No de los **pies**: azul y celeste, no turquesa | preset | ☐ sin empezar |
| 3 | **4×4**: cada gráfico con su base **dentro del gráfico**, no en la lámina | motor + preset | ☐ sin empezar |
| 4 | **Objetivo**: el campo de texto sale invertido | motor | ☐ sin empezar |
| 5 | **Colores**: naranja lámina/sección/objetivo, azul gráfico/ejes/etiquetas/leyenda | motor + registro + proyecto | ☑ **hecho** |
| 6 | **Todos los porcentajes** por defecto; el umbral pasa a switcher apagado | motor + registro | ☑ **hecho** |
| 7 | Tablas del **radar nativas de PPT** | motor + **ADR** | ◐ ADR + piezas puras hechas; **falta cablear** |
| 8 | Multiapiladas de pocos bloques: **truncar leyenda** antes que exagerar la separación | motor | ☐ sin empezar |
| 9 | **`<1%` → 0 %** y switcher de ceros con 0,5 % de ancho artificial | motor + registro | ☑ **hecho** |

## Lo que ya se sabe de cada uno

### 1 · Dicotómicos sin Top 2 Box
El motor **ya lo omite** en tiempo de render y lo avisa
(`.barra_extra_minimo = c(top2box = 3L, …)` en `graficador_barras_apiladas.R`):
sumar Sí+No da 100 % en todas las filas. Lo que falta es que sea un **default
declarado** en vez de un rescate con aviso — hoy el proyecto pide la columna,
el motor la quita y emite 13 avisos por mazo.

### 2 · Paleta de los pies
Hoy los pies dicotómicos salen turquesa + azul (láminas 9 y 10). Las barras
Sí/No sí usan azul marino + celeste. Hay que igualarlas.

### 3 · Base por gráfico en el 4×4
Hoy la lámina de perfil lleva **una** base al pie («Base: 178 egresados») y los
cuatro gráficos comparten denominador aunque no siempre coincida — se vio en la
lámina 11, cuyo pie dice «52 docentes y 15 administrativos» para cuatro
gráficos de públicos distintos. Cada gráfico debe declarar la suya.

### 4 · Objetivo invertido
Es el **E-2** del registro. El rótulo vertical «OBJETIVO» se lee de abajo hacia
arriba; en castellano debería girar al otro lado.

### 5 · Colores — HECHO, tras cuatro caminos
Hecho y **verificado en la lámina 8**: «PERFIL DEL EGRESADO» en naranja y
«Sexo», «Año de egreso», «Rango de edades», «Máximo grado alcanzado» en azul.

Causa que había detrás: el título de lámina y el del gráfico **compartían
`color_titulo`**, así que tocar uno movía el otro. Se separó añadiendo
`color_titulo_slide` al registro (default naranja), dejando `color_titulo` para
el gráfico (default azul), y cortando la cadena de la lámina para que ya no
caiga en `color_titulo` (`reporte_plan_ppt.R:398-404`).

**El separador costó tres hipótesis refutadas**, y merece quedar escrito porque
el color de un título en este motor se decide en CUATRO sitios:

1. `.styled_slide_title()` (`reporte_plan_ppt.R:398`) — portada, sección y lámina.
2. Un segundo dibujante en `reporte_plan_ppt.R:7736` que leía `color_titulo`
   directo, para los slides que no pasan por el primero.
3. La whitelist de `p_presets()` — descartada: `normalize_block` no filtra nada.
4. **`.enriquecer_presets()` (`router_graficos.R:1771`), que era el culpable**:
   si nadie declara `color_titulo_seccion`, lo rellena con `color_subtitulo`
   «para que el divisor tenga un acento cromático coherente». Deliberado, y por
   eso invisible: el separador no era naranja por herencia del título sino azul
   por herencia del subtítulo.

Se subordinó esa herencia a `color_titulo_slide`: si el analista lo declara,
manda él. Verificado en la lámina 12, que vuelve al naranja.

Detalle que confirma que el nombre era el correcto: `color_titulo_slide` ya
existía en `graficos_preset_acreditacion.R:215`.

### 6 · Todos los porcentajes por defecto — HECHO

No era `umbral_etiqueta` —con 0,1 % un 4 % se dibuja— sino
**`umbral_ocultar_etiqueta`, que el motor se inyectaba solo**. Dos reglas
automáticas de `reporte_plan_helpers.R` lo ponían en **0.15**, o sea escondían
toda etiqueta de valor ≤ 15 %:

- baterías `barras_multiapiladas` en modo `var` con **tres o más variables**;
- cualquier apilada o multiapilada en un slot de **menos de 7,25 in**.

Medido con `trace()` sobre las 51 llamadas del mazo: dos combinaciones de
umbral, `ocultar = 0` en unas y `ocultar = 0.15` en las que caían en esas
reglas. Nada lo decía, y es justo donde vive el dato interesante de una escala
de acuerdo.

Ahora hay interruptor **`ocultar_etiquetas_pequenas`, apagado por defecto**
(`graficador_umbral_etiquetas.R`), las dos inyecciones automáticas se retiraron
y el umbral conserva su significado pero sólo se aplica cuando se pide.

Verificado en la lámina 42: vuelven los 6 %, 2 %, 4 %, 8 % y 6 % que faltaban.

### 7 · Tablas nativas — ADR hecho, falta cablear

**No estaba bloqueado, y la premisa que yo di era falsa.** El ADR 0071 habla de
*charts*, no de tablas, y su razón —PowerPoint no reposiciona una etiqueta que
no entra— no tiene equivalente en una rejilla de filas y columnas. El registro
lo había anotado como «0 tablas nativas… contradice el ADR 0071» y de ahí salió
la idea de que hacía falta revertirlo.

El contraejemplo estaba delante: la **tabla de ficha técnica ya se emite
nativa**, con `flextable`, en `.make_technical_table_flextable()`
(`reporte_plan_ppt.R:807`).

**ADR 0072** fija que toda tabla del entregable va nativa, precisando el alcance
del 0071 sin revertirlo. Registrado en el índice y anotado en el propio 0071.

**Pieza 1 hecha** (`reporte_plan_tabla_nativa.R`, 19 tests):
`.tabla_nativa_partir_slot()` divide el slot del gráfico —`spec$loc` es
`list(left, top, width, height)` en pulgadas— en gráfico a la izquierda y tabla
a la derecha, y devuelve `NULL` cuando no es partible para que el llamador
dibuje como antes. `.tabla_nativa_flextable()` construye la tabla **con**
encabezado; la ficha técnica borra el suyo con `delete_part()` porque su primera
columna ya nombra cada fila, aquí el encabezado lleva los públicos comparados y
es parte del dato.

Con eso **no hace falta un contrato de lámina nuevo**: se parte el slot que ya
existe, que era la pieza que yo daba por más cara.

**Pieza 2 pendiente, con un obstáculo localizado.** El data.frame ya se calcula
dentro del graficador —`.make_tabla_ttb_df()`, línea ~1427 de
`graficador_radar.R`— y basta con adjuntarlo al canvas y no pintar el grob. Dos
avisos para quien lo retome:

- **No cortar con `return()`** en el bloque de la tabla: la leyenda del radar se
  dibuja DESPUÉS y se pierde. Hay que omitir sólo el `draw_grob` de `tab_draw`.
- El bloque `if (isTRUE(mostrar_tabla_derecha))` de la línea 1356 está **anidado
  bajo otra condición sin identificar**. Un intento con `mostrar_tabla_derecha =
  TRUE` no llegó a entrar: el atributo no se emitió. Hay que averiguar cuál es
  esa condición antes de tocar nada más; probablemente `usar_canvas`.

**Pieza 3**: colocar los dos specs en `slide_1`, donde hoy hay un único
`ph_with_strict(doc, rvg::dml(ggobj = p), plot_slot)` (`reporte_plan_ppt.R:8164`).

Los ~20 parámetros de dibujo a mano (`tabla_padding_mm`, `tabla_auto_fit`,
`tabla_clip`…) quedan obsoletos con el paso 2; el ADR pide mantenerlos leídos
para no romper proyectos guardados y retirarlos de la superficie de edición.

### 8 · Leyenda vs separación entre bloques
Relacionado con el hallazgo de que **cada bloque de una multilista es una unidad
configurable**: se renderiza con sus propios `overrides` y acepta `altura_rel`
(`reporte_plan_ppt.R:4607` y `:4748`). El reparto vertical sale de
`.multilista_block_height`, que suma filas + título + **leyenda**; ahí es donde
se paga la separación. Permitir que la leyenda encoja o se trunque baja ese
coste.

### 9 · `<1%` y el switcher de ceros — HECHO

**9a.** `.pulso_fmt_pct_unidades()` escribe **`0%`**. El `<1%` era una notación
que no existe en el entregable: el analista pega esa cifra en un informe y tiene
que explicar un símbolo que nadie usa. Verificado en la lámina 66, fila
«Docentes» del segundo bloque.

**9b.** Interruptor **`mostrar_categorias_en_cero`, apagado por defecto**
(`graficador_ceros_visibles.R`). Encendido, cada categoría en cero recibe un
piso de **0,5 %** de ancho y el resto de la fila se recomprime en proporción,
así que la barra sigue sumando 100 %.

Lo que costó trabajo no fue el reparto sino que **la etiqueta salía de la misma
columna que la geometría** (`.valor_plot`): inflar el ancho habría rotulado
«0.5%» donde el dato es 0 %, justo el dato falso que esto viene a evitar. Se
separaron: `.valor_plot` gobierna el ancho y **`.valor_pct_real`** es la que se
rotula. El test lo comprueba sobre el objeto ggplot real, no sobre la regla.

## Causa raíz del desorden de las escalas *(2026-08-11, reparada)*

El ítem 5 del lote y el reordenado a mano de dos `.pulso` venían del mismo sitio,
y no era el motor de gráficos.

`.add_recoded_q()` (`codificacion_aplicar_instrumento.R`) arma el catálogo de
cada lista `*_recod` y **sólo lo ordenaba con `choices_order = "alphabetical"`**.
El default es `original_first`, así que el orden acababa siendo el de aparición
**en los datos**, que es arbitrario.

Medido en «Conta 11-08»: el instrumento **original** de docentes ni siquiera
contiene `lst_p4_recod` —esa lista la crea la adaptación— y salía declarada como
`3, 1, 2, 4`. En el mazo se leía «De 30 a 35 · De 22 a 25 · De 26 a 29 · De 36
años a más». El analista había declarado su codificación en orden; nadie la
reordenaba después.

Reparado en `codificacion_orden_catalogo.R`: **si los códigos son numéricos, el
catálogo sale por su valor**, que es lo que significa una recodificación
ordinal. Los catálogos con códigos no numéricos conservan su orden de aparición
—ahí el número no ordena nada— y `alphabetical` sigue mandando cuando el
analista lo pide. Los valores especiales (80–100) los sigue empujando al final
el bloque que ya existía.

Ojo: esto arregla los `.pulso` que se **generen a partir de ahora**. Los dos ya
corregidos a mano no dependen de ello.

## Trampas vigentes

Las del registro (`registro-motor-graficos-2026-08-10.md` §8) siguen todas en
pie. Las dos que más pesan aquí:

- **El registro no es el motor.** `.PRESETS_META` alimenta la UI; los defaults
  con los que dibuja el motor están en `p_presets()` y en las formals del
  graficador. Cambiar un `default` del registro **no cambia el render**.
- **Persistir no es aplicar.** Un valor guardado en el `.pulso` y visible en
  pantalla no prueba nada sobre el entregable. La prueba es el render.
