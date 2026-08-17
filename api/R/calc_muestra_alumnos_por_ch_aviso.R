#' Cuando el estudio calcula sin decidir los alumnos por CH, que lo diga
#'
#' `calc_muestra_alumnos_por_ch_resolver_estudio` devuelve el estudio intacto
#' cuando `alumnos_por_ch_decision` es `NULL` —compatibilidad explícita con los
#' proyectos anteriores al contrato v1—. El motor sigue adelante y calcula las
#' aulas de las quince facultades con UN ÚNICO `avg_conglomerado` global, y
#' hasta ahora no lo mencionaba en ninguna parte.
#'
#' Ese silencio es el defecto. La cantidad de aulas de cada facultad depende de
#' cuántos alumnos elegibles hay por curso-horario ALLÍ —de 16 en Letras y
#' Ciencias Humanas a 46 en Estudios Generales Letras en HSVG2026—, así que
#' resolverlo con un promedio único no es una aproximación menor: en las
#' facultades pequeñas cambia si el estudio es siquiera factible. Quien lee el
#' resultado tiene derecho a saber que esa decisión está pendiente.
#'
#' No se confirma nada por el analista: la decisión sigue exigiendo su firma
#' (`confirmado_at`). Sólo se hace visible que falta.
#'
#' @keywords internal
NULL

#' Marca las filas de `aulas_por_estrato` que se calcularon sin decisión
#'
#' Aditivo: añade `alumnos_por_ch$estado` y deja intactos `avg_conglomerado` y
#' `estadistico_usado`, que siguen siendo los que el motor aplicó de verdad.
#'
#' @param estudio Estudio ya calculado.
#' @return El estudio con la marca en cada fila de `aulas_por_estrato`.
#' @keywords internal
.cm_alumnos_por_ch_marcar_sin_decision <- function(estudio) {
  if (!is.list(estudio) || !is.list(estudio$componentes)) return(estudio)
  for (i in seq_along(estudio$componentes)) {
    comp <- estudio$componentes[[i]]
    aulas <- comp$resultado$aulas_por_estrato
    if (!is.list(aulas) || !length(aulas)) next
    estudio$componentes[[i]]$resultado$aulas_por_estrato <- lapply(aulas, function(row) {
      if (!is.list(row)) return(row)
      # Una fila ya resuelta por facultad trae su propio bloque: no se pisa.
      if (is.list(row$alumnos_por_ch)) return(row)
      row$alumnos_por_ch <- list(
        estado = "sin_decision",
        referencia = "promedio_global",
        aviso = paste(
          "Las aulas de esta facultad se calcularon con el promedio global de",
          "alumnos por curso-horario. Confirma la decisión de alumnos por CH",
          "para que cada facultad use su propia cifra."
        )
      )
      row
    })
  }
  estudio
}
