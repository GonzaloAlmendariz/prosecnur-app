# =============================================================================
# graficos_barras_comparativo.R — segunda serie declarada en barras agrupadas
# =============================================================================
#
# QUÉ RESUELVE: una lámina de perfil («Sexo», «Rango de edades») dibuja la ola
# actual y nada más. Cuando el estudio tiene una medición previa —el mismo
# público, las mismas categorías, otro año— no había forma de ponerla al lado:
# el renderer arma UNA columna de porcentaje desde la base y el motor solo sabe
# multiplicar series a partir de un cruce, que es otra cosa (segmentos de la
# misma ola, no dos olas).
#
# DE DÓNDE SALEN LOS VALORES: se declaran en el plan de láminas, no se calculan
# de otra base. Es el mismo criterio —y el mismo caso real— que ya gobierna
# `graficos_top2box_comparativo.R`: en ACRD CONTA el 2021 existe como cifra de
# un informe consolidado previo, no como base procesable del `.pulso`. Exigir
# una base para poder comparar dejaría la función inservible justo donde se
# necesita. Si algún día el histórico llega como base, el spec ya está
# normalizado por categoría y basta alimentarlo desde ahí.
#
# POR QUÉ VIVE APARTE: el enganche natural sería `.render_barras_agrupadas()`,
# pero `reporte_plan_ppt.R` está congelado a crecimiento. El graficador es el
# dueño de su propia entrada, así que la expansión ocurre ahí: `comparativo`
# viaja como override hasta `graficar_barras_agrupadas()` y este archivo
# convierte «una serie + un histórico declarado» en «dos series» antes de que
# el motor valide nada. El congelado no se toca.

# Gris de la serie anterior. La ola previa es contexto, no el sujeto de la
# lámina: va en gris para que el ojo lea primero la actual.
#
# POR QUE UN GRIS MEDIO Y NO EL `#BFBFBF` DE LA PALETA: la cifra dentro de la
# barra va SIEMPRE en blanco —decisión de la casa, y la misma que
# `graficador_contraste_texto.R` toma para la familia dicotómica: una lámina
# donde unas cifras salen blancas y otras azules se lee como un error aunque
# cada una, por separado, tenga contraste—. Con el gris claro de la paleta
# (luminancia 0,749) el blanco desaparecía. `#808080` es el gris más claro que
# queda por debajo del umbral de la casa (0,502 contra 0,52), así que conserva
# la lectura de «contexto» frente al azul y deja la cifra blanca legible.
.BARRAS_COMPARATIVO_COLOR_ANTERIOR <- "#808080"

# Ancho del grupo dentro de la unidad de categoría, con comparativo.
#
# Hace dos cosas a la vez: fija el aire que queda ENTRE categorías (1 − 0,86) y,
# como el grosor de barra se iguala a él, cierra el hueco DENTRO del par. Las
# dos barras de una categoría son la misma medida en dos olas —van pegadas—;
# lo que tiene que separar es una categoría de la siguiente.
#
# El default del motor (0,70) deja 30 % de aire entre categorías, que con una
# sola barra separa bien y con dos es justo lo que le falta al panel.
.BARRAS_COMPARATIVO_DODGE <- 0.86

#' Normaliza el spec del comparativo contra las categorías reales del gráfico.
#'
#' Devuelve `NULL` cuando no hay nada que comparar — la señal de que el gráfico
#' debe dibujarse como siempre, con su serie única.
#' @noRd
.barras_comparativo_normalizar <- function(comparativo, categorias, escala_grafico) {
  if (is.null(comparativo)) return(NULL)
  categorias <- as.character(categorias)
  if (!length(categorias)) return(NULL)

  # Atajo de conveniencia: un vector nombrado suelto es «solo los valores».
  if (!is.list(comparativo)) comparativo <- list(valores = comparativo)

  vals_in <- comparativo$valores %||% comparativo$valores_anterior %||% NULL
  if (is.null(vals_in) || !length(vals_in)) return(NULL)
  if (is.list(vals_in)) vals_in <- unlist(vals_in, use.names = TRUE)

  nms <- names(vals_in)
  if (is.null(nms) || !any(nzchar(trimws(nms)))) {
    # Sin nombres solo se puede alinear por posición, y solo si calza exacto.
    # Reciclar un vector corto sería inventarle un histórico a las filas que no
    # lo declararon —el defecto que ya se cerró en la columna extra de apiladas.
    if (length(vals_in) != length(categorias)) return(NULL)
    nms <- categorias
  }

  vals_num <- suppressWarnings(as.numeric(vals_in))
  clave <- function(x) .graficos_norm_text_key(x)
  idx <- match(clave(categorias), clave(nms))

  valores <- rep(NA_real_, length(categorias))
  hit <- !is.na(idx)
  valores[hit] <- vals_num[idx[hit]]
  # Ninguna categoría resolvió: el spec habla de otra pregunta. Mejor dibujar
  # la serie única que dibujar una serie vacía que parece un cero medido.
  if (!any(is.finite(valores))) return(NULL)

  # Una clave declarada que no resuelve se pierde SIN dejar rastro: la lámina
  # sale con una barra gris menos y nadie lo nota. Pasó de verdad —«Otro
  # (especifique)» del instrumento contra el «Otros» que el motor dibuja— y es
  # el defecto que la casa persigue: descartar en silencio.
  #
  # La causa casi siempre es la misma y por eso se nombra: la etiqueta que hay
  # que declarar es la que sale DIBUJADA en la barra, no la del instrumento.
  # El motor renombra («Otros»), recorta y reordena antes de llegar aquí.
  huerfanas <- setdiff(clave(nms[nzchar(trimws(nms))]), clave(categorias))
  if (length(huerfanas)) {
    sin_resolver <- nms[clave(nms) %in% huerfanas]
    .pulso_aviso(
      "Comparativo de barras: ", length(sin_resolver),
      " categoría(s) del histórico no coinciden con ninguna barra y quedaron fuera (",
      paste(utils::head(sin_resolver, 4L), collapse = ", "),
      if (length(sin_resolver) > 4L) sprintf(", +%d", length(sin_resolver) - 4L) else "",
      "). Declara la etiqueta tal como aparece dibujada en la barra: el motor ",
      "renombra («Otros»), recorta y reordena antes de graficar."
    )
  }

  # La escala se declara, no se adivina: 1.0 es «100 %» en proporción y «1 %»
  # en base 100, y no hay forma de distinguirlos mirando los números. Sin
  # declaración se asume la misma escala en la que ya viene el gráfico.
  escala <- comparativo$escala %||% escala_grafico
  escala <- as.character(escala)[1]
  if (!escala %in% c("proporcion_1", "proporcion_100")) escala <- escala_grafico
  if (!identical(escala, escala_grafico)) {
    valores <- if (identical(escala_grafico, "proporcion_100")) valores * 100 else valores / 100
  }

  etiqueta_anterior <- .barras_comparativo_texto(comparativo$etiqueta %||% comparativo$etiqueta_anterior, "Anterior")
  etiqueta_actual   <- .barras_comparativo_texto(comparativo$etiqueta_actual, "Actual")
  if (identical(etiqueta_anterior, etiqueta_actual)) {
    # Dos series con el mismo rótulo colapsan en la leyenda y el lector no sabe
    # cuál es cuál. Se desempata sin inventar un año que nadie declaró.
    etiqueta_anterior <- paste0(etiqueta_anterior, " (anterior)")
  }

  list(
    valores           = valores,
    etiqueta_anterior = etiqueta_anterior,
    etiqueta_actual   = etiqueta_actual,
    color_anterior    = .barras_comparativo_texto(comparativo$color %||% comparativo$color_anterior,
                                                  .BARRAS_COMPARATIVO_COLOR_ANTERIOR),
    color_actual      = .barras_comparativo_texto(comparativo$color_actual, NULL)
  )
}

#' @noRd
.barras_comparativo_texto <- function(x, default) {
  if (is.null(x)) return(default)
  x <- as.character(x)[1]
  if (is.na(x) || !nzchar(trimws(x))) return(default)
  trimws(x)
}

#' Convierte «una serie + histórico declarado» en «dos series».
#'
#' Devuelve `NULL` cuando no aplica; en ese caso el llamador sigue con los
#' argumentos que ya tenía. Cuando aplica, devuelve la lista de argumentos que
#' el motor debe usar en lugar de los suyos.
#'
#' No aplica sobre un cruce: ahí las series ya son segmentos de la misma ola y
#' agregar una tercera de otro año mezclaría dos ejes de comparación en un
#' mismo grupo de barras.
#' @noRd
.barras_comparativo_expandir <- function(data,
                                         var_categoria,
                                         cols_porcentaje,
                                         etiquetas_series,
                                         cols_n,
                                         colores_series,
                                         comparativo,
                                         escala_valor) {
  if (is.null(comparativo)) return(NULL)
  if (length(cols_porcentaje) != 1L) return(NULL)
  if (!var_categoria %in% names(data)) return(NULL)
  if (!cols_porcentaje %in% names(data)) return(NULL)

  spec <- .barras_comparativo_normalizar(
    comparativo,
    categorias     = data[[var_categoria]],
    escala_grafico = escala_valor
  )
  if (is.null(spec)) return(NULL)

  col_actual <- cols_porcentaje[[1]]
  col_previa <- ".pct_comparativo"
  while (col_previa %in% names(data)) col_previa <- paste0(col_previa, "_")

  data[[col_previa]] <- spec$valores

  # La serie anterior llega como porcentaje de un informe previo: no trae
  # frecuencias. Se declara la columna igual —con NA— porque el motor exige que
  # `cols_n` cubra TODAS las columnas de porcentaje, y NA es la forma honesta de
  # decir «esta serie no tiene N», distinta de un 0 que sí sería un dato.
  cols_n_out <- cols_n
  if (!is.null(cols_n) && length(cols_n)) {
    col_n_previa <- ".n_comparativo"
    while (col_n_previa %in% names(data)) col_n_previa <- paste0(col_n_previa, "_")
    data[[col_n_previa]] <- NA_real_
    if (is.list(cols_n_out) && !is.data.frame(cols_n_out)) cols_n_out <- unlist(cols_n_out, use.names = TRUE)
    cols_n_out <- as.character(cols_n_out)
    names(cols_n_out) <- names(cols_n)
    if (is.null(names(cols_n_out)) || !all(nzchar(trimws(names(cols_n_out))))) {
      names(cols_n_out) <- col_actual
    }
    cols_n_out[[col_previa]] <- col_n_previa
  }

  etiquetas_out <- stats::setNames(
    c(spec$etiqueta_actual, spec$etiqueta_anterior),
    c(col_actual, col_previa)
  )

  # El color de la serie actual solo se pisa si el spec lo declara: si el
  # analista ya eligió una paleta para el gráfico, esa elección manda —el mismo
  # criterio con el que el motor decide el monocromo del perfil.
  color_actual <- spec$color_actual
  if (is.null(color_actual)) {
    declarado <- colores_series
    if (!is.null(declarado) && length(declarado)) {
      nm <- names(declarado)
      color_actual <- if (!is.null(nm) && spec$etiqueta_actual %in% nm) {
        declarado[[spec$etiqueta_actual]]
      } else {
        unname(declarado)[[1]]
      }
    }
  }
  if (is.null(color_actual)) color_actual <- .PULSO_PPT_COLORS$azul

  list(
    data             = data,
    cols_porcentaje  = unname(c(col_actual, col_previa)),
    etiquetas_series = etiquetas_out,
    cols_n           = cols_n_out,
    colores_series   = stats::setNames(
      c(color_actual, spec$color_anterior),
      c(spec$etiqueta_actual, spec$etiqueta_anterior)
    )
  )
}

#' Avisa si el color de la ola anterior no admite la cifra blanca.
#'
#' La cifra dentro de la barra va siempre en blanco, en las dos series: es la
#' decisión de la casa y la que pidió el analista. Eso vuelve al COLOR DE LA
#' BARRA el responsable de la legibilidad, y un gris demasiado claro la rompe
#' en silencio —blanco sobre `#BFBFBF` simplemente no está—. Es el mismo
#' mecanismo que documenta `graficador_contraste_texto.R`: cambiar un color de
#' fondo cambia qué color de texto encima se lee.
#'
#' No corrige el color: avisa. Quien declaró ese gris eligió, y una cifra que
#' cambia de color rompe la coherencia que la lámina necesita.
#'
#' @param colores_series Mapa etiqueta de serie -> color de relleno.
#' @param color_cifra Color de la cifra dentro de la barra.
#' @return `invisible(TRUE)` si algún color quedó sin contraste.
#' @noRd
.barras_comparativo_avisar_contraste <- function(colores_series, color_cifra = "white") {
  if (!identical(tolower(as.character(color_cifra)[1]), "white")) return(invisible(FALSE))
  fills <- unname(colores_series)
  nombres <- names(colores_series) %||% rep("", length(fills))
  lum <- .contraste_luminancia(fills)
  flojos <- !is.na(lum) & lum > .CONTRASTE_UMBRAL
  if (!any(flojos)) return(invisible(FALSE))
  .pulso_aviso(
    "Comparativo de barras: la cifra va en blanco y ",
    paste(sprintf("%s (%s)", nombres[flojos], fills[flojos]), collapse = ", "),
    " es demasiado claro para leerla. Usa un color por debajo de la luminancia ",
    .CONTRASTE_UMBRAL, " —el gris de la casa para esto es ",
    .BARRAS_COMPARATIVO_COLOR_ANTERIOR, "."
  )
  invisible(TRUE)
}

#' Tamaño de cifra que cabe DENTRO de una barra cuando hay dos series.
#'
#' Hermano de `.agrupadas_size_que_cabe()`, que resuelve lo mismo para las
#' etiquetas del eje. Cambia el denominador y por eso no es el mismo cálculo:
#' allí el espacio de una etiqueta es la fila de su categoría; aquí la cifra
#' vive dentro de UNA barra, y con dos series la categoría se parte en dos.
#'
#' Por qué hace falta: el perfil declara `preservar_tamanos_texto = TRUE` y una
#' cifra de 5,6 mm (~14 pt) calibrada para una sola serie. Al pedir la ola
#' anterior, seis categorías pasan a doce barras de 9,5 pt de alto y el texto
#' —de 14— deja de entrar: se monta sobre la barra vecina. Medido en el mazo de
#' ACRD CONTA, «Nivel curricular» y «Rango de edades».
#'
#' El alto que se mira es `alto` —el del cajón físico que el renderer inyecta
#' (`overrides$alto`, 2,565 in en las láminas de perfil)— y NO el nominal
#' `n_categorias * alto_por_categoria`. Es la misma trampa que ya costó las
#' etiquetas de eje de la lámina 13: con el nominal, seis categorías «tienen»
#' 6,12 pulgadas, la cuenta dice que todo entra y en el render se solapa.
#' `canvas_h_panel_in` no sirve aquí porque en PPT llega `NULL` siempre.
#'
#' El panel no se estima con una fracción: se calcula. El motor reparte el cajón
#' como `alto − cabecera − leyenda − pie`, y ese resto es todo el sitio que las
#' barras tienen. Medido con `trace()` sobre una lámina de perfil: cabecera
#' 0,422, leyenda 0,750, pie 0, y panel 1,393 de los 2,565 del cajón. Cualquier
#' fracción adivinada falla — la de 0,73 que estuvo aquí daba 1,873, un 34 % de
#' más, y por eso la cifra «cabía» y salía pisando el borde de su barra.
#'
#' La leyenda pesa MÁS que la cabecera (0,750 contra 0,422) y es una sola línea
#' de texto: ahí está la mayor bolsa de alto recuperable de la lámina.
#'
#' Pisar un tamaño declarado se avisa, nunca se hace en silencio: quien declaró
#' 14 pt y ve 7 necesita saber que fue el motor y no un error suyo.
#'
#' @param size_mm Tamaño declarado, en las unidades de `geom_text` (mm).
#' @param n_categorias Categorías del eje.
#' @param n_series Series por categoría.
#' @param alto_in Alto físico del cajón, en pulgadas.
#' @param header_in,legend_in,caption_in Alto del cromo que se come el cajón
#'   antes del panel, en pulgadas.
#' @param dodge Ancho del grupo dentro de la unidad de categoría. Sin él la
#'   cuenta cree que las barras llenan toda la categoría y sobreestima su alto
#'   un 43 %: la cifra «cabía» y salía montada sobre el borde de su barra.
#' @param frac Fracción del alto de barra que puede ocupar el texto. 0,66
#'   está medido: con 0,78 la cifra tocaba los bordes de su propia barra
#'   —el glifo real, con el «%» y su descendente, pasa del alto nominal—.
#' @param minimo_mm Piso: por debajo, la cifra deja de leerse y es mejor
#'   dejarla grande y que el analista decida quitar categorías.
#' @return El tamaño original, o el reducido si no cabía.
#' @noRd
.barras_comparativo_size_cifra <- function(size_mm, n_categorias, n_series,
                                           alto_in, header_in = 0, legend_in = 0,
                                           caption_in = 0, dodge = 0.90,
                                           frac = 0.72, minimo_mm = 2.6) {
  s <- suppressWarnings(as.numeric(size_mm)[1])
  n_cat <- suppressWarnings(as.integer(n_categorias)[1])
  n_ser <- suppressWarnings(as.integer(n_series)[1])
  alto <- suppressWarnings(as.numeric(alto_in)[1])
  d <- suppressWarnings(as.numeric(dodge)[1])
  cromo <- sum(vapply(list(header_in, legend_in, caption_in), function(x) {
    v <- suppressWarnings(as.numeric(x)[1])
    if (!is.finite(v) || v < 0) 0 else v
  }, numeric(1)))
  if (!is.finite(s) || s <= 0) return(size_mm)
  if (!is.finite(n_cat) || n_cat <= 0) return(s)
  if (!is.finite(n_ser) || n_ser <= 1L) return(s)
  if (!is.finite(alto) || alto <= 0) return(s)
  if (!is.finite(d) || d <= 0 || d > 1) d <- 0.9

  panel_in <- alto - cromo
  if (!is.finite(panel_in) || panel_in <= 0) return(s)
  alto_barra_in <- panel_in * d / (n_cat * n_ser)
  alto_texto_in <- s / 25.4
  if (alto_texto_in <= alto_barra_in * frac) return(s)

  s_max <- max(minimo_mm, alto_barra_in * frac * 25.4)
  if (s_max >= s) return(s)
  .pulso_aviso(
    "Comparativo de barras: la cifra baja de ", round(s * 72 / 25.4, 1), " a ",
    round(s_max * 72 / 25.4, 1), " pt porque ", n_cat,
    " categorías en dos series dejan barras de ",
    round(alto_barra_in * 72, 1), " pt y el texto declarado no entra. ",
    "Para conservar el tamaño, quita categorías o dale más alto a la lámina."
  )
  s_max
}

#' Alto de cabecera que el título realmente necesita.
#'
#' El panel se reparte así: `alto − cabecera − leyenda − pie`. En las láminas de
#' perfil la cabecera está declarada en 0,756 in y el título es UNA línea de
#' 16 pt (0,22 in): sobran cuatro décimas de pulgada, el 29 % del cajón, que se
#' ven como un hueco entre el título y la primera barra.
#'
#' Con una sola serie eso no molestaba —las barras salían gruesas igual—. Con
#' dos, la categoría se parte y ese hueco es justo lo que le falta al panel:
#' recuperarlo engorda cada barra un 18 % y es lo que permite que la cifra
#' quepa sin encogerse más.
#'
#' Solo RECORTA, nunca crece: un preset que ya declara una cabecera ajustada se
#' respeta tal cual. El factor 1,9 sobre el cuerpo del título deja aire para el
#' ascendente y el descendente; medido contra el título más largo del mazo
#' («Años trabajando en la Unidad de Ciencias Contables»), que sigue entrando
#' entero en una línea.
#'
#' Sirve igual para la leyenda, que es el mismo caso con otro texto: una línea
#' declarada en 0,750 in para un cuerpo de 16 pt.
#'
#' @param header_in Cabecera declarada, en pulgadas.
#' @param size_titulo Cuerpo del título, en puntos.
#' @param minimo_in Piso duro, el mismo que el motor aplica sin subtítulo.
#' @return La cabecera declarada o la recortada, la que sea menor.
#' @noRd
.barras_comparativo_header <- function(header_in, size_titulo, minimo_in = 0.26) {
  h <- suppressWarnings(as.numeric(header_in)[1])
  if (!is.finite(h) || h <= 0) return(header_in)
  s <- suppressWarnings(as.numeric(size_titulo)[1])
  if (!is.finite(s) || s <= 0) return(h)
  necesario <- max(minimo_in, s / 72 * 1.9)
  if (necesario >= h) return(h)
  necesario
}
