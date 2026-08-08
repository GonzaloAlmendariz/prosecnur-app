# Roadmap del motor de Gráficos

Tipo: Roadmap de producto e ingeniería
Estado: Vigente
Fecha: 2026-08-08
Autoridad: Ordena el trabajo; no certifica por sí solo el estado del motor

Este documento ordena dos ejes sobre el motor de Gráficos —la deuda medida y
los tipos de gráfico que faltan— a partir de la auditoría del 2026-08-08. Cada
afirmación de estado tiene su comando de verificación al lado; lo que no se
midió se dice.

## Punto de partida

Medido el 2026-08-08 sobre `main`:

| Dimensión | Valor |
|---|---|
| Motor R | 31 archivos, ~30.100 líneas (`api/R/grafic*.R`) |
| Editor | ~32.700 líneas TS + 35.700 CSS |
| Catálogo | 23 graficadores en 6 familias, 20 layouts de slide |
| Tests R | 48 archivos, ~11.200 líneas |
| Tests front | 42 archivos, 250 casos |

Suites en verde al momento de escribir esto (`testthat::test_file` por archivo;
`test_dir` con `filter` da falsos rojos en tests que usan funciones internas).

### Lo que está bien y no hay que tocar

- **El preview es render real, no maqueta**: genera el PPTX y lo rasteriza. Es
  la decisión más valiosa del motor.
- **El registry del backend es la fuente única** que el editor consume.
- **`.graficos_mk_palette`** es la única fuente de saneo de paletas, con el
  porqué escrito.
- **El multibase (ADR 0064)** vive en motor puro separado del archivo congelado
  y devuelve un df tidy reutilizable.
- **Los tests de contrato existen y sirven**: defaults fósiles, presets floor,
  argumentos de UI, matriz de templates.

### El límite estructural — ahora con un gate

Los tests cubrían **contrato y estructura**, no **composición**. Los ocho
defectos del cierre de equivalencias (2026-08-07), los dos del caption y los dos
de la serie temporal son todos de composición, y ninguno lo habría atrapado un
test de los que existían.

`graficos_composicion_auditar()` (A7) mide ahora tres propiedades del render:
que ningún texto roce el borde, que ninguno se pise con otro y que ninguno baje
del mínimo legible. Cada regla se prueba **sembrando el defecto histórico que la
motivó**. El barrido del catálogo encontró uno nuevo a la primera: la cifra de
la columna extra de barras agrupadas se dibujaba a un tercio del tamaño del
resto — el mismo defecto ya reparado en apiladas meses atrás.

La regla de trabajo no cambia, se refuerza: **ante cualquier duda de layout,
renderizar antes de teorizar**, con `debug_ph_bordes = TRUE`. El auditor dice
dónde mirar; no reemplaza mirar.

## Eje A — Mejoras del motor

| # | Qué | Por qué duele | Esfuerzo |
|---|---|---|---|
| ~~A1~~ | ~~`.keep_formals` deja rastro de lo que descarta~~ | **Hecho** (2026-08-08) | S |
| ~~A2~~ | ~~Cerrar los args muertos~~ | **Hecho** (2026-08-08). 9 de 11 eran defectos; 2 eran herencia declarada | S |
| ~~A3~~ | ~~Un solo default por campo~~ | **Replanteado y hecho** (2026-08-08). Ver abajo: unificar los 76 rompería el diseño | S |
| ~A4~ | Identidad en el motor | **Piso creado** (2026-08-08); falta retro-aplicarlo a los graficadores existentes | M |
| A5 | Retirar la rama `usar_canvas = FALSE` | El motor fuerza `TRUE` siempre; la rama muerta produce salida degradada | M |
| ~~A6~~ | ~~Congelar dos archivos más~~ | **Hecho a medias, a propósito** (2026-08-08). Solo `graficador_dimensiones.R` | S |
| ~~A7~~ | ~~Cobertura de composición~~ | **Hecho** (2026-08-08). Encontró un defecto nuevo a la primera | L |

### A1 — el descarte silencioso

`.keep_formals()` (`api/R/reporte_plan_helpers.R:1698`) filtra los argumentos
contra los formals de la función y **descarta el resto sin warning ni log**. Un
campo mal escrito, o uno que la cadena de whitelists no propagó, simplemente no
hace nada.

Va primero porque convierte A2 y A3 de auditoría manual en hallazgo automático.

### A2 — args que la UI ofrecía y el motor nunca recibía

El censo automático que habilitó A1 encontró **once**, tres más que la auditoría
manual. Cerrados así:

| Arg | Dónde | Desenlace |
|---|---|---|
| `textos_negrita` | boxplot, media_rango, dim_heatmap, dim_foda | **Implementado**, vía `.graficos_face_de()` en los helpers |
| `textos_negrita` | dim_heatmap_criterios | **Retirado**: no dibuja ejes y ya tenía `fontface_texto_criterio` |
| `mostrar_outliers` | boxplot | **Implementado**: estaba clavado en `outlier.shape = NA` |
| `decimales_promedio` | boxplot, media_rango | **Renombrado** al arg real, `chip_decimales` |
| `debug_lw` | pie | **Renombrado** al arg real, `debug_ph_lwd` |
| `mostrar_rango`, `tipo_rango` | boxplot | **No eran muertos**: media_rango hereda ese preset por diseño |

Uno de ellos no era inerte sino que **abortaba el render**: el registry ofrecía
`min_max` donde el motor espera `minmax`, así que elegir «Min-Max» en la UI se
llevaba el mazo por delante con un error de `match.arg`.

### A3 — estaba mal planteado

El barrido sistemático encontró **76** defaults que difieren entre el registry y
la función. Unificarlos habría roto el diseño: son **dos capas deliberadas** —el
registry declara el default del PRESET (la identidad de la casa) y la función el
del motor desnudo (un fallback neutro)—. El preset existe para sobrescribir al
motor.

Lo que sí es defecto es la divergencia **semántica**: la que cambia *qué* dice
el gráfico. Ahí el motor sin preset produce otra lámina, y `reporte_ppt_plan()`
acepta un plan sin presets, así que el camino existe. Se alineó `formato_valor`
(el caso verificado con un render) y las ocho divergencias semánticas restantes
quedaron **gobernadas** por un contrato que las declara con su motivo y falla si
aparece una nueva.

### A6 — solo uno de los dos, a propósito

`graficador_dimensiones.R` (4.946 líneas, 62 funciones, cero declaraciones) es
un monolito de código y quedó congelado. `graficos_metadata.R` (790
declaraciones, 19 funciones) es una **tabla** que crece por diseño con el
catálogo: congelarla cobraría fricción en cada feature legítima sin dar señal.
Lo que le corresponde es partirse en presets / slides / graficadores.

### A4 — el motor no tiene identidad propia

`color_titulo` por defecto vale `#CA5651` en categóricas y nube, `#081F5C` en
agrupadas, `#000000` en apiladas, boxplot y media_rango, y `#004B8D` en
dimensiones. La identidad Pulso vive solo en los presets: si un preset no
llega, el gráfico sale con lo que el graficador tenga a mano.

### A5 — una ruta muerta que degrada

El motor fuerza `usar_canvas = TRUE` (`reporte_plan_ppt.R:4172`), pero cada
graficador conserva la rama alternativa. Esa rama pierde las etiquetas de
categoría y titula la leyenda con el nombre interno de la variable (`.grupo`).
No la ejerce el producto ni la cubre ningún test.

## Eje B — Nuevos gráficos

| # | Qué | Estado del motor | Esfuerzo |
|---|---|---|---|
| ~~B1~~ | ~~Significancia en apiladas~~ | **Hecho** (2026-08-08). En multi-apiladas por temas NO aplica: filas dependientes | S |
| ~~B2~~ | ~~Serie temporal / línea~~ | **Hecho** (2026-08-08). Entre olas, reusando el df del multibase | L |
| ~~B3~~ | ~~Divergentes (Likert centrado)~~ | **Hecho** (2026-08-08). Graficador propio, no modo: ver abajo | M |
| ~~B4~~ | ~~Dumbbell entre bases~~ | **Hecho** (2026-08-08). Exige dos bases exactas | M |
| B5 | Intervalo de confianza del estimador | Desde cero | M |
| B6 | Coroplético de resultados | Desde cero | L |
| B7 | Múltiple con denominador declarado | Desde cero | M |
| ~~B8~~ | ~~Lollipop / Top-N~~ | **Hecho** (2026-08-08). El recorte por top_n se declara | S |

### B2 — cerrado

Era el único hueco sin alternativa: no existía ningún gráfico de líneas
(`geom_line` solo aparecía en el radar, para su polígono). Resuelto como
evolución **entre bases**, que es como Prosecnur modela las olas. La evolución
por una variable de fecha *dentro* de una base sigue sin existir; el graficador
acepta cualquier df tidy `(eje, grupo, valor)`, así que alimentarlo desde una
fecha no exigiría rehacerlo.

### B3 y B4 — graficadores propios, no modos

El roadmap los planteaba como modos siguiendo el precedente de
`p_radar(modo = "publicos")`. Al construirlos resultó que no aplica: un modo se
justifica cuando **para el analista es el mismo gráfico**, y aquí no lo es. El
divergente cambia el eje de `0..100` a `-100..+100` y exige declarar qué
categorías caen de cada lado; el dumbbell cambia la unidad de lectura de la
barra al segmento. Lo que sí se conservó del precedente es el enganche: ambos se
resuelven por convención de nombre y leen su preset con `dynGet`, así que
`reporte_plan_ppt.R` no creció ni una línea.

### B5 y B7 — cambian lo que el gráfico afirma

`media_rango` dibuja IQR o min-max, que es **dispersión de la muestra**, no
**precisión del estimador**. Con ponderación activa, el intervalo de confianza
es lo defendible ante un cliente académico.

En respuesta múltiple no se halló manejo del doble denominador (porcentaje
sobre casos vs sobre menciones). Es un error clásico de reporte y hoy nada lo
impide.

Ambos merecen decisión metodológica explícita antes de implementarse, no solo
diseño técnico.

## Orden propuesto

**Ola 1 — cerrar lo abierto.** ~~B1 + A1~~ — **cerrada el 2026-08-08**. La
significancia llega a apiladas con cruce, se documenta por qué no puede llegar a
multi-apiladas por temas, y el motor ya delata sus propios argumentos muertos.

**Ola 2 — el hueco real.** ~~B2~~ — **cerrada el 2026-08-08**. La serie
temporal existe y reusa el corte del radar entre públicos, así que declararla no
exige declarar nada nuevo.

**Ola 3 — barrido de deuda.** ~~A2 + A3 + A6~~ — **cerrada el 2026-08-08**. A1
cumplió lo prometido: el censo automático encontró más args muertos que la
auditoría manual, y uno de ellos no era inerte sino que **abortaba el render**.

**Ola 4 — lectura.** ~~B3 y B4~~ — **cerrada el 2026-08-08**, más B8 de propina.
Los tres resultaron graficadores propios, no modos.

### Lo que queda, y por qué

Las cuatro olas del roadmap están cerradas, más A7. Estos cuatro ítems quedaron
fuera a propósito, cada uno por una razón distinta:

- **B5 (intervalo de confianza)** y **B7 (denominador de respuesta múltiple)**
  cambian lo que el gráfico *afirma*, no cómo se ve. Antes de escribirlos hace
  falta decidir el método —Wald contra Wilson para el IC; casos contra menciones
  como denominador por defecto— y esa decisión es de la casa, no del motor. Es
  el mismo principio que ya rige la significancia: el indicador se declara, no
  se deduce.
- **B6 (coroplético de resultados)** necesita el marco geográfico que hoy solo
  usa el mapa de cobertura. No se puede verificar sin datos territoriales
  reales, y un mapa que no se pudo mirar no se entrega.
- **A5 (retirar la rama `usar_canvas = FALSE`)** toca cinco graficadores para
  borrar código que el producto no ejerce. El beneficio es limpieza y el riesgo
  es real; merece su propia unidad con su propio gate.

**A4** quedó a medias a propósito: el piso de identidad existe y los
graficadores nuevos nacen con él, pero retro-aplicarlo a los existentes
cambiaría láminas ya aprobadas.

## Ya entregado (2026-08-08)

- **Significancia en barras agrupadas con cruce.** `graficos_significancia.R`
  consume `comparar_columnas_sig()` de `reporte_cruces.R` —la misma prueba que
  firma las letras del XLSX— sobre los conteos que el render ya produjo, sin
  recalcular denominadores. Se abstiene y lo explica cuando el diseño tiene
  repeats. 52 casos de test.
- **El pie ya no se sale del lienzo.** `.graficos_caption_x()` en
  `graficador_helpers.R` alinea el caption con la columna de contenido en lugar
  del borde absoluto; afectaba a agrupadas **y** a apiladas. 18 casos de test.
- **Significancia en apiladas con cruce** (Ola 1). Mismo contraste sobre el
  layout transpuesto: ahí cada fila es un grupo de personas y cada segmento una
  categoría de respuesta. En multi-apiladas por temas **no aplica** —las filas
  son preguntas respondidas por las mismas personas, y la prueba exige grupos
  independientes— y el motor lo declara en vez de callar.
- **Detección de repeats endurecida** (Ola 1). Antes dependía de que el runtime
  propagara `repeat_grain` al ctx del motor PPT; sin esa marca, la ausencia se
  leía como base plana y se emitían letras sobre observaciones dependientes.
  Ahora se pregunta si la **variable graficada** vive dentro de un bloque
  `begin_repeat` del XLSForm, contando la profundidad de anidamiento. Validado
  contra el instrumento real de ACNUR PDM.
- **Serie temporal** (Ola 2). `graficador_serie_temporal.R` más su render de
  plan. Cero líneas nuevas en el archivo congelado: el dispatcher resuelve por
  convención de nombre y el preset se lee con `dynGet`. 42 casos de test.
- **El motor delata sus argumentos muertos** (Ola 1, A1). `.keep_formals()`
  anota lo que descarta en un registro acumulativo
  (`reporte_args_descartados.R`), en vez de perderlo en silencio. Identifica al
  graficador buscándolo entre las `graficar_*` del paquete, porque los call
  sites hacen `fun <- graficar_X` y el `deparse` solo veía `"fun"`.

## Notas de método

- El gate se escala al diff: `testthat::test_file` de los archivos del área
  tocada, no `test_dir` completo.
- `testthat::test_dir` con `filter` produce **falsos rojos** en los tests que
  usan funciones internas con punto; reproducir siempre con `test_file` antes
  de reportar un rojo.
- Funcionalidad nueva estrena archivo; el archivo congelado lo llama.
