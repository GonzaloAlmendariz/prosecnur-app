# =============================================================================
# codificacion_orden_catalogo.R — una recodificación ordinal sale en su orden
# =============================================================================
#
# `.add_recoded_q()` arma el catálogo de una lista `*_recod` y sólo lo ordenaba
# cuando el analista pedía `choices_order = "alphabetical"`. Con el default
# —`original_first`— el orden era el de aparición, o sea el orden en que los
# códigos asoman EN LOS DATOS, que es arbitrario.
#
# Medido en «Conta 11-08»: el instrumento original de docentes ni siquiera
# contiene `lst_p4_recod` —esa lista la crea la adaptación— y salía declarada
# como 3, 1, 2, 4. En el mazo eso se veía como «De 30 a 35 · De 22 a 25 · De 26
# a 29 · De 36 años a más»: un rango de edad sin orden. El analista había
# declarado su codificación en orden; nadie la reordenaba después.
#
# La regla: **si los códigos son numéricos, el catálogo sale por su valor.** Es
# lo que significa una recodificación ordinal — el código 1 es «menos» que el 2
# porque alguien lo decidió así al codificar. Los catálogos con códigos no
# numéricos conservan su orden de aparición, porque ahí el número no ordena
# nada y reordenar sería inventar un criterio.
#
# Los valores especiales (80–100) siguen yendo al final: eso ya lo resolvía el
# bloque siguiente de `.add_recoded_q()` y no se toca.

#' Orden en el que debe salir un catálogo recodificado.
#'
#' @param codes Códigos del catálogo, en el orden en que se crearon.
#' @param modo `"alphabetical"` fuerza el orden textual pedido por el analista;
#'   cualquier otro valor deja actuar la regla numérica.
#' @return Vector de índices con el orden a aplicar. Devuelve el orden original
#'   cuando no hay criterio que aplicar, de modo que el llamador puede usarlo
#'   siempre sin condicionar.
#' @keywords internal
.codificacion_orden_catalogo <- function(codes, modo = "original_first") {
  n <- length(codes)
  if (!n) return(integer(0))
  idx <- seq_len(n)

  # El analista pidió alfabético: manda su decisión.
  if (identical(modo, "alphabetical")) return(order(codes))

  num <- suppressWarnings(as.numeric(codes))
  # Con un solo código no hay nada que ordenar, y con códigos no numéricos el
  # número no ordena: se conserva el orden de aparición.
  if (n < 2L || anyNA(num)) return(idx)

  order(num)
}
