# Comparar semillas del sorteo de Hojas de ruta (U13, plan B5).
#
# Un sorteo en seco por semilla, sin guardar nada: misma config, otra semilla. Para
# cada una se miden cosas que el equipo mira antes de elegir:
#   - rutas por revisar: titulares sin viviendas o que no alcanzan para sus visitas
#     (ADR 0116, `hojas_ruta_capacidad_manzana`);
#   - distancia del NSE de las titulares al esperado: con PPS por viviendas, la
#     participación esperada de cada nivel es su participación en las viviendas del
#     marco elegible; se reporta la distancia de variación total (0 = igual);
#   - mediana de viviendas de las titulares;
#   - cercanía: distancia media de cada titular a la más cercana de su distrito, en km.
# Elegir una semilla no cambia el diseño (todas son sorteos válidos del mismo marco):
# sólo evita sortear una muestra con problemas operativos visibles. El ADR 0115 ya
# fija que el resultado se guarda con su semilla y es reproducible.

HOJAS_RUTA_SEMILLAS_MAX <- 5L

.hojas_ruta_cs_km <- function(lon1, lat1, lon2, lat2) {
  rad <- pi / 180
  dlat <- (lat2 - lat1) * rad
  dlon <- (lon2 - lon1) * rad
  a <- sin(dlat / 2)^2 + cos(lat1 * rad) * cos(lat2 * rad) * sin(dlon / 2)^2
  6371 * 2 * atan2(sqrt(a), sqrt(1 - a))
}

# Distancia media de cada titular a la más cercana de su mismo distrito.
.hojas_ruta_cs_cercania <- function(bloques, puntos) {
  if (!nrow(bloques)) return(NA_real_)
  ix <- match(as.character(bloques$id_manzana), as.character(puntos$id_manzana))
  lon <- puntos$lon[ix]; lat <- puntos$lat[ix]
  d <- c()
  for (u in unique(as.character(bloques$ubigeo))) {
    sel <- which(as.character(bloques$ubigeo) == u & !is.na(lon) & !is.na(lat))
    if (length(sel) < 2L) next
    for (i in sel) {
      otros <- setdiff(sel, i)
      d <- c(d, min(.hojas_ruta_cs_km(lon[i], lat[i], lon[otros], lat[otros])))
    }
  }
  if (!length(d)) NA_real_ else mean(d)
}

# Participación por nivel NSE: de las titulares (conteo) y esperada (viviendas del marco).
.hojas_ruta_cs_nse <- function(bloques, frame, puntos) {
  nivel <- function(ids) {
    v <- puntos$nse_nivel[match(as.character(ids), as.character(puntos$id_manzana))]
    v[is.na(v) | !nzchar(v) | v %in% c("NA", "NaN")] <- "S/D"
    v
  }
  esperado <- tapply(.hojas_ruta_me_num(frame$viviendas), nivel(frame$id_manzana), sum)
  esperado <- esperado / max(1, sum(esperado))
  obs <- table(factor(nivel(bloques$id_manzana), levels = names(esperado)))
  obs <- as.numeric(obs) / max(1, sum(obs))
  list(
    distancia = 0.5 * sum(abs(obs - as.numeric(esperado))),
    titulares = as.list(stats::setNames(round(obs, 4), names(esperado))),
    esperado = as.list(round(esperado, 4))
  )
}

#' Sorteos en seco con varias semillas (U13). No guarda nada en el run.
#'
#' @param config Config del run (la de la fase activa).
#' @param semillas Enteros; se agrega la semilla de la config si no está.
#' @param puntos Opcional, para no leer la cartografía (tests).
hojas_ruta_comparar_semillas <- function(config, semillas = integer(0), puntos = NULL) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  semillas <- unique(c(as.integer(cfg$seed), suppressWarnings(as.integer(unlist(semillas, use.names = FALSE)))))
  semillas <- semillas[!is.na(semillas)]
  if (length(semillas) > HOJAS_RUTA_SEMILLAS_MAX) semillas <- semillas[seq_len(HOJAS_RUTA_SEMILLAS_MAX)]
  frame <- .hojas_ruta_filter_frame(cfg)
  if (is.null(puntos)) {
    puntos <- do.call(rbind, c(
      list(data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))),
      lapply(unique(as.character(frame$ubigeo)), hojas_ruta_marco_elegible_puntos)
    ))
  }
  k <- .hojas_ruta_route_size(cfg)
  r <- as.numeric(cfg$sample_size$response_rate %||% 0.9)
  e <- as.numeric(cfg$sample_size$ocupacion %||% 1)
  modo <- as.character(cfg$route_jump_mode %||% "auto")
  salto <- as.integer(cfg$route_jump_manual %||% 1L)
  filas <- lapply(semillas, function(s) {
    c_s <- cfg
    c_s$seed <- s
    m <- hojas_ruta_sample_preview_integrado(c_s)
    b <- .hojas_ruta_rows_df(m$blocks %||% list())
    viv <- .hojas_ruta_me_num(b$viviendas)
    revisar <- if (nrow(b)) vapply(viv, function(v) v <= 0 || !hojas_ruta_capacidad_manzana(v, k, r, e, modo, salto)$alcanza, logical(1)) else logical(0)
    nse <- .hojas_ruta_cs_nse(b, frame, puntos)
    list(
      semilla = s,
      actual = identical(s, as.integer(cfg$seed)),
      titulares = nrow(b),
      por_revisar = sum(revisar),
      por_revisar_pct = if (nrow(b)) mean(revisar) else NA_real_,
      mediana_viviendas = if (nrow(b)) stats::median(viv) else NA_real_,
      nse_distancia = nse$distancia,
      nse_titulares = nse$titulares,
      nse_esperado = nse$esperado,
      cercania_km = .hojas_ruta_cs_cercania(b, puntos),
      sin_asignar = as.integer(m$unassigned %||% 0L)
    )
  })
  list(ok = TRUE, entrevistas_por_ruta = as.integer(k), semillas = filas)
}

#' Una semilla nueva al azar de cinco cifras, distinta de las dadas.
hojas_ruta_semillas_nuevas <- function(n = 2L, evitar = integer(0)) {
  out <- integer(0)
  while (length(out) < n) {
    s <- sample.int(90000L, 1L) + 9999L
    if (!s %in% c(evitar, out)) out <- c(out, s)
  }
  out
}
