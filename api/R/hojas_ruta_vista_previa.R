# Vista previa de la hoja de ruta de una UMP (U15, ADR 0116 §1).
#
# Reutiliza el motor de la ficha (`.hojas_ruta_draw_integrated_pdf`; la página 1
# vive en hojas_ruta_ficha_pdf.R) sobre la muestra GUARDADA del run activo. Lo que
# el ADR 0116 pide que la hoja imprima —las visitas esperadas de la ruta y la regla
# ante la no respuesta— lo leen de aquí `hojas_ruta_ficha_modelo()` y el salto
# sobre visitas (`.hojas_ruta_vp_ops_sobre_visitas`).
#
# Muestras sorteadas antes de U14a no traen `visitas_esperadas` ni
# `regla_no_respuesta`: la ficha sale sin ese bloque y sin fallar.

# ---------- Enganches del renderer congelado ----------

.hojas_ruta_vp_scalar <- function(block, name) {
  v <- block[[name]]
  if (is.null(v) || !length(v)) return(NULL)
  v <- v[[1]]
  if (is.null(v) || (length(v) == 1L && is.na(v))) return(NULL)
  v
}

.hojas_ruta_vp_visitas <- function(block) {
  v <- suppressWarnings(as.integer(.hojas_ruta_vp_scalar(block, "visitas_esperadas") %||% NA_integer_))
  if (!length(v) || is.na(v) || v < 1L) NA_integer_ else v
}

.hojas_ruta_vp_regla <- function(block) {
  r <- .hojas_ruta_vp_scalar(block, "regla_no_respuesta")
  r <- if (is.null(r)) "" else trimws(as.character(r))
  r
}

#' El salto que imprime la ficha, sobre visitas cuando la muestra ya lo trae.
#'
#' `.hojas_ruta_route_operational_values` recalcula `floor(V / k)`, que supone
#' respuesta total. Si la manzana viene del posproceso del ADR 0116
#' (`visitas_esperadas` presente) y el salto es automático, se respeta el salto
#' que trae la manzana —`floor(V / v)`— con su vivienda de inicio y su modo. Con
#' salto manual o apagado, o en una muestra vieja, no cambia nada.
#' @keywords internal
.hojas_ruta_vp_ops_sobre_visitas <- function(route_ops, block) {
  if (is.na(.hojas_ruta_vp_visitas(block))) return(route_ops)
  if (!identical(as.character(route_ops$constante_salto_modo %||% ""), "auto")) return(route_ops)
  salto <- suppressWarnings(as.integer(.hojas_ruta_vp_scalar(block, "salto_operativo") %||%
    .hojas_ruta_vp_scalar(block, "constante_salto") %||% NA_integer_))
  if (!length(salto) || is.na(salto) || salto < 1L) return(route_ops)
  inicio <- suppressWarnings(as.integer(.hojas_ruta_vp_scalar(block, "vivienda_inicio") %||%
    .hojas_ruta_vp_scalar(block, "domicilio_inicio") %||% NA_integer_))
  if (!length(inicio) || is.na(inicio) || inicio < 1L || inicio > salto) inicio <- 1L
  route_ops$constante_salto <- salto
  route_ops$salto_operativo <- salto
  route_ops$vivienda_inicio <- inicio
  route_ops$domicilio_inicio <- inicio
  modo <- .hojas_ruta_vp_scalar(block, "modo_seleccion_vivienda")
  route_ops$modo_seleccion_vivienda <- if (!is.null(modo) && nzchar(as.character(modo))) {
    as.character(modo)
  } else if (salto <= 1L) {
    "Barrido completo"
  } else {
    "Sistematico por casa/domicilio"
  }
  route_ops
}

# Pasos de la regla: una oración por paso.
.hojas_ruta_vp_regla_pasos <- function(regla) {
  if (!nzchar(regla)) return(character(0))
  pasos <- trimws(unlist(strsplit(regla, "(?<=[.])\\s+", perl = TRUE)))
  pasos[nzchar(pasos)]
}

# ---------- Búsqueda en la muestra guardada ----------

#' Muestra guardada del run activo de una sesión, o NULL si no hay rutas.
#' @keywords internal
.hojas_ruta_vp_muestra_guardada <- function(sid) {
  active <- .hojas_ruta_active_run(sid)
  outputs <- .hojas_ruta_workspace_outputs_normalize(active$run$workspace_outputs %||% list())
  muestra <- outputs$sample %||% NULL
  if (is.null(muestra) || !length(muestra$blocks %||% list())) return(NULL)
  list(sample = muestra, run = active$run)
}

#' Busca una manzana en titulares y reemplazos de la muestra.
#' @return `list(block, tipo = "titular"|"reemplazo")` o NULL.
#' @keywords internal
hojas_ruta_vp_buscar_bloque <- function(sample, id_manzana) {
  id <- trimws(as.character(id_manzana %||% "")[1])
  if (!nzchar(id)) return(NULL)
  for (tipo in c("titular", "reemplazo")) {
    tabla <- .hojas_ruta_rows_df(if (identical(tipo, "titular")) sample$blocks else sample$replacement_blocks %||% list())
    if (!nrow(tabla) || !"id_manzana" %in% names(tabla)) next
    i <- which(as.character(tabla$id_manzana) == id)
    if (!length(i)) next
    block <- as.list(tabla[i[[1]], , drop = FALSE])
    block[] <- lapply(block, function(x) x[[1]])
    if (identical(tipo, "titular")) {
      if (is.null(block$hoja_num) || is.na(suppressWarnings(as.integer(block$hoja_num)))) block$hoja_num <- i[[1]]
      if (is.null(block$rango_inicio) || is.na(suppressWarnings(as.integer(block$rango_inicio)))) {
        anteriores <- suppressWarnings(as.integer(tabla$entrevistas[seq_len(i[[1]] - 1L)]))
        block$rango_inicio <- sum(anteriores, na.rm = TRUE) + 1L
      }
      if (is.null(block$rango_fin) || is.na(suppressWarnings(as.integer(block$rango_fin)))) {
        block$rango_fin <- as.integer(block$rango_inicio) + max(1L, as.integer(block$entrevistas %||% 1L)) - 1L
      }
      block$tipo_manzana <- "titular"
    } else {
      # Los mismos rellenos que la entrega para un reemplazo (hojas_ruta_engine.R).
      if (is.null(block$hoja_num) || is.na(suppressWarnings(as.integer(block$hoja_num)))) block$hoja_num <- i[[1]]
      if (is.null(block$rango_inicio) || is.na(suppressWarnings(as.integer(block$rango_inicio)))) {
        block$rango_inicio <- as.integer(block$titular_rango_inicio %||% 1L)
      }
      if (is.null(block$rango_fin) || is.na(suppressWarnings(as.integer(block$rango_fin)))) {
        block$rango_fin <- as.integer(block$titular_rango_fin %||% block$entrevistas %||% 1L)
      }
      block$tipo_manzana <- "reemplazo"
    }
    return(list(block = block, tipo = tipo))
  }
  NULL
}

# El contexto de render guarda la cartografía ya leída y procesada (calles,
# manzanas, contornos), que es estática, y un índice del marco de la muestra. La
# vista previa pide una ficha por clic: construirlo en cada pedido releía el JSON
# de calles del distrito cada vez (~5 s). Se reusa mientras el marco sea el mismo.
.hojas_ruta_vp_ctx_cache <- new.env(parent = emptyenv())

.hojas_ruta_vp_render_context <- function(sample) {
  frame <- sample$frame %||% NULL
  prev <- .hojas_ruta_vp_ctx_cache$ultimo
  if (!is.null(prev) && identical(prev$frame, frame)) return(prev$ctx)
  ctx <- .hojas_ruta_render_context(sample)
  .hojas_ruta_vp_ctx_cache$ultimo <- list(frame = frame, ctx = ctx)
  ctx
}

#' Ficha de una UMP desde una muestra: PDF completo (ficha + mapa de contexto,
#' como en la entrega) o PNG de la primera página.
#'
#' @param sample Muestra guardada (`workspace_outputs$sample`).
#' @param found Salida de `hojas_ruta_vp_buscar_bloque()`.
#' @param out_path Ruta del archivo a escribir (.pdf o .png).
#' @param formato "pdf" o "png".
#' @param render_ctx Contexto de render (cachés de cartografía); opcional.
#' @return `list(path, formato)`; `formato` puede degradar a "pdf" si no hay rasterizador.
#' @keywords internal
hojas_ruta_ficha_ump <- function(sample, found, out_path, formato = c("png", "pdf"), render_ctx = NULL) {
  formato <- match.arg(formato)
  block <- found$block
  cfg <- sample$config %||% list()
  qt <- .hojas_ruta_rows_df(sample$quota$table %||% list())
  qdom <- if (nrow(qt) && "territorio" %in% names(qt)) {
    qt[qt$territorio %in% c(block$territorio_muestral, "TOTAL"), , drop = FALSE]
  } else {
    qt
  }
  meta <- sample$frame_meta %||% list()
  if (identical(formato, "pdf")) {
    ctx <- render_ctx %||% .hojas_ruta_vp_render_context(sample)
    .hojas_ruta_draw_integrated_pdf(block, qdom, meta, cfg, out_path, render_ctx = ctx)
    return(list(path = out_path, formato = "pdf"))
  }
  # PNG: sólo la primera página (la ficha); el mapa de contexto no hace falta.
  pdf_tmp <- tempfile("ficha_ump_", fileext = ".pdf")
  on.exit(unlink(pdf_tmp), add = TRUE)
  .hojas_ruta_draw_integrated_pdf_page1(block, qdom, meta, cfg, pdf_tmp)
  if (!requireNamespace("pdftools", quietly = TRUE)) {
    pdf_out <- sub("\\.png$", ".pdf", out_path)
    file.copy(pdf_tmp, pdf_out, overwrite = TRUE)
    return(list(path = pdf_out, formato = "pdf"))
  }
  # Bitmap crudo (sin `numeric = TRUE`): pasarlo a doble y transponerlo costaba
  # más que rasterizar la página.
  bitmap <- pdftools::pdf_render_page(pdf_tmp, page = 1L, dpi = 144)
  png::writePNG(bitmap, out_path)
  list(path = out_path, formato = "png")
}

.hojas_ruta_vp_nombre_ficha <- function(block, tipo, formato) {
  sprintf(
    "FichaUMP_%s%s_Zona_%s_Mz_%s.%s",
    if (identical(tipo, "reemplazo")) "Reemplazo_" else "",
    hojas_ruta_sanitize_filename(block$distrito %||% ""),
    hojas_ruta_sanitize_filename(block$zona %||% ""),
    hojas_ruta_sanitize_filename(block$manzana %||% block$id_manzana %||% ""),
    formato
  )
}
