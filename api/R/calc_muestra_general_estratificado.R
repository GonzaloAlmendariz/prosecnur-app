# n y asignación del estratificado del motor general cuando el diseño sabe
# algo de cada estrato (E3 del loop; research H15).
#
# Sin proporción por estrato y con asignación proporcional, el estratificado
# se calcula como siempre (Cochran + FPC con p global): esto no cambia un solo
# n existente. Dos cosas lo activan:
#   - una proporción esperada por estrato (`p_facultad`): la varianza del
#     diseño es Σ W_h p_h q_h, menor que p q si las prevalencias difieren, y
#     el n baja —es la ganancia de estratificar que la fórmula global no ve—;
#   - la asignación de Neyman: n_h ∝ N_h S_h, que reparte más donde hay más
#     varianza y minimiza el error para un n dado.
# Fórmulas (Cochran 1977, 5.25 y 5.26), con V = (e/z)² y S_h² = p_h q_h · deff:
#   proporcional: n = Σ W_h S_h² / (V + Σ W_h S_h² / N)
#   Neyman:       n = (Σ W_h S_h)² / (V + Σ W_h S_h² / N)

.CM_ASIGNACIONES <- c("proporcional", "neyman", "potencia")

# Pesos de reparto de cada asignación (a qué es proporcional n_h):
#   proporcional ∝ N_h · Neyman ∝ N_h·S_h · potencia ∝ √N_h·S_h
# La de potencia (Bankier 1988, q = 1/2) es el término medio cuando además del
# total se reporta cada estrato: la proporcional deja a los chicos casi sin
# casos y la igual pierde precisión global.
.cm_general_pesos_asignacion <- function(asignacion, v) {
  switch(asignacion %||% "proporcional",
    neyman = v$N_h * v$S_h,
    potencia = sqrt(v$N_h) * v$S_h,
    v$N_h)
}

.cm_general_estratos_varianza <- function(estratos, par) {
  N_h <- vapply(estratos, function(e) as.numeric(e$N), numeric(1))
  p_h <- vapply(estratos, function(e) {
    p <- suppressWarnings(as.numeric(e$p_facultad %||% NA))
    if (length(p) != 1L || is.na(p) || p <= 0 || p >= 1) as.numeric(par$p) else p
  }, numeric(1))
  declarada <- vapply(estratos, function(e) {
    p <- suppressWarnings(as.numeric(e$p_facultad %||% NA))
    length(p) == 1L && !is.na(p) && p > 0 && p < 1
  }, logical(1))
  S2_h <- p_h * (1 - p_h) * as.numeric(par$deff %||% 1)
  list(N_h = N_h, p_h = p_h, S2_h = S2_h, S_h = sqrt(S2_h), alguna_p = any(declarada))
}

# ¿Este estratificado usa la fórmula por estrato? Sólo si hay algo que la
# fórmula global no sabe: p por estrato o asignación de Neyman.
.cm_general_estratificado_por_estrato <- function(estratos, par) {
  if (!length(estratos)) return(FALSE)
  !identical(par$asignacion %||% "proporcional", "proporcional") ||
    .cm_general_estratos_varianza(estratos, par)$alguna_p
}

#' n teórico del estratificado por estrato (Cochran 5.25/5.26).
.cm_general_n_estratificado <- function(estratos, par) {
  v <- .cm_general_estratos_varianza(estratos, par)
  N <- sum(v$N_h)
  W <- v$N_h / N
  V <- (as.numeric(par$e) / as.numeric(par$z))^2
  suma_s2 <- sum(W * v$S2_h)
  pesos <- .cm_general_pesos_asignacion(par$asignacion, v)
  # Fórmula general para una asignación con fracciones a_h (Cochran 5.24):
  # n = Σ W_h² S_h² / a_h / (V + Σ W_h S_h² / N). Con a_h = W_h es la
  # proporcional (ΣW_h S_h²) y con a_h ∝ W_h S_h, Neyman ((ΣW_h S_h)²).
  a <- if (sum(pesos) > 0) pesos / sum(pesos) else W
  ok <- a > 0
  num <- sum((W^2 * v$S2_h)[ok] / a[ok])
  n <- num / (V + suma_s2 / N)
  list(n = as.integer(min(N, ceiling(n - 1e-9))), n_crudo = n, num = num,
       pesos = pesos, varianza = v)
}

#' Error del estratificado con la asignación efectiva:
#' e = z · √(Σ W_h² S_h² (1 − n_h/N_h) / n_h).
.cm_general_error_estratificado <- function(n_h, estratos, par) {
  v <- .cm_general_estratos_varianza(estratos, par)
  N <- sum(v$N_h)
  W <- v$N_h / N
  ok <- n_h > 0
  if (!any(ok)) return(NA_real_)
  # Un estrato sin casos no aporta estimación: el error total no se define.
  if (any(!ok & v$N_h > 0)) return(NA_real_)
  var <- sum((W^2 * v$S2_h * (1 - n_h / v$N_h) / n_h)[ok])
  as.numeric(par$z) * sqrt(max(0, var))
}
