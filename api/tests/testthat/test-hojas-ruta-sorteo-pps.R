# ADR 0117: el sorteo de titulares es un sistemático PPS por distrito. Contrato del
# ADR 0066 §5 aplicado a Hojas de ruta: la frecuencia empírica de inclusión
# reproduce la π publicada (4·SE), con control positivo que valida el arnés.

# Dos distritos, ~40 zonas desiguales cada uno, algunas manzanas sin viviendas.
sorteo_fixture <- function() {
  set.seed(11L)
  filas <- list()
  for (u in c("150101", "150102")) {
    for (z in seq_len(40L)) {
      k <- sample(2:6, 1)
      viv <- round(stats::rlnorm(k, meanlog = log(if (z %% 7L == 0L) 120 else 25), sdlog = 0.8))
      viv[sample.int(k, 1)] <- if (z %% 5L == 0L) 0 else viv[1]
      filas[[length(filas) + 1L]] <- data.frame(
        ubigeo = u, distrito = paste("Distrito", u), zona = sprintf("%05d", z * 100L),
        manzana = sprintf("%03d", seq_len(k)), id_manzana = sprintf("%s%05d%03d", u, z * 100L, seq_len(k)),
        viviendas = viv, poblacion = viv * 3, stringsAsFactors = FALSE
      )
    }
  }
  df <- do.call(rbind, filas)
  # Una manzana enorme en el segundo distrito: certeza.
  df$viviendas[df$ubigeo == "150102"][3] <- 4000
  df
}
sorteo_cfg <- function(...) {
  base <- list(sampling_method = "pps", measure_var = "viviendas", row_var = "distrito")
  cambios <- list(...)
  base[names(cambios)] <- cambios
  base
}
sorteo_frecuencias <- function(df, n, cfg, veces = 300L, semilla = 2017L) {
  set.seed(semilla)
  ids <- unlist(lapply(seq_len(veces), function(i) {
    as.character(.hojas_ruta_sorteo_titulares_distrito(df, data.frame(), df$ubigeo[[1]], n * 8L, 8L, cfg)$blocks$id_manzana)
  }))
  as.numeric(table(factor(ids, levels = df$id_manzana))) / veces
}

test_that("la frecuencia de cada manzana reproduce la π publicada (4·SE), con control positivo", {
  marco <- sorteo_fixture()
  cfg <- sorteo_cfg()
  for (u in unique(marco$ubigeo)) {
    df <- marco[marco$ubigeo == u, , drop = FALSE]
    pi <- .hojas_ruta_sorteo_pi(df$viviendas, 25L)
    expect_equal(sum(pi), 25)
    freq <- sorteo_frecuencias(df, 25L, cfg)
    se <- sqrt(pmax(pi * (1 - pi), 1e-4) / 300)
    expect_true(all(abs(freq - pi) <= 4 * se), info = u)
    # Control positivo: la π de v1 (mayor resto por zona) no pasa el mismo arnés.
    zf <- stats::aggregate(df["viviendas"], by = df["zona"], FUN = sum)
    rutas_v1 <- .hojas_ruta_allocate_integer(zf$viviendas, 25L)
    pi_v1 <- ifelse(rutas_v1[match(df$zona, zf$zona)] > 0, pi, 0)
    expect_false(all(abs(freq - pi_v1) <= 4 * se))
    # Control de escala: una π 30 % más alta (sin certezas) tampoco pasa.
    libres <- pi > 0 & pi < 1
    expect_false(all(abs(freq[libres] - pmin(1, 1.3 * pi[libres])) <= 4 * se[libres]))
    # Toda zona con viviendas sale alguna vez; M = 0 nunca.
    zonas_con_viv <- unique(df$zona[df$viviendas > 0])
    vistas <- unique(df$zona[freq > 0])
    expect_setequal(vistas, zonas_con_viv)
    expect_true(all(freq[df$viviendas <= 0] == 0))
  }
  # La certeza sale siempre.
  df2 <- marco[marco$ubigeo == "150102", , drop = FALSE]
  expect_identical(sorteo_frecuencias(df2, 25L, cfg)[df2$viviendas == 4000], 1)
})

test_that("misma semilla, misma muestra; la lista va por zona y la zona es estrato implícito", {
  df <- sorteo_fixture()
  df <- df[df$ubigeo == "150101", , drop = FALSE]
  una <- function() { set.seed(5L); .hojas_ruta_sorteo_titulares_distrito(df, data.frame(), "150101", 200L, 8L, sorteo_cfg()) }
  a <- una()
  b <- una()
  expect_identical(a$blocks$id_manzana, b$blocks$id_manzana)
  expect_identical(nrow(a$blocks), 25L)
  expect_identical(a$sin_asignar, 0L)
  expect_false(is.unsorted(paste(a$blocks$zona, a$blocks$manzana)))
  # Cada zona recibe ⌊Σπ_z⌋ o ⌈Σπ_z⌉ rutas.
  pi_z <- tapply(.hojas_ruta_sorteo_pi(df$viviendas, 25L), df$zona, sum)
  n_z <- as.numeric(table(factor(a$blocks$zona, levels = names(pi_z))))
  expect_true(all(n_z >= floor(pi_z + 1e-9) & n_z <= ceiling(pi_z - 1e-9)))
  expect_true(all(a$blocks$tipo_manzana == "titular" & a$blocks$entrevistas == 8L))
})

test_that("más rutas que manzanas con viviendas: salen todas y el resto se avisa sin asignar", {
  df <- sorteo_fixture()
  df <- df[df$ubigeo == "150101" & df$zona %in% c("00100", "00200"), , drop = FALSE]
  positivas <- sum(df$viviendas > 0)
  set.seed(1L)
  s <- .hojas_ruta_sorteo_titulares_distrito(df, data.frame(), "150101", (positivas + 3L) * 8L, 8L, sorteo_cfg())
  expect_setequal(s$blocks$id_manzana, df$id_manzana[df$viviendas > 0])
  expect_identical(s$sin_asignar, 24L)
  expect_true("W_FRAME_INSUFFICIENT" %in% vapply(s$alertas, `[[`, character(1), "code"))
})

test_that("un distrito de una sola zona, sin rutas, o sin medida no se sortea en silencio", {
  df <- sorteo_fixture()
  una_zona <- df[df$ubigeo == "150101" & df$zona == "00700", , drop = FALSE]
  set.seed(3L)
  s <- .hojas_ruta_sorteo_titulares_distrito(una_zona, data.frame(), "150101", 16L, 8L, sorteo_cfg())
  expect_identical(nrow(s$blocks), 2L)
  expect_true(all(s$blocks$orden_seleccion == 1:2))
  # route_total = 0: nada se sortea y las 5 entrevistas se avisan.
  cero <- .hojas_ruta_sorteo_titulares_distrito(una_zona, data.frame(), "150101", 5L, 8L, sorteo_cfg())
  expect_identical(nrow(cero$blocks), 0L)
  expect_identical(cero$alertas[[1]]$code, "W_QUOTA_REMAINDER_UNROUTED")
  expect_identical(cero$alertas[[1]]$entrevistas, 5L)
  # Todas las medidas en 0 o NA: error declarado y las rutas quedan sin asignar.
  sin <- una_zona
  sin$viviendas <- c(0, rep(NA, nrow(sin) - 1L))
  e <- .hojas_ruta_sorteo_titulares_distrito(sin, data.frame(), "150101", 16L, 8L, sorteo_cfg())
  expect_identical(nrow(e$blocks), 0L)
  expect_identical(e$sin_asignar, 16L)
  expect_identical(e$alertas[[1]]$code, "E_FRAME_WITHOUT_MEASURE")
  expect_identical(e$alertas[[1]]$level, "error")
  # El sistemático de igual probabilidad no depende de la medida.
  set.seed(3L)
  sis <- .hojas_ruta_sorteo_titulares_distrito(sin, data.frame(), "150101", 16L, 8L, sorteo_cfg(sampling_method = "sistematico"))
  expect_identical(nrow(sis$blocks), 2L)
})

test_that("con cuota por zona: el redondeo es aleatorio controlado y asignadas + sin ruta = cuota", {
  df <- sorteo_fixture()
  df <- df[df$ubigeo == "150101", , drop = FALSE]
  zonas <- sort(unique(df$zona))
  cuotas <- c(13, 3, 5, 20, rep(4, length(zonas) - 4L))
  cells <- data.frame(ubigeo = "150101", territorio = paste0("150101-", zonas), cuota = cuotas, stringsAsFactors = FALSE)
  cfg <- sorteo_cfg(row_var = "zona")
  set.seed(9L)
  s <- .hojas_ruta_sorteo_titulares_distrito(df, cells, "150101", sum(cuotas), 8L, cfg)
  resto <- Filter(function(a) identical(a$code, "W_QUOTA_REMAINDER_UNROUTED"), s$alertas)
  sin_ruta <- if (length(resto)) resto[[1]]$entrevistas else 0L
  expect_identical(as.integer(sum(s$blocks$entrevistas) + s$sin_asignar + sin_ruta), as.integer(sum(cuotas)))
  # Ninguna zona chica pierde siempre su cuota: en esperanza recibe n_z/k rutas.
  set.seed(4L)
  r <- replicate(2000L, .hojas_ruta_sorteo_rutas_por_zona(cuotas, 8L))
  x <- floor(sum(cuotas) / 8) * cuotas / sum(cuotas)
  expect_true(all(abs(rowMeans(r) - x) < 0.05))
  expect_true(all(colSums(r) == floor(sum(cuotas) / 8)))
  expect_true(all(r >= floor(x) & r <= ceiling(x)))
})

test_that("con cuota por zona, sortear no avisa zonas sin probabilidad: la cuota ya las reparte al azar", {
  df <- sorteo_fixture()
  df <- df[df$ubigeo == "150101", , drop = FALSE]
  zonas <- sort(unique(df$zona))
  cuotas <- c(rep(16, 10L), rep(0, length(zonas) - 10L))
  cells <- data.frame(ubigeo = "150101", territorio = paste0("150101-", zonas), cuota = cuotas, stringsAsFactors = FALSE)
  set.seed(9L)
  s <- .hojas_ruta_sorteo_titulares_distrito(df, cells, "150101", sum(cuotas), 8L, sorteo_cfg(row_var = "zona"))
  expect_false("W_ZONE_QUOTA_EXCLUDES_ZONES" %in% vapply(s$alertas, `[[`, character(1), "code"))
  # El aviso sigue disponible para las muestras viejas y nombra la causa.
  a <- .hojas_ruta_sorteo_aviso_cuota_zona(df, zonas, as.integer(cuotas / 8), "150101", "Distrito")
  esperado <- 100 * sum(df$viviendas[!df$zona %in% zonas[1:10]]) / sum(df$viviendas)
  expect_equal(a$viviendas_sin_probabilidad_pct, round(esperado, 1))
  expect_match(a$message, "cuota por zona")
  # El redondeo nunca da una ruta extra a una zona sin fracción, aunque sea la última.
  expect_identical(.hojas_ruta_sorteo_rutas_por_zona(c(12, 12, 0), 8L)[[3]], 0L)
})

test_that("la cuota por zona reparte las rutas al azar: ⌊x⌋ o ⌈x⌉, E = x, total exacto y reproducible", {
  pob <- c(5000, 300, 120, 80, 2400, 40, 900, 15, 0, 610)
  x <- 7 * pob / sum(pob)
  r <- vapply(seq_len(4000L), function(semilla) .hojas_ruta_cuota_zona_rutas(pob, 7L, semilla, "150101"), integer(length(pob)))
  expect_true(all(colSums(r) == 7L))
  expect_true(all(r >= floor(x + 1e-9) & r <= ceiling(x - 1e-9)))
  # Esperanza = x_z (4·SE de una Bernoulli por zona).
  se <- sqrt(pmax(x - floor(x), 1e-9) * (1 - (x - floor(x))) / 4000)
  expect_true(all(abs(rowMeans(r) - x) <= 4 * se + 1e-9))
  # Toda zona con población recibe ruta alguna vez; la de población 0, nunca.
  expect_true(all(rowSums(r[pob > 0, , drop = FALSE]) > 0))
  expect_true(all(r[pob == 0, ] == 0L))
  # Control positivo del arnés: el mayor resto determinista deja zonas en 0 siempre.
  expect_true(any(.hojas_ruta_allocate_integer(pob, 7L)[pob > 0] == 0L))
  # Reproducible y sin consumir el flujo aleatorio del sorteo.
  expect_identical(.hojas_ruta_cuota_zona_rutas(pob, 7L, 2017L, "150101"), .hojas_ruta_cuota_zona_rutas(pob, 7L, 2017L, "150101"))
  set.seed(5L); antes <- stats::runif(1)
  set.seed(5L); invisible(.hojas_ruta_cuota_zona_rutas(pob, 7L, 2017L, "150101")); despues <- stats::runif(1)
  expect_identical(antes, despues)
  expect_identical(.hojas_ruta_cuota_zona_rutas(numeric(0), 3L, 1L, "x"), integer(0))
  expect_identical(.hojas_ruta_cuota_zona_rutas(pob, 0L, 1L, "x"), integer(length(pob)))
})

test_that("con cuota por zona, toda zona del distrito puede recibir cuota según la semilla", {
  base <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
               entrevistas_por_manzana = 8, max_per_manzana = 8, row_var = "zona", replacements_per_titular = 1)
  zonas_con_cuota <- function(semilla) {
    cfg <- hojas_ruta_integrada_normalize_config(c(base, list(seed = semilla)))
    cells <- .hojas_ruta_quota_cells(.hojas_ruta_filter_frame(cfg), cfg)
    expect_equal(sum(cells$cuota), 80)
    unique(as.character(cells$territorio[cells$cuota > 0]))
  }
  vistas <- lapply(1:60, zonas_con_cuota)
  expect_identical(zonas_con_cuota(7L), zonas_con_cuota(7L))
  # Con la regla vieja salían siempre las mismas zonas; ahora la semilla las mueve.
  expect_gt(length(unique(unlist(vistas))), length(vistas[[1]]))
})

test_that("una muestra sin firma es v1 y avisa por distrito cuánto quedó sin probabilidad, sin re-sortear", {
  cfg <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
              entrevistas_por_manzana = 8, max_per_manzana = 8, seed = 2017, replacements_per_titular = 1)
  s <- hojas_ruta_sample_preview_integrado(cfg)
  expect_identical(s$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO)
  expect_identical(hojas_ruta_sorteo_aviso_v1(s), s)
  v1 <- s
  v1$algoritmo_sorteo <- NULL
  avisada <- hojas_ruta_sorteo_aviso_v1(v1)
  expect_identical(avisada$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO_V1)
  a <- Filter(function(x) identical(x$code, "W_SAMPLE_DRAWN_WITH_V1"), avisada$alerts)
  expect_length(a, 1)
  expect_true(a[[1]]$viviendas_sin_probabilidad_pct > 0)
  expect_match(a[[1]]$message, "vuelve a sortear antes de salir a campo")
  expect_match(a[[1]]$message, "marco elegible del distrito")
  # Va al frente (el panel corta a los primeros avisos) y no trae campos que nadie lee.
  expect_identical(avisada$alerts[[1]]$code, "W_SAMPLE_DRAWN_WITH_V1")
  expect_null(a[[1]]$fuerte)
  # Lo caro se memoriza: la segunda carga de la misma muestra no vuelve a leer el marco.
  segunda <- with_mocked_bindings(
    hojas_ruta_sorteo_aviso_v1(v1),
    .hojas_ruta_sorteo_avisos_v1 = function(sample) stop("recalculó")
  )
  expect_identical(segunda$alerts, avisada$alerts)
  expect_identical(avisada$blocks, v1$blocks)
  # Idempotente: no se repite.
  expect_length(Filter(function(x) identical(x$code, "W_SAMPLE_DRAWN_WITH_V1"), hojas_ruta_sorteo_aviso_v1(avisada)$alerts), 1)
  # Con cuota por zona v1 y v2 cubren lo mismo: no se pide volver a sortear, se avisa la cuota.
  z <- hojas_ruta_sample_preview_integrado(c(cfg, list(row_var = "zona")))
  z_v1 <- z
  z_v1$algoritmo_sorteo <- NULL
  z_v1$alerts <- Filter(function(x) !identical(x$code, "W_ZONE_QUOTA_EXCLUDES_ZONES"), z$alerts)
  codigos <- vapply(hojas_ruta_sorteo_aviso_v1(z_v1)$alerts, `[[`, character(1), "code")
  expect_false("W_SAMPLE_DRAWN_WITH_V1" %in% codigos)
  # Al sortear ya no se avisa (la cuota reparte al azar); al cargarla como v1, sí, si su cuota dejó zonas en 0.
  expect_false("W_ZONE_QUOTA_EXCLUDES_ZONES" %in% vapply(z$alerts, `[[`, character(1), "code"))
  hay_ceros <- any(vapply(split(z$quota$cells, vapply(z$quota$cells, function(c) as.character(c$territorio), character(1))),
                          function(g) sum(vapply(g, function(c) as.numeric(c$cuota), numeric(1))) <= 0, logical(1)))
  if (hay_ceros) expect_true("W_ZONE_QUOTA_EXCLUDES_ZONES" %in% codigos)
})

test_that("los reemplazos PPS tampoco salen de manzanas sin viviendas (ADR 0117 §3); el sistemático sí las admite", {
  base <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
               entrevistas_por_manzana = 8, max_per_manzana = 8, replacements_per_titular = 3)
  for (politica in c("paired_by_titular_zone", "alternate_zone_same_district")) {
    viv <- unlist(lapply(c(2017, 7, 99), function(semilla) {
      s <- hojas_ruta_sample_preview_integrado(c(base, list(seed = semilla, replacement_policy = politica)))
      suppressWarnings(as.numeric(.hojas_ruta_rows_df(s$replacement_blocks)$viviendas))
    }))
    expect_gt(length(viv), 0)
    expect_true(all(!is.na(viv) & viv > 0), info = politica)
  }
  sin <- data.frame(id_manzana = c("a", "b"), viviendas = c(0, NA))
  expect_identical(nrow(.hojas_ruta_sorteo_candidatos(sin, list(sampling_method = "pps", measure_var = "viviendas"))), 0L)
  expect_identical(nrow(.hojas_ruta_sorteo_candidatos(sin, list(sampling_method = "sistematico", measure_var = "viviendas"))), 2L)
})
