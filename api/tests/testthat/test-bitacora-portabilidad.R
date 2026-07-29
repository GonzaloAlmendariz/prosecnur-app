# Exportación e importación del subsistema Bitácora (ADR 0047).

.bitport_estado <- function() {
  list(
    plan_trabajo = list(
      schema = "plan_trabajo_v2",
      tasks = list(
        list(id = "t1", activity = "Campo", kind = "fieldwork_window", fase = "campo",
             start_date = "2026-03-03", end_date = "2026-03-20", links = list()),
        list(id = "t2", activity = "Informe final", kind = "deliverable", fase = "entregables",
             start_date = "2026-04-15", links = list(
               list(target_type = "tarea", target_id = "t1", relation = "deriva_de")
             ))
      )
    ),
    diseno_estudio_bitacora = list(
      list(id = "e1", title = "Se cerró el piloto", body = "Doce encuestas.",
           tone = "avance", module_id = "monitoreo",
           occurred_at = "2026-03-10T09:00:00Z", links = list())
    ),
    bitacora_canvas = list(
      schema = "bitacora_canvas_v1",
      canvases = list(list(
        id = "c1", name = "Mapa del estudio",
        nodes = list(list(id = "n1", type = "referencia", text = "Campo",
                          ref = list(target_type = "tarea", target_id = "t1"), links = list())),
        edges = list()
      ))
    )
  )
}

test_that("el documento exportado se declara con su esquema y trae las tres colecciones", {
  doc <- .bit_port_exportar(.bitport_estado())
  expect_equal(doc$schema, BITACORA_PORT_ESQUEMA)
  expect_equal(length(doc$plan$tasks), 2L)
  expect_equal(length(doc$bitacora), 1L)
  expect_equal(length(doc$canvas$canvases), 1L)
})

test_that("los vínculos viajan dentro de las entidades, no en una colección aparte", {
  # Es lo que hace que exportar las entidades exporte el grafo. Si los enlaces
  # vivieran fuera, un export parcial produciría enlaces colgantes al importar.
  doc <- .bit_port_exportar(.bitport_estado())
  expect_equal(doc$plan$tasks[[2]]$links[[1]]$target_id, "t1")
})

test_that("exportar y reimportar sobre un proyecto vacío recupera el estado completo", {
  doc <- .bit_port_exportar(.bitport_estado())
  vacio <- list()
  revision <- .bit_port_revisar(vacio, doc)
  expect_true(revision$aplicable)
  expect_equal(length(revision$crea), 4L)     # 2 hitos + 1 entrada + 1 lienzo
  expect_equal(length(revision$actualiza), 0L)

  s <- .bit_port_aplicar(vacio, doc, revision$token)
  expect_equal(length(s$plan_trabajo$tasks), 2L)
  expect_equal(length(s$diseno_estudio_bitacora), 1L)
  expect_equal(length(s$bitacora_canvas$canvases), 1L)
  expect_equal(s$plan_trabajo$tasks[[2]]$links[[1]]$target_id, "t1")
})

test_that("revisar no escribe nada: la vista previa es previa de verdad", {
  s <- list()
  .bit_port_revisar(s, .bit_port_exportar(.bitport_estado()))
  expect_null(s$plan_trabajo)
  expect_null(s$diseno_estudio_bitacora)
})

test_that("reimportar sobre el mismo estado actualiza en vez de duplicar", {
  s <- .bitport_estado()
  doc <- .bit_port_exportar(s)
  revision <- .bit_port_revisar(s, doc)
  expect_equal(length(revision$crea), 0L)
  expect_equal(length(revision$actualiza), 4L)

  aplicado <- .bit_port_aplicar(s, doc, revision$token)
  expect_equal(length(aplicado$plan_trabajo$tasks), 2L)
})

test_that("importar SUMA: lo que el archivo no menciona se conserva", {
  # Un mapa traído de otro estudio no puede borrar el cronograma de este. Que
  # el archivo no nombre un hito no significa que el usuario quiera perderlo.
  s <- .bitport_estado()
  doc <- .bit_port_exportar(s)
  doc$plan$tasks <- list(list(id = "t9", activity = "Piloto", kind = "activity", links = list()))
  doc$bitacora <- list()
  doc$canvas$canvases <- list()

  revision <- .bit_port_revisar(s, doc)
  aplicado <- .bit_port_aplicar(s, doc, revision$token)
  ids <- vapply(aplicado$plan_trabajo$tasks, function(t) t$id, character(1))
  expect_true(all(c("t1", "t2", "t9") %in% ids))
  expect_equal(length(aplicado$diseno_estudio_bitacora), 1L)
})

test_that("lo importado se agrega al final y no reordena lo que el usuario acomodó", {
  s <- .bitport_estado()
  doc <- .bit_port_exportar(s)
  doc$plan$tasks <- list(list(id = "t9", activity = "Piloto", kind = "activity", links = list()))
  revision <- .bit_port_revisar(s, doc)
  ids <- vapply(.bit_port_aplicar(s, doc, revision$token)$plan_trabajo$tasks,
                function(t) t$id, character(1))
  expect_equal(ids[[1]], "t1")
  expect_equal(ids[[length(ids)]], "t9")
})

test_that("un token de otro estado se rechaza con E_BITACORA_IMPORT_TOKEN", {
  # Es lo que hace real la validación previa: sin esto se muestra un plan y se
  # aplica otro.
  s <- .bitport_estado()
  doc <- .bit_port_exportar(s)
  revision <- .bit_port_revisar(s, doc)

  s$plan_trabajo$tasks[[length(s$plan_trabajo$tasks) + 1L]] <-
    list(id = "t3", activity = "Algo que pasó mientras tanto", links = list())

  err <- tryCatch(.bit_port_aplicar(s, doc, revision$token), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_IMPORT_TOKEN")
})

test_that("editar el texto de un hito NO invalida el token", {
  # La huella mira el conjunto de entidades, no su contenido: rehacer la vista
  # previa por un typo en un campo que la importación ni mira sería castigar al
  # usuario por escribir.
  s <- .bitport_estado()
  antes <- .bit_port_huella(s)
  s$plan_trabajo$tasks[[1]]$activity <- "Campo (reprogramado)"
  expect_equal(.bit_port_huella(s), antes)
})

test_that("un archivo de otro esquema se rechaza antes de mirar su contenido", {
  err <- tryCatch(.bit_port_revisar(list(), list(schema = "otra_cosa_v3")), error = function(e) e)
  expect_equal(err$code, "E_BITACORA_IMPORT_ESQUEMA")
})

test_that("un documento que no es una lista se rechaza sin reventar", {
  err <- tryCatch(.bit_port_revisar(list(), "no soy json"), error = function(e) e)
  expect_equal(err$code, "E_BITACORA_IMPORT_FORMATO")
})

test_that("un hito sin id o sin actividad se reporta como error, no se importa a medias", {
  doc <- .bit_port_exportar(.bitport_estado())
  doc$plan$tasks <- list(
    list(id = "", activity = "Sin id", links = list()),
    list(id = "tX", activity = "", links = list())
  )
  revision <- .bit_port_revisar(list(), doc)
  expect_false(revision$aplicable)
  expect_equal(length(revision$errores), 2L)
})

test_that("aplicar un documento con errores se rechaza aunque el token esté vigente", {
  s <- list()
  doc <- .bit_port_exportar(.bitport_estado())
  doc$plan$tasks <- list(list(id = "", activity = "Sin id", links = list()))
  revision <- .bit_port_revisar(s, doc)
  err <- tryCatch(.bit_port_aplicar(s, doc, revision$token), error = function(e) e)
  expect_equal(err$code, "E_BITACORA_IMPORT_INVALIDO")
})

test_that("un ciclo importado se rechaza: es el único camino que no pasa por el formulario", {
  doc <- .bit_port_exportar(.bitport_estado())
  doc$plan$tasks <- list(
    list(id = "a", activity = "A", blocked_by = list("c"), links = list()),
    list(id = "b", activity = "B", blocked_by = list("a"), links = list()),
    list(id = "c", activity = "C", blocked_by = list("b"), links = list())
  )
  revision <- .bit_port_revisar(list(), doc)
  expect_false(revision$aplicable)
  expect_match(revision$errores[[1]]$motivo, "circulares")
})

test_that("un archivo desmesurado se rechaza antes de procesarlo", {
  # Plumber es de un solo hilo: procesar 5.000 elementos bloquea la app entera.
  doc <- .bit_port_exportar(list())
  doc$plan$tasks <- lapply(seq_len(BITACORA_PORT_MAX_ITEMS + 1L), function(i) {
    list(id = paste0("t", i), activity = "x", links = list())
  })
  err <- tryCatch(.bit_port_revisar(list(), doc), error = function(e) e)
  expect_equal(err$code, "E_BITACORA_IMPORT_TAMANO")
})

test_that("importar no deja enlaces apuntando a lo que este proyecto no tiene", {
  # El archivo viene de otro estudio y sus hitos referencian ids que acá no
  # existen. El gc corre al final del aplicar.
  doc <- .bit_port_exportar(.bitport_estado())
  doc$plan$tasks <- list(
    list(id = "t1", activity = "Campo", links = list(
      list(target_type = "tarea", target_id = "de-otro-estudio", relation = "menciona")
    ))
  )
  doc$bitacora <- list()
  doc$canvas$canvases <- list()

  revision <- .bit_port_revisar(list(), doc)
  s <- .bit_port_aplicar(list(), doc, revision$token)
  expect_equal(length(s$plan_trabajo$tasks[[1]]$links), 0L)
})

test_that("un proyecto vacío tiene una huella estable y no falla", {
  expect_equal(.bit_port_huella(list()), .bit_port_huella(list()))
})
