make_dimensiones_jerarquia_fixture <- function() {
  dat <- data.frame(
    p12 = c("5", "4", "5", "4", "3", "2", "5", "4", "3", "5", "4", "2"),
    p38 = c("5", "4", "4", "3", "2", "1", "5", "4", "3", "5", "4", "2"),
    servicio = rep(c("ULE", "CIAM", "DEMUNA"), each = 4),
    p2_recod = rep(c("18 a 30", "31 a 54"), times = 6),
    p1_recod = rep(c("Mujer", "Hombre"), times = 6),
    distrito = rep(c("Ate", "Rimac"), times = 6),
    p11 = rep(c("Una vez", "2-3 veces"), times = 6),
    stringsAsFactors = FALSE
  )

  attr(dat$p12, "label") <- "¿El personal que lo atendió, lo trató con respeto y amabilidad?"
  attr(dat$p38, "label") <- "En una escala del 1 al 5, ¿Qué tanto recomendaría el servicio de la ULE a otras personas?"
  attr(dat$servicio, "label") <- "Servicio"
  attr(dat$p2_recod, "label") <- "Edad del usuario"
  attr(dat$p1_recod, "label") <- "Sexo"
  attr(dat$distrito, "label") <- "Distrito"
  attr(dat$p11, "label") <- "Frecuencia de asistencia"

  survey <- data.frame(
    name = c("p12", "p38", "servicio", "p2_recod", "p1_recod", "distrito", "p11"),
    type = c(
      "select_one sat5",
      "select_one sat5",
      "select_one servicio",
      "select_one edad",
      "select_one sexo",
      "select_one distrito",
      "select_one frecuencia"
    ),
    list_name = c("sat5", "sat5", "servicio", "edad", "sexo", "distrito", "frecuencia"),
    stringsAsFactors = FALSE
  )

  choices <- do.call(
    rbind,
    list(
      data.frame(
        list_name = "sat5",
        name = c("1", "2", "3", "4", "5"),
        label = c(
          "Nada recomendable",
          "No recomendable",
          "Neutral",
          "Recomendable",
          "Muy recomendable"
        ),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "servicio",
        name = c("ULE", "CIAM", "DEMUNA"),
        label = c("ULE", "CIAM", "DEMUNA"),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "edad",
        name = c("18 a 30", "31 a 54"),
        label = c("18 a 30", "31 a 54"),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "sexo",
        name = c("Mujer", "Hombre"),
        label = c("Mujer", "Hombre"),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "distrito",
        name = c("Ate", "Rimac"),
        label = c("Ate", "Rimac"),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "frecuencia",
        name = c("Una vez", "2-3 veces"),
        label = c("Una vez", "2-3 veces"),
        stringsAsFactors = FALSE
      )
    )
  )

  inst <- list(
    survey = survey,
    choices = choices,
    orders_list = list(sat5 = c("1", "2", "3", "4", "5"))
  )

  d1 <- prosecnur::reporte_dimensiones(
    data = dat,
    instrumento = inst,
    vars = c("p12", "p38"),
    prefijo = "r100_",
    reemplazar = FALSE,
    orden_por_lista = list(sat5 = c("1", "2", "3", "4", "5"))
  )

  d2 <- prosecnur::reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      prosecnur::subindice("trato", "Trato", c("r100_p12")),
      prosecnur::subindice("recomendacion", "Recomendación", c("r100_p38"))
    ),
    indices = list(
      prosecnur::indice("indice_general", "Indice General", c("trato", "recomendacion")),
      prosecnur::indice("indice_pertinencia", "Indice de Pertinencia", c("trato")),
      prosecnur::indice("indice_eficiencia", "Indice de Eficiencia", c("recomendacion"))
    )
  )

  attr(d2$r100_p12, "label") <- "Respeto y amabilidad"
  attr(d2$r100_p38, "label") <- "Recomendación"

  list(data = d2, instrumento = inst)
}

test_that("tablas_dimensiones_jerarquicas construye resumen y detalle en orden", {
  fx <- make_dimensiones_jerarquia_fixture()

  tablas <- prosecnur::tablas_dimensiones_jerarquicas(
    data = fx$data,
    indices = c("idx_indice_general", "idx_indice_pertinencia", "idx_indice_eficiencia"),
    hoja_indicadores = "Indicadores",
    hoja_detalle = "Conductores",
    incluir_detalle = TRUE,
    fila = "servicio",
    cruzar_dim = c("p2_recod", "p1_recod", "distrito", "p11"),
    incluir_total = TRUE,
    brecha_cols = TRUE,
    orientacion = "filas_indicadores"
  )

  expect_length(tablas, 4L)
  expect_identical(
    vapply(tablas, `[[`, character(1), "titulo"),
    c(
      "Indicadores",
      "Conductores",
      "Trato",
      "Recomendación"
    )
  )
  expect_identical(
    vapply(tablas, `[[`, character(1), "hoja"),
    c(
      rep("Indicadores", 2),
      rep("Conductores", 2)
    )
  )
  expect_identical(
    tablas[[1]]$indicadores,
    c("idx_indice_general", "idx_indice_pertinencia", "idx_indice_eficiencia")
  )
  expect_identical(tablas[[2]]$indicadores, c("sub_trato", "sub_recomendacion"))
  expect_identical(tablas[[3]]$indicadores, "r100_p12")
})

test_that("metodologia editorial muestra pregunta humana y escala completa", {
  fx <- make_dimensiones_jerarquia_fixture()

  meta <- prosecnur:::.dim_metodologia_df(
    data = fx$data,
    fuente = "Pulso PUCP",
    fila = "servicio",
    cruces = c("p2_recod", "p1_recod", "distrito", "p11"),
    aplicar_semaforo = TRUE,
    semaforo_cortes = c(60, 80),
    hay_brecha = TRUE,
    show_sig = TRUE,
    estilo = "editorial"
  )

  row38 <- meta[grep("Pregunta 38:", meta$elemento, fixed = TRUE), , drop = FALSE]
  expect_equal(nrow(row38), 1L)
  expect_identical(
    row38$detalle,
    "Escala 0-100: Nada recomendable (0), No recomendable (25), Neutral (50), Recomendable (75), Muy recomendable (100)"
  )

  txt <- paste(meta$elemento, meta$detalle, collapse = " ")
  expect_false(grepl("\\bp38\\b|r100_|sub_|idx_|->", txt, perl = TRUE))
})

test_that("reporte_cruces dimensiones genera hojas jerarquicas reutilizables", {
  fx <- make_dimensiones_jerarquia_fixture()
  path_xlsx <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_xlsx), add = TRUE)

  tablas <- prosecnur::tablas_dimensiones_jerarquicas(
    data = fx$data,
    indices = c("idx_indice_general", "idx_indice_pertinencia", "idx_indice_eficiencia"),
    hoja_indicadores = "Indicadores",
    hoja_detalle = "Conductores",
    incluir_detalle = TRUE,
    fila = "servicio",
    cruzar_dim = c("p2_recod", "p1_recod", "distrito", "p11"),
    incluir_total = TRUE,
    brecha_cols = TRUE,
    orientacion = "filas_indicadores"
  )

  expect_no_error(
    prosecnur::reporte_cruces(
      data = fx$data,
      instrumento = fx$instrumento,
      SECCIONES = NULL,
      cruces = "servicio",
      modo = "dimensiones",
      tablas = tablas,
      filas_dimensiones = "servicio",
      cruzar_dim = c("p2_recod", "p1_recod", "distrito", "p11"),
      incluir_total = TRUE,
      digits = 0,
      show_sig = TRUE,
      aplicar_semaforo = TRUE,
      semaforo_cortes = c(60, 80),
      brecha_filas = FALSE,
      brecha_cols = TRUE,
      aplicar_gradiente_brecha = TRUE,
      brecha_cortes = c(1, 30),
      titulo_metodologia = "Como leer estas tablas",
      estilo_metodologia = "editorial",
      path_xlsx = path_xlsx
    )
  )

  expect_true(file.exists(path_xlsx))

  wb <- openxlsx::loadWorkbook(path_xlsx)
  expect_identical(names(wb), c("Metodologia", "Indicadores", "Conductores"))

  meta_sheet <- openxlsx::read.xlsx(path_xlsx, sheet = "Metodologia", colNames = FALSE)
  expect_true(any(grepl("Pregunta 38:", meta_sheet[[1]], fixed = TRUE)))
  expect_true(any(grepl(
    "Nada recomendable \\(0\\), No recomendable \\(25\\), Neutral \\(50\\), Recomendable \\(75\\), Muy recomendable \\(100\\)",
    meta_sheet[[2]]
  )))

  ind_sheet <- openxlsx::read.xlsx(path_xlsx, sheet = "Indicadores", colNames = FALSE)
  expect_true(any(grepl("Indice General", ind_sheet[[1]], fixed = TRUE)))
  expect_true(any(grepl("Trato", ind_sheet[[1]], fixed = TRUE)))

  det_sheet <- openxlsx::read.xlsx(path_xlsx, sheet = "Conductores", colNames = FALSE)
  expect_false(any(grepl("Criterio", det_sheet[[1]], fixed = TRUE)))
  expect_true(any(grepl("Respeto", det_sheet[[1]], fixed = TRUE)))
})

test_that("reporte_cruces clasico renombra Media total a Promedio general", {
  fx <- make_dimensiones_jerarquia_fixture()
  path_xlsx <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_xlsx), add = TRUE)

  tablas <- list(
    list(
      titulo = "Resumen clasico",
      indicadores = c("sub_trato", "sub_recomendacion"),
      fila = "servicio",
      cruzar_dim = c("p2_recod"),
      hoja = "Clasico",
      orientacion = "filas_dimension",
      incluir_total = TRUE,
      brecha_cols = TRUE
    )
  )

  expect_no_error(
    prosecnur::reporte_cruces(
      data = fx$data,
      instrumento = fx$instrumento,
      SECCIONES = NULL,
      cruces = "servicio",
      modo = "dimensiones",
      tablas = tablas,
      filas_dimensiones = "servicio",
      cruzar_dim = c("p2_recod"),
      incluir_total = TRUE,
      digits = 0,
      show_sig = TRUE,
      aplicar_semaforo = TRUE,
      semaforo_cortes = c(60, 80),
      brecha_filas = FALSE,
      brecha_cols = TRUE,
      aplicar_gradiente_brecha = TRUE,
      brecha_cortes = c(1, 30),
      path_xlsx = path_xlsx
    )
  )

  clasico <- openxlsx::read.xlsx(path_xlsx, sheet = "Clasico", colNames = FALSE)
  txt <- paste(apply(clasico, 1, paste, collapse = " "), collapse = " ")
  expect_true(grepl("Promedio general", txt, fixed = TRUE))
  expect_false(grepl("Media total", txt, fixed = TRUE))
})
