# La plantilla del barrido telefónico (C8): columnas fijas, listas, validaciones,
# encabezados protegidos y el sello en Control.

.mbp_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mbp_libro <- function(sid, r) {
  path <- session_get(sid)$files[[r$file_id]]$path
  list(path = path, wb = openxlsx::loadWorkbook(path))
}

test_that("el libro trae las cinco hojas, la identidad del estudio y la cola idéntica al final", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_barrido_plantilla(sid, estudio = "RMS prueba", llave = "Código proGres", estratos = list("Periodo de Llegada"),
                                    telefonos = 3, responsables = list("Responsable", "Agente Uno", "Agente Dos"), filas = 300)
  l <- .mbp_libro(sid, r)
  expect_identical(names(l$wb), c("Léeme", "Barrido", "Listas", "Parámetros", "Control"))
  cab <- names(openxlsx::read.xlsx(l$path, sheet = "Barrido", check.names = FALSE, sep.names = " "))
  expect_identical(cab[1:4], c("Código proGres", "Origen", "Tanda", "Nombre"))
  expect_true(all(c("Teléfono 1", "Teléfono 3", "Periodo de Llegada") %in% cab))
  expect_identical(utils::tail(cab, 6), c("Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", "Observación"))
  expect_false("Reemplaza a" %in% cab)
  listas <- openxlsx::read.xlsx(l$path, sheet = "Listas", check.names = FALSE, sep.names = " ")
  expect_identical(nrow(listas[!is.na(listas$Status), ]), 14L)
  expect_true(all(c("Efectivo", "Rechazo") %in% listas$Status))
  expect_setequal(stats::na.omit(listas$Clase), c("efectivo", "en_gestion", "reintentable", "terminal"))
  # El rótulo de la columna no es una opción de Responsable (caso RMS).
  expect_identical(stats::na.omit(listas$Responsable)[1:2], c("Agente Uno", "Agente Dos"))
  expect_false("Responsable" %in% listas$Responsable)
  control <- openxlsx::read.xlsx(l$path, sheet = "Control", colNames = FALSE)
  expect_identical(control[[2]][control[[1]] == "plantilla"], "barrido_telefonico/v1")
  expect_identical(r$filas, 300L)
})

test_that("la hoja va protegida con el cuerpo editable hasta la última fila y las validaciones apuntan a Listas", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_barrido_plantilla(sid, filas = 1200, reemplazo = TRUE)
  l <- .mbp_libro(sid, r)
  ws <- l$wb$worksheets[[match("Barrido", names(l$wb))]]
  expect_match(ws$sheetProtection, "sheet=\"1\"")
  dv <- paste(ws$dataValidations, collapse = "\n")
  # Las listas que apuntan a otra hoja se escriben en el extLst (x14): se leen del XML.
  dir <- tempfile(); utils::unzip(l$path, exdir = dir)
  xml <- paste(readLines(file.path(dir, "xl/worksheets/sheet2.xml"), warn = FALSE), collapse = "")
  expect_true(grepl("'Listas'!\\$B\\$2:\\$B\\$15</xm:f></x14:formula1><xm:sqref>[A-Z]+2:[A-Z]+1201<", xml))
  expect_match(dv, "type=\"whole\"")
  expect_match(dv, "type=\"date\"")
  expect_match(dv, "1201", fixed = TRUE)
  expect_true("Reemplaza a" %in% names(openxlsx::read.xlsx(l$path, sheet = "Barrido", check.names = FALSE, sep.names = " ")))
})

test_that("un catálogo propio reemplaza al de defecto y lo malo es 422", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  propio <- list(list(codigo = "ef", status = "Efectivo", clase = "efectivo"), list(codigo = "RE", status = "Rechazo", clase = "terminal"))
  r <- collection_barrido_plantilla(sid, status = propio)
  expect_identical(r$status, 2L)
  expect_identical(.mbp_code(collection_barrido_plantilla(sid, status = list(list(codigo = "X", status = "Raro", clase = "otra")))),
                   "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA")
  expect_identical(.mbp_code(collection_barrido_plantilla(sid, telefonos = 5)), "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA")
  expect_identical(.mbp_code(collection_barrido_plantilla(sid, estratos = list("Status"))), "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA")
})

test_that("HTTP: POST de la plantilla devuelve el archivo registrado", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/recopiladores/barrido/plantilla", body = .hre_json(list(llave = "Código proGres", estratos = list("Sede"))))
  expect_identical(r$status, 200L)
  expect_true(nzchar(r$body$file_id))
})
