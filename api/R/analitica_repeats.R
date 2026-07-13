# =============================================================================
# Analítica consciente de grupos repeat (ADR 0030, Fase 3)
# =============================================================================
#
# La Fase 1 dejó cada `begin_repeat` como una base HIJA long, vinculada a su base
# MADRE ancha con las llaves canónicas ODK/Kobo (`_parent_index`↔`_index`,
# fallback `_submission__id`↔`_id`) y `extra_meta`: `source_kind="kobo_repeat"`,
# `parent_base`, `repeat_group`, `link_key`, `link_key_fallback`,
# `parent_index_key`. La Fase 2 reconectó la validación multi-tabla.
#
# Este módulo lleva ese enlace a Analítica, SIN engordar `router_analitica.R`
# (que sólo llama a estos helpers con una línea). Cubre tres cosas:
#
#   A. Filtro de variables fantasma: las preguntas anidadas en un repeat NO
#      existen como columnas de la base ANCHA (Kobo devuelve el repeat como blob).
#      `.analitica_repeat_phantom_names` las detecta por `repeat_depth > 0`
#      (reusa `.dn_survey_repeat_depth`, Fase 1) para que los pickers/secciones de
#      la madre no las ofrezcan. En una base HIJA las mismas preguntas ya son
#      top-level (el instrumento hijo las envuelve en `begin_group`, no
#      `begin_repeat`), así que su `repeat_depth` es 0 y el filtro NO las toca:
#      la excepción "no filtrar en la hija" queda cubierta por construcción.
#
#   B. Enriquecimiento hija×madre: a la data de una base hija se le agregan las
#      columnas de caracterización de la madre (sexo/edad/NSE...) por un
#      left-join many-to-one usando el link-join compartido
#      (`.dn_repeat_parent_row_positions`), y al instrumento de la hija se le
#      agregan esas variables como seleccionables. Así se cruza `srv_* × sexo`.
#
#   C. Etiqueta de grano: la base hija se analiza a grano de INSTANCIA (filas),
#      no de persona. `.analitica_repeat_grain` expone N de instancias vs N de
#      personas (unidades `_parent_index` únicas) + una nota de clustering.

# --- A. Variables fantasma del repeat en la base ancha ----------------------

#' Nombres de preguntas que viven dentro de un `begin_repeat` (repeat_depth > 0).
#'
#' En la base ANCHA (madre) son variables FANTASMA: el instrumento las declara
#' pero la data aplanada no las tiene (viven en la base hija). En la base HIJA el
#' instrumento las promueve a top-level bajo un `begin_group`, así que su
#' `repeat_depth` es 0 y este helper devuelve vacío: no se filtra nada en la hija.
#' @keywords internal
.analitica_repeat_phantom_names <- function(rp_inst) {
  sv <- (rp_inst %||% list())$survey %||% NULL
  if (is.null(sv) || !nrow(sv) || !"name" %in% names(sv)) return(character(0))
  depth <- tryCatch(.dn_survey_repeat_depth(sv), error = function(e) integer(0))
  if (length(depth) != nrow(sv)) return(character(0))
  nms <- as.character(sv$name)
  nms[is.na(nms)] <- ""
  unique(nms[depth > 0L & nzchar(nms)])
}

# --- C. Etiqueta de grano (instancias vs personas) --------------------------

#' Meta de grano de una base hija repeat: N de instancias vs N de personas.
#'
#' `n_personas` = unidades `_parent_index` (link_key) únicas presentes en la
#' hija; se calcula desde la propia hija, así funciona aunque la madre no esté
#' cargada. No cambia ningún cálculo de frecuencia: sólo etiqueta el denominador.
#' @keywords internal
.analitica_repeat_grain <- function(child_data, base_meta) {
  base_meta <- base_meta %||% list()
  link_key <- as.character(base_meta$link_key %||% "_parent_index")
  fb <- as.character(base_meta$link_key_fallback %||% "_submission__id")
  n_inst <- if (is.data.frame(child_data)) nrow(child_data) else NA_integer_

  key_vals <- NULL
  if (is.data.frame(child_data)) {
    if (link_key %in% names(child_data)) {
      key_vals <- child_data[[link_key]]
    } else if (fb %in% names(child_data)) {
      key_vals <- child_data[[fb]]
    }
  }
  n_pers <- NA_integer_
  if (!is.null(key_vals)) {
    v <- as.character(key_vals)
    v <- v[!is.na(v) & nzchar(v)]
    n_pers <- length(unique(v))
  }

  list(
    kind         = "instancia",
    n_instancias = if (is.na(n_inst)) NA_integer_ else as.integer(n_inst),
    n_personas   = if (is.na(n_pers)) NA_integer_ else as.integer(n_pers),
    repeat_group = as.character(base_meta$repeat_group %||% base_meta$nombre %||% ""),
    parent_base  = as.character(base_meta$parent_base %||% ""),
    nota = paste0(
      "El grano de esta base es la INSTANCIA del repeat, no la persona ",
      "(1 fila = 1 registro del roster). La significancia de cruces sobre ",
      "esta base ignora el clustering por persona."
    )
  )
}

# Data de la PROPIA base `base_name` (con su `_parent_index`), tomada de los caches
# de analítica/estudio y, como último recurso, releída desde archivo por el mismo
# pipeline que el resto de analítica. Existe porque para estudios repeat
# `.load_rp_data` entrega la base "first" (la MADRE, ver el override de
# `.analitica_prepare_context`), así que el grano NO puede calcularse desde el
# `rp_data` que recibe el path activo: hay que ir a la data de la hija. Prefiere una
# fuente que traiga la llave de enlace; degrada sin romper a NULL.
# @keywords internal
.analitica_repeat_own_data <- function(sid, base_name, link_key = "_parent_index",
                                       fallback = "_submission__id", cfg = NULL) {
  base_name <- as.character(base_name %||% "")
  if (!nzchar(base_name)) return(NULL)
  s <- session_get(sid, required = FALSE)
  has_link <- function(df) {
    is.data.frame(df) &&
      ((nzchar(link_key) && link_key %in% names(df)) ||
       (nzchar(fallback) && fallback %in% names(df)))
  }
  cands <- list(
    (s$analitica_rp_data_sources %||% list())[[base_name]],
    (s$rp_data_sources %||% list())[[base_name]]
  )
  for (d in cands) if (has_link(d)) return(d)
  for (d in cands) if (is.data.frame(d)) return(d)

  meta <- ((s$estudio %||% list())$bases %||% list())[[base_name]]
  if (is.null(meta)) return(NULL)
  cfg <- cfg %||% tryCatch(.analitica_get_config(sid), error = function(e) list())
  fuente <- tryCatch(.analitica_effective_source(s, cfg), error = function(e) "originales")
  read_pair <- function(fte) {
    pair <- tryCatch(.analitica_pair_for_base(s, meta, fte, base_name), error = function(e) NULL)
    if (is.null(pair)) return(NULL)
    tryCatch(.analitica_read_pair(pair, meta), error = function(e) NULL)
  }
  parsed <- read_pair(fuente)
  if (is.null(parsed) && !identical(fuente, "originales")) parsed <- read_pair("originales")
  if (is.null(parsed)) return(NULL)
  parsed$data
}

#' Grano de repeat de la BASE ACTIVA, robusto por contrato (ADR 0030, Fase 5).
#'
#' Devuelve NULL salvo que la base activa sea una hija repeat
#' (`source_kind == "kobo_repeat"` con madre declarada). En ese caso
#' `n_instancias`/`n_personas` se calculan SIEMPRE desde la data de la PROPIA hija
#' (distinct `_parent_index`), nunca desde la madre. Blinda el endpoint de
#' variables contra dos cosas: (1) que un attr `repeat_grain` filtrado/heredado
#' aflore sobre la MADRE (el bug reportado: grano con `parent_base` = la madre
#' misma), y (2) que el grano de una hija activa se compute sobre la data de la
#' madre que `.load_rp_data` entrega (override "first"), lo que daría
#' `n_personas = NA` y `n_instancias` = filas de la madre.
#' @keywords internal
.analitica_active_repeat_grain <- function(sid, cfg = NULL) {
  base_meta <- tryCatch(.analitica_single_base_meta(sid), error = function(e) NULL)
  base_name <- as.character((base_meta %||% list())$nombre %||% "")
  if (!nzchar(base_name)) return(NULL)
  child_meta <- .analitica_repeat_child_meta(sid, base_name)
  if (is.null(child_meta)) return(NULL)
  link_key <- as.character(child_meta$link_key %||% "_parent_index")
  fb <- as.character(child_meta$link_key_fallback %||% "_submission__id")
  own <- .analitica_repeat_own_data(sid, base_name, link_key = link_key, fallback = fb, cfg = cfg)
  if (!is.data.frame(own)) return(NULL)
  .analitica_repeat_grain(own, child_meta)
}

# --- B. Enriquecimiento hija×madre ------------------------------------------

# ¿Es `base_name` una base hija repeat con madre declarada? Devuelve su meta o
# NULL. Resiliente: sin sesión/estudio/base devuelve NULL.
.analitica_repeat_child_meta <- function(sid, base_name) {
  if (is.null(base_name) || !nzchar(as.character(base_name))) return(NULL)
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  b <- bases[[as.character(base_name)]]
  if (is.null(b)) return(NULL)
  if (!identical(as.character(b$source_kind %||% ""), "kobo_repeat")) return(NULL)
  if (!nzchar(as.character(b$parent_base %||% ""))) return(NULL)
  b
}

# Par (data + inst) de la base MADRE ya procesado. Prioriza: (1) los maps ya
# cargados por el caller (evita re-leer), (2) el cache de sesión si trae la llave
# de enlace, (3) re-lectura desde archivo por el mismo path que el resto de
# analítica. Devuelve NULL si nada resuelve (la madre no está cargada) para
# degradar sin romper.
.analitica_repeat_parent_pair <- function(sid, parent_base, cfg = NULL,
                                          data_sources = NULL, inst_sources = NULL,
                                          need_key = "_index", need_fallback = "_id") {
  parent_base <- as.character(parent_base %||% "")
  if (!nzchar(parent_base)) return(NULL)
  has_key <- function(df) {
    is.data.frame(df) &&
      ((nzchar(need_key) && need_key %in% names(df)) ||
       (nzchar(need_fallback) && need_fallback %in% names(df)))
  }

  # (1) Ya en los maps que trae el caller.
  if (!is.null(data_sources) && !is.null(inst_sources) &&
      parent_base %in% names(data_sources) && parent_base %in% names(inst_sources)) {
    pd <- data_sources[[parent_base]]
    if (has_key(pd)) return(list(data = pd, inst = inst_sources[[parent_base]]))
  }

  s <- session_get(sid, required = FALSE)
  # (2) Cache de sesión (poblado al registrar la base).
  cached_data <- (s$rp_data_sources %||% list())[[parent_base]]
  cached_inst <- (s$rp_inst_sources %||% list())[[parent_base]]
  if (has_key(cached_data) && !is.null(cached_inst)) {
    return(list(data = cached_data, inst = cached_inst))
  }

  # (3) Re-lectura desde archivo (mismo pipeline que .analitica_prepare_context).
  parent_meta <- ((s$estudio %||% list())$bases %||% list())[[parent_base]]
  if (is.null(parent_meta)) return(NULL)
  cfg <- cfg %||% tryCatch(.analitica_get_config(sid), error = function(e) list())
  fuente <- tryCatch(.analitica_effective_source(s, cfg), error = function(e) "originales")
  read_pair <- function(fte) {
    pair <- tryCatch(.analitica_pair_for_base(s, parent_meta, fte, parent_base),
                     error = function(e) NULL)
    if (is.null(pair)) return(NULL)
    tryCatch(.analitica_read_pair(pair, parent_meta), error = function(e) NULL)
  }
  parsed <- read_pair(fuente)
  if (is.null(parsed) && !identical(fuente, "originales")) parsed <- read_pair("originales")
  if (is.null(parsed) || !has_key(parsed$data)) return(NULL)
  list(data = parsed$data, inst = parsed$inst)
}

# Variables de caracterización de la madre a heredar: sus variables analizables
# (categóricas o numéricas) top-level, ya sin fantasmas de repeat (usa el mismo
# `.variables_desde_instrumento` que el picker, que aplica el filtro A).
.analitica_repeat_parent_car_vars <- function(parent_inst) {
  vars <- tryCatch(.variables_desde_instrumento(parent_inst), error = function(e) list())
  if (!length(vars)) return(character(0))
  keep <- vapply(vars, function(v) isTRUE(v$categorica) || isTRUE(v$numerica), logical(1))
  nms <- vapply(vars[keep], function(v) as.character(v$name %||% ""), character(1))
  unique(nms[nzchar(nms)])
}

# rbind tolerante a columnas distintas: une por la unión de nombres, rellenando
# las ausentes con NA. Ambos survey vienen de reporte_instrumento (columnas
# compatibles en el caso común), pero un XLSForm de madre puede traer columnas
# extra; alinear evita romper el rbind.
.analitica_repeat_rbind_fill <- function(a, b) {
  if (is.null(a) || !nrow(a)) return(b)
  if (is.null(b) || !nrow(b)) return(a)
  cols <- union(names(a), names(b))
  fill <- function(df) {
    for (cn in setdiff(cols, names(df))) df[[cn]] <- NA
    df[, cols, drop = FALSE]
  }
  rbind(fill(a), fill(b), stringsAsFactors = FALSE)
}

# Toma filas de una columna por posición preservando attrs no estándar (measure,
# label). base `[` conserva `labels` de haven_labelled pero dropea `measure`.
.analitica_repeat_take_rows <- function(col, pos) {
  out <- col[pos]
  m <- attr(col, "measure", exact = TRUE)
  if (!is.null(m) && is.null(attr(out, "measure", exact = TRUE))) attr(out, "measure") <- m
  lab <- attr(col, "label", exact = TRUE)
  if (!is.null(lab)) attr(out, "label") <- lab
  out
}

# Agrega al instrumento de la hija las variables `vars` de la madre: filas de
# survey (+ survey_raw), choices de sus list_names, y las entradas de
# var_labels/orders_list/dicc/measure_rules, para que aparezcan en el picker y
# se etiqueten en los cruces. Marca las filas con `parent_inherited = TRUE`.
.analitica_repeat_merge_inst <- function(child_inst, parent_inst, vars) {
  vars <- unique(as.character(vars %||% character(0)))
  if (!length(vars) || is.null(parent_inst$survey)) return(child_inst)
  psv <- parent_inst$survey
  if (!"name" %in% names(psv)) return(child_inst)
  sel <- as.character(psv$name) %in% vars
  if (!any(sel)) return(child_inst)

  add_rows <- psv[sel, , drop = FALSE]
  add_rows$parent_inherited <- TRUE
  child_inst$survey <- .analitica_repeat_rbind_fill(child_inst$survey, add_rows)

  # survey_raw: alinear para que la preferencia de label (label::Spanish) del
  # picker siga funcionando cuando existe.
  if (!is.null(parent_inst$survey_raw) && !is.null(child_inst$survey_raw)) {
    praw <- parent_inst$survey_raw
    if ("name" %in% names(praw)) {
      raw_sel <- as.character(praw$name) %in% vars
      if (any(raw_sel)) {
        child_inst$survey_raw <- .analitica_repeat_rbind_fill(
          child_inst$survey_raw, praw[raw_sel, , drop = FALSE])
      }
    }
  }

  # list_names implicadas -> choices + diccionarios por lista.
  lns <- character(0)
  if ("list_name" %in% names(add_rows)) {
    lns <- unique(as.character(add_rows$list_name))
    lns <- lns[!is.na(lns) & nzchar(lns)]
  }
  if (length(lns) && !is.null(parent_inst$choices) && !is.null(child_inst$choices) &&
      "list_name" %in% names(parent_inst$choices)) {
    pch <- parent_inst$choices
    ch_sel <- as.character(pch$list_name) %in% lns
    existing <- if ("list_name" %in% names(child_inst$choices)) {
      unique(as.character(child_inst$choices$list_name))
    } else character(0)
    ch_sel <- ch_sel & !(as.character(pch$list_name) %in% existing)
    if (any(ch_sel)) {
      child_inst$choices <- .analitica_repeat_rbind_fill(
        child_inst$choices, pch[ch_sel, , drop = FALSE])
    }
  }

  # Diccionarios por list_name.
  for (fld in c("dicc_code_to_label", "dicc_label_to_code")) {
    pv <- parent_inst[[fld]]
    if (is.null(pv)) next
    child_inst[[fld]] <- child_inst[[fld]] %||% list()
    for (ln in lns) {
      if (!is.null(pv[[ln]]) && is.null(child_inst[[fld]][[ln]])) {
        child_inst[[fld]][[ln]] <- pv[[ln]]
      }
    }
  }

  # Entradas por variable: orders_list + var_labels.
  if (!is.null(parent_inst$orders_list)) {
    child_inst$orders_list <- child_inst$orders_list %||% list()
    for (v in vars) {
      if (!is.null(parent_inst$orders_list[[v]]) && is.null(child_inst$orders_list[[v]])) {
        child_inst$orders_list[[v]] <- parent_inst$orders_list[[v]]
      }
    }
  }
  if (!is.null(parent_inst$var_labels)) {
    pvl <- parent_inst$var_labels
    take <- intersect(vars, names(pvl))
    new_take <- setdiff(take, names(child_inst$var_labels %||% character(0)))
    if (length(new_take)) {
      child_inst$var_labels <- c(child_inst$var_labels %||% character(0), pvl[new_take])
    }
  }

  # measure_rules (data.frame por variable), si existe.
  if (is.data.frame(parent_inst$measure_rules) && "name" %in% names(parent_inst$measure_rules)) {
    pmr <- parent_inst$measure_rules
    mr_sel <- as.character(pmr$name) %in% vars
    existing_mr <- if (is.data.frame(child_inst$measure_rules) &&
                       "name" %in% names(child_inst$measure_rules)) {
      as.character(child_inst$measure_rules$name)
    } else character(0)
    mr_sel <- mr_sel & !(as.character(pmr$name) %in% existing_mr)
    if (any(mr_sel)) {
      child_inst$measure_rules <- .analitica_repeat_rbind_fill(
        child_inst$measure_rules, pmr[mr_sel, , drop = FALSE])
    }
  }

  child_inst
}

#' Enriquece el par (data, inst) de UNA base con la caracterización de su madre.
#'
#' Núcleo compartido por el hook de maps (`.analitica_enrich_repeat_child_with_parent`)
#' y por el path de base activa (`.load_rp_data`). Para bases que NO son
#' `kobo_repeat` devuelve el par intacto y `grain = NULL`. Para bases hija:
#'   - calcula el meta de grano (siempre, aunque la madre no esté cargada),
#'   - carga la madre y agrega sus variables de caracterización a data + inst,
#'   - degrada sin romper si la madre no está disponible o falta la llave.
#' Idempotente: sólo agrega variables ausentes de la hija (data e inst).
#' @keywords internal
.analitica_enrich_child_pair <- function(sid, base_name, child_data, child_inst,
                                         cfg = NULL, data_sources = NULL,
                                         inst_sources = NULL) {
  base_meta <- .analitica_repeat_child_meta(sid, base_name)
  if (is.null(base_meta)) {
    return(list(data = child_data, inst = child_inst, grain = NULL, enriched = FALSE))
  }

  grain <- .analitica_repeat_grain(child_data, base_meta)
  parent_base <- as.character(base_meta$parent_base %||% "")
  link_key <- as.character(base_meta$link_key %||% "_parent_index")
  parent_index_key <- as.character(base_meta$parent_index_key %||% "_index")
  fb_child <- as.character(base_meta$link_key_fallback %||% "_submission__id")
  fb_parent <- "_id"  # contraparte canónica de `_submission__id` en la madre

  # La hija DEBE traer alguna llave de enlace para poder cruzar.
  child_has_link <- is.data.frame(child_data) &&
    (link_key %in% names(child_data) || fb_child %in% names(child_data))
  if (!child_has_link) {
    return(list(data = child_data, inst = child_inst, grain = grain, enriched = FALSE))
  }

  parent <- .analitica_repeat_parent_pair(
    sid, parent_base, cfg = cfg,
    data_sources = data_sources, inst_sources = inst_sources,
    need_key = parent_index_key, need_fallback = fb_parent)
  if (is.null(parent)) {
    return(list(data = child_data, inst = child_inst, grain = grain, enriched = FALSE))
  }

  car_vars <- .analitica_repeat_parent_car_vars(parent$inst)
  car_vars <- intersect(car_vars, names(parent$data))
  # Idempotencia + no colisionar con columnas propias/técnicas de la hija.
  existing <- unique(c(
    names(child_data),
    as.character((child_inst$survey %||% list())$name %||% character(0))
  ))
  car_vars <- setdiff(car_vars, existing)
  car_vars <- car_vars[!startsWith(car_vars, "_")]
  if (!length(car_vars)) {
    return(list(data = child_data, inst = child_inst, grain = grain, enriched = FALSE))
  }

  pos <- .dn_repeat_parent_row_positions(
    child_data, parent$data,
    link_key = link_key, parent_index_key = parent_index_key,
    fallback_child_key = fb_child, fallback_parent_key = fb_parent)
  if (!length(pos) || length(pos) != nrow(child_data)) {
    return(list(data = child_data, inst = child_inst, grain = grain, enriched = FALSE))
  }

  for (cc in car_vars) {
    col <- .analitica_repeat_take_rows(parent$data[[cc]], pos)
    attr(col, "repeat_inherited") <- TRUE
    attr(col, "repeat_parent_base") <- parent_base
    child_data[[cc]] <- col
  }
  child_inst <- .analitica_repeat_merge_inst(child_inst, parent$inst, car_vars)

  list(data = child_data, inst = child_inst, grain = grain,
       enriched = TRUE, inherited_vars = car_vars)
}

#' Hook de maps: enriquece toda base hija repeat presente en `data_sources`.
#'
#' Sigue el patrón de `.analitica_patch_data_sources_integrated`: parchea AMBOS
#' maps (data + inst) in situ para las bases `kobo_repeat`, dejando intactas las
#' demás. Además marca el grano en el inst enriquecido (`attr(., "repeat_grain")`).
#' @keywords internal
.analitica_enrich_repeat_child_with_parent <- function(sid, data_sources, inst_sources,
                                                       cfg = NULL) {
  if (!length(data_sources)) return(list(data_sources = data_sources, inst_sources = inst_sources))
  for (nombre in names(data_sources)) {
    if (is.null(.analitica_repeat_child_meta(sid, nombre))) next
    res <- tryCatch(
      .analitica_enrich_child_pair(
        sid, nombre, data_sources[[nombre]], inst_sources[[nombre]],
        cfg = cfg, data_sources = data_sources, inst_sources = inst_sources),
      error = function(e) NULL)
    if (is.null(res)) next
    data_sources[[nombre]] <- res$data
    if (!is.null(res$grain)) attr(res$inst, "repeat_grain") <- res$grain
    inst_sources[[nombre]] <- res$inst
  }
  list(data_sources = data_sources, inst_sources = inst_sources)
}

#' Enriquece el par (rp_inst, rp_data) de la base ACTIVA (path `.load_rp_data`).
#'
#' Determina el nombre de la base activa desde su meta; si es una hija repeat,
#' enriquece y deja el grano en `attr(rp_inst, "repeat_grain")`. Para el resto
#' devuelve el par intacto. Resiliente: cualquier error deja el par sin tocar.
#' @keywords internal
.analitica_repeat_enrich_active <- function(sid, rp_inst, rp_data, cfg = NULL) {
  out <- list(rp_inst = rp_inst, rp_data = rp_data)
  base_meta <- tryCatch(.analitica_single_base_meta(sid), error = function(e) NULL)
  base_name <- as.character((base_meta %||% list())$nombre %||% "")
  if (!nzchar(base_name) || is.null(.analitica_repeat_child_meta(sid, base_name))) return(out)
  res <- tryCatch(
    .analitica_enrich_child_pair(sid, base_name, rp_data, rp_inst, cfg = cfg),
    error = function(e) NULL)
  if (is.null(res)) return(out)
  inst <- res$inst
  # El grano se calcula desde la data de la PROPIA hija (distinct `_parent_index`),
  # no desde `rp_data` (que en estudios repeat es la base "first"/madre por el
  # override de `.analitica_prepare_context`); si no, `n_personas` saldría NA y
  # `n_instancias` = filas de la madre. Ver `.analitica_active_repeat_grain`.
  grain <- .analitica_active_repeat_grain(sid, cfg) %||% res$grain
  if (!is.null(grain)) attr(inst, "repeat_grain") <- grain
  list(rp_inst = inst, rp_data = res$data)
}
