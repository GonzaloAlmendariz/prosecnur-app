source("setup-load-all.R")

# Fixture deliberado (no artefacto de QA): 2 criterios × 2 subcriterios × 3
# audiencias, con corridas de acuerdo y de satisfacción y celdas de
# criterio/subcriterio combinadas (NA hacia abajo) para ejercitar el forward-fill.
fixture_path <- function() {
  test_path("../../inst/samples/acreditacion/matriz_pulso_iac_cinda.xlsx")
}

test_that("matriz_pulso_detect reconoce la matriz y sus audiencias", {
  path <- fixture_path()
  skip_if_not(file.exists(path))

  det <- matriz_pulso_detect(path)
  expect_true(isTRUE(det$is_matriz))
  expect_equal(det$sheet, "Matriz Pulso")
  expect_equal(det$audiences, c("Docentes", "Estudiantes", "Administrativos"))
})

test_that("matriz_pulso_detect rechaza un .xlsx que no es matriz", {
  # Reusamos un XLSForm normal del repo — tiene hoja survey, no Matriz Pulso.
  path <- test_path("../../inst/samples/ops_salud/instrumento.xlsx")
  skip_if_not(file.exists(path))
  det <- matriz_pulso_detect(path)
  expect_false(isTRUE(det$is_matriz))
})

test_that("matriz_pulso_to_workbook arma survey con grupos, escalas y prefijos", {
  path <- fixture_path()
  skip_if_not(file.exists(path))

  wb <- matriz_pulso_to_workbook(path, "Docentes")
  survey <- wb$survey

  # Estructura de grupos: begin_group/end_group balanceados, uno por criterio.
  n_begin <- sum(survey$type == "begin_group")
  n_end <- sum(survey$type == "end_group")
  expect_equal(n_begin, n_end)
  expect_equal(n_begin, 2L)
  expect_equal(wb$summary$n_secciones, 2L)

  # Las 11 afirmaciones de Docentes se convierten en select_one.
  questions <- survey[grepl("^select_one ", survey$type), ]
  expect_equal(nrow(questions), 11L)
  expect_equal(wb$summary$n_questions, 11L)

  # Escala inferida: la corrida de servicios/formación (satisfacción) usa
  # esc_satisf; el resto esc_acuerdo. En el fixture: 5 satisf, 6 acuerdo.
  expect_equal(wb$summary$n_satisf, 5L)
  expect_equal(wb$summary$n_acuerdo, 6L)
  expect_true(all(grepl("esc_acuerdo|esc_satisf", questions$type)))

  # Prefijo de name compartido por corrida: los primeros 3 (misión, acuerdo)
  # comparten g1_*, los siguientes 3 (servicios, satisf) comparten g2_*.
  prefijo <- function(nm) sub("_.*$", "", nm)
  expect_equal(unique(prefijo(questions$name[1:3])), "g1")
  expect_equal(unique(prefijo(questions$name[4:6])), "g2")
  expect_true(all(grepl("^select_one esc_satisf$", questions$type[4:6])))
  expect_true(all(grepl("^select_one esc_acuerdo$", questions$type[1:3])))

  # El correlativo qn es global y secuencial.
  # 4 corridas (g1..g4); el correlativo qn es global (1..11).
  expect_equal(questions$name[1], "g1_1")
  expect_equal(questions$name[11], "g4_11")
  expect_equal(wb$summary$n_matrices_estimadas, 4L)

  # choices: ambas escalas con SIN INF = 9.
  expect_true(all(c("esc_acuerdo", "esc_satisf") %in% wb$choices$list_name))
  sin_inf <- wb$choices[wb$choices$name == "9", ]
  expect_true(all(sin_inf$label == "SIN INF"))

  # settings con el título por audiencia.
  expect_equal(wb$settings$form_title, "Cuestionario Docentes — Acreditación IAC-CINDA")
  expect_equal(wb$settings$default_language, "es")

  # warnings informa la heurística de escala.
  expect_true(any(grepl("heur", wb$warnings, ignore.case = TRUE)))
})

test_that("matriz_pulso_to_workbook filtra por audiencia (Administrativos)", {
  path <- fixture_path()
  skip_if_not(file.exists(path))

  wb <- matriz_pulso_to_workbook(path, "Administrativos")
  questions <- wb$survey[grepl("^select_one ", wb$survey$type), ]
  # Administrativos solo tiene 4 afirmaciones con texto en el fixture.
  expect_equal(nrow(questions), 4L)
  expect_equal(wb$summary$audience, "Administrativos")
})

test_that("audiencia inexistente aborta con stop_api E_MATRIZ_AUDIENCE", {
  path <- fixture_path()
  skip_if_not(file.exists(path))

  err <- tryCatch(
    matriz_pulso_to_workbook(path, "Egresados"),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_MATRIZ_AUDIENCE")
  expect_equal(err$status, 400)
})

test_that("el workbook de la matriz se renderiza a PDF con matrices y sin glifos rotos", {
  skip_if_not(file.exists(fixture_path()))
  # Locale UTF-8 para que las tildes no rompan el device PDF.
  old <- Sys.getlocale("LC_CTYPE")
  ok <- suppressWarnings(tryCatch(
    Sys.setlocale("LC_CTYPE", "en_US.UTF-8"), warning = function(w) "", error = function(e) ""))
  on.exit(suppressWarnings(Sys.setlocale("LC_CTYPE", old)), add = TRUE)

  wb <- matriz_pulso_to_workbook(fixture_path(), "Docentes")
  tmp <- tempfile(fileext = ".pdf")

  glyph_warns <- character(0)
  result <- withCallingHandlers(
    reporte_formulario_pdf(
      survey = wb$survey,
      choices = wb$choices,
      settings = wb$settings,
      output_file = tmp
    ),
    warning = function(w) {
      msg <- conditionMessage(w)
      if (grepl("glyph|font|conversion|Unicode|no se pudo", msg, ignore.case = TRUE)) {
        glyph_warns <<- c(glyph_warns, msg)
      }
      invokeRestart("muffleWarning")
    }
  )

  expect_true(file.exists(tmp))
  expect_gt(file.info(tmp)$size, 1000)
  expect_gte(qpdf::pdf_length(tmp), 1)
  # Con corridas de ≥3 afirmaciones el motor las colapsa en matriz.
  expect_gt(result$summary$n_matrices, 0L)
  expect_length(glyph_warns, 0L)
})

test_that(".matriz_pulso_escala_row honra Tipo/Respuesta con fallback por texto", {
  tp <- c("Dicotomica", "Escala", "Escala", "Escala", "")
  rp <- c("Sí/No", "Totamente en desacuerdo-Totalmente de acuerdo",
          "Muy insatisfecho-Muy satisfecho", "", "")
  af <- c("Conoce X", "Afirmacion Y", "Pregunta Z", "Otra afirmacion",
          "Esta muy satisfecho con W")
  esc <- .matriz_pulso_escala_row(tp, rp, af)
  expect_equal(esc, c("esc_sino", "esc_acuerdo", "esc_satisf", "esc_acuerdo", "esc_satisf"))
})

test_that(".matriz_pulso_choices devuelve solo las listas usadas (incl. esc_sino)", {
  ch <- .matriz_pulso_choices(used = c("esc_sino", "esc_acuerdo"))
  expect_setequal(unique(ch$list_name), c("esc_acuerdo", "esc_sino"))
  sino <- ch[ch$list_name == "esc_sino", ]
  expect_equal(sino$name, c("1", "2"))
  expect_equal(sino$label, c("Sí", "No"))
})
