# El Excel con el que campo asigna UMP a encuestadores (checklist-formatos-campo C1/C3).
# Se genera desde la foto enviada con la lista de Monitoreo y se lee de vuelta sin escribir.

.mtx_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mtx_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  sid <- .hre_session()
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster <- list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P844", nombre = "Encuestador Ejemplo Uno", dni = "40000001"),
    list(codigo_pulso = "P930", nombre = "Encuestadora Ejémplo Dos", dni = "40000002")))
  .session_env[[sid]] <- s
  sid
}

T1 <- "150101001001"; T2 <- "150101001002"; R1 <- "150101001009"

.mtx_generar <- function(sid) {
  r <- collection_territorial_asignacion_excel(sid)
  list(r = r, path = session_get(sid)$files[[r$file_id]]$path)
}

# Reescribe la columna Encuestador de la hoja Asignación como lo haría campo.
.mtx_llenar <- function(path, valores) {
  wb <- openxlsx::loadWorkbook(path)
  t <- openxlsx::read.xlsx(path, sheet = "Asignación", startRow = 4)
  col <- match("Encuestador", names(t))
  for (id in names(valores)) {
    fila <- match(id, as.character(t[["Código.de.manzana"]]))
    openxlsx::writeData(wb, "Asignación", valores[[id]], startCol = col, startRow = 4 + fila)
  }
  out <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, out)
  readBin(out, "raw", file.info(out)$size)
}

test_that("generar: una fila por UMP de la foto, la lista sin DNI y lo ya asignado escrito", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  g <- .mtx_generar(sid)
  expect_identical(g$r$umps, 3L)
  expect_true(file.exists(g$path))
  expect_identical(openxlsx::getSheetNames(g$path), c("Asignación", "Registro", "Encuestadores", "Control"))
  t <- openxlsx::read.xlsx(g$path, sheet = "Asignación", startRow = 4)
  # Cada reemplazo debajo de su titular.
  expect_identical(as.character(t[["Código.de.manzana"]]), c(T1, R1, T2))
  expect_identical(t$Tipo, c("Titular", "Reemplazo", "Titular"))
  expect_identical(t$Reemplaza.a[[2]], "UMP 1")
  expect_identical(t$Encuestador[[1]], "P844 · Encuestador Ejemplo Uno")
  expect_true(t$Encuestador[[2]] %in% c(NA, ""))  # el reemplazo hereda: no se escribe
  eq <- openxlsx::read.xlsx(g$path, sheet = "Encuestadores")
  expect_false(any(grepl("40000001", unlist(eq))))
})

test_that("importar: lee la etiqueta, el código suelto y el nombre; es puro y lo aplica el PUT", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  g <- .mtx_generar(sid)
  raw <- .mtx_llenar(g$path, list(`150101001001` = "P844 · Encuestador Ejemplo Uno", `150101001002` = "930",
                                  `150101001009` = "encuestadora ejemplo dos"))
  antes <- session_get(sid)$material_territorial_asignacion
  r <- collection_territorial_asignacion_importar(sid, file_raw = raw)
  expect_identical(session_get(sid)$material_territorial_asignacion, antes)
  por_id <- stats::setNames(vapply(r$propuesta, `[[`, "", "codigo"), vapply(r$propuesta, `[[`, "", "id_manzana"))
  expect_identical(por_id[[T1]], "P844")
  expect_identical(por_id[[T2]], "P930")
  expect_identical(por_id[[R1]], "P930")  # distinto de su titular: se guarda aparte
  expect_length(r$problemas, 0L)
  expect_identical(r$resumen$titulares_con_encuestador, 2L)
  expect_false(r$otra_muestra)
  a <- collection_territorial_asignacion_put(sid, asignacion = r$propuesta)
  expect_identical(a$asignacion_revision, 1L)
})

test_that("importar: el reemplazo con el mismo encuestador hereda; lo desconocido y lo ajeno se reportan por fila", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  g <- .mtx_generar(sid)
  raw <- .mtx_llenar(g$path, list(`150101001001` = "P844", `150101001009` = "P844", `150101001002` = "Juan Pérez"))
  r <- collection_territorial_asignacion_importar(sid, file_raw = raw)
  expect_identical(vapply(r$propuesta, `[[`, "", "id_manzana"), T1)
  expect_length(r$problemas, 1L)
  expect_identical(r$problemas[[1]]$id_manzana, T2)
  expect_match(r$problemas[[1]]$motivo, "lista de encuestadores")
  expect_identical(r$problemas[[1]]$fila, 7L)
})

test_that("importar: cuenta las UMP que perderían encuestador y recupera el cero que Sheets quitó", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844"), list(id_manzana = T2, codigo = "P930"),
                                                               list(id_manzana = R1, codigo = "P930")))
  g <- .mtx_generar(sid)
  raw <- .mtx_llenar(g$path, list(`150101001001` = "P930", `150101001002` = ""))  # T2 se vacía; R1 pasa a heredar P930 de T1
  r <- collection_territorial_asignacion_importar(sid, file_raw = raw)
  expect_identical(r$resumen$pierden_encuestador, 1L)
  # Un id que perdió el cero inicial (columna numérica) se casa con el de la muestra.
  expect_identical(.mtx_texto_id(c(150101001001, NA, 1.5)), c("150101001001", "", "1.5"))
})

test_that("importar: lee el Excel operativo viejo («Codigo manzana», «Encuestador») y avisa si es de otra muestra", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  wb <- openxlsx::createWorkbook(); openxlsx::addWorksheet(wb, "Hojas_de_ruta")
  openxlsx::writeData(wb, "Hojas_de_ruta", "Excel operativo de hojas de ruta", startRow = 1)
  openxlsx::writeData(wb, "Hojas_de_ruta", data.frame(Ruta = 1:2, `Codigo manzana` = c(T1, "999"), Encuestador = c("P930", "P844"),
                                                      check.names = FALSE), startRow = 7)
  openxlsx::addWorksheet(wb, "Control")
  openxlsx::writeData(wb, "Control", data.frame(c("sample_fingerprint"), c("sha256:otra")), colNames = FALSE)
  f <- tempfile(fileext = ".xlsx"); openxlsx::saveWorkbook(wb, f)
  r <- collection_territorial_asignacion_importar(sid, file_raw = readBin(f, "raw", file.info(f)$size))
  expect_identical(r$hoja, "Hojas_de_ruta")
  expect_identical(r$propuesta[[1]]$codigo, "P930")
  expect_match(r$problemas[[1]]$motivo, "no está en la muestra")
  expect_true(r$otra_muestra)
})

test_that("generar e importar exigen lista de Monitoreo y foto vigente; un archivo que no es Excel es 422", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mtx_code(collection_territorial_asignacion_importar(sid, file_raw = charToRaw("hola"))),
                   "E_COLLECTION_TERRITORIAL_EXCEL_ILEGIBLE")
  s <- session_get(sid); s$monitoreo_config$territorial$enumerator_roster <- list(); .session_env[[sid]] <- s
  expect_identical(.mtx_code(collection_territorial_asignacion_excel(sid)), "E_COLLECTION_TERRITORIAL_SIN_EQUIPO")
  s$hojas_ruta_runs$field$workspace_outputs$sample <- .hre_sample(viviendas = 7L); .session_env[[sid]] <- s
  expect_identical(.mtx_code(collection_territorial_asignacion_excel(sid)), "E_COLLECTION_TERRITORIAL_DESACTUALIZADA")
})

test_that("el equipo es el roster de Monitoreo; el del Planner sólo es respaldo con el roster vacío (ADR 0123, Q3)", {
  sid <- .mtx_sesion(); on.exit(session_delete(sid), add = TRUE)
  .planner_sembrar_legado(sid, "equipo", list(code_format = "PXXX", personas = list(
    list(codigo = "P101", nombre = "Encuestador Planner", rol = "encuestador", perfiles = list()),
    list(codigo = "P102", nombre = "Inactiva Planner", rol = "encuestador", perfiles = list(), activo = FALSE),
    list(codigo = "A01", nombre = "Aplicadora", rol = "aplicador", perfiles = list()))))
  # Con roster en Monitoreo, manda Monitoreo aunque el Planner tenga equipo declarado.
  eq <- .mta_equipo(session_get(sid))
  expect_identical(eq$origen, "monitoreo")
  expect_false("P101" %in% vapply(eq$equipo, `[[`, "", "codigo"))
  # Con el roster vacío, el del Planner es el respaldo (sólo activos).
  s <- session_get(sid); s$monitoreo_config$territorial$enumerator_roster <- list(); .session_env[[sid]] <- s
  eq <- .mta_equipo(session_get(sid))
  expect_identical(eq$origen, "planner")
  expect_identical(vapply(eq$equipo, `[[`, "", "codigo"), "P101")
  g <- .mtx_generar(sid)
  lista <- openxlsx::read.xlsx(g$path, sheet = "Encuestadores")
  expect_identical(lista$Código, "P101")
  # Un respaldo con códigos DNI no entrega a nadie.
  .planner_sembrar_legado(sid, "equipo", list(code_format = "DNI", personas = list(
    list(codigo = "40000009", nombre = "X", rol = "encuestador", perfiles = list()))))
  expect_identical(.mtx_code(collection_territorial_asignacion_excel(sid)), "E_COLLECTION_TERRITORIAL_SIN_EQUIPO")
})
