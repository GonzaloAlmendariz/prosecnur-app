# ADR 0133, hallazgos del QA visual de la fase 5 (2026-11-10).
#
# H5a. El impreso del Editor XLSForm salía con el código y la fecha dos veces:
#      `acnur_acg_Cuestionario_acnur_acg_Instrumento_adaptado_10_11_26_10_11_26.pdf`.
#      El front deriva el nombre del PDF/Word del XLSForm abierto, que ya era un
#      entregable con nombre del §3 (`acnur_acg_Instrumento_adaptado_10_11_26.xlsx`
#      -> `..._papel.pdf`), y el motor usaba ese nombre entero de detalle. Por el
#      largo, la copia a Entregables/ chocaba con el tope de 240 caracteres.
# H5b. Los avisos del motor del impreso salían sin tildes ("Campos de ubicacion",
#      "Numeracion secuencial") y con comillas angulares.
# H8.  Adaptar (Codificación) dejaba en Entregables/Procesamiento/ una tercera
#      copia, la plantilla de codificación, que la respuesta no anuncia: es el
#      transporte interno hacia `ppra_adaptar_*`, no un entregable.

.eia_fecha <- "[0-9]{2}_[0-9]{2}_[0-9]{2}"

.eia_sesion <- function(codigo = "acnur_acg", envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = codigo), 0L)
  sid
}

# Proyecto guardado en una carpeta propia: activa la copia a Entregables/.
.eia_proyecto <- function(sid, envir = parent.frame()) {
  dir <- tempfile("eia_proyecto_")
  dir.create(dir)
  withr::defer(unlink(dir, recursive = TRUE), envir = envir)
  session_set(sid, "project_path", file.path(dir, "Estudio.pulso"))
  dir
}

.eia_req <- function(body, sid) {
  json <- as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))
  list(bodyRaw = charToRaw(enc2utf8(json)), HTTP_X_PULSO_SESSION = sid)
}

.eia_res <- function() {
  env <- new.env()
  env$setHeader <- function(name, value) invisible(NULL)
  env
}

.eia_specs <- function() {
  list(
    pdf = list(ext = "pdf", output_kind = "formulario_pdf", fail_code = "E_PDF_EXPORT_FAILED",
               fail_message = "No pude generar el PDF del formulario"),
    docx = list(ext = "docx", output_kind = "formulario_word", fail_code = "E_WORD_EXPORT_FAILED",
                fail_message = "No pude generar el Word del formulario"),
    visor = list(ext = "docx", output_kind = "formulario_word", registro_kind = "formulario_word_visor",
                 fail_code = "E_WORD_EXPORT_FAILED", fail_message = "No pude generar el Word del formulario")
  )
}

# El formulario abierto no declara form_title: el título sale del nombre del archivo.
.eia_body <- function(filename) {
  sheet <- function(columns, rows) list(columns = columns, rows = rows)
  list(
    filename = filename,
    workbook = list(
      survey = sheet(c("type", "name", "label"), list(c("text", "p1", "Nombre"))),
      choices = sheet(c("list_name", "name", "label"), list()),
      settings = sheet(c("form_title", "form_id"), list(c("", "f1")))
    )
  )
}

# Pasa el request por el handler real con el submit interceptado.
.eia_encolar <- function(body, spec, sid) {
  cap <- new.env()
  testthat::local_mocked_bindings(
    job_submit = function(sid, kind, func, args, result_filename, on_complete, on_cleanup, ...) {
      cap$args <- args
      cap$result_filename <- result_filename
      cap$on_complete <- on_complete
      "job-falso"
    }
  )
  .xlsform_editor_export_formulario(.eia_req(body, sid), .eia_res(), spec)
  cap$payload <- readRDS(cap$args$input_path)
  cap
}

# ---- H5a ---------------------------------------------------------------------

test_that("H5a: el impreso de un XLSForm con nombre del §3 no repite el código ni la fecha", {
  sid <- .eia_sesion()
  # Lo que manda el front para el instrumento adaptado (XlsformEditorPage.tsx,
  # pdfFilenameFromSource/wordFilenameFromSource sobre cleanFilename).
  for (spec_nombre in names(.eia_specs())) {
    spec <- .eia_specs()[[spec_nombre]]
    filename <- paste0("acnur_acg_Instrumento_adaptado_10_11_26_papel.", spec$ext)
    cap <- .eia_encolar(.eia_body(filename), spec, sid)
    nombre <- cap$result_filename
    rotulo <- if (identical(spec_nombre, "visor")) "Vista_previa_del_cuestionario" else "Cuestionario"
    expect_match(nombre, paste0("^acnur_acg_", rotulo, "_Instrumento_adaptado_", .eia_fecha, "[.]", spec$ext, "$"),
                 info = spec_nombre)
    expect_identical(lengths(regmatches(nombre, gregexpr("acnur_acg", nombre, fixed = TRUE))), 1L, info = nombre)
    expect_identical(lengths(regmatches(nombre, gregexpr(.eia_fecha, nombre))), 1L, info = nombre)
    # El título impreso tampoco lleva el código ni la fecha del archivo de origen.
    expect_identical(cap$payload$options$title, "Instrumento adaptado", info = spec_nombre)
    expect_identical(cap$payload$options$footer_title, "Instrumento adaptado", info = spec_nombre)
  }
})

test_that("H5a: un nombre que no tiene la forma del §3 sigue dando el detalle de siempre", {
  sid <- .eia_sesion()
  cap <- .eia_encolar(.eia_body("egresados_v3_editado_papel.pdf"), .eia_specs()$pdf, sid)
  expect_match(cap$result_filename, paste0("^acnur_acg_Cuestionario_egresados_v3_", .eia_fecha, "[.]pdf$"))
  expect_identical(cap$payload$options$title, "egresados v3")

  # Otro estudio en el nombre: no se reconoce como propio y no se le quita nada.
  cap <- .eia_encolar(.eia_body("OTRO_Instrumento_adaptado_10_11_26_papel.pdf"), .eia_specs()$pdf, sid)
  expect_match(cap$result_filename, "^acnur_acg_Cuestionario_OTRO_Instrumento_adaptado_10_11_26_")
})

test_that("H5a: el impreso registrado se copia a Entregables/Formularios con el nombre corto", {
  sid <- .eia_sesion()
  dir <- .eia_proyecto(sid)
  cap <- .eia_encolar(.eia_body("acnur_acg_Instrumento_adaptado_10_11_26_papel.pdf"), .eia_specs()$pdf, sid)
  result_path <- tempfile(fileext = ".pdf")
  worker <- do.call(xlsform_editor_export_job_runner, c(cap$args, list(result_path = result_path)))
  pub <- cap$on_complete(list(result_data = worker, result_path = result_path))
  expect_true(isTRUE(pub$ok))
  expect_identical(pub$original_name, cap$result_filename)
  expect_true(is.na(pub$aviso_guardado), info = pub$aviso_guardado)
  expect_identical(basename(pub$guardado_en), cap$result_filename)
  expect_true(file.exists(file.path(dir, "Entregables", "Formularios", cap$result_filename)))
})

# ---- H5b ---------------------------------------------------------------------

# Instrumento que dispara los avisos del motor del impreso: opción `columns`
# inválida, geopunto, número de cuestionario, numeración secuencial, condición
# técnica, cálculo sin rótulo, categoría sin rótulo y pregunta sin rótulo.
.eia_modelo_con_avisos <- function() {
  sv <- data.frame(
    type = c("integer", "geopoint", "calculate", "select_one sn", "text", "integer", "text"),
    name = c("n_cuestionario", "gps", "calc1", "p1", "p2", "censo_2025", "p3"),
    label = c("N.º de cuestionario", "", "", "¿Trabaja?", "", "Población", "Tres"),
    calculation = c("", "", "1+1", "", "", "", ""),
    relevant = c("", "", "", "${no_existe} = '1'", "", "${calc1} > 1", ""),
    stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "sn", name = c("1", "2", "3"), label = c("Sí", "No", ""),
                   stringsAsFactors = FALSE)
  formulario_pdf_build_model(sv, ch, list(form_title = "N"), options = list(columns = "7"))
}

.eia_sin_tilde <- c("Numeracion", "numeracion", "ubicacion", "numero", "numeros", "rotulo", "Categorias",
                    "Categoria", "codigo", "Opcion", "recibio", "validos", "saldran", "vacia", "vacio",
                    "tecnicas", "calculos", "calculo", "daria", "habria")

.eia_expect_castellano <- function(avisos) {
  for (palabra in .eia_sin_tilde) {
    hits <- avisos[grepl(paste0("\\b", palabra, "\\b"), avisos)]
    expect_length(hits, 0L)
    if (length(hits)) testthat::fail(sprintf("\"%s\" sin tilde en: %s", palabra, hits[1]))
  }
  expect_false(any(grepl("[«»]", avisos)), info = paste(avisos, collapse = "\n"))
  expect_true(all(validUTF8(avisos)))
}

test_that("H5b: los avisos del impreso van en castellano con tildes y comillas rectas", {
  m <- .eia_modelo_con_avisos()
  avisos <- m$warnings
  # Que cada aviso esperado exista: sin esto, un aviso que desaparece daría verde.
  esperados <- c(
    "Opción `columns` no reconocida: se recibió \"7\"",
    "Campos de ubicación que no tienen lugar en el papel",
    "El número de cuestionario (n_cuestionario)",
    "Numeración secuencial: no se usa la de los nombres de variable",
    "Condiciones técnicas que el papel asume cumplidas",
    "dependen de cálculos sin rótulo (calc1)",
    "Categorías sin rótulo (saldrán como celda vacía en el papel)",
    "código `3`",
    "Preguntas sin rótulo en el instrumento (salen con su número"
  )
  for (e in esperados) expect_true(any(grepl(e, avisos, fixed = TRUE)), info = e)
  .eia_expect_castellano(avisos)
})

test_that("H5b: los motivos de la numeración secuencial también llevan tilde", {
  # Faltan números en la secuencia derivada (p1, p2, p9).
  sv2 <- data.frame(type = rep("text", 3), name = c("p1", "p2", "p9"), label = c("a", "b", "c"),
                    stringsAsFactors = FALSE)
  m2 <- formulario_pdf_build_model(sv2, data.frame(list_name = character(), name = character(),
                                                   label = character()), list(form_title = "N"))
  expect_true(any(grepl("Numeración", m2$warnings, fixed = TRUE)), info = paste(m2$warnings, collapse = "\n"))
  .eia_expect_castellano(m2$warnings)

  # Texto tomado de otro idioma porque el idioma por defecto lo deja vacío.
  sv3 <- data.frame(type = "text", name = "p1", `label::Español (es)` = "", `label::English (en)` = "Name",
                    check.names = FALSE, stringsAsFactors = FALSE)
  m3 <- formulario_pdf_build_model(sv3, data.frame(list_name = character(), name = character(),
                                                   label = character()),
                                   list(form_title = "N", default_language = "Español (es)"))
  .eia_expect_castellano(m3$warnings)
})

test_that("H5b: las tildes de los avisos llegan intactas desde un worker callr real", {
  skip_if_not_installed("callr")
  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  # El worker carga este árbol con load_all (no el paquete instalado) bajo el
  # bootstrap UTF-8 de jobs.R.
  Sys.setenv(PULSO_API_DIR = normalizePath(test_path("..", ".."), mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)

  sid <- .eia_sesion()
  body <- .eia_body("acnur_acg_Instrumento_adaptado_10_11_26_papel.pdf")
  body$workbook$survey <- list(columns = c("type", "name", "label"),
                               rows = list(c("geopoint", "gps", ""), c("text", "p1", "Nombre")))
  arranque <- .xlsform_editor_export_formulario(.eia_req(body, sid), .eia_res(), .eia_specs()$pdf)
  deadline <- Sys.time() + 180
  repeat {
    job <- job_poll(arranque$job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El job del impreso no terminó a tiempo.")
    Sys.sleep(0.5)
  }
  expect_identical(job$status, "done")
  # Lo que lee el front: el objeto que devuelve on_complete en el proceso principal.
  pub <- job$result_public
  expect_true(isTRUE(pub$ok), info = paste(unlist(pub$error), collapse = " "))
  avisos <- as.character(unlist(pub$warnings))
  expect_true(any(grepl("Campos de ubicación que no tienen lugar en el papel", avisos, fixed = TRUE)),
              info = paste(avisos, collapse = "\n"))
  .eia_expect_castellano(avisos)
  expect_match(pub$original_name, paste0("^acnur_acg_Cuestionario_Instrumento_adaptado_", .eia_fecha, "[.]pdf$"))
})

# ---- H8 ----------------------------------------------------------------------

test_that("H8: adaptar copia a Entregables/Procesamiento sólo los dos archivos que anuncia", {
  skip_if_not_installed("openxlsx")
  sid <- .eia_sesion("HSVG2026")
  dir <- .eia_proyecto(sid)
  .bv_add_base(sid, "2026", .bv_inst_2026(), .bv_xlsx_bytes(list(data = .bv_data_2026())),
               "data_2026.xlsx", "xlsx")
  estudio_active_base_set(sid, "2026")

  cap <- new.env()
  testthat::local_mocked_bindings(
    job_submit = function(sid, kind, func, args, on_complete, ...) {
      cap$func <- func; cap$args <- args; cap$on_complete <- on_complete
      "job-falso"
    }
  )
  arranque <- .bv_call(mount_codificacion, "POST", "/api/codificacion/aplicar", sid)
  expect_true(isTRUE(arranque$ok), info = paste(unlist(arranque$error), collapse = " "))

  carpeta <- file.path(dir, "Entregables", "Procesamiento")
  # Al lanzar el job, la plantilla de transporte ya está registrada, pero sin copia.
  plantilla <- session_get(sid)$files[[codif_get(sid, "plantilla_codigos_file_id", source = "2026")]]
  expect_identical(plantilla$kind, "plantilla_codif_template")
  expect_null(plantilla$guardado_en)
  expect_length(list.files(carpeta), 0L)

  # El runner en proceso y el on_complete del job, como al terminar el worker.
  result <- do.call(cap$func, cap$args)
  respuesta <- cap$on_complete(list(sid = sid, result_data = result))
  anunciados <- c(respuesta$data_adaptada$guardado_en, respuesta$instrumento_adaptado$guardado_en)
  expect_length(anunciados, 2L)
  expect_setequal(list.files(carpeta), basename(anunciados))
  expect_false(any(grepl("Plantilla", list.files(carpeta))))
})

test_that("H8: el reaplicar por SurveyMonkey tampoco copia la plantilla de transporte", {
  skip_if_not_installed("openxlsx")
  sid <- .eia_sesion("HSVG2026")
  dir <- .eia_proyecto(sid)
  .bv_add_base(sid, "2026", .bv_inst_2026(), .bv_xlsx_bytes(list(data = .bv_data_2026())),
               "data_2026.xlsx", "xlsx")
  testthat::local_mocked_bindings(job_submit = function(...) "job-falso")
  .codif_start_apply_job(sid, base_name = "2026", kind = "codificacion.reaplicar_surveymonkey")
  plantilla <- session_get(sid)$files[[codif_get(sid, "plantilla_codigos_file_id", source = "2026")]]
  expect_identical(plantilla$kind, "plantilla_codif_template")
  expect_null(plantilla$guardado_en)
  expect_length(list.files(file.path(dir, "Entregables", "Procesamiento")), 0L)
})
