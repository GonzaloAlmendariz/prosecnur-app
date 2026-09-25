test_that("reporte_formulario_word genera un .docx valido con portada, secciones, matrices y logica", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")

  survey <- data.frame(
    type = c(
      "begin_group",
      "select_one esc_sino", "select_one esc_sino", "select_one esc_sino",
      "select_one esc_ac", "select_one esc_ac", "select_one esc_ac",
      "text",
      "select_one nivel",
      "end_group"
    ),
    name = c("g1", "p_si1", "p_si2", "p_si3", "p_ac1", "p_ac2", "p_ac3",
             "p_abierta", "p_nivel", "g1e"),
    label = c(
      "Misión y propósitos",
      "Conoce la misión y los propósitos de la PUCP. [entiéndase los propósitos como: lineamientos que orientan el quehacer de la universidad y guían su desarrollo]",
      "Sé dónde consultar la misión y los propósitos de la PUCP.",
      "Conoce los propósitos de la Unidad (Facultad de Arte y Diseño).",
      "Los propósitos de la Unidad están definidos con claridad.",
      "El estatuto PUCP permite que la Unidad se organice adecuadamente.",
      "La normativa interna es suficiente para la gestión.",
      "¿Qué recomendaría mejorar? (respuesta abierta)",
      "¿Cuál es su nivel de satisfacción general?",
      ""
    ),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("esc_sino", "esc_sino",
                  "esc_ac", "esc_ac", "esc_ac", "esc_ac", "esc_ac",
                  "nivel", "nivel", "nivel"),
    name  = c("1", "2", "1", "2", "3", "4", "9", "1", "2", "3"),
    label = c("Sí", "No",
              "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
              "Bajo", "Medio", "Alto"),
    stringsAsFactors = FALSE
  )
  settings <- list(form_title = "Cuestionario de prueba Word")
  # Agrupa explicitamente las dos matrices (Sí/No y acuerdo con especial).
  mg <- list(
    list(members = c("p_si1", "p_si2", "p_si3"), tenor = "", special = "auto"),
    list(members = c("p_ac1", "p_ac2", "p_ac3"), tenor = "", special = "auto")
  )
  out <- tempfile(fileext = ".docx")
  res <- reporte_formulario_word(
    survey = survey, choices = choices, settings = settings, output_file = out,
    options = list(columns = 1, logic_language = "conditions", matrix_groups = mg,
                   show_header_title = FALSE, show_questionnaire_number = FALSE)
  )

  expect_true(file.exists(out))
  expect_gt(file.info(out)$size, 0)
  expect_identical(res$path, out)

  doc <- officer::read_docx(out)
  txt <- paste(officer::docx_summary(doc)$text, collapse = "\n")

  # Portada + sección
  expect_true(grepl("Cuestionario de prueba Word", txt, fixed = TRUE))
  expect_true(grepl("MISIÓN Y PROPÓSITOS", toupper(txt), fixed = TRUE))
  # Etiquetas de items de matriz (filas)
  expect_true(grepl("Sé dónde consultar la misión", txt, fixed = TRUE))
  # Códigos de escala presentes (matriz)
  expect_true(grepl("Sí", txt, fixed = TRUE) && grepl("No", txt, fixed = TRUE))
  expect_true(grepl("SIN INF", txt, fixed = TRUE))
  # Pregunta abierta y select_one suelta
  expect_true(grepl("recomendaría mejorar", txt, fixed = TRUE))
  expect_true(grepl("nivel de satisfacción", txt, fixed = TRUE))
})

test_that("matriz en modo extremos reparte las anclas en celdas separadas (split mitad/mitad, ambas centradas)", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # Escala de 5 puntos SIN columna especial: el split debe dar 3 columnas al
  # polo izquierdo (ceiling(5/2)) y 2 al derecho.
  survey <- data.frame(
    type = rep("select_one esc5", 3),
    name = c("m1", "m2", "m3"),
    label = c("Item uno", "Item dos", "Item tres"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("esc5", 5),
    name = as.character(1:5),
    label = c("Totalmente en desacuerdo", "En desacuerdo", "Indiferente",
              "De acuerdo", "Totalmente de acuerdo"),
    stringsAsFactors = FALSE
  )
  mg <- list(list(members = c("m1", "m2", "m3"), tenor = "", special = "auto",
                  header = "extremos"))
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(
    survey = survey, choices = choices,
    settings = list(form_title = "Matriz extremos"), output_file = out,
    options = list(columns = 1, logic_language = "conditions", matrix_groups = mg,
                   show_header_title = FALSE, show_questionnaire_number = FALSE)
  )
  expect_true(file.exists(out) && file.info(out)$size > 0)

  # El .docx es un zip: extraemos word/document.xml y leemos la fila de
  # cabecera de la matriz (primera w:tr de la tabla).
  xml_dir <- tempfile("docx_xml_")
  utils::unzip(out, files = "word/document.xml", exdir = xml_dir)
  doc_xml <- xml2::read_xml(file.path(xml_dir, "word", "document.xml"))
  ns <- xml2::xml_ns(doc_xml)
  header_cells <- xml2::xml_find_all(doc_xml, "(//w:tbl)[1]/w:tr[1]/w:tc", ns)
  cell_text <- vapply(header_cells, function(tc) {
    paste(xml2::xml_text(xml2::xml_find_all(tc, ".//w:t", ns)), collapse = "")
  }, character(1))

  i_left  <- which(cell_text == "Totalmente en desacuerdo")
  i_right <- which(cell_text == "Totalmente de acuerdo")
  # Cada polo en su PROPIA celda (no un unico run "A — B" que abarca todo).
  expect_length(i_left, 1L)
  expect_length(i_right, 1L)
  expect_true(i_left != i_right)
  expect_false(any(grepl("—", cell_text, fixed = TRUE)))

  grid_span <- function(tc) {
    xml2::xml_attr(xml2::xml_find_first(tc, "./w:tcPr/w:gridSpan", ns), "val")
  }
  jc_val <- function(tc) {
    xml2::xml_attr(xml2::xml_find_first(tc, ".//w:pPr/w:jc", ns), "val")
  }
  # Split mitad/mitad: la impar va al polo izquierdo (ceiling), 3 + 2 = 5.
  expect_identical(grid_span(header_cells[[i_left]]), "3")
  expect_identical(grid_span(header_cells[[i_right]]), "2")
  # Ambos polos centrados en su celda (los encabezados de matriz siempre van
  # centrados, nunca alineados al borde).
  expect_identical(jc_val(header_cells[[i_left]]), "center")
  expect_identical(jc_val(header_cells[[i_right]]), "center")
})

test_that("reporte_formulario_word respeta el lenguaje de saltos", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")

  survey <- data.frame(
    type = c("select_one sino", "select_one nivel"),
    name = c("consiente", "p2"),
    label = c("¿Acepta participar?", "Pregunta siguiente"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sino", "sino", "nivel", "nivel"),
    name = c("1", "2", "1", "2"),
    label = c("Sí", "No", "A", "B"),
    stringsAsFactors = FALSE
  )
  out <- tempfile(fileext = ".docx")
  expect_no_error(
    reporte_formulario_word(
      survey = survey, choices = choices, settings = list(form_title = "Saltos"),
      output_file = out, options = list(logic_language = "saltos")
    )
  )
  expect_true(file.exists(out) && file.info(out)$size > 0)
})

test_that("reporte_formulario_word rinde end-to-end desde la Matriz PULSO IAC-CINDA", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  xlsx <- testthat::test_path("..", "..", "inst", "samples", "acreditacion", "matriz_pulso_iac_cinda.xlsx")
  skip_if_not(file.exists(xlsx), "sample matriz_pulso_iac_cinda.xlsx no disponible")

  wb <- matriz_pulso_to_workbook(xlsx, "Docentes")
  out <- tempfile(fileext = ".docx")
  res <- reporte_formulario_word(
    survey = wb$survey, choices = wb$choices, settings = wb$settings, output_file = out,
    options = list(columns = 1, logic_language = "conditions",
                   show_header_title = FALSE, show_questionnaire_number = FALSE)
  )
  expect_true(file.exists(out) && file.info(out)$size > 0)
  expect_gt(res$summary$n_questions, 0)
  doc <- officer::read_docx(out)
  txt <- paste(officer::docx_summary(doc)$text, collapse = "\n")
  expect_true(grepl("Docentes", txt, fixed = TRUE))
})

# =============================================================================
# Contrato OOXML del artefacto y regresiones del render (checklist
# `docs/qa/checklist-motor-formulario-papel-2026-09-24.md`, items 6, 9, 10 y 11
# mas la compatibilidad prometida de `columns`).
#
# El `.docx` se genera DENTRO del test, con el motor. Nunca contra un archivo
# del cliente ni contra una ruta de una maquina: `test-reporte-ppt-saneo-ooxml.R:70`
# apunta a un path absoluto local y por eso en CI se salta SIEMPRE.
# =============================================================================

# Instrumento minimo que produce los tres tipos de tramo del plan de columnas:
# prologo (portada + instrucciones, 1 columna), una seccion de preguntas cortas
# que cabe en media pagina (2 columnas) y una seccion con matriz de escala que
# no cabe (1 columna). Es la alternancia del instrumento de referencia.
.form_word_fixture_tramos <- function() {
  survey <- data.frame(
    type = c(
      "begin_group", "select_one sino", "select_one sino", "select_one sino", "end_group",
      "begin_group", "note",
      "select_one esc5", "select_one esc5", "select_one esc5", "select_one esc5", "end_group"
    ),
    name = c("gA", "q1", "q2", "q3", "gAe",
             "gB", "instr", "m1", "m2", "m3", "m4", "gBe"),
    label = c(
      "Datos generales", "¿Trabajas?", "¿Estudias?", "¿Vives solo?", "",
      "Percepciones", "Por favor señala cuán de acuerdo estás con cada frase.",
      "Me siento seguro en mi barrio", "Confío en las autoridades",
      "La escuela me escucha", "Participo en actividades", ""
    ),
    paper_group = c("", "", "", "", "", "", "bat", "bat", "bat", "bat", "bat", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sino", "sino", rep("esc5", 5)),
    name = c("1", "2", as.character(1:5)),
    label = c("Sí", "No",
              "Totalmente en desacuerdo", "En desacuerdo", "Indiferente",
              "De acuerdo", "Totalmente de acuerdo"),
    stringsAsFactors = FALSE
  )
  list(survey = survey, choices = choices,
       settings = list(form_title = "Instrumento de tramos"))
}

# Genera el .docx del fixture con el valor de `columns` pedido.
.form_word_fixture_docx <- function(columns) {
  fx <- .form_word_fixture_tramos()
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(
    survey = fx$survey, choices = fx$choices, settings = fx$settings,
    output_file = out,
    options = list(columns = columns, matrix_groups = list(list(
      members = c("m1", "m2", "m3", "m4"), tenor = "Grado de acuerdo", special = "auto")))
  )
  out
}

# `word/document.xml` ya parseado, con el namespace w: resuelto.
.form_word_document_xml <- function(path) {
  d <- tempfile("docx_xml_")
  utils::unzip(path, files = "word/document.xml", exdir = d)
  xml2::read_xml(file.path(d, "word", "document.xml"))
}

test_that("item 10: el .docx del motor pasa el verificador OOXML", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  skip_if_not_installed("zip")

  for (cols in list(1L, "auto")) {
    out <- .form_word_fixture_docx(cols)
    rep <- expect_docx_ooxml_valid(out)

    # El inventario de desorden se afirma ENTERO, no solo "no hay nuevos": asi
    # el dia que officer corrija uno de estos, el test avisa de que la lista de
    # excepciones quedo rancia en vez de seguir en verde por no mirar.
    expect_setequal(rep$desorden, .OOXML_DESORDEN_OFFICER_071)
    expect_identical(rep$desorden_nuevo, character(0))
    expect_identical(unname(rep$comentarios), c(0L, 0L, 0L))
  }
})

test_that("item 10 (defecto conocido aguas arriba): officer 0.7.1 emite sectPr fuera de secuencia", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # ECMA-376 CT_SectPr pide `... type, pgSz, pgMar, ..., cols, ...`; officer
  # 0.7.1 escribe `headerReference footerReference pgMar pgSz type cols`. Es un
  # defecto de la libreria, no del motor: reordenar el XML en memoria rompe el
  # post-proceso de officer (documentado en reporte_formulario_word.R). Se
  # DECLARA aqui, con su version, en vez de dar verde por no mirarlo. El dia que
  # officer lo arregle, este test cae y hay que quitar la excepcion.
  expect_identical(as.character(utils::packageVersion("officer")), "0.7.1")

  out <- .form_word_fixture_docx("auto")
  doc <- .form_word_document_xml(out)
  ns <- xml2::xml_ns(doc)
  ordenes <- unique(vapply(
    xml2::xml_find_all(doc, "//w:sectPr", ns),
    function(s) paste(xml2::xml_name(xml2::xml_children(s)), collapse = " "),
    character(1)
  ))
  expect_identical(ordenes, "headerReference footerReference pgMar pgSz type cols")
})

test_that("compatibilidad de `columns`: 1 y 2 no cambian la forma del .docx de hoy", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # Promesa hecha al usuario en el item 12 del checklist: mientras la decision
  # de honrar `columns = 2` en Word siga bloqueada, NINGUN export existente
  # cambia de forma. Una sola seccion y cero columnas de texto.
  for (cols in list(1L, 2L)) {
    out <- .form_word_fixture_docx(cols)
    doc <- .form_word_document_xml(out)
    ns <- xml2::xml_ns(doc)
    expect_length(xml2::xml_find_all(doc, "//w:sectPr", ns), 1L)
    nums <- xml2::xml_attr(xml2::xml_find_all(doc, "//w:cols", ns), "num")
    expect_true(all(is.na(nums)), info = sprintf("columns=%s emitio w:cols w:num", cols))
  }

  # Y "auto" SI corta en tramos: secciones continuas, con al menos una a dos
  # columnas con la canaleta del instrumento de referencia (425 twips).
  out <- .form_word_fixture_docx("auto")
  doc <- .form_word_document_xml(out)
  ns <- xml2::xml_ns(doc)
  sect <- xml2::xml_find_all(doc, "//w:sectPr", ns)
  expect_gt(length(sect), 1L)
  tipos <- vapply(sect, function(s) {
    xml2::xml_attr(xml2::xml_find_first(s, "./w:type", ns), "val")
  }, character(1))
  expect_true(all(tipos == "continuous"))

  dos_col <- Filter(function(s) {
    identical(xml2::xml_attr(xml2::xml_find_first(s, "./w:cols", ns), "num"), "2")
  }, sect)
  expect_gte(length(dos_col), 1L)
  cols_node <- xml2::xml_find_first(dos_col[[1]], "./w:cols", ns)
  expect_identical(xml2::xml_attr(cols_node, "sep"), "1")
  expect_identical(xml2::xml_attr(cols_node, "space"), "425")
})

test_that("item 9: el pie sobrevive en todas las secciones y ninguna lleva titlePg", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # Se mide por XML, no por PDF: convertir el .docx exige LibreOffice, que NO
  # esta en el CI (poppler si, LibreOffice no). El mobiliario es propiedad del
  # `sectPr`: una seccion nueva sin `footerReference` se queda sin pie, y
  # `titlePg` deja sin pie la PRIMERA pagina de cada seccion.
  out <- .form_word_fixture_docx("auto")
  doc <- .form_word_document_xml(out)
  ns <- xml2::xml_ns(doc)
  sect <- xml2::xml_find_all(doc, "//w:sectPr", ns)
  expect_gte(length(sect), 2L)  # con una sola seccion esto no prueba nada

  expect_length(xml2::xml_find_all(doc, "//w:titlePg", ns), 0L)
  for (k in seq_along(sect)) {
    expect_length(xml2::xml_find_all(sect[[k]], "./w:footerReference", ns), 1L)
    expect_length(xml2::xml_find_all(sect[[k]], "./w:headerReference", ns), 1L)
  }
})

test_that("cantSplit solo vive en tramos de una columna (es contenido perdido, no estetica)", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # En una seccion con `w:cols num=2`, una tabla con `cantSplit` cuyas filas no
  # caben en lo que resta de columna hace que LibreOffice las DESCARTE en vez de
  # pasarlas a la columna siguiente: las filas estan en el document.xml y no
  # llegan al PDF. Perder contenido es peor que una tabla partida.
  out <- .form_word_fixture_docx("auto")
  doc <- .form_word_document_xml(out)
  ns <- xml2::xml_ns(doc)

  # Se recorre el cuerpo en orden: un parrafo que lleva `sectPr` CIERRA su
  # tramo, asi que cada tabla pertenece al tramo que se cierra despues de ella.
  hijos <- xml2::xml_children(xml2::xml_find_first(doc, "//w:body", ns))
  tramo <- 1L
  tablas <- list()
  for (nodo in hijos) {
    nombre <- xml2::xml_name(nodo)
    if (identical(nombre, "tbl")) {
      tablas[[length(tablas) + 1L]] <- list(
        tramo = tramo,
        filas = length(xml2::xml_find_all(nodo, "./w:tr", ns)),
        cant_split = length(xml2::xml_find_all(nodo, ".//w:cantSplit", ns))
      )
    } else if (identical(nombre, "p") &&
               length(xml2::xml_find_all(nodo, "./w:pPr/w:sectPr", ns))) {
      tramo <- tramo + 1L
    }
  }
  sect <- xml2::xml_find_all(doc, "//w:sectPr", ns)
  cols_de <- vapply(sect, function(s) {
    n <- xml2::xml_attr(xml2::xml_find_first(s, "./w:cols", ns), "num")
    if (is.na(n)) 1L else as.integer(n)
  }, integer(1))

  expect_gt(length(tablas), 0L)
  expect_true(any(cols_de == 2L))  # sin tramo de dos columnas esto no discrimina
  for (t in tablas) {
    if (identical(cols_de[[t$tramo]], 2L)) {
      expect_identical(t$cant_split, 0L,
                       info = "tabla con cantSplit dentro de un tramo de dos columnas")
    } else {
      # En un tramo de una columna si va, y en TODAS las filas (item 3).
      expect_identical(t$cant_split, t$filas)
    }
  }
})

test_that("item 11: las categorias con asteriscos llegan literales al .docx", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # Este test nacio EN ROJO y destapo un defecto real: el modelo conservaba la
  # categoria y lo declaraba en `warnings`, pero el RENDERER la volvia a limpiar
  # (`.form_word_options_flextable()` aplicaba `.form_pdf_clean_text()` sobre
  # etiquetas que ya venian conservadas), asi que el .docx imprimia «De 5 a 10»
  # mientras el warning afirmaba «Categoria conservada tal cual». Rojo literal:
  #   Failure: categoria que no llego literal al .docx: De 5* a 10*
  #   Failure: categoria que no llego literal al .docx: Nota al pie (*)
  #   Failure: categoria que no llego literal al .docx: 3 * a la semana
  # Reparado en `f28f84f02`. Se mide sobre el ARTEFACTO a proposito: el gate
  # anterior se detenia en `block$options$label` y por eso daba verde.
  #
  # LAS DOS MITADES DEL INVARIANTE VIVEN JUNTAS, y por eso el enunciado con
  # markdown esta en el MISMO test: «la categoria se conserva **y** el enunciado
  # se limpia». Comprobar solo la primera mitad deja la suite verde si alguien
  # "arregla" esto volviendo inocua la limpieza para todo, que es romper la
  # separacion por el otro lado.
  survey <- data.frame(
    type = "select_one frec", name = "q1",
    label = "¿Cuántas veces **comes** fruta? Usa `código` exacto",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("frec", 3), name = c("1", "2", "3"),
    label = c("De 5* a 10*", "Nota al pie (*)", "3 * a la semana"),
    stringsAsFactors = FALSE
  )
  out <- tempfile(fileext = ".docx")
  res <- reporte_formulario_word(
    survey = survey, choices = choices, settings = list(form_title = "Categorias"),
    output_file = out, options = list(columns = 1)
  )
  doc <- .form_word_document_xml(out)
  textos <- xml2::xml_text(xml2::xml_find_all(doc, "//w:t", xml2::xml_ns(doc)))
  # Mitad 1: la CATEGORIA se conserva tal cual.
  for (lbl in choices$label) {
    expect_true(any(textos == lbl),
                info = sprintf("categoria que no llego literal al .docx: %s", lbl))
  }
  expect_true(any(grepl("De 5 a 10", res$warnings, fixed = TRUE)))

  # Mitad 2 (control inverso): el ENUNCIADO se desmarca. Se mira SOLO el run del
  # enunciado: un "cero asteriscos en todo el .docx" seria falso —las categorias
  # de arriba llevan los suyos a proposito—, y confundir las dos mitades es
  # justamente como se rompe esto.
  enunciado <- textos[grepl("comes", textos, fixed = TRUE)]
  expect_length(enunciado, 1L)
  expect_true(grepl("comes fruta", enunciado, fixed = TRUE))
  expect_true(grepl("código exacto", enunciado, fixed = TRUE))
  expect_false(grepl("*", enunciado, fixed = TRUE),
               label = "el enunciado conserva el markdown `**`")
  expect_false(grepl("`", enunciado, fixed = TRUE),
               label = "el enunciado conserva los backticks")
})

# --- Regresion del renderer Word (GOAL replica Ser Adolescente) ---------------
#
# La suite tenia 85 aserciones y ninguna cubria lo que este GOAL cambio. Aqui ya
# hubo una fuga real que NINGUN test vio: tres tablas escritas despues de
# centralizar la tipografia no aplicaban `font()`, y el .docx salia con 14 runs
# en Helvetica. La cazo medir el documento ENTERO, no el sitio recien tocado.
#
# Todo se mide sobre el ARTEFACTO (`word/document.xml`), nunca sobre el modelo.

.form_word_es_gris <- function(hex) {
  h <- toupper(hex)
  substr(h, 1, 2) == substr(h, 3, 4) & substr(h, 3, 4) == substr(h, 5, 6)
}

test_that("Word: el instrumento es monocromo — texto negro y rellenos en gris", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  doc <- .form_word_document_xml(.form_word_fixture_docx("auto"))
  ns <- xml2::xml_ns(doc)
  cols <- xml2::xml_attr(xml2::xml_find_all(doc, "//w:color", ns), "val")
  fills <- xml2::xml_attr(xml2::xml_find_all(doc, "//*[@w:fill]", ns), "fill")
  cols <- cols[!is.na(cols) & cols != "auto"]
  fills <- fills[!is.na(fills) & fills != "auto"]
  expect_gt(length(cols), 50L)
  expect_setequal(unique(cols), "000000")
  expect_true(all(.form_word_es_gris(fills)),
              label = paste("rellenos no grises:", paste(unique(fills[!.form_word_es_gris(fills)]), collapse = ", ")))
})

test_that("Word: TODO el cuerpo va en Arial Narrow", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  doc <- .form_word_document_xml(.form_word_fixture_docx("auto"))
  ns <- xml2::xml_ns(doc)
  fuentes <- xml2::xml_attr(xml2::xml_find_all(doc, "//w:rFonts", ns), "ascii")
  fuentes <- fuentes[!is.na(fuentes)]
  expect_gt(length(fuentes), 50L)
  # Centralizar la fuente en una constante NO basta: cada tabla nueva tiene que
  # acordarse de aplicarla, y tres no lo hicieron. Este test es el que lo caza.
  expect_setequal(unique(fuentes), "Arial Narrow")
})

test_that("Word: todas las celdas llevan sus cuatro bordes", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  doc <- .form_word_document_xml(.form_word_fixture_docx("auto"))
  ns <- xml2::xml_ns(doc)
  celdas <- xml2::xml_find_all(doc, "//w:tc", ns)
  expect_gt(length(celdas), 20L)
  # La estructura de las filas cuelga de los BORDES, no del relleno: el relleno
  # (F2F2F2, 5 % de tinta) desaparece en una fotocopia y el instrumento es un
  # insumo que se fotocopia.
  con_cuatro <- vapply(celdas, function(tc) {
    b <- xml2::xml_find_all(tc, "./w:tcPr/w:tcBorders/*", ns)
    sum(xml2::xml_attr(b, "val") == "single", na.rm = TRUE) >= 4L
  }, logical(1))
  expect_identical(sum(!con_cuatro), 0L,
                   label = "celdas sin sus cuatro caras")
})

test_that("Word: el enunciado vive DENTRO de la tabla, en celda sombreada", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  doc <- .form_word_document_xml(.form_word_fixture_docx(1))
  ns <- xml2::xml_ns(doc)
  tablas <- xml2::xml_find_all(doc, "//w:tbl", ns)
  expect_gt(length(tablas), 1L)
  # Al menos una tabla de pregunta arranca con su enunciado en `F2F2F2`. Suelto
  # encima, el enunciado se separaba de sus opciones al cortar la columna.
  con_enunciado <- vapply(tablas, function(t) {
    fila <- xml2::xml_find_first(t, "./w:tr", ns)
    shd <- xml2::xml_attr(xml2::xml_find_first(fila, ".//w:shd", ns), "fill")
    txt <- paste(xml2::xml_text(xml2::xml_find_all(fila, ".//w:t", ns)), collapse = "")
    !is.na(shd) && identical(shd, "F2F2F2") && nzchar(trimws(txt))
  }, logical(1))
  expect_gt(sum(con_enunciado), 0L)
})

test_that("Word: margenes de la referencia y ancho util por encima de 10 500 twips", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  doc <- .form_word_document_xml(.form_word_fixture_docx("auto"))
  ns <- xml2::xml_ns(doc)
  sect <- xml2::xml_find_first(doc, "//w:sectPr", ns)
  pg <- xml2::xml_find_first(sect, "./w:pgSz", ns)
  pm <- xml2::xml_find_first(sect, "./w:pgMar", ns)
  izq <- as.integer(xml2::xml_attr(pm, "left"))
  der <- as.integer(xml2::xml_attr(pm, "right"))
  util <- as.integer(xml2::xml_attr(pg, "w")) - izq - der
  # Un formulario en papel no es un documento de oficina: la densidad ES la
  # funcion. La referencia deja 10 549 twips utiles.
  expect_identical(c(izq, der), c(680L, 680L))
  expect_gte(util, 10500L)
})

test_that("Word: el pie lleva el campo del TOTAL de paginas", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  out <- .form_word_fixture_docx("auto")
  d <- tempfile("docx_ftr_")
  pies <- grep("^word/footer[0-9]+\\.xml$", utils::unzip(out, list = TRUE)$Name, value = TRUE)
  expect_gt(length(pies), 0L)
  utils::unzip(out, files = pies, exdir = d)
  txt <- paste(vapply(file.path(d, pies), function(f) paste(readLines(f, warn = FALSE), collapse = ""),
                      character(1)), collapse = "")
  # «Pagina N de M»: el total es otro campo de Word. Un campo no se calcula hasta
  # que el documento se abre, asi que aqui se comprueba que ESTA, no su valor.
  expect_true(grepl("NUMPAGES", txt, fixed = TRUE))
  expect_true(grepl("PAGE", txt, fixed = TRUE))
})
