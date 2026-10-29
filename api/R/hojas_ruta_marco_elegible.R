# Marco elegible de Hojas de ruta (ADR 0115).
#
# El sorteo usa como marco las manzanas INEI 2017 de los distritos confirmados.
# Este archivo depura ese marco con dos criterios declarados en la config del run
# (`integrated_config$marco_elegible`): un mínimo de viviendas y áreas excluidas
# con motivo. Todo lo excluido se cuenta, por distrito y por zona, para que la
# cobertura se informe en vez de quedar implícita en los reemplazos de campo.
#
# El motor congelado (`hojas_ruta_engine.R`) sólo llama a
# `hojas_ruta_marco_elegible_normalizar()` desde su normalizador y a
# `hojas_ruta_marco_elegible_aplicar()` desde `.hojas_ruta_filter_frame()`.

HOJAS_RUTA_ME_MOTIVOS <- c("inseguridad", "no_residencial", "inaccesible", "otro")
# Motivos que dejan fuera a hogares vulnerables: exigen fuente y fecha de la evidencia.
HOJAS_RUTA_ME_MOTIVOS_CON_EVIDENCIA <- c("inseguridad", "inaccesible")
# Caja de Lima Metropolitana y Callao en lon/lat, con holgura.
HOJAS_RUTA_ME_CAJA <- c(lon_min = -77.40, lon_max = -76.55, lat_min = -12.60, lat_max = -11.55)
HOJAS_RUTA_ME_MINIMO_NUEVO <- 1L

.hojas_ruta_me_alerta <- function(code, message, ...) {
  c(list(level = "warn", code = code, message = message), list(...))
}

.hojas_ruta_me_texto <- function(x) {
  v <- if (is.null(x) || !length(x)) "" else as.character(x[[1]])
  if (is.na(v)) "" else trimws(v)
}

# Matriz n×2 lon/lat desde lo que llegue del JSON: lista de pares, matriz o data.frame.
.hojas_ruta_me_matriz <- function(coords) {
  if (is.null(coords) || !length(coords)) return(NULL)
  m <- if (is.matrix(coords)) coords else if (is.data.frame(coords)) as.matrix(coords) else
    tryCatch(do.call(rbind, lapply(coords, function(p) as.numeric(unlist(p))[1:2])), error = function(e) NULL)
  if (is.null(m) || ncol(m) < 2L) return(NULL)
  m <- matrix(suppressWarnings(as.numeric(m[, 1:2])), ncol = 2L)
  m <- m[stats::complete.cases(m), , drop = FALSE]
  if (!nrow(m)) NULL else m
}

.hojas_ruta_me_en_caja <- function(m) {
  m[, 1] >= HOJAS_RUTA_ME_CAJA[["lon_min"]] & m[, 1] <= HOJAS_RUTA_ME_CAJA[["lon_max"]] &
    m[, 2] >= HOJAS_RUTA_ME_CAJA[["lat_min"]] & m[, 2] <= HOJAS_RUTA_ME_CAJA[["lat_max"]]
}

# Anillo canónico: lon/lat (corrige el orden invertido), redondeado a 1e-6 y cerrado.
.hojas_ruta_me_canonizar_anillo <- function(coords) {
  m <- .hojas_ruta_me_matriz(coords)
  if (is.null(m)) return(list(anillo = NULL, invertido = FALSE))
  invertido <- FALSE
  if (!any(.hojas_ruta_me_en_caja(m)) && any(.hojas_ruta_me_en_caja(m[, 2:1, drop = FALSE]))) {
    m <- m[, 2:1, drop = FALSE]
    invertido <- TRUE
  }
  m <- round(m, 6)
  if (nrow(m) && any(m[1, ] != m[nrow(m), ])) m <- rbind(m, m[1, ])
  distintos <- nrow(unique(m[-nrow(m), , drop = FALSE]))
  list(anillo = if (distintos >= 3L) m else NULL, invertido = invertido)
}

#' Normaliza `marco_elegible` de la config del run (ADR 0115 §1-§2).
#'
#' Sin la clave, la corrida es legacy: `declarado = FALSE`, mínimo 0 y sin áreas,
#' así que su marco no cambia. Lo inválido se descarta con un aviso en el
#' atributo `alertas`; nunca falla.
hojas_ruta_marco_elegible_normalizar <- function(x = NULL) {
  alertas <- list()
  if (is.null(x) || !is.list(x) || !length(x)) {
    out <- list(declarado = FALSE, minimo_viviendas = 0L, areas_excluidas = list())
    attr(out, "alertas") <- alertas
    return(out)
  }
  minimo <- suppressWarnings(as.integer(x$minimo_viviendas %||% HOJAS_RUTA_ME_MINIMO_NUEVO))
  if (length(minimo) != 1L || is.na(minimo) || minimo < 0L) {
    alertas[[length(alertas) + 1L]] <- .hojas_ruta_me_alerta(
      "W_ELIGIBILITY_MINIMUM_INVALID",
      sprintf("El mínimo de viviendas no es un entero positivo; se usa %d.", HOJAS_RUTA_ME_MINIMO_NUEVO)
    )
    minimo <- HOJAS_RUTA_ME_MINIMO_NUEVO
  }
  areas <- list()
  crudas <- x$areas_excluidas %||% list()
  if (is.data.frame(crudas)) crudas <- lapply(seq_len(nrow(crudas)), function(i) as.list(crudas[i, , drop = FALSE]))
  for (i in seq_along(crudas)) {
    a <- crudas[[i]]
    if (!is.list(a)) next
    id <- .hojas_ruta_me_texto(a$id)
    if (!nzchar(id)) id <- sprintf("area-%d", i)
    motivo <- .hojas_ruta_me_texto(a$motivo)
    detalle <- .hojas_ruta_me_texto(a$detalle)
    fuente <- .hojas_ruta_me_texto(a$fuente)
    fecha <- .hojas_ruta_me_texto(a$fecha_evidencia)
    descarte <- function(motivo_aviso) {
      alertas[[length(alertas) + 1L]] <<- .hojas_ruta_me_alerta(
        "W_EXCLUDED_AREA_DISCARDED", sprintf("El área «%s» no se aplica: %s.", id, motivo_aviso), area = id
      )
    }
    if (!motivo %in% HOJAS_RUTA_ME_MOTIVOS) { descarte("su motivo no está en la lista"); next }
    if (identical(motivo, "otro") && !nzchar(detalle)) { descarte("el motivo «otro» necesita un detalle"); next }
    if (motivo %in% HOJAS_RUTA_ME_MOTIVOS_CON_EVIDENCIA && (!nzchar(fuente) || !nzchar(fecha))) {
      descarte("falta la fuente o la fecha de la evidencia"); next
    }
    can <- .hojas_ruta_me_canonizar_anillo(a$poligono)
    if (is.null(can$anillo)) { descarte("el polígono necesita al menos tres vértices"); next }
    if (isTRUE(can$invertido)) {
      alertas[[length(alertas) + 1L]] <- .hojas_ruta_me_alerta(
        "W_EXCLUDED_AREA_SWAPPED", sprintf("El área «%s» venía con latitud y longitud invertidas; se corrigió.", id), area = id
      )
    }
    if (!any(.hojas_ruta_me_en_caja(can$anillo))) {
      alertas[[length(alertas) + 1L]] <- .hojas_ruta_me_alerta(
        "W_EXCLUDED_AREA_OUTSIDE", sprintf("El área «%s» queda fuera de Lima y Callao: no excluye ninguna manzana.", id), area = id
      )
    }
    areas[[length(areas) + 1L]] <- list(
      id = id, motivo = motivo, detalle = detalle, fuente = fuente, fecha_evidencia = fecha,
      poligono = lapply(seq_len(nrow(can$anillo)), function(k) as.numeric(can$anillo[k, ])),
      creada = .hojas_ruta_me_texto(a$creada)
    )
  }
  out <- list(declarado = TRUE, minimo_viviendas = minimo, areas_excluidas = areas)
  attr(out, "alertas") <- alertas
  out
}

# ---------- Geometría: punto interior y punto en polígono ----------

# Punto sobre un segmento (borde), con tolerancia de 1e-9 grados.
.hojas_ruta_me_en_borde <- function(x, y, m) {
  for (k in seq_len(nrow(m) - 1L)) {
    x1 <- m[k, 1]; y1 <- m[k, 2]; x2 <- m[k + 1L, 1]; y2 <- m[k + 1L, 2]
    cruz <- (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if (abs(cruz) <= 1e-9 && x >= min(x1, x2) - 1e-9 && x <= max(x1, x2) + 1e-9 &&
        y >= min(y1, y2) - 1e-9 && y <= max(y1, y2) + 1e-9) return(TRUE)
  }
  FALSE
}

# Dentro por cruce de rayos; el borde cuenta como dentro (ADR 0115 §1: el borde excluye).
.hojas_ruta_me_punto_en_anillo <- function(x, y, m) {
  if (.hojas_ruta_me_en_borde(x, y, m)) return(TRUE)
  dentro <- FALSE
  n <- nrow(m)
  j <- n
  for (i in seq_len(n)) {
    xi <- m[i, 1]; yi <- m[i, 2]; xj <- m[j, 1]; yj <- m[j, 2]
    if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro <- !dentro
    j <- i
  }
  dentro
}

#' Punto interior garantizado (point-on-surface) de un anillo lon/lat, sin `sf`.
#'
#' El centroide de área si cae dentro; si no (manzana cóncava), el punto medio
#' del tramo interior más largo de la horizontal que pasa por el centroide.
hojas_ruta_marco_elegible_punto_interior <- function(m) {
  m <- .hojas_ruta_me_matriz(m)
  if (is.null(m) || nrow(m) < 3L) return(c(NA_real_, NA_real_))
  if (any(m[1, ] != m[nrow(m), ])) m <- rbind(m, m[1, ])
  x <- m[, 1]; y <- m[, 2]; n <- nrow(m)
  a <- x[-n] * y[-1] - x[-1] * y[-n]
  area <- sum(a) / 2
  c0 <- if (abs(area) > 1e-15) c(sum((x[-n] + x[-1]) * a) / (6 * area), sum((y[-n] + y[-1]) * a) / (6 * area)) else c(mean(x[-n]), mean(y[-n]))
  if (.hojas_ruta_me_punto_en_anillo(c0[1], c0[2], m) && !.hojas_ruta_me_en_borde(c0[1], c0[2], m)) return(c0)
  # Horizontal por el centroide, apenas corrida para no pasar por un vértice.
  yh <- c0[2] + 1e-10
  cortes <- numeric(0)
  for (k in seq_len(n - 1L)) {
    y1 <- y[k]; y2 <- y[k + 1L]
    if ((y1 > yh) != (y2 > yh)) cortes <- c(cortes, x[k] + (yh - y1) * (x[k + 1L] - x[k]) / (y2 - y1))
  }
  cortes <- sort(cortes)
  if (length(cortes) < 2L) return(c(mean(x[-n]), mean(y[-n])))
  pares <- matrix(cortes[seq_len(2L * (length(cortes) %/% 2L))], ncol = 2L, byrow = TRUE)
  mejor <- which.max(pares[, 2] - pares[, 1])
  c(mean(pares[mejor, ]), yh)
}

# Anillo exterior más grande de una geometría GeoJSON (Polygon o MultiPolygon).
.hojas_ruta_me_anillo_exterior <- function(geom) {
  tipo <- .hojas_ruta_me_texto(geom$type)
  coords <- geom$coordinates
  candidatos <- if (identical(tipo, "Polygon")) list(coords[[1]]) else if (identical(tipo, "MultiPolygon")) lapply(coords, function(p) p[[1]]) else list()
  mats <- Filter(Negate(is.null), lapply(candidatos, .hojas_ruta_me_matriz))
  if (!length(mats)) return(NULL)
  areas <- vapply(mats, function(m) abs(sum(m[-nrow(m), 1] * m[-1, 2] - m[-1, 1] * m[-nrow(m), 2])), numeric(1))
  mats[[which.max(areas)]]
}

.hojas_ruta_me_puntos_cache <- new.env(parent = emptyenv())

#' Punto interior y NSE de cada manzana de un distrito, desde la cartografía.
#'
#' El marco `current` no trae coordenadas: salen de las mismas features que usa
#' `hojas_ruta_geometria_compacta()` (`hojas_ruta_block_map_preview`).
hojas_ruta_marco_elegible_puntos <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  cache <- .hojas_ruta_me_puntos_cache[[ubigeo]]
  if (!is.null(cache)) return(cache)
  vacio <- data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0), stringsAsFactors = FALSE)
  bloques <- tryCatch(hojas_ruta_block_map_preview(ubigeo, limit = 0L), error = function(e) NULL)
  feats <- if (isTRUE(bloques$ok)) bloques$geojson$features %||% list() else list()
  if (!length(feats)) return(vacio)
  filas <- lapply(feats, function(f) {
    p <- f$properties %||% list()
    m <- .hojas_ruta_me_anillo_exterior(f$geometry %||% list())
    pt <- if (is.null(m)) c(NA_real_, NA_real_) else hojas_ruta_marco_elegible_punto_interior(m)
    list(as.character(p$ID_MANZANA %||% p$inei_id_manzana %||% ""), pt[1], pt[2], .hojas_ruta_me_texto(p$nse_nivel))
  })
  out <- data.frame(
    id_manzana = vapply(filas, `[[`, character(1), 1L),
    lon = vapply(filas, function(r) as.numeric(r[[2]]), numeric(1)),
    lat = vapply(filas, function(r) as.numeric(r[[3]]), numeric(1)),
    nse_nivel = vapply(filas, `[[`, character(1), 4L),
    stringsAsFactors = FALSE
  )
  out <- out[nzchar(out$id_manzana) & !duplicated(out$id_manzana), , drop = FALSE]
  assign(ubigeo, out, envir = .hojas_ruta_me_puntos_cache)
  out
}

# ---------- Aplicar ----------

.hojas_ruta_me_num <- function(x) {
  v <- suppressWarnings(as.numeric(x))
  v[is.na(v)] <- 0
  v
}

.hojas_ruta_me_resumir <- function(frame, criterio, sin_conteo, sin_geo, por) {
  claves <- if (identical(por, "zona")) c("ubigeo", "zona") else "ubigeo"
  if (!nrow(frame)) return(list())
  grupo <- do.call(paste, c(frame[claves], sep = "|"))
  viv <- .hojas_ruta_me_num(frame$viviendas)
  pob <- .hojas_ruta_me_num(frame$poblacion)
  lapply(split(seq_len(nrow(frame)), factor(grupo, levels = unique(grupo))), function(ix) {
    cuenta <- function(sel) list(manzanas = length(sel), viviendas = sum(viv[sel]), poblacion = sum(pob[sel]))
    elegible <- ix[criterio[ix] == "elegible"]
    total <- cuenta(ix)
    fila <- list(
      ubigeo = as.character(frame$ubigeo[ix[1]]),
      distrito = as.character(frame$distrito[ix[1]] %||% ""),
      total = total,
      elegible = cuenta(elegible),
      excluida_area = cuenta(ix[criterio[ix] == "area"]),
      excluida_minimo = cuenta(ix[criterio[ix] == "minimo"]),
      excluida_minimo_sin_conteo = sum(criterio[ix] == "minimo" & sin_conteo[ix]),
      sin_geometria = sum(sin_geo[ix]),
      cobertura_poblacion = if (total$poblacion > 0) sum(pob[elegible]) / total$poblacion else NA_real_
    )
    if (identical(por, "zona")) fila$zona <- as.character(frame$zona[ix[1]])
    fila
  })
}

#' Aplica el marco elegible a un marco ya filtrado por territorio (ADR 0115 §1-§2).
#'
#' Precedencia: área excluida > mínimo de viviendas (el piloto va después, en el
#' motor). Devuelve el marco elegible, el criterio de cada manzana del marco de
#' entrada y el resumen por distrito y por zona. `puntos` (id_manzana, lon, lat,
#' nse_nivel) se puede pasar para no leer la cartografía; si falta y hay áreas,
#' se lee por distrito.
hojas_ruta_marco_elegible_aplicar <- function(frame, me = NULL, puntos = NULL) {
  me <- if (is.null(me) || is.null(me$declarado)) hojas_ruta_marco_elegible_normalizar(me) else me
  n <- nrow(frame)
  criterio <- rep("elegible", n)
  sin_geo <- rep(FALSE, n)
  areas <- me$areas_excluidas %||% list()
  minimo <- as.integer(me$minimo_viviendas %||% 0L)
  if (n && length(areas)) {
    if (is.null(puntos)) {
      puntos <- do.call(rbind, lapply(unique(as.character(frame$ubigeo)), hojas_ruta_marco_elegible_puntos))
    }
    ix <- match(as.character(frame$id_manzana), as.character(puntos$id_manzana))
    lon <- puntos$lon[ix]; lat <- puntos$lat[ix]
    sin_geo <- is.na(lon) | is.na(lat)
    anillos <- lapply(areas, function(a) .hojas_ruta_me_matriz(a$poligono))
    cajas <- lapply(anillos, function(m) c(range(m[, 1]), range(m[, 2])))
    for (i in which(!sin_geo)) {
      for (k in seq_along(anillos)) {
        cj <- cajas[[k]]
        if (lon[i] < cj[1] || lon[i] > cj[2] || lat[i] < cj[3] || lat[i] > cj[4]) next
        if (.hojas_ruta_me_punto_en_anillo(lon[i], lat[i], anillos[[k]])) { criterio[i] <- "area"; break }
      }
    }
  }
  viv <- .hojas_ruta_me_num(frame$viviendas)
  if (n && minimo > 0L) criterio[criterio == "elegible" & viv < minimo] <- "minimo"
  sin_conteo <- if ("match_level" %in% names(frame)) as.character(frame$match_level) %in% "sin_conteo_redatam" & viv == 0 else rep(FALSE, n)
  list(
    frame = frame[criterio == "elegible", , drop = FALSE],
    criterio = criterio,
    por_distrito = .hojas_ruta_me_resumir(frame, criterio, sin_conteo, sin_geo, "ubigeo"),
    por_zona = if ("zona" %in% names(frame)) .hojas_ruta_me_resumir(frame, criterio, sin_conteo, sin_geo, "zona") else list(),
    alertas = attr(me, "alertas") %||% list()
  )
}
