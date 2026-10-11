# ADR 0092 (F3) — la leyenda de las apiladas la dibuja la lámina con formas
# nativas a 12 pt, en el mismo lugar donde el gráfico tenía la suya.

.plan_apilada <- function(meta = list()) {
  dat <- data.frame(p1 = c(rep("Totalmente en desacuerdo", 4), rep("En desacuerdo", 10), rep("De acuerdo", 40), rep("Totalmente de acuerdo", 46)),
                    stringsAsFactors = FALSE)
  niveles <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  inst <- list(
    survey = data.frame(name = "p1", type = "select_one esc", list_name = "esc", label = "Pregunta", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "esc", name = niveles, label = niveles, stringsAsFactors = FALSE),
    orders_list = NULL
  )
  list(dat = dat, inst = inst, plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), meta = meta)))
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
  # Desde el ADR 0093 la lámina de un gráfico de escala la compone el motor nativo: la leyenda es parte
  # del grupo del gráfico. La ruta anterior (imagen con leyenda nativa) sigue viva en los paneles y se
  # pide explícitamente con meta$motor_nativo = FALSE.
  for (meta in list(list(), list(motor_nativo = FALSE))) {
    x <- .plan_apilada(meta)
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(
      data = x$dat, instrumento = x$inst, plan = x$plan,
      presets = p_presets(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas),
      path_ppt = out, mensajes_progreso = FALSE)))
    # Lectura binaria: officer escribe la ruta anterior en una sola línea sin salto final y readLines(unz()) la lee vacía
    # en R 4.3.3 (mismo motivo que .pptx_leer_parte, 8804e22).
    xml <- .pptx_leer_parte(out, "ppt/slides/slide1.xml")
    marca <- if (length(meta)) "prosecnur:leyenda:texto:" else 'name="leyenda:texto"'
    expect_match(xml, marca, fixed = TRUE)
    expect_match(xml, ">Totalmente de acuerdo<", fixed = TRUE)
    expect_match(xml, 'sz="1200"', fixed = TRUE)
  }
})

.info_leyenda <- function(alto_npc, libre_npc = 0) {
  list(etiquetas = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"),
       colores = .std_paleta("likert")[c(1:4, 1)], x_centro_npc = 0.6,
       banda_npc = c(y0 = 0.05, alto = alto_npc), libre_abajo_npc = libre_npc)
}

.cajas_se_tocan <- function(p, alto_fila) {
  it <- p$items
  w <- .LEYENDA_CUADRO_IN + 0.07 + it$ancho
  for (i in seq_len(nrow(it))) for (j in seq_len(nrow(it))) if (i < j) {
    ox <- min(it$left[i] + w[i], it$left[j] + w[j]) - max(it$left[i], it$left[j])
    oy <- alto_fila - abs(it$centro_y[i] - it$centro_y[j])
    if (ox > 0.01 && oy > 0.01) return(TRUE)
  }
  FALSE
}

test_that("en un panel angosto la leyenda se reparte de nuevo a su tamaño y no se pisa ni sale (verificador de F2)", {
  for (ancho in c(12.5, 6.1, 3.95)) {
    loc <- list(left = 13.33 - ancho - 0.3, top = 1.2, width = ancho, height = 5)
    p <- .ppt_leyenda_plan(.info_leyenda(0.3), loc)
    expect_false(is.null(p), info = paste(ancho, "in"))
    expect_false(.cajas_se_tocan(p, p$size * 1.45 / 72), info = paste(ancho, "in"))
    w <- .LEYENDA_CUADRO_IN + 0.07 + p$items$ancho
    expect_true(all(p$items$left >= loc$left - 1e-9 & p$items$left + w <= loc$left + loc$width + 1e-9), info = paste(ancho, "in"))
    expect_true(all(p$items$left + w <= 13.33))
  }
})

test_that("si la leyenda no cabe en su banda ni en el aire de abajo, se queda la de la imagen", {
  loc <- list(left = 0.3, top = 1.2, width = 6.1, height = 2.6)
  expect_null(.ppt_leyenda_plan(.info_leyenda(0.04), loc))
  # con aire libre debajo, baja ahí desde el techo de la banda
  p <- .ppt_leyenda_plan(.info_leyenda(0.04, libre_npc = 0.2), loc)
  expect_false(is.null(p))
  techo <- loc$top + (1 - 0.05 - 0.04) * loc$height
  expect_gte(min(p$items$centro_y) - p$size * 1.45 / 144, techo - 1e-9)
})

test_that("la caja del texto va sin márgenes, centrada y sin ajuste de línea", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  x <- .plan_apilada(list(motor_nativo = FALSE))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = x$dat, instrumento = x$inst, plan = x$plan,
    presets = p_presets(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas),
    path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  cajas <- xml2::xml_find_all(xml, ".//p:sp[p:nvSpPr/p:cNvPr[starts-with(@name,'prosecnur:leyenda:texto')]]/p:txBody/a:bodyPr", xml2::xml_ns(xml))
  expect_gt(length(cajas), 0L)
  expect_true(all(xml2::xml_attr(cajas, "wrap") == "none"))
  expect_true(all(xml2::xml_attr(cajas, "tIns") == "0"))
})
