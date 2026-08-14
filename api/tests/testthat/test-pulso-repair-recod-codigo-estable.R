# Regresión: abrir un proyecto ya codificado no puede renumerar sus categorías.
#
# `.pulso_repair_parent_recod_xlsform()` reconstruye la lista `<parent>_recod`
# al cargar el `.pulso`. Comparaba el código de cada categoría nueva contra los
# códigos ya presentes en esa misma lista, así que una categoría escrita por la
# carga ANTERIOR colisionaba con su propio código y saltaba al siguiente libre.
#
# Medido en ACNUR V3: "Entidad pública / trámite migratorio" tenía el 6, se
# encontraba a sí misma en la lista y saltaba al 97 —un código reservado— y cada
# apertura del proyecto la empujaba un código más lejos. La comparación fallaba
# siempre porque `.pulso_xlsform_label_col()` elegía la columna del idioma, que
# en ese instrumento está vacía, en vez de `label`, que es la que tiene texto.

test_that(".pulso_xlsform_label_col prefiere la columna con texto, no la del nombre", {
  f <- prosecnurapp:::.pulso_xlsform_label_col
  vacia <- data.frame(
    list_name = c("l", "l"), name = c("1", "2"),
    `label::Spanish (ES)` = c(NA_character_, NA_character_),
    label = c("Uno", "Dos"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  expect_equal(f(vacia), "label")

  con_idioma <- data.frame(
    list_name = c("l", "l"), name = c("1", "2"),
    `label::Spanish (ES)` = c("Uno", "Dos"),
    label = c(NA_character_, NA_character_),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  expect_equal(f(con_idioma), "label::Spanish (ES)")
  expect_true(is.na(f(data.frame(a = 1))))
})

test_that("reabrir el proyecto conserva el código de la categoría nueva y su orden", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  td <- tempfile("pulso_repair_"); dir.create(td)
  path <- file.path(td, "instrumento.xlsx")

  # Instrumento tal como queda tras una ronda de codificación: la lista `_recod`
  # ya existe y contiene la categoría nueva (6) creada por el analista.
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("select_one lst_p7", "text", "select_one lst_p7_recod"),
    name = c("p7", "p7_other", "p7_recod"),
    `label::Spanish (ES)` = c(NA_character_, NA_character_, NA_character_),
    label = c("¿Cómo se enteró?", "¿Por cuál otro medio?", "¿Cómo se enteró?"),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = c(rep("lst_p7", 3), rep("lst_p7_recod", 4)),
    name = c("1", "2", "96", "1", "2", "6", "96"),
    `label::Spanish (ES)` = rep(NA_character_, 7),
    label = c("Radio", "Televisión", "Otro (especificar)",
              "Radio", "Televisión", "Entidad pública", "Otro (especificar)"),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  repairs <- list(list(
    parent = "p7", text_col = "p7_other",
    groups = list(
      list(codigo = "1", etiqueta = "Radio", origen = "existente"),
      list(codigo = "2", etiqueta = "Televisión", origen = "existente"),
      list(codigo = "6", etiqueta = "Entidad pública", origen = "nuevo"),
      list(codigo = "96", etiqueta = "Otro (especificar)", origen = "existente")
    )
  ))

  out <- prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  ch <- readxl::read_excel(path, sheet = "choices", .name_repair = "minimal")
  recod <- ch[ch$list_name == "lst_p7_recod", , drop = FALSE]
  codes <- as.character(recod$name)

  # La categoría no se renumera al reconocerse a sí misma…
  expect_true("6" %in% codes)
  expect_false("97" %in% codes)
  # …y el especial cierra la lista.
  expect_equal(codes, c("1", "2", "6", "96"))
  expect_equal(sum(as.character(recod$label) == "Entidad pública", na.rm = TRUE), 1L)

  # Reabrir otra vez es idempotente: no vuelve a mover nada.
  prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  ch2 <- readxl::read_excel(path, sheet = "choices", .name_repair = "minimal")
  expect_equal(as.character(ch2$name[ch2$list_name == "lst_p7_recod"]), c("1", "2", "6", "96"))
})
