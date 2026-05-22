.analitica_fuentes <- function(sid) {
  s <- session_get(sid)
  tiene_adaptados <- isTRUE(s$codif_aplicado) &&
                     !is.null(s$codif_inst_adaptado_fid) &&
                     !is.null(s$codif_data_adaptada_fid)

  # UI v3: solo hay dos fuentes visibles. `auto` se conserva como legacy
  # y equivale a "codificada si existe; si no, original".
  pref <- as.character((s$analitica_config %||% list())$fuente_preferida %||% "adaptados")
  if (identical(pref, "auto")) pref <- "adaptados"
  if (!pref %in% c("originales", "adaptados")) pref <- "adaptados"

  usar_adaptados <- identical(pref, "adaptados") && tiene_adaptados

  if (usar_adaptados) {
    list(
      inst_path = get_file(sid, s$codif_inst_adaptado_fid)$path,
      data_meta = get_file(sid, s$codif_data_adaptada_fid),
      fuente = "adaptados"
    )
  } else {
    list(
      inst_path = .require_xlsform_path(sid)$path,
      data_meta = .require_data_path(sid),
      fuente = "originales"
    )
  }
}

.analitica_file_by_id <- function(s, file_id) {
  fid <- as.character(file_id %||% "")
  if (!nzchar(fid) || is.null(s$files[[fid]])) return(NULL)
  s$files[[fid]]
}

.analitica_last_file_by_kind <- function(s, kinds) {
  files <- s$files %||% list()
  hits <- Filter(function(f) as.character(f$kind %||% "") %in% kinds, files)
  if (!length(hits)) return(NULL)
  hits[[length(hits)]]
}

.analitica_file_kind <- function(meta) {
  as.character((meta %||% list())$kind %||% "")
}

.analitica_pair_is_adapted <- function(s, base_meta) {
  xls <- .analitica_file_by_id(s, base_meta$xlsform_file_id)
  dat <- .analitica_file_by_id(s, base_meta$data_file_id)
  identical(.analitica_file_kind(xls), "instrumento_adaptado") &&
    identical(.analitica_file_kind(dat), "data_adaptada")
}

.analitica_pair_for_base <- function(s, base_meta, fuente) {
  fuente <- as.character(fuente %||% "adaptados")
  if (identical(fuente, "originales")) {
    xls_id <- as.character(base_meta$original_xlsform_file_id %||% base_meta$xlsform_file_id %||% "")
    data_id <- as.character(base_meta$original_data_file_id %||% base_meta$data_file_id %||% "")
  } else {
    xls_id <- as.character(base_meta$xlsform_file_id %||% "")
    data_id <- as.character(base_meta$data_file_id %||% "")
  }
  xls <- .analitica_file_by_id(s, xls_id)
  dat <- .analitica_file_by_id(s, data_id)
  if (identical(fuente, "originales") &&
      (identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
       identical(.analitica_file_kind(dat), "data_adaptada"))) {
    xls <- .analitica_last_file_by_kind(s, "xlsform") %||% xls
    dat <- .analitica_last_file_by_kind(s, c("data", "sav")) %||% dat
  }
  if (is.null(xls) || is.null(dat)) return(NULL)
  list(xls = xls, data = dat)
}

.analitica_effective_source <- function(s, cfg) {
  pref <- as.character((cfg %||% list())$fuente_preferida %||% "adaptados")
  if (identical(pref, "auto")) pref <- "adaptados"
  if (!pref %in% c("originales", "adaptados")) pref <- "adaptados"
  if (identical(pref, "originales")) return("originales")

  bases <- (s$estudio %||% list())$bases %||% list()
  has_adapted <- if (length(bases) > 0L) {
    any(vapply(bases, function(b) .analitica_pair_is_adapted(s, b), logical(1)))
  } else {
    isTRUE(s$codif_aplicado) &&
      !is.null(s$codif_inst_adaptado_fid) &&
      !is.null(s$codif_data_adaptada_fid)
  }
  if (isTRUE(has_adapted)) "adaptados" else "originales"
}

.analitica_read_pair <- function(pair) {
  rp_inst <- reporte_instrumento(path = pair$xls$path)
  dat_raw <- switch(pair$data$ext,
    xlsx = readxl::read_excel(pair$data$path),
    xls  = readxl::read_excel(pair$data$path),
    csv  = utils::read.csv(pair$data$path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(pair$data$path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Ext no soportada: %s", pair$data$ext))
  )
  dat_raw <- normalize_data_for_xlsform(dat_raw, rp_inst)
  .carga_assert_data_xlsform_compatible(dat_raw, rp_inst)
  list(inst = rp_inst, data = reporte_data(dat_raw, instrumento = rp_inst))
}

.analitica_prepare_context <- function(sid, cfg) {
  s <- session_get(sid)
  fuente <- .analitica_effective_source(s, cfg)
  bases <- (s$estudio %||% list())$bases %||% list()

  if (length(bases) > 0L) {
    data_sources <- list()
    inst_sources <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente)
      if (is.null(pair) && identical(fuente, "adaptados")) {
        pair <- .analitica_pair_for_base(s, bases[[nombre]], "originales")
      }
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_SOURCE_MISSING",
          sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
      }
      parsed <- .analitica_read_pair(pair)
      data_sources[[nombre]] <- parsed$data
      inst_sources[[nombre]] <- parsed$inst
    }
    first <- names(data_sources)[1]
    return(list(
      fuente = fuente,
      rp_data = data_sources[[first]],
      rp_inst = inst_sources[[first]],
      data_sources = data_sources,
      inst_sources = inst_sources
    ))
  }

  src <- .analitica_fuentes(sid)
  parsed <- .analitica_read_pair(list(
    xls = list(path = src$inst_path),
    data = src$data_meta
  ))
  list(
    fuente = src$fuente,
    rp_data = parsed$data,
    rp_inst = parsed$inst,
    data_sources = list(default = parsed$data),
    inst_sources = list(default = parsed$inst)
  )
}

.secciones_desde_instrumento <- function(rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey) || !"name" %in% names(survey)) return(NULL)
  grupo <- if ("group_name" %in% names(survey)) {
    as.character(survey$group_name)
  } else if ("section" %in% names(survey)) {
    as.character(survey$section)
  } else {
    rep("general", nrow(survey))
  }
  grupo[is.na(grupo) | !nzchar(grupo)] <- "general"
  ok <- !is.na(survey$name) & nzchar(survey$name)
  tapply(survey$name[ok], grupo[ok], function(v) unique(v), simplify = FALSE) |>
    as.list()
}

# Walk survey$type en orden y construye secciones desde begin_group /
# end_group con etiqueta en español preferida (misma lógica que
# `.section_map` de router_codificacion.R pero devolviendo secciones
# en el shape que la UI consume: [{id, nombre, variables, orden}]).
# Preserva orden, soporta nesting (usamos el group más interno por var).
.detect_secciones_analitica <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())

  # Label preference: survey_raw's label::Spanish si existe.
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  # Walk para asignar cada variable al group más interno (stack approach).
  stack_name <- character(0)
  stack_label <- character(0)
  seccion_orden <- list()   # id -> {nombre, variables, orden}
  orden_counter <- 0L

  for (i in seq_len(nrow(sv))) {
    t <- as.character(sv$type[i] %||% "")
    nm <- as.character(sv$name[i] %||% "")
    lb <- label_raw[i]
    if (t == "begin_group" || t == "begin_repeat") {
      stack_name <- c(stack_name, nm)
      stack_label <- c(stack_label, if (nzchar(lb)) lb else nm)
    } else if (t == "end_group" || t == "end_repeat") {
      if (length(stack_name) > 0L) {
        stack_name <- stack_name[-length(stack_name)]
        stack_label <- stack_label[-length(stack_label)]
      }
    } else if (nzchar(nm)) {
      # Variable data: asignarla al group más interno actual (o "general"
      # si estamos en top-level).
      seccion_id <- if (length(stack_name) > 0L) stack_name[length(stack_name)] else "general"
      seccion_lb <- if (length(stack_label) > 0L) stack_label[length(stack_label)] else "General"
      if (is.null(seccion_orden[[seccion_id]])) {
        orden_counter <- orden_counter + 1L
        seccion_orden[[seccion_id]] <- list(
          nombre = seccion_lb,
          variables = character(0),
          orden = orden_counter - 1L  # 0-indexed para frontend
        )
      }
      seccion_orden[[seccion_id]]$variables <- c(
        seccion_orden[[seccion_id]]$variables, nm
      )
    }
  }

  # Convertir a lista de secciones ordenadas por `orden`.
  if (length(seccion_orden) == 0L) return(list())
  ids <- names(seccion_orden)
  ordenes <- vapply(seccion_orden, function(x) as.integer(x$orden), integer(1))
  ids <- ids[order(ordenes)]
  lapply(ids, function(id) {
    s <- seccion_orden[[id]]
    list(
      id = id,
      nombre = s$nombre,
      variables = as.list(unique(s$variables)),
      oculto = FALSE,
      orden = as.integer(s$orden)
    )
  })
}

# Lista de variables del instrumento para alimentar dropdowns de la UI.
# Filtra filas que no son data (begin_group, end_group, note).
.variables_desde_instrumento <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  tipos <- as.character(sv$type %||% "")
  base_tipos <- sub("\\s.*$", "", tipos)
  list_names <- trimws(sub("^\\S+\\s*", "", tipos))

  keep <- !is.na(sv$name) & nzchar(sv$name) &
          !base_tipos %in% c("begin_group","end_group","begin_repeat","end_repeat","note","calculate","start","end","deviceid","today")
  idx <- which(keep)
  lapply(idx, function(i) {
    es_categorica <- base_tipos[i] %in% c("select_one", "select_multiple")
    es_numerica <- base_tipos[i] %in% c("integer", "decimal")
    list(
      name = as.character(sv$name[i]),
      label = label_raw[i],
      tipo = base_tipos[i],
      list_name = list_names[i],
      categorica = es_categorica,
      numerica = es_numerica,
      analisis = es_categorica || es_numerica
    )
  })
}

.analitica_catalogo <- function(rp_inst) {
  vars <- .variables_desde_instrumento(rp_inst)
  if (length(vars) == 0L) {
    return(data.frame(
      name = character(0), tipo = character(0),
      categorica = logical(0), numerica = logical(0),
      stringsAsFactors = FALSE
    ))
  }
  data.frame(
    name = vapply(vars, function(v) as.character(v$name %||% ""), character(1)),
    tipo = vapply(vars, function(v) as.character(v$tipo %||% ""), character(1)),
    categorica = vapply(vars, function(v) isTRUE(v$categorica), logical(1)),
    numerica = vapply(vars, function(v) isTRUE(v$numerica), logical(1)),
    stringsAsFactors = FALSE
  )
}

.analitica_declared_numericas <- function(cfg, override_frecuencias = TRUE) {
  fc <- cfg$frecuencias %||% list()
  global <- .as_chr_vec(cfg$numericas)
  if (isTRUE(override_frecuencias) && "numericas_override" %in% names(fc)) {
    return(unique(.as_chr_vec(fc$numericas_override)))
  }
  unique(c(global, .as_chr_vec(fc$numericas_override)))
}

.analitica_allowed_vars <- function(rp_inst, numericas = character(0)) {
  cat <- .analitica_catalogo(rp_inst)
  if (nrow(cat) == 0L) return(character(0))
  numericas_ok <- intersect(.as_chr_vec(numericas), cat$name[cat$numerica])
  unique(c(cat$name[cat$categorica], numericas_ok))
}

.analitica_filter_sections <- function(secs, rp_inst, numericas = character(0), excluidas = character(0)) {
  allowed <- .analitica_allowed_vars(rp_inst, numericas)
  allowed <- setdiff(allowed, .as_chr_vec(excluidas))
  if (length(allowed) == 0L) return(NULL)
  if (is.null(secs) || !is.list(secs) || length(secs) == 0L) {
    secs <- .secciones_desde_instrumento(rp_inst)
  }
  if (is.null(secs) || !is.list(secs) || length(secs) == 0L) return(NULL)
  secs <- lapply(secs, function(v) intersect(as.character(v), allowed))
  secs <- secs[vapply(secs, length, integer(1)) > 0L]
  if (length(secs) == 0L) return(NULL)
  secs
}

.analitica_filter_data <- function(data, rp_inst, numericas = character(0), excluidas = character(0)) {
  allowed <- .analitica_allowed_vars(rp_inst, numericas)
  keep <- setdiff(intersect(names(data), allowed), .as_chr_vec(excluidas))
  out <- data[, keep, drop = FALSE]
  for (nm in setdiff(names(attributes(data)), c("names","row.names","class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.analitica_categoricas <- function(rp_inst) {
  cat <- .analitica_catalogo(rp_inst)
  if (nrow(cat) == 0L) return(character(0))
  cat$name[cat$categorica]
}

.load_rp_data <- function(sid) {
  s <- session_get(sid)
  if (!is.null(s$analitica_rp_data) && !is.null(s$analitica_rp_inst)) {
    return(list(rp_inst = s$analitica_rp_inst, rp_data = s$analitica_rp_data))
  }
  if (!is.null(s$rp_data) && !is.null(s$rp_inst)) {
    return(list(rp_inst = s$rp_inst, rp_data = s$rp_data))
  }
  stop_api(409, "E_ANALITICA_NO_PREP", "Primero corre el Paso 1 (Preparar datos para reporte).")
}

.load_rp_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  data_sources <- if (!is.null(s$analitica_rp_data_sources) && length(s$analitica_rp_data_sources) > 0L) {
    s$analitica_rp_data_sources
  } else {
    estudio_data_sources(sid)
  }
  inst_sources <- if (!is.null(s$analitica_rp_inst_sources) && length(s$analitica_rp_inst_sources) > 0L) {
    s$analitica_rp_inst_sources
  } else {
    estudio_inst_sources(sid)
  }
  if (length(data_sources) == 0L) {
    stop_api(409, "E_NO_RP_DATA",
      "El estudio no tiene base analítica preparada. Reingresa a Analítica para preparar la fuente activa.")
  }
  missing_inst <- setdiff(names(data_sources), names(inst_sources))
  if (length(missing_inst) > 0L) {
    stop_api(409, "E_NO_RP_INST",
      sprintf("Falta el XLSForm analítico para: %s.", paste(missing_inst, collapse = ", ")))
  }
  list(data_sources = data_sources, inst_sources = inst_sources[names(data_sources)])
}

.zip_files <- function(zip_path, files, names_in_zip = NULL) {
  names_in_zip <- names_in_zip %||% basename(files)
  old <- getwd()
  td <- tempfile()
  dir.create(td)
  on.exit({ setwd(old); unlink(td, recursive = TRUE) }, add = TRUE)
  for (i in seq_along(files)) file.copy(files[i], file.path(td, names_in_zip[i]))
  setwd(td)
  zip::zip(zip_path, files = names_in_zip)
  zip_path
}

# Lee la sub-configuración analitica_config de la sesión (store del
# frontend autosaveado). Devuelve un list vacío si aún no hay config.
.analitica_get_config <- function(sid) {
  s <- session_get(sid)
  cfg <- s$analitica_config
  if (is.null(cfg)) return(list())
  cfg
}

# Traduce las secciones del store (lista de {id, nombre, variables,
# oculto, orden}) a la forma que reporte_frecuencias/cruces
# espera: lista nombrada `list(Nombre1 = c("v1","v2"), ...)`.
# Respeta `oculto` y `secciones_activas` (si se pasa un filtro).
.secciones_from_config <- function(cfg, activas_filter = NULL) {
  secs <- cfg$secciones %||% list()
  if (length(secs) == 0L) return(NULL)
  out <- list()
  # Preservar orden según `orden` si está presente.
  ord <- vapply(secs, function(s) as.integer(s$orden %||% 0L), integer(1))
  secs <- secs[order(ord)]
  for (s in secs) {
    id <- as.character(s$id %||% "")
    if (!nzchar(id)) next
    if (isTRUE(s$oculto)) next
    if (!is.null(activas_filter) && length(activas_filter) > 0L &&
        !id %in% activas_filter) next
    nombre <- as.character(s$nombre %||% id)
    vars <- unlist(s$variables %||% list())
    vars <- as.character(vars)
    vars <- vars[!is.na(vars) & nzchar(vars)]
    if (length(vars) == 0L) next
    # En caso improbable de colisión de nombres, desambiguar con id.
    key <- nombre
    if (key %in% names(out)) key <- paste0(nombre, " (", id, ")")
    out[[key]] <- unique(vars)
  }
  if (length(out) == 0L) return(NULL)
  out
}

# Extrae un vector character de un list/vector JSON. Util para cruces_vars,
# cols_corte, codigos_solo_si_presentes, etc. — jsonlite devuelve list()
# para arrays vacíos y simplifyVector=FALSE mantiene list-of-string.
.as_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(character(0))
  out <- as.character(v)
  out[!is.na(out) & nzchar(out)]
}

.as_int_vec <- function(x) {
  if (is.null(x)) return(integer(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(integer(0))
  suppressWarnings(as.integer(v))
}

# Filtra columnas del data frame según lista de nombres a excluir.
# Preserva atributos de nivel top del data frame (importante para
# haven_labelled / reporte_data). Ignora silenciosamente nombres que
# no existen.
.excluir_cols <- function(data, excluidas) {
  if (length(excluidas) == 0L) return(data)
  drop <- intersect(as.character(excluidas), names(data))
  if (length(drop) == 0L) return(data)
  keep <- setdiff(names(data), drop)
  out <- data[, keep, drop = FALSE]
  # Preserva atributos top-level (instrumento_reporte, etc.)
  for (nm in setdiff(names(attributes(data)), c("names","row.names","class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.analitica_named_chr_map <- function(x) {
  if (is.null(x) || !is.list(x) || is.null(names(x))) return(list())
  out <- list()
  for (nm in names(x)) {
    if (is.na(nm) || !nzchar(nm)) next
    val <- as.character(x[[nm]] %||% "")
    if (!length(val) || is.na(val[1]) || !nzchar(trimws(val[1]))) next
    out[[nm]] <- enc2utf8(trimws(val[1]))
  }
  out
}

.analitica_datos_config <- function(cfg) {
  datos <- cfg$datos %||% list()
  list(
    variable_labels = .analitica_named_chr_map(datos$variable_labels),
    value_labels = if (is.list(datos$value_labels)) datos$value_labels else list()
  )
}

.analitica_label_map_from_attr <- function(col) {
  labs <- attr(col, "labels", exact = TRUE)
  if (is.null(labs) || !length(labs)) return(stats::setNames(character(0), character(0)))
  nms <- names(labs)
  vals <- as.character(unname(labs))
  if (is.null(nms)) return(stats::setNames(vals, vals))
  nms <- as.character(nms)
  vals_num <- suppressWarnings(as.numeric(vals))
  nms_num <- suppressWarnings(as.numeric(nms))
  if (all(!is.na(vals_num))) return(stats::setNames(nms, vals))
  if (all(!is.na(nms_num))) return(stats::setNames(vals, nms))
  stats::setNames(vals, nms)
}

.analitica_survey_row <- function(rp_inst, var) {
  sv <- rp_inst$survey
  if (is.null(sv) || !"name" %in% names(sv)) return(NA_integer_)
  which(as.character(sv$name) == as.character(var))[1]
}

.analitica_list_name_for_var <- function(rp_inst, var) {
  i <- .analitica_survey_row(rp_inst, var)
  if (is.na(i)) return("")
  sv <- rp_inst$survey
  ln <- if ("list_name" %in% names(sv)) as.character(sv$list_name[i] %||% "") else ""
  if (!nzchar(ln) && "type" %in% names(sv)) {
    type <- trimws(as.character(sv$type[i] %||% ""))
    if (grepl("^select_(one|multiple)\\b", type)) {
      ln <- sub("^select_(one|multiple)\\s+([^\\s]+).*$", "\\2", type)
      if (identical(ln, type)) ln <- ""
    }
  }
  ln
}

.analitica_apply_data_review <- function(rp_data, rp_inst, cfg) {
  datos <- .analitica_datos_config(cfg)
  data <- rp_data
  inst <- rp_inst

  for (var in names(datos$variable_labels)) {
    label <- datos$variable_labels[[var]]
    if (var %in% names(data)) attr(data[[var]], "label") <- label
    if (!is.null(inst$var_labels)) inst$var_labels[var] <- label
    i <- .analitica_survey_row(inst, var)
    if (!is.na(i) && "label" %in% names(inst$survey)) inst$survey$label[i] <- label
    if (!is.null(inst$survey_raw) && "name" %in% names(inst$survey_raw)) {
      raw_i <- which(as.character(inst$survey_raw$name) == as.character(var))[1]
      if (!is.na(raw_i)) {
        lab_cols <- grep("^label", tolower(names(inst$survey_raw)), value = TRUE)
        for (col in lab_cols) inst$survey_raw[[col]][raw_i] <- label
      }
    }
    if (!is.null(inst$orders_list) && !is.null(inst$orders_list[[var]])) {
      inst$orders_list[[var]]$label <- label
      inst$orders_list[[var]]$var_label <- label
    }
  }

  if (is.list(datos$value_labels) && length(datos$value_labels) > 0L) {
    for (var in names(datos$value_labels)) {
      overrides <- .analitica_named_chr_map(datos$value_labels[[var]])
      if (!length(overrides)) next

      if (var %in% names(data)) {
        current <- .analitica_label_map_from_attr(data[[var]])
        for (code in names(overrides)) current[code] <- overrides[[code]]
        attr(data[[var]], "labels") <- stats::setNames(as.character(current), names(current))
      }

      ln <- .analitica_list_name_for_var(inst, var)
      if (nzchar(ln)) {
        if (!is.null(inst$choices) && all(c("list_name", "name") %in% names(inst$choices))) {
          for (code in names(overrides)) {
            rows <- which(as.character(inst$choices$list_name) == ln & as.character(inst$choices$name) == code)
            if (length(rows) && "label" %in% names(inst$choices)) inst$choices$label[rows] <- overrides[[code]]
          }
        }
        if (!is.null(inst$choices_raw) && all(c("list_name", "name") %in% names(inst$choices_raw))) {
          label_cols <- grep("^label", tolower(names(inst$choices_raw)), value = TRUE)
          for (code in names(overrides)) {
            rows <- which(as.character(inst$choices_raw$list_name) == ln & as.character(inst$choices_raw$name) == code)
            for (col in label_cols) if (length(rows)) inst$choices_raw[[col]][rows] <- overrides[[code]]
          }
        }
        if (!is.null(inst$dicc_code_to_label) && !is.null(inst$dicc_code_to_label[[ln]])) {
          for (code in names(overrides)) inst$dicc_code_to_label[[ln]][code] <- overrides[[code]]
        }
        if (!is.null(inst$dicc_label_to_code) && !is.null(inst$dicc_code_to_label[[ln]])) {
          inst$dicc_label_to_code[[ln]] <- stats::setNames(
            names(inst$dicc_code_to_label[[ln]]),
            as.character(unname(inst$dicc_code_to_label[[ln]]))
          )
        }
      }

      if (!is.null(inst$orders_list) && !is.null(inst$orders_list[[var]])) {
        ord <- inst$orders_list[[var]]
        if (!is.null(ord$names) && !is.null(ord$labels)) {
          labels <- as.character(ord$labels)
          for (code in names(overrides)) {
            hit <- which(as.character(ord$names) == code)
            if (length(hit)) labels[hit] <- overrides[[code]]
          }
          inst$orders_list[[var]]$labels <- labels
        }
      }
    }
  }

  list(data = data, inst = inst)
}

.analitica_data_review_payload <- function(rp_data, rp_inst, cfg) {
  reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
  data <- reviewed$data
  inst <- reviewed$inst
  vars <- .variables_desde_instrumento(inst)
  by_name <- list()
  for (v in vars) by_name[[as.character(v$name %||% "")]] <- v

  secs <- .detect_secciones_analitica(inst)
  section_by_var <- list()
  for (sec in secs) {
    vars_sec <- .as_chr_vec(sec$variables)
    for (v in vars_sec) section_by_var[[v]] <- as.character(sec$nombre %||% "General")
  }

  cfg_excluidas <- .as_chr_vec(cfg$variables_excluidas)
  all_names <- unique(c(vapply(vars, function(v) as.character(v$name %||% ""), character(1)), names(data)))
  all_names <- all_names[nzchar(all_names)]
  lapply(all_names, function(nm) {
    col <- if (nm %in% names(data)) data[[nm]] else NULL
    vmeta <- by_name[[nm]] %||% list(name = nm, label = "", tipo = "", list_name = "")
    original_label <- if (!is.null(col)) attr(col, "label", exact = TRUE) %||% "" else ""
    if (!nzchar(as.character(original_label))) original_label <- as.character(vmeta$label %||% "")
    if (!nzchar(original_label)) original_label <- nm
    tipo_xlsform <- as.character(vmeta$tipo %||% "")
    is_select_one <- grepl("^select_one(\\s|$)", tipo_xlsform)
    is_select_multiple <- grepl("^select_multiple(\\s|$)", tipo_xlsform)
    map <- if ((is_select_one || is_select_multiple) && !is.null(col)) {
      .analitica_label_map_from_attr(col)
    } else {
      stats::setNames(character(0), character(0))
    }
    counts <- if ((is_select_one || is_select_multiple) && !is.null(col)) {
      vals <- as.character(col)
      vals <- vals[!is.na(vals) & nzchar(vals)]
      if (is_select_multiple) {
        vals <- unlist(strsplit(vals, "\\s+"), use.names = FALSE)
        vals <- vals[nzchar(vals)]
      }
      table(vals, useNA = "no")
    } else integer(0)
    codes <- if (is_select_one || is_select_multiple) unique(c(names(map), names(counts))) else character(0)
    opts <- lapply(codes, function(code) {
      count <- if (code %in% names(counts)) as.integer(counts[[code]]) else 0L
      label <- if (code %in% names(map)) as.character(map[[code]]) else ""
      list(
        code = as.character(code),
        label = label,
        count = count
      )
    })
    list(
      name = nm,
      tipo_xlsform = tipo_xlsform,
      seccion = as.character(section_by_var[[nm]] %||% "General"),
      included = !nm %in% cfg_excluidas,
      label_actual = as.character(attr(col, "label", exact = TRUE) %||% original_label),
      label_original = as.character(original_label),
      n_non_missing = if (!is.null(col)) as.integer(sum(!is.na(col) & nzchar(as.character(col)))) else 0L,
      n_missing = if (!is.null(col)) as.integer(sum(is.na(col) | !nzchar(as.character(col)))) else 0L,
      opciones = opts
    )
  })
}

.analitica_xlsform_sheet_df <- function(x, fallback_cols = character(0)) {
  if (is.null(x)) {
    if (length(fallback_cols) == 0L) return(data.frame())
    return(as.data.frame(stats::setNames(rep(list(character(0)), length(fallback_cols)), fallback_cols), stringsAsFactors = FALSE))
  }
  df <- as.data.frame(x, stringsAsFactors = FALSE)
  if (ncol(df) == 0L && length(fallback_cols) > 0L) {
    for (col in fallback_cols) df[[col]] <- character(0)
  }
  for (col in names(df)) {
    if (is.list(df[[col]])) {
      df[[col]] <- vapply(df[[col]], function(v) {
        if (is.null(v)) return("")
        if (length(v) == 1L) return(as.character(v))
        jsonlite::toJSON(v, auto_unbox = TRUE, null = "null")
      }, character(1))
    } else {
      df[[col]] <- as.character(df[[col]])
      df[[col]][is.na(df[[col]])] <- ""
    }
  }
  df
}

.analitica_survey_list_names <- function(survey) {
  if (is.null(survey) || nrow(survey) == 0L) return(character(0))
  out <- character(0)
  if ("list_name" %in% names(survey)) {
    out <- c(out, as.character(survey$list_name))
  }
  if ("type" %in% names(survey)) {
    type <- trimws(as.character(survey$type))
    hit <- grepl("^select_(one|multiple)\\s+", type)
    parsed <- sub("^select_(one|multiple)\\s+([^\\s]+).*$", "\\2", type[hit])
    out <- c(out, parsed[parsed != type[hit]])
  }
  unique(out[!is.na(out) & nzchar(out)])
}

.analitica_filter_xlsform_inst <- function(rp_inst, excluidas = character(0)) {
  excluidas <- .as_chr_vec(excluidas)
  if (length(excluidas) == 0L) return(rp_inst)
  inst <- rp_inst

  filter_survey <- function(df) {
    if (is.null(df) || !"name" %in% names(df)) return(df)
    df[!as.character(df$name) %in% excluidas, , drop = FALSE]
  }
  inst$survey <- filter_survey(inst$survey)
  inst$survey_raw <- filter_survey(inst$survey_raw)

  used_lists <- unique(c(
    .analitica_survey_list_names(inst$survey),
    .analitica_survey_list_names(inst$survey_raw)
  ))
  filter_choices <- function(df) {
    if (is.null(df) || !"list_name" %in% names(df)) return(df)
    if (length(used_lists) == 0L) return(df[0, , drop = FALSE])
    df[as.character(df$list_name) %in% used_lists, , drop = FALSE]
  }
  inst$choices <- filter_choices(inst$choices)
  inst$choices_raw <- filter_choices(inst$choices_raw)

  if (!is.null(inst$var_labels)) inst$var_labels <- inst$var_labels[setdiff(names(inst$var_labels), excluidas)]
  if (!is.null(inst$orders_list) && length(inst$orders_list) > 0L) {
    inst$orders_list <- inst$orders_list[setdiff(names(inst$orders_list), excluidas)]
  }
  inst
}

.analitica_write_final_xlsform <- function(rp_inst, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para exportar el XLSForm final.", call. = FALSE)
  }
  survey <- .analitica_xlsform_sheet_df(rp_inst$survey_raw %||% rp_inst$survey, c("type", "name", "label"))
  choices <- .analitica_xlsform_sheet_df(rp_inst$choices_raw %||% rp_inst$choices, c("list_name", "name", "label"))
  settings <- .analitica_xlsform_sheet_df(rp_inst$settings, c("form_title", "form_id"))

  wb <- openxlsx::createWorkbook(creator = "prosecnur")
  header_style <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
  text_style <- openxlsx::createStyle(numFmt = "@")
  sheets <- list(survey = survey, choices = choices, settings = settings)
  for (sheet in names(sheets)) {
    df <- sheets[[sheet]]
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df, withFilter = nrow(df) > 0L, headerStyle = header_style)
    if (ncol(df) > 0L) {
      openxlsx::addStyle(wb, sheet, text_style, rows = seq_len(max(1L, nrow(df) + 1L)), cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      openxlsx::freezePane(wb, sheet, firstRow = TRUE)
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
    }
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

# Lee `cruces_vars` de la config (schema v2 o v1 legacy) y devuelve
# una lista `list(name -> c(valores_excluidos))`. Para v1 las excluidas
# son siempre vacías.
.cruces_vars_parse <- function(raw) {
  if (is.null(raw) || length(raw) == 0L) return(list())
  out <- list()
  for (el in raw) {
    if (is.character(el)) {
      nm <- as.character(el)[1]
      if (nzchar(nm)) out[[nm]] <- character(0)
    } else if (is.list(el)) {
      nm <- as.character(el$name %||% "")
      if (!nzchar(nm)) next
      excl <- .as_chr_vec(el$excluidas)
      out[[nm]] <- excl
    }
  }
  out
}

# Aplica las exclusiones por variable de cruce (filtra filas). Nota: es
# un filtro GLOBAL — los casos con valor excluido en una variable no
# aparecerán en ninguna tabla. Esto se comunica al usuario desde la UI.
.excluir_cruce_rows <- function(data, cruces_map) {
  if (length(cruces_map) == 0L) return(data)
  keep <- rep(TRUE, nrow(data))
  for (nm in names(cruces_map)) {
    excl <- cruces_map[[nm]]
    if (length(excl) == 0L) next
    if (!nm %in% names(data)) next
    vals <- as.character(data[[nm]])
    keep <- keep & !(vals %in% excl)
  }
  if (all(keep)) return(data)
  data[keep, , drop = FALSE]
}

# Default de configuración (mirrors defaults del frontend store.ts).
# Se usa cuando el session store no tiene aún una config grabada.
.analitica_default_config <- function() {
	    list(
	      version = 3L,
	    fuente_preferida = "adaptados",
	    secciones = list(),
	    numericas = list(),
	    variables_excluidas = list(),
	    datos = list(
	      variable_labels = list(),
	      value_labels = list()
	    ),
	    codebook = list(
      codigos_solo_si_presentes = as.list(c(96L, 97L, 98L, 99L))
    ),
	    bases = list(
	      sav  = list(incluir_sps = FALSE),
	      csv  = list(valores = "etiquetas", separador = ",", multi_select = "dummy_01"),
	      xlsx = list(valores = "ambos", multi_select = "dummy_01"),
	      overrides = list()
	    ),
    frecuencias = list(
      secciones_activas = list(),
      orden = "original",
      mostrar_todo = FALSE,
      incluir_titulos = TRUE,
      incluir_secciones = TRUE
    ),
    cruces = list(
      cruces_vars = list(),
      modo = "estandar",
      show_sig = TRUE,
      alpha = 0.05,
      incluir_total = TRUE,
      incluir_titulos = TRUE,
      incluir_secciones = TRUE,
      brecha = list(filas = FALSE, cols = FALSE),
      semaforo = list(
        activo = FALSE,
        cortes = as.list(c(50L, 75L)),
        modo = "grupos",
        colores = list(rojo = "#F8D7DA", amarillo = "#FFF3CD", verde = "#D4EDDA")
      )
    ),
    enumeradores = list(
      col_enumerador = "Enumerator_name",
      cols_corte = list(),
      modalidades_esperadas = as.list(c("Presencial", "Telefónica")),
      mostrar_vacias = FALSE,
      titulo = "Producción de Enumeradores",
      min_encuestas = 0L,
      ordenar_por = "total",
      modalidad_reglas = list(),
      modalidad_default = "Presencial"
    ),
    dimensiones = .dimensiones_default_config()
  )
}

mount_analitica <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/config", wrap_endpoint(function(req, res) {
      # Devuelve la config persistida (o defaults). La UI la hidrata en su
      # store al montarse `AnaliticaPage` y escribe cambios vía autosave
      # contra POST /config.
      sid <- session_header(req)
      s <- session_get(sid)
      cfg <- s$analitica_config %||% .analitica_default_config()
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/analitica/config", wrap_endpoint(function(req, res, ...) {
      # Recibe la config completa desde el autosave del frontend. No
      # validamos schema aquí (el frontend ya lo garantiza); el backend
      # es un "kv store" para esta sub-clave.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "Body debe incluir 'config'.")
      s_prev <- session_get(sid)
      prev_fuente <- as.character((s_prev$analitica_config %||% list())$fuente_preferida %||% "")
      next_fuente <- as.character((cfg %||% list())$fuente_preferida %||% "")
      session_set(sid, "analitica_config", cfg)
      if (!identical(prev_fuente, next_fuente)) {
        session_set(sid, "analitica_prep_ok", FALSE)
        session_set(sid, "analitica_rp_inst", NULL)
        session_set(sid, "analitica_rp_data", NULL)
        session_set(sid, "analitica_rp_inst_sources", list())
        session_set(sid, "analitica_rp_data_sources", list())
      }
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/analitica/config/export", wrap_endpoint(function(req, res) {
      # Export del estado completo (config + flags de generación) para que
      # el analista pueda guardarlo a disco / compartirlo. Mismo patrón que
      # Fase 3 /api/codificacion/export-json.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        version = "analitica/1.0",
        exported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        config = s$analitica_config %||% .analitica_default_config()
      )
    })) |>
    plumber::pr_post("/api/analitica/detect-secciones", wrap_endpoint(function(req, res) {
      # Devuelve las secciones detectadas desde begin_group/end_group del
      # XLSForm ya preparado. Respeta orden del instrumento. Requiere
      # haber corrido /preparar antes.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      secciones <- .detect_secciones_analitica(ctx$rp_inst)
      list(ok = TRUE, secciones = secciones)
    })) |>
    plumber::pr_get("/api/analitica/variables", wrap_endpoint(function(req, res) {
      # Lista las variables del instrumento para alimentar dropdowns /
      # multiselects del frontend. Cada entry trae name + label + tipo +
      # list_name, filtrando filas estructurales (begin_group, note,
	      # calculate, etc.).
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      variables <- .variables_desde_instrumento(reviewed$inst)
	      numericas_decl <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)
      variables <- lapply(variables, function(v) {
        v$declarada_numerica <- isTRUE(v$numerica) && as.character(v$name %||% "") %in% numericas_decl
        v$analisis <- isTRUE(v$categorica) || isTRUE(v$declarada_numerica)
        v
	      })
	      list(ok = TRUE, variables = variables)
	    })) |>
	    plumber::pr_get("/api/analitica/data-review", wrap_endpoint(function(req, res) {
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      list(ok = TRUE, variables = .analitica_data_review_payload(ctx$rp_data, ctx$rp_inst, cfg))
	    })) |>
	    plumber::pr_get("/api/analitica/column-values", wrap_endpoint(function(req, res, name = NULL) {
      # Devuelve valores únicos de una columna del data preparado, con
      # sus labels si la columna es select_one/select_multiple (usa los
      # value_labels aplicados por reporte_data). Alimenta el query
      # builder de reglas en EnumeradoresPane.
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      ctx$rp_data <- reviewed$data
	      col <- as.character(name %||% "")
      if (!nzchar(col)) stop_api(400, "E_NO_COL", "Falta query param `name`.")
      if (!col %in% names(ctx$rp_data)) {
        stop_api(404, "E_COL_NOT_FOUND", sprintf("La columna '%s' no existe en la data.", col))
      }
      v <- ctx$rp_data[[col]]
      # Labels si es factor / haven_labelled.
      lbls <- NULL
      if (inherits(v, "haven_labelled")) {
        lab_attr <- attr(v, "labels")
        if (!is.null(lab_attr)) {
          lbls <- setNames(names(lab_attr), as.character(lab_attr))
        }
      } else if (is.factor(v)) {
        lbls <- setNames(levels(v), as.character(seq_along(levels(v))))
      }
      v_chr <- as.character(v)
      v_chr <- v_chr[!is.na(v_chr) & nzchar(v_chr)]
      uniq <- unique(v_chr)
      # Ordenar: numéricos si se puede, si no alfabético.
      num_sort <- suppressWarnings(as.numeric(uniq))
      uniq <- if (all(!is.na(num_sort))) uniq[order(num_sort)] else sort(uniq)
      # Cap: máximo 200 valores únicos (más allá no aporta para un picker).
      truncated <- length(uniq) > 200L
      if (truncated) uniq <- head(uniq, 200L)
      values <- lapply(uniq, function(x) {
        lab <- if (!is.null(lbls) && x %in% names(lbls)) as.character(lbls[[x]]) else ""
        Encoding(lab) <- "UTF-8"
        list(value = x, label = lab)
      })
      list(
        ok = TRUE, column = col, n_total = length(unique(v_chr)),
        truncated = truncated, values = values
      )
    })) |>
    plumber::pr_post("/api/analitica/config/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      v <- as.character(parsed$version %||% "")
      if (!startsWith(v, "analitica/")) {
        stop_api(400, "E_BAD_VERSION",
          sprintf("JSON no es de analítica (version='%s'). Se espera 'analitica/1.x'.", v))
      }
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "El JSON no trae 'config'.")
      session_set(sid, "analitica_config", cfg)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_post("/api/analitica/preparar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      ctx <- .analitica_prepare_context(sid, cfg)
      session_set(sid, "analitica_rp_inst", ctx$rp_inst)
      session_set(sid, "analitica_rp_data", ctx$rp_data)
      session_set(sid, "analitica_rp_inst_sources", ctx$inst_sources)
      session_set(sid, "analitica_rp_data_sources", ctx$data_sources)
      session_set(sid, "analitica_prep_ok", TRUE)
      session_set(sid, "analitica_fuente", ctx$fuente)
      list(
        ok = TRUE,
        fuente = ctx$fuente,
        n_filas = nrow(ctx$rp_data),
        n_columnas = ncol(ctx$rp_data)
      )
    })) |>
    plumber::pr_post("/api/analitica/codebook", wrap_endpoint(function(req, res) {
      # Codebook multi-base (v0.2+): itera sobre todas las bases del
      # estudio y genera un xlsx por cada una. Con 1 base → xlsx directo
      # como antes. Con N → zip con N archivos prefijados por nombre
      # de base (docentes__codebook.xlsx, ...).
      #
      # Config: `codigos_solo_si_presentes` y `variables_excluidas` son
      # globales al estudio (no varían por base, el QMD trabaja con la
      # misma política de codificación para todas).
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      cb_cfg <- cfg$codebook %||% list()
      codes <- .as_int_vec(cb_cfg$codigos_solo_si_presentes)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)
      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "codebook",
        ext           = "xlsx",
	        kind_single   = "codebook",
	        kind_multi    = "codebook_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          data_out <- .analitica_filter_data(reviewed$data, reviewed$inst, numericas_arg, excluidas)
	          reporte_codebook(
	            data = data_out,
            path_xlsx = out_path,
            codigos_solo_si_presentes = if (length(codes) > 0L) codes else NULL
          )
        }
      )
      xlsform_result <- run_report_multibase(
        sid           = sid,
        base_filename = "xlsform_final",
        ext           = "xlsx",
        kind_single   = "xlsform_final",
        kind_multi    = "xlsform_final_zip",
        fn = function(rp_data, rp_inst, out_path) {
          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
          final_inst <- .analitica_filter_xlsform_inst(reviewed$inst, excluidas)
          .analitica_write_final_xlsform(final_inst, out_path)
        }
      )
      session_set(sid, "analitica_codebook_ok", TRUE)
      result$xlsform <- xlsform_result
      result
    })) |>
    plumber::pr_post("/api/analitica/frecuencias", wrap_endpoint(function(req, res) {
      # Frecuencias multi-base (v0.2+): itera sobre todas las bases del
      # estudio. La config (secciones, orden, excluidas, numéricas,
      # codigos_solo_si_presentes) se aplica globalmente a TODAS las
      # bases. Las secciones provienen del config — si alguna variable
      # de la sección no existe en una base específica, el motor la
      # ignora en esa base (no rompe).
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      fc <- cfg$frecuencias %||% list()
      activas <- .as_chr_vec(fc$secciones_activas)
      secs_cfg <- .secciones_from_config(cfg, activas_filter = if (length(activas) > 0L) activas else NULL)

      orden <- as.character(fc$orden %||% "desc")
      if (!orden %in% c("desc","asc","original")) orden <- "desc"
      mostrar_todo <- isTRUE(fc$mostrar_todo)
      # Los títulos de variable/pregunta se conservan siempre. La opción UI
      # solo controla los separadores de sección.
      incluir_titulos <- TRUE
      incluir_secciones <- isTRUE(fc$incluir_secciones %||% TRUE)

      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = TRUE)

      codes_codebook <- .as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "frecuencias",
        ext           = "xlsx",
	        kind_single   = "frecuencias",
	        kind_multi    = "frecuencias_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          rp_data <- reviewed$data
	          rp_inst <- reviewed$inst
	          data_out <- .excluir_cols(rp_data, excluidas)
	          # Secciones: usa las del config si las hay; sino, detecta
          # automáticamente las del instrumento de ESTA base.
          secs <- secs_cfg
          if (is.null(secs)) secs <- .secciones_desde_instrumento(rp_inst)
          secs <- .analitica_filter_sections(secs, rp_inst, numericas_arg, excluidas)
          reporte_frecuencias(
            data = data_out, instrumento = rp_inst,
            secciones = secs,
            path_xlsx = out_path,
            orden = orden,
            mostrar_todo = mostrar_todo,
            incluir_titulos = incluir_titulos,
            incluir_secciones = incluir_secciones,
            codigos_solo_si_presentes = if (length(codes_codebook) > 0L) codes_codebook else NULL,
            numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL
          )
        }
      )
      session_set(sid, "analitica_frecuencias_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/cruces", wrap_endpoint(function(req, res, cruces = NULL, modo = "estandar") {
      # Cruces lee del config del store: cruces_vars, modo, show_sig, alpha,
      # incluir_total, brecha, semaforo. Mantiene backcompat con el antiguo
      # `cruces=` query param para tests manuales; si viene en query, tiene
      # prioridad sobre el config.
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed_ctx <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      ctx$rp_data <- reviewed_ctx$data
	      ctx$rp_inst <- reviewed_ctx$inst
	      cc <- cfg$cruces %||% list()

      # Resolver cruces_vars: query param > config. Schema v2 del config
      # es [{name, excluidas?}]; v1 era string[]. `.cruces_vars_parse`
      # acepta ambos y devuelve `list(name -> excluidas)`.
      cruces_map <- if (!is.null(cruces) && nzchar(as.character(cruces[[1]] %||% ""))) {
        raw_names <- if (length(cruces) == 1) as.character(cruces[[1]]) else as.character(cruces)
        setNames(replicate(length(raw_names), character(0), simplify = FALSE), raw_names)
      } else {
        .cruces_vars_parse(cc$cruces_vars)
      }
      cruces_val <- names(cruces_map)
      if (length(cruces_val) == 0L) {
        stop_api(400, "E_NO_CRUCES",
          "Agrega al menos una variable en Cruces antes de generar.")
      }

      modo_val <- as.character(modo %||% cc$modo %||% "estandar")
      if (!modo_val %in% c("estandar","dimensiones")) modo_val <- "estandar"

      secs <- .secciones_from_config(cfg)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)
      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)
	      secs <- .analitica_filter_sections(secs, ctx$rp_inst, numericas_arg, excluidas)

	      categoricas <- .analitica_categoricas(ctx$rp_inst)
	      cruces_val <- setdiff(intersect(cruces_val, categoricas), excluidas)
	      cruces_map <- cruces_map[names(cruces_map) %in% cruces_val]
      if (length(cruces_val) == 0L) {
        stop_api(400, "E_NO_CRUCES_ANALITICAS",
          "Agrega al menos una variable de selección única o múltiple para generar Cruces.")
      }

      show_sig <- isTRUE(cc$show_sig %||% TRUE)
      alpha <- suppressWarnings(as.numeric(cc$alpha %||% 0.05))
      if (!is.finite(alpha)) alpha <- 0.05
      incluir_total <- isTRUE(cc$incluir_total %||% TRUE)
      # Los títulos de variable/pregunta se conservan siempre. La opción UI
      # solo controla los separadores de sección.
      incluir_titulos <- TRUE
      incluir_secciones <- isTRUE(cc$incluir_secciones %||% TRUE)

      brecha <- cc$brecha %||% list()
      brecha_filas <- isTRUE(brecha$filas)
      brecha_cols <- isTRUE(brecha$cols)

      sem <- cc$semaforo %||% list()
      aplicar_sem <- isTRUE(sem$activo)
      sem_modo <- as.character(sem$modo %||% "grupos")
      if (!sem_modo %in% c("grupos","degradado_automatico","degradado_manual")) sem_modo <- "grupos"
      sem_cortes <- .as_int_vec(sem$cortes)
      if (length(sem_cortes) == 0L) sem_cortes <- c(50L, 75L)
      sem_colores <- sem$colores %||% list()

      # Multi-base (v0.2+): filtramos cada base por `cruces_map` (las
      # exclusiones de categorías aplican a todas) y serializamos la
      # lista nombrada al RDS. El worker itera por base y empaqueta
      # los N xlsx en un zip si hay más de una.
	      sources <- .load_rp_sources(sid)
	      data_sources <- sources$data_sources
	      inst_sources <- sources$inst_sources
	      for (nombre in names(data_sources)) {
	        reviewed <- .analitica_apply_data_review(data_sources[[nombre]], inst_sources[[nombre]], cfg)
	        data_sources[[nombre]] <- .excluir_cols(reviewed$data, excluidas)
	        inst_sources[[nombre]] <- reviewed$inst
	      }
	      data_sources_filt <- lapply(data_sources, function(df) .excluir_cruce_rows(df, cruces_map))

      rp_data_path <- job_save_rds(sid, "rp_data_sources", data_sources_filt)
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", inst_sources)
      # api_path para que el worker callr pueda load_all(prosecnurapp).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.cruces",
        func = function(rp_data_path, rp_inst_path, cruces_val, modo, secs, numericas_arg,
                        show_sig, alpha, incluir_total,
                        incluir_titulos, incluir_secciones,
                        brecha_filas, brecha_cols,
                        aplicar_sem, sem_modo, sem_cortes, sem_colores,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 2, message = "Cargando bases para cruces...")
          sem_colores_vec <- if (is.list(sem_colores) && length(sem_colores) > 0L) {
            unlist(lapply(c("rojo","amarillo","verde"), function(k) sem_colores[[k]]))
          } else NULL
          data_sources <- readRDS(rp_data_path)
          inst_sources <- readRDS(rp_inst_path)
          base_names <- names(data_sources)

          run_one <- function(nombre, out_path) {
            args <- list(
              data = data_sources[[nombre]],
              instrumento = inst_sources[[nombre]],
              SECCIONES = secs,
              cruces = cruces_val,
              modo = modo,
              path_xlsx = out_path,
              numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL,
              show_sig = show_sig,
              alpha = alpha,
              incluir_total = incluir_total,
              incluir_titulos = incluir_titulos,
              incluir_secciones = incluir_secciones,
              brecha_filas = brecha_filas,
              brecha_cols = brecha_cols,
              aplicar_semaforo = aplicar_sem,
              semaforo_modo = sem_modo,
              semaforo_cortes = sem_cortes
            )
            if (!is.null(sem_colores_vec) && length(sem_colores_vec) == 3L &&
                all(nchar(sem_colores_vec) > 0L)) {
              names(sem_colores_vec) <- c("rojo","amarillo","verde")
              args$semaforo_colores <- sem_colores_vec
            }
            do.call(reporte_cruces, args)
          }

          if (length(base_names) == 1L) {
            # Single-base: escribe directo al result_path (xlsx).
            report("workbook", current = 1, total = 1, percent = 25, message = "Generando tabla de cruces...")
            run_one(base_names[1], result_path)
            report("export", percent = 95, message = "Guardando Excel...")
            return(list(mode = "single", path = result_path))
          }

          # Multi-base: genera N xlsx en un stage dir y los zipea al
          # result_path (que debe terminar en .zip).
          stage <- file.path(dirname(result_path),
                             paste0("cruces_stage_", basename(tempfile(""))))
          dir.create(stage, recursive = TRUE, showWarnings = FALSE)
          on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
          per_base <- lapply(seq_along(base_names), function(idx) {
            nombre <- base_names[[idx]]
            report(
              "workbook",
              current = idx,
              total = length(base_names),
              percent = 10 + round(75 * (idx - 1) / max(1, length(base_names))),
              message = sprintf("Generando cruces de %s...", nombre)
            )
            fname <- sprintf("%s__cruces.xlsx", nombre)
            p <- file.path(stage, fname)
            run_one(nombre, p)
            list(nombre = nombre, path = p, filename = fname,
                 size = as.integer(file.info(p)$size))
          })
          old_wd <- setwd(stage)
          on.exit(setwd(old_wd), add = TRUE)
          report("zip", percent = 92, message = "Empaquetando archivos...")
          zip::zip(result_path, files = vapply(per_base, function(o) o$filename, character(1)))
          setwd(old_wd)
          list(mode = "multi", path = result_path, bases = per_base)
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          cruces_val = cruces_val,
          modo = modo_val,
          secs = secs,
          numericas_arg = numericas_arg,
          show_sig = show_sig,
          alpha = alpha,
          incluir_total = incluir_total,
          incluir_titulos = incluir_titulos,
          incluir_secciones = incluir_secciones,
          brecha_filas = brecha_filas,
          brecha_cols = brecha_cols,
          aplicar_sem = aplicar_sem,
          sem_modo = sem_modo,
          sem_cortes = sem_cortes,
          sem_colores = sem_colores,
          api_path = api_path
        ),
        result_filename = if (length(data_sources) > 1L) {
          .export_filename(sid, "cruces", "zip")
        } else {
          .export_filename(sid, "cruces", "xlsx")
        },
        on_complete = function(j) {
          session_set(j$sid, "analitica_cruces_ok", TRUE)
          if (identical(j$result_data$mode, "multi")) {
            zip_meta <- .register_output_file(j$sid, "cruces_zip", j$result_path)
            return(list(
              ok = TRUE,
              n_bases = length(j$result_data$bases),
              zip = list(file_id = zip_meta$file_id, filename = zip_meta$original_name,
                         size = zip_meta$size),
              bases = lapply(j$result_data$bases, function(o) list(
                nombre = o$nombre, filename = o$filename, size = o$size
              ))
            ))
          }
          meta <- .register_output_file(j$sid, "cruces", j$result_path)
          list(ok = TRUE, n_bases = 1L, file_id = meta$file_id,
               filename = meta$original_name, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.cruces")
    })) |>
    plumber::pr_get("/api/analitica/bases/metadata", wrap_endpoint(function(req, res) {
      # Devuelve la lista de variables con la inferencia de measure +
      # format.spss. La UI la muestra como tabla editable en BasesPane;
      # los overrides del usuario viven en `config$bases$overrides` y se
      # mergean client-side para display.
      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      overrides <- .bases_overrides_parse((cfg$bases %||% list())$overrides)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      variables <- .bases_metadata_preview(reviewed$data, reviewed$inst)
	      list(ok = TRUE, variables = variables, overrides = overrides)
	    })) |>
    plumber::pr_post("/api/analitica/bases/sav", wrap_endpoint(function(req, res, ...) {
      # Exporta .sav multi-base (v0.2+). Cada base produce su propio
      # datos.sav (+ niveles_medida.sps si incluir_sps=TRUE). Con 1 base
      # y sin sps, devuelve el .sav directo. Con N bases O con sps,
      # empaqueta todo en un zip.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      incluir_sps <- isTRUE(body$incluir_sps)
      overrides <- .bases_overrides_parse((cfg$bases %||% list())$overrides)

	      sources <- .load_rp_sources(sid)
	      ds <- sources$data_sources
	      is_ <- sources$inst_sources
	      if (length(ds) == 0L) stop_api(409, "E_NO_RP_DATA", "Estudio sin bases.")
	      excluidas <- .as_chr_vec(cfg$variables_excluidas)
	      for (nombre in names(ds)) {
	        reviewed <- .analitica_apply_data_review(ds[[nombre]], is_[[nombre]], cfg)
	        ds[[nombre]] <- .excluir_cols(reviewed$data, excluidas)
	        is_[[nombre]] <- reviewed$inst
	      }

      s <- session_get(sid)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)

      # Para single-base + sin sps: devuelve el .sav directo (legacy).
      if (length(ds) == 1L && !incluir_sps) {
        sav_name <- .export_filename(sid, "bases_sav", "sav")
        sav_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), sav_name))
        .bases_export_sav(ds[[1]], is_[[1]], sav_path, NULL, overrides = overrides)
        meta <- .register_output_file(sid, "bases_sav", sav_path, original_name = sav_name)
        session_set(sid, "analitica_bases_sav_ok", TRUE)
        return(list(ok = TRUE, n_bases = 1L, file_id = meta$file_id,
                    filename = meta$original_name, size = meta$size))
      }

      # Multi-base o con sps: zip.
      stage <- tempfile("bases_sav_stage_")
      dir.create(stage, recursive = TRUE)
      on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
      per_base <- list()
      files_in_zip <- character(0)
      for (nombre in names(ds)) {
        # Prefijo por base si hay más de una; sino, nombres "limpios".
        prefix <- if (length(ds) > 1L) paste0(nombre, "__") else ""
        sav_path <- file.path(stage, paste0(prefix, "datos.sav"))
        sps_path <- if (incluir_sps) file.path(stage, paste0(prefix, "niveles_medida.sps")) else NULL
        .bases_export_sav(ds[[nombre]], is_[[nombre]], sav_path, sps_path, overrides = overrides)
        files_in_zip <- c(files_in_zip, basename(sav_path))
        if (!is.null(sps_path)) files_in_zip <- c(files_in_zip, basename(sps_path))
        per_base[[length(per_base) + 1L]] <- list(
          nombre = nombre,
          sav = basename(sav_path),
          sps = if (!is.null(sps_path)) basename(sps_path) else NULL
        )
      }
      zip_name <- .export_filename(sid, "bases_sav_bundle", "zip")
      zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
      old_wd <- setwd(stage); on.exit(setwd(old_wd), add = TRUE)
      zip::zip(zip_path, files = files_in_zip)
      setwd(old_wd)
      meta <- .register_output_file(sid, "bases_sav_bundle", zip_path, original_name = zip_name)
      session_set(sid, "analitica_bases_sav_ok", TRUE)
      list(ok = TRUE, n_bases = length(ds),
           zip = list(file_id = meta$file_id, filename = meta$original_name,
                      size = meta$size),
           bases = per_base)
    })) |>
	    plumber::pr_post("/api/analitica/bases/csv", wrap_endpoint(function(req, res, ...) {
	      # CSV multi-base: un csv por base, zip si N > 1.
	      sid <- session_header(req)
	      cfg <- .analitica_get_config(sid)
	      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      valores <- as.character(body$valores %||% "etiquetas")
      if (!valores %in% c("codigos","etiquetas")) valores <- "etiquetas"
      separador <- as.character(body$separador %||% ",")
      if (!separador %in% c(",",";")) separador <- ","
      multi_select <- as.character(body$multi_select %||% "dummy_01")
      if (!multi_select %in% c("codigos_crudos","etiquetas_unidas","dummy_01")) multi_select <- "dummy_01"

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "datos",
        ext           = "csv",
	        kind_single   = "bases_csv",
	        kind_multi    = "bases_csv_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          rp_data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
	          rp_inst <- reviewed$inst
	          df <- rp_data
	          if (multi_select == "dummy_01") df <- .expand_multiselect(df, rp_inst)
          df <- .aplicar_etiquetas(df, rp_inst, valores = valores, multi_select = multi_select)
          .bases_write_csv(df, out_path, separador = separador)
        }
      )
      session_set(sid, "analitica_bases_csv_ok", TRUE)
      result
    })) |>
	    plumber::pr_post("/api/analitica/bases/xlsx", wrap_endpoint(function(req, res, ...) {
	      # XLSX multi-base: un xlsx por base, zip si N > 1.
	      sid <- session_header(req)
	      cfg <- .analitica_get_config(sid)
	      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else list()
      valores <- as.character(body$valores %||% "ambos")
      if (!valores %in% c("codigos","etiquetas","ambos")) valores <- "ambos"
      multi_select <- as.character(body$multi_select %||% "dummy_01")
      if (!multi_select %in% c("codigos_crudos","etiquetas_unidas","dummy_01")) multi_select <- "dummy_01"

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "datos",
        ext           = "xlsx",
	        kind_single   = "bases_xlsx",
	        kind_multi    = "bases_xlsx_zip",
	        fn = function(rp_data, rp_inst, out_path) {
	          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
	          rp_data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
	          rp_inst <- reviewed$inst
	          df_base <- rp_data
          if (multi_select == "dummy_01") df_base <- .expand_multiselect(df_base, rp_inst)
          df_cod <- .aplicar_etiquetas(df_base, rp_inst, valores = "codigos", multi_select = multi_select)
          df_lab <- if (valores == "codigos") df_cod
                    else .aplicar_etiquetas(df_base, rp_inst, valores = "etiquetas", multi_select = multi_select)
          .bases_write_xlsx(df_cod, df_lab, out_path, valores = valores)
        }
      )
      session_set(sid, "analitica_bases_xlsx_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/spss", wrap_endpoint(function(req, res) {
      # Alias de compatibilidad con el endpoint legacy. Mapea al nuevo
      # /bases/sav con incluir_sps=TRUE (comportamiento idéntico al viejo:
      # zip con .sav + niveles_medida.sps). Se mantiene una release para
      # no romper integraciones externas; el frontend nuevo ya no lo usa.
      sid <- session_header(req)
      s <- session_get(sid)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      overrides <- .bases_overrides_parse((cfg$bases %||% list())$overrides)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      reviewed$data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
	      td <- tempfile()
      dir.create(td)
      on.exit(unlink(td, recursive = TRUE), add = TRUE)
      sav_path <- file.path(td, "datos.sav")
      sps_path <- file.path(td, "niveles_medida.sps")
	      .bases_export_sav(reviewed$data, reviewed$inst, sav_path, sps_path, overrides = overrides)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      zip_name <- .export_filename(sid, "spss_bundle", "zip")
      zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
      old <- getwd(); on.exit({ setwd(old) }, add = TRUE)
      setwd(td)
      zip::zip(zip_path, files = c("datos.sav", "niveles_medida.sps"))
      meta <- .register_output_file(sid, "spss_bundle", zip_path, original_name = zip_name)
      session_set(sid, "analitica_spss_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/enumeradores", wrap_endpoint(function(req, res, col_enumerador = NULL) {
      # Enumeradores lee del config: col_enumerador, cols_corte,
      # col_modalidad, modalidades_esperadas, modalidad_reglas,
      # modalidad_default, titulo, min_encuestas, ordenar_por,
      # mostrar_vacias. Query param `col_enumerador` tiene prioridad
      # (backcompat).
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      ec <- cfg$enumeradores %||% list()

      col_en <- if (!is.null(col_enumerador) && nzchar(as.character(col_enumerador))) {
        as.character(col_enumerador)
      } else {
        as.character(ec$col_enumerador %||% "")
      }
      if (!nzchar(col_en)) {
        stop_api(400, "E_NO_COL_ENUM",
          "Configura la columna del enumerador en Diseñar → Enumeradores.")
      }

      cols_corte <- .as_chr_vec(ec$cols_corte)
      col_modalidad <- as.character(ec$col_modalidad %||% "")
      modalidades_esp <- .as_chr_vec(ec$modalidades_esperadas)
      mostrar_vacias <- isTRUE(ec$mostrar_vacias)
      titulo <- as.character(ec$titulo %||% "Producción de Enumeradores")
      min_enc <- suppressWarnings(as.integer(ec$min_encuestas %||% 0L))
      if (!is.finite(min_enc) || min_enc < 0) min_enc <- 0L
      ordenar_por <- as.character(ec$ordenar_por %||% "total")
      if (!ordenar_por %in% c("total","nombre")) ordenar_por <- "total"
      modalidad_default <- as.character(ec$modalidad_default %||% "Presencial")

      # modalidad_reglas en el store usa el schema nuevo:
      #   { id, condiciones: [{columna, operador, valor}], modalidad }
      # Con fallback al schema legacy {patron, modalidad} para configs
      # pre-rediseño. Compilamos una `modalidad_fn(data)` que evalúa las
      # reglas en orden; la primera que matchea gana. Si no hay reglas
      # útiles, el pipeline cae en `col_modalidad` o `modalidad_default`.
      reglas_list <- ec$modalidad_reglas %||% list()
      modalidad_fn <- NULL
      modalidad_reglas_df <- NULL
      if (length(reglas_list) > 0L) {
        # Normalizar: si vienen reglas con `patron` (legacy), converlas a
        # una condición equivalente contra `col_enumerador`.
        reglas_norm <- list()
        for (r in reglas_list) {
          modalidad <- as.character(r$modalidad %||% "")
          if (!nzchar(modalidad)) next
          conds <- r$condiciones %||% list()
          if (length(conds) == 0L && nzchar(as.character(r$patron %||% ""))) {
            conds <- list(list(columna = col_en, operador = "==", valor = as.character(r$patron)))
          }
          # Validar condiciones: columna y operador obligatorios.
          conds_validas <- list()
          for (c in conds) {
            col_cond <- as.character(c$columna %||% "")
            op <- as.character(c$operador %||% "==")
            if (!nzchar(col_cond)) next
            if (!op %in% c("==","!=","in","not_in")) next
            # `valor` puede ser string o lista (para in/not_in).
            val_raw <- c$valor
            val <- if (is.list(val_raw)) unlist(val_raw, use.names = FALSE) else val_raw
            val <- as.character(val %||% "")
            val <- val[!is.na(val) & nzchar(val)]
            if (length(val) == 0L) next
            conds_validas[[length(conds_validas) + 1L]] <- list(
              columna = col_cond, operador = op, valor = val
            )
          }
          if (length(conds_validas) == 0L) next
          reglas_norm[[length(reglas_norm) + 1L]] <- list(
            condiciones = conds_validas, modalidad = modalidad
          )
        }
        if (length(reglas_norm) > 0L) {
          # Cerramos sobre las reglas normalizadas para producir una fn
          # que toma data y devuelve un vector character de modalidades.
          modalidad_fn <- local({
            reglas <- reglas_norm
            function(data) {
              n <- nrow(data)
              out <- rep(NA_character_, n)
              for (regla in reglas) {
                match_vec <- rep(TRUE, n)
                for (cond in regla$condiciones) {
                  col <- data[[cond$columna]]
                  if (is.null(col)) { match_vec <- rep(FALSE, n); break }
                  col_chr <- as.character(col)
                  valor <- as.character(cond$valor)
                  match_vec <- match_vec & switch(cond$operador,
                    "==" = col_chr == valor[1],
                    "!=" = col_chr != valor[1],
                    "in" = col_chr %in% valor,
                    "not_in" = !(col_chr %in% valor),
                    rep(FALSE, n)
                  )
                  if (!any(match_vec)) break
                }
                hit <- which(match_vec & is.na(out))
                if (length(hit)) out[hit] <- regla$modalidad
              }
              out
            }
          })
        }
      }

      # Multi-base (v0.2+): por cada base corre reporte_enumeradores y
      # produce un PDF. Las bases donde la columna `col_en` no existe
      # se omiten (con warning en la respuesta). Con 1 sola base:
      # result_path es un .pdf; con N: un .zip con N pdfs.
      data_sources <- .load_rp_sources(sid)$data_sources
      rp_data_path <- job_save_rds(sid, "rp_data_sources", data_sources)
      api_path <- .app_api_dir()
      multi <- length(data_sources) > 1L

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.enumeradores",
        func = function(rp_data_path, col_en, cols_corte, col_modalidad,
                        modalidades_esp, mostrar_vacias, titulo, min_enc,
                        ordenar_por, modalidad_default, modalidad_fn,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          }
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 2, message = "Cargando bases de enumeradores...")
          data_sources <- readRDS(rp_data_path)
          base_names <- names(data_sources)

          run_one <- function(rp_data, out_pdf) {
            args <- list(
              data = rp_data,
              col_enumerador = col_en,
              output_file = out_pdf,
              titulo = titulo,
              min_encuestas = as.integer(min_enc),
              ordenar_por = ordenar_por,
              modalidad_default = modalidad_default,
              mostrar_modalidades_vacias = mostrar_vacias,
              quiet = TRUE
            )
            if (length(cols_corte) > 0L) args$cols_corte <- cols_corte
            if (nzchar(col_modalidad)) args$col_modalidad <- col_modalidad
            if (length(modalidades_esp) > 0L) args$modalidades_esperadas <- modalidades_esp
            if (!is.null(modalidad_fn)) args$modalidad_fn <- modalidad_fn
            do.call(reporte_enumeradores, args)
          }

          if (length(base_names) == 1L) {
            report("pdf", current = 1, total = 1, percent = 30, message = "Generando PDF de enumeradores...")
            run_one(data_sources[[1]], result_path)
            report("export", percent = 95, message = "Guardando PDF...")
            return(list(mode = "single", path = result_path))
          }

          stage <- file.path(dirname(result_path),
                             paste0("enum_stage_", basename(tempfile(""))))
          dir.create(stage, recursive = TRUE, showWarnings = FALSE)
          on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
          per_base <- list()
          for (idx in seq_along(base_names)) {
            nombre <- base_names[[idx]]
            report(
              "pdf",
              current = idx,
              total = length(base_names),
              percent = 10 + round(75 * (idx - 1) / max(1, length(base_names))),
              message = sprintf("Generando enumeradores de %s...", nombre)
            )
            rp_data <- data_sources[[nombre]]
            # Skip si la columna de enumerador no existe en esta base.
            if (!col_en %in% names(rp_data)) {
              per_base[[length(per_base) + 1L]] <- list(
                nombre = nombre, skipped = TRUE,
                reason = sprintf("columna '%s' no existe en esta base", col_en)
              )
              next
            }
            fname <- sprintf("%s__enumeradores.pdf", nombre)
            p <- file.path(stage, fname)
            run_one(rp_data, p)
            per_base[[length(per_base) + 1L]] <- list(
              nombre = nombre, path = p, filename = fname,
              size = as.integer(file.info(p)$size), skipped = FALSE
            )
          }
          ok_pdfs <- Filter(function(o) !isTRUE(o$skipped), per_base)
          if (length(ok_pdfs) == 0L) {
            stop(sprintf("Ninguna base tiene la columna '%s'; no hay PDFs para generar.", col_en))
          }
          old_wd <- setwd(stage)
          on.exit(setwd(old_wd), add = TRUE)
          report("zip", percent = 92, message = "Empaquetando PDFs...")
          zip::zip(result_path, files = vapply(ok_pdfs, function(o) o$filename, character(1)))
          setwd(old_wd)
          list(mode = "multi", path = result_path, bases = per_base)
        },
        args = list(
          rp_data_path = rp_data_path,
          col_en = col_en,
          cols_corte = cols_corte,
          col_modalidad = col_modalidad,
          modalidades_esp = modalidades_esp,
          mostrar_vacias = mostrar_vacias,
          titulo = titulo,
          min_enc = min_enc,
          ordenar_por = ordenar_por,
          modalidad_default = modalidad_default,
          modalidad_fn = modalidad_fn,
          api_path = api_path
        ),
        result_filename = if (multi) {
          .export_filename(sid, "enumeradores", "zip")
        } else {
          .export_filename(sid, "enumeradores", "pdf")
        },
        on_complete = function(j) {
          session_set(j$sid, "analitica_enumeradores_ok", TRUE)
          if (identical(j$result_data$mode, "multi")) {
            zip_meta <- .register_output_file(j$sid, "enumeradores_zip", j$result_path)
            return(list(
              ok = TRUE,
              n_bases = length(Filter(function(o) !isTRUE(o$skipped), j$result_data$bases)),
              zip = list(file_id = zip_meta$file_id, filename = zip_meta$original_name,
                         size = zip_meta$size),
              bases = j$result_data$bases
            ))
          }
          meta <- .register_output_file(j$sid, "enumeradores", j$result_path)
          list(ok = TRUE, n_bases = 1L, file_id = meta$file_id,
               filename = meta$original_name, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.enumeradores")
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/detect", wrap_endpoint(function(req, res) {
      # Escanea el instrumento para identificar variables select_one con
      # list_name en las "listas objetivo" (escalas tipo satisfacción /
      # acuerdo / si-no), y revisa si la base ya contiene columnas
      # `r100_*`, `sub_*` o `idx_*` (señal de que el proyecto pasó por una
      # construcción previa de dimensiones). La UI usa este endpoint para
      # decidir si arranca con "base detectada" o con "construir manual".
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      dim_cfg <- cfg$dimensiones %||% .dimensiones_default_config()
      escalas <- .dimensiones_detectar_escalas(ctx$rp_inst, dim_cfg$listas_objetivo)
      base <- .dimensiones_detectar_base_existente(ctx$rp_data)
      list(
        ok = TRUE,
        escalas = unname(escalas),
        base_dimensionada = base,
        listas_objetivo_disponibles = as.list(.dimensiones_listas_objetivo_default())
      )
    })) |>
    plumber::pr_post("/api/analitica/dimensiones/build", wrap_endpoint(function(req, res) {
      # Aplica la pipeline completa: recodifica → subcriterios → sub-índices
      # → índices → genera config (etiquetas + semáforo). Persiste la base
      # enriquecida en `s$rp_dim` y la config en `s$rp_dim_config`. Marca el
      # flag `analitica_dim_ok` para que río abajo (Cruces, Gráficos,
      # Tablero) pueda condicionar UI sin re-ejecutar.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      dim_cfg <- cfg$dimensiones %||% .dimensiones_default_config()
      out <- .dimensiones_construir(ctx$rp_data, ctx$rp_inst, dim_cfg)
      session_set(sid, "rp_dim", out$data_dim)
      session_set(sid, "rp_dim_config", out$dim_cfg)
      session_set(sid, "analitica_dim_ok", TRUE)
      list(
        ok = TRUE,
        n_filas = out$n_filas,
        n_r100 = length(out$vars_r100),
        n_sub = length(out$vars_sub),
        n_idx = length(out$vars_idx),
        vars_idx = as.list(out$vars_idx),
        vars_sub = as.list(out$vars_sub)
      )
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/preview", wrap_endpoint(function(req, res) {
      # Devuelve primeras N filas + stats de cobertura por columna
      # `idx_*` / `sub_*`. Requiere haber corrido /build antes.
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$rp_dim) || !isTRUE(s$analitica_dim_ok)) {
        stop_api(409, "E_NO_DIM",
          "Aún no se han construido dimensiones. Pulsa 'Generar dimensiones' primero.")
      }
      out <- .dimensiones_preview(s$rp_dim, max_rows = 10L)
      list(ok = TRUE, preview = out)
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/status", wrap_endpoint(function(req, res) {
      # Estado liviano para que la UI sepa si hay dimensiones construidas
      # sin tener que pedir el preview. Útil al montar el pane.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        built = isTRUE(s$analitica_dim_ok),
        n_filas = if (!is.null(s$rp_dim)) nrow(s$rp_dim) else 0L,
        n_idx = if (!is.null(s$rp_dim)) length(grep("^idx_", names(s$rp_dim))) else 0L,
        n_sub = if (!is.null(s$rp_dim)) length(grep("^sub_", names(s$rp_dim))) else 0L
      )
    })) |>
    plumber::pr_get("/api/analitica/dimensiones/sugerir", wrap_endpoint(function(req, res) {
      # Step 3 del wizard: arranca un set inicial de bloques desde los
      # begin_group/end_group del XLSForm. El analista refina con drag-drop
      # encima de la sugerencia.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      dim_cfg <- cfg$dimensiones %||% .dimensiones_default_config()
      bloques <- .dimensiones_sugerir_bloques(ctx$rp_inst, dim_cfg$listas_objetivo)
      list(ok = TRUE, bloques = bloques)
    })) |>
    plumber::pr_post("/api/analitica/dimensiones/validar-json", wrap_endpoint(function(req, res, ...) {
      # Step 1 del wizard ("Confirmar contra instrumento"): recibe el JSON
      # subido por el usuario y devuelve un reporte de coincidencias /
      # faltantes contra el rp_inst del proyecto activo. La UI usa este
      # reporte para mostrar ✓/⚠/✗ y dejar al analista decidir si continúa.
      #
      # Importante: la firma incluye `...` para absorber los args nombrados
      # que plumber intenta bindear desde las top-level keys del JSON
      # (`version`, `exported_at`, `_nota`, `config`, …). Sin `...` falla
      # con "unused arguments".
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      reporte <- .dimensiones_validar_contra_instrumento(parsed, ctx$rp_inst)
      list(ok = TRUE, reporte = reporte)
    }))
}
