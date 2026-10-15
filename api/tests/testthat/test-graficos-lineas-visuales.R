source("setup-load-all.R")

# ID3 del rediseño (2026-10-15), decisión D7: las líneas visuales propias se guardan en la app (fuera del .pulso) y
# sirven para todos los estudios. El directorio de datos se redirige a un temporal: la suite nunca escribe en el HOME.

.lv_en_tmp <- function(env = parent.frame()) {
  d <- tempfile("lv_app_"); dir.create(d)
  withr::local_options(list(prosecnurapp.dir_datos_app = d), .local_envir = env)
  d
}

.lv_cuerpo <- function(titulo = "Mi línea") list(
  titulo_humano = titulo, descripcion = "Azul y gris",
  preview_colors = list("#003366", "#999999", "no-es-color"),
  presets = list(base = list(size_titulo = 20)), paletas = list(sino = list(`Sí` = "#003366", No = "#999999")),
  overrides_reusables = list(), scope_rules = list(global = list(template_id = "generic_16_9")),
  incluye = list(colores = TRUE, portada = FALSE)
)

test_that("guardar, leer y reemplazar una línea propia; el profile_id es su id y las fechas las pone el servidor", {
  d <- .lv_en_tmp()
  expect_identical(.lv_leer(), list())
  l <- .lv_guardar("lv-mi-linea", .lv_cuerpo())
  expect_identical(l$origen, "propia")
  expect_identical(l$scope_rules$global$profile_id, "lv-mi-linea")
  expect_identical(l$scope_rules$global$template_id, "generic_16_9")
  expect_identical(unlist(l$preview_colors), c("#003366", "#999999"))   # lo que no es color no entra
  expect_identical(l$incluye, list(colores = TRUE, portada = FALSE, letra = TRUE, logos = TRUE))
  expect_true(file.exists(file.path(d, "lineas_visuales.json")))

  creada <- l$creada
  l2 <- .lv_guardar("lv-mi-linea", .lv_cuerpo("Renombrada"))
  expect_identical(l2$titulo_humano, "Renombrada")
  expect_identical(l2$creada, creada)
  leidas <- .lv_leer()
  expect_length(leidas, 1L)
  expect_identical(leidas[[1]]$titulo_humano, "Renombrada")
})

test_that("valida id, nombre y forma; eliminar una que no existe es 404", {
  .lv_en_tmp()
  expect_error(.lv_guardar("Mi Linea", .lv_cuerpo()), class = "api_error")
  expect_error(.lv_guardar("lv-sin-nombre", utils::modifyList(.lv_cuerpo(), list(titulo_humano = "  "))), "nombre")
  mala <- .lv_cuerpo(); mala$presets <- list(1, 2)   # sin nombres: no es un objeto (modifyList lo fusionaría)
  expect_error(.lv_guardar("lv-forma", mala), "objeto")
  expect_error(.lv_eliminar("lv-no-esta"), class = "api_error")
  .lv_guardar("lv-una", .lv_cuerpo()); .lv_guardar("lv-dos", .lv_cuerpo("Dos"))
  .lv_eliminar("lv-una")
  expect_identical(vapply(.lv_leer(), `[[`, "", "id"), "lv-dos")
})

test_that("un archivo ilegible se lee vacío, sin tumbar la pestaña", {
  d <- .lv_en_tmp()
  writeLines("{ esto no es json", file.path(d, "lineas_visuales.json"))
  expect_message(expect_identical(.lv_leer(), list()), "no se pudo leer")
})

# Las rutas tal como las sirve Plumber: PUT con cuerpo, GET y DELETE con el header de sesión.
.lv_llamar <- function(sid, metodo, ruta, cuerpo = NULL) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_lineas(plumber::pr())
  bytes <- if (is.null(cuerpo)) raw(0) else charToRaw(enc2utf8(jsonlite::toJSON(cuerpo, auto_unbox = TRUE)))
  entrada <- list(read = function(...) bytes, rewind = function() invisible(0), read_lines = function(...) rawToChar(bytes))
  req <- as.environment(list(REQUEST_METHOD = metodo, PATH_INFO = ruta, QUERY_STRING = "", HTTP_X_PULSO_SESSION = sid,
                             HEADERS = c(`x-pulso-session` = sid, `content-type` = "application/json"), rook.input = entrada))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("las tres rutas: PUT crea, GET lista, DELETE borra", {
  .lv_en_tmp()
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- .lv_llamar(sid, "PUT", "/api/graficos/lineas-visuales/lv-ruta", .lv_cuerpo("Por la ruta"))
  expect_identical(r$status, 200L)
  expect_identical(unlist(r$body$linea$titulo_humano), "Por la ruta")   # Plumber serializa escalares como [x]
  g <- .lv_llamar(sid, "GET", "/api/graficos/lineas-visuales")
  expect_identical(vapply(g$body$lineas, function(l) unlist(l$id), ""), "lv-ruta")
  b <- .lv_llamar(sid, "DELETE", "/api/graficos/lineas-visuales/lv-ruta")
  expect_identical(b$status, 200L)
  expect_identical(.lv_llamar(sid, "GET", "/api/graficos/lineas-visuales")$body$lineas, list())
  expect_identical(.lv_llamar(sid, "DELETE", "/api/graficos/lineas-visuales/lv-ruta")$status, 404L)
})
