# Qué parámetros consume cada técnica (hallazgo G2 del loop).
#
# Método mostraba los mismos ocho campos para cualquier técnica: DEFF en un
# MAS (que lo fija en 1), «Cobertura 0,5» en un probabilístico (que no la
# lee) y el piso por celda donde no hay celdas. Un campo que no mueve nada es
# peor que un campo ausente: el usuario lo ajusta y cree que ajustó el
# diseño. La superficie pinta sólo lo que esta tabla declara.
#
# La tabla se declara, no se deduce: algunos parámetros actúan sólo bajo una
# condición (el piso de la conveniencia, únicamente con estratos). El test
# `test-calc-muestra-general-parametros.R` comprueba el sentido que importa:
# todo parámetro que cambia el resultado en algún escenario está declarado.

.CM_PARAMETROS_POR_TECNICA <- list(
  prob_aleatorio_simple = c("z", "p", "e", "tasa_respuesta", "oversample_pct"),
  sistematico = c("z", "p", "e", "tasa_respuesta", "oversample_pct"),
  prob_estratificado = c("z", "p", "e", "deff", "tasa_respuesta", "oversample_pct", "n_minimo_estrato",
                         "asignacion"),
  intencion_censal = c("cobertura_objetivo", "tasa_respuesta"),
  barrido = c("cobertura_objetivo", "tau", "oversample_pct"),
  no_prob_cuotas = c("tasa_respuesta", "oversample_pct"),
  no_prob_conveniencia = c("cobertura_objetivo", "n_minimo_estrato", "tope_operativo",
                           "tasa_respuesta", "oversample_pct"),
  listado_externo_meta_fija = c("tasa_contacto", "tasa_elegibilidad", "tasa_respuesta"),
  # Técnicas de aulas: se gobiernan desde su propio modo.
  prob_conglomerado_multietapico = c("z", "p", "e", "deff", "tau", "oversample_pct",
                                     "promedio_conglomerado", "estadistico_conglomerado"),
  prob_estratificado_independiente = c("z", "p", "e", "deff", "oversample_pct")
)

.CM_PARAMETROS_DESCRIPCION <- list(
  z = list(rotulo = "Nivel de confianza", ayuda = "Se ingresa como z: 1,645 = 90 %, 1,96 = 95 %, 2,576 = 99 %."),
  p = list(rotulo = "Proporción esperada", ayuda = "Sin estimación previa, 0,5 es lo conservador."),
  e = list(rotulo = "Margen de error", ayuda = "Como proporción: 0,05 = ±5 puntos."),
  deff = list(rotulo = "Efecto de diseño", ayuda = "1 si no hay conglomerados; mayor que 1 si el diseño pierde precisión."),
  tasa_respuesta = list(rotulo = "Tasa de respuesta", ayuda = "El n a campo es el n de completas dividido por esta tasa."),
  oversample_pct = list(rotulo = "Sobremuestra", ayuda = "Reserva adicional sobre los casos a abordar."),
  n_minimo_estrato = list(rotulo = "Piso por estrato", ayuda = "Mínimo de casos por estrato, sin pasar del tamaño del estrato."),
  cobertura_objetivo = list(rotulo = "Cobertura objetivo", ayuda = "Fracción del marco que se busca cubrir."),
  tope_operativo = list(rotulo = "Tope por estrato", ayuda = "Máximo de casos por estrato."),
  tau = list(rotulo = "Tasa de asistencia", ayuda = "Fracción de la unidad presente al aplicar."),
  tasa_contacto = list(rotulo = "Tasa de contacto", ayuda = "Fracción del listado que se logra contactar."),
  tasa_elegibilidad = list(rotulo = "Tasa de elegibilidad", ayuda = "Fracción de contactados que cumple el perfil."),
  promedio_conglomerado = list(rotulo = "Tamaño medio del conglomerado", ayuda = "Personas por unidad de conglomerado."),
  estadistico_conglomerado = list(rotulo = "Estadístico del conglomerado", ayuda = "Media, mediana o el menor de ambos.",
                                  tipo = "opciones", opciones = c("media", "mediana", "min_media_mediana")),
  asignacion = list(rotulo = "Asignación entre estratos",
                    ayuda = "Proporcional reparte según el tamaño del estrato; Neyman, según tamaño × variabilidad (necesita la proporción esperada de cada estrato) y da menos error con el mismo n.",
                    tipo = "opciones", opciones = c("proporcional", "neyman"))
)

#' Parámetros que consume una técnica, con rótulo y ayuda.
#' @return list(tecnica, parametros = list(list(clave, rotulo, ayuda, tipo,
#'   opciones?), ...)); tipo = "numero" | "opciones".
calc_muestra_parametros_tecnica <- function(tecnica) {
  claves <- .CM_PARAMETROS_POR_TECNICA[[tecnica]] %||% character(0)
  list(tecnica = tecnica, parametros = lapply(claves, function(k) {
    d <- .CM_PARAMETROS_DESCRIPCION[[k]] %||% list(rotulo = k, ayuda = "")
    out <- list(clave = k, rotulo = d$rotulo, ayuda = d$ayuda, tipo = d$tipo %||% "numero")
    if (!is.null(d$opciones)) out$opciones <- as.list(d$opciones)
    out
  }))
}
