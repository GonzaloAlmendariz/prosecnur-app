# =============================================================================
# reporte_word_colores.R — la paleta por lista llega a los gráficos del Word (ADR 0097, capa Word)
# =============================================================================
#
# La espec nativa trae `colores` (vector character con nombres = rótulo de categoría tal como lo dibuja la espec) sólo
# cuando el usuario definió una paleta que resuelve para esa lista (ADR 0097 §2-3). Los renderers Word la leen con el
# recetario como respaldo: sin `colores`, cada figura dibuja exactamente como antes.
#
# Emparejado: primero por rótulo exacto y, si no, por rótulo normalizado (sin caja, tildes ni espacios repetidos). Un
# rótulo sin color toma el color que el recetario le daba a ESE rótulo (`respaldo`), nunca uno por posición (ADR 0097 §4:
# se retira el respaldo posicional; el gris con aviso de la opción desconocida lo resuelve quien arma la espec).

# Transliteración explícita: `iconv(to = "ASCII//TRANSLIT")` depende de la locale (ver bitacora_modelo.R).
.WORD_TILDES_DE <- "áéíóúüñàèìòùâêîôûäëïö"
.WORD_TILDES_A <- "aeiouunaeiouaeiouaeio"

#' Rótulo normalizado para emparejar colores: minúsculas, sin tildes y con los espacios colapsados
#' @keywords internal
.word_rotulo_norm <- function(x) {
  x <- tolower(enc2utf8(as.character(x)))
  x <- chartr(.WORD_TILDES_DE, .WORD_TILDES_A, x)
  trimws(gsub("[[:space:]]+", " ", x))
}

#' Colores de la paleta del usuario por rótulo, con el recetario como respaldo
#'
#' @param espec Espec nativa; se lee `espec$colores` (con nombres) si existe.
#' @param rotulos Rótulos en el orden en que el renderer los dibuja.
#' @param respaldo Color del recetario para cada rótulo (mismo largo que `rotulos`, o reciclable).
#' @return Vector character del largo de `rotulos`; atributo `de_paleta` (lógico) marca qué rótulos tomaron su color de
#'   la paleta. Sin `colores` válidos devuelve `respaldo` tal cual (sin atributos nuevos en los valores).
#' @keywords internal
.word_colores_de_espec <- function(espec, rotulos, respaldo) {
  rotulos <- as.character(rotulos)
  respaldo <- rep_len(as.character(respaldo), length(rotulos))
  de_paleta <- rep(FALSE, length(rotulos))
  col <- if (is.list(espec)) espec$colores else NULL
  nm <- names(col)
  if (is.null(col) || !length(col) || is.null(nm) || !length(rotulos)) return(structure(respaldo, de_paleta = de_paleta))
  col <- as.character(unlist(col, use.names = FALSE))
  ok <- !is.na(nm) & nzchar(nm) & !is.na(col) & grepl("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", col)
  nm <- nm[ok]; col <- col[ok]
  if (!length(col)) return(structure(respaldo, de_paleta = de_paleta))
  i <- match(rotulos, nm)
  falta <- is.na(i)
  if (any(falta)) i[falta] <- match(.word_rotulo_norm(rotulos[falta]), .word_rotulo_norm(nm))
  de_paleta <- !is.na(i)
  out <- respaldo
  out[de_paleta] <- col[i[de_paleta]]
  structure(out, de_paleta = de_paleta)
}

#' ¿La espec trae una paleta del usuario utilizable?
#' @keywords internal
.word_tiene_colores <- function(espec) {
  is.list(espec) && length(espec$colores) > 0L && !is.null(names(espec$colores))
}
