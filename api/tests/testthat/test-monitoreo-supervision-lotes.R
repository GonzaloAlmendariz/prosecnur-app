# Lotes de supervisión (ADR 0125, anexo A3): Monitoreo decide a quién y cuándo
# supervisar; Material arma la campaña con la forma congelada.

ronda_de <- function(numero, porcentaje = NA_real_, origen = c("sorteo", "sorteo", "analista")) {
  list(
    numero = numero, generada_el = "2026-11-02T08:00:00-05:00", semilla = 7L,
    porcentaje = porcentaje, cantidad = length(origen), universo = 40L,
    casos = data.frame(
      N = seq_along(origen), CodPulso = sprintf("P%03d", seq_along(origen) + numero * 10),
      proGres = "", Enumerador = c("Ana", "Beto", "Ana")[seq_along(origen)], `Categoría` = "",
      `Fecha Kobo` = "2026-10-30", `Response ID` = "", Origen = origen,
      check.names = FALSE, stringsAsFactors = FALSE
    ),
    reparto = data.frame()
  )
}

test_that("cada ronda guardada es un lote con la forma del anexo A3", {
  rondas <- .monitoreo_supervision_rondas_normalizar(list(rondas = list(ronda_de(1, 10), ronda_de(2))))
  lotes <- monitoreo_supervision_lotes(rondas)
  expect_length(lotes, 2L)
  l1 <- lotes[[1]]
  expect_setequal(names(l1), c("lote_id", "creado_en", "campana_origen", "criterio", "casos"))
  expect_identical(l1$lote_id, "ronda-1")
  expect_identical(l1$campana_origen, "telefonica.principal")
  expect_length(l1$casos, 3L)
  expect_setequal(names(l1$casos[[1]]), c("llave", "responsable", "fecha_llamada"))
  expect_identical(l1$casos[[1]]$llave, "P011")
  expect_identical(l1$casos[[2]]$responsable, "Beto")
  expect_match(l1$criterio, "10 % de 40 efectivas nuevas")
  expect_match(l1$criterio, "1 agregado por el analista")
  expect_match(lotes[[2]]$criterio, "2 casos sorteados sobre 40 efectivas")
})

test_that("sin rondas guardadas no hay lotes: la ronda virtual no la decidió nadie", {
  expect_length(monitoreo_supervision_lotes(list()), 0L)
  virtual <- ronda_de(1)
  virtual$guardada <- FALSE
  expect_length(monitoreo_supervision_lotes(list(virtual)), 0L)
})
