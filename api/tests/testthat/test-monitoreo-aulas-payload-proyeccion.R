# **La proyección de metas llega al tablero, y las aulas de cada facultad con ella.**
#
# El motor (`monitoreo_aulas_proyeccion_metas`) contesta «con lo que ya tengo
# agendado, ¿llego?». Esto sujeta la pata que lo lleva al payload del perfil de
# aulas, que es donde la pestaña «Metas» lo consume.

.mapp_u <- function(cod, fac, eleg, estado = "agendada", fecha = "2026-09-10",
                    rol = "titular") {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       sample_role = rol, sample_status = estado, faculty = fac,
       course_name = "Cálculo", teacher = "Docente", scheduled_venue = "A101",
       scheduled_date = fecha, scheduled_time = "10:00",
       eligible_n = eleg, expected_valid = eleg / 2)
}
.mapp_cuotas <- function() list(
  meta_diseno = 100, meta_operativa = 150,
  facultades = list(list(facultad = "Letras", faculty_key = "letras",
                         cuota = 100, cuota_sexo = list(M = 40, F = 60), tau = 0.5)))

test_that("el payload trae las CUATRO combinaciones de los dos mandos", {
  # Los dos toggles de la pestaña son meta (muestra/sobremuestra) y tasa
  # (diseño/obtenida). Las cuatro se calculan en el motor y no en la pantalla:
  # dos sitios que calculan la misma cifra empiezan a discrepar, que es la misma
  # razón por la que las jornadas del «día a día» salen del motor.
  plan <- list(.mapp_u("CH 1", "Letras", 60), .mapp_u("CH 2", "Letras", 40))
  out <- monitoreo_aulas_proyeccion_payload(
    plan, responses = NULL, cuotas = .mapp_cuotas())
  expect_setequal(names(out), c("muestra_diseno", "muestra_obtenida",
                                "sobremuestra_diseno", "sobremuestra_obtenida"))
  expect_equal(out$muestra_diseno[[1]]$meta, 100)
  expect_equal(out$sobremuestra_diseno[[1]]$meta, 150)
})

test_that("sin cuotas del diseño devuelve NULL, no una lista vacía", {
  # NULL distingue «no se sabe» de «no llega ninguna». Una lista vacía dejaría
  # a la pantalla pintando quince ceros medidos que nadie midió.
  plan <- list(.mapp_u("CH 1", "Letras", 60))
  expect_null(monitoreo_aulas_proyeccion_payload(plan, cuotas = list()))
  expect_null(monitoreo_aulas_proyeccion_payload(list(), cuotas = .mapp_cuotas()))
})

test_that("«planificadas» son los TITULARES, no titulares más reservas", {
  # Una reserva no se planifica: se activa cuando una titular se cae. Contarlas
  # daría las 1 392 filas del sorteo de HSVG2026, que no es el objetivo de nadie.
  plan <- list(
    .mapp_u("CH 1", "Letras", 60),
    .mapp_u("R 1.1", "Letras", 40, rol = "chain_reserve"),
    .mapp_u("E 1", "Letras", 40, rol = "extra_reserve_pool"),
    .mapp_u("CH 2", "Ciencias", 30)
  )
  out <- monitoreo_aulas_aulas_por_facultad(plan)
  letras <- Filter(function(x) identical(x$facultad, "Letras"), out)[[1]]
  expect_equal(letras$planificadas, 1L)
  expect_length(out, 2L)
})

test_that("cuenta como aplicada la que tiene efectivas, y va por FACULTAD", {
  # Un aula no se reparte entre hombres y mujeres: la misma visita da de los
  # dos. Por eso estas dos cifras no tienen fila por sexo.
  plan <- list(.mapp_u("CH 1", "Letras", 60), .mapp_u("CH 2", "Letras", 40))
  d <- data.frame(classroom_id = rep("CH 1", 5), stringsAsFactors = FALSE)
  out <- monitoreo_aulas_aulas_por_facultad(plan, responses = d)
  expect_equal(out[[1]]$aplicadas, 1L)
  expect_equal(out[[1]]$planificadas, 2L)
  expect_false("sexo" %in% names(out[[1]]))
})
