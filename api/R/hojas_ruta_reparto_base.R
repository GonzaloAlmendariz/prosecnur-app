# =============================================================================
# hojas_ruta_reparto_base.R — Base de reparto 2025 por distrito (ADR 0131 §2, paso 1)
# =============================================================================
#
# El reparto de la muestra entre distritos sale hoy de la población 2017 del marco
# (la vista previa del tamaño con la población total de las manzanas; la cuota que
# se sortea con la de 18+ por sexo y edad simple). El CPV 2025 sólo existe por
# distrito (`pob25` en territorios.json, ADR 0119) y es población censada TOTAL:
# trae la parte rural y todas las edades. Por eso no se usa sin ajustar:
#
#   P̂25_d = pob25_d · u17_d · a17_d     (adultos urbanos estimados 2025)
#   u17_d = pob17_en_capa_d / pob17_redatam_d   fracción del distrito en el marco 2017
#   a17_d = proporción de 18+ en la edad simple 2017 del distrito
#
# u17 y a17 son SUPUESTOS que se declaran: la fracción urbana y la estructura de
# edad de 2017 se mantienen en 2025.
#
# Con la base activa:
#   - la vista previa y la cuota que se sortea reparten las rutas entre distritos
#     con la MISMA función (P̂25 y el mismo piso por distrito), así que coinciden
#     por distrito;
#   - las celdas sexo × edad 2017 del distrito se escalan por P̂25_d / pob18_17_d:
#     se conserva la estructura de la cuota y cambia el peso entre distritos;
#   - la medida de tamaño del PPS de manzanas es MOS_i = M_i · g_d, con
#     g_d = P̂25_d / pob17_en_capa_d, conocida antes del sorteo (π sigue exacta:
#     n·MOS_i/ΣMOS). Mientras el estrato sea el distrito, g_d es constante dentro
#     del estrato y la π no cambia; pesa cuando el estrato sea la provincia (paso 2).
#
# Apagada (valor por defecto `cpv2017`) nada cambia: ni estudios guardados ni envíos.
# Si falta un dato con la base activa, error E_HOJAS_RUTA_BASE_2025_INCOMPLETA;
# nunca un factor 1 silencioso.
# =============================================================================

HOJAS_RUTA_BASE_REPARTO_2017 <- "cpv2017"
HOJAS_RUTA_BASE_REPARTO_2025 <- "cpv2025_adultos_urbanos"
HOJAS_RUTA_BASES_REPARTO <- c(HOJAS_RUTA_BASE_REPARTO_2017, HOJAS_RUTA_BASE_REPARTO_2025)
HOJAS_RUTA_BASE_REPARTO_2025_FUENTE <- "CPV 2025 (supuestos u17, a17 de 2017)"

#' Campo `base_reparto` de `sample_size`; se suma desde `hojas_ruta_tamano_extras_normalizar()`.
hojas_ruta_reparto_base_normalizar <- function(x = NULL) {
  v <- if (is.list(x)) x$base_reparto else NULL
  v <- as.character(if (is.null(v) || !length(v)) HOJAS_RUTA_BASE_REPARTO_2017 else v[[1]])
  if (is.na(v) || !v %in% HOJAS_RUTA_BASES_REPARTO) v <- HOJAS_RUTA_BASE_REPARTO_2017
  list(base_reparto = v)
}

#' ¿Reparte con la base 2025? `params` es `cfg$sample_size`.
hojas_ruta_reparto_base_activa <- function(params) {
  is.list(params) && identical(params$base_reparto, HOJAS_RUTA_BASE_REPARTO_2025)
}

.hojas_ruta_rb_incompleta <- function(faltan) {
  stop_api(
    422, "E_HOJAS_RUTA_BASE_2025_INCOMPLETA",
    sprintf(
      "No se puede repartir con la población 2025: falta %s. Vuelve a la base 2017 o completa el registro de territorios.",
      paste(faltan, collapse = "; ")
    ),
    details = list(faltan = as.list(faltan))
  )
}

#' Insumos y resultado de la base 2025 por distrito.
#'
#' @param ubigeos Ubigeos 2017 de 6 dígitos (el 27xxxx del CPV 2025 ya se tradujo
#'   en el importador, ADR 0119 §6).
#' @return data.frame(ubigeo, pob25, pob17_redatam, pob17_en_capa, pob18_17, u17,
#'   a17, p25, g), una fila por ubigeo en el mismo orden.
hojas_ruta_reparto_base_distritos <- function(ubigeos) {
  ubigeos <- sprintf("%06s", as.character(ubigeos))
  if (!length(ubigeos)) {
    return(data.frame(ubigeo = character(0), pob25 = numeric(0), pob17_redatam = numeric(0),
                      pob17_en_capa = numeric(0), pob18_17 = numeric(0), u17 = numeric(0),
                      a17 = numeric(0), p25 = numeric(0), g = numeric(0)))
  }
  num <- function(v) {
    v <- suppressWarnings(as.numeric(if (is.null(v) || !length(v)) NA else v[[1]]))
    if (is.finite(v) && v > 0) v else NA_real_
  }
  cob <- lapply(ubigeos, hojas_ruta_territorio_cobertura)
  campo <- function(nm) vapply(cob, function(c) if (is.null(c)) NA_real_ else num(c[[nm]]), numeric(1))
  pob25 <- campo("pob25")
  red17 <- campo("pob17_redatam")
  capa17 <- campo("pob17_en_capa")

  age <- hojas_ruta_inei_age_simple()
  tot17 <- adu17 <- rep(NA_real_, length(ubigeos))
  if (nrow(age)) {
    age <- age[age$ubigeo %in% ubigeos, , drop = FALSE]
    tot <- tapply(age$poblacion, age$ubigeo, sum, na.rm = TRUE)
    adu <- tapply(age$poblacion * (age$edad >= 18L), age$ubigeo, sum, na.rm = TRUE)
    tot17 <- as.numeric(tot[ubigeos])
    adu17 <- as.numeric(adu[ubigeos])
  }
  tot17[!is.finite(tot17) | tot17 <= 0] <- NA_real_
  adu17[!is.finite(adu17) | adu17 <= 0] <- NA_real_

  faltan <- character(0)
  for (i in seq_along(ubigeos)) {
    f <- c(
      if (is.null(cob[[i]])) "el distrito en el registro de territorios",
      if (!is.null(cob[[i]]) && is.na(pob25[[i]])) "pob25",
      if (!is.null(cob[[i]]) && is.na(red17[[i]])) "pob17_redatam",
      if (!is.null(cob[[i]]) && is.na(capa17[[i]])) "pob17_en_capa",
      if (is.na(adu17[[i]]) || is.na(tot17[[i]])) "la edad simple 2017"
    )
    if (length(f)) faltan <- c(faltan, sprintf("%s (%s)", ubigeos[[i]], paste(f, collapse = ", ")))
  }
  if (length(faltan)) .hojas_ruta_rb_incompleta(faltan)

  u17 <- capa17 / red17
  a17 <- adu17 / tot17
  p25 <- pob25 * u17 * a17
  data.frame(
    ubigeo = ubigeos, pob25 = pob25, pob17_redatam = red17, pob17_en_capa = capa17,
    pob18_17 = adu17, u17 = u17, a17 = a17, p25 = p25, g = p25 / capa17,
    stringsAsFactors = FALSE
  )
}

#' Población con que la vista previa del tamaño reparte y calcula márgenes: la de
#' hoy (sin tocar) o P̂25 con la base activa.
hojas_ruta_reparto_base_poblacion <- function(ubigeos, poblacion, params) {
  if (!hojas_ruta_reparto_base_activa(params)) return(poblacion)
  hojas_ruta_reparto_base_distritos(ubigeos)$p25
}

#' Mínimo por distrito (múltiplo de la ruta), la misma cuenta de la vista previa.
.hojas_ruta_rb_minimos <- function(ubigeos, poblacion, params, route_size) {
  raw <- vapply(seq_along(ubigeos), function(i) {
    as.integer(.hojas_ruta_sample_size_n(poblacion[[i]], params,
                                         .hojas_ruta_margin_district_for(params, ubigeos[[i]]),
                                         ubigeo = ubigeos[[i]]))
  }, integer(1))
  as.integer(ceiling(pmax(1L, raw) / route_size) * route_size)
}

#' Rutas por distrito de la cuota que se sortea con la base activa: P̂25 y el piso
#' por distrito con la misma regla que `hojas_ruta_sample_size_preview()` (así la
#' vista previa y la cuota coinciden). NULL con la base apagada: el motor sigue
#' con su reparto de siempre.
hojas_ruta_reparto_base_rutas <- function(ubigeos, route_total, cfg) {
  params <- cfg$sample_size
  # ADR 0131 §1: con estrato provincia las rutas salen del estrato (hojas_ruta_estrato.R).
  if (hojas_ruta_estrato_activo(params)) return(.hojas_ruta_estrato_rutas_en_orden(ubigeos, route_total, cfg))
  if (!hojas_ruta_reparto_base_activa(params)) return(NULL)
  route_size <- .hojas_ruta_route_size(cfg)
  p25 <- hojas_ruta_reparto_base_distritos(ubigeos)$p25
  minimos <- .hojas_ruta_rb_minimos(ubigeos, p25, params, route_size)
  n_used <- as.integer(route_total) * route_size
  floors <- if (isTRUE(params$enforce_district_floor) && n_used >= sum(minimos)) {
    floor(minimos / route_size)
  } else {
    rep(0L, length(ubigeos))
  }
  if (sum(floors) > route_total) floors <- rep(0L, length(ubigeos))
  .hojas_ruta_allocate_by_mode(p25, route_total, params$allocation_mode %||% "proportional", floors)
}

#' Celdas sexo × edad con la base activa: estructura del CPV 2025 escalada a P̂25_d
#' (`hojas_ruta_cuotas_2025_celdas`). Conserva las columnas; apagada, tal cual.
hojas_ruta_reparto_base_escalar_celdas <- function(cells, cfg) {
  if (!nrow(cells) || !hojas_ruta_reparto_base_activa(cfg$sample_size)) return(cells)
  # La estructura sexo × edad es la del CPV 2025, no la 2017 escalada (hojas_ruta_cuotas_cpv2025.R).
  hojas_ruta_cuotas_2025_celdas(cells, cfg)
}

#' Medida de tamaño del sorteo con la base activa: MOS_i = M_i · g_d. `m` es la
#' medida ya saneada (y topada) de las filas de `df`. Apagada, `m` tal cual.
hojas_ruta_reparto_base_mos <- function(m, df, cfg) {
  if (!length(m) || !hojas_ruta_reparto_base_activa(cfg$sample_size)) return(m)
  if (!"ubigeo" %in% names(df)) .hojas_ruta_rb_incompleta("el ubigeo de las manzanas del marco")
  ub <- as.character(df$ubigeo)
  base <- hojas_ruta_reparto_base_distritos(unique(ub))
  m * base$g[match(ub, base$ubigeo)]
}

#' Columnas de la base 2025 para la lista de territorios (la UI las usa en su espejo
#' del tamaño): pob25, u17, a17, p25 y g. Un listado no es un reparto, así que el
#' distrito sin datos queda en NA (y la UI no ofrece la base) en vez de cortar la
#' lista; el error E_* se da al repartir.
hojas_ruta_reparto_base_columnas <- function(ubigeos) {
  vacio <- data.frame(pob25 = rep(NA_real_, length(ubigeos)), u17 = NA_real_, a17 = NA_real_,
                      p25 = NA_real_, g = NA_real_)
  if (!length(ubigeos)) return(vacio[0, , drop = FALSE])
  todos <- tryCatch(hojas_ruta_reparto_base_distritos(ubigeos), api_error = function(e) NULL)
  if (!is.null(todos)) return(todos[names(vacio)])
  for (i in seq_along(ubigeos)) {
    b <- tryCatch(hojas_ruta_reparto_base_distritos(ubigeos[[i]]), api_error = function(e) NULL)
    if (!is.null(b)) vacio[i, ] <- b[1, names(vacio)]
  }
  vacio
}

#' Lo que el reparto declara para la memoria de cálculo y la UI. Vacío con la base
#' apagada, para que la salida de siempre no cambie.
hojas_ruta_reparto_base_declaracion <- function(ubigeos, params, cfg = NULL, n_used = 0L) {
  estrato <- if (is.null(cfg)) list() else hojas_ruta_estrato_declaracion(ubigeos, cfg, n_used)
  if (!hojas_ruta_reparto_base_activa(params)) return(estrato)
  base <- hojas_ruta_reparto_base_distritos(ubigeos)
  c(list(base_reparto = list(
    codigo = HOJAS_RUTA_BASE_REPARTO_2025,
    fuente = HOJAS_RUTA_BASE_REPARTO_2025_FUENTE,
    formula = "P25_d = pob25_d * u17_d * a17_d; g_d = P25_d / pob17_en_capa_d",
    cuotas = HOJAS_RUTA_CUOTAS_2025_FUENTE,
    supuestos = list(
      u17 = "Fracción del distrito que en 2017 cae en manzanas del marco (pob17_en_capa / pob17_redatam).",
      a17 = "Proporción de 18 a más del distrito en la edad simple 2017."
    ),
    distritos = lapply(seq_len(nrow(base)), function(i) as.list(base[i, , drop = FALSE]))
  )), estrato)
}
