# =============================================================================
# Una sincronización que no trae nada NO borra lo que ya había
# (2026-09-08, HSVG2026 en pleno campo)
# =============================================================================
#
# Gonzalo, con el operativo abierto: «parece que el archivo .pulso no se
# actualiza a pesar de que apreté el botón de actualizar (...) no lee efectivas
# ni nada». Medido sobre su `.pulso` real (guardado 2026-09-08 12:58 local)
# contra el estado del día anterior:
#
#   monitoreo_snapshot$data ........ 273 filas  ->  data.frame de 0 x 0
#   monitoreo_aulas_snapshot$rows .. -          ->  0
#   synced_at ...................... 07/09      ->  08/09 (la sync SÍ corrió)
#   source_mapping$collector_var ... "collectorID" -> ""
#   source_mapping$sex_var ......... "datos_demo/P2" -> ""
#
# La app no dejó de actualizarse: se actualizó A NADA, y con el mapeo borrado
# no había forma de atribuir una respuesta a su curso-horario ni de separar
# hombres de mujeres. La pantalla decía «Efectivas 0» y «0 de 2 500» sobre un
# campo que llevaba 212 efectivas.
#
# El camino de ERROR ya estaba protegido: una fuente que revienta no entra en
# `sync_summary` y, si fallan todas, el motor conserva el snapshot y lo dice
# («No se pudo actualizar ninguna fuente; se conservara el snapshot anterior»).
# Lo que no estaba protegido era el ÉXITO VACÍO: Kobo respondiendo 200 con cero
# registros es un `data.frame` de 0 filas, que no es `NULL`, así que entraba
# como fuente sincronizada, el merge borraba sus filas previas y no ponía
# ninguna en su lugar.
#
# La regla que fijan estos tests: **un reemplazo full sólo reemplaza si trae con
# qué**. Vaciar es una operación destructiva y no se hace por defecto (memoria
# de la casa: descartar en silencio es el defecto). Si de verdad se borró todo
# en la plataforma, el vacío llega en la siguiente sincronización que sí traiga
# datos, o se limpia a mano; el precio de conservar de más es reversible y el
# de borrar de más, no.

.svnb_data <- function(source_id, n, desde = 1L) {
  data.frame(
    `_id` = as.character(seq.int(desde, length.out = n)),
    .source_id = rep(source_id, n),
    sexo = rep(c("1", "2"), length.out = n),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.svnb_summary <- function(...) {
  items <- list(...)
  out <- list()
  for (it in items) out[[it$source_id]] <- it
  out
}

.svnb_item <- function(source_id, rows, mode = "full") {
  list(source_id = source_id, source_label = source_id, kind = "kobo",
       mode = mode, rows = as.integer(rows), cursor = list())
}

test_that("una fuente full que vuelve vacía conserva las filas que ya tenía", {
  prev <- .svnb_data("s1", 273)
  combinado <- prosecnurapp:::.monitoreo_merge_sync_result_data(
    prev,
    data.frame(),
    synced_source_ids = prosecnurapp:::.monitoreo_sync_successful_source_ids(
      .svnb_summary(.svnb_item("s1", 0L)), data.frame()),
    incremental_source_ids = character(0),
    empty_source_ids = prosecnurapp:::.monitoreo_sync_empty_source_ids(
      .svnb_summary(.svnb_item("s1", 0L)))
  )
  expect_identical(nrow(combinado), 273L)
  expect_true(all(as.character(combinado$.source_id) == "s1"))
})

test_that("una fuente full que sí trae filas las reemplaza, como siempre", {
  prev <- .svnb_data("s1", 273)
  nuevo <- .svnb_data("s1", 300, desde = 1000L)
  combinado <- prosecnurapp:::.monitoreo_merge_sync_result_data(
    prev, nuevo,
    synced_source_ids = "s1",
    incremental_source_ids = character(0),
    empty_source_ids = character(0)
  )
  # Reemplazo, no suma: 300, y ninguna de las viejas sobrevive.
  expect_identical(nrow(combinado), 300L)
  expect_false(any(combinado[["_id"]] %in% prev[["_id"]]))
})

test_that("con dos fuentes, la que vuelve vacía se conserva y la que trae se reemplaza", {
  prev <- rbind(.svnb_data("s1", 100), .svnb_data("s2", 50, desde = 500L))
  nuevo <- .svnb_data("s2", 60, desde = 900L)
  resumen <- .svnb_summary(.svnb_item("s1", 0L), .svnb_item("s2", 60L))
  combinado <- prosecnurapp:::.monitoreo_merge_sync_result_data(
    prev, nuevo,
    synced_source_ids = prosecnurapp:::.monitoreo_sync_successful_source_ids(resumen, nuevo),
    incremental_source_ids = character(0),
    empty_source_ids = prosecnurapp:::.monitoreo_sync_empty_source_ids(resumen)
  )
  # s1 conserva sus 100; s2 pasa de 50 a las 60 nuevas.
  expect_identical(sum(combinado$.source_id == "s1"), 100L)
  expect_identical(sum(combinado$.source_id == "s2"), 60L)
})

test_that("las fuentes vacías se nombran para que el aviso pueda decir cuáles", {
  resumen <- .svnb_summary(.svnb_item("s1", 0L), .svnb_item("s2", 60L),
                           .svnb_item("s3", 0L, mode = "incremental"))
  vacias <- prosecnurapp:::.monitoreo_sync_empty_source_ids(resumen)
  # También la incremental con cero: no borra nada, pero no trajo nada y quien
  # avisa necesita saberlo.
  expect_setequal(vacias, c("s1", "s3"))
  expect_false("s2" %in% vacias)
})

test_that("sin filas previas, una fuente vacía sigue dando vacío y no revienta", {
  combinado <- prosecnurapp:::.monitoreo_merge_sync_result_data(
    data.frame(), data.frame(),
    synced_source_ids = character(0),
    incremental_source_ids = character(0),
    empty_source_ids = "s1"
  )
  expect_identical(nrow(combinado), 0L)
})

# --- El otro medio bug: el mapeo de columnas ---------------------------------
#
# `monitoreo_aulas_normalize_config()` es una whitelist pura: lo que no venga en
# el body cae al default, que para `source_mapping` son cadenas vacías. El
# hermano territorial recibe `previous =` y conserva lo guardado; aulas no lo
# recibía, así que cualquier normalización con un body incompleto —la que corre
# en cada sincronización— dejaba el mapeo en blanco.

test_that("normalizar sin mapeo conserva el que ya estaba guardado", {
  previo <- monitoreo_aulas_normalize_config(list(
    source_mapping = list(collector_var = "collectorID", sex_var = "datos_demo/P2",
                          sex_female_values = list("1"), sex_male_values = list("2"))
  ))
  expect_identical(previo$source_mapping$collector_var, "collectorID")

  # Lo que hacía la sincronización: normalizar un config sin `source_mapping`.
  vuelto <- monitoreo_aulas_normalize_config(list(enabled = TRUE), previous = previo)
  expect_identical(vuelto$source_mapping$collector_var, "collectorID")
  expect_identical(vuelto$source_mapping$sex_var, "datos_demo/P2")
  expect_identical(unlist(vuelto$source_mapping$sex_female_values), "1")
})

test_that("un mapeo nuevo sí pisa al anterior, campo por campo", {
  previo <- monitoreo_aulas_normalize_config(list(
    source_mapping = list(collector_var = "collectorID", sex_var = "datos_demo/P2")
  ))
  vuelto <- monitoreo_aulas_normalize_config(
    list(source_mapping = list(collector_var = "otro")), previous = previo)
  # El que llega manda; el que no llega se conserva. Cambiar de columna de
  # colector no puede costar el sexo.
  expect_identical(vuelto$source_mapping$collector_var, "otro")
  expect_identical(vuelto$source_mapping$sex_var, "datos_demo/P2")
})

test_that("sin previo, el default sigue siendo el default", {
  vuelto <- monitoreo_aulas_normalize_config(list(enabled = TRUE))
  expect_identical(vuelto$source_mapping$collector_var, "")
  expect_identical(vuelto$source_mapping$sex_var, "")
})
