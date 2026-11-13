# =============================================================================
# Validación: el caso completo y lo esperado por fila de un hallazgo
# =============================================================================
# Lo que la pestaña Hallazgos necesita del motor para mostrar un caso entero:
#   - `validacion_caso_completo()`: las respuestas del caso agrupadas por
#     sección del formulario y sus hallazgos de la última auditoría. De solo
#     lectura: no toca la evaluación ni marca el proyecto como modificado.
#   - `.validacion_esperado_por_fila()`: el enunciado de cada caso marcado por
#     una regla (`validacion_enunciado_hallazgo()`), para el detalle de casos.
#
# El caso se busca por el mismo id que usan la cola y las decisiones
# (`.limpieza_make_case_ids()` con la llave que rige, `.limpieza_identidad_caso()`),
# en la tabla de la última auditoría. Los datos viajan por código; las
# etiquetas se leen del formulario y van al lado, nunca en lugar del código.

# Tipo de anomalía de una regla (validacion_taxonomia_anomalias.R). Las propias
# se clasifican por su tipo de regla (`rango_num`, `coherencia_2v`...) y por su
# sembrador; las del formulario, por lo que trae el resumen de la auditoría o,
# en una auditoría anterior a esa columna, por su `tipo_regla`. NA si ninguno
# lo dice: no se inventa un tipo.
.validacion_anomalia_de_regla <- function(scope, id_regla, fila_resumen = NULL) {
  propia <- Find(function(r) identical(as.character(r$id %||% ""), as.character(id_regla)),
                 scope$reglas_custom %||% list())
  if (!is.null(propia)) {
    return(validacion_anomalia_tipo(
      tipo_regla = propia$tipo %||% NULL,
      origen_semilla = (propia$semilla %||% list())$origen %||% NULL,
      declarado = propia$anomalia_tipo %||% NULL
    ))
  }
  fila <- fila_resumen %||% list()
  previo <- as.character(fila$anomalia_tipo %||% NA_character_)[1]
  if (!is.na(previo) && nzchar(previo)) return(previo)
  validacion_anomalia_tipo(tipo_regla = as.character(fila$tipo_regla %||% "")[1])
}

# Enunciado por fila del detalle de casos de una regla. `filas` son los índices
# de los casos en la tabla de la auditoría, en el orden en que se publican;
# `ids` sus ids de caso. Devuelve una lista del mismo largo: cada elemento es
# lo que devuelve `validacion_enunciado_hallazgo()` más `anomalia_tipo`, o NA
# (null en JSON) si la regla no tiene tipo de anomalía y por eso no hay
# enunciado. Los valores se leen de la tabla de la auditoría, por código.
.validacion_esperado_por_fila <- function(anomalia, roles, df, filas, ids,
                                          etiquetas_valor = list(), regla = NULL) {
  if (!length(filas)) return(list())
  # Una batería tiene enunciado aunque no tenga tipo de anomalía.
  bateria <- (regla %||% list())$bateria
  fechas <- (regla %||% list())$fechas
  catalogo <- (regla %||% list())$catalogo
  moda <- (regla %||% list())$moda
  if ((is.null(bateria) && is.null(fechas) && is.null(catalogo) && is.null(moda) && (is.na(anomalia) || !nzchar(anomalia))) || !is.data.frame(df)) {
    return(rep(list(NA), length(filas)))
  }
  roles <- roles %||% list()
  vars <- unique(c(as.character(unlist(roles$target %||% character(0))),
                   as.character(unlist(roles$drivers %||% character(0))),
                   if (is_ast(regla$condicion)) ast_variables(regla$condicion) else character(0),
                   as.character(bateria$vars %||% character(0)),
                   as.character(unlist(fechas$regla$variables %||% list(), use.names = FALSE)),
                   as.character((regla %||% list())$formato$var %||% character(0)),
                   if (!is.null(catalogo)) .regla_catalogo_columnas(catalogo$params) else character(0),
                   if (!is.null(moda)) .regla_moda_variables(moda$params) else character(0),
                   as.character(unlist((regla %||% list())$seccion$variables %||% character(0)))))
  vars <- vars[!is.na(vars) & nzchar(vars) & vars %in% names(df)]
  # Valor más frecuente por grupo: el grupo entero se mide una vez y cada fila
  # recibe su propia medida (la causa nombra la moda y su peso en el grupo).
  med_moda <- if (!is.null(moda)) .regla_moda_revisar_df(df, moda$params) else NULL
  lapply(seq_along(filas), function(k) {
    i <- filas[k]
    if (is.na(i)) return(NA)
    if (!is.null(med_moda)) {
      regla$moda$caso <- .regla_moda_resumen(med_moda, i, moda$params, regla$etiquetas)
    }
    valores <- stats::setNames(lapply(vars, function(v) {
      x <- df[[v]][i]
      if (length(x) && !is.na(x)) as.character(x) else NA_character_
    }), vars)
    out <- validacion_enunciado_hallazgo(anomalia, roles, ids[k], valores = valores,
                                         etiquetas_valor = etiquetas_valor, regla = regla)
    c(list(anomalia_tipo = anomalia), out)
  })
}

# Instrumento de la base con las etiquetas curadas del proyecto, o NULL si el
# formulario no se puede leer (el caso se devuelve igual, sin etiquetas).
.validacion_caso_instrumento <- function(sid, base_nombre) {
  files <- tryCatch(.resolve_base_files(sid, base_nombre), error = function(e) NULL)
  if (is.null(files$xlsform$path)) return(NULL)
  inst <- tryCatch(leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE),
                   error = function(e) NULL)
  .validacion_apply_label_overrides(sid, inst)
}

# Respuestas de una fila agrupadas por sección del formulario, en el orden del
# formulario. Solo las preguntas del formulario que tienen columna en la
# tabla (las notas y los grupos no tienen valor).
.validacion_caso_secciones <- function(inst, df, i) {
  survey <- inst$survey
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) return(list())
  tipo <- as.character(survey$type_base %||% survey$type)
  nombre <- as.character(survey$name)
  usar <- !is.na(nombre) & nzchar(nombre) & nombre %in% names(df) &
    !(tipo %in% c("begin_group", "end_group", "begin_repeat", "end_repeat", "note"))
  if (!any(usar)) return(list())
  sv <- survey[usar, , drop = FALSE]
  etiquetas <- .survey_label_map(sv)
  opciones <- .survey_choices_map(sv, inst$choices)
  grupo <- as.character(sv$group_name %||% rep("", nrow(sv)))
  grupo[is.na(grupo)] <- ""
  grupo_etiqueta <- as.character(sv$group_label %||% rep(NA_character_, nrow(sv)))

  lapply(unique(grupo), function(g) {
    filas <- which(grupo == g)
    list(
      seccion = if (nzchar(g)) g else NA_character_,
      etiqueta = if (nzchar(g)) .validacion_texto_o_na(grupo_etiqueta[filas[1]]) else NA_character_,
      variables = lapply(filas, function(j) {
        var <- as.character(sv$name[j])
        .validacion_caso_respuesta(var, as.character(sv$type_base[j] %||% sv$type[j]),
                                   etiquetas[[var]], df[[var]][i], opciones[[var]])
      })
    )
  })
}

.validacion_texto_o_na <- function(x) {
  x <- as.character(x %||% NA_character_)[1]
  if (is.na(x) || !nzchar(trimws(x))) NA_character_ else x
}

.validacion_caso_respuesta <- function(var, tipo, etiqueta, valor, opciones = NULL) {
  v <- if (length(valor) && !is.na(valor)) trimws(as.character(valor)) else NA_character_
  if (!is.na(v) && !nzchar(v)) v <- NA_character_
  et_var <- .validacion_texto_o_na(etiqueta)
  out <- list(
    variable = var,
    etiqueta = if (!is.na(et_var) && identical(et_var, var)) NA_character_ else et_var,
    tipo = tipo,
    valor = v,
    valor_etiqueta = NA_character_
  )
  if (is.na(v) || is.null(opciones)) return(out)
  if (identical(tipo, "select_multiple")) {
    codigos <- strsplit(v, "[[:space:]]+")[[1]]
    out$opciones <- lapply(codigos, function(cod) list(
      codigo = cod, etiqueta = .validacion_texto_o_na(opciones[[cod]])
    ))
  } else {
    out$valor_etiqueta <- .validacion_texto_o_na(opciones[[v]])
  }
  out
}

# Hallazgos del caso en la última auditoría: cada regla que lo marca, en
# cualquier tabla (en una madre con hijas, un registro hijo con el mismo id).
.validacion_caso_hallazgos <- function(scope, id_caso, identidad, inst, narrativa = NULL,
                                       especiales = character(0)) {
  ev <- scope$evaluacion
  catalogo <- .limpieza_rule_catalog(scope)
  if (!nrow(catalogo)) return(list())
  n <- suppressWarnings(as.integer(catalogo$n_inconsistencias))
  catalogo <- catalogo[!is.na(n) & n > 0L, , drop = FALSE]
  if (!nrow(catalogo)) return(list())
  etiquetas <- if (!is.null(inst$survey)) .survey_label_map(inst$survey) else character(0)
  cache <- new.env(parent = emptyenv())
  parejas <- NULL

  out <- list()
  for (k in seq_len(nrow(catalogo))) {
    rid <- as.character(catalogo$id_regla[k])
    mapa <- .limpieza_rule_case_map(ev, rid, identidad, cache)
    if (!(id_caso %in% mapa$case_ids)) next
    vars <- as.character(unlist(catalogo$variables[[k]] %||% list()))
    kind <- as.character(catalogo$hallazgo_kind[k])
    anomalia <- .validacion_anomalia_de_regla(scope, rid, as.list(catalogo[k, , drop = FALSE]))
    # M4: el nombre, la frase, la clase y la severidad son las del catálogo de
    # reglas (validacion_narrativa_regla.R), por id del motor y tabla.
    e <- .vnr_entrada(narrativa, rid, mapa$table)
    h <- c(list(
      id_regla = rid,
      nombre = if (!is.null(e$nombre)) as.character(e$nombre) else .validacion_nombre_regla(catalogo$nombre_regla[k], rid),
      clase = .vrc_clase(kind),
      hallazgo_kind = kind,
      severidad = as.character(catalogo$severidad[k]),
      tipo_regla = as.character(catalogo$tipo_regla[k]),
      categoria = as.character(catalogo$categoria_ux[k]),
      anomalia_tipo = anomalia,
      tabla = as.character(mapa$table),
      variables = lapply(vars, function(v) list(
        variable = v,
        etiqueta = .validacion_texto_o_na(if (v %in% names(etiquetas)) etiquetas[[v]] else NA)
      ))
    ), .vnr_campos_publicos(e)[c("en_catalogo", "id_catalogo", "frase", "frase_completa",
                                  "familia", "familia_nombre", "origen_regla")])
    h <- c(h, .validacion_caso_esperado(scope, ev, rid, mapa, id_caso, anomalia, inst, especiales))
    if (identical(rid, "OP_duplicates")) {
      if (is.null(parejas)) parejas <- validacion_parejas_de_evaluacion(ev, rid, identidad) %||% FALSE
      # NA (null): la regla no se pudo reconstruir, o el caso está marcado y
      # no se le encontró pareja; nunca una lista vacía que se lea como
      # "no coincide con nadie".
      h$coincide_con <- if (isFALSE(parejas)) NA else
        (validacion_coincidencias_de_caso(parejas, id_caso) %||% NA)
    }
    out[[length(out) + 1L]] <- h
  }
  out
}

# Lo esperado del caso en una regla (el mismo enunciado del detalle de la
# regla) y, en la regla de un grupo repetido, los registros que marca: el caso
# es el encuestado y cada registro se nombra por su fila en la tabla de la
# auditoría y su `_index` del export si lo trae.
.validacion_caso_esperado <- function(scope, ev, rid, mapa, id_caso, anomalia, inst, especiales) {
  df <- ev$datos_tablas[[mapa$table]] %||% ev$datos
  filas <- mapa$row_idx[mapa$case_ids == id_caso]
  rule <- Find(function(r) identical(as.character(r$id %||% ""), rid), ev$bundle$rules %||% list())
  roles <- (rule %||% list())$variable_roles %||% list()
  vars <- unique(c(as.character(unlist(roles$target %||% character(0))),
                   as.character(unlist(roles$drivers %||% character(0)))))
  ctx <- .validacion_contexto_enunciado(scope, rid, inst, especiales)
  esperado <- .validacion_esperado_por_fila(anomalia, roles, df, filas, rep(id_caso, length(filas)),
                                            etiquetas_valor = .drill_choice_value_labels(inst, vars),
                                            regla = ctx)
  registros <- if (identical(mapa$table, "principal")) NA else lapply(seq_along(filas), function(k) {
    idx <- if ("_index" %in% names(df)) suppressWarnings(as.integer(df[["_index"]][filas[k]])) else NA_integer_
    list(fila = as.integer(filas[k]), indice = idx, esperado = esperado[[k]])
  })
  out <- list(esperado = if (length(esperado)) esperado[[1]] else NA, registros = registros)
  # Regla de catálogo: la columna de cada papel, para escribir la corrección.
  if (!is.null(ctx$catalogo)) out$roles <- .regla_catalogo_columnas(ctx$catalogo$params, como = "papeles")
  out
}

.validacion_nombre_regla <- function(nombre, id_regla) {
  n <- .validacion_texto_o_na(nombre)
  if (is.na(n)) as.character(id_regla) else n
}

#' Caso completo de la última auditoría
#'
#' @param sid sesión.
#' @param base_nombre base pedida (NULL: la activa).
#' @param id_caso id del caso, el mismo que usan la cola y las decisiones.
#' @return lista con las respuestas por sección y los hallazgos del caso.
#' @keywords internal
validacion_caso_completo <- function(sid, base_nombre, id_caso) {
  id_caso <- as.character(id_caso %||% "")[1]
  if (is.na(id_caso) || !nzchar(id_caso)) {
    stop_api(400, "E_MISSING_ID", "Falta el id del caso (parámetro id).")
  }
  scope <- validacion_scope_get(sid, base_nombre)
  ev <- scope$evaluacion
  if (is.null(ev)) {
    stop_api(409, "E_NO_AUDITORIA",
             "Esta base no tiene auditoría: el caso se lee de la última auditoría.")
  }
  base_eff <- tryCatch(.resolve_base_files(sid, base_nombre)$base_nombre,
                       error = function(e) NULL) %||% base_nombre %||% NA_character_
  identidad <- .limpieza_identidad_caso(scope)$variables
  tablas <- ev$datos_tablas %||% list(principal = ev$datos)
  # Las copias de la tabla principal (la hoja original de un Excel) no son otra
  # tabla del caso: ni lo encuentran ni salen en `en_otras_tablas`.
  tablas <- tablas[setdiff(names(tablas), .limpieza_tablas_alias(ev))]
  orden <- c(intersect("principal", names(tablas)), setdiff(names(tablas), "principal"))

  encontrado <- NULL
  en_otras <- list()
  for (t in orden) {
    df <- tablas[[t]]
    if (!is.data.frame(df) || !nrow(df)) next
    filas <- which(.limpieza_make_case_ids(df, t, identidad) == id_caso)
    if (!length(filas)) next
    if (is.null(encontrado)) {
      encontrado <- list(tabla = t, filas = filas, df = df)
    } else {
      en_otras[[length(en_otras) + 1L]] <- list(tabla = t, n_filas = length(filas))
    }
  }
  if (is.null(encontrado)) {
    stop_api(404, "E_CASO_NO_ENCONTRADO",
             sprintf("No hay ningún caso con el id \"%s\" en la última auditoría de esta base.", id_caso),
             details = list(id_caso = id_caso, base_nombre = base_eff))
  }

  inst <- .validacion_caso_instrumento(sid, base_nombre)
  i <- encontrado$filas[1]
  especiales <- validacion_codigos_especiales_declarados(sid, base_eff, inst)
  narrativa <- tryCatch(validacion_narrativa_reglas(sid, base_nombre), error = function(e) {
    message(sprintf("[prosecnur-app] catálogo de reglas no leído para el caso: %s", conditionMessage(e)))
    NULL
  })
  hallazgos <- .validacion_caso_hallazgos(scope, id_caso, identidad, inst, narrativa, especiales)
  secciones <- if (is.null(inst)) list() else .validacion_caso_secciones(inst, encontrado$df, i)
  secciones <- validacion_caso_respuestas_estado(secciones, inst, encontrado$df, i,
                                                 ev$bundle$choices_map %||% list(), especiales)
  columnas <- validacion_columnas_contexto(scope, inst, encontrado$df)
  list(
    ok = TRUE,
    base_nombre = base_eff,
    id_caso = id_caso,
    identificacion_casos = .limpieza_identificacion_publica(scope) %||% NA,
    tabla = encontrado$tabla,
    fila = as.integer(i),
    n_filas_con_el_id = length(encontrado$filas),
    en_otras_tablas = en_otras,
    auditada_en = as.character(ev$auditada_en %||% NA_character_)[1],
    secciones = secciones,
    # M4: el contexto del caso (fecha, recopilador, duración, preguntas
    # respondidas) solo de columnas declaradas (validacion_contexto_casos.R).
    contexto = columnas,
    metadatos = validacion_contexto_por_fila(encontrado$df, i, columnas, inst)[[1]],
    codigos_especiales_declarados = lapply(names(especiales), function(k) list(
      codigo = k, etiqueta = if (nzchar(especiales[[k]])) especiales[[k]] else NA_character_)),
    catalogo_leido = !is.null(narrativa),
    avisos = Filter(Negate(is.null), list(attr(especiales, "aviso"))),
    instrumento_leido = !is.null(inst),
    n_hallazgos = length(hallazgos),
    hallazgos = hallazgos
  )
}

# Lo que el detalle de casos de una regla (POST /instrumento/regla) suma por
# fila: el id de caso, el enunciado de lo esperado y la pareja de las
# respuestas casi iguales. Cada fila de `casos_df` se ubica en la tabla de la
# auditoría (`.validacion_filas_de_casos()`) y su id sale de la misma función
# que la cola y GET /caso (`.limpieza_make_case_ids()`), nunca de la columna
# tal cual ni de numerar los casos marcados. Una fila que no se puede ubicar
# lleva su id solo si la columna que identifica los casos lo trae y es uno de
# los que la regla marca; si no, NA (null): una decisión armada con él se
# rechaza al guardarla en vez de caer en otra fila.
.validacion_drill_detalle_casos <- function(scope, id_regla, casos_df, variable_roles, inst,
                                            sid = NULL, base = NULL, pagina = NULL) {
  n_casos <- if (is.data.frame(casos_df)) nrow(casos_df) else 0L
  # Posiciones de `casos_df` que publica esta página (validacion_detalle_paginas.R).
  if (is.null(pagina)) pagina <- seq_len(min(n_casos, 500L))
  n <- length(pagina)
  ev <- scope$evaluacion
  identidad <- .limpieza_identidad_caso(scope)$variables
  mapa <- .limpieza_rule_case_map(ev, id_regla, identidad)
  df <- ev$datos_tablas[[mapa$table]] %||% ev$datos
  # M4: narrativa y severidad del catálogo, y columnas de contexto declaradas.
  narrativa <- if (!is.null(sid)) tryCatch(validacion_narrativa_reglas(sid, base), error = function(e) {
    message(sprintf("[prosecnur-app] catálogo de reglas no leído para el detalle: %s", conditionMessage(e)))
    NULL
  }) else NULL
  especiales <- if (!is.null(sid)) validacion_codigos_especiales_declarados(
    sid, tryCatch(.validacion_auditoria_base(sid, base), error = function(e) base), inst) else character(0)
  columnas <- if (is.data.frame(df)) validacion_columnas_contexto(scope, inst, df) else NA
  out <- list(case_ids = character(0), ids_de_la_llave = FALSE, uuid_col = NA_character_,
              esperado = rep(list(NA), n), coincide_con = NA,
              narrativa = .vnr_entrada(narrativa, id_regla, mapa$table),
              catalogo_leido = !is.null(narrativa),
              severidad = .validacion_severidad_por_id(scope, id_regla),
              contexto = columnas, contexto_por_caso = rep(list(NA), n),
              filtro_fuera_de_lista = list())
  # El contexto de redacción de la regla (condición del salto, sección...).
  regla_ctx <- .validacion_contexto_enunciado(scope, id_regla, inst, especiales)
  # Ítem 41: la pregunta filtro con un código fuera de su lista, sobre todos
  # los casos que la regla marca (no solo los de esta página).
  if (is.data.frame(df) && !is.null(regla_ctx$condicion)) {
    out$filtro_fuera_de_lista <- validacion_filtro_fuera_de_lista(
      regla_ctx$condicion, df, mapa$row_idx,
      tryCatch(.survey_choices_map(inst$survey, inst$choices), error = function(e) list()),
      especiales)
  }
  if (!n) {
    out$esperado <- list(); out$contexto_por_caso <- list()
    return(out)
  }
  filas <- .validacion_filas_de_casos(casos_df, df, mapa$row_idx)
  ident <- .limpieza_identificar_casos(df, mapa$table, identidad)
  ids_tabla <- ident$ids
  out$case_ids <- if (length(ids_tabla)) ids_tabla[filas] else rep(NA_character_, n_casos)
  col <- as.character(ident$columna %||% NA_character_)[1]
  if (!is.na(col) && col %in% names(casos_df) && identical(ident$metodo, "columna_candidata")) {
    sin_fila <- is.na(out$case_ids)
    crudos <- as.character(casos_df[[col]])
    validos <- sin_fila & !is.na(crudos) & crudos %in% mapa$case_ids
    out$case_ids[validos] <- crudos[validos]
  }
  out$ids_de_la_llave <- length(identidad) > 0L
  # Columna de `casos` que trae el id tal cual, para mostrarlo; si algún id no
  # coincide con ella (filas sin valor, número de fila), el id es solo el de
  # `case_ids`.
  out$uuid_col <- if (!is.na(col) && col %in% names(casos_df) &&
                      identical(as.character(casos_df[[col]]), out$case_ids)) col else "_pulso_case_id"
  # Desde aquí todo es de la página: `case_ids`, `esperado`, `contexto_por_caso`
  # y `coincide_con` van paralelos a `casos`.
  out$case_ids <- out$case_ids[pagina]
  filas <- filas[pagina]
  if (all(is.na(filas))) return(out)
  ids <- ids_tabla[filas]
  if (is.list(columnas)) out$contexto_por_caso <- validacion_contexto_por_fila(df, filas, columnas, inst)
  res <- ev$resumen
  fila <- as.list(res[which(as.character(res$id_regla) == id_regla)[1], , drop = FALSE])
  anomalia <- .validacion_anomalia_de_regla(scope, id_regla, fila)
  roles <- variable_roles %||% list()
  vars_roles <- unique(c(as.character(unlist(roles$target %||% character(0))),
                         as.character(unlist(roles$drivers %||% character(0)))))
  out$esperado <- .validacion_esperado_por_fila(
    anomalia, roles, df, filas, ids,
    etiquetas_valor = .drill_choice_value_labels(inst, vars_roles),
    regla = regla_ctx
  )
  if (identical(id_regla, "OP_duplicates")) {
    parejas <- validacion_parejas_de_evaluacion(ev, id_regla, identidad)
    if (!is.null(parejas)) {
      out$coincide_con <- lapply(ids, function(id) {
        if (is.na(id)) return(NA)
        validacion_coincidencias_de_caso(parejas, id) %||% NA
      })
    }
  }
  out
}

# Índice en la tabla de la auditoría de cada fila de `casos_df` (las que
# publica el detalle), o NA si no se puede ubicar. Se cruza por la columna
# candidata de identidad cuando `casos_df` la trae y sus valores son únicos
# entre los casos de la regla; si no la trae, por posición, y solo si los dos
# tienen el mismo largo (una hija con ids repetidos multiplica filas al
# enriquecerlas).
.validacion_filas_de_casos <- function(casos_df, df, row_idx) {
  n <- nrow(casos_df)
  if (!is.data.frame(df) || !length(row_idx)) return(rep(NA_integer_, n))
  col <- intersect(.limpieza_uuid_candidates(), intersect(names(casos_df), names(df)))[1]
  if (!is.na(col)) {
    llaves <- as.character(df[[col]][row_idx])
    if (!anyDuplicated(llaves[!is.na(llaves)])) {
      return(as.integer(row_idx[match(as.character(casos_df[[col]]), llaves)]))
    }
  }
  if (length(row_idx) == n) return(as.integer(row_idx))
  rep(NA_integer_, n)
}

#' Respuesta pública del detalle de una regla (POST /instrumento/regla)
#'
#' Suma a la respuesta que arma el router lo que M4 pide del motor: el nombre
#' del catálogo en `regla.nombre` (una sola narrativa por regla), y en `regla`
#' `frase`, `frase_completa`, `familia`, `familia_nombre`, `origen_regla`,
#' `clase`, `severidad`, `en_catalogo` e `id_catalogo`; arriba, `contexto`
#' (columnas declaradas de fecha, recopilador, envío, inicio y fin) y
#' `contexto_por_caso` (mismo largo y orden que `casos`).
#'
#' @param resp lista que arma el router.
#' @param detalle salida de `.validacion_drill_detalle_casos()`.
#' @keywords internal
validacion_detalle_regla_publico <- function(resp, detalle) {
  e <- detalle$narrativa
  if (!is.null(e$nombre) && !is.na(e$nombre)) resp$regla$nombre <- as.character(e$nombre)
  resp$regla <- c(resp$regla, .vnr_campos_publicos(e), list(severidad = detalle$severidad))
  resp$catalogo_leido <- isTRUE(detalle$catalogo_leido)
  resp$contexto <- detalle$contexto
  resp$contexto_por_caso <- detalle$contexto_por_caso
  resp$filtro_fuera_de_lista <- detalle$filtro_fuera_de_lista %||% list()
  resp
}
