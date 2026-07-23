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

test_that("el formato no congela la unica fila visible de una pestaña solo-header", {
  reqs_vacia <- .monitoreo_sheets_professional_format_requests(1L, "Corte", rows = list(list("encabezado")))
  frozen <- reqs_vacia[[1]]$updateSheetProperties$properties$gridProperties$frozenRowCount
  expect_identical(frozen, 0L)
  reqs_datos <- .monitoreo_sheets_professional_format_requests(1L, "Corte", rows = list(list("encabezado"), list("dato")))
  frozen2 <- reqs_datos[[1]]$updateSheetProperties$properties$gridProperties$frozenRowCount
  expect_identical(frozen2, 1L)
})
