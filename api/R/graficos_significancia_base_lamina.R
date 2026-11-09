# =============================================================================
# graficos_significancia_base_lamina.R — de qué base lee la prueba de una lámina (R12-2, ADR 0128 §5)
# =============================================================================
#
# `/api/graficos/diferencias` y su informe probaban toda lámina sobre la base ACTIVA. En una lámina multibase la
# ranura nombra su base en la referencia («estudiantes$p3»): con la base activa en docentes, «estudiantes$p3 × gedad»
# devolvía los grupos de docentes. La base se resuelve como el render (`.resolve_source_name` en reporte_plan_ppt.R) y
# las láminas de resumen (`.resumen_base_lamina`): la fuente explícita del elemento; si no, el prefijo de la
# referencia (`.resbase_de_ref`); si no, la base activa, que es lo que significa una referencia pelada.
#
# La regla del estudio no cambia (ADR 0128): es la misma, y sobre la base de la ranura se arman su fuente y su familia.

#' Base que lee una ranura (un graficador del payload) con cruce, o `NULL` si no nombra ninguna (referencia pelada)
#'
#' La ranura aporta la fuente explícita y los prefijos de `var` y `cruce`; una referencia pelada es de la fuente
#' explícita y, si no hay y se da `activa`, de la base activa. Si la ranura nombra dos bases (la pregunta de una y el
#' cruce de otra) es ambigua: no entra en ninguna familia (ADR 0128 «Familia por base»). Una lámina con ranuras de
#' bases distintas no es ambigua: cada ranura va a la familia de la suya.
#'
#' @param g Graficador del payload (`graficador`/`args`). @param bases Nombres de las bases de la sesión.
#' @param activa Base de las referencias peladas, o `NULL`.
#' @return Nombre de la base, o `NULL`.
#' @keywords internal
.sig_base_de_slot <- function(g, bases, activa = NULL) {
  if (is.null(.sig_slot_de_graficador(g))) return(NULL)
  a <- g$args %||% list(); ov <- a$overrides %||% list()
  cruce <- a$cruces %||% a$cruce %||% ov$cruces %||% ov$cruce
  var <- a$var %||% a$vars
  explicita <- trimws(as.character(unlist(a$source %||% a$fuente %||% character(0)))[1])
  explicita <- if (length(explicita) && !is.na(explicita) && nzchar(explicita)) explicita else NULL
  refs <- c(as.character(unlist(var))[1], as.character(unlist(cruce))[1])
  pelada <- !grepl("$", refs, fixed = TRUE)
  vistas <- c(explicita, .resbase_de_ref(refs[!pelada]), if (any(pelada)) explicita %||% activa)
  vistas <- unique(vistas[!is.na(vistas) & nzchar(vistas)])
  if (!length(vistas)) return(NULL)
  ajena <- setdiff(vistas, bases)
  if (length(ajena)) {
    stop_api(409, "E_SIG_BASE_DESCONOCIDA",
             sprintf("La lámina lee la base «%s», que no está en el proyecto.", ajena[1]))
  }
  if (length(vistas) > 1L) {
    stop_api(409, "E_SIG_BASE_AMBIGUA",
             sprintf("Un gráfico de la lámina mezcla las bases %s: no se prueba ni entra en la familia de ninguna.",
                     paste0("«", vistas, "»", collapse = " y ")))
  }
  vistas
}

#' Base de la lámina para el inspector: la de su primera ranura con cruce (la que prueba `.sig_lamina_json`)
#' @keywords internal
.sig_base_de_lamina <- function(slide, bases, activa = NULL) {
  for (g in slide$payload %||% list()) if (!is.null(.sig_slot_de_graficador(g))) return(.sig_base_de_slot(g, bases, activa))
  NULL
}

#' Contexto de prueba por lámina: el de la sesión si la ranura lee la base activa; si no, el de la base de la ranura
#'
#' @param sid Sesión. @param sc Contexto de `.sig_contexto_sesion(sid)` (base activa).
#' @return Función `slide -> list(fuente, ctx, base)`; memoriza el contexto de cada base dentro del pedido.
#' @keywords internal
.sig_contexto_por_lamina <- function(sid, sc) {
  memo <- list()
  function(slide) {
    base <- .sig_base_de_lamina(slide, sc$bases %||% sc$base, sc$activa)
    if (is.null(base) || identical(base, sc$base)) return(list(fuente = sc$fuente, ctx = sc$ctx, base = sc$base))
    if (is.null(memo[[base]])) memo[[base]] <<- .sig_contexto_sesion(sid, base = base)
    m <- memo[[base]]
    list(fuente = m$fuente, ctx = m$ctx, base = base)
  }
}
