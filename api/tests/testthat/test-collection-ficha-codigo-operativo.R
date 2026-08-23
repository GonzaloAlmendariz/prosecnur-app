# La ficha que llega al aula se titulaba con el nombre academico —«1ges08_0601»—
# y no con «CH 1», que es el codigo con el que el equipo la llama en el libro de
# agendacion, en Monitoreo y en voz alta. El codigo solo aparecia de refilon,
# dentro del rol de un reemplazo («Reemplazo de CH 3»).
#
# Es el mismo defecto que la tabla del plan, un artefacto mas alla y en el peor
# sitio: un papel impreso no se corrige despues.

.fco_unit <- function(dims = list()) list(
  unit_id = "unit-aulas-aula-1-5524e6773d",
  label = "1ges08_0601",
  role = "titular",
  group = "M1",
  dimensions = dims
)

test_that("el contexto de la ficha resuelve el codigo operativo", {
  ctx <- prosecnurapp:::.crf_unit_context(.fco_unit(list(legacy_ref = "CH 1")))
  expect_identical(ctx$operational_code, "CH 1")
  # Y el nombre academico sigue disponible: identifica el aula en el sistema.
  expect_identical(ctx$label, "1ges08_0601")
})

test_that("sin codigo operativo la ficha no se queda sin titulo", {
  # Una ficha sin encabezado seria peor que una titulada con el nombre academico.
  ctx <- prosecnurapp:::.crf_unit_context(.fco_unit())
  expect_identical(ctx$operational_code, "1ges08_0601")
})

test_that("el binding esta permitido y la plantilla lo usa de titulo", {
  expect_true("unit.operational_code" %in% COLLECTION_MATERIAL_BINDINGS)
  fuente <- paste(readLines("../../R/collection_materials.R", warn = FALSE), collapse = "\n")
  expect_match(fuente, 'block_id = "unit", type = "heading", binding = "unit.operational_code"')
})

test_that("la plantilla sube de revision al cambiar lo que imprime", {
  # Un recibo viejo apunta a `template_ref.revision`; dejar el mismo numero con
  # otro contenido haria que dos fichas distintas dijeran ser la misma.
  fuente <- paste(readLines("../../R/collection_materials.R", warn = FALSE), collapse = "\n")
  expect_match(fuente, "revision = 4L")
})
