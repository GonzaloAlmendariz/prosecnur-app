# B3: asignado (Material) contra observado (Kobo) por UMP. Núcleo puro: la
# lectura de Material y la auditoría de la fase entran ya armadas.

.tap_asig <- function(...) {
  modifyList(list(
    ok = TRUE, sin_fuente = FALSE, stale = FALSE, desactualizada = FALSE, code_format = "PXXX",
    equipo = list(list(codigo = "P844", nombre = "Ana Ruiz"), list(codigo = "P101", nombre = "Luis Paz")),
    asignacion = list(
      list(id_manzana = "M1", label = "UMP 1", role = "titular", codigo = "P844", origen = "explicita"),
      list(id_manzana = "M2", label = "UMP 2", role = "titular", codigo = "P844", origen = "explicita"),
      list(id_manzana = "M3", label = "UMP 3 R", role = "reemplazo", codigo = "P101", origen = "heredada"),
      list(id_manzana = "M4", label = "UMP 4", role = "titular", codigo = "P101", origen = "explicita")
    )
  ), list(...))
}

.tap_audit <- data.frame(
  advance_block_id = c("M1", "M1", "M2", "M2", "M3", "M9", "M1"),
  # «844» y «p844» son P844 una vez limpios: nunca se compara por el texto.
  pulso_code = c("844", "p844", "P844", "P101", "P320", "P101", "P844"),
  stringsAsFactors = FALSE
)

test_that("compara por código limpio y nombra cada lectura", {
  r <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(),
                                                          anulado = c(rep(FALSE, 6), TRUE))
  expect_identical(r$estado, "comparable")
  lect <- stats::setNames(vapply(r$por_ump, `[[`, "", "lectura"), vapply(r$por_ump, `[[`, "", "id_manzana"))
  expect_identical(unname(lect[c("M1", "M2", "M3", "M4")]),
                   c("coincide", "coincide_con_otros", "otro_encuestador", "sin_respuestas"))
  m1 <- r$por_ump[[1]]
  expect_identical(m1$codigo_planificado, "P844")
  expect_identical(m1$nombre_planificado, "Ana Ruiz")
  # La fila anulada de M1 no cuenta.
  expect_identical(m1$respuestas, 2L)
  expect_identical(r$resumen$sin_planificar, 1L)  # M9 tiene respuestas y nadie la asignó
  expect_identical(r$resumen$coinciden, 1L)
  expect_identical(r$resumen$otro_encuestador, 1L)
  # Un reemplazo conserva que su código vino heredado del titular.
  expect_identical(r$por_ump[[3]]$origen, "heredada")
})

test_that("no compara contra otra muestra: desactualizada o foto vencida", {
  a <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(desactualizada = TRUE))
  expect_identical(a$estado, "otra_muestra")
  expect_match(a$motivo, "asignación de otra muestra")
  expect_length(a$por_ump, 0L)
  b <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(stale = TRUE))
  expect_identical(b$estado, "otra_muestra")
})

test_that("sin campaña, sin envío o sin asignación se dice con su estado", {
  expect_identical(monitoreo_territorial_asignacion_planificada_desde(.tap_audit, NULL)$estado, "sin_campana")
  expect_identical(monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(sin_fuente = TRUE))$estado, "sin_envio")
  vacia <- .tap_asig(); vacia$asignacion <- list()
  expect_identical(monitoreo_territorial_asignacion_planificada_desde(.tap_audit, vacia)$estado, "sin_asignacion")
})

test_that("no viaja DNI: el equipo sólo aporta código y nombre", {
  r <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig())
  expect_false(any(grepl("dni", names(unlist(r)), ignore.case = TRUE)))
})
