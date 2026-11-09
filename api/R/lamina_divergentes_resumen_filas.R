# =============================================================================
# lamina_divergentes_resumen_filas.R — la escala del resumen usa el ancho y el alto que tiene (P11)
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre «Escala de docentes sin regla» (20 filas): «tiene más ancho a la izquierda y no lo usan,
# tiene alto y no lo usan». Cada afirmación salía en una línea con «…», con una pulgada libre a la izquierda de la
# columna de rótulos y alto libre bajo el gráfico. Con el estándar de la casa:
#   1. La columna de rótulos toma el ancho libre desde el margen de la lámina (sin el tope fijo de 4.2 in), sin dejar la
#      escala por debajo de 4.5 in.
#   2. Las afirmaciones van enteras en dos o tres líneas; las filas crecen hasta su máximo antes de cortar texto.
#   3. «…» sólo si ni tres líneas a 10.5 pt bastan, con el corte al medio que conserva el final y nunca deja dos rótulos
#      iguales (`.lam_rr_recortar_lote`).
#   4. Si todas las filas no caben así, se muestran menos —las primeras en la prioridad de la regla, la misma del recorte
#      por espacio (P7)— antes que cortar a una línea, y el pie lo dice en la frase de la regla.

#' La prioridad y la regla en la especificación de la escala del resumen (para que la lámina pueda mostrar menos)
#' @param refs_orden Rótulos de las filas en el orden en que llegaron (el de la regla o, sin regla, el de su métrica).
#' @keywords internal
.divergentes_recorte_en_espec <- function(p, el, ap, refs_orden) {
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (!is.list(espec)) return(p)
  sin_regla <- is.null(el$regla)
  espec$prioridad <- match(espec$filas, refs_orden)
  # Sin regla, la prioridad es la métrica que dibuja la lámina: el Top Two Box de la más baja a la más alta, con el
  # desempate sin redondear (lead, 2026-11-09), nunca el orden en que se declararon.
  if (sin_regla && !is.null(espec$total_pos)) {
    pos <- espec$categorias$lado == "pos"
    fino <- if (is.matrix(espec$proporciones)) rowSums(espec$proporciones[, pos, drop = FALSE]) else espec$total_pos
    o <- order(espec$total_pos, round(fino, 8L), seq_along(espec$filas))
    espec$prioridad <- integer(length(o)); espec$prioridad[o] <- seq_along(o)
  }
  espec$recorte_escala <- list(
    regla = el$regla,
    n = if (sin_regla) el$.n_sin_recorte %||% length(espec$filas) else ap$n_elegidas %||% length(espec$filas),
    total = ap$total, universo = ap$universo %||% "preguntas de escala",
    texto_base = if (sin_regla) el$.texto_tope else ap$texto_base,
    criterio = if (sin_regla) "más bajas" else NULL)
  attr(p, "pulso_espec") <- espec
  p
}

#' Elige letra, ancho de columna, filas y alturas de la escala del resumen (ver la cabecera)
#'
#' @param disponible Alto para las filas. @param w_max Ancho máximo de la columna de rótulos.
#' @return Lista como la de `prueba` de `.lam_div_resumen_geom` más `filas` (índices que se dibujan, en el orden de la
#'   lámina) y `n_total`; `NULL` si ni una fila cabe.
#' @keywords internal
.lam_div_resumen_filas_elegir <- function(espec, disponible, w_max, u_min = 0.2, u_max = 0.52) {
  n <- length(espec$filas)
  if (!n || w_max < 2.2) return(NULL)
  pr <- suppressWarnings(as.integer(espec$prioridad))
  idx <- if (length(pr) == n && !anyNA(pr)) order(pr, seq_len(n)) else seq_len(n)
  piso <- .LAM_ROTULO_PT_PISO
  # 3. Lo que ni en tres líneas a 10.5 pt cabe se corta al medio (sin dejar dos iguales); lo demás va entero.
  largo <- vapply(espec$filas, function(t) isTRUE(.lam_rotulo_recortar(t, w_max, piso, 3L)$recortado), TRUE)
  textos <- espec$filas
  if (any(largo)) textos[largo] <- vapply(.lam_rr_recortar_lote(espec$filas[largo], w_max, piso, 3L), `[[`, "", "texto")
  prueba <- function(tx, size, w) {
    rr <- lapply(tx, function(t) .lam_rotulo_recortar(t, w, size, 3L))
    if (any(vapply(rr, `[[`, TRUE, "recortado"))) return(NULL)
    # P15: cada fila mide su rótulo más un hueco común (el mismo entre todas), hasta que una fila de una línea llegue al
    # paso máximo de la casa (lamina_filas_hueco.R).
    texto_h <- vapply(rr, function(r) length(r$lineas), 0L) * size * 1.2 / 72
    hu <- .lam_filas_hueco_uniforme(texto_h, disponible, hueco_min = max(0.04, u_min - min(texto_h)), hueco_max = max(0.04, u_max - min(texto_h)))
    if (is.null(hu)) return(NULL)
    list(size = size, wq = w, u = min(hu$alturas), alturas = hu$alturas, textos = vapply(rr, `[[`, "", "texto"), lineas = 3L,
         texto_h = texto_h, hueco = hu$hueco)
  }
  # 4. Todas las filas si caben enteras; si no, una menos cada vez, en el orden de la prioridad.
  for (k in rev(seq_len(n))) {
    filas <- sort(idx[seq_len(k)])
    tx <- textos[filas]
    for (size in .lam_rotulo_pasos_pt(12)) {
      tinta <- max(vapply(tx, function(t) .lam_ancho_tinta(t, size, FALSE), 0))
      w0 <- min(w_max, max(2.2, tinta + 0.25))
      for (w in unique(c(seq(w0, w_max, by = 0.2), w_max))) {
        e <- prueba(tx, size, w)
        if (!is.null(e)) return(c(e, list(filas = filas, n_total = n, recortados = sum(largo[filas]))))
      }
    }
  }
  NULL
}

#' La escala con sólo algunas de sus filas (todas las piezas por fila, en el mismo orden)
#' @keywords internal
.lam_div_resumen_subset <- function(espec, filas) {
  n <- length(espec$filas)
  fijos <- c("categorias", "orden_neg", "orden_pos", "decimales", "version", "tipo", "estilo", "texto_regla", "nota_porcentaje",
             "recorte_escala", "firma_leyenda")
  for (nm in setdiff(names(espec), fijos)) {
    x <- espec[[nm]]
    if (is.matrix(x) && nrow(x) == n) espec[[nm]] <- x[filas, , drop = FALSE]
    else if (is.atomic(x) && !is.matrix(x) && length(x) == n) espec[[nm]] <- x[filas]
  }
  espec
}

#' La nota de la escala cuando la lámina muestra `k` de sus filas: la frase de la regla dice cuántas, en una frase
#' @keywords internal
.lam_div_resumen_texto <- function(espec, k) {
  rc <- espec$recorte_escala
  if (is.null(rc)) return(.tope_espacio_unir(espec$texto_regla, .tope_espacio_texto(k, length(espec$filas), "primeras")))
  n <- rc$n %||% length(espec$filas)
  frase <- if (!is.null(rc$regla)) {
    .tope_espacio_frase(rc$regla, k, n, universo = rc$universo %||% "preguntas de escala", total = rc$total)
  } else if (identical(rc$criterio, "más bajas")) {
    sprintf("Se muestran las %d más bajas %s; el resto en otra lámina.", k, .regla_preguntas_de_total(n, "preguntas de escala"))
  } else .tope_espacio_texto(k, n, "primeras")
  viejo <- rc$texto_base
  actual <- espec$texto_regla
  if (!is.null(viejo) && nzchar(viejo) && !is.null(actual) && grepl(viejo, actual, fixed = TRUE)) return(sub(viejo, frase, actual, fixed = TRUE))
  .tope_espacio_unir(actual, frase)
}
