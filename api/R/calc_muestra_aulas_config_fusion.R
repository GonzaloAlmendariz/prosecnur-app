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

#' El config con el que una ruta de aulas debe trabajar.
#'
#' La resolucion vivia INLINE en cada ruta y AL REVES entre ellas:
#' `/aulas/certeza` como `s$calc_muestra_aulas_config %||% frame$config` y
#' `/aulas/seleccionar` como `frame$config %||% s$...`. Con `%||%` la primera
#' lista no vacia gana ENTERA y la otra se descarta completa, asi que no se
#' preferia una clave: se perdia todo el resto.
#'
#' Medido sobre HSVG2026 el 2026-08-27: los dos configs difieren en 24 de 715
#' claves, y la divergencia cae justo en `selector$faculty_targets`, que la
#' sesion trae con las 15 facultades y el marco no trae. Cada ruta recibia el
#' que NO le sirve —certeza heredaba unos targets que debe ignorar, y por eso su
#' curva salia plana; seleccionar no veia unos que si debe respetar, y el
#' frontend acabo inyectandolos en el body de cada peticion—.
#'
#' Orden: el marco es la base, la sesion manda sobre el, y el body manda sobre
#' los dos. Lo ausente hereda en cada paso, que es el contrato que este archivo
#' ya declara y prueba.
#'
#' @keywords internal
.cm_aulas_config_vigente <- function(session_config, frame_config, body_config = NULL) {
  base <- calc_muestra_aulas_config_fusionar(frame_config %||% list(), session_config %||% list())
  if (is.null(body_config) || !length(body_config)) return(base)
  calc_muestra_aulas_config_fusionar(base, body_config)
}
