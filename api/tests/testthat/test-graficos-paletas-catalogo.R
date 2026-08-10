# Catálogo de listas del editor de paletas: qué cuenta como UNA escala.
#
# Regresión de «Conta 09-08 equivalencias»: el catálogo agrupaba por
# `list_name` y en un proyecto multibase ese nombre solo es único DENTRO de una
# base —cada instrumento numera sus propias preguntas—. `lst_p6` era la lista
# de grados en docentes y Sí/No en administrativos, y las dos se fusionaban en
# una entrada de 17 opciones que no existe en ninguna base. Medido: 22 de 43
# listas colisionaban.

inst_de <- function(list_name, codigos, etiquetas) {
  list(choices = data.frame(
    list_name = rep(list_name, length(codigos)),
    name = as.character(codigos),
    label = as.character(etiquetas),
    stringsAsFactors = FALSE
  ))
}

test_that("dos escalas distintas bajo el mismo list_name NO se fusionan", {
  catalogo <- .graficos_collect_palette_lists(list(
    docentes = inst_de("lst_p6", 1:3, c("Bachiller", "Magíster", "Doctor")),
    administrativos = inst_de("lst_p6", 1:2, c("Sí", "No"))
  ))

  expect_equal(length(catalogo), 2L)
  expect_equal(vapply(catalogo, function(x) x$list_name, ""), c("lst_p6", "lst_p6"))
  # La UI necesita identidades distintas para la clave de React y la selección.
  expect_equal(vapply(catalogo, function(x) x$escala_id, ""), c("lst_p6", "lst_p6#2"))
  expect_equal(vapply(catalogo, function(x) length(x$choices), integer(1)), c(3L, 2L))
  expect_equal(as.character(catalogo[[1]]$fuentes), "docentes")
  expect_equal(as.character(catalogo[[2]]$fuentes), "administrativos")
})

test_that("la misma escala en varias bases sigue siendo UNA entrada", {
  catalogo <- .graficos_collect_palette_lists(list(
    docentes = inst_de("lst_p1", 1:2, c("Sí", "No")),
    estudiantes = inst_de("lst_p1", 1:2, c("Sí", "No")),
    egresados = inst_de("lst_p1", 1:2, c("Sí", "No"))
  ))

  expect_equal(length(catalogo), 1L)
  expect_equal(catalogo[[1]]$escala_id, "lst_p1")
  expect_equal(as.character(catalogo[[1]]$fuentes),
               c("docentes", "estudiantes", "egresados"))
})

test_that("la caja de la etiqueta no parte una escala en dos", {
  # El cuestionario transcribe «Totalmente de Acuerdo» y «Totalmente de
  # acuerdo»: es un accidente de transcripción, no otra escala.
  catalogo <- .graficos_collect_palette_lists(list(
    docentes = inst_de("lst_p9", 1:2, c("De Acuerdo", "En Desacuerdo")),
    egresados = inst_de("lst_p9", 1:2, c("De acuerdo", "en  desacuerdo"))
  ))

  expect_equal(length(catalogo), 1L)
  expect_equal(as.character(catalogo[[1]]$fuentes), c("docentes", "egresados"))
})

test_that("el mismo juego de etiquetas con otro código comparte paleta", {
  # Una paleta mapea ETIQUETA -> color. Separar por código duplicaría dos
  # tarjetas idénticas que además guardan en la misma clave.
  catalogo <- .graficos_collect_palette_lists(list(
    docentes = inst_de("lst_p7", c(1, 2), c("Sí", "No")),
    egresados = inst_de("lst_p7", c(10, 20), c("Sí", "No"))
  ))

  expect_equal(length(catalogo), 1L)
})

test_that("un proyecto de base única no cambia de forma", {
  catalogo <- .graficos_collect_palette_lists(
    inst_de("lst_p1", 1:2, c("Sí", "No"))
  )

  expect_equal(length(catalogo), 1L)
  expect_equal(catalogo[[1]]$list_name, "lst_p1")
  expect_equal(catalogo[[1]]$escala_id, "lst_p1")
  expect_equal(vapply(catalogo[[1]]$choices, function(c) c$label, ""), c("Sí", "No"))
})
