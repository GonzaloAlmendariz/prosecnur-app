# =============================================================================
# Reporte HTML autocontenido de validación (Sprint 5 — stretch)
# =============================================================================
# Genera un HTML standalone (sin dependencias externas: CSS inline, sin
# fuentes web, sin JS) que consolida el estado de validación de una base:
# progreso, KPIs, top reglas violadas, top variables, y reglas custom.
#
# Diseñado para compartirse con el cliente sin necesidad de enviar el
# workspace completo. Al estar todo embebido, funciona abriendo el HTML
# en cualquier navegador sin conexión a internet.
#
# Uso:
#   html <- build_report_html(scope, base_nombre = "docentes",
#                              estudio_nombre = "Acreditación PUCP")
#   writeLines(html, "reporte.html")
#
# El router_validacion expone esto como POST /api/validacion/v2/report/html.

# -----------------------------------------------------------------------------
# Helpers de formato
# -----------------------------------------------------------------------------
.report_fmt_int <- function(x) {
  if (is.null(x) || is.na(x)) return("—")
  format(as.integer(x), big.mark = ",", scientific = FALSE)
}

.report_sev_class <- function(sev) {
  if (is.null(sev) || is.na(sev)) return("neutral")
  s <- tolower(as.character(sev))
  if (s %in% c("success", "warn", "danger", "neutral")) s else "neutral"
}

# Escape HTML seguro. Preferimos htmltools si está, sino un fallback
# manual conservador.
.report_escape <- function(x) {
  if (requireNamespace("htmltools", quietly = TRUE)) {
    return(as.character(htmltools::htmlEscape(as.character(x), attribute = FALSE)))
  }
  s <- as.character(x)
  s <- gsub("&", "&amp;", s, fixed = TRUE)
  s <- gsub("<", "&lt;",  s, fixed = TRUE)
  s <- gsub(">", "&gt;",  s, fixed = TRUE)
  s <- gsub('"', "&quot;", s, fixed = TRUE)
  s
}

# -----------------------------------------------------------------------------
# Secciones del reporte
# -----------------------------------------------------------------------------
.report_kpi_cards <- function(kpis) {
  if (!length(kpis)) return("")
  cards <- vapply(kpis, function(k) {
    sev <- .report_sev_class(k$meta$severidad %||% "neutral")
    value <- if (is.null(k$meta$value) || is.na(k$meta$value)) "—"
             else as.character(k$meta$value)
    sub <- if (!is.null(k$subtitle) && !is.na(k$subtitle)) k$subtitle else ""
    sprintf(
      '<div class="kpi kpi-%s"><div class="kpi-title">%s</div><div class="kpi-value">%s</div>%s</div>',
      sev,
      .report_escape(k$title),
      .report_escape(value),
      if (nzchar(sub)) sprintf('<div class="kpi-sub">%s</div>', .report_escape(sub)) else ""
    )
  }, character(1))
  paste0('<div class="kpi-grid">', paste(cards, collapse = ""), '</div>')
}

.report_top_reglas_table <- function(scope) {
  ev <- scope$evaluacion
  resumen <- ev$resumen
  if (is.null(resumen) || !nrow(resumen)) {
    return('<p class="empty">Sin auditoría corrida todavía.</p>')
  }
  id_col <- if ("id_regla" %in% names(resumen)) "id_regla" else "ID"
  name_col <- if ("nombre_regla" %in% names(resumen)) "nombre_regla" else "Nombre de regla"
  if (!(id_col %in% names(resumen))) id_col <- NA
  n_col <- "n_inconsistencias"
  if (!(n_col %in% names(resumen))) return('<p class="empty">Resumen de auditoría en formato inesperado.</p>')

  ord <- order(-as.integer(resumen[[n_col]]), na.last = TRUE)
  top <- resumen[ord, , drop = FALSE]
  top <- top[as.integer(top[[n_col]]) > 0L, , drop = FALSE]
  top <- utils::head(top, 20L)
  if (!nrow(top)) return('<p class="empty">Ninguna regla arroja inconsistencias.</p>')

  rows <- vapply(seq_len(nrow(top)), function(i) {
    id_v <- if (is.na(id_col)) sprintf("R%03d", i) else as.character(top[[id_col]][i])
    nombre <- if (name_col %in% names(top)) as.character(top[[name_col]][i]) else id_v
    n <- as.integer(top[[n_col]][i])
    sprintf('<tr><td class="mono">%s</td><td>%s</td><td class="num">%s</td></tr>',
            .report_escape(id_v), .report_escape(nombre), .report_fmt_int(n))
  }, character(1))

  paste0(
    '<table class="tbl"><thead><tr><th>ID</th><th>Regla</th><th class="num">Casos</th></tr></thead><tbody>',
    paste(rows, collapse = ""),
    "</tbody></table>"
  )
}

.report_reglas_custom_list <- function(scope) {
  rc <- scope$reglas_custom %||% list()
  if (!length(rc)) return('<p class="empty">No hay reglas personalizadas definidas.</p>')
  items <- vapply(rc, function(r) {
    activa <- isTRUE(r$activa %||% TRUE)
    tipo <- as.character(r$tipo %||% "—")
    nombre <- as.character(r$nombre %||% (r$id %||% "(sin nombre)"))
    mensaje <- as.character(r$mensaje %||% "")
    badge <- if (activa) '<span class="badge ok">Activa</span>'
             else '<span class="badge off">Ignorada</span>'
    sprintf(
      '<li>%s <strong>%s</strong> <span class="mono muted">%s</span>%s</li>',
      badge, .report_escape(nombre), .report_escape(tipo),
      if (nzchar(mensaje)) sprintf('<div class="muted small">%s</div>', .report_escape(mensaje)) else ""
    )
  }, character(1))
  paste0("<ul class=\"rc-list\">", paste(items, collapse = ""), "</ul>")
}

.report_progreso_checklist <- function(scope) {
  plan_ok <- !is.null(scope$plan_result)
  audit_ok <- !is.null(scope$evaluacion)
  n_custom <- length(scope$reglas_custom %||% list())

  chk <- function(ok, label) {
    icon <- if (ok) "&#10003;" else "&#9633;"
    css <- if (ok) "done" else "pending"
    sprintf('<li class="%s">%s %s</li>', css, icon, .report_escape(label))
  }

  paste0(
    '<ul class="checklist">',
    chk(plan_ok, "Plan de limpieza construido"),
    chk(audit_ok, "Auditoría de consistencia ejecutada"),
    chk(n_custom > 0L, sprintf("Reglas custom definidas (%d)", n_custom)),
    "</ul>"
  )
}

# -----------------------------------------------------------------------------
# CSS inline — paleta espejo de la UI Prosecnur
# -----------------------------------------------------------------------------
.report_css <- function() {
  '
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #18211f;
    background: #f7f4ee;
    line-height: 1.5;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 24px 80px; }
  header.top {
    border-bottom: 2px solid #d9d2c4;
    margin-bottom: 28px;
    padding-bottom: 16px;
  }
  header.top h1 { font-size: 26px; margin: 0 0 4px; font-weight: 700; }
  header.top .meta { color: #64748b; font-size: 13px; }
  h2 { font-size: 18px; margin: 28px 0 12px; color: #1f2937; }
  h2 .n { color: #64748b; font-weight: 500; font-size: 14px; margin-left: 6px; }
  p.empty { color: #64748b; font-style: italic; font-size: 13px; margin: 8px 0; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin: 12px 0;
  }
  .kpi {
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid #d9d2c4;
    background: #fffdf8;
  }
  .kpi-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #64748b;
    margin-bottom: 6px;
  }
  .kpi-value {
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .kpi-sub { font-size: 11px; color: #64748b; margin-top: 6px; }
  .kpi-success { border-color: #86efac; background: #f0fdf4; }
  .kpi-success .kpi-value { color: #166534; }
  .kpi-warn { border-color: #fcd34d; background: #fffbeb; }
  .kpi-warn .kpi-value { color: #92400e; }
  .kpi-danger { border-color: #fca5a5; background: #fef2f2; }
  .kpi-danger .kpi-value { color: #991b1b; }
  .kpi-neutral .kpi-value { color: #1f2937; }
  .checklist { list-style: none; padding: 0; margin: 8px 0; }
  .checklist li {
    padding: 6px 0;
    font-size: 14px;
    border-bottom: 1px dashed #e5e7eb;
  }
  .checklist li:last-child { border-bottom: none; }
  .checklist li.done { color: #166534; }
  .checklist li.pending { color: #64748b; }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    background: #fffdf8;
    border: 1px solid #d9d2c4;
    border-radius: 6px;
    overflow: hidden;
  }
  .tbl th {
    text-align: left;
    padding: 10px 12px;
    background: #eeebe4;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #475569;
    border-bottom: 1px solid #d9d2c4;
  }
  .tbl th.num, .tbl td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .tbl td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0ebdf; }
  .tbl tr:last-child td { border-bottom: none; }
  .tbl td.mono, .mono { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: #475569; }
  .rc-list { list-style: none; padding: 0; margin: 8px 0; }
  .rc-list li {
    padding: 10px 12px;
    border: 1px solid #d9d2c4;
    border-radius: 6px;
    margin-bottom: 8px;
    background: #fffdf8;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-right: 6px;
  }
  .badge.ok { background: #dcfce7; color: #166534; }
  .badge.off { background: #f1f5f9; color: #64748b; }
  .muted { color: #64748b; }
  .small { font-size: 12px; }
  footer.foot {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #d9d2c4;
    color: #94a3b8;
    font-size: 11px;
    text-align: center;
  }
  '
}

# -----------------------------------------------------------------------------
# Builder principal
# -----------------------------------------------------------------------------
build_report_html <- function(scope,
                               base_nombre = NULL,
                               estudio_nombre = NULL,
                               generated_at = Sys.time()) {
  pan <- build_panorama(scope)

  title <- "Reporte de validación"
  meta_line <- paste(
    c(
      if (!is.null(estudio_nombre) && nzchar(estudio_nombre)) paste("Estudio:", estudio_nombre),
      if (!is.null(base_nombre) && nzchar(base_nombre)) paste("Base:", base_nombre),
      format(generated_at, "%Y-%m-%d %H:%M")
    ),
    collapse = " · "
  )

  version_app <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) "dev"
  )

  body <- paste0(
    '<div class="wrap">',
    '<header class="top">',
      '<h1>', .report_escape(title), '</h1>',
      '<div class="meta">', .report_escape(meta_line), '</div>',
    '</header>',

    '<h2>Progreso</h2>',
    .report_progreso_checklist(scope),

    '<h2>Indicadores principales</h2>',
    .report_kpi_cards(pan$kpis),

    '<h2>Top reglas con más casos</h2>',
    .report_top_reglas_table(scope),

    '<h2>Reglas personalizadas</h2>',
    .report_reglas_custom_list(scope),

    '<footer class="foot">Generado por Prosecnur v', .report_escape(version_app), '</footer>',
    '</div>'
  )

  paste0(
    '<!doctype html>\n',
    '<html lang="es">\n<head>\n',
    '<meta charset="utf-8">\n',
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n',
    '<title>', .report_escape(title), '</title>\n',
    '<style>', .report_css(), '</style>\n',
    '</head>\n<body>\n',
    body,
    '\n</body>\n</html>\n'
  )
}
