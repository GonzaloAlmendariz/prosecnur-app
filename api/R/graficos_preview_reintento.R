# Vista previa con LibreOffice lento: plazos, un reintento y el motivo de una lámina sin imagen.
#
# Con la máquina cargada una conversión pptx→pdf tardaba 16 s o más (acrconta_mazo, 2026-10-11) y el plazo de 12 s la
# cortaba: la lámina salía sin imagen y la UI lo leía como «este equipo no tiene LibreOffice», aunque lo tenía. La vista
# previa corre como job (`graficos.preview_slide`), así que esperar más no bloquea Plumber: se da un plazo razonable y,
# si se agota, un único reintento con plazo mayor. Cuando aun así no hay imagen, el resultado dice por qué.

#' Plazos (s) de la conversión a PDF por calidad: primer intento y reintento tras un timeout
#' @keywords internal
.PREVIEW_PLAZOS <- list(quick = c(20L, 45L), normal = c(30L, 60L))

#' Motivos tipados de una vista previa sin imagen
#'
#' «renderer_ausente» (no hay LibreOffice ni renderer de desarrollo), «renderer_timeout» (LibreOffice no terminó a
#' tiempo ni en el reintento), «conversion_fallida» (LibreOffice falló sin agotar el plazo) y «raster_fallido» (el PDF
#' salió pero no se pudo pasar a PNG).
#' @keywords internal
.PREVIEW_MOTIVOS_SIN_IMAGEN <- c("renderer_ausente", "renderer_timeout", "conversion_fallida", "raster_fallido")

#' Convierte un PPTX (o cualquier documento) a PDF con LibreOffice y dice cómo le fue
#'
#' @return `list(pdf, motivo, segundos)`: `pdf` es la ruta o `NULL`; `motivo` es `NA` si hubo PDF, o «renderer_ausente»,
#'   «renderer_timeout» o «conversion_fallida».
#' @keywords internal
.pptx_to_pdf_soffice_info <- function(pptx_path, out_dir, timeout = 30) {
  cmd <- .soffice_cmd()
  if (!nzchar(cmd)) return(list(pdf = NULL, motivo = "renderer_ausente", segundos = 0))
  pptx_path <- tryCatch(normalizePath(pptx_path, winslash = "/", mustWork = TRUE), error = function(e) pptx_path)

  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  perfil <- .preview_perfil_tomar(out_dir)   # perfil de LibreOffice reutilizado: ~1 s menos por vista previa
  on.exit(perfil$liberar(), add = TRUE)
  convertir <- function() {
    profile_uri <- .preview_profile_uri(perfil$dir)
    t0 <- Sys.time()
    # system2(timeout =) corta el proceso y devuelve status 124 con un aviso: aquí se clasifica, no se propaga.
    res <- tryCatch(suppressWarnings(system2(
      cmd,
      c(
        "--headless",
        "--invisible",
        "--nodefault",
        "--nofirststartwizard",
        "--nolockcheck",
        "--norestore",
        .preview_arg(paste0("-env:UserInstallation=", profile_uri)),
        "--convert-to",
        "pdf",
        "--outdir",
        .preview_arg(out_dir),
        .preview_arg(pptx_path)
      ),
      stdout = TRUE,
      stderr = TRUE,
      timeout = timeout
    )), error = function(e) e)
    segundos <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
    ok <- !inherits(res, "error")
    estado <- if (ok) suppressWarnings(as.integer(attr(res, "status") %||% 0L)) else NA_integer_
    pdfs <- if (ok) list.files(out_dir, pattern = "\\.pdf$", full.names = TRUE, ignore.case = TRUE) else character()
    pdf <- if (length(pdfs)) pdfs[[1]] else NULL
    agotado <- identical(estado, 124L) || segundos >= timeout
    motivo <- if (!is.null(pdf)) NA_character_ else if (agotado) "renderer_timeout" else "conversion_fallida"
    list(pdf = pdf, motivo = motivo, segundos = segundos)
  }
  r <- convertir()
  # Un perfil compartido dañado haría fallar todas las vistas previas de la sesión (verificadores de 9bce4f10e y
  # ebe1c1699): si la conversión falla, el perfil se borra siempre —también tras un timeout, que es como se manifiesta un
  # perfil que cuelga a soffice— para que la siguiente arranque con uno nuevo; sólo se reintenta aquí si falló rápido.
  # El reintento tras un timeout, con plazo mayor, lo hace `.preview_pdf_con_reintento`.
  if (is.null(r$pdf) && isTRUE(perfil$compartido)) {
    unlink(perfil$dir, recursive = TRUE, force = TRUE)
    if (!identical(r$motivo, "renderer_timeout")) {
      dir.create(perfil$dir, recursive = TRUE, showWarnings = FALSE)
      r <- convertir()
    }
  }
  r
}

#' PDF de la vista previa con un reintento de plazo mayor si el primero se agota
#'
#' Sólo un timeout se reintenta: sin LibreOffice o con una conversión que falla rápido, esperar más no cambia nada.
#' @param plazos Plazos sucesivos en segundos (`.PREVIEW_PLAZOS`); `extra` se suma a cada uno (partes adicionales).
#' @param convertir Conversor con la firma de `.pptx_to_pdf_soffice_info` (los tests lo simulan).
#' @return `list(pdf, motivo, intentos)`.
#' @keywords internal
.preview_pdf_con_reintento <- function(pptx_path, out_dir, plazos, extra = 0L, convertir = .pptx_to_pdf_soffice_info) {
  motivo <- "conversion_fallida"
  for (k in seq_along(plazos)) {
    r <- convertir(pptx_path, out_dir, timeout = as.integer(plazos[[k]]) + as.integer(extra))
    if (!is.null(r$pdf)) return(list(pdf = r$pdf, motivo = NA_character_, intentos = k))
    motivo <- r$motivo %||% "conversion_fallida"
    if (!identical(motivo, "renderer_timeout")) return(list(pdf = NULL, motivo = motivo, intentos = k))
  }
  list(pdf = NULL, motivo = motivo, intentos = length(plazos))
}

#' Motivo público de una lámina sin imagen: uno de `.PREVIEW_MOTIVOS_SIN_IMAGEN` o `NA` (hay imagen o no se pidió)
#' @keywords internal
.preview_motivo_publico <- function(motivo) {
  m <- as.character(motivo %||% NA_character_)[1]
  if (is.na(m) || !m %in% .PREVIEW_MOTIVOS_SIN_IMAGEN) NA_character_ else m
}
