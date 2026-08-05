source("setup-load-all.R")

# B55: reporte_word_plan crea un PNG temporal por grafico (tempfile) que
# officer recien copia dentro del docx al hacer print(doc). Los archivos
# deben vivir hasta ese print y limpiarse despues — antes quedaban huerfanos
# en tempdir() por cada export Word.

.word_png_inst <- function() {
  list(
    survey = data.frame(
      name = "conoce",
      type = "select_one sino",
      list_name = "sino",
      label = "¿Conoce el servicio?",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "sino", name = c("Si", "No"), label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

test_that("los PNG temporales del render Word se limpian tras escribir el docx", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("cowplot")
  skip_if_not_installed("ggplot2")

  data <- list(
    docentes = data.frame(
      conoce = rep(c("Si", "No"), times = c(40, 12)),
      stringsAsFactors = FALSE
    )
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_apiladas(var = "docentes$conoce")
    )
  )

  pngs_antes <- list.files(tempdir(), pattern = "\\.png$", full.names = TRUE)

  path_docx <- tempfile(fileext = ".docx")
  on.exit(unlink(path_docx), add = TRUE)
  expect_no_error(reporte_word_plan(
    data = data,
    instrumento = list(docentes = .word_png_inst()),
    path_docx = path_docx,
    presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    plan = plan,
    mensajes_progreso = FALSE
  ))
  expect_true(file.exists(path_docx))

  # La imagen SI viajo dentro del docx...
  media <- grep("^word/media/", utils::unzip(path_docx, list = TRUE)$Name, value = TRUE)
  expect_true(length(media) >= 1L)

  # ...y ningun PNG intermedio quedo huerfano en tempdir().
  pngs_despues <- list.files(tempdir(), pattern = "\\.png$", full.names = TRUE)
  expect_identical(setdiff(pngs_despues, pngs_antes), character(0))
})
