# La reserva dirigida: a que aula ir cuando falta un sexo en una facultad.
#
# El banco de extras es hoy un residuo -lo que sobro tras armar las cadenas- y
# tiene funcion declarada: cerrar la cuota de hombres y mujeres por facultad.
# Medido sobre HSVG 2026, de las 443 aulas de DERECHO fuera del plan la mejor
# aporta 40,6 mujeres efectivas esperadas contra 14,5 de la mediana: 2,8x.

.mard_aula <- function(id, fac, elig, s1, n1, s2, n2, ids = "") list(
  classroom_id = id, faculty = fac, eligible_n = elig,
  sex_top_1 = s1, sex_top_1_n = n1, sex_top_2 = s2, sex_top_2_n = n2,
  unique_student_ids = ids
)

.mard_pool <- function() list(
  .mard_aula("A", "DERECHO", 40, "F", 34, "M", 6),   # muy femenina
  .mard_aula("B", "DERECHO", 40, "F", 20, "M", 20),  # mixta
  .mard_aula("C", "DERECHO", 40, "M", 36, "F", 4),   # muy masculina
  .mard_aula("D", "PSICOLOGIA", 40, "F", 38, "M", 2) # otra facultad
)

test_that("solo entran aulas de ESA facultad", {
  # Es el punto entero del item: un aula que aporta 38 mujeres de PSICOLOGIA no
  # cierra la celda de DERECHO. Es el mismo defecto que deja a GASTRONOMIA con
  # 2 aulas de 119 elegibles que aportan 6 alumnos suyos.
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  expect_false("D" %in% vapply(r, function(x) x$classroom_id, character(1)))
})

test_that("ordena por lo que aporta A ESA CELDA, no por tamaño", {
  # Las tres aulas de DERECHO tienen 40 elegibles: sin mirar el sexo darian lo
  # mismo. Con el sexo, la femenina rinde casi nueve veces la masculina.
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  expect_identical(vapply(r, function(x) x$classroom_id, character(1)), c("A", "B", "C"))
  expect_gt(r[[1]]$aporte_esperado, r[[3]]$aporte_esperado * 5)
})

test_that("la misma pregunta para el otro sexo da otro orden", {
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "M")
  expect_identical(r[[1]]$classroom_id, "C")
})

test_that("descuenta a los alumnos ya medidos en otra aula", {
  # En 2025, 446 alumnos de las 194 aulas aplicadas ya se habian medido antes.
  # Sin descontarlos, un aula que solapa entera parece aportar y no aporta.
  # El aula tiene CUATRO alumnas y cuatro ids: la coherencia importa, porque el
  # solape se prorratea sobre el total del aula.
  pool <- list(.mard_aula("A", "DERECHO", 4, "F", 4, "M", 0, "s1|s2|s3|s4"))
  limpio <- monitoreo_aulas_reserva_dirigida(pool, "DERECHO", "F")
  expect_gt(limpio[[1]]$aporte_esperado, 0)

  # Con las cuatro ya medidas, el aula no aporta nada y desaparece de la lista.
  todas <- monitoreo_aulas_reserva_dirigida(pool, "DERECHO", "F",
                                            ya_medidos = c("s1", "s2", "s3", "s4"))
  expect_equal(length(todas), 0L)

  # Y con la mitad medidas, aporta la mitad: el descuento es proporcional, no
  # un todo o nada.
  mitad <- monitoreo_aulas_reserva_dirigida(pool, "DERECHO", "F",
                                            ya_medidos = c("s1", "s2"))
  expect_equal(mitad[[1]]$solape_estimado, 2)
  expect_equal(mitad[[1]]$aporte_esperado, limpio[[1]]$aporte_esperado / 2)
})

test_that("declara si el solape se pudo medir, en vez de suponer que no hay", {
  # Un aula sin ids no es un aula sin solape: suponerlo es la version optimista,
  # y la superficie tiene que poder decir cual de las dos cosas es.
  sin_ids <- monitoreo_aulas_reserva_dirigida(
    list(.mard_aula("A", "DERECHO", 20, "F", 20, "M", 0)), "DERECHO", "F")
  con_ids <- monitoreo_aulas_reserva_dirigida(
    list(.mard_aula("A", "DERECHO", 20, "F", 20, "M", 0, "s1|s2")), "DERECHO", "F")
  expect_false(sin_ids[[1]]$solape_medible)
  expect_true(con_ids[[1]]$solape_medible)
})

test_that("cada candidato viaja MARCADO: sin eso no se puede usar", {
  # La condicion innegociable. Sirve para correr la estimacion con y sin estas
  # encuestas y comprobar que la prevalencia no se mueve. Un peso no permite esa
  # comprobacion; una marca si.
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  expect_true(all(vapply(r, function(x) isTRUE(x$origen_dirigido), logical(1))))
  expect_match(r[[1]]$motivo, "mujeres de DERECHO")
})

test_that("un aula que no aporta a esa celda no entra aunque sea grande", {
  # 60 elegibles, todos del otro sexo: cero para esta celda.
  r <- monitoreo_aulas_reserva_dirigida(
    list(.mard_aula("G", "DERECHO", 60, "M", 60, "", 0)), "DERECHO", "F")
  expect_equal(length(r), 0L)
})

test_that("el tope recorta pero el orden manda", {
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F", tope = 2L)
  expect_identical(vapply(r, function(x) x$classroom_id, character(1)), c("A", "B"))
})

test_that("sin banco o sin facultad no inventa candidatos", {
  expect_equal(length(monitoreo_aulas_reserva_dirigida(list(), "DERECHO", "F")), 0L)
  expect_equal(length(monitoreo_aulas_reserva_dirigida(.mard_pool(), "", "F")), 0L)
})
