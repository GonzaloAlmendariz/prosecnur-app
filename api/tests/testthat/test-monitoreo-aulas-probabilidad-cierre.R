# La probabilidad de que una celda cierre su cuota.
#
# El hueco que repara: `.mac_estado_proyectado()` decide con un UMBRAL sobre una
# proyeccion puntual, asi que una celda al 100,1 % de su cuota se declara tan
# segura como una al 150 %. Estos tests fijan que la incertidumbre entra, y que
# cuando no se puede medir se dice `NA` en vez de inventarla.

test_that("dos celdas con la MISMA proyeccion y distinta varianza NO dan lo mismo", {
  # Es el punto entero. Si esto pasara con cualquier implementacion que ignore
  # la varianza, el test no probaria nada.
  poco <- .mac_probabilidad_de_cierre(cuota = 100, proyeccion = 110, varianza = 4)
  mucho <- .mac_probabilidad_de_cierre(cuota = 100, proyeccion = 110, varianza = 400)
  expect_true(poco > mucho)
  expect_equal(poco, 1, tolerance = 1e-3)      # 10 de margen sobre sd 2
  expect_true(mucho > 0.6 && mucho < 0.75)     # 10 sobre sd 20
})

test_that("justo en la cuota la probabilidad es 0,5, no «asegurada»", {
  # `.mac_estado_proyectado()` llama a esto `ajustada`. La probabilidad dice lo
  # que esa etiqueta no: que es una moneda al aire.
  expect_equal(.mac_probabilidad_de_cierre(100, 100, 25), 0.5)
})

test_that("sin varianza medible se devuelve NA, no una certeza", {
  expect_true(is.na(.mac_probabilidad_de_cierre(100, 150, NA_real_)))
  expect_true(is.na(.mac_probabilidad_de_cierre(100, 150, 0)))
  expect_true(is.na(.mac_probabilidad_de_cierre(0, 10, 4)))       # sin cuota
  expect_true(is.na(.mac_probabilidad_de_cierre(100, NA_real_, 4)))
})

test_that("la varianza de un aula sale de su media y su tasa, sin datos nuevos", {
  # Binomial: media = n*p, varianza = n*p*(1-p) = media*(1-p).
  fila <- list(eligible_n = 40, expected_valid = 22, tasa_efectividad_aula = 0.55)
  v <- .mac_varianza_por_sexo(fila, c(F = 10, M = 12))
  expect_equal(unname(v[["F"]]), 10 * (1 - 0.55))
  expect_equal(unname(v[["M"]]), 12 * (1 - 0.55))
  expect_identical(names(v), c("F", "M"))
})

test_that("sin tasa declarada se deduce de esperadas sobre elegibles", {
  fila <- list(eligible_n = 40, expected_valid = 20)   # tasa implicita 0,5
  v <- .mac_varianza_por_sexo(fila, c(F = 8))
  expect_equal(unname(v[["F"]]), 8 * 0.5)
})

test_that("una tasa de 1 NO da varianza cero: da NA", {
  # Es el caso del proyecto de referencia sin efectividad configurada, donde
  # `expected_valid == eligible_n`. Varianza cero afirmaria certeza absoluta
  # sobre el campo; NA dice que no se sabe.
  fila <- list(eligible_n = 44, expected_valid = 44)
  expect_true(all(is.na(.mac_varianza_por_sexo(fila, c(F = 20, M = 24)))))
  expect_true(all(is.na(.mac_varianza_por_sexo(list(eligible_n = 0, expected_valid = 0), c(F = 1)))))
})

test_that("el avance por celda publica la probabilidad y NA cuando no se puede", {
  plan <- list(
    list(faculty = "DERECHO", operational_status = "pendiente", eligible_n = 40,
         expected_valid = 22, tasa_efectividad_aula = 0.55,
         mujeres_esperadas = 12, hombres_esperados = 10),
    # Sin tasa: envenena la suma de SU celda a proposito.
    list(faculty = "LETRAS", operational_status = "pendiente", eligible_n = 30,
         expected_valid = 30, mujeres_esperadas = 15, hombres_esperados = 15)
  )
  cuotas <- list(
    list(faculty = "DERECHO", sex = "F", target = 10, observed = 0),
    list(faculty = "LETRAS", sex = "F", target = 10, observed = 0)
  )
  out <- monitoreo_aulas_avance_sexo_facultad(plan, cuotas)
  der <- Filter(function(x) identical(x$faculty, "DERECHO"), out)[[1]]
  let <- Filter(function(x) identical(x$faculty, "LETRAS"), out)[[1]]
  expect_true(is.finite(der$prob_cierre))
  expect_true(is.na(let$prob_cierre))
  # Y la probabilidad no reemplaza al estado: conviven.
  expect_true(nzchar(der$estado))
})

test_that("lo APLICADO no aporta incertidumbre", {
  # Una celda cuyas aulas ya se aplicaron todas no tiene nada pendiente que
  # varie, asi que no hay probabilidad que dar: lo que hay, hay.
  plan <- list(list(faculty = "DERECHO", operational_status = "aplicada",
                    eligible_n = 40, expected_valid = 22,
                    tasa_efectividad_aula = 0.55,
                    mujeres_esperadas = 12, hombres_esperados = 10))
  out <- monitoreo_aulas_avance_sexo_facultad(
    plan, list(list(faculty = "DERECHO", sex = "F", target = 10, observed = 12))
  )
  expect_true(is.na(out[[1]]$prob_cierre))
})
