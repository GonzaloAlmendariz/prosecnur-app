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

# --- B3: el aviso, porque conservar en silencio también engaña -----------------
#
# Gonzalo miró una pantalla que decía «Efectivas 0» y la creyó: no había nada que
# le dijera que la última sincronización había vuelto de vacío. Conservar el
# snapshot arregla la pérdida, pero deja el otro medio del problema en pie — la
# pantalla sigue enseñando cifras de ayer con fecha de hoy y nadie lo sabe.
#
# El resultado del job nombra las fuentes que volvieron sin nada y dice si eso
# dejó datos anteriores en pie. Un aviso que dice la CAUSA, no sólo el hecho
# (memoria de la casa: «los avisos dicen la causa, no sólo el hecho»).

test_that("el resultado del sync nombra las fuentes que volvieron vacías", {
  resumen <- .svnb_summary(.svnb_item("s1", 0L), .svnb_item("s2", 60L))
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(resumen, conservadas = 273L)
  expect_false(is.null(aviso))
  expect_setequal(aviso$fuentes, "s1")
  expect_identical(aviso$conservadas, 273L)
  expect_match(aviso$mensaje, "no devolvió ningún registro", fixed = TRUE)
  # La consecuencia, que es lo que decide si hay que hacer algo: lo que se ve en
  # pantalla es lo de antes, no lo de ahora.
  expect_match(aviso$mensaje, "273", fixed = TRUE)
})

test_that("con todas las fuentes trayendo datos no hay aviso que dar", {
  resumen <- .svnb_summary(.svnb_item("s1", 12L), .svnb_item("s2", 60L))
  expect_null(prosecnurapp:::.monitoreo_sync_aviso_vacias(resumen, conservadas = 273L))
})

test_that("una fuente vacía sin nada previo se dice distinto: no hay qué conservar", {
  resumen <- .svnb_summary(.svnb_item("s1", 0L))
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(resumen, conservadas = 0L)
  expect_false(is.null(aviso))
  # Sin datos anteriores el mensaje no puede prometer que se conservó algo.
  expect_false(grepl("se conservan", aviso$mensaje, fixed = TRUE))
  expect_match(aviso$mensaje, "sigue sin respuestas", fixed = TRUE)
})

test_that("el aviso usa la etiqueta de la fuente cuando la trae, no su id", {
  resumen <- list(s1 = list(source_id = "s1", source_label = "HSVG 2026 PUCP (Kobo EU)",
                            kind = "kobo", mode = "full", rows = 0L))
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(resumen, conservadas = 273L)
  expect_match(aviso$mensaje, "HSVG 2026 PUCP (Kobo EU)", fixed = TRUE)
})

test_that("el aviso viaja en el resultado del job, no se queda en el motor", {
  # El guard barato: si alguien quita el campo del `list()` final, el front deja
  # de poder avisar y nadie se entera hasta el siguiente estudio en blanco.
  fuente <- readLines("../../R/monitoreo_sync_incremental.R", warn = FALSE)
  expect_true(any(grepl("aviso_fuentes_vacias", fuente, fixed = TRUE)),
              info = "el resultado del sync dejó de publicar el aviso de fuentes vacías")
})

# =============================================================================
# Cero registros en INCREMENTAL no es una incidencia
# (2026-09-14, HSVG2026 en campo)
# =============================================================================
#
# Gonzalo, mirando Avance > Metas: «no se actualiza». En pantalla, el aviso de
# arriba: «HSVG 2026 PUCP (Kobo EU) no devolvió ningún registro en esta
# sincronización (...) revisa la conexión antes de leer el avance». La conexión
# estaba bien: su fuente sincroniza en modo `incremental` —última entrada
# 16:52:35Z con 118 registros— y un incremental pide SÓLO las posteriores al
# cursor, así que devuelve cero cada vez que nadie envía entre dos pulsaciones.
#
# El aviso se había escrito para el reemplazo full, donde volver vacío sí
# significa algo: un full pide todo y todo no puede ser nada. Con un texto
# único, el operativo leía una alarma de conexión cada vez que pulsaba el botón
# dos veces seguidas. Un aviso que se enciende cuando no pasa nada enseña a
# ignorarlo.

.svnb_resumen <- function(id, modo, filas, etiqueta = "", desde = "") {
  stats::setNames(list(list(
    source_id = id, source_label = etiqueta, kind = "kobo",
    mode = modo, rows = filas,
    cursor = if (nzchar(desde)) list(updated_at = desde) else list()
  )), id)
}

test_that("un incremental sin respuestas nuevas NO manda a revisar la conexión", {
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(
    .svnb_resumen("kobo_1", "incremental", 0L, "HSVG 2026 PUCP (Kobo EU)",
                  "2026-09-14T16:52:35Z"),
    conservadas = 2164L)
  expect_identical(aviso$tono, "ok")
  expect_identical(aviso$modo, "incremental")
  expect_false(grepl("revisa la conexión", aviso$mensaje, fixed = TRUE))
  # Y dice lo que sí es un dato: desde cuándo no entra nada. Es lo que separa
  # «el campo está parado ahora» de «el cursor se quedó colgado».
  expect_true(grepl("2026-09-14T16:52:35Z", aviso$mensaje, fixed = TRUE))
  expect_true(grepl("2 164", aviso$mensaje, fixed = TRUE))
})

test_that("un full que vuelve vacío SIGUE siendo una alarma", {
  # El contraejemplo que impide arreglar el falso positivo apagando el aviso
  # entero: aquí volver vacío es la señal que salvó el 08/09.
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(
    .svnb_resumen("kobo_1", "full", 0L, "HSVG 2026 PUCP (Kobo EU)"),
    conservadas = 2164L)
  expect_identical(aviso$tono, "atencion")
  expect_identical(aviso$modo, "full")
  expect_true(grepl("revisa la conexión", aviso$mensaje, fixed = TRUE))
})

test_that("sin nada que conservar, un incremental vacío tampoco se calla", {
  # Cero conservadas es cero en pantalla: aunque el modo sea incremental, ahí
  # no hay «lo de antes» que mirar y el aviso tiene que seguir siendo el fuerte.
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(
    .svnb_resumen("kobo_1", "incremental", 0L, "HSVG 2026 PUCP (Kobo EU)"),
    conservadas = 0L)
  expect_identical(aviso$tono, "atencion")
  expect_true(grepl("sin respuestas cargadas", aviso$mensaje, fixed = TRUE))
})

test_that("con una incremental vacía y una full vacía, manda la alarma", {
  resumen <- c(.svnb_resumen("kobo_1", "incremental", 0L, "Kobo EU"),
               .svnb_resumen("sm_2", "full", 0L, "SurveyMonkey"))
  aviso <- prosecnurapp:::.monitoreo_sync_aviso_vacias(resumen, conservadas = 100L)
  expect_identical(aviso$tono, "atencion")
  expect_identical(length(aviso$fuentes), 2L)
})

test_that("una fuente que sí trajo filas no entra en el aviso, en ningún modo", {
  expect_null(prosecnurapp:::.monitoreo_sync_aviso_vacias(
    .svnb_resumen("kobo_1", "incremental", 118L, "Kobo EU"), conservadas = 2164L))
})
