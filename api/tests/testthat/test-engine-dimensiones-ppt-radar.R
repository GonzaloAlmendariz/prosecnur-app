make_dimensiones_ppt_fixture <- function(low = FALSE) {
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4"),
    p2 = c("5", "4", "5", "4", "5", "4"),
    p3 = c("5", "4", "5", "4", "5", "4"),
    servicio = c("A", "A", "B", "B", "C", "C"),
    stringsAsFactors = FALSE
  )
  if (isTRUE(low)) {
    dat$p1 <- "1"
  }

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
      subindice("s1", "S1", c("r100_p1")),
      subindice("s2", "S2", c("r100_p2")),
      subindice("s3", "S3", c("r100_p3"))
    ),
    indices = list(
      indice("idx", "Indice", c("s1", "s2", "s3"))
    )
  )

  list(data = d2, instrumento = inst)
}

test_that("p_dim_radar acepta inicio_eje_pct y valida rango", {
  el <- p_dim_radar(objetivo = "idx_idx", inicio_eje_pct = 50)
  expect_identical(el$inicio_eje_pct, 50)

  expect_error(
    p_dim_radar(objetivo = "idx_idx", inicio_eje_pct = 100),
    "`inicio_eje_pct`"
  )
})

test_that("p_dim_radar_tabla fue retirado del flujo PPT", {
  expect_error(
    p_dim_radar_tabla(objetivo = "idx_idx"),
    "retirado del flujo PPT"
  )
})

test_that("p_dim_heatmap acepta configuración de brechas", {
  el <- p_dim_heatmap(
    objetivo = "idx_idx",
    brecha_filas = TRUE,
    brecha_cols = TRUE,
    etiq_brecha_filas = "Brecha filas",
    etiq_brecha_cols = "Brecha cols",
    brecha_cortes = c(5, 25)
  )

  expect_true(isTRUE(el$brecha_filas))
  expect_true(isTRUE(el$brecha_cols))
  expect_identical(el$etiq_brecha_filas, "Brecha filas")
  expect_identical(el$etiq_brecha_cols, "Brecha cols")
  expect_equal(el$brecha_cortes, c(5, 25))
})

test_that("p_dim_heatmap expone modo_semaforo", {
  el <- p_dim_heatmap(
    objetivo = "idx_idx",
    modo_semaforo = "degradado"
  )

  expect_identical(el$modo_semaforo, "degradado")
  expect_identical(el$overrides$modo_semaforo, "degradado")
})

test_that("graficar_radar_dimensiones valida piso radial con inicio_eje_pct", {
  fx_ok <- make_dimensiones_ppt_fixture(low = FALSE)
  fx_low <- make_dimensiones_ppt_fixture(low = TRUE)

  expect_no_error(
    graficar_radar_dimensiones(
      data = fx_ok$data,
      instrumento = fx_ok$instrumento,
      modo = "general",
      objetivo = "idx_idx",
      cruce = "servicio",
      inicio_eje_pct = 50,
      exportar = "rplot"
    )
  )

  expect_error(
    graficar_radar_dimensiones(
      data = fx_low$data,
      instrumento = fx_low$instrumento,
      modo = "general",
      objetivo = "idx_idx",
      cruce = "servicio",
      inicio_eje_pct = 50,
      exportar = "rplot"
    ),
    "mínimo observado"
  )
})

test_that("graficar_radar_dimensiones permite conservar ejes incompletos sin nota", {
  fx <- make_dimensiones_ppt_fixture(low = FALSE)
  fx$data$sub_s1[fx$data$servicio == "C"] <- NA_real_

  p_keep <- graficar_radar_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    filtrar_ejes_incompletos = FALSE,
    agregar_nota_ejes_incompletos = FALSE,
    exportar = "rplot"
  )

  expect_s3_class(p_keep, "ggplot")
  expect_null(attr(p_keep, "note_outside", exact = TRUE))

  p_drop <- graficar_radar_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    filtrar_ejes_incompletos = TRUE,
    agregar_nota_ejes_incompletos = TRUE,
    exportar = "rplot"
  )

  expect_s3_class(p_drop, "ggplot")
})

test_that("graficar_heatmap_dimensiones agrega brechas por filas y columnas", {
  fx <- make_dimensiones_ppt_fixture(low = FALSE)

  p <- graficar_heatmap_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    brecha_filas = TRUE,
    etiq_brecha_filas = "Brecha filas",
    brecha_cols = TRUE,
    etiq_brecha_cols = "Brecha cols",
    aplicar_gradiente_brecha = TRUE,
    brecha_cortes = c(0, 30),
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  expect_s3_class(p, "ggplot")
  expect_true("Brecha cols" %in% as.character(p$data$grupo))
  expect_true("Brecha filas" %in% as.character(p$data$axis_label))

  corner <- subset(
    p$data,
    as.character(grupo) == "Brecha cols" & as.character(axis_label) == "Brecha filas"
  )
  expect_equal(nrow(corner), 1)
})

test_that("graficar_heatmap_dimensiones permite personalizar total y N en eje X", {
  fx <- make_dimensiones_ppt_fixture(low = FALSE)

  p <- graficar_heatmap_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    titulo_total_x = "Total muestra",
    titulo_total_y = "Total fila",
    mostrar_n_cruce_x = TRUE,
    size_ejes = 10,
    size_ejes_x = 7,
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  grupos <- as.character(p$data$grupo)
  ejes <- as.character(p$data$axis_label)
  expect_true(any(grepl("^Total muestra \\(N=", grupos)))
  expect_true("Total fila" %in% ejes)
  expect_equal(p$theme$axis.text.x$size, 7)
})

test_that("graficar_heatmap_dimensiones admite modo_semaforo degradado", {
  dat <- data.frame(
    p1 = c("5", "4", "3", "2", "1", "5"),
    p2 = c("5", "4", "3", "2", "1", "4"),
    p3 = c("5", "4", "3", "2", "1", "3"),
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
      subindice("s1", "S1", c("r100_p1")),
      subindice("s2", "S2", c("r100_p2")),
      subindice("s3", "S3", c("r100_p3"))
    ),
    indices = list(
      indice("idx", "Indice", c("s1", "s2", "s3"))
    )
  )

  p <- graficar_heatmap_dimensiones(
    data = d2,
    instrumento = inst,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    modo_semaforo = "degradado",
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  fills <- unique(toupper(stats::na.omit(as.character(p$data$fill_hex))))
  pal <- toupper(c("#D84B55", "#E0B44C", "#3A9A5B", "#DFE5EE"))

  expect_gt(length(fills), 3L)
  expect_true(any(!fills %in% pal))
})

test_that("graficar_comparativo_radarbar_dimensiones respeta estilos en barras chip", {
  fx <- make_dimensiones_ppt_fixture(low = FALSE)

  p <- graficar_comparativo_radarbar_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    visual_mode = "barras_chip_total",
    color_ejes_x = "#000000",
    color_ejes_y = "#111111",
    fontface_ejes_x = "bold",
    fontface_ejes_y = "bold",
    chip_texto_color = "#000000",
    size_texto_chip = 4.5,
    exportar = "rplot"
  )

  expect_s3_class(p, "ggplot")
  expect_equal(p$theme$axis.text.x$colour, "#000000")
  expect_equal(p$theme$axis.text.y$colour, "#111111")
  expect_equal(p$theme$axis.text.x$face, "bold")
  expect_equal(p$theme$axis.text.y$face, "bold")
  expect_equal(p$theme$plot.title$colour, "#000000")
})

test_that("graficar_radar aplica zoom radial real con limites", {
  p <- graficar_radar(
    data = data.frame(
      eje = c("A", "B", "C"),
      grupo = "G1",
      valor = c(80, 80, 80),
      stringsAsFactors = FALSE
    ),
    var_eje = "eje",
    var_grupo = "grupo",
    var_valor = "valor",
    escala_valor = "proporcion_100",
    limites = c(0.5, 1),
    mostrar_puntos = TRUE,
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  gb <- ggplot2::ggplot_build(p)
  idx_pts <- which(vapply(gb$data, function(x) "shape" %in% names(x), logical(1)))[1]
  r <- sqrt(gb$data[[idx_pts]]$x^2 + gb$data[[idx_pts]]$y^2)
  expect_equal(mean(r), 0.6, tolerance = 1e-8)
})

test_that("reporte_ppt_plan renderiza dimensiones con solo radar y heatmap", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_dimensiones_ppt_fixture(low = FALSE)
  path_ppt <- tempfile(fileext = ".pptx")

  plan <- list(
    p_slide_2_graficos(
      titulo = "Dimensiones",
      izquierda = p_dim_radar(
        modo = "general",
        objetivo = "idx_idx",
        cruce = "servicio",
        inicio_eje_pct = 50
      ),
      derecha = p_dim_heatmap(
        modo = "general",
        objetivo = "idx_idx",
        cruce = "servicio",
        brecha_cols = TRUE,
        brecha_filas = TRUE
      )
    )
  )

  expect_no_error(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      presets = p_presets(),
      plan = plan,
      path_ppt = path_ppt,
      mensajes_progreso = FALSE
    )
  )

  expect_true(file.exists(path_ppt))
})

test_that("base automatica de dimensiones usa universo aunque incluir_total sea FALSE", {
  fx <- make_dimensiones_ppt_fixture(low = FALSE)

  plan <- list(
    p_slide_2_graficos(
      titulo = "Dimensiones",
      izquierda = p_dim_radar(
        modo = "general",
        objetivo = "idx_idx",
        cruce = "servicio",
        incluir_total = FALSE
      ),
      derecha = p_dim_heatmap(
        modo = "general",
        objetivo = "idx_idx",
        cruce = "servicio",
        incluir_total = FALSE
      )
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    presets = p_presets(),
    plan = plan,
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )

  metas <- out$render_meta
  metas <- metas[vapply(metas, function(x) identical(if (is.null(x$kind)) "" else x$kind, "chart"), logical(1))]
  bases <- vapply(metas, function(x) if (is.null(x$base)) NA_character_ else as.character(x$base)[1], character(1))

  expect_true(length(bases) >= 2L)
  expect_true(all(bases == "Base: 6"))
})

test_that("p_presets ignora dim_radar_tabla legado", {
  expect_warning(
    p_presets(dim_radar_tabla = list(titulo_tabla = "Top 2 box")),
    "ignoraron presets no soportados"
  )
})
