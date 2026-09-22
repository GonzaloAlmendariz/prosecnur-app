# monitoreo_aulas_consentimiento.R — quién aceptó participar, y quién no.
#
# **Un rechazo no es un fallo del cruce.** Gonzalo, 2026-09-22, mirando la tabla
# de alumnos: «la CH 18 creo que no es identificable porque fue un rechazo, eso
# la tabla de acreditación ya lo sabe mostrar bien».
#
# Y es exacto por dos lados. Acreditación publica DOS columnas —el estado de la
# respuesta (`complete`, `partial`, `refusal`, `pending`) y el del cruce— porque
# son dos preguntas: qué pasó con la encuesta, y si esa encuesta se pudo atar a
# alguien. La tabla de aulas las tenía en una sola, así que un rechazo salía
# como «no declararon su código», que manda a revisar el formulario cuando no
# hay nada que revisar: quien no consiente no llega a la pregunta del código.
#
# Medido sobre CCSS Perfil 2026-II el 2026-09-22: 3 respuestas con
# `acepta_participar = 2`, **ninguna con código** —el formulario no se lo pide a
# quien no acepta— y una de ellas es justamente la de CH 18.
#
# **Esto NO decide qué cuenta como efectiva.** Lo decide `valid_filters`, que el
# estudio declara en Fuentes y que hoy está vacío —así que esas tres respuestas
# cuentan—. Cambiarlo aquí sería mover una cifra del avance desde un archivo que
# sólo debería saber leer una columna. Lo que sí hace es decirlo en la tabla,
# que es donde se puede ver y decidir.

# La columna del consentimiento, si el estudio no la declara. Es la misma lista
# que `.monitoreo_aulas_filter_passed()` usa para el filtro de elegibilidad, más
# el nombre que produce este instrumento; se resuelve con el resolutor que sabe
# de prefijos de grupo, así que `acepta_participar` encuentra
# `consentimiento_informado/acepta_participar`.
.MAC_CANDIDATAS <- c(
  "acepta_participar", "acepta", "consentimiento", "consent",
  "consentimiento_informado", "participa"
)

.MAC_SI <- c("1", "true", "t", "si", "sí", "yes", "y", "acepta", "consiente",
             "consent", "acepto", "acepta_participar")
.MAC_NO <- c("0", "2", "false", "f", "no", "n", "rechaza", "rechazado",
             "no_acepta", "refusal", "rechazo")

#' La columna donde el alumno aceptó o rechazó participar.
#'
#' @param responses `data.frame` de respuestas.
#' @param cfg config de aulas universitarias.
#' @return el nombre de la columna, o `""` si no se reconoce ninguna.
#' @export
monitoreo_aulas_columna_consentimiento <- function(responses, cfg = list()) {
  mapping <- (cfg %||% list())[["source_mapping"]] %||% list()
  declarada <- .monitoreo_scalar(mapping[["consent_var"]] %||% "", "")
  if (nzchar(declarada)) {
    col <- monitoreo_aulas_columna_declarada(responses, declarada)
    # Declarada y ausente: no se busca otra. Adivinar tras una declaración
    # explícita es lo que convierte un error de tipeo en una cifra plausible.
    return(col)
  }
  for (cand in .MAC_CANDIDATAS) {
    col <- monitoreo_aulas_columna_declarada(responses, cand)
    if (nzchar(col)) return(col)
  }
  ""
}

#' El estado de cada respuesta frente al consentimiento.
#'
#' @param responses `data.frame` de respuestas.
#' @param cfg config de aulas universitarias.
#' @return vector de `"acepta"`, `"rechaza"` o `""` (no se sabe), uno por fila.
#'   Sin columna reconocible devuelve todo `""`: **no se supone que aceptaron**.
#'   Suponerlo pintaría de verde una pregunta que nadie contestó.
#' @export
monitoreo_aulas_consentimiento <- function(responses, cfg = list()) {
  n <- if (is.data.frame(responses)) nrow(responses) else 0L
  if (!n) return(character(0))
  col <- monitoreo_aulas_columna_consentimiento(responses, cfg)
  if (!nzchar(col)) return(rep("", n))
  k <- .monitoreo_text_key(as.character(responses[[col]]))
  out <- rep("", n)
  out[k %in% .monitoreo_text_key(.MAC_SI)] <- "acepta"
  out[k %in% .monitoreo_text_key(.MAC_NO)] <- "rechaza"
  out
}
