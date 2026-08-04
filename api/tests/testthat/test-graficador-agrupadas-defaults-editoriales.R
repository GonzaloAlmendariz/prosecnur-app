source("setup-load-all.R")

# Defaults editoriales de barras agrupadas (P9 del GOAL loop del motor PPT):
# 1) la serie sintetica unica ("Porcentaje") no muestra leyenda aunque
#    mostrar_leyenda sea TRUE;
# 2) un cruce sin marca institucional recibe colores distinguibles de la
#    paleta de la casa, no el gris uniforme #B8C4CE;
# 3) la Base no se duplica: el caption del grafico la trae y el placeholder
#    del slide ya no la auto-infiere para barras_agrupadas.

.df_una_serie <- function() {
  data.frame(
    categoria = c("Alto", "Medio", "Bajo"),
    N = c(30, 20, 10),
    pct = c(0.5, 0.33, 0.17),
    stringsAsFactors = FALSE
  )
}

.df_cruce <- function() {
  data.frame(
    categoria = c("Alto", "Medio", "Bajo"),
    N = c(30, 20, 10),
    pct_1 = c(0.5, 0.3, 0.2),
    pct_2 = c(0.4, 0.35, 0.25),
    stringsAsFactors = FALSE
  )
}

test_that("la serie sintetica unica no muestra leyenda aunque el knob este en TRUE", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_agrupadas(
    data = .df_una_serie(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
    mostrar_leyenda = TRUE, exportar = "rplot", usar_canvas = FALSE
  )
  expect_identical(as.character(p$theme$legend.position), "none")
})

test_that("una serie unica con nombre propio conserva su leyenda", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_agrupadas(
    data = .df_una_serie(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = "pct", etiquetas_series = c(pct = "Docentes"),
    mostrar_leyenda = TRUE, exportar = "rplot", usar_canvas = FALSE
  )
  expect_false(identical(as.character(p$theme$legend.position), "none"))
})

test_that("un cruce sin colores declarados recibe colores distinguibles (no gris uniforme)", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_agrupadas(
    data = .df_cruce(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Mujer", pct_2 = "Hombre"),
    mostrar_leyenda = TRUE, exportar = "rplot", usar_canvas = FALSE
  )
  b <- ggplot2::ggplot_build(p)
  fills <- unique(unlist(lapply(b$data, function(d) if ("fill" %in% names(d)) unique(d$fill))))
  fills <- toupper(fills[!is.na(fills)])
  expect_gte(length(fills), 2L)
  expect_false("#B8C4CE" %in% fills)
})

test_that("el slide de un grafico agrupadas muestra la Base una sola vez", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  df <- data.frame(p1 = rep(c("Alto", "Medio", "Bajo"), c(30, 20, 10)))
  inst <- list(
    survey = data.frame(name = "p1", type = "select_one l1", list_name = "l1", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "l1", name = c("Bajo", "Medio", "Alto"),
                         label = c("Bajo", "Medio", "Alto"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = df, instrumento = inst,
    plan = list(d1 = p_slide_1_grafico(p_barras_agrupadas(var = "p1"), titulo = "T")),
    presets = p_presets(), path_ppt = out_ppt, mensajes_progreso = FALSE
  )
  slide_xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_identical(lengths(regmatches(slide_xml, gregexpr("Base:", slide_xml, fixed = TRUE)))[[1]], 1L)

  # La base manual del analista si se materializa en el placeholder.
  out_ppt2 <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = df, instrumento = inst,
    plan = list(d1 = p_slide_1_grafico(p_barras_agrupadas(var = "p1"), titulo = "T",
                                       base = "Base: censo docente")),
    presets = p_presets(), path_ppt = out_ppt2, mensajes_progreso = FALSE
  )
  slide_xml2 <- paste(readLines(unz(out_ppt2, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(slide_xml2, "censo docente", fixed = TRUE)
})
