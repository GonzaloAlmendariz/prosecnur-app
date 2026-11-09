# =============================================================================
# graficos_dumbbell_temas_nombre.R — el nombre del tema de un contraste con pares declarados (H2)
# =============================================================================
#
# Arte (2026-11-09): en el contraste con pares declarados (`vars = list(nombre = c(A, B))`) el nombre del tema era
# obligatorio y mandaba sobre el plan, así que la pestaña «Rótulos cortos» no llegaba a esas filas. Dos reglas:
#   1. un nombre de tema idéntico al enunciado del instrumento (sin distinguir espacios ni mayúsculas) no cuenta como
#      declarado: vale el nombre corto del plan (`.resumen_es_enunciado`, graficos_nombres_cortos_plan.R);
#   2. un par puede ir sin nombre: al dibujar toma el enunciado de su primera pregunta (con el resolvedor del
#      instrumento), y por la regla 1 el nombre corto del plan lo reemplaza si lo hay.

#' Rótulo normalizado para comparar: espacios (también el duro) colapsados, sin bordes y en minúsculas
#' @keywords internal
.rotulo_normalizar <- function(x) {
  x <- as.character(x)
  tolower(trimws(gsub("[[:space:] ]+", " ", x)))
}

#' Enunciado de una ref en el instrumento (la columna de etiqueta en español si la hay), o NA
#' @param insts Instrumentos por base.
#' @keywords internal
.ref_enunciado <- function(ref, insts) {
  p <- .graficos_ref_parts(ref)
  inst <- if (nzchar(p$source %||% "")) insts[[p$source]] else if (length(insts) == 1L) insts[[1]] else NULL
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !"name" %in% names(sv)) return(NA_character_)
  col <- .detect_label_es_col(sv)
  if (is.na(col)) col <- grep("^label", names(sv), value = TRUE)[1]
  i <- which(as.character(sv$name) == p$name)[1]
  lab <- if (is.na(col) || is.na(i)) NA_character_ else trimws(as.character(sv[[col]][[i]]))
  if (is.na(lab) || !nzchar(lab)) NA_character_ else lab
}

#' Los temas de un contraste con nombre: el que no lo trae toma el enunciado de su primera pregunta
#' @param vars Lista de temas (cada uno con sus refs), con o sin nombres.
#' @param insts Instrumentos por base.
#' @keywords internal
.dumbbell_temas_nombrar <- function(vars, insts) {
  if (!is.list(vars) || !length(vars)) return(vars)
  nm <- names(vars) %||% rep("", length(vars))
  nm[is.na(nm)] <- ""
  if (all(nzchar(trimws(nm)))) return(vars)
  for (i in which(!nzchar(trimws(nm)))) {
    r1 <- as.character(unlist(vars[[i]]))[1]
    lab <- .ref_enunciado(r1, insts)
    nm[i] <- if (!is.na(lab)) lab else sub("^.*\\$", "", r1)
  }
  stats::setNames(vars, make.unique(trimws(nm), sep = " "))
}
