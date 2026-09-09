# monitoreo_aulas_distribucion_aula.R — el aula de la hoja de los aplicadores
# sigue a la del libro.
#
# El hueco que Gonzalo señaló el 2026-09-09: «no se están actualizando las
# aulas con lo que el agendador está poniendo en LUGAR DE APLICACIÓN».
#
# Medido ese día sobre el operativo, 93 citas en la hoja de los veintidós:
# 6 con la celda AULA vacía teniendo el libro un lugar escrito (CH 35 M301,
# CH 40 E203, CH 82 D102, CH 69 L214, CH 133 L104, CH 83 D205) y 3 con un aula
# DISTINTA de la del libro (CH 74 L312 donde el libro dice L409, dos veces, y
# CH 135 H404 donde dice H411). Es decir: alguien iba a caminar hasta un aula
# que ya no era la suya.
#
# La causa era de reparto de oficios, no de lectura. Nadie escribía esa columna
# después de sembrarla:
#
#   - `monitoreo_aulas_sincronizar_distribucion()` añade las filas que faltan y
#     reescribe UNA columna, la del ESTADO. Las citas que ya estaban no se
#     tocaban.
#   - `monitoreo_aulas_completar_distribucion()` sí sabe qué falta, pero sólo
#     alimenta el recibo de LEER la distribución: su resultado se enseña y no
#     se escribe. Y además, por su propia regla —«lo que el equipo escribió no
#     se pisa»— sólo rellena vacíos, así que un aula corregida en el libro
#     jamás llegaba a la hoja.
#
# **Por qué el aula SÍ se pisa y el ESTADO no.** No es la misma clase de dato.
# El ESTADO lo teclea el coordinador sobre la marcha y es su declaración: la
# app lo respeta y como mucho observa. El aula NO es suya — la pacta quien
# agenda con la facultad y su casa es la columna LUGAR DE APLICACIÓN del libro,
# que es de donde sale la del plan. Que la hoja de los aplicadores conserve una
# copia vieja de un dato ajeno no es respetar a nadie: es mandar a alguien al
# aula equivocada.
#
# Ninguna corrección es silenciosa: cada una viaja en el recibo con su antes y
# su después, y el ensayo las enseña antes de escribir.

#' Qué debería decir la columna AULA de la hoja de los aplicadores.
#'
#' Recorre las filas TAL COMO van a quedar (cabecera incluida) y devuelve la
#' columna entera, lista para escribirse de una vez igual que la del ESTADO.
#'
#' Reglas, en este orden:
#'   - fila sin curso-horario legible, o curso-horario que el plan no conoce:
#'     se conserva lo escrito. La app no inventa un aula para una fila que no
#'     sabe leer.
#'   - el plan no declara aula (ni `scheduled_venue` ni `venue`): se conserva lo
#'     escrito. **Nunca se blanquea una celda**: un vacío del plan es «todavía
#'     no lo sé», no «no hay aula».
#'   - el plan declara aula: manda. Vacía → `rellenada`; distinta → `corregida`.
#'
#' El aula esperada se arma con la MISMA expresión que la siembra
#' (`aulas_libro_filas_plan_aplicadores()`): el lugar confirmado y, a falta de
#' él, el ambiente de la clase. Dos expresiones para el mismo valor acabarían
#' peleándose entre publicación y sincronización.
#'
#' @param filas filas de la hoja como van a quedar; la primera es la cabecera.
#' @param plan filas del plan de la sesión.
#' @return lista `{columna, cambios, rellenadas, corregidas, sin_dato}`.
#'   `columna` es `NULL` cuando la hoja no trae la columna AULA (entonces no hay
#'   nada que escribir y el resto va en cero).
#' @export
monitoreo_aulas_aulas_distribucion <- function(filas, plan = list()) {
  vacio <- list(columna = NULL, cambios = list(), rellenadas = 0L,
                corregidas = 0L, sin_dato = 0L)
  filas <- filas %||% list()
  if (length(filas) < 2L) return(vacio)

  n <- length(.alpa_CABECERA)
  cab <- .madc_valores(filas[[1L]], n)
  c_aula <- .madm_col(cab, "AULA")
  if (is.na(c_aula)) return(vacio)
  c_cod <- .madm_col(cab, "CURSO-HORARIO")
  if (is.na(c_cod)) return(vacio)
  c_fecha <- .madm_col(cab, "FECHA")

  # Código → aula que el plan pacta. `[[` de punta a punta: el `$` de R
  # parcial-matchea y `u$venue` pescaría cualquier `venue_*` que llegue.
  del_plan <- list()
  for (u in .madm_unidades(plan)) {
    cod <- .alpa_txt(u[["operational_code"]] %||% u[["classroom_id"]])
    if (!nzchar(cod) || !is.null(del_plan[[cod]])) next
    del_plan[[cod]] <- .alpa_txt(u[["scheduled_venue"]], .alpa_txt(u[["venue"]]))
  }

  columna <- character(length(filas))
  columna[[1L]] <- .madm_celda(cab, c_aula)
  cambios <- list()
  rellenadas <- 0L; corregidas <- 0L; sin_dato <- 0L

  for (r in seq(2L, length(filas))) {
    v <- .madc_valores(filas[[r]], n)
    escrito <- .madm_celda(v, c_aula)
    columna[[r]] <- escrito
    cod <- .madm_celda(v, c_cod)
    if (!nzchar(cod)) next
    esperado <- .alpa_txt(del_plan[[cod]] %||% "")
    if (!nzchar(esperado)) {
      # El plan no sabe dónde: se conserva lo que haya y se cuenta, porque una
      # cita sin aula en ninguno de los dos lados es un hueco del operativo,
      # no un acierto de la sincronización.
      if (!nzchar(escrito)) sin_dato <- sin_dato + 1L
      next
    }
    if (identical(escrito, esperado)) next
    columna[[r]] <- esperado
    motivo <- if (nzchar(escrito)) "corregida" else "rellenada"
    if (identical(motivo, "corregida")) corregidas <- corregidas + 1L else rellenadas <- rellenadas + 1L
    cambios[[length(cambios) + 1L]] <- list(
      curso_horario = cod,
      fecha = .madm_celda(v, c_fecha),
      antes = escrito,
      despues = esperado,
      motivo = motivo
    )
  }

  list(columna = columna, cambios = cambios, rellenadas = rellenadas,
       corregidas = corregidas, sin_dato = sin_dato)
}
