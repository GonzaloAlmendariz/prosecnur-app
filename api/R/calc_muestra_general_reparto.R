# Reparto de un n entre estratos del motor general: proporcional a N_h, con
# piso mínimo por estrato y sin pasar nunca de N_h.
#
# Reemplaza, sólo para el estratificado y la matriz de servicios de Muestra
# general, al reparto «cuadratura» (`distribuir_proporcional_pesos`), que hacía
# ceiling de cada cuota y cargaba el residuo entero en el estrato mayor:
# 5 sobre (100,1,1,1,1,1,1) daba 0,1,1,1,1,1,1 —suma 6 y el estrato del 94 %
# en cero— y un piso de 30 con N_h=20 asignaba 31 (research H01/H02/H09).
#
# Reglas, en orden (Cochran 1977 §5.5; Lohr 2019 §3.4):
#   1. Si n ≥ ΣN_h, es un censo: n_h = N_h.
#   2. Un estrato cuya cuota proporcional alcanza su N_h se censa y sale del
#      reparto; su excedente se redistribuye entre los demás.
#   3. El piso es max(piso, cuota), nunca piso + cuota. Un estrato por debajo
#      del piso recibe min(piso, N_h) y sale del reparto. Se itera hasta que
#      ningún estrato cambie de condición.
#   4. Si los pisos no caben en n (Σ min(piso, N_h) > n), el piso no se aplica
#      y se declara en el atributo `piso_incumplible`.
#   5. Lo que queda se reparte por mayor resto (Hamilton): piso de la cuota
#      cruda y las unidades sobrantes a los mayores decimales, empates por el
#      orden de entrada. La suma cierra exacta y ningún n_h excede N_h.
#
# El conglomerado y `calc_muestra_distribucion.R` alimentan aulas y siguen con
# el reparto legacy hasta que se decida llevarlo también allí.
.cm_general_reparto <- function(n_total, N_h, piso = 0L) {
  H <- length(N_h)
  if (H == 0L) return(integer())
  N_h <- as.integer(pmax(0L, N_h))
  n_total <- as.integer(max(0L, n_total))
  piso <- as.integer(max(0L, piso %||% 0L))
  if (n_total == 0L || sum(N_h) == 0L) return(rep(0L, H))
  if (n_total >= sum(N_h)) return(N_h)

  piso_incumplible <- piso > 0L && sum(pmin(piso, N_h)) > n_total
  if (piso_incumplible) piso <- 0L

  n_h <- rep(0L, H)
  fijo <- N_h == 0L
  repeat {
    libres <- which(!fijo)
    resto <- n_total - sum(n_h[fijo])
    if (!length(libres) || resto <= 0L) break
    crudo <- resto * N_h[libres] / sum(N_h[libres])
    censo <- crudo >= N_h[libres]
    bajo_piso <- !censo & piso > 0L & crudo < piso
    if (!any(censo | bajo_piso)) break
    idx <- libres[censo | bajo_piso]
    n_h[idx] <- ifelse(censo[censo | bajo_piso], N_h[idx], pmin(piso, N_h[idx]))
    fijo[idx] <- TRUE
  }

  libres <- which(!fijo)
  resto <- n_total - sum(n_h[fijo])
  if (length(libres) && resto > 0L) {
    crudo <- resto * N_h[libres] / sum(N_h[libres])
    base <- floor(crudo)
    faltan <- as.integer(resto - sum(base))
    if (faltan > 0L) {
      orden <- order(-(crudo - base), seq_along(crudo))
      base[orden[seq_len(faltan)]] <- base[orden[seq_len(faltan)]] + 1
    }
    n_h[libres] <- as.integer(base)
  }
  n_h <- as.integer(n_h)
  if (piso_incumplible) attr(n_h, "piso_incumplible") <- TRUE
  n_h
}
