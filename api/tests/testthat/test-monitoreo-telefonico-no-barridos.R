# Contrato del bloque `no_barridos_casos` (seguimiento de casos sin barrer,
# pedido de Gonzalo 2026-10-27). Fixture sintético: códigos NB-0xx y
# responsables «Op-0N» inventados; sin red ni reloj.

nb_ctx <- function(bar, no_barrido = bar$Status == "No barrido", cuota = NULL) {
  list(
    responsables = bar$Responsable,
    no_barrido = no_barrido,
    dates = bar$Fecha,
    keys = bar$CodPulso,
    quota_variable = if (is.null(cuota)) "" else "Sede",
    quota_values = cuota
  )
}

nb_barrido <- function() {
  data.frame(
    CodPulso = sprintf("NB-%03d", 1:8),
    Responsable = c("Op-01", "Op-01", "Op-01", "Op-02", "Op-02", "Op-03", "", "Op-01"),
    Status = c("Efectivo", "No contesta", "No barrido", "Efectivo", "No barrido", "No barrido", "No barrido", "No barrido"),
    Fecha = c("16/10/2026", "21/10/2026", "", "19/10/2026", "", "", "", "13/10/2020"),
    stringsAsFactors = FALSE
  )
}

test_that("sólo entran los casos asignados sin barrer; el sin asignar no es atraso", {
  bar <- nb_barrido()
  out <- .monitoreo_telefonico_no_barridos_df(bar, nb_ctx(bar))
  expect_setequal(out$CodPulso, c("NB-003", "NB-005", "NB-006", "NB-008"))
  expect_false("NB-007" %in% out$CodPulso)
})

test_that("la referencia es la primera llamada del operador y, sin llamadas, el inicio de campo", {
  bar <- nb_barrido()
  out <- .monitoreo_telefonico_no_barridos_df(bar, nb_ctx(bar))
  fila <- function(cod) out[out$CodPulso == cod, , drop = FALSE]
  expect_equal(fila("NB-003")$`Fecha referencia`, "2026-10-16")
  expect_equal(fila("NB-003")$Referencia, "primera_llamada_operador")
  expect_equal(fila("NB-003")$`Ultima llamada operador`, "2026-10-21")
  expect_equal(fila("NB-005")$`Fecha referencia`, "2026-10-19")
  # Op-03 no registró ningún intento: se cuenta desde el primer día de campo.
  expect_equal(fila("NB-006")$`Fecha referencia`, "2026-10-16")
  expect_equal(fila("NB-006")$Referencia, "inicio_campo")
  expect_equal(fila("NB-006")$`Primera llamada operador`, "")
})

test_that("una fecha tecleada en un «No barrido» o de otro año no es una llamada", {
  bar <- nb_barrido()
  bar$Fecha[3] <- "10/10/2026"
  out <- .monitoreo_telefonico_no_barridos_df(bar, nb_ctx(bar))
  expect_equal(out$`Fecha referencia`[out$CodPulso == "NB-003"], "2026-10-16")
  # El «13/10/2020» de NB-008 es un No barrido y además de otro año: no adelanta el inicio.
  expect_equal(out$`Fecha referencia`[out$CodPulso == "NB-006"], "2026-10-16")
})

test_that("la fecha de asignación de la hoja manda sobre las demás referencias", {
  bar <- nb_barrido()
  bar$`Fecha de asignación` <- c("", "", "22/10/2026", "", "", "", "", "")
  out <- .monitoreo_telefonico_no_barridos_df(bar, nb_ctx(bar))
  expect_equal(out$`Fecha referencia`[out$CodPulso == "NB-003"], "2026-10-22")
  expect_equal(out$Referencia[out$CodPulso == "NB-003"], "asignacion")
  expect_equal(out$Referencia[out$CodPulso == "NB-005"], "primera_llamada_operador")
})

test_that("sin ninguna fecha legible la referencia queda declarada como ausente", {
  bar <- nb_barrido()
  bar$Fecha <- ""
  out <- .monitoreo_telefonico_no_barridos_df(bar, nb_ctx(bar))
  expect_true(all(out$Referencia == "sin_referencia"))
  expect_true(all(out$`Fecha referencia` == ""))
})

test_that("publica la cuota y el origen, y ordena del más antiguo al más reciente", {
  bar <- nb_barrido()
  bar$Origen <- c("Muestra", "Muestra", "Muestra", "Muestra", "Backup", "Muestra", "Backup", "Muestra")
  out <- .monitoreo_telefonico_no_barridos_df(bar, nb_ctx(bar, cuota = c("Norte", "Sur", "Norte", "Sur", "Sur", "Norte", "Sur", "Norte")))
  expect_equal(out$Cuota[out$CodPulso == "NB-005"], "Sur")
  expect_equal(out$Origen[out$CodPulso == "NB-005"], "Backup")
  expect_equal(unique(out$`Variable cuota`), "Sede")
  expect_equal(out$`Fecha referencia`, sort(out$`Fecha referencia`))
})

test_that("sin hoja de barrido el bloque existe vacío y lo dice", {
  bloques <- .monitoreo_telefonico_no_barridos_blocks(data.frame(), list(), from_population = TRUE)
  expect_length(bloques, 1L)
  expect_equal(bloques[[1]]$id, "no_barridos_casos")
  expect_match(bloques[[1]]$note, "Sin hoja")
})
