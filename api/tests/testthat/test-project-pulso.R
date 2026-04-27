# =============================================================================
# Tests para el formato .pulso (build_pulso / load_pulso / project_status)
# =============================================================================
# Cubre: round-trip de estado (mantiene tibbles, listas y nested), copia
# de files físicos al zip + restauración con paths reescritos al nuevo
# tempdir, dirty flag tracking, project_close, validaciones de error.

# ----- Helpers ---------------------------------------------------------------

.tiny_xlsx_bytes <- function() {
  # 7 bytes "ZIP header" — lo suficiente para que readBin/writeBin viajen
  # por el zip sin que importe que no es un xlsx real (los tests no lo
  # parsean, solo verifican que el archivo viaja byte-a-byte).
  as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00))
}

.fake_session_with_state <- function() {
  sid <- session_create()
  # Subir un input "referenciado" como instrumento de una base — solo
  # estos viajan en el .pulso (los outputs del pipeline son archivos
  # independientes al lado del .pulso).
  meta <- save_upload(sid, "xlsform", "demo_inst.xlsx", .tiny_xlsx_bytes())
  data_meta <- save_upload(sid, "data", "demo_data.xlsx", .tiny_xlsx_bytes())
  # Asociar a una base del estudio para que .pulso_collect_input_fids
  # los detecte.
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["default"]] <- list(
    nombre = "default",
    xlsform_file_id = meta$file_id,
    data_file_id = data_meta$file_id,
    data_ext = "xlsx"
  )
  .session_env[[sid]] <- s
  session_set(sid, "instrumento", list(
    survey = data.frame(name = c("p1", "p2"), type = c("text", "integer"))
  ))
  session_set(sid, "plan_result", list(
    plan = tibble::tibble(ID = c("R1", "R2"), regla = c("x", "y"))
  ))
  session_set(sid, "reglas_custom", list(
    list(id = "rc1", nombre = "Rango edad", tipo = "rango_num", activa = TRUE)
  ))
  list(sid = sid, file_id = meta$file_id, data_file_id = data_meta$file_id)
}

# ----- Round-trip básico ------------------------------------------------------

test_that("build_pulso + load_pulso preservan estado simple", {
  setup <- .fake_session_with_state()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(setup$sid) })

  res_save <- build_pulso(setup$sid, tmp, project_name = "Test Demo")
  expect_true(res_save$ok)
  expect_true(file.exists(tmp))
  expect_gt(res_save$size, 0L)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  expect_true(res_load$ok)
  expect_true(nzchar(res_load$session_id))

  s <- session_get(res_load$session_id)
  expect_equal(s$instrumento$survey$name[1], "p1")
  expect_equal(nrow(s$plan_result$plan), 2L)
  expect_equal(s$reglas_custom[[1]]$nombre, "Rango edad")
})

# ----- Files físicos ----------------------------------------------------------

test_that("load_pulso restaura los archivos físicos con paths correctos", {
  setup <- .fake_session_with_state()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(setup$sid) })

  build_pulso(setup$sid, tmp)
  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)

  s <- session_get(res_load$session_id)
  expect_equal(length(s$files), 2L)  # xlsform + data
  expect_true(setup$file_id %in% names(s$files))
  meta <- s$files[[setup$file_id]]
  expect_true(file.exists(meta$path))
  # Path apunta al nuevo tempdir, NO al de la sesión original
  expect_true(grepl(res_load$session_id, meta$path, fixed = TRUE))
  # Bytes preservados
  bytes <- readBin(meta$path, "raw", n = 100)
  expect_identical(bytes, .tiny_xlsx_bytes())
})

# ----- Dirty flag -------------------------------------------------------------

test_that("project_dirty se marca al mutar y se limpia al guardar", {
  setup <- .fake_session_with_state()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(setup$sid) })

  # Sin .pulso aún → mutaciones no marcan dirty (modo efímero).
  expect_false(isTRUE(session_get(setup$sid)$project_dirty))

  # Save → ahora hay project_path; dirty queda FALSE.
  build_pulso(setup$sid, tmp)
  expect_false(isTRUE(session_get(setup$sid)$project_dirty))
  expect_equal(session_get(setup$sid)$project_path, tmp)

  # Mutación → dirty TRUE
  session_set(setup$sid, "extra_key", "valor")
  expect_true(isTRUE(session_get(setup$sid)$project_dirty))

  # Save de nuevo → dirty FALSE
  build_pulso(setup$sid, tmp)
  expect_false(isTRUE(session_get(setup$sid)$project_dirty))
})

test_that("session_set en keys internas de project NO entra en bucle de dirty", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  # Forzamos manualmente — no debería disparar mark_dirty (caería en bucle
  # si no estuviera la guarda).
  session_set(setup$sid, "project_path", "/tmp/foo.pulso")
  s <- session_get(setup$sid)
  expect_false(isTRUE(s$project_dirty))
  expect_equal(s$project_path, "/tmp/foo.pulso")
})

# ----- project_status --------------------------------------------------------

test_that("project_status refleja correctamente los estados", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))

  st1 <- project_status(setup$sid)
  expect_false(st1$has_project)
  expect_true(is.na(st1$path))

  tmp <- tempfile(fileext = ".pulso")
  build_pulso(setup$sid, tmp, project_name = "Mi Proyecto X")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)

  st2 <- project_status(setup$sid)
  expect_true(st2$has_project)
  expect_equal(st2$path, tmp)
  expect_false(st2$dirty)
  expect_true(nzchar(st2$last_saved_at))
})

# ----- project_close ---------------------------------------------------------

test_that("project_close limpia path/dirty pero mantiene la sesión y datos", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)

  build_pulso(setup$sid, tmp)
  expect_true(project_status(setup$sid)$has_project)

  project_close(setup$sid)
  st <- project_status(setup$sid)
  expect_false(st$has_project)
  # La sesión sigue viva con datos
  s <- session_get(setup$sid)
  expect_equal(nrow(s$plan_result$plan), 2L)
})

# ----- Excluye caches transient ---------------------------------------------

test_that("build_pulso excluye codif_por_base[*]$inst y $data del state", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  # Inyectar caches "gordos" simulados.
  codif_set(setup$sid, "inst", list(survey = data.frame(name = "x")), source = "default")
  codif_set(setup$sid, "data", data.frame(a = 1:1000), source = "default")

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)
  expect_null(s$codif_por_base$default$inst)
  expect_null(s$codif_por_base$default$data)
})

# ----- Outputs son independientes (no van en el .pulso) ---------------------

test_that("build_pulso excluye outputs/entregables del zip — solo inputs viajan", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  # Subir un "output" simulado (kind raro) que NO está referenciado por
  # ninguna base ni por codif_por_base. NO debería viajar al .pulso.
  output_meta <- save_upload(setup$sid, "data", "codebook_generated.xlsx",
                              .tiny_xlsx_bytes())
  # Notar: este file_id existe en s$files pero ninguna base lo referencia
  # como xlsform_file_id ni data_file_id ni familias_file_id.

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  # Verificar zip contents: solo deben estar los 2 inputs referenciados,
  # NO el "output" no referenciado.
  entries <- zip::zip_list(tmp)$filename
  files_entries <- entries[startsWith(entries, "files/")]
  expect_length(files_entries, 2L)
  expect_true(any(grepl(setup$file_id, files_entries, fixed = TRUE)))
  expect_true(any(grepl(setup$data_file_id, files_entries, fixed = TRUE)))
  expect_false(any(grepl(output_meta$file_id, files_entries, fixed = TRUE)))
})

# ----- Persistencia del estado del dashboard --------------------------------

test_that("build_pulso preserva dashboard_source, dashboard_config y dashboard_curacion", {
  setup <- .fake_session_with_state()
  on.exit({ session_delete(setup$sid) })

  # Simular estado del dashboard: source con file_ids, config estético,
  # curaduría confirmada.
  session_set(setup$sid, "dashboard_source", list(
    ready = TRUE,
    source_kind = "session",
    xlsform_file_id = setup$file_id,
    data_file_id = setup$data_file_id,
    xlsform_name = "demo_inst.xlsx",
    data_name = "demo_data.xlsx",
    n_filas = 100L,
    n_columnas = 10L,
    loaded_at = "2026-04-26T00:00:00Z"
  ))
  session_set(setup$sid, "dashboard_config", list(
    titulo = "Mi Tablero",
    subtitulo = "Demo",
    paleta_id = "tableau10",
    paletas_listas = list(likert = list("Sí" = "#1f77b4", "No" = "#d62728")),
    color_primario_override = "#FF6600",
    notas = "Notas de prueba"
  ))
  session_set(setup$sid, "dashboard_curacion", list(
    confirmed = TRUE,
    exclude_sections = c("metadatos"),
    exclude_vars = c("fecha_inicio", "device_id")
  ))

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)

  expect_equal(s$dashboard_source$xlsform_file_id, setup$file_id)
  expect_equal(s$dashboard_source$xlsform_name, "demo_inst.xlsx")
  expect_equal(s$dashboard_config$titulo, "Mi Tablero")
  expect_equal(s$dashboard_config$paleta_id, "tableau10")
  expect_equal(s$dashboard_config$color_primario_override, "#FF6600")
  expect_true(isTRUE(s$dashboard_curacion$confirmed))
  expect_equal(s$dashboard_curacion$exclude_vars,
               c("fecha_inicio", "device_id"))
})

test_that("build_pulso excluye dashboard_rp_inst y dashboard_rp_data del state", {
  setup <- .fake_session_with_state()
  on.exit({ session_delete(setup$sid) })

  # Inyectar caches gordos simulados (NO van por byte-a-byte: son
  # derivables del par xlsform/data referenciado en dashboard_source).
  session_set(setup$sid, "dashboard_rp_inst", list(
    survey = data.frame(name = paste0("v", 1:50), type = "text"),
    choices = data.frame(list_name = "lista", name = letters, label = letters)
  ))
  session_set(setup$sid, "dashboard_rp_data", data.frame(a = 1:1000, b = 1:1000))
  # Source mínimo para que el rebuild encuentre algo (file_ids reales del
  # setup); si reporte_instrumento falla con el xlsx falso, el tryCatch lo
  # absorbe y los caches quedan NULL.
  session_set(setup$sid, "dashboard_source", list(
    ready = TRUE,
    xlsform_file_id = setup$file_id,
    data_file_id = setup$data_file_id
  ))

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)
  # rp_inst/data nunca viajan en el state.rds — quedan NULL si el rebuild
  # falla (xlsform demo no es parseable). El strip evita que el .pulso se
  # infle con tibbles regenerables.
  expect_null(s$dashboard_rp_inst)
  expect_null(s$dashboard_rp_data)
})

# ----- Errores ---------------------------------------------------------------

test_that("load_pulso falla con mensaje claro si el archivo no existe", {
  expect_error(load_pulso("/tmp/noexiste.pulso"), class = "api_error")
})
