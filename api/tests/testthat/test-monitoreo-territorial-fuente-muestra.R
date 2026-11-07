# I4 paso 2 (Gonzalo, 2026-11-01; ADR 0118 §3, enmienda): Monitoreo territorial
# mide contra la muestra enviada a Material; sin envío, contra la viva de la fase.

.tfm_muestra <- function(seed, ids, quota = NULL) {
  m <- list(seed = seed,
            blocks = lapply(ids, function(i) list(id_manzana = i, ump = i, entrevistas = 8L)),
            replacement_blocks = list())
  if (!is.null(quota)) m$quota <- quota
  m
}

.tfm_run <- function(viva, config = list(age_ranges = "18-29,30-44"), quota_viva = list(cells = list(list(territorio = "T1", cuota = 5L)))) {
  list(config = config, workspace_outputs = list(sample = viva, quota = quota_viva))
}

test_that("sin envío la fuente es la viva, igual que antes", {
  run <- .tfm_run(.tfm_muestra(1L, c("M1", "M2")))
  f <- .monitoreo_territorial_fuente_muestra(run, NULL)
  expect_identical(f$source, "viva")
  expect_identical(vapply(f$sample$blocks, `[[`, "", "id_manzana"), c("M1", "M2"))
  expect_identical(f$quota, run$workspace_outputs$quota)
  expect_identical(f$config, run$config)
})

test_that("con envío, bloques, config y cuota salen de la foto aunque la viva se haya re-sorteado", {
  cuota_foto <- list(cells = list(list(territorio = "T1", cuota = 9L)))
  enviada <- .tfm_muestra(11L, c("M1", "M2"), quota = cuota_foto)
  envio <- .hojas_ruta_envio_normalize(list(sample = enviada, config = list(age_ranges = "18-29"), enviado_at = "2026-10-20T15:00:00Z"))
  run <- .tfm_run(.tfm_muestra(42L, c("M7", "M8")))
  f <- .monitoreo_territorial_fuente_muestra(run, envio)
  expect_identical(f$source, "envio")
  expect_identical(vapply(f$sample$blocks, `[[`, "", "id_manzana"), c("M1", "M2"))
  expect_identical(f$quota, cuota_foto)
  expect_identical(f$config, envio$config)
  expect_match(f$sample_fingerprint, "^sha256:")
})

test_that("foto sin cuota: la viva sólo si la config es la misma; si no, ninguna", {
  enviada <- .tfm_muestra(11L, c("M1"))
  config <- list(n_objetivo = 600L)
  envio <- .hojas_ruta_envio_normalize(list(sample = enviada, config = config, enviado_at = "2026-10-20T15:00:00Z"))
  misma <- .monitoreo_territorial_fuente_muestra(.tfm_run(.tfm_muestra(11L, c("M1")), config = config), envio)
  expect_false(is.null(misma$quota))
  otra <- .monitoreo_territorial_fuente_muestra(.tfm_run(.tfm_muestra(11L, c("M1")), config = list(n_objetivo = 1200L)), envio)
  expect_null(otra$quota)
})

test_that("el hash de ruta es el de siempre sin envío y cambia con un reenvío de otra config", {
  ctx <- list(phase = "field", total_entrevistas = 16L, run_locked = FALSE,
              blocks = data.frame(id_manzana = c("M1", "M2"), entrevistas = 8L, stringsAsFactors = FALSE),
              replacement_blocks = data.frame())
  base <- .monitoreo_territorial_route_hash(ctx)
  ctx_viva <- ctx; ctx_viva$sample_source <- "viva"
  expect_identical(.monitoreo_territorial_route_hash(ctx_viva), base)
  ctx_a <- ctx; ctx_a$sample_source <- "envio"; ctx_a$sample_fingerprint <- "sha256:a"; ctx_a$config <- list(age_ranges = "18-29")
  ctx_b <- ctx_a; ctx_b$config <- list(age_ranges = "18-24")
  expect_false(identical(.monitoreo_territorial_route_hash(ctx_a), base))
  expect_false(identical(.monitoreo_territorial_route_hash(ctx_a), .monitoreo_territorial_route_hash(ctx_b)))
})

test_that("el token del dashboard no cambia sin firma y sí con la firma de un envío", {
  cfg <- list(monitoreo_profile = list(family = "territorial"))
  datos <- data.frame(a = 1:2)
  sin <- .monitoreo_dashboard_cache_token(list(synced_at = "x"), datos, cfg)
  expect_identical(.monitoreo_dashboard_cache_token(list(synced_at = "x"), datos, cfg, route_sig = ""), sin)
  con <- .monitoreo_dashboard_cache_token(list(synced_at = "x"), datos, cfg, route_sig = "envio:field:sha256:a:d")
  expect_identical(con, paste(sin, "envio:field:sha256:a:d", sep = "|"))
})
