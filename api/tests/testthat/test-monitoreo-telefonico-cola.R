# Contrato del bloque `cola_insistencia` (revamp Monitoreo › Telefónico, T4).
# Diseño: docs/qa/revamp-monitoreo/telefonico.md §1c y ficha «Control,
# Insistencia». Fixture sintético: códigos COL-0xx y responsables «Op-0N»
# inventados; sin red, sin reloj (el corte se fija) y sin rutas absolutas.

cola_barrido <- function(con_condicionales = FALSE) {
  out <- data.frame(
    CodPulso = sprintf("COL-%03d", 1:9),
    Sede = c("Norte", "Norte", "Sur", "Sur", "Norte", "Sur", "Norte", "Sur", "Norte"),
    Responsable = c("Op-01", "Op-01", "Op-02", "Op-02", "Op-01", "", "", "Op-02", "Op-01"),
    Status = c("No contesta", "Efectivo", "Contactar después", "Rechazo", "No existe el número",
               "No barrido", "No barrido", "Colgó / Cortó la llamada", "No contesta"),
    Intentos = c("3", "1", "2", "1", "1", "", "", "", "1"),
    Fecha = c("20/10/2026", "21/10/2026", "13/10/2026", "21/10/2026", "21/10/2026", "", "", "22/10/2026", "21/10/2026"),
    `Observación` = c("  llamar después de las 7,30pm / no contesta  ", "", NA, "", "", "", "", "Cortó; pidió que no insistan", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  if (isTRUE(con_condicionales)) {
    out$OrdenTelefono <- c("2", "1", "1", "1", "1", "", "", "3", "1")
    out$TelefonosIntentados <- c("2", "1", "1", "1", "1", "", "", "3", "1")
    out$Origen <- c("Listado", "Listado", "Listado", "Listado", "Listado", "Listado", "Listado", "Listado", "Listado")
  }
  out
}

cola_respuestas <- function(codigos) {
  data.frame(
    start = "2026-10-21T10:00:00.000-05:00",
    end = "2026-10-21T10:30:00.000-05:00",
    CodPulso = codigos,
    `_status` = "submitted_via_web",
    response_status = "submitted_via_web",
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

cola_universo <- function(bar) {
  data.frame(CodPulso = bar$CodPulso, NumTelefonos = c("3", "1", "2", "1", "1", "1", "1", "4", "2"),
             stringsAsFactors = FALSE)
}

cola_escenario <- function(bar = cola_barrido(), kobo = c("COL-002", "COL-009"), universo = NULL,
                           state_rules = NULL) {
  mk <- function(id, rol, kind) list(
    id = id, kind = kind, label = id, enabled = TRUE, role = rol,
    integration_mode = "connected_read", dimensions = list(),
    sheet_binding = list(spreadsheet_id = paste0("fx_", rol), sheet_name = "Hoja", header_row = 1L),
    last_sync_at = "2026-10-23T12:00:00Z"
  )
  fuentes <- list(mk("cola_barrido", "barrido", "google_sheets"), mk("cola_kobo", "respuestas", "kobo"))
  if (!is.null(universo)) fuentes[[3]] <- mk("cola_universo", "universo", "google_sheets")
  fuentes <- monitoreo_normalize_sources(fuentes)
  src <- function(id) Filter(function(f) identical(f$id, id), fuentes)[[1]]
  partes <- list(.monitoreo_add_source_columns(bar, src("cola_barrido")))
  if (length(kobo)) partes[[length(partes) + 1L]] <- .monitoreo_add_source_columns(cola_respuestas(kobo), src("cola_kobo"))
  if (!is.null(universo)) partes[[length(partes) + 1L]] <- .monitoreo_add_source_columns(universo, src("cola_universo"))
  datos <- .monitoreo_bind_rows(partes)
  spec <- list(
    objetivo_total = 4L, date_var = "Fecha", control_vars = list("Sede"),
    goals = list(list(filters = list(Sede = "Norte"), meta = 2L), list(filters = list(Sede = "Sur"), meta = 2L)),
    operational_model = if (is.null(state_rules)) list() else list(state_rules = state_rules),
    monitoreo_profile = list(
      family = "telefonico", variant = "multi_actor", status = "active", route_selected = TRUE,
      platform_effective_filter = list(enabled = FALSE),
      platform_test_filter = list(enabled = FALSE),
      key_rules = list(universe_fields = list("CodPulso"), response_fields = list("CodPulso"),
                       use_name_fallback = FALSE, automatic_detection = TRUE)
    )
  )
  cfg <- monitoreo_normalize_config(spec, datos)
  cfg$corte <- "2026-10-23"
  list(datos = datos, cfg = cfg)
}

cola_bloques <- function(esc) {
  bloques <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  ids <- vapply(bloques, function(b) b$id, "")
  list(
    cola = bloques[[match("cola_insistencia", ids)]],
    resp = bloques[[match("cola_insistencia_responsables", ids)]],
    ids = ids
  )
}

cola_fila <- function(bloque, cod) Filter(function(r) identical(r$CodPulso, cod), bloque$rows)[[1]]

COLA_BASE <- c("CodPulso", "Responsable", "Sin asignar", "Status", "Intentos", "Fecha", "Observación",
               "Variable cuota", "Cuota", "efectiva_kobo", "dias_sin_registro", "Criterio cola")
COLA_CONDICIONALES <- c("OrdenTelefono", "TelefonosIntentados", "NumTelefonos", "Origen")

test_that("la cola trae solo casos barridos no finales y siempre las columnas base", {
  b <- cola_bloques(cola_escenario())
  expect_true(all(c("cola_insistencia", "cola_insistencia_responsables") %in% b$ids))
  expect_identical(unlist(b$cola$columns), COLA_BASE)
  cods <- vapply(b$cola$rows, function(r) r$CodPulso, "")
  # Fuera: Efectivo (002), Rechazo (004), No existe el número (005, motor:
  # terminal), y los No barrido (006, 007).
  expect_setequal(cods, c("COL-001", "COL-003", "COL-008", "COL-009"))
  # Sin historia, próximo intento, número marcado ni agotado.
  expect_false(any(grepl("agotad|proximo|próximo|historia|telefono marcado|objetivo", unlist(b$cola$columns), ignore.case = TRUE)))
})

test_that("con la cola vacía las columnas base siguen declaradas", {
  bar <- cola_barrido()
  bar$Status <- ifelse(bar$Status == "No barrido", "No barrido", "Efectivo")
  b <- cola_bloques(cola_escenario(bar = bar))
  expect_identical(unlist(b$cola$columns), COLA_BASE)
  expect_length(b$cola$rows, 0L)
})

test_that("las columnas condicionales aparecen solo si la hoja las trae", {
  sin <- cola_bloques(cola_escenario())
  expect_false(any(COLA_CONDICIONALES %in% unlist(sin$cola$columns)))

  bar <- cola_barrido(con_condicionales = TRUE)
  con <- cola_bloques(cola_escenario(bar = bar, universo = cola_universo(bar)))
  expect_identical(unlist(con$cola$columns), c(COLA_BASE, COLA_CONDICIONALES))
  fila <- cola_fila(con$cola, "COL-008")
  expect_identical(fila$OrdenTelefono, 3L)
  expect_identical(fila$TelefonosIntentados, 3L)
  # NumTelefonos vive en el listado (universo) y se cruza por la llave.
  expect_identical(fila$NumTelefonos, 4L)
  expect_identical(fila$Origen, "Listado")
})

test_that("«No barrido» sin responsable es «Sin asignar», separado de la cola", {
  b <- cola_bloques(cola_escenario())
  resp <- b$resp$rows
  nombres <- vapply(resp, function(r) r$Responsable, "")
  expect_identical(nombres[[length(nombres)]], "Sin asignar")
  sin_asignar <- resp[[length(resp)]]
  expect_true(sin_asignar$`Sin asignar`)
  expect_identical(sin_asignar$`Casos en cola`, 0L)
  expect_identical(sin_asignar$`Por llamar`, 2L)
  op01 <- Filter(function(r) identical(r$Responsable, "Op-01"), resp)[[1]]
  expect_false(op01$`Sin asignar`)
  expect_identical(op01$`Casos en cola`, 2L)
  expect_identical(op01$`Promedio intentos`, 2)
  expect_identical(op01$`Ya efectivas en Kobo`, 1L)

  # Un caso no final sin responsable también se rotula «Sin asignar».
  bar <- cola_barrido()
  bar$Responsable[bar$CodPulso == "COL-003"] <- ""
  fila <- cola_fila(cola_bloques(cola_escenario(bar = bar))$cola, "COL-003")
  expect_identical(fila$Responsable, "Sin asignar")
  expect_true(fila$`Sin asignar`)
})

test_that("dias_sin_registro es el corte menos la fecha del último intento", {
  b <- cola_bloques(cola_escenario())
  expect_identical(cola_fila(b$cola, "COL-001")$dias_sin_registro, 3L)
  expect_identical(cola_fila(b$cola, "COL-003")$dias_sin_registro, 10L)
  expect_identical(cola_fila(b$cola, "COL-003")$Fecha, "2026-10-13")
  expect_match(b$cola$note, "23/10/2026", fixed = TRUE)
  # Sin fecha no inventa días.
  bar <- cola_barrido()
  bar$Fecha[bar$CodPulso == "COL-009"] <- ""
  fila <- cola_fila(cola_bloques(cola_escenario(bar = bar))$cola, "COL-009")
  expect_identical(fila$dias_sin_registro, "")
  expect_identical(fila$Fecha, "")
})

test_that("efectiva_kobo sale del cruce por la llave del motor", {
  b <- cola_bloques(cola_escenario(kobo = c("COL-002", "COL-009")))
  expect_true(cola_fila(b$cola, "COL-009")$efectiva_kobo)
  expect_false(cola_fila(b$cola, "COL-001")$efectiva_kobo)
  sin_kobo <- cola_bloques(cola_escenario(kobo = "COL-002"))
  expect_false(cola_fila(sin_kobo$cola, "COL-009")$efectiva_kobo)
})

test_that("la observación sale literal, sin recortar ni reescribir", {
  b <- cola_bloques(cola_escenario())
  expect_identical(cola_fila(b$cola, "COL-001")$`Observación`, "  llamar después de las 7,30pm / no contesta  ")
  expect_identical(cola_fila(b$cola, "COL-008")$`Observación`, "Cortó; pidió que no insistan")
  expect_identical(cola_fila(b$cola, "COL-003")$`Observación`, "")
  expect_identical(cola_fila(b$cola, "COL-001")$Intentos, 3L)
  expect_identical(cola_fila(b$cola, "COL-008")$Intentos, "")
  expect_identical(cola_fila(b$cola, "COL-001")$Cuota, "Norte")
  expect_identical(cola_fila(b$cola, "COL-001")$`Variable cuota`, "Sede")
})

test_that("la familia declarada en el vocabulario manda sobre la clasificación del motor", {
  # Por defecto «Apagado» es terminal en el motor, pero el vocabulario por
  # defecto lo declara `non_effective` sin `stop_contact`: sigue en cola.
  bar <- cola_barrido()
  bar$Status[bar$CodPulso == "COL-005"] <- "Apagado"
  b <- cola_bloques(cola_escenario(bar = bar))
  fila <- cola_fila(b$cola, "COL-005")
  expect_identical(fila$`Criterio cola`, "Vocabulario del proyecto")
  # Sin regla que case («Colgó / Cortó la llamada»), decide el motor.
  expect_identical(cola_fila(b$cola, "COL-008")$`Criterio cola`, "Clasificación del motor")

  # Si el proyecto declara que «No contesta» cierra contacto, sale de la cola.
  reglas <- list(list(id = "cierra_nc", label = "No contesta cierra", final_state = "non_effective",
                      priority = 1L, outcome_values = list("No contesta"), stop_contact = TRUE))
  cerrada <- cola_bloques(cola_escenario(state_rules = reglas))
  cods <- vapply(cerrada$cola$rows, function(r) r$CodPulso, "")
  expect_false(any(c("COL-001", "COL-009") %in% cods))
})

test_that("sin hoja de barrido la cola queda vacía con su motivo", {
  out <- .monitoreo_telefonico_cola_blocks(data.frame(), list(), list(), NULL, from_population = TRUE)
  expect_identical(vapply(out, function(b) b$id, ""), c("cola_insistencia", "cola_insistencia_responsables"))
  expect_length(out[[1]]$rows, 0L)
  expect_match(out[[1]]$note, "Sin hoja de barrido", fixed = TRUE)
})
