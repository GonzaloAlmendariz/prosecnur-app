test_that("decir que no hay nada que decir no es rellenar el campo", {
  # Medido en acnur_pdm: meter «no» entre los rellenos daba un 33 % de relleno
  # en `recomendation` que era gente contestando que no tenia recomendaciones.
  s <- monitoreo_texto_senales(c("no", "ninguno", ".", "-", "xx"))
  expect_equal(s$negativa, c(TRUE, TRUE, FALSE, FALSE, FALSE))
  expect_equal(s$relleno, c(FALSE, FALSE, TRUE, TRUE, TRUE))
})

test_that("las dos cosas conviven en una misma pregunta y se cuentan aparte", {
  # Es el caso de `comentario_encuestador` en acnur_acg: 8.7 % de relleno y
  # 10.4 % de negativas en la misma columna.
  v <- c(rep(".", 2), rep("ninguno", 3), "el aula estaba llena", "sin incidencias")
  p <- monitoreo_texto_perfil(v)
  expect_equal(p$pct_relleno, round(100 * 2 / 7, 1))
  expect_equal(p$pct_negativa, round(100 * 3 / 7, 1))
})

test_that("un campo con solo puntuacion es relleno aunque no este en la lista", {
  s <- monitoreo_texto_senales(c("...", "??", "--", "a"))
  expect_equal(s$relleno, c(TRUE, TRUE, TRUE, FALSE))
})

test_that("las repeticiones ignoran mayusculas y espacios de sobra", {
  s <- monitoreo_texto_senales(c("NO hay", "no  hay", "no hay", "otra cosa"))
  expect_equal(s$repeticiones, c(3L, 3L, 3L, 1L))
})

test_that("una respuesta vacia no ocupa fila, y las filas apuntan al caso original", {
  # El indice tiene que servir para volver al caso y marcarlo; si se
  # renumerara, la señal no se podria seguir hasta la respuesta.
  s <- monitoreo_texto_senales(c("", "algo", NA, "  ", "otra"))
  expect_equal(s$fila, c(2L, 5L))
  expect_equal(s$texto, c("algo", "otra"))
})

test_that("el perfil describe la pregunta, no la juzga", {
  # `Enumerator_name` de acnur_pdm: 430 respuestas, 99.3 % repetidas. Repetir
  # ahi es lo correcto, y el perfil tiene que poder decirlo sin marcar nada.
  v <- c(rep("Ana Torres", 149), "Luis Paz")
  p <- monitoreo_texto_perfil(v, "quien encuesto")
  expect_equal(p$etiqueta, "quien encuesto")
  expect_equal(p$pct_repetida, 99.3)
  expect_equal(p$pct_relleno, 0)
  expect_equal(p$distintas, 2L)
})

test_that("el orden de lectura pone primero lo vacio y despues lo mas corto", {
  o <- monitoreo_texto_orden_de_lectura(c(
    "una respuesta larga y con contenido", "ok", ".", "algo mas"
  ))
  expect_equal(o$texto[1], ".")
  expect_equal(o$texto[2], "ok")
  expect_equal(o$texto[4], "una respuesta larga y con contenido")
})

test_that("el orden de lectura no esconde ninguna respuesta", {
  # Es un visualizador: ordena por donde empezar, no decide que se lee.
  v <- c("larga y con contenido de verdad", ".", "no", "x", "otra normal")
  expect_equal(nrow(monitoreo_texto_orden_de_lectura(v)), 5L)
})

test_that("entre igual de cortas, primero la que mas se repite", {
  o <- monitoreo_texto_orden_de_lectura(c("ab", "cd", "ab", "ef", "ab"))
  expect_equal(o$texto[1], "ab")
  expect_equal(o$repeticiones[1], 3L)
})

test_that("una pregunta sin respuestas no rompe nada", {
  s <- monitoreo_texto_senales(c(NA, "", "   "))
  expect_equal(nrow(s), 0L)
  p <- monitoreo_texto_perfil(c(NA, "", "   "))
  expect_equal(p$contestadas, 0L)
  expect_equal(p$sin_contestar, 3L)
  expect_true(is.na(p$pct_relleno))
})
