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

# Rampa ordinal de cuatro pasos, medida sobre el deck 2021.
.PRESET_ACRD_RAMPA <- c("#F4B183", "#FFD966", "#B0D597", "#8FC36B")

# Gris para las categorías que no son parte de la escala («SIN INF» y afines):
# no pertenecen a la rampa y teñirlas de verde o naranja las mete en un orden
# que no tienen.
.PRESET_ACRD_FUERA_ESCALA <- "#BFBFBF"

#' Normaliza una etiqueta para comparar: minúsculas, sin tildes, sin espacios
#' de más. El instrumento escribe la misma categoría de varias formas
#' («Totalmente de Acuerdo», «totalmente de acuerdo») y el match exacto por
#' nombre las trata como distintas.
#' @noRd
.preset_acrd_clave <- function(x) {
  x <- tolower(trimws(as.character(x)))
  x <- iconv(x, to = "ASCII//TRANSLIT")
  x <- gsub("[^a-z ]", "", x)
  gsub("\\s+", " ", x)
}

# Las cuatro posiciones de la escala y las formas con las que aparecen. Cubre
# acuerdo y satisfacción, que son las dos escalas de 4 puntos de la matriz
# PULSO (`matriz_pulso_xlsform.R`).
.PRESET_ACRD_ESCALA <- list(
  c("totalmente en desacuerdo", "muy en desacuerdo", "nada satisfecho"),
  c("en desacuerdo", "poco satisfecho"),
  c("de acuerdo", "satisfecho"),
  c("totalmente de acuerdo", "muy de acuerdo", "muy satisfecho")
)

#' Colores de la escala, alineados a las etiquetas reales de la lámina.
#'
#' Con `etiquetas = NULL` devuelve la rampa con los nombres canónicos, que es
#' lo útil cuando el plan no sabe todavía cómo se llaman las categorías.
#' @noRd
.preset_acreditacion_colores <- function(etiquetas = NULL) {
  if (is.null(etiquetas) || !length(etiquetas)) {
    return(stats::setNames(
      .PRESET_ACRD_RAMPA,
      c("Totalmente en desacuerdo", "En desacuerdo",
        "De acuerdo", "Totalmente de acuerdo")
    ))
  }

  etiquetas <- as.character(etiquetas)
  claves <- .preset_acrd_clave(etiquetas)
  pos <- vapply(claves, function(k) {
    hit <- which(vapply(.PRESET_ACRD_ESCALA, function(v) k %in% v, logical(1)))
    if (length(hit)) hit[[1]] else NA_integer_
  }, integer(1))

  # Sin reconocer nada pero con exactamente cuatro categorías, la escala viene
  # ordenada por construcción: asignar por posición es mejor que dejar que la
  # mitad caiga al default y la rampa se rompa a media barra.
  if (all(is.na(pos)) && length(etiquetas) == 4L) pos <- seq_len(4L)

  out <- ifelse(is.na(pos), .PRESET_ACRD_FUERA_ESCALA, .PRESET_ACRD_RAMPA[pos])
  stats::setNames(out, etiquetas)
}

#' Estilo de barras apiladas del informe de acreditación.
#'
#' Devuelve la lista de argumentos para `graficar_barras_apiladas()`. Se
#' compone sobre los args de la lámina, no los reemplaza: lo que el plan
#' declare explícitamente manda.
#'
#' @param etiquetas Etiquetas reales de la escala, en orden. Con ellas la
#'   paleta se ancla a lo que la lámina va a mostrar; sin ellas se usan los
#'   nombres canónicos y el match queda a merced de la literalidad.
#' @noRd
.preset_acreditacion_apiladas <- function(etiquetas = NULL) {
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
    #
    # Se resuelve contra las etiquetas REALES cuando se las pasan: la escala del
    # instrumento de acreditación viene «Totalmente en Desacuerdo» / «Totalmente
    # de Acuerdo», con mayúscula, y `.graficos_mk_palette()` matchea por nombre
    # exacto — dos de cuatro fallaban y caían al azul marino y al teal del
    # default. Se vio corriendo el preset sobre `acrconta.pulso`.
    colores_grupos = .preset_acreditacion_colores(etiquetas),

    # --- leyenda ------------------------------------------------------------
    # El deck declara la escala UNA vez (su lámina 5) y no la repite en las 16
    # láminas de resultados: `grep` devuelve un solo archivo. Repetirla gasta
    # alto del placeholder para decir lo ya dicho.
    mostrar_leyenda  = FALSE,
    leyenda_posicion = "ninguna",

    # --- base ---------------------------------------------------------------
    # «SIN INF» es la quinta opción de las escalas de 4 puntos de la matriz
    # PULSO, y en acreditación no es una categoría de la escala: es ausencia de
    # respuesta. Dejarla dentro le mete un quinto color a la rampa y le corre
    # el denominador al Top 2 Box (93 % en vez de 94 % en la batería p30 de
    # acrconta). Fuera, la base pasa a declararse «(respuestas válidas)» sola,
    # por `reporte_plan_base_criterio.R`.
    excluir_opciones = c("SIN INF", "Sin información", "NS/NR"),

    # --- columna Top 2 Box --------------------------------------------------
    barra_extra_preset = "top2box",
    # Dos sub-columnas con rejilla necesitan más carril que una cifra suelta.
    # Medido sobre el deck: 3,73 cm de 33,87 de lámina.
    canvas_w_extra = 0.16,
    barra_extra_tendencia = TRUE
  )
}

#' Colores de la escala de acreditación, para la lámina que la declara.
#'
#' La lámina `top_two_box` recibe sus colores como slot propio
#' (`p_slide_top_two_box(colores = ...)`), no desde el preset de gráficos: es
#' una lámina, no un gráfico. Esta función existe para que la escala que se
#' declara UNA vez en el mazo sea la misma que pintan todas las barras — si no,
#' la leyenda del mazo miente, que es justo el defecto del deck 2021 (sus
#' cuadritos usan `FFD965`/`ADD493` y sus barras `FFD966`/`B0D597`).
#'
#' @inheritParams presets_acreditacion
#' @return Vector de colores en el orden de la escala.
#' @export
colores_escala_acreditacion <- function(etiquetas = NULL) {
  unname(.preset_acreditacion_colores(etiquetas))
}

#' Presets del informe de acreditación, listos para el plan PPT.
#'
#' Devuelve el objeto `presets` que consume `reporte_ppt_plan()`, ya compuesto
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
#' @param etiquetas Etiquetas reales de la escala, en orden, para anclar la
#'   paleta. Ver `.preset_acreditacion_apiladas()`.
#' @return Lista de presets con la forma de `p_presets()`.
#' @export
presets_acreditacion <- function(etiquetas = NULL) {
  estilo <- .preset_acreditacion_apiladas(etiquetas)
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
