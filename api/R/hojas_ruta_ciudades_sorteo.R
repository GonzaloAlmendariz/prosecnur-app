# =============================================================================
# hojas_ruta_ciudades_sorteo.R — ciudades de inclusión forzosa y ciudades
# sorteadas por macrorregión (ADR 0131 §1b, enmienda del 4/11)
# =============================================================================
#
# Reemplaza el mínimo de 2 rutas por estrato del §1: «hay que tener cuidado de no
# ir a lugares solo por un par de rutas» (Gonzalo, 4/11). En los modos de estrato
# provincia:
#
#   1. Reparto proporcional de las T rutas entre ciudades (provincias del
#      registro) según su población (adultos urbanos 2025 con la base 2025):
#      R_c = T · P_c / ΣP.
#   2. Forzosa: R_c ≥ m (`rutas_minimas_ciudad`, 6 por defecto), y siempre Lima
#      Metropolitana (1501) y Callao (0701). Recibe su reparto proporcional, sin
#      piso añadido.
#   3. Las demás se agrupan por macrorregión g. R_g = Σ R_c, h_g = max(1, ⌊R_g/m⌋)
#      ciudades a visitar, π_c = h_g · MOS_c / MOS_g. Una ciudad con π_c ≥ 1 pasa a
#      forzosa y el grupo se recalcula.
#   4. Rutas enteras: cada unidad (ciudad forzosa o grupo) recibe su reparto
#      proporcional, con piso m en la ciudad forzosa y m · h_g en el grupo; el piso
#      sólo se aplica si el proporcional queda debajo (no se suma encima).
#   5. Sorteo de h_g ciudades por PPS sistemático (`.hojas_ruta_cuota_zona_rutas`
#      con π_c < 1 elige cada ciudad con probabilidad exacta π_c), semilla del
#      proyecto. Cada ciudad sorteada recibe ⌊n_g/h_g⌋ o ⌈n_g/h_g⌉ rutas con
#      E = n_g/h_g ≥ m, por un redondeo controlado.
#   6. Dentro de la ciudad (o de cada área de Lima) el reparto entre distritos y el
#      PPS por distrito son los del §1 (`hojas_ruta_estrato.R`).
#
# Medida de la ciudad para π_c: MOS_c, la suma de la medida del sorteo de sus
# manzanas del marco elegible (con la base 2025 es M · g_d, que aproxima a los
# adultos urbanos 2025). Con esa medida el grupo queda autoponderado:
#   π_i = π_c · π_i|c = h_g·MOS_c/MOS_g · (n_g/h_g)·MOS_i/MOS_c = n_g · MOS_i / MOS_g
# (sin certezas). Con certezas, π_i|c es la mezcla exacta de las ramas del
# redondeo (`hojas_ruta_ciudades_pi`).
# =============================================================================

HOJAS_RUTA_RUTAS_MINIMAS_CIUDAD <- 6L
HOJAS_RUTA_CIUDADES_SIEMPRE <- c("1501", "0701")

#' Campo `rutas_minimas_ciudad` de `sample_size`; se suma desde
#' `hojas_ruta_tamano_extras_normalizar()`.
hojas_ruta_ciudades_normalizar <- function(x = NULL) {
  v <- if (is.list(x)) x$rutas_minimas_ciudad else NULL
  v <- suppressWarnings(as.integer(if (is.null(v) || !length(v)) NA else unlist(v)[[1]]))
  if (is.na(v) || v < 1L) v <- HOJAS_RUTA_RUTAS_MINIMAS_CIUDAD
  list(rutas_minimas_ciudad = v)
}

#' Reparto entero con piso: proporcional a `w`, pero ninguna unidad debajo de su
#' `piso` (el piso no se suma encima del proporcional). Mayor resto determinista.
.hojas_ruta_ciudades_reparto_con_piso <- function(w, total, piso) {
  k <- length(w)
  fijo <- rep(FALSE, k)
  repeat {
    libre <- total - sum(piso[fijo])
    x <- ifelse(fijo, piso, libre * w / sum(w[!fijo]))
    nuevo <- !fijo & x < piso - 1e-9
    if (!any(nuevo)) break
    fijo <- fijo | nuevo
    if (all(fijo)) break
  }
  out <- as.integer(ifelse(fijo, piso, 0L))
  if (any(!fijo)) out[!fijo] <- .hojas_ruta_allocate_integer(w[!fijo], total - sum(piso[fijo]))
  # El mayor resto puede dejar un libre en ⌊x⌋ < piso cuando x apenas pasa el piso.
  bajo <- which(!fijo & out < piso)
  for (j in bajo) {
    donante <- which.max(ifelse(out - piso > 0, out - piso, -Inf))
    out[j] <- out[j] + 1L
    out[donante] <- out[donante] - 1L
  }
  out
}

#' Selección de ciudades del modo estrato provincia.
#'
#' @param ciudad Código de ciudad (provincia) de cada distrito.
#' @param pob Población del reparto de cada distrito. @param mos MOS_d del marco elegible.
#' @param route_total Rutas en total. @param cfg Configuración normalizada.
#' @return list(ciudades = data.frame(ciudad, grupo, condicion, poblacion, mos,
#'   reparto, pi_ciudad, rutas, esperado), grupos = data.frame(grupo, reparto,
#'   h, rutas, n_ciudades)).
hojas_ruta_ciudades_seleccion <- function(ciudad, pob, mos, route_total, cfg) {
  m <- hojas_ruta_ciudades_normalizar(cfg$sample_size)$rutas_minimas_ciudad
  cods <- sort(unique(ciudad))
  P <- vapply(cods, function(c) sum(pob[ciudad == c]), numeric(1))
  M <- vapply(cods, function(c) sum(mos[ciudad == c]), numeric(1))
  R <- route_total * P / sum(P)
  grupo <- hojas_ruta_macrorregion_de(cods)
  forzosa <- R >= m - 1e-9 | cods %in% HOJAS_RUTA_CIUDADES_SIEMPRE
  repeat {
    pi_c <- rep(1, length(cods))
    h <- list()
    for (g in unique(grupo[!forzosa])) {
      ix <- which(!forzosa & grupo == g)
      if (sum(M[ix]) <= 0) {
        stop_api(422, "E_HOJAS_RUTA_CIUDAD_SIN_MEDIDA", sprintf("Ninguna ciudad sorteable de la macrorregión %s tiene manzanas con medida.", g))
      }
      h[[g]] <- max(1L, as.integer(floor(sum(R[ix]) / m + 1e-9)))
      pi_c[ix] <- h[[g]] * M[ix] / sum(M[ix])
    }
    nuevas <- !forzosa & pi_c >= 1 - 1e-9
    if (!any(nuevas)) break
    forzosa <- forzosa | nuevas
  }
  grupos <- sort(unique(grupo[!forzosa]))
  w <- c(R[forzosa], vapply(grupos, function(g) sum(R[!forzosa & grupo == g]), numeric(1)))
  piso <- c(rep(m, sum(forzosa)), vapply(grupos, function(g) m * h[[g]], numeric(1)))
  if (sum(piso) > route_total) {
    stop_api(422, "E_HOJAS_RUTA_CIUDAD_SIN_RUTAS",
             sprintf("Con %d rutas mínimas por ciudad visitada hacen falta %d rutas y el tamaño da %d.", m, as.integer(sum(piso)), as.integer(route_total)),
             details = list(rutas_minimas_ciudad = m, minimo = as.integer(sum(piso)), rutas = as.integer(route_total)))
  }
  n_u <- .hojas_ruta_ciudades_reparto_con_piso(w, as.integer(route_total), piso)
  rutas <- stats::setNames(integer(length(cods)), cods)
  esperado <- stats::setNames(numeric(length(cods)), cods)
  rutas[cods[forzosa]] <- n_u[seq_len(sum(forzosa))]
  esperado[cods[forzosa]] <- n_u[seq_len(sum(forzosa))]
  seed <- cfg$seed %||% 2017L
  n_g <- stats::setNames(n_u[sum(forzosa) + seq_along(grupos)], grupos)
  condicion <- ifelse(forzosa, "forzosa", "no_sorteada")
  for (g in grupos) {
    ix <- which(!forzosa & grupo == g)
    sel <- .hojas_ruta_cuota_zona_rutas(M[ix], h[[g]], seed, paste0("ciudades-", g)) > 0L
    reparto <- .hojas_ruta_cuota_zona_rutas(rep(1, h[[g]]), n_g[[g]], seed, paste0("ciudades-rutas-", g))
    rutas[ix[sel]] <- reparto
    esperado[ix] <- n_g[[g]] / h[[g]]
    condicion[ix[sel]] <- "sorteada"
  }
  list(
    ciudades = data.frame(ciudad = cods, grupo = ifelse(forzosa, NA_character_, grupo), macrorregion = grupo,
                          condicion = condicion, poblacion = P, mos = M, reparto = R, pi_ciudad = pi_c,
                          rutas = as.integer(rutas), esperado = as.numeric(esperado), stringsAsFactors = FALSE),
    grupos = data.frame(grupo = grupos, reparto = vapply(grupos, function(g) sum(R[!forzosa & grupo == g]), numeric(1)),
                        h = vapply(grupos, function(g) as.integer(h[[g]]), integer(1)),
                        rutas = as.integer(n_g[grupos]),
                        n_ciudades = vapply(grupos, function(g) sum(!forzosa & grupo == g), integer(1)),
                        stringsAsFactors = FALSE),
    rutas_minimas_ciudad = m
  )
}

#' π de la manzana dada su ciudad y su estrato: π_c · π_i|c. `n_lo`, `n_hi`, `f_n`
#' describen las rutas del estrato (fijas si f_n = 0); `share_d` = MOS_d / MOS_h.
hojas_ruta_ciudades_pi <- function(m, pi_ciudad, n_lo, n_hi, f_n, share_d) {
  rama <- function(n) hojas_ruta_estrato_pi(m, n * share_d)
  pi_lo <- rama(n_lo)
  pi_cond <- if (f_n <= 1e-9) pi_lo else (1 - f_n) * pi_lo + f_n * rama(n_hi)
  pi_ciudad * pi_cond
}
