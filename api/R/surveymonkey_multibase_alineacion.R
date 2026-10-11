# =============================================================================
# Fuentes de una base SurveyMonkey emparejadas por pregunta (ADR 0094)
#
# Una base puede juntar varias encuestas (canales de un mismo público,
# campañas sucesivas). Antes cada pregunta de la fuente caía en la variable
# `p<posición>` de la base: una encuesta hermana con una pregunta insertada
# corría toda la numeración y la edad recibía el código de otra pregunta, sin
# aviso.
#
# Aquí vive la capa que va ENTRE la traducción del proveedor
# (`sm_api_xlsform`, `.sm_mb_question_specs`) y la normalización
# (`normalize_data_for_xlsform`), que no cambian:
#
#   1. La fuente se empareja con la base pregunta por pregunta con la clave de
#      las equivalencias (`.equiv_claves_de_base`, ADR 0062: etiqueta
#      normalizada @@ firma de escala ## ordinal), calculada sobre los XLSForm
#      que la plataforma GENERA para cada encuesta (antes de adoptar el orden
#      del editor). Nunca por posición, nunca por similitud.
#   2. Cada fuente se codifica contra su propio instrumento, se renombra a las
#      variables de la base y se recodifica POR ETIQUETA a los códigos de la
#      base (que pueden haber adoptado el orden del editor).
#   3. Lo que no tiene par se declara: la pregunta de la fuente sin par no
#      entra, la de la base sin par queda vacía para esas filas y la opción sin
#      par queda NA. Todo se cuenta y se persiste en
#      `s$estudio$bases[[b]]$sm_alineacion_fuentes`.
#   4. Si la fuente calza menos del 80 % de las variables de la base
#      (`.SM_MB_COBERTURA_MINIMA`), es otro instrumento: no entra a la base y el
#      refresh se bloquea pidiendo base separada + Equivalencias.
#   5. Una clave (sin su ordinal) que aparece un número DISTINTO de veces en la
#      base y en la fuente es ambigua: ninguno de sus miembros se empareja. Las
#      fuentes se juntan sin confirmación, así que la regla es más estricta que
#      en Equivalencias, donde el analista confirma cada sugerencia.
#   6. El consentimiento de cada fuente se evalúa en SU espacio, antes de
#      alinear: un consentimiento sin par no puede descartar sus filas.
#
# Alinear no crea, une ni elimina filas: sólo decide en qué columna cae cada
# respuesta. La fuente principal (mismo `survey_id` que la base) no pasa por
# aquí y sigue el camino de siempre.
# =============================================================================

.SM_MB_COBERTURA_MINIMA <- 0.8

.SM_MB_MENSAJE_OTRO_INSTRUMENTO <- paste(
  "Impórtala como base separada y relaciónala con esta en la pestaña",
  "Equivalencias de Carga."
)

.SM_MB_MENSAJE_LEGACY <- paste(
  "Esta base se armó antes de emparejar por pregunta: regenera la base desde",
  "SurveyMonkey para corregir las respuestas que ya estaban."
)

# --- Instrumentos generados ---------------------------------------------------

# Caché de instrumentos generados para UNA operación (plan, refresh, import):
# un entorno local que muere con la operación. Nunca va a la sesión.
.sm_mb_cache_operacion <- function() new.env(parent = emptyenv())

# XLSForm que la plataforma genera para una encuesta, leído como lo lee una
# base. Sin orden del editor ni lógica: es la forma sobre la que se calcula la
# clave, para que la firma de escala compare las listas tal como SM las publica.
.sm_mb_inst_generado <- function(details, cache = NULL) {
  clave <- .sm_mb_scalar((details %||% list())$id, "")
  usar_cache <- is.environment(cache) && nzchar(clave)
  if (usar_cache && exists(clave, envir = cache, inherits = FALSE)) return(get(clave, envir = cache))
  model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .sm_mb_write_xlsform_model(model, path)
  inst <- reporte_instrumento(path = path)
  if (usar_cache) assign(clave, inst, envir = cache)
  inst
}

# Instrumento para comparar dos tablas de preguntas. La tabla trae los details
# de los que salió (`.sm_mb_question_table`), así que se usa el XLSForm
# generado: la misma regla que codifica. Una tabla armada a mano (sin details)
# se describe con sus propias columnas; misma clave, misma alineación.
.sm_mb_inst_de_tabla <- function(tbl, cache = NULL) {
  details <- attr(tbl, "sm_details", exact = TRUE)
  if (!is.null(details)) return(.sm_mb_inst_generado(details, cache = cache))
  survey <- list()
  choices <- list()
  split_sig <- function(x) {
    x <- .sm_mb_scalar(x, "")
    if (!nzchar(x)) character(0) else strsplit(x, " || ", fixed = TRUE)[[1]]
  }
  for (i in seq_len(NROW(tbl))) {
    pos <- as.integer(tbl$pos[i])
    heading <- .sm_mb_scalar(tbl$heading[i], "")
    opciones <- split_sig(tbl$choice_signature[i] %||% "")
    filas <- split_sig(tbl$row_signature[i] %||% "")
    lista <- paste0("lst_p", pos)
    tipo_sel <- if (identical(.sm_mb_scalar(tbl$family[i], ""), "multiple_choice")) "select_multiple" else "select_one"
    tipo <- if (length(opciones)) paste(tipo_sel, lista) else "text"
    if (length(opciones)) {
      choices[[length(choices) + 1L]] <- data.frame(
        list_name = lista, name = as.character(seq_along(opciones)), label = opciones,
        stringsAsFactors = FALSE
      )
    }
    if (length(filas)) {
      survey[[length(survey) + 1L]] <- data.frame(
        type = tipo, name = paste0("p", pos, "_", seq_along(filas)), label = filas,
        stringsAsFactors = FALSE
      )
    } else {
      survey[[length(survey) + 1L]] <- data.frame(
        type = tipo, name = paste0("p", pos), label = heading, stringsAsFactors = FALSE
      )
    }
  }
  vacio_s <- data.frame(type = character(0), name = character(0), label = character(0), stringsAsFactors = FALSE)
  vacio_c <- data.frame(list_name = character(0), name = character(0), label = character(0), stringsAsFactors = FALSE)
  list(
    survey = if (length(survey)) do.call(rbind, survey) else vacio_s,
    choices = if (length(choices)) do.call(rbind, choices) else vacio_c
  )
}

# --- Alineación ---------------------------------------------------------------

# Preguntas de un instrumento con su clave. El `_other` de una pregunta no es
# una pregunta: viaja con su padre (su etiqueta «Otro (especifique)» se repite
# en todo el formulario y emparejarlo por clave lo cruzaría de pregunta).
.sm_mb_alin_preguntas <- function(inst) {
  claves <- .equiv_claves_de_base(inst)
  nombres <- names(claves)
  if (!length(nombres)) return(claves)
  es_other <- grepl("_other$", nombres) & sub("_other$", "", nombres) %in% nombres
  claves[!es_other]
}

.sm_mb_alin_tabla <- function(variables, claves) {
  variables <- as.character(variables %||% character(0))
  data.frame(
    variable = variables,
    etiqueta = vapply(variables, function(v) as.character(claves[[v]]$etiqueta %||% "")[1], character(1),
                      USE.NAMES = FALSE),
    stringsAsFactors = FALSE
  )
}

.sm_mb_alinear_fuente <- function(inst_base, inst_fuente) {
  pb <- .sm_mb_alin_preguntas(inst_base)
  pf <- .sm_mb_alin_preguntas(inst_fuente)
  kb <- vapply(pb, function(x) as.character(x$clave), character(1))
  kf <- vapply(pf, function(x) as.character(x$clave), character(1))

  # Ambigüedad: la misma clave sin ordinal aparece un número distinto de veces
  # en cada lado (p. ej. la fuente omitió «¿Conoce?» y conserva «¿Ha
  # utilizado?», mismas filas y misma escala). El ordinal cruzaría preguntas:
  # ninguno de sus miembros se empareja.
  sin_ordinal_b <- sub("##[0-9]+$", "", kb)
  sin_ordinal_f <- sub("##[0-9]+$", "", kf)
  nb <- table(sin_ordinal_b)
  nf <- table(sin_ordinal_f)
  comunes <- intersect(names(nb), names(nf))
  claves_ambiguas <- comunes[as.integer(nb[comunes]) != as.integer(nf[comunes])]
  ambigua_b <- sin_ordinal_b %in% claves_ambiguas
  ambigua_f <- sin_ordinal_f %in% claves_ambiguas

  hit <- match(kf, kb)
  hit[ambigua_f] <- NA_integer_
  emparejadas <- !is.na(hit)
  mapa <- stats::setNames(names(kb)[hit[emparejadas]], names(kf)[emparejadas])
  preguntas_movidas <- sum(names(mapa) != unname(mapa))

  # El `_other` sigue al padre. Si la base no tiene dónde guardarlo, el texto
  # no entra y se declara como pregunta sin par: nada se descarta en silencio.
  others_sin_par <- character(0)
  for (f in names(mapa)) {
    fo <- paste0(f, "_other")
    if (!.sm_mb_var_exists(inst_fuente, fo)) next
    bo <- paste0(mapa[[f]], "_other")
    if (.sm_mb_var_exists(inst_base, bo)) mapa[[fo]] <- bo else others_sin_par <- c(others_sin_par, fo)
  }

  sin_par_fuente <- .sm_mb_alin_tabla(names(kf)[!emparejadas & !ambigua_f], pf)
  if (length(others_sin_par)) {
    claves_f <- .equiv_claves_de_base(inst_fuente)
    sin_par_fuente <- rbind(sin_par_fuente, .sm_mb_alin_tabla(others_sin_par, claves_f))
  }
  sin_par_base <- .sm_mb_alin_tabla(setdiff(names(kb)[!ambigua_b], unname(mapa)), pb)
  # Se listan en el espacio de la base: quedan vacías para esta fuente, y las
  # respuestas de sus gemelas en la fuente no entran.
  ambiguas <- .sm_mb_alin_tabla(names(kb)[ambigua_b], pb)
  n_base <- length(kb)
  n_emparejadas <- as.integer(sum(emparejadas))
  cobertura <- if (n_base > 0L) n_emparejadas / n_base else 0
  list(
    mapa = mapa,
    sin_par_fuente = sin_par_fuente,
    sin_par_base = sin_par_base,
    ambiguas = ambiguas,
    reordenada = preguntas_movidas > 0L,
    n_reordenadas = as.integer(preguntas_movidas),
    n_emparejadas = n_emparejadas,
    n_preguntas_base = as.integer(n_base),
    cobertura = cobertura,
    instrumento_distinto = cobertura < .SM_MB_COBERTURA_MINIMA
  )
}

# Porcentaje de cobertura truncado a un decimal: coherente con el corte, que
# compara el valor exacto (79,6 % bloquea y no puede mostrarse como «80 %»).
.sm_mb_cobertura_texto <- function(cobertura) {
  formatC(floor(1000 * as.numeric(cobertura)) / 10, format = "f", digits = 1)
}

# --- Codificación de una fuente ------------------------------------------------

# Código de la fuente -> etiqueta -> código de la base, para una variable.
.sm_mb_alin_lookup <- function(inst_fuente, var_f, inst_base, var_b) {
  cf <- .sm_mb_choices_for_var(inst_fuente, var_f)
  cb <- .sm_mb_choices_for_var(inst_base, var_b)
  if (!nrow(cf) || !nrow(cb)) return(NULL)
  etiqueta_f <- stats::setNames(.sm_mb_norm(cf$label), as.character(cf$name))
  lab_b <- .sm_mb_norm(cb$label)
  codigo_b <- as.character(cb$name)
  keep <- !duplicated(lab_b)
  por_etiqueta <- stats::setNames(codigo_b[keep], lab_b[keep])
  stats::setNames(unname(por_etiqueta[etiqueta_f]), names(etiqueta_f))
}

.sm_mb_alin_sumar <- function(x, var, n) {
  x[[var]] <- as.integer((if (var %in% names(x)) x[[var]] else 0L) + n)
  x
}

# Recodifica un vector de la fuente a los códigos de la base. Devuelve los
# valores y cuántas respuestas traían una opción sin par (quedan NA; en una
# múltiple se pierde sólo esa opción).
.sm_mb_alin_recodificar <- function(values, lookup, multiple = FALSE) {
  values <- as.character(values)
  sin_par <- 0L
  out <- values
  for (i in seq_along(values)) {
    v <- values[i]
    if (is.na(v) || !nzchar(trimws(v))) next
    tokens <- if (multiple) strsplit(trimws(v), "\\s+")[[1]] else trimws(v)
    nuevos <- unname(lookup[tokens])
    if (any(is.na(nuevos))) sin_par <- sin_par + 1L
    nuevos <- nuevos[!is.na(nuevos)]
    out[i] <- if (length(nuevos)) paste(nuevos, collapse = " ") else NA_character_
  }
  list(values = out, sin_par = sin_par)
}

.sm_mb_alin_es_multiple <- function(inst, var) {
  row <- .sm_mb_survey_row(inst, var)
  !is.null(row) && identical(.sm_mb_type_base(row$type), "select_multiple")
}

# Renombra, descarta y recodifica la data de una fuente ya codificada contra su
# propio instrumento. `mapa` es var_fuente -> var_base.
.sm_mb_alin_aplicar <- function(df, al, inst_fuente, inst_base) {
  mapa <- al$mapa
  sin_par <- integer(0)
  vars_fuente <- .sm_mb_expected_names(inst_fuente)

  # Dummies de una múltiple (`p3/1`, `p3.1`): siguen al padre con el código
  # de la base. El motor canónico produce tokens, pero una data que ya los
  # traiga no puede quedar con la columna de otra pregunta.
  dummy_renames <- character(0)
  for (f in names(mapa)) {
    if (!.sm_mb_alin_es_multiple(inst_fuente, f)) next
    pat <- paste0("^", gsub("([.\\\\|()\\[\\]{}^$*+?])", "\\\\\\1", f, perl = TRUE), "([/.])(.+)$")
    cols <- grep(pat, names(df), value = TRUE, perl = TRUE)
    if (!length(cols)) next
    lookup <- .sm_mb_alin_lookup(inst_fuente, f, inst_base, mapa[[f]]) %||% character(0)
    for (col in cols) {
      partes <- regmatches(col, regexec(pat, col, perl = TRUE))[[1]]
      nuevo <- unname(lookup[partes[3]])
      if (length(nuevo) && !is.na(nuevo)) {
        dummy_renames[[col]] <- paste0(mapa[[f]], partes[2], nuevo)
      } else {
        marcadas <- sum(suppressWarnings(as.numeric(as.character(df[[col]]))) == 1, na.rm = TRUE)
        sin_par <- .sm_mb_alin_sumar(sin_par, mapa[[f]], marcadas)
        dummy_renames[[col]] <- ""
      }
    }
  }

  descartar <- c(setdiff(vars_fuente, names(mapa)), names(dummy_renames)[!nzchar(dummy_renames)])
  df <- df[, setdiff(names(df), descartar), drop = FALSE]
  renombres <- c(mapa, dummy_renames[nzchar(dummy_renames)])
  idx <- match(names(df), names(renombres))
  names(df)[!is.na(idx)] <- unname(renombres[idx[!is.na(idx)]])

  for (f in names(mapa)) {
    b <- mapa[[f]]
    if (!(b %in% names(df))) next
    lookup <- .sm_mb_alin_lookup(inst_fuente, f, inst_base, b)
    if (is.null(lookup)) next
    rec <- .sm_mb_alin_recodificar(df[[b]], lookup, multiple = .sm_mb_alin_es_multiple(inst_base, b))
    df[[b]] <- rec$values
    if (rec$sin_par > 0L) sin_par <- .sm_mb_alin_sumar(sin_par, b, rec$sin_par)
  }
  sin_par <- sin_par[!is.na(sin_par) & sin_par > 0L]

  # Las preguntas de la base sin par quedan vacías para estas filas.
  if (nrow(df)) {
    for (nm in setdiff(.sm_mb_expected_names(inst_base), names(df))) df[[nm]] <- NA_character_
  }
  list(data = df, opciones_sin_par = sin_par)
}

# Variable de consentimiento de la fuente, en SU espacio. Lo configurado se
# busca primero entre las variables de la fuente; si es un nombre de la base,
# se traduce por el mapa; si no hay nada configurado, se detecta.
.sm_mb_alin_consent_fuente <- function(inst_fuente, configurada, mapa) {
  configurada <- .sm_mb_scalar(configurada, "")
  if (nzchar(configurada)) {
    propia <- .sm_mb_consent_var(inst_fuente, configured = configurada)
    if (nzchar(propia)) return(propia)
    traducida <- names(mapa)[unname(mapa) == configurada]
    if (length(traducida)) return(traducida[1])
  }
  .sm_mb_consent_candidate_var(inst_fuente)
}

# Único punto por el que pasa una encuesta distinta de la principal.
#
# - `inst_base`: instrumento de la base (sus códigos son los finales).
# - `inst_clave_base`: XLSForm GENERADO de la encuesta principal, sobre el que
#   se calcula la clave. Sin él se usa `inst_base` (vale cuando la base no
#   adoptó otro orden de opciones).
# - `consent_var`: consentimiento de la fuente (su espacio). Se evalúa ANTES de
#   alinear, contra el instrumento de la fuente: la variable de consentimiento
#   de la base puede no tener par y quedar vacía, y entonces descartaría todas
#   las filas de la fuente como si no hubieran consentido.
# - `apply_consent_filter = FALSE` (base efectiva desde el snapshot): el
#   consentimiento lo decide la política de la base, salvo que su variable no
#   reciba nada de esta fuente; entonces se filtra aquí, en la fuente.
# - `consent_var_base`: consentimiento de la base (por defecto, detectado).
# - `cache`: entorno de `.sm_mb_cache_operacion()` para no regenerar XLSForm.
# - `...`: el resto de argumentos del motor canónico (pais, source_title,
#   response_statuses, collector_ids, fechas…).
.sm_mb_codificar_fuente <- function(details_fuente,
                                    responses,
                                    inst_base,
                                    survey_id,
                                    inst_clave_base = NULL,
                                    consent_var = "",
                                    apply_consent_filter = TRUE,
                                    inst_fuente = NULL,
                                    consent_var_base = "",
                                    cache = NULL,
                                    ...) {
  inst_fuente <- inst_fuente %||% .sm_mb_inst_generado(details_fuente, cache = cache)
  al <- .sm_mb_alinear_fuente(inst_clave_base %||% inst_base, inst_fuente)

  cv_fuente <- .sm_mb_alin_consent_fuente(inst_fuente, consent_var, al$mapa)
  cv_base <- .sm_mb_consent_var(inst_base, configured = consent_var_base)
  alimentada <- nzchar(cv_base) && cv_base %in% unname(al$mapa)
  filtrar <- nzchar(cv_fuente) && (isTRUE(apply_consent_filter) || !alimentada)

  df <- sm_multibase_api_responses_to_canonical_data(
    details = details_fuente,
    responses = responses,
    inst = inst_fuente,
    survey_id = survey_id,
    consent_var = if (filtrar) cv_fuente else "",
    apply_consent_filter = filtrar,
    ...
  )
  response_filter <- attr(df, "sm_response_filter", exact = TRUE)
  canonicas <- attr(df, "sm_opciones_sin_par", exact = TRUE) %||% integer(0)
  opciones_sin_par <- integer(0)
  for (v in names(canonicas)) {
    b <- unname(al$mapa[v])
    if (length(b) && !is.na(b)) opciones_sin_par <- .sm_mb_alin_sumar(opciones_sin_par, b, canonicas[[v]])
  }
  if (is.data.frame(df) && nrow(df)) {
    aplicado <- .sm_mb_alin_aplicar(df, al, inst_fuente, inst_base)
    df <- aplicado$data
    for (v in names(aplicado$opciones_sin_par)) {
      opciones_sin_par <- .sm_mb_alin_sumar(opciones_sin_par, v, aplicado$opciones_sin_par[[v]])
    }
  }
  attr(df, "sm_response_filter") <- response_filter
  attr(df, "sm_alineacion") <- al
  attr(df, "sm_opciones_sin_par") <- opciones_sin_par
  attr(df, "sm_consentimiento") <- list(
    variable_fuente = cv_fuente,
    variable_base = cv_base,
    sin_par = nzchar(cv_base) && !alimentada,
    n_excluidas = if (filtrar) as.integer((response_filter %||% list())$consent_excluded_rows %||% 0L)[1] else 0L
  )
  df
}

# Política de decisiones para las filas de UNA fuente en la base efectiva: si
# la variable de consentimiento de la base no recibe nada de esta fuente, ya se
# filtró en la fuente y la política no puede volver a juzgarla por un NA.
.sm_mb_politica_para_fuente <- function(policy, df) {
  consentimiento <- attr(df, "sm_consentimiento", exact = TRUE)
  if (!isTRUE((consentimiento %||% list())$sin_par)) return(policy)
  if (identical(.sm_mb_scalar(policy$rejection_var, ""), .sm_mb_scalar(policy$consent_var, ""))) {
    policy$rejection_var <- ""
  }
  policy$consent_var <- ""
  policy
}

# Despacho de los tres caminos que juntan encuestas: la fuente principal sigue
# el motor canónico tal cual; cualquier otra encuesta pasa por la alineación.
# Mismos argumentos que `sm_multibase_api_responses_to_canonical_data` más la
# encuesta de la base, sus details (para la clave) y la caché de la operación.
.sm_mb_codificar_segun_fuente <- function(details,
                                          responses,
                                          inst,
                                          survey_id,
                                          base_survey_id,
                                          details_base = NULL,
                                          consent_var = "",
                                          apply_consent_filter = TRUE,
                                          consent_var_base = "",
                                          cache = NULL,
                                          ...) {
  if (identical(.sm_mb_scalar(survey_id, ""), .sm_mb_scalar(base_survey_id, ""))) {
    return(sm_multibase_api_responses_to_canonical_data(
      details = details,
      responses = responses,
      inst = inst,
      survey_id = survey_id,
      consent_var = consent_var,
      apply_consent_filter = apply_consent_filter,
      ...
    ))
  }
  inst_clave_base <- if (length(details_base)) .sm_mb_inst_generado(details_base, cache = cache) else NULL
  .sm_mb_codificar_fuente(
    details_fuente = details,
    responses = responses,
    inst_base = inst,
    survey_id = survey_id,
    inst_clave_base = inst_clave_base,
    consent_var = consent_var,
    apply_consent_filter = apply_consent_filter,
    consent_var_base = consent_var_base,
    cache = cache,
    ...
  )
}

# --- Persistencia -------------------------------------------------------------

.sm_mb_alin_filas <- function(df) {
  if (is.null(df) || !NROW(df)) return(list())
  lapply(seq_len(NROW(df)), function(i) list(
    variable = as.character(df$variable[i]),
    etiqueta = as.character(df$etiqueta[i])
  ))
}

.sm_mb_opciones_lista <- function(op) {
  op <- op %||% integer(0)
  lapply(names(op), function(v) list(variable = v, n = as.integer(op[[v]])))
}

# ¿La fuente es otro instrumento? Entonces no entra a la base (ADR 0094,
# decisión 4): ni siquiera con sus preguntas emparejadas. Es un resultado que
# se declara, no un error: la base se arma con las fuentes que sí calzan.
.sm_mb_fuente_es_otro_instrumento <- function(df) {
  isTRUE((attr(df, "sm_alineacion", exact = TRUE) %||% list())$instrumento_distinto)
}

# Resumen de la alineación de UNA fuente, con la forma persistida (contrato
# del ítem 13). NULL si la data no pasó por la alineación (fuente principal).
.sm_mb_alineacion_resumen <- function(df, survey_id, titulo = "") {
  al <- attr(df, "sm_alineacion", exact = TRUE)
  if (is.null(al)) return(NULL)
  consentimiento <- attr(df, "sm_consentimiento", exact = TRUE) %||% list()
  excluida <- .sm_mb_fuente_es_otro_instrumento(df)
  filas <- as.integer(NROW(df))
  list(
    survey_id = .sm_mb_scalar(survey_id, ""),
    titulo = .sm_mb_scalar(titulo, ""),
    n_emparejadas = as.integer(al$n_emparejadas),
    n_preguntas_base = as.integer(al$n_preguntas_base),
    cobertura = as.numeric(al$cobertura),
    reordenada = isTRUE(al$reordenada),
    instrumento_distinto = isTRUE(al$instrumento_distinto),
    excluida = excluida,
    n_filas_excluidas = if (excluida) filas else 0L,
    n_filas_incorporadas = if (excluida) 0L else filas,
    consentimiento_sin_par = isTRUE(consentimiento$sin_par),
    n_excluidas_consentimiento = as.integer(consentimiento$n_excluidas %||% 0L)[1],
    sin_par_fuente = .sm_mb_alin_filas(al$sin_par_fuente),
    sin_par_base = .sm_mb_alin_filas(al$sin_par_base),
    ambiguas = .sm_mb_alin_filas(al$ambiguas),
    opciones_sin_par = .sm_mb_opciones_lista(attr(df, "sm_opciones_sin_par", exact = TRUE))
  )
}

# Acumulador de una operación: las fuentes alineadas y las opciones sin par de
# la fuente principal (que no se alinea pero también puede perder opciones).
.sm_mb_alin_nuevo <- function() list(fuentes = list(), principal = list())

.sm_mb_alin_registrar <- function(alin, df, survey_id, titulo, base_survey_id) {
  if (identical(.sm_mb_scalar(survey_id, ""), .sm_mb_scalar(base_survey_id, ""))) {
    alin$principal <- .sm_mb_opciones_lista(attr(df, "sm_opciones_sin_par", exact = TRUE))
    return(alin)
  }
  resumen <- .sm_mb_alineacion_resumen(df, survey_id, titulo)
  if (!is.null(resumen)) alin$fuentes[[length(alin$fuentes) + 1L]] <- resumen
  alin
}

# Escribe la alineación en la meta de la base. Solo la llama quien reemplaza
# el `data_file_id` de la base: describe la data vigente. Sin fuentes
# alineadas (o sin opciones perdidas en la principal) la clave se borra.
.sm_mb_alin_en_base <- function(base, alin) {
  alin <- alin %||% .sm_mb_alin_nuevo()
  base$sm_alineacion_fuentes <- if (length(alin$fuentes)) unname(alin$fuentes) else NULL
  base$sm_opciones_sin_par_principal <- if (length(alin$principal)) alin$principal else NULL
  base
}

# --- Auditoría de estructura sobre pares alineados ----------------------------

# Lo que hace incompatibles dos preguntas emparejadas. `n_rows` no está: las
# filas de una matriz se emparejan una a una y las que sobran se declaran.
.SM_MB_CAMPOS_DUROS <- c("family", "subtype", "required", "validation", "n_cols")

# Compara una fuente contra la principal pregunta por pregunta, con la misma
# alineación que codifica. `company_positions` se conserva por firma: el modo
# «Unificar» (fuera del ADR 0094) usa `.sm_mb_compare_to_ref_posicional`.
.sm_mb_compare_to_ref <- function(ref, cur, company_positions = integer(),
                                  ignorable_missing_positions = integer(), cache = NULL) {
  ignorables <- unique(suppressWarnings(as.integer(ignorable_missing_positions)))
  ignorables <- ignorables[is.finite(ignorables)]
  al <- .sm_mb_alinear_fuente(.sm_mb_inst_de_tabla(ref, cache), .sm_mb_inst_de_tabla(cur, cache))
  heading_de <- function(tbl, pos) {
    i <- which(as.integer(tbl$pos) == pos)[1]
    if (is.na(i)) "" else .sm_mb_scalar(tbl$heading[i], "")
  }
  # Los diffs de la fuente entera no tienen posición: llevan pos 0 y el título.
  titulo <- .sm_mb_trim((attr(cur, "sm_details", exact = TRUE) %||% list())$title %||% "")
  if (!nzchar(titulo)) titulo <- "Esta fuente"
  out <- list()

  if (isTRUE(al$instrumento_distinto)) {
    out[[length(out) + 1L]] <- list(
      pos = 0L, variable = titulo, severity = "blocking", kind = "different_instrument",
      message = sprintf(
        "Esta encuesta calza %d de %d variables de la base (%s%%): es otro instrumento, no una fuente de la misma base. %s",
        al$n_emparejadas, al$n_preguntas_base, .sm_mb_cobertura_texto(al$cobertura), .SM_MB_MENSAJE_OTRO_INSTRUMENTO
      ),
      accion = "base_separada_equivalencias",
      n_emparejadas = al$n_emparejadas, n_preguntas_base = al$n_preguntas_base,
      cobertura = al$cobertura, ref = "", current = ""
    )
  }

  # Pares de preguntas (no de variables: una matriz aporta varias filas).
  mapa <- al$mapa
  mapa <- mapa[!grepl("_other$", names(mapa))]
  pos_cur <- vapply(names(mapa), .sm_mb_question_pos_for_var, integer(1))
  pos_ref <- vapply(unname(mapa), .sm_mb_question_pos_for_var, integer(1))
  pares <- unique(data.frame(cur = unname(pos_cur), ref = unname(pos_ref)))
  for (k in seq_len(nrow(pares))) {
    i_ref <- which(as.integer(ref$pos) == pares$ref[k])[1]
    i_cur <- which(as.integer(cur$pos) == pares$cur[k])[1]
    if (is.na(i_ref) || is.na(i_cur)) next
    campos <- intersect(.SM_MB_CAMPOS_DUROS, intersect(names(ref), names(cur)))
    if (!length(campos)) next
    if (any(as.character(unlist(ref[i_ref, campos])) != as.character(unlist(cur[i_cur, campos])))) {
      out[[length(out) + 1L]] <- list(
        pos = as.integer(pares$ref[k]), variable = paste0("p", pares$ref[k]), severity = "blocking",
        kind = "structure", message = "Tipo, columnas o validacion no coinciden.",
        ref = heading_de(ref, pares$ref[k]), current = heading_de(cur, pares$cur[k])
      )
    }
  }

  if (isTRUE(al$reordenada)) {
    out[[length(out) + 1L]] <- list(
      pos = 0L, variable = titulo, severity = "info", kind = "question_order",
      message = sprintf("%d preguntas emparejadas por texto, en otro orden.", al$n_reordenadas),
      n_reordenadas = al$n_reordenadas, ref = "", current = ""
    )
  }

  for (i in seq_len(NROW(al$ambiguas))) {
    var <- al$ambiguas$variable[i]
    pos <- .sm_mb_question_pos_for_var(var)
    out[[length(out) + 1L]] <- list(
      pos = if (is.na(pos)) 0L else pos, variable = var, severity = "review", kind = "ambiguous",
      message = paste("La misma pregunta aparece un número distinto de veces en la base y en esta fuente:",
                      "no se empareja por orden y queda vacía para sus filas."),
      ref = al$ambiguas$etiqueta[i], current = "",
      pregunta = if (is.na(pos)) "" else heading_de(ref, pos)
    )
  }

  for (i in seq_len(NROW(al$sin_par_fuente))) {
    var <- al$sin_par_fuente$variable[i]
    pos <- .sm_mb_question_pos_for_var(var)
    out[[length(out) + 1L]] <- list(
      pos = pos, variable = var, severity = "review", kind = "unpaired_source",
      message = "Pregunta de esta fuente sin par en la base: sus respuestas no entran a la base.",
      ref = "", current = al$sin_par_fuente$etiqueta[i],
      pregunta = if (is.na(pos)) "" else heading_de(cur, pos)
    )
  }

  for (i in seq_len(NROW(al$sin_par_base))) {
    var <- al$sin_par_base$variable[i]
    pos <- .sm_mb_question_pos_for_var(var)
    etiqueta <- al$sin_par_base$etiqueta[i]
    if (!is.na(pos) && pos %in% ignorables) {
      out[[length(out) + 1L]] <- list(
        pos = pos, variable = var, severity = "review", kind = "metadata_optional",
        message = "Campo administrativo/metadata ausente o distinto en esta fuente; no bloquea la fusion.",
        ref = etiqueta, current = "", optional_metadata = TRUE
      )
      next
    }
    out[[length(out) + 1L]] <- list(
      pos = pos, variable = var, severity = "review", kind = "unpaired_base",
      message = "Pregunta de la base sin par en esta fuente: queda vacía para sus filas.",
      ref = etiqueta, current = "",
      pregunta = if (is.na(pos)) "" else heading_de(ref, pos)
    )
  }
  out
}

# --- Refresh: bloqueos que dicen qué hacer -------------------------------------

# Bloquean el refresh haya o no filas nuevas: la base no puede recibir filas
# hasta que se resuelva cómo se juntan sus encuestas.
.SM_MB_KINDS_BLOQUEO_REFRESH <- c("different_instrument", "legacy_positional")

.sm_mb_estructura_kinds <- function(estructura) {
  diffs <- (estructura %||% list())$diffs %||% list()
  vapply(diffs, function(d) .sm_mb_scalar(d$kind, ""), character(1))
}

.sm_mb_estructura_bloquea <- function(estructura) {
  any(.sm_mb_estructura_kinds(estructura) %in% .SM_MB_KINDS_BLOQUEO_REFRESH)
}

# Una base que junta varias encuestas y no tiene alineación guardada se armó
# por posición, antes del ADR 0094. Sumarle filas alineadas la dejaría mezclada
# y declarada como alineada: el refresh se bloquea hasta regenerarla desde el
# snapshot, que sí realinea todo. `spec_guardada` es la de la base, antes de
# sumar campañas nuevas.
.sm_mb_estructura_legacy <- function(estructura, base, spec_guardada) {
  if (length(.sm_mb_source_ids(spec_guardada)) <= 1L) return(estructura)
  if (length((base %||% list())$sm_alineacion_fuentes)) return(estructura)
  estructura <- estructura %||% list()
  titulo <- .sm_mb_scalar(base$source_alias %||% base$source_title, "Esta base")
  estructura$diffs <- c(estructura$diffs %||% list(), list(list(
    pos = 0L, variable = titulo, severity = "blocking", kind = "legacy_positional",
    message = .SM_MB_MENSAJE_LEGACY, accion = "regenerar_base", ref = "", current = ""
  )))
  estructura$ok <- FALSE
  estructura$n_blocking <- as.integer((estructura$n_blocking %||% 0L) + 1L)
  estructura
}

# Motivo legible de una base que el diagnóstico no deja actualizar.
.sm_mb_refresh_motivo_bloqueo <- function(estructura) {
  kinds <- .sm_mb_estructura_kinds(estructura)
  if ("legacy_positional" %in% kinds) return(.SM_MB_MENSAJE_LEGACY)
  if ("different_instrument" %in% kinds) {
    return(paste(
      "Una de las encuestas de esta base es otro instrumento: calza menos del 80 % de sus variables.",
      .SM_MB_MENSAJE_OTRO_INSTRUMENTO
    ))
  }
  "La base no paso el diagnostico."
}
