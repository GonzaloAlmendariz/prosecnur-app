test_that("el extremo negativo de la escala NO va en rojo", {
  # Misma regla que el verificador aplica al resto del mazo —R4, «el rojo
  # institucional es color de TITULO, no extremo de escala»— y que el entregable
  # aprobado cumple: su lamina de top two box arranca en `F4B183` y en todo el
  # mazo no tiene un solo rojo en una rampa.
  #
  # Esta lamina se habia quedado fuera de esa regla: era el unico sitio donde el
  # motor pintaba un segmento de escala en rojo (`D8504F`).
  f <- readLines(
    testthat::test_path("..", "..", "R", "reporte_plan_ppt.R"),
    warn = FALSE
  )
  i <- grep('default <- .std_paleta("likert")', f, fixed = TRUE)
  expect_length(i, 1L)
  # Y el rojo no vuelve por la puerta de atras en esa misma paleta.
  expect_false(grepl("coral", f[i], fixed = TRUE))
  # y la paleta del estándar arranca en naranja, no en rojo (ADR 0092)
  expect_equal(.std_paleta("likert")[1], "#F4B183")
})


test_that("el acento del titulo SI sigue siendo rojo", {
  # R4 separa los dos usos: el rojo es color de titulo y de la llave que anota
  # el top two box. Quitarlo de ahi seria pasarse de largo.
  f <- paste(readLines(
    testthat::test_path("..", "..", "R", "reporte_plan_ppt.R"),
    warn = FALSE
  ), collapse = " ")
  expect_true(grepl('"accent_color"', f, fixed = TRUE))
  expect_true(grepl('.style_value(style, "accent_color", .std_color("coral"))', f, fixed = TRUE))
})
