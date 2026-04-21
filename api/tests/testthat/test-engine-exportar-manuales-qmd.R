test_that("exportar_manuales_qmd copia qmd y files_manuales en un destino temporal", {
  dest <- tempfile("manuales_dest_")

  expect_no_error({
    out <- prosecnur::exportar_manuales_qmd(
      dir_destino = dest,
      render_pdf = FALSE,
      limpiar_destino = TRUE
    )
  })

  expect_true(dir.exists(dest))
  expect_true(file.exists(file.path(dest, "guia_codificacion_aplicada.qmd")))
  expect_true(file.exists(file.path(dest, "guia_entregables_aplicada.qmd")))
  expect_true(file.exists(file.path(dest, "guia_ppt_plan_aplicada.qmd")))
  expect_true(dir.exists(file.path(dest, "files_manuales")))
  expect_true(file.exists(file.path(dest, "files_manuales", "typst", "manuales_base.typ")))
  expect_true(file.exists(file.path(dest, "files_manuales", "data_ejemplo", "codificacion", "instrumento_ejercicio.xlsx")))
  expect_true(file.exists(file.path(dest, "files_manuales", "data_ejemplo", "reportes", "rp_data.rds")))
  expect_match(out$dest_dir, "manuales_dest_")
})
