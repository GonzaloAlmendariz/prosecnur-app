# =============================================================================
# hojas_ruta_estrato.R — Estrato explícito provincia (ADR 0131 §1, paso 2)
# =============================================================================
#
# Con 225 rutas para 164 distritos, el distrito como estrato explícito deja
# distritos con 0 rutas (π = 0) o exige 164 rutas fijas. En este modo el estrato
# es la provincia (o, en Lima Metropolitana, una de sus cinco áreas
# interdistritales; Callao es su propia provincia) y distrito y zona quedan como
# estratos implícitos:
#
#   1. Rutas por estrato: n_h ≥ 2 (para estimar la varianza) y el resto en
#      proporción a P̂_h = Σ_d P̂_d (adultos urbanos 2025 con la base 2025; los
#      adultos 2017 del marco, pob17_en_capa · a17, con la base 2017).
#   2. Dentro del estrato, sobre la lista distrito (ubigeo) → zona → manzana, la
#      esperanza de rutas del distrito es e_d = n_h · MOS_d / MOS_h, con
#      MOS_d = Σ_i MOS_i de sus manzanas del marco elegible (el del sorteo). El
#      distrito recibe ⌊e_d⌋ o ⌈e_d⌉ por un redondeo sistemático aleatorio (una
#      sola uniforme por estrato, la misma regla que reparte rutas entre zonas):
#      E[n_d] = e_d y Σ_d n_d = n_h.
#   3. Dentro del distrito corre el PPS sistemático de siempre (ADR 0117), con
#      n_d rutas sobre la lista zona → manzana → id_manzana.
#
# La π de la manzana es la mezcla exacta de las dos ramas del redondeo:
#   π_i = (1 − f_d) · π_i(⌊e_d⌋) + f_d · π_i(⌈e_d⌉),   f_d = e_d − ⌊e_d⌋,
# y sin certezas se reduce a n_h · MOS_i / MOS_h. Ninguna manzana con medida > 0
# queda con π = 0: todo distrito con MOS_d > 0 tiene e_d > 0.
#
# Es un modo nuevo (`sample_size$estrato`), no reemplaza al de distrito, que sigue
# siendo el valor por defecto.
# =============================================================================

HOJAS_RUTA_ESTRATOS <- c("distrito", "provincia", "provincia_lima_areas")

# Lima Metropolitana en cinco áreas interdistritales (agrupación APEIM); Callao
# (0701) es su propia provincia y no entra aquí.
HOJAS_RUTA_LIMA_AREAS <- list(
  lima_norte = c("150102", "150106", "150110", "150112", "150117", "150125", "150135", "150139"),
  lima_este = c("150103", "150107", "150109", "150111", "150118", "150132", "150137"),
  lima_sur = c("150108", "150119", "150123", "150124", "150126", "150127", "150129", "150133",
               "150138", "150142", "150143"),
  lima_centro = c("150101", "150105", "150115", "150128", "150134"),
  lima_moderna = c("150104", "150113", "150114", "150116", "150120", "150121", "150122", "150130",
                   "150131", "150136", "150140", "150141")
)

#' Campo `estrato` de `sample_size`; se suma desde `hojas_ruta_tamano_extras_normalizar()`.
hojas_ruta_estrato_normalizar <- function(x = NULL) {
  v <- if (is.list(x)) x$estrato else NULL
  v <- as.character(if (is.null(v) || !length(v)) "distrito" else v[[1]])
  if (is.na(v) || !v %in% HOJAS_RUTA_ESTRATOS) v <- "distrito"
  list(estrato = v)
}

#' ¿Estrato explícito por encima del distrito? `params` es `cfg$sample_size`.
hojas_ruta_estrato_activo <- function(params) {
  is.list(params) && !is.null(params$estrato) && params$estrato %in% HOJAS_RUTA_ESTRATOS[-1]
}

#' ¿El estrato provincia rige el sorteo? Con N por distrito (`external_district`) las rutas
#' de cada distrito las fija el usuario y el sorteo es el del distrito, con su π.
hojas_ruta_estrato_vigente <- function(cfg) {
  hojas_ruta_estrato_activo(cfg$sample_size) && !identical(cfg$sample_size_mode, "external_district")
}

#' Estrato de cada ubigeo según el modo: el código de provincia (4 dígitos) o,
#' en `provincia_lima_areas`, `1501-<área>` para Lima Metropolitana.
hojas_ruta_estrato_de <- function(ubigeos, modo = "provincia") {
  ubigeos <- sprintf("%06s", as.character(ubigeos))
  h <- substr(ubigeos, 1L, 4L)
  if (identical(modo, "provincia_lima_areas")) {
    area <- rep(NA_character_, length(ubigeos))
    for (nm in names(HOJAS_RUTA_LIMA_AREAS)) area[ubigeos %in% HOJAS_RUTA_LIMA_AREAS[[nm]]] <- nm
    lima <- h == "1501"
    if (any(lima & is.na(area))) {
      stop_api(422, "E_HOJAS_RUTA_ESTRATO_SIN_AREA",
               sprintf("El distrito %s de Lima no tiene área interdistrital.", paste(ubigeos[lima & is.na(area)], collapse = ", ")))
    }
    h[lima] <- paste0("1501-", area[lima])
  }
  h
}

HOJAS_RUTA_LIMA_AREAS_ETIQUETAS <- c(lima_norte = "Lima Norte", lima_este = "Lima Este", lima_sur = "Lima Sur",
                                      lima_centro = "Lima Centro", lima_moderna = "Lima Moderna")

#' Rótulo legible de cada estrato: el área de Lima o el nombre de la provincia en el marco.
.hojas_ruta_estrato_etiquetas <- function(estratos, ubigeos, estrato, cfg) {
  frame <- tryCatch(hojas_ruta_inei_frame(cfg$frame_source), error = function(e) NULL)
  vapply(estratos, function(h) {
    if (startsWith(h, "1501-")) return(unname(HOJAS_RUTA_LIMA_AREAS_ETIQUETAS[substring(h, 6L)]) %||% h)
    u <- ubigeos[estrato == h][[1]]
    nom <- if (!is.null(frame) && "provincia" %in% names(frame)) as.character(frame$provincia[match(u, as.character(frame$ubigeo))]) else NA_character_
    if (is.na(nom) || !nzchar(nom)) h else tools::toTitleCase(tolower(nom))
  }, character(1), USE.NAMES = FALSE)
}

# Memo de la medida por distrito (el marco no cambia dentro de una corrida).
.hojas_ruta_estrato_memo <- new.env(parent = emptyenv())

#' MOS_d = Σ MOS_i de las manzanas del distrito en el marco ELEGIBLE, con la misma
#' medida del sorteo (`.hojas_ruta_sorteo_medida`: topada en `pps_tope`, × g_d con la
#' base 2025). El marco es el del sorteo (`.hojas_ruta_filter_frame`): sin las manzanas
#' bajo `minimo_viviendas`, las de áreas excluidas ni las titulares del piloto. Así e_d
#' reparte con lo que de verdad se puede sortear y el estrato sigue autoponderado.
.hojas_ruta_estrato_mos_distritos <- function(ubigeos, cfg) {
  cfg_f <- cfg
  cfg_f$territorios <- as.list(ubigeos)
  ss <- cfg$sample_size %||% list()
  key <- paste(c(sort(ubigeos), cfg$frame_source %||% "", cfg$sampling_method %||% "", cfg$measure_var %||% "",
                 ss$base_reparto %||% "", .hojas_ruta_me_hash(list(cfg$marco_elegible, cfg$excluded_titular_ids))),
               collapse = "|")
  hit <- .hojas_ruta_estrato_memo[[key]]
  if (!is.null(hit)) return(hit)
  frame <- .hojas_ruta_filter_frame(cfg_f)
  out <- vapply(ubigeos, function(u) {
    df <- frame[as.character(frame$ubigeo) == u, , drop = FALSE]
    if (!nrow(df)) return(0)
    sum(.hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df)))
  }, numeric(1))
  .hojas_ruta_estrato_memo[[key]] <- out
  out
}

#' Asignación del modo estrato: rutas por estrato y por distrito.
#'
#' @param ubigeos Distritos confirmados. @param route_total Rutas en total.
#' @return list(distritos = data.frame(ubigeo, estrato, mos, esperado, rutas),
#'   estratos = data.frame(estrato, n_distritos, poblacion, rutas)), o NULL si el
#'   estrato es el distrito.
hojas_ruta_estrato_asignacion <- function(ubigeos, route_total, cfg) {
  params <- cfg$sample_size
  if (!hojas_ruta_estrato_activo(params)) return(NULL)
  if (identical(cfg$row_var, "zona")) {
    stop_api(422, "E_HOJAS_RUTA_ESTRATO_CUOTA_ZONA",
             "Con estrato provincia la cuota es por distrito: la cuota por zona reparte las rutas con otra medida y la π dejaría de ser n·MOS/ΣMOS.")
  }
  ubigeos <- sort(unique(sprintf("%06s", as.character(ubigeos))))
  route_total <- as.integer(route_total)
  estrato <- hojas_ruta_estrato_de(ubigeos, params$estrato)
  ciudad <- substr(ubigeos, 1L, 4L)
  base <- hojas_ruta_reparto_base_distritos(ubigeos)
  pob <- if (hojas_ruta_reparto_base_activa(params)) base$p25 else base$pob17_en_capa * base$a17
  if (is.na(route_total) || route_total < 1L) {
    stop_api(422, "E_HOJAS_RUTA_ESTRATO_SIN_RUTAS", "El tamaño no da ninguna ruta completa.", details = list(rutas = route_total))
  }
  mos <- .hojas_ruta_estrato_mos_distritos(ubigeos, cfg)
  # ADR 0131 §1b: ciudades forzosas y sorteadas (hojas_ruta_ciudades_sorteo.R).
  sel <- hojas_ruta_ciudades_seleccion(ciudad, pob, mos, route_total, cfg)
  cc <- sel$ciudades
  ic <- match(ciudad, cc$ciudad)
  estratos <- sort(unique(estrato))
  # Rutas de cada estrato: la ciudad entera, o sus áreas (Lima) en proporción a su población.
  n_h <- stats::setNames(integer(length(estratos)), estratos)
  for (c in cc$ciudad) {
    hs <- sort(unique(estrato[ciudad == c]))
    w <- vapply(hs, function(h) sum(pob[estrato == h]), numeric(1))
    n_h[hs] <- if (length(hs) == 1L) cc$rutas[cc$ciudad == c] else .hojas_ruta_allocate_integer(w, cc$rutas[cc$ciudad == c])
  }
  mos_h <- vapply(estratos, function(h) sum(mos[estrato == h]), numeric(1))
  for (h in estratos[n_h[estratos] > 0L & mos_h <= 0]) {
    stop_api(422, "E_HOJAS_RUTA_ESTRATO_SIN_MEDIDA", sprintf("Ninguna manzana del estrato %s tiene medida mayor que 0.", h))
  }
  share <- ifelse(mos_h[estrato] > 0, mos / mos_h[estrato], 0)
  # Rutas del estrato como variable aleatoria: fijas en las forzosas; ⌊e⌋ o ⌈e⌉ con
  # E = n_g/h_g en las sorteadas (condicionadas a que la ciudad salió).
  sorteada <- cc$condicion[ic] != "forzosa"
  e_c <- cc$esperado[ic]
  n_lo <- ifelse(sorteada, floor(e_c + 1e-9), n_h[estrato])
  f_n <- ifelse(sorteada, e_c - n_lo, 0)
  rutas <- integer(length(ubigeos))
  for (h in estratos[n_h[estratos] > 0L]) {
    idx <- which(estrato == h)
    rutas[idx] <- .hojas_ruta_cuota_zona_rutas(mos[idx], n_h[[h]], cfg$seed %||% 2017L, paste0("estrato-", h))
  }
  pob_h <- vapply(estratos, function(h) sum(pob[estrato == h]), numeric(1))
  ce <- cc[match(vapply(estratos, function(h) ciudad[estrato == h][[1]], character(1)), cc$ciudad), , drop = FALSE]
  list(
    distritos = data.frame(ubigeo = ubigeos, estrato = estrato, ciudad = ciudad, grupo = cc$grupo[ic], condicion = cc$condicion[ic],
                           pi_ciudad = cc$pi_ciudad[ic], mos = mos, share = share,
                           esperado = cc$pi_ciudad[ic] * ((1 - f_n) * n_lo + f_n * (n_lo + 1)) * share,
                           n_lo = n_lo, n_hi = n_lo + 1, f_n = f_n, rutas = as.integer(rutas), stringsAsFactors = FALSE),
    estratos = data.frame(estrato = estratos, etiqueta = .hojas_ruta_estrato_etiquetas(estratos, ubigeos, estrato, cfg),
                          ciudad = ce$ciudad, condicion = ce$condicion, pi_ciudad = ce$pi_ciudad,
                          n_distritos = as.integer(table(estrato)[estratos]),
                          poblacion = as.numeric(pob_h), rutas = as.integer(n_h[estratos]), stringsAsFactors = FALSE),
    ciudades = cbind(cc, etiqueta = .hojas_ruta_estrato_etiquetas(cc$ciudad, ubigeos, ciudad, cfg), stringsAsFactors = FALSE),
    grupos = sel$grupos,
    rutas_minimas_ciudad = sel$rutas_minimas_ciudad
  )
}

#' Rutas por distrito en el orden de `ubigeos` (para los enganches del motor).
.hojas_ruta_estrato_rutas_en_orden <- function(ubigeos, route_total, cfg) {
  a <- hojas_ruta_estrato_asignacion(ubigeos, route_total, cfg)
  if (is.null(a)) return(NULL)
  as.integer(a$distritos$rutas[match(sprintf("%06s", as.character(ubigeos)), a$distritos$ubigeo)])
}

#' Entrevistas por distrito de la vista previa del tamaño en modo estrato: las mismas
#' rutas que la cuota que se sortea. NULL si no aplica (estrato distrito, N por
#' distrito o N que no es múltiplo de la ruta).
hojas_ruta_estrato_preview_rutas <- function(ubigeos, n_used, cfg, route_ok = TRUE) {
  if (!hojas_ruta_estrato_activo(cfg$sample_size) || !isTRUE(route_ok) ||
      identical(cfg$sample_size_mode, "external_district")) return(NULL)
  route_size <- .hojas_ruta_route_size(cfg)
  rutas <- .hojas_ruta_estrato_rutas_en_orden(ubigeos, as.integer(n_used) %/% route_size, cfg)
  as.integer(rutas * route_size)
}

#' π de la manzana en modo estrato: mezcla de π(⌊e_d⌋) y π(⌈e_d⌉) con peso f_d.
#' `m` es la medida del sorteo de las manzanas del distrito.
hojas_ruta_estrato_pi <- function(m, esperado) {
  lo <- floor(esperado + 1e-9)
  f <- esperado - lo
  pi_lo <- .hojas_ruta_sorteo_pi(m, lo)
  if (f <= 1e-9) return(pi_lo)
  (1 - f) * pi_lo + f * .hojas_ruta_sorteo_pi(m, lo + 1L)
}

#' Lo que la vista previa declara del estrato. Vacío con el estrato distrito.
hojas_ruta_estrato_declaracion <- function(ubigeos, cfg, n_used) {
  if (!hojas_ruta_estrato_activo(cfg$sample_size) || identical(cfg$sample_size_mode, "external_district")) return(list())
  route_size <- .hojas_ruta_route_size(cfg)
  a <- hojas_ruta_estrato_asignacion(ubigeos, as.integer(n_used) %/% route_size, cfg)
  list(estrato_muestral = list(
    modo = cfg$sample_size$estrato,
    rutas_minimas_ciudad = a$rutas_minimas_ciudad,
    regla = paste(
      "ADR 0131 §1b: entra con certeza toda ciudad cuyo reparto proporcional alcanza el mínimo de rutas (y siempre Lima",
      "Metropolitana y Callao); las demás se agrupan por macrorregión y se sortean por PPS, con h_g = max(1, floor(R_g / mínimo))",
      "ciudades por grupo, pi_c = h_g * MOS_c / MOS_g, y R_g / h_g rutas por ciudad sorteada. Dentro de la ciudad, cada distrito",
      "recibe floor o ceil de n_c * MOS_d / MOS_c (marco elegible) y la pi de la manzana es pi_c por la mezcla exacta de las",
      "ramas; sin certezas, en un grupo sorteado se reduce a n_g * MOS_i / MOS_g."
    ),
    estratos = .hojas_ruta_df_rows(a$estratos),
    ciudades = .hojas_ruta_df_rows(a$ciudades),
    grupos = .hojas_ruta_df_rows(a$grupos),
    distritos = .hojas_ruta_df_rows(a$distritos)
  ))
}
