read_catalogo <- function(file) {
  path <- system.file("catalogos", file, package = "prosecnurapp")
  expect_true(nzchar(path), info = paste("No se encontro", file))
  jsonlite::fromJSON(path, simplifyVector = FALSE)
}

pluck_chr <- function(x, key) {
  vapply(x, function(item) item[[key]], character(1))
}

test_that("tabla maestra 2024-2026 declara ruta del evaluador de muestra", {
  tabla <- read_catalogo("tabla_maestra_estudios.json")
  estudios <- tabla$estudios

  required <- c(
    "codigo",
    "anio",
    "familia_estudio",
    "metodologia_principal",
    "metodologias_secundarias",
    "dominio",
    "es_recurrente",
    "requiere_calculo_muestra",
    "origen_muestra",
    "accion_evaluador_muestra",
    "elementos_comunes",
    "nivel_evidencia"
  )

  for (field in required) {
    expect_true(
      all(vapply(estudios, function(e) !is.null(e[[field]]), logical(1))),
      info = paste("Falta campo", field)
    )
  }

  expect_equal(length(estudios), 35L)
  expect_true(all(pluck_chr(estudios, "requiere_calculo_muestra") %in% c("si", "no", "parcial")))
  expect_true(all(pluck_chr(estudios, "nivel_evidencia") %in% c("alto", "medio", "limitado")))
})

test_that("familias, origenes y acciones existen en sus catalogos canonicos", {
  tabla <- read_catalogo("tabla_maestra_estudios.json")
  tipos <- read_catalogo("catalogo_tipos_estudio.json")

  familias <- pluck_chr(tipos$familias_estudio, "id")
  acciones <- pluck_chr(tipos$acciones_evaluador_muestra, "id")
  origenes <- pluck_chr(tipos$origenes_muestra, "id")

  expect_true(all(pluck_chr(tabla$estudios, "familia_estudio") %in% familias))
  expect_true(all(pluck_chr(tabla$estudios, "accion_evaluador_muestra") %in% acciones))
  expect_true(all(pluck_chr(tabla$estudios, "origen_muestra") %in% origenes))
})

test_that("acreditaciones son una sola familia y no fuerzan calculo muestral puro", {
  tabla <- read_catalogo("tabla_maestra_estudios.json")
  acreditaciones <- Filter(function(e) e$dominio == "acreditacion_actores", tabla$estudios)

  expect_gt(length(acreditaciones), 0L)
  expect_setequal(unique(pluck_chr(acreditaciones, "familia_estudio")), "acreditacion_programa")
  expect_false(any(pluck_chr(acreditaciones, "accion_evaluador_muestra") == "calcular_muestra"))
  expect_true(all(pluck_chr(acreditaciones, "requiere_calculo_muestra") %in% c("no", "parcial")))
})

test_that("estudios con muestra o meta recibida no se mandan a recalcular desde cero", {
  tabla <- read_catalogo("tabla_maestra_estudios.json")
  estudios <- tabla$estudios
  no_calculo <- Filter(function(e) e$requiere_calculo_muestra == "no", estudios)
  meta_contractual <- Filter(function(e) e$origen_muestra == "meta_contractual", estudios)

  expect_gt(length(no_calculo), 0L)
  expect_false(any(pluck_chr(no_calculo, "accion_evaluador_muestra") == "calcular_muestra"))
  expect_false(any(pluck_chr(meta_contractual, "accion_evaluador_muestra") == "calcular_muestra"))
})

test_that("mediciones recurrentes quedan marcadas como recurrentes", {
  tabla <- read_catalogo("tabla_maestra_estudios.json")
  recurrentes <- Filter(function(e) {
    identical(e$metodologia_principal, "medicion_recurrente") ||
      "medicion_recurrente" %in% unlist(e$metodologias_secundarias, use.names = FALSE)
  }, tabla$estudios)

  expect_gt(length(recurrentes), 0L)
  expect_true(all(vapply(recurrentes, function(e) isTRUE(e$es_recurrente), logical(1))))
})
