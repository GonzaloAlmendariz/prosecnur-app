# Identificador de caso de plataforma en la BBDD entregada.
#
# `respondent_id` (SurveyMonkey) es la llave con la que el cliente cruza la BBDD
# contra su propio registro, y no llegaba: la reconciliación solo conocía
# metadata de Kobo (`^_`, `meta.`, `formhub`, `xform`), así que la de SurveyMonkey
# caía como "extra sustantiva" y se excluía del volcado por defecto. Ninguna
# plataforma declara su metadata en el XLSForm.
#
# Este archivo fija el alcance de esa regla —qué se conserva, qué sigue
# reconciliable y qué no viaja nunca— y el formato de la tabla de frecuencias,
# que se decidió en la misma tanda.
#
# Ejecutar:
#   LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 Rscript -e \
#     'pkgload::load_all("api",quiet=TRUE); testthat::test_file("api/tests/testthat/test-analitica-identificadores-caso.R")'

library(testthat)

if (!exists("%||%")) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
}

# Instrumento mínimo: solo q0001/q0002 son variables del formulario. Ninguna
# columna de metadata de SurveyMonkey está declarada aquí — que es justamente el
# punto: ninguna plataforma declara su metadata en el XLSForm.
.idc_inst <- function() {
  structure(
    list(
      survey = data.frame(
        type = c("select_one si_no", "select_one si_no"),
        name = c("q0001", "q0002"),
        label = c("Pregunta 1", "Pregunta 2"),
        stringsAsFactors = FALSE
      ),
      choices = data.frame(
        list_name = "si_no",
        name = c("1", "2"),
        label = c("Sí", "No"),
        stringsAsFactors = FALSE
      )
    ),
    class = "prosecnur_instrumento"
  )
}

# Base con el bloque de metadata REAL que exporta SurveyMonkey, en su orden.
.idc_data <- function() {
  data.frame(
    CollectorNm    = rep("Web Link 1", 3),
    respondent_id  = c("118420001", "118420002", "118420003"),
    collector_id   = rep("4412200", 3),
    date_created   = rep("2026-07-30", 3),
    date_modified  = rep("2026-07-30", 3),
    ip_address     = c("10.0.0.1", "10.0.0.2", "10.0.0.3"),
    email_address  = c("a@x.pe", "b@x.pe", "c@x.pe"),
    first_name     = c("Ana", "Beto", "Cira"),
    last_name      = c("Uno", "Dos", "Tres"),
    custom_1       = rep("", 3),
    q0001          = c("1", "2", "1"),
    q0002          = c("2", "2", "1"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

# --- El identificador sobrevive en la BBDD -----------------------------------

test_that("el identificador de caso de SurveyMonkey no es una variable extra", {
  extra <- .reconciliacion_variables_extra(.idc_data(), .idc_inst())

  expect_false("respondent_id" %in% extra$name)
  expect_false("collector_id" %in% extra$name)
})

test_that("el identificador sobrevive en la BBDD sin que nadie lo incluya a mano", {
  # cfg vacía = proyecto recién abierto, sin decisiones de reconciliación.
  plan <- .reconciliacion_export_plan(.idc_data(), .idc_inst(), list())

  expect_false("respondent_id" %in% plan$extra_a_excluir)
  expect_false("collector_id" %in% plan$extra_a_excluir)
})

test_that("la PII de SurveyMonkey sigue excluida por defecto", {
  # El alcance decidido cubre los identificadores, NO el resto de la metadata:
  # nombre, correo e IP no viajan al cliente sin decisión explícita.
  plan <- .reconciliacion_export_plan(.idc_data(), .idc_inst(), list())

  expect_true(all(
    c("first_name", "last_name", "email_address", "ip_address") %in% plan$extra_a_excluir
  ))
})

test_that("la metadata operativa de SM sigue siendo reconciliable, no se cuela ni se pierde", {
  # Ni identificador (se conserva siempre) ni PII (se excluye siempre): estas
  # quedan a un click en el popover, que es donde el estudio decide.
  extra <- .reconciliacion_variables_extra(.idc_data(), .idc_inst())

  expect_true(all(c("CollectorNm", "date_created", "date_modified") %in% extra$name))
})

test_that("un nombre de identificador con otra capitalización también se reconoce", {
  expect_true(.reconciliacion_is_platform_case_id("Respondent_ID"))
  expect_true(.reconciliacion_is_platform_case_id("response_id"))
  expect_false(.reconciliacion_is_platform_case_id("respondent_name"))
  expect_false(.reconciliacion_is_platform_case_id(""))
  expect_false(.reconciliacion_is_platform_case_id(NA))
})

# --- El identificador NO llega al libro de códigos ----------------------------

test_that("el libro de códigos documenta solo variables con tabla de códigos", {
  # Regla de la casa (Gonzalo, 2026-08-14): al libro de códigos llegan los
  # `select_one` y `select_multiple` y nada más. Un identificador de caso es
  # texto único por respuesta: no tiene escala que documentar, y meterlo ahí
  # convierte un documento de códigos en un inventario de columnas.
  #
  # Lo garantizan DOS filtros en serie, y este test cubre los dos porque el
  # segundo es fácil de saltarse sin querer: basta adjuntar un `attr(,"labels")`
  # sintético para que el motor dibuje el bloque.
  d <- .idc_data()
  inst <- .idc_inst()

  # Filtro 1: el recorte al catálogo del instrumento deja fuera la metadata.
  allowed <- .analitica_allowed_vars(inst)
  expect_false("respondent_id" %in% allowed)
  expect_true(all(c("q0001", "q0002") %in% allowed))

  # Filtro 2: aun forzando la columna dentro, el motor no le abre bloque —no
  # tiene value-labels—, así que el codebook sigue teniendo solo las preguntas.
  data_out <- d[, c("respondent_id", "q0001", "q0002"), drop = FALSE]
  for (v in c("q0001", "q0002")) {
    attr(data_out[[v]], "label") <- paste("Pregunta", sub("^q000", "", v))
    attr(data_out[[v]], "labels") <- stats::setNames(c("1", "2"), c("Sí", "No"))
  }

  skip_if_not_installed("openxlsx")
  path_xlsx <- withr::local_tempfile(fileext = ".xlsx")
  suppressMessages(reporte_codebook(data_out, path_xlsx = path_xlsx, ficha_tecnica = FALSE))

  plano <- unlist(openxlsx::read.xlsx(path_xlsx, colNames = FALSE), use.names = FALSE)
  plano <- plano[!is.na(plano)]
  expect_false(any(plano == "respondent_id"))
  expect_true(any(plano == "q0001"))
})

# --- Formato de la tabla de frecuencias --------------------------------------

test_that("la tabla de frecuencias rotula el porcentaje con dos decimales", {
  st <- pulso_xlsx_styles("freq")

  for (nm in c("body_pct", "freq_body_pct", "freq_total_pct", "zebra_pct")) {
    expect_identical(st[[nm]]$numFmt$formatCode, "0.00%", info = nm)
  }
})

test_that("los dos decimales son de Frecuencias, no de todo el paquete XLSX", {
  # Cruces mantiene un decimal: el cambio se pidió para la tabla contra la que se
  # verifica el resto, no como retoque global del tema.
  st <- pulso_xlsx_styles("cruces")

  expect_identical(st$body_pct$numFmt$formatCode, "0.0%")
})
