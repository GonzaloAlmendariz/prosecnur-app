# =============================================================================
# lamina_escala.R — el bloque de escala del recetario, dibujado desde la
# especificación (ADR 0093, N1)
# =============================================================================
#
# Porta `barra_apilada()`, `leyenda()`, `geo_likert()`, `alto_bloque()`,
# `etiqueta_ttb()`, `bloque_likert()` y `partir()` de
# `docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R:143-332`. La geometría
# sale de `estandar_pulso.json` y las cifras de `preparar_escala()`: aquí no se
# calcula ningún porcentaje, sólo se ubica lo que la especificación afirma.

# ---- de la especificación a premisas y segmentos -----------------------------

#' Premisas del recetario a partir de la especificación
#'
#' Sin actores, cada fila es una premisa con una sola barra. Con actores
#' (`grupo_id`), la premisa es el grupo y sus filas son las barras de cada actor.
#' Respeta `espec$orden$aplicado`.
#' @keywords internal
.lam_escala_premisas <- function(espec, idx = espec$orden$aplicado) {
  f <- espec$filas
  con_actor <- !all(is.na(f$grupo_id))
  claves <- if (con_actor) f$grupo_id[idx] else as.character(idx)
  out <- list()
  for (k in unique(claves)) {
    ii <- idx[claves == k]
    texto <- if (con_actor) (f$grupo_titulo[ii[1]] %||% f$grupo_id[ii[1]]) else f$rotulo[ii[1]]
    filas <- lapply(ii, function(i) list(i = i, actor = if (con_actor) f$rotulo[i] else "", valid = .espec_casos(f)[i]))
    # Sin actores, una fila marcada con `n_nota` (salto de cuestionario, lo decide quien compone: hoy la multilista)
    # lleva su N bajo la premisa con el rótulo de la ruta anterior, «N = 80». Con actores cada barra ya dice sus
    # respuestas.
    nota <- if (!con_actor && isTRUE(f$n_nota[ii[1]])) .n_barra_texto(.espec_casos(f)[ii[1]]) else NULL
    out[[length(out) + 1L]] <- list(texto = texto, filas = filas, nota = nota)
  }
  out
}

#' Segmentos de una fila, de izquierda a derecha
#' @keywords internal
.lam_escala_seg <- function(espec, i) {
  data.frame(ancho = as.numeric(espec$anchos[i, ]), cifra = as.character(espec$cifras[i, ]),
             color = espec$categorias$color, dibujar = as.logical(espec$dibujar[i, ]), stringsAsFactors = FALSE)
}

# ---- barra apilada y leyenda (recetario.R:143-180) ---------------------------

.lam_tiene_peq <- function(seg, w) any(seg$dibujar & w * seg$ancho < .lam_ancho_txt(seg$cifra, .std_pt("cifra"), TRUE) + 0.12)

#' Barra apilada al 100 %: cifra dentro si cabe a 14 pt; si no, encima con guía
#' @keywords internal
.lam_barra_apilada <- function(lz, x, y, w, seg, h) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  xx <- x; peq <- list(); n <- nrow(seg)
  for (k in seq_len(n)) {
    ws <- if (isTRUE(seg$dibujar[k])) w * seg$ancho[k] else 0
    if (ws > 0.004) .lam_caja(lz, xx, y, ws + (if (k < n) 0.004 else 0), h, seg$color[k], nombre = "segmento")
    if (ws > 0 && ws >= .lam_ancho_txt(seg$cifra[k], .std_pt("cifra"), TRUE) + 0.12) {
      wl <- max(ws, 0.7)
      .lam_txt(lz, seg$cifra[k], xx + ws / 2 - wl / 2, y + (h - 0.3) / 2, wl, 0.3, .std_pt("cifra"),
               .lam_texto_sobre(seg$color[k]), bold = TRUE, align = "center", nombre = "cifra")
    } else if (ws > 0) {
      peq[[length(peq) + 1L]] <- list(c = xx + ws / 2, v = seg$cifra[k])
    }
    xx <- xx + ws
  }
  if (length(peq)) {
    cs <- vapply(peq, `[[`, 0, "c")   # CCSS-14: si la de siempre cruza codos, sin solaparse (lamina_callouts_sin_solape.R)
    pos <- .lam_callouts_escala(cs, vapply(peq, `[[`, "", "v"), x, w)
    # N9: la caja de la cifra sube 0,28 in sobre el borde de la fila (antes 0,32): queda >= 0,075 in bajo la barra de la
    # fila de arriba (antes 0,04) con la misma fila (`aire_cifra_chica`) y la misma separación entre cifras.
    # N9b: la caja mide 0,22 in y acaba a la altura de la base del glifo (el texto lleva 0,05 in de margen superior y
    # desborda sin recorte); la guía (0,03 in) y su codo (a 0,04 in) quedan a 0,02 in por debajo de ella: ya no tocan el número.
    for (k in seq_along(peq)) {
      .lam_callout_guia(lz, cs[k], pos[k], y, 0.03, y - 0.04, identical(attr(pos, "reparto"), "nuevo"), tenue)   # CCSS-14
      .lam_txt(lz, peq[[k]]$v, pos[k] - 0.32, y - 0.28, 0.64, 0.22, .std_pt("cifra_fuera"), azul, bold = TRUE,
               align = "center", nombre = "cifra_fuera")
    }
  }
  invisible(lz)
}

#' Leyenda centrada en un bloque; junta los ítems si no cabe y nunca sale del margen
#'
#' El reparto lo decide `.lam_leyenda_plan()` (leyenda_plan.R, O8b) con el modo de Identidad › Letra. En la automática,
#' una fila centrada en `centrar_en` que aprieta su espacio hasta 0,15 in y, si así no cabe centrada, se corre dentro del
#' margen (lo de siempre); sólo si no cabe en el ancho de la lámina pasa a filas equilibradas. Con más de una fila, el
#' bloque sube lo necesario para no pisar la base.
#' @keywords internal
.lam_leyenda <- function(lz, y, labels, cols, centrar_en) {
  g <- .std_geom
  ml <- g("margen_izq"); fin <- g("ancho") - g("margen_der")
  disp <- 2 * min(centrar_en - ml, fin - centrar_en)
  modo <- .std_leyenda_modo()
  plan <- .lam_leyenda_plan(labels, if (identical(modo, "automatica")) disp else fin - ml, modo = modo)
  if (identical(modo, "automatica") && length(plan$filas) > 1L) {
    entera <- .lam_leyenda_plan(labels, fin - ml, modo = modo)   # cabe en una fila corrida dentro del margen
    if (length(entera$filas) == 1L) { plan <- entera; plan$gaps <- 0.15; plan$totales <- sum(plan$items) + 0.15 * (length(labels) - 1L) }
  }
  .leyenda_avisar(plan)
  k <- length(plan$filas)
  if (k > 1L) y <- min(y, g("base_y") - 0.02 - 0.3 * k)
  for (r in seq_len(k)) {
    idx <- plan$filas[[r]]
    x <- .leyenda_x_fila(plan$totales[r], centrar_en, ml, fin)
    for (i in idx) {
      .lam_caja(lz, x, y + 0.07, 0.15, 0.15, cols[i], nombre = "leyenda:cuadro")
      .lam_txt(lz, labels[i], x + 0.12, y, plan$anchos[i] + 0.3, 0.3, plan$size, .std_color("azul"), nombre = "leyenda:texto")
      x <- x + plan$items[i] + plan$gaps[r]
    }
    y <- y + 0.3
  }
  invisible(lz)
}

# ---- geometría del bloque (recetario.R:224-236) ------------------------------

.lam_escala_sin_actor <- function(premisas) all(vapply(premisas, function(p) all(vapply(p$filas, function(f) !nzchar(f$actor), TRUE)), TRUE))
.lam_escala_ancho_prem <- function(premisas) {
  L <- .std_geom("likert")
  (if (.lam_escala_sin_actor(premisas)) L$x_barra - L$x_premisa - 0.25 else L$ancho_premisa) + .std_enunciado_extra_in()   # N10
}
#' Alto del texto de una premisa, con la línea de su N si la lleva
#' @keywords internal
.lam_premisa_alto <- function(p, wp) .lam_alto_txt(p$texto, wp, .std_pt("pregunta"), TRUE) + (if (is.null(p$nota)) 0 else 0.26)
.lam_escala_geo <- function(premisas, wp, nb = NULL) {
  # `nb`: filas de la lámina entera cuando varios bloques la comparten (multilista); el grosor es por lámina.
  nb <- nb %||% sum(vapply(premisas, function(p) length(p$filas), 0))
  g <- .std_grosor(nb, "escala_apilada"); fila <- g + 0.24
  multi <- any(vapply(premisas, function(p) length(p$filas) > 1, TRUE))
  manda <- any(vapply(premisas, function(p) .lam_premisa_alto(p, wp) > length(p$filas) * fila, TRUE))
  list(g = g, fila = fila, gap = if (multi || manda) 0.26 else 0.08)
}
#' Alto que ocupa un bloque de premisas
#' @keywords internal
.lam_escala_alto <- function(premisas, nb = NULL) {
  wp <- .lam_escala_ancho_prem(premisas); geo <- .lam_escala_geo(premisas, wp, nb)
  sum(vapply(premisas, function(p) max(.lam_premisa_alto(p, wp), length(p$filas) * geo$fila), 0)) +
    geo$gap * (length(premisas) - 1)
}
#' Barras de un juego de premisas (o de bloques de la multilista, que traen las suyas en `$premisas`)
#' @keywords internal
.lam_escala_n_barras <- function(x) sum(vapply(x, function(p) if (!is.null(p$filas)) length(p$filas) else .lam_escala_n_barras(p$premisas %||% list()), 0))
.lam_escala_alto_util <- function() (.std_geom("zona_datos_y1") - 0.15) - (.std_geom("zona_datos_y0") + 0.1)

#' Partición en «(cont.)» (recetario.R:319-332)
#'
#' Si el bloque no cabe al grosor del estándar, se parte; la letra no encoge.
#' Primero el mínimo de láminas y luego el corte que equilibra los altos. Las
#' premisas son atómicas: un bloque de actores nunca se separa. No recalcula ni
#' reordena.
#' @return Lista de grupos de premisas, uno por lámina.
#' @keywords internal
.lam_escala_partir <- function(premisas, disponible = .lam_escala_alto_util(), alto_fn = .lam_escala_alto, aire_min_fn = NULL) {
  n <- length(premisas)
  if (n <= 1L || alto_fn(premisas) <= disponible) return(list(premisas))
  # M1 con piso (lamina_escala_aire.R): hasta seis barras caben en una lámina si, con la barra del piso y el aire mínimo
  # (separación entre premisas >= 0,12 in y cifra chica a >= 0,075 in de la barra de arriba), entran en la franja.
  if (!is.null(aire_min_fn) && .std_evitar_cont() && .lam_escala_n_barras(premisas) <= .MULTIAPILADAS_MAX_BARRAS &&
      aire_min_fn(premisas) <= disponible) return(list(premisas))
  # M1: seis barras caben en una lámina (Gonzalo, 2026-10-14). Si se pasan por poco —el aire entre temas de dos o tres
  # públicos—, el bloque se compacta lo justo al dibujarse en vez de partirse en «(cont.)».
  # N1: con piso de grosor declarado no hay tolerancia: la lámina se parte en vez de apretar la barra por debajo del piso.
  if (.std_piso_escala_in() <= 0 && .lam_escala_n_barras(premisas) <= .MULTIAPILADAS_MAX_BARRAS && alto_fn(premisas) <= 1.15 * disponible) return(list(premisas))
  comprime <- !is.null(aire_min_fn) && .std_evitar_cont()   # M1: cada parte de hasta seis barras puede componerse con el aire mínimo
  cabe_parte <- function(pp) alto_fn(pp) <= disponible ||
    (comprime && .lam_escala_n_barras(pp) <= .MULTIAPILADAS_MAX_BARRAS && aire_min_fn(pp) <= disponible)
  cabe <- function(ix) all(vapply(split(premisas, ix), cabe_parte, TRUE))
  for (k in 2:n) {
    mejor <- NULL; mejor_v <- Inf
    for (cs in utils::combn(n - 1, k - 1, simplify = FALSE)) {
      ix <- findInterval(seq_len(n), cs + 1) + 1
      if (!cabe(ix)) next
      altos <- vapply(split(premisas, ix), alto_fn, 0)
      if (max(altos) - min(altos) < mejor_v) { mejor_v <- max(altos) - min(altos); mejor <- ix }
    }
    if (!is.null(mejor)) return(unname(split(premisas, mejor)))
  }
  lapply(premisas, list)
}

# ---- el bloque (recetario.R:238-317) ----------------------------------------

# Umbral de base chica del estándar (`reglas$base_chica` de estandar_pulso.json: «con menos de 30 casos, todas las
# filas del bloque dicen "x de y"», D12).
.LAM_BASE_CHICA_N <- 30

#' ¿La especificación tiene base chica? Una sola respuesta para la lámina entera, en filas o en bloque
#'
#' Se mira la especificación ENTERA, no la parte de una partición: si una fila tiene menos de 30 casos, todas las
#' filas de todas sus láminas («(cont.)» incluida) dicen «x de y». Una fila sin casos (n = 0 o `NA`) no cuenta: no
#' tiene base que señalar.
#' El umbral se mira sobre CASOS sin ponderar (`filas$n_casos`, contrato base-sin-ponderar F6): 20 personas con peso
#' 2.25 suman 45 y siguen siendo 20 personas, base chica; 40 con peso 0.5 suman 20 y no lo son.
#' @keywords internal
.lam_base_chica <- function(espec) {
  # El ajuste «Casos junto al porcentaje» del informe decide (graficos_casos_junto.R); el umbral por defecto sigue siendo
  # `.LAM_BASE_CHICA_N`.
  .casos_junto_muestra(.espec_casos(espec$filas), espec$casos_junto)
}

#' «x de y» de una fila, o `NULL` si la fila no tiene base o casos que decir (nunca «NA de NA»)
#' @keywords internal
.lam_casos_texto <- function(caja, espec, i) {
  x <- suppressWarnings(as.numeric(caja$casos[i])); y <- suppressWarnings(as.numeric(.espec_casos(espec$filas)[i]))
  if (!length(x) || !length(y) || !is.finite(x) || !is.finite(y) || y <= 0) return(NULL)
  sprintf("%d de %d", as.integer(round(x)), as.integer(round(y)))
}

.lam_etiqueta_box <- function(lz, espec, x, yb, g, i, con_n, caja = espec$box, color = .std_color("verde_top_two_box"),
                              w = 1.5, prefijo = "box") {
  casos <- if (isTRUE(con_n)) .lam_casos_texto(caja, espec, i) else NULL
  .lam_txt(lz, caja$cifras[i], x, yb + (g - 0.32) / 2 - (if (!is.null(casos)) 0.1 else 0), w, 0.32, .std_pt("cifra"), color,
           bold = TRUE, align = "center", nombre = paste0(prefijo, ":cifra"))
  if (!is.null(casos)) .lam_txt(lz, casos, x, yb + g / 2 + 0.06, w, 0.24, .std_pt("n"), .std_color("texto_tenue"), align = "center",
                                nombre = paste0(prefijo, ":casos"))
}

#' Columnas de los box en el bloque de premisas: dónde va cada una y cuánto mide la barra
#'
#' Sin Bottom Two Box, la Top Two Box ocupa la columna de 1.5 in en `x_top_two_box` (láminas 216, 221). Con ella,
#' la Bottom Two Box toma esa columna y la Top Two Box se corre a su izquierda el paso de columna de la lámina 97
#' del recetario (1.25 in, el mismo de `.lam_filas_box`); la barra cede ese ancho y nada más: la premisa, la
#' partición y el alto de las filas no cambian (F-d, lámina 24 de acrconta_mazo).
#' @return Lista con `ancho_barra`, `ancho_col` y `cols` (cada una con `caja`, `color`, `x`, `prefijo`, `rotulo`).
#' @keywords internal
.lam_escala_columnas_box <- function(espec, extra = 0) {
  L <- .std_geom("likert")
  ttb <- !is.null(espec$box$unidades); btb <- ttb && !is.null(espec$box2$unidades)
  paso <- if (btb) 1.25 else 0; wcol <- if (btb) 1.25 else 1.5
  centro <- function(dx) L$x_top_two_box + 0.75 - dx   # el centro de la columna de 1.5 in del estándar
  cols <- list()
  if (ttb) cols[[1]] <- list(caja = espec$box, color = .std_color("verde_top_two_box"), x = centro(paso) - wcol / 2,
                             prefijo = "box", rotulo = espec$box$rotulo %||% .PPT_ROTULO_TOP_TWO_BOX)
  if (btb) cols[[2]] <- list(caja = espec$box2, color = .std_color("naranja_bottom_two_box_texto"), x = centro(0) - wcol / 2,
                             prefijo = "box2", rotulo = espec$box2$rotulo %||% "Bottom Two Box")
  list(ancho_barra = L$ancho_barra - paso - extra, ancho_col = wcol, cols = cols)
}

#' Dibuja un bloque de escala en el lienzo
#'
#' @param solo `TRUE` si el bloque es la lámina entera (sin partición): con una
#'   sola premisa y un solo público, la afirmación encabeza y la barra ocupa el
#'   ancho, como la lámina 216 del recetario. Con Bottom Two Box no: va en el bloque de premisas (221/222).
#' @param y0,y1 Franja vertical del bloque; por defecto, la zona de datos de la lámina.
#' @param leyenda `FALSE` cuando la leyenda la dibuja quien compone (una compartida por varios bloques).
#' @param estirar Factor fijo de aire por fila que decide quien compone varios bloques (multilista); con él el
#'   bloque empieza en `y0` sin centrarse. `NULL`: el bloque reparte su propio alto, como siempre.
#' @param nb Filas de la lámina entera para el grosor (multilista); `NULL`: las del bloque.
#' @param aire,grosor Aire extra por fila y grosor de barra decididos una vez por lámina por quien compone varios
#'   bloques (multilista), para que todos salgan iguales. `NULL`: el bloque aplica la regla de cifras chicas por su
#'   cuenta, como siempre.
#' @param rotulo_sobre Distancia del rótulo «Top Two Box» sobre la franja; la multilista lo acerca para caer en la
#'   p144 del recetario. `NULL`: 0.45, la de siempre.
#' @return Invisible, la `y` donde termina el bloque (sin la leyenda).
#' @keywords internal
.lam_bloque_escala <- function(lz, espec, premisas, solo = TRUE, y0 = NULL, y1 = NULL, leyenda = TRUE,
                               estirar = NULL, nb = NULL, aire = NULL, grosor = NULL, rotulo_sobre = NULL, titulo_lamina = NULL,
                               encabezar_tema = FALSE) {
  g_ <- .std_geom; L <- g_("likert"); azul <- .std_color("azul"); verde <- .std_color("verde_top_two_box")
  W <- g_("ancho"); MR <- g_("margen_der"); ML <- g_("margen_izq")
  Y_DATOS <- g_("zona_datos_y0"); Y_LEY <- g_("leyenda_y"); Y_BASE <- g_("base_y")
  ttb_col <- !is.null(espec$box$unidades)
  # N10: el enunciado gana `ex` in a costa de la barra: públicos y barra se corren a la derecha; la Top Two Box queda donde está.
  ex <- .std_enunciado_extra_in(); L$x_actor <- L$x_actor + ex; L$x_barra <- L$x_barra + ex; L$ancho_barra <- L$ancho_barra - ex
  cb <- .lam_escala_columnas_box(espec, ex); wcol <- cb$ancho_col; dx_btb <- L$ancho_barra - cb$ancho_barra
  ley <- espec$leyenda; labels <- espec$categorias$rotulo[ley]; cols <- espec$categorias$color[ley]
  respuestas <- function(n) paste(format(as.integer(n), big.mark = ","), "respuestas")
  con_n <- isTRUE(espec$mostrar_respuestas)   # M10 / N3b: «Respuestas por público»; apagado por defecto, switcher opcional por gráfico
  y0 <- y0 %||% (Y_DATOS + 0.1); y1 <- y1 %||% (Y_LEY - 0.15)

  # Con Bottom Two Box la afirmación sola no encabeza: si es corta va en filas (lámina 97, `.lam_escala_modo_filas`) y
  # si es larga, en el bloque de premisas (láminas 221/222), como la batería (decisión «2c»).
  if (isTRUE(solo) && length(premisas) == 1L && length(premisas[[1]]$filas) == 1L && is.null(espec$box2$unidades)) {
    p <- premisas[[1]]; fl <- p$filas[[1]]; g <- 0.72
    wt <- W - ML - MR - 0.4; ht <- .lam_alto_txt(p$texto, wt, 20, TRUE)
    alto_grupo <- ht + 1.15 + g + 1.0
    yt <- Y_DATOS + max(0.3, (Y_BASE - 0.2 - Y_DATOS - alto_grupo) / 2)
    .lam_txt(lz, p$texto, L$x_premisa, yt, wt, ht, 20, azul, bold = TRUE, nombre = "pregunta")
    yb <- yt + ht + 1.15; xb <- L$x_premisa + 1.75; wb <- L$x_top_two_box - dx_btb - xb - 0.25
    if (nzchar(fl$actor)) .lam_txt(lz, fl$actor, L$x_premisa, yb + g / 2 - (if (con_n) 0.18 else 0.15), 1.6, 0.3, .std_pt("actor"), azul, bold = TRUE, nombre = "actor")
    if (con_n) .lam_txt(lz, respuestas(fl$valid), L$x_premisa, yb + g / 2 + 0.08, 1.7, 0.26, .std_pt("n"), .std_color("texto_tenue"), nombre = "respuestas")
    .lam_barra_apilada(lz, xb, yb, wb, .lam_escala_seg(espec, fl$i), g)
    for (cc in cb$cols) {
      .lam_txt(lz, cc$rotulo, cc$x - 0.1, yb - 0.45, wcol + 0.1, 0.26, .std_pt("rotulo_top_two_box"), cc$color, bold = TRUE, align = "center",
               nombre = paste0(cc$prefijo, ":rotulo"))
      .lam_txt(lz, cc$caja$cifras[fl$i], cc$x - 0.1, yb + g / 2 - 0.3, wcol + 0.1, 0.6, 28, cc$color, bold = TRUE, align = "center",
               nombre = paste0(cc$prefijo, ":cifra"))
    }
    .lam_leyenda(lz, yb + g + 0.55, labels, cols, centrar_en = xb + wb / 2)
    return(invisible(yb + g))
  }

  # La especificación entera, no la parte (estándar `base_chica`). El «x de y» lo gobierna el mismo interruptor que «N respuestas»
  # (`mostrar_respuestas`, N3b+): apagado no se dibuja; la regla sigue en `.lam_base_chica` y el pie «Base: N» no cambia.
  hay_chica <- con_n && .lam_base_chica(espec)
  wp <- .lam_escala_ancho_prem(premisas); geo <- .lam_escala_geo(premisas, wp, nb)
  g <- geo$g; fila <- geo$fila; gap <- geo$gap
  extra_gap <- rep(0, max(0L, length(premisas) - 1L))   # M1: aire extra por separación (donde una cifra chica pide más); 0 = el gap uniforme de siempre
  WB <- if (ttb_col) cb$ancho_barra else W - MR - L$x_barra - 0.3
  altos_de <- function() vapply(premisas, function(p) max(.lam_premisa_alto(p, wp), length(p$filas) * fila), 0)
  altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1) + sum(extra_gap)
  disp <- y1 - y0 - (if (isTRUE(leyenda)) 0.7 else 0)
  # M1 con piso: el aire mínimo al que puede ceder la lámina sin bajar la barra del piso (lamina_escala_aire.R)
  aire_mn <- function() .lam_aire_minimo(vapply(premisas, function(p) .lam_premisa_alto(p, wp), 0), vapply(premisas, function(p) length(p$filas), 0), g,
                                         chica = vapply(premisas, function(p) any(vapply(p$filas, function(fl) .lam_tiene_peq(.lam_escala_seg(espec, fl$i), WB), TRUE)), TRUE))
  if (!is.null(estirar)) {   # el aire lo reparte quien compone varios bloques: el mismo factor en todos
    fila <- fila * estirar; gap <- gap * estirar
    if (estirar < 1 && .std_evitar_cont()) { mn <- aire_mn(); fila <- max(mn$fila, fila); gap <- max(mn$gap, gap); extra_gap <- pmax(0, mn$gaps - gap) }   # M1: la multilista comprime
    altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1) + sum(extra_gap)
  } else if (tot < 0.88 * disp) {   # pocas filas: se reparte el alto, el grosor no cambia
    f_ <- min(2.0, 0.93 * disp / tot); fila <- fila * f_; gap <- gap * f_
    altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1) + sum(extra_gap)
  } else if (tot > disp) {   # M1: hasta seis barras se compactan para caber en vez de partirse (`.lam_escala_partir`)
    f_ <- disp / tot
    if (.std_evitar_cont()) {   # M1 con piso: cede el aire hasta su mínimo (lamina_escala_aire.R); la barra no baja del piso
      mn <- aire_mn()
      fila <- max(mn$fila, fila * f_); gap <- max(mn$gap, gap * f_); extra_gap <- pmax(0, mn$gaps - gap)
    } else {
      fila <- fila * f_; gap <- gap * f_
    }
    altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1) + sum(extra_gap)
  }
  nb <- sum(vapply(premisas, function(p) length(p$filas), 0)); extra <- max(0, 0.34 - (fila - g))
  if (!is.null(aire)) {   # lo decidió la lámina (multilista)
    if (aire > 0) { fila <- fila + aire; altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1) + sum(extra_gap) }
  } else if (extra > 0 && tot + nb * extra <= disp + (if (is.null(estirar)) 0.3 else 0)) {   # aire para las cifras chicas, sólo si cabe
    fila <- fila + extra; altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1) + sum(extra_gap)
  }
  if (!is.null(grosor)) {
    g <- grosor
  } else {
    peq <- any(vapply(premisas, function(p) any(vapply(p$filas, function(fl) .lam_tiene_peq(.lam_escala_seg(espec, fl$i), WB), TRUE)), TRUE))
    if (peq && fila - g < 0.36) g <- max(0.24, fila - 0.36, .std_piso_escala_in())   # N1: la cifra chica no adelgaza por debajo del piso
  }
  y <- if (is.null(estirar)) y0 + max(0, (y1 - y0 - tot - 0.5) / 2) else y0
  # Con dos columnas el rótulo se ensancha 0.1 in a cada lado, como en `.lam_filas_box`: «Bottom Two Box» no se parte.
  hr <- if (length(cb$cols) > 1L) 0.1 else 0
  for (cc in cb$cols) .lam_txt(lz, cc$rotulo, cc$x - hr, y - (rotulo_sobre %||% 0.45), wcol + 2 * hr, 0.26, .std_pt("rotulo_top_two_box"), cc$color,
                               bold = TRUE, align = "center", nombre = paste0(cc$prefijo, ":rotulo"))
  ytop <- y
  # El filete separa los bloques de actores de cada tema; con un solo público cada premisa es una barra y la línea
  # sólo corta la lectura (Gonzalo, 2026-10-14: «en el caso que todas las barras sean de un público es mejor no
  # agregar líneas grises dividiéndolas»).
  con_filete <- !.lam_escala_sin_actor(premisas)
  # N2 (Renzo, 2026-10-22): `filete_temas` gobierna sólo la línea entre temas (N2b: apagada por defecto, TRUE la dibuja); el filete bajo el Total es otro.
  filete_temas <- isTRUE(espec$filete_temas)   # N2b: sin línea entre temas salvo TRUE explícito
  # Un solo tema con varios públicos (Gonzalo, 2026-10-14): el tema va arriba como encabezado y no le quita a los públicos
  # la columna de la izquierda; sus rótulos usan todo el ancho hasta la barra y un nombre largo («Estudiantes 2018») ya
  # no se parte sobre sus respuestas. Si el tema repite el título de la lámina, no se escribe.
  un_tema <- isTRUE(encabezar_tema) && length(premisas) == 1L && con_filete
  x_act <- if (un_tema) L$x_premisa else L$x_actor
  w_act <- L$ancho_actor; x_bar <- L$x_barra
  if (un_tema) {
    # La barra arranca donde empezaba la columna del tema, tras el rótulo más ancho de los públicos (Gonzalo,
    # 2026-10-14: «que el eje empiece antes, donde antes empezaba el tema, para que esa columna no se vea vacía»).
    actores <- vapply(premisas[[1]]$filas, function(fl) fl$actor, "")
    w_act <- max(1.3, max(.lam_ancho_tinta(actores, .std_pt("actor"), TRUE), 0) + 0.35)   # 0.2 in de márgenes internos de la caja
    x_bar <- L$x_premisa + w_act + 0.2
    WB <- WB + (L$x_barra - x_bar)
  }
  for (i in seq_along(premisas)) {
    p <- premisas[[i]]; a <- altos[i]; hp <- .lam_alto_txt(p$texto, wp, .std_pt("pregunta"), TRUE); hn <- .lam_premisa_alto(p, wp)
    if (i > 1 && con_filete && filete_temas) .lam_caja(lz, ML, y - gap / 2, W - ML - MR, 0.008, .std_color("filete"), nombre = "filete")
    if (un_tema) {
      if (nzchar(p$texto %||% "") && !identical(trimws(p$texto), trimws(titulo_lamina %||% "")))
        .lam_txt(lz, p$texto, L$x_premisa, y - (rotulo_sobre %||% 0.45), L$x_top_two_box - L$x_premisa - 0.2, 0.3, .std_pt("pregunta"), azul,
                 bold = TRUE, nombre = "premisa")
    } else {
      .lam_txt(lz, p$texto, L$x_premisa, y + (a - hn) / 2, wp, hp, .std_pt("pregunta"), azul, bold = TRUE, nombre = "premisa")
      if (!is.null(p$nota)) .lam_txt(lz, p$nota, L$x_premisa, y + (a - hn) / 2 + hp - 0.04, wp, 0.26, .std_pt("n"), .std_color("texto_tenue"),
                                     nombre = "premisa:n")
    }
    yf <- y + (a - length(p$filas) * fila) / 2
    for (fl in p$filas) {
      yb <- yf + (fila - g) / 2 + 0.06
      if (nzchar(fl$actor)) {
        # Un rótulo que no cabe en una línea sube lo que mide su segunda línea: si no, se montaba sobre «N respuestas».
        cabe <- .lam_ancho_tinta(fl$actor, .std_pt("actor"), TRUE) <= w_act - 0.2
        lin <- if (cabe) 1L else .lam_lineas_tinta(fl$actor, w_act, .std_pt("actor"), TRUE)
        dy <- if (lin > 1) (lin - 1) * .std_pt("actor") * 1.2 / 72 else 0
        # N3b: sin la línea «N respuestas» el nombre se centra con la barra (con ella, sube para hacerle sitio).
        y_act <- if (con_n) yb + g / 2 - 0.25 - dy else yb + g / 2 - 0.15 - dy / 2
        .lam_txt(lz, fl$actor, x_act, y_act, w_act, 0.3 + dy, .std_pt("actor"), azul, bold = TRUE, align = "right", nombre = "actor")
        if (con_n) .lam_txt(lz, respuestas(fl$valid), x_act - 0.4, yb + g / 2, w_act + 0.4, 0.26, .std_pt("n"), .std_color("texto_tenue"),
                            align = "right", nombre = "respuestas")
      }
      .lam_barra_apilada(lz, x_bar, yb, WB, .lam_escala_seg(espec, fl$i), g)
      for (cc in cb$cols) .lam_etiqueta_box(lz, espec, cc$x, yb, g, fl$i, con_n = hay_chica, caja = cc$caja, color = cc$color,
                                            w = wcol, prefijo = cc$prefijo)
      yf <- yf + fila
    }
    y <- y + a + gap + (if (i <= length(extra_gap)) extra_gap[i] else 0)
  }
  fin_bloque <- if (ttb_col) L$x_top_two_box + 0.75 else x_bar + WB
  if (isTRUE(leyenda)) .lam_leyenda(lz, min(Y_LEY, ytop + tot + 0.3), labels, cols, centrar_en = .std_geom("ancho") / 2)   # el usuario: la leyenda va centrada a todo el placeholder (la lámina), no a las barras
  invisible(structure(ytop + tot, centro_barras = x_bar + WB / 2))   # N16: la multilista centra su leyenda compartida con este eje
}

# ---- filas con Total y Bottom Two Box (recetario: propuestas_rescatables.R:23-47, lámina 77) ----------

#' Bloque de filas con la fila Total separada y las columnas Top Two Box y Bottom Two Box
#'
#' Una pregunta (opcional) encabeza; las cabeceras de las columnas van encima de las cifras; cada fila lleva
#' su rótulo a la derecha, la barra y las cifras de los box. La fila Total va primera, con un filete bajo su
#' barra y 0.22 in de aire. Grosor de la tabla estándar y aire para las cifras chicas.
#' @keywords internal
.lam_filas_box <- function(lz, espec, filas, x, y, w, pregunta = NULL, wlab = 1.8, g = NULL, fila = NULL) {
  azul <- .std_color("azul"); verde <- .std_color("verde_top_two_box")
  naranja <- .std_color("naranja_bottom_two_box_texto")
  cols <- Filter(Negate(is.null), list(
    if (!is.null(espec$box$unidades)) list(b = espec$box, color = verde),
    if (!is.null(espec$box2$unidades)) list(b = espec$box2, color = naranja)))
  wcol <- 1.25; ncol <- length(cols)
  xb <- x + wlab + 0.12; wb <- w - wlab - 0.12 - ncol * wcol - (if (ncol) 0.15 else 0)
  g <- g %||% .std_grosor(length(filas), "escala_apilada")
  chica <- any(vapply(filas, function(i) .lam_tiene_peq(.lam_escala_seg(espec, i), wb), TRUE))
  fila <- max(fila %||% 0, g + (if (chica) .std_geom("aire_cifra_chica") else 0.2))
  # La especificación entera: todas las filas dicen «x de y» (estándar `base_chica`), sólo con `mostrar_respuestas` encendido (N3b+).
  base_chica <- isTRUE(espec$mostrar_respuestas) && .lam_base_chica(espec)
  con_respuestas <- isTRUE(espec$filas_respuestas) && isTRUE(espec$mostrar_respuestas)
  yh <- y
  if (!is.null(pregunta) && nzchar(pregunta)) {
    # La caja crece con las líneas de la pregunta; la letra no encoge.
    .lam_txt(lz, pregunta, x - 0.1, y, w, .lam_filas_pregunta_caja(pregunta, w), .std_pt("pregunta"), azul, bold = TRUE, nombre = "pregunta")
    yh <- y + .lam_filas_pregunta_alto(pregunta, w)
  }
  for (k in seq_along(cols)) {
    xc <- xb + wb + 0.1 + (k - 1) * wcol
    .lam_txt(lz, cols[[k]]$b$rotulo, xc - 0.1, yh, wcol + 0.2, 0.26, .std_pt("rotulo_top_two_box"), cols[[k]]$color,
             bold = TRUE, align = "center", nombre = if (k == 1) "box:rotulo" else "box2:rotulo")
  }
  yy <- yh + 0.3
  for (i in filas) {
    es_tot <- isTRUE(espec$filas$es_total[i])
    paso <- .lam_filas_paso(espec, i, fila, wlab); yb <- yy + (paso - g) / 2
    lab <- espec$filas$rotulo[i]; hl <- .lam_alto_txt(lab, wlab, .std_pt("actor"), TRUE)
    if (con_respuestas) {   # el público y sus respuestas, como junto a la barra de la lámina 216
      .lam_txt(lz, lab, x, yb + g / 2 - 0.25, wlab, 0.3, .std_pt("actor"), azul, bold = TRUE, align = "right", nombre = "actor")
      .lam_txt(lz, paste(format(as.integer(.espec_casos(espec$filas)[i]), big.mark = ","), "respuestas"), x, yb + g / 2, wlab, 0.26, .std_pt("n"),
               .std_color("texto_tenue"), align = "right", nombre = "respuestas")
    } else {
      .lam_txt(lz, lab, x, yb + (g - hl) / 2, wlab, hl, .std_pt("actor"), azul, bold = TRUE, align = "right", nombre = "actor")
    }
    .lam_barra_apilada(lz, xb, yb, wb, .lam_escala_seg(espec, i), g)
    for (k in seq_along(cols)) {
      xc <- xb + wb + 0.1 + (k - 1) * wcol
      if (base_chica) {   # la misma etiqueta que el bloque, en la columna de 1.25 in
        .lam_etiqueta_box(lz, espec, xc, yb, g, i, con_n = TRUE, caja = cols[[k]]$b, color = cols[[k]]$color, w = wcol,
                          prefijo = if (k == 1) "box" else "box2")
      } else {
        .lam_txt(lz, cols[[k]]$b$cifras[i], xc, yb + (g - 0.3) / 2, wcol, 0.3, .std_pt("cifra"), cols[[k]]$color,
                 bold = TRUE, align = "center", nombre = if (k == 1) "box:cifra" else "box2:cifra")
      }
    }
    if (es_tot) .lam_caja(lz, x, yb + g + 0.08, w, 0.008, .std_color("filete"), nombre = "filete:total")
    yy <- yy + paso + (if (es_tot) 0.22 else 0)
  }
  invisible(yy)
}

#' ¿El bloque va en filas con Total o Bottom Two Box en vez del bloque de premisas?
#' @keywords internal
.lam_escala_en_filas <- function(espec) any(espec$filas$es_total) || !is.null(espec$box2$unidades)

# Líneas que admite el rótulo de una premisa en la columna de la forma en filas (decisión «2c» de Gonzalo)
#
# Se mide con `.lam_lineas_tinta` en la columna de rótulos de esa forma (`.LAM_ESCALA_FILAS_WLAB`, 1.8 in) y a la
# letra del rótulo (`.std_pt("actor")`, 12 pt). Lo dibujado en el recetario fija el corte: en la lámina 97 la
# premisa más larga, «Claridad de la información», compone dos líneas en esa columna y el cuadro del recetario le
# da justo dos (0.5 in); las seis premisas de las láminas 221/222 componen de siete a trece líneas ahí (de tres a
# siete en la columna de premisas de 3.3 in a 13 pt). Con tres líneas (0.7 in) el rótulo ya pasa el alto de una fila
# de cuatro (0.64 in) y la estira (`.lam_filas_paso`): deja de ser la lámina 97.
.LAM_ESCALA_FILAS_LINEAS_MAX <- 2L
.LAM_ESCALA_FILAS_WLAB <- 1.8

#' ¿Todas las premisas caben en la columna de rótulos de la forma en filas?
#'
#' Sólo sin actores: con ellos el rótulo de la fila es el público y la premisa encabeza su bloque; esa espec sigue
#' en el bloque de premisas y actores como hasta ahora. Sin filas, `FALSE` (la misma conducta de antes).
#' @keywords internal
.lam_escala_premisas_cortas <- function(espec, umbral = .LAM_ESCALA_FILAS_LINEAS_MAX) {
  f <- espec$filas
  if (!NROW(f) || !all(is.na(f$grupo_id))) return(FALSE)
  rot <- as.character(f$rotulo); rot[is.na(rot)] <- ""
  all(.lam_lineas_tinta(rot, .LAM_ESCALA_FILAS_WLAB, .std_pt("actor"), TRUE) <= umbral)
}

#' ¿La lámina de un gráfico se compone en filas o en el bloque de premisas?
#'
#' En filas con la fila Total, que el recetario separa con su filete bajo la pregunta (lámina 79). Con Bottom Two
#' Box la forma depende del largo de las premisas (decisión «2c»): si todas caben en
#' `.LAM_ESCALA_FILAS_LINEAS_MAX` líneas de la columna de rótulos de la forma en filas, van en filas con las dos
#' columnas de box (lámina 97); si alguna es más larga, van en el bloque de premisas (láminas 221/222), donde la
#' segunda columna sólo resta ancho a la barra (`.lam_escala_columnas_box`) y la partición, los altos de fila, la
#' línea de respuestas y los casos bajo la cifra son los de sin ella. Esa columna de 1.8 in no mide el alto de una
#' premisa larga: la lámina 24 de acrconta_mazo (siete premisas de cinco líneas) pasaba a una lámina encimada
#' (F-d); con el umbral va al bloque y se parte. Sin Bottom Two Box nada cambia.
#'
#' Sólo decide la forma: las cifras, las bases y el orden de las filas son los de la especificación.
#' `.lam_escala_en_filas()` sigue diciendo si la espec trae Total o Bottom Two Box: las láminas de varios bloques
#' (multilista, mixtas, paneles) no dibujan la segunda columna y con ella toman la ruta anterior.
#' @keywords internal
.lam_escala_modo_filas <- function(espec) {
  any(espec$filas$es_total %in% TRUE) || (!is.null(espec$box2$unidades) && .lam_escala_premisas_cortas(espec))
}

#' Alto que toma una fila en el modo en filas: el de la fila, o el de su rótulo si es más alto
#'
#' El rótulo va en una columna de ancho fijo; si pide más líneas de las que caben en la fila, la fila crece en vez
#' de dejar que el rótulo invada la de al lado.
#' @keywords internal
.lam_filas_paso <- function(espec, i, fila, wlab = 1.8) {
  max(fila, .lam_alto_txt(espec$filas$rotulo[i], wlab, .std_pt("actor"), TRUE))
}

# ---- planificación del modo de filas: bloques, alto y partición --------------------------------------

#' Geometría de una parte en filas: grosor por el número de filas, aire para las cifras chicas
#' @keywords internal
.lam_filas_geo <- function(espec, filas) {
  g_ <- .std_geom; w <- g_("ancho") - g_("margen_izq") - g_("margen_der"); wlab <- 1.8
  ncol <- sum(!is.null(espec$box$unidades), !is.null(espec$box2$unidades))
  wb <- w - wlab - 0.12 - ncol * 1.25 - (if (ncol) 0.15 else 0)
  g <- .std_grosor(length(filas), "escala_apilada")
  chica <- any(vapply(filas, function(i) .lam_tiene_peq(.lam_escala_seg(espec, i), wb), TRUE))
  # Con base chica el «x de y» baja 0.30 in del centro de la barra y la cifra de la fila siguiente sube 0.26 in del
  # suyo: hace falta un paso de 0.56 in. La partición nunca deja más de siete filas por parte (ocho a 0.58 in no
  # caben en `.lam_filas_disponible()`, 4.52 in), así que el paso mínimo es 0.38 + 0.2 = 0.58 in y alcanza; con la
  # Total, seis filas (barra de 0.44 in) y su filete cae justo bajo los casos. No hace falta agrandar la fila.
  list(g = g, fila = g + (if (chica) .std_geom("aire_cifra_chica") else 0.2))
}

#' Caja de la pregunta de la forma en filas: una línea (0.34 in) o lo que pidan sus líneas a la letra del estándar
#' @keywords internal
.lam_filas_pregunta_caja <- function(pregunta, w) max(0.34, .lam_alto_tinta(pregunta, w, .std_pt("pregunta"), TRUE)[[1]])
#' Alto que la pregunta le quita a la parte (caja y aire hasta las cabeceras de los box)
#' @keywords internal
.lam_filas_pregunta_alto <- function(pregunta, w) {
  if (is.null(pregunta) || !nzchar(pregunta)) return(0)
  max(0.42, .lam_filas_pregunta_caja(pregunta, w) + 0.08)
}
.lam_filas_ancho <- function() .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")

#' Alto de una parte hecha de bloques (pregunta opcional, cabecera de columnas, filas y aire de la Total)
#' @keywords internal
.lam_filas_alto <- function(espec, bloques) {
  filas <- unlist(lapply(bloques, `[[`, "filas"))
  geo <- .lam_filas_geo(espec, filas)
  sum(vapply(bloques, function(b) {
    .lam_filas_pregunta_alto(b$pregunta, .lam_filas_ancho()) + 0.3 +
      sum(vapply(b$filas, function(i) .lam_filas_paso(espec, i, geo$fila), 0)) +
      0.22 * sum(espec$filas$es_total[b$filas])
  }, 0)) + 0.2 * (length(bloques) - 1L)
}
.lam_filas_disponible <- function() (.std_geom("leyenda_y") - 0.15) - (.std_geom("zona_datos_y0") + 0.1)

#' Partes en filas: un bloque por premisa (con su título) o uno solo bajo la pregunta
#'
#' Si no cabe, se parte por bloques enteros (un bloque de actores no se separa) y, si un bloque solo no
#' cabe, por filas, repitiendo la fila Total en cada parte: es la referencia de los grupos que resume.
#' La letra no encoge.
#' @return Lista de partes; cada parte, una lista de bloques `list(pregunta, filas)`.
#' @keywords internal
.lam_filas_planear <- function(espec, premisas, disponible = .lam_filas_disponible()) {
  con_grupos <- !all(is.na(espec$filas$grupo_id))
  ids <- function(p) vapply(p$filas, function(f) f$i, 0L)
  bloques <- if (con_grupos) {
    lapply(premisas, function(p) list(pregunta = p$texto, filas = ids(p)))
  } else {
    list(list(pregunta = espec$pregunta, filas = unlist(lapply(premisas, ids))))
  }
  alto <- function(bs) .lam_filas_alto(espec, bs)
  partes <- if (length(bloques) > 1L) .lam_escala_partir(bloques, disponible, alto_fn = alto) else list(bloques)
  out <- list()
  for (parte in partes) {
    if (alto(parte) <= disponible || length(parte) > 1L) { out[[length(out) + 1L]] <- parte; next }
    b <- parte[[1]]; tot <- b$filas[espec$filas$es_total[b$filas]]; resto <- setdiff(b$filas, tot)
    hecho <- FALSE
    for (k in 2:max(2L, length(resto))) {
      # Trozos parejos (10 grupos en tres partes: 4/3/3, no 4/4/2), como el corte parejo del recetario.
      trozos <- split(resto, .barras_leyenda_reparto(length(resto), k))
      cand <- lapply(trozos, function(tr) list(list(pregunta = b$pregunta, filas = c(tot, tr))))
      if (all(vapply(cand, alto, 0) <= disponible)) { out <- c(out, unname(cand)); hecho <- TRUE; break }
    }
    if (!hecho) out <- c(out, lapply(resto, function(r) list(list(pregunta = b$pregunta, filas = c(tot, r)))))
  }
  out
}

#' Dibuja una parte en filas: sus bloques uno bajo otro y la leyenda de la lámina
#' @keywords internal
.lam_bloque_filas <- function(lz, espec, bloques) {
  g_ <- .std_geom
  geo <- .lam_filas_geo(espec, unlist(lapply(bloques, `[[`, "filas")))
  x <- g_("margen_izq"); w <- g_("ancho") - x - g_("margen_der"); y <- g_("zona_datos_y0") + 0.1
  for (k in seq_along(bloques)) {
    if (k > 1L && isTRUE(espec$filete_temas)) .lam_caja(lz, x, y - 0.1, w, 0.008, .std_color("filete"), nombre = "filete")
    y <- .lam_filas_box(lz, espec, bloques[[k]]$filas, x = x, y = y, w = w, pregunta = bloques[[k]]$pregunta,
                        g = geo$g, fila = geo$fila) + 0.2
  }
  ley <- espec$leyenda
  .lam_leyenda(lz, g_("leyenda_y") - 0.05, espec$categorias$rotulo[ley], espec$categorias$color[ley], centrar_en = g_("ancho") / 2)
  invisible(lz)
}
