# =============================================================================
# View descriptors para Fase 2 — Validación v2
# =============================================================================
# El backend arma objetos JSON con estructura estable (`ViewDescriptor`)
# que el frontend React renderiza con `react-plotly.js`. Cada helper `vd_*`
# retorna un named list con `version=1`, `kind`, `title`, `meta` y el payload
# plotly crudo (`data` + `layout`) listo para consumir.
#
# No importamos `plotly` — construimos los traces como listas simples para
# que `jsonlite::toJSON(auto_unbox=TRUE)` los serialice directamente.

# -----------------------------------------------------------------------------
# Paleta (espejo del tema interactivo_* para mantener consistencia visual)
# -----------------------------------------------------------------------------
.vd_palette <- list(
  primary   = "#2563eb",  # --pulso-primary
  primary_soft = "#dbeafe",
  success   = "#16a34a",
  warn      = "#f59e0b",
  danger    = "#dc2626",
  neutral   = "#94a3b8",
  bg        = "#ffffff",
  grid      = "#e5e7eb",
  text      = "#1f2937",
  text_soft = "#64748b"
)

# Paleta semafórica discretizada en 3 cortes — se usa para heatmap y KPIs
# con severidad. Mantiene el mismo criterio que interactivo_dimensiones.R
# para que el usuario encuentre colores familiares entre fases.
.vd_semaforo_color <- function(pct) {
  if (is.na(pct) || pct == 0) return(.vd_palette$success)
  if (pct < 0.05)            return(.vd_palette$success)
  if (pct < 0.20)            return(.vd_palette$warn)
  .vd_palette$danger
}

# -----------------------------------------------------------------------------
# vd_kpi_card — tarjeta KPI con número grande + etiqueta (sin plotly real)
# -----------------------------------------------------------------------------
# El frontend renderiza esto como card HTML (no hace plotly.plot), pero
# seguimos el mismo contrato de ViewDescriptor para homogeneidad.
vd_kpi_card <- function(title, value, subtitle = NULL,
                         severidad = c("neutral", "success", "warn", "danger"),
                         icon = NULL,
                         actions = list()) {
  sev <- match.arg(severidad)
  list(
    version = 1L,
    kind    = "kpi_card",
    title   = as.character(title),
    subtitle = if (!is.null(subtitle)) as.character(subtitle) else NA_character_,
    meta    = list(
      value     = value,
      severidad = sev,
      icon      = if (!is.null(icon)) as.character(icon) else NA_character_
    ),
    plotly  = list(data = list(), layout = list(), config = list(displayModeBar = FALSE)),
    actions = actions
  )
}

# -----------------------------------------------------------------------------
# vd_bar_h — barras horizontales (top N de algo)
# -----------------------------------------------------------------------------
# Input:
#   labels: chr vector — etiquetas (se muestran en el eje Y)
#   values: num vector — valores
#   ids: opcional, chr — se pasa como customdata para el click handler
#   color: chr — un color o un vector del mismo largo que labels (default primary)
#   x_title, y_title: strings
# Genera un trace "bar" con orientation="h".
vd_bar_h <- function(title, labels, values,
                      ids = NULL,
                      color = NULL,
                      x_title = NULL,
                      y_title = NULL,
                      subtitle = NULL,
                      actions = list(),
                      meta = list()) {
  labels <- as.character(labels)
  values <- as.numeric(values)
  # Invertir orden para que el top quede arriba (plotly dibuja de abajo a arriba).
  ord <- seq_along(labels)
  if (is.null(color) || length(color) == 0L) color <- .vd_palette$primary
  trace <- list(
    type = "bar",
    orientation = "h",
    x = values,
    y = labels,
    marker = list(color = color),
    hovertemplate = "%{y}<br><b>%{x}</b><extra></extra>"
  )
  if (!is.null(ids) && length(ids) == length(labels)) {
    trace$customdata <- as.character(ids)
  }
  layout <- list(
    margin = list(l = 180, r = 24, t = 16, b = 48),
    xaxis = list(
      title = if (!is.null(x_title)) list(text = as.character(x_title)) else NULL,
      gridcolor = .vd_palette$grid,
      zeroline = FALSE
    ),
    yaxis = list(
      title = if (!is.null(y_title)) list(text = as.character(y_title)) else NULL,
      automargin = TRUE,
      autorange = "reversed"  # primer elemento arriba
    ),
    plot_bgcolor = .vd_palette$bg,
    paper_bgcolor = .vd_palette$bg,
    showlegend = FALSE,
    height = max(220L, 28L * length(labels) + 80L)
  )
  list(
    version  = 1L,
    kind     = "bar_h",
    title    = as.character(title),
    subtitle = if (!is.null(subtitle)) as.character(subtitle) else NA_character_,
    meta     = meta,
    plotly   = list(
      data = list(trace),
      layout = layout,
      config = list(displayModeBar = FALSE, responsive = TRUE)
    ),
    actions  = actions
  )
}

# -----------------------------------------------------------------------------
# vd_heatmap_semaforo — heatmap con escala semafórica
# -----------------------------------------------------------------------------
# Input:
#   x: chr — categorías del eje X (ej. secciones)
#   y: chr — categorías del eje Y (ej. tipos de observación)
#   z: matrix numeric [length(y) x length(x)] — conteos
#   z_text: opcional, matrix mismo shape — texto a mostrar en cada celda.
# El cell-hover usa z+z_text. Colorscale semafórica (verde → ámbar → rojo).
vd_heatmap_semaforo <- function(title, x, y, z,
                                 z_text = NULL,
                                 subtitle = NULL,
                                 actions = list(),
                                 meta = list()) {
  x <- as.character(x)
  y <- as.character(y)
  if (!is.matrix(z)) z <- as.matrix(z)
  # Escala semafórica simple 0 → verde, medio → ámbar, alto → rojo.
  # Usamos "colorscale" como lista de pares [fracción, color].
  colorscale <- list(
    list(0,    "#16a34a"),  # success
    list(0.25, "#86efac"),  # light green
    list(0.50, "#fbbf24"),  # warn
    list(0.75, "#f97316"),  # orange
    list(1,    "#dc2626")   # danger
  )
  # Plotly heatmap espera z como array de arrays row-major: [[row1], [row2], ...].
  # `apply(z, 1, as.list)` en R retorna una matriz de listas que jsonlite no
  # serializa como esperamos. Construimos la lista a mano.
  z_matrix <- lapply(seq_len(nrow(z)), function(i) as.numeric(z[i, ]))
  trace <- list(
    type = "heatmap",
    x = x,
    y = y,
    z = z_matrix,
    colorscale = colorscale,
    showscale = TRUE,
    hovertemplate = "<b>%{y}</b> × <b>%{x}</b><br>%{z} casos<extra></extra>",
    xgap = 2, ygap = 2,
    zmin = 0
  )
  if (!is.null(z_text) && is.matrix(z_text)) {
    text_matrix <- lapply(seq_len(nrow(z_text)), function(i) as.character(z_text[i, ]))
    trace$text <- text_matrix
    trace$texttemplate <- "%{text}"
    trace$textfont <- list(color = "white", size = 11)
  }
  layout <- list(
    margin = list(l = 180, r = 24, t = 16, b = 60),
    xaxis = list(tickangle = -25, automargin = TRUE, side = "bottom"),
    yaxis = list(automargin = TRUE, autorange = "reversed"),
    plot_bgcolor = .vd_palette$bg,
    paper_bgcolor = .vd_palette$bg,
    height = max(240L, 32L * length(y) + 100L)
  )
  list(
    version  = 1L,
    kind     = "heatmap_semaforo",
    title    = as.character(title),
    subtitle = if (!is.null(subtitle)) as.character(subtitle) else NA_character_,
    meta     = meta,
    plotly   = list(
      data = list(trace),
      layout = layout,
      config = list(displayModeBar = FALSE, responsive = TRUE)
    ),
    actions  = actions
  )
}

# -----------------------------------------------------------------------------
# Helpers específicos para el resumen de `evaluar_consistencia()`
# -----------------------------------------------------------------------------
# Top-N reglas por n_inconsistencias. El resumen trae la lista ordenada
# por n desc (ya lo hace evaluar_consistencia); solo filtramos a las que
# tienen >0 violaciones.
.vd_top_reglas <- function(resumen, n = 20L) {
  if (is.null(resumen) || !nrow(resumen)) {
    return(vd_bar_h(
      title = "Top reglas violadas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "Aún no hay reglas con casos a reportar.")
    ))
  }
  ok <- resumen$n_inconsistencias > 0L & !is.na(resumen$n_inconsistencias)
  res <- resumen[ok, , drop = FALSE]
  if (!nrow(res)) {
    return(vd_bar_h(
      title = "Top reglas violadas",
      labels = character(), values = numeric(),
      meta = list(empty_hint = "Ninguna regla violó en esta corrida — todo OK.")
    ))
  }
  # Ordenar y tomar top N.
  res <- res[order(-res$n_inconsistencias), , drop = FALSE]
  head_n <- min(nrow(res), as.integer(n))
  res <- res[seq_len(head_n), , drop = FALSE]
  labels <- as.character(res$nombre_regla %||% res$id_regla)
  # Truncar labels muy largos para el eje.
  labels <- ifelse(
    nchar(labels) > 60L,
    paste0(substr(labels, 1L, 58L), "…"),
    labels
  )
  vd_bar_h(
    title = "Top reglas violadas",
    subtitle = sprintf("Mostrando %d de %d reglas con al menos un caso.",
                        head_n, sum(ok)),
    labels = labels,
    values = as.integer(res$n_inconsistencias),
    ids    = as.character(res$id_regla),
    color  = rep(.vd_palette$primary, head_n),
    x_title = "Casos inconsistentes",
    y_title = NULL,
    meta = list(total_con_casos = sum(ok))
  )
}

# Heatmap sección × tipo de observación. Agrega `n_inconsistencias` del
# `resumen`. Casillas vacías => 0.
.vd_heatmap_seccion_tipo <- function(resumen) {
  if (is.null(resumen) || !nrow(resumen)) {
    return(vd_heatmap_semaforo(
      title = "Inconsistencias por sección × tipo",
      x = character(), y = character(),
      z = matrix(numeric(), nrow = 0, ncol = 0),
      meta = list(empty_hint = "Corre la auditoría para ver el heatmap.")
    ))
  }
  sec <- as.character(resumen$seccion %||% "Sin sección")
  sec[is.na(sec) | sec == ""] <- "Sin sección"
  tip <- as.character(resumen$tipo_observacion %||% "Otros")
  tip[is.na(tip) | tip == ""] <- "Otros"
  n   <- as.integer(resumen$n_inconsistencias %||% 0L)
  n[is.na(n)] <- 0L
  # Agregar por (sec, tip).
  key <- paste(sec, tip, sep = "\u241F")  # separador improbable
  agg <- tapply(n, key, sum, na.rm = TRUE)
  parts <- strsplit(names(agg), "\u241F", fixed = TRUE)
  sec_v <- vapply(parts, `[`, character(1), 1L)
  tip_v <- vapply(parts, `[`, character(1), 2L)
  val_v <- as.integer(agg)
  # Construir matriz filas = tipos, cols = secciones.
  x <- sort(unique(sec_v))
  y <- sort(unique(tip_v))
  z <- matrix(0L, nrow = length(y), ncol = length(x), dimnames = list(y, x))
  for (i in seq_along(val_v)) {
    z[tip_v[i], sec_v[i]] <- val_v[i]
  }
  # Texto en la celda sólo si hay casos — celdas en 0 quedan limpias.
  zt <- ifelse(z > 0L, as.character(z), "")
  vd_heatmap_semaforo(
    title = "Inconsistencias por sección × tipo de observación",
    subtitle = sprintf("Total: %d casos en %d secciones × %d tipos.",
                        sum(z), length(x), length(y)),
    x = x, y = y, z = z, z_text = zt,
    meta = list(n_secciones = length(x), n_tipos = length(y))
  )
}
