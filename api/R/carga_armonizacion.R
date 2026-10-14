# =============================================================================
# Armonización de una base nacida del formulario publicado (ADR 0102)
# =============================================================================
#
# Dos lecturas, ninguna escribe estado:
#
# 1. `carga_armonizacion()` devuelve lo que la importación dejó guardado en
#    `meta$formulario_publicado` (schema formulario_publicado/v1): cobertura,
#    variables sin par, recodificaciones y etiquetas de la fuente que no
#    entraron. No recalcula nada; es la foto del momento de la carga.
#
# 2. `carga_comparar_fuentes()` compara dos bases ligadas a la MISMA revisión
#    (p. ej. el .sav limpio y la descarga de SurveyMonkey del mismo
#    formulario). Grano: una fila = un respondente de cada base. Sólo
#    select_one y select_multiple del instrumento; las etiquetas salen del
#    XLSForm de la revisión.
#
#    - Denominador: válidos = no-NA, INCLUIDOS los códigos especiales (una
#      diferencia de SIN INF entre fuentes es justo lo que hay que ver).
#    - select_multiple: una categoría por opción, % sobre quienes respondieron
#      la pregunta (madre o alguna dummy no-NA).
#    - Un código presente en los datos y ausente de la lista entra como
#      categoría con `etiqueta = codigo` y `fuera_de_lista = TRUE`.
#    - Casos: sólo conteos por la clave de respuesta; nunca filas ni
#      identificadores en la respuesta ni en logs.
#
# Los datos se leen con el lector de Validación (`.resolve_explorar_data`,
# fuente "raw" = la data vigente de la base, que tras el ADR 0076 es la
# depurada promovida si la hay).
# =============================================================================

.CARM_CLAVES_RESPUESTA <- c("respondent_id", "RespondentID", "id_respuesta", "response_id")
.CARM_UMBRAL_PP <- 2
# Estándar de valores especiales de la casa que se marcan en la comparación.
.CARM_ESPECIALES_CODIGOS <- c("90", "94", "98", "99")
.CARM_ESPECIALES_ETIQUETAS <- c("no aplica", "ns/nr", "no sabe", "no responde", "sin inf",
                                "sin informacion")

# --- Utilidades ---------------------------------------------------------------

.carm_base_meta <- function(s, base) {
  nombre <- .cfp_chr(base)
  meta <- if (nzchar(nombre)) ((s$estudio %||% list())$bases %||% list())[[nombre]] else NULL
  if (is.null(meta)) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe en el estudio.", nombre))
  }
  meta
}

.carm_fp <- function(meta) {
  fp <- meta$formulario_publicado
  if (is.list(fp) && length(fp)) fp else NULL
}

.carm_lista <- function(x) if (is.null(x)) list() else x

.carm_texto_norm <- function(x) {
  y <- tolower(trimws(as.character(x)))
  if (requireNamespace("stringi", quietly = TRUE)) y <- stringi::stri_trans_general(y, "Latin-ASCII")
  gsub("\\s+", " ", y)
}

.carm_es_especial <- function(codigo, etiqueta) {
  codigo %in% .CARM_ESPECIALES_CODIGOS || .carm_texto_norm(etiqueta) %in% .CARM_ESPECIALES_ETIQUETAS
}

# Códigos como texto: "1.0" (export numérico) es "1"; vacío es NA.
.carm_codigos <- function(x) {
  y <- trimws(as.character(x))
  y[!is.na(y) & !nzchar(y)] <- NA_character_
  num <- !is.na(y) & grepl("^-?[0-9]+\\.0+$", y)
  y[num] <- sub("\\.0+$", "", y[num])
  y
}

.carm_datos <- function(meta) {
  limpieza <- meta$limpieza %||% list()
  universo <- meta$universe_filter %||% list()
  fid <- .cfp_chr(meta$data_file_id)
  promovida <- function(linaje) {
    isTRUE(linaje$enabled) && nzchar(fid) && identical(.cfp_chr(linaje$effective_data_file_id), fid)
  }
  if (promovida(limpieza) || promovida(universo)) "depurada" else "cruda"
}

.carm_fuente <- function(meta) {
  .cfp_chr((.carm_fp(meta) %||% list())$fuente, .cfp_chr(meta$source_kind, NA_character_))
}

.carm_formulario <- function(s, fp, revision) {
  form_id <- .cfp_chr(fp$form_id, .cfp_chr((revision %||% list())$form_id))
  form_name <- if (!is.null(revision)) {
    .cfp_form_nombre(s, revision)
  } else {
    .cfp_chr(((s$xlsform_forms %||% list())[[form_id]] %||% list())$name, NA_character_)
  }
  list(
    form_id = form_id,
    form_name = form_name,
    revision_id = .cfp_chr(fp$revision_id),
    revision_no = suppressWarnings(as.integer((revision %||% list())$revision_no %||% NA_integer_)[1])
  )
}

# --- 1. Armonización guardada ------------------------------------------------

#' Lo que la importación desde el formulario publicado dejó en la base.
#' @keywords internal
carga_armonizacion <- function(sid, base) {
  s <- session_get(sid)
  nombre <- .cfp_chr(base)
  meta <- .carm_base_meta(s, nombre)
  fp <- .carm_fp(meta)
  if (is.null(fp)) return(list(ok = TRUE, base = nombre, disponible = FALSE))
  revision <- .instrument_validation_revision(s, .cfp_chr(fp$revision_id))
  list(
    ok = TRUE,
    base = nombre,
    disponible = TRUE,
    formulario = .carm_formulario(s, fp, revision),
    fuente = .cfp_chr(fp$fuente, NA_character_),
    importado_at = .cfp_chr(fp$importado_at, NA_character_),
    n_filas = suppressWarnings(as.integer(fp$n_filas %||% NA_integer_)[1]),
    fuentes = .carm_lista(fp$fuentes),
    n_emparejadas = suppressWarnings(as.integer(fp$n_emparejadas %||% NA_integer_)[1]),
    n_variables_instrumento = suppressWarnings(as.integer(fp$n_variables_instrumento %||% NA_integer_)[1]),
    cobertura = suppressWarnings(as.numeric(fp$cobertura %||% NA_real_)[1]),
    sin_par_instrumento = .carm_lista(fp$sin_par_instrumento),
    sin_par_fuente = .carm_lista(fp$sin_par_fuente),
    agregadas_fuente = .carm_lista(fp$agregadas_fuente),
    recodificaciones = .carm_lista(fp$recodificaciones),
    opciones_sin_par = .carm_lista(fp$opciones_sin_par)
  )
}

# --- 2. Comparación de fuentes -----------------------------------------------

.carm_perdidas <- function(meta) {
  out <- list()
  for (op in .carm_lista((.carm_fp(meta) %||% list())$opciones_sin_par)) {
    variable <- .cfp_chr(op$variable)
    for (et in .carm_lista(op$etiquetas)) {
      out[[length(out) + 1L]] <- list(
        variable = variable,
        etiqueta = .cfp_chr(et$etiqueta),
        n = suppressWarnings(as.integer(et$n %||% NA_integer_)[1])
      )
    }
  }
  out
}

.carm_revision_texto <- function(s, rid) {
  if (!nzchar(rid)) return("ninguna revisión")
  rev <- .instrument_validation_revision(s, rid)
  no <- suppressWarnings(as.integer((rev %||% list())$revision_no %||% NA_integer_)[1])
  if (is.null(rev)) return("otra revisión")
  nombre <- .cfp_form_nombre(s, rev)
  if (is.na(no)) sprintf("«%s»", nombre) else sprintf("la revisión %d de «%s»", no, nombre)
}

.carm_exigir_misma_revision <- function(s, a, b, meta_a, meta_b) {
  rid_a <- .cfp_chr(meta_a$instrument_revision_id)
  rid_b <- .cfp_chr(meta_b$instrument_revision_id)
  if (nzchar(rid_a) && identical(rid_a, rid_b)) return(rid_a)
  sin <- c(a, b)[!nzchar(c(rid_a, rid_b))]
  mensaje <- if (length(sin)) {
    sprintf("%s no está ligada a un formulario publicado: sólo se comparan bases de la misma revisión.",
            paste(sprintf("«%s»", sin), collapse = " ni "))
  } else {
    sprintf("«%s» viene de %s y «%s» de %s: sólo se comparan bases ligadas a la misma revisión del formulario.",
            a, .carm_revision_texto(s, rid_a), b, .carm_revision_texto(s, rid_b))
  }
  stop_api(409, "E_COMPARAR_OTRA_REVISION", mensaje)
}

.carm_instrumento <- function(s, revision, fallback) {
  if (!is.null(revision)) {
    inst <- tryCatch(.cfp_instrumento(s, revision), error = function(e) NULL)
    if (!is.null(inst)) return(inst)
  }
  fallback
}

# Preguntas cerradas del instrumento: name, tipo, etiqueta y lista.
.carm_preguntas <- function(inst) {
  survey <- as.data.frame(inst$survey %||% data.frame(), stringsAsFactors = FALSE)
  if (!nrow(survey) || !all(c("type", "name") %in% names(survey))) return(list())
  tipos <- tolower(trimws(as.character(survey$type)))
  tipos <- sub("\\s.*$", "", tipos)
  keep <- tipos %in% c("select_one", "select_multiple") & !is.na(survey$name) & nzchar(survey$name)
  etiquetas <- inst$var_labels %||% character(0)
  lapply(which(keep), function(i) {
    name <- as.character(survey$name[[i]])
    list(
      variable = name,
      tipo = tipos[[i]],
      etiqueta = .cfp_chr(etiquetas[name], name),
      lista = .cfp_chr(if ("list_name" %in% names(survey)) survey$list_name[[i]] else "")
    )
  })
}

.carm_opciones <- function(inst, lista) {
  ch <- as.data.frame(inst$choices %||% data.frame(), stringsAsFactors = FALSE)
  if (!nzchar(lista) || !nrow(ch) || !all(c("list_name", "name") %in% names(ch))) {
    return(stats::setNames(character(0), character(0)))
  }
  fila <- ch[!is.na(ch$list_name) & ch$list_name == lista, , drop = FALSE]
  codigos <- .carm_codigos(fila$name)
  etq <- if ("label" %in% names(fila)) as.character(fila$label) else codigos
  etq[is.na(etq) | !nzchar(trimws(etq))] <- codigos[is.na(etq) | !nzchar(trimws(etq))]
  ok <- !is.na(codigos) & !duplicated(codigos)
  stats::setNames(etq[ok], codigos[ok])
}

# Conteos de una pregunta en una base. NULL si la base no trae la pregunta.
.carm_conteos <- function(data, pregunta) {
  var <- pregunta$variable
  if (identical(pregunta$tipo, "select_one")) {
    if (!(var %in% names(data))) return(NULL)
    x <- .carm_codigos(data[[var]])
    x <- x[!is.na(x)]
    return(list(validos = length(x), n = table(factor(x, levels = unique(x)))))
  }
  dummies <- .vd_sm_dummy_columns(var, data)
  madre <- if (var %in% names(data)) .carm_codigos(data[[var]]) else NULL
  if (!length(dummies) && is.null(madre)) return(NULL)
  n_filas <- NROW(data)
  respondio <- rep(FALSE, n_filas)
  if (!is.null(madre)) respondio <- respondio | !is.na(madre)
  for (col in dummies) respondio <- respondio | !is.na(data[[col]])
  tokens <- if (!is.null(madre)) strsplit(ifelse(is.na(madre), "", madre), "\\s+") else NULL
  codigos <- unique(c(names(dummies), if (!is.null(tokens)) .carm_codigos(unlist(tokens))))
  codigos <- codigos[!is.na(codigos)]
  n <- vapply(codigos, function(cd) {
    sel <- rep(FALSE, n_filas)
    if (cd %in% names(dummies)) sel <- sel | .vd_sm_is_selected_dummy(data[[dummies[[cd]]]])
    if (!is.null(tokens)) sel <- sel | vapply(tokens, function(t) cd %in% .carm_codigos(t), logical(1))
    sum(sel & respondio)
  }, numeric(1))
  list(validos = sum(respondio), n = n)
}

.carm_n <- function(conteo, cd) {
  if (is.null(conteo) || !(cd %in% names(conteo$n))) return(0L)
  as.integer(conteo$n[[cd]])
}

.carm_pct <- function(n, validos) {
  if (is.null(validos) || !validos) return(NA_real_)
  round(100 * n / validos, 2)
}

.carm_variable <- function(pregunta, inst, ca, cb) {
  opciones <- .carm_opciones(inst, pregunta$lista)
  en_datos <- unique(c(names(ca$n %||% list()), names(cb$n %||% list())))
  # select_multiple: una dummy sin marcas no es una categoría observada.
  observados <- en_datos[vapply(en_datos, function(cd) .carm_n(ca, cd) + .carm_n(cb, cd) > 0L, logical(1))]
  fuera <- setdiff(observados, names(opciones))
  codigos <- c(names(opciones), fuera)
  categorias <- lapply(codigos, function(cd) {
    etq <- if (cd %in% names(opciones)) unname(opciones[[cd]]) else cd
    n_a <- .carm_n(ca, cd)
    n_b <- .carm_n(cb, cd)
    list(
      codigo = cd, etiqueta = etq,
      n_a = n_a, n_b = n_b,
      pct_a = .carm_pct(n_a, ca$validos), pct_b = .carm_pct(n_b, cb$validos),
      especial = .carm_es_especial(cd, etq),
      fuera_de_lista = cd %in% fuera
    )
  })
  estado <- if (is.null(cb)) "solo_a" else if (is.null(ca)) "solo_b" else NA_character_
  solo_a <- character(0)
  solo_b <- character(0)
  dif <- NA_real_
  if (is.na(estado)) {
    n_a <- vapply(categorias, `[[`, integer(1), "n_a")
    n_b <- vapply(categorias, `[[`, integer(1), "n_b")
    etq <- vapply(categorias, `[[`, character(1), "etiqueta")
    solo_a <- etq[n_a > 0L & n_b == 0L]
    solo_b <- etq[n_b > 0L & n_a == 0L]
    diffs <- abs(vapply(categorias, function(c) c$pct_a - c$pct_b, numeric(1)))
    if (any(!is.na(diffs))) dif <- round(max(diffs, na.rm = TRUE), 2)
  }
  list(
    variable = pregunta$variable,
    etiqueta = pregunta$etiqueta,
    tipo = pregunta$tipo,
    estado = estado,
    n_validos_a = if (is.null(ca)) NA_integer_ else as.integer(ca$validos),
    n_validos_b = if (is.null(cb)) NA_integer_ else as.integer(cb$validos),
    categorias = categorias,
    diferencia_max_pp = dif,
    categorias_solo_a = as.list(solo_a),
    categorias_solo_b = as.list(solo_b)
  )
}

.carm_clave_norm <- function(x) {
  y <- gsub("\\s+", "", as.character(x))
  y <- sub("\\.0$", "", y)
  unique(y[!is.na(y) & nzchar(y)])
}

# Sólo conteos: los identificadores no salen de esta función.
.carm_casos <- function(da, db) {
  clave <- .CARM_CLAVES_RESPUESTA[.CARM_CLAVES_RESPUESTA %in% names(da) &
                                    .CARM_CLAVES_RESPUESTA %in% names(db)][1]
  if (is.na(clave)) {
    return(list(clave = NA_character_, solo_a = NA_integer_, solo_b = NA_integer_, en_ambas = NA_integer_))
  }
  ka <- .carm_clave_norm(da[[clave]])
  kb <- .carm_clave_norm(db[[clave]])
  list(
    clave = clave,
    solo_a = length(setdiff(ka, kb)),
    solo_b = length(setdiff(kb, ka)),
    en_ambas = length(intersect(ka, kb))
  )
}

.carm_leer <- function(sid, base) {
  as.data.frame(.resolve_explorar_data(sid, base, "raw")$data, stringsAsFactors = FALSE,
                check.names = FALSE)
}

#' Compara dos bases ligadas a la misma revisión del formulario publicado.
#' @keywords internal
carga_comparar_fuentes <- function(sid, parsed) {
  a <- .cfp_chr(parsed$base_a)
  b <- .cfp_chr(parsed$base_b)
  if (!nzchar(a) || !nzchar(b)) stop_api(400, "E_BAD_REQUEST", "Indica las dos bases a comparar (base_a y base_b).")
  if (identical(a, b)) stop_api(400, "E_BAD_REQUEST", "Elige dos bases distintas para comparar.")
  s <- session_get(sid)
  meta_a <- .carm_base_meta(s, a)
  meta_b <- .carm_base_meta(s, b)
  rid <- .carm_exigir_misma_revision(s, a, b, meta_a, meta_b)

  resuelto_a <- .resolve_explorar_data(sid, a, "raw")
  da <- as.data.frame(resuelto_a$data, stringsAsFactors = FALSE, check.names = FALSE)
  db <- .carm_leer(sid, b)
  inst <- .carm_instrumento(s, .instrument_validation_revision(s, rid), resuelto_a$instrumento)

  perdidas_a <- .carm_perdidas(meta_a)
  perdidas_b <- .carm_perdidas(meta_b)
  var_perdidas <- unique(c(vapply(perdidas_a, `[[`, "", "variable"), vapply(perdidas_b, `[[`, "", "variable")))

  variables <- list()
  for (p in .carm_preguntas(inst)) {
    ca <- .carm_conteos(da, p)
    cb <- .carm_conteos(db, p)
    if (is.null(ca) && is.null(cb)) next
    v <- .carm_variable(p, inst, ca, cb)
    if (is.na(v$estado)) {
      distinta <- (!is.na(v$diferencia_max_pp) && v$diferencia_max_pp > .CARM_UMBRAL_PP) ||
        length(v$categorias_solo_a) || length(v$categorias_solo_b) || v$variable %in% var_perdidas
      v$estado <- if (distinta) "distinta" else "igual"
    }
    variables[[length(variables) + 1L]] <- v
  }

  estados <- vapply(variables, `[[`, "", "estado")
  dif <- vapply(variables, function(v) v$diferencia_max_pp %||% NA_real_, numeric(1))
  es_distinta <- estados == "distinta"
  orden <- c(which(es_distinta)[order(-dif[es_distinta], na.last = TRUE)], which(!es_distinta))
  variables <- variables[orden]

  con_exclusivas <- unique(c(
    vapply(Filter(function(v) length(v$categorias_solo_a) || length(v$categorias_solo_b), variables),
           `[[`, "", "variable"),
    var_perdidas
  ))

  lado <- function(nombre, meta, data) {
    list(nombre = nombre, n_filas = as.integer(NROW(data)), fuente = .carm_fuente(meta), datos = .carm_datos(meta))
  }
  list(
    ok = TRUE,
    base_a = lado(a, meta_a, da),
    base_b = lado(b, meta_b, db),
    revision_id = rid,
    n_variables = length(variables),
    variables = unname(variables),
    resumen = list(
      n_iguales = sum(estados == "igual"),
      n_distintas = sum(estados == "distinta"),
      n_con_categorias_exclusivas = length(con_exclusivas),
      # Con signo: filas de A menos filas de B.
      diferencia_filas = as.integer(NROW(da) - NROW(db))
    ),
    perdidas_en_carga_a = perdidas_a,
    perdidas_en_carga_b = perdidas_b,
    casos = .carm_casos(da, db)
  )
}
