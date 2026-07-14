# =============================================================================
# Repeat groups de KoboToolbox -> bases hijas vinculadas (ADR 0030, Fase 1)
# =============================================================================
#
# Kobo devuelve un `begin_repeat` como UNA columna JSON-string en la data
# aplanada (kobo_api_flatten_results usa jsonlite flatten=TRUE, que NO expande
# repeats). Cada instancia del repeat = una fila real de datos que la base ancha
# no puede representar (N instancias por submission). Este módulo:
#   1. Descubre los repeats del instrumento (por profundidad begin_repeat).
#   2. Detecta la columna blob en la data aplanada.
#   3. Expande el blob a un data.frame long (1 fila por submission x instancia).
#   4. Arma un XLSForm hijo con las preguntas del repeat (envueltas en un
#      begin_group que preserva el gate `relevant` del begin_repeat original).
#   5. Registra la base hija en el estudio, vinculada al padre con las LLAVES
#      CANÓNICAS ODK/Kobo que el subsistema de validación multi-tabla ya espera
#      (validacion_lector_limpieza.R / validacion_ast_runtime.R):
#        - `_index`             : índice global de la fila hija (1..total).
#        - `_parent_index`      : `_index` (1-based) de la fila madre.
#        - `_parent_table_name` : nombre de la base/form madre.
#        - `_submission__id`    : `_id` de la submission madre (fallback de enlace).
#
# ADR 0030 supersede la convención interina `_parent_id`/`_repeat_index`: era
# incompatible con `ll_choose_link_keys` (child `_parent_index`↔parent `_index`,
# fallback `_submission__id`↔`_id`) y con `.inherit_parent_columns` (child
# `_parent_index`↔main `_index`). Ahora casan exacto.
#
# La lógica vive aquí (no en router_carga.R) para mantener el router delgado.

# Descubre los repeats del instrumento. Devuelve una lista de specs, una por
# `begin_repeat`, en orden de aparición. Cada spec:
#   name           -> nombre del repeat (ej. "rep_servicios")
#   leaf_vars      -> nombres cortos de las preguntas con dato del repeat
#   list_names     -> list_names de las select_* del repeat
#   row_indices    -> índices de fila (en survey) de esas preguntas
#   group_relevant -> `relevant` del begin_repeat (gate del grupo, ADR 0030)
#   begin_row      -> índice de fila del begin_repeat (para metadata)
#
# Una pregunta se asigna al repeat que la contiene de forma INMEDIATA, de modo
# que repeats anidados quedan cada uno con sus propias preguntas.
#
# NOTA (ADR 0030 Fase 1): `calculate` NO se salta. Los `calculate` con
# `jr:choice-name()` (típicamente `current_code`/`current_label`) son la IDENTIDAD
# del roster de cada instancia (qué servicio/ítem se repite) y su VALOR ya viene
# resuelto por Kobo dentro del blob. Deben sobrevivir a la ingesta como columnas
# de la base hija y como filas del instrumento hijo (para etiquetas/orden).
.kobo_repeat_specs <- function(inst) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) return(list())
  type_base <- .dn_survey_type_base(survey)
  names_raw <- .dn_survey_names(survey)
  relevant_col <- if ("relevant" %in% names(survey)) as.character(survey$relevant) else rep("", nrow(survey))
  relevant_col[is.na(relevant_col)] <- ""
  skip_types <- c(
    "begin_group", "end_group", "begin_repeat", "end_repeat",
    "note", "start", "end", "today", "deviceid",
    "subscriberid", "phonenumber", "simserial", "username", "audit"
  )
  list_name_at <- function(i) {
    ln <- .dn_survey_list_name(survey[i, , drop = FALSE])
    if (is.na(ln)) "" else ln
  }

  specs <- list()       # name -> spec parcial
  order <- character(0) # preserva orden de aparición
  stack <- character(0) # nombres de repeats abiertos (pila)
  for (i in seq_len(nrow(survey))) {
    tb <- type_base[i]
    nm <- names_raw[i]
    if (identical(tb, "begin_repeat")) {
      key <- if (nzchar(nm)) nm else ""
      if (nzchar(key) && is.null(specs[[key]])) {
        specs[[key]] <- list(
          name = key, leaf_vars = character(0),
          list_names = character(0), row_indices = integer(0),
          group_relevant = relevant_col[i], begin_row = i
        )
        order <- c(order, key)
      }
      stack <- c(stack, key)
      next
    }
    if (identical(tb, "end_repeat")) {
      if (length(stack)) stack <- stack[-length(stack)]
      next
    }
    if (!length(stack)) next               # fuera de cualquier repeat
    parent_rep <- stack[[length(stack)]]   # repeat inmediato
    if (!nzchar(parent_rep) || !nzchar(nm)) next
    if (tb %in% skip_types) next           # markers de grupo, notas, metadata
    specs[[parent_rep]]$leaf_vars <- c(specs[[parent_rep]]$leaf_vars, nm)
    specs[[parent_rep]]$row_indices <- c(specs[[parent_rep]]$row_indices, i)
    ln <- list_name_at(i)
    if (nzchar(ln)) {
      specs[[parent_rep]]$list_names <- unique(c(specs[[parent_rep]]$list_names, ln))
    }
  }
  lapply(order, function(key) {
    sp <- specs[[key]]
    keep <- !duplicated(sp$leaf_vars)
    sp$leaf_vars <- sp$leaf_vars[keep]
    sp$row_indices <- sp$row_indices[keep]
    sp
  })
}

# Nombre de la columna blob del repeat en la data aplanada, o NULL. Se detecta
# genéricamente: es la columna cuyo leaf (todo tras el último "/") == nombre del
# repeat. Un repeat anidado sin columna top-level devuelve NULL (se salta).
.kobo_repeat_blob_column <- function(data, repeat_name) {
  if (!is.data.frame(data) || !nzchar(repeat_name %||% "")) return(NULL)
  nms <- names(data)
  leaf <- gsub("^.*/", "", nms)
  hit <- nms[leaf == repeat_name]
  if (!length(hit)) return(NULL)
  hit[[1]]
}

# Escalar de un valor de instancia del repeat (Kobo suele guardar strings; un
# valor anidado inesperado se serializa a JSON en vez de romper).
.kobo_repeat_scalar <- function(x) {
  if (is.null(x) || !length(x)) return(NA_character_)
  if (is.list(x)) {
    return(as.character(jsonlite::toJSON(x, auto_unbox = TRUE, null = "null")))
  }
  out <- as.character(x)
  out <- out[!is.na(out) & nzchar(out)]
  if (!length(out)) return(NA_character_)
  paste(out, collapse = " ")
}

# Parsea una celda blob a lista de instancias (cada una lista nombrada por leaf).
# La celda es un string JSON de array de objetos (o NA / "[]" si sin instancias).
.kobo_parse_repeat_cell <- function(cell) {
  if (is.null(cell) || !length(cell)) return(list())
  if (is.character(cell)) {
    txt <- cell[[1]]
    if (is.na(txt)) return(list())
    txt <- trimws(txt)
    if (!nzchar(txt) || txt %in% c("[]", "null", "NA")) return(list())
    # tryCatch: una celda malformada se trata como "sin instancias" en vez de
    # abortar toda la importación; el resto de submissions se procesa igual.
    parsed <- tryCatch(
      jsonlite::fromJSON(txt, simplifyVector = FALSE),
      error = function(e) NULL
    )
    if (is.null(parsed)) return(list())
  } else if (is.list(cell)) {
    parsed <- cell
  } else {
    return(list())
  }
  # `parsed` puede ser un array de objetos o un solo objeto (una instancia).
  if (is.list(parsed) && length(parsed) && !is.null(names(parsed))) {
    parsed <- list(parsed)
  }
  lapply(parsed, function(obj) {
    if (!is.list(obj) || is.null(names(obj))) return(list())
    leafs <- gsub("^.*/", "", names(obj))
    stats::setNames(obj, leafs)
  })
}

# Llaves canónicas de la base hija (ADR 0030). `_index`/`_parent_index` son
# enteros; el resto character.
.KOBO_CHILD_META_COLS <- c("_index", "_parent_index", "_parent_table_name", "_submission__id")

.kobo_rows_to_df <- function(rows, data_cols) {
  cols <- c(.KOBO_CHILD_META_COLS, data_cols)
  int_cols <- c("_index", "_parent_index")
  if (!length(rows)) {
    empty <- stats::setNames(
      lapply(cols, function(cn) if (cn %in% int_cols) integer(0) else character(0)),
      cols
    )
    return(as.data.frame(empty, stringsAsFactors = FALSE, check.names = FALSE))
  }
  as.data.frame(
    stats::setNames(lapply(cols, function(cn) {
      if (cn %in% int_cols) {
        as.integer(vapply(rows, function(r) {
          v <- r[[cn]]
          if (is.null(v)) NA_integer_ else as.integer(v[[1]])
        }, integer(1)))
      } else {
        vapply(rows, function(r) {
          v <- r[[cn]]
          if (is.null(v)) NA_character_ else as.character(v[[1]])
        }, character(1))
      }
    }), cols),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

# Expande un repeat a data.frame long: 1 fila por (submission x instancia), con
# las llaves canónicas ODK/Kobo. Las columnas de dato = UNIÓN de los leaf_vars
# del survey (incluye los `calculate` del roster) MÁS cualquier key presente en
# el blob que el filtro del survey no cubra (robustez: no dependemos sólo del
# tipo declarado). Las keys técnicas del blob (que empiezan con "_") se ignoran.
# El data.frame resultante lleva `attr(., "data_cols")` con las columnas de dato
# para que el constructor del instrumento hijo las describa todas.
#
# `parent_index`  : vector alineado con las filas de `data` = `_index` de cada
#                   fila madre (1-based); si falta, se asume seq_len(nrow).
# `parent_ids`    : vector alineado con las filas de `data` = `_id` de la madre.
# `parent_table_name` : nombre de la base/form madre.
.kobo_expand_repeat <- function(data, repeat_spec, blob_col,
                                parent_index = NULL, parent_ids = NULL,
                                parent_table_name = "") {
  leaf_vars <- repeat_spec$leaf_vars
  n <- if (is.data.frame(data)) nrow(data) else 0L
  if (!n || is.null(blob_col) || !(blob_col %in% names(data))) {
    out <- .kobo_rows_to_df(list(), leaf_vars)
    attr(out, "data_cols") <- leaf_vars
    return(out)
  }
  if (is.null(parent_index) || length(parent_index) != n) parent_index <- seq_len(n)
  if (is.null(parent_ids) || length(parent_ids) != n) parent_ids <- as.character(seq_len(n))
  blob <- data[[blob_col]]

  # 1er pase: parsear todas las celdas y recolectar la unión de keys del blob.
  parsed_rows <- vector("list", n)
  blob_keys <- character(0)
  for (i in seq_len(n)) {
    cell <- if (is.list(blob)) blob[[i]] else blob[i]
    instances <- .kobo_parse_repeat_cell(cell)
    parsed_rows[[i]] <- instances
    for (obj in instances) {
      if (length(obj)) blob_keys <- c(blob_keys, names(obj))
    }
  }
  extra_keys <- setdiff(unique(blob_keys), leaf_vars)
  extra_keys <- extra_keys[nzchar(extra_keys) & !startsWith(extra_keys, "_")]
  data_cols <- c(leaf_vars, extra_keys)

  # 2do pase: emitir una fila por instancia con índice global creciente.
  gi <- 0L
  rows <- list()
  for (i in seq_len(n)) {
    instances <- parsed_rows[[i]]
    if (!length(instances)) next
    for (k in seq_along(instances)) {
      obj <- instances[[k]]
      gi <- gi + 1L
      rowvals <- stats::setNames(vector("list", length(data_cols)), data_cols)
      for (v in data_cols) rowvals[[v]] <- .kobo_repeat_scalar(obj[[v]])
      rows[[length(rows) + 1L]] <- c(
        list(
          `_index`             = gi,
          `_parent_index`      = as.integer(parent_index[[i]]),
          `_parent_table_name` = as.character(parent_table_name %||% ""),
          `_submission__id`    = as.character(parent_ids[[i]])
        ),
        rowvals
      )
    }
  }
  out <- .kobo_rows_to_df(rows, data_cols)
  attr(out, "data_cols") <- data_cols
  out
}

# Vector de `_id` del padre, alineado con las filas de la data aplanada: `_id`
# (primaria, estable), fallback `_uuid`, fallback `meta/instanceID`, fallback
# índice de fila. Alimenta `_submission__id` de la base hija.
.kobo_parent_ids <- function(data) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  if (!n) return(character(0))
  pick <- function(col) {
    if (col %in% names(data)) {
      v <- as.character(data[[col]])
      v[is.na(v)] <- ""
      v
    } else {
      rep("", n)
    }
  }
  out <- pick("_id")
  for (col in c("_uuid", "meta/instanceID")) {
    need <- !nzchar(out)
    if (!any(need)) break
    out[need] <- pick(col)[need]
  }
  need <- !nzchar(out)
  out[need] <- as.character(seq_len(n))[need]
  out
}

# Garantiza que la base madre (ancha) lleve la columna `_index` = 1..N (índice de
# fila), llave primaria canónica que la base hija referencia por `_parent_index`
# (ADR 0030). `_id` de Kobo se preserva por separado (fallback de enlace). El
# índice se asigna en el MISMO orden de fila usado para expandir los repeats, así
# `_parent_index` de la hija casa con `_index` de la madre por construcción.
.kobo_ensure_wide_index <- function(data) {
  if (!is.data.frame(data)) return(data)
  if (!("_index" %in% names(data))) {
    data[["_index"]] <- seq_len(nrow(data))
  }
  data
}

# Quita del padre las columnas blob de todos los repeats (la base ancha no debe
# cargar un JSON basura; su contenido ya se expandió a la base hija).
.kobo_drop_repeat_blob_columns <- function(data, inst) {
  if (!is.data.frame(data)) return(data)
  specs <- .kobo_repeat_specs(inst)
  if (!length(specs)) return(data)
  drop <- character(0)
  for (spec in specs) {
    col <- .kobo_repeat_blob_column(data, spec$name)
    if (!is.null(col)) drop <- c(drop, col)
  }
  if (!length(drop)) return(data)
  data[, setdiff(names(data), drop), drop = FALSE]
}

# Modelo XLSForm hijo. Promueve las preguntas del repeat a top-level PERO las
# envuelve en un `begin_group`/`end_group` que conserva el `relevant` del
# `begin_repeat` original (ADR 0030 Fase 1: preservar el gate del grupo). Se usa
# begin_group (no begin_repeat) a propósito: NO altera `repeat_depth`, así las
# preguntas siguen siendo columnas esperadas de la base hija (begin_repeat las
# volvería a "esconder"). Se preservan `relevant`/`constraint`/`calculation`
# tal cual, incluidas referencias al PADRE y `jr:choice-name()`: NO se resuelven
# aquí (la resolución contra columnas del padre es de la Fase 2); sólo deben
# sobrevivir a la ingesta. Los labels con piping `${current_label}` se copian
# verbatim (no se resuelven).
#
# `extra_cols` = columnas de dato presentes en el blob que el survey no describe
# (keys inesperadas); se agregan como `text` para que el instrumento describa
# toda la data.
# choices = todas las del instrumento padre (inofensivo: sobran listas no usadas).
.kobo_build_repeat_instrument <- function(inst, repeat_spec, extra_cols = character()) {
  survey <- inst$survey
  idx <- repeat_spec$row_indices
  idx <- idx[!is.na(idx) & idx >= 1L & idx <= nrow(survey)]
  extra_cols <- unique(as.character(extra_cols %||% character()))
  if (!length(idx) && !length(extra_cols)) {
    stop_api(422, "E_KOBO_REPEAT_EMPTY",
             sprintf("El repeat '%s' no tiene preguntas para expandir a una base hija.",
                     repeat_spec$name))
  }

  col_or_blank <- function(col) {
    if (col %in% names(survey)) {
      v <- as.character(survey[[col]][idx])
      v[is.na(v)] <- ""
      v
    } else {
      rep("", length(idx))
    }
  }
  type_base <- .dn_survey_type_base(survey)[idx]
  appearance <- .dn_survey_appearance(survey)[idx]
  names_raw <- .dn_survey_names(survey)[idx]
  labels <- col_or_blank("label")
  relevant <- col_or_blank("relevant")
  constraint <- col_or_blank("constraint")
  calculation <- col_or_blank("calculation")
  list_names <- vapply(idx, function(i) {
    ln <- .dn_survey_list_name(survey[i, , drop = FALSE])
    if (is.na(ln)) "" else ln
  }, character(1))
  # Recomponer el tipo canónico ("select_one lst_x") para que reporte_instrumento
  # del hijo vuelva a resolver la lista de opciones.
  types <- type_base
  needs_list <- type_base %in% c("select_one", "select_multiple") & nzchar(list_names)
  types[needs_list] <- paste(type_base[needs_list], list_names[needs_list])

  # Columnas de dato del blob no descritas por el survey -> text.
  extra_cols <- setdiff(extra_cols[nzchar(extra_cols)], names_raw)
  extra_cols <- extra_cols[!startsWith(extra_cols, "_")]
  if (length(extra_cols)) {
    types <- c(types, rep("text", length(extra_cols)))
    names_raw <- c(names_raw, extra_cols)
    labels <- c(labels, extra_cols)
    appearance <- c(appearance, rep("", length(extra_cols)))
    relevant <- c(relevant, rep("", length(extra_cols)))
    constraint <- c(constraint, rep("", length(extra_cols)))
    calculation <- c(calculation, rep("", length(extra_cols)))
  }

  question_rows <- data.frame(
    type = types,
    name = names_raw,
    label = labels,
    appearance = appearance,
    relevant = relevant,
    constraint = constraint,
    calculation = calculation,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  # Gate del grupo: begin_group con el `relevant` del begin_repeat original.
  group_name <- repeat_spec$name
  group_relevant <- as.character(repeat_spec$group_relevant %||% "")
  marker_row <- function(kind) {
    data.frame(
      type = kind, name = group_name, label = group_name,
      appearance = "", relevant = if (identical(kind, "begin_group")) group_relevant else "",
      constraint = "", calculation = "",
      stringsAsFactors = FALSE, check.names = FALSE
    )
  }
  child_survey <- rbind(marker_row("begin_group"), question_rows, marker_row("end_group"))

  choices <- inst$choices %||% data.frame()
  title <- repeat_spec$name
  settings <- data.frame(
    form_title = title,
    form_id = .carga_slug(title, "kobo_repeat"),
    version = format(Sys.Date(), "%Y%m%d"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(survey = child_survey, choices = choices, settings = settings)
}

# Orquestador: por cada repeat con blob presente en la data aplanada, expande a
# long, escribe XLSForm + data hija, y registra la base hija en el estudio
# vinculada al padre por las llaves canónicas ODK/Kobo. Devuelve metadata de las
# bases creadas. `data_df` debe ser la data aplanada+alineada (con blobs y `_id`).
.carga_kobo_register_repeat_bases <- function(sid, data_df, rp_inst, parent_base_name,
                                              title, downloads_dir,
                                              choice_code_maps = NULL) {
  specs <- .kobo_repeat_specs(rp_inst)
  if (!length(specs)) return(list())
  if (!is.data.frame(data_df) || !nrow(data_df)) return(list())
  parent_ids <- .kobo_parent_ids(data_df)
  # `_parent_index` de la hija referencia `_index` de la madre. Si la base madre
  # ya trae `_index`, respetamos ESE valor (para que el enlace case incluso si el
  # orden difiere); si no, usamos la posición de fila (la madre recibirá el mismo
  # `_index` por .kobo_ensure_wide_index).
  parent_index <- if ("_index" %in% names(data_df)) {
    suppressWarnings(as.integer(data_df[["_index"]]))
  } else {
    seq_len(nrow(data_df))
  }
  created <- list()
  planned <- names(estudio_list_bases(sid))
  for (spec in specs) {
    if (!length(spec$leaf_vars)) next
    blob_col <- .kobo_repeat_blob_column(data_df, spec$name)
    if (is.null(blob_col)) next            # repeat anidado / sin columna: saltar
    long_df <- .kobo_expand_repeat(
      data_df, spec, blob_col,
      parent_index = parent_index,
      parent_ids = parent_ids,
      parent_table_name = parent_base_name
    )
    data_cols <- attr(long_df, "data_cols") %||% spec$leaf_vars

    child_model <- .kobo_build_repeat_instrument(rp_inst, spec, extra_cols = data_cols)
    slug <- .carga_slug(spec$name, "kobo_repeat")
    base_name <- .carga_unique_base_name(spec$name, planned, paste0("rep_", slug))
    planned <- c(planned, base_name)

    inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_repeat_xlsform.xlsx"))
    .carga_write_xlsform_model(child_model, inst_path)
    inst_meta <- save_upload(sid, "xlsform", paste0(slug, "_repeat_xlsform.xlsx"),
                             readBin(inst_path, "raw", n = file.info(inst_path)$size))
    child_inst <- reporte_instrumento(path = inst_meta$path)

    norm_df <- normalize_data_for_xlsform(long_df, child_inst, choice_code_maps = choice_code_maps)
    # Backfill benigno también en el hijo: el sub-instrumento y la data long
    # salen del mismo asset, así que un leaf sin ninguna respuesta = pregunta
    # vacía, no un mismatch.
    norm_df <- .carga_backfill_missing_expected(norm_df, child_inst)
    .carga_assert_data_xlsform_compatible(norm_df, child_inst)

    data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_repeat_data.xlsx"))
    .carga_write_xlsx_sheet(norm_df, data_path, "datos")
    data_meta <- save_upload(sid, "data", paste0(slug, "_repeat_data.xlsx"),
                             readBin(data_path, "raw", n = file.info(data_path)$size))

    child_rp_data <- reporte_data(norm_df, instrumento = child_inst)
    imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    estudio_add_base(
      sid,
      nombre          = base_name,
      xlsform_file_id = inst_meta$file_id,
      data_file_id    = data_meta$file_id,
      data_ext        = "xlsx",
      rp_data         = child_rp_data,
      rp_inst         = child_inst,
      n_filas         = as.integer(nrow(norm_df)),
      n_columnas      = as.integer(ncol(norm_df)),
      extra_meta      = list(
        source_kind       = "kobo_repeat",
        parent_base       = parent_base_name,
        repeat_group      = spec$name,
        repeat_relevant   = as.character(spec$group_relevant %||% ""),
        # Llaves canónicas ODK/Kobo (ADR 0030). El linker de validación prefiere
        # `_parent_index`↔`_index`; `_submission__id`↔`_id` es el fallback.
        link_key          = "_parent_index",
        link_key_fallback = "_submission__id",
        parent_index_key  = "_index",
        imported_at       = imported_at
      )
    )
    created[[length(created) + 1L]] <- list(
      base         = base_name,
      repeat_group = spec$name,
      parent_base  = parent_base_name,
      n_filas      = as.integer(nrow(norm_df)),
      n_columnas   = as.integer(ncol(norm_df)),
      link_key     = "_parent_index"
    )
  }
  created
}
