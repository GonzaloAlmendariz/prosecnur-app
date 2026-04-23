# =============================================================================
# Tema visual compartido para outputs Plotly
# =============================================================================
# Base común para vistas React (Validación) y módulos legacy que siguen
# usando plotly::renderPlotly (Resumen / relación / dimensiones).
# En esta iteración lo consume directamente Validación; los módulos legacy
# quedan preparados para adoptar el mismo lenguaje visual después.

pulso_plotly_palette <- function() {
  list(
    primary = "#002457",
    primary_bright = "#2457d6",
    success = "#16a34a",
    warn = "#d97706",
    danger = "#dc2626",
    neutral = "#94a3b8",
    bg = "#ffffff",
    surface = "#f8faff",
    border = "#d8e0ef",
    grid = "#dbe3f1",
    text = "#1f2933",
    text_soft = "#5f6b7a",
    hover_bg = "#0f172a",
    hover_fg = "#f8fafc"
  )
}

.pulso_drop_nulls <- function(x) {
  if (!is.list(x)) return(x)
  x[!vapply(x, is.null, logical(1))]
}

pulso_plotly_axis <- function(title = NULL, automargin = TRUE,
                               zeroline = FALSE, gridcolor = NULL,
                               autorange = NULL, tickangle = NULL, side = NULL) {
  pal <- pulso_plotly_palette()
  .pulso_drop_nulls(list(
    automargin = automargin,
    zeroline = zeroline,
    gridcolor = gridcolor %||% pal$grid,
    autorange = autorange,
    tickangle = tickangle,
    side = side,
    tickfont = list(
      family = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      size = 11,
      color = pal$text_soft
    ),
    title = if (!is.null(title)) {
      list(
        text = as.character(title),
        font = list(
          family = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          size = 11,
          color = pal$text_soft
        ),
        standoff = 12
      )
    } else NULL
  ))
}

pulso_plotly_layout_base <- function(height = NULL, margin = NULL,
                                      showlegend = TRUE, legend = NULL) {
  pal <- pulso_plotly_palette()
  .pulso_drop_nulls(list(
    font = list(
      family = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      size = 12,
      color = pal$text
    ),
    paper_bgcolor = pal$bg,
    plot_bgcolor = pal$bg,
    hoverlabel = list(
      bgcolor = pal$hover_bg,
      bordercolor = pal$hover_bg,
      font = list(
        family = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        size = 11,
        color = pal$hover_fg
      )
    ),
    margin = margin %||% list(l = 72, r = 24, t = 16, b = 52),
    showlegend = showlegend,
    legend = utils::modifyList(list(
      orientation = "h",
      y = -0.18,
      x = 0.5,
      xanchor = "center",
      font = list(
        family = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        size = 11,
        color = pal$text_soft
      )
    ), legend %||% list()),
    separators = ",.",
    height = height
  ))
}

pulso_plotly_config_base <- function() {
  list(
    displayModeBar = FALSE,
    responsive = TRUE,
    displaylogo = FALSE
  )
}
