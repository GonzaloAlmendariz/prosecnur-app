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
    `Intro/Enumerator_name` = c("op 01", "OP-01", "Ana Pérez", "Pérez Ana")[seq_along(codigos)],
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
                   c("Sentido", "CodPulso", "proGres", "Responsable", "La hoja dice", "Fecha hoja", "Fecha Kobo",
                     "Enumerador Kobo", "Response ID", "Mismo responsable", "Decisión", "Nota", "Decidido el", "Destino"))
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

test_that("sin discrepancias el bloque sale vacío con sus columnas; con una «No cuenta» la conserva", {
  # Kobo y la hoja coinciden en DSC-002: nada que alertar.
  b <- dsc_bloques(dsc_escenario(bar = dsc_barrido()[2, ], kobo = "DSC-002"))
  expect_length(b$discrepancias_telefonicas$rows, 0L)
  expect_length(unlist(b$discrepancias_telefonicas$columns), 14L)
  decisiones <- list(manual_case_reconciliations = list(R9 = list(
    response_id = "R9", action = "keep_excluded", match_type = "telefonico_discrepancia",
    declared_code = "DSC-002", note = "x", decided_at = "2026-10-23T10:00:00Z"
  )), exclude_response_ids = list("R9"))
  solo <- dsc_filas(dsc_bloques(dsc_escenario(bar = dsc_barrido()[2, ], kobo = "DSC-002", decisiones = decisiones))$discrepancias_telefonicas)
  expect_identical(solo$`Response ID`, "R9")
  expect_identical(solo$`Decisión`, "no_cuenta")
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

test_that("P4: enumerator_equivalences se normaliza (un par por persona) y lee el alias name_equivalences", {
  perfil <- monitoreo_normalize_profile(list(family = "telefonico", enumerator_equivalences = list(
    list(kobo = " op14 ", hoja = "Op-14"), list(kobo = "OP14", hoja = "Otra"), list(kobo = " ", hoja = "X"),
    list(kobo = "Ana", hoja = "")
  )))
  expect_identical(perfil$enumerator_equivalences, list(list(kobo = "op14", hoja = "Op-14")))
  expect_null(perfil$name_equivalences)
  expect_null(monitoreo_normalize_profile(list(family = "telefonico"))$enumerator_equivalences)
  alias <- monitoreo_normalize_profile(list(family = "telefonico", name_equivalences = list(list(kobo = "a", hoja = "A"))))
  expect_identical(alias$enumerator_equivalences, list(list(kobo = "a", hoja = "A")))
  expect_null(alias$name_equivalences)
  # Sobrevive a la normalización completa de la config (lo que se guarda en el .pulso).
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "telefonico",
    enumerator_equivalences = list(list(kobo = "op14", hoja = "Op-14")))), data.frame())
  expect_identical(cfg$monitoreo_profile$enumerator_equivalences, list(list(kobo = "op14", hoja = "Op-14")))
})

test_that("cada fila trae enumerador, Response ID, decisión vigente y destino (P1, P3)", {
  filas <- dsc_filas(dsc_bloques(dsc_escenario())$discrepancias_telefonicas)
  kobo <- filas[filas$Sentido == "kobo_sin_hoja", ]
  hoja <- filas[filas$Sentido == "hoja_sin_kobo", ]
  expect_true(all(kobo$Destino == "decision"))
  expect_true(all(kobo$`Decisión` == "pendiente"))
  expect_identical(hoja$Destino, "avisos")
  expect_identical(hoja$`Decisión`, "")
  expect_identical(hoja$`Response ID`, "")
  # El enumerador sale de la pregunta del formulario («Intro/Enumerator_name»).
  expect_identical(kobo$`Response ID`[kobo$CodPulso == "DSC-001"], "R1")
  expect_identical(kobo$`Enumerador Kobo`[kobo$CodPulso == "DSC-001"], "op 01")
  # «op 01» y «Op-01» son la misma persona sin confirmar nada (P4).
  expect_identical(kobo$`Mismo responsable`[kobo$CodPulso == "DSC-001"], "Sí")
  # Fuera de base no tiene responsable con quien comparar.
  expect_identical(kobo$`Mismo responsable`[kobo$CodPulso == "DSC-005"], "")
})

test_that("una «No cuenta» sigue en la lista con su decisión y sin mover lo demás", {
  esc <- dsc_escenario()
  aplicado <- .monitoreo_telefonico_decidir_discrepancia(esc$cfg, list(
    response_id = "R1", codpulso = "DSC-001", decision = "no_cuenta", note = "No respondió."
  ))
  filas <- dsc_filas(dsc_bloques(dsc_escenario(decisiones = aplicado$config$monitoreo_profile$reconciliation_decisions))$discrepancias_telefonicas)
  fila <- filas[filas$`Response ID` == "R1", ]
  expect_identical(nrow(fila), 1L)
  expect_identical(fila$`Decisión`, "no_cuenta")
  expect_identical(fila$Nota, "No respondió.")
  expect_identical(fila$Responsable, "Op-01")
  expect_identical(fila$`La hoja dice`, "No contesta")
  expect_identical(fila$proGres, "XYZ-26-900001")
  expect_identical(fila$`Enumerador Kobo`, "op 01")
  expect_true(nzchar(fila$`Decidido el`))
  expect_identical(filas$`Decisión`[filas$CodPulso == "DSC-005"], "pendiente")
})

test_that("P4: la sugerencia ignora tildes, mayúsculas, puntuación y orden; la confirmada manda", {
  responsables <- c("Op-01", "Ana Perez", "Olga", "Luis Soto")
  expect_identical(.monitoreo_equivalencia_de("OP 01", responsables)$criterio, "normalizado")
  expect_identical(.monitoreo_equivalencia_de("Pérez Ana", responsables)[c("hoja", "criterio")], list(hoja = "Ana Perez", criterio = "orden"))
  expect_identical(.monitoreo_equivalencia_de("Olga Ramírez", responsables)[c("hoja", "criterio")], list(hoja = "Olga", criterio = "parcial"))
  expect_identical(.monitoreo_equivalencia_de("Op-01", responsables)$estado, "igual")
  expect_identical(.monitoreo_equivalencia_de("Nadie", responsables)$estado, "sin_par")
  conf <- .monitoreo_equivalencias_mapa(list(enumerator_equivalences = list(list(kobo = "Nadie", hoja = "Luis Soto"))))
  expect_identical(.monitoreo_equivalencia_de("nadie", responsables, conf)[c("hoja", "estado")], list(hoja = "Luis Soto", estado = "confirmada"))
  # El bloque: una fila por enumerador de Kobo, con sus envíos.
  eq <- .monitoreo_equivalencias_df(c("OP 01", "OP 01", "Nadie"), responsables, list())
  expect_identical(names(eq), c("Enumerador Kobo", "Responsable hoja", "Estado", "Criterio", "Envíos Kobo"))
  expect_identical(eq$Estado, c("sin_par", "sugerida"))
  expect_identical(eq$`Envíos Kobo`, c(1L, 2L))
})

test_that("el bloque equivalencias_nombres sale en el reporte telefónico", {
  b <- dsc_bloques(dsc_escenario())
  eq <- dsc_filas(b$equivalencias_nombres)
  expect_setequal(eq$`Enumerador Kobo`, c("op 01", "OP-01", "Ana Pérez", "Pérez Ana"))
  expect_identical(eq$Criterio[eq$`Enumerador Kobo` == "op 01"], "normalizado")
})

test_that("no regresión: el avance de acnur_pdm sigue en 423 con los bloques de T9", {
  pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  if (!file.exists(pulso)) skip("acnur_pdm.pulso no esta en inst/reference_projects")
  destino <- tempfile("pdm_")
  dir.create(destino)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  utils::unzip(pulso, files = "state.rds", exdir = destino)
  snap <- readRDS(file.path(destino, "state.rds"))$monitoreo_snapshot
  skip_if(is.null(snap$data) || is.null(snap$config), "el state no trae monitoreo_snapshot")
  b <- dsc_bloques(list(datos = snap$data, cfg = snap$config))
  expect_identical(sum(vapply(b$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)), 423L)
  filas <- dsc_filas(b$discrepancias_telefonicas)
  # P1: todas pendientes, ninguna decidida: cuentan mientras tanto.
  expect_true(all(filas$`Decisión`[filas$Sentido == "kobo_sin_hoja"] == "pendiente"))
  expect_true(all(filas$Destino[filas$Sentido == "hoja_sin_kobo"] == "avisos"))
  expect_identical(nrow(filas), 207L)
  # El enumerador de PDM vive en «Intro/Enumerator_name»: la muestra estratifica.
  resumen <- dsc_filas(b$supervision_resumen)
  expect_identical(resumen$Valor[resumen$Indicador == "Casos"], "24")
  expect_identical(length(b$supervision_reparto$rows), 16L)
})

test_that("HTTP: la decisión se guarda en la sesión y los errores salen con su E_*", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  ruta <- "/api/monitoreo/telefonico/discrepancia/decision"
  r <- http_post_json(srv, ruta, sid = sid, body = list(
    response_id = "R1", codpulso = "DSC-001", decision = "no_cuenta", note = "No respondió."
  ))
  expect_identical(r$status, 200L)
  expect_identical(r$json$decision$action, "keep_excluded")
  expect_identical(r$json$decision$match_type, "telefonico_discrepancia")
  expect_identical(r$json$decision$previous_status, "cuenta_mientras_tanto")
  # La segunda decisión ve la primera: quedó en reconciliation_decisions.
  vuelta <- http_post_json(srv, ruta, sid = sid, body = list(
    response_id = "R1", codpulso = "DSC-001", decision = "cuenta", note = "Confirmado."
  ))
  expect_identical(vuelta$status, 200L)
  expect_identical(vuelta$json$decision$previous_status, "no_cuenta")
  recon <- vuelta$json$state$config$monitoreo_profile$reconciliation_decisions
  expect_identical(recon$manual_case_reconciliations$R1$action, "include_with_caveat")

  # El cliente del frontend lo manda anidado: {decision: {...}}.
  anidada <- http_post_json(srv, ruta, sid = sid, body = list(decision = list(
    response_id = "R2", codpulso = "DSC-005", decision = "no_cuenta", note = "Fuera de base."
  )))
  expect_identical(anidada$status, 200L)
  expect_identical(anidada$json$decision$response_id, "R2")

  sin_nota <- http_post_json(srv, ruta, sid = sid, body = list(response_id = "R1", decision = "cuenta", note = ""))
  expect_identical(sin_nota$status, 400L)
  expect_identical(sin_nota$json$error$code, "E_MONITOREO_NOTE_REQUIRED")
  mala <- http_post_json(srv, ruta, sid = sid, body = list(response_id = "R1", decision = "quizas", note = "x"))
  expect_identical(mala$json$error$code, "E_MONITOREO_DECISION_ACTION")
  sin_id <- http_post_json(srv, ruta, sid = sid, body = list(decision = "cuenta", note = "x"))
  expect_identical(sin_id$json$error$code, "E_MONITOREO_RESPONSE_ID")
})
