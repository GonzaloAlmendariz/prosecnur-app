# internal helpers for top/bottom box presets
.normalize_box_label <- function(x) {
  x <- as.character(x %||% "")[1]
  x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
  x <- tolower(trimws(x))
  gsub("[^a-z0-9]+", " ", x)
}

.extract_special_code <- function(x) {
  x <- as.character(x %||% "")[1]
  if (!nzchar(trimws(x))) return(NA_real_)
  m <- regexec("^\\s*([0-9]{1,3})\\b", x, perl = TRUE)
  got <- regmatches(x, m)[[1]]
  if (length(got) < 2L) return(NA_real_)
  suppressWarnings(as.numeric(got[2]))
}

.is_special_box_choice <- function(col_name, label) {
  lab_norm <- .normalize_box_label(label)
  patterns <- c(
    "sin inf",
    "sin informacion",
    "valor perdido",
    "missing",
    "no sabe",
    "no contesta",
    "no responde",
    "ns nc",
    "ns nr",
    "no sabe no contesta",
    "no sabe no responde"
  )
  has_special_label <- any(vapply(patterns, grepl, logical(1), x = lab_norm, fixed = TRUE))
  code_candidates <- c(.extract_special_code(label), .extract_special_code(col_name))
  has_special_code <- any(is.finite(code_candidates) & code_candidates > 60)
  has_special_label || has_special_code
}

.default_box_cols <- function(cols_porcentaje,
                              etiquetas_grupos,
                              n = 2L,
                              side = c("top", "bottom")) {
  side <- match.arg(side)
  n <- suppressWarnings(as.integer(n)[1])
  if (!is.finite(n) || is.na(n) || n < 1L) n <- 1L

  labels_map <- etiquetas_grupos[cols_porcentaje]
  labels_map <- as.character(labels_map)
  if (!length(labels_map)) labels_map <- rep("", length(cols_porcentaje))
  labels_map[is.na(labels_map)] <- ""

  keep <- !vapply(seq_along(cols_porcentaje), function(i) {
    .is_special_box_choice(cols_porcentaje[i], labels_map[i])
  }, logical(1))

  eligible <- cols_porcentaje[keep]
  if (!length(eligible)) eligible <- cols_porcentaje

  if (side == "top") {
    tail(eligible, min(n, length(eligible)))
  } else {
    head(eligible, min(n, length(eligible)))
  }
}

.auto_bar_width_apiladas <- function(n_categorias,
                                     grosor_barras_mult = 1,
                                     usar_grupos_canvas = TRUE) {
  n_eff <- suppressWarnings(as.numeric(n_categorias)[1])
  if (!is.finite(n_eff) || is.na(n_eff) || n_eff <= 0) n_eff <- 1

  mult_eff <- suppressWarnings(as.numeric(grosor_barras_mult)[1])
  if (!is.finite(mult_eff) || is.na(mult_eff) || mult_eff <= 0) mult_eff <- 1

  # Calibracion suave, anclada a uso en PPT:
  # - pocas categorias: barras claramente visibles, sin quedar enclenques
  # - muchas categorias: sostener grosor para que no se afinen demasiado
  base <- stats::approx(
    x = c(1, 3, 5, 9, 12, 20),
    y = c(0.64, 0.70, 0.71, 0.72, 0.74, 0.78),
    xout = n_eff,
    rule = 2
  )$y

  if (!isTRUE(usar_grupos_canvas)) {
    # En barras sin columna de grupos, el mismo width se percibe mas grueso.
    # Compensamos suavemente para acercar el look al modo multi-fuente.
    base <- base * 0.88
  }

  max(0.40, min(0.85, base * mult_eff))
}

.estimate_label_width_apiladas <- function(labels, size) {
  labels <- as.character(labels)
  if (!length(labels)) return(numeric(0))

  size <- suppressWarnings(as.numeric(size))
  if (!length(size)) size <- 3
  size <- rep_len(size, length(labels))
  size[!is.finite(size)] <- 3

  chars <- nchar(labels, type = "width", allowNA = FALSE, keepNA = FALSE)
  chars[!is.finite(chars)] <- 0

  # Aproximación visual del ancho de etiqueta sobre escala 0-1.
  # Se usa para detectar colisiones entre etiquetas internas.
  est <- 0.005 + 0.0045 * pmax(chars, 2) + 0.0035 * pmax(size, 1)
  pmax(0.018, pmin(0.07, est))
}

.repel_label_positions_apiladas <- function(x,
                                            labels,
                                            label_size,
                                            movable,
                                            max_shift = 0.05,
                                            x_min = 0,
                                            x_max = 1,
                                            padding = 0.003,
                                            max_iter = 16L,
                                            bias_right = 0.5,
                                            edge_margin = 0,
                                            width_factor = 1,
                                            bias_toward_center = FALSE,
                                            center_ref = 0.5) {
  x <- suppressWarnings(as.numeric(x))
  n <- length(x)
  if (!n) return(x)
  if (n == 1L) return(x)

  movable <- as.logical(movable)
  movable[is.na(movable)] <- FALSE
  if (!any(movable)) return(x)

  max_shift <- suppressWarnings(as.numeric(max_shift)[1])
  if (!is.finite(max_shift) || is.na(max_shift) || max_shift < 0) max_shift <- 0.05

  padding <- suppressWarnings(as.numeric(padding)[1])
  if (!is.finite(padding) || is.na(padding) || padding < 0) padding <- 0.003

  bias_right <- suppressWarnings(as.numeric(bias_right)[1])
  if (!is.finite(bias_right) || is.na(bias_right)) bias_right <- 0.5
  bias_right <- max(0, min(1, bias_right))

  edge_margin <- suppressWarnings(as.numeric(edge_margin)[1])
  if (!is.finite(edge_margin) || is.na(edge_margin) || edge_margin < 0) edge_margin <- 0

  width_factor <- suppressWarnings(as.numeric(width_factor)[1])
  if (!is.finite(width_factor) || is.na(width_factor) || width_factor <= 0) width_factor <- 1
  bias_toward_center <- isTRUE(bias_toward_center)
  center_ref <- suppressWarnings(as.numeric(center_ref)[1])
  if (!is.finite(center_ref) || is.na(center_ref)) center_ref <- 0.5
  center_ref <- max(0, min(1, center_ref))

  ord <- order(x, seq_along(x))
  inv <- order(ord)

  x_ord <- x[ord]
  labels_ord <- rep_len(as.character(labels), n)[ord]
  size_ord <- rep_len(suppressWarnings(as.numeric(label_size)), n)[ord]
  movable_ord <- movable[ord]

  x_min_vec <- rep_len(suppressWarnings(as.numeric(x_min)), n)
  x_max_vec <- rep_len(suppressWarnings(as.numeric(x_max)), n)
  x_min_vec[!is.finite(x_min_vec)] <- 0
  x_max_vec[!is.finite(x_max_vec)] <- 1

  x_min_ord <- x_min_vec[ord]
  x_max_ord <- x_max_vec[ord]
  swap_idx <- x_min_ord > x_max_ord
  if (any(swap_idx)) {
    tmp <- x_min_ord[swap_idx]
    x_min_ord[swap_idx] <- x_max_ord[swap_idx]
    x_max_ord[swap_idx] <- tmp
  }

  # Margen interno para que la etiqueta no toque el borde del segmento.
  x_min_ord <- pmin(x_max_ord - 1e-6, x_min_ord + edge_margin)
  x_max_ord <- pmax(x_min_ord + 1e-6, x_max_ord - edge_margin)

  width_est <- .estimate_label_width_apiladas(labels_ord, size_ord) * width_factor
  half_width <- width_est / 2

  lower <- pmax(x_min_ord + half_width, x_ord - max_shift)
  upper <- pmin(x_max_ord - half_width, x_ord + max_shift)

  impossible <- lower > upper
  if (any(impossible)) {
    seg_center_imp <- (x_min_ord[impossible] + x_max_ord[impossible]) / 2
    push_to_center <- ifelse(seg_center_imp <= center_ref, x_max_ord[impossible], x_min_ord[impossible])
    center_fix <- pmin(
      x_max_ord[impossible],
      pmax(x_min_ord[impossible], push_to_center)
    )
    center_fix <- pmin(1, pmax(0, center_fix))
    lower[impossible] <- center_fix
    upper[impossible] <- center_fix
  }

  x_adj <- pmin(upper, pmax(lower, x_ord))

  max_iter <- suppressWarnings(as.integer(max_iter)[1])
  if (!is.finite(max_iter) || is.na(max_iter) || max_iter < 1L) max_iter <- 16L

  for (iter in seq_len(max_iter)) {
    changed <- FALSE

    for (i in seq_len(n - 1L)) {
      required_gap <- half_width[i] + half_width[i + 1L] + padding
      current_gap <- x_adj[i + 1L] - x_adj[i]

      if (!is.finite(current_gap) || current_gap + 1e-9 >= required_gap) next

      overlap <- required_gap - current_gap
      left_room <- if (movable_ord[i]) max(0, x_adj[i] - lower[i]) else 0
      right_room <- if (movable_ord[i + 1L]) max(0, upper[i + 1L] - x_adj[i + 1L]) else 0

      if (left_room <= 0 && right_room <= 0) next

      shift_left <- 0
      shift_right <- 0

      if (movable_ord[i] && movable_ord[i + 1L]) {
        bias_eff <- bias_right
        if (isTRUE(bias_toward_center)) {
          pair_mid <- (x_adj[i] + x_adj[i + 1L]) / 2
          center_bias <- if (pair_mid < center_ref) {
            0.75
          } else if (pair_mid > center_ref) {
            0.25
          } else {
            0.5
          }
          bias_eff <- (bias_right + center_bias) / 2
        }
        target_right <- overlap * bias_eff
        target_left <- overlap - target_right
        shift_right <- min(target_right, right_room)
        shift_left <- min(target_left, left_room)

        rem <- overlap - shift_left - shift_right
        if (rem > 1e-9 && right_room > shift_right) {
          extra <- min(rem, right_room - shift_right)
          shift_right <- shift_right + extra
          rem <- rem - extra
        }
        if (rem > 1e-9 && left_room > shift_left) {
          extra <- min(rem, left_room - shift_left)
          shift_left <- shift_left + extra
        }
      } else if (movable_ord[i]) {
        shift_left <- min(overlap, left_room)
      } else if (movable_ord[i + 1L]) {
        shift_right <- min(overlap, right_room)
      }

      if (shift_left > 0) x_adj[i] <- x_adj[i] - shift_left
      if (shift_right > 0) x_adj[i + 1L] <- x_adj[i + 1L] + shift_right
      if (shift_left > 0 || shift_right > 0) changed <- TRUE
    }

    x_adj <- pmin(upper, pmax(lower, x_adj))

    if (n > 1L) {
      for (i in 2:n) {
        if (x_adj[i] <= x_adj[i - 1L]) {
          x_adj[i] <- min(upper[i], x_adj[i - 1L] + 1e-6)
        }
      }
      for (i in seq.int(n - 1L, 1L)) {
        if (x_adj[i] >= x_adj[i + 1L]) {
          x_adj[i] <- max(lower[i], x_adj[i + 1L] - 1e-6)
        }
      }
    }

    if (!changed) break
  }

  x_adj[inv]
}

#' Graficar barras apiladas (100%) con canvas opcional y exportación
#'
#' Construye un gráfico de **barras apiladas horizontales** normalizadas a 100% por categoría.
#' El insumo esperado es un `data.frame` en formato **ancho** con:
#' una columna de categorías (`var_categoria`), una columna de base (`var_n`) y varias columnas
#' de porcentajes (`cols_porcentaje`). Las columnas de porcentaje pueden venir como proporción
#' (`0–1`) o como porcentaje (`0–100`), controlado por `escala_valor`.
#'
#' La función convierte a formato largo, **normaliza** cada fila a suma 1, aplica un **cierre exacto**
#' para corregir residuos numéricos (ajustando el último segmento del stack), y luego grafica con
#' `geom_col()`. Las etiquetas de porcentaje internas se asignan de forma **exacta** para que, con los
#' decimales definidos, la suma sea 100.0/100.00/etc. por barra.
#'
#' En modo estándar (`usar_canvas = FALSE`) se devuelve un `ggplot` convencional con título/subtítulo
#' y leyenda inferior (si corresponde). En modo `usar_canvas = TRUE` se arma un **canvas** con
#' `cowplot` que separa placeholders internos (encabezado, etiquetas Y, panel de barras, columna extra,
#' leyenda y caption), permitiendo un control fino del layout (útil para exportación a PPT).
#'
#' Además, se puede agregar una columna de **barra extra** (por defecto, N) o indicadores tipo
#' `top2box`, `top3box` o `bottom2box` a partir de los segmentos apilados.
#'
#' Desde esta versión, el repelido de etiquetas pequenas es configurable: se puede ajustar el
#' detector de colisión (ancho estimado), el padding mínimo, el número de iteraciones, el sesgo
#' izquierda/derecha y un modo **confinado por segmento** para que las etiquetas no crucen a
#' segmentos vecinos ni se salgan visualmente de su barra. Además, `etiquetas_uniformes = TRUE`
#' activa un modo opt-in sin split `peq/grande`, con sesgo de empuje hacia el centro para
#' reducir choques. Por compatibilidad, el comportamiento legacy se mantiene cuando
#' `etiquetas_uniformes = FALSE` (default).
#'
#' @param data `data.frame` o `tibble` en formato ancho con columnas de categorías, base y porcentajes.
#' @param var_categoria Nombre de la columna categórica (eje Y).
#' @param var_etiqueta_categoria Columna opcional con la etiqueta visible de cada categoría.
#' @param var_n Nombre de la columna base (por ejemplo, N por categoría).
#' @param cols_porcentaje Vector con los nombres de columnas de porcentajes (segmentos apilados).
#' @param etiquetas_grupos Vector nombrado que mapea `cols_porcentaje` → etiqueta visible de cada segmento.
#'   Sus `names()` deben coincidir con `cols_porcentaje`.
#'
#' @param escala_valor Indica la escala de los porcentajes en `cols_porcentaje`:
#'   `"proporcion_1"` para `0–1` o `"proporcion_100"` para `0–100`.
#' @param colores_grupos Vector de colores opcional (idealmente nombrado por etiqueta final).
#' @param mostrar_valores Si `TRUE`, dibuja etiquetas internas de porcentaje.
#' @param decimales Decimales para etiquetas de porcentaje internas.
#' @param umbral_etiqueta Umbral mínimo de proporción para usar una etiqueta de tamano normal.
#'   Se mantiene por compatibilidad y actúa como alias de `umbral_etiqueta_normal`.
#' @param umbral_etiqueta_peq Umbral mínimo de proporción para mostrar una etiqueta pequena.
#'   Se mantiene por compatibilidad y actúa como alias de `umbral_mostrar_etiqueta`.
#' @param umbral_mostrar_etiqueta Umbral mínimo de proporción para mostrar cualquier etiqueta interna.
#'   Los valores por debajo de este umbral no se etiquetan.
#' @param umbral_etiqueta_normal Umbral mínimo de proporción para usar una etiqueta de tamano normal.
#'   Los valores entre `umbral_mostrar_etiqueta` y este umbral se muestran como etiquetas pequenas.
#'
#' @param mostrar_barra_extra Si `TRUE`, dibuja una columna extra a la derecha (por defecto, basada en `var_n`).
#' @param barra_extra_preset Tipo de barra/indicador extra: `"ninguno"`, `"totales"`, `"top2box"`, `"top3box"` o `"bottom2box"`.
#' @param prefijo_barra_extra Prefijo del texto extra (por ejemplo, `"N = "`).
#' @param titulo_barra_extra Título de la columna extra en el canvas.
#'
#' @param titulo,subtitulo,nota_pie Textos del encabezado y caption (izquierda).
#' @param nota_pie_derecha Texto adicional para caption (derecha), concatenado cuando corresponda.
#' @param pos_titulo Alineación del encabezado: `"centro"`, `"izquierda"` o `"derecha"`.
#' @param pos_nota_pie Alineación del caption: `"derecha"`, `"izquierda"` o `"centro"`.
#' @param centro_cowplot Centro horizontal opcional para leyenda en canvas (coordenadas npc).
#'
#' @param color_titulo,size_titulo,color_subtitulo,size_subtitulo,color_nota_pie,size_nota_pie
#'   Estilos de texto del encabezado y caption.
#' @param color_leyenda,size_leyenda Estilos de texto de leyenda.
#' @param color_texto_barras,size_texto_barras,size_texto_barras_peq Estilos de etiquetas internas.
#' @param etiquetas_uniformes Si `TRUE`, activa modo uniforme de etiquetas:
#'   no separa entre etiquetas grandes/pequenas, usa un único umbral de visibilidad
#'   (`umbral_mostrar_etiqueta` efectivo) y aplica el repelido con sesgo hacia el centro.
#' @param repeler_etiquetas_peq Si `TRUE`, intenta separar horizontalmente las etiquetas pequenas
#'   cuando se superponen, manteniendolas cerca de su centro original. En modo uniforme,
#'   este repelido se aplica a todas las etiquetas visibles.
#' @param desplazamiento_max_etiquetas_peq Corrimiento horizontal maximo permitido para etiquetas
#'   pequenas, en la escala `0-1` de la barra normalizada.
#' @param etiquetas_peq_factor_ancho Multiplicador del ancho estimado de etiquetas pequenas para
#'   detectar colisiones. Valores mayores a `1` vuelven el detector más conservador y tienden a
#'   separar mejor textos como `2%`, `4%`, `5%`.
#' @param etiquetas_peq_padding Espacio horizontal mínimo adicional entre etiquetas pequenas
#'   (escala `0-1` de la barra).
#' @param etiquetas_peq_max_iter Número máximo de iteraciones del algoritmo de repelido.
#' @param etiquetas_peq_sesgo_derecha Sesgo de ajuste cuando dos etiquetas pequenas chocan.
#'   `0.5` reparte el movimiento de forma equilibrada; valores mayores desplazan más la etiqueta
#'   de la derecha (útil cuando se desea “empujar hacia adentro”).
#' @param etiquetas_peq_confinadas Si `TRUE`, las etiquetas pequenas solo se mueven dentro de su
#'   propio segmento apilado y no pueden cruzar a segmentos vecinos.
#' @param etiquetas_peq_margen_interno Margen de seguridad dentro del segmento cuando
#'   `etiquetas_peq_confinadas = TRUE`, para evitar textos pegados al borde.
#' @param color_barra_extra,size_barra_extra,size_titulo_extra Estilos de la columna extra.
#' @param color_ejes,size_ejes Estilos de las etiquetas de categorías (dibujadas en canvas).
#' @param color_titulos_grupo,size_titulos_grupo Estilos para títulos de bloque izquierdo en canvas.
#' @param color_fondo Color de fondo (útil en exportación).
#'
#' @param grosor_barras Grosor manual de barras en `geom_col()`.
#' @param extra_derecha_rel Espacio extra al lado derecho cuando no se usa canvas y hay barra extra.
#' @param espacio_izquierda_rel Espacio relativo al lado izquierdo cuando no se usa canvas.
#' @param ancho_max_eje_y Ancho de wrap para etiquetas de categorías (requiere `stringr`).
#'
#' @param mostrar_leyenda Si `TRUE`, incluye leyenda (en no-canvas: abajo; en canvas: placeholder propio).
#' @param invertir_leyenda Si `TRUE`, invierte el orden de la leyenda.
#' @param invertir_barras Si `TRUE`, invierte el orden de categorías.
#' @param invertir_segmentos Si `TRUE`, invierte el orden del stack (segmentos).
#' @param textos_negrita Vector con tokens para forzar negrita por componente (por ejemplo,
#'   `"titulo"`, `"leyenda"`, `"porcentajes"`/`"valores"`, `"eje_y"`, `"barra_extra"`).
#'
#' @param usar_canvas Si `TRUE`, arma el gráfico con `cowplot` en placeholders internos.
#' @param var_grupo_id,var_grupo_titulo Columnas opcionales para agrupar categorías en bloques
#'   y dibujar un título por bloque en el canvas.
#' @param canvas_w_grupo,canvas_w_buf_grupo_etq Ancho relativo de la columna de bloque y su
#'   separación respecto a las etiquetas del cruce.
#' @param canvas_gap_grupos Separación vertical adicional entre bloques, expresada en “altos de fila”.
#' @param canvas_w_etiquetas,canvas_w_buf_etq_bars,canvas_w_buf_bars_extra,canvas_w_bars,canvas_w_extra
#'   Anchos relativos de columnas del canvas (etiquetas, buffers, panel, extra).
#' @param canvas_h_header_in,canvas_h_legend_in,canvas_h_caption_in,canvas_h_panel_in,canvas_h_toprow_in
#'   Alturas relativas (en pulgadas “virtuales”) para encabezado, panel, leyenda, caption y fila superior.
#' @param canvas_min_filas Mínimo de filas virtuales cuando `usar_canvas = TRUE`.
#'   Sirve para mantener alineación y grosor visual consistente entre gráficos
#'   con una sola barra y gráficos con múltiples barras.
#' @param canvas_pad_bars_y_in Padding vertical (in) dentro del placeholder del panel de barras (top/bottom).
#'
#' @param grosor_modo `"manual"` o `"auto"` para ajustar grosor según número de categorías.
#' @param grosor_barras_mult Multiplicador adicional para grosor en modo auto.
#'
#' @param legend_key_cm Tamaño de “key” de la leyenda.
#' @param legend_espaciado Espaciado lateral del texto de leyenda (pt).
#' @param legend_n_por_fila Número de ítems por fila en la leyenda.
#'
#' @param encabezado_desplazamiento_in Ajuste vertical del encabezado (in).
#' @param encabezado_separacion_in Separación vertical entre título y subtítulo (in).
#' @param leyenda_desplazamiento_in Ajuste vertical de la leyenda (in).
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de depuración de placeholders del canvas.
#' @param debug_ph_col,debug_ph_lwd Color y grosor de bordes de depuración.
#'
#' @param exportar Tipo de salida: `"rplot"` (devuelve el objeto), `"png"`, `"ppt"` o `"word"`.
#' @param path_salida Ruta de salida para exportaciones no-`rplot`.
#' @param ancho,alto Dimensiones (en pulgadas) para exportación.
#' @param alto_por_categoria Altura sugerida por categoría para el cálculo de panel en canvas.
#' @param dpi Resolución para PNG.
#'
#' @param ppt_append Si `TRUE` y el archivo existe, agrega una diapositiva; si no, crea un nuevo PPT.
#' @param ppt_layout,ppt_master Layout y master para la diapositiva en exportación a PPT.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto `ggplot` (en no-canvas) o un objeto `cowplot`
#'   (en canvas). En otros modos, exporta el archivo y retorna invisiblemente el gráfico.
#'
#' @examples
#' \dontrun{
#' p <- graficar_barras_apiladas(
#'   data = df_wide,
#'   var_categoria = "pregunta",
#'   var_n = "n_base",
#'   cols_porcentaje = c("pct_1","pct_2","pct_3"),
#'   etiquetas_grupos = c(pct_1="Sí", pct_2="No", pct_3="NS/NP"),
#'   usar_canvas = TRUE,
#'   exportar = "ppt",
#'   path_salida = "salida.pptx"
#' )
#' }
#' @family graficador
#' @export
graficar_barras_apiladas <- function(
    data,
    var_categoria,
    var_etiqueta_categoria = NULL,
    var_n,
    cols_porcentaje,
    etiquetas_grupos,
    escala_valor          = c("proporcion_1", "proporcion_100"),
    colores_grupos        = NULL,
    mostrar_valores       = TRUE,
    decimales             = 0,
    umbral_etiqueta       = 0.001,
    umbral_etiqueta_peq   = NULL,
    umbral_mostrar_etiqueta = NULL,
    umbral_etiqueta_normal  = NULL,
    mostrar_barra_extra   = TRUE,
    barra_extra_preset    = c("ninguno", "totales", "top2box", "top3box", "bottom2box"),
    prefijo_barra_extra   = NULL,
    titulo_barra_extra    = NULL,
    titulo                = NULL,
    subtitulo             = NULL,
    nota_pie              = NULL,
    nota_pie_derecha      = NULL,
    pos_titulo            = c("centro", "izquierda", "derecha"),
    pos_nota_pie          = c("derecha", "izquierda", "centro"),
    centro_cowplot        = NA_real_,

    # Estilo de texto y layout
    color_titulo          = "#000000",
    size_titulo           = 11,
    color_subtitulo       = "#000000",
    size_subtitulo        = 9,
    color_nota_pie        = "#000000",
    size_nota_pie         = 8,
    color_leyenda         = "#000000",
    size_leyenda          = 8,
    color_texto_barras    = "white",
    size_texto_barras     = 3,
    size_texto_barras_peq = NULL,
    etiquetas_uniformes   = FALSE,
    repeler_etiquetas_peq = TRUE,
    desplazamiento_max_etiquetas_peq = 0.05,
    etiquetas_peq_factor_ancho = 1,
    etiquetas_peq_padding = 0.003,
    etiquetas_peq_max_iter = 16L,
    etiquetas_peq_sesgo_derecha = 0.5,
    etiquetas_peq_confinadas = FALSE,
    etiquetas_peq_margen_interno = 0,
    color_barra_extra     = "#000000",
    size_barra_extra      = 3,
    size_titulo_extra     = 3,
    color_ejes            = "#000000",
    size_ejes             = 9,
    color_titulos_grupo   = NULL,
    size_titulos_grupo    = NULL,
    color_fondo           = NA,

    grosor_barras         = 0.7,
    extra_derecha_rel     = 0.10,
    espacio_izquierda_rel = 0,
    ancho_max_eje_y       = NULL,

    mostrar_leyenda       = TRUE,
    invertir_leyenda      = FALSE,
    invertir_barras       = FALSE,
    invertir_segmentos    = FALSE,
    textos_negrita        = NULL,

    # ==========================
    # BOXES POR LABEL
    # ==========================
    top2box_labels     = NULL,  # ej: c("De acuerdo","Muy de acuerdo")
    top3box_labels     = NULL,  # ej: c("Algo de acuerdo","De acuerdo","Muy de acuerdo")
    bottom2box_labels  = NULL,   # ej: c("Nada de acuerdo","En desacuerdo")

    # ==========================
    # CANVAS CONTROLADO
    # ==========================
    usar_canvas           = FALSE,
    var_grupo_id          = NULL,
    var_grupo_titulo      = NULL,
    canvas_w_grupo        = 0,
    canvas_w_buf_grupo_etq= 0,
    canvas_gap_grupos     = 0,

    canvas_w_etiquetas      = 0.38,
    canvas_w_buf_etq_bars   = 0.00,
    canvas_w_buf_bars_extra = 0.00,
    canvas_w_bars           = 0.52,
    canvas_w_extra          = 0.10,

    canvas_h_header_in    = 0.75,
    canvas_h_legend_in    = 0.75,
    canvas_h_caption_in   = 0.40,
    canvas_h_panel_in     = NULL,
    canvas_h_panel_in_min = 0,
    canvas_h_toprow_in    = 0.18,
    canvas_min_filas      = 2L,
    canvas_pad_bars_y_in  = 0.12,

    # ==========================
    # CONTROL DE GROSOR
    # ==========================
    grosor_modo           = c("manual", "auto"),
    grosor_barras_mult    = 1.00,

    # ==========================
    # LEYENDA
    # ==========================
    legend_key_cm         = 0.30,
    legend_espaciado      = 0.20,
    legend_n_por_fila     = 6L,

    # ==========================
    # AJUSTES POSICIONALES
    # ==========================
    encabezado_desplazamiento_in = 0,
    encabezado_separacion_in     = 0.14,
    leyenda_desplazamiento_in    = 0,

    # ==========================
    # DEBUG PH
    # ==========================
    debug_ph_bordes       = FALSE,
    debug_ph_col          = "#FF00FF",
    debug_ph_lwd          = 0.6,

    # ==========================
    # EXPORTAR
    # ==========================
    exportar              = c("rplot", "png", "ppt", "word"),
    path_salida           = NULL,
    ancho                 = 10,
    alto                  = 6,
    alto_por_categoria    = NULL,
    dpi                   = 300,

    ppt_append            = TRUE,
    ppt_layout            = "Blank",
    ppt_master            = "Office Theme"
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y
  hjust_from_pos <- function(x) switch(x, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 0.5)
  normalizar_umbral_prop <- function(x, nombre, default = NULL) {
    if (is.null(x)) return(default)
    x_num <- suppressWarnings(as.numeric(x)[1])
    if (!is.finite(x_num) || is.na(x_num)) {
      stop(sprintf("`%s` debe ser numerico finito.", nombre), call. = FALSE)
    }
    if (x_num < 0 || x_num > 1) {
      stop(sprintf("`%s` debe estar en escala 0-1.", nombre), call. = FALSE)
    }
    x_num
  }

  # deps
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("dplyr", quietly = TRUE))  stop("Requiere dplyr.", call. = FALSE)
  if (!requireNamespace("tidyr", quietly = TRUE))  stop("Requiere tidyr.", call. = FALSE)
  if (!requireNamespace("grid", quietly = TRUE))   stop("Requiere grid.", call. = FALSE)

  escala_valor       <- match.arg(escala_valor)
  exportar           <- match.arg(exportar)
  barra_extra_preset <- match.arg(barra_extra_preset)
  pos_titulo         <- match.arg(pos_titulo)
  pos_nota_pie       <- match.arg(pos_nota_pie)
  grosor_modo        <- match.arg(grosor_modo)


  # normalizaciones
  decimales <- suppressWarnings(as.integer(decimales))
  if (length(decimales) < 1L || !is.finite(decimales[1]) || decimales[1] < 0L) decimales <- 0L else decimales <- decimales[1]
  size_texto_barras_peq <- size_texto_barras_peq %||% size_texto_barras
  etiquetas_uniformes <- isTRUE(etiquetas_uniformes)
  repeler_etiquetas_peq <- isTRUE(repeler_etiquetas_peq)
  desplazamiento_max_etiquetas_peq <- suppressWarnings(as.numeric(desplazamiento_max_etiquetas_peq)[1])
  if (!is.finite(desplazamiento_max_etiquetas_peq) || is.na(desplazamiento_max_etiquetas_peq) || desplazamiento_max_etiquetas_peq < 0) {
    desplazamiento_max_etiquetas_peq <- 0.05
  }
  etiquetas_peq_factor_ancho <- suppressWarnings(as.numeric(etiquetas_peq_factor_ancho)[1])
  if (!is.finite(etiquetas_peq_factor_ancho) || is.na(etiquetas_peq_factor_ancho) || etiquetas_peq_factor_ancho <= 0) {
    etiquetas_peq_factor_ancho <- 1
  }
  etiquetas_peq_padding <- suppressWarnings(as.numeric(etiquetas_peq_padding)[1])
  if (!is.finite(etiquetas_peq_padding) || is.na(etiquetas_peq_padding) || etiquetas_peq_padding < 0) {
    etiquetas_peq_padding <- 0.003
  }
  etiquetas_peq_max_iter <- suppressWarnings(as.integer(etiquetas_peq_max_iter)[1])
  if (!is.finite(etiquetas_peq_max_iter) || is.na(etiquetas_peq_max_iter) || etiquetas_peq_max_iter < 1L) {
    etiquetas_peq_max_iter <- 16L
  }
  etiquetas_peq_sesgo_derecha <- suppressWarnings(as.numeric(etiquetas_peq_sesgo_derecha)[1])
  if (!is.finite(etiquetas_peq_sesgo_derecha) || is.na(etiquetas_peq_sesgo_derecha)) {
    etiquetas_peq_sesgo_derecha <- 0.5
  }
  etiquetas_peq_sesgo_derecha <- max(0, min(1, etiquetas_peq_sesgo_derecha))
  etiquetas_peq_confinadas <- isTRUE(etiquetas_peq_confinadas)
  etiquetas_peq_margen_interno <- suppressWarnings(as.numeric(etiquetas_peq_margen_interno)[1])
  if (!is.finite(etiquetas_peq_margen_interno) || is.na(etiquetas_peq_margen_interno) || etiquetas_peq_margen_interno < 0) {
    etiquetas_peq_margen_interno <- 0
  }
  umbral_etiqueta_legacy <- normalizar_umbral_prop(
    if (missing(umbral_etiqueta)) NULL else umbral_etiqueta,
    "umbral_etiqueta",
    default = NULL
  )
  umbral_etiqueta_peq_legacy <- normalizar_umbral_prop(
    if (missing(umbral_etiqueta_peq)) NULL else umbral_etiqueta_peq,
    "umbral_etiqueta_peq",
    default = NULL
  )
  umbral_mostrar_etiqueta <- normalizar_umbral_prop(
    if (missing(umbral_mostrar_etiqueta)) NULL else umbral_mostrar_etiqueta,
    "umbral_mostrar_etiqueta",
    default = NULL
  )
  umbral_etiqueta_normal <- normalizar_umbral_prop(
    if (missing(umbral_etiqueta_normal)) NULL else umbral_etiqueta_normal,
    "umbral_etiqueta_normal",
    default = NULL
  )

  usa_umbrales_explicitos <- !is.null(umbral_mostrar_etiqueta) || !is.null(umbral_etiqueta_normal)
  if (usa_umbrales_explicitos) {
    umbral_mostrar_etiqueta_eff <- umbral_mostrar_etiqueta %||% umbral_etiqueta_peq_legacy %||% 0.001
    umbral_etiqueta_normal_eff  <- umbral_etiqueta_normal %||% umbral_etiqueta_legacy %||% umbral_mostrar_etiqueta_eff
  } else {
    umbral_etiqueta_normal_eff  <- umbral_etiqueta_legacy %||% 0.001
    umbral_mostrar_etiqueta_eff <- umbral_etiqueta_peq_legacy %||% umbral_etiqueta_normal_eff
  }
  if (umbral_mostrar_etiqueta_eff > umbral_etiqueta_normal_eff) {
    stop(
      "`umbral_mostrar_etiqueta`/`umbral_etiqueta_peq` no puede ser mayor que `umbral_etiqueta_normal`/`umbral_etiqueta`.",
      call. = FALSE
    )
  }

  hjust_titulo  <- hjust_from_pos(pos_titulo)
  hjust_caption <- hjust_from_pos(pos_nota_pie)

  textos_negrita <- textos_negrita %||% character(0)
  if ("valores" %in% textos_negrita && !("porcentajes" %in% textos_negrita)) {
    textos_negrita <- c(textos_negrita, "porcentajes")
  }

  pulso_azul  <- "#002768"
  pulso_verde <- "#5BAF31"

  # validaciones
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (is.null(var_etiqueta_categoria)) var_etiqueta_categoria <- var_categoria
  if (!var_etiqueta_categoria %in% names(data)) stop("`var_etiqueta_categoria` no existe en `data`.", call. = FALSE)
  if (!var_n %in% names(data))         stop("`var_n` no existe en `data`.", call. = FALSE)
  if (!all(cols_porcentaje %in% names(data))) {
    faltan <- cols_porcentaje[!cols_porcentaje %in% names(data)]
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }
  if (!all(names(etiquetas_grupos) %in% cols_porcentaje)) {
    stop("Los names de `etiquetas_grupos` deben coincidir con `cols_porcentaje`.", call. = FALSE)
  }
  usar_grupos_canvas <- isTRUE(usar_canvas) &&
    is.character(var_grupo_id) && length(var_grupo_id) == 1L && nzchar(trimws(var_grupo_id))
  if (usar_grupos_canvas) {
    var_grupo_id <- trimws(var_grupo_id)
    if (!var_grupo_id %in% names(data)) stop("`var_grupo_id` no existe en `data`.", call. = FALSE)
    if (!is.character(var_grupo_titulo) || length(var_grupo_titulo) != 1L || !nzchar(trimws(var_grupo_titulo))) {
      stop("`var_grupo_titulo` debe ser character(1) no vacío cuando se usa `var_grupo_id`.", call. = FALSE)
    }
    var_grupo_titulo <- trimws(var_grupo_titulo)
    if (!var_grupo_titulo %in% names(data)) stop("`var_grupo_titulo` no existe en `data`.", call. = FALSE)
  } else {
    var_grupo_id     <- NULL
    var_grupo_titulo <- NULL
  }
  color_titulos_grupo <- color_titulos_grupo %||% color_ejes
  size_titulos_grupo  <- size_titulos_grupo  %||% size_ejes

  df <- data
  cat_map <- df |>
    dplyr::mutate(
      .cat_id    = as.character(.data[[var_categoria]]),
      .cat_label = as.character(.data[[var_etiqueta_categoria]])
    ) |>
    dplyr::mutate(
      .cat_label = ifelse(is.na(.data$.cat_label), "", .data$.cat_label),
      .group_id = if (!is.null(var_grupo_id)) as.character(.data[[var_grupo_id]]) else NA_character_,
      .group_title = if (!is.null(var_grupo_titulo)) as.character(.data[[var_grupo_titulo]]) else NA_character_
    ) |>
    dplyr::select(".cat_id", ".cat_label", ".group_id", ".group_title") |>
    dplyr::distinct(.data$.cat_id, .keep_all = TRUE)

  # ---------------------------------------------------------------------------
  # 1) Ancho -> Largo
  # ---------------------------------------------------------------------------
  df_long <- df |>
    dplyr::select(dplyr::all_of(c(var_categoria, var_n, cols_porcentaje))) |>
    tidyr::pivot_longer(
      cols      = dplyr::all_of(cols_porcentaje),
      names_to  = ".col_pct",
      values_to = ".valor"
    ) |>
    dplyr::mutate(.grupo = dplyr::recode(.data$.col_pct, !!!etiquetas_grupos))

  if (!is.numeric(df_long$.valor)) stop("Las columnas de porcentaje deben ser numéricas.", call. = FALSE)

  df_long$.valor_plot <- if (escala_valor == "proporcion_100") df_long$.valor / 100 else df_long$.valor
  df_long$.valor_plot[!is.finite(df_long$.valor_plot) | is.na(df_long$.valor_plot)] <- 0

  # Normalizar por categoría a suma 1
  df_long <- df_long |>
    dplyr::group_by(.data[[var_categoria]]) |>
    dplyr::mutate(
      .suma_raw   = sum(.valor_plot, na.rm = TRUE),
      .valor_plot = dplyr::if_else(.suma_raw > 0, .valor_plot / .suma_raw, 0)
    ) |>
    dplyr::ungroup()

  # Blindaje
  df_long$.valor_plot <- pmax(0, pmin(1, df_long$.valor_plot))

  # Orden de segmentos (DEBE IR ANTES del cierre exacto)
  niveles_originales <- unname(etiquetas_grupos)
  niveles_stack      <- if (invertir_segmentos) niveles_originales else rev(niveles_originales)
  niveles_leyenda    <- if (invertir_leyenda)  rev(niveles_originales) else niveles_originales
  df_long$.grupo     <- factor(df_long$.grupo, levels = niveles_stack)

  # ---------------------------------------------------------------------------
  # 1.05) CIERRE EXACTO A 1
  # Ajusta SOLO el ÚLTIMO del stack (derecha) para absorber residuo numérico.
  # ---------------------------------------------------------------------------
  target_level <- tail(niveles_stack, 1)

  df_long <- df_long |>
    dplyr::group_by(.data[[var_categoria]]) |>
    dplyr::mutate(
      .sum1  = sum(.valor_plot, na.rm = TRUE),
      .delta = 1 - .sum1,
      .valor_plot = dplyr::if_else(
        .data$.grupo == target_level,
        .valor_plot + .delta,
        .valor_plot
      ),
      .valor_plot = pmax(0, .valor_plot)
    ) |>
    dplyr::mutate(
      .sum2 = sum(.valor_plot, na.rm = TRUE),
      .valor_plot = dplyr::if_else(.sum2 > 0, .valor_plot / .sum2, 0)
    ) |>
    dplyr::ungroup() |>
    dplyr::select(-.sum1, -.delta, -.sum2)

  # ---------------------------------------------------------------------------
  # 1.1) ORDEN MASTER de categorías (FIJO)
  # ---------------------------------------------------------------------------
  cat_lvls <- unique(as.character(cat_map$.cat_id))
  if (invertir_barras) cat_lvls <- rev(cat_lvls)

  cat_layout <- cat_map[match(cat_lvls, cat_map$.cat_id), , drop = FALSE]
  rownames(cat_layout) <- NULL
  n_categorias <- length(cat_lvls)
  plot_cat_lvls <- cat_lvls

  min_filas_canvas <- suppressWarnings(as.integer(canvas_min_filas)[1])
  if (!is.finite(min_filas_canvas) || is.na(min_filas_canvas) || min_filas_canvas < 1L) {
    min_filas_canvas <- 1L
  }

  usar_y_numerico <- isTRUE(usar_canvas)
  y_axis_max <- max(1, n_categorias)
  if (usar_y_numerico) {
    gap_grupos_eff <- if (isTRUE(usar_grupos_canvas)) suppressWarnings(as.numeric(canvas_gap_grupos)) else 0
    if (!is.finite(gap_grupos_eff) || is.na(gap_grupos_eff) || gap_grupos_eff < 0) gap_grupos_eff <- 0

    y_from_top <- numeric(n_categorias)
    offset_top <- 0
    for (i in seq_len(n_categorias)) {
      y_from_top[i] <- offset_top
      offset_top <- offset_top + 1
      if (i < n_categorias) {
        grp_i <- cat_layout$.group_id[i] %||% ""
        grp_n <- cat_layout$.group_id[i + 1] %||% ""
        if (!identical(grp_i, grp_n)) offset_top <- offset_top + gap_grupos_eff
      }
    }
    max_from_top_obs <- if (length(y_from_top)) max(y_from_top) else 0
    filas_obs <- max_from_top_obs + 1
    if (!is.finite(filas_obs) || is.na(filas_obs) || filas_obs < 1) filas_obs <- 1

    # Reservar al menos `canvas_min_filas` filas virtuales evita que un gráfico
    # con una sola categoría se vea desalineado o demasiado delgado.
    y_axis_max <- max(filas_obs, if (isTRUE(usar_canvas)) min_filas_canvas else 1)
    y_shift <- (y_axis_max - filas_obs) / 2
    cat_layout$.y_plot <- ((max_from_top_obs - y_from_top) + 1) + y_shift
    df_long$.y_plot <- cat_layout$.y_plot[match(as.character(df_long[[var_categoria]]), cat_layout$.cat_id)]
  } else {
    cat_chr  <- as.character(df_long[[var_categoria]])
    # En ejes discretos, ggplot dibuja el ultimo nivel arriba. Invertimos los
    # levels de ploteo para que el primer elemento de `cat_lvls` quede arriba,
    # igual que en el modo con y numerico (grupos canvas).
    plot_cat_lvls <- rev(cat_lvls)
    df_long[[var_categoria]] <- factor(cat_chr, levels = plot_cat_lvls)
    cat_layout$.y_plot <- match(cat_layout$.cat_id, plot_cat_lvls)
    y_axis_max <- max(1, n_categorias)
  }

  # ---------------------------------------------------------------------------
  # 1.5) Grosor de barras
  # ---------------------------------------------------------------------------
  n_categorias_grosor <- if (isTRUE(usar_canvas)) max(n_categorias, min_filas_canvas) else n_categorias
  if (grosor_modo == "auto") {
    grosor_eff <- .auto_bar_width_apiladas(
      n_categorias = n_categorias_grosor,
      grosor_barras_mult = grosor_barras_mult,
      usar_grupos_canvas = usar_grupos_canvas
    )
  } else {
    grosor_eff <- grosor_barras
  }

  # ---------------------------------------------------------------------------
  # 2) BARRAS
  # ---------------------------------------------------------------------------
  max_suma <- 1
  x_max_bars <- if (usar_canvas) 1 else if (mostrar_barra_extra) max_suma * (1 + extra_derecha_rel) else max_suma

  expand_x <- if (usar_canvas) {
    ggplot2::expansion(mult = c(0, 0), add = c(0, 0))
  } else {
    ggplot2::expansion(mult = c(espacio_izquierda_rel, 0.05))
  }

  p_bars <- ggplot2::ggplot(
    df_long,
    ggplot2::aes(
      x    = .data$.valor_plot,
      y    = if (usar_y_numerico) .data$.y_plot else .data[[var_categoria]],
      fill = .data$.grupo
    )
  ) +
    ggplot2::geom_col(width = grosor_eff, orientation = "y") +
    ggplot2::scale_x_continuous(expand = expand_x) +
    {
      if (usar_y_numerico) {
        ggplot2::scale_y_continuous(
          breaks = cat_layout$.y_plot,
          labels = rep("", n_categorias),
          limits = c(0.5, y_axis_max + 0.5),
          expand = ggplot2::expansion(mult = c(0, 0), add = c(0, 0))
        )
      } else {
        ggplot2::scale_y_discrete(
          limits = plot_cat_lvls, drop = FALSE,
          expand = ggplot2::expansion(mult = c(0, 0), add = c(0, 0))
        )
      }
    } +
    ggplot2::coord_cartesian(
      xlim = c(0, x_max_bars),
      clip = "off"
    ) +
    ggplot2::theme_minimal(base_size = 9) +
    ggplot2::theme(
      panel.grid.major = ggplot2::element_blank(),
      panel.grid.minor = ggplot2::element_blank(),
      axis.title       = ggplot2::element_blank(),
      axis.text.x      = ggplot2::element_blank(),
      axis.ticks.x     = ggplot2::element_blank(),
      legend.position  = "none",
      axis.text.y      = ggplot2::element_blank(),
      axis.ticks.y     = ggplot2::element_blank(),
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.margin      = ggplot2::margin(0,0,0,0)
    )

  # ---------------------------------------------------------------------------
  # 3) Etiquetas internas (%) con asignación exacta (suma 100.00 si decimales=2, etc.)
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_valores)) {

    niveles_fill       <- levels(df_long$.grupo)
    niveles_stack_real <- rev(niveles_fill)

    df_lab <- df_long |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::arrange(factor(.grupo, levels = niveles_stack_real), .by_group = TRUE) |>
      dplyr::mutate(
        x_right = cumsum(.valor_plot),
        x_left = x_right - .valor_plot,
        x_center = x_left + .valor_plot / 2
      ) |>
      dplyr::ungroup()

    .asignar_pct_exacto <- function(p, dec) {
      p[is.na(p) | !is.finite(p)] <- 0
      s <- sum(p)
      if (s <= 0) return(rep.int(0L, length(p)))
      p <- p / s

      escala <- 10^dec
      target_units <- as.integer(100L * escala)

      x_units <- p * target_units
      base <- floor(x_units)
      resto <- target_units - sum(base)

      if (resto > 0L) {
        frac <- x_units - base
        idx <- order(frac, decreasing = TRUE)
        base[idx[seq_len(resto)]] <- base[idx[seq_len(resto)]] + 1L
      }
      as.integer(base)
    }

    .fmt_units_pct <- function(units, dec){
      escala <- 10^dec
      val <- units / escala
      out <- format(val, nsmall = dec, trim = TRUE, scientific = FALSE)
      paste0(out, "%")
    }

    df_lab <- df_lab |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::mutate(
        .pct_units = .asignar_pct_exacto(.valor_plot, decimales),
        lab        = .fmt_units_pct(.pct_units, decimales)
      ) |>
      dplyr::ungroup()

    if (isTRUE(etiquetas_uniformes)) {
      df_lab <- df_lab |>
        dplyr::mutate(
          .mostrar = .valor_plot >= umbral_mostrar_etiqueta_eff,
          .size_label = size_texto_barras,
          x_label = x_center
        ) |>
        dplyr::filter(.mostrar, is.finite(x_center))

      if (isTRUE(repeler_etiquetas_peq) &&
          desplazamiento_max_etiquetas_peq > 0 &&
          nrow(df_lab) > 1L) {
        idx_por_cat <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        for (idx in idx_por_cat) {
          if (length(idx) < 2L) next
          df_lab$x_label[idx] <- .repel_label_positions_apiladas(
            x = df_lab$x_center[idx],
            labels = df_lab$lab[idx],
            label_size = df_lab$.size_label[idx],
            movable = rep(TRUE, length(idx)),
            max_shift = desplazamiento_max_etiquetas_peq,
            x_min = if (etiquetas_peq_confinadas) df_lab$x_left[idx] else 0,
            x_max = if (etiquetas_peq_confinadas) df_lab$x_right[idx] else 1,
            padding = etiquetas_peq_padding,
            max_iter = etiquetas_peq_max_iter,
            bias_right = etiquetas_peq_sesgo_derecha,
            edge_margin = if (etiquetas_peq_confinadas) etiquetas_peq_margen_interno else 0,
            width_factor = etiquetas_peq_factor_ancho,
            bias_toward_center = TRUE
          )
        }
      }

      if (nrow(df_lab) > 0) {
        p_bars <- p_bars +
          ggplot2::geom_text(
            data    = df_lab,
            mapping = ggplot2::aes(
              x = x_label,
              y = if (usar_y_numerico) .data$.y_plot else .data[[var_categoria]],
              label = lab
            ),
            color   = color_texto_barras,
            size    = size_texto_barras,
            fontface = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
            inherit.aes = FALSE
          )
      }
    } else {
      df_lab <- df_lab |>
        dplyr::mutate(
          .tamano_etq = dplyr::case_when(
            .valor_plot >= umbral_etiqueta_normal_eff  ~ "grande",
            .valor_plot >= umbral_mostrar_etiqueta_eff ~ "peq",
            TRUE                                        ~ "ninguna"
          ),
          .size_label = dplyr::if_else(.tamano_etq == "grande", size_texto_barras, size_texto_barras_peq),
          x_label = x_center
        ) |>
        dplyr::filter(.tamano_etq != "ninguna", is.finite(x_center))

      if (isTRUE(repeler_etiquetas_peq) &&
          desplazamiento_max_etiquetas_peq > 0 &&
          nrow(df_lab) > 1L &&
          any(df_lab$.tamano_etq == "peq")) {
        idx_por_cat <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        for (idx in idx_por_cat) {
          if (length(idx) < 2L) next
          df_lab$x_label[idx] <- .repel_label_positions_apiladas(
            x = df_lab$x_center[idx],
            labels = df_lab$lab[idx],
            label_size = df_lab$.size_label[idx],
            movable = df_lab$.tamano_etq[idx] == "peq",
            max_shift = desplazamiento_max_etiquetas_peq,
            x_min = if (etiquetas_peq_confinadas) df_lab$x_left[idx] else 0,
            x_max = if (etiquetas_peq_confinadas) df_lab$x_right[idx] else 1,
            padding = etiquetas_peq_padding,
            max_iter = etiquetas_peq_max_iter,
            bias_right = etiquetas_peq_sesgo_derecha,
            edge_margin = if (etiquetas_peq_confinadas) etiquetas_peq_margen_interno else 0,
            width_factor = etiquetas_peq_factor_ancho
          )
        }
      }

      df_lab_grande <- df_lab[df_lab$.tamano_etq == "grande", , drop = FALSE]
      df_lab_peq    <- df_lab[df_lab$.tamano_etq == "peq",    , drop = FALSE]

      if (nrow(df_lab_grande) > 0) {
        p_bars <- p_bars +
          ggplot2::geom_text(
            data    = df_lab_grande,
            mapping = ggplot2::aes(
              x = x_label,
              y = if (usar_y_numerico) .data$.y_plot else .data[[var_categoria]],
              label = lab
            ),
            color   = color_texto_barras,
            size    = size_texto_barras,
            fontface = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
            inherit.aes = FALSE
          )
      }
      if (nrow(df_lab_peq) > 0) {
        p_bars <- p_bars +
          ggplot2::geom_text(
            data    = df_lab_peq,
            mapping = ggplot2::aes(
              x = x_label,
              y = if (usar_y_numerico) .data$.y_plot else .data[[var_categoria]],
              label = lab
            ),
            color   = color_texto_barras,
            size    = size_texto_barras_peq,
            fontface = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
            inherit.aes = FALSE
          )
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 4) Colores + leyenda (para extraer grob) — con separación horizontal REAL
  # ---------------------------------------------------------------------------
  wrap_fun <- NULL
  if (requireNamespace("stringr", quietly = TRUE)) wrap_fun <- function(x) stringr::str_wrap(x, width = 40)

  if (!is.null(colores_grupos)) {
    if (is.null(names(colores_grupos))) colores_grupos <- stats::setNames(colores_grupos, niveles_originales)
    valores_leyenda <- colores_grupos[niveles_leyenda]
    p_bars <- p_bars +
      ggplot2::scale_fill_manual(
        breaks = niveles_leyenda,
        values = valores_leyenda,
        labels = if (!is.null(wrap_fun)) wrap_fun else ggplot2::waiver()
      )
  } else {
    p_bars <- p_bars +
      ggplot2::scale_fill_discrete(
        breaks = niveles_leyenda,
        labels = if (!is.null(wrap_fun)) wrap_fun else ggplot2::waiver()
      )
  }

  n_items_leyenda <- length(niveles_leyenda)
  n_por_fila <- as.integer(legend_n_por_fila)
  if (!is.finite(n_por_fila) || n_por_fila < 1L) n_por_fila <- 6L

  p_for_legend <- p_bars +
    ggplot2::theme(
      legend.position = "bottom",
      legend.title    = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain",
        margin = ggplot2::margin(l = legend_espaciado/2, r = legend_espaciado/2, unit = "pt")
      ),

      legend.key.width  = grid::unit(legend_key_cm, "cm"),
      legend.key.height = grid::unit(legend_key_cm, "cm"),

      legend.key.spacing.x = grid::unit(0.10, "cm"),

      plot.margin = ggplot2::margin(0, 0, 0, 0)
    ) +
    ggplot2::guides(
      fill = ggplot2::guide_legend(
        byrow = TRUE,
        ncol  = n_por_fila,
        keywidth  = grid::unit(legend_key_cm, "cm"),
        keyheight = grid::unit(legend_key_cm, "cm")
      )
    )

  # ---------------------------------------------------------------------------
  # 5) Etiquetas Y y extra como texto (sin ggplot)
  # ---------------------------------------------------------------------------
  etiquetas_vec <- cat_layout$.cat_label
  if (!is.null(ancho_max_eje_y)) {
    if (!requireNamespace("stringr", quietly = TRUE)) stop("Para `ancho_max_eje_y` se requiere stringr.", call. = FALSE)
    etiquetas_vec <- stringr::str_wrap(etiquetas_vec, width = ancho_max_eje_y)
  }

  df_wide_extra <- df |>
    dplyr::select(dplyr::all_of(c(var_categoria, var_n, cols_porcentaje))) |>
    dplyr::mutate(valor_extra = .data[[var_n]])

  prefijo_extra_int     <- prefijo_barra_extra %||% ""
  titulo_extra_int      <- titulo_barra_extra
  color_barra_extra_int <- color_barra_extra
  fontface_barra_extra  <- if ("barra_extra" %in% textos_negrita) "bold" else "plain"

  if (barra_extra_preset != "ninguno") {
    if (barra_extra_preset == "totales") {
      if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "Total"
      if (is.null(prefijo_barra_extra)) prefijo_extra_int <- "N = "
      if (is.null(color_barra_extra))   color_barra_extra_int <- pulso_azul
      fontface_barra_extra <- "bold"
    } else {

      base_mat <- df_wide_extra[, cols_porcentaje, drop = FALSE]
      if (escala_valor == "proporcion_100") base_mat <- base_mat / 100

      # labels disponibles por columna: names(etiquetas_grupos)=cols, values=labels
      .cols_from_labels <- function(labels_sel, etiquetas_grupos, cols_porcentaje) {
        if (is.null(labels_sel) || !length(labels_sel)) return(character(0))
        labels_sel <- trimws(as.character(labels_sel))
        hit <- names(etiquetas_grupos)[as.character(etiquetas_grupos) %in% labels_sel]
        hit <- hit[hit %in% cols_porcentaje]
        unique(hit)
      }

      # defaults: prioriza categorías sustantivas y excluye especiales
      .default_top2 <- function(cols_porcentaje, etiquetas_grupos) {
        .default_box_cols(cols_porcentaje, etiquetas_grupos, n = 2L, side = "top")
      }
      .default_top3 <- function(cols_porcentaje, etiquetas_grupos) {
        .default_box_cols(cols_porcentaje, etiquetas_grupos, n = 3L, side = "top")
      }
      .default_bottom2 <- function(cols_porcentaje, etiquetas_grupos) {
        .default_box_cols(cols_porcentaje, etiquetas_grupos, n = 2L, side = "bottom")
      }

      if (barra_extra_preset == "top2box") {

        cols_sel <- .cols_from_labels(top2box_labels, etiquetas_grupos, cols_porcentaje)
        if (!length(cols_sel)) cols_sel <- .default_top2(cols_porcentaje, etiquetas_grupos)

        df_wide_extra$valor_extra <- rowSums(as.matrix(base_mat[, cols_sel, drop = FALSE]), na.rm = TRUE)
        if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "TOP TWO BOX"

      } else if (barra_extra_preset == "top3box") {

        cols_sel <- .cols_from_labels(top3box_labels, etiquetas_grupos, cols_porcentaje)
        if (!length(cols_sel)) cols_sel <- .default_top3(cols_porcentaje, etiquetas_grupos)

        df_wide_extra$valor_extra <- rowSums(as.matrix(base_mat[, cols_sel, drop = FALSE]), na.rm = TRUE)
        if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "TOP THREE BOX"

      } else if (barra_extra_preset == "bottom2box") {

        cols_sel <- .cols_from_labels(bottom2box_labels, etiquetas_grupos, cols_porcentaje)
        if (!length(cols_sel)) cols_sel <- .default_bottom2(cols_porcentaje, etiquetas_grupos)

        df_wide_extra$valor_extra <- rowSums(as.matrix(base_mat[, cols_sel, drop = FALSE]), na.rm = TRUE)
        if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "BOTTOM TWO BOX"
      }

      df_wide_extra$valor_extra <- df_wide_extra$valor_extra * 100
      color_barra_extra_int <- pulso_verde
      fontface_barra_extra  <- "bold"
    }
  }

  .format_pct_clean <- function(x, dec){
    x_round <- round(x, dec)
    format(x_round, nsmall = dec, trim = TRUE, scientific = FALSE)
  }

  extra_map <- df_wide_extra |>
    dplyr::mutate(.cat_chr = as.character(.data[[var_categoria]])) |>
    dplyr::select(.cat_chr, valor_extra)

  extra_vals <- vapply(cat_lvls, function(cc) {
    vv <- extra_map$valor_extra[match(cc, extra_map$.cat_chr)]
    if (length(vv) == 0 || is.na(vv)) vv <- NA_real_
    vv
  }, numeric(1))

  extra_labels <- rep("", length(cat_lvls))
  if (isTRUE(mostrar_barra_extra)) {
    extra_labels <- if (barra_extra_preset %in% c("top2box", "top3box", "bottom2box")) {
      paste0(prefijo_extra_int, .format_pct_clean(extra_vals, decimales), "%")
    } else {
      paste0(prefijo_extra_int, format(extra_vals, big.mark = ",", scientific = FALSE, trim = TRUE))
    }
    extra_labels[!is.finite(extra_vals)] <- ""
  }

  # ---------------------------------------------------------------------------
  # 7) Caption (texto)
  # ---------------------------------------------------------------------------
  caption_text <- NULL
  if (!is.null(nota_pie) && nzchar(nota_pie) && !is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- paste0(nota_pie, "   ", nota_pie_derecha)
  } else if (!is.null(nota_pie) && nzchar(nota_pie)) {
    caption_text <- nota_pie
  } else if (!is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- nota_pie_derecha
  }

  # ---------------------------------------------------------------------------
  # 8) No canvas
  # ---------------------------------------------------------------------------
  if (!isTRUE(usar_canvas)) {
    out <- p_bars +
      ggplot2::theme(legend.position = if (mostrar_leyenda) "bottom" else "none") +
      ggplot2::labs(title = titulo, subtitle = subtitulo, caption = caption_text)

    if (exportar == "rplot") return(out)

    # EXPORT PNG / PPT / WORD (sin canvas): se exporta el ggplot directamente
    if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

    if (exportar == "png") {
      ggplot2::ggsave(filename = path_salida, plot = out, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
      return(invisible(out))
    }

    if (exportar %in% c("ppt", "word")) {
      if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
      if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg (dml).", call. = FALSE)

      if (exportar == "ppt") {
        doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
        doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
        doc <- officer::ph_with(
          doc,
          value = rvg::dml(ggobj = out),
          location = officer::ph_location_fullsize()
        )
        print(doc, target = path_salida)
        return(invisible(out))
      }

      if (exportar == "word") {
        doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
        doc <- officer::body_add_par(doc, value = "", style = "Normal")
        doc <- officer::body_add_dml(
          doc,
          value = rvg::dml(ggobj = out),
          width = ancho, height = alto
        )
        print(doc, target = path_salida)
        return(invisible(out))
      }
    }

    stop("Tipo de exportación no soportado.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # 9) CANVAS (cowplot)
  # ---------------------------------------------------------------------------
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Para `usar_canvas=TRUE` se requiere cowplot.", call. = FALSE)

  # barras “panel puro”
  p_bars_panel <- p_bars +
    ggplot2::theme_void() +
    ggplot2::theme(
      legend.position  = "none",
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      # Margen lateral para que etiquetas al borde no se corten visualmente.
      plot.margin      = ggplot2::margin(0, 4, 0, 4)
    )

  .ph_border <- function(x, y, w, h) {
    cowplot::draw_grob(
      grid::rectGrob(
        x = 0, y = 0, width = 1, height = 1,
        just = c("left", "bottom"),
        gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)
      ),
      x = x, y = y, width = w, height = h,
      hjust = 0, vjust = 0
    )
  }

  # alturas en pulgadas
  alto_por_cat_eff <- alto_por_categoria %||% 0.42
  n_filas_virtuales <- if (isTRUE(usar_canvas)) y_axis_max else max(1L, n_categorias)
  h_panel_in <- if (!is.null(canvas_h_panel_in) && is.finite(canvas_h_panel_in) && canvas_h_panel_in > 0) {
    canvas_h_panel_in
  } else {
    n_filas_virtuales * alto_por_cat_eff
  }

  # Mínimo configurable del panel (para Word, donde charts con 1 barra quedan muy chicos)
  panel_min <- suppressWarnings(as.numeric(canvas_h_panel_in_min))
  if (is.finite(panel_min) && panel_min > 0) {
    h_panel_in <- max(h_panel_in, panel_min)
  }

  has_header  <- (!is.null(titulo) && nzchar(titulo)) || (!is.null(subtitulo) && nzchar(subtitulo))
  has_legend  <- isTRUE(mostrar_leyenda) && length(niveles_leyenda) > 0
  has_caption <- !is.null(caption_text) && nzchar(caption_text)

  h_header_in  <- if (has_header)  canvas_h_header_in  else 0
  h_legend_in  <- if (has_legend)  canvas_h_legend_in  else 0
  h_caption_in <- if (has_caption) canvas_h_caption_in else 0

  h_total_in <- h_header_in + h_panel_in + h_legend_in + h_caption_in
  if (h_total_in <= 0) h_total_in <- 1

  header_h  <- h_header_in  / h_total_in
  panel_h   <- h_panel_in   / h_total_in
  legend_h  <- h_legend_in  / h_total_in
  caption_h <- h_caption_in / h_total_in

  y_header0  <- 1 - header_h
  y_panel0   <- y_header0 - panel_h
  y_legend0  <- y_panel0  - legend_h
  y_caption0 <- y_legend0 - caption_h

  # widths (6 columnas efectivas) — grupo + etiquetas + buffers + barras + extra
  w_group <- if (usar_grupos_canvas) canvas_w_grupo else 0
  w_buf0  <- if (usar_grupos_canvas) canvas_w_buf_grupo_etq else 0
  w_etq   <- canvas_w_etiquetas
  w_buf1  <- canvas_w_buf_etq_bars
  w_bars  <- canvas_w_bars
  w_buf2  <- canvas_w_buf_bars_extra
  w_extra <- canvas_w_extra

  w_sum <- w_group + w_buf0 + w_etq + w_buf1 + w_bars + w_buf2 + w_extra
  if (!is.finite(w_sum) || w_sum <= 0) w_sum <- 1

  w_group <- w_group / w_sum
  w_buf0  <- w_buf0  / w_sum
  w_etq   <- w_etq   / w_sum
  w_buf1  <- w_buf1  / w_sum
  w_bars  <- w_bars  / w_sum
  w_buf2  <- w_buf2  / w_sum
  w_extra <- w_extra / w_sum

  x_group0 <- 0
  x_buf00  <- x_group0 + w_group
  x_etq0   <- x_buf00 + w_buf0
  x_buf10  <- x_etq0 + w_etq
  x_bars0  <- x_buf10 + w_buf1
  x_buf20  <- x_bars0 + w_bars
  x_extra0 <- x_buf20 + w_buf2

  # top row (título del extra)
  top_in <- canvas_h_toprow_in %||% 0
  if (!is.finite(top_in) || is.na(top_in) || top_in < 0) top_in <- 0
  if (isTRUE(mostrar_barra_extra) && !is.null(titulo_extra_int) && nzchar(titulo_extra_int)) {
    # Reserva mínima para que el título de barra extra no quede comprimido.
    top_in <- max(top_in, (size_titulo_extra %||% 9) * 0.022)
  }
  top_in <- min(top_in, h_panel_in * 0.45)
  top_h  <- if (top_in > 0) top_in / h_total_in else 0

  main_h  <- panel_h - top_h
  y_top0  <- y_panel0 + main_h
  y_main0 <- y_panel0

  # leyenda grob
  leg_grob <- NULL
  if (has_legend) {
    leg_grob <- cowplot::get_legend(
      p_for_legend + ggplot2::theme(
        legend.position  = "bottom",
        legend.direction = "horizontal",
        legend.box       = "horizontal"
      )
    )
  }

  canvas <- cowplot::ggdraw()

  # ============================================================
  # HEADER: centrado + desplazamiento + separación
  # ============================================================
  if (has_header) {
    y_header_center <- y_header0 + (header_h * 0.5)
    dy_head <- encabezado_desplazamiento_in / h_total_in
    sep     <- encabezado_separacion_in     / h_total_in

    has_t <- (!is.null(titulo) && nzchar(titulo))
    has_s <- (!is.null(subtitulo) && nzchar(subtitulo))

    if (has_t && has_s) {
      y_title <- y_header_center + (sep * 0.5) + dy_head
      y_sub   <- y_header_center - (sep * 0.5) + dy_head
    } else if (has_t) {
      y_title <- y_header_center + dy_head
      y_sub   <- NA_real_
    } else {
      y_title <- NA_real_
      y_sub   <- y_header_center + dy_head
    }

    if (has_t) {
      canvas <- canvas + cowplot::draw_text(
        text  = titulo,
        x     = hjust_titulo,
        y     = y_title,
        hjust = hjust_titulo,
        vjust = 0.5,
        size  = size_titulo,
        colour= color_titulo,
        fontface = if ("titulo" %in% textos_negrita) "bold" else "plain"
      )
    }

    if (has_s) {
      canvas <- canvas + cowplot::draw_text(
        text  = subtitulo,
        x     = hjust_titulo,
        y     = y_sub,
        hjust = hjust_titulo,
        vjust = 0.5,
        size  = size_subtitulo,
        colour= color_subtitulo
      )
    }

    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_header0, 1, header_h)
  }

  # TOP ROW (título extra)
  if (top_h > 0) {

    if (debug_ph_bordes) {
      canvas <- canvas +
        .ph_border(x_group0, y_top0, w_group, top_h) +
        .ph_border(x_etq0,   y_top0, w_etq,   top_h) +
        .ph_border(x_bars0,  y_top0, w_bars,  top_h) +
        .ph_border(x_extra0, y_top0, w_extra, top_h)
    }

    if (isTRUE(mostrar_barra_extra) && !is.null(titulo_extra_int) && nzchar(titulo_extra_int)) {
      canvas <- canvas + cowplot::draw_text(
        text     = titulo_extra_int,
        x        = x_extra0 + (w_extra * 0.5),
        y        = y_top0 + (top_h * 0.5),
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_titulo_extra,
        colour   = color_barra_extra_int,
        fontface = "bold"
      )
    }
  }

  # ============================================================
  # MAIN ROW: sub-placeholders verticales (pad_top + bars_area + pad_bottom)
  # ============================================================

  # padding en pulgadas -> npc (respecto al alto total del canvas)
  pad_in <- canvas_pad_bars_y_in %||% 0
  if (!is.finite(pad_in) || is.na(pad_in) || pad_in < 0) pad_in <- 0
  pad_npc <- pad_in / h_total_in

  # clamp: no permitir que el padding "mate" el área útil
  pad_npc <- min(pad_npc, main_h * 0.45)

  # sub-PH
  y_padbot0 <- y_main0
  h_padbot  <- pad_npc

  y_bars_area0 <- y_padbot0 + h_padbot
  h_bars_area  <- main_h - 2 * pad_npc

  y_padtop0 <- y_bars_area0 + h_bars_area
  h_padtop  <- pad_npc

  # dibujar barras SOLO en el área útil
  if (h_bars_area > 0) {
    canvas <- canvas +
      cowplot::draw_plot(
        p_bars_panel,
        x = x_bars0, y = y_bars_area0,
        width = w_bars, height = h_bars_area
      )
  }

  # ============================================================
  # Y del panel: usar y.range NUMÉRICO del panel (estable)
  # ============================================================
  gb <- ggplot2::ggplot_build(p_bars_panel)

  pp <- gb$layout$panel_params[[1]]
  y_rng <- pp$y.range  # <- numérico (ej: c(0.5, n+0.5))

  if (!is.numeric(y_rng) || length(y_rng) != 2 || any(!is.finite(y_rng))) {
    # fallback ultra seguro
    y_rng <- c(0.5, max(cat_layout$.y_plot, na.rm = TRUE) + 0.5)
  }

  den <- diff(y_rng); if (!is.finite(den) || den <= 0) den <- 1
  if (usar_y_numerico) {
    y_npc <- (cat_layout$.y_plot - y_rng[1]) / den
  } else {
    y_centros <- cat_layout$.y_plot
    y_npc <- (y_centros - y_rng[1]) / den
  }
  y_npc <- pmax(0, pmin(1, y_npc))

  # llevar a coordenadas absolutas del canvas (área útil)
  y_abs <- y_bars_area0 + y_npc * h_bars_area
  cat_layout$.y_abs <- y_abs

  # debug: bordes del PH total + pads + área útil
  if (debug_ph_bordes) {
    # borde total (ya lo tienes abajo; si quieres, lo puedes dejar duplicado o remover el viejo)
    canvas <- canvas +
      .ph_border(x_bars0, y_main0,      w_bars, main_h) +
      .ph_border(x_bars0, y_padtop0,    w_bars, h_padtop) +
      .ph_border(x_bars0, y_bars_area0, w_bars, h_bars_area) +
      .ph_border(x_bars0, y_padbot0,    w_bars, h_padbot)
  }

  if (usar_grupos_canvas && w_group > 0) {
    group_df <- cat_layout |>
      dplyr::filter(!is.na(.data$.group_id) & nzchar(trimws(.data$.group_id))) |>
      dplyr::group_by(.data$.group_id) |>
      dplyr::summarise(
        .group_title = dplyr::first(.data$.group_title),
        y_min = min(.data$.y_abs, na.rm = TRUE),
        y_max = max(.data$.y_abs, na.rm = TRUE),
        .groups = "drop"
      )

    x_group_txt <- x_group0 + (w_group * 0.5)
    for (i in seq_len(nrow(group_df))) {
      title_i <- as.character(group_df$.group_title[i])
      if (is.na(title_i)) title_i <- ""
      if (!nzchar(trimws(title_i))) next
      canvas <- canvas + cowplot::draw_text(
        text     = title_i,
        x        = x_group_txt,
        y        = mean(c(group_df$y_min[i], group_df$y_max[i])),
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_titulos_grupo,
        colour   = color_titulos_grupo,
        fontface = "bold"
      )
    }
  }

  # Etiquetas (columna izquierda)
  pad_x <- 0.012
  x_lab <- x_etq0 + w_etq * (1 - pad_x)
  fontface_etq <- if ("eje_y" %in% textos_negrita) "bold" else "plain"

  for (i in seq_len(n_categorias)) {
    canvas <- canvas + cowplot::draw_text(
      text     = etiquetas_vec[i],
      x        = x_lab,
      y        = y_abs[i],
      hjust    = 1,
      vjust    = 0.5,
      size     = size_ejes,
      colour   = color_ejes,
      fontface = fontface_etq
    )
  }

  # Extra (columna derecha)
  x_extra_txt <- x_extra0 + (w_extra * 0.5)
  for (i in seq_len(n_categorias)) {
    if (nzchar(extra_labels[i])) {
      canvas <- canvas + cowplot::draw_text(
        text     = extra_labels[i],
        x        = x_extra_txt,
        y        = y_abs[i],
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_barra_extra,
        colour   = color_barra_extra_int,
        fontface = fontface_barra_extra
      )
    }
  }

  if (debug_ph_bordes) {
    canvas <- canvas +
      .ph_border(x_group0, y_main0, w_group, main_h) +
      .ph_border(x_buf00,  y_main0, w_buf0,  main_h) +
      .ph_border(x_etq0,   y_main0, w_etq,   main_h) +
      .ph_border(x_buf10,  y_main0, w_buf1,  main_h) +
      .ph_border(x_buf20,  y_main0, w_buf2,  main_h) +
      .ph_border(x_extra0, y_main0, w_extra, main_h)
  }

  # ============================================================
  # LEYENDA: centrada + desplazamiento
  # ============================================================
  if (has_legend && !is.null(leg_grob)) {

    # centro del placeholder de barras
    pos_leyenda_x <- x_bars0 + (w_bars * 0.5)
    if (!is.na(centro_cowplot) && is.finite(centro_cowplot)) pos_leyenda_x <- centro_cowplot

    y_legend_center <- y_legend0 + (legend_h * 0.5)
    dy_leg <- leyenda_desplazamiento_in / h_total_in

    leg_w_npc <- grid::convertWidth(sum(leg_grob$widths), "npc", valueOnly = TRUE)
    if (!is.finite(leg_w_npc) || leg_w_npc <= 0) leg_w_npc <- 1

    canvas <- canvas + cowplot::draw_grob(
      leg_grob,
      x = pos_leyenda_x,
      y = y_legend_center + dy_leg,
      width  = leg_w_npc,
      height = legend_h,
      hjust  = 0.5,
      vjust  = 0.5
    )

    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_legend0, 1, legend_h)
  }

  # CAPTION
  if (has_caption) {
    canvas <- canvas + cowplot::draw_text(
      text  = caption_text,
      x     = hjust_caption,
      y     = y_caption0 + (caption_h * 0.35),
      hjust = hjust_caption,
      vjust = 0.5,
      size  = size_nota_pie,
      colour= color_nota_pie
    )
    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_caption0, 1, caption_h)
  }

  # ---------------------------------------------------------------------------
  # 10) EXPORT
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") {
    attr(canvas, "alto_word_sugerido") <- h_total_in
    return(canvas)
  }

  if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

  if (exportar == "png") {
    ggplot2::ggsave(filename = path_salida, plot = canvas, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
    return(invisible(canvas))
  }

  if (exportar %in% c("ppt", "word")) {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg (dml).", call. = FALSE)

    if (exportar == "ppt") {
      doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
      doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
      doc <- officer::ph_with(
        doc,
        value = rvg::dml(ggobj = canvas),
        location = officer::ph_location_fullsize()
      )
      print(doc, target = path_salida)
      return(invisible(canvas))
    }

    if (exportar == "word") {
      doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
      doc <- officer::body_add_par(doc, value = "", style = "Normal")
      doc <- officer::body_add_dml(
        doc,
        value = rvg::dml(ggobj = canvas),
        width = ancho, height = alto
      )
      print(doc, target = path_salida)
      return(invisible(canvas))
    }
  }

  stop("Tipo de exportación no soportado.", call. = FALSE)
}
