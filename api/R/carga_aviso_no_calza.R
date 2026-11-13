# Aviso de una base que no calza con el formulario (E_DATA_XLSFORM_INCOMPATIBLE).
#
# Ítem 25 del checklist de validación del practicante: el aviso decía "faltan
# 187 de 187 variable(s) esperada(s)" y nada más. Ahora dice qué columnas trae
# la base, qué columnas espera el formulario (unos ejemplos de cada lado) y qué
# hacer: renombrar los encabezados con los nombres del formulario cuando la
# base trae el texto de las preguntas como encabezado, o dejar primero la hoja
# de las respuestas, o cambiar de formulario.
#
# Una sola función arma el aviso; la usan la carga de un archivo
# (`.carga_exigir_base_que_calza`, carga_sin_rastro.R) y el chequeo estricto de
# las demás cargas (`.carga_assert_data_xlsform_compatible`, router_carga.R).
# Base de las cifras: preguntas del formulario que deben venir como columna
# (`.dn_expected_data_names`) y columnas de la base leída.

.CARGA_NO_CALZA_EJEMPLOS <- 3L
.CARGA_NO_CALZA_LISTA_ENTERA <- 10L

.carga_no_calza_citar <- function(x) {
  x <- as.character(x)
  if (!length(x)) return("")
  citas <- paste0("\"", x, "\"")
  if (length(citas) == 1L) return(citas)
  paste0(paste(citas[-length(citas)], collapse = ", "), " y ", citas[length(citas)])
}

# Cuántos encabezados de la base coinciden con el texto de una pregunta del
# formulario: la señal de que la base trae los rótulos y no los nombres. La
# cifra es la misma que propone el emparejamiento por texto
# (carga_emparejar_por_texto.R), sobre los mismos encabezados.
.carga_no_calza_por_texto <- function(columnas, instrumento) {
  if (!length(columnas) || is.null(instrumento)) return(0L)
  carga_emparejar_por_texto(columnas, instrumento)$resumen$n_propuestas
}

#' Aviso de una base que no calza con el formulario
#'
#' @param compat salida de `validate_data_xlsform_compatibility()` (o su payload).
#' @param instrumento instrumento del formulario, para los textos de las preguntas.
#' @param columnas_base encabezados de la base leída; sin ellos, se cuentan las
#'   preguntas presentes más las columnas que no son del formulario.
#' @param hojas hojas del libro leído; la primera es la que se leyó.
#' @return lista con `message` y `details`.
#' @keywords internal
.carga_aviso_no_calza <- function(compat, instrumento = NULL, columnas_base = NULL, hojas = character(0)) {
  esperadas <- as.integer(compat$expected_columns %||% 0L)
  faltantes <- as.character(unlist(compat$missing_columns %||% character(0)))
  faltan <- length(faltantes)
  extra <- as.character(unlist(compat$extra_columns %||% character(0)))
  presentes <- esperadas - faltan
  n_columnas_base <- if (is.null(columnas_base)) presentes + length(extra) else length(columnas_base)

  partes <- sprintf("Las respuestas no calzan con el formulario: de %d %s, %d no %s como %s de la base",
                    esperadas, if (esperadas == 1L) "pregunta" else "preguntas",
                    faltan, if (faltan == 1L) "aparece" else "aparecen",
                    if (faltan == 1L) "columna" else "columnas")
  if (faltan <= .CARGA_NO_CALZA_LISTA_ENTERA) {
    partes <- paste0(partes, sprintf(" (%s).", .carga_no_calza_citar(faltantes)))
  } else {
    partes <- paste0(partes, sprintf(". El formulario espera columnas con los nombres de sus preguntas, como %s.",
                                     .carga_no_calza_citar(utils::head(faltantes, .CARGA_NO_CALZA_EJEMPLOS))))
  }
  ejemplos_base <- utils::head(extra, .CARGA_NO_CALZA_EJEMPLOS)
  if (length(ejemplos_base)) {
    partes <- paste0(partes, sprintf(" La base trae %d %s, %s%s.",
                                     n_columnas_base, if (n_columnas_base == 1L) "columna" else "columnas",
                                     if (presentes > 0L) "entre ellas " else "como ",
                                     .carga_no_calza_citar(ejemplos_base)))
  } else if (n_columnas_base > 0L) {
    partes <- paste0(partes, sprintf(" La base trae %d %s, %s del formulario.", n_columnas_base,
                                     if (n_columnas_base == 1L) "columna" else "columnas",
                                     if (n_columnas_base == 1L) "es" else "todas"))
  }
  if (length(hojas) > 1L) {
    partes <- paste0(partes, sprintf(" Se leyó la hoja \"%s\", la primera del libro; el libro trae también %s.",
                                     hojas[[1]], paste0("\"", hojas[-1], "\"", collapse = ", ")))
  }

  columnas_texto <- if (is.null(columnas_base)) extra else columnas_base
  n_por_rotulo <- .carga_no_calza_por_texto(columnas_texto, instrumento)
  hacer <- if (n_por_rotulo > 0L && n_por_rotulo >= 0.5 * faltan) {
    sprintf(paste(" %d de %d %s de la base %s con el texto de una pregunta del formulario: empareja la base",
                  "por el texto de las preguntas o renombra sus encabezados con los nombres del formulario",
                  "(columna name)."),
            n_por_rotulo, length(columnas_texto),
            if (length(columnas_texto) == 1L) "encabezado" else "encabezados",
            if (n_por_rotulo == 1L) "coincide" else "coinciden")
  } else if (length(hojas) > 1L) {
    paste(" Deja primero en el libro la hoja de las respuestas; si ya lo es, el formulario no es de esta base.")
  } else {
    paste(" Si es la base de este formulario, renombra los encabezados de la base con los nombres del",
          "formulario (columna name); si no, el formulario no es de esta base.")
  }
  list(
    message = paste0(partes, hacer),
    details = list(
      n_esperadas = esperadas,
      n_faltan = faltan,
      n_columnas_base = as.integer(n_columnas_base),
      n_por_rotulo = n_por_rotulo,
      ejemplos_formulario = as.list(utils::head(faltantes, .CARGA_NO_CALZA_EJEMPLOS)),
      ejemplos_base = as.list(ejemplos_base),
      hoja_leida = if (length(hojas)) hojas[[1]] else NULL
    )
  )
}
