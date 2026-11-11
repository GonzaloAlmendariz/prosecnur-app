# Nombre de los dos archivos que entrega "Aplicar la codificación" (ADR 0133 §2 y §3).
#
# La base se nombra por su fase (cargada, limpia, codificada): el usuario lee
# `<Estudio>_Base_codificada_<fecha>.xlsx` y `<Estudio>_Formulario_codificado_<fecha>.xlsx`.
# Lo que NO cambia son los identificadores: los kinds `data_adaptada` e
# `instrumento_adaptado` siguen siendo la forma de reconocer el par, y por eso un
# proyecto guardado con el nombre anterior se abre y se reconoce igual.

.ecn_fecha <- "[0-9]{2}_[0-9]{2}_[0-9]{2}"

.ecn_sesion <- function(codigo = "acnur_acg", envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = codigo), 0L)
  sid
}

.ecn_archivo <- function(sid, nombre) {
  path <- file.path(session_get(sid)$dir, "downloads", nombre)
  writeBin(as.raw(1:10), path)
  path
}

# Los nombres temporales con que el router escribe el par antes de registrarlo.
.ecn_par_temporal <- function(sid) {
  list(
    data = .ecn_archivo(sid, sprintf("data_adaptada_%s.xlsx", uuid::UUIDgenerate())),
    inst = .ecn_archivo(sid, sprintf("instrumento_adaptado_%s.xlsx", uuid::UUIDgenerate()))
  )
}

test_that("el catálogo rotula el par por su fase y conserva los kinds", {
  expect_identical(.entregable_fila("data_adaptada")$rotulo, "Base codificada")
  expect_identical(.entregable_fila("instrumento_adaptado")$rotulo, "Formulario codificado")
  for (kind in c("data_adaptada", "instrumento_adaptado")) {
    fila <- .entregable_fila(kind)
    expect_true(isTRUE(fila$catalogado), info = kind)
    expect_identical(fila$modulo, "Procesamiento", info = kind)
    expect_true(isTRUE(fila$guardar), info = kind)
  }
  # Ningún rótulo del catálogo le dice "adaptado" al usuario.
  rotulos <- entregables_catalogo()$rotulo
  expect_identical(rotulos[grepl("adaptad", rotulos, ignore.case = TRUE)], character())
})

test_that("los dos archivos de la codificación aplicada se entregan con el nombre nuevo", {
  sid <- .ecn_sesion()
  par <- .ecn_par_temporal(sid)
  data_meta <- .register_output_file(sid, "data_adaptada", par$data)
  inst_meta <- .register_output_file(sid, "instrumento_adaptado", par$inst)

  expect_match(data_meta$original_name, paste0("^acnur_acg_Base_codificada_", .ecn_fecha, "[.]xlsx$"))
  expect_match(inst_meta$original_name, paste0("^acnur_acg_Formulario_codificado_", .ecn_fecha, "[.]xlsx$"))
  for (meta in list(data_meta, inst_meta)) {
    expect_false(grepl("adaptad", meta$original_name, ignore.case = TRUE), info = meta$original_name)
    expect_false(grepl("[0-9a-fA-F-]{36}", meta$original_name), info = meta$original_name)
  }
  # Los identificadores no se tocan: el kind es el de siempre y el rótulo viaja aparte.
  expect_identical(data_meta$kind, "data_adaptada")
  expect_identical(inst_meta$kind, "instrumento_adaptado")
  expect_identical(data_meta$rotulo, "Base codificada")
  expect_identical(inst_meta$rotulo, "Formulario codificado")
  # El nombre que arma el export es el mismo que el del registro.
  expect_identical(.export_filename(sid, "data_adaptada", "xlsx"), data_meta$original_name)
  expect_identical(.export_filename(sid, "instrumento_adaptado", "xlsx"), inst_meta$original_name)
})

test_that("la copia junto al proyecto lleva el nombre nuevo", {
  sid <- .ecn_sesion()
  dir <- tempfile("ecn_proyecto_")
  dir.create(dir)
  withr::defer(unlink(dir, recursive = TRUE))
  session_set(sid, "project_path", file.path(dir, "Estudio.pulso"))
  par <- .ecn_par_temporal(sid)
  data_meta <- .register_output_file(sid, "data_adaptada", par$data)
  inst_meta <- .register_output_file(sid, "instrumento_adaptado", par$inst)

  carpeta <- file.path(dir, "Entregables", "Procesamiento")
  expect_setequal(list.files(carpeta), c(data_meta$original_name, inst_meta$original_name))
  expect_match(basename(data_meta$guardado_en), paste0("^acnur_acg_Base_codificada_", .ecn_fecha, "[.]xlsx$"))
  expect_match(basename(inst_meta$guardado_en), paste0("^acnur_acg_Formulario_codificado_", .ecn_fecha, "[.]xlsx$"))
})

test_that("un par guardado con el nombre anterior se sigue reconociendo", {
  sid <- .ecn_sesion()
  # Como queda en un proyecto guardado antes del cambio: el meta trae el nombre viejo.
  viejo_data <- "acnur_acg_Data_adaptada_10_11_26.xlsx"
  viejo_inst <- "acnur_acg_Instrumento_adaptado_10_11_26.xlsx"
  data_meta <- .register_output_file(sid, "data_adaptada", .ecn_archivo(sid, viejo_data),
                                     original_name = viejo_data, copiar = FALSE)
  inst_meta <- .register_output_file(sid, "instrumento_adaptado", .ecn_archivo(sid, viejo_inst),
                                     original_name = viejo_inst, copiar = FALSE)
  # El registro no renombra lo que ya tiene nombre.
  expect_identical(data_meta$original_name, viejo_data)
  expect_identical(inst_meta$original_name, viejo_inst)

  # El par se reconoce por el kind, no por cómo se llama el archivo.
  s <- session_get(sid)
  s$estudio <- list(bases = list(principal = list(
    xlsform_file_id = inst_meta$file_id, data_file_id = data_meta$file_id
  )))
  expect_true(.codif_base_pair_is_adapted(s, "principal"))
  expect_true("instrumento_adaptado" %in% .XLSFORM_KINDS_INSTRUMENTO_ESTUDIO)

  # Un archivo con la forma del §3 conserva su nombre al registrarse por su ruta,
  # sea el anterior o el nuevo.
  expect_identical(.entregable_nombre_heredado(s, file.path("x", viejo_data)), viejo_data)
  nuevo_data <- "acnur_acg_Base_codificada_10_11_26.xlsx"
  expect_identical(.entregable_nombre_heredado(s, file.path("x", nuevo_data)), nuevo_data)

  # El impreso del formulario quita el código y la fecha del nombre de origen, con
  # el nombre anterior y con el nuevo.
  expect_identical(.xlsform_editor_nombre_formulario(sid, "acnur_acg_Instrumento_adaptado_10_11_26_papel.pdf"),
                   "Instrumento_adaptado")
  expect_identical(.xlsform_editor_nombre_formulario(sid, "acnur_acg_Formulario_codificado_10_11_26_papel.pdf"),
                   "Formulario_codificado")

  # Lo que eso cambia a la vista: si el formulario no declara `form_title`, el título
  # del impreso y el detalle de su nombre salen del nombre del archivo abierto.
  sin_titulo <- data.frame(form_title = "", stringsAsFactors = FALSE)
  esperado <- c(Instrumento_adaptado = "Instrumento adaptado", Formulario_codificado = "Formulario codificado")
  for (stem in names(esperado)) {
    opciones <- .xlsform_editor_export_titulo(list(), sin_titulo, paste0("acnur_acg_", stem, "_10_11_26_papel.pdf"), sid = sid)
    expect_identical(opciones$title, esperado[[stem]], info = stem)
    expect_identical(opciones$footer_title, esperado[[stem]], info = stem)
    expect_match(.export_filename(sid, "formulario_pdf", "pdf", detalle = opciones$title),
                 paste0("^acnur_acg_Cuestionario_", stem, "_", .ecn_fecha, "[.]pdf$"), info = stem)
  }
  # Con `form_title` declarado, el nombre del archivo no interviene.
  con_titulo <- data.frame(form_title = "Encuesta de hogares", stringsAsFactors = FALSE)
  expect_identical(
    .xlsform_editor_export_titulo(list(), con_titulo, "acnur_acg_Formulario_codificado_10_11_26_papel.pdf", sid = sid)$title,
    "Encuesta de hogares"
  )
})
