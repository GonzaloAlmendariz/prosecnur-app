# =============================================================================
# Validación: la pregunta filtro de un salto con un código fuera de su lista
# (ítem 41 del checklist de Validación usada por un practicante)
# =============================================================================
# Un salto "p6_1 respondida cuando no le correspondía" con 48 casos eran falsos
# positivos: la base marca "Otro" de p6 con 77 y el formulario lo declara 4. La
# pantalla no lo dejaba ver. Aquí se cuenta, sobre TODOS los casos que la regla
# marca (no solo la página del detalle), cuántos traen en cada pregunta de la
# condición un valor que no está entre sus opciones, y se redacta el aviso.
#
# Grano: fila de la tabla de la regla (la encuesta en la tabla principal, el
# registro en un grupo repetido). Denominador: los casos que la regla marca en
# la última auditoría (`n_marcados`). Un código especial declarado por el
# estudio (90 a 99 u otros) no cuenta como fuera de lista: está declarado.
# El valor se compara por código y por rótulo, como lo hace el evaluador.

# Opción "Otro" de una lista: la que tiene un rótulo que empieza por "Otro",
# "Otra", "Otros" u "Other". NULL si no hay una sola.
.vsf_opcion_otro <- function(opciones) {
  if (!length(opciones)) return(NULL)
  rot <- as.character(unlist(opciones))
  es <- grepl("^\\s*(otr[oa]s?|other)\\b", rot, ignore.case = TRUE, perl = TRUE)
  if (sum(es) != 1L) return(NULL)
  list(codigo = names(opciones)[es], etiqueta = trimws(rot[es]))
}

.vsf_enumerar <- function(x, conector = " o ") {
  if (length(x) <= 1L) return(paste(x, collapse = ""))
  paste0(paste(x[-length(x)], collapse = ", "), conector, x[length(x)])
}

# "p6 vale 77 en los 48 casos, un código que no está en sus opciones; puede
# ser el de "Otro" (4 en el formulario): revisa el formulario antes de
# corregir respuestas."
.vsf_texto <- function(var, valores, n_casos, n_marcados, otro) {
  donde <- if (n_marcados == 1L) "en el caso marcado"
           else if (n_casos == n_marcados) sprintf("en los %d casos", n_marcados)
           else sprintf("en %d de los %d casos", n_casos, n_marcados)
  que <- if (length(valores) == 1L) "un código que no está en sus opciones" else "códigos que no están en sus opciones"
  pista <- if (!is.null(otro)) sprintf("; puede ser el de \"%s\" (%s en el formulario)", otro$etiqueta, otro$codigo) else ""
  sprintf("%s vale %s %s, %s%s: revisa el formulario antes de corregir respuestas.",
          var, .vsf_enumerar(valores), donde, que, pista)
}

#' Preguntas de la condición de un salto con valores fuera de su lista
#'
#' @param condicion árbol de la condición del salto (la del contexto de la
#'   regla, `.validacion_contexto_enunciado()$condicion`).
#' @param df tabla de la auditoría.
#' @param filas índices de los casos que la regla marca en `df` (todos).
#' @param opciones opciones por pregunta (`.survey_choices_map()`: código a
#'   rótulo).
#' @param especiales códigos especiales declarados por el estudio (código a
#'   rótulo).
#' @return lista, una entrada por pregunta con algún valor fuera de su lista:
#'   `variable`, `valores` (lista de `valor` y `n`, de más a menos casos),
#'   `n_casos` (casos marcados con algún valor fuera de lista en esa
#'   pregunta), `n_marcados` (casos que la regla marca), `otro` (código y
#'   rótulo de la opción "Otro" de la lista, o NULL) y `texto`. Vacía si no hay
#'   ninguna.
#' @keywords internal
validacion_filtro_fuera_de_lista <- function(condicion, df, filas, opciones, especiales = NULL) {
  if (!is_ast(condicion) || !is.data.frame(df) || !length(filas) || !length(opciones)) return(list())
  filas <- filas[!is.na(filas) & filas >= 1L & filas <= nrow(df)]
  n_marcados <- length(filas)
  if (!n_marcados) return(list())
  out <- list()
  for (v in unique(ast_variables(condicion))) {
    ops <- opciones[[v]]
    if (is.null(ops) || !length(ops) || !(v %in% names(df))) next
    admitidos <- c(names(ops), as.character(unlist(ops)), names(especiales %||% list()))
    crudos <- trimws(as.character(df[[v]][filas]))
    fuera <- lapply(crudos, function(x) {
      if (is.na(x) || !nzchar(x)) return(character(0))
      tok <- strsplit(x, "[[:space:]]+")[[1]]
      tok <- tok[nzchar(tok)]
      # Un valor entero que calza tal cual (un rótulo con espacios) no se parte.
      if (x %in% admitidos) return(character(0))
      setdiff(tok, admitidos)
    })
    n_fila <- lengths(fuera) > 0L
    if (!any(n_fila)) next
    conteo <- sort(table(unlist(fuera)), decreasing = TRUE)
    valores <- names(conteo)
    otro <- .vsf_opcion_otro(ops)
    if (!is.null(otro) && otro$codigo %in% valores) otro <- NULL
    out[[length(out) + 1L]] <- list(
      variable = v,
      valores = lapply(valores, function(x) list(valor = x, n = as.integer(conteo[[x]]))),
      n_casos = as.integer(sum(n_fila)),
      n_marcados = as.integer(n_marcados),
      otro = otro,
      texto = .vsf_texto(v, valores, sum(n_fila), n_marcados, otro)
    )
  }
  out
}
