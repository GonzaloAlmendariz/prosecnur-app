# =============================================================================
# graficos_mapa_resultado_plan.R — mapa de Lima con un resultado por distrito (lámina 104; ADR 0093)
# =============================================================================
#
# El recetario (recetario_m3e.R:201-216) pinta cada distrito de Lima y Callao según un indicador en clases y, al lado,
# lista los distritos de mayor a menor con su barra. El indicador es el porcentaje de respuestas en el `corte` (por
# ejemplo, «satisfecho o muy satisfecho») entre las válidas de cada distrito, con el peso del estudio si lo declara: el
# mismo cálculo que los puntos comparativos, sin su tope de 12 grupos.
#
# `reporte_plan_ppt.R` despacha por convención `.render_<element_type>` y está congelado: el renderer vive aquí y recupera
# las fuentes con `dynGet()`, como `graficos_puntos_comparativos_plan.R`.

.MAPA_RESULTADO_PALETA <- c("#C9D5EA", "#8EA3C6", "#4F6B9E")   # + el azul del estándar en la clase más alta

#' Mapa de Lima con un indicador por distrito
#'
#' @param var Pregunta `select_one` del indicador.
#' @param cruces Pregunta `select_one` con el distrito de cada encuestado (códigos UBIGEO de 6 dígitos o nombres).
#' @param corte Códigos de `var` que cuentan para el indicador.
#' @param cortes Límites de las clases en puntos porcentuales (tres cortes, cuatro clases).
#' @param min_n Casos válidos mínimos para que un distrito se pinte; con menos va como «Sin encuestas».
#' @param excluir_opciones Códigos o etiquetas que salen del denominador.
#' @param rotulo Rótulo del indicador sobre el ranking; vacío lo arma con las etiquetas del corte.
#' @export
p_mapa_resultado_distrital <- function(var, cruces, corte, titulo = NULL, filtros = list(), excluir_opciones = NULL,
                                       cortes = c(55, 65, 75), min_n = 1, rotulo = NULL, overrides = list(), base = list()) {
  var <- .puntos_comparativos_ref(var, "var")
  cruces <- .puntos_comparativos_ref(cruces, "cruces")
  .puntos_comparativos_validar_refs(var, cruces)
  corte <- .puntos_comparativos_codigos(corte, "corte")
  cortes <- sort(suppressWarnings(as.numeric(cortes)))
  if (length(cortes) < 1L || any(!is.finite(cortes)) || any(cortes <= 0 | cortes >= 100)) {
    .plan_spec_abort("p_mapa_resultado_distrital(): `cortes` deben ser porcentajes entre 0 y 100.")
  }
  min_n <- suppressWarnings(as.integer(min_n %||% 1L)); if (is.na(min_n) || min_n < 1L) min_n <- 1L
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  el <- list(.element_type = "mapa_resultado_distrital", var = var, cruces = cruces, corte = corte,
             title_slide = .ppt_norm_text1(titulo, blank = NULL), filtros = .ppt_norm_filters(filtros),
             excluir_opciones = if (is.null(excluir_opciones)) NULL else .puntos_comparativos_codigos(excluir_opciones, "excluir_opciones"),
             cortes = cortes, min_n = min_n, rotulo = .ppt_norm_text1(rotulo, blank = NULL), overrides = overrides, base = base)
  class(el) <- c("ppt_element", "list")
  el
}

#' El indicador por distrito: porcentaje en el corte entre las respuestas válidas, con el peso del estudio
#' @return data.frame `codigo`, `etiqueta`, `porcentaje`, `n`; atributo `indicador` con las etiquetas del corte.
#' @keywords internal
.mapa_resultado_calcular <- function(data, instrumento, var, distrito, corte, filtros = list(), excluir_opciones = NULL) {
  indicador <- .puntos_comparativos_variable(instrumento, var, "indicador")
  grupos <- .puntos_comparativos_variable(instrumento, distrito, "distrito")
  corte <- .puntos_comparativos_codigos(corte, "corte")
  falta <- setdiff(corte, indicador$codigos)
  if (length(falta)) stop("mapa_resultado_distrital: el corte trae códigos que no están en la escala: ", paste(falta, collapse = ", "), ".", call. = FALSE)
  elegibles <- setdiff(indicador$codigos, .puntos_comparativos_exclusiones(excluir_opciones, indicador))
  filtrada <- .apply_named_filters(data, filters = filtros %||% list(), arg_name = "filtros", mode = "strict")
  pesos <- .puntos_comparativos_pesos(filtrada, declaracion = attr(data, "var_peso", exact = TRUE))$valores
  v <- trimws(as.character(filtrada[[var]])); g <- trimws(as.character(filtrada[[distrito]]))
  valida <- !is.na(v) & v %in% elegibles & !is.na(g) & nzchar(g) & is.finite(pesos) & pesos > 0
  obs <- intersect(grupos$codigos, unique(g[valida]))
  filas <- lapply(obs, function(cod) {
    en <- valida & g == cod
    data.frame(codigo = cod, etiqueta = grupos$etiquetas[match(cod, grupos$codigos)],
               porcentaje = 100 * sum(pesos[en & v %in% corte]) / sum(pesos[en]), n = sum(en), stringsAsFactors = FALSE)
  })
  out <- if (length(filas)) do.call(rbind, filas) else data.frame(codigo = character(0), etiqueta = character(0), porcentaje = numeric(0), n = integer(0))
  attr(out, "indicador") <- indicador$etiquetas[match(corte, indicador$codigos)]
  out
}

#' Distritos de Lima y Callao de la cartografía del paquete, con su nombre para mostrar
#' @keywords internal
.mapa_resultado_lima <- function() {
  fondo <- .graficos_lima_district_context(incluir_callao = TRUE)
  data.frame(ubigeo = vapply(fondo, function(d) d$ubigeo, ""), distrito = vapply(fondo, function(d) d$distrito, ""), stringsAsFactors = FALSE)
}

#' Nombre de distrito para mostrar: «San Juan de Lurigancho», «Rímac» (nombre_mapa del recetario)
#' @keywords internal
.mapa_nombre_distrito <- function(d) {
  s <- gsub("\\b(De|Del|La|El|Los|Las)\\b", "\\L\\1", tools::toTitleCase(tolower(d)), perl = TRUE)
  s <- paste0(toupper(substr(s, 1, 1)), substring(s, 2))
  tildes <- c(Peru = "Perú", Rimac = "Rímac", Lurin = "Lurín", Maria = "María", Martin = "Martín", Jesus = "Jesús", Ancon = "Ancón")
  for (k in names(tildes)) s <- gsub(paste0("\\b", k, "\\b"), tildes[[k]], s)
  sub("Villa el Salvador", "Villa El Salvador", s, fixed = TRUE)
}

#' Casa cada distrito del estudio con la cartografía: por UBIGEO si el código lo es, si no por nombre sin tildes
#' @return El data.frame con `ubigeo` (NA si no casa).
#' @keywords internal
.mapa_resultado_casar <- function(filas, lima) {
  clave <- function(x) gsub("[^a-z ]", "", .lam_clave(x))
  por_cod <- ifelse(grepl("^[0-9]{5,6}$", filas$codigo), sprintf("%06d", suppressWarnings(as.integer(filas$codigo))), NA_character_)
  ub <- ifelse(!is.na(por_cod) & por_cod %in% lima$ubigeo, por_cod, lima$ubigeo[match(clave(filas$etiqueta), clave(lima$distrito))])
  filas$ubigeo <- ub
  filas
}

#' Especificación del mapa de resultado (forma «resultado» de mapa/1)
#' @keywords internal
.espec_mapa_resultado <- function(filas, cortes = c(55, 65, 75), min_n = 1L, indicador = character(0)) {
  fondo <- .graficos_lima_district_context(incluir_callao = TRUE)
  if (!length(fondo)) return(NULL)
  lima <- .mapa_collection_polygons(fondo)
  pal <- c(.MAPA_RESULTADO_PALETA, .std_color("azul"))[seq_len(length(cortes) + 1L)]
  if (length(cortes) + 1L > 4L) pal <- grDevices::colorRampPalette(c(.MAPA_RESULTADO_PALETA[1], .std_color("azul")))(length(cortes) + 1L)
  ok <- filas[!is.na(filas$ubigeo) & filas$n >= min_n, , drop = FALSE]
  clase <- findInterval(.pulso_round_half_up(ok$porcentaje), cortes) + 1L
  fill_de <- stats::setNames(pal[clase], ok$ubigeo)
  lima$fill <- ifelse(lima$ubigeo %in% names(fill_de), fill_de[lima$ubigeo], .std_color("mapa_fuera"))
  bordes <- c(0, cortes, 100)
  rot <- vapply(seq_along(pal), function(k) {
    if (k == 1L) sprintf("Menos de %s %%", bordes[2]) else if (k == length(pal)) sprintf("%s %% a más", bordes[k])
    else sprintf("%s a %s %%", bordes[k], bordes[k + 1L] - 1)
  }, "")
  o <- order(-ok$porcentaje, ok$etiqueta)
  lim <- .mapa_resultado_lima()
  nombre <- ifelse(is.na(match(ok$ubigeo, lim$ubigeo)), ok$etiqueta, .mapa_nombre_distrito(lim$distrito[match(ok$ubigeo, lim$ubigeo)]))
  ind <- indicador[nzchar(indicador)]
  titulo_panel <- if (length(ind)) paste0(ind[1], if (length(ind) > 1L) paste0(" o ", paste(tolower(ind[-1]), collapse = " o ")) else "") else "Indicador"
  bb <- c(xmin = min(lima$x), xmax = max(lima$x), ymin = min(lima$y), ymax = max(lima$y))
  list(version = "mapa/1", tipo = "mapa", forma = "resultado",
       capas = list(list(datos = lima, borde = "#FFFFFF", grosor = 0.3)), caja = bb,
       leyenda = list(titulo = "Por distrito", rotulos = c(rot, "Sin encuestas"), colores = c(pal, .std_color("mapa_fuera"))),
       ranking = data.frame(distrito = nombre[o], valor = .pulso_round_half_up(ok$porcentaje[o]), n = ok$n[o], color = pal[clase][o], stringsAsFactors = FALSE),
       panel = list(titulo = titulo_panel, sub = "Por distrito, de mayor a menor"),
       sin_casar = filas$etiqueta[is.na(filas$ubigeo)], pocos_casos = filas$etiqueta[!is.na(filas$ubigeo) & filas$n < min_n])
}

#' Mapa de resultado por distrito (ggplot de respaldo con la espec adjunta)
#' @keywords internal
graficar_mapa_resultado_distrital <- function(espec) {
  if (is.null(espec)) return(.plan_canvas_render_nulo("mapa_resultado_distrital: sin cartografía de Lima."))
  p <- .lam_mapa_gg(espec)
  attr(p, "pulso_espec") <- espec
  p
}

#' @keywords internal
.render_mapa_resultado_distrital <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  instrument_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(instrument_sources)) stop("mapa_resultado_distrital: el render no expone las fuentes del estudio.", call. = FALSE)
  ctx <- .puntos_comparativos_contextos(list(var = el$var, cruces = el$cruces), data_sources, instrument_sources)
  filas <- .mapa_resultado_calcular(ctx$data, ctx$instrumento, ctx$var, ctx$cruces, el$corte, el$filtros %||% list(), el$excluir_opciones)
  filas <- .mapa_resultado_casar(filas, .mapa_resultado_lima())
  espec <- .espec_mapa_resultado(filas, el$cortes %||% c(55, 65, 75), el$min_n %||% 1L, attr(filas, "indicador"))
  if (!is.null(espec) && !is.null(el$rotulo)) espec$panel$titulo <- el$rotulo
  # Lo que no casa con la cartografía se dice con su nombre: nunca se descarta en silencio.
  if (length(espec$sin_casar)) message("[PULSO-AVISO] Mapa por distrito: no se ubicaron en la cartografía de Lima: ", paste(espec$sin_casar, collapse = ", "), ".")
  if (length(espec$pocos_casos)) message("[PULSO-AVISO] Mapa por distrito: con menos de ", el$min_n, " casos válidos van como «Sin encuestas»: ",
                                          paste(espec$pocos_casos, collapse = ", "), ".")
  graficar_mapa_resultado_distrital(espec)
}
