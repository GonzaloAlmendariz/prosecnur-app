# Regresión: reaplicar la codificación sobre un instrumento que YA fue adaptado.
#
# La lista `<x>_recod` es derivada y el adaptador es su único dueño, pero al
# reinyectarla solo se retiraban los códigos que colisionaban. Una categoría
# que en la ronda anterior se numeró 97 y ahora es 6 sobrevivía como fila
# huérfana: quedaba DESPUÉS del 96 (se cuelga al final, fuera del bloque recién
# insertado) y el libro de códigos mostraba la misma etiqueta dos veces con
# códigos distintos.
#
# Medido en ACNUR V3: `HowInfo_recod` salía 1,2,3,4,5,6,96,97 con el 6 y el 97
# rotulados "Entidad pública / trámite migratorio". Los tres síntomas que se
# veían en el entregable (código fantasma, categoría nueva después del especial
# y etiqueta duplicada) eran el mismo residuo.

.reaplicar_instrumento_adaptado <- function(path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(
    wb, "survey",
    data.frame(
      type = c("select_one lst_p7", "text", "select_one lst_p7_recod"),
      name = c("p7", "p7_other", "p7_recod"),
      label = c("¿Cómo se enteró?", "¿Por qué otro medio?", "¿Cómo se enteró?"),
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(
    wb, "choices",
    data.frame(
      list_name = c(rep("lst_p7", 3), rep("lst_p7_recod", 4)),
      name = c("1", "2", "96", "1", "2", "96", "97"),
      label = c("Radio", "Televisión", "Otro (especificar)",
                "Radio", "Televisión", "Otro (especificar)", "Entidad pública"),
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

test_that("reaplicar reescribe el catálogo recodificado y no deja códigos huérfanos", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  td <- tempfile("codif_reaplicar_"); dir.create(td)
  inst_path <- file.path(td, "instrumento_ya_adaptado.xlsx")
  data_path <- file.path(td, "data.xlsx")
  tpl_path  <- file.path(td, "plantilla.xlsx")
  fam_path  <- file.path(td, "familias.xlsx")
  inst_out  <- file.path(td, "instrumento_adaptado.xlsx")

  .reaplicar_instrumento_adaptado(inst_path)

  openxlsx::write.xlsx(
    data.frame(
      `_index` = 1:3,
      p7 = c("1", "96", "2"),
      p7_other = c("", "migraciones", ""),
      check.names = FALSE
    ),
    data_path, overwrite = TRUE
  )

  # Esta ronda clasifica la abierta en el código 3, no en el 97 de la anterior.
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "p7")
  openxlsx::writeData(
    wb, "p7",
    data.frame(
      `_index` = c("Indice", "1", "2", "3"),
      p7_recod = c("Código final", "1", "3", "2"),
      nuevo_codigo = c("Nuevo código", "3", NA, NA),
      nueva_etiqueta = c("Nueva etiqueta", "Entidad pública", NA, NA),
      check.names = FALSE
    )
  )
  openxlsx::saveWorkbook(wb, tpl_path, overwrite = TRUE)

  openxlsx::write.xlsx(
    data.frame(parent = "p7", text_col = "p7_other", stringsAsFactors = FALSE),
    fam_path, overwrite = TRUE
  )

  out <- ppra_adaptar_data(
    path_instrumento = inst_path, path_datos = data_path,
    path_plantilla = tpl_path, so_parent_vars = "p7", path_familias = fam_path
  )
  suppressMessages(ppra_adaptar_instrumento(
    path_instrumento_in = inst_path, path_data_adaptada = out,
    path_instrumento_out = inst_out, path_plantilla = tpl_path,
    so_parent_vars = "p7"
  ))

  choices <- readxl::read_excel(inst_out, sheet = "choices", .name_repair = "minimal")
  recod <- choices[choices$list_name == "lst_p7_recod", , drop = FALSE]
  codes <- as.character(recod$name)

  # El 97 de la ronda anterior no sobrevive: ya no está en la codificación.
  expect_false("97" %in% codes)
  # La categoría nueva va en su posición numérica y el especial cierra la lista.
  expect_equal(codes, c("1", "2", "3", "96"))
  # Y su etiqueta aparece una sola vez en todo el catálogo.
  labs <- as.character(recod$label)
  expect_equal(sum(labs == "Entidad pública", na.rm = TRUE), 1L)
})

test_that("una lista recodificada compartida no se vacía al reusarse", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  # El registro de listas por firma (integer_registry) llama a .add_recoded_q
  # una segunda vez sin códigos para reusar la lista ya creada. Ese camino no
  # debe borrar el catálogo que dejó la primera llamada.
  td <- tempfile("codif_lista_compartida_"); dir.create(td)
  inst_path <- file.path(td, "instrumento.xlsx")
  .reaplicar_instrumento_adaptado(inst_path)
  survey <- readxl::read_excel(inst_path, sheet = "survey", .name_repair = "minimal")
  choices <- readxl::read_excel(inst_path, sheet = "choices", .name_repair = "minimal")
  survey$name <- as.character(survey$name)
  choices$name <- as.character(choices$name)
  choices$list_name <- as.character(choices$list_name)

  res <- prosecnurapp:::.add_recoded_q(
    survey, choices, base_name = "p7", kind = "one",
    list_name_hint = "lst_p7_recod", tokens_from_data = character(0),
    labels_from_data = NULL, lab_col_s = "label", lab_col_c = "label",
    choices_order = "original_first", insert_below_original = FALSE,
    copy_from_original = FALSE
  )
  sobrevive <- as.character(res$choices$name[res$choices$list_name == "lst_p7_recod"])
  expect_equal(sobrevive, c("1", "2", "96", "97"))
})
