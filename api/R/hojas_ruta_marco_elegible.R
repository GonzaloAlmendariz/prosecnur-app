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
  # Idempotente: un objeto ya normalizado como legacy (`declarado = FALSE`) sigue legacy.
  if (is.null(x) || !is.list(x) || !length(x) || isFALSE(as.logical(x$declarado %||% NA))) {
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
  # unname: una lista con nombres sale como objeto en el JSON, y el cliente espera un arreglo.
  unname(lapply(split(seq_len(nrow(frame)), factor(grupo, levels = unique(grupo))), function(ix) {
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
      excluida_piloto = cuenta(ix[criterio[ix] == "piloto"]),
      excluida_minimo_sin_conteo = sum(criterio[ix] == "minimo" & sin_conteo[ix]),
      sin_geometria = sum(sin_geo[ix]),
      cobertura_poblacion = if (total$poblacion > 0) sum(pob[elegible]) / total$poblacion else NA_real_
    )
    if (identical(por, "zona")) fila$zona <- as.character(frame$zona[ix[1]])
    fila
  }))
}

#' Aplica el marco elegible a un marco ya filtrado por territorio (ADR 0115 §1-§2).
#'
#' Precedencia: área excluida > mínimo de viviendas (el piloto va después, en el
#' motor). Devuelve el marco elegible, el criterio de cada manzana del marco de
#' entrada y el resumen por distrito y por zona. `puntos` (id_manzana, lon, lat,
#' nse_nivel) se puede pasar para no leer la cartografía; si falta y hay áreas,
#' se lee por distrito.
hojas_ruta_marco_elegible_aplicar <- function(frame, me = NULL, puntos = NULL, excluidas_piloto = character(0)) {
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
    # D4: si la manzana no cruza con la cartografía, la lat/lon del propio marco (el
    # `inei2017_official` las trae en todas sus filas; el `current` no).
    if (all(c("lon", "lat") %in% names(frame))) {
      falta <- is.na(lon) | is.na(lat)
      lon[falta] <- suppressWarnings(as.numeric(frame$lon[falta]))
      lat[falta] <- suppressWarnings(as.numeric(frame$lat[falta]))
    }
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
  # Tercer criterio (ADR 0115 §1): las titulares del piloto, sólo entre las que siguen
  # elegibles; el motor las quita después, así que aquí sólo las cuenta la vista previa.
  piloto <- unique(as.character(unlist(excluidas_piloto, use.names = FALSE)))
  if (n && length(piloto)) criterio[criterio == "elegible" & as.character(frame$id_manzana) %in% piloto] <- "piloto"
  sin_conteo <- if ("match_level" %in% names(frame)) as.character(frame$match_level) %in% "sin_conteo_redatam" & viv == 0 else rep(FALSE, n)
  alertas <- attr(me, "alertas") %||% list()
  if (length(areas) && any(sin_geo)) {
    alertas[[length(alertas) + 1L]] <- .hojas_ruta_me_alerta(
      "W_ELIGIBILITY_NO_GEOMETRY",
      sprintf("%d manzana(s) no tienen ubicación en la cartografía ni en el marco: las áreas excluidas no las alcanzan y se quedan en el marco.", sum(sin_geo)),
      manzanas = as.integer(sum(sin_geo))
    )
  }
  list(
    frame = frame[criterio == "elegible", , drop = FALSE],
    criterio = criterio,
    por_distrito = .hojas_ruta_me_resumir(frame, criterio, sin_conteo, sin_geo, "ubigeo"),
    por_zona = if ("zona" %in% names(frame)) .hojas_ruta_me_resumir(frame, criterio, sin_conteo, sin_geo, "zona") else list(),
    alertas = alertas
  )
}

# ---------- Reparto, vista previa y posproceso del sorteo (ADR 0115 §3, §5) ----------

#' Rutas por distrito y zona sobre el marco elegible, con la misma regla que el sorteo.
#'
#' Replica el reparto de `hojas_ruta_sample_preview_integrado` (engine ~5470-5500)
#' sin tocar el motor congelado: `route_total = n %/% ruta`; las rutas se reparten
#' por zona con `.hojas_ruta_allocate_integer` sobre la medida, o salen de la cuota
#' por zona cuando `row_var = "zona"`. Además devuelve las n que el sorteo descarta
#' sin aviso (distrito sin manzanas elegibles, zona con cuota y sin manzanas). El
#' test de paridad compara este reparto con las titulares que sortea el motor.
.hojas_ruta_me_reparto <- function(frame, cells, cfg) {
  ruta <- .hojas_ruta_route_size(cfg)
  if (!nrow(cells)) return(list(ruta = ruta, distritos = list(), perdidas = list()))
  por_distrito <- stats::aggregate(cells$cuota, by = list(ubigeo = as.character(cells$ubigeo)), FUN = sum, na.rm = TRUE)
  names(por_distrito)[2] <- "n"
  distritos <- list()
  perdidas <- list()
  medida <- cfg$measure_var
  for (i in seq_len(nrow(por_distrito))) {
    ubigeo <- as.character(por_distrito$ubigeo[[i]])
    n <- as.integer(por_distrito$n[[i]])
    if (is.na(n) || n <= 0L) next
    rutas <- as.integer(n / ruta)
    df <- frame[as.character(frame$ubigeo) == ubigeo, , drop = FALSE]
    if (!nrow(df)) {
      if (rutas > 0L) perdidas[[length(perdidas) + 1L]] <- list(ubigeo = ubigeo, zona = NA_character_, entrevistas = rutas * ruta, causa = "distrito_sin_manzanas")
      next
    }
    if (rutas <= 0L) next
    cols <- unique(c(medida, "poblacion", "viviendas"))
    zf <- stats::aggregate(df[cols], by = df[c("ubigeo", "distrito", "zona")], FUN = sum, na.rm = TRUE)
    zf <- zf[order(zf$zona), , drop = FALSE]
    if (identical(cfg$row_var, "zona")) {
      sel <- cells$ubigeo == ubigeo
      zq <- stats::aggregate(cells$cuota[sel], by = list(zona = sub("^[^-]+-", "", as.character(cells$territorio[sel]))), FUN = sum, na.rm = TRUE)
      names(zq)[2] <- "n"
      for (z in setdiff(zq$zona, zf$zona)) {
        r <- as.integer(zq$n[zq$zona == z] / ruta)
        if (r > 0L) perdidas[[length(perdidas) + 1L]] <- list(ubigeo = ubigeo, zona = z, entrevistas = r * ruta, causa = "zona_sin_manzanas")
      }
      zf <- merge(zf, zq, by = "zona", all.x = TRUE)
      zf$n[is.na(zf$n)] <- 0L
      zr <- as.integer(zf$n / ruta)
    } else {
      zr <- .hojas_ruta_allocate_integer(zf[[medida]], rutas)
    }
    manzanas <- vapply(as.character(zf$zona), function(z) sum(as.character(df$zona) == z), integer(1))
    distritos[[ubigeo]] <- list(
      ubigeo = ubigeo, distrito = as.character(zf$distrito[[1]]), entrevistas = n, rutas = rutas,
      zonas = lapply(seq_len(nrow(zf)), function(j) list(
        zona = as.character(zf$zona[[j]]), rutas = as.integer(zr[[j]]), manzanas = as.integer(manzanas[[j]]),
        medida_total = as.numeric(zf[[medida]][[j]])
      ))
    )
  }
  list(ruta = ruta, distritos = distritos, perdidas = perdidas)
}

# Perfil NSE (conteo de manzanas por nivel) de un subconjunto.
.hojas_ruta_me_perfil_nse <- function(ids, puntos) {
  niv <- puntos$nse_nivel[match(ids, puntos$id_manzana)]
  niv[is.na(niv) | !nzchar(niv) | niv %in% c("NA", "NaN")] <- "S/D"
  as.list(table(niv))
}

.hojas_ruta_me_hash <- function(x) digest::digest(x, algo = "sha256", serialize = TRUE)

#' Vista previa del marco elegible sin sortear (ADR 0115 §3-§4).
#'
#' Cobertura por distrito y zona, perfil NSE de lo excluido frente a lo elegible,
#' capacidad de cada zona frente a `rutas × (1 + reemplazos)` con el mismo reparto
#' del sorteo, y las alertas `W_ZONE_SHORT_BEFORE_DRAW`.
hojas_ruta_marco_elegible_preview <- function(config = list(), puntos = NULL) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  me <- cfg$marco_elegible
  territorio <- hojas_ruta_inei_frame(cfg$frame_source)
  territorio <- territorio[territorio$ubigeo %in% unlist(cfg$territorios, use.names = FALSE), , drop = FALSE]
  if (is.null(puntos)) puntos <- do.call(rbind, c(list(data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))), lapply(unique(as.character(territorio$ubigeo)), hojas_ruta_marco_elegible_puntos)))
  # D3: en Campo real también salen las titulares del piloto, como en el sorteo.
  ap <- hojas_ruta_marco_elegible_aplicar(territorio, me, puntos = puntos, excluidas_piloto = cfg$excluded_titular_ids %||% list())
  quota <- hojas_ruta_quota_preview_integrado(cfg)
  rep <- .hojas_ruta_me_reparto(ap$frame, .hojas_ruta_rows_df(quota$cells), cfg)
  reemplazos <- as.integer(cfg$replacements_per_titular %||% 0L)
  alertas <- ap$alertas
  capacidad <- list()
  for (d in rep$distritos) {
    for (z in d$zonas) {
      if (z$rutas <= 0L) next
      necesita <- z$rutas * (1L + reemplazos)
      falta <- if (z$manzanas < z$rutas) "titulares" else if (z$manzanas < necesita) "reemplazos" else NA_character_
      capacidad[[length(capacidad) + 1L]] <- list(ubigeo = d$ubigeo, distrito = d$distrito, zona = z$zona, rutas = z$rutas, manzanas = z$manzanas, necesita = necesita, falta = falta)
      if (!is.na(falta)) {
        alertas[[length(alertas) + 1L]] <- .hojas_ruta_me_alerta(
          "W_ZONE_SHORT_BEFORE_DRAW",
          if (identical(falta, "titulares")) sprintf("%s zona %s necesitará %d ruta(s) y sólo tiene %d manzana(s) elegible(s).", d$distrito, z$zona, z$rutas, z$manzanas)
          else sprintf("%s zona %s alcanza para sus %d titulares, pero no para %d reemplazo(s) por titular dentro de la zona (%d de %d manzanas).", d$distrito, z$zona, z$rutas, reemplazos, z$manzanas, necesita),
          ubigeo = d$ubigeo, zona = z$zona, falta = falta
        )
      }
    }
  }
  for (p in rep$perdidas) {
    alertas[[length(alertas) + 1L]] <- .hojas_ruta_me_alerta(
      "W_ZONE_SHORT_BEFORE_DRAW",
      sprintf("%s: %d entrevista(s) no tendrán manzanas elegibles%s.", p$ubigeo, p$entrevistas, if (is.na(p$zona)) "" else sprintf(" en la zona %s", p$zona)),
      ubigeo = p$ubigeo, zona = p$zona, falta = "titulares", entrevistas = p$entrevistas
    )
  }
  elegibles <- as.character(ap$frame$id_manzana)
  excluidas <- setdiff(as.character(territorio$id_manzana), elegibles)
  list(
    ok = TRUE,
    marco_elegible = me,
    por_distrito = ap$por_distrito,
    por_zona = ap$por_zona,
    nse = list(elegible = .hojas_ruta_me_perfil_nse(elegibles, puntos), excluida = .hojas_ruta_me_perfil_nse(excluidas, puntos)),
    capacidad = capacidad,
    alerts = alertas
  )
}

#' π de las titulares de una zona con la misma regla que `.hojas_ruta_sample_indices`
#' (engine ~4581): con el método sistemático cada manzana tiene la misma
#' probabilidad (π = n_z/N_z); en PPS la medida que es NA o ≤ 0 pesa 1, igual que
#' en el sorteo, y π ≈ n_z·M_i/ΣM_z. Si se sortearon todas las manzanas de la
#' zona (el motor capó a `nrow`), π = 1.
.hojas_ruta_me_pi <- function(df_z, ids, medida, metodo) {
  N <- nrow(df_z)
  n <- length(ids)
  m <- if (N) suppressWarnings(as.numeric(df_z[[medida]])) else numeric(0)
  ajustada <- any(is.na(m) | m <= 0)
  m[is.na(m) | m <= 0] <- 1
  total <- sum(m)
  regla <- if (n >= N && N > 0) "censo_de_la_zona" else if (identical(metodo, "sistematico")) "igual_probabilidad" else "pps"
  pis <- vapply(ids, function(id) {
    if (identical(regla, "censo_de_la_zona")) return(1)
    if (identical(regla, "igual_probabilidad")) return(n / N)
    mi <- m[match(id, as.character(df_z$id_manzana))]
    if (is.na(mi) || total <= 0) NA_real_ else min(1, n * mi / total)
  }, numeric(1), USE.NAMES = FALSE)
  list(
    regla_pi = regla,
    medida_total = total,
    medida_ajustada = ajustada,
    seleccionadas = lapply(seq_along(ids), function(i) list(id_manzana = ids[[i]], medida = m[match(ids[[i]], as.character(df_z$id_manzana))], pi = pis[[i]]))
  )
}

#' El marco elegible con el que se sorteó una muestra (ADR 0115 §5): los
#' reemplazos puntuales posteriores salen de ese marco, no de la config actual.
#' Si la config actual trae otros criterios, se avisa y se usan los de la muestra.
hojas_ruta_marco_elegible_de_la_muestra <- function(config, sample) {
  criterios <- sample$marco_elegible$criterios %||% NULL
  if (is.null(criterios)) return(list(config = config, alertas = list()))
  guardado <- hojas_ruta_marco_elegible_normalizar(criterios)
  actual <- config$marco_elegible %||% hojas_ruta_marco_elegible_normalizar(NULL)
  claves <- c("declarado", "minimo_viviendas", "areas_excluidas")
  alertas <- list()
  if (!identical(.hojas_ruta_me_hash(guardado[claves]), .hojas_ruta_me_hash(actual[claves]))) {
    alertas[[1]] <- .hojas_ruta_me_alerta(
      "W_ELIGIBILITY_DIFFERS_FROM_SAMPLE",
      "El marco elegible cambió después del sorteo: los reemplazos salen del marco con el que se sorteó la muestra."
    )
  }
  config$marco_elegible <- guardado
  list(config = config, alertas = alertas)
}

#' Posproceso del sorteo con marco elegible (ADR 0115 §3, §5).
#'
#' Suma a `E_UNASSIGNED_INTERVIEWS` las n que el motor descarta sin aviso y deja
#' en `resultado$marco_elegible` lo necesario para reconstruir π ≈ n_z·M_i/ΣM_z
#' por zona y verificar que el marco no cambió (hashes). No vuelve a sortear.
hojas_ruta_marco_elegible_completar <- function(resultado, config = NULL, avisos = list()) {
  # Los avisos de normalización (área descartada, polígono fuera) sólo existen al
  # normalizar el cuerpo CRUDO: `.hojas_ruta_effective_config_for_phase` re-normaliza
  # una config ya limpia y los pierde. El router los pasa explícitos en `avisos`.
  avisos_marco <- c(avisos %||% list(), attr(config$marco_elegible, "alertas") %||% list())
  cfg <- hojas_ruta_integrada_normalize_config(config %||% resultado$config %||% list())
  avisos_marco <- c(avisos_marco, attr(cfg$marco_elegible, "alertas") %||% list())
  frame <- .hojas_ruta_filter_frame(cfg)
  rep <- .hojas_ruta_me_reparto(frame, .hojas_ruta_rows_df(resultado$quota$cells %||% list()), cfg)
  perdidas <- sum(vapply(rep$perdidas, function(p) as.integer(p$entrevistas), integer(1)))
  if (perdidas > 0L) {
    alertas <- resultado$alerts %||% list()
    k <- which(vapply(alertas, function(a) identical(a$code, "E_UNASSIGNED_INTERVIEWS"), logical(1)))
    previas <- if (length(k)) as.integer(sub("^(\\d+).*$", "\\1", alertas[[k[1]]]$message)) else 0L
    total <- (if (is.na(previas)) 0L else previas) + perdidas
    nueva <- list(level = "error", code = "E_UNASSIGNED_INTERVIEWS",
                  message = sprintf("%d entrevista(s) no pudieron asignarse con los limites actuales.", total),
                  sin_manzanas_elegibles = rep$perdidas)
    if (length(k)) alertas[[k[1]]] <- nueva else alertas[[length(alertas) + 1L]] <- nueva
    resultado$alerts <- alertas
  }
  medida <- cfg$measure_var
  bloques <- .hojas_ruta_rows_df(resultado$blocks %||% list())
  zonas <- list()
  for (d in rep$distritos) for (z in d$zonas) {
    sel <- if (nrow(bloques)) as.character(bloques$ubigeo) == d$ubigeo & as.character(bloques$zona) == z$zona else logical(0)
    n_z <- sum(sel)
    df_z <- frame[as.character(frame$ubigeo) == d$ubigeo & as.character(frame$zona) == z$zona, , drop = FALSE]
    ids <- if (n_z) as.character(bloques$id_manzana[sel]) else character(0)
    zonas[[length(zonas) + 1L]] <- c(
      list(ubigeo = d$ubigeo, zona = z$zona, rutas = z$rutas, manzanas = nrow(df_z), sorteadas = n_z),
      .hojas_ruta_me_pi(df_z, ids, medida, cfg$sampling_method)
    )
  }
  # D5: el resumen por distrito y zona (por criterio) y los avisos del marco van con la muestra.
  territorio <- hojas_ruta_inei_frame(cfg$frame_source)
  territorio <- territorio[territorio$ubigeo %in% unlist(cfg$territorios, use.names = FALSE), , drop = FALSE]
  con_areas <- length(cfg$marco_elegible$areas_excluidas %||% list()) > 0L
  ap <- hojas_ruta_marco_elegible_aplicar(territorio, cfg$marco_elegible, excluidas_piloto = cfg$excluded_titular_ids %||% list())
  vistos <- vapply(resultado$alerts %||% list(), function(a) paste(a$code %||% "", a$message %||% ""), character(1))
  for (a in avisos_marco) {
    clave <- paste(a$code %||% "", a$message %||% "")
    if (!clave %in% vistos) {
      resultado$alerts <- c(resultado$alerts %||% list(), list(a))
      vistos <- c(vistos, clave)
    }
  }
  ruta_marco <- tryCatch(hojas_ruta_inei_frame_path(cfg$frame_source), error = function(e) "")
  elegibles_por_distrito <- lapply(split(as.character(frame$id_manzana), as.character(frame$ubigeo)), function(ids) .hojas_ruta_me_hash(sort(ids)))
  resultado$marco_elegible <- list(
    criterios = cfg$marco_elegible,
    medida = medida,
    pi_aproximacion = "pps: n_z * M_i / sum(M_z), aproximación del sorteo secuencial sin reemplazo (medida NA o <= 0 pesa 1, como en el sorteo); igual_probabilidad: n_z / N_z; censo_de_la_zona: 1",
    zonas = zonas,
    hash_marco = if (nzchar(ruta_marco) && file.exists(ruta_marco)) digest::digest(file = ruta_marco, algo = "sha256") else NA_character_,
    hash_criterios = .hojas_ruta_me_hash(cfg$marco_elegible[c("declarado", "minimo_viviendas", "areas_excluidas")]),
    hash_elegibles_por_distrito = elegibles_por_distrito,
    # La exclusión por área depende de la cartografía: su firma por distrito, sólo si hay áreas.
    firma_cartografia = if (con_areas) lapply(stats::setNames(nm = unique(as.character(territorio$ubigeo))), function(u) tryCatch(.hojas_ruta_geometria_firma(u), error = function(e) NA_character_)) else NULL,
    por_distrito = ap$por_distrito,
    por_zona = ap$por_zona
  )
  resultado
}

#' El marco elegible de una corrida de Campo real creada desde el piloto (ADR 0115,
#' Consecuencias y §5 Fases). Campo real siempre escribe el objeto explícito: si el
#' piloto ya lo tenía declarado, se copia tal cual (mismas áreas y mínimo); si era
#' legacy, Campo real adopta el mínimo 1 y se avisa que los dos marcos difieren,
#' porque sus probabilidades no son comparables y las bases no se juntan sin decirlo.
hojas_ruta_marco_elegible_para_campo <- function(marco_piloto = NULL) {
  me <- hojas_ruta_marco_elegible_normalizar(marco_piloto)
  if (isTRUE(me$declarado)) return(list(marco = me, alertas = list()))
  nuevo <- hojas_ruta_marco_elegible_normalizar(list(declarado = TRUE, minimo_viviendas = HOJAS_RUTA_ME_MINIMO_NUEVO, areas_excluidas = list()))
  list(
    marco = nuevo,
    alertas = list(.hojas_ruta_me_alerta(
      "W_FRAME_DIFFERS_PILOT_FIELD",
      "La piloto se sorteó sobre todas las manzanas y Campo real usa el marco elegible (mínimo 1 vivienda): sus probabilidades no son comparables y las dos bases no se juntan sin declararlo."
    ))
  )
}

#' Aviso de adopción (ADR 0115, Consecuencias): una corrida que pasa de legacy a
#' marco declarado cambia su marco, así que la misma semilla ya no repite la
#' muestra anterior. Se avisa una vez, en el sorteo que la adopta.
hojas_ruta_marco_elegible_aviso_adopcion <- function(marco_anterior = NULL, marco_nuevo = NULL) {
  antes <- hojas_ruta_marco_elegible_normalizar(marco_anterior)
  ahora <- hojas_ruta_marco_elegible_normalizar(marco_nuevo)
  if (isTRUE(antes$declarado) || !isTRUE(ahora$declarado)) return(list())
  list(.hojas_ruta_me_alerta(
    "W_FRAME_CHANGED_BY_ELIGIBILITY",
    sprintf("Este sorteo adopta el marco elegible (mínimo %d vivienda(s), %d área(s) excluida(s)): con la misma semilla ya no se repite la muestra anterior.", ahora$minimo_viviendas, length(ahora$areas_excluidas))
  ))
}
