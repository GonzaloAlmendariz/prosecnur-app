# =============================================================================
# Columnas de opción de una pregunta de opción múltiple: cómo se leen
# =============================================================================
#
# Una pregunta de opción múltiple llega a la base como una columna por opción
# (`p10/1`, `p10/2`, `p10_77`...). Dos formas de marcar son legítimas:
#
#   - binaria: 0/1 (o sí/no, true/false), la de Kobo y SurveyMonkey;
#   - por código: la columna vale el CÓDIGO de su opción cuando se marcó y queda
#     vacía (o en 0) cuando no; así digita una base hecha a mano en Excel o SPSS.
#
# Antes solo se aceptaba la binaria: en una base por código la única columna que
# pasaba era la de la opción 1 (que vale 1), y la madre se reconstruía solo con
# ella. Ítem 20 del checklist de Validación (2026-11-12).
#
# Una columna de opción que no tiene ninguna de las dos formas (mezcla 1 y 3,
# trae un código que no es el suyo) no se puede leer: no entra a la madre, se
# conserva en la base y se AVISA con su causa en `opciones_sin_leer`. Lo mismo
# una columna por código cuya opción no está en la lista: no se asigna a otra
# opción por posición.
#
# El cruce columna -> opción sigue siendo el de `.dn_match_sm_dummy_columns`
# (mapa confirmado, etiqueta, código); aquí solo vive la forma de la columna.

# Código de la opción según el nombre de la columna (`p10/03` -> "3"), sin
# distinguir mayúsculas en el nombre de la pregunta (H67).
.dn_sm_option_code_of <- function(col, parent) {
  col <- as.character(col %||% "")[1]
  parent <- as.character(parent %||% "")[1]
  if (is.na(col) || is.na(parent) || !nzchar(col) || !nzchar(parent)) return(NA_character_)
  pat <- paste0("(?i)^", .dn_escape_regex(parent), "([_/.])(.+)$")
  if (!grepl(pat, col, perl = TRUE)) return(NA_character_)
  suffix <- sub(pat, "\\2", col, perl = TRUE)
  suffix <- sub("^0+([0-9]+)$", "\\1", suffix)
  if (!nzchar(suffix)) "0" else suffix
}

# Valores distintos con dato de una columna, como texto recortado.
.dn_sm_option_values <- function(x) {
  x_chr <- trimws(as.character(x))
  unique(x_chr[!is.na(x_chr) & nzchar(x_chr)])
}

# ¿Cada valor es el código `code`? Acepta el código sin ceros a la izquierda
# (`077` = `77`) y el prefijo de transporte `C` de SPSS (`C3` = `3`).
.dn_sm_value_is_code <- function(values, code) {
  if (!length(values)) return(logical(0))
  vapply(values, function(v) .dn_choice_codes_equivalent(code, v), logical(1), USE.NAMES = FALSE)
}

# Forma de la columna de la opción `code`: "binaria", "codigo" o "ilegible".
# La binaria manda (es la forma histórica y la de las plataformas). El código
# "0" no admite la forma por código: 0 es justamente "no marcada".
.dn_sm_option_shape <- function(x, code) {
  if (.dn_is_binary_dummy_col(x)) return("binaria")
  code <- as.character(code %||% NA_character_)[1]
  if (is.na(code) || !nzchar(code) || identical(code, "0")) return("ilegible")
  values <- .dn_sm_option_values(x)
  ok <- values == "0" | .dn_sm_value_is_code(values, code)
  if (all(ok)) "codigo" else "ilegible"
}

# Filas en que la opción está marcada. En la forma por código, marcada es valer
# el código; en las demás rige `.dn_is_selected_dummy` (0/1 y etiquetas SPSS).
.dn_sm_option_selected <- function(x, code) {
  if (!identical(.dn_sm_option_shape(x, code), "codigo")) return(.dn_is_selected_dummy(x))
  v <- trimws(as.character(x))
  out <- rep(FALSE, length(v))
  hit <- !is.na(v) & nzchar(v) & v != "0"
  if (any(hit)) {
    distintos <- unique(v[hit])
    es_codigo <- .dn_sm_value_is_code(distintos, code)
    out[hit] <- es_codigo[match(v[hit], distintos)]
  }
  out
}

# ¿Vale la pena avisar de una columna que no se pudo leer? Sí si su nombre
# apunta a una opción de la lista o si sus valores son números (forma de marca).
# Un texto libre con otro sufijo (`p10_otro` con "salud") no es columna de
# opción: se conserva en la base sin aviso, como cualquier columna extra.
.dn_sm_option_merece_aviso <- function(x, code, choice_codes) {
  code <- as.character(code %||% NA_character_)[1]
  if (!is.na(code) && any(.dn_sm_value_is_code(as.character(choice_codes), code))) return(TRUE)
  values <- .dn_sm_option_values(x)
  length(values) > 0L && all(grepl("^-?[0-9]+([.][0-9]+)?$", values))
}

# Hasta cinco valores distintos, ordenados como números cuando lo son.
.dn_sm_option_muestra_valores <- function(x, max_n = 5L) {
  values <- .dn_sm_option_values(x)
  num <- suppressWarnings(as.numeric(values))
  values <- values[order(is.na(num), num, values)]
  utils::head(values, max_n)
}

# Aviso de una columna de opción que no entra a la pregunta.
#   motivo "valores": sus valores no son 0/1 ni el código de su opción.
#   motivo "fuera_de_lista": marca un código que no es opción de la lista.
.dn_sm_option_aviso <- function(parent, col, code, x, motivo) {
  valores <- .dn_sm_option_muestra_valores(x)
  n_con_dato <- sum(!is.na(x) & nzchar(trimws(as.character(x))))
  code <- as.character(code %||% "")[1]
  if (is.na(code)) code <- ""
  causa <- if (identical(motivo, "fuera_de_lista")) {
    sprintf(
      "Marca el código %s, que no es una opción de la lista de %s.",
      code, parent
    )
  } else {
    lista <- paste(valores, collapse = ", ")
    if (length(.dn_sm_option_values(x)) > length(valores)) lista <- paste0(lista, " y otros")
    if (nzchar(code) && !identical(code, "0")) {
      sprintf(
        "Trae los valores %s. Para leerla como opción debe valer 0 o 1, o el código de la opción (%s) con vacío cuando no se marcó.",
        lista, code
      )
    } else {
      sprintf("Trae los valores %s. Para leerla como opción debe valer 0 o 1.", lista)
    }
  }
  list(
    variable = as.character(parent),
    columna = as.character(col),
    codigo = code,
    motivo = motivo,
    valores = as.character(valores),
    n_con_dato = as.integer(n_con_dato),
    causa = causa
  )
}
