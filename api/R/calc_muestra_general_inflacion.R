# Del n de completas al n que sale a campo, en el motor general.
#
# El n que devuelve la fórmula es de ENCUESTAS COMPLETAS. Para obtenerlas hay
# que abordar más casos: n_operativo = ⌈n / tasa_respuesta⌉ (Lohr 2019 §8.1;
# Valliant, Dever & Kreuter 2018 cap. 6), y sobre eso la reserva de
# sobremuestra. Hasta el 2026-09-24 el MAS y el estratificado sólo sumaban la
# sobremuestra: con N=1000 y respuesta 0.6 salían 306 a campo en vez de 464 y
# el input «Respuesta» de Método no movía nada (research H03).
#
# Sólo se divide por la tasa de RESPUESTA, que es la que Método expone. La de
# contacto y la de elegibilidad tienen defaults (0.5 y 0.9) que ninguna
# pantalla de Muestra general muestra: aplicarlas duplicaría n en silencio.
#
# Tope: nunca se aborda más que el marco (H05). Si el tope muerde, el diseño
# es de hecho un censo del marco y se dice.
.cm_general_inflar_operativo <- function(n_objetivo, par, N) {
  n_objetivo <- as.integer(n_objetivo)
  tasa <- par$tasa_respuesta %||% 1
  if (!is.numeric(tasa) || is.na(tasa) || tasa <= 0) tasa <- 1
  # El épsilon absorbe la coma flotante: 21 / 0.7 da 30.000000000000004 y
  # ceiling lo subía a 31 (26 de cada 1000 n con respuesta 0.7).
  base <- as.integer(ceiling(n_objetivo / min(tasa, 1) - 1e-9))
  sobremuestra <- as.integer(ceiling(base * (par$oversample_pct %||% 0) - 1e-9))
  operativo <- base + sobremuestra
  pedido <- operativo
  topado <- !is.na(N) && N > 0L && operativo > N
  if (topado) {
    operativo <- as.integer(N)
    sobremuestra <- as.integer(max(0L, N - base))
    base <- as.integer(min(base, N))
  }
  list(
    n_operativo_base = base,
    sobremuestra = sobremuestra,
    n_operativo = as.integer(operativo),
    topado_en_marco = topado,
    advertencia = if (topado) sprintf(
      "El n a campo (%d con respuesta %.0f%%) alcanza el marco: se aborda el marco completo (%d), es un censo del marco.",
      as.integer(pedido), 100 * min(tasa, 1), as.integer(N)
    ) else NULL
  )
}

# El n a campo del estratificado se infla ESTRATO POR ESTRATO (L2 del loop de
# mejoras, 2026-09-27). Antes se inflaba el total una vez y se volvía a
# repartir con el piso: un estrato que quedaba en el piso de completas recibía
# el piso también a campo, sin inflar (Puno: 30 a campo para 30 completas con
# respuesta 0.7), y esa inflación se la llevaban los estratos grandes. Cada
# estrato aborda lo que sus completas exigen, con tope en su N_h:
#   n_campo_h = mín(N_h, ⌈n_h / tasa⌉ + ⌈⌈n_h / tasa⌉ · sobremuestra⌉)
# y el n a campo del componente es la suma.
.cm_general_campo_por_estrato <- function(n_h, N_h, par) {
  n_h <- as.integer(n_h); N_h <- as.integer(N_h)
  tasa <- par$tasa_respuesta %||% 1
  if (!is.numeric(tasa) || is.na(tasa) || tasa <= 0) tasa <- 1
  os <- par$oversample_pct %||% 0
  if (!is.numeric(os) || is.na(os) || os < 0) os <- 0
  base <- as.integer(ceiling(n_h / min(tasa, 1) - 1e-9))
  pedido <- base + as.integer(ceiling(base * os - 1e-9))
  n_campo <- as.integer(pmin(pedido, N_h))
  list(base = base, pedido = pedido, n_campo = n_campo,
       topados = which(pedido > N_h & N_h > 0L))
}

# Completas esperadas cuando el n a campo se topa en el marco (L3 del loop de
# mejoras, 2026-09-27). Si se aborda todo el marco (o todo un estrato), lo que
# vuelve son n_campo · tasa completas, que puede ser menos que el n de la
# fórmula: con N = 2000, respuesta .3 y n = 697 se esperan 600, y el margen
# real es el de 600. Sin tope devuelve n tal cual.
.cm_general_completas_esperadas <- function(n, n_campo, par) {
  tasa <- par$tasa_respuesta %||% 1
  if (!is.numeric(tasa) || is.na(tasa) || tasa <= 0) tasa <- 1
  pmin(as.numeric(n), as.numeric(n_campo) * min(tasa, 1))
}

.cm_general_fmt_completas <- function(x) {
  x <- round(as.numeric(x), 1)
  if (abs(x - round(x)) < 1e-9) format(as.integer(round(x))) else formatC(x, format = "f", digits = 1)
}

.cm_general_aviso_margen_topado <- function(n, esperadas, ea, e, relativo = FALSE) {
  unidad <- if (relativo) " % de la media" else " puntos"
  sprintf(
    "Abordando el marco completo se esperan %s completas de las %d que pide el margen: el error alcanzable es ±%.1f%s, no ±%.1f. Sube la tasa de respuesta o acepta ese margen.",
    .cm_general_fmt_completas(esperadas), as.integer(n), 100 * ea, unidad, 100 * as.numeric(e))
}
