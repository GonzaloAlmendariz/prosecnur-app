# Ciudades de inclusión forzosa y ciudades sorteadas por macrorregión (ADR 0131 §1b).

.cs_registro <- function() {
  jsonlite::fromJSON(.hojas_ruta_inst_path("hojas_ruta", "territorios.json"), simplifyVector = FALSE)
}

.cs_ubigeos <- function() unlist(lapply(.cs_registro()$provincias, function(p) unlist(p$distritos)))

.cs_cfg <- function(estrato = "provincia_lima_areas", rutas = 225L, minimo = NULL, seed = NULL, base = "cpv2025_adultos_urbanos") {
  ss <- list(design_effect = 1, estrato = estrato, base_reparto = base)
  if (!is.null(minimo)) ss$rutas_minimas_ciudad <- minimo
  cfg <- list(territorios = .cs_ubigeos(), sample_size_mode = "external_total", n_objetivo = rutas * 8L, entrevistas_por_manzana = 8L, sample_size = ss)
  if (!is.null(seed)) cfg$seed <- seed
  hojas_ruta_integrada_normalize_config(cfg)
}

test_that("la tabla de macrorregiones cubre los 25 departamentos, cada uno una vez, y todas las ciudades del registro", {
  deps <- unlist(HOJAS_RUTA_MACRORREGIONES, use.names = FALSE)
  expect_setequal(deps, sprintf("%02d", 1:25))
  expect_false(anyDuplicated(deps) > 0)
  expect_setequal(names(HOJAS_RUTA_MACRORREGIONES), c("norte", "centro", "sur", "oriente"))
  provs <- unique(substr(.cs_ubigeos(), 1L, 4L))
  expect_false(anyNA(hojas_ruta_macrorregion_de(provs)))
  expect_identical(hojas_ruta_macrorregion_de(c("0401", "130101", "1601", "1501")), c("sur", "norte", "oriente", "centro"))
  err <- tryCatch(hojas_ruta_macrorregion_de("9901"), api_error = function(e) e)
  expect_identical(err$code, "E_HOJAS_RUTA_CIUDAD_SIN_MACRORREGION")
})

test_that("rutas_minimas_ciudad es 6 por defecto y se normaliza en sample_size", {
  expect_identical(hojas_ruta_ciudades_normalizar(NULL)$rutas_minimas_ciudad, 6L)
  expect_identical(hojas_ruta_ciudades_normalizar(list(rutas_minimas_ciudad = 0))$rutas_minimas_ciudad, 6L)
  expect_identical(.cs_cfg(minimo = 8L)$sample_size$rutas_minimas_ciudad, 8L)
  expect_identical(.cs_cfg()$sample_size$rutas_minimas_ciudad, 6L)
})

test_that("toda ciudad visitada tiene al menos el mínimo, Σ rutas = total y Lima y Callao entran siempre", {
  for (minimo in c(6L, 8L)) {
    for (rutas in c(150L, 225L)) {
      cfg <- .cs_cfg(minimo = minimo, rutas = rutas)
      a <- hojas_ruta_estrato_asignacion(cfg$territorios, rutas, cfg)
      cc <- a$ciudades
      expect_identical(sum(cc$rutas), rutas)
      expect_identical(sum(a$distritos$rutas), rutas)
      expect_true(all(cc$rutas[cc$rutas > 0] >= minimo))
      expect_true(all(cc$rutas[cc$condicion != "no_sorteada"] >= minimo))
      expect_true(all(cc$rutas[cc$condicion == "no_sorteada"] == 0L))
      expect_true(all(cc$condicion[cc$ciudad %in% c("1501", "0701")] == "forzosa"))
      # Forzosa: su reparto proporcional alcanza el mínimo (o es Lima/Callao, o π_c llegó a 1).
      f <- cc[cc$condicion == "forzosa", ]
      expect_true(all(f$reparto >= minimo - 1e-9 | f$ciudad %in% c("1501", "0701") | f$pi_ciudad >= 1))
    }
  }
})

test_that("en cada grupo Σ π_c = h_g, π_c < 1 y h_g = max(1, ⌊R_g / mínimo⌋)", {
  cfg <- .cs_cfg()
  a <- hojas_ruta_estrato_asignacion(cfg$territorios, 225L, cfg)
  cc <- a$ciudades
  for (k in seq_len(nrow(a$grupos))) {
    g <- a$grupos[k, ]
    ix <- !is.na(cc$grupo) & cc$grupo == g$grupo
    expect_equal(sum(cc$pi_ciudad[ix]), g$h, tolerance = 1e-10)
    expect_true(all(cc$pi_ciudad[ix] < 1))
    expect_identical(g$h, max(1L, as.integer(floor(g$reparto / 6 + 1e-9))))
    expect_identical(sum(cc$condicion[ix] == "sorteada"), g$h)
    expect_identical(sum(cc$rutas[ix]), g$rutas)
  }
})

test_that("una ciudad con π_c ≥ 1 pasa a forzosa y el grupo se recalcula", {
  ciudad <- c("2001", "2006", "2005", "1501")
  pob <- c(1.5, 1, 1, 50)
  # 70 rutas, mínimo 2: R = (1.96, 1.31, 1.31, 65.4). El norte suma 4.58 → h = 2, y con la
  # medida concentrada en 2001 su π = 2 · 100/102 ≥ 1: pasa a forzosa y el grupo queda en h = 1.
  mos <- c(100, 1, 1, 500)
  cfg <- list(sample_size = list(rutas_minimas_ciudad = 2L), seed = 1L)
  s <- hojas_ruta_ciudades_seleccion(ciudad, pob, mos, 70L, cfg)
  cc <- s$ciudades
  expect_identical(cc$condicion[cc$ciudad == "2001"], "forzosa")
  expect_true(all(cc$pi_ciudad[!is.na(cc$grupo)] < 1))
  expect_identical(s$grupos$h, 1L)
  expect_equal(cc$pi_ciudad[cc$ciudad %in% c("2006", "2005")], c(0.5, 0.5))
  expect_identical(sum(cc$rutas), 70L)
})

test_that("Monte Carlo: la frecuencia con que sale cada ciudad cuadra con π_c", {
  cfg <- .cs_cfg()
  a <- hojas_ruta_estrato_asignacion(cfg$territorios, 225L, cfg)
  d <- a$distritos
  base <- hojas_ruta_reparto_base_distritos(d$ubigeo)
  R <- 2000L
  sale <- matrix(0L, nrow = nrow(a$ciudades), ncol = 1, dimnames = list(a$ciudades$ciudad, NULL))
  for (r in seq_len(R)) {
    s <- hojas_ruta_ciudades_seleccion(d$ciudad, base$p25, d$mos, 225L, list(sample_size = list(rutas_minimas_ciudad = 6L), seed = 5000L + r))
    sale[s$ciudades$ciudad, 1] <- sale[s$ciudades$ciudad, 1] + as.integer(s$ciudades$rutas > 0)
  }
  frec <- sale[, 1] / R
  pi_c <- stats::setNames(a$ciudades$pi_ciudad, a$ciudades$ciudad)
  se <- sqrt(pi_c * (1 - pi_c) / R)
  expect_true(all(abs(frec[names(pi_c)] - pi_c) <= 4 * se + 1e-9))
})

test_that("autoponderación en el grupo: π_c · π_i|c = n_g · MOS_i / MOS_g", {
  cfg <- .cs_cfg()
  a <- hojas_ruta_estrato_asignacion(cfg$territorios, 225L, cfg)
  d <- a$distritos
  frame <- .hojas_ruta_filter_frame(cfg)
  for (k in seq_len(nrow(a$grupos))) {
    g <- a$grupos[k, ]
    dd <- d[!is.na(d$grupo) & d$grupo == g$grupo, ]
    mos_g <- sum(dd$mos)
    ratio <- unlist(lapply(seq_len(nrow(dd)), function(j) {
      df <- frame[as.character(frame$ubigeo) == dd$ubigeo[[j]], , drop = FALSE]
      if (!nrow(df)) return(numeric(0))
      m <- .hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df))
      # Sólo distritos sin certezas en ninguna rama: con certezas la π no es lineal en la medida.
      if (max(dd$n_hi[[j]] * dd$share[[j]] * m / sum(m)) >= 1) return(numeric(0))
      pi <- hojas_ruta_ciudades_pi(m, dd$pi_ciudad[[j]], dd$n_lo[[j]], dd$n_hi[[j]], dd$f_n[[j]], dd$share[[j]])
      (pi / m)[m > 0]
    }))
    expect_gt(length(ratio), 0L)
    expect_equal(ratio, rep(g$rutas / mos_g, length(ratio)), tolerance = 1e-6)
  }
})

test_that("la semilla es reproducible: misma semilla, mismas ciudades; otra semilla puede cambiarlas", {
  a1 <- hojas_ruta_estrato_asignacion(.cs_ubigeos(), 225L, .cs_cfg(seed = 11L))
  a2 <- hojas_ruta_estrato_asignacion(.cs_ubigeos(), 225L, .cs_cfg(seed = 11L))
  expect_identical(a1$ciudades, a2$ciudades)
  otras <- lapply(12:30, function(s) hojas_ruta_estrato_asignacion(.cs_ubigeos(), 225L, .cs_cfg(seed = s))$ciudades$condicion)
  expect_true(any(vapply(otras, function(x) !identical(x, a1$ciudades$condicion), logical(1))))
})

test_that("sin rutas para los mínimos da un error declarado", {
  cfg <- .cs_cfg(minimo = 30L)
  err <- tryCatch(hojas_ruta_estrato_asignacion(cfg$territorios, 60L, cfg), api_error = function(e) e)
  expect_identical(err$code, "E_HOJAS_RUTA_CIUDAD_SIN_RUTAS")
})

test_that("con estrato distrito el mínimo por ciudad no cambia nada", {
  ub <- c("150110", "070106", "040101")
  base <- list(territorios = ub, sample_size_mode = "external_total", n_objetivo = 240, sample_size = list(design_effect = 1))
  con <- base
  con$sample_size$rutas_minimas_ciudad <- 9L
  a <- hojas_ruta_quota_preview_integrado(base)
  b <- hojas_ruta_quota_preview_integrado(con)
  expect_identical(a$cells, b$cells)
  expect_identical(hojas_ruta_sample_size_preview(base)$district_rows, hojas_ruta_sample_size_preview(con)$district_rows)
  expect_null(hojas_ruta_estrato_asignacion(ub, 30L, hojas_ruta_integrada_normalize_config(con)))
})

test_that("la memoria declara el mínimo por ciudad, las forzosas y los grupos con sus ciudades sorteadas y su probabilidad", {
  cfg <- .cs_cfg()
  sp <- hojas_ruta_sample_size_preview(list(territorios = cfg$territorios, sample_size_mode = "external_total", n_objetivo = 225L * 8L, entrevistas_por_manzana = 8L,
                                            sample_size = list(design_effect = 1, estrato = "provincia_lima_areas", base_reparto = "cpv2025_adultos_urbanos")))
  em <- sp$estrato_muestral
  expect_identical(as.integer(em$rutas_minimas_ciudad), 6L)
  expect_gt(length(em$ciudades), 0L)
  expect_gt(length(em$grupos), 0L)
  frase <- .reporte_mt_frase_estrato(em)
  expect_match(frase, "al menos 6 rutas")
  expect_match(frase, "Lima \\d+")
  expect_match(frase, "macrorregión")
  expect_match(frase, "probabilidad 0\\.\\d{2}")
  expect_match(frase, "(Norte|Centro|Sur|Oriente), \\d+ rutas en \\d+ de sus \\d+ ciudades")
})
