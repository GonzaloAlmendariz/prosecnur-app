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
  rp_id <- digest::digest(list(
    n = nrow(s$rp_dim),
    cols = names(s$rp_dim),
    cfg_id = digest::digest(s$dimensiones_config %||% list()),
    theme_color = s$dashboard_config$color_primario_override
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
    theme_color = s$dashboard_config$color_primario_override
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
  secs <- .dashboard_curated_secciones(s)
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
          label = .obtener_label_var(v, s$rp_inst, s$rp_dim) %||% v
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
# a paths de PNG (definidos en config). Devuelve list nombrado por var.
.dashboard_dim_axis_icons <- function(obj, tint_color = NULL) {
  iconos <- obj$axis_iconos
  if (!is.list(iconos) || !length(iconos)) return(list())
  vars <- as.character(obj$axis_vars %||% character(0))
  labels <- as.character(obj$axis_labels %||% vars)
  out <- list()
  for (i in seq_along(vars)) {
    label <- labels[i]
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

  cfg_dash <- s$dashboard_config %||% .dashboard_default_config()
  if (is.list(foda_config) && length(foda_config)) {
    cfg_dash <- utils::modifyList(cfg_dash, foda_config)
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

  # Iconos opcionales por dimensión.
  icon_map <- if (iconos_enabled) .dashboard_dim_axis_icons(obj, tint_color = icon_tint) else list()
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
