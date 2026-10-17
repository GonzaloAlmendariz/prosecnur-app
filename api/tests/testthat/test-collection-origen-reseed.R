# E1e — «Actualizar desde la fuente» y el contrato HTTP de GET /origen.
#
# Rehacer descarta fichas y recibos; si la fuente cambia entre que el usuario
# mira las diferencias y confirma, rehacer con OTRA cosa que la revisada es
# justo lo que la confirmacion existe para impedir. `expected_source_fingerprint`
# es opcional para no romper al cliente de hoy.

.orr_filas <- function(n = 4L) {
  data.frame(
    selection_run_id = "sel_aulas_20260801211224_aaaa1111",
    classroom_id = sprintf("cur%03d_%04d", seq_len(n), 100L + seq_len(n)),
    operational_code = sprintf("CH %d", seq_len(n)),
    sample_role = "titular",
    operational_sequence = seq_len(n),
    label = sprintf("Curso %d", seq_len(n)),
    faculty = "Derecho",
    eligible_n = 30,
    stringsAsFactors = FALSE
  )
}

.orr_sid <- function() {
  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .orr_filas()))
  collection_state_seed(sid)
  sel <- session_get(sid)$calc_muestra_aulas_selection
  sel$selection <- .orr_filas(6L)[-1, ]
  session_set(sid, "calc_muestra_aulas_selection", sel)
  sid
}

.orr_call <- function(pr, sid, method, path, body = "", query = "") {
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = query,
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status), raw = as.character(r$body),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.orr_json <- function(x) {
  as.character(jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", na = "null", digits = NA))
}

.orr_pr <- function() {
  mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
}

test_that("propuesto trae la huella y las diferencias que listaba Origen", {
  sid <- .orr_sid()
  on.exit(session_delete(sid), add = TRUE)
  g <- collection_origen_get(sid)
  v <- collection_state_reseed(sid, g$state_revision, dry_run = TRUE)
  expect_identical(v$propuesto$huella, g$fingerprint_actual)
  expect_identical(
    unlist(v$propuesto$diferencias[c("altas", "bajas", "campos", "roles", "unidades_con_cambios")]),
    unlist(g$resumen[c("altas", "bajas", "campos", "roles", "unidades_con_cambios")])
  )
  expect_equal(v$propuesto$diferencias$altas, 2L)
  expect_equal(v$propuesto$diferencias$bajas, 1L)
})

test_that("la huella esperada vigente deja rehacer; una vieja rebota con 409", {
  sid <- .orr_sid()
  on.exit(session_delete(sid), add = TRUE)
  g <- collection_origen_get(sid)
  expect_invisible(collection_origen_assert_huella(sid, g$fingerprint_actual))
  expect_invisible(collection_origen_assert_huella(sid, NULL))
  err <- tryCatch(collection_origen_assert_huella(sid, g$fingerprint_plan), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_ORIGEN_CAMBIO")
  expect_identical(err$status, 409)
  expect_identical(err$details$current_source_fingerprint, g$fingerprint_actual)
})

test_that("HTTP: reseed con huella vieja da 409 y no muta; sin huella, como hoy", {
  testthat::skip_if_not_installed("plumber")
  sid <- .orr_sid()
  on.exit(session_delete(sid), add = TRUE)
  pr <- .orr_pr()
  g <- collection_origen_get(sid)
  rev <- g$state_revision

  viejo <- .orr_call(pr, sid, "POST", "/api/recopiladores/reseed", .orr_json(list(
    expected_revision = rev, expected_source_fingerprint = g$fingerprint_plan
  )))
  expect_identical(viejo$status, 409L, info = substr(viejo$raw, 1, 400))
  expect_identical(viejo$body$error$code %||% viejo$body$code, "E_COLLECTION_ORIGEN_CAMBIO")
  expect_identical(session_get(sid)$collection_state$state_revision, rev)

  bueno <- .orr_call(pr, sid, "POST", "/api/recopiladores/reseed", .orr_json(list(
    expected_revision = rev, expected_source_fingerprint = g$fingerprint_actual, dry_run = TRUE
  )))
  expect_identical(bueno$status, 200L, info = substr(bueno$raw, 1, 400))
  expect_identical(bueno$body$propuesto$huella, g$fingerprint_actual)

  compat <- .orr_call(pr, sid, "POST", "/api/recopiladores/reseed", .orr_json(list(expected_revision = rev)))
  expect_identical(compat$status, 200L, info = substr(compat$raw, 1, 400))
  expect_true(isTRUE(compat$body$reseeded))
  expect_identical(collection_origen_get(sid)$estado, "al_dia")
})

test_that("HTTP: GET /origen esta montado y lee nivel y limite de la query", {
  testthat::skip_if_not_installed("plumber")
  sid <- .orr_sid()
  on.exit(session_delete(sid), add = TRUE)
  pr <- .orr_pr()

  d <- .orr_call(pr, sid, "GET", "/api/recopiladores/origen", query = "limite=1")
  expect_identical(d$status, 200L, info = substr(d$raw, 1, 400))
  expect_identical(d$body$schema, "collection_origen/v1")
  expect_identical(d$body$nivel, "diferencias")
  expect_identical(d$body$estado, "cambio")
  expect_identical(d$body$limite, 1L)
  expect_length(d$body$cambios$altas, 1L)
  expect_true(isTRUE(d$body$truncado$altas))
  expect_identical(d$body$resumen$altas, 2L)

  r <- .orr_call(pr, sid, "GET", "/api/recopiladores/origen", query = "nivel=resumen")
  expect_identical(r$status, 200L, info = substr(r$raw, 1, 400))
  expect_identical(r$body$nivel, "resumen")
  expect_null(r$body$cambios)
  expect_null(r$body$truncado)
  # Una sola vigencia: resumen decide por huella, igual que diferencias.
  expect_identical(r$body$veredicto, "huella")
  expect_identical(r$body$estado, d$body$estado)
  expect_identical(r$body$stale, d$body$stale)
  expect_identical(r$body$fingerprint_actual, d$body$fingerprint_actual)
  expect_identical(r$body$resumen$altas, 2L)
  expect_identical(r$body$resumen$afectadas, d$body$resumen$afectadas)
  expect_identical(names(r$body$resumen$fichas_cobertura), c("juegos", "unidades_cubiertas"))

  mal <- .orr_call(pr, sid, "GET", "/api/recopiladores/origen", query = "nivel=todo")
  expect_identical(mal$status, 400L)
})

test_that("los codigos E_ de Origen estan registrados", {
  registro <- paste(readLines(test_path("..", "..", "R", "errors_registry.R"), warn = FALSE), collapse = "\n")
  expect_true(grepl("E_COLLECTION_ORIGEN_CAMBIO", registro, fixed = TRUE))
  expect_true(grepl("E_COLLECTION_ORIGEN_PARAMETRO", registro, fixed = TRUE))
})
