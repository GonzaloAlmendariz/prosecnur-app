test_that("pivot_enum_x_corte arma columnas dinamicas y totales correctos", {
  df <- tibble::tibble(
    enumerador = c("Ana", "Ana", "Luis", "Mia", "Mia", "Mia"),
    sexo = c("F", "M", "M", "F", "F", NA_character_)
  )

  tab <- prosecnur:::pivot_enum_x_corte(
    data = df,
    col_enumerador = "enumerador",
    col_corte = "sexo",
    min_encuestas = 0,
    ordenar_por = "total"
  )

  expect_true(all(c("enumerador", "F", "M", "(Sin dato)", "TOTAL") %in% names(tab)))
  expect_identical(tab$enumerador[[nrow(tab)]], "TOTAL")

  sin_total <- tab[tab$enumerador != "TOTAL", , drop = FALSE]
  total_row <- tab[tab$enumerador == "TOTAL", , drop = FALSE]

  expect_equal(total_row$TOTAL[[1]], sum(sin_total$TOTAL))
  expect_equal(total_row$F[[1]], sum(sin_total$F))
  expect_equal(total_row$M[[1]], sum(sin_total$M))
  expect_equal(total_row$`(Sin dato)`[[1]], sum(sin_total$`(Sin dato)`))
})

test_that("pivot_enum_x_corte aplica filtro min_encuestas y mantiene fila TOTAL", {
  df <- tibble::tibble(
    enumerador = c("A", "A", "B", "C"),
    aula = c("101", "102", "101", "102")
  )

  tab <- prosecnur:::pivot_enum_x_corte(
    data = df,
    col_enumerador = "enumerador",
    col_corte = "aula",
    min_encuestas = 2,
    ordenar_por = "nombre"
  )

  expect_true(all(c("A", "TOTAL") %in% tab$enumerador))
  expect_false(any(tab$enumerador == "B"))
  expect_false(any(tab$enumerador == "C"))
  expect_identical(tab$enumerador[[nrow(tab)]], "TOTAL")
})

test_that("pivot_enum_resumen soporta caso vacio y retorna TOTAL=0", {
  df <- tibble::tibble(enumerador = character(0))

  tab <- prosecnur:::pivot_enum_resumen(
    data = df,
    col_enumerador = "enumerador",
    min_encuestas = 0,
    ordenar_por = "total"
  )

  expect_identical(nrow(tab), 1L)
  expect_identical(tab$enumerador[[1]], "TOTAL")
  expect_identical(tab$TOTAL[[1]], 0)
})

