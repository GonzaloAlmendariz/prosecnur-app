# El universo de aulas del estudio anterior (calc_muestra_aulas_universo_referencia.R).
#
# El paso 3 comparaba elegibles de HOY contra SORTEADAS de ayer (C&I 571 vs
# 40); el «antes» correcto es el marco elegible del estudio anterior, derivado
# del catalogo con los criterios que aquel estudio documento — criterios que
# viajan como DATOS en config$referencia_marco, jamas cableados en el engine.

.uref_catalogo <- function() data.frame(
  `Curso Horario` = c("A-1", "A-1", "B-1", "C-1", "D-1", "E-1", "F-1"),
  Facultad = c("DERECHO", "DERECHO", "DERECHO", "DERECHO", "PSICOLOGÍA", "PSICOLOGÍA", "ESCUELA DE POSGRADO"),
  Modalidad = c("PRESENCIAL", "PRESENCIAL", "VIRTUAL", "PRESENCIAL", "PRESENCIAL", "PRESENCIAL", "PRESENCIAL"),
  `Tipo de curso` = c("TEORICO(TEORICO-PRACTICO)", "TEORICO(TEORICO-PRACTICO)", "TEORICO", "TALLER", "TEORICO", "TEORICO", "TEORICO"),
  `Nivel del curso` = c(3, 3, 4, 5, 11, 2, 5),
  Matriculados = c(30, 30, 25, 40, 20, 8, 50),
  check.names = FALSE, stringsAsFactors = FALSE
)

.uref_spec <- list(referencia_marco = list(
  modalidades = list("presencial"),
  tipos_prefijo = list("teorico"),
  niveles_excluidos = list(1, 11, 12),
  min_matriculados = 10,
  facultades_excluidas = list("posgrado")
))

test_that("aplica el spec paso a paso y cuenta por facultad sobre unicos", {
  u <- calc_muestra_aulas_universo_referencia(.uref_catalogo(), .uref_spec)
  expect_identical(u$schema, "calc_muestra_aulas_universo_referencia_v1")
  # A-1 duplicada cuenta UNA vez; B-1 cae por virtual; C-1 por taller;
  # D-1 (PSI nivel 11) por nivel; E-1 por matriculados<10; F-1 por posgrado.
  expect_identical(u$total, 1L)
  expect_identical(u$filas[[1]]$facultad, "DERECHO")
  expect_identical(u$filas[[1]]$aulas_universo, 1L)
})

test_that("sin spec no hay bloque — jamas un universo en cero", {
  expect_null(calc_muestra_aulas_universo_referencia(.uref_catalogo(), list()))
  expect_null(calc_muestra_aulas_universo_referencia(NULL, .uref_spec))
})

test_that("el spec sobrevive al normalizador de config y llega al frame", {
  cfg <- calc_muestra_aulas_normalize_config(.uref_spec)
  expect_true(is.list(cfg$referencia_marco))
  u <- calc_muestra_aulas_universo_referencia(.uref_catalogo(), cfg)
  expect_identical(u$total, 1L)
})

test_that("la referencia sirve aulas_universo desde el frame", {
  referencia <- calc_muestra_referencia_criterios_normalizar(list(
    periodo = "2025-2", general = list(),
    por_facultad = list(list(facultad = "DERECHO", cuota = 347))
  ))
  frame <- list(universo_referencia = list(filas = list(
    list(facultad = "DERECHO", aulas_universo = 655)
  )))
  con <- calc_muestra_referencia_criterios_con_universo(referencia, frame)
  expect_equal(.cm_ref_crit_buscar(con, "DERECHO")$aulas_universo, 655)
  # Sin bloque en el frame la referencia queda intacta.
  expect_identical(calc_muestra_referencia_criterios_con_universo(referencia, list()), referencia)
})
