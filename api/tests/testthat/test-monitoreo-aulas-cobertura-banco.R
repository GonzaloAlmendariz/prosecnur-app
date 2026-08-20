# El banco no entra en el reparto de cobertura.

test_that("las reservas extra quedan fuera del reparto y se cuentan aparte", {
  # Mismo criterio que `brechas`, que ya las excluye: son aulas adicionales
  # esperando en su estrato, no aulas que alguien vaya a visitar. Contarlas como
  # «sin respuestas» convertia el banco en alarma —73 de las 121 que salian ahi
  # en el fixture— y ademas era la barra mas larga del grafico.
  fila <- function(code, rol, meta, validas) list(
    operational_code = code, classroom_id = code, sample_role = rol, faculty = "DERECHO",
    expected_valid = meta, eligible_n = 30, sample_status = "agendada",
    operational_status = "aplicada", responses_total = validas)

  plan <- c(
    lapply(1:4, function(i) fila(sprintf("CH %d", i), "titular", 10, 0)),
    lapply(1:6, function(i) fila(sprintf("EXTRA %d", i), "extra_reserve_pool", 10, 0))
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())

  reparto <- vapply(d$course_status_cobertura, function(x) x$aulas, integer(1))
  names(reparto) <- vapply(d$course_status_cobertura, function(x) x$clave, character(1))

  # Las 4 titulares, sin respuestas. Las 6 del banco, fuera.
  expect_identical(unname(reparto[["sin_respuestas"]]), 4L)
  expect_identical(sum(reparto), 4L)
  expect_identical(d$course_status_banco, 6L)
  # El total sigue siendo el del plan entero: es la cabecera del panel.
  expect_identical(d$course_status_total, 10L)
})

test_that("«sin meta» tambien se cuenta solo entre las que estan en juego", {
  # Una reserva del banco sin meta declarada no es un dato que falte: es que no
  # le toca. Contarla obligaba al pie a avisar de algo que nadie tiene que
  # arreglar.
  fila <- function(code, rol, meta) list(
    operational_code = code, classroom_id = code, sample_role = rol, faculty = "DERECHO",
    expected_valid = meta, eligible_n = 30, sample_status = "agendada",
    operational_status = "aplicada")
  d <- monitoreo_aulas_dashboard(list(
    fila("CH 1", "titular", 10),
    fila("CH 2", "titular", 0),           # esta SI es una meta que falta
    fila("EXTRA 1", "extra_reserve_pool", 0),
    fila("EXTRA 2", "extra_reserve_pool", 0)
  ), data.frame(), list())
  expect_identical(d$course_status_sin_meta, 1L)
  expect_identical(d$course_status_banco, 2L)
})

test_that("sin banco, el reparto es el de siempre", {
  # El cambio no puede alterar un estudio que no usa banco.
  fila <- function(code) list(operational_code = code, classroom_id = code, sample_role = "titular",
    faculty = "D", expected_valid = 10, eligible_n = 30, sample_status = "agendada",
    operational_status = "aplicada")
  d <- monitoreo_aulas_dashboard(lapply(1:5, function(i) fila(sprintf("CH %d", i))), data.frame(), list())
  expect_identical(sum(vapply(d$course_status_cobertura, function(x) x$aulas, integer(1))), 5L)
  expect_identical(d$course_status_banco, 0L)
})
