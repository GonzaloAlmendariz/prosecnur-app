# Estrato explícito provincia (ADR 0131 §1, paso 2).

.es_ubigeos <- c("150110", "150101", "150132", "070106", "070101", "040101", "040104")

.es_cfg <- function(estrato = NULL, n = 240, base = NULL, ...) {
  ss <- list(design_effect = 1)
  if (!is.null(estrato)) ss$estrato <- estrato
  if (!is.null(base)) ss$base_reparto <- base
  c(list(territorios = .es_ubigeos, sample_size_mode = "external_total", n_objetivo = n, sample_size = ss), list(...))
}

.es_norm <- function(...) hojas_ruta_integrada_normalize_config(.es_cfg(...))

test_that("estrato se normaliza a distrito por defecto", {
  expect_identical(hojas_ruta_estrato_normalizar(NULL)$estrato, "distrito")
  expect_identical(hojas_ruta_estrato_normalizar(list(estrato = "region"))$estrato, "distrito")
  expect_identical(.es_norm("provincia")$sample_size$estrato, "provincia")
  expect_false(hojas_ruta_estrato_activo(.es_norm()$sample_size))
})

test_that("las cinco áreas de Lima cubren sus 43 distritos una sola vez; Callao queda aparte", {
  todos <- unlist(HOJAS_RUTA_LIMA_AREAS, use.names = FALSE)
  expect_identical(length(todos), 43L)
  expect_false(anyDuplicated(todos) > 0)
  expect_setequal(todos, sprintf("1501%02d", 1:43))
  h <- hojas_ruta_estrato_de(c("150110", "150101", "070106", "040101"), "provincia_lima_areas")
  expect_identical(h, c("1501-lima_norte", "1501-lima_centro", "0701", "0401"))
  expect_identical(hojas_ruta_estrato_de(c("150110", "070106"), "provincia"), c("1501", "0701"))
})

test_that("Σ n_h = rutas, toda ciudad visitada con el mínimo (§1b) y Σ_d n_d = n_h en cada estrato", {
  for (modo in c("provincia", "provincia_lima_areas")) {
    for (base in c("cpv2017", "cpv2025_adultos_urbanos")) {
      cfg <- .es_norm(modo, base = base)
      a <- hojas_ruta_estrato_asignacion(.es_ubigeos, 40L, cfg)
      expect_identical(sum(a$estratos$rutas), 40L)
      expect_true(all(a$ciudades$rutas[a$ciudades$rutas > 0] >= a$rutas_minimas_ciudad))
      por_h <- tapply(a$distritos$rutas, a$distritos$estrato, sum)
      expect_equal(as.integer(por_h[a$estratos$estrato]), a$estratos$rutas)
      # Cada distrito recibe ⌊e_d⌋ o ⌈e_d⌉.
      expect_true(all(a$distritos$rutas >= floor(a$distritos$esperado + 1e-9) &
                      a$distritos$rutas <= ceiling(a$distritos$esperado - 1e-9)))
      expect_equal(tapply(a$distritos$esperado, a$distritos$estrato, sum)[a$estratos$estrato], a$estratos$rutas,
                   ignore_attr = TRUE)
    }
  }
})

test_that("la π del modo estrato suma n_h y ninguna manzana con medida > 0 queda en 0", {
  cfg <- .es_norm("provincia", base = "cpv2025_adultos_urbanos")
  a <- hojas_ruta_estrato_asignacion(.es_ubigeos, 40L, cfg)
  frame <- hojas_ruta_inei_frame(cfg$frame_source)
  suma <- setNames(numeric(nrow(a$estratos)), a$estratos$estrato)
  for (i in seq_len(nrow(a$distritos))) {
    d <- a$distritos[i, ]
    df <- frame[frame$ubigeo == d$ubigeo, , drop = FALSE]
    m <- .hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df))
    pi <- hojas_ruta_estrato_pi(m, d$esperado)
    expect_true(all(pi[m > 0] > 0), info = d$ubigeo)
    expect_true(all(pi <= 1 + 1e-9))
    suma[[d$estrato]] <- suma[[d$estrato]] + sum(pi)
  }
  expect_equal(as.numeric(suma), as.numeric(a$estratos$rutas), tolerance = 1e-8)
})

test_that("Monte Carlo: la frecuencia de inclusión cuadra con π", {
  set.seed(1)
  df <- data.frame(ubigeo = rep(c("A", "B", "C"), c(6, 4, 8)), zona = "01",
                   manzana = sprintf("%03d", 1:18), viviendas = c(round(stats::runif(17, 5, 120)), 400))
  df$id_manzana <- paste0(df$ubigeo, df$manzana)
  cfg <- list(sampling_method = "pps", measure_var = "viviendas")
  n_h <- 5L
  mos <- tapply(df$viviendas, df$ubigeo, sum)[c("A", "B", "C")]
  esperado <- n_h * mos / sum(mos)
  pi <- unlist(lapply(names(mos), function(u) hojas_ruta_estrato_pi(df$viviendas[df$ubigeo == u], esperado[[u]])))
  expect_equal(sum(pi), n_h)
  R <- 6000L
  cuenta <- numeric(nrow(df))
  for (r in seq_len(R)) {
    rutas <- .hojas_ruta_cuota_zona_rutas(mos, n_h, 1000L + r, "estrato-mc")
    for (j in seq_along(mos)) {
      if (rutas[[j]] <= 0L) next
      idx <- which(df$ubigeo == names(mos)[[j]])
      s <- .hojas_ruta_sorteo_pps_sistematico(df[idx, ], rutas[[j]], cfg)
      cuenta[idx[s$idx]] <- cuenta[idx[s$idx]] + 1
    }
  }
  frec <- cuenta / R
  se <- sqrt(pmax(pi * (1 - pi), 1e-6) / R)
  expect_true(all(abs(frec - pi) < 4.5 * se + 1e-3), info = paste(round(frec - pi, 4), collapse = " "))
})

test_that("con estrato provincia: vista previa = cuota por distrito, Σ cuotas = n y la muestra sale entera", {
  cfg <- .es_cfg("provincia", base = "cpv2025_adultos_urbanos")
  size <- hojas_ruta_sample_size_preview(cfg)
  quota <- hojas_ruta_quota_preview_integrado(cfg)
  expect_true(quota$ok)
  cells <- .hojas_ruta_rows_df(quota$cells)
  cuota <- tapply(cells$cuota, cells$ubigeo, sum)
  rows <- .hojas_ruta_rows_df(size$district_rows)
  prev <- stats::setNames(rows$n_used, rows$ubigeo)
  expect_identical(as.integer(prev[names(cuota)]), as.integer(cuota))
  expect_identical(as.integer(sum(cuota)), 240L)
  expect_identical(size$estrato_muestral$modo, "provincia")
  expect_identical(sum(vapply(size$estrato_muestral$estratos, function(e) as.integer(e$rutas), integer(1))), 40L)
  s <- hojas_ruta_sample_preview_integrado(cfg)
  expect_true(s$ok)
  expect_identical(as.integer(s$total_entrevistas), 240L)
})

test_that("errores declarados del modo estrato", {
  err <- tryCatch(hojas_ruta_estrato_asignacion(.es_ubigeos, 5L, .es_norm("provincia")), api_error = function(e) e)
  expect_identical(err$code, "E_HOJAS_RUTA_CIUDAD_SIN_RUTAS")  # §1b: 3 ciudades × 6 rutas no caben en 5
  err <- tryCatch(hojas_ruta_estrato_asignacion(.es_ubigeos, 40L, .es_norm("provincia", row_var = "zona")), api_error = function(e) e)
  expect_identical(err$code, "E_HOJAS_RUTA_ESTRATO_CUOTA_ZONA")
})

test_that("con estrato distrito la salida es la de siempre", {
  expect_null(hojas_ruta_estrato_asignacion(.es_ubigeos, 40L, .es_norm()))
  a <- .es_cfg("distrito"); b <- .es_cfg()
  expect_identical(hojas_ruta_sample_size_preview(a), hojas_ruta_sample_size_preview(b))
  expect_identical(hojas_ruta_quota_preview_integrado(a), hojas_ruta_quota_preview_integrado(b))
  expect_null(hojas_ruta_sample_size_preview(a)$estrato_muestral)
})

test_that("el reparto dentro del estrato usa la medida del marco elegible, la misma del sorteo", {
  # Con mínimo de 60 viviendas el Callao cambia mucho: 070106 pasaba de 4,7 a 0,8 rutas
  # esperadas entre lo que el reparto creía y lo que el sorteo veía (sonda del verificador).
  me <- list(declarado = TRUE, minimo_viviendas = 60L, areas_excluidas = list())
  cfg <- .es_norm("provincia", marco_elegible = me)
  a <- hojas_ruta_estrato_asignacion(.es_ubigeos, 40L, cfg)
  frame <- .hojas_ruta_filter_frame(cfg)
  mos_eleg <- vapply(a$distritos$ubigeo, function(u) {
    df <- frame[as.character(frame$ubigeo) == u, , drop = FALSE]
    if (!nrow(df)) return(0)
    sum(.hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df)))
  }, numeric(1))
  expect_equal(unname(a$distritos$mos), unname(mos_eleg))
  n_h <- stats::setNames(a$estratos$rutas, a$estratos$estrato)[a$distritos$estrato]
  mos_h <- stats::ave(mos_eleg, a$distritos$estrato, FUN = sum)
  expect_equal(unname(a$distritos$esperado), unname(n_h * mos_eleg / mos_h), tolerance = 1e-10)
  # Contra el marco completo la esperanza de 070106 sí cambia: el caso existe en el registro.
  completo <- hojas_ruta_estrato_asignacion(.es_ubigeos, 40L, .es_norm("provincia"))
  e_eleg <- a$distritos$esperado[a$distritos$ubigeo == "070106"]
  e_comp <- completo$distritos$esperado[completo$distritos$ubigeo == "070106"]
  expect_gt(abs(e_eleg - e_comp), 0.05)
  # Σπ sobre el marco del sorteo = n_h en cada estrato (ya no sólo sin exclusiones).
  suma <- tapply(seq_len(nrow(a$distritos)), a$distritos$estrato, function(ix) {
    sum(vapply(ix, function(k) {
      u <- a$distritos$ubigeo[[k]]
      df <- frame[as.character(frame$ubigeo) == u, , drop = FALSE]
      if (!nrow(df)) return(0)
      sum(hojas_ruta_estrato_pi(.hojas_ruta_sorteo_medida(df, .hojas_ruta_sorteo_cfg_distrito(cfg, df)), a$distritos$esperado[[k]]))
    }, numeric(1)))
  })
  expect_equal(as.numeric(suma[a$estratos$estrato]), as.numeric(a$estratos$rutas), tolerance = 1e-8)
})

test_that("en estrato provincia el reemplazo por defecto es el pareado de la misma zona y hereda π", {
  expect_identical(.es_norm("provincia")$replacement_policy, "paired_by_titular_zone")
  expect_identical(.es_norm("provincia_lima_areas")$replacement_policy, "paired_by_titular_zone")
  # El modo distrito conserva su defecto (estudios existentes).
  expect_identical(.es_norm()$replacement_policy, "alternate_zone_same_district")
  # «Otra zona» sigue disponible si se pide explícitamente.
  expect_identical(.es_norm("provincia", replacement_policy = "alternate_zone_same_district")$replacement_policy,
                   "alternate_zone_same_district")
  s <- hojas_ruta_sample_preview_integrado(.es_cfg("provincia", replacements_per_titular = 1L))
  expect_true(s$ok)
  r <- .hojas_ruta_rows_df(s$replacement_blocks)
  expect_gt(nrow(r), 0L)
  expect_true(all(r$pi_fuente == "hereda_titular"))
  expect_false(any(vapply(s$alerts, function(a) identical(a$code, "W_REPLACEMENT_PI_OTRA_ZONA"), logical(1))))
})

test_that("la memoria de cálculo declara el estrato, el mínimo por ciudad y las ciudades forzosas (§1b)", {
  sp <- hojas_ruta_sample_size_preview(.es_cfg("provincia_lima_areas"))
  expect_true(all(nzchar(vapply(sp$estrato_muestral$estratos, function(e) e$etiqueta, character(1)))))
  d <- reporte_mt_diseno_modelo(sp$config, sp)
  frase <- grep("estrato", d$nota_tecnica, value = TRUE)
  expect_length(frase, 1L)
  expect_match(frase, "cinco áreas interdistritales")
  expect_match(frase, "al menos 6 rutas")
  expect_match(frase, "marco elegible")
  expect_match(frase, "Lima \\d+")
  expect_match(frase, "Callao \\d+")
  d0 <- reporte_mt_diseno_modelo(sp$config, hojas_ruta_sample_size_preview(.es_cfg()))
  expect_length(grep("estrato", d0$nota_tecnica), 0L)
})

test_that("con N por distrito el estrato no rige: el sorteo y la π son los del distrito", {
  cfg <- .es_cfg("provincia")
  cfg$sample_size_mode <- "external_district"
  cfg$n_por_distrito <- stats::setNames(as.list(rep(24L, length(.es_ubigeos))), .es_ubigeos)
  expect_false(hojas_ruta_estrato_vigente(hojas_ruta_integrada_normalize_config(cfg)))
  s <- hojas_ruta_sample_preview_integrado(cfg)
  expect_true(s$ok)
  b <- .hojas_ruta_rows_df(s$blocks)
  expect_true(all(b$pi_regla == "pps_sistematico_distrito"))
  expect_identical(as.character(b$estrato), as.character(b$ubigeo))
})
