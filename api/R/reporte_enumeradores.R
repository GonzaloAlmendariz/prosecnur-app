#' Generar reporte PDF de enumeradores por modalidad y cortes de cuota
#'
#' `reporte_enumeradores()` construye un reporte en PDF (Quarto + Typst) con
#' producción observada por enumerador. El desglose es genérico: se puede pasar
#' cualquier conjunto de columnas de corte (por ejemplo `sexo`, `aula`, `turno`)
#' mediante `cols_corte`.
#'
#' La modalidad se resuelve con precedencia fija:
#' `modalidad_fn > col_modalidad > modalidad_reglas > modalidad_default`.
#'
#' @param data `data.frame` o `tibble` con los datos crudos.
#' @param col_enumerador Nombre de la columna de enumerador.
#' @param cols_corte Vector opcional de columnas para desagregar el reporte.
#' @param col_modalidad Columna existente de modalidad (opcional).
#' @param modalidad_reglas Reglas opcionales para clasificar modalidad.
#'   Puede ser lista de reglas o `data.frame` con columna `modalidad`.
#' @param modalidad_fn Función opcional `f(data) -> character(nrow(data))` para
#'   clasificar modalidad.
#' @param modalidad_default Etiqueta por defecto para filas sin modalidad.
#' @param modalidades_esperadas Modalidades esperadas para ordenar secciones.
#' @param mostrar_modalidades_vacias Si `TRUE`, incluye secciones sin datos para
#'   `modalidades_esperadas`.
#' @param output_file Ruta de salida del PDF.
#' @param titulo Título del reporte.
#' @param subtitulo Subtítulo opcional.
#' @param min_encuestas Filtro mínimo de producción por enumerador.
#' @param ordenar_por Criterio de orden para filas de enumerador.
#' @param quiet Si `TRUE`, reduce salida de `quarto_render()`.
#'
#' @return Invisiblemente una lista con:
#'   `output_file` (archivo general),
#'   `output_files` (todos los PDFs generados),
#'   `bundle` y `bundles`.
#' @family reporte
#' @export
reporte_enumeradores <- function(
    data,
    col_enumerador,
    cols_corte = NULL,
    col_modalidad = NULL,
    modalidad_reglas = NULL,
    modalidad_fn = NULL,
    modalidad_default = "Presencial",
    modalidades_esperadas = c("Presencial", "Telefónica"),
    mostrar_modalidades_vacias = FALSE,
    output_file = "reporte_enumeradores.pdf",
    titulo = "Producción de Enumeradores",
    subtitulo = NULL,
    min_encuestas = 0,
    ordenar_por = c("total", "nombre"),
    quiet = FALSE
) {
  ordenar_por <- match.arg(ordenar_por)

  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  col_enumerador <- as.character(col_enumerador)[1]
  if (!col_enumerador %in% names(data)) {
    stop("`col_enumerador` no existe en `data`: ", col_enumerador, call. = FALSE)
  }

  if (is.null(cols_corte)) cols_corte <- character(0)
  cols_corte <- unique(as.character(cols_corte))
  cols_corte <- cols_corte[nzchar(trimws(cols_corte))]
  cols_missing <- setdiff(cols_corte, names(data))
  if (length(cols_missing)) {
    stop(
      "`cols_corte` contiene columnas inexistentes en `data`: ",
      paste(cols_missing, collapse = ", "),
      call. = FALSE
    )
  }

  min_encuestas <- suppressWarnings(as.numeric(min_encuestas)[1])
  if (!is.finite(min_encuestas) || min_encuestas < 0) {
    stop("`min_encuestas` debe ser numerico >= 0.", call. = FALSE)
  }

  modalidades_esperadas <- as.character(modalidades_esperadas)
  modalidades_esperadas <- modalidades_esperadas[nzchar(trimws(modalidades_esperadas))]
  if (!length(modalidades_esperadas)) {
    stop("`modalidades_esperadas` debe tener al menos una etiqueta.", call. = FALSE)
  }

  output_file <- as.character(output_file)[1]
  if (!nzchar(trimws(output_file))) {
    stop("`output_file` debe ser una ruta no vacia.", call. = FALSE)
  }
  if (!grepl("\\.pdf$", output_file, ignore.case = TRUE)) {
    stop("`output_file` debe terminar en `.pdf`.", call. = FALSE)
  }

  if (!requireNamespace("quarto", quietly = TRUE)) {
    stop(
      "El paquete `quarto` es necesario para `reporte_enumeradores()`. ",
      "Instalalo con install.packages('quarto').",
      call. = FALSE
    )
  }
  if (!nzchar(Sys.which("quarto"))) {
    stop(
      "No se encontro el ejecutable `quarto` en el sistema. ",
      "Instala Quarto CLI para renderizar el PDF.",
      call. = FALSE
    )
  }

  modalidad <- resolver_modalidad_enumeradores(
    data = data,
    col_modalidad = col_modalidad,
    modalidad_reglas = modalidad_reglas,
    modalidad_fn = modalidad_fn,
    modalidad_default = modalidad_default
  )

  # Reescribir etiquetas reales con la grafia de `modalidades_esperadas`
  mod_norm <- .enum_norm_text(modalidad)
  for (exp_i in modalidades_esperadas) {
    idx <- mod_norm == .enum_norm_text(exp_i)
    modalidad[idx] <- exp_i
  }

  data_work <- tibble::as_tibble(data)
  data_work$.modalidad <- modalidad

  bundle_main <- .build_bundle_enumeradores(
    data = data_work,
    col_enumerador = col_enumerador,
    cols_corte = cols_corte,
    modalidades_esperadas = modalidades_esperadas,
    mostrar_modalidades_vacias = isTRUE(mostrar_modalidades_vacias),
    titulo = titulo,
    subtitulo = subtitulo,
    min_encuestas = min_encuestas,
    ordenar_por = ordenar_por
  )
  bundle_main$typst_doc <- construir_typst_documento_enumeradores(bundle_main)

  template_qmd <- system.file(
    "plantillas/enumeradores.qmd",
    package = "prosecnur"
  )
  if (!nzchar(template_qmd) || !file.exists(template_qmd)) {
    stop(
      "No se encontro la plantilla Quarto `inst/plantillas/enumeradores.qmd`.",
      call. = FALSE
    )
  }

  tmp_root <- tempfile("reporte_enumeradores_")
  dir.create(tmp_root, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp_root, recursive = TRUE, force = TRUE), add = TRUE)

  out_dir <- dirname(output_file)
  if (!dir.exists(out_dir)) {
    dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  }

  mod_con_datos <- unique(as.character(data_work$.modalidad))
  mod_con_datos <- mod_con_datos[!is.na(mod_con_datos) & nzchar(trimws(mod_con_datos))]

  bundles_to_render <- list()
  output_targets <- character(0)

  path_general <- .enum_prefixed_output_file(output_file, "general_")
  bundle_general <- bundle_main
  bundle_general$titulo <- .enum_title_with_scope(titulo, "General")
  bundle_general$secciones <- list()
  bundle_general$typst_doc <- construir_typst_documento_enumeradores(bundle_general)

  bundles_to_render[[length(bundles_to_render) + 1L]] <- bundle_general
  output_targets <- c(output_targets, path_general)

  if (length(mod_con_datos) > 1L) {
    for (mod_i in mod_con_datos) {
      data_mod <- data_work[data_work$.modalidad == mod_i, , drop = FALSE]
      bundle_mod <- .build_bundle_enumeradores(
        data = data_mod,
        col_enumerador = col_enumerador,
        cols_corte = cols_corte,
        modalidades_esperadas = mod_i,
        mostrar_modalidades_vacias = FALSE,
        titulo = titulo,
        subtitulo = subtitulo,
        min_encuestas = min_encuestas,
        ordenar_por = ordenar_por
      )
      bundle_mod$titulo <- .enum_title_with_scope(titulo, .enum_modalidad_title_label(mod_i))
      bundle_mod$typst_doc <- construir_typst_documento_enumeradores(bundle_mod)

      bundles_to_render[[length(bundles_to_render) + 1L]] <- bundle_mod
      output_targets <- c(
        output_targets,
        .enum_prefixed_output_file(output_file, .enum_modalidad_prefix(mod_i))
      )
    }
  }

  for (i in seq_along(bundles_to_render)) {
    .enum_render_bundle_quarto(
      bundle = bundles_to_render[[i]],
      output_file = output_targets[[i]],
      template_qmd = template_qmd,
      tmp_root = tmp_root,
      quiet = isTRUE(quiet)
    )
  }

  invisible(list(
    output_file = normalizePath(path_general, winslash = "/", mustWork = FALSE),
    output_files = normalizePath(output_targets, winslash = "/", mustWork = FALSE),
    bundle = bundle_general,
    bundles = bundles_to_render
  ))
}

#' @keywords internal
.build_bundle_enumeradores <- function(
    data,
    col_enumerador,
    cols_corte,
    modalidades_esperadas,
    mostrar_modalidades_vacias,
    titulo,
    subtitulo,
    min_encuestas,
    ordenar_por
) {
  modalidad_vals <- as.character(data$.modalidad)
  modalidad_vals[is.na(modalidad_vals) | !nzchar(trimws(modalidad_vals))] <- "Presencial"
  presentes <- unique(modalidad_vals)

  norm_presentes <- .enum_norm_text(presentes)
  norm_esperadas <- .enum_norm_text(modalidades_esperadas)
  extras <- presentes[!norm_presentes %in% norm_esperadas]

  if (isTRUE(mostrar_modalidades_vacias)) {
    modalidades_orden <- c(modalidades_esperadas, extras)
  } else {
    esperadas_con_datos <- modalidades_esperadas[norm_esperadas %in% norm_presentes]
    modalidades_orden <- c(esperadas_con_datos, extras)
  }

  if (!length(modalidades_orden)) {
    modalidades_orden <- unique(modalidad_vals)
  }

  tabla_general <- pivot_enum_resumen(
    data = data,
    col_enumerador = col_enumerador,
    min_encuestas = min_encuestas,
    ordenar_por = ordenar_por
  )

  n_enum <- dplyr::n_distinct(as.character(data[[col_enumerador]]))
  n_modalidades <- dplyr::n_distinct(modalidad_vals)

  secciones <- list()
  for (mod_i in modalidades_orden) {
    data_mod <- data[data$.modalidad == mod_i, , drop = FALSE]
    mod_style <- .enum_modalidad_style(mod_i)

    tabla_resumen_mod <- pivot_enum_resumen(
      data = data_mod,
      col_enumerador = col_enumerador,
      min_encuestas = min_encuestas,
      ordenar_por = ordenar_por
    )

    cortes <- list()
    if (length(cols_corte)) {
      for (col_corte in cols_corte) {
        tabla_corte <- pivot_enum_x_corte(
          data = data_mod,
          col_enumerador = col_enumerador,
          col_corte = col_corte,
          col_modalidad = ".modalidad",
          min_encuestas = min_encuestas,
          ordenar_por = ordenar_por
        )
        cortes[[length(cortes) + 1L]] <- list(
          nombre = col_corte,
          tabla = tabla_corte
        )
      }
    }

    secciones[[length(secciones) + 1L]] <- list(
      modalidad = mod_i,
      style = mod_style,
      tabla_resumen = tabla_resumen_mod,
      cortes = cortes
    )
  }

  list(
    titulo = titulo,
    subtitulo = subtitulo,
    kpi = list(
      "Total encuestas" = nrow(data),
      "Total enumeradores" = n_enum,
      "Modalidades con datos" = n_modalidades
    ),
    tabla_general = tabla_general,
    secciones = secciones
  )
}

#' @keywords internal
.enum_modalidad_style <- function(modalidad) {
  mod_norm <- .enum_norm_text(modalidad)

  if (grepl("telef", mod_norm, fixed = TRUE)) {
    return(list(
      section = "#1A4A7A",
      table_header = "#1A4A7A",
      total_row = "#DCE4F0",
      total_col = "#EDF2F8",
      stripe = "#F7F9FD"
    ))
  }

  if (grepl("presenc", mod_norm, fixed = TRUE)) {
    return(list(
      section = "#1A4A7A",
      table_header = "#1A4A7A",
      total_row = "#DCE4F0",
      total_col = "#EDF2F8",
      stripe = "#F7F9FD"
    ))
  }

  list(
    section = "#374151",
    table_header = "#374151",
    total_row = "#E5E7EB",
    total_col = "#F3F4F6",
    stripe = "#FAFAFB"
  )
}

#' @keywords internal
.enum_modalidad_title_label <- function(modalidad) {
  mod_norm <- .enum_norm_text(modalidad)
  if (grepl("telef", mod_norm, fixed = TRUE)) return("Telefónico")
  if (grepl("presenc", mod_norm, fixed = TRUE)) return("Presencial")

  x <- trimws(as.character(modalidad)[1])
  if (!nzchar(x)) return("Modalidad")
  x
}

#' @keywords internal
.enum_title_with_scope <- function(titulo, scope_label) {
  ttl <- trimws(as.character(titulo)[1])
  scp <- trimws(as.character(scope_label)[1])
  if (!nzchar(ttl)) ttl <- "Producción de Enumeradores"
  if (!nzchar(scp)) return(ttl)

  suffix <- paste0(" (", scp, ")")
  if (nchar(ttl) >= nchar(suffix)) {
    tail_txt <- substr(ttl, nchar(ttl) - nchar(suffix) + 1L, nchar(ttl))
    if (tolower(tail_txt) == tolower(suffix)) return(ttl)
  }

  paste0(ttl, " (", scp, ")")
}

#' @keywords internal
.enum_modalidad_prefix <- function(modalidad) {
  mod_norm <- .enum_norm_text(modalidad)
  if (grepl("telef", mod_norm, fixed = TRUE)) return("telef_")
  if (grepl("presenc", mod_norm, fixed = TRUE)) return("pres_")

  slug <- gsub("[^a-z0-9]+", "", mod_norm)
  if (!nzchar(slug)) slug <- "mod"
  paste0(slug, "_")
}

#' @keywords internal
.enum_prefixed_output_file <- function(output_file, prefix) {
  file.path(dirname(output_file), paste0(prefix, basename(output_file)))
}

#' @keywords internal
.enum_render_bundle_quarto <- function(bundle, output_file, template_qmd, tmp_root, quiet = FALSE) {
  tmp_dir <- tempfile("render_", tmpdir = tmp_root)
  dir.create(tmp_dir, recursive = TRUE, showWarnings = FALSE)

  path_rds <- file.path(tmp_dir, "bundle_enumeradores.rds")
  saveRDS(bundle, file = path_rds)

  path_qmd <- file.path(tmp_dir, "enumeradores.qmd")
  ok_copy <- file.copy(template_qmd, path_qmd, overwrite = TRUE)
  if (!isTRUE(ok_copy)) {
    stop("No se pudo copiar la plantilla Quarto temporal.", call. = FALSE)
  }

  out_name <- basename(output_file)
  render_args <- list(
    input = path_qmd,
    output_file = out_name
  )

  qr_formals <- names(formals(quarto::quarto_render))
  if ("execute_params" %in% qr_formals) {
    render_args$execute_params <- list(path_rds = path_rds)
  } else {
    stop(
      "Tu version de `{quarto}` no soporta `execute_params`. ",
      "Actualiza el paquete `{quarto}` en R para usar `reporte_enumeradores()`.",
      call. = FALSE
    )
  }
  if ("quiet" %in% qr_formals) render_args$quiet <- isTRUE(quiet)
  if ("output_dir" %in% qr_formals) render_args$output_dir <- tmp_dir

  out_render <- do.call(quarto::quarto_render, render_args)

  rendered_file <- file.path(tmp_dir, out_name)
  if (!file.exists(rendered_file) && is.character(out_render) && length(out_render) == 1L) {
    rendered_file <- out_render
  }
  if (!file.exists(rendered_file)) {
    stop("Quarto no produjo el archivo PDF esperado.", call. = FALSE)
  }

  out_dir <- dirname(output_file)
  if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

  copied <- file.copy(rendered_file, output_file, overwrite = TRUE)
  if (!isTRUE(copied)) {
    stop("No se pudo copiar el PDF a `output_file`.", call. = FALSE)
  }

  invisible(output_file)
}
