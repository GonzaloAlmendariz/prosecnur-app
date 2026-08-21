# El reporte del estudio lleva su sustento metodologico.
#
# Encontrado el 2026-08-21 respondiendo una consulta externa de Gonzalo sobre
# como se eligen las aulas: el motor tiene las fuentes con su referencia
# oficial y academica (`.cm_aulas_methodological_sources`), pero se exportaban
# SOLO en una hoja del anexo XLSX. El documento que respalda el levantamiento
# —el que se ensena cuando preguntan— no las llevaba, asi que hubo que armar
# el sustento por fuera de la app.
#
# La tabla no depende de la sesion, asi que el reporte siempre puede
# publicarla; lo que faltaba era que viajara en el bundle.

test_that("el bundle del reporte lleva las fuentes metodologicas", {
  fuentes <- .cm_aulas_methodological_sources()
  expect_s3_class(fuentes, "data.frame")
  expect_gt(nrow(fuentes), 0L)
  # Las tres columnas que el reporte publica.
  for (col in c("decision_metodologica", "regla_app", "official_reference", "academic_reference")) {
    expect_true(col %in% names(fuentes), info = paste("falta la columna", col))
  }
  # Y las referencias que sustentan el nucleo del diseno.
  todo <- paste(unlist(fuentes), collapse = " ")
  expect_true(grepl("PISA", todo, fixed = TRUE))
  expect_true(grepl("Deville", todo, fixed = TRUE))
  expect_true(grepl("AAPOR", todo, fixed = TRUE))
})

test_that("las dos plantillas publican la seccion de sustento", {
  # Los estudios en `estimacion_preliminar` usan la otra plantilla, y ese es el
  # modo en que estaban los proyectos reales: publicarlo solo en la validada
  # habria dejado el reporte que de verdad se genera sin sustento.
  for (nombre in c("diseno_validado.qmd", "propuesta_preliminar.qmd")) {
    ruta <- .cm_locate_template(nombre)
    skip_if(!nzchar(ruta) || !file.exists(ruta), paste("sin plantilla", nombre))
    qmd <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
    expect_true(grepl("## Sustento metodológico", qmd, fixed = TRUE),
                info = paste(nombre, "no publica el sustento"))
    expect_true(grepl("bundle$metodologia", qmd, fixed = TRUE),
                info = paste(nombre, "no lee las fuentes del bundle"))
  }
})
