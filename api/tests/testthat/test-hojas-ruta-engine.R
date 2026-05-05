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
  expect_equal(out$n_recommended, 385L)
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

test_that("hojas_ruta_sample_size_preview aplica bi-objetivo cuando el piso distrital manda", {
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
  expect_equal(out$n_total_min, 97L)
  expect_gte(out$n_district_floor, 2L * out$n_total_min - 5L)
  expect_equal(out$n_recommended, max(out$n_total_min, out$n_district_floor))
  rows <- .hojas_ruta_rows_df(out$district_rows)
  expect_true(all(rows$n_min_district > 0))
})

test_that("hojas_ruta_sample_size_preview puede desactivar piso distrital", {
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
  expect_equal(length(cfg$age_ranges), 3L)
  expect_equal(cfg$age_ranges[[1]]$min, 18L)
  expect_true(is.na(cfg$age_ranges[[3]]$max))
  expect_true(all(vapply(cfg$age_ranges, function(x) grepl("^[0-9]+(-[0-9]+|[+])$", x$label), logical(1))))
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

test_that("cartografia vial OSM esta empaquetada y se sirve localmente", {
  meta <- hojas_ruta_cartografia_calles_meta()
  expect_true(meta$ok)
  expect_match(meta$source, "OpenStreetMap")
  expect_match(meta$license, "ODbL|Open Database License")
  expect_match(meta$attribution, "OpenStreetMap")
  expect_equal(meta$mode, "local_only")
  expect_equal(meta$packaged_districts, 50L)
  expect_true(meta$packaged_streets > 10000L)

  miraflores <- hojas_ruta_street_map_preview("150122")
  expect_true(miraflores$ok)
  expect_true(miraflores$count > 100L)
  expect_true(any(vapply(miraflores$geojson$features, function(x) {
    identical(x$properties$class_group, "major")
  }, logical(1))))

  missing <- hojas_ruta_street_map_preview("150199")
  expect_false(missing$ok)
  expect_true(any(vapply(missing$alerts, function(x) identical(x$code, "W_STREET_MAP_NOT_PACKAGED_LOCAL"), logical(1))))
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

test_that("hojas_ruta_generar_zip_integrado produce PDFs e informe tecnico", {
  out_zip <- tempfile(fileext = ".zip")
  res <- hojas_ruta_generar_zip_integrado(
    list(
      n_objetivo = 24,
      territorios = c("150110", "070106"),
      sampling_method = "pps",
      seed = 99,
      max_per_manzana = 8
    ),
    out_zip
  )
  expect_true(file.exists(out_zip))
  expect_equal(res$total_entrevistas, 24L)
  entries <- zip::zip_list(out_zip)$filename
  expect_true("resumen_operativo.xlsx" %in% entries)
  expect_true("informe_tecnico.xlsx" %in% entries)
  expect_true(any(grepl("^HojaRuta_INEI2017_.*[.]pdf$", entries)))
  expect_true(any(grepl("^HojaZona_INEI2017_.*[.]pdf$", entries)))
  expect_true(res$n_zone_pdfs > 0L)
  expect_true(res$n_zones > 0L)
})
