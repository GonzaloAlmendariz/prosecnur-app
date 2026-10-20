# collection_mail_checks.R — chequeos de imágenes y de contraste de la
# revisión del correo (ADR 0110 §B y E1g §1/§3).
#
# Cada chequeo trae `code`, `status` (ok | warning | error), su cifra (`value`)
# y, cuando se ve en un lugar del correo, `targets: [{block_id, prop?}]`
# (`__cabecera` es la cabecera).

.CMAIL_BANNER_W <- 1200L
.CMAIL_BANNER_H <- 600L
.CMAIL_BANNER_MAX_BYTES <- 1024L * 1024L

.cmail_target <- function(block_id, prop = NULL) .cmc_drop_nulls_deep(list(block_id = block_id, prop = prop))

# Imágenes de la plantilla con dónde se ven: cabecera e imágenes de bloque.
.cmail_image_uses <- function(tpl) {
  uses <- list()
  h <- tpl$header %||% list()
  head_ids <- if (identical(h$kind, "banner")) as.character(h$image_ref) else
    as.character(unlist(h$logo_ids %||% list(), use.names = FALSE))
  for (id in head_ids) {
    uses[[length(uses) + 1L]] <- list(id = id, target = .cmail_target("__cabecera"),
                                      alt = .cmail_one((tpl$images %||% list())[[id]]$alt) %||% "")
  }
  for (b in tpl$blocks %||% list()) {
    if (!identical(b$type, "image")) next
    uses[[length(uses) + 1L]] <- list(id = as.character(.cmail_one(b$image_ref) %||% ""),
                                      target = .cmail_target(as.character(b$block_id), "alt"),
                                      alt = .cmail_one(b$alt) %||% "", block = b)
  }
  uses
}

#' Chequeos de imagen. `push` agrega un chequeo a la lista de la revisión.
#'
#' Comunes: `images_alt`, `image_width`, `image_weight`. Mailchimp suma
#' `images_hosted`, `images_available`, `import_zip_weight` y `banner_size`;
#' SurveyMonkey, `images_public_url` (no documenta subir imágenes para el HTML
#' personalizado: cada una necesita su URL https).
#' @keywords internal
.cmail_image_checks <- function(tpl, images, html, html_bytes, push, dialect = .CMAIL_PLATFORM_DEFAULT) {
  if (identical(dialect, "surveymonkey")) return(.cmail_image_checks_sm(tpl, images, push))
  # Alojamiento: cada imagen tiene URL https o va dentro del ZIP importable.
  data_uris <- lengths(regmatches(html, gregexpr("data:[a-z]+/", html)))
  in_zip <- vapply(images, function(i) is.null(i$url) && !is.null(i$path), NA)
  push(if (data_uris > 0L) {
    .cmail_check("images_hosted", "error", as.integer(data_uris), "Hay imágenes incrustadas (data:); deben ir alojadas.")
  } else {
    .cmail_check("images_hosted", "ok", as.integer(sum(in_zip)),
                 sprintf("%d imágenes van en %s (Mailchimp las sube al importar) y %d tienen URL pública.",
                         as.integer(sum(in_zip)), .CMAIL_IMPORT_ZIP_NAME, as.integer(sum(!in_zip & vapply(images, function(i) !is.null(i$url), NA)))))
  })

  uses <- .cmail_image_uses(tpl)
  missing <- vapply(images, function(i) is.null(i$path) && is.null(i$url), NA)
  miss_ids <- names(images)[missing]
  push(if (any(missing)) {
    .cmail_check("images_available", "error", as.integer(sum(missing)),
                 "Imágenes que no están en el proyecto ni tienen URL.", extra = as.list(miss_ids),
                 targets = lapply(Filter(function(u) u$id %in% miss_ids, uses), `[[`, "target"))
  } else {
    .cmail_check("images_available", "ok", 0L, "Todas las imágenes están disponibles.")
  })

  push <- .cmail_image_checks_common(tpl, images, uses, push)

  est <- .cmail_import_zip_estimate(html_bytes, images)
  push(if (est$bytes >= .CMAIL_IMPORT_ZIP_MAX) {
    .cmail_check("import_zip_weight", "error", est$bytes,
                 "El ZIP importable pesaría 1 MB o más y Mailchimp lo rechaza. Da una URL https a las imágenes más pesadas: las que tienen URL no entran al ZIP.",
                 extra = est$images)
  } else if (est$bytes > .CMAIL_IMPORT_ZIP_WARN) {
    .cmail_check("import_zip_weight", "warning", est$bytes,
                 "El ZIP importable se acerca a 1 MB (el tope de Mailchimp). Considera dar una URL https a las imágenes más pesadas.",
                 extra = est$images)
  } else {
    .cmail_check("import_zip_weight", "ok", est$bytes, "El ZIP importable queda bajo 1 MB.", extra = est$images)
  })

  if (identical(tpl$header$kind, "banner")) {
    img <- images[[as.character(tpl$header$image_ref)]]
    size <- img$size
    push(if (is.null(size)) {
      .cmail_check("banner_size", if (is.null(img$url)) "error" else "warning", NULL,
                   "No se pudo medir el banner (se espera una imagen de 1200 × 600 en el proyecto).",
                   targets = list(.cmail_target("__cabecera")))
    } else if (!identical(as.integer(size$width), .CMAIL_BANNER_W) || !identical(as.integer(size$height), .CMAIL_BANNER_H)) {
      .cmail_check("banner_size", "error", sprintf("%d×%d", as.integer(size$width), as.integer(size$height)),
                   "El banner de mailing mide 1200 × 600.", targets = list(.cmail_target("__cabecera")))
    } else if (isTRUE(img$bytes > .CMAIL_BANNER_MAX_BYTES)) {
      .cmail_check("banner_size", "warning", as.integer(img$bytes), "El banner supera 1 MB; tarda en cargar.")
    } else {
      .cmail_check("banner_size", "ok", "1200×600", "Banner de 1200 × 600.")
    })
  }
  push
}

# Chequeos de imagen comunes a los dos dialectos.
.cmail_image_checks_common <- function(tpl, images, uses, push) {
  no_alt <- Filter(function(u) .cmail_alt_missing(u$alt), uses)
  push(if (length(no_alt)) {
    .cmail_check("images_alt", "error", length(no_alt), "Imágenes sin texto alternativo.",
                 extra = as.list(unique(vapply(no_alt, `[[`, "", "id"))), targets = lapply(no_alt, `[[`, "target"))
  } else {
    .cmail_check("images_alt", "ok", 0L, "Toda imagen lleva texto alternativo.")
  })

  # Nitidez: el ancho mostrado a 2x no debe pasar el natural.
  blurry <- list()
  for (u in Filter(function(u) !is.null(u$block), uses)) {
    natural <- images[[u$id]]$size$width
    if (is.null(natural)) next
    shown <- .cmail_image_width(u$block, images[[u$id]])
    if (shown * 2L > natural) {
      blurry[[length(blurry) + 1L]] <- list(id = u$id, block_id = u$target$block_id, width = shown, natural = as.integer(natural))
    }
  }
  if (any(vapply(uses, function(u) !is.null(u$block), NA))) {
    push(if (length(blurry)) {
      .cmail_check("image_width", "warning", length(blurry),
                   "Imágenes mostradas a más de la mitad de su ancho natural: se verán borrosas en pantallas de alta densidad.",
                   extra = blurry, targets = lapply(blurry, function(x) .cmail_target(x$block_id, "width")))
    } else {
      .cmail_check("image_width", "ok", 0L, "Cada imagen tiene resolución para mostrarse a 2x.")
    })
  }

  heavy <- Filter(function(i) isTRUE(i$bytes > .CMAIL_IMAGE_WARN_BYTES), images)
  if (length(heavy)) {
    push(.cmail_check("image_weight", "warning", length(heavy),
                      "Imágenes de más de 200 KB: tardan en cargar en el teléfono.",
                      extra = lapply(heavy, function(i) list(id = i$id, size_bytes = as.integer(i$bytes)))))
  }

  push
}

# SurveyMonkey: cada imagen necesita su URL https (sin ella, `src=""`).
.cmail_image_checks_sm <- function(tpl, images, push) {
  uses <- .cmail_image_uses(tpl)
  push <- .cmail_image_checks_common(tpl, images, uses, push)
  no_url <- names(images)[vapply(images, function(i) {
    u <- .cmail_one(i$url); is.null(u) || !grepl("^https://", u)
  }, NA)]
  push(if (length(no_url)) {
    .cmail_check("images_public_url", "error", length(no_url),
                 "SurveyMonkey necesita una URL https pública para cada imagen (no se sube con el HTML personalizado).",
                 extra = as.list(no_url), targets = lapply(Filter(function(u) u$id %in% no_url, uses), `[[`, "target"))
  } else {
    .cmail_check("images_public_url", "ok", 0L, "Cada imagen apunta a su URL https pública.")
  })
  push
}

# Chequeos propios de SurveyMonkey sobre el HTML que sale (E1j; ajustes de la
# revisión metodológica E1jkl). Ningún texto prescribe [SurveyLink] para un
# enlace que ya existe: si ese enlace no es la encuesta, SurveyMonkey no es la
# plataforma del correo (`destino`, collection_mail_template.R).
.CMAIL_SM_NOT_PLATFORM <- "Si el enlace de este correo no es la encuesta, SurveyMonkey no es la plataforma de este correo: envíalo por Mailchimp."

.cmail_sm_checks <- function(tpl, html, push) {
  fields <- .cmail_field_index(tpl)
  used <- setdiff(.cmail_used_keys(tpl), "nombre")
  usage <- .cmail_key_usage(tpl)
  push(if (grepl('href="[SurveyLink]"', html, fixed = TRUE)) {
    .cmail_check("survey_link", "ok", 1L, "El correo lleva el enlace a la encuesta ([SurveyLink]).")
  } else {
    .cmail_check("survey_link", "error", 0L,
                 paste("SurveyMonkey exige [SurveyLink]: el correo tiene que llevar a la encuesta del recopilador.",
                       "Un campo cuyo enlace es la encuesta se declara con etiqueta SurveyLink.", .CMAIL_SM_NOT_PLATFORM))
  })
  optout <- grepl('href="[OptOutLink]"', html, fixed = TRUE)
  push(.cmail_check("footer_optout", if (optout) "ok" else "error", as.integer(optout),
                    if (optout) "El pie lleva la baja ([OptOutLink]) y la privacidad ([PrivacyLink])." else "Falta [OptOutLink] en el pie."))
  unmapped <- used[vapply(used, function(k) is.null(fields[[k]]$sm), NA)]
  push(if (length(unmapped)) {
    in_url <- unmapped[vapply(unmapped, function(k) "url" %in% (usage[[k]] %||% character(0)), NA)]
    .cmail_check("sm_fields_mapped", "error", length(unmapped),
                 paste0(sprintf("Campos sin dato de SurveyMonkey: %s. Un dato del contacto se declara [LastName] o [CustomDataN].",
                                paste(sprintf("{{%s}}", unmapped), collapse = ", ")),
                        if (length(in_url)) paste0(" ", sprintf("%s va en un enlace. ", paste(sprintf("{{%s}}", in_url), collapse = ", ")),
                                                   .CMAIL_SM_NOT_PLATFORM)),
                 extra = as.list(unmapped), targets = .cmail_key_targets(tpl, unmapped))
  } else {
    .cmail_check("sm_fields_mapped", "ok", 0L, "Cada campo usado tiene su etiqueta de SurveyMonkey.",
                 extra = lapply(used, function(k) list(key = k, sm = fields[[k]]$sm)))
  })

  # Sin respaldo: cómo sale cada texto para quien no tenga el dato en Contactos.
  survey <- vapply(used, function(k) identical(fields[[k]]$sm, "SurveyLink"), NA)
  body_keys <- c(
    if ("nombre" %in% .cmail_used_keys(tpl) && any((usage$nombre %||% character(0)) != "url")) "nombre",
    used[!survey & vapply(used, function(k) any((usage[[k]] %||% character(0)) != "url"), NA)]
  )
  if (length(body_keys)) {
    push(.cmail_check("sm_fallback", "warning", length(body_keys),
                      paste("SurveyMonkey no tiene respaldo: quien no tenga el dato en Contactos verá el espacio vacío.",
                            paste(.cmail_sm_blank_lines(tpl, body_keys, fields), collapse = " ")),
                      extra = as.list(body_keys), targets = .cmail_key_targets(tpl, body_keys)))
  } else {
    push(.cmail_check("sm_fallback", "ok", 0L, "Ningún texto depende de un dato del contacto."))
  }
  link_keys <- c(
    if ("url" %in% (usage$nombre %||% character(0))) "nombre",
    used[!survey & vapply(used, function(k) "url" %in% (usage[[k]] %||% character(0)), NA)]
  )
  if (length(link_keys)) {
    push(.cmail_check("sm_link_field_empty", "warning", length(link_keys),
                      sprintf("%s va dentro de un enlace: un contacto sin ese dato en SurveyMonkey recibe un enlace roto, y la app no puede contarlos (los contactos viven en el recopilador).",
                              paste(sprintf("{{%s}}", link_keys), collapse = ", ")),
                      extra = as.list(link_keys), targets = .cmail_key_targets(tpl, link_keys)))
  }
  custom <- vapply(used, function(k) {
    sm <- fields[[k]]$sm %||% ""
    if (grepl("^CustomData[0-9]+$", sm)) as.integer(sub("^CustomData", "", sm)) else 0L
  }, integer(1))
  if (any(custom > 0L)) {
    over <- used[custom > .CMAIL_SM_CUSTOM_PLAN_LIMIT]
    push(if (length(over)) {
      .cmail_check("sm_custom_limit", "warning", length(over),
                   sprintf("Se usa CustomData mayor que %d (%s): fuera de los planes Team/Enterprise SurveyMonkey ofrece solo CustomData1 a CustomData%d.",
                           .CMAIL_SM_CUSTOM_PLAN_LIMIT, paste(vapply(over, function(k) fields[[k]]$sm, ""), collapse = ", "),
                           .CMAIL_SM_CUSTOM_PLAN_LIMIT),
                   extra = as.list(over), targets = .cmail_key_targets(tpl, over))
    } else {
      .cmail_check("sm_custom_limit", "ok", max(custom), sprintf("Los datos personalizados usados están entre CustomData1 y CustomData%d.", .CMAIL_SM_CUSTOM_PLAN_LIMIT))
    })
  }
  push
}

# Frases «así sale sin el dato»: el saludo entero (con su respaldo descartado)
# y cada campo con respaldo o sin él.
.cmail_sm_blank_lines <- function(tpl, keys, fields) {
  out <- character(0)
  blank <- function(text) {
    t <- gsub("**", "", as.character(text), fixed = TRUE)
    t <- gsub(.CMAIL_TOKEN_RE, "", t, perl = TRUE)
    gsub("[ ]+", " ", trimws(t))
  }
  for (b in tpl$blocks %||% list()) {
    if (!identical(b$type, "greeting")) next
    text <- .cmail_one(b$text) %||% ""
    if (!length(intersect(.cmail_tokens(text), keys))) next
    line <- sprintf("El saludo saldrá «%s»", blank(text))
    fb <- .cmail_one(b$fallback)
    out <- c(out, paste0(line, if (!is.null(fb)) sprintf("; el respaldo «%s» no se usa.", gsub("**", "", fb, fixed = TRUE)) else "."))
  }
  for (k in setdiff(keys, "nombre")) {
    fb <- fields[[k]]$fallback
    out <- c(out, if (!is.null(fb) && nzchar(fb)) sprintf("{{%s}} saldrá vacío; el respaldo «%s» no se usa.", k, fb)
                  else sprintf("{{%s}} saldrá vacío.", k))
  }
  if ("nombre" %in% keys && !any(grepl("^El saludo", out))) out <- c(out, "{{nombre}} saldrá vacío.")
  out
}

#' Contraste del texto blanco sobre el acento (botón sólido, cabecera oscura).
#' Bajo 4,5:1 avisa; bajo 3:1 bloquea.
#' @keywords internal
.cmail_accent_check <- function(tpl) {
  accent <- .cmail_one(tpl$theme$accent) %||% .CMAIL_DEFAULT_ACCENT
  targets <- list()
  if (identical(tpl$header$kind, "logos") && identical(tpl$header$background %||% "light", "dark")) {
    targets[[length(targets) + 1L]] <- .cmail_target("__cabecera")
  }
  for (b in tpl$blocks %||% list()) {
    if (identical(b$type, "button") && identical(.cmail_style(b, "fill", "solido"), "solido")) {
      targets[[length(targets) + 1L]] <- .cmail_target(as.character(b$block_id))
    }
  }
  ratio <- round(.cmail_contrast("#ffffff", accent), 2)
  if (!length(targets)) {
    return(.cmail_check("accent_contrast", "ok", ratio, "Ningún texto blanco va sobre el acento."))
  }
  if (ratio < 3) {
    .cmail_check("accent_contrast", "error", ratio,
                 sprintf("El texto blanco sobre el acento %s tiene contraste %.2f:1 (mínimo 3:1); elige un acento más oscuro.", accent, ratio),
                 targets = targets)
  } else if (ratio < 4.5) {
    .cmail_check("accent_contrast", "warning", ratio,
                 sprintf("El texto blanco sobre el acento %s tiene contraste %.2f:1; se recomienda 4,5:1.", accent, ratio),
                 targets = targets)
  } else {
    .cmail_check("accent_contrast", "ok", ratio, sprintf("Contraste del texto blanco sobre el acento: %.2f:1.", ratio))
  }
}
