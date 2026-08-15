# Reconciliación de variables data↔XLSForm.
#
# Cuando llega data a un proyecto (upload manual o handoff de Monitoreo), Kobo
# puede arrastrar columnas de versiones VIEJAS del formulario que ya no viven en
# el XLSForm actual, más derivadas de plataforma (`dim_*`, `perception_*`,
# `A1_rec`, …). Esas "extra sustantivas" quedan EXCLUIDAS del volcado de la BBDD
# por defecto; el usuario puede optar por INCLUIR algunas. La decisión se
# persiste por base en la config de Analítica (`variables_extra_incluidas`).
#
# Definición robusta de "extra": una columna es EXTRA (a reconciliar) solo si su
# STEM RESUELTO no matchea ningún nombre de `inst$survey$name` (case-insensitive),
# y además no es metadata Kobo, ni identificador de caso de otra plataforma
# (`respondent_id` de SurveyMonkey y hermanos), ni columna interna de plumbing.
#
# NO se usa `.dn_expected_data_names`: ese helper excluye a propósito los campos
# `calculate` (`date`, `E1_age_calc`, `time_*_start`) y los parents de
# select_multiple (que solo viven como dummies `<parent>.<code>` en la base
# ancha). Esas variables SÍ están en `inst$survey$name`, así que usar su
# `extra_columns` marcaría como extra data legítima y la default-excluiría del
# BBDD. Por eso el set de "nombres del instrumento" se construye directo desde
# `inst$survey$name` (todas las filas con nombre no vacío) y cada columna de la
# data se clasifica por su stem:
#   - dummy de select_multiple `<parent>.<code>` (sufijo numérico) -> stem = <parent>.
#   - group-prefix `Prefijo.token` (robustez; el colapso ya casi los elimina) ->
#     stem = token.
#   - resto -> stem = la propia columna.
# Extra = stem NO matchea survey ∧ no metadata Kobo ∧ no interna.
#
# Este helper vive fuera de router_analitica.R (congelado a crecimiento): el
# router solo llama a `.reconciliacion_info` / `.reconciliacion_set_incluidas` /
# `.reconciliacion_export_plan`.

# Detector de metadata de Kobo por nombre de columna. Patrones estándar: columnas
# underscore-prefijadas (`_uuid`, `_id`, `_submission_time`, `__version__`),
# `meta.*` / `meta/*`, `formhub.*`, y cualquier nombre que contenga `xform`.
# Estas se conservan siempre y NUNCA entran a la reconciliación.
.reconciliacion_is_kobo_metadata <- function(name) {
  n <- tolower(trimws(as.character(name)))
  if (!length(n) || is.na(n) || !nzchar(n)) return(FALSE)
  grepl("^_", n) ||            # `_uuid`, `_id`, `__version__`, `_submission_time`
    grepl("^meta[./]", n) ||   # `meta.instanceID`, `meta/instanceID`
    grepl("^formhub", n) ||    # `formhub.uuid`, `formhub/uuid`
    grepl("xform", n) ||       # `__version__`/`xform` variantes de KoboToolbox
    identical(n, "__version__")
}

# Identificador de caso de una plataforma que NO es Kobo. SurveyMonkey entrega el
# identificador único de la respuesta en `respondent_id` y el del recopilador en
# `collector_id`; `response_id` es el mismo concepto en las variantes de la API.
# Cumplen exactamente el papel de `_uuid`/`_id` de Kobo: son la llave con la que
# el cliente cruza la BBDD entregada contra su propio registro.
#
# Ninguna plataforma declara su metadata en el XLSForm, así que sin esta regla la
# reconciliación los clasifica como "extra sustantiva" y los excluye del volcado
# por defecto. Se conservan siempre y NUNCA entran a la reconciliación, igual que
# la metadata de Kobo.
#
# Deliberadamente NO cubre el resto de la metadata de SurveyMonkey. `CollectorNm`,
# `date_created`, `date_modified` y `custom_1` siguen siendo extra reconciliables
# —se incluyen desde el popover cuando el estudio las necesita—, y `first_name`,
# `last_name`, `email_address` e `ip_address` son PII directa: que viajen al
# cliente es una decisión explícita, no un default.
.reconciliacion_is_platform_case_id <- function(name) {
  n <- tolower(trimws(as.character(name)))
  if (!length(n) || is.na(n) || !nzchar(n)) return(FALSE)
  n %in% c("respondent_id", "collector_id", "response_id")
}

# data.frame vacío con el esquema del cubo de reconciliación.
.reconciliacion_empty_df <- function() {
  data.frame(
    name = character(0),
    fill_pct = numeric(0),
    n_fill = integer(0),
    kind = character(0),
    stringsAsFactors = FALSE
  )
}

# Cuenta filas NO vacías de una columna. Trata NA, `""` (tras trim) y `"[]"`
# (arrays de metadata Kobo sin elementos) como vacío — misma convención que
# `.analitica_base_empty_cols`.
.reconciliacion_col_fill <- function(col) {
  n <- length(col)
  if (!n) return(list(n_fill = 0L, fill_pct = 0))
  v <- trimws(as.character(col))
  v[is.na(col)] <- ""
  empty <- v == "" | v == "[]"
  n_fill <- sum(!empty)
  list(
    n_fill = as.integer(n_fill),
    fill_pct = round(100 * n_fill / n, 1)
  )
}

# Resuelve el STEM de una columna para compararlo contra `inst$survey$name`:
#   - sufijo numérico tras el último punto (dummy `<parent>.<code>`) -> <parent>.
#   - `Prefijo.token` con token no-numérico (group-prefix) -> token.
#   - resto -> la propia columna.
.reconciliacion_resolve_stem <- function(col) {
  col <- as.character(col)
  # Dummy de select_multiple: `<parent>.<code>` con code numérico -> el parent.
  if (grepl("\\.[0-9]+$", col)) return(sub("\\.[0-9]+$", "", col))
  # Group-prefix (robustez): `Prefijo.token` con token no-numérico -> el token.
  m <- regmatches(col, regexec("^[^.]+\\.(.+)$", col))[[1]]
  if (length(m) == 2L && nzchar(m[2])) return(m[2])
  col
}

# Prefijo (antes del PRIMER separador `.`/`/`) de una columna. Para
# `services.legal` -> `services`; `Assistance.rep_servicios_count` -> `Assistance`;
# `foo` (sin separador) -> `foo`.
.reconciliacion_col_prefix <- function(col) {
  sub("[./].*$", "", as.character(col))
}

# Cubo de reconciliación: por cada variable extra SUSTANTIVA de `data` respecto a
# `inst`, devuelve `name`, `fill_pct`, `n_fill` y `kind` ("con_datos" | "vacia").
# Ordenado por `fill_pct` desc (desempate alfabético). Ver definición de "extra"
# en el encabezado del archivo (clasificación por stem contra `inst$survey$name`).
#
# `monitoreo_handoff`: TRUE cuando la base tiene PROVENIENCIA de handoff de
# Monitoreo. Habilita tratar las dimensiones `dim_*` ajenas al instrumento como
# plumbing (hermanas de `dim_sede`/`dim_origen`) — NO como extras — sin borrar el
# dato. En base de carga MANUAL (FALSE) un `dim_x` legítimo sigue contándose.
#
# Guardrail: data.frame vacío si no hay `inst` o no hay `data`.
.reconciliacion_variables_extra <- function(data, inst, monitoreo_handoff = FALSE) {
  if (is.null(inst) || !is.data.frame(data) || !ncol(data) || !nrow(data)) {
    return(.reconciliacion_empty_df())
  }
  sv <- inst$survey
  snames <- if (is.data.frame(sv) && "name" %in% names(sv)) as.character(sv$name) else character(0)
  snames_lower <- unique(tolower(snames[!is.na(snames) & nzchar(snames)]))

  internas <- .analitica_base_internal_cols(data)
  extra <- character(0)
  for (col in names(data)) {
    if (.reconciliacion_is_kobo_metadata(col)) next  # metadata Kobo -> se conserva
    if (.reconciliacion_is_platform_case_id(col)) next  # id de caso SM -> se conserva
    if (col %in% internas) next                      # interna de plumbing -> ya se stripea
    stem <- .reconciliacion_resolve_stem(col)
    # Variable real del instrumento (por stem resuelto o por nombre directo):
    # incluye calculates (`date`, `E1_age_calc`, `time_*`) y parents/dummies SM.
    if (tolower(stem) %in% snames_lower || tolower(col) %in% snames_lower) next
    # FIX A (falsos positivos): una columna `prefix.suffix` cuyo PREFIX es un
    # nombre del instrumento (SM parent o grupo) es data DERIVADA/hija de ese
    # elemento, no una variable extra nueva. Suprime dummies de select_multiple
    # (`services.legal`, `obstacle.time`) y columnas de grupo/repeat
    # (`Assistance.rep_servicios_count`). NO se borran de la data; solo dejan de
    # contarse como extra. Guardrail anti-falso-negativo: `foo.bar` con prefix
    # `foo` ajeno al instrumento SIGUE siendo extra.
    prefix <- .reconciliacion_col_prefix(col)
    if (nzchar(prefix) && !identical(prefix, col) &&
        tolower(prefix) %in% snames_lower) next
    # FIX B (plumbing de dimensiones): en base con proveniencia de handoff, las
    # `dim_*` ajenas al instrumento son dimensiones inyectadas por Monitoreo
    # (`dim_servicio`, `dim_survey_title`), no variables de encuesta. Se excluyen
    # del conteo sin perder el dato. En base MANUAL un `dim_x` legítimo se cuenta.
    if (isTRUE(monitoreo_handoff) && grepl("^dim[_.]", col, ignore.case = TRUE)) next
    extra <- c(extra, col)
  }
  if (!length(extra)) return(.reconciliacion_empty_df())

  rows <- lapply(extra, function(nm) {
    f <- .reconciliacion_col_fill(data[[nm]])
    data.frame(
      name = nm,
      fill_pct = f$fill_pct,
      n_fill = f$n_fill,
      kind = if (f$n_fill > 0L) "con_datos" else "vacia",
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out <- out[order(-out$fill_pct, out$name), , drop = FALSE]
  rownames(out) <- NULL
  out
}

# ¿La base activa tiene PROVENIENCIA de handoff de Monitoreo? Deriva el flag del
# `source_kind` de la base activa (meta del estudio). Habilita FIX B (dim_* ajenas
# al instrumento no cuentan como extra en el banner). En base MANUAL -> FALSE.
.reconciliacion_handoff_flag <- function(sid) {
  meta <- if (exists(".analitica_single_base_meta", mode = "function")) {
    tryCatch(.analitica_single_base_meta(sid), error = function(e) NULL)
  } else NULL
  sk <- .carga_chr1((meta %||% list())$source_kind, "")
  nzchar(sk) && exists(".base_hygiene_is_monitoreo_kind", mode = "function") &&
    .base_hygiene_is_monitoreo_kind(sk)
}

# Payload del GET de reconciliación de la base activa. Consumido por el popover y
# por el panel revisitable. `incluida` marca las que el usuario decidió incluir.
.reconciliacion_info <- function(sid, cfg = NULL) {
  cfg <- cfg %||% .analitica_get_config(sid)
  ctx <- .load_rp_data(sid)
  # El review (labels/value_labels) no toca las extra —no están en el
  # instrumento— pero se aplica para operar sobre EXACTAMENTE la misma data que
  # ve el export (normalización de contexto incluida).
  reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg)
  extra_df <- .reconciliacion_variables_extra(reviewed$data, reviewed$inst,
                                              monitoreo_handoff = .reconciliacion_handoff_flag(sid))
  incluidas <- .as_chr_vec(cfg$variables_extra_incluidas)

  extra <- lapply(seq_len(nrow(extra_df)), function(i) {
    nm <- extra_df$name[i]
    list(
      name = nm,
      fill_pct = extra_df$fill_pct[i],
      n_fill = as.integer(extra_df$n_fill[i]),
      kind = extra_df$kind[i],
      incluida = nm %in% incluidas
    )
  })
  list(
    ok = TRUE,
    extra = extra,
    n_extra = as.integer(nrow(extra_df)),
    n_incluidas = as.integer(length(intersect(incluidas, extra_df$name)))
  )
}

# Persiste `variables_extra_incluidas` para la base activa. Validación defensiva:
# los nombres deben ser subconjunto de las extra REALES de la base; de lo
# contrario `stop_api`. Devuelve el mismo payload que el GET (estado fresco).
.reconciliacion_set_incluidas <- function(sid, nombres) {
  # OJO: se lee la config PERSISTIBLE (sin el `grupos_recod` que
  # `.analitica_get_config` inyecta solo-lectura). Persistir el cfg aumentado
  # contaminaría la config de Analítica.
  cfg_persist <- .analitica_config_get(sid)
  pedidas <- unique(.as_chr_vec(nombres))

  ctx <- .load_rp_data(sid)
  reviewed <- .analitica_apply_data_review(ctx$rp_data, ctx$rp_inst, cfg_persist)
  extra_df <- .reconciliacion_variables_extra(reviewed$data, reviewed$inst,
                                              monitoreo_handoff = .reconciliacion_handoff_flag(sid))
  validas <- extra_df$name

  desconocidas <- setdiff(pedidas, validas)
  if (length(desconocidas)) {
    stop_api(
      400, "E_RECON_VAR_DESCONOCIDA",
      sprintf(
        "No se pueden incluir variables que no son extra reconciliables de la base: %s.",
        paste(desconocidas, collapse = ", ")
      ),
      details = list(
        desconocidas = as.list(desconocidas),
        validas = as.list(validas)
      )
    )
  }

  # Preserva el orden del cubo (fill desc); solo las que existen como extra.
  incluidas <- intersect(validas, pedidas)
  cfg_persist$variables_extra_incluidas <- as.list(incluidas)
  .analitica_config_set(sid, cfg_persist)
  .reconciliacion_info(sid)
}

# Plan de exclusión de la BBDD por reconciliación. Router-facing: se usa en el
# path de export para saber qué extra se van (todas las sustantivas MENOS las
# incluidas) y cuáles se rescatan (las incluidas, que el include manda sobre el
# empty-drop). No-op seguro si no hay extra.
.reconciliacion_export_plan <- function(data, inst, cfg) {
  extra_df <- .reconciliacion_variables_extra(data, inst)
  incluidas <- .as_chr_vec((cfg %||% list())$variables_extra_incluidas)
  extra_incluidas <- intersect(incluidas, extra_df$name)
  list(
    extra_a_excluir = setdiff(extra_df$name, extra_incluidas),
    extra_incluidas = extra_incluidas
  )
}
