# Dos tasas de efectividad en paralelo: la del AULA y la de la FACULTAD.
#
# Mandato de Gonzalo (B3, 2026-08-31): «poder tener margenes de los esperados y
# no descartar algo o catalogarlo como algo simplemente porque la tasa de
# efectividad no es la esperada». Un aula fuera de margen se SEÑALA, no se
# descarta.
#
# La mitad FACULTAD ya existe (`monitoreo_aulas_efectividad_seguimiento.R`).
# Esto fija el grano AULA: `monitoreo_aulas_dos_tasas(plan)` recibe el plan
# normalizado (lista de filas) y devuelve `list(aulas, criterio)`. Por aula:
# la tasa prevista del diseño (`tasa_efectividad_aula`), la vara agregada de su
# facultad (`tasa_facultad`, lado a lado), la observada, y una BANDA de
# 2*sqrt(p*(1-p)/elegibles) con p = la prevista — el patron de tasaDeCaida.ts:
# la banda se arma sobre la p de REFERENCIA con el n del aula.
#
# Doctrina de la banda: dentro del margen NO se le pone nombre (direccion
# NULL); `bajo`/`sobre` solo fuera de banda. Y JAMAS un campo «valido» en la
# salida: la respuesta que cuenta es la EFECTIVA (pasa filtros), y la señal es
# eso, una señal, no un veredicto.
#
# El numerador es la efectiva de PLATAFORMA (`respuestas_validas` de la fila);
# el parte (`effective_surveys`) entra como respaldo, y el origen usado se
# declara en `numerador`.

# Una fila normalizada del plan, con solo lo que cada caso necesita.
.mdt_fila <- function(codigo, facultad = "Ciencias", elegibles = 40,
                      prevista = NULL, plataforma = NULL, parte = NULL,
                      tasa_facultad = NULL, rol = "titular") {
  fila <- list(
    operational_code = codigo,
    faculty = facultad,
    sample_role = rol,
    eligible_n = elegibles
  )
  if (!is.null(prevista)) fila[["tasa_efectividad_aula"]] <- prevista
  if (!is.null(plataforma)) fila[["respuestas_validas"]] <- plataforma
  if (!is.null(parte)) fila[["effective_surveys"]] <- parte
  if (!is.null(tasa_facultad)) fila[["tasa_facultad"]] <- tasa_facultad
  fila
}

# La fila de salida de un aula, buscada por su codigo.
.mdt_aula <- function(res, codigo) {
  for (a in res[["aulas"]]) {
    if (is.list(a) && identical(a[["codigo"]], codigo)) return(a)
  }
  NULL
}

test_that("dentro del margen el aula es CONFORME y no se le pone nombre", {
  # prevista 0.60, elegibles 40: banda = 2*sqrt(0.6*0.4/40) = 0.1549.
  # 22 efectivas dan 0.55 observada: a 0.05 de la prevista, dentro de banda.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_true(is.list(aula))
  expect_identical(aula[["senal"]], "conforme")
  expect_equal(aula[["tasa_observada"]], 0.55, tolerance = 1e-3)
  expect_equal(aula[["banda"]], 2 * sqrt(0.6 * 0.4 / 40), tolerance = 1e-3)
  # Doctrina de tasaDeCaida: dentro del margen no hay direccion ni veredicto.
  expect_null(aula[["direccion"]])
})

test_that("fuera de banda por debajo, la señal es «bajo» — señalar, no descartar", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 10)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "bajo")
  expect_equal(aula[["tasa_observada"]], 0.25, tolerance = 1e-3)
})

test_that("fuera de banda por encima, la señal es «sobre»", {
  # Pasarse tambien se señala: 30 de 40 con prevista 0.30 es 0.75 observada.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.30, plataforma = 30)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sobre")
})

test_that("con muy pocos elegibles no hay banda: la cifra se enseña, no se juzga", {
  # Un aula de 3 elegibles no da para una banda binomial honesta. La señal lo
  # dice (`sin_banda`) y la observada VIAJA igual: enseñar sin juzgar.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 3, prevista = 0.60, plataforma = 2)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sin_banda")
  expect_true(is.numeric(aula[["tasa_observada"]]))
})

test_that("sin tasa prevista del diseño la señal es «sin_previsto», no un juicio", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, plataforma = 22)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sin_previsto")
})

test_that("sin plataforma ni parte no hay datos, y se declara «sin_datos»", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sin_datos")
  # Sin efectivas no hay observada: NULL, no un cero que se lea como medicion.
  expect_null(aula[["tasa_observada"]])
})

test_that("el numerador se declara: plataforma manda y el parte respalda", {
  res <- monitoreo_aulas_dos_tasas(list(
    # Con las dos fuentes, gana la efectiva de PLATAFORMA (22, no 99).
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22, parte = 99),
    # Sin plataforma, el parte entra como respaldo y se dice.
    .mdt_fila("CH 2", elegibles = 40, prevista = 0.60, plataforma = NULL, parte = 22)
  ))
  a1 <- .mdt_aula(res, "CH 1")
  expect_identical(a1[["efectivas"]], 22)
  expect_identical(a1[["numerador"]], "plataforma")
  a2 <- .mdt_aula(res, "CH 2")
  expect_identical(a2[["efectivas"]], 22)
  expect_identical(a2[["numerador"]], "parte")
})

test_that("las DOS varas viajan lado a lado: la del aula y la de su facultad", {
  # Un aula bajo su propia meta tuvo un problema; una bajo la de su facultad
  # pero sobre la suya solo es mas grande que el promedio. Sin las dos tasas en
  # la misma fila los dos casos se ven iguales.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.55, plataforma = 22,
              tasa_facultad = 0.62)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_equal(aula[["tasa_prevista"]], 0.55, tolerance = 1e-6)
  expect_equal(aula[["tasa_facultad"]], 0.62, tolerance = 1e-6)
})

test_that("cero efectivas es un DATO: observada 0 y señal «bajo», no sin_datos", {
  # El cero de plataforma es una medicion —nadie paso los filtros—, no un hueco.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 0)
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "bajo")
  expect_equal(aula[["tasa_observada"]], 0, tolerance = 1e-9)
})

test_that("la salida no trae ningun campo «valido»/«cumple»: señal, no veredicto", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22),
    .mdt_fila("CH 2", elegibles = 40, prevista = 0.60, plataforma = 10)
  ))
  for (aula in res[["aulas"]]) {
    expect_false(any(grepl("valid|cumple", names(aula), ignore.case = TRUE)))
  }
})

test_that("entran los titulares y quien tenga señal de campo; una reserva dormida no", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22),
    # Reserva sin ninguna señal de campo: no es una fila que medir todavia.
    .mdt_fila("CH 9", elegibles = 35, prevista = 0.60, rol = "chain_reserve"),
    # Reserva que YA rindio un parte: entro al operativo y se mide.
    .mdt_fila("CH 10", elegibles = 35, prevista = 0.60, parte = 15,
              rol = "chain_reserve")
  ))
  expect_true(is.list(.mdt_aula(res, "CH 1")))
  expect_null(.mdt_aula(res, "CH 9"))
  expect_true(is.list(.mdt_aula(res, "CH 10")))
})

test_that("el criterio se describe solo: numerador, banda y la vara agregada", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22)
  ))
  crit <- res[["criterio"]]
  expect_true(is.list(crit))
  # El numerador declarado: efectiva de plataforma, con el parte de respaldo.
  expect_true(grepl("plataforma", crit[["numerador"]]))
  expect_true(grepl("parte", crit[["numerador"]]))
  # La banda: 2 EE sobre la PREVISTA con los elegibles del aula.
  expect_true(grepl("elegibles", crit[["banda"]]))
  # Y que la vara agregada es la de la fila (`tasa_facultad`), dicho ahi.
  texto <- paste(unlist(Filter(is.character, crit)), collapse = " ")
  expect_true(grepl("tasa_facultad", texto))
})
