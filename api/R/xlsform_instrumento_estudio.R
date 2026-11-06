# El instrumento del estudio en el editor de formularios (auditoría visual del 4 nov 2026, hallazgo 12).
#
# El Home contaba 66 preguntas, las del instrumento vinculado a la base, mientras el editor abría un
# borrador de 1 pregunta: la biblioteca del editor sólo tenía ese borrador y nada en el editor sabía que el
# estudio ya tenía su instrumento. Aquí se dice cuál es (el XLSForm de la primera base que lo declara, el
# mismo que lee `project_overview.R`) y se arma su workbook para abrirlo como un formulario más de la
# biblioteca. El borrador no se toca: queda en la biblioteca con su autosave.

# Tipos de archivo que traen un XLSForm legible por el editor: el subido como tal y el adaptado para
# procesamiento (hojas `survey` y `choices`; la forma la vuelve a exigir el safe gate al abrirlo).
.XLSFORM_KINDS_INSTRUMENTO_ESTUDIO <- c("xlsform", "instrumento_adaptado")

#' El instrumento vinculado al estudio, o `NULL`: archivo, nombre, base y cuántas preguntas trae.
.xlsform_instrumento_del_estudio <- function(s) {
  bases <- s$estudio$bases
  if (!is.list(bases) || !length(bases)) return(NULL)
  for (base in names(bases)) {
    fid <- as.character(bases[[base]]$xlsform_file_id %||% "")[1]
    if (is.na(fid) || !nzchar(fid)) next
    meta <- s$files[[fid]]
    if (!is.list(meta) || !(as.character(meta$kind %||% "")[1] %in% .XLSFORM_KINDS_INSTRUMENTO_ESTUDIO)) next
    conteos <- .overview_instrumento_conteos(s$rp_inst_sources[[base]])
    return(list(
      file_id = fid,
      nombre = as.character(meta$original_name %||% "")[1],
      base = base,
      n_questions = as.integer(conteos$questions_count %||% 0L)
    ))
  }
  NULL
}

#' El workbook del instrumento del estudio, con la misma forma que `/api/xlsform-editor/import`.
.xlsform_instrumento_estudio_workbook <- function(s) {
  inst <- .xlsform_instrumento_del_estudio(s)
  meta <- if (!is.null(inst)) s$files[[inst$file_id]] else NULL
  if (is.null(meta) || !nzchar(as.character(meta$path %||% "")) || !file.exists(meta$path)) {
    stop_api(409, "E_XLSFORM_SIN_INSTRUMENTO_ESTUDIO", "El estudio no tiene un instrumento vinculado que se pueda abrir en el editor.")
  }
  .xlsform_editor_assert_xlsform_shape(meta$path)
  hojas <- lapply(c(survey = "survey", choices = "choices", settings = "settings", paper = "paper"), function(h) {
    .xlsform_editor_read_sheet(meta$path, h, .xlsform_editor_default_columns(h))
  })
  .xlsform_editor_workbook_payload(
    sheets = hojas,
    source_kind = "xlsform",
    source_name = inst$nombre,
    source_meta = list(kind = "xlsform", original_name = inst$nombre, instrumento_estudio = inst$base)
  )
}
