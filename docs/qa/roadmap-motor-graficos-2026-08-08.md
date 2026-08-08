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
| Catálogo | 19 graficadores en 6 familias, 20 layouts de slide |
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

### El límite estructural

Los tests cubren **contrato y estructura**, no **composición**. Los ocho
defectos del cierre de equivalencias (2026-08-07) y los dos de la auditoría de
hoy son todos de composición, y ninguno lo habría atrapado un test de los que
existen. De ahí la regla de trabajo: **ante cualquier duda de layout,
renderizar antes de teorizar**, con `debug_ph_bordes = TRUE` para ver el
reparto real de las zonas.

## Eje A — Mejoras del motor

| # | Qué | Por qué duele | Esfuerzo |
|---|---|---|---|
| A1 | `.keep_formals` deja rastro de lo que descarta | Hoy un arg inexistente se pierde **sin señal alguna**. Es la causa raíz de A2 y A3 | S |
| A2 | Cerrar los args muertos | Ver tabla abajo | S |
| A3 | Un solo default por campo | `formato_valor` es `"valor"` en la función y `"porcentaje"` en el registry | S |
| A4 | Identidad en el motor | Cuatro `color_titulo` por defecto distintos entre graficadores | M |
| A5 | Retirar la rama `usar_canvas = FALSE` | El motor fuerza `TRUE` siempre; la rama muerta produce salida degradada | M |
| A6 | Congelar dos archivos más | `graficador_dimensiones.R` y `graficos_metadata.R` crecen sin gobierno | S |
| A7 | Cobertura de composición | Es el hueco que deja pasar los defectos que sí llegan al cliente | L |

### A1 — el descarte silencioso

`.keep_formals()` (`api/R/reporte_plan_helpers.R:1698`) filtra los argumentos
contra los formals de la función y **descarta el resto sin warning ni log**. Un
campo mal escrito, o uno que la cadena de whitelists no propagó, simplemente no
hace nada.

Va primero porque convierte A2 y A3 de auditoría manual en hallazgo automático.

### A2 — args que la UI ofrece y el motor nunca recibe

Verificado respetando las funciones que aceptan `...`:

| Preset | Arg que se pierde |
|---|---|
| `boxplot` | `textos_negrita`, `decimales_promedio` |
| `media_rango` | `textos_negrita`, `decimales_promedio` |
| `dim_heatmap`, `dim_foda`, `dim_heatmap_criterios` | `textos_negrita` |
| `pie` | `debug_lw` |

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

### A6 — dos archivos fuera de gobierno

`graficador_dimensiones.R` (4.935 líneas) y `graficos_metadata.R` (4.398) no
están en `policy.frozen_growth_files` y son los que más crecen después del
monolito que sí lo está. La lista viva se consulta con
`node agentic/sync-agentic-os.mjs --audit`.

## Eje B — Nuevos gráficos

| # | Qué | Estado del motor | Esfuerzo |
|---|---|---|---|
| B1 | Significancia en apiladas y multi | **Ya escrito**: enganchar `.graficos_sig_aplicar` en dos renders más | S |
| B2 | Serie temporal / línea | Desde cero | L |
| B3 | Divergentes (Likert centrado) | Modo de apiladas, no graficador nuevo | M |
| B4 | Dumbbell entre bases | Modo; el df tidy del multibase ya lo alimenta | M |
| B5 | Intervalo de confianza del estimador | Desde cero | M |
| B6 | Coroplético de resultados | Desde cero | L |
| B7 | Múltiple con denominador declarado | Desde cero | M |
| B8 | Lollipop / Top-N | Variante de categóricas | S |

### B2 — el único hueco sin alternativa

No existe ningún gráfico de líneas en el catálogo (`geom_line` solo aparece en
el radar, para su polígono). Olas de PDM, evolución de indicadores y avance de
campo no tienen hoy forma de expresarse.

### B3 y B4 — modos, no graficadores

El precedente es `p_radar(modo = "publicos")`: un modo dentro del graficador,
con el render enganchado por convención de nombre (`.render_radar_publicos`,
resuelto con `inherits = TRUE`) para que el archivo congelado no crezca. Los
divergentes y el dumbbell siguen ese mismo camino.

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

**Ola 1 — cerrar lo abierto.** B1 + A1. La significancia queda completa donde
tiene sentido y el motor empieza a delatar sus propios huecos.

**Ola 2 — el hueco real.** B2. Arrastra decisiones de diseño que conviene tomar
temprano.

**Ola 3 — barrido de deuda.** A2 + A3 + A6, que A1 vuelve mecánicos.

**Ola 4 — lectura.** B3 y B4, ambos como modos.

B5 y B7 entran cuando su decisión metodológica esté tomada. A5 y A7 son de
fondo y no bloquean a nadie.

## Ya entregado (2026-08-08)

- **Significancia en barras agrupadas con cruce.** `graficos_significancia.R`
  consume `comparar_columnas_sig()` de `reporte_cruces.R` —la misma prueba que
  firma las letras del XLSX— sobre los conteos que el render ya produjo, sin
  recalcular denominadores. Se abstiene y lo explica cuando el diseño tiene
  repeats. 52 casos de test.
- **El pie ya no se sale del lienzo.** `.graficos_caption_x()` en
  `graficador_helpers.R` alinea el caption con la columna de contenido en lugar
  del borde absoluto; afectaba a agrupadas **y** a apiladas. 18 casos de test.

## Notas de método

- El gate se escala al diff: `testthat::test_file` de los archivos del área
  tocada, no `test_dir` completo.
- `testthat::test_dir` con `filter` produce **falsos rojos** en los tests que
  usan funciones internas con punto; reproducir siempre con `test_file` antes
  de reportar un rojo.
- Funcionalidad nueva estrena archivo; el archivo congelado lo llama.
