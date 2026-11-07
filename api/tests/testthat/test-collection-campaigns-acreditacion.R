# Acreditación por público y ronda (ADR 0125 §5 y A4): cada ronda telefónica que declara el Modelo de Monitoreo
# es una campaña propia, relacionada con la de la ronda anterior. Fuera de acreditación nada cambia.

.macrt_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.macrt_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.planner_modos = function(s) list(material = list(proposito = "acreditacion")), .env = env)
  sid <- session_create()
  s <- session_get(sid)
  s$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion", units = list(
    list(id = "egresados", actor = "Egresados", label = "Egresados", canales = list(
      list(ronda = 1L, canal = "correo"), list(ronda = 2L, canal = "telefonico"), list(ronda = 3L, canal = "telefonico"))),
    list(id = "empleadores", actor = "Empleadores", label = "Empleadores", canales = list(list(ronda = 1L, canal = "correo"))))))
  .session_env[[sid]] <- s
  sid
}

.macrt_tipo <- function(sid) Filter(function(t) identical(t$tipo, "telefonica"), collection_campaigns_get(sid)$tipos)[[1]]

test_that("cada ronda telefónica del Modelo es una campaña, relacionada con la anterior del mismo público", {
  sid <- .macrt_sesion(); on.exit(session_delete(sid), add = TRUE)
  t <- .macrt_tipo(sid)
  expect_true(t$disponible)
  expect_identical(vapply(t$rondas_libres, `[[`, "", "id"), c("telefonica.egresados-r2", "telefonica.egresados-r3"))
  # Sin elegir con dos libres, se pide.
  expect_identical(.macrt_code(collection_campaign_create(sid, "telefonica", "Acreditación telefónica")), "E_COLLECTION_CAMPAIGN_TELEFONICA_SIN_RONDA")
  r2 <- collection_campaign_create(sid, "telefonica", "Acreditación telefónica · egresados", publico = "Egresados", ronda = 2)
  expect_identical(r2$campaign$id, "telefonica.egresados-r2")
  expect_identical(r2$campaign$proposito, "acreditacion")
  expect_identical(r2$campaign$relacion$publico, "Egresados")
  expect_identical(r2$campaign$relacion$ronda, 2L)
  expect_null(r2$campaign$relacion$viene_de)  # la ronda 1 es de correo: no vive en el registro
  # Queda una libre: se toma sola, y viene de la ronda 2.
  r3 <- collection_campaign_create(sid, "telefonica", "Acreditación telefónica · egresados 2")
  expect_identical(r3$campaign$id, "telefonica.egresados-r3")
  expect_identical(r3$campaign$relacion$viene_de, "telefonica.egresados-r2")
  t2 <- .macrt_tipo(sid)
  expect_false(t2$disponible)
  expect_match(t2$motivo, "Cada ronda telefónica")
  expect_identical(.macrt_code(collection_campaign_create(sid, "telefonica", "Otra")), "E_COLLECTION_CAMPAIGN_TELEFONICA_SIN_RONDA")
})

test_that("cada campaña de ronda tiene su propia configuración y su plantilla", {
  sid <- .macrt_sesion(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_create(sid, "telefonica", "Ronda 2", publico = "Egresados", ronda = 2)
  collection_campaign_create(sid, "telefonica", "Ronda 3", publico = "Egresados", ronda = 3)
  collection_telefonica_config_put(sid, "telefonica.egresados-r2", muestra = 100, expected_revision = 0L)
  collection_telefonica_config_put(sid, "telefonica.egresados-r3", muestra = 40, llave = "DNI caso", expected_revision = 0L)
  expect_identical(collection_telefonica_config_get(sid, "telefonica.egresados-r2")$muestra, 100L)
  expect_identical(collection_telefonica_config_get(sid, "telefonica.egresados-r3")$muestra, 40L)
  expect_identical(collection_telefonica_config_get(sid, "telefonica.egresados-r2")$llave, "Código")
  # La primera vive arriba, como siempre; la segunda, en por_campana.
  x <- session_get(sid)$material_telefonica_config
  expect_identical(x$campaign_id, "telefonica.egresados-r2")
  expect_identical(x$por_campana[["telefonica.egresados-r3"]]$muestra, 40L)
  expect_true(nzchar(collection_telefonica_plantilla(sid, "telefonica.egresados-r3")$file_id))
  # Se renombran por separado.
  m <- collection_campaign_meta_put(sid, "telefonica.egresados-r3", name = "Llamadas finales")
  expect_identical(m$campaign$name, "Llamadas finales")
  expect_identical(Find(function(c) identical(c$id, "telefonica.egresados-r2"), collection_campaigns_get(sid)$campaigns)$name, "Ronda 2")
})

test_that("fuera de acreditación la telefónica sigue siendo una sola, la principal", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_campaign_create(sid, "telefonica", "Barrido")
  expect_identical(r$campaign$id, "telefonica.principal")
  expect_null(r$campaign$relacion)
  expect_identical(.macrt_code(collection_campaign_create(sid, "telefonica", "Otra")), "E_COLLECTION_CAMPAIGN_TELEFONICA_UNICA")
})
