# La CLASE: un slot que sale `NA` en vez de ausente, y un `$` encadenado encima.
#
# `calc_muestra_asistencia_referencia()` publica cuatro slots que pueden salir
# `NA` —`encuentros`, `cuotas`, `serie_campo`, `cadenas_reemplazo`— y es
# deliberado: un NULL saldría `{}` y el cliente lo leería como un bloque
# presente. El precio es que `referencia$cadenas_reemplazo$filas` sobre un `NA`
# no devuelve NULL: LANZA «$ operator is invalid for atomic vectors», y `%||%`
# no lo atrapa porque sólo mira el NULL.
#
# El 2026-09-12 eso devolvía 500 `E_INTERNAL` en
# `POST /api/calc-muestra/marco/construir` para toda sesión que hubiera cargado
# la referencia (arreglado en `f02b96fc`). El barrido de aquel día encontró un
# solo consumidor sin guarda, pero **un barrido no es un guard**: si mañana
# aparece un quinto slot o un sexto consumidor, nadie lo caza.
#
# Esto es el guard de la CLASE. No mira el código: LLAMA a los consumidores con
# los cuatro slots en `NA` y exige que ninguno lance. Mata el mutante —revertir
# `f02b96fc` lo pone rojo— y no depende de la forma en que esté escrita la
# cadena, que es lo que hace inútil a un barrido estático.

.crsn_referencia_na <- function() {
  list(
    schema = "calc_muestra_asistencia_referencia_v1",
    estudio = list(id = "e", label = "E", periodo = "2025-II", fuente = "f"),
    periodo = "2025-II",
    # Los cuatro, tal como los publica el productor cuando no hay bloque.
    encuentros = NA,
    cuotas = NA,
    serie_campo = NA,
    cadenas_reemplazo = NA
  )
}

test_that("ningún consumidor de la referencia revienta con los cuatro slots en NA", {
  ref <- .crsn_referencia_na()
  cfg <- list(efectividad = NULL, alumnos_por_ch = 30)

  # 1 · El sellador de efectividad: el que reventaba.
  expect_silent(out <- calc_muestra_aulas_sellar_efectividad(cfg, ref))
  expect_identical(out, cfg)

  # 2 · Los criterios desde la asistencia, que leen `cuotas` y `cadenas_reemplazo`.
  expect_silent(calc_muestra_referencia_criterios_desde_asistencia(ref))

  # 3 · Y el tau por facultad, que documenta la misma entrada.
  if (exists("calc_muestra_aulas_tau_por_facultad", envir = asNamespace("prosecnurapp"))) {
    f <- get("calc_muestra_aulas_tau_por_facultad", envir = asNamespace("prosecnurapp"))
    expect_silent(tryCatch(f(ref$cadenas_reemplazo), error = function(e) stop(e)))
  }
})

test_that("un slot en NA se distingue de uno ausente y de uno vacío", {
  # Las tres formas tienen que dar el mismo resultado —nada que sellar— y
  # ninguna puede lanzar. Si alguna vez difieren, es que alguien guardó sólo
  # contra una y la clase sigue abierta por las otras dos.
  cfg <- list(efectividad = NULL, alumnos_por_ch = 30)
  for (valor in list(NA, NULL, list(), character(0), NA_character_)) {
    ref <- list(periodo = "2025-II", cadenas_reemplazo = valor)
    expect_silent(out <- calc_muestra_aulas_sellar_efectividad(cfg, ref))
    expect_identical(out, cfg)
  }
})
