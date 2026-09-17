# carga_aulas_libro_avance_eje.R — la primera celda de las cabeceras del avance,
# cuando el eje de cuotas del estudio no es la facultad.
#
# Fase 5 del plan del eje declarable, y el archivo existe por tres restricciones
# que no se pueden negociar:
#
# **1 · La constante se queda LITERAL, byte a byte.**
# `AULAS_AVANCE_CABECERAS` no gana una línea de diff. No es purismo: cinco
# sitios del motor leen la primera columna por su nombre literal —`out$Facultad`
# en los tres ordenadores de `_diario`, `_rendimiento` y `_agendacion`,
# `fila[["Facultad"]] <- "Total"` en `_total`, y `facultades[["Facultad"]]` en
# las páginas del PDF—. Renombrar la columna los deja devolviendo `NULL` sin
# que nada falle.
#
# **2 · El reverso del Sheets compara la fila ENTERA.**
# `.calac_tabla_de_cabecera()` identifica a qué tabla pertenece una fila de
# cabecera comparándola contra las cinco constantes, porque tres empiezan por
# «Facultad» y la primera celda no basta. Si esa celda se vuelve dinámica, el
# reverso deja de reconocer las tablas y **la hoja pierde color y ancho sin
# fallar** — un fallo mudo en la hoja que el cliente lee.
#
# **3 · `api/DESCRIPTION` no tiene `Collate:`**, así que los ficheros colacionan
# alfabéticamente y la constante no puede definirse llamando a una función que
# se cargue después.
#
# De ahí el diseño: la constante es la verdad interna y la SUSTITUCIÓN ocurre
# sólo donde la cabecera llega a un humano —la fila que se escribe en la hoja y
# el bloque que se manda a la pantalla—. Los tipos de celda, el semáforo y el
# vocabulario de proporciones siguen decidiéndose con el rótulo ORIGINAL: un
# «Nivel» en la primera columna no debe cambiar cómo se formatea la segunda.

# La primera celda que la constante trae hoy. Sólo se sustituye ESA: una tabla
# cuya primera columna no sea el eje —«Indicadores», de «Avance general»— no se
# toca, y eso se comprueba en vez de suponerse.
.CALAE_CELDA_POR_DEFECTO <- "Facultad"

#' La cabecera de una tabla del avance, con la palabra del eje del estudio.
#'
#' @param clave la clave de la tabla (`general`, `facultad`, `rendimiento`,
#'   `aplicador`, `diario`).
#' @param eje la declaración del eje (`avance_cuota$eje` o
#'   [monitoreo_aulas_eje()]). Sin ella, o con el eje en facultad, devuelve la
#'   constante **idéntica**: es la vara de aceptación de este satélite y hay un
#'   test que la fija para las cinco claves.
#' @return el vector de cabeceras.
#'
#' **Interna a propósito**: la llaman los tres emisores de cabecera del paquete
#' —la hoja del libro, el xlsx y el bloque de la pantalla— y nadie de fuera. La
#' regla de la casa es que `@export` significa «alcanzable por nombre desde
#' fuera del namespace», y esto no lo es. El gate del NAMESPACE lo cazó en el
#' acto por llevar un `@export` que no correspondía.
#' @keywords internal
aulas_avance_cabeceras_eje <- function(clave, eje = NULL) {
  base <- AULAS_AVANCE_CABECERAS[[as.character(clave)[1]]]
  if (is.null(base) || !length(base)) return(character(0))
  etiqueta <- .monitoreo_scalar((eje %||% list())[["etiqueta"]] %||% "", "")
  if (!nzchar(etiqueta)) return(base)
  # La primera celda de esta tabla no es la del eje: nada que sustituir.
  if (!identical(as.character(base[[1]]), .CALAE_CELDA_POR_DEFECTO)) return(base)
  # El eje ES la facultad: se devuelve el MISMO objeto, no una copia igual.
  if (identical(etiqueta, .CALAE_CELDA_POR_DEFECTO)) return(base)
  c(etiqueta, base[-1])
}

#' Las primeras celdas que una cabecera del avance puede traer.
#'
#' La del defecto más la etiqueta de cada eje del catálogo. Es lo que el reverso
#' del Sheets tiene que reconocer: un documento escrito con el eje en nivel
#' trae «Nivel» donde la constante dice «Facultad», y sin esta lista sus tablas
#' se quedarían sin formato.
#' @keywords internal
.calae_primeras_celdas <- function() {
  ejes <- vapply(.MONITOREO_AULAS_EJES, function(e) {
    .monitoreo_scalar(e[["etiqueta"]] %||% "", "")
  }, character(1), USE.NAMES = FALSE)
  unique(c(.CALAE_CELDA_POR_DEFECTO, ejes[nzchar(ejes)]))
}

#' Todas las grafías de la cabecera de una tabla, para reconocerla al leerla.
#' @keywords internal
.calae_cabeceras_posibles <- function(clave) {
  base <- AULAS_AVANCE_CABECERAS[[as.character(clave)[1]]]
  if (is.null(base) || !length(base)) return(list())
  if (!identical(as.character(base[[1]]), .CALAE_CELDA_POR_DEFECTO)) return(list(base))
  lapply(.calae_primeras_celdas(), function(celda) c(celda, base[-1]))
}
