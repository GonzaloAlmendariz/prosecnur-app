# =============================================================================
# graficos_matriz_cuadrantes.R — la matriz de cuadrantes (G16)
# =============================================================================
#
# Gonzalo, 2026-10-13: el propósito general de la FODA, que sólo comparaba dimensiones. «¿Y cómo determinas la
# importancia? Cuidado con hacer modelos muy específicos para una app que por definición es generalista» → «Sí, vamos
# con matriz de cuadrantes». Cada tema es un punto con DOS medidas que el estudio ya tiene (X e Y, cada una con su
# corte); la app no calcula ninguna. Las líneas cortan en el promedio de cada eje o en un valor declarado, y los
# cuadrantes llevan los nombres que declare la lámina. Sirve para satisfacción frente a importancia, docentes frente a
# estudiantes, 2021 frente a 2026 o conoce frente a usa.
#
# La lámina es la 91 del recetario (docs/qa/motor-ppt-2026-10-06/herramientas/propuestas_cuadrantes.R), aprobada por
# Gonzalo el 2026-10-13: dispersión a la izquierda con los nombres de los cuadrantes fuera del área de puntos, y a la
# derecha la lista de lo que cae en el cuadrante destacado.

.CUADRANTES <- c("arriba_izq", "arriba_der", "abajo_izq", "abajo_der")

# Neutros: la app no sabe qué significan los ejes. «Fortalezas · Mantener · Mejorar · Prioridad» es un juego sugerido
# para satisfacción frente a importancia, no el de fábrica.
.CUADRANTES_NOMBRES_NEUTROS <- c(arriba_izq = "Alto en el eje vertical", arriba_der = "Altos en ambos",
                                 abajo_izq = "Bajos en ambos", abajo_der = "Alto en el eje horizontal")

#' Matriz de cuadrantes: cada tema con dos medidas
#'
#' @param temas Lista nombrada `tema -> c(ref_x, ref_y)` (`base$variable`); cada medida se calcula en su base.
#' @param corte_x,corte_y Códigos de la escala que suman cada indicador («4,5»).
#' @param eje_x,eje_y Nombre de cada medida; vacío, el eje dice sólo las respuestas que suman («Satisfecho + Muy satisfecho»).
#' @param linea «promedio» (cada línea corta en el promedio de su eje) o «valor» (`linea_x`, `linea_y` en %).
#' @param nombres Nombres de los cuadrantes (`arriba_izq`, `arriba_der`, `abajo_izq`, `abajo_der`).
#' @param destacado Cuadrante con fondo y lista a la derecha, o «ninguno».
#' @export
p_matriz_cuadrantes <- function(temas, corte_x, corte_y, eje_x = NULL, eje_y = NULL,
                                linea = c("promedio", "valor"), linea_x = NULL, linea_y = NULL,
                                nombres = NULL, destacado = c("arriba_izq", "arriba_der", "abajo_izq", "abajo_der", "ninguno"),
                                titulo = NULL, overrides = list(), base = list(), filtros = list()) {
  linea <- match.arg(linea); destacado <- match.arg(destacado)
  if (!is.list(temas) || !length(temas) || is.null(names(temas)) || any(!nzchar(trimws(names(temas))))) {
    .plan_spec_abort("p_matriz_cuadrantes(): `temas` debe ser una lista nombrada: cada tema con sus dos preguntas.")
  }
  temas <- lapply(temas, function(x) trimws(as.character(unlist(x))))
  malos <- names(temas)[vapply(temas, function(x) length(x) != 2L || any(!nzchar(x)), logical(1))]
  if (length(malos)) .plan_spec_abort("p_matriz_cuadrantes(): el tema «", malos[1], "» necesita dos preguntas: la del eje horizontal y la del vertical.")
  cx <- .radar_mb_codigos(paste(unlist(corte_x), collapse = ",")); cy <- .radar_mb_codigos(paste(unlist(corte_y), collapse = ","))
  if (!length(cx) || !length(cy)) .plan_spec_abort("p_matriz_cuadrantes(): marca qué respuestas suman cada indicador.")
  num <- function(v) { v <- suppressWarnings(as.numeric(unlist(v))[1]); if (length(v) && is.finite(v)) v else NULL }
  if (identical(linea, "valor") && (is.null(num(linea_x)) || is.null(num(linea_y)))) {
    .plan_spec_abort("p_matriz_cuadrantes(): con «valor», declara dónde corta cada línea (en %).")
  }
  nom <- as.list(nombres %||% list())
  nom <- nom[intersect(names(nom), .CUADRANTES)]
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  el <- list(
    .element_type = "matriz_cuadrantes",
    var = NULL,
    temas = temas,
    corte_x = paste(cx, collapse = ","), corte_y = paste(cy, collapse = ","),
    eje_x = .ppt_norm_text1(eje_x, blank = NULL), eje_y = .ppt_norm_text1(eje_y, blank = NULL),
    linea = linea, linea_x = num(linea_x), linea_y = num(linea_y),
    nombres = lapply(nom, function(x) trimws(as.character(x)[1])), destacado = destacado,
    title_slide = titulo, overrides = overrides, base = base, filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Las dos medidas de cada tema, cada una en su base
#' @return `data.frame(tema, x, y, nx, ny)` en 0–100; un tema sin casos en alguna medida queda con NA.
#' @keywords internal
.matriz_cuadrantes_datos <- function(temas, corte_x, corte_y, sources, filtros = list()) {
  medir <- function(ref, corte) {
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) stop("matriz de cuadrantes: la pregunta `", ref, "` no existe en su base.", call. = FALSE)
    d <- (sources$data_sources %||% list())[[ctx$source]]
    d <- .apply_named_filters_safe(d, filters = filtros, arg_name = "filtros de la matriz", mode = "strict")
    m <- .radar_mb_pct(d[[ctx$resolved_variable]], .radar_mb_codigos(corte), pesos = .radar_mb_pesos(d))
    m$base <- ctx$source
    m
  }
  filas <- lapply(names(temas), function(t) {
    mx <- medir(temas[[t]][1], corte_x); my <- medir(temas[[t]][2], corte_y)
    data.frame(tema = t, x = mx$valor, y = my$valor, nx = mx$n, ny = my$n, base_x = mx$base, base_y = my$base, stringsAsFactors = FALSE)
  })
  do.call(rbind, filas)
}

#' Rótulo de un eje: el nombre de la medida y las respuestas que suman («Satisfacción · Satisfecho + Muy satisfecho»)
#' @keywords internal
.matriz_cuadrantes_eje <- function(nombre, ref, corte, sources) {
  ctx <- tryCatch(.graficos_consolidado_ref_context(ref, sources), error = function(e) NULL)
  suma <- if (!is.null(ctx) && isTRUE(ctx$exists)) {
    tryCatch(.radar_mb_etiqueta_corte(corte, .equiv_escala_opciones(ctx$inst, ctx$resolved_variable)), error = function(e) "")
  } else ""
  partes <- c(nombre %||% "", suma)
  paste(partes[nzchar(partes)], collapse = " · ")
}

#' @keywords internal
.render_matriz_cuadrantes <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) stop("matriz de cuadrantes: el render no expone las fuentes del estudio.", call. = FALSE)
  sources <- list(data_sources = data_sources, inst_sources = inst_sources)
  d <- .matriz_cuadrantes_datos(el$temas, el$corte_x, el$corte_y, sources, filtros = el$filtros %||% list())
  primero <- el$temas[[1]]
  graficar_matriz_cuadrantes(
    d,
    eje_x = .matriz_cuadrantes_eje(el$eje_x, primero[1], el$corte_x, sources),
    eje_y = .matriz_cuadrantes_eje(el$eje_y, primero[2], el$corte_y, sources),
    linea_x = if (identical(el$linea, "valor")) el$linea_x else NULL,
    linea_y = if (identical(el$linea, "valor")) el$linea_y else NULL,
    nombres = el$nombres, destacado = el$destacado, titulo = el$title_slide %||% NULL,
    nombre_x = el$eje_x, nombre_y = el$eje_y
  )
}

#' La base de la lámina: el mayor n de cada base que aporta una medida («Base: 116 docentes y 289 estudiantes»)
#' @keywords internal
.matriz_cuadrantes_base <- function(data) {
  if (!all(c("base_x", "base_y", "nx", "ny") %in% names(data))) return(NULL)
  n <- c(stats::setNames(data$nx, data$base_x), stats::setNames(data$ny, data$base_y))
  n <- n[is.finite(n)]
  if (!length(n)) return(NULL)
  por_base <- vapply(split(n, names(n)), max, numeric(1))
  por_base <- por_base[unique(c(data$base_x, data$base_y))]
  partes <- sprintf("%s %s", format(round(por_base), big.mark = ",", trim = TRUE), names(por_base))
  paste0("Base: ", if (length(partes) == 1L) partes else paste(paste(utils::head(partes, -1L), collapse = ", "), "y", utils::tail(partes, 1L)), ".")
}

#' Matriz de cuadrantes (dibujo de respaldo y espec de la lámina 91)
#'
#' @param data `data.frame(tema, x, y)` en 0–100 (más `nx`, `ny` opcionales).
#' @param linea_x,linea_y Dónde cortan las líneas; `NULL` = el promedio de cada eje.
#' @export
graficar_matriz_cuadrantes <- function(data, eje_x = "", eje_y = "", linea_x = NULL, linea_y = NULL, nombres = NULL,
                                       destacado = "arriba_izq", titulo = NULL, nota_pie = NULL, nombre_x = NULL, nombre_y = NULL) {
  d <- data[is.finite(data$x) & is.finite(data$y), , drop = FALSE]
  if (!nrow(d)) stop("matriz de cuadrantes: ningún tema tiene casos en sus dos medidas.", call. = FALSE)
  cx <- if (is.null(linea_x)) mean(d$x) else as.numeric(linea_x)
  cy <- if (is.null(linea_y)) mean(d$y) else as.numeric(linea_y)
  lim <- function(v, c0) { lo <- max(0, floor((min(c(v, c0)) - 5) / 10) * 10); hi <- min(100, ceiling((max(c(v, c0)) + 5) / 10) * 10); c(lo, hi) }
  lx <- lim(d$x, cx); ly <- lim(d$y, cy)
  nom <- .CUADRANTES_NOMBRES_NEUTROS
  for (k in intersect(names(nombres %||% list()), .CUADRANTES)) if (nzchar(nombres[[k]] %||% "")) nom[[k]] <- nombres[[k]]
  cuadrante <- ifelse(d$y >= cy, ifelse(d$x < cx, "arriba_izq", "arriba_der"), ifelse(d$x < cx, "abajo_izq", "abajo_der"))
  sin_casos <- data$tema[!(is.finite(data$x) & is.finite(data$y))]
  nota <- paste(c(nota_pie, .matriz_cuadrantes_base(data),
                  if (length(sin_casos)) paste0("Sin casos en alguna medida: ", paste(sin_casos, collapse = ", "), ".")), collapse = " ")

  col <- ifelse(cuadrante == destacado, .std_color("coral"), .std_color("azul"))
  g <- ggplot2::ggplot(d, ggplot2::aes(x = .data$x, y = .data$y)) +
    ggplot2::geom_vline(xintercept = cx, colour = .std_color("tenue")) +
    ggplot2::geom_hline(yintercept = cy, colour = .std_color("tenue")) +
    ggplot2::geom_point(colour = col, size = 3.5) +
    ggplot2::geom_text(ggplot2::aes(label = .data$tema), colour = col, hjust = -0.15, size = 3.6) +
    ggplot2::scale_x_continuous(limits = lx, labels = function(v) paste0(v, "%")) +
    ggplot2::scale_y_continuous(limits = ly, labels = function(v) paste0(v, "%")) +
    ggplot2::labs(x = eje_x, y = eje_y, title = titulo, caption = if (nzchar(nota)) nota else NULL) +
    ggplot2::theme_minimal(base_family = "Arial")
  attr(g, "pulso_espec") <- list(
    version = "cuadrantes/1", tipo = "cuadrantes", temas = d$tema, x = d$x, y = d$y, cuadrante = cuadrante,
    cx = cx, cy = cy, lim_x = lx, lim_y = ly, eje_x = eje_x, eje_y = eje_y, nombres = as.list(nom),
    destacado = destacado, linea = if (is.null(linea_x)) "promedio" else "valor", nota = if (nzchar(nota)) nota else NULL,
    col_x = nombre_x %||% "Horizontal", col_y = nombre_y %||% "Vertical"
  )
  g
}

#' ¿La matriz cabe en la lámina 91? Hasta 20 temas con rótulo legible
#' @keywords internal
.lam_cuadrantes_cabe <- function(espec) length(espec$temas) >= 2L && length(espec$temas) <= 20L

#' Lámina de la matriz de cuadrantes (91 del recetario)
#' @keywords internal
.lam_laminas_cuadrantes <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  hay_lista <- !identical(espec$destacado, "ninguno")
  xl <- ml + 0.75; wl <- if (hay_lista) 7.2 else W - mr - xl - 0.3
  yt <- g_("zona_datos_y0") + 0.45; hy <- g_("contenido_y1") - yt - 0.95
  lx <- espec$lim_x; ly <- espec$lim_y
  px <- function(v) xl + wl * (v - lx[1]) / (lx[2] - lx[1]); py <- function(v) yt + hy * (ly[2] - v) / (ly[2] - ly[1])
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  caja_q <- list(arriba_izq = c(xl, yt, px(espec$cx) - xl, py(espec$cy) - yt),
                 arriba_der = c(px(espec$cx), yt, xl + wl - px(espec$cx), py(espec$cy) - yt),
                 abajo_izq = c(xl, py(espec$cy), px(espec$cx) - xl, yt + hy - py(espec$cy)),
                 abajo_der = c(px(espec$cx), py(espec$cy), xl + wl - px(espec$cx), yt + hy - py(espec$cy)))
  if (hay_lista) { b <- caja_q[[espec$destacado]]; .lam_caja(lz, b[1], b[2], b[3], b[4], .std_color("fondo_destacado"), nombre = "cuadrantes:destacado") }
  paso <- function(l) { r <- diff(l); if (r <= 30) 5 else 10 }
  for (v in seq(lx[1], lx[2], paso(lx))) {
    .lam_caja(lz, px(v), yt, 0.006, hy, .std_color("filete"), nombre = "cuadrantes:guia")
    .lam_txt(lz, paste0(v, "%"), px(v) - 0.35, yt + hy + 0.06, 0.7, 0.24, 10, tenue, align = "center", nombre = "cuadrantes:eje_x")
  }
  for (v in seq(ly[1], ly[2], paso(ly))) {
    .lam_caja(lz, xl, py(v), wl, 0.006, .std_color("filete"), nombre = "cuadrantes:guia")
    .lam_txt(lz, paste0(v, "%"), xl - 0.75, py(v) - 0.12, 0.62, 0.24, 10, tenue, align = "right", nombre = "cuadrantes:eje_y")
  }
  .lam_caja(lz, px(espec$cx) - 0.008, yt, 0.016, hy, .std_color("tenue"), nombre = "cuadrantes:linea")
  .lam_caja(lz, xl, py(espec$cy) - 0.008, wl, 0.016, .std_color("tenue"), nombre = "cuadrantes:linea")
  rot <- if (identical(espec$linea, "valor")) "Corte" else "Promedio"
  .lam_txt(lz, sprintf("%s %s", rot, .pulso_fmt_pct_half_up(espec$cx, 0, escala = 1)), px(espec$cx) - 0.8, yt - 0.27, 1.6, 0.24, 9, suave, align = "center", nombre = "cuadrantes:corte")
  .lam_txt(lz, sprintf("%s %s", rot, .pulso_fmt_pct_half_up(espec$cy, 0, escala = 1)), xl + wl - 1.6, py(espec$cy) + 0.04, 1.6, 0.24, 9, suave, align = "right", nombre = "cuadrantes:corte")
  .lam_txt(lz, espec$eje_x %||% "", xl, yt + hy + 0.62, wl, 0.26, 10, suave, bold = TRUE, align = "center", nombre = "cuadrantes:titulo_x")
  .lam_txt(lz, espec$eje_y %||% "", xl - 0.75, yt - 0.62, wl, 0.26, 10, suave, bold = TRUE, nombre = "cuadrantes:titulo_y")
  mi <- function(a, b) (a + b) / 2
  col_q <- function(q) if (identical(q, espec$destacado)) coral else if (q == "arriba_der") azul else suave
  .lam_txt(lz, espec$nombres$arriba_izq, mi(xl, px(espec$cx)) - 1.4, yt - 0.3, 2.8, 0.28, 12, col_q("arriba_izq"), bold = TRUE, align = "center", nombre = "cuadrantes:nombre")
  .lam_txt(lz, espec$nombres$arriba_der, mi(px(espec$cx), xl + wl) - 1.4, yt - 0.3, 2.8, 0.28, 12, col_q("arriba_der"), bold = TRUE, align = "center", nombre = "cuadrantes:nombre")
  .lam_txt(lz, espec$nombres$abajo_izq, mi(xl, px(espec$cx)) - 1.4, yt + hy + 0.3, 2.8, 0.28, 12, col_q("abajo_izq"), bold = TRUE, align = "center", nombre = "cuadrantes:nombre")
  .lam_txt(lz, espec$nombres$abajo_der, mi(px(espec$cx), xl + wl) - 1.4, yt + hy + 0.3, 2.8, 0.28, 12, col_q("abajo_der"), bold = TRUE, align = "center", nombre = "cuadrantes:nombre")
  ubicados <- .lam_cuadrantes_rotulos(espec, px, py, xl, wl, yt, hy)
  # Los nombres no se acortan solos: si no caben sin pisarse, se avisa y el analista los escribe más cortos.
  pisados <- espec$temas[vapply(ubicados, function(u) (u$choques %||% 0) > 0, logical(1))]
  if (length(pisados)) {
    .pulso_aviso(sprintf("Matriz de cuadrantes: %d %s se pisan con otros (p. ej. «%s»). Escribe nombres más cortos para los temas en la pestaña Gráfico.",
                         length(pisados), if (length(pisados) == 1L) "nombre de tema" else "nombres de temas", substr(pisados[1], 1, 40)))
  }
  for (i in seq_along(espec$temas)) {
    dest <- identical(espec$cuadrante[i], espec$destacado); col <- if (dest) coral else azul
    .lam_caja(lz, px(espec$x[i]) - 0.1, py(espec$y[i]) - 0.1, 0.2, 0.2, col, nombre = "cuadrantes:punto", geom = "ellipse")
    u <- ubicados[[i]]
    .lam_txt(lz, espec$temas[i], u$l, u$t, u$w, u$h, 11, col, bold = dest, align = u$align, nombre = "cuadrantes:tema")
  }
  if (hay_lista) {
    xr <- xl + wl + 0.55; wr <- W - mr - xr
    k <- which(espec$cuadrante == espec$destacado); k <- k[order(-espec$y[k])]
    .lam_txt(lz, espec$nombres[[espec$destacado]], xr, yt - 0.05, wr, 0.32, 14, coral, bold = TRUE, nombre = "cuadrantes:lista_titulo")
    .lam_txt(lz, espec$col_y %||% "Vertical", xr + wr - 2.0, yt + 0.8, 1.0, 0.24, 9, tenue, align = "right", nombre = "cuadrantes:lista_col")
    .lam_txt(lz, espec$col_x %||% "Horizontal", xr + wr - 1.0, yt + 0.8, 1.0, 0.24, 9, tenue, align = "right", nombre = "cuadrantes:lista_col")
    for (j in seq_along(utils::head(k, 9L))) {
      i <- k[j]; y <- yt + 1.1 + (j - 1) * 0.56
      .lam_caja(lz, xr, y + 0.52, wr, 0.006, .std_color("filete"), nombre = "cuadrantes:lista_filete")
      .lam_txt(lz, espec$temas[i], xr, y + 0.02, wr - 2.05, 0.48, 11, azul, bold = TRUE, nombre = "cuadrantes:lista_tema")
      .lam_txt(lz, .pulso_fmt_pct_half_up(espec$y[i], 0, escala = 1), xr + wr - 2.0, y + 0.06, 1.0, 0.32, 12, azul, align = "right", nombre = "cuadrantes:lista_y")
      .lam_txt(lz, .pulso_fmt_pct_half_up(espec$x[i], 0, escala = 1), xr + wr - 1.0, y + 0.06, 1.0, 0.32, 12, coral, bold = TRUE, align = "right", nombre = "cuadrantes:lista_x")
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:cuadrantes")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' Dónde va el rótulo de cada punto sin pisar a otro ni a los puntos
#'
#' Hasta dos líneas en 2.4 in. Se prueba a la derecha del punto y a la izquierda, subiendo o bajando de a media línea;
#' gana la primera posición libre dentro del área. Si ninguna lo está, queda a la derecha (el aviso lo dice el QA visual).
#' @keywords internal
.lam_cuadrantes_rotulos <- function(espec, px, py, xl, wl, yt, hy, size = 11) {
  wmax <- 2.4
  cajas <- lapply(seq_along(espec$temas), function(i) c(px(espec$x[i]) - 0.11, py(espec$y[i]) - 0.11, 0.22, 0.22))
  # Los rótulos de las dos líneas («Promedio 76%») también son obstáculos.
  cajas <- c(cajas, list(c(xl + wl - 1.6, py(espec$cy) + 0.04, 1.6, 0.24)))
  choques <- function(b, otras) sum(vapply(otras, function(o) b[1] < o[1] + o[3] && o[1] < b[1] + b[3] && b[2] < o[2] + o[4] && o[2] < b[2] + b[4], logical(1)))
  orden <- order(espec$y, decreasing = TRUE)
  res <- vector("list", length(espec$temas))
  for (i in orden) {
    s <- espec$temas[i]
    w <- min(wmax, .lam_ancho_tinta(s, size) + 0.26)   # el cuadro deja 0.1 in de margen por lado
    h <- .lam_lineas_tinta(s, wmax, size) * size * 1.2 / 72 + 0.08
    xp <- px(espec$x[i]); yp <- py(espec$y[i])
    candidatos <- list()
    for (dy in c(0, -0.18, 0.18, -0.36, 0.36, -0.54, 0.54)) {
      candidatos[[length(candidatos) + 1L]] <- list(l = xp + 0.13, t = yp - h / 2 + dy, w = w, h = h, align = "left")
      candidatos[[length(candidatos) + 1L]] <- list(l = xp - 0.13 - w, t = yp - h / 2 + dy, w = w, h = h, align = "right")
    }
    dentro <- function(c0) c0$l >= xl - 0.05 && c0$l + c0$w <= xl + wl + 0.05 && c0$t >= yt - 0.05 && c0$t + c0$h <= yt + hy + 0.05
    otras <- c(cajas[-i], Filter(Negate(is.null), lapply(res, function(r) if (is.null(r)) NULL else c(r$l, r$t, r$w, r$h))))
    validos <- Filter(dentro, candidatos)
    if (!length(validos)) validos <- candidatos
    n <- vapply(validos, function(c0) choques(c(c0$l, c0$t, c0$w, c0$h), otras), numeric(1))
    res[[i]] <- validos[[which.min(n)]]   # el primero libre; si ninguno, el que menos pisa dentro del área
    res[[i]]$choques <- min(n)
  }
  res
}
