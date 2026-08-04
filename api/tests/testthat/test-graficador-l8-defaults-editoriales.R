# B2 del GOAL motor PPT (carril L8): defaults editoriales de radar, boxplot y
# media_rango.
#
# - B-H5: la leyenda del radar arrastraba legend_espaciado = 0.25 pt (cero
#   visual) y mostraba una leyenda "Total" para la serie unica sintetica.
# - B-H9: sin cortes declarados, el semaforo del chip inventaba terciles de
#   las medias: SIEMPRE habia un grupo rojo aunque todos promediaran alto.
#   El semaforo ahora solo actua con cortes explicitos o modo degradado.

.l8_radar_data <- function(grupo = "Total") {
  data.frame(
    eje = c("Atencion", "Canales", "Personal", "Tiempos"),
    grupo = grupo,
    valor = c(.61, .45, .38, .22),
    stringsAsFactors = FALSE
  )
}

.l8_num_data <- function() {
  set.seed(11)
  data.frame(
    categoria = rep(c("Callao", "Lima Norte", "Lima Sur"), each = 30),
    valor = round(pmin(10, pmax(0, stats::rnorm(90, 7.2, 1.4))), 1),
    stringsAsFactors = FALSE
  )
}

test_that("la firma del radar trae el espaciado de leyenda de la casa", {
  fml <- formals(graficar_radar)
  expect_identical(eval(fml$legend_espaciado), 6)
  expect_identical(eval(fml$legend_key_spacing_x_cm), 0.22)
})

test_that("radar con serie unica 'Total' oculta la leyenda; serie nombrada la conserva", {
  p_total <- graficar_radar(
    data = .l8_radar_data("Total"), usar_canvas = TRUE, exportar = "rplot"
  )
  p_nombrada <- graficar_radar(
    data = .l8_radar_data("Docentes"), usar_canvas = TRUE, exportar = "rplot"
  )
  # La leyenda es un grob adicional del canvas: la serie nombrada tiene mas capas.
  expect_lt(length(p_total$layers), length(p_nombrada$layers))
})

.l8_chip_fills <- function(p) {
  for (ly in p$layers) {
    if (inherits(ly$geom, "GeomLabel")) {
      fills <- ly$aes_params$fill %||% ly$geom_params$fill
      if (!is.null(fills)) return(as.character(fills))
    }
  }
  character(0)
}

test_that("boxplot sin cortes rinde chip neutral; con cortes activa el semaforo", {
  d <- .l8_num_data()
  p_neutro <- graficar_boxplot(
    data = d, var_categoria = "categoria", var_valor = "valor",
    usar_canvas = FALSE, exportar = "rplot"
  )
  fills_neutro <- .l8_chip_fills(p_neutro)
  expect_true(length(fills_neutro) > 0)
  expect_true(all(toupper(fills_neutro) == "#FFFFFF"))

  p_semaforo <- graficar_boxplot(
    data = d, var_categoria = "categoria", var_valor = "valor",
    cortes_chip = c(6, 8),
    usar_canvas = FALSE, exportar = "rplot"
  )
  fills_semaforo <- .l8_chip_fills(p_semaforo)
  expect_true(length(fills_semaforo) > 0)
  expect_false(any(toupper(fills_semaforo) == "#FFFFFF"))
})

test_that("media_rango sin cortes rinde chip neutral; con cortes activa el semaforo", {
  d <- .l8_num_data()
  p_neutro <- graficar_media_rango(
    data = d, var_categoria = "categoria", var_valor = "valor",
    usar_canvas = FALSE, exportar = "rplot"
  )
  fills_neutro <- .l8_chip_fills(p_neutro)
  expect_true(length(fills_neutro) > 0)
  expect_true(all(toupper(fills_neutro) == "#FFFFFF"))

  p_semaforo <- graficar_media_rango(
    data = d, var_categoria = "categoria", var_valor = "valor",
    cortes_chip = c(6, 8),
    usar_canvas = FALSE, exportar = "rplot"
  )
  fills_semaforo <- .l8_chip_fills(p_semaforo)
  expect_true(length(fills_semaforo) > 0)
  expect_false(any(toupper(fills_semaforo) == "#FFFFFF"))
})

test_that("el glue activa score_ref cuando la UI enciende 'Mostrar referencia' (B-H7)", {
  # Regresion del partial-match: args$modo casaba con modo_semaforo y el
  # switch quedaba inerte. El glue debe indexar con [["modo"]].
  set.seed(11)
  df <- data.frame(
    nota = round(pmin(10, pmax(0, stats::rnorm(90, 7.2, 1.4))), 1),
    region = rep(c("Callao", "Lima Norte", "Lima Sur"), each = 30),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = c("nota", "region"), type = c("integer", "select_one r"),
      list_name = c(NA, "r"), label = c("Nota", "Zona"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("r", 3),
      name = c("Callao", "Lima Norte", "Lima Sur"),
      label = c("Callao", "Lima Norte", "Lima Sur"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  capturado <- NULL
  testthat::with_mocked_bindings(
    graficar_media_rango = function(...) {
      capturado <<- list(...)
      ggplot2::ggplot()
    },
    {
      plan <- list(diapo_001 = p_slide_1_grafico(
        p_media_rango(var = "nota", cruce = "region", mostrar_ref_label = TRUE),
        titulo = "t"
      ))
      invisible(reporte_ppt_plan(
        data = df, instrumento = inst, plan = plan,
        solo_lista = TRUE, build_render_meta = TRUE,
        mensajes_progreso = FALSE
      ))
    }
  )
  expect_false(is.null(capturado))
  expect_identical(capturado[["modo"]], "score_ref")
  expect_true(isTRUE(capturado[["mostrar_ref_line"]]))
})

test_that("boxplot respeta los niveles del factor entrante (orden del instrumento)", {
  d <- .l8_num_data()
  d$categoria <- factor(d$categoria, levels = c("Lima Sur", "Callao", "Lima Norte"))
  p <- graficar_boxplot(
    data = d, var_categoria = "categoria", var_valor = "valor",
    usar_canvas = FALSE, exportar = "rplot"
  )
  expect_identical(levels(p$data$categoria), c("Lima Sur", "Callao", "Lima Norte"))
})

test_that("degradado_manual sin gradiente degrada con aviso en vez de matar la lamina", {
  d <- .l8_num_data()
  expect_warning(
    p_mr <- graficar_media_rango(
      data = d, var_categoria = "categoria", var_valor = "valor",
      modo_semaforo = "degradado_manual",
      usar_canvas = FALSE, exportar = "rplot"
    ),
    "degradado_automatico"
  )
  expect_s3_class(p_mr, "ggplot")

  expect_warning(
    p_bx <- graficar_boxplot(
      data = d, var_categoria = "categoria", var_valor = "valor",
      modo_semaforo = "degradado_manual",
      usar_canvas = FALSE, exportar = "rplot"
    ),
    "degradado_automatico"
  )
  expect_s3_class(p_bx, "ggplot")
})

test_that("degradado_manual CON gradiente completo sigue siendo manual", {
  d <- .l8_num_data()
  expect_no_warning(
    graficar_media_rango(
      data = d, var_categoria = "categoria", var_valor = "valor",
      modo_semaforo = "degradado_manual",
      semaforo_gradiente_colores = c("#C62828", "#2E7D32"),
      semaforo_gradiente_valores = c(5, 9),
      usar_canvas = FALSE, exportar = "rplot"
    )
  )
})

test_that("las series del radar sin paleta de proyecto usan la paleta de la casa (B-H5c)", {
  d <- data.frame(
    eje = rep(c("Atencion", "Canales", "Personal", "Tiempos"), 2),
    grupo = rep(c("Mujer", "Hombre"), each = 4),
    valor = c(.61, .45, .38, .22, .55, .49, .30, .28),
    stringsAsFactors = FALSE
  )
  p <- graficar_radar(data = d, usar_canvas = FALSE, exportar = "rplot")
  built <- ggplot2::ggplot_build(p)
  cols <- toupper(unique(unlist(lapply(built$data, function(l) l$colour))))
  # navy y teal de la casa presentes; el salmon del hue_pal de ggplot, ausente
  expect_true("#0B4F8C" %in% cols)
  expect_true("#2A9D8F" %in% cols)
  expect_false("#F8766D" %in% cols)
})

test_that("smoke B-H2: el camino real del plan llega al radar con datos construidos", {
  likert <- c("Bajo", "Medio", "Alto")
  set.seed(3)
  df <- data.frame(
    p1 = sample(likert, 40, replace = TRUE),
    p2 = sample(likert, 40, replace = TRUE),
    p3 = sample(likert, 40, replace = TRUE),
    servicios = vapply(seq_len(40), function(i)
      paste(sample(c("bib", "lab", "tut"), sample(1:2, 1)), collapse = " "),
      character(1)),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = c("p1", "p2", "p3", "servicios"),
      type = c(rep("select_one lst_lik", 3), "select_multiple lst_srv"),
      list_name = c(rep("lst_lik", 3), "lst_srv"),
      label = c("P1", "P2", "P3", "Servicios"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_lik", 3), rep("lst_srv", 3)),
      name = c(likert, "bib", "lab", "tut"),
      label = c(likert, "Biblioteca", "Laboratorio", "Tutoria"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(lst_lik = list(names = likert, labels = likert))
  )
  llamadas <- list()
  testthat::with_mocked_bindings(
    graficar_radar = function(...) {
      llamadas[[length(llamadas) + 1L]] <<- list(...)
      ggplot2::ggplot()
    },
    {
      plan <- list(
        diapo_001 = p_slide_1_grafico(
          p_radar(modo = "sm", var = "servicios"), titulo = "radar sm"),
        diapo_002 = p_slide_1_grafico(
          p_tabla(modo = "box", vars = c("p1", "p2", "p3"),
                  box_labels = c("Medio", "Alto")),
          titulo = "tabla box")
      )
      invisible(reporte_ppt_plan(
        data = df, instrumento = inst, plan = plan,
        solo_lista = TRUE, build_render_meta = TRUE,
        mensajes_progreso = FALSE
      ))
    }
  )
  expect_true(length(llamadas) >= 2L)
  # radar sm: datos construidos con las 3 opciones del select multiple
  d_sm <- llamadas[[1]][["data"]]
  expect_true(is.data.frame(d_sm) && nrow(d_sm) >= 3L)
  # tabla box: el contrato solo-tabla viaja hasta el graficador (el plan
  # tambien renderiza para Word, asi que se busca la llamada por su firma)
  con_tabla <- Filter(function(a) isTRUE(a[["mostrar_tabla_derecha"]]), llamadas)
  expect_true(length(con_tabla) >= 1L)
  expect_identical(con_tabla[[1]][["radar_scale"]], 0)
})

test_that("los puntos del boxplot se distinguen de su caja (B5 editorial)", {
  fml <- formals(graficar_boxplot)
  expect_identical(eval(fml$alpha_puntos), 0.45)
  d <- .l8_num_data()
  p <- graficar_boxplot(
    data = d, var_categoria = "categoria", var_valor = "valor",
    usar_canvas = FALSE, exportar = "rplot"
  )
  built <- ggplot2::ggplot_build(p)
  fills <- toupper(unique(stats::na.omit(built$data[[1]]$fill)))
  pts <- toupper(unique(stats::na.omit(built$data[[2]]$colour)))
  expect_true(length(pts) > 0)
  expect_length(intersect(fills, pts), 0)
})

test_that("mostrar_valores etiqueta cada vertice con su porcentaje (B6)", {
  d <- data.frame(
    eje = rep(c("Atencion", "Canales", "Personal", "Tiempos"), 2),
    grupo = rep(c("Mujer", "Hombre"), each = 4),
    valor = c(.61, .45, .38, .22, .55, .49, .30, .28),
    stringsAsFactors = FALSE
  )
  p_sin <- graficar_radar(data = d, usar_canvas = FALSE, exportar = "rplot")
  p_con <- graficar_radar(data = d, usar_canvas = FALSE, exportar = "rplot",
                          mostrar_valores = TRUE)
  labs_de <- function(p) {
    out <- character(0)
    for (ly in p$layers) {
      if (inherits(ly$geom, "GeomText") && is.data.frame(ly$data) &&
          ".lab_val" %in% names(ly$data)) {
        out <- c(out, as.character(ly$data$.lab_val))
      }
    }
    out
  }
  expect_length(labs_de(p_sin), 0)
  labs <- labs_de(p_con)
  expect_length(labs, 8)
  expect_true(all(grepl("^[0-9]+%$", labs)))
  expect_true("61%" %in% labs)
})
