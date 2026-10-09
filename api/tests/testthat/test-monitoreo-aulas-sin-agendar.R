# =============================================================================
# test-monitoreo-aulas-sin-agendar.R — la tabla de «a qué se puede entrar»
# =============================================================================
#
# Gonzalo, 2026-09-21: «el despliegue de las semanas [debe incluir] al lado una
# tabla con los cursos-horario no agendados que se podrían ir a aplicar, pero
# deben estar ordenados por fecha y por día (repetirse si toman más de un día)
# […] sólo tendrían que tener bien clara la hora de inicio y fin de la clase y
# el aula donde se dan».
#
# Contrato de `monitoreo_aulas_sin_agendar_por_dia(plan, desde, hasta)`:
#
# - La unidad es (curso-horario, DÍA de sesión), no el curso-horario: el que se
#   dicta dos días sale DOS veces, una por fecha.
# - Orden total: fecha → hora de inicio → código. Determinista.
# - SÓLO TITULARES. Gonzalo, 2026-09-21: «ojo, son las titulares no agendadas
#   por agendar, no todas; o sea no reemplazos ni extras».
# - No se ofrece lo que el resto del perfil no cuenta: con cita pactada,
#   retirada, rechazada por el docente, o aplicada de hecho.
# - El AULA: con una sola, viaja en `aula`; con varias, `aula` va VACÍA y
#   mandan `aulas` + `aula_incierta`. Ver la cabecera del motor: el catálogo
#   construye días y aulas con funciones distintas y su orden no se promete.
# - Lo que no tiene horario legible viaja en `sin_horario` con su motivo.
#
# Fixtures 100% sintéticos: los nombres del catálogo real son PII.

.masat_fila <- function(codigo, sesiones = "", venue = "", fecha = "",
                        estado = "", muestra = "", validas = NA, efectivas = NA,
                        rol = "titular",
                        curso = "CURSO SINTÉTICO", docente = "DOCENTE, SINTÉTICO") {
  f <- list(operational_code = codigo, course_name = curso, teacher = docente,
            modality = "PRESENCIAL", eligible_n = 20, sample_role = rol)
  if (nzchar(sesiones)) f[["sesiones_dia_hora"]] <- sesiones
  if (nzchar(venue)) f[["venue"]] <- venue
  if (nzchar(fecha)) f[["scheduled_date"]] <- fecha
  if (nzchar(estado)) f[["operational_status"]] <- estado
  if (nzchar(muestra)) f[["sample_status"]] <- muestra
  if (!is.na(validas)) f[["respuestas_validas"]] <- validas
  if (!is.na(efectivas)) f[["effective_surveys"]] <- efectivas
  f
}

.masat_dia <- function(res, fecha) {
  for (d in res[["dias"]] %||% list()) if (identical(d[["fecha"]], fecha)) return(d)
  NULL
}

.masat_codigos <- function(res, fecha) {
  d <- .masat_dia(res, fecha)
  if (is.null(d)) return(character(0))
  vapply(d[["cursos"]], function(c) as.character(c[["codigo"]]), character(1))
}

.masat_curso <- function(res, fecha, codigo) {
  d <- .masat_dia(res, fecha)
  for (c in (d %||% list())[["cursos"]] %||% list()) {
    if (identical(as.character(c[["codigo"]]), codigo)) return(c)
  }
  NULL
}

# 2026-09-21 es LUNES; la semana del 22 al 27 es martes→domingo.

test_that("un curso de dos días sale DOS veces, una por fecha", {
  # Es el centro del pedido: quien lee está mirando UN día, y una fila por
  # curso le obligaría a releer la cadena de días y decidir si le toca.
  res <- monitoreo_aulas_sin_agendar_por_dia(
    list(.masat_fila("CH 7", sesiones = "MAR y JUE 08:00-10:00", venue = "Z411")),
    "2026-09-21", "2026-09-27")
  expect_identical(.masat_codigos(res, "2026-09-22"), "CH 7")
  expect_identical(.masat_codigos(res, "2026-09-24"), "CH 7")
  expect_null(.masat_dia(res, "2026-09-23"))
  expect_identical(res[["total"]], 2L)
  # Y las dos filas traen lo único que el aplicador necesita en la puerta.
  a <- .masat_curso(res, "2026-09-22", "CH 7")
  expect_identical(a[["inicio"]], "08:00")
  expect_identical(a[["fin"]], "10:00")
  expect_identical(a[["aula"]], "Z411")
})

test_that("dos sesiones el MISMO día son dos oportunidades, no una", {
  res <- monitoreo_aulas_sin_agendar_por_dia(
    list(.masat_fila("R 30.1", sesiones = "MIE 10:00-12:00 · MIE 14:00-16:00", venue = "J205")),
    "2026-09-21", "2026-09-27")
  d <- .masat_dia(res, "2026-09-23")
  expect_length(d[["cursos"]], 2L)
  expect_identical(vapply(d[["cursos"]], function(c) c[["inicio"]], character(1)),
                   c("10:00", "14:00"))
})

test_that("el orden es fecha → hora → código, y no depende del orden de entrada", {
  plan <- list(
    .masat_fila("CH 9", sesiones = "MAR 15:00-17:00", venue = "A1"),
    .masat_fila("CH 2", sesiones = "MAR 08:00-10:00", venue = "A2"),
    .masat_fila("CH 1", sesiones = "MAR 08:00-10:00", venue = "A3"),
    .masat_fila("CH 5", sesiones = "MIE 08:00-10:00", venue = "A4")
  )
  res <- monitoreo_aulas_sin_agendar_por_dia(plan, "2026-09-22", "2026-09-27")
  expect_identical(vapply(res[["dias"]], function(d) d[["fecha"]], character(1)),
                   c("2026-09-22", "2026-09-23"))
  # Misma hora: manda el código, no la fila del plan.
  expect_identical(.masat_codigos(res, "2026-09-22"), c("CH 1", "CH 2", "CH 9"))
})

test_that("no se ofrece lo que el resto del perfil no cuenta", {
  plan <- list(
    .masat_fila("CH 1", sesiones = "MAR 08:00-10:00", venue = "A1"),
    # Con cita pactada: ya tiene su sitio en el reparto.
    .masat_fila("CH 2", sesiones = "MAR 08:00-10:00", venue = "A2", fecha = "2026-09-22"),
    # Retirada y rechazada: mandar a alguien es pedir un «no» por segunda vez.
    .masat_fila("CH 3", sesiones = "MAR 08:00-10:00", venue = "A3", estado = "cancelada"),
    .masat_fila("CH 4", sesiones = "MAR 08:00-10:00", venue = "A4", muestra = "RECHAZO"),
    # Aplicada de hecho: la evidencia manda sobre el estado escrito.
    .masat_fila("CH 5", sesiones = "MAR 08:00-10:00", venue = "A5", validas = 12),
    .masat_fila("CH 6", sesiones = "MAR 08:00-10:00", venue = "A6", efectivas = 8)
  )
  res <- monitoreo_aulas_sin_agendar_por_dia(plan, "2026-09-22", "2026-09-27")
  expect_identical(.masat_codigos(res, "2026-09-22"), "CH 1")
})

test_that("sólo TITULARES: un reemplazo o una extra no se ofrecen como «entra si puedes»", {
  # Gonzalo, 2026-09-21: «son las titulares no agendadas por agendar, no todas;
  # o sea no reemplazos ni extras». Un reemplazo existe para ocupar el sitio de
  # un titular que cayó; ofrecerlo aquí lo activaría por la puerta de atrás,
  # sin que nadie decidiera que el titular ya no va. En CCSS son 84
  # `chain_reserve` y 1 `extra_reserve_pool` de los 108 sin cita.
  plan <- list(
    .masat_fila("CH 1", sesiones = "MAR 08:00-10:00", venue = "A1"),
    .masat_fila("R 12.1", sesiones = "MAR 08:00-10:00", venue = "A2", rol = "chain_reserve"),
    .masat_fila("EXTRA 1", sesiones = "MAR 08:00-10:00", venue = "A3", rol = "extra_reserve_pool"),
    # Sin rol declarado tampoco entra: «titular» se afirma, no se supone.
    .masat_fila("CH 9", sesiones = "MAR 08:00-10:00", venue = "A4", rol = "")
  )
  res <- monitoreo_aulas_sin_agendar_por_dia(plan, "2026-09-22", "2026-09-27")
  expect_identical(.masat_codigos(res, "2026-09-22"), "CH 1")
})

test_that("con VARIAS aulas no se elige una: se declaran las dos", {
  # El catálogo arma días y aulas con funciones distintas —una reordena los
  # días a orden de calendario, la otra deduplica las aulas en orden de
  # entrada— así que «el día i va con el aula i» es una coincidencia que nadie
  # promete. Mandar a alguien al aula equivocada es un viaje perdido.
  res <- monitoreo_aulas_sin_agendar_por_dia(
    list(.masat_fila("CH 40", sesiones = "MIE y VIE 07:30-09:30", venue = "Z201 · Z413")),
    "2026-09-21", "2026-09-27")
  for (fecha in c("2026-09-23", "2026-09-25")) {
    c <- .masat_curso(res, fecha, "CH 40")
    expect_identical(c[["aula"]], "")
    expect_true(isTRUE(c[["aula_incierta"]]))
    expect_identical(unlist(c[["aulas"]]), c("Z201", "Z413"))
  }
})

test_that("dos días con UNA aula no es ambiguo: es la misma aula los dos días", {
  # El caso mayoritario —23 de los 29 de dos días en CCSS—: el dedupe del
  # catálogo colapsó dos aulas iguales, y esa ES la respuesta.
  res <- monitoreo_aulas_sin_agendar_por_dia(
    list(.masat_fila("CH 18", sesiones = "MAR y JUE 08:00-10:00", venue = "J309")),
    "2026-09-21", "2026-09-27")
  for (fecha in c("2026-09-22", "2026-09-24")) {
    c <- .masat_curso(res, fecha, "CH 18")
    expect_identical(c[["aula"]], "J309")
    expect_false(isTRUE(c[["aula_incierta"]]))
  }
})

test_that("el que no tiene horario legible se declara, no se descarta", {
  res <- monitoreo_aulas_sin_agendar_por_dia(list(
    .masat_fila("CH 1", sesiones = "MAR 08:00-10:00", venue = "A1"),
    .masat_fila("CH 8", sesiones = "A CONVENIR CON EL DOCENTE", venue = "A8"),
    .masat_fila("CH 9", sesiones = "", venue = "A9")
  ), "2026-09-22", "2026-09-27")
  expect_identical(.masat_codigos(res, "2026-09-22"), "CH 1")
  codigos <- vapply(res[["sin_horario"]], function(x) x[["codigo"]], character(1))
  expect_setequal(codigos, c("CH 8", "CH 9"))
  expect_true(all(nzchar(vapply(res[["sin_horario"]], function(x) x[["motivo"]], character(1)))))
})

test_that("el rango se sanea: ilegible no da tabla, invertido se corrige, absurdo se acota", {
  plan <- list(.masat_fila("CH 1", sesiones = "MAR 08:00-10:00", venue = "A1"))
  # Sin rango legible no hay tabla: una clase semanal sólo es una oportunidad
  # cuando se le pone fecha.
  for (r in list(c("", ""), c("ayer", "manana"), c("2026-09-22", ""))) {
    vacio <- monitoreo_aulas_sin_agendar_por_dia(plan, r[[1]], r[[2]])
    expect_length(vacio[["dias"]], 0L)
    expect_identical(vacio[["total"]], 0L)
  }
  # Invertido: la intención es el intervalo, no el orden en que se tecleó.
  inv <- monitoreo_aulas_sin_agendar_por_dia(plan, "2026-09-27", "2026-09-22")
  expect_identical(.masat_codigos(inv, "2026-09-22"), "CH 1")
  # Un año entero no cabe en una tabla que alguien lee de un vistazo.
  largo <- monitoreo_aulas_sin_agendar_por_dia(plan, "2026-09-22", "2027-09-22")
  expect_lte(length(largo[["dias"]]), 10L)
})

test_that("un plan sin nada que ofrecer devuelve la tabla vacía, no un error", {
  res <- monitoreo_aulas_sin_agendar_por_dia(list(), "2026-09-22", "2026-09-27")
  expect_identical(res[["total"]], 0L)
  expect_length(res[["dias"]], 0L)
  expect_length(res[["sin_horario"]], 0L)
})

test_that("sin rango declarado, la ventana es la de los días que el reparto enseña", {
  # `.madm_ventana_del_reparto()` devuelve vacío sin rango declarado, que es lo
  # correcto para «agendadas sin cita» —sin tanda no hay de qué faltar— pero
  # dejaba esta tabla en blanco justo cuando el usuario NO ha filtrado nada.
  # Medido el 2026-09-21 contra el proyecto real: `total = 0` sobre 23
  # titulares por agendar.
  rep <- list(rango = NULL, dias = list(
    list(fecha = "2026-09-22"), list(fecha = "2026-09-25"), list(fecha = "2026-09-24")))
  expect_identical(.masa_ventana_visible(rep),
                   list(desde = "2026-09-22", hasta = "2026-09-25"))
  # Con rango declarado manda el rango, no los días.
  con_rango <- rep
  con_rango[["rango"]] <- list(desde = "2026-09-01", hasta = "2026-09-03")
  expect_identical(.masa_ventana_visible(con_rango),
                   list(desde = "2026-09-01", hasta = "2026-09-03"))
  # Y sin ninguna de las dos cosas, puntas vacías: la tabla no se inventa una
  # semana.
  expect_identical(.masa_ventana_visible(list()), list(desde = "", hasta = ""))
  expect_identical(.masa_ventana_visible(NULL), list(desde = "", hasta = ""))
})
