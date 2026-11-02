# =============================================================================
# graficos_mapa_distribucion_plan.R — dónde están los encuestados: conteo y porcentaje por distrito o departamento
# =============================================================================
#
# CCSS Perfil 2026 (láminas 12, 14, 18 y 23: lugar de nacimiento, distrito de residencia en Lima, región de la familia,
# distrito o región del colegio). El mapa de resultado (graficos_mapa_resultado_plan.R) pinta un INDICADOR por distrito;
# aquí se pinta la DISTRIBUCIÓN de una sola pregunta: cuántos encuestados hay en cada área y qué parte del total son.
# Comparte la espec `mapa/1` (forma «resultado»), la lámina 104 (lamina_mapa_resultado.R) y su ruta ggplot, que es la
# que usa el Word; sólo cambian el cálculo, la cartografía y la cifra del ranking («103 (26%)»).
#
# Dos cartografías:
#   - `lima_callao`: los 50 distritos de Lima Metropolitana y el Callao del paquete (`lima_district_coverage.json`);
#   - `peru`: los 25 departamentos del Perú (`inst/cartografia/peru_departamentos.geojson`, ver su LEEME).
# El área se reconoce por UBIGEO (6 dígitos el distrito, 2 el departamento) o por nombre sin tildes. Lo que no casa con
# el mapa (p. ej. «Extranjero») sigue en el total y se avisa por su nombre: el porcentaje es sobre todos los válidos.

.MAPA_DISTRIBUCION_AREAS <- c("lima_callao", "peru")

#' Mapa de la distribución de los encuestados por distrito de Lima y Callao o por departamento del Perú
#'
#' @param var Pregunta con el área de cada encuestado (códigos UBIGEO o nombres de distrito o departamento).
#' @param area `"lima_callao"` (distritos) o `"peru"` (departamentos).
#' @param excluir_opciones Códigos o etiquetas que salen del total (p. ej. «No sabe»).
#' @param cortes Límites de las clases en puntos porcentuales; vacío los toma de los cuartiles de la distribución.
#' @param rotulo Título del panel del ranking; vacío dice «Encuestados por distrito» o «por departamento».
#' @param encuadre `"datos"` acerca el mapa a las áreas con encuestados (las vecinas quedan de contexto, recortadas);
#'   `"completo"` muestra todo el territorio.
#' @param puntos Lugares de referencia con su rótulo: coordenadas o enlace largo de Google Maps (graficos_mapa_puntos.R).
#' @export
p_mapa_distribucion <- function(var, area = c("lima_callao", "peru"), titulo = NULL, filtros = list(), excluir_opciones = NULL,
                                cortes = NULL, rotulo = NULL, encuadre = c("datos", "completo"), puntos = NULL, overrides = list(), base = list()) {
  var <- .puntos_comparativos_ref(var, "var")
  area <- match.arg(as.character(unlist(area %||% "lima_callao"))[1], .MAPA_DISTRIBUCION_AREAS)
  encuadre <- match.arg(as.character(unlist(encuadre %||% "datos"))[1], c("datos", "completo"))
  cortes <- if (length(cortes)) sort(suppressWarnings(as.numeric(unlist(cortes)))) else NULL
  if (length(cortes) && (any(!is.finite(cortes)) || any(cortes <= 0 | cortes >= 100))) {
    .plan_spec_abort("p_mapa_distribucion(): `cortes` deben ser porcentajes entre 0 y 100.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  el <- list(.element_type = "mapa_distribucion", var = var, area = area, title_slide = .ppt_norm_text1(titulo, blank = NULL),
             filtros = .ppt_norm_filters(filtros),
             excluir_opciones = if (length(excluir_opciones)) .puntos_comparativos_codigos(excluir_opciones, "excluir_opciones") else NULL,
             cortes = cortes, rotulo = .ppt_norm_text1(rotulo, blank = NULL), encuadre = encuadre,
             puntos = .mapa_puntos_normalizar(puntos), overrides = overrides, base = base)
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

#' Departamentos del Perú del paquete (`inst/cartografia/peru_departamentos.geojson`) como zonas de mapa
#' @keywords internal
.mapa_peru_departamentos <- function() {
  candidatos <- c(system.file("cartografia", "peru_departamentos.geojson", package = "prosecnurapp"),
                  file.path(.app_api_dir(), "inst", "cartografia", "peru_departamentos.geojson"),
                  file.path(getwd(), "api", "inst", "cartografia", "peru_departamentos.geojson"),
                  file.path(getwd(), "inst", "cartografia", "peru_departamentos.geojson"))
  path <- candidatos[nzchar(candidatos) & file.exists(candidatos)][1]
  if (is.na(path)) return(list())
  geo <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
  zonas <- lapply((geo %||% list())$features %||% list(), function(f) {
    p <- f$properties %||% list(); rings <- .graficos_geojson_rings_payload(f$geometry)
    if (!length(rings)) return(NULL)
    list(ubigeo = .graficos_scalar_chr(p$ubigeo, ""), distrito = .graficos_scalar_chr(p$departamento, ""), rings = rings)
  })
  Filter(Negate(is.null), zonas)
}

#' La cartografía de un área: polígonos (`x`, `y`, `group`, `ubigeo`) y nombres para mostrar y casar
#' @return `list(poligonos, nombres = data.frame(ubigeo, nombre), unidad)` o `NULL` sin cartografía.
#' @keywords internal
.mapa_distribucion_cartografia <- function(area) {
  zonas <- if (identical(area, "peru")) .mapa_peru_departamentos() else .graficos_lima_district_context(incluir_callao = TRUE)
  if (!length(zonas)) return(NULL)
  ub <- vapply(zonas, function(z) z$ubigeo, ""); nm <- vapply(zonas, function(z) z$distrito, "")
  list(poligonos = .mapa_collection_polygons(zonas),
       nombres = data.frame(ubigeo = ub, nombre = if (identical(area, "peru")) nm else .mapa_nombre_distrito(nm), stringsAsFactors = FALSE),
       unidad = if (identical(area, "peru")) "departamento" else "distrito")
}

#' Casa cada respuesta con un área del mapa: por UBIGEO (los dos primeros dígitos en departamentos) o por nombre
#' @keywords internal
.mapa_distribucion_casar <- function(filas, carto, area) {
  clave <- function(x) trimws(gsub("\\s+", " ", gsub("[^a-z ]", " ", .lam_clave(x))))
  cod <- as.character(filas$codigo)
  num <- grepl("^[0-9]{2}$|^[0-9]{4}$|^[0-9]{5,6}$", cod)
  por_cod <- if (identical(area, "peru")) ifelse(num, substr(sprintf("%06s", cod), 1, 2), NA_character_) else
    ifelse(num & nchar(cod) >= 5, sprintf("%06d", suppressWarnings(as.integer(cod))), NA_character_)
  por_cod <- gsub(" ", "0", por_cod)
  nombre <- clave(filas$etiqueta)
  if (identical(area, "peru")) {   # las formas usuales de Lima y el Callao en una pregunta de región
    nombre <- sub("^(lima metropolitana|lima provincias|provincia de lima|region lima|departamento de lima)$", "lima", nombre)
    nombre <- sub("^(provincia constitucional del callao|region callao)$", "callao", nombre)
    nombre <- sub("^departamento de ", "", nombre)
  }
  claves_mapa <- clave(carto$nombres$nombre)
  filas$ubigeo <- ifelse(!is.na(por_cod) & por_cod %in% carto$nombres$ubigeo, por_cod, carto$nombres$ubigeo[match(nombre, claves_mapa)])
  filas
}

#' Cortes de las clases desde la distribución: los cuartiles de las áreas pintadas, en puntos enteros y sin repetir
#' @keywords internal
.mapa_distribucion_cortes <- function(pct) {
  pct <- pct[is.finite(pct) & pct > 0]
  if (length(pct) < 2L) return(c(10, 25))
  q <- unique(pmax(1, round(stats::quantile(pct, c(0.25, 0.5, 0.75), names = FALSE))))
  q <- q[q > 0 & q < 100]
  if (!length(q)) c(10, 25) else q
}

#' Caja del mapa: todo el territorio, o las áreas con encuestados más un margen (encuadre «datos»)
#'
#' Lima y Callao tienen distritos enormes y casi vacíos en los extremos (Ancón, Carabayllo, Pucusana) y el Perú tiene la
#' Amazonía: con todos los encuestados en pocos distritos, el mapa completo dejaba lo que tiene datos en una mancha
#' pequeña. La caja se ajusta a los polígonos con datos, con un 12 % de aire por lado y sin salir del territorio; los
#' vecinos se dibujan igual, recortados en el borde, para que el lector se ubique.
#' @keywords internal
.mapa_distribucion_caja <- function(poly, con_datos, encuadre = "datos", puntos = NULL) {
  total <- c(xmin = min(poly$x), xmax = max(poly$x), ymin = min(poly$y), ymax = max(poly$y))
  sel <- poly[poly$ubigeo %in% con_datos, , drop = FALSE]
  if (!identical(encuadre, "datos") || !nrow(sel)) return(total)
  # Los puntos de referencia dentro del territorio también entran al encuadre: la PUCP no se recorta.
  pin <- if (NROW(puntos)) puntos[puntos$lon >= total[["xmin"]] & puntos$lon <= total[["xmax"]] & puntos$lat >= total[["ymin"]] & puntos$lat <= total[["ymax"]], ]
  bb <- c(xmin = min(sel$x, pin$lon), xmax = max(sel$x, pin$lon), ymin = min(sel$y, pin$lat), ymax = max(sel$y, pin$lat))
  # Un aire mínimo del 8 % del territorio: un solo distrito con datos no se vuelve todo el mapa.
  ax <- max(0.12 * (bb[["xmax"]] - bb[["xmin"]]), 0.08 * (total[["xmax"]] - total[["xmin"]]))
  ay <- max(0.12 * (bb[["ymax"]] - bb[["ymin"]]), 0.08 * (total[["ymax"]] - total[["ymin"]]))
  cj <- c(xmin = max(total[["xmin"]], bb[["xmin"]] - ax), xmax = min(total[["xmax"]], bb[["xmax"]] + ax),
          ymin = max(total[["ymin"]], bb[["ymin"]] - ay), ymax = min(total[["ymax"]], bb[["ymax"]] + ay))
  .mapa_puntos_caja_con_mar(cj, pin)
}

#' Recorta los polígonos a la caja: los vértices de fuera se llevan a su borde y los anillos sin nada dentro se quitan
#'
#' El dispositivo vectorial del PPT (rvg) se cae (segfault) al dibujar polígonos que salen del recorte de
#' `coord_quickmap`; acotados al borde, el dibujo es el mismo y nada sale de la vista.
#' @keywords internal
.mapa_distribucion_recortar <- function(poly, bb) {
  dentro <- poly$x >= bb[["xmin"]] & poly$x <= bb[["xmax"]] & poly$y >= bb[["ymin"]] & poly$y <= bb[["ymax"]]
  if (all(dentro)) return(poly)
  vivos <- unique(poly$group[dentro])
  poly <- poly[poly$group %in% vivos, , drop = FALSE]
  poly$x <- pmin(pmax(poly$x, bb[["xmin"]]), bb[["xmax"]]); poly$y <- pmin(pmax(poly$y, bb[["ymin"]]), bb[["ymax"]])
  poly
}

#' Especificación del mapa de distribución (forma «resultado» de mapa/1, con la cifra «conteo (porcentaje)»)
#' @keywords internal
.espec_mapa_distribucion <- function(filas, carto, cortes = NULL, encuadre = "datos", puntos = NULL) {
  if (is.null(carto)) return(NULL)
  ok <- filas[!is.na(filas$ubigeo), , drop = FALSE]
  if (nrow(ok)) ok <- do.call(rbind, lapply(split(ok, ok$ubigeo), function(d) {   # dos respuestas que caen en la misma área se suman
    data.frame(ubigeo = d$ubigeo[1], n = sum(d$n), porcentaje = sum(d$porcentaje), stringsAsFactors = FALSE)
  }))
  cortes <- if (length(cortes)) cortes else .mapa_distribucion_cortes(ok$porcentaje)
  pal <- c(.MAPA_RESULTADO_PALETA, .std_color("azul"))[seq_len(length(cortes) + 1L)]
  if (length(cortes) + 1L > 4L) pal <- grDevices::colorRampPalette(c(.MAPA_RESULTADO_PALETA[1], .std_color("azul")))(length(cortes) + 1L)
  clase <- findInterval(.pulso_round_half_up(ok$porcentaje), cortes) + 1L   # la clase del número que se lee
  poly <- carto$poligonos
  fill_de <- stats::setNames(pal[clase], ok$ubigeo)
  poly$fill <- ifelse(poly$ubigeo %in% names(fill_de), fill_de[poly$ubigeo], .std_color("mapa_fuera"))
  o <- order(-ok$porcentaje, carto$nombres$nombre[match(ok$ubigeo, carto$nombres$ubigeo)])
  nombre <- carto$nombres$nombre[match(ok$ubigeo, carto$nombres$ubigeo)]
  valor <- .pulso_round_half_up(ok$porcentaje)
  cifra <- sprintf("%s (%s%%)", format(ok$n, big.mark = ",", trim = TRUE), valor)
  bb <- .mapa_distribucion_caja(poly, ok$ubigeo, encuadre, puntos)
  poly <- .mapa_distribucion_recortar(poly, bb)
  list(version = "mapa/1", tipo = "mapa", forma = "resultado",
       capas = list(list(datos = poly, borde = "#FFFFFF", grosor = 0.3)), caja = bb,
       leyenda = list(titulo = paste("Por", carto$unidad), rotulos = c(.mapa_clases_rotulos(cortes, pal), "Sin encuestados"),
                      colores = c(pal, .std_color("mapa_fuera"))),
       ranking = data.frame(distrito = nombre[o], valor = valor[o], n = ok$n[o], color = pal[clase][o], cifra = cifra[o], stringsAsFactors = FALSE),
       escala_max = max(c(1, ok$porcentaje)),
       panel = list(titulo = paste("Encuestados por", carto$unidad), sub = "Número y porcentaje, de mayor a menor"),
       puntos = puntos, sin_casar = filas$etiqueta[is.na(filas$ubigeo)], pocos_casos = character(0))
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
  filas <- .mapa_distribucion_calcular(data_sources[[fuente]], instrument_sources[[fuente]], ctx$resolved_variable,
                                       el$filtros %||% list(), el$excluir_opciones)
  carto <- .mapa_distribucion_cartografia(el$area %||% "lima_callao")
  if (is.null(carto)) return(.plan_canvas_render_nulo("mapa_distribucion: el paquete no trae la cartografía de esta área."))
  espec <- .espec_mapa_distribucion(.mapa_distribucion_casar(filas, carto, el$area %||% "lima_callao"), carto, el$cortes, el$encuadre %||% "datos", el$puntos)
  if (!is.null(el$rotulo)) espec$panel$titulo <- el$rotulo
  cj <- espec$caja; pt <- el$puntos
  fuera <- if (NROW(pt)) pt$etiqueta[!(pt$lon >= cj[["xmin"]] & pt$lon <= cj[["xmax"]] & pt$lat >= cj[["ymin"]] & pt$lat <= cj[["ymax"]])]
  if (length(fuera)) message("[PULSO-AVISO] Mapa de distribución: puntos fuera del mapa, no se dibujan: ", paste(fuera, collapse = ", "), ".")
  # Lo que no casa con la cartografía sigue en el total y se dice con su nombre: nunca se descarta en silencio.
  if (length(espec$sin_casar)) message("[PULSO-AVISO] Mapa de distribución: fuera del mapa (cuentan en el total): ",
                                       paste(espec$sin_casar, collapse = ", "), ".")
  if (!.lam_mapa_resultado_cabe(espec)) message("[PULSO-AVISO] Mapa de distribución: el ranking no cabe en la lámina; ",
                                                 "sale el mapa con su leyenda, sin las cifras.")
  graficar_mapa_resultado_distrital(espec)
}
