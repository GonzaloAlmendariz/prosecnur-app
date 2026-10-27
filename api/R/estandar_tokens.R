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

#' Colores de una lista nominal de `k` opciones sin paleta propia
#'
#' Dos opciones, la dicotómica; más, la rampa `categorica` y, pasadas sus cinco, su interpolación de los cuatro azules.
#' Lo usan las porciones nativas (`.lam_colores_pie`) y el respaldo ggplot (`.graficos_mk_palette`): un solo criterio
#' (Gonzalo, 2026-10-27: el JSON manda).
#' @keywords internal
.std_paleta_nominal <- function(k) {
  k <- max(0L, as.integer(k))
  if (k <= 2L) return(unname(.std_paleta("dicotomica"))[seq_len(k)])
  base <- unname(.std_paleta("categorica"))
  if (k <= length(base)) base[seq_len(k)] else grDevices::colorRampPalette(base[1:4])(k)
}

#' Tamaño tipográfico PPT en puntos (`titulo`, `base`, `leyenda`, `cifra`...)
#'
#' Más el desplazamiento del perfil de letra del cliente (K13, graficos_estilo_cliente.R), que sólo fija el worker del
#' export con `on.exit`: sin la opción, el valor del recetario tal cual.
#' @keywords internal
.std_pt <- function(nombre) .std_letra_desplazada(.std_valor("ppt", "tipografia", nombre), "ppt", nombre)

# Suma el desplazamiento K13 de `getOption("prosecnur.letra_desplazo")[[medio]][[nombre]]` a un tamaño numérico. En el
# Word, las figuras nunca bajan del piso del estándar (`grafico_minimo`, 8 pt); en el PPT, las cifras (rol «cifras» de
# graficos_estilo_cliente.R) tampoco bajan del suyo (`cifra_minimo`, 8 pt).
.std_letra_desplazada <- function(v, medio, nombre) {
  d <- (getOption("prosecnur.letra_desplazo") %||% list())[[medio]]
  if (!is.numeric(v) || !length(d) || !nombre %in% names(d)) return(v)
  v <- v + d[[nombre]]
  if (identical(medio, "word") && startsWith(nombre, "grafico_")) v <- max(v, .std_valor("word", "tipografia", "grafico_minimo"))
  if (identical(medio, "ppt") && nombre %in% .ESTILO_CLIENTE_ROLES$cifras$ppt) v <- max(v, .std_valor("ppt", "tipografia", "cifra_minimo"))
  v
}

#' Medida de la geometría de la lámina PPT, en pulgadas
#' @keywords internal
.std_geom <- function(nombre) {
  v <- .std_valor("ppt", "geometria", nombre)
  # Una lámina con narrativa arriba (ADR 0093, N7) baja la zona de datos lo que mide su texto: cada lámina nativa y su
  # compuerta se acomodan al alto que queda, sin conocer la narrativa. La opción la fija sólo el compositor narrativo.
  if (identical(nombre, "zona_datos_y0")) v <- v + getOption("prosecnur.lam_desplazo", 0) + getOption("prosecnur.lam_desplazo_titulo", 0)
  # Una nota sobre «Base:» (la de significancia, lamina_nota_significancia.R) sube el fondo de la zona de datos lo que mide.
  if (nombre %in% c("zona_datos_y1", "leyenda_y", "contenido_y1")) v <- v - getOption("prosecnur.lam_reserva_pie", 0)
  v
}

#' Grosor de barra en pulgadas según el número de filas de la lámina
#'
#' La tabla es escalonada (`filas_hasta`): la barra no adelgaza en continuo y
#' tampoco por tener cifras chicas; en ese caso la fila gana aire.
#'
#' N1 (Renzo, 2026-10-22): con un piso declarado (`grosor_piso_cm`, ver `.std_piso_escala_in()`) la barra de ESCALA no
#' baja de él; las categóricas no lo usan. Sin piso, la tabla manda como siempre.
#' @param n_filas Filas (barras) de la lámina.
#' @param tipo `escala_apilada` (Likert y escalas) o `categorias`.
#' @keywords internal
.std_grosor <- function(n_filas, tipo = c("escala_apilada", "categorias")) {
  tipo <- match.arg(tipo)
  tabla <- .std_valor("ppt", "grosor", tipo)
  n <- max(1L, as.integer(n_filas))
  g <- tabla[[length(tabla)]]$grosor
  for (fila in tabla) if (n <= fila$filas_hasta) { g <- fila$grosor; break }
  if (identical(tipo, "escala_apilada")) max(g, .std_piso_escala_in()) else g
}

#' Piso de grosor de las barras de escala, en pulgadas (0 = sin piso)
#'
#' Lo fija `options(prosecnur.grosor_piso_cm = )`: el informe (`presets$base$args$grosor_piso_cm`, vía
#' `.grosor_piso_fijar()`) o, durante una lámina, el slot (`espec$grosor_piso_cm`); sin ninguno, el token
#' `ppt.grosor.piso_escala_cm` del estándar. Un 0 o un valor no numérico no es piso. Solo geometría.
#' @keywords internal
.std_piso_escala_in <- function() {
  # Sin declaración (ni del informe ni del slot) rige el piso del estándar: «las barras se ven muy delgadas» (Gonzalo,
  # 2026-10-26) en todo proyecto que no lo declarara. Un 0 explícito lo sigue apagando.
  op <- getOption("prosecnur.grosor_piso_cm")
  v <- suppressWarnings(as.numeric(op %||% .std_valor("ppt", "grosor", "piso_escala_cm")))
  if (length(v) != 1L || !is.finite(v) || v <= 0) return(0)
  v / 2.54
}

#' Fija el piso del slot mientras se compone su lámina (gana al del informe; 0 lo quita); NULL no toca nada
#' @return Las opciones anteriores, para `on.exit(options(...))`.
#' @keywords internal
.grosor_piso_slot <- function(piso_cm) if (is.null(piso_cm)) list() else options(prosecnur.grosor_piso_cm = piso_cm)

#' Fija el piso del informe (`presets$base$args$grosor_piso_cm`); sin declaración no toca nada
#' @return Las opciones anteriores, para `on.exit(options(...))`.
#' @keywords internal
.grosor_piso_fijar <- function(presets) {
  declarado <- presets$base$args$grosor_piso_cm %||% presets$base$grosor_piso_cm
  if (is.null(declarado)) return(list())
  ok <- length(declarado) == 1L && is.numeric(declarado) && is.finite(declarado) && declarado >= 0
  if (!ok) {
    warning("`grosor_piso_cm` del informe no es válido («", paste(format(declarado), collapse = ", "),
            "»); se ignora. Debe ser un número >= 0 (cm).", call. = FALSE)
    return(list())
  }
  options(prosecnur.grosor_piso_cm = as.numeric(declarado))
}

#' M1 (Gonzalo, 2026-10-22): ¿se evita el «(cont.)» comprimiendo el AIRE (no la barra) cuando hay piso de grosor?
#'
#' `options(prosecnur.evitar_cont = )`, que fija `presets$base$args$evitar_cont` (`.evitar_cont_fijar()`). Sin declarar,
#' sigue al piso: con piso se evita el «(cont.)»; sin piso nada cambia. `FALSE` apaga la compresión (N1 puro: se parte).
#' @keywords internal
.std_evitar_cont <- function() {
  v <- getOption("prosecnur.evitar_cont")
  if (is.null(v) || length(v) != 1L || is.na(v)) return(.std_piso_escala_in() > 0)
  isTRUE(as.logical(v)) && .std_piso_escala_in() > 0
}

#' Fija `evitar_cont` del informe (`presets$base$args$evitar_cont`); sin declaración no toca nada
#' @return Las opciones anteriores, para `on.exit(options(...))`.
#' @keywords internal
.evitar_cont_fijar <- function(presets) {
  declarado <- presets$base$args$evitar_cont %||% presets$base$evitar_cont
  if (is.null(declarado) || length(declarado) != 1L || is.na(declarado)) return(list())
  options(prosecnur.evitar_cont = isTRUE(as.logical(declarado)))
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
.std_word <- function(seccion, nombre) {
  v <- .std_valor("word", seccion, nombre)
  if (identical(seccion, "tipografia")) .std_letra_desplazada(v, "word", nombre) else v
}

#' Ancho extra de la columna del ENUNCIADO de las láminas de escala, en pulgadas (0 = el del estándar)
#'
#' N10 (Renzo, 2026-10-22): un enunciado más ancho ocupa menos líneas y la lámina cabe sin partirse aun con el piso de
#' grosor. El ancho sale del área de barras (la columna de públicos y la barra se corren a la derecha; la Top Two Box
#' no se mueve). Lo fija `options(prosecnur.ancho_enunciado_extra_in = )` desde el informe
#' (`presets$base$args$ancho_enunciado_extra_in`, vía `.ancho_enunciado_fijar()`). Tope de 1.5 in: más se comería las
#' barras. Solo geometría: no toca grano ni denominadores.
#' @keywords internal
.std_enunciado_extra_in <- function() {
  v <- suppressWarnings(as.numeric(getOption("prosecnur.ancho_enunciado_extra_in")))
  if (length(v) != 1L || !is.finite(v) || v <= 0) return(0)
  min(v, 1.5)
}

#' Fija el ancho extra de enunciado del informe; sin declaración no toca nada
#' @return Las opciones anteriores, para `on.exit(options(...))`.
#' @keywords internal
.ancho_enunciado_fijar <- function(presets) {
  declarado <- presets$base$args$ancho_enunciado_extra_in %||% presets$base$ancho_enunciado_extra_in
  if (is.null(declarado)) return(list())
  ok <- length(declarado) == 1L && is.numeric(declarado) && is.finite(declarado) && declarado >= 0
  if (!ok) {
    warning("`ancho_enunciado_extra_in` del informe no es válido («", paste(format(declarado), collapse = ", "),
            "»); se ignora. Debe ser un número >= 0 (in).", call. = FALSE)
    return(list())
  }
  options(prosecnur.ancho_enunciado_extra_in = as.numeric(declarado))
}
