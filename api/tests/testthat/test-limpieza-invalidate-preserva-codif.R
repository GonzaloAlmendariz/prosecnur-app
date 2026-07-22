# Regresión: re-finalizar/invalidar la LIMPIEZA de una base no debe destruir
# el catálogo de codificación (grupos_recod, familias_*, marcadas). Histórico:
# `.limpieza_invalidate_downstream` hacía `codif_por_base[[base]] <- list()` y
# el usuario quedaba "descodificado" pese a tener su data adaptada aplicada
# (caso real: base default del compañero perdió todo su trabajo de codificación
# tras re-tocar la limpieza; solo sobrevivía `list(aplicado = TRUE)`).

.inval_seed_session <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(
      default = list(nombre = "default"),
      rep_servicios = list(nombre = "rep_servicios")
    ),
    active_base = "default"
  )
  s$codif_por_base <- list(
    default = list(
      grupos_recod = list(
        transport = list(list(codigo = "901", etiqueta = "A pie", respuestas = list("caminando")))
      ),
      familias_draft = list(x = 1),
      familias_generated = 1L,
      marcadas = list("transport"),
      respuestas_recod = list(a = "b"),
      aplicado = TRUE,
      inst = list(dummy = TRUE),
      data = data.frame(z = 1)
    ),
    rep_servicios = list(
      grupos_recod = list(
        srv_claridad = list(list(codigo = "801", etiqueta = "Claro", respuestas = list("sí")))
      ),
      aplicado = TRUE
    )
  )
  .session_env[[sid]] <- s
  sid
}

test_that("invalidar limpieza por base preserva las definiciones de codificación", {
  sid <- .inval_seed_session()
  .limpieza_invalidate_downstream(sid, "default")
  ent <- session_get(sid)$codif_por_base[["default"]]

  # Definiciones (el trabajo del usuario) sobreviven
  expect_true(!is.null(ent$grupos_recod$transport))
  expect_equal(ent$grupos_recod$transport[[1]]$codigo, "901")
  expect_true(!is.null(ent$familias_draft))
  expect_equal(ent$familias_generated, 1L)
  expect_equal(ent$marcadas, list("transport"))
  expect_true(!is.null(ent$respuestas_recod))

  # Estado aplicado/cache stale se limpia (fuerza re-aplicar)
  expect_null(ent$aplicado)
  expect_null(ent$inst)
  expect_null(ent$data)

  # La OTRA base no se toca
  reps <- session_get(sid)$codif_por_base[["rep_servicios"]]
  expect_true(!is.null(reps$grupos_recod$srv_claridad))
  expect_true(isTRUE(reps$aplicado))
})

test_that("invalidar global (sin base) preserva definiciones en todas las bases", {
  sid <- .inval_seed_session()
  s <- session_get(sid)
  s$estudio <- NULL  # fuerza la rama legacy/global (resolved = NULL)
  .session_env[[sid]] <- s

  .limpieza_invalidate_downstream(sid, NULL)
  cpb <- session_get(sid)$codif_por_base

  expect_true(!is.null(cpb$default$grupos_recod$transport))
  expect_true(!is.null(cpb$rep_servicios$grupos_recod$srv_claridad))
  expect_null(cpb$default$aplicado)
  expect_null(cpb$default$inst)
  expect_null(cpb$default$data)
})
