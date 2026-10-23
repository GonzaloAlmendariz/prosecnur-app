# Contrato del bloque `discrepancias_telefonicas` y de la decisión «Cuenta /
# No cuenta» (revamp Monitoreo › Telefónico, T9; P1–P3 de
# procedimientos-respondidos.md). Fixture sintético: códigos DSC-0xx y
# proGres «XYZ-26-90000N» inventados; sin red, sin reloj y sin rutas.

dsc_barrido <- function(con_progres = TRUE) {
  out <- data.frame(
    CodPulso = sprintf("DSC-%03d", 1:6),
    Sede = c("Norte", "Norte", "Sur", "Sur", "Norte", "Sur"),
    Responsable = c("Op-01", "Op-01", "Op-02", "Op-02", "", "Op-02"),
    Status = c("No contesta", "Efectivo", "Efectivo", "Rechazo", "No barrido", "Efectivo"),
    Intentos = c("2", "1", "1", "1", "", "1"),
    Fecha = c("20/10/2026", "21/10/2026", "21/10/2026", "21/10/2026", "", "22/10/2026"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  if (isTRUE(con_progres)) out[["Código proGres"]] <- sprintf("XYZ-26-90000%d", 1:6)
  out
}

dsc_respuestas <- function(codigos) {
  data.frame(
    start = "2026-10-21T10:00:00.000-05:00",
    end = "2026-10-21T10:30:00.000-05:00",
    CodPulso = codigos,
    `_id` = paste0("R", seq_along(codigos)),
    `_status` = "submitted_via_web",
    response_status = "submitted_via_web",
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

dsc_escenario <- function(bar = dsc_barrido(), kobo = c("DSC-001", "DSC-002", "DSC-005", "DSC-006"), decisiones = NULL) {
  mk <- function(id, rol, kind) list(
    id = id, kind = kind, label = id, enabled = TRUE, role = rol,
    integration_mode = "connected_read", dimensions = list(),
    sheet_binding = list(spreadsheet_id = paste0("fx_", rol), sheet_name = "Hoja", header_row = 1L),
    last_sync_at = "2026-10-23T12:00:00Z"
  )
  fuentes <- monitoreo_normalize_sources(list(mk("dsc_barrido", "barrido", "google_sheets"), mk("dsc_kobo", "respuestas", "kobo")))
  datos <- .monitoreo_bind_rows(list(
    .monitoreo_add_source_columns(bar, fuentes[[1]]),
    .monitoreo_add_source_columns(dsc_respuestas(kobo), fuentes[[2]])
  ))
  perfil <- list(
    family = "telefonico", variant = "multi_actor", status = "active", route_selected = TRUE,
    platform_effective_filter = list(enabled = FALSE), platform_test_filter = list(enabled = FALSE),
    key_rules = list(universe_fields = list("CodPulso"), response_fields = list("CodPulso"),
                     use_name_fallback = FALSE, automatic_detection = TRUE)
  )
  if (!is.null(decisiones)) perfil$reconciliation_decisions <- decisiones
  cfg <- monitoreo_normalize_config(list(objetivo_total = 4L, date_var = "Fecha", control_vars = list("Sede"),
                                         monitoreo_profile = perfil), datos)
  list(datos = datos, cfg = cfg)
}

dsc_bloques <- function(esc) {
  bloques <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  stats::setNames(bloques, vapply(bloques, function(b) b$id, ""))
}

dsc_filas <- function(bloque) {
  if (!length(bloque$rows)) return(data.frame())
  do.call(rbind, lapply(bloque$rows, function(r) as.data.frame(r, check.names = FALSE, stringsAsFactors = FALSE)))
}

test_that("la alerta va en los dos sentidos con responsable, CodPulso y proGres", {
  b <- dsc_bloques(dsc_escenario())
  expect_true("discrepancias_telefonicas" %in% names(b))
  expect_identical(unlist(b$discrepancias_telefonicas$columns),
                   c("Sentido", "CodPulso", "proGres", "Responsable", "La hoja dice", "Fecha hoja", "Fecha Kobo"))
  filas <- dsc_filas(b$discrepancias_telefonicas)
  kobo <- filas[filas$Sentido == "kobo_sin_hoja", ]
  hoja <- filas[filas$Sentido == "hoja_sin_kobo", ]
  # DSC-001 (No contesta) y DSC-005 (No barrido) tienen Kobo; DSC-003 dice Efectivo sin Kobo.
  expect_setequal(kobo$CodPulso, c("DSC-001", "DSC-005"))
  expect_identical(hoja$CodPulso, "DSC-003")
  expect_identical(kobo$proGres[kobo$CodPulso == "DSC-001"], "XYZ-26-900001")
  expect_identical(kobo$Responsable[kobo$CodPulso == "DSC-001"], "Op-01")
  expect_identical(kobo$`La hoja dice`[kobo$CodPulso == "DSC-001"], "No contesta")
  expect_identical(hoja$proGres, "XYZ-26-900003")
  # Coinciden (DSC-002, DSC-006) y sin Kobo ni efectivo (DSC-004) no son discrepancia.
  expect_false(any(c("DSC-002", "DSC-004", "DSC-006") %in% filas$CodPulso))
})

test_that("sin columna proGres el bloque sale igual, con proGres vacío", {
  filas <- dsc_filas(dsc_bloques(dsc_escenario(bar = dsc_barrido(con_progres = FALSE)))$discrepancias_telefonicas)
  expect_true(nrow(filas) > 0L)
  expect_true(all(filas$proGres == ""))
})

test_that("P1: mientras no se decide, la efectiva de Kobo cuenta; «no cuenta» la descuenta", {
  efectivas <- function(esc) {
    b <- dsc_bloques(esc)
    sum(as.integer(vapply(b$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)))
  }
  esc <- dsc_escenario()
  base <- efectivas(esc)
  expect_identical(base, 4L)
  # Que el bloque nuevo exista no mueve el avance: mismas efectivas que Kobo.
  aplicado <- .monitoreo_telefonico_decidir_discrepancia(esc$cfg, list(
    response_id = "R1", codpulso = "DSC-001", decision = "no_cuenta", note = "La persona dice que no respondió."
  ))
  expect_identical(unlist(aplicado$config$monitoreo_profile$reconciliation_decisions$exclude_response_ids), "R1")
  expect_identical(aplicado$decision$new_status, "no_cuenta")
  expect_identical(aplicado$decision$previous_status, "cuenta_mientras_tanto")

  descontada <- dsc_escenario(decisiones = aplicado$config$monitoreo_profile$reconciliation_decisions)
  expect_identical(efectivas(descontada), 3L)

  vuelta <- .monitoreo_telefonico_decidir_discrepancia(aplicado$config, list(
    response_id = "R1", codpulso = "DSC-001", decision = "cuenta", note = "Confirmado por el supervisor."
  ))
  recon <- vuelta$config$monitoreo_profile$reconciliation_decisions
  expect_length(unlist(recon$exclude_response_ids), 0L)
  expect_identical(recon$manual_case_reconciliations$R1$action, "include_with_caveat")
  expect_identical(recon$manual_case_reconciliations$R1$assigned_case_key, "DSC-001")
  expect_identical(recon$manual_case_reconciliations$R1$previous_status, "no_cuenta")
})

test_that("la decisión exige response_id, una de las dos opciones y nota", {
  cfg <- dsc_escenario()$cfg
  expect_error(.monitoreo_telefonico_decidir_discrepancia(cfg, list(decision = "cuenta", note = "x")), class = "api_error")
  expect_error(.monitoreo_telefonico_decidir_discrepancia(cfg, list(response_id = "R1", decision = "tal vez", note = "x")), class = "api_error")
  expect_error(.monitoreo_telefonico_decidir_discrepancia(cfg, list(response_id = "R1", decision = "cuenta", note = "  ")), class = "api_error")
})

test_that("una exclusión heredada de otra pantalla no mueve el avance telefónico", {
  efectivas <- function(esc) {
    b <- dsc_bloques(esc)
    sum(as.integer(vapply(b$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)))
  }
  heredada <- list(
    exclude_response_ids = list("R1"),
    manual_case_reconciliations = list(R1 = list(response_id = "R1", action = "keep_excluded", match_type = ""))
  )
  expect_identical(efectivas(dsc_escenario(decisiones = heredada)), 4L)
})

test_that("P4: el normalizador conserva las equivalencias de nombres confirmadas", {
  perfil <- monitoreo_normalize_profile(list(family = "telefonico", enumerator_equivalences = list(
    list(kobo = "op14", hoja = "Op-14"), list(kobo = "op14", hoja = "Otra"), list(kobo = " ", hoja = "X")
  )))
  expect_identical(perfil$enumerator_equivalences, list(list(kobo = "op14", hoja = "Op-14")))
  expect_null(monitoreo_normalize_profile(list(family = "telefonico"))$enumerator_equivalences)
})
