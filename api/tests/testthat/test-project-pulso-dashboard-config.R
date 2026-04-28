# =============================================================================
# Persistencia de dashboard_config avanzado en .pulso
# =============================================================================

.dashboard_config_test_bytes <- function() {
  as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00))
}

.dashboard_config_test_session <- function() {
  sid <- session_create()
  meta <- save_upload(sid, "xlsform", "demo_inst.xlsx", .dashboard_config_test_bytes())
  data_meta <- save_upload(sid, "data", "demo_data.xlsx", .dashboard_config_test_bytes())
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["default"]] <- list(
    nombre = "default",
    xlsform_file_id = meta$file_id,
    data_file_id = data_meta$file_id,
    data_ext = "xlsx"
  )
  .session_env[[sid]] <- s
  list(sid = sid, file_id = meta$file_id, data_file_id = data_meta$file_id)
}

.dashboard_config_new_fields <- function() {
  list(
    semaforo_modo = "gradiente",
    semaforo_red_color = "#AA1111",
    semaforo_amber_color = "#CCAA22",
    semaforo_green_color = "#118844",
    semaforo_red_max = 42L,
    semaforo_amber_max = 73L,
    semaforo_stops_extra = list(
      list(value = 15, color = "#440000"),
      list(value = 88, color = "#004422")
    ),
    radar_min = 12L,
    radar_max = 132L,
    radar_gridshape = "circular",
    radar_modo = "alternante",
    radar_animado = FALSE,
    barras_orientacion = "facet",
    barras_x_min = 7L,
    barras_x_max = 143L,
    foda_iconos_enabled = FALSE,
    foda_icon_tint = "#112233",
    foda_icon_size = 1.35,
    foda_icon_legend = FALSE,
    foda_score_min = 8L,
    foda_score_max = 111L,
    foda_show_total = FALSE,
    foda_spacing = 1.42,
    foda_grid_intensity = 0.67,
    foda_vista = "servicios",
    foda_views = list(
      list(
        id = "conductores",
        label = "Conductores",
        variable = "",
        metric_var = "",
        card_mode = "iconos",
        aliases = list(),
        icons = list()
      ),
      list(
        id = "servicios",
        label = "Servicios",
        variable = "servicio",
        metric_var = "idx_indice_general",
        card_mode = "iconos",
        aliases = list(ULE = "ULE"),
        icons = list(ULE = "/tmp/ule.png")
      ),
      list(
        id = "municipios",
        label = "Municipios",
        variable = "distrito",
        metric_var = "idx_indice_general",
        card_mode = "alias",
        aliases = list(Ate = "ATE", Rimac = "RIM"),
        icons = list()
      )
    ),
    foda_aliases = list(distrito = list(
      Ate = "ATE",
      Rimac = "RIM",
      "San Juan de Lurigancho" = "SJL",
      "Villa El Salvador" = "VES",
      "La Esperanza" = "LE",
      "El Porvenir" = "EP"
    )),
    foda_service_icons = list(ULE = "/tmp/ule.png")
  )
}

test_that("build_pulso + load_pulso preservan dashboard_config avanzado", {
  setup <- .dashboard_config_test_session()
  on.exit(session_delete(setup$sid))

  advanced <- .dashboard_config_new_fields()
  cfg <- .dashboard_default_config()
  patch <- c(list(titulo = "Dashboard avanzado", subtitulo = "Round-trip"), advanced)
  cfg[names(patch)] <- patch
  session_set(setup$sid, "dashboard_config", cfg)

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  loaded_cfg <- session_get(res_load$session_id)$dashboard_config

  for (field in names(advanced)) {
    expect_equal(loaded_cfg[[field]], advanced[[field]], info = field)
  }
})

test_that("dashboard_config viejo se completa con defaults al reabrir", {
  setup <- .dashboard_config_test_session()
  on.exit(session_delete(setup$sid))

  old_cfg <- list(
    titulo = "Dashboard viejo",
    subtitulo = "Sin campos nuevos",
    paleta_id = "tableau10"
  )
  session_set(setup$sid, "dashboard_config", old_cfg)

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  loaded_cfg <- .dashboard_config_with_defaults(
    session_get(res_load$session_id)$dashboard_config
  )
  defaults <- .dashboard_default_config()

  expect_equal(loaded_cfg$titulo, "Dashboard viejo")
  expect_equal(loaded_cfg$paleta_id, "tableau10")
  expect_equal(loaded_cfg$semaforo_modo, defaults$semaforo_modo)
  expect_equal(loaded_cfg$radar_modo, defaults$radar_modo)
  expect_equal(loaded_cfg$barras_orientacion, defaults$barras_orientacion)
  expect_equal(loaded_cfg$foda_grid_intensity, defaults$foda_grid_intensity)
  expect_equal(loaded_cfg$foda_vista, defaults$foda_vista)
  expect_equal(loaded_cfg$foda_views, defaults$foda_views)
  expect_equal(loaded_cfg$foda_aliases, defaults$foda_aliases)
})
