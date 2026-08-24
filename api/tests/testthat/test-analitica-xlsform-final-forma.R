# Regresión: el XLSForm final exportado sigue siendo un XLSForm.
#
# El defecto (docs/qa/bug-xlsform-final-type-sin-lista.md): `reporte_instrumento()`
# no devuelve `survey_raw` — deja la hoja cruda en `survey` y le añade columnas
# derivadas, entre ellas el `tidyr::separate()` que parte
# `type = "select_one lst_p12"` en `type = "select_one"` MÁS una columna
# `list_name`. `.analitica_write_final_xlsform()` exporta `survey_raw %||% survey`,
# o sea esa hoja derivada: el archivo entregado salía con el `type` sin su lista,
# un `list_name` aparte y un `measure_sugerida` al lado. Quien reimportaba el
# instrumento perdía el vínculo pregunta→lista de opciones.
#
# El mismo separate parte también `"begin group"` en `begin` + `group`, así que
# el defecto se llevaba por delante la estructura de grupos del formulario.
#
# Ejecutar:
#   LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 Rscript -e \
#     'pkgload::load_all("api",quiet=TRUE); testthat::test_file("api/tests/testthat/test-analitica-xlsform-final-forma.R")'

library(testthat)

# XLSForm de origen: un grupo, un select_one, un select_multiple y un text. Se
# escribe de verdad a disco para que el instrumento lo produzca `reporte_instrumento()`,
# que es la función que introduce el defecto.
escribir_xlsform_origen <- function(path) {
  survey <- data.frame(
    type = c("begin group", "select_one lst_p12", "select_multiple lst_serv", "text", "end group"),
    name = c("g_datos", "p12", "p13", "p14", ""),
    `label::es` = c("Datos", "Institución que atendió", "Servicios recibidos", "Comentario", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_p12", "lst_p12", "lst_serv", "lst_serv"),
    name = c("1", "14", "a", "b"),
    `label::es` = c("Universidad", "Otra institución", "Salud", "Educación"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

leer_hoja <- function(path, hoja) {
  as.data.frame(readxl::read_excel(path, sheet = hoja, col_types = "text"))
}

exportar_desde_origen <- function() {
  origen <- tempfile(fileext = ".xlsx")
  escribir_xlsform_origen(origen)
  inst <- reporte_instrumento(origen)
  final <- tempfile(fileext = ".xlsx")
  .analitica_write_final_xlsform(inst, final)
  list(origen = origen, inst = inst, final = final)
}

test_that("el `type` exportado vuelve a llevar su lista de opciones", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  ex <- exportar_desde_origen()
  on.exit(unlink(c(ex$origen, ex$final)), add = TRUE)

  # El instrumento canónico sí trae el `type` partido: es lo que se repara al exportar.
  expect_equal(as.character(ex$inst$survey$type[2]), "select_one")
  expect_equal(as.character(ex$inst$survey$list_name[2]), "lst_p12")

  sv <- leer_hoja(ex$final, "survey")
  expect_equal(
    as.character(sv$type),
    c("begin group", "select_one lst_p12", "select_multiple lst_serv", "text", "end group")
  )
})

test_that("el survey exportado no arrastra las columnas internas del pipeline", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  ex <- exportar_desde_origen()
  on.exit(unlink(c(ex$origen, ex$final)), add = TRUE)

  sv <- leer_hoja(ex$final, "survey")
  expect_false("list_name" %in% names(sv))
  expect_false("measure_sugerida" %in% names(sv))

  # Lo que sí es del XLSForm se conserva, incluida la etiqueta.
  expect_true(all(c("type", "name", "label::es") %in% names(sv)))
  expect_equal(as.character(sv[["label::es"]][2]), "Institución que atendió")

  # En el `choices`, en cambio, `list_name` es columna real del XLSForm.
  ch <- leer_hoja(ex$final, "choices")
  expect_true("list_name" %in% names(ch))
  expect_equal(as.character(ch$list_name), c("lst_p12", "lst_p12", "lst_serv", "lst_serv"))
  expect_equal(as.character(ch$name), c("1", "14", "a", "b"))
})

test_that("el XLSForm exportado se reimporta con el vínculo pregunta→lista intacto", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  ex <- exportar_desde_origen()
  on.exit(unlink(c(ex$origen, ex$final)), add = TRUE)

  reimportado <- reporte_instrumento(ex$final)
  sv <- as.data.frame(reimportado$survey)

  expect_equal(as.character(sv$list_name[match("p12", sv$name)]), "lst_p12")
  expect_equal(as.character(sv$list_name[match("p13", sv$name)]), "lst_serv")
  expect_equal(reimportado$orders_list$p12$names, c("1", "14"))
  expect_equal(reimportado$orders_list$p12$labels, c("Universidad", "Otra institución"))

  # Y el mismo instrumento reimportado se vuelve a exportar igual: la reparación
  # es idempotente, no va pegando una lista más en cada vuelta.
  segunda <- tempfile(fileext = ".xlsx")
  on.exit(unlink(segunda), add = TRUE)
  .analitica_write_final_xlsform(reimportado, segunda)
  expect_equal(leer_hoja(segunda, "survey"), leer_hoja(ex$final, "survey"))
})

test_that("el instrumento que trae `survey_raw` se exporta sin tocar", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  # Forma del lector de la codificación: `survey_raw` es la hoja leída tal cual
  # (el `type` nunca se partió) y las derivadas viven en `survey`.
  inst <- list(
    survey_raw = data.frame(
      type = c("select_one lst_p12", "text"),
      name = c("p12", "p14"),
      `label::es` = c("Institución que atendió", "Comentario"),
      check.names = FALSE, stringsAsFactors = FALSE
    ),
    choices_raw = data.frame(
      list_name = c("lst_p12", "lst_p12"),
      name = c("1", "14"),
      `label::es` = c("Universidad", "Otra institución"),
      check.names = FALSE, stringsAsFactors = FALSE
    ),
    survey = data.frame(
      type = c("select_one", "text"),
      list_name = c("lst_p12", NA_character_),
      name = c("p12", "p14"),
      label = c("Institución que atendió", "Comentario"),
      measure_sugerida = c("nominal", "nominal"),
      stringsAsFactors = FALSE
    )
  )

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .analitica_write_final_xlsform(inst, path)

  sv <- leer_hoja(path, "survey")
  expect_equal(names(sv), c("type", "name", "label::es"))
  expect_equal(as.character(sv$type), c("select_one lst_p12", "text"))
})

test_that("una fila que ya trae el `type` entero no se duplica la lista", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  # `.analitica_patch_integrated_key_survey()` añade la fila de la llave con el
  # `type` partido cuando hay columna `list_name`; otros parches la añaden con el
  # `type` entero. Las dos formas conviven en la misma hoja.
  inst <- list(survey = data.frame(
    type = c("select_one", "select_one lst_serv", "text"),
    list_name = c("lst_p12", "lst_serv", ""),
    name = c("p12", "p13", "p14"),
    label = c("Institución", "Servicios", "Comentario"),
    stringsAsFactors = FALSE
  ))

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .analitica_write_final_xlsform(inst, path)

  sv <- leer_hoja(path, "survey")
  expect_equal(as.character(sv$type), c("select_one lst_p12", "select_one lst_serv", "text"))
})

test_that("un survey vacío o sin `list_name` no rompe el export", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  vacio <- list(survey = data.frame(
    type = character(0), list_name = character(0), name = character(0),
    stringsAsFactors = FALSE
  ))
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  expect_error(.analitica_write_final_xlsform(vacio, path), NA)
  expect_false("list_name" %in% names(leer_hoja(path, "survey")))

  sin_lista <- list(survey = data.frame(
    type = "select_one lst_p12", name = "p12", label = "Institución",
    stringsAsFactors = FALSE
  ))
  path2 <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path2), add = TRUE)
  .analitica_write_final_xlsform(sin_lista, path2)
  expect_equal(as.character(leer_hoja(path2, "survey")$type), "select_one lst_p12")
})
