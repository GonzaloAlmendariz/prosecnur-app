# Hallazgo 12 de la auditoría visual (4 nov 2026): el editor abría un borrador de 1 pregunta y no sabía
# que el estudio ya tenía su instrumento. Estos tests fijan cuál es y que se abre con su contenido.

escribir_xlsform <- function(path, n = 3L) {
  survey <- data.frame(type = rep("text", n), name = paste0("p", seq_len(n)), label = paste("Pregunta", seq_len(n)))
  choices <- data.frame(list_name = "si_no", name = c("1", "2"), label = c("Sí", "No"))
  openxlsx::write.xlsx(list(survey = survey, choices = choices), path)
  path
}

sesion_con_instrumento <- function(kind = "instrumento_adaptado") {
  path <- escribir_xlsform(tempfile(fileext = ".xlsx"))
  list(
    estudio = list(bases = list(`Base 1` = list(xlsform_file_id = "f1"))),
    files = list(f1 = list(file_id = "f1", kind = kind, original_name = "instrumento.xlsx", path = path)),
    rp_inst_sources = list(`Base 1` = list(
      survey = data.frame(type = c("begin_group", "text", "text", "text", "end_group"), name = c("s", "p1", "p2", "p3", "")),
      choices = data.frame(list_name = "si_no", name = "1")
    ))
  )
}

test_that("el instrumento del estudio es el XLSForm de la base, con su conteo de preguntas", {
  inst <- .xlsform_instrumento_del_estudio(sesion_con_instrumento())
  expect_equal(inst$file_id, "f1")
  expect_equal(inst$base, "Base 1")
  expect_equal(inst$nombre, "instrumento.xlsx")
  expect_equal(inst$n_questions, 3L)
})

test_that("sin base, o con un archivo que no es un XLSForm, no hay instrumento del estudio", {
  expect_null(.xlsform_instrumento_del_estudio(list()))
  expect_null(.xlsform_instrumento_del_estudio(sesion_con_instrumento(kind = "data")))
})

test_that("el workbook del instrumento trae sus preguntas y nombra su origen", {
  out <- .xlsform_instrumento_estudio_workbook(sesion_con_instrumento())
  expect_equal(out$summary$survey_rows, 3L)
  expect_equal(out$source$original_name, "instrumento.xlsx")
})

test_that("sin instrumento, abrirlo es un error de la API, no un 500", {
  expect_error(.xlsform_instrumento_estudio_workbook(list()), class = "api_error")
})
