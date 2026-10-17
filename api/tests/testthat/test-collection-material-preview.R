# Vista de la página real del editor de materiales (ADR 0109 E1b).
#
# POST /api/recopiladores/material-template/preview compila la cara pedida con
# el borrador de la receta y una unidad del plan. Es una lectura: no escribe
# collection_state, no deja archivos fuera de session$dir y no saca datos de la
# unidad en el JSON (el docente, el aula y el curso viajan solo en la imagen).

.cmpv_filas <- function() {
  list(
    # La primera fila es un reemplazo: la vista por defecto tiene que saltarla
    # y tomar la primera TITULAR.
    list(
      selection_run_id = "sel-vista", classroom_id = "B-09", operational_code = "R 1.1",
      label = "fis101_0301", wave = "M1", faculty = "CIENCIAS", course_id = "Fisica 1",
      schedule = "10:00", venue = "B101", teacher = "Docente Reemplazo Dos", eligible_n = 25,
      sample_role = "chain_reserve",
      link = "https://kf.kobotoolbox.org/x/asset?d%5BcollectorID%5D=R11"
    ),
    list(
      selection_run_id = "sel-vista", classroom_id = "A-01", operational_code = "CH 1",
      label = "mat202_0591", wave = "M1", faculty = "INGENIERIA EJEMPLAR", course_id = "Calculo Uno",
      schedule = "08:00", venue = "A201", teacher = "Docente Titular Uno", eligible_n = 32,
      sample_role = "titular",
      link = "https://kf.kobotoolbox.org/x/asset?d%5BcollectorID%5D=CH1"
    )
  )
}

.cmpv_sid <- function(plan = TRUE) {
  sid <- session_create()
  if (plan) {
    session_set(sid, "monitoreo_aulas_plan", .cmpv_filas())
    collection_state_seed(sid)
  }
  sid
}

.cmpv_err <- function(expr) tryCatch(expr, error = function(e) e)

.cmpv_unidad <- function(sid, code) {
  units <- .collection_current(session_get(sid))$plan$units
  Filter(function(u) identical(u$dimensions$legacy_ref, code), units)[[1]]
}

test_that("con plan: la primera titular, el enlace real del despliegue y el PNG de la cara", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_material_template_preview(sid)
  expect_identical(r$schema, "collection_material_preview/v1")
  expect_false(r$draft)
  expect_identical(r$unit$source, "plan")
  expect_identical(r$unit$label, "CH 1")
  expect_identical(r$unit$unit_id, .cmpv_unidad(sid, "CH 1")$unit_id)
  expect_identical(r$access$source, "deployment")
  expect_identical(r$page, 1L)
  expect_identical(r$pages, 1L)
  expect_identical(r$layout_preset, "single_sheet")
  expect_identical(r$page_mm, list(w = 210, h = 297))
  expect_identical(r$dpi, 90L)
  bytes <- jsonlite::base64_dec(r$png_base64)
  expect_identical(bytes[2:4], charToRaw("PNG"))
  expect_true(abs(r$width - round(8.27 * 90)) <= 2L)
  expect_true(r$height > r$width)
  expect_identical(r$cache, "miss")
  expect_true(is.integer(r$elapsed_ms) && r$elapsed_ms >= 0L)
  expect_length(r$faces, 1L)
  expect_identical(r$faces[[1]]$blocks, length(collection_material_builtin_template()$pages[[1]]$blocks))
  # La careta de texto no la dibuja la ficha de aula.
  expect_identical(r$undrawn, list(list(block_id = "brand", type = "brand_header", reason = "not_drawn_by_layout")))
  por_id <- setNames(r$zones, vapply(r$zones, function(z) if (is.na(z$block_id)) z$type else z$block_id, ""))
  expect_setequal(names(por_id), c("unit", "qr", "course", "details", "link", "rule", "log", "footer"))
  expect_identical(por_id$link$kind, "derived")
  expect_identical(por_id$link$fills_from, list("access.qr_payload"))
  expect_true(por_id$details$reorderable)
  expect_false(por_id$qr$reorderable)
  expect_identical(por_id$qr$editable, list("correction"))
  expect_identical(por_id$course$fills_from, list("unit.course_name"))
  expect_identical(por_id$unit$fills_from, list("unit.operational_code", "unit.faculty"))
  for (z in r$zones) {
    expect_true(all(unlist(z$bbox) >= 0 & unlist(z$bbox) <= 1), info = z$type)
    expect_equal(z$bbox_mm$w, round(z$bbox$w * 210, 1), tolerance = 0.11)
  }
  # En orden de lectura: la cabecera primero, el pie al final.
  expect_identical(r$zones[[1]]$block_id, "unit")
  expect_identical(r$zones[[length(r$zones)]]$type, "footer")
})

test_that("con unit_id: dibuja esa unidad; desconocida, 404", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  reemplazo <- .cmpv_unidad(sid, "R 1.1")
  r <- collection_material_template_preview(sid, unit_id = reemplazo$unit_id)
  expect_identical(r$unit$label, "R 1.1")
  expect_false(identical(r$png_base64, collection_material_template_preview(sid)$png_base64))
  err <- .cmpv_err(collection_material_template_preview(sid, unit_id = "unidad-que-no-existe"))
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_UNIT")
  expect_identical(as.integer(err$status), 404L)
})

test_that("sin plan: unidad y enlace de ejemplo", {
  sid <- .cmpv_sid(plan = FALSE); on.exit(session_delete(sid), add = TRUE)
  r <- collection_material_template_preview(sid)
  expect_identical(r$unit$source, "ejemplo")
  expect_identical(r$unit$label, "CH 014")
  expect_identical(r$access$source, "ejemplo")
  err <- .cmpv_err(collection_material_template_preview(sid, unit_id = "u1"))
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_UNIT")
})

test_that("accesos: sin despliegue o restringido va el de ejemplo; unidad sin enlace, sin_enlace", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  real <- .collection_current(session_get(sid))
  con <- function(state) {
    testthat::local_mocked_bindings(.collection_current = function(s) state, .package = "prosecnurapp")
    collection_material_template_preview(sid)$access$source
  }
  sin_dep <- real; sin_dep$deployment <- NULL
  expect_identical(con(sin_dep), "ejemplo")
  restringido <- real; restringido$deployment$sensitivity$access_urls <- "restricted"
  expect_identical(con(restringido), "ejemplo")
  otra <- real
  titular <- .cmpv_unidad(sid, "CH 1")$unit_id
  otra$deployment$bindings <- Filter(function(b) !identical(b$unit_id, titular), real$deployment$bindings)
  expect_identical(con(otra), "sin_enlace")
})

test_that("no escribe estado ni deja archivos fuera del caché de la sesión", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  antes <- session_get(sid)
  archivos_antes <- list.files(antes$dir, recursive = TRUE, all.files = TRUE)
  collection_material_template_preview(sid)
  collection_material_template_preview(sid, page = 2L, template = collection_material_field_sheet_template())
  despues <- session_get(sid)
  expect_identical(despues$collection_state, antes$collection_state)
  expect_identical(despues$project_dirty, antes$project_dirty)
  expect_identical(despues$files, antes$files)
  nuevos <- setdiff(list.files(despues$dir, recursive = TRUE, all.files = TRUE), archivos_antes)
  expect_gt(length(nuevos), 0L)
  expect_true(all(startsWith(nuevos, "material_preview/")), info = paste(nuevos, collapse = ", "))
  expect_true(all(grepl("^material_preview/[a-f0-9]{16}_[a-f0-9]{16}_p[0-9]+_(72|90|150)\\.(png|json)$", nuevos)),
              info = paste(nuevos, collapse = ", "))
})

test_that("el JSON no lleva valores de la unidad: solo el código operativo", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  for (pg in 1:2) {
    r <- collection_material_template_preview(sid, page = pg, template = collection_material_field_sheet_template())
    r$png_base64 <- NULL
    texto <- as.character(jsonlite::toJSON(r, auto_unbox = TRUE, null = "null", na = "null"))
    for (dato in c("Docente Titular Uno", "Calculo Uno", "A201", "INGENIERIA EJEMPLAR", "mat202_0591", "kobotoolbox")) {
      expect_false(grepl(dato, texto, fixed = TRUE), info = paste(pg, dato))
    }
    expect_true(grepl("CH 1", texto, fixed = TRUE))
  }
})

test_that("el borrador inválido responde 422 con la cara y el bloque del problema", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_material_field_sheet_template()
  t$pages[[2]]$blocks[[1]]$binding <- "unit.teacher"
  err <- .cmpv_err(collection_material_template_preview(sid, page = 2L, template = t))
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_MATERIAL_TEMPLATE_INVALID")
  expect_identical(as.integer(err$status), 422L)
  p <- Filter(function(x) identical(x$code, "campus_map_binding_protected"), err$details$problems)
  expect_length(p, 1L)
  expect_identical(p[[1]]$page, 2L)
  expect_identical(p[[1]]$page_id, "croquis")
  expect_identical(p[[1]]$block_id, "croquis")
  expect_match(p[[1]]$path, "^template\\.pages\\[2\\]\\.blocks\\[1\\]")
  expect_true(nzchar(p[[1]]$detail))

  err <- .cmpv_err(collection_material_template_preview(sid, template = "no soy una receta"))
  expect_identical(err$code, "E_COLLECTION_MATERIAL_TEMPLATE_INVALID")
  expect_identical(err$details$problems[[1]]$code, "not_object")
})

test_that("página fuera de rango 422, dpi fuera de lo admitido 422, sin device PNG 503", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  err <- .cmpv_err(collection_material_template_preview(sid, page = 2L))
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_PAGE")
  expect_identical(as.integer(err$status), 422L)
  err <- .cmpv_err(collection_material_template_preview(sid, page = 0L))
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_PAGE")
  err <- .cmpv_err(collection_material_template_preview(sid, dpi = 300))
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_DPI")
  expect_identical(as.integer(err$status), 422L)
  expect_identical(collection_material_template_preview(sid, dpi = 72L)$dpi, 72L)
  testthat::local_mocked_bindings(.cmv_png_disponible = function() FALSE, .package = "prosecnurapp")
  err <- .cmpv_err(collection_material_template_preview(sid))
  expect_identical(err$code, "E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE")
  expect_identical(as.integer(err$status), 503L)
})

test_that("la ficha de campo muestra el dorso con el croquis", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_material_field_sheet_template()
  r <- collection_material_template_preview(sid, page = 2L, template = t)
  expect_true(r$draft)
  expect_identical(r$pages, 2L)
  expect_identical(r$page_id, "croquis")
  expect_identical(r$layout_preset, "croquis_campus")
  expect_identical(vapply(r$faces, `[[`, "", "layout_preset"), c("field_form", "croquis_campus"))
  tipos <- vapply(r$zones, `[[`, "", "type")
  expect_setequal(tipos, c("campus_map", "footer"))
  mapa <- r$zones[[which(tipos == "campus_map")]]
  expect_identical(mapa$fills_from, list("unit.venue"))
  expect_identical(mapa$editable, list())
  expect_identical(r$template_sha256, .cm_template_normalize(t)$template_sha256)
})

test_that("la segunda llamada sale del caché y el caché poda a las más viejas", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  a <- collection_material_template_preview(sid)
  expect_identical(a$cache, "miss")
  testthat::local_mocked_bindings(
    collection_material_render_compiled = function(...) stop("no debía volver a dibujar"),
    .package = "prosecnurapp"
  )
  b <- collection_material_template_preview(sid)
  expect_identical(b$cache, "hit")
  expect_identical(a$png_base64, b$png_base64)
  quitar <- function(x) { x$cache <- NULL; x$elapsed_ms <- NULL; x }
  expect_identical(quitar(a), quitar(b))

  dir <- file.path(session_get(sid)$dir, "material_preview")
  for (i in 1:4) {
    base <- file.path(dir, sprintf("%016d_%016d_p1_90", i, i))
    writeBin(as.raw(i), paste0(base, ".png")); writeLines("{}", paste0(base, ".json"))
    Sys.setFileTime(c(paste0(base, ".png"), paste0(base, ".json")), Sys.time() - (10 - i) * 60)
  }
  prosecnurapp:::.cmv_podar_cache(dir, max = 3L)
  quedan <- list.files(dir, pattern = "\\.png$")
  expect_length(quedan, 3L)
  # La recién servida sobrevive; las dos más viejas de relleno se fueron con su JSON.
  expect_true(any(startsWith(quedan, substr(gsub("[^a-f0-9]", "", sub("^sha256:", "", a$template_sha256)), 1, 16))))
  expect_false(file.exists(file.path(dir, sprintf("%016d_%016d_p1_90.json", 1, 1))))
})

# Contrato HTTP con el serializador de producción.
.cmpv_call <- function(sid, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  raw_body <- charToRaw(body)
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = "POST", PATH_INFO = "/api/recopiladores/material-template/preview",
    QUERY_STRING = "", CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status), raw = as.character(r$body),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: la ruta responde el contrato, con null en los bloques derivados", {
  sid <- .cmpv_sid(); on.exit(session_delete(sid), add = TRUE)
  ok <- .cmpv_call(sid, '{"page":1}')
  expect_identical(ok$status, 200L, info = substr(ok$raw, 1, 400))
  expect_identical(ok$body$schema, "collection_material_preview/v1")
  campos <- c("schema", "draft", "template_sha256", "page", "pages", "page_id", "layout_preset",
              "orientation", "paper", "page_mm", "dpi", "width", "height", "png_base64", "faces",
              "unit", "access", "zones", "undrawn", "warnings", "cache", "elapsed_ms")
  expect_setequal(names(ok$body), campos)
  link <- Filter(function(z) identical(z$type, "link"), ok$body$zones)[[1]]
  expect_null(link$block_id)
  expect_match(ok$raw, '"block_id":null', fixed = TRUE)
  expect_match(ok$raw, '"editable":[]', fixed = TRUE)
  expect_setequal(names(ok$body$zones[[1]]), c("block_id", "type", "kind", "bbox", "bbox_mm",
                                                "editable", "reorderable", "fills_from"))

  # El borrador viaja como lo serializa el frontend y vuelve con draft = true.
  body <- jsonlite::toJSON(list(page = 2L, template = .cmc_drop_nulls_deep(collection_material_field_sheet_template())),
                           auto_unbox = TRUE, null = "null", na = "null", digits = NA)
  dorso <- .cmpv_call(sid, as.character(body))
  expect_identical(dorso$status, 200L, info = substr(dorso$raw, 1, 400))
  expect_true(dorso$body$draft)
  expect_identical(dorso$body$page_id, "croquis")

  no <- .cmpv_call(sid, '{"page":1,"unit_id":"no-existe"}')
  expect_identical(no$status, 404L)
  expect_match(no$raw, "E_COLLECTION_MATERIAL_PREVIEW_UNIT", fixed = TRUE)
})
