# Qué indicador prueba una lámina de cruce (ADR 0128 §4.4) y dónde se informa
# ==========================================================================
#
# En una escala sólo se prueba el Top Two Box. Antes, la lámina lo activaba por el preset de la casa
# (`barra_extra_preset = "top2box"`) y, sin rótulos, lo deducía por posición («las dos últimas sustantivas»), mientras la
# familia del informe probaba los segmentos y el graficador no dibujaba un box sin declaración (`.box_decidir`). Tres
# lecturas de la misma lámina. Aquí hay una sola, que comparten el render (graficos_significancia_render.R) y la familia
# (graficos_significancia_familia.R):
#
# - con `top2box_labels` declarados en el gráfico (sus args o sus overrides), se prueba sólo el Top Two Box, se vea o no
#   su columna;
# - sin declaración, una escala (tres o más categorías sustantivas con orden propio, `.goc_pistas_orden`) no se prueba y
#   el editor recibe un aviso para declarar sus categorías;
# - una lista sin orden (género, carrera) o una de dos sustantivas sigue probando sus segmentos.
#
# La visibilidad de la columna no cambia QUÉ se prueba sino DÓNDE se informa: si la columna no se dibuja, la lámina no
# lleva marcas ni clave y el hallazgo va como aviso al editor (`.sig_aviso_t2b_oculto`).

#' Rótulos del Top Two Box que declara un gráfico (sus args o sus overrides), o `character(0)`
#'
#' No mira el preset: lo que la familia del informe ve de una lámina es lo que el plan declara en ella.
#' @param args Args del gráfico (el `el` del render, o `g$args` del plan).
#' @param overrides Overrides del gráfico; por defecto, los de `args`.
#' @keywords internal
.sig_top2box_declarado <- function(args, overrides = NULL) {
  args <- if (is.list(args)) args else list()
  overrides <- if (is.list(overrides)) overrides else (if (is.list(args$overrides)) args$overrides else list())
  lab <- as.character(unlist(args$top2box_labels %||% overrides$top2box_labels %||% character(0), use.names = FALSE))
  lab <- trimws(lab)
  unique(lab[!is.na(lab) & nzchar(lab)])
}

#' El indicador que prueba una lámina de multiapiladas por cruce
#'
#' @param top2box Rótulos declarados (`.sig_top2box_declarado`).
#' @param etiquetas Rótulos de las categorías de la pregunta (las columnas de `.sig_indicadores()$Y`).
#' @param codigos Códigos por rótulo (para reconocer los «No sabe» codificados 90-99).
#' @param regla Regla del estudio.
#' @return `list(tipo, top2box)` con `tipo` en `"top2box"`, `"escala_sin_declarar"` o `"segmentos"`.
#' @keywords internal
.sig_indicador_lamina <- function(top2box, etiquetas, codigos = NULL, regla = list()) {
  top2box <- as.character(top2box %||% character(0))
  if (length(top2box)) return(list(tipo = "top2box", top2box = top2box))
  sust <- .sig_filas_a_probar(etiquetas, codigos, regla, solo_principal = FALSE)
  if (length(sust) >= 3L && isTRUE(.goc_pistas_orden(sust))) {
    return(list(tipo = "escala_sin_declarar", top2box = character(0)))
  }
  list(tipo = "segmentos", top2box = character(0))
}

#' ¿Las categorías del Top Two Box existen en la pregunta? Si falta una, el indicador no es el que se declaró
#' @keywords internal
.sig_top2box_completo <- function(top2box, etiquetas) {
  length(top2box) > 0L && all(as.character(top2box) %in% as.character(etiquetas))
}

#' ¿El gráfico dibuja la columna del Top Two Box que se prueba?
#'
#' Reproduce la cascada del render (`.merge_args`: base, presets, lo que declara el gráfico, overrides) y la decisión del
#' graficador (`.box_decidir`). La columna cuenta como visible sólo si se dibuja con las mismas categorías declaradas: una
#' columna con otras categorías (las de un preset) mostraría otro indicador junto a la marca.
#' @param env Entorno del render de multiapiladas por cruce.
#' @param top2box Rótulos declarados.
#' @keywords internal
.sig_top2box_visible_en <- function(env, top2box) {
  if (!length(top2box)) return(FALSE)
  toma <- function(n) get0(n, envir = env, inherits = FALSE)
  cols <- as.character(toma("cols_pct") %||% character(0))
  etiquetas <- toma("etiquetas_grupos")
  if (!length(cols) || is.null(etiquetas)) return(FALSE)
  el <- toma("el")
  # Los avisos de la barra extra ya los da la mezcla del render; aquí se repetirían.
  a <- tryCatch(suppressMessages(.merge_args(toma("base_args") %||% list(), toma("preset_args_single") %||% list(),
                                             toma("preset_args_multi") %||% list(), .top2box_del_grafico(el),
                                             toma("overrides") %||% list())),
                error = function(e) NULL)
  if (is.null(a)) return(FALSE)
  .sig_top2box_visible(a, top2box, etiquetas, cols)
}

#' Visibilidad de la columna del Top Two Box sobre los args ya mezclados
#' @keywords internal
.sig_top2box_visible <- function(args, top2box, etiquetas_grupos, cols_porcentaje) {
  mostrar <- if (is.null(args$mostrar_barra_extra)) TRUE else isTRUE(args$mostrar_barra_extra)   # formal: TRUE
  preset <- as.character(unlist(args$barra_extra_preset %||% "ninguno"))[1]
  if (!mostrar || !identical(preset, "top2box")) return(FALSE)
  dec <- .box_decidir(as.character(unlist(args$top2box_labels %||% character(0))), etiquetas_grupos, cols_porcentaje,
                      minimo = 3L)
  if (!isTRUE(dec$dibujar)) return(FALSE)
  setequal(dec$cols, .box_cols_desde_etiquetas(top2box, etiquetas_grupos, cols_porcentaje))
}

#' Aviso al editor con el hallazgo del Top Two Box cuando la lámina no muestra su columna
#'
#' Descartar en silencio es el defecto: la diferencia se calculó y la lámina no puede mostrarla.
#' @return El texto emitido, o `NULL` si no había diferencias que contar.
#' @keywords internal
.sig_aviso_t2b_oculto <- function(ev) {
  p <- ev$pares
  if (is.null(p) || !nrow(p) || is.null(p$veredicto)) return(invisible(NULL))
  muestra <- p$veredicto == "marcada" | (p$veredicto == "fragil" & !identical(ev$regla$fragiles, "ocultar"))
  if (!any(muestra)) return(invisible(NULL))
  et <- ev$etiquetas_grupos
  nombre <- function(x) ifelse(x == ".resto", "el resto", unname(et[x]))
  p <- p[muestra, , drop = FALSE]
  frases <- sprintf("%s supera a %s%s", nombre(p$a), nombre(p$b), ifelse(p$veredicto == "fragil", " (frágil)", ""))
  lista <- if (length(frases) > 1L) {
    paste(paste(utils::head(frases, -1L), collapse = ", "), "y", utils::tail(frases, 1L))
  } else frases
  texto <- .aviso_en_lamina(sprintf(paste0(
    "las diferencias de esta escala se prueban en el Top Two Box y la lámina no muestra su columna: %s. ",
    "Enciende la columna para verla."), lista))
  .pulso_aviso(texto)
  invisible(texto)
}

#' Aviso al editor cuando una escala de una lámina de cruce no declara su Top Two Box
#' @keywords internal
.sig_aviso_t2b_sin_declarar <- function(var) {
  texto <- .aviso_en_lamina(sprintf(paste0(
    "las diferencias de «%s» no se marcan porque es una escala sin Top Two Box declarado. ",
    "Elige sus categorías en la pestaña Gráfico de la lámina."), var))
  .pulso_aviso(texto)
  invisible(texto)
}

#' ¿Cada p está en la familia del informe? (ADR 0128 §3: lo que la lámina marca está en la familia)
#'
#' La familia guarda sus p ordenados; un p de la lámina calculado sobre los mismos casos es el mismo número, salvo el
#' orden de las sumas. Un p que no está (una lámina con filtros, otro indicador) no se ajusta con un q ajeno.
#' @keywords internal
.sig_bh_en_familia <- function(p, tabla, tol = 1e-9) {
  out <- rep(FALSE, length(p))
  if (is.null(tabla) || !tabla$m) return(out)
  ok <- is.finite(p)
  if (!any(ok)) return(out)
  i <- findInterval(p[ok], tabla$p)
  cerca <- function(j) {
    j2 <- pmin(pmax(j, 1L), tabla$m)
    abs(tabla$p[j2] - p[ok]) <= tol * pmax(1e-300, abs(p[ok]))
  }
  out[ok] <- cerca(i) | cerca(i + 1L)
  out
}
