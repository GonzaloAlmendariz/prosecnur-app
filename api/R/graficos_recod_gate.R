# Gate de avisos por recodificaciones sin aplicar o con drift, para Gráficos.
#
# Todo el pipeline de Gráficos (plan, PPT, Excel, codebook, XLSForm) reconoce una
# recodificación SOLO cuando la columna `<parent>_recod` está MATERIALIZADA en el
# instrumento/data. Nunca lee el catálogo `codif_por_base[[base]]$grupos_recod`
# para decidir. Consecuencia: si el analista DEFINIÓ una recod pero no la APLICÓ,
# el plan grafica la variable original sin avisar; y si una `_recod` materializada
# quedó desfasada del catálogo vigente (drift), el reporte usa una versión vieja.
#
# Este módulo NO bloquea la generación: solo DETECTA y produce avisos accionables
# que `.graficos_suggested_plan` adjunta a `warnings`. El núcleo es puro y testeable
# con fixtures; el wrapper con sesión degrada a "sin avisos" ante cualquier fallo.

# --- Núcleo puro -------------------------------------------------------------

# Normaliza los grupos del catálogo (grupos_recod[[parent]]) a categorías
# comparables list(code, label), descartando grupos con código vacío (borradores
# como el grupo "nuevo" sin código todavía).
.graficos_recod_group_categories <- function(groups) {
  if (is.null(groups) || !length(groups)) return(list())
  out <- list()
  for (g in groups) {
    if (!is.list(g)) next
    code <- .graficos_scalar_chr(g$codigo %||% g$code %||% g$name, "")
    if (!nzchar(code)) next
    label <- .graficos_scalar_chr(g$etiqueta %||% g$label, code)
    out[[length(out) + 1L]] <- list(code = code, label = label)
  }
  out
}

# Normaliza un label para comparación tolerante: minúsculas, sin diacríticos y
# sin puntuación/espacios. Usa chartr (no iconv//TRANSLIT) porque el TRANSLIT de
# macOS inserta un apóstrofo para las vocales acentuadas y rompe la equivalencia
# tilde vs sin-tilde. Conserva cambios reales de texto.
.graficos_recod_norm_label <- function(x) {
  out <- tolower(enc2utf8(as.character(x %||% "")))
  out <- chartr(
    "áàäâéèëêíìïîóòöôúùüûñç",
    "aaaaeeeeiiiioooouuuunc",
    out
  )
  out <- gsub("[^a-z0-9]+", "_", out)
  gsub("^_+|_+$", "", out)
}

# Etiquetas normalizadas de los valores especiales estándar de Pulso. El proceso
# de aplicación los remapea por ETIQUETA (90 No aplica, 94 NS/NR, 95 No piensa
# votar, 96 Blanco/Viciado, 97 No votó, 98 No sabe, 99 No responde) y su presencia
# o código en los choices materializados es un artefacto aguas abajo, no una
# decisión del analista. Se excluyen de la comparación de drift.
.graficos_recod_special_labels <- function() {
  c(
    "no_aplica", "perdido", "no_aplica_perdido",
    "ns_nr", "no_sabe_no_responde", "no_sabe_no_contesta",
    "no_piensa_votar", "blanco_viciado", "voto_en_blanco", "viciado",
    "no_voto", "no_sabe", "no_responde", "no_contesta"
  )
}

# Conjunto comparable de una lista de categorías: etiquetas normalizadas, únicas,
# sin vacías y sin valores especiales. La comparación de drift se hace por
# ETIQUETA (el significado que ve el entregable), NO por código: el proceso de
# aplicación renumera códigos (p.ej. el 6/7 del analista termina como 99/100) sin
# cambiar el significado; comparar por código produciría falsos positivos en cada
# recod correctamente aplicada. Solo un cambio real de categorías/etiquetas
# (agregar, quitar o renombrar) altera este conjunto.
.graficos_recod_category_labels <- function(cats) {
  if (is.null(cats) || !length(cats)) return(character(0))
  labels <- vapply(cats, function(c) .graficos_recod_norm_label(c$label %||% c$code %||% c$name), character(1))
  labels <- labels[nzchar(labels)]
  labels <- labels[!(labels %in% .graficos_recod_special_labels())]
  unique(labels)
}

# TRUE si el catálogo y lo materializado difieren en el conjunto de etiquetas de
# categoría (excluyendo valores especiales).
.graficos_recod_categories_differ <- function(cat_cats, mat_cats) {
  a <- .graficos_recod_category_labels(cat_cats)
  b <- .graficos_recod_category_labels(mat_cats)
  if (!length(a) && !length(b)) return(FALSE)
  !setequal(a, b)
}

# Núcleo de decisión. Puro: no lee sesión ni disco.
#   catalog        : named list parent -> grupos (cada grupo list(codigo, etiqueta, ...))
#   materialized   : named list recod_var (`<parent>_recod`) -> categorías materializadas
#                    (cada una list(code, label)). Presencia de la clave = materializada.
#                    Valor list() = materializada pero sin categorías comparables
#                    (p.ej. columna en data sin choices en el instrumento).
#   parent_labels  : named list parent -> etiqueta legible (fallback: el propio nombre).
graficos_recod_gate_evaluate <- function(catalog, materialized = list(), parent_labels = list()) {
  catalog <- catalog %||% list()
  materialized <- materialized %||% list()
  parent_labels <- parent_labels %||% list()

  pendientes <- character(0)
  drift <- character(0)
  orphan <- character(0)
  warnings <- character(0)
  catalog_parents <- character(0)

  for (parent in names(catalog)) {
    cats <- .graficos_recod_group_categories(catalog[[parent]])
    if (!length(cats)) next # entrada de catálogo vacía (aún sin grupos): se ignora.
    catalog_parents <- c(catalog_parents, parent)
    recod_var <- paste0(parent, "_recod")
    label <- .graficos_scalar_chr(parent_labels[[parent]], parent)
    if (!nzchar(label)) label <- parent

    if (!(recod_var %in% names(materialized))) {
      pendientes <- c(pendientes, parent)
      warnings <- c(warnings, sprintf(
        "La recodificación de «%s» está definida pero sin aplicar; el reporte usará la variable original. Aplícala en Codificación para reflejarla.",
        label
      ))
      next
    }

    mat_cats <- materialized[[recod_var]]
    # Solo evaluamos drift si podemos comparar categorías (materialización con
    # choices). Una columna materializada sin choices no permite decidir drift.
    if (length(mat_cats) && .graficos_recod_categories_differ(cats, mat_cats)) {
      drift <- c(drift, parent)
      warnings <- c(warnings, sprintf(
        "La recodificación aplicada de «%s» difiere del catálogo actual (categorías cambiadas); vuelve a aplicarla.",
        label
      ))
    }
  }

  # Huérfanas: `_recod` materializadas sin entrada (no vacía) en el catálogo.
  # Es informativo (una recod aplicada por fuera del catálogo actual). NO se
  # adjunta a `warnings` para no inundar proyectos con recods legacy aplicadas
  # antes de que existiera el catálogo; queda en la lista estructurada.
  for (recod_var in names(materialized)) {
    parent <- sub("_recod$", "", recod_var)
    if (!(parent %in% catalog_parents)) orphan <- c(orphan, recod_var)
  }

  list(
    recod_pendientes = unique(pendientes),
    recod_drift = unique(drift),
    recod_orphan = unique(orphan),
    warnings = unique(warnings)
  )
}

# --- Lectura desde el instrumento en memoria ---------------------------------

# Extrae, de un instrumento (survey + choices en memoria), el mapa de
# `<var>_recod` -> categorías materializadas list(code, label).
.graficos_recod_materialized_from_inst <- function(inst) {
  if (is.null(inst) || !is.list(inst)) return(list())
  survey <- inst$survey %||% NULL
  choices <- inst$choices %||% NULL
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey)) return(list())
  names_vec <- trimws(as.character(survey$name))
  out <- list()
  for (i in seq_len(nrow(survey))) {
    nm <- names_vec[i]
    if (is.na(nm) || !nzchar(nm) || !grepl("_recod$", nm, ignore.case = TRUE)) next
    list_name <- .graficos_list_name_for_row(survey, i)
    items <- .graficos_choices_for_list(choices, list_name)$items %||% list()
    cats <- lapply(items, function(it) list(code = it$name, label = it$label))
    if (is.null(out[[nm]])) out[[nm]] <- cats
  }
  out
}

# Etiqueta legible de una variable del instrumento (columna `label`), limpiando
# tokens dinámicos ${...}. Fallback: el propio nombre.
.graficos_recod_survey_label <- function(survey, name) {
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey)) return(name)
  idx <- which(trimws(as.character(survey$name)) == name)
  if (!length(idx)) return(name)
  label <- if ("label" %in% names(survey)) as.character(survey$label[idx[1]]) else name
  out <- .graficos_clean_dynamic_label(label %||% name)
  if (nzchar(out)) out else name
}

# --- Wrapper con sesión ------------------------------------------------------

# Evalúa el gate para todas las bases del estudio. Degrada a estructura vacía
# ante cualquier fallo: nunca debe romper la generación del plan.
.graficos_recod_gate_session <- function(sid) {
  empty <- list(
    recod_pendientes = character(0),
    recod_drift = character(0),
    recod_orphan = character(0),
    warnings = character(0)
  )
  tryCatch({
    s <- session_get(sid, required = FALSE)
    if (is.null(s)) return(empty)
    cbb <- s$codif_por_base %||% list()
    if (!is.list(cbb) || !length(cbb)) return(empty)

    # Catálogo unificado por parent (cualquier base con grupos no vacíos aporta).
    catalog <- list()
    for (base in names(cbb)) {
      gr <- (cbb[[base]] %||% list())$grupos_recod %||% list()
      if (!is.list(gr) || !length(gr)) next
      for (parent in names(gr)) {
        if (length(.graficos_recod_group_categories(gr[[parent]])) &&
            is.null(catalog[[parent]])) {
          catalog[[parent]] <- gr[[parent]]
        }
      }
    }
    if (!length(catalog)) return(empty)

    sources <- .graficos_processing_sources(sid)
    inst_sources <- sources$inst_sources %||% list()
    data_sources <- sources$data_sources %||% list()

    # Materialización agregada sobre TODAS las fuentes (un parent puede vivir en
    # una hoja repeat aunque su catálogo esté bajo la base principal).
    materialized <- list()
    parent_labels <- list()
    for (base in names(inst_sources)) {
      inst <- inst_sources[[base]]
      m <- .graficos_recod_materialized_from_inst(inst)
      for (k in names(m)) if (is.null(materialized[[k]])) materialized[[k]] <- m[[k]]
      survey <- (inst %||% list())$survey %||% NULL
      for (parent in names(catalog)) {
        if (is.null(parent_labels[[parent]])) {
          lbl <- .graficos_recod_survey_label(survey, parent)
          if (nzchar(lbl) && !identical(lbl, parent)) parent_labels[[parent]] <- lbl
        }
      }
    }
    # Columnas `_recod` presentes solo en data (sin choices): marcan
    # materialización aunque no permitan evaluar drift.
    for (base in names(data_sources)) {
      df <- data_sources[[base]]
      if (!is.data.frame(df)) next
      cols <- grep("_recod$", names(df), value = TRUE, ignore.case = TRUE)
      for (col in cols) if (is.null(materialized[[col]])) materialized[[col]] <- list()
    }

    graficos_recod_gate_evaluate(catalog, materialized, parent_labels)
  }, error = function(e) empty)
}
