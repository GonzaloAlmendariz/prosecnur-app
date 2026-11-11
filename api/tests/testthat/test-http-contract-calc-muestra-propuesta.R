# La propuesta (PPT y Excel de escenarios) se genera desde la app, sobre el estudio de la sesión: los actores con su
# N, canal y segmentos, y la meta de cada uno por escenario en el cuerpo de la ruta.

.http_propuesta_comp <- function(id, actor, cat, N, estratos = NULL) {
  list(id = id, actor = actor, actor_id = id, actor_categoria = cat, canal_recojo = "online_email",
       parametros = list(tasa_respuesta = 0.3),
       marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N,
                    estratos = if (is.null(estratos)) NULL else lapply(names(estratos), function(k) list(label = k, N = estratos[[k]]))))
}

test_that("flujo HTTP: la propuesta sale en PPT y en Excel con las metas de cada escenario", {
  testthat::skip_if_not_installed("officer"); testthat::skip_if_not_installed("openxlsx")
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  comps <- list(
    .http_propuesta_comp("doc", "Docentes", "docentes", 2665L,
                         list(`Contratado TPA` = 1751L, `Ordinario principal` = 276L, `Contratado TC` = 114L,
                              `Ordinario auxiliar` = 269L, `Ordinario asociado` = 255L)),
    .http_propuesta_comp("egr", "Egresados", "egresados", 11246L))
  for (c in comps) {
    expect_identical(http_post_json(srv, "/api/calc-muestra/componente", body = list(op = "add", componente = c), sid = sid)$status, 200L)
  }
  cuerpo <- function(formato) list(formato = formato, incluir_portada = FALSE, incluir_diseno = FALSE, solicitante = "Solicitante: prueba",
    segmentacion = list(doc = "Condición y categoría"),
    escenarios = list(list(nombre = "Propuesta A", metas = list(doc = 900, egr = 600)),
                      list(nombre = "Propuesta B", metas = list(doc = 600, egr = 400))))
  bajar <- function(exp, ext) {
    f <- tempfile(fileext = ext)
    d <- curl::curl_fetch_disk(sprintf("%s/api/files/%s/download?sid=%s", srv$url, exp$json$export$file_id, sid), f,
                               handle = curl::new_handle(httpheader = c(`X-Pulso-Session` = sid)))
    expect_identical(as.integer(d$status_code), 200L)
    f
  }

  ppt <- http_post_json(srv, "/api/calc-muestra/propuesta/exportar", body = cuerpo("pptx"), sid = sid)
  expect_identical(ppt$status, 200L)
  doc <- officer::read_pptx(bajar(ppt, ".pptx"))
  # Sin portada ni diseño: población, gráficos, escenarios, metas de docentes, contraportada.
  textos <- vapply(seq_len(length(doc)), function(i) {
    t <- officer::slide_summary(officer::on_slide(doc, i))$text; paste(t[!is.na(t)], collapse = " ")
  }, "")
  expect_match(textos[1], "POBLACIÓN Y SEGMENTOS DE CRUCE", fixed = TRUE)
  expect_match(textos[1], "Condición y categoría: Contratado TPA", fixed = TRUE)
  expect_true(any(grepl("METAS POR SEGMENTO: DOCENTES", textos, fixed = TRUE)))

  xl <- http_post_json(srv, "/api/calc-muestra/propuesta/exportar", body = cuerpo("xlsx"), sid = sid)
  expect_identical(xl$status, 200L)
  res <- openxlsx::read.xlsx(bajar(xl, ".xlsx"), sheet = "Resumen", rows = 5:8)
  expect_identical(as.integer(res[[4]]), c(900L, 600L, 1500L))
  expect_identical(as.integer(res[[7]]), c(600L, 400L, 1000L))
})

test_that("flujo HTTP: sin actores con N la propuesta responde 409 con su código", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  r <- http_post_json(srv, "/api/calc-muestra/propuesta/exportar", sid = sid,
                      body = list(formato = "pptx", escenarios = list(list(nombre = "A", metas = list()))))
  expect_identical(r$status, 409L)
  expect_identical(r$json$error$code %||% r$json$code, "E_CALC_MUESTRA_PROPUESTA_SIN_ACTORES")
})
