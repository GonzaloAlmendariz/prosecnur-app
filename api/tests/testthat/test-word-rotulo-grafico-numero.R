source("setup-load-all.R")

# R1 (Renzo Segura, informe de Arte, 2026-10-27; estándar de la casa, «al igual que en Derecho»): el rótulo de cada figura
# del Word es «Gráfico N° NN: título» y TODO el rótulo va en cursiva, con la negrita, el color y el centrado de siempre.
# El número sigue siendo el campo SEQ (el índice de gráficos lo arma Word con TOC \c "Gráfico"). Igual con «Tabla N° ».
# Prefijo y cursiva son parámetros de la identidad del Word: un cliente puede volver a «Gráfico » sin cursiva.

.wrn_ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

.wrn_docx <- function(doc) {
  out <- tempfile(fileext = ".docx"); print(doc, target = out)
  list(x = xml2::read_xml(unz(out, "word/document.xml")), st = xml2::read_xml(unz(out, "word/styles.xml")))
}

.wrn_texto <- function(x) paste(xml2::xml_text(xml2::xml_find_all(x, "//w:body/w:p[1]//w:t", .wrn_ns)), collapse = "")
.wrn_instr <- function(x) paste(xml2::xml_text(xml2::xml_find_all(x, "//w:instrText", .wrn_ns)), collapse = "")

# rPr del estilo de carácter «Número de rótulo» (lo llevan todos los runs del rótulo)
.wrn_rpr_rotulo <- function(st) {
  id <- xml2::xml_attr(xml2::xml_find_first(st, "//w:style[w:name[@w:val='Número de rótulo']]", .wrn_ns), "styleId")
  xml2::xml_find_first(st, sprintf("//w:style[@w:styleId='%s']/w:rPr", id), .wrn_ns)
}

test_that("por defecto el rótulo es «Gráfico N° 49: título», con el número como campo SEQ Gráfico", {
  r <- .wrn_docx(.word_rotulo(.word_documento_nuevo(), 49, "¿Conoce el reglamento?"))
  expect_identical(.wrn_texto(r$x), "Gráfico N°\u00a049: ¿Conoce el reglamento?")   # C6: espacio duro entre «N°» y su número
  expect_match(.wrn_instr(r$x), "SEQ Gráfico \\* ARABIC", fixed = TRUE)   # el identificador del SEQ no cambia
  # el número visible está DENTRO del campo (entre separate y end), no como texto fijo
  campo <- xml2::xml_find_all(r$x, "//w:r[w:fldChar[@w:fldCharType='separate']]/following-sibling::w:r[1]/w:t", .wrn_ns)
  expect_identical(xml2::xml_text(campo), "49")
})

test_that("todo el rótulo va en cursiva, sin perder negrita ni color, y todos sus runs llevan ese estilo", {
  r <- .wrn_docx(.word_rotulo(.word_documento_nuevo(), 3, "Título"))
  rpr <- .wrn_rpr_rotulo(r$st)
  expect_false(inherits(xml2::xml_find_first(rpr, "w:i", .wrn_ns), "xml_missing"))
  expect_false(inherits(xml2::xml_find_first(rpr, "w:b", .wrn_ns), "xml_missing"))
  expect_identical(toupper(xml2::xml_attr(xml2::xml_find_first(rpr, "w:color", .wrn_ns), "val")), "002060")
  runs <- xml2::xml_find_all(r$x, "//w:body/w:p[1]/w:r", .wrn_ns)
  estilo <- vapply(runs, function(n) xml2::xml_attr(xml2::xml_find_first(n, "w:rPr/w:rStyle", .wrn_ns), "val"), "")
  expect_length(unique(estilo), 1L)                       # prefijo, campo, número, separador y título: el mismo estilo
})

test_that("la tabla numerada sale «Tabla N° 2: …» con su SEQ Tabla", {
  r <- .wrn_docx(.word_rotulo(.word_documento_nuevo(), 2, "Ficha técnica", etiqueta = "Tabla"))
  expect_identical(.wrn_texto(r$x), "Tabla N°\u00a02: Ficha técnica")
  expect_match(.wrn_instr(r$x), "SEQ Tabla \\* ARABIC", fixed = TRUE)
})

test_that("el índice de gráficos sigue llenándose: el TOC pide el mismo identificador que el SEQ del rótulo", {
  doc <- .word_indices(.word_documento_nuevo(), con_tablas = TRUE, donde = "inicio")
  doc <- .word_rotulo(doc, 1, "Uno")
  r <- .wrn_docx(doc)
  ins <- .wrn_instr(r$x)
  expect_match(ins, "TOC[^\"]*\\\\c \"Gráfico\"")
  expect_match(ins, "TOC[^\"]*\\\\c \"Tabla\"")
  expect_match(ins, "SEQ Gráfico", fixed = TRUE)
})

test_that("un cliente puede volver al formato anterior: «Gráfico 49: título» sin cursiva", {
  withr::local_options(prosecnur.word_rotulo = list(prefijo = "Gráfico ", prefijo_tabla = "Tabla ", cursiva = FALSE))
  r <- .wrn_docx(.word_rotulo(.word_documento_nuevo(), 49, "Título"))
  expect_identical(.wrn_texto(r$x), "Gráfico 49: Título")
  i <- xml2::xml_find_first(.wrn_rpr_rotulo(r$st), "w:i", .wrn_ns)   # sin cursiva: ausente o apagada
  expect_true(inherits(i, "xml_missing") || xml2::xml_attr(i, "val") %in% c("false", "0"))
  expect_false(inherits(xml2::xml_find_first(.wrn_rpr_rotulo(r$st), "w:b", .wrn_ns), "xml_missing"))
})

test_that("el estilo del cliente valida, conserva y entrega `rotulo_figura` al worker del Word", {
  ok <- list(rotulo_figura = list(prefijo = "Gráfico ", cursiva = FALSE))
  expect_silent(.graficos_estilo_cliente_validar(ok))
  expect_error(.graficos_estilo_cliente_validar(list(rotulo_figura = list(cursiva = "quizá"))), class = "api_error")
  expect_error(.graficos_estilo_cliente_validar(list(rotulo_figura = list(prefijo = ""))), class = "api_error")
  expect_error(.graficos_estilo_cliente_validar(list(rotulo_figura = "Gráfico")), class = "api_error")
  expect_identical(.graficos_estilo_cliente_solo_decisiones(ok)$rotulo_figura, ok$rotulo_figura)
  local_mocked_bindings(session_get = function(...) list(files = list()))
  est <- .graficos_estilo_cliente_resolver("sid", list(estilo_cliente = ok), "word")
  expect_identical(est$rotulo_figura$prefijo, "Gráfico ")
  withr::local_options(prosecnur.word_rotulo = NULL)
  ec <- .graficos_estilo_cliente_iniciar(est, "word")
  expect_false(.word_rotulo_conf()$cursiva)
  options(ec$previas)
  expect_true(.word_rotulo_conf()$cursiva)                 # al salir el worker repone el default
  # el PPT no lo aplica
  ec2 <- .graficos_estilo_cliente_iniciar(est, "ppt"); on.exit(options(ec2$previas), add = TRUE)
  expect_true(.word_rotulo_conf()$cursiva)
})
