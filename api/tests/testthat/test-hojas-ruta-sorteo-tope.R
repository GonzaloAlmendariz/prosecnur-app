# ADR 0120: `pps_tope` es el sistemático PPS por distrito con la medida topada en
# el p95 del distrito. Contrato del ADR 0066 §5: la frecuencia empírica reproduce la
# π publicada (4·SE), con control positivo y un mutante que el arnés mata. `pps`
# sigue siendo el valor por defecto y su sorteo no cambia.

# Un distrito de ~40 zonas desiguales, con manzanas sin viviendas y una enorme.
tope_fixture <- function() {
  set.seed(23L)
  filas <- lapply(seq_len(40L), function(z) {
    k <- sample(2:6, 1)
    viv <- round(stats::rlnorm(k, meanlog = log(if (z %% 7L == 0L) 150 else 25), sdlog = 0.9))
    if (z %% 5L == 0L) viv[1] <- 0
    data.frame(
      ubigeo = "150101", distrito = "Distrito", zona = sprintf("%05d", z * 100L),
      manzana = sprintf("%03d", seq_len(k)), id_manzana = sprintf("150101%05d%03d", z * 100L, seq_len(k)),
      viviendas = viv, poblacion = viv * 3, stringsAsFactors = FALSE
    )
  })
  df <- do.call(rbind, filas)
  df$viviendas[3] <- 4000  # con PPS es certeza; con tope no
  df
}
tope_cfg <- function(...) {
  base <- list(sampling_method = "pps_tope", measure_var = "viviendas", row_var = "distrito")
  cambios <- list(...)
  base[names(cambios)] <- cambios
  base
}
tope_frecuencias <- function(df, n, cfg, veces = 400L, semilla = 2017L) {
  set.seed(semilla)
  ids <- unlist(lapply(seq_len(veces), function(i) {
    as.character(.hojas_ruta_sorteo_titulares_distrito(df, data.frame(), df$ubigeo[[1]], n * 8L, 8L, cfg)$blocks$id_manzana)
  }))
  as.numeric(table(factor(ids, levels = df$id_manzana))) / veces
}
# π de la fórmula del ADR 0120, escrita aparte del código que se prueba.
tope_pi_formula <- function(v, n) {
  c95 <- stats::quantile(v[v > 0], 0.95, names = FALSE, type = 7)
  .cm_aulas_inclusion_probabilities(pmin(v, c95) * (v > 0), n)
}

test_that("el tope es el p95 del distrito y sólo pesa con pps_tope", {
  df <- tope_fixture()
  c95 <- stats::quantile(df$viviendas[df$viviendas > 0], 0.95, names = FALSE)
  expect_equal(.hojas_ruta_sorteo_tope_valor(df$viviendas), c95)
  expect_true(is.na(.hojas_ruta_sorteo_tope_valor(c(0, NA, -1))))
  m <- .hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(tope_cfg(), df))
  expect_equal(m, pmin(pmax(df$viviendas, 0), c95))
  # pps y sistematico ignoran el tope aunque la cfg lo traiga.
  pps <- tope_cfg(sampling_method = "pps", tope_medida = 10)
  expect_identical(.hojas_ruta_sorteo_cfg_distrito(pps, df), pps)
  expect_equal(.hojas_ruta_sorteo_medida(df, pps), df$viviendas)
  expect_equal(.hojas_ruta_sorteo_medida(df, tope_cfg(sampling_method = "sistematico", tope_medida = 10)), rep(1, nrow(df)))
})

test_that("la frecuencia de cada manzana reproduce la π publicada con tope (4·SE); el PPS sin tope y el mutante no pasan", {
  df <- tope_fixture()
  cfg <- tope_cfg()
  pi <- tope_pi_formula(df$viviendas, 25L)
  expect_equal(sum(pi), 25)
  # La π publicada es la de la fórmula; toda manzana con viviendas tiene π > 0.
  pub <- .hojas_ruta_me_pi(df, df$id_manzana, .hojas_ruta_sorteo_cfg_distrito(cfg, df), "distrito")
  expect_equal(.hojas_ruta_sorteo_pi(.hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df)), 25L), pi)
  expect_true(all(pi[df$viviendas > 0] > 0))
  expect_true(all(pi[df$viviendas <= 0] == 0))
  expect_identical(pub$regla_pi, "pps_tope_distrito")
  freq <- tope_frecuencias(df, 25L, cfg)
  se <- sqrt(pmax(pi * (1 - pi), 1e-4) / 400)
  expect_true(all(abs(freq - pi) <= 4 * se))
  # La manzana de 4000 viviendas ya no es certeza.
  expect_lt(pi[df$viviendas == 4000], 1)
  expect_lt(freq[df$viviendas == 4000], 1)
  # Control positivo: la π del PPS sin tope no pasa el mismo arnés.
  pi_pps <- .hojas_ruta_sorteo_pi(df$viviendas, 25L)
  expect_false(all(abs(freq - pi_pps) <= 4 * se))
  # Control de escala: una π 30 % más alta tampoco pasa.
  libres <- pi > 0 & pi < 1
  expect_false(all(abs(freq[libres] - pmin(1, 1.3 * pi[libres])) <= 4 * se[libres]))
  # Mutante: un sorteo que ignora el tope. El arnés lo mata contra la π publicada.
  mutante <- with_mocked_bindings(tope_frecuencias(df, 25L, cfg), .hojas_ruta_sorteo_topar = function(m, cfg) m)
  expect_false(all(abs(mutante - pi) <= 4 * se))
})

test_that("con cuota por zona el tope es el del distrito, no el de cada zona", {
  df <- tope_fixture()
  cfg_d <- .hojas_ruta_sorteo_cfg_distrito(tope_cfg(row_var = "zona"), df)
  z <- df[df$zona == df$zona[df$viviendas == 4000], , drop = FALSE]
  expect_equal(.hojas_ruta_sorteo_medida(z, cfg_d), pmin(pmax(z$viviendas, 0), cfg_d$tope_medida))
  # Sin el tope del distrito, la zona se toparía con su propio p95.
  expect_false(isTRUE(all.equal(.hojas_ruta_sorteo_medida(z, tope_cfg(row_var = "zona")), .hojas_ruta_sorteo_medida(z, cfg_d))))
  pub <- .hojas_ruta_me_pi(z, z$id_manzana[1], cfg_d, "zona")
  expect_identical(pub$regla_pi, "pps_tope_zona")
  expect_equal(pub$tope_medida, cfg_d$tope_medida)
  expect_identical(pub$manzanas_topadas, as.integer(sum(z$viviendas > cfg_d$tope_medida)))
  expect_equal(pub$seleccionadas[[1]]$medida_marco, z$viviendas[1])
})

test_that("misma semilla, misma muestra; la zona sigue siendo estrato implícito", {
  df <- tope_fixture()
  una <- function() { set.seed(5L); .hojas_ruta_sorteo_titulares_distrito(df, data.frame(), "150101", 200L, 8L, tope_cfg()) }
  a <- una()
  b <- una()
  expect_identical(a$blocks$id_manzana, b$blocks$id_manzana)
  expect_identical(nrow(a$blocks), 25L)
  expect_identical(unique(a$blocks$metodo), "pps_tope")
  pi_z <- tapply(tope_pi_formula(df$viviendas, 25L), df$zona, sum)
  rutas_z <- table(factor(a$blocks$zona, levels = names(pi_z)))
  expect_true(all(rutas_z >= floor(pi_z + 1e-9) & rutas_z <= ceiling(pi_z - 1e-9)))
})

test_that("el valor por defecto sigue siendo pps y su sorteo no cambia", {
  expect_identical(hojas_ruta_integrada_normalize_config(list())$sampling_method, "pps")
  expect_identical(hojas_ruta_integrada_normalize_config(list(sampling_method = "pps_tope"))$sampling_method, "pps_tope")
  expect_identical(hojas_ruta_integrada_normalize_config(list(sampling_method = "inventado"))$sampling_method, "pps")
  expect_true("pps_tope" %in% vapply(.hojas_ruta_sampling_methods(), `[[`, character(1), "id"))
  base <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
               entrevistas_por_manzana = 8, max_per_manzana = 8, seed = 2017, replacements_per_titular = 1)
  defecto <- hojas_ruta_sample_preview_integrado(base)
  pps <- hojas_ruta_sample_preview_integrado(c(base, list(sampling_method = "pps")))
  expect_identical(defecto$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO)
  expect_identical(.hojas_ruta_rows_df(defecto$blocks)$id_manzana, .hojas_ruta_rows_df(pps$blocks)$id_manzana)
  comp <- hojas_ruta_marco_elegible_completar(defecto, base)
  expect_false("W_DESIGN_NOT_SELF_WEIGHTING" %in% vapply(comp$alerts, `[[`, character(1), "code"))
  expect_true(all(vapply(comp$marco_elegible$zonas, function(z) z$regla_pi, character(1)) == "pps_sistematico_distrito"))
})

test_that("pps_tope en el motor: firma propia, π publicada con tope y aviso de diseño no autoponderado", {
  cfg <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
              entrevistas_por_manzana = 8, max_per_manzana = 8, seed = 2017, replacements_per_titular = 1,
              sampling_method = "pps_tope")
  s <- hojas_ruta_sample_preview_integrado(cfg)
  expect_identical(s$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO_TOPE)
  expect_identical(s$method, "pps_tope")
  # Una firma vigente no es v1: no se marca ni se avisa.
  expect_identical(hojas_ruta_sorteo_aviso_v1(s), s)
  comp <- hojas_ruta_marco_elegible_completar(s, cfg)
  codigos <- vapply(comp$alerts, `[[`, character(1), "code")
  expect_identical(sum(codigos == "W_DESIGN_NOT_SELF_WEIGHTING"), 1L)
  # Idempotente: una segunda pasada no repite el aviso.
  otra <- hojas_ruta_marco_elegible_completar(comp, cfg)
  expect_identical(sum(vapply(otra$alerts, `[[`, character(1), "code") == "W_DESIGN_NOT_SELF_WEIGHTING"), 1L)
  zonas <- comp$marco_elegible$zonas
  expect_true(all(vapply(zonas, function(z) z$regla_pi, character(1)) == "pps_tope_distrito"))
  expect_true(all(vapply(zonas, function(z) is.finite(z$tope_medida) && z$tope_medida > 0, logical(1))))
  expect_identical(comp$marco_elegible$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO_TOPE)
  # La π publicada de las titulares es la de la fórmula sobre el marco del distrito.
  frame <- .hojas_ruta_filter_frame(hojas_ruta_integrada_normalize_config(cfg))
  v <- suppressWarnings(as.numeric(frame$viviendas))
  v[!is.finite(v) | v < 0] <- 0
  pi <- tope_pi_formula(v, length(s$blocks))
  sel <- unlist(lapply(zonas, function(z) z$seleccionadas), recursive = FALSE)
  pub <- vapply(sel, function(x) x$pi, numeric(1))
  esperado <- pi[match(vapply(sel, function(x) x$id_manzana, character(1)), as.character(frame$id_manzana))]
  expect_equal(pub, esperado)
  expect_identical(.hojas_ruta_workbook_method_label("pps_tope"), "PPS con tope")
})
