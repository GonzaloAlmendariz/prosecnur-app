# Correo: `template.images[id].trae_logos` y el aviso `logos_duplicados`
# (collection_mail_trae_logos.R). Pedido de Gonzalo: «a veces el logo puede venir
# en el banner», «a veces sí viene con logos a veces no». Los banners reales de
# Acreditación PUCP 2026 (Contabilidad MAILLING, Derecho Encabezado: con logos;
# FG FAD: sin logos) se modelan con fixtures sintéticos del mismo tamaño.

.ctl_base <- function() .cmail_template_normalize(.cmail_preset_recuperacion())
.ctl_codes <- function(t) {
  v <- collection_mail_template_validate(.cmail_template_normalize(t))
  vapply(v$problems, `[[`, "", "code")
}
.ctl_paths <- function(t) {
  vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "path")
}
.ctl_bleed <- function(t, id, alt = "Proceso de autoevaluación") {
  t$blocks <- append(t$blocks, list(list(block_id = paste0("img-", id), type = "image", image_ref = id,
                                         alt = alt, bleed = TRUE, width = 600L)), after = 0L)
  t
}
.ctl_with_image <- function(t, id, trae = NULL) {
  img <- list(alt = "Banner de la facultad")
  if (!is.null(trae)) img$trae_logos <- trae
  t$images[[id]] <- img
  t
}
# La franja de logos + Contabilidad (con logos) a sangre: el caso que avisa.
.ctl_franja_contabilidad <- function(trae = TRUE) {
  .cmail_template_normalize(.ctl_bleed(.ctl_with_image(.ctl_base(), "contabilidad-mailing", trae), "contabilidad-mailing"))
}

test_that("trae_logos: lógico opcional en la lista cerrada de claves de imagen", {
  for (v in list(TRUE, FALSE, list(TRUE))) {
    t <- .ctl_with_image(.ctl_base(), "derecho-encabezado", v)
    expect_true(collection_mail_template_validate(.cmail_template_normalize(t))$ok, info = deparse(v))
  }
  # Ausente: «no se sabe», válido.
  expect_true(collection_mail_template_validate(.cmail_template_normalize(.ctl_with_image(.ctl_base(), "fg-fad")))$ok)
  for (v in list("si", 1L, NA, c(TRUE, FALSE), list())) {
    t <- .ctl_with_image(.ctl_base(), "derecho-encabezado", v)
    if (identical(v, list())) t$images$`derecho-encabezado`$trae_logos <- list()
    expect_true("bad_flag" %in% .ctl_codes(t), info = deparse(v))
    expect_true("template.images.derecho-encabezado.trae_logos" %in% .ctl_paths(t), info = deparse(v))
  }
  # Otra clave sigue siendo desconocida.
  t <- .ctl_base(); t$images$pulso$trae_logo <- TRUE
  expect_true("unknown_key" %in% .ctl_codes(t))
  # Se normaliza a escalar lógico.
  n <- .cmail_template_normalize(.ctl_with_image(.ctl_base(), "x-banner", list(TRUE)))
  expect_identical(n$images$`x-banner`$trae_logos, TRUE)
})

test_that("aviso: franja de logos + banner con logos a sangre (Contabilidad MAILLING)", {
  t <- .ctl_franja_contabilidad()
  expect_true(collection_mail_template_validate(t)$ok)
  ch <- .cmail_logos_duplicados_check(t)
  expect_identical(ch$code, "logos_duplicados")
  expect_identical(ch$status, "warning")
  expect_identical(ch$value, 1L)
  expect_identical(ch$detail, "Los logos podrían salir dos veces: el banner ya los trae y además está la franja de logos.")
  expect_identical(ch$items, list("contabilidad-mailing"))
  expect_identical(ch$targets, list(list(block_id = "__cabecera"), list(block_id = "img-contabilidad-mailing")))
})

test_that("aviso: banner con logos dentro de la cabecera de logos (Derecho Encabezado)", {
  t <- .ctl_with_image(.ctl_base(), "derecho-encabezado", TRUE)
  t$header$logo_ids <- list("derecho-encabezado", "pulso")
  t <- .cmail_template_normalize(t)
  expect_true(collection_mail_template_validate(t)$ok)
  ch <- .cmail_logos_duplicados_check(t)
  expect_identical(ch$status, "warning")
  expect_identical(ch$items, list("derecho-encabezado"))
  expect_identical(ch$targets, list(list(block_id = "__cabecera")))
})

test_that("sin aviso: cabecera banner con logos, trae_logos FALSE o ausente, o sin sangre", {
  # Cabecera banner con un banner que trae los logos: el caso correcto.
  t <- .ctl_with_image(.ctl_base(), "contabilidad-mailing", TRUE)
  t$header <- list(kind = "banner", image_ref = "contabilidad-mailing")
  t <- .cmail_template_normalize(t)
  expect_true(collection_mail_template_validate(t)$ok)
  expect_null(.cmail_logos_duplicados_check(t))
  # Incluso si además va a sangre: no hay franja de logos.
  expect_null(.cmail_logos_duplicados_check(.cmail_template_normalize(.ctl_bleed(t, "contabilidad-mailing"))))
  # FG FAD (sin logos): FALSE o sin el dato, bajo la franja de logos (el correo enviado).
  expect_null(.cmail_logos_duplicados_check(.ctl_franja_contabilidad(FALSE)))
  fg <- .cmail_template_normalize(.ctl_bleed(.ctl_with_image(.ctl_base(), "fg-fad"), "fg-fad"))
  expect_null(.cmail_logos_duplicados_check(fg))
  # Con logos pero sin sangre: no es banner de cabecera ni a sangre.
  t <- .ctl_franja_contabilidad(); t$blocks[[1]]$bleed <- FALSE
  expect_null(.cmail_logos_duplicados_check(.cmail_template_normalize(t)))
})

test_that("la revisión publica logos_duplicados en los dos dialectos, sin error", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "contabilidad-mailing.png", 1200L, 810L)
  .cmail_fx_mail_image(sid, "fg-fad.png", 1200L, 600L)
  for (dialect in c("mailchimp", "surveymonkey")) {
    cid <- collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision,
                                           name = dialect, platform = dialect)$campaign$campaign_id
    r <- collection_mail_review(sid, template = .ctl_franja_contabilidad(), campaign_id = cid)
    expect_identical(r$platform, dialect)
    by <- setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
    expect_identical(by$logos_duplicados$status, "warning", info = dialect)
    expect_identical(by$logos_duplicados$targets,
                     list(list(block_id = "__cabecera"), list(block_id = "img-contabilidad-mailing")), info = dialect)
    fg <- .cmail_template_normalize(.ctl_bleed(.ctl_with_image(.ctl_base(), "fg-fad"), "fg-fad"))
    r2 <- collection_mail_review(sid, template = fg, campaign_id = cid)
    expect_false("logos_duplicados" %in% vapply(r2$checks, `[[`, "", "code"), info = dialect)
  }
})

test_that("trae_logos sobrevive al guardado y al .pulso", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- .ctl_with_image(.ctl_base(), "contabilidad-mailing", TRUE)
  t <- .ctl_with_image(t, "fg-fad", FALSE)
  t <- .ctl_with_image(t, "derecho-encabezado")
  put <- collection_mail_template_put(sid, t, .cmail_fx_rev(sid))
  expect_identical(put$template$images$`contabilidad-mailing`$trae_logos, TRUE)
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "TraeLogos")
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  g <- collection_mail_template_get(loaded$session_id)
  expect_identical(g$template$images$`contabilidad-mailing`$trae_logos, TRUE)
  expect_identical(g$template$images$`fg-fad`$trae_logos, FALSE)
  expect_null(g$template$images$`derecho-encabezado`$trae_logos)
  expect_null(g$stored_problems)
})
