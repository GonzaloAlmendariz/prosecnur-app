# Plan de campo y costo de Hojas de ruta (U14, plan B1).
#
# Con la muestra sorteada, agrupa las rutas en jornadas de un encuestador por
# cercanía dentro de cada distrito, y estima días y costo. Todo se mide en VISITAS
# (ADR 0116): una ruta de k entrevistas pide `visitas_esperadas` visitas, y una
# jornada tiene una capacidad de visitas, no de entrevistas.
#
# Es determinista: el orden sale de la geografía (vecino más cercano desde la
# titular más al oeste de cada distrito), no del azar. No cambia la muestra ni la
# guarda; los supuestos viven en `ui_state$plan_campo` (no en la config del motor).

HOJAS_RUTA_PLAN_DEFAULTS <- list(
  encuestadores = 4L,
  visitas_por_jornada = 30L,
  costo_por_entrevista = 0,
  costo_por_jornada = 0,
  costo_por_km = 0,
  moneda = "S/"
)

#' Supuestos del plan, con sus valores por defecto y acotados.
hojas_ruta_plan_campo_supuestos <- function(x = list()) {
  x <- if (is.list(x)) x else list()
  num <- function(v, def, min = 0) {
    n <- suppressWarnings(as.numeric(if (is.null(v) || !length(v)) NA else v[[1]]))
    if (is.na(n)) def else max(min, n)
  }
  list(
    encuestadores = as.integer(num(x$encuestadores, HOJAS_RUTA_PLAN_DEFAULTS$encuestadores, 1)),
    visitas_por_jornada = as.integer(num(x$visitas_por_jornada, HOJAS_RUTA_PLAN_DEFAULTS$visitas_por_jornada, 1)),
    costo_por_entrevista = num(x$costo_por_entrevista, 0),
    costo_por_jornada = num(x$costo_por_jornada, 0),
    costo_por_km = num(x$costo_por_km, 0),
    moneda = as.character(x$moneda %||% HOJAS_RUTA_PLAN_DEFAULTS$moneda)[1]
  )
}

# Orden de visita dentro de un distrito: vecino más cercano desde la más al oeste.
.hojas_ruta_plan_orden <- function(lon, lat) {
  n <- length(lon)
  if (n <= 1L) return(seq_len(n))
  con_pos <- which(!is.na(lon) & !is.na(lat))
  sin_pos <- setdiff(seq_len(n), con_pos)
  if (!length(con_pos)) return(seq_len(n))
  actual <- con_pos[which.min(lon[con_pos])]
  orden <- actual
  pendientes <- setdiff(con_pos, actual)
  while (length(pendientes)) {
    d <- .hojas_ruta_cs_km(lon[actual], lat[actual], lon[pendientes], lat[pendientes])
    actual <- pendientes[which.min(d)]
    orden <- c(orden, actual)
    pendientes <- setdiff(pendientes, actual)
  }
  c(orden, sin_pos)
}

#' Plan de campo: jornadas por cercanía, días y costo (U14).
#'
#' @param bloques Titulares de la muestra (lista de filas o data.frame), con
#'   `visitas_esperadas` (del posproceso del ADR 0116) o, si falta, `entrevistas`.
#' @param supuestos Ver `hojas_ruta_plan_campo_supuestos()`.
#' @param puntos data.frame id_manzana, lon, lat (punto interior de cada manzana).
hojas_ruta_plan_campo <- function(bloques, supuestos = list(), puntos = NULL) {
  s <- hojas_ruta_plan_campo_supuestos(supuestos)
  b <- .hojas_ruta_rows_df(bloques %||% list())
  vacio <- list(ok = TRUE, supuestos = s, jornadas = list(),
                alertas = list(), resumen = list(rutas = 0L, entrevistas = 0L, visitas = 0L, jornadas = 0L, dias = 0L, km = 0, costo = 0))
  if (!nrow(b)) return(vacio)
  if (is.null(puntos)) {
    puntos <- do.call(rbind, c(
      list(data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))),
      lapply(unique(as.character(b$ubigeo)), hojas_ruta_marco_elegible_puntos)
    ))
  }
  ix <- match(as.character(b$id_manzana), as.character(puntos$id_manzana))
  lon <- puntos$lon[ix]; lat <- puntos$lat[ix]
  entrevistas <- .hojas_ruta_me_num(b$entrevistas)
  visitas <- if ("visitas_esperadas" %in% names(b)) .hojas_ruta_me_num(b$visitas_esperadas) else entrevistas
  visitas[visitas <= 0] <- entrevistas[visitas <= 0]
  cap <- s$visitas_por_jornada
  jornadas <- list()
  for (u in unique(as.character(b$ubigeo))) {
    sel <- which(as.character(b$ubigeo) == u)
    orden <- sel[.hojas_ruta_plan_orden(lon[sel], lat[sel])]
    actual <- list(rutas = character(0), visitas = 0, km = 0, ultima = NA_integer_)
    cerrar <- function(equivalentes = 1L) {
      if (length(actual$rutas)) {
        jornadas[[length(jornadas) + 1L]] <<- list(
          id = sprintf("J%02d", length(jornadas) + 1L), ubigeo = u, distrito = as.character(b$distrito[sel[1]]),
          rutas = as.list(actual$rutas), visitas = as.integer(actual$visitas), km = round(actual$km, 2),
          excede_jornada = equivalentes > 1L, jornadas_equivalentes = as.integer(equivalentes)
        )
      }
      actual <<- list(rutas = character(0), visitas = 0, km = 0, ultima = NA_integer_)
    }
    for (i in orden) {
      v <- visitas[i]
      # Una ruta que no cabe en una jornada NO se parte: su recorrido sistemático es uno
      # solo y termina al lograr las k completas, así que va entera, con un mismo
      # encuestador en días consecutivos, y cuenta como varias jornadas equivalentes.
      if (v > cap) {
        cerrar()
        actual <- list(rutas = as.character(b$id_manzana[i]), visitas = v, km = 0, ultima = i)
        cerrar(equivalentes = as.integer(ceiling(v / cap)))
        next
      }
      if (actual$visitas + v > cap) cerrar()
      if (!is.na(actual$ultima) && !is.na(lon[i]) && !is.na(lon[actual$ultima])) {
        actual$km <- actual$km + .hojas_ruta_cs_km(lon[actual$ultima], lat[actual$ultima], lon[i], lat[i])
      }
      actual$rutas <- c(actual$rutas, as.character(b$id_manzana[i]))
      actual$visitas <- actual$visitas + v
      actual$ultima <- i
    }
    cerrar()
  }
  eq <- vapply(jornadas, function(j) as.integer(j$jornadas_equivalentes %||% 1L), integer(1))
  n_j <- sum(eq)
  km <- sum(vapply(jornadas, `[[`, numeric(1), "km"))
  total_entrevistas <- sum(entrevistas)
  largas <- Filter(function(j) isTRUE(j$excede_jornada), jornadas)
  alertas <- lapply(largas, function(j) list(
    code = "W_PLAN_RUTA_EXCEDE_JORNADA", severity = "warning",
    message = sprintf("La ruta %s pide %d visitas y no cabe en una jornada de %d: va entera, con el mismo encuestador %d días seguidos. Sube las visitas por jornada o baja las entrevistas por ruta.",
                      as.character(unlist(j$rutas))[1], j$visitas, cap, j$jornadas_equivalentes),
    ruta = as.character(unlist(j$rutas))[1]
  ))
  list(
    ok = TRUE,
    supuestos = s,
    jornadas = jornadas,
    alertas = alertas,
    resumen = list(
      rutas = nrow(b),
      entrevistas = as.integer(total_entrevistas),
      visitas = as.integer(sum(visitas)),
      jornadas = as.integer(n_j),
      # Una ruta de 3 jornadas exige al menos 3 días seguidos de la misma persona.
      dias = as.integer(max(ceiling(n_j / s$encuestadores), if (length(eq)) max(eq) else 0L)),
      km = round(km, 1),
      costo = round(total_entrevistas * s$costo_por_entrevista + n_j * s$costo_por_jornada + km * s$costo_por_km, 2)
    )
  )
}
