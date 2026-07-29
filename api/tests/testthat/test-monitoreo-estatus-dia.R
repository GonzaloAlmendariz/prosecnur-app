# El bloque `estatus_dia` alimenta la barra apilada de estados telefónicos por
# día. Se publicaba solo cuando la familia era "telefonico", así que una
# acreditación con barrido —el caso de acrconta— se quedaba sin serie temporal
# de estados aunque el motor ya la calculaba.
#
# El segundo test fija la semántica de la que depende el apilado: la matriz es
# una PARTICIÓN de los casos barridos (cada caso aparece una sola vez, en su día
# y su estado). Eso es lo que permite derivar la fotografía acumulada de un día
# sumando los anteriores. Si alguien la convirtiera en un histograma de eventos,
# el acumulado contaría casos repetidos y el gráfico mentiría.

.med_phone_data <- function() {
  data.frame(
    CodPulso = c("C1", "C2", "C3", "C4", "C1", "C2"),
    Status = c("Completa", "No contesta", "No barrido", "Rechazo", "completed", "completed"),
    Responsable = c("Ana", "Luis", "Ana", "Luis", "", ""),
    Fecha = c("2026-06-01", "2026-06-01", "2026-06-02", "2026-06-02", "2026-06-01", "2026-06-02"),
    Distrito = c("Lima", "Callao", "Lima", "Callao", "Lima", "Callao"),
    .source_actor = rep("Egresados", 6),
    dim_canal = c(rep("Telefonico", 4), rep("Correo", 2)),
    .source_role = c("barrido", "barrido", "barrido", "barrido", "respuestas", "respuestas"),
    .source_label = c(
      rep("Barrido telefonico - Civil", 4),
      rep("Encuesta Civil - Correo", 2)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.med_cfg <- function(data, family = "acreditacion") {
  monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = family,
      variant = "segmentada_por_carrera",
      units = list(list(
        id = "egresados",
        actor = "Egresados",
        label = "Egresados",
        phone = list(enabled = TRUE, role = "target")
      )),
      segments = list(list(id = "Civil", label = "Civil", actor = "Egresados")),
      minimums = list(Civil = 2)
    ),
    control_vars = c("Distrito")
  ), data)
}

.med_blocks <- function(family = "acreditacion") {
  data <- .med_phone_data()
  reports <- monitoreo_acreditacion_reportes(data, .med_cfg(data, family), report_scope = "phone_summary")
  phone <- reports$sheets[[1]]
  stats::setNames(phone$blocks, vapply(phone$blocks, `[[`, character(1), "id"))
}

test_that("estatus_dia se publica tambien en acreditacion, no solo en telefonico puro", {
  acreditacion <- .med_blocks("acreditacion")
  expect_true("estatus_dia" %in% names(acreditacion))

  rows <- .monitoreo_internal_records_to_df(acreditacion$estatus_dia$rows)
  expect_true(nrow(rows) > 0L)
  expect_true("Estado" %in% names(rows))
  # Una columna por dia observado en el barrido, ademas de Estado y Total.
  expect_true(all(c("2026-06-01", "2026-06-02") %in% names(rows)))
})

test_that("la matriz de estatus_dia reparte cada caso barrido una sola vez", {
  rows <- .monitoreo_internal_records_to_df(.med_blocks("acreditacion")$estatus_dia$rows)
  day_columns <- setdiff(names(rows), c("Estado", "Total"))
  celdas <- sum(vapply(day_columns, function(column) {
    sum(suppressWarnings(as.numeric(rows[[column]])), na.rm = TRUE)
  }, numeric(1)))

  # Cuatro filas de barrido en el fixture, cada una con su dia y su estado.
  expect_equal(celdas, 4)
  expect_equal(celdas, sum(suppressWarnings(as.numeric(rows$Total)), na.rm = TRUE))
})

test_that("el telefonico puro conserva el bloque", {
  expect_true("estatus_dia" %in% names(.med_blocks("telefonico")))
})
