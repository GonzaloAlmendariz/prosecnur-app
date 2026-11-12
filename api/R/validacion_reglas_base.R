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

.VRB_BASE_TEXTO <- list(
  condicion_verdadera = c(skip = "a quienes les correspondía responder",
                          required = "a quienes se les mostró la pregunta"),
  condicion_falsa = "a quienes no les correspondía responder",
  respondieron = "que respondieron la pregunta",
  filtro = "que cumplen el filtro de la regla"
)

.vrb_base_texto <- function(tipo, tipo_regla, tabla) {
  if (identical(tipo, "todas")) {
    return(if (identical(tabla, "principal")) "casos de la base" else sprintf("registros de %s", tabla))
  }
  txt <- .VRB_BASE_TEXTO[[tipo]]
  if (is.null(txt)) return(NA_character_)
  if (length(txt) > 1L) return(unname(txt[[if (tipo_regla %in% names(txt)) tipo_regla else 1L]]))
  unname(txt)
}

# Bases de las reglas evaluadas en la última auditoría.
#
# @param ev evaluación guardada (`scope$evaluacion`).
# @param reglas lista de list(id, rule, propia) con la regla auditada.
# @param exclusiones exclusiones de recolección de la base (las de la auditoría).
# @param compat perfil de compatibilidad de la base.
# @return lista con nombre = id: list(n_base, n_base_indeterminada, tipo, tabla).
.vrb_bases <- function(ev, reglas, exclusiones = list(), compat = NULL) {
  out <- list()
  tablas <- ev$datos_tablas %||% list()
  if (!length(reglas) || !length(tablas)) return(out)
  aux <- list(); dueno <- character(0); tipos <- list()
  for (i in seq_along(reglas)) {
    r <- reglas[[i]]
    cond <- .vrb_condicion(r$rule, r$propia)
    tipos[[r$id]] <- cond
    if (is.null(cond) || is.null(cond$ast)) next
    aux_id <- sprintf("VRB_BASE_%04d", i)
    aux[[length(aux) + 1L]] <- .probar_regla_auxiliar(r$rule, aux_id, cond$ast)
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
    tabla <- .normalize_rule_table(r$rule$tabla)
    if (is.null(cond)) {
      out[[r$id]] <- list(n_base = NA_integer_, n_base_indeterminada = NA_integer_,
                          tipo = NA_character_, tabla = tabla)
      next
    }
    if (is.null(cond$ast)) {
      n <- if (is.data.frame(tablas[[tabla]])) nrow(tablas[[tabla]]) else NA_integer_
      out[[r$id]] <- list(n_base = as.integer(n), n_base_indeterminada = 0L, tipo = cond$tipo, tabla = tabla)
      next
    }
    aux_id <- names(dueno)[dueno == r$id][1]
    fila <- if (!is.null(res)) res[as.character(res$id_regla) == aux_id, , drop = FALSE] else NULL
    ok <- !is.null(fila) && nrow(fila) && identical(as.character(fila$estado_dinamico[1]), "correcta")
    if (!ok) {
      out[[r$id]] <- list(n_base = NA_integer_, n_base_indeterminada = NA_integer_,
                          tipo = cond$tipo, tabla = tabla)
      next
    }
    flag <- .derive_flag_name(aux_id)
    vec <- (datos_aux[[tabla]] %||% list())[[flag]]
    n_na <- if (is.null(vec)) NA_integer_ else sum(is.na(vec))
    out[[r$id]] <- list(n_base = as.integer(fila$n_inconsistencias[1]),
                        n_base_indeterminada = as.integer(n_na),
                        tipo = cond$tipo, tabla = tabla)
  }
  out
}
