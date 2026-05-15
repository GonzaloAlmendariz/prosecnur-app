test_that("hojas_ruta_detectar_campos valida columnas canonicas", {
  df <- data.frame(
    UMP = 1,
    IDMANZANA = "15011005900015A",
    ESTRATO = "Lima Norte",
    VIVIENDAS = 30,
    NSE = "B",
    ESQUINA = 1,
    RECORRIDO = 2,
    ARRANQUE = 3,
    CONSTANTE = 4,
    IE = 1,
    FE = 6,
    sexo = "H",
    edad = "18-29",
    stringsAsFactors = FALSE
  )
  out <- hojas_ruta_detectar_campos(df)
  expect_true(out$ok)
  expect_equal(out$missing, list())

  df$IDMANZANA <- "150"
  out_bad <- hojas_ruta_detectar_campos(df)
  expect_false(out_bad$ok)
  expect_equal(out_bad$invalid[[1]]$campo, "IDMANZANA")
})

test_that("hojas_ruta_preview arma codigos de mapa y cuotas", {
  df <- data.frame(
    UMP = c(1, 2),
    IDMANZANA = c("15011005900015A", "15013500200026"),
    ESTRATO = "Lima",
    VIVIENDAS = c(30, 28),
    NSE = "B",
    ESQUINA = 1,
    RECORRIDO = 2,
    ARRANQUE = 3,
    CONSTANTE = 4,
    IE = c(1, 7),
    FE = c(6, 12),
    sexo = c("H", "M"),
    edad = c("18-29", "30-44"),
    stringsAsFactors = FALSE
  )
  out <- hojas_ruta_preview(df, list(row_var = "sexo", col_var = "edad", cartografia_dir = tempdir()))
  expect_true(out$ok)
  expect_equal(out$n_umps, 2L)
  expect_equal(out$rows[[1]]$mapa, "15011005900")
  expect_equal(out$rows[[1]]$cuota$TOTAL[1], 1)
})

test_that("hojas_ruta_generar_zip produce PDFs y resumen", {
  tmp <- tempfile("mapas_")
  dir.create(tmp)
  img <- array(1, dim = c(12, 12, 3))
  png::writePNG(img, file.path(tmp, "15011005900.png"))

  df <- data.frame(
    UMP = c(1, 2),
    IDMANZANA = c("15011005900015A", "15013500200026"),
    ESTRATO = "Lima",
    VIVIENDAS = c(30, 28),
    NSE = "B",
    ESQUINA = 1,
    RECORRIDO = 2,
    ARRANQUE = 3,
    CONSTANTE = 4,
    IE = c(1, 7),
    FE = c(6, 12),
    sexo = c("H", "M"),
    edad = c("18-29", "30-44"),
    stringsAsFactors = FALSE
  )
  out_zip <- tempfile(fileext = ".zip")
  res <- hojas_ruta_generar_zip(
    df,
    list(row_var = "sexo", col_var = "edad", cartografia_dir = tmp),
    out_zip
  )
  expect_true(file.exists(out_zip))
  expect_equal(res$n_pdfs, 2L)
  expect_equal(res$mapas_faltantes, 1L)
  entries <- zip::zip_list(out_zip)$filename
  expect_true("resumen_generacion.xlsx" %in% entries)
  expect_true(any(grepl("[.]pdf$", entries)))
})

test_that("hojas_ruta_inei_frame carga marco completo versionado", {
  frame <- hojas_ruta_inei_frame()
  expect_true(nrow(frame) > 0)
  expect_true(all(c("ubigeo", "distrito", "id_manzana", "viviendas", "poblacion") %in% names(frame)))
  meta <- .hojas_ruta_frame_meta(frame)
  expect_true(meta$ok)
  expect_equal(meta$year, 2017L)
  expect_false(meta$pilot)
  expect_equal(meta$n_distritos, 50L)
  expect_true(meta$n_manzanas > 100000L)
  expect_true(all(c("150103", "150143", "070106") %in% unique(frame$ubigeo)))
})

test_that("frame oficial INEI 2017 queda disponible sin reemplazar default", {
  current <- hojas_ruta_inei_frame()
  official <- hojas_ruta_inei_frame("inei2017_official")
  expect_equal(nrow(official), 118408L)
  expect_equal(length(unique(official$ubigeo)), 50L)
  expect_true(all(c("id_manzana", "id_manzana_norm", "cartografia_id") %in% names(official)))
  expect_equal(length(unique(official$id_manzana_norm)), nrow(official))

  cfg_default <- hojas_ruta_integrada_normalize_config(list(territorios = "150122"))
  cfg_official <- hojas_ruta_integrada_normalize_config(list(
    frame_source = "inei2017_official",
    territorios = "150122"
  ))
  expect_equal(cfg_default$frame_source, "current")
  expect_equal(cfg_official$frame_source, "inei2017_official")

  meta <- .hojas_ruta_frame_meta(current, cfg_default$frame_source)
  expect_equal(meta$active_source, "current")
  expect_true(meta$official$available)
  expect_equal(meta$official$n_manzanas, 118408L)
  expect_true(meta$audit$available)
})

test_that("NSE Lima INEI y zonas censales oficiales reportan cobertura", {
  nse <- hojas_ruta_nse_inei(required = TRUE)
  expect_true(nrow(nse) > 90000L)
  expect_setequal(
    sort(unique(nse$nse_nivel)),
    c("ALTO", "BAJO", "MEDIO", "MEDIO ALTO", "MEDIO BAJO")
  )
  expect_false(any(grepl("^0701", nse$ubigeo)))
  nse_meta <- .hojas_ruta_nse_meta(nse)
  expect_true(nse_meta$available)
  expect_gte(nse_meta$coverage_rate, 0.98)
  expect_gte(nse_meta$matched_blocks, 90000L)

  zones <- hojas_ruta_cartografia_zonas_meta()
  expect_true(zones$available)
  expect_equal(zones$districts, 50L)
  expect_equal(zones$zones, 1721L)

  audit <- hojas_ruta_frame_audit_meta()
  expect_true(audit$available)
  expect_true(audit$rows > 100000L)
  expect_true(length(audit$status_counts) > 0L)
})

test_that("hojas_ruta_inei_age_simple carga edad simple oficial REDATAM", {
  age <- hojas_ruta_inei_age_simple(required = TRUE)
  expect_true(nrow(age) > 0)
  expect_true(all(c("ubigeo", "edad", "sexo", "poblacion") %in% names(age)))
  expect_true(all(c("Hombre", "Mujer") %in% unique(age$sexo)))
  expect_true(min(age$edad, na.rm = TRUE) == 0L)
  expect_true(max(age$edad, na.rm = TRUE) >= 100L)
  expect_equal(length(unique(age$ubigeo)), 50L)
  expect_true(all(c("150110", "150143", "070106") %in% unique(age$ubigeo)))
})

test_that("hojas_ruta_quota_preview_integrado asigna N objetivo por cuotas", {
  out <- hojas_ruta_quota_preview_integrado(list(
    n_objetivo = 60,
    territorios = c("150110", "070106")
  ))
  expect_true(out$ok)
  expect_equal(out$n_objetivo, 60L)
  expect_equal(out$total_asignado, 60L)
  cells <- .hojas_ruta_rows_df(out$cells)
  expect_equal(sum(cells$cuota), 60)
  expect_true(all(c("territorio", "rango_edad", "sexo", "cuota") %in% names(cells)))
  expect_true(any(vapply(out$alerts, function(x) identical(x$code, "I_AGE_SIMPLE_OFFICIAL"), logical(1))))
})

test_that("hojas_ruta_population_preview_integrado calcula matriz sin N", {
  out <- hojas_ruta_population_preview_integrado(list(
    territorios = c("150110", "070106"),
    age_ranges = list(
      list(id = "18_29", label = "18-29", min = 18, max = 29),
      list(id = "30_plus", label = "30+", min = 30, max = NA)
    )
  ))
  expect_true(out$ok)
  expect_true(out$total_poblacion > 0L)
  cells <- .hojas_ruta_rows_df(out$cells)
  expect_true(all(c("territorio", "rango_edad", "sexo", "poblacion") %in% names(cells)))
  expect_false("cuota" %in% names(cells))
  expect_setequal(unique(cells$rango_edad), c("18-29", "30+"))
})

test_that("hojas_ruta_exportar_matriz_poblacional produce Excel trazable", {
  skip_if_not_installed("openxlsx")
  out_xlsx <- tempfile(fileext = ".xlsx")
  res <- hojas_ruta_exportar_matriz_poblacional(
    list(territorios = c("150110", "070106")),
    out_xlsx
  )
  expect_true(file.exists(out_xlsx))
  expect_true(res$total_poblacion > 0L)
  sheets <- openxlsx::getSheetNames(out_xlsx)
  expect_setequal(sheets, c("Matriz_poblacional", "Matriz_proporcional", "Detalle_largo", "Parametros", "Fuente"))
  detalle <- openxlsx::read.xlsx(out_xlsx, sheet = "Detalle_largo")
  matriz <- openxlsx::read.xlsx(out_xlsx, sheet = "Matriz_poblacional")
  proporcional <- openxlsx::read.xlsx(out_xlsx, sheet = "Matriz_proporcional")
  total_col <- names(matriz)[tolower(gsub("[^a-zA-Z]+", "_", names(matriz))) == "poblacion_total"]
  expect_equal(round(sum(detalle$poblacion, na.rm = TRUE)), round(max(matriz[matriz$Territorio == "TOTAL", total_col], na.rm = TRUE)))
  prop_col <- names(proporcional)[tolower(gsub("[^a-zA-Z]+", "_", names(proporcional))) == "proporcion_del_marco"]
  expect_equal(sum(proporcional[proporcional$Territorio != "TOTAL", prop_col], na.rm = TRUE), 1, tolerance = 1e-8)
  expect_equal(max(proporcional[proporcional$Territorio == "TOTAL", prop_col], na.rm = TRUE), 1, tolerance = 1e-8)
  expect_true(all(c("proporcion_en_distrito", "proporcion_en_marco") %in% names(detalle)))
  expect_equal(sum(detalle$proporcion_en_marco, na.rm = TRUE), 1, tolerance = 1e-8)
})

test_that("configuracion integrada inicia sin distritos confirmados", {
  cfg <- hojas_ruta_integrada_normalize_config(list())
  expect_equal(cfg$territorios, list())

  out <- hojas_ruta_quota_preview_integrado(list(n_objetivo = 60))
  expect_false(out$ok)
  expect_equal(out$total_asignado, 0L)
  expect_true(any(vapply(out$alerts, function(x) identical(x$code, "E_NO_TERRITORY"), logical(1))))
})

test_that("hojas_ruta_quota_preview_integrado acepta N por distrito", {
  out <- hojas_ruta_quota_preview_integrado(list(
    n_mode = "por_distrito",
    territorios = c("150110", "070106"),
    n_por_distrito = list("150110" = 18, "070106" = 24)
  ))
  expect_true(out$ok)
  expect_equal(out$config$n_mode, "por_distrito")
  expect_equal(out$n_objetivo, 42L)
  expect_equal(out$total_asignado, 42L)
  cells <- .hojas_ruta_rows_df(out$cells)
  expect_equal(sum(cells$cuota[cells$ubigeo == "150110"]), 18)
  expect_equal(sum(cells$cuota[cells$ubigeo == "070106"]), 24)
})

test_that("hojas_ruta_quota_preview_integrado exige N multiplo de ruta", {
  total <- hojas_ruta_quota_preview_integrado(list(
    n_objetivo = 61,
    territorios = c("150110"),
    entrevistas_por_manzana = 6
  ))
  expect_false(total$ok)
  expect_equal(total$total_asignado, 0L)
  expect_true(any(vapply(total$alerts, function(x) identical(x$code, "E_ROUTE_N_NOT_MULTIPLE"), logical(1))))

  district <- hojas_ruta_quota_preview_integrado(list(
    n_mode = "por_distrito",
    territorios = c("150110", "070106"),
    n_por_distrito = list("150110" = 18, "070106" = 23),
    entrevistas_por_manzana = 6
  ))
  expect_false(district$ok)
  expect_true(any(vapply(district$alerts, function(x) identical(x$code, "E_ROUTE_N_NOT_MULTIPLE"), logical(1))))
})

test_that("hojas_ruta_sample_size_preview calcula N por precision sin FPC", {
  out <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    sample_size = list(
      confidence_level = 0.95,
      margin_total = 0.05,
      expected_proportion = 0.5,
      design_effect = 1,
      response_rate = 0.9,
      apply_fpc = FALSE
    )
  ))
  expect_true(out$ok)
  expect_equal(out$n_recommended, 390L)
  expect_equal(out$n_recommended %% out$route_size, 0L)
  expect_equal(out$n_used, out$n_recommended_route)
  expect_equal(out$config$n_objetivo, out$n_recommended_route)
  expect_equal(out$contacts_suggested, ceiling(out$n_used / 0.9))
})

test_that("hojas_ruta_sample_size_preview aplica FPC y efecto de diseno", {
  no_fpc <- hojas_ruta_sample_size_preview(list(
    territorios = "070106",
    sample_size = list(margin_total = 0.05, expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE)
  ))
  with_fpc <- hojas_ruta_sample_size_preview(list(
    territorios = "070106",
    sample_size = list(margin_total = 0.05, expected_proportion = 0.5, design_effect = 1, apply_fpc = TRUE)
  ))
  deff <- hojas_ruta_sample_size_preview(list(
    territorios = "070106",
    sample_size = list(margin_total = 0.05, expected_proportion = 0.5, design_effect = 2, apply_fpc = FALSE)
  ))
  expect_lte(with_fpc$n_recommended, no_fpc$n_recommended)
  expect_equal(deff$n_recommended, ceiling(no_fpc$n_recommended * 2), tolerance = 1)
})

test_that("hojas_ruta_sample_size_preview aplica Deff antes de FPC", {
  no_fpc <- hojas_ruta_sample_size_preview(list(
    territorios = "070106",
    sample_size = list(margin_total = 0.05, expected_proportion = 0.5, design_effect = 2, apply_fpc = FALSE)
  ))
  with_fpc <- hojas_ruta_sample_size_preview(list(
    territorios = "070106",
    sample_size = list(margin_total = 0.05, expected_proportion = 0.5, design_effect = 2, apply_fpc = TRUE)
  ))
  expect_lte(with_fpc$n_recommended, no_fpc$n_recommended)
  expect_gt(with_fpc$n_recommended, 0L)
})

test_that("hojas_ruta_sample_size_preview respeta N externo total y por distrito", {
  total <- hojas_ruta_sample_size_preview(list(
    sample_size_mode = "external_total",
    territorios = c("150110", "070106"),
    n_objetivo = 222
  ))
  expect_equal(total$config$n_mode, "total")
  expect_equal(total$n_used, 222L)

  district <- hojas_ruta_sample_size_preview(list(
    sample_size_mode = "external_district",
    territorios = c("150110", "070106"),
    n_por_distrito = list("150110" = 18, "070106" = 24)
  ))
  expect_equal(district$config$n_mode, "por_distrito")
  expect_equal(district$n_used, 42L)
  rows <- .hojas_ruta_rows_df(district$district_rows)
  expect_equal(rows$n_used[rows$ubigeo == "150110"], 18)
  expect_equal(rows$n_used[rows$ubigeo == "070106"], 24)
})

test_that("hojas_ruta_sample_size_preview aplica bi-objetivo cuando la garantia distrital manda", {
  # Escenario: muchos distritos con margin_district exigente fuerza n_district_floor > n_total_min
  out <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    sample_size = list(
      confidence_level = 0.95,
      margin_total = 0.10,
      margin_district = 0.05,
      expected_proportion = 0.5,
      design_effect = 1,
      apply_fpc = FALSE,
      enforce_district_floor = TRUE
    )
  ))
  expect_true(out$ok)
  expect_equal(out$n_total_min, 102L)
  expect_equal(out$n_total_min %% out$route_size, 0L)
  expect_gte(out$n_district_floor, 2L * out$n_total_min - 5L)
  expect_equal(out$n_recommended, max(out$n_total_min, out$n_district_floor))
  rows <- .hojas_ruta_rows_df(out$district_rows)
  expect_true(all(rows$n_min_district > 0))
})

test_that("hojas_ruta_sample_size_preview puede desactivar garantia distrital", {
  with_floor <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    sample_size = list(
      margin_total = 0.10, margin_district = 0.05,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE,
      enforce_district_floor = TRUE
    )
  ))
  no_floor <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    sample_size = list(
      margin_total = 0.10, margin_district = 0.05,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE,
      enforce_district_floor = FALSE
    )
  ))
  expect_equal(no_floor$n_recommended, no_floor$n_total_min)
  expect_gte(with_floor$n_recommended, no_floor$n_recommended)
})

test_that("hojas_ruta_sample_size_preview respeta DEFF override por distrito", {
  base <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    sample_size = list(
      margin_total = 0.05, margin_district = 0.10,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE
    )
  ))
  override <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    sample_size = list(
      margin_total = 0.05, margin_district = 0.10,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE,
      design_effect_overrides = list("150110" = 2.5)
    )
  ))
  base_rows <- .hojas_ruta_rows_df(base$district_rows)
  ovr_rows <- .hojas_ruta_rows_df(override$district_rows)
  expect_equal(base_rows$design_effect[base_rows$ubigeo == "150110"], 1)
  expect_equal(ovr_rows$design_effect[ovr_rows$ubigeo == "150110"], 2.5)
  expect_gt(
    ovr_rows$n_min_district[ovr_rows$ubigeo == "150110"],
    base_rows$n_min_district[base_rows$ubigeo == "150110"]
  )
  expect_equal(ovr_rows$design_effect[ovr_rows$ubigeo == "070106"], 1)
})

test_that("allocation_mode uniforme reparte n por igual entre distritos", {
  out <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    n_objetivo = 102,
    sample_size_mode = "external_total",
    sample_size = list(
      margin_total = 0.05, margin_district = 0.10,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE,
      allocation_mode = "uniform",
      enforce_district_floor = FALSE
    )
  ))
  rows <- .hojas_ruta_rows_df(out$district_rows)
  expect_equal(sum(rows$n_used), 102L)
  expect_true(all(rows$n_used %% 6L == 0L))
  expect_lte(max(rows$n_used) - min(rows$n_used), 6L)
})

test_that("cuotas respetan allocation_mode uniforme entre distritos", {
  distritos <- c("150110", "150115", "150133", "150135", "150136", "150142")
  out <- hojas_ruta_quota_preview_integrado(list(
    territorios = distritos,
    n_objetivo = 30,
    entrevistas_por_manzana = 5,
    max_per_manzana = 5,
    sample_size_mode = "external_total",
    sample_size = list(
      allocation_mode = "uniform",
      enforce_district_floor = FALSE
    )
  ))
  expect_true(out$ok)
  expect_equal(out$total_asignado, 30L)
  cells <- .hojas_ruta_rows_df(out$cells)
  by_district <- stats::aggregate(
    cells$cuota,
    by = list(ubigeo = cells$ubigeo),
    FUN = sum
  )
  got <- stats::setNames(as.integer(by_district$x), by_district$ubigeo)
  expect_equal(unname(got[distritos]), rep(5L, length(distritos)))
})

test_that("allocation_mode compromise da más a chicos que proporcional", {
  prop <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    n_objetivo = 204,
    sample_size_mode = "external_total",
    sample_size = list(
      margin_total = 0.05, margin_district = 0.10,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE,
      allocation_mode = "proportional",
      enforce_district_floor = FALSE
    )
  ))
  comp <- hojas_ruta_sample_size_preview(list(
    territorios = c("150110", "070106"),
    n_objetivo = 204,
    sample_size_mode = "external_total",
    sample_size = list(
      margin_total = 0.05, margin_district = 0.10,
      expected_proportion = 0.5, design_effect = 1, apply_fpc = FALSE,
      allocation_mode = "compromise",
      enforce_district_floor = FALSE
    )
  ))
  prop_rows <- .hojas_ruta_rows_df(prop$district_rows)
  comp_rows <- .hojas_ruta_rows_df(comp$district_rows)
  expect_equal(sum(prop_rows$n_used), 204L)
  expect_equal(sum(comp_rows$n_used), 204L)
  expect_true(all(prop_rows$n_used %% 6L == 0L))
  expect_true(all(comp_rows$n_used %% 6L == 0L))
  pop <- prop_rows$poblacion
  small_idx <- which.min(pop)
  prop_small <- prop_rows$n_used[small_idx]
  comp_small <- comp_rows$n_used[small_idx]
  expect_gte(comp_small, prop_small)
})

test_that("hojas_ruta_quota_preview_integrado respeta rangos de edad editables", {
  out <- hojas_ruta_quota_preview_integrado(list(
    n_objetivo = 42,
    territorios = c("150110", "070106"),
    age_ranges = list(
      list(id = "18_29", label = "18-29", min = 18, max = 29),
      list(id = "30_44", label = "30-44", min = 30, max = 44),
      list(id = "45_plus", label = "45+", min = 45, max = NA)
    )
  ))
  expect_true(out$ok)
  expect_equal(out$total_asignado, 42L)
  cells <- .hojas_ruta_rows_df(out$cells)
  expect_setequal(unique(cells$rango_edad), c("18-29", "30-44", "45+"))
  expect_equal(sum(cells$cuota), 42)
})

test_that("hojas_ruta_quota_preview_integrado usa edad simple C5P41 cuando esta disponible", {
  out <- hojas_ruta_quota_preview_integrado(list(
    n_objetivo = 42,
    territorios = c("150110"),
    age_ranges = list(
      list(id = "18_29", label = "18-29", min = 18, max = 29)
    )
  ))
  expect_true(out$ok)
  expect_equal(out$age_source$type, "edad_simple_c5p41")
  cells <- .hojas_ruta_rows_df(out$cells)
  age <- hojas_ruta_inei_age_simple(required = TRUE)
  expected_h <- sum(age$poblacion[
    age$ubigeo == "150110" & age$sexo == "Hombre" & age$edad >= 18 & age$edad <= 29
  ], na.rm = TRUE)
  got_h <- cells$poblacion[cells$territorio == "COMAS" & cells$sexo == "Hombre"]
  expect_equal(as.numeric(got_h), as.numeric(expected_h))
})

test_that("hojas_ruta_integrada_normalize_config genera terciles poblacionales editables", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = c("150110", "070106"),
    age_range_mode = "terciles"
  ))
  expect_equal(cfg$age_range_mode, "terciles")
  expect_equal(cfg$age_range_scope, "selected")
  expect_equal(length(cfg$age_ranges), 3L)
  expect_equal(cfg$age_ranges[[1]]$min, 18L)
  expect_true(is.na(cfg$age_ranges[[3]]$max))
  expect_true(all(vapply(cfg$age_ranges, function(x) grepl("^[0-9]+(-[0-9]+|[+])$", x$label), logical(1))))
  frame_cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = c("150110", "070106"),
    age_range_mode = "terciles",
    age_range_scope = "frame"
  ))
  expect_equal(frame_cfg$age_range_scope, "frame")
  expect_equal(length(frame_cfg$age_ranges), 3L)
  decile_cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = c("150110", "070106"),
    age_range_mode = "deciles"
  ))
  expect_equal(decile_cfg$age_range_mode, "deciles")
  expect_equal(length(decile_cfg$age_ranges), 10L)
  expect_equal(decile_cfg$age_ranges[[1]]$min, 18L)
  expect_true(is.na(decile_cfg$age_ranges[[10]]$max))
})

test_that("hojas_ruta_quota_preview_integrado permite cuotas sin subcuota de sexo", {
  out <- hojas_ruta_quota_preview_integrado(list(
    n_objetivo = 30,
    territorios = c("150110"),
    subquota_var = "ninguna"
  ))
  expect_true(out$ok)
  expect_equal(out$config$subquota_var, "ninguna")
  cells <- .hojas_ruta_rows_df(out$cells)
  expect_setequal(unique(cells$sexo), "Total")
  expect_equal(sum(cells$cuota), 30)
})

test_that("hojas_ruta_quota_preview_integrado distribuye edad simple a zona", {
  out <- hojas_ruta_quota_preview_integrado(list(
    n_objetivo = 30,
    territorios = c("150110"),
    row_var = "zona",
    subquota_var = "ninguna"
  ))
  expect_true(out$ok)
  expect_equal(out$age_source$type, "edad_simple_c5p41_distribuida_zona")
  cells <- .hojas_ruta_rows_df(out$cells)
  expect_true(length(unique(cells$territorio)) > 1L)
  expect_equal(sum(cells$cuota), 30)
})

test_that("cartografia de manzanas declara Lima 2017 y Callao 2019 locales", {
  meta <- hojas_ruta_cartografia_manzanas_meta()
  expect_true(meta$ok)
  expect_equal(meta$year, 2017L)
  expect_equal(meta$years, c(2017L, 2019L))
  expect_match(meta$coverage, "Lima Metropolitana y Callao")
  expect_equal(meta$mode, "local_first_optional_online_cache")
  expect_equal(meta$packaged_districts, 50L)
  expect_true(meta$packaged_blocks > 100000L)

  lima <- hojas_ruta_block_map_preview("150101", limit = 0)
  expect_true(lima$ok)
  expect_true(lima$local_package)
  expect_equal(lima$source$year, 2017L)
  expect_equal(lima$returned, 1901L)
  miraflores <- hojas_ruta_block_map_preview("150122", limit = 0, refresh = TRUE)
  miraflores_props <- lapply(miraflores$geojson$features, function(x) x$properties)
  miraflores_block <- Filter(function(x) identical(x$inei_id_manzana, "150122002000370"), miraflores_props)[[1]]
  expect_equal(miraflores_block$inei_viviendas, 80)
  expect_equal(miraflores_block$inei_poblacion, 173)
  expect_equal(miraflores_block$inei_pob_hombres, 77)
  expect_equal(miraflores_block$inei_pob_mujeres, 96)

  callao <- hojas_ruta_block_map_preview("070106", limit = 0)
  expect_true(callao$ok)
  expect_true(callao$local_package)
  expect_equal(callao$source$year, 2019L)
  expect_equal(callao$returned, 5843L)
})

test_that("cartografia de manzanas no consulta internet por defecto", {
  out <- hojas_ruta_block_map_preview("150199", limit = 10, refresh = TRUE)
  expect_false(out$ok)
  expect_true(any(vapply(out$alerts, function(x) identical(x$code, "W_BLOCK_MAP_NOT_PACKAGED_LOCAL"), logical(1))))
})

test_that("cartografia de zonas se deriva de manzanas locales", {
  out <- hojas_ruta_zone_map_preview("150141")
  expect_true(out$ok)
  expect_true(out$returned > 0L)
  expect_true(all(vapply(out$geojson$features, function(x) {
    nzchar(as.character(x$properties$zona %||% ""))
  }, logical(1))))
  stats_pop <- sum(vapply(out$geojson$features, function(x) {
    as.numeric(x$properties$poblacion %||% 0)
  }, numeric(1)), na.rm = TRUE)
  frame_pop <- sum(hojas_ruta_inei_frame()$poblacion[hojas_ruta_inei_frame()$ubigeo == "150141"], na.rm = TRUE)
  expect_equal(stats_pop, frame_pop)
})

test_that("cartografia vial INEI 2017 se sirve localmente con respaldo OSM", {
  meta <- hojas_ruta_cartografia_calles_meta()
  expect_true(meta$ok)
  expect_match(meta$source, "INEI|Informacion Digital")
  expect_match(meta$attribution, "INEI")
  expect_equal(meta$mode, "local_only_inei_primary_osm_fallback")
  expect_equal(meta$primary, "inei2017")
  expect_equal(meta$packaged_districts, 50L)
  expect_true(meta$packaged_streets > 200000L)
  expect_true(meta$fallback_packaged_streets > 10000L)
  expect_true(isTRUE(meta$sources$osm_overture$ok))

  miraflores <- hojas_ruta_street_map_preview("150122")
  expect_true(miraflores$ok)
  expect_true(miraflores$count > 700L)
  expect_equal(miraflores$geojson$properties$street_source, "inei")
  expect_true(any(vapply(miraflores$geojson$features, function(x) {
    identical(x$properties$source, "inei2017")
  }, logical(1))))
  expect_true(any(vapply(miraflores$geojson$features, function(x) {
    identical(x$properties$class_group, "major")
  }, logical(1))))

  missing <- hojas_ruta_street_map_preview("150199")
  expect_false(missing$ok)
  expect_true(any(vapply(missing$alerts, function(x) identical(x$code, "W_STREET_MAP_NOT_PACKAGED_LOCAL"), logical(1))))
})

test_that("schema vial expone atributos enriquecidos (name_es, lanes, surface, source)", {
  miraflores <- hojas_ruta_street_map_preview("150122")
  skip_if(!miraflores$ok, "Capa vial Miraflores no disponible")
  feats <- miraflores$geojson$features
  skip_if(length(feats) == 0L, "Miraflores sin features")
  expected_keys <- c(
    "osm_id", "name", "highway", "class_group", "rank", "avenue_like",
    "display_name", "length_m",
    "name_es", "name_official", "name_alt", "name_ref",
    "lanes", "oneway", "surface", "maxspeed_kmh", "lit",
    "source", "overture_id"
  )
  props_first <- feats[[1]]$properties
  expect_true(all(expected_keys %in% names(props_first)),
              info = paste("Faltan keys:", paste(setdiff(expected_keys, names(props_first)), collapse = ", ")))
  # Defaults sanos: lanes es int, oneway es chr o NA, source viene siempre poblado
  expect_type(props_first$lanes, "integer")
  expect_true(is.character(props_first$source) && nzchar(props_first$source))
  expect_equal(props_first$source, "inei2017")
  # El respaldo OSM conserva su schema enriquecido v3.
  meta <- hojas_ruta_cartografia_calles_meta()
  if (!is.null(meta$sources$osm_overture$schema_version)) {
    expect_gte(as.integer(meta$sources$osm_overture$schema_version), 3L)
  }
})

test_that("rotulos viales densos se desduplican y evitan solapes", {
  make_street <- function(name, y, rank = 7L, major = FALSE, x0 = 0.05, x1 = 0.95) {
    list(
      name = name,
      rank = as.integer(rank),
      avenue_like = major,
      class_group = if (major) "major" else "detail",
      lines = list(matrix(c(x0, y, x1, y), ncol = 2, byrow = TRUE))
    )
  }
  streets <- c(
    lapply(seq(0.18, 0.82, length.out = 12), function(y) {
      make_street("AV. CENTRAL", y, rank = 4L, major = TRUE)
    }),
    lapply(seq(0.22, 0.78, length.out = 10), function(y) {
      make_street("CAL. LOS FRESNOS", y, rank = 7L, major = FALSE, x0 = 0.18, x1 = 0.82)
    }),
    lapply(seq_len(24), function(i) {
      x <- 0.08 + (i %% 8) * 0.105
      list(
        name = sprintf("CAL. %02d", i),
        rank = 7L,
        avenue_like = FALSE,
        class_group = "detail",
        lines = list(matrix(c(x, 0.12, x, 0.88), ncol = 2, byrow = TRUE))
      )
    })
  )
  project <- function(line) data.frame(x = line[, 1], y = line[, 2])
  pdf <- tempfile(fileext = ".pdf")
  grDevices::pdf(pdf, paper = "special", width = 8, height = 6)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::pushViewport(grid::viewport(width = 0.80, height = 0.80))
  on.exit(try(grid::popViewport(), silent = TRUE), add = TRUE)

  labels <- .hojas_ruta_pdf_street_label_candidates_map(streets, project, max_labels = 20L)
  expect_lte(length(labels), 20L)
  counts <- table(vapply(labels, `[[`, character(1), "name"))
  expect_lte(unname(counts[["AV. CENTRAL"]] %||% 0L), 3L)
  expect_lte(unname(counts[["CAL. LOS FRESNOS"]] %||% 0L), 2L)
  boxes <- lapply(labels, `[[`, "box")
  if (length(boxes) > 1L) {
    overlaps <- combn(seq_along(boxes), 2L, function(idx) {
      .hojas_ruta_pdf_label_boxes_overlap(boxes[[idx[[1]]]], boxes[[idx[[2]]]], margin = 0)
    })
    expect_false(any(overlaps))
  }
})

test_that("contexto urbano OSM esta empaquetado y se sirve localmente", {
  meta <- hojas_ruta_cartografia_contexto_meta()
  expect_true(meta$ok)
  expect_match(meta$source, "OpenStreetMap")
  expect_match(meta$source, "curaduria local")
  expect_match(meta$license, "ODbL|Open Database License")
  expect_equal(meta$mode, "local_only")
  expect_equal(meta$packaged_districts, 50L)
  expect_true(meta$packaged_features > 1000L)
  expect_true(all(c("green", "public", "landmark") %in% unlist(meta$included_classes)))

  miraflores <- hojas_ruta_context_map_preview("150122")
  expect_true(miraflores$ok)
  expect_true(miraflores$count > 50L)
  classes <- vapply(miraflores$geojson$features, function(x) {
    as.character(x$properties$feature_class %||% "")
  }, character(1))
  expect_true(any(classes %in% c("green", "public", "landmark", "transit")))
  expect_false(any(classes %in% c("commerce", "transit", "rail")))

  san_isidro <- hojas_ruta_context_map_preview("150131")
  san_isidro_names <- vapply(san_isidro$geojson$features, function(x) {
    as.character(x$properties$display_name %||% "")
  }, character(1))
  san_isidro_classes <- vapply(san_isidro$geojson$features, function(x) {
    as.character(x$properties$feature_class %||% "")
  }, character(1))
  san_isidro_sources <- vapply(san_isidro$geojson$features, function(x) {
    as.character(x$properties$source_kind %||% "osm")
  }, character(1))
  san_isidro_kinds <- vapply(san_isidro$geojson$features, function(x) {
    as.character(x$properties$kind %||% "")
  }, character(1))
  expect_true(any(san_isidro_names == "Lima Golf Club" & san_isidro_classes == "green"))
  expect_true(any(san_isidro_names == "Parque La Pera" & san_isidro_classes == "green" & san_isidro_sources == "curated"))
  expect_true(san_isidro$geojson$properties$curated_count >= 1L)
  expect_false(any(san_isidro_kinds %in% c("bank", "hotel", "school", "university", "college", "place_of_worship")))

  magdalena <- hojas_ruta_context_map_preview("150120")
  magdalena_names <- vapply(magdalena$geojson$features, function(x) {
    as.character(x$properties$display_name %||% "")
  }, character(1))
  expect_true(any(magdalena_names == "Parque La Pera"))

  missing <- hojas_ruta_context_map_preview("150199")
  expect_false(missing$ok)
  expect_true(any(vapply(missing$alerts, function(x) identical(x$code, "W_CONTEXT_MAP_NOT_PACKAGED_LOCAL"), logical(1))))
})

test_that("hojas_ruta_sample_preview_integrado es reproducible con semilla PPS", {
  cfg <- list(
    n_objetivo = 24,
    territorios = c("150110", "070106"),
    sampling_method = "pps",
    seed = 99,
    max_per_manzana = 8
  )
  a <- hojas_ruta_sample_preview_integrado(cfg)
  b <- hojas_ruta_sample_preview_integrado(cfg)
  expect_true(a$ok)
  expect_equal(a$total_entrevistas, 24L)
  expect_true(a$n_blocks > 0L)
  expect_equal(
    vapply(a$blocks, `[[`, character(1), "id_manzana"),
    vapply(b$blocks, `[[`, character(1), "id_manzana")
  )
})

test_that("hojas_ruta_sample_preview_integrado alerta marco insuficiente", {
  out <- hojas_ruta_sample_preview_integrado(list(
    n_objetivo = 1002,
    territorios = "150138",
    sampling_method = "pps",
    max_per_manzana = 4,
    seed = 7
  ))
  expect_false(out$ok)
  expect_true(any(vapply(out$alerts, function(x) identical(x$code, "E_UNASSIGNED_INTERVIEWS"), logical(1))))
})

test_that("hojas_ruta_sample_preview_integrado selecciona rutas completas dentro de zonas", {
  out <- hojas_ruta_sample_preview_integrado(list(
    n_objetivo = 60,
    territorios = c("150110", "070106"),
    sampling_method = "pps",
    entrevistas_por_manzana = 6,
    seed = 99
  ))
  expect_true(out$ok)
  expect_equal(out$total_entrevistas, 60L)
  blocks <- .hojas_ruta_rows_df(out$blocks)
  expect_true(all(blocks$entrevistas == 6L))
  expect_true(all(blocks$territorio_muestral == paste(blocks$ubigeo, blocks$zona, sep = "-")))
  expect_true(length(unique(paste(blocks$ubigeo, blocks$zona))) > length(unique(blocks$ubigeo)))
})

test_that("hojas_ruta_sample_preview_integrado selecciona reemplazos pareados por zona", {
  out <- hojas_ruta_sample_preview_integrado(list(
    n_objetivo = 24,
    territorios = c("150110", "070106"),
    sampling_method = "pps",
    entrevistas_por_manzana = 6,
    seed = 99,
    replacement_routes_per_district = list("150110" = 2, "070106" = 1)
  ))
  expect_true(out$ok)
  expect_equal(out$config$replacement_policy, "paired_by_titular_zone")
  expect_equal(out$config$replacements_per_titular, 1L)
  expect_equal(out$n_replacement_blocks, out$n_blocks)
  expect_equal(out$total_entrevistas, 24L)
  expect_equal(out$total_replacement_interviews, out$total_entrevistas)
  blocks <- .hojas_ruta_rows_df(out$blocks)
  replacements <- .hojas_ruta_rows_df(out$replacement_blocks)
  expect_true(all(replacements$tipo_manzana == "reemplazo"))
  expect_length(intersect(blocks$id_manzana, replacements$id_manzana), 0L)
  expect_true(all(c("titular_id_manzana", "titular_ubigeo", "titular_zona") %in% names(replacements)))
  paired <- merge(
    replacements,
    blocks[, c("id_manzana", "ubigeo", "zona"), drop = FALSE],
    by.x = "titular_id_manzana",
    by.y = "id_manzana",
    suffixes = c("_replacement", "_titular")
  )
  expect_equal(nrow(paired), nrow(replacements))
  expect_true(all(paired$ubigeo_replacement == paired$ubigeo_titular))
  expect_true(all(paired$zona_replacement == paired$zona_titular))
  expect_true(all(paired$titular_ubigeo == paired$ubigeo_titular))
  expect_true(all(paired$titular_zona == paired$zona_titular))
  expect_true(all(c(
    "esquina_inicio", "esquina_coordenada", "domicilio_inicio",
    "constante_salto", "constante_salto_modo"
  ) %in% names(blocks)))
})

test_that("hojas_ruta_sample_preview_integrado permite cero reemplazos", {
  out <- hojas_ruta_sample_preview_integrado(list(
    n_objetivo = 24,
    territorios = c("150110", "070106"),
    sampling_method = "pps",
    entrevistas_por_manzana = 6,
    seed = 99,
    replacements_per_titular = 0
  ))
  expect_true(out$ok)
  expect_equal(out$config$replacements_per_titular, 0L)
  expect_equal(out$n_replacement_blocks, 0L)
  expect_equal(out$total_replacement_interviews, 0L)
  expect_equal(length(out$replacement_blocks), 0L)
  expect_length(
    Filter(function(x) identical(x$code, "E_REPLACEMENT_PAIR_COUNT"), out$alerts),
    0L
  )
})

test_that("validacion integral rechaza reemplazos ausentes o fuera de zona", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    n_objetivo = 12,
    territorios = "150110",
    seed = 99
  ))
  blocks <- data.frame(
    id_manzana = c("A", "B"),
    ubigeo = c("150110", "150110"),
    zona = c("00100", "00200"),
    distrito = c("COMAS", "COMAS"),
    viviendas = c(30L, 40L),
    entrevistas = c(6L, 6L),
    stringsAsFactors = FALSE
  )
  blocks <- .hojas_ruta_add_operational_values(blocks, cfg)
  sample <- list(
    ok = TRUE,
    config = cfg,
    frame_meta = list(),
    quota = list(cells = list(), table = list()),
    blocks = .hojas_ruta_df_rows(blocks),
    replacement_blocks = list(),
    alerts = list()
  )
  missing <- .hojas_ruta_validate_delivery_sample(sample)
  expect_false(missing$ok)
  expect_true(any(vapply(missing$alerts, function(x) identical(x$code, "E_REPLACEMENT_PAIR_COUNT"), logical(1))))

  replacements <- blocks
  replacements$id_manzana <- c("R1", "R2")
  replacements$tipo_manzana <- "reemplazo"
  replacements$titular_id_manzana <- c("A", "B")
  replacements$titular_ubigeo <- c("150110", "150110")
  replacements$titular_zona <- c("00100", "00100")
  replacements$zona <- c("00100", "00100")
  sample$replacement_blocks <- .hojas_ruta_df_rows(replacements)
  mismatch <- .hojas_ruta_validate_delivery_sample(sample)
  expect_false(mismatch$ok)
  expect_true(any(vapply(mismatch$alerts, function(x) identical(x$code, "E_REPLACEMENT_ZONE_MISMATCH"), logical(1))))
})

test_that("proyeccion de mapas conserva oeste izquierda, este derecha y norte arriba", {
  expect_true(.hojas_ruta_projection_orientation_ok())
  ring <- matrix(c(
    -77.2, -12.2,
    -77.0, -12.2,
    -77.0, -12.0,
    -77.2, -12.0,
    -77.2, -12.2
  ), ncol = 2L, byrow = TRUE)
  project <- .hojas_ruta_project_rings_paper(list(ring), 0, 0, 1, 1, paper_w = 11.69, paper_h = 8.27, pad = 0)
  p <- project(ring)
  expect_lt(max(p$x[ring[, 1] == min(ring[, 1])]), min(p$x[ring[, 1] == max(ring[, 1])]))
  expect_lt(max(p$y[ring[, 2] == min(ring[, 2])]), min(p$y[ring[, 2] == max(ring[, 2])]))
})

test_that("valores operativos son estables por id_manzana y no por orden", {
  cfg <- hojas_ruta_integrada_normalize_config(list(seed = 123, entrevistas_por_manzana = 6))
  block <- list(id_manzana = "150110001000010", viviendas = 48L, entrevistas = 6L, hoja_num = 1L)
  a <- .hojas_ruta_route_operational_values(block, cfg)
  b <- .hojas_ruta_route_operational_values({ block$hoja_num <- 99L; block }, cfg)
  expect_equal(a, b)
  expect_match(a$esquina_inicio, "^[1-4]$")
  expect_true(a$esquina_coordenada %in% as.character(1:4))
  expect_true(a$sentido_recorrido %in% c("1", "2"))
  expect_gte(a$vivienda_inicio, 1L)
  expect_equal(a$domicilio_inicio, a$vivienda_inicio)
  expect_lte(a$vivienda_inicio, a$constante_salto)
  expect_equal(a$constante_salto_unidad, "casa/domicilio")
  expect_equal(a$constante_salto_raw, 8)
  expect_equal(a$constante_salto_formula, "K=48/6; operativo=floor(K)")
  expect_equal(a$salto_operativo, a$constante_salto)
  sweep <- .hojas_ruta_route_operational_values(list(id_manzana = "150110001000011", viviendas = 4L, entrevistas = 6L), cfg)
  expect_equal(sweep$constante_salto, 1L)
  expect_equal(sweep$salto_operativo, 1L)
  expect_equal(sweep$vivienda_inicio, 1L)
  expect_equal(sweep$modo_seleccion_vivienda, "Barrido completo")

  manual_cfg <- hojas_ruta_integrada_normalize_config(list(
    seed = 123,
    route_start_corner = "2",
    route_jump_mode = "manual",
    route_jump_manual = 4
  ))
  manual <- .hojas_ruta_route_operational_values(block, manual_cfg)
  expect_equal(manual$esquina_coordenada, "2")
  expect_equal(manual$constante_salto, 4L)
  expect_equal(manual$constante_salto_modo, "manual")
  expect_match(manual$modo_seleccion_vivienda, "manual")

  off_cfg <- hojas_ruta_integrada_normalize_config(list(route_jump_mode = "off"))
  off <- .hojas_ruta_route_operational_values(block, off_cfg)
  expect_equal(off$constante_salto, 1L)
  expect_equal(off$domicilio_inicio, 1L)
  expect_equal(off$modo_seleccion_vivienda, "Sin constante de salto")
})

test_that("hojas_ruta_generar_pdf_aleatorio_integrado funciona sin seleccion previa", {
  out_pdf <- tempfile(fileext = ".pdf")
  res <- hojas_ruta_generar_pdf_aleatorio_integrado(list(), out_pdf)
  expect_true(res$ok)
  expect_true(file.exists(out_pdf))
  expect_gt(file.info(out_pdf)$size, 0)
  expect_equal(res$entrevistas, 6L)
  expect_true(nzchar(res$ubigeo))
  expect_true(nzchar(res$id_manzana))
  expect_equal(res$random_preference, "balanced")
})

test_that("hojas_ruta_generar_pdf_aleatorio_integrado respeta territorios si existen", {
  out_pdf <- tempfile(fileext = ".pdf")
  res <- hojas_ruta_generar_pdf_aleatorio_integrado(
    list(
      n_objetivo = 30,
      territorios = "070106",
      entrevistas_por_manzana = 6,
      sampling_method = "pps",
      seed = 99
    ),
    out_pdf
  )
  expect_true(res$ok)
  expect_equal(res$ubigeo, "070106")
  expect_true(file.exists(out_pdf))
  expect_gt(file.info(out_pdf)$size, 0)
})

test_that("preferencias del PDF aleatorio ponderan poblacion y urbanidad", {
  frame <- data.frame(
    ubigeo = c("150101", "150101", "150101"),
    zona = c("00100", "00100", "00200"),
    viviendas = c(4, 25, 90),
    poblacion = c(8, 85, 410),
    area_m2 = c(50000, 5500, 1200),
    stringsAsFactors = FALSE
  )
  cfg <- hojas_ruta_integrada_normalize_config(list(measure_var = "viviendas"))

  balanced <- .hojas_ruta_random_block_weights(frame, cfg, "balanced")
  population <- .hojas_ruta_random_block_weights(frame, cfg, "alta_poblacion")
  urban <- .hojas_ruta_random_block_weights(frame, cfg, "urbana")

  expect_equal(length(balanced), 3L)
  expect_gt(population[[3]], population[[1]])
  expect_gt(urban[[3]], urban[[1]])
  expect_equal(.hojas_ruta_random_preference(list(random_preference = "alta poblacion")), "population")
  expect_equal(.hojas_ruta_random_preference(list(randomPreference = "urbana compacta")), "urban")
})

test_that("contexto distrital incluye distritos vecinos y nombres", {
  skip_if_not(file.exists(.hojas_ruta_district_coverage_path()))
  districts <- .hojas_ruta_pdf_district_context_features("150135")
  expect_gt(length(districts), 1L)
  active <- districts[vapply(districts, function(feature) identical(feature$ubigeo, "150135"), logical(1))][[1]]
  bbox <- .hojas_ruta_bbox_fit_aspect(.hojas_ruta_bbox_expand(active$bbox, pad = 0.20), width = 1, height = 1)
  visible <- .hojas_ruta_pdf_district_context_features("150135", bbox)
  expect_true(any(vapply(visible, function(feature) identical(feature$ubigeo, "150135"), logical(1))))
  expect_true(any(vapply(visible, function(feature) !identical(feature$ubigeo, "150135"), logical(1))))
  expect_true(all(vapply(visible, function(feature) nzchar(feature$distrito), logical(1))))
})

test_that("mapa de zona puede incluir manzanas de distritos vecinos", {
  skip_if_not(file.exists(.hojas_ruta_district_coverage_path()))
  districts <- .hojas_ruta_pdf_district_context_features("150115")
  active <- districts[vapply(districts, function(feature) identical(feature$ubigeo, "150115"), logical(1))][[1]]
  bbox <- .hojas_ruta_bbox_fit_aspect(.hojas_ruta_bbox_expand(active$bbox, pad = 0.12), width = 1, height = 1)
  neighbors <- .hojas_ruta_pdf_neighbor_block_features("150115", bbox)
  expect_gt(length(neighbors), 0L)
  expect_true(all(vapply(neighbors, function(feature) isTRUE(feature$out_district), logical(1))))
  expect_true(any(vapply(neighbors, function(feature) !identical(feature$district_ubigeo, "150115"), logical(1))))
})

test_that("manzanas sin poblacion se marcan sin asumir parque", {
  expect_true(.hojas_ruta_pdf_feature_without_population(list(poblacion = 0, viviendas = 0)))
  expect_true(.hojas_ruta_pdf_feature_without_population(list(poblacion = 0, viviendas = NA)))
  expect_false(.hojas_ruta_pdf_feature_without_population(list(poblacion = 12, viviendas = 0)))
})

test_that("tabla B llena solo marginales por edad y sexo", {
  frame <- hojas_ruta_inei_frame()
  row <- frame[as.character(frame$ubigeo) == "150110", , drop = FALSE][1, , drop = FALSE]
  block <- as.list(row)
  block[] <- lapply(block, function(x) x[[1]])
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = "150110",
    entrevistas_por_manzana = 6
  ))

  block$entrevistas <- 6L
  quota <- .hojas_ruta_reference_quota_data(block, NULL, cfg)
  age_cols <- 2:(ncol(quota) - 1L)
  expect_true(all(quota[2, age_cols] == ""))
  expect_true(all(quota[3, age_cols] == ""))
  expect_equal(as.integer(quota[2, ncol(quota)]), 3L)
  expect_equal(as.integer(quota[3, ncol(quota)]), 3L)
  expect_equal(sum(as.integer(quota[4, age_cols])), 6L)
  expect_equal(as.integer(quota[4, ncol(quota)]), 6L)

  block$entrevistas <- 5L
  quota_odd <- .hojas_ruta_reference_quota_data(block, NULL, cfg)
  age <- hojas_ruta_inei_age_simple()
  age <- age[as.character(age$ubigeo) == "150110", , drop = FALSE]
  in_scope <- .hojas_ruta_age_in_defs(as.integer(age$edad), cfg$age_ranges)
  h_pop <- sum(age$poblacion[in_scope & age$sexo == "Hombre"], na.rm = TRUE)
  m_pop <- sum(age$poblacion[in_scope & age$sexo == "Mujer"], na.rm = TRUE)
  winner_row <- if (m_pop > h_pop) 3L else 2L
  other_row <- if (winner_row == 2L) 3L else 2L
  expect_equal(as.integer(quota_odd[winner_row, ncol(quota_odd)]), 3L)
  expect_equal(as.integer(quota_odd[other_row, ncol(quota_odd)]), 2L)
  expect_equal(sum(as.integer(quota_odd[4, age_cols])), 5L)
  expect_equal(as.integer(quota_odd[4, ncol(quota_odd)]), 5L)
})

test_that("hojas_ruta_generar_zip_integrado produce entrega operativa plana", {
  out_zip <- tempfile(fileext = ".zip")
  res <- hojas_ruta_generar_zip_integrado(
    list(
      n_objetivo = 24,
      territorios = c("150110", "070106"),
      sampling_method = "pps",
      seed = 99,
      max_per_manzana = 8,
      replacement_routes_per_district = list("150110" = 1, "070106" = 1)
    ),
    out_zip
  )
  expect_true(file.exists(out_zip))
  expect_equal(res$total_entrevistas, 24L)
  entries <- zip::zip_list(out_zip)$filename
  expect_true("hojas_ruta_seleccionadas.xlsx" %in% entries)
  expect_true("PDF_unificados/hojas_ruta_titulares_unificado.pdf" %in% entries)
  expect_true("PDF_unificados/hojas_ruta_reemplazos_unificado.pdf" %in% entries)
  expect_true(any(grepl("^Titulares/HojaRuta_INEI2017_.*[.]pdf$", entries)))
  expect_true(any(grepl("^Reemplazos/HojaRuta_REEMPLAZO_INEI2017_.*[.]pdf$", entries)))
  expect_true(any(grepl("^Zonas/HojaZona_INEI2017_.*[.]pdf$", entries)))
  expect_true(res$n_zone_pdfs > 0L)
  expect_equal(res$n_unified_pdfs, 2L)
  expect_equal(res$n_zone_pdfs, res$n_zones)
  expect_equal(res$n_replacement_blocks, res$n_blocks)
  expect_true(res$n_zones > 0L)

  exdir <- tempfile("hojas_ruta_zip_")
  utils::unzip(out_zip, files = "hojas_ruta_seleccionadas.xlsx", exdir = exdir)
  report_path <- file.path(exdir, "hojas_ruta_seleccionadas.xlsx")
  expect_true(file.exists(report_path))
  expect_true("Hojas_de_ruta" %in% openxlsx::getSheetNames(report_path))
  report <- openxlsx::read.xlsx(report_path, sheet = "Hojas_de_ruta")
  expect_equal(nrow(report), res$n_blocks + res$n_replacement_blocks)
  expect_setequal(unique(report$Tipo.de.ruta), c("TITULAR", "REEMPLAZO"))
})

test_that("hojas_ruta_rows_df tolera NULL serializados desde frontend", {
  rows <- list(
    list(
      id_manzana = "070101008000470",
      distrito = "CALLAO",
      ubigeo = "070101",
      zona = "00800",
      entrevistas = 6L,
      lat = NULL,
      lon = NULL,
      tipo_manzana = "titular"
    )
  )
  out <- .hojas_ruta_rows_df(rows)
  expect_equal(nrow(out), 1L)
  expect_true(all(c("lat", "lon") %in% names(out)))
  expect_true(is.na(out$lat[[1]]))
  expect_true(is.na(out$lon[[1]]))
})

test_that("hojas_ruta_write_integrated_workbook tolera metadata opcional vacia", {
  skip_if_not_installed("openxlsx")
  sample <- hojas_ruta_sample_preview_integrado(list(
    n_objetivo = 6,
    territorios = "150110",
    seed = 101
  ))
  expect_true(sample$ok)
  sample$frame_meta$empty_optional <- character(0)
  sample$frame_meta$empty_nested <- list()
  sample$config$sample_size$margin_district <- NULL

  out_xlsx <- tempfile(fileext = ".xlsx")
  expect_error(
    .hojas_ruta_write_integrated_workbook(sample, out_xlsx, technical = TRUE),
    NA
  )
  expect_true(file.exists(out_xlsx))
  fuente <- openxlsx::read.xlsx(out_xlsx, sheet = "Fuente")
  params <- openxlsx::read.xlsx(out_xlsx, sheet = "Parametros")
  expect_true(all(c("campo", "valor") %in% names(fuente)))
  expect_true(all(c("parametro", "valor") %in% names(params)))
})
