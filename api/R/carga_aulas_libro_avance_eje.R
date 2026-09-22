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
  aulas_avance_cabecera_con_eje(AULAS_AVANCE_CABECERAS[[as.character(clave)[1]]],
                                clave, eje)
}

#' Lo mismo, sobre la cabecera que una tabla trae DE VERDAD.
#'
#' Desde que las columnas se derivan de lo que el estudio declara
#' (`carga_aulas_libro_avance_declaradas.R`), la cabecera publicada puede ser un
#' subconjunto de la constante. La versión anterior comparaba longitudes contra
#' `AULAS_AVANCE_CABECERAS` y con un subconjunto no casaba: la hoja salía con
#' «Facultad» en la primera celda de una tabla cuyas filas son niveles, que es
#' justo el rótulo mentiroso que el satélite existe para quitar. Aquí la
#' referencia es la cabecera real.
#'
#' @param cabecera los rótulos que la tabla trae.
#' @param clave la clave de la tabla.
#' @param eje la declaración del eje.
#' @return la cabecera, con su primera celda sustituida cuando procede.
#' @keywords internal
aulas_avance_cabecera_con_eje <- function(cabecera, clave, eje = NULL) {
  base <- as.character(cabecera %||% character(0))
  if (!length(base)) return(character(0))
  etiqueta <- .monitoreo_scalar((eje %||% list())[["etiqueta"]] %||% "", "")
  if (!nzchar(etiqueta)) return(base)
  # La primera celda de esta tabla no es la del eje: nada que sustituir.
  if (!identical(as.character(base[[1]]), .CALAE_CELDA_POR_DEFECTO)) return(base)
  # El eje ES la facultad: se devuelve el MISMO objeto, no una copia igual.
  if (identical(etiqueta, .CALAE_CELDA_POR_DEFECTO)) return(base)
  # **Y sólo si las FILAS de esa tabla son del eje.**
  #
  # Cuatro de las cinco tablas empiezan por «Facultad», pero no todas agrupan lo
  # mismo. `facultad` reparte las CELDAS DE CUOTA —le llegan de
  # `cuotas$facultades`, que con el eje en nivel son 6, 7, 8 y 9—. Las otras tres
  # agrupan AULAS: `rendimiento` mide τ por aula aplicada, `aplicador` reparte
  # por quien aplica y `diario` por jornada, y en las tres la fila sale de
  # `u$faculty`.
  #
  # Con `atribucion = "persona"` el nivel de un aula es el MODAL de sus alumnos,
  # no el de nadie: llamarle «Nivel» a una columna cuyas filas son facultades es
  # exactamente la mentira que este satélite venía a quitar. Visto el 2026-09-21
  # en el libro de CCSS Perfil 2026-II: «Rendimiento por facultad» salía con
  # cabecera «Nivel» y una sola fila, «CIENCIAS SOCIALES».
  #
  # Con el eje en el AULA —HSVG, y todo lo vigente— las dos cosas coinciden y las
  # cuatro tablas se sustituyen como hasta ahora.
  if (!.calae_filas_del_eje(clave, eje)) return(base)
  c(etiqueta, base[-1])
}

#' ¿Las filas de esta tabla son del eje, o son aulas?
#'
#' Con el eje atribuido al AULA la pregunta no se plantea: todo agrupa igual.
#' Con `atribucion = "persona"` sólo la tabla de cuotas reparte por el eje.
#' @keywords internal
.calae_filas_del_eje <- function(clave, eje) {
  atribucion <- .monitoreo_scalar((eje %||% list())[["atribucion"]] %||% "aula", "aula")
  if (!identical(atribucion, "persona")) return(TRUE)
  identical(as.character(clave)[1], "facultad")
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

# --- El TÍTULO del bloque, por el mismo criterio que su cabecera -------------
#
# El bloque salía rotulado «Avance por facultad» con cuatro NIVELES dentro. Es
# el mismo rótulo mentiroso que este repo ya arregló una vez («el encabezado
# decía "Facultad" encima de una columna de carreras»), y aquí era peor porque
# la cabecera de la primera columna YA decía «Nivel» desde la fase 5: el título
# y su propia cabecera se contradecían a dos renglones de distancia.
#
# Se sustituye por la MISMA regla que la cabecera (`.calae_filas_del_eje()`) y
# no por una paralela. Si las dos se separaran, una hoja podría salir con título
# «Avance por nivel» sobre una columna rotulada «Facultad», que es exactamente
# el defecto de origen con los papeles cambiados.
#
# Sólo se toca la cola «… por facultad»: «Producción por aplicador» reparte por
# PERSONA que aplica y «Avance general» / «Avance diario» no nombran ninguna
# dimensión, así que ninguno de los tres califica y ninguno se retoca.
.CALAE_TITULO_SUFIJO <- " por facultad"

#' El título de bloque de una tabla del avance, con la palabra del eje.
#'
#' @param clave la clave de la tabla.
#' @param eje la declaración del eje (`avance_cuota$eje` o
#'   [monitoreo_aulas_eje()]). Sin ella, o con el eje en facultad, devuelve la
#'   constante **idéntica**.
#' @return el título.
#' @keywords internal
aulas_avance_titulos_eje <- function(clave, eje = NULL) {
  clave <- as.character(clave)[1]
  base <- unname(AULAS_AVANCE_TITULOS[[clave]])
  if (is.null(base) || !length(base) || !nzchar(base)) return(character(0))
  etiqueta <- .monitoreo_scalar((eje %||% list())[["etiqueta"]] %||% "", "")
  if (!nzchar(etiqueta) || identical(etiqueta, .CALAE_CELDA_POR_DEFECTO)) return(base)
  if (!endsWith(base, .CALAE_TITULO_SUFIJO)) return(base)
  # Con `atribucion = "persona"` sólo la tabla de cuotas reparte por el eje: las
  # otras tres agrupan AULAS y su fila sigue saliendo de `u$faculty`.
  if (!.calae_filas_del_eje(clave, eje)) return(base)
  paste0(substr(base, 1L, nchar(base) - nchar(.CALAE_TITULO_SUFIJO)),
         " por ", tolower(etiqueta))
}

#' Todos los títulos de bloque que una hoja del avance puede traer.
#'
#' Lo que el reverso del Sheets tiene que reconocer, por el mismo motivo que
#' `.calae_primeras_celdas()`: el formateador identifica los bloques por su
#' título para darles su banda, para saber dónde acaba una tabla y para no
#' confundir un título con una nota. Un documento escrito con el eje en nivel
#' trae «Avance por nivel» donde la constante dice «Avance por facultad», y sin
#' esta lista **la hoja pierde su banda sin que nada falle**.
#'
#' Es una FUNCIÓN y no una constante a propósito: `api/DESCRIPTION` no tiene
#' `Collate:`, los ficheros colacionan alfabéticamente y `.MONITOREO_AULAS_EJES`
#' vive en `monitoreo_aulas_eje.R`, que carga después de este archivo y después
#' del formateador. Una constante evaluada al cargar no lo encontraría.
#' @keywords internal
.calae_titulos_posibles <- function() {
  etiquetas <- vapply(.MONITOREO_AULAS_EJES, function(e) {
    .monitoreo_scalar(e[["etiqueta"]] %||% "", "")
  }, character(1), USE.NAMES = FALSE)
  etiquetas <- tolower(etiquetas[nzchar(etiquetas)])
  base <- unname(AULAS_AVANCE_TITULOS)
  variantes <- unlist(lapply(base, function(t) {
    if (!endsWith(t, .CALAE_TITULO_SUFIJO)) return(t)
    paste0(substr(t, 1L, nchar(t) - nchar(.CALAE_TITULO_SUFIJO)), " por ", etiquetas)
  }), use.names = FALSE)
  unique(c(base, variantes))
}
