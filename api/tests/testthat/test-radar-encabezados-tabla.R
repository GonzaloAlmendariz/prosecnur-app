test_that("los publicos salen capitalizados en el encabezado", {
  # El entregable aprobado escribe «Docentes», «Estudiantes» y «Egresados»; el
  # motor sacaba las tres columnas en minuscula porque el nombre viaja tal como
  # lo nombra el estudio y ese es el nombre de la BASE, no un encabezado.
  tabla <- data.frame(tema = "x", docentes = 1, estudiantes = 2, egresados = 3)
  expect_equal(
    .radar_mb_nombres_tabla(tabla),
    c("Tema", "Docentes", "Estudiantes", "Egresados")
  )
})


test_that("solo se toca la inicial", {
  # Capitalizar palabra a palabra destrozaria siglas: «I+D+i» no es «I+D+I».
  expect_equal(.radar_mb_capitalizar("i+D+i"), "I+D+i")
  expect_equal(.radar_mb_capitalizar("gestion de la PUCP"), "Gestion de la PUCP")
})


test_that("un nombre ya capitalizado no se altera", {
  expect_equal(.radar_mb_capitalizar(c("Docentes", "PUCP")), c("Docentes", "PUCP"))
})


test_that("lo vacio y lo ausente no rompen", {
  expect_equal(.radar_mb_capitalizar(c("", NA_character_)), c("", NA_character_))
})


test_that("un encabezado declarado a mano sale literal", {
  # Es una decision explicita del autor: si escribe «docentes» en minuscula,
  # sale en minuscula. La capitalizacion es un default, no una imposicion.
  tabla <- data.frame(tema = "x", docentes = 1)
  expect_equal(
    .radar_mb_nombres_tabla(tabla, encabezados = list(docentes = "docentes (n=51)")),
    c("Tema", "docentes (n=51)")
  )
})


test_that("`tabla_titulo` sigue mandando sobre la primera columna", {
  tabla <- data.frame(tema = "x", docentes = 1)
  expect_equal(
    .radar_mb_nombres_tabla(tabla, titulo_tema = "Top Two Box")[1],
    "Top Two Box"
  )
})


test_that("la LEYENDA del radar tambien sale capitalizada", {
  # P19 capitalizo la tabla y la leyenda se quedo en «docentes», «estudiantes»,
  # «egresados». Visible en las laminas 53 y 54 del PDF.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficos_radar_multibase.R"),
    warn = FALSE
  )
  i <- grep("levels(datos_graf$grupo) <- .radar_mb_capitalizar", f, fixed = TRUE)
  expect_length(i, 1L)
})


test_that("el origen NO se capitaliza: de ahi cuelgan las claves", {
  # `.radar_mb_tabla()` toma los nombres de columna de `levels(datos$grupo)` y
  # `tabla_encabezados` casa por clave con `match()`. Capitalizar arriba dejaria
  # un `docentes = "Docentes (n=51)"` sin columna que renombrar, en silencio.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficos_radar_multibase.R"),
    warn = FALSE
  )
  origen <- grep("out$grupo <- factor(out$grupo", f, fixed = TRUE)
  expect_length(origen, 1L)
  expect_false(grepl("capitalizar", f[origen], fixed = TRUE))
})
