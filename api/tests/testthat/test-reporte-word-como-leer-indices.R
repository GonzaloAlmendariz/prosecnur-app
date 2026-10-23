source("setup-load-all.R")

# F6 (comentarios Renzo, W0/W1/W4/W7): `como_leer` por secciones e `indices` del documento Word. Los defaults no cambian
# ningún informe existente; aquí se lee word/document.xml del docx generado.

.cli_xml <- function(f) { d <- tempfile(); utils::unzip(f, exdir = d)
  paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "") }

.wl_xml_directo <- function(doc) { f <- tempfile(fileext = ".docx"); print(doc, target = f); .cli_xml(f) }

.cli_meta <- function(con_tabla = TRUE) {
  d <- data.frame(categoria = c("A", "B"), N = c(45, 30), pct = c(.45, .30), stringsAsFactors = FALSE)
  p <- suppressWarnings(graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total")))
  c(list(list(kind = "title_doc", title = "Estudio de prueba"),
         list(kind = "section", title = "PERFIL DEL ENCUESTADO", meta = list(word_heading_level = 1L)),
         list(kind = "chart", title = "Sexo", plot_word = p)),
    if (con_tabla) list(list(kind = "technical_table", title = "Ficha", table = data.frame(Aspecto = "Técnica", Detalle = "Encuesta"))))
}

.cli_doc <- function(opciones, ...) {
  f <- tempfile(fileext = ".docx"); res <- .word_documento(.cli_meta(...), f, opciones = opciones)
  list(res = res, xml = .cli_xml(f))
}

test_that("como_leer = vector de secciones lleva sólo esas y recorre la numeración (conserva Cifras muy pequeñas)", {
  skip_if_not_installed("officer")
  x <- .cli_doc(list(como_leer = c("top_two_box", "cifras_pequenas")))$xml
  expect_match(x, "Top Two Box", fixed = TRUE)
  expect_match(x, "Cifras muy pequeñas", fixed = TRUE)
  for (t in c("Redondeo", "Bases chicas", "Una misma escala", "Bottom Two Box")) expect_false(grepl(t, x, fixed = TRUE), info = t)
  expect_match(x, "1.1. Top Two Box", fixed = TRUE)            # sin Introducción, «Cómo leer» es el capítulo 1
  expect_match(x, "1.2. Cifras muy pequeñas", fixed = TRUE)
})

test_that("Renzo: sin Redondeo ni Bases chicas, con el resto de «Cómo leer»", {
  skip_if_not_installed("officer")
  sel <- setdiff(names(.WORD_COMO_LEER_SECCIONES), c("redondeo", "bases_chicas"))
  x <- .cli_doc(list(como_leer = sel))$xml
  expect_false(grepl("Redondeo de las cifras", x, fixed = TRUE)); expect_false(grepl("Bases chicas e información faltante", x, fixed = TRUE))
  for (t in c("Top Two Box", "Una misma escala", "Cifras muy pequeñas")) expect_match(x, t, fixed = TRUE)
  # con Bottom Two Box en el informe (aquí el gráfico no lo trae) la sección queda condicionada por la misma lista
  y <- .wl_xml_directo(.word_como_leer(.word_documento_nuevo(), secciones = sel))
  expect_match(y, "Bottom Two Box", fixed = TRUE); expect_false(grepl("Redondeo de las cifras", y, fixed = TRUE))
})

test_that("como_leer TRUE equivale a todas las secciones y no cambia el capítulo de hoy", {
  skip_if_not_installed("officer")
  a <- .cli_doc(list(como_leer = TRUE)); b <- .cli_doc(list(como_leer = names(.WORD_COMO_LEER_SECCIONES)))
  for (t in c("Redondeo de las cifras", "Bases chicas e información faltante", "Cifras muy pequeñas", "Una misma escala")) expect_match(a$xml, t, fixed = TRUE)
  expect_equal(a$res$figuras, b$res$figuras); expect_equal(a$res$tablas, b$res$tablas)
  expect_false(grepl("Cómo leer este informe", .cli_doc(list(como_leer = FALSE))$xml, fixed = TRUE))
})

test_that("la validación de como_leer: vector de claves válido, clave desconocida 400, auto y lógicos como antes", {
  o <- .graficos_opciones_documento(list(como_leer = list("top_two_box", "cifras_pequenas")))
  expect_identical(o$como_leer, c("top_two_box", "cifras_pequenas"))
  e <- tryCatch(.graficos_opciones_documento(list(como_leer = list("top_two_box", "inventada"))), error = function(e) e)
  expect_identical(e$code %||% attr(e, "code") %||% e$body$code, "E_BAD_DOCUMENTO_WORD")
  expect_null(.graficos_opciones_documento(list(como_leer = "auto"))$como_leer)
  expect_true(.graficos_opciones_documento(list(como_leer = TRUE))$como_leer)
  # lo guardado inválido se descarta con aviso, no rompe
  expect_warning(v <- .graficos_documento_word_validos(list(como_leer = list("x"), portada = "B")), "como_leer")
  expect_null(v$como_leer); expect_identical(v$portada, "B")
})

test_that("indices por defecto: Contenido, índice de gráficos e índice de tablas al inicio, igual que hoy", {
  skip_if_not_installed("officer")
  o <- .cli_doc(list())
  x <- o$xml
  expect_match(x, 'TOC \\o "1-2"', fixed = TRUE)
  for (t in c("Contenido", "Índice de gráficos", "Índice de tablas")) expect_match(x, t, fixed = TRUE)
  expect_lt(regexpr("Índice de gráficos", x, fixed = TRUE)[1], regexpr("Perfil del encuestado", x, fixed = TRUE)[1])
  expect_identical(.graficos_documento_word_defaults_publicos()$indices, list(contenido = TRUE, graficos = "inicio", tablas = "inicio"))
})

test_that("indices$contenido = FALSE quita el párrafo «Contenido» y el TOC de títulos, no los otros índices", {
  skip_if_not_installed("officer")
  x <- .cli_doc(list(indices = list(contenido = FALSE)))$xml
  expect_false(grepl("TOC \\o", x, fixed = TRUE)); expect_false(grepl(">Contenido<", x, fixed = TRUE))
  expect_match(x, "Índice de gráficos", fixed = TRUE); expect_match(x, "\\c \"Gráfico\"", fixed = TRUE)
})

test_that("indices$graficos = \"anexo\" lleva el índice al final, antes de la contraportada y sin sumar capítulo", {
  skip_if_not_installed("officer")
  o <- .cli_doc(list(indices = list(graficos = "anexo", tablas = FALSE)))
  x <- o$xml
  pos <- function(t) regexpr(t, x, fixed = TRUE)[1]
  expect_true(pos("Índice de gráficos") > pos("Perfil del encuestado"))
  expect_lt(pos("Índice de gráficos"), pos("pulsopucp@pucp.edu.pe"))        # antes de la contraportada
  expect_false(grepl("Índice de tablas", x, fixed = TRUE))
  expect_match(x, 'TOC \\o "1-2"', fixed = TRUE)                             # el Contenido sigue al inicio
  expect_false(grepl(">2\\. ", x))                                           # ningún capítulo 2: no suma numeración
  expect_equal(o$res$figuras, 1L)
})

test_that("sin ningún índice al inicio no queda la página de Contenido", {
  skip_if_not_installed("officer")
  x <- .cli_doc(list(indices = list(contenido = FALSE, graficos = "anexo", tablas = "anexo")))$xml
  expect_false(grepl("TOC \\o", x, fixed = TRUE))
  expect_true(regexpr("Índice de gráficos", x, fixed = TRUE)[1] > regexpr("Perfil del encuestado", x, fixed = TRUE)[1])
  expect_true(regexpr("Índice de tablas", x, fixed = TRUE)[1] > regexpr("Perfil del encuestado", x, fixed = TRUE)[1])
})

test_that("la validación de indices: forma admitida, normalizada, y 400 con valor o clave inválidos", {
  o <- .graficos_opciones_documento(list(indices = list(contenido = FALSE, graficos = "Anexo", tablas = FALSE)))
  expect_identical(o$indices, list(contenido = FALSE, graficos = "anexo", tablas = FALSE))
  for (mal in list(list(graficos = "final"), list(contenido = "no"), list(otro = TRUE))) {
    e <- tryCatch(.graficos_opciones_documento(list(indices = mal)), error = function(e) e)
    expect_identical(e$code %||% attr(e, "code") %||% e$body$code, "E_BAD_DOCUMENTO_WORD")
  }
  # al guardar sólo viaja lo que difiere del default
  expect_identical(.graficos_documento_word_solo_decisiones(list(indices = list(contenido = TRUE, graficos = "anexo", tablas = "inicio"))),
                   list(indices = list(graficos = "anexo")))
  expect_identical(.graficos_documento_word_solo_decisiones(list(indices = list(contenido = TRUE, graficos = "inicio"))), list())
})
