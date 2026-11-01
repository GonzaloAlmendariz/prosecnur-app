# Registro del coordinador (informe de brechas §1C): pestañas por región en el Excel de
# asignación, metas de cuota desde Hojas de ruta, y lectura de vuelta publicada por el GET.

.mtr_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  m <- .hre_sample()
  # Dos regiones y las marginales que Hojas de ruta reparte por ficha.
  m$blocks[[1]]$departamento <- "Lima"; m$blocks[[2]]$departamento <- "Cusco"
  m$replacement_blocks[[1]]$departamento <- "Lima"
  for (i in 1:2) { m$blocks[[i]]$cuota_sexo_totals <- "3,2"; m$blocks[[i]]$cuota_edad_totals <- "1,1,1,1,1,0" }
  sid <- .hre_session(field = m)
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster <- list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P844", nombre = "Encuestador Ejemplo Uno", dni = "40000001")))
  .session_env[[sid]] <- s
  sid
}

T1 <- "150101001001"; T2 <- "150101001002"; R1 <- "150101001009"

.mtr_tabla <- function(path, hoja) openxlsx::read.xlsx(path, sheet = hoja, startRow = 4, check.names = FALSE, sep.names = " ")

test_that("generar: una pestaña por región, metas de Hojas de ruta, sin Estado ni Reporte", {
  sid <- .mtr_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  r <- collection_territorial_asignacion_excel(sid)
  path <- session_get(sid)$files[[r$file_id]]$path
  expect_identical(openxlsx::getSheetNames(path), c("Asignación", "Registro Lima", "Registro Cusco", "Encuestadores", "Control"))
  lima <- .mtr_tabla(path, "Registro Lima")
  expect_identical(as.character(lima[["Código de manzana"]]), c(T1, R1))  # el reemplazo va con su titular
  expect_identical(lima[["Meta · Hombre"]], c(3, 3))                       # el reemplazo hereda la cuota
  expect_identical(lima[["Meta · Mujer"]], c(3, 3) - 1)
  metas <- grep("^Meta · ", names(lima), value = TRUE)
  expect_length(metas, 2L + 6L)
  expect_true(all(c("Efectivas · Hombre", "1 · No quiso participar", "Fecha de visita", "¿Se reemplaza?",
                    "Supervisión: aprobadas", "Supervisión: no aprobadas") %in% names(lima)))
  expect_false(any(c("8 · Encuesta efectiva", "Estado") %in% names(lima)))  # el efectivo sale de las celdas; el Estado es de Monitoreo
  expect_false(any(grepl("Reporte", openxlsx::getSheetNames(path))))
  # La Asignación ya no trae columnas de conteo.
  expect_false(any(grepl("^[0-9]+ · ", names(.mtr_tabla(path, "Asignación")))))
  # El encuestador del Registro es una fórmula que lee la Asignación.
  wb <- openxlsx::loadWorkbook(path)
  hoja <- wb$worksheets[[match("Registro Lima", names(wb))]]
  expect_true(any(grepl("INDEX(", hoja$sheet_data$f, fixed = TRUE) & grepl("Asignación", hoja$sheet_data$f, fixed = TRUE)))
})

test_that("importar: lee efectivas por celda, conteos, visita, reemplazo y supervisión; el GET los publica", {
  sid <- .mtr_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_territorial_asignacion_excel(sid)
  path <- session_get(sid)$files[[r$file_id]]$path
  wb <- openxlsx::loadWorkbook(path)
  poner <- function(hoja, id, valores) {
    t <- .mtr_tabla(path, hoja)
    fila <- match(id, as.character(t[["Código de manzana"]]))
    for (k in names(valores)) openxlsx::writeData(wb, hoja, valores[[k]], startCol = match(k, names(t)), startRow = 4 + fila)
  }
  edades <- sub("^Meta · ", "", grep("^Meta · ", names(.mtr_tabla(path, "Registro Lima")), value = TRUE))[-(1:2)]
  poner("Registro Lima", T1, c(list(`Efectivas · Hombre` = 2, `Efectivas · Mujer` = 1, `1 · No quiso participar` = 4,
                                    `Fecha de visita` = as.Date("2026-11-04"), `¿Se reemplaza?` = "no",
                                    `Supervisión: aprobadas` = 1, `Supervisión: no aprobadas` = 0),
                               stats::setNames(list(2, 1), paste0("Efectivas · ", edades[1:2]))))
  poner("Registro Cusco", T2, c(list(`Efectivas · Hombre` = 1, `Efectivas · Mujer` = 1, `¿Se reemplaza?` = "Tal vez",
                                     `Supervisión: aprobadas` = "x"), stats::setNames(list(1), paste0("Efectivas · ", edades[1]))))
  f <- tempfile(fileext = ".xlsx"); openxlsx::saveWorkbook(wb, f)
  imp <- collection_territorial_asignacion_importar(sid, file_raw = readBin(f, "raw", file.info(f)$size))
  e1 <- Filter(function(e) identical(e$id_manzana, T1), imp$estados)[[1]]
  expect_identical(e1$efectivas$sexo, list(Hombre = 2L, Mujer = 1L))
  expect_identical(unname(unlist(e1$efectivas$edad)), c(2L, 1L))
  expect_identical(e1$conteos, list(`1` = 4L, `8` = 3L))  # el código efectivo es la suma por sexo
  expect_identical(e1$fecha_visita, "2026-11-04")
  expect_identical(e1$se_reemplaza, "No")
  expect_identical(e1$supervision, list(aprobadas = 1L, no_aprobadas = 0L))
  motivos <- vapply(imp$problemas, `[[`, "", "motivo")
  expect_true(any(grepl("no es Sí ni No", motivos)))
  expect_true(any(grepl("Supervisión: aprobadas", motivos)))
  expect_true(any(grepl("por sexo y por edad no suman", motivos)))  # T2: 2 por sexo y 1 por edad; T1 cuadra
  expect_identical(imp$resumen$registro_declarado, 2L)

  collection_territorial_asignacion_put(sid, asignacion = imp$propuesta, estados = imp$estados)
  g <- collection_territorial_estado_get(sid)
  expect_false(g$es_avance)
  u1 <- Filter(function(u) identical(u$id_manzana, T1), g$unidades)[[1]]
  expect_identical(u1$efectivas$sexo, list(Hombre = 2L, Mujer = 1L))
  expect_identical(u1$supervision, list(aprobadas = 1L, no_aprobadas = 0L))
  expect_identical(u1$se_reemplaza, "No")
  sin <- Filter(function(u) identical(u$id_manzana, R1), g$unidades)[[1]]
  expect_identical(jsonlite::toJSON(sin$supervision, auto_unbox = TRUE), structure("{}", class = "json"))
})

test_that("conveniencia (1A, desde el Planner): seguimiento con Estado calculado y total reportado, sin códigos ni reemplazo", {
  sid <- .mtr_sesion(); on.exit(session_delete(sid), add = TRUE)
  local_mocked_bindings(.planner_payload_perfiles = function(s) list(list(tipo = "territorial", seleccion = "conveniencia")))
  r <- collection_territorial_asignacion_excel(sid)
  expect_identical(r$variante, "conveniencia")
  path <- session_get(sid)$files[[r$file_id]]$path
  lima <- .mtr_tabla(path, "Registro Lima")
  expect_true(all(c("Efectivas · Hombre", "Total efectivas", "Estado", "Total reportado por coordinación",
                    "Supervisión: aprobadas") %in% names(lima)))
  expect_false(any(grepl("^[0-9]+ · ", names(lima))))
  expect_false("¿Se reemplaza?" %in% names(lima))
  wb <- openxlsx::loadWorkbook(path)
  f_est <- wb$worksheets[[match("Registro Lima", names(wb))]]$sheet_data$f
  expect_true(any(grepl("Completa", f_est, fixed = TRUE) & grepl("Sin iniciar", f_est, fixed = TRUE)))  # el Estado es fórmula
  t <- lima; fila <- match(T1, as.character(t[["Código de manzana"]]))
  openxlsx::writeData(wb, "Registro Lima", 3, startCol = match("Efectivas · Hombre", names(t)), startRow = 4 + fila)
  openxlsx::writeData(wb, "Registro Lima", 4, startCol = match("Total reportado por coordinación", names(t)), startRow = 4 + fila)
  f <- tempfile(fileext = ".xlsx"); openxlsx::saveWorkbook(wb, f)
  imp <- collection_territorial_asignacion_importar(sid, file_raw = readBin(f, "raw", file.info(f)$size))
  e1 <- Filter(function(e) identical(e$id_manzana, T1), imp$estados)[[1]]
  expect_identical(e1$total_reportado, 4L)
  expect_identical(e1$efectivas$sexo, list(Hombre = 3L))
  collection_territorial_asignacion_put(sid, asignacion = imp$propuesta, estados = imp$estados)
  g <- collection_territorial_estado_get(sid)
  expect_identical(g$variante, "conveniencia")
  expect_identical(Filter(function(u) identical(u$id_manzana, T1), g$unidades)[[1]]$total_reportado, 4L)
})
