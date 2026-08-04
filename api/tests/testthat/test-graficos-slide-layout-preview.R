test_that("graficos slide layout preview returns normalized template geometry", {
  skip_if_not_installed("officer")

  preview <- .graficos_slide_layout_preview("p_slide_2_graficos")

  expect_true(isTRUE(preview$ok))
  expect_equal(preview$tipo, "p_slide_2_graficos")
  expect_equal(preview$contract, "slide_2")
  expect_equal(preview$layout, "Graficos_2columnas")
  expect_gt(preview$aspectRatio, 1)
  expect_gt(length(preview$placeholders), 0)

  payload_keys <- vapply(preview$placeholders, function(x) x$payload_key %||% "", character(1))
  expect_true(all(c("izquierda", "derecha") %in% payload_keys))

  rect <- preview$placeholders[[which(payload_keys == "izquierda")[[1]]]]$rect
  expect_true(all(vapply(rect, is.numeric, logical(1))))
  expect_true(all(unlist(rect) >= 0))
  expect_lte(rect$x + rect$width, 1.01)
  expect_lte(rect$y + rect$height, 1.01)
})

test_that("graficos slide layout preview degrades to local reference for unknown types", {
  preview <- .graficos_slide_layout_preview("p_slide_inexistente")

  expect_true(isTRUE(preview$ok))
  expect_equal(preview$source, "reference_local")
  expect_equal(preview$reason, "unknown_tipo")
  expect_equal(length(preview$placeholders), 0)
})

test_that("preview-slide render PNG option is opt-in", {
  expect_false(.graficos_preview_bool_option(list(), "render_slide_preview", FALSE))
  expect_true(.graficos_preview_bool_option(list(render_slide_preview = TRUE), "render_slide_preview", FALSE))
  expect_error(
    .graficos_preview_bool_option(list(render_slide_preview = "true"), "render_slide_preview", FALSE),
    "render_slide_preview debe ser booleano"
  )
})

test_that("un slot con type_idx inexistente en la plantilla no se ofrece (no cae al logo)", {
  skip_if_not_installed("officer")

  # En plantilla_acnur el layout right_grafico_texto no tiene body idx=4:
  # antes el footer caia al primer body del tipo (posiciones arbitrarias,
  # incluida la caja grande de texto). Ahora el slot se omite.
  acnur <- .graficos_slide_layout_preview("p_slide_grafico_texto_derecha", template_id = "acnur_16_9")
  keys_acnur <- vapply(acnur$placeholders, function(x) x$key %||% "", character(1))
  expect_false("footer" %in% keys_acnur)

  # En la plantilla generica el idx existe y el slot se sigue ofreciendo.
  generic <- .graficos_slide_layout_preview("p_slide_grafico_texto_derecha", template_id = "generic_16_9")
  keys_generic <- vapply(generic$placeholders, function(x) x$key %||% "", character(1))
  expect_true("footer" %in% keys_generic)
})

test_that("el pie derecho de slide_1 se clasifica como nota, no como grafico", {
  skip_if_not_installed("officer")

  preview <- .graficos_slide_layout_preview("p_slide_1_grafico")
  keys <- vapply(preview$placeholders, function(x) x$key %||% "", character(1))
  roles <- vapply(preview$placeholders, function(x) x$role %||% "", character(1))
  expect_true("right" %in% keys)
  expect_identical(roles[[which(keys == "right")[[1]]]], "note")
  expect_identical(roles[[which(keys == "plot")[[1]]]], "chart")
})

test_that("el subtitulo del separador declara que solo aplica a Word", {
  meta <- .SLIDES_META[["p_slide_seccion"]]
  args <- meta$args
  nombres <- vapply(args, function(a) a$name, character(1))
  sub <- args[[which(nombres == "subtitulo")[[1]]]]
  expect_match(sub$label, "Word")
  expect_match(sub$descripcion, "Word")
})
