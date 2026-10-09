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

test_that("la via JOB tambien firma el marco, que es la que corre a escala real", {
  # El agujero: la firma se ponia solo en la rama sincrona, y con las bases
  # reales (137.919 filas) el build SIEMPRE va por job. Resultado medido en la
  # app: un marco recien construido desde las fuentes cargadas seguia diciendo
  # «no consta de qué bases salió». La firma solo funcionaba con marcos de
  # juguete, que es justo donde no hace falta.
  firma <- .cm_aulas_sources_signature(list(
    base_madre_file_id = "f-2026", base_madre_sheet = "Data",
    catalogo_curso_horario_file_id = "f-cat", catalogo_curso_horario_sheet = "Data"
  ))
  visto <- NULL
  local_mocked_bindings(
    .cm_criterios_frame_guardar = function(sid, frame, referencia) { visto <<- frame; frame },
    session_get = function(sid, required = TRUE) list(id = sid),
    session_set = function(...) invisible(NULL)
  )
  handler <- .cm_aulas_construir_on_complete("sid-x", NULL, sources_used = firma)
  handler(list(result_data = list(frame_hash = "h", aula_frame = data.frame())))
  expect_identical(visto$sources_used, firma)
})

test_that("sin firma, la via job no inventa una", {
  # `NULL` tiene que dejar el marco sin `sources_used`, no escribir una firma
  # vacia: «no consta» y «consta que se construyo con nada» son cosas distintas.
  visto <- NULL
  local_mocked_bindings(
    .cm_criterios_frame_guardar = function(sid, frame, referencia) { visto <<- frame; frame },
    session_get = function(sid, required = TRUE) list(id = sid),
    session_set = function(...) invisible(NULL)
  )
  handler <- .cm_aulas_construir_on_complete("sid-x", NULL, sources_used = NULL)
  handler(list(result_data = list(frame_hash = "h")))
  expect_null(visto$sources_used)
})
