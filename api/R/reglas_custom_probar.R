# =============================================================================
# Reglas propias: conteo previo sin guardar
# =============================================================================
# POST /api/validacion/v2/reglas_custom/probar recibe una regla que todavía no
# se guardó y dice cuántos casos marcaría. No guarda la regla ni toca la
# evaluación de la sesión.
#
# El conteo sale del mismo motor y de la misma lectura que la auditoría
# (`validacion_auditoria.R`): la regla pasa por el puente de reglas propias, se
# evalúa con `evaluate_validation_bundle()` sobre la tabla que lee la auditoría
# y los casos se identifican con `.limpieza_rule_case_map()`, igual que en
# Hallazgos. Así la cifra del panel es la que aparecerá al auditar.
#
# Cifras (nivel: fila de la tabla principal de la base pedida; en una base hija
# de grupo repetido, cada fila es una instancia del grupo):
#   n_filas    filas de la tabla principal que evalúa la auditoría: después de
#              quitar las filas parciales de opción múltiple y los casos que el
#              estudio declaró fuera del universo (criterio de caso válido).
#   n_base     de esas, las que cumplen el filtro "Solo revisar cuando" de la
#              regla (todas si no tiene filtro) y no están excluidas por el
#              perfil de recolección de su variable revisada.
#   n_casos    de n_base, las que la regla marca. Siempre n_casos <= n_base.
#   proporcion n_casos / n_base, de 0 a 1 sin redondear; NULL si n_base = 0.

.probar_id <- "RC_PRUEBA"
.probar_limite_ejemplos <- 20L

# Las variables que se muestran en cada ejemplo, con su papel:
# - revisada: la que la regla pone en duda (la que se marca como la que falla).
# - comparada: la otra pregunta en una comparación entre preguntas.
# - condicion: la que activa una coherencia ("si P4 = 1").
# - filtro: las del "Solo revisar cuando".
.probar_variables <- function(regla, gate_ast) {
  tipo <- as.character(regla$tipo)
  vars <- .regla_variables_efectivas(regla)
  params <- regla$params %||% list()
  filtro <- if (is.null(gate_ast)) character(0) else ast_variables(gate_ast)
  papel <- switch(tipo,
    condiciones = {
      conds <- params$condiciones %||% list()
      rev <- unique(vapply(conds, function(c) trimws(calc_str(c$variable)), character(1)))
      comp <- unique(vapply(conds, function(c) trimws(calc_str(c$variable_comparada)), character(1)))
      comp <- setdiff(comp[nzchar(comp)], rev)
      c(stats::setNames(rep("revisada", length(rev)), rev),
        stats::setNames(rep("comparada", length(comp)), comp))
    },
    coherencia_2v = {
      out <- c(stats::setNames("condicion", vars[1]), stats::setNames("revisada", vars[2]))
      var_y <- trimws(calc_str(params$valor_y_variable))
      if (nzchar(var_y)) out <- c(out, stats::setNames("comparada", var_y))
      out
    },
    duplicados = stats::setNames(rep("revisada", length(vars)), vars),
    cruce_identidad = stats::setNames(rep("revisada", length(vars)), vars),
    stats::setNames("revisada", vars[1])
  )
  extra <- setdiff(filtro, names(papel))
  c(papel, stats::setNames(rep("filtro", length(extra)), extra))
}

# Copia de la regla con otro predicado: hereda variables, papeles y tabla, así
# que el motor le aplica las mismas exclusiones y el mismo control de columnas
# faltantes que a la regla.
.probar_regla_auxiliar <- function(rule, id, predicate) {
  aux <- rule
  aux$id <- id
  aux$predicate <- ast_normalize(predicate)
  # `aux["gate"] <- list(NULL)` y no `aux$gate <- NULL`: quitar el elemento
  # haría que `rule$gate` encontrara `gate_hash` por coincidencia parcial.
  aux["gate"] <- list(NULL)
  aux$gate_hash <- ""
  aux$predicate_hash <- ast_hash(aux$predicate)
  aux$flag_name <- .derive_flag_name(id)
  aux
}

.probar_valor <- function(x) {
  if (is.null(x) || !length(x)) return(NA_character_)
  if (inherits(x, "haven_labelled")) x <- unclass(x)
  v <- x[[1]]
  if (is.na(v)) return(NA_character_)
  if (inherits(x, c("Date", "POSIXct"))) return(format(x))
  as.character(v)
}

# Los valores ausentes van como NA, que el serializador escribe como `null`
# (un NULL saldría como objeto vacío).
.probar_respuesta <- function(base_nombre, regla, n_filas = 0L, n_base = 0L, n_casos = 0L,
                              evaluada = FALSE, estado = "sin_datos", motivo = NULL,
                              base_vacia = FALSE, ejemplos = list(), tiene_filtro = FALSE) {
  entero <- function(x) if (is.null(x)) NA_integer_ else as.integer(x)
  list(
    ok = TRUE,
    base_nombre = base_nombre %||% NA_character_,
    tabla = "principal",
    tipo = as.character(regla$tipo),
    evaluada = isTRUE(evaluada),
    estado = estado,
    motivo = motivo %||% NA_character_,
    base_vacia = isTRUE(base_vacia),
    filtro_previo = isTRUE(tiene_filtro),
    n_filas = entero(n_filas),
    n_base = entero(n_base),
    n_casos = entero(n_casos),
    proporcion = if (!is.null(n_base) && !is.null(n_casos) && n_base > 0L) n_casos / n_base else NA_real_,
    ejemplos = ejemplos,
    n_ejemplos = length(ejemplos)
  )
}

# Los datos de la base, o NULL si la base todavía no tiene respuestas cargadas.
.probar_archivos <- function(sid, base_eff) {
  files <- tryCatch(.resolve_base_files(sid, base_eff), api_error = function(e) e)
  if (inherits(files, "api_error")) {
    codigo <- as.character(files$code %||% "")
    if (codigo %in% c("E_NO_DATA", "E_NO_FILE")) return(NULL)
    stop(files)
  }
  if (is.null(files$data$path) || !file.exists(files$data$path)) return(NULL)
  files
}

#' Conteo previo de una regla propia sin guardarla
#'
#' @param sid sesión.
#' @param base base pedida (NULL = base activa). Es la base de lectura; no se
#'   escribe nada.
#' @param regla regla propia como la manda el editor (sin guardar).
#' @return lista con `n_casos`, `n_base`, `n_filas`, `proporcion`, `ejemplos`,
#'   `base_vacia`, `evaluada`, `estado` y `motivo`. Ver la cabecera del archivo.
#' @keywords internal
reglas_custom_probar <- function(sid, base = NULL, regla) {
  if (!is.list(regla) || !length(regla)) {
    stop_api(400, "E_REGLA_INVALIDA", "La regla debe ser un objeto.")
  }
  .validar_regla_custom(regla)
  regla$id <- .probar_id
  regla$activa <- TRUE
  regla$variables <- as.list(.regla_variables_efectivas(regla))

  # Se compila como en el plan (texto R) y como en la auditoría (árbol del
  # motor). Si alguna de las dos falla, la regla no se podría auditar.
  rule <- tryCatch({
    .compilar_regla_custom(regla)
    bridge_regla_custom(regla)
  }, api_error = function(e) stop(e), error = function(e) {
    stop_api(422, "E_REGLA_NO_EVALUABLE",
             sprintf("La regla no se puede evaluar: %s", conditionMessage(e)),
             details = list(tipo = as.character(regla$tipo)))
  })
  gate_ast <- .regla_custom_gate_ast(regla)
  tiene_filtro <- !is.null(gate_ast)

  base_eff <- .validacion_auditoria_base(sid, base)
  scope <- .get_base_scope(sid, base_eff)
  files <- .probar_archivos(sid, base_eff)
  if (is.null(files)) {
    return(.probar_respuesta(base_eff, regla, base_vacia = TRUE, estado = "sin_datos",
                             n_filas = 0L, n_base = 0L, n_casos = 0L, tiene_filtro = tiene_filtro))
  }

  # La variable revisada excluida por el estudio: la auditoría no evaluaría la
  # regla y se dice, en vez de devolver 0 casos.
  excluidas <- .validacion_chr_vec(scope$variables_excluidas)
  if (length(intersect(.validacion_rule_target_vars(rule), excluidas))) {
    return(.probar_respuesta(
      base_eff, regla, evaluada = FALSE, estado = "variable_excluida",
      n_filas = NULL, n_base = NULL, n_casos = NULL, tiene_filtro = tiene_filtro,
      motivo = sprintf("La pregunta %s está excluida de la validación en esta base: la auditoría no evaluaría esta regla.",
                       paste(intersect(.validacion_rule_target_vars(rule), excluidas), collapse = ", "))
    ))
  }

  inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  datos <- .validacion_auditoria_leer_datos(
    files$data$path, files$data_ext, inst,
    repeat_children = .validacion_resolve_repeat_children(sid, base_eff),
    operational_config = scope$operational_config %||% NULL
  )
  principal <- datos$principal %||% data.frame()
  if (!nrow(principal)) {
    return(.probar_respuesta(base_eff, regla, base_vacia = TRUE, estado = "sin_datos",
                             n_filas = 0L, n_base = 0L, n_casos = 0L, tiene_filtro = tiene_filtro))
  }

  # Regla, su base (el filtro previo, o todas las filas) y, en "Condiciones
  # combinadas", cada condición por separado para marcar cuál se cumplió.
  id_base <- "RC_PRUEBA_BASE"
  aux <- list(.probar_regla_auxiliar(rule, id_base, gate_ast %||% ast_always_true()))
  conds <- if (identical(as.character(regla$tipo), "condiciones")) regla$params$condiciones else list()
  ids_cond <- sprintf("RC_PRUEBA_COND_%d", seq_along(conds))
  for (i in seq_along(conds)) {
    aux[[length(aux) + 1L]] <- .probar_regla_auxiliar(rule, ids_cond[i], .regla_condicion_ast(conds[[i]]))
  }
  bundle <- list(rules = c(list(rule), aux))
  bundle$plan <- compile_rules_to_plan(bundle$rules)
  bundle <- .validacion_patch_integrated_bundle(bundle, .validacion_mb_base_meta(sid, base_eff))

  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = datos,
    compatibility = validation_profile_for_base(base_eff),
    strict = FALSE,
    validation_exclusions = .validacion_mb_collection_exclusions_for_base(sid, base_eff)
  )
  res <- ev$resumen
  fila <- res[as.character(res$id_regla) == .probar_id, , drop = FALSE]
  n_filas <- nrow(ev$datos %||% principal)
  estado <- as.character(fila$estado_dinamico[1] %||% "no_evaluada")
  if (!nrow(fila) || !identical(estado, "correcta") || is.na(fila$n_inconsistencias[1])) {
    motivo <- as.character(fila$detalle[1] %||% NA_character_)
    if (is.na(motivo) || !nzchar(motivo)) motivo <- "La regla no se pudo evaluar sobre esta base."
    return(.probar_respuesta(
      base_eff, regla, evaluada = FALSE, estado = estado,
      motivo = motivo,
      n_filas = n_filas, n_base = NULL, n_casos = NULL, tiene_filtro = tiene_filtro
    ))
  }

  mapa <- .limpieza_rule_case_map(ev, .probar_id, .limpieza_identidad_caso(scope)$variables)
  base_fila <- res[as.character(res$id_regla) == id_base, , drop = FALSE]
  n_base <- as.integer(base_fila$n_inconsistencias[1] %||% NA_integer_)
  if (is.na(n_base)) n_base <- n_filas
  ejemplos <- .probar_ejemplos(ev, mapa, regla, gate_ast, res, ids_cond)

  .probar_respuesta(
    base_eff, regla, evaluada = TRUE, estado = "evaluada",
    n_filas = n_filas, n_base = n_base, n_casos = length(mapa$row_idx),
    ejemplos = ejemplos, tiene_filtro = tiene_filtro
  )
}

.probar_ejemplos <- function(ev, mapa, regla, gate_ast, res, ids_cond) {
  filas <- utils::head(mapa$row_idx, .probar_limite_ejemplos)
  if (!length(filas)) return(list())
  df <- ev$datos_tablas[[mapa$table]] %||% ev$datos
  papeles <- .probar_variables(regla, gate_ast)
  conds <- regla$params$condiciones %||% list()
  flags_cond <- lapply(seq_along(ids_cond), function(i) {
    flag <- as.character(res$flag[as.character(res$id_regla) == ids_cond[i]][1] %||% "")
    v <- if (nzchar(flag) && flag %in% names(df)) df[[flag]] else rep(NA, nrow(df))
    v[is.na(v)] <- FALSE
    v
  })
  vars_cond <- vapply(conds, function(c) trimws(calc_str(c$variable)), character(1))
  ids <- mapa$case_ids

  lapply(seq_along(filas), function(k) {
    i <- filas[k]
    valores <- lapply(names(papeles), function(v) {
      papel <- papeles[[v]]
      falla <- if (length(ids_cond)) {
        any(vapply(which(vars_cond == v), function(j) isTRUE(flags_cond[[j]][i]), logical(1)))
      } else {
        identical(papel, "revisada")
      }
      list(
        variable = v,
        valor = if (v %in% names(df)) .probar_valor(df[[v]][i]) else NA_character_,
        papel = papel,
        falla = isTRUE(falla)
      )
    })
    list(id_caso = as.character(ids[k]), valores = valores)
  })
}
