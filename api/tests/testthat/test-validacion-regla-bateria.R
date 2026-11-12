# Regla propia "Patrón en una batería" (tipo `bateria`, validacion_regla_bateria.R).
#
# Grano: fila de la tabla principal (el caso). La cifra es la del motor: casos
# marcados sobre las filas que evalúa la auditoría. Los casos se cruzan por el
# id del motor (respondent_id), nunca por posición: la base de prueba no está
# ordenada por id.
#
# Batería sintética de 14 ítems (b1 a b14), lista 1 a 4 y 88 "No aplica":
#   fila  id    patrón
#   1     u07   14 ítems = 4                      (iguales: marca)
#   2     u03   13 ítems = 4 y uno = 3            (iguales: no marca)
#   3     u12   12 ítems = 1 y 2 vacíos           (iguales con mínimo 12: marca; con 13 no)
#   4     u01   14 vacíos                         (vacías: marca; iguales solo si vacías cuentan)
#   5     u09   11 ítems = 2 y 3 vacíos           (iguales con mínimo 12: no marca)
#   6     u05   10 ítems = 88 y 4 = 2             (código 88 en 10; iguales sin 88: marca con mínimo 4)
#   7     u02   14 ítems = 88                     (iguales: marca; sin contar 88: no)
#   8     u11   respuestas variadas               (nada)

.bat_items <- sprintf("b%d", 1:14)

.bat_datos <- function() {
  fila <- function(...) as.numeric(c(...))
  m <- rbind(
    fila(rep(4, 14)),
    fila(rep(4, 13), 3),
    fila(rep(1, 12), NA, NA),
    fila(rep(NA, 14)),
    fila(rep(2, 11), NA, NA, NA),
    fila(rep(88, 10), rep(2, 4)),
    fila(rep(88, 14)),
    fila(1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2)
  )
  d <- as.data.frame(m)
  names(d) <- .bat_items
  cbind(data.frame(respondent_id = c("u07", "u03", "u12", "u01", "u09", "u05", "u02", "u11"),
                   stringsAsFactors = FALSE), d)
}

.bat_regla <- function(params, variables = .bat_items, id = "RC_BAT", ...) {
  c(list(id = id, activa = TRUE, nombre = "Batería", tipo = "bateria",
         variables = as.list(variables), params = params,
         severidad = "advertencia", hallazgo_kind = "caso_validar"), list(...))
}

# Ids del motor de las filas marcadas (por el evaluador de la auditoría).
.bat_marca <- function(regla, datos = .bat_datos()) {
  rule <- bridge_regla_custom(regla)
  ev <- evaluate_validation_bundle(list(rules = list(rule)), datos, strict = FALSE)
  flag <- ev$datos[[rule$flag_name]]
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

# El texto del plan (y del script de limpieza), fuera del motor, en un entorno
# con solo las columnas de la base, después de la normalización del plan.
.bat_marca_texto <- function(regla, datos = .bat_datos()) {
  proc <- .normalizar_procesamiento(.compilar_regla_custom(regla)$Procesamiento)
  expr <- sub("^[A-Za-z0-9_.]+ <- ", "", proc)
  env <- list2env(as.list(datos), parent = baseenv())
  flag <- eval(parse(text = expr), envir = env)
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

.bat_ambos <- function(regla, esperado) {
  expect_identical(.bat_marca(regla), sort(esperado))
  expect_identical(.bat_marca_texto(regla), sort(esperado))
}

test_that("misma respuesta: 14 ítems iguales marcan y uno distinto no", {
  regla <- .bat_regla(list(patron = "iguales"))
  expect_silent(.validar_regla_custom(regla))
  # u07 (14 = 4) y u02 (14 = 88); u03 tiene un 3 y no marca.
  .bat_ambos(regla, c("u07", "u02"))
})

test_that("una pregunta vacía no cuenta como respuesta igual, salvo que se pida", {
  # Sin mínimo explícito se piden las 14 respondidas: u12 (12 + 2 vacías) y
  # u01 (todo vacío) no marcan.
  .bat_ambos(.bat_regla(list(patron = "iguales")), c("u07", "u02"))
  # Con las vacías como una respuesta más: u01 (14 vacías) es "igual" en todo;
  # u12 mezcla 1 y vacío y no marca.
  .bat_ambos(.bat_regla(list(patron = "iguales", vacias_cuentan = TRUE)), c("u07", "u02", "u01"))
})

test_that("el mínimo de respondidas se respeta", {
  # Mínimo 12: entra u12 (12 respondidas iguales); u09 tiene 11 y no.
  .bat_ambos(.bat_regla(list(patron = "iguales", minimo = 12)), c("u07", "u02", "u12"))
  # Mínimo 13: u12 ya no.
  .bat_ambos(.bat_regla(list(patron = "iguales", minimo = 13)), c("u07", "u02"))
  # Mínimo 11: entra u09.
  .bat_ambos(.bat_regla(list(patron = "iguales", minimo = 11)), c("u07", "u02", "u12", "u09"))
})

test_that("un código que no cuenta como respuesta se descuenta antes de comparar", {
  # Sin contar 88 y con mínimo 4: u02 (todo 88) queda sin respuestas y no
  # marca; u05 (4 ítems = 2) sí.
  regla <- .bat_regla(list(patron = "iguales", minimo = 4, no_cuentan = list("88")))
  .bat_ambos(regla, c("u07", "u12", "u09", "u05"))
})

test_that("un código en N o más ítems", {
  .bat_ambos(.bat_regla(list(patron = "codigo", codigos = list("88"), minimo = 10)), c("u05", "u02"))
  .bat_ambos(.bat_regla(list(patron = "codigo", codigos = list("88"), minimo = 11)), c("u02"))
  # Un código que llega como texto con decimales ("88.0") es el mismo código.
  .bat_ambos(.bat_regla(list(patron = "codigo", codigos = list("88.0"), minimo = 14)), c("u02"))
})

test_that("vacías: todas, o N o más", {
  .bat_ambos(.bat_regla(list(patron = "vacias")), c("u01"))
  .bat_ambos(.bat_regla(list(patron = "vacias", minimo = 2)), c("u01", "u12", "u09"))
  .bat_ambos(.bat_regla(list(patron = "vacias", minimo = 3)), c("u01", "u09"))
})

test_that("el filtro previo se aplica a la batería", {
  regla <- .bat_regla(list(patron = "iguales"),
                      gate_conditions = list(list(variable = "b1", op = "==", value = "4")))
  expect_identical(.bat_marca(regla), "u07")
})

test_that("una pregunta de la batería que falta en la base se dice, no se descarta", {
  d <- .bat_datos()
  d$b14 <- NULL
  rule <- bridge_regla_custom(.bat_regla(list(patron = "iguales")))
  ev <- evaluate_validation_bundle(list(rules = list(rule)), d, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_false(identical(fila$estado_dinamico, "correcta"))
  expect_match(fila$detalle, "b14")
})

test_that("el esquema rechaza baterías mal formadas con su código", {
  err <- function(regla) {
    e <- tryCatch(.validar_regla_custom(regla), api_error = function(e) e)
    if (inherits(e, "api_error")) e$code else NA_character_
  }
  expect_identical(err(.bat_regla(list(patron = "iguales"), variables = "b1")), "E_REGLA_BATERIA_PREGUNTAS")
  expect_identical(err(.bat_regla(list(patron = "iguales"), variables = c("b1", "b1"))), "E_REGLA_BATERIA_PREGUNTAS")
  expect_identical(err(.bat_regla(list(patron = "todas"))), "E_REGLA_BATERIA_PATRON")
  expect_identical(err(.bat_regla(list(patron = "codigo", minimo = 3))), "E_REGLA_BATERIA_CODIGOS")
  expect_identical(err(.bat_regla(list(patron = "codigo", codigos = list("88")))), "E_REGLA_BATERIA_MINIMO")
  expect_identical(err(.bat_regla(list(patron = "iguales", minimo = 1))), "E_REGLA_BATERIA_MINIMO")
  expect_identical(err(.bat_regla(list(patron = "iguales", minimo = 15))), "E_REGLA_BATERIA_MINIMO")
  expect_identical(err(.bat_regla(list(patron = "vacias", minimo = 2.5))), "E_REGLA_BATERIA_MINIMO")
  expect_true(all(c("E_REGLA_BATERIA_PREGUNTAS", "E_REGLA_BATERIA_PATRON", "E_REGLA_BATERIA_CODIGOS",
                    "E_REGLA_BATERIA_MINIMO") %in% errores_registrados()$codigo))
})

test_that("la frase del catálogo dice el patrón, el tramo y el mínimo", {
  ctx <- .vrf_contexto(NULL)
  frase <- function(params) {
    .vrf_texto_plano(.vrf_frase_bateria(list(propia = .bat_regla(params)), ctx))
  }
  expect_identical(frase(list(patron = "iguales")),
                   "Se marca cuando las 14 preguntas de la batería, de b1 a b14, tienen la misma respuesta.")
  expect_identical(frase(list(patron = "iguales", minimo = 12, no_cuentan = list("88"))),
                   paste("Se marca cuando todas las respuestas de la batería, de b1 a b14, son iguales y hay",
                         "al menos 12 de 14 preguntas respondidas. 88 no cuenta como respuesta."))
  expect_identical(frase(list(patron = "codigo", codigos = list("88"), minimo = 10)),
                   "Se marca cuando 88 aparece en al menos 10 de las 14 preguntas de la batería, de b1 a b14.")
  expect_identical(frase(list(patron = "vacias")),
                   "Se marca cuando las 14 preguntas de la batería, de b1 a b14, están vacías.")
  expect_identical(.vrf_nombre_familia("propia", "bateria"), "Patrón en una batería")
})

test_that("el enunciado del caso sale de la misma medida que la marca", {
  bat <- .regla_bateria_contexto(.bat_regla(list(patron = "iguales", minimo = 12)))
  d <- .bat_datos()
  valores <- function(id) as.list(d[d$respondent_id == id, .bat_items])
  et <- list(b1 = list("1" = "Nada", "4" = "Mucho"))
  e <- validacion_enunciado_hallazgo(NA_character_, list(target = "b1"), "u12",
                                     valores = valores("u12"), etiquetas_valor = et,
                                     regla = list(bateria = bat))
  expect_identical(e$subtipo, "bateria")
  expect_identical(e$texto, "u12: respondió \"Nada\" (1) en 12 de las 14 preguntas de la batería. Revisar y corregir en Limpieza.")
  e <- validacion_enunciado_hallazgo(NA_character_, list(target = "b1"), "u07",
                                     valores = valores("u07"), etiquetas_valor = et,
                                     regla = list(bateria = bat))
  expect_identical(e$hecho, "respondió \"Mucho\" (4) en las 14 preguntas de la batería")
  vac <- .regla_bateria_contexto(.bat_regla(list(patron = "vacias", minimo = 2)))
  e <- validacion_enunciado_hallazgo(NA_character_, list(target = "b1"), "u09",
                                     valores = valores("u09"), regla = list(bateria = vac))
  expect_identical(e$hecho, "dejó vacías 3 de las 14 preguntas de la batería")
})

# --- Conteo previo por HTTP, con ids del motor -------------------------------

.bat_sesion <- function(dir, datos = .bat_datos()) {
  survey <- data.frame(
    type = c("text", rep("select_one acuerdo", 14)),
    name = c("caso", .bat_items),
    label = c("Código del caso", sprintf("P29.%d. Ítem %d", 1:14, 1:14)),
    required = "", relevant = "", constraint = "",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = "acuerdo", name = c("1", "2", "3", "4", "88"),
                        label = c("Nada", "Poco", "Bastante", "Mucho", "No aplica"),
                        stringsAsFactors = FALSE)
  datos$caso <- sprintf("C-%s", datos$respondent_id)
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
  sid <- session_create()
  xm <- save_upload(sid, "xlsform", basename(xls), readBin(xls, "raw", n = file.info(xls)$size))
  dm <- save_upload(sid, "data", basename(csv), readBin(csv, "raw", n = file.info(csv)$size))
  inst <- reporte_instrumento(path = xm$path)
  for (nombre in c("Otra", "Batería")) {
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

test_that("el conteo previo cuenta sobre la base pedida y devuelve los casos por su id", {
  dir <- withr::local_tempdir()
  sid <- .bat_sesion(dir)
  withr::defer(session_delete(sid))
  regla <- .bat_regla(list(patron = "iguales", minimo = 12), id = "")
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")),
                query = "base_nombre=Bater%C3%ADa")
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Batería")
  expect_identical(b$n_base, 8L)
  expect_identical(b$n_casos, 3L)
  ids <- vapply(b$ejemplos, function(e) e$id_caso, character(1))
  expect_setequal(ids, c("u07", "u12", "u02"))
  u12 <- b$ejemplos[[match("u12", ids)]]
  expect_identical(u12$bateria$patron, "iguales")
  expect_identical(u12$bateria$n_items, 14L)
  expect_identical(u12$bateria$n_contadas, 12L)
  expect_identical(u12$bateria$valor_comun, "1")
  falla <- vapply(u12$valores, function(v) isTRUE(v$falla), logical(1))
  expect_identical(sum(falla), 12L)
  expect_length(u12$valores, 14L)
})

test_that("el conteo previo rechaza una batería mal formada con su código", {
  dir <- withr::local_tempdir()
  sid <- .bat_sesion(dir)
  withr::defer(session_delete(sid))
  regla <- .bat_regla(list(patron = "iguales", minimo = 20), id = "")
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
                body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")))
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_REGLA_BATERIA_MINIMO")
})
