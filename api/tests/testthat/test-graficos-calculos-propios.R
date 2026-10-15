source("setup-load-all.R")

# Un gráfico puede llevar su propio redondeo como excepción explícita (R4 del
# revamp de Gráficos, checklist-revamp-informe-graficos-2026-10-14).
#
# La regla sigue siendo que la configuración general gobierna el método de
# redondeo y los decimales (checklist-redondeo-decimales-2026-08-14, ítems 11 y
# 12): un override viejo guardado en una lámina se ignora. La excepción se pide
# con `calculos_propios = TRUE` en los overrides del gráfico; entonces sus
# campos gobernados se conservan y ganan al preset del tipo. La marca nunca
# llega al graficador, la nota de redondeo se decide con lo EFECTIVO del
# gráfico, y el Word obedece lo mismo que la lámina.

.cp_el <- function(etype = "barras_apiladas", ov = list(), ...) {
  structure(c(list(.element_type = etype, overrides = ov), list(...)), class = c("ppt_element", "list"))
}
.cp_presets <- function(base = list(), metodo = "estandar", dec = 0) {
  list(base = list(args = base),
       barras_apiladas = list(args = list(metodo_redondeo = metodo, decimales = dec)),
       pie = list(args = list(metodo_redondeo = metodo, decimales_pct = dec)))
}
.cp_marca <- function(el) el$overrides$nota_redondeo_pie %||% NULL

# --- El saneo ----------------------------------------------------------------

test_that("sin la marca, un override viejo de redondeo se sigue ignorando", {
  ov <- list(metodo_redondeo = "reparto", decimales = 2, decimales_pct = 1,
             valores_decimales = 1, color_ejes = "#081F5C")
  out <- .calculos_sanear_overrides(ov)
  expect_equal(names(out), "color_ejes")
  # Una marca que no es un TRUE lógico no enciende la excepción.
  for (marca in list(FALSE, "true", "TRUE", 1, list(TRUE), c(TRUE, TRUE), NA)) {
    out <- .calculos_sanear_overrides(c(ov, list(calculos_propios = marca)))
    expect_equal(names(out), "color_ejes")
  }
})

test_that("con calculos_propios = TRUE se conservan método y decimales, y la marca se consume", {
  ov <- list(calculos_propios = TRUE, metodo_redondeo = "reparto", decimales = 2,
             decimales_pct = 1, valores_decimales = 3, size_valores = 3)
  out <- .calculos_sanear_overrides(ov)
  expect_false("calculos_propios" %in% names(out))
  expect_equal(out$metodo_redondeo, "reparto")
  expect_equal(out$decimales, 2)
  expect_equal(out$decimales_pct, 1)
  expect_equal(out$valores_decimales, 3)
  expect_equal(out$size_valores, 3)
  # La marca sola, sin campos, no deja nada atrás.
  expect_equal(.calculos_sanear_overrides(list(calculos_propios = TRUE)), structure(list(), names = character(0)))
  # Se lee por nombre exacto: un prefijo no la enciende.
  expect_false(.calculos_propios(list(calculos_propios_x = TRUE)))
})

test_that("el elemento se sanea una vez, con sus bloques y la excepción del padre", {
  el <- .cp_el("barras_multiapiladas",
               ov = list(calculos_propios = TRUE, decimales = 1, metodo_redondeo = "estandar"),
               modo = "multilista",
               bloques = list(list(var = "a", overrides = list(decimales = 2, metodo_redondeo = "reparto", wrap_y = 30)),
                              list(var = "b")))
  out <- .calculos_sanear_elemento(el)
  expect_false("calculos_propios" %in% names(out$overrides))
  expect_equal(out$overrides$decimales, 1)
  # Los bloques reciben lo que el gráfico pidió, y pierden lo viejo propio.
  expect_equal(out$bloques[[1]]$overrides$decimales, 1)
  expect_equal(out$bloques[[1]]$overrides$metodo_redondeo, "estandar")
  expect_equal(out$bloques[[1]]$overrides$wrap_y, 30)
  expect_equal(out$bloques[[2]]$overrides$decimales, 1)
  # Un segundo saneo no se come lo conservado.
  expect_identical(.calculos_sanear_elemento(out), out)
  expect_s3_class(out, "ppt_element")

  # Sin la marca en el padre, los bloques tampoco conservan lo suyo.
  sin <- .calculos_sanear_elemento(.cp_el("barras_multiapiladas", ov = list(decimales = 1),
                                          bloques = list(list(overrides = list(decimales = 2, wrap_y = 30)))))
  expect_null(sin$overrides$decimales)
  expect_null(sin$bloques[[1]]$overrides$decimales)
  expect_equal(sin$bloques[[1]]$overrides$wrap_y, 30)
  expect_null(.calculos_sanear_elemento(NULL))
})

# --- La nota de redondeo con lo efectivo del gráfico ----------------------------

test_that("reparto propio bajo un informe estándar con si_no_cierra: sin nota", {
  base <- list(nota_redondeo_modo = "si_no_cierra")
  el <- .calculos_sanear_elemento(.cp_el(ov = list(calculos_propios = TRUE, metodo_redondeo = "reparto")))
  expect_null(.cp_marca(.calculos_aplicar_nota(el, .cp_presets(base, metodo = "estandar"))))
  # El mismo override, viejo y sin marca, no cambia nada: la nota condicional se deja.
  viejo <- .calculos_sanear_elemento(.cp_el(ov = list(metodo_redondeo = "reparto")))
  m <- .cp_marca(.calculos_aplicar_nota(viejo, .cp_presets(base, metodo = "estandar")))
  expect_true(isTRUE(m$solo_si_no_cierra))
})

test_that("estándar propio bajo un informe con reparto y si_no_cierra: nota condicional", {
  base <- list(nota_redondeo_modo = "si_no_cierra")
  el <- .calculos_sanear_elemento(.cp_el(ov = list(calculos_propios = TRUE, metodo_redondeo = "estandar")))
  m <- .cp_marca(.calculos_aplicar_nota(el, .cp_presets(base, metodo = "reparto")))
  expect_true(isTRUE(m$solo_si_no_cierra))
  expect_match(m$texto, "no sumar exactamente 100")
  # Sin la marca rige el reparto del informe: no hay nota que decidir.
  viejo <- .calculos_sanear_elemento(.cp_el(ov = list(metodo_redondeo = "estandar")))
  expect_null(.cp_marca(.calculos_aplicar_nota(viejo, .cp_presets(base, metodo = "reparto"))))
})

test_that("en «siempre» el texto declara el método y los decimales efectivos de la familia", {
  base <- list(nota_redondeo_modo = "siempre")
  el <- .calculos_sanear_elemento(.cp_el(ov = list(calculos_propios = TRUE, metodo_redondeo = "reparto", decimales = 1)))
  m <- .cp_marca(.calculos_aplicar_nota(el, .cp_presets(base)))
  expect_equal(m$texto, .calculos_nota_texto("reparto", 1))
  # Torta: su campo es decimales_pct.
  pie <- .calculos_sanear_elemento(.cp_el("pie", ov = list(calculos_propios = TRUE, decimales_pct = 2)))
  expect_equal(.cp_marca(.calculos_aplicar_nota(pie, .cp_presets(base)))$texto, .calculos_nota_texto("estandar", 2))
  # Sin marca, el texto es el del informe.
  viejo <- .calculos_sanear_elemento(.cp_el(ov = list(metodo_redondeo = "reparto", decimales = 1)))
  expect_equal(.cp_marca(.calculos_aplicar_nota(viejo, .cp_presets(base)))$texto, .calculos_nota_texto("estandar", 0))
})

# --- De punta a punta: lámina y Word ----------------------------------------------

.cp_fixture <- function() {
  df <- data.frame(p1 = c("Bajo", "Bajo", "Medio", "Medio", "Alto", "Alto"),   # 33/33/33 -> 99
                   p2 = c("Bajo", "Bajo", "Bajo", "Alto", "Alto", "Alto"),     # 50/50
                   stringsAsFactors = FALSE)
  attr(df$p1, "label") <- "Pregunta tercios"; attr(df$p2, "label") <- "Pregunta mitades"
  inst <- list(
    survey = data.frame(name = c("p1", "p2"), type = "select_one lst", list_name = "lst", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst", name = c("Bajo", "Medio", "Alto"), label = c("Bajo", "Medio", "Alto"),
                         stringsAsFactors = FALSE),
    orders_list = NULL)
  list(df = df, inst = inst)
}

.cp_correr <- function(plan, metodo_informe) {
  fx <- .cp_fixture()
  path <- withr::local_tempfile(fileext = ".pptx", .local_envir = parent.frame())
  presets <- p_presets(base = list(nota_redondeo_modo = "si_no_cierra",
                                   nota_redondeo_texto = "NOTA DEL REDONDEO."),
                       barras_apiladas = list(metodo_redondeo = metodo_informe))
  res <- NULL
  suppressMessages(suppressWarnings(capture.output(res <- reporte_ppt_plan(
    data = fx$df, instrumento = fx$inst, plan = plan, presets = presets,
    path_ppt = path, mensajes_progreso = FALSE, build_render_meta = TRUE))))
  doc <- officer::read_pptx(path)
  textos <- vapply(seq_len(length(doc)), function(i) {
    x <- officer::slide_summary(doc, index = i)
    paste(x$text[!is.na(x$text)], collapse = " | ")
  }, character(1))
  meta <- Filter(function(m) identical(m$kind %||% "chart", "chart"), res$render_meta %||% list())
  notas_word <- vapply(meta, function(m) {
    n <- attr(m$plot_word, "note_outside") %||% m$note %||% ""
    paste(as.character(n), collapse = " ")
  }, character(1))
  list(textos = textos, notas_word = notas_word)
}

test_that("informe con reparto: el gráfico con estándar propio lleva la nota; el override viejo no", {
  skip_if_not_installed("officer")
  plan <- list(
    diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas(
      "p1", overrides = list(calculos_propios = TRUE, metodo_redondeo = "estandar"))),
    diapo_002 = p_slide_1_grafico(grafico = p_barras_apiladas(
      "p1", overrides = list(metodo_redondeo = "estandar"))))
  r <- .cp_correr(plan, "reparto")
  expect_length(r$textos, 2L)
  expect_match(r$textos[[1]], "NOTA DEL REDONDEO.", fixed = TRUE)
  expect_false(grepl("34%", r$textos[[1]], fixed = TRUE))          # estándar: 33/33/33
  expect_false(grepl("NOTA DEL REDONDEO", r$textos[[2]], fixed = TRUE))
  expect_match(r$textos[[2]], "34%", fixed = TRUE)                 # reparto del informe
  # El Word dice lo mismo que la lámina.
  expect_length(r$notas_word, 2L)
  expect_match(r$notas_word[[1]], "NOTA DEL REDONDEO.", fixed = TRUE)
  expect_false(grepl("NOTA DEL REDONDEO", r$notas_word[[2]], fixed = TRUE))
})

test_that("informe estándar: el gráfico con reparto propio no lleva nota, y sus decimales mandan", {
  skip_if_not_installed("officer")
  plan <- list(
    diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas(
      "p1", overrides = list(calculos_propios = TRUE, metodo_redondeo = "reparto"))),
    diapo_002 = p_slide_1_grafico(grafico = p_barras_apiladas("p1")),
    diapo_003 = p_slide_1_grafico(grafico = p_barras_apiladas(
      "p2", overrides = list(calculos_propios = TRUE, decimales = 1))),
    diapo_004 = p_slide_1_grafico(grafico = p_barras_apiladas("p2", overrides = list(decimales = 1))))
  r <- .cp_correr(plan, "estandar")
  expect_length(r$textos, 4L)
  expect_false(grepl("NOTA DEL REDONDEO", r$textos[[1]], fixed = TRUE))
  expect_match(r$textos[[1]], "34%", fixed = TRUE)
  expect_match(r$textos[[2]], "NOTA DEL REDONDEO.", fixed = TRUE)  # control: estándar del informe
  expect_match(r$textos[[3]], "50[.,]0 ?%")
  expect_false(grepl("50[.,]0 ?%", r$textos[[4]]))
  expect_match(r$textos[[4]], "50%", fixed = TRUE)
  expect_false(grepl("NOTA DEL REDONDEO", r$notas_word[[1]], fixed = TRUE))
  expect_match(r$notas_word[[2]], "NOTA DEL REDONDEO.", fixed = TRUE)
})

# --- El Word de las multiapiladas obedece la misma regla -----------------------
#
# Hallazgo de R4: el Word parte las multiapiladas en un gráfico por variable o
# grupo y llama a `.render_barras_multiapiladas()` sin pasar por el saneo de
# `.render_element_impl()`. Antes de este cambio el Word rotulaba con el
# override viejo de la lámina (2 decimales, reparto) mientras la lámina, ya
# saneada, usaba la configuración general.

.cp_args_multi <- function(overrides, modo = "var") {
  inst <- list(survey = data.frame(name = c("p1", "p2"), type = "select_one lst", list_name = "lst",
                                   label = c("A", "B"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lst", name = c("1", "2", "3"), label = c("Sí", "No", "NS"),
                                    stringsAsFactors = FALSE),
               orders_list = NULL)
  data <- data.frame(p1 = c("1", "2", "3"), p2 = c("1", "1", "2"), stringsAsFactors = FALSE)
  presets <- .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets())
  graf <- if (identical(modo, "multilista")) {
    p_barras_multiapiladas(modo = "multilista", overrides = overrides,
                           bloques = list(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"),
                                                                 overrides = list(decimales = 3))))
  } else {
    p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), overrides = overrides)
  }
  plan <- list(diapo_001 = p_slide_1_grafico(titulo = "x", grafico = graf))
  cap <- list()
  local_mocked_bindings(graficar_barras_apiladas = function(...) {
    a <- list(...)
    cap[[length(cap) + 1L]] <<- list(dec = a$decimales, met = a$metodo_redondeo, nombres = names(a))
    ggplot2::ggplot()
  })
  suppressMessages(suppressWarnings(capture.output(reporte_ppt_plan(
    data = data, instrumento = inst, plan = plan, presets = presets,
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE))))
  cap
}

test_that("multiapiladas: lámina y Word ignoran el override viejo y honran el propio", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  viejo <- .cp_args_multi(list(decimales = 2, metodo_redondeo = "reparto"))
  expect_gt(length(viejo), 1L)   # una llamada de la lámina y una por variable en el Word
  for (k in viejo) {
    expect_false(identical(k$dec, 2))
    expect_false(identical(k$met, "reparto"))
  }
  propio <- .cp_args_multi(list(calculos_propios = TRUE, decimales = 2, metodo_redondeo = "reparto"))
  expect_gt(length(propio), 1L)
  for (k in propio) {
    expect_equal(k$dec, 2)
    expect_equal(k$met, "reparto")
    expect_false("calculos_propios" %in% k$nombres)
  }
})

test_that("multilista: el override viejo de un bloque se ignora en lámina y Word; la excepción del gráfico baja", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  viejo <- .cp_args_multi(list(), modo = "multilista")
  expect_gt(length(viejo), 1L)
  for (k in viejo) expect_false(identical(k$dec, 3))
  propio <- .cp_args_multi(list(calculos_propios = TRUE, decimales = 1), modo = "multilista")
  expect_gt(length(propio), 1L)
  for (k in propio) {
    expect_equal(k$dec, 1)
    expect_false("calculos_propios" %in% k$nombres)
  }
})
