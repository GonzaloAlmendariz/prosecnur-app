# Higiene NEUTRA de la base persistida del estudio.
#
# La base que llega por el puente Monitoreo -> Procesamiento
# (`.carga_handoff_promote_general`, source_kind = "monitoreo_kobo") arrastra
# PLUMBING que NO es dato del instrumento:
#   1. Duplicados con prefijo de grupo Kobo (`Intro/mand_Date` ↔ `mand_Date`,
#      `intro.mand_date` ↔ `mand_Date`) byte-idénticos a su gemelo pelado.
#   2. Tags de fuente del snapshot multi-fuente (`.source_*`) y el modo de
#      integración (`.integration_mode`).
#   3. El esquema de SEGUIMIENTO/UNIVERSO de Monitoreo (`Origen`, `CodPulso`,
#      `Status`, `dim_sede`, …) que el bind multi-fuente inyecta como NA para las
#      filas de ESTA fuente Kobo: llega 100% VACÍO y ajeno al instrumento.
#
# Este helper es el punto ÚNICO de saneo, reusado por:
#   - el promote (frente A: persistir la base ya limpia),
#   - la reconstrucción de `rp_data` al abrir el proyecto
#     (`.pulso_rebuild_estudio_runtime_sources` → Validación/Analítica/…),
#   - el volcado de "Ver base" en Carga (`.carga_normalized_data_for_export`).
#
# Regla de oro de proveniencia (por qué NO es una lista hardcodeada de nombres):
# el esquema de seguimiento se identifica como "variable EXTRA (no está en el
# instrumento, no es metadata Kobo, no es plumbing interno) que además llega
# VACÍA" — exactamente la clasificación `kind == "vacia"` de
# `.reconciliacion_variables_extra`, que ya resuelve stems de dummies/grupos y
# preserva calculates (`date`, `*_calc`) y derivadas queridas. Así, una variable
# legítima con DATO (aunque tenga nombre en español) nunca se borra, y un nombre
# como `Origen` que en OTRO proyecto fuera una variable real del instrumento se
# conserva (está en el survey) o trae dato.

# Kinds de base con proveniencia de handoff de Monitoreo (habilitan el drop del
# universo vacío). El upload manual de un XLSX NO entra: sus columnas vacías son
# del usuario y no se tocan.
.base_hygiene_is_monitoreo_kind <- function(source_kind) {
  sk <- tolower(trimws(as.character(source_kind %||% "")[1]))
  nzchar(sk) && startsWith(sk, "monitoreo")
}

# Fingerprint de que la base llegó por el handoff: tags de fuente o el modo de
# integración presentes en el frame. Se usa como auto-detección cuando el caller
# no declara la proveniencia explícitamente (p.ej. bases viejas ya persistidas).
.base_hygiene_has_monitoreo_provenance <- function(data) {
  if (!is.data.frame(data)) return(FALSE)
  nms <- names(data)
  any(nms == ".integration_mode") ||
    any(startsWith(nms, ".source")) ||
    (exists(".CARGA_HANDOFF_SOURCE_TAG_COLS") &&
       any(nms %in% get(".CARGA_HANDOFF_SOURCE_TAG_COLS")))
}

# Colapsa los duplicados group-prefixed que arrastra la base real del handoff.
# Cada variable puede aparecer dos veces: pelada (`mand_Date`) y con prefijo de
# grupo (`Intro/mand_Date` en el volcado crudo, o `intro.mand_date` tras
# `reporte_data`). Este helper:
#   - DROPEA la versión prefijada cuando tiene un gemelo pelado con datos
#     IDÉNTICOS (duplicado puro); si difieren, deja ambas (defensivo).
#   - RENOMBRA la prefijada a su nombre limpio del survey cuando NO tiene gemelo
#     (columnas valiosas únicas: `date`, `E1_age_calc`, los `time_*`) para que el
#     reorden canónico las reubique en su sección.
#   - Deja INTACTA la metadata (`formhub.uuid`, `meta.instanceID`) cuyo leaf no
#     matchea ningún nombre del survey, y los dummies `<parent>.<code>` (leaf
#     numérico).
# Separador de grupo agnóstico: `.` (post `reporte_data`) o `/` (volcado crudo).
# Guardrails: preserva atributos top-level; no-op sin `inst$survey` o sin
# columnas group-prefixed.
.base_hygiene_collapse_group_prefixed_dupes <- function(data, inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  survey <- (inst %||% list())$survey
  if (is.null(survey) || !("name" %in% names(survey))) return(data)
  sv <- as.character(survey$name)
  sv <- sv[!is.na(sv) & nzchar(sv)]
  if (!length(sv)) return(data)

  cols <- names(data)
  cols_lower <- tolower(cols)
  # canon (case del survey) indexado por su tolower, para el lookup case-insensitive.
  canon <- sv[!duplicated(tolower(sv))]
  canon_lower <- tolower(canon)

  to_drop <- character(0)
  renames <- list()          # col cruda -> nombre limpio del survey
  rename_targets <- character(0)

  for (col in cols) {
    # Primer segmento como prefijo (sin `.` ni `/`), separador `.`/`/`, resto.
    m <- regmatches(col, regexec("^([^./]+)[./](.+)$", col))[[1]]
    if (length(m) != 3L) next            # no es group-prefixed
    rest <- m[[3]]
    if (grepl("^[0-9]+$", rest)) next     # dummy `<parent>.<code>`: no tocar

    idx <- match(tolower(rest), canon_lower)
    if (is.na(idx)) next                  # rest no matchea survey (metadata): intacta
    canon_name <- canon[idx]

    # ¿Hay un gemelo limpio (columna cuyo tolower == tolower(canon) y != col)?
    twin_idx <- which(cols_lower == tolower(canon_name) & cols != col)
    if (length(twin_idx)) {
      twin <- cols[twin_idx[1]]
      a <- as.character(data[[col]]);  a[is.na(a)] <- ""
      b <- as.character(data[[twin]]); b[is.na(b)] <- ""
      if (identical(a, b)) to_drop <- c(to_drop, col)  # duplicado puro -> drop
      # difieren -> defensivo, se dejan ambas.
    } else {
      # sin gemelo -> renombrar a su nombre limpio, salvo colisión.
      if (!(canon_name %in% cols) && !(canon_name %in% rename_targets)) {
        renames[[col]] <- canon_name
        rename_targets <- c(rename_targets, canon_name)
      }
    }
  }

  if (!length(to_drop) && !length(renames)) return(data)

  top_attrs <- attributes(data)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))

  if (length(to_drop)) {
    data <- data[, setdiff(names(data), to_drop), drop = FALSE]
  }
  if (length(renames)) {
    nm <- names(data)
    for (col in names(renames)) {
      i <- which(nm == col)
      if (length(i) == 1L && !(renames[[col]] %in% nm)) nm[i] <- renames[[col]]
    }
    names(data) <- nm
  }

  for (a in keep_attrs) attr(data, a) <- top_attrs[[a]]
  data
}

# Quita el plumbing dot-prefijado (`.source_*`, `.integration_mode`,
# `.source_declared_person_code_*`) y los tags de fuente del handoff que no
# llevan `.` (`dim_origen`). Ningún nombre de variable de instrumento empieza con
# `.`, así que el barrido dot-prefijado es seguro.
.base_hygiene_strip_handoff_tags <- function(data) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  nms <- names(data)
  drop <- grep("^\\.", nms, value = TRUE)
  if (exists(".CARGA_HANDOFF_SOURCE_TAG_COLS")) {
    drop <- union(drop, intersect(get(".CARGA_HANDOFF_SOURCE_TAG_COLS"), nms))
  }
  if (!length(drop)) return(data)
  top_attrs <- attributes(data)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))
  data <- data[, setdiff(nms, drop), drop = FALSE]
  for (a in keep_attrs) attr(data, a) <- top_attrs[[a]]
  data
}

# Dropea el esquema de seguimiento/universo de Monitoreo que llega 100% VACÍO y
# ajeno al instrumento. La señal es de PROVENIENCIA, no de nombres: se reusa la
# clasificación tested de `.reconciliacion_variables_extra` (columna EXTRA al
# instrumento, no metadata Kobo, no plumbing interno) y se quedan solo las de
# `kind == "vacia"`. Las extras con dato (`con_datos`) — derivadas queridas,
# calculates ajenos al survey — NO se tocan. Los dummies de select_multiple y las
# columnas group-prefixed que resuelven a una variable del survey no son "extra",
# así que nunca entran a este drop (protege dummies vacíos legítimos).
.base_hygiene_drop_empty_universe <- function(data, inst) {
  if (!is.data.frame(data) || !ncol(data) || !nrow(data)) return(data)
  if (!exists(".reconciliacion_variables_extra", mode = "function")) return(data)
  extra_df <- tryCatch(.reconciliacion_variables_extra(data, inst),
                       error = function(e) NULL)
  if (is.null(extra_df) || !nrow(extra_df)) return(data)
  drop <- extra_df$name[extra_df$kind == "vacia"]
  drop <- intersect(drop, names(data))
  if (!length(drop)) return(data)
  top_attrs <- attributes(data)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))
  data <- data[, setdiff(names(data), drop), drop = FALSE]
  for (a in keep_attrs) attr(data, a) <- top_attrs[[a]]
  data
}

# Punto ÚNICO de saneo de una base persistida. Idempotente: re-aplicarlo sobre
# una base ya limpia es no-op. `monitoreo_handoff`:
#   - TRUE/FALSE: el caller declara la proveniencia (promote, rebuild con
#     source_kind conocido).
#   - NULL (default): auto-detección por fingerprint (bases viejas ya
#     persistidas leídas desde archivo).
# El drop del universo vacío SOLO corre cuando la proveniencia es de handoff.
sanitize_base_data <- function(data, inst, monitoreo_handoff = NULL) {
  if (!is.data.frame(data) || !length(names(data))) return(data)

  is_handoff <- if (is.null(monitoreo_handoff)) {
    .base_hygiene_has_monitoreo_provenance(data)
  } else {
    isTRUE(monitoreo_handoff)
  }

  # 1) Colapsa duplicados group-prefixed idénticos (o renombra los únicos).
  data <- .base_hygiene_collapse_group_prefixed_dupes(data, inst)
  # 2) Strip de tags de fuente + `.integration_mode` + dot-plumbing.
  data <- .base_hygiene_strip_handoff_tags(data)
  # 3) Universo/seguimiento vacío: solo bases con proveniencia de handoff.
  if (is_handoff) data <- .base_hygiene_drop_empty_universe(data, inst)

  data
}
