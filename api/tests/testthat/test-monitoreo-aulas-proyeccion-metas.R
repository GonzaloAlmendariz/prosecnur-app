# **«Con lo que ya tengo agendado, ¿llego?»**
#
# El artefacto 4 del boceto «Metas por facultad y sexo» (Gonzalo, 2026-09-09).
# El avance dice cuánto llevas y cuánto falta, y eso se lee como si el resto
# dependiera de seguir yendo. No siempre: una facultad puede tener toda su
# agenda cerrada y no alcanzar. Medido sobre el operativo real ese día, CINCO de
# quince no llegaban ni aplicando todo lo agendado, y Derecho se quedaba en 233
# de 363.

.mapm_u <- function(cod, fac, eleg, estado = "agendada", fecha = "2026-09-10") {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       sample_role = "titular", sample_status = estado, faculty = fac,
       course_name = "Cálculo", teacher = "Docente", scheduled_venue = "A101",
       scheduled_date = fecha, scheduled_time = "10:00",
       eligible_n = eleg, expected_valid = eleg / 2)
}

# Una facultad con cuota 100 (60 mujeres, 40 hombres) y tau del diseño 0,5.
.mapm_cuotas <- function(cuota = 100, M = 40, F = 60, tau = 0.5,
                         meta_diseno = 100, meta_operativa = 150) {
  list(meta_diseno = meta_diseno, meta_operativa = meta_operativa,
       facultades = list(list(facultad = "Letras", faculty_key = "letras",
                              cuota = cuota, cuota_sexo = list(M = M, F = F), tau = tau)))
}

test_that("suma lo aplicado y lo que cabe esperar de lo agendado, y dice si llega", {
  # CH 1 aplicada con 30 efectivas; CH 2 agendada con 40 elegibles y sin aplicar.
  # Con tau 0,5 la proyección son 20: total 50 contra una meta de 100.
  unid <- list(.mapm_u("CH 1", "Letras", 60), .mapm_u("CH 2", "Letras", 40))
  out <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 30), cuotas = .mapm_cuotas())
  expect_length(out, 1L)
  x <- out[[1]]
  expect_equal(x$obtenidas, 30)
  expect_equal(x$aulas_agendadas, 1L)
  expect_equal(x$elegibles_agendados, 40)
  expect_equal(x$proyectadas, 20)
  expect_equal(x$total, 50)
  expect_equal(x$brecha, -50)
  expect_false(x$llega)
})

test_that("lo que NO está agendado no entra: la pregunta es si llegas con lo cerrado", {
  # CH 2 está en contacto, no agendada: sus 40 elegibles no proyectan nada.
  unid <- list(.mapm_u("CH 1", "Letras", 60),
               .mapm_u("CH 2", "Letras", 40, estado = "en_contacto", fecha = ""))
  x <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 30), cuotas = .mapm_cuotas())[[1]]
  expect_equal(x$aulas_agendadas, 0L)
  expect_equal(x$proyectadas, 0)
  expect_equal(x$total, 30)
})

test_that("una agendada SIN fecha tampoco cuenta: no se puede aplicar un día que no existe", {
  unid <- list(.mapm_u("CH 1", "Letras", 60),
               .mapm_u("CH 2", "Letras", 40, fecha = ""))
  x <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 30), cuotas = .mapm_cuotas())[[1]]
  expect_equal(x$aulas_agendadas, 0L)
})

test_that("la tasa obtenida se USA con pocas aulas, y se dice sobre qué descansa", {
  # La primera versión caía a la del diseño bajo un umbral de aulas. Se midió
  # sobre el operativo del 2026-09-09 y el umbral NO EXISTE: con 6 aulas y 266
  # elegibles el desvío era +54 %, con 12 aulas y 379 era +0,6 %, y con 8 y 400
  # era +18 %. No es ruido que se encoja con el tamaño, es heterogeneidad entre
  # aulas. Un umbral daba confianza falsa y además escondía el dato pedido.
  unid <- list(.mapm_u("CH 1", "Letras", 60), .mapm_u("CH 2", "Letras", 40))
  x <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 60), cuotas = .mapm_cuotas(), tasa = "obtenida")[[1]]
  expect_false(x$tasa_es_del_diseno)
  expect_equal(x$tasa_usada, 1)          # 60 de 60
  expect_equal(x$proyectadas, 40)        # 40 elegibles × 1,0
  # Y el material para juzgarla viaja con ella.
  expect_equal(x$aulas_aplicadas, 1L)
  expect_equal(x$elegibles_aplicados, 60)
  expect_equal(x$tasa_diseno, 0.5)
  expect_equal(x$tasa_obtenida, 1)
  expect_equal(x$desvio_de_la_del_diseno, 1)   # el doble
})

test_that("sin una sola aula aplicada cae al diseño: no es prudencia, es la única opción", {
  unid <- list(.mapm_u("CH 1", "Letras", 40))
  x <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = NULL, cuotas = .mapm_cuotas(), tasa = "obtenida")[[1]]
  expect_true(x$tasa_es_del_diseno)
  expect_equal(x$tasa_usada, 0.5)
  expect_true(is.na(x$tasa_obtenida))
  expect_true(is.na(x$desvio_de_la_del_diseno))
})

test_that("pedir la del diseño la usa aunque la obtenida exista", {
  unid <- list(.mapm_u("CH 1", "Letras", 60), .mapm_u("CH 2", "Letras", 40))
  x <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 60), cuotas = .mapm_cuotas(), tasa = "diseno")[[1]]
  expect_true(x$tasa_es_del_diseno)
  expect_equal(x$proyectadas, 20)
  # Pero la obtenida se sigue diciendo, para poder comparar los dos escenarios.
  expect_equal(x$tasa_obtenida, 1)
})

test_that("el reparto por sexo de lo PROYECTADO usa la proporción de la cuota, y se declara", {
  # El plan no trae elegibles por sexo. 20 proyectadas con cuota 40/60 son 8 y 12.
  unid <- list(.mapm_u("CH 1", "Letras", 60), .mapm_u("CH 2", "Letras", 40))
  x <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 30), cuotas = .mapm_cuotas())[[1]]
  expect_equal(x$proyectadas_M, 8)
  expect_equal(x$proyectadas_F, 12)
  # **El supuesto viaja con el dato**: quien dibuje la barra tiene que poder
  # escribirlo al pie sin ir a buscarlo, porque es un supuesto y no una medida.
  expect_match(x$supuesto_sexo, "no trae elegibles por sexo")
})

test_that("la sobremuestra escala la cuota por el factor del total, y lo dice", {
  # El diseño la declara GLOBAL —100 y 150 aquí— y no la reparte por facultad:
  # escalar por 1,5 es lo único defendible, y es un supuesto.
  unid <- list(.mapm_u("CH 1", "Letras", 60))
  base <- monitoreo_aulas_proyeccion_metas(unid, efectivas = c(`CH 1` = 30),
                                           cuotas = .mapm_cuotas())[[1]]
  sobre <- monitoreo_aulas_proyeccion_metas(unid, efectivas = c(`CH 1` = 30),
                                            cuotas = .mapm_cuotas(), meta = "sobremuestra")[[1]]
  expect_equal(base$meta, 100)
  expect_equal(sobre$meta, 150)
  expect_equal(sobre$meta_M, 60)     # 40 × 1,5
  expect_equal(sobre$factor_meta, 1.5)
  expect_match(sobre$supuesto_meta, "no está repartida por facultad")
  # Y con la muestra ese supuesto NO se enseña: no aplica.
  expect_identical(base$supuesto_meta, "")
})

test_that("una facultad sin cuota declarada no se inventa una meta: no sale", {
  unid <- list(.mapm_u("CH 1", "Otra", 60))
  expect_length(monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 30), cuotas = .mapm_cuotas()), 0L)
})

test_that("ordena por brecha: la que peor está abre la lista", {
  cuotas <- list(meta_diseno = 200, meta_operativa = 300, facultades = list(
    list(facultad = "Letras", cuota = 100, cuota_sexo = list(M = 50, F = 50), tau = 0.5),
    list(facultad = "Ciencias", cuota = 100, cuota_sexo = list(M = 50, F = 50), tau = 0.5)))
  unid <- list(.mapm_u("CH 1", "Letras", 20), .mapm_u("CH 2", "Ciencias", 20))
  out <- monitoreo_aulas_proyeccion_metas(
    unid, efectivas = c(`CH 1` = 5, `CH 2` = 60), cuotas = cuotas)
  expect_equal(vapply(out, function(x) x$facultad, character(1)), c("Letras", "Ciencias"))
})
