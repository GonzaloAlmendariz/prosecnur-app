# Dimensiones que salen de una columna de la fuente (actor_var).
#
# El defecto que fija el rojo: una sola hoja de barrido con dos actores en una
# columna no podia atribuirlos. `dimensions` es escalar, asi que las filas
# quedaban sin `dim_actor` y el avance por actor reportaba universo 0.

test_that("actor_var llena dim_actor fila a fila, no con una constante", {
  source <- monitoreo_normalize_sources(list(list(
    kind = "google_sheets",
    label = "13.ACNUR MDV-Base de barrido",
    role = "barrido",
    actor_var = "Componente"
  )))[[1]]

  expect_equal(source$actor_var, "Componente")

  data <- .monitoreo_add_source_columns(
    data.frame(
      CODPulso = c("MVH0001", "MVH0002", "MVV0001"),
      Componente = c("Homologación Laboral", "Homologación Laboral", "Vinculación Laboral"),
      stringsAsFactors = FALSE
    ),
    source
  )

  expect_equal(
    data$dim_actor,
    c("Homologación Laboral", "Homologación Laboral", "Vinculación Laboral")
  )
})

test_that("la dimension declarada como variable pisa la constante de la misma clave", {
  # Una fuente puede traer las dos: la constante es el default heredado y la
  # variable es la correccion. Gana la variable, si no el fix no sirve para
  # arreglar una fuente ya configurada sin borrarle sus dimensiones.
  source <- monitoreo_normalize_sources(list(list(
    kind = "google_sheets",
    label = "Barrido",
    dimensions = list(actor = "Homologación Laboral"),
    actor_var = "Componente"
  )))[[1]]

  data <- .monitoreo_add_source_columns(
    data.frame(
      Componente = c("Homologación Laboral", "Vinculación Laboral"),
      stringsAsFactors = FALSE
    ),
    source
  )

  expect_equal(data$dim_actor, c("Homologación Laboral", "Vinculación Laboral"))
})

test_that("una fuente sin actor_var se comporta exactamente como antes", {
  # El cambio es opt-in: ningun proyecto existente puede cambiar de cifras.
  source <- monitoreo_normalize_sources(list(list(
    kind = "surveymonkey",
    label = "Acreditacion - Estudiantes",
    dimensions = list(actor = "Estudiantes")
  )))[[1]]

  data <- .monitoreo_add_source_columns(
    data.frame(estado = c("completed", "rejected"), stringsAsFactors = FALSE),
    source
  )

  expect_equal(data$dim_actor, rep("Estudiantes", 2))
})

test_that("una columna declarada que no existe no rompe ni vacia la constante", {
  # La fuente se declara antes del primer sync: abortar aca dejaria al usuario
  # sin poder guardar su configuracion.
  source <- monitoreo_normalize_sources(list(list(
    kind = "google_sheets",
    label = "Barrido",
    dimensions = list(actor = "Homologación Laboral"),
    actor_var = "ColumnaQueNoExiste"
  )))[[1]]

  data <- .monitoreo_add_source_columns(
    data.frame(Componente = c("A", "B"), stringsAsFactors = FALSE),
    source
  )

  expect_equal(data$dim_actor, rep("Homologación Laboral", 2))
})

test_that("el payload HTTP acepta actor_var en sus cuatro alias", {
  # La ruta real de entrada del usuario es .monitoreo_source_from_payload, no
  # monitoreo_normalize_sources: sin la linea del router el campo se pierde
  # entre el body y la fuente, y la capacidad queda inalcanzable por API.
  for (alias in c("actor_var", "actorVar", "actor_column", "actorColumn")) {
    payload <- list(kind = "google_sheets", role = "barrido")
    payload[[alias]] <- "Componente"
    source <- .monitoreo_source_from_payload(payload)
    expect_equal(source$actor_var, "Componente", info = alias)
  }
})

test_that("un payload sin actor_var deja el campo vacio, no NULL", {
  source <- .monitoreo_source_from_payload(list(kind = "google_sheets", role = "barrido"))
  expect_identical(source$actor_var, "")
})

test_that("dimension_vars generaliza el mecanismo a sede y tramite", {
  # `acnur_pdm` quedo con dimensions = list(sede = "sede", ...), es decir el
  # NOMBRE de la columna guardado como etiqueta constante: sus 2726 filas
  # dicen dim_sede == "sede". Esta es la forma de expresar lo que se queria.
  source <- monitoreo_normalize_sources(list(list(
    kind = "google_sheets",
    label = "Barrido PDM",
    dimension_vars = list(sede = "sede", tramite = "tramite")
  )))[[1]]

  data <- .monitoreo_add_source_columns(
    data.frame(
      sede = c("Lima", "Tumbes"),
      tramite = c("Renovación", "Primera vez"),
      stringsAsFactors = FALSE
    ),
    source
  )

  expect_equal(data$dim_sede, c("Lima", "Tumbes"))
  expect_equal(data$dim_tramite, c("Renovación", "Primera vez"))
})

test_that("el avance por actor deja de reportar universo 0 con una sola hoja", {
  # La regresion completa: dos actores en una hoja, un solo registro de fuente.
  source <- monitoreo_normalize_sources(list(list(
    kind = "google_sheets",
    label = "Base de barrido",
    role = "barrido",
    actor_var = "Componente"
  )))[[1]]

  data <- .monitoreo_add_source_columns(
    data.frame(
      estado = c("completed", "completed", "rejected", "completed"),
      Componente = c(
        "Homologación Laboral", "Homologación Laboral",
        "Vinculación Laboral", "Vinculación Laboral"
      ),
      stringsAsFactors = FALSE
    ),
    source
  )

  dash <- monitoreo_build_dashboard(data, list(
    status_var = "estado",
    valid_statuses = "completed",
    goals = list(
      list(filters = list(dim_actor = "Homologación Laboral"), meta = 80L),
      list(filters = list(dim_actor = "Vinculación Laboral"), meta = 20L)
    )
  ))

  expect_true("dim_actor" %in% names(dash$progress))
  expect_equal(dash$progress$observado[dash$progress$dim_actor == "Homologación Laboral"], 2L)
  expect_equal(dash$progress$observado[dash$progress$dim_actor == "Vinculación Laboral"], 1L)
})
