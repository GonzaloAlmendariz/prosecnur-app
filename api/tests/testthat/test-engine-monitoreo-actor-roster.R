# El elenco de actores declarado, y las reglas de cardinalidad del estudio.
#
# La regresion que estos tests fijan no es una funcion rota: es que
# `monitoreo_normalize_config` SOBRESCRIBIA `profile$units` con lo deducido de
# las fuentes en cada vuelta. Cualquier elenco que alguien guardara duraba
# hasta la siguiente normalizacion, que en la practica es la siguiente peticion.

test_that("el elenco normalizado deduplica por nombre y se marca como declarado", {
  roster <- monitoreo_actor_roster_normalize(list(
    list(actor = "Egresados", phone = list(enabled = TRUE)),
    list(actor = " egresados "),
    list(actor = "Docentes"),
    list(actor = "")
  ))

  expect_length(roster, 2L)
  expect_equal(vapply(roster, function(u) u$actor, character(1)), c("Egresados", "Docentes"))
  expect_true(all(vapply(roster, function(u) u$origin, character(1)) == "declarado"))
  # El primero gana el desempate y conserva su canal telefonico.
  expect_true(roster[[1]]$phone$enabled)
  expect_equal(roster[[1]]$phone$role, "target")
})

test_that("el merge conserva el elenco declarado y anexa lo que solo vive en fuentes", {
  declarado <- monitoreo_actor_roster_normalize(list(
    list(actor = "Egresados", phone = list(enabled = TRUE))
  ))
  derivado <- list(
    list(actor = "Egresados", origin = "fuentes"),
    list(actor = "Estudiantes", origin = "fuentes")
  )

  merged <- monitoreo_actor_roster_merge(declarado, derivado)

  expect_equal(vapply(merged, function(u) u$actor, character(1)), c("Egresados", "Estudiantes"))
  # El declarado no se degrada a derivado ni pierde su telefono al reaparecer
  # en una fuente: es el mismo actor, no uno nuevo.
  expect_equal(merged[[1]]$origin, "declarado")
  expect_true(merged[[1]]$phone$enabled)
  expect_equal(merged[[2]]$origin, "fuentes")
})

test_that("un actor declarado sobrevive la normalizacion aunque no tenga ninguna fuente", {
  # Este es el caso que antes no se podia expresar: el actor solo nacia al
  # conectar algo, asi que declarar el elenco antes de tener fuentes era
  # imposible.
  cfg <- list(monitoreo_profile = list(
    family = "acreditacion",
    units = monitoreo_actor_roster_normalize(list(
      list(actor = "Egresados", phone = list(enabled = TRUE)),
      list(actor = "Empleadores")
    ))
  ))
  sources <- monitoreo_normalize_sources(list(list(
    id = "s1", kind = "google_sheets", role = "universo", enabled = TRUE,
    label = "Base Estudiantes",
    sheet_binding = list(spreadsheet_id = "abc", sheet_name = "Estudiantes"),
    dimensions = list(actor = "Estudiantes", segmento = "Estudiantes")
  )))
  data <- .monitoreo_apply_source_metadata_to_data(data.frame(x = 1), sources)

  out <- monitoreo_normalize_config(cfg, data)
  actores <- vapply(out$monitoreo_profile$units, function(u) u$actor, character(1))

  expect_equal(actores, c("Egresados", "Empleadores", "Estudiantes"))
  expect_true(out$monitoreo_profile$units[[1]]$phone$enabled)

  # Idempotente: la segunda vuelta no degrada ni reordena el elenco. Sin esto
  # el clobbering vuelve por la puerta de atras en la peticion siguiente.
  again <- monitoreo_normalize_config(out, data)
  expect_equal(
    vapply(again$monitoreo_profile$units, function(u) paste0(u$actor, ":", u$origin), character(1)),
    c("Egresados:declarado", "Empleadores:declarado", "Estudiantes:fuentes")
  )
})

test_that("renombrar un actor reescribe todas sus fuentes, no solo una", {
  sources <- list(
    list(id = "s1", role = "universo", dimensions = list(actor = "Egresados", segmento = "Egresados")),
    list(id = "s2", role = "barrido", dimensions = list(actor = "egresados", segmento = "Egresados")),
    list(id = "s3", role = "respuestas", dimensions = list(actor = "Docentes", segmento = "Docentes"))
  )

  renamed <- monitoreo_actor_roster_rename_sources(sources, "Egresados", "Ex alumnos")

  expect_equal(renamed[[1]]$dimensions$actor, "Ex alumnos")
  # La comparacion es por clave normalizada: "egresados" en minuscula es el
  # mismo actor y tambien se renombra. Dejarlo fuera es como se partia en dos.
  expect_equal(renamed[[2]]$dimensions$actor, "Ex alumnos")
  # El segmento arrastra el nombre y tambien viaja.
  expect_equal(renamed[[2]]$dimensions$segmento, "Ex alumnos")
  expect_equal(renamed[[3]]$dimensions$actor, "Docentes")
})

test_that("las cuentas por actor separan universo, respuestas y barrido", {
  counts <- monitoreo_actor_roster_counts(list(
    list(id = "s1", role = "universo", dimensions = list(actor = "Egresados")),
    list(id = "s2", role = "respuestas", dimensions = list(actor = "Egresados")),
    list(id = "s3", role = "respuestas", dimensions = list(actor = "Egresados")),
    list(id = "s4", role = "barrido", dimensions = list(actor = "Egresados")),
    list(id = "s5", role = "universo", dimensions = list(actor = ""))
  ))

  egresados <- counts[[.monitoreo_safe_name("Egresados")]]
  expect_equal(egresados$universo, 1L)
  expect_equal(egresados$respuestas, 2L)
  expect_equal(egresados$barrido, 1L)
  # Una fuente sin actor no inventa una entrada vacia en el elenco.
  expect_length(counts, 1L)
})

test_that("la cardinalidad corta el segundo universo y el segundo barrido del mismo actor", {
  roster <- monitoreo_actor_roster_normalize(list(
    list(actor = "Egresados", phone = list(enabled = TRUE)),
    list(actor = "Docentes")
  ))
  sources <- list(
    list(id = "s1", role = "universo", dimensions = list(actor = "Egresados")),
    list(id = "s2", role = "barrido", dimensions = list(actor = "Egresados"))
  )

  dup_universo <- monitoreo_actor_roster_conflict(
    sources, list(id = "nuevo", role = "universo", dimensions = list(actor = "Egresados")), roster
  )
  expect_equal(dup_universo$code, "E_MONITOREO_ACTOR_UNIVERSO_DUPLICADO")

  dup_barrido <- monitoreo_actor_roster_conflict(
    sources, list(id = "nuevo", role = "barrido", dimensions = list(actor = "Egresados")), roster
  )
  expect_equal(dup_barrido$code, "E_MONITOREO_ACTOR_BARRIDO_DUPLICADO")

  # Reeditar la MISMA fuente no compite consigo misma: `upsert` reemplaza por
  # id, y sin esta salvedad guardar dos veces el padron seria un error.
  expect_null(monitoreo_actor_roster_conflict(
    sources, list(id = "s1", role = "universo", dimensions = list(actor = "Egresados")), roster
  ))

  # El primer padron de otro actor es legal.
  expect_null(monitoreo_actor_roster_conflict(
    sources, list(id = "nuevo", role = "universo", dimensions = list(actor = "Docentes")), roster
  ))
})

test_that("el barrido exige canal telefonico declarado en el actor", {
  roster <- monitoreo_actor_roster_normalize(list(
    list(actor = "Egresados", phone = list(enabled = TRUE)),
    list(actor = "Docentes")
  ))

  sin_telefono <- monitoreo_actor_roster_conflict(
    list(), list(id = "nuevo", role = "barrido", dimensions = list(actor = "Docentes")), roster
  )
  expect_equal(sin_telefono$code, "E_MONITOREO_ACTOR_SIN_CANAL_TELEFONICO")

  expect_null(monitoreo_actor_roster_conflict(
    list(), list(id = "nuevo", role = "barrido", dimensions = list(actor = "Egresados")), roster
  ))

  # Un actor que todavia no esta en el elenco no se bloquea: el elenco puede
  # estar por declararse y no es el alta de una fuente el sitio para exigirlo.
  expect_null(monitoreo_actor_roster_conflict(
    list(), list(id = "nuevo", role = "barrido", dimensions = list(actor = "Empleadores")), roster
  ))
})

test_that("las respuestas no tienen limite de cardinalidad", {
  # Un actor puede tener varias encuestas —acrconta tiene tres para Egresados—
  # y eso no es un error: el boceto pide AL MENOS una, no exactamente una.
  roster <- monitoreo_actor_roster_normalize(list(list(actor = "Egresados")))
  sources <- list(
    list(id = "s1", role = "respuestas", dimensions = list(actor = "Egresados")),
    list(id = "s2", role = "respuestas", dimensions = list(actor = "Egresados"))
  )

  expect_null(monitoreo_actor_roster_conflict(
    sources, list(id = "nuevo", role = "respuestas", dimensions = list(actor = "Egresados")), roster
  ))
})
