source("setup-load-all.R")

# R2 del checklist de mandos vivos: ningún control declarado puede no llegar.
#
# En una sesión aparecieron OCHO mandos muertos —controles visibles en el
# inspector que no cambiaban el entregable— y ninguno lo habría visto una
# auditoría de nombres. Este test cubre la clase más burda y la más barata de
# comprobar: un arg declarado que su graficador **ni siquiera puede recibir**.
#
# Encontró seis en su primera pasada:
#   · `angle_x` en apiladas, multi y agrupadas — pertenece a `dim_heatmap`;
#   · `espacio_entre_barras` en multi — no existe en ningún sitio;
#   · `mostrar_rango` y `tipo_rango` en el boxplot — los implementa `media_rango`.

# Args que NO son formals de su graficador y aun así funcionan, porque el plan
# los traduce antes de llamar. La lista es explícita a propósito: una regla
# general del tipo «si aparece en el plan, vale» habría dejado pasar `angle_x`,
# que aparece una vez en el plan pero para OTRO preset. Añadir un nombre aquí
# obliga a escribir dónde se traduce.
TRADUCIDOS_POR_EL_PLAN <- c(
  # `reporte_plan_ppt.R` los aplica al armar la tabla, antes del graficador.
  "excluir_opciones",
  # El plan lo convierte en `ancho_max_eje_y` (`args$ancho_max_eje_y <- wrap_y_eff`).
  "wrap_y",
  # El plan corre el contraste con `.graficos_sig_aplicar_transpuesto()`, mete el
  # resultado en `nota_pie` y luego BORRA los dos args de la lista antes de
  # llamar al graficador. Es el caso más explícito de los tres: el código dice
  # que no deben llegar.
  "mostrar_significancia",
  "significancia_alpha"
)

GRAFICADOR_DE_PRESET <- list(
  barras_apiladas     = "graficar_barras_apiladas",
  multi_apiladas      = "graficar_barras_apiladas",
  barras_agrupadas    = "graficar_barras_agrupadas",
  barras_categoricas  = "graficar_barras_categoricas",
  barras_numericas    = "graficar_barras_numericas",
  histograma          = "graficar_histograma",
  pie                 = "graficar_pie",
  donut               = "graficar_pie",
  radar_tabla         = "graficar_radar",
  boxplot             = "graficar_boxplot",
  media_rango         = "graficar_media_rango",
  barras_divergentes  = "graficar_barras_divergentes",
  lollipop            = "graficar_lollipop",
  dumbbell            = "graficar_dumbbell",
  serie_temporal      = "graficar_serie_temporal",
  puntos_comparativos = "graficar_puntos_comparativos"
)

test_that("todo arg declarado en un preset puede llegar a su graficador", {
  ns <- asNamespace("prosecnurapp")
  revisados <- 0L
  for (preset in names(GRAFICADOR_DE_PRESET)) {
    meta <- .PRESETS_META[[preset]]
    if (is.null(meta)) next
    args <- meta$args %||% list()
    if (!length(args)) next
    f <- get0(GRAFICADOR_DE_PRESET[[preset]], envir = ns)
    if (is.null(f)) next
    fml <- names(formals(f))
    # Un graficador con `...` acepta cualquier cosa y no puede delatar nada.
    if ("..." %in% fml) next

    nombres <- vapply(args, function(a) as.character(a$name %||% ""), character(1))
    # `via_overrides` marca los que viajan por la puerta de overrides porque el
    # constructor del plan no los declara como formal. Llegan, por otra ruta.
    via <- vapply(args, function(a) isTRUE(a$via_overrides), logical(1))

    huerfanos <- setdiff(nombres[!via], c(fml, TRADUCIDOS_POR_EL_PLAN))
    expect_equal(
      huerfanos, character(0),
      info = sprintf("`%s` declara args que `%s()` no puede recibir: %s",
                     preset, GRAFICADOR_DE_PRESET[[preset]],
                     paste(huerfanos, collapse = ", "))
    )
    revisados <- revisados + 1L
  }
  # El control: si el mapa se quedara vacío por un renombrado, el bucle no
  # comprobaría nada y el test pasaría en verde sin medir. Ha pasado en esta
  # misma suite con otro test.
  expect_gt(revisados, 12L)
})

test_that("la lista de traducidos no crece sola", {
  # Cada nombre aquí es un arg que el test deja pasar sin comprobar nada. Si la
  # lista engorda, el test se vuelve decorativo: es la forma que tiene este
  # aserto de dejar de distinguir el caso bueno del malo.
  expect_lte(length(TRADUCIDOS_POR_EL_PLAN), 4L)
  # Y que siguen siendo ciertos: el plan los menciona de verdad.
  plan <- paste(readLines(file.path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE),
                collapse = "\n")
  for (a in TRADUCIDOS_POR_EL_PLAN) {
    expect_true(grepl(a, plan, fixed = TRUE), info = a)
  }
})

test_that("los seis mandos muertos de la primera pasada no vuelven", {
  # Contrato explícito por nombre: un `expect_equal(huerfanos, character(0))`
  # dice QUÉ falla, pero no impide que alguien devuelva justo éstos con otra
  # justificación. Estos seis ya se investigaron uno a uno.
  nombres_de <- function(preset) {
    vapply(.PRESETS_META[[preset]]$args %||% list(),
           function(a) as.character(a$name %||% ""), character(1))
  }
  for (p in c("barras_apiladas", "multi_apiladas", "barras_agrupadas")) {
    expect_false("angle_x" %in% nombres_de(p), info = p)
  }
  expect_false("espacio_entre_barras" %in% nombres_de("multi_apiladas"))
  expect_false("mostrar_rango" %in% nombres_de("boxplot"))
  expect_false("tipo_rango" %in% nombres_de("boxplot"))

  # El control: `angle_x` y los dos del rango SÍ existen donde les corresponde,
  # así que el aserto no pasa por haberlos borrado del producto.
  expect_true("angle_x" %in% nombres_de("dim_heatmap"))
  expect_true(all(c("mostrar_rango", "tipo_rango") %in% nombres_de("media_rango")))
})


# ---------------------------------------------------------------------------
# C5 — lo mismo sobre el registro de GRAFICADORES, que es el que alimenta el
# inspector de cada gráfico. Sus claves son los constructores del plan (`p_*`),
# así que un arg suyo llega por tres vías: es formal del constructor, es formal
# del graficador que lo consume, o viaja por `overrides` (marcado
# `via_overrides` porque el constructor no lo declara).
# ---------------------------------------------------------------------------

CONSTRUCTOR_A_GRAFICADOR <- list(
  p_barras_agrupadas    = "graficar_barras_agrupadas",
  p_barras_categoricas  = "graficar_barras_categoricas",
  p_barras_apiladas     = "graficar_barras_apiladas",
  p_barras_multiapiladas = "graficar_barras_apiladas",
  p_pie                 = "graficar_pie",
  p_donut               = "graficar_pie",
  p_numerico            = "graficar_barras_numericas",
  p_histograma          = "graficar_histograma",
  p_boxplot             = "graficar_boxplot",
  p_media_rango         = "graficar_media_rango",
  p_barras_divergentes  = "graficar_barras_divergentes",
  p_puntos_comparativos = "graficar_puntos_comparativos",
  p_dumbbell            = "graficar_dumbbell",
  p_lollipop            = "graficar_lollipop",
  p_serie_temporal      = "graficar_serie_temporal",
  p_radar               = "graficar_radar",
  p_tabla               = "graficar_radar"
)

test_that("todo arg del registro de graficadores puede llegar al motor", {
  ns <- asNamespace("prosecnurapp")
  revisados <- 0L
  for (clave in names(CONSTRUCTOR_A_GRAFICADOR)) {
    meta <- .GRAFICADORES_META[[clave]]
    if (is.null(meta)) next
    args <- meta$args %||% list()
    if (!length(args)) next

    gf <- get0(CONSTRUCTOR_A_GRAFICADOR[[clave]], envir = ns)
    if (is.null(gf)) next
    fml_graficador <- names(formals(gf))
    if ("..." %in% fml_graficador) next

    cons <- get0(clave, envir = ns)
    fml_constructor <- if (!is.null(cons)) names(formals(cons)) else character(0)

    nombres <- vapply(args, function(a) as.character(a$name %||% ""), character(1))
    via <- vapply(args, function(a) isTRUE(a$via_overrides), logical(1))

    huerfanos <- setdiff(nombres[!via],
                         c(fml_graficador, fml_constructor, TRADUCIDOS_POR_EL_PLAN))
    expect_equal(
      huerfanos, character(0),
      info = sprintf("`%s` declara args que no llegan a `%s()`: %s",
                     clave, CONSTRUCTOR_A_GRAFICADOR[[clave]],
                     paste(huerfanos, collapse = ", "))
    )
    revisados <- revisados + 1L
  }
  expect_gt(revisados, 13L)
})

test_that("los args de significancia se borran antes de llamar al graficador", {
  # No basta con que el plan los mencione: los CONSUME y los quita de la lista.
  # Si algún día dejaran de borrarse llegarían al graficador, que no los acepta,
  # y `.keep_formals()` los tiraría en silencio — un contraste pedido que no se
  # corre y nadie avisa.
  src <- paste(readLines(file.path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE),
               collapse = "\n")
  expect_true(grepl('for (k in c("mostrar_significancia", "significancia_alpha"))',
                    src, fixed = TRUE))
  expect_true(grepl(".graficos_sig_aplicar_transpuesto", src, fixed = TRUE))
})
