# =============================================================================
# Rehidratar el contexto de criterios releyendo la base
# =============================================================================
#
# `calc_muestra_aulas_criterios_contexto` es `cache_stripped`: lleva la tabla
# atómica estudiante x CH y se borra al guardar. Sin ella, el recorrido vivo
# puede recalcular los criterios de CURSO-HORARIO desde el marco guardado (ver
# `.cm_criterios_contexto_desde_marco()`), pero NO el efecto de un criterio de
# alumno: eso exige volver a leer la base.
#
# Se puede, y es exacto. El marco firma sus fuentes (`sources_used`) y los
# archivos viajan en `files/`, así que reconstruir con esas fuentes y la config
# guardada devuelve el MISMO `frame_hash` (medido sobre HSVG26DEF:
# e432bc731dad9890). Lo que costaba era el precio: 186 s el build entero.
#
# `construir(solo_criterios = TRUE)` para en el paso 4, donde la tabla atómica ya
# existe y los pasos 5-8 —que son 128 de esos 186 s— sólo publican agregados que
# el `.pulso` YA trae. Medido: 59,7 s y las 137.919 filas.
#
# Sigue siendo demasiado para el hilo de plumber, así que el llamador lo corre
# como job. Aquí sólo vive la operación pura.

#' Fuentes con las que se construyó un marco, listas para releer.
#'
#' @param sid sesión.
#' @param frame marco persistido.
#' @return lista por rol con el data.frame leído; vacía si el marco no firma sus
#'   fuentes o algún archivo ya no está.
#' @keywords internal
.cm_criterios_fuentes_del_marco <- function(sid, frame) {
  firma <- (frame %||% list())$sources_used
  if (!is.list(firma) || !length(firma)) return(list())
  out <- list()
  for (rol in names(firma)) {
    fid <- .cm_aulas_scalar(firma[[rol]]$file_id, "")
    if (!nzchar(fid)) next
    meta <- tryCatch(get_file(sid, fid), error = function(e) NULL)
    if (is.null(meta) || !file.exists(meta$path)) return(list())
    hoja <- .cm_aulas_scalar(firma[[rol]]$sheet, "")
    out[[rol]] <- .cm_aulas_read_table(meta$path, sheet = if (nzchar(hoja)) hoja else NULL)
  }
  out
}

#' Contexto COMPLETO de criterios, reconstruido releyendo la base.
#'
#' Compone los agregados que el marco guardado ya trae con la tabla atómica que
#' se acaba de releer. No toca el marco: si la base cambió, se rechaza en vez de
#' publicar un contexto que describe otro universo.
#'
#' @param sid sesión.
#' @param frame marco persistido (`calc_muestra_aulas_frame`).
#' @return el contexto, o NULL si el marco no firma fuentes, si algún archivo
#'   falta o si lo releído ya no corresponde al marco guardado.
#' @keywords internal
.cm_criterios_rehidratar_contexto <- function(sid, frame) {
  base <- .cm_criterios_contexto_desde_marco(frame)
  if (is.null(base)) return(NULL)
  tablas <- .cm_criterios_fuentes_del_marco(sid, frame)
  if (!length(tablas)) return(NULL)

  criterios <- tryCatch(
    calc_muestra_aulas_construir(
      base_madre = tablas$base_madre,
      estudiantes = tablas$estudiantes,
      inscripciones = tablas$inscripciones,
      catalogo_curso_horario = tablas$catalogo_curso_horario,
      config = frame$config,
      solo_criterios = TRUE
    ),
    error = function(e) NULL
  )
  if (!is.list(criterios)) return(NULL)

  # La base pudo cambiar desde que se construyó el marco. El contexto describiría
  # entonces un universo distinto del que la pantalla enseña, y el recorrido vivo
  # daría cifras de otro estudio sin que nada avisara. Se compara la identidad de
  # los cursos-horario, que es lo que ancla todas las cifras del preview.
  ids_marco <- .cm_aulas_text_key(.cm_aulas_values(base$aula_frame, "classroom_id", ""))
  ids_relec <- .cm_aulas_text_key(.cm_aulas_values(criterios$aula_frame, "classroom_id", ""))
  if (!identical(sort(ids_marco), sort(ids_relec))) return(NULL)

  base$criterios <- criterios
  # Los valores por aula del build real, no los derivados del marco: llevan las
  # señales del catálogo, que `.cm_criterios_contexto_desde_marco()` no puede
  # reconstruir sin él.
  valores <- (criterios$seleccion_aula %||% list())$valores
  if (is.list(valores) && length(valores)) base$values <- valores
  # `student_index` lo recalcula el preview desde `filas`; dejarlo fuera evita
  # cargar dos veces la misma estructura en la sesión.
  base$student_index <- NULL
  base$desde_marco <- FALSE
  base
}

#' Envoltorio para `job_submit()`: rehidrata en un worker y devuelve el contexto.
#'
#' El worker de `callr` resuelve las funciones contra el paquete INSTALADO, así
#' que esta función se exporta; las tablas viajan ya leídas para no depender de
#' la sesión desde el worker.
#'
#' @param tablas fuentes ya leídas, por rol.
#' @param frame marco persistido, del que salen config y agregados.
#' @param progress_path archivo de progreso que inyecta `jobs.R`.
#' @return el contexto rehidratado, o NULL si lo releído no corresponde.
#' @keywords internal
calc_muestra_aulas_criterios_rehidratar_job <- function(tablas, frame, progress_path = NULL) {
  escribir <- if (is.character(progress_path) && nzchar(progress_path)) {
    job_progress_writer(progress_path)
  } else {
    function(...) invisible(NULL)
  }
  escribir(phase = "running", current = 1L, total = 2L,
           message = "Releyendo la base para recuperar el recuento de estudiantes")
  criterios <- calc_muestra_aulas_construir(
    base_madre = tablas$base_madre,
    estudiantes = tablas$estudiantes,
    inscripciones = tablas$inscripciones,
    catalogo_curso_horario = tablas$catalogo_curso_horario,
    config = frame$config,
    solo_criterios = TRUE
  )
  escribir(phase = "running", current = 2L, total = 2L,
           message = "Componiendo el recorrido vivo")
  base <- .cm_criterios_contexto_desde_marco(frame)
  if (is.null(base) || !is.list(criterios)) return(NULL)
  ids_marco <- .cm_aulas_text_key(.cm_aulas_values(base$aula_frame, "classroom_id", ""))
  ids_relec <- .cm_aulas_text_key(.cm_aulas_values(criterios$aula_frame, "classroom_id", ""))
  if (!identical(sort(ids_marco), sort(ids_relec))) return(NULL)
  base$criterios <- criterios
  valores <- (criterios$seleccion_aula %||% list())$valores
  if (is.list(valores) && length(valores)) base$values <- valores
  base$student_index <- NULL
  base$desde_marco <- FALSE
  base
}

#' `on_complete` del job: adopta el contexto en la sesión.
#'
#' Recibe el job, como todo `on_complete` (`jobs.R` lo invoca con `j`). Un
#' resultado nulo significa que la relectura no correspondía al marco guardado;
#' se dice, no se adopta.
#'
#' @param sid sesión.
#' @return función `on_complete` para `job_submit()`.
#' @keywords internal
.cm_criterios_rehidratar_on_complete <- function(sid) {
  function(j) {
    contexto <- j$result_data
    s_now <- session_get(sid, required = FALSE)
    if (is.null(s_now) || !is.list(contexto)) {
      return(list(
        ok = TRUE, kind = "calc_muestra_aulas_criterios_rehidratar",
        adoptado = FALSE,
        motivo = "La base releída ya no corresponde al marco guardado."
      ))
    }
    session_set(sid, "calc_muestra_aulas_criterios_contexto", contexto)
    list(ok = TRUE, kind = "calc_muestra_aulas_criterios_rehidratar", adoptado = TRUE)
  }
}
