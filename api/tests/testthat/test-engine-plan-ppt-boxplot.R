make_plan_boxplot_fixture <- function() {
  df <- data.frame(
    score = c(2.3, 3.4, 2.9, 4.1, 3.8, 2.7, 3.1, 4.2),
    region = c("N", "N", "S", "S", "N", "S", "N", "S"),
    stringsAsFactors = FALSE
  )

  attr(df$score, "label") <- "Puntaje de satisfaccion"
  attr(df$region, "label") <- "Region"

  survey <- data.frame(
    name = c("score", "region"),
    type = c("decimal", "select_one lst_region"),
    list_name = c(NA_character_, "lst_region"),
    stringsAsFactors = FALSE
  )

  choices <- data.frame(
    list_name = rep("lst_region", 2),
    name = c("N", "S"),
    label = c("Norte", "Sur"),
    stringsAsFactors = FALSE
  )

  list(
    data = df,
    instrumento = list(survey = survey, choices = choices, orders_list = NULL),
    presets = p_presets(
      boxplot = list(
        usar_canvas = FALSE,
        mostrar_puntos = FALSE,
        mostrar_leyenda = TRUE
      )
    )
  )
}

test_that("p_boxplot valida argumentos basicos", {
  expect_error(p_boxplot(var = ""), "`var`")
  expect_error(p_boxplot(var = "score", cruce = ""), "`cruce`")
  expect_error(p_boxplot(var = "score", decimales_promedio = 3), "`decimales_promedio`")
  expect_error(p_boxplot(var = "score", tamano_promedio = 0), "`tamano_promedio`")
  expect_error(p_boxplot(var = "score", cortes_chip = 1), "`cortes_chip`")
  expect_error(p_boxplot(var = "score", chip_colores = c("#111111", "#222222")), "`chip_colores`")
  expect_error(p_boxplot(var = "score", overrides = "x"), "`overrides`")
  expect_error(p_boxplot(var = "score", base = "x"), "`base`")

  el <- p_boxplot(var = "score", cruce = "region")
  expect_identical(el$.element_type, "boxplot")
  expect_identical(el$var, "score")
  expect_identical(el$cruce, "region")
})

test_that("reporte_ppt_plan renderiza boxplot simple", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot("score")
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$rendered, 1L)
  expect_s3_class(out$rendered[[1]], "ggplot")
  expect_true(any(vapply(
    out$rendered[[1]]$layers,
    function(l) inherits(l$geom, "GeomBoxplot"),
    logical(1)
  )))
})

test_that("reporte_ppt_plan boxplot aplica etiquetas de cruce y render_meta", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot("score", cruce = "region")
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE,
    build_render_meta = TRUE
  )

  cats <- as.character(out$rendered[[1]]$data$categoria)
  expect_true(all(c("Norte", "Sur") %in% cats))
  expect_equal(out$render_meta[[1]]$etype, "boxplot")
  expect_equal(out$render_meta[[1]]$kind, "chart")
})

test_that("reporte_ppt_plan boxplot respeta paleta de cruce del plan", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  env_pal <- new.env(parent = baseenv())
  assign(
    "paleta_lst_region",
    c(N = "#112233", S = "#AA5500"),
    envir = env_pal
  )

  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot(
        "score",
        cruce = "region",
        mostrar_puntos = FALSE
      )
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    env_diapos = env_pal,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  p <- out$rendered[[1]]
  gb <- ggplot2::ggplot_build(p)
  fills <- unique(toupper(stats::na.omit(gb$data[[1]]$fill)))
  expect_true(all(c("#112233", "#AA5500") %in% fills))
})

test_that("reporte_ppt_plan boxplot acepta cortes_y", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot(
        "score",
        cortes_y = c(2.5, 3.0, 3.5, 4.0),
        mostrar_puntos = FALSE
      )
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  p <- out$rendered[[1]]
  y_scale <- p$scales$get_scales("y")
  expect_equal(y_scale$breaks, c(2.5, 3.0, 3.5, 4.0))
})

test_that("reporte_ppt_plan boxplot acepta limites_y", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot(
        "score",
        limites_y = c(2.0, 4.5),
        mostrar_puntos = FALSE
      )
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  p <- out$rendered[[1]]
  expect_equal(p$coordinates$limits$y, c(2.0, 4.5))
})

test_that("reporte_ppt_plan boxplot dibuja cortes_chip en lineas y eje", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot(
        "score",
        cortes_chip = c(2.8, 3.6),
        mostrar_puntos = FALSE
      )
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  p <- out$rendered[[1]]
  gb <- ggplot2::ggplot_build(p)
  idx_hline <- which(vapply(gb$data, function(x) "yintercept" %in% names(x), logical(1)))[1]
  expect_true(is.finite(idx_hline))

  cuts_drawn <- sort(unique(as.numeric(gb$data[[idx_hline]]$yintercept)))
  expect_equal(cuts_drawn, c(2.8, 3.6))

  cols <- unique(toupper(stats::na.omit(as.character(gb$data[[idx_hline]]$colour))))
  expect_true(length(cols) >= 1L)
  expect_true(all(cols == "#C7CDD6"))

  y_scale <- p$scales$get_scales("y")
  expect_true(all(c(2.8, 3.6) %in% y_scale$breaks))
})

test_that("graficar_boxplot usa chip semaforico con colores/cortes personalizados", {
  df <- data.frame(
    categoria = c(rep("A", 4), rep("B", 4), rep("C", 4)),
    valor = c(1.0, 1.2, 1.1, 1.3, 3.0, 3.1, 2.9, 3.2, 4.4, 4.5, 4.6, 4.7),
    stringsAsFactors = FALSE
  )

  p <- graficar_boxplot(
    data = df,
    var_categoria = "categoria",
    var_valor = "valor",
    mostrar_puntos = FALSE,
    mostrar_leyenda = FALSE,
    cortes_chip = c(2, 4),
    chip_colores = c(rojo = "#AA0000", ambar = "#BBBB00", verde = "#00AA00"),
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  gb <- ggplot2::ggplot_build(p)
  idx_chip <- which(vapply(gb$data, function(x) "label" %in% names(x) && "fill" %in% names(x), logical(1)))[1]
  expect_true(is.finite(idx_chip))
  fills <- unique(toupper(stats::na.omit(gb$data[[idx_chip]]$fill)))
  expect_true(all(c("#AA0000", "#BBBB00", "#00AA00") %in% fills))
})

test_that("graficar_boxplot admite modo_semaforo degradado", {
  df <- data.frame(
    categoria = rep(c("A", "B", "C", "D", "E"), each = 4),
    valor = c(
      rep(1.0, 4),
      rep(1.8, 4),
      rep(3.0, 4),
      rep(4.2, 4),
      rep(5.0, 4)
    ),
    stringsAsFactors = FALSE
  )

  p <- graficar_boxplot(
    data = df,
    var_categoria = "categoria",
    var_valor = "valor",
    mostrar_puntos = FALSE,
    mostrar_leyenda = FALSE,
    cortes_chip = c(2, 4),
    modo_semaforo = "degradado",
    chip_colores = c(rojo = "#AA0000", ambar = "#BBBB00", verde = "#00AA00"),
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  gb <- ggplot2::ggplot_build(p)
  idx_chip <- which(vapply(gb$data, function(x) "label" %in% names(x) && "fill" %in% names(x), logical(1)))[1]
  fills <- unique(toupper(stats::na.omit(gb$data[[idx_chip]]$fill)))
  pal <- c("#AA0000", "#BBBB00", "#00AA00")

  expect_gt(length(fills), 3L)
  expect_true(any(!fills %in% pal))
})

test_that("p_boxplot expone decimales/cortes/colores del chip", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_plan_boxplot_fixture()
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_boxplot(
        "score",
        cruce = "region",
        decimales_promedio = 0,
        tamano_promedio = 5.2,
        cortes_chip = c(3.2, 3.8),
        chip_colores = c(rojo = "#AA0000", ambar = "#BBBB00", verde = "#00AA00"),
        mostrar_puntos = FALSE
      )
    )
  )

  out <- reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = fx$presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  gb <- ggplot2::ggplot_build(out$rendered[[1]])
  idx_chip <- which(vapply(gb$data, function(x) "label" %in% names(x) && "fill" %in% names(x), logical(1)))[1]
  expect_true(is.finite(idx_chip))

  labels <- as.character(gb$data[[idx_chip]]$label)
  expect_true(all(!grepl("\\.", labels)))
  expect_true(all(abs(as.numeric(gb$data[[idx_chip]]$size) - 5.2) < 1e-9))

  fills <- unique(toupper(stats::na.omit(gb$data[[idx_chip]]$fill)))
  expected_palette <- c("#AA0000", "#BBBB00", "#00AA00")
  expect_true(length(fills) >= 1L)
  expect_true(all(fills %in% expected_palette))
})

test_that("p_boxplot expone modo_semaforo", {
  el <- p_boxplot(var = "score", modo_semaforo = "degradado")
  expect_identical(el$overrides$modo_semaforo, "degradado")
})
