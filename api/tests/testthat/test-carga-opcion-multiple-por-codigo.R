# Ítem 20 del checklist de Validación (2026-11-12): una pregunta de opción
# múltiple puede llegar con una columna por opción marcada con el CÓDIGO de esa
# opción (`p10/3` vale 3 o queda vacía) en lugar de 0/1. El normalizador solo
# aceptaba 0/1 y reconstruía la madre con la opción 1: el caso que vive con mamá,
# hermanos y tíos quedaba como "Mamá". Una columna de opción que no se puede
# leer se avisa con su causa; nunca se descarta en silencio.

.inst_p10 <- function() {
  list(
    survey = data.frame(
      type = "select_multiple lista_p10",
      name = "p10",
      list_name = "lista_p10",
      label = "¿Con quiénes vives?",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lista_p10",
      name = c("1", "2", "3", "4", "77"),
      label = c("Mamá", "Papá", "Hermanos", "Tíos", "Otro"),
      stringsAsFactors = FALSE
    )
  )
}

test_that("columnas 0/1 siguen reconstruyendo la madre igual que antes", {
  raw <- data.frame(
    `p10/1` = c(1, 0, 1), `p10/2` = c(0, 1, 0), `p10/3` = c(1, 0, NA),
    `p10/4` = c(1, 0, 0), `p10/77` = c(0, 0, 0),
    check.names = FALSE
  )
  out <- normalize_data_for_xlsform(raw, .inst_p10())
  expect_equal(as.character(out$p10), c("1 3 4", "2", "1"))
  expect_length(attr(out, "xlsform_normalized")$opciones_sin_leer %||% list(), 0L)
})

test_that("columnas marcadas con el código de la opción (o vacías) reconstruyen todas las opciones", {
  raw <- data.frame(
    `p10/1` = c(1, NA, NA), `p10/2` = c(NA, 2, NA), `p10/3` = c(3, NA, NA),
    `p10/4` = c(4, NA, NA), `p10/77` = c(NA, NA, 77),
    check.names = FALSE
  )
  out <- normalize_data_for_xlsform(raw, .inst_p10())
  expect_equal(as.character(out$p10), c("1 3 4", "2", "77"))
  expect_false(any(grepl("^p10/", names(out))))
  expect_length(attr(out, "xlsform_normalized")$opciones_sin_leer %||% list(), 0L)
})

test_that("0 o código también se lee como no marcada o marcada", {
  raw <- data.frame(
    `p10/1` = c(0, 1, 0), `p10/2` = c(2, 0, 0), `p10/3` = c(0, 0, 3),
    `p10/4` = c(0, 0, 0), `p10/77` = c("077", "0", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out <- normalize_data_for_xlsform(raw, .inst_p10())
  expect_equal(as.character(out$p10), c("2 77", "1", "3"))
})

test_that("una columna de opción con valores que no se pueden leer se avisa con su causa y no se pierde", {
  raw <- data.frame(
    `p10/1` = c(1, NA, NA), `p10/2` = c(NA, 2, NA),
    `p10/3` = c(3, 1, NA), # mezcla: 1 no es marca de la opción 3 ni su código
    `p10/4` = c(4, NA, 9), # 9 no es el código de la opción 4
    `p10/77` = c(NA, NA, 77),
    check.names = FALSE
  )
  out <- normalize_data_for_xlsform(raw, .inst_p10())
  avisos <- attr(out, "xlsform_normalized")$opciones_sin_leer
  expect_length(avisos, 2L)
  cols <- vapply(avisos, `[[`, character(1), "columna")
  expect_setequal(cols, c("p10/3", "p10/4"))
  a3 <- avisos[[match("p10/3", cols)]]
  expect_identical(a3$variable, "p10")
  expect_identical(a3$codigo, "3")
  expect_true(all(c("1", "3") %in% a3$valores))
  expect_match(a3$causa, "3", fixed = TRUE)
  # Las columnas sin leer se conservan en la base y no entran a la madre por orden.
  expect_true(all(c("p10/3", "p10/4") %in% names(out)))
  expect_equal(as.character(out$p10), c("1", "2", "77"))
})

test_that("una columna con el código de una opción que no está en la lista se avisa y no se asigna por posición", {
  raw <- data.frame(
    `p10/1` = c(1, NA), `p10/2` = c(NA, 2), `p10/3` = c(NA, NA),
    `p10/4` = c(NA, NA), `p10/77` = c(NA, NA), `p10/88` = c(88, NA),
    check.names = FALSE
  )
  out <- normalize_data_for_xlsform(raw, .inst_p10())
  avisos <- attr(out, "xlsform_normalized")$opciones_sin_leer
  expect_length(avisos, 1L)
  expect_identical(avisos[[1]]$columna, "p10/88")
  expect_match(avisos[[1]]$causa, "88", fixed = TRUE)
  expect_equal(as.character(out$p10), c("1", "2"))
  expect_true("p10/88" %in% names(out))
})

test_that("Revisión de Carga publica las columnas de opción sin leer con su causa", {
  avisos <- list(
    .dn_sm_option_aviso("p10", "p10/3", "3", c(3, 1, NA), "valores"),
    .dn_sm_option_aviso("p10", "p10/88", "88", c(88, NA), "fuera_de_lista")
  )
  data <- structure(data.frame(id = 1:3), xlsform_normalized = list(opciones_sin_leer = avisos))
  out <- .carga_review_opciones_sin_leer(data)
  expect_identical(out$n, 2L)
  expect_identical(vapply(out$columnas, `[[`, character(1), "columna"), c("p10/3", "p10/88"))
  expect_identical(out$columnas[[1]]$n_con_dato, 2L)
  expect_match(out$columnas[[1]]$causa, "Trae los valores 1, 3", fixed = TRUE)
  expect_match(out$columnas[[2]]$causa, "no es una opción de la lista de p10", fixed = TRUE)
  expect_null(.carga_review_opciones_sin_leer(data.frame(id = 1)))
})
