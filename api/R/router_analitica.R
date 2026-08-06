.analitica_fuentes <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  tiene_adaptados <- isTRUE(s$codif_aplicado) &&
                     !is.null(s$codif_inst_adaptado_fid) &&
                     !is.null(s$codif_data_adaptada_fid)

  # UI v3: solo hay dos fuentes visibles. `auto` se conserva como legacy
  # y equivale a "codificada si existe; si no, original".
  cfg <- cfg %||% s$analitica_config %||% list()
  pref <- as.character((cfg %||% list())$fuente_preferida %||% "adaptados")
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

.analitica_original_member_id <- function(s, current_id, original_id, adapted_kind) {
  current_id <- as.character(current_id %||% "")
  original_id <- as.character(original_id %||% "")
  current <- .analitica_file_by_id(s, current_id)

  # "Original" representa la fuente vigente antes de codificar, no cualquier
  # respaldo historico. Un reemplazo SAV sigue siendo original mientras su
  # archivo actual no sea el artefacto adaptado de Codificacion.
  if (!is.null(current) && !identical(.analitica_file_kind(current), adapted_kind)) {
    return(current_id)
  }
  if (nzchar(original_id)) original_id else current_id
}

.analitica_pair_is_adapted <- function(s, base_meta) {
  xls <- .analitica_file_by_id(s, base_meta$xlsform_file_id)
  dat <- .analitica_file_by_id(s, base_meta$data_file_id)
  identical(.analitica_file_kind(xls), "instrumento_adaptado") &&
    identical(.analitica_file_kind(dat), "data_adaptada")
}

.analitica_global_adapted_pair <- function(s) {
  # Antes exigíamos `s$codif_aplicado` (flag global "todas las bases aplicadas").
  # Con la fuente POR BASE ese flag queda FALSE mientras falte codificar una
  # tabla, y bloqueaba el par adaptado global aunque los fids apunten a
  # artefactos adaptados válidos. La evidencia real es el kind de los archivos
  # (se valida abajo), no el flag de completitud: no gatear por él evita que una
  # base pendiente congele el par adaptado de la base activa.
  xls <- .analitica_file_by_id(s, s$codif_inst_adaptado_fid)
  dat <- .analitica_file_by_id(s, s$codif_data_adaptada_fid)
  if (is.null(xls) || is.null(dat)) return(NULL)
  if (!identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
      !identical(.analitica_file_kind(dat), "data_adaptada")) {
    return(NULL)
  }
  list(xls = xls, data = dat)
}

.analitica_all_bases_adapted <- function(s, bases = NULL) {
  bases <- bases %||% ((s$estudio %||% list())$bases %||% list())
  if (!length(bases)) return(!is.null(.analitica_global_adapted_pair(s)))
  if (length(bases) == 1L) {
    base_name <- names(bases)[1]
    return(
      isTRUE(.analitica_pair_is_adapted(s, bases[[1]])) ||
        (!is.null(.analitica_global_adapted_pair(s)) &&
           .analitica_base_can_use_global_adapted(s, base_name))
    )
  }
  all(vapply(bases, function(base_meta) {
    .analitica_pair_is_adapted(s, base_meta)
  }, logical(1)))
}

.analitica_base_can_use_global_adapted <- function(s, base_name = NULL) {
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (length(bases) <= 1L) return(TRUE)
  if (identical(as.character((s$estudio %||% list())$processing_mode %||% ""), "independent_siblings")) {
    return(FALSE)
  }
  active <- as.character(s$codif_source_active %||% "")
  if (!nzchar(active)) active <- bases[1]
  !is.null(base_name) && nzchar(base_name) && identical(base_name, active)
}

# ¿ESTA base debe leerse de su par adaptado? Regla POR BASE: usa adaptada si
# tiene par adaptado PROPIO (kind del meta de la base). El par adaptado global
# (`codif_inst_adaptado_fid`) solo es atribuible sin ambigüedad a una base cuando
# el estudio tiene una sola tabla (single-base / legacy: codif fija fids globales
# sin actualizar el meta por base). En multibase, una base sin par adaptado
# propio usa SU original: nunca hereda el par adaptado de OTRA tabla (evita que,
# tras codificar la hija, la madre pendiente muestre el instrumento de la hija
# solo porque `codif_source_active` revirtió a la base default).
.analitica_base_prefers_adapted <- function(s, base_meta, base_name = NULL) {
  if (isTRUE(.analitica_pair_is_adapted(s, base_meta))) return(TRUE)
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (length(bases) > 1L) return(FALSE)
  !is.null(.analitica_global_adapted_pair(s))
}

# ¿EXISTE al menos un par adaptado que el estudio pueda mostrar? Espejo relajado
# de `.analitica_all_bases_adapted`: la fuente ya no es única por corrida, así
# que basta con que UNA base prefiera adaptados para que el estudio los prefiera.
# La resolución fina —adaptada u original— la hace `.analitica_pair_for_base` por
# base.
.analitica_any_base_adapted <- function(s, bases = NULL) {
  bases <- bases %||% ((s$estudio %||% list())$bases %||% list())
  if (!length(bases)) return(!is.null(.analitica_global_adapted_pair(s)))
  base_names <- names(bases)
  any(vapply(seq_along(bases), function(i) {
    .analitica_base_prefers_adapted(s, bases[[i]], base_names[i])
  }, logical(1)))
}

.analitica_pair_for_base <- function(s, base_meta, fuente, base_name = NULL) {
  fuente <- as.character(fuente %||% "adaptados")
  # Fuente POR BASE (ADR 0030 + relajación del invariante de fuente única). Si el
  # estudio prefiere adaptados pero ESTA base no tiene par adaptado propio ni
  # puede tomar el par adaptado global de su base activa, se degrada a original
  # SOLO para ella. Así una madre codificada convive con una hija repeat original
  # (o al revés) en la misma corrida, sin colapsar todo el estudio a una fuente.
  # `fuente_preferida = "originales"` explícito no entra aquí: fuerza original en
  # todas las bases.
  if (!identical(fuente, "originales") &&
      !isTRUE(.analitica_base_prefers_adapted(s, base_meta, base_name))) {
    fuente <- "originales"
  }
  if (identical(fuente, "originales")) {
    xls_id <- .analitica_original_member_id(
      s,
      base_meta$xlsform_file_id,
      base_meta$original_xlsform_file_id,
      "instrumento_adaptado"
    )
    filtered_id <- if (isTRUE((base_meta$universe_filter %||% list())$enabled)) {
      as.character((base_meta$universe_filter %||% list())$effective_data_file_id %||% "")
    } else ""
    data_id <- if (nzchar(filtered_id)) filtered_id else
      .analitica_original_member_id(
        s,
        base_meta$data_file_id,
        base_meta$original_data_file_id,
        "data_adaptada"
      )
  } else {
    xls_id <- as.character(base_meta$xlsform_file_id %||% "")
    data_id <- as.character(base_meta$data_file_id %||% "")
  }
  xls <- .analitica_file_by_id(s, xls_id)
  dat <- .analitica_file_by_id(s, data_id)
  if (!identical(fuente, "originales") &&
      (!identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
       !identical(.analitica_file_kind(dat), "data_adaptada")) &&
      .analitica_base_can_use_global_adapted(s, base_name)) {
    pair_global <- .analitica_global_adapted_pair(s)
    if (!is.null(pair_global)) return(pair_global)
  }
  if (identical(fuente, "originales") &&
      (identical(.analitica_file_kind(xls), "instrumento_adaptado") ||
       identical(.analitica_file_kind(dat), "data_adaptada"))) {
    # En multibase no existe un "último original" global seguro: podría
    # pertenecer a otra tabla. Sin IDs originales scopeados, fallar es preferible
    # a entregar una mezcla o enlazar el instrumento equivocado.
    if (length(((s$estudio %||% list())$bases %||% list())) > 1L) return(NULL)
    xls <- .analitica_last_file_by_kind(s, "xlsform") %||% xls
    dat <- .analitica_last_file_by_kind(s, c("data", "sav")) %||% dat
  }
  if (is.null(xls) || is.null(dat)) return(NULL)
  list(xls = xls, data = dat)
}

.analitica_effective_source <- function(s, cfg, bases = NULL) {
  pref <- as.character((cfg %||% list())$fuente_preferida %||% "adaptados")
  if (identical(pref, "auto")) pref <- "adaptados"
  if (!pref %in% c("originales", "adaptados")) pref <- "adaptados"
  if (identical(pref, "originales")) return("originales")

  bases <- bases %||% ((s$estudio %||% list())$bases %||% list())
  # Fuente POR BASE (relaja el invariante histórico "fuente única por corrida").
  # Antes se exigía que TODAS las bases tuvieran par adaptado; si faltaba una, el
  # estudio ENTERO caía a originales y no se veía ninguna recodificación en un
  # madre+repeat salvo codificar ambas. Ahora el estudio prefiere adaptados en
  # cuanto EXISTE al menos un par adaptado, y cada base resuelve su propia fuente
  # en `.analitica_pair_for_base` (adaptada si tiene par adaptado, original si
  # no). El candado de mezcla se conserva por base: la hija repeat sin codificar
  # usa su original para sus columnas nativas, pero HEREDA la caracterización de
  # la madre en la fuente de la MADRE (adaptada si la madre está codificada).
  # `fuente_preferida = "originales"` explícito sigue forzando original en todas.
  has_adapted <- .analitica_any_base_adapted(s, bases)
  if (isTRUE(has_adapted)) "adaptados" else "originales"
}

.analitica_cfg_with_effective_source <- function(sid, cfg) {
  out <- cfg %||% list()
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  bases <- .analitica_scope_bases(sid, bases)
  out$fuente_preferida <- .analitica_effective_source(s, out, bases)
  out
}

.analitica_non_data_types <- c(
  "begin_group", "end_group", "begin_repeat", "end_repeat",
  "note", "calculate", "start", "end", "today", "deviceid",
  "subscriberid", "phonenumber", "simserial", "username", "audit"
)

.analitica_type_base <- function(type) {
  out <- trimws(sub("\\s+.*$", "", as.character(type %||% "")))
  out[is.na(out)] <- ""
  out
}

.analitica_data_names_for_inst <- function(rp_inst) {
  sv <- rp_inst$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !"name" %in% names(sv)) return(character(0))
  names0 <- as.character(sv$name)
  names0[is.na(names0)] <- ""
  if ("type" %in% names(sv)) {
    types <- .analitica_type_base(sv$type)
    keep <- !(types %in% .analitica_non_data_types)
  } else {
    keep <- rep(TRUE, length(names0))
  }
  unique(names0[keep & nzchar(names0)])
}

.analitica_structural_names_for_inst <- function(rp_inst) {
  sv <- rp_inst$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !all(c("name", "type") %in% names(sv))) return(character(0))
  names0 <- as.character(sv$name)
  names0[is.na(names0)] <- ""
  types <- .analitica_type_base(sv$type)
  unique(names0[types %in% .analitica_non_data_types & nzchar(names0)])
}

.analitica_filter_data_to_inst <- function(data, rp_inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  data_names <- names(data)
  data_vars <- .analitica_data_names_for_inst(rp_inst)
  structural <- .analitica_structural_names_for_inst(rp_inst)
  extras <- setdiff(data_names, c(data_vars, structural))
  extras <- extras[!grepl("^Pag[0-9]+$", extras)]
  extras <- extras[!grepl("^(nota|note)_", extras, ignore.case = TRUE)]
  cols <- unique(c(intersect(data_vars, data_names), extras))
  if (!length(cols)) return(data[, 0, drop = FALSE])
  out <- data[, cols, drop = FALSE]
  for (nm in setdiff(names(attributes(data)), c("names", "row.names", "class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.analitica_read_data_file <- function(meta) {
  ext <- tolower(as.character((meta %||% list())$ext %||% ""))
  if (!nzchar(ext)) ext <- tolower(tools::file_ext(as.character((meta %||% list())$path %||% "")))
  switch(ext,
    xlsx = readxl::read_excel(meta$path),
    xls  = readxl::read_excel(meta$path),
    csv  = utils::read.csv(meta$path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(meta$path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Ext no soportada: %s", ext))
  )
}

.analitica_write_plain_xlsx <- function(df, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", df, withFilter = TRUE)
  openxlsx::freezePane(wb, "datos", firstRow = TRUE)
  if (ncol(df)) openxlsx::setColWidths(wb, "datos", cols = seq_len(ncol(df)), widths = "auto")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  if (exists("pulso_xlsx_ignore_number_warnings", mode = "function")) pulso_xlsx_ignore_number_warnings(path)
}

.analitica_scalar <- function(x, fallback = "") {
  if (is.null(x) || !length(x)) return(fallback)
  out <- as.character(x[[1]])
  if (is.na(out) || !nzchar(out)) fallback else out
}

.analitica_integrated_key_list_name <- function(key_name) {
  if (exists(".mi_origin_key_list_name", mode = "function")) {
    return(.mi_origin_key_list_name(key_name))
  }
  base <- tolower(iconv(.analitica_scalar(key_name, "origen"), to = "ASCII//TRANSLIT", sub = ""))
  base <- gsub("[^a-z0-9_]+", "_", base)
  base <- gsub("^_+|_+$", "", base)
  if (!nzchar(base)) base <- "origen"
  paste0(base, "_opciones")
}

.analitica_integrated_key_spec <- function(base_meta) {
  mi <- (base_meta %||% list())$multi_integrated %||% NULL
  if (is.null(mi)) return(NULL)
  key_name <- .analitica_scalar(mi$origin_key_name, "")
  if (!nzchar(key_name)) return(NULL)
  origins <- mi$origins %||% list()
  if (!length(origins)) return(NULL)
  values <- vapply(origins, function(origin) {
    .analitica_scalar(origin$key_value %||% origin$origin %||% origin$pais, "")
  }, character(1))
  labels <- vapply(seq_along(origins), function(i) {
    origin <- origins[[i]]
    value <- .analitica_scalar(values[[i]], "")
    .analitica_scalar(origin$key_label %||% origin$key_value %||% value, value)
  }, character(1))
  keep <- nzchar(values) & !duplicated(values)
  values <- values[keep]
  labels <- labels[keep]
  if (!length(values)) return(NULL)
  list(
    key_name = key_name,
    key_label = key_name,
    list_name = .analitica_integrated_key_list_name(key_name),
    values = values,
    labels = labels
  )
}

.analitica_patch_integrated_key_survey <- function(survey, spec, raw = FALSE) {
  if (is.null(survey) || !is.data.frame(survey) || is.null(spec)) return(survey)
  survey <- as.data.frame(survey, stringsAsFactors = FALSE, check.names = FALSE)
  for (col in c("type", "name", "label")) {
    if (!col %in% names(survey)) survey[[col]] <- character(nrow(survey))
  }
  if (!raw && !"list_name" %in% names(survey)) survey$list_name <- NA_character_
  idx <- which(as.character(survey$name %||% "") == spec$key_name)
  if (!length(idx)) {
    row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(survey))), names(survey))),
      stringsAsFactors = FALSE, check.names = FALSE)
    survey <- rbind(row, survey)
    idx <- 1L
  }
  idx <- idx[1L]
  if (raw && !"list_name" %in% names(survey)) {
    survey$type[idx] <- paste("select_one", spec$list_name)
  } else {
    survey$type[idx] <- "select_one"
    survey$list_name[idx] <- spec$list_name
  }
  survey$name[idx] <- spec$key_name
  label_cols <- grep("^label", names(survey), value = TRUE, ignore.case = TRUE)
  if (!length(label_cols)) label_cols <- "label"
  for (col in label_cols) {
    if (!col %in% names(survey)) survey[[col]] <- character(nrow(survey))
    current <- .analitica_scalar(survey[[col]][idx], "")
    if (!nzchar(current) || identical(current, spec$key_name)) survey[[col]][idx] <- spec$key_label
  }
  if ("measure_sugerida" %in% names(survey)) survey$measure_sugerida[idx] <- "nominal"
  survey
}

.analitica_patch_integrated_key_choices <- function(choices, spec) {
  if (is.null(spec)) return(choices)
  if (is.null(choices) || !is.data.frame(choices)) choices <- data.frame()
  choices <- as.data.frame(choices, stringsAsFactors = FALSE, check.names = FALSE)
  for (col in c("list_name", "name", "label")) {
    if (!col %in% names(choices)) choices[[col]] <- character(nrow(choices))
  }
  choices <- choices[as.character(choices$list_name %||% "") != spec$list_name, , drop = FALSE]
  label_cols <- grep("^label", names(choices), value = TRUE, ignore.case = TRUE)
  if (!length(label_cols)) label_cols <- "label"
  rows <- lapply(seq_along(spec$values), function(i) {
    row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(choices))), names(choices))),
      stringsAsFactors = FALSE, check.names = FALSE)
    row$list_name[1] <- spec$list_name
    row$name[1] <- spec$values[[i]]
    for (col in label_cols) row[[col]][1] <- spec$labels[[i]]
    row
  })
  if (!length(rows)) return(choices)
  rbind(choices, do.call(rbind, rows))
}

.analitica_apply_integrated_key <- function(rp_inst, base_meta = NULL) {
  spec <- .analitica_integrated_key_spec(base_meta)
  if (is.null(spec) || is.null(rp_inst)) return(rp_inst)
  rp_inst$survey <- .analitica_patch_integrated_key_survey(rp_inst$survey, spec, raw = FALSE)
  rp_inst$choices <- .analitica_patch_integrated_key_choices(rp_inst$choices, spec)

  code_to_label <- stats::setNames(as.character(spec$labels), as.character(spec$values))
  label_to_code <- stats::setNames(as.character(spec$values), as.character(spec$labels))
  rp_inst$dicc_code_to_label <- rp_inst$dicc_code_to_label %||% list()
  rp_inst$dicc_label_to_code <- rp_inst$dicc_label_to_code %||% list()
  rp_inst$dicc_code_to_label[[spec$list_name]] <- code_to_label
  rp_inst$dicc_label_to_code[[spec$list_name]] <- label_to_code

  rp_inst$orders_list <- rp_inst$orders_list %||% list()
  rp_inst$orders_list[[spec$key_name]] <- list(
    names = as.character(spec$values),
    labels = as.character(spec$labels),
    label = spec$key_label,
    var_label = spec$key_label
  )

  rp_inst$var_labels <- rp_inst$var_labels %||% character(0)
  rp_inst$var_labels[[spec$key_name]] <- spec$key_label

  mr <- rp_inst$measure_rules %||% data.frame(name = character(), type = character(), list_name = character(), measure_sugerida = character())
  if (!"name" %in% names(mr)) mr$name <- character(nrow(mr))
  idx <- which(as.character(mr$name %||% "") == spec$key_name)
  if (!length(idx)) {
    row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(mr))), names(mr))),
      stringsAsFactors = FALSE, check.names = FALSE)
    row$name[1] <- spec$key_name
    mr <- rbind(row, mr)
    idx <- 1L
  }
  for (col in c("type", "list_name", "measure_sugerida")) if (!col %in% names(mr)) mr[[col]] <- NA_character_
  mr$type[idx[1L]] <- "select_one"
  mr$list_name[idx[1L]] <- spec$list_name
  mr$measure_sugerida[idx[1L]] <- "nominal"
  rp_inst$measure_rules <- mr
  rp_inst
}

.analitica_apply_integrated_key_to_data <- function(rp_data, rp_inst, base_meta = NULL) {
  spec <- .analitica_integrated_key_spec(base_meta)
  if (is.null(spec) || is.null(rp_data) || !is.data.frame(rp_data)) return(rp_data)
  if (spec$key_name %in% names(rp_data)) {
    attr(rp_data[[spec$key_name]], "label") <- spec$key_label
    attr(rp_data[[spec$key_name]], "labels") <- stats::setNames(
      as.character(spec$labels),
      nm = as.character(spec$values)
    )
    attr(rp_data[[spec$key_name]], "measure") <- "nominal"
  }
  attr(rp_data, "instrumento_reporte") <- rp_inst
  rp_data
}

.analitica_single_base_meta <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) == 1L) return(bases[[1L]])
  active_estudio <- if (exists("estudio_active_base", mode = "function")) estudio_active_base(sid) else NULL
  if (!is.null(active_estudio) && nzchar(active_estudio) && !is.null(bases[[active_estudio]])) {
    return(bases[[active_estudio]])
  }
  active <- .analitica_scalar(s$codif_source_active, "")
  if (nzchar(active) && !is.null(bases[[active]])) return(bases[[active]])
  NULL
}

.analitica_scope_bases <- function(sid, bases) {
  bases <- bases %||% list()
  if (!length(bases) || !exists("estudio_is_independent_siblings", mode = "function") ||
      !estudio_is_independent_siblings(sid)) {
    return(bases)
  }
  active <- estudio_active_base(sid)
  if (is.null(active) || !nzchar(active) || is.null(bases[[active]])) {
    stop_api(409, "E_ACTIVE_BASE_MISSING",
             "Selecciona una base activa valida para procesar este estudio.")
  }
  stats::setNames(list(bases[[active]]), active)
}

# Nombre de la base ACTIVA dentro de un conjunto de fuentes ya resueltas. El
# contexto de base ÚNICA (`rp_data`/`rp_inst` de `.load_rp_data`) es SIEMPRE el
# de la base activa; antes se fijaba a la primera fuente (`names(...)[1]`), lo
# que en un estudio madre/hija repeat (multibase, no independent_siblings)
# entregaba la MADRE al activar la hija: `/api/analitica/variables` listaba las
# variables de la madre y frecuencias/cruces operaban sobre ella (ADR 0030).
# Gateado a que no rompa single-base ni independent-siblings:
#   - con 0/1 fuente devuelve la única (no-op);
#   - en `independent_siblings` las fuentes ya vienen scopeadas a la activa por
#     `.analitica_scope_bases` (length 1), así que aquí también es no-op;
#   - si la activa no está entre las fuentes resueltas, cae a la primera
#     (comportamiento previo), degradando sin romper.
.analitica_active_source_name <- function(sid, source_names) {
  source_names <- as.character(source_names %||% character(0))
  source_names <- source_names[!is.na(source_names) & nzchar(source_names)]
  if (length(source_names) <= 1L) {
    return(if (length(source_names)) source_names[[1L]] else NA_character_)
  }
  active <- tryCatch(as.character(estudio_active_base(sid) %||% ""), error = function(e) "")
  if (nzchar(active) && active %in% source_names) return(active)
  source_names[[1L]]
}

.analitica_patch_inst_sources_integrated <- function(sid, inst_sources) {
  if (!length(inst_sources)) return(inst_sources)
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  for (nombre in names(inst_sources)) {
    base_meta <- bases[[nombre]] %||% if (length(inst_sources) == 1L) .analitica_single_base_meta(sid) else NULL
    inst_sources[[nombre]] <- .analitica_apply_integrated_key(inst_sources[[nombre]], base_meta)
  }
  inst_sources
}

.analitica_patch_data_sources_integrated <- function(sid, data_sources, inst_sources) {
  if (!length(data_sources)) return(data_sources)
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  for (nombre in names(data_sources)) {
    base_meta <- bases[[nombre]] %||% if (length(data_sources) == 1L) .analitica_single_base_meta(sid) else NULL
    data_sources[[nombre]] <- .analitica_apply_integrated_key_to_data(
      data_sources[[nombre]],
      inst_sources[[nombre]] %||% NULL,
      base_meta
    )
  }
  data_sources
}

.analitica_write_xlsform_frames <- function(survey, choices, settings, path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()
  for (sheet in c("survey", "choices", "settings")) {
    df <- switch(sheet, survey = survey, choices = choices, settings = settings)
    if (is.null(df)) df <- data.frame()
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df)
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    if (ncol(df)) openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.analitica_patch_xlsform_file_for_integrated_key <- function(path_in, path_out, base_meta) {
  spec <- .analitica_integrated_key_spec(base_meta)
  if (is.null(spec)) {
    ok <- file.copy(path_in, path_out, overwrite = TRUE)
    if (!isTRUE(ok)) stop("No se pudo copiar el XLSForm.", call. = FALSE)
    return(invisible(path_out))
  }
  survey <- readxl::read_excel(path_in, sheet = "survey")
  choices <- readxl::read_excel(path_in, sheet = "choices")
  settings <- tryCatch(readxl::read_excel(path_in, sheet = "settings"), error = function(e) data.frame())
  survey <- .analitica_patch_integrated_key_survey(survey, spec, raw = TRUE)
  choices <- .analitica_patch_integrated_key_choices(choices, spec)
  .analitica_write_xlsform_frames(survey, choices, settings, path_out)
  invisible(path_out)
}

.analitica_read_pair <- function(pair, base_meta = NULL) {
  rp_inst <- reporte_instrumento(path = pair$xls$path)
  rp_inst <- .analitica_apply_integrated_key(rp_inst, base_meta)
  dat_raw <- .analitica_read_data_file(pair$data)
  # CURA (frente B): este read RE-LEE el archivo crudo y alimenta la Analítica y
  # el banner "Variables extra en la data" (reconciliación). Sin este saneo la
  # base del handoff mostraba el esquema de seguimiento/universo VACÍO como extras
  # fantasma. Gate por proveniencia: source_kind del base_meta que empieza con
  # "monitoreo"; si el kind es conocido y NO-handoff (upload manual) se pasa FALSE
  # y sus columnas vacías se preservan; sin base_meta (legacy) se auto-detecta por
  # fingerprint. Va ANTES del normalize (nombres crudos con separador `/`).
  handoff_kind <- .carga_chr1((base_meta %||% list())$source_kind, "")
  dat_raw <- sanitize_base_data(
    dat_raw, rp_inst,
    monitoreo_handoff = if (nzchar(handoff_kind)) .base_hygiene_is_monitoreo_kind(handoff_kind) else NULL
  )
  dat_raw <- normalize_data_for_xlsform(dat_raw, rp_inst)
  dat_raw <- .analitica_filter_data_to_inst(dat_raw, rp_inst)
  .carga_assert_data_xlsform_compatible(dat_raw, rp_inst)
  rp_data <- reporte_data(dat_raw, instrumento = rp_inst)
  rp_data <- .analitica_apply_integrated_key_to_data(rp_data, rp_inst, base_meta)
  list(inst = rp_inst, data = rp_data)
}

.analitica_prepare_context <- function(sid, cfg) {
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  bases <- .analitica_scope_bases(sid, bases)
  fuente <- .analitica_effective_source(s, cfg, bases)

  if (length(bases) > 0L) {
    data_sources <- list()
    inst_sources <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_SOURCE_MISSING",
          sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
      }
      parsed <- .analitica_read_pair(pair, bases[[nombre]])
      data_sources[[nombre]] <- parsed$data
      inst_sources[[nombre]] <- parsed$inst
    }
    active <- .analitica_active_source_name(sid, names(data_sources))
    return(list(
      fuente = fuente,
      rp_data = data_sources[[active]],
      rp_inst = inst_sources[[active]],
      data_sources = data_sources,
      inst_sources = inst_sources
    ))
  }

  src <- .analitica_fuentes(sid, cfg)
  parsed <- .analitica_read_pair(list(
    xls = list(path = src$inst_path),
    data = src$data_meta
  ), NULL)
  list(
    fuente = src$fuente,
    rp_data = parsed$data,
    rp_inst = parsed$inst,
    data_sources = list(default = parsed$data),
    inst_sources = list(default = parsed$inst)
  )
}

.analitica_source_pairs <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  cfg <- cfg %||% .analitica_get_config(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  bases <- .analitica_scope_bases(sid, bases)
  fuente <- .analitica_effective_source(s, cfg, bases)

  if (length(bases) > 0L) {
    pairs <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_SOURCE_MISSING",
          sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
      }
      pairs[[nombre]] <- pair
    }
    return(list(fuente = fuente, pairs = pairs))
  }

  src <- .analitica_fuentes(sid, cfg)
  xls_meta <- if (identical(src$fuente, "adaptados")) {
    .analitica_file_by_id(s, s$codif_inst_adaptado_fid)
  } else {
    .require_xlsform_path(sid)
  }
  if (is.null(xls_meta)) {
    xls_meta <- list(
      path = src$inst_path,
      ext = tools::file_ext(src$inst_path),
      kind = if (identical(src$fuente, "adaptados")) "instrumento_adaptado" else "xlsform"
    )
  }

  list(
    fuente = src$fuente,
    pairs = list(default = list(xls = xls_meta, data = src$data_meta))
  )
}

.analitica_source_file_ext <- function(meta) {
  ext <- tolower(as.character((meta %||% list())$ext %||% ""))
  if (!nzchar(ext)) ext <- tolower(tools::file_ext(as.character((meta %||% list())$path %||% "")))
  if (!nzchar(ext)) "xlsx" else ext
}

.analitica_source_file_kind <- function(meta, role) {
  kind <- .analitica_file_kind(meta)
  role <- as.character(role %||% "data")
  if (identical(role, "instrumento")) {
    if (identical(kind, "instrumento_adaptado")) "bases_instrumento_codificado" else "bases_instrumento"
  } else {
    if (identical(kind, "data_adaptada")) "bases_data_codificada" else "bases_data"
  }
}

.analitica_source_zip_kind <- function(kinds, role) {
  role <- as.character(role %||% "data")
  if (identical(role, "instrumento")) {
    if (all(kinds == "bases_instrumento_codificado")) "bases_instrumento_codificado_zip" else "bases_instrumento_zip"
  } else {
    if (all(kinds == "bases_data_codificada")) "bases_data_codificada_zip" else "bases_data_zip"
  }
}

.analitica_export_source_files <- function(sid, role = c("data", "instrumento"), cfg = NULL) {
  role <- match.arg(role)
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  resolved <- .analitica_source_pairs(sid, cfg)
  pairs <- resolved$pairs
  if (length(pairs) == 0L) {
    stop_api(409, "E_ANALITICA_SOURCE_MISSING", "No hay archivos fuente para exportar.")
  }

  outputs <- list()
  kinds <- character(0)
  for (nombre in names(pairs)) {
    meta_in <- if (identical(role, "instrumento")) pairs[[nombre]]$xls else pairs[[nombre]]$data
    path_in <- as.character((meta_in %||% list())$path %||% "")
    if (!nzchar(path_in) || !file.exists(path_in)) {
      stop_api(409, "E_ANALITICA_SOURCE_MISSING",
        sprintf("No se encontró el archivo %s para la base '%s'.", role, nombre))
    }

    kind <- .analitica_source_file_kind(meta_in, role)
    kinds <- c(kinds, kind)
    ext <- .analitica_source_file_ext(meta_in)
    solo_una <- length(pairs) == 1L && nombre %in% c("default", "giz", "generic")
    fname <- if (solo_una) {
      .export_filename(sid, kind, ext)
    } else {
      .export_filename(sid, kind, ext, base = nombre)
    }
    path_out <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
    base_meta <- bases[[nombre]] %||% NULL
    is_integrated_data <- identical(role, "data") &&
      !is.null((base_meta %||% list())$multi_integrated) &&
      !identical(kind, "bases_data_codificada")
    is_integrated_instrument <- identical(role, "instrumento") &&
      !is.null((base_meta %||% list())$multi_integrated) &&
      !identical(kind, "bases_instrumento_codificado")
    if (isTRUE(is_integrated_data)) {
      rp_inst <- reporte_instrumento(path = pairs[[nombre]]$xls$path)
      rp_inst <- .analitica_apply_integrated_key(rp_inst, base_meta)
      data_df <- .analitica_read_data_file(meta_in)
      data_df <- normalize_data_for_xlsform(data_df, rp_inst)
      data_df <- .analitica_filter_data_to_inst(data_df, rp_inst)
      ext <- "xlsx"
      fname <- sub("\\.[^.]+$", ".xlsx", fname)
      path_out <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
      .analitica_write_plain_xlsx(data_df, path_out)
    } else if (isTRUE(is_integrated_instrument)) {
      ext <- "xlsx"
      fname <- sub("\\.[^.]+$", ".xlsx", fname)
      path_out <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
      .analitica_patch_xlsform_file_for_integrated_key(path_in, path_out, base_meta)
    } else if (identical(role, "instrumento") &&
               identical(kind, "bases_instrumento_codificado") &&
               identical(tolower(ext), "xlsx")) {
      # Instrumento codificado: re-emitir el XLSForm aplicando (o no) la firma de
      # color de recods EN EL EXPORT, gated por el switch de Analitica. El
      # archivo adaptado fuente no es fuente de verdad del color; lo decidimos
      # aqui a partir del tipo (SM/SO/INTEGER) leido del survey.
      color_recod <- .analitica_color_recod_enabled(cfg %||% .analitica_get_config(sid))
      sheets <- .analitica_read_xlsform_all_sheets(path_in)
      .analitica_write_xlsform_sheets(sheets, path_out, color_recod = color_recod)
    } else {
      copied <- file.copy(path_in, path_out, overwrite = TRUE)
      if (!isTRUE(copied)) {
        stop_api(500, "E_EXPORT_COPY_FAILED",
          sprintf("No se pudo preparar la descarga para la base '%s'.", nombre))
      }
    }

    meta_out <- .register_output_file(sid, kind, path_out, original_name = fname)
    outputs[[length(outputs) + 1L]] <- list(
      nombre = nombre,
      file_id = meta_out$file_id,
      filename = meta_out$original_name,
      size = meta_out$size,
      path = path_out
    )
  }

  if (length(outputs) == 1L) {
    o <- outputs[[1]]
    return(list(
      ok = TRUE,
      n_bases = 1L,
      fuente = resolved$fuente,
      file_id = o$file_id,
      filename = o$filename,
      size = o$size,
      bases = list(o[setdiff(names(o), "path")])
    ))
  }

  zip_kind <- .analitica_source_zip_kind(kinds, role)
  zip_name <- .export_filename(sid, zip_kind, "zip")
  zip_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
  .zip_files(
    zip_path,
    files = vapply(outputs, function(o) o$path, character(1)),
    names_in_zip = vapply(outputs, function(o) o$filename, character(1))
  )
  meta_zip <- .register_output_file(sid, zip_kind, zip_path, original_name = zip_name)
  list(
    ok = TRUE,
    n_bases = length(outputs),
    fuente = resolved$fuente,
    zip = list(file_id = meta_zip$file_id, filename = meta_zip$original_name, size = meta_zip$size),
    bases = lapply(outputs, function(o) o[setdiff(names(o), "path")])
  )
}

.analitica_base_alias <- function(base_meta, nombre) {
  value <- base_meta$source_alias %||% base_meta$alias %||%
    base_meta$source_title %||% base_meta$label %||% nombre
  value <- trimws(as.character(value %||% nombre)[1])
  if (is.na(value) || !nzchar(value)) as.character(nombre) else value
}

.analitica_base_id_slug <- function(value) {
  value <- tolower(iconv(as.character(value %||% "base"), from = "", to = "ASCII//TRANSLIT", sub = ""))
  value <- gsub("[^a-z0-9]+", "_", value)
  value <- gsub("^_+|_+$", "", value)
  if (!nzchar(value)) "base" else value
}

.analitica_origin_id_col <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !length(names(df))) return(NULL)
  norm <- function(x) {
    x <- tolower(trimws(as.character(x)))
    x <- gsub("[^a-z0-9]+", "_", x)
    gsub("^_+|_+$", "", x)
  }
  names_raw <- names(df)
  names_norm <- norm(names_raw)
  preferred <- c(
    "response_id", "respondent_id", "respondent", "survey_response_id",
    "submission_id", "_submission_id", "case_uid", "case_id",
    "uuid", "_uuid", "id", "_id", "codigo_pucp", "codigo"
  )
  for (candidate in preferred) {
    hit <- which(names_norm == norm(candidate))[1]
    if (!is.na(hit)) return(names_raw[hit])
  }
  NULL
}

.analitica_unified_norm_text <- function(x) {
  out <- as.character(x %||% "")
  out <- chartr("áéíóúÁÉÍÓÚüÜñÑ", "aeiouAEIOUuUnN", out)
  out <- iconv(out, from = "", to = "ASCII//TRANSLIT", sub = "")
  out <- tolower(out)
  out <- gsub("[^a-z0-9]+", " ", out)
  out <- trimws(out)
  gsub("\\s+", " ", out)
}

.analitica_unified_operational_metadata_cols <- function() {
  c(
    "pais", "survey_id", "collector_id", "respondent_id", "response_id",
    "case_uid", "source_title", "source_channel", "response_status", "collection_mode",
    "date_created", "date_modified", "recipient_id", "custom_value",
    "total_time", "ip_address", "decision_class", "decision_included", "decision_manual_include",
    "answered_questions_count", "duplicate_status", "duplicate_key",
    "duplicate_key_var", "duplicate_group_size", "duplicate_rank", "empresa_source_code",
    "empresa_source_label", "empresa_uid"
  )
}

.analitica_unified_link_id_var <- function() "id_enlace_sm"

.analitica_unified_link_id_label <- function() "ID enlace SurveyMonkey"

.analitica_unified_observation_metadata_cols <- function() {
  c(
    "posterior_corte", "fecha_corte_referencia",
    "collector_fuera_scope", "collector_id", "collector_label",
    "date_modified", "observacion_export"
  )
}

.analitica_unified_reconciliation_metadata_cols <- function() {
  c(.analitica_unified_link_id_var(), .analitica_unified_observation_metadata_cols())
}

.analitica_unified_scalar <- function(x) {
  if (is.null(x) || length(x) == 0L) return("")
  out <- as.character(x)[1]
  if (is.na(out)) "" else out
}

.analitica_unified_cv_id_from_response <- function(resp) {
  custom <- resp$custom_variables %||% list()
  if (!length(custom)) return("")
  nms <- names(custom)
  if (is.null(nms)) return("")
  hit <- which(tolower(as.character(nms)) == "id")[1]
  if (is.na(hit)) return("")
  .analitica_unified_scalar(custom[[hit]])
}

.analitica_unified_link_id_lookup_from_snapshot <- function(snapshot) {
  sources <- (snapshot %||% list())$sources %||% list()
  rows <- list()
  for (source in sources) {
    source_spec <- source$source_spec %||% list()
    source_id <- .analitica_unified_scalar(
      source$survey_id %||% source_spec$survey_id %||% (snapshot$spec %||% list())$survey_id
    )
    for (resp in source$responses %||% list()) {
      response_id <- .analitica_unified_scalar(resp$id %||% resp$response_id %||% resp$respondent_id)
      cv_id <- .analitica_unified_cv_id_from_response(resp)
      if (!nzchar(response_id) || !nzchar(cv_id)) next
      case_uid <- .analitica_unified_scalar(resp$case_uid)
      if (!nzchar(case_uid) && nzchar(source_id)) case_uid <- paste(source_id, response_id, sep = ":")
      rows[[length(rows) + 1L]] <- data.frame(
        case_uid = case_uid,
        response_id = response_id,
        cv_id = cv_id,
        stringsAsFactors = FALSE
      )
    }
  }
  empty <- list(case_uid = setNames(character(0), character(0)),
                response_id = setNames(character(0), character(0)))
  if (!length(rows)) return(empty)
  df <- do.call(rbind, rows)
  df <- df[nzchar(df$cv_id), , drop = FALSE]
  if (!nrow(df)) return(empty)

  case_df <- df[nzchar(df$case_uid), , drop = FALSE]
  case_map <- setNames(character(0), character(0))
  if (nrow(case_df)) {
    case_df <- case_df[!duplicated(case_df$case_uid), , drop = FALSE]
    case_map <- stats::setNames(as.character(case_df$cv_id), as.character(case_df$case_uid))
  }

  response_map <- setNames(character(0), character(0))
  dup_response <- names(table(df$response_id))[table(df$response_id) > 1L]
  response_df <- df[nzchar(df$response_id) & !df$response_id %in% dup_response, , drop = FALSE]
  if (nrow(response_df)) {
    response_map <- stats::setNames(as.character(response_df$cv_id), as.character(response_df$response_id))
  }
  list(case_uid = case_map, response_id = response_map)
}

.analitica_unified_link_id_lookup_for_base <- function(sid, base_meta) {
  raw_fid <- .analitica_unified_scalar((base_meta %||% list())$surveymonkey_raw_snapshot_file_id)
  if (!nzchar(raw_fid) || !exists(".sm_mb_read_raw_snapshot", mode = "function")) {
    return(.analitica_unified_link_id_lookup_from_snapshot(list()))
  }
  snapshot <- tryCatch(.sm_mb_read_raw_snapshot(sid, raw_fid), error = function(e) NULL)
  .analitica_unified_link_id_lookup_from_snapshot(snapshot %||% list())
}

.analitica_unified_lookup_values <- function(keys, lookup) {
  keys <- as.character(keys %||% character(0))
  keys[is.na(keys)] <- ""
  out <- rep("", length(keys))
  if (!length(lookup)) return(out)
  hit <- lookup[keys]
  ok <- !is.na(hit) & nzchar(hit)
  out[ok] <- as.character(hit[ok])
  out
}

.analitica_unified_link_id_values <- function(data, sid = NULL, base_meta = NULL,
                                             lookup = NULL) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  out <- rep("", n)
  if (!is.data.frame(data) || !n) {
    attr(out, "label") <- .analitica_unified_link_id_label()
    return(out)
  }

  fill_missing <- function(values) {
    values <- as.character(values %||% character(0))
    if (length(values) != n) values <- rep("", n)
    values[is.na(values)] <- ""
    missing <- !nzchar(out) & nzchar(values)
    out[missing] <<- values[missing]
  }

  if ("cv_id" %in% names(data)) fill_missing(data$cv_id)
  if (.analitica_unified_link_id_var() %in% names(data)) {
    fill_missing(data[[.analitica_unified_link_id_var()]])
  }
  if (is.null(lookup) && !is.null(sid)) {
    lookup <- .analitica_unified_link_id_lookup_for_base(sid, base_meta)
  }
  if (is.list(lookup) && length(lookup)) {
    if ("case_uid" %in% names(data)) {
      fill_missing(.analitica_unified_lookup_values(data$case_uid, lookup$case_uid %||% character(0)))
    }
    if ("response_id" %in% names(data)) {
      fill_missing(.analitica_unified_lookup_values(data$response_id, lookup$response_id %||% character(0)))
    }
  }
  attr(out, "label") <- .analitica_unified_link_id_label()
  out
}

.analitica_unified_effective_export_policy <- function(policy = list()) {
  policy <- policy %||% list()
  policy$statuses <- as.list(c("completed"))
  policy$collector_ids <- list()
  policy$include_partials <- FALSE
  policy$include_rejections <- FALSE
  policy
}

.analitica_unified_source_filters <- function(base_meta) {
  rf <- (base_meta %||% list())$response_filter %||% list()
  items <- if (is.list(rf) && identical(.analitica_unified_scalar(rf$kind), "surveymonkey_multi_source_response_filter")) {
    rf$sources %||% list()
  } else if (length(rf)) {
    list(rf)
  } else {
    list()
  }
  lapply(items, function(item) {
    list(
      survey_id = .analitica_unified_scalar(item$survey_id),
      source_title = .analitica_unified_scalar(item$source_title),
      collector_ids = .as_chr_vec(item$collector_ids),
      date_modified_lte = .analitica_unified_scalar(item$date_modified_lte),
      date_modified_gte = .analitica_unified_scalar(item$date_modified_gte)
    )
  })
}

.analitica_unified_filter_for_row <- function(filters, survey_id = "", source_title = "") {
  if (!length(filters)) return(list())
  survey_id <- .analitica_unified_scalar(survey_id)
  source_title <- .analitica_unified_scalar(source_title)
  if (nzchar(survey_id)) {
    hit <- Filter(function(x) identical(.analitica_unified_scalar(x$survey_id), survey_id), filters)
    if (length(hit)) return(hit[[1]])
  }
  if (nzchar(source_title)) {
    hit <- Filter(function(x) identical(.analitica_unified_scalar(x$source_title), source_title), filters)
    if (length(hit)) return(hit[[1]])
  }
  if (length(filters) == 1L) filters[[1]] else list()
}

.analitica_unified_parse_time <- function(x) {
  x <- .analitica_unified_scalar(x)
  if (!nzchar(x)) return(NA_real_)
  if (exists(".sm_mb_parse_time", mode = "function")) {
    return(.sm_mb_parse_time(x))
  }
  out <- suppressWarnings(as.POSIXct(x, tz = "UTC"))
  if (is.na(out)) return(NA_real_)
  as.numeric(out)
}

.analitica_unified_collector_labels <- function(snapshot) {
  sources <- (snapshot %||% list())$sources %||% list()
  out <- list()
  for (source in sources) {
    for (collector in source$collectors %||% list()) {
      id <- .analitica_unified_scalar(collector$id %||% collector$collector_id)
      label <- .analitica_unified_scalar(collector$name %||% collector$title %||% collector$collector_name)
      if (nzchar(id) && nzchar(label) && is.null(out[[id]])) out[[id]] <- label
    }
  }
  out
}

.analitica_unified_apply_observation_metadata <- function(data, base_meta, snapshot = list()) {
  if (!is.data.frame(data)) return(data)
  n <- nrow(data)
  filters <- .analitica_unified_source_filters(base_meta)
  collector_labels <- .analitica_unified_collector_labels(snapshot)

  posterior <- rep(FALSE, n)
  cutoff <- rep("", n)
  collector_out <- rep(FALSE, n)
  collector_label <- rep("", n)
  observation <- rep("", n)

  for (i in seq_len(n)) {
    survey_id <- if ("survey_id" %in% names(data)) data$survey_id[i] else ""
    source_title <- if ("source_title" %in% names(data)) data$source_title[i] else ""
    filter <- .analitica_unified_filter_for_row(filters, survey_id, source_title)

    collector <- if ("collector_id" %in% names(data)) .analitica_unified_scalar(data$collector_id[i]) else ""
    allowed_collectors <- .as_chr_vec(filter$collector_ids)
    if (nzchar(collector) && length(allowed_collectors) > 0L && !(collector %in% allowed_collectors)) {
      collector_out[i] <- TRUE
    }
    if (nzchar(collector) && !is.null(collector_labels[[collector]])) {
      collector_label[i] <- collector_labels[[collector]]
    }

    cutoff_i <- .analitica_unified_scalar(filter$date_modified_lte)
    cutoff[i] <- cutoff_i
    if (nzchar(cutoff_i)) {
      modified <- if ("date_modified" %in% names(data)) data$date_modified[i] else if ("date_created" %in% names(data)) data$date_created[i] else ""
      posterior[i] <- isTRUE(.analitica_unified_parse_time(modified) > .analitica_unified_parse_time(cutoff_i))
    }

    reasons <- character(0)
    if (isTRUE(posterior[i])) {
      reasons <- c(reasons, "Respuesta completa válida posterior al corte de reporte; incluida en base efectiva.")
    }
    if (isTRUE(collector_out[i])) {
      reasons <- c(reasons, "Collector fuera del filtro operativo previo; incluida por cumplir criterio de efectividad.")
    }
    observation[i] <- paste(reasons, collapse = " ")
  }

  data$posterior_corte <- posterior
  data$fecha_corte_referencia <- cutoff
  data$collector_fuera_scope <- collector_out
  data$collector_label <- collector_label
  data$observacion_export <- observation

  attr(data$posterior_corte, "label") <- "Posterior al corte operativo"
  attr(data$fecha_corte_referencia, "label") <- "Fecha de corte operativo de referencia"
  attr(data$collector_fuera_scope, "label") <- "Collector fuera del filtro operativo"
  if ("collector_id" %in% names(data)) attr(data$collector_id, "label") <- "Collector ID SurveyMonkey"
  attr(data$collector_label, "label") <- "Collector SurveyMonkey"
  if ("date_modified" %in% names(data)) attr(data$date_modified, "label") <- "Fecha modificación SurveyMonkey"
  attr(data$observacion_export, "label") <- "Observación de exportación"
  data
}

.analitica_unified_effective_context <- function(sid, base_name, base_meta, pair) {
  raw_fid <- .analitica_unified_scalar((base_meta %||% list())$surveymonkey_raw_snapshot_file_id)
  if (nzchar(raw_fid) && exists(".sm_mb_build_effective_from_snapshot", mode = "function")) {
    policy <- .analitica_unified_effective_export_policy(
      (base_meta %||% list())$surveymonkey_decision_policy %||% list()
    )
    built <- tryCatch(
      .sm_mb_build_effective_from_snapshot(sid, base_name, policy = policy),
      error = function(e) NULL
    )
    if (is.list(built) && is.data.frame(built$data) && !is.null(built$inst)) {
      return(list(
        inst = built$inst,
        data = reporte_data(built$data, instrumento = built$inst),
        audit = built$audit %||% list(),
        snapshot = built$snapshot %||% list(),
        rebuilt_from_snapshot = TRUE
      ))
    }
  }
  parsed <- .analitica_read_pair(pair, base_meta)
  list(
    inst = parsed$inst,
    data = parsed$data,
    audit = (base_meta %||% list())$surveymonkey_decision_audit %||% list(),
    snapshot = list(),
    rebuilt_from_snapshot = FALSE
  )
}

.analitica_unified_direct_identifier_cols <- function(data, rp_inst) {
  if (is.null(data) || !is.data.frame(data) || !length(names(data))) return(character(0))
  cols <- names(data)
  out <- character(0)

  for (col in cols) {
    col_norm <- .analitica_unified_norm_text(col)
    label <- attr(data[[col]], "label", exact = TRUE) %||% ""
    if (!nzchar(as.character(label))) label <- .analitica_var_label(rp_inst, col)
    label_norm <- .analitica_unified_norm_text(label)
    text <- trimws(paste(col_norm, label_norm))

    is_identifier <- grepl("\\b(correo|email|e mail|mail)\\b", text, perl = TRUE) ||
      grepl("\\b(telefono|celular|whatsapp)\\b", text, perl = TRUE) ||
      grepl("\\b(codigo\\s+pucp|dni|documento|ruc)\\b", text, perl = TRUE) ||
      grepl("\\b(nombre\\s+legal\\s+de\\s+la\\s+empresa|nombre\\s+del\\s+emprendimiento)\\b", text, perl = TRUE) ||
      grepl("\\b(jefe\\s+directo|datos\\s+de\\s+su\\s+jefe|datos\\s+de\\s+contacto|correo\\s+de\\s+contacto|numero\\s+de\\s+contacto)\\b", text, perl = TRUE) ||
      identical(label_norm, "nombre") ||
      identical(label_norm, "apellidos") ||
      identical(label_norm, "cargo") ||
      identical(label_norm, "anexo") ||
      identical(label_norm, "enumerador")

    if (isTRUE(is_identifier)) out <- c(out, col)
  }

  unique(out)
}

.analitica_unified_exclusions <- function(data, rp_inst, cfg_excluidas = character(0),
                                          omitir_identificadores_directos = TRUE,
                                          omitir_metadatos_operativos = TRUE) {
  out <- .as_chr_vec(cfg_excluidas)
  if (isTRUE(omitir_metadatos_operativos)) {
    op_meta <- intersect(.analitica_unified_operational_metadata_cols(), names(data))
    out <- c(out, setdiff(op_meta, .analitica_unified_reconciliation_metadata_cols()))
    cv_meta <- grep("^(cv_|recipient_cv_)", names(data), value = TRUE)
    out <- c(out, setdiff(cv_meta, .analitica_unified_reconciliation_metadata_cols()))
  }
  if (isTRUE(omitir_identificadores_directos)) {
    out <- c(out, .analitica_unified_direct_identifier_cols(data, rp_inst))
  }
  # Plumbing interno (tags de fuente, fases territoriales, derivadas kobo
  # redundantes): SIEMPRE fuera, independiente de los flags omitir_* (nunca son
  # datos de análisis). Consistente con /bases/xlsx; `.excluir_cols` deduplica.
  out <- c(out, .analitica_base_internal_cols(data))
  unique(out[nzchar(out)])
}

.analitica_unified_col_question_rank <- function(col) {
  col <- as.character(col %||% "")
  if (!grepl("^p[0-9]+", col, perl = TRUE)) return(Inf)
  suppressWarnings(as.numeric(sub("^p([0-9]+).*$", "\\1", col, perl = TRUE)))
}

.analitica_unified_col_suffix_rank <- function(col) {
  col <- as.character(col %||% "")
  if (!grepl("^p[0-9]+", col, perl = TRUE)) return(0)
  parent <- sub("^(p[0-9]+).*$", "\\1", col, perl = TRUE)
  suffix <- sub(paste0("^", parent), "", col, perl = TRUE)
  if (!nzchar(suffix)) return(0)
  if (identical(suffix, "_other")) return(9000)
  if (grepl("^_[0-9]+$", suffix, perl = TRUE)) {
    return(1000 + suppressWarnings(as.numeric(sub("^_", "", suffix))))
  }
  if (grepl("^(___|\\.|/)", suffix, perl = TRUE)) {
    code <- sub("^(___|\\.|/)", "", suffix, perl = TRUE)
    n <- suppressWarnings(as.numeric(code))
    if (!is.na(n)) return(2000 + n)
    return(3000)
  }
  8000
}

.analitica_unified_order_cols <- function(cols, key_cols = character(0)) {
  cols <- unique(as.character(cols))
  cols <- cols[nzchar(cols)]
  key_cols <- intersect(as.character(key_cols), cols)
  rest <- setdiff(cols, key_cols)
  original <- seq_along(rest)
  ord <- order(
    vapply(rest, .analitica_unified_col_question_rank, numeric(1)),
    vapply(rest, .analitica_unified_col_suffix_rank, numeric(1)),
    original,
    na.last = TRUE
  )
  c(key_cols, rest[ord])
}

.analitica_plain_col <- function(x) {
  if (inherits(x, c("haven_labelled", "haven_labelled_spss"))) {
    lab <- attr(x, "label", exact = TRUE)
    x <- unclass(x)
    attributes(x) <- NULL
    if (!is.null(lab)) attr(x, "label") <- lab
    return(x)
  }
  if (is.factor(x)) return(as.character(x))
  if (is.list(x) && !is.data.frame(x)) {
    return(vapply(x, function(item) {
      if (is.null(item) || length(item) == 0L) return(NA_character_)
      paste(as.character(item), collapse = " | ")
    }, character(1)))
  }
  x
}

.analitica_unified_align <- function(dfs, cols, labels) {
  lapply(dfs, function(df) {
    for (col in cols) {
      if (!(col %in% names(df))) df[[col]] <- NA
    }
    df <- df[, cols, drop = FALSE]
    for (col in names(df)) {
      df[[col]] <- .analitica_plain_col(df[[col]])
      lab <- labels[[col]] %||% NULL
      if (!is.null(lab) && nzchar(as.character(lab))) attr(df[[col]], "label") <- as.character(lab)
    }
    df
  })
}

.analitica_write_unified_xlsx <- function(df_cod, df_lab, common_df, omitted_df,
                                          bases_df, path, valores = "ambos",
                                          decision_audit_df = NULL,
                                          decision_case_audit_df = NULL,
                                          ficha_tecnica = NULL,
                                          color_recod = FALSE, type_map = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) stop("Se requiere openxlsx.", call. = FALSE)
  wb <- openxlsx::createWorkbook()

  write_data_sheet <- function(sheet_name, data) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(names(data)), stringsAsFactors = FALSE), colNames = FALSE, startRow = 1L)
    var_labels <- vapply(data, function(c) {
      l <- attr(c, "label", exact = TRUE)
      if (is.null(l)) "" else as.character(l)
    }, character(1))
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(var_labels), stringsAsFactors = FALSE), colNames = FALSE, startRow = 2L)
    for (v in names(data)) data[[v]] <- .analitica_plain_col(data[[v]])
    openxlsx::writeData(wb, sheet_name, data, startRow = 3L, colNames = FALSE)
    header1 <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED", halign = "left")
    header2 <- openxlsx::createStyle(textDecoration = "italic", fontColour = "#5F6368", fgFill = "#F6F7F9")
    openxlsx::addStyle(wb, sheet_name, header1, rows = 1L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::addStyle(wb, sheet_name, header2, rows = 2L, cols = seq_along(data), gridExpand = TRUE)
    pulso_xlsx_highlight_recod_cols(
      wb, sheet_name, colnames = names(data),
      header_rows = 1:2,
      first_data_row = 3L,
      last_data_row = if (nrow(data) > 0L) nrow(data) + 2L else NULL,
      enabled = color_recod, type_map = type_map
    )
    openxlsx::freezePane(wb, sheet_name, firstActiveRow = 3L)
    openxlsx::setColWidths(wb, sheet_name, cols = seq_along(data), widths = "auto")
  }

  write_meta_sheet <- function(sheet_name, data) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, data)
    header <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
    if (ncol(data)) {
      openxlsx::addStyle(wb, sheet_name, header, rows = 1L, cols = seq_len(ncol(data)), gridExpand = TRUE)
      openxlsx::setColWidths(wb, sheet_name, cols = seq_len(ncol(data)), widths = "auto")
      openxlsx::freezePane(wb, sheet_name, firstRow = TRUE)
    }
  }

  if (identical(valores, "ambos")) {
    write_data_sheet("completa_codigos", df_cod)
    write_data_sheet("completa_etiquetas", df_lab)
  } else if (identical(valores, "etiquetas")) {
    write_data_sheet("completa_etiquetas", df_lab)
  } else {
    write_data_sheet("completa_codigos", df_cod)
  }
  write_meta_sheet("variables_comunes", common_df)
  write_meta_sheet("variables_no_comunes", omitted_df)
  write_meta_sheet("bases", bases_df)
  if (!is.null(decision_audit_df) && is.data.frame(decision_audit_df) && nrow(decision_audit_df)) {
    write_meta_sheet("auditoria_surveymonkey", decision_audit_df)
  }
  if (!is.null(decision_case_audit_df) && is.data.frame(decision_case_audit_df) && nrow(decision_case_audit_df)) {
    write_meta_sheet("auditoria_sm_casos", decision_case_audit_df)
  }
  if (!identical(ficha_tecnica, FALSE) &&
      !is.null(ficha_tecnica) &&
      exists(".analitica_add_ficha_tecnica_from_spec", mode = "function")) {
    data_ref <- if (identical(valores, "codigos")) df_cod else df_lab
    .analitica_add_ficha_tecnica_from_spec(
      list(
        wb = wb,
        data = data_ref,
        reporte = "Base unificada",
        hojas = names(wb),
        detalles = list(
          "Bases incluidas" = paste(as.character(bases_df$alias %||% bases_df$base_nombre %||% ""), collapse = ", "),
          "Variables comunes" = nrow(common_df),
          "Variables no comunes" = nrow(omitted_df)
        )
      ),
      ficha_tecnica
    )
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.analitica_unified_independent_xlsx <- function(sid, cfg, valores = "ambos",
                                                multi_select = "dummy_01",
                                                omitir_identificadores_directos = TRUE,
                                                omitir_metadatos_operativos = TRUE,
                                                incluir_madre_sm = FALSE) {
  if (!exists("estudio_is_independent_siblings", mode = "function") ||
      !estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_NOT_INDEPENDENT_SIBLINGS",
             "La base unificada solo esta disponible para bases hermanas independientes.")
  }

  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) < 2L) {
    stop_api(409, "E_NOT_ENOUGH_BASES",
             "Se necesitan al menos dos bases hermanas para construir una base unificada.")
  }

  fuente <- .analitica_effective_source(s, cfg)
  cfg_excluidas <- .as_chr_vec(cfg$variables_excluidas)
  alias_var <- "base_hermana"
  origin_id_var <- "registro_origen_id"
  uid_var <- "registro_unificado_id"
  link_id_var <- .analitica_unified_link_id_var()
  key_cols <- c(alias_var, origin_id_var, uid_var, link_id_var)
  dfs_cod <- list()
  dfs_lab <- list()
  labels <- list(
    base_hermana = "Base hermana / carrera",
    registro_origen_id = "Identificador original del registro en su base",
    registro_unificado_id = "Identificador único del registro unificado",
    id_enlace_sm = .analitica_unified_link_id_label()
  )
  labels_by_base <- list()
  bases_rows <- list()
  decision_audit_rows <- list()
  decision_case_audit_rows <- list()
  unified_type_map <- list()  # nombre_var -> tipo, acumulado entre bases hermanas

  for (nombre in names(bases)) {
    pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
    if (is.null(pair)) {
      stop_api(409, "E_ANALITICA_SOURCE_MISSING",
        sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
    }
    effective_ctx <- .analitica_unified_effective_context(sid, nombre, bases[[nombre]], pair)
    reviewed <- .analitica_apply_data_review(effective_ctx$data, effective_ctx$inst, cfg)
    rp_inst <- reviewed$inst
    reviewed$data <- .bases_normalize_other_selects(reviewed$data, rp_inst)
    reviewed$data <- .analitica_unified_apply_observation_metadata(
      reviewed$data,
      bases[[nombre]],
      snapshot = effective_ctx$snapshot %||% list()
    )
    reviewed$data[[link_id_var]] <- .analitica_unified_link_id_values(
      reviewed$data,
      sid = sid,
      base_meta = bases[[nombre]]
    )

    origin_col_name <- .analitica_origin_id_col(reviewed$data)
    origin_col <- if (!is.null(origin_col_name) && origin_col_name %in% names(reviewed$data)) {
      as.character(reviewed$data[[origin_col_name]])
    } else {
      rep(NA_character_, nrow(reviewed$data))
    }
    origin_col[is.na(origin_col)] <- ""

    excluidas <- .analitica_unified_exclusions(
      reviewed$data,
      rp_inst,
      cfg_excluidas = cfg_excluidas,
      omitir_identificadores_directos = omitir_identificadores_directos,
      omitir_metadatos_operativos = omitir_metadatos_operativos
    )
    # Reconciliación data↔XLSForm: por defecto las extra sustantivas se excluyen;
    # solo sobreviven las incluidas por config. El include manda sobre el
    # empty-drop (una extra incluida-pero-vacía no se dropea por vacía).
    recon <- .reconciliacion_export_plan(reviewed$data, rp_inst, cfg)
    excluidas <- unique(c(excluidas, recon$extra_a_excluir))
    # Fuera las columnas 100% vacías del volcado de la BBDD (plantillas de
    # análisis nunca calculadas, metadata sin contenido). Se computa por base
    # antes de agregar alias/origen/uid (que nunca son vacías).
    empty_cols <- setdiff(.analitica_base_empty_cols(reviewed$data), recon$extra_incluidas)
    excluidas <- unique(c(excluidas, empty_cols))
    rp_data <- .excluir_cols(reviewed$data, excluidas)
    if (multi_select == "dummy_01") rp_data <- .expand_multiselect(rp_data, rp_inst)
    if (isTRUE(incluir_madre_sm)) rp_data <- .analitica_base_reconstruct_madre_sm(rp_data, rp_inst)

    alias <- .analitica_base_alias(bases[[nombre]], nombre)
    alias_col <- rep(alias, nrow(rp_data))
    attr(alias_col, "label") <- "Base hermana / carrera"
    attr(origin_col, "label") <- "Identificador original del registro en su base"
    uid_prefix <- .analitica_base_id_slug(nombre)
    uid_col <- sprintf("%s_%06d", uid_prefix, seq_len(nrow(rp_data)))
    attr(uid_col, "label") <- "Identificador único del registro unificado"
    rp_data[[alias_var]] <- alias_col
    rp_data[[origin_id_var]] <- origin_col
    rp_data[[uid_var]] <- uid_col
    ordered_base_cols <- .analitica_unified_order_cols(names(rp_data), key_cols)
    rp_data <- rp_data[, ordered_base_cols, drop = FALSE]

    for (col in names(rp_data)) {
      lab <- attr(rp_data[[col]], "label", exact = TRUE)
      if (!is.null(lab) && nzchar(as.character(lab)) && is.null(labels[[col]])) {
        labels[[col]] <- as.character(lab)
      }
      current_labels <- labels_by_base[[col]] %||% list()
      current_labels[[nombre]] <- as.character(lab %||% "")
      labels_by_base[[col]] <- current_labels
    }

    df_cod <- .aplicar_etiquetas(rp_data, rp_inst, valores = "codigos", multi_select = multi_select)
    df_lab <- .aplicar_etiquetas(rp_data, rp_inst, valores = "etiquetas", multi_select = multi_select)
    dfs_cod[[nombre]] <- df_cod
    dfs_lab[[nombre]] <- df_lab
    unified_type_map <- utils::modifyList(unified_type_map, pulso_recod_type_map(rp_inst$survey))
    bases_rows[[length(bases_rows) + 1L]] <- data.frame(
      base_nombre = nombre,
      alias = alias,
      source_title = as.character((bases[[nombre]] %||% list())$source_title %||% ""),
      n_filas = as.integer(nrow(rp_data)),
      n_columnas = as.integer(ncol(rp_data)),
      stringsAsFactors = FALSE
    )
    audit <- effective_ctx$audit %||% (bases[[nombre]] %||% list())$surveymonkey_decision_audit %||% list()
    policy <- (bases[[nombre]] %||% list())$surveymonkey_decision_policy %||% list()
    if (length(audit)) {
      decision_audit_rows[[length(decision_audit_rows) + 1L]] <- data.frame(
        base_nombre = nombre,
        alias = alias,
        raw_total = as.integer(audit$raw_total %||% NA_integer_),
        completas = as.integer(audit$completed %||% NA_integer_),
        completas_con_consentimiento = as.integer(audit$completed_with_consent %||% NA_integer_),
        parciales_revisables = as.integer(audit$partials_revisable %||% NA_integer_),
        rechazos = as.integer(audit$rejections %||% NA_integer_),
        grupos_duplicados = as.integer(audit$duplicate_groups %||% NA_integer_),
        filas_en_grupos_duplicados = as.integer(audit$duplicate_rows %||% NA_integer_),
        duplicados_extra = as.integer(audit$duplicate_extra_rows %||% NA_integer_),
        duplicados_excluidos = as.integer(audit$duplicates_excluded %||% NA_integer_),
        incluidas = as.integer(audit$included %||% NA_integer_),
        excluidas = as.integer(audit$excluded %||% NA_integer_),
        umbral_parcial_mas_de = as.integer((policy %||% list())$partial_min_answers %||% NA_integer_),
        incluye_parciales = isTRUE((policy %||% list())$include_partials),
        incluye_rechazos = isTRUE((policy %||% list())$include_rejections),
        incluye_duplicados = if (is.null((policy %||% list())$include_duplicates)) TRUE else isTRUE((policy %||% list())$include_duplicates),
        clave_duplicados = paste(.as_chr_vec((policy %||% list())$duplicate_key_vars), collapse = ", "),
        criterio_duplicados = as.character((policy %||% list())$duplicate_keep %||% ""),
        variable_consentimiento = as.character((policy %||% list())$consent_var %||% ""),
        variable_rechazo = as.character((policy %||% list())$rejection_var %||% ""),
        auditada_en = as.character(audit$audited_at %||% ""),
        stringsAsFactors = FALSE
      )
      for (source in audit$sources %||% list()) {
        for (case_row in source$cases %||% list()) {
          decision_case_audit_rows[[length(decision_case_audit_rows) + 1L]] <- data.frame(
            base_nombre = nombre,
            alias = alias,
            campania = as.character(source$source_alias %||% source$source_title %||% source$source_label %||% ""),
            survey_id = as.character(case_row$survey_id %||% source$survey_id %||% ""),
            source_title = as.character(case_row$source_title %||% source$source_title %||% ""),
            collector_id = as.character(case_row$collector_id %||% ""),
            response_id = as.character(case_row$response_id %||% ""),
            case_uid = as.character(case_row$case_uid %||% ""),
            recipient_id = as.character(case_row$recipient_id %||% ""),
            custom_value = as.character(case_row$custom_value %||% ""),
            cv_id = as.character(case_row$cv_id %||% ""),
            p4 = as.character(case_row$p4 %||% ""),
            estado = as.character(case_row$response_status %||% ""),
            preguntas_respondidas = as.character(case_row$answered_questions_count %||% ""),
            decision = as.character(case_row$decision_class %||% ""),
            incluido = as.character(case_row$decision_included %||% ""),
            estado_duplicado = as.character(case_row$duplicate_status %||% ""),
            clave_duplicado = as.character(case_row$duplicate_key %||% ""),
            variable_clave_duplicado = as.character(case_row$duplicate_key_var %||% ""),
            tamano_grupo_duplicado = as.character(case_row$duplicate_group_size %||% ""),
            orden_en_duplicado = as.character(case_row$duplicate_rank %||% ""),
            fecha_creacion = as.character(case_row$date_created %||% ""),
            fecha_modificacion = as.character(case_row$date_modified %||% ""),
            stringsAsFactors = FALSE
          )
        }
      }
    }
  }

  present_cols <- lapply(dfs_cod, names)
  union_cols <- .analitica_unified_order_cols(
    unique(c(key_cols, unlist(present_cols, use.names = FALSE))),
    key_cols
  )
  common_cols <- .analitica_unified_order_cols(
    setdiff(Reduce(intersect, present_cols), key_cols),
    character(0)
  )
  omitted_cols <- .analitica_unified_order_cols(
    setdiff(union_cols, c(key_cols, common_cols)),
    character(0)
  )

  common_df <- if (length(common_cols)) {
    do.call(rbind, lapply(common_cols, function(col) {
      labs <- labels_by_base[[col]] %||% list()
      labs_nonempty <- unique(as.character(unlist(labs, use.names = FALSE)))
      labs_nonempty <- labs_nonempty[nzchar(labs_nonempty)]
      data.frame(
        variable = col,
        label = as.character(labels[[col]] %||% ""),
        n_bases = as.integer(length(bases)),
        label_consistente = length(unique(labs_nonempty)) <= 1L,
        stringsAsFactors = FALSE
      )
    }))
  } else {
    data.frame(variable = character(), label = character(), n_bases = integer(),
               label_consistente = logical(), stringsAsFactors = FALSE)
  }

  omitted_df <- if (length(omitted_cols)) {
    do.call(rbind, lapply(omitted_cols, function(col) {
      present <- names(Filter(function(cols) col %in% cols, present_cols))
      missing <- setdiff(names(bases), present)
      data.frame(
        variable = col,
        label = as.character(labels[[col]] %||% ""),
        presente_en = paste(present, collapse = ", "),
        falta_en = paste(missing, collapse = ", "),
        n_bases_presentes = as.integer(length(present)),
        stringsAsFactors = FALSE
      )
    }))
  } else {
    data.frame(variable = character(), label = character(), presente_en = character(),
               falta_en = character(), n_bases_presentes = integer(),
               stringsAsFactors = FALSE)
  }
  bases_df <- do.call(rbind, bases_rows)
  decision_audit_df <- if (length(decision_audit_rows)) {
    do.call(rbind, decision_audit_rows)
  } else {
    data.frame()
  }
  decision_case_audit_df <- if (length(decision_case_audit_rows)) {
    do.call(rbind, decision_case_audit_rows)
  } else {
    data.frame()
  }

  aligned_cod <- .analitica_unified_align(dfs_cod, union_cols, labels)
  aligned_lab <- .analitica_unified_align(dfs_lab, union_cols, labels)
  df_cod <- do.call(rbind, aligned_cod)
  df_lab <- do.call(rbind, aligned_lab)
  rownames(df_cod) <- NULL
  rownames(df_lab) <- NULL
  for (col in intersect(names(labels), names(df_cod))) {
    lab <- labels[[col]] %||% NULL
    if (!is.null(lab) && nzchar(as.character(lab))) {
      attr(df_cod[[col]], "label") <- as.character(lab)
      if (col %in% names(df_lab)) attr(df_lab[[col]], "label") <- as.character(lab)
    }
  }

  out_name <- .export_filename(sid, "bases_unificadas", "xlsx")
  out_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
  # BBDD unificada sin "Ficha tecnica" (pedido del usuario — la ficha no
  # pertenece al volcado de datos). Conserva sus hojas de meta propias
  # (comunes/omitidas/bases/auditoría); solo se quita la ficha técnica.
  .analitica_write_unified_xlsx(df_cod, df_lab, common_df, omitted_df,
                                bases_df, out_path, valores = valores,
                                decision_audit_df = decision_audit_df,
                                decision_case_audit_df = decision_case_audit_df,
                                ficha_tecnica = FALSE,
                                color_recod = .analitica_color_recod_enabled(cfg),
                                type_map = unified_type_map)
  meta <- .register_output_file(sid, "bases_unificadas", out_path, original_name = out_name)
  list(
    ok = TRUE,
    n_bases = length(bases),
    fuente = fuente,
    file_id = meta$file_id,
    filename = meta$original_name,
    size = meta$size,
    unified = list(
      alias_var = alias_var,
      origin_id_var = origin_id_var,
      unique_id_var = uid_var,
      link_id_var = link_id_var,
      n_filas = as.integer(nrow(df_cod)),
      n_columnas = as.integer(ncol(df_cod)),
      n_variables_comunes = as.integer(nrow(common_df)),
      n_variables_no_comunes = as.integer(nrow(omitted_df))
    )
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

  # ADR 0030 Fase 3: las preguntas anidadas en un `begin_repeat` (repeat_depth>0)
  # son fantasma en la base ancha; no deben aparecer en sus secciones. En una
  # base hija su repeat_depth es 0 (van bajo `begin_group`), así que no se tocan.
  phantom <- .analitica_repeat_phantom_names(rp_inst)

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
    } else if (nzchar(nm) && !(nm %in% phantom)) {
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
  # El `type` cargado puede venir ya normalizado a "select_one" (sin la lista),
  # con el nombre de la lista en la columna `list_name`. Preferimos esa columna
  # cuando existe; solo caemos al parseo del type si falta. Sin esto el frontend
  # recibe list_name = "" y no puede keyar el orden de categorías por lista.
  if ("list_name" %in% names(sv)) {
    ln_col <- trimws(as.character(sv$list_name))
    has_col <- !is.na(ln_col) & nzchar(ln_col)
    list_names[has_col] <- ln_col[has_col]
  }

  keep <- !is.na(sv$name) & nzchar(sv$name) &
          !base_tipos %in% c("begin_group","end_group","begin_repeat","end_repeat","note","calculate","start","end","deviceid","today")
  # ADR 0030 Fase 3: excluir las preguntas anidadas en un `begin_repeat`
  # (repeat_depth > 0). En la base ANCHA son variables fantasma (viven en la base
  # hija, no en la data aplanada). En una base HIJA el instrumento las promueve a
  # top-level con `begin_group`, así que su repeat_depth es 0 y NO se filtran.
  phantom <- .analitica_repeat_phantom_names(rp_inst)
  if (length(phantom)) keep <- keep & !(as.character(sv$name) %in% phantom)
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

.analitica_data_dummy_cols_for_parent <- function(data_names, parent) {
  parent <- as.character(parent %||% "")[1]
  if (!nzchar(parent) || !length(data_names)) return(character(0))
  parent_keys <- unique(c(parent, .analitica_clean_dummy_name(parent)))
  parent_keys <- parent_keys[nzchar(parent_keys)]
  if (!length(parent_keys)) return(character(0))
  prefixes <- as.vector(rbind(paste0(parent_keys, "/"), paste0(parent_keys, ".")))
  data_lower <- tolower(as.character(data_names))
  prefix_lower <- tolower(prefixes)
  hit <- rep(FALSE, length(data_names))
  for (prefix in prefix_lower) {
    hit <- hit | startsWith(data_lower, prefix)
  }
  data_names[hit]
}

.analitica_select_multiple_dummy_cols <- function(data, rp_inst, allowed) {
  if (!is.data.frame(data) || !length(names(data))) return(character(0))
  cat <- .analitica_catalogo(rp_inst)
  if (nrow(cat) == 0L || !"tipo" %in% names(cat)) return(character(0))
  parents <- cat$name[cat$tipo == "select_multiple" & cat$name %in% allowed]
  parents <- parents[!is.na(parents) & nzchar(parents)]
  if (!length(parents)) return(character(0))
  unique(unlist(
    lapply(parents, function(parent) {
      .analitica_data_dummy_cols_for_parent(names(data), parent)
    }),
    use.names = FALSE
  ))
}

.analitica_excluded_data_cols <- function(cols, excluidas) {
  excluidas <- .as_chr_vec(excluidas)
  if (!length(cols) || !length(excluidas)) return(rep(FALSE, length(cols)))
  excluidas <- excluidas[!is.na(excluidas) & nzchar(excluidas)]
  if (!length(excluidas)) return(rep(FALSE, length(cols)))
  cols_lower <- tolower(as.character(cols))
  excluded <- cols %in% excluidas
  for (ex in excluidas) {
    ex_keys <- unique(c(ex, .analitica_clean_dummy_name(ex)))
    ex_keys <- ex_keys[nzchar(ex_keys)]
    if (!length(ex_keys)) next
    prefixes <- tolower(as.vector(rbind(paste0(ex_keys, "/"), paste0(ex_keys, "."))))
    for (prefix in prefixes) {
      excluded <- excluded | startsWith(cols_lower, prefix)
    }
  }
  excluded
}

.analitica_filter_sections <- function(secs, rp_inst, numericas = character(0), excluidas = character(0)) {
  allowed <- .analitica_allowed_vars(rp_inst, numericas)
  allowed <- setdiff(allowed, .as_chr_vec(excluidas))
  if (length(allowed) == 0L) return(NULL)
  has_recod <- function(v, allowed_vars) {
    if (is.na(v) || !nzchar(v)) return(NA_character_)
    recod <- paste0(v, "_recod")
    if (recod %in% allowed_vars) return(recod)
    NA_character_
  }
  if (is.null(secs) || !is.list(secs) || length(secs) == 0L) {
    secs <- .secciones_desde_instrumento(rp_inst)
  }
  if (is.null(secs) || !is.list(secs) || length(secs) == 0L) return(NULL)
  secs <- lapply(secs, function(v) {
    vars <- as.character(v)
    out <- character(0)
    for (var in vars) {
      if (is.na(var) || identical(var, "")) next
      if (var %in% allowed) {
        out <- c(out, var)
      } else {
        recod <- has_recod(var, allowed)
        if (!is.na(recod)) out <- c(out, recod)
      }
    }
    unique(out)
  })
  secs <- secs[vapply(secs, length, integer(1)) > 0L]
  if (length(secs) == 0L) return(NULL)
  secs
}

.analitica_append_missing_select_multiple_sections <- function(secs, rp_inst,
                                                               numericas = character(0),
                                                               excluidas = character(0)) {
  cat <- .analitica_catalogo(rp_inst)
  if (nrow(cat) == 0L || !"tipo" %in% names(cat)) return(secs)
  allowed <- setdiff(.analitica_allowed_vars(rp_inst, numericas), .as_chr_vec(excluidas))
  sm_allowed <- cat$name[cat$tipo == "select_multiple" & cat$name %in% allowed]
  sm_allowed <- sm_allowed[!is.na(sm_allowed) & nzchar(sm_allowed)]
  if (!length(sm_allowed)) return(secs)

  present <- unique(as.character(unlist(secs %||% list(), use.names = FALSE)))
  present <- present[!is.na(present) & nzchar(present)]
  missing <- setdiff(sm_allowed, present)
  if (!length(missing)) return(secs)

  auto <- .secciones_desde_instrumento(rp_inst)
  if (is.null(auto) || !length(auto)) {
    auto <- list("Select multiple" = missing)
  } else {
    auto <- lapply(auto, function(vars) intersect(as.character(vars), missing))
    auto <- auto[vapply(auto, length, integer(1)) > 0L]
    if (!length(auto)) auto <- list("Select multiple" = missing)
  }

  out <- secs
  if (is.null(out) || !is.list(out)) out <- list()
  for (key in names(auto)) {
    vars <- unique(as.character(auto[[key]]))
    vars <- vars[!is.na(vars) & nzchar(vars)]
    if (!length(vars)) next
    if (key %in% names(out)) {
      out[[key]] <- unique(c(as.character(out[[key]]), vars))
    } else {
      out[[key]] <- vars
    }
  }
  out
}

.analitica_filter_data <- function(data, rp_inst, numericas = character(0), excluidas = character(0)) {
  allowed <- .analitica_allowed_vars(rp_inst, numericas)
  dummy_cols <- .analitica_select_multiple_dummy_cols(data, rp_inst, allowed)
  wanted <- unique(c(allowed, dummy_cols))
  keep <- names(data)[names(data) %in% wanted]
  keep <- keep[!.analitica_excluded_data_cols(keep, excluidas)]
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

.analitica_has_structural_cols <- function(data) {
  if (!is.data.frame(data) || !length(names(data))) return(FALSE)
  any(grepl("^Pag[0-9]+$", names(data))) ||
    any(grepl("^(nota|note)_", names(data), ignore.case = TRUE))
}

.analitica_context_usable <- function(data, inst) {
  basic_ok <- is.data.frame(data) &&
    ncol(data) > 0L &&
    length(.variables_desde_instrumento(inst)) > 0L &&
    !.analitica_has_structural_cols(data)
  if (!isTRUE(basic_ok)) return(FALSE)

  compat <- attr(data, "xlsform_compatibility", exact = TRUE)
  if (!is.null(compat) && !isTRUE(compat$ok)) {
    missing_prev <- compat$missing_columns %||% compat$missing_variables %||% character(0)
    if (!.analitica_missing_ok_as_sm_dummies(data, inst, missing_prev)) return(FALSE)
  }

  compat_now <- tryCatch(
    validate_data_xlsform_compatibility(data, inst),
    error = function(e) NULL
  )
  if (is.null(compat_now) || isTRUE(compat_now$ok)) return(TRUE)
  .analitica_missing_ok_as_sm_dummies(
    data,
    inst,
    compat_now$missing_columns %||% compat_now$missing_variables %||% character(0)
  )
}

.analitica_sources_usable <- function(data_sources, inst_sources) {
  if (!length(data_sources) || !length(inst_sources)) return(FALSE)
  if (length(setdiff(names(data_sources), names(inst_sources))) > 0L) return(FALSE)
  all(vapply(names(data_sources), function(nm) {
    .analitica_context_usable(data_sources[[nm]], inst_sources[[nm]])
  }, logical(1)))
}

.analitica_missing_ok_as_sm_dummies <- function(data, inst, missing) {
  missing <- as.character(missing %||% character(0))
  missing <- missing[!is.na(missing) & nzchar(missing)]
  if (!length(missing)) return(TRUE)
  if (!is.data.frame(data) || is.null(inst$survey) || !is.data.frame(inst$survey)) {
    return(FALSE)
  }
  survey <- inst$survey
  if (!all(c("name", "type") %in% names(survey))) return(FALSE)
  names_s <- as.character(survey$name %||% character(0))
  type_base <- .analitica_type_base(survey$type)
  sm_vars <- names_s[type_base == "select_multiple"]
  sm_vars <- sm_vars[!is.na(sm_vars) & nzchar(sm_vars)]
  all(vapply(missing, function(v) {
    v %in% sm_vars && (
      any(startsWith(names(data), paste0(v, "/"))) ||
        any(grepl(paste0("^", gsub("([\\W])", "\\\\\\1", v), "\\.[^\\.]+$"), names(data), perl = TRUE))
    )
  }, logical(1)))
}

.analitica_cached_source_matches <- function(s, fuente) {
  actual <- as.character((s %||% list())$analitica_fuente %||% "")
  nzchar(actual) && identical(actual, as.character(fuente %||% ""))
}

.analitica_source_cache_key <- function(sid, fuente) {
  key <- as.character(fuente %||% "")
  # El caché singular (`analitica_rp_data`/`analitica_rp_inst`) es el contexto de
  # la BASE ACTIVA (ver `.analitica_active_source_name`). Por eso, en cualquier
  # estudio con más de una base, cambiar la base activa debe invalidarlo. Antes
  # esto solo ocurría en `independent_siblings`, dejando que un estudio madre/hija
  # repeat sirviera la base "first" (la madre) al activar la hija. Se generaliza a
  # todo estudio multibase; single-base (0/1 base, sin independent) no cambia de
  # key, así el modo de una sola base queda intacto.
  s <- session_get(sid, required = FALSE)
  n_bases <- length((s$estudio %||% list())$bases %||% list())
  include_active <- n_bases > 1L ||
    (exists("estudio_is_independent_siblings", mode = "function") &&
       isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE)))
  if (include_active) {
    active <- if (exists("estudio_active_base", mode = "function")) estudio_active_base(sid) else NULL
    key <- paste(key, as.character(active %||% ""), sep = ":")
  }
  key
}

.analitica_active_export_base <- function(sid) {
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid) &&
      exists("estudio_active_base", mode = "function")) {
    active <- estudio_active_base(sid)
    if (!is.null(active) && nzchar(active)) return(active)
  }
  NULL
}

.analitica_export_filename <- function(sid, label, ext, base = NULL) {
  base <- base %||% .analitica_active_export_base(sid)
  .export_filename(sid, label, ext, base = base)
}

.analitica_repair_project_context <- function(sid) {
  changed <- FALSE
  if (exists(".pulso_repair_multibase_variant_xlsforms", mode = "function")) {
    changed <- isTRUE(tryCatch(
      .pulso_repair_multibase_variant_xlsforms(sid),
      error = function(e) FALSE
    ))
  }
  if (exists(".pulso_repair_parent_recod_columns", mode = "function")) {
    changed <- isTRUE(changed || tryCatch(
      .pulso_repair_parent_recod_columns(sid),
      error = function(e) FALSE
    ))
  }
  if (isTRUE(changed) && exists(".pulso_renormalize_after_load", mode = "function")) {
    tryCatch(.pulso_renormalize_after_load(sid), error = function(e) NULL)
  }
  invisible(isTRUE(changed))
}

.analitica_prepare_and_cache <- function(sid) {
  .analitica_repair_project_context(sid)
  cfg <- .analitica_get_config(sid)
  ctx <- .analitica_prepare_context(sid, cfg)
  if (exists(".bases_normalize_source_contexts", mode = "function")) {
    normalized <- .bases_normalize_source_contexts(ctx$data_sources, ctx$inst_sources)
    ctx$data_sources <- normalized$data_sources
    ctx$inst_sources <- normalized$inst_sources
    active <- .analitica_active_source_name(sid, names(ctx$data_sources))
    if (!is.na(active) && nzchar(active) && active %in% names(ctx$inst_sources)) {
      ctx$rp_data <- ctx$data_sources[[active]]
      ctx$rp_inst <- ctx$inst_sources[[active]]
    }
  }
  session_set(sid, "analitica_rp_inst", ctx$rp_inst)
  session_set(sid, "analitica_rp_data", ctx$rp_data)
  session_set(sid, "analitica_rp_inst_sources", ctx$inst_sources)
  session_set(sid, "analitica_rp_data_sources", ctx$data_sources)
  .analitica_status_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", .analitica_source_cache_key(sid, ctx$fuente))
  ctx
}

.load_rp_data <- function(sid) {
  .analitica_repair_project_context(sid)
  s <- session_get(sid)
  cfg <- .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  cache_matches <- .analitica_cached_source_matches(s, .analitica_source_cache_key(sid, fuente))
  if (!is.null(s$analitica_rp_data) && !is.null(s$analitica_rp_inst) &&
      isTRUE(cache_matches) &&
      .analitica_context_usable(s$analitica_rp_data, s$analitica_rp_inst)) {
    base_meta <- .analitica_single_base_meta(sid)
    rp_inst <- .analitica_apply_integrated_key(s$analitica_rp_inst, base_meta)
    rp_data <- .analitica_apply_integrated_key_to_data(s$analitica_rp_data, rp_inst, base_meta)
    if (exists(".bases_normalize_report_context", mode = "function")) {
      ctx_norm <- .bases_normalize_report_context(rp_data, rp_inst)
      rp_data <- ctx_norm$data
      rp_inst <- ctx_norm$inst
    }
    # ADR 0030 Fase 3: si la base activa es hija repeat, enriquecerla con la
    # caracterización de la madre (join many-to-one) y anotar el grano.
    enriched <- .analitica_repeat_enrich_active(sid, rp_inst, rp_data)
    return(list(
      rp_inst = enriched$rp_inst,
      rp_data = enriched$rp_data
    ))
  }
  bases <- (s$estudio %||% list())$bases %||% list()
  can_use_base_cache <- !length(bases) && !isTRUE(s$codif_aplicado)
  if (isTRUE(can_use_base_cache) &&
      !is.null(s$rp_data) && !is.null(s$rp_inst) &&
      .analitica_context_usable(s$rp_data, s$rp_inst)) {
    base_meta <- .analitica_single_base_meta(sid)
    rp_inst <- .analitica_apply_integrated_key(s$rp_inst, base_meta)
    rp_data <- .analitica_apply_integrated_key_to_data(s$rp_data, rp_inst, base_meta)
    if (exists(".bases_normalize_report_context", mode = "function")) {
      ctx_norm <- .bases_normalize_report_context(rp_data, rp_inst)
      rp_data <- ctx_norm$data
      rp_inst <- ctx_norm$inst
    }
    # ADR 0030 Fase 3: si la base activa es hija repeat, enriquecerla con la
    # caracterización de la madre (join many-to-one) y anotar el grano.
    enriched <- .analitica_repeat_enrich_active(sid, rp_inst, rp_data)
    return(list(
      rp_inst = enriched$rp_inst,
      rp_data = enriched$rp_data
    ))
  }
  prepared <- tryCatch(.analitica_prepare_and_cache(sid), error = function(e) NULL)
  if (!is.null(prepared)) {
    enriched <- .analitica_repeat_enrich_active(sid, prepared$rp_inst, prepared$rp_data)
    return(list(rp_inst = enriched$rp_inst, rp_data = enriched$rp_data))
  }
  stop_api(409, "E_ANALITICA_NO_PREP", "Primero corre el Paso 1 (Preparar datos para reporte).")
}

.load_rp_sources <- function(sid) {
  .analitica_repair_project_context(sid)
  s <- session_get(sid, required = FALSE)
  # Publica el override de etiquetas del proyecto en el env ambiente para que
  # la normalización de fuentes (capa de instrumento) lo aplique. Cubre también
  # procesos que reconstruyen la sesión (jobs). NO-OP sin override persistido.
  if (exists(".label_overrides_activate", mode = "function")) {
    tryCatch(.label_overrides_activate((s %||% list())$label_overrides), error = function(e) NULL)
  }
  cfg <- .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  cache_matches <- .analitica_cached_source_matches(s, .analitica_source_cache_key(sid, fuente))
  data_sources <- if (isTRUE(cache_matches) &&
                      !is.null(s$analitica_rp_data_sources) &&
                      length(s$analitica_rp_data_sources) > 0L) {
    s$analitica_rp_data_sources
  } else {
    list()
  }
  inst_sources <- if (isTRUE(cache_matches) &&
                      !is.null(s$analitica_rp_inst_sources) &&
                      length(s$analitica_rp_inst_sources) > 0L) {
    s$analitica_rp_inst_sources
  } else {
    list()
  }
  if (!.analitica_sources_usable(data_sources, inst_sources)) {
    prepared <- tryCatch(.analitica_prepare_and_cache(sid), error = function(e) NULL)
    if (!is.null(prepared)) {
      data_sources <- prepared$data_sources
      inst_sources <- prepared$inst_sources
    }
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
  inst_sources <- .analitica_patch_inst_sources_integrated(sid, inst_sources[names(data_sources)])
  data_sources <- .analitica_patch_data_sources_integrated(sid, data_sources, inst_sources)
  # ADR 0030 Fase 3: enriquecer las bases hija repeat con la caracterización de
  # su madre (join many-to-one) antes de normalizar, para que el cruce hija×madre
  # (srv_* × sexo/edad) tenga las columnas y el picker de la hija las liste.
  enriched <- .analitica_enrich_repeat_child_with_parent(sid, data_sources, inst_sources)
  data_sources <- enriched$data_sources
  inst_sources <- enriched$inst_sources
  if (exists(".bases_normalize_source_contexts", mode = "function")) {
    normalized <- .bases_normalize_source_contexts(data_sources, inst_sources)
    data_sources <- normalized$data_sources
    inst_sources <- normalized$inst_sources
  }
  contracted <- instrument_analysis_apply_sources(s, data_sources, inst_sources)
  list(
    data_sources = contracted$data_sources,
    inst_sources = contracted$inst_sources,
    instrument_analysis_audits = contracted$audits,
    instrument_analysis_warnings = as.list(contracted$warnings)
  )
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

# Topologías en las que cada base trae su propio instrumento. Ver ADR 0061: en
# ellas un nombre de variable NO identifica la misma pregunta entre bases —
# medido en Acreditación Contabilidad, `p13_1` es «¿Conoce el servicio de salud?»
# (Sí/No) en docentes y la batería de satisfacción (4 puntos) en estudiantes—,
# así que una config compartida aplica overrides de una base sobre otra.
# `single`/`integrated` describen lo contrario: un solo instrumento, nombres
# comparables, config del estudio.
.ANALITICA_TOPOLOGIAS_POR_BASE <- c("separate", "independent")

# ¿La config de Analítica de ESTE estudio pertenece a cada base? Predicado
# aparte de `.analitica_scoped_base()` porque Gráficos lo necesita para resolver
# la config de una base que NO es la activa (ADR 0061): sin él, cada consumidor
# volvería a inventar la regla y a caer en la global por su cuenta.
.analitica_config_es_por_base <- function(sid) {
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid)) {
    return(TRUE)
  }
  # ADR 0061: el modo `multibase` con bases separadas tiene la misma propiedad
  # que `independent_siblings` —instrumentos distintos— y hasta aquí leía la
  # config global. La condición de >1 base evita scopear un estudio de una sola
  # tabla que declaró topología por adelantado.
  if (!exists("estudio_topology", mode = "function")) return(FALSE)
  topology <- as.character(estudio_topology(sid) %||% "")
  if (!(topology %in% .ANALITICA_TOPOLOGIAS_POR_BASE)) return(FALSE)
  s <- session_get(sid, required = FALSE)
  length(((s %||% list())$estudio %||% list())$bases %||% list()) > 1L
}

.analitica_scoped_base <- function(sid) {
  if (!exists("estudio_active_base", mode = "function")) return("")
  if (!.analitica_config_es_por_base(sid)) return("")
  active <- as.character(estudio_active_base(sid) %||% "")
  if (nzchar(active)) active else ""
}

# Config de Analítica que corresponde a UNA base concreta, sea o no la activa.
# `NULL` significa «esta base no tiene config propia y no hereda nada», que es
# justo lo que el ADR 0061 exige de las bases separadas: la global pudo
# escribirse mirando otra base y no hay forma de atribuirla.
.analitica_cfg_para_base <- function(sid, base, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  configs <- s$analitica_config_por_base
  if (is.list(configs) && !is.null(configs[[base]])) return(configs[[base]])
  if (.analitica_config_es_por_base(sid)) return(NULL)
  s$analitica_config
}

.analitica_config_get <- function(sid, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(.analitica_default_config())
  active <- .analitica_scoped_base(sid)
  if (nzchar(active)) {
    configs <- s$analitica_config_por_base
    if (is.list(configs) && !is.null(configs[[active]])) {
      return(configs[[active]])
    }
    # Migracion conservadora: si el proyecto tenia una unica config
    # analitica global, se asigna solo a la base activa inicial.
    #
    # ADR 0061: esta herencia se limita a `independent_siblings`, que es donde
    # nacio y donde el global tiene un dueno unico (la config previa a que ese
    # modo existiera). Las topologias que el 0061 empieza a scopear NO heredan:
    # su global pudo escribirse mirando varias bases —medido en Acreditacion
    # Contabilidad, etiquetas de docentes conviviendo con secciones de
    # estudiantes— y no hay forma de atribuirlo. Se conserva intacto en el
    # estado, sin aplicarse, y la base arranca en el default.
    hereda_global <- exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid)
    if (hereda_global && (is.null(configs) || length(configs) == 0L) &&
        !is.null(s$analitica_config)) {
      configs <- list()
      configs[[active]] <- s$analitica_config
      session_set(sid, "analitica_config_por_base", configs)
      return(s$analitica_config)
    }
    return(.analitica_default_config())
  }
  s$analitica_config %||% .analitica_default_config()
}

# ¿Aplicar la firma de color de recodificaciones en los entregables? Default
# TRUE (feature conocida que estaba rota): configs persistidas antes del flag no
# lo traen y deben seguir coloreando. El FALSE explicito del analista se respeta.
.analitica_color_recod_enabled <- function(cfg) {
  isTRUE((cfg %||% list())$color_recodificaciones %||% TRUE)
}

.analitica_config_set <- function(sid, cfg) {
  active <- .analitica_scoped_base(sid)
  if (nzchar(active)) {
    s <- session_get(sid)
    configs <- s$analitica_config_por_base
    if (is.null(configs) || !is.list(configs)) configs <- list()
    configs[[active]] <- cfg
    session_set(sid, "analitica_config_por_base", configs)
    return(invisible(cfg))
  }
  session_set(sid, "analitica_config", cfg)
  invisible(cfg)
}

.analitica_status_set <- function(sid, key, value = TRUE) {
  session_set(sid, key, value)
  active <- .analitica_scoped_base(sid)
  if (!nzchar(active)) return(invisible(value))
  s <- session_get(sid)
  statuses <- s$analitica_status_por_base
  if (is.null(statuses) || !is.list(statuses)) statuses <- list()
  current <- statuses[[active]]
  if (is.null(current) || !is.list(current)) current <- list()
  current[[key]] <- value
  statuses[[active]] <- current
  session_set(sid, "analitica_status_por_base", statuses)
  invisible(value)
}

# Lee la sub-configuracion analitica_config de la sesión (store del
# frontend autosaveado). En hermanos independientes apunta a la base activa.
.analitica_get_config <- function(sid) {
  cfg <- .analitica_config_get(sid)
  # Exponer el orden de las flechas ↑/↓ del editor de Codificación
  # (`grupos_recod`, solo lectura) para que el orden de la recodificada en la
  # BBDD/codebook lo respete. NO se persiste en la config de Analítica (R copia
  # al mutar; nunca se llama session_set con este cfg aumentado).
  scoped <- tryCatch(.analitica_scoped_base(sid), error = function(e) "")
  cfg$grupos_recod <- tryCatch(
    codif_get(sid, "grupos_recod", source = if (nzchar(scoped)) scoped else NULL) %||% list(),
    error = function(e) list()
  )
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
      m <- regmatches(type, regexec("^select_(?:one|multiple)\\s+(\\S+)", type, perl = TRUE))[[1]]
      ln <- if (length(m) >= 2L) m[2] else ""
    }
  }
  ln
}

# Aplica SOLO los overrides de etiqueta —de pregunta y de opción— sobre un par
# (data, inst). Extraído de `.analitica_apply_data_review()` para que Gráficos
# aplique exactamente los mismos textos sin arrastrar la normalización ni los
# pases de orden, que allá ya corren por su cuenta (ADR 0061). Una etiqueta
# curada que valiera distinto en Analítica y en el PPT es el defecto que esta
# función existe para impedir; por eso hay un solo cuerpo y dos llamantes.
.analitica_apply_label_overrides <- function(data, inst, datos) {
  datos <- datos %||% list()

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

.analitica_apply_data_review <- function(rp_data, rp_inst, cfg) {
  datos <- .analitica_datos_config(cfg)
  data <- rp_data
  inst <- rp_inst
  if (exists(".bases_normalize_report_context", mode = "function")) {
    ctx <- .bases_normalize_report_context(data, inst)
    data <- ctx$data
    inst <- ctx$inst
  }

  aplicado <- .analitica_apply_label_overrides(data, inst, datos)
  data <- aplicado$data
  inst <- aplicado$inst

  dummy_lookup <- .analitica_select_multiple_dummy_lookup(data, inst)
  if (length(dummy_lookup)) {
    for (col in names(dummy_lookup)) {
      if (!col %in% names(data)) next
      meta <- dummy_lookup[[col]]
      opt_label <- as.character(meta$dummy_option_label %||% "")
      if (nzchar(opt_label)) attr(data[[col]], "label") <- opt_label
    }
  }

  if (exists(".bases_normalize_report_context", mode = "function")) {
    ctx <- .bases_normalize_report_context(data, inst)
    data <- ctx$data
    inst <- ctx$inst
  }

  # Orden de la recodificada desde las flechas ↑/↓ de Codificación
  # (`grupos_recod`). Se aplica ANTES que el override de Analítica para que ESE
  # mande (precedencia: choices < grupos_recod < orden_categorias). El pase de
  # valores-especiales-al-final corre después y siempre manda 96/etc. al final.
  grupos_por_parent <- .orden_grupos_recod_por_parent(cfg$grupos_recod)
  if (length(grupos_por_parent)) inst <- .apply_grupos_recod_orden(inst, grupos_por_parent)

  # Orden de categorías definido por el analista (por list_name). Se aplica al
  # final, DESPUÉS de la normalización contra el choices (que re-fija los
  # `names` al orden del instrumento); si se aplicase antes, se pisaría.
  orden_cfg <- .orden_categorias_from_cfg(cfg)
  if (length(orden_cfg)) inst <- .apply_orden_categorias(inst, orden_cfg)

  # `.analitica_order_sm_dummy_cols` prioriza `attr(data,"instrumento_reporte")
  # $orders_list` sobre `inst$orders_list`; reporte_data adjuntó el instrumento
  # ORIGINAL (sin estos overrides). Sincronizar el attr para que el orden de las
  # flechas y del analista fluya a los dummies de la BBDD y el codebook.
  ir <- attr(data, "instrumento_reporte", exact = TRUE)
  if (!is.null(ir) && is.list(ir)) {
    ir$orders_list <- inst$orders_list
    attr(data, "instrumento_reporte") <- ir
  }

  # La codificación deja las columnas (y dummies) en minúscula mientras el survey
  # usa el case original; sin realinear, frecuencias/cruces saltan los
  # select_multiple y sus recodificadas (buscan case-sensitive contra el survey).
  data <- .analitica_restore_survey_case(data, inst)

  # La base real del handoff de Monitoreo arrastra duplicados con prefijo de grupo
  # (`Core.e1_age`↔`E1_age`, `A.a1_leg`↔`A1_leg`, `D.d1_information` madre). Se
  # colapsan: dropea la cruda si es idéntica a su gemelo limpio, y renombra a su
  # nombre del survey las únicas valiosas (`date`, `E1_age_calc`, `time_*`) para
  # que el reorden canónico las reubique. NO toca metadata ni derivadas. Va acá
  # (review compartido) para que la base limpia sea consistente en BBDD, codebook
  # y frecuencias; después de restore_case (gemelos ya en case del survey) y
  # antes del reorden canónico.
  data <- .analitica_base_collapse_group_prefixed_dupes(data, inst)

  # Los dummies de select_multiple se generan en la codificación en orden
  # arbitrario; se reordenan por el orden de la lista de opciones del XLSForm
  # para que la vista "Base final" y el libro de códigos los muestren 1,2,…,96.
  data <- .analitica_order_sm_dummy_cols(data, inst)

  # Los bloques de dummies se apendean al final en la codificación (la madre plana
  # ya no existe, así que nunca vuelven a su sección). Reubica cada bloque a la
  # posición canónica del parent en el survey; las derivadas/metadata quedan al
  # final. NO desordena: impone el orden del instrumento sobre la base adaptada.
  data <- .analitica_order_by_instrument(data, inst)

  list(data = data, inst = inst)
}

.analitica_clean_dummy_name <- function(x) {
  base <- gsub("/", ".", as.character(x))
  base <- iconv(base, from = "", to = "ASCII//TRANSLIT")
  base <- tolower(base)
  base <- gsub(" ", ".", base)
  base <- gsub("[^a-z0-9._]", "_", base)
  base <- gsub("_+", "_", base)
  base <- gsub("\\.+", ".", base)
  gsub("^[_\\.]+|[_\\.]+$", "", base)
}

.analitica_slug_dummy_code <- function(x) {
  out <- iconv(as.character(x), from = "", to = "ASCII//TRANSLIT", sub = "")
  out <- tolower(out)
  out <- gsub("[^a-z0-9]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  out[!nzchar(out)] <- "na"
  out
}

.analitica_find_dummy_col <- function(data_names, parent, code) {
  parent <- as.character(parent %||% "")
  code <- as.character(code %||% "")
  if (!nzchar(parent) || !nzchar(code) || !length(data_names)) return(NA_character_)
  candidates <- unique(c(
    .analitica_clean_dummy_name(paste0(parent, "/", code)),
    .analitica_clean_dummy_name(paste0(parent, ".", code)),
    paste0(parent, "___", .analitica_slug_dummy_code(code)),
    paste0(tolower(parent), "___", .analitica_slug_dummy_code(code))
  ))
  hit <- intersect(candidates, data_names)[1] %||% NA_character_
  if (!is.na(hit) && nzchar(hit)) return(hit)
  data_lower <- stats::setNames(data_names, tolower(data_names))
  hit_lower <- intersect(tolower(candidates), names(data_lower))[1] %||% NA_character_
  if (!is.na(hit_lower) && nzchar(hit_lower)) return(unname(data_lower[[hit_lower]]))
  NA_character_
}

.analitica_var_label <- function(inst, var) {
  var <- as.character(var %||% "")
  if (!nzchar(var)) return("")
  if (!is.null(inst$var_labels) && var %in% names(inst$var_labels)) {
    lab <- as.character(inst$var_labels[[var]])
    if (nzchar(lab)) return(lab)
  }
  i <- .analitica_survey_row(inst, var)
  if (!is.na(i) && !is.null(inst$survey) && "label" %in% names(inst$survey)) {
    lab <- as.character(inst$survey$label[i] %||% "")
    if (!is.na(lab) && nzchar(lab)) return(lab)
  }
  var
}

.analitica_select_multiple_dummy_lookup <- function(data, inst) {
  sv <- inst$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !all(c("name", "type") %in% names(sv))) return(list())
  data_names <- names(data)
  if (!length(data_names)) return(list())
  tipos <- as.character(sv$type %||% "")
  sm_idx <- which(grepl("^select_multiple(\\s|$)", tipos, perl = TRUE))
  if (!length(sm_idx)) return(list())

  out <- list()
  for (i in sm_idx) {
    parent <- as.character(sv$name[i] %||% "")
    if (!nzchar(parent)) next
    list_name <- .analitica_list_name_for_var(inst, parent)
    choices <- if (nzchar(list_name)) {
      .choices_desde_instrumento(inst, list_name)
    } else {
      data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE)
    }
    if (!nrow(choices)) next
    parent_label <- .analitica_var_label(inst, parent)
    for (j in seq_len(nrow(choices))) {
      code <- as.character(choices$name[j] %||% "")
      if (!nzchar(code)) next
      col <- .analitica_find_dummy_col(data_names, parent, code)
      if (is.na(col) || !nzchar(col) || !col %in% data_names) next
      option_label <- as.character(choices$label[j] %||% "")
      if (!nzchar(option_label)) {
        option_label <- as.character(attr(data[[col]], "label", exact = TRUE) %||% code)
      }
      out[[col]] <- list(
        dummy_parent = parent,
        dummy_parent_label = parent_label,
        dummy_option_code = code,
        dummy_option_label = option_label
      )
    }
  }
  out
}

.analitica_data_review_payload <- function(rp_data, rp_inst, cfg) {
  reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
  data <- reviewed$data
  inst <- reviewed$inst

  # ADR 0061: `label_original` tiene que decir lo que dice el instrumento, no el
  # override. `.analitica_apply_data_review()` reescribe `attr(col, "label")` y
  # `inst$survey$label`, así que leerlos después devolvía el texto EDITADO en los
  # dos campos: la pantalla no podía mostrar de qué se está separando el analista
  # y «Restaurar etiquetas originales» perdía su referencia visible.
  #
  # La segunda pasada sólo se paga cuando hay overrides. Sin ellos los dos
  # valores coinciden por definición y basta con leer la columna ya revisada.
  datos_cfg <- .analitica_datos_config(cfg)
  labels_base <- list()
  if (length(datos_cfg$variable_labels) || length(datos_cfg$value_labels)) {
    cfg_sin_overrides <- cfg
    cfg_sin_overrides$datos$variable_labels <- NULL
    cfg_sin_overrides$datos$value_labels <- NULL
    base_pair <- tryCatch(
      .analitica_apply_data_review(rp_data, rp_inst, cfg_sin_overrides),
      error = function(e) NULL
    )
    if (!is.null(base_pair)) {
      for (nm_base in names(base_pair$data)) {
        lab <- attr(base_pair$data[[nm_base]], "label", exact = TRUE)
        if (!is.null(lab)) labels_base[[nm_base]] <- as.character(lab)[1]
      }
    }
  }
  dummy_lookup <- .analitica_select_multiple_dummy_lookup(data, inst)
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
  known_extra_cols <- c(
    "survey_id", "collector_id", "respondent_id", "response_id", "case_uid",
    "source_title", "response_status", "collection_mode", "date_created",
    "date_modified", "empresa_source_code", "empresa_source_label", "empresa_uid"
  )
  var_names <- vapply(vars, function(v) as.character(v$name %||% ""), character(1))
  data_extra <- setdiff(names(data), c(var_names, names(dummy_lookup)))
  data_extra <- data_extra[!data_extra %in% known_extra_cols]
  data_extra <- data_extra[!grepl("^Pag[0-9]+$", data_extra)]
  data_extra <- data_extra[!grepl("^(nota|note)_", data_extra, ignore.case = TRUE)]
  data_extra <- data_extra[vapply(data_extra, function(nm) {
    col <- data[[nm]]
    any(!is.na(col) & nzchar(as.character(col)))
  }, logical(1))]
  all_names <- unique(c(var_names, names(dummy_lookup), data_extra))
  all_names <- all_names[nzchar(all_names)]
  lapply(all_names, function(nm) {
    col <- if (nm %in% names(data)) data[[nm]] else NULL
    dummy_meta <- dummy_lookup[[nm]] %||% NULL
    vmeta <- by_name[[nm]] %||% list(name = nm, label = "", tipo = "", list_name = "")
    original_label <- if (!is.null(labels_base[[nm]])) {
      labels_base[[nm]]
    } else if (!is.null(col)) {
      attr(col, "label", exact = TRUE) %||% ""
    } else ""
    if (!is.null(dummy_meta) && !nzchar(as.character(original_label))) {
      original_label <- as.character(dummy_meta$dummy_option_label %||% "")
    }
    if (!nzchar(as.character(original_label))) original_label <- as.character(vmeta$label %||% "")
    if (!nzchar(original_label)) original_label <- nm
    tipo_xlsform <- as.character(vmeta$tipo %||% "")
    if (!nzchar(tipo_xlsform) && !is.null(dummy_meta)) tipo_xlsform <- "dummy_select_multiple"
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
    if (length(opts) > 80L) {
      opts_present <- Filter(function(opt) isTRUE(as.integer(opt$count %||% 0L) > 0L), opts)
      opts <- if (length(opts_present) > 0L) opts_present else utils::head(opts, 80L)
    }
    list(
      name = nm,
      tipo_xlsform = tipo_xlsform,
      seccion = as.character(
        if (!is.null(dummy_meta)) {
          section_by_var[[as.character(dummy_meta$dummy_parent %||% "")]] %||% "General"
        } else {
          section_by_var[[nm]] %||% "General"
        }
      ),
      included = !nm %in% cfg_excluidas,
      label_actual = as.character(attr(col, "label", exact = TRUE) %||% original_label),
      label_original = as.character(original_label),
      n_non_missing = if (!is.null(col)) as.integer(sum(!is.na(col) & nzchar(as.character(col)))) else 0L,
      n_missing = if (!is.null(col)) as.integer(sum(is.na(col) | !nzchar(as.character(col)))) else 0L,
      opciones = opts,
      dummy_parent = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_parent %||% "") else NA_character_,
      dummy_parent_label = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_parent_label %||% "") else NA_character_,
      dummy_option_code = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_option_code %||% "") else NA_character_,
      dummy_option_label = if (!is.null(dummy_meta)) as.character(dummy_meta$dummy_option_label %||% "") else NA_character_
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
    parsed <- vapply(type[hit], function(tp) {
      m <- regmatches(tp, regexec("^select_(?:one|multiple)\\s+(\\S+)", tp, perl = TRUE))[[1]]
      if (length(m) >= 2L) m[2] else ""
    }, character(1))
    out <- c(out, parsed)
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

.analitica_write_final_xlsform <- function(rp_inst, path, color_recod = FALSE) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para exportar el XLSForm final.", call. = FALSE)
  }
  survey <- .analitica_xlsform_sheet_df(rp_inst$survey_raw %||% rp_inst$survey, c("type", "name", "label"))
  choices <- .analitica_xlsform_sheet_df(rp_inst$choices_raw %||% rp_inst$choices, c("list_name", "name", "label"))
  settings <- .analitica_xlsform_sheet_df(rp_inst$settings, c("form_title", "form_id"))
  .analitica_write_xlsform_sheets(
    list(survey = survey, choices = choices, settings = settings),
    path, color_recod = color_recod
  )
}

# Escritor compartido del XLSForm (survey/choices/settings + hojas extra) con la
# firma de color de recodificaciones opcional. Es el UNICO punto de export que
# decide el color, gated por `color_recod`: asi el mismo archivo sale coloreado
# (ON) o limpio (OFF) sin depender de si la codificacion pinto el archivo fuente.
.analitica_write_xlsform_sheets <- function(sheets, path, color_recod = FALSE) {
  wb <- openxlsx::createWorkbook(creator = "prosecnur")
  header_style <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
  text_style <- openxlsx::createStyle(numFmt = "@")
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
  if (isTRUE(color_recod)) .analitica_paint_xlsform_recods(wb, sheets)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

# Pinta las filas `_recod` del `survey` (por tipo: SM verde, SO azul, INTEGER
# morado) y sus choice-lists nuevas con la paleta canonica. Idempotente:
# stack = TRUE apila el relleno sobre el formato base ya escrito.
.analitica_paint_xlsform_recods <- function(wb, sheets) {
  survey <- sheets$survey
  if (is.null(survey) || !all(c("type", "name") %in% names(survey)) || nrow(survey) == 0L) {
    return(invisible(NULL))
  }
  pal <- pulso_recod_palette()
  is_recod <- pulso_recod_is_name(survey$name)
  types <- vapply(as.character(survey$type), pulso_recod_type_from_xlsform, character(1))
  list_of <- vapply(as.character(survey$type), .extract_listname, character(1))
  # Fila del survey: matiz un pelo mas marcado (row) que la superficie (choices).
  surf <- c(sm = pal$sm_row, so = pal$so_row, int = pal$int_row)
  chc  <- c(sm = pal$sm,     so = pal$so,     int = pal$int)

  # survey: fila por tipo (+1 por el encabezado del XLSX).
  for (tp in c("sm", "so", "int")) {
    rows <- which(is_recod & !is.na(types) & types == tp)
    if (length(rows)) {
      openxlsx::addStyle(wb, "survey", pulso_recod_fill_style(surf[[tp]]),
                         rows = rows + 1L, cols = seq_len(ncol(survey)),
                         gridExpand = TRUE, stack = TRUE)
    }
  }

  # choices: mapea list_name -> tipo desde las filas recod del survey (cuando el
  # `type` conserva el list_name). Si el type viene "stripped" (p.ej. el XLSForm
  # reconstruido desde rp_inst), la lista igual se colorea por su nombre `_recod`
  # con el color generico. Asi el instrumento real sale por-tipo y el
  # reconstruido no queda sin firma.
  choices <- sheets$choices
  if (!is.null(choices) && "list_name" %in% names(choices) && nrow(choices) > 0L) {
    ln_type <- list()  # list: `[[missing]]` devuelve NULL (un vector atomico
    # reventaria con "subscript out of bounds").
    for (r in which(is_recod)) {
      ln <- list_of[r]
      if (!is.na(ln) && nzchar(ln) && !is.na(types[r])) ln_type[[ln]] <- types[r]
    }
    # Fallback para el XLSForm reconstruido (type stripped): resuelve el tipo de
    # la lista `_recod` por su nombre contra el mapa nombre_var->tipo del survey.
    type_map <- pulso_recod_type_map(survey)
    cl <- as.character(choices$list_name)
    candidates <- unique(c(names(ln_type), cl[pulso_recod_is_name(cl)]))
    for (ln in candidates) {
      crows <- which(cl == ln)
      if (!length(crows)) next
      tp <- ln_type[[ln]]
      if (is.null(tp) || !(tp %in% names(chc))) tp <- pulso_recod_resolve_type(ln, type_map)
      hex <- if (!is.null(tp) && !is.na(tp) && tp %in% names(chc)) chc[[tp]] else pal$generic
      openxlsx::addStyle(wb, "choices", pulso_recod_fill_style(hex),
                         rows = crows + 1L, cols = seq_len(ncol(choices)),
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  invisible(NULL)
}

# Lee todas las hojas de un XLSForm como data.frames de texto (preserva codigos
# como "1"/"01" sin coerciones). Se usa para re-emitir el instrumento adaptado
# con la firma de color al exportarlo.
.analitica_read_xlsform_all_sheets <- function(path) {
  sn <- readxl::excel_sheets(path)
  stats::setNames(lapply(sn, function(s) {
    as.data.frame(
      readxl::read_excel(path, sheet = s, col_types = "text"),
      stringsAsFactors = FALSE, check.names = FALSE
    )
  }), sn)
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
	    # Firma de color de recodificaciones en los entregables (instrumento
	    # codificado, BBDD xlsx, libro de codigos). Default TRUE: los `_recod`
	    # salen resaltados con la paleta pastel. El switch (frontend) lo apaga.
	    color_recodificaciones = TRUE,
	    ficha_tecnica = list(),
	    secciones = list(),
	    numericas = list(),
	    variables_excluidas = list(),
	    # Reconciliación data↔XLSForm: extra sustantivas que el usuario decidió
	    # INCLUIR en la BBDD (default vacío = todas las extra excluidas). Scopeado
	    # por base como el resto de la config. Ver reconciliacion_variables.R.
	    variables_extra_incluidas = list(),
	    # Override por list_name de ordinalidad (analista). Ausente = auto.
	    listas_ordinales = stats::setNames(list(), character(0)),
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
      # Default TRUE (metodológico): muestra TODAS las categorías del catálogo,
      # con 0 donde nadie marcó (escala completa). El usuario puede apagarlo y su
      # FALSE explícito se respeta.
      mostrar_todo = TRUE,
      incluir_titulos = TRUE,
      incluir_secciones = TRUE
    ),
    multibase = list(
      global = list(
        incluir_porcentajes = TRUE,
        incluir_secciones = TRUE
      ),
      origenes = list(
        incluir_porcentajes = TRUE,
        incluir_secciones = TRUE
      )
    ),
    panel = list(
      key = "",
      waves = list(),
      nse = list(
        enabled = TRUE,
        variables = as.list(c("nse", "nse_inei", "nse_atribuido", "nse_inferencia"))
      ),
      outputs = list(
        codebook = TRUE,
        frecuencias = TRUE,
        auditoria = TRUE,
        cobertura_nse = TRUE
      )
    ),
    cruces = list(
      cruces_vars = list(),
      modo = "estandar",
      orden = "original",
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

.analitica_json_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
  if (!nzchar(body_raw)) return(list())
  Encoding(body_raw) <- "UTF-8"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

.analitica_ficha_field_defs <- function() {
  list(
    list(key = "tipo_investigacion", label = "Tipo de investigación", group = "Diseño", min_lines = 2L,
         hint = "Describe el enfoque del estudio en términos metodológicos, sin referencias internas al sistema."),
    list(key = "estudio", label = "Estudio", group = "Identificación", min_lines = 1L,
         hint = "Nombre público del estudio o investigación."),
    list(key = "universo_estudio", label = "Universo de estudio", group = "Diseño", min_lines = 2L,
         hint = "Población objetivo a la que se refiere la medición."),
    list(key = "base_analisis", aliases = c("base_de_analisis"), label = "Base de análisis", group = "Diseño", min_lines = 3L,
         hint = "Unidad de análisis, mediciones incluidas y alcance del archivo final."),
    list(key = "criterios_inclusion", aliases = c("criterios_de_inclusion"), label = "Criterios de inclusión", group = "Diseño", min_lines = 3L,
         hint = "Condiciones que debía cumplir una persona, vivienda o punto muestral para formar parte del estudio."),
    list(key = "ambito_geografico", label = "Ámbito geográfico", group = "Cobertura", min_lines = 2L,
         hint = "Territorio cubierto por la investigación."),
    list(key = "distritos_seleccionados", aliases = c("distritos_muestra", "distritos"), label = "Distritos seleccionados", group = "Cobertura", min_lines = 2L,
         hint = "Distritos o zonas efectivamente considerados en el diseño."),
    list(key = "aplicacion_recojo", aliases = c("aplicacion_de_encuestas", "aplicacion_del_recojo_de_informacion"), label = "Aplicación de encuestas", group = "Campo", min_lines = 2L,
         hint = "Periodo o forma de recojo reportable para la ficha."),
    list(key = "marco_muestral", label = "Marco muestral", group = "Muestra", min_lines = 4L,
         hint = "Fuente y unidades usadas para seleccionar la muestra."),
    list(key = "tamano_de_la_muestra", aliases = c("tamano_muestra"), label = "Tamaño de la muestra", group = "Muestra", min_lines = 3L,
         hint = "Tamaño programado y/o efectivo de la muestra, según corresponda."),
    list(key = "procedimiento_muestreo", aliases = c("procedimiento_de_muestreo"), label = "Procedimiento de muestreo", group = "Muestra", min_lines = 6L,
         hint = "Etapas del diseño muestral, redactadas como procedimiento académico."),
    list(key = "nivel_representatividad", aliases = c("nivel_de_representatividad"), label = "Nivel de representatividad", group = "Muestra", min_lines = 3L,
         hint = "Alcance inferencial, nivel de confianza y margen estimado si están documentados."),
    list(key = "ponderacion", label = "Ponderación", group = "Muestra", min_lines = 2L,
         hint = "Criterio de ponderación o ausencia de ponderación, si corresponde."),
    list(key = "instrumento", label = "Instrumento", group = "Instrumento", min_lines = 3L,
         hint = "Tipo de cuestionario y rasgos generales del instrumento."),
    list(key = "tecnica_aplicacion", aliases = c("tecnica_de_aplicacion"), label = "Técnica de aplicación", group = "Campo", min_lines = 2L,
         hint = "Modalidad de aplicación usada en campo."),
    list(key = "supervision_control", aliases = c("supervision_de_mesa", "supervision_de_campo"), label = "Supervisión y control de calidad", group = "Procesamiento", min_lines = 2L,
         hint = "Controles sustantivos aplicados a la información."),
    list(key = "digitacion_procesamiento", aliases = c("digitacion"), label = "Digitación / procesamiento", group = "Procesamiento", min_lines = 2L,
         hint = "Proceso de digitación, consistencia y preparación de bases."),
    list(key = "plan_limpieza", aliases = c("plan_de_limpieza_de_datos_y_consistencia"), label = "Plan de limpieza de datos y consistencia", group = "Procesamiento", min_lines = 3L,
         hint = "Criterios de revisión, anonimización y tratamiento de inconsistencias."),
    list(key = "entregables", label = "Entregables", group = "Entrega", min_lines = 2L,
         hint = "Archivos metodológicos y analíticos que se entregarán.")
  )
}

.analitica_ficha_lookup <- function(ft, key, aliases = character(0)) {
  keys <- unique(c(key, aliases))
  for (k in keys) {
    value <- .ficha_tecnica_scalar((ft %||% list())[[k]], "")
    if (nzchar(value)) return(value)
  }
  ""
}

.analitica_ficha_number <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NA_real_)
  out <- suppressWarnings(as.numeric(x[[1]]))
  if (!is.finite(out)) NA_real_ else out
}

.analitica_ficha_fmt_int <- function(x) {
  x <- .analitica_ficha_number(x)
  if (!is.finite(x)) return("")
  format(round(x), big.mark = ",", scientific = FALSE, trim = TRUE)
}

.analitica_ficha_fmt_pct <- function(x) {
  x <- .analitica_ficha_number(x)
  if (!is.finite(x)) return("")
  if (abs(x) <= 1) x <- x * 100
  sprintf("%.1f%%", x)
}

.analitica_ficha_panel_build <- function(sid, cfg) {
  if (!exists(".analitica_panel_load_sources", mode = "function") ||
      !exists(".panel_wide_build", mode = "function") ||
      !exists(".panel_ficha_context", mode = "function")) {
    return(NULL)
  }
  sources <- tryCatch(.analitica_panel_load_sources(sid, cfg), error = function(e) NULL)
  if (is.null(sources) || length(sources$data_sources %||% list()) < 2L) return(NULL)
  built <- tryCatch(.panel_wide_build(sources$data_sources, sources$inst_sources, cfg$panel %||% list()), error = function(e) NULL)
  if (is.null(built)) return(NULL)
  list(built = built, sources = sources)
}

.analitica_ficha_contextual_cfg <- function(sid, cfg, include_panel = TRUE) {
  cfg <- cfg %||% .analitica_get_config(sid)
  cfg$ficha_tecnica <- cfg$ficha_tecnica %||% list()
  ft <- cfg$ficha_tecnica
  s <- session_get(sid, required = FALSE)

  if (!is.null(s$hojas_ruta_workspace_outputs) &&
      is.null(ft$hojas_ruta_context) &&
      is.null(ft$hojas_ruta_pulso_path)) {
    ft$hojas_ruta_context <- list(
      hojas_ruta_config = s$hojas_ruta_config %||% list(),
      hojas_ruta_workspace_outputs = s$hojas_ruta_workspace_outputs %||% list()
    )
  }

  if (!is.null(s$calc_muestra_estudio) &&
      is.null(ft$calc_muestra_context) &&
      is.null(ft$calc_muestra_pulso_path)) {
    ft$calc_muestra_context <- list(calc_muestra_estudio = s$calc_muestra_estudio)
  }

  if (isTRUE(include_panel) && is.null(ft$panel_context)) {
    panel_bundle <- .analitica_ficha_panel_build(sid, cfg)
    if (!is.null(panel_bundle)) {
      ft$panel_context <- .panel_ficha_context(panel_bundle$built, panel_bundle$sources$data_sources)
    }
  }

  cfg$ficha_tecnica <- ft
  cfg
}

.analitica_ficha_panel_hint <- function(sid, cfg) {
  s <- session_get(sid, required = FALSE)
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  n_bases <- length(bases)
  if (n_bases < 2L) {
    return(list(
      available = FALSE,
      detail = "Sin base panel consolidable en la sesión."
    ))
  }

  panel_cfg <- (cfg %||% list())$panel %||% list()
  key <- .ficha_tecnica_scalar(panel_cfg$key, "")
  if (!nzchar(key)) {
    return(list(
      available = FALSE,
      detail = sprintf("%s mediciones detectadas; confirma la llave panel para calcular el resumen longitudinal.", n_bases)
    ))
  }

  list(
    available = TRUE,
    detail = sprintf("%s mediciones detectadas; el resumen longitudinal se calculará al generar la ficha.", n_bases)
  )
}

.analitica_ficha_suggestions_cfg <- function(cfg) {
  cfg_suggest <- cfg %||% list()
  cfg_suggest$ficha_tecnica <- cfg_suggest$ficha_tecnica %||% list()
  defs <- .analitica_ficha_field_defs()
  for (def in defs) {
    for (k in unique(c(def$key, def$aliases %||% character(0)))) {
      cfg_suggest$ficha_tecnica[[k]] <- NULL
    }
  }
  if (exists(".ficha_tecnica_cfg_with_hojas_ruta", mode = "function")) {
    cfg_suggest <- .ficha_tecnica_cfg_with_hojas_ruta(cfg_suggest)
  }
  cfg_suggest
}

.analitica_ficha_kpis <- function(cfg) {
  ft <- (cfg %||% list())$ficha_tecnica %||% list()
  out <- list()
  add <- function(label, value, source, detail = "") {
    value <- .ficha_tecnica_scalar(value, "")
    if (!nzchar(value)) return(NULL)
    out[[length(out) + 1L]] <<- list(label = label, value = value, source = source, detail = detail)
    invisible(NULL)
  }

  hr <- if (exists(".ficha_tecnica_hojas_ruta_summary", mode = "function")) {
    tryCatch(.ficha_tecnica_hojas_ruta_summary(ft$hojas_ruta_context %||% ft$hojas_ruta_pulso_path), error = function(e) NULL)
  } else NULL
  calc <- if (exists(".ficha_tecnica_calc_muestra_summary", mode = "function")) {
    tryCatch(.ficha_tecnica_calc_muestra_summary(ft$calc_muestra_context %||% ft$calc_muestra_pulso_path), error = function(e) NULL)
  } else NULL
  panel <- if (exists(".ficha_tecnica_panel_summary", mode = "function")) {
    tryCatch(.ficha_tecnica_panel_summary(ft$panel_context), error = function(e) NULL)
  } else NULL

  if (!is.null(hr)) {
    add("Manzanas titulares", .analitica_ficha_fmt_int(hr$n_blocks), "Hojas de ruta", "Unidades primarias seleccionadas")
    add("Manzanas de reemplazo", .analitica_ficha_fmt_int(hr$n_replacements), "Hojas de ruta", "Reemplazos territoriales documentados")
    add("Encuestas programadas", .analitica_ficha_fmt_int(hr$total_interviews), "Hojas de ruta", "Carga total prevista por rutas")
    add("Distritos", .analitica_ficha_fmt_int(hr$n_districts), "Hojas de ruta", "Cobertura distrital registrada")
    add("Margen estimado", .analitica_ficha_fmt_pct(hr$margin_total_estimated), "Hojas de ruta", "Precisión esperada del diseño")
  }
  if (!is.null(calc)) {
    add("Componentes muestrales", .analitica_ficha_fmt_int(calc$n_componentes), "Cálculo de muestra", "Componentes definidos en el cálculo")
    add("Muestra calculada", .analitica_ficha_fmt_int(calc$total_n_objetivo), "Cálculo de muestra", "Total previsto por el cálculo")
  }
  if (!is.null(panel)) {
    add("Personas longitudinales", .analitica_ficha_fmt_int(panel$n_panel_keys), "Base panel", "Llaves únicas consolidadas")
    add("Casos completos", .analitica_ficha_fmt_int(panel$n_complete_keys), "Base panel", "Personas presentes en todas las mediciones")
    add("Mediciones", .analitica_ficha_fmt_int(length(panel$waves %||% list())), "Base panel", "Bases integradas longitudinalmente")
  }
  out
}

.analitica_ficha_sources <- function(cfg, panel_hint = NULL) {
  ft <- (cfg %||% list())$ficha_tecnica %||% list()
  panel_hint <- panel_hint %||% list()
  hr_ok <- !is.null(ft$hojas_ruta_context) || nzchar(.ficha_tecnica_scalar(ft$hojas_ruta_pulso_path, ""))
  calc_ok <- !is.null(ft$calc_muestra_context) || nzchar(.ficha_tecnica_scalar(ft$calc_muestra_pulso_path, ""))
  panel_ok <- !is.null(ft$panel_context)
  panel_detail <- if (isTRUE(panel_ok)) {
    "Resumen de mediciones y cobertura panel disponible."
  } else {
    .ficha_tecnica_scalar(panel_hint$detail, "Sin base panel consolidable en la sesión.")
  }
  list(
    list(key = "hojas_ruta", label = "Hojas de ruta", available = isTRUE(hr_ok),
         detail = if (isTRUE(hr_ok)) "Diseño territorial, rutas y distribución operativa disponibles." else "Sin contexto de rutas en la sesión."),
    list(key = "calc_muestra", label = "Cálculo de muestra", available = isTRUE(calc_ok),
         detail = if (isTRUE(calc_ok)) "Parámetros muestrales disponibles." else "Sin cálculo de muestra asociado."),
    list(key = "panel", label = "Base longitudinal", available = isTRUE(panel_ok) || isTRUE(panel_hint$available),
         detail = panel_detail)
  )
}

.analitica_ficha_info <- function(sid, cfg = NULL) {
  cfg_ctx <- .analitica_ficha_contextual_cfg(sid, cfg %||% .analitica_get_config(sid), include_panel = FALSE)
  panel_hint <- .analitica_ficha_panel_hint(sid, cfg_ctx)
  cfg_suggest <- .analitica_ficha_suggestions_cfg(cfg_ctx)
  current_ft <- cfg_ctx$ficha_tecnica %||% list()
  suggest_ft <- cfg_suggest$ficha_tecnica %||% list()
  defs <- .analitica_ficha_field_defs()
  fields <- lapply(defs, function(def) {
    aliases <- def$aliases %||% character(0)
    value <- .analitica_ficha_lookup(current_ft, def$key, aliases)
    suggested <- .analitica_ficha_lookup(suggest_ft, def$key, aliases)
    list(
      key = def$key,
      label = def$label,
      group = def$group,
      hint = def$hint %||% "",
      min_lines = def$min_lines %||% 2L,
      value = value,
      suggested = suggested,
      has_suggestion = nzchar(suggested)
    )
  })
  subtables <- names((cfg_suggest$ficha_tecnica %||% list())$subtables %||% list())
  appendices <- names((cfg_suggest$ficha_tecnica %||% list())$appendices %||% list())
  list(
    ok = TRUE,
    fields = fields,
    kpis = .analitica_ficha_kpis(cfg_suggest),
    sources = .analitica_ficha_sources(cfg_ctx, panel_hint = panel_hint),
    tables = list(subtables = as.list(subtables), appendices = as.list(appendices)),
    layout = .ficha_tecnica_scalar(current_ft$layout, "pulso_oficial")
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
      cfg <- .analitica_config_get(sid, s)
      # Hidratar defaults de campos nuevos para configs persistidas antes de su
      # introducción (el frontend keya contra estos nombres exactos).
      if (is.null(cfg$listas_ordinales)) cfg$listas_ordinales <- stats::setNames(list(), character(0))
      if (is.null(cfg$cruces)) cfg$cruces <- list()
      if (is.null(cfg$cruces$orden)) cfg$cruces$orden <- "original"
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
      prev_fuente <- as.character((.analitica_config_get(sid, s_prev) %||% list())$fuente_preferida %||% "")
      next_fuente <- as.character((cfg %||% list())$fuente_preferida %||% "")
      prev_panel_json <- jsonlite::toJSON((.analitica_config_get(sid, s_prev) %||% list())$panel %||% list(), auto_unbox = TRUE, null = "null")
      next_panel_json <- jsonlite::toJSON((cfg %||% list())$panel %||% list(), auto_unbox = TRUE, null = "null")
      prev_ficha_json <- jsonlite::toJSON((.analitica_config_get(sid, s_prev) %||% list())$ficha_tecnica %||% list(), auto_unbox = TRUE, null = "null")
      next_ficha_json <- jsonlite::toJSON((cfg %||% list())$ficha_tecnica %||% list(), auto_unbox = TRUE, null = "null")
      prev_pond_json <- jsonlite::toJSON((.analitica_config_get(sid, s_prev) %||% list())$ponderacion %||% list(), auto_unbox = TRUE, null = "null")
      next_pond_json <- jsonlite::toJSON((cfg %||% list())$ponderacion %||% list(), auto_unbox = TRUE, null = "null")
      prev_orden_json <- jsonlite::toJSON((.analitica_config_get(sid, s_prev) %||% list())$orden_categorias %||% list(), auto_unbox = TRUE, null = "null")
      next_orden_json <- jsonlite::toJSON((cfg %||% list())$orden_categorias %||% list(), auto_unbox = TRUE, null = "null")
      prev_ord_lists_json <- jsonlite::toJSON((.analitica_config_get(sid, s_prev) %||% list())$listas_ordinales %||% list(), auto_unbox = TRUE, null = "null")
      next_ord_lists_json <- jsonlite::toJSON((cfg %||% list())$listas_ordinales %||% list(), auto_unbox = TRUE, null = "null")
      prev_cruces_orden <- as.character(((.analitica_config_get(sid, s_prev) %||% list())$cruces %||% list())$orden %||% "original")
      next_cruces_orden <- as.character(((cfg %||% list())$cruces %||% list())$orden %||% "original")
      .analitica_config_set(sid, cfg)
      if (!identical(prev_fuente, next_fuente)) {
        .analitica_status_set(sid, "analitica_prep_ok", FALSE)
        .analitica_status_set(sid, "analitica_codebook_ok", FALSE)
        .analitica_status_set(sid, "analitica_frecuencias_ok", FALSE)
        .analitica_status_set(sid, "analitica_cruces_ok", FALSE)
        .analitica_status_set(sid, "analitica_spss_ok", FALSE)
        .analitica_status_set(sid, "analitica_dim_ok", FALSE)
        .analitica_status_set(sid, "analitica_panel_ok", FALSE)
        .analitica_status_set(sid, "analitica_ficha_tecnica_ok", FALSE)
        session_set(sid, "analitica_rp_inst", NULL)
        session_set(sid, "analitica_rp_data", NULL)
        session_set(sid, "analitica_rp_inst_sources", list())
        session_set(sid, "analitica_rp_data_sources", list())
        session_set(sid, "analitica_multibase_available", FALSE)
      } else if (!identical(as.character(prev_panel_json), as.character(next_panel_json))) {
        .analitica_status_set(sid, "analitica_panel_ok", FALSE)
        .analitica_status_set(sid, "analitica_ficha_tecnica_ok", FALSE)
      } else if (!identical(as.character(prev_ficha_json), as.character(next_ficha_json))) {
        .analitica_status_set(sid, "analitica_ficha_tecnica_ok", FALSE)
      }
      # Cambiar la ponderacion invalida todo lo que se calcula ponderado.
      if (!identical(as.character(prev_pond_json), as.character(next_pond_json))) {
        .analitica_status_set(sid, "analitica_frecuencias_ok", FALSE)
        .analitica_status_set(sid, "analitica_cruces_ok", FALSE)
        .analitica_status_set(sid, "analitica_dim_ok", FALSE)
        .analitica_status_set(sid, "analitica_ficha_tecnica_ok", FALSE)
      }
      # Cambiar el orden de categorías invalida las tablas ya generadas (su
      # secuencia de filas cambia). No afecta cómputos ponderados ni dimensiones.
      if (!identical(as.character(prev_orden_json), as.character(next_orden_json))) {
        .analitica_status_set(sid, "analitica_frecuencias_ok", FALSE)
        .analitica_status_set(sid, "analitica_cruces_ok", FALSE)
        .analitica_status_set(sid, "analitica_spss_ok", FALSE)
      }
      # Marcar listas como ordinales cambia el orden de filas de frecuencias y
      # cruces (esas listas dejan de ordenarse por conteo).
      if (!identical(as.character(prev_ord_lists_json), as.character(next_ord_lists_json))) {
        .analitica_status_set(sid, "analitica_frecuencias_ok", FALSE)
        .analitica_status_set(sid, "analitica_cruces_ok", FALSE)
      }
      # Cambiar el orden por frecuencia de cruces invalida solo cruces.
      if (!identical(prev_cruces_orden, next_cruces_orden)) {
        .analitica_status_set(sid, "analitica_cruces_ok", FALSE)
      }
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_post("/api/analitica/ponderacion/preview", wrap_endpoint(function(req, res, ...) {
      # Preview en vivo de la ponderacion sobre la base real, sin persistir.
      # El body puede traer una config candidata { ponderacion: {...} }; si no,
      # usa la guardada en analitica_config.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      pond <- NULL
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE), error = function(e) NULL)
        if (is.list(parsed)) pond <- parsed$ponderacion %||% parsed$config$ponderacion %||% parsed
      }
      .analitica_ponderacion_preview(sid, pond)
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
        config = .analitica_config_get(sid, s)
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
	      # Auto-detección de ordinalidad por list_name (mismo valor para todas
	      # las variables que comparten lista). El frontend keya `list_ordinal_auto`.
	      ordinal_auto <- .orden_categorias_ordinal_auto(reviewed$inst)
      variables <- lapply(variables, function(v) {
        v$declarada_numerica <- isTRUE(v$numerica) && as.character(v$name %||% "") %in% numericas_decl
        v$analisis <- isTRUE(v$categorica) || isTRUE(v$declarada_numerica)
        ln <- as.character(v$list_name %||% "")
        v$list_ordinal_auto <- isTRUE(nzchar(ln) && !is.null(ordinal_auto[[ln]]) && ordinal_auto[[ln]])
        v
	      })
	      # ADR 0030 Fase 5: si la base activa es una hija repeat, el grano es la
	      # instancia (no la persona). El helper GATEA a `source_kind == kobo_repeat`
	      # (NULL para la madre y cualquier base no-hija) y calcula n_instancias/
	      # n_personas desde la data de la PROPIA hija (distinct `_parent_index`),
	      # nunca desde la madre. No se lee el attr del inst: `.load_rp_data` entrega
	      # la base "first"/madre en estudios repeat y su grano quedaría mal.
	      grain <- .analitica_active_repeat_grain(sid)
	      list(ok = TRUE, variables = variables, grain = grain)
	    })) |>
	    plumber::pr_get("/api/analitica/data-review", wrap_endpoint(function(req, res) {
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      list(ok = TRUE, variables = .analitica_data_review_payload(ctx$rp_data, ctx$rp_inst, cfg))
	    })) |>
	    plumber::pr_get("/api/analitica/reconciliacion", wrap_endpoint(function(req, res) {
	      # Reconciliación data↔XLSForm de la base activa. Lista las variables extra
	      # sustantivas (vars de versiones viejas del form / derivadas de plataforma)
	      # con su relleno, marcando cuáles están incluidas. Consumido por el popover
	      # y por el panel revisitable. Router delgado: lógica en reconciliacion_variables.R.
	      sid <- session_header(req)
	      .reconciliacion_info(sid)
	    })) |>
	    plumber::pr_post("/api/analitica/reconciliacion", wrap_endpoint(function(req, res, ...) {
	      # Persiste `variables_extra_incluidas` para la base activa. Body:
	      # { incluidas: ["dim_actor", ...] }. Validación defensiva (subconjunto de
	      # las extra reales) en el helper vía stop_api(E_RECON_VAR_DESCONOCIDA).
	      sid <- session_header(req)
	      body <- .analitica_json_body(req)
	      nombres <- .as_chr_vec(body$incluidas %||% body$variables_extra_incluidas)
	      .reconciliacion_set_incluidas(sid, nombres)
	    })) |>
	    plumber::pr_post("/api/analitica/base-sheet", wrap_endpoint(function(req, res, ...) {
	      sid <- session_header(req)
	      body <- .analitica_json_body(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_get_config(sid)
	      reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
	      s <- session_get(sid, required = FALSE)
	      coded <- isTRUE(s$codif_aplicado %||% FALSE) &&
	        identical(.analitica_effective_source(s, cfg), "adaptados")
	      .procesamiento_sheet_payload(
	        data = reviewed$data,
	        inst = reviewed$inst,
	        modo = body$modo %||% "codigos",
	        page = body$page %||% 1L,
	        page_size = body$page_size %||% body$pageSize %||% 50L,
	        search = body$search %||% "",
	        column_filters = body$column_filters %||% body$columnFilters %||% list(),
	        sort = body$sort %||% NULL,
	        coded = coded,
	        source = "analitica"
	      )
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
      .analitica_config_set(sid, cfg)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/analitica/ficha-tecnica/info", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .analitica_ficha_info(sid, .analitica_get_config(sid))
    })) |>
    plumber::pr_post("/api/analitica/ficha-tecnica/export", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .analitica_json_body(req)
      cfg <- .analitica_get_config(sid)
      if (!is.null(parsed$ficha_tecnica) && is.list(parsed$ficha_tecnica)) {
        cfg$ficha_tecnica <- utils::modifyList(cfg$ficha_tecnica %||% list(), parsed$ficha_tecnica)
      }
      template_path <- parsed$template_path %||% ((cfg$ficha_tecnica %||% list())$template_path %||% NULL)
      cfg <- .analitica_ficha_contextual_cfg(sid, cfg, include_panel = FALSE)
      .analitica_config_set(sid, cfg)
      cfg <- .analitica_cfg_with_effective_source(sid, cfg)
      cfg_doc <- cfg

      panel_bundle <- .analitica_ficha_panel_build(sid, cfg)
      if (!is.null(panel_bundle)) {
        cfg_doc$ficha_tecnica <- cfg_doc$ficha_tecnica %||% list()
        cfg_doc$ficha_tecnica$panel_context <- .panel_ficha_context(panel_bundle$built, panel_bundle$sources$data_sources)
        data_ficha <- panel_bundle$built$base_wide
        inst_ficha <- panel_bundle$built$inst_wide
        fuente <- panel_bundle$sources$fuente
        detalles <- list(
          "Base de análisis" = "Base longitudinal consolidada",
          "Mediciones incluidas" = paste(
            vapply(panel_bundle$built$config$waves, function(w) {
              as.character(w$label %||% w$suffix %||% "")
            }, character(1)),
            collapse = ", "
          )
        )
      } else {
        ctx <- .load_rp_data(sid)
        reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
        data_ficha <- reviewed$data
        inst_ficha <- reviewed$inst
        fuente <- ctx$fuente
        detalles <- list("Base de análisis" = "Base analítica preparada")
      }

      out_name <- .export_filename(sid, "ficha_tecnica", "docx")
      out_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
      .analitica_write_ficha_tecnica_docx(
        path_docx = out_path,
        data = data_ficha,
        instrumento = inst_ficha,
        reporte = "Ficha técnica",
        fuente = fuente,
        cfg = cfg_doc,
        template_path = template_path,
        detalles = detalles
      )
      meta <- .register_output_file(sid, "ficha_tecnica", out_path, original_name = out_name)
      .analitica_status_set(sid, "analitica_ficha_tecnica_ok", TRUE)
      list(
        ok = TRUE,
        n_bases = 1L,
        file_id = meta$file_id,
        filename = meta$original_name,
        size = meta$size
      )
    })) |>
    plumber::pr_post("/api/analitica/preparar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ctx <- .analitica_prepare_and_cache(sid)
      session_set(sid, "analitica_multibase_available", .analitica_multibase_available(sid))
      list(
        ok = TRUE,
        fuente = ctx$fuente,
        n_filas = nrow(ctx$rp_data),
        n_columnas = ncol(ctx$rp_data)
      )
    })) |>
    plumber::pr_post("/api/analitica/codebook", wrap_endpoint(function(req, res, ...) {
      # Codebook multi-base (v0.2+): itera sobre todas las bases del
      # estudio y genera un xlsx por cada una. Con 1 base → xlsx directo
      # como antes. Con N → zip con N archivos prefijados por nombre
      # de base (docentes__codebook.xlsx, ...).
      #
      # Config: `codigos_solo_si_presentes` y `variables_excluidas` son
      # globales al estudio (no varían por base, el QMD trabaja con la
      # misma política de codificación para todas).
      # Formato del entregable: "xlsx" (default) o "pdf". El PDF reusa el mismo
      # data_out que el XLSX; con >1 base, run_report_multibase empaqueta en zip.
      sid <- session_header(req)
      body <- .analitica_json_body(req)
      formato <- calc_str(body$formato %||% "xlsx", "xlsx")
      if (!formato %in% c("xlsx", "pdf")) {
        stop_api(400, "E_ANALITICA_CODEBOOK_FORMATO",
                 "Formato de libro de códigos inválido. Usa 'xlsx' o 'pdf'.")
      }
      cfg <- .analitica_get_config(sid)
      cb_cfg <- cfg$codebook %||% list()
      codes <- .as_int_vec(cb_cfg$codigos_solo_si_presentes)
      excluidas <- .as_chr_vec(cfg$variables_excluidas)
      numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = FALSE)

      ext <- if (identical(formato, "pdf")) "pdf" else "xlsx"
      base_filename <- if (identical(formato, "pdf")) "libro_de_codigos" else "codebook"
      kind_single <- if (identical(formato, "pdf")) "codebook_pdf" else "codebook"
      kind_multi  <- if (identical(formato, "pdf")) "codebook_pdf_zip" else "codebook_zip"

      result <- run_report_multibase(
        sid           = sid,
        base_filename = base_filename,
        ext           = ext,
        kind_single   = kind_single,
        kind_multi    = kind_multi,
        fn = .analitica_codebook_render_fn(
          cfg, formato, codes, numericas_arg, excluidas, sid = sid
        )
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
          .analitica_write_final_xlsform(
            final_inst, out_path,
            color_recod = .analitica_color_recod_enabled(cfg)
          )
        }
      )
      .analitica_status_set(sid, "analitica_codebook_ok", TRUE)
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
      cfg <- .analitica_cfg_with_effective_source(sid, .analitica_get_config(sid))
      # Render single-base delegado al helper (fuente única de la tubería, ya con
      # el desglose por servicio Parte A+B de bases hija repeat).
      result <- run_report_multibase(
        sid           = sid,
        base_filename = "frecuencias",
        ext           = "xlsx",
        kind_single   = "frecuencias",
        kind_multi    = "frecuencias_zip",
        fn            = .analitica_frecuencias_render_fn(sid, cfg)
      )
      .analitica_status_set(sid, "analitica_frecuencias_ok", TRUE)
      result
    })) |>
    plumber::pr_get("/api/analitica/multibase/info", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .analitica_multibase_info(sid, .analitica_get_config(sid))
    })) |>
    plumber::pr_post("/api/analitica/multibase/tablas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      sources <- .load_rp_sources(sid)
      if (length(sources$data_sources) != 1L) {
        stop_api(409, "E_MULTIBASE_INTEGRATED_REQUIRED", "Este reporte requiere una base integrada unica.")
      }
      base_name <- names(sources$data_sources)[1]
      data <- sources$data_sources[[base_name]]
      inst <- sources$inst_sources[[base_name]]
      meta <- .amb_base_meta(sid, base_name)
      recod_roles <- .amb_recod_roles_for_base(sid, base_name)
      data_path <- job_save_rds(sid, "multibase_tablas_data", data)
      inst_path <- job_save_rds(sid, "multibase_tablas_inst", inst)
      cfg_path <- job_save_rds(sid, "multibase_tablas_cfg", cfg)
      meta_path <- job_save_rds(sid, "multibase_tablas_meta", meta)
      recod_roles_path <- job_save_rds(sid, "multibase_tablas_recod_roles", recod_roles)
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.multibase.tablas",
        func = function(data_path, inst_path, cfg_path, meta_path, recod_roles_path, base_name, api_path, result_path, progress_path = NULL) {
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
          report("loading", percent = 5, message = "Cargando base integrada y configuración...")
          data <- readRDS(data_path)
          inst <- readRDS(inst_path)
          cfg <- readRDS(cfg_path)
          meta <- readRDS(meta_path)
          recod_roles <- readRDS(recod_roles_path)
          .analitica_multibase_export_data(
            data = data,
            inst = inst,
            cfg = cfg,
            meta = meta,
            recod_roles = recod_roles,
            path_xlsx = result_path,
            base_name = base_name
          )
          report("export", percent = 99, message = "Archivo XLSX generado.")
          result_path
        },
        args = list(
          data_path = data_path,
          inst_path = inst_path,
          cfg_path = cfg_path,
          meta_path = meta_path,
          recod_roles_path = recod_roles_path,
          base_name = base_name,
          api_path = api_path
        ),
        result_filename = .export_filename(sid, "tablas_multibase", "xlsx"),
        on_complete = function(j) {
          .analitica_status_set(j$sid, "analitica_multibase_ok", TRUE)
          session_set(j$sid, "analitica_multibase_available", TRUE)
          out_name <- .export_filename(j$sid, "tablas_multibase", "xlsx")
          meta <- .register_output_file(j$sid, "tablas_multibase", j$result_path, original_name = out_name)
          list(
            ok = TRUE,
            n_bases = 1L,
            file_id = meta$file_id,
            filename = meta$original_name,
            size = meta$size,
            bases = list(list(
              nombre = (base_name %||% .analitica_multibase_info(j$sid)$base_name %||% "base_integrada"),
              file_id = meta$file_id,
              filename = meta$original_name,
              size = meta$size
            ))
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.multibase.tablas")
    })) |>
    plumber::pr_get("/api/analitica/panel/info", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .analitica_panel_info(sid, .analitica_get_config(sid))
    })) |>
    plumber::pr_post("/api/analitica/panel/preview", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      parsed <- list()
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
      }
      panel_cfg <- parsed$config %||% parsed$panel %||% NULL
      if (!is.null(panel_cfg)) {
        cfg_all <- .analitica_get_config(sid)
        cfg_all$panel <- panel_cfg
        .analitica_config_set(sid, cfg_all)
        .analitica_status_set(sid, "analitica_panel_ok", FALSE)
      }
      rows <- suppressWarnings(as.integer(parsed$rows %||% 25L))
      if (is.na(rows) || rows < 1L) rows <- 25L
      .analitica_panel_preview(sid, panel_cfg, rows = rows)
    })) |>
    plumber::pr_post("/api/analitica/panel/ficha-tecnica", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      parsed <- list()
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
      }
      cfg_all <- .analitica_get_config(sid)
      panel_cfg <- parsed$config %||% parsed$panel %||% (cfg_all$panel %||% list())
      cfg_all$panel <- panel_cfg
      if (!is.null(parsed$ficha_tecnica) && is.list(parsed$ficha_tecnica)) {
        cfg_all$ficha_tecnica <- utils::modifyList(cfg_all$ficha_tecnica %||% list(), parsed$ficha_tecnica)
      }
      template_path <- parsed$template_path %||% ((cfg_all$ficha_tecnica %||% list())$template_path %||% NULL)
      .analitica_config_set(sid, cfg_all)

      sources <- .analitica_panel_load_sources(sid, cfg_all)
      panel_probe <- .panel_config_resolve(sources$data_sources, panel_cfg)
      if (length(sources$data_sources) < 2L) {
        stop_api(409, "E_PANEL_NEEDS_WAVES", "Base panel requiere al menos dos bases/mediciones.")
      }
      if (!nzchar(panel_probe$key) || !all(vapply(sources$data_sources, function(df) panel_probe$key %in% names(df), logical(1)))) {
        stop_api(409, "E_PANEL_KEY_MISSING", "Selecciona una llave presente en todas las mediciones.")
      }
      built <- .panel_wide_build(sources$data_sources, sources$inst_sources, panel_cfg)
      cfg_ficha <- cfg_all
      cfg_ficha$ficha_tecnica <- cfg_ficha$ficha_tecnica %||% list()
      if (is.null(cfg_ficha$ficha_tecnica$panel_context)) {
        cfg_ficha$ficha_tecnica$panel_context <- .panel_ficha_context(built, sources$data_sources)
      }
      s_ficha <- session_get(sid, required = FALSE)
      if (!is.null(s_ficha$hojas_ruta_workspace_outputs) &&
          is.null((cfg_ficha$ficha_tecnica %||% list())$hojas_ruta_context) &&
          is.null((cfg_ficha$ficha_tecnica %||% list())$hojas_ruta_pulso_path)) {
        cfg_ficha$ficha_tecnica$hojas_ruta_context <- list(
          hojas_ruta_config = s_ficha$hojas_ruta_config %||% list(),
          hojas_ruta_workspace_outputs = s_ficha$hojas_ruta_workspace_outputs %||% list()
        )
      }
      out_name <- .export_filename(sid, "ficha_tecnica_panel", "docx")
      out_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
      .analitica_write_ficha_tecnica_docx(
        path_docx = out_path,
        data = built$base_wide,
        instrumento = built$inst_wide,
        reporte = "Ficha tecnica de base panel",
        fuente = sources$fuente,
        cfg = cfg_ficha,
        template_path = template_path,
        detalles = list(
          "Llave panel" = built$config$key,
          "Mediciones incluidas" = paste(vapply(built$config$waves, function(w) as.character(w$label %||% w$suffix %||% ""), character(1)), collapse = ", "),
          "Personas o llaves panel" = built$summary$n_panel_keys,
          "Casos completos" = built$summary$n_complete_keys
        )
      )
      meta <- .register_output_file(sid, "ficha_tecnica_panel", out_path, original_name = out_name)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        size = meta$size,
        summary = built$summary
      )
    })) |>
    plumber::pr_post("/api/analitica/panel/export", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      parsed <- list()
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
      }
      cfg_all <- .analitica_get_config(sid)
      panel_cfg <- parsed$config %||% parsed$panel %||% (cfg_all$panel %||% list())
      panel_options <- .panel_export_options(parsed$options %||% parsed$export %||% parsed)
      cfg_all$panel <- panel_cfg
      .analitica_config_set(sid, cfg_all)

      sources <- .analitica_panel_load_sources(sid, cfg_all)
      panel_probe <- .panel_config_resolve(sources$data_sources, panel_cfg)
      if (length(sources$data_sources) < 2L) {
        stop_api(409, "E_PANEL_NEEDS_WAVES", "Base panel requiere al menos dos bases/mediciones.")
      }
      if (!nzchar(panel_probe$key) || !all(vapply(sources$data_sources, function(df) panel_probe$key %in% names(df), logical(1)))) {
        stop_api(409, "E_PANEL_KEY_MISSING", "Selecciona una llave presente en todas las mediciones.")
      }
      n_panel_bases <- length(sources$data_sources)

      data_path <- job_save_rds(sid, "panel_data_sources", sources$data_sources)
      inst_path <- job_save_rds(sid, "panel_inst_sources", sources$inst_sources)
      cfg_path <- job_save_rds(sid, "panel_cfg", panel_cfg)
      options_path <- job_save_rds(sid, "panel_options", panel_options)
      overrides_path <- job_save_rds(sid, "panel_bases_overrides", .bases_overrides_parse((cfg_all$bases %||% list())$overrides))
      ficha_path <- job_save_rds(sid, "panel_ficha_tecnica", list(
        cfg = cfg_all,
        fuente = sources$fuente
      ))
      result_ext <- if (identical(panel_options$formato, "csv")) {
        "csv"
      } else if (identical(panel_options$formato, "sav") && !isTRUE(panel_options$incluir_sps)) {
        "sav"
      } else if (identical(panel_options$formato, "sav")) {
        "zip"
      } else if (identical(panel_options$formato, "paquete")) {
        "zip"
      } else {
        "xlsx"
      }
      result_kind <- switch(
        panel_options$formato,
        paquete = "base_panel",
        xlsx = "base_panel_wide",
        csv = "base_panel_wide",
        sav = if (isTRUE(panel_options$incluir_sps)) "base_panel_sav_bundle" else "base_panel_sav",
        libro_codigos = "base_panel_libro_codigos",
        frecuencias = "base_panel_frecuencias",
        cruces = "base_panel_cruces",
        auditoria = "base_panel_auditoria",
        "base_panel"
      )
      job_id <- job_submit(
        sid = sid,
        kind = "analitica.panel.export",
        func = function(data_path, inst_path, cfg_path, options_path, overrides_path, ficha_path, result_path, progress_path = NULL) {
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 10, message = "Cargando mediciones serializadas...")
          data_sources <- readRDS(data_path)
          inst_sources <- readRDS(inst_path)
          panel_cfg <- readRDS(cfg_path)
          panel_options <- readRDS(options_path)
          overrides <- readRDS(overrides_path)
          ficha_tecnica <- readRDS(ficha_path)
          report("building", percent = 45, message = "Construyendo base panel wide...")
          built <- .panel_wide_build(data_sources, inst_sources, panel_cfg)
          ficha_tecnica <- .panel_ficha_tecnica_with_context(ficha_tecnica, built, data_sources)
          .panel_export_write(built, result_path, options = panel_options, overrides = overrides,
                              progress = report, ficha_tecnica = ficha_tecnica)
          report("done", percent = 99, message = "Entregable panel generado.")
          list(summary = built$summary, formato = panel_options$formato)
        },
        args = list(
          data_path = data_path,
          inst_path = inst_path,
          cfg_path = cfg_path,
          options_path = options_path,
          overrides_path = overrides_path,
          ficha_path = ficha_path
        ),
        result_filename = .export_filename(sid, result_kind, result_ext),
        on_complete = function(j) {
          .analitica_status_set(j$sid, "analitica_panel_ok", TRUE)
          out_name <- .export_filename(j$sid, result_kind, result_ext)
          meta <- .register_output_file(j$sid, result_kind, j$result_path, original_name = out_name)
          list(
            ok = TRUE,
            n_bases = n_panel_bases,
            file_id = meta$file_id,
            filename = meta$original_name,
            size = meta$size,
            formato = j$result_data$formato %||% panel_options$formato,
            summary = j$result_data$summary %||% j$result_data
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.panel.export")
    })) |>
    plumber::pr_post("/api/analitica/cruces", wrap_endpoint(function(req, res, cruces = NULL, modo = "estandar") {
      # Cruces lee del config del store: cruces_vars, modo, show_sig, alpha,
      # incluir_total, brecha, semaforo. Mantiene backcompat con el antiguo
      # `cruces=` query param para tests manuales; si viene en query, tiene
      # prioridad sobre el config.
	      sid <- session_header(req)
	      ctx <- .load_rp_data(sid)
	      cfg <- .analitica_cfg_with_effective_source(sid, .analitica_get_config(sid))
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
      # Orden por frecuencia marginal de las filas nominales (las columnas /
      # estratos nunca se reordenan). Ordinales conservan orden fijo.
      orden_cruces <- as.character(cc$orden %||% "original")
      if (!orden_cruces %in% c("desc","asc","original")) orden_cruces <- "original"
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
      if (!sem_modo %in% c("grupos", "degradado", "degradado_automatico", "degradado_manual")) sem_modo <- "grupos"
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
	      # La ponderacion vive en la persona: madres/bases normales se calibran
	      # sobre sus filas y las hijas repeat heredan ese peso por la llave ODK.
	      weighted <- .analitica_ponderacion_apply_sources(
	        sid, data_sources, inst_sources, cfg
	      )
	      data_sources <- weighted$data_sources
	      inst_sources <- weighted$inst_sources
	      repeat_design_by_base <- weighted$repeat_design_by_base
	      # Listas ordinales EFECTIVAS por base (override manual ∪ auto). Se
	      # precomputan en el hilo principal (paquete cargado) y viajan como
	      # dato plano al worker callr.
	      ordinal_lists_by_base <- lapply(inst_sources, function(inst) .orden_categorias_ordinal_set(inst, cfg))
	      data_sources_filt <- lapply(names(data_sources), function(nombre) {
	        df <- .excluir_cruce_rows(data_sources[[nombre]], cruces_map)
	        design <- repeat_design_by_base[[nombre]]
	        if (!is.null(design)) attr(df, "repeat_design") <- design
	        df
	      })
	      names(data_sources_filt) <- names(data_sources)

      rp_data_path <- job_save_rds(sid, "rp_data_sources", data_sources_filt)
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", inst_sources)
      repeat_design_path <- job_save_rds(sid, "repeat_design_by_base", repeat_design_by_base)
      # api_path para que el worker callr pueda load_all(prosecnurapp).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "analitica.cruces",
        func = function(rp_data_path, rp_inst_path, repeat_design_path, cruces_val, modo, secs, numericas_arg,
                        show_sig, alpha, incluir_total,
                        incluir_titulos, incluir_secciones,
                        brecha_filas, brecha_cols,
                        aplicar_sem, sem_modo, sem_cortes, sem_colores,
                        orden_cruces, ordinal_lists_by_base,
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
          repeat_design_by_base <- readRDS(repeat_design_path)
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
              orden = orden_cruces,
              ordinal_lists = ordinal_lists_by_base[[nombre]] %||% character(0),
              repeat_design = repeat_design_by_base[[nombre]],
              brecha_filas = brecha_filas,
              brecha_cols = brecha_cols,
              aplicar_semaforo = aplicar_sem,
              semaforo_modo = sem_modo,
              semaforo_cortes = sem_cortes,
              ficha_tecnica = list(
                reporte = if (identical(modo, "dimensiones")) "Cruces de dimensiones" else "Cruces",
                detalles = list(
                  "Modo de cruces" = modo,
                  "Variables de cruce" = paste(cruces_val, collapse = ", "),
                  "Significancia estadistica" = if (!isTRUE(show_sig)) {
                    "No activada"
                  } else if (is.list(repeat_design_by_base[[nombre]]) &&
                             !isTRUE(repeat_design_by_base[[nombre]]$inference_ok)) {
                    paste0("Descriptiva; ", repeat_design_by_base[[nombre]]$reason %||% "clusters insuficientes")
                  } else if (is.list(repeat_design_by_base[[nombre]])) {
                    paste0("Cluster-robust por persona; alpha = ", alpha)
                  } else {
                    paste0("Activada; alpha = ", alpha)
                  }
                )
              )
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
          repeat_design_path = repeat_design_path,
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
          orden_cruces = orden_cruces,
          ordinal_lists_by_base = ordinal_lists_by_base,
          api_path = api_path
        ),
        result_filename = if (length(data_sources) > 1L) {
          .export_filename(sid, "cruces", "zip")
        } else {
          .analitica_export_filename(sid, "cruces", "xlsx", base = names(data_sources)[1])
        },
        on_complete = function(j) {
          .analitica_status_set(j$sid, "analitica_cruces_ok", TRUE)
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
	      py <- .bases_pyreadstat_python()
	      writer <- if (nzchar(py)) {
	        list(engine = "pyreadstat", ok = TRUE, python = py, fallback = FALSE)
	      } else {
	        list(
	          engine = "haven",
	          ok = FALSE,
	          python = NULL,
	          fallback = TRUE,
	          message = "pyreadstat no disponible; se usara haven como fallback."
	        )
	      }
	      list(ok = TRUE, variables = variables, overrides = overrides, sav_writer = writer)
	    })) |>
    plumber::pr_post("/api/analitica/bases/data", wrap_endpoint(function(req, res, ...) {
      # Descarga directa del archivo de datos de la fuente activa. Si la
      # fuente es Codificada, copiamos el output real del adaptador para
      # preservar hojas, formato y colores de columnas *_recod.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      result <- .analitica_export_source_files(sid, role = "data", cfg = cfg)
      .analitica_status_set(sid, "analitica_bases_data_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/bases/instrumento", wrap_endpoint(function(req, res, ...) {
      # Descarga directa del XLSForm de la fuente activa. El XLSForm
      # codificado ya trae los colores del paquete; no lo reescribimos.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      result <- .analitica_export_source_files(sid, role = "instrumento", cfg = cfg)
      .analitica_status_set(sid, "analitica_bases_instrumento_ok", TRUE)
      result
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
		        reviewed$data <- .bases_normalize_other_selects(reviewed$data, reviewed$inst)
		        ds[[nombre]] <- .excluir_cols(reviewed$data, excluidas)
		        is_[[nombre]] <- reviewed$inst
		      }

      s <- session_get(sid)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)

      # Para single-base + sin sps: devuelve el .sav directo (legacy).
      if (length(ds) == 1L && !incluir_sps) {
        sav_name <- .analitica_export_filename(sid, "bases_sav", "sav", base = names(ds)[1])
        sav_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), sav_name))
        .bases_export_sav(ds[[1]], is_[[1]], sav_path, NULL, overrides = overrides)
        meta <- .register_output_file(sid, "bases_sav", sav_path, original_name = sav_name)
        .analitica_status_set(sid, "analitica_bases_sav_ok", TRUE)
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
        prefix <- if (length(ds) > 1L || !is.null(.analitica_active_export_base(sid))) paste0(nombre, "__") else ""
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
      zip_name <- .analitica_export_filename(
        sid,
        "bases_sav_bundle",
        "zip",
        base = if (length(ds) == 1L) names(ds)[1] else NULL
      )
      zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
      old_wd <- setwd(stage); on.exit(setwd(old_wd), add = TRUE)
      zip::zip(zip_path, files = files_in_zip)
      setwd(old_wd)
      meta <- .register_output_file(sid, "bases_sav_bundle", zip_path, original_name = zip_name)
      .analitica_status_set(sid, "analitica_bases_sav_ok", TRUE)
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
		          reviewed$data <- .bases_normalize_other_selects(reviewed$data, reviewed$inst)
		          rp_data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
		          rp_inst <- reviewed$inst
		          df <- rp_data
	          if (multi_select == "dummy_01") df <- .expand_multiselect(df, rp_inst)
          df <- .aplicar_etiquetas(df, rp_inst, valores = valores, multi_select = multi_select)
          .bases_write_csv(df, out_path, separador = separador)
        }
      )
      .analitica_status_set(sid, "analitica_bases_csv_ok", TRUE)
      result
    })) |>
	    plumber::pr_post("/api/analitica/bases/xlsx", wrap_endpoint(function(req, res, ...) {
	      # XLSX multi-base: un xlsx por base, zip si N > 1.
	      #
	      # Body params (JSON):
	      #   valores         : "codigos" | "etiquetas" | "ambos" (default "ambos")
	      #   multi_select    : "codigos_crudos" | "etiquetas_unidas" | "dummy_01"
	      #                     (default "dummy_01")
	      #   incluir_madre_sm: bool (default FALSE) — si TRUE, además de los dummies
	      #                     agrega por cada select_multiple una columna madre
	      #                     `<parent>` (respuestas concatenadas: etiquetas unidas
	      #                     en la hoja "etiquetas", códigos crudos en "codigos"),
	      #                     ubicada en la posición del parent (antes del bloque).
	      # Mismo contrato de `incluir_madre_sm` en /bases/xlsx-unificada.
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
      # incluir_madre_sm (bool, default FALSE): además de los dummies, incluir por
      # cada select_multiple una columna madre `<parent>` con las respuestas
      # concatenadas legibles (etiquetas unidas). El toggle vive en la UI.
      incluir_madre_sm <- isTRUE(body$incluir_madre_sm)

      # Madre + grupos repetibles forman UN solo contrato relacional, no bases
      # hermanas. El Excel estándar los reúne en un único libro con dos hojas
      # por tabla y llaves públicas; nunca devuelve un ZIP en este modo.
      if (.analitica_relational_available(sid)) {
        sources <- .load_rp_sources(sid)
        out_name <- .export_filename(sid, "base_relacional", "xlsx")
        out_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
        built <- .analitica_relational_write_xlsx(
          sid = sid,
          data_sources = sources$data_sources,
          inst_sources = sources$inst_sources,
          cfg = cfg,
          path_xlsx = out_path,
          multi_select = multi_select,
          incluir_madre_sm = incluir_madre_sm
        )
        meta <- .register_output_file(
          sid, "bases_xlsx_relacional", out_path, original_name = out_name
        )
        .analitica_status_set(sid, "analitica_bases_xlsx_ok", TRUE)
        return(list(
          ok = TRUE,
          relational = TRUE,
          n_bases = built$n_bases,
          fuente = .analitica_effective_source(session_get(sid), cfg),
          file_id = meta$file_id,
          filename = meta$original_name,
          size = meta$size,
          sheets = built$sheets,
          rows = built$rows
        ))
      }

      result <- run_report_multibase(
        sid           = sid,
        base_filename = "datos",
        ext           = "xlsx",
	        kind_single   = "bases_xlsx",
	        kind_multi    = "bases_xlsx_zip",
		        fn = function(rp_data, rp_inst, out_path) {
		          reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
		          reviewed$data <- .bases_normalize_other_selects(reviewed$data, reviewed$inst)
		          # Higiene: fuera las columnas de plumbing interno (tags de fuente,
		          # fases territoriales, derivadas kobo redundantes), las columnas
		          # 100% vacías (plantillas de análisis nunca calculadas, metadata
		          # sin contenido) y las variables excluidas por config. El strip de
		          # vacías va SOLO acá (export de la BBDD), no en el review compartido.
		          #
		          # Reconciliación data↔XLSForm: por defecto TODAS las extra
		          # sustantivas (vars de versiones viejas del form, derivadas de
		          # plataforma) se excluyen; solo sobreviven las que el usuario
		          # incluyó (`variables_extra_incluidas`). El include manda sobre el
		          # empty-drop: una extra incluida-pero-vacía NO se dropea por vacía.
		          recon <- .reconciliacion_export_plan(reviewed$data, reviewed$inst, cfg)
		          empty_cols <- setdiff(.analitica_base_empty_cols(reviewed$data), recon$extra_incluidas)
		          rp_data <- .excluir_cols(
		            reviewed$data,
		            c(.as_chr_vec(cfg$variables_excluidas),
		              .analitica_base_internal_cols(reviewed$data),
		              empty_cols,
		              recon$extra_a_excluir)
		          )
		          rp_inst <- reviewed$inst
		          df_base <- rp_data
          if (multi_select == "dummy_01") df_base <- .expand_multiselect(df_base, rp_inst)
          if (incluir_madre_sm) df_base <- .analitica_base_reconstruct_madre_sm(df_base, rp_inst)
          df_cod <- .aplicar_etiquetas(df_base, rp_inst, valores = "codigos", multi_select = multi_select)
          df_lab <- if (valores == "codigos") df_cod
                    else .aplicar_etiquetas(df_base, rp_inst, valores = "etiquetas", multi_select = multi_select)
          # BBDD sin "Ficha tecnica": solo las hojas `codigos` y `etiquetas`
          # (pedido del usuario — la ficha no pertenece al volcado de datos).
          # Frecuencias y Cruces SÍ conservan su ficha (no se tocan).
          .bases_write_xlsx(
            df_cod,
            df_lab,
            out_path,
            valores = valores,
            ficha_tecnica = FALSE,
            color_recod = .analitica_color_recod_enabled(cfg),
            type_map = pulso_recod_type_map(rp_inst$survey)
          )
        }
      )
      .analitica_status_set(sid, "analitica_bases_xlsx_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/bases/script-r", wrap_endpoint(function(req, res, ...) {
      # Script de replicación (.R) — ADR 0031. Un .R por base (zip si N > 1) que,
      # corrido sobre el crudo de Kobo, reproduce exacto la base final (códigos)
      # respetando la sanitización (universo por identificador de caso, sin
      # metadata interna). Router delgado: toda la lógica vive en el engine.
      sid <- session_header(req)
      cfg <- .analitica_get_config(sid)
      result <- .script_replica_run(sid, cfg)
      .analitica_status_set(sid, "analitica_bases_script_r_ok", TRUE)
      result
    })) |>
    plumber::pr_post("/api/analitica/bases/xlsx-unificada", wrap_endpoint(function(req, res, ...) {
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
      omitir_identificadores_directos <- !identical(body$omitir_identificadores_directos, FALSE)
      omitir_metadatos_operativos <- !identical(body$omitir_metadatos_operativos, FALSE)
      # incluir_madre_sm (bool, default FALSE): mismo contrato que /bases/xlsx.
      incluir_madre_sm <- isTRUE(body$incluir_madre_sm)

      result <- .analitica_unified_independent_xlsx(
        sid = sid,
        cfg = cfg,
        valores = valores,
        multi_select = multi_select,
        omitir_identificadores_directos = omitir_identificadores_directos,
        omitir_metadatos_operativos = omitir_metadatos_operativos,
        incluir_madre_sm = incluir_madre_sm
      )
      .analitica_status_set(sid, "analitica_bases_xlsx_ok", TRUE)
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
		      reviewed$data <- .bases_normalize_other_selects(reviewed$data, reviewed$inst)
		      reviewed$data <- .excluir_cols(reviewed$data, .as_chr_vec(cfg$variables_excluidas))
		      td <- tempfile()
      dir.create(td)
      on.exit(unlink(td, recursive = TRUE), add = TRUE)
      sav_path <- file.path(td, "datos.sav")
      sps_path <- file.path(td, "niveles_medida.sps")
	      .bases_export_sav(reviewed$data, reviewed$inst, sav_path, sps_path, overrides = overrides)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      zip_name <- .analitica_export_filename(sid, "spss_bundle", "zip")
      zip_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
      old <- getwd(); on.exit({ setwd(old) }, add = TRUE)
      setwd(td)
      zip::zip(zip_path, files = c("datos.sav", "niveles_medida.sps"))
      meta <- .register_output_file(sid, "spss_bundle", zip_path, original_name = zip_name)
      .analitica_status_set(sid, "analitica_spss_ok", TRUE)
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
          .analitica_status_set(j$sid, "analitica_enumeradores_ok", TRUE)
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
      .analitica_status_set(sid, "analitica_dim_ok", TRUE)
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
