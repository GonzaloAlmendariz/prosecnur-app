# =============================================================================
# lamina_divergentes_resumen.R — la escala del resumen ejecutivo (ADR 0134)
# =============================================================================
#
# Variante `estilo = "resumen"` de las barras divergentes (lamina_divergentes.R es la lámina 71 del recetario). Nació
# en el resumen ejecutivo de Formación General de Arte y Diseño 2026 y la validó Gonzalo en varias iteraciones:
#   - desacuerdo a la izquierda de una línea central («En desacuerdo» pegado al centro y «Totalmente en desacuerdo»
#     hacia afuera), acuerdo a la derecha, y «Sin información» en una columna gris separada;
#   - paleta Likert del estándar y leyenda en orden lógico, alineada con cada lado: lo de desacuerdo termina en el
#     centro, lo de acuerdo empieza en él y «Sin información» va sobre su columna;
#   - cifras en texto oscuro. Si la cifra no cabe en el segmento de un EXTREMO, va fuera de la barra, en negrita y
#     con el color del segmento oscurecido; si no cabe en un segmento interior, va adentro con letra más chica. Un
#     segmento en cero no se pinta ni se rotula. No hay totales por lado ni ningún «tramo crítico» rotulado.

#' Color oscurecido de un segmento, para su cifra fuera de la barra
#' @keywords internal
.lam_oscurecer <- function(col, t = 0.32) grDevices::colorRampPalette(c(col, "#000000"))(101)[round(t * 100) + 1L]

#' Filas que admite la escala del resumen en la lámina nativa (ADR 0135: enmienda el tope de 14 del ADR 0134 §5)
#'
#' El resumen de Arte tiene 18 filas en «Preguntas con menos de 60% de acuerdo»; por encima de 20 va al respaldo.
#' @keywords internal
.LAM_DIV_RESUMEN_MAX_FILAS <- 20L

#' Calle entre una cifra que sale de su segmento y el extremo del segmento (P12, Gonzalo 2026-11-09: «además está
#' demasiado alejado de la barra»)
#'
#' El cuadro de texto lleva 0.1 in de margen interior (`.lam_txt`): la cifra queda a `calle` del extremo si el cuadro
#' se monta `0.1 - calle` sobre él.
#' @keywords internal
.LAM_CIFRA_CALLE_IN <- 0.055
.LAM_TXT_MARGEN_IN <- 0.1

#' `x` del cuadro de una cifra que sale por la izquierda (termina en `x_extremo`) o por la derecha (empieza en él)
#' @keywords internal
.lam_cifra_fuera_x <- function(x_extremo, w_caja, lado = c("izq", "der")) {
  lado <- match.arg(lado)
  if (identical(lado, "izq")) x_extremo - .LAM_CIFRA_CALLE_IN + .LAM_TXT_MARGEN_IN - w_caja else x_extremo + .LAM_CIFRA_CALLE_IN - .LAM_TXT_MARGEN_IN
}

#' Geometría de la escala del resumen: letra y columna de las afirmaciones, alto de cada fila y columna «Sin información»
#'
#' ADR 0135 (Arte, 2026-11-07). Como el contraste (`.lam_contraste_geom`): cada afirmación va en hasta tres líneas (dos
#' con más de 14 filas) y su fila crece lo que pide; las demás comparten un paso común, entre 0.2 y 0.52 in. Se prueba la
#' letra de la lámina (12 pt) y se baja de a medio punto hasta el piso (`.LAM_ROTULO_PT_PISO`); con cada letra la
#' columna se ensancha de a 0.1 in hasta 4.2 in sin dejar la escala por debajo de 4.5 in. Gana la primera combinación
#' sin recortes; si ninguna, el piso con la columna más ancha y «…» (el sufijo del público se conserva), bajando a una
#' línea por fila si hace falta.
#' @return Lista con la geometría (`ml`, `fin`, `y0`, `wq`, `xa`, `xb`, `hay_si`, `wsi`), `size`, `u` (paso común),
#'   `alturas`, `g` (alto de la barra), `textos`, `recortados`; `NULL` si las filas no caben.
#' @keywords internal
.lam_div_resumen_geom <- function(espec) {
  g_ <- .std_geom; ml <- g_("margen_izq"); fin <- g_("ancho") - g_("margen_der")
  n <- length(espec$filas); C <- espec$categorias
  y0 <- g_("zona_datos_y0") + 0.45; y1 <- g_("contenido_y1") - 0.05; disponible <- y1 - y0
  hay_si <- any(C$lado == "sin_inf")
  # ADR 0135 §3: la columna del no sustantivo («Sin información») no pasa de 2 in; su leyenda se parte en dos líneas.
  wsi <- if (hay_si) min(2, max(1.5, .lam_ancho_tinta(C$rotulo[C$lado == "sin_inf"][1], 11, FALSE) + 0.45)) else 0
  xb <- fin - wsi - (if (hay_si) 0.45 else 0)
  # P11: la columna toma el ancho libre desde el margen (sin tope fijo); afirmaciones enteras en dos o tres líneas y, si
  # todas no caben, menos filas por la prioridad de la regla antes que cortar texto (lamina_divergentes_resumen_filas.R).
  w_max <- xb - 4.5 - 0.2 - ml
  elegido <- if (n >= 1L) .lam_div_resumen_filas_elegir(espec, disponible, w_max) else NULL
  if (is.null(elegido)) return(NULL)
  c(list(ml = ml, fin = fin, y0 = y0, hay_si = hay_si, wsi = wsi, xa = ml + elegido$wq + 0.2, xb = xb, g = elegido$u * 0.74),
    elegido)
}

#' ¿La escala del resumen cabe? Hasta 20 afirmaciones y una sola columna especial
#'
#' Una afirmación larga no la manda a la imagen (Arte, 2026-11-07): va en las líneas que admite su fila y, si no
#' cabe, la última termina en «…» (`.lam_rotulo_recortar`).
#' @keywords internal
.lam_divergentes_resumen_cabe <- function(espec) {
  n <- length(espec$filas)
  if (n < 1L || n > .LAM_DIV_RESUMEN_MAX_FILAS || sum(espec$categorias$lado == "sin_inf") > 1L) return(FALSE)
  ge <- .lam_div_resumen_geom(espec)
  !is.null(ge) && (ge$xb - ge$xa) >= 4.5 - 1e-6
}

#' Lámina de la escala con «Sin información» aparte (estilo resumen)
#' @keywords internal
.lam_laminas_divergentes_resumen <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                             layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  C <- espec$categorias; U <- espec$unidades; X <- espec$cifras; n <- length(espec$filas)
  ge <- .lam_div_resumen_geom(espec)
  if (is.null(ge)) stop("La escala del resumen no cabe en una lámina.", call. = FALSE)
  # P11: si no caben todas enteras, la lámina muestra las primeras en la prioridad de la regla y su nota lo dice.
  if (length(ge$filas) < n) {
    .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(length(ge$filas), n)))
    espec$texto_regla <- .lam_div_resumen_texto(espec, length(ge$filas))
    espec <- .lam_div_resumen_subset(espec, ge$filas)
    C <- espec$categorias; U <- espec$unidades; X <- espec$cifras; n <- length(espec$filas)
  }
  g <- ge$g; y0 <- ge$y0; alturas <- ge$alturas
  # Cada fila centra su barra en su alto (una afirmación de dos o tres líneas agranda su fila); con filas apretadas
  # (más de 14) las cifras bajan a 10 pt.
  centros <- y0 + cumsum(alturas) - alturas / 2
  pt_cifra <- if (ge$u < 0.3) 10 else 11
  neu <- which(C$lado == "neu"); mitades <- if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else rep(0, n)
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos"); si <- which(C$lado == "sin_inf")
  # La escala se acerca al lado más largo de cada lado y deja 0.5 in a cada extremo para la cifra que sale de la barra.
  izq <- max(rowSums(U[, neg, drop = FALSE]) + mitades, 1); der <- max(rowSums(U[, pos, drop = FALSE]) + mitades, 1)
  px <- (ge$xb - ge$xa - 1.0) / (izq + der); xc <- ge$xa + 0.5 + izq * px
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  # Leyenda alineada con cada lado: el desacuerdo, del extremo al centro, termina en la línea; el acuerdo empieza en ella.
  yl <- y0 - 0.42
  item <- function(k) .lam_ancho_tinta(C$rotulo[k], 11, FALSE) + 0.3
  izq_ley <- rev(neg); x <- xc - 0.1 - sum(vapply(izq_ley, item, 0)) - 0.15 * max(0, length(izq_ley) - 1L)
  # Primero las posiciones; la leyenda se dibuja después para poder correrla entera si pisa la de «Sin información».
  ley <- list()
  for (k in c(izq_ley, if (length(neu)) neu)) { ley[[length(ley) + 1L]] <- c(k = k, x = x); x <- x + item(k) + 0.15 }
  x <- max(x, xc + 0.1)
  for (k in pos) { ley[[length(ley) + 1L]] <- c(k = k, x = x); x <- x + item(k) + 0.15 }
  # ADR 0135 §3: con «Sin información» aparte, la leyenda de la escala termina antes de su columna; si no, se corre
  # entera a la izquierda (sin pasar del margen). Sin desborde queda donde estaba.
  sobra <- if (ge$hay_si) (x - 0.15) - (ge$fin - ge$wsi - 0.2) else 0
  corre <- if (sobra > 0) min(sobra, max(0, ley[[1]][["x"]] - ge$ml)) else 0
  for (it in ley) {
    k <- it[["k"]]; xi <- it[["x"]] - corre
    .lam_caja(lz, xi, yl + 0.075, 0.15, 0.15, C$color[k], nombre = "leyenda:cuadro")
    .lam_txt(lz, C$rotulo[k], xi + 0.12, yl, item(k) + 0.2, 0.3, 11, azul, nombre = "leyenda:texto")
  }
  xsi <- ge$fin - ge$wsi
  if (ge$hay_si) {
    hl <- max(0.3, .lam_alto_tinta(C$rotulo[si[1]], ge$wsi, 11, FALSE))
    .lam_caja(lz, xsi, yl + 0.375 - hl, 0.15, 0.15, C$color[si[1]], nombre = "leyenda:cuadro")
    .lam_txt(lz, C$rotulo[si[1]], xsi + 0.12, yl + 0.3 - hl, ge$wsi, hl, 11, azul, nombre = "leyenda:texto")
  }
  max_si <- if (ge$hay_si) max(1, max(U[, si[1]])) else 1
  for (i in seq_len(n)) {
    yc <- centros[i]; yb <- yc - g / 2
    # El cuadro ocupa la fila y centra su texto: hasta tres líneas (dos con más de 14 filas), la última con «…».
    .lam_txt(lz, ge$textos[i], ge$ml, yc - alturas[i] / 2, ge$wq, alturas[i], ge$size, azul, align = "right", nombre = "divergentes:afirmacion",
             anclaje = "ctr")
    mitad <- mitades[i]
    segs <- list()
    for (k in neu) segs[[length(segs) + 1L]] <- list(k = k, x = xc - mitad * px, w = 2 * mitad * px, lado = "neu")
    off <- mitad; for (k in neg) { segs[[length(segs) + 1L]] <- list(k = k, x = xc - (off + U[i, k]) * px, w = U[i, k] * px, lado = "neg"); off <- off + U[i, k] }
    off <- mitad; for (k in pos) { segs[[length(segs) + 1L]] <- list(k = k, x = xc + off * px, w = U[i, k] * px, lado = "pos"); off <- off + U[i, k] }
    # El extremo de cada lado es su último segmento con valor: ese es el que puede sacar su cifra fuera de la barra.
    ext_neg <- utils::tail(neg[U[i, neg] > 0], 1L); ext_pos <- utils::tail(pos[U[i, pos] > 0], 1L)
    for (sg in segs) {
      if (U[i, sg$k] <= 0) next
      .lam_caja(lz, sg$x - 0.002, yb, sg$w + 0.004, g, C$color[sg$k], nombre = "divergentes:segmento")
      cifra <- X[i, sg$k]
      if (sg$w >= .lam_ancho_tinta(cifra, pt_cifra, FALSE) + 0.1) {
        .lam_txt(lz, cifra, sg$x - 0.2, .lam_y_centrada(yc, pt_cifra), sg$w + 0.4, 0.28, pt_cifra, azul, align = "center", nombre = "divergentes:cifra")
      } else if (identical(sg$k, ext_neg) && identical(sg$lado, "neg")) {
        .lam_txt(lz, cifra, .lam_cifra_fuera_x(sg$x, 0.58, "izq"), .lam_y_centrada(yc, pt_cifra), 0.58, 0.28, pt_cifra, .lam_oscurecer(C$color[sg$k]), bold = TRUE, align = "right",
                 nombre = "divergentes:cifra_fuera")
      } else if (identical(sg$k, ext_pos) && identical(sg$lado, "pos")) {
        .lam_txt(lz, cifra, .lam_cifra_fuera_x(sg$x + sg$w, 0.58, "der"), .lam_y_centrada(yc, pt_cifra), 0.58, 0.28, pt_cifra, .lam_oscurecer(C$color[sg$k]), bold = TRUE,
                 nombre = "divergentes:cifra_fuera")
      } else {
        .lam_txt(lz, cifra, sg$x - 0.25, .lam_y_centrada(yc, 8), sg$w + 0.5, 0.22, 8, azul, align = "center", nombre = "divergentes:cifra_chica")
      }
    }
    if (ge$hay_si && U[i, si[1]] > 0) {
      wbar <- (ge$wsi - 0.05) * U[i, si[1]] / max_si
      .lam_caja(lz, xsi, yb, wbar, g, C$color[si[1]], nombre = "divergentes:sin_inf")
      cabe <- wbar >= .lam_ancho_tinta(X[i, si[1]], pt_cifra, FALSE) + 0.1
      # Centrada con holgura, como las cifras de los segmentos: una caja del ancho justo de la barra partía «3 %».
      .lam_txt(lz, X[i, si[1]], if (cabe) xsi - 0.2 else .lam_cifra_fuera_x(xsi + wbar, 0.6, "der"), .lam_y_centrada(yc, pt_cifra), if (cabe) wbar + 0.4 else 0.6, 0.28, pt_cifra, azul,
               align = if (cabe) "center" else "left", nombre = "divergentes:cifra_sin_inf")
    }
  }
  # La línea central va encima de los segmentos (separa los lados), de la primera a la última fila.
  .lam_caja(lz, xc - 0.008, y0 - 0.04, 0.016, sum(alturas) + 0.08, azul, nombre = "divergentes:centro")
  .lam_rotulos_aviso(ge$recortados, ge$lineas)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:divergentes")
  # ADR 0135: con regla de preguntas, cómo se eligieron va tras la base; sin ella la nota no cambia.
  # ADR 0135 §3: el denominador va tras la base («Porcentaje sobre el total de respondientes.»), como en el mazo de Arte.
  # Un pie que ya dice sobre qué es el porcentaje (escrito por el analista) no se repite.
  nota <- espec$nota_porcentaje
  if (!is.null(nota) && grepl("porcentaje sobre", base %||% "", ignore.case = TRUE)) nota <- NULL
  pie <- if (is.null(espec$texto_regla) && is.null(nota)) base else .lam_unir_base(base, nota, espec$texto_regla)
  # El pie cierra con punto, como el del mazo de Arte («… Ordenado por Top Two Box, de menor a mayor.»).
  if (!is.null(nota) || !is.null(espec$texto_regla)) pie <- .lam_con_punto(pie)
  doc <- .lam_pie(doc, pie, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
