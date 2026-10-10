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
  llave <- if (length(idx) == 1L) (if (idx == k) "El valor superior" else if (idx == 1L) "El valor inferior" else "El valor que se toma")
           else if (max(idx) == k) "Los dos valores superiores" else if (min(idx) == 1L) "Los dos valores inferiores" else "Los valores que se suman"
  if (length(idx) > 2L) llave <- sub("dos ", "", llave, fixed = TRUE)
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
    nota <- if (C$faltan == 1) "Falta un punto: va al resto más grande."
            else if (C$faltan > 1) sprintf("Faltan %s puntos: van a los %s restos más grandes.", cuantos, cuantos)
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
    if (!m %in% c("estandar", "estándar", "resto_mayor", "resto-mayor", "reparto", "hare")) {
      .pulso_aviso(sprintf("La lámina de redondeo no reconoce el método «%s»; se usa el estándar. Usa «estandar», «resto_mayor» o «ambos».", m))
    }
    return(if (identical(.pulso_pct_metodo(m), "reparto")) "resto_mayor" else "estandar")
  }
  # Sólo cuentan las familias que cierran en 100 (las que admiten método) y que lo DECLARAN: la que no lo declara no
  # eligió nada, y las agrupadas o las divergentes no tienen método (verificador de N7: con eso salían las dos).
  cierran <- names(Filter(function(f) isTRUE(f$cierra_100), .PRESETS_CALCULOS))
  familias <- intersect(cierran, names(presets %||% list()))
  declarados <- Filter(function(x) !is.null(x) && length(x) && !is.na(x[1]) && nzchar(trimws(as.character(x[1]))),
                       lapply(familias, function(k) presets[[k]]$args$metodo_redondeo))
  usados <- unique(vapply(declarados, function(x) .pulso_pct_metodo(x), ""))
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
#' 30 pt, el encargo y la fecha; tres variantes (Gonzalo, 2026-10-09: quedan todas como opciones)
#'
#' El subtítulo del motor es el rótulo («INFORME CONSOLIDADO»), el subtexto es el encargo («Por encargo de…») y la
#' fecha, la fecha.
#' @keywords internal
.lam_laminas_portada <- function(doc, titulo, subtitulo = NULL, fecha = NULL, subtexto = NULL, layout = "Title Slide",
                                 master = "Office Theme", por_lamina = function(doc) doc, variante = "centrada") {
  limpio <- function(x) if (is.null(x) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  variante <- .lam_portada_variante(variante)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  lz <- .lam_lienzo()
  rot <- limpio(subtitulo); tit <- limpio(titulo) %||% ""; enc <- limpio(subtexto); fec <- limpio(fecha)
  if (identical(variante, "izquierda")) {
    # 24: alineada a la izquierda; la línea coral de la plantilla (y = 4.21) separa título y encargo.
    # Un título de tres líneas sube con su rótulo: la última línea no puede bajar de 3.72 o sus descendentes cruzan la
    # línea coral (verificador de N7, ronda 10).
    sube <- max(0L, .lam_lineas_tinta(tit, 9.6, 30, TRUE) - 2L) * 30 * 1.2 / 72
    if (!is.null(rot)) .lam_txt(lz, toupper(rot), 1.08, 2.25 - sube, 8, 0.32, 13, coral, bold = TRUE, nombre = "portada:rotulo")
    .lam_txt(lz, tit, 1.08, 2.62 - sube, 9.6, 1.3 + sube, 30, azul, bold = TRUE, nombre = "portada:titulo")
    if (!is.null(enc)) .lam_txt(lz, enc, 1.08, 4.45, 9.6, 0.36, 16, azul, nombre = "portada:encargo")
    if (!is.null(fec)) .lam_txt(lz, fec, 1.08, 4.85, 9.6, 0.34, 14, suave, nombre = "portada:fecha")
  } else if (identical(variante, "banda")) {
    # 25: centrada, con el encargo y la fecha en una banda azul al pie.
    H <- 7.5; W <- .std_geom("ancho")
    sube <- max(0L, .lam_lineas_tinta(tit, 10.5, 30, TRUE) - 2L) * 30 * 1.2 / 72
    if (!is.null(rot)) .lam_txt(lz, toupper(rot), 1.6, 2.25 - sube, 10.1, 0.32, 13, coral, bold = TRUE, align = "center", nombre = "portada:rotulo")
    .lam_txt(lz, tit, 1.4, 2.62 - sube, 10.5, 1.3 + sube, 30, azul, bold = TRUE, align = "center", nombre = "portada:titulo")
    .lam_caja(lz, 0, H - 1.25, W, 1.25, azul, nombre = "portada:banda")
    if (!is.null(enc)) .lam_txt(lz, enc, 1.6, H - 0.95, 10.1, 0.34, 15, "#FFFFFF", bold = TRUE, align = "center", nombre = "portada:encargo")
    if (!is.null(fec)) .lam_txt(lz, fec, 1.6, H - 0.58, 10.1, 0.3, 13, "#FFFFFF", align = "center", nombre = "portada:fecha")
  } else {
    if (!is.null(rot)) .lam_txt(lz, toupper(rot), 1.6, 2.12, 10.1, 0.32, 13, coral, bold = TRUE, align = "center", nombre = "portada:rotulo")
    .lam_txt(lz, tit, 1.3, 2.48, 10.7, 1.5, 30, azul, bold = TRUE, align = "center", nombre = "portada:titulo")
    if (!is.null(enc)) .lam_txt(lz, enc, 1.6, 4.65, 10.1, 0.4, 18, azul, align = "center", nombre = "portada:encargo")
    if (!is.null(fec)) .lam_txt(lz, fec, 1.6, 5.12, 10.1, 0.4, 18, suave, align = "center", nombre = "portada:fecha")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:portada")
  list(doc = por_lamina(doc), partes = 1L)
}

#' Variante de portada del recetario: «centrada» (23, por defecto), «izquierda» (24) o «banda» (25)
#' @keywords internal
.lam_portada_variante <- function(variante) {
  v <- .lam_clave(as.character(variante %||% "centrada")[1])
  if (v %in% c("izquierda", "24", "alineada")) "izquierda" else if (v %in% c("banda", "25", "banda inferior")) "banda" else "centrada"
}

#' ¿La portada cabe? El título en tres líneas a 30 pt, cortadas por palabras en el ancho de la caja de su variante
#' (10.7, 9.6 o 10.5 in)
#' @keywords internal
.lam_portada_cabe <- function(titulo, variante = "centrada") {
  t <- as.character(titulo %||% "")[1]
  ancho <- c(centrada = 10.7, izquierda = 9.6, banda = 10.5)[[.lam_portada_variante(variante)]]
  !is.na(t) && nzchar(trimws(t)) && .lam_lineas_tinta(t, ancho, 30, TRUE) <= 3L
}

# ---- Ficha técnica (lámina 29, recetario.R:489-533) -------------------------------------------------------------

#' Ícono del recetario en el paquete (PNG blanco de Lucide, `inst/ppt_assets/iconos_recetario`)
#' @keywords internal
.lam_icono_ruta <- function(nombre, color = "blanco") {
  r <- system.file("ppt_assets", "iconos_recetario", color, paste0(nombre, ".png"), package = "prosecnurapp")
  if (nzchar(r)) r else NULL
}

#' Clave para casar palabras sin tildes ni eñe, igual en todas las plataformas
#'
#' `iconv(…, "ASCII//TRANSLIT")` en macOS da «t'ecnica» y «dise~no» y las palabras clave dejaban de casar (verificador
#' de N7); el reemplazo explícito del helper compartido no depende del sistema.
#' @keywords internal
.lam_clave <- function(x) tolower(chartr("Ñ", "N", .ade_sin_tildes(x)))

#' Ícono de cada fila de la ficha, por lo que dice su criterio
#' @keywords internal
.lam_icono_ficha <- function(criterio) .lam_icono_elegir(criterio, "ficha")$icono

#' La fila «Muestra» del recetario: el número de cada público en grande con su tasa de respuesta, si el detalle se deja
#' leer así («172 estudiantes (96 %), 52 docentes (92 %)»); si no, `NULL` y la fila va como texto
#' @keywords internal
.lam_ficha_muestra <- function(detalle) {
  d <- sub("\\.\\s*$", "", trimws(as.character(detalle)[1]))
  # Una pieza por público: separadas por coma o por la «y» final; el público puede llevar paréntesis («egresados(as)»).
  piezas <- trimws(strsplit(d, ",\\s+|\\s+y\\s+(?=[0-9])", perl = TRUE)[[1]])   # «1,234 estudiantes» no se parte en la coma de miles
  patron <- "^([0-9][0-9.,]*)\\s+(.+?)\\s*\\(\\s*([0-9]+)\\s*%\\s*\\)$"
  if (length(piezas) < 2L || length(piezas) > 4L || !all(grepl(patron, piezas, perl = TRUE))) return(NULL)
  m <- regmatches(piezas, regexec(patron, piezas, perl = TRUE))
  data.frame(n = vapply(m, `[`, "", 2), publico = vapply(m, `[`, "", 3), tasa = vapply(m, `[`, "", 4), stringsAsFactors = FALSE)
}

#' Geometría de la ficha: alto de cada fila (texto a 13 pt en su ancho; la de la muestra en cifras mide 1.25 in)
#' @keywords internal
.lam_ficha_geo <- function(filas) {
  ml <- .std_geom("margen_izq"); W <- .std_geom("ancho"); xv <- ml + 3.3; wv <- W - .std_geom("margen_der") - xv
  muestra <- lapply(filas$detalle, .lam_ficha_muestra)
  # Aire del recetario: 0.95 in para dos líneas y 0.6 a 0.75 para una (recetario.R:513).
  h <- vapply(seq_len(nrow(filas)), function(i) if (!is.null(muestra[[i]])) 1.25 else max(0.6, .lam_alto_tinta(filas$detalle[i], wv, 13) + 0.4), 0)
  list(xv = xv, wv = wv, h = h, muestra = muestra, alto = sum(h) + 0.12 * nrow(filas))
}

#' Ficha técnica del recetario: una fila por criterio con su ícono en círculo, el criterio en negrita y el detalle; la
#' muestra por público va en cifras con su tasa de respuesta en verde
#' @keywords internal
.lam_laminas_ficha <- function(doc, titulo, filas, base = NULL, ante = "Metodología", folio = NULL, layout = "Graficos",
                               master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  ml <- .std_geom("margen_izq"); W <- .std_geom("ancho"); mr <- .std_geom("margen_der"); yt <- .std_geom("zona_datos_y0")
  azul <- .std_color("azul"); G <- .lam_ficha_geo(filas)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo(); y <- yt - 0.15; iconos <- list()
  for (i in seq_len(nrow(filas))) {
    h <- G$h[i]
    .lam_caja(lz, ml, y + (h - 0.48) / 2, 0.48, 0.48, azul, geom = "ellipse", nombre = "ficha:icono_fondo")
    iconos[[length(iconos) + 1L]] <- list(n = .lam_icono_ficha(filas$criterio[i]), x = ml + 0.12, y = y + (h - 0.48) / 2 + 0.12)
    .lam_txt(lz, filas$criterio[i], ml + 0.9, y + (h - 0.32) / 2, 2.3, 0.32, 14, azul, bold = TRUE, nombre = "ficha:criterio")
    mu <- G$muestra[[i]]
    if (!is.null(mu)) {
      for (j in seq_len(nrow(mu))) {
        xx <- G$xv + (j - 1) * G$wv / 4
        .lam_txt(lz, mu$n[j], xx, y + 0.02, 1.4, 0.5, 26, azul, bold = TRUE, nombre = "ficha:muestra_n")
        .lam_txt(lz, mu$publico[j], xx, y + 0.5, G$wv / 4 - 0.1, 0.3, 12, azul, nombre = "ficha:muestra_publico")
        .lam_txt(lz, sprintf("%s%% de respuesta", mu$tasa[j]), xx, y + 0.78, G$wv / 4, 0.28, 11, .std_color("verde_top_two_box"), bold = TRUE, nombre = "ficha:muestra_tasa")
      }
    } else {
      ht <- .lam_alto_tinta(filas$detalle[i], G$wv, 13)
      .lam_txt(lz, filas$detalle[i], G$xv, y + (h - ht) / 2, G$wv, ht, 13, azul, nombre = "ficha:detalle")
    }
    y <- y + h + 0.12
    if (i < nrow(filas)) .lam_separador_h(lz, ml, W - mr, y - 0.06)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:ficha")
  for (ic in iconos) {
    ruta <- .lam_icono_ruta(ic$n)
    if (!is.null(ruta)) doc <- officer::ph_with(doc, officer::external_img(ruta, width = 0.24, height = 0.24),
                                                location = officer::ph_location(left = ic$x, top = ic$y, width = 0.24, height = 0.24, newlabel = "ficha:icono"))
  }
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿La ficha cabe? De una a siete filas que entran en la lámina, con criterios de una línea en 2.3 in
#' @keywords internal
.lam_ficha_cabe <- function(filas) {
  if (!is.data.frame(filas) || !nrow(filas) || nrow(filas) > 7L || !all(c("criterio", "detalle") %in% names(filas))) return(FALSE)
  G <- .lam_ficha_geo(filas)
  G$alto <= .std_geom("contenido_y1") - .std_geom("zona_datos_y0") + 0.15 && all(.lam_ancho_tinta(filas$criterio, 14, TRUE) <= 2.3)
}

#' Las dos primeras columnas de la tabla técnica como criterio y detalle
#' @keywords internal
.lam_ficha_filas <- function(tabla) {
  if (!is.data.frame(tabla) || ncol(tabla) < 2L) return(data.frame(criterio = character(0), detalle = character(0)))
  data.frame(criterio = trimws(as.character(tabla[[1]])), detalle = trimws(as.character(tabla[[2]])), stringsAsFactors = FALSE)
}

# ---- Objetivo (lámina 26, recetario.R:461-487; variante «A. Sobria» elegida por Gonzalo) --------------------------

#' Ícono de cada actor del objetivo, por su nombre
#' @keywords internal
.lam_icono_actor <- function(actor) .lam_icono_elegir(actor, "actor")$icono

#' Va sobre el layout general, como la moderna del recetario (el «Objetivos_Secciones» trae una línea punteada que cruza
#' el texto) y sólo con la plantilla de PULSO: la de un cliente conserva su objetivo.
#'
#' Objetivo del recetario: la diana en un círculo coral con «Objetivo del estudio», el objetivo a 22 pt con sus temas en
#' negrita (`**…**`) y, si se declaran (`meta$actores`), los actores consultados con su ícono
#' @keywords internal
.lam_laminas_objetivo <- function(doc, texto, titulo = NULL, actores = NULL, layout = "Graficos", master = "Office Theme",
                                  por_lamina = function(doc) doc) {
  ml <- .std_geom("margen_izq"); W <- .std_geom("ancho"); ac <- W - ml - .std_geom("margen_der")
  azul <- .std_color("azul"); coral <- .std_color("coral")
  titulo <- as.character(titulo %||% "")[1]; if (is.na(titulo) || !nzchar(trimws(titulo))) titulo <- "Objetivo del estudio"
  actores <- as.character(actores %||% character(0)); actores <- actores[nzchar(trimws(actores))]
  doc <- officer::add_slide(doc, layout = layout, master = master)
  lz <- .lam_lienzo(); iconos <- list(list(n = "diana-flecha", x = ml + 0.62 * 0.24, y = 1.25 + 0.62 * 0.24))
  .lam_caja(lz, ml, 1.25, 0.62, 0.62, coral, geom = "ellipse", nombre = "objetivo:icono_fondo")
  .lam_txt(lz, titulo, ml + 0.8, 1.33, 6, 0.45, 20, coral, bold = TRUE, nombre = "objetivo:titulo")
  .lam_txt_tramos(lz, .lam_narrativa_tramos(texto), ml, 2.3, ac, 2.0, size = 22, nombre = "objetivo:texto")
  if (length(actores)) {
    .lam_separador_h(lz, ml, W - .std_geom("margen_der"), 4.7)
    .lam_txt(lz, "Actores consultados", ml, 4.85, ac, 0.32, 12, .std_color("texto_suave"), bold = TRUE, nombre = "objetivo:actores_rotulo")
    wa <- ac / length(actores)
    for (k in seq_along(actores)) {
      xa <- ml + (k - 1) * wa
      .lam_caja(lz, xa + (wa - 0.62) / 2, 5.35, 0.62, 0.62, azul, geom = "ellipse", nombre = "objetivo:actor_fondo")
      iconos[[length(iconos) + 1L]] <- list(n = .lam_icono_actor(actores[k]), x = xa + (wa - 0.62) / 2 + 0.62 * 0.24, y = 5.35 + 0.62 * 0.24)
      .lam_txt(lz, actores[k], xa - 0.1, 6.05, wa + 0.2, 0.5, 12, azul, bold = TRUE, align = "center", nombre = "objetivo:actor")
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:objetivo")
  for (ic in iconos) {
    ruta <- .lam_icono_ruta(ic$n); d <- 0.62 * 0.52
    if (!is.null(ruta)) doc <- officer::ph_with(doc, officer::external_img(ruta, width = d, height = d),
                                                location = officer::ph_location(left = ic$x, top = ic$y, width = d, height = d, newlabel = "objetivo:icono"))
  }
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El objetivo cabe? El texto en cinco líneas a 22 pt (su caja de 2 in), contadas por párrafo —un objetivo con
#' objetivos específicos en párrafos pisaba el filete (verificador de N7)— y hasta seis actores con nombre de dos líneas
#' @keywords internal
.lam_objetivo_cabe <- function(texto, actores = NULL) {
  t <- gsub("**", "", as.character(texto %||% "")[1], fixed = TRUE)
  if (is.na(t) || !nzchar(trimws(t))) return(FALSE)
  ac <- .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")
  parrafos <- strsplit(t, "\n")[[1]]; parrafos <- if (length(parrafos)) parrafos else t
  lineas <- sum(vapply(parrafos, function(p) max(1, ceiling(.lam_ancho_tinta(p, 22, TRUE) / (ac - 0.1))), 0))
  actores <- as.character(actores %||% character(0))
  lineas <= 5 && length(actores) <= 6L &&
    (!length(actores) || all(.lam_alto_tinta(actores, ac / length(actores), 12, TRUE) <= 0.55))
}

# ---- Índice (láminas 31, 36, 41 y 46; propuestas_indice.R:22-70, dirección «geometría abstracta») ------------------

.LAM_INDICE_COMPOSICIONES <- c("arcos", "facetas", "circulos", "bloques")

#' Ícono navy de cada capítulo del índice, por su título (o el que se declare en `meta$iconos`)
#' @keywords internal
.lam_icono_capitulo <- function(titulo) .lam_icono_elegir(titulo, "capitulo")$icono

#' Subcapítulos alineados con los capítulos: por nombre si la lista viene nombrada (como la arma el plan), si no por
#' posición; un capítulo sin subcapítulos queda vacío
#' @keywords internal
.lam_indice_subs <- function(secciones, subindices) {
  n <- length(secciones)
  # La tabla que el motor ya normaliza (`.indice_subindices_df`: lista, data.frame, líneas «Sección: subtema» y
  # `subtemas`), con columnas `seccion` e `item`: se reparte por capítulo (verificador de N7: sin ella se perdían).
  if (is.data.frame(subindices) && all(c("seccion", "item") %in% names(subindices))) {
    sec <- .lam_clave(trimws(as.character(subindices$seccion))); it <- trimws(as.character(subindices$item))
    return(lapply(.lam_clave(trimws(as.character(secciones))), function(k) { x <- it[sec == k]; x[nzchar(x)] }))
  }
  if (is.null(subindices) || !is.list(subindices) || is.data.frame(subindices)) return(vector("list", n))
  nm <- names(subindices)
  lapply(seq_len(n), function(k) {
    x <- if (!is.null(nm) && any(nzchar(nm))) subindices[[secciones[k]]] else if (k <= length(subindices)) subindices[[k]] else NULL
    x <- as.character(unlist(x %||% character(0))); x[nzchar(trimws(x))]
  })
}

#' ¿El plan pide el índice de focos? Sus ajustes (`iconos_focos…`) o `meta$composicion = "focos"` son una elección
#' explícita de ese estilo, que conserva su ruta
#' @keywords internal
.lam_indice_focos <- function(slots, meta = list()) {
  # Con contenido: la app manda `iconos_focos = ""` cuando no se eligieron íconos, y eso no es pedir focos.
  lleno <- function(x) !is.null(x) && length(x) && any(nzchar(trimws(as.character(unlist(x)))) & !is.na(unlist(x)))
  identical(tolower(as.character(meta$composicion %||% "")[1]), "focos") ||
    any(vapply(c("iconos_focos", "iconos_focos_fill", "iconos_focos_objeto_unico", "iconos_focos_diametro_cm", "iconos_focos_icon_scale",
                 "iconos_focos_left_cm", "iconos_focos_top_cm"), function(k) lleno(slots[[k]]), TRUE)) || isTRUE(slots$redibujar_focos) ||
    isTRUE((slots$estilo %||% list())$redibujar_focos) || lleno((slots$estilo %||% list())$iconos_focos)
}

#' Geometría de la lista del índice (la del recetario por número de capítulos, con o sin subcapítulos)
#' @keywords internal
.lam_indice_geo <- function(n, ns) {
  y0 <- 1.75; y1 <- 6.95; alto <- y1 - y0
  if (ns == 0) {
    rh <- min(if (n <= 5) 0.95 else 0.62, alto / n)
    list(sub = FALSE, rh = rh, fs = if (n <= 5) 18 else if (n <= 8) 15 else 12.5, di = if (n <= 5) 0.44 else if (n <= 8) 0.34 else 0.26,
         dx = if (n <= 5) 0.75 else 0.6, ya = y0 + (alto - n * rh) / 2, negrita = n <= 5)
  } else {
    hs <- min(0.31, (alto - 0.5 * n - 0.12 * (n - 1)) / ns)
    list(sub = TRUE, hm = 0.5, hs = hs, di = 0.36, dx = 0.65, y0 = y0)
  }
}

#' Índice del recetario: la ilustración de su composición a la izquierda y la lista con número coral, ícono y título
#'
#' @param composicion «arcos» (por defecto, la 31), «facetas», «circulos» o «bloques» (`meta$composicion`).
#' @keywords internal
.lam_laminas_indice <- function(doc, secciones, subindices = NULL, titulo = NULL, composicion = "arcos", iconos = NULL,
                                layout = "Graficos", master = "Office Theme", por_lamina = function(doc) doc) {
  W <- .std_geom("ancho"); mr <- .std_geom("margen_der"); azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  composicion <- tolower(as.character(composicion %||% "arcos")[1]); if (!composicion %in% .LAM_INDICE_COMPOSICIONES) composicion <- "arcos"
  caps <- as.character(secciones); n <- length(caps)
  subs <- .lam_indice_subs(caps, subindices)
  ns <- sum(lengths(subs)); G <- .lam_indice_geo(n, ns)
  icos <- if (length(iconos) == n) as.character(iconos) else vapply(caps, .lam_icono_capitulo, "", USE.NAMES = FALSE)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  ilu <- system.file("ppt_assets", "indice_geometria", paste0(composicion, ".png"), package = "prosecnurapp")
  if (nzchar(ilu)) doc <- officer::ph_with(doc, officer::external_img(ilu, width = 6.2, height = 7.5),
                                           location = officer::ph_location(left = 0, top = 0, width = 6.2, height = 7.5, newlabel = "indice:ilustracion"))
  lz <- .lam_lienzo(); xl <- 6.75; iconos_xy <- list()
  .lam_txt(lz, as.character(titulo %||% "Índice")[1], xl - 0.1, 0.86, 4, 0.62, 30, coral, bold = TRUE, nombre = "Titulo lamina")
  if (!G$sub) {
    xi <- xl + G$dx; xt <- xi + G$di + 0.25
    for (k in seq_len(n)) {
      y <- G$ya + (k - 1) * G$rh
      .lam_txt(lz, sprintf("%d", k), xl - 0.1, y + (G$rh - G$fs / 46) / 2 - 0.02, 0.8, G$fs / 46 + 0.08, G$fs, coral, bold = TRUE, nombre = "indice:numero")
      iconos_xy[[k]] <- list(n = icos[k], x = xi, y = y + (G$rh - G$di) / 2, d = G$di)
      .lam_txt(lz, caps[k], xt - 0.1, y + (G$rh - G$fs / 48) / 2 - 0.02, W - mr - xt + 0.1, G$fs / 48 + 0.08, G$fs, azul, bold = G$negrita, nombre = "indice:capitulo")
      if (k < n) .lam_caja(lz, xl, y + G$rh - 0.003, W - mr - xl, 0.005, .std_color("filete"), nombre = "indice:filete")
    }
  } else {
    xi <- xl + G$dx; xt <- xi + G$di + 0.25; y <- G$y0
    for (k in seq_len(n)) {
      .lam_txt(lz, sprintf("%d", k), xl - 0.1, y + (G$hm - 0.34) / 2, 0.8, 0.34, 15, coral, bold = TRUE, nombre = "indice:numero")
      iconos_xy[[k]] <- list(n = icos[k], x = xi, y = y + (G$hm - G$di) / 2, d = G$di)
      .lam_txt(lz, caps[k], xt - 0.1, y + (G$hm - 0.34) / 2, W - mr - xt + 0.1, 0.34, 15, azul, bold = TRUE, nombre = "indice:capitulo"); y <- y + G$hm
      for (j in seq_along(subs[[k]])) {
        .lam_txt(lz, sprintf("%d.%d", k, j), xt - 0.1, y + (G$hs - 0.28) / 2, 0.55, 0.28, 11, suave, bold = TRUE, nombre = "indice:subnumero")
        .lam_txt(lz, subs[[k]][j], xt + 0.42, y + (G$hs - 0.28) / 2, W - mr - xt - 0.42, 0.28, 12, suave, nombre = "indice:subcapitulo"); y <- y + G$hs
      }
      if (k < n) { .lam_caja(lz, xl, y + 0.04, W - mr - xl, 0.005, .std_color("filete"), nombre = "indice:filete"); y <- y + 0.12 }
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:indice")
  for (ic in iconos_xy) {
    ruta <- .lam_icono_ruta(ic$n, "navy")
    if (!is.null(ruta)) doc <- officer::ph_with(doc, officer::external_img(ruta, width = ic$d, height = ic$d),
                                                location = officer::ph_location(left = ic$x, top = ic$y, width = ic$d, height = ic$d, newlabel = "indice:icono"))
  }
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El índice cabe? De 1 a 13 capítulos de una línea en su columna y, con subcapítulos, filas de al menos 0.18 in (la 32
#' del recetario los dibuja a 0.20: cinco capítulos con once subcapítulos)
#' @keywords internal
.lam_indice_cabe <- function(secciones, subindices = NULL) {
  caps <- as.character(secciones %||% character(0)); n <- length(caps)
  if (!n || n > 13L || any(!nzchar(trimws(caps)))) return(FALSE)
  subs <- .lam_indice_subs(caps, subindices)
  ns <- sum(lengths(subs)); G <- .lam_indice_geo(n, ns)
  W <- .std_geom("ancho"); mr <- .std_geom("margen_der"); xl <- 6.75
  if (!G$sub) return(all(.lam_ancho_tinta(caps, G$fs, G$negrita) <= W - mr - (xl + G$dx + G$di + 0.25) - 0.1))
  G$hs >= 0.18 && all(.lam_ancho_tinta(caps, 15, TRUE) <= W - mr - (xl + G$dx + G$di + 0.25) - 0.1) &&
    all(.lam_ancho_tinta(unlist(subs), 12) <= W - mr - (xl + G$dx + G$di + 0.25) - 0.5)
}

# ---- Cierre (láminas 61 a 65, recetario_m9.R y recetario.R:840-845) ----------------------------------------------

.LAM_CIERRE_CONTACTO <- c(correo = "pulsopucp@pucp.edu.pe", direccion = "Av. Universitaria 1801, San Miguel, Lima 32, Perú", web = "pulso.pucp.edu.pe")
.LAM_CIERRE_ICONOS <- c(correo = "mail", direccion = "map-pin", web = "globe")
.LAM_CIERRE_ROTULOS <- c(correo = "Correo", direccion = "Dirección", web = "Web")
# Contraportada de los informes entregados (65): cada dato junto a su ícono de la plantilla, a 12 pt.
.LAM_CIERRE_PIE <- list(correo = c(1.08, 6.70, 2.4), direccion = c(5.20, 6.69, 4.9), web = c(11.17, 6.71, 1.8))

#' Variante de cierre: «contraportada» (65, por defecto), «banda_azul» (61), «banda_clara» (62), «contacto» (63) o
#' «tres_columnas» (64)
#' @keywords internal
.lam_cierre_variante <- function(variante) {
  v <- gsub("[ -]+", "_", .lam_clave(as.character(variante %||% "contraportada")[1]))
  if (is.na(v)) return("contraportada")
  if (v %in% c("banda_azul", "61")) "banda_azul" else if (v %in% c("banda_clara", "62")) "banda_clara"
  else if (v %in% c("contacto", "contacto_bajo_el_logo", "63")) "contacto" else if (v %in% c("tres_columnas", "64")) "tres_columnas"
  else "contraportada"
}

#' Contacto del cierre: los datos de PULSO PUCP salvo los que el plan reemplace; un dato vacío se omite
#' @keywords internal
.lam_cierre_contacto <- function(slots) {
  datos <- vapply(names(.LAM_CIERRE_CONTACTO), function(k) {
    v <- slots[[k]]
    if (is.null(v)) .LAM_CIERRE_CONTACTO[[k]] else trimws(as.character(v)[1] %||% "")
  }, "")
  datos[is.na(datos)] <- ""
  k <- names(datos)[nzchar(datos)]
  data.frame(clave = k, icono = unname(.LAM_CIERRE_ICONOS[k]), rotulo = unname(.LAM_CIERRE_ROTULOS[k]), dato = unname(datos[k]),
             stringsAsFactors = FALSE)
}

#' ¿El contacto cabe en la variante? Al pie, cada dato en la caja de su ícono; en fila, los tres en el ancho de la
#' lámina con una pulgada de margen; en columnas, cada uno en dos líneas de 4 in como mucho
#' @keywords internal
.lam_cierre_cabe <- function(contacto, variante) {
  if (!nrow(contacto)) return(identical(variante, "contraportada"))
  a <- .lam_ancho_tinta(contacto$dato, 12)
  switch(variante,
    contraportada = all(a <= vapply(contacto$clave, function(k) .LAM_CIERRE_PIE[[k]][3] - 0.2, 0)),
    tres_columnas = all(.lam_lineas_tinta(contacto$dato, 4.0, 12) <= 2L),
    sum(0.36 + a) + 0.7 * (nrow(contacto) - 1) <= .std_geom("ancho") - 1.0)
}

#' Cierre del recetario sobre el layout «Contraportada»: el logo de la plantilla centrado y el contacto según la variante
#'
#' Donde el contacto no va al pie, una forma del color del fondo tapa los íconos del layout sin tocar la línea coral.
#' @keywords internal
.lam_laminas_cierre <- function(doc, variante = "contraportada", contacto = .lam_cierre_contacto(list()), layout = "Contraportada",
                                master = "Office Theme", por_lamina = function(doc) doc) {
  variante <- .lam_cierre_variante(variante)
  W <- .std_geom("ancho"); H <- 7.5; logo_y1 <- 2.16 + 2.67
  azul <- .std_color("azul"); n <- nrow(contacto)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  lz <- .lam_lienzo(); iconos <- list()
  ico <- function(clave, color, x, y, d = 0.24) iconos[[length(iconos) + 1L]] <<- list(n = .LAM_CIERRE_ICONOS[[clave]], color = color, x = x, y = y, d = d)
  fila <- function(y, color = azul, ico_color = "navy", gap = 0.7) {
    ws <- 0.36 + .lam_ancho_tinta(contacto$dato, 12); x <- (W - sum(ws) - gap * (n - 1)) / 2
    for (k in seq_len(n)) {
      ico(contacto$clave[k], ico_color, x, y + 0.05)
      .lam_txt(lz, contacto$dato[k], x + 0.22, y, ws[k], 0.32, 12, color, nombre = paste0("cierre:", contacto$clave[k]))
      x <- x + ws[k] + gap
    }
  }
  if (identical(variante, "contraportada")) {
    for (k in seq_len(n)) {
      p <- .LAM_CIERRE_PIE[[contacto$clave[k]]]
      .lam_txt(lz, contacto$dato[k], p[1], p[2], p[3], 0.4, 12, azul, nombre = paste0("cierre:", contacto$clave[k]))
    }
    # El ícono de la plantilla de un dato omitido queda tapado: un ícono sin dato no dice nada. El sobre del layout va de
    # 0.478 a 1.062 in y el globo hasta 11.128 (verificador de N7, ronda 12): la tapa cubre de x - 0.68 a x - 0.005.
    for (k in setdiff(names(.LAM_CIERRE_PIE), contacto$clave)) .lam_caja(lz, .LAM_CIERRE_PIE[[k]][1] - 0.68, 6.5, 0.675, 0.75, .std_color("fondo"), nombre = "cierre:tapa")
  } else {
    .lam_caja(lz, 0, 6.45, W, 0.95, .std_color("fondo"), nombre = "cierre:tapa")
    if (identical(variante, "banda_azul")) {
      .lam_caja(lz, 0, H - 1.05, W, 1.05, azul, nombre = "cierre:banda")
      if (n) fila(H - 0.69, color = "#FFFFFF", ico_color = "blanco")
    } else if (identical(variante, "banda_clara")) {
      .lam_caja(lz, 0, 6.42, W, 1.0, "#FFFFFF", nombre = "cierre:banda")
      .lam_caja(lz, 0, 6.42, W, 0.02, azul, nombre = "cierre:filete")
      if (n) fila(6.78)
    } else if (identical(variante, "contacto")) {
      if (n) { .lam_caja(lz, W / 2 - 0.45, logo_y1 + 0.7, 0.9, 0.02, .std_color("filete"), nombre = "cierre:filete"); fila(logo_y1 + 1.05) }
    } else {
      wc <- 4.2; x0 <- (W - n * wc) / 2; y <- logo_y1 + 0.5
      for (k in seq_len(n)) {
        xk <- x0 + (k - 1) * wc
        if (k > 1) .lam_separador_v(lz, xk, y + 0.05, y + 1.15)
        .lam_caja(lz, xk + wc / 2 - 0.21, y, 0.42, 0.42, azul, geom = "ellipse", nombre = "cierre:icono_fondo")
        ico(contacto$clave[k], "blanco", xk + wc / 2 - 0.21 + 0.42 * 0.24, y + 0.42 * 0.24, 0.42 * 0.52)
        .lam_txt(lz, toupper(contacto$rotulo[k]), xk, y + 0.5, wc, 0.26, 10, .std_color("texto_suave"), bold = TRUE, align = "center", nombre = "cierre:rotulo")
        .lam_txt(lz, contacto$dato[k], xk + 0.1, y + 0.76, wc - 0.2, max(0.32, .lam_lineas_tinta(contacto$dato[k], wc - 0.2, 12) * 12 * 1.2 / 72 + 0.12), 12, azul, align = "center",
                 nombre = paste0("cierre:", contacto$clave[k]))
      }
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:cierre")
  for (ic in iconos) {
    ruta <- .lam_icono_ruta(ic$n, ic$color)
    if (!is.null(ruta)) doc <- officer::ph_with(doc, officer::external_img(ruta, width = ic$d, height = ic$d),
                                                location = officer::ph_location(left = ic$x, top = ic$y, width = ic$d, height = ic$d, newlabel = "cierre:icono"))
  }
  list(doc = por_lamina(doc), partes = 1L)
}
