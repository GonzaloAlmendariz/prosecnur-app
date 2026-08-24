# Override permanente de etiquetas por proyecto (label_overrides)
# ================================================================
#
# PROBLEMA (root cause). Algunos instrumentos traen la etiqueta ya bilingüe
# pegada en UNA sola celda `label` del sheet `choices`/`survey` del XLSForm
# (ej. ACNUR_PDM: "Sí Yes", "Muy seguro Very safe"). `reporte_instrumento.R`
# lee una sola columna `label` y NO concatena — o sea el bilingüe viene del
# dato de origen. El split ES/EN no es automatizable (no hay delimitador), así
# que se resuelve con un mapa CURADO a mano, persistido por proyecto.
#
# DISEÑO (gemelo del override de orden ordinal, ver orden_categorias.R). El
# analista/seed define un override que viaja en el estado del proyecto
# (`s$label_overrides`, persistido dentro del `.pulso`) y se aplica UNA vez en
# la capa de instrumento — en `.bases_normalize_report_context()` (helpers_bases
# .R), el chokepoint por el que pasa TODO instrumento+data del pipeline
# (lo llama `reporte_data()` y `.load_rp_sources()` de los entregables). Como
# se aplica ahí, ningún engine tiene que re-aplicarlo.
#
# CONTRATO del override (forma normalizada, `.label_overrides_normalize()`):
#   list(
#     values = list(<list_name> = c(<code> = "etiqueta_es", ...), ...),  # opciones
#     titles = c(<variable_name> = "titulo_es", ...)                     # preguntas
#   )
# En el `.pulso` se guarda la forma cruda (jsonlite-friendly): una lista con
# `$values` (list_name -> named list code->es) y `$titles` (var -> es). El
# round-trip de jsonlite se protege forzando listas nombradas (nunca scalars
# que colapsen).
#
# LOS TRES PUNTOS donde vive la etiqueta bilingüe y a los que hay que llegar
# (hallazgo verificado sobre ACNUR):
#   1. `inst$choices$label`            (fuente de dicc_code_to_label / orders_list)
#   2. `attr(col, "labels")`           (value labels observadas en las filas)
#   3. `attr(col, "label")`            (título de la pregunta)
# `.label_overrides_apply_to_instrument()` reescribe (1) y re-deriva los dicc /
# orders_list / var_labels; `.label_overrides_relabel_data()` reescribe (2) y
# (3) sobre las columnas de la base. Ambos se invocan desde el chokepoint.

# --- Estado ambiente (proceso-global) ---------------------------------------
# `reporte_data()` y `.bases_normalize_report_context()` son funciones puras
# (no conocen la sesión). Para poder aplicar el override "una vez" en la capa
# de instrumento sin tocar los ~20 call sites que construyen instrumentos, el
# override activo del proyecto se publica en este env de paquete. La app es
# mono-usuario (un proyecto activo a la vez), así que un único slot basta. El
# override es id-preserving e idempotente: reemplaza etiqueta bilingüe por su
# español para `(list_name, code)`/`variable` que casen, sin tocar códigos ni
# variables sin override — por eso aplicarlo de forma ambiente es seguro.
.label_overrides_env <- new.env(parent = emptyenv())

#' Publica el override normalizado del proyecto activo en el env ambiente.
#' `ov` NULL o vacío desactiva (deja de aplicarse a construcciones nuevas).
#' @noRd
.label_overrides_activate <- function(ov) {
  ov <- .label_overrides_normalize(ov)
  if (.label_overrides_is_empty(ov)) {
    .label_overrides_env$active <- NULL
  } else {
    .label_overrides_env$active <- ov
  }
  invisible(.label_overrides_env$active)
}

#' Override activo (o NULL). Lo consultan las funciones puras del chokepoint.
#' @noRd
.label_overrides_ambient <- function() {
  if (!exists("active", envir = .label_overrides_env, inherits = FALSE)) return(NULL)
  .label_overrides_env$active
}

# --- Normalización del contrato ---------------------------------------------

#' TRUE si el override no tiene ni values ni titles aplicables.
#' @noRd
.label_overrides_is_empty <- function(ov) {
  if (is.null(ov) || !is.list(ov)) return(TRUE)
  n_values <- length(ov$values %||% list())
  n_titles <- length(ov$titles %||% character(0))
  n_values == 0L && n_titles == 0L
}

#' Normaliza la forma cruda (jsonlite) del override a
#' `list(values = list(list_name -> named chr code->es), titles = named chr)`.
#' Tolera:
#'   - `values` como named list de named list/vectores `code -> es`.
#'   - `titles` como named list/vector `variable -> es`.
#'   - la forma ya normalizada (idempotente).
#' Descarta claves/valores vacíos. Nunca devuelve scalars sueltos.
#' @noRd
.label_overrides_normalize <- function(raw) {
  empty <- list(values = list(), titles = stats::setNames(character(0), character(0)))
  if (is.null(raw) || !is.list(raw)) return(empty)

  # values: list_name -> (code -> es)
  values <- list()
  raw_values <- raw$values %||% list()
  if (is.list(raw_values) && length(raw_values)) {
    for (ln in names(raw_values)) {
      if (is.null(ln) || is.na(ln) || !nzchar(ln)) next
      codes_map <- raw_values[[ln]]
      # Aceptar named list o named vector.
      if (is.null(codes_map)) next
      if (is.atomic(codes_map) && !is.null(names(codes_map))) codes_map <- as.list(codes_map)
      if (!is.list(codes_map) || !length(codes_map)) next
      cm_names <- names(codes_map)
      if (is.null(cm_names)) next
      out_codes <- character(0)
      out_keys  <- character(0)
      for (code in cm_names) {
        if (is.null(code) || is.na(code) || !nzchar(code)) next
        es <- codes_map[[code]]
        es <- as.character(es %||% "")[1]
        if (is.na(es) || !nzchar(es)) next
        out_keys  <- c(out_keys, as.character(code))
        out_codes <- c(out_codes, es)
      }
      if (length(out_keys)) values[[ln]] <- stats::setNames(out_codes, out_keys)
    }
  }

  # titles: variable -> es
  titles_keys <- character(0)
  titles_vals <- character(0)
  raw_titles <- raw$titles %||% list()
  if (is.atomic(raw_titles) && !is.null(names(raw_titles))) raw_titles <- as.list(raw_titles)
  if (is.list(raw_titles) && length(raw_titles)) {
    for (var in names(raw_titles)) {
      if (is.null(var) || is.na(var) || !nzchar(var)) next
      es <- as.character(raw_titles[[var]] %||% "")[1]
      if (is.na(es) || !nzchar(es)) next
      titles_keys <- c(titles_keys, as.character(var))
      titles_vals <- c(titles_vals, es)
    }
  }

  list(
    values = values,
    titles = stats::setNames(titles_vals, titles_keys)
  )
}

#' Serializa el override normalizado a la forma jsonlite-friendly que se guarda
#' en el `.pulso` / se devuelve por el endpoint. Mantiene listas nombradas para
#' que jsonlite no colapse un único par a scalar en el round-trip.
#' @noRd
.label_overrides_to_storage <- function(ov) {
  ov <- .label_overrides_normalize(ov)
  values <- list()
  for (ln in names(ov$values)) {
    m <- ov$values[[ln]]
    values[[ln]] <- as.list(stats::setNames(as.character(unname(m)), names(m)))
  }
  titles <- as.list(stats::setNames(as.character(unname(ov$titles)), names(ov$titles)))
  list(values = values, titles = titles)
}

# --- Aplicación en la capa de instrumento -----------------------------------

#' Aplica el override al objeto instrumento (`prosecnur_instrumento`). Reescribe
#' TODAS las columnas de etiqueta (`label`, `label::es`, …) del `choices` (y del
#' `choices_raw` si existe) para `(list_name, code)` que casen, las del `survey`
#' (+ `survey_raw` + `var_labels`) para títulos, y
#' RE-DERIVA `dicc_code_to_label`, `dicc_label_to_code`, `orders_list$labels`
#' y `orders_list$label` desde lo ya reescrito. Idempotente; sin override
#' aplicable devuelve `inst` intacto.
#' @noRd
.label_overrides_apply_to_instrument <- function(inst, ov = NULL) {
  ov <- .label_overrides_normalize(ov %||% .label_overrides_ambient())
  if (.label_overrides_is_empty(ov)) return(inst)
  if (is.null(inst) || !is.list(inst)) return(inst)
  original_class <- class(inst)

  values <- ov$values
  titles <- ov$titles

  # (1) choices$label por (list_name, name). Fuente real de los dicc/orders.
  # Se escriben TODAS las columnas de etiqueta de la fila, no solo la `label`
  # derivada: el instrumento canónico conserva ahí las crudas (`label::es`) y el
  # XLSForm final exporta esa misma hoja, así que tocar una sola dejaba el
  # entregable contradiciéndose (ver `.bases_set_label_cols`).
  if (length(values) && !is.null(inst$choices) && is.data.frame(inst$choices) &&
      all(c("list_name", "name") %in% names(inst$choices))) {
    ln_col <- as.character(inst$choices$list_name)
    nm_col <- as.character(inst$choices$name)
    for (ln in names(values)) {
      code_map <- values[[ln]]
      for (code in names(code_map)) {
        hit <- which(ln_col == ln & nm_col == code)
        inst$choices <- .bases_set_label_cols(inst$choices, hit, code_map[[code]])
      }
    }
  }

  # choices_raw: puede no existir en el instrumento construido; reescribir todas
  # las columnas label* si está presente (mantiene coherencia si algún engine
  # las re-lee).
  if (length(values) && !is.null(inst$choices_raw) && is.data.frame(inst$choices_raw) &&
      all(c("list_name", "name") %in% names(inst$choices_raw))) {
    ln_col <- as.character(inst$choices_raw$list_name)
    nm_col <- as.character(inst$choices_raw$name)
    for (ln in names(values)) {
      code_map <- values[[ln]]
      for (code in names(code_map)) {
        hit <- which(ln_col == ln & nm_col == code)
        inst$choices_raw <- .bases_set_label_cols(inst$choices_raw, hit, code_map[[code]])
      }
    }
  }

  # (3) survey$label + survey_raw + var_labels por variable (títulos bilingües).
  if (length(titles)) {
    if (!is.null(inst$survey) && is.data.frame(inst$survey) &&
        "name" %in% names(inst$survey)) {
      sv_names <- as.character(inst$survey$name)
      for (var in names(titles)) {
        hit <- which(sv_names == var)
        inst$survey <- .bases_set_label_cols(inst$survey, hit, titles[[var]])
      }
    }
    if (!is.null(inst$survey_raw) && is.data.frame(inst$survey_raw) &&
        "name" %in% names(inst$survey_raw)) {
      sv_names <- as.character(inst$survey_raw$name)
      for (var in names(titles)) {
        hit <- which(sv_names == var)
        inst$survey_raw <- .bases_set_label_cols(inst$survey_raw, hit, titles[[var]])
      }
    }
    if (!is.null(inst$var_labels) && length(inst$var_labels)) {
      for (var in names(titles)) {
        if (var %in% names(inst$var_labels)) inst$var_labels[[var]] <- titles[[var]]
      }
    }
  }

  # Re-derivar dicc + orders_list desde el choices ya reescrito. Reusa la
  # maquinaria compartida del pipeline si está disponible (misma que usa
  # reporte_data); si no, re-deriva a mano los dicc.
  if (length(values)) {
    if (exists(".bases_clean_report_instrument", mode = "function")) {
      inst <- .bases_clean_report_instrument(inst)
    } else {
      inst <- .label_overrides_rederive_dicc(inst)
    }
    # orders_list$labels re-derivado por si .bases_clean_report_instrument no
    # cubrió alguna variable (p. ej. instrumento sin survey utilizable).
    if (!is.null(inst$orders_list) && length(inst$orders_list) &&
        !is.null(inst$dicc_code_to_label)) {
      for (var in names(inst$orders_list)) {
        entry <- inst$orders_list[[var]]
        if (is.null(entry$names) || !length(entry$names)) next
        ln <- .label_overrides_var_list_name(inst, var)
        if (!nzchar(ln) || is.null(inst$dicc_code_to_label[[ln]])) next
        dic <- inst$dicc_code_to_label[[ln]]
        new_labels <- as.character(dic[as.character(entry$names)])
        keep <- !is.na(new_labels)
        if (any(keep)) {
          cur <- as.character(entry$labels %||% new_labels)
          if (length(cur) != length(entry$names)) cur <- new_labels
          cur[keep] <- new_labels[keep]
          inst$orders_list[[var]]$labels <- cur
        }
      }
    }
  }

  # orders_list$label / var_label (título) para variables con override de título.
  if (length(titles) && !is.null(inst$orders_list) && length(inst$orders_list)) {
    for (var in names(titles)) {
      if (!is.null(inst$orders_list[[var]])) {
        inst$orders_list[[var]]$label <- titles[[var]]
        inst$orders_list[[var]]$var_label <- titles[[var]]
      }
    }
  }

  if (!is.null(original_class)) class(inst) <- original_class
  inst
}

#' Re-deriva dicc_code_to_label / dicc_label_to_code desde inst$choices.
#' Fallback usado solo si `.bases_clean_report_instrument` no está cargado.
#' @noRd
.label_overrides_rederive_dicc <- function(inst) {
  ch <- inst$choices
  if (is.null(ch) || !is.data.frame(ch) ||
      !all(c("list_name", "name", "label") %in% names(ch))) return(inst)
  keep <- !is.na(ch$list_name) & nzchar(as.character(ch$list_name)) &
    !is.na(ch$name) & nzchar(as.character(ch$name)) & !is.na(ch$label)
  ch <- ch[keep, , drop = FALSE]
  if (!nrow(ch)) return(inst)
  by_list <- split(ch, as.character(ch$list_name))
  inst$dicc_code_to_label <- lapply(by_list, function(x) {
    stats::setNames(as.character(x$label), as.character(x$name))
  })
  inst$dicc_label_to_code <- lapply(by_list, function(x) {
    stats::setNames(as.character(x$name), as.character(x$label))
  })
  inst
}

#' list_name de una variable, reusando el helper compartido del pipeline.
#' @noRd
.label_overrides_var_list_name <- function(inst, var) {
  if (exists(".analitica_list_name_for_var", mode = "function")) {
    ln <- tryCatch(.analitica_list_name_for_var(inst, var), error = function(e) "")
    if (nzchar(ln)) return(ln)
  }
  sv <- inst$survey
  if (is.null(sv) || !is.data.frame(sv) || !"name" %in% names(sv)) return("")
  row <- sv[as.character(sv$name) == var, , drop = FALSE]
  if (!nrow(row)) return("")
  if (exists(".bases_survey_list_name", mode = "function")) {
    return(.bases_survey_list_name(row[1, , drop = FALSE]))
  }
  ""
}

#' Reescribe los atributos de valor / título de las columnas de `data` desde el
#' instrumento YA overrideado. Cubre los puntos (2) `attr(labels)` y (3)
#' `attr(label)` que se derivaron aparte en `reporte_data()`.
#'   - value labels: para cada columna con `attr(labels)`, remapea sus etiquetas
#'     por código usando el `dicc_code_to_label` del instrumento overrideado.
#'   - títulos: aplica `titles[[var]]` a `attr(label)` (y a dummies cuyo código
#'     de opción tenga override de valor).
#' @noRd
.label_overrides_relabel_data <- function(data, inst, ov = NULL) {
  ov <- .label_overrides_normalize(ov %||% .label_overrides_ambient())
  if (.label_overrides_is_empty(ov)) return(data)
  if (!is.data.frame(data) || !length(names(data))) return(data)

  values <- ov$values
  titles <- ov$titles

  # (2) value labels observadas: remap por (list_name, code) del instrumento
  # overrideado. Solo columnas con list_name resoluble y override para esa lista.
  if (length(values)) {
    for (v in names(data)) {
      labs <- attr(data[[v]], "labels", exact = TRUE)
      if (is.null(labs) || !length(labs)) next
      ln <- .label_overrides_var_list_name(inst, v)
      if (!nzchar(ln) || is.null(values[[ln]])) next
      code_map <- values[[ln]]
      codes <- names(labs)
      if (is.null(codes)) next
      new_labs <- as.character(labs)
      for (i in seq_along(codes)) {
        code <- as.character(codes[i])
        if (!is.na(code) && nzchar(code) && code %in% names(code_map)) {
          new_labs[i] <- code_map[[code]]
        }
      }
      attr(data[[v]], "labels") <- stats::setNames(new_labs, codes)
    }
  }

  # (3) títulos de pregunta: attr(label) directo por variable.
  if (length(titles)) {
    for (var in names(titles)) {
      if (var %in% names(data)) attr(data[[var]], "label") <- titles[[var]]
    }
  }

  data
}

# --- Persistencia por proyecto (sesión / .pulso) ----------------------------

#' Lee el override del proyecto activo (forma normalizada). Sin estado devuelve
#' vacío.
#' @noRd
label_overrides_get <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(.label_overrides_normalize(NULL))
  .label_overrides_normalize(s$label_overrides)
}

#' Persiste el override del proyecto (`s$label_overrides`, dentro del `.pulso`),
#' marca el proyecto dirty y republica el override ambiente. Valida que la forma
#' cruda sea un objeto con `values`/`titles`.
#' @noRd
label_overrides_set <- function(sid, raw) {
  if (!is.null(raw) && !is.list(raw)) {
    stop_api(400, "E_LABEL_OVERRIDES_INVALIDAS",
             "label_overrides debe ser un objeto con 'values' y/o 'titles'.")
  }
  storage <- .label_overrides_to_storage(raw)
  # session_set marca el proyecto dirty por sí solo (salvo claves internas).
  session_set(sid, "label_overrides", storage)
  .label_overrides_activate(storage)
  invisible(storage)
}

# --- Seed desde un mapa bilingüe (label bilingüe -> español) ----------------

#' Convierte un mapa CURADO `etiqueta_bilingue -> etiqueta_es` en el override
#' `(list_name, code) -> es`, casando cada etiqueta bilingüe contra el
#' `inst$choices$label`/`(list_name, name)` del instrumento. Devuelve la forma
#' de almacenamiento (jsonlite-friendly) lista para persistir.
#'
#' @param inst  instrumento (`reporte_instrumento`) del que se leen las choices.
#' @param bilingual_map  named chr: nombres = etiqueta bilingüe tal cual en el
#'   XLSForm; valores = etiqueta español.
#' @param titles  (opcional) named chr `variable -> es` para títulos bilingües.
#' @return list(values=..., titles=...) + `unmatched` (etiquetas del mapa que no
#'   casaron con ninguna choice) como atributo, para diagnóstico.
#' @noRd
.label_overrides_seed_from_bilingual_map <- function(inst, bilingual_map, titles = NULL) {
  ch <- inst$choices
  if (is.null(ch) || !is.data.frame(ch) ||
      !all(c("list_name", "name", "label") %in% names(ch))) {
    stop_api(500, "E_LABEL_OVERRIDES_SIN_CHOICES",
             "El instrumento no tiene un sheet choices utilizable para el seed.")
  }
  ln_col  <- as.character(ch$list_name)
  nm_col  <- as.character(ch$name)
  lab_col <- as.character(ch$label)

  values <- list()
  matched <- character(0)
  for (bilabel in names(bilingual_map)) {
    es <- as.character(bilingual_map[[bilabel]] %||% "")[1]
    if (!nzchar(es)) next
    hit <- which(lab_col == bilabel)
    if (!length(hit)) next
    matched <- c(matched, bilabel)
    for (i in hit) {
      ln <- ln_col[i]; code <- nm_col[i]
      if (is.na(ln) || !nzchar(ln) || is.na(code) || !nzchar(code)) next
      cur <- values[[ln]] %||% list()
      cur[[code]] <- es
      values[[ln]] <- cur
    }
  }
  unmatched <- setdiff(names(bilingual_map), matched)

  storage <- .label_overrides_to_storage(list(values = values, titles = titles))
  attr(storage, "unmatched") <- unmatched
  attr(storage, "matched")   <- matched
  storage
}
