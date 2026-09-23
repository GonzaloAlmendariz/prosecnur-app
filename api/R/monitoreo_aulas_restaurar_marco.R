# =============================================================================
# Una config que vuelve RECORTADA de la pantalla no borra el marco del backend
# =============================================================================
#
# `monitoreo_aulas_estado_payload()` quita del payload lo que pesa —las tablas
# del marco (`category_profiles`, `sex_by_faculty`, `profile_distributions`,
# ~54 MB) y el `plan`— y deja sus conteos (`*_n`, `plan_rows`). Pero «Traer
# respuestas» devolvía esa misma config al backend, y el merge del sync la
# guardaba tal cual: medido en CCSS Perfil 2026-II el 2026-09-23, tras el
# primer «Traer respuestas» del día `category_profiles` pasó de 58 filas a un
# entero y «A quién se está alcanzando» publicó «216 de 0 de la población».
#
# La regla: un bloque con el MARCADOR del recorte (`k_n` sin `k`) o una config
# con `plan_rows` sin `plan` vino del payload, y ahí manda lo que el backend ya
# tenía. Una config que sí trae la tabla —un marco nuevo importado— la
# reemplaza como siempre.

#' Restaura en `config` lo que el payload recortó, tomándolo de `previous`.
#'
#' @param config config de aulas entrante.
#' @param previous la que ya tenía el backend.
#' @return `config` con las tablas del marco y el plan de `previous` donde
#'   venían recortados.
#' @keywords internal
.monitoreo_aulas_restaurar_marco <- function(config, previous) {
  if (!is.list(config) || !is.list(previous) || !length(previous)) return(config)
  # Un bloque que trae la MARCA del recorte (`k_n` sin `k`) vino del payload,
  # y el viaje por JSON le deformó también lo demás (las tablas llegan como
  # listas de filas): se restaura ENTERO desde lo que ya había.
  restaurar <- function(entrante, anterior) {
    if (!is.list(entrante) || !is.list(anterior)) return(entrante)
    recortado <- any(vapply(.MONITOREO_AULAS_LISTAS_DEL_MARCO, function(k) {
      !is.null(entrante[[paste0(k, "_n")]]) && is.null(entrante[[k]])
    }, logical(1)))
    if (recortado) anterior else entrante
  }
  config[["quotas"]] <- restaurar(config[["quotas"]], previous[["quotas"]])
  config[["representativity"]] <- restaurar(config[["representativity"]], previous[["representativity"]])
  if (is.list(config[["methodology"]]) && is.list(previous[["methodology"]])) {
    config[["methodology"]][["representativity"]] <- restaurar(
      config[["methodology"]][["representativity"]], previous[["methodology"]][["representativity"]])
  }
  if (is.null(config[["plan"]]) && !is.null(config[["plan_rows"]]) && length(previous[["plan"]] %||% list())) {
    config[["plan"]] <- previous[["plan"]]
  }
  config
}

#' Repone las tablas del marco de un proyecto que ya se guardó sin ellas.
#'
#' La restauración de arriba necesita la config anterior; un `.pulso` guardado
#' DESPUÉS del recorte ya no la tiene (CCSS, 2026-09-23: el proyecto de las
#' 12:12 abrió con «257 de 0 de la población» en la app y en la hoja
#' «Cobertura» del libro). Pero esas tablas no son datos del monitoreo: el
#' traspaso desde Cálculo de muestra las arma con el marco y la selección
#' (`monitoreo_aulas_from_calc`), y los dos viajan en el mismo proyecto. Se
#' reponen desde ahí, sólo donde llegaron recortadas.
#'
#' @param au config de aulas.
#' @param frame `calc_muestra_aulas_frame` de la sesión.
#' @param selection `calc_muestra_aulas_selection` de la sesión.
#' @return `au` con lo recortado repuesto; `attr(, "repuesto")` dice qué.
#' @keywords internal
.monitoreo_aulas_reponer_marco_de_calc <- function(au, frame = NULL, selection = NULL) {
  if (!is.list(au)) return(au)
  recortada <- function(bloque, k) is.list(bloque) && !is.null(bloque[[paste0(k, "_n")]]) && is.null(bloque[[k]])
  repuesto <- character(0)
  q <- au[["quotas"]]
  fuentes <- list(
    category_profiles = if (is.list(frame)) frame[["category_profiles"]] else NULL,
    sex_by_faculty = if (is.list(frame)) (frame[["population_cross_profiles"]] %||% frame[["cross_profiles"]]) else NULL,
    profile_distributions = if (is.list(selection))
      (selection[["diagnostics"]][["profile_distributions"]] %||% selection[["representativity"]][["profile_distributions"]]) else NULL
  )
  for (k in names(fuentes)) {
    if (recortada(q, k) && !is.null(fuentes[[k]])) {
      q[[k]] <- fuentes[[k]]
      q[[paste0(k, "_n")]] <- NULL
      repuesto <- c(repuesto, paste0("quotas$", k))
    }
  }
  au[["quotas"]] <- q
  rep_sel <- if (is.list(selection)) selection[["representativity"]] else NULL
  if (is.list(rep_sel)) {
    if (any(vapply(.MONITOREO_AULAS_LISTAS_DEL_MARCO, function(k) recortada(au[["representativity"]], k), logical(1)))) {
      au[["representativity"]] <- rep_sel
      repuesto <- c(repuesto, "representativity")
    }
    m <- au[["methodology"]]
    if (is.list(m) && any(vapply(.MONITOREO_AULAS_LISTAS_DEL_MARCO, function(k) recortada(m[["representativity"]], k), logical(1)))) {
      au[["methodology"]][["representativity"]] <- rep_sel
      repuesto <- c(repuesto, "methodology$representativity")
    }
  }
  attr(au, "repuesto") <- repuesto
  au
}
