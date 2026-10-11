# graficos_orden_rangos.R — rangos numéricos que el instrumento guardó revueltos.
#
# Una variable recodificada (p. ej. `p4_recod`, «Rango de edades») puede traer sus categorías en el orden en que
# aparecieron en los datos: «De 30 a 35», «De 22 a 25», «De 26 a 29», «De 36 a más». El modo «instrumento» del recetario
# las dibujaba tal cual (medido en acrconta_mazo, láminas 8 y 11). Si TODOS los rótulos no residuales traen una cifra y
# el orden guardado no es ni creciente ni decreciente por esa cifra, se ordenan de menor a mayor. Un orden decreciente
# deliberado («De 51 a más» primero) se respeta; un empate conserva el orden del instrumento.

#' Primer número de cada rótulo (miles con punto o coma incluidos), `NA` si no trae
#' @keywords internal
.goc_primer_numero <- function(etiquetas) {
  m <- regmatches(etiquetas, regexpr("[0-9][0-9.,]*", etiquetas))
  out <- rep(NA_real_, length(etiquetas))
  tiene <- grepl("[0-9]", etiquetas)
  out[tiene] <- suppressWarnings(as.numeric(gsub("[.,]", "", m)))
  out
}

#' Índices en orden de rango cuando el instrumento los trae revueltos; `idx` tal cual en cualquier otro caso
#' @keywords internal
.goc_orden_rangos <- function(cats, idx) {
  nr <- idx[!cats$residual[idx]]
  if (length(nr) < 3L) return(idx)
  v <- .goc_primer_numero(as.character(cats$etiqueta[nr]))
  if (anyNA(v)) return(idx)
  if (!is.unsorted(v) || !is.unsorted(rev(v))) return(idx)
  c(nr[order(v, seq_along(nr))], idx[cats$residual[idx]])
}
