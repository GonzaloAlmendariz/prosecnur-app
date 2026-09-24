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

# E6 del loop (ADR 0090): el reporte defiende el n con la memoria sustituida y
# dice cómo se eligieron las unidades. Antes sólo el XLSX del sorteo lo decía.
test_that("las plantillas publican la memoria de cálculo y la validada, el sorteo", {
  for (nombre in c("diseno_validado.qmd", "propuesta_preliminar.qmd")) {
    ruta <- .cm_locate_template(nombre)
    skip_if(!nzchar(ruta) || !file.exists(ruta), paste("sin plantilla", nombre))
    qmd <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
    expect_true(grepl("## Memoria de cálculo", qmd, fixed = TRUE), info = nombre)
    expect_true(grepl("bundle$memorias", qmd, fixed = TRUE), info = nombre)
  }
  # El sorteo es un hecho, no una propuesta: va en las DOS plantillas. En la
  # preliminar faltaba y un usuario que ya había sorteado no lo veía en su
  # reporte (recorrido de usuario nuevo, 2026-09-24).
  for (nombre in c("diseno_validado.qmd", "propuesta_preliminar.qmd")) {
    qmd <- paste(readLines(.cm_locate_template(nombre), warn = FALSE), collapse = "\n")
    expect_true(grepl("## Selección de las unidades", qmd, fixed = TRUE), info = nombre)
    expect_true(grepl("bundle$general", qmd, fixed = TRUE), info = nombre)
  }
})

test_that("el bundle lleva la memoria sólo de los componentes de elementos con resultado", {
  mk <- function(tecnica, id) {
    c <- calc_muestra_normalize_componente(list(id = id, actor = id, actor_id = id, tecnica = tecnica,
      marco = list(universo_bruto = 5000L, marco_validado = 5000L, marco_contactable = 5000L, estado = "validado"),
      parametros = list(e = .04, tasa_respuesta = .75, oversample_pct = 0)))
    c$resultado <- calc_muestra_calcular_componente(c)
    c
  }
  est <- list(componentes = list(mk("prob_aleatorio_simple", "mas"), mk("intencion_censal", "censo"),
                                 calc_muestra_normalize_componente(list(id = "sin", actor = "sin", tecnica = "prob_aleatorio_simple"))))
  m <- .cm_reporte_memorias(est)
  expect_identical(names(m), "mas")
  expect_identical(m$mas$resultado[[1]], "600.25")
})

test_that("el reporte renderizado lleva la memoria y el sorteo (Quarto real)", {
  skip_if_not(nzchar(Sys.which("quarto")) && requireNamespace("quarto", quietly = TRUE), "sin quarto")
  skip_on_cran()
  set.seed(4)
  marco <- data.frame(codigo = sprintf("H%04d", 1:600), zona = sample(c("Norte", "Sur"), 600, TRUE))
  comp <- calc_muestra_normalize_componente(list(id = "c1", actor = "Hogares", actor_id = "h", tecnica = "prob_estratificado",
    parametros = list(e = .06, tasa_respuesta = .8, oversample_pct = 0, deff = 1, n_minimo_estrato = 0L)))
  est <- calc_muestra_normalize_estudio(list(componentes = list(comp), modo_trabajo = "diseno_validado"))
  dec <- calc_muestra_general_declarar_marco(est, NULL, "c1", marco, "f1", columnas = list(id = "codigo", estrato = "zona"))
  dec$estudio$componentes[[1]]$resultado <- calc_muestra_calcular_componente(dec$componente)
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, "c1", marco, semilla = 5L)
  out <- tempfile(fileext = ".html")
  withr::defer(unlink(out))
  dec$estudio$modo_trabajo <- "diseno_validado"
  reporte_calc_muestra(dec$estudio, out, formato = "html", quiet = TRUE,
                       general = calc_muestra_general_resumen(sel$estado))
  texto <- paste(readLines(out, warn = FALSE), collapse = "\n")
  expect_true(grepl("Memoria de cálculo", texto, fixed = TRUE))
  expect_true(grepl(sel$corrida$corrida$run_id, texto, fixed = TRUE))
})
