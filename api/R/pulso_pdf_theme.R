# ==========================================================================
# Pulso PDF — capa estética compartida (tokens + primitivas)
# ==========================================================================
#
# Este módulo NO es una plantilla de layout: es el "kit" de familia que todos
# los motores de PDF de la app deberían adoptar para verse de la misma familia
# (paleta, cabecera, pie con logo·periodo·página, logo con corrección de
# aspecto, tablas estructuradas y calibración de ancho). El LAYOUT del
# contenido es particular de cada motor (dos columnas del libro de códigos,
# dashboard apaisado del avance territorial, etc.) y NO vive aquí.
#
# Destilado del motor de referencia `reporte_codebook_pdf.R` (gold standard).
# Reutiliza los helpers de medición/wrap de `reporte_formulario_pdf.R`
# (`.form_pdf_text`, `.form_pdf_wrap`, `.form_pdf_lines_height`).
#
# Vía "de casa": grDevices::pdf() + grid (+ png solo para el logo, opcional con
# fallback textual). CERO dependencias externas nuevas.
# --------------------------------------------------------------------------

# --- Tokens canónicos (fuente única de verdad de la marca en PDF) ----------
# navy/ink/soft/line coinciden con pulso_plotly_palette() en plotly_theme_shared.R.
pulso_pdf_tokens <- function() {
  list(
    navy   = "#002457",  # marca Pulso: títulos, reglas, nombres de variable
    ink    = "#1f2933",  # texto principal
    soft   = "#5f6b7a",  # secundario: subtítulos, códigos, periodo, nº pág
    faint  = "#8792a2",  # terciario: notas tenues, ejes
    rule   = "#d0d5dd",  # regla hairline (divisores)
    line   = "#d8e0ef",  # regla de cabecera/pie
    # Tabla estructurada
    tbl_header = "#e9eef6",  # banda de encabezado
    tbl_zebra  = "#f6f8fb",  # fondo de filas pares
    tbl_frame  = "#c3ccdb",  # marco exterior + regla bajo encabezado
    tbl_div    = "#c9d1de",  # divisor de columnas
    canvas     = "#f6f8fb",  # lienzo de fondo (dashboards)
    surface    = "#ffffff",  # tarjetas/paneles
    # Acentos semánticos (opcionales, para dashboards; no decorativos)
    success = "#0f766e",  # verde territorial (zonas aplicadas, cumplimiento alto)
    warn    = "#b7791f",
    danger  = "#be123c"
  )
}

# --- Escala tipográfica (pt) -----------------------------------------------
pulso_pdf_type <- function() {
  list(
    title = 15,      # título de cabecera (bold, navy)
    subtitle = 9.5,  # subtítulo de cabecera (plain, soft)
    section = 13,    # título de sección/página en dashboards
    body = 8.0,      # cuerpo
    code = 7.8,      # código / celdas de tabla
    footer = 8.0,    # periodo / nº pág
    caption = 6.4    # etiquetas de KPI / captions
  )
}

# --- Geometría de página ----------------------------------------------------
# `orientation`: "portrait" (A4 vertical) | "landscape" (A4 apaisado).
pulso_pdf_geo <- function(orientation = c("portrait", "landscape")) {
  orientation <- match.arg(orientation)
  if (orientation == "portrait") {
    list(orientation = orientation, page_w = 8.27, page_h = 11.69,
         margin = 0.048, y_top = 0.900, y_bottom = 0.082)
  } else {
    list(orientation = orientation, page_w = 11.69, page_h = 8.27,
         margin = 0.048, y_top = 0.900, y_bottom = 0.082)
  }
}

# --- Logo con corrección de aspecto -----------------------------------------
# Rutas candidatas (system.file en el paquete instalado + fallback getwd() en dev).
.pulso_pdf_logo_path <- function() {
  cands <- c(
    system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnurapp"),
    system.file("www/pulso-pucp-logo.png", package = "prosecnurapp"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png"),
    file.path(getwd(), "api", "inst", "www", "pulso-pucp-logo.png"),
    file.path(getwd(), "inst", "hojas_ruta", "assets", "logo_pulso.png")
  )
  cands <- cands[nzchar(cands) & file.exists(cands)]
  if (length(cands)) cands[[1]] else NA_character_
}

# Dibuja el logo respetando el aspecto real de la imagen (1078×423) y el aspecto
# de la página (npc no es isométrico en una hoja no cuadrada). `just` = c(h, v).
# Si `png` no está o el archivo falla, degrada al texto "PULSO PUCP".
.pulso_pdf_draw_logo <- function(x, y, width_npc = 0.135, geo = pulso_pdf_geo(),
                                 just = c("left", "center"), tokens = pulso_pdf_tokens()) {
  path <- .pulso_pdf_logo_path()
  if (!is.na(path) && requireNamespace("png", quietly = TRUE)) {
    img <- tryCatch(png::readPNG(path), error = function(e) NULL)
    if (!is.null(img)) {
      img_h <- dim(img)[1]; img_w <- dim(img)[2]
      h_npc <- width_npc * (img_h / img_w) * (geo$page_w / geo$page_h)
      grid::grid.raster(img, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                        just = just, interpolate = TRUE,
                        width = grid::unit(width_npc, "npc"),
                        height = grid::unit(h_npc, "npc"))
      return(invisible(TRUE))
    }
  }
  grid::grid.text("PULSO PUCP", x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                  just = just, gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = tokens$navy))
  invisible(FALSE)
}

# --- Cabecera: título (navy bold) + subtítulo (soft) + regla navy -----------
pulso_pdf_header <- function(titulo, subtitulo = "", tokens = pulso_pdf_tokens(),
                             ty = pulso_pdf_type(), geo = pulso_pdf_geo()) {
  m <- geo$margin; right <- 1 - m
  .form_pdf_text(titulo, x = m, y = 0.968, w = right - m, chars = 84,
                 fontsize = ty$title, fontface = "bold", col = tokens$navy, line_h = 0.020)
  if (nzchar(subtitulo)) {
    .form_pdf_text(subtitulo, x = m, y = 0.952, w = right - m, chars = 130,
                   fontsize = ty$subtitle, col = tokens$soft, line_h = 0.014)
  }
  grid::grid.lines(x = grid::unit(c(m, right), "npc"), y = grid::unit(0.918, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 1.1))
  invisible(NULL)
}

# --- Pie: logo (izq) · periodo (centro) · "Pág. N" (der) · hairline ---------
# El logo YA identifica a Pulso; el centro NO repite "Fuente: Pulso".
pulso_pdf_footer <- function(page_no, periodo = "", tokens = pulso_pdf_tokens(),
                             ty = pulso_pdf_type(), geo = pulso_pdf_geo()) {
  m <- geo$margin; right <- 1 - m
  grid::grid.lines(x = grid::unit(c(m, right), "npc"), y = grid::unit(0.062, "npc"),
                   gp = grid::gpar(col = tokens$line, lwd = 0.7))
  .pulso_pdf_draw_logo(m, 0.038, width_npc = 0.135, geo = geo, tokens = tokens)
  if (nzchar(periodo)) {
    grid::grid.text(periodo, x = grid::unit(0.5, "npc"), y = grid::unit(0.038, "npc"),
                    gp = grid::gpar(fontsize = ty$footer, col = tokens$soft))
  }
  grid::grid.text(paste0("Pag. ", page_no), x = grid::unit(right, "npc"),
                  y = grid::unit(0.038, "npc"), just = c("right", "center"),
                  gp = grid::gpar(fontsize = ty$footer, col = tokens$soft))
  invisible(NULL)
}

# --- Regla hairline horizontal ---------------------------------------------
pulso_pdf_hairline <- function(x0, x1, y, tokens = pulso_pdf_tokens(), lwd = 0.7) {
  grid::grid.lines(x = grid::unit(c(x0, x1), "npc"), y = grid::unit(y, "npc"),
                   gp = grid::gpar(col = tokens$rule, lwd = lwd))
  invisible(NULL)
}

# --- Calibración de ancho: caracteres por línea para LLENAR el ancho --------
# ~150 char/npc a ~7.9pt (calibrado en el gold standard para no cortar temprano).
pulso_pdf_chars <- function(w_npc, min_chars = 14L, factor = 150) {
  max(min_chars, floor(w_npc * factor))
}

# Nota: para tablas estructuradas (Código|Etiqueta) con banda de encabezado,
# zebra, marco y divisor, ver `.codebook_pdf_draw_block` en reporte_codebook_pdf.R
# — es el patrón de referencia; extráelo aquí solo si un segundo motor lo necesita
# (regla "hardcodear menos": lo específico vive en el motor).
