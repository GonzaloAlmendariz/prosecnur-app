# Contrato de codificacion_flujo_hibrido.R (unidad 5.7 — grandes sin test dedicado).
#
# El engine híbrido (~4,900 líneas) solo estaba cubierto de rebote por
# test-codificacion-aplicar-data.R (aplicación de plantillas) y las suites de
# pipeline. Aquí se fija el flujo canónico sugerencia → confirmación con una
# fixture mínima, más el lector de instrumentos y el detector repeat:
#
#   1. leer_instrumento_xlsform: columnas auxiliares (q_order, type_base,
#      list_norm) y detección del label en español sin normalizar labels.
#   2. escribir_plantilla_familias (SUGERENCIA): draft xlsx con el esquema
#      canónico de 14 columnas, una fila por variable codificable.
#   3. leer_familias_clasificar (CONFIRMACIÓN): clasificación por tipo,
#      adopciones de text_col, huérfanas, catálogo de choices y resumen.
#   4. Guardia modo_so: select_one con hija adoptada exige padre/hijo.
#   5. codif_detector_repeat: secciones repeat y enlace SO/SM ↔ *_other.
#
# La APLICACIÓN (ppra_adaptar_data / ppra_adaptar_instrumento) ya tiene suite
# propia en test-codificacion-aplicar-data.R; no se duplica aquí.

source("setup-load-all.R")

.cfh_write_xlsform <- function(path, con_repeat = FALSE) {
  base_survey <- data.frame(
    type  = c("select_one lst_srv", "text", "select_multiple lst_temas",
              "text", "text", "integer", "note"),
    name  = c("p1", "p1_other", "p2", "p2_otro", "p3", "edad", "nota_intro"),
    label = c("Service", "Other service", "Topics", "Other topic",
              "Comment", "Age", "Intro"),
    `label::Spanish (es)` = c("Servicio usado", "Otro servicio", "Temas",
                              "Otro tema", "Comentario libre", "Edad",
                              "Introducción"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  if (isTRUE(con_repeat)) {
    base_survey <- rbind(base_survey, data.frame(
      type = c("begin repeat", "text", "end repeat"),
      name = c("rep_hijos", "detalle_hijo", ""),
      label = c("Children", "Child detail", ""),
      `label::Spanish (es)` = c("Hijos", "Detalle del hijo", ""),
      stringsAsFactors = FALSE, check.names = FALSE
    ))
  }
  choices <- data.frame(
    list_name = c("lst_srv", "lst_srv", "lst_temas", "lst_temas", "lst_temas"),
    name = c("1", "96", "1", "2", "96"),
    label = c("Health", "Other", "Water", "Shelter", "Other"),
    `label::Spanish (es)` = c("Salud", "Otro", "Agua", "Refugio", "Otro"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", base_survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.cfh_data <- function() {
  data.frame(
    `_uuid` = paste0("u", 1:4),
    p1 = c("1", "96", "1", "96"),
    p1_other = c("", "farmacia móvil", "", "curandero"),
    p2 = c("1 2", "96", "2", "1 96"),
    `p2/1` = c(1, 0, 0, 1),
    `p2/2` = c(1, 0, 1, 0),
    `p2/96` = c(0, 1, 0, 1),
    p2_otro = c("", "radio comunitaria", "", "megáfono"),
    p3 = c("todo bien", "mejorar techo", "", "más agua"),
    edad = c(23L, 41L, 35L, 29L),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.cfh_inst <- local({
  cache <- NULL
  function() {
    if (is.null(cache)) {
      td <- tempfile("cfh-inst-")
      dir.create(td)
      cache <<- leer_instrumento_xlsform(
        .cfh_write_xlsform(file.path(td, "instrumento.xlsx"))
      )
    }
    cache
  }
})

test_that("leer_instrumento_xlsform: columnas auxiliares y label español detectado sin tocar el crudo", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  inst <- .cfh_inst()

  expect_setequal(names(inst), c("survey_raw", "choices_raw", "survey", "choices"))
  expect_true(all(c("q_order", "type_base", "list_name", "list_norm",
                    "label_spanish_es") %in% names(inst$survey)))
  expect_identical(inst$survey$q_order, seq_len(nrow(inst$survey)))
  expect_identical(inst$survey$type_base[inst$survey$name == "p1"], "select_one")
  expect_identical(inst$survey$list_norm[inst$survey$name == "p2"], "lst_temas")
  expect_identical(inst$survey$label_spanish_es[inst$survey$name == "p1"], "Servicio usado")

  expect_true(all(c("list_norm", "choice_code", "label_spanish_es") %in% names(inst$choices)))
  expect_identical(
    inst$choices$label_spanish_es[inst$choices$list_norm == "lst_srv"],
    c("Salud", "Otro")
  )
  # El crudo se preserva tal cual (sin columnas inyectadas).
  expect_false("list_norm" %in% names(inst$survey_raw))
})

test_that("sugerencia: escribir_plantilla_familias emite el draft canónico de familias", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  inst <- .cfh_inst()
  dat <- .cfh_data()

  fam_path <- tempfile("familias-", fileext = ".xlsx")
  on.exit(unlink(fam_path), add = TRUE)
  escribir_plantilla_familias(inst = inst, dat = list(raw = dat), path = fam_path)

  expect_true(file.exists(fam_path))
  expect_true("familias" %in% readxl::excel_sheets(fam_path))
  fam <- readxl::read_excel(fam_path, sheet = "familias")

  expect_identical(
    names(fam),
    c("use", "q_order", "tipo", "modo_so", "parent", "parent_label", "list_norm",
      "parent_col", "other_dummy_col", "text_col",
      "parent_col_cands", "other_dummy_cands", "text_col_cands", "dummy_cands")
  )
  # Una fila por variable codificable; note fuera; q_order del survey.
  expect_setequal(fam$parent, c("p1", "p1_other", "p2", "p2_otro", "p3", "edad"))
  expect_false("nota_intro" %in% fam$parent)
  expect_identical(fam$tipo[fam$parent == "p2"], "select_multiple")
  expect_identical(fam$tipo[fam$parent == "edad"], "integer")
  expect_identical(fam$parent_label[fam$parent == "p3"], "Comentario libre")
  expect_identical(fam$q_order, sort(fam$q_order))
  expect_true(all(fam$use))
})

test_that("confirmación: leer_familias_clasificar clasifica por tipo con adopciones y huérfanas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  inst <- .cfh_inst()
  dat <- .cfh_data()

  fam_edit <- data.frame(
    use = c(TRUE, TRUE, TRUE, TRUE, FALSE, FALSE),
    q_order = 1:6,
    tipo = c("select_one", "select_multiple", "integer", "text", "text", "text"),
    modo_so = c("hijo", "", "", "", "", ""),
    parent = c("p1", "p2", "edad", "p3", "p1_other", "p2_otro"),
    parent_label = c("Servicio usado", "Temas", "Edad", "Comentario libre",
                     "Otro servicio", "Otro tema"),
    list_norm = c("lst_srv", "lst_temas", "", "", "", ""),
    parent_col = c("p1", "p2", "edad", "p3", "", ""),
    other_dummy_col = c("", "p2/96", "", "", "", ""),
    text_col = c("p1_other", "p2_otro", "", "", "", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  edit_path <- tempfile("familias-edit-", fileext = ".xlsx")
  on.exit(unlink(edit_path), add = TRUE)
  openxlsx::write.xlsx(list(familias = fam_edit), edit_path, overwrite = TRUE)

  cls <- leer_familias_clasificar(edit_path, inst, list(raw = dat), verbose = FALSE)

  expect_true(all(c("familias_filtradas", "select_multiple", "select_one",
                    "integer", "text", "choices_usadas", "adopciones",
                    "textos_huerfanos", "resumen",
                    "diagnostico_clasificacion") %in% names(cls)))

  resumen <- cls$resumen
  expect_identical(resumen$total_filas_excel, 6L)
  expect_identical(resumen$aceptadas_total, 4L)
  expect_identical(resumen$aceptadas_sm, 1L)
  expect_identical(resumen$aceptadas_so, 1L)
  expect_identical(resumen$aceptadas_int, 1L)
  expect_identical(resumen$aceptadas_text, 1L)
  expect_identical(resumen$textos_adoptados, 2L)
  expect_identical(resumen$textos_huerfanos, 1L)

  # Adopciones: las hijas de texto quedan colgadas de su SO/SM.
  expect_setequal(cls$adopciones$text_col, c("p1_other", "p2_otro"))
  expect_identical(
    cls$adopciones$adoptada_por_parent[cls$adopciones$text_col == "p1_other"], "p1"
  )
  # Huérfana: p3 sigue como texto final independiente.
  expect_identical(cls$textos_huerfanos$text_col, "p3")
  expect_identical(cls$text$parent, "p3")

  # Catálogo de choices resuelto por list_norm con label en español.
  ch <- cls$choices_usadas
  expect_identical(
    ch$label_es[ch$parent == "p1" & ch$code == "96"], "Otro"
  )
  expect_setequal(ch$code[ch$parent == "p2"], c("1", "2", "96"))

  # Diagnóstico: cada fila del excel queda explicada.
  diag <- cls$diagnostico_clasificacion
  expect_identical(nrow(diag), 6L)
  expect_setequal(unique(diag$estado_clasificacion), c("aceptada", "excluida"))
})

test_that("guardia modo_so: select_one con hija adoptada sin padre/hijo corta con error claro", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  inst <- .cfh_inst()
  dat <- .cfh_data()

  fam_bad <- data.frame(
    use = TRUE, q_order = 1L, tipo = "select_one", modo_so = "",
    parent = "p1", parent_label = "Servicio usado", list_norm = "lst_srv",
    parent_col = "p1", other_dummy_col = "", text_col = "p1_other",
    stringsAsFactors = FALSE
  )
  bad_path <- tempfile("familias-bad-", fileext = ".xlsx")
  on.exit(unlink(bad_path), add = TRUE)
  openxlsx::write.xlsx(list(familias = fam_bad), bad_path, overwrite = TRUE)

  expect_error(
    leer_familias_clasificar(bad_path, inst, list(raw = dat), verbose = FALSE),
    "modo_so.*padre.*hijo|padre.*hijo"
  )
})

test_that("codif_detector_repeat: secciones repeat y enlace select ↔ texto _other por sección", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  td <- tempfile("cfh-repeat-")
  dir.create(td)
  inst <- leer_instrumento_xlsform(
    .cfh_write_xlsform(file.path(td, "instrumento.xlsx"), con_repeat = TRUE)
  )

  det <- codif_detector_repeat(inst)
  expect_true(all(c("var_name", "type_base", "repeat_section", "is_repeat",
                    "parent_select", "parent_text") %in% names(det)))

  # La fila `end repeat` viene con var_name NA: indexar con which() evita
  # arrastrar NAs en las comparaciones.
  fila <- function(col, var) det[[col]][which(det$var_name == var)]

  # Variables del cuerpo principal viven en "main".
  expect_identical(fila("repeat_section", "p1"), "main")
  expect_false(any(det$is_repeat[which(det$var_name %in% c("p1", "p3", "edad"))]))

  # La sección repeat arrastra a sus hijas.
  expect_identical(fila("repeat_section", "detalle_hijo"), "rep_hijos")
  expect_true(fila("is_repeat", "detalle_hijo"))

  # Enlace por sufijo dentro de la misma sección: p1 ↔ p1_other, p2 ↔ p2_otro.
  expect_identical(fila("parent_text", "p1"), "p1_other")
  expect_identical(fila("parent_select", "p1_other"), "p1")
  expect_identical(fila("parent_text", "p2"), "p2_otro")
  # El texto suelto no se cuelga de ningún select.
  expect_true(is.na(fila("parent_select", "p3")))
})
