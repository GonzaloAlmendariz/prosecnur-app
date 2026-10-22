# Las calculadas (y los cruces) van junto a su variable de origen.

test_that("una calculada se inserta después de la última de sus variables de origen", {
  survey <- data.frame(type = c("integer", "select_one sn", "select_one sn", "text"),
                       name = c("P1", "P2", "P3", "P9"), label = c("Edad", "a", "b", "z"),
                       stringsAsFactors = FALSE)
  fila <- function(n) data.frame(type = "select_one x", name = n, label = n, stringsAsFactors = FALSE)
  out <- .base_variables_insertar_junto_a(survey, list(fila("cruce_edad"), fila("recurrio"), fila("propia")),
                                          c("P1", "P3", ""))
  expect_identical(out$name, c("P1", "cruce_edad", "P2", "P3", "recurrio", "P9", "propia"))
})

test_that("dentro de un grupo repetido la calculada queda al final", {
  survey <- data.frame(type = c("begin_repeat", "integer", "end_repeat", "text"),
                       name = c("hijos", "edad_hijo", "", "P9"), label = "x", stringsAsFactors = FALSE)
  fila <- data.frame(type = "decimal", name = "doble", label = "d", stringsAsFactors = FALSE)
  out <- .base_variables_insertar_junto_a(survey, list(fila), "edad_hijo")
  expect_identical(utils::tail(out$name, 1), "doble")
})

test_that("una calculada que parte de otra calculada queda junto a ella", {
  survey <- data.frame(type = c("integer", "text"), name = c("P8", "P9"), label = "x", stringsAsFactors = FALSE)
  fila <- function(n) data.frame(type = "decimal", name = n, label = n, stringsAsFactors = FALSE)
  out <- .base_variables_insertar_junto_a(survey, list(fila("anios"), fila("cruce_anios")), c("P8", "anios"))
  expect_identical(out$name, c("P8", "anios", "cruce_anios", "P9"))
})

test_that("una recodificada declarada va después de su original y de su «_otro», no al final", {
  # HSyVbG 2026: las *_recod salían al final del libro, las tablas y la base.
  path <- tempfile(fileext = ".xlsx")
  writexl_frames <- list(
    survey = data.frame(type = c("select_one g", "text", "select_multiple e", "text"),
                        name = c("P3", "P3_otro", "P26", "P27"), label = c("G", "Otro", "E", "Z"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("g", "e"), name = c("1", "1"), label = c("Mujer", "Angustia"),
                         stringsAsFactors = FALSE)
  )
  openxlsx::write.xlsx(writexl_frames, path)
  op <- list(list(codigo = "1", etiqueta = "Mujer"))
  decl <- list(retiradas = character(0), calculadas = list(), propias = list(
    list(name = "P3_recod", label = "G (codificada)", tipo = "select_one", opciones = op),
    list(name = "P26_recod", label = "E (codificada)", tipo = "select_multiple", opciones = op),
    list(name = "suelta", label = "S", tipo = "text")
  ))
  out <- .base_variables_frames_adaptados(path, decl)
  expect_identical(as.character(out$survey$name),
                   c("P3", "P3_otro", "P3_recod", "P26", "P26_recod", "P27", "suelta"))
})

test_that("un cruce va al final del bloque de su origen: después de «_otro» y la recodificada", {
  path <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(
    survey = data.frame(type = c("select_one g", "text", "text"), name = c("P3", "P3_otro", "P5"),
                        label = c("G", "Otro", "L"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = "g", name = "1", label = "Mujer", stringsAsFactors = FALSE)
  ), path)
  op <- list(list(codigo = "1", etiqueta = "Mujer"))
  decl <- list(retiradas = character(0),
               propias = list(list(name = "P3_recod", label = "G", tipo = "select_one", opciones = op)),
               calculadas = list(list(nombre = "cruce_identidad", etiqueta = "Identidad", regla = "mapa",
                                      variables = list("P3"), escala = op)))
  out <- .base_variables_frames_adaptados(path, decl)
  expect_identical(as.character(out$survey$name), c("P3", "P3_otro", "P3_recod", "cruce_identidad", "P5"))
})
