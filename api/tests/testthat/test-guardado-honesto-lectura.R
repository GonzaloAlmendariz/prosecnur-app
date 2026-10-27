library(testthat)

# Meta B L22 — «sin guardar» solo tras una mutación real. Visitar una pestaña
# no es editar el proyecto: lo que se re-deriva al leer no marca `project_dirty`.

.l22_sesion_limpia <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- file.path(tempdir(), "l22-lectura.pulso")
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  sid
}

test_that("preparar Analítica al leer no ensucia el proyecto", {
  sid <- .l22_sesion_limpia()
  on.exit(session_delete(sid), add = TRUE)

  ctx <- list(
    rp_inst = list(survey = data.frame(name = "p1")),
    rp_data = data.frame(p1 = 1:3),
    inst_sources = list(base = list(survey = data.frame(name = "p1"))),
    data_sources = list(base = data.frame(p1 = 1:3)),
    lectura_signatures = list(base = "firma"),
    fuente = "adaptados"
  )
  local_mocked_bindings(
    .analitica_repair_project_context = function(sid) invisible(FALSE),
    .analitica_prepare_context = function(sid, cfg) ctx,
    .analitica_lectura_normalize_sources = function(d, i, f) list(data_sources = d, inst_sources = i),
    .analitica_source_cache_key = function(sid, fuente) paste0(fuente, ":firma"),
    .package = "prosecnurapp"
  )

  .analitica_prepare_and_cache(sid)
  .analitica_prepare_and_cache(sid)

  s <- session_get(sid)
  expect_false(isTRUE(s$project_dirty))
  # La caché sí queda escrita: sólo no cuenta como edición.
  expect_true(isTRUE(s$analitica_prep_ok))
  expect_identical(s$analitica_fuente, "adaptados:firma")
  expect_equal(nrow(s$analitica_rp_data), 3L)
})

test_that("invalidar los estados de Analítica tras una mutación sigue marcando", {
  sid <- .l22_sesion_limpia()
  on.exit(session_delete(sid), add = TRUE)
  .analitica_status_set(sid, "analitica_codebook_ok", FALSE)
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("sembrar la sugerencia de familias al leer no ensucia; editarla sí", {
  sid <- .l22_sesion_limpia()
  on.exit(session_delete(sid), add = TRUE)

  local_mocked_bindings(
    .familias_suggest_tibble = function(sid, source = NULL) data.frame(),
    .familias_rows_from_df = function(df) list(list(var = "p1", familia = "A")),
    .codif_normalize_legacy_select_one_modes = function(sid, d) d,
    .package = "prosecnurapp"
  )
  pr <- mount_codificacion(plumber::pr())
  rutas <- pr$routes$api$codificacion$familias$draft
  get_draft <- Filter(function(e) "GET" %in% e$verbs, rutas)[[1]]$getFunc()
  req <- new.env(parent = emptyenv())
  req$HTTP_X_PULSO_SESSION <- sid
  res <- new.env(parent = emptyenv())
  res$status <- 200L
  res$setHeader <- function(...) invisible(NULL)

  out <- get_draft(req, res)

  expect_identical(out$source, "suggestion")
  expect_false(is.null(codif_get(sid, "familias_draft")))
  expect_false(isTRUE(session_get(sid)$project_dirty))

  codif_set(sid, "familias_draft", list(rows = list(), source = "draft"))
  expect_true(isTRUE(session_get(sid)$project_dirty))
})
