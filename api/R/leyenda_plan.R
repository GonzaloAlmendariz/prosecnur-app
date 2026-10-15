# =============================================================================
# leyenda_plan.R — cómo se acomoda una leyenda en su ancho: una sola medida para la lámina y el Word (O8b)
# =============================================================================
#
# Decisión de Gonzalo (2026-10-15, O8 de docs/qa/checklist-revamp-informe-graficos-2026-10-14.md): la leyenda se elige en
# Identidad › Letra como Automática, Una fila o Dos filas equilibradas, con UNA función de medida para la lámina nativa y
# las figuras del Word, el orden por filas en secuencia (1-2-3 / 4-5) y cada fila centrada.
#
# Lo que había: la lámina dibujaba una fila a 12 pt que sólo achicaba el espacio y nunca la letra, y en los paneles de
# media columna pasaba a dos filas que podían salirse del panel (5 rótulos de escala largos en 6,01 in: ~0,5 in de
# desborde) sin que ninguna compuerta lo viera; el Word partía en dos filas si los rótulos sumaban más de 90 caracteres,
# sin medir.
#
# `.leyenda_plan()` es pura: mide con `medir(labels, size, bold)` y devuelve el reparto. Quien dibuja coloca cada fila
# centrada (`.leyenda_x_fila`) y quien decide si la lámina cabe lee `cabe`.

#' Reparto en `k` filas seguidas y equilibradas: las primeras llevan uno más (5 en 2 → 1-2-3 / 4-5)
#' @param rejilla Reparto de `ggplot2::guide_legend(nrow = k, byrow = TRUE)`: `ceiling(n / k)` por fila (7 en 3 → 3-3-1).
#' @keywords internal
.leyenda_reparto <- function(n, k, rejilla = FALSE) {
  if (!n) return(list())
  k <- min(max(1L, as.integer(k)), n)
  ids <- if (isTRUE(rejilla)) ceiling(seq_len(n) / ceiling(n / k)) else .barras_leyenda_reparto(n, k)
  unname(split(seq_len(n), ids))
}

#' Plan de una leyenda: tamaño de letra, filas y si cabe en su ancho
#'
#' Modos (`.LEYENDA_MODOS`):
#' - `"automatica"`: una fila al tamaño estándar si cabe (el espacio baja de `gap_max` hasta `gap_una_fila_min`); si no,
#'   filas equilibradas en orden de lectura: dos y, si hace falta, tres.
#' - `"una_fila"`: una fila; primero achica el espacio hasta `gap_min` y después la letra, de `paso_pt` en `paso_pt`,
#'   hasta `piso_pt`. Si ni así cabe, cae a filas equilibradas al tamaño estándar y lo dice en `aviso`.
#' - `"dos_filas"`: dos filas equilibradas (con tres o más ítems; con uno o dos, como la automática); tres si dos no caben.
#' @param labels Rótulos de la leyenda, en su orden.
#' @param ancho_in Ancho disponible en pulgadas.
#' @param size_pt Tamaño estándar de la letra.
#' @param bold ¿El texto va en negrita? Se mide con ella (negrita por elemento, O8a).
#' @param piso_pt Letra mínima de `"una_fila"`.
#' @param gap_min,gap_max Espacio entre ítems de una fila, en pulgadas: el natural y el mínimo al que se aprieta.
#' @param gap_una_fila_min Mínimo del espacio para dar por buena UNA fila en la automática (la leyenda de panel de hoy no
#'   aprieta la fila única: pasa a dos con 0,3 in).
#' @param cuadro_in Lo que suma cada ítem además de su texto (el cuadrito y su aire).
#' @param factor Corrección de la medida del texto (el Word mide con grid, ~7 % más ancho que `systemfonts`).
#' @param rejilla Las filas comparten columnas, como `ggplot2::guide_legend()`: el ancho de una fila es la suma de las
#'   columnas más anchas de todas las filas.
#' @param medir `function(labels, size, bold)` → anchos en pulgadas.
#' @return `list(size, filas = list(índices), anchos = ancho del texto de cada rótulo, items, gaps = por fila,
#'   totales = por fila, cabe, aviso = chr o NULL, modo)`.
#' @keywords internal
.leyenda_plan <- function(labels, ancho_in, size_pt, modo = "automatica", bold = FALSE, piso_pt = size_pt,
                          gap_min = 0.15, gap_max = 0.3, gap_una_fila_min = gap_min, cuadro_in = 0.22, factor = 1,
                          rejilla = FALSE, max_filas = 3L, paso_pt = 0.5, medir = .lam_ancho_tinta) {
  labels <- as.character(labels %||% character(0)); n <- length(labels)
  modo <- as.character(modo %||% "automatica")[1]; if (!modo %in% .LEYENDA_MODOS) modo <- "automatica"
  vacio <- list(size = size_pt, filas = list(), anchos = numeric(0), items = numeric(0), gaps = numeric(0), totales = numeric(0),
                cabe = TRUE, aviso = NULL, modo = modo)
  if (!n) return(vacio)
  medida <- function(size) as.numeric(medir(labels, size, isTRUE(bold))) * factor
  # Una fila de índices `idx` con espacio que baja hasta `gmin`: total y espacio, o NULL si no cabe.
  fila <- function(items, idx, gmin, col = NULL) {
    w <- if (is.null(col)) items[idx] else col[seq_along(idx)]
    s <- sum(w); m <- length(idx)
    if (m <= 1L) return(if (s <= ancho_in + 1e-9) list(gap = gap_max, tot = s) else NULL)
    g <- min(gap_max, (ancho_in - s) / (m - 1))
    if (g < gmin - 1e-9) return(NULL)
    list(gap = g, tot = s + g * (m - 1))
  }
  probar <- function(size, k, gmin) {
    anchos <- medida(size); items <- cuadro_in + anchos
    filas <- .leyenda_reparto(n, k, rejilla = rejilla && k > 1L)
    col <- if (rejilla && k > 1L) vapply(seq_along(filas[[1]]), function(j) max(items[vapply(filas, function(f) if (j <= length(f)) f[j] else NA_integer_, 1L)], na.rm = TRUE), 0) else NULL
    r <- lapply(filas, function(f) fila(items, f, gmin, col))
    ok <- !any(vapply(r, is.null, TRUE))
    # Sin caber, se informa el reparto con el espacio mínimo (lo que mediría la fila apretada al máximo).
    gaps <- vapply(seq_along(filas), function(i) if (is.null(r[[i]])) gmin else r[[i]]$gap, 0)
    tots <- vapply(seq_along(filas), function(i) {
      w <- if (is.null(col)) items[filas[[i]]] else col[seq_along(filas[[i]])]
      sum(w) + gaps[i] * (length(filas[[i]]) - 1L)
    }, 0)
    list(size = size, filas = filas, anchos = anchos, items = items, gaps = gaps, totales = tots, cabe = ok, aviso = NULL, modo = modo)
  }
  filas_equilibradas <- function(desde) {
    tope <- min(n, max(desde, as.integer(max_filas)))
    for (k in seq.int(desde, tope)) { p <- probar(size_pt, k, gap_min); if (p$cabe) return(p) }
    probar(size_pt, tope, gap_min)
  }
  if (identical(modo, "una_fila")) {
    piso <- min(size_pt, piso_pt)
    for (size in unique(c(seq(size_pt, piso, by = -abs(paso_pt)), piso))) {
      p <- probar(size, 1L, gap_min); if (p$cabe) return(p)
    }
    p <- if (n > 1L) filas_equilibradas(2L) else probar(size_pt, 1L, gap_min)
    p$aviso <- sprintf("La leyenda no cabe en una fila ni a %s pt: va en %d filas.", format(piso), length(p$filas))
    return(p)
  }
  if (identical(modo, "dos_filas") && n >= 3L) return(filas_equilibradas(2L))
  p <- probar(size_pt, 1L, gap_una_fila_min)
  if (p$cabe || n == 1L) return(p)
  filas_equilibradas(2L)
}

#' Avisa al job (`.pulso_aviso`, deduplicado) cuando «una fila» no se pudo cumplir; sin aviso no hace nada
#' @keywords internal
.leyenda_avisar <- function(plan) {
  if (length(plan$aviso) && nzchar(plan$aviso[1])) .pulso_aviso(plan$aviso[1])
  invisible(plan)
}

#' Dónde empieza una fila de la leyenda: centrada en `centro` y sin salir de `[x0, x1]` (si cabe)
#' @keywords internal
.leyenda_x_fila <- function(total, centro, x0, x1) min(max(centro - total / 2, x0), x1 - total)

# ---- parámetros por medio -----------------------------------------------------------------------------------------------

#' Plan de la leyenda nativa de la lámina (cuadro de 0,15 in, 0,3 in entre ítems, 12 pt; piso de «una fila», 10 pt)
#'
#' Mide con la negrita de la leyenda (`.std_negrita("leyenda", FALSE)`): si el usuario la pide, el texto ensancha.
#' @param ancho Ancho disponible en pulgadas.
#' @param panel `TRUE` para la leyenda de un panel: la fila única no aprieta su espacio (como siempre), pasa a filas.
#' @keywords internal
.lam_leyenda_plan <- function(labels, ancho, panel = FALSE, modo = .std_leyenda_modo()) {
  .leyenda_plan(labels, ancho, .std_pt("leyenda"), modo = modo, bold = isTRUE(.std_negrita("leyenda", FALSE)),
                piso_pt = min(10, .std_pt("leyenda")), gap_min = 0.15, gap_max = 0.3,
                gap_una_fila_min = if (isTRUE(panel)) 0.3 else 0.15, cuadro_in = 0.22)
}

#' Ancho que ocupa la leyenda de una figura Word dentro de la figura (márgenes del tema y de la caja de la leyenda)
#' @keywords internal
.WORD_LEYENDA_MARGEN_IN <- (6 + 6 + 11) / 72.27

#' Plan de la leyenda de una figura Word (`ggplot2::guide_legend`): cuadrito de `clave_pt`, 5,5 pt de aire tras el
#' cuadrito y entre ítems, columnas compartidas entre filas
#'
#' Calibrado contra el `gtable` de la leyenda real (ggplot2 4.0): cada ítem mide cuadrito + 5,5 pt + texto, y el texto
#' que mide grid sale ~7 % más ancho que el de `systemfonts`. La letra de «una fila» no baja del piso del Word
#' (`grafico_minimo`, 8 pt): `.word_piso_texto()` la volvería a subir.
#' @param size_pt Tamaño de la leyenda (ya con el paso de letra).
#' @keywords internal
.word_leyenda_plan <- function(labels, size_pt, clave_pt = .WORD_ESCALA_PT$leyenda_clave, ancho = .std_word("pagina", "ancho_util"),
                               modo = .std_leyenda_modo()) {
  .leyenda_plan(labels, ancho - .WORD_LEYENDA_MARGEN_IN, size_pt, modo = modo, bold = isTRUE(.std_negrita("leyenda", FALSE)),
                piso_pt = max(7.5, .std_valor("word", "tipografia", "grafico_minimo")), gap_min = 1.5 / 72.27, gap_max = 5.5 / 72.27,
                cuadro_in = (clave_pt + 5.5) / 72.27, factor = 1.08, rejilla = TRUE)
}

#' Guía y tema de la leyenda Word a partir de su plan: filas por fila (`byrow`), letra y, si se apretó, el espacio
#' @return Lista de componentes para sumar a un ggplot (`g + .word_leyenda_ajuste(plan, "fill")`).
#' @keywords internal
.word_leyenda_ajuste <- function(plan, estetica = "fill", ...) {
  guia <- stats::setNames(list(ggplot2::guide_legend(nrow = max(1L, length(plan$filas)), byrow = TRUE, ...)), estetica)
  out <- list(do.call(ggplot2::guides, guia))
  gap <- if (length(plan$gaps)) min(plan$gaps) else 5.5 / 72.27
  if (gap < 5.5 / 72.27 - 1e-6) out <- c(out, list(ggplot2::theme(legend.key.spacing.x = ggplot2::unit(gap * 72.27, "pt"))))
  # Sólo «una fila» cambia la letra; el tema la suma a lo que ya tenía (color y negrita se conservan).
  if (identical(plan$modo, "una_fila")) out <- c(out, list(ggplot2::theme(legend.text = ggplot2::element_text(size = plan$size))))
  out
}
