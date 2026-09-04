# La ficha de campo pide SOLO lo que el aplicador ve con sus ojos.
#
# Dictado de Gonzalo (2026-09-03): «los aplicadores no tienen una forma de
# saber si el alumno finalizó la encuesta pasando por los filtros o no».
# Tiene razón y el motor ya lo sabía: la precedencia de `.madt_efectivas`
# (monitoreo_aulas_dos_tasas.R) es plataforma primero y parte solo como
# RESPALDO. Pedir «Efectivas» en papel produce un número a ojo que compite
# con el bueno.
#
# Y el H/M salía peor: medido, «hombres»/«mujeres» no existe en el lector de
# partes, ni en el parte en-app, ni en el modelo del plan — el aplicador los
# contaba y el dato moría en la hoja. Un campo sin consumidor no se pide.
#
# Queda lo observable: alumnos en aula, encuestas aplicadas (escaneadas
# delante de él), rechazos y ya respondieron. «Efectivas» se queda IMPRESA
# con su leyenda —para que nadie pregunte dónde ponerla— y por eso el
# contrato del campo aprende `note`: un campo que DICE algo en vez de pedirlo.

# Fixture propio: los helpers definidos dentro de un test-*.R no viajan al
# archivo vecino (solo los `helper-*.R` se comparten).
.cfo_compiled <- function(template) {
  unit <- list(unit_id = "u1", label = "Rotulo", role = "piloto", group = "PILOTO")
  binding <- list(
    access_id = "a1", logical_collector_id = "PILOTO_2026", unit_id = "u1",
    access_kind = "manual_handoff", access_ref = "https://x.test/enc", status = "ready"
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
    template, instance, project = list(name = "Estudio", period = "Piloto"),
    plan = list(plan_id = "p1", units = list(unit)), deployment = deployment
  )
}

.cfo_labels <- function(rows) {
  out <- character(0)
  for (row in rows) {
    for (cell in row$fields %||% list()) out <- c(out, as.character(cell$label %||% ""))
  }
  out
}

.cfo_campo <- function(rows, patron) {
  for (row in rows) {
    for (cell in row$fields %||% list()) {
      if (grepl(patron, as.character(cell$label %||% ""), ignore.case = TRUE)) return(cell)
    }
  }
  NULL
}

test_that("la ficha pide lo observable y ya no pide lo que el aplicador no puede ver", {
  rows <- collection_material_field_form_rows()
  labels <- .cfo_labels(rows)

  # Lo que SÍ ve con sus ojos y nadie más puede dar.
  expect_true(any(grepl("alumnos en aula", labels, ignore.case = TRUE)))
  expect_true(any(grepl("encuestas aplicadas", labels, ignore.case = TRUE)))
  expect_true(any(grepl("^rechazos", labels, ignore.case = TRUE)))
  expect_true(any(grepl("ya respondieron", labels, ignore.case = TRUE)))

  # El H/M se retira: no tenía destino en el modelo (medido). Si algún día se
  # quiere el denominador por sexo, vuelve CON su campo, no antes.
  expect_false(any(grepl("hombres|mujeres", labels, ignore.case = TRUE)))

  # «Efectivas» ya no aparece NI como nota: la poda de Gonzalo (2026-09-03)
  # cerró la puerta que había quedado entreabierta —«si las calcula el
  # sistema, ¿qué necesidad hay de que esté allí?»—. El contrato del campo
  # conserva `note` porque es útil, pero esta hoja ya no lo usa; su prueba
  # viva es la del render, más abajo.
  expect_null(.cfo_campo(rows, "efectivas"))
})

test_that("el contrato del campo acepta `note` y la plantilla sigue validando", {
  template <- collection_material_field_sheet_template()
  expect_true(collection_material_template_validate(template)$ok)

  # `note` es del contrato cerrado, no un campo libre: una llave inventada
  # sigue rechazándose.
  intruso <- template
  filas <- intruso$pages[[1]]$blocks
  idx <- which(vapply(filas, function(b) identical(b$type, "form_lines"), logical(1)))[[1]]
  filas[[idx]]$rows[[1]]$fields[[1]]$leyenda <- "texto libre"
  intruso$pages[[1]]$blocks <- filas
  intruso$template_sha256 <- NULL
  intruso$template_sha256 <- collection_fingerprint(intruso)
  codigos <- vapply(
    collection_material_template_validate(intruso)$problems,
    function(p) p$code, character(1)
  )
  expect_true("form_field_not_allowed" %in% codigos)
})

test_that("un campo con nota se imprime como texto y NO dibuja raya para escribir", {
  skip_if_not_installed("png")
  # Se compara el MISMO renglón en dos fichas: una con el campo como casilla
  # (raya) y otra con `note`. La raya es una línea continua de píxeles
  # oscuros; el texto no lo es. Medirlo así evita afinar un umbral a ojo.
  fila_de <- function(campo) {
    list(list(fields = list(campo)))
  }
  render <- function(rows) {
    template <- collection_material_field_sheet_template(rows = rows)
    template$template_sha256 <- NULL
    template$template_sha256 <- collection_fingerprint(template)
    compiled <- .cfo_compiled(template)
    dir <- tempfile("cfo-"); dir.create(dir)
    path <- file.path(dir, "ficha.png")
    collection_material_render_compiled(compiled, path, device = "png", page = 1L, dpi = 110)
    img <- png::readPNG(path)
    if (length(dim(img)) == 3L) img[, , 1] else img
  }
  # Corrida más larga de píxeles oscuros DENTRO DE LA BANDA DEL FORMULARIO.
  # Medirla sobre la imagen entera no sirve: el QR ocupa media hoja y sus
  # módulos forman corridas negras más largas que cualquier raya, así que la
  # señal quedaba enterrada (medido: los dos renders daban lo mismo).
  corrida_max <- function(grey) {
    L <- prosecnurapp:::.cfc_layout()
    filas <- seq(
      max(1L, as.integer((1 - L$form_top) * nrow(grey))),
      min(nrow(grey), as.integer((1 - L$form_floor) * nrow(grey)))
    )
    max(vapply(filas, function(i) {
      # 0.6 y no 0.5: la raya es un hairline de 0.7 pt y a 110 dpi el
      # antialiasing la deja en gris medio, nunca en negro. Con 0.5 los dos
      # renders daban 7 y el test no medía nada (barrido: 0.6 → raya 681 px,
      # nota 7 px; la separación es de dos órdenes).
      oscuros <- grey[i, ] < 0.6
      if (!any(oscuros)) return(0L)
      max(rle(oscuros)$lengths[rle(oscuros)$values])
    }, integer(1)))
  }
  con_raya <- corrida_max(render(fila_de(list(label = "Efectivas:", span = 1))))
  con_nota <- corrida_max(render(fila_de(list(
    label = "Efectivas:", span = 1, note = "las calcula el sistema"
  ))))
  expect_gt(con_raya, 200L)
  expect_lt(con_nota, con_raya / 3)
})

# --- Poda de Gonzalo (2026-09-03, segunda vuelta) ---
#
# «¿Cuál es la razón por la cual debajo del QR, el título, que es como lo más
# importante, está el horario del curso? No me parece que tenga demasiado
# sentido» · «el título debajo del QR debería tener simplemente el código y el
# pabellón. El pabellón CONFIRMADO, porque hay una columna del sheets que
# confirma cuál es; sobre todo cuando hay dos pabellones a la vez, lo que hace
# el agendador es definirte finalmente a cuál se tiene que ir» · «si las
# calcula el sistema, ¿qué necesidad hay de que esté allí? No tiene sentido»
# · «si son seis ítems pueden ir tres y tres, de paso ocupan un poquito menos
# de alto y el QR se puede ver un poquito más grande».

test_that("el título bajo el QR es el código y el pabellón, no el horario", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", list(list(
    selection_run_id = "sel-t", operational_code = "CH 141", classroom_id = "CH 141",
    label = "VIE 10:00-13:00 N502", wave = "M1", faculty = "Comunicaciones",
    pabellon_aula = "N502", scheduled_venue = "A206",
    link = "https://kf.kobotoolbox.org/x/a?d%5BcollectorID%5D=CH141"
  )))
  unit <- collection_state_seed(sid)$plan$units[[1]]
  titulo <- prosecnurapp:::.crf_unit_context(unit)$codigo_ficha

  # Lo que identifica la hoja en el aula: qué curso-horario es y a qué
  # pabellón ir. El horario del curso ya vive en su propio campo.
  expect_match(titulo, "CH 141", fixed = TRUE)
  expect_match(titulo, "A206", fixed = TRUE)
  expect_false(grepl("10:00", titulo, fixed = TRUE))
  expect_false(grepl("VIE", titulo, fixed = TRUE))
  expect_false(grepl("N502", titulo, fixed = TRUE))
})

test_that("sin aula el título es solo el código, sin muletillas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", list(list(
    selection_run_id = "sel-t2", operational_code = "R 7.2", classroom_id = "R 7.2",
    label = "LUN 08:00-10:00", wave = "M1", faculty = "Derecho",
    link = "https://kf.kobotoolbox.org/x/a?d%5BcollectorID%5D=R72"
  )))
  unit <- collection_state_seed(sid)$plan$units[[1]]
  expect_identical(prosecnurapp:::.crf_unit_context(unit)$codigo_ficha, "R 7.2")
})

test_that("la ficha ya no menciona «Efectivas» en ninguna forma", {
  # Si la calcula el sistema, no ocupa sitio en el papel — ni como casilla ni
  # como leyenda.
  rows <- collection_material_field_form_rows()
  labels <- .cfo_labels(rows)
  notas <- unlist(lapply(rows, function(r) {
    vapply(r$fields %||% list(), function(c) as.character(c$note %||% ""), character(1))
  }))
  expect_false(any(grepl("efectiv", labels, ignore.case = TRUE)))
  expect_false(any(grepl("efectiv|sistema", notas, ignore.case = TRUE)))

  # Los cuatro conteos observables siguen, y son los únicos.
  for (esperado in c("alumnos en aula", "encuestas aplicadas", "rechazos", "ya respondieron")) {
    expect_true(any(grepl(esperado, labels, ignore.case = TRUE)), info = esperado)
  }
})

test_that("los seis datos impresos van tres y tres, no cuatro y dos", {
  rows <- collection_material_field_form_rows()
  impresas <- Filter(function(r) {
    all(vapply(r$fields %||% list(), function(c) !is.null(c$binding), logical(1)))
  }, rows)
  # Tres renglones de dos columnas: la mitad del alto que ocupaban antes.
  expect_length(impresas, 3L)
  for (fila in impresas) expect_length(fila$fields, 2L)
})

test_that("el QR crece con el alto que liberan los renglones", {
  L <- prosecnurapp:::.cfc_layout()
  expect_gt(L$qr_side, 0.58)
  # Y la hoja sigue cabiendo: el formulario entra sin desbordar.
  capacidad <- as.integer(floor((L$form_top - L$form_floor) / L$form_step)) + 1L
  renglones <- sum(vapply(collection_material_field_form_rows(), function(r) {
    max(1L, max(vapply(r$fields %||% list(), function(c) {
      n <- suppressWarnings(as.integer(c$lines %||% 1L)); if (is.na(n)) 1L else n
    }, integer(1)), 1L))
  }, integer(1)))
  expect_lte(renglones, capacidad)
})
