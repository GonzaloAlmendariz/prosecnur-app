# **El instrumento de una base es el XLSForm más lo que la base declara.**
# ADR 0106.
#
# Una base puede declarar tres cosas que el XLSForm no dice:
#   - columnas propias (`variables_propias`): columnas de la data que el XLSForm
#     no trae (`P12_R`, `facultad`, `indice_vbg`) y que la persona declaró con
#     etiqueta, tipo y, si es categórica, lista de opciones;
#   - variables calculadas (`variables_calculadas`): se calculan al leer la base
#     a partir de otras de la misma base (base_variables_calculadas.R);
#   - variables retiradas (`origen_externo$variables_retiradas`, ADR 0100): las
#     preguntas del XLSForm que la base preparada fuera ya no trae.
#
# El XLSForm original del usuario NO se reescribe. Aquí se deriva, por firma
# (archivo + declaraciones), un XLSForm adaptado en un directorio temporal del
# proceso y es ese el que leen los lectores (`reporte_instrumento`,
# `leer_instrumento_xlsform`). Así cualquier consumidor que parte de un path
# —Analítica, la reconstrucción de fuentes, Codificación— ve lo mismo, y
# reabrir el `.pulso` da lo mismo: las declaraciones viajan en la meta de la
# base y el adaptado se vuelve a derivar.

.BASE_VARIABLES_FORMATO <- 1L

# Tipos que una columna propia puede declarar.
.BASE_VARIABLES_TIPOS <- c("select_one", "integer", "decimal", "text", "date", "datetime")

# Retiradas vigentes de la base (sólo si la declaración de origen externo habla
# de la data vigente), con su motivo.
.base_variables_retiradas_vigentes <- function(base_meta) {
  bm <- base_meta %||% list()
  oe <- bm[["origen_externo"]]
  if (!identical(.origen_externo_estado(oe, bm[["data_file_id"]]), "vigente")) return(list())
  oe[["variables_retiradas"]] %||% list()
}

# Nombres de las retiradas vigentes (todas: lo que se informa).
.base_variables_retiradas_nombres <- function(base_meta) {
  nombres <- vapply(.base_variables_retiradas_vigentes(base_meta),
                    function(r) .origen_externo_chr(r[["variable"]]), character(1))
  unique(nombres[nzchar(nombres)])
}

# Retiradas que SALEN del instrumento adaptado. No todas: sólo las que registró
# la carga manual (la base llegó sin esa columna y la carga ya no la rechaza;
# `retiradas_carga_manual` vive en la meta de la base y no en el bloque, así que
# sobrevive a que se redeclare el origen externo) y las de motivo que ya
# excluía de los entregables (`metadato`, `no_va_al_cliente`). Una retirada de
# motivo `otra` declarada antes sigue en el instrumento, como siempre estuvo.
.base_variables_retiradas <- function(base_meta) {
  bm <- base_meta %||% list()
  de_carga <- .base_variables_lista(bm[["retiradas_carga_manual"]])
  sale <- Filter(function(r) {
    .origen_externo_chr(r[["variable"]]) %in% de_carga ||
      .origen_externo_chr(r[["motivo"]]) %in% .ORIGEN_EXTERNO_MOTIVOS_EXCLUYEN
  }, .base_variables_retiradas_vigentes(bm))
  nombres <- vapply(sale, function(r) .origen_externo_chr(r[["variable"]]), character(1))
  unique(nombres[nzchar(nombres)])
}

#' Declaraciones de la base que cambian su instrumento.
#' @keywords internal
base_variables_declaraciones <- function(base_meta) {
  bm <- base_meta %||% list()
  list(
    propias = bm[["variables_propias"]] %||% list(),
    calculadas = bm[["variables_calculadas"]] %||% list(),
    retiradas = .base_variables_retiradas(bm)
  )
}

.base_variables_sin_declaraciones <- function(decl) {
  !length(decl$propias) && !length(decl$calculadas) && !length(decl$retiradas)
}

.base_variables_dir <- function() {
  dir <- file.path(tempdir(), "prosecnur", "_base_variables")
  if (!dir.exists(dir)) dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  dir
}

#' Path del XLSForm adaptado de una base, o el original si no declara nada.
#'
#' @param path XLSForm de la base (original o el adaptado de Codificación).
#' @param base_meta meta de la base (`estudio$bases[[b]]`).
#' @return path a leer. Nunca el original reescrito.
#' @keywords internal
base_variables_xls_path <- function(path, base_meta) {
  path <- as.character(path %||% "")[1]
  if (is.na(path) || !nzchar(path) || !file.exists(path)) return(path)
  decl <- base_variables_declaraciones(base_meta)
  if (.base_variables_sin_declaraciones(decl)) return(path)
  info <- file.info(path)
  firma <- digest::digest(list(
    formato = .BASE_VARIABLES_FORMATO,
    path = normalizePath(path, mustWork = FALSE),
    mtime = format(as.numeric(info$mtime), digits = 15),
    size = as.character(info$size),
    decl = decl
  ), algo = "xxhash64")
  out <- file.path(.base_variables_dir(), paste0(firma, ".xlsx"))
  if (file.exists(out)) return(out)
  frames <- .base_variables_frames_adaptados(path, decl)
  if (is.null(frames)) return(path)
  # Se escribe al lado y se renombra: un lector concurrente nunca ve un xlsx a medias.
  tmp <- tempfile(tmpdir = dirname(out), fileext = ".xlsx")
  .analitica_write_xlsform_frames(frames$survey, frames$choices, frames$settings, tmp)
  if (!file.rename(tmp, out)) {
    unlink(tmp, force = TRUE)
    if (!file.exists(out)) return(path)
  }
  out
}

.base_variables_leer_hoja <- function(path, hoja, como_texto = TRUE) {
  tryCatch(
    as.data.frame(
      suppressWarnings(readxl::read_excel(path, sheet = hoja,
                                          col_types = if (como_texto) "text" else NULL)),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    error = function(e) NULL
  )
}

# Columnas de etiqueta de una hoja (`label`, `label::Spanish (es)`…).
.base_variables_cols_label <- function(df) {
  grep("^label", names(df), ignore.case = TRUE, value = TRUE)
}

# Filas nuevas con las columnas de `df`: lo que no se nombra queda NA.
.base_variables_filas <- function(df, valores, cols_label) {
  n <- length(valores[[1]])
  out <- as.data.frame(
    stats::setNames(lapply(names(df), function(x) rep(NA_character_, n)), names(df)),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  for (col in setdiff(names(valores), "label")) out[[col]] <- as.character(valores[[col]])
  for (col in cols_label) out[[col]] <- as.character(valores$label)
  out
}

.base_variables_opciones_df <- function(opciones) {
  cod <- vapply(opciones %||% list(), function(o) .origen_externo_chr(o[["codigo"]]), character(1))
  etq <- vapply(opciones %||% list(), function(o) .origen_externo_chr(o[["etiqueta"]]), character(1))
  etq[!nzchar(etq)] <- cod[!nzchar(etq)]
  keep <- nzchar(cod) & !duplicated(cod)
  data.frame(codigo = cod[keep], etiqueta = etq[keep], stringsAsFactors = FALSE)
}

# survey/choices/settings del adaptado: sin las retiradas y con las propias y
# las calculadas al final, en el nivel superior del formulario.
.base_variables_frames_adaptados <- function(path, decl) {
  survey <- .base_variables_leer_hoja(path, "survey")
  if (is.null(survey) || !all(c("type", "name") %in% names(survey))) return(NULL)
  choices <- .base_variables_leer_hoja(path, "choices")
  if (is.null(choices) || !all(c("list_name", "name") %in% names(choices))) {
    choices <- data.frame(list_name = character(0), name = character(0), label = character(0),
                          stringsAsFactors = FALSE)
  }
  settings <- .base_variables_leer_hoja(path, "settings", como_texto = FALSE) %||% data.frame()
  lab_s <- .base_variables_cols_label(survey)
  if (!length(lab_s)) { survey$label <- NA_character_; lab_s <- "label" }
  lab_c <- .base_variables_cols_label(choices)
  if (!length(lab_c)) { choices$label <- NA_character_; lab_c <- "label" }

  if (length(decl$retiradas)) {
    survey <- survey[!(as.character(survey$name) %in% decl$retiradas), , drop = FALSE]
  }
  usados <- unique(as.character(choices$list_name))
  nuevas_s <- list()
  nuevas_c <- list()
  agregar <- function(nombre, etiqueta, tipo, opciones) {
    if (nombre %in% as.character(survey$name)) return(invisible(NULL))  # ya viene (p. ej. adaptado de Codificación)
    if (identical(tipo, "select_one")) {
      ln <- .carga_sav_list_name(nombre, usados)
      usados <<- c(usados, ln)
      op <- .base_variables_opciones_df(opciones)
      nuevas_c[[length(nuevas_c) + 1L]] <<- .base_variables_filas(
        choices, list(list_name = rep(ln, nrow(op)), name = op$codigo, label = op$etiqueta), lab_c)
      tipo <- paste("select_one", ln)
    }
    nuevas_s[[length(nuevas_s) + 1L]] <<- .base_variables_filas(
      survey, list(type = tipo, name = nombre, label = etiqueta), lab_s)
  }
  for (p in decl$propias) {
    nombre <- .origen_externo_chr(p[["name"]])
    if (!nzchar(nombre)) next
    etiqueta <- .origen_externo_chr(p[["label"]])
    agregar(nombre, if (nzchar(etiqueta)) etiqueta else nombre,
            .origen_externo_chr(p[["tipo"]], "text"), p[["opciones"]])
  }
  for (cv in decl$calculadas) {
    nombre <- .origen_externo_chr(cv[["nombre"]])
    if (!nzchar(nombre)) next
    etiqueta <- .origen_externo_chr(cv[["etiqueta"]])
    # Una fórmula da un número; las demás reglas, una escala.
    es_formula <- identical(.origen_externo_chr(cv[["regla"]]), "formula")
    agregar(nombre, if (nzchar(etiqueta)) etiqueta else nombre,
            if (es_formula) "decimal" else "select_one", base_variables_escala(cv))
  }
  if (length(nuevas_s)) survey <- rbind(survey, do.call(rbind, nuevas_s))
  if (length(nuevas_c)) choices <- rbind(choices, do.call(rbind, nuevas_c))
  list(survey = survey, choices = choices, settings = settings)
}

#' Instrumento (`reporte_instrumento`) de la base con sus declaraciones.
#' @keywords internal
base_variables_instrumento <- function(path, base_meta) {
  reporte_instrumento(path = base_variables_xls_path(path, base_meta))
}
