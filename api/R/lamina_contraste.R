# =============================================================================
# lamina_contraste.R — contraste de públicos y panorama, con formas nativas (ADR 0134)
# =============================================================================
#
# Las dos láminas de puntos del resumen ejecutivo de Formación General de Arte y Diseño 2026 comparten geometría:
# rótulos a la izquierda, el área de puntos al centro con bandas alternas y una tabla lateral FUERA del área del
# gráfico, con encabezados. El contraste (`contraste/1`, graficos_espec_contraste.R) lleva «Diferencia» y «Base» con
# una columna por grupo; el panorama (`panorama/1`, graficador_panorama.R), «Mediana» y «Bajo 60%».
#
# Cada marca es una forma de PowerPoint (círculo, cuadrado, triángulo o rombo) con borde blanco: la forma distingue
# los grupos aunque la lámina se imprima en blanco y negro.

#' Tono a medio camino entre un color y el blanco (bandas y segmentos suaves)
#' @keywords internal
.lam_aclarar <- function(col, t = 0.5) grDevices::colorRampPalette(c(col, "#FFFFFF"))(101)[round(t * 100) + 1L]

#' Borde superior de un texto de `size` pt para que su línea quede centrada en `yc`
#' @keywords internal
.lam_y_centrada <- function(yc, size, lineas = 1L) yc - lineas * size * 1.2 / 144 - 0.05

#' Marca de un grupo: su forma centrada en (x, y), de `d` pulgadas, con borde blanco
#' @keywords internal
.lam_marca <- function(lz, forma, x, y, d, col, nombre = "marca") {
  d2 <- if (identical(forma, "triangle") || identical(forma, "diamond")) d * 1.15 else if (identical(forma, "rect")) d * 0.92 else d
  .lam_caja(lz, x - d2 / 2, y - d2 / 2, d2, d2, col, nombre = nombre, geom = forma, borde = "#FFFFFF", borde_pt = 1)
}

#' Geometría común: ancho de rótulos, tabla lateral y área de puntos
#'
#' @param rotulos Rótulos de fila. @param cols Lista de columnas de la tabla, cada una `list(encabezado, textos, ancho)`.
#' @return Lista con `wrot`, `xl`, `xr` (área de puntos), `xt` (inicio de la tabla) y `xs` (centro de cada columna).
#' @keywords internal
.lam_puntos_marco <- function(rotulos, anchos_tabla, size_rot = 12, bold_rot = FALSE, tope_rot = 3.8) {
  g_ <- .std_geom; ml <- g_("margen_izq"); fin <- g_("ancho") - g_("margen_der")
  tinta <- max(vapply(rotulos, function(t) .lam_ancho_tinta(t, size_rot, bold_rot), 0))
  wrot <- min(tope_rot, max(1.4, tinta + 0.25))
  xt <- fin - sum(anchos_tabla)
  xs <- xt + cumsum(anchos_tabla) - anchos_tabla / 2
  list(wrot = wrot, xl = ml + wrot + 0.25, xr = xt - 0.5, xt = xt, xs = xs, fin = fin, ml = ml)
}

#' Ancho de una columna de la tabla lateral: lo que pide su texto más ancho, con aire
#' @keywords internal
.lam_puntos_ancho_col <- function(encabezado, textos, size = 10.5, piso = 1.0) {
  max(piso, .lam_ancho_tinta(encabezado, 10.5, TRUE) + 0.3, max(vapply(textos, function(t) .lam_ancho_tinta(t, size, FALSE), 0)) + 0.3)
}

#' Eje de porcentaje: guías verticales y su cifra debajo
#' @keywords internal
.lam_puntos_eje <- function(lz, px, eje, y0, y1, cada = 1L) {
  vs <- seq(eje[["lo"]], eje[["hi"]], by = eje[["paso"]])
  for (i in seq_along(vs)) {
    v <- vs[i]
    .lam_caja(lz, px(v) - 0.003, y0, 0.006, y1 - y0, .std_color("filete"), nombre = "puntos:guia")   # P10: se ve sobre el gris, como en las pesas
    # `cada`: en un área angosta (una ranura) se rotula una guía de cada `cada`, desde la primera.
    if ((i - 1L) %% cada == 0L) .lam_txt(lz, paste0(format(v, trim = TRUE), "%"), px(v) - 0.4, y1 + 0.04, 0.8, 0.26, 9.5, .std_color("texto_suave"), align = "center", nombre = "puntos:eje")
  }
  .lam_caja(lz, px(eje[["lo"]]), y1 - 0.004, px(eje[["hi"]]) - px(eje[["lo"]]), 0.008, .std_color("filete"), nombre = "puntos:base_eje")
}

#' Leyenda de marcas arriba a la izquierda del área de puntos
#' @keywords internal
.lam_puntos_leyenda <- function(lz, x, y, rotulos, colores, formas) {
  for (i in seq_along(rotulos)) {
    .lam_marca(lz, formas[i], x + 0.07, y + 0.15, 0.13, colores[i], nombre = "leyenda:marca")
    w <- .lam_ancho_tinta(rotulos[i], 10.5, FALSE) + 0.25
    .lam_txt(lz, rotulos[i], x + 0.14, y, w + 0.1, 0.3, 10.5, .std_color("azul"), nombre = "leyenda:texto")
    x <- x + 0.14 + w + 0.25
  }
  invisible(x)
}

#' Ancho visible de la leyenda de marcas (`.lam_puntos_leyenda`): de la primera marca al final del último rótulo
#' @keywords internal
.lam_puntos_leyenda_ancho <- function(rotulos) {
  if (!length(rotulos)) return(0)
  sum(0.24 + .lam_ancho_tinta(rotulos, 10.5, FALSE)) + 0.4 * (length(rotulos) - 1L)
}

#' Dónde arranca la leyenda centrada en `xc` sin entrar en la columna que empieza en `tope` ni pasar de `piso` (in)
#' @keywords internal
.lam_puntos_leyenda_x <- function(rotulos, xc, tope, piso) {
  wl <- .lam_puntos_leyenda_ancho(rotulos)
  max(piso, min(xc - wl / 2, tope - wl))
}

#' Columnas de la tabla lateral del contraste: «Diferencia» y, si la base va en la tabla, una por grupo
#' @keywords internal
.lam_contraste_anchos <- function(espec) {
  con_base <- identical(espec$base_en %||% "tabla", "tabla")
  c(1.2, if (con_base) vapply(seq_along(espec$grupos), function(j) .lam_puntos_ancho_col(espec$grupos[j], espec$bases[, j]), 0))
}

#' Geometría del contraste con sus rótulos: letra, ancho de la columna, alto de cada fila y rótulos recortados
#'
#' ADR 0135, oleada 5 (Arte, 13 pares con el enunciado entero por rótulo): un rótulo va en hasta tres líneas y su fila
#' crece lo que el rótulo pide; el resto del alto se reparte por igual. Se prueba primero la letra de la lámina
#' (11.5 pt) y luego 11 y 10.5 pt, y con cada letra la columna de rótulos se ensancha de a 0.1 in hasta dejar 3.5 in de
#' área de puntos. Gana la primera combinación en que todo cabe sin recortar; si ninguna, la columna más ancha a
#' 10.5 pt con los rótulos de más de tres líneas recortados con «…». Si ni así caben las filas, la lámina no cabe.
#' @return Lista con `cabe` y, si cabe, `size`, `m` (marco de `.lam_puntos_marco`), `alturas`, `u`, `pasos`, `textos`,
#'   `recortados`, `anchos`, `cab`, `zona0` y `zona1`.
#' @param titulo,sub Los de la lámina: el bloque arranca bajo ellos (P13). Sin título (la consulta de si cabe, que no lo
#'   conoce) arranca en la zona de datos, que queda más abajo que el fin de un título de una o dos líneas: lo que cabe
#'   ahí cabe también bajo el título.
#' @keywords internal
.lam_contraste_geom <- function(espec, titulo = NULL, sub = NULL) {
  g_ <- .std_geom
  n <- length(espec$rotulos); k <- length(espec$grupos); par <- identical(espec$modo, "par")
  anchos <- .lam_contraste_anchos(espec); con_base <- length(anchos) > 1L
  # La leyenda (izquierda) y el encabezado «Diferencia» (derecha) no se cruzan: sin columnas de base comparten franja.
  cab <- if (con_base) 0.95 else 0.6
  # P13 (Gonzalo, 2026-11-09, como la escala del resumen): el bloque arranca bajo el título con el aire de la casa.
  zona0 <- if (is.null(titulo)) g_("zona_datos_y0") - 0.05 else .lam_titulo_fin(titulo, sub) + .LAM_AIRE_BAJO_TITULO_IN
  zona1 <- g_("contenido_y1") - 0.35
  disponible <- zona1 - zona0 - cab
  pasos <- if (par) rep(1, n) else rep(k + 0.7, n)
  u_min <- if (par) 0.22 else 0.14; u_max <- if (par) 0.5 else 0.28
  base_m <- .lam_puntos_marco(espec$rotulos, anchos, size_rot = 11.5, tope_rot = 3.8)
  w_max <- (base_m$xt - 0.5) - 3.5 - 0.25 - base_m$ml
  prueba <- function(size, w, recortar) {
    rr <- lapply(espec$rotulos, function(t) .lam_rotulo_recortar(t, w, size, 3L))
    if (!recortar && any(vapply(rr, `[[`, TRUE, "recortado"))) return(NULL)
    lh <- size * 1.2 / 72
    texto_h <- vapply(rr, function(r) length(r$lineas), 0L) * lh
    # P15: cada pregunta mide su contenido (su rótulo o sus sub-filas, lo mayor) más un hueco común: el mismo hueco entre
    # todas, no el mismo paso (lamina_filas_hueco.R). Con grupos, la sub-fila toma el paso más grande que deja caber.
    hu <- NULL; u <- if (par) u_min else u_max
    for (u_try in if (par) u_min else seq(u_max, u_min, by = -0.01)) {
      contenido <- pmax(texto_h, if (par) 0.17 else k * u_try)
      hu <- .lam_filas_hueco_uniforme(contenido, disponible, hueco_min = 0.05, hueco_max = if (par) u_max - lh else 0.7 * u_try + 0.1)
      if (!is.null(hu)) { u <- u_try; break }
    }
    if (is.null(hu)) return(NULL)
    list(size = size, w = w, u = if (par) min(hu$alturas) else u, alturas = hu$alturas, textos = vapply(rr, `[[`, "", "texto"),
         recortados = sum(vapply(rr, `[[`, TRUE, "recortado")), contenido = contenido, hueco = hu$hueco)
  }
  elegido <- NULL
  for (size in .lam_rotulo_pasos_pt(11.5)) {   # 11.5, 11 y el piso de 10.5 pt (lamina_rotulo_resumen.R)
    w0 <- .lam_puntos_marco(espec$rotulos, anchos, size_rot = size, tope_rot = 3.8)$wrot
    # H4 (regla de la casa, ancho dinámico del rótulo): la columna más ancha que deja el área de puntos en su mínimo, sin
    # pasar de lo que piden los rótulos en una línea. Antes ganaba la más angosta que cabía y un rótulo que entraba en una
    # línea se partía en dos (el tope de 3.8 in de `.lam_puntos_marco`).
    w <- .lam_contraste_ancho_rotulos(espec$rotulos, size, w0, max(w0, w_max))
    elegido <- prueba(size, w, FALSE)
    if (!is.null(elegido)) break
  }
  if (is.null(elegido) && w_max >= 1.4) elegido <- prueba(.LAM_ROTULO_PT_PISO, w_max, TRUE)
  if (is.null(elegido)) return(list(cabe = FALSE))
  m <- base_m
  m$wrot <- elegido$w; m$xl <- m$ml + m$wrot + 0.25
  c(list(cabe = (m$xr - m$xl) >= 3.5 - 1e-6, m = m, pasos = pasos, anchos = anchos, cab = cab, zona0 = zona0, zona1 = zona1),
    elegido[c("size", "u", "alturas", "textos", "recortados", "contenido", "hueco")])
}

#' Ancho de la columna de rótulos del contraste: el menor desde `w0` en que todos van en una línea, o `w_max`
#'
#' `w_max` es el ancho que deja el área de puntos en su mínimo (3.5 in): la columna nunca pasa de ahí, y con rótulos que
#' no entran en una línea ni así, la columna toma todo ese ancho para partirlos lo menos posible.
#' @keywords internal
.lam_contraste_ancho_rotulos <- function(rotulos, size, w0, w_max) {
  if (w_max <= w0 + 1e-9) return(w_max)
  una_linea <- function(w) all(vapply(rotulos, function(t) length(.lam_rotulo_recortar(t, w, size, 3L)$lineas) == 1L, TRUE))
  for (w in unique(c(seq(w0, w_max, by = 0.1), w_max))) if (una_linea(w)) return(w)
  w_max
}

#' ¿El contraste cabe en una lámina? Hasta 14 filas de pares, o 27 sub-filas con los grupos, con sus rótulos en hasta
#' tres líneas (`.lam_contraste_geom`)
#' @keywords internal
.lam_contraste_cabe <- function(espec) {
  n <- length(espec$rotulos); k <- length(espec$grupos)
  if (n < 1L || k < 2L || k > 4L) return(FALSE)
  filas <- if (identical(espec$modo, "par")) n else n * k + (n - 1L) * 0.7
  if (filas > (if (identical(espec$modo, "par")) 14 else 27)) return(FALSE)   # 27 sub-filas: 0.14 in cada una
  isTRUE(.lam_contraste_geom(espec)$cabe)
}

#' Lámina del contraste de públicos (`contraste/1`)
#'
#' Con dos grupos, una fila por pregunta con el segmento entre los dos puntos y la cifra al costado exterior de
#' cada uno; con tres o más, una sub-fila por grupo dentro de cada pregunta, con su forma, su color y su cifra. La
#' banda alterna va por pregunta; la «Diferencia» y la «Base» de cada grupo, en la tabla de la derecha.
#' @keywords internal
.lam_laminas_contraste <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                   layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  n <- length(espec$rotulos); k <- length(espec$grupos); par <- identical(espec$modo, "par")
  # Letra, columna de rótulos y alto de cada fila (un rótulo de hasta tres líneas agranda su fila): .lam_contraste_geom.
  ge <- .lam_contraste_geom(espec, titulo = titulo, sub = sub)
  if (!isTRUE(ge$cabe)) ge <- .lam_contraste_geom(espec)   # un título de tres líneas: la zona de datos, como antes
  if (!isTRUE(ge$cabe)) stop("El contraste no cabe en una lámina.", call. = FALSE)
  anchos <- ge$anchos; con_base <- length(anchos) > 1L; m <- ge$m
  eje <- espec$eje; px <- function(v) m$xl + (m$xr - m$xl) * (v - eje[["lo"]]) / (eje[["hi"]] - eje[["lo"]])
  # Sin columnas de base la cabecera es una sola línea («Diferencia») y la leyenda baja hasta ella.
  cab <- ge$cab; zona0 <- ge$zona0; zona1 <- ge$zona1
  # Altura de cada pregunta: un paso por fila en pares, k sub-filas y un respiro entre preguntas con grupos, o lo que
  # pida su rótulo si es más.
  pasos <- ge$pasos; u <- ge$u; alturas <- ge$alturas
  .lam_rotulos_aviso(ge$recortados)
  # P13: el bloque (leyenda, cabecera, filas y eje) arranca bajo el título y las filas bajan hacia el pie con el mismo
  # hueco entre ellas; ya no se centra en la zona de datos con aire encima.
  y_ley <- zona0; y0 <- y_ley + cab; y1 <- y0 + sum(alturas)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  # P10 (Gonzalo, 2026-11-09: «todo debería ser transparente»): el área de puntos va sobre el fondo de la lámina, sin
  # panel blanco ni bandas alternas; quedan las guías del eje y los separadores.
  centros <- y0 + cumsum(alturas) - alturas / 2
  .lam_puntos_eje(lz, px, eje, y0, y1)
  # Separadores entre bloques de preguntas (de salida / genéricas): una línea punteada a lo ancho.
  for (s in espec$separadores %||% integer(0)) {
    ys <- y0 + sum(alturas[seq_len(s)])
    .lam_linea(lz, m$ml, ys, m$fin, ys, .std_color("texto_tenue"), pt = 0.9, nombre = "puntos:separador", dash = "dash")
  }
  seg <- .lam_aclarar(.std_color("tenue"), 0.4)
  for (i in seq_len(n)) {
    yc <- centros[i]
    # El cuadro ocupa la fila y centra su texto: hasta tres líneas, la última con «…» si el rótulo no cabe.
    .lam_txt(lz, ge$textos[i], m$ml, yc - alturas[i] / 2, m$wrot, alturas[i], ge$size, azul, align = "right", nombre = "puntos:rotulo",
             anclaje = "ctr")
    v <- espec$valores[i, ]
    if (par) {
      lo <- min(v); hi <- max(v)
      .lam_caja(lz, px(lo), yc - 0.02, max(0.01, px(hi) - px(lo)), 0.04, seg, nombre = "puntos:segmento")
      orden <- order(v)   # el de más abajo a la izquierda
      for (j in rev(seq_len(k))) .lam_marca(lz, espec$formas[j], px(v[j]), yc, 0.15, espec$colores[j], nombre = "puntos:marca")
      jl <- orden[1]; jh <- orden[2]
      # La cifra pegada a su punto, por fuera del segmento (el cuadro de texto ya trae 0.1 in de margen interno).
      .lam_txt(lz, espec$cifras[i, jl], px(v[jl]) - 0.03 - 0.6, .lam_y_centrada(yc, 10), 0.6, 0.25, 10, suave, align = "right", nombre = "puntos:cifra")
      .lam_txt(lz, espec$cifras[i, jh], px(v[jh]) + 0.03, .lam_y_centrada(yc, 10), 0.6, 0.25, 10, suave, nombre = "puntos:cifra")
    } else {
      for (j in seq_len(k)) {
        ys <- yc + (j - (k + 1) / 2) * u
        .lam_caja(lz, px(eje[["lo"]]), ys - 0.012, max(0.01, px(v[j]) - px(eje[["lo"]])), 0.024, .lam_aclarar(espec$colores[j], 0.7), nombre = "puntos:tallo")
        .lam_marca(lz, espec$formas[j], px(v[j]), ys, 0.12, espec$colores[j], nombre = "puntos:marca")
        .lam_txt(lz, espec$cifras[i, j], px(v[j]) - 0.02, .lam_y_centrada(ys, 9.5), 0.6, 0.24, 9.5, azul, nombre = "puntos:cifra")
      }
    }
    .lam_txt(lz, espec$textos_diferencia[i], m$xs[1] - 0.6, .lam_y_centrada(yc, 11.5), 1.2, 0.3, 11.5, azul, bold = TRUE, align = "center", nombre = "puntos:diferencia")
    if (con_base) for (j in seq_len(k)) .lam_txt(lz, espec$bases[i, j], m$xs[j + 1] - anchos[j + 1] / 2, .lam_y_centrada(yc, 10), anchos[j + 1], 0.26, 10, suave,
                                   align = "center", nombre = "puntos:base")
  }
  # Encabezados de la tabla, fuera del área del gráfico: «Base» sobre sus columnas con un filete, y cada grupo debajo.
  yh <- y0 - 0.34
  .lam_txt(lz, espec$encabezado_diferencia %||% "Diferencia", m$xs[1] - 0.6, yh, 1.2, 0.28, 10.5, suave, bold = TRUE, align = "center", nombre = "tabla:encabezado")
  if (con_base) {
  xb0 <- m$xt + anchos[1] + 0.08; xb1 <- m$fin
  .lam_txt(lz, "Base", xb0, yh - 0.36, xb1 - xb0, 0.28, 10.5, azul, bold = TRUE, align = "center", nombre = "tabla:encabezado")
  .lam_caja(lz, xb0, yh - 0.06, xb1 - xb0, 0.01, .std_color("filete"), nombre = "tabla:filete")
  for (j in seq_len(k)) .lam_txt(lz, espec$grupos[j], m$xs[j + 1] - anchos[j + 1] / 2, yh, anchos[j + 1], 0.28, 10.5, suave, bold = TRUE,
                                 align = "center", nombre = "tabla:encabezado")
  }
  # La leyenda lleva la base cuando no va en la tabla («Docentes (n = 115, 93%)»). P13 (Gonzalo, 2026-11-09: «La leyenda
  # debería estar centrada»): una fila centrada en la lámina; si llegara a la tabla, se corre a la izquierda.
  ley <- espec$leyenda %||% espec$grupos
  .lam_puntos_leyenda(lz, .lam_puntos_leyenda_x(ley, .std_geom("ancho") / 2, m$xt - 0.15, m$ml), y_ley, ley, espec$colores, espec$formas)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:contraste")
  # Quién menos quién va en el pie, junto a la base: la columna no tiene ancho para decirlo.
  sentido <- .contraste_sentido_nota(espec)
  # ADR 0135: con regla de preguntas, cómo se eligieron va al final de la nota («Se muestran las 13 de mayor diferencia…»).
  doc <- .lam_pie(doc, .lam_unir_base(espec$nota_base, base, sentido, espec$nota_grupo_chico, espec$texto_regla), folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El panorama cabe? Hasta cinco públicos con sus rótulos en una línea
#' @keywords internal
.lam_panorama_cabe <- function(espec) {
  k <- length(espec$publicos)
  k >= 1L && k <= 5L && all(vapply(espec$publicos, function(t) .lam_ancho_tinta(t, 13, TRUE) <= 3.2, TRUE))
}

#' Lámina del panorama (`panorama/1`)
#'
#' Una fila por público con un punto por pregunta (desplazados en vertical para que no se encimen), la mediana del
#' público como una línea, la referencia punteada (sin rotular ningún «tramo crítico») y, en la tabla de la
#' derecha, la mediana y cuántas preguntas quedan bajo la referencia («16 de 73»).
#' @keywords internal
.lam_laminas_panorama <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                  layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  k <- length(espec$publicos)
  enc_bajo <- espec$encabezado_bajo
  anchos <- c(1.2, .lam_puntos_ancho_col(enc_bajo, espec$textos_bajo, piso = 1.2))
  m <- .lam_puntos_marco(espec$publicos, anchos, size_rot = 13, bold_rot = TRUE)
  eje <- espec$eje; px <- function(v) m$xl + (m$xr - m$xl) * (v - eje[["lo"]]) / (eje[["hi"]] - eje[["lo"]])
  zona0 <- g_("zona_datos_y0") - 0.05; zona1 <- g_("contenido_y1") - 0.35
  h <- min(1.5, (zona1 - zona0 - 0.7) / k)
  y_ley <- zona0 + max(0, (zona1 - zona0 - 0.7) - h * k) / 2; y0 <- y_ley + 0.7; y1 <- y0 + h * k
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  # P10: sin panel blanco ni bandas alternas, sobre el fondo de la lámina.
  .lam_puntos_eje(lz, px, eje, y0, y1)
  ref <- espec$referencia
  if (is.finite(ref)) .lam_linea(lz, px(ref), y0, px(ref), y1, tenue, pt = 1, nombre = "panorama:referencia", dash = "dash")
  for (i in seq_len(k)) {
    yc <- y0 + (i - 0.5) * h
    .lam_txt(lz, espec$publicos[i], m$ml, .lam_y_centrada(yc, 13), m$wrot, 0.32, 13, azul, bold = TRUE, align = "right", nombre = "puntos:rotulo")
    v <- espec$valores[[i]]; dy <- espec$desplazamientos[[i]]
    for (z in seq_along(v)) .lam_marca(lz, espec$formas[i], px(v[z]), yc + dy[z] * h * 0.62, 0.11, espec$colores[i], nombre = "panorama:punto")
    if (is.finite(espec$medianas[i])) .lam_caja(lz, px(espec$medianas[i]) - 0.015, yc - h * 0.36, 0.03, h * 0.72, azul, nombre = "panorama:mediana")
    .lam_txt(lz, espec$textos_mediana[i], m$xs[1] - 0.6, .lam_y_centrada(yc, 13), 1.2, 0.32, 13, azul, bold = TRUE, align = "center", nombre = "puntos:diferencia")
    .lam_txt(lz, espec$textos_bajo[i], m$xs[2] - anchos[2] / 2, .lam_y_centrada(yc, 11), anchos[2], 0.28, 11, suave, align = "center", nombre = "puntos:base")
  }
  yh <- y0 - 0.34
  .lam_txt(lz, "Mediana", m$xs[1] - 0.6, yh, 1.2, 0.28, 10.5, suave, bold = TRUE, align = "center", nombre = "tabla:encabezado")
  .lam_txt(lz, enc_bajo, m$xs[2] - anchos[2] / 2, yh, anchos[2], 0.28, 10.5, suave, bold = TRUE, align = "center", nombre = "tabla:encabezado")
  # Leyenda: la mediana como línea y la referencia punteada.
  x <- m$xl - 0.05; yl <- y_ley + 0.15
  .lam_caja(lz, x, yl - 0.02, 0.4, 0.04, azul, nombre = "leyenda:mediana")
  .lam_txt(lz, "Mediana del público", x + 0.45, y_ley, 2.2, 0.3, 11, azul, nombre = "leyenda:texto")
  x <- x + 0.45 + .lam_ancho_tinta("Mediana del público", 11, FALSE) + 0.6
  if (is.finite(ref)) {
    .lam_linea(lz, x, yl, x + 0.4, yl, tenue, pt = 1, nombre = "leyenda:referencia", dash = "dash")
    .lam_txt(lz, sprintf("Referencia %s%%", format(ref, trim = TRUE)), x + 0.45, y_ley, 2.2, 0.3, 11, azul, nombre = "leyenda:texto")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:panorama")
  nota <- sprintf("Cada marca es una pregunta (%s)", espec$indicador %||% "Top Two Box")
  doc <- .lam_pie(doc, .lam_unir_base(base, nota, espec$texto_regla), folio)   # ADR 0135: la regla, al final
  list(doc = por_lamina(doc), partes = 1L)
}
