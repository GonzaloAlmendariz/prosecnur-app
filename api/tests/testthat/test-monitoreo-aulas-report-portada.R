# La aduana entre el cuerpo del request y la portada del PDF.

test_that("un cuerpo sin portada no rompe: los seis campos existen vacios", {
  out <- prosecnurapp:::monitoreo_aulas_portada_desde_body(list())
  expect_setequal(names(out), c("titulo", "subtitulo", "cliente", "periodo", "corte", "nota"))
  expect_true(all(vapply(out, identical, logical(1), "")))
  # Un `portada` que no es lista tampoco: llega de fuera y puede ser cualquier cosa.
  expect_true(all(vapply(
    prosecnurapp:::monitoreo_aulas_portada_desde_body(list(portada = "texto suelto")),
    identical, logical(1), "")))
})

test_that("lo escrito llega limpio y recortado a su tope", {
  out <- prosecnurapp:::monitoreo_aulas_portada_desde_body(list(portada = list(
    titulo = "  Avance   del trabajo \n de campo ",
    cliente = "PUCP",
    nota = "\tuna nota\r\ncon saltos"
  )))
  expect_equal(out$titulo, "Avance del trabajo de campo")
  expect_equal(out$cliente, "PUCP")
  # Ni saltos ni tabuladores: una linea de metadatos se traza en una linea.
  expect_equal(out$nota, "una nota con saltos")
  expect_false(grepl("[\r\n\t]", out$nota))

  largo <- prosecnurapp:::monitoreo_aulas_portada_desde_body(list(portada = list(
    titulo = paste(rep("a", 400), collapse = "")
  )))
  expect_equal(nchar(largo$titulo), 140L)
})

test_that("el alias `cover` se acepta igual que `portada`", {
  out <- prosecnurapp:::monitoreo_aulas_portada_desde_body(list(cover = list(cliente = "ACNUR")))
  expect_equal(out$cliente, "ACNUR")
})

test_that("lo que la UI deja en blanco lo resuelve el defecto del motor", {
  # El encadenado completo: aduana + override opt-in. Un campo vacio en el
  # request NO puede borrar lo que el motor derivo de los datos.
  del_request <- prosecnurapp:::monitoreo_aulas_portada_desde_body(list(portada = list(cliente = "PUCP")))
  final <- pulso_pdf_portada_normalizar(
    defectos = list(titulo = "Avance del trabajo de campo",
                    periodo = "Del 07 al 09 de septiembre de 2026"),
    usuario = del_request
  )
  expect_equal(final$cliente, "PUCP")
  expect_equal(final$titulo, "Avance del trabajo de campo")
  expect_equal(final$periodo, "Del 07 al 09 de septiembre de 2026")
})

test_that("el job runner reenvia la portada al renderizador de aulas", {
  # **El eslabon que nadie mira.** La portada viaja request -> aduana -> args del
  # job -> runner -> renderizador. El runner es el unico paso donde un argumento
  # puede perderse en silencio: si no lo declarara, el PDF saldria con los
  # defectos del motor y nadie veria un error.
  visto <- NULL
  testthat::local_mocked_bindings(
    monitoreo_aulas_advance_report_pdf = function(model, output_file, ...) {
      visto <<- list(...)
      writeLines("x", output_file)
      invisible(output_file)
    },
    .package = "prosecnurapp"
  )
  modelo <- list(report_kind = "aulas_advance_pdf", family = "aulas_universitarias")
  ruta_modelo <- tempfile(fileext = ".rds"); saveRDS(modelo, ruta_modelo)
  destino <- tempfile(fileext = ".pdf")

  monitoreo_client_report_pdf_job_runner(
    model_path = ruta_modelo, include_targets = FALSE, result_path = destino,
    portada = list(cliente = "PUCP", titulo = "Avance"))

  expect_equal(visto$portada$cliente, "PUCP")
  expect_equal(visto$portada$titulo, "Avance")
  expect_false(isTRUE(visto$include_targets))
})

test_that("el runner sigue funcionando sin portada, que es el caso de las otras familias", {
  visto <- NULL
  testthat::local_mocked_bindings(
    monitoreo_aulas_advance_report_pdf = function(model, output_file, ...) {
      visto <<- list(...)
      writeLines("x", output_file)
      invisible(output_file)
    },
    .package = "prosecnurapp"
  )
  ruta_modelo <- tempfile(fileext = ".rds")
  saveRDS(list(report_kind = "aulas_advance_pdf"), ruta_modelo)
  destino <- tempfile(fileext = ".pdf")
  expect_no_error(monitoreo_client_report_pdf_job_runner(
    model_path = ruta_modelo, result_path = destino))
  expect_length(visto$portada, 0L)
})
