# =============================================================================
# lamina_mapa_resultado_tarjeta.R — el mapa de resultado por distrito con el lenguaje del mapa de distribución
# =============================================================================
#
# Ítem 4 del checklist del catálogo (Gonzalo, 2026-11-08): el mapa de distribución «me parece más moderno y sofisticado».
# El de resultado conserva su función —un resultado por distrito: el porcentaje en el corte entre las respuestas válidas
# de cada distrito, pintado por clases— y adopta la especificación aprobada del de distribución (lamina_mapa_distribucion.R):
# el mapa en su tarjeta blanca con el mar, la tierra de contexto y el contorno de Lima y Callao; la leyenda de clases debajo,
# en bloques con su rango y «Sin encuestas»; y al lado, en su propia tarjeta, la lista con el nombre a la izquierda, la cifra
# en negrita a la derecha y, debajo, una barra del color de su clase sobre una pista del 100 %.
#
# Diferencia con la distribución: la lista de resultados no agrupa «Otros distritos» (un porcentaje no se suma entre
# distritos); muestra todos los distritos pintados, en hasta cuatro columnas. El indicador, las clases y el orden son los de
# `.espec_mapa_resultado` (graficos_mapa_resultado_plan.R): aquí no cambia ningún número.

#' La especificación de resultado vestida de distribución: el mapa con los colores de sus clases y la lista de resultados
#' @return Espec `mapa/1` con la forma de la distribución (la que dibujan `.mapa_dist_panel_gg` y su leyenda), o `NULL` si
#'   el paquete no trae la cartografía.
#' @keywords internal
.lam_mapa_res_como_dist <- function(espec) {
  carto <- .mapa_distribucion_cartografia("lima_callao")
  if (is.null(carto)) return(NULL)
  rk <- espec$ranking
  ub <- as.character(rk$ubigeo %||% rep(NA_character_, nrow(rk)))
  filas <- data.frame(codigo = ub, etiqueta = rk$distrito, n = as.integer(rk$n), clave = ub, stringsAsFactors = FALSE)
  filas <- filas[!is.na(filas$clave), , drop = FALSE]
  d <- .espec_mapa_distribucion(filas, carto, "lima_callao", medida = "conteo", encuadre = "completo")
  if (is.null(d)) return(NULL)
  M <- .MAPA_DIST()
  col_de <- stats::setNames(rk$color, ub)
  # Ronda 2, ítem 4: los distritos con menos de `min_n` casos van en gris rayado, aparte de los que no tienen encuestas.
  pocos <- as.character(espec$pocos$ubigeo %||% character(0))
  d$areas$color <- ifelse(d$areas$clave %in% names(col_de), unname(col_de[d$areas$clave]), ifelse(d$areas$clave %in% pocos, M$otra, M$vacio))
  d$otra <- pocos; d$otra_grupos <- if (length(pocos)) list(pocos) else list()
  n_cl <- length(espec$clases$colores %||% (espec$leyenda$colores[-length(espec$leyenda$colores)]))
  d$clases <- list(colores = espec$leyenda$colores[seq_len(n_cl)], rotulos = espec$leyenda$rotulos[seq_len(n_cl)], cortes = NULL)
  d$leyenda_titulo <- "Porcentaje por distrito"
  # «Menos de 55 %» no se parte en dos líneas: si los bloques no le dan su ancho, «Sin encuestas» baja a una segunda fila.
  d$leyenda_paso_min <- max(c(0, .lam_ancho_tinta(d$clases$rotulos, 7.5))) + 0.2
  d$leyenda_extras <- data.frame(texto = c("Sin encuestas", if (length(pocos)) sprintf("Con menos de %d casos", espec$min_n %||% 30L)),
                                 tipo = c("vacio", if (length(pocos)) "otra"), grupo = c(NA_integer_, if (length(pocos)) 1L),
                                 stringsAsFactors = FALSE)
  d$lista <- data.frame(nombre = rk$distrito, n = as.integer(rk$n), valor = as.character(rk$valor), pct = rep("", nrow(rk)), color = rk$color,
                        cifra = rk$cifra %||% (if (nrow(rk)) paste0(rk$valor, "%") else character(0)), frac = pmin(1, pmax(0, rk$valor / (espec$escala_max %||% 100))),
                        stringsAsFactors = FALSE)
  d$extra <- data.frame(nombre = character(0), n = integer(0))
  d$rotulos <- data.frame(texto = character(0), lon = numeric(0), lat = numeric(0), color = character(0), punto = character(0))
  d$puntos <- NULL
  d$nota_pie <- NULL
  d
}

#' Columnas de la lista de resultados: la menor cantidad (hasta cuatro) con la que las filas caben en el alto y cada nombre
#' con su cifra entra en una línea de su columna a 7 pt o más
#' @return Lista `ncol`, `por_col`, `fila`, `pt`, `wcol`, `cabe`.
#' @keywords internal
.lam_mapa_res_columnas <- function(lista, w, h, pt = 8.5) {
  P <- .LAM_MAPA_PX; n <- nrow(lista)
  if (!n) return(list(ncol = 1L, por_col = 0L, fila = 54 * P, pt = pt, wcol = w, pt_n = pt - 1, cabe = TRUE))
  pide <- max(.lam_ancho_tinta(lista$nombre, 1) + .lam_ancho_tinta(lista$cifra, 1, TRUE) * 1.05)
  for (k in 1:4) {
    por_col <- ceiling(n / k); fila <- min(54 * P, h / por_col)
    wcol <- (w - (k - 1L) * 0.3) / k
    pt_k <- max(7, min(pt, (wcol - 0.42) / pide))
    # Fila mínima de 31 px (0.26 in): el nombre a 7 pt y su barra de 11 px caben sin tocarse (`dy_barra`); con 34 px los 50
    # distritos de Lima y Callao no entraban bajo un subtítulo de dos líneas y la lámina perdía la lista entera.
    # Ronda 5: en la línea de la barra van la barra, la calle y el n, bajo el nombre y a la izquierda de la columna de la
    # cifra; la barra conserva al menos media pulgada.
    resto <- wcol - (max(.lam_ancho_tinta(lista$cifra, pt_k, TRUE)) * 1.05 + 0.16) - .lam_mapa_res_n_ancho(lista, max(7, pt_k - 1)) - 0.2 - 2 * .LAM_MAPA_RES_CALLE
    if (fila >= 31 * P - 1e-9 && pide * pt_k <= wcol - 0.42 + 1e-9 && resto >= 0.5) return(list(ncol = k, por_col = por_col, fila = fila, pt = pt_k,
                                                                                                wcol = wcol, pt_n = max(7, pt_k - 1), cabe = TRUE))
  }
  list(ncol = 4L, por_col = ceiling(n / 4), fila = h / ceiling(n / 4), pt = 7, wcol = (w - 0.9) / 4, pt_n = 7, cabe = FALSE)
}

#' Calle entre la columna del n y la de la cifra (in), la misma que separa el nombre de la cifra en la lista
#' @keywords internal
.LAM_MAPA_RES_CALLE <- 0.12

#' Texto y ancho de la columna del n de la lista (el más ancho, a `pt` puntos)
#' @keywords internal
.lam_mapa_res_n_texto <- function(n) sprintf("n = %s", format(n, big.mark = ",", trim = TRUE))
.lam_mapa_res_n_ancho <- function(lista, pt) if (!nrow(lista)) 0 else max(.lam_ancho_tinta(.lam_mapa_res_n_texto(lista$n), pt, FALSE))

#' La lista de resultados: nombre y cifra en una línea y, debajo, la barra del color de su clase sobre su pista
#' @keywords internal
.lam_mapa_res_lista <- function(lz, espec, x, y, w, h) {
  M <- .MAPA_DIST(); P <- .LAM_MAPA_PX; li <- espec$lista
  if (!nrow(li)) {
    .lam_txt(lz, "Ningún distrito llega a los casos mínimos para mostrar su resultado.", x, y, w, 0.5, 9, M$texto, nombre = "mapa:vacio")
    return(invisible(lz))
  }
  co <- .lam_mapa_res_columnas(li, w, h); hb <- 11 * P
  dy_barra <- min(0.21, co$fila - hb - 0.02)
  wn <- .lam_mapa_res_n_ancho(li, co$pt_n) + 0.2   # la columna del n: su tinta más los márgenes internos de la caja
  for (k in seq_len(nrow(li))) {
    col <- (k - 1L) %/% co$por_col; fi <- (k - 1L) %% co$por_col
    xk <- x + col * (co$wcol + 0.3); yk <- y + fi * co$fila
    wc <- .lam_ancho_tinta(li$cifra[k], co$pt, TRUE) * 1.05 + 0.26
    # Ronda 2, ítem 4 / ronda 5: el n de cada distrito (casos válidos, sin ponderar) en su propia columna, en la línea de la
    # barra y a la izquierda de la columna de la cifra, con la calle de la casa a cada lado: no comparte columna con la
    # cifra, así que no se le monta aunque la fila sea baja.
    x_cifra <- xk + co$wcol - wc + 0.1
    x_n <- x_cifra - .LAM_MAPA_RES_CALLE - wn
    wb <- x_n - .LAM_MAPA_RES_CALLE - xk
    .lam_txt(lz, li$nombre[k], xk - 0.1, yk, co$wcol - wc + 0.15, 0.24, co$pt, M$texto, nombre = "mapa:distrito")
    .lam_txt(lz, li$cifra[k], x_cifra, yk, wc, 0.24, co$pt, M$texto, bold = TRUE, align = "right", nombre = "mapa:valor")
    .lam_caja(lz, xk, yk + dy_barra, wb, hb, M$pista, nombre = "mapa:barra_fondo")
    .lam_caja(lz, xk, yk + dy_barra, max(1.5 * P, wb * li$frac[k]), hb, li$color[k], nombre = "mapa:barra")
    .lam_txt(lz, .lam_mapa_res_n_texto(li$n[k]), x_n, yk + dy_barra + hb / 2 - 0.12, wn, 0.24, co$pt_n, M$otros_texto, align = "right", nombre = "mapa:n")
  }
  invisible(lz)
}

#' Geometría de la lámina: la franja del mapa de distribución, el ancho del mapa y la lista
#' @keywords internal
.lam_mapa_res_tarjeta_geo <- function(espec, sub = NULL, titulo = NULL) {
  d <- .lam_mapa_res_como_dist(espec)
  if (is.null(d)) return(NULL)
  g_ <- .std_geom; P <- .LAM_MAPA_PX
  ml <- g_("margen_izq"); ancho <- g_("ancho") - ml - g_("margen_der"); fr <- .lam_mapa_franja(sub, titulo)
  wm <- .lam_mapa_dist_ancho_mapa(d, ancho * 860 / 1490, fr$y1 - fr$y0, ancho)
  w_lista <- ancho - wm - 20 * P
  # La lista va en su tarjeta con 24 px de aire a cada lado y 18 px arriba (`.lam_mapa_dist_en_caja`, modo «solo»).
  co <- .lam_mapa_res_columnas(d$lista, w_lista - 48 * P, fr$y1 - fr$y0 - 42 * P)
  list(d = d, ml = ml, ancho = ancho, fr = fr, wm = wm, w_lista = w_lista, columnas = co)
}

#' Lámina del mapa de resultado por distrito con tarjetas: el indicador encima, el mapa con su leyenda y la lista al lado
#' @keywords internal
.lam_laminas_mapa_resultado_tarjeta <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                                layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  G <- .lam_mapa_res_tarjeta_geo(espec, sub, titulo)
  if (is.null(G)) stop("Mapa por distrito: el paquete no trae la cartografía de Lima.", call. = FALSE)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  # El indicador encima de la tarjeta, en una línea (la pregunta del mapa de distribución).
  lz <- .lam_lienzo()
  .lam_txt(lz, espec$panel$titulo %||% "", G$ml - 0.1, G$fr$y_preg, G$ancho + 0.2, 0.3, 11, .std_color("azul"), bold = TRUE, nombre = "panel:pregunta")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:mapa:pregunta")
  doc <- .lam_mapa_dist_en_caja(doc, G$d, G$ml, G$fr$y0, G$wm, G$fr$y1 - G$fr$y0, modo = "solo", w_lista = G$w_lista,
                                lista = .lam_mapa_res_lista)
  doc <- .lam_pie(doc, .lam_mapa_res_pie(base, espec), folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' El pie del mapa de resultado: la base, los distritos con pocos casos (con su n) y, si hay pesos, qué está ponderado
#'
#' Ronda 2, ítem 4 (revisión metodológica): los distritos con menos de `min_n` casos no lleven porcentaje pero se nombran en
#' la lámina, no sólo en el aviso; y con pesos, el porcentaje es ponderado y el n de cada distrito no.
#' @keywords internal
.lam_mapa_res_pie <- function(base, espec) {
  b <- as.character(base %||% "")[1]; if (is.na(b)) b <- ""
  pc <- espec$pocos
  # Hasta diez se nombran con su n; con más, el pie (dos líneas) sólo los cuenta: van rayados en el mapa y en el aviso.
  pocos <- if (NROW(pc) > 10L) sprintf("Con menos de %d casos, sin porcentaje: %d distritos, rayados en el mapa", espec$min_n %||% 30L, NROW(pc)) else
    if (NROW(pc)) sprintf("Con menos de %d casos, sin porcentaje: %s", espec$min_n %||% 30L, paste(sprintf("%s (n = %d)", pc$distrito, pc$n), collapse = ", "))
  pond <- if (isTRUE(espec$ponderado)) "Porcentajes ponderados; n sin ponderar"
  partes <- c(if (nzchar(b)) b, pocos, pond)
  if (!length(partes)) return(NULL)
  .lam_con_punto(do.call(.lam_unir_base, as.list(partes)))
}

#' ¿Cabe? Hay cartografía y la lista entra en hasta cuatro columnas con cada nombre y su cifra en una línea
#' @keywords internal
.lam_mapa_res_tarjeta_cabe <- function(espec, titulo = NULL, sub = NULL) {
  G <- tryCatch(.lam_mapa_res_tarjeta_geo(espec, sub, titulo), error = function(e) NULL)
  !is.null(G) && isTRUE(G$columnas$cabe)
}
