# Todo material con QR tiene que llevar tambien el enlace, en texto y clicable.
#
# Esta prueba existe por un fallo concreto: el layout `field_form` salio con el
# QR como UNICO portador del enlace. Ni anotacion ni URL impresa. Una hoja asi
# es papel muerto en cuanto la imagen del QR no escanea — mala impresion, una
# mancha, un doblez — y su suite propia no lo detecto porque probaba lo que el
# layout hacia, no lo que el artefacto tiene que garantizar.
#
# Por eso el recorrido es sobre el REGISTRO de presets y no sobre una lista
# escrita a mano: un preset nuevo sin cobertura hace fallar el test.

.cme_url <- "https://ee-eu.kobotoolbox.org/x/5rbcghMb?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=PILOTO_2026"

.cme_templates <- function() {
  list(
    ficha_aplicacion_a4_v1 = collection_material_builtin_template(),
    afiche_qr_a4_v1 = collection_material_poster_template(assets = "logo-uno"),
    ficha_campo_qr_a4_v1 = collection_material_field_sheet_template()
  )
}

.cme_compiled <- function(template) {
  unit <- list(
    unit_id = "u1", label = "Unidad", role = "titular", group = "M1",
    dimensions = list(faculty = "Facultad", course_name = "Curso", sample_label = "M1")
  )
  binding <- list(
    access_id = "a1", logical_collector_id = "PILOTO_2026", unit_id = "u1",
    access_kind = "manual_handoff", access_ref = .cme_url, status = "ready"
  )
  deployment <- list(
    deployment_id = "d1", target = list(provider = "kobo"), bindings = list(binding),
    sensitivity = list(access_urls = "operational"), status = "prepared"
  )
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m1",
    template_ref = list(
      template_id = template$template_id, revision = 1L, sha256 = template$template_sha256
    ),
    deployment_id = "d1", deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)), instance_fingerprint = fp("m1"),
    unit_refs = list("u1"), access_refs = list("a1"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  collection_material_compile(
    template, instance, project = list(name = "Estudio", period = "2026"),
    plan = list(plan_id = "p1", units = list(unit)), deployment = deployment
  )
}

test_that("el registro de presets esta cubierto entero por esta prueba", {
  expect_setequal(names(.cme_templates()), names(COLLECTION_MATERIAL_PRESETS))
})

test_that("ningun preset emite un PDF donde el QR sea el unico portador del enlace", {
  dir <- tempfile("cme-"); dir.create(dir)
  for (preset in names(.cme_templates())) {
    template <- .cme_templates()[[preset]]
    expect_true(collection_material_template_validate(template)$ok, info = preset)

    path <- file.path(dir, paste0(preset, ".pdf"))
    rendered <- collection_material_render_compiled(
      .cme_compiled(template), path, device = "pdf"
    )
    raw <- readBin(path, "raw", n = file.info(path)$size)

    # 1) Anotacion clicable, con la URL exacta dentro.
    expect_true(length(grepRaw("/Subtype /Link", raw, fixed = TRUE)) > 0L, info = preset)
    expect_true(length(grepRaw(.cme_url, raw, fixed = TRUE)) > 0L, info = preset)

    # 2) El renderer declaro al menos un rectangulo, con la URL del acceso.
    expect_gt(length(rendered$links %||% list()), 0L)
    expect_true(all(vapply(rendered$links, function(l) identical(l$url, .cme_url), logical(1))),
                info = preset)

    # 3) Y uno de ellos es la URL IMPRESA. Sin esto la prueba solo verifica que
    # el PDF sea clicable, que no le sirve de nada a quien tiene la hoja en la
    # mano y el QR no le escanea.
    kinds <- vapply(rendered$links, function(l) as.character(l$kind %||% ""), character(1))
    expect_true("printed_url" %in% kinds, info = preset)

    # 4) El PDF sigue siendo legible para un parser ajeno.
    expect_identical(qpdf::pdf_length(path), 1L)
  }
})

test_that("sin enlace resuelto el material lo dice, en cualquier preset", {
  dir <- tempfile("cme-sin-"); dir.create(dir)
  for (preset in names(.cme_templates())) {
    template <- .cme_templates()[[preset]]
    compiled <- .cme_compiled(template)
    # Se vacia el acceso ya compilado: es el estado real cuando el deployment
    # todavia no resolvio la URL de esa unidad.
    compiled$pages[[1]]$access$qr_payload <- ""
    for (i in seq_along(compiled$pages[[1]]$blocks)) {
      if (identical(compiled$pages[[1]]$blocks[[i]]$type, "access_qr")) {
        compiled$pages[[1]]$blocks[[i]]$value <- ""
      }
    }
    path <- file.path(dir, paste0(preset, ".pdf"))
    rendered <- collection_material_render_compiled(compiled, path, device = "pdf")
    expect_length(rendered$links %||% list(), 0L)
    expect_identical(qpdf::pdf_length(path), 1L)
  }
})
