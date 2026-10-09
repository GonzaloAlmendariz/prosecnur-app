# El flujo completo de Muestra general por el wire, en el orden en que lo hace
# la mesa: subir el marco → declararlo → calcular → sortear → leer la corrida →
# exportar. Es el recorrido de usuario nuevo del loop (2026-09-24) convertido
# en contrato: cada paso usa lo que publicó el anterior, no un atajo.

test_that("flujo HTTP: el n que publica /calcular es el que sortea /seleccionar y lo que se exporta", {
  testthat::skip_if_not_installed("openxlsx")
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id

  set.seed(9)
  N <- 1500L
  marco <- data.frame(codigo = sprintf("H%05d", sample.int(99999L, N)),
                      distrito = sample(c("Cercado", "Cayma", "Yanahuara"), N, TRUE, prob = c(.5, .3, .2)))
  path <- tempfile(fileext = ".csv")
  withr::defer(unlink(path))
  utils::write.csv(marco, path, row.names = FALSE)
  # Como lo manda el navegador: text/csv (antes daba 400 E_BAD_FILE).
  subida <- http_post_multipart(srv, "/api/files/upload?kind=data",
                                fields = list(file = curl::form_file(path, type = "text/csv")), sid = sid)
  expect_identical(subida$status, 201L)

  comp <- list(id = "cmp-flujo", actor = "Hogares", actor_id = "hogares", tecnica = "prob_estratificado",
               origen_tamano = "formula",
               parametros = list(e = .05, tasa_respuesta = .8, oversample_pct = 0, n_minimo_estrato = 0L,
                                 asignacion = "neyman"))
  expect_identical(http_post_json(srv, "/api/calc-muestra/componente",
                                  body = list(op = "add", componente = comp), sid = sid)$status, 200L)

  dec <- http_post_json(srv, "/api/calc-muestra/general/marco", sid = sid, body = list(
    componente_id = "cmp-flujo", file_id = subida$json$file_id,
    columnas = list(id = "codigo", estrato = "distrito")))
  expect_identical(dec$status, 200L)
  expect_identical(as.integer(dec$json$marco$N), N)

  calc <- http_post_json(srv, "/api/calc-muestra/calcular", body = list(), sid = sid)
  expect_identical(calc$status, 200L)
  res <- calc$json$estudio$componentes[[1]]$resultado
  n_campo <- as.integer(res$n_operativo)
  expect_gt(n_campo, 0L)
  campo_por_estrato <- vapply(res$distribucion_estratos, function(d) as.integer(d$n_campo), integer(1))
  names(campo_por_estrato) <- vapply(res$distribucion_estratos, function(d) d$estrato, "")
  expect_identical(sum(campo_por_estrato), n_campo)

  sel <- http_post_json(srv, "/api/calc-muestra/general/seleccionar", sid = sid,
                        body = list(componente_id = "cmp-flujo", metodo = "mas", semilla = 7, reservas_por_estrato = 2))
  expect_identical(sel$status, 200L)
  expect_identical(as.integer(sel$json$corrida$n_titulares), n_campo)
  sorteo_por_estrato <- vapply(sel$json$estratos, function(e) as.integer(e$n_h), integer(1))
  names(sorteo_por_estrato) <- vapply(sel$json$estratos, function(e) e$clave, "")
  expect_identical(sorteo_por_estrato[names(campo_por_estrato)], campo_por_estrato)
  tit <- Filter(function(u) identical(u$estado, "titular"), sel$json$unidades)
  expect_equal(sum(vapply(tit, function(u) 1 / as.numeric(u$pi), numeric(1))), N, tolerance = 1e-8)

  cor <- http_get(srv, "/api/calc-muestra/general/corrida?componente_id=cmp-flujo", sid = sid)
  expect_identical(cor$json$corrida$run_id, sel$json$corrida$run_id)

  exp <- http_post_json(srv, "/api/calc-muestra/general/exportar", sid = sid, body = list(componente_id = "cmp-flujo"))
  expect_identical(exp$status, 200L)
  xlsx <- tempfile(fileext = ".xlsx")
  withr::defer(unlink(xlsx))
  descarga <- curl::curl_fetch_disk(
    sprintf("%s/api/files/%s/download?sid=%s", srv$url, exp$json$export$file_id, sid), xlsx,
    handle = curl::new_handle(httpheader = c(`X-Pulso-Session` = sid)))
  expect_identical(as.integer(descarga$status_code), 200L)
  listado <- openxlsx::read.xlsx(xlsx, sheet = "Listado", check.names = FALSE)
  expect_identical(sum(listado$Estado == "Titular"), n_campo)
  memoria <- openxlsx::read.xlsx(xlsx, sheet = "Memoria de cálculo", check.names = FALSE)
  expect_match(memoria$Paso[[2]], "Neyman", fixed = TRUE)
})
