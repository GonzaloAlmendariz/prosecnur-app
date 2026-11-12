# =============================================================================
# Reglas sugeridas desde el formulario (ítem 28 del checklist del practicante)
# =============================================================================
# El plan del formulario ya convierte en reglas lo que el XLSForm declara con
# `required` (obligatorias), `relevant` (saltos, en los dos sentidos: respuesta
# donde no correspondía y vacía donde correspondía) y `constraint`
# (restricciones, incluidos el largo y los patrones de texto). Proponer esas
# mismas reglas como propias duplicaría cada hallazgo en cuanto se lee el plan,
# así que aquí no se proponen.
#
# Lo que el formulario declara y el plan no revisa bien:
#
#   formulario_digitos  una restricción de rango que equivale a una cantidad
#                       de dígitos (de 100000 a 999999 son 6). El plan la lee
#                       como número y "080105" queda en 80105, fuera del rango.
#                       Se propone la regla de formato, que revisa el texto y
#                       conserva el cero, solo si la base trae respuestas que
#                       empiezan con 0: sin ellas, las dos reglas marcan lo
#                       mismo.
#   formulario_entero   una pregunta `integer` cuyo valor no es un número
#                       entero ("1.5", "NO SABE"). Ninguna regla del plan
#                       revisa el tipo. Se propone solo con evidencia en la base.
#
# La respuesta fuera de lista de las `select_one` ya la propone
# `reglas_semilla_dominio()`. En `select_multiple` no se propone: la base llega
# en columnas por opción y una opción que no está en la lista se queda fuera de
# la pregunta al cargar (Carga la muestra como columna auxiliar).
#
# Cada propuesta trae `semilla$n_casos_hoy`: los casos que la regla marcaría
# sobre la base cargada, medidos con la misma función que usa el motor
# (`.regla_formato_medir()`).
# =============================================================================

# "Ubigeo del distrito (ubigeo)", o solo el código si no hay rótulo. Sin
# comillas: el nombre ya se distingue por el código entre paréntesis.
.semilla_form_nombrar <- function(nombre, survey) {
  lab_col <- .semilla_label_col(survey)
  if (is.na(lab_col)) return(nombre)
  i <- which(!is.na(survey$name) & as.character(survey$name) == nombre)[1]
  if (is.na(i)) return(nombre)
  et <- trimws(as.character(survey[[lab_col]][i]))
  if (is.na(et) || !nzchar(et) || identical(et, nombre)) nombre else sprintf("%s (%s)", et, nombre)
}

# El primer nodo `range_numeric` sobre la propia pregunta dentro de un AST.
.semilla_form_rango <- function(ast, var) {
  if (!is.list(ast)) return(NULL)
  if (identical(attr(ast, "op"), "range_numeric") && identical(as.character(ast$var %||% ""), var)) return(ast)
  for (hijo in ast) {
    hallado <- .semilla_form_rango(hijo, var)
    if (!is.null(hallado)) return(hallado)
  }
  NULL
}

# Cantidad de dígitos que pide una restricción de rango (k si el rango va de
# 10^(k-1) a 10^k - 1, con k de 2 en adelante); NA si no equivale a dígitos.
.semilla_form_digitos <- function(constraint, var) {
  con <- trimws(as.character(constraint %||% ""))
  if (is.na(con) || !nzchar(con)) return(NA_integer_)
  parsed <- tryCatch(odk_parse_to_ast(con, context = "constraint", self_var = var), error = function(e) NULL)
  if (is.null(parsed) || isTRUE(parsed$degraded_to_raw)) return(NA_integer_)
  r <- .semilla_form_rango(parsed$ast, var)
  if (is.null(r) || !isTRUE(r$inclusive %||% TRUE)) return(NA_integer_)
  mn <- suppressWarnings(as.numeric(r$min)); mx <- suppressWarnings(as.numeric(r$max))
  if (!length(mn) || !length(mx) || is.na(mn) || is.na(mx) || mn < 10) return(NA_integer_)
  k <- nchar(sprintf("%.0f", mx))
  if (mn == 10^(k - 1) && mx == 10^k - 1) as.integer(k) else NA_integer_
}

.semilla_form_entero <- function(x) {
  v <- trimws(as.character(x))
  v <- v[!is.na(v) & nzchar(v) & v != "NA"]
  num <- suppressWarnings(as.numeric(v))
  # Un negativo entero lo propone `reglas_semilla_rango_numerico()`; aquí solo
  # decimales y texto.
  raros <- is.na(num) | (num != round(num))
  list(n = length(v), raros = v[raros])
}

#' Proponer reglas desde lo que declara el formulario
#'
#' @param data data.frame de la base cargada.
#' @param survey hoja `survey` del instrumento.
#' @param reglas_existentes lista de reglas propias ya definidas en el scope.
#' @return lista de candidatos con su bloque `semilla` (`origen`, `porque`,
#'   `n_casos_hoy` y lo propio de cada uno).
#' @family validacion
#' @export
reglas_semilla_formulario <- function(data, survey, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  if (!is.data.frame(survey) || !all(c("name", "type") %in% names(survey))) return(list())
  tipo <- sub("\\s.*$", "", trimws(as.character(survey$type)))
  out <- list()

  # Restricción de rango que equivale a k dígitos.
  if ("constraint" %in% names(survey)) {
    for (i in which(tipo %in% c("integer", "decimal", "text"))) {
      var <- as.character(survey$name[i])
      if (is.na(var) || !(var %in% names(data))) next
      if (.semilla_ya_cubierta(reglas_existentes, "formato", var)) next
      k <- .semilla_form_digitos(survey$constraint[i], var)
      if (is.na(k)) next
      med <- .regla_formato_medir(data[[var]], "digitos", k, k, character(0), "", FALSE)
      cero <- !is.na(med$texto) & grepl(sprintf("^0[0-9]{%d}$", k - 1L), med$texto)
      if (!any(cero)) next
      ejemplo <- med$texto[cero][1]
      var_txt <- .semilla_form_nombrar(var, survey)
      out[[length(out) + 1L]] <- list(
        tipo = "formato",
        variables = list(var),
        params = list(modo = "digitos", largo_min = k, largo_max = k),
        nombre = sprintf("%s con %d dígitos", var_txt, k),
        mensaje = sprintf("La respuesta no tiene %d dígitos.", k),
        severidad = "error",
        activa = TRUE,
        planned_action_type = "ignore_rule",
        origen = "sembrado",
        semilla = list(
          origen = "formulario_digitos",
          variable = var,
          digitos = k,
          n_casos_hoy = as.integer(sum(med$marca)),
          n_cero_inicial = as.integer(sum(cero)),
          porque = sprintf(
            paste("El formulario pide un número de %d dígitos. La restricción lo lee como número y",
                  "marca %d %s que empiezan con 0, como %s; esta regla lee la respuesta como texto",
                  "y conserva el cero."),
            k, sum(cero), if (sum(cero) == 1L) "respuesta" else "respuestas", ejemplo)
        )
      )
    }
  }

  # Pregunta declarada entera con decimales o texto.
  for (i in which(tipo == "integer")) {
    var <- as.character(survey$name[i])
    if (is.na(var) || !(var %in% names(data))) next
    if (.semilla_ya_cubierta(reglas_existentes, "formato", var)) next
    if (any(vapply(out, function(p) identical(unlist(p$variables), var), logical(1)))) next
    ev <- .semilla_form_entero(data[[var]])
    if (!length(ev$raros)) next
    med <- .regla_formato_medir(data[[var]], "digitos", NA_real_, NA_real_, character(0), "", FALSE)
    # La frase cuenta lo mismo que la regla marca ("12.00" también, aunque valga 12).
    n_raros <- as.integer(sum(med$marca))
    ejemplo <- med$texto[med$marca][1]
    out[[length(out) + 1L]] <- list(
      tipo = "formato",
      variables = list(var),
      params = list(modo = "digitos"),
      nombre = sprintf("Número entero en %s", .semilla_form_nombrar(var, survey)),
      mensaje = "La respuesta no es un número entero.",
      severidad = "error",
      activa = TRUE,
      planned_action_type = "ignore_rule",
      origen = "sembrado",
      semilla = list(
        origen = "formulario_entero",
        variable = var,
        n_casos_hoy = n_raros,
        porque = sprintf(
          "El formulario la declara como número entero y %d %s escritas solo con dígitos, como \"%s\".",
          n_raros, if (n_raros == 1L) "respuesta no está" else "respuestas no están", ejemplo)
      )
    )
  }
  out
}
