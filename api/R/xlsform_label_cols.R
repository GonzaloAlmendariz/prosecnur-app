# Resolución defensiva de columnas de etiqueta localizadas en XLSForms.
#
# Muchos instrumentos reales (multilingües, importados de SurveyMonkey/Kobo) no
# traen una columna `label` plana sino columnas localizadas `label::es`,
# `label::spanish (es)`, `hint::es`, etc. Este helper compartido resuelve la
# etiqueta efectiva por fila, prefiriendo español, para que los motores que
# consumen el XLSForm (PDF del cuestionario, instrumento, etc.) no queden con el
# texto vacío. Regla de la casa: no redefinir el micro-helper por módulo.

# Codigo de idioma de un `default_language` o del sufijo de una columna
# (`Español (es)`, `spanish`, `es`, `label::English (EN)`, `label_es`). "" si no
# se reconoce.
.XLSFORM_IDIOMAS <- c(
  "espa\u00f1ol" = "es", espanol = "es", spanish = "es", castellano = "es",
  english = "en", ingles = "en", "ingl\u00e9s" = "en",
  "fran\u00e7ais" = "fr", francais = "fr", french = "fr",
  portugues = "pt", "portugu\u00eas" = "pt", portuguese = "pt", portugese = "pt",
  arabic = "ar", "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" = "ar",
  russian = "ru", quechua = "qu", aymara = "ay"
)
.xlsform_idioma_codigo <- function(x) {
  x <- tolower(trimws(as.character(x %||% "")[1]))
  if (is.na(x) || !nzchar(x)) return("")
  m <- regmatches(x, regexec("\\(([a-z]{2,3})\\)", x))[[1]]
  if (length(m) >= 2L) return(m[2])
  if (grepl("^[a-z]{2,3}$", x)) return(x)
  base <- trimws(sub("\\(.*$", "", x))
  hit <- .XLSFORM_IDIOMAS[names(.XLSFORM_IDIOMAS) == base]
  if (length(hit)) return(unname(hit[1]))
  ""
}

# Columnas de `kind` agrupadas por su relacion con el idioma por defecto
# (item 43, tercera tanda): `defecto` (las de ese idioma), `plana` (`label`
# sin idioma) y `otras` (cualquier otro idioma).
.xlsform_label_col_grupos <- function(nms, lang = "es", kind = "label") {
  nms <- as.character(nms %||% character(0))
  kind <- tolower(kind)
  code <- .xlsform_idioma_codigo(if (nzchar(trimws(lang %||% ""))) lang else "es")
  if (!nzchar(code)) code <- "es"
  plana <- nms[tolower(nms) == kind]
  loc <- nms[grepl(sprintf("^%s(::|_)", kind), nms, ignore.case = TRUE) & tolower(nms) != kind]
  suf <- sub(sprintf("^%s(::|_)", kind), "", loc, ignore.case = TRUE)
  codigos <- vapply(suf, .xlsform_idioma_codigo, character(1))
  defecto <- loc[codigos == code | tolower(suf) == tolower(trimws(lang %||% ""))]
  list(defecto = defecto, plana = plana, otras = setdiff(loc, defecto), code = code)
}

# Idiomas que se escriben con alfabeto latino (el del instrumento en papel).
.XLSFORM_LATINOS <- c("es", "en", "fr", "pt", "it", "de", "qu", "ay", "ca", "gn")

# TRUE por celda si el texto esta en la escritura del idioma `code`: para un
# idioma latino, que sus letras sean latinas. Para los demas no se juzga.
.xlsform_misma_escritura <- function(v, code) {
  if (!code %in% .XLSFORM_LATINOS) return(rep(TRUE, length(v)))
  letras <- gsub("[^[:alpha:]]", "", v)
  ajenas <- gsub("[A-Za-z\u00c0-\u024f\u1e00-\u1eff]", "", letras, perl = TRUE)
  !nzchar(letras) | nchar(ajenas) == 0L
}

# Devuelve un vector de longitud nrow(df) con la etiqueta resuelta por fila.
# Orden (item 43, tercera tanda — RMS imprimia una ayuda en arabe en un
# instrumento cuyo idioma por defecto es espanol):
#   1. el idioma por defecto (`default_language`; "es" si el archivo no lo dice);
#   2. la columna plana `label`/`hint`, sin idioma;
#   3. otro idioma, SOLO como ultimo recurso y declarado: el atributo
#      "otro_idioma" lista las celdas (fila, columna) que se tomaron asi, para
#      que el llamador lo avise.
xlsform_coalesce_label <- function(df, lang = "es", kind = c("label", "hint")) {
  kind <- match.arg(kind)
  if (is.null(df) || !nrow(df)) return(character(0))
  n <- nrow(df)
  g <- .xlsform_label_col_grupos(names(df), lang, kind)
  out <- rep("", n)
  prestadas <- data.frame(fila = integer(0), columna = character(0), stringsAsFactors = FALSE)
  omitidas <- prestadas
  for (col in c(g$defecto, g$plana, g$otras)) {
    v <- as.character(df[[col]])
    v[is.na(v)] <- ""
    v <- trimws(v)
    take <- !nzchar(out) & nzchar(v)
    if (col %in% g$otras && any(take)) {
      # Otra ESCRITURA no se toma nunca: un aplicador que lee espanol no puede
      # leer una ayuda en arabe. Se deja vacia y se declara aparte.
      ajena <- take & !.xlsform_misma_escritura(v, g$code)
      if (any(ajena)) {
        omitidas <- rbind(omitidas, data.frame(fila = which(ajena), columna = col,
                                               stringsAsFactors = FALSE))
        take <- take & !ajena
      }
    }
    if (any(take)) {
      out[take] <- v[take]
      if (col %in% g$otras) {
        prestadas <- rbind(prestadas, data.frame(fila = which(take), columna = col,
                                                 stringsAsFactors = FALSE))
      }
    }
    if (all(nzchar(out))) break
  }
  attr(out, "otro_idioma") <- prestadas
  # Celdas que solo existen en otra escritura: quedan vacias (ver arriba).
  omitidas <- omitidas[!omitidas$fila %in% which(nzchar(out)), , drop = FALSE]
  attr(out, "otra_escritura") <- omitidas[!duplicated(omitidas$fila), , drop = FALSE]
  out
}

# Elige la columna de etiqueta preferida (nombre), o NA si no hay ninguna con
# contenido. Útil cuando se necesita el nombre de la columna, no los valores.
xlsform_pick_label_col <- function(df, lang = "es", kind = c("label", "hint")) {
  kind <- match.arg(kind)
  if (is.null(df) || !ncol(df)) return(NA_character_)
  g <- .xlsform_label_col_grupos(names(df), lang, kind)
  cols <- c(g$defecto, g$plana, g$otras)
  for (col in cols) {
    v <- as.character(df[[col]])
    v[is.na(v)] <- ""
    if (any(nzchar(trimws(v)))) return(col)
  }
  if (length(cols)) cols[1L] else NA_character_
}
