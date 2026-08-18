# El ritmo diario de la recoleccion.
#
# Aulas no tenia NINGUNA serie temporal: el tablero decia cuanto se lleva y
# cuanto falta, y en ninguna pantalla se veia como se llego ahi.

.mar_resp <- function(fechas) data.frame(`_submission_time` = fechas, check.names = FALSE)

test_that("un dia sin campo sale en cero y no se salta", {
  # El control del calendario: entre el 10 y el 13 hubo dos dias sin trabajar.
  # Saltarlos daria una serie de tres puntos que se lee como tres dias seguidos
  # de campo, y comprime un operativo intermitente hasta parecer continuo.
  r <- monitoreo_aulas_ritmo_diario(
    .mar_resp(c("2026-08-10T09:00:00", "2026-08-13T10:00:00")),
    c(TRUE, TRUE), meta = 10
  )
  expect_length(r$dias, 4L)
  expect_identical(vapply(r$dias, function(d) d$fecha, character(1)),
                   c("2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"))
  expect_identical(vapply(r$dias, function(d) d$validas, integer(1)), c(1L, 0L, 0L, 1L))
  expect_identical(r$dias_con_campo, 2L)
})

test_that("el acumulado corre y no se reinicia en los dias vacios", {
  r <- monitoreo_aulas_ritmo_diario(
    .mar_resp(c("2026-08-10T09:00:00", "2026-08-10T10:00:00", "2026-08-12T09:00:00")),
    rep(TRUE, 3), meta = 10
  )
  expect_identical(vapply(r$dias, function(d) d$acumulado, integer(1)), c(2L, 2L, 3L))
})

test_that("la media va sobre los dias CON campo, no sobre el calendario", {
  # Tres respuestas en dos dias de campo dentro de un calendario de cuatro. La
  # media real de una jornada es 1.5, no 0.75: dividir entre los dias muertos da
  # un ritmo al que ningun dia se parecio, y ese numero se usa para juzgar si lo
  # que falta alcanza.
  r <- monitoreo_aulas_ritmo_diario(
    .mar_resp(c("2026-08-10T09:00:00", "2026-08-10T10:00:00", "2026-08-13T09:00:00")),
    rep(TRUE, 3), meta = 10
  )
  expect_identical(r$dias_con_campo, 2L)
  expect_equal(r$media_diaria, 1.5)
})

test_that("solo cuentan las respuestas validas", {
  r <- monitoreo_aulas_ritmo_diario(
    .mar_resp(c("2026-08-10T09:00:00", "2026-08-10T10:00:00")),
    c(TRUE, FALSE), meta = 10
  )
  expect_identical(r$dias[[1]]$validas, 1L)
})

test_that("sin columna de fecha no se inventa una serie plana", {
  # El control de la ausencia: devolver un unico dia con las 3700 dentro seria
  # inventarse el calendario del operativo, y el grafico lo dibujaria como si
  # todo hubiera entrado el mismo dia.
  r <- monitoreo_aulas_ritmo_diario(data.frame(a = 1:3), rep(TRUE, 3), meta = 10)
  expect_length(r$dias, 0L)
  expect_identical(r$dias_con_campo, 0L)
})

test_that("el mejor dia es el de mas validas, no el ultimo", {
  r <- monitoreo_aulas_ritmo_diario(
    .mar_resp(c(rep("2026-08-10T09:00:00", 5), "2026-08-11T09:00:00")),
    rep(TRUE, 6), meta = 10
  )
  expect_identical(r$mejor_dia$fecha, "2026-08-10")
  expect_identical(r$mejor_dia$validas, 5L)
})

test_that("el ritmo llega al tablero con su meta", {
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "CH 1", classroom_id = "u1", collection_unit_id = "u1",
         label = "A", course_name = "C1", faculty = "Derecho", sample_role = "titular",
         eligible_n = 30, expected_valid = 21, sample_status = "agendada")
  ))
  respuestas <- data.frame(
    collectorID = rep("u1", 3),
    `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00", "2026-08-11T09:00:00"),
    check.names = FALSE
  )
  d <- monitoreo_aulas_dashboard(plan, respuestas, list(enabled = TRUE, plan = plan))

  expect_length(d$ritmo_diario$dias, 2L)
  expect_identical(d$ritmo_diario$meta, 21)
})
