# Regresión: un XLSForm cuyo survey trae SOLO columnas de etiqueta con idioma
# (`label::Spanish (es)`), sin la columna `label` a secas, tumbaba
# `GET /api/carga/instrumento/estructura` con 500 E_INTERNAL. El lector
# `leer_xlsform_limpieza` asignaba `survey$group_label <- survey_raw[["label"]]`
# (NULL), así que la columna nunca nacía; la primera fila dentro de un grupo
# hacía `survey$group_label[i] <- ...` sobre NULL, armaba un vector de largo i
# y tibble se negaba a reciclarlo contra las N filas del survey.

.escribir_xlsform_solo_label_idioma <- function(path) {
  survey <- data.frame(
    # Filas previas fuera de grupo: si el primer grupo abriera en la fila 1,
    # la asignación de largo 1 se reciclaría y el bug quedaría oculto.
    type = c("start", "today", "begin_group", "text", "select_one sino", "end_group",
             "begin_group", "integer", "end_group"),
    name = c("inicio", "hoy", "datos", "nombre", "acepta", "", "perfil", "edad", ""),
    `label::Spanish (es)` = c(NA, NA, "Datos generales", "Nombre", "¿Acepta?", NA,
                              "Perfil", "Edad", NA),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sino", "sino"),
    name = c("1", "2"),
    `label::Spanish (es)` = c("Sí", "No"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

test_that("leer_xlsform_limpieza no revienta sin columna `label` a secas", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  .escribir_xlsform_solo_label_idioma(path)

  inst <- leer_xlsform_limpieza(path, verbose = FALSE)

  expect_equal(nrow(inst$survey), 9L)
  expect_true("group_label" %in% names(inst$survey))
  expect_length(inst$survey$group_label, nrow(inst$survey))
  # El rótulo de la sección sale de la columna con idioma, no del nombre.
  sm <- inst$meta$section_map
  expect_equal(
    as.character(sm$group_label[match(c("datos", "perfil"), sm$group_name)]),
    c("Datos generales", "Perfil")
  )
})

test_that("estructura_instrumento devuelve secciones y preguntas con ese XLSForm", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  .escribir_xlsform_solo_label_idioma(path)

  est <- estructura_instrumento(leer_xlsform_limpieza(path, verbose = FALSE))

  expect_length(est$secciones, 2L)
  expect_equal(vapply(est$preguntas, `[[`, character(1), "name"),
               c("nombre", "acepta", "edad"))
})
