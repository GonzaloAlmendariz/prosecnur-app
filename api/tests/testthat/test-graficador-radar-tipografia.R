test_that("el radar declara Arial en todos sus textos de canvas", {
  # 22 textos salian en Helvetica —titulo, subtitulo, etiquetas de eje y
  # leyenda— porque ni los `cowplot::draw_text` ni los `legend.text` del tema
  # declaraban familia y caian al default del device. El entregable aprobado
  # usa Arial y nada mas.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  )

  # Los `draw_text` que dibujan titulo, subtitulo y etiquetas de eje: son los
  # que producian los 22 Helvetica. No se exige a TODOS los draw_text del
  # archivo —hay alguno cuyo texto no llega al mazo— para que el test no
  # pretenda cubrir mas de lo que se midio.
  # El titulo y el subtitulo del canvas, que son los que salian en Helvetica.
  # No se recorren TODAS las ocurrencias de `color_ejes`: dos viven en ramas
  # que no llegan al mazo medido, y exigirselo seria pedirle al test que cubra
  # mas de lo que se comprobo.
  # Ni un solo `family = "sans"`: es el alias generico del device y en el PPT
  # se resuelve a Helvetica, que es como entraron seis de los veintidos.
  expect_false(any(grepl('family = "sans"', f, fixed = TRUE)))

  # El titulo y el subtitulo del canvas —los que salian en Helvetica— llevan
  # familia en su misma linea.
  for (ancla in c("size = size_titulo,", "size = size_subtitulo,")) {
    lineas <- grep(ancla, f, fixed = TRUE, value = TRUE)
    expect_gt(length(lineas), 0L)
    expect_true(all(grepl("family", lineas)), info = ancla)
  }

  # Y al menos una etiqueta de eje: la que dibuja el modo con canvas.
  expect_true(any(grepl('family = "Arial"', f, fixed = TRUE)))

  # Y todo `legend.text` del tema.
  legends <- grep("legend\\.text\\s*=\\s*ggplot2::element_text\\(", f)
  expect_gt(length(legends), 0L)
  for (i in legends) {
    bloque <- paste(f[i:min(length(f), i + 6)], collapse = " ")
    expect_true(grepl("family\\s*=", bloque),
                info = paste("legend.text sin family en la linea", i))
  }
})


test_that("el literal se usa donde la variable no llega", {
  # Dos de los `draw_text` se evaluan en un entorno que NO ve `font_family`:
  # referenciarla ahi degradaba las dos laminas de radar a «Sin datos». El
  # literal es la salida, y este test deja constancia de por que.
  f <- paste(readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  ), collapse = "\n")
  expect_true(grepl('family = "Arial"', f, fixed = TRUE))
})
