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
