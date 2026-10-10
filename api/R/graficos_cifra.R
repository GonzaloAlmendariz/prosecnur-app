# La cifra destacada calculada desde los datos (F6.0b.6; inventario F6, A19).
#
# «Destacar cifras» tiene que salir con datos reales: el analista elige una pregunta y qué cifra quiere de ella —el
# porcentaje que eligió una categoría, cuántos respondieron, la mediana o la media— y el motor la calcula con la misma
# regla que el resto del informe: sobre quienes respondieron, con el peso del estudio si lo hay (`attr(data, "var_peso")`
# o una columna `peso`, como `.puntos_comparativos_pesos`) y redondeo al entero desde 0.5. El resultado es un ítem de
# `pulso_cifras()` listo para la banda (lamina_cifras.R).

#' Mediana ponderada que, con pesos iguales, es exactamente `stats::median` (promedia en el punto medio exacto)
#' @keywords internal
.cifra_mediana_ponderada <- function(x, w) {
  if (!length(x)) return(NA_real_)
  if (length(unique(w)) <= 1L) return(stats::median(x))
  o <- order(x); x <- x[o]; acum <- cumsum(w[o]) / sum(w)
  k <- which(acum >= 0.5 - 1e-12)[1]
  if (abs(acum[k] - 0.5) < 1e-12 && k < length(x)) (x[k] + x[k + 1L]) / 2 else x[k]
}

#' Una cifra destacada desde una variable
#'
#' @param data Data frame de la base.
#' @param var Nombre de la variable.
#' @param modo «porcentaje» (de una categoría), «n» (respuestas válidas), «mediana» o «media».
#' @param categoria Para «porcentaje»: el código o la etiqueta de la categoría.
#' @param instrumento Opcional: para casar la categoría por su etiqueta.
#' @param rotulo,detalle Textos de la cifra; si `detalle` es `NULL` se arma uno con la base («56 de 178»).
#' @param unidad Para «mediana» o «media»: sufijo («años»).
#' @param decimales Decimales del valor (0 por defecto; la media usa 1).
#' @param icono Ícono del recetario (opcional).
#' @return Ítem de `pulso_cifras()`: `list(valor, rotulo, detalle, icono)` más `base` (respuestas válidas).
#' @keywords internal
.cifra_desde_datos <- function(data, var, modo = c("porcentaje", "n", "mediana", "media"), categoria = NULL,
                               instrumento = NULL, rotulo, detalle = NULL, unidad = NULL, decimales = NULL, icono = NULL) {
  modo <- match.arg(modo)
  valor_word <- NULL
  if (!is.data.frame(data) || !var %in% names(data)) .plan_spec_abort(sprintf("La cifra pide «%s», que no está en la base.", var))
  x <- data[[var]]
  if (inherits(x, "haven_labelled")) x <- as.vector(x)
  pesos <- .puntos_comparativos_pesos(data, declaracion = attr(data, "var_peso", exact = TRUE))
  w <- pesos$valores
  validos <- !is.na(x) & !(is.character(x) & !nzchar(trimws(x))) & is.finite(w) & w > 0
  n <- sum(validos)
  if (n == 0L) .plan_spec_abort(sprintf("«%s» no tiene respuestas válidas: no hay cifra que destacar.", var))
  valor <- switch(modo,
    porcentaje = {
      if (is.null(categoria) || !nzchar(as.character(categoria)[1])) .plan_spec_abort("Para un porcentaje, indica la categoría.")
      cat_ <- as.character(categoria)[1]
      codigos <- as.character(x[validos])
      etq <- if (!is.null(instrumento)) .explorar_map_choices(var, instrumento) else NULL
      if (!cat_ %in% codigos && length(etq)) {
        casa <- names(etq)[tolower(trimws(etq)) == tolower(trimws(cat_))]
        if (length(casa)) cat_ <- casa[1]
      }
      k <- sum(codigos == cat_)
      wv <- w[validos]
      # Con peso no se repite una base en el detalle: la lámina ya declara la suya al pie y serían dos bases distintas
      # para la misma lámina (casos frente a suma de pesos; verificador de F6.0b).
      if (is.null(detalle)) detalle <- if (isTRUE(pesos$ponderado)) "Con el peso del estudio"
                                       else sprintf("%s de %s", format(k, big.mark = ","), format(n, big.mark = ","))
      paste0(.pulso_fmt_half_up(100 * sum(wv[codigos == cat_]) / sum(wv), decimales %||% 0L), "%")
    },
    n = format(n, big.mark = ","),
    mediana = , media = {
      num <- suppressWarnings(as.numeric(as.character(x[validos]))); wv <- w[validos]
      if (!any(is.finite(num))) .plan_spec_abort(sprintf("«%s» no es numérica: no tiene %s.", var, modo))
      ok <- is.finite(num); num <- num[ok]; wv <- wv[ok]
      v <- if (modo == "media") sum(num * wv) / sum(wv) else .cifra_mediana_ponderada(num, wv)
      # Cada formato escribe la mediana como su histograma (recetario: «cada formato el suyo»): el PPT trunca si los
      # datos son enteros (`.cifra_mediana`, como graficador_histograma_recetario.R) y el Word no (`valor_word`), para
      # que la cifra y el histograma de la misma pregunta digan lo mismo en cada entregable (verificador de F6.0b).
      if (modo == "mediana" && is.null(decimales)) {
        valor_word <- trimws(paste(.cifra_mediana(v, enteros = FALSE), unidad %||% ""))
        trimws(paste(.cifra_mediana(v, enteros = .datos_enteros(num)), unidad %||% ""))
      } else {
        txt_v <- if (!is.null(decimales)) .pulso_fmt_half_up(v, decimales) else .pulso_fmt_half_up(v, 1L)
        trimws(paste(txt_v, unidad %||% ""))
      }
    })
  if (is.null(detalle) && modo != "n") detalle <- if (isTRUE(pesos$ponderado)) "Con el peso del estudio" else sprintf("Base: %s respuestas", format(n, big.mark = ","))
  list(valor = valor, valor_word = valor_word %||% valor, rotulo = rotulo, detalle = detalle %||% "", icono = icono %||% "", base = n)
}

#' Cifra destacada calculada desde una pregunta (elemento de plan para las ranuras de cifra)
#'
#' Va en las ranuras `cifra_*` de `p_slide_cifras_y_graficos()` (tipo 22 del recetario) y de las láminas de población con
#' cifras (tipo 21). El valor se calcula al renderizar, con el peso del estudio (`.cifra_desde_datos`).
#'
#' @param var Pregunta («base$variable» en un informe multibase).
#' @param modo «porcentaje», «n», «mediana» o «media».
#' @param categoria Para «porcentaje»: código o etiqueta de la categoría.
#' @param rotulo Texto bajo la cifra («de los egresados tiene el título»).
#' @param detalle Texto gris debajo; vacío lo arma el motor con la base.
#' @param unidad Sufijo para mediana o media («años»).
#' @param decimales Decimales del valor.
#' @param icono Ícono del recetario (opcional).
#' @param filtros Filtros nombrados, como en los demás gráficos.
#' @param overrides,base Como en los demás elementos del plan (ajustes por gráfico y base declarada).
#' @export
p_cifra <- function(var, modo = c("porcentaje", "n", "mediana", "media"), categoria = NULL, rotulo = NULL, detalle = NULL,
                    unidad = NULL, decimales = NULL, icono = NULL, filtros = list(), overrides = list(), base = list()) {
  modo <- match.arg(modo)
  var <- .puntos_comparativos_ref(var, "var")
  # Sin rótulo la cifra no queda en blanco: al renderizar se arma uno desde la pregunta y se avisa (verificador de F6.0b:
  # el editor permitía dejarlo vacío y la lámina salía en blanco sin aviso).
  rotulo <- .ppt_norm_text1(rotulo, blank = NULL)
  if (identical(modo, "porcentaje") && (is.null(categoria) || !nzchar(as.character(categoria)[1]))) {
    .plan_spec_abort("p_cifra(): para un porcentaje indica `categoria`.")
  }
  el <- list(.element_type = "cifra", var = var, modo = modo, categoria = if (is.null(categoria)) NULL else as.character(categoria)[1],
             rotulo = rotulo, detalle = .ppt_norm_text1(detalle, blank = NULL), unidad = .ppt_norm_text1(unidad, blank = NULL),
             decimales = decimales, icono = .ppt_norm_text1(icono, blank = NULL), filtros = .ppt_norm_filters(filtros),
             overrides = overrides, base = base)
  class(el) <- c("ppt_element", "list")
  el
}

#' Rótulo por defecto de una cifra sin rótulo: lo arma desde la etiqueta de la pregunta (o de la categoría)
#' @keywords internal
.cifra_rotulo_auto <- function(var, modo, categoria = NULL, inst = NULL) {
  etiqueta <- tryCatch({
    s <- inst$survey; l <- s$label[match(var, s$name)]
    if (length(l) && !is.na(l) && nzchar(l)) as.character(l) else var
  }, error = function(e) var)
  etq_cat <- if (!is.null(categoria) && !is.null(inst)) {
    m <- tryCatch(.explorar_map_choices(var, inst), error = function(e) NULL)
    if (length(m) && categoria %in% names(m)) unname(m[[categoria]]) else categoria
  } else categoria
  switch(modo, n = "respuestas", mediana = paste("mediana:", etiqueta), media = paste("media:", etiqueta),
         porcentaje = sprintf("respondió «%s»", etq_cat %||% ""))
}

#' Base y variable de una referencia «base$variable» entre las fuentes del render
#' @keywords internal
.cifra_fuente <- function(ref, data_sources, inst_sources) {
  if (is.data.frame(data_sources)) return(list(data = data_sources, inst = inst_sources, var = sub("^.*\\$", "", ref)))
  base <- if (grepl("$", ref, fixed = TRUE)) sub("\\$.*$", "", ref) else names(data_sources)[1]
  if (!base %in% names(data_sources)) stop(sprintf("cifra: la base «%s» no está en el informe.", base), call. = FALSE)
  list(data = data_sources[[base]], inst = inst_sources[[base]], var = sub("^.*\\$", "", ref))
}

#' Ruta de respaldo: la cifra como gráfico (la lámina nativa la dibuja con `.lam_cifras_banda`)
#' @keywords internal
.render_cifra <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources)) stop("cifra: el render no expone las fuentes del estudio.", call. = FALSE)
  f <- .cifra_fuente(el$var, data_sources, inst_sources)
  d <- .apply_named_filters(f$data, filters = el$filtros %||% list(), arg_name = "filtros", mode = "strict")
  rotulo <- el$rotulo %||% .cifra_rotulo_auto(f$var, el$modo, el$categoria, f$inst)
  it <- .cifra_desde_datos(d, f$var, el$modo, categoria = el$categoria, instrumento = f$inst, rotulo = rotulo,
                           detalle = el$detalle, unidad = el$unidad, decimales = el$decimales, icono = el$icono)
  # Después del cálculo: si la variable falta, el único aviso es el de la variable, no también el del rótulo.
  if (is.null(el$rotulo)) .pulso_aviso(sprintf("La cifra de «%s» no tiene rótulo: se usó «%s». Escríbelo en el editor para que diga qué es.", f$var, rotulo))
  graficar_cifra(it)
}

#' La cifra como gráfico de respaldo: valor, rótulo y detalle con los tamaños y colores del recetario
#' @param item Ítem de `pulso_cifras()` (o de `.cifra_desde_datos`).
#' @export
graficar_cifra <- function(item) {
  pt <- ggplot2::.pt
  p <- ggplot2::ggplot() +
    ggplot2::annotate("text", x = 0, y = 0.78, label = item$valor, hjust = 0, vjust = 1, size = 40 / pt, fontface = "bold", colour = .std_color("azul")) +
    ggplot2::annotate("text", x = 0, y = 0.38, label = item$rotulo, hjust = 0, vjust = 1, size = 12 / pt, fontface = "bold", colour = .std_color("azul")) +
    ggplot2::annotate("text", x = 0, y = 0.18, label = item$detalle %||% "", hjust = 0, vjust = 1, size = 10 / pt, colour = .std_color("texto_suave")) +
    ggplot2::scale_x_continuous(limits = c(0, 1), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(0, 1), expand = c(0, 0)) +
    ggplot2::theme_void()
  attr(p, "pulso_cifra") <- item
  p
}
