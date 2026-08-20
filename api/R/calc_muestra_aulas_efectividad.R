# Efectividad esperada ex ante (EF3 fase 1, era EFECTIVIDAD).
#
# VARA 0 de Gonzalo, textual: «tenemos que genuinamente asegurarnos que este
# mecanismo de selección de aulas nos garantice efectividad (…) lo importante
# es medirla ANTES, porque luego ya no podemos arreglar las cosas».
#
# Calibración 2025 (base ADR 0060, 230 intentadas / 194 aplicadas), medida el
# 2026-08-18 y registrada en docs/qa/checklist-replicacion-2025-2026-08-17.md:
#   - P(aplicada): base 84%; DOCENTE CONTRATADO 87%; ORDINARIO-PRINCIPAL 73%.
#     (Asociado/Auxiliar/Pre-docente sin calibración propia → base.)
#   - Rendimiento (efectivas/elegibles, mediana 0.56), monotónico en tamaño:
#     ≤15: 0.80 · 16–25: 0.69 · 26–35: 0.56 · 36–50: 0.55 · >50: 0.44.
#     Bins sobre ELEGIBLES (v1; la base 2025 bineó sobre su tamaño de aula).
#   - LIMITACIÓN DECLARADA: el bloque horario (especial-mañana −15 pts de
#     aplicación; noche rinde 0.40) NO es derivable del marco actual — el
#     `schedule` es código de sección, no hora. Señal medida, no usable en v1.
#   - tipo_curso no calibrable (2025 fue todo teórico): talleres sin prior.
#
# FASE 1 = REFERENCIAL: anota columnas en el frame DESPUÉS del frame_hash (no
# muta la firma ni invalida artefactos acreditados) y NO toca π ni el sorteo.
# Pesar el sorteo con esto es fase 2 y espera la decisión de Gonzalo.

.cm_efectividad_p_aplicada <- function(teacher_type) {
  tt <- toupper(trimws(as.character(teacher_type %||% "")))
  p <- rep(0.84, length(tt))
  p[grepl("CONTRATADO", tt, fixed = TRUE)] <- 0.87
  p[grepl("ORDINARIO", tt, fixed = TRUE) & grepl("PRINCIPAL", tt, fixed = TRUE)] <- 0.73
  p
}

.cm_efectividad_rendimiento <- function(eligible_n) {
  e <- suppressWarnings(as.numeric(eligible_n))
  e[!is.finite(e)] <- 0
  r <- rep(NA_real_, length(e))
  r[e <= 15] <- 0.80
  r[e > 15 & e <= 25] <- 0.69
  r[e > 25 & e <= 35] <- 0.56
  r[e > 35 & e <= 50] <- 0.55
  r[e > 50] <- 0.44
  r
}

#' Anota el frame con la efectividad esperada por curso-horario.
#' Idempotente y sin RNG; con frame vacío o sin eligible_n devuelve tal cual.
.cm_aulas_efectividad_anotar <- function(aula_frame) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) || !"eligible_n" %in% names(aula_frame)) {
    return(aula_frame)
  }
  p <- .cm_efectividad_p_aplicada(aula_frame$teacher_type %||% rep("", nrow(aula_frame)))
  r <- .cm_efectividad_rendimiento(aula_frame$eligible_n)
  aula_frame$p_aplicada_ref <- round(p, 3)
  aula_frame$rendimiento_ref <- round(r, 3)
  el <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  el[!is.finite(el)] <- 0
  aula_frame$efectivas_esperadas <- round(el * p * r, 1)
  # Contrato con Monitoreo (2026-08-20): declarar de donde salio la meta para
  # que su lado pueda afirmar "del diseno" sin inferirlo. Literal estable.
  aula_frame$meta_origen <- "diseno"
  aula_frame
}
