# =============================================================================
# graficos_mapa_distribucion_plan.R — dónde están los encuestados: número o tasa por distrito de Lima o departamento del Perú
# =============================================================================
#
# CCSS Perfil 2026 (lugar de nacimiento, distrito de residencia en Lima, región de la familia y del colegio). El mapa de
# resultado (graficos_mapa_resultado_plan.R) pinta un INDICADOR por distrito; aquí se pinta la DISTRIBUCIÓN de una sola
# pregunta. El diseño es el que aprobó Gonzalo el 2026-11-02 (lienzo «Maqueta de mapas territoriales», tableros 2 a 7):
#   - clases en ESTUDIANTES, no en porcentaje (1–2, 3–5, 6–10, 11–20, 21 o más; en el Perú hasta «11 o más»), o la TASA
#     por 10 000 habitantes del Censo 2017 (sólo en Lima: menos de 0,5 · 0,5–1 · 1–2 · 2–3 · 3 o más);
#   - paleta ColorBrewer Blues; lo que pasa de la mitad de la base va fuera de escala, en azul marino y con su cifra;
#   - mar, tierra de contexto, contorno gris debajo de las áreas, escala gráfica; sólo los puntos de referencia (Google
#     Maps) llevan rótulo, en una columna sobre el mar con su guía: las áreas se leen por color, leyenda y ranking;
#   - leyenda escalonada bajo el mapa y ranking en tarjeta al costado (lámina) o debajo (Word).
# La cartografía vive en graficos_mapa_distribucion_carto.R, el dibujo en graficos_mapa_distribucion_dibujo.R, la lámina
# en lamina_mapa_distribucion.R y el Word en reporte_word_mapa_distribucion.R.
# Lo que no casa con el mapa (p. ej. «Extranjero») sigue en el total y se avisa por su nombre.

.MAPA_DISTRIBUCION_AREAS <- c("lima_callao", "peru")

#' Colores y cortes del diseño aprobado
#' @keywords internal
.MAPA_DIST <- list(
  blues5 = c("#C6DBEF", "#9ECAE1", "#6BAED6", "#3182BD", "#08519C"),
  blues4 = c("#C6DBEF", "#9ECAE1", "#4292C6", "#08519C"),
  vacio = "#FAF9F6", vacio_borde = "#C9CED6", fuera = "#14213D", punto = "#C8463D",
  # Borde entre áreas gris oscuro fino (Gonzalo, 2026-11-03: «no se distinguen los distritos»; la maqueta usaba blanco).
  borde = "#5A6478", borde_pt = 0.5, contorno = "#8E98A8", mar = "#E6EEF5", oceano = "#7A8AA0",
  tierra = "#EEECE7", tierra_borde = "#D9D5CD", pais = "#A39E94", texto = "#14213D", gris = "#5A6478", guia = "#3C4658",
  cortes_conteo = list(lima_callao = c(3, 6, 11, 21), peru = c(3, 6, 11)),
  cortes_tasa = c(0.5, 1, 2, 3),
  fuera_desde = 0.5
)

#' Mapa de la distribución de los encuestados por distrito de Lima y Callao o por departamento del Perú
#'
#' @param var Pregunta con el área de cada encuestado (códigos UBIGEO o nombres de distrito o departamento).
#' @param area `"lima_callao"` (distritos) o `"peru"` (departamentos, con Lima Metropolitana, el Callao y Lima provincias
#'   separados).
#' @param medida `"conteo"` (número de encuestados) o `"tasa"` (por 10 000 habitantes, Censo 2017; sólo Lima y Callao).
#' @param excluir_opciones Códigos o etiquetas que salen del total (p. ej. «No sabe»).
#' @param cortes Dónde empieza cada clase desde la segunda, en la unidad de la medida (p. ej. `c(3, 6, 11, 21)`
#'   estudiantes o `c(0.5, 1, 2, 3)` por 10 000); vacío usa los del diseño.
#' @param rotulo Título de la tarjeta del ranking; vacío lo arma el motor.
#' @param encuadre `"datos"` acerca el mapa a las áreas con encuestados; `"completo"` muestra todo el territorio.
#' @param puntos Lugares de referencia con su rótulo: coordenadas o enlace largo de Google Maps (graficos_mapa_puntos.R).
#' @param zona_lima Perú: `TRUE` o `FALSE` fuerza el recuadro «Zona de Lima, ampliada»; `NULL` lo muestra sólo si Lima
#'   Metropolitana, el Callao y Lima provincias suman al menos el 5 % de la base (una subpregunta «¿en qué otra región?»
#'   no lo necesita).
#' @export
p_mapa_distribucion <- function(var, area = c("lima_callao", "peru"), medida = c("conteo", "tasa"), titulo = NULL, filtros = list(),
                                excluir_opciones = NULL, cortes = NULL, rotulo = NULL, encuadre = c("datos", "completo"), puntos = NULL,
                                zona_lima = NULL, overrides = list(), base = list()) {
  var <- .puntos_comparativos_ref(var, "var")
  area <- match.arg(as.character(unlist(area %||% "lima_callao"))[1], .MAPA_DISTRIBUCION_AREAS)
  medida <- match.arg(as.character(unlist(medida %||% "conteo"))[1], c("conteo", "tasa"))
  if (identical(medida, "tasa") && !identical(area, "lima_callao")) {
    .plan_spec_abort("p_mapa_distribucion(): la tasa por habitantes sólo está disponible en Lima y Callao (población del Censo 2017 por distrito).")
  }
  encuadre <- match.arg(as.character(unlist(encuadre %||% "datos"))[1], c("datos", "completo"))
  cortes <- if (length(cortes)) sort(unique(suppressWarnings(as.numeric(unlist(cortes))))) else NULL
  if (length(cortes) && (any(!is.finite(cortes)) || any(cortes <= 0))) {
    .plan_spec_abort("p_mapa_distribucion(): `cortes` deben ser números positivos (dónde empieza cada clase desde la segunda).")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  el <- list(.element_type = "mapa_distribucion", var = var, area = area, medida = medida, title_slide = .ppt_norm_text1(titulo, blank = NULL),
             filtros = .ppt_norm_filters(filtros),
             excluir_opciones = if (length(excluir_opciones)) .puntos_comparativos_codigos(excluir_opciones, "excluir_opciones") else NULL,
             cortes = cortes, rotulo = .ppt_norm_text1(rotulo, blank = NULL), encuadre = encuadre,
             puntos = .mapa_puntos_normalizar(puntos),
             zona_lima = if (is.null(zona_lima) || !length(zona_lima)) NULL else isTRUE(as.logical(unlist(zona_lima))[1]),
             overrides = overrides, base = base)
  class(el) <- c("ppt_element", "list")
  el
}

#' Conteo y porcentaje por respuesta de una pregunta: el área de cada encuestado
#'
#' El valor se lee por código o por etiqueta de su lista (las bases procesadas traen una u otra); lo que no está en la
#' lista conserva su texto. El porcentaje usa el peso del estudio si lo declara; el conteo es sin ponderar (base F6).
#' @return data.frame `codigo`, `etiqueta`, `n`, `porcentaje`.
#' @keywords internal
.mapa_distribucion_calcular <- function(data, instrumento, var, filtros = list(), excluir_opciones = NULL) {
  filtrada <- .apply_named_filters(data, filters = filtros %||% list(), arg_name = "filtros", mode = "strict")
  if (!var %in% names(filtrada)) stop("mapa_distribucion: la pregunta `", var, "` no está en la base.", call. = FALSE)
  pesos <- .puntos_comparativos_pesos(filtrada, declaracion = attr(data, "var_peso", exact = TRUE))$valores
  survey <- (instrumento %||% list())$survey; choices <- (instrumento %||% list())$choices
  lista <- if (is.data.frame(survey) && var %in% survey$name) {
    tipo <- trimws(as.character(survey$type[match(var, survey$name)]))
    ln <- if ("list_name" %in% names(survey)) as.character(survey$list_name[match(var, survey$name)]) else NA_character_
    if (is.na(ln) || !nzchar(ln)) ln <- sub("^select_one\\s+", "", tipo)
    if (is.data.frame(choices)) choices[as.character(choices$list_name) == ln, , drop = FALSE] else NULL
  }
  cods <- as.character(lista$name %||% character(0)); labs <- as.character(lista$label %||% character(0))
  v <- trimws(as.character(filtrada[[var]]))
  cod <- ifelse(v %in% cods, v, ifelse(v %in% labs, cods[match(v, labs)], v))
  etq <- ifelse(cod %in% cods, labs[match(cod, cods)], cod)
  excl <- as.character(unlist(excluir_opciones %||% character(0)))
  valida <- !is.na(v) & nzchar(v) & !(cod %in% excl) & !(etq %in% excl) & is.finite(pesos) & pesos > 0
  if (!any(valida)) {
    return(data.frame(codigo = character(0), etiqueta = character(0), n = integer(0), porcentaje = numeric(0), stringsAsFactors = FALSE))
  }
  orden <- unique(c(cods[cods %in% cod[valida]], cod[valida]))
  tot <- sum(pesos[valida])
  do.call(rbind, lapply(orden, function(k) {
    en <- valida & cod == k
    data.frame(codigo = k, etiqueta = etq[en][1], n = sum(en), porcentaje = 100 * sum(pesos[en]) / tot, stringsAsFactors = FALSE)
  }))
}

#' Número con coma decimal, como lo escribe el diseño aprobado («0,5», «1,2»)
#' @keywords internal
.mapa_dist_num <- function(x, dec = 1) {
  s <- formatC(x, format = "f", digits = dec, big.mark = "")
  sub(".", ",", s, fixed = TRUE)
}

#' Clases de la medida: colores y rótulos para la leyenda, y la clase de cada valor
#'
#' `cortes` dice dónde empieza cada clase desde la segunda. En conteo las clases son enteras («1–2», «3–5», «21 o más»);
#' en tasa, «menos de 0,5», «0,5–1», «3 o más». Cinco clases usan Blues de 5; cuatro, el Blues de 4 del Perú.
#' @return `list(cortes, colores, rotulos, clase = function(valor))`.
#' @keywords internal
.mapa_distribucion_clases <- function(medida, area, cortes = NULL) {
  M <- .MAPA_DIST
  cortes <- cortes %||% (if (identical(medida, "tasa")) M$cortes_tasa else M$cortes_conteo[[area]])
  k <- length(cortes) + 1L
  colores <- if (k == 5L) M$blues5 else if (k == 4L) M$blues4 else grDevices::colorRampPalette(M$blues5[c(1, 5)], space = "Lab")(k)
  rotulos <- if (identical(medida, "tasa")) {
    b <- c(0, cortes)
    vapply(seq_len(k), function(j) if (j == 1L) paste("menos de", .mapa_dist_num(b[2], if (b[2] %% 1) 1 else 0)) else
      if (j == k) paste(.mapa_dist_num(b[j], if (b[j] %% 1) 1 else 0), "o más") else
        paste0(.mapa_dist_num(b[j], if (b[j] %% 1) 1 else 0), "–", .mapa_dist_num(b[j + 1], if (b[j + 1] %% 1) 1 else 0)), "")
  } else {
    b <- c(1, cortes)
    vapply(seq_len(k), function(j) if (j == k) paste(b[j], "o más") else if (b[j + 1] - 1 == b[j]) as.character(b[j]) else
      paste0(b[j], "–", b[j + 1] - 1), "")
  }
  list(cortes = cortes, colores = colores, rotulos = rotulos, clase = function(v) findInterval(v, cortes) + 1L)
}

#' Especificación del mapa de distribución (forma «distribucion» de mapa/1)
#'
#' @param filas Salida de `.mapa_distribucion_casar()`. @param carto Cartografía. @param puntos Puntos normalizados.
#' @return Lista con las áreas y su valor, clase y color; el contexto; las clases; los rótulos que pide el mapa; el
#'   ranking; la zona de Lima (Perú) y los textos.
#' @keywords internal
.espec_mapa_distribucion <- function(filas, carto, area, medida = "conteo", cortes = NULL, encuadre = "datos", puntos = NULL,
                                     rotulo = NULL, zona_lima = NULL) {
  if (is.null(carto)) return(NULL)
  M <- .MAPA_DIST
  # Los puntos de referencia (la PUCP) van sólo en el mapa distrital: en el nacional no se ven a esa escala (Gonzalo,
  # 2026-11-02: «la PUCP sólo va en distrital, no en nacional, por definición propia»).
  if (identical(area, "peru")) puntos <- NULL
  base <- sum(filas$n)
  a <- as.data.frame(carto$areas)[, c("clave", "nombre", "pob", "cx", "cy")]
  ok <- filas[!is.na(filas$clave), , drop = FALSE]
  n_de <- tapply(ok$n, ok$clave, sum)
  a$n <- as.integer(ifelse(a$clave %in% names(n_de), n_de[a$clave], 0L))
  a$pct <- if (base > 0) 100 * a$n / base else 0
  a$tasa <- ifelse(is.finite(a$pob) & a$pob > 0, 1e4 * a$n / a$pob, NA_real_)
  a$valor <- if (identical(medida, "tasa")) a$tasa else a$n
  cl <- .mapa_distribucion_clases(medida, area, cortes)
  # Lo que pasa de la mitad de la base va fuera de escala: en azul marino, con su cifra, y no entra en los cortes.
  a$fuera <- base > 0 & a$n > M$fuera_desde * base & identical(medida, "conteo")
  a$clase <- ifelse(a$n > 0 & !a$fuera & is.finite(a$valor), cl$clase(a$valor), NA_integer_)
  a$color <- ifelse(a$fuera, M$fuera, ifelse(is.na(a$clase), M$vacio, cl$colores[pmax(1L, a$clase)]))
  pct_txt <- function(p) ifelse(p > 0 & p < 1, "<1%", paste0(.pulso_round_half_up(p), "%"))
  a$cifra <- if (identical(medida, "tasa")) .mapa_dist_num(a$tasa) else as.character(a$n)
  con <- a[a$n > 0, , drop = FALSE]
  con <- con[order(-con$valor, -con$n, con$nombre), , drop = FALSE]
  # Gonzalo, 2026-11-02: «la línea hacia afuera es sólo para los puntos de Google Maps; los distritos se colorean con
  # leyenda y gráfico de barras al lado». Las áreas no llevan rótulo en el mapa: sólo los puntos de referencia.
  rotulos <- if (NROW(puntos)) data.frame(texto = puntos$etiqueta, lon = puntos$lon, lat = puntos$lat,
                                          color = ifelse(puntos$color == .std_color("coral"), M$punto, puntos$color),
                                          punto = ifelse(puntos$color == .std_color("coral"), M$punto, puntos$color),
                                          stringsAsFactors = FALSE) else
    data.frame(texto = character(0), lon = numeric(0), lat = numeric(0), color = character(0), punto = character(0))
  # El ranking: lo que entra en la escala, de mayor a menor; lo fuera de escala se anota aparte.
  rk <- con[!con$fuera, , drop = FALSE]
  max_filas <- 14L
  resto <- rk[-seq_len(min(nrow(rk), max_filas)), , drop = FALSE]
  rk <- utils::head(rk, max_filas)
  ranking <- data.frame(nombre = rk$nombre, barra = rk$valor / max(c(1e-9, rk$valor)), color = rk$color,
                        valor = if (identical(medida, "tasa")) .mapa_dist_num(rk$tasa) else as.character(rk$n),
                        detalle = if (identical(medida, "tasa")) paste0("(", rk$n, ")") else paste0("(", pct_txt(rk$pct), ")"),
                        stringsAsFactors = FALSE)
  fuera <- a[a$fuera, , drop = FALSE]
  sin_casar <- filas[is.na(filas$clave), , drop = FALSE]
  notas <- c(
    if (nrow(resto)) sprintf("%d %s más suman %d %s (%s).", nrow(resto), carto$unidad_plural, sum(resto$n),
                             if (sum(resto$n) == 1) "encuestado" else "encuestados", pct_txt(100 * sum(resto$n) / max(1, base))),
    if (nrow(sin_casar)) sprintf("Fuera del mapa: %s.", paste(sprintf("%s %d", sin_casar$etiqueta, sin_casar$n), collapse = ", ")))
  uni <- carto$unidad
  # El recuadro de la zona de Lima: pedido explícito, o Lima con al menos el 5 % de la base (Perfil CCSS 2026: en
  # «¿en qué otra región del Perú?» salía con ceros y ocupaba espacio).
  peso_zona <- if (!is.null(carto$zona) && base > 0) sum(a$n[a$clave %in% carto$zona]) / base else 0
  ver_zona <- !is.null(carto$zona) && (if (is.null(zona_lima)) peso_zona >= 0.05 else isTRUE(zona_lima))
  zona <- if (ver_zona) {
    z <- a[match(carto$zona, a$clave), , drop = FALSE]
    data.frame(clave = z$clave, nombre = z$nombre, color = z$color, cifra = paste0(z$n, " (", pct_txt(z$pct), ")"), stringsAsFactors = FALSE)
  }
  list(version = "mapa/1", tipo = "mapa", forma = "distribucion", area = area, medida = medida, encuadre = encuadre,
       areas = a, carto = carto, base = base,
       clases = list(colores = cl$colores, rotulos = cl$rotulos, cortes = cl$cortes),
       fuera = if (nrow(fuera)) data.frame(nombre = fuera$nombre, cifra = paste0(fuera$n, " (", pct_txt(fuera$pct), ")"), stringsAsFactors = FALSE),
       leyenda_titulo = if (identical(medida, "tasa")) paste("Encuestados por cada 10 000 habitantes del", uni) else
         paste("Encuestados por", uni),
       rotulos = rotulos, puntos = puntos, zona = zona, ranking = ranking, notas = notas,
       ranking_titulo = rotulo %||% (if (nrow(fuera)) paste("Fuera de", paste(fuera$nombre, collapse = " y ")) else
         paste(tools::toTitleCase(carto$unidad_plural), "con más encuestados")),
       ranking_sub = if (identical(medida, "tasa")) "Encuestados por cada 10 000 habitantes; entre paréntesis, el número" else
         "Número de encuestados y porcentaje sobre el total",
       ranking_columnas = c(tools::toTitleCase(uni), if (identical(medida, "tasa")) "Tasa (n)" else "n (%)"),
       nota_pie = if (identical(medida, "tasa")) "Población: INEI, Censo 2017." else NULL,
       sin_casar = sin_casar$etiqueta)
}

#' Mapa de distribución (ggplot de respaldo con la espec adjunta): el panel con su leyenda
#' @keywords internal
graficar_mapa_distribucion <- function(espec) {
  if (is.null(espec)) return(.plan_canvas_render_nulo("mapa_distribucion: el paquete no trae la cartografía de esta área."))
  p <- .mapa_dist_panel_gg(espec, ancho = 7, alto = 4.8, pt = .mapa_dist_pt("lamina"))
  attr(p, "pulso_espec") <- espec
  p
}

#' @keywords internal
.render_mapa_distribucion <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  instrument_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(instrument_sources)) stop("mapa_distribucion: el render no expone las fuentes del estudio.", call. = FALSE)
  part <- .graficos_ref_parts(el$var)
  fuente <- if (nzchar(part$source)) part$source else if (length(data_sources) == 1L) names(data_sources)[[1]] else
    stop("mapa_distribucion: la pregunta requiere prefijo `fuente$` cuando hay varias bases.", call. = FALSE)
  ctx <- .graficos_consolidado_ref_context(paste0(fuente, "$", part$name), list(data_sources = data_sources, inst_sources = instrument_sources))
  if (!isTRUE(ctx$exists)) stop("mapa_distribucion: `", el$var, "` no existe completa en data e instrumento.", call. = FALSE)
  area <- el$area %||% "lima_callao"
  filas <- .mapa_distribucion_calcular(data_sources[[fuente]], instrument_sources[[fuente]], ctx$resolved_variable,
                                       el$filtros %||% list(), el$excluir_opciones)
  carto <- .mapa_distribucion_cartografia(area)
  if (is.null(carto)) return(.plan_canvas_render_nulo("mapa_distribucion: el paquete no trae la cartografía de esta área."))
  espec <- .espec_mapa_distribucion(.mapa_distribucion_casar(filas, carto, area), carto, area, el$medida %||% "conteo", el$cortes,
                                    el$encuadre %||% "datos", el$puntos, el$rotulo, el$zona_lima)
  # Lo que no casa con la cartografía sigue en el total y se dice con su nombre: nunca se descarta en silencio.
  if (length(espec$sin_casar)) message("[PULSO-AVISO] Mapa de distribución: fuera del mapa (cuentan en el total): ",
                                       paste(espec$sin_casar, collapse = ", "), ".")
  graficar_mapa_distribucion(espec)
}
