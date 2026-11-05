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

test_that("la muestra publica π = π_c · π_d · π_i|d, π_d y la condición del distrito; ninguna manzana de un distrito no sorteado", {
  # Lima Norte entera (8 distritos) con 8 rutas: unos forzosos y otros sorteados.
  ub <- HOJAS_RUTA_LIMA_AREAS$lima_norte
  cfg <- list(territorios = ub, sample_size_mode = "external_total", n_objetivo = 10L * 8L, entrevistas_por_manzana = 8L, seed = 3L,
              sample_size = list(design_effect = 1, estrato = "provincia", base_reparto = "cpv2025_adultos_urbanos"))
  ncfg <- hojas_ruta_integrada_normalize_config(cfg)
  a <- hojas_ruta_estrato_asignacion(ncfg$territorios, 10L, ncfg)
  d <- a$distritos
  expect_true(any(d$condicion_distrito == "sorteado"))
  expect_true(any(d$condicion_distrito == "no_sorteado"))
  s <- hojas_ruta_sample_preview_integrado(cfg)
  expect_true(s$ok)
  b <- .hojas_ruta_rows_df(s$blocks)
  expect_true(all(c("pi", "pi_distrito", "distrito_condicion") %in% names(b)))
  expect_false(any(b$ubigeo %in% d$ubigeo[d$condicion_distrito == "no_sorteado"]))
  expect_equal(b$pi_distrito, d$pi_distrito[match(b$ubigeo, d$ubigeo)])
  expect_true(all(b$pi > 0 & b$pi <= b$pi_distrito + 1e-12))
  expect_true(all(b$distrito_condicion %in% c("forzoso", "sorteado")))
  # Por distrito, las rutas sorteadas son las asignadas (cada ruta entera en su distrito).
  por_d <- table(b$ubigeo)
  expect_identical(as.integer(por_d[d$ubigeo[d$rutas > 0]]), d$rutas[d$rutas > 0])
  # Autoponderación del grupo sin certezas: π_d · π_i|d = n_g · MOS_i / MOS_g.
  frame <- .hojas_ruta_filter_frame(ncfg)
  g <- a$grupos_distritos
  for (u in d$ubigeo[d$condicion_distrito %in% c("sorteado", "no_sorteado")]) {
    df <- frame[as.character(frame$ubigeo) == u, , drop = FALSE]
    m <- .hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(ncfg, df))
    j <- match(u, d$ubigeo)
    if (max(ceiling(d$e_lo[[j]]) * m / sum(m)) >= 1) next
    pi <- hojas_ruta_distritos_pi(m, d[j, ])
    mos_g <- sum(d$mos[d$condicion_distrito %in% c("sorteado", "no_sorteado")])
    expect_equal((pi / m)[m > 0], rep(g$rutas_grupo[[1]] / mos_g, sum(m > 0)), tolerance = 1e-6)
  }
})

test_that("la ruta queda en su distrito: el reemplazo pareado es del distrito de su titular y las aledañas no cruzan el límite", {
  ub <- HOJAS_RUTA_LIMA_AREAS$lima_norte
  cfg <- list(territorios = ub, sample_size_mode = "external_total", n_objetivo = 10L * 8L, entrevistas_por_manzana = 8L, seed = 3L,
              replacements_per_titular = 1L,
              sample_size = list(design_effect = 1, estrato = "provincia", base_reparto = "cpv2025_adultos_urbanos"))
  s <- hojas_ruta_sample_preview_integrado(cfg)
  b <- .hojas_ruta_rows_df(s$blocks)
  r <- .hojas_ruta_rows_df(s$replacement_blocks)
  expect_gt(nrow(r), 0L)
  tit <- match(as.character(r$titular_id_manzana), as.character(b$id_manzana))
  expect_false(anyNA(tit))
  expect_identical(as.character(r$ubigeo), as.character(b$ubigeo[tit]))
  expect_identical(as.character(r$zona), as.character(b$zona[tit]))
  expect_identical(r$distrito_condicion, b$distrito_condicion[tit])
  expect_false(any(vapply(s$alerts, function(a) identical(a$code, "W_HOJAS_RUTA_REEMPLAZO_OTRO_DISTRITO"), logical(1))))
  # Las aledañas son una regla de campo (no son manzanas del sorteo): la ficha dice que no cruzan el distrito.
  bs <- .hojas_ruta_rows_df(hojas_ruta_tamano_extras_salto_muestra(s, cfg)$blocks)
  expect_true(all(grepl("mismo distrito", bs$regla_no_respuesta)))
  expect_false(grepl("mismo distrito", hojas_ruta_regla_no_respuesta(FALSE)))
  # El motor avisa si un reemplazo cruzara el límite distrital.
  bb <- data.frame(ubigeo = "150110", zona = "01", id_manzana = "A", stringsAsFactors = FALSE)
  rr <- data.frame(ubigeo = "150102", zona = "01", id_manzana = "B", titular_id_manzana = "A", stringsAsFactors = FALSE)
  av <- hojas_ruta_distritos_avisos_reemplazo(bb, rr)
  expect_identical(av[[1]]$code, "W_HOJAS_RUTA_REEMPLAZO_OTRO_DISTRITO")
  expect_length(hojas_ruta_distritos_avisos_reemplazo(bb, transform(rr, ubigeo = "150110")), 0L)
})

test_that("la vista previa del tamaño declara el mínimo por distrito y, por ciudad o área, los forzosos y el sorteo", {
  cfg <- .ds_cfg()
  sp <- hojas_ruta_sample_size_preview(list(territorios = cfg$territorios, sample_size_mode = "external_total", n_objetivo = 225L * 8L, entrevistas_por_manzana = 8L,
                                            sample_size = list(design_effect = 1, estrato = "provincia_lima_areas", base_reparto = "cpv2025_adultos_urbanos")))
  em <- sp$estrato_muestral
  expect_identical(as.integer(em$rutas_minimas_distrito), 3L)
  expect_match(em$regla_distritos, "§1c")
  g <- .hojas_ruta_rows_df(em$grupos_distritos)
  expect_true(all(c("estrato", "etiqueta", "n_forzosos", "n_candidatos", "h", "rutas_grupo", "regla") %in% names(g)))
  expect_true(any(g$etiqueta == "Lima Norte"))
  off <- hojas_ruta_sample_size_preview(list(territorios = cfg$territorios, sample_size_mode = "external_total", n_objetivo = 225L * 8L, entrevistas_por_manzana = 8L,
                                             sample_size = list(design_effect = 1, estrato = "provincia_lima_areas", base_reparto = "cpv2017")))
  expect_null(off$estrato_muestral$grupos_distritos)
})
