# Tests para los helpers del módulo Dashboard (R puro, sin Plumber).

# Fixture mínimo: instrumento con begin_group y dos preguntas (SO+SM),
# y un data frame con dummies SM expandidas.
.fx_inst <- function() {
  list(
    survey = data.frame(
      type = c("begin_group", "select_one lista", "select_multiple lista", "end_group"),
      name = c("seccion_a", "q1", "q2", ""),
      label = c("Sección A", "Pregunta 1", "Pregunta 2", ""),
      list_name = c("", "lista", "lista", ""),
      group_name = c("", "seccion_a", "seccion_a", ""),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lista", "lista"),
      name = c("1", "2"),
      label = c("Opción 1", "Opción 2"),
      stringsAsFactors = FALSE
    )
  )
}

.fx_data <- function() {
  data.frame(
    q1   = c("1", "2", "1", "2", "1"),
    q2.1 = c(1L, 0L, 1L, 1L, 0L),
    q2.2 = c(0L, 1L, 1L, 0L, 1L),
    sex  = c("F", "M", "F", "F", "M"),
    stringsAsFactors = FALSE
  )
}

test_that(".dashboard_default_config retorna shape esperada", {
  cfg <- prosecnurapp:::.dashboard_default_config()
  expect_named(cfg, c("titulo", "subtitulo", "logo_data_uri", "logo_alt",
                      "logo_height_px", "paleta_id", "paletas_listas",
                      "color_primario_override", "notas"))
  expect_identical(cfg$titulo, "Dashboard")
  expect_null(cfg$logo_data_uri)
  expect_null(cfg$paleta_id)
})

test_that(".dashboard_theme_default retorna los 8 colores del legacy", {
  th <- prosecnurapp:::.dashboard_theme_default()
  expect_named(th, c("color_primario", "color_fondo_app", "color_borde",
                     "color_texto", "color_texto_suave", "color_superficie",
                     "color_superficie_2", "color_header_tabla"))
  expect_identical(th$color_primario, "#002457")
})

test_that(".dashboard_manifest reporta tabs no disponibles cuando no hay datos", {
  s <- list(rp_data = NULL, rp_inst = NULL, rp_dim = NULL, analitica_dim_ok = FALSE)
  m <- prosecnurapp:::.dashboard_manifest(s)
  expect_length(m$tabs, 4L)
  expect_identical(vapply(m$tabs, function(t) t$id, character(1)),
                   c("resumen", "relaciones", "base_datos", "dimensiones"))
  expect_false(m$tabs[[1]]$available)
  expect_false(m$tabs[[2]]$available)
  expect_false(m$tabs[[3]]$available)
  expect_false(m$tabs[[4]]$available)
  expect_equal(m$estado$n_secciones, 0L)
})

test_that(".dashboard_manifest activa Resumen y Relaciones cuando hay datos+secciones", {
  s <- list(
    dashboard_rp_data = .fx_data(),
    dashboard_rp_inst = .fx_inst(),
    rp_dim = NULL,
    analitica_dim_ok = FALSE
  )
  m <- prosecnurapp:::.dashboard_manifest(s)
  expect_true(m$tabs[[1]]$available)  # resumen
  expect_true(m$tabs[[2]]$available)  # relaciones
  expect_true(m$tabs[[3]]$available)  # base_datos
  expect_false(m$tabs[[4]]$available) # dimensiones (no rp_dim)
  expect_gte(m$estado$n_secciones, 1L)
})

test_that(".dashboard_build_secciones detecta sección desde begin_group", {
  inst <- .fx_inst()
  df <- .fx_data()
  secs <- prosecnurapp:::.dashboard_build_secciones(inst, df)
  expect_length(secs, 1L)
  expect_named(secs, "Sección A")
  # q1 está en df; q2 (SM madre) está como dummies q2.1/q2.2
  expect_setequal(secs[["Sección A"]], c("q1", "q2"))
})

test_that(".dashboard_build_secciones devuelve list() cuando no hay rp_inst", {
  expect_identical(prosecnurapp:::.dashboard_build_secciones(NULL, NULL), list())
  expect_identical(prosecnurapp:::.dashboard_build_secciones(NULL, .fx_data()), list())
})

test_that(".dashboard_curated_secciones excluye integer/decimal aunque exista curaduría previa", {
  inst <- list(
    survey = data.frame(
      type = c("begin_group", "select_one lista", "integer", "decimal",
               "select_multiple lista", "end_group"),
      name = c("seccion_a", "q1", "edad", "monto", "q2", ""),
      label = c("Sección A", "Pregunta 1", "Edad", "Monto", "Pregunta 2", ""),
      list_name = c("", "lista", "", "", "lista", ""),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lista", "lista"),
      name = c("1", "2"),
      label = c("Opción 1", "Opción 2"),
      stringsAsFactors = FALSE
    )
  )
  df <- data.frame(
    q1 = c("1", "2", "1"),
    edad = c(22L, 35L, 41L),
    monto = c(10.5, 20.1, 15.0),
    q2.1 = c(1L, 0L, 1L),
    q2.2 = c(0L, 1L, 0L),
    stringsAsFactors = FALSE
  )

  raw <- prosecnurapp:::.dashboard_build_secciones(inst, df)
  expect_true(all(c("edad", "monto") %in% raw[["Sección A"]]))

  s <- list(
    dashboard_rp_data = df,
    dashboard_rp_inst = inst,
    dashboard_curacion = list(
      confirmed = TRUE,
      exclude_sections = list(),
      exclude_vars = list()
    )
  )
  curated <- prosecnurapp:::.dashboard_curated_secciones(s)
  expect_setequal(curated[["Sección A"]], c("q1", "q2"))

  payload <- prosecnurapp:::.dashboard_curacion_payload(s)
  vars <- payload$secciones[[1]]$vars
  by_name <- stats::setNames(vars, vapply(vars, function(x) x$name, character(1)))
  expect_false(by_name$edad$default_include)
  expect_false(by_name$monto$default_include)
  expect_match(by_name$edad$reason, "numérica")
})

test_that(".dashboard_apply_filtros filtra por var/valores", {
  df <- .fx_data()
  out <- prosecnurapp:::.dashboard_apply_filtros(
    df,
    list(list(var = "sex", valores = list("F")))
  )
  expect_equal(nrow(out), 3L)
  expect_true(all(out$sex == "F"))
})

test_that(".dashboard_apply_filtros ignora vars inexistentes y valores vacíos", {
  df <- .fx_data()
  expect_equal(nrow(prosecnurapp:::.dashboard_apply_filtros(df, list())), nrow(df))
  expect_equal(
    nrow(prosecnurapp:::.dashboard_apply_filtros(
      df, list(list(var = "no_existe", valores = list("X")))
    )),
    nrow(df)
  )
  expect_equal(
    nrow(prosecnurapp:::.dashboard_apply_filtros(
      df, list(list(var = "sex", valores = list()))
    )),
    nrow(df)
  )
})

test_that(".dashboard_dist_so retorna counts y pcts ordenados por choices", {
  inst <- .fx_inst()
  df <- .fx_data()
  dist <- prosecnurapp:::.dashboard_dist_so(df, "q1", inst)
  expect_length(dist, 2L)
  # Orden por orden de choices: "Opción 1" antes que "Opción 2"
  expect_identical(dist[[1]]$label, "Opción 1")
  expect_equal(dist[[1]]$n, 3L)
  expect_equal(round(dist[[1]]$pct, 2), 0.6)
})

test_that(".dashboard_dist_sm retorna n_yes y pct_yes por opción", {
  inst <- .fx_inst()
  df <- .fx_data()
  opts <- prosecnurapp:::.dashboard_dist_sm(df, "q2", inst)
  expect_length(opts, 2L)
  # q2.1 = c(1,0,1,1,0) → 3 yes / 5 total
  o1 <- Filter(function(o) o$col_dummy == "q2.1", opts)[[1]]
  expect_equal(o1$n_yes, 3L)
  expect_equal(o1$n_total, 5L)
  expect_identical(o1$label, "Opción 1")
})

test_that(".dashboard_resumen_payload arma rows con dist por sección", {
  s <- list(dashboard_rp_data = .fx_data(), dashboard_rp_inst = .fx_inst())
  payload <- prosecnurapp:::.dashboard_resumen_payload(s, "Sección A", list())
  expect_identical(payload$seccion, "Sección A")
  expect_equal(payload$n_total, 5L)
  expect_length(payload$rows, 2L)
  # Primera row: q1 (SO) con dist
  so_row <- payload$rows[[1]]
  expect_identical(so_row$type, "so")
  expect_identical(so_row$var, "q1")
  expect_length(so_row$dist, 2L)
  # Segunda row: q2 (SM) con options
  sm_row <- payload$rows[[2]]
  expect_identical(sm_row$type, "sm")
  expect_identical(sm_row$var, "q2")
  expect_length(sm_row$options, 2L)
  # slot_id de Shiny no debe filtrar al payload React
  expect_null(so_row$slot_id)
})

test_that(".dashboard_resumen_payload aplica filtros antes de computar dist", {
  s <- list(dashboard_rp_data = .fx_data(), dashboard_rp_inst = .fx_inst())
  payload <- prosecnurapp:::.dashboard_resumen_payload(
    s, "Sección A",
    list(list(var = "sex", valores = list("F")))
  )
  expect_equal(payload$n_total, 3L)
  # q1 filtrado a sexo F (filas 1,3,4): valores "1","1","2" → opción "1" tiene 2 casos
  so_row <- payload$rows[[1]]
  o1 <- Filter(function(d) d$code == "1", so_row$dist)[[1]]
  expect_equal(o1$n, 2L)
})

test_that(".dashboard_secciones_payload incluye tipos y kpi_vars sugeridos", {
  s <- list(dashboard_rp_data = .fx_data(), dashboard_rp_inst = .fx_inst())
  payload <- prosecnurapp:::.dashboard_secciones_payload(s)
  expect_length(payload$secciones, 1L)
  vars <- payload$secciones[[1]]$vars
  tipos <- vapply(vars, function(v) v$tipo, character(1))
  expect_true("so" %in% tipos)
  expect_true("sm" %in% tipos)
  # kpi_vars debe sugerir q1 (SO con 2 categorías, dentro del rango 2..8)
  kpi_vars <- as.character(unlist(payload$kpi_vars))
  expect_true("q1" %in% kpi_vars)
})

test_that(".dashboard_categorias_var lee labels de choices", {
  inst <- .fx_inst()
  df <- .fx_data()
  vals <- prosecnurapp:::.dashboard_categorias_var("q1", inst, df)
  expect_length(vals, 2L)
  v1 <- Filter(function(v) v$value == "1", vals)[[1]]
  expect_identical(v1$label, "Opción 1")
})
