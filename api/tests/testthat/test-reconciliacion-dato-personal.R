# Ítem 21, ronda 2 (decisión de Gonzalo, 2026-11-12): en la reconciliación, una
# columna que parece dato personal viene SIN marcar aunque tenga dato, con el
# rótulo "Dato potencialmente personal identificado" y su causa. Se identifica
# por contenido y por nombre en una sola función del motor.

.dp <- function(nombre, x) .reconciliacion_dato_personal(nombre, x)

test_that("teléfonos por contenido: 9 dígitos que empiezan con 9, con o sin prefijo 51", {
  x <- c("974526862", "991676976", "+51 944282211", "906438868", NA, "")
  r <- .dp("contacto", x)
  expect_true(r$sospecha)
  expect_identical(r$causa, "Parece teléfono: 9 dígitos en el 100 % de los casos con dato")
  r2 <- .dp("cel", c(974526862, 991676976, 944282211, 12, 906438868))
  expect_true(r2$sospecha)
  expect_match(r2$causa, "en el 80 % de los casos con dato", fixed = TRUE)
})

test_that("DNI por contenido: 8 dígitos", {
  r <- .dp("doc_x", c("42843104", "42158870", "10345059", "73374632"))
  expect_true(r$sospecha)
  expect_identical(r$causa, "Parece DNI: 8 dígitos en el 100 % de los casos con dato")
})

test_that("correos, direcciones, nombres y coordenadas por contenido", {
  expect_match(.dp("c1", c("ana@x.pe", "luis.r@correo.com", "z@y.org"))$causa, "^Parece correo")
  dir <- .dp("lugar", c("AV. LOS ALAMOS 123", "JR MARAÑON - C6", "CALLE LIMA 450", "PSJE SANTA ROSA", "MZ F LT 8"))
  expect_true(dir$sospecha)
  expect_match(dir$causa, "^Parece dirección")
  nom <- .dp("persona", c("JADE BUSTOS ALTAMIRANO", "MARIA GARCIA MENDOZA", "Moises Oliva", "CEILO YANIETH CAMPOS MEJIA"))
  expect_true(nom$sospecha)
  expect_match(nom$causa, "^Parece nombre de persona")
  expect_match(.dp("pt", c(-12.046374, -12.04821, -13.51912))$causa, "^Parece coordenada")
})

test_that("el nombre de la columna basta cuando el contenido no lo dice", {
  r <- .dp("direccion", c("SAN PEDRO", "LAS FLORES", "JR MARAÑON - C6", "SANTA ROSA"))
  expect_true(r$sospecha)
  expect_identical(r$causa, "Su nombre sugiere dirección")
  expect_true(.dp("telefono_fijo", c(NA, NA))$sospecha)
})

test_that("no son datos personales: ubigeo, número de encuesta, fechas, horas, códigos y texto libre", {
  expect_false(.dp("ubigeo", c("210610", "80104", "080401", "220401"))$sospecha)
  expect_false(.dp("nro_encuesta", c(239, 495, 396, 802))$sospecha)
  expect_false(.dp("fecha", c("23.10.2026", "08.11.2026", "21.10.2026"))$sospecha)
  # Fecha compacta AAAAMMDD (export de la plataforma): 8 dígitos, pero no es DNI.
  expect_false(.dp("kobo_fecha_iso", c("20260613", "20260701", "20260615", "20260630"))$sospecha)
  expect_true(.dp("documento_x", c("40123456", "07894561", "45678912", "10293847"))$sospecha)
  expect_false(.dp("hora_inicio", c("18.20", "15.15", "07.59"))$sospecha)
  expect_false(.dp("am_pm", c(1, 2, 1, 2))$sospecha)
  expect_false(.dp("distrito", c("ANDAHUAYLILLAS", "YUCAY", "COMAS", "CALCA"))$sospecha)
  expect_false(.dp("urbanizacion", c("URB VILCAMPA", "ZONA A", "3ERA ZONA COLLIQUE - COMAS", "PADERAS DEL RIMAC"))$sospecha)
  expect_false(.dp("obs_entrevistador", c("CASA EN ESQUINA ENCUESTADO POR JR MOLLENDO PUERTA PLOMA", "JOVEN ESTUDIANTE DE SISTEMAS EN LA UCV", "LLENA LA ENCUESTA MIENTRAS CUIDA A SUS HIJOS"))$sospecha)
  vacia <- .dp("x", c(NA, ""))
  expect_false(vacia$sospecha)
  expect_identical(vacia$causa, "")
})

test_that("el cubo de reconciliación y la revisión de Carga publican la sospecha por columna", {
  inst <- list(survey = data.frame(type = "text", name = "id", stringsAsFactors = FALSE))
  data <- data.frame(
    id = 1:4,
    telefono = c("974526862", "991676976", "944282211", "906438868"),
    zona = c("A", "B", "A", "C"),
    stringsAsFactors = FALSE
  )
  ex <- .reconciliacion_variables_extra(data, inst)
  expect_true(all(c("personal_sospecha", "personal_causa") %in% names(ex)))
  expect_true(ex$personal_sospecha[ex$name == "telefono"])
  expect_false(ex$personal_sospecha[ex$name == "zona"])
  rec <- .carga_review_reconciliation(ex, character(), character())
  tel <- rec$extra[[match("telefono", vapply(rec$extra, `[[`, character(1), "name"))]]
  expect_true(tel$personal$sospecha)
  expect_match(tel$personal$causa, "^Parece teléfono")
})
