# =============================================================================
# reporte_plan_numerico.R — la tarjeta numérica dice qué estadístico muestra
#                           (L6 / H36-H37-H38)
# =============================================================================
#
# DEFECTO que repara: `p_numerico` declaraba cuatro métricas (media, mediana,
# conteo, porcentaje) y un formato de salida, y el motor no leía ninguno de los
# dos. Peor: la misma partícula viajaba declarada de tres formas distintas.
#
#   p_numerico()          → "N"     (por el orden de match.arg, no por decisión)
#   graficos_metadata.R   → "mean"  (primera opción de la lista, sin default)
#   .render_numerico()    → mean()  cableado, leyenda «Media» fija
#
# El analista pedía mediana sobre ingresos con cola larga y recibía la media
# rotulada «Media»: una cifra correcta para una pregunta que no hizo. El
# forense está en P24 del doc vivo (medianas reales 1.961,5/1.991,5 frente a
# medias 2.171,1/2.253,7 renderizadas).
#
# DECISIÓN: el default canónico es `mean`, no `N`. Es lo que el motor ya
# renderizaba (así que ningún reporte existente cambia de cifra), lo que la UI
# ofrece primero, y lo que el preset editorial asume al traer
# `colores_series = c(Media = "#081F5C")`.
#
# `formato` tenía dos lecturas legítimas conviviendo en su propia descripción
# —sprintf numérico (`'%.1f'`) y plantilla de texto (`'S/ %s'`)— y se
# implementan LAS DOS, resueltas por la conversión presente. La plantilla de
# texto envuelve la cifra ya formateada y por tanto conserva los separadores de
# la casa (miles ".", decimal ","), que un sprintf crudo habría destruido.
#
# Estos helpers viven aquí y no en reporte_plan_ppt.R porque ese archivo está
# congelado a crecimiento (ver `agentic/manifest.json`).

.NUMERICO_METRICAS <- c("mean", "median", "N", "pct")

#' Resuelve la metrica efectiva de una tarjeta numerica
#'
#' Cascada de la vara: override del slide > elemento > preset > suelo del motor.
#' Un valor desconocido cae a `"mean"` en vez de abortar: la lamina se rinde.
#'
#' @param overrides Lista de overrides del elemento.
#' @param el Elemento `ppt_element` de tipo numerico.
#' @param preset_args Lista de argumentos del preset ya enriquecido.
#' @return `character(1)` con una de `.NUMERICO_METRICAS`.
#' @keywords internal
.numerico_resolver_metrica <- function(overrides, el, preset_args) {
  m <- overrides$metrica
  if (is.null(m)) m <- el$metrica
  if (is.null(m)) m <- preset_args$metrica
  if (is.null(m)) m <- "mean"

  # H41: los alias en espanol se respetan («mediana» no cae a la media); lo que no se reconoce cae a la media con aviso.
  if (!is.character(m) || length(m) != 1L) return("mean")
  r <- tryCatch(.plan_metrica_numerica(m), error = function(e) NULL)
  if (is.null(r) || !(r %in% .NUMERICO_METRICAS)) {
    warning(sprintf("Métrica «%s» no reconocida en p_numerico: se usa la media.", m), call. = FALSE)
    r <- "mean"
  }
  r
}

#' Etiqueta de leyenda que corresponde a cada metrica
#'
#' @param metrica Una de `.NUMERICO_METRICAS`.
#' @return `character(1)`.
#' @keywords internal
.numerico_etiqueta_metrica <- function(metrica) {
  switch(
    metrica,
    mean   = "Media",
    median = "Mediana",
    N      = "Casos",
    pct    = "Porcentaje",
    "Media"
  )
}

#' Agrega un vector numerico segun la metrica pedida
#'
#' `pct` necesita un universo explicito porque su denominador NO es el vector:
#' sin cruce es la cobertura (validos sobre casos de la base) y con cruce es la
#' participacion del grupo sobre el total valido.
#'
#' @param v Vector numerico ya filtrado a valores finitos.
#' @param n_universo Denominador de `pct`.
#' @param metrica Una de `.NUMERICO_METRICAS`.
#' @return `numeric(1)`.
#' @keywords internal
.numerico_agregar <- function(v, n_universo, metrica) {
  switch(
    metrica,
    mean   = mean(v, na.rm = TRUE),
    median = stats::median(v, na.rm = TRUE),
    N      = length(v),
    pct    = if (isTRUE(n_universo > 0)) length(v) / n_universo * 100 else NA_real_,
    mean(v, na.rm = TRUE)
  )
}

#' Re-kea el color de la serie unica cuando la etiqueta cambia
#'
#' TRAMPA: el preset editorial trae `colores_series` keyed por la ETIQUETA de
#' la serie (`Media` = navy de la casa), no por su nombre interno. Al renombrar
#' la serie a «Mediana» el lookup por nombre de `.graficos_mk_palette` fallaba
#' en silencio y la serie caia al azul generico del fallback. Solo aplica a la
#' entrada unica: con varias series el analista mandó nombres propios.
#'
#' @param cols Vector nombrado de colores, o NULL.
#' @param etiqueta Etiqueta final de la serie.
#' @return El mismo vector con el nombre corregido.
#' @keywords internal
.numerico_rekey_colores <- function(cols, etiqueta) {
  if (is.null(cols) || length(cols) != 1L) return(cols)
  nm <- names(cols)
  if (is.null(nm) || !nzchar(nm[[1L]]) || identical(nm[[1L]], etiqueta)) return(cols)
  stats::setNames(cols, etiqueta)
}

#' Formato de etiqueta efectivo de la tarjeta numerica
#'
#' `pct` estrena su sufijo editorial cuando el analista no declaro formato.
#'
#' @param el Elemento del plan.
#' @param overrides Lista de overrides.
#' @param preset_args Lista del preset.
#' @param metrica Una de `.NUMERICO_METRICAS`.
#' @return `character(1)` o NULL.
#' @keywords internal
.numerico_formato <- function(el, overrides, preset_args, metrica) {
  fmt <- el$formato
  if (is.null(fmt)) fmt <- overrides$formato
  if (is.null(fmt)) fmt <- preset_args$formato
  if (is.null(fmt) && identical(metrica, "pct")) fmt <- "%s%%"

  if (is.null(fmt) || !is.character(fmt) || length(fmt) != 1L || !nzchar(trimws(fmt))) {
    return(NULL)
  }
  trimws(fmt)
}

#' Defaults editoriales que arrastra la metrica elegida
#'
#' Patron P9 (default editorial > default funcional): un conteo no se lee
#' «20,0», y el «N = 20» encima de la barra sobra cuando la barra ES el conteo.
#'
#' Doctrina de la casa: un grafico cuyo indicador principal es el PORCENTAJE
#' muestra solo el porcentaje. Por eso `pct` tampoco arrastra el N encima de la
#' barra: emparejar cifra y frecuencia es una opcion que el analista enciende,
#' no un default. Solo se aplican si no los declaro en overrides.
#'
#' Los decimales del conteo ceden también ante el preset del tipo (O7c): «Aplicar a todos los gráficos del tipo»
#' escribe `decimales` en el preset, y un 0 inyectado como override lo pisaba siempre.
#'
#' @param overrides Lista de overrides del elemento.
#' @param metrica Una de `.NUMERICO_METRICAS`.
#' @param preset_args Lista del preset del tipo.
#' @return La lista de overrides con los defaults inyectados.
#' @keywords internal
.numerico_overrides_editoriales <- function(overrides, metrica, preset_args = list()) {
  if (!(metrica %in% c("N", "pct"))) return(overrides)

  if (identical(metrica, "N") && is.null(overrides$decimales) && is.null(preset_args$decimales)) overrides$decimales <- 0
  if (is.null(overrides$mostrar_n_sobre_barras)) overrides$mostrar_n_sobre_barras <- FALSE
  overrides
}

#' Ajusta preset y overrides a la metrica elegida
#'
#' Agrupa los tres efectos que la metrica tiene sobre los argumentos del
#' graficador: re-kear el color de la serie, traducir `formato` al formal
#' `formato_etiqueta` y aplicar los defaults editoriales.
#'
#' @param el Elemento del plan.
#' @param preset_args Lista del preset.
#' @param overrides Lista de overrides.
#' @param metrica Una de `.NUMERICO_METRICAS`.
#' @param etiqueta Etiqueta final de la serie.
#' @return Lista con `preset_args` y `overrides` ya ajustados.
#' @keywords internal
.numerico_ajustar_args <- function(el, preset_args, overrides, metrica, etiqueta) {
  preset_args$colores_series <- .numerico_rekey_colores(preset_args$colores_series, etiqueta)
  overrides$colores_series   <- .numerico_rekey_colores(overrides$colores_series, etiqueta)

  fmt <- .numerico_formato(el, overrides, preset_args, metrica)
  preset_args$formato <- NULL
  overrides$formato   <- NULL
  if (!is.null(fmt)) overrides$formato_etiqueta <- fmt

  list(
    preset_args = preset_args,
    overrides   = .numerico_overrides_editoriales(overrides, metrica, preset_args)
  )
}

#' Sella en la lamina lo que la tarjeta numerica decidio
#'
#' Con canvas las etiquetas viven dentro de grobs y `ggplot_build()` no las
#' alcanza: sin estos atributos la particula no es aseverable por test.
#'
#' @param p Objeto devuelto por el graficador.
#' @param metrica Metrica efectiva.
#' @param etiqueta Etiqueta de la serie.
#' @param df_wide Data frame agregado que se envio al graficador.
#' @param nombre_serie Nombre de la columna de valor.
#' @param args Lista de argumentos finales pasados al graficador.
#' @return `p` con los atributos `pulso_numerico_*`.
#' @keywords internal
.numerico_sellar <- function(p, metrica, etiqueta, df_wide, nombre_serie, args) {
  if (is.null(p)) return(NULL)

  attr(p, "pulso_numerico_metrica")  <- metrica
  attr(p, "pulso_numerico_etiqueta") <- etiqueta
  attr(p, "pulso_numerico_data")     <- tibble::tibble(
    categoria = as.character(df_wide$categoria),
    N         = df_wide$N,
    valor     = df_wide[[nombre_serie]]
  )
  attr(p, "pulso_numerico_colores")        <- args$colores_series
  attr(p, "pulso_numerico_n_sobre_barras") <- isTRUE(args$mostrar_n_sobre_barras)
  attr(p, "pulso_numerico_etiquetas_valor") <- attr(p, "pulso_barras_numericas_labels")
  # ADR 0093 (N4): lo que afirma la lámina «Indicador numérico» (lámina 80): una columna por grupo, en el orden
  # del instrumento, con su cifra y su número de casos. La cifra va con punto decimal como en el recetario
  # («20.5») y con el redondeo de la casa; no se toma de las etiquetas del gráfico, que usan
  # `separador_decimales` (coma por defecto) y no garantizan el orden de los grupos.
  # `.numerico_agregar` ya entrega `pct` en 0-100 (verificador de N4: se multiplicaba otra vez por 100). Los
  # decimales son los del gráfico (1 por defecto; 0 en N por default editorial) y el formato declarado por el
  # analista («S/ %s», «%s%%» en pct) se aplica igual que en el gráfico, con coma de millares como es-PE.
  valor <- suppressWarnings(as.numeric(df_wide[[nombre_serie]]))
  dec <- suppressWarnings(as.integer(args$decimales %||% 1L)[1])
  if (!is.finite(dec) || dec < 0L) dec <- 1L
  num <- ifelse(is.finite(valor), formatC(.pulso_round_half_up(valor, dec), format = "f", digits = dec, big.mark = ","), "")
  fmt <- args$formato_etiqueta
  cifras <- if (is.character(fmt) && length(fmt) == 1L && grepl("%s", fmt, fixed = TRUE)) sprintf(fmt, num) else num
  o <- if (is.factor(df_wide$categoria)) order(as.integer(df_wide$categoria)) else seq_along(valor)
  attr(p, "pulso_espec") <- list(version = "numerico/1", tipo = "numerico", metrica = metrica, etiqueta = etiqueta,
                                 rotulos = as.character(df_wide$categoria)[o], valores = valor[o], cifras = cifras[o],
                                 n = suppressWarnings(as.numeric(df_wide$N))[o])

  p
}

#' Variable numerica cruda para metricas (H38)
#'
#' El resolvedor de referencias redirige `x` a `x_recod` cuando existe (para graficos de categorias es lo correcto).
#' Para metricas numericas (p_numerico, p_boxplot, p_media_rango) se vuelve a la columna pedida si existe y es
#' numerica: si no, se promediaban los codigos de los rangos.
#' @keywords internal
.ctx_var_numerica_cruda <- function(ctx) {
  pedida <- ctx$var_requested
  if (is.null(pedida) || identical(pedida, ctx$var) || !(pedida %in% names(ctx$data))) return(ctx)
  x <- ctx$data[[pedida]]
  if (is.factor(x)) x <- as.character(x)
  num <- suppressWarnings(as.numeric(x))
  presentes <- !is.na(x) & nzchar(trimws(as.character(x)))
  if (!any(presentes) || mean(is.finite(num[presentes])) < 0.9) return(ctx)
  ctx$var <- pedida
  ctx$recod_redirected <- FALSE
  ctx
}
