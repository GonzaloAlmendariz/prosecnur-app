# Catálogo › Tipos de Material de campo (ADR 0109 E1a).
#
# El catálogo dice qué materiales sabe hacer la app, si encajan con el plan
# vigente y cuál es el activo; la miniatura sale del MISMO compilador grid del
# PDF, compilada contra una unidad de prueba y nunca contra el plan real.

.cmcat_sid_con_plan <- function() {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "sel-cat", operational_code = "CH 1",
      classroom_id = "mat202_0591", label = "mat202_0591", wave = "M1",
      faculty = "CIENCIAS E INGENIERIA", sample_role = "titular"
    )
  ))
  seeded <- collection_state_seed(sid)
  collection_material_template_put(
    sid, template = collection_material_field_sheet_template(),
    expected_revision = seeded$state$state_revision
  )
  sid
}

.cmcat_por_id <- function(catalogo) {
  setNames(catalogo$presets, vapply(catalogo$presets, `[[`, "", "preset_id"))
}

.cmcat_png <- function(preview) jsonlite::base64_dec(preview$png_base64)

test_that("el GET lista los tres presets con sus campos declarados", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  cat <- collection_material_catalog_get(sid)
  expect_identical(cat$schema, "collection_material_catalog/v1")
  ids <- vapply(cat$presets, `[[`, "", "preset_id")
  expect_identical(ids, c("ficha_aplicacion_a4_v1", "ficha_campo_qr_a4_v1", "afiche_qr_a4_v1"))
  campos <- c("preset_id", "title", "family", "material_kind", "pages_per_unit",
              "orientation", "faces", "copies_per", "compatible_unit_types",
              "compatible", "blocks_count", "active", "paper", "template")
  for (p in cat$presets) expect_setequal(names(p), campos)
  # La receta viaja válida, para que «Usar este tipo» la fije con el PUT de siempre.
  for (p in cat$presets) {
    expect_identical(p$template$schema, "collection_material_template/v1")
    expect_identical(p$template$preset_id, p$preset_id)
    expect_identical(p$paper, "A4")
  }

  por_id <- .cmcat_por_id(cat)
  expect_identical(por_id$ficha_aplicacion_a4_v1$title, "Ficha de aula con QR")
  expect_identical(por_id$ficha_campo_qr_a4_v1$title, "Ficha de campo con croquis")
  expect_identical(por_id$afiche_qr_a4_v1$title, "Afiche QR")
  expect_identical(por_id$afiche_qr_a4_v1$family, "va_al_participante")
  expect_identical(por_id$ficha_aplicacion_a4_v1$family, "identifica_unidad")
  expect_identical(por_id$afiche_qr_a4_v1$material_kind, "access_poster")
  # La ficha de campo lleva el croquis al dorso: dos páginas, una hoja a dos caras.
  expect_identical(por_id$ficha_campo_qr_a4_v1$pages_per_unit, 2L)
  expect_identical(por_id$ficha_campo_qr_a4_v1$faces, 2L)
  expect_identical(por_id$ficha_aplicacion_a4_v1$faces, 1L)
  for (p in cat$presets) {
    expect_identical(p$orientation, "portrait")
    expect_identical(p$copies_per, "unidad")
    expect_true(is.integer(p$blocks_count) && p$blocks_count > 0L)
  }
})

test_that("sin plan: todos compatibles por aulas y activo el de la plantilla built-in", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  por_id <- .cmcat_por_id(collection_material_catalog_get(sid))
  expect_true(all(vapply(por_id, `[[`, NA, "compatible")))
  activos <- names(Filter(function(p) isTRUE(p$active), por_id))
  expect_identical(activos, "ficha_aplicacion_a4_v1")
})

test_that("con plan de aulas: activo sigue a la plantilla vigente", {
  sid <- .cmcat_sid_con_plan(); on.exit(session_delete(sid), add = TRUE)
  por_id <- .cmcat_por_id(collection_material_catalog_get(sid))
  expect_true(all(vapply(por_id, `[[`, NA, "compatible")))
  activos <- names(Filter(function(p) isTRUE(p$active), por_id))
  expect_identical(activos, "ficha_campo_qr_a4_v1")
})

test_that("un plan con otro tipo de unidad deja los tres incompatibles", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  testthat::local_mocked_bindings(
    .collection_current = function(s) list(plan = list(unit_type = "manzana")),
    .package = "prosecnurapp"
  )
  por_id <- .cmcat_por_id(collection_material_catalog_get(sid))
  expect_false(any(vapply(por_id, `[[`, NA, "compatible")))
})

test_that("el preview devuelve un PNG real, vertical, del tamaño A4 a 90 dpi", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  for (preset in c("ficha_aplicacion_a4_v1", "ficha_campo_qr_a4_v1", "afiche_qr_a4_v1")) {
    pv <- collection_material_catalog_preview(sid, preset)
    bytes <- .cmcat_png(pv)
    expect_identical(bytes[1:8], as.raw(c(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), info = preset)
    expect_identical(pv$preset_id, preset)
    expect_identical(pv$page, 1L)
    # Portrait: más alto que ancho, y el ancho es el de A4 a ~90 dpi.
    expect_true(pv$height > pv$width, info = preset)
    expect_true(abs(pv$width - round(8.27 * 90)) <= 2L, info = preset)
  }
  dorso <- collection_material_catalog_preview(sid, "ficha_campo_qr_a4_v1", page = 2L)
  expect_identical(dorso$pages, 2L)
  expect_false(identical(dorso$png_base64,
                         collection_material_catalog_preview(sid, "ficha_campo_qr_a4_v1")$png_base64))
})

test_that("el preview es determinista y se sirve del caché de la sesión", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_material_catalog_preview(sid, "ficha_aplicacion_a4_v1")
  cache <- list.files(file.path(session_get(sid)$dir, "material_catalog"), pattern = "\\.png$")
  expect_length(cache, 1L)
  expect_match(cache, "^ficha_aplicacion_a4_v1_[a-f0-9]{16}_p1\\.png$")
  # La segunda vez no compila: si lo hiciera, el mock reventaría.
  testthat::local_mocked_bindings(
    collection_material_render_compiled = function(...) stop("no debía recompilar"),
    .package = "prosecnurapp"
  )
  b <- collection_material_catalog_preview(sid, "ficha_aplicacion_a4_v1")
  expect_identical(a$png_base64, b$png_base64)
})

test_that("el preview no usa el plan real: unidad sintética y mismos bytes que sin plan", {
  sid_plan <- .cmcat_sid_con_plan(); on.exit(session_delete(sid_plan), add = TRUE)
  sid_vacia <- session_create(); on.exit(session_delete(sid_vacia), add = TRUE)

  vistos <- list()
  original <- collection_material_compile
  testthat::local_mocked_bindings(
    collection_material_compile = function(template, instance, project, plan, deployment, ...) {
      vistos[[length(vistos) + 1L]] <<- list(project = project, plan = plan, deployment = deployment)
      original(template, instance, project, plan, deployment, ...)
    },
    .package = "prosecnurapp"
  )
  con_plan <- collection_material_catalog_preview(sid_plan, "ficha_aplicacion_a4_v1")
  expect_length(vistos, 1L)
  visto <- vistos[[1]]
  expect_identical(visto$plan$units[[1]]$dimensions$legacy_ref, "CH 014")
  expect_identical(visto$plan$units[[1]]$dimensions$course_name, "Curso de ejemplo")
  expect_identical(visto$plan$units[[1]]$dimensions$teacher, "Docente de ejemplo")
  expect_identical(visto$deployment$bindings[[1]]$access_ref,
                   "https://ee.kobotoolbox.org/x/ejemplo?d[collectorID]=CH014")
  todo <- paste(unlist(visto), collapse = " ")
  expect_false(grepl("mat202_0591|CH 1\\b|CIENCIAS", todo))

  sin_plan <- collection_material_catalog_preview(sid_vacia, "ficha_aplicacion_a4_v1")
  expect_identical(con_plan$png_base64, sin_plan$png_base64)
})

test_that("preset desconocido y página fuera de rango responden E_* 422", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  err <- tryCatch(collection_material_catalog_preview(sid, "volante_a5"), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PRESET_UNKNOWN")
  expect_identical(as.integer(err$status), 422L)

  err <- tryCatch(collection_material_catalog_preview(sid, NULL), error = function(e) e)
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PRESET_UNKNOWN")

  err <- tryCatch(collection_material_catalog_preview(sid, "afiche_qr_a4_v1", page = 2L),
                  error = function(e) e)
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_PAGE")
  expect_identical(as.integer(err$status), 422L)
  err <- tryCatch(collection_material_catalog_preview(sid, "afiche_qr_a4_v1", page = 0L),
                  error = function(e) e)
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_PAGE")
})

# Contrato HTTP: las dos rutas montadas tal como las sirve Plumber.
.cmcat_call <- function(sid, method, path, body = "") {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_recopiladores(plumber::pr())
  raw_body <- charToRaw(body)
  input <- list(
    read = function(...) raw_body, rewind = function() invisible(0),
    read_lines = function(...) body
  )
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = "",
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: GET del catálogo y POST del preview responden el contrato", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  g <- .cmcat_call(sid, "GET", "/api/recopiladores/material-catalog")
  expect_identical(g$status, 200L)
  expect_identical(unlist(g$body$schema), "collection_material_catalog/v1")
  expect_length(g$body$presets, 3L)

  p <- .cmcat_call(sid, "POST", "/api/recopiladores/material-catalog/preview",
                   '{"preset_id":"ficha_campo_qr_a4_v1","page":2}')
  expect_identical(p$status, 200L)
  expect_identical(as.integer(unlist(p$body$page)), 2L)
  bytes <- jsonlite::base64_dec(unlist(p$body$png_base64))
  expect_identical(bytes[2:4], charToRaw("PNG"))

  e <- .cmcat_call(sid, "POST", "/api/recopiladores/material-catalog/preview",
                   '{"preset_id":"no_existe"}')
  expect_identical(e$status, 422L)
  expect_match(paste(unlist(e$body), collapse = " "), "E_COLLECTION_MATERIAL_PRESET_UNKNOWN")
})
