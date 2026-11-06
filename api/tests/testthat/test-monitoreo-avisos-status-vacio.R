# El barrido telefónico avisa cuántas filas tienen el Status vacío y qué hace el
# motor con ellas (las cuenta como «No barrido» y las saca de la cola). Antes no
# lo decía en ninguna parte.

.tasv_datos <- function(status) {
  barrido <- data.frame(
    CodPulso = sprintf("P%03d", seq_along(status)), Status = status,
    .source_role = "barrido", .source_label = "Barrido", stringsAsFactors = FALSE, check.names = FALSE
  )
  respuestas <- data.frame(CodPulso = "P001", Status = "", .source_role = "respuestas",
                           .source_label = "Kobo", stringsAsFactors = FALSE, check.names = FALSE)
  rbind(barrido, respuestas)
}

test_that("con Status vacíos el barrido lo avisa con su cifra", {
  d <- .tasv_datos(c(rep("", 9), rep("No contesta", 3)))
  a <- .monitoreo_report_alerts_df(d, list(family = "telefonico"))
  fila <- a[a[["Tipo alerta"]] == "status_vacio_barrido", , drop = FALSE]
  expect_equal(nrow(fila), 1L)
  expect_match(fila$Detalle, "^9 filas del barrido sin Status")
  expect_match(fila$Detalle, "No barrido")
})

test_that("sin Status vacíos no hay aviso", {
  d <- .tasv_datos(rep("No contesta", 3))
  a <- .monitoreo_report_alerts_df(d, list(family = "telefonico"))
  expect_false("status_vacio_barrido" %in% a[["Tipo alerta"]])
})

test_that("una sola fila se dice en singular", {
  avisos <- .monitoreo_aviso_status_vacio(data.frame(Status = c("", "Efectivo"), stringsAsFactors = FALSE))
  expect_match(avisos[[1]]$Detalle, "^1 fila del barrido sin Status: se cuenta")
})

test_that("las filas sin Status siguen en el universo: cuentan como «No barrido», no se descartan (2e)", {
  # La revisión del barrido RMS (2026-10-31) dijo que las 9 filas «salen del
  # universo». No salen: el total telefónico las incluye y el aviso dice cómo
  # se cuentan. Si alguien las filtra antes del resumen, esto falla.
  d <- .tasv_datos(c(rep("", 9), rep("No contesta", 3)))
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "telefonico",
                             key_rules = list(universe_fields = "CodPulso", automatic_detection = FALSE))
  ), d)
  reports <- monitoreo_acreditacion_reportes(d, cfg, report_scope = "phone_summary", cached_reports = list())
  hoja <- Filter(function(s) identical(s$id %||% "", "monitoreo_telefonico"), reports$sheets %||% list())[[1L]]
  bloque <- Filter(function(b) identical(b$id %||% "", "resumen_telefonico"), hoja$blocks)[[1L]]
  filas <- .monitoreo_internal_records_to_df(bloque$rows)
  casos <- function(ind) as.integer(filas$Casos[filas$Indicador == ind][[1L]])
  expect_identical(casos("Total telefónico"), 12L)
  expect_identical(casos("No barridos"), 9L)
})
