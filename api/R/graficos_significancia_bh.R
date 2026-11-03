# La familia de Benjamini-Hochberg del informe (ADR 0126 §3, decisión D3)
# =======================================================================
#
# Con `correccion = "bh_informe"`, el p de cada comparación se ajusta contra TODAS las comparaciones del estudio, no
# contra las de su fila. Es un cálculo en dos pasadas: primero se calculan todos los p (`.sig_familia_estudio`, en
# graficos_significancia_familia.R) y después se marca.
#
# La familia se guarda como su vector ordenado de p y el q de BH de cada uno. Con eso, el q de cualquier p se lee sin
# recalcular: es el q del mayor p de la familia que no lo supera. Para un p que está en la familia, es exactamente
# `p.adjust(familia, "BH")` (lo prueba test-graficos-significancia-bh.R); para uno que no está (una lámina con
# filtros, ADR 0126 «Fuera de alcance»), es la interpolación monótona que daría si se agregara al final de su rango.

#' Tabla de BH de una familia de p
#' @keywords internal
.sig_bh_tabla <- function(p) {
  p <- sort(as.numeric(p[is.finite(p)]))
  m <- length(p)
  if (!m) return(list(p = numeric(0), q = numeric(0), m = 0L))
  q <- rev(cummin(rev(pmin(1, m * p / seq_len(m)))))
  list(p = p, q = q, m = m)
}

#' q de BH de cada p según la tabla de la familia
#' @keywords internal
.sig_bh_q <- function(p, tabla) {
  out <- rep(NA_real_, length(p))
  if (is.null(tabla) || !tabla$m) return(out)
  ok <- is.finite(p)
  i <- findInterval(p[ok], tabla$p)
  # Un p menor que el menor de la familia (no debería pasar si está en ella) toma el q del primero.
  i[i < 1L] <- 1L
  out[ok] <- tabla$q[i]
  out
}

#' Clave de una comparación, para no contar dos veces la misma prueba
#' @keywords internal
.sig_clave_par <- function(var, cruce, fila, a, b) {
  ab <- ifelse(as.character(a) < as.character(b), paste(a, b, sep = "|"), paste(b, a, sep = "|"))
  paste(var, cruce, fila, ab, sep = "\r")
}
