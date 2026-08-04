# B19 del GOAL motor PPT (carril L7, sesion B):
# - max_palabras/min_chars de p_nube_palabras eran FANTASMAS: la UI los curaba
#   pero el puente payload->constructor los descartaba por no ser formals.
# - pie/donut duplicaban la Base (caption del grafico + placeholder del slide):
#   entran a la regla de dedup de P9/P17/P23.

test_that("p_nube_palabras acepta max_palabras y min_chars (ex fantasmas)", {
  el <- p_nube_palabras(var = "opinion", max_palabras = 5, min_chars = 6)
  expect_identical(el$overrides$max_palabras, 5L)
  expect_identical(el$overrides$min_chars, 6L)
})

test_that("pie y donut no duplican la Base en el placeholder del slide", {
  df <- data.frame(
    satisf = c("Sí", "Sí", "No", "Sí"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(name = "satisf", type = "select_one sn",
                        list_name = "sn", label = "Satisfecho",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sn", name = c("Sí", "No"),
                         label = c("Sí", "No"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
  out <- reporte_ppt_plan(
    data = df, instrumento = inst,
    plan = list(
      diapo_001 = p_slide_1_grafico(p_pie(var = "satisf"), titulo = "pie"),
      diapo_002 = p_slide_1_grafico(p_donut(var = "satisf"), titulo = "donut")
    ),
    solo_lista = TRUE, build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )
  bases <- lapply(out$render_meta, function(m) m$base)
  expect_true(all(vapply(bases, is.null, logical(1))))
})

# B20: paleta de la casa en el pie, orden "natural" aceptado (antes match.arg
# lo rechazaba y la lamina moria — B-H27) y suelo ninguno/0.14.

.l7_pie_data <- function() {
  data.frame(
    categoria = c("Muy bajo", "Bajo", "Medio", "Alto"),
    pct = c(13, 21, 25, 41),
    n = c(19, 32, 37, 62),
    stringsAsFactors = FALSE
  )
}

test_that("el pie sin paleta usa la de la casa, no el hue de ggplot", {
  d <- .l7_pie_data()
  p <- graficar_pie(data = d, var_categoria = "categoria", var_pct = "pct",
                    usar_canvas = FALSE, exportar = "rplot")
  built <- ggplot2::ggplot_build(p)
  fills <- toupper(unique(stats::na.omit(unlist(lapply(built$data, function(l) l$fill)))))
  expect_true("#0B4F8C" %in% fills)
  expect_false("#F8766D" %in% fills)
})

test_that("ordenar_categorias='natural' es aceptado y respeta el orden entrante", {
  d <- .l7_pie_data()
  expect_no_error(
    p <- graficar_pie(data = d, var_categoria = "categoria", var_pct = "pct",
                      ordenar_categorias = "natural",
                      usar_canvas = FALSE, exportar = "rplot")
  )
  expect_s3_class(p, "ggplot")
})

test_that("el suelo Pulso del pie respeta instrumento y da aire a la leyenda", {
  suelo <- .PRESETS_DEFAULT_PULSO$pie
  expect_identical(suelo$ordenar_categorias, "ninguno")
  expect_identical(suelo$canvas_h_legend_bottom, 0.14)
})
