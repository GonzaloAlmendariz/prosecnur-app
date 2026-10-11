# Contrato HTTP de la caché de vista previa, las miniaturas en lote y la vista previa asíncrona (F6 §5.3).
# Contrato: docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md. Corre contra el backend real (helper-http-contract.R).
# Los jobs NO necesitan el paquete instalado: el worker recibe un thunk con environment global que resuelve el motor en
# el namespace que su bootstrap carga con load_all (PULSO_API_DIR).

.mh_lamina <- function(id = "s1", titulo = "Región", var = "region") {
  list(id = id, tipo = "p_slide_1_grafico",
       payload = list(titulo = titulo, grafico = list(graficador = "p_barras_categoricas", args = list(var = var))))
}

.mh_texto <- function(srv, sid, file_id) {
  dl <- http_get(srv, sprintf("/api/files/%s/download", file_id), sid = sid)
  f <- tempfile(fileext = ".pptx"); writeBin(dl$raw, f)
  xml <- xml2::read_xml(.pptx_leer_parte(f, .pptx_slide_paths(f)[[1]]))
  paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " | ")
}

test_that("POST /preview-slide responde igual que siempre y la caché por huella mira los datos: otra etiqueta, otra lámina", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  cuerpo <- list(slide = .mh_lamina(), include_images = FALSE)
  r1 <- http_post_json(srv, "/api/graficos/preview-slide", body = cuerpo, sid = base$sid)
  expect_identical(r1$status, 200L)
  expect_true(all(c("ok", "file_id", "size", "type", "images", "slide_preview", "partes", "slide_previews", "avisos",
                    "folio") %in% names(r1$json)))
  expect_identical(r1$json$type, "pptx")
  expect_match(r1$json$hash, "^[0-9a-f]{64}$")
  expect_identical(r1$json$cache$pptx, "miss")
  r2 <- http_post_json(srv, "/api/graficos/preview-slide", body = cuerpo, sid = base$sid)
  expect_identical(r2$json$cache$pptx, "hit")
  expect_identical(r2$json$hash, r1$json$hash)
  expect_identical(r2$json$file_id, r1$json$file_id)
  expect_match(.mh_texto(srv, base$sid, r1$json$file_id), "Norte", fixed = TRUE)

  # Una etiqueta curada cambia la fuente que lee el motor: la caché NO puede devolver la lámina vieja.
  ov <- http_post_json(srv, "/api/label-overrides",
                       body = list(label_overrides = list(values = list(lst_region = list(norte = "Zona Norte")))),
                       sid = base$sid)
  expect_identical(ov$status, 200L)
  r3 <- http_post_json(srv, "/api/graficos/preview-slide", body = cuerpo, sid = base$sid)
  expect_identical(r3$status, 200L)
  expect_false(identical(r3$json$hash, r1$json$hash))
  expect_identical(r3$json$cache$pptx, "miss")
  expect_match(.mh_texto(srv, base$sid, r3$json$file_id), "Zona Norte", fixed = TRUE)
})

test_that("POST /miniaturas: job por lote con estado por slide.id, PNG registrado y segundo lote servido desde caché", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  laminas <- list(.mh_lamina("a", "Región"), .mh_lamina("b", "Sin variable", var = "no_existe"),
                  list(id = "c", tipo = "p_slide_inventada", payload = list()))
  r <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = laminas), sid = base$sid)
  expect_identical(r$status, 200L)
  expect_identical(r$json$kind, "graficos.miniaturas")
  expect_identical(as.integer(r$json$total), 3L)
  expect_identical(as.integer(r$json$en_cache), 0L)
  snap <- http_wait_job(srv, r$json$job_id, timeout_secs = 400)
  expect_identical(snap$status, "done")
  res <- snap$result_data
  expect_identical(res$lote_id, r$json$lote_id)
  por <- stats::setNames(res$laminas, vapply(res$laminas, `[[`, "", "slide_id"))
  expect_identical(names(por), c("a", "b", "c"))
  expect_true(por$a$estado %in% c("ok", "sin_imagen"))
  expect_match(por$a$hash, "^[0-9a-f]{64}$")
  expect_identical(as.integer(por$a$partes$n), 1L)
  expect_identical(por$b$estado, "sin_datos")
  expect_identical(por$c$estado, "error")
  expect_identical(por$c$error$code, "E_MINIATURA_TIPO_INVALIDO")
  if (identical(por$a$estado, "ok")) {
    m <- por$a$miniatura
    expect_identical(m$mime, "image/png")
    dl <- http_get(srv, m$url, sid = base$sid)
    expect_identical(dl$status, 200L)
    expect_identical(digest::digest(dl$raw, algo = "sha256", serialize = FALSE), m$sha256)
  }
  estado <- http_get(srv, paste0("/api/graficos/miniaturas/", r$json$lote_id), sid = base$sid)
  expect_identical(estado$status, 200L)
  expect_identical(estado$json$status, "done")
  expect_identical(as.integer(estado$json$conteo$pendiente), 0L)

  # El mismo pedido otra vez: las láminas ya cacheadas no vuelven al worker. Un raster fallido (renderer roto en el
  # entorno: estado «sin_imagen») no se cachea a propósito —se reintenta—, así que entonces vuelven las dos.
  r2 <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = laminas[1:2]), sid = base$sid)
  expect_identical(as.integer(r2$json$en_cache), if (identical(por$a$estado, "ok")) 2L else 0L)
  snap2 <- http_wait_job(srv, r2$json$job_id, timeout_secs = 30)
  expect_identical(snap2$status, "done")
  expect_identical(snap2$result_data$laminas[[1]]$hash, por$a$hash)
  if (identical(por$a$estado, "ok")) {
    expect_identical(snap2$result_data$laminas[[1]]$miniatura$sha256, por$a$miniatura$sha256)
  }
})

test_that("POST /preview-slide-job no bloquea, devuelve la respuesta de /preview-slide y comparte la caché con él", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  cuerpo <- list(slide = .mh_lamina("j1", "Lámina del job"), include_images = FALSE, preview_formas = TRUE)
  r <- http_post_json(srv, "/api/graficos/preview-slide-job", body = cuerpo, sid = base$sid)
  expect_identical(r$status, 200L)
  expect_identical(r$json$kind, "graficos.preview_slide")
  expect_identical(as.integer(r$json$pendientes), 1L)
  snap <- http_wait_job(srv, r$json$job_id, timeout_secs = 400)
  expect_identical(snap$status, "done")
  res <- snap$result_data
  expect_true(isTRUE(res$ok))
  expect_identical(res$hash, r$json$hash)
  expect_identical(res$type, "pptx")
  expect_identical(res$partes$partes[[1]]$estado, "nativa")
  expect_true(length(res$partes$partes[[1]]$formas) > 3L)                     # preview_formas llega igual que en síncrono
  sincrona <- http_post_json(srv, "/api/graficos/preview-slide", body = cuerpo, sid = base$sid)
  expect_identical(sincrona$json$hash, res$hash)
  expect_identical(sincrona$json$cache$pptx, "hit")                             # el job dejó la lámina en la caché
  expect_identical(sincrona$json$file_id, res$file_id)

  # Un error de dominio viaja estructurado en result_data (jobResultDomainError en el front).
  rota <- .mh_lamina("j2"); rota$payload$grafico$graficador <- "p_graficador_inventado"
  rr <- http_post_json(srv, "/api/graficos/preview-slide-job", body = list(slide = rota), sid = base$sid)
  s2 <- http_wait_job(srv, rr$json$job_id, timeout_secs = 400)
  expect_identical(s2$status, "done")
  expect_false(isTRUE(s2$result_data$ok))
  expect_identical(s2$result_data$error$code, "E_PREVIEW_FAILED")
  expect_identical(as.integer(s2$result_data$error$status), 400L)
})

test_that("cancelar un lote lo deja cancelado y sin entradas a medias; los errores de pedido llevan su E_*", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  laminas <- lapply(1:6, function(k) .mh_lamina(sprintf("c%d", k), sprintf("Cancelable %d", k)))
  r <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = laminas), sid = base$sid)
  expect_identical(r$status, 200L)
  cx <- http_post_json(srv, sprintf("/api/jobs/%s/cancel", r$json$job_id), sid = base$sid)
  expect_identical(cx$status, 200L)
  snap <- http_get(srv, paste0("/api/jobs/", r$json$job_id))
  expect_identical(snap$json$status, "cancelled")
  estado <- http_get(srv, paste0("/api/graficos/miniaturas/", r$json$lote_id), sid = base$sid)
  expect_identical(estado$json$status, "cancelled")
  expect_identical(as.integer(estado$json$total), 6L)

  vacio <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = list()), sid = base$sid)
  expect_identical(vacio$status, 400L)
  expect_identical(vacio$json$error$code %||% vacio$json$code, "E_MINIATURAS_SIN_LAMINAS")
  malo <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = "x"), sid = base$sid)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_MINIATURAS_SLIDES")
  q <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = laminas[1], preview_quality = "alta"), sid = base$sid)
  expect_identical(q$json$error$code %||% q$json$code, "E_BAD_MINIATURAS_QUALITY")
  no <- http_get(srv, "/api/graficos/miniaturas/no-existe", sid = base$sid)
  expect_identical(no$status, 404L)
  expect_identical(no$json$error$code %||% no$json$code, "E_MINIATURAS_LOTE_NO_EXISTE")
  sin_slide <- http_post_json(srv, "/api/graficos/preview-slide-job", body = list(include_images = FALSE), sid = base$sid)
  expect_identical(sin_slide$json$error$code %||% sin_slide$json$code, "E_NO_SLIDE")
})
