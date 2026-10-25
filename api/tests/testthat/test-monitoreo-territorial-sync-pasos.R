# =============================================================================
# El sync territorial también dice en qué paso va (Meta B, L38, fase 2 de M1)
# =============================================================================
#
# El «Actualizar ▾» de Territorial lanza el Kobo de la fase por el mismo job que
# Telefónico y Acreditación (`/api/monitoreo/sync` → `monitoreo_sync_sources`),
# así que hereda `step`/`steps`: una fuente por paso y el último une y
# recalcula. Las ocurrencias de campo van por su propio endpoint, fuera del
# job; el front las cuenta como el paso 1 y corre los del job uno.
# Este test fija que el camino territorial no pierda los pasos: con el perfil
# territorial y en modo avance, el Kobo de respuestas sigue contando.

test_that("el Kobo de la fase territorial pasa el filtro de avance", {
  fuentes <- list(
    list(id = "kobo_campo", kind = "kobo", role = "respuestas", enabled = TRUE),
    list(id = "kobo_sin_rol", kind = "kobo", enabled = TRUE),
    list(id = "ruta", kind = "google_sheets", role = "hoja_ruta", enabled = TRUE)
  )
  ids <- vapply(monitoreo_fuentes_avance(fuentes, "territorial"), function(src) src$id, character(1))
  expect_identical(ids, c("kobo_campo", "kobo_sin_rol"))
})

test_that("monitoreo_sync_sources numera los pasos del sync territorial en avance", {
  llamadas <- list()
  testthat::local_mocked_bindings(
    job_progress_writer = function(progress_path) {
      function(phase = "running", current = NULL, total = NULL, percent = NULL,
               message = NULL, step = NULL, steps = NULL) {
        llamadas[[length(llamadas) + 1L]] <<- list(phase = phase, step = step, steps = steps)
        invisible(NULL)
      }
    },
    monitoreo_sync_source = function(src, since = NULL, progress = NULL, ...) {
      if (is.function(progress)) progress(150, 1700, "Descargando respuestas")
      data.frame(`_id` = c("1", "2", "3"), .source_id = src$id, check.names = FALSE)
    }
  )
  fuentes <- list(
    list(id = "kobo_campo", kind = "kobo", role = "respuestas", label = "Kobo campo",
         enabled = TRUE, dimensions = list(territorial_phase = "field"))
  )
  config <- list(monitoreo_profile = list(family = "territorial"))
  monitoreo_sync_sources(fuentes, config = config, progress_path = "simulado",
                         build_dashboard = FALSE, sync_mode = "advance")

  con_paso <- Filter(function(x) !is.null(x$step), llamadas)
  expect_true(length(con_paso) > 0)
  # Una fuente + el recálculo: «paso N de 2».
  expect_true(all(vapply(con_paso, function(x) identical(as.integer(x$steps), 2L), logical(1))))
  pasos <- vapply(con_paso, function(x) as.integer(x$step), integer(1))
  expect_identical(pasos, cummax(pasos))
  expect_identical(min(pasos), 1L)
  expect_identical(max(pasos), 2L)
  # Los 150 de 1700 registros de Kobo no se cuelan como pasos.
  expect_false(any(pasos > 2L))
})
