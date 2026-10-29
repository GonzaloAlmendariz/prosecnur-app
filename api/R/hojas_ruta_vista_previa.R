# Vista previa de la hoja de ruta de una UMP (U15, ADR 0116 §1).
#
# Reutiliza el motor de la ficha (`.hojas_ruta_draw_integrated_pdf`, congelado en
# hojas_ruta_engine.R) sobre la muestra GUARDADA del run activo, y le suma lo que
# el ADR 0116 pide que la hoja imprima: las visitas esperadas de la ruta y la regla
# ante la no respuesta. El renderer congelado sólo lleva dos enganches («U15 /
# ADR 0116»): uno que respeta el salto ya calculado sobre visitas y otro que dibuja
# la franja de esta capa en los costados del esquema de recorrido.
#
# Muestras sorteadas antes de U14a no traen `visitas_esperadas` ni
# `regla_no_respuesta`: la ficha sale igual que antes, sin franja y sin fallar.

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

#' Franja de la ficha: visitas esperadas (izquierda) y regla ante la no respuesta
#' (derecha), en los costados del esquema de recorrido de la sección C.
#'
#' El esquema ocupa x 0,36–0,64 e y 0,215–0,41 de la hoja; los costados estaban
#' vacíos. Dibuja sólo lo que la manzana trae.
#' @keywords internal
.hojas_ruta_vp_franja_no_respuesta <- function(block) {
  visitas <- .hojas_ruta_vp_visitas(block)
  pasos <- .hojas_ruta_vp_regla_pasos(.hojas_ruta_vp_regla(block))
  if (is.na(visitas) && !length(pasos)) return(invisible(FALSE))
  borde <- grid::gpar(col = "#888888", lwd = 0.5, fill = NA)
  tinta <- "#1f1f1f"
  suave <- "#4a4a4a"
  top <- 0.392
  sangria <- 0.014
  k <- suppressWarnings(as.integer(.hojas_ruta_vp_scalar(block, "entrevistas") %||% NA_integer_))
  nota <- if (length(k) && !is.na(k)) {
    sprintf("Viviendas que se espera tocar para lograr %d entrevistas completas. El salto ya las considera.", k)
  } else {
    "Viviendas que se espera tocar para completar la ruta. El salto ya las considera."
  }
  lineas_nota <- if (is.na(visitas)) character(0) else .form_pdf_wrap_fit(nota, 0.255 - 0.024, fontsize = 7)
  lineas_pasos <- lapply(pasos, function(p) .form_pdf_wrap_fit(p, 0.26 - 0.024 - sangria, fontsize = 7))
  h_nota <- 0.024 + 0.012 + length(lineas_nota) * 0.0118 + 0.006
  h_pasos <- 0.024 + 0.012 + sum(lengths(lineas_pasos)) * 0.0118 + max(0L, length(pasos) - 1L) * 0.005 + 0.006
  if (!is.na(visitas)) {
    x0 <- 0.085; w <- 0.255
    lineas <- lineas_nota
    h <- h_nota
    grid::grid.rect(x = x0, y = top, width = w, height = h, just = c("left", "top"), gp = borde)
    grid::grid.rect(x = x0, y = top, width = w, height = 0.024, just = c("left", "top"),
                    gp = grid::gpar(col = NA, fill = "#ededed"))
    grid::grid.text(sprintf("Visitas esperadas: %d", visitas), x = x0 + 0.012, y = top - 0.012,
                    just = c("left", "center"), gp = grid::gpar(fontsize = 9.5, fontface = "bold", col = tinta))
    y <- top - 0.024 - 0.012
    for (l in lineas) {
      grid::grid.text(l, x = x0 + 0.012, y = y, just = c("left", "center"), gp = grid::gpar(fontsize = 7, col = suave))
      y <- y - 0.0118
    }
  }
  if (length(pasos)) {
    x0 <- 0.66; w <- 0.26
    lineas <- lineas_pasos
    h <- h_pasos
    grid::grid.rect(x = x0, y = top, width = w, height = h, just = c("left", "top"), gp = borde)
    grid::grid.rect(x = x0, y = top, width = w, height = 0.024, just = c("left", "top"),
                    gp = grid::gpar(col = NA, fill = "#ededed"))
    grid::grid.text("Ante la no respuesta", x = x0 + 0.012, y = top - 0.012, just = c("left", "center"),
                    gp = grid::gpar(fontsize = 9.5, fontface = "bold", col = tinta))
    y <- top - 0.024 - 0.012
    for (i in seq_along(lineas)) {
      grid::grid.text(sprintf("%d.", i), x = x0 + 0.012, y = y, just = c("left", "center"),
                      gp = grid::gpar(fontsize = 7, fontface = "bold", col = tinta))
      for (l in lineas[[i]]) {
        grid::grid.text(l, x = x0 + 0.012 + sangria, y = y, just = c("left", "center"),
                        gp = grid::gpar(fontsize = 7, col = tinta))
        y <- y - 0.0118
      }
      y <- y - 0.005
    }
  }
  invisible(TRUE)
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
    ctx <- render_ctx %||% .hojas_ruta_render_context(sample)
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
  bitmap <- pdftools::pdf_render_page(pdf_tmp, page = 1L, dpi = 144, numeric = TRUE)
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
