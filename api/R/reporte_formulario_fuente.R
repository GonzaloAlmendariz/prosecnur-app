# Fuente del PDF del formulario: Liberation Sans Narrow EMBEBIDA (item 22,
# decision de Gonzalo 2026-10-15, opcion a; levanta la reserva V1 del GOAL).
#
# Antes el PDF salia del dispositivo `pdf()` con Helvetica-Narrow SIN embeber:
# cada visor la sustituia por lo que tuviera, y poppler/PDFKit pintaban la
# negrita y la cursiva en redonda (el FontDescriptor de R no las distingue). La
# negrita de bandas y enunciados, la cursiva de las pistas y los tramos del item
# 26 no se veian. Ahora:
#   - la fuente viaja en el paquete (`inst/fonts/liberation-sans-narrow/`, 1.07.5,
#     GPLv2 + font exception, procedencia y sha256 en su README);
#   - el PDF sale de `cairo_pdf()`, que la EMBEBE como subconjunto TrueType con
#     ToUnicode (pdftotext sigue extrayendo el texto; nada de contornos);
#   - fontconfig la ve porque al cargar el paquete se apunta `FONTCONFIG_FILE` a
#     una configuracion que INCLUYE la de siempre y AGREGA el directorio del
#     paquete: nadie pierde fuentes, solo aparece una familia mas.
# Es metrico-compatible con Arial Narrow, la del .docx: los dos renderers cortan
# igual.
#
# Por que en `.onLoad`: fontconfig lee su configuracion UNA vez por proceso, en
# el primer uso de cairo. Cambiar el entorno despues no tiene efecto (medido:
# con un `cairo_pdf()` previo en el proceso, la familia pedida cae EN SILENCIO a
# Arial Narrow del sistema). El worker del job carga el paquete antes de dibujar
# nada; el servidor y los tests, tambien. Si aun asi la fuente no llega —paquete
# cargado despues de otro uso de cairo, archivo ausente—, el render FALLA con la
# causa (`.form_fuente_verificar_pdf`): nunca cae a otra fuente sin decirlo.

.FORM_FUENTE_FAMILIA <- "Liberation Sans Narrow"
.FORM_FUENTE_ARCHIVOS <- c(
  "LiberationSansNarrow-Regular.ttf", "LiberationSansNarrow-Bold.ttf",
  "LiberationSansNarrow-Italic.ttf", "LiberationSansNarrow-BoldItalic.ttf")

# Condicion propia: el job la traduce a su error de dominio con `error_id`
# (`.xlsform_editor_export_error`), y el mensaje dice la causa en el stderr.
.form_fuente_error <- function(msg) {
  stop(structure(class = c("formulario_fuente_error", "error", "condition"),
                 list(message = msg, call = NULL)))
}

# Directorio de la fuente DENTRO del paquete. Nunca por nombre del sistema.
.form_fuente_dir <- function(d = system.file("fonts", "liberation-sans-narrow", package = "prosecnurapp")) {
  if (!nzchar(d)) {
    .form_fuente_error("No se encontro la carpeta de la fuente del formulario (fonts/liberation-sans-narrow) en el paquete prosecnurapp.")
  }
  faltan <- .FORM_FUENTE_ARCHIVOS[!file.exists(file.path(d, .FORM_FUENTE_ARCHIVOS))]
  if (length(faltan)) {
    .form_fuente_error(sprintf("Faltan archivos de la fuente del formulario en el paquete: %s.",
                               paste(faltan, collapse = ", ")))
  }
  normalizePath(d, winslash = "/")
}

# Configuracion de fontconfig que conserva la vigente y agrega la carpeta del
# paquete. La vigente es FONTCONFIG_FILE si ya habia una; si no, la que usa R:
# la de R.framework en macOS (fontconfig estatico de CRAN) o /etc/fonts en Linux.
.form_fuente_conf <- function(dir) {
  previa <- Sys.getenv("FONTCONFIG_FILE")
  # La nuestra no se incluye a si misma (se re-registra en otro tempdir).
  if (identical(basename(previa), "prosecnur-fontconfig.conf")) previa <- Sys.getenv("PROSECNUR_FONTCONFIG_BASE")
  candidatas <- c(previa,
                  file.path(R.home(), "fontconfig", "fonts", "fonts.conf"),
                  "/etc/fonts/fonts.conf")
  base <- candidatas[nzchar(candidatas) & file.exists(candidatas)]
  base <- if (length(base)) base[[1]] else ""
  Sys.setenv(PROSECNUR_FONTCONFIG_BASE = base)
  conf <- file.path(tempdir(), "prosecnur-fontconfig.conf")
  esc <- function(x) gsub("&", "&amp;", x, fixed = TRUE)
  writeLines(c(
    '<?xml version="1.0"?>',
    '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
    "<fontconfig>",
    if (nzchar(base)) sprintf('  <include ignore_missing="yes">%s</include>', esc(base)),
    sprintf("  <dir>%s</dir>", esc(dir)),
    sprintf("  <cachedir>%s</cachedir>", esc(file.path(tempdir(), "prosecnur-fccache"))),
    "</fontconfig>"), conf)
  conf
}

.form_fuente_registrar <- function() {
  # Ya registrada (en este proceso o heredada del padre, como el worker del job).
  actual <- Sys.getenv("FONTCONFIG_FILE")
  if (identical(basename(actual), "prosecnur-fontconfig.conf") && file.exists(actual)) return(invisible(TRUE))
  conf <- .form_fuente_conf(.form_fuente_dir())
  # Sin una configuracion base que incluir, fijar FONTCONFIG_FILE dejaria a
  # todo otro uso de cairo del proceso sin las fuentes del sistema. No se
  # registra: el render del formulario lo detecta en su chequeo del artefacto
  # y falla con la causa, en vez de romper en silencio a otros motores.
  if (!nzchar(Sys.getenv("PROSECNUR_FONTCONFIG_BASE"))) return(invisible(FALSE))
  Sys.setenv(FONTCONFIG_FILE = conf)
  invisible(TRUE)
}

.onLoad <- function(libname, pkgname) {
  # Un fallo aqui no puede impedir cargar el paquete (la app entera depende de
  # el): si la fuente falta, el que lo dice es el render del formulario, con la
  # causa, en vez de una carga rota sin relacion aparente.
  tryCatch(.form_fuente_registrar(), error = function(e) invisible(NULL))
}

# Abre el dispositivo del formulario: A4 exacto con la fuente del paquete.
.form_fuente_dispositivo <- function(file) {
  if (!isTRUE(capabilities("cairo"))) {
    .form_fuente_error("Este R no tiene soporte cairo: el formulario en PDF necesita cairo_pdf() para embeber su fuente.")
  }
  .form_fuente_dir()
  .form_fuente_registrar()
  grDevices::cairo_pdf(file, width = 595.2756 / 72, height = 841.8898 / 72,
                       onefile = TRUE, family = .FORM_FUENTE_FAMILIA)
}

# Region de dibujo de cada pagina: la MISMA que dejaba `pdf(paper = "a4")`
# (0.25 in por lado). Todo el motor mide en npc de esta region; con cairo_pdf la
# pagina entera es la region, asi que se reproduce con un viewport y la
# geometria no cambia.
.form_fuente_region <- function() {
  grid::pushViewport(grid::viewport(width = grid::unit(559.2756, "bigpts"),
                                    height = grid::unit(805.8898, "bigpts")))
}

# Familias embebidas en un PDF (sin el prefijo de subconjunto).
.form_fuente_familias_pdf <- function(path) {
  raw <- readBin(path, "raw", file.info(path)$size)
  txt <- rawToChar(raw[raw != as.raw(0)])
  m <- regmatches(txt, gregexpr("/BaseFont /[A-Za-z0-9+_-]+", txt, useBytes = TRUE))[[1]]
  unique(sub("^[A-Z]{6}\\+", "", sub("^/BaseFont /", "", m)))
}

# Caracteres sin glifo en la fuente: se imprimen con otra (fontconfig elige la
# que los tenga) y eso se declara, porque no es la familia del documento.
.form_fuente_sin_glifo <- function(textos) {
  chars <- unique(unlist(strsplit(paste(textos, collapse = ""), "")))
  chars <- chars[nzchar(chars) & !chars %in% c(" ", "\n", "\t")]
  if (!length(chars) || !requireNamespace("systemfonts", quietly = TRUE)) return(character(0))
  p <- file.path(.form_fuente_dir(), .FORM_FUENTE_ARCHIVOS[[1]])
  gi <- tryCatch(systemfonts::glyph_info(chars, path = p), error = function(e) NULL)
  if (is.null(gi)) return(character(0))
  chars[gi$index == 0L]
}

# Comprueba EN EL ARTEFACTO que la fuente es la del paquete. Otra familia solo
# se admite si hay caracteres sin glifo (y ya se declararon); si no, es que
# fontconfig no vio la fuente y cairo cayo a otra: error con la causa.
.form_fuente_verificar_pdf <- function(path, sin_glifo = character(0)) {
  fams <- .form_fuente_familias_pdf(path)
  propias <- grepl("^LiberationSansNarrow", fams)
  if (!any(propias)) {
    .form_fuente_error(sprintf(
      "El PDF del formulario no lleva la fuente del paquete (Liberation Sans Narrow) sino %s: fontconfig no la vio en este proceso.",
      paste(fams, collapse = ", ")))
  }
  if (any(!propias) && !length(sin_glifo)) {
    .form_fuente_error(sprintf(
      "El PDF del formulario mezcla otra fuente (%s) sin caracteres que la justifiquen.",
      paste(fams[!propias], collapse = ", ")))
  }
  invisible(fams)
}

# Textos que el PDF imprime, para la cobertura de glifos.
.form_fuente_textos_modelo <- function(model) {
  out <- c(model$title %||% "", model$footer_title %||% "")
  for (b in model$blocks %||% list()) {
    out <- c(out, b$title, b$label, b$hint, b$body, b$tenor, b$skip, b$opening_condition,
             vapply(b$options %||% list(), function(o) paste(o$label %||% "", o$code %||% ""), ""),
             vapply(b$items %||% list(), function(it) paste(it$label %||% "", it$skip %||% ""), ""))
  }
  out[!is.na(out)]
}

# Aviso del modelo si hay caracteres que la fuente no tiene.
.form_fuente_aviso_glifos <- function(model) {
  faltan <- tryCatch(.form_fuente_sin_glifo(.form_fuente_textos_modelo(model)),
                     error = function(e) character(0))
  if (!length(faltan)) return(character(0))
  sprintf("La fuente del PDF no tiene %d caracter(es) del instrumento (%s): se imprimen con otra fuente del sistema.",
          length(faltan), paste(faltan, collapse = " "))
}
