#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)

arg_value <- function(flag, default = "") {
  hit <- which(args == flag)
  if (!length(hit) || hit[[1]] >= length(args)) return(default)
  args[[hit[[1]] + 1L]]
}

file_arg <- grep("^--file=", commandArgs(FALSE), value = TRUE)
script_path <- if (length(file_arg)) sub("^--file=", "", file_arg[[1]]) else file.path("scripts", "monitoreo-territorial-sheets-preview.R")
repo_root <- normalizePath(file.path(dirname(normalizePath(script_path, mustWork = FALSE)), ".."), mustWork = FALSE)
if (!file.exists(file.path(repo_root, "api", "tests", "testthat", "setup-load-all.R"))) {
  repo_root <- normalizePath(getwd(), mustWork = FALSE)
}

source(file.path(repo_root, "api", "tests", "testthat", "setup-load-all.R"))

html_escape <- function(x) {
  x <- as.character(x %||% "")
  x <- gsub("&", "&amp;", x, fixed = TRUE)
  x <- gsub("<", "&lt;", x, fixed = TRUE)
  x <- gsub(">", "&gt;", x, fixed = TRUE)
  x <- gsub('"', "&quot;", x, fixed = TRUE)
  x
}

row_values <- function(row) {
  values <- as.character(unlist(row %||% character(0), use.names = FALSE))
  values[is.na(values)] <- ""
  values
}

status_class <- function(value) {
  key <- .monitoreo_text_key(.monitoreo_scalar(value, ""))
  if (key %in% c("completa", "completo", "ok", "esperada", "completa con exceso", "excedida", "con exceso", "exceso")) return("status-ok")
  if (key %in% c("en campo", "en avance")) return("status-progress")
  if (key %in% c("pendiente", "cuota pendiente", "faltante")) return("status-warn")
  if (key %in% c("muy corta", "fuera de zona", "alta")) return("status-danger")
  if (key %in% c("por aplicar", "no iniciada", "sin avance", "sin responsable", "sin responsable observado", "sin configuracion", "no configurada", "sin informacion suficiente", "reemplazo sin uso")) return("status-muted")
  if (key %in% c("reemplazo usado", "registro observado")) return("status-progress")
  ""
}

render_cells <- function(values, header = character(), tag = "td") {
  paste(vapply(seq_along(values), function(i) {
    cls <- character(0)
    if (length(header) >= i && grepl("estado|tipo|sexo completo|edad completa|clasificacion|clasificación|prioridad|severidad", header[[i]], ignore.case = TRUE)) {
      cls <- status_class(values[[i]])
    }
    sprintf("<%s%s>%s</%s>", tag, if (length(cls) && nzchar(cls)) paste0(' class="', cls, '"') else "", html_escape(values[[i]]), tag)
  }, character(1)), collapse = "")
}

render_tab <- function(name, rows) {
  max_cols <- max(1L, max(vapply(rows %||% list(list("")), function(row) length(row %||% character(0)), integer(1))))
  html_rows <- character(0)
  current_header <- character(0)
  for (idx in seq_along(rows)) {
    values <- row_values(rows[[idx]])
    if (!length(values) || !any(nzchar(trimws(values)))) {
      html_rows <- c(html_rows, '<tr class="blank"><td></td></tr>')
      next
    }
    if (.monitoreo_sheets_is_section_row(rows[[idx]])) {
      current_header <- character(0)
      html_rows <- c(html_rows, sprintf('<tr class="section-row"><td colspan="%d">%s</td></tr>', max_cols, html_escape(values[[1]])))
      next
    }
    kind <- .monitoreo_sheets_table_header_kind(values)
    if (nzchar(kind)) {
      current_header <- values
      html_rows <- c(html_rows, sprintf('<tr class="header-row">%s</tr>', render_cells(values, values, "th")))
      next
    }
    html_rows <- c(html_rows, sprintf("<tr>%s</tr>", render_cells(values, current_header, "td")))
  }
  sprintf(
    '<section class="sheet-panel" data-tab="%s"><header><span>Google Sheets</span><h2>%s</h2></header><div class="sheet-wrap"><table>%s</table></div></section>',
    html_escape(name),
    html_escape(name),
    paste(html_rows, collapse = "\n")
  )
}

out_dir <- normalizePath(arg_value("--out", file.path(repo_root, "tmp", "visual-qa", "territorial-sheets-ump-quota-responsible-fix")), mustWork = FALSE)
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

fixture <- monitoreo_publish_qa_fixture("territorial")
tabs <- monitoreo_publication_sheets_tabs(
  fixture$data,
  fixture$config,
  audience = "internal",
  dashboard = fixture$dashboard,
  synced_at = fixture$synced_at
)

priority_tabs <- c(
  "Resumen territorial", "Ritmo diario", "Manzanas y responsables", "Responsables y rutas",
  "Cuotas sexo y edad", "Ocurrencias de campo", "GPS y territorio", "Auditoría técnica", "Base técnica"
)
tabs <- tabs[intersect(priority_tabs, names(tabs))]

nav <- paste(vapply(names(tabs), function(name) {
  sprintf('<a href="#%s">%s</a>', html_escape(gsub("[^A-Za-z0-9]+", "-", name)), html_escape(name))
}, character(1)), collapse = "")

panels <- paste(vapply(names(tabs), function(name) {
  panel <- render_tab(name, tabs[[name]])
  sub('<section class="sheet-panel"', sprintf('<section id="%s" class="sheet-panel"', html_escape(gsub("[^A-Za-z0-9]+", "-", name))), panel, fixed = TRUE)
}, character(1)), collapse = "\n")

html <- paste(
  "<!doctype html>",
  '<html lang="es">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>Preview Sheets territorial interno</title>",
  "<style>",
  ":root{--ink:#162033;--muted:#687386;--line:#d8e0eb;--soft:#f6f8fb;--blue:#123b70;--rose:#9f1239;--green-bg:#dcfce7;--green:#14532d;--teal-bg:#ccfbf1;--teal:#115e59;--amber-bg:#fef3c7;--amber:#92400e;--red-bg:#fee2e2;--red:#991b1b;--gray-bg:#f3f4f6;--gray:#4b5563;--sky-bg:#dbeafe;--sky:#1d4ed8}*{box-sizing:border-box}body{margin:0;background:#eef3f8;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.page{padding:28px;display:grid;gap:18px}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;background:white;border:1px solid var(--line);border-radius:14px;padding:22px 24px;box-shadow:0 12px 30px rgba(15,35,70,.08)}.hero span,.sheet-panel header span{color:var(--rose);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.14em}.hero h1{margin:6px 0 4px;font-size:30px;line-height:1}.hero p{margin:0;color:var(--muted);font-weight:600}.meta{text-align:right;color:var(--muted);font-weight:700}.nav{position:sticky;top:0;z-index:2;display:flex;gap:8px;overflow:auto;padding:10px;background:#eef3f8}.nav a{white-space:nowrap;text-decoration:none;color:var(--blue);background:white;border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800}.sheet-panel{background:white;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(15,35,70,.06)}.sheet-panel header{padding:18px 20px 12px;border-bottom:1px solid var(--line)}.sheet-panel h2{margin:5px 0 0;font-size:22px}.sheet-wrap{overflow:auto;max-height:640px}table{border-collapse:collapse;min-width:980px;width:100%;font-size:12px}th,td{padding:9px 10px;border-bottom:1px solid #e7edf5;text-align:left;white-space:nowrap;vertical-align:top}th{position:sticky;top:0;background:var(--blue);color:white;z-index:1;font-size:10px;letter-spacing:.06em;text-transform:uppercase}.section-row td{background:var(--rose);color:white;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:11px}.blank td{height:12px;background:#fbfcfe}.status-ok{background:var(--green-bg);color:var(--green);font-weight:800}.status-over{background:var(--teal-bg);color:var(--teal);font-weight:800}.status-progress{background:var(--sky-bg);color:var(--sky);font-weight:800}.status-warn{background:var(--amber-bg);color:var(--amber);font-weight:800}.status-danger{background:var(--red-bg);color:var(--red);font-weight:800}.status-muted{background:var(--gray-bg);color:var(--gray);font-weight:800}@media(max-width:900px){.page{padding:16px}.hero{display:block}.meta{text-align:left;margin-top:12px}}",
  "</style>",
  "</head>",
  "<body>",
  '<main class="page">',
  '<header class="hero"><div><span>Preview local</span><h1>Workbook territorial interno</h1><p>Formato profesional de publicación Google Sheets con pestañas operativas y técnicas separadas.</p></div><div class="meta">QA visual<br>Sin publicación remota</div></header>',
  sprintf('<nav class="nav">%s</nav>', nav),
  panels,
  "</main>",
  "</body>",
  "</html>",
  sep = "\n"
)

html_path <- file.path(out_dir, "territorial-internal-sheets-preview.html")
writeLines(html, html_path, useBytes = TRUE)
writeLines(
  jsonlite::toJSON(tabs, auto_unbox = TRUE, null = "null", dataframe = "rows", pretty = TRUE),
  file.path(out_dir, "territorial-internal-tabs.json"),
  useBytes = TRUE
)

cat(jsonlite::toJSON(list(ok = TRUE, html = html_path, tabs = names(tabs)), auto_unbox = TRUE, pretty = TRUE), "\n")
