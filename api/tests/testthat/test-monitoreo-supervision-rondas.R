# Rondas de supervisión del telefónico (procedimientos-respondidos.md,
# «Telefónico: rondas de supervisión», 2026-10-24). Fixture sintético:
# enumeradores «Op-0N», códigos RND-0xx y proGres XYZ-26-7xxxxx inventados.
# Google Sheets va mockeado: sin red.

rnd_base <- function(n = 20L, desde = 1L) {
  idx <- seq(desde, length.out = n)
  enum <- rep(c("Op-01", "Op-01", "Op-02", "Op-03"), length.out = n)
  data.frame(
    CodPulso = sprintf("RND-%03d", idx), proGres = sprintf("XYZ-26-7%05d", idx), Enumerador = enum,
    `Categoría` = "Norte", `Fecha Kobo` = sprintf("2026-10-%02d", 1L + (idx %% 20L)),
    `Response ID` = sprintf("U%03d", idx), check.names = FALSE, stringsAsFactors = FALSE
  )
}

rnd_cfg <- function() list(supervision_n = 6L, supervision_seed = 20260514L, monitoreo_profile = list())

test_that("Ronda 1: porcentaje del universo repartido por enumerador con mínimo 1, reproducible", {
  base <- rnd_base()
  r1 <- .monitoreo_supervision_ronda_nueva(base, list(), rnd_cfg(), porcentaje = 20, semilla = 7L, ahora = "2026-10-24T10:00:00Z")
  expect_identical(r1$numero, 1L)
  expect_identical(r1$universo, 20L)
  expect_identical(r1$cantidad, 4L) # ceiling(20 * 20 %)
  expect_true(all(c("Op-01", "Op-02", "Op-03") %in% r1$casos$Enumerador))
  expect_identical(sum(r1$reparto$Casos), nrow(r1$casos))
  expect_true(all(r1$casos$Origen == "sorteo"))
  expect_identical(names(r1$casos), c("N", "CodPulso", "proGres", "Enumerador", "Categoría", "Fecha Kobo", "Response ID", "Origen"))
  expect_identical(r1$corte, "2026-10-20")
  otra <- .monitoreo_supervision_ronda_nueva(base, list(), rnd_cfg(), porcentaje = 20, semilla = 7L, ahora = "x")
  expect_identical(otra$casos$CodPulso, r1$casos$CodPulso)
})

test_that("Ronda 2: solo efectivas nuevas, nunca repite, y suma los casos del analista", {
  r1 <- .monitoreo_supervision_ronda_nueva(rnd_base(), list(), rnd_cfg(), porcentaje = 20, semilla = 7L)
  guardadas <- .monitoreo_supervision_rondas_normalizar(list(rondas = list(r1)))
  base2 <- rbind(rnd_base(), rnd_base(n = 10L, desde = 21L))
  no_elegida <- setdiff(rnd_base()$CodPulso, r1$casos$CodPulso)[[1]]
  r2 <- .monitoreo_supervision_ronda_nueva(base2, guardadas, rnd_cfg(), porcentaje = 30, agregados = list(no_elegida, "U025"))
  expect_identical(r2$numero, 2L)
  expect_identical(r2$universo, 10L)
  expect_identical(r2$corte_anterior, r1$corte)
  sorteo <- r2$casos[r2$casos$Origen == "sorteo", ]
  expect_true(all(sorteo$CodPulso %in% sprintf("RND-%03d", 21:30)))
  expect_false(any(r2$casos$CodPulso %in% r1$casos$CodPulso))
  # La de la Ronda 1 que no salió sorteada: la agrega el analista.
  expect_identical(r2$casos$Origen[r2$casos$CodPulso == no_elegida], "analista")
  # Por Response ID; si ya salió en el sorteo no se duplica.
  expect_identical(sum(r2$casos$CodPulso == "RND-025"), 1L)
  expect_identical(r2$semilla, 20260515L) # semilla del proyecto + número − 1

  repetido <- r1$casos$CodPulso[[1]]
  expect_error(.monitoreo_supervision_ronda_nueva(base2, guardadas, rnd_cfg(), porcentaje = 30, agregados = list(repetido)),
               class = "api_error")
  err <- tryCatch(.monitoreo_supervision_ronda_nueva(base2, guardadas, rnd_cfg(), porcentaje = 30, agregados = list(repetido)),
                  api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_REPETIDO")
  err <- tryCatch(.monitoreo_supervision_ronda_nueva(base2, guardadas, rnd_cfg(), porcentaje = 30, agregados = list("NADA-1")),
                  api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_AGREGADO")
})

test_that("sin efectivas nuevas ni agregados la ronda no se arma; el porcentaje se declara", {
  r1 <- .monitoreo_supervision_ronda_nueva(rnd_base(), list(), rnd_cfg(), porcentaje = 100)
  guardadas <- .monitoreo_supervision_rondas_normalizar(list(rondas = list(r1)))
  err <- tryCatch(.monitoreo_supervision_ronda_nueva(rnd_base(), guardadas, rnd_cfg(), porcentaje = 10), api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_SIN_NUEVAS")
  expect_equal(err$status, 409)
  for (malo in list(NULL, -1, 120, "x")) {
    err <- tryCatch(.monitoreo_supervision_ronda_nueva(rnd_base(), guardadas, rnd_cfg(), porcentaje = malo), api_error = function(e) e)
    expect_identical(err$code, "E_MONITOREO_SUPERVISION_PORCENTAJE")
  }
})

test_that("migración: sin rondas guardadas y sin porcentaje se guarda la Ronda 1 de supervision_n, idéntica", {
  base <- rnd_base()
  virtual <- .monitoreo_supervision_ronda_virtual(base, rnd_cfg())
  r1 <- .monitoreo_supervision_ronda_nueva(base, list(), rnd_cfg())
  expect_identical(r1$casos$CodPulso, virtual$casos$CodPulso)
  expect_identical(r1$semilla, 20260514L)
  expect_identical(r1$cantidad, 6L)
  expect_true(isTRUE(r1$guardada))
})

test_that("los bloques reflejan todas las rondas guardadas con su número", {
  efectivas <- rbind(rnd_base(), rnd_base(n = 10L, desde = 21L))
  names(efectivas)[names(efectivas) == "Enumerador"] <- "Responsable plataforma"
  efectivas$Actor <- efectivas$`Categoría`
  base <- .monitoreo_supervision_base(efectivas, rnd_cfg(), character(0), NULL)
  r1 <- .monitoreo_supervision_ronda_nueva(base[1:20, ], list(), rnd_cfg(), porcentaje = 20)
  g <- .monitoreo_supervision_rondas_normalizar(list(rondas = list(r1)))
  r2 <- .monitoreo_supervision_ronda_nueva(base, g, rnd_cfg(), porcentaje = 20)
  cfg <- .monitoreo_supervision_rondas_en_cfg(rnd_cfg(), list(monitoreo_supervision_rondas = list(rondas = list(r1, r2))))
  # Sobrevive a la normalización del config, como en el build del dashboard.
  expect_length(monitoreo_normalize_config(cfg, data.frame())$monitoreo_profile$supervision_rondas, 2L)
  b <- .monitoreo_supervision_estratificada_blocks(efectivas, cfg)
  b <- stats::setNames(b, vapply(b, function(x) x$id, ""))
  casos <- do.call(rbind, lapply(b$supervision_casos$rows, as.data.frame, check.names = FALSE))
  expect_setequal(unique(casos$Ronda), c(1L, 2L))
  expect_identical(nrow(casos), nrow(r1$casos) + nrow(r2$casos))
  rondas <- do.call(rbind, lapply(b$supervision_rondas$rows, as.data.frame, check.names = FALSE))
  expect_identical(unlist(b$supervision_rondas$columns), c(
    "Ronda", "Guardada", "Generada el", "Semilla", "Porcentaje", "Universo", "Corte anterior", "Corte",
    "Sorteados", "Agregados", "Casos", "Publicada en", "Publicada el"))
  expect_identical(rondas$Ronda, c(1L, 2L))
  expect_identical(rondas$Guardada, c("Sí", "Sí"))
  expect_identical(rondas$Universo, c(20L, 10L))
  resumen <- do.call(rbind, lapply(b$supervision_resumen$rows, as.data.frame))
  expect_identical(resumen$Valor[resumen$Indicador == "Rondas guardadas"], "2")
  expect_identical(resumen$Valor[resumen$Indicador == "Efectivas sin ronda"], "0")
  reparto <- do.call(rbind, lapply(b$supervision_reparto$rows, as.data.frame, check.names = FALSE))
  expect_setequal(unique(reparto$Ronda), c(1L, 2L))
  base_b <- do.call(rbind, lapply(b$supervision_base$rows, as.data.frame, check.names = FALSE))
  expect_identical(nrow(base_b), 30L)
  expect_identical(sum(base_b$Disponible == "No"), nrow(casos))
  expect_true(all(base_b$Ronda[base_b$Disponible == "No"] %in% c("1", "2")))
  # Sin rondas guardadas: la Ronda 1 sin guardar.
  sin <- .monitoreo_supervision_estratificada_blocks(efectivas, rnd_cfg())
  sin <- stats::setNames(sin, vapply(sin, function(x) x$id, ""))
  expect_identical(sin$supervision_rondas$rows[[1]]$Guardada, "No")
})

test_that("una ronda guardada no cambia al normalizarla ni al pasar por RDS", {
  r1 <- .monitoreo_supervision_ronda_nueva(rnd_base(), list(), rnd_cfg(), porcentaje = 20, ahora = "2026-10-24T10:00:00Z")
  clave <- list(schema = "monitoreo_supervision_rondas_v1", rondas = list(r1))
  f <- tempfile(fileext = ".rds")
  on.exit(unlink(f), add = TRUE)
  saveRDS(clave, f)
  vuelta <- .monitoreo_supervision_rondas_normalizar(readRDS(f))
  expect_identical(vuelta[[1]]$casos$CodPulso, r1$casos$CodPulso)
  expect_identical(vuelta[[1]]$generada_el, "2026-10-24T10:00:00Z")
  expect_identical(.monitoreo_supervision_rondas_normalizar(list(rondas = vuelta)), vuelta)
})

# --- Pestaña «Ronda N» ---------------------------------------------------------

rnd_phone <- function() {
  data.frame(`Código proGres` = sprintf("XYZ-26-7%05d", 1:20), Nombre = sprintf("Hogar %02d", 1:20),
             Status = "Efectivo", `Telefono 1` = sprintf("+519%08d", 1:20), `Telefono 2` = "",
             check.names = FALSE, stringsAsFactors = FALSE)
}

rnd_respuestas <- function() {
  r <- data.frame(`_id` = sprintf("U%03d", 1:20), acepta = "yes", personas = as.character(1:20),
                  check.names = FALSE, stringsAsFactors = FALSE)
  attr(r$personas, "label") <- "¿Cuántas personas viven en el hogar?"
  r
}

test_that("las filas de la pestaña llevan las columnas de Supervisión_Ronda3 y lo del supervisor vacío", {
  r1 <- .monitoreo_supervision_ronda_nueva(rnd_base(), list(), rnd_cfg(), porcentaje = 20, agregados = list("RND-020"))
  filas <- .monitoreo_supervision_ronda_filas(r1, rnd_phone(), rnd_respuestas(), c("acepta", "¿Cuántas personas viven en el hogar?"),
                                              c("Telefono 1", "Telefono 2"))
  expect_identical(names(filas), c(
    "N", "Fecha", "COD.proGres", "Código PULSO", "Nombre del encuestador/a", "Origen", "Nombre", "Telefono_final",
    "Tef1", "Tef2", "Tef3", "acepta", "¿Cuántas personas viven en el hogar?", "Observaciones",
    "Responsable de la supervisión", "Status", "Status supervisión", "Intentos supervisión",
    "Observaciones re barrido", "Status final"))
  uno <- filas[filas$`Código PULSO` == "RND-020", ]
  expect_identical(uno$Origen, "Elegido por el analista")
  expect_identical(uno$Nombre, "Hogar 20")
  expect_identical(uno$Telefono_final, "+51900000020")
  expect_identical(uno$`¿Cuántas personas viven en el hogar?`, "20")
  expect_identical(uno$Status, "Efectivo")
  for (c in c("Observaciones", "Responsable de la supervisión", "Status supervisión", "Intentos supervisión",
              "Observaciones re barrido", "Status final")) expect_true(all(filas[[c]] == ""))
  err <- tryCatch(.monitoreo_supervision_ronda_filas(r1, rnd_phone(), rnd_respuestas(), "no_existe"), api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_PREGUNTA")
})

rnd_google_mock <- function(tabs = c("supervision"), con_datos = character(0)) {
  llamadas <- list()
  handler <- function(url, method = "GET", body = NULL) {
    llamadas[[length(llamadas) + 1L]] <<- list(url = utils::URLdecode(url), method = method, body = body)
    if (grepl("\\?fields=", url)) {
      return(list(sheets = lapply(seq_along(tabs), function(i) list(properties = list(sheetId = i, title = tabs[[i]])))))
    }
    if (grepl("/values/", url) && identical(method, "GET")) {
      tab <- sub("^.*/values/'(.*)'!.*$", "\\1", utils::URLdecode(url))
      return(if (tab %in% con_datos) list(values = list(list("N", "Fecha"))) else list())
    }
    list(ok = TRUE)
  }
  list(handler = handler, llamadas = function() llamadas)
}

test_that("publicar crea su pestaña «Ronda N» y escribe solo ahí", {
  r1 <- .monitoreo_supervision_ronda_nueva(rnd_base(), list(), rnd_cfg(), porcentaje = 20)
  filas <- .monitoreo_supervision_ronda_filas(r1, rnd_phone(), rnd_respuestas())
  mock <- rnd_google_mock(tabs = c("supervision", "Ronda 0"))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  marca <- .monitoreo_supervision_publicar_ronda(r1, filas, "fx_supervision_sheet", ahora = "2026-10-24T11:00:00Z")
  expect_identical(marca$pestana, "Ronda 1")
  expect_identical(marca$filas, nrow(filas))
  ll <- mock$llamadas()
  escrituras <- Filter(function(l) !identical(l$method, "GET"), ll)
  expect_length(escrituras, 2L)
  alta <- escrituras[[1]]$body$requests[[1]]$addSheet$properties
  expect_identical(alta$title, "Ronda 1")
  datos <- escrituras[[2]]$body$data
  expect_length(datos, 1L)
  expect_identical(datos[[1]]$range, "'Ronda 1'!A1")
  expect_identical(escrituras[[2]]$body$valueInputOption, "RAW")
  expect_identical(unlist(datos[[1]]$values[[1]]), names(filas))
  expect_length(datos[[1]]$values, nrow(filas) + 1L)
  # Ninguna llamada nombra otra pestaña.
  textos <- vapply(ll, function(l) paste(l$url, jsonlite::toJSON(l$body, auto_unbox = TRUE)), "")
  expect_false(any(grepl("supervision'|Ronda 0", textos)))
})

test_that("publicar no sobrescribe: pestaña con datos o ronda ya publicada dan error; pestaña vacía se usa", {
  r1 <- .monitoreo_supervision_ronda_nueva(rnd_base(), list(), rnd_cfg(), porcentaje = 20)
  filas <- .monitoreo_supervision_ronda_filas(r1, rnd_phone(), rnd_respuestas())
  ocupada <- rnd_google_mock(tabs = c("supervision", "Ronda 1"), con_datos = "Ronda 1")
  testthat::local_mocked_bindings(.monitoreo_google_api = ocupada$handler)
  err <- tryCatch(.monitoreo_supervision_publicar_ronda(r1, filas, "fx"), api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_PESTANA_OCUPADA")
  expect_length(Filter(function(l) !identical(l$method, "GET"), ocupada$llamadas()), 0L)

  vacia <- rnd_google_mock(tabs = c("supervision", "Ronda 1"))
  testthat::local_mocked_bindings(.monitoreo_google_api = vacia$handler)
  marca <- .monitoreo_supervision_publicar_ronda(r1, filas, "fx")
  escrituras <- Filter(function(l) !identical(l$method, "GET"), vacia$llamadas())
  expect_length(escrituras, 1L) # solo valores, sin addSheet
  r1$publicada <- marca
  err <- tryCatch(.monitoreo_supervision_publicar_ronda(r1, filas, "fx"), api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_PUBLICADA")
})

test_that("sin hoja de supervisión conectada publicar dice qué falta", {
  err <- tryCatch(.monitoreo_supervision_fuente_hoja(list(list(role = "barrido", sheet_binding = list(spreadsheet_id = "x")))),
                  api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_HOJA")
  f <- .monitoreo_supervision_fuente_hoja(list(list(role = "supervision", enabled = TRUE, sheet_binding = list(spreadsheet_id = "abc"))))
  expect_identical(f$sheet_binding$spreadsheet_id, "abc")
})

# --- PDM: la Ronda 1 conserva la paridad, y la ronda viaja en el .pulso ---------

test_that("acnur_pdm: Ronda 1 de 24 casos, 423 de avance; guardada sobrevive al .pulso y llega al reporte", {
  pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  if (!file.exists(pulso)) skip("acnur_pdm.pulso no esta en inst/reference_projects")
  sid <- load_pulso(pulso)$session_id
  on.exit(session_delete(sid), add = TRUE)
  bloques <- function(sid) {
    s <- session_get(sid)
    derived <- monitoreo_state_derived(sid, s, monitoreo_normalize_sources(s$monitoreo_sources %||% list()))
    cfg <- .monitoreo_supervision_rondas_en_cfg(derived$cfg, s)
    b <- .monitoreo_report_phone_blocks(derived$data, cfg$monitoreo_profile, cfg)
    stats::setNames(b, vapply(b, function(x) x$id, ""))
  }
  antes <- bloques(sid)
  expect_identical(sum(vapply(antes$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)), 423L)
  expect_length(antes$supervision_casos$rows, 24L)
  expect_identical(antes$supervision_rondas$rows[[1]]$Guardada, "No")

  ctx <- .monitoreo_supervision_contexto(sid)
  expect_identical(nrow(ctx$base), 423L)
  r1 <- .monitoreo_supervision_ronda_nueva(ctx$base, ctx$rondas, ctx$cfg)
  .monitoreo_supervision_guardar_rondas(sid, list(r1))
  despues <- bloques(sid)
  expect_length(despues$supervision_casos$rows, 24L)
  expect_identical(despues$supervision_rondas$rows[[1]]$Guardada, "Sí")
  expect_identical(
    vapply(despues$supervision_casos$rows, function(r) r$CodPulso, ""),
    vapply(antes$supervision_casos$rows, function(r) r$CodPulso, "")
  )
  expect_identical(sum(vapply(despues$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)), 423L)
  expect_length(Filter(function(r) identical(r[["Sentido"]], "hoja_sin_kobo"), despues$discrepancias_telefonicas$rows), 3L)

  # Ronda 2 sin efectivas nuevas: error claro.
  ctx2 <- .monitoreo_supervision_contexto(sid)
  err <- tryCatch(.monitoreo_supervision_ronda_nueva(ctx2$base, ctx2$rondas, ctx2$cfg, porcentaje = 10), api_error = function(e) e)
  expect_identical(err$code, "E_MONITOREO_SUPERVISION_SIN_NUEVAS")

  # Guardar y reabrir: los mismos casos.
  destino <- tempfile(fileext = ".pulso")
  on.exit(unlink(destino), add = TRUE)
  build_pulso(sid, destino, project_name = "PDM rondas")
  sid2 <- load_pulso(destino)$session_id
  on.exit(session_delete(sid2), add = TRUE)
  reabierta <- .monitoreo_supervision_rondas_normalizar(session_get(sid2)[["monitoreo_supervision_rondas"]])
  expect_identical(reabierta[[1]]$casos$CodPulso, r1$casos$CodPulso)
  expect_identical(reabierta[[1]]$semilla, r1$semilla)
})

test_that("HTTP: rondas vacías, ronda sin datos y publicar una ronda que no existe", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  vacias <- http_get(srv, "/api/monitoreo/telefonico/supervision/rondas", sid = sid)
  expect_identical(vacias$status, 200L)
  expect_identical(vacias$json$schema, "monitoreo_supervision_rondas_v1")
  expect_length(vacias$json$rondas, 0L)
  sin_datos <- http_post_json(srv, "/api/monitoreo/telefonico/supervision/ronda", sid = sid, body = list(porcentaje = 10))
  expect_identical(sin_datos$status, 409L)
  expect_identical(sin_datos$json$error$code, "E_MONITOREO_NO_SNAPSHOT")
  pub <- http_post_json(srv, "/api/monitoreo/telefonico/supervision/ronda/publicar", sid = sid, body = list(numero = 1))
  expect_identical(pub$status, 409L) # sin datos, antes de buscar la ronda
})
