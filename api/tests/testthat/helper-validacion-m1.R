# Fixtures del motor de Reglas (M1 de Validación): un estudio con dos bases
# hermanas, cada una con su XLSForm y su base en archivos reales, para probar el
# conteo previo, la auditoría única y la huella de reglas por la misma lectura
# que usa la auditoría.
#
# La base sintética reproduce los cuatro casos del documento de revisión del
# equipo (sin datos de nadie):
#   1. edad entre 16 y 25;
#   2. P4 = 1 y P21 en {4, 5, 6, 8};
#   3. hermanos (columna binaria) = 0 y P15 distinto de 88, con "todas";
#   4. P8_6 contra "alguna" de P16_7, P16_8 y P16_9.

.m1_survey <- function() {
  data.frame(
    type = c("text", "integer", "select_one p4", "integer", "integer", "integer",
             "integer", "integer", "integer", "integer"),
    name = c("caso", "edad", "p4", "p21", "hermanos", "p15",
             "p8_6", "p16_7", "p16_8", "p16_9"),
    label = c("Código del caso", "Edad", "P4. Situación", "P21. Frecuencia",
              "P10. Vive con hermanos", "P15. Hermanos que estudian",
              "P8_6. Ítem", "P16_7", "P16_8", "P16_9"),
    required = c("", "yes", "", "", "", "", "", "", "", ""),
    relevant = "",
    constraint = "",
    stringsAsFactors = FALSE
  )
}

.m1_datos <- function() {
  data.frame(
    # Identificador del caso: una de las columnas que Hallazgos reconoce
    # (`.limpieza_uuid_candidates()`); `_uuid` no sobrevive a `read.csv()`.
    respondent_id = sprintf("u%02d", 1:10),
    caso = sprintf("C%02d", 1:10),
    edad = c(15, 18, 20, 30, 22, 16, 25, 26, NA, 19),
    p4 = c(1, 1, 2, 1, 2, 1, 1, 2, 1, 1),
    p21 = c(4, 2, 5, 8, 1, 6, 3, 9, 4, NA),
    hermanos = c(0, 0, 1, 0, 0, 1, 0, 0, 1, 0),
    p15 = c(88, 2, 3, 1, 88, 4, NA, 5, 2, 3),
    p8_6 = c(1, 1, 0, 1, 1, 0, 1, 1, 0, 1),
    p16_7 = c(1, 0, 1, 0, 0, 1, 0, 1, 0, 0),
    p16_8 = c(0, 0, 0, 1, 0, 0, 0, 0, 0, 0),
    p16_9 = c(0, 0, 0, 0, 1, 0, 0, 1, 0, 0),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.m1_archivos <- function(dir, survey = .m1_survey(), datos = .m1_datos()) {
  xls <- file.path(dir, "formulario.xlsx")
  choices <- data.frame(list_name = c("p4", "p4"), name = c("1", "2"),
                        label = c("Sí", "No"), stringsAsFactors = FALSE)
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
  list(xlsform = xls, data = csv, datos = datos)
}

# Sesión con dos bases hermanas ("Hogares" y "Personas"). "Personas" es la
# activa salvo que se diga otra cosa: así se ve si algo cae en la primera.
.m1_sesion <- function(dir, activa = "Personas", datos_personas = .m1_datos()) {
  sid <- session_create()
  for (nombre in c("Hogares", "Personas")) {
    sub <- file.path(dir, nombre)
    dir.create(sub, showWarnings = FALSE, recursive = TRUE)
    f <- .m1_archivos(sub, datos = if (identical(nombre, "Personas")) datos_personas else .m1_datos())
    xm <- save_upload(sid, "xlsform", basename(f$xlsform),
                      readBin(f$xlsform, "raw", n = file.info(f$xlsform)$size))
    dm <- save_upload(sid, "data", basename(f$data),
                      readBin(f$data, "raw", n = file.info(f$data)$size))
    inst <- reporte_instrumento(path = xm$path)
    estudio_add_base(
      sid = sid, nombre = nombre, xlsform_file_id = xm$file_id,
      data_file_id = dm$file_id, data_ext = "csv",
      rp_data = reporte_data(f$datos, instrumento = inst), rp_inst = inst,
      n_filas = nrow(f$datos), n_columnas = ncol(f$datos)
    )
  }
  s <- session_get(sid)
  s$estudio$active_base <- activa
  .session_env[[sid]] <- s
  sid
}

# Plan del formulario de una base: solo la obligatoriedad de `edad`.
.m1_plan <- function(sid, base) {
  files <- .resolve_base_files(sid, base)
  inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  bundle <- build_validation_bundle(inst, incluir = list(required = TRUE, relevant = FALSE, constraint = FALSE))
  validacion_scope_set(sid, base, "plan_result", list(plan = bundle$plan %||% compile_rules_to_plan(bundle$rules),
                                                     bundle = bundle))
  bundle
}

.m1_regla <- function(id, tipo, variables = list(), params = list(), ...) {
  c(list(id = id, activa = TRUE, nombre = id, tipo = tipo, variables = variables,
         params = params, severidad = "advertencia", hallazgo_kind = "caso_validar"),
    list(...))
}

# Los cuatro casos del documento de revisión.
.m1_regla_edad <- function(id = "RC_001") {
  .m1_regla(id, "rango_num", list("edad"), list(min = 16, max = 25))
}
.m1_regla_p4_p21 <- function(id = "RC_002") {
  # "Si P4 = 1, P21 no está entre 4, 5, 6 y 8": se marca P4 = 1 con P21 en ese
  # conjunto.
  .m1_regla(id, "coherencia_2v", list("p4", "p21"),
            list(op_x = "==", valor_x = 1, op_y = "not_in", valor_y = list("4", "5", "6", "8")))
}
.m1_regla_hermanos <- function(id = "RC_003") {
  .m1_regla(id, "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "hermanos", op = "==", valor = 0),
    list(variable = "p15", op = "!=", valor = 88)
  )))
}
.m1_regla_item_alguna <- function(id = "RC_004") {
  .m1_regla(id, "condiciones", list(), list(modo = "alguna", condiciones = list(
    list(variable = "p16_7", op = "==", valor = 1),
    list(variable = "p16_8", op = "==", valor = 1),
    list(variable = "p16_9", op = "==", valor = 1)
  )), gate_conditions = list(list(variable = "p8_6", op = "==", value = "1")))
}

# Llamada en proceso al router montado (el mismo patrón que el PUT de reglas
# propias), con cuerpo JSON y método arbitrario.
.m1_http <- function(pr, sid, method, path, body = NULL, query = "") {
  body <- body %||% ""
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0),
                read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = query,
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.m1_router <- function() {
  mount_validacion(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
}

# Sustituto de `job_submit` para correr la auditoría en proceso: guarda lo que
# recibió el trabajo y aplica `on_complete` con el resultado de evaluar el
# paquete con el motor. No llama a la función del trabajo, así la prueba vale
# igual contra el código anterior (que la definía en línea) y el nuevo.
.m1_jobs_en_proceso <- function(registro) {
  function(sid, kind, func, args = list(), on_complete = NULL, ...) {
    inst <- leer_xlsform_limpieza(args$xlsform_path, verbose = FALSE)
    datos <- read_validation_data_ast(args$data_path, args$data_ext, instrumento = inst,
                                      operational_config = args$operational_config)
    ev <- evaluate_validation_bundle(args$bundle, datos, strict = FALSE,
                                     validation_exclusions = args$validation_exclusions %||% list())
    registro$llamadas[[length(registro$llamadas) + 1L]] <- list(kind = kind, args = args)
    if (is.function(on_complete)) on_complete(list(sid = sid, result_data = list(ev = ev, total = NA_integer_)))
    "job-en-proceso"
  }
}
