# =============================================================================
# graficos_panorama_equivalencia.R — el panorama compara públicos por equivalencia declarada (ADR 0138 §5)
# =============================================================================
#
# Las reglas del panorama que comparan públicos (`comunes`, `mayor_diferencia`, `diferencia_minima`) emparejaban las
# preguntas por NOMBRE de variable (`tema = variable`). En Arte la misma pregunta es `p13_6` en docentes y `p12_3` en
# estudiantes, y `p24_1` es otra en cada base: por nombre la regla medía la diferencia entre preguntas distintas. Es el
# mismo defecto que E1 corrigió en el contraste (graficos_dumbbell_equivalencia.R) y la misma fuente lo resuelve: las
# filas confirmadas de la matriz de equivalencias (`.dumbbell_equivalencias`, sin `sugerida`).
#
# Cada pregunta medida toma el tema de la primera fila confirmada que la declara en su base; las que ninguna fila
# declara quedan solas (un tema por pregunta: nunca están en todos los públicos y la regla no las compara). Si ninguna
# fila declara preguntas en dos o más públicos de la lámina no hay comparación: la nota y la lámina lo dicen.

#' Temas del panorama entre públicos por la matriz de equivalencias
#'
#' @param medidas `data.frame(ref, source, variable)` de las preguntas medidas (aptas y con respuestas), en orden.
#' @param sources Fuentes del estudio (para la matriz, los rótulos y la firma de la escala).
#' @param equiv Matriz de equivalencias.
#' @return `list(tema, etiqueta, motivos, sin_temas)`: `tema` y `etiqueta` alineados con `medidas`; `sin_temas` es el
#'   motivo para la nota si ninguna pregunta queda emparejada (`.DUMBBELL_MSG_SIN_EQUIV` si la matriz no cubre a estos
#'   públicos, `.DUMBBELL_MSG_SIN_COMPARABLES` si los cubre pero nada se puede comparar), o NULL.
#' @keywords internal
.panorama_temas_declarados <- function(medidas, sources, equiv = .dumbbell_equivalencias(sources)) {
  n <- nrow(medidas)
  tema <- as.character(medidas$ref)
  etiqueta <- vapply(seq_len(n), function(i) sprintf("%s (%s)", .regla_preguntas_rotulo(sources$inst_sources[[medidas$source[i]]], medidas$variable[i]),
                                                     .radar_mb_capitalizar(medidas$source[i])), "")
  bases <- unique(as.character(medidas$source))
  libre <- rep(TRUE, n); motivos <- list(); cubre <- 0L; pares <- character(0)
  for (f in (equiv %||% list())$filas %||% list()) {
    if (!is.list(f) || isTRUE(f$sugerida)) next
    x <- vapply(bases, function(b) .dumbbell_equiv_var(f, b), "")
    if (sum(nzchar(x)) < 2L) next   # la fila no empareja dos públicos de esta lámina
    cubre <- cubre + 1L
    idx <- which(libre & vapply(seq_len(n), function(i) identical(unname(x[medidas$source[i]]), medidas$variable[i]), TRUE))
    idx <- idx[!duplicated(medidas$source[idx])]
    if (length(idx) < 2L) next
    firmas <- vapply(idx, function(i) .equiv_firma_escala(sources$inst_sources[[medidas$source[i]]], medidas$variable[i]) %||% "", "")
    if (length(unique(firmas)) != 1L) { motivos[[length(motivos) + 1L]] <- "tienen escalas distintas entre públicos"; next }
    rot <- trimws(as.character(f$etiqueta_estandar %||% "")[1])
    if (is.na(rot) || !nzchar(rot)) rot <- .regla_preguntas_rotulo(sources$inst_sources[[medidas$source[idx[1]]]], medidas$variable[idx[1]])
    rot <- make.unique(c(pares, rot), sep = " ")[length(pares) + 1L]
    pares <- c(pares, rot)
    tema[idx] <- rot; etiqueta[idx] <- rot; libre[idx] <- FALSE
  }
  sueltas <- sum(libre)
  if (cubre > 0L && sueltas) {
    motivos <- c(motivos, rep(list("no tienen equivalencia declarada en los otros públicos"), sueltas))
  }
  sin_temas <- if (!length(pares)) (if (cubre == 0L) .DUMBBELL_MSG_SIN_EQUIV else .DUMBBELL_MSG_SIN_COMPARABLES)
  list(tema = tema, etiqueta = etiqueta, motivos = motivos, sin_temas = sin_temas)
}
