source("setup-load-all.R")

# G11 (2026-10-13): `p_tabla` es el radar con el radar escondido. Con una o dos preguntas fallaba con «Radar requiere al
# menos 3 ejes» y la lámina salía «Sin datos» —una tabla no tiene ejes—, y el contrato del registro lo daba por bueno
# porque una lámina vacía también es «ruta anterior». Ahora sale como la tabla del diseño (láminas 197/225).
.tabla_fx <- function() {
  set.seed(7); n <- 80
  df <- data.frame(g = sample(c("1", "2"), n, TRUE), e = sample(c("1", "2", "3", "4"), n, TRUE),
                   e2 = sample(c("1", "2", "3", "4"), n, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("g", "e", "e2"), type = c("select_one si_no", "select_one esc", "select_one esc"),
                                   list_name = c("si_no", "esc", "esc"), label = c("Grupo", "Escala E", "Escala E2"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("si_no", "si_no", rep("esc", 4)), name = c("1", "2", "1", "2", "3", "4"),
                                    label = c("Sí", "No", "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  list(df = df, inst = inst)
}

test_that("una tabla de dos preguntas se dibuja: filas con sus cifras, en la tabla del diseño y nativa", {
  skip_if_not_installed("officer")
  fx <- .tabla_fx(); out <- tempfile(fileext = ".pptx")
  avisos <- character(0)
  withCallingHandlers(suppressMessages(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = p_plan(slides = list(p_slide_1_grafico(p_tabla(modo = "box", vars = c("e", "e2"), box_labels = c("3", "4"), cruce = "g"),
                                                  titulo = "Tabla"))))),
    warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
  expect_false(any(grepl("Sin datos|3 ejes", avisos)))
  xml <- paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, 'name="prosecnur:grafico:tabla"', fixed = TRUE)
  expect_match(xml, "Escala E2", fixed = TRUE)
  expect_match(xml, "[0-9]+%")
  expect_identical(.preview_partes(out)$partes[[1]]$estado, "nativa")
})

test_that("la tabla cabe hasta seis públicos; con siete va por la ruta anterior", {
  e <- function(k) list(ejes = c("Uno", "Dos"), grupos = paste("Público", seq_len(k)))
  expect_true(.lam_tabla_cabe(e(6L)))
  expect_false(.lam_tabla_cabe(e(7L)))
})

test_that("las preguntas y las dos categorías llegan como arreglo JSON del editor (lista sin nombres) y se aceptan", {
  # Con datos reales de Arte la tabla abortaba con «cuando `vars` es lista, debe ser una lista nombrada».
  el <- p_tabla(modo = "box", vars = list("docentes$p12_1", "docentes$p12_2"), box_labels = list("Satisfecho", "Muy satisfecho"))
  expect_identical(el$vars, c("docentes$p12_1", "docentes$p12_2"))
  expect_identical(el$box_labels, c("Satisfecho", "Muy satisfecho"))
  bloques <- p_tabla(modo = "box", vars = list(a = c("x", "y")), box_labels = c("1", "2"))   # la forma por bloques sigue igual
  expect_identical(names(bloques$vars), "a")
})
