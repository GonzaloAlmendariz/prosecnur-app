test_that("base panel genera wide, auditoria y frecuencias con select_multiple", {
  inst <- list(
    survey = data.frame(
      type = c("text", "select_one yesno", "select_multiple medios", "select_multiple medios", "select_one nse"),
      name = c("numero_encuesta", "p21", "p_multi", "canales", "nse_inei"),
      label = c("Numero de encuesta", "Aprueba", "Medios usados", "Canales usados", "NSE atribuido"),
      list_name = c("", "yesno", "medios", "medios", "nse"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno", "medios", "medios", "nse", "nse", "nse"),
      name = c("1", "2", "1", "2", "A", "B", "SIN DATA"),
      label = c("Si", "No", "TV", "Radio", "A", "B", "SIN DATA"),
      stringsAsFactors = FALSE
    )
  )

  ola1 <- data.frame(
    numero_encuesta = c("1", "2", "2", "3"),
    fecha = c("01.05.26", "02.05.26", "02.05.26", "03.05.26"),
    p21 = c("1", "2", "1", "1"),
    p_multi.1 = c(1, 0, 1, 1),
    p_multi.2 = c(0, 1, 0, 1),
    canales = c("1", "2", "1 2", ""),
    nse_inei = c("A", "SIN DATA", "B", "A"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  ola2 <- data.frame(
    numero_encuesta = c("1", "3", "4"),
    fecha = c("10.06.26", "11.06.26", "12.06.26"),
    p21 = c("2", "1", "2"),
    p_multi.1 = c(0, 1, 1),
    p_multi.2 = c(1, 1, 0),
    canales = c("1 2", "2", "1"),
    nse_inei = c("A", "B", "SIN DATA"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  attr(ola1$p21, "label") <- "Aprueba"
  attr(ola2$p21, "label") <- "Aprueba"
  attr(ola1$p21, "labels") <- c(Si = "1", No = "2")
  attr(ola2$p21, "labels") <- c(Si = "1", No = "2")
  attr(ola1$p_multi.1, "label") <- "Medios usados = TV"
  attr(ola1$p_multi.2, "label") <- "Medios usados = Radio"
  attr(ola2$p_multi.1, "label") <- "Medios usados = TV"
  attr(ola2$p_multi.2, "label") <- "Medios usados = Radio"
  attr(ola1$canales, "label") <- "Canales usados"
  attr(ola2$canales, "label") <- "Canales usados"
  attr(ola1$canales, "labels") <- c(TV = "1", Radio = "2")
  attr(ola2$canales, "labels") <- c(TV = "1", Radio = "2")

  data_sources <- list(ola_1 = ola1, ola_2 = ola2)
  inst_sources <- list(ola_1 = inst, ola_2 = inst)

  info_cfg <- .panel_config_resolve(data_sources, list())
  expect_equal(info_cfg$key, "numero_encuesta")
  expect_equal(vapply(info_cfg$waves, `[[`, character(1), "suffix"), c("ola1", "ola2"))

  built <- .panel_wide_build(data_sources, inst_sources, list())

  expect_true(all(c("numero_encuesta", "p21_ola1", "p21_ola2", "p_multi.1_ola1", "p_multi.2_ola2") %in% names(built$base_wide)))
  expect_equal(built$summary$n_panel_keys, 4)
  expect_equal(built$summary$n_complete_keys, 2)
  expect_true(any(built$audit$tipo == "llave_duplicada"))
  expect_true(any(built$audit$tipo == "ola_faltante"))
  expect_true(any(built$frequencies$variable_original == "p_multi"))
  expect_true(any(grepl("SIN DATA", built$cobertura_nse$observacion, fixed = TRUE)))

  out <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out)
  expect_true(file.exists(out))
  expect_true(all(c("base_wide", "libro_codigos", "frecuencias", "auditoria_panel", "cobertura_nse", "configuracion", "Ficha tecnica") %in% openxlsx::getSheetNames(out)))

  out_ficha <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out_ficha, ficha_tecnica = list(
    cfg = list(ficha_tecnica = list(
      estudio = "Estudio panel desde Prosecnur",
      plan_limpieza = "Plan de limpieza configurado desde Prosecnur"
    ))
  ))
  ficha <- openxlsx::read.xlsx(out_ficha, sheet = "Ficha tecnica", startRow = 4)
  expect_true(any(grepl("Estudio panel desde Prosecnur", ficha$Detalle, fixed = TRUE)))
  expect_true(any(grepl("Plan de limpieza configurado desde Prosecnur", ficha$Detalle, fixed = TRUE)))

  out_wide <- tempfile(fileext = ".xlsx")
  .panel_export_wide_xlsx(built, out_wide, valores = "ambos", multi_select = "dummy_01")
  expect_equal(openxlsx::getSheetNames(out_wide), c("codigos", "etiquetas", "Ficha tecnica"))
  wide_head <- openxlsx::readWorkbook(out_wide, sheet = "codigos", colNames = FALSE, rows = 1)
  expect_true(any(unlist(wide_head, use.names = FALSE) == "p21_ola1"))

  out_csv <- tempfile(fileext = ".csv")
  .panel_export_wide_csv(built, out_csv, valores = "etiquetas", multi_select = "dummy_01")
  expect_true(file.exists(out_csv))
  expect_true(grepl("p21_ola1", readLines(out_csv, n = 1, warn = FALSE)))

  old_writer <- Sys.getenv("PROSECNUR_SAV_WRITER", unset = NA_character_)
  Sys.setenv(PROSECNUR_SAV_WRITER = "haven")
  on.exit({
    if (is.na(old_writer)) Sys.unsetenv("PROSECNUR_SAV_WRITER") else Sys.setenv(PROSECNUR_SAV_WRITER = old_writer)
  }, add = TRUE)
  out_sav <- tempfile(fileext = ".sav")
  .panel_export_wide_sav(built, out_sav)
  expect_true(file.exists(out_sav))
  sav_read <- haven::read_sav(out_sav)
  expect_true(all(c("numero_encuesta", "p21_ola1", "p21_ola2") %in% names(sav_read)))
  expect_false("canales_ola1" %in% names(sav_read))
  expect_true(all(c("canales_ola1___1", "canales_ola1___2") %in% names(sav_read)))
  expect_equal(attr(sav_read$canales_ola1___1, "label", exact = TRUE), "[Ola 1] Canales usados = TV")
  expect_equal(attr(sav_read$canales_ola1___1, "labels", exact = TRUE)[["Sí"]], 1)
})

test_that("ficha tecnica panel documenta procedimiento, n por ola y fechas", {
  inst <- list(
    survey = data.frame(
      type = c("text", "text"),
      name = c("numero_encuesta", "p1"),
      label = c("Numero de encuesta", "Pregunta sustantiva"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame()
  )
  data_sources <- list(
    ola_1 = data.frame(
      numero_encuesta = c("1", "2", "3"),
      fecha = c("01.05.26", "02.05.26", "03.05.26"),
      p1 = c("a", "b", "c"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    ola_2 = data.frame(
      numero_encuesta = c("1", "3"),
      fecha = c("10.06.26", "12.06.26"),
      p1 = c("d", "e"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  built <- .panel_wide_build(data_sources, list(ola_1 = inst, ola_2 = inst), list())
  cfg <- .ficha_tecnica_cfg_with_hojas_ruta(list(ficha_tecnica = list(
    aplicacion_de_encuestas = "El recojo se realizó en dos momentos de campo.",
    panel_context = .panel_ficha_context(built, data_sources)
  )))
  rows <- .ficha_tecnica_docx_rows(cfg = cfg)
  aplicacion <- rows$Detalle[rows$Campo == "Aplicación de encuestas"][[1]]
  expect_true(grepl("El recojo se realizó en dos momentos de campo.", aplicacion, fixed = TRUE))
  expect_true(grepl("panel de dos olas", aplicacion, fixed = TRUE))
  expect_true(grepl("La primera ola registró 3 encuestas", aplicacion, fixed = TRUE))
  expect_true(grepl("La segunda ola registró 2 encuestas", aplicacion, fixed = TRUE))
  expect_true(grepl("01 de mayo de 2026 al 03 de mayo de 2026", aplicacion, fixed = TRUE))
  expect_true(grepl("10 de junio de 2026 al 12 de junio de 2026", aplicacion, fixed = TRUE))
  expect_false(grepl("numero_encuesta", aplicacion, fixed = TRUE))
  expect_false(grepl("llave", aplicacion, fixed = TRUE))
  expect_false(grepl("n=", aplicacion, fixed = TRUE))
  expect_true("aplicacion_de_encuestas" %in% names((cfg$ficha_tecnica %||% list())$subtables))

  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  out_docx <- tempfile(fileext = ".docx")
  .analitica_write_ficha_tecnica_docx(
    path_docx = out_docx,
    cfg = cfg,
    data = built$base_wide,
    instrumento = built$inst_wide
  )
  txt <- officer::docx_summary(officer::read_docx(out_docx))$text
  expect_true(any(grepl("Estructura de aplicación por ola", txt, fixed = TRUE)))
  expect_true(any(grepl("panel de dos olas", txt, fixed = TRUE)))
  expect_true(any(grepl("Encuestas realizadas", txt, fixed = TRUE)))
  expect_true(any(grepl("Personas entrevistadas", txt, fixed = TRUE)))
  expect_true(any(grepl("01 de mayo de 2026 al 03 de mayo de 2026", txt, fixed = TRUE)))
  expect_true(any(grepl("10 de junio de 2026 al 12 de junio de 2026", txt, fixed = TRUE)))
  expect_false(any(grepl("numero_encuesta", txt, fixed = TRUE)))
  expect_false(any(grepl("p=", txt, fixed = TRUE)))
  expect_false(any(grepl("n registros", txt, fixed = TRUE)))
  expect_false(any(grepl("n llaves", txt, fixed = TRUE)))
  expect_false(any(grepl("configuracion analitica", txt, fixed = TRUE)))
  expect_false(any(grepl("configuración analítica", txt, fixed = TRUE)))
})

test_that("base panel respeta toggles de hojas auxiliares", {
  inst <- list(survey = data.frame(type = c("text", "text"), name = c("numero_encuesta", "p1"), label = c("Numero", "P1"), stringsAsFactors = FALSE))
  data_sources <- list(
    a = data.frame(numero_encuesta = c("1", "2"), p1 = c("x", "y"), stringsAsFactors = FALSE),
    b = data.frame(numero_encuesta = c("1", "2"), p1 = c("z", "w"), stringsAsFactors = FALSE)
  )
  built <- .panel_wide_build(
    data_sources,
    list(a = inst, b = inst),
    list(outputs = list(codebook = FALSE, frecuencias = FALSE, auditoria = FALSE, cobertura_nse = FALSE))
  )
  out <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out)
  expect_equal(openxlsx::getSheetNames(out), c("base_wide", "configuracion", "Ficha tecnica"))
})

test_that("ficha tecnica puede tomar marco muestral desde un .pulso de hojas de ruta", {
  skip_if_not_installed("zip")

  state <- list(
    hojas_ruta_config = list(
      n_objetivo = 600L,
      territorios = as.list(c("070101", "150101")),
      sampling_method = "pps",
      seed = 123L,
      measure_var = "viviendas",
      entrevistas_por_manzana = 6L,
      replacement_policy = "paired_by_titular_zone",
      sample_size = list(confidence_level = 0.95, expected_proportion = 0.5, response_rate = 0.9)
    ),
    hojas_ruta_workspace_outputs = list(
      sample_size_preview = list(margin_total_estimated = 0.04),
      sample = list(
        frame_meta = list(
          source = "INEI - Censos Nacionales 2017",
          year = 2017L,
          version = "inei2017-test",
          coverage = "Lima Metropolitana y Callao",
          granularity = "manzana_urbana",
          n_manzanas = 117409L,
          viviendas = 2626758L,
          poblacion = 9031584L
        ),
        method = "pps",
        seed = 123L,
        blocks = list(
          list(id_manzana = "070101001000010", ubigeo = "070101", zona = "00100", distrito = "CALLAO", viviendas = 100L, poblacion = 300L, entrevistas = 6L),
          list(id_manzana = "150101001000020", ubigeo = "150101", zona = "00100", distrito = "LIMA", viviendas = 120L, poblacion = 360L, entrevistas = 6L)
        ),
        replacement_blocks = list(
          list(id_manzana = "070101001000030", ubigeo = "070101", zona = "00100", distrito = "CALLAO", viviendas = 80L, poblacion = 240L, entrevistas = 6L),
          list(id_manzana = "150101001000040", ubigeo = "150101", zona = "00100", distrito = "LIMA", viviendas = 90L, poblacion = 270L, entrevistas = 6L)
        )
      )
    )
  )
  stage <- tempfile("pulso_hr_")
  dir.create(stage)
  saveRDS(state, file.path(stage, "state.rds"))
  writeLines('{"format_version":1,"project_name":"test"}', file.path(stage, "manifest.json"))
  pulso <- tempfile(fileext = ".pulso")
  old <- setwd(stage)
  on.exit(setwd(old), add = TRUE)
  zip::zipr(pulso, c("manifest.json", "state.rds"), root = ".", mode = "mirror")
  setwd(old)

  rows <- .ficha_tecnica_docx_rows(
    cfg = .ficha_tecnica_cfg_with_hojas_ruta(list(ficha_tecnica = list(
      hojas_ruta_pulso_path = pulso
    )))
  )
  expect_true(any(grepl("INEI - Censos Nacionales 2017", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("117,409 manzanas", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("2 manzanas titulares", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("probabilidad proporcional al tamaño", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("Muestra semi-probabilística polietápica", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("procedimiento aleatorio con probabilidad proporcional al tamaño", rows$Detalle, fixed = TRUE)))
  expect_false(any(grepl("computadora", rows$Detalle, fixed = TRUE)))
  expect_false(any(grepl("conveniencia", rows$Detalle, fixed = TRUE)))
  expect_false(any(grepl("Hojas de Ruta", rows$Detalle, fixed = TRUE)))

  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  out_docx <- tempfile(fileext = ".docx")
  .analitica_write_ficha_tecnica_docx(
    path_docx = out_docx,
    cfg = list(ficha_tecnica = list(
      layout = "pulso_oficial",
      hojas_ruta_pulso_path = pulso
    ))
  )
  txt <- officer::docx_summary(officer::read_docx(out_docx))$text
  expect_true(any(grepl("Precisión muestral estimada", txt, fixed = TRUE)))
  expect_true(any(grepl("Margen de error estimado", txt, fixed = TRUE)))
  expect_true(any(grepl("Etapas del diseño muestral", txt, fixed = TRUE)))
  expect_true(any(grepl("Manzanas urbanas", txt, fixed = TRUE)))
  expect_true(any(grepl("Selección aleatoria con probabilidad proporcional al tamaño", txt, fixed = TRUE)))
  expect_true(any(grepl("recorrido operativo controlado", txt, fixed = TRUE)))
  expect_true(any(grepl("Distribución agregada de la muestra por distrito", txt, fixed = TRUE)))
  expect_true(any(grepl("CALLAO", txt, fixed = TRUE)))
  expect_true(any(grepl("LIMA", txt, fixed = TRUE)))
  expect_true(any(grepl("Encuestas", txt, fixed = TRUE)))
  expect_false(any(grepl("computadora", txt, fixed = TRUE)))
  expect_false(any(grepl("conveniencia", txt, fixed = TRUE)))
  expect_false(any(grepl("Hojas de Ruta", txt, fixed = TRUE)))
})

test_that("ficha tecnica compone contexto desde calculo de muestra", {
  calc_context <- list(
    calc_muestra_estudio = list(
      titulo = "Diseño muestral universitario",
      macro_familia = "encuesta_estudiantes",
      modo_trabajo = "diseno_validado",
      componentes = list(
        list(
          actor = "Estudiantes",
          tecnica = "prob_estratificado",
          marco = list(marco_validado = 1200L),
          parametros = list(z = 1.96, p = 0.5, e = 0.04, deff = 1.2, oversample_pct = 0.1),
          resultado = list(
            tecnica = "prob_estratificado",
            n_objetivo = 360L,
            n_operativo = 396L,
            precision_alcanzada = 0.04,
            inferencia = list(nivel_respaldo = "representatividad_estadistica"),
            distribucion_estratos = list(
              list(estrato = "Facultad A", N = 700L, n = 210L, precision_e = 0.05),
              list(estrato = "Facultad B", N = 500L, n = 150L, precision_e = 0.06)
            )
          )
        )
      )
    )
  )

  cfg <- .ficha_tecnica_cfg_with_hojas_ruta(list(ficha_tecnica = list(
    metodologia_contexto = calc_context
  )))
  rows <- .ficha_tecnica_docx_rows(cfg = cfg)
  expect_true(any(grepl("diseño muestral", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("muestreo estratificado proporcional", rows$Detalle, fixed = TRUE)))
  expect_true(any(grepl("360 casos", rows$Detalle, fixed = TRUE)))
  expect_false(any(grepl("Cálculo de Muestra", rows$Detalle, fixed = TRUE)))

  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  out_docx <- tempfile(fileext = ".docx")
  .analitica_write_ficha_tecnica_docx(
    path_docx = out_docx,
    cfg = cfg
  )
  txt <- officer::docx_summary(officer::read_docx(out_docx))$text
  expect_true(any(grepl("Componentes del cálculo muestral", txt, fixed = TRUE)))
  expect_true(any(grepl("Muestra objetivo", txt, fixed = TRUE)))
  expect_true(any(grepl("Estudiantes", txt, fixed = TRUE)))
  expect_true(any(grepl("Distribución muestral por estrato - Estudiantes", txt, fixed = TRUE)))
  expect_true(any(grepl("Facultad A", txt, fixed = TRUE)))
  expect_false(any(grepl("Cálculo de Muestra", txt, fixed = TRUE)))
})

test_that("ficha tecnica Word se genera desde plantilla docx", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")
  skip_if_not_installed("zip")

  template <- tempfile(fileext = ".docx")
  doc <- officer::read_docx()
  doc <- officer::body_add_par(doc, "FICHA TÉCNICA", style = "Normal")
  rows <- data.frame(
    Campo = c("Estudio", "Plan de limpieza de datos y consistencia"),
    Detalle = c("[Nombre completo del estudio o servicio.]", "[Describir revisión de bases.]"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  doc <- flextable::body_add_flextable(doc, flextable::flextable(rows))
  print(doc, target = template)

  out <- tempfile(fileext = ".docx")
  .analitica_write_ficha_tecnica_docx(
    path_docx = out,
    cfg = list(ficha_tecnica = list(
      layout = "template",
      estudio = "Estudio panel desde plantilla Word",
      plan_limpieza = "Plan de limpieza configurado desde Prosecnur"
    )),
    template_path = template
  )
  expect_true(file.exists(out))
  txt <- officer::docx_summary(officer::read_docx(out))$text
  expect_true(any(grepl("Estudio panel desde plantilla Word", txt, fixed = TRUE)))
  expect_true(any(grepl("Plan de limpieza configurado desde Prosecnur", txt, fixed = TRUE)))
})

test_that("ficha tecnica Word usa formato Pulso oficial por defecto", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")

  out <- tempfile(fileext = ".docx")
  .analitica_write_ficha_tecnica_docx(
    path_docx = out,
    cfg = list(ficha_tecnica = list(
      estudio = "Estudio panel Polarizacion",
      aplicacion_de_encuestas = "Dos olas de campo consolidadas por numero de encuesta.",
      ponderacion = "No recalculada en este entregable.",
      supervision_de_mesa = "Revision de inconsistencias desde Prosecnur.",
      digitacion = "Digitalizacion desde cuestionario en papel.",
      entregables = "Base panel wide\nLibro de codigos\nFicha tecnica Word"
    ))
  )
  expect_true(file.exists(out))
  txt <- officer::docx_summary(officer::read_docx(out))$text
  expect_true(any(grepl("FICHA TÉCNICA", txt, fixed = TRUE)))
  expect_true(any(grepl("Aplicación de encuestas", txt, fixed = TRUE)))
  expect_true(any(grepl("No recalculada en este entregable.", txt, fixed = TRUE)))
  expect_true(any(grepl("Digitalizacion desde cuestionario en papel.", txt, fixed = TRUE)))
})
