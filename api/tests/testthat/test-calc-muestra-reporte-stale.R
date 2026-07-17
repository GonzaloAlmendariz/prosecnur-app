# F5 — El autosave (PUT /estudio cada ~2 s) borraba la meta del reporte.
#
# Cada POST /api/calc-muestra/estudio hacia session_set(reporte,
# list(disponible = FALSE)): se perdian job_id y path, y GET /reporte/descargar
# devolvia 404 (E_NO_REPORTE) aunque el archivo existiera. El fix preserva la
# meta y solo marca `stale = TRUE` cuando cambia contenido que alimenta el
# reporte (todo menos `workspace`, que es estado de UI). La descarga sigue
# funcionando mientras el archivo exista; la UI muestra "desactualizado".

.reporte_stale_estudio <- function(titulo = "Estudio HSVG", notas = "") {
  calc_muestra_normalize_estudio(list(
    titulo = titulo,
    componentes = list(list(id = "cmp-aaaaaaaa", nombre = "Componente 1")),
    workspace = list(frame_mode = "acreditacion", notas_diseno = notas)
  ))
}

test_that("cambio_relevante ignora el workspace y detecta cambios de contenido", {
  base <- .reporte_stale_estudio()

  # Solo cambio el workspace (autosave tipico) -> NO es cambio relevante.
  solo_ws <- .reporte_stale_estudio(notas = "borrador de la UI, tecleado a las 3am")
  expect_false(calc_muestra_estudio_cambio_relevante(base, solo_ws))

  # Cambio de titulo / componentes -> SI es relevante.
  expect_true(calc_muestra_estudio_cambio_relevante(base, .reporte_stale_estudio(titulo = "Otro titulo")))
  con_comp <- base
  con_comp$componentes <- c(con_comp$componentes, list(list(id = "cmp-bbbbbbbb")))
  expect_true(calc_muestra_estudio_cambio_relevante(base, con_comp))

  # Sin baseline: conservador (asumir cambio).
  expect_true(calc_muestra_estudio_cambio_relevante(NULL, base))
})

test_that("la meta del reporte se preserva en PUT de estudio y solo marca stale ante cambio relevante", {
  meta <- list(disponible = TRUE, path = "/tmp/reporte.html",
               job_id = "job-rep-1", formato = "html",
               generated_at = "2026-07-16T00:00:00Z", stale = FALSE)
  base <- .reporte_stale_estudio()

  # Autosave que solo toca workspace: meta INTACTA (ni stale).
  meta_ws <- calc_muestra_reporte_meta_tras_estudio(meta, base, .reporte_stale_estudio(notas = "x"))
  expect_true(isTRUE(meta_ws$disponible))
  expect_equal(meta_ws$job_id, "job-rep-1")
  expect_equal(meta_ws$path, "/tmp/reporte.html")
  expect_false(isTRUE(meta_ws$stale))

  # Cambio relevante: stale = TRUE pero job_id/path sobreviven (descarga OK).
  meta_rel <- calc_muestra_reporte_meta_tras_estudio(meta, base, .reporte_stale_estudio(titulo = "Nuevo"))
  expect_true(isTRUE(meta_rel$stale))
  expect_equal(meta_rel$job_id, "job-rep-1")
  expect_equal(meta_rel$path, "/tmp/reporte.html")
  expect_true(isTRUE(meta_rel$disponible))

  # Meta ausente/corrupta degrada al sentinela historico.
  expect_false(isTRUE(calc_muestra_reporte_meta_tras_estudio(NULL, base, base)$disponible))

  # marcar_stale (componentes/calcular/iniciar) tambien preserva la meta.
  meta_ms <- calc_muestra_reporte_meta_marcar_stale(meta)
  expect_true(isTRUE(meta_ms$stale))
  expect_equal(meta_ms$job_id, "job-rep-1")
  expect_true(isTRUE(meta_ms$disponible))
})

test_that("reporte done + PUT estudio (autosave) => la descarga sigue disponible (hoy 404)", {
  sid <- session_create()
  base <- .reporte_stale_estudio()
  session_set(sid, "calc_muestra_estudio", base)

  # Reporte terminado: archivo real en disco + meta como la deja on_complete.
  path <- tempfile("reporte_calc_muestra_", fileext = ".html")
  writeLines("<html>reporte</html>", path)
  session_set(sid, "calc_muestra_reporte", list(
    disponible = TRUE, path = path, job_id = "job-rep-9",
    formato = "html", generated_at = "2026-07-16T00:00:00Z", stale = FALSE
  ))

  # PUT /estudio de autosave (solo workspace): misma transformacion de meta
  # que aplica el handler del router.
  s <- session_get(sid)
  nuevo <- .reporte_stale_estudio(notas = "autosave 2s")
  session_set(sid, "calc_muestra_estudio", nuevo)
  session_set(sid, "calc_muestra_reporte",
              calc_muestra_reporte_meta_tras_estudio(s$calc_muestra_reporte, base, nuevo))

  # Guard EXACTO de GET /reporte/descargar: si es TRUE, el endpoint intenta el
  # rescate por job y termina en stop_api(404, "E_NO_REPORTE"). Antes del fix
  # meta quedaba list(disponible = FALSE) -> 404; ahora debe seguir sirviendo.
  meta <- session_get(sid)$calc_muestra_reporte
  descarga_rota <- is.null(meta) || !isTRUE(meta$disponible) ||
    is.null(meta$path) || !file.exists(meta$path)
  expect_false(descarga_rota)
  expect_equal(meta$job_id, "job-rep-9")
  expect_false(isTRUE(meta$stale))

  # Y con un cambio relevante posterior, la descarga SIGUE viva (stale avisa).
  s <- session_get(sid)
  con_titulo <- .reporte_stale_estudio(titulo = "Version 2")
  session_set(sid, "calc_muestra_estudio", con_titulo)
  session_set(sid, "calc_muestra_reporte",
              calc_muestra_reporte_meta_tras_estudio(s$calc_muestra_reporte, nuevo, con_titulo))
  meta2 <- session_get(sid)$calc_muestra_reporte
  expect_true(isTRUE(meta2$stale))
  expect_false(is.null(meta2$path) || !file.exists(meta2$path) || !isTRUE(meta2$disponible))
})
