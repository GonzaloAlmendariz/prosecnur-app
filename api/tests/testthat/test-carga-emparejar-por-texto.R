# Emparejar las columnas de la base con las preguntas del formulario por su texto
# (carga_emparejar_por_texto.R y carga_emparejar_por_texto_aplicar.R). Ítem 4
# del checklist de validación del practicante: la base digitada trae como
# encabezado el texto de la pregunta, no el `name`.

.cept_instrumento <- function() {
  list(
    survey = data.frame(
      type = c("integer", "select_one sn", "text", "select_multiple viv", "text", "text"),
      name = c("edad", "trabaja", "distrito", "p10", "p11", "p12"),
      label = c("Edad cumplida", "¿Trabajas actualmente?", "Distrito de residencia",
                "¿Con quiénes vives?", "Nombre de tu colegio", "Nombre de tu colegio"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("sn", "sn", "viv", "viv", "viv"),
      name = c("1", "2", "1", "2", "77"),
      label = c("Sí", "No", "Mamá/Cuidadora", "Papá/Cuidador", "Otro/as"),
      stringsAsFactors = FALSE
    )
  )
}

.cept_fila <- function(r, encabezado) r$columnas[r$columnas$encabezado == encabezado, , drop = FALSE]

test_that("una base con la numeración delante del texto se empareja por el texto", {
  inst <- .cept_instrumento()
  h <- c("P1. Edad cumplida", "2) ¿Trabajas actualmente?", "P3 - Distrito de residencia del encuestado")
  r <- carga_emparejar_por_texto(h, inst)
  expect_identical(.cept_fila(r, h[1])$name, "edad")
  expect_identical(.cept_fila(r, h[1])$estado, "exacta")
  expect_identical(.cept_fila(r, h[1])$confianza, "alta")
  expect_identical(.cept_fila(r, h[2])$name, "trabaja")
  # El encabezado contiene el texto entero de la pregunta.
  expect_identical(.cept_fila(r, h[3])$name, "distrito")
  expect_identical(.cept_fila(r, h[3])$estado, "contenida")
  expect_match(.cept_fila(r, h[3])$causa, "contiene el texto de la pregunta", fixed = TRUE)
  expect_identical(r$resumen$n_columnas, 3L)
  expect_identical(r$resumen$n_propuestas, 3L)
})

test_that("una base con el texto exacto de la pregunta se empareja sin numeración", {
  inst <- .cept_instrumento()
  r <- carga_emparejar_por_texto(c("EDAD CUMPLIDA", "Trabajas actualmente"), inst)
  expect_identical(r$columnas$name, c("edad", "trabaja"))
  expect_identical(r$columnas$estado, c("exacta", "exacta"))
})

test_that("dos preguntas con el mismo texto no se emparejan y se dice por qué", {
  inst <- .cept_instrumento()
  r <- carga_emparejar_por_texto(c("P11. Nombre de tu colegio", "Edad cumplida"), inst)
  fila <- .cept_fila(r, "P11. Nombre de tu colegio")
  expect_identical(fila$estado, "ambigua")
  expect_identical(fila$name, "")
  expect_match(fila$causa, "Coincide igual con 2 preguntas: \"p11\" y \"p12\"", fixed = TRUE)
  expect_identical(r$resumen$n_ambiguas, 1L)
  # Las dos preguntas quedan sin columna y se listan.
  expect_true(all(c("p11", "p12") %in% r$sin_columna$name))
})

test_that("una columna sin pareja queda dicha con su causa, no descartada", {
  inst <- .cept_instrumento()
  r <- carga_emparejar_por_texto(c("Nro. De Encuesta", "Edad cumplida"), inst)
  fila <- .cept_fila(r, "Nro. De Encuesta")
  expect_identical(fila$estado, "sin_pareja")
  expect_identical(fila$causa, "Ninguna pregunta del formulario tiene un texto parecido")
  expect_identical(r$resumen$n_sin_pareja, 1L)
  expect_identical(nrow(r$columnas), 2L)
})

test_that("la selección múltiple con una columna por opción se empareja como pregunta/opción", {
  inst <- .cept_instrumento()
  h <- c("P10. ¿Con quiénes vives? Mamá/Cuidadora", "P10. ¿Con quiénes vives? / Papá/Cuidador",
         "P10. ¿Con quiénes vives? 77. Otro/as")
  r <- carga_emparejar_por_texto(h, inst)
  expect_identical(r$columnas$name, c("p10/1", "p10/2", "p10/77"))
  expect_true(all(r$columnas$estado == "exacta"))
  expect_match(r$columnas$causa[1], "opción \"Mamá/Cuidadora\"", fixed = TRUE)
  # La pregunta entera no queda como sin columna: sus opciones la cubren.
  expect_false("p10" %in% r$sin_columna$name)
  # La normalización arma la madre desde las columnas renombradas.
  df <- data.frame(`p10/1` = c(1, NA), `p10/2` = c(NA, 2), `p10/77` = c(NA, NA), check.names = FALSE)
  out <- normalize_data_for_xlsform(df, inst)
  expect_identical(as.character(out$p10), c("1", "2"))
})

test_that("un texto corto que aparece en otro encabezado sin pareja se propone como dudoso", {
  inst <- list(survey = data.frame(type = c("text", "text"), name = c("p1_2", "p1_3"),
                                   label = c("Provincia", "Distrito"), stringsAsFactors = FALSE))
  h <- c("P1. Lugar de nacimiento - Provincia", "P1. Lugar de nacimiento - Distrito", "Distrito")
  r <- carga_emparejar_por_texto(h, inst)
  expect_identical(.cept_fila(r, h[1])$estado, "contenida")
  fila <- .cept_fila(r, "Distrito")
  expect_identical(fila$estado, "dudosa")
  expect_identical(fila$confianza, "baja")
  expect_match(fila$causa, "también aparece en \"P1. Lugar de nacimiento - Distrito\"", fixed = TRUE)
  # La otra columna ofrece la pregunta como candidata para elegirla al revisar.
  expect_true("p1_3" %in% r$candidatos[[2]])
  expect_identical(r$resumen$n_propuestas, 1L)
  expect_identical(r$resumen$n_dudosas, 1L)
})

test_that("un encabezado que ya trae el nombre no se toca ni se ofrece", {
  inst <- .cept_instrumento()
  r <- carga_emparejar_por_texto(c("edad", "Edad cumplida"), inst)
  expect_identical(r$columnas$estado[1], "nombre")
  expect_identical(r$columnas$estado[2], "sin_pareja")
  expect_identical(r$resumen$n_ya_calzan, 1L)
})

# --- Aplicar: carga la base con los encabezados renombrados -----------------

.cept_xlsx <- function(df, path) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Base")
  openxlsx::writeData(wb, "Base", df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.cept_sesion <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  inst <- .cept_instrumento()
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", inst$survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", inst$choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  meta <- save_upload(sid, "xlsform", "formulario.xlsx", readBin(path, "raw", file.info(path)$size))
  .bv_call(mount_carga, "POST", "/api/carga/instrumento", sid, file_id = meta$file_id)
  sid
}

.cept_base_digitada <- function() {
  data.frame(
    `Nro. De Encuesta` = 1:3,
    `P1. Edad cumplida` = c(17, 20, 22),
    `P2. ¿Trabajas actualmente?` = c(1, 2, 1),
    `P3. Distrito de residencia` = c("080105", "Lima", "Cusco"),
    `P10. ¿Con quiénes vives? Mamá/Cuidadora` = c(1, NA, 1),
    `P10. ¿Con quiénes vives? Papá/Cuidador` = c(NA, 2, 2),
    `P10. ¿Con quiénes vives? Otro/as` = c(NA, NA, NA),
    `P11. Nombre de tu colegio` = c("A", "B", "C"),
    `P12. Nombre de tu colegio` = c("A", "B", "C"),
    check.names = FALSE
  )
}

.cept_subir <- function(sid, df, nombre = "base_digitada.xlsx") {
  path <- .cept_xlsx(df, tempfile(fileext = ".xlsx"))
  save_upload(sid, "data", nombre, readBin(path, "raw", file.info(path)$size))
}

.cept_parejas <- function(propuesta) {
  ok <- Filter(function(f) f$estado %in% c("exacta", "contenida"), propuesta$columnas)
  lapply(ok, function(f) list(columna = f$columna, encabezado = f$encabezado, name = f$name))
}

test_that("la propuesta por HTTP no carga nada y dice la cifra sobre las columnas de la base", {
  sid <- .cept_sesion()
  up <- .cept_subir(sid, .cept_base_digitada())
  out <- .bv_call(mount_carga_emparejamiento, "POST", "/api/carga/data/emparejamiento-texto", sid,
                  body = list(file_id = up$file_id))
  expect_true(isTRUE(out$ok))
  expect_identical(out$resumen$n_columnas, 9L)
  expect_identical(out$resumen$n_propuestas, 6L)
  expect_identical(out$resumen$n_ambiguas, 2L)
  expect_identical(out$resumen$n_sin_pareja, 1L)
  # La subida sale del registro y no hay base cargada.
  s <- session_get(sid)
  expect_null(s$files[[up$file_id]])
  expect_null(s$data_raw_meta)
})

test_that("al aceptar, la base se carga con los nombres del formulario y cruza por identificador", {
  sid <- .cept_sesion()
  df <- .cept_base_digitada()
  up <- .cept_subir(sid, df)
  propuesta <- carga_emparejar_por_texto_propuesta(sid, up)
  parejas <- .cept_parejas(propuesta)
  expect_length(parejas, 6L)
  out <- .bv_call(mount_carga_emparejamiento, "POST", "/api/carga/data/emparejamiento-texto/aplicar", sid,
                  body = list(file_id = up$file_id, parejas = parejas))
  expect_true(isTRUE(out$ok))
  expect_identical(out$emparejamiento$n_renombradas, 6L)
  expect_identical(out$emparejamiento$archivo, "base_digitada_nombres_del_formulario.xlsx")
  s <- session_get(sid)
  # La base registrada es la copia; la subida original salió del registro.
  expect_null(s$files[[up$file_id]])
  copia <- s$files[[s$data_raw_meta$file_id]]
  expect_identical(copia$original_name, "base_digitada_nombres_del_formulario.xlsx")
  leida <- .read_data_any_path(copia$path, copia$ext)
  expect_true(all(c("edad", "trabaja", "distrito", "p10/1", "p10/2", "p10/77") %in% names(leida)))
  # Las columnas sin pareja o ambiguas conservan su encabezado.
  expect_true(all(c("Nro. De Encuesta", "P11. Nombre de tu colegio") %in% names(leida)))
  # Mismos valores que el original, columna por columna (el cero inicial incluido).
  expect_identical(leida$distrito, c("080105", "Lima", "Cusco"))
  expect_equal(leida$edad, df[["P1. Edad cumplida"]])
  # La vista previa ya trae la madre de la múltiple.
  cols <- vapply(out$preview$columnas, function(x) x$nombre, character(1))
  expect_true(all(c("edad", "p10") %in% cols))
})

test_that("una pareja que no corresponde al archivo o repite una pregunta falla con su causa", {
  sid <- .cept_sesion()
  llamar <- function(parejas) {
    # Una carga fallida retira su subida del registro: cada intento sube la base.
    up <- .cept_subir(sid, .cept_base_digitada())
    # El endpoint devuelve el error serializado (wrap_endpoint).
    .bv_call(mount_carga_emparejamiento, "POST", "/api/carga/data/emparejamiento-texto/aplicar", sid,
             body = list(file_id = up$file_id, parejas = parejas))$error
  }
  e1 <- llamar(list(list(columna = 2, encabezado = "Otra cosa", name = "edad")))
  expect_identical(e1$code, "E_BAD_REQUEST")
  expect_match(e1$message, "vuelve a subir la base", fixed = TRUE)
  e2 <- llamar(list(list(columna = 2, encabezado = "P1. Edad cumplida", name = "edad"),
                    list(columna = 3, encabezado = "P2. ¿Trabajas actualmente?", name = "edad")))
  expect_match(e2$message, "\"edad\" quedó con dos columnas", fixed = TRUE)
  e3 <- llamar(list(list(columna = 2, encabezado = "P1. Edad cumplida", name = "inventada")))
  expect_match(e3$message, "\"inventada\" no es una pregunta del formulario", fixed = TRUE)
  # Ninguna falla deja algo cargado.
  expect_null(session_get(sid)$data_raw_meta)
})

test_that("una base CSV se carga emparejada con los mismos valores", {
  sid <- .cept_sesion()
  df <- .cept_base_digitada()
  path <- tempfile(fileext = ".csv")
  utils::write.csv(df, path, row.names = FALSE, fileEncoding = "UTF-8")
  up <- save_upload(sid, "data", "base.csv", readBin(path, "raw", file.info(path)$size))
  parejas <- .cept_parejas(carga_emparejar_por_texto_propuesta(sid, up))
  out <- carga_emparejar_por_texto_aplicar(sid, up, parejas)
  expect_true(isTRUE(out$ok))
  copia <- session_get(sid)$files[[session_get(sid)$data_raw_meta$file_id]]
  expect_identical(copia$ext, "csv")
  leida <- .read_data_any_path(copia$path, "csv")
  expect_identical(leida$distrito, c("080105", "Lima", "Cusco"))
})

test_that("el aviso de base que no calza da la misma cifra que la propuesta", {
  sid <- .cept_sesion()
  up <- .cept_subir(sid, .cept_base_digitada())
  e <- .bv_call(mount_carga, "POST", "/api/carga/data", sid, file_id = up$file_id)$error
  expect_identical(e$code, "E_DATA_XLSFORM_INCOMPATIBLE")
  expect_match(e$message, "6 de 9 encabezados de la base coinciden con el texto de una pregunta",
               fixed = TRUE)
  expect_identical(e$details$n_por_rotulo, 6L)
})

test_that("una copia que no trae los mismos valores no se carga", {
  sid <- .cept_sesion()
  up <- .cept_subir(sid, .cept_base_digitada())
  parejas <- .cept_parejas(carga_emparejar_por_texto_propuesta(sid, up))
  up2 <- .cept_subir(sid, .cept_base_digitada())
  local_mocked_bindings(.cet_mismo_contenido = function(a, b) FALSE)
  e <- .bv_call(mount_carga_emparejamiento, "POST", "/api/carga/data/emparejamiento-texto/aplicar", sid,
                body = list(file_id = up2$file_id, parejas = parejas))$error
  expect_identical(e$code, "E_EXPORT_COPY_FAILED")
  expect_match(e$message, "no trae los mismos valores que el original", fixed = TRUE)
  s <- session_get(sid)
  expect_null(s$data_raw_meta)
  expect_null(s$files[[up2$file_id]])
})

test_that("plumber_app monta el emparejamiento por texto", {
  src <- readLines(testthat::test_path("..", "..", "R", "plumber_app.R"), warn = FALSE)
  expect_true(any(grepl("pr <- mount_carga_emparejamiento(pr)", src, fixed = TRUE)))
})
