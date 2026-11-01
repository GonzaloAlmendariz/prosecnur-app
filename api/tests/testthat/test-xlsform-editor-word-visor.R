# L36 · DOC.2 — páginas reales del Word del cuestionario y mapa pregunta -> página.

test_that("el mapa ubica cada número del modelo en su primera página y no confunde códigos (D-L36-10)", {
  textos <- c(
    "N.º de encuesta\nDocentes\n1. ¿Desea continuar?\nSí 1 No 2\n2. ¿Cuántos años tiene?\n3. Grado\n1 Técnico\n2 Bachiller",
    "8.1 Servicio de Salud 1 2 3 4 99\n8.2 Bienestar 1 2 3 4 99\n9. Pregunta final"
  )
  mapa <- .cuestionario_visor_mapa(textos, c("1", "2", "3", "8.1", "8.2", "9", "10"))
  paginas <- setNames(vapply(mapa, function(m) as.integer(m$pagina), integer(1)),
                      vapply(mapa, function(m) m$numero, character(1)))
  expect_identical(unname(paginas[c("1", "2", "3")]), c(1L, 1L, 1L))
  expect_identical(unname(paginas[c("8.1", "8.2", "9")]), c(2L, 2L, 2L))
  # «1 Técnico» (código de opción) no es la pregunta 1 ni la 10; la 10 no existe.
  expect_true(is.na(paginas[["10"]]))
})

test_that("los números del modelo salen de preguntas e ítems de matriz, en orden", {
  model <- list(blocks = list(
    list(kind = "cover"),
    list(kind = "question", number = "1"),
    list(kind = "matrix", items = list(list(number = "2.1"), list(number = "2.2"))),
    list(kind = "question", number = "")
  ))
  expect_identical(.cuestionario_numeros_del_modelo(model), c("1", "2.1", "2.2"))
})

test_that("el worker dibuja el Word, lo pasa a páginas y ubica las preguntas", {
  skip_if_not_installed("pdftools")
  skip_if(!nzchar(Sys.which("soffice")) && !file.exists("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
          "sin LibreOffice")
  f <- test_path("..", "..", "inst", "samples", "acreditacion", "docentes_inst.xlsx")
  skip_if_not(file.exists(f))
  entrada <- tempfile(fileext = ".rds")
  saveRDS(list(
    survey = as.data.frame(readxl::read_excel(f, sheet = "survey")),
    choices = as.data.frame(readxl::read_excel(f, sheet = "choices")),
    settings = data.frame(form_title = "Docentes"),
    paper = NULL, options = list()
  ), entrada)
  salida <- tempfile()
  r <- xlsform_editor_word_visor_job_runner(entrada, "docx", "E_WORD_VISOR_FAILED", "falló", salida)
  expect_true(isTRUE(r$ok), info = paste(r$error$message %||% ""))
  expect_gte(r$n, 2L)
  expect_true(all(file.exists(r$archivos)))
  ubicadas <- Filter(function(m) !is.na(m$pagina), r$mapa)
  expect_gt(length(ubicadas), length(r$mapa) * 0.8)
  expect_identical(as.integer(r$mapa[[1]]$pagina), 1L)
})
