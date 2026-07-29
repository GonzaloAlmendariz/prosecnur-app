# Modelo del lienzo (bitacora_canvas.R, ADR 0047).
#
# El lienzo es lo que aporta la RAMIFICACIÓN: el cronograma es lineal y un
# estudio real se bifurca. Lo que fija este archivo es que la estructura no
# pueda quedar rota: aristas sin extremos, colores fuera del tema, nodos de
# referencia sin destino.

.bitcv_lienzo <- function(nodos = list(), aristas = list()) {
  list(id = "c1", title = "Mapa", nodes = nodos, edges = aristas)
}

test_that("un lienzo vacío se normaliza sin inventar nada", {
  l <- .bit_canvas_lienzo(list())
  expect_true(nzchar(l$id))
  expect_equal(l$title, "Lienzo")
  expect_equal(l$nodes, list())
  expect_equal(l$edges, list())
  expect_equal(l$viewport$zoom, 1)
})

test_that("el zoom se acota también en el servidor", {
  # Un .pulso importado con zoom 0 dejaría el lienzo invisible y sin forma de
  # recuperarlo desde la UI.
  # Se ACOTA al rango, no se cae al default: un zoom de 99 debe quedar en el
  # máximo, que sigue siendo el lienzo del usuario.
  expect_equal(.bit_canvas_viewport(list(zoom = 0))$zoom, 0.25)
  expect_equal(.bit_canvas_viewport(list(zoom = 99))$zoom, 2.5)
  expect_equal(.bit_canvas_viewport(list(zoom = 1.5))$zoom, 1.5)
})

test_that("el color guarda el nombre del token, no un hex", {
  # Un hex congelaría el modo claro y rompería el oscuro.
  expect_equal(.bit_canvas_nodo(list(color = "riesgo"))$color, "riesgo")
  expect_equal(.bit_canvas_nodo(list(color = "#ff0000"))$color, "neutro")
})

test_that("un nodo de referencia sin destino degrada a texto", {
  # Una "ventana a la nada" es peor que una nota: al menos la nota se puede
  # editar.
  n <- .bit_canvas_nodo(list(type = "referencia", ref = list()))
  expect_equal(n$type, "texto")
  expect_null(n$ref)

  ok <- .bit_canvas_nodo(list(type = "referencia", ref = list(target_type = "tarea", target_id = "t1")))
  expect_equal(ok$type, "referencia")
  expect_equal(ok$ref$target_id, "t1")
})

test_that("un nodo de referencia guarda solo el destino, nunca una copia", {
  # Es lo que hace que editar el hito se refleje: el título se resuelve en cada
  # lectura, no se copia acá.
  n <- .bit_canvas_nodo(list(type = "referencia", ref = list(target_type = "tarea", target_id = "t1", titulo = "copia vieja")))
  expect_equal(names(n$ref), c("target_type", "target_id"))
})

test_that("las dimensiones se acotan a rangos usables", {
  expect_equal(.bit_canvas_nodo(list(w = 1))$w, 40)
  expect_equal(.bit_canvas_nodo(list(h = 99999))$h, 4000)
})

test_that("una arista hacia un nodo inexistente se descarta al leer", {
  out <- .bit_canvas_lienzo(.bitcv_lienzo(
    nodos = list(list(id = "n1"), list(id = "n2")),
    aristas = list(
      list(id = "a1", from_node = "n1", to_node = "n2"),
      list(id = "a2", from_node = "n1", to_node = "fantasma")
    )
  ))
  expect_equal(length(out$edges), 1L)
  expect_equal(out$edges[[1]]$id, "a1")
})

test_that("un bucle sobre el mismo nodo se descarta", {
  out <- .bit_canvas_lienzo(.bitcv_lienzo(
    nodos = list(list(id = "n1")),
    aristas = list(list(from_node = "n1", to_node = "n1"))
  ))
  expect_equal(length(out$edges), 0L)
})

test_that("los ids de nodo duplicados se colapsan", {
  # Dos nodos con el mismo id romperían el mapa de aristas.
  out <- .bit_canvas_lienzo(.bitcv_lienzo(
    nodos = list(list(id = "n1", text = "primero"), list(id = "n1", text = "segundo"))
  ))
  expect_equal(length(out$nodes), 1L)
  expect_equal(out$nodes[[1]]$text, "primero")
})

test_that("los nodos y aristas se acotan", {
  muchos <- lapply(seq_len(BITACORA_MAX_NODOS + 50L), function(i) list(id = paste0("n", i)))
  out <- .bit_canvas_lienzo(.bitcv_lienzo(nodos = muchos))
  expect_equal(length(out$nodes), BITACORA_MAX_NODOS)
})

test_that("crear un lienzo lo deja como activo", {
  canvas <- .bit_canvas_crear(.bit_canvas_vacio())
  expect_equal(length(canvas$canvases), 1L)
  # Crear y no aterrizar en él obligaría a un segundo clic para ver lo pedido.
  expect_equal(canvas$active_canvas_id, canvas$canvases[[1]]$id)
})

test_that("el tope de lienzos se respeta con un error accionable", {
  canvas <- .bit_canvas_vacio()
  for (i in seq_len(BITACORA_MAX_LIENZOS)) canvas <- .bit_canvas_crear(canvas)
  err <- tryCatch(.bit_canvas_crear(canvas), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_LIENZO_TOPE")
  expect_match(conditionMessage(err), "Archiva")
})

test_that("reemplazar respeta el id de la ruta y conserva la fecha de creación", {
  canvas <- .bit_canvas_crear(.bit_canvas_vacio(), "Mapa")
  id <- canvas$canvases[[1]]$id
  creado <- canvas$canvases[[1]]$created_at

  # Un cliente con estado viejo no puede sobrescribir OTRO lienzo mandando un
  # id distinto en el cuerpo, ni reescribir cuándo se creó.
  canvas <- .bit_canvas_reemplazar(canvas, id, list(
    id = "otro", created_at = "1999-01-01T00:00:00Z", title = "Renombrado",
    nodes = list(list(id = "n1", text = "hola"))
  ))
  expect_equal(canvas$canvases[[1]]$id, id)
  expect_equal(canvas$canvases[[1]]$created_at, creado)
  expect_equal(canvas$canvases[[1]]$title, "Renombrado")
  expect_equal(length(canvas$canvases[[1]]$nodes), 1L)
})

test_that("reemplazar un lienzo inexistente da error accionable", {
  err <- tryCatch(.bit_canvas_reemplazar(.bit_canvas_vacio(), "fantasma", list()), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_LIENZO_NO_EXISTE")
})

test_that("borrar el lienzo activo mueve el activo a otro", {
  canvas <- .bit_canvas_crear(.bit_canvas_crear(.bit_canvas_vacio()))
  activo <- canvas$active_canvas_id
  canvas <- .bit_canvas_borrar(canvas, activo)
  expect_equal(length(canvas$canvases), 1L)
  expect_equal(canvas$active_canvas_id, canvas$canvases[[1]]$id)
})

test_that("borrar el último lienzo deja el activo vacío en vez de colgando", {
  canvas <- .bit_canvas_crear(.bit_canvas_vacio())
  canvas <- .bit_canvas_borrar(canvas, canvas$canvases[[1]]$id)
  expect_equal(canvas$canvases, list())
  expect_equal(canvas$active_canvas_id, "")
})

test_that("leer repara un activo que apunta a un lienzo borrado", {
  s <- list(bitacora_canvas = list(
    schema = BITACORA_CANVAS_SCHEMA,
    active_canvas_id = "fantasma",
    canvases = list(list(id = "c1", title = "Mapa"))
  ))
  expect_equal(.bit_canvas_leer(s)$active_canvas_id, "c1")
})

test_that("el gc de aristas limpia tras borrar nodos", {
  lienzo <- .bit_canvas_lienzo(.bitcv_lienzo(
    nodos = list(list(id = "n1"), list(id = "n2")),
    aristas = list(list(from_node = "n1", to_node = "n2"))
  ))
  lienzo$nodes <- Filter(function(n) n$id != "n2", lienzo$nodes)
  expect_equal(length(.bit_canvas_gc_aristas(lienzo)$edges), 0L)
})

test_that("normalizar un lienzo es idempotente", {
  una <- .bit_canvas_lienzo(.bitcv_lienzo(
    nodos = list(list(id = "n1", x = 10, y = 20, color = "riesgo", text = "hola")),
    aristas = list(list(id = "a1", from_node = "n1", to_node = "n1"))
  ))
  expect_identical(.bit_canvas_lienzo(una), una)
})
