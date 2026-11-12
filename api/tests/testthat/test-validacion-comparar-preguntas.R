# "Comparar con otra pregunta" en reglas propias (Condiciones combinadas y
# "Dos respuestas que deben cuadrar" con `valor_y_variable`): el compilador
# (`.c_cmp_vars`, validacion_ast_compiler_r.R) compara número con número, fecha
# con fecha y texto con texto, fila por fila, y una conversión que no aplica
# nunca tumba la regla. Antes, `as.Date()` sobre una columna de números o de
# texto lanzaba "character string is not in a standard unambiguous format" y
# la regla salía `incorrecta_ejecucion` con ese mensaje de R.
#
# Base sintética de 8 casos, con las formas de acnur_acg: duraciones en
# segundos que llegan como texto del export (con un "n/d" que deja la columna
# como texto, que es lo que hacía caer `as.Date()`), una edad, dos textos y dos fechas.

.cp_datos <- function() {
  data.frame(
    respondent_id = sprintf("u%02d", 1:8),
    dur_a = c("1200", "300", "45", "1000", "60", "75", "900", "n/d"),
    dur_b = c("1100", "400", "50", "999", "60", "80", "100", "5"),
    edad = c(30, 41, 25, 60, 33, 18, 50, 22),
    edad_pareja = c(28, 45, 25, 59, 40, 17, 55, 22),
    ciudad = c("Lima", "Cusco", "Lima", "Piura", "Lima", "Puno", "Tacna", "Ica"),
    ciudad_nac = c("Lima", "Lima", "Lima", "Piura", "Cusco", "Puno", "Lima", "Ica"),
    f_visita = c("2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13",
                 "2026-06-14", "2026-06-15", "2026-06-16", "2026-06-17"),
    f_cita = c("2026-06-09", "2026-06-12", "2026-06-12", "2026-06-01",
               "2026-06-20", "2026-06-15", "2026-06-10", "2026-06-18"),
    stringsAsFactors = FALSE
  )
}

.cp_sesion <- function(dir) {
  survey <- data.frame(
    type = c("text", "text", "integer", "integer", "text", "text", "date", "date"),
    name = c("dur_a", "dur_b", "edad", "edad_pareja", "ciudad", "ciudad_nac", "f_visita", "f_cita"),
    label = c("Duración A", "Duración B", "Edad", "Edad de la pareja", "Ciudad", "Ciudad de nacimiento",
              "Fecha de visita", "Fecha de cita"),
    required = "", relevant = "", constraint = "", stringsAsFactors = FALSE)
  xls <- file.path(dir, "f.xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = data.frame(list_name = "x", name = "1", label = "X")), xls)
  csv <- file.path(dir, "b.csv")
  utils::write.csv(.cp_datos(), csv, row.names = FALSE)
  sid <- session_create()
  xm <- save_upload(sid, "xlsform", "f.xlsx", readBin(xls, "raw", n = file.info(xls)$size))
  dm <- save_upload(sid, "data", "b.csv", readBin(csv, "raw", n = file.info(csv)$size))
  inst <- reporte_instrumento(path = xm$path)
  estudio_add_base(sid = sid, nombre = "Personas", xlsform_file_id = xm$file_id, data_file_id = dm$file_id,
                   data_ext = "csv", rp_data = reporte_data(.cp_datos(), instrumento = inst), rp_inst = inst,
                   n_filas = 8L, n_columnas = ncol(.cp_datos()))
  sid
}

.cp_regla <- function(id, a, op, b) {
  list(id = id, activa = TRUE, nombre = id, tipo = "condiciones", variables = list(),
       params = list(modo = "todas", condiciones = list(list(variable = a, op = op, variable_comparada = b))),
       severidad = "advertencia", hallazgo_kind = "caso_validar")
}

test_that("número, edad, texto y fecha contra otra pregunta: se cuentan, sin error de R", {
  dir <- withr::local_tempdir()
  sid <- .cp_sesion(dir)
  casos <- list(
    list(.cp_regla("RC_1", "dur_a", ">", "dur_b"), 3L),          # 1200>1100, 1000>999, 900>100; "n/d" no cuenta
    list(.cp_regla("RC_2", "edad", "<", "edad_pareja"), 3L),      # 41<45, 33<40, 50<55
    list(.cp_regla("RC_3", "ciudad", "!=", "ciudad_nac"), 3L),    # Cusco/Lima, Lima/Cusco, Tacna/Lima
    list(.cp_regla("RC_4", "f_visita", ">", "f_cita"), 3L),       # 10>09, 13>01, 16>10
    list(.cp_regla("RC_5", "f_visita", ">", "ciudad"), 0L)        # fecha contra texto: indeterminada
  )
  for (k in casos) {
    b <- reglas_custom_probar(sid, "Personas", k[[1]])
    expect_identical(b$estado, "evaluada", info = k[[1]]$id)
    expect_true(isTRUE(b$evaluada), info = k[[1]]$id)
    expect_identical(b$n_casos, k[[2]], info = k[[1]]$id)
    expect_false(grepl("unambiguous|character string", b$motivo %||% ""), info = k[[1]]$id)
  }
})

test_that("el conteo previo y la auditoría dan lo mismo para la misma regla", {
  dir <- withr::local_tempdir()
  sid <- .cp_sesion(dir)
  reglas <- list(.cp_regla("RC_1", "dur_a", ">", "dur_b"), .cp_regla("RC_3", "ciudad", "!=", "ciudad_nac"),
                 .cp_regla("RC_4", "f_visita", ">", "f_cita"))
  validacion_scope_set(sid, "Personas", "reglas_custom", reglas)
  .m2_auditar(sid, "Personas")
  res <- validacion_scope_get(sid, "Personas")$evaluacion$resumen
  for (r in reglas) {
    previo <- reglas_custom_probar(sid, "Personas", utils::modifyList(r, list(id = "")))
    fila <- res[res$id_regla == r$id, ]
    expect_identical(fila$estado_dinamico, "correcta", info = r$id)
    expect_identical(as.integer(fila$n_inconsistencias), previo$n_casos, info = r$id)
  }
})

test_that("una comparación coherencia_2v con otra pregunta tampoco falla", {
  dir <- withr::local_tempdir()
  sid <- .cp_sesion(dir)
  r <- list(id = "", activa = TRUE, nombre = "x", tipo = "coherencia_2v", variables = list("edad", "dur_a"),
            params = list(op_x = ">", valor_x = 20, op_y = ">", valor_y_variable = "dur_b"),
            severidad = "advertencia", hallazgo_kind = "caso_validar")
  b <- reglas_custom_probar(sid, "Personas", r)
  expect_identical(b$estado, "evaluada")
  expect_true(is.integer(b$n_casos))
})

test_that("si una regla no se puede evaluar, el motivo va en castellano llano", {
  dir <- withr::local_tempdir()
  sid <- .cp_sesion(dir)
  b <- reglas_custom_probar(sid, "Personas", .cp_regla("", "no_existe", ">", "edad"))
  expect_false(b$evaluada)
  expect_identical(b$motivo, "La pregunta no está en la base: no_existe.")
  expect_identical(.vrc_motivo_llano("incorrecta_ejecucion", "runtime_error",
                                     "character string is not in a standard unambiguous format"),
                   "La regla falló al evaluarse. Revisa que las preguntas que compara sean del mismo tipo (número, fecha o texto).")
})
