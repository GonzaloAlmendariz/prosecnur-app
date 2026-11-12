# Un código con cero inicial es un código, no un número.
#
# `utils::read.csv` convierte "080105" en 80105 y "07654321" en 7654321: el
# ubigeo, el DNI o el número de ficha pierden el cero y una regla de rango ya no
# distingue el ubigeo bien escrito del mal digitado (98 falsos positivos medidos
# en una base real, 2026-11-12). Estas dos piezas lo evitan en la carga:
#
# - `.read_csv_data()` lee el CSV como texto y convierte a número solo las
#   columnas en las que ningún valor lleva cero inicial; el resto sale igual que
#   con `read.csv` (los vacíos de una columna numérica son NA, los de una de
#   texto siguen siendo "").
# - `.dn_texto_declarado()` deja como texto lo que el formulario declara `text`
#   aunque la hoja de cálculo lo guardara como número (un teléfono en una celda
#   numérica), sin notación científica.

# "080105", "007", "0123": un cero seguido de más dígitos. "0", "0.5" y "-05"
# no cuentan.
.CARGA_CERO_INICIAL_RX <- "^0[0-9]+$"

#' ¿Algún valor de la columna empieza con cero y sigue con dígitos?
#' @keywords internal
.columna_con_cero_inicial <- function(x) {
  if (!is.character(x)) return(FALSE)
  v <- trimws(x[!is.na(x)])
  any(grepl(.CARGA_CERO_INICIAL_RX, v))
}

#' Lee un CSV de respuestas sin quitarle el cero inicial a los códigos.
#'
#' Acepta los mismos argumentos que `utils::read.csv` (salvo `colClasses` y
#' `stringsAsFactors`, que fija).
#' @keywords internal
.read_csv_data <- function(path, ...) {
  df <- utils::read.csv(path, colClasses = "character", stringsAsFactors = FALSE, ...)
  for (nm in names(df)) {
    x <- df[[nm]]
    if (.columna_con_cero_inicial(x)) next
    convertido <- utils::type.convert(x, as.is = TRUE, na.strings = c("NA", ""))
    if (!is.character(convertido)) df[[nm]] <- convertido
  }
  df
}

#' Número a texto sin notación científica ni ceros decimales de sobra.
#' @keywords internal
.numero_como_texto <- function(x) {
  out <- rep(NA_character_, length(x))
  ok <- !is.na(x)
  entero <- ok & is.finite(x) & x == round(x)
  out[entero] <- sprintf("%.0f", x[entero])
  otros <- ok & !entero
  out[otros] <- format(x[otros], scientific = FALSE, trim = TRUE, digits = 15, drop0trailing = TRUE)
  out
}

#' Las preguntas que el formulario declara `text` llegan como texto.
#'
#' Solo toca columnas numéricas simples: las etiquetadas de un .sav conservan
#' sus etiquetas.
#' @keywords internal
.dn_texto_declarado <- function(data, survey) {
  if (!is.data.frame(data) || is.null(survey) || !nrow(survey)) return(data)
  tipos <- .dn_survey_type_base(survey)
  nombres <- .dn_survey_names(survey)
  for (nm in intersect(nombres[tipos == "text"], names(data))) {
    x <- data[[nm]]
    if (!is.numeric(x) || inherits(x, c("haven_labelled", "labelled"))) next
    etiqueta <- attr(x, "label")
    data[[nm]] <- .numero_como_texto(x)
    if (!is.null(etiqueta)) attr(data[[nm]], "label") <- etiqueta
  }
  data
}
