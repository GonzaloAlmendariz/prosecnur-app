# Tests de la unidad 3.8 — sync rápido Kobo/SurveyMonkey + publicación Sheets
# efectiva. TODO corre sin red: el transporte se mockea en los seams
# (.sm_api_http_fetch / .kobo_api_http_fetch / .monitoreo_google_api) con
# fixtures sintéticas sanitizadas (sin tokens reales, sin PII real).

# --- Fixtures y helpers ------------------------------------------------------

.msi_res <- function(status, body = "{}", headers = character(0)) {
  header_lines <- c(sprintf("HTTP/1.1 %d STATUS", as.integer(status)), headers, "", "")
  list(
    status_code = as.integer(status),
    content = charToRaw(body),
    headers = charToRaw(paste(header_lines, collapse = "\r\n"))
  )
}

.msi_query_param <- function(url, name) {
  pattern <- paste0("[?&]", name, "=([^&]*)")
  m <- regmatches(url, regexec(pattern, url))[[1]]
  if (length(m) < 2L) return("")
  utils::URLdecode(m[[2]])
}

# 300 respuestas sintéticas con date_modified crecientes (una por segundo).
.msi_sm_responses <- function(n = 300L) {
  base <- as.POSIXct("2026-07-01 00:00:00", tz = "UTC")
  lapply(seq_len(n), function(i) {
    list(
      id = sprintf("r%03d", i),
      date_created = format(base + i, "%Y-%m-%dT%H:%M:%SZ"),
      date_modified = format(base + i, "%Y-%m-%dT%H:%M:%SZ"),
      pages = list()
    )
  })
}

# Servidor bulk SM de mentira. honor_cursor controla si aplica
# start_modified_at (para el fallback detectable).
.msi_sm_bulk_mock <- function(responses, honor_cursor = TRUE) {
  env <- new.env(parent = emptyenv())
  env$requests <- character(0)
  handler <- function(url, handle) {
    env$requests <- c(env$requests, url)
    if (!grepl("/responses/bulk", url, fixed = TRUE)) {
      return(.msi_res(200L, "{}"))
    }
    page <- suppressWarnings(as.integer(.msi_query_param(url, "page")))
    if (!is.finite(page) || page < 1L) page <- 1L
    per_page <- suppressWarnings(as.integer(.msi_query_param(url, "per_page")))
    if (!is.finite(per_page) || per_page < 1L) per_page <- 100L
    cursor <- .msi_query_param(url, "start_modified_at")
    pool <- responses
    if (isTRUE(honor_cursor) && nzchar(cursor)) {
      cursor_ts <- as.POSIXct(cursor, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC")
      pool <- Filter(function(r) {
        ts <- as.POSIXct(r$date_modified, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC")
        !is.na(ts) && !is.na(cursor_ts) && ts >= cursor_ts
      }, pool)
    }
    from <- (page - 1L) * per_page + 1L
    to <- min(length(pool), page * per_page)
    rows <- if (from > length(pool)) list() else pool[from:to]
    body <- jsonlite::toJSON(
      list(total = length(pool), data = rows),
      auto_unbox = TRUE, null = "null"
    )
    .msi_res(200L, as.character(body))
  }
  list(env = env, handler = handler)
}

# --- A. Cursor SurveyMonkey server-side -------------------------------------

test_that("cursor SM: delta de 5 sobre 300 baja en <= ceil(5/100)+1 requests", {
  responses <- .msi_sm_responses(300L)
  cursor <- responses[[296L]]$date_modified # deja pasar r296..r300 (delta 5)
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  testthat::local_mocked_bindings(.sm_api_http_fetch = mock$handler)

  out <- sm_api_fetch_all_responses_bulk(
    survey_id = "900100",
    token = "tok-fixture-sanitizado",
    start_modified_at = cursor
  )

  expect_true(out$ok)
  expect_equal(out$count, 5L)
  expect_lte(length(mock$env$requests), ceiling(5 / 100) + 1L)
  expect_true(all(grepl("start_modified_at=", mock$env$requests, fixed = TRUE)))
  expect_true(out$cursor_applied)
  expect_equal(out$max_modified_at, responses[[300L]]$date_modified)
  ids <- vapply(out$data, function(r) r$id, character(1))
  expect_equal(ids, c("r296", "r297", "r298", "r299", "r300"))
})

test_that("cursor SM: fallback detectable cuando el servidor ignora el filtro (warning + mismos numeros)", {
  responses <- .msi_sm_responses(300L)
  cursor <- responses[[296L]]$date_modified
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = FALSE)
  testthat::local_mocked_bindings(.sm_api_http_fetch = mock$handler)

  expect_warning(
    out <- sm_api_fetch_all_responses_bulk(
      survey_id = "900100",
      token = "tok-fixture-sanitizado",
      start_modified_at = cursor
    ),
    "ignoro 'start_modified_at'"
  )

  # El filtro local preserva el delta exacto aunque el servidor no opere.
  expect_equal(out$count, 5L)
  expect_false(out$cursor_applied)
  ids <- vapply(out$data, function(r) r$id, character(1))
  expect_equal(ids, c("r296", "r297", "r298", "r299", "r300"))
  # Descarga completa paginada: 300/100 => 3 paginas llenas + 1 vacia.
  expect_equal(length(mock$env$requests), 4L)
})

test_that("cursor SM: PROSECNUR_SM_CURSOR=0 apaga el cursor (paridad con el full previo)", {
  old <- Sys.getenv("PROSECNUR_SM_CURSOR", unset = NA_character_)
  on.exit({
    if (is.na(old)) Sys.unsetenv("PROSECNUR_SM_CURSOR") else Sys.setenv(PROSECNUR_SM_CURSOR = old)
  }, add = TRUE)
  Sys.setenv(PROSECNUR_SM_CURSOR = "0")
  expect_false(.sm_cursor_flag_enabled())

  responses <- .msi_sm_responses(120L)
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  testthat::local_mocked_bindings(.sm_api_http_fetch = mock$handler)
  out <- sm_api_fetch_all_responses_bulk(
    survey_id = "900100",
    token = "tok-fixture-sanitizado",
    start_modified_at = responses[[100L]]$date_modified
  )
  expect_false(out$cursor_enabled)
  expect_equal(out$count, 120L)
  expect_false(any(grepl("start_modified_at=", mock$env$requests, fixed = TRUE)))
})

test_that("cursor SM: paginacion completa sin cursor baja todo en orden", {
  responses <- .msi_sm_responses(250L)
  mock <- .msi_sm_bulk_mock(responses)
  testthat::local_mocked_bindings(.sm_api_http_fetch = mock$handler)
  out <- sm_api_fetch_all_responses_bulk(survey_id = "900100", token = "tok-fixture-sanitizado")
  expect_equal(out$count, 250L)
  expect_equal(out$total, 250L)
  # 100+100+50: la tercera pagina corta la paginacion (respuesta parcial).
  expect_equal(length(mock$env$requests), 3L)
  expect_equal(out$max_modified_at, responses[[250L]]$date_modified)
})

# --- B. Backoff 429 compartido ----------------------------------------------

test_that("backoff SM: 429 con Retry-After espera lo indicado y reintenta hasta el 200", {
  hits <- 0L
  sleeps <- numeric(0)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = function(url, handle) {
      hits <<- hits + 1L
      if (hits == 1L) return(.msi_res(429L, "{}", headers = "Retry-After: 7"))
      .msi_res(200L, '{"total":1}')
    },
    .sm_api_retry_sleep = function(seconds) {
      sleeps <<- c(sleeps, seconds)
      invisible(NULL)
    }
  )
  out <- sm_api_check_token("tok-fixture-sanitizado")
  expect_true(out$ok)
  expect_equal(hits, 2L)
  expect_equal(sleeps, 7)
})

test_that("backoff SM: 429 persistente agota reintentos y falla con E_SM_RATE_LIMIT", {
  hits <- 0L
  sleeps <- numeric(0)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = function(url, handle) {
      hits <<- hits + 1L
      .msi_res(429L, "{}")
    },
    .sm_api_retry_sleep = function(seconds) {
      sleeps <<- c(sleeps, seconds)
      invisible(NULL)
    }
  )
  err <- tryCatch(sm_api_check_token("tok-fixture-sanitizado"), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_SM_RATE_LIMIT")
  # 1 intento original + 3 reintentos, backoff exponencial 1, 2, 4.
  expect_equal(hits, 4L)
  expect_equal(sleeps, c(1, 2, 4))
})

test_that("backoff SM: credencial invalida (401) NO se reintenta", {
  hits <- 0L
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = function(url, handle) {
      hits <<- hits + 1L
      .msi_res(401L, "{}")
    }
  )
  out <- sm_api_check_token("tok-revocado-fixture")
  expect_false(out$ok)
  expect_equal(out$status_code, 401L)
  expect_equal(hits, 1L)
})

# --- C. Cache de recipients por colector ------------------------------------

.msi_sm_recipients_mock <- function() {
  env <- new.env(parent = emptyenv())
  env$requests <- character(0)
  handler <- function(url, handle) {
    env$requests <- c(env$requests, url)
    if (grepl("/collectors/c1/recipients/", url)) {
      rid <- sub(".*/recipients/([^/?]+).*", "\\1", url)
      return(.msi_res(200L, as.character(jsonlite::toJSON(
        list(id = rid, email = paste0(rid, "@fixture.test"), survey_response_status = "completed"),
        auto_unbox = TRUE
      ))))
    }
    if (grepl("/collectors/c1/recipients", url)) {
      rows <- lapply(c("rc1", "rc2", "rc3", "rc4"), function(rid) {
        list(id = rid, email = paste0(rid, "@fixture.test"))
      })
      return(.msi_res(200L, as.character(jsonlite::toJSON(
        list(total = length(rows), data = rows),
        auto_unbox = TRUE
      ))))
    }
    .msi_res(404L, "{}")
  }
  list(env = env, handler = handler)
}

test_that("recipients SM: el cache por colector evita re-pedir destinatarios ya vistos", {
  .sm_api_recipients_cache_clear()
  on.exit(.sm_api_recipients_cache_clear(), add = TRUE)
  mock <- .msi_sm_recipients_mock()
  testthat::local_mocked_bindings(.sm_api_http_fetch = mock$handler)

  df <- data.frame(
    collector_id = c("c1", "c1"),
    recipient_id = c("rc1", "rc2"),
    stringsAsFactors = FALSE
  )
  out1 <- sm_api_enrich_response_recipients(df, token = "tok-fixture-sanitizado")
  expect_equal(out1$recipient_email, c("rc1@fixture.test", "rc2@fixture.test"))
  first_requests <- length(mock$env$requests)
  expect_gt(first_requests, 0L)

  # Mismos destinatarios: cero requests nuevos.
  out2 <- sm_api_enrich_response_recipients(df, token = "tok-fixture-sanitizado")
  expect_equal(length(mock$env$requests), first_requests)
  expect_equal(out2$recipient_email, out1$recipient_email)

  # Un destinatario nuevo: solo se pide lo no visto (listado + 1 detalle).
  df3 <- rbind(df, data.frame(collector_id = "c1", recipient_id = "rc4", stringsAsFactors = FALSE))
  out3 <- sm_api_enrich_response_recipients(df3, token = "tok-fixture-sanitizado")
  new_requests <- mock$env$requests[(first_requests + 1L):length(mock$env$requests)]
  detail_requests <- new_requests[grepl("/recipients/", new_requests)]
  expect_equal(length(detail_requests), 1L)
  expect_true(grepl("/recipients/rc4", detail_requests))
  expect_equal(out3$recipient_email[3], "rc4@fixture.test")
})

test_that("recipients SM: los fallos de enrichment ya no se tragan (warning con conteo)", {
  .sm_api_recipients_cache_clear()
  on.exit(.sm_api_recipients_cache_clear(), add = TRUE)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = function(url, handle) .msi_res(500L, "{}")
  )
  df <- data.frame(collector_id = "c9", recipient_id = "rz1", stringsAsFactors = FALSE)
  expect_warning(
    out <- sm_api_enrich_response_recipients(df, token = "tok-fixture-sanitizado"),
    "1 colector"
  )
  expect_equal(nrow(out), 1L)
})

# --- D. Publicacion Sheets: batch + skip por hash ---------------------------

.msi_sheets_mock <- function() {
  env <- new.env(parent = emptyenv())
  env$sheets <- list()
  env$calls <- list()
  env$next_id <- 100L
  handler <- function(url, method = "GET", body = NULL) {
    env$calls[[length(env$calls) + 1L]] <- list(url = url, method = method, body = body)
    if (grepl("[?]fields=", url)) {
      return(list(
        spreadsheetId = "sheet_abc",
        sheets = unname(lapply(env$sheets, function(s) list(
          properties = list(
            sheetId = s$sheetId,
            title = s$title,
            gridProperties = list(rowCount = 1000L, columnCount = 26L)
          ),
          developerMetadata = s$developerMetadata
        )))
      ))
    }
    if (grepl("/values:batchUpdate$", url)) {
      return(list(totalUpdatedSheets = length(body$data %||% list())))
    }
    if (grepl(":batchUpdate$", url)) {
      apply_metadata <- function(sheet_id, key, value, update = FALSE) {
        for (nm in names(env$sheets)) {
          if (!identical(env$sheets[[nm]]$sheetId, sheet_id)) next
          md <- env$sheets[[nm]]$developerMetadata
          if (isTRUE(update)) {
            for (j in seq_along(md)) {
              if (identical(md[[j]]$metadataKey, key)) md[[j]]$metadataValue <- value
            }
          } else {
            md[[length(md) + 1L]] <- list(metadataKey = key, metadataValue = value)
          }
          env$sheets[[nm]]$developerMetadata <- md
        }
      }
      for (request in body$requests %||% list()) {
        title <- request$addSheet$properties$title %||% ""
        if (nzchar(title)) {
          env$sheets[[title]] <- list(sheetId = env$next_id, title = title, developerMetadata = list())
          env$next_id <- env$next_id + 1L
        }
        cdm <- request$createDeveloperMetadata$developerMetadata
        if (!is.null(cdm)) apply_metadata(cdm$location$sheetId, cdm$metadataKey, cdm$metadataValue)
        udm <- request$updateDeveloperMetadata
        if (!is.null(udm)) {
          apply_metadata(
            udm$developerMetadata$location$sheetId,
            udm$developerMetadata$metadataKey,
            udm$developerMetadata$metadataValue,
            update = TRUE
          )
        }
      }
      return(list(replies = list()))
    }
    list()
  }
  list(env = env, handler = handler)
}

.msi_sheets_payload_8 <- function(marker = "v1") {
  tabs <- c(
    "Portada", "Resumen", "Alertas", "Avance diario",
    "Tabla maestra", "Cliente - Portada", "Cliente - Avance", "Interno - Avance"
  )
  out <- lapply(tabs, function(tab) {
    list(c("Indicador", "Valor"), c(tab, marker))
  })
  names(out) <- tabs
  out
}

test_that("sheets: republicar 8 pestanas sin cambios hace <= 3 requests (skip por hash)", {
  skip_if_not_installed("digest")
  mock <- .msi_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  payload <- .msi_sheets_payload_8()
  out1 <- monitoreo_sheets_publish_tabs("sheet_abc", payload)
  expect_true(out1$ok)
  expect_equal(length(out1$written_ranges), 8L)
  first_calls <- length(mock$env$calls)

  out2 <- monitoreo_sheets_publish_tabs("sheet_abc", payload)
  expect_true(out2$ok)
  second_calls <- length(mock$env$calls) - first_calls
  expect_lte(second_calls, 3L)
  expect_equal(length(out2$written_ranges), 0L)
  expect_setequal(unlist(out2$skipped_tabs), names(payload))
  new_urls <- vapply(
    mock$env$calls[(first_calls + 1L):length(mock$env$calls)],
    function(call) call$url, character(1)
  )
  expect_false(any(grepl("values:batchUpdate", new_urls, fixed = TRUE)))
})

test_that("sheets: pestanas cambiadas van en UN solo values:batchUpdate; formato solo con dims cambiadas", {
  skip_if_not_installed("digest")
  mock <- .msi_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  payload <- .msi_sheets_payload_8()
  monitoreo_sheets_publish_tabs("sheet_abc", payload)
  first_calls <- length(mock$env$calls)

  # Cambian 2 pestanas de contenido, mismas dimensiones.
  payload2 <- payload
  payload2[["Resumen"]][[2]][2] <- "v2"
  payload2[["Alertas"]][[2]][2] <- "v2"
  out <- monitoreo_sheets_publish_tabs("sheet_abc", payload2)
  new_calls <- mock$env$calls[(first_calls + 1L):length(mock$env$calls)]
  new_urls <- vapply(new_calls, function(call) call$url, character(1))

  values_calls <- new_calls[grepl("values:batchUpdate", new_urls, fixed = TRUE)]
  expect_equal(length(values_calls), 1L)
  expect_equal(length(values_calls[[1]]$body$data), 2L)
  ranges <- vapply(values_calls[[1]]$body$data, function(entry) entry$range, character(1))
  expect_setequal(ranges, c("'Resumen'", "'Alertas'"))
  expect_setequal(unlist(lapply(out$written_ranges, `[[`, "tab")), c("Resumen", "Alertas"))

  # Mismas dims => sin reset ni formato (se conservan reglas), solo estado.
  batch_calls <- new_calls[grepl(":batchUpdate$", new_urls) & !grepl("values:batchUpdate", new_urls, fixed = TRUE)]
  all_requests <- unlist(lapply(batch_calls, function(call) call$body$requests), recursive = FALSE)
  expect_false(any(vapply(all_requests, function(r) !is.null(r$updateCells), logical(1))))
  expect_false(any(vapply(all_requests, function(r) !is.null(r$repeatCell), logical(1))))
  expect_true(any(vapply(all_requests, function(r) !is.null(r$updateDeveloperMetadata), logical(1))))

  # Total del ciclo con 2 cambiadas: metadata + values + estado = 3 requests.
  expect_lte(length(new_calls), 4L)
})

test_that("sheets: crecer una pestana (dims cambiadas) si repone reset y formato", {
  skip_if_not_installed("digest")
  mock <- .msi_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  payload <- .msi_sheets_payload_8()
  monitoreo_sheets_publish_tabs("sheet_abc", payload)
  first_calls <- length(mock$env$calls)

  payload3 <- payload
  payload3[["Resumen"]] <- c(payload3[["Resumen"]], list(c("Extra", "1")))
  monitoreo_sheets_publish_tabs("sheet_abc", payload3)
  new_calls <- mock$env$calls[(first_calls + 1L):length(mock$env$calls)]
  new_urls <- vapply(new_calls, function(call) call$url, character(1))
  batch_calls <- new_calls[grepl(":batchUpdate$", new_urls) & !grepl("values:batchUpdate", new_urls, fixed = TRUE)]
  all_requests <- unlist(lapply(batch_calls, function(call) call$body$requests), recursive = FALSE)
  expect_true(any(vapply(all_requests, function(r) !is.null(r$updateCells), logical(1))))
  expect_true(any(vapply(all_requests, function(r) {
    !is.null(r$updateSheetProperties$properties$gridProperties$frozenRowCount)
  }, logical(1))))
})

# --- E. Transporte Kobo: timeout + retry ------------------------------------

test_that("kobo: el transporte acota esperas y es configurable por env", {
  old_timeout <- Sys.getenv("PROSECNUR_KOBO_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_KOBO_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_KOBO_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_KOBO_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_KOBO_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_KOBO_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)
  Sys.unsetenv("PROSECNUR_KOBO_TIMEOUT_SECONDS")
  Sys.unsetenv("PROSECNUR_KOBO_CONNECT_TIMEOUT_SECONDS")
  expect_equal(.kobo_api_timeout_seconds(), 120)
  expect_equal(.kobo_api_connect_timeout_seconds(120), 10)
  Sys.setenv(PROSECNUR_KOBO_TIMEOUT_SECONDS = "2")
  expect_equal(.kobo_api_timeout_seconds(), 5)
  Sys.setenv(PROSECNUR_KOBO_TIMEOUT_SECONDS = "9999")
  expect_equal(.kobo_api_timeout_seconds(), 600)
})

test_that("kobo: reintento simple por pagina ante falla transitoria (timeout) y exito al segundo intento", {
  hits <- 0L
  sleeps <- numeric(0)
  testthat::local_mocked_bindings(
    .kobo_api_http_fetch = function(url, handle) {
      hits <<- hits + 1L
      if (hits == 1L) stop("Timeout was reached: [kf.example.test] Operation timed out")
      .msi_res(200L, '{"count":1,"next":null,"previous":null,"results":[{"_id":7}]}')
    },
    .kobo_api_retry_sleep = function(seconds) {
      sleeps <<- c(sleeps, seconds)
      invisible(NULL)
    }
  )
  out <- kobo_api_fetch_asset_data("aFixture123", "tok-kobo-fixture")
  expect_equal(out$count, 1L)
  expect_equal(hits, 2L)
  expect_equal(length(sleeps), 1L)
})

test_that("kobo: credencial invalida (401) no se reintenta y agotar reintentos propaga el error", {
  hits <- 0L
  testthat::local_mocked_bindings(
    .kobo_api_http_fetch = function(url, handle) {
      hits <<- hits + 1L
      .msi_res(401L, "{}")
    }
  )
  expect_error(kobo_api_fetch_asset_data("aFixture123", "tok-kobo-fixture"), "Token rechazado")
  expect_equal(hits, 1L)

  hits2 <- 0L
  sleeps <- numeric(0)
  testthat::local_mocked_bindings(
    .kobo_api_http_fetch = function(url, handle) {
      hits2 <<- hits2 + 1L
      stop("Failed to connect: socket colgado")
    },
    .kobo_api_retry_sleep = function(seconds) {
      sleeps <<- c(sleeps, seconds)
      invisible(NULL)
    }
  )
  expect_error(kobo_api_fetch_asset_data("aFixture123", "tok-kobo-fixture"), "socket colgado")
  expect_equal(hits2, 3L) # 1 intento + 2 reintentos
  expect_equal(length(sleeps), 2L)
})

# --- F. Integracion con el engine de sync -----------------------------------

.msi_sm_details_fixture <- function() {
  list(
    title = "Encuesta fixture 3.8",
    pages = list(list(position = 1L, questions = list(
      list(id = "q1", family = "open_ended", headings = list(list(heading = "Comentario")))
    )))
  )
}

test_that("sync SM en modo avance usa el cursor persistido, marca incremental y avanza el cursor", {
  responses <- .msi_sm_responses(300L)
  cursor <- responses[[296L]]$date_modified
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = mock$handler,
    sm_api_fetch_survey_details = function(survey_id, token, base_url = NULL) .msi_sm_details_fixture(),
    .monitoreo_surveymonkey_token_candidates = function(...) {
      list(list(token = "tok-fixture-sanitizado", profile_id = "perfil-fixture"))
    }
  )

  source <- list(
    id = "surveymonkey_900100",
    kind = "surveymonkey",
    survey_id = "900100",
    enabled = TRUE,
    sync_cursor = list(sm_modified_at = cursor)
  )
  data <- monitoreo_sync_source(source, sync_mode = "advance")

  expect_equal(nrow(data), 5L)
  expect_identical(attr(data, "sync_mode", exact = TRUE), "incremental")
  cursor_out <- attr(data, "sync_cursor", exact = TRUE)
  expect_true(is.list(cursor_out))
  expect_equal(cursor_out$sm_modified_at, responses[[300L]]$date_modified)
  expect_equal(cursor_out$mode, "incremental")
  # Solo el request del bulk delta (details va mockeado aparte).
  expect_lte(length(mock$env$requests), 2L)
})

test_that("sync SM en modo avance sin cursor previo hace full, siembra cursor y NO marca incremental", {
  responses <- .msi_sm_responses(120L)
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = mock$handler,
    sm_api_fetch_survey_details = function(survey_id, token, base_url = NULL) .msi_sm_details_fixture(),
    .monitoreo_surveymonkey_token_candidates = function(...) {
      list(list(token = "tok-fixture-sanitizado", profile_id = "perfil-fixture"))
    }
  )
  source <- list(
    id = "surveymonkey_900100",
    kind = "surveymonkey",
    survey_id = "900100",
    enabled = TRUE
  )
  data <- monitoreo_sync_source(source, sync_mode = "advance")
  expect_equal(nrow(data), 120L)
  expect_identical(attr(data, "sync_mode", exact = TRUE), "advance")
  cursor_out <- attr(data, "sync_cursor", exact = TRUE)
  expect_equal(cursor_out$sm_modified_at, responses[[120L]]$date_modified)
})

test_that("el cursor SM sobrevive el normalizador de cursores y de fuentes (persistencia en monitoreo_sources)", {
  normalized <- .monitoreo_normalize_sync_cursor(list(
    sm_modified_at = "2026-07-01T00:04:56Z",
    kobo_max_id = 42,
    mode = "incremental"
  ))
  expect_equal(normalized$sm_modified_at, "2026-07-01T00:04:56Z")
  expect_equal(normalized$kobo_max_id, 42)

  sources <- monitoreo_normalize_sources(list(list(
    kind = "surveymonkey",
    survey_id = "900100",
    enabled = TRUE,
    sync_cursor = list(sm_modified_at = "2026-07-01T00:04:56Z")
  )))
  expect_equal(sources[[1]]$sync_cursor$sm_modified_at, "2026-07-01T00:04:56Z")
})

test_that("merge incremental SM: una respuesta editada se reemplaza (upsert), no se duplica", {
  prev <- data.frame(
    .source_id = c("surveymonkey_900100", "surveymonkey_900100"),
    response_id = c("r001", "r002"),
    valor = c("a", "b"),
    stringsAsFactors = FALSE
  )
  delta <- data.frame(
    .source_id = "surveymonkey_900100",
    response_id = "r002",
    valor = "b-editado",
    stringsAsFactors = FALSE
  )
  merged <- .monitoreo_merge_sync_result_data(
    prev,
    delta,
    synced_source_ids = "surveymonkey_900100",
    incremental_source_ids = "surveymonkey_900100"
  )
  expect_equal(nrow(merged), 2L)
  expect_setequal(merged$response_id, c("r001", "r002"))
  expect_equal(merged$valor[merged$response_id == "r002"], "b-editado")
})

test_that("multibase: fuentes SM distintas mantienen cursores independientes", {
  responses_a <- .msi_sm_responses(50L)
  sources <- monitoreo_normalize_sources(list(
    list(kind = "surveymonkey", survey_id = "111", enabled = TRUE,
         sync_cursor = list(sm_modified_at = responses_a[[10L]]$date_modified)),
    list(kind = "surveymonkey", survey_id = "222", enabled = TRUE,
         sync_cursor = list(sm_modified_at = responses_a[[40L]]$date_modified))
  ))
  expect_equal(.monitoreo_sm_source_cursor(sources[[1]]), responses_a[[10L]]$date_modified)
  expect_equal(.monitoreo_sm_source_cursor(sources[[2]]), responses_a[[40L]]$date_modified)
  expect_false(identical(
    .monitoreo_sm_source_cursor(sources[[1]]),
    .monitoreo_sm_source_cursor(sources[[2]])
  ))
})

# --- F-bis. Unidad 3.10b: dedup de la frontera inclusiva del cursor SM -------
#
# start_modified_at es INCLUSIVO: el bulk re-entrega las respuestas cuyo
# date_modified == cursor. El cursor guarda esa frontera (sm_boundary) y el
# fetch descuenta las ya conocidas para que fetched_count sea el delta
# efectivo (con 0 en todas las fuentes aplica el no-op de 3.10).

.msi_sm_mock_engine_bindings <- function(handler) {
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = handler,
    sm_api_fetch_survey_details = function(survey_id, token, base_url = NULL) .msi_sm_details_fixture(),
    .monitoreo_surveymonkey_token_candidates = function(...) {
      list(list(token = "tok-fixture-sanitizado", profile_id = "perfil-fixture"))
    },
    .env = parent.frame()
  )
}

# Siembra un cursor con frontera: Avance desde r296 sobre un pool de 300
# (delta real 5, frontera = r300). Devuelve la fuente lista para el segundo
# Avance con el cursor persistido.
.msi_sm_seeded_source <- function(responses) {
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  .msi_sm_mock_engine_bindings(mock$handler)
  source <- list(
    id = "surveymonkey_900100",
    kind = "surveymonkey",
    survey_id = "900100",
    enabled = TRUE,
    sync_cursor = list(sm_modified_at = responses[[296L]]$date_modified)
  )
  data <- monitoreo_sync_source(source, sync_mode = "advance")
  cursor <- attr(data, "sync_cursor", exact = TRUE)
  source$sync_cursor <- cursor
  list(source = source, data = data, cursor = cursor)
}

test_that("3.10b: el primer Avance siembra la frontera (sm_boundary) junto al cursor", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  seeded <- .msi_sm_seeded_source(responses)
  expect_equal(nrow(seeded$data), 5L)
  expect_equal(seeded$cursor$sm_modified_at, responses[[300L]]$date_modified)
  boundary <- unlist(seeded$cursor$sm_boundary)
  expect_length(boundary, 1L)
  expect_true(startsWith(boundary, "r300|"))
})

test_that("3.10b: segundo Avance solo-frontera => delta efectivo 0 y no-op aplicable", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  seeded <- .msi_sm_seeded_source(responses)

  # Sin cambios remotos: el bulk re-entrega SOLO la fila de frontera conocida.
  mock2 <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  .msi_sm_mock_engine_bindings(mock2$handler)
  data2 <- monitoreo_sync_source(seeded$source, sync_mode = "advance")

  expect_equal(nrow(data2), 0L)
  expect_identical(attr(data2, "sync_mode", exact = TRUE), "incremental")
  cursor2 <- attr(data2, "sync_cursor", exact = TRUE)
  expect_identical(cursor2$fetched_count, 0L)
  # El cursor y su frontera quedan intactos para el próximo Avance.
  expect_equal(cursor2$sm_modified_at, responses[[300L]]$date_modified)
  expect_setequal(unlist(cursor2$sm_boundary), unlist(seeded$cursor$sm_boundary))
  # La condición del no-op de 3.10 lee el fetched YA deduplicado.
  expect_true(.monitoreo_sync_summary_delta_cero(list(
    sm = list(source_id = "surveymonkey_900100", kind = "surveymonkey",
              mode = "incremental", rows = 0L, cursor = cursor2)
  )))
})

test_that("3.10b: frontera conocida + 1 respuesta nueva => delta efectivo 1 y el cursor avanza", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  seeded <- .msi_sm_seeded_source(responses)

  # Llega r301 (timestamp posterior); la frontera vieja se descuenta.
  responses_nuevo <- .msi_sm_responses(301L)
  mock2 <- .msi_sm_bulk_mock(responses_nuevo, honor_cursor = TRUE)
  .msi_sm_mock_engine_bindings(mock2$handler)
  data2 <- monitoreo_sync_source(seeded$source, sync_mode = "advance")

  expect_equal(nrow(data2), 1L)
  expect_equal(data2$response_id, "r301")
  cursor2 <- attr(data2, "sync_cursor", exact = TRUE)
  expect_identical(cursor2$fetched_count, 1L)
  expect_equal(cursor2$sm_modified_at, responses_nuevo[[301L]]$date_modified)
  # La frontera se REEMPLAZA por la del nuevo máximo (r301, no r300).
  boundary2 <- unlist(cursor2$sm_boundary)
  expect_length(boundary2, 1L)
  expect_true(startsWith(boundary2, "r301|"))
  expect_false(.monitoreo_sync_summary_delta_cero(list(
    sm = list(source_id = "surveymonkey_900100", mode = "incremental", rows = 1L, cursor = cursor2)
  )))
})

test_that("3.10b: respuesta de frontera con date_modified AVANZADO cuenta como delta (edición real)", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  seeded <- .msi_sm_seeded_source(responses)

  # r300 fue editada después del corte: mismo id, date_modified posterior.
  responses_edit <- responses
  responses_edit[[300L]]$date_modified <- "2026-07-01T00:06:40Z"
  mock2 <- .msi_sm_bulk_mock(responses_edit, honor_cursor = TRUE)
  .msi_sm_mock_engine_bindings(mock2$handler)
  data2 <- monitoreo_sync_source(seeded$source, sync_mode = "advance")

  expect_equal(nrow(data2), 1L)
  expect_equal(data2$response_id, "r300")
  cursor2 <- attr(data2, "sync_cursor", exact = TRUE)
  expect_identical(cursor2$fetched_count, 1L)
  expect_equal(cursor2$sm_modified_at, "2026-07-01T00:06:40Z")
})

test_that("3.10b: caso patológico — mismo id y date_modified pero payload editado => delta (fingerprint distinto)", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  seeded <- .msi_sm_seeded_source(responses)

  # Edición sin avance de date_modified: SOLO se trata como sin-cambios si el
  # fingerprint coincide; acá cambió el contenido, así que cuenta como delta.
  responses_patho <- responses
  responses_patho[[300L]]$pages <- list(list(id = "p1", questions = list()))
  mock2 <- .msi_sm_bulk_mock(responses_patho, honor_cursor = TRUE)
  .msi_sm_mock_engine_bindings(mock2$handler)
  data2 <- monitoreo_sync_source(seeded$source, sync_mode = "advance")

  expect_equal(nrow(data2), 1L)
  expect_equal(data2$response_id, "r300")
  cursor2 <- attr(data2, "sync_cursor", exact = TRUE)
  expect_identical(cursor2$fetched_count, 1L)
})

test_that("3.10b: cursor previo sin frontera sembrada (upgrade) no descuenta nada y se auto-siembra", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  mock <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  .msi_sm_mock_engine_bindings(mock$handler)
  # Cursor de una versión anterior: solo sm_modified_at, sin sm_boundary.
  source <- list(
    id = "surveymonkey_900100", kind = "surveymonkey", survey_id = "900100",
    enabled = TRUE, sync_cursor = list(sm_modified_at = responses[[300L]]$date_modified)
  )
  data <- monitoreo_sync_source(source, sync_mode = "advance")
  # La frontera re-cuenta una vez (comportamiento previo)...
  expect_equal(nrow(data), 1L)
  cursor_out <- attr(data, "sync_cursor", exact = TRUE)
  # ...pero este mismo fetch la siembra para el próximo Avance.
  expect_true(startsWith(unlist(cursor_out$sm_boundary), "r300|"))
})

test_that("3.10b: sm_boundary sobrevive los normalizadores y es independiente por fuente", {
  normalized <- .monitoreo_normalize_sync_cursor(list(
    sm_modified_at = "2026-07-01T00:05:00Z",
    sm_boundary = list("r300|fp-fixture-abc")
  ))
  expect_identical(normalized$sm_boundary, list("r300|fp-fixture-abc"))

  sources <- monitoreo_normalize_sources(list(
    list(kind = "surveymonkey", survey_id = "111", enabled = TRUE,
         sync_cursor = list(sm_modified_at = "2026-07-01T00:05:00Z", sm_boundary = list("rA|f1"))),
    list(kind = "surveymonkey", survey_id = "222", enabled = TRUE,
         sync_cursor = list(sm_modified_at = "2026-07-02T00:00:00Z", sm_boundary = list("rB|f2")))
  ))
  expect_identical(.monitoreo_sm_source_boundary(sources[[1]]), "rA|f1")
  expect_identical(.monitoreo_sm_source_boundary(sources[[2]]), "rB|f2")
})

# --- F-ter. Unidad 3.10c: el pull SM con delta 0 no paga details/enrichment --
#
# Mock de servidor SM completo sobre el seam .sm_api_http_fetch: sirve bulk,
# details, collectors y recipients con fixtures sintéticas y CUENTA los
# requests por categoría. A diferencia de .msi_sm_mock_engine_bindings, acá
# los survey details NO van mockeados aparte: pasan por el transporte, que es
# exactamente lo que 3.10c debe evitar cuando el delta efectivo es 0.

.msi_sm_full_mock <- function(responses, recipients_body = '{"data":[],"total":0}') {
  bulk <- .msi_sm_bulk_mock(responses, honor_cursor = TRUE)
  env <- new.env(parent = emptyenv())
  env$bulk <- 0L
  env$details <- 0L
  env$collectors <- 0L
  env$recipients <- 0L
  env$other <- 0L
  details_body <- as.character(jsonlite::toJSON(.msi_sm_details_fixture(), auto_unbox = TRUE, null = "null"))
  handler <- function(url, handle) {
    if (grepl("/responses/bulk", url, fixed = TRUE)) {
      env$bulk <- env$bulk + 1L
      return(bulk$handler(url, handle))
    }
    if (grepl("/details", url, fixed = TRUE)) {
      env$details <- env$details + 1L
      return(.msi_res(200L, details_body))
    }
    # OJO: recipients antes que collectors — la URL de destinatarios
    # (/collectors/{id}/recipients) contiene ambos segmentos.
    if (grepl("/recipients", url, fixed = TRUE)) {
      env$recipients <- env$recipients + 1L
      return(.msi_res(200L, recipients_body))
    }
    if (grepl("/collectors", url, fixed = TRUE)) {
      env$collectors <- env$collectors + 1L
      return(.msi_res(200L, '{"data":[],"total":0}'))
    }
    env$other <- env$other + 1L
    .msi_res(200L, "{}")
  }
  list(env = env, handler = handler)
}

.msi_sm_full_mock_bindings <- function(handler) {
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = handler,
    .monitoreo_surveymonkey_token_candidates = function(...) {
      list(list(token = "tok-fixture-sanitizado", profile_id = "perfil-fixture"))
    },
    .env = parent.frame()
  )
}

test_that("3.10c: Avance con delta 0 => SOLO bulk (0 details, 0 collectors, 0 recipients) y merge no-op", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  source <- list(
    id = "surveymonkey_900100", kind = "surveymonkey", survey_id = "900100",
    enabled = TRUE, sync_cursor = list(sm_modified_at = responses[[296L]]$date_modified)
  )
  # Siembra: el primer Avance (delta 5 > 0) SÍ paga details — hay filas que
  # aplanar y los details alimentan columnas/labels del flatten.
  mock1 <- .msi_sm_full_mock(responses)
  .msi_sm_full_mock_bindings(mock1$handler)
  data1 <- monitoreo_sync_source(source, sync_mode = "advance")
  expect_equal(nrow(data1), 5L)
  expect_identical(mock1$env$details, 1L)
  source$sync_cursor <- attr(data1, "sync_cursor", exact = TRUE)

  # Sin cambios remotos: delta efectivo 0 tras el dedup de frontera (3.10b).
  mock2 <- .msi_sm_full_mock(responses)
  .msi_sm_full_mock_bindings(mock2$handler)
  data2 <- monitoreo_sync_source(source, sync_mode = "advance")

  expect_equal(nrow(data2), 0L)
  expect_gte(mock2$env$bulk, 1L)
  expect_identical(mock2$env$details, 0L)
  expect_identical(mock2$env$collectors, 0L)
  expect_identical(mock2$env$recipients, 0L)
  expect_identical(mock2$env$other, 0L)

  # La semántica de 3.10/3.10b queda intacta: incremental, cursor y frontera
  # preservados, no-op aplicable.
  expect_identical(attr(data2, "sync_mode", exact = TRUE), "incremental")
  cursor2 <- attr(data2, "sync_cursor", exact = TRUE)
  expect_identical(cursor2$fetched_count, 0L)
  expect_equal(cursor2$sm_modified_at, responses[[300L]]$date_modified)
  expect_true(startsWith(unlist(cursor2$sm_boundary), "r300|"))
  expect_true(.monitoreo_sync_summary_delta_cero(list(
    sm = list(source_id = "surveymonkey_900100", mode = "incremental", rows = 0L, cursor = cursor2)
  )))

  # El df vacío del skip (0 filas, SIN columnas del snapshot) atraviesa el
  # merge del router como no-op garantizado: .monitoreo_bind_rows filtra dfs
  # sin filas y el upsert no ve claves nuevas.
  prev <- data.frame(
    .source_id = c("surveymonkey_900100", "surveymonkey_900100"),
    response_id = c("r299", "r300"),
    valor = c("a", "b"),
    stringsAsFactors = FALSE
  )
  merged <- .monitoreo_merge_sync_result_data(
    prev, data2,
    synced_source_ids = "surveymonkey_900100",
    incremental_source_ids = "surveymonkey_900100"
  )
  expect_equal(merged, prev)
})

test_that("3.10c: Avance con delta > 0 => details antes del flatten y enrichment después (flujo intacto)", {
  skip_if_not_installed("digest")
  responses <- .msi_sm_responses(300L)
  source <- list(
    id = "surveymonkey_900100", kind = "surveymonkey", survey_id = "900100",
    enabled = TRUE, sync_cursor = list(sm_modified_at = responses[[296L]]$date_modified)
  )
  mock1 <- .msi_sm_full_mock(responses)
  .msi_sm_full_mock_bindings(mock1$handler)
  data1 <- monitoreo_sync_source(source, sync_mode = "advance")
  source$sync_cursor <- attr(data1, "sync_cursor", exact = TRUE)

  # Llega r301 con colector y destinatario: delta efectivo 1.
  responses_nuevo <- .msi_sm_responses(301L)
  responses_nuevo[[301L]]$collector_id <- "col-310c"
  responses_nuevo[[301L]]$recipient_id <- "rcp-310c"
  .sm_api_recipients_cache_clear()
  mock2 <- .msi_sm_full_mock(
    responses_nuevo,
    recipients_body = '{"data":[{"id":"rcp-310c","email":"fixture-310c@example.org"}],"total":1}'
  )
  .msi_sm_full_mock_bindings(mock2$handler)
  data2 <- monitoreo_sync_source(source, sync_mode = "advance")

  expect_equal(nrow(data2), 1L)
  expect_equal(data2$response_id, "r301")
  # details se pagó UNA vez (columnas/labels del flatten)...
  expect_identical(mock2$env$details, 1L)
  # ...y el enrichment de destinatarios corrió después del flatten.
  expect_gte(mock2$env$recipients, 1L)
  expect_equal(data2$recipient_email, "fixture-310c@example.org")
  # Modo avance: la metadata de collectors sigue sin pedirse (igual que antes).
  expect_identical(mock2$env$collectors, 0L)
  cursor2 <- attr(data2, "sync_cursor", exact = TRUE)
  expect_identical(cursor2$fetched_count, 1L)
  expect_equal(cursor2$sm_modified_at, responses_nuevo[[301L]]$date_modified)
})

test_that("3.10c: full (sin cursor) con 0 respuestas NO se salta details/collectors (refresca título)", {
  responses_vacias <- list()
  mock <- .msi_sm_full_mock(responses_vacias)
  .msi_sm_full_mock_bindings(mock$handler)
  source <- list(
    id = "surveymonkey_900100", kind = "surveymonkey", survey_id = "900100",
    enabled = TRUE
  )
  data <- monitoreo_sync_source(source, sync_mode = "full")
  expect_equal(nrow(data), 0L)
  # El skip exige cursor operativo: un full con 0 respuestas sigue el flujo
  # normal para refrescar survey_title y la metadata de colectores.
  expect_identical(mock$env$details, 1L)
  expect_gte(mock$env$collectors, 1L)
  expect_identical(attr(data, "survey_title", exact = TRUE), "Encuesta fixture 3.8")
})

test_that("kobo: el fallback incremental->full ya no es silencioso (warning)", {
  testthat::local_mocked_bindings(
    kobo_api_fetch_all_asset_data = function(asset_uid, token, base_url = NULL, page_size = 1000L,
                                             max_pages = 500L, query = NULL, min_id = NULL, progress = NULL) {
      if (!is.null(min_id)) stop("query incremental no soportada por el servidor fixture")
      list(ok = TRUE, count = 1L, total = 1L, results = list(list(`_id` = 7L, dato = "x")))
    },
    .connections_token_require = function(...) "tok-kobo-fixture"
  )
  source <- list(
    id = "kobo_fixture",
    kind = "kobo",
    asset_uid = "aFixture123",
    enabled = TRUE,
    sync_cursor = list(kobo_max_id = 5)
  )
  expect_warning(
    data <- monitoreo_sync_source(source, sync_mode = "advance"),
    "consulta incremental fallo"
  )
  expect_identical(attr(data, "sync_mode", exact = TRUE), "full")
})

# --- Regresión: el modo solicitado no se degrada entre fuentes (bug del
# shadowing de `sync_mode` en monitoreo_sync_sources — detectado e2e con
# ACNURCG: la fuente 1 devolvía "incremental" y pisaba la variable del loop,
# las fuentes 2..N caían a full re-download en cada Avance).

test_that("advance llega intacto a TODAS las fuentes aunque la primera devuelva incremental", {
  modos_recibidos <- character(0)
  falso_df <- function() {
    df <- data.frame(x = 1)
    attr(df, "sync_mode") <- "incremental"
    attr(df, "sync_cursor") <- list(kobo_max_id = 99L, mode = "incremental", fetched_count = 0L)
    df
  }
  testthat::local_mocked_bindings(
    monitoreo_sync_source = function(source, since = NULL, progress = NULL, sid = NULL,
                                     connection_token = NULL, sync_mode = "full") {
      modos_recibidos <<- c(modos_recibidos, sync_mode)
      falso_df()
    }
  )
  fuentes <- list(
    list(id = "kobo_a", kind = "kobo", label = "A", enabled = TRUE, role = "respuestas"),
    list(id = "kobo_b", kind = "kobo", label = "B", enabled = TRUE, role = "respuestas")
  )
  invisible(monitoreo_sync_sources(fuentes, sync_mode = "advance", build_dashboard = FALSE))
  expect_identical(modos_recibidos, c("advance", "advance"))
})

# --- G. Unidad 3.10: Avance sin cambios = no-op rápido -----------------------

.msi_noop_data <- function() {
  data.frame(
    response_id = c("r1", "r2", "r3", "r4"),
    enumerador = c("Ana", "Luis", "Ana", "Luis"),
    estado = rep("completed", 4L),
    fecha = rep("2026-07-01T10:00:00Z", 4L),
    duracion = rep(600, 4L),
    .source_id = c("kobo_a", "kobo_a", "kobo_b", "kobo_b"),
    .source_kind = rep("kobo", 4L),
    .source_label = c("Kobo A", "Kobo A", "Kobo B", "Kobo B"),
    stringsAsFactors = FALSE
  )
}

# Sesión con snapshot construido por el camino real (.monitoreo_state_payload
# persiste el token vigente igual que en producción).
.msi_noop_session <- function() {
  sid <- session_create()
  data <- .msi_noop_data()
  cfg <- monitoreo_normalize_config(list(
    id_var = "response_id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed")
  ), data)
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_sources", list(
    list(id = "kobo_a", kind = "kobo", label = "Kobo A", enabled = TRUE),
    list(id = "kobo_b", kind = "kobo", label = "Kobo B", enabled = TRUE)
  ))
  session_set(sid, "monitoreo_snapshot", list(
    data = data,
    config = cfg,
    synced_at = "2026-07-20T00:00:00Z"
  ))
  invisible(.monitoreo_state_payload(sid))
  sid
}

# Resultado de worker con delta 0 en las DOS fuentes (cursores intactos).
.msi_noop_result <- function(data, cfg) {
  list(
    ok = TRUE,
    synced_at = "2026-07-21T00:00:00Z",
    n_rows = 0L,
    n_sources = 2L,
    errors = list(),
    data = data[0, , drop = FALSE],
    sync_summary = list(
      kobo_a = list(source_id = "kobo_a", kind = "kobo", mode = "incremental", rows = 0L,
                    cursor = list(fetched_count = 0L, mode = "incremental")),
      kobo_b = list(source_id = "kobo_b", kind = "kobo", mode = "incremental", rows = 0L,
                    cursor = list(fetched_count = 0L, mode = "incremental"))
    ),
    config = cfg
  )
}

test_that("delta cero: la señal autoritativa es fetched_count con fallback a rows", {
  expect_false(.monitoreo_sync_summary_delta_cero(list()))
  expect_false(.monitoreo_sync_summary_delta_cero(NULL))
  expect_true(.monitoreo_sync_summary_delta_cero(list(
    a = list(source_id = "a", cursor = list(fetched_count = 0L), rows = 0L),
    b = list(source_id = "b", cursor = list(fetched_count = 0L), rows = 0L)
  )))
  # Una fuente con delta rompe el no-op aunque las demás estén en cero.
  expect_false(.monitoreo_sync_summary_delta_cero(list(
    a = list(source_id = "a", cursor = list(fetched_count = 0L), rows = 0L),
    b = list(source_id = "b", cursor = list(fetched_count = 3L), rows = 3L)
  )))
  # Full re-download con filas nunca es delta 0 (no se puede probar identidad
  # de contenido barata); full/sheets con 0 filas sí (fallback a rows).
  expect_false(.monitoreo_sync_summary_delta_cero(list(
    a = list(source_id = "a", mode = "full", rows = 1697L, cursor = list())
  )))
  expect_true(.monitoreo_sync_summary_delta_cero(list(
    a = list(source_id = "a", mode = "full", rows = 0L, cursor = list())
  )))
})

test_that("3.10: Avance con delta 0 en dos fuentes = no-op (0 builds, snapshot intacto)", {
  sid <- .msi_noop_session()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  prev_snapshot <- s$monitoreo_snapshot
  expect_true(nzchar(prev_snapshot$dashboard_cache_token %||% ""))
  snapshot_antes <- prev_snapshot

  prev_data <- prev_snapshot$data
  result <- .msi_noop_result(prev_data, s$monitoreo_config)
  # Réplica del on_complete real: merge incremental + normalización de config
  # + metadata de fuentes con last_sync_at fresco.
  combined <- .monitoreo_merge_sync_result_data(
    prev_data, result$data,
    synced_source_ids = c("kobo_a", "kobo_b"),
    incremental_source_ids = c("kobo_a", "kobo_b")
  )
  current_cfg <- .monitoreo_request_config(NULL, s$monitoreo_config, combined)
  result$config <- monitoreo_normalize_config(result$config, combined, previous_config = current_cfg)
  sources_now <- lapply(monitoreo_normalize_sources(s$monitoreo_sources), function(src) {
    src$last_sync_at <- result$synced_at
    src
  })
  dashboard_data <- .monitoreo_apply_source_metadata_to_data(combined, sources_now)

  monitoreo_perf_reset_dashboard_build_count()
  noop <- monitoreo_sync_noop_result(sid, prev_snapshot, dashboard_data, result, "advance", NULL)

  expect_true(is.list(noop))
  expect_true(isTRUE(noop$noop))
  expect_true(isTRUE(noop$ok))
  # CERO builds del dashboard y el snapshot vigente no se toca.
  expect_identical(monitoreo_perf_dashboard_build_count(), 0L)
  expect_identical(session_get(sid)$monitoreo_snapshot$synced_at, snapshot_antes$synced_at)
  expect_identical(
    session_get(sid)$monitoreo_snapshot$dashboard_cache_token,
    snapshot_antes$dashboard_cache_token
  )
  # La respuesta refleja el corte vigente + el momento real de verificación.
  expect_identical(noop$synced_at, "2026-07-20T00:00:00Z")
  expect_identical(noop$checked_at, "2026-07-21T00:00:00Z")
  expect_identical(noop$report_scope, "full")
  expect_identical(noop$n_rows, 4L)
  expect_true(is.list(noop$dashboard))
})

test_that("3.10: una fuente con delta, datos cambiados o errores => flujo normal (NULL)", {
  sid <- .msi_noop_session()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  prev_snapshot <- s$monitoreo_snapshot
  prev_data <- prev_snapshot$data
  base_result <- .msi_noop_result(prev_data, s$monitoreo_config)
  sources_now <- monitoreo_normalize_sources(s$monitoreo_sources)
  dashboard_data <- .monitoreo_apply_source_metadata_to_data(prev_data, sources_now)
  combined_cfg <- monitoreo_normalize_config(s$monitoreo_config, prev_data)
  base_result$config <- combined_cfg

  # (a) Una fuente reporta delta => no-op descartado por sync_summary.
  con_delta <- base_result
  con_delta$sync_summary$kobo_b$rows <- 2L
  con_delta$sync_summary$kobo_b$cursor$fetched_count <- 2L
  expect_null(monitoreo_sync_noop_result(sid, prev_snapshot, dashboard_data, con_delta, "advance", NULL))

  # (b) Delta 0 reportado pero el esquema mergeado cambió => token distinto.
  data_cambiada <- dashboard_data
  data_cambiada$columna_nueva <- "x"
  expect_null(monitoreo_sync_noop_result(sid, prev_snapshot, data_cambiada, base_result, "advance", NULL))

  # (c) Errores de sync => conservador, flujo normal.
  con_errores <- base_result
  con_errores$errors <- list(list(source_id = "kobo_b", message = "timeout"))
  expect_null(monitoreo_sync_noop_result(sid, prev_snapshot, dashboard_data, con_errores, "advance", NULL))

  # (d) Sin snapshot previo válido => flujo normal.
  expect_null(monitoreo_sync_noop_result(sid, NULL, dashboard_data, base_result, "advance", NULL))
  sin_token <- prev_snapshot
  sin_token$dashboard_cache_token <- NULL
  expect_null(monitoreo_sync_noop_result(sid, sin_token, dashboard_data, base_result, "advance", NULL))
})

# --- H. Unidad 3.8b: publicación Sheets con opt-in async ----------------------

test_that("3.8b: dispatch síncrono publica inline y registra el evento (contrato vigente)", {
  skip_if_not_installed("digest")
  mock <- .msi_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  payload <- .msi_sheets_payload_8()
  out <- monitoreo_sheets_publish_dispatch(
    sid, "sheet_abc", payload, list(),
    event_key = "monitoreo_sheet_publish_events",
    event_extra = list(tabs = names(payload))
  )
  expect_true(isTRUE(out$ok))
  expect_null(out$job_id)
  expect_equal(length(out$written_ranges), 8L)
  events <- session_get(sid)$monitoreo_sheet_publish_events
  expect_length(events, 1L)
  expect_identical(events[[1]]$tabs, names(payload))
})

test_that("3.8b: async=true devuelve {job_id} al instante; el evento lo escribe on_complete", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  captured <- new.env(parent = emptyenv())
  testthat::local_mocked_bindings(
    job_submit = function(sid, kind, func, args = list(), result_filename = NULL, on_complete = NULL, libpath = NULL) {
      captured$kind <- kind
      captured$func_name <- attr(func, "prosecnur_job_function_name", exact = TRUE)
      captured$args <- args
      captured$on_complete <- on_complete
      "job-fixture-1"
    }
  )

  payload <- .msi_sheets_payload_8()
  out <- monitoreo_sheets_publish_dispatch(
    sid, "sheet_abc", payload, list(async = TRUE),
    event_key = "monitoreo_sheet_publish_events",
    event_extra = list(tabs = names(payload))
  )
  expect_identical(out$job_id, "job-fixture-1")
  expect_identical(out$kind, "monitoreo.sheets_publish")
  expect_true(isTRUE(out$async))
  expect_identical(captured$kind, "monitoreo.sheets_publish")
  # Trampa de namespace callr cubierta: el runner viaja con su nombre marcado.
  expect_identical(captured$func_name, "monitoreo_sheets_publish_job_runner")
  # El payload viaja por RDS (nunca dentro del closure).
  expect_true(file.exists(captured$args$tabs_path))
  expect_identical(readRDS(captured$args$tabs_path), payload)
  expect_identical(captured$args$spreadsheet_id, "sheet_abc")
  # Sin evento hasta que el job termine bien.
  expect_null(session_get(sid)$monitoreo_sheet_publish_events)

  published <- list(ok = TRUE, spreadsheet_id = "sheet_abc")
  res <- captured$on_complete(list(sid = sid, status = "done", result_data = published, progress_path = NULL))
  expect_true(isTRUE(res$ok))
  events <- session_get(sid)$monitoreo_sheet_publish_events
  expect_length(events, 1L)
  expect_identical(events[[1]]$tabs, names(payload))

  # Un job fallido NO registra evento.
  captured$on_complete(list(sid = sid, status = "error", result_data = NULL, progress_path = NULL))
  expect_length(session_get(sid)$monitoreo_sheet_publish_events, 1L)
})

test_that("3.8b: el runner del job publica leyendo las tabs por RDS y reporta progreso", {
  skip_if_not_installed("digest")
  mock <- .msi_sheets_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  payload <- .msi_sheets_payload_8()
  tabs_path <- tempfile(fileext = ".rds")
  saveRDS(payload, tabs_path)
  progress_path <- tempfile(fileext = ".progress")
  on.exit(unlink(c(tabs_path, progress_path)), add = TRUE)

  out <- monitoreo_sheets_publish_job_runner(tabs_path, "sheet_abc", progress_path)
  expect_true(isTRUE(out$ok))
  expect_equal(length(out$written_ranges), 8L)
  expect_true(file.exists(progress_path))
})

test_that("3.8b: monitoreo_sheets_sync_apply_result persiste snapshot, fuentes y devuelve state", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  source <- list(id = "sheets_1", kind = "google_sheets", label = "Hoja campo", enabled = TRUE)
  session_set(sid, "monitoreo_sources", list(source))
  session_set(sid, "monitoreo_config", list())

  df <- data.frame(
    response_id = c("s1", "s2"),
    estado = c("completed", "completed"),
    fecha = c("2026-07-22T10:00:00Z", "2026-07-22T11:00:00Z"),
    .source_id = rep("sheets_1", 2L),
    .source_kind = rep("google_sheets", 2L),
    .source_label = rep("Hoja campo", 2L),
    stringsAsFactors = FALSE
  )
  result <- list(
    ok = TRUE,
    synced_at = "2026-07-23T12:00:00Z",
    n_rows = 2L,
    n_sources = 1L,
    errors = list(),
    data = df,
    sources = list(source),
    config = monitoreo_normalize_config(list(), df),
    sync_summary = list(sheets_1 = list(
      source_id = "sheets_1", kind = "google_sheets", mode = "full", rows = 2L, cursor = list()
    ))
  )

  out <- monitoreo_sheets_sync_apply_result(sid, result)
  expect_true(isTRUE(out$ok))
  expect_identical(out$n_rows, 2L)
  expect_identical(out$n_sources, 1L)
  expect_true(is.list(out$state))

  s <- session_get(sid)
  expect_identical(s$monitoreo_snapshot$synced_at, "2026-07-23T12:00:00Z")
  expect_identical(nrow(s$monitoreo_snapshot$data), 2L)
  expect_identical(s$monitoreo_sources[[1]]$last_sync_at, "2026-07-23T12:00:00Z")
  expect_true(is.list(s$monitoreo_snapshot$dashboard))
})

test_that("el formato no congela la unica fila visible de una pestaña solo-header", {
  reqs_vacia <- .monitoreo_sheets_professional_format_requests(1L, "Corte", rows = list(list("encabezado")))
  frozen <- reqs_vacia[[1]]$updateSheetProperties$properties$gridProperties$frozenRowCount
  expect_identical(frozen, 0L)
  reqs_datos <- .monitoreo_sheets_professional_format_requests(1L, "Corte", rows = list(list("encabezado"), list("dato")))
  frozen2 <- reqs_datos[[1]]$updateSheetProperties$properties$gridProperties$frozenRowCount
  expect_identical(frozen2, 1L)
})

# --- 3.10d: la hidratación de collectors NO hace red en un avance sin filas
# nuevas (el on_complete corre dentro del event loop de plumber: cada request
# síncrono ahí congela TODAS las respuestas HTTP; forense: 37s por avance).

test_that("hidratación de collectors se salta el avance incremental con delta 0", {
  fetches <- 0L
  testthat::local_mocked_bindings(
    .monitoreo_fetch_surveymonkey_collectors_for_source = function(sid, source) {
      fetches <<- fetches + 1L
      stop("red prohibida en este contrato")
    }
  )
  fuentes <- list(list(
    id = "surveymonkey_x", kind = "surveymonkey", label = "X",
    enabled = TRUE, role = "respuestas", collectors = list()
  ))
  resumen <- list(surveymonkey_x = list(
    mode = "incremental", rows = 0L, cursor = list(fetched_count = 0L)
  ))
  out <- .monitoreo_hydrate_missing_surveymonkey_collectors(
    "sid-falso", fuentes, synced_source_ids = "surveymonkey_x", sync_summary = resumen
  )
  expect_identical(fetches, 0L)
  expect_length(out, 1L)
})

test_that("hidratación de collectors sí corre en full con filas", {
  fetches <- 0L
  testthat::local_mocked_bindings(
    .monitoreo_fetch_surveymonkey_collectors_for_source = function(sid, source) {
      fetches <<- fetches + 1L
      list()
    }
  )
  fuentes <- list(list(
    id = "surveymonkey_x", kind = "surveymonkey", label = "X",
    enabled = TRUE, role = "respuestas", collectors = list()
  ))
  resumen <- list(surveymonkey_x = list(
    mode = "full", rows = 25L, cursor = list(fetched_count = 25L)
  ))
  invisible(.monitoreo_hydrate_missing_surveymonkey_collectors(
    "sid-falso", fuentes, synced_source_ids = "surveymonkey_x", sync_summary = resumen
  ))
  expect_identical(fetches, 1L)
})
