# La lista de pestañas que la publicación a Sheets tiene permiso de escribir.
#
# Unidad B1 (2026-08-31). Hoy la lista vive en
# `.monitoreo_sheets_controlled_tab_names()` (monitoreo_engine.R, archivo
# congelado a crecimiento), trae «Tabla maestra» DOS veces (99 entradas, 98
# únicas — medido) y no trae ni las pestañas del ejecutivo de aulas ni las del
# libro operativo. La consecuencia medida hoy: publicar el ejecutivo de aulas
# revienta en `.monitoreo_sheets_validate_controlled_tabs` —a client le faltan
# «Resumen de aulas», «Avance agregado» y «Cuotas y brechas»; a internal
# «Agenda de aulas», «Avance por aula», «Reemplazos», «Validación» y
# «Consultas»— y ningún test lo cubría.
#
# Contrato congelado: `monitoreo_sheets_pestanas_controladas()` vive en su
# archivo propio (`R/monitoreo_sheets_pestanas.R`, porque el engine está
# congelado), sin duplicados, contiene todo lo que los dos generadores de
# nombres de publicación declaran por familia × audiencia MÁS las cinco hojas
# del libro de aulas, y el engine queda delegando en ella.

.msp_familias <- c("territorial", "aulas_universitarias", "telefonico", "acreditacion")
.msp_audiencias <- c("client", "internal")

# Los nombres del libro tal como los produce la app y los relee
# `aulas_libro_leer_de_sheets()`: las tres hojas de datos vienen de
# `AULAS_LIBRO_HOJAS` (carga_aulas_libro.R); «Avance de campo» y «Listas» de
# los generadores de indicadores y formato.
.msp_hojas_libro <- c(
  "Aulas Agendadas",
  "Aulas Aplicadas (Campo)",
  "Base de control",
  # A13a (2026-08-31): era «Cómo va el campo»; Gonzalo: «es AVANCE».
  "Avance de campo",
  # Dictado 2026-09-08: la hoja que reemplaza a «Tabla dinámica 2». Va en esta
  # lista porque una pestaña que el publicador produce y la lista controlada no
  # nombra revienta la publicación ENTERA, no sólo su hoja.
  "Avance de agendación",
  "Listas"
)

test_that("la lista controlada nueva existe y no trae nombres duplicados", {
  expect_true(exists("monitoreo_sheets_pestanas_controladas", mode = "function"))
  lista <- monitoreo_sheets_pestanas_controladas()
  expect_true(is.character(lista))
  expect_gt(length(lista), 0L)
  # Hoy el duplicado es «Tabla maestra»; la lista nueva no admite ninguno.
  expect_identical(anyDuplicated(lista), 0L)
})

test_that("toda pestaña de publicación declarada por familia y audiencia está contenida", {
  # Cálcalo del patrón de test-monitoreo-engine.R (publicación ejecutiva en
  # Sheets valida sus pestañas), pero recorriendo TODAS las familias: la de
  # aulas es la que hoy queda fuera y revienta con E_GOOGLE_SHEETS.
  lista <- monitoreo_sheets_pestanas_controladas()
  for (familia in .msp_familias) {
    for (audiencia in .msp_audiencias) {
      declaradas <- unique(c(
        unname(.monitoreo_publication_tab_names(familia, audiencia)),
        unname(.monitoreo_publication_sheet_tab_names(familia, audiencia))
      ))
      faltan <- setdiff(declaradas, lista)
      expect_identical(
        faltan, character(0),
        info = sprintf("pestañas de %s/%s fuera de la lista controlada", familia, audiencia)
      )
    }
  }
})

test_that("las hojas del libro de aulas están contenidas", {
  lista <- monitoreo_sheets_pestanas_controladas()
  faltan <- setdiff(.msp_hojas_libro, lista)
  expect_identical(faltan, character(0), info = "hojas del libro fuera de la lista controlada")
  # Y las tres de datos con el nombre EXACTO de la spec del lector, para que el
  # nombre no pueda derivar por su cuenta en la lista.
  hojas_spec <- vapply(AULAS_LIBRO_HOJAS, function(x) x$hoja, character(1))
  expect_true(all(hojas_spec %in% lista))
})

test_that("el engine delega: la lista vieja y la nueva son la misma", {
  # `.monitoreo_sheets_controlled_tab_names()` queda como cáscara que delega;
  # dos listas que nadie ata es exactamente el patrón que se traga pestañas.
  expect_identical(
    .monitoreo_sheets_controlled_tab_names(),
    monitoreo_sheets_pestanas_controladas()
  )
})

test_that("el validador acepta el ejecutivo de aulas en ambas audiencias (defecto latente)", {
  # Este test NO necesita la función nueva: falla HOY contra el validador real
  # con «La publicacion solo puede escribir pestanas controladas de monitoreo:
  # …». Es el defecto que nadie cubría.
  tabs_client <- unname(.monitoreo_publication_tab_names("aulas_universitarias", "client"))
  tabs_internal <- unname(.monitoreo_publication_tab_names("aulas_universitarias", "internal"))
  expect_silent(.monitoreo_sheets_validate_controlled_tabs(tabs_client))
  expect_silent(.monitoreo_sheets_validate_controlled_tabs(tabs_internal))
})

test_that("el validador acepta las hojas del libro de aulas (siembra y base de control)", {
  # Sin esto, `monitoreo_aulas_publicar_libro()` no puede pasar por
  # `monitoreo_sheets_publish_tabs()`: el motor valida nombres antes de escribir.
  expect_silent(.monitoreo_sheets_validate_controlled_tabs(.msp_hojas_libro))
})

test_that("la lista vive en su archivo propio (monitoreo_engine.R está congelado)", {
  r_dir <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(r_dir), "sin fuentes R/ a mano (paquete instalado)")
  expect_true(file.exists(file.path(r_dir, "monitoreo_sheets_pestanas.R")))
})
