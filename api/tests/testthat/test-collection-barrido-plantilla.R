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
  expect_true(all(c("modulo", "rotulo", "guardado_en", "aviso_guardado", "size") %in% names(r)))  # ADR 0133, fase 5
  l <- .mbp_libro(sid, r)
  expect_identical(names(l$wb), c("Léeme", "Barrido", "Asignaciones", "Indicadores", "Incidencias", "Listas", "Parámetros", "Control"))
  cab <- names(openxlsx::read.xlsx(l$path, sheet = "Barrido", check.names = FALSE, sep.names = " "))
  # T1: el correlativo de Pulso va primero; T7: sin backup no hay Origen ni Tanda.
  expect_identical(cab[1:3], c("Cod pulso", "Código proGres", "Nombre"))
  expect_false(any(c("Origen", "Tanda") %in% cab))
  barrido <- openxlsx::read.xlsx(l$path, sheet = "Barrido", check.names = FALSE, sep.names = " ")
  expect_identical(barrido[["Cod pulso"]], as.numeric(1:300))
  expect_true(all(c("Teléfono 1", "Teléfono 3", "Periodo de Llegada") %in% cab))
  expect_identical(utils::tail(cab, 6), c("Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", "Observación"))
  expect_false("Reemplaza a" %in% cab)
  listas <- openxlsx::read.xlsx(l$path, sheet = "Listas", check.names = FALSE, sep.names = " ")
  expect_identical(nrow(listas[!is.na(listas$Status), ]), 14L)
  expect_true(all(c("Efectivo", "Rechazo") %in% listas$Status))
  expect_setequal(stats::na.omit(listas$Clase), c("efectiva", "pendiente", "no_contacto", "rechazo", "invalido"))
  # Catálogo real del RMS: el orden y la ortografía de su Sheets.
  expect_identical(listas$Status[1:2], c("No barrido", "Efectivo"))
  expect_true("Número Incorrecto" %in% listas$Status)
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
  propio <- list(list(codigo = "ef", status = "Efectivo", clase = "efectiva"), list(codigo = "re", status = "Rechazo", clase = "rechazo"))
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

test_that("T2/T4/T5/T7: identidad bloqueada, Indicadores por fórmula, Incidencias y Origen sólo con backup", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_barrido_plantilla(sid, llave = "Código proGres", estratos = list("Periodo de Llegada"), reemplazo = TRUE,
                                    responsables = list("Agente Uno"), filas = 50)
  path <- session_get(sid)$files[[r$file_id]]$path
  cab <- names(openxlsx::read.xlsx(path, sheet = "Barrido", check.names = FALSE, sep.names = " "))
  expect_identical(cab[1:4], c("Cod pulso", "Código proGres", "Origen", "Tanda"))
  # Estilos de la fila 2: la identidad hereda «locked» (no trae createStyle(locked = FALSE)); la cola sí.
  dir <- tempfile(); utils::unzip(path, exdir = dir)
  xml_estilos <- paste(readLines(file.path(dir, "xl/styles.xml"), warn = FALSE), collapse = "")
  expect_match(xml_estilos, "locked=\"0\"", fixed = TRUE)
  # El XML de cada hoja se numera por orden de creación: se busca en todas.
  ind <- paste(unlist(lapply(list.files(file.path(dir, "xl/worksheets"), "\\.xml$", full.names = TRUE),
                             function(f) readLines(f, warn = FALSE))), collapse = "")
  expect_match(ind, "COUNTIFS(INDEX(", fixed = TRUE)
  expect_match(ind, "Efectivo", fixed = TRUE)
  expect_match(ind, "Agente Uno|COUNTIFS\\(", perl = TRUE)
  inc <- names(openxlsx::read.xlsx(path, sheet = "Incidencias", check.names = FALSE, sep.names = " "))
  expect_identical(inc, c("Fecha", "Caso", "Responsable", "Incidencia", "Resolución"))
  leeme <- openxlsx::read.xlsx(path, sheet = "Léeme", colNames = FALSE)[[1]]
  expect_true(any(grepl("desprotege la hoja", leeme)))
})

test_that("T11–T15: Asignaciones, reemplazo al final, rótulo de la observación, columnas sensibles y hasta 4 teléfonos", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_barrido_plantilla(sid, llave = "Código proGres", estratos = list("Estatus Legal", "Periodo de Llegada"),
                                    telefonos = 4, reemplazo = TRUE, responsables = list("Agente Uno", "Agente Dos"),
                                    observacion = "Observaciones", sensibles = list("Estatus Legal"), filas = 40)
  l <- .mbp_libro(sid, r)
  cab <- names(openxlsx::read.xlsx(l$path, sheet = "Barrido", check.names = FALSE, sep.names = " "))
  expect_true("Teléfono 4" %in% cab)
  # T12: la cola contigua, la observación con su rótulo y el reemplazo al final.
  expect_identical(utils::tail(cab, 9), c("Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", "Observaciones",
                                          "Reemplaza a", "Reemplazado por", "¿Se reemplaza con el Backup?"))
  # T14: la sensible se declara en la respuesta, en Control y en el Léeme.
  expect_identical(unlist(r$sensibles), "Estatus Legal")
  control <- openxlsx::read.xlsx(l$path, sheet = "Control", colNames = FALSE)
  expect_identical(control[[2]][control[[1]] == "sensibles"], "Estatus Legal")
  leeme <- unlist(openxlsx::read.xlsx(l$path, sheet = "Léeme", colNames = FALSE))
  expect_true(any(grepl("sensibles.*Estatus Legal", leeme)))
  # T11: Responsable y Casos asignados, por fórmula sobre la hoja Barrido.
  asig <- openxlsx::read.xlsx(l$path, sheet = "Asignaciones", check.names = FALSE, sep.names = " ")
  expect_identical(names(asig)[1:2], c("Responsable", "Casos asignados"))
  expect_identical(asig$Responsable[1:2], c("Agente Uno", "Agente Dos"))
  f <- l$wb$worksheets[[match("Asignaciones", names(l$wb))]]$sheet_data$f
  expect_true(any(grepl("COUNTIF('Barrido'", gsub("&apos;", "'", f), fixed = TRUE)))
  # Lo que no es un estrato no se marca sensible; 5 teléfonos es demasiado.
  expect_identical(.mbp_code(collection_barrido_plantilla(sid, estratos = list("Sede"), sensibles = list("Nombre"))),
                   "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA")
  expect_identical(.mbp_code(collection_barrido_plantilla(sid, telefonos = 5)), "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA")
})

test_that("la campaña telefónica guarda la observación y las sensibles y arma la plantilla con ellas", {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE)
  sid <- .hre_session(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "RMS")
  g <- collection_telefonica_config_put(sid, estratos = list("Estatus Legal"), observacion = "Observaciones",
                                        sensibles = list("Estatus Legal"), telefonos = 4)
  expect_identical(g$observacion, "Observaciones")
  expect_identical(unlist(g$sensibles), "Estatus Legal")
  expect_identical(g$telefonos, 4L)
  r <- collection_telefonica_plantilla(sid)
  expect_true("Observaciones" %in% unlist(r$columnas))
  expect_identical(unlist(r$sensibles), "Estatus Legal")
})
