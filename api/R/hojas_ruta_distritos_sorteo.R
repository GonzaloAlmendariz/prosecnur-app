# =============================================================================
# hojas_ruta_distritos_sorteo.R — distritos de inclusión forzosa y distritos
# sorteados dentro de cada ciudad o área de Lima (ADR 0131 §1c, enmienda del 5/11)
# =============================================================================
#
# «Ir a un distrito solo para una encuesta es muy costoso, además cada ficha o
# ruta debe ser de un distrito en su totalidad» (Gonzalo, 5/11). Es la regla del
# §1b (`hojas_ruta_ciudades_sorteo.R`) un nivel más abajo. Rige con estrato
# provincia y la base de reparto 2025; `rutas_minimas_distrito = 0` la apaga y el
# estrato vuelve al redondeo sistemático del §1.
# =============================================================================

HOJAS_RUTA_RUTAS_MINIMAS_DISTRITO <- 3L

#' Campo `rutas_minimas_distrito` de `sample_size` (3 por defecto; 0 apaga el §1c).
#' Se suma desde `hojas_ruta_tamano_extras_normalizar()`.
hojas_ruta_distritos_normalizar <- function(x = NULL) {
  v <- if (is.list(x)) x$rutas_minimas_distrito else NULL
  v <- suppressWarnings(as.integer(if (is.null(v) || !length(v)) NA else unlist(v)[[1]]))
  if (is.na(v) || v < 0L) v <- HOJAS_RUTA_RUTAS_MINIMAS_DISTRITO
  list(rutas_minimas_distrito = v)
}

#' ¿Rige el §1c? Estrato provincia, base 2025 y mínimo ≥ 1. `params` es `cfg$sample_size`.
hojas_ruta_distritos_activo <- function(params) {
  hojas_ruta_estrato_activo(params) && hojas_ruta_reparto_base_activa(params) &&
    hojas_ruta_distritos_normalizar(params)$rutas_minimas_distrito >= 1L
}

#' Plan determinista del estrato (ciudad o área de Lima) con `n` rutas: qué distritos
#' entran con certeza, cuántos se sortean y con qué π_d. No sortea nada.
#'
#'   1. R_d = n · MOS_d / MOS_h (la medida del marco elegible: el estrato sigue
#'      autoponderado). Forzoso si R_d ≥ m.
#'   2. Los demás forman el grupo: h_g = max(1, ⌊R_g/m⌋), π_d = h_g · MOS_d / MOS_g.
#'      Un π_d ≥ 1 pasa a forzoso y el grupo se recalcula.
#'   3. Rutas enteras: proporcional con piso m por forzoso y m · h_g en el grupo
#'      (`.hojas_ruta_ciudades_reparto_con_piso`, mayor resto).
#'   4. Grupo con menos rutas que el mínimo (R_g < m, h_g = 1): el distrito sorteado
#'      recibe el mínimo y el exceso se descuenta de los forzosos de la misma ciudad
#'      (`regla = "minimo_descontado_de_forzosos"`). Si los forzosos no pueden ceder sin
#'      bajar del mínimo, el forzoso más chico pasa al grupo (`"forzoso_al_grupo"`).
#'      Con n < m todo el estrato es un grupo y su único distrito lleva las n rutas
#'      (`"estrato_bajo_minimo"`).
#'
#' @return list(condicion = "forzoso" | "candidato" | "sin_medida" por distrito,
#'   pi_distrito, rutas_fijas (las de los forzosos), h, rutas_grupo, reparto, regla).
hojas_ruta_distritos_plan <- function(mos, n, m) {
  mos <- suppressWarnings(as.numeric(mos))
  mos[!is.finite(mos) | mos < 0] <- 0
  k <- length(mos)
  n <- as.integer(n)
  vacio <- list(condicion = ifelse(mos > 0, "candidato", "sin_medida"), pi_distrito = numeric(k),
                rutas_fijas = integer(k), h = 0L, rutas_grupo = 0L, reparto = numeric(k), regla = "ordinaria")
  if (!k || is.na(n) || n <= 0L || sum(mos) <= 0) return(vacio)
  R <- n * mos / sum(mos)
  con_medida <- mos > 0
  forzoso <- con_medida & R >= m - 1e-9
  degradado <- rep(FALSE, k)
  regla <- "ordinaria"
  for (iter in seq_len(4L * k + 4L)) {
    ix <- which(!forzoso & con_medida)
    pi_d <- as.numeric(forzoso)
    h <- 0L
    if (length(ix)) {
      h <- max(1L, as.integer(floor(sum(R[ix]) / m + 1e-9)))
      h <- min(h, length(ix))
      pi_d[ix] <- h * mos[ix] / sum(mos[ix])
      # Un degradado no vuelve a forzoso (oscilaría): el grupo visita uno menos.
      while (h > 1L && any(degradado[ix] & pi_d[ix] >= 1 - 1e-9)) {
        h <- h - 1L
        pi_d[ix] <- h * mos[ix] / sum(mos[ix])
      }
      nuevas <- ix[!degradado[ix] & pi_d[ix] >= 1 - 1e-9]
      if (length(nuevas)) {
        forzoso[nuevas] <- TRUE
        next
      }
      if (sum(R[ix]) < m - 1e-9 && regla == "ordinaria") regla <- "minimo_descontado_de_forzosos"
    }
    piso <- c(rep(m, sum(forzoso)), if (length(ix)) m * h)
    if (sum(piso) <= n) break
    if (!any(forzoso)) {
      regla <- "estrato_bajo_minimo"
      break
    }
    j <- which(forzoso)[which.min(R[forzoso])]
    forzoso[j] <- FALSE
    degradado[j] <- TRUE
    regla <- "forzoso_al_grupo"
  }
  ix <- which(!forzoso & con_medida)
  w <- c(R[forzoso], if (length(ix)) sum(R[ix]))
  piso <- c(rep(m, sum(forzoso)), if (length(ix)) min(n, m * h))
  n_u <- if (identical(regla, "estrato_bajo_minimo")) n else .hojas_ruta_ciudades_reparto_con_piso(w, n, piso)
  rutas_fijas <- integer(k)
  rutas_fijas[forzoso] <- n_u[seq_len(sum(forzoso))]
  condicion <- ifelse(forzoso, "forzoso", ifelse(con_medida, "candidato", "sin_medida"))
  list(condicion = condicion, pi_distrito = pi_d, rutas_fijas = rutas_fijas, h = as.integer(h),
       rutas_grupo = if (length(ix)) as.integer(n_u[[length(n_u)]]) else 0L, reparto = R, regla = regla)
}

#' Sorteo de los distritos del estrato con `n` rutas: PPS sistemático de h_g distritos
#' del grupo (clave `distritos-<estrato>`) y reparto de las rutas del grupo entre los
#' sorteados, ⌊R_g/h_g⌋ o ⌈R_g/h_g⌉ (clave `distritos-rutas-<estrato>`).
#'
#' @return list(plan, rutas = entero por distrito, condicion = "forzoso" | "sorteado" |
#'   "no_sorteado" | "sin_medida").
hojas_ruta_distritos_sorteo <- function(mos, n, m, seed, estrato) {
  plan <- hojas_ruta_distritos_plan(mos, n, m)
  rutas <- plan$rutas_fijas
  condicion <- ifelse(plan$condicion == "candidato", "no_sorteado", plan$condicion)
  ix <- which(plan$condicion == "candidato")
  if (length(ix) && plan$h > 0L && plan$rutas_grupo > 0L) {
    sel <- .hojas_ruta_cuota_zona_rutas(mos[ix], plan$h, seed, paste0("distritos-", estrato)) > 0L
    rutas[ix[sel]] <- .hojas_ruta_cuota_zona_rutas(rep(1, sum(sel)), plan$rutas_grupo, seed, paste0("distritos-rutas-", estrato))
    condicion[ix[sel]] <- "sorteado"
  }
  list(plan = plan, rutas = as.integer(rutas), condicion = condicion)
}

#' Rutas esperadas del distrito condicionadas a que esté en la muestra: las fijas del
#' forzoso o R_g/h_g del sorteado (0 si no es visitable).
.hojas_ruta_distritos_esperado_cond <- function(plan) {
  ifelse(plan$condicion == "forzoso", plan$rutas_fijas,
         ifelse(plan$condicion == "candidato" & plan$h > 0L, plan$rutas_grupo / max(1L, plan$h), 0))
}

#' §1c dentro de `hojas_ruta_estrato_asignacion()`: sorteo de distritos de cada estrato
#' con sus rutas realizadas `n_h` y las dos ramas del diseño (⌊e_c⌋ y ⌈e_c⌉ rutas en una
#' ciudad sorteada; una sola rama, fija, en las forzosas) para la π exacta.
#'
#' @return list(rutas, columnas = data.frame(condicion_distrito, pi_distrito, pi_d_lo,
#'   e_lo, pi_d_hi, e_hi), grupos = una fila por estrato con rutas).
.hojas_ruta_distritos_asignacion <- function(estrato, estratos, mos, n_h, n_lo, f_n, cfg) {
  m <- hojas_ruta_distritos_normalizar(cfg$sample_size)$rutas_minimas_distrito
  seed <- cfg$seed %||% 2017L
  k <- length(estrato)
  rutas <- integer(k)
  col <- data.frame(condicion_distrito = rep("no_sorteado", k), pi_distrito = numeric(k), pi_d_lo = numeric(k),
                    e_lo = numeric(k), pi_d_hi = numeric(k), e_hi = numeric(k), stringsAsFactors = FALSE)
  grupos <- list()
  for (h in estratos) {
    idx <- which(estrato == h)
    lo <- hojas_ruta_distritos_plan(mos[idx], n_lo[idx][[1]], m)
    hi <- hojas_ruta_distritos_plan(mos[idx], n_lo[idx][[1]] + 1L, m)
    f <- f_n[idx][[1]]
    col$pi_d_lo[idx] <- lo$pi_distrito
    col$e_lo[idx] <- .hojas_ruta_distritos_esperado_cond(lo)
    col$pi_d_hi[idx] <- if (f > 1e-9) hi$pi_distrito else lo$pi_distrito
    col$e_hi[idx] <- if (f > 1e-9) .hojas_ruta_distritos_esperado_cond(hi) else col$e_lo[idx]
    col$pi_distrito[idx] <- (1 - f) * col$pi_d_lo[idx] + f * col$pi_d_hi[idx]
    if (n_h[[h]] <= 0L) next
    s <- hojas_ruta_distritos_sorteo(mos[idx], n_h[[h]], m, seed, h)
    rutas[idx] <- s$rutas
    col$condicion_distrito[idx] <- s$condicion
    p <- s$plan
    grupos[[length(grupos) + 1L]] <- data.frame(
      estrato = h, rutas = as.integer(n_h[[h]]), n_distritos = length(idx),
      n_forzosos = sum(p$condicion == "forzoso"), n_candidatos = sum(p$condicion == "candidato"),
      h = p$h, rutas_grupo = p$rutas_grupo, reparto_grupo = sum(p$reparto[p$condicion == "candidato"]),
      n_sorteados = sum(s$condicion == "sorteado"), regla = p$regla, stringsAsFactors = FALSE
    )
  }
  grupos <- if (length(grupos)) do.call(rbind, grupos) else
    data.frame(estrato = character(0), rutas = integer(0), n_distritos = integer(0), n_forzosos = integer(0),
               n_candidatos = integer(0), h = integer(0), rutas_grupo = integer(0), reparto_grupo = numeric(0),
               n_sorteados = integer(0), regla = character(0), stringsAsFactors = FALSE)
  list(rutas = as.integer(rutas), columnas = col, grupos = grupos)
}

#' π de la manzana con el §1c: π_c · Σ_ramas p · π_d · π_i|d. `a` es la fila del distrito
#' de `hojas_ruta_estrato_asignacion()$distritos`; `m` la medida del sorteo de sus manzanas.
hojas_ruta_distritos_pi <- function(m, a) {
  rama <- function(pd, e) if (pd <= 0 || e <= 0) numeric(length(m)) else pd * hojas_ruta_estrato_pi(m, e)
  lo <- rama(a$pi_d_lo, a$e_lo)
  cond <- if (a$f_n <= 1e-9) lo else (1 - a$f_n) * lo + a$f_n * rama(a$pi_d_hi, a$e_hi)
  a$pi_ciudad * cond
}

# ---------- La ruta queda en su distrito (ADR 0131 §1c) ----------
#
# La titular sale del PPS de su distrito y el reemplazo pareado de su misma zona
# (`ubigeo` + `zona`), así que la ruta no cruza el límite por construcción; el aviso
# es la red si alguna política lo rompiera. Las aledañas no son manzanas del sorteo
# sino una regla de campo: la ficha la dice con el distrito.

HOJAS_RUTA_REGLA_ALEDANAS_DISTRITO <- "Las manzanas aledañas son siempre del mismo distrito: no cruce al distrito vecino."

#' Aviso si algún reemplazo queda en otro distrito que su titular.
hojas_ruta_distritos_avisos_reemplazo <- function(blocks_df, replacement_blocks_df) {
  if (!is.data.frame(replacement_blocks_df) || !nrow(replacement_blocks_df) || !is.data.frame(blocks_df)) return(list())
  tit <- match(as.character(replacement_blocks_df$titular_id_manzana), as.character(blocks_df$id_manzana))
  cruza <- !is.na(tit) & as.character(replacement_blocks_df$ubigeo) != as.character(blocks_df$ubigeo[tit])
  if (!any(cruza)) return(list())
  list(list(
    level = "warn", code = "W_HOJAS_RUTA_REEMPLAZO_OTRO_DISTRITO",
    message = sprintf("%d reemplazo(s) están en otro distrito que su titular: la ruta debe quedar entera en el distrito de la titular.", sum(cruza)),
    reemplazos = as.integer(sum(cruza))
  ))
}


#' Lo que la vista previa del tamaño declara del §1c dentro de `estrato_muestral`:
#' el mínimo, la regla y, por ciudad o área, los forzosos y el sorteo. Vacío si no rige.
hojas_ruta_distritos_declaracion <- function(a) {
  if (is.null(a$grupos_distritos)) return(list())
  list(
    rutas_minimas_distrito = a$rutas_minimas_distrito,
    regla_distritos = paste(
      "ADR 0131 §1c: dentro de cada ciudad o área de Lima entra con certeza todo distrito cuyo reparto proporcional",
      "(n_h * MOS_d / MOS_h, marco elegible) alcanza el mínimo; los demás se sortean por PPS sistemático, con",
      "h_g = max(1, floor(R_g / mínimo)) distritos, pi_d = h_g * MOS_d / MOS_g, y R_g / h_g rutas por distrito sorteado.",
      "Un grupo con menos rutas que el mínimo recibe el mínimo descontado de los forzosos de la misma ciudad.",
      "La pi de la manzana es pi_c * pi_d * pi_manzana|distrito. La ruta, sus aledañas y su reemplazo quedan en el distrito."
    ),
    grupos_distritos = .hojas_ruta_df_rows(a$grupos_distritos)
  )
}

#' Frase de la memoria de cálculo para el §1c, o NULL si no rige. Reemplaza, en
#' `.reporte_mt_frase_estrato()`, la del redondeo sistemático entre distritos.
.reporte_mt_frase_distritos <- function(em) {
  grupos <- em$grupos_distritos %||% list()
  if (!length(grupos)) return(NULL)
  m <- as.integer(em$rutas_minimas_distrito %||% HOJAS_RUTA_RUTAS_MINIMAS_DISTRITO)
  campo <- function(g, k) as.character(g[[k]] %||% NA)[1]
  ent <- function(g, k) as.integer(g[[k]] %||% 0L)[1]
  grupos <- grupos[order(-vapply(grupos, function(g) ent(g, "rutas"), integer(1)))]
  por_area <- vapply(grupos, function(g) {
    base <- sprintf("%s, %d con certeza", campo(g, "etiqueta"), ent(g, "n_forzosos"))
    if (ent(g, "n_candidatos") > 0L) base <- sprintf("%s y %d sorteados entre %d", base, ent(g, "h"), ent(g, "n_candidatos"))
    base
  }, character(1))
  descontados <- vapply(Filter(function(g) campo(g, "regla") %in% c("minimo_descontado_de_forzosos", "forzoso_al_grupo"), grupos),
                        function(g) campo(g, "etiqueta"), character(1))
  paste(c(
    sprintf(paste(
      "Dentro de cada ciudad o área, todo distrito visitado recibe al menos %d rutas. Entra con certeza el distrito cuyo reparto proporcional",
      "a la medida de tamaño de sus manzanas del marco elegible alcanza ese mínimo; los demás se agrupan y se sortean, con probabilidad",
      "proporcional a su tamaño, tantos distritos como veces cabe el mínimo en las rutas del grupo, y cada distrito sorteado recibe la parte",
      "que le toca de esas rutas: %s."), m, paste(por_area, collapse = "; ")),
    if (length(descontados)) sprintf(
      "En %s las rutas del grupo no alcanzaban el mínimo: el distrito sorteado recibe el mínimo y la diferencia se descuenta de los distritos con certeza de la misma ciudad.",
      paste(descontados, collapse = ", ")) else NULL,
    paste(
      "Dentro del distrito la zona actúa como estrato implícito, y cada ruta, sus manzanas aledañas y su reemplazo quedan en el distrito de la titular.",
      "La probabilidad de inclusión de la manzana es la de su ciudad por la de su distrito dentro de la ciudad por la de la manzana dentro del distrito.")
  ), collapse = " ")
}
