# Comparar semillas del sorteo (U13).

cs_cfg <- function(...) {
  base <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
               entrevistas_por_manzana = 8, max_per_manzana = 8, seed = 2017, replacements_per_titular = 1,
               marco_elegible = list(minimo_viviendas = 1))
  cambios <- list(...)
  base[names(cambios)] <- cambios
  base
}
cs_puntos <- data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))

test_that("compara la semilla actual con otras, con las mismas métricas para todas", {
  r <- hojas_ruta_comparar_semillas(cs_cfg(), c(11111, 22222), puntos = cs_puntos)
  expect_true(r$ok)
  expect_identical(vapply(r$semillas, `[[`, integer(1), "semilla"), c(2017L, 11111L, 22222L))
  expect_true(r$semillas[[1]]$actual)
  for (f in r$semillas) {
    expect_identical(f$titulares, 10L)
    expect_true(f$por_revisar >= 0L && f$por_revisar <= f$titulares)
    expect_true(f$nse_distancia >= 0 && f$nse_distancia <= 1)
  }
  # Semillas distintas sortean manzanas distintas (al menos la mediana o el conteo cambia en algo).
  expect_false(identical(r$semillas[[1]]$mediana_viviendas, r$semillas[[2]]$mediana_viviendas) &&
               identical(r$semillas[[1]]$mediana_viviendas, r$semillas[[3]]$mediana_viviendas))
})

test_that("la semilla actual da lo mismo que el sorteo real y comparar no cambia la semilla global", {
  set.seed(42); antes <- stats::runif(1); set.seed(42)
  r <- hojas_ruta_comparar_semillas(cs_cfg(), integer(0), puntos = cs_puntos)
  despues <- stats::runif(1)
  expect_identical(antes, despues)
  real <- hojas_ruta_sample_preview_integrado(cs_cfg())
  expect_identical(r$semillas[[1]]$titulares, as.integer(real$n_blocks))
})

test_that("no compara más de cinco semillas", {
  r <- hojas_ruta_comparar_semillas(cs_cfg(), 1:10, puntos = cs_puntos)
  expect_length(r$semillas, HOJAS_RUTA_SEMILLAS_MAX)
})

test_that("las semillas nuevas no repiten las que se evitan", {
  s <- hojas_ruta_semillas_nuevas(3, evitar = 2017L)
  expect_length(unique(s), 3)
  expect_false(2017L %in% s)
  expect_true(all(s >= 10000L & s <= 99999L))
})

test_that("HTTP: comparar está montado, pide distritos y no guarda nada", {
  expect_true(grepl("mount_hojas_ruta_semillas(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  pr <- mount_hojas_ruta_semillas(plumber::pr())
  ep <- Find(function(e) identical(e$verbs, "POST"), unlist(pr$endpoints, recursive = FALSE))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  llamar <- function(body) ep$getFunc()(
    req = list(HTTP_X_PULSO_SESSION = sid, bodyRaw = charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))),
    res = plumber:::PlumberResponse$new()
  )
  sin <- llamar(list(config = list(territorios = list())))
  expect_identical(sin$error$code %||% sin$code %||% "", "E_NO_TERRITORY")
  ok <- llamar(list(config = cs_cfg(), nuevas = 1))
  expect_length(ok$semillas, 2)
  expect_null(session_get(sid)$hojas_ruta_workspace_outputs$sample)
})
