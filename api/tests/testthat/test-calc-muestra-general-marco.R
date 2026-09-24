# Marco declarado y sorteo de Muestra general por HTTP y en el .pulso
# (ADR 0090). El motor puro vive en test-calc-muestra-general-sorteo.R; aquí
# se prueba que las rutas escriben N en el componente, que el sorteo sale del
# n a campo del componente y que todo viaja y se reproduce tras reabrir.

.gm_xlsx <- function(N = 300L, semilla = 5L) {
  testthat::skip_if_not_installed("openxlsx")
  set.seed(semilla)
  df <- data.frame(
    dni = sprintf("%08d", sample.int(99999999L, N)),
    distrito = sample(c("Cercado", "Cayma", "Yanahuara"), N, replace = TRUE),
    hogares = sample(5:80, N, replace = TRUE),
    stringsAsFactors = FALSE
  )
  path <- tempfile("gm-marco-", fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "padron")
  openxlsx::writeData(wb, "padron", df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  list(path = path, df = df)
}

.gm_estudio <- function() {
  comp <- calc_muestra_normalize_componente(list(
    id = "cmp-general", actor = "Hogares", actor_id = "hogares",
    tecnica = "prob_estratificado", origen_tamano = "formula",
    parametros = list(z = 1.96, p = 0.5, e = 0.08, deff = 1, tasa_respuesta = 0.8,
                      oversample_pct = 0, n_minimo_estrato = 10L)
  ))
  calc_muestra_normalize_estudio(list(macro_familia = "linea_base_servicios", componentes = list(comp)))
}

test_that("declarar el marco escribe N y estratos; sortear usa el n a campo y viaja en el .pulso", {
  x <- .gm_xlsx()
  withr::defer(unlink(x$path, force = TRUE))
  sid <- session_create()
  withr::defer(session_delete(sid))
  meta <- save_upload(sid, "data", basename(x$path), readBin(x$path, "raw", file.size(x$path)))
  session_set(sid, "calc_muestra_estudio", .gm_estudio())

  datos <- .cm_general_leer_marco(sid, meta$file_id, "padron")
  s <- session_get(sid)
  dec <- calc_muestra_general_declarar_marco(
    s$calc_muestra_estudio, s$calc_muestra_general, "cmp-general", datos,
    file_id = meta$file_id, hoja = "padron",
    columnas = list(id = "dni", estrato = "distrito", tamano = "hogares")
  )
  comp <- dec$componente
  expect_identical(comp$marco$marco_validado, 300L)
  expect_identical(comp$marco$estado, "validado")
  expect_setequal(vapply(comp$marco$estratos, `[[`, "", "label"), c("Cercado", "Cayma", "Yanahuara"))
  session_set(sid, "calc_muestra_estudio", dec$estudio)
  session_set(sid, "calc_muestra_general", dec$estado)

  n_campo <- calc_muestra_calcular_componente(comp)$n_operativo
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, "cmp-general", datos,
                                          metodo = "mas", semilla = 42L, reservas_por_estrato = 2L)
  expect_identical(sel$corrida$corrida$n_titulares, as.integer(n_campo))
  expect_identical(sel$corrida$n_fuente, as.integer(n_campo))
  session_set(sid, "calc_muestra_general", sel$estado)

  # Ida y vuelta: el archivo del marco viaja y el sorteo se repite igual.
  pulso <- tempfile(fileext = ".pulso")
  withr::defer(unlink(pulso, force = TRUE))
  build_pulso(sid, pulso, project_name = "general")
  ld <- load_pulso(pulso)
  withr::defer(session_delete(ld$session_id))
  s2 <- session_get(ld$session_id)
  marco2 <- s2$calc_muestra_general$marcos[["cmp-general"]]
  expect_identical(marco2$marco_hash, dec$marco$marco_hash)
  expect_identical(s2$calc_muestra_general$corridas[["cmp-general"]]$corrida$run_id,
                   sel$corrida$corrida$run_id)
  datos2 <- .cm_general_leer_marco(ld$session_id, marco2$file_id, marco2$hoja)
  sel2 <- calc_muestra_general_seleccionar(s2$calc_muestra_estudio, s2$calc_muestra_general,
                                           "cmp-general", datos2, metodo = "mas", semilla = 42L,
                                           reservas_por_estrato = 2L)
  expect_identical(sel2$corrida$unidades, sel$corrida$unidades)
})

test_that("un marco que cambió después de declararlo no se sortea en silencio", {
  x <- .gm_xlsx(N = 50L)
  withr::defer(unlink(x$path, force = TRUE))
  est <- .gm_estudio()
  dec <- calc_muestra_general_declarar_marco(est, NULL, "cmp-general", x$df, file_id = "f1",
                                             columnas = list(id = "dni", estrato = "distrito"))
  otro <- x$df[-1, ]
  err <- tryCatch(calc_muestra_general_seleccionar(dec$estudio, dec$estado, "cmp-general", otro),
                  api_error = function(e) e)
  expect_identical(err$code, "E_CALC_MUESTRA_GENERAL_MARCO_CAMBIO")
  sin <- tryCatch(calc_muestra_general_seleccionar(est, NULL, "cmp-general", x$df),
                  api_error = function(e) e)
  expect_identical(sin$code, "E_CALC_MUESTRA_GENERAL_SIN_MARCO")
  nada <- tryCatch(calc_muestra_general_declarar_marco(est, NULL, "no-existe", x$df, "f1",
                                                       columnas = list(id = "dni")),
                   api_error = function(e) e)
  expect_identical(nada$code, "E_CALC_MUESTRA_GENERAL_COMPONENTE")
})

test_that("HTTP: /general/marco y /general/seleccionar por el wire real", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  x <- .gm_xlsx(N = 120L)
  withr::defer(unlink(x$path, force = TRUE))
  subida <- http_post_multipart(srv, "/api/files/upload?kind=data",
                                fields = list(file = curl::form_file(x$path)), sid = sid)
  expect_identical(subida$status, 201L)
  est <- .gm_estudio()
  guardado <- http_post_json(srv, "/api/calc-muestra/componente",
                             body = list(op = "add", componente = est$componentes[[1]]), sid = sid)
  expect_identical(guardado$status, 200L)

  sin_marco <- http_post_json(srv, "/api/calc-muestra/general/seleccionar",
                              body = list(componente_id = "cmp-general"), sid = sid)
  expect_identical(sin_marco$status, 409L)
  expect_identical(sin_marco$json$error$code, "E_CALC_MUESTRA_GENERAL_SIN_MARCO")

  dec <- http_post_json(srv, "/api/calc-muestra/general/marco", sid = sid, body = list(
    componente_id = "cmp-general", file_id = subida$json$file_id, hoja = "padron",
    columnas = list(id = "dni", estrato = "distrito")
  ))
  expect_identical(dec$status, 200L)
  expect_identical(as.integer(dec$json$marco$N), 120L)
  expect_identical(as.integer(dec$json$componente$marco$marco_validado), 120L)

  a <- http_post_json(srv, "/api/calc-muestra/general/seleccionar", sid = sid,
                      body = list(componente_id = "cmp-general", metodo = "sistematico", semilla = 9))
  b <- http_post_json(srv, "/api/calc-muestra/general/seleccionar", sid = sid,
                      body = list(componente_id = "cmp-general", metodo = "sistematico", semilla = 9))
  expect_identical(a$status, 200L)
  expect_identical(a$json$corrida$run_id, b$json$corrida$run_id)
  # `unidades` viaja como filas (una por unidad), que es lo que la tabla pinta.
  unidades <- a$json$unidades
  expect_true(length(unidades) > 0L)
  titulares <- Filter(function(u) identical(u$estado, "titular"), unidades)
  expect_identical(length(titulares), as.integer(a$json$corrida$n_titulares))
  pis <- vapply(titulares, function(u) as.numeric(u$pi), numeric(1))
  expect_true(all(pis > 0 & pis <= 1))
  expect_equal(sum(1 / pis), 120)

  # Rehidratar: /state trae el resumen sin unidades; /general/corrida, el listado.
  st <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(st$json$general$corridas[["cmp-general"]]$corrida$run_id, a$json$corrida$run_id)
  expect_null(st$json$general$corridas[["cmp-general"]]$unidades)
  expect_identical(as.integer(st$json$general$marcos[["cmp-general"]]$N), 120L)
  full <- http_get(srv, "/api/calc-muestra/general/corrida?componente_id=cmp-general", sid = sid)
  expect_identical(full$status, 200L)
  expect_identical(length(full$json$unidades), length(a$json$unidades))
  nada <- http_get(srv, "/api/calc-muestra/general/corrida?componente_id=otro", sid = sid)
  expect_identical(nada$status, 404L)

  exp <- http_post_json(srv, "/api/calc-muestra/general/exportar", sid = sid,
                        body = list(componente_id = "cmp-general"))
  expect_identical(exp$status, 200L)
  expect_true(nzchar(exp$json$export$file_id))
  expect_match(exp$json$export$filename, "\\.xlsx$")

  mal <- http_post_json(srv, "/api/calc-muestra/general/marco", sid = sid, body = list(
    componente_id = "cmp-general", file_id = subida$json$file_id, hoja = "padron",
    columnas = list(id = "distrito")
  ))
  expect_identical(mal$status, 400L)
  expect_identical(mal$json$error$code, "E_CALC_MUESTRA_GENERAL_MARCO")
})

test_that("HTTP: una π diminuta viaja sin redondear a cero", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  x <- .gm_xlsx(N = 400L)
  # Tamaños i³: la más chica queda con π del orden de 1e-8 (y las mayores,
  # certezas). Con 4 decimales esa π viajaría como 0.
  x$df$hogares <- as.numeric(seq_len(400))^3
  openxlsx::write.xlsx(list(padron = x$df), x$path, overwrite = TRUE)
  withr::defer(unlink(x$path, force = TRUE))
  fid <- http_post_multipart(srv, "/api/files/upload?kind=data",
                             fields = list(file = curl::form_file(x$path)), sid = sid)$json$file_id
  comp <- .gm_estudio()$componentes[[1]]
  comp$tecnica <- "prob_aleatorio_simple"
  http_post_json(srv, "/api/calc-muestra/componente", body = list(op = "add", componente = comp), sid = sid)
  http_post_json(srv, "/api/calc-muestra/general/marco", sid = sid, body = list(
    componente_id = "cmp-general", file_id = fid, hoja = "padron",
    columnas = list(id = "dni", tamano = "hogares")))
  r <- http_post_json(srv, "/api/calc-muestra/general/seleccionar", sid = sid,
                      body = list(componente_id = "cmp-general", metodo = "pps", semilla = 3))
  expect_identical(r$status, 200L)
  # La π del wire debe ser la del motor a precisión completa: con el
  # serializador global (4 decimales) este expect_equal falla.
  ids <- vapply(r$json$unidades, `[[`, "", "id")
  pis <- vapply(r$json$unidades, function(u) as.numeric(u$pi), numeric(1))
  orden <- order(x$df$dni, method = "radix")
  pik <- .cm_aulas_inclusion_probabilities(x$df$hogares[orden], as.integer(r$json$corrida$n_titulares))
  esperado <- pik[match(ids, x$df$dni[orden])]
  expect_equal(pis, esperado, tolerance = 1e-12)
  expect_true(any(pis < 0.01))
})
