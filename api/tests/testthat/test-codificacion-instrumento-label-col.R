# Regresión: elección de la columna de label en el adaptador de instrumento.
#
# Un XLSForm puede declarar `label::Spanish (ES)` y dejarla vacía, con el texto
# real en `label`. `.guess_label_col()` elegía por nombre sin mirar el contenido,
# así que devolvía la columna vacía; `.add_recoded_q()` copiaba el catálogo
# original con etiquetas NA y su fallback las reemplazaba por el propio código.
# Resultado observado en el entregable de ACNUR V3: la lista `revaDificults_recod`
# salía con "1", "2", "97" como etiquetas, y de ahí el libro de códigos
# documentaba 34 dummies sin texto legible. Las categorías nuevas se salvaban
# porque su etiqueta llega por la plantilla, no por el instrumento.

test_that(".guess_label_col ignora la columna de idioma vacía y toma la que tiene texto", {
  df <- data.frame(
    list_name = c("lst", "lst"),
    name = c("1", "2"),
    `label::Spanish (ES)` = c(NA_character_, NA_character_),
    label = c("Primera opción", "Segunda opción"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  expect_equal(prosecnurapp:::.guess_label_col(df), "label")
})

test_that(".guess_label_col compara cuánto texto trae cada columna, no si trae alguno", {
  # Caso real de ACNUR V3: la columna del idioma traía 1 valor de 393.
  n <- 20
  df <- data.frame(
    list_name = rep("lst", n),
    name = as.character(seq_len(n)),
    `label::Spanish (ES)` = c("Sobrante", rep(NA_character_, n - 1)),
    label = paste("Opción", seq_len(n)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  expect_equal(prosecnurapp:::.guess_label_col(df), "label")
})

test_that(".guess_label_col respeta la columna de idioma cuando sí trae texto", {
  df <- data.frame(
    list_name = c("lst", "lst"),
    name = c("1", "2"),
    `label::Spanish (ES)` = c("Primera opción", "Segunda opción"),
    label = c(NA_character_, NA_character_),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  expect_equal(prosecnurapp:::.guess_label_col(df), "label::Spanish (ES)")
})

test_that("el catálogo recodificado conserva las etiquetas del instrumento original", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  td <- tempfile("codif_label_col_")
  dir.create(td)
  inst_path <- file.path(td, "instrumento.xlsx")
  data_path <- file.path(td, "data.xlsx")
  tpl_path <- file.path(td, "plantilla.xlsx")
  fam_path <- file.path(td, "familias.xlsx")
  inst_out <- file.path(td, "instrumento_adaptado.xlsx")

  # El instrumento declara la columna del idioma pero la deja vacía.
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(
    wb, "survey",
    data.frame(
      type = c("select_multiple lst_p10", "text"),
      name = c("p10", "p10_other"),
      `label::Spanish (ES)` = c(NA_character_, NA_character_),
      label = c("¿Qué dificultades tuvo?", "¿Cuál otra?"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(
    wb, "choices",
    data.frame(
      list_name = "lst_p10",
      name = c("1", "2", "96"),
      `label::Spanish (ES)` = rep(NA_character_, 3),
      label = c("Tiempos largos de espera", "Costos del proceso", "Otra (especificar)"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  openxlsx::saveWorkbook(wb, inst_path, overwrite = TRUE)

  openxlsx::write.xlsx(
    data.frame(
      `_index` = 1:2,
      p10 = c("1 96", "2"),
      p10_other = c("me pidieron la colegiatura", ""),
      check.names = FALSE
    ),
    data_path,
    overwrite = TRUE
  )

  # La plantilla clasifica la abierta en un código nuevo (3).
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "p10")
  openxlsx::writeData(
    wb, "p10",
    data.frame(
      `_index` = c("Indice", "1", "2"),
      `p10/3_recod` = c("Colegiatura", "1", ""),
      check.names = FALSE
    )
  )
  openxlsx::saveWorkbook(wb, tpl_path, overwrite = TRUE)

  openxlsx::write.xlsx(
    data.frame(parent = "p10", text_col = "p10_other", stringsAsFactors = FALSE),
    fam_path,
    overwrite = TRUE
  )

  out <- ppra_adaptar_data(
    path_instrumento = inst_path,
    path_datos = data_path,
    path_plantilla = tpl_path,
    sm_vars = "p10",
    path_familias = fam_path
  )

  suppressMessages(ppra_adaptar_instrumento(
    path_instrumento_in = inst_path,
    path_data_adaptada = out,
    path_instrumento_out = inst_out,
    path_plantilla = tpl_path,
    sm_vars = "p10"
  ))

  choices <- readxl::read_excel(inst_out, sheet = "choices", .name_repair = "minimal")
  recod <- choices[choices$list_name == "lst_p10_recod", , drop = FALSE]

  etiqueta_de <- function(code) {
    fila <- recod[as.character(recod$name) == code, , drop = FALSE]
    cols <- intersect(c("label", "label::Spanish (ES)"), names(fila))
    vals <- unlist(lapply(cols, function(cc) as.character(fila[[cc]])), use.names = FALSE)
    vals <- vals[!is.na(vals) & nzchar(trimws(vals))]
    if (length(vals)) vals[[1]] else NA_character_
  }

  # Las opciones que ya venían del instrumento conservan su texto…
  expect_equal(etiqueta_de("1"), "Tiempos largos de espera")
  expect_equal(etiqueta_de("2"), "Costos del proceso")
  expect_equal(etiqueta_de("96"), "Otra (especificar)")
  # …y la categoría nueva mantiene la que puso el analista.
  expect_equal(etiqueta_de("3"), "Colegiatura")

  # Ninguna etiqueta puede ser el propio código: eso es el fallback disparándose.
  for (code in as.character(recod$name)) {
    expect_false(identical(etiqueta_de(code), code))
  }
})
