# B1 del GOAL motor PPT (carril L8): get_categorias abortaba con
# "subscript out of bounds" cuando la entrada de orders_list era un vector
# plano en vez de list(names, labels) — formato informal que circula en
# fixtures y overrides manuales. La lamina entera degradaba a "Sin datos".

test_that("get_categorias acepta la entrada canonica list(names, labels)", {
  survey <- data.frame(
    name = "p1", type = "select_one sat5", list_name = "sat5",
    stringsAsFactors = FALSE
  )
  cats <- get_categorias(
    var = "p1",
    data = data.frame(p1 = c("1", "2"), stringsAsFactors = FALSE),
    survey = survey,
    orders_list = list(sat5 = list(names = c("1", "2", "3"),
                                   labels = c("Bajo", "Medio", "Alto")))
  )
  expect_identical(cats$codes, c("1", "2", "3"))
  expect_identical(cats$labels, c("Bajo", "Medio", "Alto"))
})

test_that("get_categorias no aborta con una entrada de orders_list de vector plano", {
  survey <- data.frame(
    name = "p1", type = "select_one sat5", list_name = "sat5",
    stringsAsFactors = FALSE
  )
  cats <- get_categorias(
    var = "p1",
    data = data.frame(p1 = c("1", "2"), stringsAsFactors = FALSE),
    survey = survey,
    orders_list = list(sat5 = c("1", "2", "3"))
  )
  expect_identical(cats$codes, c("1", "2", "3"))
  # sin labels declarados, los codigos hacen de label
  expect_identical(cats$labels, c("1", "2", "3"))
})

test_that("get_categorias interpreta el vector nombrado como codigo -> label", {
  survey <- data.frame(
    name = "p1", type = "select_one sat5", list_name = "sat5",
    stringsAsFactors = FALSE
  )
  cats <- get_categorias(
    var = "p1",
    data = data.frame(p1 = c("1", "2"), stringsAsFactors = FALSE),
    survey = survey,
    orders_list = list(sat5 = c("1" = "Bajo", "2" = "Medio", "3" = "Alto"))
  )
  expect_identical(cats$codes, c("1", "2", "3"))
  expect_identical(cats$labels, c("Bajo", "Medio", "Alto"))
})

test_that(".radar_build_box sobrevive a un orders_list de vectores planos", {
  likert <- c("Bajo", "Medio", "Alto")
  df <- data.frame(
    p1 = c("Alto", "Alto", "Medio", "Bajo"),
    p2 = c("Medio", "Alto", "Alto", "Alto"),
    stringsAsFactors = FALSE
  )
  survey <- data.frame(
    name = c("p1", "p2"),
    type = rep("select_one lst_lik", 2),
    list_name = rep("lst_lik", 2),
    label = c("Pregunta uno", "Pregunta dos"),
    stringsAsFactors = FALSE
  )
  d <- .radar_build_box(
    vars = c("p1", "p2"), cruce = NULL,
    box_labels = "Alto", titulo_tabla = "Top box",
    data = df, survey = survey,
    orders_list = list(lst_lik = likert)
  )
  expect_true(is.data.frame(d))
  expect_true(nrow(d) >= 2L)
})
