# =============================================================================
# graficos_preset_acreditacion.R — estilo de lámina de informe de acreditación
# =============================================================================
#
# QUÉ ES: los valores medidos sobre el informe consolidado de acreditación 2021
# (`2021_Informe_Consolidado Final.pptx`, 35 láminas, 21 charts OOXML), que es
# la vara de la casa para este tipo de entregable. No inventa dirección: cada
# número de aquí sale del XML de ese deck.
#
# POR QUÉ UN PRESET Y NO NUEVOS DEFECTOS: el estilo del motor sirve a varios
# tipos de estudio. Lo de acreditación es una familia entre otras — mover el
# defecto global habría cambiado mazos que hoy están bien.
#
# LO QUE NO ESTÁ AQUÍ: el reposicionamiento de etiquetas chicas. El deck movió
# 62 de 91 a mano con `manualLayout`; el motor lo resuelve solo
# (`.finalizar_estado_labels_apiladas`) y esa parte no se copia.

#' Estilo de barras apiladas del informe de acreditación.
#'
#' Devuelve la lista de argumentos para `graficar_barras_apiladas()`. Se
#' compone sobre los args de la lámina, no los reemplaza: lo que el plan
#' declare explícitamente manda.
#' @noRd
.preset_acreditacion_apiladas <- function() {
  list(
    # --- separación entre barras -------------------------------------------
    # gapWidth 74 del deck: la barra ocupa 100/174 del carril. Es constante en
    # los 21 charts, no crece con el número de filas — con 11 filas la barra
    # baja a 0,64 cm y la cifra de 14 pt sigue entrando.
    grosor_modo   = "manual",
    grosor_barras = 0.575,

    # --- tipografía ---------------------------------------------------------
    # La jerarquía del deck: la pregunta manda (16 pt), después el dato (14) y
    # al final la etiqueta de fila (13). El defecto del motor las tenía al
    # revés — la pregunta era el texto más chico de la lámina.
    #
    # OJO CON LAS UNIDADES: `size_texto_barras` viaja a `geom_text()`, que mide
    # en mm; el resto va a `cowplot::draw_text()`, que mide en puntos. 14 pt en
    # la barra son 14/.pt ≈ 4,9 de ggplot. Escribir 14 aquí pinta una cifra de
    # 40 pt — se vio en la primera corrida de humo.
    size_titulos_grupo = 16,
    size_texto_barras  = 14 / ggplot2::.pt,
    size_ejes          = 13,
    size_barra_extra   = 13,
    size_titulo_extra  = 12,

    # Navy sobre pasteles: es lo que permite bajar la saturación de la paleta.
    color_texto_barras = "#002060",
    color_ejes         = "#002060",
    color_titulos_grupo = "#002060",

    # --- paleta -------------------------------------------------------------
    # Rampa ordinal naranja -> verde. El cierre en verde (y no en azul marino)
    # es lo que deja leer la escala como intensidad creciente de acuerdo.
    colores_grupos = c(
      "Totalmente en desacuerdo" = "#F4B183",
      "En desacuerdo"            = "#FFD966",
      "De acuerdo"               = "#B0D597",
      "Totalmente de acuerdo"    = "#8FC36B"
    ),

    # --- leyenda ------------------------------------------------------------
    # El deck declara la escala UNA vez (su lámina 5) y no la repite en las 16
    # láminas de resultados: `grep` devuelve un solo archivo. Repetirla gasta
    # alto del placeholder para decir lo ya dicho.
    mostrar_leyenda  = FALSE,
    leyenda_posicion = "ninguna",

    # --- columna Top 2 Box --------------------------------------------------
    barra_extra_preset = "top2box",
    # Dos sub-columnas con rejilla necesitan más carril que una cifra suelta.
    # Medido sobre el deck: 3,73 cm de 33,87 de lámina.
    canvas_w_extra = 0.16,
    barra_extra_tendencia = TRUE
  )
}

#' Presets del informe de acreditación, listos para el plan PPT.
#'
#' Devuelve el objeto `presets` que consume `armar_reporte_ppt()`, ya compuesto
#' con `p_presets()`. Se usa como bloque de partida y admite ajustes encima:
#'
#' ```r
#' pr <- presets_acreditacion()
#' pr$barras_apiladas$args$grosor_barras <- 0.62   # esta lámina quiere más cuerpo
#' ```
#'
#' El comparativo interanual NO va aquí: se declara por lámina, porque el
#' histórico es un dato de cada pregunta y no un rasgo del estilo.
#'
#' @return Lista de presets con la forma de `p_presets()`.
#' @export
presets_acreditacion <- function() {
  estilo <- .preset_acreditacion_apiladas()
  p_presets(
    base            = .preset_acreditacion_slide(),
    barras_apiladas = estilo,
    multi_apiladas  = estilo
  )
}

#' Estilo de la lámina (título y textos) del informe de acreditación.
#'
#' El título de lámina del deck es el nombre de la DIMENSIÓN («INTEGRIDAD
#' INSTITUCIONAL»), no el enunciado de la pregunta: el enunciado vive en su
#' propio carril, a 16 pt, junto a sus barras. Poner la pregunta completa en
#' mayúsculas a 24 pt es lo que hoy desborda la caja de título en mazos con
#' enunciados largos.
#' @noRd
.preset_acreditacion_slide <- function() {
  list(
    size_titulo_slide = 24,
    bold_titulo_slide = TRUE,
    mayusculas_titulo_slide = TRUE,
    color_titulo_slide = "#C00000"
  )
}
