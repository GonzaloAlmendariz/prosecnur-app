test_that("p_slide_tabla_tecnica accepts editable text rows", {
  slide <- p_slide_tabla_tecnica(
    titulo = "Ficha técnica",
    filas = paste(
      "Tipo y técnica: Encuesta online",
      "Muestra: 120 egresados/as",
      sep = "\n"
    )
  )

  expect_s3_class(slide, "ppt_slide")
  expect_identical(slide$.slide_type, "technical_table")
  expect_true(is.data.frame(slide$slots$table))
  expect_equal(names(slide$slots$table), c("criterio", "detalle"))
  expect_equal(slide$slots$table$criterio, c("Tipo y técnica", "Muestra"))
  expect_equal(slide$slots$table$detalle, c("Encuesta online", "120 egresados/as"))
})

test_that("p_slide_tabla_tecnica accepts JSON-like row lists", {
  slide <- p_slide_tabla_tecnica(
    titulo = "Ficha técnica",
    filas = list(
      list(criterio = "Universo", detalle = "Egresados/as"),
      list(campo = "Trabajo de campo", valor = "Junio 2026")
    )
  )

  expect_equal(nrow(slide$slots$table), 2)
  expect_equal(slide$slots$table$criterio, c("Universo", "Trabajo de campo"))
  expect_equal(slide$slots$table$detalle, c("Egresados/as", "Junio 2026"))
})
