# Acreditación › Control › Reintentos (revamp A4): la cola de insistencia del
# telefónico (`monitoreo_telefonico_cola.R`) también se publica cuando el
# barrido es parte de una acreditación. Fixture sintético: códigos ACR-0xx y
# responsables «Op-0N» inventados; sin red y sin rutas absolutas.

acr_reintentos_escenario <- function() {
  barrido <- data.frame(
    CodPulso = sprintf("ACR-%03d", 1:6),
    Responsable = c("Op-01", "Op-01", "Op-02", "Op-02", "", "Op-01"),
    Status = c("No contesta", "Efectivo", "Apagado", "Contactar después", "No barrido", "No contesta"),
    Intentos = c("7", "1", "5", "2", "", "10"),
    Fecha = c("15/06/2026", "10/06/2026", "12/06/2026", "14/06/2026", "", "13/06/2026"),
    `Observación` = c("no contesta", "", "apagado", "llamar luego", "", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  respuestas <- data.frame(
    start = "2026-06-10T10:00:00.000-05:00", end = "2026-06-10T10:20:00.000-05:00",
    CodPulso = "ACR-002", response_status = "completed",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  mk <- function(id, rol, kind) list(
    id = id, kind = kind, label = id, enabled = TRUE, role = rol,
    integration_mode = "connected_read",
    dimensions = list(actor = "Egresados", channel = "Telefónico"),
    sheet_binding = list(spreadsheet_id = paste0("fx_", rol), sheet_name = "Hoja", header_row = 1L)
  )
  fuentes <- monitoreo_normalize_sources(list(
    mk("acr_barrido", "barrido", "google_sheets"),
    mk("acr_respuestas", "respuestas", "surveymonkey")
  ))
  src <- function(id) Filter(function(f) identical(f$id, id), fuentes)[[1]]
  datos <- .monitoreo_bind_rows(list(
    .monitoreo_add_source_columns(barrido, src("acr_barrido")),
    .monitoreo_add_source_columns(respuestas, src("acr_respuestas"))
  ))
  attr(datos, "monitoreo_sources") <- fuentes
  spec <- list(
    monitoreo_profile = list(
      family = "acreditacion", variant = "multi_actor", status = "active", route_selected = TRUE,
      units = list(list(actor = "Egresados", phone = list(enabled = TRUE))),
      key_rules = list(universe_fields = list("CodPulso"), response_fields = list("CodPulso"),
                       use_name_fallback = FALSE, automatic_detection = TRUE)
    )
  )
  cfg <- monitoreo_normalize_config(spec, datos)
  list(datos = datos, cfg = cfg)
}

test_that("una acreditación con barrido publica la cola de insistencia", {
  esc <- acr_reintentos_escenario()
  bloques <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  ids <- vapply(bloques, function(b) b$id, "")
  expect_true(all(c("cola_insistencia", "cola_insistencia_responsables") %in% ids))
  cola <- bloques[[match("cola_insistencia", ids)]]
  cods <- vapply(cola$rows, function(r) r$CodPulso, "")
  # Fuera la efectiva (002) y el No barrido (005); quedan los reintentables.
  expect_setequal(cods, c("ACR-001", "ACR-003", "ACR-004", "ACR-006"))
  # La columna de categoría es el público declarado por la fuente del barrido.
  expect_identical(unique(vapply(cola$rows, function(r) r$Cuota, "")), "Egresados")
  expect_identical(unique(vapply(cola$rows, function(r) r$`Variable cuota`, "")), "Público")
  # La comparación CodPulso sigue siendo solo del telefónico.
  expect_false("comparacion_codpulso" %in% ids)
})
