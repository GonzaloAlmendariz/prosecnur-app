# =============================================================================
# graficos_barra_extra.R — la «Barra extra»: una sola opción por gráfico (Gonzalo, 2026-10-23)
# =============================================================================
#
# «Al activar la barra extra por defecto te pide escoger cuál o cuáles; y tú le pides el top 2 box, pero podría pedirle
# conteos o un bottom two box también.» Cuatro claves independientes (`top2box`, `mostrar_barra_extra`,
# `barra_extra_preset`, `columna_bottom2box`) decían lo mismo en tres sitios y se pisaban: un `mostrar_barra_extra =
# FALSE` en los overrides apagaba un Top Two Box que la tarjeta declaraba (reporte_plan_top2box_grafico.R) sin avisar.
#
# CONTRATO
#   `barra_extra`: `false` | vector de "top2box" / "bottom2box" / "conteos" (el orden = el orden de las columnas).
#     - "conteos": el n de casos de cada barra o fila en una columna a la derecha (el preset `totales` del motor).
#     - Top y Bottom se combinan. «Conteos» con un box queda para una segunda fase: aviso y se quedan los boxes.
#   Vive en `overrides.barra_extra` del gráfico (lámina) o de su bloque (multilista); la multiapilada también lo acepta
#   como `barra_extra` de args o del bloque. Las categorías de cada box siguen en `top2box_labels` / `bottom2box_labels`
#   junto a ella (quien pide un box sin categorías recibe el aviso «sin declaración» de `.box_decidir`).
#   Resolución: bloque > lámina > preset base. Si `barra_extra` está presente, `mostrar_barra_extra`,
#   `barra_extra_preset` y `columna_bottom2box` del mismo nivel se IGNORAN: se derivan de ella.
#   Override solo-Word: `word_barra_extra` (mismo vocabulario); el Word hereda la barra extra de la lámina si no la
#   declara.
#
# DÓNDE VIVE QUÉ
#   - Este archivo: la derivación al motor (`.barra_extra_a_args`, `.barra_extra_bajar`, llamado desde `.merge_args`) y
#     la migración de las claves viejas (`.graficos_migrar_barra_extra`). Las claves viejas se leen SÓLO en la
#     migración, que corre en `.normalize_plan()` y `.graficos_normalize_config()` (vía `.graficos_migrar_plan()`) y las
#     reescribe una vez. El motor (graficador, espec nativa) sigue hablando sus propios args: el preset base, que es de
#     la casa y no del gráfico, conserva `mostrar_barra_extra` / `barra_extra_preset`.

.BARRA_EXTRA_VALORES <- c("top2box", "bottom2box", "conteos")
.BARRA_EXTRA_CLAVES_VIEJAS <- c("mostrar_barra_extra", "barra_extra_preset", "columna_bottom2box", "word_mostrar_barra_extra")

#' La barra extra declarada, en su forma canónica
#'
#' @param x `NULL`, `FALSE`, un vector o una lista de textos (la forma que deja jsonlite).
#' @param avisar Si `TRUE`, un valor desconocido se avisa al analista.
#' @return `NULL` (nada declarado), `FALSE` (sin barra extra) o un vector de textos sin repetir, en orden.
#' @keywords internal
.barra_extra_normalizar <- function(x, avisar = TRUE) {
  if (is.null(x)) return(NULL)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  if (is.null(x) || !length(x)) return(FALSE)   # `[]`: ninguna columna
  if (is.logical(x)) {
    x <- x[!is.na(x)]
    if (length(x) && !any(x)) return(FALSE)
    if (avisar && length(x)) .pulso_aviso("La barra extra pide elegir cuál: Top Two Box, Bottom Two Box o Conteos. Un «sí» suelto no dice cuál.")
    return(NULL)
  }
  v <- tolower(trimws(as.character(x)))
  v <- v[!is.na(v) & nzchar(v)]
  malos <- setdiff(unique(v), .BARRA_EXTRA_VALORES)
  if (avisar && length(malos)) {
    .pulso_aviso(sprintf("La barra extra no conoce %s; se ignora. Las opciones son Top Two Box, Bottom Two Box y Conteos.",
                         paste0("«", malos, "»", collapse = ", ")))
  }
  v <- unique(v[v %in% .BARRA_EXTRA_VALORES])
  if (!length(v)) return(NULL)
  v
}

#' Forma en que la barra extra se guarda en el plan: `FALSE` o un vector de textos
#'
#' Atómico a propósito: `utils::modifyList()` y el deep-merge de la config mezclan listas elemento a elemento (un bloque
#' con `list("conteos")` heredaba el `"top2box"` de su lámina); un vector se reemplaza entero. En JSON sale como texto
#' (un solo valor) o arreglo; quien lo lea acepta las dos formas.
#' @keywords internal
.barra_extra_repr <- function(be) if (isFALSE(be)) FALSE else as.character(be)

#' Los args del motor que expresa una barra extra
#'
#' `top2box` -> `mostrar_barra_extra = TRUE`, preset `top2box`; más `bottom2box` -> `columna_bottom2box = TRUE`;
#' `bottom2box` solo -> preset `bottom2box`; `conteos` -> preset `totales`; `FALSE` -> sin columna.
#' «Conteos» con un box: aviso y se queda con los boxes (la combinación es de una segunda fase).
#' @param be Barra extra (cualquier forma que acepte `.barra_extra_normalizar`).
#' @return Lista de args del motor; vacía si `be` no declara nada.
#' @keywords internal
.barra_extra_a_args <- function(be) {
  be <- .barra_extra_normalizar(be)
  if (is.null(be)) return(list())
  if (isFALSE(be)) return(list(mostrar_barra_extra = FALSE, barra_extra_preset = "ninguno"))
  boxes <- intersect(be, c("top2box", "bottom2box"))
  if ("conteos" %in% be && length(boxes)) {
    .pulso_aviso(.aviso_en_lamina(paste0(
      "«Conteos» todavía no se combina con Top Two Box ni Bottom Two Box en la misma barra extra: ",
      "la barra extra muestra solo ", paste(c(top2box = "Top Two Box", bottom2box = "Bottom Two Box")[boxes], collapse = " y "), ".")))
  }
  if (!length(boxes)) return(list(mostrar_barra_extra = TRUE, barra_extra_preset = "totales"))
  if (identical(boxes, "bottom2box")) return(list(mostrar_barra_extra = TRUE, barra_extra_preset = "bottom2box"))
  out <- list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box")
  if ("bottom2box" %in% boxes) out$columna_bottom2box <- TRUE
  out
}

#' Baja la `barra_extra` de unos args ya mezclados a los args del motor
#'
#' Es el único punto donde la barra extra se vuelve `mostrar_barra_extra` / `barra_extra_preset` /
#' `columna_bottom2box`: lo llama `.merge_args()`, que es por donde pasa cada capa (base, preset, lo que declara el
#' gráfico, overrides). La última capa que declara `barra_extra` manda, y manda sobre las claves viejas que lleve
#' cualquier capa anterior (el preset base, por ejemplo): ahí está la precedencia bloque > lámina > preset. Sin
#' `barra_extra` los args salen intactos.
#' @param args Lista de args mezclados.
#' @keywords internal
.barra_extra_bajar <- function(args) {
  if (!is.list(args)) return(args)
  args[["word_barra_extra"]] <- NULL   # sólo la lee el camino del Word (`.word_barra_extra_solo_word`); el graficador no la conoce
  if (!("barra_extra" %in% names(args))) return(args)
  be <- args[["barra_extra"]]
  args[["barra_extra"]] <- NULL
  derivado <- .barra_extra_a_args(be)
  if (!length(derivado)) return(args)
  # Un preset base que ya traía `columna_bottom2box` no la deja encendida si la barra extra no la pide.
  if (is.null(derivado$columna_bottom2box) && !is.null(args$columna_bottom2box)) derivado$columna_bottom2box <- FALSE
  for (nm in names(derivado)) args[[nm]] <- derivado[[nm]]
  args
}

#' Pone en los overrides la barra extra que declara un constructor (formal `barra_extra` de la multiapilada)
#'
#' La declaración propia del nivel manda sobre la que heredan sus overrides del nivel de arriba.
#' @keywords internal
.barra_extra_en_overrides <- function(overrides, barra_extra) {
  be <- .barra_extra_normalizar(barra_extra)
  if (is.null(be)) return(overrides)
  overrides[["barra_extra"]] <- .barra_extra_repr(be)
  overrides
}

#' ¿La multiapilada lleva Top Two Box? (la bandera `top2box` del elemento, derivada de su barra extra)
#'
#' Con una barra extra declarada manda ella; sin ella, la bandera `top2box` de quien construye el elemento a mano.
#' @keywords internal
.barra_extra_top2box_de <- function(top2box, overrides) {
  be <- .barra_extra_normalizar(if (is.list(overrides)) overrides[["barra_extra"]] else NULL, avisar = FALSE)
  if (is.null(be)) isTRUE(top2box) else "top2box" %in% be
}

#' ¿La barra extra de estos overrides ocupa una columna? `NULL` si no declara nada (decide el resto de la cascada)
#' @keywords internal
.barra_extra_mostrar_de <- function(overrides) {
  be <- .barra_extra_normalizar(if (is.list(overrides)) overrides[["barra_extra"]] else NULL, avisar = FALSE)
  if (is.null(be)) NULL else !isFALSE(be)
}

# ---- migración --------------------------------------------------------------

.be_lgl1 <- function(x) if (is.logical(x) && length(x) == 1L && !is.na(x)) x else NULL
.be_chr1 <- function(x) {
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  if (is.character(x) && length(x) >= 1L && !is.na(x[1]) && nzchar(trimws(x[1]))) trimws(x[1]) else NULL
}
.be_hay <- function(x) is.character(x) && length(x) > 0L || (is.list(x) && length(x) > 0L)

#' La barra extra que decían las claves viejas de un nivel, con su precedencia de siempre
#'
#' Los overrides mandan sobre lo que declara la tarjeta (`top2box`), que mandaba sobre el preset. Un bloque hereda los
#' overrides y la bandera de su lámina.
#' @return `list(be, aviso, conservar)`: `aviso` si el Top Two Box estaba declarado pero apagado; `conservar` si
#'   queda una clave vieja sin equivalente (`top3box`) que el motor todavía lee.
#' @keywords internal
.be_desde_viejas <- function(t2b, ov, padre_ov, labels) {
  mostrar <- .be_lgl1(ov[["mostrar_barra_extra"]]) %||% .be_lgl1(padre_ov[["mostrar_barra_extra"]])
  preset  <- .be_chr1(ov[["barra_extra_preset"]]) %||% .be_chr1(padre_ov[["barra_extra_preset"]])
  colb    <- .be_lgl1(ov[["columna_bottom2box"]]) %||% .be_lgl1(padre_ov[["columna_bottom2box"]])
  declara_top <- isTRUE(t2b)
  if (isFALSE(mostrar)) return(list(be = FALSE, aviso = declara_top, conservar = FALSE))
  efectivo <- preset %||% (if (declara_top) "top2box" else if (isTRUE(mostrar) && isTRUE(labels)) "top2box")
  if (is.null(efectivo)) return(list(be = NULL, aviso = FALSE, conservar = FALSE))
  be <- switch(efectivo,
    top2box = c("top2box", if (isTRUE(colb)) "bottom2box"),
    bottom2box = "bottom2box",
    totales = "conteos",
    NULL)
  list(be = be, aviso = FALSE, conservar = identical(efectivo, "top3box"))
}

#' Migra un nivel (los args de un gráfico o uno de sus bloques) a `overrides.barra_extra`
#'
#' @param nivel Lista con `top2box`, `top2box_labels`, `overrides`, `barra_extra`.
#' @param padre `NULL` o lo que el bloque hereda de su lámina: `t2b`, `ov` (overrides viejos), `labels`, `be`.
#' @return `list(nivel, aviso)`.
#' @keywords internal
.be_migrar_nivel <- function(nivel, padre = NULL) {
  ov <- nivel[["overrides"]]
  ov_lista <- is.list(ov) && !is.data.frame(ov)
  if (!ov_lista) ov <- list()
  nombres_ov <- names(ov)
  tiene_t2b <- "top2box" %in% names(nivel)
  declarado <- ov[["barra_extra"]] %||% nivel[["barra_extra"]]
  if (!tiene_t2b && !length(intersect(nombres_ov, .BARRA_EXTRA_CLAVES_VIEJAS)) && is.null(declarado)) {
    return(list(nivel = nivel, aviso = FALSE))
  }
  conservar <- FALSE; aviso <- FALSE
  t2b <- .be_lgl1(nivel[["top2box"]])
  if (!is.null(declarado)) {
    be <- .barra_extra_normalizar(declarado, avisar = FALSE)
  } else {
    t2b_efectivo <- t2b %||% padre$t2b
    labels <- .be_hay(nivel[["top2box_labels"]]) || .be_hay(ov[["top2box_labels"]]) || isTRUE(padre$labels)
    r <- .be_desde_viejas(t2b_efectivo, ov, padre$ov, labels)
    be <- r$be; aviso <- r$aviso; conservar <- r$conservar
    # Un bloque que desmarca explícitamente el Top Two Box que su lámina enciende queda sin barra extra.
    if (is.null(be) && isFALSE(t2b) && !is.null(padre) && !is.null(padre$be) && !isFALSE(padre$be)) be <- FALSE
  }
  # El override solo-Word: TRUE enciende la barra de la lámina (o el Top Two Box), FALSE la apaga.
  w <- .be_lgl1(ov[["word_mostrar_barra_extra"]])
  if (!is.null(w) && is.null(ov[["word_barra_extra"]])) {
    ov[["word_barra_extra"]] <- if (isFALSE(w)) FALSE else .barra_extra_repr(if (length(be) && !isFALSE(be)) be else "top2box")
  }
  quitar <- if (isTRUE(conservar)) "word_mostrar_barra_extra" else .BARRA_EXTRA_CLAVES_VIEJAS
  ov[intersect(names(ov), quitar)] <- NULL
  if (!is.null(be)) ov[["barra_extra"]] <- .barra_extra_repr(be)
  nivel[["top2box"]] <- NULL
  nivel[["barra_extra"]] <- NULL
  if (length(ov) || ov_lista) nivel[["overrides"]] <- ov
  list(nivel = nivel, aviso = aviso)
}

#' Migra los args de un gráfico (y los de sus bloques) a la barra extra
#' @return `list(args, aviso_lamina, aviso_bloques)`.
#' @keywords internal
.be_migrar_args <- function(args) {
  padre <- list(t2b = .be_lgl1(args[["top2box"]]),
                ov = if (is.list(args[["overrides"]])) args[["overrides"]] else list(),
                labels = .be_hay(args[["top2box_labels"]]) || .be_hay(args[["overrides"]][["top2box_labels"]]))
  r <- .be_migrar_nivel(args)
  args <- r$nivel
  padre$be <- .barra_extra_normalizar(args[["overrides"]][["barra_extra"]], avisar = FALSE)
  aviso_bloques <- integer()
  if (is.list(args[["bloques"]]) && length(args[["bloques"]])) {
    for (k in seq_along(args$bloques)) {
      b <- args$bloques[[k]]
      if (!is.list(b)) next
      rb <- .be_migrar_nivel(b, padre)
      args$bloques[[k]] <- rb$nivel
      if (isTRUE(rb$aviso)) aviso_bloques <- c(aviso_bloques, k)
    }
  }
  list(args = args, aviso_lamina = isTRUE(r$aviso), aviso_bloques = aviso_bloques)
}

#' Recorre un payload y migra cada gráfico (`list(graficador, args)`) que encuentre
#' @keywords internal
.be_migrar_payload <- function(x, acc) {
  if (!is.list(x) || is.data.frame(x)) return(x)
  if (!is.null(x[["graficador"]]) && is.list(x[["args"]])) {
    r <- .be_migrar_args(x[["args"]])
    x[["args"]] <- r$args
    if (isTRUE(r$aviso_lamina)) acc$lamina <- TRUE
    acc$bloques <- c(acc$bloques, r$aviso_bloques)
    return(x)
  }
  for (i in seq_along(x)) {
    if (is.list(x[[i]])) x[[i]] <- .be_migrar_payload(x[[i]], acc)
  }
  x
}

.be_texto_numeros <- function(n) {
  n <- sort(unique(n))
  if (length(n) <= 1L) as.character(n) else paste0(paste(n[-length(n)], collapse = ", "), " y ", n[length(n)])
}

#' Migra las claves viejas de la barra extra de un plan
#'
#' Lo llama `.graficos_migrar_plan()` desde `.normalize_plan()` y `.graficos_normalize_config()`. Idempotente: un plan
#' ya migrado no tiene claves viejas. Un Top Two Box que estaba declarado pero apagado se queda apagado y se avisa, por
#' lámina o por bloque, para que el analista decida si lo enciende (antes un override lo apagaba sin decirlo).
#'
#' @param plan Plan de la config (`list(slides = ...)`).
#' @param avisar Si `TRUE`, los avisos se suman a `attr(, "avisos_migracion")`.
#' @return El plan migrado.
#' @keywords internal
.graficos_migrar_barra_extra <- function(plan, avisar = TRUE) {
  if (!is.list(plan) || !is.list(plan$slides) || !length(plan$slides)) return(plan)
  avisos <- character(); titulos <- character()
  for (i in seq_along(plan$slides)) {
    s <- plan$slides[[i]]
    if (!is.list(s) || !is.list(s$payload)) next
    acc <- new.env(parent = emptyenv()); acc$lamina <- FALSE; acc$bloques <- integer()
    payload <- .be_migrar_payload(s$payload, acc)
    plan$slides[[i]]$payload <- payload
    if (!isTRUE(acc$lamina) && !length(acc$bloques)) next
    rotulo <- .graficos_poblacion_rotulo(payload$titulo)
    donde <- if (length(acc$bloques) && !isTRUE(acc$lamina)) {
      sprintf(" en %s %s", if (length(unique(acc$bloques)) == 1L) "el bloque" else "los bloques", .be_texto_numeros(acc$bloques))
    } else ""
    avisos <- c(avisos, sprintf(paste0("La lámina %d, %s, tenía el Top Two Box declarado pero apagado%s (la barra extra estaba desactivada); ",
                                       "sigue apagado. Actívalo en «Barra extra» si lo quieres."), i, rotulo, donde))
    titulos <- c(titulos, sprintf("%d %s", i, rotulo))
  }
  if (isTRUE(avisar) && length(avisos)) {
    previos <- .graficos_avisos_migracion(plan)
    if (length(avisos) > 2L) {
      avisos <- sprintf(paste("%d láminas tenían el Top Two Box declarado pero apagado; siguen apagadas. Láminas: %s.",
                              "Actívalo en «Barra extra» si lo quieres."), length(avisos), paste(titulos, collapse = ", "))
    }
    attr(plan, "avisos_migracion") <- c(previos, avisos)
  }
  plan
}

#' Migra un plan: población antigua y barra extra, en ese orden, con sus avisos juntos
#'
#' Es el punto que llaman `.normalize_plan()`, `.graficos_normalize_config()` y la migración de la sesión.
#' @keywords internal
.graficos_migrar_plan <- function(plan, avisar = FALSE) {
  plan <- .graficos_migrar_poblacion_antigua(plan, avisar = avisar)
  .graficos_migrar_barra_extra(plan, avisar = avisar)
}
