# Motor del formulario en papel — normalizacion de la entrada del modelo.
#
# Lo que el modelo necesita ver igual venga de donde venga el XLSForm. Corre al
# principio de `formulario_pdf_build_model`, antes de interpretar formato: las
# palabras, los codigos y el orden NO cambian aqui; solo la forma.
#
# Item 38 (tercera tanda, checklist-exportacion-formulario-2026-10-15): los
# XLSForm que escribe la propia app (`reporte_instrumento`, adaptados,
# `xlsform_referencia`) separan el tipo base (`select_one`) de la lista, que va
# en una columna `list_name` de la hoja survey. `.form_pdf_type_list` solo leia
# la lista del `type`, asi que esas preguntas salian SIN opciones ni celda de
# respuesta (154 preguntas en 4 instrumentos del corpus). Se pega la lista al
# tipo cuando el tipo no la trae, igual que `carga_sm_orden_editor.R`.

.FORM_LECTURA_TIPOS_CON_LISTA <- c("select_one", "select_multiple", "rank")

.form_pdf_tipo_con_lista <- function(survey) {
  if (is.null(survey) || !nrow(survey)) return(survey)
  col <- names(survey)[tolower(names(survey)) == "list_name"]
  if (!length(col)) return(survey)
  tipo <- trimws(as.character(survey$type))
  tipo[is.na(tipo)] <- ""
  ln <- trimws(as.character(survey[[col[1]]]))
  ln[is.na(ln)] <- ""
  pegar <- tolower(tipo) %in% .FORM_LECTURA_TIPOS_CON_LISTA & nzchar(ln)
  if (any(pegar)) survey$type[pegar] <- paste(tipo[pegar], ln[pegar])
  survey
}

# Item 43: aviso de celdas que se imprimen en otro idioma porque el idioma por
# defecto (y la columna sin idioma) las dejaban vacias. Lista la variable o la
# lista/codigo y la columna de origen; nada se toma en silencio.
.form_pdf_aviso_otro_idioma <- function(df, prestadas, lang, ajenas = NULL) {
  quien <- function(filas) {
    if ("list_name" %in% names(df) && !"type" %in% names(df)) {
      sprintf("%s/%s", as.character(df$list_name[filas]), as.character(df$name[filas]))
    } else as.character(df$name[filas])
  }
  out <- character(0)
  if (!is.null(prestadas) && nrow(prestadas)) {
    celdas <- unique(sprintf("`%s` (%s)", quien(prestadas$fila), prestadas$columna))
    out <- c(out, sprintf(
      "Texto tomado de otro idioma porque el idioma por defecto (%s) lo deja vacio, en %d celda(s): %s.",
      lang, length(celdas), paste(utils::head(celdas, 12), collapse = "; ")))
  }
  if (!is.null(ajenas) && nrow(ajenas)) {
    celdas <- unique(sprintf("`%s` (%s)", quien(ajenas$fila), ajenas$columna))
    out <- c(out, sprintf(
      "Texto que solo existe en otra escritura y NO se imprime (el idioma por defecto es %s), en %d celda(s): %s.",
      lang, length(celdas), paste(utils::head(celdas, 12), collapse = "; ")))
  }
  out
}

# Item 39: etiqueta `[var]` en cuerpo menor al final del enunciado, cuando el
# numero impreso no coincide con la variable (o la fila no lleva numero: campo
# de control). Va como un tramo mas del rotulo, asi que los dos renderers y la
# reserva del paginado la ven igual.
.FORM_TAG_S <- -1.6

.form_pdf_con_tag <- function(x) {
  tag <- .form_pdf_chr(x$var_tag %||% "")
  if (!nzchar(tag)) return(x)
  base <- .form_rt_campo(x, "label")
  marca <- paste0("[", tag, "]")
  lbl <- .form_pdf_chr(x$label %||% "")
  x$label <- if (nzchar(lbl)) paste0(lbl, " ", marca) else marca
  x$label_rt <- c(base, if (nzchar(lbl)) list(.form_rt_run(" ")),
                  list(.form_rt_run(marca, s = .FORM_TAG_S)))
  x
}

.form_pdf_aplicar_tags <- function(blocks) {
  lapply(blocks, function(b) {
    if (identical(b$kind, "question")) return(.form_pdf_con_tag(b))
    if (identical(b$kind, "matrix")) b$items <- lapply(b$items %||% list(), .form_pdf_con_tag)
    b
  })
}

# Item 46: el texto se normaliza a NFC al leer. Un instrumento con la tilde
# combinada (U+0301 tras la vocal) la imprimia con OTRA fuente, porque Liberation
# no trae el signo suelto (Acreditacion Ing. Civil del corpus). En NFC «e + ´» es
# «é»: mismo texto, un glifo de la fuente del documento.
.form_pdf_nfc <- function(df) {
  if (is.null(df)) return(df)
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  for (nm in names(df)) {
    if (is.character(df[[nm]])) {
      x <- df[[nm]]
      ok <- !is.na(x)
      x[ok] <- stringi::stri_trans_nfc(enc2utf8(x[ok]))
      df[[nm]] <- x
    }
  }
  df
}
