# =============================================================================
# Construir el marco de aulas fuera del hilo único (I21b)
# =============================================================================
#
# Plumber es monohilo: mientras `POST /api/calc-muestra/marco/construir` corría
# síncrono, NINGUNA otra petición se atendía. Con el marco de HSVG2026 (136.284
# filas) eso midió más de 9 minutos de app entera congelada, sin progreso, sin
# cancelación y con el sello diciendo «al día» durante toda la corrida.
#
# Mismo patrón que comparar-metodos / seleccionar / simular-reemplazos: gate por
# tamaño, job `callr` con progreso por etapas y cancelación. La diferencia está
# en el gate: los otros miden el marco YA construido (n de aulas), y aquí el
# marco todavía no existe — lo único medible por adelantado son las filas de
# entrada.
#
# Este archivo existe porque `calc_muestra_aulas.R` está congelado a
# crecimiento: la funcionalidad nueva vive aquí y el motor solo la llama.

# --- Progreso ----------------------------------------------------------------

#' Emisor de hitos del build, tolerante a la ausencia de callback.
#'
#' Devuelve SIEMPRE una función, para que el motor no tenga que preguntar por
#' NULL en cada hito (esa pregunta repetida es justo lo que haría crecer el
#' archivo congelado). Sin callback, no hace nada.
#'
#' `force = TRUE` en cada hito: son seis etapas en varios minutos, no un bucle.
#' Con el rate-limit por defecto del writer (0.5 s) las etapas rápidas se
#' perderían y la UI se quedaría clavada en una etapa vieja.
.cm_aulas_construir_progreso <- function(on_progress, total = 8L) {
  if (!is.function(on_progress)) return(function(...) invisible(NULL))
  function(current, message) {
    on_progress(
      phase = "running",
      current = current,
      total = total,
      message = message,
      force = TRUE
    )
    invisible(NULL)
  }
}

# --- Gate sync/job -----------------------------------------------------------

#' Filas de entrada del build, antes de que exista marco alguno.
#'
#' Cuenta la tabla que de verdad manda según el modo de entrada: `base_madre`
#' cuando viene, y si no la suma de estudiantes + inscripciones (modo dos
#' bases). El catálogo de curso-horario no entra: es dimensional, del orden de
#' las aulas y no de las filas alumno×curso, así que no explica el costo.
calc_muestra_aulas_construir_input_rows <- function(base_madre = NULL,
                                                   estudiantes = NULL,
                                                   inscripciones = NULL) {
  n_de <- function(x) {
    if (is.data.frame(x)) return(nrow(x))
    if (is.list(x)) return(length(x))
    0L
  }
  base_n <- n_de(base_madre)
  if (base_n > 0L) return(base_n)
  n_de(estudiantes) + n_de(inscripciones)
}

#' Umbral de filas por encima del cual construir se va a job.
#'
#' Default 20.000: deja síncronos los marcos chicos —donde el job costaría más
#' en serializar que en calcular— y manda a job los institucionales, que son los
#' que congelaban la app. Ajustable por entorno para poder probar ambos caminos
#' sin fabricar una base de 20.000 filas.
.cm_aulas_construir_job_threshold <- function() {
  raw <- suppressWarnings(as.integer(
    Sys.getenv("PULSO_CALC_MUESTRA_CONSTRUIR_JOB_THRESHOLD", "20000")
  ))
  if (is.na(raw) || raw < 1L) 20000L else raw
}

.cm_aulas_construir_run_as_job <- function(input_rows) {
  isTRUE(input_rows >= .cm_aulas_construir_job_threshold())
}

# --- Wrapper del job ---------------------------------------------------------

# El worker `callr` resuelve funciones contra el PAQUETE INSTALADO, no contra
# load_all(): los tests que disparen este job de verdad necesitan
# `R CMD INSTALL` antes (trampa ya pagada dos veces, ver skill /jobs-asincronos).
calc_muestra_aulas_construir_job <- function(base_madre = NULL,
                                             estudiantes = NULL,
                                             inscripciones = NULL,
                                             catalogo_curso_horario = NULL,
                                             config = list(),
                                             progress_path = NULL) {
  on_progress <- .cm_aulas_job_progress_writer(progress_path)
  calc_muestra_aulas_construir(
    base_madre = base_madre,
    estudiantes = estudiantes,
    inscripciones = inscripciones,
    catalogo_curso_horario = catalogo_curso_horario,
    config = config,
    on_progress = on_progress
  )
}
attr(calc_muestra_aulas_construir_job, "prosecnur_job_function_name") <- "calc_muestra_aulas_construir_job"

# --- Persistencia del resultado ----------------------------------------------

#' Callback `on_complete` del job de construir.
#'
#' A diferencia de comparar/seleccionar, aquí NO se comprueba la vigencia de un
#' marco anterior: este job *produce* el marco, no lo consume, así que no hay
#' `frame_hash` previo contra el cual quedar obsoleto. Lo que sí se respeta es
#' el efecto del build síncrono: guardar el marco y limpiar todo lo que dependía
#' del marco viejo (selección, comparación, certeza, reemplazos, export), porque
#' un marco nuevo invalida cualquier resultado derivado del anterior.
#'
#' El payload que devuelve es liviano a propósito: el marco completo vive en la
#' sesión y el frontend lo lee con GET /api/calc-muestra/state.
.cm_aulas_construir_on_complete <- function(sid, referencia_asistencia = NULL) {
  function(j) {
    frame <- j$result_data
    s_now <- session_get(sid, required = FALSE)
    if (is.null(s_now) || !is.list(frame)) {
      return(list(ok = TRUE, kind = "calc_muestra_aulas_construir", persisted = FALSE))
    }
    frame <- .cm_criterios_frame_guardar(sid, frame, referencia_asistencia)
    session_set(sid, "calc_muestra_aulas_selection", NULL)
    session_set(sid, "calc_muestra_aulas_method_comparison", NULL)
    session_set(sid, "calc_muestra_aulas_certeza", NULL)
    session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
    session_set(sid, "calc_muestra_aulas_export", NULL)
    session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
    list(
      ok = TRUE,
      kind = "calc_muestra_aulas_construir",
      persisted = TRUE,
      frame_hash = .cm_aulas_scalar(frame$frame_hash %||% "", ""),
      aulas_n = .cm_aulas_frame_n(frame)
    )
  }
}
