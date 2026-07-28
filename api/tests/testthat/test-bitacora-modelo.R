# Normalizadores del modelo de Bitácora (bitacora_modelo.R, ADR 0047).
#
# El contrato que fija este archivo: los normalizadores son PUROS e
# IDEMPOTENTES. Esa idempotencia no es un lujo — es lo que permite invocarlos en
# cada lectura y en cada migración sin deformar el dato, que es exactamente cómo
# los usan .plan_rebuild_derived, .diseno_bitacora_entry y .bitacora_migrar_estado.

test_that("las etiquetas colapsan a un slug canónico y se deduplican", {
  # "Trabajo de Campo" y "trabajo-de-campo" son la misma etiqueta: si no
  # colapsaran, filtrar por etiqueta partiría el conjunto en dos.
  expect_equal(
    .bit_etiquetas(list("Trabajo de Campo", "trabajo-de-campo", "  CAMPO  ")),
    list("trabajo-de-campo", "campo")
  )
  expect_equal(.bit_etiquetas(list("Ñandú", "acción")), list("nandu", "accion"))
  expect_equal(.bit_etiquetas(NULL), list())
  expect_equal(.bit_etiquetas(list("", "   ", "---")), list())
  expect_length(.bit_etiquetas(as.list(sprintf("etq%02d", 1:20))), BITACORA_MAX_ETIQUETAS)
})

test_that("la prioridad es un vocabulario cerrado con rango ordinal", {
  expect_equal(.bit_prioridad("critica"), "critica")
  expect_equal(.bit_prioridad("urgentisima"), "media")
  expect_equal(.bit_prioridad(NULL), "media")
  expect_equal(.bit_prioridad_rank("critica"), 0L)
  expect_equal(.bit_prioridad_rank("baja"), 3L)
  # El rango tiene que ser monótono o el ordenamiento del cliente miente.
  rangos <- vapply(BITACORA_PRIORIDADES, .bit_prioridad_rank, integer(1))
  expect_identical(rangos, sort(rangos))
})

test_that("una fecha inválida da vacío, nunca un valor inventado", {
  expect_equal(.bit_fecha("2026-03-15"), "2026-03-15")
  expect_equal(.bit_fecha("15/03/2026"), "")
  expect_equal(.bit_fecha("2026-02-31"), "")
  expect_equal(.bit_fecha(""), "")
  expect_equal(.bit_fecha(NULL), "")
})

test_that("un recordatorio pospuesto sin marca vuelve a programado", {
  # Un `pospuesto` sin `snoozed_until` sería un aviso invisible para siempre:
  # nunca vence porque no hay fecha contra la cual compararlo.
  r <- .bit_recordatorio(list(state = "pospuesto", snoozed_until = ""))
  expect_equal(r$state, "programado")

  ok <- .bit_recordatorio(list(state = "pospuesto", snoozed_until = "2026-03-15T10:00:00Z"))
  expect_equal(ok$state, "pospuesto")
  expect_equal(ok$snoozed_until, "2026-03-15T10:00:00Z")
})

test_that("los recordatorios se deduplican por ancla y offset", {
  out <- .bit_recordatorios(list(
    list(anchor = "start", offset_minutes = -60),
    list(anchor = "start", offset_minutes = -60),
    list(anchor = "end", offset_minutes = -60)
  ))
  expect_length(out, 2L)
  expect_equal(vapply(out, function(r) r$anchor, character(1)), c("start", "end"))
})

test_that("el offset se acota a un año en ambos sentidos", {
  expect_equal(.bit_recordatorio(list(offset_minutes = -1e9))$offset_minutes, 0L)
  expect_equal(.bit_recordatorio(list(offset_minutes = -1440))$offset_minutes, -1440L)
  # Un offset positivo es legítimo: avisar DESPUÉS de la fecha (seguimiento).
  expect_equal(.bit_recordatorio(list(offset_minutes = 120))$offset_minutes, 120L)
})

test_that("una recurrencia sin regla reconocible es NULL, no un objeto vacío", {
  expect_null(.bit_recurrencia(NULL))
  expect_null(.bit_recurrencia(list()))
  expect_null(.bit_recurrencia(list(rule = "cada-luna-llena")))
  r <- .bit_recurrencia(list(rule = "weekly", interval = 2, exceptions = list("2026-03-15", "malo")))
  expect_equal(r$rule, "weekly")
  expect_equal(r$interval, 2L)
  expect_equal(r$exceptions, list("2026-03-15"))
})

test_that("un vínculo a sí mismo se descarta", {
  vs <- .bit_vinculos(
    list(
      list(target_type = "tarea", target_id = "t1"),
      list(target_type = "entrada", target_id = "e9", relation = "documenta")
    ),
    origen = .bit_vinculo_clave("tarea", "t1")
  )
  expect_length(vs, 1L)
  expect_equal(vs[[1]]$target_id, "e9")
  expect_equal(vs[[1]]$relation, "documenta")
})

test_that("un vínculo sin tipo o sin destino se descarta en vez de colgar", {
  expect_length(.bit_vinculos(list(list(target_type = "tarea", target_id = ""))), 0L)
  expect_length(.bit_vinculos(list(list(target_type = "planeta", target_id = "x"))), 0L)
  # Relación desconocida degrada al default, pero el vínculo sobrevive: perder
  # la relación es aceptable, perder el enlace no.
  v <- .bit_vinculos(list(list(target_type = "nodo", target_id = "c1/n2", relation = "teletransporta")))
  expect_equal(v[[1]]$relation, "menciona")
})

test_that("la forma temporal se deriva de las fechas salvo que haya recurrencia", {
  expect_equal(.bit_temporal_kind("2026-03-01", "2026-03-01"), "punto")
  expect_equal(.bit_temporal_kind("2026-03-01", "2026-03-20"), "rango")
  expect_equal(.bit_temporal_kind("2026-03-01", ""), "punto")
  expect_equal(.bit_temporal_kind("", ""), "punto")
  # Fin anterior al inicio es dato corrupto: se degrada a punto, no a un rango
  # negativo que rompería el ancho de la barra del Gantt.
  expect_equal(.bit_temporal_kind("2026-03-20", "2026-03-01"), "punto")
  expect_equal(
    .bit_temporal_kind("2026-03-01", "2026-03-01", list(rule = "weekly", interval = 1L)),
    "recurrente"
  )
})

test_that("una tarea nunca se bloquea a sí misma", {
  expect_equal(.bit_bloqueadores(list("t1", "t2", "t1"), propio = "t1"), list("t2"))
  expect_equal(.bit_bloqueadores(NULL), list())
})

test_that("normalizar una tarea es idempotente y no pisa los campos originales", {
  cruda <- list(
    id = "task_001",
    activity = "Levantamiento en campo",
    kind = "fieldwork_window",
    status = "active",
    start_date = "2026-03-01",
    end_date = "2026-03-20",
    sync_targets = list("monitoreo"),
    notes = "sin tocar",
    priority = "alta",
    tags = list("Campo", "campo"),
    blocked_by = list("task_001", "task_000")
  )

  una <- .bit_normalizar_tarea(cruda)
  dos <- .bit_normalizar_tarea(una)
  expect_identical(una, dos)

  # Aditividad: lo que ya existía sigue igual.
  expect_equal(una$id, "task_001")
  expect_equal(una$activity, "Levantamiento en campo")
  expect_equal(una$kind, "fieldwork_window")
  expect_equal(una$status, "active")
  expect_equal(una$notes, "sin tocar")
  expect_equal(una$sync_targets, list("monitoreo"))

  # Totalidad: los campos nuevos quedan completos y derivados.
  expect_equal(una$priority, "alta")
  expect_equal(una$priority_rank, 1L)
  expect_equal(una$tags, list("campo"))
  expect_equal(una$blocked_by, list("task_000"))
  expect_equal(una$temporal_kind, "rango")
  expect_false(una$kind_manual)
  expect_false(una$fase_manual)
  expect_equal(una$fase, "")
  expect_null(una$recurrence)
})

test_that("normalizar una tarea sin ningún campo del ADR la completa igual", {
  t <- .bit_normalizar_tarea(list(id = "t9", activity = "x", start_date = "", end_date = ""))
  for (campo in c("priority", "priority_rank", "tags", "reminders", "links",
                  "blocked_by", "archived_at", "kind_manual", "fase",
                  "fase_manual", "temporal_kind")) {
    expect_true(campo %in% names(t), info = paste("falta el campo", campo))
  }
})

test_that("el texto se sanea de caracteres de control y se acota", {
  expect_equal(.bit_texto("holamundo"), "holamundo")
  expect_equal(.bit_texto("  espacios  "), "espacios")
  expect_equal(nchar(.bit_texto(strrep("a", 500), max_chars = 100L)), 100L)
  # Los saltos de línea sobreviven: el cuerpo de una entrada los necesita.
  expect_equal(.bit_texto("linea1\nlinea2", 100L), "linea1\nlinea2")
})
