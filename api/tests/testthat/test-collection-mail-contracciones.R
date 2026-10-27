# Aviso «de el» / «a el» (loop editor de correos, L16; collection_mail_contracciones.R).
# Caso real: en Acreditación 2026 un recordatorio decía «la experiencia de el
# personal administrativo», armado con «de {{grupo}}». Sin red.

.cmc_tpl <- function(valor) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  t$constants <- list(list(key = "grupo", label = "Grupo", value = valor))
  t$preheader <- "Cada respuesta ayuda a conocer la experiencia de {{grupo}}."
  .cmail_template_normalize(t)
}

test_that("un dato con artículo tras «de» avisa, en la vista previa y en la apertura del recordatorio", {
  t <- .cmc_tpl("el personal administrativo")
  ch <- .cmail_contraction_check(.cmail_template_for_send(t, NULL))
  expect_identical(ch$status, "warning")
  expect_match(ch$detail, "en la vista previa:", fixed = TRUE)
  rec <- list(send_id = "recordatorio-1", kind = "recordatorio", label = "R1", audience = "ambos",
              opening = "Le escribimos para invitar a el equipo.")
  ef <- .cmail_template_for_send(.cmc_tpl("los docentes"), rec)
  ch2 <- .cmail_contraction_check(ef)
  expect_identical(ch2$status, "warning")
  expect_identical(ch2$targets[[1]]$block_id, .CMAIL_OPENING_ID)
  expect_match(ch2$detail, "en la apertura del envío:", fixed = TRUE)
  expect_false(grepl("__", ch2$detail, fixed = TRUE))
})

test_that("«del», «de él», «de El Comercio» y palabras que empiezan con «el» no avisan", {
  for (v in c("del personal administrativo", "los docentes")) {
    expect_identical(.cmail_contraction_check(.cmail_template_for_send(.cmc_tpl(v), NULL))$status, "ok", label = v)
  }
  t <- .cmc_tpl("los docentes")
  t$preheader <- "Hablamos de él, de El Comercio, de elecciones y a ellos."
  expect_identical(.cmail_contraction_check(t)$status, "ok")
  expect_true(.cmail_contraccion_en("De el modo"))
  expect_true(.cmail_contraccion_en("ir a el."))
})

