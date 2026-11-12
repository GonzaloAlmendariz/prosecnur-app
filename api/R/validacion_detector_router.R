# =============================================================================
# GET /api/validacion/v2/detector-consistencia  (X-Base-Nombre)
# =============================================================================
# Lectura: no guarda nada ni marca el proyecto. Devuelve las sugerencias del
# detector de consistencia (validacion_detector_consistencia.R) sobre la base
# pedida por su cabecera; nunca cae en la primera base.
#
# Query `pares` (opcional): pares de preguntas que el analista pide cruzar,
# "a:b,c:d". Un par mal escrito o con una pregunta que la base no tiene
# responde 400 E_BAD_REQUEST.
#
# Datos: los de la última evaluación si existe (ya normalizados) y, si no, el
# archivo de la base. La fila de cada caso es la del archivo cargado.
# Recopilador: el rol declarado en "Quién recolectó"
# (`operational_config$identity$agent_variable`), nunca adivinado por nombre.

.vdc_parsear_pares <- function(x) {
  txt <- trimws(as.character(x %||% "")[1])
  if (is.na(txt) || !nzchar(txt)) return(list())
  partes <- trimws(strsplit(txt, ",", fixed = TRUE)[[1]])
  partes <- partes[nzchar(partes)]
  lapply(partes, function(p) {
    par <- trimws(strsplit(p, ":", fixed = TRUE)[[1]])
    if (length(par) != 2L || any(!nzchar(par)) || identical(par[1], par[2])) {
      stop_api(400, "E_BAD_REQUEST", sprintf("El par \"%s\" no se entiende: se escribe pregunta:pregunta.", p),
               list(par = p))
    }
    par
  })
}

.vdc_datos_de_base <- function(sid, base, scope) {
  data <- scope$evaluacion$datos %||% NULL
  if (!is.data.frame(data)) {
    files <- .resolve_base_files(sid, base)
    data <- .read_data_for_validation(files$data$path, files$data_ext)
  }
  if (!is.data.frame(data)) return(NULL)
  data <- as.data.frame(data, check.names = FALSE)
  list(fila_origen = .limpieza_filas_origen(data), data = .limpieza_sin_columnas_internas(data))
}

#' Sugerencias del detector para una base de la sesión
#' @keywords internal
validacion_detector_de_base <- function(sid, base, pares = list()) {
  scope <- .get_base_scope(sid, base)
  # Sin par cargado no hay nada que mirar: la pestaña puede pedir antes de que
  # Carga termine. Se responde vacío con la causa, no se corta.
  causa <- NULL
  d <- tryCatch(.vdc_datos_de_base(sid, base, scope), api_error = function(e) {
    causa <<- list(codigo = e$code, mensaje = conditionMessage(e))
    NULL
  })
  if (is.null(d) || !nrow(d$data)) {
    return(list(estado = "sin_datos", n_total = 0L, sugerencias = list(), avisos = list(
      list(codigo = "sin_datos", texto = "La base todavía no tiene datos cargados.", causa = causa))))
  }
  avisos <- list()
  inst <- tryCatch({
    files <- .resolve_base_files(sid, base)
    leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  }, error = function(e) {
    avisos[[length(avisos) + 1L]] <<- list(
      codigo = "formulario_ilegible",
      texto = "El formulario no se pudo leer: solo se miran las columnas de la base, sin combinaciones entre preguntas.")
    NULL
  })
  roles <- validacion_columnas_contexto(scope, inst, d$data)
  rol_var <- function(r) if (is.list(r)) r$variable else NA_character_
  especiales <- names(validacion_codigos_especiales_declarados(sid, base, inst))
  out <- validacion_detector_consistencia(
    d$data, survey = inst$survey %||% NULL, choices = inst$choices %||% NULL,
    recopilador = rol_var(roles$recopilador), fila_origen = d$fila_origen,
    especiales = especiales, pares = pares,
    excluir = stats::na.omit(c(rol_var(roles$numero_encuesta), rol_var(roles$digitador)))
  )
  out$estado <- "listo"
  out$avisos <- c(avisos, out$avisos)
  out
}

mount_validacion_detector <- function(pr) {
  pr |>
    plumber::pr_get("/api/validacion/v2/detector-consistencia", wrap_endpoint(function(req, res, pares = "") {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      c(list(ok = TRUE, base_nombre = base %||% NA_character_),
        validacion_detector_de_base(sid, base, .vdc_parsear_pares(pares)))
    }))
}
