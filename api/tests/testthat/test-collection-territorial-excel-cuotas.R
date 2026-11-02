# El Excel encuestador ↔ zona de un territorial por cuotas (ADR 0125 §2): una fila por zona con su cuota,
# se lee de vuelta por «Código de zona» y la asignación se guarda y se lee con `id_zona`. Sin red.

.mtxc_sesion <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  s$hojas_ruta_runs <- list(field = .hojas_ruta_run_normalize(list(
    config = hojas_ruta_integrada_normalize_config(list(territorios = list("150103", "150132"), n_objetivo = 200L))), "field"))
  s$monitoreo_config$territorial$enumerator_roster <- list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P844", nombre = "Encuestador Ejemplo Uno", dni = "40000001"),
    list(codigo_pulso = "P930", nombre = "Encuestadora Ejemplo Dos", dni = "40000002")))
  .session_env[[sid]] <- s
  hojas_ruta_enviar_cuotas(sid, "field")
  collection_campaign_create(sid, "territorial", "Cuotas Lima", fase = "field")
  sid
}

test_that("la asignación por zona se guarda y se lee con id_zona", {
  sid <- .mtxc_sesion(); on.exit(session_delete(sid), add = TRUE)
  vacia <- collection_territorial_asignacion_get(sid)
  expect_identical(vacia$kind, "cuotas")
  expect_length(vacia$asignacion, 0L)
  r <- collection_territorial_asignacion_put(sid, asignacion = list(list(id_zona = "150103", codigo = "P844")))
  expect_length(r$asignacion, 1L)
  expect_identical(r$asignacion[[1]]$id_zona, "150103")
  expect_identical(r$asignacion[[1]]$role, "zona")
  expect_identical(r$asignacion[[1]]$codigo, "P844")
  # Una zona que no se envió no se asigna.
  expect_error(collection_territorial_asignacion_put(sid, asignacion = list(list(id_zona = "150199", codigo = "P844"))),
               class = "api_error")
})

test_that("el Excel tiene una fila por zona con su cuota, y se lee de vuelta por «Código de zona»", {
  sid <- .mtxc_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_zona = "150132", codigo = "P930")))
  r <- collection_territorial_asignacion_excel(sid)
  expect_identical(r$kind, "cuotas")
  expect_identical(r$zonas, 2L)
  path <- session_get(sid)$files[[r$file_id]]$path
  t <- openxlsx::read.xlsx(path, sheet = "Asignación", startRow = 4, check.names = FALSE, sep.names = " ")
  t <- t[!is.na(t[["Código de zona"]]), , drop = FALSE]
  expect_identical(as.character(t[["Código de zona"]]), c("150103", "150132"))
  # Las celdas van entre Entrevistas y Encuestador, rotuladas «Sexo · rango».
  celdas <- names(t)[seq(match("Entrevistas", names(t)) + 1L, match("Encuestador", names(t)) - 1L)]
  expect_gt(length(celdas), 0L)
  expect_true(all(grepl("^(Hombre|Mujer) · ", celdas)))
  # Cada fila cuadra: la suma de sus cuotas es su N.
  expect_equal(unname(rowSums(t[celdas], na.rm = TRUE)), t$Entrevistas)
  expect_identical(t$Encuestador[[2]], "P930 · Encuestadora Ejemplo Dos")
  expect_identical(t$Encuestador[[1]], "")

  # Campo llena la otra zona y la app lo lee como propuesta por zona.
  wb <- openxlsx::loadWorkbook(path)
  openxlsx::writeData(wb, "Asignación", "P844 · Encuestador Ejemplo Uno", startCol = match("Encuestador", names(t)), startRow = 5)
  out <- tempfile(fileext = ".xlsx"); openxlsx::saveWorkbook(wb, out)
  imp <- collection_territorial_asignacion_importar(sid, file_raw = readBin(out, "raw", file.info(out)$size))
  expect_length(imp$problemas, 0L)
  expect_setequal(vapply(imp$propuesta, `[[`, "", "id_manzana"), c("150103", "150132"))
  expect_identical(imp$resumen$titulares, 2L)
  expect_identical(imp$resumen$titulares_con_encuestador, 2L)
  expect_false(imp$otra_muestra)
})
