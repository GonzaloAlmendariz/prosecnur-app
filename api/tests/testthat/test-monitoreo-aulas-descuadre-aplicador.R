# El descuadre del parte nombra a QUIÉN preguntarle.
#
# ADR 0077, cláusula 4: «toda alerta de calidad nombra a quién llamar y qué
# preguntarle, o no se emite. "Revisar duración" no le sirve a nadie; "¿Mary ya
# actualizó el formulario en su equipo?" sí. Una alerta sin destinatario no es
# una alerta: es una métrica con tipografía de urgencia».
#
# El aviso decía el aula y su aritmética —«CH 31: 26 asistentes menos 1
# rechazos y 3 duplicados dan 22, pero el parte declara 21 efectivas»— y ahí se
# paraba. Quien lo lee tiene que ir a otra pantalla a averiguar quién estuvo en
# esa aula para poder preguntarle.
#
# El dato estaba a un campo de distancia: `monitoreo_aulas_universitarias.R`
# compone `applied_by` en el parte, con sus alias `aplicador` y `aplicadora`.
# Lo que faltaba era llevarlo del parte al hallazgo.

.dap_parte <- function(...) {
  base <- list(operational_code = "CH 31", observed_students = 26,
               refusals = 1, duplicates = 3, effective_surveys = 21)
  utils::modifyList(base, list(...))
}

test_that("el hallazgo lleva el aplicador del parte", {
  h <- monitoreo_aulas_reconciliacion_partes(list(.dap_parte(applied_by = "Equipo A")))
  expect_length(h, 1L)
  expect_identical(h[[1]]$aplicador, "Equipo A")
})

test_that("el texto del aviso dice a quién preguntarle", {
  h <- monitoreo_aulas_reconciliacion_partes(list(.dap_parte(applied_by = "Equipo A")))
  txt <- monitoreo_aulas_descuadre_texto(h[[1]])
  expect_match(txt, "CH 31")
  expect_match(txt, "Equipo A")
})

test_that("sin aplicador el aviso NO inventa un destinatario", {
  # Un parte sin `applied_by` es común al principio del campo. El aviso sigue
  # saliendo —la aritmética no cuadra igual— pero no se rellena con un «—» ni
  # con una frase que sugiera que hay alguien a quien llamar.
  h <- monitoreo_aulas_reconciliacion_partes(list(.dap_parte()))
  txt <- monitoreo_aulas_descuadre_texto(h[[1]])
  expect_match(txt, "CH 31")
  expect_false(grepl("aplic", txt, ignore.case = TRUE))
})

test_that("reconoce los alias que el motor ya acepta para el aplicador", {
  # `monitoreo_aulas_universitarias.R` compone `applied_by` desde `aplicador` y
  # `aplicadora`. Si la reconciliación sólo mirara la clave inglesa, un parte
  # leído del libro en castellano se quedaría sin destinatario.
  for (clave in c("aplicador", "aplicadora")) {
    p <- .dap_parte(); p[[clave]] <- "Equipo B"
    h <- monitoreo_aulas_reconciliacion_partes(list(p))
    expect_identical(h[[1]]$aplicador, "Equipo B", info = clave)
  }
})
