# Diferencias significativas entre públicos: tabla de letras y paneles de diferencia (recetario p111–p112; inventario de
# configuraciones, ítem 18).
#
# Por tema, el porcentaje de cada público (Top Two Box o «Sí»: las respuestas de `corte`), la letra del público al que
# supera de forma significativa y, por cada par de públicos, la diferencia con su intervalo. El método es el del recetario
# (propuestas_rescatables.R:190-215) y el de las tablas de cruces del motor:
#   - prueba z con proporción combinada para cada par, Bonferroni dentro de la fila, α = 0.05: la de
#     `comparar_columnas_sig` (reporte_cruces.R), salvo que aquí un público con 0 % o 100 % también entra en la prueba,
#     como en el recetario. Las letras y los paneles salen de los mismos valores p ajustados, así que no se contradicen;
#   - intervalo de la diferencia de Newcombe (1998), híbrido de Wilson, al nivel ajustado por Bonferroni;
#   - lectura (Gardner y Altman 1986): si el intervalo no cruza el cero, la diferencia es significativa.

#' Intervalo de Wilson de una proporción
#' @keywords internal
.sigpub_wilson <- function(x, n, z) {
  p <- x / n; c_ <- (p + z^2 / (2 * n)) / (1 + z^2 / n)
  h <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / (1 + z^2 / n)
  c(c_ - h, c_ + h)
}

#' Intervalo de Newcombe (híbrido de Wilson) de la diferencia p1 − p2, al nivel `conf`
#' @keywords internal
.sigpub_newcombe <- function(x1, n1, x2, n2, conf) {
  z <- stats::qnorm(1 - (1 - conf) / 2); p1 <- x1 / n1; p2 <- x2 / n2
  w1 <- .sigpub_wilson(x1, n1, z); w2 <- .sigpub_wilson(x2, n2, z); d <- p1 - p2
  c(d - sqrt((p1 - w1[1])^2 + (w2[2] - p2)^2), d + sqrt((w1[2] - p1)^2 + (p2 - w2[1])^2))
}

#' Valor p de la prueba z con proporción combinada (la de `comparar_columnas_sig`)
#' @keywords internal
.sigpub_z <- function(x1, n1, x2, n2) {
  pp <- (x1 + x2) / (n1 + n2); se <- sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2))
  if (!is.finite(se) || se <= 0) return(NA_real_)
  2 * stats::pnorm(-abs((x1 / n1 - x2 / n2) / se))
}

#' El cálculo de la lámina, puro: `x` y `n` son matrices tema × público (casos que suman y base de cada público)
#'
#' Devuelve el porcentaje, las letras y, por par, la diferencia en puntos con su intervalo
#' ajustado y si es significativa. Un par sin base o con una proporción en 0 o 1 en los dos lados queda sin prueba (NA).
#' @keywords internal
.sigpub_calcular <- function(x, n, alpha = 0.05) {
  K <- ncol(x); pares <- utils::combn(K, 2); npar <- ncol(pares)
  p <- ifelse(n > 0, x / n, NA_real_)
  d <- lo <- hi <- pv <- matrix(NA_real_, nrow(x), npar)
  for (i in seq_len(nrow(x))) for (k in seq_len(npar)) {
    a <- pares[1, k]; b <- pares[2, k]
    if (!(n[i, a] > 0 && n[i, b] > 0)) next
    d[i, k] <- 100 * (p[i, a] - p[i, b])
    pv[i, k] <- .sigpub_z(x[i, a], n[i, a], x[i, b], n[i, b])
    ci <- .sigpub_newcombe(x[i, a], n[i, a], x[i, b], n[i, b], 1 - alpha / npar)
    lo[i, k] <- 100 * ci[1]; hi[i, k] <- 100 * ci[2]
  }
  padj <- t(apply(pv, 1, stats::p.adjust, method = "bonferroni"))
  if (npar == 1L) padj <- matrix(padj, ncol = 1L)
  sig <- !is.na(padj) & padj < alpha
  # La letra va en el público mayor del par significativo y nombra al menor.
  letras <- matrix("", nrow(x), K)
  for (i in seq_len(nrow(x))) for (k in seq_len(npar)) if (sig[i, k]) {
    a <- pares[1, k]; b <- pares[2, k]
    if (p[i, a] > p[i, b]) letras[i, a] <- paste0(letras[i, a], LETTERS[b]) else letras[i, b] <- paste0(letras[i, b], LETTERS[a])
  }
  list(p = 100 * p, letras = letras, pares = pares, d = d, lo = lo, hi = hi, sig = sig, padj = padj)
}

#' Diferencias significativas entre públicos
#'
#' @param vars Temas: lista nombrada tema -> preguntas, una por público (`"docentes$p1"`, `"estudiantes$p1"`…).
#' @param corte Las respuestas que suman el porcentaje (Top Two Box o «Sí»), por rótulo o código.
#' @param alpha Nivel de significancia (0.05).
#' @param titulo,overrides,base,filtros Como en los demás gráficos.
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_significancia_publicos <- function(vars, corte, alpha = 0.05, titulo = NULL, overrides = list(), base = list(), filtros = list()) {
  if (!is.list(vars) || is.null(names(vars)) || !length(vars)) .plan_spec_abort("`vars` debe ser una lista nombrada de temas.")
  vars <- lapply(vars, function(v) trimws(as.character(unlist(v))))
  corte <- trimws(as.character(unlist(corte %||% character(0))))
  corte <- unlist(strsplit(corte[nzchar(corte)], "\\s*,\\s*"))
  if (!length(corte)) .plan_spec_abort("`corte` debe nombrar las respuestas que suman (Top Two Box o «Sí»).")
  alpha <- suppressWarnings(as.numeric(alpha)[1]); if (!is.finite(alpha) || alpha <= 0 || alpha >= 0.5) alpha <- 0.05
  el <- list(.element_type = "significancia_publicos", vars = vars, corte = corte, alpha = alpha,
             title_slide = .ppt_norm_text1(titulo, blank = NULL), overrides = overrides, base = base,
             filtros = .ppt_norm_filters(filtros))
  class(el) <- c("ppt_element", "list")
  el
}

#' Render: casos y base de cada público por tema, el cálculo y la espec de la lámina
#' @keywords internal
.render_significancia_publicos <- function(el, preset_args = list()) {
  tab_freq <- dynGet(".tab_freq", ifnotfound = NULL); resolver <- dynGet(".resolve_ref", ifnotfound = NULL)
  lista_de <- dynGet(".list_name_from_ctx", ifnotfound = NULL); bonito <- dynGet(".pretty_source_label", ifnotfound = function(s) s)
  if (!is.function(tab_freq) || !is.function(resolver) || !is.function(lista_de)) stop("El render no expone el motor de láminas.", call. = FALSE)
  refs <- unlist(el$vars, use.names = FALSE)
  fuentes <- unique(vapply(refs, function(r) resolver(r)$source, character(1)))
  if (length(fuentes) < 2L) stop("Diferencias entre públicos: los temas necesitan preguntas de al menos dos bases.", call. = FALSE)
  temas <- names(el$vars)
  x <- n <- matrix(0, length(temas), length(fuentes), dimnames = list(temas, fuentes))
  for (i in seq_along(temas)) for (r in el$vars[[i]]) {
    ctx <- resolver(r)
    tab <- tab_freq(r, filtros = el$filtros %||% list())
    if (is.null(tab) || !nrow(tab)) next
    op <- trimws(as.character(tab$Opciones)); cnt <- suppressWarnings(as.numeric(tab$n))
    es_total <- op == "Total"
    niveles <- .reporte_plan_choice_levels_for_list(lista_de(ctx), ctx$choices)
    rotulos <- unique(c(el$corte, niveles$label[niveles$code %in% el$corte]))
    x[i, ctx$source] <- sum(cnt[!es_total & op %in% rotulos], na.rm = TRUE)
    n[i, ctx$source] <- if (any(es_total)) cnt[es_total][1] else sum(cnt, na.rm = TRUE)
  }
  r <- .sigpub_calcular(x, n, alpha = el$alpha)
  publicos <- vapply(fuentes, function(s) as.character(bonito(s)), character(1))
  letra <- LETTERS[seq_along(fuentes)]
  par_et <- apply(r$pares, 2, function(ab) sprintf("%s menos %s", letra[ab[1]], letra[ab[2]]))
  par_sub <- apply(r$pares, 2, function(ab) sprintf("%s y %s", publicos[ab[1]], tolower(publicos[ab[2]])))
  # Ruta anterior: un punto por diferencia con su intervalo, un panel por par.
  df <- do.call(rbind, lapply(seq_len(ncol(r$pares)), function(k) data.frame(tema = factor(temas, levels = rev(temas)), par = par_et[k],
    d = r$d[, k], lo = r$lo[, k], hi = r$hi[, k], sig = r$sig[, k])))
  p <- ggplot2::ggplot(df, ggplot2::aes(x = .data$d, y = .data$tema)) +
    ggplot2::geom_vline(xintercept = 0, colour = "#8C8C8C") +
    ggplot2::geom_errorbarh(ggplot2::aes(xmin = .data$lo, xmax = .data$hi), height = 0) +
    ggplot2::geom_point(ggplot2::aes(shape = .data$sig), size = 2.6) +
    ggplot2::scale_shape_manual(values = c(`TRUE` = 16, `FALSE` = 1), guide = "none") +
    ggplot2::facet_wrap(~par) + ggplot2::labs(x = "Diferencia en puntos", y = NULL) + ggplot2::theme_minimal()
  attr(p, "pulso_espec") <- list(version = "significancia/1", tipo = "significancia", temas = temas, publicos = publicos, letras_publico = letra,
                                 p = r$p, letras = r$letras, par_etiqueta = par_et, par_publicos = par_sub,
                                 d = r$d, lo = r$lo, hi = r$hi, sig = r$sig, n = n, alpha = el$alpha)
  p
}
