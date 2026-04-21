# =============================================================================
# graficar_radar() — plot-ready estilo prosecnur (canvas + export) + TABLA DERECHA
# FIXES:
# A) PPT (rvg) NO ABORTA:
#    - En el objeto que va a rvg::dml() NO se usa geom_polygon() (ni en malla ni en fill)
#    - clip="on" + límites recalculados para que NADA quede fuera del viewport
#    - sanitización: se eliminan coords no finitas antes de dibujar
#
# B) TABLA (canvas):
#    - Auto-fit REAL (scale = min(w/gw, h/gh) * pad)
#    - Placeholder con clip=on para que nunca se salga
#    - Headers centrados (incluye 1ra celda) y cuerpo: 1ra col izquierda, demás centradas
# =============================================================================

#' Graficar radar comparativo con canvas, tabla derecha y exportación
#'
#' Construye un gráfico radar (spider chart) para comparar grupos sobre varios
#' ejes y, opcionalmente, compone una tabla de porcentajes en el lado derecho.
#' El insumo esperado es un `data.frame` en formato largo con una columna de eje,
#' una de grupo y una de valor.
#'
#' La función está preparada para flujo editorial en PPT/Word:
#' \itemize{
#'   \item modo estándar (`usar_canvas = FALSE`) para obtener un `ggplot` directo;
#'   \item modo canvas (`usar_canvas = TRUE`) para separar encabezado, panel,
#'   leyenda y pie con control fino de layout;
#'   \item exportación a `png`, `ppt` o `word` desde el mismo llamado.
#' }
#'
#' Para exportaciones vectoriales (`ppt`/`word`), aplica salvaguardas internas
#' de estabilidad (sanitización de coordenadas y límites seguros de viewport).
#'
#' @param data `data.frame` o `tibble` con columnas de eje, grupo y valor.
#' @param var_eje,var_grupo,var_valor Nombres de columnas para eje, serie/grupo y valor.
#'
#' @param escala_valor Escala de `var_valor`: `"proporcion_1"` (0-1) o
#'   `"proporcion_100"` (0-100).
#' @param limites Vector numérico de longitud 2 para límites radiales
#'   (`c(min, max)`). Si es `NULL`, se calcula automáticamente.
#' @param cortes_grilla Número de anillos de grilla.
#'
#' @param mostrar_tela Si `TRUE`, dibuja la malla poligonal de fondo.
#' @param mostrar_radios Si `TRUE`, dibuja radios desde el centro a cada eje.
#' @param mostrar_niveles Si `TRUE`, muestra etiquetas de nivel radial.
#'
#' @param wrap_ejes Ancho de wrapping para etiquetas de ejes.
#' @param eje_label_mult Multiplicador radial para separar etiquetas del borde.
#' @param radar_scale Escala general del radar dentro del panel (clamp interno).
#'
#' @param mostrar_puntos Si `TRUE`, dibuja puntos en cada vértice.
#' @param size_linea,size_punto Tamaños de líneas y puntos.
#' @param alpha_relleno Transparencia del relleno cuando `rellenar_poligono = TRUE`.
#' @param rellenar_poligono Si `TRUE`, rellena polígonos por grupo.
#'
#' @param etiquetas_series Vector nombrado para renombrar grupos en leyenda
#'   (`nombre_original = "Etiqueta final"`).
#' @param colores_series Vector nombrado de colores por etiqueta final de grupo.
#'
#' @param mostrar_leyenda Si `TRUE`, muestra la leyenda.
#' @param leyenda_posicion Posición de leyenda: `"abajo"` o `"derecha"`.
#' @param invertir_leyenda Si `TRUE`, invierte el orden visual de la leyenda.
#' @param legend_n_por_fila Ítems por fila de leyenda.
#' @param legend_key_cm Tamaño de key de leyenda (cm).
#' @param legend_espaciado Espaciado lateral del texto de leyenda (pt).
#' @param legend_key_spacing_x_cm Espaciado horizontal entre keys (cm).
#'
#' @param titulo,subtitulo,nota_pie Textos del gráfico.
#' @param pos_titulo,pos_nota_pie Alineación horizontal de encabezado y pie.
#' @param textos_negrita Tokens para forzar negrita (por ejemplo `"titulo"`,
#'   `"leyenda"`, `"ejes"`).
#' @param color_titulo,size_titulo,color_subtitulo,size_subtitulo
#'   Estilos de título/subtítulo.
#' @param color_nota_pie,size_nota_pie Estilos de pie.
#' @param color_leyenda,size_leyenda Estilos de texto de leyenda.
#' @param color_ejes,size_ejes Estilos de etiquetas de ejes.
#' @param color_grilla,color_radios Colores de malla y radios.
#' @param color_fondo Color de fondo del gráfico/canvas.
#'
#' @param mostrar_tabla_derecha Si `TRUE`, agrega tabla a la derecha del radar.
#' @param titulo_tabla Título de la primera columna de la tabla.
#' @param umbral_rojo_pct Umbral (%) para coloreado condicional en tabla.
#' @param tabla_digits Decimales para porcentajes en tabla.
#' @param tabla_header_fill,tabla_body_fill Colores de fondo en encabezado y cuerpo.
#' @param tabla_grid_col Color de líneas de la tabla.
#' @param tabla_text_blue Color principal de texto en tabla.
#' @param tabla_font_family Familia tipográfica para tabla.
#' @param tabla_header_size,tabla_body_size Tamaños de texto de encabezado/cuerpo.
#' @param tabla_firstcol_bold Si `TRUE`, pone negrita en primera columna.
#' @param tabla_firstcol_size Tamaño de texto de primera columna.
#' @param tabla_firstcol_wrap Wrapping de primera columna (caracteres).
#' @param tabla_firstcol_indent_npc Sangría horizontal de primera columna (npc).
#' @param tabla_padding_mm Padding interno de celdas (mm).
#' @param tabla_ph_ancho Ancho relativo del placeholder de tabla.
#' @param tabla_ph_gap Separación horizontal entre panel radar y tabla.
#' @param tabla_ph_margin_top,tabla_ph_margin_bot Márgenes verticales de tabla en canvas.
#' @param tabla_firstcol_frac Proporción de ancho de la primera columna.
#' @param tabla_wrap_header Wrapping de headers de columnas.
#' @param tabla_height_frac Altura relativa usada por la tabla dentro de su placeholder.
#' @param tabla_line_lwd Grosor de líneas de tabla.
#' @param tabla_auto_fit Si `TRUE`, autoajusta escala de tabla al placeholder.
#' @param tabla_fit_pad Factor de padding extra en autoajuste.
#' @param tabla_allow_upscale Si `TRUE`, permite escalar tabla hacia arriba.
#' @param tabla_clip Si `TRUE`, recorta tabla al placeholder para evitar desbordes.
#'
#' @param usar_canvas Si `TRUE`, compone encabezado/panel/leyenda/pie con `cowplot`.
#' @param canvas_h_header_in,canvas_h_legend_in,canvas_h_caption_in
#'   Alturas (in) de encabezado, leyenda y pie.
#' @param canvas_h_panel_in Altura (in) del panel. Si `NULL`, se estima.
#' @param alto_por_eje Alto sugerido (in) por eje para estimación de panel.
#' @param encabezado_desplazamiento_in Ajuste vertical del encabezado.
#' @param encabezado_separacion_in Separación vertical título/subtítulo.
#' @param leyenda_desplazamiento_in Ajuste vertical de la leyenda.
#' @param centro_cowplot Centro horizontal opcional para leyenda en canvas.
#' @param axis_iconos Lista nombrada \code{eje -> ruta_png} para íconos de eje.
#' @param icono_modo \code{"reemplazar"} oculta texto si hay ícono;
#'   \code{"acompanar"} deja texto + ícono.
#' @param icono_size_radar Escala relativa del ícono en ejes radar.
#' @param icono_color_radar Color opcional para tintar los PNG de íconos.
#' @param icono_color_leyenda_radar Color opcional para tintar los íconos de
#'   la leyenda del radar. Si es \code{NULL}, conserva el color original.
#' @param mostrar_leyenda_iconos Si \code{TRUE}, muestra bloque de leyenda de
#'   íconos cuando \code{icono_modo = "reemplazar"}.
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de depuración de placeholders.
#' @param debug_ph_col,debug_ph_lwd Color y grosor de bordes de depuración.
#'
#' @param exportar Tipo de salida: `"rplot"`, `"png"`, `"ppt"` o `"word"`.
#' @param path_salida Ruta de salida cuando `exportar != "rplot"`.
#' @param ancho,alto,dpi Dimensiones y resolución de exportación.
#' @param ppt_append Si `TRUE` y el archivo existe, agrega diapositiva/página.
#' @param ppt_layout,ppt_master Layout y master en exportación PPT.
#'
#' @param debug_ppt Si `TRUE`, usa ruta de exportación aislada para depuración de PPT.
#' @param debug_ppt_log Ruta del log de depuración cuando `debug_ppt = TRUE`.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto gráfico (`ggplot` o canvas
#'   de `cowplot`). En otros modos, exporta a archivo y retorna invisiblemente.
#'
#' @examples
#' \dontrun{
#' graficar_radar(
#'   data = df_radar,
#'   var_eje = "eje",
#'   var_grupo = "grupo",
#'   var_valor = "valor",
#'   escala_valor = "proporcion_100",
#'   titulo = "Radar comparativo",
#'   mostrar_tabla_derecha = TRUE
#' )
#' }
#'
#' @family graficador
#' @export
graficar_radar <- function(
    data,
    var_eje   = "eje",
    var_grupo = "grupo",
    var_valor = "valor",

    escala_valor  = c("proporcion_1", "proporcion_100"),
    limites       = NULL,
    cortes_grilla = 5L,

    mostrar_tela    = TRUE,
    mostrar_radios  = FALSE,
    mostrar_niveles = FALSE,

    wrap_ejes = 24,
    eje_label_mult = 1.06,
    radar_scale = 1,

    mostrar_puntos = TRUE,
    size_linea     = 0.9,
    alpha_relleno  = 0.18,
    size_punto     = 2.2,

    rellenar_poligono = FALSE,   # ojo: en PPT se forzará FALSE (segfault rvg+polygon)

    etiquetas_series = NULL,     # named: old -> new
    colores_series   = NULL,     # named por etiqueta final

    mostrar_leyenda   = TRUE,
    leyenda_posicion  = c("abajo", "derecha"),
    invertir_leyenda  = FALSE,
    legend_n_por_fila = 6L,

    legend_key_cm           = 0.35,
    legend_espaciado        = 0.25, # pt
    legend_key_spacing_x_cm = 0.10,

    titulo       = NULL,
    subtitulo    = NULL,
    nota_pie     = NULL,
    pos_titulo   = c("centro","izquierda","derecha"),
    pos_nota_pie = c("derecha","izquierda","centro"),
    textos_negrita = NULL,

    color_titulo    = "#004B8D",
    size_titulo     = 12,
    color_subtitulo = "#004B8D",
    size_subtitulo  = 9,
    color_nota_pie  = "#004B8D",
    size_nota_pie   = 8,
    color_leyenda   = "#004B8D",
    size_leyenda    = 8,

    color_ejes = "#004B8D",
    size_ejes  = 10,

    color_grilla = "#DDDDDD",
    color_radios = "#DDDDDD",
    color_fondo  = NA,

    # -------------------------------------------------------------------------
    # TABLA (derecha)
    # -------------------------------------------------------------------------
    mostrar_tabla_derecha = FALSE,
    titulo_tabla = "TOP TWO BOX",
    umbral_rojo_pct = 60,
    tabla_digits = 0L,

    tabla_header_fill = NA,
    tabla_body_fill   = NA,
    tabla_grid_col    = "#062A63",
    tabla_text_blue   = "#062A63",
    tabla_font_family = "Arial",

    tabla_header_size = 14,
    tabla_body_size   = 12,
    tabla_firstcol_bold = FALSE,
    tabla_firstcol_size = 11,
    tabla_firstcol_wrap = NULL,
    tabla_firstcol_indent_npc = 0.015,

    tabla_padding_mm = 3,

    tabla_ph_ancho = 0.40,
    tabla_ph_gap   = 0.03,
    tabla_ph_margin_top = 0.04,
    tabla_ph_margin_bot = 0.06,
    tabla_firstcol_frac = 0.55,
    tabla_wrap_header   = 14,
    tabla_height_frac   = 1,
    tabla_line_lwd      = 1.4,

    tabla_auto_fit = TRUE,
    tabla_fit_pad   = 0.98,
    tabla_allow_upscale = FALSE,
    tabla_clip      = TRUE,

    # -------------------------------------------------------------------------
    # CANVAS
    # -------------------------------------------------------------------------
    usar_canvas = FALSE,
    canvas_h_header_in  = 0.75,
    canvas_h_legend_in  = 0.75,
    canvas_h_caption_in = 0.40,
    canvas_h_panel_in   = NULL,
    alto_por_eje        = 0.32,
    encabezado_desplazamiento_in = 0,
    encabezado_separacion_in     = 0.14,
    leyenda_desplazamiento_in    = 0,
    centro_cowplot              = NA_real_,

    debug_ph_bordes = FALSE,
    debug_ph_col    = "#FF00FF",
    debug_ph_lwd    = 0.6,

    exportar    = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho       = 8.5,
    alto        = 6.5,
    dpi         = 300,

    ppt_append = TRUE,
    ppt_layout = "Blank",
    ppt_master = "Office Theme",

    # -------------------------------------------------------------------------
    # ÍCONOS
    # -------------------------------------------------------------------------
    axis_iconos   = NULL,   # named list: eje_label -> ruta PNG (NULL = sin icono)
    icono_modo    = c("reemplazar", "acompanar"),
    icono_size_radar = 0.12,  # fracción de lim_xy para radio del ícono
    icono_color_radar = NULL,
    icono_color_leyenda_radar = NULL,
    mostrar_leyenda_iconos = TRUE,

    # -------------------------------------------------------------------------
    # DEBUG PPT (callr / Rscript)
    # -------------------------------------------------------------------------
    debug_ppt = FALSE,
    debug_ppt_log = "radar_ppt_export_debug.log"
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y
  hjust_from_pos <- function(x) switch(x, "izquierda"=0, "centro"=0.5, "derecha"=1, 0.5)
  normalize_optional_color <- function(color, arg_name = "color") {
    if (exists(".dim_normalize_optional_color", mode = "function", inherits = TRUE)) {
      return(.dim_normalize_optional_color(color, arg_name = arg_name))
    }
    if (is.null(color)) return(NULL)
    color <- as.character(color)[1]
    if (is.na(color) || !nzchar(trimws(color))) {
      stop("`", arg_name, "` debe ser NULL o un color válido.", call. = FALSE)
    }
    ok <- !inherits(try(grDevices::col2rgb(color), silent = TRUE), "try-error")
    if (!ok) stop("`", arg_name, "` debe ser NULL o un color válido.", call. = FALSE)
    color
  }
  tint_icon_local <- function(img, tint_color = NULL) {
    if (exists(".dim_tint_icon", mode = "function", inherits = TRUE)) {
      return(.dim_tint_icon(img, tint_color = tint_color))
    }
    if (is.null(tint_color) || is.null(img)) return(img)
    d <- dim(img)
    if (is.null(d) || length(d) != 3L || d[3] < 3L) return(img)
    tint <- as.numeric(grDevices::col2rgb(tint_color)) / 255
    out <- img
    lum <- (0.2126 * img[, , 1]) + (0.7152 * img[, , 2]) + (0.0722 * img[, , 3])
    out[, , 1] <- pmax(0, pmin(1, tint[1] * lum))
    out[, , 2] <- pmax(0, pmin(1, tint[2] * lum))
    out[, , 3] <- pmax(0, pmin(1, tint[3] * lum))
    out
  }
  load_icon_radar <- function(path, tint_color = NULL) {
    if (exists(".dim_load_icon", mode = "function", inherits = TRUE)) {
      return(.dim_load_icon(path, tint_color = tint_color))
    }
    if (is.null(path) || !nzchar(as.character(path %||% ""))) return(NULL)
    path <- as.character(path)[1]
    if (!file.exists(path) || !requireNamespace("png", quietly = TRUE)) return(NULL)
    img <- tryCatch(png::readPNG(path), error = function(e) NULL)
    tint_icon_local(img, tint_color = tint_color)
  }

  textos_negrita <- textos_negrita %||% character(0)

  # deps base
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("dplyr", quietly = TRUE))  stop("Requiere dplyr.",  call. = FALSE)
  if (!requireNamespace("tidyr", quietly = TRUE))  stop("Requiere tidyr.",  call. = FALSE)
  if (!requireNamespace("grid", quietly = TRUE))   stop("Requiere grid.",   call. = FALSE)
  if (!requireNamespace("tibble", quietly = TRUE)) stop("Requiere tibble.", call. = FALSE)

  escala_valor     <- match.arg(escala_valor)
  exportar         <- match.arg(exportar)
  leyenda_posicion <- match.arg(leyenda_posicion)
  icono_modo       <- match.arg(icono_modo)
  icono_color_radar <- normalize_optional_color(icono_color_radar, arg_name = "icono_color_radar")
  icono_color_leyenda_radar <- normalize_optional_color(
    icono_color_leyenda_radar,
    arg_name = "icono_color_leyenda_radar"
  )
  mostrar_leyenda_iconos <- isTRUE(mostrar_leyenda_iconos)
  pos_titulo       <- match.arg(pos_titulo)
  pos_nota_pie     <- match.arg(pos_nota_pie)
  ppt_safe <- exportar %in% c("ppt","word", "rplot")

  if (!is.data.frame(data)) stop("`data` debe ser data.frame/tibble.", call. = FALSE)
  if (!all(c(var_eje, var_grupo, var_valor) %in% names(data))) {
    faltan <- setdiff(c(var_eje, var_grupo, var_valor), names(data))
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }

  # normalizaciones
  legend_n_por_fila <- suppressWarnings(as.integer(legend_n_por_fila))
  if (!is.finite(legend_n_por_fila) || legend_n_por_fila < 1L) legend_n_por_fila <- 6L

  legend_key_cm <- suppressWarnings(as.numeric(legend_key_cm))
  if (!is.finite(legend_key_cm) || legend_key_cm <= 0) legend_key_cm <- 0.35

  legend_espaciado <- suppressWarnings(as.numeric(legend_espaciado))
  if (!is.finite(legend_espaciado) || legend_espaciado < 0) legend_espaciado <- 0.25

  legend_key_spacing_x_cm <- suppressWarnings(as.numeric(legend_key_spacing_x_cm))
  if (!is.finite(legend_key_spacing_x_cm) || legend_key_spacing_x_cm < 0) legend_key_spacing_x_cm <- 0.10

  icono_size_radar <- suppressWarnings(as.numeric(icono_size_radar)[1])
  if (!is.finite(icono_size_radar) || is.na(icono_size_radar) || icono_size_radar <= 0) {
    stop("`icono_size_radar` debe ser numérico positivo.", call. = FALSE)
  }
  icono_size_radar <- max(0.02, min(0.80, icono_size_radar))

  cortes_grilla <- suppressWarnings(as.integer(cortes_grilla))
  if (!is.finite(cortes_grilla) || cortes_grilla < 2L) cortes_grilla <- 5L

  wrap_ejes <- suppressWarnings(as.integer(wrap_ejes))
  if (!is.finite(wrap_ejes) || wrap_ejes < 0L) wrap_ejes <- 24L

  eje_label_mult <- suppressWarnings(as.numeric(eje_label_mult))
  if (!is.finite(eje_label_mult) || eje_label_mult <= 0) eje_label_mult <- 1.06
  radar_scale <- suppressWarnings(as.numeric(radar_scale))
  if (!is.finite(radar_scale) || radar_scale <= 0) radar_scale <- 1
  radar_scale <- max(0.70, min(1.10, radar_scale))

  # clamps tabla
  tabla_header_size <- suppressWarnings(as.numeric(tabla_header_size))
  if (!is.finite(tabla_header_size) || tabla_header_size <= 0) tabla_header_size <- 14
  tabla_body_size <- suppressWarnings(as.numeric(tabla_body_size))
  if (!is.finite(tabla_body_size) || tabla_body_size <= 0) tabla_body_size <- 12
  tabla_firstcol_size <- suppressWarnings(as.numeric(tabla_firstcol_size))
  if (!is.finite(tabla_firstcol_size) || tabla_firstcol_size <= 0) tabla_firstcol_size <- 11
  tabla_firstcol_wrap <- suppressWarnings(as.integer(tabla_firstcol_wrap))
  if (length(tabla_firstcol_wrap) != 1L || is.na(tabla_firstcol_wrap) ||
      !is.finite(tabla_firstcol_wrap) || tabla_firstcol_wrap <= 0) {
    tabla_firstcol_wrap <- NA_integer_
  }
  tabla_firstcol_indent_npc <- suppressWarnings(as.numeric(tabla_firstcol_indent_npc))
  if (!is.finite(tabla_firstcol_indent_npc)) tabla_firstcol_indent_npc <- 0.015
  tabla_firstcol_indent_npc <- max(0, min(0.08, tabla_firstcol_indent_npc))
  tabla_padding_mm <- suppressWarnings(as.numeric(tabla_padding_mm))
  if (!is.finite(tabla_padding_mm) || tabla_padding_mm < 0) tabla_padding_mm <- 3
  tabla_height_frac <- suppressWarnings(as.numeric(tabla_height_frac))
  if (!is.finite(tabla_height_frac) || tabla_height_frac <= 0) tabla_height_frac <- 1
  tabla_height_frac <- max(0.60, min(1, tabla_height_frac))
  tabla_line_lwd <- suppressWarnings(as.numeric(tabla_line_lwd))
  if (!is.finite(tabla_line_lwd) || tabla_line_lwd <= 0) tabla_line_lwd <- 1.4
  tabla_fit_pad <- suppressWarnings(as.numeric(tabla_fit_pad))
  if (!is.finite(tabla_fit_pad) || tabla_fit_pad <= 0 || tabla_fit_pad > 1.2) tabla_fit_pad <- 0.98

  hjust_titulo  <- hjust_from_pos(pos_titulo)
  hjust_caption <- hjust_from_pos(pos_nota_pie)

  # ---------------------------------------------------------------------------
  # Helpers: tabla Top Two Box
  # ---------------------------------------------------------------------------

  # A) construir data.frame (texto) para la tabla
  .make_tabla_ttb_df <- function(df_plot, ejes, grupos, digits = 0L, titulo_left = "TOP TWO BOX") {
    digits <- suppressWarnings(as.integer(digits))
    if (!is.finite(digits) || digits < 0L) digits <- 0L

    wide <- df_plot |>
      dplyr::transmute(
        eje   = as.character(.data$.eje),
        grupo = as.character(.data$.grupo),
        valor = as.numeric(.data$.valor)
      ) |>
      tidyr::complete(eje = ejes, grupo = grupos, fill = list(valor = 0)) |>
      tidyr::pivot_wider(names_from = "grupo", values_from = "valor")

    fmt_pct <- function(x) {
      x <- suppressWarnings(as.numeric(x))
      x[!is.finite(x) | is.na(x)] <- 0
      p <- round(x * 100, digits)
      if (digits == 0L) sprintf("%.0f%%", p) else sprintf(paste0("%.", digits, "f%%"), p)
    }

    out <- as.data.frame(wide)
    out[[1]] <- as.character(out[[1]])
    for (j in 2:ncol(out)) out[[j]] <- fmt_pct(out[[j]])
    names(out)[1] <- titulo_left
    out
  }

  # B) construir grob con estilo (tableGrob)
  .make_table_grob_ttb_style <- function(
    tb,
    header_fill = "#062A63",
    header_text = "white",
    body_fill   = "#F2F2F2",
    grid_col    = "white",
    text_blue   = "#062A63",
    font_family = "Arial",
    header_size = 14,
    body_size   = 12,
    firstcol_bold = TRUE,
    firstcol_size = 11,
    firstcol_indent_npc = 0,
    highlight_threshold = 60,
    highlight_col = "red",
    padding_mm = 3,
    firstcol_frac = tabla_firstcol_frac,
    line_lwd = tabla_line_lwd
  ) {
    n_data <- nrow(tb)
    n_cols <- ncol(tb)

    firstcol_frac <- suppressWarnings(as.numeric(firstcol_frac))
    if (!is.finite(firstcol_frac)) firstcol_frac <- tabla_firstcol_frac
    firstcol_frac <- max(0.40, min(0.80, firstcol_frac))

    if ((is.na(header_fill) || identical(tolower(as.character(header_fill)[1]), "transparent")) &&
        identical(header_text, "white")) {
      header_text <- text_blue
    }
    if ((is.na(header_fill) || identical(tolower(as.character(header_fill)[1]), "transparent")) &&
        identical(as.character(grid_col)[1], "white")) {
      grid_col <- text_blue
    }

    if (requireNamespace("stringr", quietly=TRUE) && is.finite(tabla_wrap_header) && tabla_wrap_header > 0) {
      nms <- names(tb)
      if (length(nms) >= 2) {
        nms[-1] <- stringr::str_wrap(nms[-1], width = as.integer(tabla_wrap_header))
        names(tb) <- nms
      }
    }

    cell_text_grob <- function(label, x0, y0, w, h, x_npc, just, gp) {
      label <- as.character(label %||% "")
      grid::grobTree(
        grid::textGrob(
          label = label,
          x = grid::unit(x_npc, "npc"),
          y = grid::unit(0.5, "npc"),
          just = c(just, "center"),
          gp = gp
        ),
        vp = grid::viewport(
          x = grid::unit(x0, "npc"),
          y = grid::unit(y0, "npc"),
          width = grid::unit(w, "npc"),
          height = grid::unit(h, "npc"),
          just = c("left", "bottom"),
          clip = "on"
        )
      )
    }

    row_lines <- function(x) {
      x <- as.character(x)
      pmax(1L, lengths(strsplit(x, "\n", fixed = TRUE)))
    }

    header_units <- max(row_lines(names(tb))) * 1.0 + 0.20
    body_units <- rep(1, n_data)
    if (n_data > 0) {
      line_mat <- sapply(tb, row_lines)
      if (is.null(dim(line_mat))) line_mat <- matrix(line_mat, ncol = n_cols)
      body_units <- apply(line_mat, 1, max) * 1.0 + 0.20
    }
    row_units <- c(header_units, body_units)
    row_heights <- row_units / sum(row_units)
    row_bottoms <- 1 - cumsum(row_heights)

    if (n_cols >= 2) {
      rest <- (1 - firstcol_frac) / (n_cols - 1)
      col_widths <- c(firstcol_frac, rep(rest, n_cols - 1))
    } else {
      col_widths <- 1
    }
    col_lefts <- c(0, cumsum(col_widths))[seq_len(n_cols)]

    parse_pct <- function(x) suppressWarnings(as.numeric(gsub("%", "", x)))
    header_fill_use <- if (is.na(header_fill) || identical(tolower(as.character(header_fill)[1]), "transparent")) NA_character_ else as.character(header_fill)[1]
    body_fill_use <- if (is.na(body_fill) || identical(tolower(as.character(body_fill)[1]), "transparent")) NA_character_ else as.character(body_fill)[1]

    grobs <- list()

    if (!is.na(header_fill_use) && nzchar(header_fill_use)) {
      grobs[[length(grobs) + 1L]] <- grid::rectGrob(
        x = 0, y = row_bottoms[1], width = 1, height = row_heights[1],
        just = c("left", "bottom"),
        gp = grid::gpar(fill = header_fill_use, col = NA)
      )
    }

    if (n_data > 0 && !is.na(body_fill_use) && nzchar(body_fill_use)) {
      for (i in seq_len(n_data)) {
        grobs[[length(grobs) + 1L]] <- grid::rectGrob(
          x = 0, y = row_bottoms[i + 1L], width = 1, height = row_heights[i + 1L],
          just = c("left", "bottom"),
          gp = grid::gpar(fill = body_fill_use, col = NA)
        )
      }
    }

    # Horizontal lines only.
    y_edges <- c(1, row_bottoms)
    y_edges[length(y_edges)] <- max(0.001, y_edges[length(y_edges)])
    for (yy in y_edges) {
      grobs[[length(grobs) + 1L]] <- grid::segmentsGrob(
        x0 = grid::unit(0, "npc"), x1 = grid::unit(1, "npc"),
        y0 = grid::unit(yy, "npc"), y1 = grid::unit(yy, "npc"),
        gp = grid::gpar(col = grid_col, lwd = line_lwd)
      )
    }

    # Header.
    for (j in seq_len(n_cols)) {
      grobs[[length(grobs) + 1L]] <- cell_text_grob(
        label = names(tb)[j],
        x0 = col_lefts[j],
        y0 = row_bottoms[1],
        w = col_widths[j],
        h = row_heights[1],
        x_npc = if (j == 1) firstcol_indent_npc else 0.5,
        just = if (j == 1) "left" else "center",
        gp = grid::gpar(
          col = header_text,
          fontface = "bold",
          fontsize = header_size,
          fontfamily = font_family,
          lineheight = 0.95
        )
      )
    }

    # Body.
    for (i in seq_len(n_data)) {
      for (j in seq_len(n_cols)) {
        cell_label <- tb[[j]][i]
        cell_gp <- if (j == 1) {
          grid::gpar(
            col = text_blue,
            fontface = if (isTRUE(firstcol_bold)) "bold" else "plain",
            fontsize = firstcol_size,
            fontfamily = font_family,
            lineheight = 0.95
          )
        } else {
          val_num <- parse_pct(cell_label)
          grid::gpar(
            col = if (is.finite(val_num) && !is.na(val_num) && val_num <= highlight_threshold) highlight_col else text_blue,
            fontface = if (is.finite(val_num) && !is.na(val_num) && val_num <= highlight_threshold) "bold" else "plain",
            fontsize = body_size,
            fontfamily = font_family,
            lineheight = 0.95
          )
        }

        grobs[[length(grobs) + 1L]] <- cell_text_grob(
          label = cell_label,
          x0 = col_lefts[j],
          y0 = row_bottoms[i + 1L],
          w = col_widths[j],
          h = row_heights[i + 1L],
          x_npc = if (j == 1) firstcol_indent_npc else 0.5,
          just = if (j == 1) "left" else "center",
          gp = cell_gp
        )
      }
    }

    grid::grobTree(children = do.call(grid::gList, grobs))
  }

  .wrap_clip <- function(g) {
    grid::grobTree(
      g,
      vp = grid::viewport(
        x = 0.5, y = 0.5, width = 1, height = 1,
        just = c("center","center"),
        clip = "on"
      )
    )
  }

  # ---------------------------------------------------------------------------
  # 1) Preparar data plot-ready
  # ---------------------------------------------------------------------------
  df0 <- data |>
    dplyr::transmute(
      .eje   = as.character(.data[[var_eje]]),
      .grupo = as.character(.data[[var_grupo]]),
      .valor = suppressWarnings(as.numeric(.data[[var_valor]]))
    ) |>
    dplyr::filter(
      !is.na(.data$.eje), nzchar(.data$.eje),
      !is.na(.data$.grupo), nzchar(.data$.grupo)
    )

  if (!nrow(df0)) stop("`data` no tiene filas válidas para radar.", call. = FALSE)

  df0$.valor[!is.finite(df0$.valor) | is.na(df0$.valor)] <- 0
  if (escala_valor == "proporcion_100") df0$.valor <- df0$.valor / 100
  df0$.valor <- pmax(0, pmin(1, df0$.valor))

  if (!is.null(etiquetas_series) && length(etiquetas_series) > 0) {
    if (is.null(names(etiquetas_series))) stop("`etiquetas_series` debe ser nombrado: old -> new.", call. = FALSE)
    mp <- as.character(etiquetas_series)
    names(mp) <- as.character(names(etiquetas_series))
    df0$.grupo <- dplyr::recode(df0$.grupo, !!!mp)
  }

  ejes   <- unique(df0$.eje)
  grupos <- unique(df0$.grupo)

  if (length(ejes) < 3) stop("Radar requiere al menos 3 ejes.", call. = FALSE)
  if (length(grupos) < 1) stop("Radar requiere al menos 1 grupo.", call. = FALSE)

  df_plot <- df0 |>
    dplyr::mutate(
      .eje   = factor(.data$.eje,   levels = ejes),
      .grupo = factor(.data$.grupo, levels = grupos)
    ) |>
    tidyr::complete(.eje, .grupo, fill = list(.valor = 0)) |>
    dplyr::arrange(.grupo, .eje)

  # Límites radiales (escala real 0-1). Se definen antes de la geometría para
  # poder mapear el polígono al rango visual completo cuando hay piso > 0.
  if (is.null(limites)) {
    r_lim <- c(0, 1)
  } else {
    r_lim <- suppressWarnings(as.numeric(limites))
    if (length(r_lim) != 2 || any(!is.finite(r_lim))) r_lim <- c(0, 1)
    r_lim <- sort(r_lim)
    r_lim[1] <- max(0, r_lim[1])
    r_lim[2] <- min(1, r_lim[2])
    if (r_lim[2] <= r_lim[1]) r_lim <- c(0, 1)
  }

  # Convierte valor real al radio visual del radar (zoom radial).
  .map_r_to_plot <- function(r) {
    rr <- suppressWarnings(as.numeric(r))
    den <- r_lim[2] - r_lim[1]
    if (!is.finite(den) || den <= 0) return(rr)
    rr <- (rr - r_lim[1]) / den
    pmax(0, pmin(1, rr))
  }

  lab_ejes <- levels(df_plot$.eje)
  if (!is.null(wrap_ejes) && is.finite(wrap_ejes) && wrap_ejes > 0) {
    if (requireNamespace("stringr", quietly = TRUE)) {
      lab_ejes <- stringr::str_wrap(lab_ejes, width = as.integer(wrap_ejes))
    }
  }

  # ---------------------------------------------------------------------------
  # 2) Geometría (x,y)
  # ---------------------------------------------------------------------------
  K <- length(levels(df_plot$.eje))
  # Primer eje en la parte superior del radar.
  theta0 <- pi/2

  angle_tbl <- tibble::tibble(
    .eje = factor(levels(df_plot$.eje), levels = levels(df_plot$.eje)),
    .idx = seq_len(K),
    .ang = theta0 + 2*pi*(seq_len(K)-1)/K
  )

  df_xy <- df_plot |>
    dplyr::left_join(angle_tbl, by = ".eje") |>
    dplyr::mutate(
      .valor_plot = .map_r_to_plot(.data$.valor),
      x = .data$.valor_plot * radar_scale * cos(.data$.ang),
      y = .data$.valor_plot * radar_scale * sin(.data$.ang)
    )

  df_poly <- df_xy |>
    dplyr::arrange(.data$.grupo, .data$.idx) |>
    dplyr::group_by(.data$.grupo) |>
    dplyr::group_modify(function(g, ...) dplyr::bind_rows(g, g[1, , drop = FALSE])) |>
    dplyr::ungroup()

  # ---------------------------------------------------------------------------
  # 3) Límites radiales
  # ---------------------------------------------------------------------------
  rings <- unique(seq(r_lim[1], r_lim[2], length.out = cortes_grilla))
  rings_plot <- .map_r_to_plot(rings)
  ring_max_plot <- suppressWarnings(max(rings_plot, na.rm = TRUE))
  if (!is.finite(ring_max_plot) || ring_max_plot <= 0) ring_max_plot <- 1

  grid_df <- NULL
  if (isTRUE(mostrar_tela)) {
    grid_df <- lapply(seq_along(rings), function(i) {
      rr <- rings[i]
      rr_plot <- rings_plot[i]
      lvl <- angle_tbl |>
        dplyr::mutate(.r = rr, x = rr_plot * radar_scale * cos(.data$.ang), y = rr_plot * radar_scale * sin(.data$.ang)) |>
        dplyr::arrange(.data$.idx)
      dplyr::bind_rows(lvl, lvl[1, , drop = FALSE])
    }) |> dplyr::bind_rows()
  }

  axes_df <- NULL
  if (isTRUE(mostrar_radios)) {
    axes_df <- angle_tbl |>
      dplyr::mutate(x0 = 0, y0 = 0, x1 = ring_max_plot * radar_scale * cos(.data$.ang), y1 = ring_max_plot * radar_scale * sin(.data$.ang))
  }

  level_lab <- NULL
  if (isTRUE(mostrar_niveles)) level_lab <- tibble::tibble(.nivel = rings, x = rings_plot * radar_scale, y = 0)

  max_label_lines <- max(
    1L,
    vapply(
      strsplit(lab_ejes, "\n", fixed = TRUE),
      length,
      integer(1)
    )
  )
  # `eje_label_mult` debe poder acercar de verdad las etiquetas a las puntas.
  # Mantenemos solo un margen minimo respecto al radar ya escalado para evitar
  # que las etiquetas caigan dentro del poligono.
  min_label_gap <- 0.03 + (max_label_lines - 1L) * 0.01
  label_ring_mult <- max(eje_label_mult, radar_scale + min_label_gap)
  label_ring_mult <- min(label_ring_mult, 1.10)
  label_ring <- ring_max_plot * label_ring_mult
  lab_axes <- angle_tbl |>
    dplyr::mutate(
      eje = lab_ejes[.data$.idx],
      x   = label_ring * cos(.data$.ang),
      y   = label_ring * sin(.data$.ang),
      hjust = dplyr::case_when(
        cos(.data$.ang) > 0.25  ~ 0,
        cos(.data$.ang) < -0.25 ~ 1,
        TRUE                    ~ 0.5
      ),
      vjust = dplyr::case_when(
        sin(.data$.ang) > 0.55  ~ 1,
        sin(.data$.ang) < -0.55 ~ 0,
        TRUE                    ~ 0.5
      )
    )

  # ---------------------------------------------------------------------------
  # 4) Paleta
  # ---------------------------------------------------------------------------
  pal <- NULL
  if (!is.null(colores_series)) {
    cs <- as.character(colores_series)
    if (is.null(names(cs))) {
      cs <- cs[seq_len(min(length(cs), length(grupos)))]
      cs <- stats::setNames(cs, as.character(grupos)[seq_along(cs)])
    } else {
      names(cs) <- trimws(as.character(names(cs)))
    }
    g_chr <- as.character(grupos)
    pal <- cs[g_chr]
    if (all(is.na(pal)) || length(pal) == 0) pal <- NULL
  } else if (requireNamespace("scales", quietly = TRUE)) {
    pal <- stats::setNames(scales::hue_pal()(length(grupos)), as.character(grupos))
  }

  # ---------------------------------------------------------------------------
  # 5) Plot (base)
  # ---------------------------------------------------------------------------
  leg_pos <- if (!isTRUE(mostrar_leyenda)) "none" else if (leyenda_posicion == "derecha") "right" else "bottom"

  p <- ggplot2::ggplot() +
    ggplot2::theme_minimal(base_size = 9) +
    ggplot2::theme(
      panel.grid       = ggplot2::element_blank(),
      axis.title       = ggplot2::element_blank(),
      axis.text        = ggplot2::element_blank(),
      axis.ticks       = ggplot2::element_blank(),
      plot.margin      = ggplot2::margin(0,0,0,0),
      panel.spacing    = grid::unit(0, "pt"),
      legend.position  = leg_pos,
      legend.title     = ggplot2::element_blank(),
      legend.text      = ggplot2::element_text(
        color  = color_leyenda,
        size   = size_leyenda,
        margin = ggplot2::margin(l = legend_espaciado/2, r = legend_espaciado/2, unit = "pt")
      ),
      legend.key.width      = grid::unit(legend_key_cm, "cm"),
      legend.key.height     = grid::unit(legend_key_cm, "cm"),
      legend.key.spacing.x  = grid::unit(legend_key_spacing_x_cm, "cm"),
      plot.title = ggplot2::element_text(
        color = color_titulo, size = size_titulo,
        face  = if ("titulo" %in% textos_negrita) "bold" else "plain",
        hjust = hjust_titulo
      ),
      plot.subtitle = ggplot2::element_text(
        color = color_subtitulo, size = size_subtitulo,
        face  = if ("subtitulo" %in% textos_negrita) "bold" else "plain",
        hjust = hjust_titulo
      ),
      plot.caption = ggplot2::element_text(
        color = color_nota_pie, size = size_nota_pie,
        face  = if ("nota_pie" %in% textos_negrita) "bold" else "plain",
        hjust = hjust_caption
      ),
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA)
    ) +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie)

  # ---------------------------------------------------------------------------
  # Capas “normales” (para rplot/png/word).
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_tela) && !is.null(grid_df)) {

    grid_df2 <- grid_df |>
      dplyr::filter(is.finite(.data$x), is.finite(.data$y), !is.na(.data$x), !is.na(.data$y))

    if (ppt_safe) {
      # Importante: Es PPT SAFE, NO polygon (evita C_polygon segfault)
      p <- p + ggplot2::geom_path(
        data = grid_df2,
        ggplot2::aes(x = .data$x, y = .data$y, group = .data$.r),
        color = color_grilla, linewidth = 0.5
      )
    } else {
      p <- p + ggplot2::geom_polygon(
        data = grid_df2,
        ggplot2::aes(x = .data$x, y = .data$y, group = .data$.r),
        fill = NA, color = color_grilla, linewidth = 0.5
      )
    }
  }
  if (isTRUE(mostrar_radios) && !is.null(axes_df)) {
    p <- p + ggplot2::geom_segment(
      data = axes_df,
      ggplot2::aes(x = .data$x0, y = .data$y0, xend = .data$x1, yend = .data$y1),
      color = color_radios, linewidth = 0.5
    )
  }
  if (isTRUE(rellenar_poligono)) {
    p <- p + ggplot2::geom_polygon(
      data = df_poly,
      ggplot2::aes(x = .data$x, y = .data$y, group = .data$.grupo, fill = .data$.grupo),
      color = NA, alpha = alpha_relleno
    )
  }

  p <- p + ggplot2::geom_path(
    data = df_poly,
    ggplot2::aes(x = .data$x, y = .data$y, group = .data$.grupo, color = .data$.grupo),
    linewidth = size_linea
  )

  if (isTRUE(mostrar_puntos)) {
    p <- p + ggplot2::geom_point(
      data = df_xy,
      ggplot2::aes(x = .data$x, y = .data$y, color = .data$.grupo),
      size = size_punto
    )
  }

  # --- Íconos en ejes -------------------------------------------------------
  has_iconos_radar <- is.list(axis_iconos) && any(
    vapply(axis_iconos, function(x) !is.null(x) && nzchar(as.character(x %||% "")), logical(1))
  )

  # En modo "reemplazar", filtrar del texto los ejes que tienen ícono
  lab_axes_text <- lab_axes
  if (has_iconos_radar && identical(icono_modo, "reemplazar")) {
    eje_orig_levels <- levels(df_plot$.eje)
    has_icon_vec <- vapply(eje_orig_levels, function(lbl) {
      ico <- axis_iconos[[lbl]]
      !is.null(ico) && nzchar(as.character(ico %||% ""))
    }, logical(1))
    ejes_sin_icono <- eje_orig_levels[!has_icon_vec]
    lab_axes_text <- lab_axes[lab_axes$eje %in% stringr::str_wrap(ejes_sin_icono, width = wrap_ejes), ]
  }

  draw_axis_labels_external <- isTRUE(usar_canvas)
  if (!draw_axis_labels_external) {
    p <- p + ggplot2::geom_text(
      data = lab_axes_text,
      ggplot2::aes(
        x = .data$x,
        y = .data$y,
        label = .data$eje,
        hjust = .data$hjust,
        vjust = .data$vjust
      ),
      size = size_ejes / 3,
      colour = color_ejes,
      fontface = if ("ejes" %in% textos_negrita) "bold" else "plain",
      lineheight = 0.95
    )
  }

  if (isTRUE(mostrar_niveles) && !is.null(level_lab)) {
    p <- p + ggplot2::geom_text(
      data = level_lab,
      ggplot2::aes(x = .data$x, y = .data$y, label = paste0(round(.data$.nivel * 100), "%")),
      size = 3,
      color = "grey40",
      fontface = if ("niveles" %in% textos_negrita) "bold" else "plain",
      vjust = -0.2
    )
  }

  lim_xy <- ring_max_plot * max(1.18, label_ring_mult * 1.05)

  # --- Íconos en ejes (requiere lim_xy) -------------------------------------
  if (has_iconos_radar) {
    icon_r <- lim_xy * icono_size_radar
    eje_orig_levels <- levels(df_plot$.eje)

    for (k in seq_len(nrow(lab_axes))) {
      eje_k_wrapped <- lab_axes$eje[k]
      # Encontrar el label original que corresponde (antes del wrap)
      eje_k_orig <- eje_orig_levels[k]
      ico_path <- axis_iconos[[eje_k_orig]]
      if (is.null(ico_path) || !nzchar(as.character(ico_path %||% ""))) next

      img <- load_icon_radar(ico_path, tint_color = icono_color_radar)
      if (is.null(img)) next

      cx <- lab_axes$x[k]
      cy <- lab_axes$y[k]

      # En modo "acompanar", desplazar el ícono un poco más lejos del centro
      if (identical(icono_modo, "acompanar")) {
        push <- 1 + icon_r / max(abs(cx), abs(cy), 1e-6) * 1.1
        cx <- cx * push
        cy <- cy * push
      }

      p <- p + ggplot2::annotation_custom(
        grid::rasterGrob(img, interpolate = TRUE),
        xmin = cx - icon_r, xmax = cx + icon_r,
        ymin = cy - icon_r, ymax = cy + icon_r
      )
    }
  }

  clip_mode <- if (ppt_safe) "on" else "off"

  p <- p +
    ggplot2::coord_equal(clip = clip_mode) +
    ggplot2::scale_x_continuous(limits = c(-lim_xy, lim_xy), expand = ggplot2::expansion(mult = 0, add = 0)) +
    ggplot2::scale_y_continuous(limits = c(-lim_xy, lim_xy), expand = ggplot2::expansion(mult = 0, add = 0))

  if (!is.null(pal)) {
    p <- p + ggplot2::scale_color_manual(values = pal, breaks = as.character(grupos), drop = FALSE)
    if (isTRUE(rellenar_poligono)) p <- p + ggplot2::scale_fill_manual(values = pal, breaks = as.character(grupos), drop = FALSE)
  } else {
    p <- p + ggplot2::scale_color_discrete(drop = FALSE)
    if (isTRUE(rellenar_poligono)) p <- p + ggplot2::scale_fill_discrete(drop = FALSE)
  }

  p <- p + ggplot2::guides(
    color = ggplot2::guide_legend(
      ncol  = if (leyenda_posicion == "abajo") legend_n_por_fila else 1,
      byrow = TRUE,
      reverse = isTRUE(invertir_leyenda),
      keywidth  = grid::unit(legend_key_cm, "cm"),
      keyheight = grid::unit(legend_key_cm, "cm")
    ),
    fill  = if (isTRUE(rellenar_poligono)) ggplot2::guide_legend(
      ncol  = if (leyenda_posicion == "abajo") legend_n_por_fila else 1,
      byrow = TRUE,
      reverse = isTRUE(invertir_leyenda),
      keywidth  = grid::unit(legend_key_cm, "cm"),
      keyheight = grid::unit(legend_key_cm, "cm")
    ) else "none"
  )

  # ---------------------------------------------------------------------------
  # CANVAS (radar + tabla opcional)
  # ---------------------------------------------------------------------------
  if (isTRUE(usar_canvas)) {
    if (!requireNamespace("cowplot", quietly = TRUE)) stop("Para `usar_canvas=TRUE` se requiere cowplot.", call. = FALSE)

    has_header  <- (!is.null(titulo) && nzchar(titulo)) || (!is.null(subtitulo) && nzchar(subtitulo))
    has_caption <- (!is.null(nota_pie) && nzchar(nota_pie))
    has_legend  <- isTRUE(mostrar_leyenda) && leg_pos != "none" && length(grupos) > 0

    p_panel <- p +
      ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL) +
      ggplot2::theme(legend.position = "none", plot.margin = ggplot2::margin(0,0,0,0))

    leg_grob <- NULL
    if (has_legend) {
      p_for_legend <- p +
        ggplot2::theme(
          legend.position  = "bottom",
          legend.direction = "horizontal",
          legend.box       = "horizontal",
          legend.title     = ggplot2::element_blank(),
          legend.text = ggplot2::element_text(
            color  = color_leyenda,
            size   = size_leyenda,
            face   = if ("leyenda" %in% textos_negrita) "bold" else "plain",
            margin = ggplot2::margin(l = legend_espaciado/2, r = legend_espaciado/2, unit = "pt")
          ),
          legend.key.width     = grid::unit(legend_key_cm, "cm"),
          legend.key.height    = grid::unit(legend_key_cm, "cm"),
          legend.key.spacing.x = grid::unit(legend_key_spacing_x_cm, "cm"),
          plot.margin = ggplot2::margin(0,0,0,0)
        ) +
        ggplot2::guides(
          color = ggplot2::guide_legend(byrow = TRUE, ncol = legend_n_por_fila,
                                        reverse = isTRUE(invertir_leyenda),
                                        keywidth  = grid::unit(legend_key_cm, "cm"),
                                        keyheight = grid::unit(legend_key_cm, "cm")),
          fill  = if (isTRUE(rellenar_poligono)) ggplot2::guide_legend(byrow = TRUE, ncol = legend_n_por_fila,
                                                                       reverse = isTRUE(invertir_leyenda),
                                                                       keywidth  = grid::unit(legend_key_cm, "cm"),
                                                                       keyheight = grid::unit(legend_key_cm, "cm")) else "none"
        )
      leg_grob <- cowplot::get_legend(p_for_legend)
    }

    h_panel_in <- if (!is.null(canvas_h_panel_in) && is.finite(canvas_h_panel_in) && canvas_h_panel_in > 0) {
      canvas_h_panel_in
    } else {
      max(1, K) * alto_por_eje
    }

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

    .ph_border <- function(x, y, w, h) {
      cowplot::draw_grob(
        grid::rectGrob(
          x = 0, y = 0, width = 1, height = 1,
          just = c("left","bottom"),
          gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)
        ),
        x = x, y = y, width = w, height = h,
        hjust = 0, vjust = 0
      )
    }

    .measure_label_npc <- function(label, panel_w_npc, panel_h_npc) {
      tg <- grid::textGrob(
        label,
        gp = grid::gpar(
          fontsize = size_ejes,
          fontface = if ("ejes" %in% textos_negrita) "bold" else "plain"
        )
      )

      w_in <- suppressWarnings(grid::convertWidth(grid::grobWidth(tg), "in", valueOnly = TRUE))
      h_in <- suppressWarnings(grid::convertHeight(grid::grobHeight(tg), "in", valueOnly = TRUE))

      w_npc <- if (is.finite(w_in) && w_in > 0 && is.finite(ancho) && ancho > 0 && is.finite(panel_w_npc) && panel_w_npc > 0) {
        w_in / (ancho * panel_w_npc)
      } else {
        lines_k <- strsplit(label, "\n", fixed = TRUE)[[1]]
        chars_k <- max(nchar(lines_k, type = "width"), 1L)
        min(0.28, 0.0085 * chars_k * (size_ejes / 10))
      }

      h_npc <- if (is.finite(h_in) && h_in > 0 && is.finite(alto) && alto > 0 && is.finite(panel_h_npc) && panel_h_npc > 0) {
        h_in / (alto * panel_h_npc)
      } else {
        nlines_k <- length(strsplit(label, "\n", fixed = TRUE)[[1]])
        min(0.14, 0.0180 * nlines_k * (size_ejes / 10))
      }

      list(
        w = min(0.95, max(0.01, w_npc)),
        h = min(0.95, max(0.01, h_npc))
      )
    }

    .external_label_layout <- function(lbl_row, panel_w_npc, panel_h_npc) {
      lbl_k <- as.character(lbl_row$eje %||% "")
      if (!nzchar(lbl_k)) return(NULL)

      ang_k <- suppressWarnings(as.numeric(lbl_row$.ang))
      if (!is.finite(ang_k)) return(NULL)

      dims <- .measure_label_npc(lbl_k, panel_w_npc = panel_w_npc, panel_h_npc = panel_h_npc)

      x_corner <- ring_max_plot * radar_scale * cos(ang_k)
      y_corner <- ring_max_plot * radar_scale * sin(ang_k)

      slot_w_in <- if (is.finite(ancho) && ancho > 0 && is.finite(panel_w_npc) && panel_w_npc > 0) ancho * panel_w_npc else 1
      slot_h_in <- if (is.finite(alto)  && alto  > 0 && is.finite(panel_h_npc) && panel_h_npc > 0) alto  * panel_h_npc else 1
      square_in <- min(slot_w_in, slot_h_in)
      square_w_npc <- min(1, square_in / slot_w_in)
      square_h_npc <- min(1, square_in / slot_h_in)
      pad_x_npc <- (1 - square_w_npc) * 0.5
      pad_y_npc <- (1 - square_h_npc) * 0.5

      x_plot_npc <- (x_corner + lim_xy) / (2 * lim_xy)
      y_plot_npc <- (y_corner + lim_xy) / (2 * lim_xy)
      x_npc <- pad_x_npc + x_plot_npc * square_w_npc
      y_npc <- pad_y_npc + y_plot_npc * square_h_npc

      cos_k <- cos(ang_k)
      sin_k <- sin(ang_k)

      hk <- dplyr::case_when(
        cos_k > 0.25  ~ 0,
        cos_k < -0.25 ~ 1,
        TRUE          ~ 0.5
      )
      vk <- dplyr::case_when(
        sin_k > 0.55  ~ 0,
        sin_k < -0.55 ~ 1,
        TRUE          ~ 0.5
      )

      gap_x <- max(0.006, min(0.020, dims$w * 0.18))
      gap_y <- max(0.008, min(0.024, dims$h * 0.35))

      if (hk <= 0.05) {
        x_npc <- x_npc + gap_x
      } else if (hk >= 0.95) {
        x_npc <- x_npc - gap_x
      }

      if (vk <= 0.05) {
        y_npc <- y_npc + gap_y
      } else if (vk >= 0.95) {
        y_npc <- y_npc - gap_y
      }

      left_edge   <- x_npc - hk * dims$w
      right_edge  <- x_npc + (1 - hk) * dims$w
      bottom_edge <- y_npc - vk * dims$h
      top_edge    <- y_npc + (1 - vk) * dims$h

      x_npc <- x_npc + max(0, 0.006 - left_edge) - max(0, right_edge - 0.994)
      y_npc <- y_npc + max(0, 0.010 - bottom_edge) - max(0, top_edge - 0.990)

      list(
        label = lbl_k,
        x = x_npc,
        y = y_npc,
        hjust = hk,
        vjust = vk
      )
    }

    canvas <- cowplot::ggdraw()

    # Header
    if (has_header) {
      y_header_center <- y_header0 + header_h * 0.5
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
          titulo, x = hjust_titulo, y = y_title,
          hjust = hjust_titulo, vjust = 0.5,
          size = size_titulo, colour = color_titulo,
          fontface = if ("titulo" %in% textos_negrita) "bold" else "plain"
        )
      }
      if (has_s) {
        canvas <- canvas + cowplot::draw_text(
          subtitulo,
          x = hjust_titulo, y = y_sub,
          hjust = hjust_titulo, vjust = 0.5,
          size = size_subtitulo, colour = color_subtitulo,
          fontface = if ("subtitulo" %in% textos_negrita) "bold" else "plain"
        )
      }
      if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_header0, 1, header_h)
    }

    # Panel: radar + tabla
    if (isTRUE(mostrar_tabla_derecha)) {
      tabla_ph_ancho <- suppressWarnings(as.numeric(tabla_ph_ancho))
      if (!is.finite(tabla_ph_ancho) || tabla_ph_ancho <= 0 || tabla_ph_ancho >= 0.85) tabla_ph_ancho <- 0.40
      tabla_ph_gap <- suppressWarnings(as.numeric(tabla_ph_gap))
      if (!is.finite(tabla_ph_gap) || tabla_ph_gap < 0) tabla_ph_gap <- 0.03
      tabla_ph_margin_top <- suppressWarnings(as.numeric(tabla_ph_margin_top))
      if (!is.finite(tabla_ph_margin_top) || tabla_ph_margin_top < 0) tabla_ph_margin_top <- 0.04
      tabla_ph_margin_bot <- suppressWarnings(as.numeric(tabla_ph_margin_bot))
      if (!is.finite(tabla_ph_margin_bot) || tabla_ph_margin_bot < 0) tabla_ph_margin_bot <- 0.06

      w_tab <- tabla_ph_ancho
      w_gap <- tabla_ph_gap
      w_radar <- 1 - w_tab - w_gap
      if (w_radar <= 0.10) {
        w_tab <- min(0.45, max(0.25, w_tab))
        w_gap <- min(0.05, max(0.01, w_gap))
        w_radar <- 1 - w_tab - w_gap
      }

      # Radar izquierda: dibujar como grob clippeado para que las etiquetas
      # del radar no invadan el placeholder reservado para la tabla.
      panel_draw <- .wrap_clip(ggplot2::ggplotGrob(p_panel))
      canvas <- canvas + cowplot::draw_grob(
        panel_draw,
        x = 0, y = y_panel0, width = w_radar, height = panel_h,
        hjust = 0, vjust = 0
      )
      if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_panel0, w_radar, panel_h)

      if (draw_axis_labels_external && nrow(lab_axes_text)) {
        for (k in seq_len(nrow(lab_axes_text))) {
          pos_k <- .external_label_layout(
            lbl_row = lab_axes_text[k, , drop = FALSE],
            panel_w_npc = w_radar,
            panel_h_npc = panel_h
          )
          if (is.null(pos_k)) next

          canvas <- canvas + cowplot::draw_text(
            pos_k$label,
            x = pos_k$x * w_radar,
            y = y_panel0 + pos_k$y * panel_h,
            hjust = pos_k$hjust,
            vjust = pos_k$vjust,
            size = size_ejes,
            colour = color_ejes,
            fontface = if ("ejes" %in% textos_negrita) "bold" else "plain",
            lineheight = 0.95
          )
        }
      }

      # Tabla derecha con top/bot
      h_tab_avail <- panel_h - tabla_ph_margin_top - tabla_ph_margin_bot
      if (h_tab_avail <= 0) {
        y_tab <- y_panel0
        h_tab <- panel_h
      } else {
        h_tab <- h_tab_avail * tabla_height_frac
        y_tab <- y_panel0 + tabla_ph_margin_bot + ((h_tab_avail - h_tab) * 0.5)
      }

      tb <- .make_tabla_ttb_df(
        df_plot,
        ejes   = levels(df_plot$.eje),
        grupos = levels(df_plot$.grupo),
        digits = tabla_digits,
        titulo_left = titulo_tabla
      )

      # ------------------------------------------------------------
      # WRAP 1RA COLUMNA (ejes) según el ancho real del PH de la tabla
      # ------------------------------------------------------------
      if (requireNamespace("stringr", quietly = TRUE)) {

        # ancho real disponible del PH de la tabla (en pulgadas)
        ph_w_in <- ancho * w_tab

        # porcentaje del PH que se quiere para la 1ra columna (ajustable)
        firstcol_frac <- tabla_firstcol_frac
        firstcol_in   <- ph_w_in * firstcol_frac

        if (is.finite(tabla_firstcol_wrap) && !is.na(tabla_firstcol_wrap)) {
          wrap_n <- as.integer(tabla_firstcol_wrap)
        } else {
          # estimación: caracteres por pulgada según tamaño de fuente
          # (0.55 es un factor práctico para fuentes tipo Arial)
          chars_per_in <- 72 / (tabla_firstcol_size * 0.55)
          wrap_n <- floor(firstcol_in * chars_per_in)
          wrap_n <- max(12, min(60, wrap_n))  # clamps razonables
        }

        tb[[1]] <- stringr::str_wrap(tb[[1]], width = wrap_n)
      }

      tab_grob <- .make_table_grob_ttb_style(
        tb,
        header_fill = tabla_header_fill,
        body_fill   = tabla_body_fill,
        grid_col    = tabla_grid_col,
        text_blue   = tabla_text_blue,
        font_family = tabla_font_family,
        header_size = tabla_header_size,
        body_size   = tabla_body_size,
        firstcol_bold = tabla_firstcol_bold,
        firstcol_size = tabla_firstcol_size,
        firstcol_indent_npc = tabla_firstcol_indent_npc,
        highlight_threshold = umbral_rojo_pct,
        highlight_col = "red",
        padding_mm = tabla_padding_mm,
        line_lwd = tabla_line_lwd
      )

      tab_draw <- if (isTRUE(tabla_clip)) .wrap_clip(tab_grob) else tab_grob

      # -----------------------------------------------------------------
      # AUTO-FIT (robusto): medir el grob en pulgadas y escalar contra el PH
      # -----------------------------------------------------------------
      scale_tab <- 1

      if (isTRUE(tabla_auto_fit)) {

        # Medir robustamente: algunos grobs (p.ej. grobTree) no exponen
        # `$widths/$heights` como unidades sumables.
        gw_unit <- if (!is.null(tab_grob$widths) && inherits(tab_grob$widths, "unit")) {
          sum(tab_grob$widths)
        } else {
          grid::grobWidth(tab_grob)
        }
        gh_unit <- if (!is.null(tab_grob$heights) && inherits(tab_grob$heights, "unit")) {
          sum(tab_grob$heights)
        } else {
          grid::grobHeight(tab_grob)
        }

        gw_in <- suppressWarnings(grid::convertWidth(gw_unit, "in", valueOnly = TRUE))
        gh_in <- suppressWarnings(grid::convertHeight(gh_unit, "in", valueOnly = TRUE))

        # Tamaño disponible del PH (en pulgadas) usando el tamaño final del canvas
        ph_w_in <- ancho * w_tab
        ph_h_in <- alto  * h_tab

        if (is.finite(gw_in) && gw_in > 0 && is.finite(gh_in) && gh_in > 0) {

          s_w <- ph_w_in / gw_in
          s_h <- ph_h_in / gh_in

          scale_tab <- min(s_w, s_h)

          if (!isTRUE(tabla_allow_upscale)) scale_tab <- min(1, scale_tab)

          scale_tab <- scale_tab * tabla_fit_pad
          if (!is.finite(scale_tab) || scale_tab <= 0) scale_tab <- 1
        }
      }

      # IMPORTANTE: anclar el grob al borde izquierdo del PH para evitar
      # que una tabla ancha "derrame" por la izquierda cuando auto_fit = FALSE.
      canvas <- canvas + cowplot::draw_grob(
        tab_draw,
        x = (w_radar + w_gap),
        y = y_tab + (h_tab * 0.5),
        width  = w_tab,
        height = h_tab,
        hjust = 0, vjust = 0.5,
        scale = scale_tab
      )

      if (debug_ph_bordes) canvas <- canvas + .ph_border(w_radar + w_gap, y_tab, w_tab, h_tab)

    } else {
      panel_draw <- .wrap_clip(ggplot2::ggplotGrob(p_panel))
      canvas <- canvas + cowplot::draw_grob(
        panel_draw,
        x = 0, y = y_panel0, width = 1, height = panel_h,
        hjust = 0, vjust = 0
      )
      if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_panel0, 1, panel_h)

      if (draw_axis_labels_external && nrow(lab_axes_text)) {
        for (k in seq_len(nrow(lab_axes_text))) {
          pos_k <- .external_label_layout(
            lbl_row = lab_axes_text[k, , drop = FALSE],
            panel_w_npc = 1,
            panel_h_npc = panel_h
          )
          if (is.null(pos_k)) next

          canvas <- canvas + cowplot::draw_text(
            pos_k$label,
            x = pos_k$x,
            y = y_panel0 + pos_k$y * panel_h,
            hjust = pos_k$hjust,
            vjust = pos_k$vjust,
            size = size_ejes,
            colour = color_ejes,
            fontface = if ("ejes" %in% textos_negrita) "bold" else "plain",
            lineheight = 0.95
          )
        }
      }
    }

  # ---------------------------------------------------------------
  # LEYENDA CENTRADA SOLO EN EL PH DEL PANEL
  # ---------------------------------------------------------------
  # Determinar si hay leyenda de íconos (modo reemplazar con íconos)
  has_icono_leyenda_radar <- isTRUE(mostrar_leyenda_iconos) &&
    isTRUE(mostrar_leyenda) &&
    has_iconos_radar &&
    identical(icono_modo, "reemplazar")

  if (has_legend && !is.null(leg_grob)) {

    # ancho del panel (izquierda)
    panel_w <- if (isTRUE(mostrar_tabla_derecha)) w_radar else 1

    # leyenda solo ocupa ancho del panel
    legend_ph_x <- 0
    legend_ph_w <- panel_w

    dy_leg <- leyenda_desplazamiento_in / h_total_in

    # Cuando hay leyenda de íconos, reservar mitad inferior del slot para la leyenda de series
    leg_frac  <- if (has_icono_leyenda_radar) 0.45 else 1.0
    y_leg_center <- y_legend0 + legend_h * leg_frac * 0.5

    leg_w_npc <- suppressWarnings(
      grid::convertWidth(sum(leg_grob$widths), "npc", valueOnly = TRUE)
    )
    if (!is.finite(leg_w_npc) || leg_w_npc <= 0) leg_w_npc <- 1

    canvas <- canvas + cowplot::draw_grob(
      leg_grob,
      x = legend_ph_x + (legend_ph_w * 0.5),
      y = y_leg_center + dy_leg,
      width  = legend_ph_w,
      height = legend_h * leg_frac,
      hjust = 0.5,
      vjust = 0.5
    )

    if (debug_ph_bordes) {
      canvas <- canvas + .ph_border(legend_ph_x, y_legend0, legend_ph_w, legend_h)
    }
  }

  # Leyenda de íconos (parte superior del slot de leyenda)
  if (has_icono_leyenda_radar) {
    panel_w_icleg <- if (isTRUE(mostrar_tabla_derecha) && exists("w_radar")) w_radar else 1
    iconos_leg_radar <- axis_iconos[
      vapply(axis_iconos, function(x) !is.null(x) && nzchar(as.character(x %||% "")), logical(1))
    ]
    if (length(iconos_leg_radar)) {
      icono_leg_g <- if (exists(".dim_icono_leyenda_block", mode = "function", inherits = TRUE)) {
        .dim_icono_leyenda_block(
          iconos_leg_radar,
          icon_size = max(0.02, min(0.18, icono_size_radar * 0.28)),
          size_text = size_leyenda,
          colour_text = color_leyenda,
          icon_color = icono_color_leyenda_radar
        )
      } else NULL

      if (!is.null(icono_leg_g)) {
        # Ubicar en la parte superior del slot de leyenda (fracción 0.45-1.0)
        y_ico_leg_top <- y_legend0 + legend_h
        y_ico_leg_bot <- y_legend0 + legend_h * 0.50
        h_ico_leg     <- y_ico_leg_top - y_ico_leg_bot
        y_ico_leg_ctr <- y_ico_leg_bot + h_ico_leg * 0.5

        canvas <- canvas + cowplot::draw_plot(
          icono_leg_g,
          x = 0, y = y_ico_leg_bot,
          width = panel_w_icleg, height = h_ico_leg
        )
      }
    }
  }

    # Caption
    if (has_caption) {
      canvas <- canvas + cowplot::draw_text(
        nota_pie,
        x = hjust_caption,
        y = y_caption0 + caption_h * 0.35,
        hjust = hjust_caption,
        vjust = 0.5,
        size = size_nota_pie,
        colour = color_nota_pie,
        fontface = if ("nota_pie" %in% textos_negrita) "bold" else "plain"
      )
      if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_caption0, 1, caption_h)
    }

    # -------------------------------------------------------------------------
    # EXPORT desde CANVAS
    # -------------------------------------------------------------------------
    if (exportar == "rplot") return(canvas)

    if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

    if (exportar == "png") {
      ggplot2::ggsave(path_salida, canvas, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
      return(invisible(canvas))
    }

    # ============ PPT/WORD =============
    if (exportar %in% c("ppt","word")) {
      if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
      if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

      # ---- PPT SAFE OBJ (para rvg): NO polygons + clip on ----
      # Nota: exportamos el CANVAS (cowplot) tal cual; la estabilidad viene de:
      # - El radar base ya está sin “fill” si exportar=="ppt" (ver bloque abajo),
      # - Y la tabla es un grob (grid) sin polygons problemáticos.
      #
      # Aun así, si hay aborts, se recomienda exportar el radar a rvg y la tabla con officer como tabla nativa.
      if (exportar == "ppt") {

        # Debug por steps (Rscript) para aislar segfaults (si se activa)
        .run_ppt_step <- function(step = c("01_read", "02_slide", "03_size", "04_ph_with", "05_print"),
                                  plot_obj,
                                  path_out,
                                  ppt_layout = "Blank",
                                  ppt_master = "Office Theme") {
          step <- match.arg(step)

          f_plot <- tempfile(fileext = ".rds")
          f_err  <- tempfile(fileext = ".txt")
          f_scr  <- tempfile(fileext = ".R")

          saveRDS(plot_obj, f_plot)

          code <- c(
            "suppressPackageStartupMessages({library(officer); library(rvg); library(ggplot2); library(cowplot); library(grid)})",
            sprintf("p <- readRDS('%s')", gsub("\\\\", "/", f_plot)),
            sprintf("out <- '%s'", gsub("\\\\", "/", path_out)),
            "doc <- read_pptx()",
            if (step %in% c("02_slide","03_size","04_ph_with","05_print"))
              sprintf("doc <- add_slide(doc, layout = '%s', master = '%s')", ppt_layout, ppt_master)
            else "invisible(NULL)",
            if (step %in% c("03_size","04_ph_with","05_print"))
              "ss <- slide_size(doc); sw <- ss$width; sh <- ss$height"
            else "invisible(NULL)",
            if (step %in% c("04_ph_with","05_print"))
              "doc <- ph_with(doc, value = rvg::dml(ggobj = p), location = ph_location(left=0, top=0, width=sw, height=sh))"
            else "invisible(NULL)",
            if (step %in% c("05_print"))
              "print(doc, target = out)"
            else "invisible(NULL)",
            "cat('OK\\n')"
          )

          writeLines(code, f_scr)

          rscript <- Sys.which("Rscript")
          if (!nzchar(rscript)) stop("No se encontró Rscript en PATH.", call. = FALSE)

          suppressWarnings(system2(rscript, args = c(shQuote(f_scr)), stdout = FALSE, stderr = f_err))

          err <- if (file.exists(f_err)) paste(readLines(f_err, warn = FALSE), collapse = "\n") else ""
          list(stderr = err, out_exists = file.exists(path_out))
        }

        if (isTRUE(debug_ppt)) {
          cat("PPT EXPORT DEBUG START\n", file = debug_ppt_log)
          .log <- function(...) cat(..., "\n", file = debug_ppt_log, append = TRUE)

          steps <- c("01_read", "02_slide", "03_size", "04_ph_with", "05_print")
          last_ok <- NA_character_

          for (st in steps) {
            out_step <- tempfile(fileext = paste0("_", st, ".pptx"))
            res <- .run_ppt_step(
              step       = st,
              plot_obj   = canvas,
              path_out   = out_step,
              ppt_layout = ppt_layout,
              ppt_master = ppt_master
            )

            .log("[TRY] ", st)
            if (nzchar(res$stderr)) {
              .log("[STDERR] ")
              .log(res$stderr)
              .log("[WARN?] ", st, " (ver STDERR arriba)")
            } else {
              .log("[OK] ", st)
              last_ok <- st
            }

            if (st == "05_print") {
              if (isTRUE(res$out_exists)) {
                .log("[OK] 05_print (pptx creado)")
              } else {
                .log("[FAIL] 05_print")
                .log("STOP: aborta en print() o antes (no se creó pptx). Último OK: ", last_ok %||% "ninguno")
              }
            }
          }
          .log("PPT EXPORT DEBUG END")
          message("PPT export debug log -> ", normalizePath(debug_ppt_log, winslash = "/"))
        }

        doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
        doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
        doc <- officer::ph_with(doc, value = rvg::dml(ggobj = canvas), location = officer::ph_location_fullsize())
        print(doc, target = path_salida)
        return(invisible(canvas))
      }

      if (exportar == "word") {
        doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
        doc <- officer::body_add_par(doc, value = "", style = "Normal")
        doc <- officer::body_add_dml(doc, value = rvg::dml(ggobj = canvas), width = ancho, height = alto)
        print(doc, target = path_salida)
        return(invisible(canvas))
      }
    }

    stop("Tipo de exportación no soportado.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # NO CANVAS
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") return(p)

  if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

  if (exportar == "png") {
    ggplot2::ggsave(path_salida, p, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
    return(invisible(p))
  }

  if (exportar %in% c("ppt","word")) {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

    if (exportar == "ppt") {
      # ---- PLOT PPT SAFE (reconstrucción SIN polygons) ----
      # 1) Forzar NO fill en PPT (aunque el usuario lo pida)
      rellenar_ppt <- FALSE

      # 2) Malla sin geom_polygon: se reemplaza por geom_path
      #    y se filtran coords no finitas por seguridad
      grid_df_ppt <- grid_df
      if (!is.null(grid_df_ppt)) {
        grid_df_ppt <- grid_df_ppt |>
          dplyr::filter(is.finite(.data$x), is.finite(.data$y), !is.na(.data$x), !is.na(.data$y))
      }
      axes_df_ppt <- axes_df
      if (!is.null(axes_df_ppt)) {
        axes_df_ppt <- axes_df_ppt |>
          dplyr::filter(is.finite(.data$x0), is.finite(.data$y0), is.finite(.data$x1), is.finite(.data$y1))
      }
      df_poly_ppt <- df_poly |>
        dplyr::filter(is.finite(.data$x), is.finite(.data$y), !is.na(.data$x), !is.na(.data$y))
      df_xy_ppt <- df_xy |>
        dplyr::filter(is.finite(.data$x), is.finite(.data$y), !is.na(.data$x), !is.na(.data$y))

      # 3) límites: incluir labels dentro del viewport
      lim_xy_ppt <- max(ring_max_plot * 1.18, (ring_max_plot * label_ring_mult) * 1.06)

      fondo_ppt <- if (is.na(color_fondo) || is.null(color_fondo)) "transparent" else color_fondo

      p_ppt <- ggplot2::ggplot() +
        ggplot2::theme_minimal(base_size = 9) +
        ggplot2::theme(
          panel.grid       = ggplot2::element_blank(),
          axis.title       = ggplot2::element_blank(),
          axis.text        = ggplot2::element_blank(),
          axis.ticks       = ggplot2::element_blank(),
          plot.margin      = ggplot2::margin(0,0,0,0),
          panel.spacing    = grid::unit(0, "pt"),
          legend.position  = leg_pos,
          legend.title     = ggplot2::element_blank(),
          legend.text      = ggplot2::element_text(
            color  = color_leyenda,
            size   = size_leyenda,
            family = "sans",
            margin = ggplot2::margin(l = legend_espaciado/2, r = legend_espaciado/2, unit = "pt")
          ),
          legend.key.width      = grid::unit(legend_key_cm, "cm"),
          legend.key.height     = grid::unit(legend_key_cm, "cm"),
          legend.key.spacing.x  = grid::unit(legend_key_spacing_x_cm, "cm"),
          plot.title = ggplot2::element_text(
            color = color_titulo, size = size_titulo, family = "sans",
            face  = if ("titulo" %in% textos_negrita) "bold" else "plain",
            hjust = hjust_titulo
          ),
          plot.subtitle = ggplot2::element_text(
            color = color_subtitulo, size = size_subtitulo, family = "sans",
            face  = if ("subtitulo" %in% textos_negrita) "bold" else "plain",
            hjust = hjust_titulo
          ),
          plot.caption = ggplot2::element_text(
            color = color_nota_pie, size = size_nota_pie, family = "sans",
            face  = if ("nota_pie" %in% textos_negrita) "bold" else "plain",
            hjust = hjust_caption
          ),
          plot.background  = ggplot2::element_rect(fill = fondo_ppt, color = NA),
          panel.background = ggplot2::element_rect(fill = fondo_ppt, color = NA)
        ) +
        ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie)

      if (isTRUE(mostrar_tela) && !is.null(grid_df_ppt)) {
        p_ppt <- p_ppt + ggplot2::geom_path(
          data = grid_df_ppt,
          ggplot2::aes(x = .data$x, y = .data$y, group = .data$.r),
          color = color_grilla, linewidth = 0.5
        )
      }

      if (isTRUE(mostrar_radios) && !is.null(axes_df_ppt)) {
        p_ppt <- p_ppt + ggplot2::geom_segment(
          data = axes_df_ppt,
          ggplot2::aes(x = .data$x0, y = .data$y0, xend = .data$x1, yend = .data$y1),
          color = color_radios, linewidth = 0.5
        )
      }

      # NO geom_polygon() en PPT
      if (isTRUE(rellenar_ppt) && FALSE) {
        p_ppt <- p_ppt + ggplot2::geom_polygon(
          data = df_poly_ppt,
          ggplot2::aes(x = .data$x, y = .data$y, group = .data$.grupo, fill = .data$.grupo),
          color = NA, alpha = alpha_relleno
        )
      }

      p_ppt <- p_ppt + ggplot2::geom_path(
        data = df_poly_ppt,
        ggplot2::aes(x = .data$x, y = .data$y, group = .data$.grupo, color = .data$.grupo),
        linewidth = size_linea
      )

      if (isTRUE(mostrar_puntos)) {
        p_ppt <- p_ppt + ggplot2::geom_point(
          data = df_xy_ppt,
          ggplot2::aes(x = .data$x, y = .data$y, color = .data$.grupo),
          size = size_punto
        )
      }

      p_ppt <- p_ppt + ggplot2::geom_text(
        data = lab_axes,
        ggplot2::aes(x = .data$x, y = .data$y, label = .data$eje),
        size = size_ejes / 3,
        colour = color_ejes,
        family = "sans",
        fontface = if ("ejes" %in% textos_negrita) "bold" else "plain",
        lineheight = 1
      )

      if (isTRUE(mostrar_niveles) && !is.null(level_lab)) {
        p_ppt <- p_ppt + ggplot2::geom_text(
          data = level_lab,
          ggplot2::aes(x = .data$x, y = .data$y, label = paste0(round(.data$.nivel * 100), "%")),
          size = 3,
          color = "grey40",
          family = "sans",
          fontface = if ("niveles" %in% textos_negrita) "bold" else "plain",
          vjust = -0.2
        )
      }

      p_ppt <- p_ppt +
        ggplot2::coord_equal(clip = "on") +
        ggplot2::scale_x_continuous(limits = c(-lim_xy_ppt, lim_xy_ppt), expand = ggplot2::expansion(mult = 0, add = 0)) +
        ggplot2::scale_y_continuous(limits = c(-lim_xy_ppt, lim_xy_ppt), expand = ggplot2::expansion(mult = 0, add = 0))

      if (!is.null(pal)) {
        p_ppt <- p_ppt + ggplot2::scale_color_manual(values = pal, breaks = as.character(grupos), drop = FALSE)
      } else {
        p_ppt <- p_ppt + ggplot2::scale_color_discrete(drop = FALSE)
      }

      p_ppt <- p_ppt + ggplot2::guides(
        color = ggplot2::guide_legend(
          ncol  = if (leyenda_posicion == "abajo") legend_n_por_fila else 1,
          byrow = TRUE,
          reverse = isTRUE(invertir_leyenda),
          keywidth  = grid::unit(legend_key_cm, "cm"),
          keyheight = grid::unit(legend_key_cm, "cm")
        )
      )

      # --- Debug steps (opcional) para p_ppt ---
      if (isTRUE(debug_ppt)) {
        cat("PPT EXPORT DEBUG START\n", file = debug_ppt_log)
        .log <- function(...) cat(..., "\n", file = debug_ppt_log, append = TRUE)

        .run_ppt_step <- function(step = c("01_read", "02_slide", "03_size", "04_ph_with", "05_print"),
                                  plot_obj,
                                  path_out,
                                  ppt_layout = "Blank",
                                  ppt_master = "Office Theme") {
          step <- match.arg(step)

          f_plot <- tempfile(fileext = ".rds")
          f_err  <- tempfile(fileext = ".txt")
          f_scr  <- tempfile(fileext = ".R")

          saveRDS(plot_obj, f_plot)

          code <- c(
            "suppressPackageStartupMessages({library(officer); library(rvg); library(ggplot2); library(grid)})",
            sprintf("p <- readRDS('%s')", gsub("\\\\", "/", f_plot)),
            sprintf("out <- '%s'", gsub("\\\\", "/", path_out)),
            "doc <- read_pptx()",
            if (step %in% c("02_slide","03_size","04_ph_with","05_print"))
              sprintf("doc <- add_slide(doc, layout = '%s', master = '%s')", ppt_layout, ppt_master)
            else "invisible(NULL)",
            if (step %in% c("03_size","04_ph_with","05_print"))
              "ss <- slide_size(doc); sw <- ss$width; sh <- ss$height"
            else "invisible(NULL)",
            if (step %in% c("04_ph_with","05_print"))
              "doc <- ph_with(doc, value = rvg::dml(ggobj = p), location = ph_location(left=0, top=0, width=sw, height=sh))"
            else "invisible(NULL)",
            if (step %in% c("05_print"))
              "print(doc, target = out)"
            else "invisible(NULL)",
            "cat('OK\\n')"
          )

          writeLines(code, f_scr)

          rscript <- Sys.which("Rscript")
          if (!nzchar(rscript)) stop("No se encontró Rscript en PATH.", call. = FALSE)

          suppressWarnings(system2(rscript, args = c(shQuote(f_scr)), stdout = FALSE, stderr = f_err))

          err <- if (file.exists(f_err)) paste(readLines(f_err, warn = FALSE), collapse = "\n") else ""
          list(stderr = err, out_exists = file.exists(path_out))
        }

        steps <- c("01_read", "02_slide", "03_size", "04_ph_with", "05_print")
        last_ok <- NA_character_

        for (st in steps) {
          out_step <- tempfile(fileext = paste0("_", st, ".pptx"))
          res <- .run_ppt_step(
            step       = st,
            plot_obj   = p_ppt,
            path_out   = out_step,
            ppt_layout = ppt_layout,
            ppt_master = ppt_master
          )

          .log("[TRY] ", st)
          if (nzchar(res$stderr)) {
            .log("[STDERR] ")
            .log(res$stderr)
            .log("[WARN?] ", st, " (ver STDERR arriba)")
          } else {
            .log("[OK] ", st)
            last_ok <- st
          }

          if (st == "05_print") {
            if (isTRUE(res$out_exists)) {
              .log("[OK] 05_print (pptx creado)")
            } else {
              .log("[FAIL] 05_print")
              .log("STOP: aborta en print() o antes (no se creó pptx). Último OK: ", last_ok %||% "ninguno")
            }
          }
        }
        .log("PPT EXPORT DEBUG END")
        message("PPT export debug log -> ", normalizePath(debug_ppt_log, winslash = "/"))
      }

      doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
      doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)

      ss <- officer::slide_size(doc)
      doc <- officer::ph_with(
        doc,
        value    = rvg::dml(ggobj = p_ppt),
        location = officer::ph_location(left = 0, top = 0, width = ss$width, height = ss$height)
      )

      print(doc, target = path_salida)
      return(invisible(p_ppt))
    }

    if (exportar == "word") {
      doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
      doc <- officer::body_add_par(doc, value = "", style = "Normal")
      doc <- officer::body_add_dml(doc, value = rvg::dml(ggobj = p), width = ancho, height = alto)
      print(doc, target = path_salida)
      return(invisible(p))
    }
  }

  stop("Tipo de exportación no soportado.", call. = FALSE)
}
