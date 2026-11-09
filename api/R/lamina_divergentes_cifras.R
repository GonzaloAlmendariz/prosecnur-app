# =============================================================================
# lamina_divergentes_cifras.R — las cifras de una fila de la escala del resumen (lámina y ranura)
# =============================================================================
#
# H3 (resumen de Arte, láminas 4 y 5, 2026-11-09): con la regla P16 una cifra interior que no cabía no se escribía, y
# faltaban «En desacuerdo» de 10 %, 9 %, 6 % y 4 %. Un 10 % que falta se nota. El resumen original las escribe fuera.
#
# Regla de la casa:
#   - dentro de su segmento si cabe con su tinta más 0.12 in (`.lam_tiene_peq`);
#   - si no, fuera de la barra, en negrita y con el color de su segmento oscurecido. La del extremo va pegada a la
#     barra (como siempre); la de un segmento interior va a continuación, hacia afuera (a la izquierda de la cifra de
#     fuera del extremo en el lado del desacuerdo, a la derecha en el del acuerdo), sin pisarla;
#   - una cifra interior se omite sólo si de verdad no queda sitio: su tinta pasaría del límite del lado (la columna de
#     las afirmaciones a la izquierda, la de «Sin información» a la derecha).
# Un segmento neutro, montado sobre el eje, no saca su cifra: si no cabe dentro no se escribe.

#' Separación entre dos cifras de fuera seguidas, de tinta a tinta (además de la calle de la caja), en pulgadas
#' @keywords internal
.LAM_CIFRA_ENTRE_IN <- 0.03

#' Dónde va cada cifra de una fila de la escala: dentro, fuera u omitida
#'
#' @param segs Lista de segmentos `list(k, x, w, lado)` de la fila (neu, neg del eje hacia afuera, pos del eje hacia
#'   afuera), como los arman la lámina y la ranura.
#' @param u Fila de unidades (`U[i, ]`); un segmento en cero no se dibuja.
#' @param cifras Fila de cifras (`X[i, ]`).
#' @param pt Letra de las cifras.
#' @param lim_izq,lim_der Hasta dónde puede llegar la tinta de una cifra de fuera por cada lado.
#' @return data.frame con `k`, `modo` (`"dentro"`, `"fuera_izq"`, `"fuera_der"`, `"omitida"`), `borde` (para fuera: el
#'   `x_extremo` de `.lam_cifra_fuera_x`) y `extremo` (lógico).
#' @keywords internal
.lam_div_cifras_fila <- function(segs, u, cifras, pt, lim_izq = -Inf, lim_der = Inf) {
  vivos <- Filter(function(sg) u[[sg$k]] > 0, segs)
  out <- data.frame(k = integer(0), modo = character(0), borde = numeric(0), extremo = logical(0), stringsAsFactors = FALSE)
  if (!length(vivos)) return(out)
  cabe <- function(sg) sg$w >= .lam_ancho_txt(cifras[[sg$k]], pt, TRUE) + 0.12
  fila <- function(k, modo, borde = NA_real_, extremo = FALSE) data.frame(k = k, modo = modo, borde = borde, extremo = extremo, stringsAsFactors = FALSE)
  for (sg in vivos) if (cabe(sg) || identical(sg$lado, "neu")) out <- rbind(out, fila(sg$k, if (cabe(sg)) "dentro" else "omitida"))
  for (lado in c("neg", "pos")) {
    del_lado <- Filter(function(sg) identical(sg$lado, lado), vivos)
    if (!length(del_lado)) next
    ext <- del_lado[[length(del_lado)]]
    # Frente libre: el extremo de la barra; cada cifra de fuera lo corre hacia afuera lo que ocupa su tinta.
    frente <- if (identical(lado, "neg")) ext$x else ext$x + ext$w
    calle <- .LAM_CIFRA_CALLE_IN
    # Del extremo hacia el eje: el extremo va pegado a la barra y las interiores, a continuación.
    for (j in rev(seq_along(del_lado))) {
      sg <- del_lado[[j]]; es_ext <- j == length(del_lado)
      if (cabe(sg)) next
      tinta <- .lam_ancho_tinta(cifras[[sg$k]], pt, TRUE)
      if (identical(lado, "neg")) {
        hasta <- frente - calle - tinta
        if (!es_ext && hasta < lim_izq) { out <- rbind(out, fila(sg$k, "omitida")); next }
        out <- rbind(out, fila(sg$k, "fuera_izq", frente, es_ext)); frente <- hasta - .LAM_CIFRA_ENTRE_IN
      } else {
        hasta <- frente + calle + tinta
        if (!es_ext && hasta > lim_der) { out <- rbind(out, fila(sg$k, "omitida")); next }
        out <- rbind(out, fila(sg$k, "fuera_der", frente, es_ext)); frente <- hasta + .LAM_CIFRA_ENTRE_IN
      }
    }
  }
  out
}

#' Dibuja las cifras de una fila de la escala según `.lam_div_cifras_fila`
#' @param h_caja,w_caja Alto de la caja de una cifra y ancho de la de fuera.
#' @keywords internal
.lam_div_cifras_dibujar <- function(lz, segs, u, cifras, colores, pt, yc, h_caja, w_caja, lim_izq = -Inf, lim_der = Inf) {
  plan <- .lam_div_cifras_fila(segs, u, cifras, pt, lim_izq, lim_der)
  azul <- .std_color("azul")
  por_k <- stats::setNames(segs, vapply(segs, function(sg) as.character(sg$k), ""))
  for (r in seq_len(nrow(plan))) {
    k <- plan$k[r]; sg <- por_k[[as.character(k)]]; cifra <- cifras[[k]]; y <- .lam_y_centrada(yc, pt)
    switch(plan$modo[r],
      dentro = .lam_txt(lz, cifra, sg$x - 0.2, y, sg$w + 0.4, h_caja, pt, azul, align = "center", nombre = "divergentes:cifra"),
      fuera_izq = .lam_txt(lz, cifra, .lam_cifra_fuera_x(plan$borde[r], w_caja, "izq"), y, w_caja, h_caja, pt, .lam_oscurecer(colores[[k]]),
                           bold = TRUE, align = "right", nombre = "divergentes:cifra_fuera"),
      fuera_der = .lam_txt(lz, cifra, .lam_cifra_fuera_x(plan$borde[r], w_caja, "der"), y, w_caja, h_caja, pt, .lam_oscurecer(colores[[k]]),
                           bold = TRUE, nombre = "divergentes:cifra_fuera"),
      NULL)
  }
  invisible(plan)
}
