source("setup-load-all.R")

# Informe ACNUR (checklist-informe-acnur-2026-11-11, D1 y D2): el mazo con la plantilla de cliente ACNUR sale con la
# identidad de esa plantilla (título negro, barras en el azul del perfil) y con la base en cada lámina de pregunta. El
# compositor nativo del recetario la reemplazaba por la identidad Pulso y, al leer `suppress_footer_placeholder` como
# "sin pie", descartaba la base que el plan ACNUR manda en `overrides$nota_pie`.

.acnur_pc_fixture <- function() {
  df <- data.frame(p1 = c(rep("si", 30), rep("no", 10)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one lst", list_name = "lst",
                                   label = "¿Da su consentimiento?", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lst", name = c("si", "no"), label = c("Sí", "No"), stringsAsFactors = FALSE),
               orders_list = NULL)
  list(df = df, inst = inst)
}

.acnur_pc_render <- function(template_id) {
  fx <- .acnur_pc_fixture()
  plantilla <- testthat::test_path("..", "..", "inst", "plantillas",
                                   if (identical(template_id, "acnur_16_9")) "plantilla_acnur_16_9.pptx" else "plantilla_16_9.pptx")
  # El mismo slide que arma `.graficos_pack_acnur_graphs`: base en la nota del gráfico, sin base ni pie de lámina.
  lam <- p_slide_1_grafico(
    p_barras_agrupadas(var = "p1", overrides = list(nota_pie = "40 respuestas de la muestra total (100%).")),
    titulo = "¿Da su consentimiento?",
    meta = list(suppress_base_placeholder = TRUE, suppress_footer_placeholder = TRUE)
  )
  out <- tempfile(fileext = ".pptx")
  perfil <- if (identical(template_id, "acnur_16_9")) .PPT_STYLE_PROFILES$acnur_kobo_cruncher_plus$presets else list()
  presets <- do.call(p_presets, lapply(perfil, as.list))
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE, presets = presets,
    template_pptx = plantilla, template_id = template_id, plan = list(a = lam)
  )))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}

test_that("con la plantilla ACNUR la lámina de pregunta no se compone con piezas del recetario Pulso", {
  x <- .acnur_pc_render("acnur_16_9")
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_false("Titulo lamina" %in% nombres)
  colores <- toupper(xml2::xml_attr(xml2::xml_find_all(x, "//a:srgbClr"), "val"))
  expect_false("CA5651" %in% colores)   # el coral de Pulso no entra a un informe ACNUR
})

test_that("con la plantilla ACNUR cada lámina de pregunta lleva su base", {
  x <- .acnur_pc_render("acnur_16_9")
  textos <- paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " ")
  # En la ruta de la plantilla la base va dentro del gráfico (imagen o DrawingML): se busca en el XML o en la imagen
  # vectorial del gráfico, que se escribe como texto.
  graf <- paste(xml2::xml_text(xml2::xml_find_all(x, "//*[local-name()='t']")), collapse = " ")
  expect_true(grepl("40 respuestas de la muestra total", paste(textos, graf), fixed = TRUE))
})

test_that("con la plantilla Pulso la lámina sigue siendo nativa", {
  x <- .acnur_pc_render("generic_16_9")
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_true("Titulo lamina" %in% nombres)
})

test_that("una lámina que pide el motor nativo lo conserva aunque la plantilla sea de cliente", {
  s <- structure(list(meta = list(motor_nativo = TRUE)), class = c("ppt_slide", "list"))
  expect_true(.lam_motor_de_plantilla(s, "x/plantilla_acnur_16_9.pptx", "acnur_16_9")$meta$motor_nativo)
  s2 <- structure(list(meta = list()), class = c("ppt_slide", "list"))
  expect_false(.lam_motor_de_plantilla(s2, "x/plantilla_acnur_16_9.pptx", "")$meta$motor_nativo)
  expect_null(.lam_motor_de_plantilla(s2, "x/plantilla_16_9.pptx", "generic_16_9")$meta$motor_nativo)
})

# D3: una lista larga se pagina sobre las opciones con casos, no sobre todo el formulario.
.acnur_paises <- function() {
  list(name = "REF02", tipo = "select_one paises",
       choices = lapply(seq_len(220), function(i) list(name = sprintf("P%03d", i), label = sprintf("País %d", i))))
}

test_that("la nacionalidad con 220 países y 4 con casos sale en una sola lámina", {
  v <- .acnur_paises()
  ctx <- list(data = data.frame(REF02 = c(rep("P010", 30), "P020", "P030", "P040", NA, ""), stringsAsFactors = FALSE))
  pages <- .graficos_acnur_choice_pages(v, max_per_slide = 12L, con_casos = .graficos_acnur_codigos_con_casos(ctx, v))
  expect_length(pages, 1L)
  fuera <- pages[[1]]$exclude_options
  expect_false(any(c("P010", "P020", "P030", "P040") %in% fuera))
  expect_true(all(c("P001", "País 1", "P220") %in% fuera))   # las opciones sin casos no se dibujan
})

test_that("con más opciones con casos que el tope se pagina sólo sobre esas", {
  v <- .acnur_paises()
  ctx <- list(data = data.frame(REF02 = sprintf("P%03d", 1:20), stringsAsFactors = FALSE))
  pages <- .graficos_acnur_choice_pages(v, max_per_slide = 12L, con_casos = .graficos_acnur_codigos_con_casos(ctx, v))
  expect_length(pages, 2L)
  for (pg in pages) expect_true("P150" %in% pg$exclude_options)
  dibujadas <- lapply(pages, function(pg) setdiff(sprintf("P%03d", 1:20), pg$exclude_options))
  expect_setequal(unlist(dibujadas), sprintf("P%03d", 1:20))
  expect_length(intersect(dibujadas[[1]], dibujadas[[2]]), 0L)
})

test_that("una lista corta conserva sus ceros y sin base se pagina como antes", {
  v <- list(name = "p", tipo = "select_one l",
            choices = lapply(1:5, function(i) list(name = paste0("c", i), label = paste("C", i))))
  ctx <- list(data = data.frame(p = c("c1", "c1"), stringsAsFactors = FALSE))
  expect_null(.graficos_acnur_choice_pages(v, 8L, .graficos_acnur_codigos_con_casos(ctx, v))[[1]]$exclude_options)
  expect_length(.graficos_acnur_choice_pages(.acnur_paises(), 12L, con_casos = NULL), 19L)
})

test_that("en opción múltiple cuentan las opciones marcadas en alguna respuesta", {
  v <- list(name = "m", tipo = "select_multiple l",
            choices = lapply(1:15, function(i) list(name = paste0("o", i), label = paste("O", i))))
  ctx <- list(data = data.frame(m = c("o1 o3", "o3", NA), stringsAsFactors = FALSE))
  expect_setequal(.graficos_acnur_codigos_con_casos(ctx, v), c("o1", "o3"))
  pages <- .graficos_acnur_choice_pages(v, 12L, .graficos_acnur_codigos_con_casos(ctx, v))
  expect_length(pages, 1L)
  expect_false(any(c("o1", "o3") %in% pages[[1]]$exclude_options))
})

# D4: la portada escribe el subtítulo en dos líneas, no pegado.
test_that("un subtítulo con salto de línea se escribe en dos párrafos", {
  pml <- function(x) paste(if (inherits(x, "block_list")) vapply(x, officer::to_pml, "") else officer::to_pml(x), collapse = "")
  doble <- .ppt_fpar_con_saltos("Informe de resultados\n23 oct. – 31 oct. 2026", officer::fp_text(font.size = 20))
  expect_s3_class(doble, "block_list")
  expect_length(doble, 2L)
  expect_match(pml(doble[[1]]), "Informe de resultados</a:t>", fixed = TRUE)
  expect_false(grepl("resultados23", pml(doble), fixed = TRUE))
  expect_s3_class(.ppt_fpar_con_saltos("Una línea", officer::fp_text()), "fpar")
})

# D5: dos grupos repetibles sobre las mismas personas no repiten la fila de la ficha técnica.
test_that("la ficha técnica no repite una fila idéntica", {
  miembros <- list(n_rows = 1478L, n_people = 413L, unit = list(plural = "miembros", inferred = TRUE))
  ctx <- list(study_name = "RMS", main = list(n_rows = 486L), repeats = list(miembros, miembros))
  rows <- .graficos_acnur_technical_rows(ctx)
  criterios <- vapply(rows, `[[`, "", "criterio")
  expect_equal(sum(criterios == "Miembros registrados"), 1L)
  otros <- miembros; otros$n_rows <- 120L
  rows2 <- .graficos_acnur_technical_rows(list(study_name = "RMS", main = list(n_rows = 486L), repeats = list(miembros, otros)))
  expect_equal(sum(vapply(rows2, `[[`, "", "criterio") == "Miembros registrados"), 2L)   # cifras distintas se conservan
})

# D7: la fila de encabezados de una tabla del formulario no es una pregunta.
test_that("el encabezado de tabla (appearance label) no se grafica y sus filas sí", {
  survey <- data.frame(name = c("DIS01a", "DIS01", "X"), appearance = c("label", "list-nolabel", NA), stringsAsFactors = FALSE)
  expect_true(.graficos_es_encabezado_tabla(survey, 1L))
  expect_false(.graficos_es_encabezado_tabla(survey, 2L))
  expect_false(.graficos_es_encabezado_tabla(survey, 3L))
  item <- list(name = "DIS01a", label = "", tipo = "select_one dif", data_available = TRUE, encabezado_tabla = TRUE)
  expect_false(.graficos_graphable_reason(item)$graphable)
  item$encabezado_tabla <- FALSE
  expect_true(.graficos_graphable_reason(item)$graphable)
})

# D8: una select cuyas opciones son los nombres de un grupo repetible no se grafica.
test_that("select_one con opciones de otro bloque no se grafica", {
  expect_true(.graficos_opciones_de_otro_bloque("select_one ${HH01_2_aux}"))
  expect_true(.graficos_opciones_de_otro_bloque("select_multiple ${miembros}"))
  expect_false(.graficos_opciones_de_otro_bloque("select_one sexo"))
  expect_false(.graficos_opciones_de_otro_bloque("select_one_from_file paises.csv"))
  expect_true(.graficos_opciones_de_otro_bloque("select_one", "${HH01_2_aux}"))   # como lo deja el lector
  expect_false(.graficos_opciones_de_otro_bloque("select_one", "sexo"))
  item <- list(name = "respondent", label = "Nombre del encuestado(a)", tipo = "select_one", data_available = TRUE,
               opciones_de_otro_bloque = TRUE)
  expect_false(.graficos_graphable_reason(item)$graphable)
})
