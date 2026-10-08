# =============================================================================
# estandar_tokens.R — el estándar de los recetarios, leído por nombre (ADR 0092)
# =============================================================================
#
# `inst/estandar/estandar_pulso.json` es la única fuente de verdad del estilo del
# motor de PPT y Word: colores, paletas, escala tipográfica, geometría de la
# lámina, grosor de barra por número de filas, ranuras de los 22 tipos de lámina
# y el bloque Word. Lo exporta `docs/qa/motor-ppt-2026-10-06/herramientas/
# exportar_estandar.R` desde los recetarios; cambiar el estilo es cambiar el
# recetario y re-exportar, nunca tocar un número dentro de un graficador.
#
# Se lee una vez por proceso y en tiempo de ejecución, no al construir el
# paquete: el código de primer nivel corre durante `R CMD INSTALL`, cuando
# `system.file()` todavía no resuelve el paquete. Por eso los presets de
# `graficos_metadata.R` siguen siendo literales y `test-estandar-tokens.R` falla
# si dejan de coincidir con estos accesores.
#
# Un nombre que no existe aborta con su ruta: un token mal escrito que cae a
# NULL y luego a un default local es justo la deriva que este archivo cierra.

.std_cache <- new.env(parent = emptyenv())

.std_ruta <- function() {
  p <- system.file("estandar", "estandar_pulso.json", package = "prosecnurapp", mustWork = FALSE)
  if (nzchar(p) && file.exists(p)) return(p)
  candidatos <- c(
    file.path(.app_api_dir(), "inst", "estandar", "estandar_pulso.json"),
    file.path(getwd(), "inst", "estandar", "estandar_pulso.json"),
    file.path(getwd(), "api", "inst", "estandar", "estandar_pulso.json")
  )
  hit <- candidatos[file.exists(candidatos)][1]
  if (is.na(hit)) stop("No se encuentra inst/estandar/estandar_pulso.json (ADR 0092).", call. = FALSE)
  hit
}

#' Estándar visual completo, leído y cacheado
#' @keywords internal
.std <- function() {
  if (is.null(.std_cache$est)) {
    .std_cache$est <- jsonlite::fromJSON(.std_ruta(), simplifyVector = FALSE)
  }
  .std_cache$est
}

.std_valor <- function(...) {
  ruta <- c(...)
  v <- .std()
  for (k in ruta) {
    v <- v[[k]]
    if (is.null(v)) stop(sprintf("Token del estándar inexistente: %s", paste(ruta, collapse = ".")), call. = FALSE)
  }
  v
}

#' Color con nombre de la lámina PPT (`coral`, `azul`, `tenue`, `filete`...)
#' @keywords internal
.std_color <- function(nombre) .std_valor("ppt", "colores", nombre)

#' Colores de una paleta del estándar (`likert`, `dicotomica`, `actores`, `mapa`...)
#'
#' Devuelve el vector `colores` (o `clases` en el mapa); las paletas que son
#' mapas de nombre a color (`categorias`, `calor`) vuelven como lista.
#' @keywords internal
.std_paleta <- function(nombre) {
  p <- .std_valor("ppt", "paletas", nombre)
  if (!is.null(p$colores)) return(unlist(p$colores, use.names = FALSE))
  if (!is.null(p$clases)) return(unlist(p$clases, use.names = FALSE))
  p
}

#' Tamaño tipográfico PPT en puntos (`titulo`, `base`, `leyenda`, `cifra`...)
#' @keywords internal
.std_pt <- function(nombre) .std_valor("ppt", "tipografia", nombre)

#' Medida de la geometría de la lámina PPT, en pulgadas
#' @keywords internal
.std_geom <- function(nombre) .std_valor("ppt", "geometria", nombre)

#' Grosor de barra en pulgadas según el número de filas de la lámina
#'
#' La tabla es escalonada (`filas_hasta`): la barra no adelgaza en continuo y
#' tampoco por tener cifras chicas; en ese caso la fila gana aire.
#' @param n_filas Filas (barras) de la lámina.
#' @param tipo `escala_apilada` (Likert y escalas) o `categorias`.
#' @keywords internal
.std_grosor <- function(n_filas, tipo = c("escala_apilada", "categorias")) {
  tipo <- match.arg(tipo)
  tabla <- .std_valor("ppt", "grosor", tipo)
  n <- max(1L, as.integer(n_filas))
  for (fila in tabla) if (n <= fila$filas_hasta) return(fila$grosor)
  tabla[[length(tabla)]]$grosor
}

#' Aire extra por fila cuando sus cifras chicas suben con guía, en pulgadas
#' @keywords internal
.std_aire_chica <- function() .std_geom("aire_cifra_chica")

#' Tipo de lámina del estándar por id (`p_slide_1_grafico`...), con sus ranuras
#' @keywords internal
.std_tipo_lamina <- function(id) {
  for (t in .std_valor("ppt", "tipos_lamina")) if (identical(t$id, id)) return(t)
  stop(sprintf("Tipo de lámina fuera del estándar: %s", id), call. = FALSE)
}

#' Ids de los tipos de lámina del estándar, en el orden del recetario
#' @keywords internal
.std_tipos_lamina <- function() {
  vapply(.std_valor("ppt", "tipos_lamina"), function(t) t$id, character(1))
}

#' Valor del bloque Word (`pagina`, `tipografia`, `colores`, `figura`)
#' @keywords internal
.std_word <- function(seccion, nombre) .std_valor("word", seccion, nombre)
