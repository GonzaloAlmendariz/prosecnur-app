# Un aula del BANCO, una vez agendada, es un aula como cualquier otra.
#
# Pregunta de Gonzalo (2026-09-12, textual): «Y tampoco se si la distribucion de
# aplicadores yen general toda la app toma en cuenta las hojas Extra».
#
# El banco vive en sus dos pestañas propias («Aulas Agendadas (Extra)» y «Aulas
# Aplicadas (Extra)») y llega al plan con `sample_role == "extra_reserve_pool"`.
# Medido en el operativo ese día: las 45 filas del banco estaban SIN agendar (9
# «REFUERZO POR CONTACTAR», 36 «SIN CONTACTAR»), así que la pregunta no la podía
# contestar el dato real — ninguna había recorrido el camino todavía.
#
# Lo que la app hace hoy es no mirar el rol en ninguno de los tres escalones:
# entra por fecha + hora, como los titulares. Eso NO estaba pineado, y era fácil
# de perder: media docena de motores de monitoreo SÍ filtran
# `extra_reserve_pool` a propósito (`origen_vigente`, `dos_tasas`,
# `rol_y_estado`, `universitarias`…), así que añadir el filtro «por coherencia»
# al reparto o al plan del día es el error natural. Si alguien lo hace, estos
# tres pines se lo dicen: un aula agendada que nadie va a aplicar es gente que
# no llega al aula.

.mxa_fila <- function(codigo, fecha = "", hora = "", rol = "titular") {
  fila <- list(operational_code = codigo, sample_role = rol,
               classroom_id = tolower(gsub(" ", "", codigo)),
               faculty = "CIENCIAS SOCIALES", course_name = "Curso del banco",
               teacher = "Docente Banco")
  if (nzchar(fecha)) fila[["scheduled_date"]] <- fecha
  if (nzchar(hora)) fila[["scheduled_time"]] <- hora
  fila
}

# 2026-09-11 es VIERNES.
.mxa_plan <- function() list(
  .mxa_fila("CH 1", "2026-09-11", "10:00"),
  .mxa_fila("EXTRA 7", "2026-09-11", "11:00", rol = "extra_reserve_pool"),
  # Y uno del banco SIN agendar, que debe seguir fuera: el banco dormido no es
  # una cita, y contarlo inventaría trabajo de campo que nadie pactó.
  .mxa_fila("EXTRA 8", rol = "extra_reserve_pool")
)

.mxa_disp <- function() list(
  list(nombre = "Nora Completa", dias = list(viernes = list(list(inicio = "08:00", fin = "20:00")))),
  list(nombre = "Ana Prueba", dias = list(viernes = list(list(inicio = "08:00", fin = "20:00"))))
)

test_that("un EXTRA agendado abre ventana como cualquier aula, y el dormido no", {
  v <- monitoreo_aulas_ventanas(.mxa_plan())
  codigos <- vapply(v[["aulas"]] %||% list(),
                    function(x) as.character(x[["codigo"]]), character(1))
  expect_true("EXTRA 7" %in% codigos)
  ex <- Filter(function(x) identical(x[["codigo"]], "EXTRA 7"), v[["aulas"]])[[1]]
  expect_identical(ex[["ventana"]], "confirmada")
  expect_identical(ex[["fecha"]], "2026-09-11")
  # El dormido SÍ sale del censo —este motor enumera el plan entero— pero sin
  # ventana: es el escalón siguiente, el que pide gente, el que lo deja fuera.
  dormido <- Filter(function(x) identical(x[["codigo"]], "EXTRA 8"), v[["aulas"]])[[1]]
  expect_identical(dormido[["ventana"]], "sin_ventana")
})

test_that("el reparto le asigna aplicador a un EXTRA agendado", {
  res <- monitoreo_aulas_reparto(.mxa_plan(), .mxa_disp())
  dia <- Filter(function(d) identical(d[["fecha"]], "2026-09-11"), res[["dias"]])[[1]]
  asignados <- vapply(dia[["asignaciones"]],
                      function(a) as.character(a[["codigo"]]), character(1))
  expect_true("EXTRA 7" %in% asignados)
  # Con aplicador de verdad, no un hueco con nombre.
  a <- Filter(function(x) identical(x[["codigo"]], "EXTRA 7"), dia[["asignaciones"]])[[1]]
  expect_true(nzchar(as.character(a[["aplicador"]])))
  # Y no se cuela como descubierto ni como por confirmar.
  expect_false("EXTRA 7" %in% unlist(dia[["no_cubiertos"]] %||% list()))
  expect_false("EXTRA 7" %in% unlist(dia[["por_confirmar"]] %||% list()))
  # El dormido no aparece por ninguna de las tres puertas: no es una cita.
  expect_false("EXTRA 8" %in% c(asignados,
                                unlist(dia[["no_cubiertos"]] %||% list()),
                                unlist(dia[["por_confirmar"]] %||% list())))
})

test_that("el «Plan del día» lista el EXTRA agendado junto a los titulares", {
  hoja <- aulas_libro_hoja_plan_dia(.mxa_plan())
  celdas <- as.character(unlist(hoja, use.names = FALSE))
  expect_true("EXTRA 7" %in% celdas)
  expect_true("CH 1" %in% celdas)
  expect_false("EXTRA 8" %in% celdas)
})
