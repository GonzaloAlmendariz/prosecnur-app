# ADR 0092 (F3) — la leyenda de las apiladas la dibuja la lámina con formas
# nativas a 12 pt, en el mismo lugar donde el gráfico tenía la suya.

.plan_apilada <- function() {
  dat <- data.frame(p1 = c(rep("Totalmente en desacuerdo", 4), rep("En desacuerdo", 10), rep("De acuerdo", 40), rep("Totalmente de acuerdo", 46)),
                    stringsAsFactors = FALSE)
  niveles <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  inst <- list(
    survey = data.frame(name = "p1", type = "select_one esc", list_name = "esc", label = "Pregunta", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "esc", name = niveles, label = niveles, stringsAsFactors = FALSE),
    orders_list = NULL
  )
  list(dat = dat, inst = inst, plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas("p1"))))
}

test_that("la apilada declara su leyenda: etiquetas, colores y las capas que la dibujan", {
  skip_if_not_installed("cowplot")
  d <- data.frame(categoria = "Item", N = 100L, t1 = .1, t2 = .2, t3 = .4, t4 = .3)
  p <- suppressMessages(suppressWarnings(graficar_barras_apiladas(
    data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", 1:4),
    etiquetas_grupos = c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA"), exportar = "rplot",
    usar_canvas = TRUE, ancho = 12.5, alto = 4.6,
    colores_grupos = .std_paleta("likert")[1:4])))
  info <- attr(p, "pulso_leyenda_nativa")
  skip_if(is.null(info), "este render no usa la leyenda manual")
  expect_identical(info$etiquetas, c("TD", "D", "A", "TA"))
  expect_length(info$capas, 8L)   # un cuadro y un texto por ítem
  sin <- .ppt_quitar_leyenda(rvg::dml(ggobj = p))
  expect_length(sin$ggobj$layers, length(p$layers) - 8L)
})

test_that("en el PPT la leyenda sale como formas nativas a 12 pt", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  x <- .plan_apilada()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = x$dat, instrumento = x$inst, plan = x$plan,
    presets = p_presets(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas),
    path_ppt = out, mensajes_progreso = FALSE)))
  xml <- paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(xml, "prosecnur:leyenda:texto:", fixed = TRUE)
  expect_match(xml, ">Totalmente de acuerdo<", fixed = TRUE)
  expect_match(xml, 'sz="1200"', fixed = TRUE)
})
