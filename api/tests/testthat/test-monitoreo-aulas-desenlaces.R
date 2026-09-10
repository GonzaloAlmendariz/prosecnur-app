# Los tres desenlaces del libro: reemplazo (A), complemento (B) y refuerzo (C).
#
# Gonzalo, 2026-09-10: «quiero empezar a ver la parte de reemplazos para aulas
# complementarias (B) o aulas de refuerzo (C)».

plan_ejemplo <- function() {
  data.frame(
    operational_code = c("CH 1", "CH 2", "CH 3", "R 1.1", "R 2.1", "E 1", "CH 4"),
    titular_operational_code = c("CH 1", "CH 2", "CH 3", "CH 1", "CH 2", "", "CH 4"),
    sample_role = c("titular", "titular", "titular", "chain_reserve", "chain_reserve",
                    "extra_reserve_pool", "titular"),
    faculty = c("DERECHO", "DERECHO", "LETRAS", "DERECHO", "DERECHO", "LETRAS", "LETRAS"),
    application_status = c("REEMPLAZADA POR", "COMPLEMENTADA CON", "APLICADA",
                           "APLICADA", "APLICADA", "APLICADA DE REFUERZO", "COMPLEMENTADA CON"),
    aula_utilizada = c("R 1.1", "R 2.1", "", "", "", "", ""),
    replacement_reason = c("El docente rechazo", "", "", "", "", "", ""),
    effective_surveys = c(0, 12, 20, 18, 9, 15, 7),
    stringsAsFactors = FALSE
  )
}

test_that("los tres verbos del libro dejan de caer en 'pendiente'", {
  # Es el defecto de raiz: la lista cerrada se tragaba lo que no conocia y un
  # aula aplicada de refuerzo se contaba como si nadie la hubiera tocado.
  expect_equal(monitoreo_aulas_desenlace_aplicacion("REEMPLAZADA POR"), "reemplazada_por")
  expect_equal(monitoreo_aulas_desenlace_aplicacion("COMPLEMENTADA CON"), "complementada_con")
  expect_equal(monitoreo_aulas_desenlace_aplicacion("APLICADA DE REFUERZO"), "aplicada_de_refuerzo")
  expect_equal(monitoreo_aulas_desenlace_aplicacion("POR APLICAR"), "pendiente")
  expect_equal(monitoreo_aulas_desenlace_aplicacion(""), "pendiente")
})

test_that("el estado grueso agrupa por si el aula se visito o no", {
  # B y C SON aplicaciones: el aula se visito y dejo encuestas. A no lo es: es
  # el titular que cayo.
  expect_equal(monitoreo_aulas_estado_aplicacion("COMPLEMENTADA CON"), "aplicada")
  expect_equal(monitoreo_aulas_estado_aplicacion("APLICADA DE REFUERZO"), "aplicada")
  expect_equal(monitoreo_aulas_estado_aplicacion("REEMPLAZADA POR"), "no_aplicada")
  # Y las dos de siempre no se mueven.
  expect_equal(monitoreo_aulas_estado_aplicacion("APLICADA"), "aplicada")
  expect_equal(monitoreo_aulas_estado_aplicacion("NO APLICADA"), "no_aplicada")
})

test_that("reparte A, B y C por separado", {
  r <- monitoreo_aulas_desenlaces_por_tipo(plan_ejemplo())
  expect_equal(r$reemplazadas$total, 1L)
  expect_equal(r$complementadas$total, 2L)
  expect_equal(r$refuerzos$total, 1L)
  expect_equal(r$total, 4L)
})

test_that("A y B se leen del TITULAR; C, de la reserva", {
  # Contar C desde un titular inflaria los refuerzos con aulas que nadie salio
  # a reforzar, y contar A desde la reserva declararia reemplazada a la que
  # entro a cubrir.
  df <- plan_ejemplo()
  df$application_status[df$operational_code == "R 1.1"] <- "REEMPLAZADA POR"
  df$application_status[df$operational_code == "CH 3"] <- "APLICADA DE REFUERZO"
  r <- monitoreo_aulas_desenlaces_por_tipo(df)
  expect_equal(r$reemplazadas$total, 1L)   # sigue siendo solo CH 1
  expect_equal(r$refuerzos$total, 1L)      # sigue siendo solo el extra E 1
})

test_that("dice con CUAL se resolvio cada caso", {
  r <- monitoreo_aulas_desenlaces_por_tipo(plan_ejemplo())
  expect_equal(r$reemplazadas$aulas[[1]]$codigo, "CH 1")
  expect_equal(r$reemplazadas$aulas[[1]]$aula_utilizada, "R 1.1")
  expect_equal(r$reemplazadas$aulas[[1]]$motivo, "El docente rechazo")
})

test_that("cuenta los que NO dicen con cual: es media frase", {
  # Los dos verbos terminan en preposicion porque piden un CUAL; sin el no se
  # puede seguir la cadena. CH 4 esta complementada y no dice con quien.
  expect_equal(monitoreo_aulas_desenlaces_por_tipo(plan_ejemplo())$sin_aula_utilizada, 1L)
})

test_that("reparte por facultad, de mayor a menor", {
  r <- monitoreo_aulas_desenlaces_por_tipo(plan_ejemplo())
  expect_equal(r$complementadas$por_facultad[[1]]$facultad, "DERECHO")
  expect_equal(r$complementadas$por_facultad[[1]]$aulas, 1L)
  expect_equal(length(r$complementadas$por_facultad), 2L)
})

test_that("un plan sin desenlaces devuelve la MISMA forma con ceros", {
  # Un consumidor que recibe NULL en un caso y una lista en otro acaba con dos
  # ramas, y una de las dos se prueba sola.
  df <- plan_ejemplo()
  df$application_status <- "POR APLICAR"
  r <- monitoreo_aulas_desenlaces_por_tipo(df)
  expect_equal(r$total, 0L)
  expect_equal(r$refuerzos$total, 0L)
  expect_equal(r$refuerzos$por_facultad, list())
  expect_equal(r$sin_aula_utilizada, 0L)
})

test_that("sin plan no se cae", {
  expect_equal(monitoreo_aulas_desenlaces_por_tipo(NULL)$total, 0L)
  expect_equal(monitoreo_aulas_desenlaces_por_tipo(data.frame())$total, 0L)
})

test_that("un plan sin la columna del libro no inventa desenlaces", {
  # Un libro viejo sin «STATUS DE APLICACION» se lee igual: todo pendiente.
  df <- plan_ejemplo()
  df$application_status <- NULL
  expect_equal(monitoreo_aulas_desenlaces_por_tipo(df)$total, 0L)
})
