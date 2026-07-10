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
  expect_equal(vapply(info_cfg$waves, `[[`, character(1), "suffix"), c("med1", "med2"))

  built <- .panel_wide_build(data_sources, inst_sources, list())

  expect_true(all(c("numero_encuesta", "p21_med1", "p21_med2", "p_multi.1_med1", "p_multi.2_med2") %in% names(built$base_wide)))
  expect_equal(built$summary$n_panel_keys, 4)
  expect_equal(built$summary$n_complete_keys, 2)
  expect_true(any(built$audit$tipo == "llave_duplicada"))
  expect_true(any(built$audit$tipo == "medicion_faltante"))
  expect_true(any(built$frequencies$variable_original == "p_multi"))
  expect_true(any(grepl("SIN DATA", built$cobertura_nse$observacion, fixed = TRUE)))

  out <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out)
  expect_true(file.exists(out))
  expect_true(all(c("base_wide", "libro_codigos", "libro_codigos_detalle", "frecuencias", "frecuencias_detalle", "cruces", "auditoria_panel", "cobertura_nse", "configuracion") %in% openxlsx::getSheetNames(out)))
  expect_false("Ficha tecnica" %in% openxlsx::getSheetNames(out))
  codebook_sheet <- openxlsx::read.xlsx(out, sheet = "libro_codigos")
  freq_sheet <- openxlsx::read.xlsx(out, sheet = "frecuencias")
  cruces_sheet <- openxlsx::read.xlsx(out, sheet = "cruces")
  audit_sheet <- openxlsx::read.xlsx(out, sheet = "auditoria_panel")
  expect_true(all(c("Variable.base", "Variable.Primera.medición", "Variable.Segunda.medición") %in% names(codebook_sheet)))
  expect_true(all(c("Variable.base", "n.Primera.medición", "%.Segunda.medición") %in% names(freq_sheet)))
  expect_true(all(c("Variable.base", "Primera.categoría", "Segunda.categoría", "n") %in% names(cruces_sheet)))
  expect_false("ola" %in% names(codebook_sheet))
  expect_true(any(audit_sheet$tipo == "medicion_faltante"))

  out_ficha <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out_ficha, ficha_tecnica = list(
    cfg = list(ficha_tecnica = list(
      adjuntar_a_xlsx = TRUE,
      estudio = "Estudio panel desde Prosecnur",
      plan_limpieza = "Plan de limpieza configurado desde Prosecnur"
    ))
  ))
  ficha <- openxlsx::read.xlsx(out_ficha, sheet = "Ficha tecnica", startRow = 4)
  expect_true(any(grepl("Estudio panel desde Prosecnur", ficha$Detalle, fixed = TRUE)))
  expect_true(any(grepl("Plan de limpieza configurado desde Prosecnur", ficha$Detalle, fixed = TRUE)))

  out_wide <- tempfile(fileext = ".xlsx")
  .panel_export_wide_xlsx(built, out_wide, valores = "ambos", multi_select = "dummy_01")
  expect_equal(openxlsx::getSheetNames(out_wide), c("codigos", "etiquetas"))
  wide_head <- openxlsx::readWorkbook(out_wide, sheet = "codigos", colNames = FALSE, rows = 1)
  expect_true(any(unlist(wide_head, use.names = FALSE) == "p21_med1"))

  out_csv <- tempfile(fileext = ".csv")
  .panel_export_wide_csv(built, out_csv, valores = "etiquetas", multi_select = "dummy_01")
  expect_true(file.exists(out_csv))
  expect_true(grepl("p21_med1", readLines(out_csv, n = 1, warn = FALSE)))

  old_writer <- Sys.getenv("PROSECNUR_SAV_WRITER", unset = NA_character_)
  Sys.setenv(PROSECNUR_SAV_WRITER = "haven")
  on.exit({
    if (is.na(old_writer)) Sys.unsetenv("PROSECNUR_SAV_WRITER") else Sys.setenv(PROSECNUR_SAV_WRITER = old_writer)
  }, add = TRUE)
  out_sav <- tempfile(fileext = ".sav")
  .panel_export_wide_sav(built, out_sav)
  expect_true(file.exists(out_sav))
  sav_read <- haven::read_sav(out_sav)
  expect_true(all(c("numero_encuesta", "p21_med1", "p21_med2") %in% names(sav_read)))
  expect_false("canales_med1" %in% names(sav_read))
  expect_true(all(c("canales_med1___1", "canales_med1___2") %in% names(sav_read)))
  expect_equal(attr(sav_read$canales_med1___1, "label", exact = TRUE), "Canales usados = TV (Primera medición)")
  expect_equal(attr(sav_read$canales_med1___1, "labels", exact = TRUE)[["Sí"]], 1)
})

test_that("el orden del panel sigue el XLSForm, no el alfabetico de stems", {
  # Dos variables no numeradas ni listadas: 'zeta_early' se pregunta primero y
  # 'alpha_late' al final. El heuristico previo (.panel_order_stems) las ordenaba
  # alfabeticamente (alpha antes que zeta), enterrando la preguntada temprano. El
  # fix debe respetar la posicion del survey: zeta_early debe salir ANTES.
  inst <- list(
    survey = data.frame(
      type = c("text", "select_one yn", "select_one yn"),
      name = c("numero_encuesta", "zeta_early", "alpha_late"),
      label = c("Numero de encuesta", "Preguntada primero", "Preguntada al final"),
      list_name = c("", "yn", "yn"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("yn", "yn"), name = c("1", "2"), label = c("Si", "No"),
      stringsAsFactors = FALSE
    )
  )
  mk <- function() {
    df <- data.frame(
      numero_encuesta = c("1", "2"),
      zeta_early = c("1", "2"),
      alpha_late = c("2", "1"),
      stringsAsFactors = FALSE
    )
    attr(df$zeta_early, "labels") <- c(Si = "1", No = "2")
    attr(df$alpha_late, "labels") <- c(Si = "1", No = "2")
    df
  }
  built <- .panel_wide_build(list(a = mk(), b = mk()), list(a = inst, b = inst), list())
  cols <- names(built$base_wide)

  idx_zeta <- which(cols == "zeta_early_med1")
  idx_alpha <- which(cols == "alpha_late_med1")
  expect_true(length(idx_zeta) == 1L && length(idx_alpha) == 1L)
  expect_lt(idx_zeta, idx_alpha)
  # Las mediciones del mismo stem quedan adyacentes (no se rompe el emparejamiento).
  expect_equal(which(cols == "zeta_early_med2"), idx_zeta + 1L)
  # No se pierden ni duplican columnas al reordenar.
  expect_false(any(duplicated(cols)))
  expect_setequal(cols, names(built$base_wide))

  # El codebook (que escribe en el orden de base_wide) tambien respeta el orden.
  cb_cols <- names(built$base_wide)
  expect_lt(match("zeta_early_med1", cb_cols), match("alpha_late_med1", cb_cols))
})

test_that("el libro de codigos XLSX no embebe la ficha tecnica por default", {
  inst <- list(
    survey = data.frame(
      type = c("text", "select_one yn"),
      name = c("numero_encuesta", "p1"),
      label = c("Numero de encuesta", "Pregunta"),
      list_name = c("", "yn"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("yn", "yn"), name = c("1", "2"), label = c("Si", "No"),
      stringsAsFactors = FALSE
    )
  )
  mk <- function() {
    df <- data.frame(numero_encuesta = c("1", "2"), p1 = c("1", "2"), stringsAsFactors = FALSE)
    attr(df$p1, "labels") <- c(Si = "1", No = "2")
    df
  }
  built <- .panel_wide_build(list(a = mk(), b = mk()), list(a = inst, b = inst), list())

  # Config con la ficha marcada como embebible: el codebook debe ignorarla y
  # quedar con una sola hoja (la ficha es su propio entregable aparte).
  out <- tempfile(fileext = ".xlsx")
  .panel_export_codebook_xlsx(built, out, ficha_tecnica = list(
    cfg = list(ficha_tecnica = list(adjuntar_a_xlsx = TRUE, estudio = "Estudio X"))
  ))
  expect_true(file.exists(out))
  expect_identical(openxlsx::getSheetNames(out), "Codebook")
})

test_that("paquete panel genera cruces configurados por sexo, NSE y distrito", {
  inst <- list(
    survey = data.frame(
      type = c("text", "select_one sexo", "select_one nse", "select_one distrito", "select_one yesno"),
      name = c("numero_encuesta", "sexo_obs", "nse_inei", "distrito", "p1"),
      label = c("Numero de encuesta", "Sexo observado", "NSE atribuido por INEI", "Distrito", "Pregunta sustantiva"),
      list_name = c("", "sexo", "nse", "distrito", "yesno"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("sexo", "sexo", "nse", "nse", "nse", "distrito", "distrito", "yesno", "yesno"),
      name = c("1", "2", "A", "B", "SIN DATA", "150101", "070101", "1", "2"),
      label = c("Hombre", "Mujer", "Alto", "Medio", "SIN DATA", "Lima", "Callao", "Si", "No"),
      stringsAsFactors = FALSE
    )
  )
  med1 <- data.frame(
    numero_encuesta = c("1", "2", "3"),
    sexo_obs = c("1", "2", "2"),
    nse_inei = c("A", "B", "SIN DATA"),
    distrito = c("150101", "070101", "150101"),
    p1 = c("1", "1", "2"),
    stringsAsFactors = FALSE
  )
  med2 <- data.frame(
    numero_encuesta = c("1", "2", "3"),
    sexo_obs = c("1", "2", "2"),
    nse_inei = c("A", "B", "B"),
    distrito = c("150101", "070101", "150101"),
    p1 = c("2", "1", "2"),
    stringsAsFactors = FALSE
  )
  labels <- list(
    sexo_obs = c(Hombre = "1", Mujer = "2"),
    nse_inei = c(Alto = "A", Medio = "B", `SIN DATA` = "SIN DATA"),
    distrito = c(Lima = "150101", Callao = "070101"),
    p1 = c(Si = "1", No = "2")
  )
  for (v in names(labels)) {
    attr(med1[[v]], "labels") <- labels[[v]]
    attr(med2[[v]], "labels") <- labels[[v]]
  }

  built <- .panel_wide_build(
    list(primera = med1, segunda = med2),
    list(primera = inst, segunda = inst),
    list(
      outputs = list(cruces = TRUE),
      cross_vars = list(
        sexo = list(name = "sexo_obs_med1", label = "Sexo observado"),
        nse = list(name = "nse_inei_med1", label = "NSE atribuido por INEI", exclude_levels = c("SIN DATA")),
        distrito = list(name = "distrito_med1", label = "Distrito")
      )
    )
  )
  out <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out)
  sheets <- openxlsx::getSheetNames(out)
  expect_true(all(c("cruces", "cruces_sexo", "cruces_nse", "cruces_distrito", "cruces_longitudinales") %in% sheets))
  cruces <- openxlsx::read.xlsx(out, sheet = "cruces")
  cruces_sexo <- openxlsx::read.xlsx(out, sheet = "cruces_sexo")
  cruces_nse <- openxlsx::read.xlsx(out, sheet = "cruces_nse")
  cruces_distrito <- openxlsx::read.xlsx(out, sheet = "cruces_distrito")
  expect_true(all(c("cruce", "Variable.de.cruce", "Categoría.de.cruce", "Opción", "n") %in% names(cruces)))
  expect_true(any(cruces$cruce == "sexo"))
  expect_true(any(cruces$cruce == "nse"))
  expect_true(any(cruces$cruce == "distrito"))
  expect_true(any(cruces_sexo$Variable.de.cruce == "Sexo observado"))
  expect_true(any(cruces_nse$Variable.de.cruce == "NSE atribuido por INEI"))
  expect_false(any(cruces$Categoría.de.cruce == "SIN DATA"))
  expect_false(any(cruces_nse$Categoría.de.cruce == "SIN DATA"))
  expect_true(any(cruces_distrito$Variable.de.cruce == "Distrito"))
  expect_true(any(cruces_distrito$Categoría.de.cruce == "Lima"))

  out_codebook <- tempfile(fileext = ".xlsx")
  .panel_export_write(built, out_codebook, options = list(formato = "libro_codigos"), ficha_tecnica = FALSE)
  expect_true(file.exists(out_codebook))
  expect_true("Codebook" %in% openxlsx::getSheetNames(out_codebook))
  codebook_export <- openxlsx::read.xlsx(out_codebook, sheet = "Codebook", colNames = FALSE)
  expect_true(any(codebook_export$X1 == "p1_med1", na.rm = TRUE))
  expect_true(any(as.matrix(codebook_export) == "p1_med2", na.rm = TRUE))
  expect_true(any(codebook_export$X1 == "Atributos estándar", na.rm = TRUE))
  expect_true(any(codebook_export$X3 == "Pregunta sustantiva (Primera medición)", na.rm = TRUE))
  expect_true(any(as.matrix(codebook_export) == "Pregunta sustantiva (Segunda medición)", na.rm = TRUE))

  out_freq <- tempfile(fileext = ".xlsx")
  .panel_export_write(built, out_freq, options = list(formato = "frecuencias"), ficha_tecnica = FALSE)
  expect_true(file.exists(out_freq))
  expect_true("Frecuencias" %in% openxlsx::getSheetNames(out_freq))

  out_cross <- tempfile(fileext = ".xlsx")
  .panel_export_write(built, out_cross, options = list(formato = "cruces"), ficha_tecnica = FALSE)
  expect_true(file.exists(out_cross))
  expect_equal(openxlsx::getSheetNames(out_cross), "Cruces")
  cross_export <- openxlsx::read.xlsx(out_cross, sheet = "Cruces", colNames = FALSE)
  # El banner de hoja "CRUCES" se removio; la primera celda es el titulo de seccion.
  expect_false(any(cross_export == "CRUCES", na.rm = TRUE))
  expect_identical(cross_export$X1[[1]], "GENERAL")
  expect_false(any(cross_export == "SIN DATA", na.rm = TRUE))

  out_audit <- tempfile(fileext = ".xlsx")
  .panel_export_write(built, out_audit, options = list(formato = "auditoria"), ficha_tecnica = FALSE)
  expect_true(file.exists(out_audit))
  expect_true("auditoria_panel" %in% openxlsx::getSheetNames(out_audit))

  skip_if_not_installed("zip")
  old_writer <- Sys.getenv("PROSECNUR_SAV_WRITER", unset = NA_character_)
  Sys.setenv(PROSECNUR_SAV_WRITER = "haven")
  on.exit({
    if (is.na(old_writer)) Sys.unsetenv("PROSECNUR_SAV_WRITER") else Sys.setenv(PROSECNUR_SAV_WRITER = old_writer)
  }, add = TRUE)
  out_zip <- tempfile(fileext = ".zip")
  .panel_export_write(built, out_zip, options = list(formato = "paquete"), ficha_tecnica = FALSE)
  expect_true(file.exists(out_zip))
  entries <- utils::unzip(out_zip, list = TRUE)$Name
  expect_true(all(c(
    "01_base_panel_wide.xlsx",
    "01_base_panel_wide.csv",
    "01_base_panel_wide.sav",
    "01_niveles_medida.sps",
    "02_libro_codigos.xlsx",
    "03_frecuencias.xlsx",
    "04_cruces.xlsx",
    "05_auditoria_panel.xlsx"
  ) %in% entries))

  unzip_dir <- tempfile("panel_package_check_")
  dir.create(unzip_dir)
  utils::unzip(out_zip, files = c("02_libro_codigos.xlsx", "04_cruces.xlsx"), exdir = unzip_dir)
  expect_identical(openxlsx::getSheetNames(file.path(unzip_dir, "02_libro_codigos.xlsx")), "Codebook")
  expect_identical(openxlsx::getSheetNames(file.path(unzip_dir, "04_cruces.xlsx")), "Cruces")
  packaged_codebook <- openxlsx::read.xlsx(file.path(unzip_dir, "02_libro_codigos.xlsx"), sheet = "Codebook", colNames = FALSE)
  packaged_crosses <- openxlsx::read.xlsx(file.path(unzip_dir, "04_cruces.xlsx"), sheet = "Cruces", colNames = FALSE)
  expect_true(any(as.matrix(packaged_codebook) == "p1_med2", na.rm = TRUE))
  # Banner de hoja "CRUCES" removido: la primera celda es el titulo de seccion.
  expect_false(any(packaged_crosses == "CRUCES", na.rm = TRUE))
  expect_identical(as.character(packaged_crosses[1, 1, drop = TRUE]), "GENERAL")
})

test_that("resumen de instrumento cuenta solo preguntas hechas al entrevistado", {
  inst <- list(
    survey = data.frame(
      type = c(
        "text", "select_one si_no", "integer", "select_one sexo",
        "select_one grupo", "select_one nse", "select_one educ", "select_one si_no"
      ),
      name = c(
        "numero_encuesta", "consentimiento", "p1", "sexo_obs",
        "grupo", "nse_asignado", "educacion", "telefono"
      ),
      label = c(
        "Numero de encuesta", "Consentimiento", "Edad declarada", "Sexo observado",
        "Grupo de tratamiento", "NSE asignado", "Nivel educativo", "Telefono"
      ),
      stringsAsFactors = FALSE
    ),
    choices = data.frame()
  )
  summary <- .panel_instrument_summary(
    list(ola_1 = inst),
    list(waves = list(list(base = "ola_1", label = "Medición 1")))
  )
  expect_equal(summary$items_cuestionario, 6)
  expect_equal(summary$preguntas_entrevistado, 3)
  expect_equal(summary$preguntas_numeradas_entrevistado, 1)
  expect_equal(summary$campos_no_preguntados, 3)
  expect_equal(
    .ficha_tecnica_panel_instrumento_text(list(instrumentos = summary)),
    "\u2022 La primera medición: 1 pregunta."
  )

  summary_revisado <- .panel_instrument_summary(
    list(ola_1 = inst),
    list(waves = list(list(base = "ola_1", label = "Medición 1", question_count = 28L)))
  )
  expect_equal(summary_revisado$preguntas_reportadas, 28L)
  expect_equal(
    .ficha_tecnica_panel_instrumento_text(list(instrumentos = summary_revisado)),
    "\u2022 La primera medición: 28 preguntas."
  )
})

test_that("ficha tecnica panel documenta procedimiento, n por medicion y fechas", {
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
      distrito = c("Callao", "Lima", "Lima"),
      p1 = c("a", "b", "c"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    ola_2 = data.frame(
      numero_encuesta = c("1", "3"),
      fecha = c("10.06.26", "12.06.26"),
      distrito = c("Callao", "Lima"),
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
  expect_true(grepl("panel longitudinal con dos mediciones sucesivas", aplicacion, fixed = TRUE))
  expect_true(grepl("La primera medición registró 3 encuestas", aplicacion, fixed = TRUE))
  expect_true(grepl("La segunda medición registró 2 encuestas", aplicacion, fixed = TRUE))
  expect_false(grepl("numero_encuesta", aplicacion, fixed = TRUE))
  expect_false(grepl("llave", aplicacion, fixed = TRUE))
  expect_false(grepl("n=", aplicacion, fixed = TRUE))
  instrumento_txt <- rows$Detalle[rows$Campo == "Instrumento"][[1]]
  expect_true(grepl("• La primera medición: 1 pregunta.", instrumento_txt, fixed = TRUE))
  expect_true(grepl("• La segunda medición: 1 pregunta.", instrumento_txt, fixed = TRUE))
  expect_false(grepl("selección única", instrumento_txt, fixed = TRUE))
  expect_false(grepl("cuestionarios en papel", instrumento_txt, fixed = TRUE))
  expect_false(grepl("XLSForm", instrumento_txt, fixed = TRUE))
  expect_false(grepl("numero_encuesta", instrumento_txt, fixed = TRUE))
  expect_true("aplicacion_de_encuestas" %in% names((cfg$ficha_tecnica %||% list())$subtables))
  expect_true(all(c("distribucion_medicion_1", "distribucion_medicion_2") %in% names((cfg$ficha_tecnica %||% list())$appendices)))
  appendices <- (cfg$ficha_tecnica %||% list())$appendices
  district_columns <- grep("^Distrito", names(appendices$distribucion_medicion_1$data), value = TRUE)
  first_order <- unlist(appendices$distribucion_medicion_1$data[district_columns], use.names = FALSE)
  second_order <- unlist(appendices$distribucion_medicion_2$data[district_columns], use.names = FALSE)
  expect_equal(second_order, first_order)

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
  expect_true(any(grepl("Estructura de aplicación por medición", txt, fixed = TRUE)))
  expect_true(any(grepl("panel longitudinal con dos mediciones sucesivas", txt, fixed = TRUE)))
  expect_true(any(grepl("Encuestas realizadas", txt, fixed = TRUE)))
  expect_true(any(grepl("Personas entrevistadas", txt, fixed = TRUE)))
  expect_true(any(grepl("• La primera medición: 1 pregunta.", txt, fixed = TRUE)))
  expect_true(any(grepl("• La segunda medición: 1 pregunta.", txt, fixed = TRUE)))
  expect_true(any(grepl("01 de mayo de 2026 al 03 de mayo de 2026", txt, fixed = TRUE)))
  expect_true(any(grepl("10 de junio de 2026 al 12 de junio de 2026", txt, fixed = TRUE)))
  expect_true(sum(grepl("^Distribución$", txt)) >= 2L)
  expect_true(any(grepl("Primera medición: distribución de encuestas realizadas por distrito.", txt, fixed = TRUE)))
  expect_true(any(grepl("Segunda medición: distribución de encuestas realizadas por distrito.", txt, fixed = TRUE)))
  expect_true(any(grepl("Callao", txt, fixed = TRUE)))
  expect_true(any(grepl("Lima", txt, fixed = TRUE)))
  expect_false(any(grepl("Distribución agregada", txt, fixed = TRUE)))
  expect_false(any(grepl("numero_encuesta", txt, fixed = TRUE)))
  expect_false(any(grepl("XLSForm", txt, fixed = TRUE)))
  expect_false(any(grepl("p=", txt, fixed = TRUE)))
  expect_false(any(grepl("n registros", txt, fixed = TRUE)))
  expect_false(any(grepl("n llaves", txt, fixed = TRUE)))
  expect_false(any(grepl("configuracion analitica", txt, fixed = TRUE)))
  expect_false(any(grepl("configuración analítica", txt, fixed = TRUE)))
  expect_false(any(grepl("\\bolas?\\b", txt, ignore.case = TRUE)))
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
  expect_equal(openxlsx::getSheetNames(out), c("base_wide", "configuracion"))
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
  expect_true(any(grepl("^Distribución$", txt)))
  expect_false(any(grepl("Distribución agregada de la muestra por distrito", txt, fixed = TRUE)))
  expect_true(any(grepl("Callao", txt, fixed = TRUE)))
  expect_true(any(grepl("Lima", txt, fixed = TRUE)))
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
      campos_omitidos = c("Aplicación de encuestas piloto"),
      aplicacion_de_encuestas = "Dos mediciones de campo consolidadas por numero de encuesta.",
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
  expect_false(any(grepl("Aplicación de encuestas piloto", txt, fixed = TRUE)))
  expect_true(any(grepl("No recalculada en este entregable.", txt, fixed = TRUE)))
  expect_true(any(grepl("Digitalizacion desde cuestionario en papel.", txt, fixed = TRUE)))
})
