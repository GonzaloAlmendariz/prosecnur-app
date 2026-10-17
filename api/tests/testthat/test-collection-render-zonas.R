# Zonas de página del editor de materiales (ADR 0109 E1b).
#
# Cada dibujante devuelve, junto a `warnings` y `links`, el rectángulo de cada
# bloque que dibujó. Aquí se fija que esas zonas: salen iguales en PNG y PDF
# (mismo dibujante), no cambian un byte de la imagen, no se pisan, cubren la
# tinta de su bloque, siguen al orden de la receta, y que `editable` de
# COLLECTION_MATERIAL_LAYOUT_CAPS dice la verdad sobre qué cambia la tinta.

.czn_logo <- function(fill = "#112244", w = 120L, h = 40L) {
  path <- tempfile("czn-logo-", fileext = ".png")
  grDevices::png(path, width = w, height = h, res = 72, type = "cairo-png", bg = "white")
  grid::grid.rect(gp = grid::gpar(fill = fill, col = NA))
  grDevices::dev.off()
  path
}

.czn_assets <- local({
  cache <- NULL
  function() {
    if (is.null(cache)) cache <<- list(logo = .czn_logo(), logo2 = .czn_logo("#884422", 60L, 60L))
    cache
  }
})

.czn_dims <- function() {
  list(
    legacy_ref = "CH 1",
    course_name = paste(
      "DETECCION OPORTUNA, DERIVACION Y SEGUIMIENTO A LOS ESTUDIANTES CON",
      "NECESIDADES EDUCATIVAS ESPECIALES ASOCIADAS A LA DISCAPACIDAD"
    ),
    teacher = "KOC CHUKUONG, ANDREA DEL PILAR", program = "Educacion",
    faculty = "EDUCACION", venue = "A206",
    schedule = "LUN 18:00-22:00 · MAR 18:00-22:00", eligible_n = "42"
  )
}

.czn_compiled <- function(template, dims = .czn_dims(),
                          url = "https://ee.kobotoolbox.org/x/abcd?d[collectorID]=CH1") {
  template <- .cm_template_normalize(template)
  unit <- list(unit_id = "u1", label = "mat202_0591", role = "titular", group = "M1", dimensions = dims)
  binding <- list(
    access_id = "a1", logical_collector_id = "CH1", unit_id = "u1",
    access_kind = "manual_handoff", access_ref = url, status = "ready"
  )
  deployment <- list(
    deployment_id = "d1", target = list(provider = "kobo"), bindings = list(binding),
    sensitivity = list(access_urls = "operational"), status = "prepared"
  )
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m1",
    template_ref = list(template_id = template$template_id,
                        revision = as.integer(template$revision), sha256 = template$template_sha256),
    deployment_id = "d1", deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)), instance_fingerprint = fp("m1"),
    unit_refs = list("u1"), access_refs = list("a1"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  collection_material_compile(
    template, instance, project = list(name = "Estudio Pulso", period = "2026-II"),
    plan = list(plan_id = "p1", units = list(unit)), deployment = deployment
  )
}

# Las cuatro caras de fábrica que el catálogo ofrece, más la ficha de aula con
# careta y píldora (los dos bloques que la de fábrica no trae).
.czn_plantillas <- function() {
  list(
    aula = collection_material_builtin_template(),
    aula_marca = collection_material_branded_sheet_template(assets = "logo", status_tag = "PILOTO"),
    campo = collection_material_field_sheet_template(),
    afiche = collection_material_poster_template(assets = "logo")
  )
}

.czn_png <- function(compiled, page, dpi = 72) {
  path <- tempfile("czn-", fileext = ".png")
  r <- collection_material_render_compiled(compiled, path, device = "png", page = page,
                                           dpi = dpi, brand_assets = .czn_assets())
  list(path = path, rendered = r)
}

.czn_md5 <- function(path) digest::digest(file = path, algo = "md5")

.czn_sin_pagina <- function(zones) lapply(zones, function(z) { z$page <- NULL; z })

test_that("las zonas salen iguales en PNG, PDF y pdf(NULL), por preset y página", {
  for (nm in names(.czn_plantillas())) {
    compiled <- .czn_compiled(.czn_plantillas()[[nm]])
    pdf_path <- tempfile("czn-", fileext = ".pdf")
    # El device PDF no codifica «…» (la elipsis de `.cfc_recortar`) y avisa que
    # la sustituye por «...»: es del device, ajeno a las zonas.
    en_pdf <- withCallingHandlers(
      collection_material_render_compiled(compiled, pdf_path, device = "pdf",
                                          brand_assets = .czn_assets()),
      warning = function(w) if (grepl("mbcsToSbcs", conditionMessage(w))) invokeRestart("muffleWarning")
    )
    expect_collection_material_pdf_valid(pdf_path, en_pdf)
    for (pg in seq_along(compiled$pages)) {
      en_png <- .czn_png(compiled, pg)$rendered$zones
      expect_gt(length(en_png), 0L)
      de_pdf <- Filter(function(z) identical(z$page, pg), en_pdf$zones)
      grDevices::pdf(NULL, width = 8.27, height = 11.69)
      nulo <- tryCatch(
        collection_material_draw_page(compiled$pages[[pg]], pg, length(compiled$pages), .czn_assets())$zones,
        finally = grDevices::dev.off()
      )
      expect_equal(.czn_sin_pagina(en_png), .czn_sin_pagina(de_pdf), tolerance = 1e-9,
                   info = paste(nm, pg, "PNG vs PDF"))
      expect_equal(.czn_sin_pagina(en_png), nulo, tolerance = 1e-9, info = paste(nm, pg, "PNG vs pdf(NULL)"))
    }
  }
})

test_that("agregar zonas no cambia un byte de la imagen", {
  # Se dibuja dos veces: con las zonas y con sus constructores anulados. Si
  # armar una zona tocara el device, los PNG diferirían.
  for (nm in names(.czn_plantillas())) {
    compiled <- .czn_compiled(.czn_plantillas()[[nm]])
    for (pg in seq_along(compiled$pages)) {
      con <- .czn_md5(.czn_png(compiled, pg)$path)
      local({
        testthat::local_mocked_bindings(
          .cmz_zone = function(...) list(block_id = NA_character_, type = "x", kind = "derived",
                                         x0 = 0, x1 = 0, y0 = 0, y1 = 0),
          .cmz_sin_solapes = function(zones) list(),
          .cmz_alto_lineas = function(...) 0,
          .package = "prosecnurapp"
        )
        sin <- .czn_md5(.czn_png(compiled, pg)$path)
        expect_identical(con, sin, info = paste(nm, pg))
      })
    }
  }
})

test_that("la corrección de body no cambia la cadena que dibuja la receta de fábrica", {
  # La de fábrica liga `body` a unit.course_name. Lo que se dibuja ahora sale
  # del bloque: tiene que ser letra por letra el curso de antes, también en los
  # nombres largos del estudio real (111 y 128 caracteres).
  cursos <- c(
    "CALCULO 1", "Curso de ejemplo", .czn_dims()$course_name,
    "DELITOS CONTRA LA VIDA, EL CUERPO Y LA SALUD: TEORIA Y PRACTICA DE LA PARTE ESPECIAL DEL DERECHO PENAL PERUANO CONTEMPORANEO",
    "  ESPACIOS   DOBLES ,  Y COMA  ", "Á É Í Ó Ú Ñ ü"
  )
  for (curso in cursos) {
    dims <- .czn_dims(); dims$course_name <- curso
    compiled <- .czn_compiled(collection_material_builtin_template(), dims)
    body <- Filter(function(b) identical(b$type, "body"), compiled$pages[[1]]$blocks)[[1]]
    expect_identical(prosecnurapp:::.crf_body_texto(body), compiled$pages[[1]]$unit$course_name, info = curso)
  }
})

test_that("body ligado a unit.schedule dibuja el horario, no el curso", {
  t <- collection_material_builtin_template()
  i <- which(vapply(t$pages[[1]]$blocks, `[[`, "", "type") == "body")
  t$pages[[1]]$blocks[[i]]$binding <- "unit.schedule"
  horario <- .czn_md5(.czn_png(.czn_compiled(t), 1L)$path)
  # Mismo bloque con el horario tecleado como texto fijo: la tinta es la misma.
  t2 <- t; t2$pages[[1]]$blocks[[i]]$binding <- NULL
  t2$pages[[1]]$blocks[[i]]$text <- .czn_dims()$schedule
  expect_identical(horario, .czn_md5(.czn_png(.czn_compiled(t2), 1L)$path))
  curso <- .czn_md5(.czn_png(.czn_compiled(collection_material_builtin_template()), 1L)$path)
  expect_false(identical(horario, curso))
})

.czn_area <- function(a, b) {
  w <- min(a$x1, b$x1) - max(a$x0, b$x0)
  h <- min(a$y1, b$y1) - max(a$y0, b$y0)
  if (w <= 0 || h <= 0) 0 else w * h
}

test_that("una zona por bloque dibujado, dentro de la página y sin solapes; lo sobrante en undrawn", {
  t <- collection_material_builtin_template()
  b <- t$pages[[1]]$blocks
  extra <- list(
    list(block_id = "unit2", type = "heading", text = "Otro titulo"),
    list(block_id = "course2", type = "body", text = "Otro texto"),
    list(block_id = "rule2", type = "divider")
  )
  t$pages[[1]]$blocks <- c(b[1:5], extra, b[6:length(b)])
  compiled <- .czn_compiled(t)
  zones <- .czn_png(compiled, 1L)$rendered$zones
  ids <- stats::na.omit(vapply(zones, function(z) z$block_id, character(1)))
  expect_false(anyDuplicated(ids) > 0L)
  for (z in zones) {
    for (k in c("x0", "x1", "y0", "y1")) expect_true(z[[k]] >= 0 && z[[k]] <= 1, info = paste(z$type, k))
    expect_true(z$x1 >= z$x0 && z$y1 >= z$y0)
  }
  for (i in seq_along(zones)) for (j in seq_along(zones)) if (i < j) {
    expect_identical(.czn_area(zones[[i]], zones[[j]]), 0,
                     info = paste(zones[[i]]$type, "pisa", zones[[j]]$type))
  }
  undrawn <- prosecnurapp:::.cmz_no_dibujados(compiled$pages[[1]]$blocks, zones)
  motivo <- setNames(vapply(undrawn, `[[`, "", "reason"), vapply(undrawn, `[[`, "", "block_id"))
  expect_identical(motivo[["brand"]], "not_drawn_by_layout")
  expect_identical(motivo[["unit2"]], "slot_taken")
  expect_identical(motivo[["course2"]], "slot_taken")
  # Los filetes se repiten de verdad: los dos tienen zona.
  expect_true(all(c("rule", "rule2") %in% ids))
  # Cada bloque de la cara está en una y solo una de las dos listas.
  todos <- vapply(compiled$pages[[1]]$blocks, `[[`, "", "block_id")
  expect_setequal(c(ids, names(motivo)), todos)
  expect_length(intersect(ids, names(motivo)), 0L)
})

test_that("un segundo body ya no repite el contenido del primero", {
  t <- collection_material_builtin_template()
  b <- t$pages[[1]]$blocks
  t$pages[[1]]$blocks <- c(b[1:3], list(list(block_id = "course2", type = "body", text = "Otro texto")),
                           b[4:length(b)])
  expect_identical(.czn_md5(.czn_png(.czn_compiled(t), 1L)$path),
                   .czn_md5(.czn_png(.czn_compiled(collection_material_builtin_template()), 1L)$path))
})

test_that("cada zona de bloque cubre tinta, y la tinta de la página cae dentro de alguna zona", {
  skip_if_not_installed("png")
  for (nm in names(.czn_plantillas())) {
    compiled <- .czn_compiled(.czn_plantillas()[[nm]])
    for (pg in seq_along(compiled$pages)) {
      out <- .czn_png(compiled, pg, dpi = 90)
      img <- png::readPNG(out$path)
      g <- if (length(dim(img)) == 3L) img[, , 1] else img
      tinta <- g < 0.97
      dentro <- matrix(FALSE, nrow(g), ncol(g))
      for (z in out$rendered$zones) {
        if (z$y1 <= z$y0 || z$x1 <= z$x0) next
        filas <- max(1L, floor((1 - z$y1) * nrow(g)) + 1L):min(nrow(g), ceiling((1 - z$y0) * nrow(g)))
        cols <- max(1L, floor(z$x0 * ncol(g)) + 1L):min(ncol(g), ceiling(z$x1 * ncol(g)))
        dentro[filas, cols] <- TRUE
        expect_gt(sum(tinta[filas, cols]), 20L, label = paste(nm, pg, z$block_id, z$type))
      }
      fuera <- sum(tinta & !dentro) / max(1L, sum(tinta))
      # El único resto medido es el tramo del filete de cabecera que la píldora
      # de estado le quita al título en la ficha con careta (~0,2 %).
      expect_lt(fuera, 0.005, label = paste(nm, pg, "tinta fuera de zonas"))
    }
  }
})

test_that("reordenar field_grid y application_log mueve sus zonas", {
  t <- collection_material_builtin_template()
  tipos <- vapply(t$pages[[1]]$blocks, `[[`, "", "type")
  i <- which(tipos == "field_grid"); j <- which(tipos == "application_log")
  zona <- function(template, id) {
    zs <- .czn_png(.czn_compiled(template), 1L)$rendered$zones
    Filter(function(z) identical(z$block_id, id), zs)[[1]]
  }
  antes_grid <- zona(t, "details"); antes_log <- zona(t, "log")
  expect_gt(antes_grid$y1, antes_log$y1)
  t2 <- t
  t2$pages[[1]]$blocks[c(i, j)] <- t$pages[[1]]$blocks[c(j, i)]
  despues_grid <- zona(t2, "details"); despues_log <- zona(t2, "log")
  expect_gt(despues_log$y1, despues_grid$y1)
  expect_false(isTRUE(all.equal(antes_log$y1, despues_log$y1)))
})

# --- «La propiedad editable cambia la tinta y la no declarada no» ------------

.czn_largo <- paste(
  "Texto largo de prueba para medir el recorte de lineas en el bloque que se",
  "edita desde el inspector del editor de materiales de campo con varias palabras mas"
)

.czn_otra_binding <- function(b) {
  switch(as.character(b %||% ""),
    "unit.teacher" = "unit.faculty",
    "project.name" = "project.period",
    "project.period" = "project.name",
    "unit.teacher"
  )
}

# Par (base, mutado) que cambia SOLO `field`. `text` y `max_lines` se miden
# sobre el bloque sin binding, que es cuando el texto fijo es el que se dibuja.
.czn_mutar <- function(block, field) {
  base <- block
  mut <- block
  switch(field,
    text = { base$binding <- NULL; base$text <- "Texto fijo uno"; mut <- base; mut$text <- "Otro texto distinto" },
    binding = {
      if (block$type %in% c("access_qr", "campus_map")) return(NULL)
      if (is.null(base$binding)) base$binding <- "unit.course_name"
      mut <- base; mut$binding <- .czn_otra_binding(base$binding)
    },
    max_lines = { base$binding <- NULL; base$text <- .czn_largo; base$max_lines <- 3L; mut <- base; mut$max_lines <- 1L },
    assets = { mut$assets <- list("logo", "logo2") },
    align = { mut$align <- if (identical(block$align, "right")) "left" else "right" },
    max_height_mm = { h <- as.numeric(block$max_height_mm %||% 14); mut$max_height_mm <- if (h >= 16) h - 5 else h + 5 },
    correction = { mut$correction <- if (identical(block$correction, "H")) "L" else "H" },
    quiet_zone = { mut$quiet_zone <- 8L },
    min_size_mm = { m <- as.numeric(block$min_size_mm %||% 40); mut$min_size_mm <- if (m >= 50) 30 else 60 },
    fields = { mut$fields <- block$fields[-length(block$fields)] },
    rows = {
      if (identical(block$type, "application_log")) {
        mut$rows <- if (as.integer(block$rows %||% 3L) < 6L) 6L else 5L
      } else {
        mut$rows <- block$rows[-length(block$rows)]
      }
    },
    labels = { mut$labels <- c(list("Distinto:"), block$labels[-1]) },
    required = { if (identical(block$type, "access_qr")) return(NULL); mut$required <- !isTRUE(block$required) },
    return(NULL)
  )
  list(base = base, mut = mut)
}

test_that("la propiedad editable cambia la huella del PNG y la no declarada no", {
  con_instr <- collection_material_builtin_template()
  b <- con_instr$pages[[1]]$blocks
  con_instr$pages[[1]]$blocks <- c(b[1:6], list(list(
    block_id = "ind", type = "instructions", text = "Lee la hoja antes de entrar al aula.", max_lines = 3L
  )), b[7:length(b)])
  casos <- list(
    aula = list(t = con_instr, solo = NULL),
    aula_marca = list(t = collection_material_branded_sheet_template(assets = "logo", status_tag = "PILOTO"),
                      solo = c("brand_strip", "status_tag")),
    campo = list(t = collection_material_field_sheet_template(assets = "logo"), solo = NULL),
    afiche = list(t = collection_material_poster_template(assets = "logo"), solo = NULL)
  )
  medidos <- 0L
  vistos <- character(0)
  for (nm in names(casos)) {
    t0 <- casos[[nm]]$t
    for (pg in seq_along(t0$pages)) {
      layout <- t0$pages[[pg]]$layout_preset
      for (j in seq_along(t0$pages[[pg]]$blocks)) {
        blk <- t0$pages[[pg]]$blocks[[j]]
        if (!is.null(casos[[nm]]$solo) && !(blk$type %in% casos[[nm]]$solo)) next
        for (field in setdiff(prosecnurapp:::.cm_allowed_block_fields(blk$type), c("block_id", "type"))) {
          m <- .czn_mutar(blk, field)
          if (is.null(m)) next
          tb <- t0; tb$pages[[pg]]$blocks[[j]] <- m$base
          tm <- t0; tm$pages[[pg]]$blocks[[j]] <- m$mut
          expect_true(collection_material_template_validate(.cm_template_normalize(tm))$ok,
                      info = paste(nm, blk$block_id, field, "mutación inválida"))
          cambia <- !identical(.czn_md5(.czn_png(.czn_compiled(tb), pg)$path),
                               .czn_md5(.czn_png(.czn_compiled(tm), pg)$path))
          declarado <- field %in% prosecnurapp:::.cmz_editable(layout, blk$type)
          expect_identical(cambia, declarado, info = sprintf("%s/%s %s.%s", nm, layout, blk$type, field))
          medidos <- medidos + 1L
          vistos <- c(vistos, paste(layout, blk$type, field))
        }
      }
    }
  }
  # Los dos casos que el contrato nombra: el QR no lee min_size_mm y el pie de
  # la ficha de campo ignora su dato.
  expect_true("single_sheet access_qr min_size_mm" %in% vistos)
  expect_true("field_form footer binding" %in% vistos)
  expect_gt(medidos, 60L)
  # Todo `editable` declarado es un campo que el validador admite.
  for (layout in names(COLLECTION_MATERIAL_LAYOUT_CAPS)) {
    caps <- COLLECTION_MATERIAL_LAYOUT_CAPS[[layout]]
    for (type in names(caps$editable)) {
      expect_true(all(caps$editable[[type]] %in% prosecnurapp:::.cm_allowed_block_fields(type)),
                  info = paste(layout, type))
    }
    expect_true(all(caps$reorder %in% COLLECTION_MATERIAL_BLOCK_TYPES), info = layout)
  }
})
