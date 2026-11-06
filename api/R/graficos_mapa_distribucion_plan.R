# =============================================================================
# graficos_mapa_distribucion_plan.R — dónde están los encuestados: número o tasa por distrito de Lima o departamento del Perú
# =============================================================================
#
# CCSS Perfil 2026 (lugar de nacimiento, distrito de residencia en Lima, región de la familia y del colegio). El mapa de
# resultado (graficos_mapa_resultado_plan.R) pinta un INDICADOR por distrito; aquí se pinta la DISTRIBUCIÓN de una sola
# pregunta. El diseño es el que aprobó Gonzalo el 2026-11-02 (lienzo «Maqueta de mapas territoriales», tableros 2 a 7):
#   - clases en ESTUDIANTES, no en porcentaje (1–2, 3–5, 6–10, 11–20, 21 o más; en el Perú hasta «11 o más»), o la TASA
#     por 10 000 habitantes del Censo 2017 (sólo en Lima: menos de 0.5 · 0.5–1 · 1–2 · 2–3 · 3 o más);
#   - paleta ColorBrewer Blues; lo que pasa de la mitad de la base va fuera de escala, en azul marino y con su cifra;
#   - mar, tierra de contexto, contorno gris debajo de las áreas, escala gráfica; sólo los puntos de referencia (Google
#     Maps) llevan rótulo, en una columna sobre el mar con su guía: las áreas se leen por color, leyenda y ranking;
#   - leyenda escalonada bajo el mapa y ranking en tarjeta al costado (lámina) o debajo (Word).
# La cartografía vive en graficos_mapa_distribucion_carto.R, el dibujo en graficos_mapa_distribucion_dibujo.R, la lámina
# en lamina_mapa_distribucion.R y el Word en reporte_word_mapa_distribucion.R.
# Lo que no casa con el mapa (p. ej. «Extranjero») sigue en el total y se avisa por su nombre.

.MAPA_DISTRIBUCION_AREAS <- c("lima_callao", "peru")

#' Colores y cortes del diseño aprobado
#'
#' Especificación de las láminas de variables geográficas (Gonzalo, 2026-11-03, «Especificación aprobada para el motor»):
#' nada va fuera de escala (la última clase es abierta: «11 o más», «51 o más»), las áreas de otra respuesta del filtro van
#' en gris con rayado y la lista lleva una barra de 11 px sobre una pista del 100 %.
#' @keywords internal
.MAPA_DIST <- function() {
  # Los colores son tokens `ppt.colores.mapa_*` de estandar_pulso.json (ADR 0092, «manda el JSON»); se leen al dibujar.
  k <- function(n) .std_color(paste0("mapa_", n))
  list(
    blues5 = vapply(paste0("clase_", 1:5), k, "", USE.NAMES = FALSE),
    blues4 = vapply(c("clase_1", "clase_2", "clase4_3", "clase_5"), k, "", USE.NAMES = FALSE),
    vacio = k("vacio"), vacio_borde = k("vacio_borde"), punto = k("punto"),
    # Borde entre áreas gris oscuro (Gonzalo, 2026-11-03: «no se distinguen los distritos»; la maqueta usaba blanco) y,
    # sobre las clases oscuras, blanco: entre dos distritos del mismo azul oscuro el gris no se veía (revisión v7, lámina 11).
    borde = k("borde_area"), borde_oscura = k("borde_area_oscura"), borde_pt = 0.6, contorno = k("contorno"), mar = k("mar"),
    oceano = k("oceano"), tierra = k("tierra"), tierra_borde = k("tierra_borde"), pais = k("pais"), texto = k("texto"),
    gris = k("borde_area"), guia = k("guia"), otra = k("otra"), otra_raya = k("otra_raya"), pista = k("pista"),
    otros_barra = k("otros_barra"), otros_texto = k("otros_texto"), tarjeta_borde = k("tarjeta_borde"),
    zona_texto = k("zona_texto"), zona_filete = k("zona_filete"),
    cortes_conteo = list(lima_callao = c(3, 6, 11, 21), peru = c(3, 6, 11)),
    cortes_personas = c(6, 11, 21, 51),
    cortes_tasa = c(0.5, 1, 2, 3)
  )
}

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
#' @param zona_lima Perú: `TRUE` agrega el recuadro «Zona de Lima, ampliada»; la especificación aprobada no lo usa y por
#'   defecto no sale.
#' @param juntar Otras preguntas de área de la misma base cuyos conteos se suman a los de `var` (A10_1 + A10_2: Lima y el
#'   Callao en un mapa distrital).
#' @param unidad `"estudiantes"` (defecto) o `"personas"` (lugar de nacimiento de madres y padres): cambia la leyenda y la
#'   escala por defecto (personas: 1–5, 6–10, 11–20, 21–50, 51 o más).
#' @param otra_respuesta Áreas del mapa que pertenecen a otra respuesta del filtro («Lima», «Callao»): van en gris con
#'   rayado, con su entrada en la leyenda, y lo que caiga en ellas va a la fila «otros» de la lista.
#' @param otra_respuesta_rotulo Rótulo de esa entrada en la leyenda; vacío, «Lima y Callao».
#' @param ancho_mapa Fracción de la tarjeta (0.25 a 0.8) que toma el mapa; el resto es de la lista. Vacío: la elige el
#'   motor: el mapa toma el ancho que su alto pide y deja el resto a las barras (Gonzalo, 2026-11-04).
#' @param agrupar_lista Filas de la lista que suman todas las áreas de una o más preguntas del mapa (`var` o `juntar`), con
#'   su rótulo: `list(Callao = "A6_2")` o texto «Callao | A6_2», una línea por grupo. El mapa no cambia
#'   (graficos_mapa_distribucion_agrupar.R).
#' @export
p_mapa_distribucion <- function(var, area = c("lima_callao", "peru"), medida = c("conteo", "tasa"), titulo = NULL, filtros = list(),
                                excluir_opciones = NULL, cortes = NULL, rotulo = NULL, encuadre = c("datos", "completo"), puntos = NULL,
                                zona_lima = NULL, juntar = NULL, unidad = c("estudiantes", "personas"), otra_respuesta = NULL,
                                otra_respuesta_rotulo = NULL, ancho_mapa = NULL, agrupar_lista = NULL, overrides = list(),
                                base = list()) {
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
  unidad <- match.arg(as.character(unlist(unidad %||% "estudiantes"))[1], c("estudiantes", "personas"))
  juntar <- as.character(unlist(juntar %||% character(0))); juntar <- juntar[!is.na(juntar) & nzchar(trimws(juntar))]
  otra <- .mapa_dist_otra_grupos(otra_respuesta, otra_respuesta_rotulo)
  ancho_mapa <- if (length(ancho_mapa)) suppressWarnings(as.numeric(unlist(ancho_mapa))[1]) else NULL
  if (length(ancho_mapa) && (!is.finite(ancho_mapa) || ancho_mapa < 0.25 || ancho_mapa > 0.8)) {
    .plan_spec_abort("p_mapa_distribucion(): `ancho_mapa` es la fracción de la tarjeta que toma el mapa, entre 0.25 y 0.8.")
  }
  agrupar <- .mapa_dist_agrupar_normalizar(agrupar_lista)
  .mapa_dist_agrupar_validar(agrupar, var, juntar)
  el <- list(.element_type = "mapa_distribucion", var = var, area = area, medida = medida, title_slide = .ppt_norm_text1(titulo, blank = NULL),
             juntar = if (length(juntar)) vapply(juntar, .puntos_comparativos_ref, "", argumento = "juntar", USE.NAMES = FALSE) else NULL,
             unidad = unidad, otra_respuesta = if (length(otra)) otra else NULL,   # grupos con su rótulo (.mapa_dist_otra_grupos)
             otra_respuesta_rotulo = .ppt_norm_text1(otra_respuesta_rotulo, blank = NULL),
             filtros = .ppt_norm_filters(filtros),
             excluir_opciones = if (length(excluir_opciones)) .puntos_comparativos_codigos(excluir_opciones, "excluir_opciones") else NULL,
             cortes = cortes, rotulo = .ppt_norm_text1(rotulo, blank = NULL), encuadre = encuadre,
             puntos = .mapa_puntos_normalizar(puntos),
             ancho_mapa = ancho_mapa, agrupar_lista = if (length(agrupar)) agrupar else NULL,
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
    vacia <- data.frame(codigo = character(0), etiqueta = character(0), n = integer(0), porcentaje = numeric(0), stringsAsFactors = FALSE)
    return(structure(vacia, etiquetas_lista = labs))
  }
  orden <- unique(c(cods[cods %in% cod[valida]], cod[valida]))
  tot <- sum(pesos[valida])
  out <- do.call(rbind, lapply(orden, function(k) {
    en <- valida & cod == k
    data.frame(codigo = k, etiqueta = etq[en][1], n = sum(en), porcentaje = 100 * sum(pesos[en]) / tot, stringsAsFactors = FALSE)
  }))
  # La lista entera viaja con las filas: decide qué quiere decir «Lima» a secas (`.mapa_distribucion_casar`).
  structure(out, etiquetas_lista = labs)
}

#' Número con punto decimal, como se escribe en es-PE («0.5», «1.2»)
#'
#' La maqueta aprobada usaba coma; el informe es para el Perú y ahí el decimal es punto (CCSS 2026, B17).
#' @keywords internal
.mapa_dist_num <- function(x, dec = 1) {
  formatC(x, format = "f", digits = dec, big.mark = "")
}

#' Clases de la medida: colores y rótulos para la leyenda, y la clase de cada valor
#'
#' `cortes` dice dónde empieza cada clase desde la segunda. En conteo las clases son enteras («1–2», «3–5», «21 o más»);
#' en tasa, «menos de 0.5», «0.5–1», «3 o más». Cinco clases usan Blues de 5; cuatro, el Blues de 4 del Perú.
#' @return `list(cortes, colores, rotulos, clase = function(valor))`.
#' @keywords internal
.mapa_distribucion_clases <- function(medida, area, cortes = NULL, unidad = "estudiantes") {
  M <- .MAPA_DIST()
  cortes <- cortes %||% (if (identical(medida, "tasa")) M$cortes_tasa else if (identical(unidad, "personas")) M$cortes_personas else
    M$cortes_conteo[[area]])
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

#' Porcentaje de la lista: entero, salvo lo menor de 1 %, con un decimal y punto («0.5%»)
#' @keywords internal
.mapa_dist_pct <- function(n, base) {
  p <- if (base > 0) 100 * n / base else rep(0, length(n))
  ifelse(p > 0 & p < 1, paste0(formatC(p, format = "f", digits = 1), "%"), paste0(.pulso_round_half_up(p), "%"))
}

#' Las áreas de otra respuesta, en grupos con su rótulo
#'
#' Una lista simple es un grupo («Lima y Callao» o `rotulo`); una lista con nombres son varios grupos, uno por respuesta del
#' filtro: Lima Metropolitana y el Callao no son Lima provincias (Gonzalo, 2026-11-03: «no confundir Lima provincias con Lima
#' Metropolitana y Callao»). Cada grupo lleva su rayado y su entrada en la leyenda.
#' @return Lista de `list(rotulo, areas)`, o lista vacía.
#' @keywords internal
.mapa_dist_otra_grupos <- function(otra, rotulo = NULL) {
  limpiar <- function(x) { x <- trimws(as.character(unlist(x %||% character(0)))); x[!is.na(x) & nzchar(x)] }
  if (!length(otra)) return(list())
  if (is.list(otra) && length(names(otra)) && all(nzchar(names(otra)))) {
    g <- lapply(names(otra), function(k) list(rotulo = k, areas = limpiar(otra[[k]])))
  } else {
    r <- as.character(unlist(rotulo %||% ""))[1]
    g <- list(list(rotulo = if (!is.na(r) && nzchar(trimws(r))) trimws(r) else "Lima y Callao", areas = limpiar(otra)))
  }
  Filter(function(x) length(x$areas) > 0, g)
}

#' Las claves del mapa que nombra `otra_respuesta`: por nombre o clave; en el Perú, «Lima» a secas es el departamento entero
#' (Lima Metropolitana y Lima provincias)
#' @keywords internal
.mapa_dist_claves_otra <- function(otra, carto, area) {
  if (!length(otra)) return(character(0))
  clave_txt <- function(x) trimws(gsub("\\s+", " ", gsub("[^a-z ]", " ", .lam_clave(x))))
  nom <- clave_txt(carto$areas$nombre); cl <- carto$areas$clave
  unique(unlist(lapply(otra, function(o) {
    if (o %in% cl) return(o)
    k <- clave_txt(o)
    if (identical(area, "peru") && k %in% c("lima", "departamento de lima", "lima region", "region lima")) return(c("15M", "15P"))
    if (identical(area, "peru") && k %in% c("lima metropolitana", "provincia de lima")) return("15M")
    if (k %in% c("callao", "provincia constitucional del callao") && identical(area, "peru")) return("07")
    cl[nom == k]
  })))
}

#' Especificación del mapa de distribución (forma «distribucion» de mapa/1)
#'
#' Especificación aprobada (Gonzalo, 2026-11-03): nada fuera de escala; lo que no casa con el mapa (el extranjero, «No
#' sabe») y lo que cae en un área de otra respuesta del filtro siguen en la base y van a la fila «otros» de la lista, sin
#' nota gris; sin recuadro de la zona de Lima (salvo `zona_lima = TRUE`) ni título de ranking.
#' @param filas Salida de `.mapa_distribucion_casar()`. @param carto Cartografía. @param puntos Puntos normalizados.
#' @return Lista con las áreas y su valor, clase y color; el contexto; las clases; la lista ordenada (`lista`) y lo que va a
#'   «otros» (`extra`); la leyenda; la zona de Lima si se pide; y, por compatibilidad, `ranking` (las 14 primeras).
#' @keywords internal
.espec_mapa_distribucion <- function(filas, carto, area, medida = "conteo", cortes = NULL, encuadre = "datos", puntos = NULL,
                                     rotulo = NULL, zona_lima = NULL, unidad = "estudiantes", otra_respuesta = NULL,
                                     otra_rotulo = NULL) {
  if (is.null(carto)) return(NULL)
  M <- .MAPA_DIST()
  # Los puntos de referencia (la PUCP) van sólo en el mapa distrital: en el nacional no se ven a esa escala (Gonzalo,
  # 2026-11-02: «la PUCP sólo va en distrital, no en nacional, por definición propia»).
  if (identical(area, "peru")) puntos <- NULL
  base <- sum(filas$n)
  a <- as.data.frame(carto$areas)[, c("clave", "nombre", "pob", "cx", "cy")]
  ya_grupos <- is.list(otra_respuesta) && length(otra_respuesta) && is.list(otra_respuesta[[1]]) && !is.null(otra_respuesta[[1]]$areas)
  grupos <- if (ya_grupos) otra_respuesta else .mapa_dist_otra_grupos(otra_respuesta, otra_rotulo)
  cl_grupo <- lapply(grupos, function(g) .mapa_dist_claves_otra(g$areas, carto, area))
  otra_cl <- unique(unlist(cl_grupo))
  en_otra <- !is.na(filas$clave) & filas$clave %in% otra_cl
  ok <- filas[!is.na(filas$clave) & !en_otra, , drop = FALSE]
  # El nombre con que la pregunta llama a un área manda sobre el de la cartografía («Lima», `.mapa_distribucion_casar`).
  if ("nombre_area" %in% names(ok)) for (i in which(!is.na(ok$nombre_area))) a$nombre[a$clave == ok$clave[i]] <- ok$nombre_area[i]
  lima_entera <- "lima_entera" %in% names(ok) && any(ok$lima_entera %in% TRUE)
  n_de <- tapply(ok$n, ok$clave, sum)
  a$n <- as.integer(ifelse(a$clave %in% names(n_de), n_de[a$clave], 0L))
  a$pct <- if (base > 0) 100 * a$n / base else 0
  a$tasa <- ifelse(is.finite(a$pob) & a$pob > 0, 1e4 * a$n / a$pob, NA_real_)
  a$valor <- if (identical(medida, "tasa")) a$tasa else a$n
  cl <- .mapa_distribucion_clases(medida, area, cortes, unidad)
  a$fuera <- FALSE   # nada va fuera de escala: la última clase es abierta
  a$otra <- a$clave %in% otra_cl
  a$otra_grupo <- vapply(a$clave, function(k) { i <- which(vapply(cl_grupo, function(c) k %in% c, TRUE)); if (length(i)) i[1] else NA_integer_ }, 1L)
  a$clase <- ifelse(a$n > 0 & !a$otra & is.finite(a$valor), cl$clase(a$valor), NA_integer_)
  a$color <- ifelse(a$otra, M$otra, ifelse(is.na(a$clase), M$vacio, cl$colores[pmax(1L, a$clase)]))
  # «Lima» a secas en una lista de departamentos es el departamento entero: Lima provincias se pinta con Lima Metropolitana.
  if (lima_entera && all(c("15M", "15P") %in% a$clave) && !any(a$otra[a$clave %in% c("15M", "15P")])) {
    j <- a$clave == "15P"; i <- a$clave == "15M"
    a$color[j] <- a$color[i]; a$clase[j] <- a$clase[i]; a$lima_par <- j
  }
  a$cifra <- if (identical(medida, "tasa")) .mapa_dist_num(a$tasa) else as.character(a$n)
  con <- a[a$n > 0, , drop = FALSE]
  con <- con[order(-con$valor, -con$n, con$nombre), , drop = FALSE]
  lista <- data.frame(nombre = con$nombre, n = con$n, valor = if (identical(medida, "tasa")) .mapa_dist_num(con$tasa) else as.character(con$n),
                      pct = .mapa_dist_pct(con$n, base), color = con$color, stringsAsFactors = FALSE)
  # Lo que no casa con el mapa y lo que cae en un área de otra respuesta: en la base, sin dibujar, a la fila «otros».
  sin_casar <- filas[is.na(filas$clave), , drop = FALSE]
  extra <- rbind(data.frame(nombre = sin_casar$etiqueta, n = sin_casar$n, stringsAsFactors = FALSE),
                 data.frame(nombre = filas$etiqueta[en_otra], n = filas$n[en_otra], stringsAsFactors = FALSE))
  extra <- extra[extra$n > 0, , drop = FALSE]
  # Gonzalo, 2026-11-02: «la línea hacia afuera es sólo para los puntos de Google Maps». Los puntos llevan rótulo.
  rotulos <- if (NROW(puntos)) data.frame(texto = puntos$etiqueta, lon = puntos$lon, lat = puntos$lat,
                                          color = ifelse(puntos$color == .std_color("coral"), M$punto, puntos$color),
                                          punto = ifelse(puntos$color == .std_color("coral"), M$punto, puntos$color),
                                          stringsAsFactors = FALSE) else
    data.frame(texto = character(0), lon = numeric(0), lat = numeric(0), color = character(0), punto = character(0))
  uni <- carto$unidad
  personas <- identical(unidad, "personas")
  ver_zona <- !is.null(carto$zona) && isTRUE(zona_lima)
  zona <- if (ver_zona) {
    z <- a[match(carto$zona, a$clave), , drop = FALSE]
    data.frame(clave = z$clave, nombre = z$nombre, color = z$color, cifra = paste0(z$n, " (", .mapa_dist_pct(z$n, base), ")"),
               stringsAsFactors = FALSE)
  }
  leyenda_extras <- data.frame(texto = c(if (personas) "Sin casos" else "Sin encuestados", vapply(grupos, `[[`, "", "rotulo")),
                               tipo = c("vacio", rep("otra", length(grupos))), grupo = c(NA_integer_, seq_along(grupos)),
                               stringsAsFactors = FALSE)
  rk <- utils::head(lista, 14L)
  list(version = "mapa/1", tipo = "mapa", forma = "distribucion", area = area, medida = medida, encuadre = encuadre, unidad = unidad,
       areas = a, carto = carto, base = base,
       clases = list(colores = cl$colores, rotulos = cl$rotulos, cortes = cl$cortes),
       fuera = NULL, otra = otra_cl, otra_grupos = cl_grupo,
       leyenda_titulo = if (identical(medida, "tasa")) paste("Encuestados por cada 10 000 habitantes del", uni) else
         paste(if (personas) "Personas por" else "Encuestados por", uni),
       leyenda_extras = leyenda_extras,
       rotulos = rotulos, puntos = puntos, zona = zona, lista = lista, extra = extra,
       otros_rotulo = if (identical(uni, "distrito")) "Otros distritos" else "Otras regiones",
       ranking = data.frame(nombre = rk$nombre, barra = if (nrow(rk)) rk$n / max(c(1e-9, rk$n)) else numeric(0), color = rk$color,
                            valor = rk$valor, detalle = if (nrow(rk)) paste0("(", rk$pct, ")") else character(0), stringsAsFactors = FALSE),
       notas = character(0),
       ranking_titulo = rotulo %||% paste(tools::toTitleCase(carto$unidad_plural), "con más encuestados"),
       ranking_sub = "Número de encuestados y porcentaje sobre el total",
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
  carto <- .mapa_distribucion_cartografia(area)
  if (is.null(carto)) return(.plan_canvas_render_nulo("mapa_distribucion: el paquete no trae la cartografía de esta área."))
  # `juntar`: otras preguntas de área de la misma base suman sus conteos (A10_1 + A10_2, Lima y el Callao en un mapa).
  # Cada una se casa con su propia lista: los códigos de dos listas no se comparan entre sí.
  vars <- c(ctx$resolved_variable, vapply(el$juntar %||% character(0), function(v) {
    cj <- .graficos_consolidado_ref_context(paste0(fuente, "$", .graficos_ref_parts(v)$name),
                                            list(data_sources = data_sources, inst_sources = instrument_sources))
    if (!isTRUE(cj$exists)) stop("mapa_distribucion: `", v, "` (juntar) no existe completa en data e instrumento.", call. = FALSE)
    cj$resolved_variable
  }, ""))
  filas <- do.call(rbind, lapply(vars, function(v) {
    f <- .mapa_distribucion_calcular(data_sources[[fuente]], instrument_sources[[fuente]], v, el$filtros %||% list(), el$excluir_opciones)
    f <- .mapa_distribucion_casar(f, carto, area)
    if (length(el$agrupar_lista)) f$.var <- rep(v, nrow(f))   # la lista agrupa por pregunta (graficos_mapa_distribucion_agrupar.R)
    f
  }))
  espec <- .espec_mapa_distribucion(filas, carto, area, el$medida %||% "conteo", el$cortes, el$encuadre %||% "datos", el$puntos, el$rotulo,
                                    el$zona_lima, unidad = el$unidad %||% "estudiantes", otra_respuesta = el$otra_respuesta,
                                    otra_rotulo = el$otra_respuesta_rotulo)
  espec <- .mapa_dist_agrupar_lista(espec, filas, el$agrupar_lista)
  # La pregunta encima de la tarjeta (lamina_mapa_distribucion.R); el plan la guarda en `overrides$titulo`.
  espec$ancho_mapa <- el$ancho_mapa
  espec$pregunta <- .ppt_norm_text1((el$overrides %||% list())$titulo %||% el$title_slide, blank = NULL)
  # Revisión v7, lámina 12 (Gonzalo, 2026-11-04): si la base del mapa difiere del total de la base del estudio, va en la
  # esquina inferior izquierda del mapa, para que se lea que es un subgrupo.
  total <- NROW(data_sources[[fuente]])
  if (espec$base > 0 && total > 0 && espec$base != total) espec$base_rotulo <- paste0("Base: ", format(espec$base, big.mark = ","))
  # Lo que no casa con la cartografía sigue en el total y se dice con su nombre: nunca se descarta en silencio.
  if (length(espec$sin_casar)) message("[PULSO-AVISO] Mapa de distribución: fuera del mapa (cuentan en el total, en la fila «otros»): ",
                                       paste(espec$sin_casar, collapse = ", "), ".")
  graficar_mapa_distribucion(espec)
}
