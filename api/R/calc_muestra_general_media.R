# Tamaño para estimar una MEDIA con error relativo (research H21).
#
# El motor general sólo dimensionaba proporciones. Para un ingreso, unas horas
# o un puntaje la pregunta es «¿cuántos casos para estimar la media con un
# error relativo de ±r?», y la respuesta depende del coeficiente de variación
# esperado (CV = σ/μ), no de p (Cochran 1977, §4.4; Lohr 2019, §2.7):
#   n0 = z² · CV² · deff / r²,   n = n0 / (1 + (n0 − 1)/N)
#   r alcanzado = z · CV · √(deff · (N − n) / (n (N − 1)))
# El margen `e` se lee como error RELATIVO (0,05 = ±5 % de la media). Sin CV
# previo, 1 es un valor conservador para variables sesgadas como el ingreso.

.CM_TIPOS_INDICADOR <- c("proporcion", "media")

.cm_general_es_media <- function(par) identical(par$tipo_indicador %||% "proporcion", "media")

.cm_general_n_media <- function(N, cv, z, r, deff = 1) {
  n0 <- as.numeric(z)^2 * as.numeric(cv)^2 * as.numeric(deff) / as.numeric(r)^2
  n <- if (is.finite(N) && N > 0) n0 / (1 + (n0 - 1) / N) else n0
  as.integer(ceiling(n - 1e-9))
}

.cm_general_error_media <- function(n, N, cv, z, deff = 1) {
  if (is.na(n) || n <= 0) return(NA_real_)
  fpc <- if (is.finite(N) && N > 1) max(N - n, 0) / (N - 1) else 1
  as.numeric(z) * as.numeric(cv) * sqrt(as.numeric(deff) * fpc / n)
}
