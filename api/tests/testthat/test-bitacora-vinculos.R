# Vinculación transversal (bitacora_vinculos.R, ADR 0047).
#
# Lo que fija este archivo es el corazón del subsistema: el enlace se guarda en
# UN sentido, se lee desde los DOS, y borrar una entidad no deja referencias
# rotas silenciosas.

.bitvin_estado <- function() {
  list(
    plan_trabajo = list(
      schema = "plan_trabajo_v2",
      tasks = list(
        list(id = "t1", activity = "Levantamiento en campo", status = "active",
             fase = "campo", start_date = "2026-03-01", responsible = "Equipo A", links = list()),
        list(id = "t2", activity = "Entrega del informe", status = "planned",
             fase = "entregables", start_date = "2026-04-05", responsible = "", links = list())
      )
    ),
    diseno_estudio_bitacora = list(
      list(id = "e1", title = "Cuota de Ate en rojo", body = "Faltan 40 encuestas.",
           tone = "riesgo", module_id = "monitoreo", occurred_at = "2026-03-10T09:00:00Z", links = list())
    ),
    bitacora_canvas = list(
      schema = "bitacora_canvas_v1",
      canvases = list(list(
        id = "c1", title = "Mapa del estudio",
        nodes = list(list(id = "n1", type = "texto", text = "Idea suelta", links = list()))
      ))
    )
  )
}

test_that("el universo de destinos vivos cubre tareas, entradas, lienzos y nodos", {
  vivos <- .bit_link_ids_vivos(.bitvin_estado())
  expect_true("tarea:t1" %in% vivos)
  expect_true("entrada:e1" %in% vivos)
  expect_true("lienzo:c1" %in% vivos)
  # Un nodo se direcciona con su lienzo: sin eso, dos lienzos con un nodo "n1"
  # serían el mismo destino.
  expect_true("nodo:c1/n1" %in% vivos)
})

test_that("un enlace se guarda en un solo sentido", {
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "tarea", target_id = "t1", relation = "documenta"))
  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 1L)
  # La tarea NO guarda el recíproco: mantener dos copias sincronizadas es lo
  # que hace que un borrado a medias las deje contradiciéndose.
  expect_equal(length(s$plan_trabajo$tasks[[1]]$links), 0L)
})

test_that("la relación se lee desde ambos lados por el índice derivado", {
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "tarea", target_id = "t1", relation = "documenta"))
  indice <- .bit_link_indice(s)

  expect_true("tarea:t1" %in% names(indice))
  quien <- indice[["tarea:t1"]]
  expect_equal(length(quien), 1L)
  expect_equal(quien[[1]]$source_type, "entrada")
  expect_equal(quien[[1]]$source_id, "e1")
  expect_equal(quien[[1]]$source_label, "Cuota de Ate en rojo")
  expect_equal(quien[[1]]$relation, "documenta")
})

test_that("enlazar dos veces lo mismo no duplica", {
  s <- .bitvin_estado()
  v <- list(target_type = "tarea", target_id = "t1", relation = "menciona")
  s <- .bit_link_agregar(s, "entrada", "e1", v)
  s <- .bit_link_agregar(s, "entrada", "e1", v)
  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 1L)
})

test_that("una entidad no puede enlazarse consigo misma", {
  err <- tryCatch(
    .bit_link_agregar(.bitvin_estado(), "tarea", "t1",
                      list(target_type = "tarea", target_id = "t1")),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_VINCULO_PROPIO")
})

test_that("no se puede enlazar hacia algo que no existe", {
  err <- tryCatch(
    .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                      list(target_type = "tarea", target_id = "fantasma")),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_VINCULO_DESTINO")
  expect_equal(err$status, 404)
})

test_that("un origen inexistente da error accionable", {
  err <- tryCatch(
    .bit_link_agregar(.bitvin_estado(), "entrada", "fantasma",
                      list(target_type = "tarea", target_id = "t1")),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_VINCULO_ORIGEN")
})

test_that("las tres entidades pueden ser origen", {
  s <- .bitvin_estado()
  s <- .bit_link_agregar(s, "tarea", "t1", list(target_type = "entrada", target_id = "e1"))
  s <- .bit_link_agregar(s, "entrada", "e1", list(target_type = "tarea", target_id = "t2"))
  s <- .bit_link_agregar(s, "nodo", "c1/n1", list(target_type = "tarea", target_id = "t1"))

  expect_equal(length(s$plan_trabajo$tasks[[1]]$links), 1L)
  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 1L)
  expect_equal(length(s$bitacora_canvas$canvases[[1]]$nodes[[1]]$links), 1L)
})

test_that("un nodo mal direccionado se rechaza", {
  err <- tryCatch(
    .bit_link_agregar(.bitvin_estado(), "nodo", "n1", list(target_type = "tarea", target_id = "t1")),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_VINCULO_ORIGEN")
})

test_that("quitar un enlace lo saca de ambos lados de la lectura", {
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "tarea", target_id = "t1"))
  s <- .bit_link_quitar(s, "entrada", "e1", "tarea", "t1")
  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 0L)
  expect_false("tarea:t1" %in% names(.bit_link_indice(s)))
})

# --- Enlaces colgantes -------------------------------------------------------

test_that("borrar el destino limpia el enlace que lo apuntaba", {
  # Criterio de aceptación del spec: eliminar una entidad enlazada no debe
  # dejar referencias rotas SILENCIOSAS.
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "tarea", target_id = "t1"))
  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 1L)

  s$plan_trabajo$tasks <- Filter(function(t) t$id != "t1", s$plan_trabajo$tasks)
  s <- .bit_link_gc(s)

  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 0L)
  expect_false("tarea:t1" %in% names(.bit_link_indice(s)))
})

test_that("borrar un lienzo limpia los enlaces hacia sus nodos", {
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "nodo", target_id = "c1/n1"))
  s$bitacora_canvas$canvases <- list()
  s <- .bit_link_gc(s)
  expect_equal(length(s$diseno_estudio_bitacora[[1]]$links), 0L)
})

test_that("el garbage collector no toca los enlaces vivos", {
  s <- .bitvin_estado()
  s <- .bit_link_agregar(s, "entrada", "e1", list(target_type = "tarea", target_id = "t1"))
  s <- .bit_link_agregar(s, "tarea", "t2", list(target_type = "entrada", target_id = "e1"))

  antes <- .bit_link_indice(s)
  s <- .bit_link_gc(s)
  expect_equal(names(.bit_link_indice(s)), names(antes))
})

test_that("el gc es idempotente", {
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "tarea", target_id = "t1"))
  expect_identical(.bit_link_gc(.bit_link_gc(s)), .bit_link_gc(s))
})

# --- Resumen vivo ------------------------------------------------------------

test_that("el resumen de una tarea sale del estado actual, no de una copia", {
  s <- .bitvin_estado()
  r <- .bit_link_resumen(s, "tarea", "t1")
  expect_true(r$existe)
  expect_equal(r$titulo, "Levantamiento en campo")
  expect_equal(r$estado, "active")
  expect_equal(r$fase, "campo")

  # Editar el hito cambia el resumen: es la razón de calcularlo en cada lectura.
  s$plan_trabajo$tasks[[1]]$activity <- "Levantamiento REPROGRAMADO"
  expect_equal(.bit_link_resumen(s, "tarea", "t1")$titulo, "Levantamiento REPROGRAMADO")
})

test_that("el resumen de una entrada trae tono y recorte del cuerpo", {
  r <- .bit_link_resumen(.bitvin_estado(), "entrada", "e1")
  expect_true(r$existe)
  expect_equal(r$titulo, "Cuota de Ate en rojo")
  expect_equal(r$estado, "riesgo")
  expect_match(r$detalle, "Faltan 40")
})

test_that("el resumen de un destino inexistente dice que no existe en vez de fallar", {
  # El nodo de referencia usa esto para degradar a «el destino ya no existe»
  # en lugar de quedar en blanco.
  r <- .bit_link_resumen(.bitvin_estado(), "tarea", "fantasma")
  expect_false(r$existe)
  expect_equal(r$titulo, "")
})

test_that("el payload trae el índice y los resúmenes de lo referenciado", {
  s <- .bit_link_agregar(.bitvin_estado(), "entrada", "e1",
                         list(target_type = "tarea", target_id = "t1"))
  payload <- .bit_vinculos_payload(s)
  expect_equal(payload$total, 1L)
  expect_true("tarea:t1" %in% names(payload$por_destino))
  expect_equal(payload$resumenes[["tarea:t1"]]$titulo, "Levantamiento en campo")
})

test_that("un estado sin nada enlazado da un payload vacío y no NULL", {
  payload <- .bit_vinculos_payload(list())
  expect_equal(payload$total, 0L)
  expect_equal(payload$por_destino, list())
  expect_equal(payload$resumenes, list())
})
