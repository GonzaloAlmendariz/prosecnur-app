# Contrato de router_analitica.R (unidad 5.7 — grandes sin test dedicado).
#
# router_analitica.R (~4,900 líneas) solo tenía cobertura indirecta vía las
# suites test-analitica-* (multibase, fuente por base, panel, bases). Esta
# suite fija el contrato de los helpers de FRONTERA que todos los endpoints
# comparten, in-process (session_create + helpers privados, sin plumber):
#
#   - .analitica_fuentes: resolución adaptados/originales + error E_NO_XLSFORM
#   - .analitica_scope_bases: scoping por base activa + E_ACTIVE_BASE_MISSING
#   - .analitica_read_data_file: E_UNSUPPORTED_EXT en extensión desconocida
#   - .analitica_filter_data_to_inst / .analitica_type_base: qué columnas
#     entran al reporte (estructurales fuera, extras dentro, Pag*/nota_* fuera)
#   - .analitica_scalar: coerción defensiva de payloads JSON
#
# No duplica test-analitica-fuente-por-base.R (que cubre el par POR BASE en
# estudios multibase con codificación real); aquí el foco es el contrato
# global de sesión única y los errores E_*.

source("setup-load-all.R")

.ra_write_xlsform <- function(path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("text", "integer"),
    name = c("p1", "edad"),
    label = c("Comentario", "Edad"),
    stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(0), name = character(0), label = character(0)
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.ra_session_with_base <- function() {
  td <- tempfile("router-analitica-")
  dir.create(td)
  inst_path <- .ra_write_xlsform(file.path(td, "inst.xlsx"))
  data_path <- file.path(td, "data.xlsx")
  openxlsx::write.xlsx(
    data.frame(p1 = c("a", "b"), edad = c(31L, 44L), stringsAsFactors = FALSE),
    data_path, overwrite = TRUE
  )
  sid <- session_create()
  inst_meta <- save_upload(sid, "xlsform", "inst.xlsx",
    readBin(inst_path, "raw", n = file.info(inst_path)$size))
  data_meta <- save_upload(sid, "data", "data.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size))
  list(sid = sid, dir = td, inst = inst_meta, data = data_meta,
       inst_path = inst_path, data_path = data_path)
}

test_that("fuentes: sin XLSForm cargado el contrato es api_error E_NO_XLSFORM 409", {
  sid <- session_create()
  err <- tryCatch(.analitica_fuentes(sid), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_NO_XLSFORM")
  expect_identical(err$status, 409)
})

test_that("fuentes: sin codificación aplicada resuelve originales aunque se prefieran adaptados", {
  skip_if_not_installed("openxlsx")
  fx <- .ra_session_with_base()

  fu <- .analitica_fuentes(fx$sid)
  expect_identical(fu$fuente, "originales")
  expect_identical(fu$data_meta$file_id, fx$data$file_id)
  expect_identical(fu$inst_path, fx$inst$path)
})

test_that("fuentes: con codificación aplicada gana adaptados y fuente_preferida=originales la revierte", {
  skip_if_not_installed("openxlsx")
  fx <- .ra_session_with_base()
  sid <- fx$sid

  # Registrar artefactos adaptados por la misma frontera que usa el router
  # de codificación (.register_output_file no valida kinds de upload).
  s <- session_get(sid)
  ad_inst_path <- file.path(s$dir, "downloads", "inst_adaptado.xlsx")
  ad_data_path <- file.path(s$dir, "downloads", "data_adaptada.xlsx")
  file.copy(fx$inst_path, ad_inst_path)
  file.copy(fx$data_path, ad_data_path)
  ad_inst <- .register_output_file(sid, "instrumento_adaptado", ad_inst_path)
  ad_data <- .register_output_file(sid, "data_adaptada", ad_data_path)
  session_set(sid, "codif_aplicado", TRUE)
  session_set(sid, "codif_inst_adaptado_fid", ad_inst$file_id)
  session_set(sid, "codif_data_adaptada_fid", ad_data$file_id)

  fu <- .analitica_fuentes(sid)
  expect_identical(fu$fuente, "adaptados")
  expect_identical(fu$data_meta$file_id, ad_data$file_id)

  # Preferencia explícita del analista manda sobre lo adaptado.
  fu_orig <- .analitica_fuentes(sid, cfg = list(fuente_preferida = "originales"))
  expect_identical(fu_orig$fuente, "originales")
  expect_identical(fu_orig$data_meta$file_id, fx$data$file_id)

  # "auto" es legacy y equivale a adaptados-si-existen.
  fu_auto <- .analitica_fuentes(sid, cfg = list(fuente_preferida = "auto"))
  expect_identical(fu_auto$fuente, "adaptados")
})

test_that("scope_bases: multibase pasa intacto; independent_siblings scopea a la activa o falla E_ACTIVE_BASE_MISSING", {
  sid <- session_create()
  bases <- list(a = list(nombre = "a"), b = list(nombre = "b"))

  # Sin estudio (modo multibase por default): passthrough.
  expect_identical(.analitica_scope_bases(sid, bases), bases)

  session_set(sid, "estudio", list(
    bases = list(a = list(nombre = "a")),
    processing_mode = "independent_siblings",
    active_base = "a"
  ))

  scoped <- .analitica_scope_bases(sid, bases)
  expect_identical(names(scoped), "a")
  expect_length(scoped, 1L)

  err <- tryCatch(
    .analitica_scope_bases(sid, list(b = list(nombre = "b"))),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_ACTIVE_BASE_MISSING")
  expect_identical(err$status, 409)
})

test_that("read_data_file: extensión desconocida corta con E_UNSUPPORTED_EXT 400", {
  err <- tryCatch(
    .analitica_read_data_file(list(ext = "parquet", path = "x.parquet")),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_UNSUPPORTED_EXT")
  expect_identical(err$status, 400)
})

test_that("filter_data_to_inst: descarta estructurales y ruido Pag*/nota_*, conserva variables y extras", {
  rp_inst <- list(survey = data.frame(
    name = c("p1", "nota_x", "grp"),
    type = c("select_one lst", "note", "begin_group"),
    stringsAsFactors = FALSE
  ))
  dd <- data.frame(
    p1 = 1, nota_x = "x", grp = "g", extra = 2, Pag1 = 1, nota_libre = "y",
    check.names = FALSE
  )

  out <- .analitica_filter_data_to_inst(dd, rp_inst)
  expect_identical(names(out), c("p1", "extra"))

  # El type base ignora el list_name y tolera NA/NULL.
  expect_identical(.analitica_type_base("select_one lst"), "select_one")
  expect_identical(.analitica_type_base(NULL), "")
  expect_identical(.analitica_type_base(NA_character_), "")

  # Sin instrumento útil no hay variables declaradas, pero el filtro de
  # ruido (Pag*/nota_*) aplica igual sobre las columnas extra.
  sin_inst <- .analitica_filter_data_to_inst(dd, list(survey = NULL))
  expect_identical(names(sin_inst), c("p1", "grp", "extra"))
})

test_that("analitica_scalar: coerción defensiva de payloads (NULL, vacío, NA, vector)", {
  expect_identical(.analitica_scalar(NULL, "fb"), "fb")
  expect_identical(.analitica_scalar(character(0), "fb"), "fb")
  expect_identical(.analitica_scalar(NA, "fb"), "fb")
  expect_identical(.analitica_scalar("", "fb"), "fb")
  expect_identical(.analitica_scalar(c("x", "y")), "x")
  expect_identical(.analitica_scalar(7L), "7")
})
