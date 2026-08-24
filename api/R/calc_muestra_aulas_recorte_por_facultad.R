# =============================================================================
# Cuanto recorta cada criterio del marco, facultad por facultad
# =============================================================================
#
# POR QUE EXISTE
#
# Es lo unico en lo que el diseño de Kamila (HSVG 2026) es mejor que el nuestro:
# ella mide el porcentaje de cada categoria DENTRO de cada facultad, publica la
# tabla y cambia la regla solo donde hay algo que cambiar. Nosotros producimos la
# matriz —`calc_muestra_aulas_matriz_embudo`, con el contrafactual por celda—
# pero nunca la publicamos con esa forma.
#
# LA REGLA QUE VA CON LA TABLA: **un criterio se declara solo en las facultades
# donde recorta algo.** Aplicarlo en bloque esconde que su efecto no es parejo:
#
#   . el filtro de tipo de docente se lleva el 43,8 % del marco de PSICOLOGIA
#     -33 de sus 39 caidas son «PRE-DOCENTE - JEFE DE PRACTICA», que ahi es la
#     forma normal de dictar- y el 0,0 % de CONTABLES y de EDUCACION;
#   . el criterio de nivel de curso de 2025 no recorta NADA en 8 de las 15
#     facultades.
#
# Un criterio que en una facultad no quita nada no es un criterio: es ruido en la
# documentacion. Y uno que se lleva la mitad del marco de otra necesita
# justificarse ahi, no en el promedio.
#
# LO QUE ESTE MOTOR NO HACE: cambiar ningun criterio. Solo mide y nombra.

CALC_MUESTRA_AULAS_RECORTE_SCHEMA <- "calc_muestra_aulas_recorte_por_facultad_v1"

# La frase de una fila. Sin jerga y con su denominador, que es la vara de la
# casa: «recorta el 43,8 %» no dice de que, y «43,8 % (39 de 89)» si.
.cmrf_etiqueta <- function(recortadas, antes, medible) {
  if (!isTRUE(medible)) return("No se pudo medir en esta facultad")
  if (!is.finite(antes) || antes <= 0) return("Sin aulas que evaluar")
  if (recortadas <= 0) return("No quita ninguna aula aqui")
  sprintf("Quita %d de %d aulas (%s %%)", as.integer(recortadas), as.integer(antes),
          format(round(100 * recortadas / antes, 1), nsmall = 1, trim = TRUE))
}

#' Cuanto recorta cada criterio en cada facultad.
#'
#' Se deriva de la matriz de embudo, que ya trae por celda el contrafactual
#' (`delta_ch`: cuantos curso-horario mas entrarian si esa regla se quitara solo
#' para esa facultad). De ahi salen las tres cifras que la tabla necesita:
#'
#'   despues    las aulas que la facultad tiene HOY en el marco
#'   antes      las que tendria sin ese criterio (despues + delta_ch)
#'   recortadas delta_ch
#'
#' @param matriz salida de `calc_muestra_aulas_matriz_embudo`.
#' @return lista por criterio con sus filas por facultad y el resumen de en
#'   cuantas recorta.
#' @export
calc_muestra_aulas_recorte_por_facultad <- function(matriz) {
  if (!is.list(matriz) || !length(matriz$rows)) return(list())
  columnas <- matriz$columns %||% list()
  if (!length(columnas)) return(list())
  # La fila Total no entra en el reparto por facultad: es el mismo dato en otro
  # grano y mezclarla haria que «en cuantas facultades recorta» contara una de
  # mas.
  filas_fac <- Filter(function(r) !identical(.cm_aulas_scalar(r$row_kind, ""), "total"), matriz$rows)
  lapply(columnas, function(col) {
    cid <- .cm_aulas_scalar(col$criterion_id, "")
    filas <- lapply(filas_fac, function(r) {
      celda <- NULL
      for (c1 in (r$cells %||% list())) {
        if (identical(.cm_aulas_scalar(c1$criterion_id, ""), cid)) { celda <- c1; break }
      }
      despues <- suppressWarnings(as.numeric(r$n_ch_elegibles)[1])
      delta <- suppressWarnings(as.numeric(celda$delta_ch %||% NA)[1])
      medible <- is.finite(delta) && is.finite(despues)
      antes <- if (medible) despues + delta else NA_real_
      list(
        faculty_key = .cm_aulas_scalar(r$faculty_key, ""),
        faculty_label = .cm_aulas_scalar(r$faculty_label, r$faculty_key),
        antes = if (medible) as.integer(antes) else NA_integer_,
        despues = if (is.finite(despues)) as.integer(despues) else NA_integer_,
        recortadas = if (medible) as.integer(delta) else NA_integer_,
        pct_recortado = if (medible && antes > 0) round(100 * delta / antes, 1) else NA_real_,
        # **Aplica sólo donde recorta.** Es la regla, y viaja como dato para que
        # la superficie no tenga que deducirla de un cero.
        aplica = medible && is.finite(delta) && delta > 0,
        medible = medible,
        etiqueta = .cmrf_etiqueta(if (medible) delta else NA_real_,
                                  if (medible) antes else NA_real_, medible)
      )
    })
    aplican <- Filter(function(f) isTRUE(f$aplica), filas)
    list(
      criterion_id = cid,
      label = .cm_aulas_scalar(col$label, cid),
      filas = filas,
      facultades_donde_recorta = length(aplican),
      facultades_evaluadas = length(Filter(function(f) isTRUE(f$medible), filas)),
      # El titular de la tabla, en una frase: es lo que hace visible que el
      # efecto no es parejo sin obligar a leer quince filas.
      etiqueta = if (!length(filas)) "Sin facultades que evaluar"
                 else if (!length(aplican)) "No quita ninguna aula en ninguna facultad"
                 else sprintf("Quita aulas en %d de %d facultades",
                              length(aplican), length(Filter(function(f) isTRUE(f$medible), filas)))
    )
  })
}
