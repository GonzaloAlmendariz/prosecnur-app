# =============================================================================
# El resumen de la publicación de aulas: qué cifra va bajo cada rótulo
# =============================================================================
#
# La hoja que ve el cliente publicaba «Reemplazos usados» con el KPI
# `reemplazos_usados`, que NO cuenta reemplazos: suma reservas con
# `replacement_for` en estado agendada / en campo / aplicada / cerrada /
# parcial, o sea reservas EN JUEGO. Sobre HSVG2026 «como 2025» vale 174 —el
# número de titulares— mientras los titulares que de verdad se cayeron y fueron
# sustituidos son 18.
#
# El frontend lo tenía advertido en tres sitios y ninguna advertencia llegó
# hasta el entregable.

.mapr_reports <- function(reemplazada = 18L, con_kpi = 174L) {
  list(
    kpis = list(
      total_aulas = 1347L, aulas_titulares = 174L, aulas_aplicadas = 152L,
      aulas_parciales = 0L, reemplazos_usados = con_kpi,
      respuestas_validas = 2668L, brechas = 98L
    ),
    course_status_estados = list(
      list(clave = "cerrando", aulas = 152L),
      list(clave = "reemplazada", aulas = reemplazada),
      list(clave = "en_reserva", aulas = 1232L)
    )
  )
}

.mapr_valor <- function(reports, indicador) {
  m <- .monitoreo_publication_aulas_model_frames(list(), reports, "client")
  r <- m$resumen
  if (!is.data.frame(r) || !nrow(r)) return(NA_integer_)
  fila <- r[r$Indicador == indicador, , drop = FALSE]
  if (!nrow(fila)) return(NA_integer_)
  as.integer(fila$Valor[[1]])
}

test_that("el resumen publica los titulares reemplazados, no las reservas en juego", {
  reports <- .mapr_reports()
  expect_equal(.mapr_valor(reports, "Cursos-horario reemplazados"), 18L)
  # Y el rótulo viejo ya no existe: nombraba una cantidad que no publicaba.
  expect_true(is.na(.mapr_valor(reports, "Reemplazos usados")))
})

test_that("no se cuela el KPI aunque valga otra cosa", {
  # El mutante: si alguien devolviera `reemplazos_usados`, aquí saldría 999.
  reports <- .mapr_reports(reemplazada = 18L, con_kpi = 999L)
  expect_equal(.mapr_valor(reports, "Cursos-horario reemplazados"), 18L)
})

test_that("sin reparto de estados la cifra es cero y no el KPI", {
  # Un payload viejo sin `course_status_estados` no puede decir cuántos se
  # reemplazaron: cero es lo que se sabe, y el KPI diría 174.
  reports <- .mapr_reports()
  reports$course_status_estados <- NULL
  expect_equal(.mapr_valor(reports, "Cursos-horario reemplazados"), 0L)
})

test_that("las demás cifras del resumen siguen saliendo del KPI", {
  reports <- .mapr_reports()
  expect_equal(.mapr_valor(reports, "Cursos-horario del plan, con reservas"), 1347L)
  expect_equal(.mapr_valor(reports, "Aulas aplicadas"), 152L)
  expect_equal(.mapr_valor(reports, "Respuestas validas"), 2668L)
  expect_equal(.mapr_valor(reports, "Brechas aula"), 98L)
})

# --- el universo: lo que hay que aplicar contra el tamano del plan ------------

test_that("«a aplicar» son los titulares y el plan con reservas va aparte", {
  # `total_aulas` cuenta el plan sin banco: 174 titulares mas 1.173 reservas
  # encadenadas. Junto a «aplicadas 152», publicarlo como «Aulas planificadas»
  # hacia leer 152 de 1.347 —un 11 %— donde va un 87 %.
  reports <- .mapr_reports()
  expect_equal(.mapr_valor(reports, "Cursos-horario a aplicar"), 174L)
  expect_equal(.mapr_valor(reports, "Cursos-horario del plan, con reservas"), 1347L)
  # Y el rotulo viejo ya no existe: nombraba el plan entero como si fuera lo que
  # hay que aplicar.
  expect_true(is.na(.mapr_valor(reports, "Aulas planificadas originalmente")))
})

test_that("sin `aulas_titulares` cae al plan sin banco, que es la conducta anterior", {
  # Un payload anterior a que el KPI existiera no puede saber cuantos titulares
  # hay; publicar cero seria peor que publicar el plan.
  reports <- .mapr_reports()
  reports$kpis$aulas_titulares <- NULL
  expect_equal(.mapr_valor(reports, "Cursos-horario a aplicar"), 1347L)
})
