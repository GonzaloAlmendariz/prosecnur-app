# V8 · Un estrato que no puede recibir ninguna aula se dice como tal.
#
# Medido en el estudio real de 2025-2: 84 estratos declarados, 30 titulares
# sorteados, 54 estratos en cero por aritmetica. El objetivo de
# representatividad ya avisaba del desbalance, pero nombrando el HECHO
# ("Balance fuera de tolerancia severa en: Facultad") y no la CAUSA. Las dos
# llevan a decisiones opuestas: el desbalance se corrige reponderando o
# resorteando; un estrato inalcanzable solo subiendo n o agrupando estratos.

.alc_sel <- function(estratos, titulares) {
  # Marco con una fila por estrato; las primeras `titulares` son titulares.
  n <- length(estratos)
  data.frame(
    stratum = estratos,
    sample_role = c(rep("titular", titulares), rep("chain_reserve", n - titulares)),
    stringsAsFactors = FALSE
  )
}
.alc_marco <- function(estratos) data.frame(stratum = estratos, stringsAsFactors = FALSE)
.alc_aviso <- function(sel, marco = NULL, roles = NULL) {
  .cm_aulas_aviso_estratos_inalcanzables(marco %||% sel, sel, roles)
}

test_that("con mas estratos que titulares el aviso nombra la causa", {
  sel <- .alc_sel(sprintf("E%02d", 1:84), 30)
  aviso <- .alc_aviso(sel)
  expect_length(aviso, 1L)
  # Las tres cifras que hacen accionable el aviso.
  expect_true(grepl("84 estratos", aviso, fixed = TRUE))
  expect_true(grepl("30 aulas titulares", aviso, fixed = TRUE))
  expect_true(grepl("54", aviso, fixed = TRUE))
  # Y las dos salidas reales, para que no se gire la perilla equivocada.
  expect_true(grepl("no lo corrige el balanceo", aviso, fixed = TRUE))
  expect_true(grepl("agrupar los estratos", aviso, fixed = TRUE))
})

test_that("con plaza para cada estrato no hay aviso", {
  # 30 estratos, 30 titulares: el sorteo PUEDE cubrirlos todos. Que de hecho
  # concentre dos en uno es un problema de balance, no de aritmetica, y ya
  # tiene su propio aviso: duplicarlo aqui seria decir dos veces lo mismo con
  # causas distintas.
  expect_length(.alc_aviso(.alc_sel(sprintf("E%02d", 1:30), 30)), 0L)
  # Y con mas titulares que estratos, menos aun: sobran plazas.
  holgado <- data.frame(
    stratum = rep(sprintf("E%02d", 1:10), 3), sample_role = "titular",
    stringsAsFactors = FALSE
  )
  expect_length(.alc_aviso(holgado), 0L)
})

test_that("sin titulares no se afirma nada", {
  # Sin sorteo no hay plazas que repartir: decir que faltan seria describir un
  # reparto que no ocurrio.
  sel <- data.frame(stratum = sprintf("E%02d", 1:84), sample_role = "chain_reserve", stringsAsFactors = FALSE)
  expect_length(.alc_aviso(sel), 0L)
  expect_length(.cm_aulas_aviso_estratos_inalcanzables(NULL, NULL), 0L)
  expect_length(.cm_aulas_aviso_estratos_inalcanzables(data.frame(), data.frame()), 0L)
})

test_that("el alcance distingue inalcanzable de perdido en el sorteo", {
  # 40 estratos, 30 titulares, pero dos titulares caen en el mismo estrato:
  # 10 son inalcanzables por aritmetica y 11 acaban sin ninguna. Son dos
  # cantidades distintas y el aviso solo puede prometer la primera.
  sel <- .alc_sel(c(sprintf("E%02d", 1:29), "E01", sprintf("E%02d", 30:40)), 30)
  a <- .cm_aulas_estratos_alcance(sel, sel)
  expect_identical(a$estratos, 40L)
  expect_identical(a$titulares, 30L)
  expect_identical(a$inalcanzables, 10L)
  expect_identical(a$sin_titular, 11L)
})

test_that("el universo sale del marco, no de la seleccion ya filtrada", {
  # LA trampa, y la razon de que este aviso naciera mudo: antes de calcular
  # representatividad la seleccion se filtra de la bolsa extra, y ese filtro se
  # lleva por delante justo a los estratos que no recibieron nada. En el estudio
  # real quedaban 360 filas con 30 estratos —exactamente los 30 con titular—,
  # asi que contar ahi da siempre "ninguno inalcanzable".
  marco <- .alc_marco(sprintf("E%02d", 1:84))
  # La seleccion que llega a la funcion: solo los 30 estratos que tienen algo.
  sel <- .alc_sel(rep(sprintf("E%02d", 1:30), 2), 30)
  expect_identical(length(unique(sel$stratum)), 30L)

  a <- .cm_aulas_estratos_alcance(marco, sel)
  expect_identical(a$estratos, 84L)
  expect_identical(a$titulares, 30L)
  expect_identical(a$inalcanzables, 54L)
  expect_true(grepl("54 estratos no pueden recibir ninguna", .alc_aviso(sel, marco), fixed = TRUE))

  # Contando sobre la propia seleccion —lo que hacia la primera version— el
  # aviso desaparece. Este es el falso verde que el test fija.
  expect_length(.alc_aviso(sel), 0L)
})

test_that("roles desalineados no se creen", {
  # `roles` se precomputa sobre la seleccion SIN filtrar y no se re-subsetea:
  # llega con mas entradas que filas. Usarlo tal cual desplazaria quien es
  # titular fila a fila, que es peor que ignorarlo.
  marco <- .alc_marco(sprintf("E%02d", 1:84))
  sel <- .alc_sel(rep(sprintf("E%02d", 1:30), 2), 30)
  desalineado <- rep("extra_reserve_pool", nrow(sel) + 100L)
  a <- .cm_aulas_estratos_alcance(marco, sel, desalineado)
  expect_identical(a$titulares, 30L)
})
