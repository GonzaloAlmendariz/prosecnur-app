# Contrato Fuentes -> Modelo -> Teléfono (ADR 0045).

.model_unit <- function(id = "egresados",
                        actor = "Egresados",
                        label = actor,
                        phone = NULL,
                        segment = "",
                        group = "") {
  unit <- list(
    id = id,
    type = "actor",
    actor = actor,
    label = label,
    segment = segment,
    group = group
  )
  if (!is.null(phone)) unit$phone <- phone
  unit
}

.iter68_source_actor_data <- function(phone_actors = "Egresados") {
  actors <- c(
    "Estudiantes", "Estudiantes", "Egresados", "Egresados",
    "Administrativos", "Administrativos", "Docentes", "Docentes"
  )
  default_channels <- c(
    "Ficha QR", "Ficha QR", "Correo", "Correo",
    "Correo", "Correo", "Enlace", "Enlace personalizado"
  )
  channels <- ifelse(actors %in% phone_actors, "Telefonico", default_channels)
  data.frame(
    CodPulso = c("S1", "S2", "E1", "E2", "A1", "A2", "D1", "D2"),
    Status = c(
      "Efectivo", "Efectivo", "Efectivo", "No contesta",
      "Efectivo", "Efectivo", "Efectivo", "Efectivo"
    ),
    dim_actor = actors,
    dim_canal = channels,
    .source_role = "barrido",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.iter68_source_units <- function(profile, data = .iter68_source_actor_data()) {
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = profile), data)
  cfg$monitoreo_profile$units %||% list()
}

.iter68_unit_actors <- function(units) {
  vapply(units, function(unit) unit$actor %||% "", character(1))
}

.iter68_phone_actors <- function(units) {
  .iter68_unit_actors(Filter(function(unit) {
    isTRUE((unit$phone %||% list())$enabled)
  }, units))
}

test_that("Fuentes reconstruye los cuatro actores aunque Modelo omita o vacíe units", {
  profiles <- list(
    legacy = list(family = "acreditacion", units = list()),
    v2_vacio = list(
      schema_version = "monitoreo_profile_v2",
      family = "acreditacion",
      units = list()
    )
  )

  for (profile in profiles) {
    units <- .iter68_source_units(profile)
    expect_identical(
      .iter68_unit_actors(units),
      c("Estudiantes", "Egresados", "Administrativos", "Docentes")
    )
    expect_identical(.iter68_phone_actors(units), "Egresados")
  }
})

test_that("Fuentes desactivadas no crean actores ni habilitan Teléfono", {
  data <- data.frame(
    .source_id = c("administrativos_correo", "egresados_telefono_inactivo"),
    dim_actor = c("Administrativos", "Egresados"),
    dim_canal = c("Correo", "Telefonico"),
    stringsAsFactors = FALSE
  )
  attr(data, "monitoreo_sources") <- list(
    list(
      id = "administrativos_correo",
      enabled = TRUE,
      dimensions = list(actor = "Administrativos", canal = "Correo")
    ),
    list(
      id = "egresados_telefono_inactivo",
      enabled = FALSE,
      dimensions = list(actor = "Egresados", canal = "Telefonico")
    )
  )

  units <- .iter68_source_units(list(family = "acreditacion"), data)
  expect_identical(.iter68_unit_actors(units), "Administrativos")
  expect_length(.iter68_phone_actors(units), 0L)
  expect_identical(
    .monitoreo_source_declared_actor_values(data),
    c("Administrativos", "")
  )
})

test_that("Fuentes reconstruye roster y canales ante alta, baja y rename intentados por units", {
  attempted_units <- list(
    .model_unit(
      "estudiantes",
      "Estudiantes",
      "Alumnado renombrado",
      phone = list(enabled = TRUE, role = "target")
    ),
    .model_unit(
      "egresados",
      "Egresados",
      "Graduados renombrados",
      phone = list(enabled = FALSE, role = "none")
    ),
    .model_unit(
      "graduados",
      "Graduados",
      phone = list(enabled = TRUE, role = "target")
    )
    # Administrativos y Docentes se omiten deliberadamente como intento de baja.
  )
  profile <- list(
    schema_version = "monitoreo_profile_v2",
    family = "acreditacion",
    units = attempted_units
  )

  units <- .iter68_source_units(profile)
  expect_identical(
    .iter68_unit_actors(units),
    c("Estudiantes", "Egresados", "Administrativos", "Docentes"),
    info = "Fuentes impide alta y baja de actores desde Modelo"
  )
  expect_identical(
    vapply(units, function(unit) unit$label %||% "", character(1)),
    c("Estudiantes", "Egresados", "Administrativos", "Docentes"),
    info = "Fuentes impide renombrar actores desde Modelo"
  )
  expect_identical(
    .iter68_phone_actors(units),
    "Egresados",
    info = "el canal declarado en Fuentes prevalece sobre phone en units"
  )
})

test_that("normalización legacy conserva shape v2 para 0, 1 y N units", {
  profiles <- list(
    list(family = "acreditacion", units = list()),
    list(
      family = "acreditacion",
      units = list(list(id = "egresados", label = "Egresados"))
    ),
    list(
      family = "acreditacion",
      units = list(
        .model_unit("egresados", "Egresados"),
        .model_unit(
          "docentes",
          "Docentes",
          phone = list(enabled = TRUE, role = "none")
        ),
        .model_unit(
          "administrativos",
          "Administrativos",
          phone = list(enabled = FALSE, role = "target")
        )
      )
    )
  )
  expected_lengths <- c(0L, 1L, 3L)

  for (i in seq_along(profiles)) {
    normalized <- monitoreo_normalize_profile(profiles[[i]])
    expect_identical(normalized$schema_version, "monitoreo_profile_v2")
    expect_length(normalized$units, expected_lengths[[i]])
    expect_true(all(vapply(normalized$units, function(unit) {
      setequal(
        names(unit),
        c("id", "type", "actor", "label", "segment", "group", "phone")
      ) && identical(
        isTRUE(unit$phone$enabled),
        identical(unit$phone$role, "target")
      )
    }, logical(1))))
  }

  one <- monitoreo_normalize_profile(profiles[[2]])$units[[1]]
  expect_identical(one$actor, "Egresados")
  expect_identical(one$phone, list(enabled = FALSE, role = "none"))
})

test_that("Fuentes define exactamente 0, 1 o N actores telefónicos", {
  cases <- list(
    none = character(0),
    one = "Egresados",
    many = c("Egresados", "Docentes")
  )

  for (phone_actors in cases) {
    units <- .iter68_source_units(
      list(family = "acreditacion", units = list()),
      .iter68_source_actor_data(phone_actors)
    )
    expect_setequal(.iter68_phone_actors(units), phone_actors)
  }
})

test_that("metadata estratégica source-backed no altera nombre ni canal declarados", {
  profile <- list(
    family = "acreditacion",
    units = list(.model_unit(
      "egresados_legacy",
      "Egresados",
      "Nombre legacy",
      phone = list(enabled = FALSE, role = "none"),
      segment = "posgrado",
      group = "seguimiento"
    ))
  )

  unit <- Filter(
    function(item) identical(item$actor %||% "", "Egresados"),
    .iter68_source_units(profile)
  )[[1L]]
  expect_identical(unit$id, "egresados")
  expect_identical(unit$label, "Egresados")
  expect_identical(unit$segment, "posgrado")
  expect_identical(unit$group, "seguimiento")
  expect_identical(unit$phone, list(enabled = TRUE, role = "target"))
})
