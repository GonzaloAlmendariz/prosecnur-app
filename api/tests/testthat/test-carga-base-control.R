# Lector de «Base de control». Fixture sintetica: el libro real trae aplicadores
# con nombre y apellido. Se fija la anatomia, no los datos.

.cbc_titulos <- c(
  "MUESTRA", "CURSO-HORARIO", "NOMBRE DEL CURSO", "AULA", "HORARIO",
  "MATRICULADOS TOTALES", "MATRICULADOS POBLACIÓN", "FECHA AGENDADA", "HORA",
  "APLICADOR", "FECHA DE APLICACIÓN", "HORA DE APLICACIÓN", "STATUS DE APLICACIÓN",
  "TOTAL ENVIADAS", "VS TOTAL", "VS POBLACIÓN", "VALIDADOR 1", "VALIDADOR 2",
  "VALIDADOR 3", "TOTAL CORTAS", "CORTAS VS TOTAL", "TOTAL LARGAS",
  "LARGAS VS TOTAL", "70T", "70P", "VALIDO TOTAL", "VALIDO POBLACIÓN",
  "ÚLTIMO DÍA DE RESPUESTA", "N° ASISTENTES EN AULA",
  "N° ASISTENTES QUE NO RESPONDIERON", "ASISTENCIA (%)", "CUOTA (%)",
  "FALTANTES CUOTA", "N° MUJERES", "N° HOMBRES", "MUJERES (%)", "HOMBRES (%)",
  "NORM - HORARIO", "RANGO - HORARIO"
)

.cbc_fila <- function(code = "DEE218-0211", valido = "NO CUMPLE") c(
  "Muestra 01", code, "DERECHOS FUNDAMENTALES", "D102", "LUN 08:30-10:30",
  "42", "42", "08/09/2025", "10:15", "Aplicador Demo", "08/09/2025", "10:21",
  "APLICADA", "28", "0.6666", "0.6666", "0", "1", "0", "1", "0.0357", "27",
  "0.9642", "30", "30", valido, valido, "13/09/2025", "30", "2", "0.71",
  "0.66", "4", "18", "12", "0.6", "0.4", "08:30", "MAÑANA"
)

test_that("los seis grupos de control llegan al modelo", {
  df <- as.data.frame(rbind(.cbc_fila()), stringsAsFactors = FALSE)
  f <- base_control_a_filas(df, .cbc_titulos)$filas[[1]]

  expect_identical(f$operational_code, "DEE218-0211")
  expect_equal(f$sent_total, 28)
  expect_equal(f$short_total, 1)
  expect_equal(f$long_total, 27)
  expect_equal(f$threshold_total, 30)
  expect_identical(f$valid_total, "NO CUMPLE")
  expect_equal(f$observed_students, 30)
  expect_equal(f$non_respondents, 2)
  expect_equal(f$women_n, 18)
  expect_equal(f$men_n, 12)
  expect_identical(f$schedule_range, "MAÑANA")
})

test_that("una cabecera incompleta se REPORTA, no se adivina", {
  # El estudio real trae siete columnas con datos y sin nombre en la fila 2.
  # Bautizarlas a ojo seria peor que declararlas ausentes.
  titulos <- .cbc_titulos
  titulos[c(30, 31)] <- NA_character_
  res <- base_control_mapa(titulos)

  # El control: `.caa_key(NA)` devuelve el texto "NA" y pasa `nzchar()`, asi que
  # sin el filtro explicito esto valia 0.
  expect_true(all(c(30L, 31L) %in% res$sin_nombre))
})

test_that("cada titulo consume su columna y no la reusa", {
  # `HORA` aparece dos veces en la hoja real (agendada y de aplicacion). El
  # mapeo no puede asignar la misma columna a dos campos.
  df <- as.data.frame(rbind(.cbc_fila()), stringsAsFactors = FALSE)
  res <- base_control_mapa(.cbc_titulos)
  cols <- unlist(res$mapa, use.names = FALSE)
  expect_identical(anyDuplicated(cols), 0L)
  f <- base_control_a_filas(df, .cbc_titulos)$filas[[1]]
  expect_identical(f$scheduled_time, "10:15")
  expect_identical(f$applied_time, "10:21")
})

test_that("una fila sin curso-horario no produce control", {
  vacia <- .cbc_fila(code = "")
  df <- as.data.frame(rbind(.cbc_fila(), vacia), stringsAsFactors = FALSE)
  expect_length(base_control_a_filas(df, .cbc_titulos)$filas, 1L)
})
