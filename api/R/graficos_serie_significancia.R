# =============================================================================
# graficos_serie_significancia.R — letras de significancia en la serie por niveles (L10-9, bandeja CCSS 2026-10-24)
# =============================================================================
#
# En CCSS Perfil 2026 la serie por nivel (`p_serie_temporal(cruce =)`, graficos_serie_cruce.R) reemplazó a una apilada
# por nivel que traía letras de significancia, y las perdía. Gonzalo: los cruces se muestran con su prueba.
#
# No se reimplementa nada. Cada punto es el porcentaje del indicador entre los que respondieron en ese nivel, con el peso
# de la base (`.radar_mb_pct`): la matriz de la prueba es «casos del indicador» (valor × base) sobre «base» por nivel,
# una fila por tema, y la prueba es la de las tablas de cruces y de las apiladas (`.graficos_sig_calcular` →
# `comparar_columnas_sig`: z de diferencia de proporciones, Bonferroni dentro de la fila, α = 0,05). La letra de un punto
# nombra a los niveles a los que supera, en el orden del eje (A = el primer nivel). La nota es la de la casa
# (`.graficos_sig_nota`) y la lámina la escribe sobre «Base:» (lamina_nota_significancia.R).

#' ¿La serie pide significancia? Devuelve `list(activo, alpha)` con el α saneado
#' @keywords internal
.serie_sig_config <- function(args) {
  alpha <- suppressWarnings(as.numeric(args$significancia_alpha %||% 0.05)[1])
  if (!is.finite(alpha) || alpha <= 0 || alpha >= 1) alpha <- 0.05
  list(activo = isTRUE(args$mostrar_significancia), alpha = alpha)
}

#' Letras de significancia de la serie por niveles
#'
#' @param datos Resultado de `.serie_cruce_datos()` (`eje`, `grupo`, `valor` en 0-100, `n` ponderado).
#' @param temas Lista `etiqueta -> ref` de la serie.
#' @param sources Fuentes del estudio (para saber si la pregunta vive en un repeat).
#' @param cruce Ref del cruce.
#' @return `list(sufijo, nota)`: `sufijo` alineado con las filas de `datos` (" AB" o ""), y la nota de la prueba.
#' @keywords internal
.serie_sig_letras <- function(datos, temas, sources, cruce, alpha = 0.05) {
  niveles <- levels(datos$grupo)
  cx <- .graficos_consolidado_ref_context(.serie_cruce_ref(cruce, sources), sources)
  inst <- (sources$inst_sources %||% list())[[cx$source]]
  sufijo <- rep("", nrow(datos))
  motivo <- NULL; hay <- FALSE
  for (tema in levels(datos$eje)) {
    filas <- which(as.character(datos$eje) == tema)
    d <- datos[filas, , drop = FALSE]
    pos <- match(niveles, as.character(d$grupo))
    N <- ifelse(is.na(pos), 0, d$n[pos]); N[!is.finite(N)] <- 0
    x <- ifelse(is.na(pos), 0, d$valor[pos] / 100 * d$n[pos]); x[!is.finite(x)] <- 0
    n_mat <- matrix(x, nrow = 1, dimnames = list(tema, niveles))
    ref <- .serie_cruce_ref(as.character(unlist(temas[[tema]]))[1], sources, cx$source)
    var <- .graficos_consolidado_ref_context(ref, sources)$resolved_variable
    res <- .graficos_sig_calcular(n_mat, stats::setNames(N, niveles), alpha = alpha, diseno = .graficos_sig_diseno_de_fuente(inst, var))
    if (!is.null(res$motivo)) { motivo <- motivo %||% res$motivo; next }
    suf <- .graficos_sig_sufijos(res$letras)
    if (is.null(suf) || !nrow(suf)) next
    hay <- TRUE
    k <- match(suf$.col_pct, as.character(d$grupo))
    sufijo[filas[k[!is.na(k)]]] <- suf$.sufijo[!is.na(k)]
  }
  nota <- .graficos_sig_nota(niveles, alpha = alpha, motivo = if (!hay) motivo else NULL, hay_letras = hay)
  list(sufijo = sufijo, nota = nota)
}

#' Sin cruce, la serie compara mediciones (bases) y no se marca: se avisa si se pidió
#' @keywords internal
.serie_sig_sin_cruce <- function(mostrar_significancia) {
  if (isTRUE(mostrar_significancia)) {
    .pulso_aviso(.aviso_en_lamina(paste0(
      "la serie no marca diferencias significativas entre mediciones: las letras se calculan entre los niveles de un cruce ",
      "(«Evolución por los niveles de»).")))
  }
  invisible(NULL)
}

#' La lámina ggplot del recetario con la nota de significancia reservada sobre «Base:» (enganche de `.lam_laminas_ggplot`)
#'
#' La zona de datos sube lo que mide la nota (`.lam_con_nota_sig`) y la nota se escribe en cada lámina; el gráfico se
#' compone sin la marca para no volver a entrar aquí.
#' @keywords internal
.lam_ggplot_con_nota_sig <- function(doc, p, espec, titulo, ante, base, folio, sub, layout, master, por_lamina) {
  nota <- .lam_nota_sig_de(p)
  attr(p, "pulso_sig_nota") <- NULL
  .lam_con_nota_sig(nota, por_lamina, function(por_lamina) {
    .lam_laminas_ggplot(doc, p, espec, titulo, ante = ante, base = base, folio = folio, sub = sub, layout = layout, master = master,
                        por_lamina = por_lamina)
  })
}
