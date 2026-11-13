# D9: el cruce entre públicos se cuenta por correo, se muestra y no se descuenta.

test_that("el cruce cuenta por correo normalizado, por par y sin descontar", {
  out <- calc_muestra_cruce_entre_publicos(list(
    list(id = "doc", nombre = "Docentes", correos = c("a@x.pe", " B@X.pe ", "c@x.pe", "", NA, "d@x.pe")),
    list(id = "adm", nombre = "Administrativos", correos = c("b@x.pe", "e@x.pe")),
    list(id = "egr", nombre = "Egresados", correos = c("c@x.pe", "b@x.pe", "f@x.pe"))
  ))
  doc <- out$publicos[[1]]
  expect_true(out$hay_cruce)
  expect_equal(doc$invitados, 6)
  expect_equal(doc$sin_correo, 2)
  # b está en dos públicos, c en uno: dos personas compartidas, no tres.
  expect_equal(doc$compartidos, 2)
  expect_equal(vapply(doc$pares, `[[`, numeric(1), "n"), c(1, 2))
  expect_equal(out$publicos[[2]]$compartidos, 1)
  expect_null(doc$exige)
})

test_that("la meta se avisa cuando sin los compartidos exige más de lo esperado", {
  correos <- sprintf("p%02d@x.pe", 1:20)
  out <- calc_muestra_cruce_entre_publicos(
    list(list(id = "a", nombre = "A", correos = correos),
         list(id = "b", nombre = "B", correos = correos[1:10])),
    metas = list(a = 5, b = 10), tasas = list(a = 0.3, b = 0.5)
  )
  a <- out$publicos[[1]]
  expect_equal(a$exige, 5 / 20)
  expect_equal(a$exige_sin_compartidos, 5 / 10)
  expect_true(a$alcanza)
  expect_false(a$alcanza_sin_compartidos)
  # B tiene a todas sus personas en A: sin ellas no queda nadie a quien invitar.
  b <- out$publicos[[2]]
  expect_null(b$exige_sin_compartidos)
  expect_false(b$alcanza_sin_compartidos)
})

test_that("sin cruce, sin metas ni tasas no hay aviso", {
  out <- calc_muestra_cruce_entre_publicos(list(
    list(id = "a", nombre = "A", correos = c("x@x.pe")),
    list(id = "b", nombre = "B", correos = c("y@x.pe"))
  ))
  expect_false(out$hay_cruce)
  expect_true(is.na(out$publicos[[1]]$alcanza))
})

test_that("una tabla de conteos o un marco sin correo no se cruzan", {
  expect_null(.cm_cruce_correos_del_actor(data.frame(x = 1), list(tipo = "conteos")))
  receta <- .cm_receta_normalizar(list(columnas = list(id = "id", correo = "")))
  expect_null(.cm_cruce_correos_del_actor(data.frame(id = 1:2), receta))
  receta <- .cm_receta_normalizar(list(columnas = list(id = "id", correo = "mail")))
  datos <- data.frame(id = c("1", "2"), mail = c("a@x.pe", "b@x.pe"), stringsAsFactors = FALSE)
  expect_equal(.cm_cruce_correos_del_actor(datos, receta), c("a@x.pe", "b@x.pe"))
})
