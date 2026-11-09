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

#' Base que nombra la ranura de una lámina con cruce, o `NULL` si no nombra ninguna (referencia pelada)
#'
#' @param slide Lámina del plan (`payload` con elementos `graficador`/`args`).
#' @param bases Nombres de las bases de la sesión.
#' @return Nombre de la base, o `NULL`.
#' @keywords internal
.sig_base_de_lamina <- function(slide, bases) {
  grafs <- Filter(function(z) is.list(z) && !is.null(z$graficador), slide$payload %||% list())
  for (g in grafs) {
    a <- g$args %||% list(); ov <- a$overrides %||% list()
    cruce <- a$cruces %||% a$cruce %||% ov$cruces %||% ov$cruce
    var <- a$var %||% a$vars
    if (is.na(.sig_var_local(cruce)) || is.na(.sig_var_local(var))) next
    candidatas <- c(as.character(unlist(a$source %||% a$fuente %||% character(0)))[1],
                    .resbase_de_ref(var)[1], .resbase_de_ref(cruce)[1])
    candidatas <- trimws(candidatas[!is.na(candidatas)])
    candidatas <- candidatas[nzchar(candidatas)]
    if (!length(candidatas)) return(NULL)
    if (!candidatas[1] %in% bases) {
      stop_api(409, "E_SIG_BASE_DESCONOCIDA",
               sprintf("La lámina lee la base «%s», que no está en el proyecto.", candidatas[1]))
    }
    return(candidatas[1])
  }
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
    base <- .sig_base_de_lamina(slide, sc$bases %||% sc$base)
    if (is.null(base) || identical(base, sc$base)) return(list(fuente = sc$fuente, ctx = sc$ctx, base = sc$base))
    if (is.null(memo[[base]])) memo[[base]] <<- .sig_contexto_sesion(sid, base = base)
    m <- memo[[base]]
    list(fuente = m$fuente, ctx = m$ctx, base = base)
  }
}
