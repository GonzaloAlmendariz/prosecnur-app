# Tercera tanda del checklist de exportacion del formulario (2026-10-15),
# items 38-49: lo que destapo el corpus de instrumentos reales. Cada test se
# comprobo en ROJO contra una COPIA del paquete anterior (`git archive` del
# commit previo, no un revert en proceso: trampa 7 del GOAL) y la literalidad se
# mide en el ARTEFACTO (trampa 3).

.t3_pdftotext <- function() Sys.which("pdftotext")

.t3_texto_pdf <- function(path) {
  paste(system2(.t3_pdftotext(), c("-layout", shQuote(path), "-"), stdout = TRUE), collapse = "\n")
}

.t3_texto_docx <- function(path) {
  d <- tempfile("t3_docx_"); on.exit(unlink(d, recursive = TRUE), add = TRUE)
  utils::unzip(path, files = "word/document.xml", exdir = d)
  x <- xml2::read_xml(file.path(d, "word", "document.xml"))
  paste(xml2::xml_text(xml2::xml_find_all(x, "//w:t", xml2::xml_ns(x))), collapse = " ")
}

# Palabras del PDF con su caja en NPC (origen abajo-izquierda) y su pagina.
.t3_palabras <- function(path) {
  x <- xml2::read_xml(paste(system2(.t3_pdftotext(), c("-bbox", shQuote(path), "-"), stdout = TRUE),
                            collapse = "\n"))
  ns <- xml2::xml_ns(x)
  pgs <- xml2::xml_find_all(x, "//d1:page", ns)
  do.call(rbind, lapply(seq_along(pgs), function(i) {
    W <- as.numeric(xml2::xml_attr(pgs[[i]], "width")); H <- as.numeric(xml2::xml_attr(pgs[[i]], "height"))
    w <- xml2::xml_find_all(pgs[[i]], ".//d1:word", ns)
    if (!length(w)) return(NULL)
    data.frame(page = i, texto = xml2::xml_text(w),
               x0 = as.numeric(xml2::xml_attr(w, "xMin")) / W,
               y1 = 1 - as.numeric(xml2::xml_attr(w, "yMin")) / H, stringsAsFactors = FALSE)
  }))
}

# =============================================================================
# Item 38: la lista de opciones en la columna `list_name` de survey
# =============================================================================

.t3_fixture_list_name <- function() {
  list(
    survey = data.frame(
      type = c("select_one", "select_multiple", "text"),
      list_name = c("sn", "medios", ""),
      name = c("p1", "p2", "p3"),
      label = c("¿Desea continuar?", "¿Qué medios usa?", "Comentario"),
      stringsAsFactors = FALSE),
    choices = data.frame(
      list_name = c("sn", "sn", "medios", "medios", "medios"),
      name = c("1", "2", "1", "2", "3"),
      label = c("Sí, continúo", "No continúo", "Radio", "Prensa escrita", "Televisión"),
      stringsAsFactors = FALSE),
    settings = list(form_title = "Lista separada"))
}

test_that("item 38: una pregunta con la lista en `list_name` imprime sus opciones (modelo, PDF y Word)", {
  fx <- .t3_fixture_list_name()
  m <- formulario_pdf_build_model(fx$survey, fx$choices, fx$settings)
  q <- Filter(function(b) identical(b$kind, "question") && b$type %in% c("select_one", "select_multiple"), m$blocks)
  expect_length(q, 2L)
  expect_identical(vapply(q, function(b) length(b$options), integer(1)), c(2L, 3L))

  skip_if_not(nzchar(.t3_pdftotext()))
  pdf <- tempfile(fileext = ".pdf"); on.exit(unlink(pdf), add = TRUE)
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = pdf, options = list(columns = 1))
  txt <- .t3_texto_pdf(pdf)
  for (lbl in fx$choices$label) expect_true(grepl(lbl, txt, fixed = TRUE), info = lbl)

  skip_if_not_installed("officer")
  docx <- tempfile(fileext = ".docx"); on.exit(unlink(docx), add = TRUE)
  reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = docx, options = list(columns = 1))
  wt <- .t3_texto_docx(docx)
  for (lbl in fx$choices$label) expect_true(grepl(lbl, wt, fixed = TRUE), info = lbl)
})

test_that("item 38: si el `type` ya trae la lista, manda el `type`", {
  sv <- data.frame(type = "select_one sn", list_name = "otra", name = "p1", label = "P",
                   stringsAsFactors = FALSE)
  expect_identical(.form_pdf_tipo_con_lista(sv)$type, "select_one sn")
})

# =============================================================================
# Item 42: «extremos» solo para escalas numericas; divisores bajo la cabecera
# =============================================================================

.t3_dias <- function() {
  data.frame(list_name = "dias", name = c(as.character(1:7), "0", "99"),
             label = c("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
                       "Domingo", "Ningún día", "NS/NR"),
             stringsAsFactors = FALSE)
}

test_that("item 42: una lista nominal de mas de 6 categorias va por categorias; una numerica, por extremos", {
  opc <- function(labels) lapply(seq_along(labels), function(k) list(code = as.character(k), label = labels[k]))
  expect_identical(.form_pdf_matrix_header_mode(opc(.t3_dias()$label[1:8])), "categorias")
  expect_identical(.form_pdf_matrix_header_mode(opc(c("Nada", "", "", "", "Mucho"))), "extremos")
  expect_identical(.form_pdf_matrix_header_mode(opc(c("Nada", "2", "3", "4", "5", "6", "Mucho"))), "extremos")
  expect_identical(.form_pdf_matrix_header_mode(opc(as.character(0:10))), "extremos")
  expect_identical(.form_pdf_matrix_header_mode(opc(c("Muy malo", "Malo", "Bueno"))), "categorias")
  # El override del usuario sigue mandando.
  expect_identical(.form_pdf_matrix_header_mode(opc(.t3_dias()$label[1:8]), "extremos"), "extremos")
})

.t3_fixture_matriz_dias <- function() {
  list(
    survey = data.frame(type = rep("select_multiple dias", 3), name = c("m1", "m2", "m3"),
                        label = c("Prensa escrita", "Radio", "Televisión"), stringsAsFactors = FALSE),
    choices = .t3_dias(),
    settings = list(form_title = "Dias"),
    options = list(columns = 1, matrix_groups = list(list(
      members = c("m1", "m2", "m3"), tenor = "¿Qué días ha visto información política en...?"))))
}

test_that("item 42: la matriz de dias imprime todas las categorias en PDF y Word", {
  skip_if_not(nzchar(.t3_pdftotext()))
  fx <- .t3_fixture_matriz_dias()
  pdf <- tempfile(fileext = ".pdf"); on.exit(unlink(pdf), add = TRUE)
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = pdf, options = fx$options)
  pal <- .t3_palabras(pdf)$texto
  for (d in c("Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")) {
    expect_true(any(startsWith(pal, substr(d, 1, 4))), info = d)
  }
  skip_if_not_installed("officer")
  docx <- tempfile(fileext = ".docx"); on.exit(unlink(docx), add = TRUE)
  reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = docx, options = fx$options)
  wt <- .t3_texto_docx(docx)
  for (d in c("Martes", "Jueves", "Domingo")) expect_true(grepl(d, wt, fixed = TRUE), info = d)
})

test_that("item 42: los divisores punteados de la escala empiezan bajo la cabecera", {
  # Rojo: con `extremos` el rotulo se centra sobre su mitad de columnas y una
  # linea a toda altura lo tachaba («Lu|nes»). Se capturan las lineas que dibuja
  # el renderer y se compara la punta de las punteadas con el tope de la tabla
  # (lo marca el divisor solido etiqueta|escala, que si es a toda altura).
  lineas <- list()
  local_mocked_bindings(grid.lines = function(x = grid::unit(c(0, 1), "npc"),
                                              y = grid::unit(c(0, 1), "npc"), ..., gp = grid::gpar()) {
    lineas[[length(lineas) + 1L]] <<- list(x = as.numeric(x), y = as.numeric(y), lty = gp$lty %||% "solid")
    invisible(NULL)
  }, .package = "grid")
  for (modo in c("extremos", "categorias")) {
    lineas <- list()
    fx <- .t3_fixture_matriz_dias()
    fx$options$matrix_groups[[1]]$header_mode <- modo
    pdf <- tempfile(fileext = ".pdf")
    reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = pdf, options = fx$options)
    unlink(pdf)
    punteadas <- Filter(function(l) identical(l$lty, "dotted"), lineas)
    verticales <- Filter(function(l) !identical(l$lty, "dotted") && length(l$x) == 2L &&
                           abs(diff(l$x)) < 1e-9 && abs(diff(l$y)) > 0.02, lineas)
    expect_gt(length(punteadas), 0L)
    tope_tabla <- max(vapply(verticales, function(l) max(l$y), numeric(1)))
    tope_punteadas <- max(vapply(punteadas, function(l) max(l$y), numeric(1)))
    expect_lt(tope_punteadas, tope_tabla - 0.005, label = paste("modo", modo))
  }
})

# =============================================================================
# Item 43: idioma por defecto -> label sin idioma -> otro idioma con aviso
# =============================================================================

test_that("item 43: el orden es idioma por defecto, label plana y otro idioma declarado; otra escritura nunca", {
  sv <- data.frame(
    type = c("text", "text", "text", "note"),
    name = c("a", "b", "c", "intro2"),
    `label::Español (es)` = c("Uno ES", "", "", "Nota ES"),
    label = c("Uno plano", "Dos plano", "", ""),
    `label::English (en)` = c("One", "Two", "Three", "Note"),
    `hint::Español (es)` = c("", "", "", ""),
    `hint::العربية (ar)` = c("", "", "", "يجب ملء"),
    check.names = FALSE, stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "x", name = "1", label = "Sí", stringsAsFactors = FALSE)
  st <- data.frame(form_title = "Idiomas", default_language = "Español (es)", stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, ch, st)
  q <- Filter(function(b) identical(b$kind, "question"), m$blocks)
  # (sin la etiqueta `[var]` del item 39, que no es el rotulo)
  lab <- stats::setNames(vapply(q, function(b) sub(" \\[[^]]*\\]$", "", b$label), ""),
                         vapply(q, function(b) b$name, ""))
  expect_identical(unname(lab[c("a", "b", "c")]), c("Uno ES", "Dos plano", "Three"))
  expect_true(any(grepl("otro idioma.*`c` \\(label::English \\(en\\)\\)", m$warnings)))
  # La ayuda en arabe no se imprime y se declara.
  expect_false(any(grepl("[؀-ۿ]", unlist(lapply(m$blocks, function(b) c(b$label, b$hint))))))
  expect_true(any(grepl("otra escritura.*intro2", m$warnings)))
})

test_that("item 43: sin `default_language` el idioma por defecto es el espanol", {
  df <- data.frame(`label::en` = c("English one", "English two"), `label::es` = c("Español uno", ""),
                   check.names = FALSE, stringsAsFactors = FALSE)
  out <- xlsform_coalesce_label(df, lang = "es", kind = "label")
  expect_identical(as.character(out), c("Español uno", "English two"))
  expect_identical(attr(out, "otro_idioma")$columna, "label::en")
})

# =============================================================================
# Item 45: el equilibrio de columnas se recalcula en cada pagina
# =============================================================================

test_that("item 45: la cola de un tramo que pasa de pagina queda repartida entre las dos columnas", {
  skip_if_not(nzchar(.t3_pdftotext()))
  # Preguntas abiertas iguales (un tramo de dos columnas que no cabe en una
  # pagina) y una seccion despues. Medido con el codigo anterior: con 30 la p. 2
  # quedaba 8/0 y con 60 la p. 3 quedaba 12/2; ahora 4/4 y 7/7.
  for (n in c(30L, 60L)) {
    sv <- data.frame(type = c(rep("text", n), "begin_group", "text", "end_group"),
                     name = c(sprintf("q%02d", seq_len(n)), "g", "fin", ""),
                     label = c(sprintf("Pregunta abierta numero %d", seq_len(n)), "Cierre", "Ultima", ""),
                     stringsAsFactors = FALSE)
    ch <- data.frame(list_name = character(0), name = character(0), label = character(0))
    pdf <- tempfile(fileext = ".pdf")
    reporte_formulario_pdf(sv, ch, list(form_title = "Tramo largo"), output_file = pdf,
                           options = list(columns = 2, no_default_intro = TRUE))
    pal <- .t3_palabras(pdf)
    unlink(pdf)
    q <- pal[pal$texto == "Pregunta", , drop = FALSE]
    expect_gte(max(q$page), 2L)
    for (p in unique(q$page)) {
      en_p <- q[q$page == p, , drop = FALSE]
      izq <- sum(en_p$x0 < 0.5); der <- sum(en_p$x0 >= 0.5)
      expect_lte(abs(izq - der), 1L,
                 label = sprintf("n=%d pagina %d: %d a la izquierda y %d a la derecha", n, p, izq, der))
    }
  }
})

# =============================================================================
# Item 49: el corpus no funde ediciones de anos distintos
# =============================================================================

test_that("item 49: ediciones de anos distintos quedan como instrumentos aparte, tambien por cadena", {
  rel <- c("e/2024/HSYVBG2024_v5.xlsx", "e/Historico 2025/Instrumento2025.xlsx",
           "e/Instrumento/Instrumento2026_v2.xlsx", "h/HST/Instrumento_Definitivo.xlsx",
           "e/Instrumento/Instrumento2026_v2.bak-20260807-prev3.xlsx")
  nombres <- rep(list(paste0("p", 1:40)), length(rel))
  g <- .corpus_agrupar_versiones(rel, nombres, 0.8)
  expect_identical(g$anio, c(2024L, 2025L, 2026L, NA, 2026L))
  # 2024, 2025 y 2026 en grupos distintos; las dos de 2026 juntas; la sin ano
  # se une a uno solo y no sirve de puente.
  expect_length(unique(g$cluster[1:3]), 3L)
  expect_identical(g$cluster[3], g$cluster[5])
  expect_true(g$cluster[4] %in% g$cluster[1:3])
})

# =============================================================================
# Items 39, 40, 41, 44 y 46 con la regla vigente:
# docs/qa/reglas-papel-numeracion-saltos-2026-10-15.md
# =============================================================================

.t3_sn <- function(list_name = "sn", codes = c("1", "2"), labels = c("Sí", "No")) {
  data.frame(list_name = list_name, name = codes, label = labels, stringsAsFactors = FALSE)
}
.t3_bloque <- function(m, nombre) Filter(function(b) identical(b$name, nombre), m$blocks)[[1]]
.t3_salto <- function(b, code) {
  for (o in b$options) if (identical(o$code, code)) return(o$paper_skip %||% "")
  NA_character_
}
.t3_numeros <- function(m) {
  unlist(lapply(m$blocks, function(b) if (b$kind %in% c("question", "matrix") && nzchar(b$number %||% "")) b$number))
}

test_that("item 39: `censo_2025` ya no se imprime como pregunta 2025; secuencial con aviso y `[var]`", {
  sv <- data.frame(type = c("integer", "text", "select_one sn", "integer"),
                   name = c("p1", "p2", "p3", "censo_2025"),
                   label = c("Edad", "Nombre", "¿Trabaja?", "Poblacion del censo"),
                   stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, .t3_sn(), list(form_title = "N"))
  nums <- .t3_numeros(m)
  expect_identical(nums, c("1", "2", "3", "4"))
  expect_identical(.t3_bloque(m, "censo_2025")$label, "Poblacion del censo [censo_2025]")
  expect_identical(.t3_bloque(m, "p1")$label, "Edad")          # 1 = p1: sin etiqueta
  expect_true(any(grepl("Numeracion secuencial.*censo_2025", m$warnings)))
})

test_that("item 39: el esquema derivado se usa entero cuando cumple todo (modulos y subnumeros)", {
  sv <- data.frame(type = c("select_one sn", "text", "text", "text", "integer"),
                   name = c("A1", "A2", "A3_1", "A3_2", "B1"),
                   label = c("Uno", "Dos", "Seis uno", "Seis dos", "Otro modulo"),
                   relevant = c("", "${A1} = '1'", "", "", ""),
                   stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, .t3_sn(), list(form_title = "N"))
  expect_identical(.t3_numeros(m), c("A1", "A2", "A3.1", "A3.2", "B1"))
  expect_false(any(grepl("\\[", vapply(Filter(function(b) identical(b$kind, "question"), m$blocks),
                                       function(b) b$label, ""))))
  # Los saltos nombran el mismo rotulo impreso.
  expect_identical(.t3_salto(.t3_bloque(m, "A1"), "2"), "pase a la pregunta A3.1")
  expect_false(any(grepl("Numeracion", m$warnings)))
})

test_that("item 39: una secuencia derivada que no crece cae a secuencial y dice donde", {
  sv <- data.frame(type = rep("text", 4), name = c("p1", "p2", "p4", "p3"),
                   label = c("a", "b", "c", "d"), stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, .t3_sn(), list(form_title = "N"))
  expect_identical(.t3_numeros(m), c("1", "2", "3", "4"))
  expect_true(any(grepl("no es creciente \\(p4 -> p3\\)", m$warnings)))
})

.t3_fixture_consent <- function() {
  list(
    survey = data.frame(
      type = c("select_one sn", "begin_group", "text", "integer", "end_group",
               "begin_group", "text", "end_group", "note"),
      name = c("acepta", "modA", "A1", "A2", "", "modB", "B1", "", "mensaje_no"),
      label = c("¿Aceptas participar?", "Modulo A", "Codigo", "Edad", "",
                "Modulo B", "Comentario", "", "Gracias por tu tiempo"),
      relevant = c("", "${acepta} = '1'", "", "", "", "${acepta} = '1'", "", "", "${acepta} = '2'"),
      stringsAsFactors = FALSE),
    choices = .t3_sn(labels = c("Sí, acepto", "No deseo")))
}

test_that("item 40: el consentimiento — Si sigue sin salto, No va a Fin (antes: Si -> Fin, No -> P32)", {
  fx <- .t3_fixture_consent()
  m <- formulario_pdf_build_model(fx$survey, fx$choices, list(form_title = "C"))
  b <- .t3_bloque(m, "acepta")
  expect_identical(.t3_salto(b, "1"), "")
  expect_identical(.t3_salto(b, "2"), "Fin de la encuesta")
  # La nota de cierre lleva su condicion (§41.4); los modulos no (los cubre el Fin).
  expect_match(.t3_bloque(m, "mensaje_no")$opening_condition, "P1 = 2", fixed = TRUE)
  expect_identical(Filter(function(x) identical(x$kind, "section"), m$blocks)[[1]]$opening_condition, "")
  expect_identical(nrow(.form_pdf_simular(m)), 0L)
})

.t3_fixture_a6 <- function() {
  list(
    survey = data.frame(
      type = c(rep("text", 5), "select_one lugar", "select_one d1", "select_one d2", "select_one d3", "text"),
      name = c(paste0("A", 1:5), "A6", "A6_1", "A6_2", "A6_3", "A7"),
      label = c(paste("Pregunta", 1:5), "¿Donde vives?", "Distrito de Lima", "Distrito del Callao",
                "Provincia", "Otra cosa"),
      relevant = c(rep("", 5), "", "${A6} = '1'", "${A6} = '2'", "${A6} = '3'", ""),
      stringsAsFactors = FALSE),
    choices = rbind(
      .t3_sn("lugar", c("1", "2", "3", "4"), c("Lima", "Callao", "Provincias", "Extranjero")),
      .t3_sn("d1", c("1", "2"), c("Cercado", "Surco")), .t3_sn("d2", c("1", "2"), c("Bellavista", "Ventanilla")),
      .t3_sn("d3", c("1", "2"), c("Huaral", "Canete"))))
}

test_that("item 40: saltos por opcion y saltos de salida (patron A6 de CCSS)", {
  fx <- .t3_fixture_a6()
  m <- formulario_pdf_build_model(fx$survey, fx$choices, list(form_title = "A6"))
  a6 <- .t3_bloque(m, "A6")
  expect_identical(.t3_salto(a6, "1"), "")
  expect_identical(.t3_salto(a6, "2"), "pase a la pregunta A6.2")
  expect_identical(.t3_salto(a6, "3"), "pase a la pregunta A6.3")
  expect_identical(.t3_salto(a6, "4"), "pase a la pregunta A7")
  expect_identical(.t3_bloque(m, "A6_1")$skip, "Pase a la pregunta A7")
  expect_identical(.t3_bloque(m, "A6_2")$skip, "Pase a la pregunta A7")
  expect_identical(.t3_bloque(m, "A6_3")$skip, "")
  expect_identical(nrow(.form_pdf_simular(m)), 0L)
})

test_that("item 40: sin destino comun no hay salto de salida (patron MDV P49)", {
  sv <- data.frame(
    type = c("select_one sit", "text", "text", "text", "text"),
    name = c("sit", "q_empleo", "q_busca", "q_negocio", "fin"),
    label = c("Situacion", "Empleo", "Busqueda", "Negocio", "Final"),
    relevant = c("", "${sit} = '1' or ${sit} = '2'", "${sit} = '3'", "${sit} = '2'", ""),
    stringsAsFactors = FALSE)
  ch <- .t3_sn("sit", c("1", "2", "3"), c("Asalariado", "Independiente", "Busca"))
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "MDV"))
  expect_identical(.t3_bloque(m, "q_empleo")$skip, "")
  expect_identical(nrow(.form_pdf_simular(m)), 0L)
})

test_that("item 41: AND, OR y comparaciones se imprimen en lenguaje llano, tambien en modo saltos", {
  sv <- data.frame(
    type = c("hidden", "integer", "select_one sn", "select_one tres", "text", "text", "text"),
    name = c("collectorID", "edad", "trabaja", "nivel", "q_and", "q_or", "q_resp"),
    label = c("", "Edad", "¿Trabaja?", "Nivel", "Detalle laboral", "Detalle nivel", "Repite"),
    relevant = c("", "", "", "",
                 "${edad} >= 18 and ${trabaja} = '1'",
                 "${nivel} = '1' or ${nivel} = '3'",
                 "${edad} != '' and ${collectorID} != ''"),
    stringsAsFactors = FALSE)
  ch <- rbind(.t3_sn(), .t3_sn("tres", c("1", "2", "3"), c("Bajo", "Medio", "Alto")))
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "C"))
  expect_identical(.t3_bloque(m, "q_and")$opening_condition,
                   "FILTRO — Aplique sólo si P1 es 18 o más y P2 = 1 «Sí».")
  # El OR sobre una variable es un conjunto (§41.1). No lo cubre un salto: tras
  # P3 viene P4, que no depende de P3, asi que el destino de la opcion 2 es la
  # siguiente y la condicion se imprime en P5.
  expect_identical(.t3_salto(.t3_bloque(m, "nivel"), "2"), "")
  expect_identical(.t3_bloque(m, "q_or")$opening_condition,
                   "FILTRO — Aplique sólo si P3 = 1 «Bajo» o 3 «Alto».")
  expect_identical(.t3_bloque(m, "q_resp")$opening_condition, "FILTRO — Aplique sólo si respondió P1.")
  expect_true(any(grepl("asume cumplidas.*collectorID", m$warnings)))
  skip_if_not(nzchar(.t3_pdftotext()))
  pdf <- tempfile(fileext = ".pdf"); on.exit(unlink(pdf), add = TRUE)
  reporte_formulario_pdf(sv, ch, list(form_title = "C"), output_file = pdf, options = list(columns = 1))
  txt <- .t3_texto_pdf(pdf)
  expect_false(grepl("${", txt, fixed = TRUE))
  expect_false(grepl("selected(", txt, fixed = TRUE))
  expect_false(grepl("!=", txt, fixed = TRUE))
  expect_match(txt, "Aplique sólo si P1 es 18 o más", fixed = TRUE)
})

test_that("item 41: un AND con OR anidado se redacta con parentesis y no pierde el filtro", {
  sv <- data.frame(type = c("select_one sn", "select_one tres", "text"), name = c("a", "b", "c"),
                   label = c("A", "B", "C"),
                   relevant = c("", "", "${a} = '1' and (${b} = '1' or ${b} = '2')"), stringsAsFactors = FALSE)
  ch <- rbind(.t3_sn(), .t3_sn("tres", c("1", "2", "3"), c("Bajo", "Medio", "Alto")))
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "C"))
  expect_identical(.t3_bloque(m, "c")$opening_condition,
                   "FILTRO — Aplique sólo si P1 = 1 «Sí» y P2 = 1 «Bajo» o 2 «Medio».")
  expect_identical(nrow(.form_pdf_simular(m)), 0L)
})

test_that("item 44: campos de control, cabecera de table-list, geopunto, proceso y «Especifique» estructural", {
  sv <- data.frame(
    type = c("start", "date", "integer", "geopoint", "select_one sn", "select_one sn", "select_one sn",
             "text", "integer", "select_one tres", "text"),
    name = c("start", "fecha", "n_cuestionario", "gps", "hdr", "m1", "m2",
             "m2_cod", "edad", "nivel", "nivel_otro"),
    label = c("", "", "N.º de cuestionario", "", "", "Item uno", "Item dos",
              "Recodificada", "Edad", "Nivel", "Especifique"),
    calculation = c("", "today()", "", "", "", "", "", "", "", "", ""),
    appearance = c("", "", "", "", "label", "list-nolabel", "list-nolabel", "", "", "", ""),
    relevant = c(rep("", 10), "${nivel} = '3'"),
    stringsAsFactors = FALSE)
  ch <- rbind(.t3_sn(), .t3_sn("tres", c("1", "2", "3"), c("Bajo", "Medio", "Otro")))
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "C"),
                                  options = list(matrix_groups = list(list(members = c("m1", "m2"), tenor = "Bateria"))))
  ctrl <- Filter(function(b) isTRUE(b$control), m$blocks)
  expect_identical(vapply(ctrl, `[[`, "", "label"), c("Hora de inicio: [start]", "Fecha de entrevista: [fecha]"))
  expect_true(all(vapply(ctrl, function(b) b$number, "") == ""))
  nombres <- unlist(lapply(m$blocks, function(b) c(b$name, vapply(b$items %||% list(), `[[`, "", "name"))))
  for (fuera in c("n_cuestionario", "gps", "hdr", "m2_cod", "nivel_otro")) expect_false(fuera %in% nombres, info = fuera)
  expect_true(any(grepl("ubicacion.*gps", m$warnings)))
  expect_true(any(grepl("proceso.*m2_cod", m$warnings)))
  expect_true(any(grepl("cabecera", m$warnings)))
  # La fila `appearance=label` no corta la matriz: m1 y m2 siguen juntas.
  mat <- Filter(function(b) identical(b$kind, "matrix"), m$blocks)
  expect_length(mat, 1L)
  expect_identical(vapply(mat[[1]]$items, `[[`, "", "name"), c("m1", "m2"))
  # «Especifique» en linea junto a su opcion, sin numero propio.
  expect_identical(.t3_salto(.t3_bloque(m, "nivel"), "3"), "Especifique: __________ [nivel_otro]")
  expect_identical(.t3_numeros(m), c("1", "2", "3"))
  # Sin casillas en la cabecera, el N.º de cuestionario es un campo de control.
  m2 <- formulario_pdf_build_model(sv, ch, list(form_title = "C"), options = list(show_questionnaire_number = FALSE))
  expect_true("N.º de cuestionario: [n_cuestionario]" %in%
                vapply(Filter(function(b) isTRUE(b$control), m2$blocks), `[[`, "", "label"))
})

test_that("item 46: con origen de seleccion multiple no hay salto por opcion; la condicion va en el destino", {
  sv <- data.frame(type = c("select_multiple medios", "text", "text"),
                   name = c("medios", "cual", "fin"), label = c("Medios", "Detalle de la radio", "Fin"),
                   relevant = c("", "selected(${medios}, '96') and not(selected(${medios}, '99'))", ""),
                   stringsAsFactors = FALSE)
  ch <- .t3_sn("medios", c("1", "96", "99"), c("Radio", "Otro", "Ninguno"))
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "M"))
  expect_true(all(vapply(.t3_bloque(m, "medios")$options, function(o) !nzchar(o$paper_skip %||% ""), logical(1))))
  expect_identical(.t3_bloque(m, "cual")$opening_condition,
                   "FILTRO — Aplique sólo si en P1 marcó «Otro» (96) y en P1 NO marcó «Ninguno» (99).")
})

test_that("item 46: `_cursiva_` con la regla de palabra y texto en NFC", {
  skip_if_not(nzchar(.t3_pdftotext()))
  sv <- data.frame(type = c("note", "text"), name = c("n1", "q1"),
                   label = c("Escriba al correo _pulso@pucp.edu.pe_ (ver p14_1)",
                             paste0("Ingenieri", intToUtf8(0x301), "a civil")),   # i + tilde combinada (NFD)
                   stringsAsFactors = FALSE)
  pdf <- tempfile(fileext = ".pdf"); on.exit(unlink(pdf), add = TRUE)
  res <- reporte_formulario_pdf(sv, .t3_sn(), list(form_title = "T"), output_file = pdf, options = list(columns = 1))
  txt <- .t3_texto_pdf(pdf)
  expect_false(grepl("_pulso@pucp.edu.pe_", txt, fixed = TRUE))
  expect_match(txt, "pulso@pucp.edu.pe", fixed = TRUE)
  expect_match(txt, "p14_1", fixed = TRUE)                     # dentro de palabra: literal
  expect_match(txt, "Ingeniería", fixed = FALSE)
  expect_false(any(grepl("no tiene .* caracter", res$warnings)))  # sin fuente de reemplazo
})

test_that("simulador (auto-verificacion): ve un salto equivocado", {
  fx <- .t3_fixture_a6()
  m <- formulario_pdf_build_model(fx$survey, fx$choices, list(form_title = "A6"))
  expect_identical(nrow(.form_pdf_simular(m)), 0L)
  # Rojo fabricado: la opcion 2 de A6 manda a A6.3 en vez de A6.2.
  for (bi in seq_along(m$blocks)) if (identical(m$blocks[[bi]]$name, "A6")) {
    m$blocks[[bi]]$options[[2]]$paper_skip <- "pase a la pregunta A6.3"
  }
  sim <- .form_pdf_simular(m)
  expect_gt(nrow(sim), 0L)
  expect_true(any(sim$origen == "A6" & sim$opcion == "2"))
})

# --- Corte del corpus: lo que la re-corrida de contenido encontró ------------

test_that("item 44: el «Especifique» de un campo codificado va en la ayuda, no se pierde", {
  opciones <- as.character(1:25)
  sv <- data.frame(
    type = c("select_one larga", "text"),
    name = c("p10", "p10_other"),
    label = c("Sector de la empresa", "Otro (especifique):"),
    relevant = c("", "${p10} = '25'"),
    stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "larga", name = opciones,
                   label = c(paste("Sector", 1:24), "Otro"), stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "Codificado"))
  q <- Filter(function(b) identical(b$name, "p10"), m$blocks)[[1]]
  expect_true(isTRUE(q$coded_list))
  expect_match(q$hint, "Si responde «Otro» (25), especifique: __________ [p10_other]", fixed = TRUE)
  expect_false(any(vapply(m$blocks, function(b) identical(b$name, "p10_other"), logical(1))))
})

test_that("item 44: el «Especifique» de una fila de matriz va en la instruccion de la fila", {
  sv <- data.frame(
    type = c("select_one acuerdo", "select_one acuerdo", "select_one acuerdo", "text"),
    name = c("p43_1", "p43_2", "p43_3", "p43_3_otro"),
    label = c("Radio", "Prensa", "Otro medio", "ESPECIFICAR"),
    relevant = c("", "", "", "${p43_3} = '4'"),
    stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "acuerdo", name = c("1", "2", "3", "4"),
                   label = c("Nada", "Poco", "Bastante", "Mucho"), stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "Matriz"))
  mat <- Filter(function(b) identical(b$kind, "matrix"), m$blocks)
  skip_if(!length(mat), "el detector no armo matriz con dos filas")
  fila <- Filter(function(it) identical(it$name, "p43_3"), mat[[1]]$items)[[1]]
  expect_match(fila$skip, "Si responde «Mucho», especifique: __________ [p43_3_otro]", fixed = TRUE)
})

test_that("una lista que no existe en choices se avisa y la pregunta queda como campo codificado", {
  sv <- data.frame(type = "select_one lista_inexistente", name = "p6", label = "¿Cuál?",
                   stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "otra", name = "1", label = "Uno", stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, ch, list(form_title = "Lista rota"))
  q <- Filter(function(b) identical(b$name, "p6"), m$blocks)[[1]]
  expect_true(isTRUE(q$coded_list))
  expect_true(any(grepl("pide la lista `lista_inexistente`", m$warnings, fixed = TRUE)))
})

test_that("una etiqueta [var] mas ancha que la linea se parte y no sale del marco", {
  skip_if_not(nzchar(.t3_pdftotext()))
  largo <- "Information_to_give_reasons_not_reporting_other"
  sv <- data.frame(
    type = c("select_one motivos", "text"),
    name = c("motivo", largo),
    label = c("¿Por qué no reportó?", "Otro, por favor especificar"),
    relevant = c("", "${motivo} = '9'"),
    stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "motivos", name = c("1", "2", "9"),
                   label = c("No sabía", "No quiso", "Otro"), stringsAsFactors = FALSE)
  pdf <- tempfile(fileext = ".pdf"); on.exit(unlink(pdf), add = TRUE)
  reporte_formulario_pdf(sv, ch, list(form_title = "Var larga"), output_file = pdf, options = list(columns = 2))
  inv <- .corpus_invariantes_pdf(pdf)
  expect_identical(as.integer(inv$n_fuera_marco), 0L, info = inv$fuera_marco)
})
