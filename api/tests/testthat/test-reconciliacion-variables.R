# Reconciliación de variables data↔XLSForm (reconciliacion_variables.R).
#
# Cubre, sin levantar plumber, la lógica del cubo de reconciliación, su
# persistencia por base, la interacción con el export de la BBDD (default excluye
# todas las extra; el include manda sobre el empty-drop) y el contrato de los
# endpoints (payload del GET + validación defensiva del POST).
#
# Ejecutar:
#   cd prosecnur-app
#   Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-reconciliacion-variables.R")'

library(testthat)

if (!exists("%||%")) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
}

# Instrumento mínimo con clase prosecnur_instrumento: sexo/edad/comentario son
# las variables esperadas del XLSForm (`.dn_expected_data_names`).
.rv_fixture_inst <- function() {
  survey <- data.frame(
    type = c("select_one sexo_list", "integer", "text"),
    name = c("sexo", "edad", "comentario"),
    label = c("Sexo", "Edad", "Comentario"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  structure(list(survey = survey), class = "prosecnur_instrumento")
}

# Data con: variables del instrumento + metadata Kobo + internas de plumbing +
# extra sustantivas (una con datos: dim_actor; una vacía: A1_rec).
.rv_fixture_data <- function() {
  data.frame(
    sexo = c("1", "2", "1", "2"),
    edad = c(30, 40, 25, 33),
    comentario = c("a", "", "b", "c"),
    `_uuid` = c("u1", "u2", "u3", "u4"),          # metadata -> se conserva
    `_submission_time` = c("t", "t", "t", "t"),   # metadata -> se conserva
    `meta.instanceID` = c("i", "i", "i", "i"),    # metadata -> se conserva
    `.source_declared` = c("s", "s", "s", "s"),   # interna -> ya se stripea
    dim_actor = c("ONG", "Estado", "", "ONG"),    # extra con datos (75%)
    dim_servicio = c("salud", "legal", "salud", "legal"), # extra con datos (100%)
    A1_rec = c("", NA, "", ""),                   # extra vacía (0%)
    perception_index = c(NA, NA, NA, NA),         # extra vacía (0%)
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

test_that(".reconciliacion_is_kobo_metadata reconoce patrones estándar", {
  expect_true(.reconciliacion_is_kobo_metadata("_uuid"))
  expect_true(.reconciliacion_is_kobo_metadata("__version__"))
  expect_true(.reconciliacion_is_kobo_metadata("_submission_time"))
  expect_true(.reconciliacion_is_kobo_metadata("meta.instanceID"))
  expect_true(.reconciliacion_is_kobo_metadata("meta/instanceID"))
  expect_true(.reconciliacion_is_kobo_metadata("formhub.uuid"))
  expect_false(.reconciliacion_is_kobo_metadata("dim_actor"))
  expect_false(.reconciliacion_is_kobo_metadata("A1_rec"))
  expect_false(.reconciliacion_is_kobo_metadata("sexo"))
})

test_that(".reconciliacion_variables_extra devuelve SOLO las extra sustantivas", {
  data <- .rv_fixture_data()
  inst <- .rv_fixture_inst()
  df <- .reconciliacion_variables_extra(data, inst)

  # Solo extra sustantivas: dim_actor, dim_servicio, A1_rec, perception_index.
  # Ni metadata (_uuid/_submission_time/meta.instanceID) ni internas (.source_*)
  # ni variables del instrumento (sexo/edad/comentario).
  expect_setequal(df$name, c("dim_actor", "dim_servicio", "A1_rec", "perception_index"))
  expect_false(any(c("_uuid", "_submission_time", "meta.instanceID") %in% df$name))
  expect_false(".source_declared" %in% df$name)
  expect_false(any(c("sexo", "edad", "comentario") %in% df$name))

  # Ordenado por fill_pct desc: dim_servicio(100) > dim_actor(75) > vacías(0).
  expect_equal(df$name[1], "dim_servicio")
  expect_equal(df$name[2], "dim_actor")

  # fill_pct correcto y kind coherente.
  row <- function(nm) df[df$name == nm, , drop = FALSE]
  expect_equal(row("dim_servicio")$fill_pct, 100)
  expect_equal(row("dim_servicio")$kind, "con_datos")
  expect_equal(row("dim_actor")$fill_pct, 75)
  expect_equal(row("dim_actor")$n_fill, 3L)
  expect_equal(row("dim_actor")$kind, "con_datos")
  expect_equal(row("A1_rec")$fill_pct, 0)
  expect_equal(row("A1_rec")$n_fill, 0L)
  expect_equal(row("A1_rec")$kind, "vacia")
  expect_equal(row("perception_index")$kind, "vacia")
})

test_that("calculates y dummies SM NO son extra (clasificación por stem)", {
  # Survey con un calculate y un select_multiple; ninguno produce columna ancha
  # directa (el calculate no está en la data ancha; el SM vive como dummies),
  # pero AMBOS están en inst$survey$name -> NO deben marcarse como extra.
  survey <- data.frame(
    type = c("select_one sexo_list", "calculate", "select_multiple p1_list"),
    name = c("sexo", "E1_age_calc", "P1"),
    label = c("Sexo", "Edad calculada", "Pregunta 1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  inst <- structure(list(survey = survey), class = "prosecnur_instrumento")
  data <- data.frame(
    sexo = c("1", "2", "1"),
    E1_age_calc = c("30", "40", "25"),  # calculate -> NO extra
    `P1.1` = c("1", "0", "1"),          # dummy SM (parent P1) -> NO extra
    `P1.96` = c("0", "1", "0"),         # dummy SM -> NO extra
    viejo_v3 = c("x", "y", "z"),        # extra REAL (versión vieja del form)
    stringsAsFactors = FALSE, check.names = FALSE
  )
  df <- .reconciliacion_variables_extra(data, inst)
  expect_equal(df$name, "viejo_v3")
  expect_false(any(c("E1_age_calc", "P1.1", "P1.96", "sexo") %in% df$name))
})

test_that(".reconciliacion_resolve_stem resuelve dummies y group-prefix", {
  expect_equal(.reconciliacion_resolve_stem("D1_information.96"), "D1_information")
  expect_equal(.reconciliacion_resolve_stem("D1_information_recod.1"), "D1_information_recod")
  expect_equal(.reconciliacion_resolve_stem("P1.1"), "P1")
  expect_equal(.reconciliacion_resolve_stem("Core.date"), "date")  # group-prefix -> token
  expect_equal(.reconciliacion_resolve_stem("dim_actor"), "dim_actor")
  expect_equal(.reconciliacion_resolve_stem("E1_age_calc"), "E1_age_calc")
})

test_that(".reconciliacion_variables_extra es no-op sin inst o sin data", {
  data <- .rv_fixture_data()
  inst <- .rv_fixture_inst()
  expect_equal(nrow(.reconciliacion_variables_extra(data, NULL)), 0L)
  expect_equal(nrow(.reconciliacion_variables_extra(data.frame(), inst)), 0L)
  expect_equal(nrow(.reconciliacion_variables_extra(NULL, inst)), 0L)
})

test_that("persistencia: variables_extra_incluidas round-trip por base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  cfg <- .analitica_config_get(sid)
  expect_equal(.as_chr_vec(cfg$variables_extra_incluidas), character(0))  # default vacío

  cfg$variables_extra_incluidas <- as.list(c("dim_actor", "dim_servicio"))
  .analitica_config_set(sid, cfg)

  got <- .analitica_config_get(sid)
  expect_setequal(.as_chr_vec(got$variables_extra_incluidas), c("dim_actor", "dim_servicio"))
})

test_that("export: por defecto TODAS las extra se excluyen del BBDD", {
  data <- .rv_fixture_data()
  inst <- .rv_fixture_inst()
  cfg <- .analitica_default_config()  # variables_extra_incluidas vacío

  recon <- .reconciliacion_export_plan(data, inst, cfg)
  empty_cols <- setdiff(.analitica_base_empty_cols(data), recon$extra_incluidas)
  out <- .excluir_cols(
    data,
    c(.as_chr_vec(cfg$variables_excluidas),
      .analitica_base_internal_cols(data),
      empty_cols,
      recon$extra_a_excluir)
  )

  # Ninguna extra sobrevive; las variables del instrumento y la metadata sí.
  expect_false(any(c("dim_actor", "dim_servicio", "A1_rec", "perception_index") %in% names(out)))
  expect_true(all(c("sexo", "edad", "comentario") %in% names(out)))
  expect_true("_uuid" %in% names(out))               # metadata conservada
  expect_false(".source_declared" %in% names(out))   # interna stripeada
})

test_that("export: una extra INCLUIDA sobrevive (aunque esté vacía)", {
  data <- .rv_fixture_data()
  inst <- .rv_fixture_inst()
  cfg <- .analitica_default_config()
  # Incluye una con datos (dim_actor) y una vacía (A1_rec).
  cfg$variables_extra_incluidas <- as.list(c("dim_actor", "A1_rec"))

  recon <- .reconciliacion_export_plan(data, inst, cfg)
  empty_cols <- setdiff(.analitica_base_empty_cols(data), recon$extra_incluidas)
  out <- .excluir_cols(
    data,
    c(.as_chr_vec(cfg$variables_excluidas),
      .analitica_base_internal_cols(data),
      empty_cols,
      recon$extra_a_excluir)
  )

  # dim_actor incluida -> sobrevive. A1_rec incluida-pero-vacía -> el include
  # manda sobre el empty-drop, sobrevive igual.
  expect_true("dim_actor" %in% names(out))
  expect_true("A1_rec" %in% names(out))
  # Las NO incluidas siguen fuera.
  expect_false("dim_servicio" %in% names(out))
  expect_false("perception_index" %in% names(out))
})

# ---- Endpoints (helpers que consumen los routers delgados) ------------------

# Registra una base standalone en la sesión con su rp_data/rp_inst cacheados,
# de modo que `.load_rp_data` los devuelva sin tocar plumber.
.rv_setup_session <- function() {
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  model <- list(
    survey = data.frame(
      type = c("select_one sexo_list", "integer", "text"),
      name = c("sexo", "edad", "comentario"),
      label = c("Sexo", "Edad", "Comentario"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("sexo_list", "sexo_list"),
      name = c("1", "2"),
      label = c("Mujer", "Hombre"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    settings = data.frame(form_title = "Recon", form_id = "recon",
                          stringsAsFactors = FALSE, check.names = FALSE)
  )
  xls_path <- file.path(downloads_dir, "recon_xlsform.xlsx")
  .carga_write_xlsform_model(model, xls_path)
  inst <- reporte_instrumento(path = xls_path)

  wide <- .rv_fixture_data()
  rp_data <- reporte_data(wide, instrumento = inst)

  session_set(sid, "analitica_rp_data", rp_data)
  session_set(sid, "analitica_rp_inst", inst)
  session_set(sid, "analitica_fuente", .analitica_source_cache_key(sid, "originales"))
  sid
}

test_that("GET reconciliación: contrato del payload de la base activa", {
  sid <- .rv_setup_session()
  on.exit(session_delete(sid), add = TRUE)

  info <- .reconciliacion_info(sid)
  expect_true(isTRUE(info$ok))
  expect_true(is.list(info$extra))
  expect_equal(info$n_extra, 4L)
  expect_equal(info$n_incluidas, 0L)

  nombres <- vapply(info$extra, function(e) e$name, character(1))
  expect_setequal(nombres, c("dim_actor", "dim_servicio", "A1_rec", "perception_index"))

  # Shape de cada entry: name, fill_pct, n_fill, kind, incluida.
  e1 <- info$extra[[1]]
  expect_setequal(names(e1), c("name", "fill_pct", "n_fill", "kind", "incluida"))
  expect_false(e1$incluida)  # ninguna incluida por defecto
  expect_equal(e1$name, "dim_servicio")  # orden por fill desc
})

test_that("POST reconciliación: persiste incluidas y refleja incluida=TRUE", {
  sid <- .rv_setup_session()
  on.exit(session_delete(sid), add = TRUE)

  info <- .reconciliacion_set_incluidas(sid, c("dim_actor"))
  expect_equal(info$n_incluidas, 1L)
  marcada <- Filter(function(e) e$name == "dim_actor", info$extra)[[1]]
  expect_true(marcada$incluida)

  # Persistido en la config de la base.
  got <- .analitica_config_get(sid)
  expect_setequal(.as_chr_vec(got$variables_extra_incluidas), "dim_actor")
})

test_that("POST reconciliación: rechaza nombres que no son extra reales", {
  sid <- .rv_setup_session()
  on.exit(session_delete(sid), add = TRUE)

  err <- tryCatch(
    .reconciliacion_set_incluidas(sid, c("dim_actor", "no_existe")),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_RECON_VAR_DESCONOCIDA")
})

# ---------------------------------------------------------------------------
# Gate de proveniencia en el banner "Variables extra en la data".
# El path del banner (.analitica_read_pair) ahora sanea la data ANTES de contar
# extras. Base con proveniencia de handoff: el esquema de seguimiento/universo
# VACÍO desaparece de las extras. Base de carga manual: sus vacías se preservan.
# ---------------------------------------------------------------------------

.rv_fixture_universo_data <- function() {
  data.frame(
    sexo = c("1", "2", "1", "2"),
    edad = c(30, 40, 25, 33),
    comentario = c("a", "", "b", "c"),
    dim_actor = c("ONG", "Estado", "", "ONG"),     # extra con datos -> siempre queda
    # esquema de seguimiento/universo de Monitoreo, 100% VACÍO:
    Origen = c("", "", "", ""),
    Status = c(NA, NA, NA, NA),
    dim_sede = c("", "", "", ""),
    `.integration_mode` = c("connected_read", "connected_read",
                            "connected_read", "connected_read"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

test_that("base con proveniencia de handoff: el universo vacío NO cuenta como extra", {
  inst <- .rv_fixture_inst()
  # Gate de handoff (source_kind = monitoreo_kobo -> TRUE).
  saneada <- sanitize_base_data(.rv_fixture_universo_data(), inst,
                                monitoreo_handoff = .base_hygiene_is_monitoreo_kind("monitoreo_kobo"))
  df <- .reconciliacion_variables_extra(saneada, inst)

  # Solo la extra sustantiva sobrevive; el universo vacío se saneó.
  expect_equal(df$name, "dim_actor")
  expect_false(any(c("Origen", "Status", "dim_sede") %in% df$name))
  expect_false(".integration_mode" %in% names(saneada))
})

test_that("base de carga manual: sus columnas vacías SÍ siguen siendo extras", {
  inst <- .rv_fixture_inst()
  # Upload manual: source_kind no-handoff -> gate FALSE, no se sanea el universo.
  data_manual <- .rv_fixture_universo_data()
  data_manual$.integration_mode <- NULL   # sin marcadores de handoff
  saneada <- sanitize_base_data(data_manual, inst,
                                monitoreo_handoff = .base_hygiene_is_monitoreo_kind("upload"))
  df <- .reconciliacion_variables_extra(saneada, inst)

  # Las vacías del usuario se preservan como extras (Origen/Status/dim_sede).
  expect_true(all(c("Origen", "Status", "dim_sede") %in% df$name))
  expect_true("dim_actor" %in% df$name)
})

# ---------------------------------------------------------------------------
# FIX A/B: falsos positivos del banner "Variables extra en la data".
# Dummies de SM y derivadas cuyo prefix ∈ instrumento NO cuentan como extra;
# `dim_*` de Monitoreo no cuentan en base de handoff (sí en manual). Sin
# introducir falsos negativos (extras genuinas siguen apareciendo).
# ---------------------------------------------------------------------------

.rv_fixture_inst_sm <- function() {
  # `services` es select_multiple; `Assistance` es un grupo del instrumento.
  survey <- data.frame(
    type = c("select_multiple servicios", "begin_group", "text", "end_group", "integer"),
    name = c("services", "Assistance", "rep_servicios_count", "Assistance", "edad"),
    label = c("Servicios", "Asistencia", "Conteo", "Asistencia", "Edad"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  structure(list(survey = survey), class = "prosecnur_instrumento")
}

test_that("FIX A: dummy de SM cuyo parent ∈ instrumento NO se cuenta como extra", {
  inst <- .rv_fixture_inst_sm()
  data <- data.frame(
    edad = c(30, 40),
    services.legal = c("1", "0"),      # dummy SM: prefix `services` ∈ inst
    services.psico = c("0", "1"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  df <- .reconciliacion_variables_extra(data, inst)
  expect_false(any(c("services.legal", "services.psico") %in% df$name))
  # La data conserva las dummies (Analítica/gráficos las usan).
  expect_true(all(c("services.legal", "services.psico") %in% names(data)))
})

test_that("FIX A: `prefix.suffix` con prefix = grupo del instrumento NO se cuenta", {
  inst <- .rv_fixture_inst_sm()
  data <- data.frame(
    edad = c(30, 40),
    Assistance.rep_servicios_count = c("2", "1"),  # prefix `Assistance` = grupo
    check.names = FALSE, stringsAsFactors = FALSE
  )
  df <- .reconciliacion_variables_extra(data, inst)
  expect_false("Assistance.rep_servicios_count" %in% df$name)
})

test_that("anti-falso-negativo: `foo.bar` (ni foo ni bar en inst) SÍ es extra", {
  inst <- .rv_fixture_inst_sm()
  data <- data.frame(
    edad = c(30, 40),
    foo.bar = c("x", "y"),        # prefix `foo` ajeno + suffix `bar` ajeno
    foo = c("a", "b"),            # extra genuina sin punto
    check.names = FALSE, stringsAsFactors = FALSE
  )
  df <- .reconciliacion_variables_extra(data, inst)
  expect_true(all(c("foo.bar", "foo") %in% df$name))
})

test_that("FIX B: dim_* de Monitoreo no cuenta en handoff, sí en manual", {
  inst <- .rv_fixture_inst_sm()
  data <- data.frame(
    edad = c(30, 40),
    dim_servicio = c("legal", "salud"),   # dim_* con dato, ajeno al instrumento
    check.names = FALSE, stringsAsFactors = FALSE
  )
  # Base con proveniencia de handoff: dim_* = plumbing -> NO extra.
  df_h <- .reconciliacion_variables_extra(data, inst, monitoreo_handoff = TRUE)
  expect_false("dim_servicio" %in% df_h$name)
  # Base manual: dim_* legítimo -> SÍ extra.
  df_m <- .reconciliacion_variables_extra(data, inst, monitoreo_handoff = FALSE)
  expect_true("dim_servicio" %in% df_m$name)
})
