source("setup-load-all.R")

# La figura del Word de una dona lleva su base (CCSS v6.2: 4 de 91 figuras, todas donas, salían sin «Base: …»).

test_that("la marca de figura del Word vale sólo mientras se calcula esa base", {
  expect_false(.base_es_para_word())
  dentro <- .base_para_word(.base_es_para_word())
  expect_true(dentro)
  expect_false(.base_es_para_word())
})

test_that("la marca se restaura aunque el cálculo falle", {
  expect_error(.base_para_word(stop("x")), "x")
  expect_false(.base_es_para_word())
})

test_that("el PPT sigue suprimiendo la base de donas y pies; el Word no", {
  src <- paste(readLines(test_path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE), collapse = "\n")
  expect_true(grepl('etype %in% c("barras_categoricas", "pie", "donut") && !(.base_es_para_word() && etype %in% c("pie", "donut"))', src, fixed = TRUE))
  expect_true(grepl(".base_para_word(.base_auto_from_element(el, sufijo_auto = suf, formato = fmt))", src, fixed = TRUE))
})
