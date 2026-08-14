# Regresión: el override de etiqueta llega a TODAS las columnas de etiqueta del
# instrumento, no solo a la columna canónica `label`.
#
# El defecto (docs/qa/bug-xlsform-final-label-es-sin-overrides.md, ACRD ING):
# `.analitica_apply_label_overrides()` escribía únicamente `inst$survey$label` /
# `inst$choices$label`, mientras que `reporte_instrumento()` deja las hojas
# crudas del XLSForm en `survey`/`choices` y les AÑADE esa columna `label`. El
# XLSForm final —que exporta esas mismas hojas— salía diciendo el override en
# `label` y la etiqueta vieja en `label::es`, que es la que un XLSForm usa para
# español: el instrumento entregado se contradecía consigo mismo y con la base,
# que sí toma el override.
#
# La función tiene dos llamantes (Analítica y Gráficos) justamente para que una
# etiqueta curada no valga distinto en cada uno; estos tests cubren esa promesa
# también para el XLSForm final.
#
# Ejecutar:
#   LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 Rscript -e \
#     'pkgload::load_all("api",quiet=TRUE); testthat::test_file("api/tests/testthat/test-analitica-label-overrides-xlsform.R")'

library(testthat)

# Instrumento con la forma que devuelve `reporte_instrumento()`: la hoja cruda
# (con `label::es`) MÁS la columna `label` derivada, y sin `*_raw`.
make_inst_label_es <- function() {
  structure(list(
    survey = data.frame(
      type = "select_one",
      list_name = "lst_p12_recod",
      name = "p12_recod",
      `label::es` = "Institución que atendió",
      label = "Institución que atendió",
      check.names = FALSE, stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p12_recod", "lst_p12_recod"),
      name = c("1", "14"),
      `label::es` = c("Universidad", "Otra institución"),
      label = c("Universidad", "Otra institución"),
      check.names = FALSE, stringsAsFactors = FALSE
    ),
    var_labels = c(p12_recod = "Institución que atendió"),
    dicc_code_to_label = list(lst_p12_recod = c("1" = "Universidad", "14" = "Otra institución")),
    orders_list = list(p12_recod = list(
      names = c("1", "14"),
      labels = c("Universidad", "Otra institución"),
      label = "Institución que atendió"
    ))
  ), class = c("prosecnur_instrumento", "list"))
}

# Variante con las hojas `*_raw` presentes (instrumentos que sí las conservan,
# p. ej. los que arma la codificación). El export las prefiere.
make_inst_con_raw <- function() {
  inst <- make_inst_label_es()
  inst$survey_raw <- data.frame(
    type = "select_one lst_p12_recod",
    name = "p12_recod",
    `label::es` = "Institución que atendió",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  inst$choices_raw <- data.frame(
    list_name = c("lst_p12_recod", "lst_p12_recod"),
    name = c("1", "14"),
    `label::es` = c("Universidad", "Otra institución"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  inst
}

make_data <- function() {
  data <- data.frame(p12_recod = c("1", "14"), stringsAsFactors = FALSE)
  attr(data$p12_recod, "labels") <- c("1" = "Universidad", "14" = "Otra institución")
  attr(data$p12_recod, "label") <- "Institución que atendió"
  data
}

# El override tal como lo declara la config de Analítica (`cfg$datos`).
datos_override <- function() {
  .analitica_datos_config(list(datos = list(
    value_labels = list(p12_recod = list("14" = "Otros")),
    variable_labels = list(p12_recod = "Institución (agrupada)")
  )))
}

test_that("el override de opción llega a `label` y a `label::es` del choices", {
  out <- .analitica_apply_label_overrides(make_data(), make_inst_label_es(), datos_override())
  ch <- as.data.frame(out$inst$choices)
  fila <- ch$name == "14"

  expect_equal(ch$label[fila], "Otros")
  expect_equal(ch[["label::es"]][fila], "Otros")

  # Las filas sin override no se tocan en ninguna de las dos columnas.
  otra <- ch$name == "1"
  expect_equal(ch$label[otra], "Universidad")
  expect_equal(ch[["label::es"]][otra], "Universidad")
})

test_that("el override de pregunta llega a `label` y a `label::es` del survey", {
  out <- .analitica_apply_label_overrides(make_data(), make_inst_label_es(), datos_override())
  sv <- as.data.frame(out$inst$survey)

  expect_equal(sv$label[1], "Institución (agrupada)")
  expect_equal(sv[["label::es"]][1], "Institución (agrupada)")
  expect_equal(unname(out$inst$var_labels[["p12_recod"]]), "Institución (agrupada)")
})

test_that("el override llega a las variantes raw cuando el instrumento las trae", {
  out <- .analitica_apply_label_overrides(make_data(), make_inst_con_raw(), datos_override())

  ch_raw <- as.data.frame(out$inst$choices_raw)
  expect_equal(ch_raw[["label::es"]][ch_raw$name == "14"], "Otros")
  expect_equal(ch_raw[["label::es"]][ch_raw$name == "1"], "Universidad")

  sv_raw <- as.data.frame(out$inst$survey_raw)
  expect_equal(sv_raw[["label::es"]][1], "Institución (agrupada)")
})

test_that("el XLSForm final exportado no se contradice entre `label` y `label::es`", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  for (inst in list(make_inst_label_es(), make_inst_con_raw())) {
    out <- .analitica_apply_label_overrides(make_data(), inst, datos_override())

    path <- tempfile(fileext = ".xlsx")
    on.exit(unlink(path), add = TRUE)
    .analitica_write_final_xlsform(out$inst, path)

    ch <- as.data.frame(readxl::read_excel(path, sheet = "choices"))
    fila <- as.character(ch$name) == "14"
    label_cols <- grep("^label", names(ch), ignore.case = TRUE, value = TRUE)
    expect_true(length(label_cols) > 0L)
    for (col in label_cols) expect_equal(as.character(ch[[col]][fila]), "Otros")

    sv <- as.data.frame(readxl::read_excel(path, sheet = "survey"))
    for (col in grep("^label", names(sv), ignore.case = TRUE, value = TRUE)) {
      expect_equal(as.character(sv[[col]][1]), "Institución (agrupada)")
    }
  }
})

test_that("aplicar el override dos veces deja el mismo instrumento", {
  datos <- datos_override()
  una <- .analitica_apply_label_overrides(make_data(), make_inst_con_raw(), datos)
  dos <- .analitica_apply_label_overrides(una$data, una$inst, datos)

  expect_equal(as.data.frame(dos$inst$choices), as.data.frame(una$inst$choices))
  expect_equal(as.data.frame(dos$inst$choices_raw), as.data.frame(una$inst$choices_raw))
  expect_equal(as.data.frame(dos$inst$survey), as.data.frame(una$inst$survey))
})

test_that("un instrumento sin columnas de etiqueta no rompe el override", {
  inst <- make_inst_label_es()
  inst$choices <- inst$choices[, c("list_name", "name")]

  out <- .analitica_apply_label_overrides(make_data(), inst, datos_override())

  expect_equal(names(as.data.frame(out$inst$choices)), c("list_name", "name"))
  # La etiqueta curada sigue llegando a la data y al orden aunque el choices no
  # tenga dónde escribirla.
  expect_equal(unname(attr(out$data$p12_recod, "labels")[["14"]]), "Otros")
  expect_equal(out$inst$orders_list$p12_recod$labels[2], "Otros")
})
