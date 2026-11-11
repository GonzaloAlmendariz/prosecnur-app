# =============================================================================
# Auditoría única de Validación
# =============================================================================
# Una sola definición de "lo que se audita" para una base:
#
#   reglas del plan del formulario (incluye las del operativo)
#   - las desactivadas a mano (con su motivo)
#   + las reglas propias activas
#   sin duplicados por id, con el parche de la base integrada y sin las reglas
#   cuya variable objetivo el estudio excluyó.
#
# Antes había dos armados. POST /instrumento/auditoria usaba solo el plan y
# POST /reglas_custom/ejecutar sumaba plan y propias, y los dos escribían la
# misma `scope$evaluacion`: auditar desde "Reglas del formulario" borraba los
# hallazgos de las reglas propias. Ahora las tres rutas (POST /auditoria y las
# dos anteriores, por compatibilidad) llaman a `validacion_auditoria_lanzar()`.
#
# Al terminar, la evaluación guarda la huella de las reglas con que se auditó
# (`evaluacion$huella_reglas`): un hash por regla y otro del conjunto. Con eso
# `validacion_auditoria_estado()` dice si las reglas vigentes difieren de las
# auditadas, sin volver a evaluar.
#
# Base de lectura y escritura: la que resuelve `.resolve_base_nombre()` para el
# `base` pedido (la base activa si no se pide ninguna). Las hermanas y la base
# integrada no se tocan.

# Base efectiva de una petición. NULL solo en sesiones heredadas sin estudio.
.validacion_auditoria_base <- function(sid, base = NULL) {
  .resolve_base_nombre(session_get(sid), base)
}

# Las reglas que se auditarían hoy en la base, sin el plan compilado. Lo usan el
# armado del paquete y la comparación de huellas, para que las dos vean el mismo
# conjunto.
.validacion_auditoria_reglas <- function(sid, base_eff, scope) {
  compat <- validation_profile_for_base(base_eff)
  plan_result <- scope$plan_result
  bundle <- if (!is.null(plan_result)) {
    plan_result$bundle %||%
      validation_bundle_from_plan_df(plan_result$plan,
                                     existing_bundle = NULL,
                                     compatibility = compat)
  } else {
    list(rules = list(), plan = compile_rules_to_plan(list()), compatibility = compat)
  }
  reglas_plan <- bundle$rules %||% list()
  ids_plan <- vapply(reglas_plan, function(r) as.character(r$id), character(1))

  propias <- Filter(function(r) isTRUE(r$activa), scope$reglas_custom %||% list())
  reglas_propias <- .validacion_auditoria_puente_propias(propias)

  desactivadas <- .validacion_chr_vec(scope$reglas_desactivadas)
  todas <- .dedup_rules_exact(c(reglas_plan, reglas_propias))
  ids <- vapply(todas, function(r) as.character(r$id), character(1))
  quedan <- todas[!(ids %in% desactivadas)]

  list(
    bundle = bundle,
    reglas = quedan,
    ids_plan = ids_plan,
    cambio_conjunto = length(quedan) != length(reglas_plan) ||
      !identical(vapply(quedan, function(r) as.character(r$id), character(1)), ids_plan)
  )
}

# Puente de las reglas propias al formato del motor. Una regla guardada que el
# puente no sabe traducir no se descarta en silencio: corta la auditoría y dice
# cuál es.
.validacion_auditoria_puente_propias <- function(propias) {
  lapply(propias, function(r) {
    tryCatch(
      bridge_regla_custom(r),
      error = function(e) {
        stop_api(422, "E_REGLA_NO_EVALUABLE",
                 sprintf("La regla propia \"%s\" no se puede evaluar: %s",
                         as.character(r$nombre %||% r$id %||% ""), conditionMessage(e)),
                 details = list(id_regla = as.character(r$id %||% ""),
                                tipo = as.character(r$tipo %||% "")))
      }
    )
  })
}

#' Paquete auditable de una base
#'
#' Reglas del plan del formulario menos las desactivadas, más las reglas propias
#' activas, sin duplicados por id. Aplica el parche de la base integrada y quita
#' las reglas cuya variable objetivo está excluida. No evalúa nada.
#'
#' @param sid sesión.
#' @param base base pedida (NULL = base activa).
#' @return list(base_nombre, bundle, n_reglas, n_plan, n_propias, huella).
#' @keywords internal
validacion_paquete_auditable <- function(sid, base = NULL) {
  base_eff <- .validacion_auditoria_base(sid, base)
  scope <- .get_base_scope(sid, base_eff)
  armado <- .validacion_auditoria_reglas(sid, base_eff, scope)

  bundle <- armado$bundle
  bundle$rules <- armado$reglas
  # El plan compilado solo se rehace si cambió el conjunto: así una auditoría
  # sin propias ni desactivadas conserva el plan tal como lo dejó el formulario
  # (atributos editados incluidos).
  if (isTRUE(armado$cambio_conjunto) || is.null(bundle$plan)) {
    bundle$plan <- compile_rules_to_plan(bundle$rules)
  }
  bundle <- .validacion_patch_integrated_bundle(bundle, .validacion_mb_base_meta(sid, base_eff))
  bundle <- .validacion_filter_bundle_excluded_vars(bundle, scope$variables_excluidas %||% character(0))

  ids_final <- vapply(bundle$rules %||% list(), function(r) as.character(r$id), character(1))
  list(
    base_nombre = base_eff,
    bundle = bundle,
    n_reglas = length(ids_final),
    n_plan = sum(ids_final %in% armado$ids_plan),
    n_propias = sum(!(ids_final %in% armado$ids_plan)),
    huella = validacion_huella_reglas(bundle$rules)
  )
}

# -----------------------------------------------------------------------------
# Huella de reglas
# -----------------------------------------------------------------------------
# Lo que cambia el resultado de una regla: su id, su tipo, la tabla, el
# predicado, el filtro previo, las variables, la severidad y los códigos
# residuales. El nombre, el mensaje y el objetivo no cambian qué casos marca y
# quedan fuera, para que renombrar una regla no la deje "sin auditar".
.validacion_huella_regla <- function(r) {
  hash_ast <- function(x) {
    if (is.null(x)) return("")
    tryCatch(ast_hash(x), error = function(e) digest::digest(x, algo = "xxhash64"))
  }
  digest::digest(list(
    id = as.character(r$id %||% ""),
    tipo_regla = as.character(r$tipo_regla %||% ""),
    tabla = as.character(r$tabla %||% "principal"),
    predicado = hash_ast(r$predicate),
    filtro = hash_ast(r$gate),
    variables = sort(as.character(unlist(r$variables %||% character(0)))),
    severidad = as.character(r$severidad %||% ""),
    repeat_context = as.character(r$repeat_context %||% ""),
    residuales = sort(as.character(unlist(r$residual_codes %||% character(0))))
  ), algo = "xxhash64")
}

#' Huella de un conjunto de reglas
#'
#' @param rules lista de reglas del motor (`vd_rule`).
#' @return list(conjunto = hash, por_regla = lista con nombre id -> hash, n_reglas).
#' @keywords internal
validacion_huella_reglas <- function(rules) {
  rules <- rules %||% list()
  ids <- vapply(rules, function(r) as.character(r$id %||% ""), character(1))
  hashes <- vapply(rules, .validacion_huella_regla, character(1))
  orden <- order(ids)
  por_regla <- stats::setNames(as.list(hashes[orden]), ids[orden])
  list(
    conjunto = digest::digest(paste(ids[orden], hashes[orden], sep = ":"), algo = "xxhash64"),
    por_regla = por_regla,
    n_reglas = length(rules)
  )
}

.validacion_huella_diferencias <- function(vigente, auditada) {
  ids_v <- names(vigente$por_regla %||% list())
  ids_a <- names(auditada$por_regla %||% list())
  comunes <- intersect(ids_v, ids_a)
  modificadas <- comunes[vapply(comunes, function(id) {
    !identical(vigente$por_regla[[id]], auditada$por_regla[[id]])
  }, logical(1))]
  list(
    agregadas = as.list(sort(setdiff(ids_v, ids_a))),
    quitadas = as.list(sort(setdiff(ids_a, ids_v))),
    modificadas = as.list(sort(modificadas))
  )
}

#' Estado de la auditoría de una base frente a las reglas vigentes
#'
#' `estado`:
#' - `sin_reglas`: no hay plan del formulario ni reglas propias activas.
#' - `sin_auditoria`: hay reglas y ninguna auditoría guardada (o se invalidó).
#' - `vigente`: la huella de las reglas auditadas es la de las vigentes.
#' - `desactualizada`: alguna regla se agregó, se quitó o cambió desde la
#'   auditoría.
#' - `sin_huella`: la auditoría es anterior a la huella y tiene las mismas
#'   reglas por id; no se puede saber si alguna cambió por dentro.
#'
#' @keywords internal
validacion_auditoria_estado <- function(sid, base = NULL) {
  paquete <- validacion_paquete_auditable(sid, base)
  scope <- .get_base_scope(sid, paquete$base_nombre)
  ev <- scope$evaluacion
  vigente <- paquete$huella
  auditada <- ev$huella_reglas %||% NULL
  vacio <- list(agregadas = list(), quitadas = list(), modificadas = list())

  if (is.null(ev)) {
    estado <- if (paquete$n_reglas == 0L) "sin_reglas" else "sin_auditoria"
    cambios <- vacio
  } else if (is.null(auditada)) {
    ids_auditados <- .validacion_chr_vec((ev$resumen %||% list())$id_regla)
    ids_vigentes <- names(vigente$por_regla)
    cambios <- list(
      agregadas = as.list(sort(setdiff(ids_vigentes, ids_auditados))),
      quitadas = as.list(sort(setdiff(ids_auditados, ids_vigentes))),
      modificadas = list()
    )
    estado <- if (length(cambios$agregadas) || length(cambios$quitadas)) "desactualizada" else "sin_huella"
  } else {
    cambios <- .validacion_huella_diferencias(vigente, auditada)
    estado <- if (identical(vigente$conjunto, auditada$conjunto)) "vigente" else "desactualizada"
  }

  list(
    ok = TRUE,
    base_nombre = paquete$base_nombre %||% NA_character_,
    estado = estado,
    # Ausente = NA, que el serializador escribe como `null`.
    auditada_en = ev$auditada_en %||% NA_character_,
    n_reglas_vigentes = as.integer(paquete$n_reglas),
    n_reglas_auditadas = if (is.null(ev)) NA_integer_ else as.integer(auditada$n_reglas %||% nrow(ev$resumen %||% data.frame())),
    huella_vigente = vigente$conjunto,
    huella_auditada = auditada$conjunto %||% NA_character_,
    cambios = cambios
  )
}

# -----------------------------------------------------------------------------
# Lectura de datos y trabajo de auditoría
# -----------------------------------------------------------------------------
# La misma lectura para la auditoría y para el conteo previo de una regla
# (`reglas_custom_probar()`): madre con sus hijas de grupo repetido si las hay;
# si no, la tabla de la base con el criterio de caso válido del estudio.
.validacion_auditoria_leer_datos <- function(data_path, data_ext, inst,
                                             repeat_children = list(),
                                             operational_config = NULL) {
  if (length(repeat_children)) {
    assemble_validation_data_multibase(
      main_data_path = data_path,
      main_data_ext = data_ext,
      main_instrumento = inst,
      repeat_children = repeat_children
    )
  } else {
    read_validation_data_ast(
      path = data_path,
      ext = data_ext,
      instrumento = inst,
      operational_config = operational_config
    )
  }
}

.validacion_auditoria_total <- function(ev) {
  total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
  if (is.numeric(total_raw) && length(total_raw) == 1L) return(as.integer(total_raw))
  if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
    ca <- total_raw$cabecera
    return(as.integer(if (is.data.frame(ca)) ca$Total_inconsistencias[1] else ca[[1]]$Total_inconsistencias))
  }
  NA_integer_
}

# Trabajo `callr`: recibe rutas y el paquete ya armado, nunca la sesión.
.validacion_auditoria_trabajo <- function(data_path, data_ext, xlsform_path, bundle,
                                          base_name, validation_exclusions = list(),
                                          repeat_children = list(),
                                          operational_config = NULL,
                                          progress_path = NULL) {
  report <- if (exists("job_progress_writer", mode = "function")) {
    job_progress_writer(progress_path)
  } else {
    function(...) invisible(NULL)
  }
  report("loading", percent = 8, message = "Leyendo el formulario y la base")
  inst <- leer_xlsform_limpieza(xlsform_path, verbose = FALSE)
  datos <- .validacion_auditoria_leer_datos(data_path, data_ext, inst,
                                            repeat_children = repeat_children,
                                            operational_config = operational_config)
  report("evaluate", percent = 45, message = "Evaluando las reglas")
  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = datos,
    compatibility = validation_profile_for_base(base_name),
    strict = FALSE,
    validation_exclusions = validation_exclusions
  )
  report("export", percent = 92, message = "Preparando el resumen de la auditoría")
  list(ev = ev, total = .validacion_auditoria_total(ev))
}

#' Lanza la auditoría única de una base
#'
#' @param sid sesión.
#' @param base base pedida (NULL = base activa).
#' @param kind tipo del trabajo (se conserva el de cada ruta por compatibilidad).
#' @return list(ok, job_id, kind, base_nombre, n_reglas, n_plan, n_propias,
#'   huella_reglas).
#' @keywords internal
validacion_auditoria_lanzar <- function(sid, base = NULL, kind = "validacion.v2.auditoria") {
  paquete <- validacion_paquete_auditable(sid, base)
  base_eff <- paquete$base_nombre
  if (paquete$n_reglas == 0L) {
    stop_api(409, "E_NO_REGLAS_AUDITABLES",
             "No hay reglas que auditar en esta base: falta el plan del formulario y no hay reglas propias activas.")
  }
  files <- .resolve_base_files(sid, base_eff)
  scope <- .get_base_scope(sid, base_eff)
  huella <- paquete$huella

  job_id <- job_submit(
    sid = sid,
    kind = kind,
    func = .validacion_auditoria_trabajo,
    args = list(
      data_path = files$data$path,
      data_ext = files$data_ext,
      xlsform_path = files$xlsform$path,
      bundle = paquete$bundle,
      base_name = base_eff,
      validation_exclusions = .validacion_mb_collection_exclusions_for_base(sid, base_eff),
      # ADR 0030 Fase 2: hijas de grupo repetido de la base, para el ensamblado.
      repeat_children = .validacion_resolve_repeat_children(sid, base_eff),
      # El criterio de caso válido viaja al trabajo: los casos que el estudio
      # declaró fuera del universo no generan inconsistencias.
      operational_config = scope$operational_config %||% NULL
    ),
    on_complete = function(j) {
      raw <- j$result_data
      ev <- raw$ev
      ev$huella_reglas <- huella
      ev$auditada_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      validacion_scope_set(j$sid, base_eff, "evaluacion", ev)
      # Con la auditoría de vuelta existe catálogo de reglas: las exclusiones
      # que sobrevivieron a una recarga del formulario vuelven al borrador si su
      # regla reapareció.
      .limpieza_rehidratar_preservadas(j$sid, base_eff)
      .limpieza_invalidate_outputs(j$sid, base_eff)
      list(ok = TRUE, total_inconsistencias = raw$total %||% NA_integer_,
           n_reglas = huella$n_reglas, huella_reglas = huella$conjunto)
    }
  )
  list(
    ok = TRUE,
    job_id = job_id,
    kind = kind,
    base_nombre = base_eff %||% NA_character_,
    n_reglas = as.integer(paquete$n_reglas),
    n_plan = as.integer(paquete$n_plan),
    n_propias = as.integer(paquete$n_propias),
    huella_reglas = huella$conjunto
  )
}
