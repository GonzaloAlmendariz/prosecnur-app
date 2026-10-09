source("setup-load-all.R")

# H67 (docs/qa/checklist-motor-ppt-diagnostico-2026-10-06.md): la base limpia de Derecho 2025 guarda la opcion multiple
# como dummies de SPSS en mayusculas (P6_1 ... P6_7 con 1 o vacio) y el texto de «Otro» en P6_O. El importador de
# Procesamiento (normalize_data_for_xlsform, camino de POST /api/carga/data) no reconstruia `p6` porque el prefijo se
# comparaba distinguiendo mayusculas, y P6_O no llegaba a `p6_other`: todo grafico de opcion multiple salia «Sin datos».

inst_p6 <- function() list(
  survey = data.frame(name = c("p2", "p2_other", "p6", "p6_other"), type = c("select_one l2", "text", "select_multiple l6", "text"),
                      list_name = c("l2", NA, "l6", NA), label = c("Sede", "Otra sede", "Medios", "Otro medio"),
                      relevant = c(NA, "${p2} = 'other'", NA, "selected(${p6}, 'other')"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("l2", "l2", "l6", "l6", "l6", "l6"), name = c("1", "other", "1", "2", "3", "other"),
                       label = c("Lima", "Otra", "Web", "Correo", "Redes", "Otro"), stringsAsFactors = FALSE))

base_spss <- function() data.frame(P2 = c("1", "other", "1", "1"), P2_O = c("", "Arequipa", "", ""),
  P6_1 = c(1, NA, 1, NA), P6_2 = c(NA, 1, 1, NA), P6_3 = c(NA, NA, NA, NA), P6_O = c("", "", "", "radio"), stringsAsFactors = FALSE)

test_that("las dummies de SPSS en mayúsculas reconstruyen la opción múltiple (H67)", {
  out <- normalize_data_for_xlsform(base_spss(), inst_p6())
  expect_true("p6" %in% names(out))
  expect_equal(trimws(as.character(out$p6[1:3])), c("1", "2", "1 2"))
  expect_false(any(c("P6_1", "P6_2", "P6_3") %in% names(out)))
})

test_that("el texto de «Otro» en <VAR>_O llega a <var>_other y marca la opción (H67)", {
  out <- normalize_data_for_xlsform(base_spss(), inst_p6())
  expect_true(all(c("p6_other", "p2_other") %in% names(out)))
  expect_equal(as.character(out$p6_other[4]), "radio")
  expect_equal(as.character(out$p2_other[2]), "Arequipa")
  expect_true(grepl("\\bother\\b", as.character(out$p6[4])))   # quien escribió en «Otro» marcó la opción
})

test_that("las dummies en minúsculas siguen funcionando igual", {
  d <- data.frame(p6_1 = c(1, 0, 1), p6_2 = c(0, 1, 1), p6_3 = c(0, 0, 0))
  out <- normalize_data_for_xlsform(d, inst_p6())
  expect_equal(trimws(as.character(out$p6)), c("1", "2", "1 2"))
})
