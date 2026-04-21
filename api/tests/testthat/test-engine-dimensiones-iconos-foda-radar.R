make_dimensiones_icon_fixture <- function(icon_path) {
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4"),
    p2 = c("5", "4", "5", "4", "5", "4"),
    p3 = c("5", "4", "5", "4", "5", "4"),
    servicio = c("A", "A", "B", "B", "C", "C"),
    stringsAsFactors = FALSE
  )

  attr(dat$p1, "label") <- "P1"
  attr(dat$p2, "label") <- "P2"
  attr(dat$p3, "label") <- "P3"
  attr(dat$servicio, "label") <- "Servicio"

  survey <- data.frame(
    name = c("p1", "p2", "p3", "servicio"),
    type = c("select_one sat", "select_one sat", "select_one sat", "select_one srv"),
    list_name = c("sat", "sat", "sat", "srv"),
    stringsAsFactors = FALSE
  )

  choices <- rbind(
    data.frame(
      list_name = "sat",
      name = c("1", "2", "3", "4", "5"),
      label = c("1", "2", "3", "4", "5"),
      stringsAsFactors = FALSE
    ),
    data.frame(
      list_name = "srv",
      name = c("A", "B", "C"),
      label = c("A", "B", "C"),
      stringsAsFactors = FALSE
    )
  )

  inst <- list(survey = survey, choices = choices, orders_list = NULL)

  d1 <- reporte_dimensiones(
    data = dat,
    instrumento = inst,
    vars = c("p1", "p2", "p3"),
    prefijo = "r100_",
    reemplazar = FALSE,
    orden_por_lista = list(sat = c("1", "2", "3", "4", "5"))
  )

  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      subindice("s1", "S1", c("r100_p1"), icono = icon_path),
      subindice("s2", "S2", c("r100_p2"), icono = icon_path),
      subindice("s3", "S3", c("r100_p3"), icono = icon_path)
    ),
    indices = list(
      indice("idx", "Indice", c("s1", "s2", "s3"))
    )
  )

  list(data = d2, instrumento = inst)
}

make_dimensiones_vertical_fixture <- function(icon_path) {
  dat <- data.frame(
    p1 = c("5", "5", "4", "5", "4", "5", "4", "5", "5", "4", "5", "4"),
    p2 = c("3", "3", "3", "4", "3", "2", "3", "3", "4", "3", "2", "3"),
    p3 = c("2", "1", "2", "2", "1", "2", "1", "2", "2", "1", "2", "1"),
    servicio = rep(c("A", "B", "C"), each = 4),
    stringsAsFactors = FALSE
  )

  attr(dat$p1, "label") <- "P1"
  attr(dat$p2, "label") <- "P2"
  attr(dat$p3, "label") <- "P3"
  attr(dat$servicio, "label") <- "Servicio"

  survey <- data.frame(
    name = c("p1", "p2", "p3", "servicio"),
    type = c("select_one sat", "select_one sat", "select_one sat", "select_one srv"),
    list_name = c("sat", "sat", "sat", "srv"),
    stringsAsFactors = FALSE
  )

  choices <- rbind(
    data.frame(
      list_name = "sat",
      name = c("1", "2", "3", "4", "5"),
      label = c("1", "2", "3", "4", "5"),
      stringsAsFactors = FALSE
    ),
    data.frame(
      list_name = "srv",
      name = c("A", "B", "C"),
      label = c("A", "B", "C"),
      stringsAsFactors = FALSE
    )
  )

  inst <- list(survey = survey, choices = choices, orders_list = NULL)

  d1 <- reporte_dimensiones(
    data = dat,
    instrumento = inst,
    vars = c("p1", "p2", "p3"),
    prefijo = "r100_",
    reemplazar = FALSE,
    orden_por_lista = list(sat = c("1", "2", "3", "4", "5"))
  )

  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      subindice("s1", "S1", c("r100_p1"), icono = icon_path),
      subindice("s2", "S2", c("r100_p2"), icono = icon_path),
      subindice("s3", "S3", c("r100_p3"), icono = icon_path)
    ),
    indices = list(
      indice("idx", "Indice", c("s1", "s2", "s3"))
    )
  )

  list(data = d2, instrumento = inst)
}

extract_score_y_from_plot <- function(plot_obj) {
  gb <- ggplot2::ggplot_build(plot_obj)
  vals <- numeric(0)
  ys <- numeric(0)
  for (d in gb$data) {
    if (is.null(d$label) || is.null(d$y)) next
    lbl <- trimws(as.character(d$label))
    keep <- grepl("^[0-9]+$", lbl)
    if (!any(keep)) next
    vals <- c(vals, as.numeric(lbl[keep]))
    ys <- c(ys, as.numeric(d$y[keep]))
  }
  data.frame(score = vals, y = ys)
}

extract_score_xy_from_plot <- function(plot_obj) {
  gb <- ggplot2::ggplot_build(plot_obj)
  vals <- numeric(0)
  xs <- numeric(0)
  ys <- numeric(0)
  for (d in gb$data) {
    if (is.null(d$label) || is.null(d$x) || is.null(d$y)) next
    lbl <- trimws(as.character(d$label))
    keep <- grepl("^[0-9]+$", lbl)
    if (!any(keep)) next
    vals <- c(vals, as.numeric(lbl[keep]))
    xs <- c(xs, as.numeric(d$x[keep]))
    ys <- c(ys, as.numeric(d$y[keep]))
  }
  data.frame(score = vals, x = xs, y = ys)
}

extract_layer_labels <- function(plot_obj) {
  rec <- function(grob_obj) {
    out <- character(0)
    if (inherits(grob_obj, "text")) out <- c(out, as.character(grob_obj$label))
    if (!is.null(grob_obj$children)) {
      for (nm in names(grob_obj$children)) out <- c(out, rec(grob_obj$children[[nm]]))
    }
    if (!is.null(grob_obj$grobs)) {
      for (i in seq_along(grob_obj$grobs)) out <- c(out, rec(grob_obj$grobs[[i]]))
    }
    out
  }
  labs <- rec(ggplot2::ggplotGrob(plot_obj))
  labs <- trimws(labs)
  labs[nzchar(labs)]
}

test_that(".dim_tint_icon aplica tinte y preserva alpha", {
  img <- array(0, dim = c(1, 1, 4))
  img[1, 1, 1] <- 0.2
  img[1, 1, 2] <- 0.8
  img[1, 1, 3] <- 0.4
  img[1, 1, 4] <- 0.6

  out <- .dim_tint_icon(img, tint_color = "#FF0000")
  expect_equal(out[1, 1, 4], img[1, 1, 4], tolerance = 1e-8)
  expect_gt(out[1, 1, 1], out[1, 1, 2])
  expect_gt(out[1, 1, 1], out[1, 1, 3])

  out_w <- .dim_tint_icon(img, tint_color = "#FFFFFF")
  expect_equal(out_w[1, 1, 1], 1, tolerance = 1e-8)
  expect_equal(out_w[1, 1, 2], 1, tolerance = 1e-8)
  expect_equal(out_w[1, 1, 3], 1, tolerance = 1e-8)
})

test_that(".dim_tint_icon soporta imagen en escala de grises", {
  img_gray <- matrix(c(0.1, 0.9, 0.2, 0.8), nrow = 2)
  out <- .dim_tint_icon(img_gray, tint_color = "#00FF00")
  expect_equal(length(dim(out)), 3L)
  expect_equal(dim(out)[3], 4L)
  expect_true(all(out[, , 2] == 1))
  expect_true(all(out[, , 1] == 0))
  expect_true(all(out[, , 3] == 0))
})

test_that(".dim_outline_icon agrega borde interno sin romper alpha", {
  img <- array(0, dim = c(7, 7, 4))
  img[2:6, 2:6, 1] <- 1
  img[2:6, 2:6, 2] <- 1
  img[2:6, 2:6, 3] <- 1
  img[2:6, 2:6, 4] <- 1

  out <- .dim_outline_icon(img, outline_color = "#000000", outline_alpha = 0.4)
  expect_equal(dim(out), dim(img))
  expect_equal(out[, , 4], img[, , 4], tolerance = 1e-8)
  expect_lt(out[2, 2, 1], img[2, 2, 1])  # esquina interna se oscurece
  expect_equal(out[4, 4, 1], img[4, 4, 1], tolerance = 1e-8)  # centro intacto
})

test_that("graficar_radar valida color y tamaño de íconos", {
  df <- data.frame(
    eje = c("A", "B", "C"),
    grupo = "G1",
    valor = c(70, 75, 80),
    stringsAsFactors = FALSE
  )

  expect_error(
    graficar_radar(
      data = df,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      icono_color_radar = "no-color",
      exportar = "rplot"
    ),
    "icono_color_radar"
  )

  expect_error(
    graficar_radar(
      data = df,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      icono_color_leyenda_radar = "no-color",
      exportar = "rplot"
    ),
    "icono_color_leyenda_radar"
  )

  expect_error(
    graficar_radar(
      data = df,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      icono_size_radar = 0,
      exportar = "rplot"
    ),
    "icono_size_radar"
  )

  p_ok <- graficar_radar(
    data = df,
    var_eje = "eje",
    var_grupo = "grupo",
    var_valor = "valor",
    escala_valor = "proporcion_100",
    mostrar_leyenda_iconos = FALSE,
    exportar = "rplot"
  )
  expect_s3_class(p_ok, "ggplot")
})

test_that("FODA dispersión soporta rectangular y burbuja con leyenda cruce + iconos", {
  skip_if_not_installed("png")

  icon_path <- tempfile(fileext = ".png")
  icon_img <- array(1, dim = c(8, 8, 4))
  icon_img[, , 1] <- 0.3
  icon_img[, , 2] <- 0.3
  icon_img[, , 3] <- 0.3
  icon_img[, , 4] <- 1
  png::writePNG(icon_img, target = icon_path)

  fx <- make_dimensiones_icon_fixture(icon_path)

  p_rect <- graficar_foda_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    nivel = "subindices",
    modo_foda = "dispersion",
    cruce = "servicio",
    corte_score = 75,
    icono_modo = "reemplazar",
    forma_bloque_dispersion = "rectangular",
    icono_size_foda = 1,
    icono_color_foda = "#0066CC",
    mostrar_leyenda = TRUE,
    usar_canvas = TRUE,
    exportar = "rplot"
  )
  expect_s3_class(p_rect, "ggplot")

  p_bub <- graficar_foda_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    nivel = "subindices",
    modo_foda = "dispersion",
    cruce = "servicio",
    corte_score = 75,
    icono_modo = "reemplazar",
    forma_bloque_dispersion = "burbuja",
    radio_burbuja_rel = 1,
    icono_size_foda = 1.1,
    icono_color_foda = "#0066CC",
    mostrar_leyenda_iconos = TRUE,
    mostrar_leyenda = TRUE,
    usar_canvas = TRUE,
    exportar = "rplot"
  )
  expect_s3_class(p_bub, "ggplot")

  labels <- extract_layer_labels(p_bub)
  expect_true(any(labels %in% c("A", "B", "C")))
  expect_true(any(labels %in% c("S1", "S2", "S3")))
})

test_that("FODA dispersion fuerza regla vertical por corte en rectangular y burbuja", {
  skip_if_not_installed("png")

  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(8, 8, 4)), target = icon_path)
  fx <- make_dimensiones_vertical_fixture(icon_path)

  for (forma in c("rectangular", "burbuja")) {
    p <- graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      nivel = "subindices",
      modo_foda = "dispersion",
      cruce = "servicio",
      # 87.5 genera etiquetas "88" por redondeo y prueba el caso de empate (>= corte).
      corte_score = 87.5,
      forma_bloque_dispersion = forma,
      sufijo_puntaje = "",
      usar_canvas = FALSE,
      mostrar_leyenda = FALSE,
      exportar = "rplot"
    )

    pos <- extract_score_y_from_plot(p)
    expect_true(any(pos$score == 88))
    expect_true(any(pos$score < 88))
    expect_true(all(pos$y[pos$score >= 88] > 0))
    expect_true(all(pos$y[pos$score < 88] < 0))
  }
})

test_that("graficar_foda_dimensiones admite modo_semaforo degradado", {
  skip_if_not_installed("png")

  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(8, 8, 4)), target = icon_path)
  fx <- make_dimensiones_vertical_fixture(icon_path)

  p <- graficar_foda_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    nivel = "subindices",
    modo_foda = "dispersion",
    cruce = "servicio",
    corte_score = 75,
    modo_semaforo = "degradado",
    icono_modo = "reemplazar",
    forma_bloque_dispersion = "rectangular",
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  gb <- ggplot2::ggplot_build(p)
  fills <- unique(unlist(lapply(gb$data, function(layer) {
    if (!("fill" %in% names(layer))) return(character(0))
    as.character(layer$fill)
  }), use.names = FALSE))
  fills <- toupper(fills[!is.na(fills) & nzchar(fills)])
  pal <- toupper(c("#D84B55", "#E0B44C", "#3A9A5B", "#DFE5EE"))

  expect_gt(length(fills), 1L)
  expect_true(any(!fills %in% pal))
})

test_that("FODA burbuja acepta radio_burbuja_rel en distintos valores", {
  skip_if_not_installed("png")

  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(8, 8, 4)), target = icon_path)
  fx <- make_dimensiones_icon_fixture(icon_path)

  for (rr in c(0.9, 1.0, 1.2)) {
    p <- graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      nivel = "subindices",
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      forma_bloque_dispersion = "burbuja",
      radio_burbuja_rel = rr,
      usar_canvas = FALSE,
      mostrar_leyenda = FALSE,
      exportar = "rplot"
    )
    expect_s3_class(p, "ggplot")
  }
})

test_that("FODA burbuja reduce solapes extremos en zona densa", {
  skip_if_not_installed("png")

  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(8, 8, 4)), target = icon_path)
  fx <- make_dimensiones_vertical_fixture(icon_path)

  p <- graficar_foda_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    nivel = "subindices",
    modo_foda = "dispersion",
    cruce = "servicio",
    corte_score = 80,
    forma_bloque_dispersion = "burbuja",
    icono_modo = "reemplazar",
    sufijo_puntaje = "",
    usar_canvas = FALSE,
    mostrar_leyenda = FALSE,
    exportar = "rplot"
  )

  pos <- extract_score_xy_from_plot(p)
  expect_gte(nrow(pos), 4)
  dm <- as.matrix(stats::dist(pos[, c("x", "y"), drop = FALSE]))
  diag(dm) <- NA_real_
  expect_true(min(dm, na.rm = TRUE) > 0.03)
})

test_that("graficar_foda_dimensiones valida color, tamaño e input de forma", {
  skip_if_not_installed("png")
  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(4, 4, 4)), target = icon_path)
  fx <- make_dimensiones_icon_fixture(icon_path)

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      icono_color_foda = "invalido",
      exportar = "rplot"
    ),
    "icono_color_foda"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      icono_color_leyenda_foda = "invalido",
      exportar = "rplot"
    ),
    "icono_color_leyenda_foda"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      icono_size_foda = 0,
      exportar = "rplot"
    ),
    "icono_size_foda"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      distancia_icono_chip_foda = -0.01,
      exportar = "rplot"
    ),
    "distancia_icono_chip_foda"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      distancia_minima_icono_chip_foda = -0.01,
      exportar = "rplot"
    ),
    "distancia_minima_icono_chip_foda"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      padding_chip_foda = 0,
      exportar = "rplot"
    ),
    "padding_chip_foda"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      padding_texto_chip_foda = -0.01,
      exportar = "rplot"
    ),
    "padding_texto_chip_foda"
  )

  # Compatibilidad: aliases antiguos siguen funcionando.
  p_alias <- graficar_foda_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo_foda = "dispersion",
    cruce = "servicio",
    corte_score = 75,
    separacion_chip_icono_rel_foda = 0.14,
    separacion_chip_icono_min_foda = 0.019,
    padding_chip_rel_foda = 1,
    padding_chip_label_lineas_foda = 0.10,
    exportar = "rplot"
  )
  expect_s3_class(p_alias, "ggplot")

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      radio_burbuja_rel = 0,
      exportar = "rplot"
    ),
    "radio_burbuja_rel"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      forma_bloque_dispersion = "triangulo",
      exportar = "rplot"
    ),
    "arg"
  )

  expect_error(
    graficar_foda_dimensiones(
      data = fx$data,
      instrumento = fx$instrumento,
      modo_foda = "dispersion",
      cruce = "servicio",
      corte_score = 75,
      colorear_fondo_foda = "si",
      exportar = "rplot"
    ),
    "colorear_fondo_foda"
  )
})

test_that("FODA permite desactivar color de fondo de cuadrantes", {
  skip_if_not_installed("png")
  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(4, 4, 4)), target = icon_path)
  fx <- make_dimensiones_icon_fixture(icon_path)

  p_bg_off <- graficar_foda_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    nivel = "subindices",
    modo_foda = "dispersion",
    cruce = "servicio",
    corte_score = 75,
    colorear_fondo_foda = FALSE,
    mostrar_leyenda = FALSE,
    usar_canvas = FALSE,
    exportar = "rplot"
  )
  expect_s3_class(p_bg_off, "ggplot")
  gb <- ggplot2::ggplot_build(p_bg_off)
  fills <- as.character(gb$data[[1]]$fill)
  expect_true(all(fills == "transparent"))
})

test_that("graficar_radar_dimensiones recibe icono_color_radar sin romper", {
  skip_if_not_installed("png")

  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(4, 4, 4)), target = icon_path)
  fx <- make_dimensiones_icon_fixture(icon_path)

  p <- graficar_radar_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    icono_modo = "reemplazar",
    icono_size_radar = 0.12,
    icono_color_radar = "#C23B22",
    icono_color_leyenda_radar = NULL,
    exportar = "rplot"
  )

  expect_s3_class(p, "ggplot")
})
