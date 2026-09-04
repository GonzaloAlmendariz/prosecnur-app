# La ficha impresa obedece al aula CONFIRMADA en el Sheets.
#
# Pregunta de Gonzalo (2026-09-03): «¿qué pasa cuando desde el Sheets ya se
# confirma el pabellón también?». Hasta hoy: nada. La columna LUGAR DE
# APLICACIÓN (`scheduled_venue`, B30) ya la prefieren ocho superficies —el
# libro y sus hojas, la fusión, la asignación, el Plan del día y la Carga en
# la app— y Recopiladores era la única que seguía imprimiendo el aula del
# catálogo del curso.
#
# Es el peor sitio para ignorarla: la ficha es el papel que el aplicador
# lleva en la mano, y su verso resalta el pabellón en el croquis del campus.
# Con el aula vieja, la hoja manda a alguien al edificio equivocado.
#
# Precedencia idéntica a la del Plan del día (`.capd_sesiones_y_aula`): el
# confirmado MANDA cuando existe; sin él se cae al catálogo, que es lo que se
# sabía al sortear.

.cvc_unidades <- function(sid) {
  collection_state_seed(sid)$plan$units
}

.cvc_venue <- function(unit) {
  dims <- if (is.list(unit$dimensions)) unit$dimensions else list()
  as.character(dims$venue %||% "")[1]
}

.cvc_sembrar <- function(filas) {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", filas)
  sid
}

.cvc_fila <- function(...) {
  base <- list(
    selection_run_id = "sel-venue", operational_code = "CH 1", classroom_id = "CH 1",
    label = "CH 1", wave = "M1", faculty = "Ingeniería",
    link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=CH1"
  )
  utils::modifyList(base, list(...))
}

test_that("el aula confirmada en el Sheets manda sobre la del catálogo", {
  sid <- .cvc_sembrar(list(.cvc_fila(
    pabellon_aula = "H404", scheduled_venue = "A206"
  )))
  on.exit(session_delete(sid), add = TRUE)
  # El equipo pactó A206 con el docente aunque la clase figure en H404: es a
  # A206 adonde va el aplicador, y es lo que la ficha tiene que decir.
  expect_identical(.cvc_venue(.cvc_unidades(sid)[[1]]), "A206")
})

test_that("sin confirmar, la ficha sigue diciendo lo que sabe el catálogo", {
  sid <- .cvc_sembrar(list(.cvc_fila(pabellon_aula = "H404")))
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.cvc_venue(.cvc_unidades(sid)[[1]]), "H404")

  # Un confirmado vacío o en blanco no pisa al catálogo: «sin teclear» no es
  # una confirmación de que no hay aula.
  sid2 <- .cvc_sembrar(list(.cvc_fila(pabellon_aula = "H404", scheduled_venue = "   ")))
  on.exit(session_delete(sid2), add = TRUE)
  expect_identical(.cvc_venue(.cvc_unidades(sid2)[[1]]), "H404")
})

test_that("un reemplazo activado también obedece a su aula confirmada", {
  # La cadena de reemplazos es donde más cambia el lugar: el titular no
  # accede, entra R 1.1 y el equipo pacta OTRA aula con el nuevo docente.
  sid <- .cvc_sembrar(list(
    .cvc_fila(operational_code = "CH 7", classroom_id = "CH 7", label = "CH 7",
              pabellon_aula = "Z412"),
    .cvc_fila(operational_code = "R 7.1", classroom_id = "R 7.1", label = "R 7.1",
              sample_role = "chain_reserve", replacement_for = "CH 7",
              replacement_order = 1, pabellon_aula = "L104",
              scheduled_venue = "Y303")
  ))
  on.exit(session_delete(sid), add = TRUE)
  units <- .cvc_unidades(sid)
  venues <- vapply(units, .cvc_venue, character(1))
  expect_true("Z412" %in% venues)   # el titular, sin confirmar, conserva el suyo
  expect_true("Y303" %in% venues)   # el reemplazo va al aula pactada, no a L104
  expect_false("L104" %in% venues)
})

test_that("el croquis del verso resalta el pabellón CONFIRMADO, no el del catálogo", {
  skip_if_not_installed("png")
  # El verso hereda el mismo binding `unit.venue`, así que la confirmación
  # tiene que llegar hasta el anillo del croquis. Si el catálogo decía H y el
  # equipo pactó A, el resaltado es A: mandar al aplicador al edificio
  # equivocado es el defecto que esta hoja existe para evitar.
  sid <- .cvc_sembrar(list(.cvc_fila(pabellon_aula = "H404", scheduled_venue = "A206")))
  on.exit(session_delete(sid), add = TRUE)
  seeded <- collection_state_seed(sid)
  unit_id <- seeded$plan$units[[1]]$unit_id
  binding <- seeded$deployment$bindings[[1]]

  template <- collection_material_field_sheet_template()
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m-venue",
    template_ref = list(template_id = template$template_id, revision = 1L,
                        sha256 = template$template_sha256),
    deployment_id = seeded$deployment$deployment_id,
    deployment_fingerprint = fp(seeded$deployment),
    access_fingerprint = fp(seeded$deployment$bindings),
    instance_fingerprint = fp("m-venue"),
    unit_refs = list(unit_id), access_refs = list(binding$access_id),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  compiled <- collection_material_compile(
    template, instance, project = list(name = "HSVG", period = "Set 2026"),
    plan = seeded$plan, deployment = seeded$deployment
  )
  dir <- tempfile("cvc-"); dir.create(dir)
  png_path <- file.path(dir, "verso.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 2L, dpi = 110)

  img <- png::readPNG(png_path)
  pab <- prosecnurapp:::.ccx_pabellones()
  L <- prosecnurapp:::.ccx_layout()
  paleta <- prosecnurapp:::.ccx_paleta_tonos()
  muestra <- function(letra) {
    fila <- pab[pab$letra == letra, , drop = FALSE][1, ]
    p <- prosecnurapp:::.ccx_proyectar(fila$lat, fila$lng, L)
    x <- p$x + L$lado_pabellon * 0.30
    f <- max(1L, min(nrow(img), as.integer(round((1 - p$y) * nrow(img)))))
    c <- max(1L, min(ncol(img), as.integer(round(x * ncol(img)))))
    vapply(1:3, function(k) stats::median(img[max(1L, f - 2L):min(nrow(img), f + 2L),
                                              max(1L, c - 2L):min(ncol(img), c + 2L), k]), numeric(1))
  }
  steel <- grDevices::col2rgb(paleta[[1L]])[, 1] / 255   # A = tono 0
  pixel_a <- muestra("A")
  expect_true(all(abs(pixel_a - steel) <= 0.12),
              info = sprintf("interior de A = (%.3f, %.3f, %.3f)", pixel_a[1], pixel_a[2], pixel_a[3]))
  # Y la H del catálogo queda en trazo suave: la confirmación no resalta dos.
  expect_gt(mean(muestra("H")), 0.8)
})

test_that("el título de la ficha no contradice al aula confirmada", {
  # Medido en la demo de la cadena CH 141: el campo decía «PABELLÓN Y AULA:
  # A206» (lo confirmado) y el título, dos centímetros más arriba, «CH 141
  # VIE 10:00-13:00 N502» — el aula VIEJA, incrustada dentro del rótulo de
  # sesiones que trae el plan. La misma hoja diciendo dos aulas distintas es
  # peor que no decir ninguna: quien la sostiene no sabe a cuál creerle.
  #
  # El aula sale del título cuando quedó desmentida; el campo la sigue
  # imprimiendo, que es su sitio.
  sid <- .cvc_sembrar(list(.cvc_fila(
    operational_code = "CH 141", label = "VIE 10:00-13:00 N502",
    pabellon_aula = "N502", scheduled_venue = "A206"
  )))
  on.exit(session_delete(sid), add = TRUE)
  unit <- .cvc_unidades(sid)[[1]]
  contexto <- prosecnurapp:::.crf_unit_context(unit)

  expect_identical(contexto$venue, "A206")
  expect_false(grepl("N502", contexto$codigo_ficha, fixed = TRUE))
  # El título quedó en código + PABELLÓN por la poda del 2026-09-03 («¿cuál es
  # la razón por la cual debajo del QR está el horario del curso?»), así que
  # la contradicción se resuelve sola: el aula del título ES la confirmada.
  expect_match(contexto$codigo_ficha, "CH 141", fixed = TRUE)
  expect_match(contexto$codigo_ficha, "A206", fixed = TRUE)
  expect_false(grepl("VIE", contexto$codigo_ficha, fixed = TRUE))
})

test_that("sin confirmación el título conserva el aula del catálogo", {
  # No se toca lo que nadie desmintió: el rótulo de siempre.
  sid <- .cvc_sembrar(list(.cvc_fila(
    operational_code = "CH 141", label = "VIE 10:00-13:00 N502", pabellon_aula = "N502"
  )))
  on.exit(session_delete(sid), add = TRUE)
  contexto <- prosecnurapp:::.crf_unit_context(.cvc_unidades(sid)[[1]])
  expect_match(contexto$codigo_ficha, "N502", fixed = TRUE)
})

test_that("confirmar la MISMA aula no altera el título", {
  sid <- .cvc_sembrar(list(.cvc_fila(
    operational_code = "CH 141", label = "VIE 10:00-13:00 N502",
    pabellon_aula = "N502", scheduled_venue = "N502"
  )))
  on.exit(session_delete(sid), add = TRUE)
  contexto <- prosecnurapp:::.crf_unit_context(.cvc_unidades(sid)[[1]])
  expect_match(contexto$codigo_ficha, "N502", fixed = TRUE)
})
