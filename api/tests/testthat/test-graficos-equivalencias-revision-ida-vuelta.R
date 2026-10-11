source("setup-load-all.R")

# ADR 0063 — `equivalencias_revision` sella de qué revisión de la matriz de equivalencias se derivó el mazo. Si el sello
# no sobrevive la ida y vuelta de la config por base, tras recargar el aviso de desfase cae a «sin-mazo-derivado» sin
# avisar. Estas pruebas fijan que el sello vuelve en la RAÍZ de la config (que es donde lo lee el frontend), no
# escondido en `_unknown`.

.eqr_sesion_multibase <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  sid
}

.eqr_endpoint <- function(path, body, sid, verbo = "POST") {
  testthat::local_mocked_bindings(
    session_header = function(req) sid,
    .graficos_scoped_base = function(sid) "docentes",   # sesión de bases hermanas independientes, base activa
    .package = "prosecnurapp"
  )
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, path) && verbo %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv())
  if (!is.null(body)) {
    req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  }
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  ep$getFunc()(req, res)
}

.eqr_body <- function(...) list(config = c(list(plan = list(slides = list()), paletas = structure(list(), names = character())), list(...)))

test_that("normalize conserva equivalencias_revision como campo de primera clase (no en _unknown)", {
  cfg <- .graficos_normalize_config(list(plan = list(slides = list()), equivalencias_revision = "abc"))
  expect_identical(cfg$equivalencias_revision, "abc")
  expect_null(cfg$`_unknown`$equivalencias_revision)
})

test_that("POST → GET /api/graficos/config por base devuelve el sello en la raíz", {
  sid <- .eqr_sesion_multibase()
  .eqr_endpoint("/api/graficos/config", .eqr_body(equivalencias_revision = "abc"), sid = sid, verbo = "POST")

  guardada <- session_get(sid)$graficos_config_por_base$docentes
  expect_false(is.null(guardada), info = "la config se guardó en la base activa")

  got <- .eqr_endpoint("/api/graficos/config", NULL, sid = sid, verbo = "GET")
  expect_identical(got$config$equivalencias_revision, "abc")
})

test_that("tras recargar, el autosave del front (raíz vacía + _unknown heredado) no pisa el sello", {
  # Es exactamente el payload que reenvía el front si el GET le entregó el sello sólo en `_unknown`: la raíz con el
  # valor del store (vacío) y `_unknown` conservado. El sello no debe terminar en "".
  sid <- .eqr_sesion_multibase()
  .eqr_endpoint("/api/graficos/config", .eqr_body(equivalencias_revision = "abc"), sid = sid, verbo = "POST")
  got <- .eqr_endpoint("/api/graficos/config", NULL, sid = sid, verbo = "GET")
  reenvio <- got$config
  reenvio$equivalencias_revision <- got$config$equivalencias_revision %||% ""
  .eqr_endpoint("/api/graficos/config", list(config = reenvio), sid = sid, verbo = "POST")
  again <- .eqr_endpoint("/api/graficos/config", NULL, sid = sid, verbo = "GET")
  sello <- again$config$equivalencias_revision %||% again$config$`_unknown`$equivalencias_revision %||% ""
  expect_identical(sello, "abc")
})

test_that("el borrador consolidado conserva equivalencias_revision en la raíz", {
  sid <- .eqr_sesion_multibase()
  inicial <- graficos_consolidado_draft_get(sid)
  graficos_consolidado_draft_set(
    sid,
    list(plan = list(slides = list()), equivalencias_revision = "abc"),
    expected_revision = inicial$revision
  )
  got <- graficos_consolidado_draft_get(sid)
  expect_identical(got$config$equivalencias_revision, "abc")
})

test_that("export → import de la config (/config/export, /config/import) conserva el sello en la raíz, también desde `_unknown` viejo", {
  sid <- .eqr_sesion_multibase()
  .eqr_endpoint("/api/graficos/config", .eqr_body(equivalencias_revision = "abc"), sid = sid, verbo = "POST")
  exportado <- .eqr_endpoint("/api/graficos/config/export", NULL, sid = sid, verbo = "GET")
  expect_identical(exportado$config$equivalencias_revision, "abc")
  expect_null(exportado$config$`_unknown`$equivalencias_revision)
  destino <- .eqr_sesion_multibase()
  .eqr_endpoint("/api/graficos/config/import", exportado, sid = destino, verbo = "POST")
  expect_identical(.eqr_endpoint("/api/graficos/config", NULL, sid = destino, verbo = "GET")$config$equivalencias_revision, "abc")
  # Un archivo exportado antes del arreglo lo traía sólo en `_unknown`, con la raíz vacía: se rescata.
  viejo <- .eqr_body(equivalencias_revision = "", `_unknown` = list(equivalencias_revision = "def"))
  .eqr_endpoint("/api/graficos/config/import", viejo, sid = destino, verbo = "POST")
  got <- .eqr_endpoint("/api/graficos/config", NULL, sid = destino, verbo = "GET")$config
  expect_identical(got$equivalencias_revision, "def")
  expect_null(got$`_unknown`$equivalencias_revision)
})
