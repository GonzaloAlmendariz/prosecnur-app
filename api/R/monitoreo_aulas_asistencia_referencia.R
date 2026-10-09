# El embudo de asistencia del estudio de referencia, traido a Monitoreo.
#
# **El puente que faltaba.** El plan de monitoreo guarda el PRODUCTO
# —`tasa_efectividad_aula` = `rendimiento_ref` x `factor_facultad`— y no los dos
# factores por separado, asi que el tablero no podia decir «de 28 elegibles
# esperabamos ver 25 y que respondieran 14,5» aunque el estudio lo tenga
# calculado dos modulos mas atras.
#
# Gonzalo, 2026-09-10, y tenia razon: «en todo el calculo de la muestra se tiene
# esa informacion, se han hecho hasta Excels hablando de cuales son los
# esperables por facultad, cuales son los esperables por aula especifica. Que no
# se tenga esa informacion guardada habiendo todo un proceso de diseño complejo
# detras me parece un error gigantesco».
#
# Lo que se trae es la dimension FACULTAD del embudo, que es la que el tablero
# usa: `calc_muestra_referencia_asistencia$embudos`, medido sobre HSVG2026 —
# ARQUITECTURA Y URBANISMO: 237 elegibles -> 215 asistentes -> 203 elegibles
# presentes -> 171 efectivas.
#
# **No se copia el embudo entero.** Trae seis dimensiones y una de ellas
# —`profile_distributions`— pesa 22 312 filas; el `.pulso` no necesita otra
# copia. Se guardan las nueve cifras por facultad que el tablero lee.

.maar_num <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% NA))
  if (!length(v) || !is.finite(v[1])) NA_real_ else v[1]
}

.maar_txt <- function(x) {
  v <- as.character(x %||% "")
  if (!length(v) || is.na(v[1])) "" else trimws(v[1])
}

#' El embudo de asistencia por facultad, en la forma compacta que guarda la config.
#'
#' @param referencia El bloque `calc_muestra_referencia_asistencia` de la sesion.
#' @return lista con `facultades` (una entrada por facultad) y `unidad`, o `NULL`
#'   si la referencia no trae el embudo por facultad.
#' @export
monitoreo_aulas_asistencia_referencia <- function(referencia = NULL) {
  if (!is.list(referencia)) return(NULL)
  embudos <- referencia$embudos %||% list()
  if (!length(embudos)) return(NULL)
  fac <- NULL
  for (e in embudos) if (identical(.maar_txt(e$dimension_key), "facultad")) fac <- e
  if (is.null(fac) || !length(fac$filas %||% list())) return(NULL)

  filas <- lapply(fac$filas, function(f) list(
    facultad = .maar_txt(f$celda_label),
    # `k` son los encuentros que sostienen la celda: sin el, una tasa de una sola
    # aula se lee igual que una de cuarenta. Es la misma cautela que
    # `MINIMO_PARA_COMPARAR` en el ranking.
    k = as.integer(.maar_num(f$k) %||% 0),
    elegibles = .maar_num(f$elegibles),
    asistentes = .maar_num(f$asistentes),
    elegibles_presentes = .maar_num(f$elegibles_presentes),
    efectivas = .maar_num(f$efectivas),
    pct_ausencia = .maar_num(f$pct_ausencia),
    pct_ya_medidas = .maar_num(f$pct_ya_medidas),
    pct_rechazo = .maar_num(f$pct_rechazo),
    # Las dos tasas del embudo, y NO son la misma: `efectividad` es sobre los
    # elegibles PRESENTES y `rendimiento` sobre los elegibles del aula. Traerlas
    # con sus dos nombres evita que el tablero elija una y la rotule con la
    # palabra de la otra, que es la familia de defectos de este perfil.
    efectividad = .maar_num(f$efectividad),
    rendimiento = .maar_num(f$rendimiento)
  ))
  nombres <- vapply(filas, function(f) f$facultad, character(1))
  filas <- filas[nzchar(nombres)]
  if (!length(filas)) return(NULL)

  list(
    schema = "monitoreo_aulas_asistencia_referencia_v1",
    # De donde sale y de cuando: sin esto, una tasa del estudio de 2025 se lee
    # como si fuera del operativo de hoy.
    estudio = .maar_txt(referencia$estudio$label),
    unidad = .maar_txt(referencia$unidad),
    denominador = .maar_txt(referencia$denominador),
    facultades = stats::setNames(filas, vapply(filas, function(f) f$facultad, character(1)))
  )
}
