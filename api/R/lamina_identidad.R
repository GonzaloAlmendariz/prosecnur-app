# =============================================================================
# lamina_identidad.R — las láminas de identidad del recetario (capítulo 1; ADR 0093, N7)
# =============================================================================
#
# Separadores (recetario_capitulos.R:6-18):
# - capítulo, variante B aprobada (láminas 4, 66, 116, 207, 254): sobre el layout «Section
#   Header» de la plantilla, el rótulo «CAPÍTULO n» en coral, un filete coral corto, el
#   título a 36 pt y el subtítulo a 15 pt;
# - subcapítulo sobrio (5, 22, 30…): la ruta «CAPÍTULO n: TÍTULO» a 11 pt, el número
#   «n.m» en coral y el título a 30 pt, y el subtítulo; se lee como subtítulo, no como portada.
#
# El motor tenía un solo nivel (`p_slide_seccion`, con el título en el marcador y el
# subtítulo ignorado). Ahora el nivel lo declara `meta$nivel = "subcapitulo"`; el número
# sale del orden del plan, salvo que `meta$numero` lo fije, y `meta$rotulo` cambia
# «CAPÍTULO» por otra palabra («SECCIÓN», «PARTE»).

#' Número y nivel de cada separador del plan
#'
#' @param plan Lista de láminas.
#' @return Lista paralela al plan: `NULL` para las que no son separador; para los separadores, `nivel`
#'   («capitulo» o «subcapitulo»), `numero` y el título y número de su capítulo.
#' @keywords internal
.lam_secciones_numeradas <- function(plan) {
  n_cap <- 0L; n_sub <- 0L; cap_titulo <- NA_character_; cap_numero <- NA_character_
  lapply(plan, function(slide) {
    if (!identical(slide$.slide_type, "section")) return(NULL)
    meta <- slide$meta %||% list(); titulo <- as.character(slide$slots$title %||% slide$title %||% "")[1]
    if (identical(meta$nivel, "subcapitulo")) {
      n_sub <<- n_sub + 1L
      # Sin capítulo antes, el subcapítulo se numera solo («1», no «0.1»; verificador de N7).
      num <- if (is.na(cap_numero)) as.character(n_sub) else paste0(cap_numero, ".", n_sub)
      list(nivel = "subcapitulo", numero = as.character(meta$numero %||% num),
           capitulo = cap_titulo, capitulo_numero = cap_numero, rotulo = as.character(meta$rotulo %||% "Capítulo")[1])
    } else {
      n_cap <<- n_cap + 1L; n_sub <<- 0L
      cap_numero <<- as.character(meta$numero %||% n_cap)[1]; cap_titulo <<- titulo
      list(nivel = "capitulo", numero = cap_numero, rotulo = as.character(meta$rotulo %||% "Capítulo")[1])
    }
  })
}

#' Separador del recetario: capítulo (variante B) o subcapítulo sobrio
#'
#' @param info Lo que devuelve `.lam_secciones_numeradas()` para esta lámina.
#' @param layout_capitulo Layout del capítulo (el «Section Header» de la plantilla, con su ilustración).
#' @param layout_subcapitulo Layout del subcapítulo (el general de la lámina).
#' @keywords internal
.lam_laminas_seccion <- function(doc, titulo, subtitulo = NULL, info, layout_capitulo = "Section Header", layout_subcapitulo = "Graficos",
                                 master = "Office Theme", por_lamina = function(doc) doc) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  titulo <- as.character(titulo %||% "")[1]
  sub <- if (is.null(subtitulo) || !nzchar(trimws(as.character(subtitulo)[1]))) NULL else trimws(as.character(subtitulo)[1])
  lz <- .lam_lienzo()
  if (identical(info$nivel, "subcapitulo")) {
    doc <- officer::add_slide(doc, layout = layout_subcapitulo, master = master)
    xt <- .std_geom("margen_izq"); fin <- .std_geom("ancho") - .std_geom("margen_der")
    if (!is.na(info$capitulo %||% NA)) {
      ruta <- toupper(paste0(info$rotulo, " ", info$capitulo_numero, ": ", info$capitulo))
      .lam_txt(lz, ruta, xt, 2.75, 9, 0.3, 11, suave, bold = TRUE, nombre = "seccion:ruta")
    }
    wn <- .lam_ancho_tinta(info$numero, 30, TRUE)
    .lam_txt(lz, info$numero, xt, 3.1, wn + 0.3, 0.6, 30, coral, bold = TRUE, nombre = "seccion:numero")
    .lam_txt(lz, titulo, xt + wn + 0.3, 3.1, fin - xt - wn - 0.3, 0.6, 30, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, xt, 3.72, 10, 0.4, 15, suave, nombre = "seccion:subtitulo")
  } else {
    doc <- officer::add_slide(doc, layout = layout_capitulo, master = master)
    .lam_txt(lz, toupper(paste(info$rotulo, info$numero)), 2.5, 3.85, 6, 0.36, 15, coral, bold = TRUE, nombre = "seccion:rotulo")
    .lam_caja(lz, 2.6, 4.27, 1.1, 0.04, coral, nombre = "seccion:filete")
    h <- max(0.75, .lam_alto_tinta(titulo, 9.8, 36, TRUE))                    # un título de dos líneas empuja al subtítulo
    .lam_txt(lz, titulo, 2.5, 4.42, 9.8, h, 36, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, 2.5, 4.42 + h - 0.02, 9.8, 0.4, 15, suave, nombre = "seccion:subtitulo")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:seccion")
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El separador cabe? Un título de más de dos líneas a 36 pt (o de una a 30 pt en el subcapítulo) no entra en el
#' separador del recetario y sigue por la ruta anterior.
#' @keywords internal
.lam_seccion_cabe <- function(titulo, info) {
  titulo <- as.character(titulo %||% "")[1]
  if (!nzchar(trimws(titulo)) || is.null(info)) return(FALSE)
  if (identical(info$nivel, "subcapitulo")) {
    fin <- .std_geom("ancho") - .std_geom("margen_der"); xt <- .std_geom("margen_izq")
    return(.lam_ancho_tinta(titulo, 30, TRUE) <= fin - xt - .lam_ancho_tinta(info$numero, 30, TRUE) - 0.4)
  }
  .lam_alto_tinta(titulo, 9.8, 36, TRUE) <= 1.4
}

# ---- «Cómo leer este informe»: Top Two Box (lámina 19, recetario.R:534-552) ---------------------------------------

.TTB_TEXTO_MOTOR <- paste("Con el fin de hacer la lectura de datos de forma más amigable, se plantea la suma de los dos valores superiores",
                          "de la escala, comúnmente llamada top two box. Esta suma permite comparar de manera más rápida y eficiente los",
                          "datos entre categorías o con mediciones de otros años.")
.TTB_TEXTO_RECETARIO <- paste("Es la suma de los dos valores superiores de la escala. Resume en una cifra el acuerdo de cada grupo",
                              "y permite compararlo entre actores y con mediciones de otros años.")

#' Lámina «Top Two Box» del recetario
#'
#' Una barra de ejemplo de 8.9 in con sus cifras, la llave verde sobre los dos valores superiores con «Los dos valores
#' superiores», y a la derecha la cifra del Top Two Box a 44 pt con su suma; la leyenda numerada debajo. El texto del
#' motor por defecto se cambia por el del recetario; uno escrito por el analista se respeta.
#' @keywords internal
.lam_laminas_top_two_box <- function(doc, slots, folio = NULL, ante = "Cómo leer este informe", layout = "Graficos",
                                     master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der"); yt <- g_("zona_datos_y0")
  verde <- .std_color("verde_top_two_box"); azul <- .std_color("azul")
  v <- suppressWarnings(as.numeric(slots$valores %||% c(5, 5, 35, 55))); k <- length(v)
  idx <- as.integer(slots$top_two_indices %||% c(k - 1L, k))
  et <- as.character(slots$etiquetas %||% seq_len(k))
  # 3 a 5 puntos (la compuerta no deja pasar más: la paleta likert tiene cinco colores y el quinto es «Sin
  # información»; con 6 y 7 salían colores NA, verificador de N7). Con 3, el positivo es el verde fuerte.
  pal <- switch(as.character(k), "5" = .std_paleta("likert_neutro"), "3" = .std_paleta("likert")[c(1, 3, 4)], .std_paleta("likert")[seq_len(k)])
  rot <- if (k == 4L) .std_valor("ppt", "paletas", "likert", "rotulos")[1:4] else {
    r <- rep("", k); r[1] <- gsub("\\s*\\n\\s*", " ", slots$extremo_izquierda %||% ""); r[k] <- gsub("\\s*\\n\\s*", " ", slots$extremo_derecha %||% ""); r
  }
  titulo <- as.character(slots$title %||% "Top Two Box")[1]
  if (identical(toupper(titulo), "TOP TWO BOX")) titulo <- "Top Two Box"
  texto <- as.character(slots$text %||% .TTB_TEXTO_RECETARIO)[1]
  if (identical(gsub("\\s+", " ", texto), gsub("\\s+", " ", .TTB_TEXTO_MOTOR))) texto <- .TTB_TEXTO_RECETARIO
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo()
  .lam_txt_tramos(lz, .lam_narrativa_tramos(texto), ml, yt + 0.05, W - ml - mr - 0.5, 0.9, 17, azul, nombre = "ttb:texto")
  xb <- ml + 0.4; wb <- 8.9; yb <- 4.0; g <- 0.8
  seg <- data.frame(ancho = v / sum(v), cifra = paste0(.pulso_fmt_half_up(v, 0), "%"), color = pal, dibujar = v > 0, stringsAsFactors = FALSE)
  .lam_barra_apilada(lz, xb, yb, wb, seg, g)
  x3 <- xb + wb * sum(v[seq_len(min(idx) - 1L)]) / sum(v); x4 <- xb + wb * sum(v[seq_len(max(idx))]) / sum(v)
  .lam_caja(lz, x3, yb - 0.32, x4 - x3, 0.025, verde, nombre = "ttb:llave")
  .lam_caja(lz, x3, yb - 0.32, 0.025, 0.2, verde, nombre = "ttb:llave"); .lam_caja(lz, x4 - 0.025, yb - 0.32, 0.025, 0.2, verde, nombre = "ttb:llave")
  .lam_caja(lz, (x3 + x4) / 2 - 0.0125, yb - 0.5, 0.025, 0.2, verde, nombre = "ttb:llave")
  llave <- if (max(idx) == k) "Los dos valores superiores" else if (min(idx) == 1L) "Los dos valores inferiores" else "Los valores que se suman"
  if (length(idx) != 2L) llave <- sub("dos ", "", llave, fixed = TRUE)
  .lam_txt(lz, llave, (x3 + x4) / 2 - 2, yb - 0.85, 4, 0.3, 12, verde, bold = TRUE, align = "center", nombre = "ttb:llave_rotulo")
  xt <- xb + wb + 0.35; wt <- W - mr - xt
  .lam_txt(lz, "Top Two Box", xt, yb - 0.5, wt, 0.3, 13, verde, bold = TRUE, align = "center", nombre = "ttb:rotulo")
  .lam_txt(lz, paste0(.pulso_fmt_half_up(sum(v[idx]), 0), "%"), xt, yb - 0.12, wt, 0.75, 44, verde, bold = TRUE, align = "center", nombre = "ttb:cifra")
  .lam_txt(lz, paste(paste0(.pulso_fmt_half_up(v[idx], 0), "%"), collapse = " + "), xt, yb + 0.7, wt, 0.32, 14, verde, align = "center", nombre = "ttb:suma")
  .lam_leyenda(lz, yb + g + 0.45, trimws(paste0(et, "  ", rot)), pal, centrar_en = xb + wb / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:top_two_box")
  doc <- .lam_pie(doc, NULL, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El Top Two Box va en nativo? Una escala de 3 a 7 puntos con valores positivos y dos índices contiguos dentro de ella
#' @keywords internal
.lam_top_two_box_cabe <- function(slots) {
  v <- suppressWarnings(as.numeric(slots$valores %||% c(5, 5, 35, 55))); idx <- suppressWarnings(as.integer(slots$top_two_indices %||% c(length(v) - 1L, length(v))))
  length(v) >= 3L && length(v) <= 5L && all(is.finite(v)) && all(v >= 0) && sum(v) > 0 && length(idx) >= 1L && all(idx %in% seq_along(v)) &&
    all(diff(sort(idx)) == 1L) && length(slots$etiquetas %||% seq_along(v)) == length(v)
}

# ---- «Cómo leer este informe»: redondeo (láminas 20 y 21, recetario.R:576-609) ------------------------------------

#' Cifras del ejemplo de redondeo: valor exacto, redondeo estándar (el 0.5 sube) y resto mayor
#' @keywords internal
.lam_redondeo_cifras <- function(casos) {
  n <- suppressWarnings(as.numeric(casos)); ex <- 100 * n / sum(n)
  std <- floor(ex + 0.5); ent <- floor(ex); resto <- ex - ent
  faltan <- 100 - sum(ent); suben <- order(-resto)[seq_len(max(0, faltan))]; res <- ent; res[suben] <- res[suben] + 1
  list(n = n, exacto = ex, estandar = std, entera = ent, resto = resto, faltan = faltan, suben = suben, resultado = res)
}

#' La matriz de redondeo del recetario: una columna por categoría con su color y la suma al final
#' @keywords internal
.lam_redondeo_matriz <- function(lz, etiquetas, colores, filas, y0) {
  ml <- .std_geom("margen_izq"); x0 <- ml + 3.1; wc <- 1.6; hr <- 0.66; k <- length(etiquetas)
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  for (j in seq_len(k)) {
    xx <- x0 + (j - 1) * wc
    .lam_caja(lz, xx + 0.05, y0, wc - 0.1, 0.1, colores[j], nombre = "redondeo:color")
    .lam_txt(lz, etiquetas[j], xx, y0 + 0.14, wc, 0.5, 11, azul, bold = TRUE, align = "center", nombre = "redondeo:categoria")
  }
  .lam_txt(lz, "Suma", x0 + k * wc, y0 + 0.14, 1.3, 0.3, 11, suave, bold = TRUE, align = "center", nombre = "redondeo:categoria")
  for (i in seq_along(filas)) {
    f <- filas[[i]]; yy <- y0 + 0.75 + (i - 1) * hr
    if (i > 1) .lam_separador_h(lz, ml, x0 + k * wc + 1.3, yy - 0.1)
    .lam_txt(lz, f$t, ml, yy + 0.06, 3.0, 0.34, 14, azul, bold = TRUE, nombre = "redondeo:fila")
    for (j in seq_len(k)) {
      marca <- j %in% (f$marcar %||% integer(0))
      if (marca) .lam_contorno(lz, x0 + (j - 1) * wc + 0.25, yy - 0.03, wc - 0.5, 0.48, coral, nombre = "redondeo:marca")
      .lam_txt(lz, f$d[j], x0 + (j - 1) * wc, yy + 0.05, wc, 0.36, 15, if (marca) coral else azul, bold = isTRUE(f$negrita), align = "center", nombre = "redondeo:cifra")
    }
    if (!is.null(f$s)) .lam_txt(lz, f$s, x0 + k * wc, yy + 0.05, 1.3, 0.36, 15, if (f$s != "100%") coral else azul, bold = TRUE, align = "center", nombre = "redondeo:suma")
  }
  y0 + 0.75 + length(filas) * hr
}

#' Láminas del redondeo del recetario: una por método, las dos con el mismo ejemplo (C13 de la tanda de comentarios)
#'
#' @param metodo «estandar» (la 20), «resto_mayor» (la 21) o «ambos»; lo resuelve `.lam_redondeo_metodo()`.
#' @keywords internal
.lam_laminas_redondeo <- function(doc, slots, metodo = "estandar", folio = NULL, ante = "Cómo leer este informe", layout = "Graficos",
                                  master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  ml <- .std_geom("margen_izq"); W <- .std_geom("ancho"); ac <- W - ml - .std_geom("margen_der"); yt <- .std_geom("zona_datos_y0")
  azul <- .std_color("azul"); coral <- .std_color("coral")
  et <- as.character(slots$etiquetas %||% .REDONDEO_SLIDE_ETIQUETAS); C <- .lam_redondeo_cifras(slots$casos %||% .REDONDEO_SLIDE_CASOS)
  cols <- if (length(et) == 5L) .std_paleta("likert") else .std_paleta("likert")[seq_along(et)]
  num <- function(x) format(x, big.mark = ",", trim = TRUE, scientific = FALSE)
  pie <- sprintf("Ejemplo con %s y %s casos de %s", paste(num(head(C$n, -1)), collapse = ", "), num(tail(C$n, 1)), num(sum(C$n)))
  pct <- function(x) paste0(x, "%"); dos <- function(x) sprintf("%.2f%%", x)
  una <- function(doc, titulo, texto, filas, y0, nota, fol) {
    doc <- officer::add_slide(doc, layout = layout, master = master)
    doc <- .lam_titulo(doc, titulo, ante = ante)
    lz <- .lam_lienzo()
    .lam_txt(lz, texto, ml, yt, ac, 0.75, .std_pt("cuerpo"), azul, nombre = "redondeo:texto")
    yf <- .lam_redondeo_matriz(lz, et, cols, filas, y0)
    .lam_txt(lz, nota, ml, yf + 0.12, ac, 0.32, 13, coral, bold = TRUE, nombre = "redondeo:nota")
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:redondeo")
    por_lamina(.lam_pie(doc, pie, fol))
  }
  # El texto que escribe el analista se respeta: reemplaza la explicación de la primera lámina.
  propio <- as.character(slots$text %||% "")[1]
  propio <- if (!is.na(propio) && nzchar(trimws(propio)) && !identical(trimws(propio), trimws(.redondeo_slide_texto()))) propio else NULL
  t_propio <- as.character(slots$title %||% "")[1]
  t_propio <- if (!is.na(t_propio) && nzchar(trimws(t_propio)) && !identical(toupper(trimws(t_propio)), "CÓMO SE REDONDEAN LAS CIFRAS")) t_propio else NULL
  partes <- 0L
  if (metodo %in% c("ambos", "estandar")) {
    s <- sum(C$estandar)
    doc <- una(doc, t_propio %||% "Redondeo estándar",
               propio %||% "Cada porcentaje se redondea por separado: desde 0.5 sube y por debajo baja. Cada cifra queda lo más cerca posible de su valor exacto, pero la suma puede dar 99% o 101%.",
               list(list(t = "Valor exacto", d = dos(C$exacto), s = "100%"),
                    list(t = "Redondeo estándar", d = pct(C$estandar), s = pct(s), negrita = TRUE)), yt + 1.35,
               if (s != 100) sprintf("En este ejemplo la suma queda en %d%%: cada cifra se redondeó por su cuenta.", s)
               else "En este ejemplo la suma da 100%, pero con otros casos puede dar 99% o 101%.", folio)
    partes <- partes + 1L
  }
  if (metodo %in% c("ambos", "resto_mayor")) {
    palabra <- c("un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve")
    cuantos <- if (C$faltan <= length(palabra)) palabra[C$faltan] else as.character(C$faltan)
    nota <- if (C$faltan > 0) sprintf("Faltan %s %s: van a %s más grande%s.", cuantos, if (C$faltan == 1) "punto" else "puntos",
                                      if (C$faltan == 1) "el resto" else sprintf("los %s restos", cuantos), if (C$faltan == 1) "" else "s")
            else "La parte entera ya suma 100%: no hace falta repartir puntos."
    # Como la 21: la categoría con casos que el reparto deja en 0 % se nombra («El 0.56% queda en 0%»).
    cero <- which(C$n > 0 & C$resultado == 0)
    if (length(cero)) nota <- paste(nota, sprintf("El %.2f%% queda en 0%%.", C$exacto[cero[1]]))
    doc <- una(doc, if (!is.null(t_propio) && partes == 0L) t_propio else "Redondeo del resto mayor",
               if (!is.null(propio) && partes == 0L) propio else "Primero se toma la parte entera de cada porcentaje. Los puntos que faltan para llegar a 100 se dan, uno por uno, a las categorías con el resto decimal más grande. La suma siempre da 100%.",
               list(list(t = "Valor exacto", d = dos(C$exacto), s = "100%"),
                    list(t = "Parte entera", d = pct(C$entera), s = pct(sum(C$entera))),
                    list(t = "Resto decimal", d = sprintf("%.2f", C$resto), marcar = C$suben),
                    list(t = "Resultado", d = pct(C$resultado), s = pct(sum(C$resultado)), negrita = TRUE, marcar = C$suben)), yt + 1.05,
               nota, if (is.null(folio)) NULL else folio + partes)
    partes <- partes + 1L
  }
  list(doc = doc, partes = partes)
}

#' Qué lámina de redondeo lleva el informe: la del método que se decidió al inicio para mostrar los resultados
#'
#' El método vive en los presets de cada familia que rotula porcentajes (`metodo_redondeo`: «estandar» o «reparto»).
#' Lo normal es una sola lámina, la del método elegido (Gonzalo, 2026-10-09: «al principio se decide cómo se desean
#' mostrar los resultados y a partir de ello lo normal es agregar una de las dos»); si el informe usa los dos, van las
#' dos. `meta$metodo` («estandar», «resto_mayor» o «ambos») la fija a mano.
#' @keywords internal
.lam_redondeo_metodo <- function(meta = list(), presets = list()) {
  m <- as.character(meta$metodo %||% "")[1]
  if (!is.na(m) && nzchar(m)) {
    m <- tolower(trimws(m))
    if (m %in% c("ambos", "los_dos")) return("ambos")
    return(if (identical(.pulso_pct_metodo(m), "reparto")) "resto_mayor" else "estandar")
  }
  familias <- intersect(names(.PRESETS_CALCULOS), names(presets %||% list()))
  usados <- unique(vapply(familias, function(k) .pulso_pct_metodo(presets[[k]]$args$metodo_redondeo %||% "estandar"), ""))
  if (!length(usados)) return("estandar")
  if (length(usados) > 1L) return("ambos")
  if (identical(usados, "reparto")) "resto_mayor" else "estandar"
}

#' ¿El redondeo va en nativo? Cuatro o cinco categorías con casos enteros no negativos y cifras sin decimales
#' @keywords internal
.lam_redondeo_cabe <- function(slots) {
  n <- suppressWarnings(as.numeric(slots$casos %||% .REDONDEO_SLIDE_CASOS)); et <- slots$etiquetas %||% .REDONDEO_SLIDE_ETIQUETAS
  length(n) %in% 4:5 && length(et) == length(n) && all(is.finite(n)) && all(n >= 0) && sum(n) > 0 &&
    identical(as.integer(slots$decimales %||% 0L), 0L) && all(.lam_ancho_tinta(et, 11, TRUE) <= 2 * 1.5)
}

# ---- Portada (lámina 23, recetario.R:444-459) -----------------------------------------------------------------------

#' ¿El mazo usa la plantilla estándar de PULSO? Las portadas de cliente (ACNUR) tienen su propia composición y la
#' respetan; sobre ellas no se dibuja la portada del recetario.
#' @keywords internal
.lam_plantilla_estandar <- function(ruta) {
  r <- as.character(ruta %||% "")[1]
  !is.na(r) && nzchar(r) && identical(basename(r), "plantilla_16_9.pptx")
}

#' Portada del recetario: sobre el layout «Title Slide» (logos y filete de la plantilla), el rótulo en coral, el título a
#' 30 pt centrado, el encargo a 18 pt y la fecha en gris
#'
#' El subtítulo del motor es el rótulo («INFORME CONSOLIDADO»), el subtexto es el encargo («Por encargo de…») y la
#' fecha, la fecha.
#' @keywords internal
.lam_laminas_portada <- function(doc, titulo, subtitulo = NULL, fecha = NULL, subtexto = NULL, layout = "Title Slide",
                                 master = "Office Theme", por_lamina = function(doc) doc) {
  limpio <- function(x) if (is.null(x) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  azul <- .std_color("azul")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  lz <- .lam_lienzo()
  if (!is.null(limpio(subtitulo))) .lam_txt(lz, toupper(limpio(subtitulo)), 1.6, 2.12, 10.1, 0.32, 13, .std_color("coral"), bold = TRUE, align = "center", nombre = "portada:rotulo")
  .lam_txt(lz, limpio(titulo) %||% "", 1.3, 2.48, 10.7, 1.5, 30, azul, bold = TRUE, align = "center", nombre = "portada:titulo")
  if (!is.null(limpio(subtexto))) .lam_txt(lz, limpio(subtexto), 1.6, 4.65, 10.1, 0.4, 18, azul, align = "center", nombre = "portada:encargo")
  if (!is.null(limpio(fecha))) .lam_txt(lz, limpio(fecha), 1.6, 5.12, 10.1, 0.4, 18, .std_color("texto_suave"), align = "center", nombre = "portada:fecha")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:portada")
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿La portada cabe? El título en tres líneas a 30 pt en 10.7 in (lo que mide su caja de 1.5 in)
#' @keywords internal
.lam_portada_cabe <- function(titulo) {
  t <- as.character(titulo %||% "")[1]
  !is.na(t) && nzchar(trimws(t)) && .lam_alto_tinta(t, 10.7, 30, TRUE) <= 1.6
}
