# =============================================================================
# Lo anterior al arranque del campo no es recolección
# =============================================================================
#
# Medido el 2026-09-22, primer día de campo de CCSS Perfil 2026-II: once envíos
# del 15 de setiembre —una semana antes, de la capacitación, abiertos por el
# enlace del formulario y por tanto SIN recopilador— seguían contando. El panel
# publicaba «83 respuestas en 2 días de recolección · 42 al día · 9 días más al
# ritmo de estos 2». El campo llevaba un día con 72; a ese ritmo faltaban cinco.
#
# `descartes` no los alcanza: casa VALORES de una columna, y una respuesta sin
# recopilador no tiene valor que casar. La propiedad que los separa es cuándo.

.maic_resp <- function() data.frame(
  `_submission_time` = c("2026-09-15T17:50:00", "2026-09-21T15:41:00",
                         "2026-09-22T09:10:00", "", "no es fecha"),
  collectorID = c("", "CAPACITACION", "CH 45", "CH 45", "CH 45"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.maic_cfg <- function(inicio = "") monitoreo_aulas_normalize_config(list(
  enabled = TRUE, inicio_campo = inicio,
  source_mapping = list(collector_var = "collectorID")
))

test_that("sin inicio declarado no se descarta nada: lo vigente no se mueve", {
  fuera <- monitoreo_aulas_antes_del_campo(.maic_resp(), .maic_cfg(""))
  expect_identical(fuera, rep(FALSE, 5L))
})

test_that("con inicio declarado sale lo anterior, y SOLO lo anterior", {
  fuera <- monitoreo_aulas_antes_del_campo(.maic_resp(), .maic_cfg("2026-09-22"))
  # 15/09 y 21/09 son anteriores; el 22 es el primer día y cuenta.
  expect_identical(fuera, c(TRUE, TRUE, FALSE, FALSE, FALSE))
})

test_that("el dia del arranque cuenta: es `<`, no `<=`", {
  # Un `<=` se llevaría por delante el primer día entero de campo, que es
  # justamente el que se mira.
  r <- data.frame(`_submission_time` = "2026-09-22T00:01:00",
                  check.names = FALSE, stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_antes_del_campo(r, .maic_cfg("2026-09-22")), FALSE)
})

test_that("una respuesta sin fecha legible NUNCA se descarta", {
  # No se puede afirmar que sea anterior al campo. Descartar por no poder
  # comprobarlo es el defecto que esta regla existe para no cometer.
  r <- data.frame(`_submission_time` = c("", "no es fecha", NA),
                  check.names = FALSE, stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_antes_del_campo(r, .maic_cfg("2026-09-22")),
                   rep(FALSE, 3L))
})

test_that("sin columna de fecha en la base tampoco se descarta nada", {
  r <- data.frame(collectorID = c("CH 1", "CH 2"), stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_antes_del_campo(r, .maic_cfg("2026-09-22")),
                   rep(FALSE, 2L))
})

test_that("una fecha de inicio ilegible se ignora: no descarta el operativo entero", {
  fuera <- monitoreo_aulas_antes_del_campo(.maic_resp(), .maic_cfg("el martes"))
  expect_identical(fuera, rep(FALSE, 5L))
})

test_that("lo anterior al campo sale por fuera_del_operativo, con las descartadas", {
  # Es la misma bolsa y el mismo sitio: `.monitoreo_aulas_descartada()`, que es
  # donde se resuelve «no es del operativo» para TODAS las superficies.
  cfg <- .maic_cfg("2026-09-22")
  d <- prosecnurapp:::.monitoreo_aulas_descartada(.maic_resp(), cfg)
  expect_identical(d, c(TRUE, TRUE, FALSE, FALSE, FALSE))
  # Y por tanto ninguna de las dos es válida.
  v <- prosecnurapp:::.monitoreo_aulas_valid_response(.maic_resp(), cfg)
  expect_false(v[[1]])
  expect_false(v[[2]])
})

test_that("el ritmo deja de promediar el ensayo con el campo", {
  plan <- list(list(operational_code = "CH 45", classroom_id = "a1",
                    faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "6",
                    sample_role = "titular", eligible_n = 30, expected_valid = 12))
  resp <- data.frame(
    `_submission_time` = c(rep("2026-09-15T17:50:00", 11), rep("2026-09-22T09:10:00", 3)),
    collectorID = c(rep("", 11), rep("CH 45", 3)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  sin_inicio <- monitoreo_aulas_dashboard(plan, resp, .maic_cfg(""))$ritmo_diario
  expect_identical(sin_inicio$dias_con_campo, 2L)
  con_inicio <- monitoreo_aulas_dashboard(plan, resp, .maic_cfg("2026-09-22"))$ritmo_diario
  expect_identical(con_inicio$dias_con_campo, 1L)
  expect_identical(con_inicio$media_diaria, 3)
})

test_that("el tablero publica el recibo del padron: conteos, sin un solo codigo", {
  # La pantalla que deja elegir el eje tiene que poder decir si hay padrón con
  # el que resolverlo. Es lo mismo que queda al purgar, así que publicarlo no
  # reabre el F114: `personas` y los conteos, nunca `filas`.
  plan <- list(list(operational_code = "CH 1", classroom_id = "a1",
                    faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "6",
                    sample_role = "titular", eligible_n = 30, expected_valid = 12))
  padron <- list(schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07", filas = list(
    list(codigo = "20190001", nivel = 6L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20190002", nivel = 7L, carrera = "ECONOMÍA", sexo = "M")
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), .maic_cfg(""), padron = padron)
  expect_identical(as.integer(d$padron$personas), 2L)
  expect_identical(d$padron$schema, "monitoreo_aulas_padron_resumen_v1")
  # Lo que NO puede viajar.
  expect_null(d$padron$filas)
  expect_false(grepl("20190001", jsonlite::toJSON(d$padron, auto_unbox = TRUE), fixed = TRUE))
})

test_that("sin padron el recibo es un cero declarado, no una ausencia", {
  plan <- list(list(operational_code = "CH 1", classroom_id = "a1",
                    faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "6",
                    sample_role = "titular", eligible_n = 30, expected_valid = 12))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), .maic_cfg(""))
  expect_identical(as.integer(d$padron$personas), 0L)
})
