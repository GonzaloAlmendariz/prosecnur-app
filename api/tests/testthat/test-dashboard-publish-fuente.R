# Un tablero no se publica sin fuente (dashboard_publish_fuente.R).
#
# Sin `dashboard_source` el runtime público arranca y el cliente abre
# «Dashboard no disponible». Lo destapó la prueba en vivo del modo público
# (4 nov 2026). Todos los caminos de publicación pasan por el snapshot; aquí se
# prueba que el snapshot se niega, con el motivo que también lee la UI.

.dpf_sesion <- function(fuente = NULL, files = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  s$dashboard_source <- fuente
  s$files <- files
  .session_env[[sid]] <- s
  sid
}

.dpf_error <- function(expr) {
  tryCatch({ force(expr); NULL }, api_error = function(e) e)
}

test_that("sin fuente, publicar se niega con 409 y dice qué hacer", {
  sid <- .dpf_sesion()
  e <- .dpf_error(.dashboard_publish_snapshot(sid, "publicado"))
  expect_s3_class(e, "api_error")
  expect_identical(e$status, 409)
  expect_identical(e$code, "E_DASHBOARD_SIN_FUENTE")
  expect_identical(e$message, "El tablero no tiene base elegida: elígela en Dashboard › Fuente antes de publicar.")
  expect_setequal(unlist(e$details$falta), c("instrumento", "base"))
})

test_that("con el artefacto de tablero declarado tampoco publica sin fuente", {
  sid <- .dpf_sesion()
  e <- .dpf_error(.dashboard_publish_snapshot(sid, "publicado", public_artifact = list(kind = "dashboard", title = "T")))
  expect_identical(e$code, "E_DASHBOARD_SIN_FUENTE")
})

test_that("una fuente a medias es una fuente ausente", {
  sid <- .dpf_sesion(fuente = list(xlsform_file_id = "f-inst", data_file_id = ""))
  e <- .dpf_error(.dashboard_publish_snapshot(sid, "publicado"))
  expect_identical(e$code, "E_DASHBOARD_SIN_FUENTE")
  expect_identical(unlist(e$details$falta), "base")
})

test_that("una fuente que apunta a archivos que ya no están se niega con otro motivo", {
  sid <- .dpf_sesion(
    fuente = list(xlsform_file_id = "f-inst", data_file_id = "f-base"),
    files = list(`f-inst` = list(file_id = "f-inst"))
  )
  e <- .dpf_error(.dashboard_publish_snapshot(sid, "publicado"))
  expect_identical(e$code, "E_DASHBOARD_SIN_FUENTE")
  expect_match(e$message, "ya no están en el proyecto", fixed = TRUE)
  expect_identical(unlist(e$details$file_id), "f-base")
})

test_that("con fuente completa el guard deja pasar", {
  s <- list(
    dashboard_source = list(xlsform_file_id = "f-inst", data_file_id = "f-base"),
    files = list(`f-inst` = list(), `f-base` = list())
  )
  expect_true(.publicacion_exigir_fuente_dashboard(s))
})

test_that("la sesión original no queda tocada cuando el guard se niega", {
  sid <- .dpf_sesion()
  antes <- session_get(sid)
  .dpf_error(.dashboard_publish_snapshot(sid, "publicado"))
  expect_identical(session_get(sid), antes)
})

test_that("el monitoreo público no exige fuente de tablero", {
  sid <- .dpf_sesion()
  snap <- .dashboard_publish_snapshot(
    sid, "Avance",
    public_artifact = list(kind = "monitoreo", module = "monitoreo", title = "Avance", public_scope = "aggregate"),
    public_payload = list(monitoreo_report = list(ok = TRUE))
  )
  expect_true(file.exists(snap$path))
})

test_that("los dos caminos de publicación pasan por el guard", {
  r <- function(...) paste(readLines(testthat::test_path("..", "..", ...), warn = FALSE), collapse = "\n")
  # El estado a publicar exige la fuente antes de armar nada.
  cuerpo <- deparse(body(.publicacion_estado_dashboard))
  expect_match(cuerpo[2], ".publicacion_exigir_fuente_dashboard(s)", fixed = TRUE)
  # El botón (prepare_space) y el deploy manual (script) usan el snapshot que lo llama.
  expect_match(paste(deparse(body(.dashboard_publish_prepare_space)), collapse = "\n"), ".dashboard_publish_snapshot(", fixed = TRUE)
  expect_match(r("scripts", "publicacion_preparar.R"), ".dashboard_publish_snapshot(", fixed = TRUE)
})
