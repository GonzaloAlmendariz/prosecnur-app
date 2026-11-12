# =============================================================================
# Catálogo de reglas (M3): la base de cada regla en la última auditoría
# =============================================================================
# `n_base` es cuántas filas de la tabla de la regla podían fallar en ella
# (cambio 6 de la revisión metodológica de M2). El porcentaje de una regla se
# calcula sobre esa base y no sobre todas las filas: "3 de 12" en un salto que
# abre a 12 personas, no "3 de 426".
#
#   tipo de base           regla                         filas que cuentan
#   condicion_verdadera    salto "debe"                  la condición que abre la pregunta se cumple
#   condicion_falsa        salto "no debe"               la condición no se cumple
#   condicion_verdadera    obligatoria con condición     la pregunta se mostró (condición de su grupo)
#   respondieron           restricción, rango, periodo   la pregunta tiene respuesta (y su condición se cumple)
#   filtro                 regla propia con filtro       cumplen "Solo revisar cuando" (como el conteo previo)
#   todas                  el resto                      todas las filas de la tabla
#
# Nivel: fila de la tabla de la regla. En la principal, un caso; en la tabla de
# un grupo repetido, un registro.
#
# La base se cuenta con el mismo motor y sobre las mismas filas que auditó la
# última auditoría (`evaluacion$datos_tablas`): cada regla evaluada tiene una
# regla auxiliar con su misma tabla, variables y exclusiones y, como
# predicado, la condición de la base (`.probar_regla_auxiliar()`, el mismo
# armado del conteo previo de reglas propias). Una fila donde la condición no
# se puede evaluar (NA) va en `n_base_indeterminada` y no en `n_base`.

# Condición de la base de una regla del motor. Devuelve
# list(tipo, ast) con `ast = NULL` cuando la base son todas las filas, o NULL si
# la estructura del salto no se reconoce (entonces no hay base y se dice).
.vrb_condicion <- function(rule, propia = NULL) {
  tipo <- as.character(rule$tipo_regla %||% "")
  target <- as.character((rule$variable_roles %||% list())$target %||% rule$primary_var %||% "")[1]
  if (!is.null(propia)) {
    gate <- .regla_custom_gate_ast(propia)
    return(list(tipo = if (is.null(gate)) "todas" else "filtro", ast = gate))
  }
  if (identical(tipo, "skip")) {
    sub <- as.character((rule$presentation %||% list())$subtipo_semantico %||% "")
    cond <- .vrb_condicion_salto(rule$predicate, target, sub)
    if (is.null(cond)) return(NULL)
    return(list(tipo = if (identical(sub, "nodebe")) "condicion_falsa" else "condicion_verdadera",
                ast = cond))
  }
  if (identical(tipo, "required")) {
    return(list(tipo = if (is.null(rule$gate)) "todas" else "condicion_verdadera", ast = rule$gate))
  }
  if (tipo %in% c("constraint", "range", "catalog") && nzchar(target)) {
    respondio <- ast_not(ast_is_missing(target))
    ast <- if (is.null(rule$gate)) respondio else ast_and(rule$gate, respondio)
    return(list(tipo = "respondieron", ast = ast_normalize(ast)))
  }
  list(tipo = "todas", ast = NULL)
}

# En un salto el predicado es "condición y la pregunta vacía" ("debe") o
# "condición contraria y la pregunta con respuesta" ("no debe"). La base es la
# condición: el predicado sin la parte que mira la pregunta.
.vrb_condicion_salto <- function(pred, target, subtipo) {
  if (!is_ast(pred) || !identical(ast_op(pred), "and") || !nzchar(target)) return(NULL)
  es_parte <- function(a) {
    if (!is_ast(a)) return(FALSE)
    if (identical(subtipo, "nodebe")) {
      identical(ast_op(a), "not") && is_ast(a$arg) && identical(ast_op(a$arg), "is_missing") &&
        identical(as.character(a$arg$var), target)
    } else {
      identical(ast_op(a), "is_missing") && identical(as.character(a$var), target)
    }
  }
  args <- pred$args %||% list()
  quitar <- vapply(args, es_parte, logical(1))
  if (sum(quitar) != 1L) return(NULL)
  resto <- args[!quitar]
  if (!length(resto)) return(NULL)
  ast_normalize(ast_and(resto))
}

# Texto de la base para escribir después de la cifra ("18 a quienes les
# correspondía responder"). En la tabla de un grupo repetido la unidad es el
# registro y el grupo se nombra por su rótulo (`grupo`), nunca por el código.
.vrb_base_texto <- function(tipo, tipo_regla, tabla, familia = "", grupo = tabla) {
  if (!identical(tabla, "principal")) {
    reg <- sprintf("registros de \"%s\"", grupo)
    return(switch(tipo,
      todas = reg,
      condicion_verdadera = if (identical(tipo_regla, "required")) paste(reg, "en que se mostró la pregunta")
                            else paste(reg, "en que correspondía responder"),
      condicion_falsa = paste(reg, "en que no correspondía responder"),
      respondieron = paste(reg, "con respuesta"),
      filtro = paste(reg, "que cumplen el filtro de la regla"),
      NA_character_))
  }
  switch(tipo,
    todas = "casos de la base",
    condicion_verdadera = if (identical(tipo_regla, "required")) "a quienes se les mostró la pregunta"
                          else "a quienes les correspondía responder",
    condicion_falsa = "a quienes no les correspondía responder",
    respondieron = if (identical(familia, "periodo")) "con la fecha registrada" else "que respondieron la pregunta",
    filtro = "que cumplen el filtro de la regla",
    NA_character_)
}

# Tabla donde la auditoría deja la marca de una regla. La cantidad de
# registros de un grupo repetido se marca en la encuesta (tabla principal).
.vrb_tabla_de <- function(rule) {
  if (identical(as.character(rule$tipo_regla), "repeat_length")) return("principal")
  .normalize_rule_table(rule$tabla)
}

# Bases de las reglas evaluadas en la última auditoría.
#
# Todas se cuentan con una regla auxiliar evaluada por el motor, también la base
# "todas" (predicado siempre cierto): así la base usa exactamente las filas que
# auditó la auditoría, sin las que las exclusiones de recolección dejan fuera de
# la regla. La única excepción es la cantidad de registros de un grupo repetido,
# que el motor evalúa aparte sobre la tabla principal y sin exclusiones.
#
# @param ev evaluación guardada (`scope$evaluacion`).
# @param reglas lista de list(id, rule, propia) con la regla auditada.
# @param exclusiones exclusiones de recolección de la base (las de la auditoría).
# @param compat perfil de compatibilidad de la base.
# @return lista con nombre = id: list(n_base, n_base_indeterminada, n_filas,
#   n_casos_indeterminados, tipo, tabla). `n_casos_indeterminados`: filas donde
#   la marca de la regla quedó NA en la auditoría (la comparación no se pudo
#   decidir).
.vrb_bases <- function(ev, reglas, exclusiones = list(), compat = NULL) {
  out <- list()
  tablas <- ev$datos_tablas %||% list()
  if (!length(reglas) || !length(tablas)) return(out)
  aux <- list(); dueno <- character(0); tipos <- list()
  for (i in seq_along(reglas)) {
    r <- reglas[[i]]
    cond <- .vrb_condicion(r$rule, r$propia)
    tipos[[r$id]] <- cond
    if (is.null(cond) || identical(as.character(r$rule$tipo_regla), "repeat_length")) next
    aux_id <- sprintf("VRB_BASE_%04d", i)
    aux[[length(aux) + 1L]] <- .probar_regla_auxiliar(r$rule, aux_id, cond$ast %||% ast_always_true())
    dueno[aux_id] <- r$id
  }
  res <- NULL
  if (length(aux)) {
    # Plan mínimo (id y tabla): las auxiliares no tienen nombre ni objetivo que
    # publicar y compilar el plan entero costaba más que evaluarlas.
    # Las opciones del formulario viajan como en la auditoría: con ellas el
    # motor compara por código o por etiqueta y decide si una regla está
    # desalineada. Sin ellas la base de una regla evaluada salía "desalineada".
    bundle <- list(rules = aux, plan = data.frame(
      ID = vapply(aux, function(a) a$id, character(1)),
      Tabla = vapply(aux, function(a) .normalize_rule_table(a$tabla), character(1)),
      stringsAsFactors = FALSE),
      choices_map = (ev$bundle %||% list())$choices_map %||% list())
    data_input <- list(principal = tablas$principal %||% tablas[[1]], tables = tablas)
    ev_aux <- evaluate_validation_bundle(bundle, data_input, compatibility = compat,
                                         strict = FALSE, validation_exclusions = exclusiones)
    res <- ev_aux$resumen
    datos_aux <- ev_aux$datos_tablas
  }
  for (r in reglas) {
    cond <- tipos[[r$id]]
    tabla <- .vrb_tabla_de(r$rule)
    n_filas <- if (is.data.frame(tablas[[tabla]])) nrow(tablas[[tabla]]) else NA_integer_
    # Filas donde lo que la regla compara salió NA (la marca de la auditoría):
    # la regla no pudo decidir si fallaba, aunque su condición sí se evaluó.
    marca <- (tablas[[tabla]] %||% list())[[as.character(r$rule$flag_name %||% "")]]
    n_marca_na <- if (is.null(marca)) NA_integer_ else as.integer(sum(is.na(marca)))
    vacio <- list(n_base = NA_integer_, n_base_indeterminada = NA_integer_, n_filas = as.integer(n_filas),
                  n_casos_indeterminados = n_marca_na,
                  tipo = if (is.null(cond)) NA_character_ else cond$tipo, tabla = tabla)
    if (is.null(cond)) { out[[r$id]] <- vacio; next }
    if (identical(as.character(r$rule$tipo_regla), "repeat_length")) {
      out[[r$id]] <- utils::modifyList(vacio, list(n_base = as.integer(n_filas), n_base_indeterminada = 0L))
      next
    }
    aux_id <- names(dueno)[dueno == r$id][1]
    fila <- if (!is.null(res)) res[as.character(res$id_regla) == aux_id, , drop = FALSE] else NULL
    ok <- !is.null(fila) && nrow(fila) && identical(as.character(fila$estado_dinamico[1]), "correcta")
    if (!ok) { out[[r$id]] <- vacio; next }
    flag <- .derive_flag_name(aux_id)
    vec <- (datos_aux[[tabla]] %||% list())[[flag]]
    n_na <- if (is.null(vec)) NA_integer_ else sum(is.na(vec))
    out[[r$id]] <- utils::modifyList(vacio, list(n_base = as.integer(fila$n_inconsistencias[1]),
                                                 n_base_indeterminada = as.integer(n_na)))
  }
  out
}

# --- Caché ------------------------------------------------------------------
# Mismo patrón que analitica_lectura_cache.R: un env de módulo (no viaja al
# `.pulso`), con tope de entradas y una firma de todo lo que cambia el resultado.
# Nada se invalida a mano: si cambia algo de la firma, cambia la clave.

.validacion_reglas_cache <- new.env(parent = emptyenv())
.VALIDACION_REGLAS_CACHE_MAX <- 24L

.validacion_reglas_cache_get <- function(clave) {
  if (is.null(clave)) return(NULL)
  hit <- get0(clave, envir = .validacion_reglas_cache, inherits = FALSE)
  if (is.null(hit)) return(NULL)
  hit$used_at <- Sys.time()
  assign(clave, hit, envir = .validacion_reglas_cache)
  hit$value
}

.validacion_reglas_cache_put <- function(clave, value) {
  if (is.null(clave)) return(invisible(value))
  assign(clave, list(value = value, used_at = Sys.time()), envir = .validacion_reglas_cache)
  keys <- ls(.validacion_reglas_cache, all.names = TRUE)
  if (length(keys) > .VALIDACION_REGLAS_CACHE_MAX) {
    used <- vapply(keys, function(k) as.numeric(get(k, envir = .validacion_reglas_cache)$used_at), numeric(1))
    rm(list = keys[order(used)][seq_len(length(keys) - .VALIDACION_REGLAS_CACHE_MAX)],
       envir = .validacion_reglas_cache)
  }
  invisible(value)
}

.validacion_reglas_cache_clear <- function() {
  keys <- ls(.validacion_reglas_cache, all.names = TRUE)
  if (length(keys)) rm(list = keys, envir = .validacion_reglas_cache)
  invisible(length(keys))
}

# Huella de una evaluación sin digerir sus tablas enteras: resumen, fecha,
# huella de reglas y forma de cada tabla.
.vrb_huella_evaluacion <- function(ev) {
  if (is.null(ev)) return(NULL)
  list(resumen = digest::digest(ev$resumen, algo = "xxhash64"),
       auditada_en = ev$auditada_en %||% NA_character_,
       huella = (ev$huella_reglas %||% list())$conjunto %||% NA_character_,
       tablas = lapply(ev$datos_tablas %||% list(), function(d) if (is.data.frame(d)) dim(d) else NULL),
       # Huella de los datos completos: con solo las primeras filas, dos bases
       # hermanas con la misma forma auditadas en el mismo segundo se mezclaban.
       datos = digest::digest(ev$datos_tablas %||% list(), algo = "xxhash64"),
       opciones = digest::digest(ev$bundle$choices_map %||% list(), algo = "xxhash64"))
}

# Bases con caché: las piden el catálogo, el estado de la auditoría y su
# resultado; se cuentan una vez por evaluación.
.vrb_bases_cached <- function(ev, reglas, exclusiones = list(), compat = NULL, sid = NULL, base = NULL) {
  clave <- tryCatch(digest::digest(list(
    "bases", sid, base, .vrb_huella_evaluacion(ev),
    lapply(reglas, function(r) list(r$id, .validacion_huella_regla(r$rule), r$propia)),
    exclusiones, compat), algo = "xxhash64"),
    # Sin firma se cuenta sin caché: la caché es una optimización, nunca un error.
    error = function(e) NULL)
  hit <- .validacion_reglas_cache_get(clave)
  if (!is.null(hit)) return(hit)
  .validacion_reglas_cache_put(clave, .vrb_bases(ev, reglas, exclusiones, compat))
}

# Reglas de una evaluación que la auditoría evaluó ("correcta"), con su regla
# propia si lo es, listas para contar su base.
.vrb_reglas_evaluadas <- function(ev, propias = list()) {
  res <- ev$resumen
  if (is.null(ev) || !is.data.frame(res) || !nrow(res)) return(list())
  ids_res <- as.character(res$id_regla)
  repetidos <- unique(ids_res[duplicated(ids_res)])
  por_id <- stats::setNames(propias, vapply(propias, function(p) as.character(p$id %||% ""), character(1)))
  out <- list()
  for (rule in ev$bundle$rules %||% list()) {
    id <- as.character(rule$id)
    k <- match(id, ids_res)
    if (is.na(k) || id %in% repetidos) next
    if (!is.na(.vrc_causa_auditoria(res$estado_dinamico[k], res$issue_code[k]))) next
    out[[length(out) + 1L]] <- list(id = id, rule = rule, propia = por_id[[id]])
  }
  out
}
