# Vista previa de la hoja de ruta (ficha de una UMP) y hoja del día (U15, ADR 0116 §1).
# Sin red: marco INEI empaquetado y puntos de cartografía sembrados en la caché.

vp_muestra <- local({
  cache <- NULL
  function() {
    if (is.null(cache)) {
      cfg <- list(
        n_objetivo = 24, territorios = "070106", sampling_method = "pps", seed = 99,
        entrevistas_por_manzana = 6, replacements_per_titular = 1, route_jump_mode = "auto",
        sample_size = list(response_rate = 0.6)
      )
      sm <- hojas_ruta_sample_preview_integrado(cfg)
      cache <<- hojas_ruta_tamano_extras_salto_muestra(sm, cfg)
    }
    cache
  }
})

# Puntos sintéticos (uno por manzana de la muestra), en fila hacia el este.
vp_puntos <- function(sm) {
  ids <- c(vapply(sm$blocks, `[[`, character(1), "id_manzana"),
           vapply(sm$replacement_blocks, `[[`, character(1), "id_manzana"))
  data.frame(id_manzana = ids, lon = -77.10 + seq_along(ids) * 0.002, lat = -12.05, nse_nivel = "S/D",
             stringsAsFactors = FALSE)
}

# Una muestra «vieja»: sin visitas_esperadas ni regla (sorteada antes de U14a).
vp_sin_visitas <- function(sm) {
  quitar <- function(b) { b$visitas_esperadas <- NULL; b$regla_no_respuesta <- NULL; b }
  sm$blocks <- lapply(sm$blocks, quitar)
  sm$replacement_blocks <- lapply(sm$replacement_blocks, quitar)
  sm
}

vp_pdf_texto <- function(path) paste(pdftools::pdf_text(path), collapse = "\n")

test_that("la ficha encuentra titular y reemplazo, e imprime visitas esperadas y el procedimiento", {
  skip_if_not_installed("pdftools")
  sm <- vp_muestra()
  expect_true(isTRUE(sm$ok))
  tit <- sm$blocks[[1]]
  rpl <- sm$replacement_blocks[[1]]
  f_t <- hojas_ruta_vp_buscar_bloque(sm, tit$id_manzana)
  f_r <- hojas_ruta_vp_buscar_bloque(sm, rpl$id_manzana)
  expect_identical(f_t$tipo, "titular")
  expect_identical(f_r$tipo, "reemplazo")
  expect_null(hojas_ruta_vp_buscar_bloque(sm, "no-existe"))

  out <- hojas_ruta_ficha_ump(sm, f_t, tempfile(fileext = ".pdf"), "pdf")
  expect_identical(out$formato, "pdf")
  expect_true(file.exists(out$path))
  expect_gt(file.size(out$path), 1000)
  txt <- vp_pdf_texto(out$path)
  # Las visitas esperadas no van en la ficha (Gonzalo): son de planificación.
  expect_false(grepl("Visitas esperadas", txt, fixed = TRUE))
  # La ficha imprime el protocolo único ante la no respuesta, como la hoja del día.
  expect_match(txt, "Procedimiento ante la no respuesta", fixed = TRUE)
  expect_match(txt, "segunda vuelta", fixed = TRUE)
  expect_match(txt, "manzanas aledañas", fixed = TRUE)
  expect_false(grepl("manzana de reemplazo", txt, fixed = TRUE))
  expect_false(grepl("sistemático|elegible", txt))

  png_out <- hojas_ruta_ficha_ump(sm, f_r, tempfile(fileext = ".png"), "png")
  expect_identical(png_out$formato, "png")
  expect_true(file.exists(png_out$path))
  expect_gt(file.size(png_out$path), 1000)
  expect_identical(readBin(png_out$path, "raw", 4L), as.raw(c(0x89, 0x50, 0x4e, 0x47)))
})

test_that("la ficha imprime el salto sobre visitas, no floor(V/k)", {
  sm <- vp_muestra()
  b <- hojas_ruta_vp_buscar_bloque(sm, sm$blocks[[1]]$id_manzana)$block
  ops <- .hojas_ruta_route_operational_values(b, sm$config)
  ops2 <- .hojas_ruta_vp_ops_sobre_visitas(ops, b)
  expect_identical(ops2$constante_salto, as.integer(b$salto_operativo))
  expect_identical(ops2$constante_salto,
                   max(1L, as.integer(floor(as.numeric(b$viviendas) / b$visitas_esperadas))))
  # Muestra vieja o salto manual: no cambia nada.
  viejo <- b; viejo$visitas_esperadas <- NULL
  expect_identical(.hojas_ruta_vp_ops_sobre_visitas(ops, viejo), ops)
  manual <- ops; manual$constante_salto_modo <- "manual"
  expect_identical(.hojas_ruta_vp_ops_sobre_visitas(manual, b), manual)
})

test_that("una muestra sin visitas_esperadas no falla: la ficha sale sin franja", {
  skip_if_not_installed("pdftools")
  sm <- vp_sin_visitas(vp_muestra())
  f <- hojas_ruta_vp_buscar_bloque(sm, sm$blocks[[1]]$id_manzana)
  out <- hojas_ruta_ficha_ump(sm, f, tempfile(fileext = ".pdf"), "pdf")
  expect_gt(file.size(out$path), 1000)
  expect_false(grepl("Visitas esperadas", vp_pdf_texto(out$path), fixed = TRUE))
  # Y la hoja del día también sale, con la regla del protocolo y el aviso del salto.
  m <- hojas_ruta_hoja_dia_modelo(sm, "J01", list(), puntos = vp_puntos(sm))
  expect_false(m$visitas_declaradas)
  pdf <- hojas_ruta_hoja_dia_pdf(m, tempfile(fileext = ".pdf"))
  txt <- vp_pdf_texto(pdf)
  expect_match(txt, "Ante la no respuesta", fixed = TRUE)
  expect_match(txt, "sin visitas esperadas", fixed = TRUE)
})

test_that("hoja del día con una ruta y con muchas rutas", {
  skip_if_not_installed("pdftools")
  sm <- vp_muestra()
  puntos <- vp_puntos(sm)
  # Capacidad mínima: cada jornada lleva una sola ruta.
  m1 <- hojas_ruta_hoja_dia_modelo(sm, "J01", list(visitas_por_jornada = 1), puntos = puntos)
  expect_length(m1$rutas, 1L)
  expect_identical(m1$rutas[[1]]$visitas_esperadas, sm$blocks[[1]]$visitas_esperadas)
  expect_identical(m1$disposiciones, c("Completa", "Rechazo", "Ausente", "Desocupada", "No elegible"))
  p1 <- hojas_ruta_hoja_dia_pdf(m1, tempfile(fileext = ".pdf"))
  expect_identical(pdftools::pdf_info(p1)$pages, 1L)
  txt1 <- vp_pdf_texto(p1)
  for (d in m1$disposiciones) expect_match(txt1, d, fixed = TRUE)
  expect_match(txt1, "Hoja del día", fixed = TRUE)

  # Capacidad enorme: todo el distrito en una jornada, la grilla pagina.
  mm <- hojas_ruta_hoja_dia_modelo(sm, "J01", list(visitas_por_jornada = 10000), puntos = puntos)
  expect_identical(length(mm$rutas), length(sm$blocks))
  expect_identical(vapply(mm$rutas, `[[`, integer(1), "orden"), seq_along(mm$rutas))
  pm <- hojas_ruta_hoja_dia_pdf(mm, tempfile(fileext = ".pdf"))
  expect_gt(file.size(pm), 1000)
  expect_gte(pdftools::pdf_info(pm)$pages, if (length(mm$rutas) > 3L) 2L else 1L)
  # Cada ruta lleva su reemplazo en la tabla.
  expect_true(all(lengths(lapply(mm$rutas, `[[`, "reemplazos")) >= 1L))

  expect_null(hojas_ruta_hoja_dia_modelo(sm, "J99", list(), puntos = puntos))
})

vp_endpoint <- function(path) {
  pr <- mount_hojas_ruta_vista_previa(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  Find(function(e) identical(e$path, path), eps)
}

vp_llamar <- function(ep, sid, body) {
  res <- plumber:::PlumberResponse$new()
  out <- ep$getFunc()(
    req = list(HTTP_X_PULSO_SESSION = sid,
               bodyRaw = charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))),
    res = res
  )
  list(body = out, status = res$status)
}

test_that("HTTP: montado, errores 400/409/404 y artefactos registrados", {
  skip_if_not_installed("pdftools")
  expect_true(grepl("mount_hojas_ruta_vista_previa(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  ficha <- vp_endpoint("/api/hojas-ruta/ficha-ump")
  hoja <- vp_endpoint("/api/hojas-ruta/hoja-dia")
  expect_false(is.null(ficha)); expect_false(is.null(hoja))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  r <- vp_llamar(ficha, sid, list(id_manzana = "x", formato = "png"))
  expect_identical(r$status, 409); expect_identical(r$body$error$code, "E_NO_SAMPLE")
  r <- vp_llamar(hoja, sid, list(jornada = "J01"))
  expect_identical(r$status, 409); expect_identical(r$body$error$code, "E_NO_SAMPLE")
  r <- vp_llamar(ficha, sid, list(formato = "png"))
  expect_identical(r$status, 400); expect_identical(r$body$error$code, "E_BAD_REQUEST")
  r <- vp_llamar(ficha, sid, list(id_manzana = "x", formato = "docx"))
  expect_identical(r$status, 400)

  sm <- vp_muestra()
  .hojas_ruta_save_run(sid, "field", workspace_outputs = list(sample = sm))
  # Puntos sembrados en la caché de cartografía: el plan no lee disco ni red.
  ubigeo <- sprintf("%06s", "070106")
  assign(ubigeo, vp_puntos(sm), envir = .hojas_ruta_me_puntos_cache)
  on.exit(rm(list = ubigeo, envir = .hojas_ruta_me_puntos_cache), add = TRUE)

  r <- vp_llamar(ficha, sid, list(id_manzana = "no-existe", formato = "pdf"))
  expect_identical(r$status, 404); expect_identical(r$body$error$code, "E_NOT_FOUND")
  r <- vp_llamar(hoja, sid, list(jornada = "J99"))
  expect_identical(r$status, 404); expect_identical(r$body$error$code, "E_NOT_FOUND")

  files <- function() session_get(sid)$files
  expect_artefacto <- function(body, ext) {
    expect_true(isTRUE(body$ok))
    expect_true(nzchar(body$file_id %||% ""))
    meta <- files()[[body$file_id]]
    expect_false(is.null(meta))
    expect_identical(meta$original_name, body$filename)
    expect_true(file.exists(meta$path))
    expect_gt(meta$size, 1000L)
    expect_identical(tools::file_ext(body$filename), ext)
    # Fuera del .pulso: el artefacto vive en el tempdir de la sesión, no en el estado.
    expect_false(grepl("\\.pulso$", meta$path))
    expect_true(nzchar(digest::digest(file = meta$path, algo = "sha256")))
  }

  rep_id <- sm$replacement_blocks[[1]]$id_manzana
  r <- vp_llamar(ficha, sid, list(id_manzana = rep_id, formato = "png"))
  expect_identical(r$body$tipo, "reemplazo")
  expect_identical(r$body$formato, "png")
  expect_identical(r$body$id_manzana, rep_id)
  expect_artefacto(r$body, "png")
  expect_setequal(names(r$body), c("ok", "file_id", "filename", "formato", "id_manzana", "tipo"))

  r <- vp_llamar(ficha, sid, list(id_manzana = sm$blocks[[1]]$id_manzana, formato = "pdf"))
  expect_identical(r$body$tipo, "titular")
  expect_artefacto(r$body, "pdf")

  r <- vp_llamar(hoja, sid, list(jornada = "j01", supuestos = list(visitas_por_jornada = 40)))
  expect_identical(r$body$jornada, "J01")
  expect_true(length(r$body$rutas) >= 1L)
  expect_true(all(unlist(r$body$rutas) %in% vapply(sm$blocks, `[[`, character(1), "id_manzana")))
  expect_artefacto(r$body, "pdf")
  expect_setequal(names(r$body), c("ok", "file_id", "filename", "jornada", "rutas"))
  # La vista previa no guarda nada en el run.
  expect_identical(length(.hojas_ruta_active_run(sid)$run$workspace_outputs$sample$blocks), length(sm$blocks))
})

test_that("la grilla de la hoja del día sale de las visitas con margen, numerada y sin partes (revisión U15)", {
  skip_if_not_installed("pdftools")
  sm <- vp_muestra()
  puntos <- vp_puntos(sm)
  m <- hojas_ruta_hoja_dia_modelo(sm, "J01", list(visitas_por_jornada = 10000), puntos = puntos)
  r1 <- m$rutas[[1]]
  k <- r1$entrevistas
  expect_identical(r1$visitas_cap, as.integer(hojas_ruta_visitas_cap(k, 0.6, 1)))
  expect_identical(r1$columnas, min(30L, r1$visitas_cap))
  expect_null(r1$parte)
  # Las metas suman el N de la jornada: ninguna ruta se cuenta dos veces.
  expect_identical(sum(vapply(m$rutas, `[[`, integer(1), "entrevistas")), sum(vapply(m$rutas, function(r) as.integer(r$entrevistas), integer(1))))
  txt <- vp_pdf_texto(hojas_ruta_hoja_dia_pdf(m, tempfile(fileext = ".pdf")))
  expect_false(grepl("«+»", txt, fixed = TRUE))
  expect_match(txt, "Columnas sombreadas", fixed = TRUE)
  # Una ruta que excede la jornada lo dice en su meta.
  m1 <- hojas_ruta_hoja_dia_modelo(sm, "J01", list(visitas_por_jornada = 2), puntos = puntos)
  expect_true(m1$rutas[[1]]$excede_jornada)
  expect_match(vp_pdf_texto(hojas_ruta_hoja_dia_pdf(m1, tempfile(fileext = ".pdf"))), "mismo encuestador", fixed = TRUE)
})

test_that("con respuesta total la grilla tiene k columnas; con respuesta muy baja se trunca y lo avisa", {
  expect_identical(hojas_ruta_visitas_cap(8L, 1, 1), 8L)
  expect_gt(hojas_ruta_visitas_cap(8L, 0.05, 1), 30L)
})

test_that("registrar la vista previa no deja el proyecto «sin guardar» (brecha B0)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid); s$project_path <- tempfile(fileext = ".pulso"); s$project_dirty <- FALSE; .session_env[[sid]] <- s
  f <- tempfile(fileext = ".png"); writeBin(as.raw(1:10), f)
  meta <- .hojas_ruta_vp_registrar(sid, "hojas_ruta_ficha_ump", f, "ficha.png")
  expect_true(nzchar(meta$file_id))
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_false(is.null(session_get(sid)$files[[meta$file_id]]))
})
