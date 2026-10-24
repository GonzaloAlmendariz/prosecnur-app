# reporte_plan_base_cruce.R — el pie «Base:» de un cruce cuenta los casos que entran en sus barras.
#
# CCSS Perfil 2026 (CCSS-16, revisión metodológica): los % de un cruce se calculan sobre los casos válidos en la variable Y en
# el cruce, cada grupo con su n, pero `.base_auto_from_element_impl` (reporte_plan_ppt.R, rama genérica) contaba sólo los
# válidos de la variable. Con NA en el cruce el pie afirmaba un denominador que no entra en ninguna barra (397 donde las
# barras suman 376). Aquí se agrega a los filtros de la base la condición «cruce con valor», la misma máscara del renderer
# (valor no NA y no vacío), y así `.base_auto_from_refs` cuenta lo mismo que dibujan las barras.

#' Filtros de la base de un elemento, con el cruce exigido cuando lo hay
#'
#' @param el Elemento del plan (`el$cruces` o `el$cruce`).
#' @param filtros Filtros del elemento.
#' @param resolver_ref `.resolve_ref` del motor (resuelve la columna y su fuente).
#' @param filtrar `.filter_data` del motor (aplica `filtros` en la fuente).
#' @param ref_var Referencia de la variable, para resolver la fuente del cruce.
#' @return `filtros` en formato de reglas (`variable`, `op`, `value`) con una regla `in` por cruce, o `filtros` intacto.
#' @keywords internal
.base_filtros_con_cruce <- function(el, filtros, resolver_ref, filtrar, ref_var = NULL) {
  cruces <- unlist(c(el$cruces %||% NULL, el$cruce %||% NULL), use.names = FALSE)
  cruces <- as.character(cruces); cruces <- cruces[!is.na(cruces) & nzchar(trimws(cruces))]
  if (!length(cruces)) return(filtros)
  fuente <- tryCatch(resolver_ref(ref_var, arg_name = "var")$source, error = function(e) NULL)
  df <- tryCatch(filtrar(filtros %||% list(), source = fuente), error = function(e) NULL)
  if (is.null(df) || !nrow(df)) return(filtros)
  reglas <- .base_filtros_como_reglas(filtros)
  if (is.null(reglas)) return(filtros)   # formato que no se sabe extender: el pie queda como antes
  for (cr in unique(cruces)) {
    col <- tryCatch(resolver_ref(cr, source = fuente, arg_name = "cruce")$var, error = function(e) NULL)
    if (is.null(col) || !(col %in% names(df))) next
    v <- as.character(df[[col]]); v <- unique(trimws(v[!is.na(v)])); v <- v[nzchar(v)]
    if (!length(v) || any(grepl(",", v, fixed = TRUE))) next   # la regla separa por comas: no se arriesga un valor que las lleve
    reglas[[length(reglas) + 1L]] <- list(variable = col, op = "in", value = paste(v, collapse = ","))
  }
  reglas
}

#' Filtros en formato de lista de reglas, o `NULL` si no se puede convertir sin cambiar su sentido
#' @keywords internal
.base_filtros_como_reglas <- function(filtros) {
  if (is.null(filtros) || !length(filtros)) return(list())
  if (is.data.frame(filtros) && all(c("variable", "op", "value") %in% names(filtros))) {
    return(lapply(seq_len(nrow(filtros)), function(i) as.list(filtros[i, c("variable", "op", "value"), drop = FALSE])))
  }
  if (is.list(filtros) && all(vapply(filtros, function(x) is.list(x) && any(c("variable", "op", "value") %in% names(x)), logical(1)))) {
    return(unname(filtros))
  }
  nm <- names(filtros)
  if (is.list(filtros) && !is.null(nm) && all(nzchar(trimws(nm))) && all(vapply(filtros, is.atomic, logical(1)))) {
    return(lapply(nm, function(k) list(variable = k, op = "in", value = paste(as.character(filtros[[k]]), collapse = ","))))
  }
  NULL
}
