# =============================================================================
# Validación (M4): contexto de los casos de un hallazgo
# =============================================================================
# Lo que Hallazgos muestra al lado de cada caso, leído de la tabla de la
# última auditoría y solo de columnas que el estudio o el formulario declaran
# (nunca se adivina una columna por su nombre):
#
#   fecha_respuesta  la variable del periodo de campo
#                    (`operational_config$field_period$variable`).
#   recopilador      la variable del agente que recolecta
#                    (`operational_config$identity$agent_variable`).
#   numero_encuesta  el número de encuesta o de ficha
#                    (`operational_config$identity$survey_number_variable`).
#   digitador        quién digitó la ficha
#                    (`operational_config$identity$typist_variable`).
#   fecha_envio      la pregunta de tipo `end` del formulario y, si no hay, la
#                    columna `_submission_time` del servidor (export de la
#                    plataforma); `fuente` dice cuál.
#   duracion_min     minutos entre las preguntas `start` y `end` del
#                    formulario; null si falta una o no se leen como fecha y
#                    hora, o si sale negativa.
#   n_preguntas      preguntas que el encuestado responde (sin cálculos,
#                    metadatos, notas ni grupos) con columna en la tabla.
#   n_respondidas    de ellas, las que tienen valor.
#
# Sin el rol declarado, el campo va null y `contexto.<campo>` también: la
# pantalla no muestra la columna.

.VCC_METADATOS <- c("start", "end", "today", "deviceid", "phonenumber", "phone_number", "username",
                    "email", "simserial", "subscriberid", "audit", "start-geopoint",
                    "background-audio", "imei", "uri:deviceid", "uri:email", "uri:username")
.VCC_CALCULADAS <- c("calculate", "hidden")
.VCC_SIN_VALOR <- c("begin_group", "end_group", "begin_repeat", "end_repeat", "note")

#' Origen de una pregunta del formulario
#'
#' @param tipo tipo base de la pregunta (`type_base`).
#' @return "respuesta", "calculada" o "metadato".
#' @keywords internal
validacion_origen_pregunta <- function(tipo) {
  t <- tolower(trimws(as.character(tipo %||% "")))
  ifelse(t %in% .VCC_METADATOS, "metadato", ifelse(t %in% .VCC_CALCULADAS, "calculada", "respuesta"))
}

.vcc_survey <- function(inst) {
  sv <- if (is.list(inst)) inst$survey else NULL
  if (!is.data.frame(sv) || !nrow(sv) || !"name" %in% names(sv)) return(NULL)
  sv$.tipo <- tolower(as.character(sv$type_base %||% vapply(as.character(sv$type), .type_base, character(1))))
  sv
}

# Primera pregunta del formulario de un tipo con columna en la tabla.
.vcc_pregunta_de_tipo <- function(sv, tipo, df) {
  if (is.null(sv)) return(NA_character_)
  v <- as.character(sv$name[sv$.tipo == tipo])
  v <- v[!is.na(v) & v %in% names(df)]
  if (length(v)) v[1] else NA_character_
}

.vcc_rol <- function(variable, fuente, etiquetas) {
  if (is.na(variable) || !nzchar(variable)) return(NA)
  et <- as.character(etiquetas[[variable]] %||% NA_character_)[1]
  list(variable = variable, etiqueta = if (is.na(et) || identical(et, variable)) NA_character_ else et,
       fuente = fuente)
}

#' Columnas de contexto de una tabla de la auditoría
#'
#' @param scope scope de la base.
#' @param inst instrumento (o NULL).
#' @param df tabla de la auditoría donde viven los casos.
#' @return lista `fecha_respuesta`, `recopilador`, `numero_encuesta`,
#'   `digitador`, `fecha_envio`, `inicio`, `fin`: cada una `{variable, etiqueta, fuente}` o NA si no se declara.
#' @keywords internal
validacion_columnas_contexto <- function(scope, inst, df) {
  cfg <- tryCatch(normalize_validation_operational_config(scope$operational_config), error = function(e) NULL)
  sv <- .vcc_survey(inst)
  etiquetas <- if (!is.null(sv)) as.list(.survey_label_map(sv)) else list()
  en_df <- function(v) { v <- as.character(v %||% "")[1]; if (!is.na(v) && nzchar(v) && v %in% names(df)) v else NA_character_ }
  fin <- .vcc_pregunta_de_tipo(sv, "end", df)
  envio <- if (!is.na(fin)) .vcc_rol(fin, "formulario", etiquetas)
           else .vcc_rol(en_df("_submission_time"), "servidor", etiquetas)
  list(
    fecha_respuesta = .vcc_rol(en_df((cfg$field_period %||% list())$variable), "periodo_de_campo", etiquetas),
    recopilador = .vcc_rol(en_df((cfg$identity %||% list())$agent_variable), "agente_declarado", etiquetas),
    numero_encuesta = .vcc_rol(en_df((cfg$identity %||% list())$survey_number_variable), "rol_declarado", etiquetas),
    digitador = .vcc_rol(en_df((cfg$identity %||% list())$typist_variable), "rol_declarado", etiquetas),
    fecha_envio = envio,
    inicio = .vcc_rol(.vcc_pregunta_de_tipo(sv, "start", df), "formulario", etiquetas),
    fin = .vcc_rol(fin, "formulario", etiquetas)
  )
}

# Fecha y hora de una columna (texto ISO de la plataforma, con o sin zona, o
# POSIXct/Date de R). NA lo que no se lee.
.vcc_fecha_hora <- function(x) {
  if (inherits(x, "POSIXct")) return(as.POSIXct(x, tz = "UTC"))
  if (inherits(x, "Date")) return(as.POSIXct(x, tz = "UTC"))
  v <- trimws(as.character(x))
  v[!nzchar(v)] <- NA_character_
  v <- sub("(\\.[0-9]+)", "", v, perl = TRUE)
  v <- sub("Z$", "+0000", v, perl = TRUE)
  v <- sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", v, perl = TRUE)
  out <- suppressWarnings(as.POSIXct(v, format = "%Y-%m-%dT%H:%M:%S%z", tz = "UTC"))
  sin <- is.na(out) & !is.na(v)
  if (any(sin)) out[sin] <- suppressWarnings(as.POSIXct(v[sin], format = "%Y-%m-%dT%H:%M:%S", tz = "UTC"))
  sin <- is.na(out) & !is.na(v)
  if (any(sin)) out[sin] <- suppressWarnings(as.POSIXct(v[sin], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
  out
}

.vcc_texto <- function(x) {
  if (inherits(x, c("POSIXct", "Date"))) return(format(x))
  v <- trimws(as.character(x))
  v[!is.na(v) & !nzchar(v)] <- NA_character_
  v
}

# Preguntas de respuesta del formulario con columna en la tabla.
.vcc_preguntas_respuesta <- function(sv, df) {
  if (is.null(sv)) return(character(0))
  v <- as.character(sv$name)
  ok <- !is.na(v) & nzchar(v) & v %in% names(df) & !(sv$.tipo %in% .VCC_SIN_VALOR) &
    validacion_origen_pregunta(sv$.tipo) == "respuesta"
  unique(v[ok])
}

#' Contexto por fila de los casos de un hallazgo
#'
#' @param df tabla de la auditoría.
#' @param filas índices de los casos en `df` (NA si no se ubicó).
#' @param columnas `validacion_columnas_contexto()`.
#' @param inst instrumento (para contar preguntas).
#' @return lista del mismo largo que `filas`: `{fecha_respuesta, recopilador,
#'   fecha_envio, duracion_min, n_respondidas, n_preguntas}` (null donde no hay
#'   dato), o NA si la fila no se ubicó.
#' @keywords internal
validacion_contexto_por_fila <- function(df, filas, columnas, inst = NULL) {
  if (!length(filas)) return(list())
  col <- function(rol) if (is.list(rol)) rol$variable else NA_character_
  leer <- function(rol, i) {
    v <- col(rol)
    if (is.na(v) || is.na(i)) return(NA_character_)
    .vcc_texto(df[[v]][i])
  }
  ini <- col(columnas$inicio); fin <- col(columnas$fin)
  dur <- if (!is.na(ini) && !is.na(fin)) {
    as.numeric(difftime(.vcc_fecha_hora(df[[fin]]), .vcc_fecha_hora(df[[ini]]), units = "mins"))
  } else rep(NA_real_, nrow(df))
  preg <- .vcc_preguntas_respuesta(.vcc_survey(inst), df)
  lapply(filas, function(i) {
    if (is.na(i)) return(NA)
    d <- dur[i]
    n_resp <- if (length(preg)) sum(vapply(preg, function(v) !is.na(.vcc_texto(df[[v]][i])), logical(1))) else NA_integer_
    list(
      fecha_respuesta = leer(columnas$fecha_respuesta, i),
      recopilador = leer(columnas$recopilador, i),
      numero_encuesta = leer(columnas$numero_encuesta, i),
      digitador = leer(columnas$digitador, i),
      fecha_envio = leer(columnas$fecha_envio, i),
      duracion_min = if (is.na(d) || d < 0) NA_real_ else round(d, 1),
      n_respondidas = if (length(preg)) as.integer(n_resp) else NA_integer_,
      n_preguntas = if (length(preg)) length(preg) else NA_integer_
    )
  })
}

#' Códigos especiales declarados por el estudio
#'
#' Los que el estudio marcó en el libro de códigos de Analítica
#' (`codebook$codigos_solo_si_presentes`, sin la lista heredada 96 a 99 que
#' todo proyecto traía sin elegirla). Su rótulo sale de las opciones del
#' formulario donde aparece (el más frecuente).
#'
#' La config que se lee es la de la base pedida (`.analitica_cfg_para_base()`,
#' ADR 0061): nunca la de otra base hermana.
#'
#' @param sid sesión.
#' @param base base leída (NULL: la config sin base).
#' @param inst instrumento de la base (para el rótulo), o NULL.
#' @return vector nombrado código a rótulo ("" si no tiene); vacío si el estudio
#'   no declaró ninguno. Atributo `aviso` si los rótulos no se pudieron leer.
#' @keywords internal
validacion_codigos_especiales_declarados <- function(sid, base = NULL, inst = NULL) {
  b <- as.character(base %||% NA_character_)[1]
  cfg <- if (!is.na(b) && nzchar(b)) .analitica_cfg_para_base(sid, b) else .analitica_config_get(sid)
  cfg <- cfg %||% list()
  cods <- analitica_codigos_especiales_efectivos(.as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes))
  cods <- unique(cods[!is.na(cods)])
  if (!length(cods)) return(stats::setNames(character(0), character(0)))
  # Si las listas del formulario no se leen, los códigos siguen marcándose
  # (vienen de la config) y el aviso dice que salen sin rótulo.
  aviso <- NULL
  sug <- tryCatch(analitica_codigos_especiales(list(inst)), error = function(e) {
    aviso <<- list(codigo = "rotulos_especiales_ilegibles",
                   texto = "Los rótulos de los códigos especiales no se pudieron leer del formulario: salen por su código.")
    list()
  })
  rot <- stats::setNames(vapply(sug, function(x) as.character(x$etiqueta %||% ""), character(1)),
                         vapply(sug, function(x) as.character(x$codigo %||% ""), character(1)))
  out <- unname(rot[as.character(cods)])
  out[is.na(out)] <- ""
  out <- stats::setNames(as.character(out), as.character(cods))
  attr(out, "aviso") <- aviso
  out
}
