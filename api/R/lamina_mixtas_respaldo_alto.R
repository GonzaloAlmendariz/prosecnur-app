# =============================================================================
# lamina_mixtas_respaldo_alto.R — el panel de respaldo de una lámina mixta pide su alto, se dibuja con él y deja su nota
# de diferencias en el pie
# =============================================================================
#
# Ola 3, O1 (captura «I. Cuatro gráficos con exclusión», panel de arriba a la izquierda; antes G3, G4 y G6 de la ola 2): la
# apilada con cruce que no cabe en pieza nativa se dibujaba para las 6 in de la firma del graficador y se pegaba en un cajón
# de ~1.6 in. La leyenda se montaba sobre la nota de significancia, las cifras chicas se pegaban («8%8%») y las barras salían
# más finas que las del panel vecino. Decisión del lead (2026-11-08):
#   (a) la nota de significancia del panel va al PIE DE LA LÁMINA, como en las demás láminas (`.lam_nota_sig_dibujar`), y la
#       imagen se dibuja sin ella;
#   (b) las dos filas de la cuadrícula se reparten el alto según lo que pide su contenido (la escala con su leyenda pide más
#       que la categórica) sobre el alto libre de la lámina (`.lam_perfil_estirar`), sin bajar del piso de grosor de los
#       paneles nativos ni cambiar su forma;
#   (c) el respaldo se vuelve a dibujar con el alto real de su cajón.
# Partir la lámina es decisión del analista: el motor no la parte.

#' Alto que pide un panel de respaldo: su encabezado y su gráfico con las barras de escala sobre el piso del estándar
#'
#' Para una escala: la cabecera TOP TWO BOX si la lleva, una fila por grupo con la barra en el piso de escala
#' (`.std_piso_escala_in()`, el 58 % de la fila, como el likert compacto) y la leyenda en las filas que ocupa en el ancho
#' del panel. Para otra cosa, una fila de 0.42 in por categoría. Sólo es una medida para repartir el alto: el graficador
#' dibuja después con el cajón que le toque.
#' @keywords internal
.lam_respaldo_pide <- function(espec, w, pregunta = NULL, publico = NULL, estilo = NULL) {
  enc <- if (!is.null(pregunta) && nzchar(pregunta)) {
    .lam_panel_titulo(.lam_lienzo(), 0, 0, w, pregunta, publico, size = estilo$titulo_pt %||% .std_pt("pregunta")) + 0.1
  } else 0.1
  if (identical(espec$tipo, "escala") && NROW(espec$filas)) {
    n <- length(espec$orden$aplicado %||% seq_len(NROW(espec$filas)))
    fila <- .std_piso_escala_in() / 0.58
    ley <- espec$leyenda %||% seq_len(NROW(espec$categorias))
    n_ley <- max(1L, length(.lam_leyenda_filas(espec$categorias$rotulo[ley], w)))
    ttb <- if (!is.null(espec$box$unidades)) .std_geom("columna_top_two_box") * 0.35 else 0
    return(enc + ttb + n * fila + 0.15 + 0.3 * n_ley)
  }
  enc + 0.42 * max(1L, length(espec$largos %||% espec$rotulos))
}

#' Reparte el alto entre las dos filas cuando un panel queda de respaldo (O1 ola 3)
#'
#' Cada panel nativo pide el alto mínimo con el que conserva su forma; el de respaldo, `.lam_respaldo_pide`. Si caben las
#' dos filas, el sobrante se reparte en proporción a lo pedido; si no, la fila del respaldo se queda con lo que deja la otra
#' (nunca menos de lo que tenía). Si algún panel nativo cambiara de forma, la geometría no cambia.
#' @param caben Lógico por panel, el de `.lam_perfil_plan`.
#' @keywords internal
.lam_perfil_reparto_respaldo <- function(geo, especs, preguntas, publicos, compartida, estilo, caben) {
  P <- geo$paneles
  if (length(P) < 2L || !is.null(geo$cifras) || any(!vapply(P, function(p) is.null(p$receta), TRUE))) return(geo)
  if (any(vapply(especs, function(e) is.null(e) || .lam_es_cifra(e), TRUE))) return(geo)
  ys <- round(vapply(P, `[[`, 0, "y"), 2); filas <- sort(unique(ys))
  if (length(filas) != 2L) return(geo)
  arriba <- which(ys == filas[1]); abajo <- which(ys == filas[2])
  hs <- vapply(P, `[[`, 0, "h")
  if (diff(range(hs[arriba])) > 0.01 || diff(range(hs[abajo])) > 0.01) return(geo)
  total <- hs[arriba[1]] + hs[abajo[1]]
  forma <- function(k, h) {
    p <- P[[k]]; p$h <- h
    x <- .lam_perfil_panel_geo(especs[[k]], p, preguntas[[k]], publicos[[k]], !compartida[k], estilo)
    if (isTRUE(x$cabe)) x$tipo %||% "nativo" else "respaldo"
  }
  t0 <- vapply(seq_along(P), function(k) if (isTRUE(caben[k])) forma(k, P[[k]]$h) else "respaldo", "")
  pide <- vapply(seq_along(P), function(k) {
    if (identical(t0[k], "respaldo")) return(.lam_respaldo_pide(especs[[k]], P[[k]]$w, preguntas[[k]], publicos[[k]], estilo))
    lo <- 0.5; hi <- total
    if (!identical(forma(k, hi), t0[k])) return(P[[k]]$h)
    for (i in 1:12) { m <- (lo + hi) / 2; if (identical(forma(k, m), t0[k])) hi <- m else lo <- m }
    hi
  }, 0)
  resp <- t0 == "respaldo"
  n1 <- max(pide[arriba]); n2 <- max(pide[abajo])
  H1 <- if (n1 + n2 <= total) n1 + (total - n1 - n2) * n1 / (n1 + n2) else {
    nat1 <- max(c(0, pide[arriba][!resp[arriba]])); nat2 <- max(c(0, pide[abajo][!resp[abajo]]))
    # No caben las dos: la fila nativa se queda con lo justo para su forma y la del respaldo con el resto.
    if (any(resp[arriba]) && !any(resp[abajo])) total - nat2
    else if (any(resp[abajo]) && !any(resp[arriba])) nat1
    else total * n1 / (n1 + n2)
  }
  d <- H1 - hs[arriba[1]]
  if (abs(d) < 0.01) return(geo)
  g2 <- .lam_perfil_correr_filas(geo, filas, arriba, hs[arriba[1]], d)
  t2 <- vapply(seq_along(P), function(k) if (resp[k]) "respaldo" else forma(k, g2$paneles[[k]]$h), "")
  if (!identical(t2, t0)) return(geo)
  g2
}

#' Corre la frontera entre las dos filas de paneles `d` pulgadas (con sus filetes)
#' @keywords internal
.lam_perfil_correr_filas <- function(geo, filas, arriba, h1, d) {
  fin1 <- filas[1] + h1
  geo$paneles <- lapply(seq_along(geo$paneles), function(k) {
    p <- geo$paneles[[k]]
    if (k %in% arriba) p$h <- p$h + d else { p$y <- p$y + d; p$h <- p$h - d }
    p
  })
  geo$filetes <- lapply(geo$filetes, function(f) {
    if (identical(f$tipo, "v")) {
      if (abs(f$y1 - fin1) < 0.05) f$y1 <- f$y1 + d
      if (abs(f$y0 - filas[2]) < 0.05) f$y0 <- f$y0 + d
    } else if (f$y > fin1 - 0.05 && f$y < filas[2] + 0.05) f$y <- f$y + d
    f
  })
  geo
}

#' El cajón de un panel de respaldo (lo que `.lam_mixta_respaldo_caja` le da al gráfico)
#' @return `list(x, y, w, h)` en pulgadas.
#' @keywords internal
.lam_respaldo_cajon_alto <- function(p, pregunta = NULL, publico = NULL, estilo = NULL) {
  if (!is.null(p$receta)) estilo <- NULL
  if (!is.null(p$receta$lateral)) { q <- .lam_panel_lateral_rect(p); return(list(x = q$x, y = q$y, w = max(0.5, q$w), h = max(0.5, q$h))) }
  y_fin <- if (!is.null(pregunta) && nzchar(pregunta)) {
    .lam_panel_titulo(.lam_lienzo(), p$x, p$y, p$w, pregunta, publico, size = estilo$titulo_pt %||% .std_pt("pregunta"))
  } else p$y
  list(x = p$x, y = y_fin + 0.1, w = max(0.5, p$w), h = max(0.5, p$y + p$h - (y_fin + 0.1)))
}

#' Vuelve a dibujar los respaldos de una lámina mixta con su cajón real y sin su nota de diferencias (O1 ola 3)
#'
#' @param redibujar `function(k, ancho, alto)` que devuelve el gráfico `k` dibujado sin título ni pie, con ese cajón y con la
#'   nota de diferencias reservada para la lámina; `NULL` deja los respaldos como llegaron.
#' @param plan El de `.lam_perfil_plan` (geometría y estilo que dibujará la lámina).
#' @return `list(respaldo, notas)`: los respaldos (redibujados los que se pudo) y las notas de diferencias que la lámina escribe
#'   en su pie.
#' @keywords internal
.lam_mixta_respaldo_redibujar <- function(respaldo, els, plan, preguntas, publicos, redibujar = NULL) {
  notas <- character(0)
  if (!is.function(redibujar)) return(list(respaldo = respaldo, notas = notas))
  for (k in which(!vapply(respaldo, is.null, TRUE))) {
    if (k > length(els) || !.composicion_recibe_alto(els[[k]])) next
    cj <- .lam_respaldo_cajon_alto(plan$geo$paneles[[k]], preguntas[[k]] %||% NULL, (publicos %||% list())[k][[1]] %||% NULL, plan$estilo)
    p <- tryCatch(redibujar(k, cj$w, cj$h), error = function(e) NULL)
    if (!inherits(p, "ggplot")) next
    respaldo[[k]] <- p
    n <- .lam_nota_sig_de(p)
    if (!is.null(n)) notas <- c(notas, n)
  }
  list(respaldo = respaldo, notas = unique(notas))
}

#' La función que vuelve a dibujar un gráfico de la lámina con su cajón, desde el motor que la compone
#'
#' @param render,inyectar `.render_element` e `.inject_title_override` del motor (`reporte_ppt_plan` o la composición).
#' @keywords internal
.lam_mixta_redibujador <- function(els, render, inyectar = identity) {
  if (!is.function(render)) return(NULL)
  function(k, ancho, alto) {
    # La nota de diferencias se reserva para la lámina: el gráfico la deja en `pulso_sig_nota` y no la dibuja.
    viejo <- options(prosecnur.sig_nota_en_lamina = TRUE); on.exit(options(viejo), add = TRUE)
    render(inyectar(.lam_respaldo_el_sin_encabezado(els[[k]], alto = alto)), ancho_slot = ancho, alto_slot = alto)
  }
}

#' Qué paneles de una lámina mixta van de respaldo, redibujados con su cajón, y la nota que la lámina escribe en su pie
#'
#' La nota reserva su alto sobre «Base:» (`prosecnur.lam_reserva_pie`) y eso cambia el alto de los paneles, así que se mide
#' con la nota que traen los gráficos y, si la de los redibujados mide otro alto, se repite una vez con la medida real.
#' @return `list(respaldo, nota, reserva)`; `nota` es `NULL` si la lámina no escribe ninguna.
#' @keywords internal
.lam_mixta_respaldos <- function(especs, tipo, rendered, els, titulo_de_var, enc, titulo, redibujar = NULL, base_lamina = NULL) {
  pasada <- function(reserva) {
    viejo <- options(prosecnur.lam_reserva_pie = reserva); on.exit(options(viejo), add = TRUE)
    caben <- .lam_mixta_caben(especs, .lam_mixta_geo(tipo), els, titulo_de_var, enc = enc, titulo = titulo)
    respaldo <- lapply(seq_along(rendered), function(k) if (caben[k] || .lam_es_cifra(especs[[k]])) NULL else rendered[[k]])
    if (!is.function(redibujar) || all(vapply(respaldo, is.null, TRUE))) return(list(respaldo = respaldo, notas = character(0), redib = FALSE))
    geo <- .lam_mixta_geo_bajo_titulo(.lam_mixta_geo(tipo), titulo)
    compartida <- .lam_mixta_compartida(especs, geo$paneles)
    plan <- .lam_perfil_plan(especs, geo, enc$preguntas, enc$publicos %||% vector("list", length(especs)), compartida, titulo = titulo)
    c(.lam_mixta_respaldo_redibujar(respaldo, els, plan, enc$preguntas, enc$publicos, redibujar), redib = TRUE)
  }
  base <- getOption("prosecnur.lam_reserva_pie", 0)
  # Lo que la base de la lámina ya dice («Diferencias entre los grupos mostrados.») no se repite en la nota.
  unir <- function(n) {
    n <- vapply(n, function(x) .lam_nota_sin_lo_de_la_base(x, base_lamina), "")
    n <- unique(n[nzchar(n)])
    if (length(n)) paste(n, collapse = "\n") else NULL
  }
  alto <- function(n) if (is.null(n)) 0 else .lam_nota_sig_alto(n)
  # La nota que traen los gráficos que irían de respaldo: con ella se mide la primera pasada.
  r0 <- pasada(base)
  if (!isTRUE(r0$redib)) return(list(respaldo = r0$respaldo, nota = NULL, reserva = base))
  previa <- unir(unique(unlist(lapply(rendered[!vapply(r0$respaldo, is.null, TRUE)], .lam_nota_sig_de))))
  r <- pasada(base + alto(previa))
  nota <- unir(r$notas)
  if (abs(alto(nota) - alto(previa)) > 0.01) { r <- pasada(base + alto(nota)); nota <- unir(r$notas) }
  list(respaldo = r$respaldo, nota = nota, reserva = base + alto(nota))
}

#' La nota sin las oraciones que la base de la lámina ya dice
#' @keywords internal
.lam_nota_sin_lo_de_la_base <- function(nota, base = NULL) {
  b <- trimws(as.character(base %||% "")[1])
  if (is.na(b) || !nzchar(b)) return(trimws(nota))
  norm <- function(x) tolower(gsub("[[:space:].]+$", "", trimws(x)))
  lineas <- strsplit(nota, "\n", fixed = TRUE)[[1]]
  lineas <- vapply(lineas, function(l) {
    o <- trimws(unlist(strsplit(l, "(?<=\\.)\\s+", perl = TRUE)))
    o <- o[nzchar(o) & !vapply(o, function(x) grepl(norm(x), tolower(b), fixed = TRUE), TRUE)]
    paste(o, collapse = " ")
  }, "")
  trimws(paste(lineas[nzchar(lineas)], collapse = "\n"))
}
