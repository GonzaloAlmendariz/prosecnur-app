# ADR 0078 — marcar una variable abre una decisión, no la cierra.
#
# Los cinco invariantes del Cumplimiento, con el estado de partida de ACNUR V3
# como caso de prueba: de 9 marcadas debía reportar 4 pendientes y no 6.

.dec <- function(status, marcada = TRUE, no_cat = NULL) {
  prosecnurapp:::.codif_decision_de_pregunta(status, marcada, no_cat)
}

.preg <- function(parent, status, marcada = TRUE, n_resp = 0L, n_unicas = 0L,
                  n_cod = 0L, no_cat = NULL) {
  list(
    parent = parent, parent_label = parent, marcada = marcada,
    n_respuestas = n_resp, n_unicas = n_unicas, n_codificadas = n_cod,
    no_categorizar = no_cat,
    decision = .dec(status, marcada, no_cat)
  )
}

test_that("el vocabulario del ADR se deriva del status, sin taxonomía paralela", {
  expect_equal(.dec("completo"), "categorizada")
  expect_equal(.dec("sin-datos"), "sin_material")
  expect_equal(.dec("no-iniciado"), "pendiente")
  expect_equal(.dec("en-curso"), "pendiente_parcial")
  expect_equal(.dec("requiere-config"), "requiere_config")
  # Sin marcar no entra en ningún conteo, diga lo que diga el status.
  expect_equal(.dec("no-iniciado", marcada = FALSE), "sin_marcar")
  expect_equal(.dec("no-aplica"), "sin_marcar")
})

test_that("una decisión explícita de no categorizar cierra, gane lo que gane el status", {
  # El punto del ADR: «no categorizar» cierra igual que categorizar. Si no
  # ganara sobre el status, la variable seguiría contando como pendiente y la
  # decisión no serviría de nada.
  reg <- list(motivo = "n insuficiente para tramos cruzables", decidido_en = "2026-08-15T10:00:00Z")
  expect_equal(.dec("no-iniciado", no_cat = reg), "no_categorizar")
  expect_equal(.dec("en-curso", no_cat = reg), "no_categorizar")
  # Una lista vacía no es una decisión.
  expect_equal(.dec("no-iniciado", no_cat = list()), "pendiente")
})

test_that("el resumen reproduce el estado de partida de ACNUR V3: 4 pendientes, no 6", {
  # Invariantes 1, 2 y 3 juntos, que es como se contradicen.
  preguntas <- list(
    # 3 con categorías
    .preg("ContextProfesion", "completo", n_resp = 87L, n_unicas = 40L, n_cod = 40L),
    .preg("reva_sit_why", "completo", n_resp = 3L, n_unicas = 3L, n_cod = 3L),
    .preg("psico_empleador_why", "completo", n_resp = 2L, n_unicas = 2L, n_cod = 2L),
    # 4 pendientes con respuestas
    .preg("MesesReva", "no-iniciado", n_resp = 87L, n_unicas = 9L),
    .preg("NowSalary", "no-iniciado", n_resp = 16L, n_unicas = 12L),
    .preg("PastSalary", "no-iniciado", n_resp = 4L, n_unicas = 4L),
    .preg("GeneralSatisfaction_why", "no-iniciado", n_resp = 1L, n_unicas = 1L),
    # 2 sin material: se cierran solas
    .preg("ExpSatisfaction_why", "sin-datos"),
    .preg("RecomendSatisfaction_text", "sin-datos"),
    # 1 detectada automáticamente con catálogo a medias
    .preg("Sos_desarrollo", "en-curso", n_resp = 87L, n_unicas = 12L, n_cod = 0L),
    # 1 sin marcar: no entra
    .preg("ObservacionesCampo", "no-iniciado", marcada = FALSE, n_resp = 30L)
  )
  r <- prosecnurapp:::.codif_resumen_decisiones(preguntas)

  expect_equal(r$marcadas, 10L)
  expect_equal(r$categorizadas, 3L)
  expect_equal(r$sin_material, 2L)
  # 4 pendientes + el catálogo a medias de Sos_desarrollo (invariante 3).
  expect_equal(r$sin_decidir, 5L)
  parents <- vapply(r$pendientes, function(p) p$parent, character(1))
  expect_setequal(parents, c("MesesReva", "NowSalary", "PastSalary",
                             "GeneralSatisfaction_why", "Sos_desarrollo"))
  # Invariante 2: las sin material nunca aparecen.
  expect_false(any(c("ExpSatisfaction_why", "RecomendSatisfaction_text") %in% parents))
  # Y las sin marcar tampoco.
  expect_false("ObservacionesCampo" %in% parents)
  # El control: si `sin_material` contara como pendiente serían 7, que es el
  # número que la interfaz mostraba antes de este ADR.
  expect_false(r$sin_decidir == 7L)
})

test_that("las pendientes salen primero las que más trabajo tienen detrás", {
  preguntas <- list(
    .preg("chica", "no-iniciado", n_resp = 1L),
    .preg("grande", "no-iniciado", n_resp = 87L),
    .preg("media", "no-iniciado", n_resp = 16L)
  )
  r <- prosecnurapp:::.codif_resumen_decisiones(preguntas)
  expect_equal(vapply(r$pendientes, function(p) p$parent, character(1)),
               c("grande", "media", "chica"))
})

test_that("un resumen sin preguntas no inventa pendientes", {
  r <- prosecnurapp:::.codif_resumen_decisiones(list())
  expect_equal(r$sin_decidir, 0L)
  expect_length(r$pendientes, 0L)
})

test_that("registrar no categorizar exige motivo y sobrevive al reabrir", {
  # Invariante 4: la decisión se guarda en el state de codificación, que es lo
  # que el `.pulso` persiste entero menos los caches.
  sid <- prosecnurapp:::session_create()

  err <- tryCatch(prosecnurapp:::codif_no_categorizar_set(sid, "NowSalary", "  ", source = "b1"),
                  api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_CODIF_MOTIVO_REQUERIDO")

  err2 <- tryCatch(prosecnurapp:::codif_no_categorizar_set(sid, "", "un motivo", source = "b1"),
                   api_error = function(e) e)
  expect_equal(err2$code, "E_CODIF_NO_PARENT")

  prosecnurapp:::codif_no_categorizar_set(sid, "NowSalary", "n insuficiente (16)", source = "b1")
  reg <- prosecnurapp:::.codif_no_categorizar_de(sid, "NowSalary", source = "b1")
  expect_equal(reg$motivo, "n insuficiente (16)")
  expect_true(nzchar(reg$decidido_en))

  # Scopeada por base: marcarla en una no la marca en otra.
  expect_null(prosecnurapp:::.codif_no_categorizar_de(sid, "NowSalary", source = "b2"))

  # Revertir la devuelve a pendiente y no deja rastro que la siga cerrando.
  expect_true(prosecnurapp:::codif_no_categorizar_unset(sid, "NowSalary", source = "b1"))
  expect_null(prosecnurapp:::.codif_no_categorizar_de(sid, "NowSalary", source = "b1"))
  err3 <- tryCatch(prosecnurapp:::codif_no_categorizar_unset(sid, "NowSalary", source = "b1"),
                   api_error = function(e) e)
  expect_equal(err3$code, "E_CODIF_SIN_DECISION")
})

test_that("lo que se entrega sin recodificar distingue lo deliberado del olvido", {
  # Invariante 5: la advertencia al aplicar no puede meter en la misma bolsa
  # una decisión metodológica y una variable que nadie miró.
  reg <- list(motivo = "se analiza como continua", decidido_en = "2026-08-15T10:00:00Z")
  preguntas <- list(
    .preg("ContextProfesion", "completo", n_resp = 87L, n_unicas = 40L, n_cod = 40L),
    .preg("MesesReva", "no-iniciado", n_resp = 87L),
    .preg("Sos_desarrollo", "en-curso", n_resp = 87L, n_unicas = 12L),
    .preg("NowSalary", "no-iniciado", n_resp = 16L, no_cat = reg),
    .preg("ExpSatisfaction_why", "sin-datos")
  )
  out <- prosecnurapp:::.codif_sin_recodificar(preguntas)
  parents <- vapply(out, function(p) p$parent, character(1))

  expect_setequal(parents, c("MesesReva", "Sos_desarrollo", "NowSalary"))
  # La categorizada no está, y la sin material tampoco: no hay nada que avisar.
  expect_false("ContextProfesion" %in% parents)
  expect_false("ExpSatisfaction_why" %in% parents)

  deliberadas <- Filter(function(p) isTRUE(p$deliberado), out)
  expect_equal(vapply(deliberadas, function(p) p$parent, character(1)), "NowSalary")
  expect_equal(deliberadas[[1]]$motivo, "se analiza como continua")
  # Las otras dos no traen motivo porque no lo tienen: es el dato honesto.
  olvidos <- Filter(function(p) !isTRUE(p$deliberado), out)
  expect_true(all(vapply(olvidos, function(p) !nzchar(p$motivo), logical(1))))
})
