# Aislamiento entre sesiones del override de etiquetas (label_overrides) en un mismo servidor.
#
# Regresión (CI del PR #11): POST /api/label-overrides en la sesión A publicaba el override en el slot
# proceso-global de label_overrides.R y la sesión B —creada después, con su propio instrumento y sin override—
# leía «Zona Norte» en /api/graficos/categorias y en sus láminas. El override es del proyecto (s$label_overrides),
# no del proceso: una sesión sólo puede ver el suyo.
# Corre contra el backend real (helper-http-contract.R).

.ais_lamina <- function(id = "s1") {
  list(id = id, tipo = "p_slide_1_grafico",
       payload = list(titulo = "Región", grafico = list(graficador = "p_barras_categoricas", args = list(var = "region"))))
}

.ais_etiquetas <- function(srv, sid) {
  r <- http_get(srv, "/api/graficos/categorias?var=region", sid = sid)
  expect_identical(r$status, 200L)
  vapply(r$json$categorias, `[[`, "", "etiqueta")
}

.ais_texto_lamina <- function(srv, sid) {
  p <- http_post_json(srv, "/api/graficos/preview-slide", body = list(slide = .ais_lamina(), include_images = FALSE),
                      sid = sid)
  expect_identical(p$status, 200L)
  dl <- http_get(srv, sprintf("/api/files/%s/download", p$json$file_id), sid = sid)
  f <- tempfile(fileext = ".pptx"); writeBin(dl$raw, f)
  on.exit(unlink(f), add = TRUE)
  xml <- xml2::read_xml(.pptx_leer_parte(f, .pptx_slide_paths(f)[[1]]))
  paste(xml2::xml_text(xml2::xml_find_all(xml, "//a:t")), collapse = " | ")
}

.ais_override_zona_norte <- function(srv, sid) {
  ov <- http_post_json(srv, "/api/label-overrides",
                       body = list(label_overrides = list(values = list(lst_region = list(norte = "Zona Norte")))),
                       sid = sid)
  expect_identical(ov$status, 200L)
  invisible(ov)
}

test_that("un override de etiquetas de la sesión A no llega a una sesión B creada después", {
  srv <- http_contract_server()
  a <- http_contract_upload_base(srv)
  .ais_override_zona_norte(srv, a$sid)
  expect_identical(.ais_etiquetas(srv, a$sid), c("Zona Norte", "Sur"))

  b <- http_contract_upload_base(srv)
  expect_false(identical(a$sid, b$sid))
  expect_identical(.ais_etiquetas(srv, b$sid), c("Norte", "Sur"))
  texto_b <- .ais_texto_lamina(srv, b$sid)
  expect_match(texto_b, "Norte", fixed = TRUE)
  expect_false(grepl("Zona Norte", texto_b, fixed = TRUE))

  # A conserva el suyo aunque B haya trabajado entretanto, y B sigue limpio después de que A vuelva a leer.
  expect_match(.ais_texto_lamina(srv, a$sid), "Zona Norte", fixed = TRUE)
  expect_identical(.ais_etiquetas(srv, b$sid), c("Norte", "Sur"))
})

test_that("el override de A no se filtra a una sesión B que ya existía, ni el GET de B lo reporta", {
  srv <- http_contract_server()
  b <- http_contract_upload_base(srv)
  expect_identical(.ais_etiquetas(srv, b$sid), c("Norte", "Sur"))
  a <- http_contract_upload_base(srv)
  .ais_override_zona_norte(srv, a$sid)

  expect_identical(.ais_etiquetas(srv, b$sid), c("Norte", "Sur"))
  gb <- http_get(srv, "/api/label-overrides", sid = b$sid)
  expect_identical(gb$status, 200L)
  expect_identical(as.integer(gb$json$n_values), 0L)
})

test_that("POST /miniaturas en una sesión nueva no cuenta en_cache láminas que sólo otra sesión renderizó", {
  srv <- http_contract_server()
  a <- http_contract_upload_base(srv)
  laminas <- list(.ais_lamina("a"))
  ra <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = laminas), sid = a$sid)
  expect_identical(ra$status, 200L)
  snap <- http_wait_job(srv, ra$json$job_id, timeout_secs = 400)
  expect_identical(snap$status, "done")

  b <- http_contract_upload_base(srv)
  rb <- http_post_json(srv, "/api/graficos/miniaturas", body = list(slides = laminas), sid = b$sid)
  expect_identical(rb$status, 200L)
  expect_identical(as.integer(rb$json$en_cache), 0L)
  snap_b <- http_wait_job(srv, rb$json$job_id, timeout_secs = 400)
  expect_identical(snap_b$status, "done")
})

# Mismo lote de CI (shard 1/4, test-graficos-miniaturas-http.R:84), causa DISTINTA al override: sin renderer en el
# entorno (CI no instala LibreOffice) `.mini_en_cache()` daba por cacheada una lámina cuyo raster nunca se guardó.
# Contrato §4: un raster ausente no se cachea y se reintenta. La caché misma es por sesión (`.mini_cache_raiz(sid)`).
test_that(".mini_en_cache: con raster pedido y sin renderer la lámina NO está en caché; sin raster pedido, sí", {
  raiz <- withr::local_tempdir()
  h <- strrep("a", 64)
  e <- .mini_entrada(raiz, h)
  dir.create(e$dir, recursive = TRUE)
  writeBin(as.raw(1:4), e$pptx)
  saveRDS(list(hash = h), e$meta)
  ctx <- list(hash = h)
  local_mocked_bindings(.mini_renderer_id = function() NA_character_)
  expect_false(.mini_en_cache(ctx, raiz, list(render_slide_preview = TRUE, preview_quality = "quick")))
  expect_true(.mini_en_cache(ctx, raiz, list(render_slide_preview = FALSE)))
  expect_false(.mini_en_cache(list(hash = strrep("b", 64)), raiz, list(render_slide_preview = FALSE)))
})
