# Higiene NEUTRA de la base persistida (base_hygiene.R): sanitize_base_data debe
# dejar SOLO instrumento + extras legítimas, colapsando dups group-prefixed y
# dropeando el esquema de seguimiento/universo VACÍO por PROVENIENCIA — sin
# borrar extras sustantivas ni columnas del instrumento.

.bh_inst_fixture <- function() {
  survey <- data.frame(
    type  = c("integer", "calculate", "select_one si_no", "text"),
    name  = c("edad", "edad_calc", "p1", "comentario"),
    label = c("Edad", "Edad calc", "Pregunta 1", "Comentario"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  structure(list(survey = survey), class = "prosecnur_instrumento")
}

# Base con las 3 familias patológicas del handoff + una extra sustantiva legítima.
.bh_data_fixture <- function() {
  data.frame(
    # instrumento pelado con dato
    edad        = c(30L, 41L),
    edad_calc   = c(30L, 41L),                 # calculate del survey CON dato
    p1          = c("1", "2"),
    comentario  = c("bien", "regular"),
    # duplicados group-prefixed byte-idénticos (uno con `/`, otro con `.`)
    `Intro/edad` = c(30L, 41L),
    `Seccion.p1` = c("1", "2"),
    # extra SUSTANTIVA legítima (no está en el survey, pero trae dato) -> se queda
    dim_actor   = c("ONG", "Estado"),
    # esquema de seguimiento/universo de Monitoreo: EXTRA + 100% VACÍO
    Origen      = c("", ""),
    Status      = c(NA_character_, NA_character_),
    dim_sede    = c("", ""),
    Observacion = c("[]", "[]"),
    # plumbing dot-prefijado
    `.integration_mode` = c("connected_read", "connected_read"),
    `.source_id`        = c("kobo_x", "kobo_x"),
    # metadata Kobo legítima -> se conserva
    `_uuid`     = c("u1", "u2"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("sanitize_base_data deja instrumento + extras legítimas y limpia el resto (handoff)", {
  inst <- .bh_inst_fixture()
  out <- sanitize_base_data(.bh_data_fixture(), inst, monitoreo_handoff = TRUE)

  # Instrumento intacto (con dato).
  expect_true(all(c("edad", "edad_calc", "p1", "comentario") %in% names(out)))
  expect_equal(out$edad, c(30L, 41L))

  # Dups group-prefixed colapsados (ambos separadores).
  expect_false("Intro/edad" %in% names(out))
  expect_false("Seccion.p1" %in% names(out))

  # Extra SUSTANTIVA legítima preservada.
  expect_true("dim_actor" %in% names(out))
  expect_equal(out$dim_actor, c("ONG", "Estado"))

  # Esquema de seguimiento/universo VACÍO dropeado por proveniencia.
  expect_false(any(c("Origen", "Status", "dim_sede", "Observacion") %in% names(out)))

  # Plumbing dot-prefijado / tags de fuente fuera.
  expect_false(any(c(".integration_mode", ".source_id") %in% names(out)))

  # Metadata Kobo legítima conservada.
  expect_true("_uuid" %in% names(out))
})

test_that("sin proveniencia de handoff NO se dropea el universo vacío (solo dups + tags)", {
  inst <- .bh_inst_fixture()
  out <- sanitize_base_data(.bh_data_fixture(), inst, monitoreo_handoff = FALSE)

  # Dups y dot-plumbing SIEMPRE se limpian (seguro en cualquier base).
  expect_false("Intro/edad" %in% names(out))
  expect_false(".integration_mode" %in% names(out))

  # Pero las columnas vacías NO-instrumento se respetan: podrían ser del usuario.
  expect_true(all(c("Origen", "Status", "dim_sede") %in% names(out)))
  # La extra sustantiva sigue intacta.
  expect_true("dim_actor" %in% names(out))
})

test_that("auto-detección de proveniencia por fingerprint (.integration_mode presente)", {
  inst <- .bh_inst_fixture()
  # monitoreo_handoff = NULL -> auto-detecta por el marcador `.integration_mode`.
  out <- sanitize_base_data(.bh_data_fixture(), inst, monitoreo_handoff = NULL)
  expect_false(any(c("Origen", "Status", "dim_sede") %in% names(out)))
})

test_that("una base sin marcadores ni handoff no pierde columnas vacías (auto=FALSE)", {
  inst <- .bh_inst_fixture()
  data <- data.frame(
    edad = c(30L, 41L),
    reservada = c("", ""),   # columna vacía legítima de un upload manual
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out <- sanitize_base_data(data, inst, monitoreo_handoff = NULL)
  expect_true("reservada" %in% names(out))
})

test_that("sanitize_base_data es idempotente", {
  inst <- .bh_inst_fixture()
  once <- sanitize_base_data(.bh_data_fixture(), inst, monitoreo_handoff = TRUE)
  twice <- sanitize_base_data(once, inst, monitoreo_handoff = TRUE)
  expect_equal(names(twice), names(once))
  expect_equal(twice, once)
})

test_that("NUNCA borra una extra sustantiva legítima aunque sea handoff", {
  inst <- .bh_inst_fixture()
  out <- sanitize_base_data(.bh_data_fixture(), inst, monitoreo_handoff = TRUE)
  expect_true("dim_actor" %in% names(out))
  expect_equal(nrow(out), 2L)
})

test_that("el wrapper de analítica delega en el helper compartido (mismo resultado)", {
  inst <- .bh_inst_fixture()
  data <- .bh_data_fixture()
  via_wrapper <- .analitica_base_collapse_group_prefixed_dupes(data, inst)
  via_shared  <- .base_hygiene_collapse_group_prefixed_dupes(data, inst)
  expect_equal(names(via_wrapper), names(via_shared))
})
