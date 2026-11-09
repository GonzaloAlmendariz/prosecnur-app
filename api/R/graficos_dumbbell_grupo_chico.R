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
  piezas <- vapply(seq_along(chicos), function(i) .dumbbell_grupo_chico_pieza(espec$grupos[chicos[i]], n[chicos[i]], unidad), "")
  sprintf("%s: %s.", if (length(chicos) == 1L) "Grupo chico" else "Grupos chicos", paste(piezas, collapse = "; "))
}

# Sustantivos comunes con que se nombra un grupo de un cruce ("Tercer ciclo"). Sólo con uno de estos el rótulo va en
# minúscula tras "de": "25 estudiantes de tercer ciclo" (Gonzalo, 2026-11-09).
.GRUPO_CHICO_COMUNES <- c("ciclo", "ciclos", "dedicación", "año", "años", "semestre", "semestres", "nivel", "turno", "sección",
                          "grado", "categoría", "modalidad", "etapa", "promoción", "cohorte", "periodo", "período")

#' Cómo se escribe un grupo chico en la nota
#'
#' - Sigla o nombre propio en mayúsculas (TC, TPA): "24 docentes TC", como lo escribía el resumen de Arte.
#' - Rótulo con un sustantivo común (ciclo, dedicación...) y sólo su inicial en mayúscula: "25 estudiantes de tercer ciclo".
#' - Si no se puede saber: "Tercer ciclo, 25 estudiantes" (el rótulo tal cual).
#' @keywords internal
.dumbbell_grupo_chico_pieza <- function(grupo, n, unidad) {
  g <- trimws(as.character(grupo)[1]); casos <- .dumbbell_fmt_casos(n)
  palabras <- strsplit(g, "\\s+")[[1]]
  sigla <- length(palabras) && all(grepl("^[[:upper:][:digit:]]+$", palabras)) && any(grepl("[[:upper:]]", palabras))
  if (sigla) return(sprintf("%s %s %s", casos, unidad, g))
  resto <- if (length(palabras) > 1L) palabras[-1] else character(0)
  solo_inicial <- length(palabras) >= 2L && identical(palabras[1], paste0(toupper(substr(palabras[1], 1, 1)), tolower(substring(palabras[1], 2)))) &&
    all(resto == tolower(resto))
  if (solo_inicial && any(tolower(palabras) %in% .GRUPO_CHICO_COMUNES)) {
    return(sprintf("%s %s de %s%s", casos, unidad, tolower(substr(g, 1, 1)), substring(g, 2)))
  }
  sprintf("%s, %s %s", g, casos, unidad)
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
