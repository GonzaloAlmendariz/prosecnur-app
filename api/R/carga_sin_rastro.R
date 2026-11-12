# Una carga que falla no deja nada registrado.
#
# Subir un archivo es dos pedidos: `/api/upload` lo guarda en `s$files` y
# `/api/carga/instrumento` o `/api/carga/data` lo procesa. Si el segundo falla
# a mitad, quedaban anotados el archivo (que `estudio_init_default_base()` toma
# después como "el último subido") y `data_raw_meta` (contra el que la carga
# buena siguiente decía "Pasó de 1,434 a 1,000 respuestas"). Este envoltorio
# devuelve la sesión al estado previo al pedido, retira el archivo fallido del
# registro y vuelve a lanzar el error para que el cliente reciba la causa.

#' Ejecuta `expr` y, si falla, deja la sesión como estaba sin el archivo subido.
#' @keywords internal
.carga_sin_rastro_si_falla <- function(sid, file_id, expr) {
  antes <- session_get(sid)
  tryCatch(expr, error = function(e) {
    s <- antes
    if (is.list(s$files)) s$files[[as.character(file_id)]] <- NULL
    .session_env[[sid]] <- s
    stop(e)
  })
}

#' Procesa las respuestas subidas para la base única (`POST /api/carga/data`).
#'
#' Lee la vista previa contra el formulario cargado, anota el archivo como las
#' respuestas vigentes y arma la base "default". El router la llama dentro de
#' `.carga_sin_rastro_si_falla()`: si la base no calza con el formulario, nada
#' de lo anotado aquí sobrevive.
#' @keywords internal
.carga_procesar_data <- function(sid, meta) {
  meta <- .carga_resolve_data_upload_meta(sid, meta)
  file_id <- meta$file_id
  preview_inst <- .carga_current_instrumento_for_data(sid)
  if (is.null(preview_inst)) {
    stop_api(
      409,
      "E_XLSFORM_REQUIRED_FOR_DATA",
      "Primero carga el XLSForm. La data se normaliza y valida usando ese formulario."
    )
  }
  session_set(sid, "choice_code_maps_confirmed", NULL)
  preview <- read_data_preview(
    meta$path,
    meta$ext,
    instrumento = preview_inst,
    choice_code_maps = .carga_editor_choice_code_maps(sid)
  )
  .carga_exigir_base_que_calza(preview$compatibilidad, meta)
  .carga_store_choice_code_maps(
    sid,
    preview$normalizacion$choice_code_maps %||% list(),
    confirmed = FALSE
  )
  previa_meta <- session_get(sid)$data_raw_meta
  session_set(sid, "data_raw_meta", list(file_id = file_id, path = meta$path, ext = meta$ext))
  # Con el formulario ya subido, este punto cierra el par y crea la base
  # "default" (el caso típico de Carga → Validación sin pasar por Analítica).
  estudio_init_default_base(sid)
  # Reemplazo: qué cambió y si la codificación debe volver a adaptarse.
  cambios <- tryCatch(carga_cambios_contra_archivo_previo(sid, previa_meta, meta),
                      error = function(e) NULL)
  list(ok = TRUE, preview = preview, cambios = cambios)
}

#' Rechaza, con su causa, una base a la que le falta más de la mitad del formulario.
#'
#' Es el mismo umbral con el que `base_variables_carga_retiradas()` rechaza la
#' base (menos de la mitad se retira, más es otra base), dicho antes de anotar
#' nada y con lo que el usuario puede corregir: de un libro de Excel se lee la
#' primera hoja, y la base digitada suele traer antes la hoja de códigos.
#' @keywords internal
.carga_exigir_base_que_calza <- function(compat, meta) {
  esperadas <- as.integer((compat %||% list())$expected_columns %||% 0L)
  faltan <- as.integer((compat %||% list())$n_missing %||% 0L)
  if (!isTRUE(compat$applied) || esperadas < 1L || faltan <= 0.5 * esperadas) {
    return(invisible(TRUE))
  }
  ext <- tolower(as.character(meta$ext %||% ""))
  hojas <- if (ext %in% c("xlsx", "xls")) {
    tryCatch(readxl::excel_sheets(meta$path), error = function(e) character(0))
  } else {
    character(0)
  }
  causa <- if (length(hojas) > 1L) {
    sprintf(" Se leyó la hoja \"%s\", la primera del libro; el libro trae también %s.",
            hojas[[1]], paste0("\"", hojas[-1], "\"", collapse = ", "))
  } else {
    ""
  }
  stop_api(
    400,
    "E_DATA_XLSFORM_INCOMPATIBLE",
    sprintf("Las respuestas no calzan con el formulario: de %d %s, %d no %s como columnas de la base.%s",
            esperadas, if (esperadas == 1L) "pregunta" else "preguntas",
            faltan, if (faltan == 1L) "aparece" else "aparecen", causa)
  )
}
