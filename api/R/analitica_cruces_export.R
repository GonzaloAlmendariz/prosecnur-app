# Preparación del archivo de Cruces del estudio (POST /api/analitica/cruces) y de su vista previa.
#
# FUENTE ÚNICA de lo que recibe el trabajo en segundo plano: bases revisadas, sin columnas excluidas, ponderadas,
# sin las filas de las categorías de cruce excluidas y con la madre adjunta en una hija repeat; secciones, numéricas,
# opciones de la tabla, listas ordinales por base, notas y la regla de diferencias del estudio. La usan el router
# (que la serializa al job) y `analitica_cruces_preview.R`, así que ambos parten de lo mismo.

#' Prepara los argumentos del archivo de Cruces
#'
#' @param sid Sesión.
#' @param cruces Variables de cruce que reemplazan a las configuradas (parámetro heredado de la ruta, sin
#'   exclusiones). `NULL` usa la configuración.
#' @param modo Modo pedido; `NULL` usa el configurado. La ruta lo recibe con valor por defecto `"estandar"`.
#' @return Lista con `vacio` (`NULL`, `"sin_configurar"` o `"sin_categoricas"`; con valor, el resto no se
#'   calcula), `cfg`, `cruces_map`, `cruces_val`, `excluidas` y los argumentos del job: `data_sources`,
#'   `inst_sources`, `repeat_design_by_base`, `modo`, `secs`, `numericas_arg`, `show_sig`, `alpha`,
#'   `significancia`, `incluir_total`, `incluir_titulos`, `incluir_secciones`, `brecha_filas`, `brecha_cols`,
#'   `aplicar_sem`, `sem_modo`, `sem_cortes`, `sem_colores`, `orden_cruces`, `ordinal_lists_by_base`, `notas` y
#'   `sig_estudio`.
#' @keywords internal
.analitica_cruces_preparar <- function(sid, cruces = NULL, modo = NULL) {
  ctx <- .load_rp_data(sid)
  cfg <- .analitica_cfg_with_effective_source(sid, .analitica_get_config(sid))
  reviewed_ctx <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
  ctx$rp_data <- reviewed_ctx$data
  ctx$rp_inst <- reviewed_ctx$inst
  cc <- cfg$cruces %||% list()

  # Variables de cruce: parámetro > config. Schema v2 del config es [{name, excluidas?}]; v1 era string[].
  # `.cruces_vars_parse` acepta ambos y devuelve `list(name -> excluidas)`.
  cruces_map <- if (!is.null(cruces) && nzchar(as.character(cruces[[1]] %||% ""))) {
    raw_names <- if (length(cruces) == 1) as.character(cruces[[1]]) else as.character(cruces)
    stats::setNames(replicate(length(raw_names), character(0), simplify = FALSE), raw_names)
  } else {
    .cruces_vars_parse(cc$cruces_vars)
  }
  out <- list(vacio = NULL, cfg = cfg, cruces_map = cruces_map, cruces_val = names(cruces_map))
  if (length(out$cruces_val) == 0L) {
    out$vacio <- "sin_configurar"
    return(out)
  }

  modo_val <- as.character(modo %||% cc$modo %||% "estandar")
  if (!modo_val %in% c("estandar", "dimensiones")) modo_val <- "estandar"

  secs <- .secciones_from_config(cfg)
  excluidas <- .as_chr_vec(cfg$variables_excluidas)
  numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)
  secs <- .analitica_filter_sections(secs, ctx$rp_inst, numericas_arg, excluidas)

  categoricas <- .analitica_categoricas(ctx$rp_inst)
  cruces_val <- setdiff(intersect(out$cruces_val, categoricas), excluidas)
  cruces_map <- cruces_map[names(cruces_map) %in% cruces_val]
  out$cruces_val <- cruces_val
  out$cruces_map <- cruces_map
  out$excluidas <- excluidas
  if (length(cruces_val) == 0L) {
    out$vacio <- "sin_categoricas"
    return(out)
  }

  opciones <- .analitica_cruces_opciones(cc)

  # Multibase: cada base se filtra por `cruces_map` (las exclusiones de categorías aplican a todas) y el worker
  # itera por base.
  sources <- .load_rp_sources(sid)
  data_sources <- sources$data_sources
  inst_sources <- sources$inst_sources
  # Las variables propias de una hija repeat también entran (analitica_repeats_grano.R).
  if (length(inst_sources) > 1L) {
    secs <- .analitica_filter_sections_bases(.secciones_from_config(cfg), inst_sources, numericas_arg, excluidas) %||% secs
  }
  for (nombre in names(data_sources)) {
    reviewed <- .analitica_apply_data_review(data_sources[[nombre]], inst_sources[[nombre]], cfg)
    data_sources[[nombre]] <- .excluir_cols(reviewed$data, excluidas)
    inst_sources[[nombre]] <- reviewed$inst
  }
  # La ponderacion vive en la persona: madres/bases normales se calibran sobre sus filas y las hijas repeat
  # heredan ese peso por la llave ODK.
  weighted <- .analitica_ponderacion_apply_sources(sid, data_sources, inst_sources, cfg)
  data_sources <- weighted$data_sources
  inst_sources <- weighted$inst_sources
  repeat_design_by_base <- weighted$repeat_design_by_base
  # Listas ordinales EFECTIVAS por base (override manual ∪ auto). Se precomputan en el hilo principal (paquete
  # cargado) y viajan como dato plano al worker callr.
  ordinal_lists_by_base <- lapply(inst_sources, function(inst) .orden_categorias_ordinal_set(inst, cfg))
  exclusion_por_base <- lapply(data_sources, .cruces_exclusion_resumen, cruces_map = cruces_map)
  data_sources_filt <- lapply(names(data_sources), function(nombre) {
    df <- .excluir_cruce_rows(data_sources[[nombre]], cruces_map)
    design <- repeat_design_by_base[[nombre]]
    if (!is.null(design)) attr(df, "repeat_design") <- design
    .cruces_adjuntar_madre(df, design, data_sources, cruces_map)   # ADR 0128 §4 ter
  })
  names(data_sources_filt) <- names(data_sources)
  # Una base que no trae ninguna de las variables de cruce no se cruza (reporte_cruces_bases.R).
  con_cruces <- .cruces_bases_con_variables(data_sources_filt, cruces_val)

  c(out, opciones, list(
    data_sources = data_sources_filt[con_cruces],
    inst_sources = inst_sources[con_cruces],
    exclusion_por_base = exclusion_por_base,
    repeat_design_by_base = repeat_design_by_base,
    modo = modo_val,
    secs = secs,
    numericas_arg = numericas_arg,
    ordinal_lists_by_base = ordinal_lists_by_base,
    notas = .notas_pie_normalizar(cfg$notas),
    sig_estudio = .sig_arg_job(sid, .graficos_config_get(sid))$significancia   # ADR 0128: regla del estudio
  ))
}

# Filas que `.excluir_cruce_rows()` quita de una base, por variable de cruce y categoría excluida, contadas antes de
# quitarlas. La exclusión compara el valor del dato con lo guardado: una categoría que no aparece en la base no quita
# ninguna fila, y este resumen es lo que permite decirlo.
.cruces_exclusion_resumen <- function(data, cruces_map) {
  out <- list()
  for (nm in names(cruces_map)) {
    excl <- as.character(cruces_map[[nm]])
    if (!length(excl)) next
    vals <- if (nm %in% names(data)) as.character(data[[nm]]) else character(0)
    out[[nm]] <- lapply(excl, function(code) list(codigo = code, filas = as.integer(sum(vals %in% code))))
  }
  list(filas_antes = nrow(data), por_cruce = out)
}

# Opciones de la tabla guardadas en `cfg$cruces`, con sus valores por defecto.
.analitica_cruces_opciones <- function(cc) {
  alpha <- suppressWarnings(as.numeric(cc$alpha %||% 0.05))
  if (!is.finite(alpha)) alpha <- 0.05
  # Orden por frecuencia marginal de las filas nominales (las columnas nunca se reordenan). Ordinales conservan
  # orden fijo.
  orden_cruces <- as.character(cc$orden %||% "original")
  if (!orden_cruces %in% c("desc", "asc", "original")) orden_cruces <- "original"
  brecha <- cc$brecha %||% list()
  sem <- cc$semaforo %||% list()
  sem_modo <- as.character(sem$modo %||% "grupos")
  if (!sem_modo %in% c("grupos", "degradado", "degradado_automatico", "degradado_manual")) sem_modo <- "grupos"
  sem_cortes <- .as_int_vec(sem$cortes)
  if (length(sem_cortes) == 0L) sem_cortes <- c(50L, 75L)
  list(
    show_sig = isTRUE(cc$show_sig %||% TRUE),
    alpha = alpha,
    significancia = .cruces_significancia_normalizar(cc$significancia),
    incluir_total = isTRUE(cc$incluir_total %||% TRUE),
    orden_cruces = orden_cruces,
    # Los títulos de variable/pregunta se conservan siempre. La opción UI solo controla los separadores de sección.
    incluir_titulos = TRUE,
    incluir_secciones = isTRUE(cc$incluir_secciones %||% TRUE),
    brecha_filas = isTRUE(brecha$filas),
    brecha_cols = isTRUE(brecha$cols),
    aplicar_sem = isTRUE(sem$activo),
    sem_modo = sem_modo,
    sem_cortes = sem_cortes,
    sem_colores = sem$colores %||% list()
  )
}
