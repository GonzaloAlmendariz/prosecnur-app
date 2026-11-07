# =============================================================================
# graficos_divergentes_publicos.R — la escala del resumen con varios públicos en una lámina (ADR 0135, C5 contra Arte)
# =============================================================================
#
# El resumen ejecutivo de Arte pone en UNA lámina «Preguntas con menos de 60% de acuerdo» de los tres públicos y
# rotula cada fila con su público: «Conozco los reglamentos (Doc.)». `p_barras_divergentes()` acepta refs de varias
# bases (`base$*` de cada una); la regla se aplica sobre todas y cada fila lleva la abreviatura de su base. La
# abreviatura sale del nombre de la base (sus tres primeras letras y punto; el nombre entero si dos chocan) o del arg
# `abreviaturas`: «Docentes: Doc.; Administrativos: Adm.».

#' Clave de comparación de un nombre de base: minúsculas, sin tildes ni espacios sobrantes
#' @keywords internal
.divergentes_clave_base <- function(x) tolower(trimws(.box_norm_etiqueta(x)))

#' Lee `abreviaturas`: texto «Docentes: Doc.; Estudiantes: Est.» o lista/vector con nombres
#' @return Carácter con nombres = clave de la base.
#' @keywords internal
.divergentes_abreviaturas_leer <- function(x) {
  vacio <- stats::setNames(character(0), character(0))
  if (is.null(x) || !length(x)) return(vacio)
  if (!is.null(names(x)) && all(nzchar(names(x)))) {
    v <- vapply(x, function(a) trimws(as.character(unlist(a))[1]), character(1))
    return(stats::setNames(v, .divergentes_clave_base(names(x)))[!is.na(v) & nzchar(v)])
  }
  txt <- paste(as.character(unlist(x)), collapse = ";")
  partes <- trimws(strsplit(txt, "[;\n]+")[[1]])
  partes <- partes[grepl(":", partes, fixed = TRUE)]
  if (!length(partes)) return(vacio)
  k <- trimws(sub(":.*$", "", partes)); v <- trimws(sub("^[^:]*:", "", partes))
  ok <- nzchar(k) & nzchar(v)
  stats::setNames(v[ok], .divergentes_clave_base(k[ok]))
}

#' Abreviatura de cada base: la declarada o las tres primeras letras del nombre y punto (el nombre si dos chocan)
#' @keywords internal
.divergentes_abreviaturas <- function(bases, declaradas = NULL) {
  bases <- unique(as.character(bases))
  dec <- .divergentes_abreviaturas_leer(declaradas)
  nombre <- .radar_mb_capitalizar(gsub("_+", " ", bases))
  auto <- paste0(substr(nombre, 1L, 3L), ".")
  choca <- auto %in% auto[duplicated(auto)]
  auto[choca] <- nombre[choca]   # dos que chocan en tres letras van con su nombre entero
  out <- stats::setNames(auto, bases)
  k <- .divergentes_clave_base(bases)
  hay <- k %in% names(dec)
  out[hay] <- unname(dec[k[hay]])
  out
}

#' Rotula cada fila con su público cuando las refs vienen de más de una base («Reglamentos (Doc.)»)
#' @param refs Refs `base$variable` alineadas con `rotulos`.
#' @keywords internal
.divergentes_rotulos_publicos <- function(rotulos, refs, abreviaturas = NULL) {
  bases <- vapply(as.character(refs), function(r) .graficos_ref_parts(r)$source, character(1), USE.NAMES = FALSE)
  if (length(unique(bases[nzchar(bases)])) < 2L) return(rotulos)
  ab <- .divergentes_abreviaturas(bases[nzchar(bases)], abreviaturas)
  ifelse(nzchar(bases), sprintf("%s (%s)", rotulos, ab[bases]), rotulos)
}
