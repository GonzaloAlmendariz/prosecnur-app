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

test_that("preview v1 degrada si la plantilla no puede resolverse", {
  corrupt <- tempfile(fileext = ".pptx")
  writeLines("no es un archivo pptx", corrupt, useBytes = TRUE)
  withr::local_options(list(prosecnur.template_pptx = corrupt))

  preview <- .graficos_slide_layout_preview("p_slide_1_grafico")
  expect_true(preview$ok)
  expect_identical(preview$source, "reference_local")
  expect_identical(preview$reason, "template_unreadable")
  expect_identical(preview$contract, "slide_1")
  expect_length(preview$placeholders, 0L)
})

test_that("preview v1 conserva type y type_idx efectivos sin ampliar el wire v2", {
  skip_if_not_installed("officer")
  preview <- .graficos_slide_layout_preview(
    "p_slide_objetivo_icono",
    template_id = "acnur_16_9"
  )
  by_key <- setNames(preview$placeholders, vapply(preview$placeholders, `[[`, character(1), "key"))

  expect_identical(by_key$text$type, "body")
  expect_identical(as.integer(by_key$text$type_idx), 1L)
  expect_identical(by_key$icon$type, "body")
  expect_identical(as.integer(by_key$icon$type_idx), 2L)

  matrix <- .graficos_slide_layout_matrix(template_id = "acnur_16_9")
  objective <- matrix$slides[[which(vapply(
    matrix$slides,
    function(slide) identical(slide$tipo, "p_slide_objetivo_icono"),
    logical(1)
  ))[[1]]]]
  expect_false(any(c("type", "type_idx") %in% names(objective$regions[[1]])))
})

test_that("preview-slide render PNG option is opt-in", {
  expect_false(.graficos_preview_bool_option(list(), "render_slide_preview", FALSE))
  expect_true(.graficos_preview_bool_option(list(render_slide_preview = TRUE), "render_slide_preview", FALSE))
  expect_error(
    .graficos_preview_bool_option(list(render_slide_preview = "true"), "render_slide_preview", FALSE),
    "render_slide_preview debe ser booleano"
  )
})

test_that("el footer ACNUR usa la calibración efectiva y no cae al panel o logo", {
  skip_if_not_installed("officer")

  # La plantilla ACNUR no tiene el body idx=4 del contrato genérico. El
  # resolver compartido con el renderer lo recalibra al cajón inferior derecho
  # real (body idx=3), sin caer al panel narrativo ni a un logo.
  acnur <- .graficos_slide_layout_preview("p_slide_grafico_texto_derecha", template_id = "acnur_16_9")
  keys_acnur <- vapply(acnur$placeholders, function(x) x$key %||% "", character(1))
  expect_true("footer" %in% keys_acnur)
  footer <- acnur$placeholders[[which(keys_acnur == "footer")[[1]]]]
  expect_identical(footer$role, "note")
  expect_gt(footer$rect$x, 0.55)
  expect_gt(footer$rect$y, 0.85)
  expect_lt(footer$rect$height, 0.1)

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
