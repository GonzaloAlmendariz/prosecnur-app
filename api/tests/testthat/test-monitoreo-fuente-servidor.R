# **La fuente hereda el servidor de su perfil de conexión.**
#
# Medido el 2026-09-09 sobre HSVG2026: el perfil vivo era PULSOEU (europeo) y
# declarar la fuente con su `connection_profile_id` contestaba «Proyecto Kobo no
# encontrado. Verifica el asset UID.», porque `base_url` ya venía relleno con el
# Kobo GLOBAL y tapaba al perfil. El mensaje culpaba al asset y el asset estaba
# bien: el mismo formulario salía el primero al listar los del perfil.

test_that("lo declarado en el cuerpo gana siempre", {
  expect_equal(
    prosecnurapp:::.monitoreo_fuente_base_url("https://otro.example", "kobo", "perfil_x"),
    "https://otro.example")
})

test_that("sin base_url, la hereda del perfil y NO del default del proveedor", {
  # Es el mutante que importa: la versión con el defecto devuelve el global.
  testthat::local_mocked_bindings(
    .connections_profile_base_url = function(provider, profile_id = NULL, base_url = NULL) {
      if (identical(provider, "kobo") && identical(profile_id, "pulsoeu")) {
        "https://eu.kobotoolbox.org"
      } else ""
    },
    .package = "prosecnurapp"
  )
  out <- prosecnurapp:::.monitoreo_fuente_base_url("", "kobo", "pulsoeu")
  expect_equal(out, "https://eu.kobotoolbox.org")
  expect_false(identical(out, kobo_api_default_base_url()))
})

test_that("sin perfil cae al default del proveedor, que es lo de antes", {
  expect_equal(prosecnurapp:::.monitoreo_fuente_base_url("", "kobo", ""),
               kobo_api_default_base_url())
  expect_equal(prosecnurapp:::.monitoreo_fuente_base_url(NULL, "surveymonkey", ""),
               "https://api.surveymonkey.com/v3")
  # Google Sheets no tiene servidor que heredar.
  expect_equal(prosecnurapp:::.monitoreo_fuente_base_url("", "google_sheets", "x"), "")
})

test_that("un perfil que ya no existe no revienta: cae al default", {
  # El caso real: el proyecto seguía nombrando el perfil KOBOEU borrado. Ahí lo
  # que hace falta es que la app siga contestando, no que se caiga.
  testthat::local_mocked_bindings(
    .connections_profile_base_url = function(...) stop("perfil inexistente"),
    .package = "prosecnurapp"
  )
  expect_equal(prosecnurapp:::.monitoreo_fuente_base_url("", "kobo", "borrado"),
               kobo_api_default_base_url())
})
