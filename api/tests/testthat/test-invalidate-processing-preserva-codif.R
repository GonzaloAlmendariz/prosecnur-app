# Regresión (bug crítico de pérdida de datos): aplicar la codificación de una
# base en un estudio MULTIBASE no debe borrar su catálogo de codificación.
#
# Cadena real del bug: POST /api/codificacion/aplicar -> .codif_apply_complete
# -> estudio_replace_base_files -> .invalidate_processing_state -> el loop de
# `targets` hacía `s$codif_por_base[[bn]] <- NULL`, destruyendo grupos_recod/
# familias/marcadas. Luego .codif_apply_complete re-creaba la entrada con solo
# `aplicado=TRUE`. Resultado: "todas las codificaciones desaparecen" al aplicar.
# Solo golpeaba multibase (madre+repeat como ACNUR). Regresión de 9d995b0b,
# viva en 0.5.15-0.5.18. Fix: preservar definiciones vía .codif_strip_applied_state.

.invproc_seed <- function() {
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
      )
    )
  )
  .session_env[[sid]] <- s
  sid
}

test_that("invalidar el procesamiento de una base preserva su catálogo de codificación", {
  sid <- .invproc_seed()
  s <- .invalidate_processing_state(session_get(sid), "default")

  ent <- s$codif_por_base[["default"]]
  # Definiciones (trabajo del usuario) sobreviven
  expect_true(!is.null(ent$grupos_recod$transport))
  expect_equal(ent$grupos_recod$transport[[1]]$codigo, "901")
  expect_true(!is.null(ent$familias_draft))
  expect_equal(ent$familias_generated, 1L)
  expect_equal(ent$marcadas, list("transport"))
  expect_true(!is.null(ent$respuestas_recod))

  # Estado aplicado/cache stale se invalida (fuerza re-aplicar)
  expect_null(ent$aplicado)
  expect_null(ent$inst)
  expect_null(ent$data)

  # La OTRA base no se toca
  expect_true(!is.null(s$codif_por_base[["rep_servicios"]]$grupos_recod$srv_claridad))
})

test_that("invalidar una base sin codificar no crea una entrada espuria", {
  sid <- .invproc_seed()
  s <- session_get(sid)
  s$codif_por_base[["rep_servicios"]] <- NULL  # base nunca codificada
  .session_env[[sid]] <- s

  out <- .invalidate_processing_state(session_get(sid), "rep_servicios")
  expect_null(out$codif_por_base[["rep_servicios"]])
})
