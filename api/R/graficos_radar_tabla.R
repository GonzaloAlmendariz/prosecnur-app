# =============================================================================
# graficos_radar_tabla.R — la «Tabla de datos» del radar entre públicos y de sus variantes (Gonzalo, 2026-10-23)
# =============================================================================
#
# Alcance de esta fase: «solo para radar y sus variantes: líneas y puntos (ejes y puntos), barras comparativas, y ya».
#
# CONTRATO
#   `tabla` (choice, por tarjeta): `auto` | `si` | `no`.
#     - `auto` (defecto; ausente = auto): lo de siempre. Tabla junto al radar con la forma radar; SIN tabla con líneas y
#       puntos o barras.
#     - `si`: tabla en cualquiera de las tres formas.
#     - `no`: nunca.
#   Alias viejo: `mostrar_tabla` TRUE -> `auto`, FALSE -> `no`. Se lee en el constructor y en la migración del plan
#   (`.graficos_migrar_radar_tabla`, llamada por `.graficos_migrar_plan`), que reescribe una vez y deja el plan sin la
#   clave vieja; `mostrar_tabla` queda en la metadata como `heredado`.
#   `word_tabla` (bool, solo-Word, defecto FALSE = no va): no hereda `tabla`. TRUE inserta una tabla nativa de Word,
#   centrada y ENCIMA de la figura (reporte_word_tabla_grafico.R); el gráfico del Word no la pinta dentro de la imagen.
#
#   Contenido: lo que reporta el indicador del gráfico (para Arte, «% De acuerdo + Totalmente de acuerdo»): una fila por
#   criterio, una columna por público, con los decimales del gráfico y las mismas cifras redondeadas que sus etiquetas.
#   Encabezado de la primera columna: `tabla_titulo` si se declaró; si no, el nombre del indicador (`corte_etiqueta`).
#
# DÓNDE VIVE QUÉ
#   - Este archivo: normalización, contenido y adjunto de la tabla a la forma dibujada.
#   - lamina_tabla_costado.R: dónde va en el PPT (costado / debajo / omitida) y cómo se emite.
#   - reporte_word_tabla_grafico.R: la tabla nativa del Word.

.RADAR_TABLA_MODOS <- c("auto", "si", "no")

#' La tabla pedida, en su forma canónica
#'
#' @param tabla `NULL`/vacío o `auto`/`si`/`no` (se aceptan «sí» y mayúsculas).
#' @param mostrar_tabla Alias viejo: `TRUE` -> `auto`, `FALSE` -> `no`. Solo rige si `tabla` no se declaró.
#' @return `auto`, `si` o `no`; otro valor aborta en vez de caer en silencio.
#' @keywords internal
.radar_mb_tabla_modo <- function(tabla = NULL, mostrar_tabla = NULL) {
  vacio <- is.null(tabla) || !length(tabla) || is.na(tabla[1]) || !nzchar(trimws(as.character(tabla[1])))
  if (vacio) {
    if (is.null(mostrar_tabla) || !length(mostrar_tabla) || is.na(mostrar_tabla[1])) return("auto")
    return(if (isFALSE(as.logical(mostrar_tabla[1]))) "no" else "auto")
  }
  v <- tolower(trimws(as.character(tabla[1])))
  v <- chartr("í", "i", v)
  if (!v %in% .RADAR_TABLA_MODOS) {
    .plan_spec_abort("`tabla` debe ser «auto», «si» o «no»; llegó «", tabla[1], "».")
  }
  v
}

#' La tabla pedida por un elemento `radar_publicos`
#'
#' Un elemento guardado antes de `tabla` solo trae `mostrar_tabla`. Lee con `[[` porque `$` casaría `tabla_nativa`.
#' @keywords internal
.radar_mb_tabla_modo_el <- function(el) {
  .radar_mb_tabla_modo(el[["tabla"]], el[["mostrar_tabla"]])
}

#' `word_tabla`: `NULL` (sin declarar) o lógico
#' @keywords internal
.radar_mb_word_tabla <- function(x) {
  if (is.null(x) || !length(x) || is.na(x[1])) return(NULL)
  if (is.character(x)) x <- tolower(trimws(x[1])) %in% c("true", "si", "sí", "1")
  isTRUE(as.logical(x[1]))
}

#' ¿Esta forma dibuja la tabla con el modo pedido?
#' @param dibuja `radar`, `puntos` o `barras`.
#' @keywords internal
.radar_mb_tabla_procede <- function(modo, dibuja) {
  identical(modo, "si") || (identical(modo, "auto") && identical(dibuja, "radar"))
}

#' La tabla de cifras que acompaña a una forma sin radar y la que va al Word
#'
#' Una fila por criterio (nombre entero, no el recortado del dibujo) y una columna por público, con los decimales del
#' gráfico y la regla de redondeo de sus etiquetas (mitad hacia arriba). Donde no hay dato, «—».
#' @param datos Datos del radar (`eje`, `grupo`, `valor` de 0 a 100).
#' @param decimales Decimales del gráfico.
#' @param indicador Nombre del indicador (`corte_etiqueta`): encabezado de la primera columna.
#' @param titulo_tema `tabla_titulo` declarado; manda sobre el indicador.
#' @param encabezados `tabla_encabezados` (clave -> título), como en la tabla del radar.
#' @return `list(encabezado, ejes, grupos, cifras)`; `cifras` es una matriz de texto criterios x públicos.
#' @keywords internal
.radar_mb_tabla_cifras <- function(datos, decimales = 0L, indicador = "", titulo_tema = "", encabezados = list()) {
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec)) dec <- 0L
  dec <- max(0L, min(3L, dec))
  ejes <- levels(datos$eje); crudos <- levels(datos$grupo)
  cifras <- vapply(crudos, function(g) {
    vapply(ejes, function(e) {
      v <- datos$valor[datos$eje == e & datos$grupo == g]
      if (!length(v) || !is.finite(v[1])) "—" else .pulso_fmt_pct_half_up(v[1], dec, escala = 1)
    }, "")
  }, character(length(ejes)))
  cifras <- matrix(cifras, nrow = length(ejes), ncol = length(crudos))
  nombres <- .radar_mb_capitalizar(crudos)
  for (clave in names(encabezados %||% list())) {
    j <- match(clave, crudos)
    if (!is.na(j)) nombres[j] <- as.character(encabezados[[clave]])
  }
  enc <- trimws(as.character(titulo_tema %||% "")[1])
  if (is.na(enc) || !nzchar(enc)) enc <- trimws(as.character(indicador %||% "")[1])
  if (is.na(enc) || !nzchar(enc)) enc <- "Tema"
  list(encabezado = enc, ejes = ejes, grupos = nombres, cifras = cifras, decimales = dec)
}

#' Tabla de cifras como `data.frame` de texto (primera columna = criterios, encabezado = indicador)
#' @keywords internal
.radar_mb_tabla_df <- function(info) {
  df <- data.frame(info$ejes, info$cifras, check.names = FALSE, stringsAsFactors = FALSE)
  names(df) <- c(info$encabezado, info$grupos)
  rownames(df) <- NULL
  df
}

#' Adjunta la tabla a un gráfico de líneas y puntos o de barras
#'
#' - Líneas y puntos (`espec$tipo == "pesas"`): la tabla viaja en `espec$tabla` y la lámina nativa la dibuja
#'   (`.lam_laminas_pesas`). Además se adjunta como tabla nativa del camino general, que es el respaldo cuando la lámina
#'   nativa no aplica: sin él la tabla se perdería en silencio.
#' - Barras (ggplot sin espec): tabla nativa del camino general, con su sitio decidido al colocarla
#'   (`.tabla_nativa_geom`), cuando se conoce el cajón real.
#' @param g Gráfico dibujado.
#' @param info Salida de `.radar_mb_tabla_cifras`.
#' @param texto_pt Letra del cuerpo para el camino general (nunca baja de la mínima de cifras).
#' @keywords internal
.radar_mb_tabla_adjuntar <- function(g, info, dibuja = c("puntos", "barras")) {
  dibuja <- match.arg(dibuja)
  espec <- attr(g, "pulso_espec")
  if (is.list(espec) && identical(espec$tipo, "pesas")) {
    espec[["tabla"]] <- info
    attr(g, "pulso_espec") <- espec
  }
  df <- .radar_mb_tabla_df(info)
  if (!(is.list(espec) && identical(espec$tipo, "pesas"))) dibuja <- "barras"   # con otro numero de publicos que dos, las lineas y puntos caen a barras
  M <- .LAM_TABLA_COSTADO_GENERAL
  .tabla_nativa_adjuntar(g, df, estilo = list(
    font_family = "Arial", body_size = M$cuerpo_pt, header_size = M$enc_pt, lugar_auto = TRUE,
    ancho_col1_in = M$col1, alto_fila = M$fila, tabla_dibuja = dibuja,
    tabla_ejes = info$ejes, tabla_grupos = info$grupos, tabla_encabezado = info$encabezado
  ))
}

#' La tabla nativa del Word, si el elemento la pidió
#'
#' Cuelga de la figura `pulso_word_tabla`; el documento la lee y la pone encima. Solo con `word_tabla` TRUE.
#' @keywords internal
.radar_mb_word_adjuntar <- function(g, info) {
  attr(g, "pulso_word_tabla") <- info
  g
}

# ---- migración del plan -----------------------------------------------------

#' Migra `mostrar_tabla` -> `tabla` en los args de un radar entre públicos
#' @return `list(args, cambio)`.
#' @keywords internal
.rt_migrar_args <- function(args) {
  if (!is.list(args) || !"mostrar_tabla" %in% names(args)) return(list(args = args, cambio = FALSE))
  viejo <- args[["mostrar_tabla"]]
  declarada <- args[["tabla"]]
  if (is.list(declarada)) declarada <- unlist(declarada, use.names = FALSE)
  hay_tabla <- is.character(declarada) && length(declarada) >= 1L && !is.na(declarada[1]) && nzchar(trimws(declarada[1]))
  if (!hay_tabla) {
    if (is.list(viejo)) viejo <- unlist(viejo, use.names = FALSE)
    if (is.character(viejo)) viejo <- tolower(trimws(viejo)) %in% c("true", "1", "si", "sí")
    args[["tabla"]] <- if (length(viejo) == 1L && !is.na(viejo) && isFALSE(as.logical(viejo))) "no" else "auto"
  }
  args[["mostrar_tabla"]] <- NULL
  list(args = args, cambio = TRUE)
}

#' Recorre un payload y migra cada `p_radar` en modo «publicos»
#' @keywords internal
.rt_migrar_payload <- function(x) {
  if (!is.list(x) || is.data.frame(x)) return(x)
  if (identical(as.character(x[["graficador"]] %||% "")[1], "p_radar") && is.list(x[["args"]])) {
    if (identical(as.character(x[["args"]][["modo"]] %||% "")[1], "publicos")) {
      x[["args"]] <- .rt_migrar_args(x[["args"]])$args
    }
    return(x)
  }
  for (i in seq_along(x)) if (is.list(x[[i]])) x[[i]] <- .rt_migrar_payload(x[[i]])
  x
}

#' Migra `mostrar_tabla` a `tabla` en un plan
#'
#' `mostrar_tabla` TRUE pasa a `auto` (lo de siempre: tabla junto al radar, ninguna con líneas y puntos o barras) y FALSE a
#' `no`. Idempotente: un plan ya migrado no trae la clave. Lo llama `.graficos_migrar_plan()`.
#' @param plan Plan de la config (`list(slides = ...)`).
#' @keywords internal
.graficos_migrar_radar_tabla <- function(plan) {
  if (!is.list(plan) || !is.list(plan$slides) || !length(plan$slides)) return(plan)
  for (i in seq_along(plan$slides)) {
    s <- plan$slides[[i]]
    if (!is.list(s) || !is.list(s$payload)) next
    plan$slides[[i]]$payload <- .rt_migrar_payload(s$payload)
  }
  plan
}
