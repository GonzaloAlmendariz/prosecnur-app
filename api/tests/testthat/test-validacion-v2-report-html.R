# =============================================================================
# Tests para build_report_html (Sprint 5 — stretch)
# =============================================================================
# Genera el reporte HTML autocontenido que se exporta desde el Limpieza.
# Estos tests validan que el HTML producido sea sintácticamente correcto
# (doctype, head/body), incluya las secciones esperadas, escape HTML
# malicioso (XSS), y maneje el scope vacío sin crashear.

test_that("build_report_html con scope vacío produce HTML completo", {
  html <- build_report_html(list())
  expect_true(grepl("^<!doctype html>", html, ignore.case = TRUE))
  expect_true(grepl("<html lang=\"es\">", html, fixed = TRUE))
  expect_true(grepl("<title>Reporte de validación</title>", html, fixed = TRUE))
  expect_true(grepl("</html>", html, fixed = TRUE))
  # Secciones base siempre presentes
  expect_true(grepl("Progreso", html))
  expect_true(grepl("Indicadores principales", html))
})

test_that("build_report_html incluye nombre de base y estudio cuando se pasan", {
  html <- build_report_html(
    list(),
    base_nombre = "docentes",
    estudio_nombre = "Acreditación PUCP"
  )
  expect_true(grepl("docentes", html, fixed = TRUE))
  expect_true(grepl("Acreditación PUCP", html, fixed = TRUE))
})

test_that("build_report_html refleja top reglas cuando hay evaluación", {
  scope <- list(
    plan_result = list(plan = tibble::tibble(ID = c("R1", "R2"))),
    evaluacion = list(resumen = tibble::tibble(
      id_regla = c("R1", "R2"),
      nombre_regla = c("Regla Alpha", "Regla Beta"),
      n_inconsistencias = c(42L, 8L)
    ))
  )
  html <- build_report_html(scope)
  expect_true(grepl("Regla Alpha", html, fixed = TRUE))
  expect_true(grepl("Regla Beta", html, fixed = TRUE))
  expect_true(grepl("42", html, fixed = TRUE))
})

test_that("build_report_html muestra reglas custom con badge Activa/Ignorada", {
  scope <- list(reglas_custom = list(
    list(id = "rc1", nombre = "Edad válida", tipo = "rango_num",
          activa = TRUE, mensaje = "Edad fuera de rango"),
    list(id = "rc2", nombre = "DNI único", tipo = "duplicados",
          activa = FALSE)
  ))
  html <- build_report_html(scope)
  expect_true(grepl("Edad válida", html, fixed = TRUE))
  expect_true(grepl("DNI único", html, fixed = TRUE))
  expect_true(grepl("Activa", html, fixed = TRUE))
  expect_true(grepl("Ignorada", html, fixed = TRUE))
})

test_that("build_report_html escapa HTML malicioso en nombres (XSS)", {
  scope <- list(reglas_custom = list(
    list(id = "x", nombre = "<script>alert(1)</script>",
          tipo = "no_nulo", activa = TRUE)
  ))
  html <- build_report_html(scope)
  # El script crudo NO debe aparecer — debe quedar escapado.
  expect_false(grepl("<script>alert", html, fixed = TRUE))
  expect_true(grepl("&lt;script&gt;", html, fixed = TRUE))
})

test_that("build_report_html es autocontenido (sin hrefs ni srcs externos)", {
  scope <- list(
    plan_result = list(plan = tibble::tibble(ID = "R1")),
    evaluacion = list(resumen = tibble::tibble(
      id_regla = "R1", nombre_regla = "X", n_inconsistencias = 1L
    ))
  )
  html <- build_report_html(scope)
  # No debe haber referencias a http(s), CDNs, ni <link rel="stylesheet">
  # a archivos externos. El objetivo del export es que funcione offline.
  expect_false(grepl("<link[^>]+rel=[\"']stylesheet[\"'][^>]+href=[\"']http", html, perl = TRUE))
  expect_false(grepl("<script[^>]+src=[\"']http", html, perl = TRUE))
  expect_false(grepl("@import[^;]+http", html, perl = TRUE))
})

test_that("build_report_html progreso refleja los 3 flags correctamente", {
  scope_all <- list(
    plan_result = list(plan = tibble::tibble(ID = "R1")),
    evaluacion = list(resumen = tibble::tibble(
      id_regla = "R1", nombre_regla = "X", n_inconsistencias = 0L
    )),
    reglas_custom = list(list(id = "rc", activa = TRUE))
  )
  html_all <- build_report_html(scope_all)
  # Check-mark unicode en HTML: &#10003; o ✓
  expect_true(grepl("done", html_all, fixed = TRUE))

  # Con scope vacío, todos deberían estar en "pending"
  html_empty <- build_report_html(list())
  expect_true(grepl("pending", html_empty, fixed = TRUE))
})
