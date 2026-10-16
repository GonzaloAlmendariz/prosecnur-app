# Salvaguarda del reparador de `<parent>_recod`: la única ruta que reescribe la
# data del proyecto en su lugar no puede hacer permanente una pérdida de valores.
#
# Medido en HSyVbG 2026: readxl tipaba logical P11_otro/P27_otro (vacías en sus
# primeras 1000 filas), convertía en NA los «Otro» posteriores y el reparador
# escribía el libro así. La causa la corrige `.read_excel_data` (io.R); estos
# tests fijan la defensa en profundidad de project_pulso_recod_salvaguarda.R.

.salvaguarda_xlsx <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (nm in names(sheets)) {
    openxlsx::addWorksheet(wb, nm)
    openxlsx::writeData(wb, nm, sheets[[nm]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Data con valores dispersos por debajo de la fila 1000: el «Otro» de p_area,
# un texto suelto en P27_otro y un número suelto en n_disperso.
.salvaguarda_data_dispersa <- function(n = 1200L) {
  p_area <- rep("1", n)
  p_area_other <- rep(NA_character_, n)
  p_area[c(1100L, 1150L)] <- "99"
  p_area_other[c(1100L, 1150L)] <- c("Sistema", "Sostenibilidad")
  p27 <- rep(NA_character_, n); p27[1180L] <- "Otro texto tardío"
  disperso <- rep(NA_real_, n); disperso[1190L] <- 7
  data.frame(
    id = seq_len(n), p_area = p_area, p_area_other = p_area_other,
    P27_otro = p27, n_disperso = disperso,
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.salvaguarda_session <- function(data_df, parent = "p_area", text_col = "p_area_other",
                                 survey = NULL, choices = NULL, grupos = NULL) {
  sid <- session_create()
  survey <- survey %||% data.frame(
    type = c("select_one lst_p_area", "text", "text", "integer"),
    name = c("p_area", "p_area_other", "P27_otro", "n_disperso"),
    label = c("Area", "Otro area", "Otro P27", "Disperso"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- choices %||% data.frame(
    list_name = rep("lst_p_area", 2), name = c("1", "99"),
    label = c("Operaciones", "Otro"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  xf <- .salvaguarda_xlsx(list(survey = survey, choices = choices))
  df <- .salvaguarda_xlsx(list(data = data_df))
  on.exit(unlink(c(xf, df), force = TRUE), add = TRUE)
  xmeta <- save_upload(sid, "xlsform", "instrumento.xlsx", readBin(xf, "raw", n = file.info(xf)$size))
  dmeta <- save_upload(sid, "data", "data.xlsx", readBin(df, "raw", n = file.info(df)$size))

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$base_activa <- "base_a"
  s$estudio$bases[["base_a"]] <- list(
    nombre = "base_a", xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id, data_ext = "xlsx"
  )
  codif <- list(
    familias_draft = list(rows = list(list(
      use = TRUE, tipo = "select_one", modo_so = "padre",
      parent = parent, parent_col = parent, text_col = text_col,
      parent_label = "Area", list_norm = paste0("lst_", parent)
    )))
  )
  if (!is.null(grupos)) codif$grupos_recod <- stats::setNames(list(grupos), text_col)
  s$codif_por_base <- list(base_a = codif)
  .session_env[[sid]] <- s
  list(sid = sid, data_path = dmeta$path)
}

test_that(".pulso_recod_columnas_que_pierden detecta columnas que pierden o desaparecen", {
  skip_if_not_installed("openxlsx")
  ref <- data.frame(a = c("x", NA, "y"), b = c(NA, NA, "7"), c = c("1", "2", "3"),
                    stringsAsFactors = FALSE)
  path <- .salvaguarda_xlsx(list(data = ref))
  on.exit(unlink(path, force = TRUE), add = TRUE)

  igual_mas_recod <- ref
  igual_mas_recod$a_recod <- c("1", NA, "2")
  expect_length(.pulso_recod_columnas_que_pierden(path, list(data = igual_mas_recod)), 0L)

  perdida <- ref
  perdida$b <- NA
  perdida$c <- NULL
  out <- .pulso_recod_columnas_que_pierden(path, list(data = perdida))
  expect_equal(names(out), "data")
  expect_setequal(out$data, c("b", "c"))

  expect_equal(
    .pulso_recod_columnas_que_pierden(path, list(no_existe = ref))$no_existe,
    "<hoja ilegible>"
  )
})

test_that("el reparador conserva los valores dispersos bajo la fila 1000 al reescribir", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  setup <- .salvaguarda_session(.salvaguarda_data_dispersa())
  on.exit(session_delete(setup$sid), add = TRUE)

  expect_true(.pulso_repair_parent_recod_columns(setup$sid))

  out <- as.data.frame(readxl::read_excel(setup$data_path, sheet = "data", col_types = "text"),
                       stringsAsFactors = FALSE, check.names = FALSE)
  expect_true("p_area_recod" %in% names(out))
  expect_equal(sum(!is.na(out$p_area_other)), 2L)
  expect_equal(out$P27_otro[1180L], "Otro texto tardío")
  expect_equal(out$n_disperso[1190L], "7")
  expect_equal(sum(!is.na(out$n_disperso)), 1L)
})

test_that("(C) si una columna ajena al reparador pierde valores NO se reescribe la data y avisa", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  setup <- .salvaguarda_session(.salvaguarda_data_dispersa())
  on.exit(session_delete(setup$sid), add = TRUE)
  antes <- unname(tools::md5sum(setup$data_path))

  # Reproduce el lector anterior al fix: guess_max por defecto (1000 filas).
  local_mocked_bindings(
    .read_excel_data = function(path, sheet = NULL, ...) {
      suppressWarnings(readxl::read_excel(path, sheet = sheet, ...))
    }
  )
  expect_message(
    .pulso_repair_parent_recod_columns(setup$sid),
    "NO se reescribe .*P27_otro"
  )
  expect_equal(unname(tools::md5sum(setup$data_path)), antes)
})

# Las `<parent>_recod` son DESTINO del reparador: vaciarlas a propósito no es
# pérdida, y bloquear esa reescritura dejaba códigos viejos que Analítica lee.
test_that("(A) un texto pendiente vacía el código viejo de <parent>_recod y SÍ se reescribe", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  survey <- data.frame(
    type = c("select_one lst_p", "text", "select_one lst_p_otro_recod", "select_one lst_p_recod"),
    name = c("p", "p_otro", "p_otro_recod", "p_recod"),
    label = c("P", "Otro P", "Otro P recod", "P recod"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_p", 4), rep("lst_p_recod", 4)),
    name = rep(c("1", "2", "3", "99"), 2),
    label = rep(c("Uno", "Dos", "Tres", "Otro"), 2),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  data_df <- data.frame(
    p = c("1", "3", "99", "2"),
    p_otro = c(NA, NA, "pendiente", NA),
    p_otro_recod = NA_character_,
    p_recod = c("1", "3", "99", "2"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  setup <- .salvaguarda_session(data_df, parent = "p", text_col = "p_otro",
                                survey = survey, choices = choices)
  on.exit(session_delete(setup$sid), add = TRUE)
  antes <- unname(tools::md5sum(setup$data_path))

  expect_no_message(.pulso_repair_parent_recod_columns(setup$sid), message = "NO se reescribe")
  expect_false(identical(unname(tools::md5sum(setup$data_path)), antes))
  out <- as.data.frame(readxl::read_excel(setup$data_path, sheet = "data", col_types = "text"),
                       stringsAsFactors = FALSE, check.names = FALSE)
  expect_equal(out$p_recod, c("1", "3", NA, "2"))
  expect_equal(out$p_otro[3], "pendiente")
})

test_that("(B) un grupo deshecho borra su código de <parent>_recod y SÍ se reescribe", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  survey <- data.frame(
    type = c("select_one lst_p_area", "select_one lst_p_area_recod", "text"),
    name = c("p_area", "p_area_recod", "p_area_other"),
    label = c("Area", "Area recodificada", "Otro area"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_p_area", 3), rep("lst_p_area_recod", 4)),
    name = c("1", "2", "99", "1", "2", "99", "100"),
    label = c("Operaciones", "Direccion", "Otro", "Operaciones", "Direccion", "Otro", "Viejo grupo"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  # La fila 3 tenía el código de un grupo que ya no existe en el plan.
  data_df <- data.frame(
    p_area = c("99", "1", "99", "2"),
    p_area_recod = c("100", "1", "100", "2"),
    p_area_other = c("Sistema", NA, "Ya sin grupo", NA),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  grupos <- list(list(codigo = "100", etiqueta = "Sistema de Gestion",
                      origen = "nuevo", respuestas = list("Sistema")))
  setup <- .salvaguarda_session(data_df, survey = survey, choices = choices, grupos = grupos)
  on.exit(session_delete(setup$sid), add = TRUE)
  antes <- unname(tools::md5sum(setup$data_path))

  expect_no_message(.pulso_repair_parent_recod_columns(setup$sid), message = "NO se reescribe")
  expect_false(identical(unname(tools::md5sum(setup$data_path)), antes))
  out <- as.data.frame(readxl::read_excel(setup$data_path, sheet = "data", col_types = "text"),
                       stringsAsFactors = FALSE, check.names = FALSE)
  expect_true(is.na(out$p_area_recod[3]))
  expect_false(is.na(out$p_area_recod[1]))
  expect_equal(out$p_area_other[3], "Ya sin grupo")
})

test_that(".pulso_recod_columnas_destino lista las <parent>_recod del plan", {
  expect_equal(
    .pulso_recod_columnas_destino(list(list(parent = "p"), list(parent = ""), list(parent = "q"), list(parent = "p"))),
    c("p_recod", "q_recod")
  )
  expect_equal(.pulso_recod_columnas_destino(list()), character(0))
})
