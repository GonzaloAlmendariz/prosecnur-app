# El Excel encuestador ↔ zona de un territorial por cuotas (ADR 0125 §2): una fila por zona con su cuota,
# se lee de vuelta por «Código de zona» y la asignación se guarda y se lee con `id_zona`. Sin red.

.mtxc_sesion <- function(caracter = list()) {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  s$hojas_ruta_runs <- list(field = .hojas_ruta_run_normalize(list(
    config = hojas_ruta_integrada_normalize_config(list(territorios = list("150103", "150132"), n_objetivo = 200L,
                                                        caracter_cuotas = caracter))), "field"))
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

test_that("la hoja de conteo sale una por zona y sólo en cuotas", {
  sid <- .mtxc_sesion(); on.exit(session_delete(sid), add = TRUE)
  m <- .mtp_conteo_matriz(list(list(sexo = "Mujer", rango_id = "r1", rango_edad = "18-29", n = 3L),
                               list(sexo = "Hombre", rango_id = "r1", rango_edad = "18-29", n = 2L),
                               list(sexo = "Mujer", rango_id = "r2", rango_edad = "30-44", n = 4L)))
  expect_identical(dimnames(m), list(c("18-29", "30-44"), c("Mujer", "Hombre")))
  expect_true(is.na(m["30-44", "Hombre"]))
  r <- collection_territorial_papel(sid, pieza = "conteo")
  expect_identical(r$umps, 2L)
  expect_identical(r$paginas, 2L)
  expect_match(r$filename, "^HojaConteo_2Zonas\\.pdf$")
  uno <- collection_territorial_papel(sid, pieza = "conteo", unidad = "150103")
  expect_identical(uno$paginas, 1L)
  expect_true(file.exists(session_get(sid)$files[[uno$file_id]]$path))
})

test_that("la hoja de conteo no se imprime para una muestra por UMP", {
  sid <- .hre_session(); on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP", fase = "field")
  e <- tryCatch(collection_territorial_papel(sid, pieza = "conteo"), api_error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_TERRITORIAL_PAPEL_PIEZA")
})

test_that("la excepción: dos personas en una zona, con su parte; si no cuadra, se avisa sin rechazar", {
  sid <- .mtxc_sesion(); on.exit(session_delete(sid), add = TRUE)
  n_ate <- collection_territorial_unidades(sid, "territorial.principal")$units[[1]]$n
  r <- collection_territorial_asignacion_put(sid, asignacion = list(
    list(id_zona = "150103", codigo = "P844", parte = 40L),
    list(id_zona = "150103", codigo = "P930", parte = n_ate - 40L),
    list(id_zona = "150132", codigo = "P930")))
  ate <- Filter(function(a) identical(a$id_zona, "150103"), r$asignacion)
  expect_length(ate, 2L)
  expect_identical(vapply(ate, `[[`, 0L, "parte"), c(40L, n_ate - 40L))
  # Una sola persona: su parte es la cuota entera.
  expect_identical(Filter(function(a) identical(a$id_zona, "150132"), r$asignacion)[[1]]$parte,
                   collection_territorial_unidades(sid, "territorial.principal")$units[[2]]$n)
  expect_length(r$cuadre, 1L)
  expect_true(r$cuadre[[1]]$cuadra)
  mal <- collection_territorial_asignacion_put(sid, asignacion = list(
    list(id_zona = "150103", codigo = "P844", parte = 10L), list(id_zona = "150103", codigo = "P930", parte = 10L)))
  expect_false(mal$cuadre[[1]]$cuadra)
  expect_identical(mal$cuadre[[1]]$suma, 20L)

  # El Excel: una fila por persona; la cuota de la zona sólo en la primera, y se relee con sus partes.
  collection_territorial_asignacion_put(sid, asignacion = list(
    list(id_zona = "150103", codigo = "P844", parte = 40L), list(id_zona = "150103", codigo = "P930", parte = n_ate - 40L)))
  x <- collection_territorial_asignacion_excel(sid)
  expect_identical(x$filas, 3L)
  path <- session_get(sid)$files[[x$file_id]]$path
  t <- openxlsx::read.xlsx(path, sheet = "Asignación", startRow = 4, check.names = FALSE, sep.names = " ")
  t <- t[!is.na(t[["Código de zona"]]), , drop = FALSE]
  expect_identical(as.character(t[["Código de zona"]]), c("150103", "150103", "150132"))
  expect_identical(as.integer(t$Entrevistas[1:2]), c(n_ate, NA))
  expect_identical(as.integer(t[["Parte de la cuota"]][1:2]), c(40L, n_ate - 40L))
  imp <- collection_territorial_asignacion_importar(sid, file_raw = readBin(path, "raw", file.info(path)$size))
  expect_length(imp$problemas, 0L)
  ate_imp <- Filter(function(p) identical(p$id_manzana, "150103"), imp$propuesta)
  expect_identical(vapply(ate_imp, `[[`, "", "codigo"), c("P844", "P930"))
  expect_identical(vapply(ate_imp, `[[`, 0L, "parte"), c(40L, n_ate - 40L))
})

test_that("con un envío por cuotas, `envio$sample` no casa por prefijo con sample_fingerprint (aviso de Monitoreo, D14)", {
  sid <- .mtxc_sesion(); on.exit(session_delete(sid), add = TRUE)
  envio <- .mcamp_territorial_envio(session_get(sid), "field")
  expect_identical(envio$kind, "cuotas")
  expect_true(is.character(envio$sample))  # la trampa: `$` completa a sample_fingerprint
  expect_null(envio[["sample"]])
  # El plan y la hoja del día son de UMP: con cuotas dicen que no hay muestra, no revientan.
  e <- tryCatch(collection_territorial_plan(sid), api_error = function(e) e, error = function(e) e)
  expect_s3_class(e, "api_error")
  expect_identical(e$code, "E_COLLECTION_TERRITORIAL_SIN_FUENTE")
  expect_length(.mtr_celdas(envio)$cuota %||% list(), 0L)
  expect_true(is.list(hojas_ruta_envio_meta(session_get(sid)$hojas_ruta_runs$field)))
})

test_that("la hoja de conteo sólo ordena cortar lo que se exige (ADR 0126)", {
  # Sin declaración: los textos de siempre.
  base <- .mtp_conteo_textos(list())
  expect_identical(base$celda, "cuota")
  expect_match(base$corte, "^Cuando una celda llega a su cuota")
  expect_identical(.mtp_conteo_subtitulo(120L), "120 entrevistas por cuota de sexo y edad")
  # El sexo es referencia: se exige la fila de edad.
  sexo <- .mtp_conteo_textos(list(sexo = "referencial"))
  expect_identical(sexo$celda, "referencia")
  expect_identical(sexo$ultima, "Meta de la fila")
  expect_true(sexo$fila_meta)
  expect_false(grepl("celda llega a su cuota", sexo$corte))
  # La edad es referencia: se exige el total por sexo.
  edad <- .mtp_conteo_textos(list(edad = "referencial"))
  expect_identical(edad$total, "Meta por sexo")
  expect_true(edad$total_meta)
  # Las dos: sólo el total de la zona.
  dos <- .mtp_conteo_textos(list(sexo = "referencial", edad = "referencial"))
  expect_match(dos$corte, "^Sólo se exige el total de la zona")
})

test_that("la marca viaja de Hojas de ruta a la unidad de la campaña y a la hoja de conteo", {
  sid <- .mtxc_sesion(list(sexo = "referencial")); on.exit(session_delete(sid), add = TRUE)
  u <- collection_territorial_unidades(sid, "territorial.principal")$units[[1]]
  expect_identical(u$caracter, list(sexo = "referencial"))
  r <- collection_territorial_papel(sid, pieza = "conteo", unidad = "150103")
  expect_identical(r$paginas, 1L)
  # Sin declarar, la unidad no lleva el campo.
  sid2 <- .mtxc_sesion(); on.exit(session_delete(sid2), add = TRUE)
  expect_null(collection_territorial_unidades(sid2, "territorial.principal")$units[[1]]$caracter)
})
