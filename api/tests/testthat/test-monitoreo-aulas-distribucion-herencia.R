# =============================================================================
# Una pestaña de otra semana no se traga la semana siguiente
# =============================================================================
#
# CCSS Perfil 2026-II, 2026-09-23: el equipo escribió una fila del 28/09 en
# «Semana 1»; la semana del 28/09 se resolvía a «Semana 1» (respetada) y no se
# publicaba.

.mdh_valores <- function(fechas) {
  c(list(list("APLICADOR", "DÍA", "FECHA")),
    lapply(fechas, function(f) list("X", "Lunes", f)))
}

test_that("con una fila suelta de la semana 2 en «Semana 1», la semana 2 va a su pestaña", {
  v <- .mdh_valores(c("22/09", "23/09", "28/09"))
  destino <- .mads_hoja_para_semana("Semana 1", "Semana 2", c("28/09", "29/09"), "Semana 1",
                                    function(h) v)
  expect_identical(destino, "Semana 2")
})

test_that("el documento de una sola hoja sigue heredando", {
  v <- .mdh_valores(c("28/09"))
  destino <- .mads_hoja_para_semana("Plan del día", "Semana 2", c("28/09"), "Plan del día",
                                    function(h) v)
  expect_identical(destino, "Plan del día")
})
