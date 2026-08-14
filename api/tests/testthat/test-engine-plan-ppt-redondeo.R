source("setup-load-all.R")

# La lámina metodológica de redondeo (ítem 17 del checklist). Hermana de la de
# Top Two Box: mismo layout y mismos tres slots, renderer propio en
# `reporte_slide_redondeo.R` porque `reporte_plan_ppt.R` está congelado.

.redondeo_inst <- function() {
  list(
    survey = data.frame(name = "x", type = "integer",
                        list_name = NA_character_, stringsAsFactors = FALSE),
    choices = NULL, orders_list = NULL
  )
}

test_that("el constructor arma el slide con el ejemplo de la casa", {
  s <- p_slide_redondeo()
  expect_s3_class(s, "ppt_slide")
  expect_equal(s$.slide_type, "redondeo")
  # El ejemplo por defecto NO es redondo a propósito: dos categorías de una
  # sola persona son justo donde los dos métodos discrepan de forma visible.
  expect_equal(s$slots$casos, c(1, 10, 72, 94, 1))
  expect_equal(sum(s$slots$casos), 178)
})

test_that("el diagrama muestra la misma distribucion por los dos metodos", {
  svg <- .redondeo_slide_svg()
  txt <- paste(readLines(svg, warn = FALSE, encoding = "UTF-8"), collapse = "\n")

  expect_match(txt, "Redondeo estándar", fixed = TRUE)
  expect_match(txt, "Reparto a 100 %", fixed = TRUE)
  # Las sumas son el nudo de la lámina: 101 arriba y 100 abajo.
  expect_match(txt, "Suman 101%", fixed = TRUE)
  expect_match(txt, "Suman 100%", fixed = TRUE)
})

test_that("el ejemplo sale de la misma funcion que rotula el mazo", {
  # Si la lámina calculara su ejemplo por su cuenta podría acabar enseñando un
  # comportamiento que el motor ya no tiene.
  p <- c(1, 10, 72, 94, 1) / 178
  expect_equal(.pulso_pct_unidades(p, 0, "estandar"), c(1L, 6L, 40L, 53L, 1L))
  expect_equal(sum(.pulso_pct_unidades(p, 0, "reparto")), 100L)
})

test_that("un ejemplo con otros casos no revienta el diagrama", {
  for (casos in list(c(50, 50), c(1, 1, 1), c(0, 100), c(3, 17, 41, 39))) {
    svg <- .redondeo_slide_svg(casos = casos, etiquetas = rep("Cat", length(casos)))
    expect_true(file.exists(svg))
    expect_gt(file.size(svg), 200)
  }
})

test_that("la lamina se renderiza en el PPT", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  out_ppt <- tempfile(fileext = ".pptx")
  expect_no_error(
    reporte_ppt_plan(
      data = data.frame(x = 1),
      instrumento = .redondeo_inst(),
      plan = list(diapo_001 = p_slide_redondeo()),
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    )
  )

  slide_xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"),
                               warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(slide_xml, "CÓMO SE REDONDEAN LAS CIFRAS", fixed = TRUE)

  ppt_files <- utils::unzip(out_ppt, list = TRUE)$Name
  svg_files <- ppt_files[grepl("^ppt/media/.*[.]svg$", ppt_files)]
  expect_length(svg_files, 1)
  svg_txt <- paste(readLines(unz(out_ppt, svg_files[[1]]),
                             warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(svg_txt, "Suman 101%", fixed = TRUE)
})

test_that("el titulo y el ejemplo se pueden cambiar", {
  s <- p_slide_redondeo(titulo = "Nota metodológica", casos = c(2, 3),
                        etiquetas = c("Sí", "No"), decimales = 1)
  expect_equal(s$slots$title, "Nota metodológica")
  expect_equal(s$slots$decimales, 1)
  svg <- .redondeo_slide_svg(casos = c(2, 3), etiquetas = c("Sí", "No"), decimales = 1)
  txt <- paste(readLines(svg, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(txt, "40.0%", fixed = TRUE)
  expect_match(txt, "60.0%", fixed = TRUE)
})
