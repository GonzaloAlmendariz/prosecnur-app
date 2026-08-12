# Regresiones de apertura de la sección Codificación.
#
# Los dos caminos por los que la sección dejaba de montar, ambos visibles al
# pedir GET /api/codificacion/preguntas-abiertas, que es lo primero que carga
# la vista:
#
#   - .section_map: XLSForm cuya columna de etiqueta preferida viene 100%
#     vacía -> 500 E_INTERNAL "missing value where TRUE/FALSE needed"
#   - codif_xlsform_path / codif_data_meta: proyecto sin estudio multibase
#     -> 409 E_NO_XLSFORM / E_NO_DATA con el par perfectamente cargado

source("setup-load-all.R")

.ap_write_xlsform <- function(path, label_cols) {
  # `label_cols` declara qué columnas de etiqueta escribir y con qué contenido.
  # Un NA_character_ escalar produce la columna entera vacía.
  survey <- data.frame(
    type = c("begin_group", "text", "end_group"),
    name = c("seccion_a", "p_abierta", NA),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  for (col in names(label_cols)) survey[[col]] <- label_cols[[col]]
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(0), name = character(0), label = character(0),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.ap_tmp <- function(ext = ".xlsx") {
  d <- tempfile("codif-apertura-")
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
  file.path(d, paste0("f", ext))
}

test_that("section_map tolera que la columna de etiqueta preferida venga vacía", {
  # El instrumento de un estudio real traía `label::Spanish (ES)` sin una sola
  # celda con texto y las etiquetas de verdad en `label`. La heurística prefiere
  # la columna del idioma, `all(NA == "")` devuelve NA y el `if` que decide usar
  # el fallback abortaba antes de poder usarlo.
  path <- .ap_write_xlsform(.ap_tmp(), list(
    `label::Spanish (ES)` = NA_character_,
    label = c("Sección A", "¿Qué opina?", NA)
  ))
  inst <- leer_instrumento_xlsform(path)

  mapa <- expect_no_error(.section_map(inst))

  # No basta con no reventar: el fallback tiene que haber elegido `label`.
  expect_equal(mapa$section_label[which(mapa$name == "p_abierta")], "Sección A")
})

test_that("section_map conserva el idioma preferido cuando sí trae texto", {
  path <- .ap_write_xlsform(.ap_tmp(), list(
    `label::Spanish (ES)` = c("Sección en español", "¿Qué opina?", NA),
    label = c("Section A", "What do you think?", NA)
  ))
  inst <- leer_instrumento_xlsform(path)

  mapa <- .section_map(inst)

  expect_equal(mapa$section_label[which(mapa$name == "p_abierta")], "Sección en español")
})

test_that("el par de codificación se resuelve en proyectos sin estudio multibase", {
  # Flujo clásico: un formulario y una base subidos en Carga, sin armar estudio.
  # `codif_source_active()` cae a su literal "default", que nunca es el nombre de
  # una base, y los resolvedores devolvían NULL: la sección entera respondía 409
  # aunque el par estuviera cargado.
  sid <- session_create()

  xls_path <- .ap_write_xlsform(.ap_tmp(), list(label = c("Sección A", "¿Qué opina?", NA)))
  xls_meta <- save_upload(sid, "xlsform", "instrumento.xlsx",
    readBin(xls_path, "raw", n = file.info(xls_path)$size))

  data_path <- .ap_tmp()
  openxlsx::write.xlsx(
    data.frame(`_uuid` = "u1", p_abierta = "una respuesta",
               stringsAsFactors = FALSE, check.names = FALSE),
    data_path, overwrite = TRUE
  )
  data_meta <- save_upload(sid, "data", "datos.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size))

  expect_null(session_get(sid)$estudio)
  expect_identical(codif_source_active(sid), "default")

  expect_identical(codif_xlsform_path(sid), xls_meta$path)
  expect_identical(codif_data_meta(sid)$file_id, data_meta$file_id)

  # El efecto que importa: lo que monta la vista deja de cortar con 409.
  expect_no_error(codif_inst_cached(sid))
  expect_no_error(codif_data_cached(sid))
})

test_that("con estudio multibase no se adivina el par de una base inexistente", {
  # El fallback es solo para el flujo clásico. Con estudio presente, resolver una
  # base que no está devolviendo el archivo de otra mezclaría datos entre bases.
  sid <- session_create()

  xls_path <- .ap_write_xlsform(.ap_tmp(), list(label = c("Sección A", "¿Qué opina?", NA)))
  xls_meta <- save_upload(sid, "xlsform", "instrumento.xlsx",
    readBin(xls_path, "raw", n = file.info(xls_path)$size))
  data_path <- .ap_tmp()
  openxlsx::write.xlsx(
    data.frame(`_uuid` = "u1", p_abierta = "x",
               stringsAsFactors = FALSE, check.names = FALSE),
    data_path, overwrite = TRUE
  )
  data_meta <- save_upload(sid, "data", "datos.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size))

  inst <- reporte_instrumento(path = xls_meta$path)
  estudio_add_base(
    sid = sid, nombre = "base_madre",
    xlsform_file_id = xls_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(readxl::read_excel(data_meta$path), instrumento = inst),
    rp_inst = inst, n_filas = 1L, n_columnas = 2L
  )

  expect_identical(codif_xlsform_path(sid, "base_madre"), xls_meta$path)
  expect_null(codif_xlsform_path(sid, "base_que_no_existe"))
  expect_null(codif_data_meta(sid, "base_que_no_existe"))
})
