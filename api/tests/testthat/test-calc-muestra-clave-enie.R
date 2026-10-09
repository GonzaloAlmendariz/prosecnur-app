# La eñe no puede partir una clave en dos.
#
# `.cm_aulas_text_key()` normaliza con `iconv(ASCII//TRANSLIT)`, que en macOS
# traduce «ñ» a «~n»; el «~» caía después en `[^a-z0-9]+` como separador y
# «ARTE Y DISEÑO» daba `arte_y_dise_no`. Como TRANSLIT depende de la
# plataforma, la misma facultad podía tener una clave en un Mac y otra en el
# Linux del CI.
#
# Medido en la app el 2026-08-25 sobre HSVG 2026: el catálogo de criterios
# publicaba `arte_y_dise_no`, la UI guardaba el mínimo por facultad con esa
# clave, y el motor lo buscaba con `arte_y_diseno`. El mínimo se ignoraba en
# silencio —sin aviso ni error— justo en una de las facultades con más
# diferencia contra el documento metodológico.

test_that("la enie se normaliza a n sin separador", {
  expect_identical(.cm_aulas_text_key("ARTE Y DISEÑO"), "arte_y_diseno")
  expect_identical(.cm_aulas_text_key("DISEÑO"), "diseno")
  expect_identical(.cm_aulas_text_key("AÑO"), "ano")
  expect_identical(.cm_aulas_text_key("MAÑANA"), "manana")
  expect_identical(.cm_aulas_text_key("ñandú"), "nandu")
})

test_that("los dos normalizadores de clave coinciden", {
  # `.cm_criterios_fac_key()` ya hacía la sustitución y `.cm_aulas_text_key()`
  # no: esa discrepancia es la que perdía el mínimo. Deben dar lo mismo.
  for (x in c("ARTE Y DISEÑO", "AÑO", "PSICOLOGÍA", "GASTRONOMÍA, HOTELERÍA Y TURISMO",
              "CIENCIAS Y ARTES DE LA COMUN.", "ESTUDIOS GENERALES LETRAS")) {
    expect_identical(.cm_aulas_text_key(x), .cm_criterios_fac_key(x),
                     info = paste("discrepan en:", x))
  }
})

test_that("el resto de la normalizacion no cambia", {
  expect_identical(.cm_aulas_text_key("  Hola   Mundo  "), "hola_mundo")
  expect_identical(.cm_aulas_text_key("PSICOLOGÍA"), "psicologia")
  expect_identical(.cm_aulas_text_key("CIENCIAS Y ARTES DE LA COMUN."), "ciencias_y_artes_de_la_comun")
  expect_identical(.cm_aulas_text_key(NA), "")
  expect_identical(.cm_aulas_text_key(""), "")
})

test_that("el minimo por facultad de una facultad con enie SI casa", {
  # La prueba de punta a punta del defecto: la clave que publica el catálogo y
  # la que resuelve el motor tienen que ser la misma.
  cfg <- calc_muestra_aulas_normalize_config(list(criterios_seleccion = list(
    byVariable = list(),
    minEligible = list(byFaculty = stats::setNames(list(10), .cm_aulas_text_key("ARTE Y DISEÑO")))
  )))
  bf <- cfg$criterios_seleccion$minEligible$byFaculty
  expect_true(.cm_criterios_fac_key("ARTE Y DISEÑO") %in% names(bf))
})
