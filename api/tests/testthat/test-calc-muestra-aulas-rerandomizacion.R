# ADR 0082: rerandomizar no es optimizar entre candidatas.
#
# `pool_controlado` devuelve el argmax de un score sobre N candidatas y sus
# probabilidades de inclusion no son calculables. Rerandomizar acepta o rechaza
# contra un criterio fijado ANTES de sortear, y por eso la tasa de aceptacion es
# informacion del diseño: en HSVG 2026, 25 de 50 sorteos cerraban las 30 celdas.

.rr_criterio <- function(umbral = 1) list(
  tipo = "cobertura_celdas", umbral = umbral,
  celdas = data.frame(
    faculty_key = c("derecho", "psicologia"),
    cuota_f = c(100, 20), cuota_m = c(100, 20), tau = c(0.5, 0.5),
    stringsAsFactors = FALSE
  )
)

# Un sorteo simulado: cada llamada devuelve un aula con los elegibles que le
# toque, para poder fabricar sorteos que pasan y sorteos que no.
.rr_frame <- function(f_der, m_der, f_psi = 100, m_psi = 100) {
  data.frame(
    classroom_id = c("d1", "p1"),
    faculty = c("DERECHO", "PSICOLOGIA"),
    eligible_n = c(f_der + m_der, f_psi + m_psi),
    # Los CUATRO campos: `.cm_aulas_sexo_conteos` exige el par completo y
    # devuelve NAs si falta alguno, en vez de adivinar. Con solo el top_1 la
    # cobertura salia 0 y el test culpaba al motor.
    sex_top_1 = c("F", "F"),
    sex_top_1_n = c(f_der, f_psi),
    sex_top_2 = c("M", "M"),
    sex_top_2_n = c(m_der, m_psi),
    stringsAsFactors = FALSE
  )
}

test_that("la cobertura minima es el minimo sobre celdas, no un promedio", {
  cr <- prosecnurapp:::.cm_rerandom_normalize_criterio(.rr_criterio())
  expect_false(is.null(cr))
  # Derecho: 200 F x 0,5 = 100 sobre cuota 100 = 1,00 · hombres igual.
  # Psicologia holgadisima. El minimo tiene que ser el de Derecho.
  cob <- prosecnurapp:::.cm_rerandom_cobertura_minima(.rr_frame(200, 200), cr)
  expect_equal(cob, 1, tolerance = 1e-9)
  # Bajando SOLO una celda, el minimo la sigue.
  expect_lt(prosecnurapp:::.cm_rerandom_cobertura_minima(.rr_frame(100, 200), cr), 1)
})

test_that("una facultad sin aulas da cobertura 0, no un NA que se cuele", {
  cr <- prosecnurapp:::.cm_rerandom_normalize_criterio(.rr_criterio())
  solo_psi <- .rr_frame(200, 200)[2, , drop = FALSE]
  expect_equal(prosecnurapp:::.cm_rerandom_cobertura_minima(solo_psi, cr), 0)
})

test_that("acepta el PRIMERO que pasa y declara cuantos se hicieron", {
  cr <- .rr_criterio()
  llamadas <- 0L
  # Los dos primeros no llegan; el tercero si.
  sortear <- function(s) {
    llamadas <<- llamadas + 1L
    if (llamadas < 3L) .rr_frame(100, 100) else .rr_frame(220, 220)
  }
  out <- prosecnurapp:::.cm_aulas_rerandomizar(NULL, list(), "cube_balanceado", cr,
                                               seed = 1, tope = 10, sortear = sortear)
  rr <- attr(out, "rerandomizacion")
  expect_true(rr$aplicada)
  expect_equal(rr$sorteos, 3L)
  expect_equal(rr$aceptados, 1L)
  expect_equal(rr$sorteo_elegido, 3L)
  expect_false(rr$agotado)
  expect_identical(rr$motivo, "aceptada_por_criterio")
  expect_gte(rr$cobertura_minima, 1)
})

test_that("si el presupuesto se agota SIN aceptar, lo dice y entrega el mejor", {
  # El modo de fallo que el ADR prohibe: devolver el mejor fingiendo que paso.
  cr <- .rr_criterio()
  i <- 0L
  sortear <- function(s) { i <<- i + 1L; .rr_frame(100 + i, 100 + i) }
  out <- prosecnurapp:::.cm_aulas_rerandomizar(NULL, list(), "cube_balanceado", cr,
                                               seed = 1, tope = 5, sortear = sortear)
  rr <- attr(out, "rerandomizacion")
  expect_true(rr$agotado)
  expect_equal(rr$aceptados, 0L)
  expect_equal(rr$sorteos, 5L)
  expect_identical(rr$motivo, "presupuesto_agotado_sin_aceptar")
  expect_lt(rr$cobertura_minima, 1)
  # Y el que devuelve es el MEJOR de los cinco, el ultimo de esta serie creciente.
  expect_equal(rr$sorteo_elegido, 5L)
})

test_that("la tasa de aceptacion sale reportada, que es dato del diseño", {
  cr <- .rr_criterio()
  i <- 0L
  # Uno de cada dos pasa: la tasa tiene que reflejarlo, no ser 1 por haber
  # aceptado el primero que paso.
  sortear <- function(s) { i <<- i + 1L; if (i %% 2L == 0L) .rr_frame(220, 220) else .rr_frame(100, 100) }
  out <- prosecnurapp:::.cm_aulas_rerandomizar(NULL, list(), "cube_balanceado", cr,
                                               seed = 1, tope = 10, sortear = sortear)
  rr <- attr(out, "rerandomizacion")
  expect_equal(rr$sorteos, 2L)
  expect_equal(rr$aceptados, 1L)
  expect_equal(rr$tasa_aceptacion, 0.5)
})

test_that("sin criterio no se finge una aceptacion", {
  sortear <- function(s) .rr_frame(220, 220)
  out <- prosecnurapp:::.cm_aulas_rerandomizar(NULL, list(), "cube_balanceado", NULL,
                                               seed = 1, tope = 9, sortear = sortear)
  rr <- attr(out, "rerandomizacion")
  expect_false(rr$aplicada)
  expect_identical(rr$motivo, "sin_criterio")
  expect_equal(rr$sorteos, 1L)
})

test_that("un criterio mal formado no se acepta a medias", {
  expect_null(prosecnurapp:::.cm_rerandom_normalize_criterio(list(tipo = "otro")))
  expect_null(prosecnurapp:::.cm_rerandom_normalize_criterio(list(tipo = "cobertura_celdas")))
  # Sin tau no se puede convertir elegibles en encuestas: no es criterio.
  expect_null(prosecnurapp:::.cm_rerandom_normalize_criterio(list(
    tipo = "cobertura_celdas",
    celdas = data.frame(faculty_key = "derecho", cuota_f = 1, cuota_m = 1, tau = 0)
  )))
})

# EL CABLEADO. Una funcion probada que nadie llama no cambia nada: estos dos
# fijan que el criterio viaja por la config y que el bloque sale al resultado.

test_that("la config normaliza el bloque y no lo enciende sin criterio", {
  sin <- prosecnurapp:::.cm_rerandom_normalize_config(list(activa = TRUE))
  expect_false(sin$activa)
  expect_null(sin$criterio)

  con <- prosecnurapp:::.cm_rerandom_normalize_config(list(activa = TRUE, tope = 12, criterio = .rr_criterio()))
  expect_true(con$activa)
  expect_equal(con$tope, 12L)
  expect_identical(con$criterio$tipo, "cobertura_celdas")

  # Pedirla sin decir contra que aceptar NO es rerandomizar.
  expect_false(prosecnurapp:::.cm_rerandom_normalize_config(list(activa = TRUE, criterio = list(tipo = "otro")))$activa)
  # Y el tope se acota a rangos que un operativo puede pagar.
  expect_equal(prosecnurapp:::.cm_rerandom_normalize_config(list(criterio = .rr_criterio(), tope = 99999))$tope,
               prosecnurapp:::.CM_RERANDOM_TOPE_MAX)
})

test_that("el selector normalizado lleva el bloque hasta el sorteo", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    selector = list(rerandomizacion = list(activa = TRUE, tope = 7, criterio = .rr_criterio()))
  ))
  rr <- cfg$selector$rerandomizacion
  expect_true(rr$activa)
  expect_equal(rr$tope, 7L)
  # Sin declararla, el sorteo se comporta como siempre y lo dice.
  vacia <- calc_muestra_aulas_normalize_config(list())$selector$rerandomizacion
  expect_false(vacia$activa)
})

test_that("el criterio SOBREVIVE el round-trip del workspace", {
  # La whitelist de `.cm_normalize_workspace_aulas_config` es estricta: lo que no
  # este declarado se pierde sin avisar. El ADR exige que el `.pulso` guarde el
  # criterio —una muestra aceptada por un criterio que el proyecto no recuerda no
  # se puede reconstruir—, asi que este test es el que impide que muera ahi.
  ws <- list(aulas_config = list(
    rerandomizacion = list(activa = TRUE, tope = 40, criterio = .rr_criterio())
  ))
  out <- prosecnurapp:::.cm_normalize_workspace(ws)$aulas_config$rerandomizacion
  expect_true(out$activa)
  expect_equal(out$tope, 40L)
  expect_identical(out$criterio$tipo, "cobertura_celdas")
  expect_equal(nrow(out$criterio$celdas), 2L)

  # Idempotente: normalizar lo ya normalizado no lo degrada.
  otra <- prosecnurapp:::.cm_normalize_workspace(list(aulas_config = out2 <- list(rerandomizacion = out)))$aulas_config$rerandomizacion
  expect_true(otra$activa)
  expect_equal(nrow(otra$criterio$celdas), 2L)
})
