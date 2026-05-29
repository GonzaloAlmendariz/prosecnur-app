test_that("validacion multibase scopea variantes por llave de origen", {
  base_meta <- list(
    multi_integrated = list(
      origin_key_name = "pais",
      variant_map = list(
        list(origin_key = "México", to = "p10_mexico"),
        list(origin_key = "Perú", to = "p10_peru")
      )
    )
  )

  inst <- list(
    survey = data.frame(
      type = c("text", "select_one empresas_mx", "select_one empresas_pe"),
      name = c("pais", "p10_mexico", "p10_peru"),
      label = c("pais", "Empresa - México", "Empresa - Perú"),
      required = c(NA, "yes", "yes"),
      relevant = c(NA, NA, NA),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("empresas_mx", "empresas_pe"),
      name = c("a", "c"),
      label = c("Empresa A", "Empresa C"),
      stringsAsFactors = FALSE
    )
  )
  datos <- data.frame(
    pais = c("México", "México", "Perú", "Perú"),
    p10_mexico = c("a", "a", NA, NA),
    p10_peru = c(NA, NA, "c", "c"),
    stringsAsFactors = FALSE
  )

  raw_bundle <- build_validation_bundle(
    instrumento = inst,
    incluir = list(required = TRUE, relevant = FALSE, constraint = FALSE)
  )
  raw_ev <- evaluate_validation_bundle(raw_bundle, datos, strict = FALSE)
  expect_gt(sum(raw_ev$resumen$n_inconsistencias, na.rm = TRUE), 0)

  patched_bundle <- .validacion_patch_integrated_bundle(raw_bundle, base_meta)
  patched_ev <- evaluate_validation_bundle(patched_bundle, datos, strict = FALSE)
  req_rows <- patched_ev$resumen[patched_ev$resumen$tipo_regla == "required", , drop = FALSE]
  expect_true(nrow(req_rows) >= 2)
  expect_true(all(req_rows$n_inconsistencias == 0))

  patched_inst <- .validacion_patch_integrated_instrument(inst, base_meta)
  expect_match(patched_inst$survey$relevant[patched_inst$survey$name == "p10_mexico"], "pais")
  expect_match(patched_inst$survey$relevant[patched_inst$survey$name == "p10_peru"], "pais")
})
