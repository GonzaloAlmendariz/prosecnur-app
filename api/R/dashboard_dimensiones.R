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
    cfg_id = digest::digest(s$dimensiones_config %||% list())
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
