# D6 (mazo de Arte y Diseño, 2026-10-12): el informe conjunto de tres bases salía «…_docentes_reporte…».

test_that("el informe conjunto multibase no lleva la base activa en el nombre; uno por base, sí", {
  local_mocked_bindings(
    .export_project_slug = function(sid) "arte",
    .export_date_slug = function() "13_10_26",
    .graficos_active_base_name = function(sid) "docentes",
    estudio_is_independent_siblings = function(sid) FALSE
  )
  expect_false(grepl("docentes", .graficos_export_filename("s", "reporte_ppt", "pptx")))
  local_mocked_bindings(estudio_is_independent_siblings = function(sid) TRUE)
  expect_match(.graficos_export_filename("s", "reporte_ppt", "pptx"), "^arte_docentes_")
})
