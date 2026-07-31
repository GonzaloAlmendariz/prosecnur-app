# Regresión del bloque `cuotas_variable`: una dimensión con dos nombres emitía
# la cuota dos veces y duplicaba el mínimo del estudio.
#
# Reproduce la forma real de PDM MedVida 2026: `Actor` declarada en
# `control_vars` y `dim_actor` derivada por el normalizador con el mismo texto.

test_that("una dimensión con dos nombres aporta una sola variable de cuota", {
  phone <- data.frame(
    Actor = c(rep("Homologación de Títulos", 3L), rep("Vinculación Laboral", 2L)),
    dim_actor = c(rep("Homologación de Títulos", 3L), rep("Vinculación Laboral", 2L)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  expect_identical(
    .monitoreo_phone_quota_vars_unicas(phone, c("Actor", "dim_actor")),
    "Actor"
  )
})

test_that("gana la variable declarada, no la derivada", {
  phone <- data.frame(
    dim_actor = c("A", "A", "B"),
    Actor = c("A", "A", "B"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  # El orden recibido es el de prioridad: quien llega primero sobrevive.
  expect_identical(.monitoreo_phone_quota_vars_unicas(phone, c("Actor", "dim_actor")), "Actor")
  expect_identical(.monitoreo_phone_quota_vars_unicas(phone, c("dim_actor", "Actor")), "dim_actor")
})

test_that("dos dimensiones que agrupan igual pero no dicen lo mismo se conservan", {
  # `Actor` y `distrito` particionan idéntico en este corte, y aun así son
  # cuotas distintas: descartarlas por la partición perdería una meta real.
  phone <- data.frame(
    Actor = c("Homologación de Títulos", "Homologación de Títulos", "Vinculación Laboral"),
    distrito = c("Lima", "Lima", "Arequipa"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  expect_identical(
    .monitoreo_phone_quota_vars_unicas(phone, c("Actor", "distrito")),
    c("Actor", "distrito")
  )
})

test_that("las variables que no existen en la base pasan sin evaluarse", {
  phone <- data.frame(Actor = c("A", "B"), stringsAsFactors = FALSE, check.names = FALSE)

  expect_identical(
    .monitoreo_phone_quota_vars_unicas(phone, c("Actor", "grupo")),
    c("Actor", "grupo")
  )
})

test_that("sin base no se descarta nada", {
  expect_identical(
    .monitoreo_phone_quota_vars_unicas(data.frame(), c("Actor", "dim_actor")),
    c("Actor", "dim_actor")
  )
})

test_that("el bloque de cuotas emite una fila por actor, no una por alias", {
  # Sin el fix salían cuatro filas y el mínimo del estudio se iba a 200.
  phone <- data.frame(
    Actor = c(rep("Homologación de Títulos", 4L), rep("Vinculación Laboral", 2L)),
    dim_actor = c(rep("Homologación de Títulos", 4L), rep("Vinculación Laboral", 2L)),
    Status = c("Completa", "Completa", "Sin respuesta", "Sin respuesta", "Completa", "Sin respuesta"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- list(
    control_vars = list("Actor"),
    goals = list(
      list(filters = list(Actor = "Homologación de Títulos"), meta = 80),
      list(filters = list(Actor = "Vinculación Laboral"), meta = 20)
    )
  )

  quotas <- .monitoreo_report_phone_quota_df(
    phone,
    profile = list(family = "telefonico"),
    cfg = cfg,
    effective_mask = phone$Status == "Completa"
  )

  expect_equal(nrow(quotas), 2L)
  expect_setequal(quotas$Valor, c("Homologación de Títulos", "Vinculación Laboral"))
  expect_identical(unique(quotas$Variable), "Actor")
  # El mínimo del estudio es el declarado, no el doble.
  expect_equal(sum(quotas$Meta), 100L)
})
