# Regla propia "Formato de la respuesta" (tipo `formato`, validacion_regla_formato.R).
#
# Grano: fila de la tabla principal (el caso). La cifra es la del motor: casos
# marcados sobre las filas que evalúa la auditoría. Los casos se cruzan por el
# id del motor (respondent_id), nunca por posición: la base no está ordenada.
#
#   id    telefono         ubigeo    correo
#   u07   "916856301"      "080105"  "ana@dominio.pe"
#   u03   "NO QUISO DAR"   "80105"   "ana.dominio.pe"
#   u12   "01-4567890"     "150128"  "ana@dominio"
#   u01   ""               ""        ""
#   u09   "98765432"       "1501280" "luis@correo.com"
#   u05   "816856301"      "150133"  "a b@x.pe"
#   u02   "916 856 301"    "080101"  "x@y.org"
#   u11   "9168563011"     "15O128"  "@y.org"

.fmt_datos <- function() {
  data.frame(
    respondent_id = c("u07", "u03", "u12", "u01", "u09", "u05", "u02", "u11"),
    telefono = c("916856301", "NO QUISO DAR", "01-4567890", "", "98765432", "816856301", "916 856 301", "9168563011"),
    ubigeo = c("080105", "80105", "150128", "", "1501280", "150133", "080101", "15O128"),
    correo = c("ana@dominio.pe", "ana.dominio.pe", "ana@dominio", "", "luis@correo.com", "a b@x.pe", "x@y.org", "@y.org"),
    stringsAsFactors = FALSE
  )
}

.fmt_regla <- function(variable, params, id = "RC_FMT", ...) {
  c(list(id = id, activa = TRUE, nombre = "Formato", tipo = "formato",
         variables = list(variable), params = params,
         severidad = "advertencia", hallazgo_kind = "caso_validar"), list(...))
}

.fmt_marca <- function(regla, datos = .fmt_datos()) {
  rule <- bridge_regla_custom(regla)
  ev <- evaluate_validation_bundle(list(rules = list(rule)), datos, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_identical(fila$estado_dinamico, "correcta")
  flag <- ev$datos[[rule$flag_name]]
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

# El texto del plan (y del script de limpieza), fuera del motor, después de la
# normalización del plan: debe quedar idéntico y marcar lo mismo.
.fmt_marca_texto <- function(regla, datos = .fmt_datos()) {
  proc <- .compilar_regla_custom(regla)$Procesamiento
  expect_identical(.normalizar_procesamiento(proc), proc)
  expr <- sub("^[A-Za-z0-9_.]+ <- ", "", proc)
  env <- list2env(as.list(datos), parent = baseenv())
  flag <- eval(parse(text = expr), envir = env)
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

.fmt_ambos <- function(regla, esperado, datos = .fmt_datos()) {
  expect_silent(.validar_regla_custom(regla))
  expect_identical(.fmt_marca(regla, datos), sort(esperado))
  expect_identical(.fmt_marca_texto(regla, datos), sort(esperado))
}

test_that("teléfono: 9 dígitos que empiezan con 9; el texto en lugar del número se marca", {
  tel <- .fmt_regla("telefono", list(modo = "digitos", largo_min = 9, largo_max = 9, empieza_con = list("9")))
  # u07 pasa; u01 vacío no se marca. "916 856 301" tiene espacios: se marca
  # salvo que se quiten los separadores.
  .fmt_ambos(tel, c("u03", "u12", "u09", "u05", "u02", "u11"))
  sin_sep <- .fmt_regla("telefono", list(modo = "digitos", largo_min = 9, largo_max = 9, empieza_con = list("9"),
                                         sin_separadores = TRUE))
  .fmt_ambos(sin_sep, c("u03", "u12", "u09", "u05", "u11"))
  med <- .regla_formato_medir_col(.fmt_datos()$telefono, tel$params)
  names(med$motivo) <- .fmt_datos()$respondent_id
  expect_identical(unname(med$motivo[c("u07", "u03", "u12", "u01", "u09", "u05", "u02", "u11")]),
                   c(NA, "sin_digitos", "no_digitos", NA, "largo", "inicio", "no_digitos", "largo"))
  # Solo "no tiene dígitos": la regla de texto en un campo numérico.
  solo <- .fmt_regla("telefono", list(modo = "digitos"))
  .fmt_ambos(solo, c("u03", "u12", "u02"))
})

test_that("ubigeo de 6 dígitos: el cero inicial cuenta, aunque la columna se declare número", {
  ubi <- .fmt_regla("ubigeo", list(modo = "digitos", largo_min = 6, largo_max = 6))
  # "080105" pasa y "80105" no; "1501280" tiene 7 y "15O128" una letra O.
  .fmt_ambos(ubi, c("u03", "u09", "u11"))
  rango <- .fmt_regla("ubigeo", list(modo = "digitos", largo_min = 5, largo_max = 6))
  .fmt_ambos(rango, c("u09", "u11"))
  # Una columna que ya llegó como número perdió el cero: se lee como texto
  # entero (sin notación científica) y el conteo previo lo dice.
  d <- .fmt_datos()
  d$ubigeo <- c(80105, 80105, 150128, NA, 1501280, 150133, 80101, NA)
  .fmt_ambos(ubi, c("u07", "u03", "u09", "u02"), datos = d)
  med <- .regla_formato_medir_col(c(916856301, 1e9), list(modo = "digitos"))
  expect_identical(med$texto, c("916856301", "1000000000"))
  expect_true(med$como_numero)
  lect <- .regla_formato_lectura(d, ubi)
  expect_true(lect$como_numero)
})

test_that("correo y patrón libre", {
  .fmt_ambos(.fmt_regla("correo", list(modo = "correo")), c("u03", "u12", "u05", "u11"))
  # Patrón con "=", comillas y paréntesis: viaja intacto por la normalización del plan.
  pat <- .fmt_regla("ubigeo", list(modo = "expresion", expresion = "(08|15)[0-9]{4}"))
  .fmt_ambos(pat, c("u03", "u09", "u11"))
  raro <- .fmt_regla("correo", list(modo = "expresion", expresion = "[^=\"']+@(dominio|y)[.](pe|org)"))
  .fmt_ambos(raro, c("u03", "u12", "u09", "u05", "u11"))
})

test_that("el filtro previo se aplica y una pregunta ausente se dice", {
  regla <- .fmt_regla("ubigeo", list(modo = "digitos", largo_min = 6, largo_max = 6),
                      gate_conditions = list(list(variable = "correo", op = "==", value = "ana.dominio.pe")))
  expect_identical(.fmt_marca(regla), "u03")
  d <- .fmt_datos(); d$ubigeo <- NULL
  rule <- bridge_regla_custom(.fmt_regla("ubigeo", list(modo = "digitos")))
  ev <- evaluate_validation_bundle(list(rules = list(rule)), d, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_false(identical(fila$estado_dinamico, "correcta"))
  expect_match(fila$detalle, "ubigeo")
})

test_that("el esquema rechaza un formato mal formado con su código", {
  err <- function(regla) {
    e <- tryCatch(.validar_regla_custom(regla), api_error = function(e) e)
    if (inherits(e, "api_error")) e$code else NA_character_
  }
  dos <- .fmt_regla("telefono", list(modo = "digitos")); dos$variables <- list("telefono", "ubigeo")
  expect_identical(err(dos), "E_REGLA_FORMATO_PREGUNTA")
  expect_identical(err(.fmt_regla("telefono", list(modo = "fecha"))), "E_REGLA_FORMATO_MODO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "digitos", largo_min = 0))), "E_REGLA_FORMATO_LARGO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "digitos", largo_min = 2.5))), "E_REGLA_FORMATO_LARGO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "digitos", largo_min = "nueve"))), "E_REGLA_FORMATO_LARGO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "digitos", largo_min = 9, largo_max = 8))), "E_REGLA_FORMATO_LARGO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "digitos", empieza_con = list("+51")))), "E_REGLA_FORMATO_INICIO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "digitos", largo_max = 2, empieza_con = list("051")))),
                   "E_REGLA_FORMATO_INICIO")
  expect_identical(err(.fmt_regla("telefono", list(modo = "expresion"))), "E_REGLA_FORMATO_EXPRESION")
  expect_identical(err(.fmt_regla("telefono", list(modo = "expresion", expresion = "([0-9]"))), "E_REGLA_FORMATO_EXPRESION")
  expect_true(all(c("E_REGLA_FORMATO_PREGUNTA", "E_REGLA_FORMATO_MODO", "E_REGLA_FORMATO_LARGO",
                    "E_REGLA_FORMATO_INICIO", "E_REGLA_FORMATO_EXPRESION") %in% errores_registrados()$codigo))
})

test_that("la frase dice el formato y que la respuesta se revisa como texto", {
  ctx <- .vrf_contexto(NULL)
  frase <- function(variable, params) .vrf_texto_plano(.vrf_frase_formato(list(propia = .fmt_regla(variable, params)), ctx))
  como_texto <- " La respuesta se revisa como texto, así que un cero inicial cuenta como dígito."
  expect_identical(frase("telefono", list(modo = "digitos", largo_min = 9, largo_max = 9, empieza_con = list("9"))),
                   paste0("Se marca cuando telefono no es un número de 9 dígitos que empieza con 9.", como_texto))
  expect_identical(frase("ubigeo", list(modo = "digitos", largo_min = 5, largo_max = 6)),
                   paste0("Se marca cuando ubigeo no es un número de 5 a 6 dígitos.", como_texto))
  expect_identical(frase("telefono", list(modo = "digitos", sin_separadores = TRUE)),
                   paste0("Se marca cuando telefono no es un número escrito solo con dígitos.",
                          " Antes se quitan espacios, guiones, puntos y paréntesis.", como_texto))
  expect_identical(frase("correo", list(modo = "correo")),
                   paste0("Se marca cuando correo no es un correo electrónico, como nombre@dominio.pe.", como_texto))
  expect_identical(.vrf_nombre_familia("propia", "formato"), "Formato de la respuesta")
})

test_that("el enunciado del caso sale de la misma medida que la marca", {
  regla <- .fmt_regla("telefono", list(modo = "digitos", largo_min = 9, largo_max = 9, empieza_con = list("9")))
  fmt <- .regla_formato_contexto(regla)
  ctx <- list(formato = fmt, etiquetas = list(telefono = "Teléfono"))
  e <- validacion_enunciado_hallazgo("valor_invalido", list(target = "telefono"), "u03",
                                     valores = list(telefono = "NO QUISO DAR"), regla = ctx)
  expect_identical(e$subtipo, "formato")
  expect_identical(e$texto, paste("u03: respondió \"NO QUISO DAR\" en Teléfono (sin dígitos), que no es un número",
                                  "de 9 dígitos que empieza con 9. Revisar y corregir en Limpieza."))
  e <- validacion_enunciado_hallazgo("valor_invalido", list(target = "telefono"), "u09",
                                     valores = list(telefono = "98765432"), regla = ctx)
  expect_identical(e$hecho, "respondió \"98765432\" en Teléfono (8 dígitos)")
  e <- validacion_enunciado_hallazgo("valor_invalido", list(target = "telefono"), "u05",
                                     valores = list(telefono = "816856301"), regla = ctx)
  expect_identical(e$hecho, "respondió \"816856301\" en Teléfono (empieza con 8)")
  expect_identical(validacion_anomalia_tipo("formato"), "valor_invalido")
})

# --- Conteo previo por HTTP, con ids del motor -------------------------------

.fmt_sesion <- function(dir, datos = .fmt_datos()) {
  survey <- data.frame(
    type = c("text", "text", "integer", "text"),
    name = c("caso", "telefono", "ubigeo", "correo"),
    label = c("Código del caso", "Teléfono", "Ubigeo", "Correo"),
    required = "", relevant = "", constraint = "",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = "x", name = "1", label = "x", stringsAsFactors = FALSE)
  datos$caso <- sprintf("C-%s", datos$respondent_id)
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
  sid <- session_create()
  xm <- save_upload(sid, "xlsform", basename(xls), readBin(xls, "raw", n = file.info(xls)$size))
  dm <- save_upload(sid, "data", basename(csv), readBin(csv, "raw", n = file.info(csv)$size))
  inst <- reporte_instrumento(path = xm$path)
  for (nombre in c("Otra", "Contactos")) {
    estudio_add_base(
      sid = sid, nombre = nombre, xlsform_file_id = xm$file_id,
      data_file_id = dm$file_id, data_ext = "csv",
      rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
      n_filas = nrow(datos), n_columnas = ncol(datos)
    )
  }
  s <- session_get(sid)
  s$estudio$active_base <- "Otra"
  .session_env[[sid]] <- s
  sid
}

test_that("el conteo previo cuenta sobre la base pedida, por id, con lo que pasa y lo que no", {
  dir <- withr::local_tempdir()
  sid <- .fmt_sesion(dir)
  withr::defer(session_delete(sid))
  regla <- .fmt_regla("ubigeo", list(modo = "digitos", largo_min = 6, largo_max = 6), id = "")
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")),
                query = "base_nombre=Contactos")
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Contactos")
  expect_identical(b$n_base, 8L)
  ids <- vapply(b$ejemplos, function(e) e$id_caso, character(1))
  # El formulario declara el ubigeo "integer"; la carga conserva "080105" y
  # la regla lo revisa como texto: no es un falso positivo.
  expect_setequal(ids, c("u03", "u09", "u11"))
  expect_identical(b$n_casos, 3L)
  u03 <- b$ejemplos[[match("u03", ids)]]
  expect_identical(u03$formato$texto, "80105")
  expect_identical(u03$formato$motivo, "largo")
  expect_identical(u03$formato$n_digitos, 5L)
  l <- b$formato
  expect_null(b$lectura)
  expect_identical(l$n_filas, 8L)
  expect_identical(l$n_vacias + l$n_pasan + l$n_no_pasan, l$n_filas)
  expect_identical(l$n_no_pasan, 3L)
  expect_false(l$como_numero)
  expect_true("080105" %in% vapply(l$pasan, `[[`, "", "valor"))
  expect_setequal(vapply(l$no_pasan, `[[`, "", "valor"), c("80105", "1501280", "15O128"))
})

test_that("el conteo previo rechaza un formato mal formado con su código", {
  dir <- withr::local_tempdir()
  sid <- .fmt_sesion(dir)
  withr::defer(session_delete(sid))
  regla <- .fmt_regla("telefono", list(modo = "expresion", expresion = "[0-9"), id = "")
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")))
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_REGLA_FORMATO_EXPRESION")
})
