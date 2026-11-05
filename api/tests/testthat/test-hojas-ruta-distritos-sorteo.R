# Distritos de inclusión forzosa y distritos sorteados dentro de cada ciudad o área de Lima
# (ADR 0131 §1c). Reusa el registro y la configuración del test de ciudades (§1b).

.ds_registro <- function() {
  jsonlite::fromJSON(.hojas_ruta_inst_path("hojas_ruta", "territorios.json"), simplifyVector = FALSE)
}

.ds_ubigeos <- function() unlist(lapply(.ds_registro()$provincias, function(p) unlist(p$distritos)))

.ds_cfg <- function(estrato = "provincia_lima_areas", rutas = 225L, minimo = NULL, seed = NULL, base = "cpv2025_adultos_urbanos") {
  ss <- list(design_effect = 1, estrato = estrato, base_reparto = base)
  if (!is.null(minimo)) ss$rutas_minimas_distrito <- minimo
  cfg <- list(territorios = .ds_ubigeos(), sample_size_mode = "external_total", n_objetivo = rutas * 8L, entrevistas_por_manzana = 8L, sample_size = ss)
  if (!is.null(seed)) cfg$seed <- seed
  hojas_ruta_integrada_normalize_config(cfg)
}

test_that("rutas_minimas_distrito es 3 por defecto, 0 lo apaga y sólo rige con estrato provincia y base 2025", {
  expect_identical(hojas_ruta_distritos_normalizar(NULL)$rutas_minimas_distrito, 3L)
  expect_identical(hojas_ruta_distritos_normalizar(list(rutas_minimas_distrito = -2))$rutas_minimas_distrito, 3L)
  expect_identical(hojas_ruta_distritos_normalizar(list(rutas_minimas_distrito = 0))$rutas_minimas_distrito, 0L)
  expect_identical(.ds_cfg(minimo = 4L)$sample_size$rutas_minimas_distrito, 4L)
  expect_identical(.ds_cfg()$sample_size$rutas_minimas_distrito, 3L)
  expect_true(hojas_ruta_distritos_activo(.ds_cfg()$sample_size))
  expect_false(hojas_ruta_distritos_activo(.ds_cfg(minimo = 0L)$sample_size))
  expect_false(hojas_ruta_distritos_activo(.ds_cfg(base = "cpv2017")$sample_size))
  expect_false(hojas_ruta_distritos_activo(.ds_cfg(estrato = "distrito")$sample_size))
})

test_that("el plan: forzosos con R_d ≥ m, h_g = max(1, ⌊R_g/m⌋), Σ π_d del grupo = h_g y piso m", {
  mos <- c(40, 30, 5, 4, 3, 2, 1)
  p <- hojas_ruta_distritos_plan(mos, 20L, 3L)
  R <- 20 * mos / sum(mos)
  expect_identical(p$condicion[R >= 3], rep("forzoso", sum(R >= 3)))
  cand <- p$condicion == "candidato"
  expect_identical(p$h, max(1L, as.integer(floor(sum(R[cand]) / 3))))
  expect_equal(sum(p$pi_distrito[cand]), p$h, tolerance = 1e-12)
  expect_true(all(p$pi_distrito[cand] < 1))
  expect_identical(sum(p$rutas_fijas) + p$rutas_grupo, 20L)
  expect_true(all(p$rutas_fijas[p$condicion == "forzoso"] >= 3L))
  expect_gte(p$rutas_grupo, 3L * p$h)
})

test_that("un grupo con menos rutas que el mínimo recibe el mínimo descontado de los forzosos, y se declara", {
  # 12 rutas: R = (6.4, 4.8, 0.48, 0.32). El grupo suma 0.8 < 3.
  p <- hojas_ruta_distritos_plan(c(40, 30, 3, 2), 12L, 3L)
  expect_identical(p$regla, "minimo_descontado_de_forzosos")
  expect_identical(p$h, 1L)
  expect_identical(p$rutas_grupo, 3L)
  expect_identical(sum(p$rutas_fijas), 9L)
  expect_true(all(p$rutas_fijas[1:2] >= 3L))
  # Si los forzosos no pueden ceder, el más chico pasa al grupo.
  q <- hojas_ruta_distritos_plan(c(31, 31, 2), 7L, 3L)
  expect_identical(q$regla, "forzoso_al_grupo")
  expect_identical(sum(q$rutas_fijas) + q$rutas_grupo, 7L)
  expect_true(all(c(q$rutas_fijas[q$rutas_fijas > 0], q$rutas_grupo) >= 3L))
  # Menos rutas que el mínimo en todo el estrato: un solo distrito con todas.
  r <- hojas_ruta_distritos_plan(c(5, 4, 3), 2L, 3L)
  expect_identical(r$regla, "estrato_bajo_minimo")
  expect_identical(c(r$h, r$rutas_grupo), c(1L, 2L))
  for (n in 1:30) {
    pl <- hojas_ruta_distritos_plan(c(9, 7, 5, 3, 2, 1, 1, 0.5), n, 3L)
    expect_identical(sum(pl$rutas_fijas) + pl$rutas_grupo, n)
    s <- hojas_ruta_distritos_sorteo(c(9, 7, 5, 3, 2, 1, 1, 0.5), n, 3L, 7L, "x")
    expect_identical(sum(s$rutas), n)
    if (n >= 3L) expect_true(all(s$rutas[s$rutas > 0] >= 3L))
  }
})

test_that("con el registro: todo distrito visitado lleva ≥ 3 rutas, Σ rutas = total por estrato y Σ π_d = h_g", {
  for (rutas in c(150L, 225L)) {
    cfg <- .ds_cfg(rutas = rutas)
    a <- hojas_ruta_estrato_asignacion(cfg$territorios, rutas, cfg)
    d <- a$distritos
    expect_identical(sum(d$rutas), rutas)
    expect_true(all(d$rutas[d$rutas > 0] >= 3L))
    expect_true(all(d$condicion_distrito[d$rutas > 0] %in% c("forzoso", "sorteado")))
    expect_true(all(d$rutas[d$condicion_distrito %in% c("no_sorteado", "sin_medida")] == 0L))
    for (h in a$estratos$estrato) expect_identical(sum(d$rutas[d$estrato == h]), a$estratos$rutas[a$estratos$estrato == h])
    g <- a$grupos_distritos
    expect_identical(sort(g$estrato), sort(a$estratos$estrato[a$estratos$rutas > 0]))
    expect_true(all(g$n_sorteados == g$h))
    # Σ π_d del grupo = h_g en los estratos de una sola rama (ciudades forzosas).
    for (k in which(g$estrato %in% d$estrato[d$f_n == 0])) {
      ix <- d$estrato == g$estrato[k] & d$condicion_distrito %in% c("sorteado", "no_sorteado")
      expect_equal(sum(d$pi_distrito[ix]), g$h[k], tolerance = 1e-10)
    }
    expect_true(all(d$pi_distrito[d$condicion_distrito == "forzoso"] == 1 | d$f_n[d$condicion_distrito == "forzoso"] > 0))
    expect_identical(a$rutas_minimas_distrito, 3L)
  }
})

test_that("Lima con 122 rutas deja de visitar distritos con 1 o 2 rutas", {
  cfg <- .ds_cfg(estrato = "provincia", rutas = 225L)
  a <- hojas_ruta_estrato_asignacion(cfg$territorios, 225L, cfg)
  lima <- a$distritos[a$distritos$ciudad == "1501", ]
  expect_true(all(lima$rutas[lima$rutas > 0] >= 3L))
  expect_lt(sum(lima$rutas > 0), sum(a$distritos$ciudad == "1501"))
})

test_that("la semilla reproduce el sorteo de distritos y otra semilla lo cambia", {
  a1 <- hojas_ruta_estrato_asignacion(.ds_cfg(seed = 11L)$territorios, 225L, .ds_cfg(seed = 11L))
  a2 <- hojas_ruta_estrato_asignacion(.ds_cfg(seed = 11L)$territorios, 225L, .ds_cfg(seed = 11L))
  a3 <- hojas_ruta_estrato_asignacion(.ds_cfg(seed = 12L)$territorios, 225L, .ds_cfg(seed = 12L))
  expect_identical(a1$distritos$rutas, a2$distritos$rutas)
  expect_false(identical(a1$distritos$rutas, a3$distritos$rutas))
})

test_that("Monte Carlo: la frecuencia con que sale cada distrito del grupo converge a π_d", {
  mos <- c(9, 7, 5, 3, 2, 1, 1, 0.5, 4, 6)
  p <- hojas_ruta_distritos_plan(mos, 14L, 3L)
  cand <- which(p$condicion == "candidato")
  expect_gt(length(cand), p$h)
  B <- 4000L
  sale <- vapply(seq_len(B), function(b) hojas_ruta_distritos_sorteo(mos, 14L, 3L, b, "mc")$rutas > 0L, logical(length(mos)))
  freq <- rowMeans(sale)
  expect_true(all(freq[p$condicion == "forzoso"] == 1))
  se <- sqrt(p$pi_distrito[cand] * (1 - p$pi_distrito[cand]) / B)
  expect_true(all(abs(freq[cand] - p$pi_distrito[cand]) < 4 * se + 1e-3))
})

test_that("con el §1c apagado (mínimo 0 o base 2017) la asignación queda idéntica a la del §1b", {
  for (cfg in list(.ds_cfg(minimo = 0L), .ds_cfg(base = "cpv2017"))) {
    a <- hojas_ruta_estrato_asignacion(cfg$territorios, 225L, cfg)
    expect_null(a$grupos_distritos)
    expect_false("pi_distrito" %in% names(a$distritos))
    old <- vapply(a$estratos$estrato[a$estratos$rutas > 0], function(h) {
      ix <- a$distritos$estrato == h
      identical(a$distritos$rutas[ix],
                .hojas_ruta_cuota_zona_rutas(a$distritos$mos[ix], a$estratos$rutas[a$estratos$estrato == h], cfg$seed %||% 2017L, paste0("estrato-", h)))
    }, logical(1))
    expect_true(all(old))
  }
})
