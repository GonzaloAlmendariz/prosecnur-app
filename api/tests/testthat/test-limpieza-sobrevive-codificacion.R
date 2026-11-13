# ADR 0145: las decisiones de limpieza sobreviven a la codificación, y la base
# recibida y la base limpia viajan en el `.pulso`.
#
# Codificación va después de Validación. Aplicar la codificación registra la
# base codificada como data de la base con `estudio_replace_base_files()`, y esa
# función, al cambiar la data, borraba el linaje de la limpieza y vaciaba el
# workspace de Validación. Un estudio terminado quedaba con la base depurada y
# sin nada que la explicara: ni la ficha "recibidas, excluidas, incluidas" del
# informe metodológico ni las decisiones que el script de limpieza necesita.
#
# La base codificada sale de la base limpia vigente (la codificación lee el
# archivo efectivo de la limpieza), así que el linaje y las decisiones siguen
# describiéndola. Una data que no desciende de la vigente (una carga nueva) sí
# los descarta: eso lo cubre test-limpieza-conserva-decisiones.R.

.sobrevive_instrumento <- function(path, variable, label) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = "text", name = variable, label = label, stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(), name = character(), label = character(),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.sobrevive_subir <- function(sid, kind, path) {
  save_upload(sid, kind, basename(path), readBin(path, "raw", n = file.info(path)$size))
}

# Base "principal" con 3 casos recibidos; la limpieza excluyó m-3 y quedó
# promovida con 2. Devuelve los file_id de la recibida y de la limpia.
.sobrevive_estudio_limpio <- function(sid) {
  dir <- file.path(session_get(sid)$dir, "qa")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  recibida <- data.frame(
    `_uuid` = c("m-1", "m-2", "m-3"), `_index` = 1:3,
    recomendacion = c("Mejorar horarios", "Sin comentario", "Prueba"),
    check.names = FALSE
  )
  limpia <- recibida[1:2, , drop = FALSE]

  inst_meta <- .sobrevive_subir(sid, "xlsform", .sobrevive_instrumento(
    file.path(dir, "instrumento.xlsx"), "recomendacion", "Recomendación"))
  path_recibida <- file.path(dir, "recibida.xlsx")
  openxlsx::write.xlsx(recibida, path_recibida, overwrite = TRUE)
  data_meta <- .sobrevive_subir(sid, "data", path_recibida)
  inst <- reporte_instrumento(path = inst_meta$path)
  estudio_add_base(
    sid = sid, nombre = "principal",
    xlsform_file_id = inst_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx", rp_data = reporte_data(recibida, instrumento = inst),
    rp_inst = inst, n_filas = 3L, n_columnas = ncol(recibida)
  )

  path_limpia <- file.path(dir, "base_limpia.xlsx")
  openxlsx::write.xlsx(limpia, path_limpia, overwrite = TRUE)
  limpia_meta <- .register_output_file(sid, "validacion_limpieza_base_limpia", path_limpia)
  .limpieza_promover_base(
    sid = sid, base_nombre = "principal", clean_meta = limpia_meta,
    source_fid = data_meta$file_id, n_antes = 3L, n_despues = 2L,
    n_columnas = ncol(limpia)
  )
  decision <- list(
    id = "PD_001", source_type = "custom_rule", source_id = "RC_prueba",
    scope = "case_subset", action_type = "exclude_cases",
    target_case_ids = list("m-3"), status = "ready",
    rationale = "Encuesta de prueba del equipo de campo."
  )
  validacion_scope_set(sid, "principal", "limpieza_draft", list(decision))
  validacion_scope_set(sid, "principal", "limpieza_artifacts",
                       list(finalized_at = "2026-11-12T10:00:00Z"))
  validacion_scope_set(sid, "principal", "explorador_cache", list(algo = 1L))

  list(dir = dir, limpia = limpia, recibida_fid = data_meta$file_id,
       limpia_fid = limpia_meta$file_id, inst_path = inst_meta$path,
       limpia_path = path_limpia)
}

# Aplica la codificación sobre la base limpia, por la misma vía que la pestaña
# Aplicar: job de adaptación y `.codif_apply_complete()`.
.sobrevive_codificar <- function(sid, est) {
  dir <- est$dir
  data <- est$limpia
  plantilla <- file.path(dir, "plantilla.xlsx")
  filas <- rbind(
    c("_uuid", "_index", "recomendacion", "recomendacion_recod", "Control", NA,
      "nuevo_codigo", "nueva_etiqueta"),
    c("UUID", "Índice", "Respuesta", "Código", "Control / notas", NA,
      "Nuevo código", "Nueva etiqueta"),
    cbind(as.character(data[["_uuid"]]), as.character(data[["_index"]]),
          as.character(data$recomendacion), NA_character_, NA_character_,
          NA_character_, NA_character_, NA_character_)
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "recomendacion")
  openxlsx::writeData(wb, "recomendacion", filas, colNames = FALSE)
  expect_true(.patch_text_sheet(
    wb, "recomendacion", "recomendacion_recod", "recomendacion",
    list(list(codigo = "901", etiqueta = "Horarios", origen = "nuevo",
              respuestas = list("Mejorar horarios"))),
    data
  ))
  openxlsx::saveWorkbook(wb, plantilla, overwrite = TRUE)
  familias <- file.path(dir, "familias.xlsx")
  openxlsx::write.xlsx(data.frame(
    use = TRUE, tipo = "text", parent = "recomendacion",
    parent_col = "recomendacion", text_col = "recomendacion",
    stringsAsFactors = FALSE
  ), familias, overwrite = TRUE)
  paths <- .codif_apply_job_runner(
    xls_path = est$inst_path, data_path = est$limpia_path,
    codes_path = plantilla, fam_path = familias,
    data_out = file.path(dir, "data_adaptada.xlsx"),
    inst_out = file.path(dir, "instrumento_adaptado.xlsx"),
    sm_vars = character(), so_parent_vars = character(),
    so_child_vars = character(), text_vars = "recomendacion",
    int_vars = character()
  )
  .codif_apply_complete(sid, "principal", paths)
}

test_that("aplicar la codificación conserva el linaje y las decisiones de limpieza", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  est <- .sobrevive_estudio_limpio(sid)

  .sobrevive_codificar(sid, est)

  base <- session_get(sid)$estudio$bases$principal
  # La base vigente es la codificada...
  expect_identical(get_file(sid, base$data_file_id)$kind, "data_adaptada")
  # ...y la limpieza sigue explicándola: 3 recibidas, 2 incluidas.
  expect_true(isTRUE(base$limpieza$enabled))
  expect_identical(base$limpieza$source_data_file_id, est$recibida_fid)
  expect_identical(base$limpieza$effective_data_file_id, est$limpia_fid)
  expect_identical(base$limpieza$n_casos_antes, 3L)
  expect_identical(base$limpieza$n_casos_despues, 2L)

  scope <- validacion_scope_get(sid, "principal")
  expect_identical(vapply(scope$limpieza_draft, function(d) d$id, character(1)), "PD_001")
  expect_identical(scope$limpieza_artifacts$finalized_at, "2026-11-12T10:00:00Z")
  # Lo que se calcula sobre la data sí se descarta: la data cambió.
  expect_length(scope$explorador_cache %||% list(), 0L)
})

test_that("revertir la limpieza de una base ya codificada es un 409 con su causa", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  est <- .sobrevive_estudio_limpio(sid)
  .sobrevive_codificar(sid, est)
  vigente_antes <- session_get(sid)$estudio$bases$principal$data_file_id

  err <- tryCatch(limpieza_revertir_promocion(sid, "principal"),
                  api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_LIMPIEZA_REVERTIR_CODIFICADA")
  expect_equal(err$status, 409)
  # Y no tocó nada: la base sigue codificada y la limpieza vigente.
  base <- session_get(sid)$estudio$bases$principal
  expect_identical(base$data_file_id, vigente_antes)
  expect_true(isTRUE(base$limpieza$enabled))
})

test_that("antes de codificar, revertir la limpieza sigue funcionando", {
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  est <- .sobrevive_estudio_limpio(sid)

  limpieza_revertir_promocion(sid, "principal")
  base <- session_get(sid)$estudio$bases$principal
  expect_identical(base$data_file_id, est$recibida_fid)
  expect_false(isTRUE(base$limpieza$enabled))
})

test_that("la base recibida y la base limpia van en los archivos del .pulso", {
  s <- list(
    estudio = list(bases = list(principal = list(
      xlsform_file_id = "XLS_COD", data_file_id = "DATA_COD",
      original_xlsform_file_id = "XLS1", original_data_file_id = "DATA_LIMPIA",
      limpieza = list(enabled = TRUE, source_data_file_id = "DATA_RECIBIDA",
                      effective_data_file_id = "DATA_LIMPIA")
    ))),
    files = list()
  )
  ids <- .pulso_collect_input_fids(s)
  expect_true("DATA_RECIBIDA" %in% ids)
  expect_true("DATA_LIMPIA" %in% ids)

  # Revertida, la recibida sigue haciendo falta: es la data vigente o la que
  # se restituye si se vuelve a cerrar. Sin linaje no se agrega nada.
  s$estudio$bases$principal$limpieza$enabled <- FALSE
  expect_true("DATA_RECIBIDA" %in% .pulso_collect_input_fids(s))
  s$estudio$bases$principal$limpieza <- NULL
  expect_false("DATA_RECIBIDA" %in% .pulso_collect_input_fids(s))
})
