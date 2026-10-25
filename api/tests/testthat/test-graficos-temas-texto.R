# TXT-20 (CCSS, 2026-10-25): el comentario final codificado en temas (`coment_recod`, múltiple con códigos 10, 21–29,
# 30…) sale como barras de % de comentarios con contenido.
#
#  1. El orden de categorías no revienta cuando la variable no está en el instrumento y `var_labels` es un vector con
#     nombres (`inst$var_labels[[var]]` daba «subscript out of bounds» y el aviso tapaba la causa: la variable no estaba).
#  2. `temas_de_texto` (opcional, apagado por defecto) declara el texto abierto que se codificó. Con él:
#       - el denominador son los comentarios con contenido de ese texto (sin las no respuestas), no sólo los que
#         recibieron un tema; la base lo dice («Base: N comentarios con contenido»);
#       - el subtítulo avisa que los porcentajes suman más de 100 %;
#       - los subtemas de un módulo partido (21–29) van bajo su módulo, en el orden de los códigos, con el módulo
#         como fila propia (% de comentarios que tocan cualquiera de sus subtemas) y rótulo corto.
#     Sin él, nada cambia.

source("setup-load-all.R")
withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))

.tt_inst <- function() {
  survey <- data.frame(
    type = c("begin_group", "text", "end_group", "begin_group", "text", "end_group", "begin_group", "text", "end_group",
             "begin_group", "text", "select_multiple lst_coment_recod", "end_group"),
    name = c("modulo_a", "a1", NA, "modulo_b", "b1", NA, "modulo_c", "c1", NA, "modulo_coment", "coment", "coment_recod", NA),
    list_name = c(NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, "lst_coment_recod", NA),
    label = c("MÓDULO A. INFORMACIÓN GENERAL", "Carrera", NA, "MÓDULO B. EXPERIENCIA UNIVERSITARIA", "Algo", NA,
              "MÓDULO C. GOBIERNO", "Algo", NA, "### COMENTARIOS", "¿Algún comentario final?", "Temas del comentario", NA),
    stringsAsFactors = FALSE
  )
  cod <- c("10", "21", "22", "30")
  lab <- c("A. Información general", "B. Como estudiante",
           "B. ¿Qué tan de acuerdo estás con las siguientes afirmaciones sobre la relación entre estudiantes y docentes?",
           "C. Gobierno y gestión")
  list(survey = survey,
       choices = data.frame(list_name = "lst_coment_recod", name = cod, label = lab, stringsAsFactors = FALSE),
       orders_list = list(coment_recod = list(names = cod, labels = lab, label = "Temas del comentario")),
       var_labels = c(a1 = "Carrera", coment = "¿Algún comentario final?"))
}

.tt_data <- function() {
  na <- NA_real_
  data.frame(
    coment = c("La biblioteca necesita espacios", "Estudio poco", "Los docentes no explican y estudio poco",
               "La matrícula es lenta", "Mejorar los JPs", "Ninguna", "", NA),
    coment_recod.10 = c(1, 0, 0, 0, na, na, na, na),
    coment_recod.21 = c(0, 1, 1, 0, na, na, na, na),
    coment_recod.22 = c(0, 0, 1, 0, na, na, na, na),
    coment_recod.30 = c(0, 0, 0, 1, na, na, na, na),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.tt_lamina <- function(el) {
  out <- tempfile(fileext = ".pptx")
  plan <- list(a = p_slide_1_grafico(el, titulo = "Temas"))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .tt_data(), instrumento = .tt_inst(), plan = plan,
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  .pptx_leer_parte(out, .pptx_slide_paths(out)[[1]])
}
.tt_formas <- function(x, nombre) {
  xml <- xml2::read_xml(x)
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  y <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"), "y"))
  xml2::xml_text(sp)[order(y)]
}
.tt_texto <- function(x) paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(x), "//a:t")), collapse = " | ")

test_that("TXT-20: el orden de categorías no revienta si la variable no está en el instrumento", {
  inst <- .tt_inst(); inst$orders_list <- list(); inst$choices <- inst$choices[0, ]
  inst$survey <- inst$survey[inst$survey$name %in% c("coment") | is.na(inst$survey$name), ]
  el <- p_barras_agrupadas("coment_recod", overrides = list(orden_barras = "mayor_menor"))
  expect_identical(.goc_pregunta(inst, "coment_recod"), "coment_recod")
  expect_no_error(out <- .goc_traducir(el, list(inst = inst, var = "coment_recod")))
  expect_identical(out$overrides$orden_barras, "mayor_menor")
})

test_that("temas_de_texto: base de comentarios con contenido, módulo con sus subtemas en orden de códigos", {
  tab <- .plan_tt_tabla(.tt_data(), "coment_recod", "coment", .tt_inst()$orders_list, .tt_inst()$survey)
  expect_identical(as.character(tab$Opciones), c(
    "A. Información general", "B. Experiencia universitaria", "B · Como estudiante",
    "B · Relación entre estudiantes", "C. Gobierno y gestión", "Total"))
  # 5 comentarios con contenido («Ninguna», el vacío y el NA fuera; «Mejorar los JPs» dentro aunque no tenga tema).
  expect_equal(tab$n, c(1, 2, 2, 1, 1, 5))
  expect_equal(tab$n_casos, c(1, 2, 2, 1, 1, 5))
  expect_equal(tab$pct, c(1, 2, 2, 1, 1, 5) / 5)
})

test_that("temas_de_texto en la lámina: cifras, orden, base y nota de más de 100 %", {
  x <- .tt_lamina(p_barras_agrupadas("coment_recod", temas_de_texto = "coment",
                                     overrides = list(orden_barras = "mayor_menor")))
  rot <- trimws(.tt_formas(x, "rotulo"))
  expect_identical(rot, c("A. Información general", "B. Experiencia universitaria", "B · Como estudiante",
                          "B · Relación entre estudiantes", "C. Gobierno y gestión"))
  expect_identical(.tt_formas(x, "cifra"), c("20%", "40%", "40%", "20%", "20%"))
  txt <- .tt_texto(x)
  expect_match(txt, "Base: 5 comentarios con contenido", fixed = TRUE)
  expect_match(txt, "más de 100 %", fixed = TRUE)
})

test_that("sin temas_de_texto la múltiple sigue igual: base de quienes recibieron un tema", {
  x <- .tt_lamina(p_barras_agrupadas("coment_recod", overrides = list(orden_barras = "mayor_menor")))
  txt <- .tt_texto(x)
  expect_match(txt, "Base: 4", fixed = TRUE)
  expect_false(grepl("comentarios con contenido", txt, fixed = TRUE))
  expect_false(grepl("Experiencia universitaria", txt, fixed = TRUE))
  expect_identical(.tt_formas(x, "cifra")[1], "50%")   # «Como estudiante»: 2 de 4
})
