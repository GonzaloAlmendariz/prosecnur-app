# Regresión (ítem 48, PPT ACNUR RMS 2026): las categorías nuevas de una
# recodificada quedaban sin rótulo y las opciones sin rótulo del formulario se
# renumeraban en cada apertura.
#
# El XLSForm de ACNUR RMS trae los rótulos en `label::Español (es)` y deja
# `label` vacía. `.pulso_xlsform_label_col()` sólo reconocía `label::Spanish
# (es)`, así que elegía `label`: los rótulos de los grupos de Codificación
# ("Oftalmología", "Ginecología"...) se escribían en una columna que nadie lee y
# la lámina mostraba "6", "7", "8", "9" con 0.0 % mientras sus casos
# desaparecían del gráfico. Además, una opción de la lista `_recod` sin rótulo
# (105 a 112 en `hacc02_recod`) tomaba su propio código como rótulo, chocaba
# contra sí misma y saltaba al siguiente libre (113, luego 121...).

.rotulo_idioma_xlsform <- function(path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("select_one hacc02", "text", "select_one hacc02_recod"),
    name = c("HACC02", "HACC02_other", "HACC02_recod"),
    `label::Español (es)` = c("¿Cuál fue el motivo?", "Otro motivo", "¿Cuál fue el motivo?"),
    label = c(NA_character_, NA_character_, NA_character_),
    `label::English (en)` = c("Reason?", "Other", "Reason?"),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = c(rep("hacc02", 3), rep("hacc02_recod", 5)),
    name = c("1", "2", "96", "1", "2", "105", "106", "96"),
    `label::Español (es)` = c("Enfermedad", "Lesión", "Otro (especifique)",
                              "Enfermedad", "Lesión", NA, NA, "Otro (especifique)"),
    label = rep(NA_character_, 8),
    `label::English (en)` = c("Illness", "Injury", "Other", "Illness", "Injury", NA, NA, "Other"),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.rotulo_idioma_repairs <- function() {
  list(list(
    parent = "HACC02", text_col = "HACC02_other",
    groups = list(
      list(codigo = "1", etiqueta = "Enfermedad", origen = "existente"),
      list(codigo = "2", etiqueta = "Lesión", origen = "existente"),
      list(codigo = "96", etiqueta = "Otro (especifique)", origen = "existente"),
      list(codigo = "6", etiqueta = "Oftalmología", origen = "nuevo"),
      list(codigo = "7", etiqueta = "Ginecología", origen = "nuevo")
    )
  ))
}

test_that(".pulso_xlsform_label_col reconoce la columna de español con cualquier nombre de idioma", {
  f <- prosecnurapp:::.pulso_xlsform_label_col
  ch <- data.frame(
    list_name = c("l", "l"), name = c("1", "2"),
    `label::Español (es)` = c("Uno", "Dos"),
    label = c(NA_character_, NA_character_),
    `label::English (en)` = c("One", "Two"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  expect_equal(f(ch), "label::Español (es)")
})

test_that("los grupos nuevos llevan su rótulo a la columna de español y nada se renumera", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  td <- tempfile("pulso_rotulo_idioma_"); dir.create(td)
  path <- .rotulo_idioma_xlsform(file.path(td, "instrumento.xlsx"))
  repairs <- .rotulo_idioma_repairs()

  leer <- function() {
    ch <- readxl::read_excel(path, sheet = "choices", .name_repair = "minimal", col_types = "text")
    ch[ch$list_name == "hacc02_recod", , drop = FALSE]
  }

  out <- prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  recod <- leer()
  rotulos <- stats::setNames(as.character(recod[["label::Español (es)"]]), recod$name)

  expect_equal(unname(rotulos[c("6", "7")]), c("Oftalmología", "Ginecología"))
  # Las opciones sin rótulo del formulario conservan su código.
  expect_true(all(c("105", "106") %in% recod$name))
  expect_false(any(as.integer(recod$name) > 106L))
  expect_equal(unname(out$repairs[[1]]$code_map[c("105", "106")]), c("105", "106"))

  # Reabrir es idempotente.
  prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  expect_equal(leer()$name, recod$name)
  prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  expect_equal(leer()$name, recod$name)
})
