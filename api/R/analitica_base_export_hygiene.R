# Higiene del EXPORT de base al cliente (endpoints /bases/xlsx y /bases/xlsx-unificada).
#
# La base adaptada que llega al motor trae columnas de PLUMBING interno (tags de
# fuente del handoff multi-fuente, fases territoriales, derivadas redundantes de
# fecha kobo) que NO deben viajar en la entrega al cliente. Esto vive SOLO en el
# path de export: `.analitica_apply_data_review` también alimenta frecuencias,
# cruces y codebook, así que el strip no puede ir ahí (rompería esas vistas).

# Columnas internas/técnicas a excluir de la BBDD entregada al cliente. NO son
# datos del instrumento ni metadata legítima de Kobo que el cliente sí quiere.
#
# Excluye:
#   - dot-prefijadas (`^\.`): `.source_*`, `.source_declared_person_code_*`, …
#   - los tags de fuente del handoff general (.CARGA_HANDOFF_SOURCE_TAG_COLS)
#   - `dim_territorial_phase`, `dim_origen` (dimensiones internas del monitoreo)
#   - derivadas redundantes de fecha kobo (`kobo_timestamp_iso`, `kobo_fecha_iso`,
#     `kobo_fecha`, `kobo_hora`, `kobo_fecha_hora`)
#
# NO excluye metadata legítima de Kobo que el cliente sí analiza: `_uuid`, `_id`,
# `_submission_time`, `start`, `end`, `today`.
.analitica_base_internal_cols <- function(data) {
  cols <- if (is.data.frame(data)) names(data) else as.character(data)
  cols <- cols[!is.na(cols) & nzchar(cols)]
  if (!length(cols)) return(character(0))

  out <- character(0)
  # dot-prefijadas: todo el plumbing con prefijo `.` (tags de fuente incluidos).
  out <- c(out, grep("^\\.", cols, value = TRUE))
  # tags de fuente del handoff general (algunos no dot-prefijados, p.ej. dim_origen).
  handoff_tags <- if (exists(".CARGA_HANDOFF_SOURCE_TAG_COLS")) {
    get(".CARGA_HANDOFF_SOURCE_TAG_COLS")
  } else character(0)
  out <- c(out, intersect(handoff_tags, cols))
  # dimensiones internas del monitoreo.
  out <- c(out, intersect(c("dim_territorial_phase", "dim_origen"), cols))
  # derivadas redundantes de fecha kobo (la fecha canónica vive en _submission_time).
  kobo_redundant <- c("kobo_timestamp_iso", "kobo_fecha_iso", "kobo_fecha",
                      "kobo_hora", "kobo_fecha_hora")
  out <- c(out, intersect(kobo_redundant, cols))

  unique(out)
}

# Columnas 100% VACÍAS a excluir del volcado de la BBDD. La base real trae
# columnas-plantilla de análisis que la plataforma inyectó pero nunca calculó
# (`A1_rec`, `perception_index`, …) y metadata Kobo sin contenido (`_tags`,
# `_notes`, `_submitted_by`, `_attachments`). Una columna está vacía si TODOS sus
# valores son NA o, tras `as.character` + `trimws`, cadena vacía; también se trata
# como vacío el `"[]"` que Kobo pone en arrays de metadata sin elementos.
#
# Guardrail: si TODAS las columnas resultaran vacías, no se marca ninguna (nunca
# dejar la BBDD sin columnas por un falso positivo).
.analitica_base_empty_cols <- function(data) {
  if (!is.data.frame(data) || !ncol(data)) return(character(0))
  is_empty_col <- function(col) {
    if (all(is.na(col))) return(TRUE)
    v <- trimws(as.character(col))
    v[is.na(col)] <- ""
    all(v == "" | v == "[]")
  }
  empties <- names(data)[vapply(data, is_empty_col, logical(1))]
  if (length(empties) == ncol(data)) return(character(0))  # no vaciar todo
  empties
}

# Colapsa las columnas DUPLICADAS con prefijo de grupo que arrastra la base real
# del handoff de Monitoreo. Wrapper delgado sobre el helper NEUTRO compartido de
# `base_hygiene.R` (misma lógica reusada por el promote y la lectura de Ver base
# / Validación). Se mantiene el nombre `.analitica_*` porque el review compartido
# de Analítica (router_analitica.R) lo invoca por su nombre histórico.
.analitica_base_collapse_group_prefixed_dupes <- function(data, inst) {
  .base_hygiene_collapse_group_prefixed_dupes(data, inst)
}

# Reconstruye, para cada select_multiple, la columna madre plana `<parent>` con
# las respuestas concatenadas en CÓDIGOS (separadas por espacio), tomándolas de
# los dummies presentes. La ubica en la posición del parent (justo antes de su
# bloque de dummies), consistente con el reorden canónico.
#
# El decode a etiquetas unidas lo hace `.aplicar_etiquetas` aguas abajo (misma
# maquinaria que `etiquetas_unidas`): la columna se etiqueta como select_multiple
# vía `attr(labels)` + el survey, así que en la hoja "etiquetas" sale como
# "Label A | Label C" y en la hoja "codigos" como "1 3" (crudo).
#
# Idempotente: si la madre plana ya existe (base no expandida) NO la duplica.
# No-op si no hay parents de select_multiple con bloque de dummies.
.analitica_base_reconstruct_madre_sm <- function(data, inst) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  cat <- .analitica_catalogo(inst)
  if (!nrow(cat) || !all(c("name", "tipo") %in% names(cat))) return(data)
  parents <- unique(cat$name[cat$tipo == "select_multiple"])
  parents <- parents[!is.na(parents) & nzchar(parents)]
  if (!length(parents)) return(data)

  # Preservar atributos top-level que el subsetting/asignación descarta.
  top_attrs <- attributes(data)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))

  for (parent in parents) {
    if (parent %in% names(data)) next  # madre plana ya presente: no duplicar.
    block <- .analitica_data_dummy_cols_for_parent(names(data), parent)
    if (!length(block)) next

    ln <- .analitica_list_name_for_var(inst, parent)
    choices <- if (nzchar(ln)) .choices_desde_instrumento(inst, ln) else NULL
    if (is.null(choices) || !nrow(choices)) next
    codes <- as.character(choices$name)
    labels_map <- stats::setNames(as.character(choices$label), codes)

    n <- nrow(data)
    tokens <- vector("list", n)
    for (i in seq_along(tokens)) tokens[[i]] <- character(0)
    any_marked <- FALSE
    for (code in codes) {
      col <- .analitica_find_dummy_col(block, parent, code)
      if (is.na(col) || !nzchar(col) || !(col %in% names(data))) next
      vals <- suppressWarnings(as.integer(as.character(data[[col]])))
      hit <- which(!is.na(vals) & vals == 1L)
      if (length(hit)) {
        any_marked <- TRUE
        for (i in hit) tokens[[i]] <- c(tokens[[i]], code)
      }
    }
    if (!any_marked) next

    madre <- vapply(tokens, function(t) {
      if (!length(t)) return(NA_character_)
      paste(t, collapse = " ")
    }, character(1))
    attr(madre, "labels") <- stats::setNames(codes, unname(labels_map[codes]))
    attr(madre, "label") <- .analitica_var_label(inst, parent)

    # Insertar la madre justo antes de su bloque de dummies.
    data[[parent]] <- madre
    cols <- names(data)
    first_dummy <- block[block %in% cols][1]
    pos <- match(first_dummy, cols)
    ord <- c(setdiff(cols[seq_len(pos - 1L)], parent), parent,
             setdiff(cols[pos:length(cols)], parent))
    data <- data[, ord, drop = FALSE]
  }

  for (nm in keep_attrs) attr(data, nm) <- top_attrs[[nm]]
  data
}
