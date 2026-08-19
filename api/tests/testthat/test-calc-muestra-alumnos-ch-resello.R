# L14 · Reconstruir el marco re-sella la decisión de alumnos por CH.
#
# La decisión se firma contra un marco concreto y su firma lleva el `frame_hash`.
# Un guardado cuya decisión apunte a otro marco borra el objetivo de
# cursos-horario — eso está bien y hay contrato HTTP que lo defiende.
#
# Lo que fallaba era la secuencia: firmar la decisión OBLIGA a reconstruir
# (`decision_stale`), reconstruir cambia el hash, y nadie re-sellaba la decisión.
# Quedaba stale para siempre, así que el objetivo se borraba en cada guardado y
# Titulares, Reemplazos y Sustento no se acreditaban nunca.
#
# Se re-sella porque el estadístico NO depende del marco (decisión de dominio,
# 2026-08-15): elegir P25 o mediana es una postura sobre cómo resumir la
# distribución, no sobre qué distribución se mira.

.resello_decision <- function(hash, schema = "calc_muestra_alumnos_por_ch_decision_v1",
                              estadistico = "p25") {
  list(
    schema = schema,
    estadistico_default = estadistico,
    denominador = "elegible",
    por_facultad = list(),
    frame_hash = hash,
    confirmado_at = "2026-08-15T00:00:00Z"
  )
}

.resello_sid <- function(decision) {
  sid <- session_create()
  session_set(sid, "calc_muestra_estudio", list(
    workspace = list(aulas_config = list(alumnos_por_ch_decision = decision))
  ))
  sid
}

.resello_leer <- function(sid) {
  session_get(sid)$calc_muestra_estudio$workspace$aulas_config$alumnos_por_ch_decision
}

test_that("una decisión confirmada se re-sella con el marco nuevo", {
  sid <- .resello_sid(.resello_decision("HASH_VIEJO"))

  expect_true(.cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO"))

  d <- .resello_leer(sid)
  expect_identical(d$frame_hash, "HASH_NUEVO")
  # Lo único que cambia es el sello: el estadístico y el reparto no se tocan.
  expect_identical(d$estadistico_default, "p25")
  expect_identical(d$denominador, "elegible")
  expect_identical(d$confirmado_at, "2026-08-15T00:00:00Z")
})

test_that("re-sellar deja la decisión vigente para el guard", {
  # La propiedad que cierra L14: tras re-sellar, un guardado con el marco nuevo
  # ya NO ve la decisión como cambiada, así que el objetivo sobrevive.
  sid <- .resello_sid(.resello_decision("HASH_VIEJO"))
  .cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO")
  d <- .resello_leer(sid)

  antes <- calc_muestra_normalize_estudio(list(workspace = list(aulas_config = list(
    alumnos_por_ch_decision = d, n_aulas = 200
  ))))
  despues <- antes

  expect_false(.cm_alumnos_por_ch_decision_changed(antes, despues))
  res <- .cm_alumnos_por_ch_preparar_estudio_guardado(antes, despues)
  expect_identical(res$estudio$workspace$aulas_config$n_aulas, 200L)
})

test_that("una decisión sin confirmar no se bendice al reconstruir", {
  # Un sentinela incompleto —schema vacío— debe seguir fallando cerrado en
  # /calcular. Re-sellarlo lo convertiría en válido sin que nadie lo firmara.
  sid <- .resello_sid(.resello_decision("HASH_VIEJO", schema = ""))

  expect_false(.cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO"))
  expect_identical(.resello_leer(sid)$frame_hash, "HASH_VIEJO")
})

test_that("sin decisión, sin hash o con el mismo hash no se toca nada", {
  sid_sin <- session_create()
  session_set(sid_sin, "calc_muestra_estudio", list(workspace = list(aulas_config = list())))
  expect_false(.cm_alumnos_por_ch_resellar(sid_sin, "HASH_NUEVO"))

  sid <- .resello_sid(.resello_decision("HASH_VIEJO"))
  # Hash vacío: no hay marco nuevo que sellar.
  expect_false(.cm_alumnos_por_ch_resellar(sid, ""))
  expect_identical(.resello_leer(sid)$frame_hash, "HASH_VIEJO")

  # Mismo hash: nada que actualizar, y se declara para no escribir en balde.
  sid_igual <- .resello_sid(.resello_decision("HASH_A"))
  expect_false(.cm_alumnos_por_ch_resellar(sid_igual, "HASH_A"))
})

test_that("el re-sellado no reactiva un objetivo tras cambiar el estadístico", {
  # El guard tiene que seguir mordiendo donde importa: re-sellar actualiza el
  # marco, no perdona un cambio de decisión.
  sid <- .resello_sid(.resello_decision("HASH_VIEJO", estadistico = "p25"))
  .cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO")
  vigente <- .resello_leer(sid)

  antes <- calc_muestra_normalize_estudio(list(workspace = list(aulas_config = list(
    alumnos_por_ch_decision = vigente, n_aulas = 200
  ))))
  cambiada <- vigente
  cambiada$estadistico_default <- "mediana"
  despues <- calc_muestra_normalize_estudio(list(workspace = list(aulas_config = list(
    alumnos_por_ch_decision = cambiada, n_aulas = 200
  ))))

  expect_true(.cm_alumnos_por_ch_decision_changed(antes, despues))
  expect_null(
    .cm_alumnos_por_ch_preparar_estudio_guardado(antes, despues)$estudio$workspace$aulas_config$n_aulas
  )
})

test_that("el resello tambien sella el ESPEJO en la config de aulas de sesion", {
  # El guard de los artefactos de Aulas compara la firma del estudio contra la
  # de calc_muestra_aulas_config, y el guardado del marco reemplaza esa config
  # por la del frame construido — que carga el hash del marco ANTERIOR.
  # Resellar solo el estudio dejaba firmas divergentes y un 409 decision_stale
  # eterno tras cada reconstruccion (medido 2026-08-19 sobre el marco 2026:
  # estudio 3644ce7a…, config 8f676b56…).
  sid <- .resello_sid(.resello_decision("HASH_VIEJO"))
  session_set(sid, "calc_muestra_aulas_config", list(
    alumnos_por_ch_decision = .resello_decision("HASH_MAS_VIEJO_AUN")
  ))

  expect_true(.cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO"))

  s <- session_get(sid)
  espejo <- s$calc_muestra_aulas_config$alumnos_por_ch_decision
  expect_identical(espejo$frame_hash, "HASH_NUEVO")
  # Y el guard queda satisfecho: ambas firmas convergen.
  expect_true(.cm_alumnos_por_ch_decision_matches_config(
    s$calc_muestra_estudio,
    s$calc_muestra_aulas_config
  ))
})

test_that("un espejo sin decision o sin schema no se inventa", {
  sid <- .resello_sid(.resello_decision("HASH_VIEJO"))
  session_set(sid, "calc_muestra_aulas_config", list(selector = list(n_aulas = 5L)))
  expect_true(.cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO"))
  s <- session_get(sid)
  expect_null(s$calc_muestra_aulas_config$alumnos_por_ch_decision)
})

test_that("el espejo se sella aunque el estudio YA este al dia (el caso real)", {
  # Dos builds seguidos producen el mismo hash: el estudio quedo sellado en el
  # primero y el early-return «nada que resellar» saltaba el espejo en el
  # segundo. Cada copia se evalua por su cuenta.
  sid <- .resello_sid(.resello_decision("HASH_NUEVO"))
  session_set(sid, "calc_muestra_aulas_config", list(
    alumnos_por_ch_decision = .resello_decision("HASH_VIEJO")
  ))

  expect_true(.cm_alumnos_por_ch_resellar(sid, "HASH_NUEVO"))

  s <- session_get(sid)
  expect_identical(s$calc_muestra_aulas_config$alumnos_por_ch_decision$frame_hash, "HASH_NUEVO")
  expect_true(.cm_alumnos_por_ch_decision_matches_config(
    s$calc_muestra_estudio,
    s$calc_muestra_aulas_config
  ))
})

test_that("la TERCERA copia — la config del frame — sale sellada del guardado", {
  # Los routers de Aulas validan contra frame$config, no contra la sesion.
  # Sin resellar la config del frame, el 409 sobrevivia a los otros dos sellos.
  sid <- session_create()
  session_set(sid, "calc_muestra_estudio", list(
    workspace = list(aulas_config = list(alumnos_por_ch_decision = .resello_decision("HASH_VIEJO")))
  ))
  frame <- list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = "HASH_NUEVO",
    aula_frame = data.frame(),
    config = calc_muestra_aulas_normalize_config(list(
      alumnos_por_ch_decision = .resello_decision("HASH_VIEJO")
    ))
  )
  guardado <- .cm_criterios_frame_guardar(sid, frame)
  expect_identical(guardado$config$alumnos_por_ch_decision$frame_hash, "HASH_NUEVO")
  s <- session_get(sid)
  expect_identical(s$calc_muestra_aulas_config$alumnos_por_ch_decision$frame_hash, "HASH_NUEVO")
  # Y el guard de los artefactos queda satisfecho con la config del frame.
  expect_true(.cm_alumnos_por_ch_decision_matches_config(
    s$calc_muestra_estudio, guardado$config
  ))
})
