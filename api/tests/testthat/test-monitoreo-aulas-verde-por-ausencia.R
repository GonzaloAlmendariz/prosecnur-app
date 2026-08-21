# Un control que no pudo mirar nada no es un control que paso.
#
# Con un estudio recien importado —plan si, campo todavia no— la lista de
# validacion declaraba **9 correctos de 11**, y siete de esos nueve explicaban
# en su propio texto que no habian comprobado nada. Quien la lee de un vistazo
# se lleva que el estudio esta limpio; lo cierto es que no se ha revisado.
#
# Es el «verde por AUSENCIA, no por conformidad» que el Contrato de Superficie
# prohibe, cometido dentro de la propia lista de validacion. El vocabulario ya
# existia (`sin_datos` → «SIN COMPROBAR» en pantalla): faltaba aplicarlo donde
# el detalle ya lo declaraba.

.vpa_estudio_sin_campo <- function() {
  plan <- list(list(classroom_id = "A", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1, eligible_n = 30))
  monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))
}

.vpa_estado <- function(d, check) {
  fila <- Filter(function(r) identical(as.character(r$check), check), d$validation)[[1]]
  list(status = as.character(fila$status), detail = as.character(fila$detail))
}

# Los que dependen de datos que este estudio todavia no tiene. Cada uno con la
# razon por la que no se puede comprobar, que es lo que el texto debe decir.
SIN_CAMPO <- c(
  "personal_identifiers", "unmapped_valid_responses", "duplicate_responses",
  "sex_faculty_quota", "field_report_reconciliation", "book_sheets_cross_check",
  "unnamed_control_columns", "valid_response_criterion"
)

test_that("ningun control se declara correcto sin haber comprobado nada", {
  d <- .vpa_estudio_sin_campo()
  for (check in SIN_CAMPO) {
    e <- .vpa_estado(d, check)
    expect_identical(e$status, "sin_datos",
                     info = paste0(check, " dice '", e$status, "': ", e$detail))
  }
})

test_that("el estado y el texto dicen lo mismo", {
  # El defecto simetrico: poner `sin_datos` y dejar un texto que afirma haber
  # contado —«Todas las respuestas validas se atribuyeron a un aula»— con cero
  # respuestas. El estado seria correcto y la frase seguiria mintiendo.
  d <- .vpa_estudio_sin_campo()
  afirma_haber_contado <- "^Tod[oa]s l[oa]s "
  for (check in SIN_CAMPO) {
    e <- .vpa_estado(d, check)
    expect_false(grepl(afirma_haber_contado, e$detail),
                 info = paste0(check, " no comprobo nada y su texto dice: ", e$detail))
  }
})

test_that("lo que si se pudo comprobar sigue diciendo ok", {
  # El control tiene que discriminar: si todo pasara a `sin_datos` el test de
  # arriba pasaria por la razon equivocada. `unknown_sample_status` mira el
  # plan, que SI existe en este estudio.
  d <- .vpa_estudio_sin_campo()
  expect_identical(.vpa_estado(d, "unknown_sample_status")$status, "ok")
  expect_identical(.vpa_estado(d, "anonymous_responses")$status, "ok")
})

test_that("con datos que comprobar, el control vuelve a pronunciarse", {
  # La contracara: `sin_datos` no puede ser la respuesta comoda. Con una hoja
  # de control que SI trae columnas sin nombre, el mismo check dice `review`.
  plan <- list(list(classroom_id = "A", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1, eligible_n = 30))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(
    enabled = TRUE, plan = plan,
    control = list(list(operational_code = "CH 1")),
    control_sin_nombre = 7L
  ))
  e <- .vpa_estado(d, "unnamed_control_columns")
  expect_identical(e$status, "review")
  expect_match(e$detail, "7 columnas")
})

test_that("monitoreo_aulas_estado_control separa los tres desenlaces", {
  expect_identical(monitoreo_aulas_estado_control(FALSE, FALSE), "sin_datos")
  # No comprobable manda: sin nada que mirar no se puede haber hallado nada.
  expect_identical(monitoreo_aulas_estado_control(FALSE, TRUE), "sin_datos")
  expect_identical(monitoreo_aulas_estado_control(TRUE, FALSE), "ok")
  expect_identical(monitoreo_aulas_estado_control(TRUE, TRUE), "review")
  expect_identical(monitoreo_aulas_estado_control(TRUE, TRUE, "warning"), "warning")
})
