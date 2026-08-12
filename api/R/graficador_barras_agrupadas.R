# Grosor efectivo de las barras bajo el modo canvas.
#
# El piso de filas virtuales (`canvas_min_filas`) existe para que una barra
# aislada no se vea desproporcionada frente a graficos de muchas filas, pero
# adelgaza tanto las barras de 1-3 categorias que el panel queda aireado y con
# las barras muy separadas (caso tipico: dicotomicas Si/No). Para pocas
# categorias subimos el piso de grosor de modo que las barras llenen el panel y
# queden en linea con el grosor de los graficos de mas filas, sin exceder nunca
# el grosor base. Los graficos con muchas categorias conservan el grosor previo.
.barras_agrupadas_grosor_eff <- function(n_categorias, grosor_barras,
                                         canvas_min_filas, usar_canvas = TRUE) {
  grosor_base <- suppressWarnings(as.numeric(grosor_barras)[1])
  if (!is.finite(grosor_base) || is.na(grosor_base) || grosor_base <= 0) {
    grosor_base <- 0.6
  }
  n_categorias <- suppressWarnings(as.numeric(n_categorias)[1])
  if (!isTRUE(usar_canvas) || !is.finite(n_categorias) || n_categorias <= 0) {
    return(grosor_base)
  }
  min_filas <- suppressWarnings(as.numeric(canvas_min_filas)[1])
  if (!is.finite(min_filas) || is.na(min_filas) || min_filas < 1) min_filas <- 1

  filas_grosor <- max(n_categorias, min_filas)
  grosor_eff <- grosor_base * n_categorias / filas_grosor
  grosor_eff <- max(0.42, min(grosor_base, grosor_eff))

  if (n_categorias <= 3L) {
    piso_pocas_cats <- min(grosor_base, 0.62 + 0.05 * (n_categorias - 2L))
    grosor_eff <- max(grosor_eff, piso_pocas_cats)
  }
  grosor_eff
}

.barras_agrupadas_sentence_case <- function(x) {
  unname(vapply(
    as.character(x),
    function(s) {
      if (is.na(s)) return(NA_character_)
      s <- trimws(gsub("\\s+", " ", s, perl = TRUE))
      if (!nzchar(s)) return(s)
      chars <- strsplit(tolower(s), "", fixed = FALSE, useBytes = FALSE)[[1]]
      idx <- which(grepl("[[:alpha:]]", chars))[1]
      if (length(idx) && is.finite(idx) && !is.na(idx)) {
        chars[[idx]] <- toupper(chars[[idx]])
      }
      paste0(chars, collapse = "")
    },
    character(1)
  ))
}

.barras_agrupadas_normalizacion_modo <- function(modo = "ninguna") {
  if (is.null(modo)) modo <- "ninguna"
  modo <- as.character(modo)[1]
  if (is.na(modo) || !nzchar(trimws(modo))) modo <- "ninguna"
  modo <- tolower(trimws(modo))
  modo <- gsub("[ -]+", "_", modo)
  if (modo %in% c("sin_cambio", "original", "none", "no", "false")) modo <- "ninguna"
  if (modo %in% c("capital_inicial", "sentence_case", "oracion", "oración")) modo <- "mayuscula_inicial"
  if (!modo %in% c("ninguna", "mayuscula_inicial")) modo <- "ninguna"
  modo
}

.barras_agrupadas_normalizar_etiquetas <- function(x, modo = "ninguna") {
  modo <- .barras_agrupadas_normalizacion_modo(modo)
  switch(
    modo,
    mayuscula_inicial = .barras_agrupadas_sentence_case(x),
    x
  )
}

#' Graficar barras agrupadas para porcentajes por categoria
#'
#' Construye un grafico de **barras agrupadas** para comparar una o mas series de
#' porcentajes dentro de cada categoria (por ejemplo, indicadores por distrito,
#' resultados por servicio o distribuciones por grupo).
#'
#' La funcion espera un `data.frame` en formato ancho: una columna con la categoria,
#' una columna con el tamano de base (`N`) y varias columnas con porcentajes (una por
#' serie). Internamente, los porcentajes se transforman a una escala comun (0-1) y se
#' dibujan las barras con `ggplot2`.
#'
#' Ademas del modo estandar, se puede activar un modo de armado por "bloques" (`usar_canvas`)
#' para controlar con mayor precision la ubicacion relativa del encabezado (titulo y
#' subtitulo), el panel del grafico, la leyenda y el pie de pagina. Este modo tambien
#' permite dibujar bordes de referencia (`debug_ph_bordes`) para revisar la estructura
#' del layout.
#'
#' @param data `data.frame` o `tibble` con las columnas indicadas en `var_categoria`,
#'   `var_n` y `cols_porcentaje`.
#' @param var_categoria Nombre (string) de la columna que define las categorias.
#' @param var_n Nombre (string) de la columna con la base por categoria (tipicamente `N`).
#' @param cols_porcentaje Vector de strings con los nombres de las columnas que contienen
#'   los porcentajes a graficar (una columna por serie).
#' @param etiquetas_series Vector **nombrado** que asigna etiquetas legibles a las series.
#'   Los `names(etiquetas_series)` deben coincidir con `cols_porcentaje` y los valores
#'   son los textos que se mostraran en la leyenda.
#' @param cols_n Vector opcional que mapea cada columna de porcentaje a una
#'   columna de frecuencia absoluta. Si no tiene nombres, debe tener el mismo
#'   largo y orden que `cols_porcentaje`.
#' @param mostrar_n_en_etiquetas Si `TRUE`, agrega la frecuencia entre parentesis
#'   a las etiquetas de porcentaje, por ejemplo `9% (16)`.
#'
#' @param escala_valor Indica la escala en que vienen los porcentajes:
#'   `"proporcion_1"` si vienen como proporcion (0-1) o `"proporcion_100"` si vienen
#'   en porcentaje (0-100).
#' @param orientacion Orientacion del grafico: `"horizontal"` (por defecto) o `"vertical"`.
#'   Si `usar_canvas = TRUE`, solo se admite `"horizontal"`.
#' @param colores_series Vector nombrado de colores por serie (opcional). Los nombres
#'   deben coincidir con las etiquetas finales de la serie (las de `etiquetas_series`).
#' @param colores_categorias Vector nombrado de colores por categoria (opcional).
#'   En distribuciones simples con una sola serie, los nombres deben coincidir con
#'   las etiquetas de `var_categoria`.
#'
#' @param mostrar_valores Si `TRUE`, agrega etiquetas de porcentaje sobre las barras.
#' @param decimales Numero de decimales para etiquetas no enteras.
#' @param umbral_etiqueta Umbral minimo (en escala 0-1) para mostrar una etiqueta.
#'   Valores menores se ocultan.
#' @param mostrar_ceros Si `TRUE`, conserva las categorias que NADIE eligio y
#'   muestra su etiqueta `0%` cerca del origen. Es util cuando se requiere que
#'   todas las opciones formales del instrumento aparezcan en el grafico. Las
#'   que si tienen casos y redondean a 0 % se conservan siempre, sin necesidad
#'   de este interruptor: perderlas seria perder un dato.
#' @param minimo_cero_visual Longitud exclusivamente grafica, en escala 0-1,
#'   para una barra que se rotula 0 %. El dato, la etiqueta, el orden y la
#'   escala conservan el valor real. Sin declararlo se usa el piso compartido
#'   `.BARRAS_PISO_CERO` para las barras que tienen casos detras; las vacias
#'   solo reciben piso si se declara.
#' @param umbral_posicion Umbral (en escala 0-1) para decidir si la etiqueta se coloca
#'   dentro de la barra (mitad de la altura) o fuera (por encima).
#' @param sufijo_etiqueta Texto adicional al final de cada etiqueta (por ejemplo, `" pp"`).
#'   Es un escalar: se aplica igual a todas las etiquetas.
#' @param sufijos_etiqueta Sufijo POR CELDA, cuando cada barra necesita el suyo
#'   —el caso de las letras de significancia, donde el sufijo depende de la
#'   categoria y del grupo. Data frame con la columna de categoria, `.col_pct`
#'   (la columna de porcentaje de esa serie) y `.sufijo`. Se aplica despues de
#'   `sufijo_etiqueta` y solo a las celdas presentes en el data frame.
#'
#' @param mostrar_barra_extra Si `TRUE`, muestra un texto adicional por categoria basado
#'   en `var_n` (por ejemplo `N = ...`). En modo estandar se dibuja dentro del mismo ggplot;
#'   en modo canvas se ubica en el bloque derecho.
#' @param prefijo_barra_extra Prefijo del texto adicional (por ejemplo `"N = "`).
#' @param titulo_barra_extra Texto opcional para rotular el bloque de la barra extra
#'   (principalmente cuando `usar_canvas = TRUE`).
#'
#' @param titulo Titulo del grafico (opcional).
#' @param subtitulo Subtitulo del grafico (opcional).
#' @param nota_pie Texto del pie (opcional).
#' @param nota_pie_derecha Texto adicional para combinar en el pie (opcional). Si se
#'   proporciona junto con `nota_pie`, se concatenan en una sola linea.
#' @param pos_titulo Alineacion del titulo y subtitulo: `"centro"`, `"izquierda"` o `"derecha"`.
#' @param pos_nota_pie Alineacion del pie: `"derecha"`, `"izquierda"` o `"centro"`.
#'
#' @param color_titulo,color_subtitulo,color_nota_pie,color_leyenda Colores para textos
#'   de encabezado, pie y leyenda.
#' @param size_titulo,size_subtitulo,size_nota_pie,size_leyenda Tamanos de texto para
#'   encabezado, pie y leyenda.
#' @param color_texto_barras,color_texto_barras_fuera Colores de etiquetas de porcentaje
#'   dentro y fuera de la barra.
#' @param size_texto_barras Tamano base de las etiquetas de porcentaje (se ajusta segun
#'   el numero de series).
#' @param color_barra_extra,size_barra_extra Color y tamano del texto adicional por categoria.
#' @param color_ejes,size_ejes Color y tamano de las etiquetas de categorias.
#' @param lineheight_eje_y Interlineado de las etiquetas de categorias cuando
#'   se envuelven en varias lineas. Si es `NULL`, usa el valor por defecto de
#'   `ggplot2`.
#' @param usar_eje_libre Si `FALSE`, fija el maximo en 100% (1.0) para facilitar comparacion
#'   entre graficos. Si `TRUE`, ajusta el maximo al valor observado.
#' @param color_fondo Color de fondo del grafico. Por defecto es transparente (`NA`).
#'
#' @param grosor_barras Grosor de las barras (ancho en `geom_col()`).
#' @param extra_derecha_rel Espacio adicional relativo al maximo para acomodar textos fuera
#'   de las barras (modo estandar).
#' @param espacio_izquierda_rel Expansion inferior/izquierda de la escala (modo estandar).
#' @param ancho_max_eje_y Si se define, aplica "wrap" a las etiquetas de categorias usando
#'   ese ancho (requiere `stringr`).
#' @param normalizar_etiquetas Normalizacion visual de etiquetas de categorias.
#'   `"ninguna"` conserva el texto original; `"mayuscula_inicial"` pone el
#'   primer caracter alfabetico en mayuscula y el resto en minuscula.
#' @param forzar_ancho_max_eje_y Si `TRUE`, respeta `ancho_max_eje_y` incluso en
#'   graficos densos. Por defecto el motor lo acota para proteger layouts generales.
#'
#' @param mostrar_leyenda Si `FALSE`, oculta la leyenda.
#' @param orden_barras Criterio para ordenar categorias: `"instrumento"`
#'   mantiene el orden recibido; `"mayor_menor"` y `"menor_mayor"` ordenan por
#'   el valor porcentual agregado de cada categoria.
#' @param max_categorias Número máximo de categorías visibles. Si se define y
#'   hay más categorías, conserva las principales y agrega el resto en `"Otros"`
#'   solo para el gráfico.
#' @param agrupar_resto_en_otros Si `TRUE`, agrupa las categorías excedentes
#'   cuando `max_categorias` aplica.
#' @param etiqueta_otros Etiqueta usada para el grupo agregado del resto.
#' @param otros_al_final Si `TRUE`, ubica `"Otro"`/`"Otros"` y opciones de
#'   no-respuesta/no-aplica al final del orden visual aunque su frecuencia sea alta.
#' @param invertir_leyenda Si `TRUE`, invierte el orden de la leyenda.
#' @param invertir_barras Si `TRUE`, invierte el orden de las categorias.
#' @param invertir_series Si `TRUE`, invierte el orden de las series.
#' @param textos_negrita Vector de palabras clave para forzar negrita en elementos del
#'   grafico. Se reconocen, por ejemplo: `"titulo"`, `"porcentajes"`, `"leyenda"`,
#'   `"barra_extra"`, `"eje_y"`.
#'
#' @param usar_canvas Si `TRUE`, arma el grafico mediante `cowplot` separando encabezado,
#'   panel, leyenda y pie en bloques.
#' @param preservar_tamanos_texto Si `TRUE`, conserva los tamanos solicitados
#'   para categorias y valores aunque el grafico tenga muchas categorias o series.
#' @param canvas_w_adaptativo Si `TRUE`, reparte el ancho entre etiquetas y barras
#'   segun la longitud visible de las etiquetas ya envueltas.
#' @param alinear_etiquetas Alineacion horizontal de las etiquetas dentro de su
#'   columna en modo canvas.
#' @param canvas_w_etiquetas,canvas_w_buf_etq_bars,canvas_w_bars,canvas_w_buf_bars_extra,canvas_w_extra
#'   Anchos relativos de los bloques horizontales del panel (etiquetas, buffers, barras y
#'   bloque de texto extra).
#' @param canvas_h_header_in,canvas_h_legend_in,canvas_h_caption_in Alturas (en pulgadas)
#'   sugeridas para encabezado, leyenda y pie cuando existen.
#' @param canvas_h_panel_in Altura (en pulgadas) del panel. Si es `NULL`, se calcula a partir
#'   del numero de categorias y `alto_por_categoria`.
#' @param canvas_h_toprow_in Altura (en pulgadas) de una fila superior opcional dentro del panel
#'   para ubicar `titulo_barra_extra`.
#' @param legend_key_cm Tamano (cm) de la llave de la leyenda.
#' @param legend_espaciado Espaciado horizontal adicional en el texto de leyenda (en puntos).
#' @param legend_n_por_fila Numero de items por fila en la leyenda (canvas).
#' @param encabezado_desplazamiento_in Desplazamiento vertical (en pulgadas) del encabezado.
#' @param encabezado_separacion_in Separacion vertical (en pulgadas) entre titulo y subtitulo.
#' @param leyenda_desplazamiento_in Desplazamiento vertical (en pulgadas) de la leyenda.
#' @param centro_cowplot Centro horizontal (0-1) para ubicar la leyenda dentro del canvas.
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de referencia alrededor de los bloques del canvas.
#' @param debug_ph_col Color de los bordes de debug.
#' @param debug_ph_lwd Grosor de los bordes de debug.
#'
#' @param exportar Tipo de salida: `"rplot"` devuelve el objeto grafico; `"png"` guarda un PNG;
#'   `"ppt"` agrega una diapositiva a un PPTX; `"word"` agrega el grafico a un DOCX.
#' @param path_salida Ruta del archivo de salida cuando `exportar` no es `"rplot"`.
#' @param ancho,alto Tamano del grafico (en pulgadas) para exportacion.
#' @param alto_por_categoria Altura sugerida por categoria (en pulgadas) para estimar alturas
#'   en exportacion y en el calculo automatico de `canvas_h_panel_in`.
#' @param dpi Resolucion (DPI) al exportar PNG.
#' @param ppt_append Si `TRUE` y `path_salida` existe, se abre y se anade una nueva diapositiva.
#'   Si `FALSE`, se crea un archivo nuevo.
#' @param ppt_layout Layout de la diapositiva a usar al exportar a PPT.
#' @param ppt_master Master a usar al exportar a PPT.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto grafico (`ggplot` en modo estandar o
#'   `cowplot::ggdraw()` en modo canvas). En caso contrario, exporta a archivo y devuelve
#'   el grafico de forma invisible.
#'
#' @examples
#' library(tibble)
#' df <- tibble(
#'   categoria = c("A", "B", "C"),
#'   N = c(120, 95, 80),
#'   pct_1 = c(0.30, 0.45, 0.25),
#'   pct_2 = c(0.50, 0.35, 0.60)
#' )
#' graficar_barras_agrupadas(
#'   data = df,
#'   var_categoria = "categoria",
#'   var_n = "N",
#'   cols_porcentaje = c("pct_1", "pct_2"),
#'   etiquetas_series = c(pct_1 = "Serie 1", pct_2 = "Serie 2"),
#'   titulo = "Ejemplo",
#'   subtitulo = "Barras agrupadas"
#' )
#'
#' @family graficador
#' @export
graficar_barras_agrupadas <- function(
    data,
    var_categoria,
    var_n,
    cols_porcentaje,
    etiquetas_series,
    cols_n                    = NULL,
    mostrar_n_en_etiquetas    = FALSE,
    escala_valor              = c("proporcion_1", "proporcion_100"),
    orientacion               = c("horizontal", "vertical"),
    colores_series            = NULL,
    colores_categorias        = NULL,
    mostrar_valores           = TRUE,
    decimales                 = 1,
    umbral_etiqueta           = 0.03,
    mostrar_ceros             = FALSE,
    minimo_cero_visual        = 0,
    umbral_barra              = 0.01,   # proporcion minima para dibujar una barra
    umbral_posicion           = 0.15,
    sufijo_etiqueta           = "",
    sufijos_etiqueta          = NULL,
    mostrar_barra_extra       = TRUE,
    prefijo_barra_extra       = NULL,
    titulo_barra_extra        = NULL,
    titulo                    = NULL,
    subtitulo                 = NULL,
    nota_pie                  = NULL,
    nota_pie_derecha          = NULL,
    pos_titulo                = c("centro", "izquierda", "derecha"),
    pos_nota_pie              = c("derecha", "izquierda", "centro"),

    # Estilo
    color_titulo              = "#081F5C",
    size_titulo               = 11,
    color_subtitulo           = "#081F5C",
    size_subtitulo            = 9,
    face_subtitulo            = "italic",
    color_nota_pie            = "#081F5C",
    size_nota_pie             = 8,
    color_leyenda             = "#081F5C",
    size_leyenda              = 8,
    color_texto_barras        = "white",
    color_texto_barras_fuera  = "#081F5C",
    size_texto_barras         = 3,
    color_barra_extra         = "#081F5C",
    # Mismo criterio que ya se aplico en apiladas: 3 no es un tamano, es un
    # borron. La columna extra lleva la cifra que resume la fila —la base, o el
    # top-two-box— y salia a un tercio del tamano de cualquier otro texto del
    # grafico. Se alinea con `size_ejes` para que pese lo que pesa un rotulo.
    #
    # Lo encontro el auditor de composicion: el defecto estaba arreglado en
    # apiladas desde hacia meses y seguia vivo aqui, porque nadie lo habia
    # mirado con la misma vara.
    size_barra_extra          = 9,
    color_ejes                = "#081F5C",
    size_ejes                 = 9,
    lineheight_eje_y          = NULL,
    usar_eje_libre            = FALSE,
    color_fondo               = NA,
    font_family               = "Arial",

    grosor_barras             = 0.6,
    extra_derecha_rel         = 0.25,
    espacio_izquierda_rel     = 0.05,
    ancho_max_eje_y           = NULL,
    normalizar_etiquetas      = c("ninguna", "mayuscula_inicial"),
    forzar_ancho_max_eje_y    = FALSE,

	    mostrar_leyenda           = TRUE,
	    leyenda_posicion          = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),
	    orden_barras              = c("instrumento", "mayor_menor", "menor_mayor", "manual"),
	    orden_categorias_manual   = NULL,
	    max_categorias            = NULL,
	    agrupar_resto_en_otros    = TRUE,
	    etiqueta_otros            = "Otros",
	    otros_al_final            = TRUE,
	    invertir_leyenda          = FALSE,
	    invertir_barras           = FALSE,
	    invertir_series           = FALSE,
    textos_negrita            = NULL,

    # ==========================
    # CANVAS CONTROLADO
    # ==========================
    usar_canvas               = FALSE,
    preservar_tamanos_texto   = FALSE,
    canvas_w_adaptativo       = FALSE,
    alinear_etiquetas         = c("derecha", "izquierda"),

    canvas_w_etiquetas        = 0.38,
    canvas_w_buf_etq_bars     = 0.00,
    canvas_w_buf_bars_extra   = 0.00,
    canvas_w_bars             = 0.52,
    canvas_w_extra            = 0.10,

    canvas_h_header_in        = 0.75,
    canvas_h_legend_in        = 0.75,
    canvas_h_caption_in       = 0.40,
    canvas_h_reserva_pie_in   = 0,
    canvas_h_panel_in         = NULL,
    canvas_min_filas          = 1L,
    canvas_h_toprow_in        = 0.18,

    legend_key_cm             = 0.30,
    # 6 pt y no 0.20: con 0.20 el swatch quedaba pegado al texto y la leyenda
    # se leia como una sola palabra ("MujerHombre"). La UI declara 6.
    legend_espaciado          = 6,
    legend_n_por_fila         = 6L,

    encabezado_desplazamiento_in = 0,
    encabezado_separacion_in     = 0.14,
    leyenda_desplazamiento_in    = 0,

    centro_cowplot            = NA_real_,

    debug_ph_bordes           = FALSE,
    debug_ph_col              = "#FF00FF",
    debug_ph_lwd              = 0.6,

    # ==========================
    # EXPORTAR
    # ==========================
    exportar                  = c("rplot", "png", "ppt", "word"),
    path_salida               = NULL,
    ancho                     = 10,
    alto                      = 6,
    alto_por_categoria        = NULL,
    dpi                       = 300,

    ppt_append                = TRUE,
    ppt_layout                = "Blank",
    ppt_master                = "Office Theme"
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y
  prefijo_barra_extra <- prefijo_barra_extra %||% ""
  hjust_from_pos <- function(x) switch(x, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 0.5)

  # deps minimas
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("dplyr", quietly = TRUE))  stop("Requiere dplyr.",  call. = FALSE)
  if (!requireNamespace("tidyr", quietly = TRUE))  stop("Requiere tidyr.",  call. = FALSE)
  if (!requireNamespace("grid", quietly = TRUE))   stop("Requiere grid.",   call. = FALSE)
  if (!requireNamespace("scales", quietly = TRUE)) stop("Requiere scales.", call. = FALSE)

  escala_valor <- match.arg(escala_valor)
	  orientacion  <- match.arg(orientacion)
	  exportar     <- match.arg(exportar)
	  pos_titulo   <- match.arg(pos_titulo)
	  pos_nota_pie <- match.arg(pos_nota_pie)
	  leyenda_posicion <- match.arg(leyenda_posicion)
	  orden_barras <- match.arg(orden_barras)
  alinear_etiquetas <- match.arg(alinear_etiquetas)
  normalizar_etiquetas <- .barras_agrupadas_normalizacion_modo(normalizar_etiquetas)
  font_family <- as.character(font_family %||% "Arial")[1]
  if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"
  if (identical(leyenda_posicion, "ninguna")) mostrar_leyenda <- FALSE
  legend_pos_gg <- switch(
    leyenda_posicion,
    abajo = "bottom",
    arriba = "top",
    derecha = "right",
    izquierda = "left",
    ninguna = "none",
    "bottom"
  )
  legend_is_top  <- identical(leyenda_posicion, "arriba")
  legend_is_side <- leyenda_posicion %in% c("derecha", "izquierda")

  textos_negrita <- textos_negrita %||% character(0)
  # Alias legacy: el token canónico en el registry es "valores", pero
  # el código interno lo compara como "porcentajes". Traducimos para que
  # planes antiguos (con "porcentajes") y nuevos (con "valores") se
  # comporten igual.
  if ("valores" %in% textos_negrita && !("porcentajes" %in% textos_negrita)) {
    textos_negrita <- c(textos_negrita, "porcentajes")
  }
  hjust_titulo    <- hjust_from_pos(pos_titulo)
  hjust_caption   <- hjust_from_pos(pos_nota_pie)
  mostrar_ceros   <- isTRUE(mostrar_ceros)
  minimo_cero_visual <- suppressWarnings(as.numeric(minimo_cero_visual)[1])
  if (!is.finite(minimo_cero_visual) || minimo_cero_visual < 0) minimo_cero_visual <- 0
  # Se sanea una vez y no dos: el piso de los ceros y la etiqueta tienen que
  # redondear con la misma resolución para no discrepar sobre qué es 0 %.
  decimales_eff <- suppressWarnings(as.numeric(decimales)[1])
  if (!is.finite(decimales_eff) || decimales_eff < 0) decimales_eff <- 1

  # canvas: solo horizontal (por diseno de placeholders por filas)
  if (isTRUE(usar_canvas) && orientacion != "horizontal") {
    stop("`usar_canvas = TRUE` solo esta soportado para `orientacion = \"horizontal\"`.", call. = FALSE)
  }

  # validaciones
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (!var_n %in% names(data))         stop("`var_n` no existe en `data`.", call. = FALSE)
  if (!all(cols_porcentaje %in% names(data))) {
    faltan <- cols_porcentaje[!cols_porcentaje %in% names(data)]
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }
  if (!all(names(etiquetas_series) %in% cols_porcentaje)) {
    stop("Los names de `etiquetas_series` deben coincidir con `cols_porcentaje`.", call. = FALSE)
  }
  # Default editorial: la serie sintetica unica ("Porcentaje") no gana nada
  # con leyenda — es ruido bajo el grafico. El knob mostrar_leyenda decide
  # cuando hay series reales (cruce) o la serie unica tiene nombre propio.
  if (length(etiquetas_series) == 1L &&
      identical(unname(unlist(etiquetas_series))[[1]], "Porcentaje")) {
    mostrar_leyenda <- FALSE
  }
  cols_n_map <- NULL
  if (!is.null(cols_n)) {
    if (is.list(cols_n) && !is.data.frame(cols_n)) cols_n <- unlist(cols_n, use.names = TRUE)
    cols_n <- as.character(cols_n)
    cols_n <- cols_n[nzchar(trimws(cols_n))]
    if (length(cols_n)) {
      nm_cols_n <- names(cols_n)
      if (is.null(nm_cols_n) || !all(nzchar(trimws(nm_cols_n)))) {
        if (length(cols_n) != length(cols_porcentaje)) {
          stop("`cols_n` sin nombres debe tener el mismo largo que `cols_porcentaje`.", call. = FALSE)
        }
        names(cols_n) <- cols_porcentaje
      }
      names(cols_n) <- trimws(names(cols_n))
      cols_n <- trimws(cols_n)
      if (!all(names(cols_n) %in% cols_porcentaje)) {
        stop("Los names de `cols_n` deben coincidir con `cols_porcentaje`.", call. = FALSE)
      }
      if (!all(cols_porcentaje %in% names(cols_n))) {
        faltan_map <- cols_porcentaje[!cols_porcentaje %in% names(cols_n)]
        stop("`cols_n` no define frecuencia para: ", paste(faltan_map, collapse = ", "), call. = FALSE)
      }
      faltan_n <- unname(cols_n)[!unname(cols_n) %in% names(data)]
      if (length(faltan_n)) {
        stop("Faltan columnas de frecuencia en `data`: ", paste(faltan_n, collapse = ", "), call. = FALSE)
      }
      cols_n_map <- cols_n[cols_porcentaje]
    }
  }

  df <- data
  row_id_col <- ".pulso_tmp_row_id"
  while (row_id_col %in% names(df)) row_id_col <- paste0(row_id_col, "_")
  df[[row_id_col]] <- seq_len(nrow(df))
  df[[var_categoria]] <- as.character(df[[var_categoria]])

	  .is_otros_label <- function(x) {
	    y <- iconv(as.character(x %||% ""), from = "", to = "ASCII//TRANSLIT")
	    y <- tolower(trimws(y))
	    y <- gsub("[^a-z]+", "", y)
	    y %in% c("otro", "otros", "otra", "otras", "other", "others")
	  }

	  .is_no_respuesta_label <- function(x) {
	    y <- iconv(as.character(x %||% ""), from = "", to = "ASCII//TRANSLIT")
	    y <- tolower(trimws(y))
	    y <- gsub("[^a-z]+", "", y)
	    y %in% c(
	      "prefieronoresponder",
	      "prefierenoresponder",
	      "noresponde",
	      "noresponder",
	      "norespondio",
	      "norespondieron",
	      "noquiereresponder",
	      "noquierocontestar",
	      "norespondioestaopcion",
	      "nosabe",
	      "nosabenoopina",
	      "nosabenoopino",
	      "nosabenoresponde",
	      "nosabenocontesta",
	      "nspnr",
	      "nsnr",
	      "nsnc",
	      "noaplica",
	      "noaplicable",
	      "nocorresponde",
	      "nohetrabajado",
	      "nohatrabajado",
	      "notrabajo",
	      "notrabaja",
	      "notrabaje",
	      "notrabajoactualmente"
	    )
	  }

	  .is_final_label <- function(x) {
	    .is_otros_label(x) | .is_no_respuesta_label(x)
	  }

  etiqueta_otros <- as.character(etiqueta_otros %||% "Otros")[1]
  if (is.na(etiqueta_otros) || !nzchar(trimws(etiqueta_otros))) etiqueta_otros <- "Otros"

  max_categorias_eff <- suppressWarnings(as.integer(max_categorias)[1])
  if (!is.finite(max_categorias_eff) || is.na(max_categorias_eff) || max_categorias_eff < 2L) {
    max_categorias_eff <- NA_integer_
  }

  if (!is.na(max_categorias_eff) &&
      isTRUE(agrupar_resto_en_otros) &&
      nrow(df) > max_categorias_eff) {

    cat_vals <- as.character(df[[var_categoria]])
    pct_mat <- as.data.frame(lapply(
      df[, cols_porcentaje, drop = FALSE],
      function(z) suppressWarnings(as.numeric(z))
    ))
    totales_cat <- rowSums(pct_mat, na.rm = TRUE)
	    idx_final_protegido <- which(.is_no_respuesta_label(cat_vals))
	    idx_no_final <- which(!.is_final_label(cat_vals))

	    keep_n <- max(0L, max_categorias_eff - length(idx_final_protegido) - 1L)
	    idx_keep <- integer(0)
	    if (length(idx_no_final) && keep_n > 0L) {
	      idx_ord <- idx_no_final[order(-totales_cat[idx_no_final], seq_along(idx_no_final))]
	      idx_keep <- head(idx_ord, keep_n)
	    }

	    idx_resto <- setdiff(seq_len(nrow(df)), c(idx_keep, idx_final_protegido))
	    if (length(idx_resto)) {
	      idx_keep_final <- c(idx_keep, idx_final_protegido)
	      df_keep <- df[idx_keep_final, , drop = FALSE]
	      df_otros <- df[idx_resto[1], , drop = FALSE]
	      df_otros[[var_categoria]] <- etiqueta_otros

      n_vals <- suppressWarnings(as.numeric(df[[var_n]][idx_resto]))
      df_otros[[var_n]] <- if (all(!is.finite(n_vals) | is.na(n_vals))) {
        df[[var_n]][idx_resto[1]]
      } else {
        sum(n_vals, na.rm = TRUE)
      }

      for (cc in cols_porcentaje) {
        df_otros[[cc]] <- sum(suppressWarnings(as.numeric(df[[cc]][idx_resto])), na.rm = TRUE)
      }
      if (!is.null(cols_n_map)) {
        for (cc in unique(unname(cols_n_map))) {
          df_otros[[cc]] <- sum(suppressWarnings(as.numeric(df[[cc]][idx_resto])), na.rm = TRUE)
        }
      }

	      df <- rbind(df_keep, df_otros)
	    }
	  }

  # ---------------------------------------------------------------------------
  # 1) Ancho -> largo
  # ---------------------------------------------------------------------------
  df_long <- df |>
    dplyr::select(dplyr::all_of(c(row_id_col, var_categoria, var_n, cols_porcentaje))) |>
    tidyr::pivot_longer(
      cols      = dplyr::all_of(cols_porcentaje),
      names_to  = ".col_pct",
      values_to = ".valor"
    ) |>
    dplyr::mutate(.serie = dplyr::recode(.data$.col_pct, !!!etiquetas_series))

  if (!is.numeric(df_long$.valor)) stop("Las columnas de porcentaje deben ser numericas.", call. = FALSE)

  df_long$.valor_raw_plot <- if (escala_valor == "proporcion_100") df_long$.valor / 100 else df_long$.valor
  df_long$.valor_plot <- df_long$.valor_raw_plot
  df_long$.valor_plot[is.na(df_long$.valor_plot) | !is.finite(df_long$.valor_plot)] <- 0
  df_long$.valor_plot <- pmax(0, df_long$.valor_plot)

  if (!is.null(cols_n_map)) {
    n_long <- do.call(rbind, lapply(cols_porcentaje, function(col_pct) {
      data.frame(
        .pulso_tmp_join_id = df[[row_id_col]],
        .col_pct = col_pct,
        .n_label_val = suppressWarnings(as.numeric(df[[cols_n_map[[col_pct]]]])),
        stringsAsFactors = FALSE
      )
    }))
    names(n_long)[names(n_long) == ".pulso_tmp_join_id"] <- row_id_col
    df_long <- dplyr::left_join(df_long, n_long, by = c(row_id_col, ".col_pct"))
  } else if (isTRUE(mostrar_n_en_etiquetas)) {
    df_long$.n_label_val <- suppressWarnings(as.numeric(df_long[[var_n]]) * df_long$.valor_raw_plot)
  }

  # Un 0 % con casos detrás y un 0 % vacío no son la misma decisión, aunque en
  # el gráfico se escriban igual. Los distingue la frecuencia, no el porcentaje.
  # Perder el caso que redondea a cero es un dato perdido y no un estilo, así
  # que su piso no depende del interruptor; enseñar la categoría que nadie
  # eligió sí es decisión de lámina y la sigue gobernando `mostrar_ceros`. Sin
  # frecuencias no hay con qué distinguirlos y manda el interruptor.
  cero_rotulado <- .barras_cero_rotulado(df_long$.valor_plot, decimales_eff)
  df_long$.cero_con_casos <- if (".n_label_val" %in% names(df_long)) {
    n_real <- suppressWarnings(as.numeric(df_long$.n_label_val))
    cero_rotulado & !is.na(n_real) & is.finite(n_real) & n_real > 0
  } else {
    rep(FALSE, nrow(df_long))
  }

  # Suprimir barras por debajo de umbral_barra. Cuando `mostrar_ceros = TRUE`,
  # los ceros se conservan para mantener la opcion visible en el eje.
  if (!is.null(umbral_barra) && is.numeric(umbral_barra) && is.finite(umbral_barra) && umbral_barra > 0) {
    mask_baja <- !is.na(df_long$.valor_plot) & df_long$.valor_plot < umbral_barra
    if (mostrar_ceros) mask_baja <- mask_baja & df_long$.valor_plot > 0
    # El umbral existe para que no queden astillas ilegibles, y el piso resuelve
    # eso mejor: la barra que se rotula 0 % y tiene casos se queda, con ancho
    # visible. Suprimirla aquí borraría el caso del gráfico y de su recuento.
    mask_baja <- mask_baja & !df_long$.cero_con_casos
    df_long$.valor_plot[mask_baja] <- NA_real_

    cats_keep <- df_long |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::summarise(.keep = any(!is.na(.data$.valor_plot)), .groups = "drop") |>
      dplyr::filter(.data$.keep)

    if (nrow(cats_keep)) {
      df_long <- dplyr::semi_join(df_long, cats_keep, by = var_categoria)
      df <- dplyr::semi_join(df, cats_keep, by = var_categoria)
    }
  }

  # Mantener el cero como dato y reservar una longitud mínima solo para el
  # dibujo. Ningún cálculo, etiqueta u orden usa `.valor_dibujo`.
  df_long$.valor_dibujo <- df_long$.valor_plot
  # El piso va a lo que se rotula 0 %, no solo a lo que vale cero exacto: un
  # caso entre 209 es 0,48 %, se rotula «0 %» y se dibuja como una astilla que
  # el lector no distingue de la categoría vacía.
  zero_real <- .barras_cero_rotulado(df_long$.valor_plot, decimales_eff) &
    (mostrar_ceros | df_long$.cero_con_casos)
  piso_cero <- if (minimo_cero_visual > 0) minimo_cero_visual else .BARRAS_PISO_CERO
  if (any(zero_real)) {
    # `pmax`: el piso es un mínimo, no un valor. Una barra que ya pasa del piso
    # y aun así se rotula 0 % no debe encogerse para alcanzarlo.
    df_long$.valor_dibujo[zero_real] <- pmax(
      df_long$.valor_plot[zero_real], piso_cero, na.rm = TRUE)
  }

  # orden series
  niveles_series <- unname(etiquetas_series)
  if (invertir_series) niveles_series <- rev(niveles_series)
  df_long$.serie <- factor(df_long$.serie, levels = niveles_series)

	  # orden categorias (FIJO)
		  cat_chr  <- as.character(df_long[[var_categoria]])
		  cat_lvls <- unique(cat_chr)
		  cat_lvls_instrumento <- cat_lvls
  orden_manual_chr <- .orden_manual_etiquetas(orden_categorias_manual)
  # «Manual» es un modo de `orden_barras`, no un control paralelo: ver
  # `graficador_orden_manual.R`. Antes el orden declarado ganaba siempre y el
  # analista podía tener «Mayor a menor» marcado viendo otra cosa.
  if (.orden_manual_manda(orden_manual_chr, orden_barras, c("mayor_menor", "menor_mayor"))) {
    # Orden explicito provisto por el analista (ej. "estas categorias
    # primero, el resto despues"). Se toma tal cual - a diferencia de
    # `orden_barras`, esto NO se reordena luego por `otros_al_final`, ya
    # que el analista ya decidio conscientemente donde va cada cosa.
    cat_lvls <- c(intersect(orden_manual_chr, cat_lvls), setdiff(cat_lvls, orden_manual_chr))
  } else {
	  if (!identical(orden_barras, "instrumento")) {
	    ord_vals <- tapply(df_long$.valor_plot, cat_chr, sum, na.rm = TRUE)
	    ord_df <- data.frame(
	      categoria = names(ord_vals),
	      valor = as.numeric(ord_vals),
	      pos = match(names(ord_vals), cat_lvls),
	      stringsAsFactors = FALSE
	    )
	    ord_df <- ord_df[order(
	      if (identical(orden_barras, "mayor_menor")) -ord_df$valor else ord_df$valor,
	      ord_df$pos
	    ), , drop = FALSE]
	    cat_lvls <- ord_df$categoria
	  }
		  if (isTRUE(otros_al_final) && length(cat_lvls) > 1L) {
		    idx_final <- .is_final_label(cat_lvls)
		    if (any(idx_final)) {
		      lvls_final <- cat_lvls[idx_final]
		      lvls_final <- lvls_final[order(match(lvls_final, cat_lvls_instrumento), na.last = TRUE)]
		      cat_lvls <- c(cat_lvls[!idx_final], lvls_final)
		    }
		  }
  }
	  if (invertir_barras) cat_lvls <- rev(cat_lvls)
  df_long[[var_categoria]] <- factor(cat_chr, levels = cat_lvls)
  n_categorias <- length(cat_lvls)
  canvas_min_filas_eff <- suppressWarnings(as.numeric(canvas_min_filas)[1])
  if (!is.finite(canvas_min_filas_eff) || is.na(canvas_min_filas_eff) || canvas_min_filas_eff < 1) {
    canvas_min_filas_eff <- 1
  }

  grosor_barras_eff <- .barras_agrupadas_grosor_eff(
    n_categorias      = n_categorias,
    grosor_barras     = grosor_barras,
    canvas_min_filas  = canvas_min_filas_eff,
    usar_canvas       = usar_canvas
  )

  size_ejes_eff <- suppressWarnings(as.numeric(size_ejes)[1])
  if (!is.finite(size_ejes_eff) || is.na(size_ejes_eff) || size_ejes_eff <= 0) {
    size_ejes_eff <- 9
  }
  lineheight_eje_y_eff <- suppressWarnings(as.numeric(lineheight_eje_y)[1])
  if (!is.finite(lineheight_eje_y_eff) || is.na(lineheight_eje_y_eff) || lineheight_eje_y_eff <= 0) {
    lineheight_eje_y_eff <- NA_real_
  }
  # Mismo valor para estimar el alto de fila (mas abajo) y para dibujar el
  # texto (draw_text): si quedan desincronizados, una etiqueta envuelta a 2+
  # lineas puede terminar ocupando mas espacio del reservado y solaparse con
  # la categoria vecina.
  lineheight_eje_y_render <- if (is.finite(lineheight_eje_y_eff)) lineheight_eje_y_eff else 1.20
  ancho_max_eje_y_eff <- ancho_max_eje_y
  if (isTRUE(usar_canvas) && identical(orientacion, "horizontal") && n_categorias > 0) {
    cat_widths <- nchar(as.character(cat_lvls), type = "width", allowNA = FALSE, keepNA = FALSE)
    cat_widths[!is.finite(cat_widths)] <- 0
    max_cat_width <- max(cat_widths, na.rm = TRUE)
    if (!is.finite(max_cat_width)) max_cat_width <- 0
    wide_labels <- max_cat_width >= 28
    forzar_ancho_max_eje_y <- isTRUE(forzar_ancho_max_eje_y)
    if (isTRUE(wide_labels) && !forzar_ancho_max_eje_y) {
      wrap_cap <- if (n_categorias <= 6L) 30 else if (n_categorias <= 8L) 31 else 32
      if (!is.null(ancho_max_eje_y_eff)) {
        ancho_max_eje_y_eff <- min(suppressWarnings(as.numeric(ancho_max_eje_y_eff)[1]), wrap_cap)
      } else {
        ancho_max_eje_y_eff <- wrap_cap
      }
    }
    dense_labels <- n_categorias >= 8L || max_cat_width >= 42
    if (isTRUE(dense_labels) && !isTRUE(preservar_tamanos_texto)) {
      size_ejes_eff <- min(size_ejes_eff, if (n_categorias >= 10L || max_cat_width >= 48) 12.2 else 13.2)
      if (!forzar_ancho_max_eje_y && !is.null(ancho_max_eje_y_eff)) {
        ancho_max_eje_y_eff <- min(suppressWarnings(as.numeric(ancho_max_eje_y_eff)[1]), 32)
      } else if (!forzar_ancho_max_eje_y) {
        ancho_max_eje_y_eff <- 32
      }
    }
    # H22: en paneles angostos (media lamina o menos) el wrap por caracteres
    # calibrado para lamina completa desbordaba la caja de etiquetas hacia
    # fuera de la lamina. Si el motor paso el ancho fisico del cajon
    # (`ancho`, via ancho_slot), el wrap efectivo se deriva del espacio real.
    ancho_dev <- suppressWarnings(as.numeric(ancho)[1])
    if (!forzar_ancho_max_eje_y && is.finite(ancho_dev) && ancho_dev > 0 && ancho_dev < 9) {
      w_eti <- suppressWarnings(as.numeric(canvas_w_etiquetas)[1])
      if (!is.finite(w_eti) || w_eti <= 0 || w_eti >= 1) w_eti <- 0.45
      char_in <- size_ejes_eff * 0.55 / 72
      chars_fit <- max(10L, as.integer(floor((ancho_dev * w_eti - 0.12) / char_in)))
      ancho_max_eje_y_eff <- if (is.null(ancho_max_eje_y_eff)) chars_fit else {
        min(suppressWarnings(as.numeric(ancho_max_eje_y_eff)[1]), chars_fit)
      }
    }
  }

  usar_color_categorias <- !is.null(colores_categorias) &&
    length(cols_porcentaje) == 1L &&
    is.null(colores_series)
  if (isTRUE(usar_color_categorias)) {
    df_long$.fill_key <- factor(as.character(df_long[[var_categoria]]), levels = cat_lvls)
  } else {
    df_long$.fill_key <- df_long$.serie
  }

  # tamanos texto %
  n_series <- length(levels(df_long$.serie))
  size_texto_barras_eff <- if (isTRUE(preservar_tamanos_texto)) {
    suppressWarnings(as.numeric(size_texto_barras)[1])
  } else {
    dplyr::case_when(
      n_series <= 2 ~ size_texto_barras * 1.00,
      n_series == 3 ~ size_texto_barras * 0.85,
      n_series == 4 ~ size_texto_barras * 0.70,
      TRUE          ~ size_texto_barras * 0.55
    )
  }

  max_valor <- suppressWarnings(max(df_long$.valor_plot, na.rm = TRUE))
  if (!is.finite(max_valor)) max_valor <- 0

  # ==========================
  # Regla: ancho 100% salvo eje libre
  # ==========================
  base_max <- if (isTRUE(usar_eje_libre)) max_valor else 1
  if (!is.finite(base_max) || base_max <= 0) base_max <- 1

  # ---------------------------------------------------------------------------
  # 2) Plot base agrupado
  # ---------------------------------------------------------------------------
  width_dodge <- 0.70

  .draw_key_cuadrado <- .graficos_key_glyph_cuadrado(legend_key_cm)

  p <- ggplot2::ggplot(
    df_long,
    ggplot2::aes(
      x    = .data[[var_categoria]],
      y    = .data$.valor_dibujo,
      fill = .data$.fill_key
    )
  ) +
    ggplot2::geom_col(
      position = ggplot2::position_dodge(width = width_dodge),
      width    = grosor_barras_eff,
      # Glifo de tamano ABSOLUTO: el key box hereda la altura del texto de la
      # leyenda (mas alto que ancho), asi que tanto el glifo default como
      # draw_key_rect salian rectangulares. Este dibuja siempre un cuadrado
      # de legend_key_cm x legend_key_cm centrado en el box.
      key_glyph = .draw_key_cuadrado
    )

  # ---------------------------------------------------------------------------
  # 3) Etiquetas %
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_valores)) {

    df_lab <- df_long

    dec <- decimales_eff

    # Se redondea PRIMERO con la regla de la casa (el 0,5 sube) y recién
    # después se decide si la cifra es entera. Hacerlo al revés dejaba el
    # empate en manos de `round()`/`sprintf()`, que redondean al par: 12,5 %
    # bajaba a 12 % mientras 87,5 % subía a 88 % en el mismo gráfico.
    pct_num <- df_lab$.valor_plot * 100
    pct_round <- .pulso_round_half_up(pct_num, dec)
    tol <- 10^(-(dec + 1))
    es_entero <- is.finite(pct_round) & (abs(pct_round - round(pct_round)) < tol)

    lab_base <- character(nrow(df_lab))

    lab_base[es_entero]  <- paste0(.pulso_fmt_half_up(pct_round[es_entero], 0), "%")
    lab_base[!es_entero] <- paste0(.pulso_fmt_half_up(pct_round[!es_entero], dec), "%")

    mask_zero <- !is.na(df_lab$.valor_plot) & df_lab$.valor_plot <= 0
    if (mostrar_ceros) {
      lab_base[mask_zero] <- "0%"
    } else {
      lab_base[mask_zero] <- NA_character_
    }
    # Lo que se rotula 0 % y tiene casos lleva barra con piso, así que también
    # lleva cifra: una barra visible sin número no dice nada, y el umbral la
    # dejaría muda justo donde el lector necesita leer el caso que hay detrás.
    cero_con_casos_lab <- if (".cero_con_casos" %in% names(df_lab)) {
      as.logical(df_lab$.cero_con_casos)
    } else {
      rep(FALSE, nrow(df_lab))
    }
    cero_con_casos_lab[is.na(cero_con_casos_lab)] <- FALSE
    con_piso <- .barras_cero_rotulado(df_lab$.valor_plot, dec) &
      (mostrar_ceros | cero_con_casos_lab)
    lab_base[con_piso & is.na(lab_base)] <- "0%"
    bajo_umbral <- !mask_zero & !con_piso & !is.na(df_lab$.valor_plot) &
      df_lab$.valor_plot < umbral_etiqueta
    lab_base[bajo_umbral] <- NA_character_
    lab_base[is.na(df_lab$.valor_plot)]                                         <- NA_character_

    df_lab$lab <- ifelse(!is.na(lab_base), paste0(lab_base, sufijo_etiqueta), "")

    # Sufijo por celda (letras de significancia). Se pega solo donde la etiqueta
    # existe: una barra que no muestra su cifra tampoco muestra su letra, porque
    # una letra suelta sobre una barra sin numero no se puede leer contra nada.
    if (!is.null(sufijos_etiqueta) && is.data.frame(sufijos_etiqueta) &&
        nrow(sufijos_etiqueta) && all(c(".col_pct", ".sufijo") %in% names(sufijos_etiqueta)) &&
        var_categoria %in% names(sufijos_etiqueta)) {
      idx <- match(
        paste0(df_lab[[var_categoria]], "\r", df_lab$.col_pct),
        paste0(sufijos_etiqueta[[var_categoria]], "\r", sufijos_etiqueta$.col_pct)
      )
      extra <- sufijos_etiqueta$.sufijo[idx]
      con_extra <- !is.na(extra) & nzchar(df_lab$lab)
      df_lab$lab[con_extra] <- paste0(df_lab$lab[con_extra], extra[con_extra])
    }
    if (isTRUE(mostrar_n_en_etiquetas) && ".n_label_val" %in% names(df_lab)) {
      n_val <- suppressWarnings(as.numeric(df_lab$.n_label_val))
      n_txt <- rep("", length(n_val))
      ok_n <- is.finite(n_val) & !is.na(n_val)
      n_txt[ok_n] <- format(round(n_val[ok_n]), big.mark = ",", scientific = FALSE, trim = TRUE)
      has_n <- nzchar(n_txt) & nzchar(df_lab$lab)
      df_lab$lab[has_n] <- paste0(df_lab$lab[has_n], " (", n_txt[has_n], ")")
    }

    umbral_posicion_eff <- umbral_posicion
    if (!is.finite(umbral_posicion_eff) || umbral_posicion_eff <= 0) umbral_posicion_eff <- 0.15

    label_chars <- nchar(gsub("\\s+", "", df_lab$lab), type = "width")
    label_chars[!is.finite(label_chars)] <- 0
    label_con_n <- grepl("\\([0-9.,]+\\)", df_lab$lab)
    umbral_por_texto <- ifelse(
      label_con_n,
      pmin(0.30, pmax(0.18, label_chars * 0.028)),
      pmin(0.18, pmax(0.08, label_chars * 0.012))
    )
    ancho_texto_estimado <- ifelse(
      label_con_n,
      pmin(0.34, pmax(0.20, label_chars * 0.030)),
      pmin(0.18, pmax(0.075, label_chars * 0.012))
    )
    margen_texto_inside <- ifelse(label_con_n, 0.030, 0.018)
    umbral_inside <- if (identical(orientacion, "horizontal")) {
      pmax(umbral_posicion_eff, umbral_por_texto)
    } else {
      rep(umbral_posicion_eff, length(label_chars))
    }

    offset_lab <- if (orientacion == "vertical") base_max * 0.03 else base_max * 0.015
    offset_lab_small <- if (orientacion == "vertical") base_max * 0.04 else base_max * 0.026

    ancho_texto_datos <- ancho_texto_estimado * base_max
    margen_texto_datos <- ifelse(label_con_n, 0.030, 0.014) * base_max
    min_inside_con_n <- if (isTRUE(usar_canvas) && identical(orientacion, "horizontal")) 0.36 else 0.30
    min_inside_sin_n <- if (isTRUE(usar_canvas) && identical(orientacion, "horizontal")) 0.15 else 0.13
    cabe_texto_inside <- identical(orientacion, "horizontal") &
      !is.na(df_lab$.valor_plot) &
      df_lab$.valor_plot >= pmax(
        ifelse(label_con_n, min_inside_con_n, min_inside_sin_n),
        ancho_texto_datos + margen_texto_datos
      )
    if (identical(orientacion, "horizontal")) {
      df_lab$inside <- !is.na(df_lab$.valor_plot) &
        df_lab$lab != "" &
        cabe_texto_inside
    } else {
      df_lab$inside <- !is.na(df_lab$.valor_plot) &
        df_lab$lab != "" &
        (df_lab$.valor_plot >= umbral_inside | cabe_texto_inside)
    }

    df_lab$valor_label <- df_lab$.valor_plot
    mask_inside <- df_lab$inside & !is.na(df_lab$inside)
    if (identical(orientacion, "horizontal")) {
      df_lab$valor_label[mask_inside] <- df_lab$.valor_plot[mask_inside] / 2
    } else {
      df_lab$valor_label[mask_inside] <- df_lab$.valor_plot[mask_inside] / 2
    }
    mask_outside <- !is.na(df_lab$.valor_plot) & !is.na(df_lab$inside) & !df_lab$inside & df_lab$.valor_plot > 0
    df_lab$valor_label[mask_outside] <- df_lab$.valor_plot[mask_outside] + ifelse(
      df_lab$.valor_plot[mask_outside] <= 0.02,
      offset_lab_small,
      offset_lab
    )
    mask_zero_label <- mostrar_ceros & !is.na(df_lab$.valor_plot) & df_lab$.valor_plot <= 0 & df_lab$lab != ""
    df_lab$valor_label[mask_zero_label] <- offset_lab

    df_lab$hjust_label <- ifelse(df_lab$inside, 0.5, 0)
    if (orientacion == "vertical") df_lab$hjust_label <- 0.5

    df_lab$col_label <- ifelse(df_lab$inside, color_texto_barras, color_texto_barras_fuera)

    p <- p +
      ggplot2::geom_text(
        # Conservar también las filas cuya etiqueta está vacía mantiene el
        # mismo dodge que las barras cuando una serie vale cero. ggplot no
        # dibuja esos textos, pero sí reserva su posición dentro del grupo.
        data        = df_lab,
        mapping     = ggplot2::aes(
          x      = .data[[var_categoria]],
          y      = .data$valor_label,
          label  = .data$lab,
          group  = .data$.serie,
          colour = .data$col_label,
          hjust  = .data$hjust_label
        ),
        inherit.aes = FALSE,
        position    = ggplot2::position_dodge(width = width_dodge),
        vjust       = 0.5,
        size        = size_texto_barras_eff,
        family      = font_family,
        fontface    = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
        show.legend = FALSE
      ) +
      ggplot2::scale_colour_identity(guide = "none")
  }

  # ---------------------------------------------------------------------------
  # 4) Colores + wrap
  # ---------------------------------------------------------------------------
  # El override de colores del usuario (colores_categorias / colores_series)
  # puede venir corto, sin nombres o como el deparse de un vector; se sanea con
  # el helper compartido antes de scale_fill_manual para no abortar con
  # "Insufficient values in manual scale" / "Unknown colour name".
  #
  # La escala se aplica SIEMPRE, con override o sin él: cuando no se aplicaba
  # ninguna, ggplot pintaba con su escala por defecto y la primera serie salía
  # #F8766D (salmón). Como la UI de barras agrupadas no expone control de color,
  # ese era justamente el caso normal. `.graficos_mk_palette` con `pal_user`
  # nulo devuelve la paleta institucional, igual que en apiladas y categóricas.
  pal_user_efectivo <- if (isTRUE(usar_color_categorias)) colores_categorias else colores_series
  pal_fill <- .graficos_mk_palette(levels(df_long$.fill_key), pal_user = pal_user_efectivo)
  p <- p + ggplot2::scale_fill_manual(values = pal_fill)

  if (!is.null(ancho_max_eje_y_eff)) {
    if (!requireNamespace("stringr", quietly = TRUE)) stop("Para `ancho_max_eje_y` se requiere stringr.", call. = FALSE)
    p <- p + ggplot2::scale_x_discrete(labels = function(x) {
      stringr::str_wrap(
        .barras_agrupadas_normalizar_etiquetas(x, normalizar_etiquetas),
        width = ancho_max_eje_y_eff
      )
    })
  } else if (!identical(normalizar_etiquetas, "ninguna")) {
    p <- p + ggplot2::scale_x_discrete(labels = function(x) {
      .barras_agrupadas_normalizar_etiquetas(x, normalizar_etiquetas)
    })
  }

  # caption
  caption_text <- NULL
  if (!is.null(nota_pie) && nzchar(nota_pie) && !is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- paste0(nota_pie, "   ", nota_pie_derecha)
  } else if (!is.null(nota_pie) && nzchar(nota_pie)) {
    caption_text <- nota_pie
  } else if (!is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- nota_pie_derecha
  }

  # ---------------------------------------------------------------------------
  # 5) Escala %
  # ---------------------------------------------------------------------------
  if (escala_valor %in% c("proporcion_1", "proporcion_100")) {

    if (!isTRUE(usar_canvas)) {
      y_lim <- if (isTRUE(mostrar_barra_extra)) base_max * (1 + extra_derecha_rel) else base_max

      breaks_y <- scales::pretty_breaks(n = 4)(c(0, base_max))
      breaks_y <- breaks_y[breaks_y >= 0 & breaks_y <= base_max]

      p <- p +
        ggplot2::scale_y_continuous(
          limits = c(0, y_lim),
          breaks = breaks_y,
          labels = function(z) .pulso_fmt_pct_half_up(z, 0),
          expand = ggplot2::expansion(mult = c(0, 0.02))
        )
    } else {

      breaks_y <- scales::pretty_breaks(n = 4)(c(0, base_max))
      breaks_y <- breaks_y[breaks_y >= 0 & breaks_y <= base_max]

      p <- p +
        ggplot2::scale_y_continuous(
          limits = c(0, base_max),
          breaks = breaks_y,
          labels = function(z) .pulso_fmt_pct_half_up(z, 0),
          expand = ggplot2::expansion(mult = c(0, 0))
        )
    }

  } else {

    y_lim <- if (!isTRUE(usar_canvas) && isTRUE(mostrar_barra_extra)) max_valor * (1 + extra_derecha_rel) else max_valor
    if (!is.finite(y_lim) || y_lim <= 0) y_lim <- 1

    p <- p +
      ggplot2::scale_y_continuous(
        limits = c(0, y_lim),
        expand = ggplot2::expansion(mult = c(espacio_izquierda_rel, 0.05))
      )
  }

  # ---------------------------------------------------------------------------
  # 6) Barra extra N= (solo NO canvas)
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_barra_extra) && !isTRUE(usar_canvas)) {

    y_extra <- if (escala_valor %in% c("proporcion_1", "proporcion_100")) {
      base_max * (1 + extra_derecha_rel * 0.50)
    } else {
      max_valor * (1 + extra_derecha_rel * 0.95)
    }
    if (!is.finite(y_extra)) y_extra <- base_max

    df_extra <- df |>
      dplyr::select(dplyr::all_of(c(var_categoria, var_n))) |>
      dplyr::distinct() |>
      dplyr::mutate(
        ypos      = y_extra,
        lab_extra = paste0(prefijo_barra_extra, .data[[var_n]])
      )

    p <- p +
      ggplot2::geom_text(
        data        = df_extra,
        mapping     = ggplot2::aes(
          x     = .data[[var_categoria]],
          y     = .data$ypos,
          label = .data$lab_extra
        ),
        inherit.aes = FALSE,
        hjust       = 0,
        vjust       = 0.5,
        size        = size_barra_extra,
        color       = color_barra_extra,
        family      = font_family,
        fontface    = if ("barra_extra" %in% textos_negrita) "bold" else "plain"
      )

    if (!is.null(titulo_barra_extra) && nzchar(titulo_barra_extra)) {
      lvls <- levels(df_long[[var_categoria]])
      cat_superior <- if (invertir_barras) tail(lvls, 1) else head(lvls, 1)
      df_header <- df_extra[df_extra[[var_categoria]] == cat_superior, , drop = FALSE]

      if (nrow(df_header) == 1L) {
        p <- p +
          ggplot2::geom_text(
            data        = df_header,
            mapping     = ggplot2::aes(x = .data[[var_categoria]], y = .data$ypos),
            label       = titulo_barra_extra,
            inherit.aes = FALSE,
            hjust       = 0,
            vjust       = -1.2,
            size        = size_barra_extra,
            color       = color_barra_extra,
            family      = font_family,
            fontface    = "bold"
          )
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 7) Tema + orientacion + leyenda
  # ---------------------------------------------------------------------------
  n_items_ley <- length(levels(df_long$.fill_key))
  n_filas_ley <- max(1L, ceiling(n_items_ley / 5))

  if (isTRUE(mostrar_leyenda)) {
    p <- p + ggplot2::guides(
      fill = ggplot2::guide_legend(
        nrow    = n_filas_ley,
        reverse = invertir_leyenda
      )
    )
  } else {
    p <- p + ggplot2::theme(legend.position = "none")
  }

  base_theme <- ggplot2::theme_minimal(base_size = 9, base_family = font_family) +
    ggplot2::theme(
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.minor   = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      axis.title.x       = ggplot2::element_blank(),
      axis.title.y       = ggplot2::element_blank(),
      legend.title       = ggplot2::element_blank(),
      legend.position    = if (isTRUE(mostrar_leyenda)) legend_pos_gg else "none",
      legend.text        = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        family = font_family,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain",
        # aire entre el swatch y su texto, y entre items contiguos: sin esto
        # la leyenda se leia "■Mujer■Hombre" como una sola palabra
        margin = ggplot2::margin(l = 4, r = 12)
      ),
      legend.spacing.x   = grid::unit(6, "pt"),
      plot.title         = ggplot2::element_text(
        hjust = hjust_titulo,
        color = color_titulo,
        size  = size_titulo,
        family = font_family,
        face  = if ("titulo" %in% textos_negrita) "bold" else "plain"
      ),
      plot.subtitle      = ggplot2::element_text(
        hjust = hjust_titulo,
        color = color_subtitulo,
        size  = size_subtitulo,
        family = font_family,
        face  = face_subtitulo %||% "italic"
      ),
      plot.caption       = ggplot2::element_text(
        hjust = hjust_caption,
        color = color_nota_pie,
        size  = size_nota_pie,
        family = font_family
      ),
      plot.background    = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background   = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.margin        = ggplot2::margin(t = 10, r = if (isTRUE(mostrar_barra_extra) && !isTRUE(usar_canvas)) 60 else 10, b = 10, l = 5)
    )

  if (orientacion == "horizontal") p <- p + ggplot2::coord_flip()
  p <- p + base_theme + ggplot2::labs(title = titulo, subtitle = subtitulo, caption = caption_text)

  # ---------------------------------------------------------------------------
  # 8) NO CANVAS: export directo
  # ---------------------------------------------------------------------------
  if (!isTRUE(usar_canvas)) {

    if (exportar == "rplot") {
      attr(p, "alto_word_sugerido") <- (alto_por_categoria %||% 0.35) * max(1L, n_categorias)
      attr(p, "pulso_barras_agrupadas_layout") <- list(
        n_categorias = n_categorias,
        base_max = base_max,
        usar_eje_libre = isTRUE(usar_eje_libre),
        grosor_eff = grosor_barras_eff,
        size_ejes_eff = size_ejes_eff,
        size_texto_barras_eff = size_texto_barras_eff,
        ancho_max_eje_y_eff = ancho_max_eje_y_eff
      )
      return(p)
    }

    if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

    if (exportar == "png") {
      ggplot2::ggsave(
        filename = path_salida, plot = p,
        width = ancho, height = alto, units = "in",
        dpi = dpi,
        bg = if (is.na(color_fondo)) "transparent" else color_fondo
      )
      return(invisible(p))
    }

    if (exportar %in% c("ppt", "word")) {
      if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
      if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

      if (exportar == "ppt") {
        doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
        doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
        doc <- officer::ph_with(doc, value = rvg::dml(ggobj = p), location = officer::ph_location_fullsize())
        print(doc, target = path_salida)
        return(invisible(p))
      }

      if (exportar == "word") {
        doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
        doc <- officer::body_add_par(doc, value = "", style = "Normal")
        doc <- officer::body_add_dml(doc, value = rvg::dml(ggobj = p), width = ancho, height = alto)
        print(doc, target = path_salida)
        return(invisible(p))
      }
    }

    stop("Tipo de exportacion no soportado.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # 9) CANVAS
  # ---------------------------------------------------------------------------
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Para `usar_canvas=TRUE` se requiere cowplot.", call. = FALSE)

  p <- p + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL)

  p_panel <- p +
    ggplot2::theme_void() +
    ggplot2::theme(
      legend.position  = "none",
      plot.margin      = ggplot2::margin(0,0,0,0),
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA)
    )

  # leyenda grob (con separacion real)
  n_por_fila <- as.integer(legend_n_por_fila)
  if (!is.finite(n_por_fila) || n_por_fila < 1L) n_por_fila <- 6L

  p_for_legend <- p +
    ggplot2::theme(
      legend.position = if (legend_is_side) "right" else "bottom",
      legend.title    = ggplot2::element_blank(),
      legend.text     = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        family = font_family,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain",
        # l = aire swatch-texto; r = separacion con el item siguiente (mayor,
        # para que los pares swatch+texto se lean como unidades separadas)
        margin = ggplot2::margin(l = legend_espaciado, r = legend_espaciado * 2.5, unit = "pt")
      ),
      legend.key.width  = grid::unit(legend_key_cm, "cm"),
      legend.key.height = grid::unit(legend_key_cm, "cm"),
      legend.key.spacing.x = grid::unit(0.22, "cm"),
      plot.margin = ggplot2::margin(0, 0, 0, 0)
    ) +
    ggplot2::guides(
      fill = ggplot2::guide_legend(
        byrow     = TRUE,
        ncol      = if (legend_is_side) 1L else n_por_fila,
        reverse   = invertir_leyenda,
        keywidth  = grid::unit(legend_key_cm, "cm"),
        keyheight = grid::unit(legend_key_cm, "cm")
      )
    )

  has_legend <- isTRUE(mostrar_leyenda) && n_items_ley > 0
  leg_grob <- NULL
  if (has_legend) {
    leg_grob <- cowplot::get_legend(
      p_for_legend + ggplot2::theme(
        legend.position  = if (legend_is_side) "right" else "bottom",
        legend.direction = if (legend_is_side) "vertical" else "horizontal",
        legend.box       = if (legend_is_side) "vertical" else "horizontal"
      )
    )
  }

  # etiquetas y extra (texto)
  etiquetas_vec <- .barras_agrupadas_normalizar_etiquetas(cat_lvls, normalizar_etiquetas)
  if (!is.null(ancho_max_eje_y_eff)) {
    if (!requireNamespace("stringr", quietly = TRUE)) stop("Para `ancho_max_eje_y` se requiere stringr.", call. = FALSE)
    etiquetas_vec <- stringr::str_wrap(etiquetas_vec, width = ancho_max_eje_y_eff)
  }

  extra_labels <- rep("", length(cat_lvls))
  if (isTRUE(mostrar_barra_extra)) {
    extra_map <- df |>
      dplyr::select(dplyr::all_of(c(var_categoria, var_n))) |>
      dplyr::mutate(.cat_chr = as.character(.data[[var_categoria]])) |>
      dplyr::select(.cat_chr, .data[[var_n]])

    extra_vals <- vapply(cat_lvls, function(cc) {
      vv <- extra_map[[var_n]][match(cc, extra_map$.cat_chr)]
      if (length(vv) == 0 || is.na(vv)) vv <- NA
      vv
    }, numeric(1))

    extra_labels <- paste0(prefijo_barra_extra, format(extra_vals, big.mark = ",", scientific = FALSE, trim = TRUE))
    extra_labels[!is.finite(extra_vals)] <- ""
  }

  # alturas en pulgadas
  alto_por_cat_eff <- alto_por_categoria %||% 0.42
  if (length(etiquetas_vec)) {
    lineas_etq <- vapply(
      strsplit(as.character(etiquetas_vec), "\n", fixed = TRUE),
      length,
      integer(1)
    )
    max_lineas_etq <- suppressWarnings(max(lineas_etq, na.rm = TRUE))
    if (is.finite(max_lineas_etq) && max_lineas_etq > 1) {
      alto_min_etq <- (size_ejes_eff / 72) * max_lineas_etq * lineheight_eje_y_render * 1.18 + 0.08
      if (is.finite(alto_min_etq) && alto_min_etq > 0) {
        alto_por_cat_eff <- max(alto_por_cat_eff, alto_min_etq)
      }
    }
  }
  h_panel_in <- if (!is.null(canvas_h_panel_in) && is.finite(canvas_h_panel_in) && canvas_h_panel_in > 0) {
    canvas_h_panel_in
  } else {
    max(1L, n_categorias) * alto_por_cat_eff
  }

	  has_header  <- (!is.null(titulo) && nzchar(titulo)) || (!is.null(subtitulo) && nzchar(subtitulo))
	  has_caption <- !is.null(caption_text) && nzchar(caption_text)

	  h_header_in  <- if (has_header)  {
	    has_t <- !is.null(titulo) && nzchar(titulo)
	    has_s <- !is.null(subtitulo) && nzchar(subtitulo)
	    min_header <- if (has_t && has_s) 0.44 else if (has_s) 0.32 else 0.26
	    h_in <- suppressWarnings(as.numeric(canvas_h_header_in %||% NA_real_)[1])
	    if (!is.finite(h_in) || h_in <= 0) min_header else max(h_in, min_header)
	  } else 0
	  h_legend_in  <- if (has_legend && !legend_is_side)  canvas_h_legend_in  else 0
	  # B46/G-21: sin caption propio, la Base del SLIDE vive justo debajo del
	  # canvas — canvas_h_reserva_pie_in deja esa banda vacia (mismo carril
	  # que apiladas, B44).
	  reserva_pie_in <- suppressWarnings(as.numeric(canvas_h_reserva_pie_in)[1])
	  if (!is.finite(reserva_pie_in) || reserva_pie_in < 0) reserva_pie_in <- 0
	  h_caption_in <- if (has_caption) canvas_h_caption_in else reserva_pie_in

  h_total_in <- h_header_in + h_panel_in + h_legend_in + h_caption_in
  if (h_total_in <= 0) h_total_in <- 1

  header_h  <- h_header_in  / h_total_in
  panel_h   <- h_panel_in   / h_total_in
  legend_h  <- h_legend_in  / h_total_in
  caption_h <- h_caption_in / h_total_in

  y_header0 <- 1 - header_h
  if (has_legend && legend_is_top && !legend_is_side) {
    y_legend0  <- y_header0 - legend_h
    y_panel0   <- y_legend0 - panel_h
    y_caption0 <- y_panel0 - caption_h
  } else {
    y_panel0   <- y_header0 - panel_h
    y_legend0  <- y_panel0  - legend_h
    y_caption0 <- y_legend0 - caption_h
  }

  # widths
  w_etq   <- canvas_w_etiquetas
  w_buf1  <- canvas_w_buf_etq_bars
  w_bars  <- canvas_w_bars
  w_buf2  <- canvas_w_buf_bars_extra
  w_extra <- canvas_w_extra
  w_legend_side <- if (has_legend && legend_is_side) 0.18 else 0

  w_sum <- w_legend_side + w_etq + w_buf1 + w_bars + w_buf2 + w_extra
  if (!is.finite(w_sum) || w_sum <= 0) w_sum <- 1

  w_legend_side <- w_legend_side / w_sum
  w_etq   <- w_etq   / w_sum
  w_buf1  <- w_buf1  / w_sum
  w_bars  <- w_bars  / w_sum
  w_buf2  <- w_buf2  / w_sum
  w_extra <- w_extra / w_sum

  if (isTRUE(canvas_w_adaptativo) && length(etiquetas_vec)) {
    visible_lines <- unlist(
      strsplit(as.character(etiquetas_vec), "\n", fixed = TRUE),
      use.names = FALSE
    )
    visible_lines <- visible_lines[!is.na(visible_lines)]
    max_chars <- if (length(visible_lines)) {
      max(nchar(visible_lines, type = "width", allowNA = FALSE, keepNA = FALSE), na.rm = TRUE)
    } else 0
    if (!is.finite(max_chars)) max_chars <- 0

    plot_width_in <- suppressWarnings(as.numeric(ancho)[1])
    if (!is.finite(plot_width_in) || plot_width_in <= 0) plot_width_in <- 10
    estimated_label_in <- max_chars * (size_ejes_eff / 72) * 0.52 + 0.16
    fixed_share <- w_legend_side + w_buf1 + w_buf2 + w_extra
    available_share <- max(0, 1 - fixed_share)
    max_label_share <- max(0.22, min(0.46, available_share - 0.50))
    target_label_share <- min(
      max_label_share,
      max(0.22, estimated_label_in / plot_width_in)
    )
    target_bar_share <- available_share - target_label_share

    if (is.finite(target_bar_share) && target_bar_share >= 0.50) {
      w_etq <- target_label_share
      w_bars <- target_bar_share
    }
  }

  x_legend_side0 <- if (identical(leyenda_posicion, "izquierda")) 0 else NA_real_
  x_etq0   <- if (identical(leyenda_posicion, "izquierda")) w_legend_side else 0
  x_buf10  <- x_etq0 + w_etq
  x_bars0  <- x_buf10 + w_buf1
  x_buf20  <- x_bars0 + w_bars
  x_extra0 <- x_buf20 + w_buf2
  if (identical(leyenda_posicion, "derecha")) x_legend_side0 <- x_extra0 + w_extra

  # top row (titulo extra)
  top_in <- canvas_h_toprow_in %||% 0
  if (!is.finite(top_in) || is.na(top_in) || top_in < 0) top_in <- 0
  top_in <- min(top_in, h_panel_in * 0.45)
  top_h  <- if (top_in > 0) top_in / h_total_in else 0

  main_h  <- panel_h - top_h
  y_top0  <- y_panel0 + main_h
  y_main0 <- y_panel0

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

  canvas <- cowplot::ggdraw()

  # HEADER
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
        family = font_family,
        fontface = if ("titulo" %in% textos_negrita) "bold" else "plain"
      )
    }
    if (has_s) {
      canvas <- canvas + cowplot::draw_text(
        text     = subtitulo,
        x        = hjust_titulo,
        y        = y_sub,
        hjust    = hjust_titulo,
        vjust    = 0.5,
        size     = size_subtitulo,
        colour   = color_subtitulo,
        family = font_family,
        fontface = face_subtitulo %||% "italic"
      )
    }

    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_header0, 1, header_h)
  }

  # TOP ROW: titulo extra
  if (top_h > 0) {

    if (debug_ph_bordes) {
      canvas <- canvas +
        .ph_border(x_etq0,   y_top0, w_etq,   top_h) +
        .ph_border(x_bars0,  y_top0, w_bars,  top_h) +
        .ph_border(x_extra0, y_top0, w_extra, top_h)
    }

    if (isTRUE(mostrar_barra_extra) && !is.null(titulo_barra_extra) && nzchar(titulo_barra_extra)) {
      canvas <- canvas + cowplot::draw_text(
        text     = titulo_barra_extra,
        x        = x_extra0 + (w_extra * 0.5),
        y        = y_top0 + (top_h * 0.2),
        hjust    = 0.5,
        vjust    = 0,
        size     = size_barra_extra,
        colour   = color_barra_extra,
        family = font_family,
        fontface = "bold"
      )
    }
  }

  # MAIN: panel barras
  canvas <- canvas +
    cowplot::draw_plot(p_panel, x = x_bars0, y = y_main0, width = w_bars, height = main_h)

  # coords Y por fila
  y_npc <- (seq_len(n_categorias) - 0.5) / n_categorias
  y_abs <- y_main0 + y_npc * main_h

  # etiquetas izquierda
  pad_x <- 0.018
  label_hjust <- if (identical(alinear_etiquetas, "izquierda")) 0 else 1
  x_lab <- if (identical(alinear_etiquetas, "izquierda")) {
    x_etq0 + w_etq * pad_x
  } else {
    x_etq0 + w_etq * (1 - pad_x)
  }
  fontface_etq <- if ("eje_y" %in% textos_negrita) "bold" else "plain"

  text_args_eje_y <- list(
    text     = NULL,
    x        = x_lab,
    y        = NULL,
    hjust    = label_hjust,
    vjust    = 0.5,
    size     = size_ejes_eff,
    colour   = color_ejes,
    family   = font_family,
    fontface = fontface_etq
  )
  text_args_eje_y$lineheight <- lineheight_eje_y_render
  for (i in seq_len(n_categorias)) {
    text_args_eje_y$text <- etiquetas_vec[i]
    text_args_eje_y$y <- y_abs[i]
    canvas <- canvas + do.call(cowplot::draw_text, text_args_eje_y)
  }

  # extra derecha
  x_extra_txt <- x_extra0 + (w_extra * 0.5)
  fontface_extra <- if ("barra_extra" %in% textos_negrita) "bold" else "plain"
  for (i in seq_len(n_categorias)) {
    if (nzchar(extra_labels[i])) {
      canvas <- canvas + cowplot::draw_text(
        text     = extra_labels[i],
        x        = x_extra_txt,
        y        = y_abs[i],
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_barra_extra,
        colour   = color_barra_extra,
        family = font_family,
        fontface = fontface_extra
      )
    }
  }

  if (debug_ph_bordes) {
    canvas <- canvas +
      .ph_border(x_etq0,   y_main0, w_etq,   main_h) +
      .ph_border(x_buf10,  y_main0, w_buf1,  main_h) +
      .ph_border(x_bars0,  y_main0, w_bars,  main_h) +
      .ph_border(x_buf20,  y_main0, w_buf2,  main_h) +
      .ph_border(x_extra0, y_main0, w_extra, main_h)
  }

  # LEYENDA
  if (has_legend && !is.null(leg_grob)) {

    dy_leg <- leyenda_desplazamiento_in / h_total_in
    if (legend_is_side) {
      canvas <- canvas + cowplot::draw_grob(
        leg_grob,
        x = x_legend_side0 + (w_legend_side * 0.5),
        y = y_main0 + (main_h * 0.5) + dy_leg,
        width  = w_legend_side,
        height = main_h,
        hjust  = 0.5,
        vjust  = 0.5
      )
      if (debug_ph_bordes) canvas <- canvas + .ph_border(x_legend_side0, y_main0, w_legend_side, main_h)
    } else {
      pos_leyenda_x <- 0.5
      if (!is.na(centro_cowplot) && is.finite(centro_cowplot)) pos_leyenda_x <- centro_cowplot

      y_legend_center <- y_legend0 + (legend_h * 0.5)

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
  }

  # CAPTION
  if (has_caption) {
    # El pie se alinea con la columna de contenido (ver `.graficos_caption_x`).
    cap <- .graficos_caption_x(hjust_caption, x_etq0, x_extra0 + w_extra)

    canvas <- canvas + cowplot::draw_text(
      text  = caption_text,
      x     = cap$x,
      y     = y_caption0 + (caption_h * 0.35),
      hjust = hjust_caption,
      vjust = 0.5,
      size  = size_nota_pie,
      family = font_family,
      colour= color_nota_pie
    )
    if (debug_ph_bordes) canvas <- canvas + .ph_border(cap$x0, y_caption0, cap$x1 - cap$x0, caption_h)
  }

  # ---------------------------------------------------------------------------
  # 10) EXPORT CANVAS
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") {
    attr(canvas, "alto_word_sugerido") <- h_total_in
    attr(canvas, "pulso_barras_agrupadas_layout") <- list(
      n_categorias = n_categorias,
      base_max = base_max,
      usar_eje_libre = isTRUE(usar_eje_libre),
      grosor_eff = grosor_barras_eff,
      canvas_min_filas = canvas_min_filas_eff,
      h_panel_in = h_panel_in,
      size_ejes_eff = size_ejes_eff,
      size_texto_barras_eff = size_texto_barras_eff,
      lineheight_eje_y_eff = lineheight_eje_y_eff,
      ancho_max_eje_y_eff = ancho_max_eje_y_eff,
      canvas_w_etiquetas_eff = w_etq,
      canvas_w_bars_eff = w_bars,
      alinear_etiquetas = alinear_etiquetas
    )
    return(canvas)
  }

  if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

  if (exportar == "png") {
    ggplot2::ggsave(filename = path_salida, plot = canvas, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
    return(invisible(canvas))
  }

  if (exportar %in% c("ppt", "word")) {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

    if (exportar == "ppt") {
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

  stop("Tipo de exportacion no soportado.", call. = FALSE)
}
