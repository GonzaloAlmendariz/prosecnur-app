# Segunda tanda del checklist de exportacion del formulario (2026-10-15),
# items 14-19. Cada test se comprobo en ROJO contra una COPIA del paquete
# anterior (no con un revert en proceso: `test_file` recarga y da falso verde,
# trampa 7 del GOAL) y la literalidad se mide en el ARTEFACTO (trampa 3).

# --- utilidades --------------------------------------------------------------

.t2_pdftotext <- function() Sys.which("pdftotext")

# Palabras de un PDF con su caja y su pagina (pdftotext -bbox, parseado con xml2).
.t2_palabras_pdf <- function(path) {
  out <- system2(.t2_pdftotext(), c("-bbox", shQuote(path), "-"), stdout = TRUE)
  x <- xml2::read_html(paste(out, collapse = "\n"))
  paginas <- xml2::xml_find_all(x, "//page")
  do.call(rbind, lapply(seq_along(paginas), function(i) {
    w <- xml2::xml_find_all(paginas[[i]], ".//word")
    if (!length(w)) return(NULL)
    data.frame(pagina = i, texto = xml2::xml_text(w),
               xmin = as.numeric(xml2::xml_attr(w, "xmin")),
               xmax = as.numeric(xml2::xml_attr(w, "xmax")),
               ymin = as.numeric(xml2::xml_attr(w, "ymin")),
               ymax = as.numeric(xml2::xml_attr(w, "ymax")),
               stringsAsFactors = FALSE)
  }))
}

# Flujos de contenido de un PDF de R (`pdf()` los comprime con zlib), como
# texto en bytes: es donde se ve con que FUENTE se pinta cada cadena (`/F3 1 Tf
# ... (palabra) Tj`). Un raster no sirve para eso aqui: la fuente no va
# embebida y poppler/PDFKit sustituyen Helvetica-Narrow-Bold por una redonda.
.t2_pdf_flujos <- function(path) {
  raw <- readBin(path, "raw", file.info(path)$size)
  st <- grepRaw("stream\n", raw, all = TRUE, fixed = TRUE)
  st <- st[st > 3 & vapply(st, function(p) rawToChar(raw[(p - 3):(p - 1)]) != "end", logical(1))]
  en <- grepRaw("endstream", raw, all = TRUE, fixed = TRUE)
  out <- character(0)
  for (p in st) {
    fin <- en[en > p][1]
    if (is.na(fin)) next
    b <- raw[(p + 7):(fin - 1)]
    d <- tryCatch(memDecompress(b, type = "gzip"), error = function(e) b)
    out <- c(out, rawToChar(d[d != as.raw(0)]))
  }
  list(flujos = out, crudo = rawToChar(raw[raw != as.raw(0)]))
}

# Fuente (BaseFont) con que el PDF pinta exactamente `palabra`: lee cada
# operacion de texto `/Fn 1 Tf ... (..) Tj` o `[(..) n (..)] TJ` del flujo.
.t2_pdf_fuentes_de <- function(pdfx, palabra, empieza = FALSE) {
  m <- regmatches(pdfx$crudo, gregexpr("/Name /F[0-9]+ /BaseFont /[A-Za-z-]+", pdfx$crudo, useBytes = TRUE))[[1]]
  base <- stats::setNames(sub("^.*/BaseFont /", "", m), sub("^/Name (/F[0-9]+) .*$", "\\1", m))
  lineas <- unlist(strsplit(paste(pdfx$flujos, collapse = "\n"), "\n", useBytes = TRUE))
  ops <- grep(" Tf .* T[jJ]$", lineas, value = TRUE, useBytes = TRUE)
  out <- character(0)
  for (op in ops) {
    cadenas <- regmatches(op, gregexpr("\\(([^)\\\\]|\\\\.)*\\)", op, useBytes = TRUE))[[1]]
    txt <- paste(sub("^\\((.*)\\)$", "\\1", cadenas, useBytes = TRUE), collapse = "")
    if (identical(txt, palabra) || (empieza && startsWith(txt, palabra))) out <- c(out, base[[sub(" .*$", "", op)]])
  }
  unique(out)
}

# Estilo con que el PDF pinta cada tramo, leido del ARTEFACTO con
# `pdftohtml -xml` (poppler): marca <b>/<i> segun la fuente embebida de cada
# segmento de texto. Devuelve los estilos ("", "b", "i", "bi") de los segmentos
# que contienen `palabra` como palabra entera.
.t2_pdf_estilos_de <- function(path, palabra) {
  bin <- Sys.which("pdftohtml")
  testthat::skip_if_not(nzchar(bin), "pdftohtml (poppler) no disponible")
  out <- system2(bin, c("-xml", "-i", "-stdout", "-q", shQuote(path)), stdout = TRUE)
  x <- xml2::read_xml(paste(out, collapse = "\n"))
  segs <- xml2::xml_find_all(x, "//text")
  res <- character(0)
  for (sg in segs) {
    t <- xml2::xml_text(sg)
    toks <- strsplit(t, "[[:space:],.;:?!()]+")[[1]]
    if (!(palabra %in% toks || (grepl(" ", palabra, fixed = TRUE) && grepl(palabra, t, fixed = TRUE)))) next
    b <- length(xml2::xml_find_all(sg, ".//b")) > 0
    i <- length(xml2::xml_find_all(sg, ".//i")) > 0
    res <- c(res, paste0(if (b) "b" else "", if (i) "i" else ""))
  }
  res
}

# Familias embebidas segun pdffonts: list(nombres, emb).
.t2_pdffonts <- function(path) {
  bin <- Sys.which("pdffonts")
  testthat::skip_if_not(nzchar(bin), "pdffonts no disponible")
  l <- system2(bin, shQuote(path), stdout = TRUE)[-(1:2)]
  data.frame(nombre = sub("^[A-Z]{6}\\+", "", sub("\\s.*$", "", l)),
             emb = vapply(strsplit(trimws(substring(l, 37)), "\\s+"), function(v) v[length(v) - 4L], ""),
             stringsAsFactors = FALSE)
}

.t2_document_xml <- function(path) {
  d <- tempfile("t2_docx_")
  utils::unzip(path, files = "word/document.xml", exdir = d)
  xml2::read_xml(file.path(d, "word", "document.xml"))
}

.t2_w <- function(doc) c(w = xml2::xml_ns(doc)[["w"]])

# Instrumento de hsvg2026 desde el proyecto de referencia (ADR 0043).
.t2_hsvg2026 <- function() {
  pulso <- system.file("reference_projects", "hsvg2026", "hsvg2026.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "hsvg2026", "hsvg2026.pulso")
  testthat::skip_if_not(file.exists(pulso), "proyecto de referencia hsvg2026 ausente")
  dentro <- utils::unzip(pulso, list = TRUE)$Name
  xlsx <- grep("Instrumento2026\\.xlsx$", dentro, value = TRUE)[1]
  d <- tempfile("t2_hsvg_")
  utils::unzip(pulso, files = xlsx, exdir = d)
  p <- file.path(d, xlsx)
  rd <- function(sh) as.data.frame(readxl::read_excel(p, sheet = sh, col_types = "text"))
  list(survey = rd("survey"), choices = rd("choices"), settings = rd("settings"))
}

# Instrumento de acnur_pdm desde su proyecto de referencia.
.t2_acnur_pdm <- function() {
  pulso <- system.file("reference_projects", "acnur_pdm", "acnur_pdm.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  testthat::skip_if_not(file.exists(pulso), "proyecto de referencia acnur_pdm ausente")
  dentro <- utils::unzip(pulso, list = TRUE)$Name
  xlsx <- grep("post_distribution.*_xlsform\\.xlsx$", dentro, value = TRUE)[1]
  d <- tempfile("t2_pdm_")
  utils::unzip(pulso, files = xlsx, exdir = d)
  p <- file.path(d, xlsx)
  rd <- function(sh) as.data.frame(readxl::read_excel(p, sheet = sh, col_types = "text"))
  list(survey = rd("survey"), choices = rd("choices"),
       settings = data.frame(form_title = "acnur_pdm", stringsAsFactors = FALSE))
}

# Instrumento de acrconta (Acreditacion Contabilidad PUCP Estudiantes) desde su
# proyecto de referencia.
.t2_acrconta <- function() {
  pulso <- system.file("reference_projects", "acrconta", "acrconta.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acrconta", "acrconta.pulso")
  testthat::skip_if_not(file.exists(pulso), "proyecto de referencia acrconta ausente")
  dentro <- utils::unzip(pulso, list = TRUE)$Name
  xlsx <- grep("Acreditacion_Contabilidad_PUCP_Estudiantes.*\\.xlsx$", dentro, value = TRUE)[1]
  d <- tempfile("t2_acr_")
  utils::unzip(pulso, files = xlsx, exdir = d)
  p <- file.path(d, xlsx)
  rd <- function(sh) as.data.frame(readxl::read_excel(p, sheet = sh, col_types = "text"))
  list(survey = rd("survey"), choices = rd("choices"), settings = rd("settings"))
}

# Mide reserva (`.form_pdf_block_height`) y dibujo de cada bloque de un render.
.t2_medir_reserva <- function(fx, options) {
  medidas <- list()
  original <- .form_pdf_draw_block
  testthat::local_mocked_bindings(
    .form_pdf_draw_block = function(block, x, y, w) {
      y2 <- original(block, x, y, w)
      clave <- if (identical(block$kind, "question"))
        paste0("question/", block$type %||% "?") else block$kind
      clave <- paste0(clave, "#", length(medidas) + 1L)
      medidas[[clave]] <<- c(dibuja = (y - y2), reserva = .form_pdf_block_height(block, w))
      y2
    },
    .package = "prosecnurapp")
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, paper = fx$paper,
                         output_file = tmp, options = options)
  medidas
}

# =============================================================================
# Item 14 (L21): la reserva de pregunta y de `paper` sigue al dibujo
# =============================================================================

.t2_fixture_l21 <- function() {
  list(
    survey = data.frame(
      type = c("select_one sn", "begin_group", "integer", "select_one sexo", "text",
               "note", "decimal", "select_one larga", "end_group"),
      name = c("acepta", "g", "edad", "sexo", "otro", "aviso", "monto", "distrito", "ge"),
      label = c("Acepta participar?", "A. DATOS GENERALES",
                "Cuantos anos cumplidos tienes a la fecha de hoy, contando tu ultimo cumpleanos?",
                "Sexo", "Especifica otro sexo",
                "Las siguientes preguntas son sobre tu hogar y las personas que viven contigo.",
                "Cuanto gastaste el ultimo mes en transporte para venir a la universidad?",
                "Distrito de residencia", ""),
      hint = c("", "", "Anota la edad en anos cumplidos", "", "", "", "En soles", "", ""),
      relevant = c("", "", "", "", "${sexo} = '3'", "", "", "", ""),
      paper_skip = c("", "", "", "", "", "", "Pase a la pregunta 8", "", ""),
      stringsAsFactors = FALSE),
    choices = rbind(
      data.frame(list_name = "sn", name = c("1", "2"), label = c("Si", "No"),
                 stringsAsFactors = FALSE),
      data.frame(list_name = "sexo", name = c("1", "2", "3"),
                 label = c("Mujer", "Hombre", "Otro"), stringsAsFactors = FALSE),
      data.frame(list_name = "larga", name = as.character(1:25),
                 label = paste("Distrito", 1:25), stringsAsFactors = FALSE)),
    settings = list(form_title = "Contrato L21"),
    paper = data.frame(
      id = "c", kind = "consent", position = "1", title = "Consentimiento informado",
      body = paste(rep("Su participacion es voluntaria y confidencial; puede retirarse cuando quiera.", 4),
                   collapse = " "),
      layout = "", stringsAsFactors = FALSE))
}

test_that("item 14 (L21): pregunta y paper reservan lo que dibujan, en todo modo", {
  fx <- .t2_fixture_l21()
  for (opts in list(
    list(columns = 1, consent_var = "acepta"),
    list(columns = 2, consent_var = "acepta"),
    list(columns = 2, consent_var = "acepta", logic_language = "condiciones"))) {
    medidas <- .t2_medir_reserva(fx, opts)
    tipos <- unique(sub("#.*$", "", names(medidas)))
    # El fixture tiene que cubrir lo que el contrato dice cubrir: si un tipo no
    # llega a medirse, el test daria verde sin haberlo visto.
    for (k in c("paper", "question/integer", "question/text", "question/note",
                "question/decimal", "question/select_one")) {
      expect_true(k %in% tipos, label = paste(k, "medido con", paste(opts, collapse = "/")))
    }
    ratio <- vapply(medidas, function(v) v[["reserva"]] / v[["dibuja"]], numeric(1))
    cortos <- names(Filter(function(v) v[["reserva"]] < v[["dibuja"]] - 0.0006, medidas))
    expect_identical(cortos, character(0))
    # Techo del contrato L19 tras L21: max(medido) + 0.05, piso 1.05.
    pregunta_paper <- ratio[grepl("^(question|paper)", names(ratio))]
    expect_lt(max(pregunta_paper), 1.05)
  }
})

test_that("item 14: el «N de M» del pie cuenta las paginas que se dibujan (hsvg2026)", {
  # Hallazgo al medir L21: la pasada que CUENTA abria `pdf(NULL)` (7 x 7 in,
  # Helvetica) y la que DIBUJA, A4 en Helvetica-Narrow. Todo lo medido en npc
  # salia distinto y hsvg2026 a dos columnas imprimia «15 de 16» en la ultima
  # de 15 paginas.
  skip_if_not_installed("readxl")
  skip_if_not(nzchar(.t2_pdftotext()) && nzchar(Sys.which("pdfinfo")))
  fx <- .t2_hsvg2026()
  for (cols in c(1L, 2L)) {
    tmp <- tempfile(fileext = ".pdf")
    suppressWarnings(reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                                            options = list(columns = cols)))
    info <- system2(Sys.which("pdfinfo"), shQuote(tmp), stdout = TRUE)
    n <- as.integer(sub("^Pages:\\s+", "", grep("^Pages:", info, value = TRUE)))
    pie <- system2(.t2_pdftotext(), c("-f", n, "-l", n, shQuote(tmp), "-"), stdout = TRUE)
    expect_true(any(grepl(sprintf("^%d de %d$", n, n), trimws(pie))),
                label = paste("columns =", cols, "paginas =", n, "pie =",
                              paste(grep(" de [0-9]", pie, value = TRUE), collapse = " / ")))
  }
})

# =============================================================================
# Item 15 (L15 en el PDF): `**palabra**` sale en negrita, sin asteriscos
# =============================================================================

.t2_fixture_enfasis <- function() {
  list(
    survey = data.frame(
      type = rep("select_one ac", 3L),
      name = c("f1", "f2", "f3"),
      label = c("Mi **mama/cuidadora** se da cuenta de lo que necesito",
                "Mi mama/cuidadora me escucha cuando le hablo",
                "Mi **papa/cuidador** se da cuenta de lo que necesito y me lo dice con palabras claras"),
      stringsAsFactors = FALSE),
    choices = data.frame(list_name = "ac", name = as.character(1:4),
                         label = c("Nunca", "A veces", "Casi siempre", "Siempre"),
                         stringsAsFactors = FALSE),
    settings = list(form_title = "Enfasis"),
    options = list(columns = 1, matrix_groups = list(list(
      members = c("f1", "f2", "f3"), tenor = "Que tan de acuerdo estas", special = "auto"))))
}

test_that("item 15: el enfasis del autor se pinta en negrita en el PDF y no deja asteriscos", {
  skip_if_not(nzchar(.t2_pdftotext()))
  fx <- .t2_fixture_enfasis()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp, options = fx$options)
  txt <- paste(system2(.t2_pdftotext(), c(shQuote(tmp), "-"), stdout = TRUE), collapse = "\n")
  expect_false(grepl("*", txt, fixed = TRUE))
  expect_match(txt, "mama/cuidadora")

  # Desde el ARTEFACTO: «mama/cuidadora» de f1 sale en negrita y la de f2 en
  # redonda (pdftohtml lee la fuente embebida de cada segmento).
  expect_setequal(.t2_pdf_estilos_de(tmp, "mama/cuidadora"), c("b", ""))
  expect_identical(unique(.t2_pdf_estilos_de(tmp, "papa/cuidador")), "b")
  # Item 22: una sola familia, EMBEBIDA, sus estilos incluidos.
  f <- .t2_pdffonts(tmp)
  expect_true(all(grepl("^LiberationSansNarrow", f$nombre)), label = paste(f$nombre, collapse = ", "))
  expect_true(all(f$emb == "yes"))
  expect_true("LiberationSansNarrow-Bold" %in% f$nombre)
})

test_that("item 15: la fila con enfasis reserva lo que dibuja (un helper para los dos)", {
  fx <- .t2_fixture_enfasis()
  fx$paper <- NULL
  medidas <- .t2_medir_reserva(fx, fx$options)
  # Dos pasadas (contar y dibujar, L10): la matriz se mide dos veces.
  mat <- medidas[grepl("^matrix", names(medidas))]
  expect_length(mat, 2L)
  for (v in mat) expect_gte(v[["reserva"]], v[["dibuja"]] - 0.0006)
  # Una representacion: el `**` del autor llega al modelo como tramo en negrita
  # y la cadena plana ya no lleva marcadores.
  m <- formulario_pdf_build_model(fx$survey, fx$choices, fx$settings, options = fx$options)
  it <- m$blocks[[which(vapply(m$blocks, function(b) identical(b$kind, "matrix"), TRUE))]]$items[[1]]
  expect_false(grepl("*", it$label, fixed = TRUE))
  negritas <- vapply(Filter(function(r) !isTRUE(r$br), it$label_rt), function(r) if (r$b) r$t else "", "")
  expect_identical(paste(negritas[nzchar(negritas)], collapse = ""), "mama/cuidadora")
  # Sin formato, la fila corta exactamente donde corta el envoltorio de siempre.
  grDevices::pdf(NULL, paper = "a4", width = 8.27, height = 11.69, family = "Helvetica-Narrow")
  on.exit(grDevices::dev.off(), add = TRUE)
  plano <- "Mi mama/cuidadora se da cuenta de lo que necesito y me lo dice con palabras claras"
  g <- .form_pdf_matrix_fila_geom(list(label = plano, number = "1"), 0.8, 0.3)
  expect_null(g$lay)
  expect_identical(g$lineas, .form_pdf_wrap_fit(plano, 0.3 - .FORM_PDF_MATRIX_NUM_W, fontsize = 7.3))
})

# =============================================================================
# Item 16 (§17): el ancho util del Word sale de la geometria de la seccion
# =============================================================================

# Por seccion: twips utiles por columna y los anchos de las tablas que contiene.
.t2_tablas_por_seccion <- function(doc) {
  ns <- .t2_w(doc)
  body <- xml2::xml_find_first(doc, "//w:body", ns)
  secciones <- list(); tablas <- numeric(0)
  cerrar <- function(sp) {
    pg <- xml2::xml_find_first(sp, "w:pgSz", ns); mar <- xml2::xml_find_first(sp, "w:pgMar", ns)
    cols <- xml2::xml_find_first(sp, "w:cols", ns)
    num <- suppressWarnings(as.integer(xml2::xml_attr(cols, "num")))
    if (is.na(num)) num <- 1L
    caja <- as.numeric(xml2::xml_attr(pg, "w")) - as.numeric(xml2::xml_attr(mar, "left")) -
      as.numeric(xml2::xml_attr(mar, "right"))
    space <- suppressWarnings(as.numeric(xml2::xml_attr(cols, "space")))
    util <- if (num == 2L) (caja - space) / 2 else caja
    secciones[[length(secciones) + 1L]] <<- list(num = num, util = util, tablas = tablas,
                                                 left = as.numeric(xml2::xml_attr(mar, "left")))
    tablas <<- numeric(0)
  }
  for (n in xml2::xml_children(body)) {
    nm <- xml2::xml_name(n)
    if (identical(nm, "tbl")) {
      tablas <- c(tablas, sum(as.numeric(xml2::xml_attr(
        xml2::xml_find_all(n, "w:tblGrid/w:gridCol", ns), "w"))))
    } else if (identical(nm, "p")) {
      sp <- xml2::xml_find_first(n, "w:pPr/w:sectPr", ns)
      if (!inherits(sp, "xml_missing")) cerrar(sp)
    } else if (identical(nm, "sectPr")) {
      cerrar(n)
    }
  }
  secciones
}

# Ninguna tabla mas ancha que la columna de su seccion, y por cada numero de
# columnas la tabla mas ancha LLENA la columna (las listas de opciones van a
# todo el ancho util; la portada solo lleva las casillas del folio).
.t2_tablas_en_su_caja <- function(secc, llenan) {
  for (s in secc) {
    if (!length(s$tablas)) next
    expect_true(all(s$tablas <= s$util + 2), label = "ninguna tabla mas ancha que su columna")
  }
  for (n in llenan) {
    del_tipo <- Filter(function(s) s$num == n && length(s$tablas), secc)
    expect_true(length(del_tipo) > 0, label = paste("hay tablas en secciones de", n, "columna(s)"))
    if (!length(del_tipo)) next
    util <- del_tipo[[1]]$util
    expect_lt(abs(max(unlist(lapply(del_tipo, `[[`, "tablas"))) - util), 3,
              label = paste("la tabla mas ancha llena la columna con", n, "columna(s)"))
  }
}

test_that("item 16: cada tabla del Word mide lo que su seccion deja util", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  fx <- .t2_fixture_l21()
  fx$paper <- NULL
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = out,
                          options = list(columns = 2))
  secc <- .t2_tablas_por_seccion(.t2_document_xml(out))
  .t2_tablas_en_su_caja(secc, llenan = 2L)
})

test_that("item 16: con otra geometria de seccion las tablas siguen a sus margenes", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  # Si el ancho util saliera de una constante, cambiar los margenes de la
  # seccion dejaria las tablas dimensionadas para la caja vieja.
  geom <- .form_word_geometria()
  geom$mar_tw[["left"]] <- 1000; geom$mar_tw[["right"]] <- 1100
  testthat::local_mocked_bindings(.form_word_geometria = function() geom, .package = "prosecnurapp")
  fx <- .t2_fixture_l21()
  fx$paper <- NULL
  for (cols in c(1L, 2L)) {
    out <- tempfile(fileext = ".docx")
    reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = out,
                            options = list(columns = cols))
    secc <- .t2_tablas_por_seccion(.t2_document_xml(out))
    for (s in secc) expect_identical(s$left, 1000)
    .t2_tablas_en_su_caja(secc, llenan = cols)
  }
})

# =============================================================================
# Item 17: la nota que introduce un bloque ancho hereda su ancho y va pegada
# =============================================================================

test_that("item 17: en hsvg2026 la nota que introduce la matriz va a todo el ancho y pegada", {
  skip_if_not_installed("readxl")
  fx <- .t2_hsvg2026()
  m <- suppressWarnings(formulario_pdf_build_model(fx$survey, fx$choices, fx$settings,
                                                   options = list(columns = 2)))
  b <- m$blocks
  nombres <- vapply(b, function(x) x$name %||% "", character(1))
  for (nota in c("P60", "P62")) {
    i <- match(nota, nombres)
    expect_false(is.na(i))
    expect_identical(b[[i]]$type, "note")
    expect_identical(b[[i + 1L]]$kind, "matrix")
    expect_true(isTRUE(b[[i]]$full_width), label = paste(nota, "hereda full_width"))
    expect_true(isTRUE(b[[i]]$keep_with_next), label = paste(nota, "va pegada"))
  }

  # SOLO presentacion: numeracion, orden y n_questions identicos sin la regla.
  testthat::local_mocked_bindings(.form_pdf_nota_hereda_ancho = function(blocks) blocks,
                                  .package = "prosecnurapp")
  m0 <- suppressWarnings(formulario_pdf_build_model(fx$survey, fx$choices, fx$settings,
                                                    options = list(columns = 2)))
  firma <- function(bl) vapply(bl, function(x) paste(x$kind, x$name %||% "", x$number %||% "",
    paste(vapply(x$items %||% list(), function(it) it$number %||% "", ""), collapse = ","), sep = "|"), "")
  expect_identical(firma(m$blocks), firma(m0$blocks))
  expect_identical(m$summary$n_questions, m0$summary$n_questions)
  # 118 hasta la tercera tanda; desde el item 39 (§39.6) cada una de las 4
  # matrices consume UN numero en vez de uno por fila: 84. Desde 2026-10-21 los
  # 14 «Otra … (especifica)» que sólo repiten el rótulo de su opción van en línea
  # como «Especifique» y no consumen número: 70.
  expect_identical(m$summary$n_questions, 70L)
  expect_identical(.form_pdf_numeros_impresos(m$blocks), .form_pdf_numeros_impresos(m0$blocks))
  # Lo unico que cambia es el ancho de notas.
  cambia <- which(vapply(seq_along(b), function(k)
    !identical(isTRUE(b[[k]]$full_width), isTRUE(m0$blocks[[k]]$full_width)), logical(1)))
  expect_true(length(cambia) > 0)
  expect_true(all(vapply(b[cambia], .form_pdf_es_nota, logical(1))))
})

test_that("item 17: los renderers la pegan — keepNext en Word, misma pagina en el PDF", {
  skip_if_not_installed("readxl"); skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  fx <- .t2_hsvg2026()
  out <- tempfile(fileext = ".docx")
  suppressWarnings(reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = out,
                                           options = list(columns = 2)))
  doc <- .t2_document_xml(out); ns <- .t2_w(doc)
  hijos <- xml2::xml_children(xml2::xml_find_first(doc, "//w:body", ns))
  textos <- vapply(hijos, function(n) paste(xml2::xml_text(xml2::xml_find_all(n, ".//w:t", ns)), collapse = ""), "")
  for (patron in c("instancias disciplinarias", "servicios de protecci")) {
    k <- which(vapply(hijos, xml2::xml_name, "") == "p" & grepl(patron, textos))[1]
    expect_false(is.na(k), label = patron)
    expect_false(inherits(xml2::xml_find_first(hijos[[k]], "w:pPr/w:keepNext", ns), "xml_missing"),
                 label = paste("keepNext en la nota", patron))
    expect_identical(xml2::xml_name(hijos[[k + 1L]]), "tbl")
    # La seccion que la contiene es de UNA columna (el sectPr que cierra el tramo).
    siguiente_sect <- NULL
    for (j in seq.int(k, length(hijos))) {
      sp <- if (xml2::xml_name(hijos[[j]]) == "sectPr") hijos[[j]] else
        xml2::xml_find_first(hijos[[j]], "w:pPr/w:sectPr", ns)
      if (!inherits(sp, "xml_missing")) { siguiente_sect <- sp; break }
    }
    num <- xml2::xml_attr(xml2::xml_find_first(siguiente_sect, "w:cols", ns), "num")
    expect_true(is.na(num) || identical(num, "1"), label = paste("tramo de una columna para", patron))
  }

  skip_if_not(nzchar(.t2_pdftotext()))
  tmp <- tempfile(fileext = ".pdf")
  suppressWarnings(reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                                          options = list(columns = 2)))
  pal <- .t2_palabras_pdf(tmp)
  pag_nota <- unique(pal$pagina[pal$texto == "disciplinarias?"])
  pag_item <- unique(pal$pagina[pal$texto == "Instrucción"])
  expect_length(pag_nota, 1L)
  expect_true(pag_nota %in% pag_item)
  # A todo el ancho: la nota envuelve mas alla del medianil (x > mitad de pagina)
  # o cabe en una linea que arranca en el margen izquierdo.
  fila <- pal[pal$pagina == pag_nota & pal$texto == "¿Has", ]
  expect_true(any(fila$xmin < 80))
})

# =============================================================================
# Item 18: la columna del codigo se dimensiona al codigo mas ancho
# =============================================================================

.t2_fixture_codigos <- function() {
  list(
    survey = data.frame(
      type = c("select_one app", "select_one tiempo", "select_one transporte", "select_one yn"),
      name = c("app", "tiempo", "transporte", "acepta"),
      label = c("Por que aplicacion se entero del servicio que brinda la organizacion?",
                "Cuanto tiempo le tomo llegar al espacio de proteccion desde su casa?",
                "Que medio de transporte utilizo para llegar?",
                "Acepta?"),
      stringsAsFactors = FALSE),
    choices = rbind(
      # `MWMWMWMW` es SINTETICO: ocho letras anchas, el peor caso de un codigo
      # visible (hasta 8 caracteres). Con la columna por CONTEO (0.070 npc) se
      # salia de su celda; `WHATSAPP` es el caso real y cabe justo.
      data.frame(list_name = "app", name = c("WHATSAPP", "MWMWMWMW", "integracion", "otra"),
                 label = c("Mensajeria del telefono movil de un familiar o de un amigo cercano",
                           "Llamada telefonica de la organizacion a su numero de contacto",
                           "Encuentro de integracion comunitaria organizado por el espacio",
                           "Otra aplicacion o red social que usa con frecuencia en su telefono"),
                 stringsAsFactors = FALSE),
      data.frame(list_name = "tiempo", name = c("less15", "15_30", "more_2h"),
                 label = c("Hasta 15 minutos de viaje desde su casa hasta el espacio de proteccion",
                           "Entre 15 y 30 minutos de viaje desde su casa hasta el espacio",
                           "Mas de 2 horas de viaje desde su casa hasta el espacio de proteccion"),
                 stringsAsFactors = FALSE),
      data.frame(list_name = "transporte", name = c("walking", "metropolitan_transport", "bus"),
                 label = c("A pie, caminando desde su casa hasta el espacio de proteccion",
                           "Metropolitano o tren electrico de la ciudad de Lima",
                           "Combi o bus de transporte publico urbano de la ciudad de Lima"),
                 stringsAsFactors = FALSE),
      data.frame(list_name = "yn", name = c("Yes", "No"), label = c("Si", "No"),
                 stringsAsFactors = FALSE)),
    settings = list(form_title = "Codigos de texto"))
}

test_that("item 18 (PDF): ningun codigo se sale de su columna", {
  skip_if_not(nzchar(.t2_pdftotext()))
  fx <- .t2_fixture_codigos()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                         options = list(columns = 1))
  pal <- .t2_palabras_pdf(tmp)
  # Puntos por npc del dispositivo con que dibuja el motor (A4, `width = 8.27`:
  # R deja 0.25 in por lado, asi que la region util no es la pagina entera).
  grDevices::pdf(NULL, paper = "a4", width = 8.27, height = 11.69, family = "Helvetica-Narrow")
  grid::grid.newpage()
  W <- grid::convertWidth(grid::unit(1, "npc"), "points", valueOnly = TRUE)
  grDevices::dev.off()
  # La tabla de la pregunta arranca 0.005 npc a la izquierda del enunciado y la
  # etiqueta de la opcion 0.004 a la derecha de la columna del codigo: con eso
  # se reconstruye la celda del codigo DESDE EL ARTEFACTO.
  celda_ok <- function(codigo, primera_palabra_enunciado, primera_palabra_etiqueta) {
    cd <- pal[pal$texto == codigo, ][1, ]
    en <- pal[pal$texto == primera_palabra_enunciado, ][1, ]
    lb <- pal[pal$texto == primera_palabra_etiqueta & abs(pal$ymin - cd$ymin) < 6, ][1, ]
    izq <- en$xmin - 0.005 * W
    der <- lb$xmin - 0.004 * W
    c(dentro = cd$xmin >= izq - 0.3 && cd$xmax <= der + 0.3, izq = izq, der = der,
      xmin = cd$xmin, xmax = cd$xmax)
  }
  r <- celda_ok("WHATSAPP", "1.", "Mensajeria")
  expect_true(as.logical(r[["dentro"]]), label = paste(names(r), round(r, 1), collapse = " "))
  r <- celda_ok("MWMWMWMW", "1.", "Llamada")
  expect_true(as.logical(r[["dentro"]]), label = paste(names(r), round(r, 1), collapse = " "))
  r <- celda_ok("more_2h", "2.", "Mas")
  expect_true(as.logical(r[["dentro"]]), label = paste(names(r), round(r, 1), collapse = " "))
})

test_that("item 18 (Word): la columna del codigo crece hasta el codigo, luego baja el cuerpo", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  fx <- .t2_fixture_codigos()
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = out,
                          options = list(columns = 1))
  doc <- .t2_document_xml(out); ns <- .t2_w(doc)
  tablas <- xml2::xml_find_all(doc, "//w:body/w:tbl", ns)
  primera_col <- function(t) as.numeric(xml2::xml_attr(xml2::xml_find_first(t, "w:tblGrid/w:gridCol", ns), "w"))
  texto <- function(t) paste(xml2::xml_text(xml2::xml_find_all(t, ".//w:t", ns)), collapse = " ")
  t_tiempo <- tablas[[which(grepl("less15", vapply(tablas, texto, "")))]]
  t_transp <- tablas[[which(grepl("metropolitan_transport", vapply(tablas, texto, "")))]]
  t_yn <- tablas[[which(grepl("Acepta", vapply(tablas, texto, "")))]]
  # 0.4 in = 576 twips era el ancho fijo; less15 no cabia ahi y Word lo partia.
  expect_gt(primera_col(t_tiempo), 576)
  expect_lte(primera_col(t_tiempo), 1152)
  # Un codigo que ni con el doble cabe: tope (0.8 in) y cuerpo bajado, nunca < 7 pt.
  expect_equal(primera_col(t_transp), 1152, tolerance = 1)
  # Filas del cuerpo (la primera es el enunciado, fusionado y a 10 pt).
  celda_cod <- xml2::xml_find_all(t_transp, "w:tr[position() > 1]/w:tc[1]//w:rPr/w:sz", ns)
  sz <- as.numeric(xml2::xml_attr(celda_cod, "val"))
  expect_true(length(sz) > 0)
  expect_true(all(sz < 20 & sz >= 14))
  # Fila horizontal (Si | Yes | No | No): la columna del codigo «Yes» ya no es la
  # de 0.28 in (403 twips) que lo partia en «Ye/s».
  grid <- as.numeric(xml2::xml_attr(xml2::xml_find_all(t_yn, "w:tblGrid/w:gridCol", ns), "w"))
  expect_gt(grid[2], 404)
  # Los codigos se imprimen tal cual.
  expect_match(texto(t_transp), "metropolitan_transport", fixed = TRUE)
})

# =============================================================================
# Item 19 (revisado 2026-10-15): el HTML del instrumento se INTERPRETA
# =============================================================================

# Estilos visibles de unos tramos, para comparar sin depender de como se fundan.
.t2_estilos <- function(runs) {
  vapply(runs, function(r) if (isTRUE(r$br)) "<BR>" else
    sprintf("%s[%s%s%s%s]", r$t, if (r$b) "b" else "", if (r$i) "i" else "",
            if (r$u) "u" else "", if (r$s != 0) paste0("+", r$s) else ""), character(1))
}

test_that("item 19 parser: soportado, anidado y mal cerrado", {
  p <- function(x, ...) .t2_estilos(.form_rt_parse(x, ...)$runs)
  expect_identical(p("a <b>negrita</b> e <i>cursiva</i> y <u>sub</u>"),
                   c("a []", "negrita[b]", " e []", "cursiva[i]", " y []", "sub[u]"))
  expect_identical(p("<strong>uno <em>dos</em></strong>"), c("uno [b]", "dos[bi]"))
  # Anidado cruzado y sin cerrar: no rompe, el estilo dura hasta el final.
  expect_identical(p("<b>x <i>y</b> z</i> w"), c("x [b]", "y[bi]", " z[i]", " w[]"))
  expect_identical(p("<b>abierta"), "abierta[b]")
  expect_identical(p("cierre</b> huerfano"), "cierre huerfano[]")
  expect_identical(p("uno<br>dos<br/>tres"), c("uno[]", "<BR>", "dos[]", "<BR>", "tres[]"))
  expect_identical(p("<p>uno</p><div>dos</div>"), c("uno[]", "<BR>", "dos[]"))
  expect_identical(p("<ul><li>uno</li><li>dos</li></ul>"),
                   c("\u2022 uno[]", "<BR>", "\u2022 dos[]"))
  # Entidades: decodificadas; un &lt;b&gt; escapado es TEXTO, no una etiqueta.
  expect_identical(p("Salud &amp; bienestar &lt;b&gt; &#233;"), "Salud & bienestar <b> \u00e9[]")
  # Lo que no es etiqueta se queda.
  for (x in c("edad <5 a\u00f1os", "a<b y c>d", "Juan & Maria", "#1 en ventas", "Nota ## final")) {
    expect_identical(.form_rt_plano(.form_rt_parse(x)$runs), x)
  }
})

test_that("item 19 parser: span con style, encabezados h1-h6 y markdown", {
  pr <- .form_rt_parse('<span style="font-weight:bold; color:#002060">Ne</span><span style="font-style:italic">Cu</span><span style="text-decoration: underline">Su</span><span style="font-weight:700">Se</span>')
  expect_identical(.t2_estilos(pr$runs), c("Ne[b]", "Cu[i]", "Su[u]", "Se[b]"))
  expect_true(pr$ignorado)                       # el color no se imprime
  expect_false(.form_rt_parse("<b>x</b>")$ignorado)
  expect_true(.form_rt_parse('<font color="red">x</font>')$ignorado)
  expect_true(.form_rt_parse('<a href="https://x.org">enlace</a>')$ignorado)
  expect_identical(.form_rt_plano(.form_rt_parse('<a href="https://x.org">enlace</a>')$runs), "enlace")
  s <- function(n) .t2_estilos(.form_rt_parse(sprintf("antes<h%d>T</h%d>despues", n, n))$runs)
  expect_identical(s(1), c("antes[]", "<BR>", "T[b+2]", "<BR>", "despues[]"))
  expect_identical(s(2)[3], "T[b+2]"); expect_identical(s(3)[3], "T[b+1]")
  expect_identical(s(4)[3], "T[b+1]"); expect_identical(s(5)[3], "T[b]"); expect_identical(s(6)[3], "T[b]")
  # Markdown al inicio de CADA linea: `#{1,6}` + espacio, o `#{2,6}` pegado a letra.
  expect_identical(.t2_estilos(.form_rt_parse("## Seccion A")$runs), "Seccion A[b+2]")
  expect_identical(.t2_estilos(.form_rt_parse("######En el marco")$runs), "En el marco[b]")
  expect_identical(.t2_estilos(.form_rt_parse("Pregunta?\n\n###### Ya sea")$runs),
                   c("Pregunta?[]", "<BR>", "Ya sea[b]"))
  expect_identical(.t2_estilos(.form_rt_parse("#1 en ventas")$runs), "#1 en ventas[]")
  # En categorias `**` y `#` son texto del autor.
  expect_identical(.form_rt_plano(.form_rt_parse("5** a 10**", enfasis = FALSE, markdown = FALSE)$runs), "5** a 10**")
})

test_that("item 19 dominio: el texto visible de una categoria es el de quitar las etiquetas", {
  quitar <- function(x) {
    x <- gsub("<[^>]+>", "", x)
    x <- gsub("&amp;", "&", x, fixed = TRUE)
    trimws(gsub("\\s+", " ", x))
  }
  cats <- c('<span style="color:#002060">Totalmente</span> de acuerdo',
            "<b>Si</b>, siempre", "Salud &amp; bienestar", "<i>No</i> <u>sabe</u>",
            "De 5* a 10*", "Nota al pie (*)")
  choices <- data.frame(list_name = "c", name = as.character(seq_along(cats)), label = cats,
                        stringsAsFactors = FALSE)
  survey <- data.frame(type = "select_one c", name = "q", label = "Pregunta", stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(survey, choices, list(form_title = "T"))
  opts <- Filter(function(b) identical(b$name, "q"), m$blocks)[[1]]$options
  expect_identical(vapply(opts, function(o) o$label, ""), vapply(cats, quitar, "", USE.NAMES = FALSE))
  expect_identical(vapply(opts, function(o) o$code, ""), choices$name)
  for (o in opts) expect_identical(.form_rt_plano(.form_rt_campo(o, "label")), o$label)
})

.t2_fixture_rico <- function() {
  list(
    survey = data.frame(
      type = c("begin_group", "note", "select_one sn", "text", "end_group"),
      name = c("g", "aviso", "acepta", "detalle", "ge"),
      label = c('<span style="color:#002060">DATOS <i>GENERALES</i></span>',
                "<h2>Antes de empezar</h2>Lea <i>todo</i> el texto y <u>marque</u> una sola respuesta.",
                "Acepta <i>participar</i> en el estudio?",
                "Describa su <u>situacion</u> actual", ""),
      hint = c("", "", "<b>Lea</b> despacio", "", ""),
      stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sn", name = c("1", "2"),
                         label = c("<i>Si</i>, acepto", "No &amp; no"), stringsAsFactors = FALSE),
    settings = list(form_title = "Encuesta &amp; <i>piloto</i>"))
}

test_that("item 19 modelo: un aviso que separa lo aplicado de lo ignorado", {
  fx <- .t2_fixture_rico()
  m <- formulario_pdf_build_model(fx$survey, fx$choices, fx$settings)
  aviso <- grep("formato HTML", m$warnings, value = TRUE)
  expect_length(aviso, 1L)
  # Celdas con formato: label de g, aviso, acepta y detalle, hint de acepta, dos
  # categorias y form_title = 8; con algo ignorado (el color de g) = 1.
  expect_identical(aviso, paste0("Se aplic\u00f3 el formato HTML de 8 textos del instrumento; ",
                                 "se ignor\u00f3 lo que no se puede imprimir (color, enlaces\u2026) en 1 (p. ej. g)."))
  m2 <- formulario_pdf_build_model(fx$survey[-1, ][-4, ], fx$choices, list(form_title = "T"))
  expect_identical(grep("formato HTML", m2$warnings, value = TRUE),
                   "Se aplic\u00f3 el formato HTML de 6 textos del instrumento (p. ej. aviso).")
  expect_identical(m$title, "Encuesta & piloto")
  b <- function(nm) Filter(function(x) identical(x$name, nm), m$blocks)[[1]]
  expect_identical(.form_rt_plano(b("aviso")$label_rt), b("aviso")$label)
  expect_true(any(vapply(b("aviso")$label_rt, function(r) isTRUE(r$s == 2), TRUE)))
})

test_that("item 19 modelo: hsvg2026 aplica su HTML y sus `######` y declara 15 y 13", {
  skip_if_not_installed("readxl")
  fx <- .t2_hsvg2026()
  m <- suppressWarnings(formulario_pdf_build_model(fx$survey, fx$choices, fx$settings,
                                                   options = list(columns = 2)))
  aviso <- grep("formato HTML", m$warnings, value = TRUE)
  expect_length(aviso, 1L)
  expect_match(aviso, "de 15 textos", fixed = TRUE)
  expect_match(aviso, "en 13 (p. ej. inicio)", fixed = TRUE)
  todo <- unlist(lapply(m$blocks, function(x) c(x$title, x$label, x$hint, x$tenor,
    vapply(x$options %||% list(), function(o) o$label %||% "", ""),
    vapply(x$items %||% list(), function(it) it$label %||% "", ""))))
  expect_false(any(grepl("<span|<SPAN|</span>|#{2,}", todo)))
  b <- function(nm) Filter(function(x) identical(x$name, nm), m$blocks)[[1]]
  # `######En el marco...` -> encabezado; `\n\n###### Ya sea` -> salto + encabezado.
  expect_true(b("note_vbg")$label_rt[[1]]$b)
  rt <- b("note_vbg_2026")$label_rt
  expect_true(any(vapply(rt, function(r) isTRUE(r$br), TRUE)))
  expect_true(grepl("^Ya sea", rt[[which(vapply(rt, function(r) isTRUE(r$br), TRUE))[1] + 1L]]$t))
})

test_that("item 19 artefacto Word: runs con w:b/w:i/w:u y w:br, sin etiquetas literales", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  fx <- .t2_fixture_rico()
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(fx$survey, fx$choices, fx$settings, output_file = out, options = list(columns = 1))
  doc <- .t2_document_xml(out); ns <- .t2_w(doc)
  wt <- xml2::xml_text(xml2::xml_find_all(doc, "//w:t", ns))
  expect_false(any(grepl("<|&amp;|span", wt)))
  run_de <- function(txt) {
    r <- xml2::xml_find_all(doc, sprintf("//w:r[w:t[normalize-space(.)='%s']]", txt), ns)
    expect_true(length(r) > 0, label = paste("run de", txt))
    r[[1]]
  }
  tiene <- function(r, tag) !inherits(xml2::xml_find_first(r, paste0("w:rPr/", tag), ns), "xml_missing")
  expect_true(tiene(run_de("todo"), "w:i"))
  expect_true(tiene(run_de("marque"), "w:u"))
  expect_true(tiene(run_de("participar"), "w:i"))
  expect_true(tiene(run_de("Si"), "w:i"))
  expect_true(tiene(run_de("Lea"), "w:b"))
  # El encabezado <h2> de la nota: negrita y 2 pt mas (w:sz en medios puntos).
  h <- run_de("Antes de empezar")
  expect_true(tiene(h, "w:b"))
  expect_identical(xml2::xml_attr(xml2::xml_find_first(h, "w:rPr/w:sz", ns), "val"), "24")
  expect_true(length(xml2::xml_find_all(doc, "//w:p[.//w:t[contains(., 'Antes de empezar')]]//w:br", ns)) > 0)
  fuentes <- unique(xml2::xml_attr(xml2::xml_find_all(doc, "//w:body//w:rFonts", ns), "ascii"))
  expect_identical(setdiff(fuentes, NA_character_), "Arial Narrow")
})

test_that("item 19 artefacto PDF: cursiva y subrayado con su fuente, sin etiquetas literales", {
  skip_if_not(nzchar(.t2_pdftotext()))
  fx <- .t2_fixture_rico()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp, options = list(columns = 1))
  txt <- paste(system2(.t2_pdftotext(), c(shQuote(tmp), "-"), stdout = TRUE), collapse = " ")
  expect_false(grepl("<|>|&amp;|span", txt))
  expect_match(txt, "Antes de empezar", fixed = TRUE)
  e <- function(p) unique(.t2_pdf_estilos_de(tmp, p))
  # Nota (en negrita) con <i>: negrita cursiva. Enunciado (negrita) con <i>: igual.
  expect_identical(e("todo"), "bi")
  expect_identical(e("participar"), "bi")
  # Categoria (redonda) con <i>: cursiva. Pista (cursiva) con <b>: negrita cursiva.
  expect_identical(e("Si"), "i")
  expect_true("bi" %in% e("Lea"))
  # <h2> en la nota: negrita y mas alto que el cuerpo de la nota.
  expect_identical(e("Antes de empezar"), "b")
  f <- .t2_pdffonts(tmp)
  expect_setequal(f$nombre, c("LiberationSansNarrow", "LiberationSansNarrow-Bold",
                              "LiberationSansNarrow-Italic", "LiberationSansNarrow-BoldItalic"))
  expect_true(all(f$emb == "yes"))
  # Subrayado, en el RASTER: una fila de pixeles oscuros bajo «marque» que
  # cubre el ancho de la palabra.
  skip_if_not(nzchar(Sys.which("pdftoppm")) && requireNamespace("png", quietly = TRUE))
  pal <- .t2_palabras_pdf(tmp)
  w <- pal[pal$texto == "marque", ][1, ]
  pre <- tempfile()
  system2(Sys.which("pdftoppm"), c("-r", 288, "-png", "-f", 1, "-l", 1, shQuote(tmp), shQuote(pre)))
  img <- png::readPNG(list.files(dirname(pre), pattern = paste0("^", basename(pre)), full.names = TRUE)[1])
  k <- 288 / 72
  x0 <- floor(w$xmin * k) + 2; x1 <- ceiling(w$xmax * k) - 2
  ymax <- as.numeric(system2(.t2_pdftotext(), c("-f", 1, "-l", 1, "-bbox", shQuote(tmp), "-"), stdout = TRUE) |>
    grep(pattern = ">marque<", value = TRUE) |> sub(pattern = '^.*yMax="([0-9.]+)".*$', replacement = "\\1"))[1]
  filas <- seq(floor((ymax - 1) * k), ceiling((ymax + 4) * k))
  oscuro <- vapply(filas, function(r) mean(img[r, x0:x1, 1] < 0.5), numeric(1))
  expect_gt(max(oscuro), 0.9)
})

# =============================================================================
# Tercera tanda (2026-10-15)
# =============================================================================

test_that("A: el PDF imprime los codigos de mas de 8 caracteres, enteros (acnur_pdm)", {
  skip_if_not_installed("readxl")
  skip_if_not(nzchar(.t2_pdftotext()))
  fx <- .t2_acnur_pdm()
  tmp <- tempfile(fileext = ".pdf")
  suppressWarnings(reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                                          options = list(columns = 2)))
  pal <- .t2_palabras_pdf(tmp)
  for (cd in c("integracion", "legal_prot_int", "gestion_casos", "redes_sociales")) {
    expect_true(cd %in% pal$texto, label = paste("codigo entero en el PDF:", cd))
  }
})

test_that("B: el ancho en npc divide entre la region real de dibujo, no entre la hoja", {
  grDevices::pdf(NULL, paper = "a4", width = 8.27, height = 11.69, family = "Helvetica-Narrow")
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  region <- grid::convertWidth(grid::unit(1, "npc"), "points", valueOnly = TRUE)
  expect_equal(.FORM_PDF_REGION_PT, region, tolerance = 1e-4)
  lbl <- "No s\u00e9 / Prefiero no decir"
  medido <- grid::convertWidth(grid::grobWidth(grid::textGrob(lbl, gp = grid::gpar(fontsize = 7.9))),
                               "npc", valueOnly = TRUE)
  expect_equal(.form_pdf_ancho_npc(lbl, 7.9), medido, tolerance = 1e-6)
})

test_that("B: en la fila horizontal la etiqueta no invade la celda del codigo", {
  skip_if_not(nzchar(.t2_pdftotext()))
  survey <- data.frame(type = "select_one sn", name = "conoce",
                       label = "Sabes que la PUCP cuenta con un reglamento?", stringsAsFactors = FALSE)
  choices <- data.frame(list_name = "sn", name = c("1", "2", "99"),
                        label = c("S\u00ed", "No", "No s\u00e9 / Prefiero no decir"),
                        stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, list(form_title = "Fila"), output_file = tmp,
                         options = list(columns = 2))
  pal <- .t2_palabras_pdf(tmp)
  decir <- pal[pal$texto == "decir", ][1, ]
  c99 <- pal[pal$texto == "99" & abs(pal$ymin - decir$ymin) < 3, ][1, ]
  expect_false(is.na(c99$xmin), label = "la fila es horizontal")
  grDevices::pdf(NULL, paper = "a4", width = 8.27, height = 11.69, family = "Helvetica-Narrow")
  grid::grid.newpage()
  W <- grid::convertWidth(grid::unit(1, "npc"), "points", valueOnly = TRUE)
  code_w <- .form_pdf_options_code_mark(lapply(seq_len(nrow(choices)), function(i)
    list(code = choices$name[i], label = choices$label[i])), FALSE)$code_w
  grDevices::dev.off()
  # El 99 va centrado en su celda: el divisor esta media celda a su izquierda.
  divisor <- (c99$xmin + c99$xmax) / 2 - code_w * W / 2
  expect_lte(decir$xmax, divisor + 0.3)
})

test_that("paridad: el PDF imprime los mismos codigos que el Word (igual a la etiqueta, con espacios)", {
  skip_if_not(nzchar(.t2_pdftotext()))
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  survey <- data.frame(type = c("select_one yn", "select_one esp"), name = c("acepta", "esp"),
                       label = c("Acepta participar en el estudio?", "Situacion migratoria actual"),
                       stringsAsFactors = FALSE)
  choices <- rbind(
    data.frame(list_name = "yn", name = c("Yes", "No"), label = c("Yes", "No"), stringsAsFactors = FALSE),
    data.frame(list_name = "esp", name = c("REF A", "MIG"),
               label = c("Refugiado reconocido por la comision", "Migrante con permiso temporal"),
               stringsAsFactors = FALSE))
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, list(form_title = "Paridad"), output_file = tmp,
                         options = list(columns = 1))
  pal <- .t2_palabras_pdf(tmp)
  # «Yes»/«No» salen dos veces: etiqueta y codigo. «REF A» con su espacio y «MIG».
  expect_gte(sum(pal$texto == "Yes"), 2L)
  expect_gte(sum(pal$texto == "No"), 2L)
  expect_true(all(c("REF", "MIG") %in% pal$texto))
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(survey, choices, list(form_title = "Paridad"), output_file = out,
                          options = list(columns = 1))
  doc <- .t2_document_xml(out)
  wt <- xml2::xml_text(xml2::xml_find_all(doc, "//w:t", .t2_w(doc)))
  expect_gte(sum(wt == "Yes"), 2L)
  expect_true(all(c("REF A", "MIG") %in% wt))
})

test_that("divisor: ningun tramo del divisor de columnas toca un bloque de ancho completo", {
  skip_if_not_installed("readxl")
  skip_if_not(nzchar(.t2_pdftotext()))
  # Con las coordenadas que el render ya conoce (`.form_pdf_traza`): por pagina,
  # cada tramo del divisor queda FUERA de la caja de todo bloque full_width, con
  # al menos 0.003 npc de aire (antes terminaba justo en su borde y tocaba la
  # primera linea de la nota: «en|», acnur_pdm p. 2).
  # Y LAS LETRAS (`pdftotext -bbox`): la caja de la fuente sube ~3.2 pt sobre la
  # «M», asi que medir solo cajas de bloque daba verde mientras el final del
  # divisor tocaba «académico» (acrconta p. 3). Ninguna palabra que cruce la x
  # del divisor puede quedar a menos de 1 pt de sus extremos.
  bp <- function(y) 18 + (1 - y) * 805.8898
  x_div <- 18 + 0.5 * 559.2756
  for (fx in list(.t2_acnur_pdm(), .t2_hsvg2026(), .t2_acrconta())) {
    traza <- list()
    testthat::local_mocked_bindings(
      .form_pdf_traza = function(tipo, pagina, y_arriba, y_abajo) {
        traza[[length(traza) + 1L]] <<- data.frame(tipo = tipo, pag = pagina, arriba = y_arriba, abajo = y_abajo)
      }, .package = "prosecnurapp")
    tmp <- tempfile(fileext = ".pdf")
    suppressWarnings(reporte_formulario_pdf(fx$survey, fx$choices, fx$settings,
                                            output_file = tmp, options = list(columns = 2)))
    d <- do.call(rbind, traza)
    d <- d[seq.int(nrow(d) / 2 + 1, nrow(d)), ]                    # pasada que dibuja
    div <- d[d$tipo == "divisor", ]; anc <- d[d$tipo == "ancho", ]
    expect_gt(nrow(div), 0L); expect_gt(nrow(anc), 0L)
    cruces <- 0L
    for (k in seq_len(nrow(div))) {
      a <- anc[anc$pag == div$pag[k], ]
      choca <- div$abajo[k] < a$arriba + 0.003 & div$arriba[k] > a$abajo - 0.003
      cruces <- cruces + sum(choca)
    }
    expect_identical(cruces, 0L)
    pal <- .t2_palabras_pdf(tmp)
    cruzan <- pal[pal$xmin <= x_div & pal$xmax >= x_div, ]
    tocan <- 0L
    for (k in seq_len(nrow(div))) {
      w <- cruzan[cruzan$pagina == div$pag[k], ]
      fin <- bp(div$abajo[k]); ini <- bp(div$arriba[k])
      # Debajo del final: la primera linea del bloque que sigue.
      bajo <- w[w$ymin >= fin - 3 & w$ymin <= fin + 15, ]
      # Encima del arranque: la ultima linea del bloque anterior.
      sobre <- w[w$ymax <= ini + 3 & w$ymax >= ini - 15, ]
      tocan <- tocan + sum(bajo$ymin - fin < 1) + sum(ini - sobre$ymax < 1)
    }
    expect_identical(tocan, 0L)
  }
})

# =============================================================================
# Medir con la metrica del dibujo (2026-10-15, acrconta por la UI)
# =============================================================================

.t2_fixture_escala4 <- function() {
  list(
    survey = data.frame(
      type = c("note", rep("select_one sat", 4L)),
      name = c("nota_p13", "p13_1", "p13_2", "p13_3", "p13_4"),
      label = c("¿Qué tan satisfecho se encuentra con los servicios/actividades ? Por favor, indique su nivel de satisfacción en la siguiente escala.",
                "Servicio de salud", "Bienestar psicológico", "Servicio de empleabilidad", "Actividades culturales"),
      stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sat", name = as.character(1:4),
                         label = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho"),
                         stringsAsFactors = FALSE),
    settings = list(form_title = "Escala de 4"),
    options = list(columns = 2, matrix_groups = list(list(
      members = c("p13_1", "p13_2", "p13_3", "p13_4"), tenor = "", special = "auto", header = "categorias"))))
}

test_that("metrica: el ancho medido es el ancho dibujado, en el dispositivo real", {
  skip_if_not(nzchar(.t2_pdftotext()))
  tmp <- tempfile(fileext = ".pdf")
  .form_fuente_dispositivo(tmp)
  grid::grid.newpage(); .form_fuente_region()
  casos <- list(list(t = "Insatisfecho", fs = 6.2, f = "bold"),
                list(t = "Qué tan satisfecho se encuentra con los servicios", fs = 8.4, f = "bold"),
                list(t = "Hasta 15 minutos de viaje desde su casa", fs = 7.9, f = "plain"))
  medidos <- numeric(0)
  for (k in seq_along(casos)) {
    cs <- casos[[k]]
    medidos[k] <- .form_pdf_medir_npc(cs$t, cs$fs, cs$f) * 559.2756
    if (identical(cs$f, "plain")) expect_equal(.form_pdf_ancho_npc(cs$t, cs$fs) * 559.2756, medidos[k], tolerance = 1e-6)
    grid::grid.text(cs$t, x = 0.1, y = 0.8 - k * 0.1, just = c("left", "bottom"),
                    gp = grid::gpar(fontsize = cs$fs, fontface = cs$f))
  }
  grDevices::dev.off()
  pal <- .t2_palabras_pdf(tmp)
  for (k in seq_along(casos)) {
    ws <- strsplit(casos[[k]]$t, " ")[[1]]
    a <- pal[pal$texto == ws[1], ][1, ]; b <- pal[pal$texto == ws[length(ws)] & abs(pal$ymin - a$ymin) < 1, ][1, ]
    expect_lt(abs((b$xmax - a$xmin) - medidos[k]), 0.5)
  }
})

test_that("metrica: una escala de 4 puntos con rotulos de <= 2 palabras va en horizontal a 2 columnas", {
  skip_if_not(nzchar(.t2_pdftotext()))
  fx <- .t2_fixture_escala4()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp, options = fx$options)
  pal <- .t2_palabras_pdf(tmp)
  pal$alto <- as.numeric(NA)
  x <- system2(.t2_pdftotext(), c("-bbox", shQuote(tmp), "-"), stdout = TRUE)
  w <- grep(">Insatisfecho<", x, value = TRUE)[1]
  num <- function(a) as.numeric(sub(paste0('^.*', a, '="([0-9.]+)".*$'), "\\1", w))
  # Horizontal: la caja de la palabra es mas ancha que alta (rotada seria al reves).
  expect_gt(num("xMax") - num("xMin"), num("yMax") - num("yMin"))
})

test_that("metrica: la nota que introduce una matriz no deja hueco: el aire declarado y nada mas", {
  fx <- .t2_fixture_escala4()
  traza <- list()
  testthat::local_mocked_bindings(
    .form_pdf_traza = function(tipo, pagina, y_arriba, y_abajo) {
      traza[[length(traza) + 1L]] <<- data.frame(tipo = tipo, y = y_arriba)
    }, .package = "prosecnurapp")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tempfile(fileext = ".pdf"),
                         options = fx$options)
  d <- do.call(rbind, traza)
  d <- d[d$tipo %in% c("nota_texto", "tabla_tope"), ]
  k <- which(d$tipo == "nota_texto")
  expect_gt(length(k), 0L)
  for (i in k) {
    expect_identical(d$tipo[i + 1L], "tabla_tope")
    expect_lte(d$y[i] - d$y[i + 1L], .FORM_PDF_AIRE_INTRO + 1e-9)
  }
})

test_that("metrica: una nota justificada llena la linea (sin rios)", {
  skip_if_not(nzchar(.t2_pdftotext()))
  fx <- .t2_fixture_escala4()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp, options = fx$options)
  pal <- .t2_palabras_pdf(tmp)
  linea <- pal[pal$ymin == pal$ymin[pal$texto == "¿Qué"][1], ]
  # Hueco entre palabras de la primera linea justificada: como un espacio normal
  # (~2 pt a 8.4 pt), no estirado. Con el corte por conteo pasaba de 6 pt.
  linea <- linea[order(linea$xmin), ]
  huecos <- linea$xmin[-1] - linea$xmax[-nrow(linea)]
  expect_lt(max(huecos), 4)
})

test_that("celda: ninguna palabra del enunciado cruza los bordes de su celda", {
  skip_if_not(nzchar(.t2_pdftotext()))
  # acrconta P29: la primera linea del enunciado quedaba sobre el borde superior.
  lbl <- "¿Conoce las actividades y políticas institucionales para el fortalecimiento de la igualdad de género en la universidad?"
  survey <- data.frame(type = c("select_one sn", "integer"), name = c("p29", "edad"),
                       label = c(lbl, "Área Índice ¿Edad?"),
                       hint = c("", "Época de referencia"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = "sn", name = c("1", "2"), label = c("Sí", "No"),
                        stringsAsFactors = FALSE)
  traza <- list()
  testthat::local_mocked_bindings(
    .form_pdf_traza = function(tipo, pagina, y_arriba, y_abajo) {
      if (identical(tipo, "celda_enunciado")) traza[[length(traza) + 1L]] <<- c(y_arriba, y_abajo)
    }, .package = "prosecnurapp")
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, list(form_title = "Celda"), output_file = tmp,
                         options = list(columns = 2, no_default_intro = TRUE))
  celdas <- traza[(length(traza) / 2 + 1):length(traza)]          # pasada que dibuja
  expect_length(celdas, 2L)
  bp <- function(y) 18 + (1 - y) * 805.8898                       # npc de la region -> bp desde arriba
  pal <- .t2_palabras_pdf(tmp)
  pal <- pal[pal$pagina == 1L, ]
  textos <- list(c("29.", strsplit(lbl, " ")[[1]]), c("2.", "Área", "Índice", "¿Edad?", "Época", "de", "referencia"))
  for (k in 1:2) {
    top <- bp(celdas[[k]][1]); bot <- bp(celdas[[k]][2])
    w <- pal[pal$texto %in% textos[[k]] & pal$ymin > top - 12 & pal$ymax < bot + 12, ]
    expect_gte(nrow(w), 4L)
    expect_true(all(w$ymin >= top), label = sprintf("celda %d: tope %.1f, palabra mas alta %.1f", k, top, min(w$ymin)))
    expect_true(all(w$ymax <= bot), label = sprintf("celda %d: fondo %.1f, palabra mas baja %.1f", k, bot, max(w$ymax)))
  }
})
