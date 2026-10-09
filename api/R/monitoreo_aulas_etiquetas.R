# =============================================================================
# El idioma de las superficies de aulas
# =============================================================================
#
# Gonzalo (2026-08-24): «que la informacion de los graficos e indicadores no sea
# muy criptica en la app sino que se entienda claramente sin caer en jerga».
#
# LA REGLA: **la clave es tecnica, la etiqueta es una frase que se entiende sola
# y lleva su denominador.** `deficit_no_subsanable` es una clave correcta y una
# etiqueta pesima; `sin_avance` suena benigno y es el caso peor.
#
# POR QUE EN UN ARCHIVO PROPIO: la vara dice «ninguna superficie», asi que el
# idioma tiene que poder auditarse de una sola pasada. Con las frases repartidas
# por los motores, un test anti-jerga solo prueba las que encuentra.
#
# LO QUE NO SE PUEDE HACER AQUI: sobreexplicar. Un rotulo, su numero, su
# denominador. Parafrasear el titulo es ruido.

# La jerga que no puede salir a superficie. Sale de la vara y es la lista contra
# la que corre el test: si una etiqueta nueva la toca, falla antes de llegar a
# nadie.
MONITOREO_AULAS_JERGA_PROHIBIDA <- paste(
  "\\btau\\b", "\\bdeff\\b", "residual", "\\bP25\\b", "bootstrap", "madow",
  "\\bcubo\\b", "estrato", "frame_hash", "\\btramo\\b", "\\bvara\\b",
  "calibraci", "\\bpercentil\\b", "conglomerado",
  sep = "|"
)

#' Etiqueta de un estado RETROSPECTIVO de celda facultad x sexo.
#'
#' Estos estados miden lo ya observado, y sus frases lo dicen en pasado —«ya
#' llego»— para que no se confundan con las del avance proyectado, que hablan en
#' futuro —«va a llegar»—. Las dos lecturas conviven en la misma pantalla y la
#' unica forma de que no se mezclen es que ni las claves ni las frases se
#' parezcan.
#'
#' @param estado clave de `.monitoreo_aulas_quota_estado`.
#' @return frase para superficie.
#' @export
monitoreo_aulas_etiqueta_celda <- function(estado) {
  switch(as.character(estado)[1],
    sin_cuota = "Sin cuota trazada",
    alcanzada = "Ya llegó a su cuota",
    en_progreso = "Empezó, todavía no llega",
    # `sin_avance` es el caso PEOR y la frase tiene que sonar como tal: el
    # nombre viejo, «pendiente», tranquilizaba justo donde habia que mirar.
    sin_avance = "Todavía sin ninguna encuesta",
    # Los mismos cuatro estados con las claves que emite el tablero. Sin esto
    # la celda salia rotulada «Sin estado» teniendo estado.
    sin_meta = "Sin cuota trazada",
    cumplida = "Ya llegó a su cuota",
    en_riesgo = "Empezó, todavía no llega",
    pendiente = "Todavía sin ninguna encuesta",
    "Sin estado"
  )
}

# --- las DOS taxonomias vivas de una celda, y su equivalencia ----------------
#
# En el repo conviven dos juegos de claves para el MISMO estado de una celda
# facultad x sexo, y ninguno esta mal:
#
#   · `sin_cuota / alcanzada / en_progreso / sin_avance` — los de
#     `.monitoreo_aulas_quota_estado()`, con los nombres que dicen lo que miden.
#   · `sin_meta / cumplida / en_riesgo / pendiente` — los que emite
#     `.monitoreo_aulas_cuotas_sexo_celdas()`, que es la que alimenta el tablero.
#
# Que convivan es tolerable; que cada consumidor escriba su propia lista
# literal, no. Al unificar las ramas el tablero quedo con el productor de un
# juego y CUATRO consumidores contando el otro: `quota_cells_ok`,
# `quota_cells_pending`, el control de estado y la frase de brechas daban 0
# sobre un estudio con celdas de sobra, sin que nada fallara —`0 >= 0` es
# cierto—. Solo lo caz un test que exigia `> 0`.
#
# La equivalencia se declara UNA vez y aqui, que es donde ya vive el idioma.

.MONITOREO_AULAS_CELDA_CUBIERTA <- c("alcanzada", "cumplida")
.MONITOREO_AULAS_CELDA_EN_DEUDA <- c("en_progreso", "sin_avance", "en_riesgo", "pendiente")

#' La celda ya llego a su cuota, en cualquiera de los dos vocabularios.
#'
#' @param estado clave de estado de celda.
#' @return logico del mismo largo.
#' @export
monitoreo_aulas_celda_cubierta <- function(estado) {
  as.character(estado) %in% .MONITOREO_AULAS_CELDA_CUBIERTA
}

#' La celda tiene cuota y todavia no llego, en cualquiera de los dos vocabularios.
#'
#' No es la negacion de `monitoreo_aulas_celda_cubierta()`: una celda SIN cuota
#' no esta en deuda, y contarla lo estaria seria inventar una brecha.
#'
#' @param estado clave de estado de celda.
#' @return logico del mismo largo.
#' @export
monitoreo_aulas_celda_en_deuda <- function(estado) {
  as.character(estado) %in% .MONITOREO_AULAS_CELDA_EN_DEUDA
}

#' Etiqueta de un tramo de cumplimiento del aula.
#'
#' **Cada frase lleva su denominador entre parentesis**: quien lee la barra no
#' tiene que recordar donde cae el corte, que es la mitad de lo que hace
#' criptico a un grafico.
#'
#' @param tramo clave del tramo de cobertura.
#' @return frase para superficie.
#' @export
monitoreo_aulas_etiqueta_tramo <- function(tramo) {
  switch(as.character(tramo)[1],
    pleno = "Llegó a lo esperado",
    satisfactorio = "Casi llegó (90-100 % de lo esperado)",
    parcial = "Llegó a la mayor parte (75-90 %)",
    insuficiente = "Se quedó a medias (50-75 %)",
    critico = "Muy por debajo (menos de la mitad)",
    nulo = "Sin respuestas",
    "Sin evaluar"
  )
}

#' Todas las frases publicables, para auditarlas de una pasada.
#'
#' Es lo que hace verificable la vara: un test recorre esto y falla si alguna
#' toca la jerga prohibida. Anadir una etiqueta nueva sin meterla aqui deja un
#' hueco, asi que la lista se declara al lado de las funciones que la llenan.
#'
#' @return vector de frases.
#' @export
monitoreo_aulas_etiquetas_publicables <- function() {
  c(
    vapply(c("sin_cuota", "alcanzada", "en_progreso", "sin_avance",
             "sin_meta", "cumplida", "en_riesgo", "pendiente", "otra"),
           monitoreo_aulas_etiqueta_celda, character(1)),
    vapply(c("pleno", "satisfactorio", "parcial", "insuficiente", "critico", "nulo", "otra"),
           monitoreo_aulas_etiqueta_tramo, character(1)),
    vapply(c("sin_cuota", "asegurada", "ajustada", "deficit_proyectado", "deficit_no_subsanable", "otra"),
           function(e) .mac_etiqueta_estado(e, 3L), character(1)),
    vapply(list(0.85, 1.2, 1, NA_real_), .mac_etiqueta_calibracion, character(1))
  )
}
