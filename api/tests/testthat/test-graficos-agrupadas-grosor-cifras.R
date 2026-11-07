# Dos fallas de las agrupadas vistas en el mazo CCSS 2026 (97 láminas, 2026-11-03). Fixture sintético.
#   1. Cruces de respuesta múltiple con pocas opciones: barras enormes (2 × 2) o a media lámina (1 × 2, 1 × 4). Ahora un
#      grosor máximo por barra para todo el mazo y el bloque centrado en su hueco.
#   2. Agrupada de una serie: la cifra iba dentro y grande o fuera y chica según la ruta. Ahora fuera y con el cuerpo de la
#      lámina nativa, salvo `cifras_dentro = TRUE`.

.agc_fx <- function(n = 400) {
  set.seed(5)
  ops <- c("Bus", "Bicicleta", "Auto", "Tren")
  m <- sapply(c(.6, .3, .2, .1), function(p) stats::rbinom(n, 1, p))
  sm <- apply(m, 1, function(r) paste(ops[r == 1], collapse = " ")); sm[!nzchar(sm)] <- "Bus"
  d <- data.frame(sm = sm, sexo = sample(c("Mujer", "Hombre"), n, TRUE), nivel = sample(paste("Nivel", 6:9), n, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("sm", "sexo", "nivel"), type = c("select_multiple l_sm", "select_one l_s", "select_one l_n"),
                                   list_name = c("l_sm", "l_s", "l_n"), label = c("Medios", "Sexo", "Nivel")),
               choices = data.frame(list_name = c(rep("l_sm", 4), "l_s", "l_s", rep("l_n", 4)),
                                    name = c(ops, "Mujer", "Hombre", paste("Nivel", 6:9)), label = c(ops, "Mujer", "Hombre", paste("Nivel", 6:9))),
               orders_list = NULL)
  list(data = d, inst = inst, ops = ops)
}

test_that("1: cruces con 1, 2 y 3 opciones × 2 y 4 grupos: grosor de barra con tope y bloque centrado en su hueco", {
  fx <- .agc_fx()
  for (k in 1:3) for (cr in c("sexo", "nivel")) {
    el <- p_barras_agrupadas("sm", cruces = cr, overrides = list(excluir_opciones = setdiff(fx$ops, fx$ops[seq_len(k)])))
    r <- suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, solo_lista = TRUE, mensajes_progreso = FALSE,
      presets = .build_presets(.enriquecer_presets(list(), NULL)), plan = p_plan(slides = list(p_slide_1_grafico(titulo = "x", grafico = el))))))
    lay <- attr(r$rendered[[1]], "pulso_barras_agrupadas_layout")
    grupos <- if (cr == "sexo") 2L else 4L
    barra <- lay$h_panel_in / lay$n_categorias * lay$grosor_eff / grupos
    info <- sprintf("%d opción(es) × %d grupos", k, grupos)
    expect_identical(lay$n_categorias, k, info = info)
    expect_lte(barra, .AGRUPADAS_CRUCE_BARRA_MAX_IN + 1e-9)            # nunca enormes
    expect_gte(barra, 0.2)                                              # ni hilos
    # Centrado: lo que sobra del hueco se reparte arriba y abajo; el lienzo mide el hueco entero.
    usado <- lay$h_header_in + lay$h_panel_in + lay$h_legend_in + lay$h_caption_in
    expect_equal(lay$h_total_in, usado + 2 * lay$h_pad_in, info = info)
  }
  expect_identical(.agrupadas_cruce_relleno(NULL, TRUE, FALSE, 6, 3), 0)
  expect_equal(.agrupadas_cruce_relleno(list(), TRUE, FALSE, 6, 3), 1.5)
})

test_that("2: la agrupada de una serie pone sus cifras fuera y con el cuerpo de la lámina, salvo `cifras_dentro = TRUE`", {
  d <- data.frame(cat = paste("Agrupación de estudiantes de la universidad número", 1:11), N = 100,
                  pct = seq(0.6, 0.05, length.out = 11), stringsAsFactors = FALSE)
  capa <- function(...) {
    p <- graficar_barras_agrupadas(data = d, var_categoria = "cat", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total"), usar_canvas = FALSE, ...)
    b <- ggplot2::ggplot_build(p)$data
    b[[which(vapply(b, function(x) "label" %in% names(x), logical(1)))[1]]]
  }
  fuera <- capa()
  expect_true(all(fuera$hjust == 0))                                   # todas fuera de su barra
  expect_true(all(abs(fuera$size - 11 / ggplot2::.pt) < 1e-9))          # 11 pt: los rótulos pasan de 45 letras
  dentro <- capa(cifras_dentro = TRUE)
  expect_true(any(dentro$hjust == 0.5))                                 # declarado: las largas van dentro
  expect_false(.agrupadas_una_serie_fuera(2L, NULL))                    # los cruces no cambian
  expect_equal(.agrupadas_cifra_una_serie_mm(c("Corto", "Medio")), 12 / ggplot2::.pt)
})
