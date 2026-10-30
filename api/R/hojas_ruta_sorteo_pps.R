# Sorteo de las manzanas titulares de Hojas de ruta (ADR 0117, enmienda del ADR
# 0115 que aplica el ADR 0066 a Hojas de ruta).
#
# v1 («zona_mayor_resto_v1») repartía las rutas de cada distrito entre sus zonas
# censales con un redondeo de mayor resto DETERMINISTA y sorteaba dentro de cada
# zona. Con 40-199 zonas y ~25 rutas por distrito sólo las zonas más grandes
# recibían ruta: el resto tenía π = 0 en cualquier semilla (en acnur_acg, 24-70 %
# de las viviendas de cada distrito nunca podían salir).
#
# v2 («pps_sistematico_distrito_v2») hace UN sistemático por distrito sobre la
# lista ordenada por zona → manzana → id_manzana: la zona queda como estrato
# implícito y toda manzana con medida > 0 tiene π_i = n_d·M_i/M_d, con las
# certezas (π ≥ 1) tratadas por iteración. La medida que es NA o ≤ 0 pesa 0
# (ADR 0066: la medida no inventa). El método `sistematico` es el mismo recorrido
# con M_i = 1 (igual probabilidad). Con cuotas por zona (`row_var = "zona"`) el
# sistemático corre dentro de cada zona y las rutas se reparten entre zonas con
# redondeo aleatorio controlado, no truncando la cuota de las zonas chicas.

HOJAS_RUTA_ALGORITMO_SORTEO <- "pps_sistematico_distrito_v2"
HOJAS_RUTA_ALGORITMO_SORTEO_V1 <- "zona_mayor_resto_v1"

#' Medida con la que se sortea cada manzana: la `measure_var` en PPS (NA o ≤ 0
#' pesa 0) y 1 en el sistemático de igual probabilidad.
.hojas_ruta_sorteo_medida <- function(df, cfg) {
  if (!nrow(df)) return(numeric(0))
  if (identical(cfg$sampling_method, "sistematico")) return(rep(1, nrow(df)))
  m <- suppressWarnings(as.numeric(df[[cfg$measure_var]]))
  m[!is.finite(m) | m < 0] <- 0
  if (.hojas_ruta_sorteo_es_tope(cfg)) m <- .hojas_ruta_sorteo_topar(m, cfg)  # ADR 0120
  m
}

#' Candidatas a reemplazo: en PPS sólo las de medida > 0, como las titulares (el
#' sorteo de reemplazos imputaba peso 1 a M ≤ 0 y sacaba manzanas sin viviendas).
.hojas_ruta_sorteo_candidatos <- function(df, cfg) df[.hojas_ruta_sorteo_medida(df, cfg) > 0, , drop = FALSE]

#' π de cada manzana: n·M_i/ΣM con certezas por iteración, Σπ = n. M = 0 da π = 0;
#' si n alcanza a todas las manzanas con M > 0, todas son certeza.
.hojas_ruta_sorteo_pi <- function(m, n) {
  m <- suppressWarnings(as.numeric(m))
  m[!is.finite(m) | m < 0] <- 0
  n <- as.integer(n)
  positivas <- m > 0
  if (is.na(n) || n <= 0L || !any(positivas)) return(numeric(length(m)))
  if (n >= sum(positivas)) return(as.numeric(positivas))
  .cm_aulas_inclusion_probabilities(m, n)
}

#' Un sistemático PPS sobre `df` ordenado por zona → manzana → id_manzana.
#'
#' @return list(idx, pi, faltan, sin_medida): `idx` son filas de `df` en el orden
#'   de la lista; `pi` es la π de cada fila de `df`; `faltan` las rutas que no
#'   caben porque hay menos manzanas con medida > 0 que rutas.
.hojas_ruta_sorteo_pps_sistematico <- function(df, n, cfg) {
  N <- nrow(df)
  n <- max(0L, as.integer(n))
  pi <- numeric(N)
  if (!N || n <= 0L) return(list(idx = integer(0), pi = pi, faltan = n, sin_medida = FALSE))
  ord <- order(as.character(df$zona), as.character(df$manzana), as.character(df$id_manzana))
  m <- .hojas_ruta_sorteo_medida(df, cfg)[ord]
  positivas <- sum(m > 0)
  if (!positivas) return(list(idx = integer(0), pi = pi, faltan = n, sin_medida = TRUE))
  pik <- .hojas_ruta_sorteo_pi(m, min(n, positivas))
  # Mismo recorrido que el sistemático de Cálculo de muestra (UPsystematic): las
  # certezas salen sin sorteo y la caminata consume un único runif(0, 1).
  sel <- .cm_aulas_recorrido_sistematico(pik)$indices
  pi[ord] <- pik
  list(idx = ord[sel], pi = pi, faltan = max(0L, n - length(sel)), sin_medida = FALSE)
}

#' Rutas por zona cuando la cuota viene por zona: el total del distrito es
#' floor(Σn_z / k) y las fracciones se redondean con un sistemático de paso 1
#' (cada zona recibe ⌊x_z⌋ o ⌈x_z⌉ rutas, con E = x_z), en vez de truncar cada
#' zona por separado y perder la cuota de las chicas.
.hojas_ruta_sorteo_rutas_por_zona <- function(n_z, route_size) {
  n_z <- suppressWarnings(as.numeric(n_z))
  n_z[!is.finite(n_z) | n_z < 0] <- 0
  total <- as.integer(floor(sum(n_z) / route_size + 1e-9))
  if (!length(n_z) || total <= 0L) return(integer(length(n_z)))
  x <- total * n_z / sum(n_z)
  base <- floor(x + 1e-9)
  k <- as.integer(total - sum(base))
  if (k > 0L) {
    f <- pmax(0, x - base)
    marcas <- stats::runif(1, 0, 1) + seq_len(k) - 1
    # Una marca que el redondeo deja justo al final cae en la última zona con fracción.
    extra <- pmin(max(which(f > 0)), findInterval(marcas, c(0, cumsum(f)), rightmost.closed = TRUE))
    base[extra] <- base[extra] + 1
  }
  as.integer(base)
}

.hojas_ruta_sorteo_cuota_por_zona <- function(cells, ubigeo) {
  sel <- as.character(cells$ubigeo) == ubigeo
  if (!any(sel)) return(data.frame(zona = character(0), n = numeric(0)))
  zq <- stats::aggregate(cells$cuota[sel], by = list(zona = sub("^[^-]+-", "", as.character(cells$territorio[sel]))), FUN = sum, na.rm = TRUE)
  names(zq)[2] <- "n"
  zq
}

.hojas_ruta_sorteo_alerta <- function(level, code, message, ...) c(list(level = level, code = code, message = message), list(...))

#' % de las viviendas del marco elegible del distrito que están en zonas sin ruta
#' (`rutas` alineado con `zonas`). Es la cobertura que ningún sorteo recupera.
.hojas_ruta_sorteo_pct_sin_ruta <- function(df, zonas, rutas) {
  viv <- suppressWarnings(as.numeric(df$viviendas))
  viv[!is.finite(viv) | viv < 0] <- 0
  if (sum(viv) <= 0) return(0)
  sin_ruta <- as.character(zonas)[rutas <= 0L]
  100 * sum(viv[as.character(df$zona) %in% sin_ruta]) / sum(viv)
}

#' Muestras v1 con cuota por zona: aquella cuota repartía rutas entre zonas con
#' mayor resto determinista y las zonas con cuota 0 tenían π = 0 en cualquier
#' sorteo. La cuota actual reparte al azar (ADR 0117 §5), así que el aviso sólo
#' sale al cargar una muestra vieja y nombra la causa.
.hojas_ruta_sorteo_aviso_cuota_zona <- function(df, zonas, rutas, ubigeo, distrito) {
  pct <- .hojas_ruta_sorteo_pct_sin_ruta(df, zonas, rutas)
  if (pct <= 0) return(NULL)
  .hojas_ruta_sorteo_alerta(
    "warn", "W_ZONE_QUOTA_EXCLUDES_ZONES",
    sprintf("%s: la cuota por zona no asignó rutas a %d zona(s), con el %s %% de las viviendas del marco elegible del distrito; esas manzanas no pueden salir en ningún sorteo. La causa es el reparto de la cuota por zona.", distrito, as.integer(sum(rutas <= 0L)), format(round(pct, 1), nsmall = 1)),
    ubigeo = ubigeo, viviendas_sin_probabilidad_pct = round(pct, 1)
  )
}

#' Titulares de un distrito (sustituye el reparto por zonas de v1 en
#' `hojas_ruta_sample_preview_integrado`).
#'
#' @return list(blocks, alertas, sin_asignar) con las columnas de titular que el
#'   motor espera (territorio_muestral por zona, orden_seleccion dentro de la zona).
.hojas_ruta_sorteo_titulares_distrito <- function(district_frame, cells, ubigeo, n_district, route_size, cfg) {
  distrito <- if ("distrito" %in% names(district_frame)) as.character(district_frame$distrito[[1]]) else ubigeo
  cfg <- .hojas_ruta_sorteo_cfg_distrito(cfg, district_frame)
  alertas <- list()
  sin_asignar <- 0L
  medida <- if (identical(cfg$sampling_method, "sistematico")) "manzanas" else cfg$measure_var
  sortear <- function(df, n, donde) {
    s <- .hojas_ruta_sorteo_pps_sistematico(df, n, cfg)
    if (isTRUE(s$sin_medida)) {
      alertas[[length(alertas) + 1L]] <<- .hojas_ruta_sorteo_alerta(
        "error", "E_FRAME_WITHOUT_MEASURE",
        sprintf("%s: ninguna manzana del marco tiene %s mayor que 0; sus %d ruta(s) no se pueden sortear.", donde, medida, as.integer(n)),
        ubigeo = ubigeo
      )
    } else if (s$faltan > 0L) {
      alertas[[length(alertas) + 1L]] <<- .hojas_ruta_sorteo_alerta(
        "warn", "W_FRAME_INSUFFICIENT",
        sprintf("%s requiere %d ruta(s), pero el marco contiene %d manzana(s) con %s mayor que 0.", donde, as.integer(n), as.integer(n - s$faltan), medida),
        ubigeo = ubigeo
      )
    }
    sin_asignar <<- sin_asignar + as.integer(s$faltan * route_size)
    df[s$idx, , drop = FALSE]
  }
  if (identical(cfg$row_var, "zona")) {
    zq <- .hojas_ruta_sorteo_cuota_por_zona(cells, ubigeo)
    zonas <- sort(unique(as.character(district_frame$zona)))
    n_z <- zq$n[match(zonas, zq$zona)]
    n_z[is.na(n_z)] <- 0
    # Una zona sin rutas en esta cuota ya no tiene π = 0: la cuota las reparte al
    # azar (hojas_ruta_cuota_zona_aleatoria.R), así que no se avisa al sortear.
    rutas <- .hojas_ruta_sorteo_rutas_por_zona(n_z, route_size)
    resto <- as.integer(round(sum(n_z) - sum(rutas) * route_size))
    partes <- lapply(seq_along(zonas)[rutas > 0L], function(j) {
      sortear(district_frame[as.character(district_frame$zona) == zonas[[j]], , drop = FALSE], rutas[[j]], sprintf("%s zona %s", distrito, zonas[[j]]))
    })
    selected <- if (length(partes)) do.call(rbind, partes) else district_frame[0, , drop = FALSE]
  } else {
    route_total <- as.integer(n_district / route_size)
    resto <- as.integer(n_district - route_total * route_size)
    selected <- sortear(district_frame, route_total, distrito)
  }
  if (resto > 0L) {
    alertas[[length(alertas) + 1L]] <- .hojas_ruta_sorteo_alerta(
      "warn", "W_QUOTA_REMAINDER_UNROUTED",
      sprintf("%s: %d entrevista(s) de la cuota no completan una ruta de %d y quedan sin manzana.", distrito, resto, as.integer(route_size)),
      ubigeo = ubigeo, entrevistas = resto
    )
  }
  if (nrow(selected)) {
    selected$territorio_muestral <- paste(ubigeo, as.character(selected$zona), sep = "-")
    selected$metodo <- cfg$sampling_method
    selected$orden_seleccion <- as.integer(stats::ave(seq_len(nrow(selected)), as.character(selected$zona), FUN = seq_along))
    selected$entrevistas <- rep(as.integer(route_size), nrow(selected))
    selected$medida_tamano <- selected[[cfg$measure_var]]
    selected$tipo_manzana <- rep("titular", nrow(selected))
  }
  list(blocks = selected, alertas = alertas, sin_asignar = as.integer(sin_asignar))
}

#' π publicado de las titulares de un ámbito (distrito, o zona con cuota por zona),
#' con la misma fórmula del sorteo: n·M_i/ΣM con certezas, M ≤ 0 → 0.
#'
#' @param df Marco del ámbito. @param ids Titulares sorteadas en él.
#' @param ambito "distrito" o "zona".
.hojas_ruta_me_pi <- function(df, ids, cfg, ambito = "distrito") {
  m <- .hojas_ruta_sorteo_medida(df, cfg)
  n <- length(ids)
  pi <- .hojas_ruta_sorteo_pi(m, n)
  i <- match(as.character(ids), as.character(df$id_manzana))
  regla <- paste0(if (identical(cfg$sampling_method, "sistematico")) "igual_probabilidad_" else if (.hojas_ruta_sorteo_es_tope(cfg)) "pps_tope_" else "pps_sistematico_", ambito)
  # Con tope, `medida` es la del sorteo (M') y `medida_marco` la del marco (M).
  m_marco <- if (.hojas_ruta_sorteo_es_tope(cfg)) suppressWarnings(as.numeric(df[[cfg$measure_var]])) else NULL
  c(list(
    regla_pi = regla,
    probability_source = "formula",
    # M del ámbito del sorteo (el distrito, o la zona con cuota por zona), no de la zona.
    ambito = ambito,
    medida_total_ambito = sum(m),
    manzanas_sin_medida = as.integer(sum(m <= 0)),
    certezas = as.integer(sum(pi >= 1 - 1e-9)),
    seleccionadas = lapply(seq_along(ids), function(k) c(list(id_manzana = as.character(ids[[k]]), medida = m[i[[k]]], pi = pi[i[[k]]]), if (!is.null(m_marco)) list(medida_marco = m_marco[i[[k]]])))
  ), .hojas_ruta_sorteo_tope_publicado(df, cfg))
}

#' Aviso de una muestra sorteada con v1 (sin firma = v1). Por distrito, cuánto de
#' las viviendas de su marco elegible quedó en zonas que el reparto de v1 dejó sin
#' ruta (π = 0). Nunca vuelve a sortear: sólo marca la muestra y avisa una vez. Con
#' cuota por zona v1 y v2 cubren lo mismo (lo deja fuera la cuota, no el sorteo):
#' no se pide volver a sortear y se avisa la causa como en v2.
hojas_ruta_sorteo_aviso_v1 <- function(sample) {
  if (!is.list(sample) || !length(sample$blocks %||% list())) return(sample)
  if ((sample$algoritmo_sorteo %||% "") %in% .hojas_ruta_sorteo_firmas_vigentes()) return(sample)
  codigos <- vapply(sample$alerts %||% list(), function(a) as.character(a$code %||% ""), character(1))
  sample$algoritmo_sorteo <- HOJAS_RUTA_ALGORITMO_SORTEO_V1
  if (any(c("W_SAMPLE_DRAWN_WITH_V1", "W_ZONE_QUOTA_EXCLUDES_ZONES") %in% codigos)) return(sample)
  # El estado no se guarda en un GET (marcaría el proyecto como modificado), así que el
  # aviso se recalcula al cargar; lo caro (leer el marco) se memoriza por muestra.
  clave <- digest::digest(list(sample$config, sample$seed, sample$quota$cells, length(sample$blocks)), algo = "xxhash64")
  nuevas <- .hojas_ruta_sorteo_memo[[clave]] %||% .hojas_ruta_sorteo_avisos_v1(sample)
  assign(clave, nuevas, envir = .hojas_ruta_sorteo_memo)
  # Al frente: el panel del sorteo muestra sólo los primeros avisos y éste no puede quedar fuera.
  sample$alerts <- c(nuevas, sample$alerts %||% list())
  sample
}

.hojas_ruta_sorteo_memo <- new.env(parent = emptyenv())

.hojas_ruta_sorteo_avisos_v1 <- function(sample) {
  cfg <- hojas_ruta_integrada_normalize_config(sample$config %||% list())
  frame <- .hojas_ruta_filter_frame(cfg)
  cells <- .hojas_ruta_rows_df(sample$quota$cells %||% list())
  ruta <- .hojas_ruta_route_size(cfg)
  nuevas <- list()
  if (nrow(frame) && nrow(cells)) {
    por_distrito <- stats::aggregate(cells$cuota, by = list(ubigeo = as.character(cells$ubigeo)), FUN = sum, na.rm = TRUE)
    for (r in seq_len(nrow(por_distrito))) {
      u <- as.character(por_distrito$ubigeo[[r]])
      rutas <- as.integer(por_distrito$x[[r]] / ruta)
      df <- frame[as.character(frame$ubigeo) == u, , drop = FALSE]
      if (!nrow(df) || rutas <= 0L) next
      zf <- stats::aggregate(df[unique(c(cfg$measure_var, "viviendas"))], by = df["zona"], FUN = sum, na.rm = TRUE)
      nombre <- if ("distrito" %in% names(df)) as.character(df$distrito[[1]]) else u
      if (identical(cfg$row_var, "zona")) {
        zq <- .hojas_ruta_sorteo_cuota_por_zona(cells, u)
        n <- zq$n[match(zf$zona, zq$zona)]
        aviso <- .hojas_ruta_sorteo_aviso_cuota_zona(df, zf$zona, as.integer(ifelse(is.na(n), 0, n) / ruta), u, nombre)
        if (!is.null(aviso)) nuevas[[length(nuevas) + 1L]] <- aviso
        next
      }
      pct <- .hojas_ruta_sorteo_pct_sin_ruta(df, zf$zona, .hojas_ruta_allocate_integer(zf[[cfg$measure_var]], rutas))
      if (pct <= 0) next
      nuevas[[length(nuevas) + 1L]] <- .hojas_ruta_sorteo_alerta(
        "warn", "W_SAMPLE_DRAWN_WITH_V1",
        sprintf("%s: esta muestra se sorteó con un reparto por zonas que dejó sin probabilidad de salir al %s %% de las viviendas del marco elegible del distrito; vuelve a sortear antes de salir a campo.", nombre, format(round(pct, 1), nsmall = 1)),
        ubigeo = u, viviendas_sin_probabilidad_pct = round(pct, 1)
      )
    }
  }
  nuevas
}
