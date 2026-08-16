# Lectura de la hoja «Base de control».
#
# Tercera de las tres hojas del operativo de aulas. Es el control de calidad por
# aula: cuanto se recogio contra los dos denominadores, cuantas respuestas son
# sospechosamente cortas o largas, si el aula llega al umbral, como va la cuota
# por sexo y si la aplicacion cayo en el rango horario declarado.
#
# Se llena en Excel y la app LEE.
#
# La hoja tiene DOS filas de cabecera: la 1 agrupa (INFORMACION DEL CURSO,
# CONTROL - CUENTA…) y la 2 nombra los campos. Medido sobre el estudio de 2025:
# 194 filas con dato y una cabecera INCOMPLETA — las columnas c30..c36 traen
# valores y no tienen nombre en la fila 2. No se adivinan: se cuentan y se
# reportan, porque un campo bautizado a ojo es peor que un campo ausente.
#
# Anatomia en `docs/qa/anatomia-excels-aulas-2026-08-16.md`.

BASE_CONTROL_CAMPOS <- list(
  # Identidad
  list(campo = "wave",                titulos = c("MUESTRA")),
  list(campo = "operational_code",    titulos = c("CURSO-HORARIO", "CURSO HORARIO")),
  list(campo = "course_name",         titulos = c("NOMBRE DEL CURSO")),
  list(campo = "room",                titulos = c("AULA")),
  list(campo = "schedule",            titulos = c("HORARIO")),
  list(campo = "enrolled_total",      titulos = c("MATRICULADOS TOTALES")),
  list(campo = "eligible_n",          titulos = c("MATRICULADOS POBLACION")),
  # Campo
  list(campo = "scheduled_date",      titulos = c("FECHA AGENDADA")),
  list(campo = "scheduled_time",      titulos = c("HORA")),
  list(campo = "applied_by",          titulos = c("APLICADOR")),
  list(campo = "applied_date",        titulos = c("FECHA DE APLICACION")),
  list(campo = "applied_time",        titulos = c("HORA DE APLICACION")),
  list(campo = "application_status",  titulos = c("STATUS DE APLICACION")),
  # Control - cuenta
  list(campo = "sent_total",          titulos = c("TOTAL ENVIADAS")),
  list(campo = "sent_vs_total",       titulos = c("VS TOTAL")),
  list(campo = "sent_vs_population",  titulos = c("VS POBLACION")),
  list(campo = "validator_1",         titulos = c("VALIDADOR 1")),
  list(campo = "validator_2",         titulos = c("VALIDADOR 2")),
  list(campo = "validator_3",         titulos = c("VALIDADOR 3")),
  list(campo = "short_total",         titulos = c("TOTAL CORTAS")),
  list(campo = "short_vs_total",      titulos = c("CORTAS VS TOTAL")),
  list(campo = "long_total",          titulos = c("TOTAL LARGAS")),
  list(campo = "long_vs_total",       titulos = c("LARGAS VS TOTAL")),
  # Umbrales que el equipo llama 70T y 70P
  list(campo = "threshold_total",     titulos = c("70T")),
  list(campo = "threshold_population", titulos = c("70P")),
  list(campo = "valid_total",         titulos = c("VALIDO TOTAL")),
  list(campo = "valid_population",    titulos = c("VALIDO POBLACION")),
  # Control - duracion
  list(campo = "last_response_day",   titulos = c("ULTIMO DIA DE RESPUESTA")),
  # Control - cuotas
  list(campo = "observed_students",   titulos = c("N ASISTENTES EN AULA")),
  list(campo = "non_respondents",     titulos = c("N ASISTENTES QUE NO RESPONDIERON")),
  list(campo = "attendance_pct",      titulos = c("ASISTENCIA")),
  list(campo = "quota_pct",           titulos = c("CUOTA")),
  list(campo = "quota_missing",       titulos = c("FALTANTES CUOTA")),
  list(campo = "women_n",             titulos = c("N MUJERES")),
  list(campo = "men_n",               titulos = c("N HOMBRES")),
  list(campo = "women_pct",           titulos = c("MUJERES")),
  list(campo = "men_pct",             titulos = c("HOMBRES")),
  # Control - rango horario
  list(campo = "schedule_norm",       titulos = c("NORM - HORARIO")),
  list(campo = "schedule_range",      titulos = c("RANGO - HORARIO"))
)

# Los campos que son numero. El resto se conserva como texto.
.cbc_numericos <- c(
  "enrolled_total", "eligible_n", "sent_total", "sent_vs_total", "sent_vs_population",
  "validator_1", "validator_2", "validator_3", "short_total", "short_vs_total",
  "long_total", "long_vs_total", "threshold_total", "threshold_population",
  "observed_students", "non_respondents", "attendance_pct", "quota_pct",
  "quota_missing", "women_n", "men_n", "women_pct", "men_pct"
)

#' Mapea los campos nombrados de «Base de control».
#'
#' @param titulos fila 2 del libro.
#' @return lista con `mapa` (campo -> columna) y `sin_nombre` (columnas con
#'   datos que la cabecera no bautiza).
#' @export
base_control_mapa <- function(titulos) {
  claves <- .caa_key(titulos)
  mapa <- list()
  usadas <- integer(0)
  for (spec in BASE_CONTROL_CAMPOS) {
    idx <- which(claves %in% .caa_key(spec$titulos) & !(seq_along(claves) %in% usadas))
    if (length(idx)) {
      mapa[[spec$campo]] <- idx[[1]]
      usadas <- c(usadas, idx[[1]])
    }
  }
  # `.caa_key(NA)` devuelve el TEXTO "NA", que pasa `nzchar()`. Sin este filtro
  # el diagnostico decia 0 columnas sin nombre en una hoja que tiene siete.
  vacio <- !nzchar(claves) | claves %in% c("NA", "NULL") | is.na(titulos)
  list(mapa = mapa, sin_nombre = which(vacio))
}

#' Traduce «Base de control» a filas de control por aula.
#'
#' @param df cuerpo de la hoja, sin las dos filas de cabecera.
#' @param titulos fila 2 del libro.
#' @return lista con `filas` y `sin_nombre`.
#' @export
base_control_a_filas <- function(df, titulos) {
  res <- base_control_mapa(titulos)
  mapa <- res$mapa
  if (!is.data.frame(df) || !nrow(df) || is.null(mapa$operational_code)) {
    return(list(filas = list(), sin_nombre = res$sin_nombre))
  }
  filas <- list()
  for (i in seq_len(nrow(df))) {
    code <- .caa_txt(df[i, mapa$operational_code])
    if (!nzchar(code)) next
    fila <- list()
    for (nm in names(mapa)) {
      col <- mapa[[nm]]
      fila[[nm]] <- if (nm %in% .cbc_numericos) .caa_num(df[i, col]) else .caa_txt(df[i, col])
    }
    fila$classroom_id <- code
    filas[[length(filas) + 1L]] <- fila
  }
  list(filas = filas, sin_nombre = res$sin_nombre)
}

#' Lee la hoja «Base de control» de un libro.
#'
#' @param path ruta al `.xlsx`.
#' @param hoja nombre de la hoja.
#' @return lista con `filas` y `sin_nombre`.
#' @export
base_control_leer <- function(path, hoja = "Base de control") {
  if (!file.exists(path)) {
    stop_api(400, "E_BASE_CONTROL_NO_EXISTE", "No se encontro el libro de base de control.")
  }
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!hoja %in% hojas) {
    stop_api(
      422, "E_BASE_CONTROL_SIN_HOJA",
      sprintf("El libro no tiene una hoja '%s'.", hoja),
      details = list(hojas = as.list(hojas))
    )
  }
  crudo <- readxl::read_excel(path, sheet = hoja, col_names = FALSE, .name_repair = "minimal")
  if (nrow(crudo) < 3L) return(list(filas = list(), sin_nombre = integer(0)))
  titulos <- as.character(unlist(crudo[2, ], use.names = FALSE))
  cuerpo <- crudo[-c(1, 2), , drop = FALSE]
  base_control_a_filas(as.data.frame(cuerpo, stringsAsFactors = FALSE), titulos)
}
