# El marco firma con qué fuentes se construyó.
#
# Sin la firma, subir bases nuevas no invalida nada de lo derivado: la banda de
# KPIs seguia diciendo «UNIVERSO DE ESTUDIANTES 29,090 · marco vigente» y
# Consistencia «136,284 filas leidas» —de la base del año anterior— mientras el
# Explorador, en la MISMA seccion, leia el archivo nuevo y decia 137,919.

test_that("la firma recoge file_id y hoja de cada rol que el cliente mando", {
  body <- list(
    base_madre_file_id = "f-alumnos", base_madre_sheet = "Data",
    catalogo_curso_horario_file_id = "f-ch", catalogo_curso_horario_sheet = "Data"
  )
  firma <- .cm_aulas_sources_signature(body)
  expect_identical(sort(names(firma)), c("base_madre", "catalogo_curso_horario"))
  expect_identical(firma$base_madre$file_id, "f-alumnos")
  expect_identical(firma$base_madre$sheet, "Data")
  expect_identical(firma$catalogo_curso_horario$file_id, "f-ch")
})

test_that("un rol sin file_id NO entra en la firma", {
  # Una tabla mandada inline no tiene identidad estable; firmarla con un valor
  # inventado daria un desfase fantasma en cada build.
  firma <- .cm_aulas_sources_signature(list(
    base_madre = list(list(a = 1)),
    catalogo_curso_horario_file_id = "f-ch"
  ))
  expect_identical(names(firma), "catalogo_curso_horario")
})

test_that("cambiar el archivo cambia la firma; repetirlo la conserva", {
  # Es el contrato que permite a la vista decir «esto es del marco anterior»
  # sin reconstruir: dos builds con las mismas fuentes tienen que firmar igual.
  a <- .cm_aulas_sources_signature(list(base_madre_file_id = "f1", base_madre_sheet = "Data"))
  b <- .cm_aulas_sources_signature(list(base_madre_file_id = "f1", base_madre_sheet = "Data"))
  c <- .cm_aulas_sources_signature(list(base_madre_file_id = "f2", base_madre_sheet = "Data"))
  expect_identical(a, b)
  expect_false(identical(a, c))
})

test_that("cambiar SOLO la hoja tambien cambia la firma", {
  # El mismo Excel con otra hoja es otra base: «MATRICULADO» y «CURSO Y HORARIO»
  # viven en el mismo archivo y son insumos distintos.
  a <- .cm_aulas_sources_signature(list(base_madre_file_id = "f1", base_madre_sheet = "MATRICULADO"))
  b <- .cm_aulas_sources_signature(list(base_madre_file_id = "f1", base_madre_sheet = "CURSO Y HORARIO"))
  expect_false(identical(a, b))
})

test_that("sin fuentes con file_id la firma es vacia, no NULL", {
  # Vacia y no NULL: la vista distingue «no firmo» de «firmo con nada», y un
  # NULL se perderia al serializar.
  expect_identical(.cm_aulas_sources_signature(list()), list())
})
