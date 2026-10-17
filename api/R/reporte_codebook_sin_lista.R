# Libro de códigos: variables SIN lista de respuestas.
#
# El libro sólo documentaba variables con etiquetas de valor, así que una edad,
# un índice o una variable calculada por fórmula no aparecían (HSyVbG 2026: P1,
# indice_vbg, indice_hs, anios_desde_ingreso). Gonzalo, 2026-10-16: «Sí,
# inclúyelas en el libro de códigos».
#
# Entran las preguntas del instrumento de tipo numérico, texto o calculado que
# están en la base, con su etiqueta y una línea de contenido: «Numérica · de 18
# a 67 · 3,318 con dato» o «Texto abierto · 41 con dato». Los metadatos de
# captura (uuid, fechas de sistema, notas) no entran: no son preguntas.

.CODEBOOK_TIPOS_SIN_LISTA <- c("integer", "decimal", "range", "text", "calculate")

# Nombres de las preguntas del instrumento que se documentan sin lista.
.codebook_vars_sin_lista <- function(df) {
  inst <- attr(df, "instrumento_reporte", exact = TRUE)
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !all(c("type", "name") %in% names(sv))) return(character(0))
  tipo <- sub("\\s.*$", "", trimws(tolower(as.character(sv$type))))
  nombres <- as.character(sv$name)[tipo %in% .CODEBOOK_TIPOS_SIN_LISTA]
  nombres[!is.na(nombres) & nzchar(nombres) & nombres %in% names(df)]
}

.codebook_formato_n <- function(x) {
  format(x, big.mark = ",", decimal.mark = ".", scientific = FALSE, trim = TRUE)
}

#' Línea de contenido de una variable sin lista, o NULL si no se documenta.
#'
#' Numérica si todos sus valores con dato son números (una edad tecleada como
#' texto también lo es); si no, texto abierto.
#' @keywords internal
codebook_descripcion_sin_lista <- function(x) {
  v <- if (is.factor(x)) as.character(x) else x
  v <- unclass(v)
  chr <- trimws(as.character(v))
  con_dato <- !is.na(chr) & nzchar(chr)
  n <- sum(con_dato)
  if (n == 0L) return("Sin respuestas en la base")
  num <- suppressWarnings(as.numeric(chr[con_dato]))
  if (!anyNA(num)) {
    # Los valores van sin separador de miles: un año es «2017», no «2,017».
    redondo <- function(z) if (z == round(z)) format(round(z), scientific = FALSE, trim = TRUE) else format(round(z, 2), scientific = FALSE, trim = TRUE)
    rango <- if (min(num) == max(num)) redondo(min(num)) else paste("de", redondo(min(num)), "a", redondo(max(num)))
    return(sprintf("Numérica · %s · %s con dato", rango, .codebook_formato_n(n)))
  }
  sprintf("Texto abierto · %s con dato", .codebook_formato_n(n))
}

#' La data del libro con las preguntas sin lista devueltas.
#'
#' `.analitica_filter_data()` deja sólo categóricas y numéricas declaradas (es
#' el filtro de Frecuencias): el libro nunca recibía la edad ni los índices. Aquí
#' se reponen las preguntas sin lista del instrumento que no estén excluidas,
#' en el orden de la base y con los atributos de la data filtrada.
#' @keywords internal
.codebook_con_sin_lista <- function(data_full, data_out, excluidas = character(0)) {
  faltan <- setdiff(.codebook_vars_sin_lista(data_full), names(data_out))
  if (length(faltan) && exists(".analitica_excluded_data_cols", mode = "function")) {
    faltan <- faltan[!.analitica_excluded_data_cols(faltan, excluidas)]
  }
  if (!length(faltan)) return(data_out)
  cols <- names(data_full)[names(data_full) %in% c(names(data_out), faltan)]
  out <- data_full[, cols, drop = FALSE]
  for (nm in setdiff(names(attributes(data_out)), c("names", "row.names", "class"))) {
    attr(out, nm) <- attr(data_out, nm)
  }
  out
}
