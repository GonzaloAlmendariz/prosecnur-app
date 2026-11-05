# lamina_mixtas_base_principal.R — la base de una lámina de varios gráficos y el «N respuestas» de cada panel
#
# Revisión del PPT v7.23 de CCSS, ítem 5 (lámina 17, crianza): «¿por qué mostrar el N cuando coincide con el que ya está
# en la base? Además en la esquina debe estar solo la base de los estudiantes; no es necesario que ponga otras bases que
# difieren, esas ya están en el subtítulo de los otros gráficos».
#
#   - La base de la lámina es la principal: la población del estudio. La escrita en el plan (`payload$base`) manda tal
#     cual; la automática, que juntaba las notas de los paneles, se queda con la de la población (la de mayor n) cuando
#     todos los gráficos son del mismo público. Con públicos distintos (docentes y estudiantes) se conservan todas: el
#     panel sólo dice «N respuestas», no a quién.
#   - El subtítulo «400 respuestas» de un panel sale sólo si su n difiere del de la base de la lámina (comparación exacta
#     de enteros). Un gráfico con filtro (otra base) lo conserva.

#' n de la base de una lámina: el primer número de su frase («Base: 400 estudiantes…» → 400); `NA` si no lo trae
#' @keywords internal
.lam_base_principal_n <- function(base) {
  txt <- trimws(as.character(base %||% "")[1])
  if (is.na(txt) || !nzchar(txt)) return(NA_real_)
  m <- sub("^Base:\\s*([0-9][0-9.,]*).*$", "\\1", txt)   # el número que sigue a «Base:»; si no, el primero de la frase
  if (identical(m, txt)) m <- regmatches(txt, regexpr("[0-9][0-9.,]*", txt))
  if (!length(m)) return(NA_real_)
  n <- suppressWarnings(as.numeric(gsub("[.,]", "", m)))
  if (is.finite(n)) n else NA_real_
}

#' ¿Los gráficos de la lámina son del mismo público? (la base de su referencia: `docentes$p3`; sin prefijo, la única)
#' @keywords internal
.lam_mixta_misma_fuente <- function(especs, els = NULL) {
  graficos <- which(!vapply(especs, function(e) is.null(e) || .lam_es_cifra(e), TRUE))
  graficos <- graficos[graficos <= length(els %||% list())]
  if (!length(graficos)) return(TRUE)
  fuente <- function(el) {
    ref <- as.character(unlist(el$var %||% el$vars %||% ""))[1]
    if (is.na(ref) || !grepl("$", ref, fixed = TRUE)) "" else .base_nombre_visible(sub("\\$.*$", "", ref))
  }
  length(unique(vapply(els[graficos], fuente, ""))) <= 1L
}

#' La base automática de la lámina: sólo la principal (la de mayor n) cuando los gráficos son del mismo público
#' @param bases Frases de base de los paneles, ya sin repetir (`.lam_bases_sin_repetir`).
#' @keywords internal
.lam_mixta_solo_base_principal <- function(bases, especs, els = NULL) {
  if (length(bases) < 2L || !.lam_mixta_misma_fuente(especs, els)) return(bases)
  ns <- vapply(bases, .lam_base_principal_n, 0)
  if (!any(is.finite(ns))) return(bases)
  bases[which.max(ifelse(is.finite(ns), ns, -Inf))]
}

#' Quita el «N respuestas» de los paneles cuyo n es el de la base de la lámina
#' @param publicos Lista por panel («55 respuestas» o `NULL`). @param base Texto de la base de la lámina.
#' @keywords internal
.lam_mixta_publicos_sin_base <- function(publicos, especs, base) {
  n0 <- .lam_base_principal_n(base)
  if (!is.finite(n0)) return(publicos)
  for (k in seq_along(publicos)) {
    e <- if (k <= length(especs)) especs[[k]] else NULL
    if (is.null(publicos[[k]]) || is.null(e) || .lam_es_cifra(e)) next
    n <- suppressWarnings(as.numeric(.espec_n_base(e)))
    if (length(n) == 1L && is.finite(n) && round(n) == n0) publicos[k] <- list(NULL)
  }
  publicos
}
