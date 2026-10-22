# Contrato de la primera tanda de "Monitoreo telefonico para el ACNUR RMS 2026"
# (docs/qa/checklist-monitoreo-telefonico-rms-2026-10-22.md, C1-C7).
#
# Fixture sintetico y chico: 4 periodos x (10 Muestra + 10 Backup) = 80 hogares,
# codigos CGU-26-9xxxxxx y nombres "Hogar NNN" inventados. Sin red, sin reloj,
# sin rutas absolutas. Camino de construccion: el mismo que el snapshot real
# (fuentes -> columnas de fuente -> bind -> config normalizada -> reporte).

PERIODOS_RMS <- c("Pre visa humanitaria", "Pandemia", "Post-pandemia", "Actualidad")

rms_barrido <- function(col_llave = "Código proGres", con_codpulso = FALSE,
                        status_extra = NULL) {
  filas <- list()
  n <- 0L
  for (k in seq_along(PERIODOS_RMS)) {
    for (origen in c("Muestra", "Backup")) {
      for (i in 1:10) {
        n <- n + 1L
        status <- "No barrido"
        if (origen == "Muestra") {
          status <- c("Efectivo", "Efectivo", "Efectivo", "Efectivo",
                      "Encuesta parcial", "Rechazo", "No contesta",
                      "No barrido", "No barrido", "No barrido")[i]
        }
        fila <- data.frame(
          Origen = origen,
          Llave = sprintf("CGU-26-9%06d", n),
          Nombre = sprintf("Hogar %03d", n),
          Periodo = PERIODOS_RMS[k],
          Responsable = if (origen == "Muestra") sprintf("Encuestador %02d", k) else "",
          Status = status,
          Intentos = if (status == "No barrido") "0" else "1",
          Fecha = if (status == "No barrido") "" else "24/10/2026",
          `Telefono 1` = sprintf("+5199%07d", n),
          check.names = FALSE, stringsAsFactors = FALSE
        )
        names(fila)[names(fila) == "Llave"] <- col_llave
        if (isTRUE(con_codpulso)) fila$CodPulso <- sprintf("PUL-%04d", n)
        filas[[n]] <- fila
      }
    }
  }
  out <- do.call(rbind, filas)
  if (!is.null(status_extra)) {
    # Reemplaza el Status de las primeras filas "No barrido" de Muestra.
    idx <- which(out$Origen == "Muestra" & out$Status == "No barrido")[seq_along(status_extra)]
    out$Status[idx] <- status_extra
  }
  out
}

rms_respuesta <- function(codigo, enc = "Encuestador 01", consent = "yes",
                          test = "real", consent_col = "group_consent/Intro04") {
  out <- data.frame(
    start = "2026-10-24T10:00:00.000-05:00",
    end = "2026-10-24T10:30:00.000-05:00",
    `intro/interviewdate` = "2026-10-24",
    `intro/test_real` = test,
    `intro/name_enumerator` = enc,
    `intro/Intro01` = codigo,
    `_status` = "submitted_via_web",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out[[consent_col]] <- consent
  out
}

# Respuestas de Kobo para los hogares Efectivo del barrido.
rms_respuestas <- function(bar, col_llave = "Código proGres", n_cruzan = NULL,
                           n_huerfanas = 1L, formato_libre = 0L,
                           consent_col = "group_consent/Intro04") {
  ef <- which(bar$Status == "Efectivo")
  if (!is.null(n_cruzan)) ef <- ef[seq_len(n_cruzan)]
  cods <- bar[[col_llave]][ef]
  if (formato_libre > 0L) {
    idx <- seq_len(formato_libre)
    cods[idx] <- tolower(gsub("-", " ", cods[idx]))
  }
  if (n_huerfanas > 0L) cods <- c(cods, sprintf("CGU-26-99999%02d", seq_len(n_huerfanas)))
  if (!length(cods)) return(NULL)
  resp <- do.call(rbind, lapply(cods, rms_respuesta, consent_col = consent_col))
  resp$response_status <- resp$`_status`
  resp$Responsable <- resp$`intro/name_enumerator`
  resp$Fecha <- "24/10/2026"
  resp
}

rms_state_rules <- function() {
  regla <- function(id, estado, valores, prioridad, stop = FALSE) {
    list(id = id, label = id, final_state = estado, priority = prioridad,
         outcome_values = as.list(valores), stop_contact = stop)
  }
  list(
    regla("rms_efectivo", "complete", "Efectivo", 1L),
    regla("rms_parcial", "partial", "Encuesta parcial", 2L),
    regla("rms_rechazo", "refusal", "Rechazo", 3L, TRUE),
    regla("rms_no_efectivo", "non_effective",
          c("No contesta", "Apagado", "Número Incorrecto", "No existe el número",
            "Número suspendido", "Colgó / Cortó la llamada",
            "No efectivo / No beneficiario"), 4L),
    regla("rms_pendiente", "pending",
          c("No barrido", "Contactar después", "Contactado por Whatsapp",
            "Contactado por mensaje de texto"), 5L)
  )
}

# Devuelve list(datos, cfg, bar, resp). `bar`/`resp` son los data.frame crudos.
rms_escenario <- function(bar = rms_barrido(), resp = NULL,
                          declared_person_code_var = "",
                          key_rules = NULL,
                          etiqueta_intro01 = "Código proGres",
                          status_from_rules = NULL,
                          filtro_consent = "group_consent/Intro04",
                          filtro_consent_habilitado = TRUE) {
  if (is.null(resp)) resp <- rms_respuestas(bar)
  mkfuente <- function(id, rol, kind, label, extra = list()) {
    utils::modifyList(list(
      id = id, kind = kind, label = label, enabled = TRUE, role = rol,
      integration_mode = "connected_read", dimensions = list(),
      sheet_binding = list(spreadsheet_id = paste0("fx_", rol), sheet_name = "Barrido", header_row = 1L),
      last_sync_at = "2026-10-23T12:00:00Z"
    ), extra)
  }
  f_bar <- mkfuente("rms_barrido", "barrido", "google_sheets", "RMS barrido",
                    list(actor_var = "Periodo"))
  f_kobo <- mkfuente("rms_kobo", "respuestas", "kobo", "RMS Kobo",
                     if (nzchar(declared_person_code_var)) list(declared_person_code_var = declared_person_code_var) else list())
  fuentes <- monitoreo_normalize_sources(list(f_bar, f_kobo))
  src <- function(id) Filter(function(f) identical(f$id, id), fuentes)[[1]]

  if (!is.null(resp) && nzchar(etiqueta_intro01)) {
    resp <- .monitoreo_set_source_variable_labels(resp, "rms_kobo", c(`intro/Intro01` = etiqueta_intro01))
  }
  partes <- list(.monitoreo_add_source_columns(bar, src("rms_barrido")))
  if (!is.null(resp)) partes[[2]] <- .monitoreo_add_source_columns(resp, src("rms_kobo"))
  datos <- .monitoreo_bind_rows(partes)

  perfil <- list(
    family = "telefonico", variant = "multi_actor", status = "active", route_selected = TRUE,
    platform_effective_filter = list(
      enabled = filtro_consent_habilitado, variable = filtro_consent,
      values = list("yes"), label = "Consentimiento", value_label = "yes", source_kind = "kobo"),
    platform_test_filter = list(
      enabled = TRUE, variable = "intro/test_real", values = list("test"),
      real_values = list("real"), label = "Prueba o real", value_label = "test"),
    key_rules = key_rules %||% list(
      universe_fields = list(), response_fields = list(),
      use_name_fallback = FALSE, automatic_detection = TRUE),
    alerts = list(no_answer_min_attempts = 4L, unassigned_cases_min = 3L,
                  no_sweep_min_cases = 10L, no_sweep_pct = 0.5)
  )
  if (!is.null(status_from_rules)) perfil$status_from_rules <- isTRUE(status_from_rules)
  spec <- list(
    objetivo_total = 40L, date_var = "Fecha", control_vars = list(),
    goals = lapply(PERIODOS_RMS, function(p) list(filters = list(Actor = p), meta = 10L, meta_pct = 50)),
    operational_model = list(
      cases = list(enabled = TRUE, case_id_var = "Código proGres",
                   person_label_var = "Nombre", status_var = "Status",
                   contact_vars = list("Telefono 1"), roster_source = "universo"),
      state_rules = rms_state_rules()),
    monitoreo_profile = perfil
  )
  cfg <- monitoreo_normalize_config(spec, datos)
  list(datos = datos, cfg = cfg, bar = bar, resp = resp)
}

rms_alertas <- function(esc) {
  .monitoreo_report_alerts_df(esc$datos, esc$cfg$monitoreo_profile)
}

rms_tipos <- function(esc) {
  al <- rms_alertas(esc)
  if (!is.data.frame(al) || !nrow(al)) return(character(0))
  as.character(al[["Tipo alerta"]])
}

rms_alerta <- function(esc, tipo) {
  al <- rms_alertas(esc)
  al[al[["Tipo alerta"]] == tipo, , drop = FALSE]
}

rms_llaves <- function(esc, rol, origen) {
  d <- esc$datos[esc$datos$.source_role == rol, , drop = FALSE]
  .monitoreo_report_key_list(d, esc$cfg$monitoreo_profile, origen)
}

# ---------------------------------------------------------------------------
# C1 · Llave proGres del barrido
# ---------------------------------------------------------------------------

test_that("C1: la columna «Código proGres» del barrido es llave de código sin declarar key_rules", {
  esc <- rms_escenario()
  llaves <- rms_llaves(esc, "barrido", "universo")

  expect_length(llaves, 80L)
  expect_true(all(lengths(llaves) >= 1L))
  esperada <- .monitoreo_code_keys("CGU-26-9000001")
  expect_true(any(esperada %in% llaves[[1]]))
  # Cada hogar tiene una llave de código (hoy solo salen llaves de teléfono).
  expect_true(all(vapply(llaves, function(k) any(startsWith(k, "codigo:")), logical(1))))
})

test_that("C1: respaldo, si el barrido trae CodPulso las llaves no incluyen la columna proGres", {
  esc <- rms_escenario(bar = rms_barrido(con_codpulso = TRUE))
  d <- esc$datos[esc$datos$.source_role == "barrido", , drop = FALSE]
  detalles <- .monitoreo_report_key_details(d, esc$cfg$monitoreo_profile, "universo")
  columnas <- unique(unlist(lapply(detalles, function(items) vapply(items, function(i) i$column, ""))))

  expect_true("CodPulso" %in% columnas)
  expect_false("Código proGres" %in% columnas)
})

# ---------------------------------------------------------------------------
# C2 · Llave proGres de las respuestas
# ---------------------------------------------------------------------------

rms_cruzan <- function(esc) {
  lu <- unlist(rms_llaves(esc, "barrido", "universo"))
  lr <- rms_llaves(esc, "respuestas", "respuesta")
  vapply(lr, function(k) any(k %in% lu), logical(1))
}

test_that("C2: intro/Intro01 con etiqueta «Código proGres» cruza sin declarar la variable; la huérfana no", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar, formato_libre = 2L)
  esc <- rms_escenario(bar = bar, resp = resp)
  cruza <- rms_cruzan(esc)

  expect_length(cruza, 17L)
  expect_equal(sum(cruza), 16L)
  expect_false(cruza[[17L]])
  # Las dos escritas «cgu 26 …» cruzan con CGU-26-… del barrido.
  expect_true(all(cruza[1:2]))
})

test_that("C2: respaldo, la variable declarada manda sobre la etiqueta proGres", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar)
  resp$otra_col <- resp$`intro/Intro01`
  resp$`intro/Intro01` <- paste0("X", seq_len(nrow(resp)))  # ruido: no es la llave
  esc <- rms_escenario(bar = bar, resp = resp, declared_person_code_var = "otra_col")
  d <- esc$datos[esc$datos$.source_role == "respuestas", , drop = FALSE]
  detalles <- .monitoreo_report_key_details(d, esc$cfg$monitoreo_profile, "respuesta")
  columnas <- unique(unlist(lapply(detalles, function(items) vapply(items, function(i) i$column, ""))))

  expect_true("otra_col" %in% columnas)
  expect_false("intro/Intro01" %in% columnas)
})

test_that("C2: respaldo, Pulso_code manda sobre la etiqueta proGres", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar)
  resp$Pulso_code <- resp$`intro/Intro01`
  resp$`intro/Intro01` <- paste0("X", seq_len(nrow(resp)))
  esc <- rms_escenario(bar = bar, resp = resp)
  d <- esc$datos[esc$datos$.source_role == "respuestas", , drop = FALSE]
  detalles <- .monitoreo_report_key_details(d, esc$cfg$monitoreo_profile, "respuesta")
  columnas <- unique(unlist(lapply(detalles, function(items) vapply(items, function(i) i$column, ""))))

  expect_true("Pulso_code" %in% columnas)
  expect_false("intro/Intro01" %in% columnas)
})

# ---------------------------------------------------------------------------
# C3 · Aviso fuerte de cruce
# ---------------------------------------------------------------------------

rms_resp_que_no_cruzan <- function(n) {
  r <- do.call(rbind, lapply(sprintf("CGU-26-98888%02d", seq_len(n)), rms_respuesta))
  r$response_status <- r$`_status`
  r$Responsable <- r$`intro/name_enumerator`
  r$Fecha <- "24/10/2026"
  r
}

test_that("C3: si ninguna respuesta cruza hay cruce_llave_bajo con la frase del contrato", {
  esc <- rms_escenario(resp = rms_resp_que_no_cruzan(6L))
  a <- rms_alerta(esc, "cruce_llave_bajo")

  expect_equal(nrow(a), 1L)
  expect_identical(as.character(a$Nivel), "Alta")
  expect_match(as.character(a$Detalle), "ninguna respuesta cruza con el barrido", fixed = TRUE)
})

test_that("C3: cruza menos de 50 % con 5 o más respuestas emite cruce_llave_bajo", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar, n_cruzan = 3L, n_huerfanas = 7L)  # 3 de 10
  esc <- rms_escenario(bar = bar, resp = resp)

  expect_true("cruce_llave_bajo" %in% rms_tipos(esc))
})

test_that("C3: cruza 50 % o más no emite cruce_llave_bajo", {
  bar <- rms_barrido()
  esc <- rms_escenario(bar = bar, resp = rms_respuestas(bar))  # 16 de 17

  expect_false("cruce_llave_bajo" %in% rms_tipos(esc))
})

test_that("C3: con menos de 5 respuestas no emite cruce_llave_bajo aunque ninguna cruce", {
  esc <- rms_escenario(resp = rms_resp_que_no_cruzan(3L))

  expect_false("cruce_llave_bajo" %in% rms_tipos(esc))
})

# ---------------------------------------------------------------------------
# C4 · Filtro cuya columna no existe
# ---------------------------------------------------------------------------

test_that("C4: Intro04 declarado y group_consent/Intro04 real emite filtro_columna_no_encontrada con la sugerencia", {
  esc <- rms_escenario(filtro_consent = "Intro04")
  a <- rms_alerta(esc, "filtro_columna_no_encontrada")

  expect_gte(nrow(a), 1L)
  texto <- paste(as.character(a$Detalle), collapse = " ")
  expect_match(texto, "Intro04", fixed = TRUE)
  expect_match(texto, "group_consent/Intro04", fixed = TRUE)
})

test_that("C4: sin aviso cuando la variable del filtro resuelve", {
  esc <- rms_escenario(filtro_consent = "group_consent/Intro04")

  expect_false("filtro_columna_no_encontrada" %in% rms_tipos(esc))
})

test_that("C4: sin aviso cuando el filtro está deshabilitado aunque la variable no exista", {
  esc <- rms_escenario(filtro_consent = "Intro04", filtro_consent_habilitado = FALSE)

  expect_false("filtro_columna_no_encontrada" %in% rms_tipos(esc))
})

# ---------------------------------------------------------------------------
# C5 · Status por reglas (opt-in)
# ---------------------------------------------------------------------------

rms_estados_barrido <- function(esc) {
  b <- esc$datos[esc$datos$.source_role == "barrido", , drop = FALSE]
  est <- .monitoreo_report_states(b, esc$cfg$monitoreo_profile)
  stats::setNames(est, b$Status)
}

test_that("C5: bandera apagada, «Encuesta parcial» sigue en «Sin respuesta» y solo Efectivo/Rechazo tienen estado propio", {
  esc <- rms_escenario()
  est <- rms_estados_barrido(esc)

  expect_true(all(est[names(est) == "Efectivo"] == "Completa"))
  expect_true(all(est[names(est) == "Rechazo"] == "Rechazo"))
  expect_true(all(est[names(est) == "Encuesta parcial"] == "Sin respuesta"))
  expect_true(all(est[names(est) == "No contesta"] == "Sin respuesta"))
  expect_false("Parcial" %in% est)
})

test_that("C5: bandera encendida, las reglas dan Completa/Parcial/Rechazo/Sin respuesta", {
  esc <- rms_escenario(status_from_rules = TRUE)
  est <- rms_estados_barrido(esc)

  expect_true(all(est[names(est) == "Efectivo"] == "Completa"))
  expect_true(all(est[names(est) == "Encuesta parcial"] == "Parcial"))
  expect_true(all(est[names(est) == "Rechazo"] == "Rechazo"))
  expect_true(all(est[names(est) == "No contesta"] == "Sin respuesta"))
  expect_true(all(est[names(est) == "No barrido"] == "Sin respuesta"))
})

test_that("C5: bandera encendida, la columna Parciales de la cuota por periodo cuenta las parciales", {
  esc <- rms_escenario(status_from_rules = TRUE)
  bloques <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  cuotas <- Filter(function(b) identical(b$id, "cuotas_variable"), bloques)[[1]]$rows
  parciales <- vapply(cuotas, function(r) suppressWarnings(as.numeric(r$Parciales %||% NA)), numeric(1))

  # Una fila por periodo (dim_actor) y una «Encuesta parcial» de barrido en cada uno.
  expect_length(parciales, 4L)
  expect_equal(unname(parciales), rep(1, 4))
})

# ---------------------------------------------------------------------------
# C6 · Status desconocido
# ---------------------------------------------------------------------------

test_that("C6: bandera encendida, un Status mal escrito emite status_desconocido con valor y conteo", {
  bar <- rms_barrido(status_extra = rep("Número Incorrrecto", 6L))
  esc <- rms_escenario(bar = bar, status_from_rules = TRUE)
  a <- rms_alerta(esc, "status_desconocido")

  expect_gte(nrow(a), 1L)
  texto <- paste(as.character(a$Detalle), collapse = " ")
  expect_match(texto, "Número Incorrrecto", fixed = TRUE)
  expect_match(texto, "6", fixed = TRUE)
})

test_that("C6: bandera encendida sin Status desconocidos no emite status_desconocido", {
  esc <- rms_escenario(status_from_rules = TRUE)

  expect_false("status_desconocido" %in% rms_tipos(esc))
})

test_that("C6: bandera apagada no emite status_desconocido aunque haya un Status mal escrito", {
  bar <- rms_barrido(status_extra = rep("Número Incorrrecto", 6L))
  esc <- rms_escenario(bar = bar)

  expect_false("status_desconocido" %in% rms_tipos(esc))
})

# ---------------------------------------------------------------------------
# C7 · No regresión: cifras de acnur_pdm con todo apagado
# ---------------------------------------------------------------------------
# Valores medidos el 2026-10-22 ANTES de implementar la primera tanda. Si este
# test se pone rojo, la tanda movio cifras de un proyecto existente.

test_that("C7: las cifras de cuotas, resumen y responsables de acnur_pdm no cambian con todo apagado", {
  pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  if (!file.exists(pulso)) skip("acnur_pdm.pulso no esta en inst/reference_projects")
  destino <- tempfile("pdm_")
  dir.create(destino)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  utils::unzip(pulso, files = "state.rds", exdir = destino)
  s <- readRDS(file.path(destino, "state.rds"))
  snap <- s$monitoreo_snapshot
  skip_if(is.null(snap$data) || is.null(snap$config), "el state no trae monitoreo_snapshot")
  cfg <- snap$config
  expect_false(isTRUE(cfg$monitoreo_profile$status_from_rules))

  bloques <- .monitoreo_report_phone_blocks(snap$data, cfg$monitoreo_profile, cfg)
  filas <- function(id) Filter(function(b) identical(b$id, id), bloques)[[1]]$rows
  celda <- function(r, k) paste(as.character(r[[k]]), collapse = "")

  expect_identical(
    vapply(filas("resumen_telefonico"), function(r) paste(celda(r, "Indicador"), celda(r, "Casos"), sep = "|"), ""),
    c("Casos barridos|631", "No barridos|1665", "Total telefónico|2296")
  )
  expect_identical(
    vapply(filas("cuotas_variable"), function(r) {
      paste(celda(r, "Actor"), celda(r, "Valor"), celda(r, "Universo"), celda(r, "Meta"),
            celda(r, "Efectivas"), celda(r, "Parciales"), sep = "|")
    }, ""),
    c("Total|Cercado de Lima|501|95|100|0", "Total|Chorrillos|246|58|59|0",
      "Total|Pueblo Libre (PL)|337|41|45|0",
      "Total|San Juan de Lurigancho (SJL)|614|107|109|0",
      "Total|San Martín de Porres (SMP)|598|99|110|0",
      "11_ACNUR_PDM_Base de barrido|Cercado de Lima|501||100|0",
      "11_ACNUR_PDM_Base de barrido|Chorrillos|246||59|0",
      "11_ACNUR_PDM_Base de barrido|Pueblo Libre (PL)|337||45|0",
      "11_ACNUR_PDM_Base de barrido|San Juan de Lurigancho (SJL)|614||109|0",
      "11_ACNUR_PDM_Base de barrido|San Martín de Porres (SMP)|598||110|0")
  )
  expect_identical(
    vapply(filas("operacion_responsable"), function(r) {
      paste(celda(r, "Responsable"), celda(r, "Casos asignados"), celda(r, "Barridos"),
            celda(r, "No barridos"), celda(r, "Efectivas"), celda(r, "Efectivas Kobo"), sep = "|")
    }, ""),
    c("Sin responsable|1197|0|1197|0|4", "Olga|141|92|49|26|50",
      "Nestor|53|4|49|2|23", "Elena|53|7|46|6|23", "Diego|102|61|41|17|31",
      "Ana|100|59|41|25|40", "Patricia|100|61|39|23|42", "Lucia|53|16|37|5|13",
      "Fiorella|99|65|34|24|38", "Andres|94|62|32|19|32", "Luis|53|21|32|5|14",
      "Ricardo|92|67|25|26|35", "Karina|106|82|24|28|51", "Javier|53|34|19|16|27")
  )
})
