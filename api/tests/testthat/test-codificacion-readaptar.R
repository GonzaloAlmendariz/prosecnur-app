# Adaptación avisa cuando la base cambió después de adaptar.

test_that("quitar una adaptación aplicada deja la marca y sin adaptación previa no", {
  con <- .codif_strip_applied_state(list(aplicado = TRUE, data = "x", grupos_recod = list(a = 1)))
  expect_null(con$aplicado)
  expect_true(nzchar(con$readaptar_desde))
  expect_identical(con$grupos_recod, list(a = 1))
  sin <- .codif_strip_applied_state(list(grupos_recod = list(a = 1)))
  expect_null(sin$readaptar_desde)
})

test_that("la marca vale hasta que se vuelve a adaptar", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$codif_por_base <- list(default = list(grupos_recod = list(a = 1), aplicado = TRUE))
  .session_env[[sid]] <- s
  expect_false(codificacion_respuestas_cambiaron(sid, source = "default"))
  s <- session_get(sid)
  s$codif_por_base$default <- .codif_strip_applied_state(s$codif_por_base$default)
  .session_env[[sid]] <- s
  expect_true(codificacion_respuestas_cambiaron(sid, source = "default"))
  codif_set(sid, "aplicado", TRUE, source = "default")
  expect_false(codificacion_respuestas_cambiaron(sid, source = "default"))
})
