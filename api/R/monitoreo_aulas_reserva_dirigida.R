# =============================================================================
# Reserva dirigida: a que aula ir cuando falta un sexo en una facultad
# =============================================================================
#
# POR QUE EXISTE
#
# El banco de extras es hoy un RESIDUO: `extra_pool_policy =
# "leftover_after_chains"`, o sea lo que sobro tras armar las cadenas. Derecho
# tiene 241 extras y Educacion 3, y ese reparto no sale de ninguna brecha
# medida.
#
# Pero tienen funcion declarada (Gonzalo, 2026-08-18): no reemplazan a nadie,
# son aulas adicionales para **cerrar la cuota de hombres y mujeres por
# facultad**. Y esa brecha si es dimensionable.
#
# CUANTO RINDE ELEGIR BIEN. Medido sobre HSVG 2026: de las 443 aulas de DERECHO
# que quedan fuera del plan, la mejor aporta **40,6 mujeres efectivas esperadas**
# contra **14,5** de la mediana del banco — **2,8x**. Y las aulas no son
# homogeneas: en DERECHO la composicion va del 38 % al 95 % de mujeres.
#
# POR QUE ES LEGITIMO, Y CON QUE CONDICION
#
# El sexo YA es variable de estratificacion del diseño, asi que elegir un aula
# para cerrar una celda **completa la estratificacion, no la rompe**. Y la
# alternativa real no es no hacer nada: es PONDERAR, que es lo que se hizo en
# 2025 con EE.GG. LETRAS hombres (166 de 180, peso 1,1538). Conseguir las
# encuestas de verdad es mejor que inflar 156 casos hasta 180 con un peso,
# porque el peso asume que los 24 que faltan se parecen a los 156 que estan.
#
# El riesgo que si existe: dentro de una facultad, las aulas con 90 % de mujeres
# pueden ser cursos de una especialidad cuyos estudiantes difieran en lo que se
# mide. Es de segundo orden, pero real. **La condicion innegociable es marcar**
# las encuestas que salgan de un extra dirigido, para poder correr la estimacion
# con y sin ellas. Un peso no permite esa comprobacion; una marca si. Por eso
# cada candidato viaja con `origen_dirigido` y la razon de su eleccion.
#
# LO QUE ESTE MOTOR NO HACE: decidir. Devuelve el orden y las cifras; a que aula
# se va y cuantas se activan es del operativo.

MONITOREO_AULAS_RESERVA_DIRIGIDA_SCHEMA <- "monitoreo_aulas_reserva_dirigida_v1"

# Los alumnos de un aula que cuentan para ESTA celda: los de la facultad de la
# celda Y de su sexo, descontando los que ya se midieron en otra aula.
#
# El descuento no es un refinamiento: en 2025, 446 alumnos de las 194 aulas
# aplicadas ya habian sido medidos en otra (`ya_medidas`). Sin descontarlos, un
# aula que solapa entera con lo ya visitado parece aportar y no aporta nada.
.mard_aporte <- function(aula, sexo, ya_medidos) {
  s1 <- toupper(.monitoreo_scalar(aula$sex_top_1 %||% "", ""))
  s2 <- toupper(.monitoreo_scalar(aula$sex_top_2 %||% "", ""))
  n1 <- suppressWarnings(as.numeric(.monitoreo_scalar(aula$sex_top_1_n %||% 0, 0))[1])
  n2 <- suppressWarnings(as.numeric(.monitoreo_scalar(aula$sex_top_2_n %||% 0, 0))[1])
  n1 <- if (is.finite(n1)) n1 else 0
  n2 <- if (is.finite(n2)) n2 else 0
  total <- n1 + n2
  del_sexo <- if (identical(s1, sexo)) n1 else if (identical(s2, sexo)) n2 else 0
  if (total <= 0 || del_sexo <= 0) return(list(elegibles = 0, netos = 0, solape = 0))
  # Traslape: los ids que ya se midieron. Sin ids no se puede descontar y se
  # DECLARA, en vez de asumir que no hay solape —que es la suposicion optimista—.
  ids <- .monitoreo_scalar(aula$unique_student_ids %||% "", "")
  solape <- 0
  if (nzchar(ids) && length(ya_medidos)) {
    propios <- strsplit(ids, "|", fixed = TRUE)[[1]]
    propios <- propios[nzchar(propios)]
    if (length(propios)) {
      # El solape se reparte en la proporcion del sexo: los ids no vienen
      # etiquetados, asi que atribuir todo el solape a este sexo lo castigaria
      # de mas y atribuirle cero lo premiaria. Se declara el supuesto.
      solape <- sum(propios %in% ya_medidos) * (del_sexo / total)
    }
  }
  list(elegibles = del_sexo, netos = max(0, del_sexo - solape), solape = solape)
}

#' Candidatos del banco para cerrar una celda facultad x sexo.
#'
#' @param pool lista de aulas disponibles fuera del plan.
#' @param facultad facultad de la celda.
#' @param sexo `"F"` o `"M"`.
#' @param tasa_aula función que da la tasa de efectividad de un aula por su
#'   número de elegibles; por defecto, la del rendimiento por tramo.
#' @param ya_medidos ids de alumnos ya medidos en otras aulas.
#' @param tope cuántos candidatos devolver.
#' @return lista ordenada por aporte esperado a ESA celda.
#' @export
monitoreo_aulas_reserva_dirigida <- function(pool = list(), facultad = "", sexo = "F",
                                             tasa_aula = NULL, ya_medidos = character(0),
                                             tope = 5L) {
  fac <- .monitoreo_text_key(facultad)
  sexo <- toupper(.monitoreo_scalar(sexo, "F"))
  if (!nzchar(fac) || !length(pool)) return(list())
  if (!is.function(tasa_aula)) tasa_aula <- function(n) .cm_efectividad_rendimiento(n)
  filas <- list()
  for (a in pool) {
    if (!is.list(a)) next
    # **Sólo aulas de ESA facultad.** Es el punto entero del ítem: un aula que
    # aporta 60 alumnos de otra facultad no cierra esta celda.
    if (!identical(.monitoreo_text_key(a$faculty %||% ""), fac)) next
    ap <- .mard_aporte(a, sexo, ya_medidos)
    if (ap$netos <= 0) next
    elig <- suppressWarnings(as.numeric(.monitoreo_scalar(a$eligible_n %||% 0, 0))[1])
    if (!is.finite(elig) || elig <= 0) elig <- ap$elegibles
    tasa <- suppressWarnings(as.numeric(tasa_aula(elig))[1])
    if (!is.finite(tasa) || tasa <= 0) next
    filas[[length(filas) + 1L]] <- list(
      classroom_id = .monitoreo_scalar(a$classroom_id %||% a$operational_code %||% "", ""),
      faculty = .monitoreo_scalar(a$faculty %||% "", ""),
      sexo = sexo,
      elegibles_del_sexo = round(ap$elegibles, 1),
      solape_estimado = round(ap$solape, 1),
      # El aporte que cierra la celda: alumnos de ESA facultad y ESE sexo, netos
      # de lo ya medido, por la tasa de efectividad del aula.
      aporte_esperado = round(ap$netos * tasa, 1),
      tasa_efectividad = round(tasa, 3),
      solape_medible = nzchar(.monitoreo_scalar(a$unique_student_ids %||% "", "")),
      # **La marca, sin la cual esto no se puede usar.** Sirve para correr la
      # estimacion con y sin estas encuestas: un peso no permite comprobarlo.
      origen_dirigido = TRUE,
      motivo = sprintf("Aporta %s de %s a la cuota de %s de %s",
                       round(ap$netos * tasa, 1), round(ap$elegibles, 1),
                       if (identical(sexo, "F")) "mujeres" else "hombres",
                       .monitoreo_scalar(a$faculty %||% "", ""))
    )
  }
  if (!length(filas)) return(list())
  orden <- order(-vapply(filas, function(f) f$aporte_esperado, numeric(1)),
                 vapply(filas, function(f) f$classroom_id, character(1)))
  utils::head(filas[orden], max(0L, as.integer(tope)[1]))
}
