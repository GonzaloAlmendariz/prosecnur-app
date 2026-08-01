# Qué fuentes lee el modo «avance», por familia.
#
# El rojo que fija: el backend filtraba por `kind` sin mirar la familia, así que
# en telefónico la hoja de barrido nunca se sincronizaba desde el botón de
# avance. Sin barrido no hay base telefónica y todo el modelo queda en S/M.

.msf_fuente <- function(id, kind, role = "", ...) {
  monitoreo_normalize_sources(list(list(
    id = id, kind = kind, role = role, enabled = TRUE, label = id, ...
  )))[[1]]
}

.msf_ids <- function(sources) vapply(sources, function(s) s$id, character(1))

test_that("el avance telefónico lee las hojas del modelo y la encuesta", {
  # Mismo caso que fuentesSincronizables.test.ts en el frontend: las dos capas
  # tienen que responder lo mismo o el botón promete lo que el backend no hace.
  fuentes <- list(
    .msf_fuente("universo", "google_sheets", "universo"),
    .msf_fuente("barrido", "google_sheets", "barrido"),
    .msf_fuente("kobo", "kobo", "respuestas", asset_uid = "apY5yUWBJgszLAveNToaAr")
  )
  expect_equal(
    .msf_ids(monitoreo_fuentes_avance(fuentes, "telefonico")),
    c("universo", "barrido", "kobo")
  )
})

test_that("el avance de acreditación no arrastra las hojas", {
  fuentes <- list(
    .msf_fuente("sheets", "google_sheets", "universo"),
    .msf_fuente("sm", "surveymonkey", "respuestas"),
    .msf_fuente("kobo", "kobo", "respuestas")
  )
  expect_equal(.msf_ids(monitoreo_fuentes_avance(fuentes, "acreditacion")), c("sm", "kobo"))
})

test_that("una fuente sin rol sobrevive al avance en las dos familias", {
  # Una fuente conectada antes de que el rol existiera no puede quedar fuera
  # del avance por una migración.
  sin_rol <- list(.msf_fuente("vieja", "kobo", ""))
  expect_equal(.msf_ids(monitoreo_fuentes_avance(sin_rol, "telefonico")), "vieja")
  expect_equal(.msf_ids(monitoreo_fuentes_avance(sin_rol, "acreditacion")), "vieja")

  hoja_sin_rol <- list(.msf_fuente("hoja", "google_sheets", ""))
  expect_equal(.msf_ids(monitoreo_fuentes_avance(hoja_sin_rol, "telefonico")), "hoja")
  expect_equal(length(monitoreo_fuentes_avance(hoja_sin_rol, "acreditacion")), 0L)
})

test_that("una hoja de rol ajeno no entra al avance telefónico", {
  # `reporte_cliente` y `hoja_ruta` son salidas, no insumos del avance.
  fuentes <- list(
    .msf_fuente("salida", "google_sheets", "reporte_cliente"),
    .msf_fuente("barrido", "google_sheets", "barrido")
  )
  expect_equal(.msf_ids(monitoreo_fuentes_avance(fuentes, "telefonico")), "barrido")
})

test_that("la familia sale normalizada, no del texto crudo", {
  # monitoreo_normalize_profile reasigna a acreditacion lo que no reconoce; el
  # filtro tiene que decidir con la misma familia con la que se calculan los
  # reportes, no con lo que alguien haya escrito en el .pulso.
  expect_equal(monitoreo_config_family(list(monitoreo_profile = list(family = "telefonico"))), "telefonico")
  expect_equal(monitoreo_config_family(list(monitoreo_profile = list(family = "inventada"))), "acreditacion")
  expect_equal(monitoreo_config_family(list()), "acreditacion")
})
