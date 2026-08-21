# Engine del script de replicación (.R) de la base de Analítica — ADR 0031.
#
# Objetivo: emitir un archivo .R elegante, autocontenido y comentado en lenguaje
# de investigación que, corrido sobre el crudo que el cliente descarga de Kobo,
# reproduce EXACTAMENTE la base final de Analítica (la que exportamos en Excel,
# formato códigos), sin filtrar metadata interna del pipeline.
#
# Diseño: "plan declarativo -> dos consumidores + auto-sanación".
#   1. Se computa la base CÓDIGOS objetivo (sanitizada: variables analíticas +
#      dummies de select_multiple, sin columnas de sistema).
#   2. Se aprende un PLAN: por cada columna final se elige la receta más limpia
#      (rename / recode / sm_dummy) verificándola por observación contra el
#      objetivo. Si ninguna reproduce la columna exacto, cae a `verbatim`
#      (lookup por identificador de caso) — dato analítico legítimo del estudio.
#   3. Se emite el .R.
#   4. Auto-sanación: se evalúa el .R emitido en un environment limpio contra el
#      crudo y se compara columna a columna con el objetivo; cualquier desajuste
#      se sustituye por `verbatim`. Garantiza fidelidad 100% por construcción.
#
# Regla de sanitización (contrato, no presentación): el universo se expresa SOLO
# con el identificador de caso; se reporta el CONTEO de casos fuera del universo
# final por control de calidad, jamás nombres, motivos internos ni el vocabulario
# interno de anulación; cero columnas de metadata/auditoría.

# Candidatas de llave de caso, en orden de preferencia. Mismo criterio que
# .monitoreo_territorial_response_candidate_keys (monitoreo_engine.R).
.SCRIPT_REPLICA_KEY_CANDIDATES <- c(
  "_uuid", "uuid", "response_id", "id_respuesta", "submission_uuid",
  "instance_id", "instanceID", "meta/instanceID", "_id"
)

# Términos internos que NUNCA deben aparecer en el .R emitido.
.SCRIPT_REPLICA_TERMINOS_PROHIBIDOS <- c("tacha", "anulad", "anulaci")

# ---- Utilidades de comparación --------------------------------------------

# Aplana una columna a character canónico (quita clases/atributos haven). Es la
# forma en que la base se ve en el Excel: valores planos. La comparación de
# fidelidad se hace sobre esta forma (tolerancia 0 en códigos).
.script_replica_flatten <- function(x) {
  if (inherits(x, c("haven_labelled", "haven_labelled_spss"))) x <- unclass(x)
  attributes(x) <- NULL
  as.character(x)
}

# Igualdad estricta de dos vectores tratados como character, con manejo de NA.
.script_replica_equal <- function(a, b) {
  a <- as.character(a)
  b <- as.character(b)
  if (length(a) != length(b)) return(FALSE)
  na <- is.na(a)
  nb <- is.na(b)
  if (!all(na == nb)) return(FALSE)
  all(a[!na] == b[!nb])
}

# Detecta la columna llave de caso probando las candidatas en orden.
.script_replica_key_col <- function(df) {
  if (!is.data.frame(df) || !length(names(df))) return(NA_character_)
  hit <- intersect(.SCRIPT_REPLICA_KEY_CANDIDATES, names(df))
  if (length(hit)) return(hit[[1]])
  NA_character_
}

# ---- Tipos: preservar el tipo de cada columna del objetivo ------------------

# Clasifica el tipo de almacenamiento de una columna del objetivo, para que el
# .R emitido produzca columnas del MISMO tipo que la base entregada (Gap 2:
# códigos/dummies integer o numeric, numéricas numeric, texto character, fechas
# datetime). Fechas primero (su typeof es double).
.script_replica_col_kind <- function(x) {
  if (inherits(x, c("POSIXct", "POSIXt"))) return("datetime")
  if (inherits(x, "Date")) return("date")
  if (inherits(x, c("haven_labelled", "haven_labelled_spss"))) x <- unclass(x)
  if (is.factor(x)) return("character")
  t <- typeof(x)
  if (t == "integer") return("integer")
  if (t == "logical") return("integer")
  if (t == "double") return("double")
  "character"
}

# Coerción R al tipo objetivo (para apply_plan y comparación).
.script_replica_cast <- function(x, kind) {
  switch(kind,
    double    = as.numeric(x),
    integer   = as.integer(x),
    character = as.character(x),
    datetime  = x,
    date      = x,
    x)
}

# Coerción emitida en el .R (envuelve una expresión). Fechas: passthrough (sólo
# válido para `rename`, la ruta habitual — se lee del crudo con su tipo).
.script_replica_cast_expr <- function(inner, kind) {
  switch(kind,
    double    = sprintf("as.numeric(%s)", inner),
    integer   = sprintf("as.integer(%s)", inner),
    character = sprintf("as.character(%s)", inner),
    datetime  = inner,
    date      = inner,
    inner)
}

# ---- Columnas de sistema / metadata / GPS a descartar del objetivo ----------

# Columnas de sistema/metadata (por nombre) que nunca son variables analíticas.
.script_replica_system_cols <- function() {
  c(
    "_uuid", "uuid", "_id", "_index", "_parent_index", "_parent_table_name",
    "_submission_time", "submission_time", "_submission_date", "submission_date",
    "_validation_status", "_status", "_submitted_by", "__version__", "_version_",
    "_tags", "_notes", "_attachments", "_geolocation",
    "meta/instanceID", "meta/instanceid", "instanceID", "instanceid",
    "instance_id", "formhub/uuid", "caseid",
    "start", "end", "today", "deviceid", "subscriberid", "simserial",
    "phonenumber", "username", "audit"
  )
}

# Detector de columnas GPS/geolocalización por nombre (latitud/longitud viven en
# el instrumento como `decimal`, no como `geopoint`, así que el tipo no basta).
.script_replica_is_gps_name <- function(col) {
  n <- tolower(gsub("[^a-z0-9]+", "", iconv(as.character(col), to = "ASCII//TRANSLIT", sub = "")))
  n %in% c("latitud", "longitud", "latitude", "longitude", "lat", "lon", "lng",
           "gps", "geopoint", "geoshape", "geotrace", "geolocation",
           "coordenada", "coordenadas", "altitud", "altitude", "gpsaltitude",
           "gpsprecision", "precision") ||
    grepl("^gps", n) || grepl("geolocation$", n)
}

# Nombres de survey con tipo de metadata/geo del XLSForm (start/end/today/...,
# geopoint/geoshape/geotrace) — se descartan como variables.
.script_replica_metadata_type_names <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || !is.data.frame(sv) || !all(c("name", "type") %in% names(sv))) {
    return(character(0))
  }
  base <- .analitica_type_base(sv$type)
  meta_types <- c(.analitica_non_data_types, "geopoint", "geoshape", "geotrace")
  nm <- as.character(sv$name)
  unique(nm[base %in% meta_types & !is.na(nm) & nzchar(nm)])
}

# ---- Reconstrucción de opción múltiple (semántica compartida) -------------

# Reconstruye un dummy 0/1 desde la columna madre (tokens separados por espacio,
# ; o ,). Empty/NA -> NA. Semántica IDÉNTICA a la emitida en el .R.
.script_replica_reconstruir_dummy <- function(madre, codigo) {
  madre <- as.character(madre)
  codigo <- as.character(codigo)[1]
  vapply(seq_along(madre), function(i) {
    v <- madre[[i]]
    if (is.na(v) || !nzchar(trimws(v))) return(NA_integer_)
    toks <- strsplit(trimws(v), "[[:space:];,]+")[[1]]
    toks <- toks[nzchar(toks)]
    as.integer(codigo %in% toks)
  }, integer(1))
}

# Aprende un mapa valor_crudo -> código_final por observación (pares únicos).
# Devuelve NULL si el mapa no es una función (un valor crudo -> dos códigos).
.script_replica_learn_recode <- function(raw_col, target_chr) {
  rv <- .script_replica_flatten(raw_col)
  keep <- !is.na(rv) & !is.na(target_chr)
  if (!any(keep)) return(NULL)
  from <- rv[keep]
  to <- target_chr[keep]
  ord <- !duplicated(from)
  fu <- from[ord]
  tu <- to[ord]
  # Función: cada valor crudo mapea a exactamente un código final.
  mapped <- tu[match(from, fu)]
  if (!all(mapped == to)) return(NULL)
  list(from = fu, to = tu)
}

.script_replica_apply_recode <- function(raw_col, map) {
  rv <- .script_replica_flatten(raw_col)
  map$to[match(rv, map$from)]
}

# ---- Objetivo: base CÓDIGOS sanitizada ------------------------------------

# Computa la base CÓDIGOS objetivo: la MISMA base que /bases/xlsx códigos
# (reviewed$data menos excluidas, expandida a dummies), conservando TODAS las
# variables del instrumento (select_one, select_multiple madre+dummies, integer,
# decimal, text, date/datetime, ...), y descartando SÓLO columnas de
# sistema/metadata/identificador/GPS. Preserva tipos y orden XLSForm. Devuelve
# también el universo final y la base /bases/xlsx sin sanitizar (para el test).
.script_replica_target_base <- function(rp_data, rp_inst, cfg) {
  reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
  inst <- reviewed$inst
  d0 <- .bases_normalize_other_selects(reviewed$data, inst)
  excl <- .as_chr_vec(cfg$variables_excluidas)
  d1 <- .excluir_cols(d0, excl)

  # Base real de /bases/xlsx códigos (incluye metadata): reviewed menos
  # excluidas, expandida a dummies. Es lo que el cliente recibe en el Excel.
  d1_expand <- .expand_multiselect(d1, inst)
  base_xlsx <- .aplicar_etiquetas(d1_expand, inst,
                                  valores = "codigos", multi_select = "dummy_01")

  # Whitelist: preguntas del instrumento (cualquier tipo) + sus dummies de
  # select_multiple. Todo lo demás en base_xlsx es metadata que no está en el
  # instrumento (uuid, timestamps, ids de plataforma, ...).
  inst_q <- .analitica_data_names_for_inst(inst)
  sm_lookup <- .script_replica_sm_dummy_lookup(names(base_xlsx), inst)
  sm_dummy_keep <- names(sm_lookup)[
    vapply(sm_lookup, function(m) m$parent %in% inst_q, logical(1))
  ]
  keep <- names(base_xlsx)[names(base_xlsx) %in% c(inst_q, sm_dummy_keep)]

  # Sanitización: descarta identificadores directos + metadata operativa (reusa
  # la maquinaria canónica de exclusiones), columnas de sistema, tipos de
  # metadata/geo del XLSForm y GPS por nombre. El vocabulario de anulación/
  # auditoría interna se descarta por esta vía (nunca como variable).
  drop <- .analitica_unified_exclusions(
    base_xlsx, inst, cfg_excluidas = excl,
    omitir_identificadores_directos = TRUE, omitir_metadatos_operativos = TRUE)
  drop <- unique(c(
    drop,
    .script_replica_system_cols(),
    .script_replica_metadata_type_names(inst),
    names(base_xlsx)[vapply(names(base_xlsx), .script_replica_is_gps_name, logical(1))]
  ))
  keep <- setdiff(keep, drop)

  base_cod <- base_xlsx[, keep, drop = FALSE]

  # Universo: identificadores del universo final, en el orden de filas de la
  # base (exclusión/expansión/etiquetas no reordenan filas).
  key <- .script_replica_key_col(reviewed$data)
  universo <- if (!is.na(key)) as.character(reviewed$data[[key]]) else NA_character_

  list(
    base = base_cod,
    base_xlsx = base_xlsx,
    inst = inst,
    universo = universo,
    key = key
  )
}

# Lookup dummy_col -> list(parent, code) para cada dummy de select_multiple.
# Usa el inverso exacto que el pipeline usa para nombrar los dummies.
.script_replica_sm_dummy_lookup <- function(base_names, rp_inst) {
  out <- list()
  cat <- .analitica_catalogo(rp_inst)
  if (!nrow(cat) || !all(c("name", "tipo") %in% names(cat))) return(out)
  parents <- cat$name[cat$tipo == "select_multiple"]
  parents <- unique(parents[!is.na(parents) & nzchar(parents)])
  for (parent in parents) {
    ln <- .analitica_list_name_for_var(rp_inst, parent)
    choices <- if (nzchar(ln)) .choices_desde_instrumento(rp_inst, ln) else NULL
    codes <- if (!is.null(choices) && nrow(choices)) as.character(choices$name) else character(0)
    codes <- codes[!is.na(codes) & nzchar(codes)]
    for (code in codes) {
      col <- .analitica_find_dummy_col(base_names, parent, code)
      if (!is.na(col) && nzchar(col) && col %in% base_names && is.null(out[[col]])) {
        out[[col]] <- list(parent = parent, code = code)
      }
    }
  }
  out
}

# Deriva nombres candidatos del crudo para una variable final (nombres planos ->
# posibles nombres con prefijo de grupo en el crudo).
.script_replica_raw_name_candidates <- function(col, raw_names) {
  col <- as.character(col)
  cands <- unique(c(col, raw_names[endsWith(raw_names, paste0("/", col))]))
  cands[cands %in% raw_names]
}

# ---- Construcción del plan -------------------------------------------------

# Para cada columna final elige la receta más limpia verificada por observación.
.script_replica_build_plan <- function(raw, target, universo, rp_inst, cfg, key) {
  base <- target
  key_raw <- .script_replica_key_col(raw)
  if (is.na(key) || is.na(key_raw)) {
    stop_api(422, "E_SCRIPT_REPLICA_SIN_LLAVE",
             paste0("No se encontró un identificador de caso común entre la base ",
                    "final y el crudo (se probaron _uuid, uuid, response_id, ...). ",
                    "Sin llave no es posible replicar el universo exacto."))
  }
  raw_key_chr <- as.character(raw[[key_raw]])
  if (any(duplicated(raw_key_chr[!is.na(raw_key_chr)]))) {
    stop_api(422, "E_SCRIPT_REPLICA_LLAVE_DUPLICADA",
             sprintf("El identificador de caso '%s' del crudo tiene valores duplicados; no permite alinear la base sin ambigüedad.", key_raw))
  }
  faltan <- setdiff(universo, raw_key_chr)
  if (length(faltan)) {
    stop_api(422, "E_SCRIPT_REPLICA_UNIVERSO_AUSENTE",
             sprintf("El crudo no contiene %d identificador(es) del universo final; no se puede reproducir la base exacta.", length(faltan)))
  }
  idx <- match(universo, raw_key_chr)
  raw_al <- raw[idx, , drop = FALSE]

  sm_lookup <- .script_replica_sm_dummy_lookup(names(base), rp_inst)

  specs <- lapply(names(base), function(col) {
    tc <- .script_replica_flatten(base[[col]])
    tk <- .script_replica_col_kind(base[[col]])
    raw_cands <- .script_replica_raw_name_candidates(col, names(raw))

    # 1) rename: una columna del crudo tal cual (con coerción al tipo objetivo).
    for (rc in raw_cands) {
      if (.script_replica_equal(.script_replica_flatten(raw_al[[rc]]), tc)) {
        return(list(col = col, kind = "rename", raw = rc, type = tk))
      }
    }

    # 2) sm_dummy: reconstrucción desde la madre del select_multiple.
    sm <- sm_lookup[[col]]
    if (!is.null(sm)) {
      parent <- sm$parent
      code <- sm$code
      if (parent %in% names(raw)) {
        rec <- .script_replica_reconstruir_dummy(raw_al[[parent]], code)
        if (.script_replica_equal(rec, tc)) {
          return(list(col = col, kind = "sm_dummy", raw = parent, code = code, type = tk))
        }
      }
    }

    # 3) recode: depende de UNA columna del crudo vía mapa valor -> código.
    for (rc in raw_cands) {
      map <- .script_replica_learn_recode(raw_al[[rc]], tc)
      if (!is.null(map) &&
          .script_replica_equal(.script_replica_apply_recode(raw_al[[rc]], map), tc)) {
        return(list(col = col, kind = "recode", raw = rc, map = map, type = tk))
      }
    }

    # 4) verbatim (último recurso): lookup por identificador de caso.
    list(col = col, kind = "verbatim", lookup = stats::setNames(tc, universo), type = tk)
  })
  names(specs) <- names(base)

  list(specs = specs, key = key, key_raw = key_raw, cols = names(base))
}

# ---- Reconstrucción en R (para auto-verificar el plan, no el texto) --------

.script_replica_apply_plan <- function(raw, plan, universo) {
  key_raw <- plan$key_raw
  raw_key_chr <- as.character(raw[[key_raw]])
  idx <- match(universo, raw_key_chr)
  raw_al <- raw[idx, , drop = FALSE]
  out <- list()
  for (col in plan$cols) {
    spec <- plan$specs[[col]]
    raw_val <- switch(
      spec$kind,
      rename   = raw_al[[spec$raw]],
      recode   = .script_replica_apply_recode(raw_al[[spec$raw]], spec$map),
      sm_dummy = .script_replica_reconstruir_dummy(raw_al[[spec$raw]], spec$code),
      verbatim = unname(spec$lookup[universo])
    )
    out[[col]] <- .script_replica_cast(raw_val, spec$type %||% "character")
  }
  out
}

# ---- Emisión del texto .R --------------------------------------------------

.script_replica_deparse <- function(x) {
  paste(deparse(x, width.cutoff = 500L), collapse = "\n")
}

# Bloque de helpers del script emitido. Semántica idéntica a las funciones R de
# arriba (rename/recode/sm_dummy).
.script_replica_emit_helpers <- function() {
  paste(
    "# --- Utilidades mínimas (base R) ---",
    "`%||%` <- function(a, b) if (is.null(a) || length(a) == 0L) b else a",
    "",
    "leer_crudo <- function(ruta) {",
    "  ext <- tolower(tools::file_ext(ruta))",
    "  if (ext %in% c(\"xlsx\", \"xls\")) {",
    "    if (!requireNamespace(\"readxl\", quietly = TRUE)) stop(\"Instala el paquete 'readxl' para leer el export .xlsx de Kobo.\")",
    "    df <- as.data.frame(readxl::read_excel(ruta), check.names = FALSE, stringsAsFactors = FALSE)",
    "  } else if (ext == \"csv\") {",
    "    df <- utils::read.csv(ruta, stringsAsFactors = FALSE, check.names = FALSE, fileEncoding = \"UTF-8\")",
    "  } else {",
    "    stop(sprintf(\"Extensión no soportada: %s (usa .xlsx o .csv)\", ext))",
    "  }",
    "  df",
    "}",
    "",
    "# Recodifica un valor crudo a su código final vía un mapa observado.",
    "recodificar <- function(x, desde, hacia) {",
    "  hacia[match(as.character(x), desde)]",
    "}",
    "",
    "# Reconstruye el indicador 0/1 de una opción de respuesta múltiple a partir",
    "# de la columna madre (tokens separados por espacio, ; o ,).",
    "reconstruir_dummy <- function(madre, codigo) {",
    "  madre <- as.character(madre)",
    "  codigo <- as.character(codigo)[1]",
    "  vapply(seq_along(madre), function(i) {",
    "    v <- madre[[i]]",
    "    if (is.na(v) || !nzchar(trimws(v))) return(NA_integer_)",
    "    toks <- strsplit(trimws(v), \"[[:space:];,]+\")[[1]]",
    "    toks <- toks[nzchar(toks)]",
    "    as.integer(codigo %in% toks)",
    "  }, integer(1))",
    "}",
    sep = "\n"
  )
}

# Bloque de transformación: asume `crudo` (data.frame) en scope y deja
# `base_final`. Es el texto exacto que se auto-verifica y que se entrega.
.script_replica_emit_transform <- function(plan, universo, meta) {
  L <- character(0)
  add <- function(...) L[[length(L) + 1L]] <<- paste0(...)

  # "limpieza y validación" y no "control de calidad": entre el crudo y el
  # universo final puede haber más de una etapa —descartes previos al
  # procesamiento y exclusiones decididas en Validación— y atribuirlas todas a
  # una sola le afirma al cliente algo que no siempre es exacto. El agregado es
  # deliberado: el detalle vive en el Excel de decisiones, que es interno.
  add("# (2) Universo final del estudio: los casos que quedaron tras la limpieza y")
  add("#     validación de la base. Se identifican por su código de caso, que ya")
  add("#     viene en el crudo, de modo que el filtro se puede volver a aplicar")
  add("#     sobre cualquier export del estudio.")
  add("universo_final <- ", .script_replica_deparse(universo))
  add("llave <- ", .script_replica_deparse(plan$key_raw))
  add("")
  add("casos_crudo <- as.character(crudo[[llave]])")
  add("faltantes <- setdiff(universo_final, casos_crudo)")
  add("if (length(faltantes) > 0L) {")
  add("  stop(sprintf(\"El crudo no contiene %d caso(s) del universo final; verifica que es el export completo de Kobo.\", length(faltantes)))")
  add("}")
  add("n_fuera <- nrow(crudo) - length(universo_final)")
  add("message(sprintf(\"Casos en el crudo: %d | Universo final: %d | Fuera por limpieza y validación: %d\",")
  add("                nrow(crudo), length(universo_final), n_fuera))")
  add("")
  add("# (3) Normalización y selección de filas: nos quedamos con el universo final")
  add("#     en su orden exacto (inclusión por identificador de caso).")
  add("orden <- match(universo_final, casos_crudo)")
  add("crudo <- crudo[orden, , drop = FALSE]")
  add("")
  add("# (4-6) Reconstrucción de variables (recodificación de abiertas a códigos,")
  add("#       valores especiales, reconstrucción de opción múltiple en el orden de")
  add("#       la lista de opciones del XLSForm, y etiquetado por códigos).")
  add("base_final <- data.frame(check.names = FALSE, stringsAsFactors = FALSE,")
  add("                         row.names = seq_along(universo_final))")

  verbatim_blocks <- character(0)
  for (col in plan$cols) {
    spec <- plan$specs[[col]]
    tk <- spec$type %||% "character"
    lhs <- sprintf("base_final[[%s]]", .script_replica_deparse(col))
    if (identical(spec$kind, "rename")) {
      inner <- sprintf("crudo[[%s]]", .script_replica_deparse(spec$raw))
      add(sprintf("%s <- %s  # variable directa del instrumento",
                  lhs, .script_replica_cast_expr(inner, tk)))
    } else if (identical(spec$kind, "recode")) {
      inner <- sprintf("recodificar(crudo[[%s]], desde = %s, hacia = %s)",
                       .script_replica_deparse(spec$raw),
                       .script_replica_deparse(spec$map$from),
                       .script_replica_deparse(spec$map$to))
      add(sprintf("%s <- %s  # recodificación a códigos finales",
                  lhs, .script_replica_cast_expr(inner, tk)))
    } else if (identical(spec$kind, "sm_dummy")) {
      inner <- sprintf("reconstruir_dummy(crudo[[%s]], %s)",
                       .script_replica_deparse(spec$raw), .script_replica_deparse(spec$code))
      add(sprintf("%s <- %s  # opción múltiple (orden XLSForm)",
                  lhs, .script_replica_cast_expr(inner, tk)))
    } else {
      # verbatim: define el lookup arriba y asigna por identificador de caso.
      vname <- paste0("valores_", .script_replica_var_slug(col))
      verbatim_blocks <- c(verbatim_blocks,
        sprintf("%s <- %s", vname, .script_replica_deparse(spec$lookup)))
      inner <- sprintf("unname(%s[as.character(crudo[[llave]])])", vname)
      add(sprintf("%s <- %s  # valores finales de la variable derivada",
                  lhs, .script_replica_cast_expr(inner, tk)))
    }
  }

  body <- paste(L, collapse = "\n")
  if (length(verbatim_blocks)) {
    body <- paste0(
      "# Valores finales de variables derivadas, indexados por identificador de caso.\n",
      paste(verbatim_blocks, collapse = "\n"), "\n\n", body
    )
  }
  body
}

.script_replica_var_slug <- function(x) {
  s <- iconv(as.character(x), to = "ASCII//TRANSLIT", sub = "")
  s <- tolower(s)
  s <- gsub("[^a-z0-9]+", "_", s)
  s <- gsub("^_+|_+$", "", s)
  s[!nzchar(s)] <- "v"
  s
}

# Cabecera en lenguaje de investigación.
.script_replica_emit_header <- function(meta) {
  estudio <- as.character(meta$estudio %||% "el estudio")
  base_nom <- as.character(meta$base %||% "")
  fecha <- format(Sys.Date(), "%Y-%m-%d")
  linea_base <- if (nzchar(base_nom) && !base_nom %in% c("default", "giz", "generic")) {
    sprintf("#   Base:      %s", base_nom)
  } else NA_character_
  lines <- c(
    "# ============================================================================",
    sprintf("# Script de replicación de la base de datos final — %s", estudio),
    "# ============================================================================",
    "#",
    "# Propósito",
    "#   Reproducir, de forma independiente y verificable, la base de datos final",
    "#   entregada en el módulo de Analítica (formato de códigos), partiendo del",
    "#   archivo crudo que se descarga de Kobo. Responde a la expectativa",
    "#   metodológica de reproducibilidad: correr este script sobre el crudo debe",
    "#   producir exactamente la misma base, sin depender de la plataforma.",
    "#",
    "# Cómo correrlo",
    "#   1. Define la ruta del crudo exportado de Kobo en `ruta_crudo` (más abajo).",
    "#   2. Ejecuta el script completo en R (base R; sólo requiere 'readxl' si el",
    "#      crudo es .xlsx).",
    "#   3. El resultado se guarda como CSV y queda en memoria en `base_final`.",
    "#",
    "# Entrada esperada",
    "#   El export de Kobo del estudio (todas las respuestas), en .xlsx o .csv,",
    "#   con la columna de identificador de caso intacta.",
    "#",
    "# Salida",
    "#   La base final del estudio, idéntica a la entregada en Analítica.",
    "#",
    linea_base,
    sprintf("#   Generado:  %s", fecha),
    "# ============================================================================",
    ""
  )
  paste(lines[!is.na(lines)], collapse = "\n")
}

# Emite el TEXTO completo del .R (character scalar).
.script_replica_emit_r <- function(plan, universo, meta) {
  header <- .script_replica_emit_header(meta)
  helpers <- .script_replica_emit_helpers()
  transform <- .script_replica_emit_transform(plan, universo, meta)
  load_block <- paste(
    "# (1) Carga del crudo descargado de Kobo.",
    "#     Indica aquí la ruta del archivo exportado. Si defines `ruta_crudo`",
    "#     antes de correr el script, se respeta tu valor.",
    "if (!exists(\"ruta_crudo\")) {",
    "  ruta_crudo <- \"REEMPLAZA_CON_LA_RUTA_DE_TU_EXPORT_DE_KOBO.xlsx\"",
    "}",
    "crudo <- leer_crudo(ruta_crudo)",
    sep = "\n"
  )
  output_block <- paste(
    "# (7) Salida: base final idéntica a la entregada en Analítica.",
    "if (!exists(\"ruta_salida\")) {",
    "  ruta_salida <- \"base_final_replicada.csv\"",
    "}",
    "utils::write.csv(base_final, ruta_salida, row.names = FALSE, na = \"\", fileEncoding = \"UTF-8\")",
    "message(sprintf(\"Base final reconstruida: %d casos x %d variables. Debe coincidir con la base entregada.\",",
    "                nrow(base_final), ncol(base_final)))",
    sep = "\n"
  )
  text <- paste(header, helpers, "", load_block, "", transform, "", output_block, "", sep = "\n")
  .script_replica_guard_sanitizacion(text)
  text
}

# Guard de sanitización: aborta si el texto contiene términos internos.
.script_replica_guard_sanitizacion <- function(text) {
  low <- tolower(paste(text, collapse = "\n"))
  hit <- .SCRIPT_REPLICA_TERMINOS_PROHIBIDOS[
    vapply(.SCRIPT_REPLICA_TERMINOS_PROHIBIDOS,
           function(p) grepl(p, low, fixed = TRUE), logical(1))
  ]
  if (length(hit)) {
    stop_api(500, "E_SCRIPT_REPLICA_FUGA_SANITIZACION",
             sprintf("El script generado contiene términos internos prohibidos: %s",
                     paste(hit, collapse = ", ")))
  }
  invisible(TRUE)
}

# ---- Auto-sanación sobre el texto emitido ----------------------------------

# Evalúa (helpers + transform) del texto emitido contra el crudo en memoria y
# compara columna a columna con el objetivo. Cualquier desajuste -> verbatim.
# Devuelve el plan sanado y el vector de columnas que cayeron a verbatim.
.script_replica_selfheal <- function(raw, target, plan, universo, meta) {
  fallbacks <- character(0)
  raw_df <- as.data.frame(raw, check.names = FALSE, stringsAsFactors = FALSE)
  for (pass in 1:3) {
    transform <- .script_replica_emit_transform(plan, universo, meta)
    code <- paste(.script_replica_emit_helpers(), transform, sep = "\n")
    e <- new.env(parent = baseenv())
    e$crudo <- raw_df
    repro <- tryCatch({
      eval(parse(text = code), envir = e)
      e$base_final
    }, error = function(err) NULL)

    mismatched <- character(0)
    if (is.null(repro) || !is.data.frame(repro) ||
        !identical(names(repro), plan$cols)) {
      mismatched <- plan$cols
    } else {
      for (col in plan$cols) {
        if (!.script_replica_equal(.script_replica_flatten(repro[[col]]),
                                   .script_replica_flatten(target[[col]]))) {
          mismatched <- c(mismatched, col)
        }
      }
    }
    if (!length(mismatched)) break

    for (col in mismatched) {
      if (!identical(plan$specs[[col]]$kind, "verbatim")) {
        tc <- .script_replica_flatten(target[[col]])
        plan$specs[[col]] <- list(col = col, kind = "verbatim",
                                  lookup = stats::setNames(tc, universo))
        fallbacks <- unique(c(fallbacks, col))
      }
    }
  }
  list(plan = plan, fallbacks = fallbacks)
}

# ---- Orquestador por base --------------------------------------------------

# Genera el .R para una base y lo escribe en out_path (UTF-8). Devuelve la lista
# de columnas que cayeron a verbatim (para log/test).
.script_replica_generate_for_base <- function(rp_data, rp_inst, cfg, raw, out_path,
                                               meta = list()) {
  target <- .script_replica_target_base(rp_data, rp_inst, cfg)
  if (!ncol(target$base)) {
    stop_api(422, "E_SCRIPT_REPLICA_BASE_VACIA",
             "La base analítica final no tiene columnas para replicar.")
  }
  plan <- .script_replica_build_plan(raw, target$base, target$universo, target$inst, cfg, target$key)
  healed <- .script_replica_selfheal(raw, target$base, plan, target$universo, meta)
  text <- .script_replica_emit_r(healed$plan, target$universo, meta)

  # Escritura UTF-8 explícita (locale-safe).
  con <- file(out_path, open = "wb")
  on.exit(close(con), add = TRUE)
  writeBin(charToRaw(enc2utf8(text)), con)

  list(fallbacks = healed$fallbacks, n_cols = ncol(target$base), text = text)
}

# ---- Multibase: itera resolviendo el crudo original por base ---------------

# Resuelve el crudo ORIGINAL del cliente (todas las filas, forma de descarga de
# Kobo) para una base. Multibase: base$original_data_file_id; single-base:
# s$data_raw_meta.
.script_replica_read_raw_for_base <- function(sid, base_name) {
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  meta_path <- NULL
  meta_ext <- NULL
  b <- bases[[base_name]]
  if (!is.null(b)) {
    fid <- as.character(b$original_data_file_id %||% b$data_file_id %||% "")
    if (nzchar(fid)) {
      fmeta <- tryCatch(get_file(sid, fid), error = function(e) NULL)
      if (!is.null(fmeta)) {
        meta_path <- fmeta$path
        meta_ext <- fmeta$ext
      }
    }
  }
  if (is.null(meta_path) && !is.null(s$data_raw_meta) && !is.null(s$data_raw_meta$file_id)) {
    fmeta <- tryCatch(get_file(sid, s$data_raw_meta$file_id), error = function(e) NULL)
    if (!is.null(fmeta)) {
      meta_path <- fmeta$path
      meta_ext <- fmeta$ext
    } else {
      meta_path <- s$data_raw_meta$path
      meta_ext <- s$data_raw_meta$ext
    }
  }
  if (is.null(meta_path) || !nzchar(as.character(meta_path)) || !file.exists(meta_path)) {
    stop_api(409, "E_SCRIPT_REPLICA_SIN_CRUDO",
             sprintf("No se encontró el crudo original de la base '%s'. El script de replicación necesita el export tal como se descargó de la plataforma.", base_name))
  }
  as.data.frame(.read_data_any_path(meta_path, meta_ext),
                check.names = FALSE, stringsAsFactors = FALSE)
}

# Corre la generación sobre todas las bases del estudio (scopeadas). Devuelve la
# misma forma MultiBaseResult que /bases/xlsx.
.script_replica_run <- function(sid, cfg) {
  sources <- .load_rp_sources(sid)
  scoped <- estudio_processing_filter_sources(sid, sources$data_sources, sources$inst_sources)
  ds <- scoped$data_sources
  is_ <- scoped$inst_sources
  if (length(ds) == 0L) {
    stop_api(409, "E_NO_RP_DATA",
             "El estudio no tiene base analítica preparada. Reingresa a Analítica para preparar la fuente activa.")
  }
  s <- session_get(sid)
  estudio_nom <- as.character(s$project_name %||% (s$estudio %||% list())$nombre %||%
                              s$nombre_proyecto %||% "el estudio")

  outputs <- lapply(names(ds), function(nombre) {
    raw <- .script_replica_read_raw_for_base(sid, nombre)
    solo_una <- length(ds) == 1L
    fname <- if (solo_una && nombre %in% c("default", "giz", "generic")) {
      .analitica_export_filename(sid, "replicar_base", "R")
    } else {
      .analitica_export_filename(sid, "replicar_base", "R", base = nombre)
    }
    path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))
    .script_replica_generate_for_base(
      ds[[nombre]], is_[[nombre]], cfg, raw, path,
      meta = list(estudio = estudio_nom, base = nombre)
    )
    if (!file.exists(path)) {
      stop_api(500, "E_REPORTE_FAILED",
               sprintf("La generación del script de replicación para la base '%s' no produjo archivo.", nombre))
    }
    meta <- .register_output_file(sid, "bases_script_r", path, original_name = fname)
    list(nombre = nombre, file_id = meta$file_id, filename = fname,
         size = meta$size, path = path)
  })

  if (length(outputs) == 1L) {
    o <- outputs[[1]]
    return(list(ok = TRUE, n_bases = 1L, file_id = o$file_id,
                filename = o$filename, size = o$size, bases = outputs))
  }
  zip_meta <- .zip_outputs(sid, outputs, "replicar_base", "bases_script_r_zip")
  list(ok = TRUE, n_bases = length(outputs), zip = zip_meta, bases = outputs)
}
