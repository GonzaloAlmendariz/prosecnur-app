source("setup-load-all.R")

test_that("perfil ACNUR resuelve plantilla y opciones de entrega institucionales", {
  withr::local_options(list(prosecnur.template_pptx = NA_character_))
  cfg <- list(scope_rules = list(global = list(profile_id = "acnur_kobo_cruncher_plus")))
  delivery <- .graficos_delivery_options(cfg)
  path <- .graficos_resolve_template_pptx(config = cfg)

  expect_equal(delivery$template_id, "acnur_16_9")
  expect_false(delivery$auto_otros_slides)
  expect_equal(basename(path), "plantilla_acnur_16_9.pptx")
  expect_true(file.exists(path))
})

test_that("perfil generico conserva plantilla y las laminas Otros son opt-in", {
  withr::local_options(list(prosecnur.template_pptx = NA_character_))
  delivery <- .graficos_delivery_options(list())
  path <- .graficos_resolve_template_pptx(config = list())

  expect_equal(delivery$template_id, "generic_16_9")
  # B45/G-18: la lamina Otros es opt-in universal (pedido directo).
  expect_false(delivery$auto_otros_slides)
  expect_equal(basename(path), "plantilla_16_9.pptx")
})

test_that("preview de layout informa la misma plantilla solicitada", {
  withr::local_options(list(prosecnur.template_pptx = NA_character_))
  preview <- .graficos_slide_layout_preview(
    "p_slide_1_grafico_narrativo",
    profile_id = "acnur_kobo_cruncher_plus"
  )
  expect_true(preview$ok)
  expect_equal(preview$source, "template")
  expect_equal(preview$template_id, "acnur_16_9")
})

test_that("catalogo de estilos publica template y politica de Otros", {
  profiles <- .ppt_style_profiles_payload()$style_profiles
  acnur <- profiles[[which(vapply(profiles, function(x) identical(x$name, "acnur_kobo_cruncher_plus"), logical(1)))]]
  expect_equal(acnur$template_id, "acnur_16_9")
  expect_false(acnur$auto_otros_slides)
  expect_equal(acnur$scope_rules$global$template_id, "acnur_16_9")
  expect_false(acnur$scope_rules$global$auto_otros_slides)
})
