# =============================================================================
# graficos_dumbbell_grupo_chico.R — las aperturas avisan el grupo chico en el pie (ADR 0135)
# =============================================================================
#
# En las aperturas dentro de un público (`p_dumbbell(estilo = "resumen", cruce = …)`) un grupo de pocos casos mueve
# su cifra con una o dos respuestas. El resumen de Arte y Diseño FG 2026 lo decía al pie: «Grupo chico: 24 docentes
# TC.». Aquí se escribe esa nota cuando algún grupo tiene menos de `.GRUPO_CHICO_UMBRAL` casos. Sólo informa: no
# oculta ni descuenta nada.

.GRUPO_CHICO_UMBRAL <- 30L

#' Nota del grupo chico de un contraste por cruce: «Grupo chico: 24 docentes TC.»
#'
#' @param espec Especificación `contraste/1` (sus `grupos` y `casos`).
#' @param unidad Cómo se nombran los casos, en plural y minúscula («docentes»).
#' @return Texto o `NULL` si ningún grupo queda bajo el umbral.
#' @keywords internal
.dumbbell_nota_grupo_chico <- function(espec, unidad, umbral = .GRUPO_CHICO_UMBRAL) {
  N <- espec$casos
  if (!is.matrix(N) || !length(espec$grupos)) return(NULL)
  n <- apply(N, 2, function(v) if (any(is.finite(v))) max(v[is.finite(v)]) else NA_real_)
  chicos <- which(is.finite(n) & n < umbral)
  if (!length(chicos)) return(NULL)
  piezas <- sprintf("%s %s %s", vapply(n[chicos], .dumbbell_fmt_casos, ""), unidad, espec$grupos[chicos])
  sprintf("%s: %s.", if (length(chicos) == 1L) "Grupo chico" else "Grupos chicos", paste(piezas, collapse = "; "))
}

#' Pone la nota del grupo chico en la especificación de un dumbbell por cruce en estilo resumen
#' @keywords internal
.dumbbell_con_grupo_chico <- function(p, el) {
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (is.null(el$cruce) || !is.list(espec) || !identical(espec$tipo, "contraste")) return(p)
  unidad <- tolower(.radar_mb_capitalizar(.graficos_ref_parts(el$cruce)$source))
  if (!nzchar(unidad)) unidad <- "casos"
  espec$nota_grupo_chico <- .dumbbell_nota_grupo_chico(espec, unidad)
  attr(p, "pulso_espec") <- espec
  # El respaldo (imagen) escribe su pie desde `note_outside`: sin esto el grupo chico sólo salía en la lámina nativa.
  if (!is.null(espec$nota_grupo_chico)) attr(p, "note_outside") <- .lam_unir_base(attr(p, "note_outside", exact = TRUE), espec$nota_grupo_chico)
  p
}
