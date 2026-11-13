# =============================================================================
# Validación: el salto de una sección (ítem 42 del checklist de Validación
# usada por un practicante)
# =============================================================================
# Cuando una sección del formulario (un begin_group o begin_repeat con
# `relevant`) no debía abrirse y la encuesta igual trae respuestas en ella, el
# motor marcaba cada pregunta de la sección por separado: en un estudio con la
# condición de consentimiento en 23 secciones, 5 encuestas sin consentimiento
# salían en 182 reglas con 918 marcas. Ahora la sección es una sola regla:
#
#   Regla de sección (una por grupo con condición)
#     marca la encuesta (o el registro del grupo repetido) cuando la condición
#     de sus grupos padres se cumple, la suya no y alguna de sus preguntas
#     tiene respuesta. Grano: fila de la tabla de la sección; la cuenta sigue
#     siendo por encuesta (una marca por sección y encuesta).
#
#   Pregunta dentro de una sección con condición ("cubierta")
#     su salto "no debe responderse" ya no repite la condición de la sección:
#     solo se emite si la pregunta tiene `relevant` propio, y marca cuando la
#     sección está abierta y la condición propia no se cumple. Así un mismo
#     vacío o una misma respuesta se marcan una vez: o por la sección, o por la
#     pregunta.
#
# Una pregunta es "cubierta" si alguno de sus grupos tiene condición y todos
# esos grupos viven en su misma tabla. Una pregunta de un grupo repetido cuyo
# grupo padre (en la tabla principal) tiene condición sigue con la regla por
# pregunta de siempre: la regla de sección no cruza tablas.
#
# El salto "debe responderse" de una pregunta obligatoria repetía la regla de
# obligatoria con la misma condición (mismo vacío, dos marcas). Con las
# obligatorias incluidas en el plan, ese salto ya no se emite
# (`.vss_emite_debe()`).

.VSS_TIPOS_SIN_RESPUESTA <- c("note", "calculate", "start", "end", "today", "deviceid",
                              "subscriberid", "phonenumber", "simserial", "username", "audit",
                              "begin_group", "end_group", "begin_repeat", "end_repeat", "hidden")

# Tabla de cada nivel de grupos de una fila: el grupo repetido más interno que
# lo contiene (él incluido) o "principal".
.vss_tablas_por_nivel <- function(row) {
  kinds <- as.character(unlist(row$group_kinds %||% character(0)))
  path <- as.character(row$group_path %||% character(0))
  if (!length(path)) return(character(0))
  out <- character(length(path)); actual <- "principal"
  for (k in seq_along(path)) {
    if (identical(kinds[k], "repeat")) actual <- path[k]
    out[k] <- actual
  }
  out
}

.vss_tabla_de_fila <- function(row) {
  if (is.null(row$repeat_context)) "principal" else as.character(row$repeat_context)
}

# Niveles con condición de una fila del mapa de grupos (`build_group_gate_map`).
.vss_niveles_con_condicion <- function(row) {
  gates <- row$group_gates %||% list()
  which(vapply(gates, function(g) !is.null(g), logical(1)))
}

#' Si la pregunta de una fila queda cubierta por la regla de su sección
#'
#' @param row entrada de `build_group_gate_map()`.
#' @return TRUE si algún grupo de la fila tiene condición y todos esos grupos
#'   viven en la tabla de la pregunta.
#' @keywords internal
.vss_fila_cubierta <- function(row) {
  niveles <- .vss_niveles_con_condicion(row)
  if (!length(niveles)) return(FALSE)
  all(.vss_tablas_por_nivel(row)[niveles] == .vss_tabla_de_fila(row))
}

# Condición de los grupos de una fila en los niveles dados, como un "y".
.vss_y <- function(asts) {
  asts <- Filter(Negate(is.null), asts)
  if (!length(asts)) return(NULL)
  if (length(asts) == 1L) return(asts[[1]])
  ast_normalize(do.call(ast_and, asts))
}

#' Si el salto "debe responderse" de una pregunta se emite
#'
#' Con las obligatorias en el plan, una pregunta obligatoria ya tiene su regla
#' de obligatoria con la misma condición (la de sus grupos y la suya): el salto
#' "debe" marcaría el mismo vacío otra vez.
#'
#' @keywords internal
.vss_emite_debe <- function(tiene_relevant_propio, obligatoria, con_obligatorias) {
  if (isTRUE(obligatoria) && isTRUE(con_obligatorias)) return(FALSE)
  isTRUE(tiene_relevant_propio) || isTRUE(obligatoria)
}

#' Regla "no debe responderse" de una pregunta cubierta por su sección
#'
#' Marca cuando la sección está abierta (`previa`, la condición de todos sus
#' grupos), la condición propia de la pregunta no se cumple y la pregunta tiene
#' respuesta. Mismos papeles que `rule_skip()`.
#'
#' @keywords internal
.vss_regla_nodebe_en_seccion <- function(var, propia, previa, nombre, seccion, tabla, repeat_context) {
  presente <- ast_not(ast_is_missing(var))
  partes <- Filter(Negate(is.null), list(previa, ast_not(propia), presente))
  r <- make_rule(nombre = nombre, tipo_regla = "skip", fuente = "instrumento",
                 predicate = do.call(ast_and, partes), gate = NULL, severidad = "error",
                 seccion = seccion, tabla = tabla, repeat_context = repeat_context)
  cond_vars <- unique(c(if (!is.null(previa)) ast_variables(previa), ast_variables(propia)))
  r <- .rule_apply_metadata(r, primary_var = var,
                            variable_roles = list(target = var, drivers = cond_vars, compare = character(0), gate = cond_vars),
                            presentation = list(subtipo_semantico = "nodebe"))
  # La parte de la condición que es "la sección está abierta", por su huella:
  # la frase y el enunciado nombran solo la condición propia de la pregunta
  # (`.vss_condicion_propia()`); la base de la regla la sigue contando entera.
  r$salto_en_seccion <- list(previa = as.list(.vss_huellas_y(previa)))
  r
}

# Huellas de los términos de un "y" ya normalizado (uno solo si no es un "y").
.vss_huellas_y <- function(x) {
  if (is.null(x)) return(character(0))
  x <- ast_normalize(x)
  args <- if (identical(ast_op(x), "and")) x$args else list(x)
  vapply(args, ast_hash, character(1))
}

#' La condición propia de una pregunta cubierta por su sección
#'
#' Quita de la condición de su salto los términos que dicen que la sección está
#' abierta. Sin esa marca, la condición tal cual.
#' @keywords internal
.vss_condicion_propia <- function(rule, cond) {
  previa <- as.character(unlist((rule$salto_en_seccion %||% list())$previa %||% character(0)))
  if (!length(previa) || !is_ast(cond) || !identical(ast_op(cond), "and")) return(cond)
  quedan <- Filter(function(a) !(ast_hash(a) %in% previa), cond$args)
  if (!length(quedan) || length(quedan) == length(cond$args)) return(cond)
  if (length(quedan) == 1L) quedan[[1]] else ast_normalize(ast_and(quedan))
}

# Grupos con condición del formulario y las preguntas que cubre cada uno, en
# el orden del formulario. Cada grupo lleva su condición (`condicion`), la de
# sus grupos padres (`previa`), su tabla y sus preguntas.
.vss_secciones <- function(survey, ctx_map) {
  secciones <- list()
  for (row in ctx_map) {
    i <- row$row_index
    if (.type_base(survey$type[i]) %in% .VSS_TIPOS_SIN_RESPUESTA) next
    if (!.vss_fila_cubierta(row)) next
    tabla_fila <- .vss_tabla_de_fila(row)
    tablas <- .vss_tablas_por_nivel(row)
    gates <- row$group_gates
    for (k in .vss_niveles_con_condicion(row)) {
      g <- as.character(row$group_path[k])
      if (is.null(secciones[[g]])) {
        secciones[[g]] <- list(grupo = g, condicion = gates[[k]],
                               previa = .vss_y(gates[seq_len(k - 1L)]),
                               tabla = tablas[k], repeat_context = if (identical(tablas[k], "principal")) NULL else tablas[k],
                               variables = character(0))
      }
      if (identical(tablas[k], tabla_fila)) {
        secciones[[g]]$variables <- c(secciones[[g]]$variables, as.character(row$name))
      }
    }
  }
  Filter(function(s) length(s$variables) > 0L, secciones)
}

#' Reglas de salto por sección
#'
#' Una regla por grupo con condición: "alguna pregunta de la sección tiene
#' respuesta cuando la sección no correspondía".
#'
#' @param survey hoja survey del instrumento.
#' @param ctx_map entradas de `build_group_gate_map()`.
#' @param choices_map opciones por pregunta (`.survey_choices_map()`).
#' @param collector colector de reglas no compilables.
#' @return lista de reglas (`vd_rule`) con `salto_seccion = list(grupo,
#'   variables)`.
#' @keywords internal
.vss_infer_secciones <- function(survey, ctx_map, choices_map = NULL, collector = NULL) {
  label_map <- .survey_label_map(survey)
  reglas <- list()
  for (s in .vss_secciones(survey, ctx_map)) {
    fila <- list(name = s$grupo, row_index = match(s$grupo, as.character(survey$name)))
    r <- .infer_emit(collector, "relevant", fila, survey, function() {
      presentes <- lapply(s$variables, function(v) ast_not(ast_is_missing(v)))
      alguna <- if (length(presentes) == 1L) presentes[[1]] else do.call(ast_or, presentes)
      cond_falsa <- .vss_y(list(s$previa, ast_not(s$condicion)))
      etiqueta <- .lookup_label(label_map, s$grupo) %||% s$grupo
      nombre <- sprintf("[%s] Sección \"%s\": respondida cuando no le correspondía", s$grupo, etiqueta)
      rr <- make_rule(nombre = nombre, tipo_regla = "skip", fuente = "instrumento",
                      predicate = ast_and(cond_falsa, alguna), gate = NULL, severidad = "error",
                      seccion = s$grupo, tabla = s$tabla, repeat_context = s$repeat_context)
      cond_h <- .ast_to_human_text(cond_falsa, label_map = label_map, choices_map = choices_map)
      rr <- .enrich_ast_rule_from_survey(
        rr, survey = survey, target_var = s$grupo, compare_vars = s$variables,
        gate_ast = cond_falsa, nombre_humano = nombre,
        objetivo = if (nzchar(cond_h)) sprintf("Si %s, la sección \"%s\" queda vacía.", cond_h, etiqueta)
                   else sprintf("La sección \"%s\" queda vacía cuando no le corresponde.", etiqueta),
        subtipo_semantico = "nodebe", detalle_ast = cond_falsa, choices_map = choices_map)
      rr$salto_seccion <- list(grupo = s$grupo, variables = as.list(s$variables))
      rr
    })
    if (!is.null(r)) reglas[[length(reglas) + 1L]] <- r
  }
  reglas
}

# --- Lectura de una regla de sección -------------------------------------------

#' Si una regla es el salto de una sección
#' @keywords internal
.vss_es_seccion <- function(rule) {
  is.list(rule) && is.list(rule$salto_seccion) && length(.vss_variables(rule)) > 0L
}

.vss_variables <- function(rule) {
  v <- as.character(unlist((rule$salto_seccion %||% list())$variables %||% character(0), use.names = FALSE))
  v[!is.na(v) & nzchar(v)]
}

.vss_grupo <- function(rule) {
  as.character((rule$salto_seccion %||% list())$grupo %||% NA_character_)[1]
}

# La parte del predicado que mira las respuestas de la sección: un "o" de
# "tiene respuesta" sobre sus preguntas (o uno solo, si la sección tiene una).
.vss_es_parte_respuestas <- function(a, vars) {
  presente <- function(x) is_ast(x) && identical(ast_op(x), "not") && is_ast(x$arg) &&
    identical(ast_op(x$arg), "is_missing") && as.character(x$arg$var) %in% vars
  if (presente(a)) return(TRUE)
  is_ast(a) && identical(ast_op(a), "or") && length(a$args) > 0L &&
    all(vapply(a$args, presente, logical(1)))
}

#' Condición de una regla de sección: cuándo la sección no correspondía
#'
#' El predicado sin la parte que mira las respuestas. NULL si no se reconoce.
#' @keywords internal
.vss_condicion <- function(rule) {
  pred <- rule$predicate
  if (!.vss_es_seccion(rule) || !is_ast(pred) || !identical(ast_op(pred), "and")) return(NULL)
  vars <- .vss_variables(rule)
  args <- pred$args %||% list()
  quitar <- vapply(args, .vss_es_parte_respuestas, logical(1), vars = vars)
  if (sum(quitar) != 1L || all(quitar)) return(NULL)
  resto <- args[!quitar]
  if (length(resto) == 1L) return(resto[[1]])
  ast_normalize(ast_and(resto))
}

#' Ajustar una regla de sección a las columnas de la base
#'
#' Una pregunta de la sección que la base no trae no deja la regla entera sin
#' evaluar: se quita del "alguna tiene respuesta" y se dice cuáles faltaron.
#' Si no queda ninguna, la regla sigue su camino (no aplica, con su causa).
#'
#' @return list(rule, faltan) o NULL si no hay nada que ajustar.
#' @keywords internal
.vss_ajustar_a_columnas <- function(rule, data_names) {
  if (!.vss_es_seccion(rule)) return(NULL)
  vars <- .vss_variables(rule)
  faltan <- setdiff(vars, data_names)
  quedan <- intersect(vars, data_names)
  cond <- .vss_condicion(rule)
  if (!length(faltan) || !length(quedan) || is.null(cond) ||
      length(setdiff(ast_variables(cond), data_names))) return(NULL)
  presentes <- lapply(quedan, function(v) ast_not(ast_is_missing(v)))
  alguna <- if (length(presentes) == 1L) presentes[[1]] else do.call(ast_or, presentes)
  rule$predicate <- ast_normalize(ast_and(cond, alguna))
  rule$variables <- setdiff(rule$variables %||% character(0), faltan)
  roles <- rule$variable_roles %||% list()
  for (k in c("compare", "drivers", "all")) roles[[k]] <- setdiff(as.character(unlist(roles[[k]])), faltan)
  rule$variable_roles <- roles
  rule$salto_seccion$variables <- as.list(quedan)
  list(rule = rule, faltan = faltan)
}

# --- Enunciado de un caso --------------------------------------------------------

#' Enunciado del caso marcado por una regla de sección
#'
#' "respondió 18 de las 20 preguntas de la sección "Familia"", "que no
#' correspondía porque declaró "No" (2) en Consentimiento". Si la pregunta que
#' decide la condición está vacía, lo dice ("porque dejó vacía Consentimiento").
#'
#' @param seccion list(grupo, etiqueta, variables).
#' @param valores valores del caso por pregunta.
#' @param regla contexto de la regla (`condicion`, `etiquetas`, `especiales`).
#' @param etiquetas_valor opciones por pregunta.
#' @return list(hecho, choque, respondidas).
#' @keywords internal
.vss_enunciado <- function(seccion, valores, regla, etiquetas_valor = list()) {
  vars <- as.character(unlist(seccion$variables %||% character(0)))
  respondidas <- vars[!vapply(vars, function(v) .enun_vacio(valores[[v]]), logical(1))]
  etiqueta <- as.character(seccion$etiqueta %||% seccion$grupo %||% "")[1]
  n <- length(respondidas); k <- length(vars)
  hecho <- if (n == k) {
    if (k == 1L) sprintf("respondió la pregunta de la sección \"%s\"", etiqueta)
    else sprintf("respondió las %d preguntas de la sección \"%s\"", k, etiqueta)
  } else {
    sprintf("respondió %d de las %d preguntas de la sección \"%s\"", n, k, etiqueta)
  }
  cond <- regla$condicion
  decide <- .enun_factor_que_decide(cond, valores)
  cond_vars <- if (is_ast(cond)) ast_variables(cond) else character(0)
  vacia <- cond_vars[vapply(cond_vars, function(v) .enun_vacio(valores[[v]]), logical(1))]
  choque <- if (!is.na(decide) && !.enun_vacio(valores[[decide]])) {
    sprintf("que no correspondía porque declaró %s en %s",
            .enun_valor(valores[[decide]], etiquetas_valor[[decide]], regla$especiales),
            .enun_rotulo(decide, regla))
  } else if (length(vacia)) {
    sprintf("que no correspondía porque dejó vacía %s", .enun_rotulo(vacia[1], regla))
  } else "que no correspondía"
  list(hecho = hecho, choque = choque, respondidas = as.list(respondidas))
}
