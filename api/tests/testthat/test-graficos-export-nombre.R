# D6 (mazo de Arte y Diseño, 2026-10-12): el informe conjunto de tres bases salía «…_docentes_reporte…».

test_that("el informe conjunto multibase no lleva la base activa en el nombre; uno por base, sí", {
  # ADR 0133 §3: <Estudio>_<Entregable>[_<Base>]_<dd_mm_yy>; el estudio es el código de la Ficha.
  sid <- session_create()
  withr::defer(session_delete(sid))
  .planner_declarar(sid, "estudio", list(nombre = "Arte y Diseño", codigo = "arte"), 0L)
  for (b in c("docentes", "estudiantes")) {
    estudio_add_base(sid, b, xlsform_file_id = paste0("x-", b), data_file_id = paste0("d-", b),
                     data_ext = "xlsx", rp_data = data.frame(a = 1), rp_inst = NULL)
  }
  local_mocked_bindings(
    .graficos_active_base_name = function(sid) "docentes",
    estudio_is_independent_siblings = function(sid) FALSE
  )
  expect_false(grepl("docentes", .graficos_export_filename(sid, "reporte_ppt", "pptx")))
  local_mocked_bindings(estudio_is_independent_siblings = function(sid) TRUE)
  expect_match(.graficos_export_filename(sid, "reporte_ppt", "pptx"), "^arte_Informe_docentes_")
})
