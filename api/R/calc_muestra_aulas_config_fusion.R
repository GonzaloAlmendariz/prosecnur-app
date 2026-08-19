# Fusion de la configuracion de marco con la vigente en sesion.
#
# POST /api/calc-muestra/marco/config recibia un body parcial y lo normalizaba
# A SECAS: toda clave ausente caia al default y PISABA lo que la sesion ya
# tenia. Medido el 2026-08-19 en el estudio HSVG2026: sellar el techo de
# visitas (un POST con solo `selector.techo_aulas_visitadas`) devolvio
# `n_aulas = 30` y `faculty_targets = 0` donde habia 190 y 15; y al reves, la
# cadena que mando el diseno completo sin techo lo borro. El ultimo en
# escribir destruia el trabajo del anterior, y el `.pulso` guardaba esa
# destruccion. Es la misma familia de la lista cerrada que se traga lo que no
# reconoce, en su variante temporal.
#
# Contrato: lo AUSENTE hereda de la vigente; un `null` explicito BORRA la
# clave (vuelve al default del normalizador). Las listas nombradas se fusionan
# recursivamente —mandar `faculty_targets = {DERECHO: 22}` ajusta una facultad
# y conserva las otras—; las listas posicionales (`strata_cols`) se reemplazan
# enteras: mezclarlas por posicion es la trampa conocida de `modifyList`.

#' Fusiona la config entrante sobre la vigente, clave a clave.
#'
#' @param vigente config ya en sesion (o NULL/lista vacia la primera vez).
#' @param entrante body del cliente, posiblemente parcial.
#' @return lista fusionada, lista para pasar por el normalizador.
#' @export
calc_muestra_aulas_config_fusionar <- function(vigente, entrante) {
  if (!is.list(entrante)) return(vigente %||% list())
  if (!is.list(vigente) || !length(vigente)) return(entrante)
  es_nombrada <- function(x) {
    is.list(x) && length(x) > 0 && !is.null(names(x)) && all(nzchar(names(x)))
  }
  out <- vigente
  for (nm in names(entrante)) {
    if (!nzchar(nm)) next
    val <- entrante[[nm]]
    if (is.null(val)) {
      # null explicito = borrar; la ausencia (no estar en names) = conservar.
      out[[nm]] <- NULL
      next
    }
    prev <- out[[nm]]
    if (es_nombrada(val) && es_nombrada(prev)) {
      out[[nm]] <- calc_muestra_aulas_config_fusionar(prev, val)
    } else {
      out[[nm]] <- val
    }
  }
  out
}
