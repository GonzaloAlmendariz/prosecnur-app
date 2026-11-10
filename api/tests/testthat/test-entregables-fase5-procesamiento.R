# ADR 0133, fase 5 (oleada 3) — Codificación, Editor XLSForm, Validación, Analítica y Gráficos.
#
# Cada salida responde su nombre y los cuatro campos del registro (modulo, rotulo, guardado_en,
# aviso_guardado). Con un .pulso guardado, lo que el usuario pidió queda UNA vez en
# `Entregables/<Módulo>`; las vistas previas (impreso, visor de Word, lámina) se sirven sin copia.
# Los motores pesados se simulan; el registro y los handlers son los reales (`.bv_call`).

.p5_guardada <- function(envir = parent.frame()) {
  withr::local_envvar(PULSO_PUBLIC_MODE = "", .local_envir = envir)
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = "HSVG2026"), 0L)
  carpeta <- withr::local_tempdir(.local_envir = envir)
  s <- session_get(sid); s$project_path <- file.path(carpeta, "HSVG2026.pulso"); .session_env[[sid]] <- s
  list(sid = sid, carpeta = carpeta)
}

.p5_escribir <- function(path, ...) { writeBin(charToRaw("contenido de prueba"), path); invisible(path) }
.p5_patron <- function(cuerpo, ext) paste0("^", cuerpo, "_[0-9]{2}_[0-9]{2}_[0-9]{2}\\.", ext, "$")
.p5_campos <- c("modulo", "rotulo", "guardado_en", "aviso_guardado")

# Con copia: el archivo queda una vez en Entregables/<modulo>.
.p5_copiado <- function(resp, fx, modulo, rotulo) {
  expect_true(all(.p5_campos %in% names(resp)), info = rotulo)
  expect_identical(resp$modulo, modulo)
  expect_identical(resp$rotulo, rotulo)
  expect_true(is.character(resp$guardado_en) && !is.na(resp$guardado_en) && file.exists(resp$guardado_en), info = rotulo)
  expect_true(basename(resp$guardado_en) %in% list.files(file.path(fx$carpeta, "Entregables", modulo)))
  expect_false("path" %in% names(resp))
}

# Sin copia: se sirve, pero no deja archivo junto al proyecto.
.p5_sin_copia <- function(resp, fx, modulo) {
  expect_true(all(.p5_campos %in% names(resp)))
  expect_true(is.na(resp$guardado_en))
  expect_false(dir.exists(file.path(fx$carpeta, "Entregables", modulo)) &&
                 length(list.files(file.path(fx$carpeta, "Entregables", modulo))) > 0L)
}

.p5_job <- function(sid, kind, ext, result_data = list(ok = TRUE), envir = parent.frame()) {
  nombre <- .export_filename(sid, kind, ext)
  path <- file.path(withr::local_tempdir(.local_envir = envir), paste0(uuid::UUIDgenerate(), "__", nombre))
  .p5_escribir(path)
  list(sid = sid, status = "done", result_path = path, finished_at = Sys.time(), result_data = result_data)
}

test_that("Validación › plan de limpieza exportado: el registro y una copia", {
  fx <- .p5_guardada()
  local_mocked_bindings(
    .get_base_scope = function(...) list(plan_result = list(plan = data.frame(regla = "r1"))),
    .resolve_base_files = function(...) list(xlsform = list(path = "x.xlsx")),
    leer_xlsform_limpieza = function(...) list(),
    .validacion_apply_label_overrides = function(sid, inst) inst,
    exportar_plan_limpieza = function(plan, x, path, overwrite = TRUE) .p5_escribir(path)
  )
  resp <- .bv_call(mount_validacion, "POST", "/api/validacion/v2/instrumento/plan/export", fx$sid)
  .p5_copiado(resp, fx, "Procesamiento", "Plan de limpieza")
  expect_match(resp$filename, .p5_patron("HSVG2026_Plan_de_limpieza", "xlsx"))
  expect_identical(resp$original_name, resp$filename)
  expect_identical(length(list.files(file.path(fx$carpeta, "Entregables", "Procesamiento"))), 1L)
})

test_that("Validación › paquete metodológico: el job registra el ZIP con file_id y el registro", {
  fx <- .p5_guardada()
  j <- .p5_job(fx$sid, "metodologia_validacion", "zip",
               result_data = list(ok = TRUE, size = 19, filename = "x", n_rules = 4L, inventory_hash = "h",
                                  entries = list("plan.pdf", "plan.R")))
  resp <- .validacion_metodologia_bundle_on_complete(j)
  .p5_copiado(resp, fx, "Procesamiento", "Metodología de validación")
  expect_match(resp$filename, .p5_patron("HSVG2026_Metodologia_de_validacion", "zip"))
  expect_false(grepl("__", resp$filename, fixed = TRUE))   # sin el prefijo del job
  expect_identical(resp$n_rules, 4L)
  expect_false(is.null(get_file(fx$sid, resp$file_id)))
  expect_identical(length(list.files(file.path(fx$carpeta, "Entregables", "Procesamiento"))), 1L)
  fuente <- paste(deparse(body(mount_validacion)), collapse = "\n")
  expect_match(fuente, "on_complete = .validacion_metodologia_bundle_on_complete", fixed = TRUE)
  cat <- entregables_catalogo()
  expect_true(cat$guardar[cat$kind == "metodologia_validacion"])
})

test_that("Limpieza › los tres archivos del cierre se copian junto al proyecto", {
  fx <- .p5_guardada()
  escribir <- function(path, ...) .p5_escribir(path)
  local_mocked_bindings(
    .limpieza_build_decision_queue = function(...) list(),
    .limpieza_simulate = function(...) list(data_final = data.frame(a = 1), logs = list(),
                                            impact = list(cases_excluded = 0L, cells_changed = 0L)),
    .limpieza_build_summary = function(...) list(ok = TRUE),
    .resolve_base_files = function(...) stop("sin origen"),
    .bases_write_xlsx = function(d1, d2, path, ...) escribir(path),
    .limpieza_promocion_bloqueada_por_repeats = function(...) FALSE,
    .limpieza_promover_base = function(...) list(enabled = TRUE),
    build_limpieza = function(...) list(),
    build_report_html = function(...) "<html></html>",
    .limpieza_export_excel = function(path, ...) escribir(path),
    validacion_scope_set = function(...) invisible(NULL)
  )
  out <- limpieza_finalize(fx$sid, "docentes", scope = list(evaluacion = list(ok = TRUE), limpieza_draft = list()))
  for (f in out$artifacts$files) .p5_copiado(f, fx, "Procesamiento", f$rotulo)
  expect_identical(length(list.files(file.path(fx$carpeta, "Entregables", "Procesamiento"))), 3L)
})

test_that("Editor XLSForm › el export es un entregable, no un insumo de la sesión", {
  fx <- .p5_guardada()
  # Forma del editor: cada hoja es {columns, rows} con filas posicionales.
  workbook <- list(
    survey = list(columns = list("type", "name", "label"), rows = list(list("text", "p1", "Nombre"))),
    choices = list(columns = list("list_name", "name", "label"), rows = list(list("sn", "1", "Sí"))),
    settings = list(columns = list("form_title", "form_id"), rows = list(list("Docentes v3", "docentes")))
  )
  resp <- .bv_call(mount_xlsform_editor, "POST", "/api/xlsform-editor/export", fx$sid,
                   list(workbook = workbook, filename = "HSVG2026_formulario_v3.xlsx"))
  .p5_copiado(resp, fx, "Formularios", "XLSForm")
  expect_match(resp$filename, .p5_patron("HSVG2026_XLSForm_Docentes_v3", "xlsx"))
  expect_identical(resp$original_name, resp$filename)
  expect_gt(resp$size, 0)
  meta <- get_file(fx$sid, resp$file_id)
  expect_identical(meta$kind, "xlsform_editor_export")
  expect_true(file.exists(meta$path))   # el temporal del handler se borra; la copia de descargas queda
  # No entra a la lista de XLSForm de la sesión (fallback de Carga, traspaso de Monitoreo, .pulso).
  expect_false(any(vapply(session_get(fx$sid)$files, function(f) identical(f$kind, "xlsform"), logical(1))))
  expect_identical(length(list.files(file.path(fx$carpeta, "Entregables", "Formularios"))), 1L)
})

test_that("Editor XLSForm › el impreso se copia; su vista previa y el visor de Word no", {
  pub_de <- function(fx, spec, filename) {
    path <- file.path(withr::local_tempdir(.local_envir = parent.frame(2)), paste0(uuid::UUIDgenerate(), ".", spec$ext))
    .p5_escribir(path)
    j <- list(status = "done", result_path = path, result_data = list(ok = TRUE, summary = list(), warnings = character()))
    .xlsform_editor_export_on_complete(fx$sid, spec, filename)(j)
  }
  fx <- .p5_guardada()
  pdf <- pub_de(fx, list(ext = "pdf", output_kind = "formulario_pdf"),
                .export_filename(fx$sid, "formulario_pdf", "pdf", detalle = "Docentes v3"))
  .p5_copiado(pdf, fx, "Formularios", "Cuestionario")
  expect_true(all(c("ok", "file_id", "original_name", "size", "summary", "warnings") %in% names(pdf)))
  expect_match(pdf$original_name, .p5_patron("HSVG2026_Cuestionario_Docentes_v3", "pdf"))

  fx2 <- .p5_guardada()
  previa <- pub_de(fx2, list(ext = "pdf", output_kind = "formulario_pdf", registro_kind = "formulario_pdf_previa"),
                   .export_filename(fx2$sid, "formulario_pdf_previa", "pdf"))
  .p5_sin_copia(previa, fx2, "Formularios")
  expect_identical(get_file(fx2$sid, previa$file_id)$kind, "formulario_pdf_previa")
  visor <- pub_de(fx2, list(ext = "docx", output_kind = "formulario_word", registro_kind = "formulario_word_visor"),
                  .export_filename(fx2$sid, "formulario_word_visor", "docx"))
  .p5_sin_copia(visor, fx2, "Formularios")

  # La previa se pide con `previa: true` en el cuerpo; el visor la trae en su spec.
  expect_true(.xlsform_editor_es_previa(list(previa = TRUE)))
  expect_true(.xlsform_editor_es_previa(list(proposito = "previa")))
  expect_false(.xlsform_editor_es_previa(list()))
  expect_match(paste(deparse(body(mount_xlsform_editor)), collapse = "\n"),
               'registro_kind = "formulario_word_visor"', fixed = TRUE)
  cat <- entregables_catalogo()
  expect_true(all(cat$guardar[cat$kind %in% c("formulario_pdf", "formulario_word", "xlsform_editor_export")]))
  expect_false(any(cat$guardar[cat$kind %in% c("formulario_pdf_previa", "formulario_word_visor")]))
})

test_that("Editor XLSForm › el job de la previa registra con el kind de previa y el del export con el suyo", {
  fx <- .p5_guardada()
  capturado <- NULL
  local_mocked_bindings(job_submit = function(sid, kind, func, args, result_filename, on_complete, ...) {
    capturado <<- list(kind = kind, result_filename = result_filename); "job-1"
  })
  cuerpo <- function(previa) list(workbook = list(
    survey = list(columns = list("type", "name", "label"), rows = list(list("text", "p1", "P1"))),
    settings = list(columns = list("form_title"), rows = list(list("Docentes v3")))), previa = previa)
  .bv_call(mount_xlsform_editor, "POST", "/api/xlsform-editor/export-pdf", fx$sid, cuerpo(TRUE))
  expect_identical(capturado$kind, "xlsform_editor.formulario_pdf")    # el kind del job no cambia
  expect_match(capturado$result_filename, "^HSVG2026_Vista_previa_del_cuestionario_")
  .bv_call(mount_xlsform_editor, "POST", "/api/xlsform-editor/export-pdf", fx$sid, cuerpo(FALSE))
  expect_match(capturado$result_filename, .p5_patron("HSVG2026_Cuestionario_Docentes_v3", "pdf"))
})

test_that("Analítica › comparativo armonizado: el on_complete responde con el registro", {
  fx <- .p5_guardada()
  oc <- NULL
  local_mocked_bindings(
    .analitica_get_config = function(...) list(cruces = list()),
    .armz_preparar = function(...) list(periodos = c("b2024", "b2026")),
    .armz_rotulos = function(periodos, ...) list(b2024 = "2024", b2026 = "2026"),
    .armz_notas_de_la_base = function(...) list(),
    estudio_active_base = function(...) "b2026",
    job_save_rds = function(...) tempfile(),
    job_submit = function(..., on_complete) { oc <<- on_complete; "job-1" }
  )
  .armonizada_submit(fx$sid, "frecuencias", list())
  j <- .p5_job(fx$sid, "comparativo_simple", "xlsx")
  manifiesto <- paste0(j$result_path, ".manifest.json"); writeLines("{}", manifiesto)
  resp <- oc(j)
  .p5_copiado(resp, fx, "Procesamiento", "Comparativo de frecuencias")
  expect_match(resp$filename, .p5_patron("HSVG2026_Comparativo_de_frecuencias", "xlsx"))
  expect_identical(length(resp$artifacts), 2L)
  # El manifiesto se registra pero no se copia: queda sólo el libro.
  expect_identical(length(list.files(file.path(fx$carpeta, "Entregables", "Procesamiento"))), 1L)
})

test_that("Gráficos › la vista previa de una lámina trae filename y no deja copia", {
  fx <- .p5_guardada()
  pptx <- tempfile(fileext = ".pptx"); .p5_escribir(pptx)
  local_mocked_bindings(
    .preview_con_formas = function(x, ...) x,
    .mini_graficos_publico = function(...) list()
  )
  r <- list(hash = "h1", pptx = pptx, slide_previews = list(), meta = list(partes = list(), avisos = character()),
            cache = "miss", motivo_sin_imagen = NULL)
  resp <- .graficos_preview_respuesta(fx$sid, r, list(include_images = FALSE), "barras", "S12")
  expect_match(resp$filename, .p5_patron("HSVG2026_Vista_previa_de_lamina", "pptx"))
  expect_identical(resp$filename, get_file(fx$sid, resp$file_id)$original_name)
  expect_false(dir.exists(file.path(fx$carpeta, "Entregables")))
})

test_that("Analítica › el XLSForm final que acompaña al libro en PDF no se copia", {
  fx <- .p5_guardada()
  local_mocked_bindings(
    .load_rp_sources = function(sid) list(data_sources = list(principal = data.frame(a = 1)),
                                          inst_sources = list(principal = list())),
    estudio_processing_filter_sources = function(sid, ds, is_) list(data_sources = ds, inst_sources = is_)
  )
  escribir <- function(rp_data, rp_inst, out_path) .p5_escribir(out_path)
  sin <- run_report_multibase(fx$sid, "xlsform_final", "xlsx", "xlsform_final", "xlsform_final_zip", escribir,
                              copiar = FALSE)
  expect_true(is.na(sin$guardado_en))
  expect_false(dir.exists(file.path(fx$carpeta, "Entregables")))
  con <- run_report_multibase(fx$sid, "xlsform_final", "xlsx", "xlsform_final", "xlsform_final_zip", escribir)
  expect_true(file.exists(con$guardado_en))
  expect_identical(length(list.files(file.path(fx$carpeta, "Entregables", "Procesamiento"))), 1L)
  expect_match(paste(deparse(body(mount_analitica)), collapse = "\n"),
               'copiar = !identical(formato, "pdf")', fixed = TRUE)
})
