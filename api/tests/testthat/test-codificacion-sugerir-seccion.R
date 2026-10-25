# TXT-3 (plan-texto-abierto-ccss-2026-10-24, O1b): sugerencia de módulo del
# instrumento para un comentario abierto.
#
# Contrato que fija esta suite:
#   - La sugerencia es una PROPUESTA: el motor no escribe grupos ni matrix_cases.
#   - Códigos por módulo (10, 20, 30… en el orden del formulario) y «otro» = 80.
#   - El vocabulario de cada módulo sale de las etiquetas de sus preguntas y
#     opciones (vía .section_map, con los subgrupos subidos a su módulo).
#   - Un comentario puede recibir más de un módulo (multicode).
#   - Una no respuesta (.txt_no_respuesta) no recibe propuesta.
#   - Cada propuesta trae puntaje y las palabras que la justifican.
#   - El endpoint lee la base pedida, no la primera.

source("setup-load-all.R")

.ss_tmp <- function(ext = ".xlsx") {
  d <- tempfile("codif-sugerir-")
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
  file.path(d, paste0("f", ext))
}

.ss_write_xlsform <- function(path, survey, choices) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Tres módulos con vocabulario propio, un subgrupo dentro del A y el comentario
# final en su propio grupo (que no es un módulo candidato).
.ss_xlsform_tres <- function(path = .ss_tmp()) {
  survey <- data.frame(
    type = c(
      "begin_group", "select_one frec", "begin_group", "text", "end_group", "end_group",
      "begin_group", "select_one acuerdo", "integer", "end_group",
      "begin_group", "select_one acuerdo", "text", "end_group",
      "begin_group", "text", "end_group"
    ),
    name = c(
      "modulo_a", "a1", "bloque_espacios", "a2", NA, NA,
      "modulo_b", "b1", "b2", NA,
      "modulo_c", "c1", "c2", NA,
      "modulo_coment", "coment", NA
    ),
    label = c(
      "Módulo A: Biblioteca y espacios", "¿Con qué frecuencia usa la biblioteca de la facultad?",
      "Espacios", "¿Qué espacios de estudio le faltan?", NA, NA,
      "Módulo B: Docencia", "Los profesores explican con claridad en clase", "¿Cuántos docentes tuvo este ciclo?", NA,
      "Módulo C: Trámites", "Los trámites y pagos de matrícula son sencillos", "¿Qué trámite le costó más?", NA,
      "Comentarios", "¿Algún comentario final?", NA
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("frec", "frec", "acuerdo", "acuerdo"),
    name = c("1", "2", "1", "2"),
    label = c("Nunca", "Siempre", "De acuerdo", "En desacuerdo"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  .ss_write_xlsform(path, survey, choices)
}

.ss_data <- function() {
  data.frame(
    `_uuid` = paste0("u", 1:7),
    coment = c(
      "La biblioteca de sociales necesita más espacios para estudiar",
      "Los profesores dictan clases muy aburridas",
      "Mejorar la biblioteca y que los docentes expliquen mejor",
      "nada",
      "-",
      "El clima de la ciudad es horrible",
      ""
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.ss_resp <- function(out, id) Find(function(r) identical(r$id_caso, id), out$respuestas)
.ss_codigos <- function(r) vapply(r$propuestas, function(p) p$codigo, character(1))

test_that("propone el módulo por el vocabulario de sus preguntas, con códigos por decena y otro=80", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")

  mods <- out$modulos
  expect_equal(vapply(mods, `[[`, "", "seccion"), c("modulo_a", "modulo_b", "modulo_c"))
  expect_equal(vapply(mods, `[[`, "", "codigo"), c("10", "20", "30"))
  expect_equal(mods[[1]]$etiqueta, "Módulo A: Biblioteca y espacios")
  expect_equal(out$otro$codigo, "80")
  # El grupo del propio comentario no es un módulo candidato.
  expect_false("modulo_coment" %in% vapply(mods, `[[`, "", "seccion"))

  r1 <- .ss_resp(out, "u1")
  expect_equal(.ss_codigos(r1), "10")
  # La justificación: palabras del comentario que comparte con el módulo. La
  # del subgrupo (espacios de estudio) sube al módulo A.
  expect_true(all(c("biblioteca", "espacios") %in% r1$propuestas[[1]]$palabras))
  expect_gt(r1$propuestas[[1]]$puntaje, 0)

  expect_equal(.ss_codigos(.ss_resp(out, "u2")), "20")
})

test_that("un comentario que toca dos módulos recibe las dos propuestas (multicode)", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")
  expect_setequal(.ss_codigos(.ss_resp(out, "u3")), c("10", "20"))
})

test_that("una no respuesta no recibe propuesta; un comentario sin vocabulario queda candidato a otro", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")

  nada <- .ss_resp(out, "u4")
  expect_true(nada$no_respuesta)
  expect_length(nada$propuestas, 0L)
  expect_false(nada$candidato_otro)
  expect_true(.ss_resp(out, "u5")$no_respuesta)
  # La celda vacía no es una respuesta: no aparece.
  expect_null(.ss_resp(out, "u7"))

  clima <- .ss_resp(out, "u6")
  expect_false(clima$no_respuesta)
  expect_length(clima$propuestas, 0L)
  expect_true(clima$candidato_otro)

  expect_equal(out$resumen$escribieron, 6L)
  expect_equal(out$resumen$con_contenido, 4L)
  expect_equal(out$resumen$con_propuesta, 3L)
  expect_equal(out$resumen$por_modulo[["10"]], 2L)
  expect_equal(out$resumen$por_modulo[["20"]], 2L)
  expect_equal(out$resumen$por_modulo[["30"]], 0L)
})

test_that("es solo propuesta: el resultado no trae asignaciones y declara que requiere confirmación", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")
  expect_identical(out$estado, "propuesta")
  expect_true(out$requiere_confirmacion)
  expect_null(out$grupos)
  expect_null(out$matrix_cases)
})

test_that("las secciones se pueden pedir explícitamente y una inexistente es un error tipado", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment", secciones = c("modulo_b", "modulo_c"))
  expect_equal(vapply(out$modulos, `[[`, "", "codigo"), c("10", "20"))
  expect_equal(.ss_codigos(.ss_resp(out, "u2")), "10")

  err <- tryCatch(codif_sugerir_seccion(inst, .ss_data(), "coment", secciones = "modulo_z"),
                  error = function(e) e)
  expect_equal(err$code, "E_CODIF_SUGERIR_SECCION_NO_EXISTE")
  err <- tryCatch(codif_sugerir_seccion(inst, .ss_data(), "no_existe"), error = function(e) e)
  expect_equal(err$code, "E_CODIF_SUGERIR_VARIABLE_NO_EXISTE")
  expect_equal(err$status, 404)
})

# ---------------------------------------------------------------------------
# Contrato HTTP in-process: GET /api/codificacion/sugerencias-seccion
# ---------------------------------------------------------------------------

.ss_endpoint <- function() {
  pr <- mount_codificacion(plumber::pr())
  eps <- pr$endpoints[[1]]
  paths <- vapply(eps, function(e) e$path, character(1))
  eps[[which(paths == "/api/codificacion/sugerencias-seccion")[1]]]
}

.ss_add_base <- function(sid, nombre, xls_path, data_df) {
  xls_meta <- save_upload(sid, "xlsform", paste0(nombre, ".xlsx"),
    readBin(xls_path, "raw", n = file.info(xls_path)$size))
  data_path <- .ss_tmp()
  openxlsx::write.xlsx(data_df, data_path, overwrite = TRUE)
  data_meta <- save_upload(sid, "data", paste0(nombre, "_datos.xlsx"),
    readBin(data_path, "raw", n = file.info(data_path)$size))
  inst <- reporte_instrumento(path = xls_meta$path)
  estudio_add_base(
    sid = sid, nombre = nombre,
    xlsform_file_id = xls_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(readxl::read_excel(data_meta$path), instrumento = inst),
    rp_inst = inst, n_filas = nrow(data_df), n_columnas = ncol(data_df)
  )
}

test_that("el endpoint es GET, lee la base pedida (no la primera) y no muta la codificación", {
  ep <- .ss_endpoint()
  expect_equal(ep$verbs, "GET")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  # Base hermana primero, con otro instrumento: si el endpoint cayera en la
  # primera base, los módulos serían los de ella.
  otra_survey <- data.frame(
    type = c("begin_group", "text", "end_group", "begin_group", "text", "end_group"),
    name = c("modulo_x", "x1", NA, "modulo_y", "coment", NA),
    label = c("Módulo X: Transporte", "¿Cómo llega en bus?", NA, "Fin", "Comentario", NA),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  otra_choices <- data.frame(list_name = character(0), name = character(0), label = character(0))
  .ss_add_base(sid, "base_hermana", .ss_write_xlsform(.ss_tmp(), otra_survey, otra_choices),
               data.frame(`_uuid` = "h1", x1 = "bus", coment = "el bus tarda",
                          stringsAsFactors = FALSE, check.names = FALSE))
  .ss_add_base(sid, "base_ccss", .ss_xlsform_tres(), .ss_data())
  primera <- names(session_get(sid)$estudio$bases)[[1]]
  expect_identical(primera, "base_hermana")

  antes <- codif_get(sid, "grupos_recod", source = "base_ccss")
  out <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(),
                      variable = "coment", base = "base_ccss")
  expect_true(isTRUE(out$ok))
  expect_identical(out$base_name, "base_ccss")
  expect_equal(vapply(out$modulos, `[[`, "", "seccion"), c("modulo_a", "modulo_b", "modulo_c"))
  expect_equal(.ss_codigos(.ss_resp(out, "u1")), "10")
  # No escribe nada en la codificación de la base.
  expect_identical(codif_get(sid, "grupos_recod", source = "base_ccss"), antes)

  # `secciones` llega como texto separado por comas desde la query.
  out2 <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(),
                       variable = "coment", base = "base_ccss", secciones = "modulo_b,modulo_c")
  expect_equal(vapply(out2$modulos, `[[`, "", "seccion"), c("modulo_b", "modulo_c"))

  # Sin variable: 400 tipado (wrap_endpoint lo serializa como error API).
  res <- plumber:::PlumberResponse$new()
  err <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = res, base = "base_ccss")
  expect_equal(res$status, 400)
  expect_equal(err$error$code %||% err$code, "E_CODIF_SUGERIR_SIN_VARIABLE")
})
