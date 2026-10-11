# La lámina «Otros aparte» del recetario (decisión 21; recetario_m5.R:85-100, p. 203 `m5:4`).
# Hallazgos H45 (crudo, pegado en un run), H46 (umbral), H47 (espacio del título).

# Fixture con la forma del ejemplo del recetario (Ingeniería Mecánica, «¿Cuál es su puesto actual?»): 22 textos
# distintos que suman 45 respuestas, escritos con variantes de mayúsculas, tildes y espacios.
.otros_fixture_puesto <- function() {
  textos <- c(
    rep(c("Ingeniero de proyectos", "ingeniero de proyectos", "INGENIERO DE PROYECTOS", " Ingeniero  de proyectos "), c(4, 1, 1, 1)),
    rep(c("Ingeniero de diseño", "Ingeniero de diseno", "ingeniero de diseño"), c(4, 1, 1)),
    rep("Ingeniero de aplicaciones", 5), rep(c("Planificador de mantenimiento", "planificador de mantenimiento"), c(4, 1)),
    rep(c("Ingeniero de diseño mecánico", "Ingeniero de tuberías", "Ingeniero mecánico", "Ingeniero mecánico intermedio"), each = 2),
    "Asesor técnico comercial", "Comprador corporativo", "Consultor técnico", "Ejecutivo comercial", "Ejecutivo de riesgos",
    "Gestor comercial", "Gestor de proyectos", "Ingeniera de manufactura", "Ingeniero de estrategias",
    "Ingeniero de mantenimiento mecánico", "Ingeniero de planeamiento", "Ingeniero de procesos de información",
    "Ingeniero de soporte de producto", "Ingeniero de ventas"
  )
  n_otros <- length(textos)
  dat <- data.frame(
    puesto = c(rep("99", n_otros), rep("1", 20), rep("2", 10), "99"),
    puesto_other = c(textos, rep("", 30), ""),
    stringsAsFactors = FALSE
  )
  attr(dat$puesto, "label") <- "¿Cuál es su\npuesto actual?"
  inst <- list(
    survey = data.frame(name = c("puesto", "puesto_other"), type = c("select_one lst_puesto", "text"),
                        list_name = c("lst_puesto", NA_character_), stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst_puesto", name = c("1", "2", "99"),
                         label = c("Analista", "Docente", "Otro (especifique)"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
  list(data = dat, inst = inst, textos = textos)
}

.otros_plan_fixture <- function(fx, auto = TRUE, path_ppt = NULL) {
  args <- list(
    data = fx$data, instrumento = fx$inst,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_agrupadas("puesto"))),
    presets = p_presets(barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)),
    solo_lista = is.null(path_ppt), mensajes_progreso = FALSE
  )
  if (!is.null(path_ppt)) args$path_ppt <- path_ppt
  if (!is.na(auto)) args$auto_otros_slides <- auto
  do.call(reporte_ppt_plan, args)
}

test_that("las respuestas se agrupan por texto normalizado, se cuentan y se ordenan de mayor a menor y alfabético", {
  it <- .otros_items(textos = .otros_fixture_puesto()$textos)
  expect_equal(nrow(it), 22L)                     # sin agrupar serían 45 filas
  expect_equal(sum(it$n), 45)
  expect_equal(head(it$texto, 4), c("Ingeniero de proyectos", "Ingeniero de diseño", "Ingeniero de aplicaciones", "Planificador de mantenimiento"))
  expect_equal(head(it$n, 8), c(7, 6, 5, 5, 2, 2, 2, 2))
  expect_equal(it$texto[5:8], c("Ingeniero de diseño mecánico", "Ingeniero de tuberías", "Ingeniero mecánico", "Ingeniero mecánico intermedio"))
  expect_equal(it$texto[9:11], c("Asesor técnico comercial", "Comprador corporativo", "Consultor técnico"))
  # Tipo oración, sin perder las siglas.
  expect_equal(.otros_items(textos = c("PUENTES VERDES", "trabajo en la ONG", "laboratorio vial"))$texto,
               c("Laboratorio vial", "Puentes verdes", "Trabajo en la ONG"))
})

test_that("las categorías plegadas en «Otros» se fusionan con el texto abierto sumando las cuentas", {
  cats <- data.frame(texto = c("Ingeniero de diseño", "Gestor"), n = c(3, 1))
  it <- .otros_items(cats, c("ingeniero de  DISEÑO", "Ingeniero de diseno", "Zeta"))
  expect_equal(it$texto, c("Ingeniero de diseño", "Gestor", "Zeta"))
  expect_equal(it$n, c(5, 1, 1))
})

test_that("sólo hay lámina con 5 o más respuestas en la pregunta (H46)", {
  info <- function(k) list(title = "Puesto", source = "b", parent_var = "p", text_var = "p_other", respuestas = paste("r", seq_len(k)))
  expect_length(.otros_slides(info(4)), 0L)
  expect_length(.otros_slides(info(5)), 1L)
  # El umbral cuenta respuestas, no textos distintos: 5 iguales sí llevan lámina.
  expect_length(.otros_slides(list(title = "P", respuestas = rep("igual", 5))), 1L)
})

test_that("la base dice cuántas respuestas suman las cuentas, con la pregunta", {
  s <- .otros_slides(list(title = "¿Cuál es su puesto actual?", respuestas = .otros_fixture_puesto()$textos))
  expect_length(s, 1L)
  expect_identical(s[[1]]$slots$base, "Base: 45 respuestas en «Otros» en la pregunta ¿Cuál es su puesto actual?")
  expect_equal(s[[1]]$slots$otros$total, 45)
  expect_identical(s[[1]]$title, "Respuestas «Otros»: ¿cuál es su puesto actual?")
  expect_identical(s[[1]]$meta$antetitulo, "Otros aparte")
})

test_that("dos columnas llenadas por columna: ceiling(n/2) en la primera, ~24 por lámina y «(cont.)»", {
  it <- .otros_items(textos = .otros_fixture_puesto()$textos)
  p <- .otros_paginar(it)
  expect_length(p, 1L)
  expect_equal(p[[1]]$columna, rep(1:2, c(11, 11)))
  expect_equal(p[[1]]$fila, 1:22)
  # Con textos largos al principio, la primera columna sigue llevando los primeros ceiling(k/2) ítems.
  largo <- data.frame(texto = c(rep(strrep("palabra ", 14), 3), paste("corto", 1:9)), n = 12:1)
  pl <- .otros_paginar(largo)
  k <- nrow(pl[[1]])
  expect_equal(pl[[1]]$columna, rep(1:2, c(ceiling(k / 2), k - ceiling(k / 2))))
  s <- .otros_slides(list(title = "Actividad preferida", respuestas = paste("respuesta abierta", 1:30)))
  expect_length(s, 2L)
  expect_equal(nrow(s[[1]]$slots$otros$items), 24L)
  expect_equal(nrow(s[[2]]$slots$otros$items), 6L)
  expect_identical(s[[2]]$title, "Respuestas «Otros»: actividad preferida (cont.)")
  expect_identical(s[[1]]$slots$base, s[[2]]$slots$base)
})

test_that("el título no pierde el espacio del salto de línea de la etiqueta (H47)", {
  expect_identical(.otros_titulo("Herramientas que usa en sus\nfunciones"), "Respuestas «Otros»: herramientas que usa en sus funciones")
})

test_that("por defecto la lámina «Otros» sigue apagada", {
  expect_false(eval(formals(reporte_ppt_plan)$auto_otros_slides))
  fx <- .otros_fixture_puesto()
  expect_length(.otros_plan_fixture(fx, auto = NA)$plan, 1L)
  out <- .otros_plan_fixture(fx, auto = TRUE)
  expect_length(out$plan, 2L)
  expect_true(isTRUE(out$plan[[2]]$meta$auto_otros))
  expect_equal(sum(out$plan[[2]]$slots$otros$items$n), 45)
})

test_that("el PPTX dibuja cada ítem en su propio párrafo, con cuenta, mini-barra, antetítulo y base", {
  skip_if_not_installed("officer")
  fx <- .otros_fixture_puesto()
  path <- withr::local_tempfile(fileext = ".pptx")
  .otros_plan_fixture(fx, auto = TRUE, path_ppt = path)
  doc <- officer::read_pptx(path)
  expect_equal(length(doc), 2L)
  xml <- xml2::read_xml(doc$slide$get_slide(2)$file_name())
  ns <- xml2::xml_ns(xml)
  sp_txt <- xml2::xml_find_all(xml, ".//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, 'otros:texto')]", ns)
  expect_length(sp_txt, 22L)
  expect_true(all(vapply(sp_txt, function(s) length(xml2::xml_find_all(s, ".//a:p", ns)) == 1L, logical(1))))
  t_all <- xml2::xml_text(xml2::xml_find_all(xml, ".//a:t", ns))
  expect_false(any(grepl("\n", t_all, fixed = TRUE)))
  expect_true("Ingeniero de proyectos" %in% t_all)
  expect_true("OTROS APARTE" %in% t_all)
  expect_true("Respuestas «Otros»: ¿cuál es su puesto actual?" %in% t_all)
  expect_true("Base: 45 respuestas en «Otros» en la pregunta ¿Cuál es su puesto actual?" %in% t_all)
  n_txt <- xml2::xml_text(xml2::xml_find_all(xml, ".//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, 'otros:n')]//a:t", ns))
  expect_equal(head(n_txt, 4), c("7", "6", "5", "5"))
  expect_length(xml2::xml_find_all(xml, ".//p:sp[starts-with(p:nvSpPr/p:cNvPr/@name, 'otros:barra')]", ns), 22L)
  sz <- xml2::xml_attr(xml2::xml_find_all(sp_txt[[1]], ".//a:rPr", ns), "sz")
  expect_identical(unique(sz), "1200")
})

test_that("el orden alfabético entre empates lee los números como números", {
  expect_equal(.otros_items(textos = paste("Actividad", c(10, 2, 1)))$texto, paste("Actividad", c(1, 2, 10)))
})
