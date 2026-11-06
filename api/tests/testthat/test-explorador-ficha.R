# E10/E11 del revamp del explorador (docs/qa/checklist-explorador-variables-2026-11-02.md): la ficha de una pregunta.
# Motor `explorador_ficha()` y su ruta GET /api/validacion/v2/explorar/ficha por `pr$call` en proceso (sin puerto):
# forma exacta del contrato, nulos como `null`, error tipado de variable inexistente y la base que pide X-Base-Nombre
# (no la primera).

.efi_inst <- function() {
  survey <- data.frame(
    type = c("begin_group", "select_one", "select_one", "select_multiple", "text", "integer", "date", "text", "end_group"),
    list_name = c(NA, "sexo", "likert", "medios", NA, NA, NA, NA, NA),
    name = c("g_datos", "sexo", "satis", "medios", "medios_otro", "edad", "fecha", "comentario", NA),
    label = c("Datos del caso", "Sexo del entrevistado", "Satisfacción con el servicio", "Medios por los que se enteró",
              "Otro medio, especifique", "Edad", "Fecha de la entrevista", "Comentario final", NA),
    hint = c(NA, NA, "Lea las opciones", NA, NA, "En años cumplidos", NA, NA, NA),
    relevant = c(NA, NA, NA, NA, "selected(${medios}, 'otro')", NA, NA, NA, NA),
    constraint = c(NA, NA, NA, NA, NA, ". >= 18 and . <= 99", NA, NA, NA),
    constraint_message = c(NA, NA, NA, NA, NA, "Edad entre 18 y 99", NA, NA, NA),
    required = c(NA, "yes", NA, NA, NA, "yes", NA, NA, NA),
    choice_filter = c(NA, NA, NA, NA, NA, NA, NA, NA, NA),
    appearance = c("field-list", NA, "likert", "minimal", NA, NA, NA, "multiline", NA),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sexo", "sexo", rep("likert", 4), rep("medios", 4)),
    name = c("1", "2", "1", "2", "3", "4", "tv", "radio", "web", "otro"),
    label = c("Hombre", "Mujer", "Nada satisfecho", "Poco satisfecho", "Algo satisfecho", "Muy satisfecho",
              "Televisión", "Radio", "Internet", "Otro"),
    stringsAsFactors = FALSE
  )
  list(survey = survey, choices = choices, settings = data.frame(form_id = "fx", version = "2026-11-01"))
}

.efi_data <- function() {
  data.frame(
    id = sprintf("R%02d", 1:12),
    sexo = c("1", "2", "1", "2", "1", "2", "1", "2", "9", NA, "1", "2"),
    satis = c("1", "2", "3", "4", "4", "3", "2", "4", "3", NA, "4", "1"),
    medios.tv = c(1, 0, 1, 1, 0, 0, 1, 0, 1, NA, 1, 0),
    medios.radio = c(0, 1, 1, 0, 0, 1, 0, 0, 0, NA, 0, 1),
    medios.web = c(0, 0, 0, 1, 1, 0, 1, 1, 0, NA, 0, 0),
    medios.otro = c(0, 0, 0, 0, 1, 1, 0, 0, 0, NA, 0, 0),
    medios.cine = c(0, 0, 0, 0, 0, 0, 0, 0, 0, NA, 0, 1),
    medios_otro = c(NA, NA, NA, NA, "Afiche", "afiche ", NA, NA, NA, NA, NA, NA),
    edad = c(25, 31, 47, 52, 19, 33, 61, 28, 40, NA, 150, 36),
    fecha = c("2026-10-01", "2026-10-01", "2026-10-02", "2026-10-02", "2026-10-02", "2026-10-03",
              "2026-10-03", "2026-10-04", "2026-10-04", NA, "2026-10-05", "2026-10-05"),
    comentario = c("Muy bueno", "muy buéno", "Regular", NA, "", "Excelente", "Regular", "Lento", "Muy bueno",
                   NA, "Bien", "Excelente"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.efi_claves <- c("ok", "var", "label", "hint", "tipo", "tipo_xlsform", "lista", "grupo", "relevant", "constraint",
                 "constraint_message", "required", "choice_filter", "appearance", "abre", "version_formulario",
                 "opciones", "datos")

.efi_json <- function(x) jsonlite::fromJSON(
  as.character(jsonlite::toJSON(x, auto_unbox = TRUE, na = "null", digits = NA)), simplifyVector = FALSE
)

test_that("la ficha de una select_multiple trae la forma exacta del contrato y lo que se ve en los datos", {
  f <- explorador_ficha(.efi_data(), "medios", .efi_inst())
  expect_identical(names(f), .efi_claves)
  expect_identical(f$tipo, "sm")
  expect_identical(f$tipo_xlsform, "select_multiple")
  expect_identical(f$lista, "medios")
  expect_identical(f$grupo, list(name = "g_datos", label = "Datos del caso"))
  expect_identical(f$appearance, "minimal")
  expect_identical(f$required, FALSE)
  expect_identical(f$version_formulario, "2026-11-01")
  expect_identical(f$abre, list(list(var = "medios_otro", label = "Otro medio, especifique")))
  # Opciones de la lista, en su orden y con lo marcado; «cine» no está en la lista y no se ofrece como opción.
  expect_identical(vapply(f$opciones, `[[`, "", "codigo"), c("tv", "radio", "web", "otro"))
  expect_identical(vapply(f$opciones, `[[`, 1L, "n"), c(6L, 4L, 4L, 2L))
  expect_identical(names(f$datos), c("n_total", "n_responden", "n_sin_respuesta", "n_fuera_de_lista", "n_otro_textos"))
  expect_identical(f$datos$n_total, 12L)
  expect_identical(f$datos$n_responden, 11L)
  expect_identical(f$datos$n_sin_respuesta, 1L)
  expect_identical(f$datos$n_fuera_de_lista, 1L)   # la fila 12 marca «cine»
  expect_identical(f$datos$n_otro_textos, 2L)      # «Afiche» y «afiche »
})

test_that("la ficha de una select_one y una numérica: restricción, ayuda, obligatoria y códigos fuera de lista", {
  so <- explorador_ficha(.efi_data(), "sexo", .efi_inst())
  expect_identical(so$required, TRUE)
  expect_identical(so$datos$n_fuera_de_lista, 1L)   # el «9»
  expect_identical(sum(vapply(so$opciones, `[[`, 1L, "n")) + so$datos$n_fuera_de_lista, so$datos$n_responden)
  expect_true(is.na(so$datos$n_otro_textos))         # no abre ninguna de texto
  expect_length(so$abre, 0L)

  num <- explorador_ficha(.efi_data(), "edad", .efi_inst())
  expect_identical(num$tipo, "num")
  expect_identical(num$tipo_xlsform, "integer")
  expect_true(is.na(num$lista))
  expect_identical(num$hint, "En años cumplidos")
  expect_identical(num$constraint, ". >= 18 and . <= 99")
  expect_identical(num$constraint_message, "Edad entre 18 y 99")
  expect_length(num$opciones, 0L)
  expect_identical(num$datos$n_responden + num$datos$n_sin_respuesta, num$datos$n_total)
})

test_that("lo ausente viaja como null, no como {} (abre vacío es [])", {
  j <- .efi_json(explorador_ficha(.efi_data(), "sexo", .efi_inst()))
  expect_null(j$hint)
  expect_null(j$relevant)
  expect_null(j$choice_filter)
  expect_null(j$datos$n_otro_textos)
  expect_identical(j$abre, list())
  sin_version <- .efi_inst(); sin_version$settings <- NULL; sin_version$survey$required <- NULL
  j2 <- .efi_json(explorador_ficha(.efi_data(), "fecha", sin_version))
  expect_null(j2$version_formulario)
  expect_null(j2$required)
  expect_identical(j2$tipo, "fecha")
})

test_that("una variable que no está en el formulario ni en la base da 404 E_EXPLORAR_VAR_NOT_FOUND", {
  err <- tryCatch(explorador_ficha(.efi_data(), "no_existe", .efi_inst()), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_EXPLORAR_VAR_NOT_FOUND")
  expect_identical(as.integer(err$status), 404L)
  # Una columna de la base sin fila en el formulario sí tiene ficha (con lo que se sabe de ella).
  f <- explorador_ficha(.efi_data(), "id", .efi_inst())
  expect_true(is.na(f$tipo_xlsform))
  expect_true(is.na(f$grupo))
})

test_that("la ficha lee el survey que deja reporte_instrumento (type separado y columnas con idioma)", {
  skip_if_not_installed("openxlsx")
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  inst0 <- .efi_inst()
  survey <- inst0$survey
  survey$type <- ifelse(is.na(survey$list_name), survey$type, paste(survey$type, survey$list_name))
  survey$list_name <- NULL
  names(survey)[names(survey) == "hint"] <- "hint::Español (es)"
  .carga_write_xlsform_model(list(survey = survey, choices = inst0$choices, settings = inst0$settings), path)
  inst <- reporte_instrumento(path = path)
  f <- explorador_ficha(.efi_data(), "satis", inst)
  expect_identical(f$tipo, "so")
  expect_identical(f$tipo_xlsform, "select_one")
  expect_identical(f$lista, "likert")
  expect_identical(f$hint, "Lea las opciones")
  expect_identical(f$grupo$name, "g_datos")
  expect_identical(vapply(f$opciones, `[[`, "", "etiqueta"),
                   c("Nada satisfecho", "Poco satisfecho", "Algo satisfecho", "Muy satisfecho"))
  m <- explorador_ficha(.efi_data(), "medios", inst)
  expect_identical(m$abre[[1]]$var, "medios_otro")
})

# --- ruta HTTP en proceso -------------------------------------------------------
.efi_pr <- function() {
  plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err)) |>
    mount_explorador_ficha()
}

.efi_get <- function(pr, sid, query, base = NULL) {
  input <- list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) "")
  env <- list(REQUEST_METHOD = "GET", PATH_INFO = "/api/validacion/v2/explorar/ficha", QUERY_STRING = query,
              HTTP_X_PULSO_SESSION = sid, rook.input = input)
  if (!is.null(base)) env$HTTP_X_BASE_NOMBRE <- base
  r <- pr$call(as.environment(env))
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.efi_sesion_multibase <- function() {
  sid <- session_create()
  datos <- .efi_data()
  bases <- list(primera = datos, segunda = datos[1:6, , drop = FALSE])
  for (nm in names(bases)) {
    estudio_add_base(sid, nombre = nm, xlsform_file_id = paste0("xls-", nm), data_file_id = paste0("dat-", nm),
                     data_ext = "xlsx", rp_data = bases[[nm]], rp_inst = .efi_inst(),
                     n_filas = nrow(bases[[nm]]), n_columnas = ncol(bases[[nm]]))
  }
  sid
}

test_that("GET /explorar/ficha responde por la ruta, lee la base que pide X-Base-Nombre y tipa sus errores", {
  sid <- .efi_sesion_multibase()
  on.exit(session_delete(sid), add = TRUE)
  pr <- .efi_pr()

  r <- .efi_get(pr, sid, "var=medios&otro=1", base = "segunda")
  expect_identical(r$status, 200L)
  expect_true(all(.efi_claves %in% names(r$body)))
  expect_identical(r$body$base_nombre, "segunda")
  expect_identical(r$body$fuente, "raw")
  expect_identical(r$body$datos$n_total, 6L)       # la segunda base, no la primera
  expect_identical(r$body$grupo$name, "g_datos")
  expect_null(r$body$hint)

  r1 <- .efi_get(pr, sid, "var=medios", base = "primera")
  expect_identical(r1$body$datos$n_total, 12L)

  e <- .efi_get(pr, sid, "var=no_existe", base = "segunda")
  expect_identical(e$status, 404L)
  expect_identical(e$body$error$code, "E_EXPLORAR_VAR_NOT_FOUND")
  e <- .efi_get(pr, sid, "", base = "segunda")
  expect_identical(e$status, 400L)
  expect_identical(e$body$error$code, "E_MISSING_VAR")
  e <- .efi_get(pr, sid, "var=medios&fuente=final", base = "segunda")
  expect_identical(e$status, 409L)
  expect_identical(e$body$error$code, "E_NOT_FINALIZED")
  e <- .efi_get(pr, sid, "var=medios&fuente=otra", base = "segunda")
  expect_identical(e$body$error$code, "E_BAD_FUENTE")
})

test_that("la ruta de la ficha está montada en la app real", {
  src <- readLines(testthat::test_path("..", "..", "R", "plumber_app.R"), warn = FALSE)
  expect_true(any(grepl("mount_explorador_ficha(pr)", src, fixed = TRUE)))
})
