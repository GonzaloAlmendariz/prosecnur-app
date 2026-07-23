# Reconciliación de nombres de columna por "slug canónico".
#
# Motivación (bug de los demos empaquetados, 2026-07-23): la guardia estricta
# `validate_data_xlsform_compatibility` exige que cada variable analizable del
# XLSForm exista como columna literal en la data ya normalizada. Los assets
# demo curados calzan a nivel de PREGUNTA pero no de STRING literal:
#   - SurveyMonkey (.sav de acreditación) trae CamelCase con acentos
#     (`AñosG`, `IngresoG`, `AñoingreG`) mientras el XLSForm es snake_case sin
#     acentos (`anos_g`, `ingreso_g`, `anoingre_g`). Son las MISMAS variables.
#   - Kobo dedup nombres colisionados en el instrumento agregando `_NNN`
#     (`incidencias` -> `incidencias_001`).
#
# Este paso conecta esas columnas al nombre canónico del `survey` SIN adivinar:
# sólo renombra cuando hay UNA candidata inequívoca. Registra cada alias en el
# atributo de trazabilidad `xlsform_normalized$aliases`; nunca fusiona a ciegas.

# Nombres (por slug canónico) de las preguntas `select_multiple` del survey. Sus
# columnas dummy (`<parent>_<code>`) las reconstruye el loop de select_multiple
# de `normalize_data_for_xlsform` (que corre DESPUÉS del canon), así que el paso
# de dedup Kobo NO debe consumirlas ni aliasear el propio parent a un dummy suelto.
.dn_canon_select_multiple_parents <- function(survey) {
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(character(0))
  }
  type_raw <- .dn_survey_type_raw(survey)
  is_sm <- grepl("^select_multiple\\b", type_raw, perl = TRUE)
  parents <- .dn_survey_names(survey)[is_sm]
  parents <- parents[nzchar(parents)]
  unique(.dn_canon_slug(parents))
}

# Slug canónico de un nombre de columna/variable. Reglas (contrato congelado):
#   1. Mapa MANUAL de acentos (ñ->n, á->a, ...) preservando el case, porque
#      `iconv(..., "ASCII//TRANSLIT")` depende del locale y en locale C rompe
#      con tildes (trampa conocida del árbol). El mapa es robusto y determinista.
#   2. Inserta `_` en las fronteras CamelCase (minúscula/dígito -> mayúscula)
#      ANTES de bajar a minúsculas, para no perder la frontera de case.
#   3. tolower + reemplazar todo no-alfanumérico por `_`, colapsar `_` repetidos
#      y recortar `_` en los extremos.
.dn_canon_slug <- function(x) {
  x <- enc2utf8(as.character(x))
  x[is.na(x)] <- ""
  # 1. Mapa manual de acentos preservando el case (composed / NFC).
  from <- "áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ"
  to   <- "aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC"
  x <- chartr(from, to, x)
  # 2. Frontera CamelCase: minúscula/dígito seguidos de mayúscula -> "_" entre medio.
  x <- gsub("([a-z0-9])([A-Z])", "\\1_\\2", x, perl = TRUE)
  # 3. Normalización final.
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", "_", x, perl = TRUE)
  x <- gsub("_+", "_", x, perl = TRUE)
  x <- gsub("^_+|_+$", "", x, perl = TRUE)
  x
}

# Aliasa columnas del dato a nombres canónicos del `survey`:
#   Paso A (slug): renombra columnas cuyo slug canónico calza EXACTAMENTE con el
#     de un nombre-de-dato esperado ausente (1 candidata inequívoca).
#   Paso B (dedup Kobo `_NNN`): para los que sigan ausentes tras A, conecta una
#     única columna `^<slug>_[0-9]+$` (comparada por slug).
# Protecciones: nunca renombra una columna cuyo nombre literal ya es un nombre
# del survey; nunca consume dos veces la misma columna; con 0 o >1 candidatas no
# hace nada. Devuelve `list(data, aliased, dropped)` igual que los otros helpers
# de aliasing, para que el caller combine `aliased`/`dropped`.
.dn_reconcile_canonical_names <- function(data, instrumento) {
  out <- data
  aliased <- character(0)
  dropped <- character(0)
  survey <- instrumento$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(list(data = out, aliased = aliased, dropped = dropped))
  }
  expected <- .dn_expected_data_names(instrumento)
  if (!length(expected)) {
    return(list(data = out, aliased = aliased, dropped = dropped))
  }
  survey_names_all <- .dn_survey_names(survey)
  survey_names_all <- survey_names_all[nzchar(survey_names_all)]
  sm_parent_slugs <- .dn_canon_select_multiple_parents(survey)
  consumed <- character(0)

  # --- Paso A: reconciliación por slug canónico exacto ---
  # Supuesto H3: si dos variables del survey colapsan al MISMO slug canónico
  # (instrumento patológico, baja probabilidad), la asignación es
  # orden-dependiente del survey — la primera esperada que reclame el slug se
  # queda con la candidata, la segunda ya no la encuentra libre. No intentamos
  # resolver ese empate: exigir 1 candidata inequívoca ya impide fusiones a ciegas.
  for (s in expected) {
    if (s %in% names(out)) next
    s_slug <- .dn_canon_slug(s)
    if (!nzchar(s_slug)) next
    data_names <- names(out)
    data_slugs <- .dn_canon_slug(data_names)
    cand_idx <- which(
      data_slugs == s_slug &
        !(data_names %in% survey_names_all) &
        !(data_names %in% consumed)
    )
    if (length(cand_idx) != 1L) next
    cand <- data_names[cand_idx]
    out[[s]] <- out[[cand]]
    consumed <- c(consumed, cand)
    aliased <- c(aliased, stats::setNames(cand, s))
    dropped <- c(dropped, cand)
  }

  # --- Paso B: sufijo de dedup de Kobo `_NNN` ---
  # La firma REAL de dedup de Kobo es ZERO-PADDED (`incidencias_001`,
  # eventualmente `_01`): Kobo renombra la 2da+ ocurrencia de un name colisionado
  # agregando un contador con ceros a la izquierda. Restringir a `_0[0-9]+$`
  # evita el falso positivo de H1: un `p6_1` solitario (sub-pregunta ajena, NO un
  # dummy zero-padded) ya no se fusiona a un `p6` ausente. Además:
  #   - Si `s` es un select_multiple, NO tocar: sus dummies los reconstruye el
  #     loop de select_multiple posterior.
  #   - Excluir candidatas que sean dummy de CUALQUIER select_multiple del survey
  #     (slug `^<parent>_[0-9]+$`), para no pisar esa reconstrucción.
  for (s in expected) {
    if (s %in% names(out)) next
    s_slug <- .dn_canon_slug(s)
    if (!nzchar(s_slug)) next
    if (s_slug %in% sm_parent_slugs) next
    pat <- paste0("^", .dn_escape_regex(s_slug), "_0[0-9]+$")
    data_names <- names(out)
    data_slugs <- .dn_canon_slug(data_names)
    is_sm_dummy <- if (length(sm_parent_slugs)) {
      sm_pat <- paste0("^(", paste(vapply(sm_parent_slugs, .dn_escape_regex, character(1)),
                                   collapse = "|"), ")_[0-9]+$")
      grepl(sm_pat, data_slugs, perl = TRUE)
    } else {
      rep(FALSE, length(data_slugs))
    }
    cand_idx <- which(
      grepl(pat, data_slugs, perl = TRUE) &
        !is_sm_dummy &
        !(data_names %in% survey_names_all) &
        !(data_names %in% consumed)
    )
    if (length(cand_idx) != 1L) next
    cand <- data_names[cand_idx]
    out[[s]] <- out[[cand]]
    consumed <- c(consumed, cand)
    aliased <- c(aliased, stats::setNames(cand, s))
    dropped <- c(dropped, cand)
  }

  list(data = out, aliased = aliased, dropped = unique(dropped))
}
