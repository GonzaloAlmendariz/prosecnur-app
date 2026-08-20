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

test_that("la fila _recod que reconstruye el reparador hereda la etiqueta tal cual", {
  # El sufijo " recodificada" llegaba al TÍTULO de la lámina del PPT —"¿En qué
  # sector trabajaba antes del programa? recodificada"—, que es texto de
  # entregable y va al cliente. Las `_recod` que crea la codificación normal
  # copian la etiqueta de la madre; solo las que reconstruía este reparador
  # salían marcadas: 2 de las 14 de ACNUR V3 (`sector`, `HelpChannel`).
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  td <- tempfile("pulso_label_"); dir.create(td)
  path <- file.path(td, "instrumento.xlsx")
  MADRE <- "¿En qué sector trabajaba antes del programa?"

  # El survey NO trae la fila `_recod`: el reparador tiene que crearla.
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("select_one lst_sector", "text"),
    name = c("sector", "sector_other"),
    `label::Spanish (ES)` = c(NA_character_, NA_character_),
    label = c(MADRE, "¿Qué otro sector?"),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = rep("lst_sector", 3),
    name = c("1", "2", "96"),
    `label::Spanish (ES)` = rep(NA_character_, 3),
    label = c("Comercio", "Servicios", "Otro (especificar)"),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  repairs <- list(list(
    parent = "sector", text_col = "sector_other",
    groups = list(
      list(codigo = "1", etiqueta = "Comercio", origen = "existente"),
      list(codigo = "2", etiqueta = "Servicios", origen = "existente"),
      list(codigo = "96", etiqueta = "Otro (especificar)", origen = "existente")
    )
  ))

  prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  sv <- readxl::read_excel(path, sheet = "survey", .name_repair = "minimal")
  fila <- sv[as.character(sv$name) == "sector_recod", , drop = FALSE]

  expect_equal(nrow(fila), 1L)
  expect_identical(as.character(fila$label[[1]]), MADRE)
  expect_false(grepl("recodificad", as.character(fila$label[[1]]), ignore.case = TRUE))
})

test_that("reabrir un proyecto viejo limpia el sufijo que dejo el propio reparador", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  td <- tempfile("pulso_limpia_"); dir.create(td)
  path <- file.path(td, "instrumento.xlsx")
  MADRE <- "¿En qué sector trabajaba antes del programa?"

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("select_one lst_sector", "text", "select_one lst_sector_recod"),
    name = c("sector", "sector_other", "sector_recod"),
    `label::Spanish (ES)` = c(NA_character_, NA_character_, NA_character_),
    # Asi quedo guardado el .pulso de ACNUR V3 antes del arreglo.
    label = c(MADRE, "¿Qué otro sector?", paste(MADRE, "recodificada")),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = c(rep("lst_sector", 3), rep("lst_sector_recod", 3)),
    name = c("1", "2", "96", "1", "2", "96"),
    `label::Spanish (ES)` = rep(NA_character_, 6),
    label = rep(c("Comercio", "Servicios", "Otro (especificar)"), 2),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  repairs <- list(list(
    parent = "sector", text_col = "sector_other",
    groups = list(
      list(codigo = "1", etiqueta = "Comercio", origen = "existente"),
      list(codigo = "2", etiqueta = "Servicios", origen = "existente"),
      list(codigo = "96", etiqueta = "Otro (especificar)", origen = "existente")
    )
  ))

  prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  sv <- readxl::read_excel(path, sheet = "survey", .name_repair = "minimal")
  expect_identical(as.character(sv$label[as.character(sv$name) == "sector_recod"][[1]]), MADRE)

  # Una etiqueta que el analista escribio a mano NO se toca, aunque mencione
  # la palabra: solo se limpia la forma exacta que producia el codigo.
  propia <- "Sector recodificada por el equipo"
  sv$label[as.character(sv$name) == "sector_recod"] <- propia
  wb2 <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb2, "survey"); openxlsx::writeData(wb2, "survey", as.data.frame(sv))
  ch <- readxl::read_excel(path, sheet = "choices", .name_repair = "minimal")
  openxlsx::addWorksheet(wb2, "choices"); openxlsx::writeData(wb2, "choices", as.data.frame(ch))
  openxlsx::saveWorkbook(wb2, path, overwrite = TRUE)

  prosecnurapp:::.pulso_repair_parent_recod_xlsform(path, repairs)
  sv2 <- readxl::read_excel(path, sheet = "survey", .name_repair = "minimal")
  expect_identical(as.character(sv2$label[as.character(sv2$name) == "sector_recod"][[1]]), propia)
})
