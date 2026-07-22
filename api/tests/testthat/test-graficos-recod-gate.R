# Gate de avisos por recodificaciones sin aplicar o con drift (núcleo puro).
# Ver graficos_recod_gate.R: detección, no bloqueo. El núcleo debe ser
# determinista y degradar sin romper.

# Helpers de fixture -----------------------------------------------------------

grupo <- function(codigo, etiqueta) {
  list(id = paste0("g_", codigo), codigo = codigo, etiqueta = etiqueta,
       respuestas = list(), origen = "existente")
}

cat_mat <- function(...) {
  pares <- list(...)
  lapply(pares, function(p) list(code = p[[1]], label = p[[2]]))
}

test_that("recod definida sin materializar produce aviso de pendiente", {
  catalog <- list(transport = list(
    grupo("walking", "A pie"),
    grupo("bus", "Combi/Bus")
  ))
  res <- graficos_recod_gate_evaluate(
    catalog,
    materialized = list(), # nada materializado
    parent_labels = list(transport = "Medio de transporte")
  )
  expect_equal(res$recod_pendientes, "transport")
  expect_length(res$recod_drift, 0)
  expect_true(any(grepl("Medio de transporte", res$warnings)))
  expect_true(any(grepl("definida pero sin aplicar", res$warnings)))
})

test_that("recod materializada consistente no genera ningún aviso", {
  catalog <- list(transport = list(
    grupo("walking", "A pie"),
    grupo("bus", "Combi/Bus")
  ))
  materialized <- list(transport_recod = cat_mat(
    c("walking", "A pie"),
    c("bus", "Combi/Bus")
  ))
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_length(res$recod_pendientes, 0)
  expect_length(res$recod_drift, 0)
  expect_length(res$warnings, 0)
})

test_that("categoría extra en lo materializado se detecta como drift", {
  catalog <- list(transport = list(
    grupo("walking", "A pie"),
    grupo("bus", "Combi/Bus"),
    grupo("other", "Otro")
  ))
  # materializado trae una categoría "13 | Moto / Bicicleta" ausente del catálogo
  materialized <- list(transport_recod = cat_mat(
    c("walking", "A pie"),
    c("bus", "Combi/Bus"),
    c("other", "Otro"),
    c("13", "Moto / Bicicleta")
  ))
  res <- graficos_recod_gate_evaluate(
    catalog, materialized,
    parent_labels = list(transport = "Medio de transporte")
  )
  expect_equal(res$recod_drift, "transport")
  expect_length(res$recod_pendientes, 0)
  expect_true(any(grepl("difiere del catálogo actual", res$warnings)))
})

test_that("renumeración de códigos con mismas etiquetas NO es drift", {
  # El proceso de aplicación remapea los códigos del analista (6/7 -> 99/100),
  # pero el significado (etiqueta) es idéntico. Comparar por código sería un
  # falso positivo en cada recod bien aplicada; se compara por etiqueta.
  catalog <- list(RECP02 = list(
    grupo("1", "Nada claro"),
    grupo("2", "Poco claro"),
    grupo("6", "Información limitada al trámite"),
    grupo("7", "Otros"),
    grupo("98", "Prefiere no decir")
  ))
  materialized <- list(RECP02_recod = cat_mat(
    c("1", "Nada claro"),
    c("2", "Poco claro"),
    c("99", "Información limitada al trámite"),
    c("100", "Otros"),
    c("98", "Prefiere no decir")
  ))
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_length(res$recod_drift, 0)
  expect_length(res$warnings, 0)
})

test_that("un valor especial presente solo en un lado no dispara drift", {
  # Los valores especiales (99 No responde, etc.) se remapean por etiqueta aguas
  # abajo; su presencia o ausencia en los choices no es drift del analista.
  catalog <- list(x = list(
    grupo("1", "Sí"),
    grupo("2", "No"),
    grupo("99", "No responde")
  ))
  materialized <- list(x_recod = cat_mat(
    c("1", "Sí"),
    c("2", "No")
  ))
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_length(res$recod_drift, 0)
})

test_that("label cambiado en un código común se detecta como drift", {
  catalog <- list(services = list(
    grupo("1", "Salud"),
    grupo("2", "Educación")
  ))
  materialized <- list(services_recod = cat_mat(
    c("1", "Salud"),
    c("2", "Trabajo") # etiqueta distinta para el mismo código
  ))
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_equal(res$recod_drift, "services")
})

test_that("diferencias solo de tildes/mayúsculas no cuentan como drift", {
  catalog <- list(transport = list(grupo("bus", "Combi/Bus (público)")))
  materialized <- list(transport_recod = cat_mat(c("bus", "combi/bus (publico)")))
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_length(res$recod_drift, 0)
  expect_length(res$warnings, 0)
})

test_that("materializada sin categorías comparables no dispara drift", {
  catalog <- list(transport = list(grupo("bus", "Combi/Bus")))
  # columna en data sin choices: presente pero sin categorías
  materialized <- list(transport_recod = list())
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_length(res$recod_pendientes, 0)
  expect_length(res$recod_drift, 0)
})

test_that("entrada de catálogo vacía se ignora (no genera pendiente)", {
  catalog <- list(
    reason_edp_other = list(), # sin grupos
    transport = list(grupo("bus", "Combi/Bus"))
  )
  res <- graficos_recod_gate_evaluate(catalog, materialized = list())
  expect_equal(res$recod_pendientes, "transport")
  expect_false("reason_edp_other" %in% res$recod_pendientes)
})

test_that("_recod materializada sin catálogo se lista como huérfana e informativa", {
  catalog <- list(transport = list(grupo("bus", "Combi/Bus")))
  materialized <- list(
    transport_recod = cat_mat(c("bus", "Combi/Bus")),
    RECP00_recod = cat_mat(c("1", "Sí"))
  )
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_true("RECP00_recod" %in% res$recod_orphan)
  # las huérfanas NO se surfacean como warnings (para no inundar proyectos legacy)
  expect_false(any(grepl("RECP00", res$warnings)))
})

test_that("un grupo con código vacío en catálogo no altera la comparación", {
  catalog <- list(transport = list(
    grupo("bus", "Combi/Bus"),
    grupo("", "") # grupo borrador sin código todavía
  ))
  materialized <- list(transport_recod = cat_mat(c("bus", "Combi/Bus")))
  res <- graficos_recod_gate_evaluate(catalog, materialized)
  expect_length(res$recod_drift, 0)
})

test_that("evaluate degrada con entradas nulas", {
  res <- graficos_recod_gate_evaluate(NULL, NULL, NULL)
  expect_length(res$recod_pendientes, 0)
  expect_length(res$recod_drift, 0)
  expect_length(res$warnings, 0)
})

# Lectura desde instrumento en memoria ----------------------------------------

test_that("materialización se extrae del survey + choices en memoria", {
  survey <- data.frame(
    type = c("select_one transport_recod"),
    name = c("transport_recod"),
    label = c("Medio (recod)"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("transport_recod", "transport_recod"),
    name = c("walking", "bus"),
    label = c("A pie", "Combi/Bus"),
    stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = choices)
  mat <- .graficos_recod_materialized_from_inst(inst)
  expect_true("transport_recod" %in% names(mat))
  codes <- vapply(mat$transport_recod, function(x) x$code, character(1))
  expect_setequal(codes, c("walking", "bus"))
})
