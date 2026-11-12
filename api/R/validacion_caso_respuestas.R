# =============================================================================
# Validación (M4, cambio 7): cada respuesta del caso completo dice qué es
# =============================================================================
# GET /caso publicaba cada pregunta con su valor, sin distinguir:
#   - un valor calculado o un metadato (`start`, `end`) de una respuesta: un
#     cálculo no lo respondió nadie;
#   - una pregunta vacía porque no le correspondía (su condición del
#     formulario es falsa en el caso) de una que no se respondió;
#   - un código especial declarado por el estudio (99 "No responde") de un
#     valor ("99 años");
#   - un código que no está entre las opciones de la pregunta.
#
# Por respuesta se agregan:
#   origen             "respuesta", "calculada" o "metadato" (tipo del formulario).
#   estado             "respondida"; "vacia_por_salto" (la condición de la
#                      pregunta, la de sus grupos y su `relevant`, es falsa en
#                      el caso); "vacia" (sin condición, o condición verdadera);
#                      "relevancia_indeterminada" (la condición no se pudo
#                      evaluar en el caso, o el formulario la escribe con algo
#                      que el motor no lee).
#   especial           TRUE si el valor es un código especial declarado por el
#                      estudio (`validacion_codigos_especiales_declarados()`),
#                      con `especial_etiqueta`. Sin códigos declarados, FALSE.
#   fuera_de_opciones  en preguntas de opciones, TRUE si algún código no está
#                      entre ellas; null en las demás.
# La condición se evalúa con el mismo motor de la auditoría (una regla
# auxiliar por pregunta vacía con condición, sobre la fila del caso y con las
# opciones del formulario de la auditoría).

.VCRP_TIPOS_OPCIONES <- c("select_one", "select_multiple", "select_one_from_file",
                          "select_multiple_from_file", "rank")

# Condición bajo la que el formulario muestra cada pregunta: la de sus grupos y
# su `relevant` propio. `legible = FALSE` si una parte no se pudo leer.
.vcrp_condiciones <- function(survey) {
  if (!is.data.frame(survey) || !nrow(survey)) return(list())
  mapa <- tryCatch(build_group_gate_map(survey), error = function(e) NULL)
  if (is.null(mapa)) return(NULL)
  out <- list()
  for (e in mapa) {
    v <- as.character(e$name %||% "")
    if (!nzchar(v)) next
    g <- e$gate
    legible <- is.null(g) || !.ast_contains_raw(g)
    i <- e$row_index
    rel <- if ("relevant" %in% names(survey) && !is.null(i)) as.character(survey$relevant[i]) else ""
    if (length(rel) && !is.na(rel) && nzchar(trimws(rel))) {
      parsed <- tryCatch(odk_parse_to_ast(rel, context = "relevant"), error = function(e) NULL)
      if (is.null(parsed) || isTRUE(parsed$degraded_to_raw) || .ast_contains_raw(parsed$ast)) {
        legible <- FALSE
      } else {
        g <- if (is.null(g)) parsed$ast else ast_normalize(ast_and(g, parsed$ast))
      }
    }
    out[[v]] <- list(ast = g, legible = legible)
  }
  out
}

# Evalúa la condición de cada variable en la fila `fila` (data.frame de una
# fila) con el motor de la auditoría. Devuelve TRUE, FALSE o NA por variable.
.vcrp_evaluar_condiciones <- function(conds, fila, choices_map = list()) {
  if (!length(conds)) return(logical(0))
  ids <- sprintf("VCRP_%04d", seq_along(conds))
  reglas <- lapply(seq_along(conds), function(k) {
    tryCatch(make_rule(nombre = "condición de la pregunta", tipo_regla = "coherence", fuente = "custom",
                       predicate = conds[[k]], id = ids[k]), error = function(e) NULL)
  })
  ok <- !vapply(reglas, is.null, logical(1))
  out <- stats::setNames(rep(NA, length(conds)), names(conds))
  if (!any(ok)) return(out)
  flags <- vapply(reglas[ok], function(r) as.character(r$flag_name %||% ""), character(1))
  reglas <- reglas[ok]
  bundle <- list(rules = reglas,
                 plan = data.frame(ID = ids[ok], Tabla = "principal", stringsAsFactors = FALSE),
                 choices_map = choices_map %||% list())
  ev <- tryCatch(evaluate_validation_bundle(bundle, list(principal = fila, tables = list(principal = fila)),
                                            strict = FALSE),
                 error = function(e) NULL)
  if (is.null(ev)) return(out)
  res <- ev$resumen
  for (j in seq_along(which(ok))) {
    k <- which(ok)[j]
    r <- res[as.character(res$id_regla) == ids[k], , drop = FALSE]
    if (!nrow(r) || !identical(as.character(r$estado_dinamico[1]), "correcta")) next
    flag <- (ev$datos %||% list())[[flags[j]]]
    if (length(flag)) out[[k]] <- as.logical(flag[1])
  }
  out
}

#' Estado, origen, código especial y opciones de las respuestas de un caso
#'
#' @param secciones `secciones` de `validacion_caso_completo()`.
#' @param inst instrumento.
#' @param df tabla de la auditoría.
#' @param i fila del caso en `df`.
#' @param choices_map opciones de la auditoría (`evaluacion$bundle$choices_map`).
#' @param especiales código a rótulo de los códigos especiales declarados.
#' @return `secciones` con los campos nuevos por variable y, por sección,
#'   `n_preguntas`, `n_respondidas` y `n_vacias_por_salto` (solo respuestas).
#' @keywords internal
validacion_caso_respuestas_estado <- function(secciones, inst, df, i, choices_map = list(),
                                              especiales = character(0)) {
  if (!length(secciones)) return(secciones)
  sv <- inst$survey
  tipos <- stats::setNames(tolower(as.character(sv$type_base %||% sv$type)), as.character(sv$name))
  opc <- tryCatch(.survey_choices_map(sv, inst$choices), error = function(e) list())
  vacias <- unlist(lapply(secciones, function(s) {
    vapply(s$variables, function(v) if (is.na(v$valor)) v$variable else NA_character_, character(1))
  }))
  vacias <- vacias[!is.na(vacias)]
  conds_todas <- .vcrp_condiciones(sv)
  con_cond <- Filter(function(v) !is.null(conds_todas[[v]]$ast) && isTRUE(conds_todas[[v]]$legible), vacias)
  eval_cond <- if (length(con_cond)) {
    .vcrp_evaluar_condiciones(stats::setNames(lapply(con_cond, function(v) conds_todas[[v]]$ast), con_cond),
                              df[i, , drop = FALSE], choices_map)
  } else logical(0)
  estado_de <- function(var, valor) {
    if (!is.na(valor)) return("respondida")
    if (is.null(conds_todas)) return("relevancia_indeterminada")
    cnd <- conds_todas[[var]]
    if (is.null(cnd) || (is.null(cnd$ast) && isTRUE(cnd$legible))) return("vacia")
    if (!isTRUE(cnd$legible)) return("relevancia_indeterminada")
    r <- eval_cond[var]
    if (is.na(r)) "relevancia_indeterminada" else if (isTRUE(r)) "vacia" else "vacia_por_salto"
  }
  es_especial <- function(cod) !is.na(cod) && cod %in% names(especiales)
  lapply(secciones, function(s) {
    s$variables <- lapply(s$variables, function(v) {
      tipo <- unname(tipos[v$variable])
      if (is.na(tipo)) tipo <- tolower(as.character(v$tipo %||% ""))
      v$origen <- validacion_origen_pregunta(tipo)
      v$estado <- estado_de(v$variable, v$valor)
      v$especial <- FALSE
      v$especial_etiqueta <- NA_character_
      v$fuera_de_opciones <- NA
      if (!is.na(v$valor)) {
        # Sin opciones leídas para la pregunta no se sabe: queda null.
        if (tipo %in% .VCRP_TIPOS_OPCIONES && !is.null(opc[[v$variable]])) {
          if (!is.null(v$opciones)) {
            v$opciones <- lapply(v$opciones, function(o) {
              o$fuera_de_opciones <- is.na(o$etiqueta)
              o$especial <- es_especial(o$codigo)
              o
            })
            v$fuera_de_opciones <- any(vapply(v$opciones, function(o) isTRUE(o$fuera_de_opciones), logical(1)))
          } else {
            v$fuera_de_opciones <- is.na(v$valor_etiqueta)
          }
        }
        if (es_especial(v$valor)) {
          v$especial <- TRUE
          rot <- as.character(v$valor_etiqueta %||% NA_character_)[1]
          if (is.na(rot) || !nzchar(rot)) rot <- as.character(especiales[[v$valor]] %||% NA_character_)[1]
          v$especial_etiqueta <- if (is.na(rot) || !nzchar(rot)) NA_character_ else rot
        }
      }
      v
    })
    resp <- Filter(function(v) identical(v$origen, "respuesta"), s$variables)
    s$n_preguntas <- length(resp)
    s$n_respondidas <- sum(vapply(resp, function(v) identical(v$estado, "respondida"), logical(1)))
    s$n_vacias_por_salto <- sum(vapply(resp, function(v) identical(v$estado, "vacia_por_salto"), logical(1)))
    s
  })
}
