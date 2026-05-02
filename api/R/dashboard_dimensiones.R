# ============================================================
# Tab "Dimensiones" — heatmap semáforo + gráfico principal (barras o
# radar) con catálogo de objetivos (general | indicadores), cruce,
# iteración y filtros. Espejo de la pestaña del legacy
# `interactivo_dimensiones.R`, expuesto vía REST.
#
# Reusa los helpers ya existentes en el paquete prosecnur:
#   - .dim_build_context()  (indicador_dimensiones_shared.R:731)
#   - .dim_build_payload()  (indicador_dimensiones_shared.R:1138)
#   - reporte_dimensiones_config()
#
# El estado dashboard requiere `s$rp_dim` (data.frame con scores 0-100
# producido por `reporte_dimensiones_indices()`) y `s$rp_inst`. Cuando
# no están, los endpoints devuelven payload vacío para que la UI muestre
# un EmptyState pidiendo generar dimensiones desde Analítica.
# ============================================================

# Si dim no está listo, payload vacío estandarizado.
.dashboard_dim_ready <- function(s) {
  isTRUE(s$analitica_dim_ok) && !is.null(s$rp_dim) && !is.null(s$rp_inst)
}

# Construye y devuelve el contexto de dimensiones para la sesión actual.
# Guardado en s$dashboard_dim_ctx por sesión para evitar rebuild en cada
# llamada (el ctx es relativamente costoso). Si rp_dim cambia, hay que
# invalidar (eso lo hace `.dashboard_dim_invalidate` desde el flujo de
# regeneración).
.dashboard_dim_ctx <- function(sid, s = NULL) {
  s <- s %||% session_get(sid)
  if (!.dashboard_dim_ready(s)) return(NULL)

  cached <- s$dashboard_dim_ctx
  cfg_dash <- .dashboard_config_with_defaults(s$dashboard_config)
  rp_id <- digest::digest(list(
    n = nrow(s$rp_dim),
    cols = names(s$rp_dim),
    cfg_id = digest::digest(s$dimensiones_config %||% list()),
    theme_color = cfg_dash$color_primario_override
      %||% .dashboard_theme_default()$color_primario
  ), algo = "xxhash64")
  if (!is.null(cached) && identical(cached$id, rp_id)) {
    return(cached$ctx)
  }

  config <- s$dimensiones_config %||% reporte_dimensiones_config(s$rp_dim)
  ctx <- .dim_build_context(
    data = s$rp_dim,
    instrumento = s$rp_inst,
    config = config,
    secciones_limpias = .dashboard_curated_secciones(s),
    theme_color = cfg_dash$color_primario_override
      %||% .dashboard_theme_default()$color_primario,
    weight_col = NULL
  )

  session_set(sid, "dashboard_dim_ctx", list(id = rp_id, ctx = ctx))
  ctx
}

# Catálogo de objetivos por modo.
.dashboard_dim_catalogo <- function(s) {
  if (!.dashboard_dim_ready(s)) {
    return(list(ready = FALSE, general = list(), indicadores = list()))
  }
  ctx <- .dashboard_dim_ctx(s$id, s)
  if (is.null(ctx)) {
    return(list(ready = FALSE, general = list(), indicadores = list()))
  }
  pack <- function(map) {
    if (!is.list(map) || !length(map)) return(list())
    lapply(names(map), function(k) {
      list(
        id = as.character(k),
        label = as.character(map[[k]]$label %||% k),
        n_axes = length(map[[k]]$axis_vars %||% character(0))
      )
    })
  }
  list(
    ready = TRUE,
    general = pack(ctx$catalog_general),
    indicadores = pack(ctx$catalog_indicadores)
  )
}

# Lista de secciones + variables elegibles para cruce / iteración.
# Filtra a SO/SM y a numéricas con baja cardinalidad (<=60 únicos).
.dashboard_dim_secciones_vars <- function(s) {
  if (!.dashboard_dim_ready(s)) return(list(secciones = list()))
  secs <- .dashboard_visible_secciones(s)
  if (!length(secs)) return(list(secciones = list()))

  var_filtrable <- function(v) {
    if (!(v %in% names(s$rp_dim))) return(FALSE)
    surv <- s$rp_inst$survey %||% NULL
    if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
      tipo <- tolower(as.character(surv$type[surv$name == v][1] %||% ""))
      if (grepl("^select_one\\b", tipo) || grepl("^select_multiple\\b", tipo)) return(TRUE)
    }
    x <- trimws(as.character(s$rp_dim[[v]]))
    x <- x[!is.na(x) & nzchar(x) & x != "NA"]
    n_u <- length(unique(x))
    is.finite(n_u) && n_u > 1L && n_u <= 60L
  }

  out <- lapply(names(secs), function(sec_id) {
    vars <- secs[[sec_id]]
    elegibles <- vars[vapply(vars, var_filtrable, logical(1))]
    if (!length(elegibles)) return(NULL)
    list(
      nombre = sec_id,
      vars = lapply(elegibles, function(v) {
        list(
          name = v,
          label = .dashboard_var_label_override(s, v) %||% .obtener_label_var(v, s$rp_inst, s$rp_dim) %||% v
        )
      })
    )
  })
  out <- Filter(Negate(is.null), out)
  list(secciones = out)
}

# Convierte un data.frame plano (3-5 columnas) en una lista de listas
# JSON-friendly, preservando los tipos numéricos.
.dashboard_dim_df_to_rows <- function(df) {
  if (!is.data.frame(df) || !nrow(df)) return(list())
  lapply(seq_len(nrow(df)), function(i) {
    row <- df[i, , drop = FALSE]
    out <- as.list(row)
    # Sanea NAs a NULL para serialización limpia.
    lapply(out, function(v) {
      if (length(v) == 1L && is.na(v)) NULL else unname(v)
    })
  })
}

# Payload completo para una vista — wrap de .dim_build_payload + serialización.
.dashboard_dim_payload <- function(s, modo, objetivo,
                                   cruce = NULL, incluir_total = NULL,
                                   iter = NULL, filtros = list()) {
  if (!.dashboard_dim_ready(s)) {
    return(list(ready = FALSE))
  }
  ctx <- .dashboard_dim_ctx(s$id, s)
  if (is.null(ctx)) return(list(ready = FALSE))

  iter_var <- if (is.list(iter)) as.character(iter$var %||% "")[1] else ""
  iter_level <- if (is.list(iter)) as.character(iter$level %||% "")[1] else ""

  inner <- tryCatch(
    .dim_build_payload(
      ctx,
      modo = modo,
      objetivo = objetivo,
      cruce = if (nzchar(as.character(cruce %||% ""))) as.character(cruce) else NULL,
      incluir_total = incluir_total,
      filtros = filtros %||% list(),
      iter_var = if (nzchar(iter_var)) iter_var else NULL,
      iter_level = if (nzchar(iter_level)) iter_level else NULL
    ),
    error = function(e) {
      list(error = conditionMessage(e))
    }
  )

  if (!is.null(inner$error)) {
    return(list(ready = TRUE, error = inner$error))
  }

  # Serializar arrays a listas de objetos JSON.
  score_plot_rows <- .dashboard_dim_df_to_rows(inner$score_plot %||% data.frame())
  score_heat_rows <- .dashboard_dim_df_to_rows(inner$score_heat %||% data.frame())

  # group_colors: vector con nombres → lista name=hex.
  gc <- inner$group_colors %||% character(0)
  group_colors <- if (length(gc)) {
    stats::setNames(as.list(as.character(gc)), names(gc))
  } else list()

  # Mapeo {axis_label → data-uri} resolviendo obj$axis_iconos del
  # objetivo activo. Frontend lo usa para pintar iconos en nodos
  # (heatmap, IndicadorAssembly, FODA). Si el objetivo no expone
  # iconos, el mapa queda vacío y el frontend cae a fallback texto.
  obj_active <- ctx$catalog_general[[objetivo]] %||%
                ctx$catalog_indicadores[[objetivo]]
  axis_icons_map <- list()
  if (is.list(obj_active)) {
    cfg_dash_inner <- .dashboard_config_with_defaults(s$dashboard_config)
    overrides_inner <- if (is.list(cfg_dash_inner$dim_axis_icons)) cfg_dash_inner$dim_axis_icons else NULL
    icon_map <- tryCatch(
      .dashboard_dim_axis_icons(obj_active, tint_color = NULL, overrides = overrides_inner),
      error = function(e) list()
    )
    if (length(icon_map)) {
      vars_o <- as.character(obj_active$axis_vars %||% character(0))
      labels_o <- as.character(obj_active$axis_labels %||% vars_o)
      for (i in seq_along(vars_o)) {
        uri <- icon_map[[vars_o[i]]] %||% ""
        if (nzchar(uri) && i <= length(labels_o)) {
          axis_icons_map[[labels_o[i]]] <- uri
        }
      }
    }
  }

  list(
    ready = TRUE,
    mode = as.character(inner$mode %||% modo),
    objective = as.character(inner$objective %||% ""),
    objective_id = as.character(objetivo),
    visual_mode = as.character(inner$visual_mode %||% "barras"),
    principal_var = as.character(inner$principal_var %||% NA_character_),
    principal_label = as.character(inner$principal_label %||% NA_character_),
    principal_hidden = as.integer(inner$principal_hidden %||% 0L),
    iter_active = isTRUE(inner$iter_active),
    iter_var = as.character(inner$iter_var %||% NA_character_),
    iter_var_label = as.character(inner$iter_var_label %||% NA_character_),
    iter_level = as.character(inner$iter_level %||% NA_character_),
    iter_level_label = as.character(inner$iter_level_label %||% NA_character_),
    iter_hidden_levels = as.integer(inner$iter_hidden_levels %||% 0L),
    axis_order_plot = as.character(inner$axis_order_plot %||% character(0)),
    axis_order_heat = as.character(inner$axis_order_heat %||% character(0)),
    score_plot = score_plot_rows,
    score_heat = score_heat_rows,
    group_colors = group_colors,
    axis_icons = axis_icons_map,
    semaforo = list(
      red_max = as.numeric(inner$semaforo$red_max %||% 60),
      amber_max = as.numeric(inner$semaforo$amber_max %||% 80),
      red_color = as.character(inner$semaforo$red_color %||% "#D84B55"),
      amber_color = as.character(inner$semaforo$amber_color %||% "#E0B44C"),
      green_color = as.character(inner$semaforo$green_color %||% "#3A9A5B"),
      na_color = as.character(inner$semaforo$na_color %||% "#CCCCCC")
    )
  )
}

# ============================================================
# FODA — clasificación 2x2 (fortaleza/oportunidad/debilidad/amenaza)
# basada en score_mean (eje Y) y score_sd (eje X), reusando
# .foda_compute_stats() + .foda_classify() del paquete prosecnur.
# ============================================================

# Helper: convierte una ruta local de icono a data-uri base64. Si la ruta
# no existe o no es legible, devuelve "" (frontend cae a fallback solo
# texto). Solo soporta extensiones de imagen comunes.
.dashboard_dim_icon_data_uri <- function(path, tint_color = NULL) {
  if (is.null(path) || !nzchar(as.character(path))) return("")
  p <- as.character(path)[1]
  if (grepl("^data:image/", p)) return(p)
  if (!file.exists(p)) return("")
  ext <- tolower(tools::file_ext(p))
  mime <- switch(ext,
    "png" = "image/png",
    "jpg" = "image/jpeg",
    "jpeg" = "image/jpeg",
    "svg" = "image/svg+xml",
    "gif" = "image/gif",
    NA_character_
  )
  if (is.na(mime)) return("")

  tint_color <- as.character(tint_color %||% "")[1]
  tint_color <- trimws(tint_color)
  if (identical(ext, "png") && nzchar(tint_color) &&
      !inherits(try(grDevices::col2rgb(tint_color), silent = TRUE), "try-error") &&
      requireNamespace("png", quietly = TRUE) &&
      exists(".dim_tint_icon", mode = "function", inherits = TRUE)) {
    tinted <- tryCatch({
      img <- png::readPNG(p)
      img <- .dim_tint_icon(img, tint_color = tint_color)
      png::writePNG(img, target = raw())
    }, error = function(e) NULL)
    if (!is.null(tinted) && length(tinted)) {
      return(paste0("data:", mime, ";base64,", jsonlite::base64_enc(tinted)))
    }
  }

  bytes <- tryCatch(readBin(p, what = "raw", n = file.info(p)$size),
                    error = function(e) NULL)
  if (is.null(bytes) || !length(bytes)) return("")
  paste0("data:", mime, ";base64,", jsonlite::base64_enc(bytes))
}

# Resuelve el mapeo axis_var -> data-uri usando obj$axis_iconos.
# obj$axis_iconos suele ser una lista nombrada por axis_label apuntando
# a paths de PNG (definidos en el paquete prosecnur). Devuelve list
# nombrado por var.
#
# `overrides` es opcional: lista nombrada por axis_label apuntando a
# data-uris guardados en `dashboard_config$dim_axis_icons` (subidos por
# el usuario en Personalizar → Íconos). Si existe override válido para
# un label, gana sobre el ícono del paquete. Sin override, fallback al
# paquete (preservando los defaults bonitos de prosecnur).
.dashboard_dim_axis_icons <- function(obj, tint_color = NULL, overrides = NULL) {
  iconos <- obj$axis_iconos
  vars <- as.character(obj$axis_vars %||% character(0))
  labels <- as.character(obj$axis_labels %||% vars)
  if (!length(vars)) return(list())
  has_pkg <- is.list(iconos) && length(iconos)
  has_overrides <- is.list(overrides) && length(overrides)
  if (!has_pkg && !has_overrides) return(list())
  out <- list()
  for (i in seq_along(vars)) {
    label <- labels[i]
    # Override del config gana — el data-uri ya viene listo, no se re-tinta
    # (el usuario ya subió el ícono con el color que quiere).
    if (has_overrides) {
      ov <- overrides[[label]] %||% overrides[[vars[i]]]
      if (is.character(ov) && length(ov) == 1L && nzchar(ov)) {
        out[[vars[i]]] <- as.character(ov)
        next
      }
    }
    if (!has_pkg) next
    raw <- iconos[[label]] %||% iconos[[vars[i]]] %||% iconos[[i]]
    uri <- .dashboard_dim_icon_data_uri(raw, tint_color = tint_color)
    if (nzchar(uri)) out[[vars[i]]] <- uri
  }
  out
}

# Payload FODA — estructura JSON-friendly con items, cortes y counts.
.dashboard_dim_foda <- function(s, modo, objetivo,
                                cruce = NULL, incluir_total = NULL,
                                iter = NULL, filtros = list(),
                                foda_config = NULL) {
  if (!.dashboard_dim_ready(s)) return(list(ready = FALSE))
  ctx <- .dashboard_dim_ctx(s$id, s)
  if (is.null(ctx)) return(list(ready = FALSE))

  cfg_dash <- .dashboard_config_with_defaults(s$dashboard_config)
  if (is.list(foda_config) && length(foda_config)) {
    cfg_dash <- utils::modifyList(cfg_dash, foda_config)
    if (!is.null(foda_config$foda_vista)) cfg_dash$foda_vista <- foda_config$foda_vista
    if (!is.null(foda_config$foda_views)) cfg_dash$foda_views <- foda_config$foda_views
  }
  iconos_enabled <- isTRUE(cfg_dash$foda_iconos_enabled %||% TRUE)
  icon_tint <- as.character(cfg_dash$foda_icon_tint %||% "#FFFFFF")[1]
  if (!nzchar(trimws(icon_tint)) ||
      inherits(try(grDevices::col2rgb(icon_tint), silent = TRUE), "try-error")) {
    icon_tint <- "#FFFFFF"
  }

  semaforo_payload <- function() {
    list(
      red_max = as.numeric(ctx$semaforo$red_max %||% 60),
      amber_max = as.numeric(ctx$semaforo$amber_max %||% 80),
      red_color = as.character(ctx$semaforo$red_color %||% "#D84B55"),
      amber_color = as.character(ctx$semaforo$amber_color %||% "#E0B44C"),
      green_color = as.character(ctx$semaforo$green_color %||% "#3A9A5B"),
      na_color = as.character(ctx$semaforo$na_color %||% "#CCCCCC")
    )
  }

  empty_payload <- function(corte_score = 80, corte_sd = 0) {
    list(
      ready = TRUE,
      item_kind = "conductores",
      items = list(),
      cortes = list(score = round(as.numeric(corte_score), 2), sd = round(as.numeric(corte_sd), 2)),
      counts = list(fortaleza = 0L, oportunidad = 0L, debilidad = 0L, amenaza = 0L),
      group_colors = list(),
      icon_legend = list(),
      semaforo = semaforo_payload()
    )
  }

  modo <- match.arg(as.character(modo %||% "general")[1],
                    c("general", "indicadores"))
  obj_map <- if (identical(modo, "indicadores")) ctx$catalog_indicadores else ctx$catalog_general
  if (!(objetivo %in% names(obj_map))) {
    return(list(ready = TRUE, error = "Objetivo no existe en el catálogo."))
  }
  obj <- obj_map[[objetivo]]

  vars <- as.character(obj$axis_vars %||% character(0))
  labels <- as.character(obj$axis_labels %||% vars)
  keep_vars <- vars %in% names(ctx$data)
  vars <- vars[keep_vars]
  labels <- labels[keep_vars]
  if (!length(vars)) {
    return(empty_payload())
  }

  # Filtrar data + iteración (mismo patrón que .dim_build_payload).
  df <- .dim_apply_filters(ctx$data, filters = filtros %||% list())
  iter_var <- if (is.list(iter)) as.character(iter$var %||% "")[1] else ""
  iter_level <- if (is.list(iter)) as.character(iter$level %||% "")[1] else ""
  if (nzchar(iter_var) && nzchar(iter_level) && iter_var %in% names(df)) {
    keep <- !is.na(df[[iter_var]]) &
      as.character(df[[iter_var]]) == iter_level
    df <- df[keep, , drop = FALSE]
  }

  if (!nrow(df)) {
    return(empty_payload())
  }

  foda_views <- cfg_dash$foda_views %||% list()
  if (!is.list(foda_views) || !length(foda_views)) {
    foda_views <- .dashboard_default_config()$foda_views
  }
  foda_vista <- as.character(cfg_dash$foda_vista %||% "conductores")[1]
  active_view <- NULL
  for (view in foda_views) {
    if (!is.list(view)) next
    view_id <- as.character(view$id %||% "")[1]
    if (identical(view_id, foda_vista)) {
      active_view <- view
      break
    }
  }
  if (is.null(active_view)) {
    foda_vista <- "conductores"
    active_view <- list(
      id = "conductores",
      label = "Conductores",
      variable = "",
      metric_var = "",
      card_mode = "iconos",
      aliases = list(),
      icons = list()
    )
  }
  item_var <- as.character(active_view$variable %||% "")[1]
  metric_var <- as.character(active_view$metric_var %||% "idx_indice_general")[1]
  card_mode <- as.character(active_view$card_mode %||% "iconos")[1]
  if (!(card_mode %in% c("iconos", "alias"))) card_mode <- "iconos"
  view_label <- as.character(active_view$label %||% foda_vista)[1]

  if (nzchar(item_var) && !identical(foda_vista, "conductores")) {
    if (!nzchar(item_var) || !(item_var %in% names(df))) {
      out <- empty_payload()
      out$item_kind <- foda_vista
      out$item_label <- view_label
      out$card_mode <- card_mode
      out$error <- paste0("No se encontró la variable requerida para FODA: ", item_var, ".")
      return(out)
    }
    if (!(metric_var %in% names(df))) {
      out <- empty_payload()
      out$item_kind <- foda_vista
      out$item_label <- view_label
      out$card_mode <- card_mode
      out$error <- paste0("No se encontró ", metric_var, " para calcular el FODA por variable.")
      return(out)
    }

    cats <- .dim_categorias_var(
      df,
      item_var,
      w = .dim_safe_weights(df, NULL),
      data_ref = ctx$data,
      instrumento = ctx$instrumento,
      max_levels = ctx$max_categorias_principal %||% 12L
    )
    if (!nrow(cats$rows)) {
      out <- empty_payload()
      out$item_kind <- foda_vista
      out$item_label <- view_label
      out$card_mode <- card_mode
      return(out)
    }

    cruce <- as.character(cruce %||% "")[1]
    cruce_valido <- nzchar(cruce) && cruce %in% names(df) && !identical(cruce, item_var)
    include_total <- if (is.null(incluir_total)) TRUE else isTRUE(incluir_total)

    compare_groups <- list()
    if (include_total || !cruce_valido) {
      compare_groups[[length(compare_groups) + 1L]] <- list(
        key = if (cruce_valido) "__total__" else foda_vista,
        label = if (cruce_valido) "Total" else view_label,
        mask = rep(TRUE, nrow(df)),
        is_total_global = cruce_valido
      )
    }
    if (cruce_valido) {
      cats_cruce <- .dim_categorias_var(
        df,
        cruce,
        w = .dim_safe_weights(df, NULL),
        data_ref = ctx$data,
        instrumento = ctx$instrumento,
        max_levels = ctx$max_categorias_principal %||% 12L
      )
      x_cruce <- trimws(as.character(df[[cruce]]))
      if (nrow(cats_cruce$rows)) {
        for (i in seq_len(nrow(cats_cruce$rows))) {
          key_i <- as.character(cats_cruce$rows$value[i] %||% "")
          if (!nzchar(key_i)) next
          compare_groups[[length(compare_groups) + 1L]] <- list(
            key = key_i,
            label = as.character(cats_cruce$rows$label[i] %||% key_i),
            mask = !is.na(x_cruce) & nzchar(x_cruce) & x_cruce == key_i,
            is_total_global = FALSE
          )
        }
      }
    }
    if (!length(compare_groups)) {
      compare_groups[[1L]] <- list(
        key = foda_vista,
        label = view_label,
        mask = rep(TRUE, nrow(df)),
        is_total_global = FALSE
      )
    }

    x_group <- trimws(as.character(df[[item_var]]))
    y_metric <- suppressWarnings(as.numeric(df[[metric_var]]))
    stats_list <- list()
    for (g in compare_groups) {
      if (!any(g$mask)) next
      for (i in seq_len(nrow(cats$rows))) {
        key_i <- as.character(cats$rows$value[i] %||% "")
        label_i <- as.character(cats$rows$label[i] %||% key_i)
        if (!nzchar(key_i)) next
        mask <- g$mask & !is.na(x_group) & nzchar(x_group) & x_group == key_i
        vals <- y_metric[mask]
        vals <- vals[!is.na(vals) & is.finite(vals)]
        if (!length(vals)) next
        stats_list[[length(stats_list) + 1L]] <- data.frame(
          var = paste0(item_var, ":", key_i, "::", as.character(g$key)),
          label = label_i,
          item_key = key_i,
          item_label = label_i,
          grupo_key = as.character(g$key),
          grupo = as.character(g$label),
          is_total_global = isTRUE(g$is_total_global),
          score_mean = mean(vals),
          score_sd = if (length(vals) >= 2L) stats::sd(vals) else 0,
          n_valid = length(vals),
          stringsAsFactors = FALSE
        )
      }
    }
    if (!length(stats_list)) {
      out <- empty_payload()
      out$item_kind <- foda_vista
      out$item_label <- view_label
      out$card_mode <- card_mode
      return(out)
    }
    stats_df <- do.call(rbind, stats_list)

    corte_score <- as.numeric(ctx$semaforo$amber_max %||% 80)
    sds_valid <- stats_df$score_sd[!is.na(stats_df$score_sd)]
    corte_sd <- if (length(sds_valid)) stats::median(sds_valid) else 0
    stats_df <- .foda_classify(stats_df, corte_score, corte_sd)

    color_var <- if (cruce_valido) cruce else item_var
    color_ref <- if (cruce_valido) {
      unique(stats_df[, c("grupo", "grupo_key"), drop = FALSE])
    } else {
      unique(data.frame(
        grupo = as.character(stats_df$item_label),
        grupo_key = as.character(stats_df$item_key),
        stringsAsFactors = FALSE
      ))
    }
    palette_override <- .dashboard_palette_for_var(color_var, s$rp_inst, s)
    color_vec <- .dim_group_colors(
      groups = as.character(color_ref$grupo),
      paleta_radar = ctx$paleta_radar,
      total_color = ctx$theme_color,
      palette_override = palette_override,
      group_keys = as.character(color_ref$grupo_key)
    )
    group_colors <- if (cruce_valido && length(color_vec)) {
      stats::setNames(as.list(as.character(color_vec)), names(color_vec))
    } else list()

    aliases_var <- active_view$aliases %||% list()
    if (!is.list(aliases_var)) aliases_var <- list()
    if (is.list(cfg_dash$foda_aliases)) {
      aliases_var <- utils::modifyList(
        cfg_dash$foda_aliases[[item_var]] %||% list(),
        aliases_var,
        keep.null = TRUE
      )
    }
    view_icons <- active_view$icons %||% list()
    if (!is.list(view_icons)) view_icons <- list()
    service_icons <- if (is.list(cfg_dash$foda_service_icons)) cfg_dash$foda_service_icons else list()
    icon_sources <- utils::modifyList(service_icons, view_icons, keep.null = TRUE)
    icon_map <- list()
    if (identical(card_mode, "iconos") && iconos_enabled && length(icon_sources)) {
      for (i in seq_len(nrow(stats_df))) {
        key_i <- as.character(stats_df$item_key[i])
        label_i <- as.character(stats_df$item_label[i])
        raw <- icon_sources[[key_i]] %||% icon_sources[[label_i]]
        uri <- .dashboard_dim_icon_data_uri(raw, tint_color = icon_tint)
        if (nzchar(uri)) icon_map[[key_i]] <- uri
      }
    }

    items <- lapply(seq_len(nrow(stats_df)), function(i) {
      key_i <- as.character(stats_df$item_key[i])
      label_i <- as.character(stats_df$item_label[i])
      alias_i <- aliases_var[[key_i]] %||% aliases_var[[label_i]] %||% ""
      color_key <- if (cruce_valido) as.character(stats_df$grupo[i]) else label_i
      color <- if (color_key %in% names(color_vec)) {
        as.character(color_vec[[color_key]])
      } else {
        as.character(ctx$theme_color %||% "#0E3B74")
      }
      out <- list(
        var = as.character(stats_df$var[i]),
        axis_label = label_i,
        card_label = as.character(alias_i),
        item_kind = foda_vista,
        card_mode = card_mode,
        grupo = as.character(stats_df$grupo[i] %||% view_label),
        grupo_key = as.character(stats_df$grupo_key[i] %||% foda_vista),
        color = color,
        score_mean = round(as.numeric(stats_df$score_mean[i]), 2),
        score_sd = round(as.numeric(stats_df$score_sd[i] %||% 0), 2),
        n_valid = as.integer(stats_df$n_valid[i]),
        cuadrante = as.character(stats_df$cuadrante[i] %||% NA_character_),
        is_total_global = isTRUE(stats_df$is_total_global[i])
      )
      if (!is.null(icon_map[[key_i]])) out$icono_url <- icon_map[[key_i]]
      out
    })

    counts <- list(
      fortaleza   = sum(stats_df$cuadrante == "fortaleza",  na.rm = TRUE),
      oportunidad = sum(stats_df$cuadrante == "oportunidad", na.rm = TRUE),
      debilidad   = sum(stats_df$cuadrante == "debilidad",  na.rm = TRUE),
      amenaza     = sum(stats_df$cuadrante == "amenaza",    na.rm = TRUE)
    )

    # Helpers locales: evitan llamar las closures ctx$label_idx /
    # ctx$label_var, que pueden tener environments rotos cuando el ctx
    # llega serializado de un proceso R distinto (caso deploy a HF Space
    # con .pulso pre-cacheado). Lookup directo al catálogo / instrumento.
    safe_label_idx <- function(v) {
      v <- as.character(v %||% "")[1]
      if (!nzchar(v)) return(NA_character_)
      cat_general <- ctx$catalog_general %||% list()
      cat_ind <- ctx$catalog_indicadores %||% list()
      lab <- cat_general[[v]]$label %||% cat_ind[[v]]$label
      if (!is.null(lab) && nzchar(as.character(lab))) return(as.character(lab))
      lab <- tryCatch(
        .obtener_label_var(v, ctx$instrumento, ctx$data),
        error = function(e) NULL
      )
      if (!is.null(lab) && nzchar(as.character(lab))) return(as.character(lab))
      v
    }
    safe_label_var <- function(v) {
      v <- as.character(v %||% "")[1]
      if (!nzchar(v)) return(NA_character_)
      lab <- tryCatch(
        .obtener_label_var(v, ctx$instrumento, ctx$data),
        error = function(e) NULL
      )
      if (!is.null(lab) && nzchar(as.character(lab))) return(as.character(lab))
      v
    }

    return(list(
      ready = TRUE,
      objetivo = safe_label_idx(metric_var),
      objetivo_id = metric_var,
      modo = modo,
      item_kind = foda_vista,
      item_label = view_label,
      card_mode = card_mode,
      item_var = item_var,
      item_var_label = safe_label_var(item_var),
      metric_var = metric_var,
      metric_label = safe_label_idx(metric_var),
      items = items,
      cortes = list(
        score = round(as.numeric(corte_score), 2),
        sd = round(as.numeric(corte_sd), 2)
      ),
      counts = lapply(counts, as.integer),
      group_colors = group_colors,
      icon_legend = list(),
      semaforo = semaforo_payload()
    ))
  }

  cruce <- as.character(cruce %||% "")[1]
  cruce_valido <- nzchar(cruce) && cruce %in% names(df)
  include_total <- if (is.null(incluir_total)) TRUE else isTRUE(incluir_total)

  w <- .dim_safe_weights(df, NULL)
  groups <- list()
  if (include_total || !cruce_valido) {
    groups[[length(groups) + 1L]] <- list(
      key = "__total__",
      label = "Total",
      mask = rep(TRUE, nrow(df)),
      is_total_global = TRUE
    )
  }

  if (cruce_valido) {
    cats <- .dim_categorias_var(
      df,
      cruce,
      w = w,
      data_ref = ctx$data,
      instrumento = ctx$instrumento,
      max_levels = ctx$max_categorias_principal %||% 12L
    )
    x_cruce <- trimws(as.character(df[[cruce]]))
    if (nrow(cats$rows)) {
      for (i in seq_len(nrow(cats$rows))) {
        key_i <- as.character(cats$rows$value[i] %||% "")
        if (!nzchar(key_i)) next
        groups[[length(groups) + 1L]] <- list(
          key = key_i,
          label = as.character(cats$rows$label[i] %||% key_i),
          mask = !is.na(x_cruce) & nzchar(x_cruce) & x_cruce == key_i,
          is_total_global = FALSE
        )
      }
    }
  }

  if (!length(groups)) return(empty_payload())

  stats_list <- lapply(groups, function(g) {
    if (!any(g$mask)) return(NULL)
    out <- .foda_compute_stats(
      df[g$mask, , drop = FALSE],
      vars = vars,
      labels = labels,
      usar_pesos = FALSE,
      weight_col = NULL
    )
    if (!nrow(out)) return(NULL)
    out$grupo_key <- as.character(g$key)
    out$grupo <- as.character(g$label)
    out$is_total_global <- isTRUE(g$is_total_global)
    out
  })
  stats_list <- stats_list[vapply(stats_list, function(x) !is.null(x), logical(1))]
  if (!length(stats_list)) return(empty_payload())
  stats_df <- do.call(rbind, stats_list)

  # Cortes: corte_score = amber_max del semáforo (default 80);
  # corte_sd = mediana de SDs (excluye NAs).
  corte_score <- as.numeric(ctx$semaforo$amber_max %||% 80)
  sds_valid <- stats_df$score_sd[!is.na(stats_df$score_sd)]
  corte_sd <- if (length(sds_valid)) stats::median(sds_valid) else 0

  stats_df <- .foda_classify(stats_df, corte_score, corte_sd)

  group_ref <- unique(stats_df[, c("grupo", "grupo_key"), drop = FALSE])
  palette_override <- if (cruce_valido) .dashboard_palette_for_var(cruce, s$rp_inst, s) else NULL
  group_colors_vec <- .dim_group_colors(
    groups = as.character(group_ref$grupo),
    paleta_radar = ctx$paleta_radar,
    total_color = ctx$theme_color,
    palette_override = palette_override,
    group_keys = as.character(group_ref$grupo_key)
  )
  group_colors <- if (length(group_colors_vec)) {
    stats::setNames(as.list(as.character(group_colors_vec)), names(group_colors_vec))
  } else list()

  # Iconos opcionales por dimensión — overrides del config ganan sobre el
  # paquete (mismo helper centralizado).
  icon_map <- if (iconos_enabled) {
    overrides_dim <- if (is.list(cfg_dash$dim_axis_icons)) cfg_dash$dim_axis_icons else NULL
    .dashboard_dim_axis_icons(obj, tint_color = icon_tint, overrides = overrides_dim)
  } else list()
  icon_legend <- lapply(seq_along(vars), function(i) {
    uri <- icon_map[[vars[i]]] %||% ""
    if (!nzchar(uri)) return(NULL)
    list(var = vars[i], label = labels[i], icono_url = uri)
  })
  icon_legend <- Filter(Negate(is.null), icon_legend)

  items <- lapply(seq_len(nrow(stats_df)), function(i) {
    var <- as.character(stats_df$var[i])
    grupo <- as.character(stats_df$grupo[i] %||% "Total")
    color <- if (grupo %in% names(group_colors_vec)) {
      as.character(group_colors_vec[[grupo]])
    } else {
      as.character(ctx$theme_color %||% "#0E3B74")
    }
    out <- list(
      var = var,
      axis_label = as.character(stats_df$label[i]),
      item_kind = "conductores",
      grupo = grupo,
      grupo_key = as.character(stats_df$grupo_key[i] %||% grupo),
      color = color,
      score_mean = round(as.numeric(stats_df$score_mean[i]), 2),
      score_sd = round(as.numeric(stats_df$score_sd[i] %||% 0), 2),
      n_valid = as.integer(stats_df$n_valid[i]),
      cuadrante = as.character(stats_df$cuadrante[i] %||% NA_character_),
      is_total_global = isTRUE(stats_df$is_total_global[i])
    )
    if (!is.null(icon_map[[var]])) out$icono_url <- icon_map[[var]]
    out
  })

  counts <- list(
    fortaleza   = sum(stats_df$cuadrante == "fortaleza",  na.rm = TRUE),
    oportunidad = sum(stats_df$cuadrante == "oportunidad", na.rm = TRUE),
    debilidad   = sum(stats_df$cuadrante == "debilidad",  na.rm = TRUE),
    amenaza     = sum(stats_df$cuadrante == "amenaza",    na.rm = TRUE)
  )

  list(
    ready = TRUE,
    objetivo = as.character(obj$label %||% objetivo),
    objetivo_id = as.character(objetivo),
    modo = modo,
    item_kind = "conductores",
    items = items,
    cortes = list(
      score = round(as.numeric(corte_score), 2),
      sd = round(as.numeric(corte_sd), 2)
    ),
    counts = lapply(counts, as.integer),
    group_colors = group_colors,
    icon_legend = icon_legend,
    semaforo = semaforo_payload()
  )
}

# ============================================================
# Matriz por unidad — filas = combinaciones (var_color, var_nombre),
# columnas = conductores del objetivo + indicador general (promedio
# simple de los conductores). Filtros respetados, filas con n=0 se
# eliminan. Iconos y colores reutilizan el sistema de FODA (color por
# valor de var_color y data-uri de cfg_dash$foda_service_icons +
# foda_views[?].icons cuando la variable coincide).
# ============================================================
.dashboard_dim_matriz_unidades <- function(s, modo, objetivo,
                                           var_color, var_nombre = NULL,
                                           filtros = list()) {
  if (!.dashboard_dim_ready(s)) return(list(ready = FALSE))
  ctx <- .dashboard_dim_ctx(s$id, s)
  if (is.null(ctx)) return(list(ready = FALSE))

  modo <- match.arg(as.character(modo %||% "general")[1],
                    c("general", "indicadores"))
  obj_map <- if (identical(modo, "indicadores")) ctx$catalog_indicadores else ctx$catalog_general
  if (!(objetivo %in% names(obj_map))) {
    return(list(ready = TRUE, error = "Objetivo no existe en el catálogo."))
  }
  obj <- obj_map[[objetivo]]

  vars <- as.character(obj$axis_vars %||% character(0))
  labels <- as.character(obj$axis_labels %||% vars)
  keep_vars <- vars %in% names(ctx$data)
  vars <- vars[keep_vars]
  labels <- labels[keep_vars]
  if (!length(vars)) {
    return(list(ready = TRUE, error = "El objetivo no tiene conductores en la base."))
  }

  var_color <- as.character(var_color %||% "")[1]
  var_nombre <- as.character(var_nombre %||% "")[1]
  if (!nzchar(var_color)) {
    return(list(ready = TRUE, error = "Falta la variable de color (1ª columna)."))
  }

  df <- .dim_apply_filters(ctx$data, filters = filtros %||% list())
  if (!nrow(df)) return(list(ready = TRUE, error = "Sin datos tras aplicar los filtros."))
  if (!(var_color %in% names(df))) {
    return(list(ready = TRUE, error = paste0("La variable '", var_color, "' no está en la base.")))
  }
  # Sem ́antica del 2do select:
  #   - Si vac ́ıo: sin icono ni texto secundario.
  #   - Si == var_color: NO cruza (no tiene sentido), pero el icono se busca
  #     por valor de var_color (= var_nombre). Sin texto secundario.
  #   - Si distinto: cruza var_color × var_nombre. Texto secundario = label
  #     de var_nombre. Icono por valor de var_nombre.
  has_icono <- nzchar(var_nombre) && (var_nombre %in% names(df))
  has_cruce <- has_icono && !identical(var_nombre, var_color)
  icono_var <- if (has_icono) var_nombre else ""
  # has_nombre conservado por compat con downstream del payload (texto
  # secundario en la card). Solo TRUE cuando hay cruce real.
  has_nombre <- has_cruce

  # Categorías ordenadas (orden del cuestionario / etiquetas oficiales).
  color_cats <- .dim_categorias_var(
    df, var_color, w = .dim_safe_weights(df, NULL),
    data_ref = ctx$data, instrumento = ctx$instrumento,
    max_levels = 60L
  )
  if (!nrow(color_cats$rows)) {
    return(list(ready = TRUE, error = "La variable de color no tiene valores válidos."))
  }
  nombre_cats <- if (has_nombre) {
    .dim_categorias_var(
      df, var_nombre, w = .dim_safe_weights(df, NULL),
      data_ref = ctx$data, instrumento = ctx$instrumento,
      max_levels = 60L
    )
  } else NULL

  x_color <- trimws(as.character(df[[var_color]]))
  x_nombre <- if (has_nombre) trimws(as.character(df[[var_nombre]])) else rep("", nrow(df))

  filas <- list()
  for (i in seq_len(nrow(color_cats$rows))) {
    color_key <- as.character(color_cats$rows$value[i] %||% "")
    color_label <- as.character(color_cats$rows$label[i] %||% color_key)
    if (!nzchar(color_key)) next

    if (has_nombre) {
      for (j in seq_len(nrow(nombre_cats$rows))) {
        nombre_key <- as.character(nombre_cats$rows$value[j] %||% "")
        nombre_label <- as.character(nombre_cats$rows$label[j] %||% nombre_key)
        if (!nzchar(nombre_key)) next
        mask <- !is.na(x_color) & x_color == color_key &
                !is.na(x_nombre) & x_nombre == nombre_key
        if (!any(mask)) next
        sub <- df[mask, , drop = FALSE]
        scores <- list()
        score_means <- numeric(0)
        for (k in seq_along(vars)) {
          vals <- suppressWarnings(as.numeric(sub[[vars[k]]]))
          vals <- vals[!is.na(vals) & is.finite(vals)]
          if (length(vals)) {
            m <- round(mean(vals), 2)
            scores[[labels[k]]] <- m
            score_means <- c(score_means, m)
          } else {
            scores[[labels[k]]] <- NULL
          }
        }
        indicador_general <- if (length(score_means)) round(mean(score_means), 2) else NULL
        filas[[length(filas) + 1L]] <- list(
          key = paste0(color_key, "::", nombre_key),
          color_key = color_key,
          color_label = color_label,
          nombre_key = nombre_key,
          nombre_label = nombre_label,
          icono_key = nombre_key,
          icono_label = nombre_label,
          n = sum(mask),
          indicador_general = indicador_general,
          scores = scores
        )
      }
    } else {
      mask <- !is.na(x_color) & x_color == color_key
      if (!any(mask)) next
      sub <- df[mask, , drop = FALSE]
      scores <- list()
      score_means <- numeric(0)
      for (k in seq_along(vars)) {
        vals <- suppressWarnings(as.numeric(sub[[vars[k]]]))
        vals <- vals[!is.na(vals) & is.finite(vals)]
        if (length(vals)) {
          m <- round(mean(vals), 2)
          scores[[labels[k]]] <- m
          score_means <- c(score_means, m)
        } else {
          scores[[labels[k]]] <- NULL
        }
      }
      indicador_general <- if (length(score_means)) round(mean(score_means), 2) else NULL
      # En el caso no-cruce, el icono se busca por el valor del color
      # (cualquier vista FODA con un ícono cuya clave coincida con este
      # valor lo aporta). Sin texto secundario.
      filas[[length(filas) + 1L]] <- list(
        key = color_key,
        color_key = color_key,
        color_label = color_label,
        nombre_key = "",
        nombre_label = "",
        icono_key = color_key,
        icono_label = color_label,
        n = sum(mask),
        indicador_general = indicador_general,
        scores = scores
      )
    }
  }

  if (!length(filas)) {
    return(list(ready = TRUE, error = "Sin filas con datos tras aplicar los filtros."))
  }

  # Colores por valor de var_color — mismo helper que FODA.
  cfg_dash <- .dashboard_config_with_defaults(s$dashboard_config)
  color_ref <- unique(data.frame(
    grupo_key = vapply(filas, function(f) as.character(f$color_key), character(1)),
    grupo = vapply(filas, function(f) as.character(f$color_label), character(1)),
    stringsAsFactors = FALSE
  ))
  palette_override <- .dashboard_palette_for_var(var_color, s$rp_inst, s)
  color_vec <- .dim_group_colors(
    groups = as.character(color_ref$grupo),
    paleta_radar = ctx$paleta_radar,
    total_color = ctx$theme_color,
    palette_override = palette_override,
    group_keys = as.character(color_ref$grupo_key)
  )
  group_colors <- if (length(color_vec)) {
    stats::setNames(as.list(as.character(color_vec)), names(color_vec))
  } else list()

  # Íconos: cosechamos TODAS las fuentes del config (foda_service_icons
  # legacy + icons de TODAS las vistas FODA) y luego matcheamos por
  # value/label de cada fila. Esto replica el espíritu del FODA: si
  # subiste íconos para "ULE", "CIAM"…, aparecen en cualquier vista que
  # tenga esos valores — no nos atamos a `view$variable == X` que es
  # propenso a desajustes (mayúsculas/labels/etc).
  icon_tint <- as.character(cfg_dash$foda_icon_tint %||% "#FFFFFF")[1]
  if (!nzchar(trimws(icon_tint)) ||
      inherits(try(grDevices::col2rgb(icon_tint), silent = TRUE), "try-error")) {
    icon_tint <- "#FFFFFF"
  }
  icon_sources <- list()
  if (is.list(cfg_dash$foda_service_icons)) {
    icon_sources <- utils::modifyList(icon_sources, cfg_dash$foda_service_icons, keep.null = TRUE)
  }
  if (is.list(cfg_dash$foda_views)) {
    for (view in cfg_dash$foda_views) {
      if (!is.list(view)) next
      if (is.list(view$icons) && length(view$icons)) {
        icon_sources <- utils::modifyList(icon_sources, view$icons, keep.null = TRUE)
      }
    }
  }

  # Construir mapa key → data-uri y leyenda (key, label, icono_url) sobre
  # los valores realmente presentes en las filas. Si ninguna fila matchea
  # un ícono, icon_map e icon_legend quedan vacíos y el frontend cae a
  # "solo color".
  icon_map <- list()
  icon_legend <- list()
  if (length(icon_sources)) {
    icono_seen <- character(0)
    for (f in filas) {
      ikey <- as.character(f$icono_key %||% "")
      ilabel <- as.character(f$icono_label %||% ikey)
      if (!nzchar(ikey) || ikey %in% icono_seen) next
      icono_seen <- c(icono_seen, ikey)
      raw <- icon_sources[[ikey]] %||% icon_sources[[ilabel]]
      uri <- .dashboard_dim_icon_data_uri(raw, tint_color = icon_tint)
      if (nzchar(uri)) {
        icon_map[[ikey]] <- uri
        icon_legend[[length(icon_legend) + 1L]] <- list(
          key = ikey,
          label = ilabel,
          icono_url = uri
        )
      }
    }
  }
  # Si efectivamente hay íconos, exponer la variable que los rige para la
  # leyenda del frontend (label de "qué representan los íconos"). Si solo
  # hay var_color, ése es el contexto. Si hay var_nombre cruzado, ése.
  icono_var_efectiva <- if (length(icon_map)) {
    if (has_cruce) var_nombre else var_color
  } else ""

  semaforo_payload <- list(
    red_max = as.numeric(ctx$semaforo$red_max %||% 60),
    amber_max = as.numeric(ctx$semaforo$amber_max %||% 80),
    red_color = as.character(ctx$semaforo$red_color %||% "#D84B55"),
    amber_color = as.character(ctx$semaforo$amber_color %||% "#E0B44C"),
    green_color = as.character(ctx$semaforo$green_color %||% "#3A9A5B"),
    na_color = as.character(ctx$semaforo$na_color %||% "#CCCCCC")
  )

  # Helper: resuelve label de variable sin depender de ctx$label_var
  # (closure que puede romper al deserializar entre procesos R distintos).
  safe_var_label <- function(v) {
    v <- as.character(v %||% "")[1]
    if (!nzchar(v)) return("")
    lab <- tryCatch(
      .obtener_label_var(v, ctx$instrumento, ctx$data),
      error = function(e) NULL
    )
    if (!is.null(lab) && nzchar(as.character(lab))) as.character(lab) else v
  }

  list(
    ready = TRUE,
    objetivo = as.character(obj$label %||% objetivo),
    objetivo_id = as.character(objetivo),
    modo = modo,
    var_color = var_color,
    var_color_label = safe_var_label(var_color),
    var_nombre = if (has_nombre) var_nombre else "",
    var_nombre_label = if (has_nombre) safe_var_label(var_nombre) else "",
    var_icono = icono_var_efectiva,
    var_icono_label = if (nzchar(icono_var_efectiva)) safe_var_label(icono_var_efectiva) else "",
    conductores = lapply(seq_along(vars), function(i) {
      list(var = as.character(vars[i]), label = as.character(labels[i]))
    }),
    filas = filas,
    group_colors = group_colors,
    icons = icon_map,
    icon_legend = icon_legend,
    semaforo = semaforo_payload
  )
}

# Defaults de íconos (sin overrides del usuario) para un objetivo —
# alimenta el panel "Personalizar → Íconos" para que el usuario VEA los
# íconos del paquete antes de decidir si los reemplaza.
.dashboard_dim_iconos_defaults <- function(s, modo, objetivo) {
  if (!.dashboard_dim_ready(s)) return(list(ready = FALSE, conductores = list()))
  ctx <- .dashboard_dim_ctx(s$id, s)
  if (is.null(ctx)) return(list(ready = FALSE, conductores = list()))
  modo <- match.arg(as.character(modo %||% "general")[1], c("general", "indicadores"))
  obj_map <- if (identical(modo, "indicadores")) ctx$catalog_indicadores else ctx$catalog_general
  if (!nzchar(objetivo) || !(objetivo %in% names(obj_map))) {
    return(list(ready = TRUE, conductores = list(), error = "Objetivo no existe."))
  }
  obj <- obj_map[[objetivo]]
  vars <- as.character(obj$axis_vars %||% character(0))
  labels <- as.character(obj$axis_labels %||% vars)
  # Sin overrides — solo defaults del paquete.
  pkg_icons <- tryCatch(
    .dashboard_dim_axis_icons(obj, tint_color = NULL, overrides = NULL),
    error = function(e) list()
  )
  conductores <- lapply(seq_along(vars), function(i) {
    list(
      var = as.character(vars[i]),
      label = as.character(labels[i]),
      icono_url = as.character(pkg_icons[[vars[i]]] %||% "")
    )
  })
  list(
    ready = TRUE,
    objetivo = as.character(obj$label %||% objetivo),
    objetivo_id = as.character(objetivo),
    modo = modo,
    conductores = conductores
  )
}

# Categorías de una variable para iteración (selector de nivel actual).
.dashboard_dim_categorias_var <- function(s, var) {
  if (!.dashboard_dim_ready(s) || !nzchar(var)) return(list())
  if (!(var %in% names(s$rp_dim))) return(list())

  ctx <- .dashboard_dim_ctx(s$id, s)
  if (is.null(ctx)) return(list())

  cats <- .dim_categorias_var(
    s$rp_dim,
    var,
    w = .dim_safe_weights(s$rp_dim, NULL),
    data_ref = ctx$data,
    instrumento = ctx$instrumento,
    max_levels = ctx$max_niveles_iteracion %||% 12L
  )
  if (!nrow(cats$rows)) return(list())
  lapply(seq_len(nrow(cats$rows)), function(i) {
    list(
      value = as.character(cats$rows$value[i]),
      label = as.character(cats$rows$label[i]),
      base = as.numeric(cats$rows$base[i] %||% 0)
    )
  })
}
