# Libro de disparos de avisos (bitacora_avisos.R, ADR 0047).
#
# Lo que este archivo garantiza es la promesa central del subsistema: un
# recordatorio suena UNA vez, aunque la app se cierre y se reabra, aunque haya
# dos pestañas, aunque el cliente reintente tras un error de red.

.bitav_sid <- function() {
  sid <- session_create()
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  sid
}

test_that("la clave identifica tarea, recordatorio y ocurrencia", {
  clave <- .bit_aviso_clave("task_1", "rem_a", "2026-03-20")
  expect_equal(clave, "task_1|rem_a|2026-03-20")
  # La ocurrencia forma parte de la identidad: sin ella, cumplir el martes
  # silenciaría el miércoles de un hito recurrente.
  expect_false(identical(
    .bit_aviso_clave("t", "r", "2026-03-20"),
    .bit_aviso_clave("t", "r", "2026-03-21")
  ))
})

test_that("reclamar dos veces la misma clave deja una sola entrada", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  clave <- .bit_aviso_clave("t1", "r1", "2026-03-20")

  primera <- .bit_aviso_reclamar(sid, list(clave))
  expect_equal(length(primera$reclamadas), 1L)
  expect_equal(primera$reclamadas[[1]], clave)

  segunda <- .bit_aviso_reclamar(sid, list(clave))
  # La segunda no reclama nada: es lo que permite al cliente reintentar sin
  # duplicar, y lo que hace que dos pestañas no muestren el mismo aviso.
  expect_equal(length(segunda$reclamadas), 0L)
  expect_equal(length(segunda$libro$fired), 1L)
})

test_that("reclamar es idempotente sobre la marca de tiempo", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  clave <- .bit_aviso_clave("t1", "r1", "2026-03-20")
  primera <- .bit_aviso_reclamar(sid, list(clave))
  marca <- primera$libro$fired[[1]]$fired_at

  segunda <- .bit_aviso_reclamar(sid, list(clave))
  expect_equal(segunda$libro$fired[[1]]$fired_at, marca)
})

test_that("reclamar varias claves a la vez devuelve solo las nuevas", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  a <- .bit_aviso_clave("t1", "r1", "2026-03-20")
  b <- .bit_aviso_clave("t2", "r1", "2026-03-21")
  .bit_aviso_reclamar(sid, list(a))

  out <- .bit_aviso_reclamar(sid, list(a, b))
  expect_equal(length(out$reclamadas), 1L)
  expect_equal(out$reclamadas[[1]], b)
})

test_that("un aviso descartado no revive al reclamarlo de nuevo", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  clave <- .bit_aviso_clave("t1", "r1", "2026-03-20")
  .bit_aviso_descartar(sid, clave)

  out <- .bit_aviso_reclamar(sid, list(clave))
  expect_equal(length(out$reclamadas), 0L)
  libro <- .bit_avisos_leer(session_get(sid))
  expect_equal(libro$fired[[1]]$state, "descartado")
})

test_that("posponer exige hasta cuándo", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  # Sin marca, el aviso quedaría pospuesto para siempre: invisible sin estar
  # descartado. Es peor que no poder posponer.
  err <- tryCatch(.bit_aviso_posponer(sid, "t1|r1|2026-03-20", ""), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_AVISO_SNOOZE")
})

test_that("posponer un aviso ya disparado cambia su estado y su hora", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  clave <- .bit_aviso_clave("t1", "r1", "2026-03-20")
  .bit_aviso_reclamar(sid, list(clave))
  .bit_aviso_posponer(sid, clave, "2026-03-20T15:00:00Z")

  libro <- .bit_avisos_leer(session_get(sid))
  expect_equal(length(libro$fired), 1L)
  expect_equal(libro$fired[[1]]$state, "pospuesto")
  expect_equal(libro$fired[[1]]$snoozed_until, "2026-03-20T15:00:00Z")
})

test_that("posponer un aviso que nunca se reclamó igual lo registra", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  .bit_aviso_posponer(sid, "t9|r9|2026-04-01", "2026-04-02T09:00:00Z")
  libro <- .bit_avisos_leer(session_get(sid))
  expect_equal(length(libro$fired), 1L)
  expect_equal(libro$fired[[1]]$state, "pospuesto")
})

test_that("una clave sin nombre se rechaza en vez de crear basura", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  err <- tryCatch(.bit_aviso_descartar(sid, ""), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_AVISO_CLAVE")
})

test_that("el payload separa lo silenciado de lo pospuesto", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  disparado <- .bit_aviso_clave("t1", "r1", "2026-03-20")
  pospuesto <- .bit_aviso_clave("t2", "r1", "2026-03-21")
  descartado <- .bit_aviso_clave("t3", "r1", "2026-03-22")

  .bit_aviso_reclamar(sid, list(disparado))
  .bit_aviso_posponer(sid, pospuesto, "2026-03-21T15:00:00Z")
  .bit_aviso_descartar(sid, descartado)

  payload <- .bit_avisos_payload(session_get(sid))
  silenciadas <- unlist(payload$silenciadas, use.names = FALSE)

  # Silenciadas = no volver a mostrar. El pospuesto NO está: reaparece.
  expect_true(disparado %in% silenciadas)
  expect_true(descartado %in% silenciadas)
  expect_false(pospuesto %in% silenciadas)

  expect_equal(length(payload$pospuestas), 1L)
  expect_equal(payload$pospuestas[[1]]$clave, pospuesto)
  expect_equal(payload$pospuestas[[1]]$hasta, "2026-03-21T15:00:00Z")
})

test_that("el libro se acota y conserva lo más reciente", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  libro <- .bit_avisos_vacio()
  libro$fired <- lapply(1:(BITACORA_MAX_AVISOS + 20L), function(i) {
    .bit_aviso_entrada(list(
      clave = sprintf("t%04d|r|2026-03-20", i),
      state = "disparado",
      fired_at = sprintf("2026-03-%02dT10:00:00Z", (i %% 28L) + 1L)
    ))
  })
  recortado <- .bit_avisos_gc(libro)
  expect_equal(length(recortado$fired), BITACORA_MAX_AVISOS)
})

test_that("el libro sobrevive el round-trip por session_set", {
  sid <- .bitav_sid(); on.exit(session_delete(sid), add = TRUE)
  clave <- .bit_aviso_clave("t1", "r1", "2026-03-20")
  .bit_aviso_reclamar(sid, list(clave))

  # Releer desde la sesión es exactamente lo que hace la app al reabrir.
  libro <- .bit_avisos_leer(session_get(sid))
  expect_equal(libro$schema, BITACORA_AVISOS_SCHEMA)
  expect_equal(libro$fired[[1]]$clave, clave)
  expect_equal(libro$fired[[1]]$task_id, "t1")
  expect_equal(libro$fired[[1]]$occurrence, "2026-03-20")
})

test_that("una sesión sin libro devuelve el vacío en vez de fallar", {
  payload <- .bit_avisos_payload(list())
  expect_equal(payload$total, 0L)
  expect_equal(payload$silenciadas, list())
  expect_equal(payload$pospuestas, list())
})

test_that("claves duplicadas en el estado persistido se colapsan a una", {
  # Estado corrupto plausible tras un bug de escritura: leer debe repararlo en
  # vez de arrastrarlo.
  s <- list(bitacora_avisos = list(
    schema = BITACORA_AVISOS_SCHEMA,
    fired = list(
      list(clave = "t1|r1|2026-03-20", state = "disparado", fired_at = "2026-03-20T10:00:00Z"),
      list(clave = "t1|r1|2026-03-20", state = "descartado", fired_at = "2026-03-21T10:00:00Z")
    )
  ))
  libro <- .bit_avisos_leer(s)
  expect_equal(length(libro$fired), 1L)
  # Gana la primera: es la que registró el disparo original.
  expect_equal(libro$fired[[1]]$state, "disparado")
})
